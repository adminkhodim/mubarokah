/**
 * ============================================================================
 * 00_Config_Security.gs
 * PPTQ Roudlotul Mubarokah Backend Architecture - Configuration, Security & Core Helpers
 * ============================================================================
 * Tanggung Jawab Domain:
 *  - Error Classes & Response Envelopes (createJsonResponse, formatDate)
 *  - Tenant Configuration & Script Properties Secrets (getTenantConfig_, getServerSecret, etc.)
 *  - Session TTL Configuration, HMAC Token Generation & Verification
 *  - Password Hashing & Verification (PBKDF2 SHA-256)
 *  - LockService Concurrency & Security Audit Log
 *  - Secure OTP Utilities & Hash
 *  - Database Spreadsheet Accessor & Base Sheet Schemas
 * ============================================================================
 */


/**
 * ====================================================================
 * TENANT CONFIGURATION & IDENTITY BOUNDARY (MUBAROKAH APP)
 * ====================================================================
 * Production tenant identifiers and secrets are injected via
 * Google Apps Script Script Properties:
 * - DRIVE_FOLDER_ID: Root upload folder ID
 * - DRIVE_FOLDER_USER_PHOTOS: User/Pegawai photos folder ID
 * - DRIVE_FOLDER_STUDENT_PHOTOS: Santri photos folder ID
 * - AUTH_TOKEN_SIGNING_SECRET: Primary token HMAC signing secret
 * - TOKEN_SIGNING_SECRET: Legacy token HMAC signing secret
 * - OTP_HASH_SECRET: OTP hash salt/secret
 * - IDENTIFIER_HASH_SECRET: Identifier hash salt/secret
 * - PASSWORD_SALT: User password hashing salt
 * - ADMIN_PIN_HASH: Admin login PIN hash
 * 
 * In unconfigured state, functions fall back to safe empty placeholders:
 * "__MUBAROKAH_CONFIG_PENDING__"
 */
function getTenantConfig_() {
  try {
    const props = PropertiesService.getScriptProperties();
    return {
      tenantId: "mubarokah",
      driveRootFolderId: props.getProperty("DRIVE_FOLDER_ID") || "",
      driveUserPhotosFolderId: props.getProperty("DRIVE_FOLDER_USER_PHOTOS") || "",
      driveStudentPhotosFolderId: props.getProperty("DRIVE_FOLDER_STUDENT_PHOTOS") || ""
    };
  } catch (e) {
    return {
      tenantId: "mubarokah",
      driveRootFolderId: "",
      driveUserPhotosFolderId: "",
      driveStudentPhotosFolderId: ""
    };
  }
}


// Helper untuk membuat response bertipe JSON dengan dukungan CORS
function createJsonResponse(data) {
  return ContentService
    .createTextOutput(
      JSON.stringify(data)
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );
}

// Helper format tanggal agar lebih rapi dibaca di Indonesia


function formatDate(dateString) {
  try {
    const d = new Date(dateString);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return d.toLocaleDateString('id-ID', options);
  } catch (e) {
    return dateString;
  }
}

const FOLDER_ID = (function() {
  try { return PropertiesService.getScriptProperties().getProperty("DRIVE_FOLDER_ID") || ""; } catch (e) { return ""; }
})(); // __MUBAROKAH_CONFIG_PENDING__
const SHEET_NAME = "Berita"; // Sesuaikan nama tab sheet


