const fs = require('fs');
const path = require('path');

const TENANT_ID = 'baa9eb9b-2d87-4648-a674-059bb289cb63';

// 1. Baca data Keuangan & Tabungan
const ktData = JSON.parse(fs.readFileSync(path.join(__dirname, '../migration_data/keuangan_tabungan_ppdb.json'), 'utf8'));
const tarifs = ktData.keuangan.tarifList || [];
const accounts = ktData.tabungan.accounts || [];

// 2. Baca Jadwal Kegiatan
let jadwalList = [];
try {
  jadwalList = JSON.parse(fs.readFileSync(path.join(__dirname, '../migration_data/jadwal_kegiatan.json'), 'utf8'));
} catch (e) {
  console.warn('Jadwal kegiatan file not found, using empty array');
}

// 3. Setup Roles Permissions Data
const rolePermissions = [
  {
    roleKey: "SUPER_ADMIN",
    roleName: "Super Administrator",
    totalActive: 28,
    permissions: ["*"]
  },
  {
    roleKey: "ADMIN",
    roleName: "Administrator Lembaga",
    totalActive: 30,
    permissions: [
      "santri.view", "santri.create", "santri.edit", "santri.delete", "santri.export",
      "wali.view", "wali.manage", "unit.manage",
      "tahfidz.view", "tahfidz.entry", "tahfidz.target", "tahfidz.halaqah", "tahfidz.sesi",
      "tpq.view", "tpq.entry", "tpq.kelas", "tpq.sesi",
      "sorogan.view", "sorogan.entry", "sorogan.halaqah", "sorogan.sesi",
      "presensi.view", "presensi.entry", "presensi.kegiatan", "presensi.sesi",
      "madin.view", "madin.entry", "madin.kelas", "madin.kitab",
      "keuangan.view", "keuangan.spp", "keuangan.tagihan", "keuangan.verify", "keuangan.billing",
      "akuntansi.view", "akuntansi.transaksi", "akuntansi.tutupkasir", "akuntansi.laporan",
      "tabungan.view", "tabungan.topup", "tabungan.tarik", "tabungan.kantin",
      "ppdb.manage", "perpulangan.view", "perizinan.manage",
      "berita.manage", "banner.manage", "galeri.manage", "notifikasi.broadcast",
      "profil.manage", "pegawai.manage", "users.manage", "roles.manage", "system.config"
    ]
  },
  {
    roleKey: "ASATIDZ",
    roleName: "Dewan Asatidz / Pengajar",
    totalActive: 10,
    permissions: [
      "santri.view", "wali.view",
      "tahfidz.view", "tahfidz.entry", "tahfidz.target", "tahfidz.halaqah",
      "tpq.view", "tpq.entry",
      "sorogan.view", "sorogan.entry",
      "presensi.view", "presensi.entry",
      "madin.view", "madin.entry",
      "perizinan.manage", "pegawai.manage", "profil.manage"
    ]
  },
  {
    roleKey: "BENDAHARA",
    roleName: "Bendahara / Keuangan",
    totalActive: 14,
    permissions: [
      "santri.view", "ppdb.manage",
      "keuangan.view", "keuangan.spp", "keuangan.tagihan", "keuangan.verify", "keuangan.billing",
      "akuntansi.view", "akuntansi.transaksi", "akuntansi.tutupkasir", "akuntansi.laporan",
      "tabungan.view", "tabungan.topup", "tabungan.tarik", "tabungan.kantin",
      "notifikasi.broadcast", "pegawai.manage", "profil.manage"
    ]
  },
  {
    roleKey: "PENGURUS",
    roleName: "Pengurus / Kesantrian",
    totalActive: 12,
    permissions: [
      "santri.view", "presensi.view", "presensi.entry", "unit.manage", "ppdb.manage",
      "perizinan.manage", "perpulangan.view",
      "berita.manage", "banner.manage", "galeri.manage", "notifikasi.broadcast", "profil.manage"
    ]
  },
  {
    roleKey: "PENGASUH",
    roleName: "Dewan Masyayikh / Pengasuh",
    totalActive: 17,
    permissions: [
      "santri.view", "wali.view",
      "tahfidz.view", "tahfidz.entry", "tahfidz.target", "tahfidz.halaqah",
      "tpq.view", "tpq.entry", "sorogan.view", "sorogan.entry",
      "presensi.view", "presensi.entry", "keuangan.view", "akuntansi.view",
      "tabungan.view", "ppdb.manage", "profil.manage"
    ]
  },
  {
    roleKey: "WALI_SANTRI",
    roleName: "Wali Santri / Orang Tua",
    totalActive: 6,
    permissions: [
      "santri.view", "tahfidz.view", "presensi.view", "perpulangan.view",
      "keuangan.view", "tabungan.view"
    ]
  }
];

