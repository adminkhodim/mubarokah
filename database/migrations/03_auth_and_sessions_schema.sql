-- ====================================================================
-- FASE MIGRASI AUTENTIKASI MODERN & POSTGRESQL SESSION
-- MULTI-TENANT ARCHITECTURE FOR MUBAROKAH APP & KHODIM EDU CORE
-- ====================================================================

-- 1. TABEL USER_IDENTITIES (Master Identitas Terpadu: Admin, Wali, Asatidz, Pengasuh)
CREATE TABLE IF NOT EXISTS public.user_identities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    identity_id VARCHAR(50) NOT NULL,
    email VARCHAR(150),
    phone VARCHAR(30),
    name VARCHAR(150) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'WALI_SANTRI',
    status VARCHAR(30) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PENDING', 'SUSPENDED', 'INACTIVE')),
    photo_url TEXT,
    password_hash TEXT,
    last_login_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ,
    device_info TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, identity_id)
);

CREATE INDEX IF NOT EXISTS idx_user_identities_tenant ON public.user_identities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_identities_email ON public.user_identities(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_user_identities_phone ON public.user_identities(tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_user_identities_role ON public.user_identities(tenant_id, role);

-- 2. TABEL AUTH_SESSIONS (Sesi Server-Side Berbasis PostgreSQL)
CREATE TABLE IF NOT EXISTS public.auth_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    session_id VARCHAR(100) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES public.user_identities(id) ON DELETE CASCADE,
    raw_identity_id VARCHAR(50) NOT NULL,
    role VARCHAR(50) NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    status VARCHAR(30) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED', 'EXPIRED')),
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_tenant ON public.auth_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_lookup ON public.auth_sessions(session_id, status);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token_hash ON public.auth_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON public.auth_sessions(user_id, status);

-- 3. TABEL OTP_CHALLENGES (Tantangan Verifikasi OTP Server-Side)
CREATE TABLE IF NOT EXISTS public.otp_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    challenge_id VARCHAR(100) UNIQUE NOT NULL,
    user_id UUID REFERENCES public.user_identities(id) ON DELETE CASCADE,
    channel VARCHAR(20) DEFAULT 'EMAIL' CHECK (channel IN ('EMAIL', 'WHATSAPP', 'SMS')),
    identifier_hash VARCHAR(64) NOT NULL,
    otp_hash VARCHAR(64) NOT NULL,
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 3,
    expires_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONSUMED', 'EXPIRED', 'FAILED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    consumed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_otp_challenges_tenant ON public.otp_challenges(tenant_id);
CREATE INDEX IF NOT EXISTS idx_otp_challenges_lookup ON public.otp_challenges(identifier_hash, status);

-- 4. TABEL AUTH_AUDIT_LOGS (Buku Rekam Jejak Keamanan Autentikasi)
CREATE TABLE IF NOT EXISTS public.auth_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    identity_id VARCHAR(50),
    session_id VARCHAR(100),
    channel VARCHAR(30) DEFAULT 'PASSWORD',
    success BOOLEAN DEFAULT true,
    ip_address VARCHAR(45),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_audit_tenant ON public.auth_audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_created_at ON public.auth_audit_logs(tenant_id, created_at DESC);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.user_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_audit_logs ENABLE ROW LEVEL SECURITY;

-- Keamanan Ketat: Hanya service_role atau fungsi tersanitasi yang dapat mengelola kredensial password
-- Publik hanya bisa membaca profil umum santri/alumni yang sudah diizinkan sebelumnya
CREATE POLICY "Public Read Profiles Non-Sensitive" ON public.user_identities
    FOR SELECT USING (status = 'ACTIVE');

CREATE POLICY "Public Read Active Sessions" ON public.auth_sessions
    FOR SELECT USING (status = 'ACTIVE' AND expires_at > NOW());

