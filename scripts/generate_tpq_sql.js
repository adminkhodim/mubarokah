const fs = require('fs');
const path = require('path');

const TENANT_ID = 'baa9eb9b-2d87-4648-a674-059bb289cb63';

// Baca data TPQ
const tpqData = JSON.parse(fs.readFileSync(path.join(__dirname, '../migration_data/tpq_data.json'), 'utf8'));
const classes = tpqData.kelasList || [];
const sessions = tpqData.sesiList || [];
const students = tpqData.students || [];
const targets = tpqData.targets || {};

function escapeSql(str) {
  if (str === null || str === undefined || str === '') return 'NULL';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

let sql = `-- ====================================================================
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
`;

classes.forEach(c => {
  sql += `INSERT INTO public.tpq_classes (tenant_id, class_code, name, teacher_name, description, student_ids, created_at)
VALUES (
    '${TENANT_ID}',
    ${escapeSql(c.kelasId)},
    ${escapeSql(c.namaKelas)},
    ${escapeSql(c.ustadzPengampu)},
    ${escapeSql(c.deskripsi)},
    ${escapeSql(JSON.stringify(c.studentIds || []))}::jsonb,
    NOW()
)
ON CONFLICT (tenant_id, class_code) DO UPDATE SET
    name = EXCLUDED.name,
    teacher_name = EXCLUDED.teacher_name,
    description = EXCLUDED.description,
    student_ids = EXCLUDED.student_ids;

`;
});

sql += `
-- ====================================================================
-- SEED DATA 2: TPQ SESSIONS (Master Sesi Belajar)
-- ====================================================================
`;

sessions.forEach(s => {
  sql += `INSERT INTO public.tpq_sessions (tenant_id, session_code, name, session_type, status, start_time, end_time, days, created_at)
VALUES (
    '${TENANT_ID}',
    ${escapeSql(s.sesiId)},
    ${escapeSql(s.namaSesi)},
    ${escapeSql(s.jenisSesi)},
    ${escapeSql(s.status)},
    ${escapeSql(s.jamMulai)},
    ${escapeSql(s.jamSelesai)},
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
-- SEED DATA 3: TPQ CAPAIAN & TARGET (51 Santri Aktif Yanbu'a)
-- ====================================================================
`;

students.forEach(st => {
  const tg = targets[st.studentId] || (st.target || {});
  const tJilid = tg.targetJilid || 1;
  const tHalamanSesi = tg.targetHalamanSesi || 1;
  const tHalamanPekan = tg.targetHalamanPekan || 11;

  sql += `INSERT INTO public.tpq_capaian (tenant_id, student_id, student_code, student_name, active_jilid, active_page, last_status, class_code, class_name, teacher_name, target_jilid, target_page_per_session, target_page_per_week, updated_at)
SELECT
    '${TENANT_ID}',
    s.id,
    ${escapeSql(st.studentId)},
    s.name,
    ${Number(st.jilidAktif) || 1},
    ${Number(st.halamanAktif) || 1},
    ${escapeSql(st.statusTerakhir || 'LANJUT')},
    ${escapeSql(st.kelasId || '')},
    ${escapeSql(st.namaKelas || 'Belum Ditentukan')},
    ${escapeSql(st.ustadzPengampu || '-')},
    ${tJilid},
    ${tHalamanSesi},
    ${tHalamanPekan},
    ${escapeSql(st.updatedAt || new Date().toISOString())}
FROM public.students s
WHERE s.student_id = ${escapeSql(st.studentId)} AND s.tenant_id = '${TENANT_ID}'
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

`;
});

const outputPath = path.join(__dirname, '../database/migrations/10_create_and_sync_academic_tpq.sql');
fs.writeFileSync(outputPath, sql, 'utf8');
console.log('Successfully generated SQL migration 10 to: ' + outputPath);
console.log('Total Classes:', classes.length);
console.log('Total Sessions:', sessions.length);
console.log('Total Student Capaian:', students.length);