function escapeSql(str) {
  if (str === null || str === undefined || str === '') return 'NULL';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

let sql = `-- ====================================================================
-- MIGRATION 08: DDL & SINKRONISASI DOMAIN KEUANGAN (TABUNGAN, KASIR, TARIF), PPDB & RBAC
-- Target Tenant : PPTQ Roudlotul Mubarokah (baa9eb9b-2d87-4648-a674-059bb289cb63)
-- Sumber Data   : Google Spreadsheet [OFFICIAL]
-- ====================================================================

-- 1. TABEL FINANCIAL_TARIFFS (Master Pos Tarif & Tagihan)
CREATE TABLE IF NOT EXISTS public.financial_tariffs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    tariff_id VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL,
    period_type VARCHAR(50) NOT NULL,
    amount NUMERIC(14,2) NOT NULL,
    program VARCHAR(100) DEFAULT 'SEMUA',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, tariff_id)
);

ALTER TABLE public.financial_tariffs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Tariffs" ON public.financial_tariffs;
CREATE POLICY "Public Read Tariffs" ON public.financial_tariffs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin All Tariffs" ON public.financial_tariffs;
CREATE POLICY "Admin All Tariffs" ON public.financial_tariffs FOR ALL USING (true);

-- 2. TABEL STUDENT_WALLETS (Dompet Digital Uang Saku & Tabungan Santri)
CREATE TABLE IF NOT EXISTS public.student_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    student_code VARCHAR(50),
    balance NUMERIC(14,2) DEFAULT 0,
    daily_limit NUMERIC(14,2) DEFAULT 25000,
    daily_spent NUMERIC(14,2) DEFAULT 0,
    last_spent_date DATE,
    is_locked BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, student_id)
);

ALTER TABLE public.student_wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Wallets" ON public.student_wallets;
CREATE POLICY "Public Read Wallets" ON public.student_wallets FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin All Wallets" ON public.student_wallets;
CREATE POLICY "Admin All Wallets" ON public.student_wallets FOR ALL USING (true);

-- 3. TABEL WALLET_TRANSACTIONS (Riwayat Mutasi & Belanja Cashless Kantin)
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    mutation_code VARCHAR(50) NOT NULL,
    wallet_id UUID REFERENCES public.student_wallets(id) ON DELETE SET NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL,
    amount NUMERIC(14,2) NOT NULL,
    balance_before NUMERIC(14,2) NOT NULL,
    balance_after NUMERIC(14,2) NOT NULL,
    description TEXT,
    cashier_name VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, mutation_code)
);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Wallet Transactions" ON public.wallet_transactions;
CREATE POLICY "Public Read Wallet Transactions" ON public.wallet_transactions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin All Wallet Transactions" ON public.wallet_transactions;
CREATE POLICY "Admin All Wallet Transactions" ON public.wallet_transactions FOR ALL USING (true);

-- 4. TABEL CASHIER_CLOSINGS (Buku Tutup Kasir & Rekonsiliasi Kas Harian)
CREATE TABLE IF NOT EXISTS public.cashier_closings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    closing_code VARCHAR(50) NOT NULL,
    closing_date DATE NOT NULL,
    cashier_name VARCHAR(100) NOT NULL,
    initial_cash NUMERIC(14,2) DEFAULT 0,
    cash_in NUMERIC(14,2) DEFAULT 0,
    transfer_in NUMERIC(14,2) DEFAULT 0,
    qris_in NUMERIC(14,2) DEFAULT 0,
    cash_out NUMERIC(14,2) DEFAULT 0,
    system_balance NUMERIC(14,2) DEFAULT 0,
    physical_balance NUMERIC(14,2) DEFAULT 0,
    discrepancy NUMERIC(14,2) DEFAULT 0,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'CLOSED',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, closing_code)
);

ALTER TABLE public.cashier_closings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Closings" ON public.cashier_closings;
CREATE POLICY "Public Read Closings" ON public.cashier_closings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin All Closings" ON public.cashier_closings;
CREATE POLICY "Admin All Closings" ON public.cashier_closings FOR ALL USING (true);

-- 5. TABEL PPDB_REGISTRATIONS (Penerimaan Peserta Didik Baru)
CREATE TABLE IF NOT EXISTS public.ppdb_registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    registration_no VARCHAR(50),
    name VARCHAR(150) NOT NULL,
    nisn VARCHAR(50),
    guardian_name VARCHAR(150),
    whatsapp VARCHAR(50),
    program VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending',
    registration_date TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, nisn)
);

ALTER TABLE public.ppdb_registrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read PPDB" ON public.ppdb_registrations;
CREATE POLICY "Public Read PPDB" ON public.ppdb_registrations FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin All PPDB" ON public.ppdb_registrations;
CREATE POLICY "Admin All PPDB" ON public.ppdb_registrations FOR ALL USING (true);

-- 6. TABEL ACTIVITY_SCHEDULES (Jadwal Kegiatan Harian Santri)
CREATE TABLE IF NOT EXISTS public.activity_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    schedule_id VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    type VARCHAR(50) DEFAULT 'Harian',
    time_range VARCHAR(100),
    tag VARCHAR(50),
    description TEXT,
    order_index INT DEFAULT 0,
    status VARCHAR(30) DEFAULT 'Aktif',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, schedule_id)
);

ALTER TABLE public.activity_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Schedules" ON public.activity_schedules;
CREATE POLICY "Public Read Schedules" ON public.activity_schedules FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin All Schedules" ON public.activity_schedules;
CREATE POLICY "Admin All Schedules" ON public.activity_schedules FOR ALL USING (true);

-- 7. TABEL ROLES_PERMISSIONS (Konfigurasi RBAC Peran Lembaga)
CREATE TABLE IF NOT EXISTS public.roles_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    role_key VARCHAR(50) NOT NULL,
    role_name VARCHAR(100) NOT NULL,
    total_active INT DEFAULT 0,
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_by VARCHAR(100) DEFAULT 'SYSTEM',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, role_key)
);

ALTER TABLE public.roles_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Roles Permissions" ON public.roles_permissions;
CREATE POLICY "Public Read Roles Permissions" ON public.roles_permissions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin All Roles Permissions" ON public.roles_permissions;
CREATE POLICY "Admin All Roles Permissions" ON public.roles_permissions FOR ALL USING (true);

-- ====================================================================
-- SEED DATA 1: FINANCIAL TARIFFS (6 Master Tarif Resmi)
-- ====================================================================
`;

tarifs.forEach(t => {
  sql += `INSERT INTO public.financial_tariffs (tenant_id, tariff_id, name, category, period_type, amount, program, is_active, created_at)
VALUES (
    '${TENANT_ID}',
    ${escapeSql(t.tarifId)},
    ${escapeSql(t.namaPos)},
    ${escapeSql(t.kategori)},
    ${escapeSql(t.tipePeriode)},
    ${Number(t.nominalDefault) || 0},
    ${escapeSql(t.program || 'SEMUA')},
    ${t.isActive !== false ? 'true' : 'false'},
    ${escapeSql(t.createdAt || new Date().toISOString())}
)
ON CONFLICT (tenant_id, tariff_id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    period_type = EXCLUDED.period_type,
    amount = EXCLUDED.amount,
    program = EXCLUDED.program,
    is_active = EXCLUDED.is_active;

`;
});

sql += `
-- ====================================================================
-- SEED DATA 2: STUDENT WALLETS (Inisialisasi 51 Dompet Santri)
-- ====================================================================
`;

accounts.forEach(a => {
  sql += `INSERT INTO public.student_wallets (tenant_id, student_id, student_code, balance, daily_limit, daily_spent, last_spent_date, is_locked, updated_at)
SELECT 
    '${TENANT_ID}',
    s.id,
    ${escapeSql(a.studentId)},
    ${Number(a.saldoTabungan) || 0},
    ${Number(a.limitHarian) || 25000},
    ${Number(a.totalJajanHariIni) || 0},
    NULL,
    ${a.isLocked ? 'true' : 'false'},
    NOW()
FROM public.students s
WHERE s.student_id = ${escapeSql(a.studentId)} AND s.tenant_id = '${TENANT_ID}'
ON CONFLICT (tenant_id, student_id) DO UPDATE SET
    student_code = EXCLUDED.student_code,
    daily_limit = EXCLUDED.daily_limit,
    is_locked = EXCLUDED.is_locked;

`;
});

sql += `
-- ====================================================================
-- SEED DATA 3: ACTIVITY SCHEDULES (25 Jadwal Kegiatan Harian & Mingguan)
-- ====================================================================
`;

jadwalList.forEach(j => {
  sql += `INSERT INTO public.activity_schedules (tenant_id, schedule_id, name, type, time_range, tag, description, order_index, status, created_at)
VALUES (
    '${TENANT_ID}',
    ${escapeSql(j.id)},
    ${escapeSql(j.nama)},
    ${escapeSql(j.tipe || 'Harian')},
    ${escapeSql(j.waktu)},
    ${escapeSql(j.tag)},
    ${escapeSql(j.deskripsi)},
    ${Number(j.urutan) || 0},
    ${escapeSql(j.status || 'Aktif')},
    ${escapeSql(j.timestamp || new Date().toISOString())}
)
ON CONFLICT (tenant_id, schedule_id) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    time_range = EXCLUDED.time_range,
    tag = EXCLUDED.tag,
    description = EXCLUDED.description,
    order_index = EXCLUDED.order_index,
    status = EXCLUDED.status;

`;
});

sql += `
-- ====================================================================
-- SEED DATA 4: ROLES & PERMISSIONS RBAC MATRIX (7 Peran Resmi)
-- ====================================================================
`;

rolePermissions.forEach(r => {
  sql += `INSERT INTO public.roles_permissions (tenant_id, role_key, role_name, total_active, permissions, updated_by, updated_at)
VALUES (
    '${TENANT_ID}',
    ${escapeSql(r.roleKey)},
    ${escapeSql(r.roleName)},
    ${r.totalActive},
    ${escapeSql(JSON.stringify(r.permissions))}::jsonb,
    'SYSTEM_MIGRATION',
    NOW()
)
ON CONFLICT (tenant_id, role_key) DO UPDATE SET
    role_name = EXCLUDED.role_name,
    total_active = EXCLUDED.total_active,
    permissions = EXCLUDED.permissions,
    updated_at = NOW();

`;
});

const outputPath = path.join(__dirname, '../database/migrations/08_create_and_sync_wallets_kasir_ppdb.sql');
fs.writeFileSync(outputPath, sql, 'utf8');
console.log('Successfully generated SQL migration 08 to: ' + outputPath);
console.log('Total Tarifs:', tarifs.length);
console.log('Total Student Wallets:', accounts.length);
console.log('Total Schedules:', jadwalList.length);
console.log('Total Roles:', rolePermissions.length);

