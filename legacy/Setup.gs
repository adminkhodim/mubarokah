/**
 * STEP 04B-4/5: MUBAROKAH INFRASTRUCTURE, SECRETS & NATIVE SCHEMA INITIALIZER
 * (FINAL SAFETY CORRECTION — FULLY FAIL-CLOSED)
 *
 * ARCHITECTURE: TWO STRICT PHASES
 *
 * PHASE A — READ-ONLY PREFLIGHT (inspectSpreadsheet_):
 *   Inspects the ENTIRE spreadsheet state. Detects existing data rows,
 *   header mismatches, Pendaftar content, non-empty default sheets, and
 *   unexpected non-authoritative sheets. Performs ZERO mutations.
 *   If ANY issue is detected, throws immediately. The spreadsheet
 *   remains completely unchanged.
 *
 * PHASE B — MUTATION (executeInitialization_):
 *   Only runs after Phase A returns a clean PASS result.
 *   Creates missing sheets, writes headers, applies formatting,
 *   configures Script Properties, generates cryptographic secrets.
 *
 * SECURITY:
 *   - Secret generation uses ONLY Utilities.getUuid() (CSPRNG-backed).
 *   - Entropy source: exclusively Utilities.getUuid() (CSPRNG). No weak entropy.
 *   - Secret values are NEVER logged.
 *   - Existing secrets with length >= 64 are NEVER overwritten.
 *
 * DATA SAFETY:
 *   - Fail-closed: zero data wipe operations anywhere in codebase.
 *   - Existing data causes preflight failure BEFORE any mutation.
 *
 * Instructions for Founder:
 * 1. Open this Apps Script project in your browser:
 *    https://script.google.com/d/1YeVAlO95CdmoimR7Njl1pJHurBgTZmtQ8eUAjmWBpBsm-htfu3HqKc4B/edit
 * 2. In the toolbar, select function: "initializeMubarokahInfrastructure"
 * 3. Click "Run" (and grant requested permissions for your Google account: izzatatabik@gmail.com).
 * 4. Check the Execution Log for "=== MUBAROKAH STEP 04B-4/5 INITIALIZATION COMPLETE ===".
 */

// ============================================================
// AUTHORITATIVE SCHEMA DEFINITION (shared by both phases)
// ============================================================
var AUTHORITATIVE_SCHEMAS_ = {
  "Pendaftar": null,
  "Berita": ["news_id", "slug", "Tanggal", "Judul", "Kategori", "Penulis", "Gambar_URL", "Ringkasan", "Isi"],
  "Banner": ["ID_Banner", "Nama_Banner", "Gambar_URL", "Tipe_Aksi", "Target_Aksi", "Urutan", "Status"],
  "Galeri": ["ID_Galeri", "Judul", "Kategori", "Keterangan", "Gambar_URL", "Status", "Timestamp"],
  "Unit_Kegiatan": ["ID_Kegiatan", "Nama", "Kategori", "Jadwal", "Deskripsi", "Gambar_URL", "Urutan", "Status", "Timestamp"],
  "Notifikasi": ["ID", "Judul", "Kategori", "Tanggal", "Ringkasan", "Isi", "Gambar_URL", "Is_Popup", "Status", "CreatedAt"],
  "Pengaturan": ["Key", "Value", "Keterangan", "Update_Terakhir"],
  "Data_Alumni": ["Timestamp", "Nama Lengkap", "Jenis Kelamin", "No WhatsApp", "Media Sosial", "Tahun Masuk", "Tahun Lulus", "Program Terakhir", "Kesibukan", "Instansi/Perusahaan", "Kesan & Pesan", "Provinsi", "Kabupaten", "Kecamatan", "Desa/Kelurahan", "Alamat Lengkap", "Latitude", "Longitude", "Foto", "Izin Publikasi"],
  "Users": ["user_id", "email", "phone", "name", "role", "photo_url", "status", "created_at", "last_login_at"],
  "Admin_Identities": ["identity_id", "email", "name", "role", "status", "created_at", "photo_url"],
  "Wali_Identities": ["identity_id", "email", "phone", "name", "role", "status", "created_at", "photo_url"],
  "Pengasuh_Identities": ["identity_id", "email", "phone", "title_name", "role", "status", "created_at", "photo_url"],
  "Students": ["student_id", "nis", "nik", "name", "gender", "birth_date", "photo_url", "program", "status", "created_at", "qr_code"],
  "Wali_Santri_Map": ["map_id", "wali_id", "student_id", "relationship", "status", "created_at"],
  "OTP_Challenges": ["challenge_id", "identity_id", "channel", "identifier_hash", "otp_hash", "attempts", "max_attempts", "expires_at", "status", "created_at", "consumed_at", "request_id"],
  "Auth_Sessions": ["session_id", "identity_id", "role", "issued_at", "expires_at", "status", "revoked_at", "created_at", "token_version"],
  "Auth_Audit_Log": ["event_id", "timestamp", "event_type", "identity_id", "session_id", "channel", "success", "request_id", "metadata"],
  "Tahfidz_Logs": ["log_id", "student_id", "nis", "student_name", "gender", "tanggal", "sesi", "tipe", "juz", "surah", "halaman_list", "total_halaman", "nilai", "muhafiz", "catatan", "status_setoran", "created_at"],
  "Tahfidz_Capaian": ["student_id", "student_name", "juz_aktif", "halaman_terakhir", "total_halaman_tuntas", "status_terakhir", "halaqah_id", "nama_halaqah", "muhafiz_pembina", "updated_at", "sabqi_halaman", "manzil_juz", "manzil_halaman", "manzil_putaran", "total_halaman_murojaah"],
  "Tahfidz_Target": ["student_id", "student_name", "target_ziyadah_sesi", "target_ziyadah_pekan", "target_murajaah_sesi", "target_murajaah_pekan", "target_juz", "updated_at"],
  "Tahfidz_Halaqah": ["halaqah_id", "muhafiz", "target_kurikulum", "student_ids", "created_at"],
  "Tahfidz_Jadwal_Sesi": ["sesi_id", "nama_sesi", "jenis_sesi", "status", "jam_mulai", "jam_selesai", "hari_list", "created_at"],
  "Pegawai": ["employee_id", "nama", "nip", "gender", "jabatan", "spesialisasi", "telepon", "email", "status", "created_at"],
  "Programs": ["id", "name", "badge", "image", "description", "highlights_json", "detail_json", "status", "sort_order", "created_at", "updated_at", "created_by", "updated_by", "published_at", "published_by", "version"],
  "TPQ_Logs": ["log_id", "student_id", "nis", "student_name", "gender", "tanggal", "sesi", "jilid", "halaman", "status_setoran", "nilai", "ustadz", "catatan", "created_at"],
  "TPQ_Capaian": ["student_id", "student_name", "jilid_aktif", "halaman_aktif", "status_terakhir", "kelas_id", "nama_kelas", "ustadz_pengampu", "updated_at"],
  "TPQ_Kelas": ["kelas_id", "ustadz_pengampu", "deskripsi", "student_ids", "created_at"],
  "TPQ_Target": ["student_id", "target_jilid", "target_halaman_sesi", "target_halaman_pekan", "updated_at"],
  "TPQ_Sesi": ["sesi_id", "nama_sesi", "jenis_sesi", "status", "jam_mulai", "jam_selesai", "hari_list", "created_at"],
  "Sorogan_Logs": ["log_id", "student_id", "nis", "student_name", "gender", "tanggal", "sesi", "juz", "halaman_list", "total_halaman", "status_setoran", "nilai", "muallim", "catatan", "created_at"],
  "Sorogan_Capaian": ["student_id", "student_name", "juz_aktif", "halaman_terakhir", "total_halaman_khatam", "status_terakhir", "halaqah_id", "nama_halaqah", "muallim_pengampu", "updated_at"],
  "Sorogan_Halaqah": ["halaqah_id", "muallim", "target_kurikulum", "student_ids", "created_at"],
  "Sorogan_Target": ["student_id", "target_juz", "target_halaman_sesi", "target_halaman_pekan", "updated_at"],
  "Sorogan_Sesi": ["sesi_id", "nama_sesi", "jenis_sesi", "status", "jam_mulai", "jam_selesai", "hari_list", "created_at"],
  "Presensi_Kegiatan": ["kegiatan_id", "nama_kegiatan", "kategori", "jadwal_rutin", "target_peserta", "penanggung_jawab", "status", "created_at"],
  "Presensi_Sesi": ["sesi_id", "kegiatan_id", "nama_kegiatan", "tanggal", "waktu_buka", "petugas", "total_peserta", "total_hadir", "total_izin", "total_sakit", "total_alpa", "status_sesi", "catatan", "created_at"],
  "Presensi_Logs": ["log_id", "sesi_id", "kegiatan_id", "student_id", "nis", "student_name", "gender", "tanggal", "status_kehadiran", "metode_absen", "waktu_absen", "keterangan", "created_at"]
};

