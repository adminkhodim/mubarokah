const fs = require('fs');
const path = require('path');

const usersData = JSON.parse(fs.readFileSync(path.join(__dirname, '../migration_data/all_users_from_sheet.json'), 'utf8')).users;
const guardiansData = JSON.parse(fs.readFileSync(path.join(__dirname, '../migration_data/guardians.json'), 'utf8'));

const guardianPwMap = {};
guardiansData.forEach(g => {
  if (g.password_hash) guardianPwMap[g.identity_id] = g.password_hash;
});

function cleanPhone(p) {
  if (!p) return null;
  let s = String(p).replace(/[^0-9+]/g, '');
  if (s.startsWith('62')) s = '+' + s;
  else if (s.startsWith('08')) s = '+628' + s.substring(2);
  else if (!s.startsWith('+') && s.length >= 9) s = '+62' + s;
  return s || null;
}

function escapeSql(str) {
  if (str === null || str === undefined || str === '') return 'NULL';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

let sql = '-- ====================================================================\n';
sql += '-- MIGRATION 05: SINKRONISASI USER IDENTITIES & STUDENT GUARDIANS\n';
sql += '-- Target Tenant : PPTQ Roudlotul Mubarokah (baa9eb9b-2d87-4648-a674-059bb289cb63)\n';
sql += '-- Sumber Data   : Google Spreadsheet [OFFICIAL] (Sheet: Users & Wali_Santri_Map)\n';
sql += '-- ====================================================================\n\n';

sql += '-- 1. UPSERT SELURUH AKUN PENGGUNA (USERS -> USER_IDENTITIES)\n';
sql += 'INSERT INTO public.user_identities (\n';
sql += '  tenant_id,\n';
sql += '  identity_id,\n';
sql += '  email,\n';
sql += '  phone,\n';
sql += '  name,\n';
sql += '  role,\n';
sql += '  status,\n';
sql += '  photo_url,\n';
sql += '  password_hash,\n';
sql += '  last_login_at,\n';
sql += '  last_seen_at,\n';
sql += '  device_info\n';
sql += ') VALUES\n';

const userValues = usersData.map(u => {
  const id = u.identityId || u.userId;
  const pw = u.passwordHash || u.password_hash || guardianPwMap[id] || null;
  const phone = cleanPhone(u.phone);
  const email = u.email ? String(u.email).trim().toLowerCase() : null;
  const photo = u.photoUrl || u.photo_url || null;
  const lastLogin = u.lastLoginAt || u.last_login_at || null;
  const lastSeen = u.lastSeenAt || u.last_seen_at || null;
  const dev = u.deviceInfo || u.device_info || null;

  return `(\n` +
    `  'baa9eb9b-2d87-4648-a674-059bb289cb63',\n` +
    `  ${escapeSql(id)},\n` +
    `  ${escapeSql(email)},\n` +
    `  ${escapeSql(phone)},\n` +
    `  ${escapeSql(u.name)},\n` +
    `  ${escapeSql(u.role)},\n` +
    `  'ACTIVE',\n` +
    `  ${escapeSql(photo)},\n` +
    `  ${escapeSql(pw)},\n` +
    `  ${lastLogin ? escapeSql(lastLogin) : 'NULL'},\n` +
    `  ${lastSeen ? escapeSql(lastSeen) : 'NULL'},\n` +
    `  ${escapeSql(dev)}\n` +
    `)`;
});

sql += userValues.join(',\n') + '\n';
sql += 'ON CONFLICT (tenant_id, identity_id) DO UPDATE SET\n';
sql += '  email = EXCLUDED.email,\n';
sql += '  phone = EXCLUDED.phone,\n';
sql += '  name = EXCLUDED.name,\n';
sql += '  role = EXCLUDED.role,\n';
sql += '  status = EXCLUDED.status,\n';
sql += '  photo_url = COALESCE(EXCLUDED.photo_url, public.user_identities.photo_url),\n';
sql += '  password_hash = COALESCE(EXCLUDED.password_hash, public.user_identities.password_hash),\n';
sql += '  last_login_at = COALESCE(EXCLUDED.last_login_at, public.user_identities.last_login_at),\n';
sql += '  last_seen_at = COALESCE(EXCLUDED.last_seen_at, public.user_identities.last_seen_at),\n';
sql += '  device_info = COALESCE(EXCLUDED.device_info, public.user_identities.device_info),\n';
sql += '  updated_at = NOW();\n\n';

sql += '-- 2. SINKRONISASI RELASI WALI & SANTRI (WALI_SANTRI_MAP -> STUDENT_GUARDIANS)\n';
sql += 'INSERT INTO public.student_guardians (\n';
sql += '  tenant_id,\n';
sql += '  guardian_id,\n';
sql += '  student_id,\n';
sql += '  relationship,\n';
sql += '  is_primary\n';
sql += ') VALUES\n';

const mapEntries = [];
usersData.forEach(u => {
  if (u.linkedStudents && u.linkedStudents.length > 0) {
    u.linkedStudents.forEach(s => {
      const rel = (s.relationship === 'MOTHER' || s.relationship === 'FATHER') ? s.relationship : 'GUARDIAN';
      mapEntries.push(
        `(\n` +
        `  'baa9eb9b-2d87-4648-a674-059bb289cb63',\n` +
        `  (SELECT id FROM public.guardians WHERE identity_id = ${escapeSql(u.userId)} AND tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'),\n` +
        `  (SELECT id FROM public.students WHERE student_id = ${escapeSql(s.studentId)} AND tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'),\n` +
        `  ${escapeSql(rel)},\n` +
        `  true\n` +
        `)`
      );
    });
  }
});

sql += mapEntries.join(',\n') + '\n';
sql += 'ON CONFLICT (tenant_id, guardian_id, student_id) DO UPDATE SET\n';
sql += '  relationship = EXCLUDED.relationship,\n';
sql += '  is_primary = EXCLUDED.is_primary;\n';

const outPath = path.join(__dirname, '../database/migrations/05_migrate_users_and_student_guardians.sql');
fs.writeFileSync(outPath, sql);
console.log('✅ Generated migration SQL at:', outPath);

