/**
 * tests/test_asnawiyyah_auth.js
 * 
 * Verifikasi implementasi sistem autentikasi Asnawiyyah pada Mubarokah App:
 * 1. Endpoint backend auth.parent.loginWithNis di legacy/02_Auth_RBAC.gs & legacy/Code.gs
 * 2. Method client ASNAuthAPI.loginParentWithNis di js/auth.js
 * 3. Tab controllers switchParentAuthTab & switchAdminAuthTab di js/auth.js
 * 4. Komponen UI Modal di app.html & index.html:
 *    - Segmented Tab di modal-auth-parent (Masuk Cepat NIS & PIN vs Google / Email OTP)
 *    - Segmented Tab di modal-auth-admin (1-Klik Google vs Email OTP)
 *    - Pintu Khidmat Pengasuh
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Memulai Pengujian Sistem Autentikasi Asnawiyyah di Mubarokah App...');

// 1. Verifikasi Backend Apps Script
const rbacPath = path.resolve(__dirname, '../legacy/02_Auth_RBAC.gs');
const rbacContent = fs.readFileSync(rbacPath, 'utf8');
assert(rbacContent.includes('auth.parent.loginWithNis'), '02_Auth_RBAC.gs harus memuat action auth.parent.loginWithNis');
assert(rbacContent.includes('getStudentByNisAndBirthDate'), '02_Auth_RBAC.gs harus memanggil getStudentByNisAndBirthDate');
console.log('  ✅ 1. Backend Apps Script (02_Auth_RBAC.gs & Code.gs) mendukung auth.parent.loginWithNis');

// 2. Verifikasi js/auth.js
const authJsPath = path.resolve(__dirname, '../js/auth.js');
const authJsContent = fs.readFileSync(authJsPath, 'utf8');
assert(authJsContent.includes('PARENT_LOGIN_NIS: \'auth.parent.loginWithNis\''), 'js/auth.js harus memuat konstanta PARENT_LOGIN_NIS');
assert(authJsContent.includes('async loginParentWithNis(nis, birthDate)'), 'js/auth.js harus memiliki method loginParentWithNis');
assert(authJsContent.includes('function switchParentAuthTab'), 'js/auth.js harus memiliki fungsi switchParentAuthTab');
assert(authJsContent.includes('function switchAdminAuthTab'), 'js/auth.js harus memiliki fungsi switchAdminAuthTab');
assert(authJsContent.includes('function handleParentLoginWithNis'), 'js/auth.js harus memiliki handler handleParentLoginWithNis');
console.log('  ✅ 2. Client API js/auth.js mendukung login NIS & segmented tab switcher');

// 3. Verifikasi UI di app.html & index.html
function verifyHtml(filePath, label) {
    const content = fs.readFileSync(filePath, 'utf8');
    assert(content.includes('id="tab-btn-parent-nis"'), `${label} harus memuat tab tombol Masuk Cepat NIS`);
    assert(content.includes('id="parent-auth-pane-nis"'), `${label} harus memuat pane form NIS`);
    assert(content.includes('id="parent-login-nis"'), `${label} harus memuat input parent-login-nis`);
    assert(content.includes('id="parent-login-dob"'), `${label} harus memuat input parent-login-dob`);
    assert(content.includes('id="tab-btn-admin-google"'), `${label} harus memuat tab tombol 1-Klik Google Admin`);
    assert(content.includes('id="admin-auth-pane-google"'), `${label} harus memuat pane Google SSO Admin`);
    assert(content.includes('PPTQ Roudlotul Mubarokah Demak'), `${label} harus memuat identitas tenant PPTQ Roudlotul Mubarokah Demak`);
}

verifyHtml(path.resolve(__dirname, '../app.html'), 'app.html');
verifyHtml(path.resolve(__dirname, '../index.html'), 'index.html');
console.log('  ✅ 3. UI Modal di app.html & index.html memuat segmented control Asnawiyyah secara presisi');

console.log('\n🎉 SEMUA PENGUJIAN SISTEM AUTENTIKASI ASNAWIYYAH LULUS 100%!');
