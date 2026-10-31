const fs = require('fs');
const path = require('path');

const cmsData = JSON.parse(fs.readFileSync(path.join(__dirname, '../migration_data/cms_data.json'), 'utf8'));

function escapeSql(str) {
  if (str === null || str === undefined || str === '') return 'NULL';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

let sql = `-- ====================================================================
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
`;

const galeriValues = cmsData.galeri.map(g => {
  return `(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  ${escapeSql(g.id)},
  ${escapeSql(g.judul)},
  ${escapeSql(g.kategori)},
  ${escapeSql(g.keterangan)},
  ${escapeSql(g.gambar)},
  ${g.status === 'Aktif'},
  ${g.timestamp ? escapeSql(g.timestamp) : 'NOW()'}
)`;
});

sql += galeriValues.join(',\n') + '\n';
sql += `ON CONFLICT (tenant_id, gallery_id) DO UPDATE SET
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
`;

const unitValues = cmsData.unit.map(u => {
  return `(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  ${escapeSql(u.id)},
  ${escapeSql(u.nama)},
  ${escapeSql(u.kategori)},
  ${escapeSql(u.jadwal)},
  ${escapeSql(u.deskripsi)},
  ${escapeSql(u.gambar)},
  ${Number(u.urutan) || 1},
  ${u.status === 'Aktif'},
  ${u.timestamp ? escapeSql(u.timestamp) : 'NOW()'}
)`;
});

sql += unitValues.join(',\n') + '\n';
sql += `ON CONFLICT (tenant_id, unit_id) DO UPDATE SET
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
`;

const notifValues = cmsData.notif.map(n => {
  return `(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  ${escapeSql(n.id)},
  ${escapeSql(n.judul)},
  ${escapeSql(n.kategori)},
  ${escapeSql(n.tanggal)},
  ${escapeSql(n.ringkasan)},
  ${escapeSql(n.isi)},
  ${escapeSql(n.gambar)},
  ${Boolean(n.is_popup)},
  ${n.status === 'Aktif'},
  ${n.createdAt ? escapeSql(n.createdAt) : 'NOW()'}
)`;
});

sql += notifValues.join(',\n') + '\n';
sql += `ON CONFLICT (tenant_id, notification_id) DO UPDATE SET
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
  ${escapeSql(cmsData.setting.nama_pesantren || 'Roudlotul Mubarokah')},
  ${escapeSql(cmsData.setting.alamat_pesantren)},
  ${escapeSql(cmsData.setting.tahun_berdiri)},
  ${escapeSql(cmsData.setting.tanggal_berdiri)},
  ${escapeSql(cmsData.setting.visi_misi)},
  ${escapeSql(cmsData.setting.sejarah)},
  ${escapeSql(cmsData.setting.video_highlight)},
  jsonb_build_object(
    'facebook', ${escapeSql(cmsData.setting.link_facebook || '')},
    'instagram', ${escapeSql(cmsData.setting.link_instagram || '')},
    'youtube', ${escapeSql(cmsData.setting.link_youtube || '')}
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
`;

const outPath = path.join(__dirname, '../database/migrations/06_create_and_sync_cms_tables.sql');
fs.writeFileSync(outPath, sql);
console.log('✅ Successfully created', outPath);