function getServerSecret(key, defaultValue = "") {
  try {
    const props = PropertiesService.getScriptProperties();
    let val = props ? props.getProperty(key) : null;
    
    // Self-healing: jika secret kunci token belum disetel di ScriptProperties,
    // generate secret kriptografis otomatis dan simpan ke ScriptProperties
    if (!val) {
      if (key === "AUTH_TOKEN_SIGNING_SECRET" || key === "TOKEN_SIGNING_SECRET") {
        val = "sec_auth_" + Utilities.getUuid().replace(/-/g, "") + "_" + new Date().getTime();
        if (props) {
          try {
            props.setProperty(key, val);
            console.log("[SECURITY] Berhasil menginisialisasi otomatis secret kriptografis untuk " + key);
          } catch (e) {}
        }
      }
    }
    
    return val || defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

/**
 * Setup Script Security Properties Helper
 * Jalankan fungsi ini satu kali dari Google Apps Script Editor untuk mengonfigurasi
 * secret key unik dan versi token secara otomatis ke PropertiesService.
 */
function setupScriptSecurityProperties(customSecret, customVersion) {
  try {
    const props = PropertiesService.getScriptProperties();
    const newSecret = customSecret || ("SEC_" + Utilities.getUuid().replace(/-/g, "") + "_" + new Date().getTime());
    const newVersion = customVersion || "1";
    
    props.setProperty("AUTH_TOKEN_SIGNING_SECRET", newSecret);
    props.setProperty("TOKEN_SIGNING_SECRET", newSecret);
    props.setProperty("TOKEN_VERSION", String(newVersion));
    props.setProperty("SPREADSHEET_ID", "1cZSRh2rtKpT6E8m3GFJonVbiQG51fh24eN8J5JWtOJY");
    props.setProperty("OTP_HASH_SECRET", newSecret.substring(0, 32));
    props.setProperty("IDENTIFIER_HASH_SECRET", newSecret.substring(0, 32));
    props.setProperty("PASSWORD_SALT", newSecret.substring(0, 32));
    
    Logger.log("✅ Script Security Properties berhasil dikonfigurasi!");
    Logger.log("AUTH_TOKEN_SIGNING_SECRET & TOKEN_SIGNING_SECRET telah disetel.");
    Logger.log("TOKEN_VERSION: " + newVersion);
    
    return {
      status: "success",
      message: "Security properties configured successfully",
      tokenVersion: newVersion
    };
  } catch (err) {
    Logger.log("❌ Gagal mengonfigurasi Script Properties: " + err.message);
    throw err;
  }
}

/**
 * Audit Konfigurasi Keamanan Script
 * Mengecek apakah TOKEN_SIGNING_SECRET dan kunci rahasia Phase 2B sudah terisolasi dan disetel.
 */
function auditSecurityConfig() {
  const props = PropertiesService.getScriptProperties();
  const legacySecret = props ? props.getProperty("TOKEN_SIGNING_SECRET") : null;
  const authSecret = props ? props.getProperty("AUTH_TOKEN_SIGNING_SECRET") : null;
  const otpSecret = props ? props.getProperty("OTP_HASH_SECRET") : null;
  const idSecret = props ? props.getProperty("IDENTIFIER_HASH_SECRET") : null;
  const salt = props ? props.getProperty("PASSWORD_SALT") : null;
  const version = props ? props.getProperty("TOKEN_VERSION") : null;
  
  const isLegacyDefault = !legacySecret;
  const isPhase2BConfigured = Boolean(authSecret && otpSecret && idSecret && salt);
  
  return {
    status: (isLegacyDefault || !isPhase2BConfigured) ? "warning" : "ok",
    legacyAuth: {
      isConfigured: !!legacySecret,
      isUsingFallback: isLegacyDefault
    },
    phase2B: {
      isConfigured: isPhase2BConfigured,
      hasAuthTokenSecret: !!authSecret,
      hasOtpHashSecret: !!otpSecret,
      hasIdentifierHashSecret: !!idSecret,
      hasPasswordSalt: !!salt,
      tokenVersion: version || "1"
    },
    recommendation: !isPhase2BConfigured
      ? "Jalankan setupPhase2BScriptProperties() di Script Editor untuk mengonfigurasi rahasia Phase 2B secara otomatis tanpa mengganggu legacy auth."
      : "Seluruh kunci rahasia terisolasi dan token version aktif."
  };
}

/**
 * Setup Script Security Properties Phase 2B (Non-destructive Isolation)
 * Menginisialisasi kunci rahasia mandiri untuk Phase 2B:
 * - AUTH_TOKEN_SIGNING_SECRET
 * - OTP_HASH_SECRET
 * - IDENTIFIER_HASH_SECRET
 * - PASSWORD_SALT
 * - TOKEN_VERSION
 * Menjaga dan TIDAK merotasi TOKEN_SIGNING_SECRET legacy yang sedang berjalan.
 * Fungsi ini HANYA dapat dijalankan manual oleh Administrator (bukan via HTTP request).
 */
function setupPhase2BScriptProperties(forceRegenerate = false) {
  try {
    const props = PropertiesService.getScriptProperties();
    if (!props) throw new Error("PropertiesService tidak dapat diakses.");

    // 1. Pastikan legacy secret tetap ada dan tidak diubah jika sudah ada
    let legacySecret = props.getProperty("TOKEN_SIGNING_SECRET");
    if (!legacySecret) {
      legacySecret = "MUB_LEGACY_" + Utilities.getUuid().replace(/-/g, "");
      props.setProperty("TOKEN_SIGNING_SECRET", legacySecret);
    }

    // 2. Inisialisasi AUTH_TOKEN_SIGNING_SECRET
    let authSecret = props.getProperty("AUTH_TOKEN_SIGNING_SECRET");
    if (!authSecret || forceRegenerate) {
      authSecret = "MUB_AUTH_" + Utilities.getUuid().replace(/-/g, "") + "_" + Date.now();
      props.setProperty("AUTH_TOKEN_SIGNING_SECRET", authSecret);
    }

    // 3. Inisialisasi OTP_HASH_SECRET
    let otpSecret = props.getProperty("OTP_HASH_SECRET");
    if (!otpSecret || forceRegenerate) {
      otpSecret = "MUB_OTP_" + Utilities.getUuid().replace(/-/g, "") + "_" + Date.now();
      props.setProperty("OTP_HASH_SECRET", otpSecret);
    }

    // 4. Inisialisasi IDENTIFIER_HASH_SECRET (P1-5 terisolasi dari PASSWORD_SALT)
    let idSecret = props.getProperty("IDENTIFIER_HASH_SECRET");
    if (!idSecret || forceRegenerate) {
      idSecret = "MUB_ID_" + Utilities.getUuid().replace(/-/g, "") + "_" + Date.now();
      props.setProperty("IDENTIFIER_HASH_SECRET", idSecret);
    }

    // 5. Inisialisasi PASSWORD_SALT (tetap aman untuk legacy auth jika sudah ada)
    let salt = props.getProperty("PASSWORD_SALT");
    if (!salt || forceRegenerate) {
      salt = "MUB_SALT_" + Utilities.getUuid().replace(/-/g, "") + "_" + Date.now();
      props.setProperty("PASSWORD_SALT", salt);
    }

    // 6. Inisialisasi TOKEN_VERSION
    let version = props.getProperty("TOKEN_VERSION");
    if (!version) {
      props.setProperty("TOKEN_VERSION", "1");
      version = "1";
    }

    Logger.log("✅ Phase 2B Script Properties berhasil dikonfigurasi dengan isolasi rahasia penuh.");
    Logger.log("- TOKEN_SIGNING_SECRET (Legacy): Tetap dipertahankan");
    Logger.log("- AUTH_TOKEN_SIGNING_SECRET: Aktif");
    Logger.log("- OTP_HASH_SECRET: Aktif");
    Logger.log("- IDENTIFIER_HASH_SECRET: Aktif");
    Logger.log("- PASSWORD_SALT: Aktif");
    Logger.log("- TOKEN_VERSION: " + version);

    return {
      status: "success",
      message: "Phase 2B Script Properties configured with complete secret isolation.",
      tokenVersion: version
    };
  } catch (err) {
    Logger.log("❌ Gagal mengonfigurasi Phase 2B Script Properties: " + err.message);
    throw err;
  }
}

/**
 * Generates Server-Signed Session Token (HMAC SHA-256)
 * Menggunakan AUTH_TOKEN_SIGNING_SECRET secara eksplisit.
 */
// ==================== SESSION TTL CONFIGURATION (P1-1) ====================
// Role-specific bounded session lifetimes (Owner-approved policy)
const SESSION_TTL_ADMIN_HOURS = 24 * 30; // 30 Hari
const SESSION_TTL_EDITOR_HOURS = 24 * 30; // 30 Hari
const SESSION_TTL_PENGASUH_HOURS = 24 * 90; // 90 Hari
const SESSION_TTL_WALI_HOURS = 24 * 90; // 90 Hari (3 Bulan)
const SESSION_TTL_DEFAULT_HOURS = 24 * 30;

function getSessionTtlHoursForRole(role) {
  const r = String(role || "").trim().toUpperCase();
  if (r === "ADMIN") return SESSION_TTL_ADMIN_HOURS;
  if (r === "EDITOR") return SESSION_TTL_EDITOR_HOURS;
  if (r === "PENGASUH") return SESSION_TTL_PENGASUH_HOURS;
  if (r === "WALI_SANTRI") return SESSION_TTL_WALI_HOURS;
  return SESSION_TTL_DEFAULT_HOURS;
}

function generateSessionToken(userId, role, ttlHours = null, sessionId = null, identityId = null) {
  const secret = getServerSecret("AUTH_TOKEN_SIGNING_SECRET", getServerSecret("TOKEN_SIGNING_SECRET", ""));
  if (!secret) {
    throw new AuthenticationError("Signing secret is not configured on server.");
  }
  const effectiveTtlHours = (typeof ttlHours === "number" && ttlHours > 0) ? ttlHours : getSessionTtlHoursForRole(role);
  const tokenVersion = getServerSecret("TOKEN_VERSION", "1");
  const now = new Date().getTime();
  const expiresAt = now + (effectiveTtlHours * 60 * 60 * 1000);

  const payload = {
    userId: String(userId),
    role: String(role),
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    tokenVersion: String(tokenVersion)
  };
  if (sessionId) payload.sessionId = String(sessionId);
  if (identityId) payload.identityId = String(identityId);

  const payloadStr = Utilities.base64Encode(JSON.stringify(payload));
  const signatureBytes = Utilities.computeHmacSha256Signature(payloadStr, secret);
  const signatureStr = Utilities.base64Encode(signatureBytes);

  const token = payloadStr + "." + signatureStr;
  return {
    token: token,
    expiresAt: payload.expiresAt
  };
}

/**
 * Verifies Session Token
 * @param {string} tokenString
 * @param {boolean} requireAuthSecret - Jika true (Phase 2B), HANYA memverifikasi signature dengan AUTH_TOKEN_SIGNING_SECRET dan menolak mutlak token legacy.
 */
function verifySessionToken(tokenString, requireAuthSecret = false) {
  if (!tokenString || typeof tokenString !== "string" || !tokenString.includes(".")) {
    throw new AuthenticationError("Authentication token is missing or malformed.");
  }

  const parts = tokenString.split(".");
  if (parts.length !== 2) {
    throw new AuthenticationError("Authentication token format invalid.");
  }

  const payloadStr = parts[0];
  const signatureStr = parts[1];

  const authSecret = getServerSecret("AUTH_TOKEN_SIGNING_SECRET", "");
  const legacySecret = getServerSecret("TOKEN_SIGNING_SECRET", "");

  if (!authSecret && !legacySecret) {
    throw new AuthenticationError("Signing secrets are not configured on server.");
  }

  let validSig = false;

  if (requireAuthSecret) {
    // P0-1 STRICT ISOLATION: Endpoint Phase 2B WAJIB ditandatangani dengan AUTH_TOKEN_SIGNING_SECRET.
    // Tidak ada fallback ke legacySecret! Token legacy ditolak secara deterministik.
    if (!authSecret) {
      throw new AuthenticationError("AUTH_TOKEN_SIGNING_SECRET is not configured on server.");
    }
    const expectedSigBytes = Utilities.computeHmacSha256Signature(payloadStr, authSecret);
    if (signatureStr === Utilities.base64Encode(expectedSigBytes)) {
      validSig = true;
    }
  } else {
    // Jalur Legacy CMS: periksa authSecret, jika gagal fallback ke legacySecret
    if (authSecret) {
      const expectedSigBytes = Utilities.computeHmacSha256Signature(payloadStr, authSecret);
      if (signatureStr === Utilities.base64Encode(expectedSigBytes)) {
        validSig = true;
      }
    }
    if (!validSig && legacySecret) {
      const expectedSigBytes = Utilities.computeHmacSha256Signature(payloadStr, legacySecret);
      if (signatureStr === Utilities.base64Encode(expectedSigBytes)) {
        validSig = true;
      }
    }
  }

  if (!validSig) {
    throw new AuthenticationError(
      requireAuthSecret 
        ? "Invalid authentication token signature. Legacy tokens cannot access Phase 2B endpoints."
        : "Authentication token signature verification failed (tampered)."
    );
  }

  let claims = null;
  try {
    const jsonStr = Utilities.newBlob(Utilities.base64Decode(payloadStr)).getDataAsString();
    claims = JSON.parse(jsonStr);
  } catch (e) {
    throw new AuthenticationError("Failed to parse token payload claims.");
  }

  if (!claims || !claims.expiresAt || !claims.userId || !claims.role) {
    throw new AuthenticationError("Authentication token payload is incomplete.");
  }

  // P1-1 STRICT TOKEN EXPIRATION: Token kedaluwarsa jika waktu sekarang melebihi claims.expiresAt.
  // Bypass server-active dihapus agar sesi bounded TTL berlaku deterministik.
  const expTime = new Date(claims.expiresAt).getTime();
  if (isNaN(expTime) || Date.now() >= expTime) {
    throw new AuthenticationError("Authentication token has expired. Please log in again.");
  }

  const activeTokenVersion = getServerSecret("TOKEN_VERSION", "1");
  if (String(claims.tokenVersion) !== String(activeTokenVersion)) {
    throw new AuthenticationError("Authentication token has been revoked.");
  }

  // P0 SERVER-SIDE SESSION AUTHORITY: Validasi terhadap Auth_Sessions jika memuat sessionId
  if (claims.sessionId && typeof getSessionById === "function") {
    const session = getSessionById(claims.sessionId);
    if (!session || session.status !== "ACTIVE") {
      throw new AuthenticationError("Session has been revoked or is inactive on the server.");
    }
  }

  return claims;
}

/**
 * Action Authorization Matrix
 */
const AllowedRoles = Object.freeze({
  ADMIN: "admin",
  EDITOR: "editor"
});

function authorizeAction(actorContext, actionName) {
  const publicActions = ["program.listPublished", "program.getPublished"];
  if (publicActions.includes(actionName)) {
    return true; // Public access allowed
  }

  if (!actorContext || !actorContext.role) {
    throw new AuthenticationError("Authentication required for action: " + actionName);
  }

  const role = String(actorContext.role || "").trim().toLowerCase();

  const editorActions = [
    "program.list",
    "program.get",
    "program.create",
    "program.update"
  ];

  const adminActions = [
    "program.publish",
    "program.unpublish",
    "program.archive"
  ];

  if (adminActions.includes(actionName)) {
    if (role !== AllowedRoles.ADMIN) {
      throw new AuthorizationError(`Role '${actorContext.role}' is forbidden from performing action '${actionName}'.`);
    }
    return true;
  }

  if (editorActions.includes(actionName)) {
    if (role !== AllowedRoles.ADMIN && role !== AllowedRoles.EDITOR) {
      throw new AuthorizationError(`Role '${actorContext.role}' is forbidden from performing action '${actionName}'.`);
    }
    return true;
  }

  throw new AuthorizationError("Unrecognized action for authorization check: " + actionName);
}

/**
 * DTO Boundary Mapping Helpers
 */

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


function withAuthScriptLock(callback, timeoutMs = 10000) {
  const lock = LockService.getScriptLock();
  const acquired = lock.tryLock(timeoutMs);
  if (!acquired) {
    throw new Error("Server sibuk memproses antrean keamanan. Silakan coba beberapa saat lagi.");
  }
  try {
    return callback();
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {
      console.warn("Gagal melepaskan script lock:", e);
    }
  }
}

/**
 * Generic Concurrency Lock Wrapper menggunakan LockService untuk Modul Operasional (Sorogan, TPQ, dll)
 */
function withScriptLock(callback, timeoutMs = 10000) {
  const lock = LockService.getScriptLock();
  let acquired = false;
  try {
    acquired = lock.tryLock(timeoutMs);
  } catch (lockErr) {
    console.warn("LockService tryLock warning:", lockErr);
  }
  try {
    return callback();
  } finally {
    if (acquired) {
      try {
        lock.releaseLock();
      } catch (e) {
        console.warn("Gagal melepaskan script lock:", e);
      }
    }
  }
}

/**
 * Unbiased Rejection Sampling OTP Generator
 * Menggunakan Utilities.getUuid() untuk menjamin entropy tanpa Math.random() dan tanpa modulo bias.
 */
function generateSecureOtpDigits() {
  const MAX_UNBIASED = 4294800000; // 4772 * 900000
  while (true) {
    const rawUuid = Utilities.getUuid().replace(/-/g, "");
    const hex8 = rawUuid.substring(0, 8);
    const intVal = parseInt(hex8, 16);
    if (!isNaN(intVal) && intVal < MAX_UNBIASED) {
      const num = (intVal % 900000) + 100000;
      return String(num);
    }
  }
}

function hashOtpCode(otpCode) {
  const salt = getServerSecret("OTP_HASH_SECRET", getServerSecret("PASSWORD_SALT", ""));
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(otpCode) + salt, Utilities.Charset.UTF_8);
  return digest.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');
}

function verifyOtpHash(otpCode, storedHash) {
  if (!otpCode || !storedHash) return false;
  return hashOtpCode(otpCode) === String(storedHash).trim();
}

function hashIdentifier(identifier) {
  const secret = getServerSecret("IDENTIFIER_HASH_SECRET", getServerSecret("PASSWORD_SALT", ""));
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(identifier).trim().toLowerCase() + secret, Utilities.Charset.UTF_8);
  return digest.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');
}

