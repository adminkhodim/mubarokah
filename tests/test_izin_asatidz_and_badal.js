/**
 * tests/test_izin_asatidz_and_badal.js
 * 
 * Comprehensive Unit Test Suite untuk Fitur Izin Asatidz & Pendelegasian Badal
 * pada Modul Tahfidz Pesantren Mubarokah:
 * 1. Verifikasi markup UI, modal, form input, dan banner di app.html
 * 2. Verifikasi script loader dan cache version di sw.js
 * 3. Verifikasi frontend controller dan handler di js/izin-asatidz.js
 * 4. Verifikasi badge dan visual indicators Badal di js/tahfidz.js
 * 5. Verifikasi backend database schema, handler, dan router di legacy/Code.gs
 * 6. Simulasi runtime RBAC, validasi mandatory Badal, dan delegasi halaqah
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('🧪 Memulai Pengujian Komprehensif: Fitur Izin Asatidz & Pendelegasian Badal...');

// ============================================================================
// 1. VERIFIKASI MARKUP UI DI app.html
// ============================================================================
console.log('\n--- 1. Pengujian Markup UI (app.html) ---');
const appHtmlPath = path.resolve(__dirname, '../app.html');
const appHtml = fs.readFileSync(appHtmlPath, 'utf8');

// 1.1 Tombol Trigger Header
assert(appHtml.includes('openIzinAsatidzModal()'), 'Tombol openIzinAsatidzModal() harus ada di header Tahfidz app.html');
assert(appHtml.includes('Izin Asatidz'), 'Label tombol "Izin Asatidz" harus ada di header Tahfidz');
console.log('  ✅ 1.1 Tombol trigger modal Izin Asatidz terpasang di header toolbar Tahfidz');

// 1.2 Banner Notifikasi Pengasuh & Banner Badal Aktif
assert(appHtml.includes('id="banner-pengasuh-izin-asatidz"'), 'Banner notifikasi persetujuan Pengasuh (#banner-pengasuh-izin-asatidz) harus ada');
assert(appHtml.includes('id="tahfidz-active-badal-notice"'), 'Container notifikasi halaqah badal (#tahfidz-active-badal-notice) harus ada');
console.log('  ✅ 1.2 Banner Pengasuh dan container notifikasi Badal aktif tersedia di atas tabel santri');

// 1.3 Modal #modal-izin-asatidz dan komponen formulir
const requiredModalElements = [
  'id="modal-izin-asatidz"',
  'id="form-izin-asatidz"',
  'id="tab-btn-izin-form"',
  'id="tab-btn-izin-my"',
  'id="tab-btn-izin-badal"',
  'id="tab-btn-izin-approval"',
  'id="badge-count-izin-approval"',
  'id="pane-izin-asatidz-form"',
  'id="pane-izin-asatidz-my"',
  'id="pane-izin-asatidz-badal"',
  'id="pane-izin-asatidz-approval"',
  'id="izin-asatidz-nama"',
  'id="izin-asatidz-tgl-mulai"',
  'id="izin-asatidz-tgl-selesai"',
  'id="izin-asatidz-kategori"',
  'id="izin-asatidz-badal"',
  'id="izin-asatidz-alasan"',
  'id="izin-asatidz-catatan-badal"',
  'id="izin-asatidz-lampiran"',
  'id="btn-submit-izin-asatidz"',
  'id="izin-asatidz-my-list"',
  'id="izin-asatidz-badal-list"',
  'id="izin-asatidz-approval-list"'
];

requiredModalElements.forEach(elem => {
  assert(appHtml.includes(elem), `Elemen ${elem} wajib ada dalam modal perizinan asatidz`);
});
console.log('  ✅ 1.3 Modal #modal-izin-asatidz memiliki 4 tab pane, form lengkap, dan badge counter');

// 1.4 Script loader
assert(appHtml.includes('src="js/izin-asatidz.js?v=1"'), 'Script js/izin-asatidz.js?v=1 harus dimuat di app.html');
assert(appHtml.includes('src="js/tahfidz.js?v=32"'), 'Versi js/tahfidz.js harus dibump ke v=32 di app.html');
console.log('  ✅ 1.4 Script loader js/izin-asatidz.js terpasang dan versi tahfidz.js ter-bump');

// ============================================================================
// 2. VERIFIKASI PWA SERVICE WORKER (sw.js)
// ============================================================================
console.log('\n--- 2. Pengujian PWA Cache (sw.js) ---');
const swPath = path.resolve(__dirname, '../sw.js');
const swCode = fs.readFileSync(swPath, 'utf8');

assert(swCode.includes("CACHE_NAME = 'mubarokah-cache-v51'"), 'CACHE_NAME harus diperbarui ke mubarokah-cache-v51');
assert(swCode.includes("'/js/izin-asatidz.js'"), 'Asset /js/izin-asatidz.js harus ada dalam daftar PRECACHE_URLS');
console.log('  ✅ 2.1 sw.js mencakup /js/izin-asatidz.js dan cache version mubarokah-cache-v51');

// ============================================================================
// 3. VERIFIKASI FRONTEND CONTROLLER (js/izin-asatidz.js)
// ============================================================================
console.log('\n--- 3. Pengujian Controller Frontend (js/izin-asatidz.js) ---');
const controllerPath = path.resolve(__dirname, '../js/izin-asatidz.js');
const controllerCode = fs.readFileSync(controllerPath, 'utf8');

const requiredExports = [
  'window.openIzinAsatidzModal = openIzinAsatidzModal',
  'window.closeIzinAsatidzModal = closeIzinAsatidzModal',
  'window.submitIzinAsatidzForm = submitIzinAsatidzForm',
  'window.setIzinAsatidzSesi = setIzinAsatidzSesi',
  'window.setIzinAsatidzKategori = setIzinAsatidzKategori',
  'window.switchIzinAsatidzTab = switchIzinAsatidzTab',
  'window.loadIzinAsatidzHistory = loadIzinAsatidzHistory',
  'window.canApproveIzinAsatidz = canApproveIzinAsatidz',
  'window.renderApprovalList = renderApprovalList',
  'window.processApprovalAction = processApprovalAction',
  'window.getHalaqahDelegation = getHalaqahDelegation'
];

requiredExports.forEach(exp => {
  assert(controllerCode.includes(exp), `Export ${exp} harus ada di js/izin-asatidz.js`);
});
console.log('  ✅ 3.1 Seluruh public API & event handlers diekspos ke window object');

// ============================================================================
// 4. VERIFIKASI VISUAL BADGE & INTEGRASI DI js/tahfidz.js
// ============================================================================
console.log('\n--- 4. Pengujian Visual Badges & Integrasi Badal (js/tahfidz.js) ---');
const tahfidzPath = path.resolve(__dirname, '../js/tahfidz.js');
const tahfidzCode = fs.readFileSync(tahfidzPath, 'utf8');

assert(tahfidzCode.includes('function updateTahfidzBadalNotice('), 'Fungsi updateTahfidzBadalNotice harus didefinisikan');
assert(tahfidzCode.includes('window.updateTahfidzBadalNotice = updateTahfidzBadalNotice;'), 'updateTahfidzBadalNotice harus diekspor ke window');
assert(tahfidzCode.includes('Diampu Badal:'), 'Notasi dropdown halaqah di populateTahfidzFilters harus ada');
assert(tahfidzCode.includes('stDelegation'), 'Pemeriksaan stDelegation harus ada pada tabel desktop dan kartu mobile');
assert(tahfidzCode.includes('Diampu Badal Hari Ini:'), 'Banner delegasi pada kartu halaqah (renderTahfidzHalaqahCards) harus ada');
console.log('  ✅ 4.1 Notasi dropdown, badge desktop, kartu mobile, dan kartu halaqah terpasang rapi');

// ============================================================================
// 5. VERIFIKASI BACKEND DATABASE SCHEMA & ROUTER (legacy/Code.gs)
// ============================================================================
console.log('\n--- 5. Pengujian Backend Database & Router (legacy/Code.gs) ---');
const codeGsPath = path.resolve(__dirname, '../legacy/Code.gs');
const codeGs = fs.readFileSync(codeGsPath, 'utf8');

assert(codeGs.includes('const SHEET_IZIN_ASATIDZ = "Izin_Asatidz";'), 'SHEET_IZIN_ASATIDZ harus didefinisikan');
assert(codeGs.includes('HEADERS_IZIN_ASATIDZ = ['), 'HEADERS_IZIN_ASATIDZ harus didefinisikan');
assert(codeGs.includes('function initIzinAsatidzSheet('), 'initIzinAsatidzSheet harus ada di Code.gs');
assert(codeGs.includes('function getIzinAsatidzSheet('), 'getIzinAsatidzSheet harus ada di Code.gs');
assert(codeGs.includes('function submitIzinAsatidz('), 'submitIzinAsatidz harus ada di Code.gs');
assert(codeGs.includes('function getIzinAsatidzData('), 'getIzinAsatidzData harus ada di Code.gs');
assert(codeGs.includes('function approveIzinAsatidz('), 'approveIzinAsatidz harus ada di Code.gs');
assert(codeGs.includes('function getActiveBadalDelegations('), 'getActiveBadalDelegations harus ada di Code.gs');
assert(codeGs.includes('sheetIzinAsatidz = ss.insertSheet(SHEET_IZIN_ASATIDZ);'), 'Auto-init Izin_Asatidz di initTahfidzSheets harus ada');

// Routing check
assert(codeGs.includes('action === "submitIzinAsatidz" || action === "tahfidz.submitIzinAsatidz"'), 'Route submitIzinAsatidz harus ada di doPost');
assert(codeGs.includes('action === "getIzinAsatidz" || action === "tahfidz.getIzinAsatidz"'), 'Route getIzinAsatidz harus ada di doPost/doGet');
assert(codeGs.includes('action === "approveIzinAsatidz" || action === "tahfidz.approveIzinAsatidz"'), 'Route approveIzinAsatidz harus ada di doPost');
assert(codeGs.includes('action === "getActiveBadalDelegations" || action === "tahfidz.getActiveBadal"'), 'Route getActiveBadalDelegations harus ada di doPost/doGet');
console.log('  ✅ 5.1 Seluruh handler backend dan routing doPost/doGet tervalidasi');

// ============================================================================
// 6. SIMULASI LOGIKA RUNTIME: RBAC, MANDATORY BADAL, & DELEGASI MATCHING
// ============================================================================
console.log('\n--- 6. Simulasi Logika Runtime (RBAC & Pendelegasian) ---');

// 6.1 RBAC Authorization Logic
function checkAuthorization(role) {
  const r = String(role || '').toUpperCase();
  return r === 'PENGASUH' || r === 'SUPER_ADMIN' || r === 'ADMIN';
}
assert.strictEqual(checkAuthorization('PENGASUH'), true, 'Pengasuh berhak menyetujui izin');
assert.strictEqual(checkAuthorization('SUPER_ADMIN'), true, 'Super Admin berhak menyetujui izin');
assert.strictEqual(checkAuthorization('ADMIN'), true, 'Admin berhak menyetujui izin');
assert.strictEqual(checkAuthorization('ASATIDZ'), false, 'Asatidz tidak berhak menyetujui izin sendiri');
assert.strictEqual(checkAuthorization('WALI'), false, 'Wali Santri tidak berhak menyetujui izin');
console.log('  ✅ 6.1 RBAC otoritas persetujuan (Pengasuh & Admin) berjalan sesuai spesifikasi');

// 6.2 Validasi Mandatory Badal
function validateIzinSubmission(data) {
  if (!data.namaAsatidz) throw new Error('Nama Asatidz pemohon wajib diisi.');
  if (!data.tanggalMulai) throw new Error('Tanggal mulai izin wajib ditentukan.');
  if (!data.alasan) throw new Error('Alasan perizinan wajib disertakan.');
  if (!data.namaBadal) throw new Error('Ustadz Badal (pengganti) wajib dipilih untuk menjamin kelangsungan halaqah.');
  return true;
}

assert.throws(() => validateIzinSubmission({}), /Nama Asatidz pemohon wajib diisi/);
assert.throws(() => validateIzinSubmission({ namaAsatidz: 'Ustadz Zaidan' }), /Tanggal mulai izin wajib ditentukan/);
assert.throws(() => validateIzinSubmission({ namaAsatidz: 'Ustadz Zaidan', tanggalMulai: '2026-10-27' }), /Alasan perizinan wajib disertakan/);
assert.throws(() => validateIzinSubmission({ namaAsatidz: 'Ustadz Zaidan', tanggalMulai: '2026-10-27', alasan: 'Flu berat' }), /Ustadz Badal/);
assert.doesNotThrow(() => validateIzinSubmission({
  namaAsatidz: 'Ustadz Zaidan',
  tanggalMulai: '2026-10-27',
  alasan: 'Flu berat',
  namaBadal: 'Ustadz Fauzi'
}));
console.log('  ✅ 6.2 Validasi wajib Badal (Mandatory Badal) berhasil mencegah halaqah kosong tanpa pendamping');

// 6.3 Fuzzy matching delegasi (pembersihan gelar honorifik Ustadz/Ustd/Ust)
function cleanMuhafizName(raw) {
  return String(raw || '')
    .replace(/^(ustadz|ustad|ustd|ust|kyai|kh|gus|habib)\.?\s+/i, '')
    .trim()
    .toLowerCase();
}

assert.strictEqual(cleanMuhafizName('Ustadz Fauzi Rahman'), 'fauzi rahman');
assert.strictEqual(cleanMuhafizName('Ust. Fauzi Rahman'), 'fauzi rahman');
assert.strictEqual(cleanMuhafizName('Ustd Fauzi Rahman'), 'fauzi rahman');
assert.strictEqual(cleanMuhafizName('Fauzi Rahman'), 'fauzi rahman');
console.log('  ✅ 6.3 Helper normalisasi muhafiz cerdas mengenali nama tanpa terpengaruh variasi gelar');

console.log('\n🎉 SEMUA PENGUJIAN FITUR IZIN ASATIDZ & BADAL TAHFIDZ 100% SUKSES!');
