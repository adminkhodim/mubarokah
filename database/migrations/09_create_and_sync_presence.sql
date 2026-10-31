-- ====================================================================
-- MIGRATION 09: DDL & SINKRONISASI DOMAIN PRESENSI SANTRI
-- Target Tenant : PPTQ Roudlotul Mubarokah (baa9eb9b-2d87-4648-a674-059bb289cb63)
-- Sumber Data   : Google Spreadsheet [OFFICIAL] (Presensi_Kegiatan, Presensi_Sesi, Presensi_Logs)
-- ====================================================================

-- 1. TABEL PRESENCE_ACTIVITIES (Master Kegiatan / Agenda Rutin Presensi Santri)
CREATE TABLE IF NOT EXISTS public.presence_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    activity_code VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'Ibadah',
    routine_schedule VARCHAR(255),
    target_audience VARCHAR(255) DEFAULT 'Semua Santri',
    person_in_charge VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Aktif',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, activity_code)
);

-- Migrasi tipe kolom jika tabel sudah terlanjur dibuat dengan varchar(50)
ALTER TABLE public.presence_activities 
    ALTER COLUMN activity_code TYPE VARCHAR(100),
    ALTER COLUMN name TYPE VARCHAR(255),
    ALTER COLUMN category TYPE VARCHAR(100),
    ALTER COLUMN routine_schedule TYPE VARCHAR(255),
    ALTER COLUMN target_audience TYPE VARCHAR(255),
    ALTER COLUMN person_in_charge TYPE VARCHAR(255),
    ALTER COLUMN status TYPE VARCHAR(50);

ALTER TABLE public.presence_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Presence Activities" ON public.presence_activities;
CREATE POLICY "Public Read Presence Activities" ON public.presence_activities FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin All Presence Activities" ON public.presence_activities;
CREATE POLICY "Admin All Presence Activities" ON public.presence_activities FOR ALL USING (true);

-- 2. TABEL PRESENCE_SESSIONS (Sesi Presensi Kegiatan Harian / Mingguan)
CREATE TABLE IF NOT EXISTS public.presence_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    session_code VARCHAR(100) NOT NULL,
    activity_id UUID REFERENCES public.presence_activities(id) ON DELETE SET NULL,
    activity_code VARCHAR(100),
    activity_name VARCHAR(255),
    date DATE NOT NULL,
    open_time VARCHAR(100),
    officer_name VARCHAR(150),
    total_students INT DEFAULT 0,
    total_present INT DEFAULT 0,
    total_permit INT DEFAULT 0,
    total_sick INT DEFAULT 0,
    total_absent INT DEFAULT 0,
    session_status VARCHAR(50) DEFAULT 'Tutup',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, session_code)
);

-- Migrasi tipe kolom jika tabel sudah terlanjur dibuat dengan varchar(50)
ALTER TABLE public.presence_sessions 
    ALTER COLUMN session_code TYPE VARCHAR(100),
    ALTER COLUMN activity_code TYPE VARCHAR(100),
    ALTER COLUMN activity_name TYPE VARCHAR(255),
    ALTER COLUMN open_time TYPE VARCHAR(100),
    ALTER COLUMN officer_name TYPE VARCHAR(150),
    ALTER COLUMN session_status TYPE VARCHAR(50);

ALTER TABLE public.presence_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Presence Sessions" ON public.presence_sessions;
CREATE POLICY "Public Read Presence Sessions" ON public.presence_sessions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin All Presence Sessions" ON public.presence_sessions;
CREATE POLICY "Admin All Presence Sessions" ON public.presence_sessions FOR ALL USING (true);

-- 3. TABEL PRESENCE_LOGS (Pencatatan Presensi & Log Pengecualian Santri)
CREATE TABLE IF NOT EXISTS public.presence_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    log_code VARCHAR(100) NOT NULL,
    session_id UUID REFERENCES public.presence_sessions(id) ON DELETE CASCADE,
    session_code VARCHAR(100),
    activity_code VARCHAR(100),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    student_code VARCHAR(50),
    nis VARCHAR(50),
    student_name VARCHAR(255),
    gender VARCHAR(10),
    date DATE NOT NULL,
    attendance_status VARCHAR(50) NOT NULL DEFAULT 'Hadir',
    checkin_method VARCHAR(50) DEFAULT 'MANUAL',
    checkin_time TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, session_code, student_id)
);

ALTER TABLE public.presence_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Presence Logs" ON public.presence_logs;
CREATE POLICY "Public Read Presence Logs" ON public.presence_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin All Presence Logs" ON public.presence_logs;
CREATE POLICY "Admin All Presence Logs" ON public.presence_logs FOR ALL USING (true);

