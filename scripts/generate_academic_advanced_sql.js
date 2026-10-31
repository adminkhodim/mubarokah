const fs = require('fs');
const path = require('path');

const TENANT_ID = 'baa9eb9b-2d87-4648-a674-059bb289cb63';

// Baca data Akademik Lanjutan
const advData = JSON.parse(fs.readFileSync(path.join(__dirname, '../migration_data/akademik_lanjutan_data.json'), 'utf8'));
const classMembers = advData.madin.classMembers || {};
const sessions = advData.madin.sessions || [];
const soroganTargets = advData.sorogan.targets || {};

function escapeSql(str) {
  if (str === null || str === undefined || str === '') return 'NULL';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

let sql = `-- ====================================================================
-- MIGRATION 11: DDL & SINKRONISASI DOMAIN AKADEMIK LANJUTAN (MADIN & SOROGAN)
-- Target Tenant : PPTQ Roudlotul Mubarokah (baa9eb9b-2d87-4648-a674-059bb289cb63)
-- Sumber Data   : Google Spreadsheet [OFFICIAL] (Madin_Anggota, Madin_Jurnal, Madin_Presensi, Madin_Nilai, Sorogan_Target, Sorogan_Logs)
-- ====================================================================

-- 1. TABEL MADIN_CLASS_MEMBERS (Penetapan Rombel / Anggota Kelas Madin)
CREATE TABLE IF NOT EXISTS public.madin_class_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    class_id VARCHAR(50) NOT NULL,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    student_code VARCHAR(50),
    nis VARCHAR(50),
    student_name VARCHAR(255),
    gender VARCHAR(10),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, class_id, student_id)
);

ALTER TABLE public.madin_class_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Madin Class Members" ON public.madin_class_members;
CREATE POLICY "Public Read Madin Class Members" ON public.madin_class_members FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin All Madin Class Members" ON public.madin_class_members;
CREATE POLICY "Admin All Madin Class Members" ON public.madin_class_members FOR ALL USING (true);

-- 2. TABEL MADIN_JOURNALS (Buku Jurnal KBM Harian Asatidz Madin)
CREATE TABLE IF NOT EXISTS public.madin_journals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    session_code VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    class_id VARCHAR(50) NOT NULL,
    class_name VARCHAR(150),
    subject_id VARCHAR(50),
    subject_name VARCHAR(150),
    teacher_name VARCHAR(150),
    topic_material VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, session_code)
);

ALTER TABLE public.madin_journals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Madin Journals" ON public.madin_journals;
CREATE POLICY "Public Read Madin Journals" ON public.madin_journals FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin All Madin Journals" ON public.madin_journals;
CREATE POLICY "Admin All Madin Journals" ON public.madin_journals FOR ALL USING (true);

-- 3. TABEL MADIN_ATTENDANCE (Presensi Kehadiran KBM Madin)
CREATE TABLE IF NOT EXISTS public.madin_attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    attendance_code VARCHAR(100) NOT NULL,
    session_code VARCHAR(100),
    date DATE NOT NULL,
    class_id VARCHAR(50),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    student_code VARCHAR(50),
    status VARCHAR(50) DEFAULT 'Hadir',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, session_code, student_id)
);

ALTER TABLE public.madin_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Madin Attendance" ON public.madin_attendance;
CREATE POLICY "Public Read Madin Attendance" ON public.madin_attendance FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin All Madin Attendance" ON public.madin_attendance;
CREATE POLICY "Admin All Madin Attendance" ON public.madin_attendance FOR ALL USING (true);

-- 4. TABEL MADIN_GRADES (Buku Nilai & Imtihan Santri Madin)
CREATE TABLE IF NOT EXISTS public.madin_grades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    grade_code VARCHAR(100) NOT NULL,
    semester VARCHAR(50) NOT NULL,
    class_id VARCHAR(50) NOT NULL,
    subject_id VARCHAR(50) NOT NULL,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    student_code VARCHAR(50),
    nis VARCHAR(50),
    student_name VARCHAR(255),
    daily_score NUMERIC(5,2),
    oral_score NUMERIC(5,2),
    written_score NUMERIC(5,2),
    final_score NUMERIC(5,2),
    predicate VARCHAR(10),
    notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, semester, class_id, subject_id, student_id)
);

ALTER TABLE public.madin_grades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Madin Grades" ON public.madin_grades;
CREATE POLICY "Public Read Madin Grades" ON public.madin_grades FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin All Madin Grades" ON public.madin_grades;
CREATE POLICY "Admin All Madin Grades" ON public.madin_grades FOR ALL USING (true);

-- 5. TABEL SOROGAN_TARGETS (Target Pencapaian Sorogan Per Santri)
CREATE TABLE IF NOT EXISTS public.sorogan_targets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    student_code VARCHAR(50),
    target_juz INT DEFAULT 30,
    target_page_per_session INT DEFAULT 2,
    target_page_per_week INT DEFAULT 22,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, student_id)
);

ALTER TABLE public.sorogan_targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Sorogan Targets" ON public.sorogan_targets;
CREATE POLICY "Public Read Sorogan Targets" ON public.sorogan_targets FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin All Sorogan Targets" ON public.sorogan_targets;
CREATE POLICY "Admin All Sorogan Targets" ON public.sorogan_targets FOR ALL USING (true);

-- 6. TABEL SOROGAN_LOGS (Riwayat Setoran Sorogan Kitab & Al-Qur'an)
CREATE TABLE IF NOT EXISTS public.sorogan_logs (
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
    juz INT NOT NULL,
    page_list VARCHAR(100),
    total_pages INT DEFAULT 1,
    status VARCHAR(50) DEFAULT 'LANJUT',
    grade VARCHAR(10),
    muallim VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, log_code)
);

ALTER TABLE public.sorogan_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Sorogan Logs" ON public.sorogan_logs;
CREATE POLICY "Public Read Sorogan Logs" ON public.sorogan_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin All Sorogan Logs" ON public.sorogan_logs;
CREATE POLICY "Admin All Sorogan Logs" ON public.sorogan_logs FOR ALL USING (true);

-- ====================================================================
-- SEED DATA 1: MADIN CLASS MEMBERS (11 Santri Terplot)
-- ====================================================================
`;

let memberCount = 0;
for (const [classId, mList] of Object.entries(classMembers)) {
  mList.forEach(m => {
    memberCount++;
    sql += `INSERT INTO public.madin_class_members (tenant_id, class_id, student_id, student_code, nis, student_name, gender, assigned_at)
SELECT
    '${TENANT_ID}',
    ${escapeSql(classId)},
    s.id,
    ${escapeSql(m.studentId)},
    ${escapeSql(m.nis)},
    s.name,
    ${escapeSql(m.gender || 'P')},
    NOW()
FROM public.students s
WHERE s.student_id = ${escapeSql(m.studentId)} AND s.tenant_id = '${TENANT_ID}'
ON CONFLICT (tenant_id, class_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    nis = EXCLUDED.nis,
    student_name = EXCLUDED.student_name,
    gender = EXCLUDED.gender;

`;
  });
}

sql += `
-- ====================================================================
-- SEED DATA 2: MADIN JOURNALS (1 Jurnal Sesi KBM)
-- ====================================================================
`;

sessions.forEach(sess => {
  // Format tanggal: 'Wed Sep 30 2026 ...' -> '2026-09-30'
  const tStr = sess.timestamp ? sess.timestamp.substring(0, 10) : '2026-09-30';
  sql += `INSERT INTO public.madin_journals (tenant_id, session_code, date, class_id, class_name, subject_id, subject_name, teacher_name, topic_material, notes, created_at)
VALUES (
    '${TENANT_ID}',
    ${escapeSql(sess.sessionId)},
    ${escapeSql(tStr)},
    ${escapeSql(sess.classId)},
    ${escapeSql(sess.namaKelas)},
    ${escapeSql(sess.subjectId)},
    ${escapeSql(sess.namaKitab)},
    ${escapeSql(sess.asatidz)},
    ${escapeSql(sess.materiBab)},
    ${escapeSql(sess.catatan || '')},
    ${escapeSql(sess.timestamp || new Date().toISOString())}
)
ON CONFLICT (tenant_id, session_code) DO UPDATE SET
    date = EXCLUDED.date,
    class_name = EXCLUDED.class_name,
    subject_name = EXCLUDED.subject_name,
    teacher_name = EXCLUDED.teacher_name,
    topic_material = EXCLUDED.topic_material,
    notes = EXCLUDED.notes;

`;
});

sql += `
-- ====================================================================
-- SEED DATA 3: SOROGAN TARGETS (13 Target Santri)
-- ====================================================================
`;

let targetCount = 0;
for (const [studentId, tg] of Object.entries(soroganTargets)) {
  targetCount++;
  sql += `INSERT INTO public.sorogan_targets (tenant_id, student_id, student_code, target_juz, target_page_per_session, target_page_per_week, updated_at)
SELECT
    '${TENANT_ID}',
    s.id,
    ${escapeSql(studentId)},
    ${Number(tg.targetJuz) || 30},
    ${Number(tg.targetHalamanSesi) || 2},
    ${Number(tg.targetHalamanPekan) || 22},
    NOW()
FROM public.students s
WHERE s.student_id = ${escapeSql(studentId)} AND s.tenant_id = '${TENANT_ID}'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    target_juz = EXCLUDED.target_juz,
    target_page_per_session = EXCLUDED.target_page_per_session,
    target_page_per_week = EXCLUDED.target_page_per_week,
    updated_at = NOW();

`;
}

const outputPath = path.join(__dirname, '../database/migrations/11_create_and_sync_academic_advanced.sql');
fs.writeFileSync(outputPath, sql, 'utf8');
console.log('Successfully generated SQL migration 11 to: ' + outputPath);
console.log('Total Class Members:', memberCount);
console.log('Total Journals:', sessions.length);
console.log('Total Sorogan Targets:', targetCount);

