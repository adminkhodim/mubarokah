-- ====================================================================
-- MIGRATION 12: DDL & SINKRONISASI TAHFIDZ HALAQAH, SESI, PEGAWAI & PERIZINAN
-- Target Tenant : PPTQ Roudlotul Mubarokah (baa9eb9b-2d87-4648-a674-059bb289cb63)
-- Sumber Data   : Google Spreadsheet [OFFICIAL] (Tahfidz_Halaqah, Tahfidz_Jadwal_Sesi, Pegawai, Izin_Asatidz)
-- ====================================================================

-- 1. TABEL TAHFIDZ_HALAQAH (Kelompok Halaqah Setoran Tahfidz)
CREATE TABLE IF NOT EXISTS public.tahfidz_halaqah (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    halaqah_code VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    muhafiz_name VARCHAR(255),
    curriculum_target VARCHAR(100) DEFAULT 'Tahfidz 30 Juz',
    student_ids JSONB DEFAULT '[]'::jsonb,
    student_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, halaqah_code)
);

ALTER TABLE public.tahfidz_halaqah ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Tahfidz Halaqah" ON public.tahfidz_halaqah;
CREATE POLICY "Public Read Tahfidz Halaqah" ON public.tahfidz_halaqah FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin All Tahfidz Halaqah" ON public.tahfidz_halaqah;
CREATE POLICY "Admin All Tahfidz Halaqah" ON public.tahfidz_halaqah FOR ALL USING (true);

-- 2. TABEL TAHFIDZ_SESSIONS (Master Jadwal Sesi Ziyadah & Muroja'ah)
CREATE TABLE IF NOT EXISTS public.tahfidz_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    session_code VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    session_type VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Aktif Digunakan',
    start_time VARCHAR(50),
    end_time VARCHAR(50),
    days JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, session_code)
);

ALTER TABLE public.tahfidz_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Tahfidz Sessions" ON public.tahfidz_sessions;
CREATE POLICY "Public Read Tahfidz Sessions" ON public.tahfidz_sessions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin All Tahfidz Sessions" ON public.tahfidz_sessions;
CREATE POLICY "Admin All Tahfidz Sessions" ON public.tahfidz_sessions FOR ALL USING (true);

-- 3. TABEL EMPLOYEES (Data Asatidz, Muhafiz & Pegawai Pesantren)
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    employee_code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    nip VARCHAR(50),
    gender VARCHAR(10) DEFAULT 'L',
    position VARCHAR(100) DEFAULT 'Ustadz',
    specialization VARCHAR(150),
    phone VARCHAR(50),
    email VARCHAR(150),
    status VARCHAR(30) DEFAULT 'Aktif',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, employee_code)
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Employees" ON public.employees;
CREATE POLICY "Public Read Employees" ON public.employees FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin All Employees" ON public.employees;
CREATE POLICY "Admin All Employees" ON public.employees FOR ALL USING (true);

-- 4. TABEL TEACHER_LEAVES (Perizinan Asatidz & Delegasi Badal Mengajar)
CREATE TABLE IF NOT EXISTS public.teacher_leaves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    leave_code VARCHAR(50) NOT NULL,
    teacher_name VARCHAR(255) NOT NULL,
    reason TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'Approved',
    substitute_teacher_name VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, leave_code)
);

ALTER TABLE public.teacher_leaves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Teacher Leaves" ON public.teacher_leaves;
CREATE POLICY "Public Read Teacher Leaves" ON public.teacher_leaves FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin All Teacher Leaves" ON public.teacher_leaves;
CREATE POLICY "Admin All Teacher Leaves" ON public.teacher_leaves FOR ALL USING (true);

-- ====================================================================
-- SEED DATA 1: TAHFIDZ HALAQAH (2 Kelompok Halaqah Resmi)
-- ====================================================================
INSERT INTO public.tahfidz_halaqah (tenant_id, halaqah_code, name, muhafiz_name, curriculum_target, student_ids, student_count, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'HLQ-20260922-0654',
    'Halaqah Nyai Hj. Nashichatul Fuadah, AH.',
    'Nyai Hj. Nashichatul Fuadah, AH.',
    'Tahfidz 30 Juz',
    '["STD_006","STD_007","STD_009","STD_010","STD_011","STD_008","STD_004","STD_014","STD_002","STD_013"]'::jsonb,
    10,
    NOW()
)
ON CONFLICT (tenant_id, halaqah_code) DO UPDATE SET
    name = EXCLUDED.name,
    muhafiz_name = EXCLUDED.muhafiz_name,
    curriculum_target = EXCLUDED.curriculum_target,
    student_ids = EXCLUDED.student_ids,
    student_count = EXCLUDED.student_count;