-- ====================================================================
-- SEED DATA 1: PRESENCE ACTIVITIES (8 Master Kegiatan Presensi Resmi)
-- ====================================================================
INSERT INTO public.presence_activities (tenant_id, activity_code, name, category, routine_schedule, target_audience, person_in_charge, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'ACT-01',
    'Shalat Subuh Berjamaah',
    'Ibadah',
    'Setiap Hari (04:30 - 05:00 WIB)',
    'Semua Santri',
    'Ustadz Pembina Asrama',
    'Aktif',
    '2026-09-24T17:03:02.259Z'
)
ON CONFLICT (tenant_id, activity_code) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    routine_schedule = EXCLUDED.routine_schedule,
    target_audience = EXCLUDED.target_audience,
    person_in_charge = EXCLUDED.person_in_charge,
    status = EXCLUDED.status;

INSERT INTO public.presence_activities (tenant_id, activity_code, name, category, routine_schedule, target_audience, person_in_charge, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'ACT-04',
    'Shalat Dhuhur Berjamaah',
    'Ibadah',
    'Setiap Hari (12:30 - 13:00 WIB)',
    'Semua Santri',
    'Ustadz Pembina Asrama',
    'Aktif',
    '2026-09-24T17:03:02.259Z'
)
ON CONFLICT (tenant_id, activity_code) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    routine_schedule = EXCLUDED.routine_schedule,
    target_audience = EXCLUDED.target_audience,
    person_in_charge = EXCLUDED.person_in_charge,
    status = EXCLUDED.status;

INSERT INTO public.presence_activities (tenant_id, activity_code, name, category, routine_schedule, target_audience, person_in_charge, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'ACT-05',
    'Shalat Asar Berjamaah',
    'Ibadah',
    'Setiap Hari (15:30 - 16:00 WIB)',
    'Semua Santri',
    'Ustadz Pembina Asrama',
    'Aktif',
    '2026-09-24T17:03:02.259Z'
)
ON CONFLICT (tenant_id, activity_code) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    routine_schedule = EXCLUDED.routine_schedule,
    target_audience = EXCLUDED.target_audience,
    person_in_charge = EXCLUDED.person_in_charge,
    status = EXCLUDED.status;

INSERT INTO public.presence_activities (tenant_id, activity_code, name, category, routine_schedule, target_audience, person_in_charge, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'ACT-07',
    'Shalat Maghrib & Wirid Berjamaah',
    'Ibadah',
    'Setiap Hari (17:45 - 18:30 WIB)',
    'Semua Santri',
    'Ustadz Pembina Asrama',
    'Aktif',
    '2026-09-24T17:03:02.259Z'
)
ON CONFLICT (tenant_id, activity_code) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    routine_schedule = EXCLUDED.routine_schedule,
    target_audience = EXCLUDED.target_audience,
    person_in_charge = EXCLUDED.person_in_charge,
    status = EXCLUDED.status;

INSERT INTO public.presence_activities (tenant_id, activity_code, name, category, routine_schedule, target_audience, person_in_charge, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'ACT-08',
    'Shalat Isya Berjamaah',
    'Ibadah',
    'Setiap Hari (19:30 - 20:00 WIB)',
    'Semua Santri',
    'Ustadz Pembina Asrama',
    'Aktif',
    '2026-09-24T17:03:02.259Z'
)
ON CONFLICT (tenant_id, activity_code) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    routine_schedule = EXCLUDED.routine_schedule,
    target_audience = EXCLUDED.target_audience,
    person_in_charge = EXCLUDED.person_in_charge,
    status = EXCLUDED.status;

INSERT INTO public.presence_activities (tenant_id, activity_code, name, category, routine_schedule, target_audience, person_in_charge, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'ACT-09',
    'Bandongan',
    'Ta''lim',
    'Jumat malam (20.00 WIB)',
    'Semua',
    'Ustadz Pembina Asrama',
    'Aktif',
    '2026-09-25T13:34:54.986Z'
)
ON CONFLICT (tenant_id, activity_code) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    routine_schedule = EXCLUDED.routine_schedule,
    target_audience = EXCLUDED.target_audience,
    person_in_charge = EXCLUDED.person_in_charge,
    status = EXCLUDED.status;

INSERT INTO public.presence_activities (tenant_id, activity_code, name, category, routine_schedule, target_audience, person_in_charge, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'ACT-260928-062921',
    'Seni Tilawah',
    'Ibadah',
    'Sabtu (20.00-21.00 WIB)',
    'Semua',
    NULL,
    'Aktif',
    '2026-09-27T23:29:21.507Z'
)
ON CONFLICT (tenant_id, activity_code) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    routine_schedule = EXCLUDED.routine_schedule,
    target_audience = EXCLUDED.target_audience,
    person_in_charge = EXCLUDED.person_in_charge,
    status = EXCLUDED.status;

INSERT INTO public.presence_activities (tenant_id, activity_code, name, category, routine_schedule, target_audience, person_in_charge, status, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'ACT-261008-192341',
    'Maulid',
    'Ibadah',
    'Setiap Kamis malam Jum''at (20.00 WIB)',
    'Semua Santri',
    NULL,
    'Aktif',
    '2026-10-08T12:23:41.797Z'
)
ON CONFLICT (tenant_id, activity_code) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    routine_schedule = EXCLUDED.routine_schedule,
    target_audience = EXCLUDED.target_audience,
    person_in_charge = EXCLUDED.person_in_charge,
    status = EXCLUDED.status;


