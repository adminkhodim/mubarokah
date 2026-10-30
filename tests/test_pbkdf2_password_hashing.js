/**
 * tests/test_pbkdf2_password_hashing.js
 * 
 * Verifikasi algoritma hashing password PBKDF2-HMAC-SHA256 untuk Google Apps Script:
 * 1. Menghasilkan format standar PBKDF2$sha256$5000$<saltHex>$<derivedHex>
 * 2. Menggunakan salt acak unik per pengguna (individual salt)
 * 3. Berhasil memverifikasi password PBKDF2 yang benar dan menolak yang salah
 * 4. Mendukung backward-compatibility untuk hash lama SHA-256 dan plaintext
 * 5. Mendeteksi kebutuhan migrasi / auto-upgrade ke PBKDF2
 */

const assert = require('assert');
const crypto = require('crypto');

console.log('🧪 Memulai Pengujian Algoritma Password Hashing PBKDF2...');

// Mock environment Apps Script Utilities & getServerSecret
const Utilities = {
  getUuid: () => crypto.randomUUID(),
  newBlob: (str) => ({
    getBytes: () => Array.from(Buffer.from(str, 'utf8')).map(b => b > 127 ? b - 256 : b)
  }),
  computeHmacSha256Signature: (data, key) => {
    const dataBuf = Buffer.from(data.map(b => b < 0 ? b + 256 : b));
    const keyBuf = typeof key === 'string' ? Buffer.from(key, 'utf8') : Buffer.from(key.map(b => b < 0 ? b + 256 : b));
    const h = crypto.createHmac('sha256', keyBuf);
    h.update(dataBuf);
    return Array.from(h.digest()).map(b => b > 127 ? b - 256 : b);
  },
  computeDigest: (alg, str, charset) => {
    const h = crypto.createHash('sha256');
    h.update(Buffer.from(str, 'utf8'));
    return Array.from(h.digest()).map(b => b > 127 ? b - 256 : b);
  },
  DigestAlgorithm: { SHA_256: 'SHA_256' },
  Charset: { UTF_8: 'UTF_8' }
};

function getServerSecret(key, defaultVal) {
  if (key === 'PASSWORD_SALT') return 'test_legacy_salt_mubarokah_123';
  return defaultVal;
}

// ==================== IMPLEMENTASI GAS PBKDF2 ====================
function computePbkdf2Sha256(password, salt, iterations) {
  iterations = iterations || 5000;
  const saltBytes = Utilities.newBlob(salt).getBytes();
  const saltWithBlock = saltBytes.concat([0, 0, 0, 1]);

  let u = Utilities.computeHmacSha256Signature(saltWithBlock, password);
  let t = u.slice();

  for (let i = 1; i < iterations; i++) {
    u = Utilities.computeHmacSha256Signature(u, password);
    for (let j = 0; j < 32; j++) {
      t[j] ^= u[j];
    }
  }

  return t.map(function(b) {
    return (b < 0 ? b + 256 : b).toString(16).padStart(2, '0');
  }).join('');
}

function constantTimeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= (a.charCodeAt(i) ^ b.charCodeAt(i));
  }
  return diff === 0;
}

function hashLegacyPassword(password) {
  const salt = getServerSecret("PASSWORD_SALT", "");
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(password) + salt, Utilities.Charset.UTF_8);
  return digest.map(function(b) {
    return (b < 0 ? b + 256 : b).toString(16).padStart(2, '0');
  }).join('');
}

function hashPassword(password) {
  const salt = Utilities.getUuid().replace(/-/g, "").substring(0, 16);
  const iters = 5000;
  const derived = computePbkdf2Sha256(String(password), salt, iters);
  return "PBKDF2$sha256$" + iters + "$" + salt + "$" + derived;
}