/**
 * P1 Audit Log Writer
 * Dilarang menyimpan plaintext OTP, password, API key, atau token lengkap.
 */
/**
 * P1 Audit Log Writer
 * Dilarang menyimpan plaintext OTP, password, API key, atau token lengkap.
 */
function writeAuthAuditLog(eventType, identityId, sessionId, channel, success, requestId, metadataObj = {}) {
  try {
    const ss = getDatabaseSpreadsheet();
    let sheet = getAuthSheet(ss, SHEET_AUTH_AUDIT_LOG);
    if (!sheet) {
      console.warn("[SECURITY AUDIT] Sheet 'Auth_Audit_Log' belum diinisialisasi oleh administrator.");
      return;
    }

    const eventId = "EVT_" + Utilities.getUuid().replace(/-/g, "").substring(0, 16);
    const timestamp = new Date().toISOString();
    const safeMetadata = JSON.stringify(metadataObj || {});

    sheet.appendRow([
      eventId,
      timestamp,
      String(eventType || "UNKNOWN"),
      String(identityId || "ANONYMOUS"),
      String(sessionId || ""),
      String(channel || "SYSTEM"),
      Boolean(success),
      String(requestId || ""),
      safeMetadata
    ]);
  } catch (err) {
    console.error("Gagal mencatat audit log:", err);
  }
}

