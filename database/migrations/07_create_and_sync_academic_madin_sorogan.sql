-- ====================================================================
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
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'MD-ULA1',
  '1 Awaliyah',
  'Awaliyah',
  'Ust. Hidayat',
  'all',
  24,
  true
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'MD-WST2',
  '2 Wustho',
  'Wustho',
  'Ust. Ulil Abshor',
  'all',
  22,
  true
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'MD-WST3',
  '3 Wustho',
  'Wustho',
  'Ust. Mukhlasin',
  'all',
  6,
  true
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'MD-WST4',
  '4 Wustho',
  'Wustho',
  'Ust. Sulaiman',
  'all',
  21,
  true
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'MD-ULY5',
  '5 Ulya',
  'Ulya',
  'Ust.Nazirul Muhammad, AH.',
  'all',
  5,
  true
)
ON CONFLICT (tenant_id, class_id) DO UPDATE SET
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
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'SBJ-01',
  'Mabadi Fiqh 1',
  'Fiqih',
  'MD-ULA1',
  'Ust. Hidayat',
  70,
  true
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'SBJ-02',
  'Mabadi Fiqh 2',
  'Fiqih',
  'MD-WST2',
  'Ust. Ulil Abshor',
  70,
  true
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'SBJ-03',
  'Mabadi Fiqh 3',
  'Fiqih',
  'MD-WST3',
  'Ust. Mukhlasin',
  75,
  true
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'SBJ-04',
  'Fathul Qorib',
  'Fiqih',
  'MD-WST4',
  'Ust. Sulaiman',
  70,
  true
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'SBJ-05',
  'Fathul Mu''in',
  'Fiqih',
  'MD-ULY5',
  'Ust.Nazirul Muhammad, AH.',
  75,
  true
)
ON CONFLICT (tenant_id, subject_id) DO UPDATE SET
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
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'SRG-SESI-01',
  'Pagi (Ba''da Subuh)',
  'Sorogan Binnazhar Reguler',
  '05:00',
  '06:00',
  '["Sen","Rab","Kam","Sab","Min"]'::jsonb,
  true
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'SRG-SESI-02',
  'Sore (Ba''da Ashar)',
  'Sorogan Binnazhar Reguler',
  '16:00',
  '17:00',
  '["Sen","Sel","Rab","Kam","Sab","Min"]'::jsonb,
  true
)
ON CONFLICT (tenant_id, sesi_id) DO UPDATE SET
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
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'SRG-HLQ-20260923-095244-984',
  'Halaqah Ustdz. Izza Nazila, AH.',
  'Ustdz. Izza Nazila, AH.',
  'Sorogan Binnazhar Mushaf Pojok 30 Juz',
  '["STD_022","STD_027","STD_028","STD_035","STD_031","STD_019","STD_021","STD_030","STD_034","STD_026"]'::jsonb,
  true
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'SRG-HLQ-20260927-170010-909',
  'Halaqah Ust.Nazirul Muhammad, AH.',
  'Ust.Nazirul Muhammad, AH.',
  'Tahsin 30 Juz',
  '["STD_018","STD_024","STD_017","STD_043"]'::jsonb,
  true
)
ON CONFLICT (tenant_id, halaqah_id) DO UPDATE SET
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
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_001',
  'Nur Hayati',
  1,
  1,
  0,
  'LANJUT',
  NULL,
  'Belum Masuk Halaqah',
  '-',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_002',
  'Naya Aulia',
  1,
  1,
  0,
  'LANJUT',
  NULL,
  'Belum Masuk Halaqah',
  '-',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_003',
  'Adilla Qotrun Nada',
  1,
  1,
  0,
  'LANJUT',
  NULL,
  'Belum Masuk Halaqah',
  '-',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_004',
  'Haniva Jihan Nafisah',
  1,
  1,
  0,
  'LANJUT',
  NULL,
  'Belum Masuk Halaqah',
  '-',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_005',
  'Kaysatun Nikmah',
  1,
  1,
  0,
  'LANJUT',
  NULL,
  'Belum Masuk Halaqah',
  '-',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_006',
  'Maulida Faizatul Husna',
  1,
  1,
  0,
  'LANJUT',
  NULL,
  'Belum Masuk Halaqah',
  '-',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_007',
  'Fitrotun Nufus',
  1,
  1,
  0,
  'LANJUT',
  NULL,
  'Belum Masuk Halaqah',
  '-',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_008',
  'Laila Silviatur Rohmah',
  1,
  1,
  0,
  'LANJUT',
  NULL,
  'Belum Masuk Halaqah',
  '-',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_009',
  'Widya Anastasya Putri',
  1,
  1,
  0,
  'LANJUT',
  NULL,
  'Belum Masuk Halaqah',
  '-',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_010',
  'Tutik Egiq Lestari',
  1,
  1,
  0,
  'LANJUT',
  NULL,
  'Belum Masuk Halaqah',
  '-',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_011',
  'Naila Anggi Maulina',
  1,
  1,
  0,
  'LANJUT',
  NULL,
  'Belum Masuk Halaqah',
  '-',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_012',
  'Atika Tsama Salsabila',
  1,
  1,
  0,
  'LANJUT',
  NULL,
  'Belum Masuk Halaqah',
  '-',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_013',
  'Khusniyah Salsabila',
  1,
  1,
  0,
  'LANJUT',
  NULL,
  'Belum Masuk Halaqah',
  '-',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_014',
  'Azza Putri Rahmawati',
  1,
  1,
  0,
  'LANJUT',
  NULL,
  'Belum Masuk Halaqah',
  '-',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_015',
  'Qotrun Nada Rahma Syifa',
  1,
  1,
  0,
  'LANJUT',
  NULL,
  'Belum Masuk Halaqah',
  '-',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_016',
  'Zafira Nur Fadilah Hasna',
  1,
  1,
  0,
  'LANJUT',
  NULL,
  'Belum Masuk Halaqah',
  '-',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_017',
  'M. Danil Firmansyah',
  1,
  1,
  0,
  'LANJUT',
  'SRG-HLQ-20260927-170010-909',
  'Halaqah Ust.Nazirul Muhammad, AH.',
  'Ust.Nazirul Muhammad, AH.',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_018',
  'M. Faiz Khoirul Anam',
  16,
  5,
  8,
  'LANJUT',
  'SRG-HLQ-20260927-170010-909',
  'Halaqah Ust.Nazirul Muhammad, AH.',
  'Ust.Nazirul Muhammad, AH.',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_019',
  'Siti Nur Afifah',
  14,
  1,
  14,
  'LANJUT',
  'SRG-HLQ-20260923-095244-984',
  'Halaqah Ustdz. Izza Nazila, AH.',
  'Ustdz. Izza Nazila, AH.',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_020',
  'Dian Amalia Ramadhani',
  13,
  3,
  11,
  'LANJUT',
  NULL,
  'Belum Masuk Halaqah',
  '-',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_021',
  'Afika Naila Imara',
  6,
  19,
  7,
  'LANJUT',
  'SRG-HLQ-20260923-095244-984',
  'Halaqah Ustdz. Izza Nazila, AH.',
  'Ustdz. Izza Nazila, AH.',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_022',
  'Nilna Aulia Safira',
  7,
  8,
  9,
  'LANJUT',
  'SRG-HLQ-20260923-095244-984',
  'Halaqah Ustdz. Izza Nazila, AH.',
  'Ustdz. Izza Nazila, AH.',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_023',
  'Erna Safaatus Sholekhah',
  7,
  7,
  15,
  'LANJUT',
  NULL,
  'Belum Masuk Halaqah',
  '-',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_024',
  'Wahyu Nur Wakhid',
  2,
  14,
  6,
  'LANJUT',
  'SRG-HLQ-20260927-170010-909',
  'Halaqah Ust.Nazirul Muhammad, AH.',
  'Ust.Nazirul Muhammad, AH.',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_025',
  'Hana Safitri',
  2,
  5,
  3,
  'LANJUT',
  NULL,
  'Belum Masuk Halaqah',
  '-',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_026',
  'Aulia Afi',
  1,
  1,
  0,
  'LANJUT',
  'SRG-HLQ-20260923-095244-984',
  'Halaqah Ustdz. Izza Nazila, AH.',
  'Ustdz. Izza Nazila, AH.',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_027',
  'Vicha Mesila Avriana',
  25,
  7,
  27,
  'LANJUT',
  'SRG-HLQ-20260923-095244-984',
  'Halaqah Ustdz. Izza Nazila, AH.',
  'Ustdz. Izza Nazila, AH.',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_028',
  'Faiqotul Himmah',
  24,
  1,
  6,
  'LANJUT',
  'SRG-HLQ-20260923-095244-984',
  'Halaqah Ustdz. Izza Nazila, AH.',
  'Ustdz. Izza Nazila, AH.',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_029',
  'Dina Izzatul Apriliani',
  20,
  3,
  12,
  'LANJUT',
  NULL,
  'Belum Masuk Halaqah',
  '-',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_030',
  'Usma Nova Elmira',
  15,
  20,
  14,
  'LANJUT',
  'SRG-HLQ-20260923-095244-984',
  'Halaqah Ustdz. Izza Nazila, AH.',
  'Ustdz. Izza Nazila, AH.',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_031',
  'Shafiyah El Musy',
  14,
  5,
  15,
  'LANJUT',
  'SRG-HLQ-20260923-095244-984',
  'Halaqah Ustdz. Izza Nazila, AH.',
  'Ustdz. Izza Nazila, AH.',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_032',
  'Layulfa Chusna',
  14,
  4,
  9,
  'LANJUT',
  NULL,
  'Belum Masuk Halaqah',
  '-',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_033',
  'Ahmad Alindra Dwi Mantara',
  1,
  1,
  0,
  'LANJUT',
  NULL,
  'Belum Masuk Halaqah',
  '-',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_034',
  'Zahra Maharani Wijayanti',
  14,
  6,
  11,
  'LANJUT',
  'SRG-HLQ-20260923-095244-984',
  'Halaqah Ustdz. Izza Nazila, AH.',
  'Ustdz. Izza Nazila, AH.',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_035',
  'Bilqis Nur Hidayatul Hikmah',
  11,
  15,
  22,
  'LANJUT',
  'SRG-HLQ-20260923-095244-984',
  'Halaqah Ustdz. Izza Nazila, AH.',
  'Ustdz. Izza Nazila, AH.',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_036',
  'Jamaludin Akbar Mursyit',
  10,
  19,
  14,
  'LANJUT',
  NULL,
  'Belum Masuk Halaqah',
  '-',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_037',
  'M. Syarif HIdayatullah',
  1,
  1,
  0,
  'LANJUT',
  NULL,
  'Belum Masuk Halaqah',
  '-',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_038',
  'Elsa Feby Damayanti',
  1,
  1,
  0,
  'LANJUT',
  NULL,
  'Belum Masuk Halaqah',
  '-',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_039',
  'Faza Oktavia Septiani',
  1,
  1,
  0,
  'LANJUT',
  NULL,
  'Belum Masuk Halaqah',
  '-',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_040',
  'Ahmad Erda Sanjaya',
  1,
  1,
  0,
  'LANJUT',
  NULL,
  'Belum Masuk Halaqah',
  '-',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_041',
  'Dewi Ayu Sonia',
  1,
  1,
  0,
  'LANJUT',
  NULL,
  'Belum Masuk Halaqah',
  '-',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_042',
  'Risma Hamida Zakhia',
  1,
  1,
  0,
  'LANJUT',
  NULL,
  'Belum Masuk Halaqah',
  '-',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_043',
  'Fatimah Chusni Azzahra',
  1,
  1,
  0,
  'LANJUT',
  'SRG-HLQ-20260927-170010-909',
  'Halaqah Ust.Nazirul Muhammad, AH.',
  'Ust.Nazirul Muhammad, AH.',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_044',
  'Siema Annajmi',
  1,
  1,
  0,
  'LANJUT',
  NULL,
  'Belum Masuk Halaqah',
  '-',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_045',
  'Asyifa Khusna R.',
  1,
  1,
  0,
  'LANJUT',
  NULL,
  'Belum Masuk Halaqah',
  '-',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_046',
  'Diah Ayu Anggraeni',
  1,
  1,
  0,
  'LANJUT',
  NULL,
  'Belum Masuk Halaqah',
  '-',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_047',
  'Putri Adinda Muqoddimatul Awaliyah',
  1,
  1,
  0,
  'LANJUT',
  NULL,
  'Belum Masuk Halaqah',
  '-',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_048',
  'Selfie Olivia Najwa R.',
  1,
  1,
  0,
  'LANJUT',
  NULL,
  'Belum Masuk Halaqah',
  '-',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_049',
  'Puput Aqila Najwa',
  1,
  1,
  0,
  'LANJUT',
  NULL,
  'Belum Masuk Halaqah',
  '-',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_050',
  'Gisel Najla Ramadhani',
  1,
  1,
  0,
  'LANJUT',
  NULL,
  'Belum Masuk Halaqah',
  '-',
  30,
  2,
  22
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'STD_051',
  'Riski Adi Saputra',
  1,
  1,
  0,
  'LANJUT',
  NULL,
  'Belum Masuk Halaqah',
  '-',
  30,
  2,
  22
)
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
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
