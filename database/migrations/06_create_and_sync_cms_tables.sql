-- ====================================================================
-- MIGRATION 06: DDL & SINKRONISASI KONTEN PORTAL PUBLIK (CMS)
-- Target Tenant : PPTQ Roudlotul Mubarokah (baa9eb9b-2d87-4648-a674-059bb289cb63)
-- Sumber Data   : Google Spreadsheet [OFFICIAL] (Galeri, Unit_Kegiatan, Notifikasi, Pengaturan)
-- ====================================================================

-- 1. TABEL GALLERIES (Galeri Dokumentasi Kegiatan Pesantren)
CREATE TABLE IF NOT EXISTS public.galleries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    gallery_id VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    category VARCHAR(100) DEFAULT 'Kegiatan Santri',
    description TEXT,
    image_url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, gallery_id)
);

ALTER TABLE public.galleries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Galleries" ON public.galleries FOR SELECT USING (true);
CREATE POLICY "Admin All Galleries" ON public.galleries FOR ALL USING (true);

-- 2. TABEL UNIT_ACTIVITIES (Unit Kegiatan Santri / Ekstrakurikuler)
CREATE TABLE IF NOT EXISTS public.unit_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    unit_id VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(100) DEFAULT 'Divisi Pendidikan',
    schedule VARCHAR(100),
    description TEXT,
    image_url TEXT,
    display_order INT DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, unit_id)
);

ALTER TABLE public.unit_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Unit Activities" ON public.unit_activities FOR SELECT USING (true);
CREATE POLICY "Admin All Unit Activities" ON public.unit_activities FOR ALL USING (true);

-- 3. TABEL NOTIFICATIONS (Pengumuman Siaran In-App)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    notification_id VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    category VARCHAR(50) DEFAULT 'Pengumuman',
    date_display VARCHAR(30),
    summary TEXT,
    content TEXT,
    image_url TEXT,
    is_popup BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, notification_id)
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Notifications" ON public.notifications FOR SELECT USING (true);
CREATE POLICY "Admin All Notifications" ON public.notifications FOR ALL USING (true);

-- 4. TABEL TENANT_SETTINGS (Konfigurasi & Profil Lembaga)
CREATE TABLE IF NOT EXISTS public.tenant_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
    institution_name VARCHAR(150),
    address TEXT,
    founded_year VARCHAR(20),
    founded_date VARCHAR(50),
    vision_mission TEXT,
    history TEXT,
    video_highlight TEXT,
    social_links JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Tenant Settings" ON public.tenant_settings FOR SELECT USING (true);
CREATE POLICY "Admin All Tenant Settings" ON public.tenant_settings FOR ALL USING (true);

-- ==================== DATA SEEDING / SINKRONISASI ====================

-- 1. Insert Data Galeri
INSERT INTO public.galleries (
  tenant_id,
  gallery_id,
  title,
  category,
  description,
  image_url,
  is_active,
  created_at
) VALUES
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'GLR_1790335737719',
  'Sidang Pleno 1',
  'Kegiatan Santri',
  'Dewan Kepengurusan',
  'https://lh3.googleusercontent.com/d/19zRN6PA2pA0AE5rNg-FJ7cCaOOUrWanP',
  true,
  '2026-09-25T11:28:57.719Z'
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'GLR_1790329466877',
  'Santri Putri',
  'Kegiatan Santri',
  NULL,
  'https://lh3.googleusercontent.com/d/193z8BjmZeW0F2oxrLOD8GTCzUXbvrHdm',
  true,
  '2026-09-25T09:44:26.877Z'
)
ON CONFLICT (tenant_id, gallery_id) DO UPDATE SET
  title = EXCLUDED.title,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  image_url = EXCLUDED.image_url,
  is_active = EXCLUDED.is_active;