-- ====================================================================
-- SEED DATA 2: PRESENCE SESSIONS (4 Sesi Presensi Historis)
-- ====================================================================
INSERT INTO public.presence_sessions (tenant_id, session_code, activity_id, activity_code, activity_name, date, open_time, officer_name, total_students, total_present, total_permit, total_sick, total_absent, session_status, notes, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'SESI-20261009-2037-79',
    (SELECT id FROM public.presence_activities WHERE activity_code = 'ACT-09' AND tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63' LIMIT 1),
    'ACT-09',
    'Bandongan',
    '2026-10-09',
    '20:37 WIB',
    'Admin',
    51,
    46,
    2,
    0,
    3,
    'Tutup',
    NULL,
    '2026-10-09T13:43:39.480Z'
)
ON CONFLICT (tenant_id, session_code) DO UPDATE SET
    activity_name = EXCLUDED.activity_name,
    date = EXCLUDED.date,
    open_time = EXCLUDED.open_time,
    total_students = EXCLUDED.total_students,
    total_present = EXCLUDED.total_present,
    total_permit = EXCLUDED.total_permit,
    total_sick = EXCLUDED.total_sick,
    total_absent = EXCLUDED.total_absent,
    session_status = EXCLUDED.session_status,
    notes = EXCLUDED.notes;

INSERT INTO public.presence_sessions (tenant_id, session_code, activity_id, activity_code, activity_name, date, open_time, officer_name, total_students, total_present, total_permit, total_sick, total_absent, session_status, notes, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'SESI-20261008-2016-27',
    (SELECT id FROM public.presence_activities WHERE activity_code = 'ACT-261008-192341' AND tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63' LIMIT 1),
    'ACT-261008-192341',
    'Maulid',
    '2026-10-08',
    '20:16 WIB',
    'Admin',
    51,
    42,
    2,
    0,
    7,
    'Tutup',
    NULL,
    '2026-10-08T13:29:08.072Z'
)
ON CONFLICT (tenant_id, session_code) DO UPDATE SET
    activity_name = EXCLUDED.activity_name,
    date = EXCLUDED.date,
    open_time = EXCLUDED.open_time,
    total_students = EXCLUDED.total_students,
    total_present = EXCLUDED.total_present,
    total_permit = EXCLUDED.total_permit,
    total_sick = EXCLUDED.total_sick,
    total_absent = EXCLUDED.total_absent,
    session_status = EXCLUDED.session_status,
    notes = EXCLUDED.notes;

INSERT INTO public.presence_sessions (tenant_id, session_code, activity_id, activity_code, activity_name, date, open_time, officer_name, total_students, total_present, total_permit, total_sick, total_absent, session_status, notes, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'SESI-20260925-2036-67',
    (SELECT id FROM public.presence_activities WHERE activity_code = 'ACT-260925-203454' AND tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63' LIMIT 1),
    'ACT-260925-203454',
    'Bandongan',
    '2026-09-25',
    '20:36 WIB',
    'Admin',
    52,
    41,
    4,
    0,
    7,
    'Tutup',
    NULL,
    '2026-10-08T12:25:22.160Z'
)
ON CONFLICT (tenant_id, session_code) DO UPDATE SET
    activity_name = EXCLUDED.activity_name,
    date = EXCLUDED.date,
    open_time = EXCLUDED.open_time,
    total_students = EXCLUDED.total_students,
    total_present = EXCLUDED.total_present,
    total_permit = EXCLUDED.total_permit,
    total_sick = EXCLUDED.total_sick,
    total_absent = EXCLUDED.total_absent,
    session_status = EXCLUDED.session_status,
    notes = EXCLUDED.notes;

INSERT INTO public.presence_sessions (tenant_id, session_code, activity_id, activity_code, activity_name, date, open_time, officer_name, total_students, total_present, total_permit, total_sick, total_absent, session_status, notes, created_at)
VALUES (
    'baa9eb9b-2d87-4648-a674-059bb289cb63',
    'SESI-20260924-1930-24',
    (SELECT id FROM public.presence_activities WHERE activity_code = 'ACT-08' AND tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63' LIMIT 1),
    'ACT-08',
    'Shalat Isya Berjamaah',
    '2026-09-24',
    '19:30 WIB',
    'Pengurus',
    52,
    51,
    0,
    1,
    0,
    'Tutup',
    NULL,
    '2026-09-24T17:19:54.387Z'
)
ON CONFLICT (tenant_id, session_code) DO UPDATE SET
    activity_name = EXCLUDED.activity_name,
    date = EXCLUDED.date,
    open_time = EXCLUDED.open_time,
    total_students = EXCLUDED.total_students,
    total_present = EXCLUDED.total_present,
    total_permit = EXCLUDED.total_permit,
    total_sick = EXCLUDED.total_sick,
    total_absent = EXCLUDED.total_absent,
    session_status = EXCLUDED.session_status,
    notes = EXCLUDED.notes;