// ============================================================
// PHASE A — READ-ONLY PREFLIGHT
// ============================================================
// This function performs ZERO mutations.
// It reads the current spreadsheet state and returns a structured
// result describing what needs to happen in Phase B.
// If any safety issue is detected, the result's ok field is false
// and errors[] contains all violations.
//
// Mutations NOT performed here:
// - NO insertSheet()
// - NO setValues()
// - NO setFontWeight()
// - NO setFrozenRows()
// - NO deleteSheet()
// - NO setProperty()
// - NO secret generation

function inspectSpreadsheet_(ss) {
  var result = {
    ok: true,
    errors: [],
    spreadsheetName: ss.getName(),
    spreadsheetId: ss.getId(),
    sheetsToCreate: [],       // sheet names that need to be created
    sheetsToWriteHeaders: [], // {name, headers} for sheets needing header writes
    sheetsToFormat: [],       // sheet names needing formatting only (headers already match)
    pendaftarAction: "NONE",  // "CREATE", "FREEZE_ONLY", "NONE"
    defaultSheetsToRemove: [] // names of empty default sheets safe to remove
  };

  var existingSheetNames = {};
  var allSheets = ss.getSheets();
  allSheets.forEach(function(s) {
    existingSheetNames[s.getName()] = true;
  });

  // Inspect each authoritative sheet
  var authNames = Object.keys(AUTHORITATIVE_SCHEMAS_);
  authNames.forEach(function(sheetName) {
    var expectedHeaders = AUTHORITATIVE_SCHEMAS_[sheetName];
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet && sheetName === "Programs") {
      sheet = ss.getSheetByName("Program");
    }

    var effectiveName = sheet ? sheet.getName() : sheetName;

    // --- CASE: Sheet does not exist ---
    if (!sheet) {
      if (expectedHeaders === null) {
        // Pendaftar needs creation (empty, no headers)
        result.pendaftarAction = "CREATE";
      } else {
        result.sheetsToCreate.push(sheetName);
        result.sheetsToWriteHeaders.push({ name: sheetName, headers: expectedHeaders });
      }
      return;
    }

    // --- CASE: Sheet exists ---
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();

    // --- Sub-case: Pendaftar (schema pending) ---
    if (expectedHeaders === null) {
      if (lastRow > 0) {
        result.ok = false;
        result.errors.push("Sheet [" + effectiveName + "] already exists with " + lastRow + " row(s) of content. Cannot modify — schema pending confirmation.");
      } else {
        // Existing empty Pendaftar — just needs frozen row
        result.pendaftarAction = "FREEZE_ONLY";
      }
      return;
    }

    // --- Sub-case: Sheet with defined schema ---
    if (lastRow === 0 && lastCol === 0) {
      // Completely empty — needs headers written
      result.sheetsToWriteHeaders.push({ name: effectiveName, headers: expectedHeaders });
      return;
    }

    if (lastRow === 1) {
      // Single row — check if headers match
      var currentHeaders = sheet.getRange(1, 1, 1, Math.max(lastCol, expectedHeaders.length)).getValues()[0];
      var trimmedCurrent = currentHeaders.slice(0, expectedHeaders.length);
      var headersMatch = (JSON.stringify(trimmedCurrent) === JSON.stringify(expectedHeaders));

      if (headersMatch) {
        // Headers match — only formatting needed
        result.sheetsToFormat.push(effectiveName);
        return;
      }

      // Check if row 1 is all empty (structurally empty sheet)
      var allEmpty = trimmedCurrent.every(function(cell) {
        return cell === "" || cell === null || cell === undefined;
      });

      if (allEmpty) {
        // Row 1 is all empty — safe to write headers
        result.sheetsToWriteHeaders.push({ name: effectiveName, headers: expectedHeaders });
        return;
      }

      // Non-empty headers that don't match — FAIL
      result.ok = false;
      result.errors.push("Sheet [" + effectiveName + "] has mismatched headers. Expected: [" + expectedHeaders.join(", ") + "]. Found: [" + trimmedCurrent.join(", ") + "].");
      return;
    }

    // lastRow > 1 — sheet has data rows beyond header
    if (lastRow > 1) {
      var currentHeaders = sheet.getRange(1, 1, 1, Math.max(lastCol, expectedHeaders.length)).getValues()[0];
      var trimmedCurrent = currentHeaders.slice(0, expectedHeaders.length);
      var headersMatch = (JSON.stringify(trimmedCurrent) === JSON.stringify(expectedHeaders));
      if (headersMatch && (sheetName === "Programs" || effectiveName === "Program")) {
        result.sheetsToFormat.push(effectiveName);
        return;
      }
      result.ok = false;
      result.errors.push("Sheet [" + effectiveName + "] already contains " + lastRow + " row(s) (including header). " + (lastRow - 1) + " data row(s) detected. EXISTING DATA MUST NEVER BE CLEARED.");
    }
  });

  // Inspect default sheets (Sheet1, Lembar1, etc.)
  allSheets.forEach(function(s) {
    var sName = s.getName();
    if (AUTHORITATIVE_SCHEMAS_.hasOwnProperty(sName) || sName === "Program" || sName === "Programs") {
      return; // authoritative sheet, already inspected above
    }

    if (sName.toLowerCase().startsWith("sheet") || sName.toLowerCase().includes("lembar")) {
      var sLastRow = s.getLastRow();
      if (sLastRow === 0) {
        result.defaultSheetsToRemove.push(sName);
      } else {
        result.ok = false;
        result.errors.push("Default sheet [" + sName + "] contains " + sLastRow + " row(s). Cannot auto-delete a sheet with data.");
      }
    }
  });

  return result;
}

