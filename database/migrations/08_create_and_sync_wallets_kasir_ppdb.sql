-- ====================================================================
-- MIGRATION 08: DDL & SINKRONISASI DOMAIN KEUANGAN (TABUNGAN, KASIR, TARIF), PPDB & RBAC
-- Target Tenant : PPTQ Roudlotul Mubarokah (baa9eb9b-2d87-4648-a674-059bb289cb63)
-- Sumber Data   : Google Spreadsheet [OFFICIAL]
-- ====================================================================

-- 1. TABEL FINANCIAL_TARIFFS (Master Pos Tarif & Tagihan)
CREATE TABLE IF NOT EXISTS public.financial_tariffs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    tariff_id VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL,
    period_type VARCHAR(50) NOT NULL,
    amount NUMERIC(14,2) NOT NULL,
    program VARCHAR(100) DEFAULT 'SEMUA',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, tariff_id)
);

ALTER TABLE public.financial_tariffs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Tariffs" ON public.financial_tariffs;
CREATE POLICY "Public Read Tariffs" ON public.financial_tariffs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin All Tariffs" ON public.financial_tariffs;
CREATE POLICY "Admin All Tariffs" ON public.financial_tariffs FOR ALL USING (true);

-- 2. TABEL STUDENT_WALLETS (Dompet Digital Uang Saku & Tabungan Santri)
CREATE TABLE IF NOT EXISTS public.student_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    student_code VARCHAR(50),
    balance NUMERIC(14,2) DEFAULT 0,
    daily_limit NUMERIC(14,2) DEFAULT 25000,
    daily_spent NUMERIC(14,2) DEFAULT 0,
    last_spent_date DATE,
    is_locked BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, student_id)
);

ALTER TABLE public.student_wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Wallets" ON public.student_wallets;
CREATE POLICY "Public Read Wallets" ON public.student_wallets FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin All Wallets" ON public.student_wallets;
CREATE POLICY "Admin All Wallets" ON public.student_wallets FOR ALL USING (true);

-- 3. TABEL WALLET_TRANSACTIONS (Riwayat Mutasi & Belanja Cashless Kantin)
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    mutation_code VARCHAR(50) NOT NULL,
    wallet_id UUID REFERENCES public.student_wallets(id) ON DELETE SET NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL,
    amount NUMERIC(14,2) NOT NULL,
    balance_before NUMERIC(14,2) NOT NULL,
    balance_after NUMERIC(14,2) NOT NULL,
    description TEXT,
    cashier_name VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, mutation_code)
);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Wallet Transactions" ON public.wallet_transactions;
CREATE POLICY "Public Read Wallet Transactions" ON public.wallet_transactions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin All Wallet Transactions" ON public.wallet_transactions;
CREATE POLICY "Admin All Wallet Transactions" ON public.wallet_transactions FOR ALL USING (true);

-- 4. TABEL CASHIER_CLOSINGS (Buku Tutup Kasir & Rekonsiliasi Kas Harian)
CREATE TABLE IF NOT EXISTS public.cashier_closings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    closing_code VARCHAR(50) NOT NULL,
    closing_date DATE NOT NULL,
    cashier_name VARCHAR(100) NOT NULL,
    initial_cash NUMERIC(14,2) DEFAULT 0,
    cash_in NUMERIC(14,2) DEFAULT 0,
    transfer_in NUMERIC(14,2) DEFAULT 0,
    qris_in NUMERIC(14,2) DEFAULT 0,
    cash_out NUMERIC(14,2) DEFAULT 0,
    system_balance NUMERIC(14,2) DEFAULT 0,
    physical_balance NUMERIC(14,2) DEFAULT 0,
    discrepancy NUMERIC(14,2) DEFAULT 0,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'CLOSED',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, closing_code)
);

ALTER TABLE public.cashier_closings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Closings" ON public.cashier_closings;
CREATE POLICY "Public Read Closings" ON public.cashier_closings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin All Closings" ON public.cashier_closings;
CREATE POLICY "Admin All Closings" ON public.cashier_closings FOR ALL USING (true);

-- 5. TABEL PPDB_REGISTRATIONS (Penerimaan Peserta Didik Baru)
CREATE TABLE IF NOT EXISTS public.ppdb_registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    registration_no VARCHAR(50),
    name VARCHAR(150) NOT NULL,
    nisn VARCHAR(50),
    guardian_name VARCHAR(150),
    whatsapp VARCHAR(50),
    program VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending',
    registration_date TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, nisn)
);

