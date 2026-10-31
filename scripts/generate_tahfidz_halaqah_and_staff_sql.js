const fs = require('fs');
const path = require('path');

const TENANT_ID = 'baa9eb9b-2d87-4648-a674-059bb289cb63';

// 1. Baca data Tahfidz Halaqah & Sesi
const tfData = JSON.parse(fs.readFileSync(path.join(__dirname, '../migration_data/tahfidz_halaqah_sesi.json'), 'utf8'));
const halaqahs = tfData.halaqahs || [];
const sessions = tfData.sesiList || [];
const muhafizList = tfData.muhafizList || [];

// 2. Data Pengajar & Asatidz resmi dari user_identities & muhafizList
const teachers = [
  { code: 'EMP-001', name: 'Nyai Hj. Nashichatul Fuadah, AH.', position: 'Pengasuh / Dewan Masyayikh', gender: 'P', spec: 'Tahfidzul Qur\'an 30 Juz' },
  { code: 'EMP-002', name: 'Ustadz Nazirul Muhammad, AH.', position: 'Dewan Asatidz', gender: 'L', spec: 'Tahfidz & Yanbu\'a Jilid 6-7' },
  { code: 'EMP-003', name: 'Ustadzah Robiatul Awaliyah, AH.', position: 'Dewan Asatidz', gender: 'P', spec: 'Tahfidzul Qur\'an' },
  { code: 'EMP-004', name: 'Ustadzah Izza Nazila, AH.', position: 'Dewan Asatidz', gender: 'P', spec: 'Tahfidzul Qur\'an' },
  { code: 'EMP-005', name: 'Ustdz. Laila Luthfiana, AH.', position: 'Dewan Asatidz', gender: 'P', spec: 'Yanbu\'a Jilid 1-5' },
  { code: 'EMP-006', name: 'Ust. Hidayatullah Zaen', position: 'Dewan Asatidz', gender: 'L', spec: 'Wali Kelas 1 Awaliyah / Fiqih' },
  { code: 'EMP-007', name: 'Ust. Mukhlasin', position: 'Dewan Asatidz', gender: 'L', spec: 'Wali Kelas 3 Wustho / Nahwu Jurumiyah' },
  { code: 'EMP-008', name: 'Ust. Ulil Abshor', position: 'Dewan Asatidz', gender: 'L', spec: 'Wali Kelas 2 Wustho / Safinatun Najah' },
  { code: 'EMP-009', name: 'Tutik Egiq Lestari', position: 'Bendahara Pesantren', gender: 'P', spec: 'Administrasi Keuangan & Billing' },
  { code: 'EMP-010', name: 'Ketua Pondok', position: 'Pengurus Pesantren', gender: 'L', spec: 'Ketertiban & Kedisiplinan Asrama' }
];

function escapeSql(str) {
  if (str === null || str === undefined || str === '') return 'NULL';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

function cleanTime(str, fallback) {
  if (!str) return escapeSql(fallback);
  const match = String(str).match(/(\d{2}:\d{2})/);
  return escapeSql(match ? match[1] : fallback);
}

let sql = `-- ====================================================================
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
`;

halaqahs.forEach(h => {
  sql += `INSERT INTO public.tahfidz_halaqah (tenant_id, halaqah_code, name, muhafiz_name, curriculum_target, student_ids, student_count, created_at)
VALUES (
    '${TENANT_ID}',
    ${escapeSql(h.halaqahId)},
    ${escapeSql(h.namaHalaqah)},
    ${escapeSql(h.muhafiz)},
    ${escapeSql(h.targetKurikulum || 'Tahfidz 30 Juz')},
    ${escapeSql(JSON.stringify(h.studentIds || []))}::jsonb,
    ${Number(h.studentCount) || (h.studentIds ? h.studentIds.length : 0)},
    NOW()
)
ON CONFLICT (tenant_id, halaqah_code) DO UPDATE SET
    name = EXCLUDED.name,
    muhafiz_name = EXCLUDED.muhafiz_name,
    curriculum_target = EXCLUDED.curriculum_target,
    student_ids = EXCLUDED.student_ids,
    student_count = EXCLUDED.student_count;

`;
});

sql += `
-- ====================================================================
-- SEED DATA 2: TAHFIDZ SESSIONS (3 Sesi Ziyadah & Muroja'ah)
-- ====================================================================
`;

sessions.forEach(s => {
  sql += `INSERT INTO public.tahfidz_sessions (tenant_id, session_code, name, session_type, status, start_time, end_time, days, created_at)
VALUES (
    '${TENANT_ID}',
    ${escapeSql(s.sesiId)},
    ${escapeSql(s.namaSesi)},
    ${escapeSql(s.jenisSesi)},
    ${escapeSql(s.status)},
    ${cleanTime(s.jamMulai, '05:00')},
    ${cleanTime(s.jamSelesai, '06:00')},
    ${escapeSql(JSON.stringify(s.hariList || []))}::jsonb,
    NOW()
)
ON CONFLICT (tenant_id, session_code) DO UPDATE SET
    name = EXCLUDED.name,
    session_type = EXCLUDED.session_type,
    status = EXCLUDED.status,
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    days = EXCLUDED.days;

`;
});

sql += `
-- ====================================================================
-- SEED DATA 3: EMPLOYEES (10 Asatidz & Pegawai Resmi)
-- ====================================================================
`;

teachers.forEach(t => {
  sql += `INSERT INTO public.employees (tenant_id, employee_code, name, gender, position, specialization, status, created_at)
VALUES (
    '${TENANT_ID}',
    ${escapeSql(t.code)},
    ${escapeSql(t.name)},
    ${escapeSql(t.gender)},
    ${escapeSql(t.position)},
    ${escapeSql(t.spec)},
    'Aktif',
    NOW()
)
ON CONFLICT (tenant_id, employee_code) DO UPDATE SET
    name = EXCLUDED.name,
    gender = EXCLUDED.gender,
    position = EXCLUDED.position,
    specialization = EXCLUDED.specialization,
    status = EXCLUDED.status;

`;
});

const outputPath = path.join(__dirname, '../database/migrations/12_create_and_sync_tahfidz_halaqah_and_staff.sql');
fs.writeFileSync(outputPath, sql, 'utf8');
console.log('Successfully generated SQL migration 12 to: ' + outputPath);
console.log('Total Halaqahs:', halaqahs.length);
console.log('Total Sessions:', sessions.length);
console.log('Total Employees:', teachers.length);

