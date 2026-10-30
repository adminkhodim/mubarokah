-- ====================================================================
-- FASE MIGRASI DOMAIN INTI: SANTRI, WALI, TAHFIDZ & KEUANGAN
-- MULTI-TENANT ARCHITECTURE FOR MUBAROKAH APP & KHODIM EDU CORE
-- ====================================================================

-- 1. TABEL STUDENTS (Master Data Santri)
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id VARCHAR(50) NOT NULL,
    nis VARCHAR(50),
    nik VARCHAR(30),
    name VARCHAR(150) NOT NULL,
    gender VARCHAR(10) DEFAULT 'L' CHECK (gender IN ('L', 'P')),
    birth_date DATE,
    photo_url TEXT,
    program VARCHAR(100) DEFAULT 'Tahfidz Al-Qur''an',
    status VARCHAR(30) DEFAULT 'Aktif' CHECK (status IN ('Aktif', 'Lulus', 'Mutasi', 'Nonaktif', 'Alumni')),
    qr_code TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_students_tenant_id ON public.students(tenant_id);
CREATE INDEX IF NOT EXISTS idx_students_nis ON public.students(tenant_id, nis);
CREATE INDEX IF NOT EXISTS idx_students_status ON public.students(tenant_id, status);

-- 2. TABEL GUARDIANS (Master Data Wali Santri)
CREATE TABLE IF NOT EXISTS public.guardians (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    identity_id VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150),
    phone VARCHAR(30),
    photo_url TEXT,
    status VARCHAR(30) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PENDING', 'SUSPENDED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, identity_id)
);

CREATE INDEX IF NOT EXISTS idx_guardians_tenant_id ON public.guardians(tenant_id);
CREATE INDEX IF NOT EXISTS idx_guardians_phone ON public.guardians(tenant_id, phone);

-- 3. TABEL STUDENT_GUARDIANS (Relasi Many-to-Many Santri & Wali)
CREATE TABLE IF NOT EXISTS public.student_guardians (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    guardian_id UUID NOT NULL REFERENCES public.guardians(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    relationship VARCHAR(30) DEFAULT 'GUARDIAN' CHECK (relationship IN ('FATHER', 'MOTHER', 'GUARDIAN', 'OTHER')),
    is_primary BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, guardian_id, student_id)
);

