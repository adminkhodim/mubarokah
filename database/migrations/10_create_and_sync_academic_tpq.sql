-- ====================================================================
-- MIGRATION 10: DDL & SINKRONISASI DOMAIN AKADEMIK TPQ (METODE YANBU'A)
-- Target Tenant : PPTQ Roudlotul Mubarokah (baa9eb9b-2d87-4648-a674-059bb289cb63)
-- Sumber Data   : Google Spreadsheet [OFFICIAL] (TPQ_Kelas, TPQ_Sesi, TPQ_Capaian, TPQ_Logs, TPQ_Target)
-- ====================================================================

-- 1. TABEL TPQ_CLASSES (Master Kelas / Halaqah Belajar Yanbu'a)
CREATE TABLE IF NOT EXISTS public.tpq_classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    class_code VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    teacher_name VARCHAR(255),
    description TEXT,
    student_ids JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, class_code)
);

ALTER TABLE public.tpq_classes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read TPQ Classes" ON public.tpq_classes;
CREATE POLICY "Public Read TPQ Classes" ON public.tpq_classes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin All TPQ Classes" ON public.tpq_classes;
CREATE POLICY "Admin All TPQ Classes" ON public.tpq_classes FOR ALL USING (true);

-- 2. TABEL TPQ_SESSIONS (Master Sesi Belajar Yanbu'a)
CREATE TABLE IF NOT EXISTS public.tpq_sessions (
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

ALTER TABLE public.tpq_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read TPQ Sessions" ON public.tpq_sessions;
CREATE POLICY "Public Read TPQ Sessions" ON public.tpq_sessions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin All TPQ Sessions" ON public.tpq_sessions;
CREATE POLICY "Admin All TPQ Sessions" ON public.tpq_sessions FOR ALL USING (true);

-- 3. TABEL TPQ_CAPAIAN (Progress Capaian Jilid & Halaman Santri Yanbu'a)
CREATE TABLE IF NOT EXISTS public.tpq_capaian (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    student_code VARCHAR(50),
    student_name VARCHAR(255),
    active_jilid INT DEFAULT 1,
    active_page INT DEFAULT 1,
    last_status VARCHAR(50) DEFAULT 'LANJUT',
    class_code VARCHAR(100),
    class_name VARCHAR(255),
    teacher_name VARCHAR(255),
    target_jilid INT DEFAULT 1,
    target_page_per_session INT DEFAULT 1,
    target_page_per_week INT DEFAULT 11,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, student_id)
);

ALTER TABLE public.tpq_capaian ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read TPQ Capaian" ON public.tpq_capaian;
CREATE POLICY "Public Read TPQ Capaian" ON public.tpq_capaian FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin All TPQ Capaian" ON public.tpq_capaian;
CREATE POLICY "Admin All TPQ Capaian" ON public.tpq_capaian FOR ALL USING (true);

-- 4. TABEL TPQ_LOGS (Riwayat Setoran Harian Yanbu'a)
CREATE TABLE IF NOT EXISTS public.tpq_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    log_code VARCHAR(100) NOT NULL,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    student_code VARCHAR(50),
    nis VARCHAR(50),
    student_name VARCHAR(255),
    gender VARCHAR(10),
    date DATE NOT NULL,
    session_name VARCHAR(100),
    jilid INT NOT NULL,
    page INT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'LANJUT',
    grade VARCHAR(10),
    teacher_name VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, log_code)
);

ALTER TABLE public.tpq_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read TPQ Logs" ON public.tpq_logs;
CREATE POLICY "Public Read TPQ Logs" ON public.tpq_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin All TPQ Logs" ON public.tpq_logs;
CREATE POLICY "Admin All TPQ Logs" ON public.tpq_logs FOR ALL USING (true);

-- ====================================================================
-- SEED DATA 1: TPQ CLASSES (Master Kelas Yanbu'a)
-- ====================================================================
INSERT INTO public.tpq_classes (tenant_id, class_code, name, teacher_name, description, student_ids, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'TPQ-KLS-24CE97',
    'Kelas Ustdz. Laila Luthfiana, AH.',
    'Ustdz. Laila Luthfiana, AH.',
    'Yanbua Jilid 1 - 5',
    '["STD_037","STD_038","STD_039","STD_040","STD_045","STD_046","STD_047","STD_048","STD_049","STD_036","STD_033","STD_023"]'::jsonb,
    NOW()
)
ON CONFLICT (tenant_id, class_code) DO UPDATE SET
    name = EXCLUDED.name,
    teacher_name = EXCLUDED.teacher_name,
    description = EXCLUDED.description,
    student_ids = EXCLUDED.student_ids;

INSERT INTO public.tpq_classes (tenant_id, class_code, name, teacher_name, description, student_ids, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'TPQ-KLS-4D4C93',
    'Kelas Ust.Nazirul Muhammad, AH.',
    'Ust.Nazirul Muhammad, AH.',
    'Yanbua Jilid 6- 7',
    '["STD_050","STD_043","STD_042","STD_049"]'::jsonb,
    NOW()
)
ON CONFLICT (tenant_id, class_code) DO UPDATE SET
    name = EXCLUDED.name,
    teacher_name = EXCLUDED.teacher_name,
    description = EXCLUDED.description,
    student_ids = EXCLUDED.student_ids;


-- ====================================================================
-- SEED DATA 2: TPQ SESSIONS (Master Sesi Belajar)
-- ====================================================================
INSERT INTO public.tpq_sessions (tenant_id, session_code, name, session_type, status, start_time, end_time, days, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'TPQ-SESI-20260924-1445',
    'Pagi (Ba''da Subuh)',
    'Bimbingan Yanbu''a Reguler',
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

INSERT INTO public.tpq_sessions (tenant_id, session_code, name, session_type, status, start_time, end_time, days, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'TPQ-SESI-20260924-1446',
    'Sore (Ba''da Asar)',
    'Bimbingan Yanbu''a Reguler',
    'Aktif Digunakan',
    '16:00',
    '17:00',
    '["Sen","Sel","Rab","Kam","Sab","Min"]'::jsonb,
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
-- SEED DATA 3: TPQ CAPAIAN & TARGET (51 Santri Aktif Yanbu'a)
-- ====================================================================
INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_001',
    s.name,
    1,
    1,
    'LANJUT',
    NULL,
    'Belum Ditentukan',
    '-',
    2,
    1,
    11,
    '2026-10-31T04:06:19.646Z'
FROM public.students s
WHERE s.student_id = 'STD_001' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_002',
    s.name,
    1,
    1,
    'LANJUT',
    NULL,
    'Belum Ditentukan',
    '-',
    2,
    1,
    11,
    '2026-10-31T04:06:19.668Z'
FROM public.students s
WHERE s.student_id = 'STD_002' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_003',
    s.name,
    1,
    1,
    'LANJUT',
    NULL,
    'Belum Ditentukan',
    '-',
    2,
    1,
    11,
    '2026-10-31T04:06:19.668Z'
FROM public.students s
WHERE s.student_id = 'STD_003' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_004',
    s.name,
    1,
    1,
    'LANJUT',
    NULL,
    'Belum Ditentukan',
    '-',
    2,
    1,
    11,
    '2026-10-31T04:06:19.668Z'
FROM public.students s
WHERE s.student_id = 'STD_004' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_005',
    s.name,
    1,
    1,
    'LANJUT',
    NULL,
    'Belum Ditentukan',
    '-',
    2,
    1,
    11,
    '2026-10-31T04:06:19.668Z'
FROM public.students s
WHERE s.student_id = 'STD_005' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_006',
    s.name,
    1,
    1,
    'LANJUT',
    NULL,
    'Belum Ditentukan',
    '-',
    2,
    1,
    11,
    '2026-10-31T04:06:19.668Z'
FROM public.students s
WHERE s.student_id = 'STD_006' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_007',
    s.name,
    1,
    1,
    'LANJUT',
    NULL,
    'Belum Ditentukan',
    '-',
    2,
    1,
    11,
    '2026-10-31T04:06:19.668Z'
FROM public.students s
WHERE s.student_id = 'STD_007' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_008',
    s.name,
    1,
    1,
    'LANJUT',
    NULL,
    'Belum Ditentukan',
    '-',
    2,
    1,
    11,
    '2026-10-31T04:06:19.668Z'
FROM public.students s
WHERE s.student_id = 'STD_008' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_009',
    s.name,
    1,
    1,
    'LANJUT',
    NULL,
    'Belum Ditentukan',
    '-',
    2,
    1,
    11,
    '2026-10-31T04:06:19.668Z'
FROM public.students s
WHERE s.student_id = 'STD_009' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_010',
    s.name,
    1,
    1,
    'LANJUT',
    NULL,
    'Belum Ditentukan',
    '-',
    2,
    1,
    11,
    '2026-10-31T04:06:19.668Z'
FROM public.students s
WHERE s.student_id = 'STD_010' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_011',
    s.name,
    1,
    1,
    'LANJUT',
    NULL,
    'Belum Ditentukan',
    '-',
    2,
    1,
    11,
    '2026-10-31T04:06:19.668Z'
FROM public.students s
WHERE s.student_id = 'STD_011' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_012',
    s.name,
    1,
    1,
    'LANJUT',
    NULL,
    'Belum Ditentukan',
    '-',
    2,
    1,
    11,
    '2026-10-31T04:06:19.668Z'
FROM public.students s
WHERE s.student_id = 'STD_012' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_013',
    s.name,
    1,
    1,
    'LANJUT',
    NULL,
    'Belum Ditentukan',
    '-',
    2,
    1,
    11,
    '2026-10-31T04:06:19.668Z'
FROM public.students s
WHERE s.student_id = 'STD_013' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_014',
    s.name,
    1,
    1,
    'LANJUT',
    NULL,
    'Belum Ditentukan',
    '-',
    2,
    1,
    11,
    '2026-10-31T04:06:19.668Z'
FROM public.students s
WHERE s.student_id = 'STD_014' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_015',
    s.name,
    1,
    1,
    'LANJUT',
    NULL,
    'Belum Ditentukan',
    '-',
    2,
    1,
    11,
    '2026-10-31T04:06:19.668Z'
FROM public.students s
WHERE s.student_id = 'STD_015' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_016',
    s.name,
    1,
    1,
    'LANJUT',
    NULL,
    'Belum Ditentukan',
    '-',
    2,
    1,
    11,
    '2026-10-31T04:06:19.668Z'
FROM public.students s
WHERE s.student_id = 'STD_016' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_017',
    s.name,
    1,
    1,
    'LANJUT',
    NULL,
    'Belum Ditentukan',
    '-',
    2,
    1,
    11,
    '2026-10-31T04:06:19.668Z'
FROM public.students s
WHERE s.student_id = 'STD_017' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_018',
    s.name,
    1,
    1,
    'LANJUT',
    NULL,
    'Belum Ditentukan',
    '-',
    2,
    1,
    11,
    '2026-10-31T04:06:19.668Z'
FROM public.students s
WHERE s.student_id = 'STD_018' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_019',
    s.name,
    1,
    1,
    'LANJUT',
    NULL,
    'Belum Ditentukan',
    '-',
    2,
    1,
    11,
    '2026-10-31T04:06:19.668Z'
FROM public.students s
WHERE s.student_id = 'STD_019' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_020',
    s.name,
    1,
    1,
    'LANJUT',
    NULL,
    'Belum Ditentukan',
    '-',
    2,
    1,
    11,
    '2026-10-31T04:06:19.668Z'
FROM public.students s
WHERE s.student_id = 'STD_020' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_021',
    s.name,
    5,
    1,
    'ULANG',
    NULL,
    'Belum Ditentukan',
    '-',
    1,
    1,
    11,
    '2026-10-10T06:24:03.087Z'
FROM public.students s
WHERE s.student_id = 'STD_021' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_022',
    s.name,
    1,
    1,
    'LANJUT',
    NULL,
    'Belum Ditentukan',
    '-',
    2,
    1,
    11,
    '2026-10-31T04:06:19.668Z'
FROM public.students s
WHERE s.student_id = 'STD_022' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_023',
    s.name,
    1,
    1,
    'LANJUT',
    'TPQ-KLS-24CE97',
    'Kelas Ustdz. Laila Luthfiana, AH.',
    'Ustdz. Laila Luthfiana, AH.',
    2,
    1,
    11,
    '2026-10-10T06:24:03.087Z'
FROM public.students s
WHERE s.student_id = 'STD_023' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_024',
    s.name,
    1,
    1,
    'LANJUT',
    NULL,
    'Belum Ditentukan',
    '-',
    1,
    1,
    11,
    '2026-10-31T04:06:19.668Z'
FROM public.students s
WHERE s.student_id = 'STD_024' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_025',
    s.name,
    1,
    1,
    'LANJUT',
    NULL,
    'Belum Ditentukan',
    '-',
    2,
    1,
    11,
    '2026-10-31T04:06:19.668Z'
FROM public.students s
WHERE s.student_id = 'STD_025' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_026',
    s.name,
    1,
    1,
    'LANJUT',
    NULL,
    'Belum Ditentukan',
    '-',
    2,
    1,
    11,
    '2026-10-31T04:06:19.668Z'
FROM public.students s
WHERE s.student_id = 'STD_026' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_027',
    s.name,
    1,
    1,
    'LANJUT',
    NULL,
    'Belum Ditentukan',
    '-',
    2,
    1,
    11,
    '2026-10-31T04:06:19.668Z'
FROM public.students s
WHERE s.student_id = 'STD_027' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_028',
    s.name,
    1,
    1,
    'LANJUT',
    NULL,
    'Belum Ditentukan',
    '-',
    2,
    1,
    11,
    '2026-10-31T04:06:19.668Z'
FROM public.students s
WHERE s.student_id = 'STD_028' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_029',
    s.name,
    1,
    1,
    'LANJUT',
    NULL,
    'Belum Ditentukan',
    '-',
    2,
    1,
    11,
    '2026-10-31T04:06:19.668Z'
FROM public.students s
WHERE s.student_id = 'STD_029' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_030',
    s.name,
    1,
    1,
    'LANJUT',
    NULL,
    'Belum Ditentukan',
    '-',
    2,
    1,
    11,
    '2026-10-31T04:06:19.668Z'
FROM public.students s
WHERE s.student_id = 'STD_030' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_031',
    s.name,
    1,
    1,
    'LANJUT',
    NULL,
    'Belum Ditentukan',
    '-',
    2,
    1,
    11,
    '2026-10-31T04:06:19.668Z'
FROM public.students s
WHERE s.student_id = 'STD_031' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_032',
    s.name,
    1,
    1,
    'LANJUT',
    NULL,
    'Belum Ditentukan',
    '-',
    2,
    1,
    11,
    '2026-10-31T04:06:19.668Z'
FROM public.students s
WHERE s.student_id = 'STD_032' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_033',
    s.name,
    1,
    1,
    'LANJUT',
    'TPQ-KLS-24CE97',
    'Kelas Ustdz. Laila Luthfiana, AH.',
    'Ustdz. Laila Luthfiana, AH.',
    2,
    1,
    11,
    '2026-10-10T06:24:03.087Z'
FROM public.students s
WHERE s.student_id = 'STD_033' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_034',
    s.name,
    1,
    1,
    'LANJUT',
    NULL,
    'Belum Ditentukan',
    '-',
    2,
    1,
    11,
    '2026-10-31T04:06:19.668Z'
FROM public.students s
WHERE s.student_id = 'STD_034' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_035',
    s.name,
    1,
    1,
    'LANJUT',
    NULL,
    'Belum Ditentukan',
    '-',
    2,
    1,
    11,
    '2026-10-31T04:06:19.668Z'
FROM public.students s
WHERE s.student_id = 'STD_035' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_036',
    s.name,
    1,
    1,
    'LANJUT',
    'TPQ-KLS-24CE97',
    'Kelas Ustdz. Laila Luthfiana, AH.',
    'Ustdz. Laila Luthfiana, AH.',
    2,
    1,
    11,
    '2026-10-10T06:24:03.087Z'
FROM public.students s
WHERE s.student_id = 'STD_036' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_037',
    s.name,
    1,
    1,
    'LANJUT',
    'TPQ-KLS-24CE97',
    'Kelas Ustdz. Laila Luthfiana, AH.',
    'Ustdz. Laila Luthfiana, AH.',
    1,
    1,
    11,
    '2026-10-10T06:24:03.087Z'
FROM public.students s
WHERE s.student_id = 'STD_037' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_038',
    s.name,
    3,
    29,
    'ULANG',
    'TPQ-KLS-24CE97',
    'Kelas Ustdz. Laila Luthfiana, AH.',
    'Ustdz. Laila Luthfiana, AH.',
    1,
    1,
    11,
    '2026-10-09T22:35:26.602Z'
FROM public.students s
WHERE s.student_id = 'STD_038' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_039',
    s.name,
    4,
    32,
    'ULANG',
    'TPQ-KLS-24CE97',
    'Kelas Ustdz. Laila Luthfiana, AH.',
    'Ustdz. Laila Luthfiana, AH.',
    1,
    1,
    11,
    '2026-10-09T22:37:04.784Z'
FROM public.students s
WHERE s.student_id = 'STD_039' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_040',
    s.name,
    1,
    1,
    'LANJUT',
    'TPQ-KLS-24CE97',
    'Kelas Ustdz. Laila Luthfiana, AH.',
    'Ustdz. Laila Luthfiana, AH.',
    1,
    1,
    11,
    '2026-10-10T06:24:03.087Z'
FROM public.students s
WHERE s.student_id = 'STD_040' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_041',
    s.name,
    1,
    1,
    'LANJUT',
    NULL,
    'Belum Ditentukan',
    '-',
    1,
    1,
    11,
    '2026-10-31T04:06:19.668Z'
FROM public.students s
WHERE s.student_id = 'STD_041' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_042',
    s.name,
    1,
    1,
    'LANJUT',
    'TPQ-KLS-4D4C93',
    'Kelas Ust.Nazirul Muhammad, AH.',
    'Ust.Nazirul Muhammad, AH.',
    2,
    1,
    11,
    '2026-10-31T04:06:19.668Z'
FROM public.students s
WHERE s.student_id = 'STD_042' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_043',
    s.name,
    6,
    15,
    'LANJUT',
    'TPQ-KLS-4D4C93',
    'Kelas Ust.Nazirul Muhammad, AH.',
    'Ust.Nazirul Muhammad, AH.',
    1,
    2,
    22,
    '2026-09-24T10:07:36.256Z'
FROM public.students s
WHERE s.student_id = 'STD_043' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_044',
    s.name,
    6,
    29,
    'LANJUT',
    'TPQ-KLS-4D4C93',
    'Kelas Ust.Nazirul Muhammad, AH.',
    'Ust.Nazirul Muhammad, AH.',
    1,
    2,
    22,
    '2026-09-27T09:47:45.639Z'
FROM public.students s
WHERE s.student_id = 'STD_044' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_045',
    s.name,
    5,
    41,
    'LANJUT',
    'TPQ-KLS-24CE97',
    'Kelas Ustdz. Laila Luthfiana, AH.',
    'Ustdz. Laila Luthfiana, AH.',
    1,
    1,
    11,
    '2026-10-09T22:36:31.517Z'
FROM public.students s
WHERE s.student_id = 'STD_045' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_046',
    s.name,
    4,
    40,
    'LANJUT',
    'TPQ-KLS-24CE97',
    'Kelas Ustdz. Laila Luthfiana, AH.',
    'Ustdz. Laila Luthfiana, AH.',
    1,
    1,
    11,
    '2026-10-09T22:37:52.529Z'
FROM public.students s
WHERE s.student_id = 'STD_046' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_047',
    s.name,
    4,
    19,
    'LANJUT',
    'TPQ-KLS-24CE97',
    'Kelas Ustdz. Laila Luthfiana, AH.',
    'Ustdz. Laila Luthfiana, AH.',
    1,
    1,
    11,
    '2026-10-09T22:38:22.285Z'
FROM public.students s
WHERE s.student_id = 'STD_047' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_048',
    s.name,
    4,
    17,
    'LANJUT',
    'TPQ-KLS-24CE97',
    'Kelas Ustdz. Laila Luthfiana, AH.',
    'Ustdz. Laila Luthfiana, AH.',
    1,
    1,
    11,
    '2026-10-09T22:38:49.083Z'
FROM public.students s
WHERE s.student_id = 'STD_048' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_049',
    s.name,
    1,
    1,
    'LANJUT',
    'TPQ-KLS-24CE97',
    'Kelas Ustdz. Laila Luthfiana, AH.',
    'Ustdz. Laila Luthfiana, AH.',
    1,
    1,
    11,
    '2026-10-10T06:24:03.087Z'
FROM public.students s
WHERE s.student_id = 'STD_049' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_050',
    s.name,
    7,
    22,
    'LANJUT',
    'TPQ-KLS-4D4C93',
    'Kelas Ust.Nazirul Muhammad, AH.',
    'Ust.Nazirul Muhammad, AH.',
    1,
    2,
    22,
    '2026-09-24T10:02:51.419Z'
FROM public.students s
WHERE s.student_id = 'STD_050' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    s.id,
    'STD_051',
    s.name,
    7,
    24,
    'LANJUT',
    'TPQ-KLS-4D4C93',
    'Kelas Ust.Nazirul Muhammad, AH.',
    'Ust.Nazirul Muhammad, AH.',
    1,
    2,
    22,
    '2026-09-27T09:53:35.960Z'
FROM public.students s
WHERE s.student_id = 'STD_051' AND s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    student_name = EXCLUDED.student_name,
    active_jilid = EXCLUDED.active_jilid,
    active_page = EXCLUDED.active_page,
    last_status = EXCLUDED.last_status,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    teacher_name = EXCLUDED.teacher_name,
    target_jilid = EXCLUDED.target_jilid,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = EXCLUDED.updated_at;