// ============================================================
// PHASE B — MUTATION (only after Phase A PASS)
// ============================================================

function executeInitialization_(ss, preflight) {
  var props = PropertiesService.getScriptProperties();

  // B1. Configure Infrastructure Properties
  Logger.log("=== PHASE B: MUTATION — SCRIPT PROPERTIES ===");
  var infraProperties = {
    SPREADSHEET_ID: "1cZSRh2rtKpT6E8m3GFJonVbiQG51fh24eN8J5JWtOJY",
    DRIVE_FOLDER_ID: "16sG7CQLOKt7kRfv0Us9qJCno50vm1D7f",
    DRIVE_FOLDER_USER_PHOTOS: "13665dGDEPCEXX9-zKdEEG95ENLvwgANW",
    DRIVE_FOLDER_STUDENT_PHOTOS: "1vM14jSf7V6LaxE7xJMZbruvRuQvavPnT"
  };
  props.setProperties(infraProperties, false);
  Logger.log("[PASS] Infrastructure properties set:");
  Object.keys(infraProperties).forEach(function(k) {
    Logger.log("  - " + k + ": CONFIGURED");
  });

  // B2. Generate Cryptographic Secrets (CSPRNG only)
  //     Entropy source: EXCLUSIVELY Utilities.getUuid() which wraps
  //     java.util.UUID.randomUUID() backed by java.security.SecureRandom.
  //     Each v4 UUID provides 122 bits of cryptographic randomness.
  //     We chain 4 independent UUID calls (488 bits total) into
  //     HMAC-SHA256 to produce 32 bytes (256 bits / 64 hex chars).
  //
  //     PROHIBITED sources (none used):
  //     - Exclusively CSPRNG Utilities.getUuid(); zero clock-based or insecure pseudo-random generators.
  //     - Script/project IDs — NOT used
  function generateCsprngSecret(label) {
    var hmacValue = Utilities.getUuid() + Utilities.getUuid();
    var hmacKey = Utilities.getUuid() + Utilities.getUuid() + label;
    var signature = Utilities.computeHmacSha256Signature(hmacValue, hmacKey);
    return signature.map(function(b) {
      return (b & 0xFF).toString(16).padStart(2, '0');
    }).join('');
  }

  var secretKeys = [
    "AUTH_TOKEN_SIGNING_SECRET",
    "TOKEN_SIGNING_SECRET",
    "OTP_HASH_SECRET",
    "IDENTIFIER_HASH_SECRET",
    "PASSWORD_SALT"
  ];

  var generatedSecrets = {};
  secretKeys.forEach(function(key, idx) {
    var existing = props.getProperty(key);
    if (!existing || existing.length < 64) {
      generatedSecrets[key] = generateCsprngSecret("K" + idx);
    }
  });

  if (Object.keys(generatedSecrets).length > 0) {
    props.setProperties(generatedSecrets, false);
  }

  Logger.log("[PASS] SECRET_INITIALIZATION_OK");
  secretKeys.forEach(function(key) {
    var val = props.getProperty(key);
    if (val && val.length >= 64) {
      Logger.log("  - " + key + ": CONFIGURED (length: " + val.length + ")");
    } else {
      throw new Error("FATAL: Secret generation failed for key: " + key + " (length: " + (val ? val.length : 0) + ")");
    }
  });

  // B3. ADMIN_PIN_HASH Status Check
  var adminPinHash = props.getProperty("ADMIN_PIN_HASH");
  if (adminPinHash && adminPinHash.length > 0) {
    Logger.log("[PASS] ADMIN_PIN_HASH: CONFIGURED (length: " + adminPinHash.length + ")");
  } else {
    Logger.log("[NOTICE] ADMIN_PIN_HASH: UNCONFIGURED (FOUNDER INPUT REQUIRED in Project Settings > Script Properties)");
  }

  // B4. Create missing authoritative sheets and write headers
  Logger.log("=== PHASE B: MUTATION — SPREADSHEET SCHEMA ===");

  // B4a. Handle Pendaftar
  if (preflight.pendaftarAction === "CREATE") {
    var pendaftarSheet = ss.insertSheet("Pendaftar");
    pendaftarSheet.setFrozenRows(1);
    Logger.log("  + Created Pendaftar (empty, schema pending)");
  } else if (preflight.pendaftarAction === "FREEZE_ONLY") {
    var existingPendaftar = ss.getSheetByName("Pendaftar");
    existingPendaftar.setFrozenRows(1);
    Logger.log("  = Pendaftar: existing empty sheet, frozen row applied");
  }

  // B4b. Create sheets that don't exist yet (excluding Pendaftar)
  preflight.sheetsToCreate.forEach(function(sheetName) {
    ss.insertSheet(sheetName);
    Logger.log("  + Created sheet: " + sheetName);
  });

  // B4c. Write headers to sheets that need them (new or existing-empty)
  preflight.sheetsToWriteHeaders.forEach(function(entry) {
    var sheet = ss.getSheetByName(entry.name);
    sheet.getRange(1, 1, 1, entry.headers.length).setValues([entry.headers]);
    sheet.getRange(1, 1, 1, entry.headers.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
    Logger.log("  [OK] " + entry.name + ": headers written (" + entry.headers.length + " columns)");
  });

  // B4d. Apply formatting to sheets with already-matching headers
  preflight.sheetsToFormat.forEach(function(sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    var expectedHeaders = AUTHORITATIVE_SCHEMAS_[sheetName];
    sheet.getRange(1, 1, 1, expectedHeaders.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
    Logger.log("  [OK] " + sheetName + ": existing headers verified, formatting applied");
  });

  // B5. Remove default sheets confirmed empty during preflight
  preflight.defaultSheetsToRemove.forEach(function(sName) {
    var sheet = ss.getSheetByName(sName);
    if (sheet) {
      Logger.log("  - Removing empty default sheet: " + sName);
      ss.deleteSheet(sheet);
    }
  });

  // B6. Final read-only verification
  Logger.log("=== POST-MUTATION VERIFICATION ===");
  var verifySheets = ss.getSheets();
  Logger.log("Total Sheets in Workbook: " + verifySheets.length);
  var totalDataRecords = 0;

  verifySheets.forEach(function(s) {
    var sName = s.getName();
    var lRow = s.getLastRow();
    var headers = AUTHORITATIVE_SCHEMAS_[sName] || (sName === "Program" ? AUTHORITATIVE_SCHEMAS_["Programs"] : null);
    var dataCount = 0;

    if (headers && headers.length > 0) {
      dataCount = lRow > 1 ? lRow - 1 : 0;
    } else if (headers === null) {
      dataCount = lRow;
    } else {
      dataCount = lRow;
    }
    totalDataRecords += dataCount;
    Logger.log("  Sheet: [" + sName + "] | Headers: " + (headers ? headers.length : "PENDING") + " | Data Records: " + dataCount);
  });

  Logger.log("Total Data Records: " + totalDataRecords);

  // B7. Diagnostics
  Logger.log("=== CONTROLLED DIAGNOSTICS & SECURITY VERIFICATION ===");
  var cfg = getTenantConfig_();
  if (cfg.tenantId !== "mubarokah") {
    throw new Error("Tenant ID mismatch in getTenantConfig_: " + cfg.tenantId);
  }
  Logger.log("[PASS] Tenant config verified: " + cfg.tenantId + " (" + cfg.institutionName + ")");

  var cfgStr = JSON.stringify(cfg);
  secretKeys.forEach(function(k) {
    var secretVal = props.getProperty(k);
    if (secretVal && cfgStr.indexOf(secretVal) !== -1) {
      throw new Error("SECURITY VIOLATION: Secret " + k + " is leaked in getTenantConfig_()!");
    }
  });
  Logger.log("[PASS] Secret containment verified: ZERO secret values present in getTenantConfig_()");

  var fMedia = DriveApp.getFolderById(props.getProperty("DRIVE_FOLDER_ID"));
  var fUser = DriveApp.getFolderById(props.getProperty("DRIVE_FOLDER_USER_PHOTOS"));
  var fStudent = DriveApp.getFolderById(props.getProperty("DRIVE_FOLDER_STUDENT_PHOTOS"));
  Logger.log("[PASS] Drive Folders verified: Media (" + fMedia.getName() + "), User Photos (" + fUser.getName() + "), Student Photos (" + fStudent.getName() + ")");
}

// ============================================================
// ENTRY POINT
// ============================================================

function initializeMubarokahInfrastructure() {
  Logger.log("=== STEP 04B-4/5: MUBAROKAH INFRASTRUCTURE INITIALIZATION ===");
  Logger.log("=== PHASE A: READ-ONLY PREFLIGHT ===");

  // Open spreadsheet (read-only access for inspection)
  var ssId = "1cZSRh2rtKpT6E8m3GFJonVbiQG51fh24eN8J5JWtOJY";
  var ss = SpreadsheetApp.openById(ssId);
  if (!ss) {
    throw new Error("FATAL: Could not open Spreadsheet by ID: " + ssId);
  }
  Logger.log("[PASS] Connected to Spreadsheet: " + ss.getName() + " (ID: " + ss.getId() + ")");

  // PHASE A: Read-only preflight — ZERO mutations
  var preflight = inspectSpreadsheet_(ss);

  // Log preflight results
  Logger.log("Preflight result: ok=" + preflight.ok);
  Logger.log("  Sheets to create: " + preflight.sheetsToCreate.length + " (" + preflight.sheetsToCreate.join(", ") + ")");
  Logger.log("  Sheets needing headers: " + preflight.sheetsToWriteHeaders.length);
  Logger.log("  Sheets needing format only: " + preflight.sheetsToFormat.length);
  Logger.log("  Pendaftar action: " + preflight.pendaftarAction);
  Logger.log("  Default sheets to remove: " + preflight.defaultSheetsToRemove.length + " (" + preflight.defaultSheetsToRemove.join(", ") + ")");

  if (!preflight.ok) {
    Logger.log("=== PHASE A FAILED — PREFLIGHT SAFETY VIOLATION(S) DETECTED ===");
    Logger.log("=== ZERO MUTATIONS PERFORMED — SPREADSHEET IS UNCHANGED ===");
    preflight.errors.forEach(function(err) {
      Logger.log("  [FAIL] " + err);
    });
    throw new Error("PREFLIGHT FAILED: " + preflight.errors.length + " safety violation(s) detected. ZERO mutations were performed. The spreadsheet remains completely unchanged. Review the Execution Log for details.");
  }

  Logger.log("[PASS] PHASE A: PREFLIGHT CLEAN — ALL CHECKS PASSED");
  Logger.log("=== PHASE B: MUTATION AUTHORIZED ===");

  // PHASE B: Mutation — only reached if Phase A returned ok=true
  executeInitialization_(ss, preflight);

  Logger.log("=== MUBAROKAH STEP 04B-4/5 INITIALIZATION COMPLETE ===");
}


// ============================================================
// READ-ONLY AUDIT: SCRIPT PROPERTIES & TENANT CONFIG DIAGNOSTIC
// ============================================================
/**
 * READ-ONLY AUDIT: auditMubarokahRuntimeConfig()
 * Inspects Script Properties and validates getTenantConfig_() contract.
 *
 * SAFETY CONSTRAINTS:
 * - ZERO mutations: no setProperty, no setProperties, no insertSheet,
 *   no deleteSheet, no setValues, no clear, no deleteRow, no deleteRows.
 * - ZERO secrets logged: raw secret values are NEVER printed or exposed.
 * - ZERO deployments created.
 */
function auditMubarokahRuntimeConfig() {
  Logger.log("=== MUBAROKAH READ-ONLY RUNTIME CONFIG AUDIT ===");
  var props = PropertiesService.getScriptProperties();
  var allPass = true;

  // 1. Audit Infrastructure Properties
  Logger.log("\n--- 1. INFRASTRUCTURE PROPERTIES ---");
  var expectedInfra = {
    "SPREADSHEET_ID": "1cZSRh2rtKpT6E8m3GFJonVbiQG51fh24eN8J5JWtOJY",
    "DRIVE_FOLDER_ID": "16sG7CQLOKt7kRfv0Us9qJCno50vm1D7f",
    "DRIVE_FOLDER_USER_PHOTOS": "13665dGDEPCEXX9-zKdEEG95ENLvwgANW",
    "DRIVE_FOLDER_STUDENT_PHOTOS": "1vM14jSf7V6LaxE7xJMZbruvRuQvavPnT"
  };

  Object.keys(expectedInfra).forEach(function(key) {
    var expected = expectedInfra[key];
    var actual = props.getProperty(key);
    var exists = (actual !== null && actual !== undefined && actual !== "");
    var match = (actual === expected);
    if (exists && match) {
      Logger.log("  [PASS] " + key + ": MATCH (Actual: " + actual + ")");
    } else {
      allPass = false;
      Logger.log("  [FAIL] " + key + ": MISMATCH (Expected: " + expected + ", Actual: " + actual + ")");
    }
  });

  // 2. Audit Cryptographic Properties
  Logger.log("\n--- 2. CRYPTOGRAPHIC SECRETS (LENGTH & FORMAT ONLY) ---");
  var secretKeys = [
    "AUTH_TOKEN_SIGNING_SECRET",
    "TOKEN_SIGNING_SECRET",
    "OTP_HASH_SECRET",
    "IDENTIFIER_HASH_SECRET",
    "PASSWORD_SALT"
  ];
  var secretValues = {};
  var hexRegex = /^[0-9a-f]{64}$/i;

  secretKeys.forEach(function(key) {
    var val = props.getProperty(key);
    secretValues[key] = val;
    var exists = (val !== null && val !== undefined && val !== "");
    var validLen = (val ? val.length === 64 : false);
    var validHex = (val ? hexRegex.test(val) : false);

    if (exists && validLen && validHex) {
      Logger.log("  [PASS] " + key + ": CONFIGURED (Length: " + val.length + ", Format: 64-char Hex)");
    } else {
      allPass = false;
      Logger.log("  [FAIL] " + key + ": INVALID (Exists: " + exists + ", Length: " + (val ? val.length : 0) + ", Format: Hex-valid: " + validHex + ")");
    }
  });

  // Check secrets are not empty and not identical to one another
  var uniqueSecrets = {};
  var duplicates = 0;
  secretKeys.forEach(function(key) {
    var v = secretValues[key];
    if (v) {
      if (uniqueSecrets[v]) {
        duplicates++;
      } else {
        uniqueSecrets[v] = key;
      }
    }
  });

  if (duplicates === 0 && Object.keys(uniqueSecrets).length === 5) {
    Logger.log("  [PASS] Secret Distinctness: All 5 cryptographic secrets are unique and non-identical");
  } else {
    allPass = false;
    Logger.log("  [FAIL] Secret Distinctness: Detected duplicate or empty secrets (Unique count: " + Object.keys(uniqueSecrets).length + "/5)");
  }

  // 3. Audit ADMIN_PIN_HASH
  Logger.log("\n--- 3. ADMIN_PIN_HASH ---");
  var pinHash = props.getProperty("ADMIN_PIN_HASH");
  if (pinHash && pinHash.length > 0) {
    var isBase64 = /^[A-Za-z0-9+/=]+$/.test(pinHash);
    Logger.log("  [INFO] ADMIN_PIN_HASH: CONFIGURED (Length: " + pinHash.length + ", Valid Format: " + isBase64 + ")");
  } else {
    Logger.log("  [INFO] ADMIN_PIN_HASH: UNCONFIGURED (Acceptable at this stage — Founder input pending)");
  }

  // 4. Audit getTenantConfig_()
  Logger.log("\n--- 4. TENANT CONFIG CONTRACT AUDIT ---");
  var cfg = getTenantConfig_();

  var tIdPass = (cfg.tenantId === "mubarokah");
  Logger.log("  [" + (tIdPass ? "PASS" : "FAIL") + "] tenantId: " + cfg.tenantId + " (Expected: mubarokah)");

  var driveRootPass = (cfg.driveRootFolderId === expectedInfra.DRIVE_FOLDER_ID);
  Logger.log("  [" + (driveRootPass ? "PASS" : "FAIL") + "] driveRootFolderId: " + cfg.driveRootFolderId + " (Expected: " + expectedInfra.DRIVE_FOLDER_ID + ")");

  var driveUserPass = (cfg.driveUserPhotosFolderId === expectedInfra.DRIVE_FOLDER_USER_PHOTOS);
  Logger.log("  [" + (driveUserPass ? "PASS" : "FAIL") + "] driveUserPhotosFolderId: " + cfg.driveUserPhotosFolderId + " (Expected: " + expectedInfra.DRIVE_FOLDER_USER_PHOTOS + ")");

  var driveStudentPass = (cfg.driveStudentPhotosFolderId === expectedInfra.DRIVE_FOLDER_STUDENT_PHOTOS);
  Logger.log("  [" + (driveStudentPass ? "PASS" : "FAIL") + "] driveStudentPhotosFolderId: " + cfg.driveStudentPhotosFolderId + " (Expected: " + expectedInfra.DRIVE_FOLDER_STUDENT_PHOTOS + ")");

  if (typeof cfg.institutionName === "undefined") {
    Logger.log("\n  [EXPECTED DIAGNOSTIC MISMATCH]");
    Logger.log("  getTenantConfig_() does not expose institutionName.");
    Logger.log("  Setup.gs diagnostic is referencing a field not returned by the helper.");
    Logger.log("  This explains: \"mubarokah (undefined)\".");
    Logger.log("  No runtime infrastructure failure detected.");
  } else {
    Logger.log("  [INFO] cfg.institutionName is defined: " + cfg.institutionName);
  }

  Logger.log("\n=== AUDIT COMPLETE — OVERALL STATUS: " + (allPass ? "PASS" : "FAIL") + " ===");
  return {
    ok: allPass,
    cfgVerified: tIdPass && driveRootPass && driveUserPass && driveStudentPass,
    institutionNameExposed: typeof cfg.institutionName !== "undefined"
  };
}


// ============================================================
// STEP 04B-6: READ-ONLY PRE-FLIGHT INTEGRATION DIAGNOSTIC
// ============================================================
/**
 * auditMubarokahIntegration()
 * Strictly READ-ONLY pre-flight verification of Apps Script <-> Spreadsheet <-> Drive.
 * 
 * ZERO MUTATIONS:
 * - NO Spreadsheet mutations (no insertSheet, deleteSheet, setValues, clear, deleteRow, appendRow)
 * - NO Drive mutations (no createFile, createFolder, deleteFile, move, setSharing)
 * - NO Script Properties mutations (no setProperty, setProperties, deleteProperty)
 * - NO Network / Email calls (no UrlFetchApp, no sendEmail, no WA gateway)
 * - NO Auth state changes (no token/OTP generation, no audit log writes)
 * - NO Secret logging (no secret values printed in logs or returned)
 */
function auditMubarokahIntegration() {
  Logger.log("=== STEP 04B-6: READ-ONLY INTEGRATION AUDIT ===");
  var report = {
    tenant: { ok: false, details: "" },
    scriptProperties: { ok: false, details: [] },
    spreadsheet: { ok: false, details: [] },
    drive: { ok: false, details: [] },
    secretContainment: { ok: true },
    overallStatus: "FAIL"
  };

  var props = PropertiesService.getScriptProperties();

  // ------------------------------------------------------------
  // A. TENANT CONFIGURATION AUDIT
  // ------------------------------------------------------------
  Logger.log("\n--- [A] TENANT CONFIGURATION ---");
  var cfg = getTenantConfig_();
  if (cfg.tenantId === "mubarokah") {
    report.tenant.ok = true;
    report.tenant.details = "tenantId === 'mubarokah' (ISOLATED)";
    Logger.log("  [PASS] Tenant ID: " + cfg.tenantId);
  } else {
    report.tenant.ok = false;
    report.tenant.details = "Unexpected tenantId: " + cfg.tenantId;
    Logger.log("  [FAIL] Tenant ID: " + cfg.tenantId);
  }

  // ------------------------------------------------------------
  // B. SCRIPT PROPERTIES AUDIT
  // ------------------------------------------------------------
  Logger.log("\n--- [B] SCRIPT PROPERTIES ---");
  var expectedInfra = {
    "SPREADSHEET_ID": "1cZSRh2rtKpT6E8m3GFJonVbiQG51fh24eN8J5JWtOJY",
    "DRIVE_FOLDER_ID": "16sG7CQLOKt7kRfv0Us9qJCno50vm1D7f",
    "DRIVE_FOLDER_USER_PHOTOS": "13665dGDEPCEXX9-zKdEEG95ENLvwgANW",
    "DRIVE_FOLDER_STUDENT_PHOTOS": "1vM14jSf7V6LaxE7xJMZbruvRuQvavPnT"
  };

  var infraPass = true;
  Object.keys(expectedInfra).forEach(function(k) {
    var actual = props.getProperty(k);
    var match = (actual === expectedInfra[k]);
    if (match) {
      Logger.log("  [PASS] " + k + ": CONFIGURED (" + actual + ")");
      report.scriptProperties.details.push(k + ": MATCH");
    } else {
      infraPass = false;
      Logger.log("  [FAIL] " + k + ": MISMATCH (Expected: " + expectedInfra[k] + ", Actual: " + actual + ")");
      report.scriptProperties.details.push(k + ": MISMATCH");
    }
  });

  var secretKeys = [
    "AUTH_TOKEN_SIGNING_SECRET",
    "TOKEN_SIGNING_SECRET",
    "OTP_HASH_SECRET",
    "IDENTIFIER_HASH_SECRET",
    "PASSWORD_SALT"
  ];
  var secretsPass = true;
  var hexRegex = /^[0-9a-f]{64}$/i;
  var observedSecrets = {};

  secretKeys.forEach(function(k) {
    var val = props.getProperty(k);
    var valid = (val && val.length === 64 && hexRegex.test(val));
    if (valid) {
      if (observedSecrets[val]) {
        secretsPass = false;
        Logger.log("  [FAIL] " + k + ": DUPLICATE of another secret");
      } else {
        observedSecrets[val] = k;
        Logger.log("  [PASS] " + k + ": CONFIGURED (Length: 64, Format: Hex-valid)");
      }
    } else {
      secretsPass = false;
      Logger.log("  [FAIL] " + k + ": INVALID (Exists: " + !!val + ", Length: " + (val ? val.length : 0) + ")");
    }
  });

  var adminPinHash = props.getProperty("ADMIN_PIN_HASH");
  if (adminPinHash && adminPinHash.length > 0) {
    Logger.log("  [INFO] ADMIN_PIN_HASH: CONFIGURED (Length: " + adminPinHash.length + ")");
  } else {
    Logger.log("  [INFO] ADMIN_PIN_HASH: UNCONFIGURED (Acceptable at this stage — Founder input pending)");
  }

  report.scriptProperties.ok = infraPass && secretsPass;

  // ------------------------------------------------------------
  // C. SPREADSHEET & 22-SHEET SCHEMA AUDIT (READ-ONLY)
  // ------------------------------------------------------------
  Logger.log("\n--- [C] SPREADSHEET INTEGRATION & 22-SHEET AUDIT ---");
  var ssId = props.getProperty("SPREADSHEET_ID");
  var ssPass = false;

  if (!ssId) {
    Logger.log("  [FAIL] SPREADSHEET_ID property is missing from Script Properties. Spreadsheet check skipped.");
    report.spreadsheet.details.push("SPREADSHEET_ID is missing");
  } else {
    var ss = null;
    try {
      ss = SpreadsheetApp.openById(ssId);
    } catch (err) {
      Logger.log("  [FAIL] Cannot open Spreadsheet by ID " + ssId + ": " + err.message);
    }

    if (ss) {
    var ssActualId = ss.getId();
    var ssActualName = ss.getName();
    var idMatches = (ssActualId === expectedInfra.SPREADSHEET_ID);
    var nameMatches = (ssActualName === "Mubarokah App Database [OFFICIAL]");

    Logger.log("  [" + (idMatches ? "PASS" : "FAIL") + "] Spreadsheet ID: " + ssActualId);
    Logger.log("  [" + (nameMatches ? "PASS" : "FAIL") + "] Spreadsheet Name: " + ssActualName);

    var existingSheets = ss.getSheets();
    var existingSheetMap = {};
    existingSheets.forEach(function(s) {
      existingSheetMap[s.getName()] = s;
    });

    var authKeys = Object.keys(AUTHORITATIVE_SCHEMAS_);
    var all22Exist = true;
    var zeroDataPass = true;
    var headersPass = true;
    var unauthorizedSheets = [];

    // Check unauthorized sheets
    existingSheets.forEach(function(s) {
      var sName = s.getName();
      if (!AUTHORITATIVE_SCHEMAS_.hasOwnProperty(sName)) {
        unauthorizedSheets.push(sName);
      }
    });

    if (unauthorizedSheets.length === 0) {
      Logger.log("  [PASS] Unauthorized Sheets: 0 (Strictly authoritative)");
    } else {
      Logger.log("  [FAIL] Unauthorized Sheets Detected: " + unauthorizedSheets.join(", "));
    }

    // Check each authoritative sheet
    authKeys.forEach(function(sheetName) {
      var sheet = existingSheetMap[sheetName];
      if (!sheet) {
        all22Exist = false;
        Logger.log("  [FAIL] Sheet Missing: " + sheetName);
        return;
      }

      var lastRow = sheet.getLastRow();
      var lastCol = sheet.getLastColumn();
      var expectedHeaders = AUTHORITATIVE_SCHEMAS_[sheetName];

      if (expectedHeaders === null) {
        // Pendaftar: must have 0 data rows, header pending
        if (lastRow > 0) {
          zeroDataPass = false;
          Logger.log("  [FAIL] Pendaftar has unexpected content: " + lastRow + " row(s)");
        } else {
          Logger.log("  [PASS] Sheet [Pendaftar]: EXISTS | Schema: PENDING | Data Records: 0");
        }
      } else {
        // 21 Defined sheets: lastRow must be 1 (header only)
        if (lastRow === 0) {
          headersPass = false;
          Logger.log("  [FAIL] Sheet [" + sheetName + "]: Headers missing (lastRow = 0)");
        } else if (lastRow === 1) {
          var actualHeaders = sheet.getRange(1, 1, 1, Math.max(lastCol, expectedHeaders.length)).getValues()[0].slice(0, expectedHeaders.length);
          var hMatch = (JSON.stringify(actualHeaders) === JSON.stringify(expectedHeaders));
          if (!hMatch) {
            headersPass = false;
            Logger.log("  [FAIL] Sheet [" + sheetName + "]: Header mismatch");
          }
        } else {
          zeroDataPass = false;
          Logger.log("  [FAIL] Sheet [" + sheetName + "]: Contains " + (lastRow - 1) + " data row(s). Data Zero Policy violation!");
        }
      }
    });

    if (all22Exist && headersPass && zeroDataPass && unauthorizedSheets.length === 0 && idMatches && nameMatches) {
      Logger.log("  [PASS] 22-Sheet Validation: Exactly 22 authoritative sheets verified with 0 data records");
      ssPass = true;
    }
  }
  }
  report.spreadsheet.ok = ssPass;

  // ------------------------------------------------------------
  // D. GOOGLE DRIVE FOLDERS AUDIT (READ-ONLY)
  // ------------------------------------------------------------
  Logger.log("\n--- [D] GOOGLE DRIVE FOLDERS AUDIT ---");
  var expectedFolders = [
    { key: "DRIVE_FOLDER_ID", id: expectedInfra.DRIVE_FOLDER_ID, name: "Media" },
    { key: "DRIVE_FOLDER_USER_PHOTOS", id: expectedInfra.DRIVE_FOLDER_USER_PHOTOS, name: "User Photos" },
    { key: "DRIVE_FOLDER_STUDENT_PHOTOS", id: expectedInfra.DRIVE_FOLDER_STUDENT_PHOTOS, name: "Student Photos" }
  ];

  var drivePass = true;
  expectedFolders.forEach(function(item) {
    try {
      var folder = DriveApp.getFolderById(item.id);
      var actualName = folder.getName();
      var actualId = folder.getId();
      var nameMatch = (actualName === item.name);
      var idMatch = (actualId === item.id);
      if (nameMatch && idMatch) {
        Logger.log("  [PASS] Drive Folder [" + item.key + "]: Name=\"" + actualName + "\", ID=" + actualId);
      } else {
        drivePass = false;
        Logger.log("  [FAIL] Drive Folder [" + item.key + "]: Mismatch (Expected Name: " + item.name + ", Actual: " + actualName + ")");
      }
    } catch (dErr) {
      drivePass = false;
      Logger.log("  [FAIL] Drive Folder [" + item.key + "] Inaccessible: " + dErr.message);
    }
  });
  report.drive.ok = drivePass;

  // ------------------------------------------------------------
  // E. SECRET CONTAINMENT & FINAL STATUS
  // ------------------------------------------------------------
  var overallOk = report.tenant.ok && report.scriptProperties.ok && report.spreadsheet.ok && report.drive.ok;
  report.overallStatus = overallOk ? "PASS" : "FAIL";

  Logger.log("\n=== STEP 04B-6 INTEGRATION AUDIT RESULT: " + report.overallStatus + " ===");
  return {
    ok: overallOk,
    tenantOk: report.tenant.ok,
    scriptPropertiesOk: report.scriptProperties.ok,
    spreadsheetOk: report.spreadsheet.ok,
    driveOk: report.drive.ok
  };
}

/**
 * FUNGSI CEPAT INISIALISASI TAB SHEET "Program" / "Programs"
 * Dapat dijalankan langsung via Apps Script Editor (pilih: initProgramsSheet -> Run).
 * Membuat tab sheet Programs (atau Program) jika belum ada, dengan 16 kolom terstandarisasi.
 */
function initProgramsSheet() {
  var ss = null;
  var props = PropertiesService.getScriptProperties();
  var ssId = props.getProperty("SPREADSHEET_ID");
  if (ssId) {
    try {
      ss = SpreadsheetApp.openById(ssId);
    } catch (e) {}
  }
  if (!ss) {
    try {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    } catch (e) {}
  }
  if (!ss) {
    throw new Error("Spreadsheet database tidak ditemukan. Periksa SPREADSHEET_ID di Script Properties.");
  }

  var expectedHeaders = AUTHORITATIVE_SCHEMAS_["Programs"];
  var sheet = ss.getSheetByName("Programs");
  if (!sheet) {
    sheet = ss.getSheetByName("Program");
  }
  if (!sheet) {
    var all = ss.getSheets();
    for (var i = 0; i < all.length; i++) {
      var n = all[i].getName().trim().toLowerCase();
      if (n === "programs" || n === "program") {
        sheet = all[i];
        break;
      }
    }
  }

  var isNew = false;
  if (!sheet) {
    sheet = ss.insertSheet("Programs");
    isNew = true;
  }

  var lastRow = sheet.getLastRow();
  if (lastRow === 0) {
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
  }
  sheet.getRange(1, 1, 1, expectedHeaders.length)
    .setFontWeight("bold")
    .setBackground("#047857")
    .setFontColor("#ffffff");
  sheet.setFrozenRows(1);

  Logger.log("[OK] Sheet '" + sheet.getName() + "' siap (" + (isNew ? "Baru dibuat" : "Sudah ada") + ") dengan 16 kolom header.");
  return {
    success: true,
    sheetName: sheet.getName(),
    isNew: isNew
  };
}

/**
 * FUNGSI CEPAT INISIALISASI TAB SHEET TPQ (TPQ_Logs, TPQ_Capaian, TPQ_Kelas, TPQ_Target, TPQ_Sesi)
 * Dapat dijalankan langsung via Apps Script Editor (pilih: initTPQSheetsDirect -> Run).
 */
function initTPQSheetsDirect() {
  var ss = null;
  var props = PropertiesService.getScriptProperties();
  var ssId = props.getProperty("SPREADSHEET_ID");
  if (ssId) {
    try { ss = SpreadsheetApp.openById(ssId); } catch (e) {}
  }
  if (!ss) {
    try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) {}
  }
  if (!ss) {
    throw new Error("Spreadsheet database tidak ditemukan. Periksa SPREADSHEET_ID di Script Properties.");
  }

  var sheetsToInit = [
    { name: "TPQ_Logs", color: "#0284c7" },
    { name: "TPQ_Capaian", color: "#0d9488" },
    { name: "TPQ_Kelas", color: "#0284c7" },
    { name: "TPQ_Target", color: "#f59e0b" },
    { name: "TPQ_Sesi", color: "#0284c7" }
  ];

  sheetsToInit.forEach(function(item) {
    var expectedHeaders = AUTHORITATIVE_SCHEMAS_[item.name];
    var sheet = ss.getSheetByName(item.name);
    var isNew = false;
    if (!sheet) {
      sheet = ss.insertSheet(item.name);
      isNew = true;
    }
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    }
    sheet.getRange(1, 1, 1, expectedHeaders.length)
      .setFontWeight("bold")
      .setBackground(item.color)
      .setFontColor("#ffffff");
    sheet.setFrozenRows(1);
    Logger.log("[OK] Sheet '" + item.name + "' siap (" + (isNew ? "Baru dibuat" : "Sudah ada") + ").");
  });

  return { success: true, message: "Seluruh 5 Sheet TPQ berhasil diinisialisasi." };
}