/**
 * Dispatcher Pengiriman WhatsApp via Gateway Eksternal
 */

// ==================== DATA ACCESS REPOSITORY LAYER ====================

/**
 * Helper Resolusi Database Spreadsheet
 * Mendukung override SPREADSHEET_ID eksplisit via Script Properties
 * dengan fallback aman ke getActiveSpreadsheet() kontainer bawaan.
 */
function getDatabaseSpreadsheet() {
  const explicitId = getServerSecret("SPREADSHEET_ID", "1cZSRh2rtKpT6E8m3GFJonVbiQG51fh24eN8J5JWtOJY");
  if (explicitId) {
    try {
      return SpreadsheetApp.openById(explicitId);
    } catch (e) {
      console.warn("[DB] Gagal membuka spreadsheet eksplisit ID: " + e.message);
    }
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Memastikan skema tabel mutakhir secara non-destruktif on-the-fly.
 * Menambahkan kolom yang belum ada (seperti birth_date pada Students).
 */
function ensureAuthSheetSchema(sheet, targetName) {
  if (!sheet || !targetName || !AUTH_SHEET_SCHEMAS || !AUTH_SHEET_SCHEMAS[targetName]) return;
  try {
    const expectedHeaders = AUTH_SHEET_SCHEMAS[targetName];
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) {
      sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
      sheet.getRange(1, 1, 1, expectedHeaders.length).setFontWeight("bold").setBackground("#dcfce7");
      sheet.setFrozenRows(1);
      return;
    }

    // 1. Auto-rename header nisn -> nis jika ada pada sheet Students
    if (targetName === SHEET_STUDENTS) {
      const firstRowValues = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      for (let c = 0; c < firstRowValues.length; c++) {
        if (String(firstRowValues[c] || "").trim().toLowerCase() === "nisn") {
          sheet.getRange(1, c + 1).setValue("nis");
          Logger.log(`[AUTO-MIGRATION] Header 'nisn' di sheet '${targetName}' kolom ${c + 1} berhasil diubah menjadi 'nis'.`);
          break;
        }
      }

      // 2. Hapus kolom class_name / kelas jika ada pada sheet Students
      const updatedRowValues = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      for (let c = updatedRowValues.length - 1; c >= 0; c--) {
        const hName = String(updatedRowValues[c] || "").trim().toLowerCase();
        if (hName === "class_name" || hName === "kelas") {
          sheet.deleteColumn(c + 1);
          Logger.log(`[AUTO-MIGRATION] Kolom '${hName}' di sheet '${targetName}' (kolom ${c + 1}) berhasil dihapus.`);
        }
      }
    }

    const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h || "").trim().toLowerCase());
    const missingHeaders = expectedHeaders.filter(eh => {
      const lower = eh.toLowerCase();
      if (lower === "nis") {
        return !currentHeaders.includes("nis") && !currentHeaders.includes("nisn");
      }
      if (lower === "birth_date") {
        return !currentHeaders.includes("birth_date") && !currentHeaders.includes("tanggal_lahir") && !currentHeaders.includes("tgl_lahir");
      }
      if (lower === "gender") {
        return !currentHeaders.includes("gender") && !currentHeaders.includes("jenis") && !currentHeaders.includes("jenis_kelamin");
      }
      if (lower === "photo_url") {
        return !currentHeaders.includes("photo_url") && !currentHeaders.includes("foto_profil") && !currentHeaders.includes("foto");
      }
      return !currentHeaders.includes(lower);
    });

    if (missingHeaders.length > 0) {
      const updatedLastCol = sheet.getLastColumn();
      missingHeaders.forEach((mh, idx) => {
        const colIdx = updatedLastCol + idx + 1;
        sheet.getRange(1, colIdx).setValue(mh).setFontWeight("bold").setBackground("#dcfce7");
      });
      Logger.log(`[AUTO-MIGRATION] Kolom [${missingHeaders.join(", ")}] otomatis ditambahkan ke sheet '${targetName}'.`);
    }
  } catch (err) {
    console.warn(`[AUTO-MIGRATION WARNING] Gagal sinkronisasi skema untuk '${targetName}':`, err);
  }
}