-- 2. Insert Data Unit Kegiatan
INSERT INTO public.unit_activities (
  tenant_id,
  unit_id,
  name,
  category,
  schedule,
  description,
  image_url,
  display_order,
  is_active,
  created_at
) VALUES
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'UKS_1789980730445',
  'Khitobah ( Latihan Pidato, MC, Sambutan dll)',
  'Divisi Pendidikan',
  '1x Seminggu / Tahun',
  'Unit kegiatan santri yang berfokus pada Latihan Pidato, MC, Sambutan Kepanitiaan. Ditujukan sebagai wadah kreativitas untuk melatih mental dan rasa percaya diri santri saat berada di tengah masyarakat.',
  'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?q=80&w=800&auto=format&fit=crop',
  1,
  true,
  '2026-09-21T08:52:10.445Z'
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'UKS_1789980994163',
  'Rebana Ar Roudloh',
  'Divisi Pendidikan',
  '1x Seminggu / Tahun',
  'Pengembangan Bakat Santri di Bidang Seni Rebana dan Sholawat',
  'https://lh3.googleusercontent.com/d/1ry5jOkd72TQg0Rqg1xtX9Sv3oeyiQkPO',
  1,
  true,
  '2026-09-21T08:56:34.163Z'
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'UKS_1790049452531',
  'Seni Tilawah',
  'Divisi Pendidikan',
  '1x Seminggu / Tahun',
  'Melatih dan mengembangkan Bakat dalam bidang Tilawah Al-Qur''an',
  'https://lh3.googleusercontent.com/d/1hU2vXlakyXxy9C49keqKnMJjRREqPL3G',
  3,
  true,
  '2026-09-22T03:57:32.532Z'
)
ON CONFLICT (tenant_id, unit_id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  schedule = EXCLUDED.schedule,
  description = EXCLUDED.description,
  image_url = EXCLUDED.image_url,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

-- 3. Insert Data Notifikasi Siaran
INSERT INTO public.notifications (
  tenant_id,
  notification_id,
  title,
  category,
  date_display,
  summary,
  content,
  image_url,
  is_popup,
  is_active,
  created_at
) VALUES
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'NOTIF_1790427505041',
  'Info Sambangan',
  'Pengumuman',
  '2026-09-26',
  'Mohon Info dibaca dengan seksama.',
  'Info Sambangan
*PPTQ ROUDLOTUL MUBAROKAH*
*Bulan Oktober 2026"

السَّلاَمُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ
بِسْمِ اللّهِ الرَّحْمَنِ الرَّحِيْم

Semoga Bapak Ibu Pinaringan Shihah wa ''Afiyah. 
Sambangan pada hari *Ahad, 4 Oktober 2026* dengan Teknis sebagai berikut :

◼️ Pintu gerbang dibuka pukul 07.30 - 17.00 WIB.

◼️ Wali santri wajib menyimak putra/putrinya atas perolehan hafalan minimal 15 menit di Aula Multimedia, sebelum keluar area Pesantren

◼️Administrasi sampai bulan Oktober
(*bagi Wali Santri yang masih mempunyai tanggungan mohon segera diselesaikan, Semua akan kembali ke putra putri masing-masing*)

◼️Menitipkan uang jajan kepada Ustadz/Ustadzah & komunikasi tentang perkembangan anak. 

◼️Bawakan Susu, Vitamin dan Jajan secukupnya. 

◼️ Wajib menjaga kebersihan lingkungan di area sambangan.

◼️ *Santri kembali ke Pesantren pukul 16.00 WIB*
Pukul 17.00 WIB, gerbang ditutup

◼️ *Mentaati aturan Pesantren merupakan Salah satu Ikhtiyar supaya anak kerasan dan menjadi Sholih/Sholihah, Manfaah - Barokah Ilmunya.*

Demikian informasi kami sampaikan harap untuk diperhatikan dan ditaati.

*وَالْعَفْوُ مِنْكُمْ*
*وَالله المُوَفِّق إلى أَقْوَمِ الطَّرِيْق*
*والسَّــــــــــــلَامُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُه*',
  'https://lh3.googleusercontent.com/d/15Cef7HQe-PjnT03IRPNXX9maSlJ8j_C4',
  false,
  false,
  '2026-09-26T12:58:25.041Z'
)
ON CONFLICT (tenant_id, notification_id) DO UPDATE SET
  title = EXCLUDED.title,
  category = EXCLUDED.category,
  date_display = EXCLUDED.date_display,
  summary = EXCLUDED.summary,
  content = EXCLUDED.content,
  image_url = EXCLUDED.image_url,
  is_popup = EXCLUDED.is_popup,
  is_active = EXCLUDED.is_active;