ALTER TABLE public.ppdb_registrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read PPDB" ON public.ppdb_registrations;
CREATE POLICY "Public Read PPDB" ON public.ppdb_registrations FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin All PPDB" ON public.ppdb_registrations;
CREATE POLICY "Admin All PPDB" ON public.ppdb_registrations FOR ALL USING (true);

-- 6. TABEL ACTIVITY_SCHEDULES (Jadwal Kegiatan Harian Santri)
CREATE TABLE IF NOT EXISTS public.activity_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    schedule_id VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    type VARCHAR(50) DEFAULT 'Harian',
    time_range VARCHAR(100),
    tag VARCHAR(50),
    description TEXT,
    order_index INT DEFAULT 0,
    status VARCHAR(30) DEFAULT 'Aktif',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, schedule_id)
);

ALTER TABLE public.activity_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Schedules" ON public.activity_schedules;
CREATE POLICY "Public Read Schedules" ON public.activity_schedules FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin All Schedules" ON public.activity_schedules;
CREATE POLICY "Admin All Schedules" ON public.activity_schedules FOR ALL USING (true);

-- 7. TABEL ROLES_PERMISSIONS (Konfigurasi RBAC Peran Lembaga)
CREATE TABLE IF NOT EXISTS public.roles_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    role_key VARCHAR(50) NOT NULL,
    role_name VARCHAR(100) NOT NULL,
    total_active INT DEFAULT 0,
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_by VARCHAR(100) DEFAULT 'SYSTEM',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, role_key)
);

ALTER TABLE public.roles_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Roles Permissions" ON public.roles_permissions;
CREATE POLICY "Public Read Roles Permissions" ON public.roles_permissions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin All Roles Permissions" ON public.roles_permissions;
CREATE POLICY "Admin All Roles Permissions" ON public.roles_permissions FOR ALL USING (true);