/**
 * Helper Resolusi Sheet Tab Resilien & Auto-Init On-Demand.
 * 1. Jika tabel sudah ada, lakukan schema sync (tambah kolom baru bila ada).
 * 2. Jika tabel belum ada, otomatis buat sheet baru dengan header lengkap & format resmi.
 */
function getAuthSheet(ss, targetName) {
  if (!ss) return null;
  let targetSheet = ss.getSheetByName(targetName);

  if (!targetSheet) {
    const cleanTarget = String(targetName || "").replace(/[\s_]+/g, "").toLowerCase();
    const sheets = ss.getSheets();
    for (let i = 0; i < sheets.length; i++) {
      const name = sheets[i].getName();
      const cleanName = name.replace(/[\s_]+/g, "").toLowerCase();
      if (name.trim().toLowerCase() === String(targetName).trim().toLowerCase() ||
          cleanName === cleanTarget ||
          (cleanTarget === "students" && cleanName === "student") ||
          (cleanTarget === "student" && cleanName === "students")) {
        targetSheet = sheets[i];
        break;
      }
    }
  }

  // Jika tabel belum ada sama sekali di spreadsheet, auto-create on-the-fly!
  if (!targetSheet && AUTH_SHEET_SCHEMAS && AUTH_SHEET_SCHEMAS[targetName]) {
    try {
      targetSheet = ss.insertSheet(targetName);
      const headers = AUTH_SHEET_SCHEMAS[targetName];
      targetSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      targetSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#dcfce7");
      targetSheet.setFrozenRows(1);
      Logger.log(`[SCHEMA AUTO-INIT] Tab '${targetName}' berhasil dibuat otomatis di Google Sheets.`);
    } catch (e) {
      console.warn(`[SCHEMA AUTO-INIT WARN] Gagal insert sheet '${targetName}': ${e.message}`);
      targetSheet = ss.getSheetByName(targetName); // fallback jika terjadi concurrency
    }
  }

  if (targetSheet) {
    ensureAuthSheetSchema(targetSheet, targetName);
  }

  return targetSheet;
}