-- 4. Upsert Data Pengaturan Pesantren
INSERT INTO public.tenant_settings (
  tenant_id,
  institution_name,
  address,
  founded_year,
  founded_date,
  vision_mission,
  history,
  video_highlight,
  social_links,
  updated_at
) VALUES (
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'Roudlotul Mubarokah',
  'Rimbukidul, RT 01 / RW 07, Rejosari, Karangawen, Demak, Jawa Tengah',
  '1983',
  '12 Desember 1983',
  'Roudlotul Mubarokah
"Berilmu, BerAmal, BerAkhlaqul karimah"

"Menggapai Himmah ''Aliyyah"

Visi:

“Menyiapkan sumber daya insani yang berkualitas melalui tafaqquh fiddin dan pengembangan masyarakat ”.

Misi:

“Melaksanakan pendidikan dan pengajaran yang berkualitas dengan kompetensi tafaqquh fiddin Secara umum pendidikan dimaksudkan untuk mempersiapkan peserta didik (santri) menjadi mampu mendalami, menghayati dan mengembangkan Islam secara utuh serta mampu mengelola lingkungan.',
  'Pondok Pesantren Tahfidzul Qur''an Roudlotul Mubarokah didirikan dengan tekad luhur untuk mencetak generasi penghafal Al-Qur''an yang mutqin, berakhlak mulia, dan berwawasan kebangsaan yang luas.

Berawal dari majelis halaqah tahfidz dan pembinaan keagamaan masyarakat, Pesantren Roudlotul Mubarokah kini berkembang menjadi lembaga pendidikan terpadu yang memadukan sanad tahfidz Al-Qur''an bersanad muttashil, kajian kitab kuning (salaf), serta penguasaan sains dan teknologi modern.

Dengan lingkungan pesantren yang kondusif, asri, dan berdisiplin tinggi di Karangawen Demak, kami berkomitmen mendampingi para santri mencapai kemandirian spiritual, kedalaman keilmuan syariah, dan kesiapan menjadi pemimpin umat masa depan.

Pondok Pesantren Roudlotul Mubarokah merupakah Pesantren yang didirikan pada tahun 1983 oleh Almaghfurlah KH. Sulasi Masykur, dan Kepengasuhannya di Pimpin langsung oleh salah satu Putra beliau KH. Abdul Muchit Sulasi beserta Istri Ibu Nyai Hj. Nashichatul Fuadah.

Hingga saat ini Pesantren yang berkembang dibawah naungan Yayasan KH. Sulasi Masykur, telah memiliki beberapa Lembaga Pendidikan, yaitu :

~ Lembaga Non Formal

1. PP. Roudlotul Mubarokah

2. Pesantren Tahfidh Anak

3. TPQ. Al Mubarokah

4. Madrasah Diniyah Salafiyyah

~ Lembaga Formal

1. RA. Masyithoh

2. MI. Darul Hikmah

3. MTs Tahfidz

4. MA Tahfidz',
  'https://www.youtube.com/embed/ZVkXOciLFmU?rel=0',
  jsonb_build_object(
    'facebook', 'https://facebook.com/pptq.karangawen',
    'instagram', 'https://www.instagram.com/pptq.karangawen',
    'youtube', 'https://youtube.com/@mubarakahtv'
  ),
  NOW()
)
ON CONFLICT (tenant_id) DO UPDATE SET
  institution_name = EXCLUDED.institution_name,
  address = EXCLUDED.address,
  founded_year = EXCLUDED.founded_year,
  founded_date = EXCLUDED.founded_date,
  vision_mission = EXCLUDED.vision_mission,
  history = EXCLUDED.history,
  video_highlight = EXCLUDED.video_highlight,
  social_links = EXCLUDED.social_links,
  updated_at = NOW();