-- ====================================================================
-- SEED DATA 1: FINANCIAL TARIFFS (6 Master Tarif Resmi)
-- ====================================================================
INSERT INTO public.financial_tariffs (tenant_id, tariff_id, name, category, period_type, amount, program, is_active, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'TRF-SPP-01',
    'Syahriah Pesantren',
    'BULANAN',
    'BULANAN',
    435000,
    'Pesantren Reguler Putra Putri',
    true,
    '2026-09-27T04:27:28.658Z'
)
ON CONFLICT (tenant_id, tariff_id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    period_type = EXCLUDED.period_type,
    amount = EXCLUDED.amount,
    program = EXCLUDED.program,
    is_active = EXCLUDED.is_active;

INSERT INTO public.financial_tariffs (tenant_id, tariff_id, name, category, period_type, amount, program, is_active, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'TRF-SPP-02',
    'Syahriah Pesantren',
    'BULANAN',
    'BULANAN',
    485000,
    'Pesantren Tahfidz Dewasa',
    true,
    '2026-09-27T04:27:28.658Z'
)
ON CONFLICT (tenant_id, tariff_id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    period_type = EXCLUDED.period_type,
    amount = EXCLUDED.amount,
    program = EXCLUDED.program,
    is_active = EXCLUDED.is_active;

INSERT INTO public.financial_tariffs (tenant_id, tariff_id, name, category, period_type, amount, program, is_active, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'TRF-SPP-03',
    'Syahriah Pesantren',
    'BULANAN',
    'BULANAN',
    639000,
    'MA Tahfidz',
    true,
    '2026-09-27T04:27:28.658Z'
)
ON CONFLICT (tenant_id, tariff_id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    period_type = EXCLUDED.period_type,
    amount = EXCLUDED.amount,
    program = EXCLUDED.program,
    is_active = EXCLUDED.is_active;

INSERT INTO public.financial_tariffs (tenant_id, tariff_id, name, category, period_type, amount, program, is_active, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'TRF-SPP-04',
    'Syahriah Pesantren',
    'BULANAN',
    'BULANAN',
    750000,
    'Pesantren Tahfidz Anak',
    true,
    '2026-09-27T04:27:28.658Z'
)
ON CONFLICT (tenant_id, tariff_id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    period_type = EXCLUDED.period_type,
    amount = EXCLUDED.amount,
    program = EXCLUDED.program,
    is_active = EXCLUDED.is_active;

INSERT INTO public.financial_tariffs (tenant_id, tariff_id, name, category, period_type, amount, program, is_active, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'TRF-DU-01',
    'Daftar Ulang Tahunan',
    'TAHUNAN',
    'TAHUNAN',
    50000,
    'SEMUA',
    true,
    '2026-09-27T04:27:28.658Z'
)
ON CONFLICT (tenant_id, tariff_id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    period_type = EXCLUDED.period_type,
    amount = EXCLUDED.amount,
    program = EXCLUDED.program,
    is_active = EXCLUDED.is_active;

INSERT INTO public.financial_tariffs (tenant_id, tariff_id, name, category, period_type, amount, program, is_active, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'TRF-GDG-01',
    'Uang Kegiatan 1 Tahun',
    'TAHUNAN',
    'TAHUNAN',
    200000,
    'SEMUA',
    true,
    '2026-09-27T04:27:28.658Z'
)
ON CONFLICT (tenant_id, tariff_id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    period_type = EXCLUDED.period_type,
    amount = EXCLUDED.amount,
    program = EXCLUDED.program,
    is_active = EXCLUDED.is_active;


-- ====================================================================
-- SEED DATA 2: STUDENT WALLETS (Inisialisasi 51 Dompet Santri)
-- ====================================================================
INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_001',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_001' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_002',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_002' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_003',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_003' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_004',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_004' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_005',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_005' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_006',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_006' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_007',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_007' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_008',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_008' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_009',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_009' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_010',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_010' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_011',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_011' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_012',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_012' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_013',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_013' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_014',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_014' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_015',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_015' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_016',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_016' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_017',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_017' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_018',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_018' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_019',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_019' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_020',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_020' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_021',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_021' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_022',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_022' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_023',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_023' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_024',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_024' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_025',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_025' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_026',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_026' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_027',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_027' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_028',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_028' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_029',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_029' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_030',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_030' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_031',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_031' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_032',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_032' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_033',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_033' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_034',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_034' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_035',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_035' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_036',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_036' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_037',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_037' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_038',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_038' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_039',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_039' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_040',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_040' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_041',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_041' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_042',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_042' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_043',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_043' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_044',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_044' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_045',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_045' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_046',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_046' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_047',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_047' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_048',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_048' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_049',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_049' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_050',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_050' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_051',
    0,
    25000,
    0,
    NULL,
    false,
    NOW()
FROM public.students s
WHERE s.student_id = 'STD_051' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;


-- ====================================================================
-- SEED DATA 3: ACTIVITY SCHEDULES (25 Jadwal Kegiatan Harian & Mingguan)
-- ====================================================================
INSERT INTO public.activity_schedules (tenant_id, schedule_id, name, type, time_range, tag, description, order_index, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'JDW_H_01',
    'Qiyamul Lail & Sholat Tahajud',
    'Harian',
    '03.30 - 04.30 WIB',
    '24 Jam',
    'Pembiasaan sholat sunnah tahajud, witir, dan istighfar fajar berjamaah di asrama santri.',
    1,
    'Aktif',
    '2026-10-10T02:01:33.232Z'
)
ON CONFLICT (tenant_id, schedule_id) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    time_range = EXCLUDED.time_range,
    tag = EXCLUDED.tag,
    description = EXCLUDED.description,
    order_index = EXCLUDED.order_index,
    status = EXCLUDED.status;

INSERT INTO public.activity_schedules (tenant_id, schedule_id, name, type, time_range, tag, description, order_index, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'JDW_M_01',
    'Puasa Sunnah & Buka Bersama sama',
    'Mingguan',
    'Senin & Kamis',
    'Sunnah',
    'Pelaksanaan Puasa Sunnah Senin-Kamis dilanjutkan doa & buka puasa bersama santri di aula.',
    1,
    'Aktif',
    '2026-10-10T02:01:33.232Z'
)
ON CONFLICT (tenant_id, schedule_id) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    time_range = EXCLUDED.time_range,
    tag = EXCLUDED.tag,
    description = EXCLUDED.description,
    order_index = EXCLUDED.order_index,
    status = EXCLUDED.status;

INSERT INTO public.activity_schedules (tenant_id, schedule_id, name, type, time_range, tag, description, order_index, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'JDW_B_01',
    'Sema''an Al-Qur''an Bil-Ghaib',
    'Bulanan',
    'Pekan Ke-1',
    'P-1',
    'Khataman Al-Qur''an hafalan santri secara bergantian dalam satu hari di majlis utama.',
    1,
    'Aktif',
    '2026-10-10T02:01:33.232Z'
)
ON CONFLICT (tenant_id, schedule_id) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    time_range = EXCLUDED.time_range,
    tag = EXCLUDED.tag,
    description = EXCLUDED.description,
    order_index = EXCLUDED.order_index,
    status = EXCLUDED.status;

INSERT INTO public.activity_schedules (tenant_id, schedule_id, name, type, time_range, tag, description, order_index, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'JDW_T_01',
    'Peringatan Maulid Nabi & Haflah Akhirussanah',
    'Tahunan',
    'Bulan Rabiul Awwal',
    'Event Akbar',
    'Perayaan maulid nabi dan temu akbar wali santri dengan tabligh akbar ulama.',
    1,
    'Aktif',
    '2026-10-10T02:01:33.232Z'
)
ON CONFLICT (tenant_id, schedule_id) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    time_range = EXCLUDED.time_range,
    tag = EXCLUDED.tag,
    description = EXCLUDED.description,
    order_index = EXCLUDED.order_index,
    status = EXCLUDED.status;

INSERT INTO public.activity_schedules (tenant_id, schedule_id, name, type, time_range, tag, description, order_index, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'JDW_H_02',
    'Sholat Subuh & Muroja''ah Pagi',
    'Harian',
    '04.30 - 05.30 WIB',
    'Wajib',
    'Sholat Subuh berjamaah dilanjutkan dzikir pagi dan muroja''ah hafalan Qur''an mandiri.',
    2,
    'Aktif',
    '2026-10-10T02:01:33.232Z'
)
ON CONFLICT (tenant_id, schedule_id) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    time_range = EXCLUDED.time_range,
    tag = EXCLUDED.tag,
    description = EXCLUDED.description,
    order_index = EXCLUDED.order_index,
    status = EXCLUDED.status;

INSERT INTO public.activity_schedules (tenant_id, schedule_id, name, type, time_range, tag, description, order_index, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'JDW_M_02',
    'Pembacaan Maulid Simthudduror / Diba''',
    'Mingguan',
    'Malam Jumat',
    'Sholawat',
    'Gema sholawat nabi dan pembacaan maulid diiringi tim hadroh santri di masjid utama.',
    2,
    'Aktif',
    '2026-10-10T02:01:33.232Z'
)
ON CONFLICT (tenant_id, schedule_id) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    time_range = EXCLUDED.time_range,
    tag = EXCLUDED.tag,
    description = EXCLUDED.description,
    order_index = EXCLUDED.order_index,
    status = EXCLUDED.status;

INSERT INTO public.activity_schedules (tenant_id, schedule_id, name, type, time_range, tag, description, order_index, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'JDW_B_02',
    'Santunan Yatim & Doa Bersama Wali Santri',
    'Bulanan',
    'Jumat Kliwon',
    'Sosial',
    'Pemberian santunan dan doa istighatsah bulanan bersama donatur dan masyarakat sekitar pondok.',
    2,
    'Aktif',
    '2026-10-10T02:01:33.232Z'
)
ON CONFLICT (tenant_id, schedule_id) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    time_range = EXCLUDED.time_range,
    tag = EXCLUDED.tag,
    description = EXCLUDED.description,
    order_index = EXCLUDED.order_index,
    status = EXCLUDED.status;

INSERT INTO public.activity_schedules (tenant_id, schedule_id, name, type, time_range, tag, description, order_index, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'JDW_T_02',
    'Khotmil Qur''an & Wisuda Santri',
    'Tahunan',
    'Bulan Sya''ban',
    'Wisuda',
    'Prosesi sakral wisuda santri yang telah menyelesaikan hafalan 30 Juz dan kitab diniyah.',
    2,
    'Aktif',
    '2026-10-10T02:01:33.232Z'
)
ON CONFLICT (tenant_id, schedule_id) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    time_range = EXCLUDED.time_range,
    tag = EXCLUDED.tag,
    description = EXCLUDED.description,
    order_index = EXCLUDED.order_index,
    status = EXCLUDED.status;

INSERT INTO public.activity_schedules (tenant_id, schedule_id, name, type, time_range, tag, description, order_index, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'JDW_H_03',
    'Halaqah Tahfidz Pagi',
    'Harian',
    '05.30 - 06.30 WIB',
    'Tahfidz',
    'Setoran ziyadah hafalan baru Al-Qur''an dan bimbingan tajwid bersama ustadz pembina halaqah.',
    3,
    'Aktif',
    '2026-10-10T02:01:33.232Z'
)
ON CONFLICT (tenant_id, schedule_id) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    time_range = EXCLUDED.time_range,
    tag = EXCLUDED.tag,
    description = EXCLUDED.description,
    order_index = EXCLUDED.order_index,
    status = EXCLUDED.status;

INSERT INTO public.activity_schedules (tenant_id, schedule_id, name, type, time_range, tag, description, order_index, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'JDW_M_03',
    'Mujahadah & Istighotsah Kubro Santri',
    'Mingguan',
    'Jumat Pagi',
    'Doa Bersama',
    'Doa bersama untuk keberkahan ilmu, orang tua wali santri, bangsa, dan kebaikan umat.',
    3,
    'Aktif',
    '2026-10-10T02:01:33.232Z'
)
ON CONFLICT (tenant_id, schedule_id) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    time_range = EXCLUDED.time_range,
    tag = EXCLUDED.tag,
    description = EXCLUDED.description,
    order_index = EXCLUDED.order_index,
    status = EXCLUDED.status;

INSERT INTO public.activity_schedules (tenant_id, schedule_id, name, type, time_range, tag, description, order_index, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'JDW_B_03',
    'Evaluasi Bulanan & Tasmi'' Juziyyah',
    'Bulanan',
    'Pekan Ke-4',
    'Ujian Tahfidz',
    'Ujian tasmi'' sekali duduk per 1 juz atau 5 juz di hadapan dewan asatidz tahfidz.',
    3,
    'Aktif',
    '2026-10-10T02:01:33.232Z'
)
ON CONFLICT (tenant_id, schedule_id) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    time_range = EXCLUDED.time_range,
    tag = EXCLUDED.tag,
    description = EXCLUDED.description,
    order_index = EXCLUDED.order_index,
    status = EXCLUDED.status;

INSERT INTO public.activity_schedules (tenant_id, schedule_id, name, type, time_range, tag, description, order_index, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'JDW_T_03',
    'Pesantren Kilat Ramadhan & Tarawih 30 Juz',
    'Tahunan',
    'Bulan Ramadhan',
    'Ramadhan',
    'Kajian pasaran kitab kuning intensif dan sholat tarawih 1 malam 1 juz Al-Qur''an.',
    3,
    'Aktif',
    '2026-10-10T02:01:33.232Z'
)
ON CONFLICT (tenant_id, schedule_id) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    time_range = EXCLUDED.time_range,
    tag = EXCLUDED.tag,
    description = EXCLUDED.description,
    order_index = EXCLUDED.order_index,
    status = EXCLUDED.status;

INSERT INTO public.activity_schedules (tenant_id, schedule_id, name, type, time_range, tag, description, order_index, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'JDW_H_04',
    'Sarapan & Piket Kebersihan Pondok',
    'Harian',
    '06.30 - 07.15 WIB',
    'Kedisiplinan',
    'Makan pagi bersama dan operasi bersih lingkungan kamar santri dan area pesantren.',
    4,
    'Aktif',
    '2026-10-10T02:01:33.232Z'
)
ON CONFLICT (tenant_id, schedule_id) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    time_range = EXCLUDED.time_range,
    tag = EXCLUDED.tag,
    description = EXCLUDED.description,
    order_index = EXCLUDED.order_index,
    status = EXCLUDED.status;

INSERT INTO public.activity_schedules (tenant_id, schedule_id, name, type, time_range, tag, description, order_index, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'JDW_M_04',
    'Latihan Khithobah & Muhadharah 3 Bahasa',
    'Mingguan',
    'Sabtu Malam',
    'Public Speaking',
    'Latihan pidato santri dalam bahasa Indonesia, Arab, dan Inggris melatih mental kepemimpinan.',
    4,
    'Aktif',
    '2026-10-10T02:01:33.232Z'
)
ON CONFLICT (tenant_id, schedule_id) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    time_range = EXCLUDED.time_range,
    tag = EXCLUDED.tag,
    description = EXCLUDED.description,
    order_index = EXCLUDED.order_index,
    status = EXCLUDED.status;

INSERT INTO public.activity_schedules (tenant_id, schedule_id, name, type, time_range, tag, description, order_index, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'JDW_B_04',
    'Sidang Dewan Pengurus & Bahtsul Masail',
    'Bulanan',
    'Sabtu Malam Akhir Bulan',
    'Musyawarah',
    'Musyawarah fikih dan evaluasi manajemen kegiatan kedisiplinan santri antarpengurus.',
    4,
    'Aktif',
    '2026-10-10T02:01:33.232Z'
)
ON CONFLICT (tenant_id, schedule_id) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    time_range = EXCLUDED.time_range,
    tag = EXCLUDED.tag,
    description = EXCLUDED.description,
    order_index = EXCLUDED.order_index,
    status = EXCLUDED.status;

INSERT INTO public.activity_schedules (tenant_id, schedule_id, name, type, time_range, tag, description, order_index, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'JDW_T_04',
    'Kemah Santri & Peringatan Hari Santri Nasional',
    'Tahunan',
    'Thu Oct 22 2026 00:00:00 GMT+0700 (Waktu Indonesia Barat)',
    'Hari Santri',
    'Apel akbar hari santri nasional, perkemahan, napak tilas perjuangan muassis pesantren.',
    4,
    'Aktif',
    '2026-10-10T02:01:33.232Z'
)
ON CONFLICT (tenant_id, schedule_id) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    time_range = EXCLUDED.time_range,
    tag = EXCLUDED.tag,
    description = EXCLUDED.description,
    order_index = EXCLUDED.order_index,
    status = EXCLUDED.status;

INSERT INTO public.activity_schedules (tenant_id, schedule_id, name, type, time_range, tag, description, order_index, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'JDW_H_05',
    'Sholat Dhuha Berjamaah',
    'Harian',
    '07.15 - 07.45 WIB',
    'Sunnah',
    'Pelaksanaan sholat sunnah dhuha secara berjamaah di masjid utama sebelum kegiatan belajar formal.',
    5,
    'Aktif',
    '2026-10-10T02:01:33.232Z'
)
ON CONFLICT (tenant_id, schedule_id) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    time_range = EXCLUDED.time_range,
    tag = EXCLUDED.tag,
    description = EXCLUDED.description,
    order_index = EXCLUDED.order_index,
    status = EXCLUDED.status;

INSERT INTO public.activity_schedules (tenant_id, schedule_id, name, type, time_range, tag, description, order_index, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'JDW_M_05',
    'Senam Santri & Ro''an Akbar Pondok',
    'Mingguan',
    'Ahad Pagi',
    'Kebugaran',
    'Olahraga kebugaran santri dilanjutkan kerja bakti massal membersihkan lingkungan pondok.',
    5,
    'Aktif',
    '2026-10-10T02:01:33.232Z'
)
ON CONFLICT (tenant_id, schedule_id) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    time_range = EXCLUDED.time_range,
    tag = EXCLUDED.tag,
    description = EXCLUDED.description,
    order_index = EXCLUDED.order_index,
    status = EXCLUDED.status;

INSERT INTO public.activity_schedules (tenant_id, schedule_id, name, type, time_range, tag, description, order_index, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'JDW_T_05',
    'Rihlah Ilmiah & Ziarah Wali Songo',
    'Tahunan',
    'Liburan Akhir Tahun',
    'Ziarah',
    'Perjalanan ziarah makam para wali dan ulama nusantara memperkuat sanad dan berkah.',
    5,
    'Aktif',
    '2026-10-10T02:01:33.232Z'
)
ON CONFLICT (tenant_id, schedule_id) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    time_range = EXCLUDED.time_range,
    tag = EXCLUDED.tag,
    description = EXCLUDED.description,
    order_index = EXCLUDED.order_index,
    status = EXCLUDED.status;

INSERT INTO public.activity_schedules (tenant_id, schedule_id, name, type, time_range, tag, description, order_index, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'JDW_H_06',
    'Kegiatan Belajar Madrasah / Sekolah',
    'Harian',
    '07.45 - 11.45 WIB',
    'Formal',
    'Pembelajaran kurikulum formal, sains, bahasa, dan keilmuan umum di kelas madrasah.',
    6,
    'Aktif',
    '2026-10-10T02:01:33.232Z'
)
ON CONFLICT (tenant_id, schedule_id) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    time_range = EXCLUDED.time_range,
    tag = EXCLUDED.tag,
    description = EXCLUDED.description,
    order_index = EXCLUDED.order_index,
    status = EXCLUDED.status;

INSERT INTO public.activity_schedules (tenant_id, schedule_id, name, type, time_range, tag, description, order_index, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'JDW_H_07',
    'Sholat Dhuhur & Istirahat Qailulah',
    'Harian',
    '11.45 - 13.30 WIB',
    'Istirahat',
    'Sholat Dhuhur berjamaah, makan siang, dan tidur siang sejenak mengikuti sunnah nabi.',
    7,
    'Aktif',
    '2026-10-10T02:01:33.232Z'
)
ON CONFLICT (tenant_id, schedule_id) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    time_range = EXCLUDED.time_range,
    tag = EXCLUDED.tag,
    description = EXCLUDED.description,
    order_index = EXCLUDED.order_index,
    status = EXCLUDED.status;

INSERT INTO public.activity_schedules (tenant_id, schedule_id, name, type, time_range, tag, description, order_index, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'JDW_H_08',
    'Pembelajaran Madrasah Diniyah',
    'Harian',
    '13.30 - 15.00 WIB',
    'Diniyah',
    'Kajian kitab kuning dasar (Safinatun Najah, Jurumiyyah, Aqidatul Awam, dll) sesuai tingkatan kelas.',
    8,
    'Aktif',
    '2026-10-10T02:01:33.232Z'
)
ON CONFLICT (tenant_id, schedule_id) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    time_range = EXCLUDED.time_range,
    tag = EXCLUDED.tag,
    description = EXCLUDED.description,
    order_index = EXCLUDED.order_index,
    status = EXCLUDED.status;

INSERT INTO public.activity_schedules (tenant_id, schedule_id, name, type, time_range, tag, description, order_index, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'JDW_H_09',
    'Sholat Ashar & Mufradat Bahasa',
    'Harian',
    '15.15 - 16.30 WIB',
    'Bahasa',
    'Sholat Ashar berjamaah dan penambahan kosa kata harian Bahasa Arab dan Inggris santri.',
    9,
    'Aktif',
    '2026-10-10T02:01:33.232Z'
)
ON CONFLICT (tenant_id, schedule_id) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    time_range = EXCLUDED.time_range,
    tag = EXCLUDED.tag,
    description = EXCLUDED.description,
    order_index = EXCLUDED.order_index,
    status = EXCLUDED.status;

INSERT INTO public.activity_schedules (tenant_id, schedule_id, name, type, time_range, tag, description, order_index, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'JDW_H_10',
    'Sholat Maghrib & Sorogan Kitab / Yanbu''a',
    'Harian',
    '17.45 - 19.00 WIB',
    'Sorogan',
    'Sholat Maghrib, membaca ratib/wirid, dan sorogan qira''ah Al-Qur''an metode Yanbu''a.',
    10,
    'Aktif',
    '2026-10-10T02:01:33.232Z'
)
ON CONFLICT (tenant_id, schedule_id) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    time_range = EXCLUDED.time_range,
    tag = EXCLUDED.tag,
    description = EXCLUDED.description,
    order_index = EXCLUDED.order_index,
    status = EXCLUDED.status;

INSERT INTO public.activity_schedules (tenant_id, schedule_id, name, type, time_range, tag, description, order_index, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'JDW_H_11',
    'Sholat Isya & Belajar Malam Terbimbing',
    'Harian',
    '19.15 - 21.30 WIB',
    'Muroja''ah',
    'Sholat Isya berjamaah dilanjutkan mudzakarah pelajaran dan persiapan setoran hafalan esok hari.',
    11,
    'Aktif',
    '2026-10-10T02:01:33.232Z'
)
ON CONFLICT (tenant_id, schedule_id) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    time_range = EXCLUDED.time_range,
    tag = EXCLUDED.tag,
    description = EXCLUDED.description,
    order_index = EXCLUDED.order_index,
    status = EXCLUDED.status;


-- ====================================================================
-- SEED DATA 4: ROLES & PERMISSIONS RBAC MATRIX (7 Peran Resmi)
-- ====================================================================
INSERT INTO public.roles_permissions (tenant_id, role_key, role_name, total_active, permissions, updated_by, updated_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'SUPER_ADMIN',
    'Super Administrator',
    28,
    '["*"]'::jsonb,
    'SYSTEM_MIGRATION',
    NOW()
)
ON CONFLICT (tenant_id, role_key) DO UPDATE SET
    role_name = EXCLUDED.role_name,
    total_active = EXCLUDED.total_active,
    permissions = EXCLUDED.permissions,
    updated_at = NOW();

INSERT INTO public.roles_permissions (tenant_id, role_key, role_name, total_active, permissions, updated_by, updated_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'ADMIN',
    'Administrator Lembaga',
    30,
    '["santri.view","santri.create","santri.edit","santri.delete","santri.export","wali.view","wali.manage","unit.manage","tahfidz.view","tahfidz.entry","tahfidz.target","tahfidz.halaqah","tahfidz.sesi","tpq.view","tpq.entry","tpq.kelas","tpq.sesi","sorogan.view","sorogan.entry","sorogan.halaqah","sorogan.sesi","presensi.view","presensi.entry","presensi.kegiatan","presensi.sesi","madin.view","madin.entry","madin.kelas","madin.kitab","keuangan.view","keuangan.spp","keuangan.tagihan","keuangan.verify","keuangan.billing","akuntansi.view","akuntansi.transaksi","akuntansi.tutupkasir","akuntansi.laporan","tabungan.view","tabungan.topup","tabungan.tarik","tabungan.kantin","ppdb.manage","perpulangan.view","perizinan.manage","berita.manage","banner.manage","galeri.manage","notifikasi.broadcast","profil.manage","pegawai.manage","users.manage","roles.manage","system.config"]'::jsonb,
    'SYSTEM_MIGRATION',
    NOW()
)
ON CONFLICT (tenant_id, role_key) DO UPDATE SET
    role_name = EXCLUDED.role_name,
    total_active = EXCLUDED.total_active,
    permissions = EXCLUDED.permissions,
    updated_at = NOW();

INSERT INTO public.roles_permissions (tenant_id, role_key, role_name, total_active, permissions, updated_by, updated_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'ASATIDZ',
    'Dewan Asatidz / Pengajar',
    10,
    '["santri.view","wali.view","tahfidz.view","tahfidz.entry","tahfidz.target","tahfidz.halaqah","tpq.view","tpq.entry","sorogan.view","sorogan.entry","presensi.view","presensi.entry","madin.view","madin.entry","perizinan.manage","pegawai.manage","profil.manage"]'::jsonb,
    'SYSTEM_MIGRATION',
    NOW()
)
ON CONFLICT (tenant_id, role_key) DO UPDATE SET
    role_name = EXCLUDED.role_name,
    total_active = EXCLUDED.total_active,
    permissions = EXCLUDED.permissions,
    updated_at = NOW();

INSERT INTO public.roles_permissions (tenant_id, role_key, role_name, total_active, permissions, updated_by, updated_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'BENDAHARA',
    'Bendahara / Keuangan',
    14,
    '["santri.view","ppdb.manage","keuangan.view","keuangan.spp","keuangan.tagihan","keuangan.verify","keuangan.billing","akuntansi.view","akuntansi.transaksi","akuntansi.tutupkasir","akuntansi.laporan","tabungan.view","tabungan.topup","tabungan.tarik","tabungan.kantin","notifikasi.broadcast","pegawai.manage","profil.manage"]'::jsonb,
    'SYSTEM_MIGRATION',
    NOW()
)
ON CONFLICT (tenant_id, role_key) DO UPDATE SET
    role_name = EXCLUDED.role_name,
    total_active = EXCLUDED.total_active,
    permissions = EXCLUDED.permissions,
    updated_at = NOW();

INSERT INTO public.roles_permissions (tenant_id, role_key, role_name, total_active, permissions, updated_by, updated_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'PENGURUS',
    'Pengurus / Kesantrian',
    12,
    '["santri.view","presensi.view","presensi.entry","unit.manage","ppdb.manage","perizinan.manage","perpulangan.view","berita.manage","banner.manage","galeri.manage","notifikasi.broadcast","profil.manage"]'::jsonb,
    'SYSTEM_MIGRATION',
    NOW()
)
ON CONFLICT (tenant_id, role_key) DO UPDATE SET
    role_name = EXCLUDED.role_name,
    total_active = EXCLUDED.total_active,
    permissions = EXCLUDED.permissions,
    updated_at = NOW();

INSERT INTO public.roles_permissions (tenant_id, role_key, role_name, total_active, permissions, updated_by, updated_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'PENGASUH',
    'Dewan Masyayikh / Pengasuh',
    17,
    '["santri.view","wali.view","tahfidz.view","tahfidz.entry","tahfidz.target","tahfidz.halaqah","tpq.view","tpq.entry","sorogan.view","sorogan.entry","presensi.view","presensi.entry","keuangan.view","akuntansi.view","tabungan.view","ppdb.manage","profil.manage"]'::jsonb,
    'SYSTEM_MIGRATION',
    NOW()
)
ON CONFLICT (tenant_id, role_key) DO UPDATE SET
    role_name = EXCLUDED.role_name,
    total_active = EXCLUDED.total_active,
    permissions = EXCLUDED.permissions,
    updated_at = NOW();

INSERT INTO public.roles_permissions (tenant_id, role_key, role_name, total_active, permissions, updated_by, updated_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'WALI_SANTRI',
    'Wali Santri / Orang Tua',
    6,
    '["santri.view","tahfidz.view","presensi.view","perpulangan.view","keuangan.view","tabungan.view"]'::jsonb,
    'SYSTEM_MIGRATION',
    NOW()
)
ON CONFLICT (tenant_id, role_key) DO UPDATE SET
    role_name = EXCLUDED.role_name,
    total_active = EXCLUDED.total_active,
    permissions = EXCLUDED.permissions,
    updated_at = NOW();