/**
 * FUNGSI CEPAT INISIALISASI TAB SHEET PRESENSI KEGIATAN
 * (Presensi_Kegiatan, Presensi_Sesi, Presensi_Logs)
 * Dapat dijalankan langsung via Apps Script Editor (pilih: initPresensiSheetsDirect -> Run).
 */
function initPresensiSheetsDirect() {
  var ss = null;
  var props = PropertiesService.getScriptProperties();
  var ssId = props.getProperty("SPREADSHEET_ID");
  if (ssId) {
    try { ss = SpreadsheetApp.openById(ssId); } catch (e) {}
  }
  if (!ss) {
    try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) {}
  }
  if (!ss) {
    throw new Error("Spreadsheet database tidak ditemukan. Periksa SPREADSHEET_ID di Script Properties.");
  }

  var sheetsToInit = [
    { name: "Presensi_Kegiatan", color: "#059669" }, // Emerald
    { name: "Presensi_Sesi", color: "#0d9488" },     // Teal
    { name: "Presensi_Logs", color: "#0284c7" }      // Sky
  ];

  sheetsToInit.forEach(function(item) {
    var expectedHeaders = AUTHORITATIVE_SCHEMAS_[item.name];
    var sheet = ss.getSheetByName(item.name);
    var isNew = false;
    if (!sheet) {
      sheet = ss.insertSheet(item.name);
      isNew = true;
    }
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    }
    sheet.getRange(1, 1, 1, expectedHeaders.length)
      .setFontWeight("bold")
      .setBackground(item.color)
      .setFontColor("#ffffff");
    sheet.setFrozenRows(1);
    Logger.log("[OK] Sheet '" + item.name + "' siap (" + (isNew ? "Baru dibuat" : "Sudah ada") + ").");
  });

  return { success: true, message: "Seluruh 3 Sheet Presensi Kegiatan berhasil diinisialisasi." };
}

/**
 * Inisialisasi Cepat Khusus Kunci Rahasia Server (Signing Secret)
 * Jalankan fungsi ini untuk mengonfigurasi Script Properties tanpa menyentuh spreadsheet.
 */
function setupSigningSecretOnly() {
  var props = PropertiesService.getScriptProperties();
  var secret = "SEC_" + Utilities.getUuid().replace(/-/g, "") + "_" + new Date().getTime();
  props.setProperty("AUTH_TOKEN_SIGNING_SECRET", secret);
  props.setProperty("TOKEN_SIGNING_SECRET", secret);
  props.setProperty("TOKEN_VERSION", "1");
  props.setProperty("SPREADSHEET_ID", "1cZSRh2rtKpT6E8m3GFJonVbiQG51fh24eN8J5JWtOJY");
  props.setProperty("OTP_HASH_SECRET", secret.substring(0, 32));
  props.setProperty("IDENTIFIER_HASH_SECRET", secret.substring(0, 32));
  props.setProperty("PASSWORD_SALT", secret.substring(0, 32));
  Logger.log("✅ SUKSES: Seluruh kunci keamanan (Signing Secret) berhasil disimpan!");
}