/**
 * Simpan atau perbarui hash password pengguna secara aman di Sheet Users dan Sheet Role
 */

function normalizeDateString(val) {
  if (!val) return "";
  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(val).trim();
  const mYmd = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (mYmd) {
    return `${mYmd[1]}-${String(mYmd[2]).padStart(2, "0")}-${String(mYmd[3]).padStart(2, "0")}`;
  }
  const mDmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (mDmy) {
    return `${mDmy[3]}-${String(mDmy[2]).padStart(2, "0")}-${String(mDmy[1]).padStart(2, "0")}`;
  }
  return s;
}

/**
 * Normalisasi format waktu sesi menjadi format bersih HH:mm
 * Mencegah kebocoran string Date bawaan Google Sheets (misal: "Sat Dec 30 1899 05:15:00 GMT+0707...")
 */
function normalizeTimeString(val, defaultVal) {
  if (defaultVal === undefined) defaultVal = "00:00";
  if (!val && val !== 0) return defaultVal;
  if (val instanceof Date && !isNaN(val.getTime())) {
    const hh = String(val.getHours()).padStart(2, "0");
    const mm = String(val.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }
  const s = String(val).trim();
  if (/^\d{1,2}:\d{2}$/.test(s)) {
    const parts = s.split(":");
    return `${parts[0].padStart(2, "0")}:${parts[1]}`;
  }
  const match = s.match(/(?:(?:1899|1900|\d{4})[^\d]+)?(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (match) {
    return `${match[1].padStart(2, "0")}:${match[2].padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return s || defaultVal;
}