INSERT INTO public.tahfidz_halaqah (tenant_id, halaqah_code, name, muhafiz_name, curriculum_target, student_ids, student_count, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'HLQ-20260922-0712',
    'Halaqah Ustdz. Robiatul Awaliyah, AH.',
    'Ustdz. Robiatul Awaliyah, AH.',
    'Tahfidz 30 Juz',
    '["STD_001","STD_003","STD_005","STD_015","STD_016","STD_012","STD_011","STD_025"]'::jsonb,
    8,
    NOW()
)
ON CONFLICT (tenant_id, halaqah_code) DO UPDATE SET
    name = EXCLUDED.name,
    muhafiz_name = EXCLUDED.muhafiz_name,
    curriculum_target = EXCLUDED.curriculum_target,
    student_ids = EXCLUDED.student_ids,
    student_count = EXCLUDED.student_count;


-- ====================================================================
-- SEED DATA 2: TAHFIDZ SESSIONS (3 Sesi Ziyadah & Muroja'ah)
-- ====================================================================
INSERT INTO public.tahfidz_sessions (tenant_id, session_code, name, session_type, status, start_time, end_time, days, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'SESI-20260922-1011',
    'Pagi (Ba''da Subuh)',
    'Muroja''ah (Pengulangan)',
    'Aktif Digunakan',
    '05:00',
    '06:00',
    '["Sen","Rab","Kam","Sab","Min"]'::jsonb,
    NOW()
)
ON CONFLICT (tenant_id, session_code) DO UPDATE SET
    name = EXCLUDED.name,
    session_type = EXCLUDED.session_type,
    status = EXCLUDED.status,
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    days = EXCLUDED.days;

INSERT INTO public.tahfidz_sessions (tenant_id, session_code, name, session_type, status, start_time, end_time, days, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'SESI-20260922-1037',
    'Pagi (MA Tahfidz)',
    'Ziyadah (Setoran Hafalan Baru)',
    'Aktif Digunakan',
    '08:00',
    '09:00',
    '["Sen","Sel","Rab","Kam","Jum"]'::jsonb,
    NOW()
)
ON CONFLICT (tenant_id, session_code) DO UPDATE SET
    name = EXCLUDED.name,
    session_type = EXCLUDED.session_type,
    status = EXCLUDED.status,
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    days = EXCLUDED.days;

INSERT INTO public.tahfidz_sessions (tenant_id, session_code, name, session_type, status, start_time, end_time, days, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'SESI-20260922-1039',
    'Sore (Ba''da Asar)',
    'Ziyadah (Setoran Hafalan Baru)',
    'Aktif Digunakan',
    '16:00',
    '17:00',
    '["Sen","Sel","Rab","Kam","Sab"]'::jsonb,
    NOW()
)
ON CONFLICT (tenant_id, session_code) DO UPDATE SET
    name = EXCLUDED.name,
    session_type = EXCLUDED.session_type,
    status = EXCLUDED.status,
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    days = EXCLUDED.days;


-- ====================================================================
-- SEED DATA 3: EMPLOYEES (10 Asatidz & Pegawai Resmi)
-- ====================================================================
INSERT INTO public.employees (tenant_id, employee_code, name, gender, position, specialization, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'EMP-001',
    'Nyai Hj. Nashichatul Fuadah, AH.',
    'P',
    'Pengasuh / Dewan Masyayikh',
    'Tahfidzul Qur''an 30 Juz',
    'Aktif',
    NOW()
)
ON CONFLICT (tenant_id, employee_code) DO UPDATE SET
    name = EXCLUDED.name,
    gender = EXCLUDED.gender,
    position = EXCLUDED.position,
    specialization = EXCLUDED.specialization,
    status = EXCLUDED.status;

INSERT INTO public.employees (tenant_id, employee_code, name, gender, position, specialization, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'EMP-002',
    'Ustadz Nazirul Muhammad, AH.',
    'L',
    'Dewan Asatidz',
    'Tahfidz & Yanbu''a Jilid 6-7',
    'Aktif',
    NOW()
)
ON CONFLICT (tenant_id, employee_code) DO UPDATE SET
    name = EXCLUDED.name,
    gender = EXCLUDED.gender,
    position = EXCLUDED.position,
    specialization = EXCLUDED.specialization,
    status = EXCLUDED.status;

INSERT INTO public.employees (tenant_id, employee_code, name, gender, position, specialization, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'EMP-003',
    'Ustadzah Robiatul Awaliyah, AH.',
    'P',
    'Dewan Asatidz',
    'Tahfidzul Qur''an',
    'Aktif',
    NOW()
)
ON CONFLICT (tenant_id, employee_code) DO UPDATE SET
    name = EXCLUDED.name,
    gender = EXCLUDED.gender,
    position = EXCLUDED.position,
    specialization = EXCLUDED.specialization,
    status = EXCLUDED.status;

INSERT INTO public.employees (tenant_id, employee_code, name, gender, position, specialization, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'EMP-004',
    'Ustadzah Izza Nazila, AH.',
    'P',
    'Dewan Asatidz',
    'Tahfidzul Qur''an',
    'Aktif',
    NOW()
)
ON CONFLICT (tenant_id, employee_code) DO UPDATE SET
    name = EXCLUDED.name,
    gender = EXCLUDED.gender,
    position = EXCLUDED.position,
    specialization = EXCLUDED.specialization,
    status = EXCLUDED.status;

INSERT INTO public.employees (tenant_id, employee_code, name, gender, position, specialization, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'EMP-005',
    'Ustdz. Laila Luthfiana, AH.',
    'P',
    'Dewan Asatidz',
    'Yanbu''a Jilid 1-5',
    'Aktif',
    NOW()
)
ON CONFLICT (tenant_id, employee_code) DO UPDATE SET
    name = EXCLUDED.name,
    gender = EXCLUDED.gender,
    position = EXCLUDED.position,
    specialization = EXCLUDED.specialization,
    status = EXCLUDED.status;

INSERT INTO public.employees (tenant_id, employee_code, name, gender, position, specialization, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'EMP-006',
    'Ust. Hidayatullah Zaen',
    'L',
    'Dewan Asatidz',
    'Wali Kelas 1 Awaliyah / Fiqih',
    'Aktif',
    NOW()
)
ON CONFLICT (tenant_id, employee_code) DO UPDATE SET
    name = EXCLUDED.name,
    gender = EXCLUDED.gender,
    position = EXCLUDED.position,
    specialization = EXCLUDED.specialization,
    status = EXCLUDED.status;

INSERT INTO public.employees (tenant_id, employee_code, name, gender, position, specialization, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'EMP-007',
    'Ust. Mukhlasin',
    'L',
    'Dewan Asatidz',
    'Wali Kelas 3 Wustho / Nahwu Jurumiyah',
    'Aktif',
    NOW()
)
ON CONFLICT (tenant_id, employee_code) DO UPDATE SET
    name = EXCLUDED.name,
    gender = EXCLUDED.gender,
    position = EXCLUDED.position,
    specialization = EXCLUDED.specialization,
    status = EXCLUDED.status;

INSERT INTO public.employees (tenant_id, employee_code, name, gender, position, specialization, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'EMP-008',
    'Ust. Ulil Abshor',
    'L',
    'Dewan Asatidz',
    'Wali Kelas 2 Wustho / Safinatun Najah',
    'Aktif',
    NOW()
)
ON CONFLICT (tenant_id, employee_code) DO UPDATE SET
    name = EXCLUDED.name,
    gender = EXCLUDED.gender,
    position = EXCLUDED.position,
    specialization = EXCLUDED.specialization,
    status = EXCLUDED.status;

INSERT INTO public.employees (tenant_id, employee_code, name, gender, position, specialization, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'EMP-009',
    'Tutik Egiq Lestari',
    'P',
    'Bendahara Pesantren',
    'Administrasi Keuangan & Billing',
    'Aktif',
    NOW()
)
ON CONFLICT (tenant_id, employee_code) DO UPDATE SET
    name = EXCLUDED.name,
    gender = EXCLUDED.gender,
    position = EXCLUDED.position,
    specialization = EXCLUDED.specialization,
    status = EXCLUDED.status;

INSERT INTO public.employees (tenant_id, employee_code, name, gender, position, specialization, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'EMP-010',
    'Ketua Pondok',
    'L',
    'Pengurus Pesantren',
    'Ketertiban & Kedisiplinan Asrama',
    'Aktif',
    NOW()
)
ON CONFLICT (tenant_id, employee_code) DO UPDATE SET
    name = EXCLUDED.name,
    gender = EXCLUDED.gender,
    position = EXCLUDED.position,
    specialization = EXCLUDED.specialization,
    status = EXCLUDED.status;

