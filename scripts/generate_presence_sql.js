const fs = require('fs');
const path = require('path');

const TENANT_ID = 'baa9eb9b-2d87-4648-a674-059bb289cb63';

// Baca data Presensi
const presensiData = JSON.parse(fs.readFileSync(path.join(__dirname, '../migration_data/presensi_data.json'), 'utf8'));
const activities = presensiData.kegiatanList || [];
const sessions = presensiData.recentSessions || [];

function escapeSql(str) {
  if (str === null || str === undefined || str === '') return 'NULL';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

function cleanOpenTime(val) {
  if (!val) return 'NULL';
  const s = String(val).trim();
  // Contoh: 'Sat Dec 30 1899 20:37:00 GMT+0707 (Waktu Indonesia Barat)'
  const match = s.match(/(\d{2}:\d{2}(?::\d{2})?)/);
  if (match) {
    return escapeSql(match[1].substring(0, 5) + ' WIB');
  }
  return escapeSql(s.substring(0, 95));
}

let sql = `-- ====================================================================
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
`;

activities.forEach(a => {
  sql += `INSERT INTO public.presence_activities (tenant_id, activity_code, name, category, routine_schedule, target_audience, person_in_charge, status, created_at)
VALUES (
    '${TENANT_ID}',
    ${escapeSql(a.kegiatanId)},
    ${escapeSql(a.namaKegiatan)},
    ${escapeSql(a.kategori)},
    ${escapeSql(a.jadwalRutin)},
    ${escapeSql(a.targetPeserta)},
    ${escapeSql(a.penanggungJawab)},
    ${escapeSql(a.status || 'Aktif')},
    ${escapeSql(a.createdAt || new Date().toISOString())}
)
ON CONFLICT (tenant_id, activity_code) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    routine_schedule = EXCLUDED.routine_schedule,
    target_audience = EXCLUDED.target_audience,
    person_in_charge = EXCLUDED.person_in_charge,
    status = EXCLUDED.status;

`;
});

sql += `
-- ====================================================================
-- SEED DATA 2: PRESENCE SESSIONS (4 Sesi Presensi Historis)
-- ====================================================================
`;

sessions.forEach(s => {
  sql += `INSERT INTO public.presence_sessions (tenant_id, session_code, activity_id, activity_code, activity_name, date, open_time, officer_name, total_students, total_present, total_permit, total_sick, total_absent, session_status, notes, created_at)
VALUES (
    '${TENANT_ID}',
    ${escapeSql(s.sesiId)},
    (SELECT id FROM public.presence_activities WHERE activity_code = ${escapeSql(s.kegiatanId)} AND tenant_id = '${TENANT_ID}' LIMIT 1),
    ${escapeSql(s.kegiatanId)},
    ${escapeSql(s.namaKegiatan)},
    ${escapeSql(s.tanggal)},
    ${cleanOpenTime(s.waktuBuka)},
    ${escapeSql(s.petugas)},
    ${Number(s.totalPeserta) || 0},
    ${Number(s.totalHadir) || 0},
    ${Number(s.totalIzin) || 0},
    ${Number(s.totalSakit) || 0},
    ${Number(s.totalAlpa) || 0},
    ${escapeSql(s.statusSesi || 'Tutup')},
    ${escapeSql(s.catatan || '')},
    ${escapeSql(s.createdAt || new Date().toISOString())}
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

`;
});

const outputPath = path.join(__dirname, '../database/migrations/09_create_and_sync_presence.sql');
fs.writeFileSync(outputPath, sql, 'utf8');
console.log('Successfully regenerated SQL migration 09 to: ' + outputPath);
