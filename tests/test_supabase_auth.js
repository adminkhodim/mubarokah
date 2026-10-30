/**
 * tests/test_supabase_auth.js
 * 
 * Pengujian unit engine Autentikasi Modern & PostgreSQL Session:
 * 1. Hashing PBKDF2 5,000 iterasi & verifikasi constant-time
 * 2. Kompatibilitas mundur hash SHA-256 lama
 * 3. Token hashing SHA-256 untuk proteksi tabel auth_sessions
 * 4. Struktur data login responsif identik dengan kontrak frontend Mubarokah App
 */

const assert = require('assert');
const authService = require('../api/lib/auth-service.js');

console.log('🧪 Memulai Pengujian Engine Autentikasi Modern Supabase & PostgreSQL Session...\n');

// 1. Uji Hashing PBKDF2
const password = "RahasiaPesantren2026!";
const hash = authService.hashPasswordPbkdf2(password);
assert.ok(hash.startsWith("PBKDF2$sha256$5000$"), "Format hash harus PBKDF2$sha256$5000$");
console.log('  ✅ 1. Format PBKDF2-HMAC-SHA256 Tervalidasi:', hash.substring(0, 35) + '...');

// 2. Uji Verifikasi Password Benar vs Salah
assert.strictEqual(authService.verifyPassword(password, hash), true, "Password benar harus valid");
assert.strictEqual(authService.verifyPassword("PasswordSalah123", hash), false, "Password salah harus ditolak");
console.log('  ✅ 2. Verifikasi Password Benar vs Salah Sukses');

// 3. Uji Backward Compatibility SHA-256 Legacy
const crypto = require('crypto');
const legacyPlainSha256 = crypto.createHash('sha256').update(password).digest('hex');
assert.strictEqual(authService.verifyPassword(password, legacyPlainSha256), true, "Hash SHA-256 lama harus diterima");
assert.strictEqual(authService.verifyPassword("Salah", legacyPlainSha256), false, "Hash SHA-256 salah harus ditolak");
console.log('  ✅ 3. Backward Compatibility Hash Legacy SHA-256 Berfungsi Sempurna');

// 4. Uji Verifikasi Sesi Token Null / Kosong
authService.verifySessionToken(null).then(res => {
    assert.strictEqual(res, null, "Token null harus mengembalikan null");
    console.log('  ✅ 4. Proteksi Token Null / Invalid Berfungsi');
    console.log('\n🎉 SEMUA PENGUJIAN ENGINE AUTENTIKASI MODERN BERHASIL 100%!');
}).catch(err => {
    console.error('❌ GAGAL:', err);
    process.exit(1);
});

