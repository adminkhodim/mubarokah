const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../migration_data/academic_data.json'), 'utf8'));

function escapeSql(str) {
  if (str === null || str === undefined || str === '') return 'NULL';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

let sql = `-- ====================================================================
-- MIGRATION 07: DDL & SINKRONISASI DOMAIN AKADEMIK (MADIN & SOROGAN)
-- Target Tenant : PPTQ Roudlotul Mubarokah (baa9eb9b-2d87-4648-a674-059bb289cb63)
-- Sumber Data   : Google Spreadsheet [OFFICIAL] (Madin_* & Sorogan_*)
-- ====================================================================

-- 1. TABEL MADIN_CLASSES (Master Kelas Madrasah Diniyah)
CREATE TABLE IF NOT EXISTS public.madin_classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    class_id VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    level VARCHAR(50) NOT NULL,
    wali_kelas VARCHAR(100),
    gender VARCHAR(20) DEFAULT 'all',
    total_students INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, class_id)
);

ALTER TABLE public.madin_classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Madin Classes" ON public.madin_classes FOR SELECT USING (true);
CREATE POLICY "Admin All Madin Classes" ON public.madin_classes FOR ALL USING (true);

-- 2. TABEL MADIN_SUBJECTS (Kurikulum Kitab Kuning Madin)
CREATE TABLE IF NOT EXISTS public.madin_subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    subject_id VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(100) DEFAULT 'Fiqih',
    class_id VARCHAR(50),
    teacher_name VARCHAR(100),
    kkm INT DEFAULT 70,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, subject_id)
);

ALTER TABLE public.madin_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Madin Subjects" ON public.madin_subjects FOR SELECT USING (true);
CREATE POLICY "Admin All Madin Subjects" ON public.madin_subjects FOR ALL USING (true);

-- 3. TABEL SOROGAN_SESSIONS (Master Sesi Waktu Sorogan)
CREATE TABLE IF NOT EXISTS public.sorogan_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    sesi_id VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(100) DEFAULT 'Sorogan Binnazhar Reguler',
    start_time VARCHAR(20),
    end_time VARCHAR(20),
    days JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, sesi_id)
);

ALTER TABLE public.sorogan_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Sorogan Sessions" ON public.sorogan_sessions FOR SELECT USING (true);
CREATE POLICY "Admin All Sorogan Sessions" ON public.sorogan_sessions FOR ALL USING (true);

-- 4. TABEL SOROGAN_HALAQAH (Kelompok Halaqah Sorogan)
CREATE TABLE IF NOT EXISTS public.sorogan_halaqah (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    halaqah_id VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    muallim_name VARCHAR(150) NOT NULL,
    curriculum_target VARCHAR(150),
    student_ids JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, halaqah_id)
);

ALTER TABLE public.sorogan_halaqah ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Sorogan Halaqah" ON public.sorogan_halaqah FOR SELECT USING (true);
CREATE POLICY "Admin All Sorogan Halaqah" ON public.sorogan_halaqah FOR ALL USING (true);

-- 5. TABEL SOROGAN_CAPAIAN (Monitoring Capaian & Target Sorogan Santri)
CREATE TABLE IF NOT EXISTS public.sorogan_capaian (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id VARCHAR(50) NOT NULL,
    student_name VARCHAR(150) NOT NULL,
    juz_aktif INT DEFAULT 1,
    halaman_terakhir INT DEFAULT 1,
    total_halaman_khatam INT DEFAULT 0,
    status_terakhir VARCHAR(30) DEFAULT 'LANJUT',
    halaqah_id VARCHAR(50),
    nama_halaqah VARCHAR(150),
    muallim_pengampu VARCHAR(150),
    target_juz INT DEFAULT 30,
    target_halaman_sesi INT DEFAULT 2,
    target_halaman_pekan INT DEFAULT 22,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, student_id)
);

ALTER TABLE public.sorogan_capaian ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Sorogan Capaian" ON public.sorogan_capaian FOR SELECT USING (true);
CREATE POLICY "Admin All Sorogan Capaian" ON public.sorogan_capaian FOR ALL USING (true);

-- ==================== DATA SEEDING / SINKRONISASI ====================

-- 1. Insert Kelas Madin
INSERT INTO public.madin_classes (
  tenant_id,
  class_id,
  name,
  level,
  wali_kelas,
  gender,
  total_students,
  is_active
) VALUES
`;

const classValues = data.madin.classes.map(c => {
  return `(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  ${escapeSql(c.classId)},
  ${escapeSql(c.namaKelas)},
  ${escapeSql(c.tingkat)},
  ${escapeSql(c.waliKelas)},
  ${escapeSql(c.gender || 'all')},
  ${Number(c.totalSantri) || 0},
  true
)`;
});

sql += classValues.join(',\n') + '\n';
sql += `ON CONFLICT (tenant_id, class_id) DO UPDATE SET
  name = EXCLUDED.name,
  level = EXCLUDED.level,
  wali_kelas = EXCLUDED.wali_kelas,
  total_students = EXCLUDED.total_students,
  is_active = EXCLUDED.is_active;

-- 2. Insert Kitab Kuning Madin
INSERT INTO public.madin_subjects (
  tenant_id,
  subject_id,
  name,
  category,
  class_id,
  teacher_name,
  kkm,
  is_active
) VALUES
`;

const subjectValues = data.madin.subjects.map(s => {
  return `(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  ${escapeSql(s.subjectId)},
  ${escapeSql(s.namaKitab)},
  ${escapeSql(s.bidang || 'Fiqih')},
  ${escapeSql(s.classId)},
  ${escapeSql(s.ustadzPengampu)},
  ${Number(s.kkm) || 70},
  true
)`;
});

sql += subjectValues.join(',\n') + '\n';
sql += `ON CONFLICT (tenant_id, subject_id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  class_id = EXCLUDED.class_id,
  teacher_name = EXCLUDED.teacher_name,
  kkm = EXCLUDED.kkm,
  is_active = EXCLUDED.is_active;

-- 3. Insert Sesi Sorogan
INSERT INTO public.sorogan_sessions (
  tenant_id,
  sesi_id,
  name,
  category,
  start_time,
  end_time,
  days,
  is_active
) VALUES
`;

const sesiValues = (data.sorogan.sesiList || []).map(s => {
  return `(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  ${escapeSql(s.sesiId)},
  ${escapeSql(s.namaSesi)},
  ${escapeSql(s.jenisSesi || 'Sorogan Binnazhar Reguler')},
  ${escapeSql(s.jamMulai)},
  ${escapeSql(s.jamSelesai)},
  ${escapeSql(JSON.stringify(s.hariList || []))}::jsonb,
  true
)`;
});

sql += sesiValues.join(',\n') + '\n';
sql += `ON CONFLICT (tenant_id, sesi_id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time,
  days = EXCLUDED.days,
  is_active = EXCLUDED.is_active;

-- 4. Insert Halaqah Sorogan
INSERT INTO public.sorogan_halaqah (
  tenant_id,
  halaqah_id,
  name,
  muallim_name,
  curriculum_target,
  student_ids,
  is_active
) VALUES
`;

const halaqahValues = (data.sorogan.halaqahs || []).map(h => {
  return `(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  ${escapeSql(h.halaqahId)},
  ${escapeSql(h.namaHalaqah)},
  ${escapeSql(h.muallim || h.muallimPengampu)},
  ${escapeSql(h.targetKurikulum || '')},
  ${escapeSql(JSON.stringify(h.studentIds || []))}::jsonb,
  true
)`;
});

sql += halaqahValues.join(',\n') + '\n';
sql += `ON CONFLICT (tenant_id, halaqah_id) DO UPDATE SET
  name = EXCLUDED.name,
  muallim_name = EXCLUDED.muallim_name,
  curriculum_target = EXCLUDED.curriculum_target,
  student_ids = EXCLUDED.student_ids,
  is_active = EXCLUDED.is_active;

-- 5. Insert Capaian & Target Sorogan Seluruh 51 Santri
INSERT INTO public.sorogan_capaian (
  tenant_id,
  student_id,
  student_name,
  juz_aktif,
  halaman_terakhir,
  total_halaman_khatam,
  status_terakhir,
  halaqah_id,
  nama_halaqah,
  muallim_pengampu,
  target_juz,
  target_halaman_sesi,
  target_halaman_pekan
) VALUES
`;

const capaianValues = (data.sorogan.students || []).map(st => {
  const t = st.target || {};
  return `(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  ${escapeSql(st.studentId)},
  ${escapeSql(st.name)},
  ${Number(st.juzAktif) || 1},
  ${Number(st.halamanTerakhir) || 1},
  ${Number(st.totalHalamanKhatam) || 0},
  ${escapeSql(st.statusTerakhir || 'LANJUT')},
  ${escapeSql(st.halaqahId || '')},
  ${escapeSql(st.namaHalaqah || 'Belum Masuk Halaqah')},
  ${escapeSql(st.muallimPengampu || '-')},
  ${Number(t.targetJuz) || 30},
  ${Number(t.targetHalamanSesi) || 2},
  ${Number(t.targetHalamanPekan) || 22}
)`;
});

sql += capaianValues.join(',\n') + '\n';
sql += `ON CONFLICT (tenant_id, student_id) DO UPDATE SET
  student_name = EXCLUDED.student_name,
  juz_aktif = EXCLUDED.juz_aktif,
  halaman_terakhir = EXCLUDED.halaman_terakhir,
  total_halaman_khatam = EXCLUDED.total_halaman_khatam,
  status_terakhir = EXCLUDED.status_terakhir,
  halaqah_id = EXCLUDED.halaqah_id,
  nama_halaqah = EXCLUDED.nama_halaqah,
  muallim_pengampu = EXCLUDED.muallim_pengampu,
  target_juz = EXCLUDED.target_juz,
  target_halaman_sesi = EXCLUDED.target_halaman_sesi,
  target_halaman_pekan = EXCLUDED.target_halaman_pekan,
  updated_at = NOW();
`;

const outPath = path.join(__dirname, '../database/migrations/07_create_and_sync_academic_madin_sorogan.sql');
fs.writeFileSync(outPath, sql);
console.log('✅ Generated migration SQL at:', outPath);