-- 4. TABEL TAHFIDZ_LOGS (Buku Catatan Setoran Ziyadah & Muraja'ah Harian)
CREATE TABLE IF NOT EXISTS public.tahfidz_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    log_id VARCHAR(50),
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    raw_student_id VARCHAR(50),
    student_name VARCHAR(150) NOT NULL,
    gender VARCHAR(10) DEFAULT 'L',
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    sesi VARCHAR(50) DEFAULT 'Pagi (Subuh)',
    tipe VARCHAR(50) DEFAULT 'Ziyadah' CHECK (tipe IN ('Ziyadah', 'Muraja''ah', 'Bin-Nadzor', 'Tahsin', 'Ujian')),
    juz INT CHECK (juz BETWEEN 1 AND 30),
    surah VARCHAR(100),
    halaman_list TEXT,
    total_halaman NUMERIC(6, 2) DEFAULT 0,
    nilai VARCHAR(30) DEFAULT 'JAYYID',
    muhafiz VARCHAR(150),
    catatan TEXT,
    status_setoran VARCHAR(20) DEFAULT 'LANJUT' CHECK (status_setoran IN ('LANJUT', 'ULANG')),
    satuan VARCHAR(20) DEFAULT 'HALAMAN' CHECK (satuan IN ('HALAMAN', 'AYAT')),
    ayat_mulai INT,
    ayat_sampai INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tahfidz_logs_tenant ON public.tahfidz_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tahfidz_logs_student ON public.tahfidz_logs(tenant_id, student_id);
CREATE INDEX IF NOT EXISTS idx_tahfidz_logs_tanggal ON public.tahfidz_logs(tenant_id, tanggal);

-- 5. TABEL TAHFIDZ_CAPAIAN (Akumulasi Progres & Mutqin Santri)
CREATE TABLE IF NOT EXISTS public.tahfidz_capaian (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    raw_student_id VARCHAR(50),
    student_name VARCHAR(150) NOT NULL,
    juz_aktif INT DEFAULT 30 CHECK (juz_aktif BETWEEN 1 AND 30),
    halaman_terakhir INT DEFAULT 1,
    total_halaman_tuntas NUMERIC(8, 2) DEFAULT 0,
    status_terakhir VARCHAR(50) DEFAULT 'Berjalan',
    halaqah_id VARCHAR(50),
    nama_halaqah VARCHAR(100),
    muhafiz_pembina VARCHAR(150),
    sabqi_halaman INT DEFAULT 0,
    manzil_juz INT DEFAULT 0,
    manzil_halaman INT DEFAULT 0,
    manzil_putaran INT DEFAULT 0,
    total_halaman_murojaah NUMERIC(8, 2) DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_tahfidz_capaian_tenant ON public.tahfidz_capaian(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tahfidz_capaian_student ON public.tahfidz_capaian(tenant_id, student_id);

-- 6. TABEL KEUANGAN_TAGIHAN (Tagihan Syahriah & Biaya Pendidikan Santri)
CREATE TABLE IF NOT EXISTS public.keuangan_tagihan (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    tagihan_id VARCHAR(50) NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    raw_student_id VARCHAR(50),
    student_name VARCHAR(150) NOT NULL,
    pos_id VARCHAR(50),
    nama_pos VARCHAR(150) NOT NULL,
    periode VARCHAR(50) NOT NULL,
    nominal_tagihan NUMERIC(14, 2) NOT NULL DEFAULT 0,
    nominal_terbayar NUMERIC(14, 2) NOT NULL DEFAULT 0,
    sisa_tagihan NUMERIC(14, 2) NOT NULL DEFAULT 0,
    status VARCHAR(30) DEFAULT 'BELUM_LUNAS' CHECK (status IN ('BELUM_LUNAS', 'SEBAGIAN', 'LUNAS', 'BATAL')),
    due_date DATE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, tagihan_id)
);

CREATE INDEX IF NOT EXISTS idx_tagihan_tenant ON public.keuangan_tagihan(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tagihan_student ON public.keuangan_tagihan(tenant_id, student_id);
CREATE INDEX IF NOT EXISTS idx_tagihan_status ON public.keuangan_tagihan(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_tagihan_periode ON public.keuangan_tagihan(tenant_id, periode);

-- 7. TABEL KEUANGAN_TRANSAKSI (Kas Masuk & Bukti Pembayaran Kuitansi)
CREATE TABLE IF NOT EXISTS public.keuangan_transaksi (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    transaksi_id VARCHAR(50) NOT NULL,
    no_kuitansi VARCHAR(100) NOT NULL,
    tanggal_bayar TIMESTAMPTZ DEFAULT NOW(),
    student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
    raw_student_id VARCHAR(50),
    student_name VARCHAR(150) NOT NULL,
    tagihan_ids_json JSONB DEFAULT '[]'::jsonb,
    nominal_total NUMERIC(14, 2) NOT NULL DEFAULT 0,
    metode_bayar VARCHAR(50) DEFAULT 'TUNAI' CHECK (metode_bayar IN ('TUNAI', 'TRANSFER', 'QRIS', 'MIDTRANS', 'TABUNGAN')),
    nama_kasir VARCHAR(150),
    catatan TEXT,
    status VARCHAR(30) DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'BATAL', 'PENDING')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, transaksi_id)
);

CREATE INDEX IF NOT EXISTS idx_transaksi_tenant ON public.keuangan_transaksi(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transaksi_student ON public.keuangan_transaksi(tenant_id, student_id);
CREATE INDEX IF NOT EXISTS idx_transaksi_kuitansi ON public.keuangan_transaksi(tenant_id, no_kuitansi);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

-- Policy Tenants: Publik / Client dapat membaca identitas tenant aktif
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'tenants' AND policyname = 'Public Read Active Tenants'
    ) THEN
        CREATE POLICY "Public Read Active Tenants" ON public.tenants
            FOR SELECT USING (is_active = true);
    END IF;
END $$;

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tahfidz_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tahfidz_capaian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keuangan_tagihan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keuangan_transaksi ENABLE ROW LEVEL SECURITY;

-- Policy Students: Baca data santri aktif
CREATE POLICY "Allow Read Active Students" ON public.students
    FOR SELECT USING (true);

-- Policy Guardians: Baca data wali
CREATE POLICY "Allow Read Guardians" ON public.guardians
    FOR SELECT USING (true);

-- Policy Student Guardians Map: Baca pemetaan relasi
CREATE POLICY "Allow Read Student Guardians" ON public.student_guardians
    FOR SELECT USING (true);

-- Policy Tahfidz Logs: Baca catatan setoran
CREATE POLICY "Allow Read Tahfidz Logs" ON public.tahfidz_logs
    FOR SELECT USING (true);

-- Policy Tahfidz Capaian: Baca progres capaian tahfidz
CREATE POLICY "Allow Read Tahfidz Capaian" ON public.tahfidz_capaian
    FOR SELECT USING (true);

-- Policy Keuangan Tagihan: Baca data tagihan
CREATE POLICY "Allow Read Keuangan Tagihan" ON public.keuangan_tagihan
    FOR SELECT USING (true);

-- Policy Keuangan Transaksi: Baca data transaksi
CREATE POLICY "Allow Read Keuangan Transaksi" ON public.keuangan_transaksi
    FOR SELECT USING (true);