function verifyPassword(inputPassword, storedPassword) {
  if (!storedPassword || !inputPassword) return false;
  const storedStr = String(storedPassword).trim();

  // 1. Format Standar Kuat: PBKDF2-HMAC-SHA256
  if (storedStr.startsWith("PBKDF2$sha256$")) {
    const parts = storedStr.split("$");
    if (parts.length === 5) {
      const iters = parseInt(parts[2], 10) || 5000;
      const salt = parts[3];
      const expectedKey = parts[4];
      const actualKey = computePbkdf2Sha256(String(inputPassword), salt, iters);
      return constantTimeCompare(actualKey, expectedKey);
    }
  }

  // 2. Backward-Compatibility: Legacy SHA-256 Hash
  const legacyHash = hashLegacyPassword(inputPassword);
  if (constantTimeCompare(legacyHash, storedStr)) {
    return true;
  }

  // 3. Fallback Data Lama: Plain-Text (hanya untuk migrasi awal)
  if (storedStr === String(inputPassword)) {
    return true;
  }

  return false;
}

function isPasswordUpgradeNeeded(storedPassword) {
  if (!storedPassword) return true;
  return !String(storedPassword).trim().startsWith("PBKDF2$sha256$");
}

// ==================== UNIT TESTS ====================

// Test 1: Generate Hash & Format
const testPass = 'RahasiaSantri2026!';
const hash1 = hashPassword(testPass);
const hash2 = hashPassword(testPass);

assert(hash1.startsWith('PBKDF2$sha256$5000$'), 'Hash harus diawali prefix PBKDF2$sha256$5000$');
assert.strictEqual(hash1.split('$').length, 5, 'Hash harus memiliki 5 komponen terpisah $');
assert.notStrictEqual(hash1, hash2, 'Dua hash dari password yang sama harus BERBEDA karena salt individual unik');
console.log('  ✅ 1. Format PBKDF2 & Salt Unik Individual Tervalidasi');

// Test 2: Verifikasi Password Benar & Salah
assert.strictEqual(verifyPassword(testPass, hash1), true, 'Password benar harus lolos verifikasi');
assert.strictEqual(verifyPassword('PasswordSalah123!', hash1), false, 'Password salah harus ditolak');
assert.strictEqual(verifyPassword('', hash1), false, 'Password kosong harus ditolak');
assert.strictEqual(verifyPassword(testPass, ''), false, 'Stored hash kosong harus ditolak');
console.log('  ✅ 2. Verifikasi Password Benar vs Salah Tervalidasi');

// Test 3: Backward Compatibility Legacy SHA-256
const legacyHash = hashLegacyPassword(testPass);
assert.strictEqual(verifyPassword(testPass, legacyHash), true, 'Akun dengan hash SHA-256 lama harus tetap bisa login');
assert.strictEqual(verifyPassword('PasswordSalah123!', legacyHash), false, 'Password salah pada hash lama harus ditolak');
console.log('  ✅ 3. Backward Compatibility Hash SHA-256 Lama Berfungsi');

// Test 4: Backward Compatibility Plaintext
const plaintextPass = 'PlaintextPassLama123';
assert.strictEqual(verifyPassword(plaintextPass, plaintextPass), true, 'Password plaintext lama harus tetap bisa login untuk migrasi');
assert.strictEqual(verifyPassword('Salah', plaintextPass), false, 'Password salah pada plaintext lama harus ditolak');
console.log('  ✅ 4. Backward Compatibility Plaintext Lama Berfungsi');

// Test 5: Deteksi Kebutuhan Upgrade Hash
assert.strictEqual(isPasswordUpgradeNeeded(hash1), false, 'Hash PBKDF2 tidak perlu di-upgrade');
assert.strictEqual(isPasswordUpgradeNeeded(legacyHash), true, 'Hash SHA-256 lama HARUS di-upgrade ke PBKDF2');
assert.strictEqual(isPasswordUpgradeNeeded(plaintextPass), true, 'Plaintext lama HARUS di-upgrade ke PBKDF2');
console.log('  ✅ 5. Deteksi Auto-Upgrade Hash Bekerja Sempurna');

console.log('\n🎉 SEMUA PENGUJIAN PBKDF2 BERHASIL 100% TANPA KESALAHAN!\n');

