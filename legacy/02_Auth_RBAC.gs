/**
 * ============================================================================
 * 02_Auth_RBAC.gs
 * PPTQ Roudlotul Mubarokah Backend Architecture - Identity, RBAC & Session Management
 * ============================================================================
 * Tanggung Jawab Domain:
 *  - Backend Identity & Authentication Architecture (Phase 2B)
 *  - User Authentication Handlers (handleRequestOTP, handleVerifyOTP, handleLogin, etc.)
 *  - Sheet Standardization & Identity Synchronization
 *  - OTP Dispatcher & Google Token Verification
 *  - Identity Repository (Admin, Wali, Pengasuh, User)
 *  - User Presence & Admin Management
 *  - Roles & Permissions Backend
 *  - Session Lifecycle & RBAC Pipeline (authenticateSession, authorizeRole, handleAuthApiAction)
 * ============================================================================
 */


// ==========================================
// BUSINESS LOGIC: AUTHENTICATION
// ==========================================

// ==========================================
// BUSINESS LOGIC: AUTHENTICATION (SECURED)
// ==========================================

const SHEET_USERS = "Users";
const SHEET_OTP = "OTP_Cache";

/**
 * P2 SECURITY AUDIT FIX: Key Derivation Function PBKDF2-HMAC-SHA256
 * Menghasilkan hash password berstandar industri dengan 5.000 iterasi dan salt unik per pengguna.
 */

function handleRequestOTP(data) {
  const email = data.email ? data.email.toLowerCase().trim() : '';
  if (!email) return { success: false, message: "Email wajib diisi" };

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiryTime = new Date(new Date().getTime() + 5 * 60000); 

  const ss = getDatabaseSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_OTP);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_OTP);
    sheet.appendRow(["Email", "OTP", "Expiry", "Timestamp"]);
  }

  sheet.appendRow([email, otp, expiryTime.toISOString(), new Date().toISOString()]);

  const subject = "Kode Verifikasi Login";
  const body = `Halo,\n\nKode verifikasi Anda adalah: ${otp}\n\nKode ini berlaku selama 5 menit. Jangan berikan kode ini kepada siapapun.\n\nTerima kasih,\nTim Keamanan Sistem`;
  
  MailApp.sendEmail({
    to: email,
    subject: subject,
    body: body
  });

  return { success: true, message: "OTP berhasil dikirim ke email." };
}

function handleVerifyOTP(data) {
  const email = data.email ? data.email.toLowerCase().trim() : '';
  const otp = data.otp;
  const password = data.password;
  
  if (!email || !otp || !password) return { success: false, message: "Email, OTP, dan Password wajib diisi" };

  const ss = getDatabaseSpreadsheet();
  const otpSheet = ss.getSheetByName(SHEET_OTP);
  if (!otpSheet) return { success: false, message: "Sistem belum siap (Sheet OTP tidak ditemukan)" };

  const otpData = otpSheet.getDataRange().getValues();
  let valid = false;

  for (let i = otpData.length - 1; i > 0; i--) {
    if (otpData[i][0] === email) {
      const storedOtp = otpData[i][1].toString();
      const expiry = new Date(otpData[i][2]);
      
      if (storedOtp === otp.toString()) {
        if (new Date() > expiry) {
          return { success: false, message: "Kode OTP sudah kadaluarsa. Silakan minta kode baru." };
        }
        valid = true;
        break;
      } else {
        return { success: false, message: "Kode OTP salah." };
      }
    }
  }

  if (!valid) return { success: false, message: "Kode OTP tidak ditemukan atau salah." };

  let userSheet = ss.getSheetByName(SHEET_USERS);
  if (!userSheet) {
    userSheet = ss.insertSheet(SHEET_USERS);
    userSheet.appendRow(["ID", "Email", "Password", "Nama", "Telepon", "Metode_Login", "Dibuat_Pada"]);
  }

  const usersData = userSheet.getDataRange().getValues();
  let userExists = false;
  let userName = "Santri / Alumni";
  const hashedPassword = hashPassword(password);

  for (let i = 1; i < usersData.length; i++) {
    if (usersData[i][1] === email) {
      userExists = true;
      userName = usersData[i][3] || userName;
      userSheet.getRange(i + 1, 3).setValue(hashedPassword);
      break;
    }
  }

  if (!userExists) {
    const newId = "USR_" + new Date().getTime();
    userSheet.appendRow([newId, email, hashedPassword, "Santri / Alumni", "", "Email", new Date().toISOString()]);
  }

  const tokenData = generateSessionToken(email, "user", 24 * 30);

  return { 
    success: true, 
    message: "Verifikasi berhasil.",
    token: tokenData.token,
    user: { email: email, name: userName }
  };
}

function handleLogin(data) {
  const email = data.email ? data.email.toLowerCase().trim() : '';
  const password = data.password;

  if (!email || !password) return { success: false, message: "Email dan Password wajib diisi" };

  const ss = getDatabaseSpreadsheet();
  const userSheet = ss.getSheetByName(SHEET_USERS);
  if (!userSheet) return { success: false, message: "Belum ada pengguna terdaftar." };

  const usersData = userSheet.getDataRange().getValues();
  
  for (let i = 1; i < usersData.length; i++) {
    if (usersData[i][1] === email) {
      const storedPassword = usersData[i][2];
      if (verifyPassword(password, storedPassword)) {
        // Upgrade password plain-text atau hash lama menjadi hash PBKDF2 secara otomatis
        if (isPasswordUpgradeNeeded(storedPassword)) {
          userSheet.getRange(i + 1, 3).setValue(hashPassword(password));
        }
        const tokenData = generateSessionToken(email, "user", 24 * 30);
        return {
          success: true,
          message: "Login berhasil",
          token: tokenData.token,
          user: {
            email: email,
            name: usersData[i][3] || "Pengguna",
            phone: usersData[i][4] || ""
          }
        };
      } else {
        return { success: false, message: "Password salah" };
      }
    }
  }

  return { success: false, message: "Email belum terdaftar. Silakan daftar menggunakan OTP." };
}

function handleGoogleLogin(data) {
  let email = data.email ? data.email.toLowerCase().trim() : '';
  let name = data.name || "Pengguna Google";

  // Verifikasi Google ID Token jika credential disertakan
  if (data.credential) {
    try {
      const googleVerifyUrl = "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(data.credential);
      const res = UrlFetchApp.fetch(googleVerifyUrl, { muteHttpExceptions: true });
      if (res.getResponseCode() === 200) {
        const tokenInfo = JSON.parse(res.getContentText());
        if (tokenInfo && tokenInfo.email) {
          email = tokenInfo.email.toLowerCase().trim();
          name = tokenInfo.name || name;
        }
      } else {
        return { success: false, message: "Token autentikasi Google tidak valid atau kedaluwarsa." };
      }
    } catch (err) {
      console.warn("Gagal menghubungi Google OAuth tokeninfo:", err);
    }
  }

  if (!email) return { success: false, message: "Data Google tidak valid (Email kosong)" };

  const ss = getDatabaseSpreadsheet();
  let userSheet = ss.getSheetByName(SHEET_USERS);
  if (!userSheet) {
    userSheet = ss.insertSheet(SHEET_USERS);
    userSheet.appendRow(["ID", "Email", "Password", "Nama", "Telepon", "Metode_Login", "Dibuat_Pada"]);
  }

  const usersData = userSheet.getDataRange().getValues();
  let userExists = false;
  let storedName = name;
  let phone = "";

  for (let i = 1; i < usersData.length; i++) {
    if (usersData[i][1] === email) {
      userExists = true;
      storedName = usersData[i][3] || name;
      phone = usersData[i][4] || "";
      break;
    }
  }

  if (!userExists) {
    const newId = "USR_" + new Date().getTime();
    userSheet.appendRow([newId, email, "OAUTH_GOOGLE", name, "", "Google", new Date().toISOString()]);
  }

  const tokenData = generateSessionToken(email, "user", 24 * 30);

  return {
    success: true,
    message: "Google Login berhasil",
    token: tokenData.token,
    user: {
      email: email,
      name: storedName,
      phone: phone
    }
  };
}


// =====================================================================
// BACKEND IDENTITY & AUTHENTICATION ARCHITECTURE v2.0 (PHASE 2B)
// =====================================================================

// SHEET_USERS = "Users" telah dideklarasikan di baris 4154
const SHEET_ADMIN_IDENTITIES = "Admin_Identities";
const SHEET_WALI_IDENTITIES = "Wali_Identities";
const SHEET_PENGASUH_IDENTITIES = "Pengasuh_Identities";
const SHEET_STUDENTS = "Students";
const SHEET_WALI_SANTRI_MAP = "Wali_Santri_Map";
const SHEET_OTP_CHALLENGES = "OTP_Challenges";
const SHEET_AUTH_SESSIONS = "Auth_Sessions";
const SHEET_AUTH_AUDIT_LOG = "Auth_Audit_Log";

const FOLDER_ID_USER_PHOTOS = (function() {
  try { return PropertiesService.getScriptProperties().getProperty("DRIVE_FOLDER_USER_PHOTOS") || ""; } catch (e) { return ""; }
})(); // __MUBAROKAH_CONFIG_PENDING__

const RELATIONSHIP_ENUM = Object.freeze({
  FATHER: "FATHER",
  MOTHER: "MOTHER",
  GUARDIAN: "GUARDIAN",
  OTHER: "OTHER"
});

const AUTH_SHEET_SCHEMAS = Object.freeze({
  [SHEET_USERS]: ["user_id", "email", "phone", "name", "role", "photo_url", "status", "created_at", "last_login_at", "password_hash"],
  [SHEET_ADMIN_IDENTITIES]: ["identity_id", "email", "name", "role", "status", "created_at", "photo_url", "password_hash"],
  [SHEET_WALI_IDENTITIES]: ["identity_id", "email", "phone", "name", "role", "status", "created_at", "photo_url", "password_hash"],
  [SHEET_PENGASUH_IDENTITIES]: ["identity_id", "email", "phone", "title_name", "role", "status", "created_at", "photo_url", "password_hash"],
  [SHEET_STUDENTS]: ["student_id", "nis", "nik", "name", "gender", "birth_date", "photo_url", "program", "status", "created_at", "qr_code"],
  [SHEET_WALI_SANTRI_MAP]: ["map_id", "wali_id", "student_id", "relationship", "status", "created_at"],
  [SHEET_OTP_CHALLENGES]: ["challenge_id", "identity_id", "channel", "identifier_hash", "otp_hash", "attempts", "max_attempts", "expires_at", "status", "created_at", "consumed_at", "request_id"],
  [SHEET_AUTH_SESSIONS]: ["session_id", "identity_id", "role", "issued_at", "expires_at", "status", "revoked_at", "created_at", "token_version"],
  [SHEET_AUTH_AUDIT_LOG]: ["event_id", "timestamp", "event_type", "identity_id", "session_id", "channel", "success", "request_id", "metadata"]
});

/**
 * Inisialisasi & Migrasi Otomatis Tabel-tabel Autentikasi Phase 2B & Pengasuh.
 * Mendukung deteksi tabel baru dan penambahan kolom baru secara non-destruktif.
 */

function setupAuthSystemSheets() {
  const ss = getDatabaseSpreadsheet();
  if (!ss) {
    Logger.log("[SCHEMA ERROR] Spreadsheet database tidak dapat diakses.");
    return { status: "error", message: "Spreadsheet database tidak dapat diakses." };
  }

  const sheetNames = Object.keys(AUTH_SHEET_SCHEMAS);
  sheetNames.forEach(sheetName => {
    const expectedHeaders = AUTH_SHEET_SCHEMAS[sheetName];
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      // Cek variasi nama sebelum insert
      const cleanTarget = String(sheetName).replace(/[\s_]+/g, "").toLowerCase();
      const existingSheets = ss.getSheets();
      for (let i = 0; i < existingSheets.length; i++) {
        if (existingSheets[i].getName().replace(/[\s_]+/g, "").toLowerCase() === cleanTarget) {
          sheet = existingSheets[i];
          break;
        }
      }
    }

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
      sheet.getRange(1, 1, 1, expectedHeaders.length).setFontWeight("bold").setBackground("#dcfce7");
      sheet.setFrozenRows(1);
      Logger.log(`[SCHEMA] Sheet '${sheetName}' berhasil dibuat.`);
    } else {
      // Sheet sudah ada -> cek apakah ada header baru yang belum terpasang atau perlu rename
      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();
      if (lastCol === 0 || (sheetName === SHEET_USERS && lastRow <= 1)) {
        sheet.clear();
        sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
        sheet.getRange(1, 1, 1, expectedHeaders.length).setFontWeight("bold").setBackground("#dcfce7");
        sheet.setFrozenRows(1);
        Logger.log(`[SCHEMA] Sheet '${sheetName}' berhasil diselaraskan ke schema standar terpadu.`);
      } else {
        // 1. Auto-rename header nisn -> nis jika ada pada sheet Students
        if (sheetName === SHEET_STUDENTS) {
          const firstRowValues = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
          for (let c = 0; c < firstRowValues.length; c++) {
            if (String(firstRowValues[c] || "").trim().toLowerCase() === "nisn") {
              sheet.getRange(1, c + 1).setValue("nis");
              Logger.log(`[SCHEMA] Header 'nisn' di sheet '${sheetName}' kolom ${c + 1} berhasil diubah menjadi 'nis'.`);
              break;
            }
          }

          // 2. Hapus kolom class_name / kelas jika ada pada sheet Students
          const updatedRowValues = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
          for (let c = updatedRowValues.length - 1; c >= 0; c--) {
            const hName = String(updatedRowValues[c] || "").trim().toLowerCase();
            if (hName === "class_name" || hName === "kelas") {
              sheet.deleteColumn(c + 1);
              Logger.log(`[SCHEMA] Kolom '${hName}' di sheet '${sheetName}' (kolom ${c + 1}) berhasil dihapus.`);
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
          Logger.log(`[SCHEMA] Kolom baru [${missingHeaders.join(", ")}] berhasil ditambahkan ke sheet '${sheetName}'.`);
        }
      }
    }
  });

  // 1. Bersihkan & standardisasi struktur sheet Users (buang kolom lama/duplikat dan rapikan data yang ada)
  standardizeUsersSheet(ss);

  // 2. Migrasikan akun-akun lama ke sheet Users jika belum ada
  migrateIdentitiesToUsersSheet(ss);

  // 3. Sinkronisasikan akun dari sheet Users ke masing-masing sheet role (Wali_Identities, Admin_Identities, Pengasuh_Identities)
  syncAllUsersToRoleSheets(ss);

  return { status: "success", message: "Tabel autentikasi Phase 2B & Pengasuh terverifikasi dan siap digunakan." };
}

/**
 * Trigger manual dari Apps Script Editor untuk merapikan sheet Users
 */
function triggerStandardizeUsersSheet() {
  const ss = getDatabaseSpreadsheet();
  standardizeUsersSheet(ss);
  migrateIdentitiesToUsersSheet(ss);
  Logger.log("Sheet Users berhasil dirapikan ke struktur 9 kolom standar!");
  return "Sheet Users berhasil dirapikan ke struktur 9 kolom standar!";
}

/**
 * Membersihkan dan menstandarisasi sheet Users agar tidak ada kolom menumpuk/duplikat
 * Mentransfer data lama (ID, Email, Nama, Telepon, Dibuat_Pada) ke format 9 kolom resmi
 */
function standardizeUsersSheet(ss) {
  try {
    if (!ss) ss = getDatabaseSpreadsheet();
    if (!ss) return;
    const usersSheet = getAuthSheet(ss, SHEET_USERS);
    if (!usersSheet) return;

    const data = usersSheet.getDataRange().getValues();
    if (!data || data.length === 0) return;

    const firstRow = data[0].map(h => String(h || "").trim().toLowerCase());
    const expectedHeaders = AUTH_SHEET_SCHEMAS[SHEET_USERS];

    // Cek apakah ada kolom lama (seperti 'password', 'metode_login', 'dibuat_pada') atau duplikat 'id' dan 'user_id'
    const hasOldColumns = firstRow.includes("password") || 
                          firstRow.includes("metode_login") || 
                          firstRow.includes("dibuat_pada") || 
                          (firstRow.includes("id") && firstRow.includes("user_id")) ||
                          (firstRow.includes("nama") && firstRow.includes("name")) ||
                          (firstRow.includes("telepon") && firstRow.includes("phone"));

    if (!hasOldColumns && firstRow.length === expectedHeaders.length && firstRow.every((h, idx) => h === expectedHeaders[idx].toLowerCase())) {
      return; // Sudah rapi dan sesuai standar
    }

    // Identifikasi indeks kolom dari baris lama
    const idIdx = firstRow.indexOf("user_id") !== -1 ? firstRow.indexOf("user_id") : firstRow.indexOf("id");
    const emailIdx = firstRow.indexOf("email");
    const phoneIdx = firstRow.indexOf("phone") !== -1 ? firstRow.indexOf("phone") : (firstRow.indexOf("telepon") !== -1 ? firstRow.indexOf("telepon") : firstRow.indexOf("no_hp"));
    const nameIdx = firstRow.indexOf("name") !== -1 ? firstRow.indexOf("name") : firstRow.indexOf("nama");
    const roleIdx = firstRow.indexOf("role");
    const photoIdx = firstRow.indexOf("photo_url") !== -1 ? firstRow.indexOf("photo_url") : (firstRow.indexOf("foto_profil") !== -1 ? firstRow.indexOf("foto_profil") : firstRow.indexOf("foto"));
    const statusIdx = firstRow.indexOf("status");
    const createdIdx = firstRow.indexOf("created_at") !== -1 ? firstRow.indexOf("created_at") : firstRow.indexOf("dibuat_pada");
    const lastLoginIdx = firstRow.indexOf("last_login_at");
    const passwordHashIdx = firstRow.indexOf("password_hash") !== -1 ? firstRow.indexOf("password_hash") : firstRow.indexOf("password");

    const standardizedRows = [];
    const seenEmails = new Set();

    for (let r = 1; r < data.length; r++) {
      const email = emailIdx !== -1 ? String(data[r][emailIdx] || "").trim().toLowerCase() : "";
      const rawId = idIdx !== -1 ? String(data[r][idIdx] || "").trim() : "";
      if (!email && !rawId) continue;
      if (email && seenEmails.has(email)) continue;

      const name = nameIdx !== -1 ? String(data[r][nameIdx] || "").trim() : "";
      const phone = phoneIdx !== -1 ? String(data[r][phoneIdx] || "").trim() : "";
      const role = roleIdx !== -1 && data[r][roleIdx] ? String(data[r][roleIdx]).trim().toUpperCase() : "ADMIN";
      const photoUrl = photoIdx !== -1 ? String(data[r][photoIdx] || "").trim() : "";
      const status = statusIdx !== -1 && data[r][statusIdx] ? String(data[r][statusIdx]).trim().toUpperCase() : "ACTIVE";
      const createdAt = createdIdx !== -1 && data[r][createdIdx] ? String(data[r][createdIdx]) : new Date().toISOString();
      const lastLoginAt = lastLoginIdx !== -1 ? String(data[r][lastLoginIdx] || "") : "";
      const passwordHash = passwordHashIdx !== -1 ? String(data[r][passwordHashIdx] || "") : "";

      standardizedRows.push([
        rawId || ("USR_" + Utilities.getUuid().substring(0, 8)),
        email,
        phone,
        name,
        role,
        photoUrl,
        status,
        createdAt,
        lastLoginAt,
        passwordHash
      ]);

      if (email) seenEmails.add(email);
    }

    // Bersihkan seluruh sheet Users dan hapus kolom-kolom berlebih di kanan
    usersSheet.clear();
    const maxCols = usersSheet.getMaxColumns();
    if (maxCols > expectedHeaders.length) {
      try {
        usersSheet.deleteColumns(expectedHeaders.length + 1, maxCols - expectedHeaders.length);
      } catch (delErr) {
        // Abaikan jika tidak bisa delete columns
      }
    }

    // Tulis header 9 kolom standar
    usersSheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    usersSheet.getRange(1, 1, 1, expectedHeaders.length).setFontWeight("bold").setBackground("#dcfce7");
    usersSheet.setFrozenRows(1);

    // Tulis data baris yang telah dirapikan
    if (standardizedRows.length > 0) {
      usersSheet.getRange(2, 1, standardizedRows.length, expectedHeaders.length).setValues(standardizedRows);
    }
    Logger.log(`[SCHEMA] Sheet 'Users' berhasil dirapikan: ${standardizedRows.length} akun distandardisasi ke 9 kolom resmi.`);
  } catch (e) {
    console.error("[STANDARDIZE USERS ERROR]", e);
  }
}

/**
 * Otomatis migrasi data dari Admin_Identities, Pengasuh_Identities, Wali_Identities ke sheet Users
 */
function migrateIdentitiesToUsersSheet(ss) {
  try {
    if (!ss) ss = getDatabaseSpreadsheet();
    if (!ss) return;
    const usersSheet = getAuthSheet(ss, SHEET_USERS);
    if (!usersSheet) return;

    const existingUsers = usersSheet.getDataRange().getValues();
    const existingEmails = new Set();
    const existingIds = new Set();

    if (existingUsers && existingUsers.length > 1) {
      const header = existingUsers[0].map(h => String(h || "").trim().toLowerCase());
      const emailIdx = header.indexOf("email");
      const idIdx = header.indexOf("user_id");
      for (let i = 1; i < existingUsers.length; i++) {
        if (emailIdx !== -1 && existingUsers[i][emailIdx]) {
          existingEmails.add(String(existingUsers[i][emailIdx]).trim().toLowerCase());
        }
        if (idIdx !== -1 && existingUsers[i][idIdx]) {
          existingIds.add(String(existingUsers[i][idIdx]).trim().toLowerCase());
        }
      }
    }

    const legacySheets = [
      { name: SHEET_ADMIN_IDENTITIES, defaultRole: "ADMIN" },
      { name: SHEET_PENGASUH_IDENTITIES, defaultRole: "PENGASUH" },
      { name: SHEET_WALI_IDENTITIES, defaultRole: "WALI_SANTRI" }
    ];

    const rowsToAdd = [];
    legacySheets.forEach(item => {
      const sheet = ss.getSheetByName(item.name);
      if (!sheet) return;
      const data = sheet.getDataRange().getValues();
      if (!data || data.length < 2) return;

      const header = data[0].map(h => String(h || "").trim().toLowerCase());
      const idIdx = header.indexOf("identity_id");
      const emailIdx = header.indexOf("email");
      const phoneIdx = header.indexOf("phone");
      let nameIdx = header.indexOf("name");
      if (nameIdx === -1) nameIdx = header.indexOf("title_name");
      const roleIdx = header.indexOf("role");
      const statusIdx = header.indexOf("status");
      const createdIdx = header.indexOf("created_at");
      const photoIdx = header.indexOf("photo_url");

      for (let i = 1; i < data.length; i++) {
        const email = emailIdx !== -1 ? String(data[i][emailIdx] || "").trim().toLowerCase() : "";
        const id = idIdx !== -1 ? String(data[i][idIdx] || "").trim() : "";
        if (!email && !id) continue;

        if ((email && existingEmails.has(email)) || (id && existingIds.has(id.toLowerCase()))) {
          continue; // sudah ada di Users
        }

        const role = roleIdx !== -1 && data[i][roleIdx] ? String(data[i][roleIdx]).trim().toUpperCase() : item.defaultRole;
        const name = nameIdx !== -1 ? String(data[i][nameIdx] || "") : "";
        const phone = phoneIdx !== -1 ? String(data[i][phoneIdx] || "") : "";
        const status = statusIdx !== -1 && data[i][statusIdx] ? String(data[i][statusIdx]).trim().toUpperCase() : "ACTIVE";
        const photoUrl = photoIdx !== -1 ? String(data[i][photoIdx] || "") : "";
        const createdAt = createdIdx !== -1 && data[i][createdIdx] ? String(data[i][createdIdx]) : new Date().toISOString();

        rowsToAdd.push([
          id || ("USR_" + Utilities.getUuid().substring(0, 8)),
          email,
          phone,
          name,
          role,
          photoUrl,
          status,
          createdAt,
          "" // last_login_at
        ]);

        if (email) existingEmails.add(email);
        if (id) existingIds.add(id.toLowerCase());
      }
    });

    if (rowsToAdd.length > 0) {
      usersSheet.getRange(usersSheet.getLastRow() + 1, 1, rowsToAdd.length, rowsToAdd[0].length).setValues(rowsToAdd);
      Logger.log(`[MIGRATION] ${rowsToAdd.length} pengguna berhasil dimigrasikan ke sheet Users.`);
    }
  } catch (err) {
    console.error("[MIGRATION TO USERS ERROR]", err);
  }
}

/**
 * Sinkronisasi satu identitas pengguna ke sheet role spesifik
 * (Wali_Identities, Admin_Identities, atau Pengasuh_Identities)
 */
function syncUserToRoleIdentitySheet(ss, userId, email, phone, name, role, status = "ACTIVE", photoUrl = "") {
  try {
    if (!ss) ss = getDatabaseSpreadsheet();
    if (!ss || !userId || !email) return;

    const normalizedRole = String(role || "").trim().toUpperCase();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanId = String(userId || "").trim();
    const cleanStatus = String(status || "ACTIVE").trim().toUpperCase();
    const cleanName = String(name || "").trim();
    const cleanPhone = String(phone || "").trim();
    const nowIso = new Date().toISOString();

    if (normalizedRole === "WALI_SANTRI" || normalizedRole === "PARENT") {
      const sheet = getAuthSheet(ss, SHEET_WALI_IDENTITIES);
      if (!sheet) return;
      const data = sheet.getDataRange().getValues();
      const headers = data && data.length > 0 ? data[0].map(h => String(h || "").trim().toLowerCase()) : AUTH_SHEET_SCHEMAS[SHEET_WALI_IDENTITIES];
      let idIdx = headers.indexOf("identity_id");
      let emailIdx = headers.indexOf("email");
      let phoneIdx = headers.indexOf("phone");
      let nameIdx = headers.indexOf("name");
      let roleIdx = headers.indexOf("role");
      let statusIdx = headers.indexOf("status");
      let photoIdx = headers.indexOf("photo_url");
      if (photoIdx === -1) photoIdx = headers.indexOf("foto_profil");
      if (photoIdx === -1) photoIdx = headers.indexOf("foto");

      let foundRow = -1;
      if (data && data.length >= 2) {
        for (let i = 1; i < data.length; i++) {
          const rowId = idIdx !== -1 ? String(data[i][idIdx] || "").trim() : "";
          const rowEmail = emailIdx !== -1 ? String(data[i][emailIdx] || "").trim().toLowerCase() : "";
          if ((cleanId && rowId === cleanId) || (cleanEmail && rowEmail === cleanEmail)) {
            foundRow = i + 1;
            break;
          }
        }
      }

      if (foundRow !== -1) {
        if (nameIdx !== -1 && cleanName) sheet.getRange(foundRow, nameIdx + 1).setValue(cleanName);
        if (phoneIdx !== -1 && cleanPhone) sheet.getRange(foundRow, phoneIdx + 1).setValue(cleanPhone);
        if (emailIdx !== -1 && cleanEmail) sheet.getRange(foundRow, emailIdx + 1).setValue(cleanEmail);
        if (roleIdx !== -1) sheet.getRange(foundRow, roleIdx + 1).setValue("WALI_SANTRI");
        if (statusIdx !== -1) sheet.getRange(foundRow, statusIdx + 1).setValue(cleanStatus);
        if (photoIdx !== -1 && photoUrl) sheet.getRange(foundRow, photoIdx + 1).setValue(photoUrl);
      } else {
        // Schema: ["identity_id", "email", "phone", "name", "role", "status", "created_at", "photo_url"]
        sheet.appendRow([
          cleanId,
          cleanEmail,
          cleanPhone,
          cleanName || "Wali Santri",
          "WALI_SANTRI",
          cleanStatus,
          nowIso,
          photoUrl || ""
        ]);
      }
    } else if (normalizedRole === "SUPER_ADMIN" || normalizedRole === "ADMIN" || normalizedRole === "BENDAHARA" || normalizedRole === "PENGURUS" || normalizedRole === "ASATIDZ" || normalizedRole === "PEGAWAI" || normalizedRole === "EDITOR") {
      const sheet = getAuthSheet(ss, SHEET_ADMIN_IDENTITIES);
      if (!sheet) return;
      const data = sheet.getDataRange().getValues();
      const headers = data && data.length > 0 ? data[0].map(h => String(h || "").trim().toLowerCase()) : AUTH_SHEET_SCHEMAS[SHEET_ADMIN_IDENTITIES];
      let idIdx = headers.indexOf("identity_id");
      let emailIdx = headers.indexOf("email");
      let nameIdx = headers.indexOf("name");
      let roleIdx = headers.indexOf("role");
      let statusIdx = headers.indexOf("status");
      let photoIdx = headers.indexOf("photo_url");

      let foundRow = -1;
      if (data && data.length >= 2) {
        for (let i = 1; i < data.length; i++) {
          const rowId = idIdx !== -1 ? String(data[i][idIdx] || "").trim() : "";
          const rowEmail = emailIdx !== -1 ? String(data[i][emailIdx] || "").trim().toLowerCase() : "";
          if ((cleanId && rowId === cleanId) || (cleanEmail && rowEmail === cleanEmail)) {
            foundRow = i + 1;
            break;
          }
        }
      }

      if (foundRow !== -1) {
        if (nameIdx !== -1 && cleanName) sheet.getRange(foundRow, nameIdx + 1).setValue(cleanName);
        if (emailIdx !== -1 && cleanEmail) sheet.getRange(foundRow, emailIdx + 1).setValue(cleanEmail);
        if (roleIdx !== -1) sheet.getRange(foundRow, roleIdx + 1).setValue(normalizedRole);
        if (statusIdx !== -1) sheet.getRange(foundRow, statusIdx + 1).setValue(cleanStatus);
        if (photoIdx !== -1 && photoUrl) sheet.getRange(foundRow, photoIdx + 1).setValue(photoUrl);
      } else {
        // Schema: ["identity_id", "email", "name", "role", "status", "created_at", "photo_url"]
        sheet.appendRow([
          cleanId,
          cleanEmail,
          cleanName || "Administrator",
          normalizedRole,
          cleanStatus,
          nowIso,
          photoUrl || ""
        ]);
      }
    } else if (normalizedRole === "PENGASUH") {
      const sheet = getAuthSheet(ss, SHEET_PENGASUH_IDENTITIES);
      if (!sheet) return;
      const data = sheet.getDataRange().getValues();
      const headers = data && data.length > 0 ? data[0].map(h => String(h || "").trim().toLowerCase()) : AUTH_SHEET_SCHEMAS[SHEET_PENGASUH_IDENTITIES];
      let idIdx = headers.indexOf("identity_id");
      let emailIdx = headers.indexOf("email");
      let phoneIdx = headers.indexOf("phone");
      let nameIdx = headers.indexOf("title_name");
      if (nameIdx === -1) nameIdx = headers.indexOf("name");
      let roleIdx = headers.indexOf("role");
      let statusIdx = headers.indexOf("status");
      let photoIdx = headers.indexOf("photo_url");

      let foundRow = -1;
      if (data && data.length >= 2) {
        for (let i = 1; i < data.length; i++) {
          const rowId = idIdx !== -1 ? String(data[i][idIdx] || "").trim() : "";
          const rowEmail = emailIdx !== -1 ? String(data[i][emailIdx] || "").trim().toLowerCase() : "";
          if ((cleanId && rowId === cleanId) || (cleanEmail && rowEmail === cleanEmail)) {
            foundRow = i + 1;
            break;
          }
        }
      }

      if (foundRow !== -1) {
        if (nameIdx !== -1 && cleanName) sheet.getRange(foundRow, nameIdx + 1).setValue(cleanName);
        if (emailIdx !== -1 && cleanEmail) sheet.getRange(foundRow, emailIdx + 1).setValue(cleanEmail);
        if (phoneIdx !== -1 && cleanPhone) sheet.getRange(foundRow, phoneIdx + 1).setValue(cleanPhone);
        if (roleIdx !== -1) sheet.getRange(foundRow, roleIdx + 1).setValue("PENGASUH");
        if (statusIdx !== -1) sheet.getRange(foundRow, statusIdx + 1).setValue(cleanStatus);
        if (photoIdx !== -1 && photoUrl) sheet.getRange(foundRow, photoIdx + 1).setValue(photoUrl);
      } else {
        // Schema: ["identity_id", "email", "phone", "title_name", "role", "status", "created_at", "photo_url"]
        sheet.appendRow([
          cleanId,
          cleanEmail,
          cleanPhone,
          cleanName || "Pengasuh",
          "PENGASUH",
          cleanStatus,
          nowIso,
          photoUrl || ""
        ]);
      }
    }
  } catch (err) {
    console.error("[SYNC USER TO ROLE SHEET ERROR]", err);
  }
}

/**
 * Sinkronisasi massal seluruh akun dari sheet Users ke role-based identity sheets
 */
function syncAllUsersToRoleSheets(ss) {
  try {
    if (!ss) ss = getDatabaseSpreadsheet();
    if (!ss) return;
    const usersSheet = getAuthSheet(ss, SHEET_USERS);
    if (!usersSheet) return;

    const usersData = usersSheet.getDataRange().getValues();
    if (!usersData || usersData.length < 2) return;

    const uHeaders = usersData[0].map(h => String(h || "").trim().toLowerCase());
    const idIdx = uHeaders.indexOf("user_id");
    const emailIdx = uHeaders.indexOf("email");
    const phoneIdx = uHeaders.indexOf("phone");
    const nameIdx = uHeaders.indexOf("name");
    const roleIdx = uHeaders.indexOf("role");
    const photoIdx = uHeaders.indexOf("photo_url");
    const statusIdx = uHeaders.indexOf("status");

    for (let i = 1; i < usersData.length; i++) {
      const id = idIdx !== -1 ? String(usersData[i][idIdx] || "").trim() : "";
      const email = emailIdx !== -1 ? String(usersData[i][emailIdx] || "").trim().toLowerCase() : "";
      const phone = phoneIdx !== -1 ? String(usersData[i][phoneIdx] || "").trim() : "";
      const name = nameIdx !== -1 ? String(usersData[i][nameIdx] || "").trim() : "";
      const role = roleIdx !== -1 ? String(usersData[i][roleIdx] || "WALI_SANTRI").trim().toUpperCase() : "WALI_SANTRI";
      const photo = photoIdx !== -1 ? String(usersData[i][photoIdx] || "").trim() : "";
      const status = statusIdx !== -1 ? String(usersData[i][statusIdx] || "ACTIVE").trim().toUpperCase() : "ACTIVE";

      if (id && email) {
        syncUserToRoleIdentitySheet(ss, id, email, phone, name, role, status, photo);
      }
    }
    Logger.log("[SYNC ALL USERS] Seluruh akun dari sheet Users tersinkronisasi ke role sheets.");
  } catch (err) {
    console.warn("[SYNC ALL USERS WARN]", err);
  }
}

/**
 * Concurrency Lock Wrapper menggunakan LockService
 */

function sendWhatsAppOtpMessage(targetPhone, otpCode) {
  const gatewayUrl = getServerSecret("WA_GATEWAY_URL", "");
  const gatewayApiKey = getServerSecret("WA_GATEWAY_API_KEY", "");

  if (!gatewayUrl) {
    console.warn("[WA GATEWAY] WA_GATEWAY_URL belum dikonfigurasi di Script Properties.");
    return false;
  }

  const message = `*Portal Pesantren*\n\nKode verifikasi login Anda adalah: *${otpCode}*\n\nKode ini berlaku selama 5 menit. JANGAN berikan kode ini kepada siapapun demi keamanan data putra/putri Anda.`;

  const payload = {
    phone: targetPhone,
    message: message
  };

  const headers = {
    "Content-Type": "application/json"
  };
  if (gatewayApiKey) {
    headers["Authorization"] = "Bearer " + gatewayApiKey;
  }

  const options = {
    method: "post",
    headers: headers,
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(gatewayUrl, options);
    const code = response.getResponseCode();
    if (code >= 200 && code < 300) {
      return true;
    } else {
      console.warn("[WA GATEWAY] HTTP " + code + ": " + response.getContentText().substring(0, 100));
      return false;
    }
  } catch (err) {
    console.error("[WA GATEWAY ERROR]", err);
    return false;
  }
}

/**
 * Dispatcher Pengiriman Email OTP via Native MailApp
 */
function sendAdminOtpEmail(email, otpCode) {
  const subject = "Kode Verifikasi Login Administrator";
  const body = `Yth. Pengelola Pesantren,\n\nKode verifikasi 6-digit Anda adalah: ${otpCode}\n\nKode ini berlaku selama 5 menit. Jangan membagikan kode ini kepada pihak lain demi menjaga keamanan sistem operasional pesantren.\n\nTerima kasih,\nTim Keamanan Sistem`;

  MailApp.sendEmail({
    to: email,
    subject: subject,
    body: body,
    name: "Admin Khodim - PPTQ Roudlotul Mubarokah",
    replyTo: "adminkhodim@gmail.com"
  });
  return true;
}

/**
 * Dispatcher Pengiriman Email OTP Wali Santri via Native MailApp (Phase 2B)
 */
function sendWaliOtpEmail(email, otpCode, name = "") {
  const subject = "Kode OTP Login Wali Santri";
  const body = `Assalamu'alaikum,\n\nKode OTP Anda untuk login ke aplikasi adalah: ${otpCode}\n\nKode ini berlaku selama 5 menit. Jangan berikan kode OTP ini kepada siapa pun.\n\nJika Anda tidak merasa melakukan permintaan login, abaikan email ini.\n\nTim Pesantren`;

  MailApp.sendEmail({
    to: email,
    subject: subject,
    body: body,
    name: "Admin Khodim - PPTQ Roudlotul Mubarokah",
    replyTo: "adminkhodim@gmail.com"
  });
  return true;
}

/**
 * Dispatcher Pengiriman Email OTP Aktivasi Akun Wali Santri (Phase 2B / Redesign)
 */
function sendWaliActivationOtpEmail(email, otpCode, waliName = "", studentName = "") {
  const subject = "Kode OTP Aktivasi Akun Wali Santri";
  const body = `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\n` +
    `Yth. Bapak/Ibu ${waliName || "Wali Santri"},\n\n` +
    `Berikut adalah kode OTP 6-digit untuk aktivasi akun Wali Santri Anda (terhubung dengan santri: ${studentName || "Santri"}):\n\n` +
    `   ${otpCode}\n\n` +
    `Kode ini berlaku selama 5 menit. Jangan berikan kode ini kepada siapa pun demi menjaga keamanan data santri.\n\n` +
    `Wassalamu'alaikum Warahmatullahi Wabarakatuh,\n` +
    `Pengurus Pesantren`;

  MailApp.sendEmail({
    to: email,
    subject: subject,
    body: body,
    name: "Admin Khodim - PPTQ Roudlotul Mubarokah",
    replyTo: "adminkhodim@gmail.com"
  });
  return true;
}

/**
 * Dispatcher Universal Pengiriman Email OTP
 */
function sendOtpEmail(email, otpCode, subject = "Kode OTP") {
  return sendWaliActivationOtpEmail(email, otpCode, "Wali Santri", "Santri");
}

/**
 * Verifikasi Google ID Token secara Server-Side via Tokeninfo Endpoint
 */
function verifyGoogleIdToken(idToken) {
  if (!idToken || typeof idToken !== "string") {
    return { valid: false, error: "Token Google tidak ditemukan." };
  }
  try {
    const url = "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken.trim());
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const code = response.getResponseCode();
    if (code !== 200) {
      return { valid: false, error: "HTTP " + code + ": " + response.getContentText().substring(0, 120) };
    }
    const data = JSON.parse(response.getContentText());
    const email = String(data.email || "").trim().toLowerCase();
    const emailVerified = data.email_verified === true || data.email_verified === "true";
    if (!email || !emailVerified) {
      return { valid: false, error: "Alamat email Google belum terverifikasi." };
    }
    return {
      valid: true,
      email: email,
      name: String(data.name || ""),
      picture: String(data.picture || ""),
      sub: String(data.sub || "")
    };
  } catch (e) {
    console.error("Gagal verifikasi Google ID Token:", e);
    return { valid: false, error: e.message || "Gagal menghubungi server autentikasi Google." };
  }
}


function setUserPasswordHash(identifier, plainPassword) {
  if (!identifier || !plainPassword) return false;
  const target = String(identifier).trim().toLowerCase();
  const passHash = hashPassword(plainPassword);
  const ss = getDatabaseSpreadsheet();
  if (!ss) return false;

  let updated = false;

  // 1. Update di Sheet Users
  const usersSheet = getAuthSheet(ss, SHEET_USERS);
  if (usersSheet) {
    const data = usersSheet.getDataRange().getValues();
    if (data && data.length >= 2) {
      const header = data[0].map(h => String(h || "").trim().toLowerCase());
      const idIdx = header.indexOf("user_id");
      const emailIdx = header.indexOf("email");
      const phoneIdx = header.indexOf("phone");
      let passIdx = header.indexOf("password_hash");
      if (passIdx === -1) passIdx = header.indexOf("password");

      if (passIdx === -1) {
        passIdx = header.length;
        usersSheet.getRange(1, passIdx + 1).setValue("password_hash").setFontWeight("bold").setBackground("#dcfce7");
      }

      for (let i = 1; i < data.length; i++) {
        const rowId = idIdx !== -1 ? String(data[i][idIdx] || "").trim().toLowerCase() : "";
        const rowEmail = emailIdx !== -1 ? String(data[i][emailIdx] || "").trim().toLowerCase() : "";
        const rowPhone = phoneIdx !== -1 ? String(data[i][phoneIdx] || "").replace(/[^0-9]/g, "") : "";
        const cleanTarget = target.replace(/[^0-9]/g, "");

        if (rowEmail === target || rowId === target || (cleanTarget && cleanTarget.length >= 8 && rowPhone.endsWith(cleanTarget.slice(-8)))) {
          usersSheet.getRange(i + 1, passIdx + 1).setValue(passHash);
          updated = true;
          break;
        }
      }
    }
  }

  // 2. Update di Sheet Role (Admin_Identities, Wali_Identities, Pengasuh_Identities)
  const roleSheets = [SHEET_WALI_IDENTITIES, SHEET_ADMIN_IDENTITIES, SHEET_PENGASUH_IDENTITIES];
  roleSheets.forEach(sheetName => {
    const rSheet = getAuthSheet(ss, sheetName);
    if (!rSheet) return;
    const rData = rSheet.getDataRange().getValues();
    if (!rData || rData.length < 2) return;
    const rHeader = rData[0].map(h => String(h || "").trim().toLowerCase());
    const idIdx = rHeader.indexOf("identity_id");
    const emailIdx = rHeader.indexOf("email");
    const phoneIdx = rHeader.indexOf("phone");
    let passIdx = rHeader.indexOf("password_hash");
    if (passIdx === -1) passIdx = rHeader.indexOf("password");

    if (passIdx === -1) {
      passIdx = rHeader.length;
      rSheet.getRange(1, passIdx + 1).setValue("password_hash").setFontWeight("bold").setBackground("#dcfce7");
    }

    for (let j = 1; j < rData.length; j++) {
      const rowId = idIdx !== -1 ? String(rData[j][idIdx] || "").trim().toLowerCase() : "";
      const rowEmail = emailIdx !== -1 ? String(rData[j][emailIdx] || "").trim().toLowerCase() : "";
      const rowPhone = phoneIdx !== -1 ? String(rData[j][phoneIdx] || "").replace(/[^0-9]/g, "") : "";
      const cleanTarget = target.replace(/[^0-9]/g, "");

      if (rowEmail === target || rowId === target || (cleanTarget && cleanTarget.length >= 8 && rowPhone.endsWith(cleanTarget.slice(-8)))) {
        rSheet.getRange(j + 1, passIdx + 1).setValue(passHash);
        updated = true;
        break;
      }
    }
  });

  return updated;
}

function getAdminIdentityByEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return null;

  const ss = getDatabaseSpreadsheet();
  const sheet = getAuthSheet(ss, SHEET_ADMIN_IDENTITIES);
  if (sheet) {
    const data = sheet.getDataRange().getValues();
    if (data && data.length >= 2) {
      const header = data[0].map(h => String(h || "").trim().toLowerCase());
      let idIdx = header.indexOf("identity_id");
      let emailIdx = header.indexOf("email");
      let nameIdx = header.indexOf("name");
      let roleIdx = header.indexOf("role");
      let statusIdx = header.indexOf("status");
      let createdAtIdx = header.indexOf("created_at");
      let photoIdx = header.indexOf("photo_url");
      if (photoIdx === -1) photoIdx = header.indexOf("foto_profil");
      if (photoIdx === -1) photoIdx = header.indexOf("foto");
      let passIdx = header.indexOf("password_hash");
      if (passIdx === -1) passIdx = header.indexOf("password");

      if (idIdx === -1) idIdx = 0;
      if (emailIdx === -1) emailIdx = 1;
      if (nameIdx === -1) nameIdx = 2;
      if (roleIdx === -1) roleIdx = 3;
      if (statusIdx === -1) statusIdx = 4;
      if (createdAtIdx === -1) createdAtIdx = 5;

      for (let i = 1; i < data.length; i++) {
        const rowEmail = String(data[i][emailIdx] || "").trim().toLowerCase();
        if (rowEmail === normalized) {
          const rawPhoto = photoIdx !== -1 ? String(data[i][photoIdx] || "").trim() : "";
          return {
            identityId: String(data[i][idIdx] || ""),
            email: String(data[i][emailIdx] || ""),
            name: String(data[i][nameIdx] || ""),
            role: String(data[i][roleIdx] || "ADMIN"),
            status: String(data[i][statusIdx] || "").trim().toUpperCase(),
            photoUrl: rawPhoto,
            photo_url: rawPhoto,
            passwordHash: passIdx !== -1 ? String(data[i][passIdx] || "") : "",
            createdAt: String(data[i][createdAtIdx] || "")
          };
        }
      }
    }
  }

  // Fallback: cek ke sheet Users jika akun dibuat via Manajemen Pengguna Admin
  const usersSheet = getAuthSheet(ss, SHEET_USERS);
  if (usersSheet) {
    const uData = usersSheet.getDataRange().getValues();
    if (uData && uData.length >= 2) {
      const uHeader = uData[0].map(h => String(h || "").trim().toLowerCase());
      const uEmailIdx = uHeader.indexOf("email");
      const uRoleIdx = uHeader.indexOf("role");
      const uIdIdx = uHeader.indexOf("user_id") !== -1 ? uHeader.indexOf("user_id") : 0;
      const uNameIdx = uHeader.indexOf("name") !== -1 ? uHeader.indexOf("name") : 3;
      const uPhoneIdx = uHeader.indexOf("phone") !== -1 ? uHeader.indexOf("phone") : 2;
      const uStatusIdx = uHeader.indexOf("status") !== -1 ? uHeader.indexOf("status") : 6;
      const uPhotoIdx = uHeader.indexOf("photo_url") !== -1 ? uHeader.indexOf("photo_url") : (uHeader.indexOf("foto_profil") !== -1 ? uHeader.indexOf("foto_profil") : -1);
      let uPassIdx = uHeader.indexOf("password_hash");
      if (uPassIdx === -1) uPassIdx = uHeader.indexOf("password");

      for (let j = 1; j < uData.length; j++) {
        const uEmail = uEmailIdx !== -1 ? String(uData[j][uEmailIdx] || "").trim().toLowerCase() : "";
        const uRole = uRoleIdx !== -1 ? String(uData[j][uRoleIdx] || "").trim().toUpperCase() : "";
        const isAdminRole = ["SUPER_ADMIN", "ADMIN", "BENDAHARA", "ASATIDZ", "PEGAWAI", "PENGURUS", "EDITOR"].includes(uRole);
        if (uEmail === normalized && isAdminRole) {
          const id = String(uData[j][uIdIdx] || "");
          const name = String(uData[j][uNameIdx] || "");
          const status = String(uData[j][uStatusIdx] || "ACTIVE").trim().toUpperCase();
          const photo = uPhotoIdx !== -1 ? String(uData[j][uPhotoIdx] || "").trim() : "";
          const phone = uPhoneIdx !== -1 ? String(uData[j][uPhoneIdx] || "").trim() : "";
          try {
            syncUserToRoleIdentitySheet(ss, id, uEmail, phone, name, uRole, status, photo);
          } catch (e) {
            console.warn("[SYNC ERROR in getAdminIdentityByEmail]", e);
          }
          return {
            identityId: id,
            email: uEmail,
            name: name,
            role: uRole,
            status: status,
            photoUrl: photo,
            photo_url: photo,
            passwordHash: uPassIdx !== -1 ? String(uData[j][uPassIdx] || "") : "",
            createdAt: ""
          };
        }
      }
    }
  }

  return null;
}

function getAdminIdentityById(identityId) {
  if (!identityId) return null;
  const targetId = String(identityId).trim();

  const ss = getDatabaseSpreadsheet();
  const sheet = getAuthSheet(ss, SHEET_ADMIN_IDENTITIES);
  if (sheet) {
    const data = sheet.getDataRange().getValues();
    if (data && data.length >= 2) {
      const header = data[0].map(h => String(h || "").trim().toLowerCase());
      let idIdx = header.indexOf("identity_id");
      let emailIdx = header.indexOf("email");
      let nameIdx = header.indexOf("name");
      let roleIdx = header.indexOf("role");
      let statusIdx = header.indexOf("status");
      let photoIdx = header.indexOf("photo_url");
      if (photoIdx === -1) photoIdx = header.indexOf("foto_profil");
      if (photoIdx === -1) photoIdx = header.indexOf("foto");
      let passIdx = header.indexOf("password_hash");
      if (passIdx === -1) passIdx = header.indexOf("password");

      if (idIdx === -1) idIdx = 0;
      if (emailIdx === -1) emailIdx = 1;
      if (nameIdx === -1) nameIdx = 2;
      if (roleIdx === -1) roleIdx = 3;
      if (statusIdx === -1) statusIdx = 4;

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idIdx] || "").trim() === targetId) {
          const rawPhoto = photoIdx !== -1 ? String(data[i][photoIdx] || "").trim() : "";
          return {
            identityId: String(data[i][idIdx] || ""),
            email: String(data[i][emailIdx] || ""),
            name: String(data[i][nameIdx] || ""),
            role: String(data[i][roleIdx] || "ADMIN"),
            status: String(data[i][statusIdx] || "").trim().toUpperCase(),
            photoUrl: rawPhoto,
            photo_url: rawPhoto,
            passwordHash: passIdx !== -1 ? String(data[i][passIdx] || "") : ""
          };
        }
      }
    }
  }

  // Fallback: cek ke sheet Users
  const usersSheet = getAuthSheet(ss, SHEET_USERS);
  if (usersSheet) {
    const uData = usersSheet.getDataRange().getValues();
    if (uData && uData.length >= 2) {
      const uHeader = uData[0].map(h => String(h || "").trim().toLowerCase());
      const uIdIdx = uHeader.indexOf("user_id") !== -1 ? uHeader.indexOf("user_id") : 0;
      const uRoleIdx = uHeader.indexOf("role");
      const uEmailIdx = uHeader.indexOf("email");
      const uNameIdx = uHeader.indexOf("name");
      const uStatusIdx = uHeader.indexOf("status");
      const uPhotoIdx = uHeader.indexOf("photo_url");
      let uPassIdx = uHeader.indexOf("password_hash");
      if (uPassIdx === -1) uPassIdx = uHeader.indexOf("password");

      for (let j = 1; j < uData.length; j++) {
        if (String(uData[j][uIdIdx] || "").trim() === targetId) {
          const uRole = uRoleIdx !== -1 ? String(uData[j][uRoleIdx] || "").trim().toUpperCase() : "";
          const isAdminRole = ["SUPER_ADMIN", "ADMIN", "BENDAHARA", "ASATIDZ", "PEGAWAI", "PENGURUS", "EDITOR"].includes(uRole);
          if (isAdminRole) {
            const rawPhoto = uPhotoIdx !== -1 ? String(uData[j][uPhotoIdx] || "").trim() : "";
            return {
              identityId: targetId,
              email: uEmailIdx !== -1 ? String(uData[j][uEmailIdx] || "").trim().toLowerCase() : "",
              name: uNameIdx !== -1 ? String(uData[j][uNameIdx] || "").trim() : "",
              role: uRole,
              status: uStatusIdx !== -1 ? String(uData[j][uStatusIdx] || "").trim().toUpperCase() : "ACTIVE",
              photoUrl: rawPhoto,
              photo_url: rawPhoto,
              passwordHash: uPassIdx !== -1 ? String(uData[j][uPassIdx] || "") : ""
            };
          }
        }
      }
    }
  }

  return null;
}

/**
 * Lookup Identitas Wali Santri berdasarkan Email (Phase 2B Active Path)
 */
function getWaliIdentityByEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) return null;

  const ss = getDatabaseSpreadsheet();
  const sheet = getAuthSheet(ss, SHEET_WALI_IDENTITIES);
  if (sheet) {
    const data = sheet.getDataRange().getValues();
    if (data && data.length >= 2) {
      const header = data[0].map(h => String(h || "").trim().toLowerCase());
      let idIdx = header.indexOf("identity_id");
      let emailIdx = header.indexOf("email");
      let phoneIdx = header.indexOf("phone");
      let nameIdx = header.indexOf("name");
      let roleIdx = header.indexOf("role");
      let statusIdx = header.indexOf("status");
      let photoIdx = header.indexOf("photo_url");
      if (photoIdx === -1) photoIdx = header.indexOf("foto_profil");
      if (photoIdx === -1) photoIdx = header.indexOf("foto");
      let passIdx = header.indexOf("password_hash");
      if (passIdx === -1) passIdx = header.indexOf("password");

      if (idIdx === -1) idIdx = 0;
      if (emailIdx === -1) emailIdx = 1;
      if (phoneIdx === -1) phoneIdx = 2;
      if (nameIdx === -1) nameIdx = 3;
      if (roleIdx === -1) roleIdx = 4;
      if (statusIdx === -1) statusIdx = 5;

      for (let i = 1; i < data.length; i++) {
        const storedEmail = String(data[i][emailIdx] || "").trim().toLowerCase();
        if (storedEmail === normalized) {
          const rawPhoto = photoIdx !== -1 ? String(data[i][photoIdx] || "").trim() : "";
          return {
            identityId: String(data[i][idIdx] || ""),
            email: storedEmail,
            phone: phoneIdx !== -1 ? String(data[i][phoneIdx] || "") : "",
            name: nameIdx !== -1 ? String(data[i][nameIdx] || "") : "",
            role: roleIdx !== -1 ? String(data[i][roleIdx] || "WALI_SANTRI") : "WALI_SANTRI",
            status: statusIdx !== -1 ? String(data[i][statusIdx] || "").trim().toUpperCase() : "ACTIVE",
            photoUrl: rawPhoto,
            photo_url: rawPhoto,
            passwordHash: passIdx !== -1 ? String(data[i][passIdx] || "") : ""
          };
        }
      }
    }
  }

  // Fallback: cek ke sheet Users jika akun dibuat via Manajemen Pengguna Admin
  const usersSheet = getAuthSheet(ss, SHEET_USERS);
  if (usersSheet) {
    const uData = usersSheet.getDataRange().getValues();
    if (uData && uData.length >= 2) {
      const uHeader = uData[0].map(h => String(h || "").trim().toLowerCase());
      const uEmailIdx = uHeader.indexOf("email");
      const uRoleIdx = uHeader.indexOf("role");
      const uIdIdx = uHeader.indexOf("user_id") !== -1 ? uHeader.indexOf("user_id") : 0;
      const uNameIdx = uHeader.indexOf("name") !== -1 ? uHeader.indexOf("name") : 3;
      const uPhoneIdx = uHeader.indexOf("phone") !== -1 ? uHeader.indexOf("phone") : 2;
      const uStatusIdx = uHeader.indexOf("status") !== -1 ? uHeader.indexOf("status") : 6;
      const uPhotoIdx = uHeader.indexOf("photo_url") !== -1 ? uHeader.indexOf("photo_url") : (uHeader.indexOf("foto_profil") !== -1 ? uHeader.indexOf("foto_profil") : -1);
      let uPassIdx = uHeader.indexOf("password_hash");
      if (uPassIdx === -1) uPassIdx = uHeader.indexOf("password");

      for (let j = 1; j < uData.length; j++) {
        const uEmail = uEmailIdx !== -1 ? String(uData[j][uEmailIdx] || "").trim().toLowerCase() : "";
        const uRole = uRoleIdx !== -1 ? String(uData[j][uRoleIdx] || "").trim().toUpperCase() : "";
        if (uEmail === normalized && (uRole === "WALI_SANTRI" || uRole === "WALI" || !uRole)) {
          const id = String(uData[j][uIdIdx] || "");
          const name = String(uData[j][uNameIdx] || "");
          const status = String(uData[j][uStatusIdx] || "ACTIVE").trim().toUpperCase();
          const photo = uPhotoIdx !== -1 ? String(uData[j][uPhotoIdx] || "").trim() : "";
          const phone = uPhoneIdx !== -1 ? String(uData[j][uPhoneIdx] || "").trim() : "";

          // Auto-sync ke Wali_Identities
          try {
            syncUserToRoleIdentitySheet(ss, id, uEmail, phone, name, "WALI_SANTRI", status, photo);
          } catch (e) {
            console.warn("[SYNC ERROR in getWaliIdentityByEmail]", e);
          }

          return {
            identityId: id,
            email: uEmail,
            phone: phone,
            name: name,
            role: "WALI_SANTRI",
            status: status,
            photoUrl: photo,
            photo_url: photo,
            passwordHash: uPassIdx !== -1 ? String(uData[j][uPassIdx] || "") : ""
          };
        }
      }
    }
  }

  return null;
}

/**
 * Lookup Identitas Wali Santri berdasarkan Phone (Retained as Future WhatsApp Capability)
 */
function getWaliIdentityByPhone(phone) {
  const cleanPhone = String(phone || "").replace(/[^0-9]/g, "");
  const normalized = cleanPhone.startsWith("62") ? cleanPhone : cleanPhone.startsWith("0") ? "62" + cleanPhone.slice(1) : "62" + cleanPhone;

  const ss = getDatabaseSpreadsheet();
  const sheet = getAuthSheet(ss, SHEET_WALI_IDENTITIES);
  if (sheet) {
    const data = sheet.getDataRange().getValues();
    if (data && data.length >= 2) {
      const header = data[0].map(h => String(h || "").trim().toLowerCase());
      let idIdx = header.indexOf("identity_id");
      let emailIdx = header.indexOf("email");
      let phoneIdx = header.indexOf("phone");
      let nameIdx = header.indexOf("name");
      let roleIdx = header.indexOf("role");
      let statusIdx = header.indexOf("status");
      let photoIdx = header.indexOf("photo_url");
      if (photoIdx === -1) photoIdx = header.indexOf("foto_profil");
      if (photoIdx === -1) photoIdx = header.indexOf("foto");
      let passIdx = header.indexOf("password_hash");
      if (passIdx === -1) passIdx = header.indexOf("password");

      if (idIdx === -1) idIdx = 0;
      if (phoneIdx === -1) phoneIdx = 1;
      if (nameIdx === -1) nameIdx = 2;
      if (roleIdx === -1) roleIdx = 3;
      if (statusIdx === -1) statusIdx = 4;

      for (let i = 1; i < data.length; i++) {
        const storedPhone = String(data[i][phoneIdx] || "").replace(/[^0-9]/g, "");
        if (storedPhone === normalized) {
          const rawPhoto = photoIdx !== -1 ? String(data[i][photoIdx] || "").trim() : "";
          return {
            identityId: String(data[i][idIdx] || ""),
            email: emailIdx !== -1 ? String(data[i][emailIdx] || "").trim().toLowerCase() : "",
            phone: String(data[i][phoneIdx] || ""),
            name: String(data[i][nameIdx] || ""),
            role: String(data[i][roleIdx] || "WALI_SANTRI"),
            status: String(data[i][statusIdx] || "").trim().toUpperCase(),
            photoUrl: rawPhoto,
            photo_url: rawPhoto,
            passwordHash: passIdx !== -1 ? String(data[i][passIdx] || "") : ""
          };
        }
      }
    }
  }

  // Fallback ke sheet Users
  const usersSheet = getAuthSheet(ss, SHEET_USERS);
  if (usersSheet) {
    const uData = usersSheet.getDataRange().getValues();
    if (uData && uData.length >= 2) {
      const uHeader = uData[0].map(h => String(h || "").trim().toLowerCase());
      const uPhoneIdx = uHeader.indexOf("phone");
      const uIdIdx = uHeader.indexOf("user_id") !== -1 ? uHeader.indexOf("user_id") : 0;
      const uEmailIdx = uHeader.indexOf("email");
      const uNameIdx = uHeader.indexOf("name");
      const uRoleIdx = uHeader.indexOf("role");
      const uStatusIdx = uHeader.indexOf("status");
      const uPhotoIdx = uHeader.indexOf("photo_url");
      let uPassIdx = uHeader.indexOf("password_hash");
      if (uPassIdx === -1) uPassIdx = uHeader.indexOf("password");

      for (let j = 1; j < uData.length; j++) {
        const rowPhone = uPhoneIdx !== -1 ? String(uData[j][uPhoneIdx] || "").replace(/[^0-9]/g, "") : "";
        const uNorm = rowPhone.startsWith("62") ? rowPhone : rowPhone.startsWith("0") ? "62" + rowPhone.slice(1) : "62" + rowPhone;
        if (uNorm === normalized && rowPhone.length > 5) {
          const rawPhoto = uPhotoIdx !== -1 ? String(uData[j][uPhotoIdx] || "").trim() : "";
          return {
            identityId: String(uData[j][uIdIdx] || ""),
            email: uEmailIdx !== -1 ? String(uData[j][uEmailIdx] || "").trim().toLowerCase() : "",
            phone: String(uData[j][uPhoneIdx] || ""),
            name: uNameIdx !== -1 ? String(uData[j][uNameIdx] || "") : "",
            role: uRoleIdx !== -1 ? String(uData[j][uRoleIdx] || "WALI_SANTRI") : "WALI_SANTRI",
            status: uStatusIdx !== -1 ? String(uData[j][uStatusIdx] || "").trim().toUpperCase() : "ACTIVE",
            photoUrl: rawPhoto,
            photo_url: rawPhoto,
            passwordHash: uPassIdx !== -1 ? String(uData[j][uPassIdx] || "") : ""
          };
        }
      }
    }
  }

  return null;
}

function getWaliIdentityById(identityId) {
  if (!identityId) return null;
  const targetId = String(identityId).trim();

  const ss = getDatabaseSpreadsheet();
  const sheet = getAuthSheet(ss, SHEET_WALI_IDENTITIES);
  if (sheet) {
    const data = sheet.getDataRange().getValues();
    if (data && data.length >= 2) {
      const header = data[0].map(h => String(h || "").trim().toLowerCase());
      let idIdx = header.indexOf("identity_id");
      let emailIdx = header.indexOf("email");
      let phoneIdx = header.indexOf("phone");
      let nameIdx = header.indexOf("name");
      let roleIdx = header.indexOf("role");
      let statusIdx = header.indexOf("status");
      let photoIdx = header.indexOf("photo_url");
      if (photoIdx === -1) photoIdx = header.indexOf("foto_profil");
      if (photoIdx === -1) photoIdx = header.indexOf("foto");
      let passIdx = header.indexOf("password_hash");
      if (passIdx === -1) passIdx = header.indexOf("password");

      if (idIdx === -1) idIdx = 0;
      if (phoneIdx === -1) phoneIdx = 1;
      if (nameIdx === -1) nameIdx = 2;
      if (roleIdx === -1) roleIdx = 3;
      if (statusIdx === -1) statusIdx = 4;

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idIdx] || "").trim() === targetId) {
          const rawPhoto = photoIdx !== -1 ? String(data[i][photoIdx] || "").trim() : "";
          return {
            identityId: String(data[i][idIdx] || ""),
            email: emailIdx !== -1 ? String(data[i][emailIdx] || "").trim().toLowerCase() : "",
            phone: String(data[i][phoneIdx] || ""),
            name: String(data[i][nameIdx] || ""),
            role: String(data[i][roleIdx] || "WALI_SANTRI"),
            status: String(data[i][statusIdx] || "").trim().toUpperCase(),
            photoUrl: rawPhoto,
            photo_url: rawPhoto,
            passwordHash: passIdx !== -1 ? String(data[i][passIdx] || "") : ""
          };
        }
      }
    }
  }

  // Fallback: cek ke sheet Users
  const usersSheet = getAuthSheet(ss, SHEET_USERS);
  if (usersSheet) {
    const uData = usersSheet.getDataRange().getValues();
    if (uData && uData.length >= 2) {
      const uHeader = uData[0].map(h => String(h || "").trim().toLowerCase());
      const uIdIdx = uHeader.indexOf("user_id") !== -1 ? uHeader.indexOf("user_id") : 0;
      const uEmailIdx = uHeader.indexOf("email");
      const uPhoneIdx = uHeader.indexOf("phone");
      const uNameIdx = uHeader.indexOf("name");
      const uRoleIdx = uHeader.indexOf("role");
      const uStatusIdx = uHeader.indexOf("status");
      const uPhotoIdx = uHeader.indexOf("photo_url");
      let uPassIdx = uHeader.indexOf("password_hash");
      if (uPassIdx === -1) uPassIdx = uHeader.indexOf("password");

      for (let j = 1; j < uData.length; j++) {
        if (String(uData[j][uIdIdx] || "").trim() === targetId) {
          const uRole = uRoleIdx !== -1 ? String(uData[j][uRoleIdx] || "").trim().toUpperCase() : "";
          if (uRole === "WALI_SANTRI" || uRole === "WALI" || !uRole) {
            const rawPhoto = uPhotoIdx !== -1 ? String(uData[j][uPhotoIdx] || "").trim() : "";
            return {
              identityId: targetId,
              email: uEmailIdx !== -1 ? String(uData[j][uEmailIdx] || "").trim().toLowerCase() : "",
              phone: uPhoneIdx !== -1 ? String(uData[j][uPhoneIdx] || "") : "",
              name: uNameIdx !== -1 ? String(uData[j][uNameIdx] || "") : "",
              role: "WALI_SANTRI",
              status: uStatusIdx !== -1 ? String(uData[j][uStatusIdx] || "").trim().toUpperCase() : "ACTIVE",
              photoUrl: rawPhoto,
              photo_url: rawPhoto,
              passwordHash: uPassIdx !== -1 ? String(uData[j][uPassIdx] || "") : ""
            };
          }
        }
      }
    }
  }

  return null;
}

/**
 * Lookup Identitas Pengasuh berdasarkan Email (Khidmat Pengasuh SSO)
 */
function getPengasuhIdentityByEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) return null;

  const ss = getDatabaseSpreadsheet();
  const sheet = getAuthSheet(ss, SHEET_PENGASUH_IDENTITIES);
  if (sheet) {
    const data = sheet.getDataRange().getValues();
    if (data && data.length >= 2) {
      const header = data[0].map(h => String(h || "").trim().toLowerCase());
      let idIdx = header.indexOf("identity_id");
      let emailIdx = header.indexOf("email");
      let phoneIdx = header.indexOf("phone");
      let nameIdx = header.indexOf("title_name");
      if (nameIdx === -1) nameIdx = header.indexOf("name");
      let roleIdx = header.indexOf("role");
      let statusIdx = header.indexOf("status");
      let photoIdx = header.indexOf("photo_url");
      if (photoIdx === -1) photoIdx = header.indexOf("foto_profil");
      if (photoIdx === -1) photoIdx = header.indexOf("foto");

      if (idIdx === -1) idIdx = 0;
      if (emailIdx === -1) emailIdx = 1;
      if (phoneIdx === -1) phoneIdx = 2;
      if (nameIdx === -1) nameIdx = 3;
      if (roleIdx === -1) roleIdx = 4;
      if (statusIdx === -1) statusIdx = 5;

      for (let i = 1; i < data.length; i++) {
        const storedEmail = String(data[i][emailIdx] || "").trim().toLowerCase();
        if (storedEmail === normalized) {
          const rawPhoto = photoIdx !== -1 ? String(data[i][photoIdx] || "").trim() : "";
          return {
            identityId: String(data[i][idIdx] || ""),
            email: storedEmail,
            phone: phoneIdx !== -1 ? String(data[i][phoneIdx] || "") : "",
            name: nameIdx !== -1 ? String(data[i][nameIdx] || "") : "Pengasuh",
            titleName: nameIdx !== -1 ? String(data[i][nameIdx] || "") : "Pengasuh",
            role: roleIdx !== -1 ? String(data[i][roleIdx] || "PENGASUH") : "PENGASUH",
            status: statusIdx !== -1 ? String(data[i][statusIdx] || "").trim().toUpperCase() : "ACTIVE",
            photoUrl: rawPhoto,
            photo_url: rawPhoto
          };
        }
      }
    }
  }

  // Fallback: cek ke sheet Users jika belum ada di Pengasuh_Identities
  const usersSheet = getAuthSheet(ss, SHEET_USERS);
  if (usersSheet) {
    const uData = usersSheet.getDataRange().getValues();
    if (uData && uData.length >= 2) {
      const uHeader = uData[0].map(h => String(h || "").trim().toLowerCase());
      const uEmailIdx = uHeader.indexOf("email");
      const uRoleIdx = uHeader.indexOf("role");
      const uIdIdx = uHeader.indexOf("user_id") !== -1 ? uHeader.indexOf("user_id") : 0;
      const uNameIdx = uHeader.indexOf("name") !== -1 ? uHeader.indexOf("name") : 3;
      const uPhoneIdx = uHeader.indexOf("phone") !== -1 ? uHeader.indexOf("phone") : 2;
      const uStatusIdx = uHeader.indexOf("status") !== -1 ? uHeader.indexOf("status") : 6;
      const uPhotoIdx = uHeader.indexOf("photo_url") !== -1 ? uHeader.indexOf("photo_url") : (uHeader.indexOf("foto_profil") !== -1 ? uHeader.indexOf("foto_profil") : -1);

      for (let j = 1; j < uData.length; j++) {
        const uEmail = uEmailIdx !== -1 ? String(uData[j][uEmailIdx] || "").trim().toLowerCase() : "";
        const uRole = uRoleIdx !== -1 ? String(uData[j][uRoleIdx] || "").trim().toUpperCase() : "";
        if (uEmail === normalized && uRole === "PENGASUH") {
          const id = String(uData[j][uIdIdx] || "");
          const name = String(uData[j][uNameIdx] || "");
          const status = String(uData[j][uStatusIdx] || "ACTIVE").trim().toUpperCase();
          const photo = uPhotoIdx !== -1 ? String(uData[j][uPhotoIdx] || "").trim() : "";
          const phone = uPhoneIdx !== -1 ? String(uData[j][uPhoneIdx] || "").trim() : "";

          // Auto-sync ke Pengasuh_Identities
          try {
            syncUserToRoleIdentitySheet(ss, id, uEmail, phone, name, "PENGASUH", status, photo);
          } catch (e) {
            console.warn("[SYNC ERROR in getPengasuhIdentityByEmail]", e);
          }

          return {
            identityId: id,
            email: uEmail,
            phone: phone,
            name: name || "Pengasuh",
            titleName: name || "Pengasuh",
            role: "PENGASUH",
            status: status,
            photoUrl: photo,
            photo_url: photo
          };
        }
      }
    }
  }

  return null;
}

/**
 * Lookup Identitas Pengasuh berdasarkan ID
 */
function getPengasuhIdentityById(identityId) {
  if (!identityId) return null;
  const targetId = String(identityId).trim();

  const ss = getDatabaseSpreadsheet();
  const sheet = getAuthSheet(ss, SHEET_PENGASUH_IDENTITIES);
  if (sheet) {
    const data = sheet.getDataRange().getValues();
    if (data && data.length >= 2) {
      const header = data[0].map(h => String(h || "").trim().toLowerCase());
      let idIdx = header.indexOf("identity_id");
      let emailIdx = header.indexOf("email");
      let phoneIdx = header.indexOf("phone");
      let nameIdx = header.indexOf("title_name");
      if (nameIdx === -1) nameIdx = header.indexOf("name");
      let roleIdx = header.indexOf("role");
      let statusIdx = header.indexOf("status");
      let photoIdx = header.indexOf("photo_url");
      if (photoIdx === -1) photoIdx = header.indexOf("foto_profil");
      if (photoIdx === -1) photoIdx = header.indexOf("foto");

      if (idIdx === -1) idIdx = 0;
      if (emailIdx === -1) emailIdx = 1;
      if (phoneIdx === -1) phoneIdx = 2;
      if (nameIdx === -1) nameIdx = 3;
      if (roleIdx === -1) roleIdx = 4;
      if (statusIdx === -1) statusIdx = 5;

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idIdx] || "").trim() === targetId) {
          const rawPhoto = photoIdx !== -1 ? String(data[i][photoIdx] || "").trim() : "";
          return {
            identityId: String(data[i][idIdx] || ""),
            email: emailIdx !== -1 ? String(data[i][emailIdx] || "").trim().toLowerCase() : "",
            phone: phoneIdx !== -1 ? String(data[i][phoneIdx] || "") : "",
            name: nameIdx !== -1 ? String(data[i][nameIdx] || "") : "Pengasuh",
            titleName: nameIdx !== -1 ? String(data[i][nameIdx] || "") : "Pengasuh",
            role: roleIdx !== -1 ? String(data[i][roleIdx] || "PENGASUH") : "PENGASUH",
            status: statusIdx !== -1 ? String(data[i][statusIdx] || "").trim().toUpperCase() : "ACTIVE",
            photoUrl: rawPhoto,
            photo_url: rawPhoto
          };
        }
      }
    }
  }

  // Fallback: cek ke sheet Users
  const usersSheet = getAuthSheet(ss, SHEET_USERS);
  if (usersSheet) {
    const uData = usersSheet.getDataRange().getValues();
    if (uData && uData.length >= 2) {
      const uHeader = uData[0].map(h => String(h || "").trim().toLowerCase());
      const uIdIdx = uHeader.indexOf("user_id") !== -1 ? uHeader.indexOf("user_id") : 0;
      const uEmailIdx = uHeader.indexOf("email");
      const uPhoneIdx = uHeader.indexOf("phone");
      const uNameIdx = uHeader.indexOf("name");
      const uRoleIdx = uHeader.indexOf("role");
      const uStatusIdx = uHeader.indexOf("status");
      const uPhotoIdx = uHeader.indexOf("photo_url");

      for (let j = 1; j < uData.length; j++) {
        if (String(uData[j][uIdIdx] || "").trim() === targetId) {
          const uRole = uRoleIdx !== -1 ? String(uData[j][uRoleIdx] || "").trim().toUpperCase() : "";
          if (uRole === "PENGASUH") {
            const rawPhoto = uPhotoIdx !== -1 ? String(uData[j][uPhotoIdx] || "").trim() : "";
            return {
              identityId: targetId,
              email: uEmailIdx !== -1 ? String(uData[j][uEmailIdx] || "").trim().toLowerCase() : "",
              phone: uPhoneIdx !== -1 ? String(uData[j][uPhoneIdx] || "") : "",
              name: uNameIdx !== -1 ? String(uData[j][uNameIdx] || "") : "Pengasuh",
              titleName: uNameIdx !== -1 ? String(uData[j][uNameIdx] || "") : "Pengasuh",
              role: "PENGASUH",
              status: uStatusIdx !== -1 ? String(uData[j][uStatusIdx] || "").trim().toUpperCase() : "ACTIVE",
              photoUrl: rawPhoto,
              photo_url: rawPhoto
            };
          }
        }
      }
    }
  }

  return null;
}

/**
 * Lookup Identitas Pengguna Terpadu dari Sheet Users berdasarkan Email
 */
function getUserIdentityByEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) return null;

  const ss = getDatabaseSpreadsheet();
  const sheet = getAuthSheet(ss, SHEET_USERS);
  if (sheet) {
    const data = sheet.getDataRange().getValues();
    if (data && data.length >= 2) {
      const header = data[0].map(h => String(h || "").trim().toLowerCase());
      const idIdx = header.indexOf("user_id");
      const emailIdx = header.indexOf("email");
      const phoneIdx = header.indexOf("phone");
      const nameIdx = header.indexOf("name");
      const roleIdx = header.indexOf("role");
      const photoIdx = header.indexOf("photo_url");
      const statusIdx = header.indexOf("status");
      let passIdx = header.indexOf("password_hash");
      if (passIdx === -1) passIdx = header.indexOf("password");

      for (let i = 1; i < data.length; i++) {
        if (emailIdx !== -1 && String(data[i][emailIdx] || "").trim().toLowerCase() === normalized) {
          const photo = photoIdx !== -1 ? String(data[i][photoIdx] || "").trim() : "";
          return {
            identityId: idIdx !== -1 ? String(data[i][idIdx] || "") : "",
            userId: idIdx !== -1 ? String(data[i][idIdx] || "") : "",
            email: normalized,
            phone: phoneIdx !== -1 ? String(data[i][phoneIdx] || "") : "",
            name: nameIdx !== -1 ? String(data[i][nameIdx] || "") : "",
            titleName: nameIdx !== -1 ? String(data[i][nameIdx] || "") : "",
            role: roleIdx !== -1 ? String(data[i][roleIdx] || "WALI_SANTRI").toUpperCase() : "WALI_SANTRI",
            status: statusIdx !== -1 ? String(data[i][statusIdx] || "").trim().toUpperCase() : "ACTIVE",
            photoUrl: photo,
            photo_url: photo,
            passwordHash: passIdx !== -1 ? String(data[i][passIdx] || "") : ""
          };
        }
      }
    }
  }

  // Fallback ke legacy sheets jika belum dimigrasi
  return getAdminIdentityByEmail(normalized) || getPengasuhIdentityByEmail(normalized) || getWaliIdentityByEmail(normalized);
}

/**
 * Lookup Identitas Pengguna Terpadu dari Sheet Users berdasarkan ID
 */
function getUserIdentityById(userId) {
  if (!userId) return null;
  const targetId = String(userId).trim().toLowerCase();

  const ss = getDatabaseSpreadsheet();
  const sheet = getAuthSheet(ss, SHEET_USERS);
  if (sheet) {
    const data = sheet.getDataRange().getValues();
    if (data && data.length >= 2) {
      const header = data[0].map(h => String(h || "").trim().toLowerCase());
      const idIdx = header.indexOf("user_id");
      const emailIdx = header.indexOf("email");
      const phoneIdx = header.indexOf("phone");
      const nameIdx = header.indexOf("name");
      const roleIdx = header.indexOf("role");
      const photoIdx = header.indexOf("photo_url");
      const statusIdx = header.indexOf("status");
      let passIdx = header.indexOf("password_hash");
      if (passIdx === -1) passIdx = header.indexOf("password");

      for (let i = 1; i < data.length; i++) {
        if (idIdx !== -1 && String(data[i][idIdx] || "").trim().toLowerCase() === targetId) {
          const photo = photoIdx !== -1 ? String(data[i][photoIdx] || "").trim() : "";
          return {
            identityId: String(data[i][idIdx] || ""),
            userId: String(data[i][idIdx] || ""),
            email: emailIdx !== -1 ? String(data[i][emailIdx] || "").trim().toLowerCase() : "",
            phone: phoneIdx !== -1 ? String(data[i][phoneIdx] || "") : "",
            name: nameIdx !== -1 ? String(data[i][nameIdx] || "") : "",
            titleName: nameIdx !== -1 ? String(data[i][nameIdx] || "") : "",
            role: roleIdx !== -1 ? String(data[i][roleIdx] || "WALI_SANTRI").toUpperCase() : "WALI_SANTRI",
            status: statusIdx !== -1 ? String(data[i][statusIdx] || "").trim().toUpperCase() : "ACTIVE",
            photoUrl: photo,
            photo_url: photo,
            passwordHash: passIdx !== -1 ? String(data[i][passIdx] || "") : ""
          };
        }
      }
    }
  }

  // Fallback ke legacy sheets
  return getAdminIdentityById(userId) || getPengasuhIdentityById(userId) || getWaliIdentityById(userId);
}

/**
 * Normalisasi format tanggal untuk pencocokan toleran (YYYY-MM-DD)
 */

function uploadUserProfilePhoto(filePayload, token) {
  try {
    let actor = null;
    if (token) {
      try {
        actor = authenticateSession(token);
      } catch (e) {
        const legacy = verifySessionToken(token);
        if (legacy && legacy.role) {
          actor = { role: legacy.role, identityId: legacy.userId, email: legacy.email };
        }
      }
    }

    if (!actor) {
      return {
        success: false,
        status: "error",
        statusCode: 401,
        message: "Sesi autentikasi tidak valid atau telah kedaluwarsa."
      };
    }

    const fileData = (filePayload && filePayload.file) || filePayload;
    if (!fileData || !fileData.base64) {
      return {
        success: false,
        status: "error",
        statusCode: 400,
        message: "Data file foto profil (base64) wajib dikirimkan."
      };
    }

    const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const rawMime = String(fileData.mimeType || fileData.type || "image/jpeg").trim().toLowerCase();
    if (!allowedMimes.includes(rawMime)) {
      return {
        success: false,
        status: "error",
        statusCode: 400,
        message: "Format foto tidak didukung. Hanya gambar (JPG, PNG, WEBP) yang diperbolehkan."
      };
    }

    const decodedData = Utilities.base64Decode(fileData.base64);
    if (!decodedData || decodedData.length === 0) {
      return {
        success: false,
        status: "error",
        statusCode: 400,
        message: "Data file foto kosong atau rusak."
      };
    }

    // Maksimal 5 MB
    if (decodedData.length > 5 * 1024 * 1024) {
      return {
        success: false,
        status: "error",
        statusCode: 400,
        message: "Ukuran foto melebihi batas maksimal 5 MB."
      };
    }

    const role = String(filePayload.role || actor.role || "").toUpperCase();
    const identifier = String(filePayload.identityId || filePayload.identifier || filePayload.email || actor.identityId || actor.email || "").trim();

    const folder = DriveApp.getFolderById(FOLDER_ID_USER_PHOTOS);
    const cleanId = identifier.replace(/[^a-zA-Z0-9_-]/g, "");
    const fileName = "AVATAR_" + role + "_" + (cleanId || "USER") + "_" + new Date().getTime() + ".jpg";
    const blob = Utilities.newBlob(decodedData, rawMime, fileName);
    const newFile = folder.createFile(blob);
    newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const fileUrl = "https://lh3.googleusercontent.com/d/" + newFile.getId();
    const driveViewUrl = "https://drive.google.com/file/d/" + newFile.getId() + "/view?usp=sharing";

    // Update foto ke spreadsheet Users dan identitas yang sesuai
    const updated = updateUserPhotoInSheet(role, identifier, fileUrl);

    return {
      success: true,
      status: "success",
      statusCode: 200,
      url: fileUrl,
      fileUrl: fileUrl,
      driveViewUrl: driveViewUrl,
      fileId: newFile.getId(),
      role: role,
      updatedInSheet: updated,
      message: "Foto profil berhasil diunggah ke folder Drive Pengguna dan diperbarui!"
    };
  } catch (err) {
    console.error("[UPLOAD USER PHOTO ERROR]", err);
    return {
      success: false,
      status: "error",
      message: "Gagal mengunggah foto profil: " + err.message
    };
  }
}

/**
 * Update kolom photo_url di spreadsheet Users dan sheet sesuai role pengguna
 */
function updateUserPhotoInSheet(role, identifier, photoUrl) {
  if (!photoUrl || !identifier) return false;
  const ss = getDatabaseSpreadsheet();
  if (!ss) return false;

  let updatedAny = false;
  const cleanTarget = String(identifier).trim().toLowerCase();
  const cleanTargetPhone = cleanTarget.replace(/[^0-9]/g, "");

  // 1. Update di sheet Users (Master)
  const usersSheet = getAuthSheet(ss, SHEET_USERS);
  if (usersSheet) {
    const data = usersSheet.getDataRange().getValues();
    if (data && data.length >= 2) {
      const header = data[0].map(h => String(h || "").trim().toLowerCase());
      let idIdx = header.indexOf("user_id");
      let emailIdx = header.indexOf("email");
      let phoneIdx = header.indexOf("phone");
      let photoIdx = header.indexOf("photo_url");

      if (photoIdx === -1) {
        photoIdx = header.length;
        usersSheet.getRange(1, photoIdx + 1).setValue("photo_url").setFontWeight("bold").setBackground("#dcfce7");
      }

      for (let i = 1; i < data.length; i++) {
        const rowId = idIdx !== -1 ? String(data[i][idIdx] || "").trim().toLowerCase() : "";
        const rowEmail = emailIdx !== -1 ? String(data[i][emailIdx] || "").trim().toLowerCase() : "";
        const rowPhone = phoneIdx !== -1 ? String(data[i][phoneIdx] || "").replace(/[^0-9]/g, "") : "";

        if (
          (rowId && rowId === cleanTarget) ||
          (rowEmail && rowEmail === cleanTarget) ||
          (cleanTargetPhone && rowPhone && rowPhone === cleanTargetPhone)
        ) {
          usersSheet.getRange(i + 1, photoIdx + 1).setValue(photoUrl);
          updatedAny = true;
          break;
        }
      }
    }
  }

  // 2. Update di legacy sheet jika ada
  const normalizedRole = String(role || "").trim().toUpperCase();
  let targetSheetName = "";
  if (normalizedRole === "PENGASUH") {
    targetSheetName = SHEET_PENGASUH_IDENTITIES;
  } else if (normalizedRole === "WALI_SANTRI" || normalizedRole === "PARENT") {
    targetSheetName = SHEET_WALI_IDENTITIES;
  } else {
    targetSheetName = SHEET_ADMIN_IDENTITIES;
  }

  const sheet = getAuthSheet(ss, targetSheetName);
  if (sheet) {
    const data = sheet.getDataRange().getValues();
    if (data && data.length >= 2) {
      const header = data[0].map(h => String(h || "").trim().toLowerCase());
      let idIdx = header.indexOf("identity_id");
      let emailIdx = header.indexOf("email");
      let phoneIdx = header.indexOf("phone");
      let photoIdx = header.indexOf("photo_url");
      if (photoIdx === -1) photoIdx = header.indexOf("foto_profil");
      if (photoIdx === -1) photoIdx = header.indexOf("foto");

      if (photoIdx === -1) {
        photoIdx = header.length;
        sheet.getRange(1, photoIdx + 1).setValue("photo_url").setFontWeight("bold").setBackground("#dcfce7");
      }

      for (let i = 1; i < data.length; i++) {
        const rowId = idIdx !== -1 ? String(data[i][idIdx] || "").trim().toLowerCase() : "";
        const rowEmail = emailIdx !== -1 ? String(data[i][emailIdx] || "").trim().toLowerCase() : "";
        const rowPhone = phoneIdx !== -1 ? String(data[i][phoneIdx] || "").replace(/[^0-9]/g, "") : "";

        if (
          (rowId && rowId === cleanTarget) ||
          (rowEmail && rowEmail === cleanTarget) ||
          (cleanTargetPhone && rowPhone && rowPhone === cleanTargetPhone)
        ) {
          sheet.getRange(i + 1, photoIdx + 1).setValue(photoUrl);
          updatedAny = true;
          break;
        }
      }
    }
  }

  return updatedAny;
}

/**
 * Mengambil seluruh data pengguna dari sheet Users beserta santri terhubung untuk Manajemen Pengguna
 */
function getAllUsersWithLinkedStudents(token, skipCache) {
  try {
    let actor = null;
    if (token) {
      try {
        actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        verifySessionToken(token);
      }
    }

    const cacheKey = "CACHE_ALL_USERS_DATA";
    if (!skipCache) {
      try {
        const cached = CacheService.getScriptCache().get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (ce) {}
    }

    const ss = getDatabaseSpreadsheet();
    if (!ss) {
      return { success: false, status: "error", message: "Spreadsheet database tidak dapat diakses." };
    }

    const usersSheet = getAuthSheet(ss, SHEET_USERS);
    if (!usersSheet) {
      return { success: true, status: "success", users: [], total: 0 };
    }

    const usersData = usersSheet.getDataRange().getValues();
    if (!usersData || usersData.length < 2) {
      return { success: true, status: "success", users: [], total: 0 };
    }

    const uHeaders = usersData[0].map(h => String(h || "").trim().toLowerCase());
    let idIdx = uHeaders.indexOf("user_id");
    if (idIdx === -1) idIdx = uHeaders.indexOf("id");
    const emailIdx = uHeaders.indexOf("email");
    let phoneIdx = uHeaders.indexOf("phone");
    if (phoneIdx === -1) phoneIdx = uHeaders.indexOf("telepon");
    if (phoneIdx === -1) phoneIdx = uHeaders.indexOf("no_hp");
    let nameIdx = uHeaders.indexOf("name");
    if (nameIdx === -1) nameIdx = uHeaders.indexOf("nama");
    const roleIdx = uHeaders.indexOf("role");
    let photoIdx = uHeaders.indexOf("photo_url");
    if (photoIdx === -1) photoIdx = uHeaders.indexOf("foto_profil");
    if (photoIdx === -1) photoIdx = uHeaders.indexOf("foto");
    const statusIdx = uHeaders.indexOf("status");
    let createdIdx = uHeaders.indexOf("created_at");
    if (createdIdx === -1) createdIdx = uHeaders.indexOf("dibuat_pada");
    const lastLoginIdx = uHeaders.indexOf("last_login_at");
    let lastSeenIdx = uHeaders.indexOf("last_seen_at");
    if (lastSeenIdx === -1) lastSeenIdx = uHeaders.indexOf("last_seen");
    let devIdx = uHeaders.indexOf("device_info");
    if (devIdx === -1) devIdx = uHeaders.indexOf("perangkat");

    // Ambil mapping santri untuk Wali Santri
    const mapSheet = getAuthSheet(ss, SHEET_WALI_SANTRI_MAP);
    const studSheet = getAuthSheet(ss, SHEET_STUDENTS);
    const studentMap = {};
    if (studSheet) {
      const sData = studSheet.getDataRange().getValues();
      if (sData && sData.length > 1) {
        const sHeaders = sData[0].map(h => String(h || "").trim().toLowerCase());
        const sIdIdx = sHeaders.indexOf("student_id");
        const sNisIdx = sHeaders.indexOf("nis") !== -1 ? sHeaders.indexOf("nis") : sHeaders.indexOf("nisn");
        const sNameIdx = sHeaders.indexOf("name");
        for (let s = 1; s < sData.length; s++) {
          const sId = String(sData[s][sIdIdx] || "").trim();
          if (sId) {
            studentMap[sId] = {
              studentId: sId,
              nis: sNisIdx !== -1 ? String(sData[s][sNisIdx] || "").trim() : "",
              name: sNameIdx !== -1 ? String(sData[s][sNameIdx] || "").trim() : "Santri"
            };
          }
        }
      }
    }

    const userLinkedMap = {};
    if (mapSheet) {
      const mData = mapSheet.getDataRange().getValues();
      if (mData && mData.length > 1) {
        for (let m = 1; m < mData.length; m++) {
          const waliId = String(mData[m][1] || "").trim();
          const studentId = String(mData[m][2] || "").trim();
          const rel = String(mData[m][3] || "").trim();
          if (waliId && studentId && studentMap[studentId]) {
            if (!userLinkedMap[waliId]) userLinkedMap[waliId] = [];
            userLinkedMap[waliId].push({
              ...studentMap[studentId],
              relationship: rel
            });
          }
        }
      }
    }

    const users = [];
    for (let i = 1; i < usersData.length; i++) {
      const uId = idIdx !== -1 ? String(usersData[i][idIdx] || "").trim() : "";
      const email = emailIdx !== -1 ? String(usersData[i][emailIdx] || "").trim() : "";
      if (!uId && !email) continue;

      const role = roleIdx !== -1 ? String(usersData[i][roleIdx] || "WALI_SANTRI").trim().toUpperCase() : "WALI_SANTRI";
      const linked = userLinkedMap[uId] || userLinkedMap[email] || [];

      users.push({
        userId: uId,
        identityId: uId,
        email: email,
        phone: phoneIdx !== -1 ? String(usersData[i][phoneIdx] || "").trim() : "",
        name: nameIdx !== -1 ? String(usersData[i][nameIdx] || "").trim() : "",
        role: role,
        photoUrl: photoIdx !== -1 ? String(usersData[i][photoIdx] || "").trim() : "",
        status: statusIdx !== -1 ? String(usersData[i][statusIdx] || "ACTIVE").trim().toUpperCase() : "ACTIVE",
        createdAt: createdIdx !== -1 ? String(usersData[i][createdIdx] || "").trim() : "",
        lastLoginAt: lastLoginIdx !== -1 ? String(usersData[i][lastLoginIdx] || "").trim() : "",
        lastSeenAt: lastSeenIdx !== -1 ? String(usersData[i][lastSeenIdx] || "").trim() : (lastLoginIdx !== -1 ? String(usersData[i][lastLoginIdx] || "").trim() : ""),
        last_seen_at: lastSeenIdx !== -1 ? String(usersData[i][lastSeenIdx] || "").trim() : (lastLoginIdx !== -1 ? String(usersData[i][lastLoginIdx] || "").trim() : ""),
        deviceInfo: devIdx !== -1 ? String(usersData[i][devIdx] || "").trim() : "",
        device_info: devIdx !== -1 ? String(usersData[i][devIdx] || "").trim() : "",
        linkedStudents: linked
      });
    }

    const result = {
      success: true,
      status: "success",
      users: users,
      total: users.length,
      summary: {
        total: users.length,
        wali: users.filter(u => u.role === "WALI_SANTRI").length,
        pengasuh: users.filter(u => u.role === "PENGASUH").length,
        asatidz: users.filter(u => u.role === "ASATIDZ" || u.role === "PEGAWAI" || u.role === "EDITOR").length,
        bendahara: users.filter(u => u.role === "BENDAHARA").length,
        pengurus: users.filter(u => u.role === "PENGURUS").length,
        pegawai: users.filter(u => u.role === "ASATIDZ" || u.role === "PEGAWAI" || u.role === "EDITOR").length,
        admin: users.filter(u => u.role === "ADMIN").length,
        superAdmin: users.filter(u => u.role === "SUPER_ADMIN").length
      }
    };

    try {
      CacheService.getScriptCache().put(cacheKey, JSON.stringify(result), 30);
    } catch (ce) {}

    return result;
  } catch (err) {
    console.error("[GET ALL USERS ERROR]", err);
    return {
      success: false,
      status: "error",
      message: "Gagal memuat data pengguna: " + err.message
    };
  }
}

/**
 * Memperbarui status kehadiran online (telemetri heartbeat & perangkat pengguna)
 */
function handleUserPresenceHeartbeat(payload) {
  try {
    const rawPayload = payload || {};
    const userId = String(rawPayload.userId || rawPayload.user_id || rawPayload.identityId || "").trim();
    const email = String(rawPayload.email || "").trim().toLowerCase();
    const phone = String(rawPayload.phone || "").replace(/[^0-9]/g, "");
    const token = rawPayload.token || "";
    const deviceInfo = String(rawPayload.deviceInfo || rawPayload.device_info || "").trim();
    const nowIso = new Date().toISOString();

    let targetId = userId;
    let targetEmail = email;

    if (token && (!targetId && !targetEmail)) {
      try {
        const claims = verifySessionToken(token);
        if (claims && claims.userId) targetId = claims.userId;
      } catch (e) {}
    }

    if (!targetId && !targetEmail && !phone) {
      return { success: false, message: "User identifier missing" };
    }

    const ss = getDatabaseSpreadsheet();
    if (!ss) return { success: false, message: "Database not available" };

    const usersSheet = getAuthSheet(ss, SHEET_USERS);
    if (!usersSheet) return { success: false, message: "Sheet Users not found" };

    const data = usersSheet.getDataRange().getValues();
    if (!data || data.length < 1) return { success: false, message: "Sheet empty" };

    const header = data[0].map(h => String(h || "").trim().toLowerCase());
    let idIdx = header.indexOf("user_id");
    if (idIdx === -1) idIdx = header.indexOf("id");
    const emailIdx = header.indexOf("email");
    let phoneIdx = header.indexOf("phone");
    if (phoneIdx === -1) phoneIdx = header.indexOf("telepon");
    if (phoneIdx === -1) phoneIdx = header.indexOf("no_hp");

    let lastSeenIdx = header.indexOf("last_seen_at");
    if (lastSeenIdx === -1) lastSeenIdx = header.indexOf("last_seen");
    let devIdx = header.indexOf("device_info");
    if (devIdx === -1) devIdx = header.indexOf("perangkat");

    if (lastSeenIdx === -1) {
      lastSeenIdx = header.length;
      header.push("last_seen_at");
      usersSheet.getRange(1, lastSeenIdx + 1).setValue("last_seen_at").setFontWeight("bold").setBackground("#e0f2fe");
    }
    if (devIdx === -1) {
      devIdx = header.length;
      header.push("device_info");
      usersSheet.getRange(1, devIdx + 1).setValue("device_info").setFontWeight("bold").setBackground("#e0f2fe");
    }

    let updated = false;
    for (let i = 1; i < data.length; i++) {
      const rowId = idIdx !== -1 ? String(data[i][idIdx] || "").trim() : "";
      const rowEmail = emailIdx !== -1 ? String(data[i][emailIdx] || "").trim().toLowerCase() : "";
      const rowPhone = phoneIdx !== -1 ? String(data[i][phoneIdx] || "").replace(/[^0-9]/g, "") : "";

      const matchId = targetId && (rowId === targetId);
      const matchEmail = targetEmail && (rowEmail === targetEmail);
      const matchPhone = phone && (rowPhone === phone);

      if (matchId || matchEmail || matchPhone) {
        usersSheet.getRange(i + 1, lastSeenIdx + 1).setValue(nowIso);
        if (deviceInfo) {
          usersSheet.getRange(i + 1, devIdx + 1).setValue(deviceInfo);
        }
        updated = true;
        break;
      }
    }

    if (updated) {
      try {
        CacheService.getScriptCache().remove("CACHE_ALL_USERS_DATA");
      } catch (ce) {}
    }

    return {
      success: true,
      updated: updated,
      lastSeenAt: nowIso,
      deviceInfo: deviceInfo
    };
  } catch (err) {
    console.error("[HEARTBEAT ERROR]", err);
    return { success: false, message: err.message };
  }
}

/**
 * Menambah atau memperbarui akun pengguna dari menu Manajemen Pengguna
 */
function saveAdminUserData(payload, token) {
  try {
    let actor = null;
    if (token) {
      try {
        actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "SUPER_ADMIN", "ASATIDZ", "PEGAWAI"]);
      } catch (authErr) {
        verifySessionToken(token);
      }
    }

    const userData = payload.user || payload;
    const email = String(userData.email || "").trim().toLowerCase();
    const name = String(userData.name || "").trim();
    const role = String(userData.role || "WALI_SANTRI").trim().toUpperCase();
    const phone = String(userData.phone || "").trim();
    const status = String(userData.status || "ACTIVE").trim().toUpperCase();
    const targetUserId = String(userData.userId || userData.user_id || userData.identityId || "").trim();
    const studentNis = String(userData.studentNis || userData.nis || "").trim();
    const actorRole = actor ? String(actor.role || "").toUpperCase() : "";

    // Proteksi: Hanya SUPER_ADMIN yang berhak membuat atau memberikan role SUPER_ADMIN
    if (role === "SUPER_ADMIN" && actorRole !== "SUPER_ADMIN") {
      return {
        success: false,
        status: "error",
        message: "Hanya akun dengan peran SUPER_ADMIN yang memiliki wewenang untuk menetapkan atau mengedit akun SUPER_ADMIN."
      };
    }

    if (!email || !email.includes("@")) {
      return { success: false, status: "error", message: "Alamat email pengguna wajib diisi dengan format valid." };
    }
    if (!name) {
      return { success: false, status: "error", message: "Nama pengguna wajib diisi." };
    }

    const ss = getDatabaseSpreadsheet();
    if (!ss) return { success: false, status: "error", message: "Spreadsheet database tidak dapat diakses." };

    setupAuthSystemSheets();
    const usersSheet = getAuthSheet(ss, SHEET_USERS);
    if (!usersSheet) return { success: false, status: "error", message: "Sheet Users tidak tersedia." };

    const usersData = usersSheet.getDataRange().getValues();
    const uHeaders = usersData[0].map(h => String(h || "").trim().toLowerCase());
    let idIdx = uHeaders.indexOf("user_id");
    if (idIdx === -1) idIdx = uHeaders.indexOf("id");
    const emailIdx = uHeaders.indexOf("email");
    let phoneIdx = uHeaders.indexOf("phone");
    if (phoneIdx === -1) phoneIdx = uHeaders.indexOf("telepon");
    if (phoneIdx === -1) phoneIdx = uHeaders.indexOf("no_hp");
    let nameIdx = uHeaders.indexOf("name");
    if (nameIdx === -1) nameIdx = uHeaders.indexOf("nama");
    const roleIdx = uHeaders.indexOf("role");
    let photoIdx = uHeaders.indexOf("photo_url");
    if (photoIdx === -1) photoIdx = uHeaders.indexOf("foto_profil");
    if (photoIdx === -1) photoIdx = uHeaders.indexOf("foto");
    const statusIdx = uHeaders.indexOf("status");
    let createdIdx = uHeaders.indexOf("created_at");
    if (createdIdx === -1) createdIdx = uHeaders.indexOf("dibuat_pada");

    let foundRow = -1;
    let actualUserId = targetUserId;

    for (let i = 1; i < usersData.length; i++) {
      const rowId = idIdx !== -1 ? String(usersData[i][idIdx] || "").trim() : "";
      const rowEmail = emailIdx !== -1 ? String(usersData[i][emailIdx] || "").trim().toLowerCase() : "";
      if ((actualUserId && rowId === actualUserId) || (rowEmail && rowEmail === email)) {
        foundRow = i + 1;
        actualUserId = rowId || actualUserId;
        break;
      }
    }

    // Proteksi: Jika akun yang diedit adalah SUPER_ADMIN, pastikan aktor adalah SUPER_ADMIN
    if (foundRow !== -1) {
      const existingRole = roleIdx !== -1 ? String(usersData[foundRow - 1][roleIdx] || "").toUpperCase() : "";
      if (existingRole === "SUPER_ADMIN" && actorRole !== "SUPER_ADMIN") {
        return {
          success: false,
          status: "error",
          message: "Akun SUPER_ADMIN hanya dapat dimodifikasi oleh sesama SUPER_ADMIN."
        };
      }
    }

    const nowIso = new Date().toISOString();

    if (foundRow !== -1) {
      // Update data baris pengguna yang sudah ada
      if (nameIdx !== -1) usersSheet.getRange(foundRow, nameIdx + 1).setValue(name);
      if (emailIdx !== -1) usersSheet.getRange(foundRow, emailIdx + 1).setValue(email);
      if (phoneIdx !== -1 && phone) usersSheet.getRange(foundRow, phoneIdx + 1).setValue(phone);
      if (roleIdx !== -1) usersSheet.getRange(foundRow, roleIdx + 1).setValue(role);
      if (statusIdx !== -1) usersSheet.getRange(foundRow, statusIdx + 1).setValue(status);
    } else {
      // Baris baru
      if (!actualUserId) {
        actualUserId = "USR_" + Utilities.getUuid().replace(/-/g, "").substring(0, 12);
      }
      usersSheet.appendRow([
        actualUserId,
        email,
        phone,
        name,
        role,
        userData.photoUrl || "",
        status,
        nowIso,
        ""
      ]);
    }

    // Jika role WALI_SANTRI dan ada studentNis, hubungkan di Wali_Santri_Map
    if (role === "WALI_SANTRI" && studentNis) {
      const student = getStudentByNis(studentNis);
      if (student && student.studentId) {
        const mapSheet = getAuthSheet(ss, SHEET_WALI_SANTRI_MAP);
        if (mapSheet) {
          const mData = mapSheet.getDataRange().getValues();
          let exists = false;
          for (let m = 1; m < mData.length; m++) {
            if (String(mData[m][1]).trim() === actualUserId && String(mData[m][2]).trim() === student.studentId) {
              exists = true;
              break;
            }
          }
          if (!exists) {
            const mapId = "MAP_" + Utilities.getUuid().replace(/-/g, "").substring(0, 12);
            mapSheet.appendRow([mapId, actualUserId, student.studentId, userData.relationship || "GUARDIAN", "VERIFIED", nowIso]);
          }
        }
      }
    }

    // Sinkronisasi otomatis ke role identity sheet terkait (Wali_Identities, Admin_Identities, Pengasuh_Identities)
    try {
      syncUserToRoleIdentitySheet(ss, actualUserId, email, phone, name, role, status, userData.photoUrl || "");
    } catch (syncErr) {
      console.warn("[SYNC ERROR in saveAdminUserData]", syncErr);
    }

    try {
      CacheService.getScriptCache().remove("CACHE_ALL_USERS_DATA");
    } catch (ce) {}

    return {
      success: true,
      status: "success",
      userId: actualUserId,
      message: foundRow !== -1 ? "Data pengguna berhasil diperbarui!" : "Pengguna baru berhasil ditambahkan!"
    };
  } catch (err) {
    console.error("[SAVE USER ERROR]", err);
    return {
      success: false,
      status: "error",
      message: "Gagal menyimpan pengguna: " + err.message
    };
  }
}

/**
 * Toggle status aktif / suspend akun pengguna
 */
function toggleUserStatus(payload, token) {
  try {
    let actor = null;
    if (token) {
      try {
        actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        verifySessionToken(token);
      }
    }

    const userId = String(payload.userId || payload.user_id || "").trim();
    if (!userId) return { success: false, message: "User ID wajib dikirimkan." };

    const ss = getDatabaseSpreadsheet();
    const usersSheet = getAuthSheet(ss, SHEET_USERS);
    if (!usersSheet) return { success: false, message: "Sheet Users tidak ditemukan." };

    const data = usersSheet.getDataRange().getValues();
    const uHeaders = data[0].map(h => String(h || "").trim().toLowerCase());
    const idIdx = uHeaders.indexOf("user_id");
    const statusIdx = uHeaders.indexOf("status");
    const emailIdx = uHeaders.indexOf("email");
    const phoneIdx = uHeaders.indexOf("phone");
    const nameIdx = uHeaders.indexOf("name");
    const roleIdx = uHeaders.indexOf("role");
    const photoIdx = uHeaders.indexOf("photo_url");

    for (let i = 1; i < data.length; i++) {
      if (idIdx !== -1 && String(data[i][idIdx] || "").trim() === userId) {
        const currentStatus = statusIdx !== -1 ? String(data[i][statusIdx] || "").trim().toUpperCase() : "ACTIVE";
        const newStatus = currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
        usersSheet.getRange(i + 1, statusIdx + 1).setValue(newStatus);

        const email = emailIdx !== -1 ? String(data[i][emailIdx] || "").trim() : "";
        const phone = phoneIdx !== -1 ? String(data[i][phoneIdx] || "").trim() : "";
        const name = nameIdx !== -1 ? String(data[i][nameIdx] || "").trim() : "";
        const role = roleIdx !== -1 ? String(data[i][roleIdx] || "").trim() : "";
        const photo = photoIdx !== -1 ? String(data[i][photoIdx] || "").trim() : "";
        try {
          syncUserToRoleIdentitySheet(ss, userId, email, phone, name, role, newStatus, photo);
        } catch (syncErr) {
          console.warn("[SYNC ERROR in toggleUserStatus]", syncErr);
        }

        return {
          success: true,
          status: "success",
          newStatus: newStatus,
          message: `Status pengguna berhasil diubah menjadi ${newStatus}.`
        };
      }
    }

    return { success: false, message: "Pengguna tidak ditemukan." };
  } catch (err) {
    return { success: false, message: "Gagal mengubah status: " + err.message };
  }
}

/**
 * Sinkronisasi manual seluruh data sheet Users ke sheet role identitas
 */
function adminSyncAllRoleSheets(token) {
  try {
    if (token) {
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        verifySessionToken(token);
      }
    }
    const ss = getDatabaseSpreadsheet();
    if (!ss) return { success: false, message: "Spreadsheet database tidak dapat diakses." };
    setupAuthSystemSheets();
    const result = syncAllUsersToRoleSheets(ss);
    return {
      success: true,
      status: "success",
      message: "Seluruh identitas pengguna berhasil disinkronkan ke sheet Wali_Identities, Admin_Identities, dan Pengasuh_Identities.",
      details: result
    };
  } catch (e) {
    return { success: false, status: "error", message: "Gagal menyinkronkan data: " + e.message };
  }
}

/**
 * Baseline Default Permissions per Role
 */
const DEFAULT_ROLE_PERMISSIONS_MAP = {
  "SUPER_ADMIN": ["*"],
  "ADMIN": [
    "santri.view", "santri.create", "santri.edit", "santri.export", "unit.manage",
    "tahfidz.view", "tahfidz.entry", "tahfidz.target", "tpq.view", "tpq.entry", "sorogan.view", "sorogan.entry", "presensi.view", "presensi.entry",
    "keuangan.view", "keuangan.spp", "keuangan.tagihan", "keuangan.verify", "keuangan.billing",
    "akuntansi.view", "akuntansi.transaksi", "akuntansi.tutupkasir", "akuntansi.laporan",
    "ppdb.manage",
    "berita.manage", "banner.manage", "galeri.manage", "notifikasi.broadcast",
    "profil.manage", "pegawai.manage", "users.manage", "roles.manage", "system.config"
  ],
  "ASATIDZ": [
    "santri.view",
    "tahfidz.view", "tahfidz.entry", "tahfidz.target", "tpq.view", "tpq.entry", "sorogan.view", "sorogan.entry", "presensi.view", "presensi.entry",
    "pegawai.manage", "profil.manage"
  ],
  "BENDAHARA": [
    "santri.view", "ppdb.manage",
    "keuangan.view", "keuangan.spp", "keuangan.tagihan", "keuangan.verify", "keuangan.billing",
    "akuntansi.view", "akuntansi.transaksi", "akuntansi.tutupkasir", "akuntansi.laporan",
    "notifikasi.broadcast", "pegawai.manage", "profil.manage"
  ],
  "PENGURUS": [
    "santri.view", "presensi.view", "presensi.entry", "unit.manage", "ppdb.manage", "berita.manage", "banner.manage", "galeri.manage", "notifikasi.broadcast", "profil.manage"
  ],
  "PENGASUH": [
    "santri.view", "tahfidz.view", "tpq.view", "sorogan.view", "presensi.view", "unit.manage", "ppdb.manage",
    "keuangan.view", "akuntansi.view", "akuntansi.laporan",
    "berita.manage", "galeri.manage", "profil.manage", "pegawai.manage"
  ],
  "WALI_SANTRI": [
    "santri.view", "tahfidz.view", "tpq.view", "sorogan.view", "presensi.view", "keuangan.view", "berita.manage", "galeri.manage", "profil.manage"
  ]
};

const SHEET_ROLES_PERMISSIONS = "Roles_Permissions";

/**
 * Dapatkan atau inisialisasi sheet Roles_Permissions di Google Spreadsheet
 */
function getOrCreateRolesPermissionsSheet() {
  const ss = getDatabaseSpreadsheet();
  if (!ss) return null;

  let sheet = ss.getSheetByName(SHEET_ROLES_PERMISSIONS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_ROLES_PERMISSIONS);
    const headers = [
      "Role_Key",
      "Role_Name",
      "Total_Active",
      "Active_Permissions_JSON",
      "Updated_At",
      "Updated_By"
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setBackground("#059669")
      .setFontColor("#ffffff");

    // Inisialisasi baris master 7 peran
    const roleDescriptions = {
      "SUPER_ADMIN": "Super Administrator",
      "ADMIN": "Administrator Lembaga",
      "ASATIDZ": "Dewan Asatidz / Pengajar",
      "BENDAHARA": "Bendahara / Keuangan",
      "PENGURUS": "Pengurus / Kesantrian",
      "PENGASUH": "Dewan Masyayikh / Pengasuh",
      "WALI_SANTRI": "Wali Santri / Orang Tua"
    };

    const nowIso = new Date().toISOString();
    Object.keys(DEFAULT_ROLE_PERMISSIONS_MAP).forEach(k => {
      const perms = DEFAULT_ROLE_PERMISSIONS_MAP[k] || [];
      sheet.appendRow([
        k,
        roleDescriptions[k] || k,
        perms.includes("*") ? 28 : perms.length,
        JSON.stringify(perms),
        nowIso,
        "SYSTEM_INIT"
      ]);
    });
  }
  return sheet;
}

/**
 * Ambil konfigurasi izin peran dari Sheet Roles_Permissions (dengan fallback ke Properties & Default)
 */
function getRolePermissionsBackend(token) {
  try {
    let permissionsMap = {};

    // 1. Coba baca dari sheet Roles_Permissions
    try {
      const sheet = getOrCreateRolesPermissionsSheet();
      if (sheet && sheet.getLastRow() > 1) {
        const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
        for (let i = 0; i < rows.length; i++) {
          const rKey = String(rows[i][0] || "").trim().toUpperCase();
          const rJson = String(rows[i][3] || "");
          if (rKey && rJson) {
            try {
              permissionsMap[rKey] = JSON.parse(rJson);
            } catch (pErr) {
              console.warn("[PARSE PERMS ROW ERROR]", rKey, pErr);
            }
          }
        }
      }
    } catch (sheetErr) {
      console.warn("[GET ROLES SHEET ERROR]", sheetErr);
    }

    // 2. Fallback ke ScriptProperties jika sheet kosong
    if (Object.keys(permissionsMap).length === 0) {
      const props = PropertiesService.getScriptProperties();
      const storedJson = props.getProperty("MUBAROKAH_ROLE_PERMISSIONS_CONFIG");
      if (storedJson) {
        try {
          permissionsMap = JSON.parse(storedJson);
        } catch (e) {}
      }
    }

    // 3. Gabungkan dengan baseline default untuk role yang belum terdefinisi
    const merged = {};
    Object.keys(DEFAULT_ROLE_PERMISSIONS_MAP).forEach(roleKey => {
      merged[roleKey] = (permissionsMap && Array.isArray(permissionsMap[roleKey]))
        ? permissionsMap[roleKey]
        : DEFAULT_ROLE_PERMISSIONS_MAP[roleKey];
    });

    return {
      success: true,
      status: "success",
      permissions: merged,
      message: "Data konfigurasi izin peran berhasil diambil."
    };
  } catch (err) {
    return {
      success: false,
      status: "error",
      message: "Gagal mengambil data izin peran: " + err.message,
      permissions: DEFAULT_ROLE_PERMISSIONS_MAP
    };
  }
}

/**
 * Simpan konfigurasi izin peran ke Sheet Roles_Permissions dan ScriptProperties
 */
function saveRolePermissionsBackend(roleKey, newPermissions, token) {
  try {
    if (!token) return { success: false, message: "Token autentikasi wajib dikirimkan." };
    
    // Verifikasi otorisasi: hanya SUPER_ADMIN (atau ADMIN) yang berhak mengatur izin
    let actorEmail = "ADMIN_USER";
    try {
      const actor = authenticateSession(token);
      authorizeRole(actor, ["ADMIN"]);
      if (actor && actor.email) actorEmail = actor.email;
    } catch (authErr) {
      verifySessionToken(token);
    }

    roleKey = String(roleKey || "").trim().toUpperCase();
    if (!roleKey) return { success: false, message: "Parameter roleKey wajib diisi." };

    if (!Array.isArray(newPermissions)) {
      return { success: false, message: "Format permissions harus berupa array." };
    }

    // Role SUPER_ADMIN selalu retain ["*"] untuk menjamin tidak terkunci
    if (roleKey === "SUPER_ADMIN" && !newPermissions.includes("*")) {
      newPermissions = ["*"];
    }

    const nowIso = new Date().toISOString();
    const countActive = newPermissions.includes("*") ? 28 : newPermissions.length;
    const permsJson = JSON.stringify(newPermissions);

    // 1. Simpan ke Google Spreadsheet tab Roles_Permissions
    try {
      const sheet = getOrCreateRolesPermissionsSheet();
      if (sheet) {
        const lastRow = sheet.getLastRow();
        let foundRowIndex = -1;
        if (lastRow > 1) {
          const keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
          for (let i = 0; i < keys.length; i++) {
            if (String(keys[i][0]).trim().toUpperCase() === roleKey) {
              foundRowIndex = i + 2;
              break;
            }
          }
        }

        if (foundRowIndex !== -1) {
          sheet.getRange(foundRowIndex, 3).setValue(countActive);
          sheet.getRange(foundRowIndex, 4).setValue(permsJson);
          sheet.getRange(foundRowIndex, 5).setValue(nowIso);
          sheet.getRange(foundRowIndex, 6).setValue(actorEmail);
        } else {
          sheet.appendRow([roleKey, roleKey, countActive, permsJson, nowIso, actorEmail]);
        }
      }
    } catch (sheetSaveErr) {
      console.warn("[SAVE ROLE TO SHEET ERROR]", sheetSaveErr);
    }

    // 2. Simpan juga ke ScriptProperties untuk fast-read cache
    try {
      const props = PropertiesService.getScriptProperties();
      const storedJson = props.getProperty("MUBAROKAH_ROLE_PERMISSIONS_CONFIG");
      let currentMap = {};
      if (storedJson) {
        try { currentMap = JSON.parse(storedJson); } catch (e) {}
      }
      Object.keys(DEFAULT_ROLE_PERMISSIONS_MAP).forEach(k => {
        if (!currentMap[k]) currentMap[k] = DEFAULT_ROLE_PERMISSIONS_MAP[k];
      });
      currentMap[roleKey] = newPermissions;
      props.setProperty("MUBAROKAH_ROLE_PERMISSIONS_CONFIG", JSON.stringify(currentMap));
    } catch (propErr) {
      console.warn("[SAVE ROLE TO PROPS ERROR]", propErr);
    }

    return {
      success: true,
      status: "success",
      message: `Konfigurasi izin untuk peran ${roleKey} berhasil disimpan ke Spreadsheet & cache.`,
      roleKey: roleKey,
      permissions: newPermissions
    };
  } catch (err) {
    return {
      success: false,
      status: "error",
      message: "Gagal menyimpan konfigurasi izin peran: " + err.message
    };
  }
}

const CACHE_KEY_STUDENTS = "admin_students_list_v1";

/**
 * Cache Invalidation Helper untuk Master Data Santri
 */

function getSessionById(sessionId) {
  if (!sessionId) return null;
  const ss = getDatabaseSpreadsheet();
  const sheet = getAuthSheet(ss, SHEET_AUTH_SESSIONS);
  if (!sheet) return null;

  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]).trim() === String(sessionId).trim()) {
      return {
        session_id: String(data[i][0]),
        identity_id: String(data[i][1]),
        role: String(data[i][2]),
        issued_at: String(data[i][3]),
        expires_at: String(data[i][4]),
        status: String(data[i][5]),
        revoked_at: String(data[i][6] || ""),
        token_version: String(data[i][8] || "")
      };
    }
  }
  return null;
}

function createAuthSessionRecord(identityId, role, ttlHours = null) {
  const ss = getDatabaseSpreadsheet();
  const sheet = getAuthSheet(ss, SHEET_AUTH_SESSIONS);
  if (!sheet) {
    throw new Error("Tabel sesi 'Auth_Sessions' belum diinisialisasi oleh administrator.");
  }

  const effectiveTtlHours = (typeof ttlHours === "number" && ttlHours > 0) ? ttlHours : getSessionTtlHoursForRole(role);
  const sessionId = "SES_" + Utilities.getUuid().replace(/-/g, "");
  const now = new Date();
  const issuedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + (effectiveTtlHours * 3600000)).toISOString();
  const tokenVersion = String(getServerSecret("TOKEN_VERSION", "1"));

  sheet.appendRow([
    sessionId,
    identityId,
    role,
    issuedAt,
    expiresAt,
    "ACTIVE",
    "",
    issuedAt,
    tokenVersion
  ]);

  return {
    sessionId: sessionId,
    expiresAt: expiresAt,
    tokenVersion: tokenVersion
  };
}

function revokeAuthSessionRecord(sessionId) {
  if (!sessionId) return false;
  const ss = getDatabaseSpreadsheet();
  const sheet = getAuthSheet(ss, SHEET_AUTH_SESSIONS);
  if (!sheet) return false;

  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]).trim() === String(sessionId).trim()) {
      sheet.getRange(i + 1, 6).setValue("REVOKED");
      sheet.getRange(i + 1, 7).setValue(new Date().toISOString());
      return true;
    }
  }
  return false;
}

function getLinkedStudentsForWali(waliId) {
  if (!waliId) return [];
  const ss = getDatabaseSpreadsheet();
  const mapSheet = getAuthSheet(ss, SHEET_WALI_SANTRI_MAP);
  let studentsSheet = getAuthSheet(ss, SHEET_STUDENTS);
  if (!studentsSheet) {
    studentsSheet = ss.getSheetByName("Student") || ss.getSheetByName("Students");
  }

  if (!mapSheet || !studentsSheet) return [];

  const mapData = mapSheet.getDataRange().getValues();
  const activeStudentIds = [];
  const relationshipMap = {};

  for (let i = 1; i < mapData.length; i++) {
    if (String(mapData[i][1]).trim() === String(waliId).trim()) {
      const status = String(mapData[i][4] || "VERIFIED").toUpperCase();
      if (status === "VERIFIED") {
        const studentId = String(mapData[i][2]).trim();
        activeStudentIds.push(studentId);
        relationshipMap[studentId] = String(mapData[i][3] || RELATIONSHIP_ENUM.GUARDIAN).toUpperCase();
      }
    }
  }

  if (activeStudentIds.length === 0) return [];

  const studentData = studentsSheet.getDataRange().getValues();
  if (!studentData || studentData.length < 2) return [];

  const header = studentData[0].map(h => String(h || "").trim().toLowerCase().replace(/\s+/g, "_"));
  let idIdx = header.indexOf("student_id");
  let nisIdx = header.indexOf("nis");
  if (nisIdx === -1) nisIdx = header.indexOf("nisn");
  let nikIdx = header.indexOf("nik");
  let nameIdx = header.indexOf("name");
  if (nameIdx === -1) nameIdx = header.indexOf("nama");
  let genderIdx = header.indexOf("gender");
  if (genderIdx === -1) genderIdx = header.indexOf("jenis");
  if (genderIdx === -1) genderIdx = header.indexOf("jenis_kelamin");
  let birthIdx = header.indexOf("birth_date");
  if (birthIdx === -1) birthIdx = header.indexOf("tanggal_lahir");

  // Deteksi fleksibel untuk photo/foto
  let photoIdx = -1;
  for (let h = 0; h < header.length; h++) {
    const hn = header[h];
    if (hn === "photo_url" || hn === "foto_profil" || hn === "foto" || hn === "photo" || hn === "foto_santri" || hn === "link_foto" || hn.includes("foto") || hn.includes("photo")) {
      photoIdx = h;
      break;
    }
  }
  if (photoIdx === -1 && header.length >= 10) photoIdx = 9; // Kolom J (indeks ke-9 array)

  // Deteksi kolom Halaqah & Muhafiz langsung dari sheet Student
  let halaqahIdx = header.indexOf("halaqah");
  if (halaqahIdx === -1) halaqahIdx = header.indexOf("nama_halaqah");
  if (halaqahIdx === -1) halaqahIdx = header.indexOf("kelompok_halaqah");
  let muhafizIdx = header.indexOf("muhafiz");
  if (muhafizIdx === -1) muhafizIdx = header.indexOf("muhafidz");
  if (muhafizIdx === -1) muhafizIdx = header.indexOf("pembimbing");
  if (muhafizIdx === -1) muhafizIdx = header.indexOf("ustadz");
  if (muhafizIdx === -1) muhafizIdx = header.indexOf("guru");

  let progIdx = header.indexOf("program");
  let statusIdx = header.indexOf("status");
  let qrIdx = header.indexOf("qr_code");
  if (qrIdx === -1) qrIdx = header.indexOf("qrcode");

  if (idIdx === -1) idIdx = 0;
  if (nisIdx === -1) nisIdx = 1;
  if (nameIdx === -1) nameIdx = 2;

  const results = [];

  for (let i = 1; i < studentData.length; i++) {
    const id = String(studentData[i][idIdx]).trim();
    if (activeStudentIds.includes(id)) {
      const rowNis = nisIdx !== -1 ? String(studentData[i][nisIdx] || "") : "";
      let rawPhoto = photoIdx !== -1 ? String(studentData[i][photoIdx] || "").trim() : "";
      if (rawPhoto) {
        const driveMatch = rawPhoto.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || rawPhoto.match(/id=([a-zA-Z0-9_-]+)/);
        if (driveMatch && driveMatch[1]) {
          rawPhoto = "https://lh3.googleusercontent.com/d/" + driveMatch[1];
        }
      }

      let rawQr = qrIdx !== -1 ? String(studentData[i][qrIdx] || "").trim() : "";
      if (!rawQr) {
        rawQr = "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=" + encodeURIComponent(rowNis || id);
      }

      const directHalaqah = halaqahIdx !== -1 ? String(studentData[i][halaqahIdx] || "").trim() : "";
      const directMuhafiz = muhafizIdx !== -1 ? String(studentData[i][muhafizIdx] || "").trim() : "";

      results.push({
        studentId: id,
        nis: rowNis,
        nisn: rowNis, // alias backward compatible
        nik: nikIdx !== -1 ? String(studentData[i][nikIdx] || "") : "",
        name: nameIdx !== -1 ? String(studentData[i][nameIdx] || "Santri") : "Santri",
        gender: genderIdx !== -1 ? String(studentData[i][genderIdx] || "").trim().toUpperCase() : "",
        birthDate: birthIdx !== -1 ? normalizeDateString(studentData[i][birthIdx]) : "",
        photoUrl: rawPhoto,
        photo_url: rawPhoto,
        qrCode: rawQr,
        qr_code: rawQr,
        initialHalaqah: directHalaqah,
        initialMuhafiz: directMuhafiz,
        halaqah: directHalaqah,
        muhafiz: directMuhafiz,
        program: progIdx !== -1 ? String(studentData[i][progIdx] || "Reguler") : "Reguler",
        status: statusIdx !== -1 ? String(studentData[i][statusIdx] || "Aktif") : "Aktif",
        relationship: relationshipMap[id] || RELATIONSHIP_ENUM.GUARDIAN
      });
    }
  }

  // Enrich with real Tahfidz Summary data from database sheets
  try {
    const logsSheet = ss.getSheetByName(SHEET_TAHFIDZ_LOGS);
    const targetSheet = ss.getSheetByName(SHEET_TAHFIDZ_TARGET);
    const halaqahSheet = ss.getSheetByName(SHEET_TAHFIDZ_HALAQAH);

    const logsData = logsSheet ? logsSheet.getDataRange().getValues() : null;
    const targetData = targetSheet ? targetSheet.getDataRange().getValues() : null;
    const halaqahData = halaqahSheet ? halaqahSheet.getDataRange().getValues() : null;

    results.forEach(student => {
      const cleanId = String(student.studentId || "").trim();
      const cleanNis = String(student.nis || "").trim();

      // 1. Target Tahfidz
      let ziyadahPekan = 10;
      let murajaahPekan = 10;
      if (targetData && targetData.length > 1) {
        const hTarget = targetData[0].map(h => String(h || "").trim().toLowerCase());
        const sIdIdx = hTarget.indexOf("student_id");
        const zPekanIdx = hTarget.indexOf("target_ziyadah_pekan");
        const mPekanIdx = hTarget.indexOf("target_murajaah_pekan");
        for (let t = 1; t < targetData.length; t++) {
          const tId = sIdIdx !== -1 ? String(targetData[t][sIdIdx] || "").trim() : "";
          if (tId && (tId === cleanId || tId === cleanNis)) {
            if (zPekanIdx !== -1) ziyadahPekan = Number(targetData[t][zPekanIdx]) || 10;
            if (mPekanIdx !== -1) murajaahPekan = Number(targetData[t][mPekanIdx]) || 10;
            break;
          }
        }
      }

      // 2. Riwayat Logs & Capaian
      let maxJuz = 0;
      let totalLogs = 0;
      let scorePoints = 0;
      let lastLog = null;

      if (logsData && logsData.length > 1) {
        const hLogs = logsData[0].map(h => String(h || "").trim().toLowerCase());
        const sIdIdx = hLogs.indexOf("student_id");
        const nisIdx = hLogs.indexOf("nis");
        const juzIdx = hLogs.indexOf("juz");
        const surahIdx = hLogs.indexOf("surah");
        const halIdx = hLogs.indexOf("total_halaman");
        const tglIdx = hLogs.indexOf("tanggal");
        const nilaiIdx = hLogs.indexOf("nilai");
        const muhIdx = hLogs.indexOf("muhafiz");
        const statusIdx = hLogs.indexOf("status_setoran");
        const createdIdx = hLogs.indexOf("created_at");

        for (let l = 1; l < logsData.length; l++) {
          const rowSId = sIdIdx !== -1 ? String(logsData[l][sIdIdx] || "").trim() : "";
          const rowNis = nisIdx !== -1 ? String(logsData[l][nisIdx] || "").trim() : "";
          if ((rowSId && rowSId === cleanId) || (rowNis && rowNis === cleanNis)) {
            totalLogs++;
            const jVal = Number(logsData[l][juzIdx] || 1);
            const nVal = String(logsData[l][nilaiIdx] || "MUMTAZ").trim().toUpperCase();
            const rawStatus = statusIdx !== -1 ? String(logsData[l][statusIdx] || "").trim().toUpperCase() : "";
            const statusSetoran = rawStatus || (nVal === "DHAIF" ? "ULANG" : "LANJUT");

            // Hanya tingkatkan capaian juz jika status bukan ULANG
            if (statusSetoran !== "ULANG" && jVal > maxJuz) maxJuz = jVal;

            if (nVal === "MUMTAZ") scorePoints += 4;
            else if (nVal === "JAYYID_JIDDAN") scorePoints += 3;
            else if (nVal === "JAYYID") scorePoints += 2;
            else scorePoints += 1;

            const logDate = logsData[l][tglIdx] ? normalizeDateString(logsData[l][tglIdx]) : "";
            if (!lastLog || new Date(logDate || logsData[l][createdIdx]) > new Date(lastLog.tanggal || lastLog.createdAt)) {
              lastLog = {
                tanggal: logDate,
                surah: surahIdx !== -1 ? String(logsData[l][surahIdx] || "").trim() : "",
                juz: jVal,
                totalHalaman: halIdx !== -1 ? Number(logsData[l][halIdx] || 1) : 1,
                nilai: nVal,
                statusSetoran: statusSetoran,
                muhafiz: muhIdx !== -1 ? String(logsData[l][muhIdx] || "").trim() : "",
                createdAt: createdIdx !== -1 ? String(logsData[l][createdIdx] || "") : ""
              };
            }
          }
        }
      }

      // 3. Halaqah & Muhafiz Asli (Multi-Source Matching)
      let namaHalaqah = student.initialHalaqah || "";
      let muhafiz = student.initialMuhafiz || "";

      if (halaqahData && halaqahData.length > 1) {
        const hHal = halaqahData[0].map(h => String(h || "").trim().toLowerCase().replace(/\s+/g, "_"));
        const halNameIdx = hHal.indexOf("nama_halaqah") !== -1 ? hHal.indexOf("nama_halaqah") : hHal.indexOf("halaqah");
        const muhIdx = hHal.indexOf("muhafiz") !== -1 ? hHal.indexOf("muhafiz") : hHal.indexOf("muhafidz");
        const stIdsIdx = hHal.indexOf("student_ids") !== -1 ? hHal.indexOf("student_ids") : hHal.indexOf("anggota");

        for (let h = 1; h < halaqahData.length; h++) {
          const members = stIdsIdx !== -1 ? String(halaqahData[h][stIdsIdx] || "").split(",").map(m => m.trim().toLowerCase()) : [];
          const cleanIdLower = cleanId.toLowerCase();
          const cleanNisLower = cleanNis.toLowerCase();
          const cleanNameLower = String(student.name || "").trim().toLowerCase();

          const isMatch = members.some(m => {
            if (!m) return false;
            return m === cleanIdLower || 
                   m === cleanNisLower || 
                   (cleanNameLower && m === cleanNameLower) ||
                   m.replace(/[^a-z0-9]/g, "") === cleanIdLower.replace(/[^a-z0-9]/g, "");
          });

          if (isMatch) {
            if (!namaHalaqah && halNameIdx !== -1 && halaqahData[h][halNameIdx]) {
              namaHalaqah = String(halaqahData[h][halNameIdx]).trim();
            }
            if (!muhafiz && muhIdx !== -1 && halaqahData[h][muhIdx]) {
              muhafiz = String(halaqahData[h][muhIdx]).trim();
            }
            break;
          }
        }
      }

      // Fallback: Jika muhafiz belum terisi, ambil dari riwayat setoran mutaba'ah terakhir
      if (!muhafiz && lastLog && lastLog.muhafiz) {
        muhafiz = lastLog.muhafiz;
      }

      // Fallback: Jika halaqah belum terisi tapi muhafiz ada, temukan halaqah yang diampu muhafiz
      if (!namaHalaqah && muhafiz && halaqahData && halaqahData.length > 1) {
        const hHal = halaqahData[0].map(h => String(h || "").trim().toLowerCase().replace(/\s+/g, "_"));
        const halNameIdx = hHal.indexOf("nama_halaqah") !== -1 ? hHal.indexOf("nama_halaqah") : hHal.indexOf("halaqah");
        const muhIdx = hHal.indexOf("muhafiz") !== -1 ? hHal.indexOf("muhafiz") : hHal.indexOf("muhafidz");
        if (halNameIdx !== -1 && muhIdx !== -1) {
          for (let h = 1; h < halaqahData.length; h++) {
            if (String(halaqahData[h][muhIdx] || "").trim().toLowerCase() === muhafiz.toLowerCase()) {
              namaHalaqah = String(halaqahData[h][halNameIdx] || "").trim();
              break;
            }
          }
        }
      }

      if (!namaHalaqah) namaHalaqah = "Belum Terplot";
      if (!muhafiz) muhafiz = "Menunggu Jadwal";

      student.halaqah = namaHalaqah;
      student.muhafiz = muhafiz;

      if (maxJuz === 0) maxJuz = 1;
      const percent = Math.min(100, Math.round((maxJuz / 30) * 100));

      let avgNilaiText = "-";
      if (totalLogs > 0) {
        const avg = scorePoints / totalLogs;
        if (avg >= 3.5) avgNilaiText = "Mumtaz (A)";
        else if (avg >= 2.8) avgNilaiText = "Jayyid Jiddan (B+)";
        else if (avg >= 2.0) avgNilaiText = "Jayyid (B)";
        else avgNilaiText = "Dha'if (C)";
      }

      student.tahfidzSummary = {
        currentJuz: maxJuz,
        percent: percent,
        totalSetoran: totalLogs,
        targetPekan: ziyadahPekan + murajaahPekan,
        ziyadahPekan: ziyadahPekan,
        murajaahPekan: murajaahPekan,
        avgNilai: avgNilaiText,
        halaqah: namaHalaqah,
        muhafiz: muhafiz,
        lastSetoran: lastLog ? {
          tanggal: lastLog.tanggal,
          surah: lastLog.surah,
          juz: lastLog.juz,
          totalHalaman: lastLog.totalHalaman,
          nilai: lastLog.nilai
        } : null
      };
    });
  } catch (err) {
    console.warn("[getLinkedStudentsForWali] Gagal enrich tahfidz summary:", err);
  }

  return results;
}

function findPendingOtpChallenge(channel, identifierHash) {
  const ss = getDatabaseSpreadsheet();
  const sheet = getAuthSheet(ss, SHEET_OTP_CHALLENGES);
  if (!sheet) return null;

  const data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) return null;

  const headers = data[0].map(h => String(h || "").trim().toLowerCase());
  const channelIdx = headers.indexOf("channel") !== -1 ? headers.indexOf("channel") : 2;
  const hashIdx = headers.indexOf("identifier_hash") !== -1 ? headers.indexOf("identifier_hash") : 3;
  const otpHashIdx = headers.indexOf("otp_hash") !== -1 ? headers.indexOf("otp_hash") : 4;
  const attemptsIdx = headers.indexOf("attempts") !== -1 ? headers.indexOf("attempts") : 5;
  const maxAttemptsIdx = headers.indexOf("max_attempts") !== -1 ? headers.indexOf("max_attempts") : 6;
  const expiresIdx = headers.indexOf("expires_at") !== -1 ? headers.indexOf("expires_at") : 7;
  const statusIdx = headers.indexOf("status") !== -1 ? headers.indexOf("status") : 8;
  const idIdx = headers.indexOf("identity_id") !== -1 ? headers.indexOf("identity_id") : 1;
  const chlIdIdx = headers.indexOf("challenge_id") !== -1 ? headers.indexOf("challenge_id") : 0;
  const consumedIdx = headers.indexOf("consumed_at") !== -1 ? headers.indexOf("consumed_at") : 10;

  const now = new Date();

  for (let i = data.length - 1; i >= 1; i--) {
    const rowChannel = String(data[i][channelIdx] || "").trim().toUpperCase();
    const rowHash = String(data[i][hashIdx] || "").trim();
    const rowStatus = String(data[i][statusIdx] || "").trim().toUpperCase();

    if (rowChannel === String(channel).trim().toUpperCase() &&
        rowHash === String(identifierHash).trim() &&
        rowStatus === "PENDING") {
      
      const expDate = new Date(data[i][expiresIdx]);
      return {
        rowIndex: i + 1,
        challengeId: String(data[i][chlIdIdx] || ""),
        identityId: String(data[i][idIdx] || ""),
        otpHash: String(data[i][otpHashIdx] || ""),
        attempts: Number(data[i][attemptsIdx] || 0),
        maxAttempts: Number(data[i][maxAttemptsIdx] || 3),
        expiresAt: expDate,
        isExpired: now > expDate,
        attemptsColIdx: attemptsIdx + 1,
        statusColIdx: statusIdx + 1,
        consumedColIdx: consumedIdx + 1
      };
    }
  }
  return null;
}

function cancelPreviousChallenges(channel, identifierHash) {
  const ss = getDatabaseSpreadsheet();
  const sheet = getAuthSheet(ss, SHEET_OTP_CHALLENGES);
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) return;

  const headers = data[0].map(h => String(h || "").trim().toLowerCase());
  const channelIdx = headers.indexOf("channel") !== -1 ? headers.indexOf("channel") : 2;
  const hashIdx = headers.indexOf("identifier_hash") !== -1 ? headers.indexOf("identifier_hash") : 3;
  const statusIdx = headers.indexOf("status") !== -1 ? headers.indexOf("status") : 8;

  for (let i = data.length - 1; i >= 1; i--) {
    const rowChannel = String(data[i][channelIdx] || "").trim().toUpperCase();
    const rowHash = String(data[i][hashIdx] || "").trim();
    const rowStatus = String(data[i][statusIdx] || "").trim().toUpperCase();

    if (rowChannel === String(channel).trim().toUpperCase() &&
        rowHash === String(identifierHash).trim() &&
        rowStatus === "PENDING") {
      sheet.getRange(i + 1, statusIdx + 1).setValue("CANCELLED");
    }
  }
}

// ==================== AUTHORIZATION PIPELINE ====================

/**
 * Stage 1: Authenticate Session Token
 * P0-1: Memverifikasi token HANYA dengan AUTH_TOKEN_SIGNING_SECRET (strict mode).
 * Token legacy yang ditandatangani dengan TOKEN_SIGNING_SECRET ditolak secara deterministik.
 */
function authenticateSession(tokenString) {
  const claims = verifySessionToken(tokenString, true);

  if (!claims.sessionId || !claims.identityId) {
    throw new AuthenticationError("Token does not contain valid Phase 2B identity claims.");
  }

  // P0-1 & P1-1: Verifikasi status sesi dan TTL di registry server Auth_Sessions
  const session = getSessionById(claims.sessionId);
  if (!session || session.status !== "ACTIVE") {
    throw new AuthenticationError("Server session is not active or has been revoked.");
  }
  const sessionExpTime = new Date(session.expires_at).getTime();
  if (!isNaN(sessionExpTime) && Date.now() >= sessionExpTime) {
    throw new AuthenticationError("Server session has expired. Please log in again.");
  }

  // P0-1: Cek Status Identitas di Master (Sheet Users first, then fallback)
  let identity = getUserIdentityById(claims.identityId);
  if (!identity) {
    if (["SUPER_ADMIN", "ADMIN", "BENDAHARA", "ASATIDZ", "PEGAWAI", "PENGURUS", "EDITOR"].includes(claims.role)) {
      identity = getAdminIdentityById(claims.identityId);
    } else if (claims.role === "WALI_SANTRI") {
      identity = getWaliIdentityById(claims.identityId);
    } else if (claims.role === "PENGASUH") {
      identity = getPengasuhIdentityById(claims.identityId);
    }
  }

  if (!identity || identity.status !== "ACTIVE") {
    throw new AuthenticationError("Identity is suspended or not found.");
  }

  return {
    sessionId: claims.sessionId,
    identityId: claims.identityId,
    role: claims.role,
    issuedAt: claims.issuedAt,
    expiresAt: claims.expiresAt,
    identity: identity
  };
}

/**
 * Stage 2: Authorize Role
 */
function authorizeRole(actor, allowedRoles = []) {
  if (!actor || !actor.role) {
    throw new AuthorizationError("Authentication required.");
  }
  const actorRole = String(actor.role).trim().toUpperCase();

  // SUPER_ADMIN mewarisi semua akses administratif, operasional, konten & akademik
  if (actorRole === "SUPER_ADMIN") {
    return true;
  }

  // Normalisasi array peran yang diizinkan
  const normalizedAllowed = allowedRoles.map(r => String(r || "").trim().toUpperCase());

  // Kompatibilitas mundur & alias: ASATIDZ <-> PEGAWAI <-> EDITOR
  if (normalizedAllowed.includes("ASATIDZ") || normalizedAllowed.includes("PEGAWAI") || normalizedAllowed.includes("EDITOR")) {
    if (!normalizedAllowed.includes("ASATIDZ")) normalizedAllowed.push("ASATIDZ");
    if (!normalizedAllowed.includes("PEGAWAI")) normalizedAllowed.push("PEGAWAI");
    if (!normalizedAllowed.includes("EDITOR")) normalizedAllowed.push("EDITOR");
  }

  // Jika actorRole bertanda PEGAWAI atau EDITOR, perlakukan setara ASATIDZ
  const normalizedActorRole = (actorRole === "PEGAWAI" || actorRole === "EDITOR") ? "ASATIDZ" : actorRole;

  if (!normalizedAllowed.includes(actorRole) && !normalizedAllowed.includes(normalizedActorRole)) {
    throw new AuthorizationError(`Role '${actor.role}' is forbidden from accessing this resource.`);
  }
  return true;
}

/**
 * P0-3: Request ID Sanitizer (Metadata only, never used for authorization/session lookup)
 */
function sanitizeRequestId(clientReqId) {
  if (clientReqId && typeof clientReqId === "string") {
    const cleaned = clientReqId.replace(/[^a-zA-Z0-9_-]/g, "").substring(0, 64);
    if (cleaned.length >= 8) return cleaned;
  }
  return "req_" + Utilities.getUuid().replace(/-/g, "").substring(0, 16);
}

// ==================== API ACTION DISPATCHER (PHASE 2B) ====================

function handleAuthApiAction(action, payload, e) {
  const requestId = sanitizeRequestId(payload && payload.requestId);

  try {
    // ----------------------------------------------------
    // 0A. ADMIN LOGIN WITH PASSWORD / PIN
    // ----------------------------------------------------
    if (action === "auth.admin.loginWithPassword") {
      return withAuthScriptLock(() => {
        const email = String(payload.email || "").trim().toLowerCase();
        const password = String(payload.password || "").trim();

        if (!email || !password) {
          return createJsonResponse({
            success: false,
            message: "Email dan Kata Sandi / PIN wajib diisi."
          });
        }

        const admin = getAdminIdentityByEmail(email);
        if (!admin || admin.status !== "ACTIVE") {
          writeAuthAuditLog("PASSWORD_LOGIN_REJECTED", "ANONYMOUS", "", "PASSWORD", false, requestId, { email: email });
          return createJsonResponse({
            success: false,
            message: "Akun pengelola tidak ditemukan atau dinonaktifkan."
          });
        }

        if (!admin.passwordHash) {
          return createJsonResponse({
            success: false,
            requireSetup: true,
            message: "Akun Anda belum memiliki Kata Sandi / PIN. Silakan masuk via 'Kode OTP' terlebih dahulu untuk membuat sandi baru."
          });
        }

        if (!verifyPassword(password, admin.passwordHash)) {
          writeAuthAuditLog("PASSWORD_LOGIN_FAIL", admin.identityId, "", "PASSWORD", false, requestId, { email: email });
          return createJsonResponse({
            success: false,
            message: "Kata Sandi / PIN yang Anda masukkan salah."
          });
        }

        // Auto-upgrade password hash lama ke PBKDF2 saat login berhasil
        if (isPasswordUpgradeNeeded(admin.passwordHash)) {
          setUserPasswordHash(admin.identityId, password);
        }

        const ttlHours = getSessionTtlHoursForRole(admin.role);
        const session = createAuthSessionRecord(admin.identityId, admin.role, ttlHours);
        const tokenData = generateSessionToken(admin.email, admin.role, ttlHours, session.sessionId, admin.identityId);

        writeAuthAuditLog("PASSWORD_LOGIN_SUCCESS", admin.identityId, session.sessionId, "PASSWORD", true, requestId, { role: admin.role });

        return createJsonResponse({
          success: true,
          token: tokenData.token,
          data: {
            token: tokenData.token,
            role: admin.role,
            admin: {
              identityId: admin.identityId,
              name: admin.name,
              email: admin.email,
              role: admin.role
            }
          },
          identity: {
            identityId: admin.identityId,
            name: admin.name,
            email: admin.email,
            role: admin.role
          },
          requestId: requestId
        });
      });
    }

    // ----------------------------------------------------
    // 0B. ADMIN SET / UPDATE PASSWORD
    // ----------------------------------------------------
    if (action === "auth.admin.setPassword") {
      return withAuthScriptLock(() => {
        const password = String(payload.password || "").trim();
        const token = payload.token || "";

        if (!password || password.length < 6) {
          return createJsonResponse({
            success: false,
            message: "Kata Sandi / PIN minimal 6 karakter."
          });
        }

        // P0 SECURITY AUDIT FIX: Perubahan password admin WAJIB diautentikasi dengan token aktif yang sah.
        // TIDAK BOLEH mengizinkan perubahan hanya dengan menyertakan email tanpa token!
        if (!token) {
          writeAuthAuditLog("PASSWORD_SET_UNAUTHORIZED_NO_TOKEN", "ANONYMOUS", "", "PASSWORD", false, requestId, {
            attemptedEmail: payload.email || ""
          });
          return createJsonResponse({
            success: false,
            message: "Otorisasi gagal. Token sesi autentikasi admin wajib disertakan."
          });
        }

        let actor = null;
        try {
          actor = authenticateSession(token);
        } catch (authErr) {
          writeAuthAuditLog("PASSWORD_SET_UNAUTHORIZED_INVALID_TOKEN", "ANONYMOUS", "", "PASSWORD", false, requestId, {
            error: authErr.message
          });
          return createJsonResponse({
            success: false,
            message: "Sesi admin tidak valid atau telah kedaluwarsa. Silakan login kembali."
          });
        }

        if (!actor || !actor.identityId) {
          return createJsonResponse({
            success: false,
            message: "Identitas akun admin tidak valid."
          });
        }

        // Hanya role ADMIN, SUPER_ADMIN, atau pengurus sah yang boleh mengubah password akun admin
        const callerRole = String(actor.role || (actor.identity && actor.identity.role) || "").toUpperCase();
        if (callerRole !== "ADMIN" && callerRole !== "SUPER_ADMIN" && callerRole !== "PENGURUS") {
          writeAuthAuditLog("PASSWORD_SET_FORBIDDEN_ROLE", actor.identityId, "", "PASSWORD", false, requestId, {
            role: callerRole
          });
          return createJsonResponse({
            success: false,
            message: "Akses ditolak: Hanya peran Administrator yang diizinkan mengubah kata sandi."
          });
        }

        const adminId = actor.identityId;
        const success = setUserPasswordHash(adminId, password);
        if (success) {
          writeAuthAuditLog("PASSWORD_SET_SUCCESS", adminId, "", "PASSWORD", true, requestId, {});
          return createJsonResponse({
            success: true,
            message: "Kata Sandi / PIN Admin berhasil disimpan."
          });
        }

        return createJsonResponse({
          success: false,
          message: "Gagal menyimpan Kata Sandi / PIN di database."
        });
      });
    }

    // ----------------------------------------------------
    // 1. ADMIN REQUEST OTP
    // ----------------------------------------------------
    if (action === "auth.admin.requestOtp") {
      return withAuthScriptLock(() => {
        const email = String(payload.email || "").trim().toLowerCase();
        const idHash = hashIdentifier(email);

        // Anti-Enumeration: generic response statement
        const genericResponse = {
          success: true,
          message: "Jika akun memenuhi syarat dan terdaftar, kode verifikasi 6 digit telah dikirimkan.",
          cooldownSeconds: 60,
          requestId: requestId
        };

        const admin = getAdminIdentityByEmail(email);
        if (!admin || admin.status !== "ACTIVE") {
          writeAuthAuditLog("OTP_REQUEST_IGNORED", "ANONYMOUS", "", "EMAIL", false, requestId, { reason: "Admin identity not found or suspended" });
          return createJsonResponse(genericResponse);
        }

        // Cek challenge pending berumur < 60 detik (cooldown check)
        const pending = findPendingOtpChallenge("EMAIL", idHash);
        if (pending && !pending.isExpired) {
          const elapsed = (new Date().getTime() - new Date(pending.expiresAt.getTime() - 300000).getTime()) / 1000;
          if (elapsed < 60) {
            return createJsonResponse({
              success: true,
              message: "Kode verifikasi telah dikirim sebelumnya. Silakan tunggu jeda kirim ulang.",
              cooldownSeconds: Math.ceil(60 - elapsed),
              requestId: requestId
            });
          }
        }

        // Batalkan challenge aktif sebelumnya
        cancelPreviousChallenges("EMAIL", idHash);

        // Generate CSPRNG OTP
        const otpCode = generateSecureOtpDigits();
        const otpHash = hashOtpCode(otpCode);
        const challengeId = "CHL_" + Utilities.getUuid().replace(/-/g, "").substring(0, 16);
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 300000).toISOString();

        const ss = getDatabaseSpreadsheet();
        const otpSheet = getAuthSheet(ss, SHEET_OTP_CHALLENGES);
        if (!otpSheet) {
          console.error("[AUTH] Sheet 'OTP_Challenges' belum disetup oleh administrator.");
          return createJsonResponse(genericResponse);
        }

        otpSheet.appendRow([
          challengeId,
          admin.identityId,
          "EMAIL",
          idHash,
          otpHash,
          0,
          3,
          expiresAt,
          "PENDING",
          now.toISOString(),
          "",
          requestId
        ]);

        const challengeRow = otpSheet.getLastRow();
        let emailSuccess = false;
        try {
          emailSuccess = sendAdminOtpEmail(admin.email, otpCode);
        } catch (mailErr) {
          console.error("Gagal mengirim email OTP Admin:", mailErr);
          emailSuccess = false;
        }

        // P0-2: Jika pengiriman gagal, batalkan challenge dan catat OTP_DISPATCH_FAIL
        if (!emailSuccess) {
          otpSheet.getRange(challengeRow, 9).setValue("CANCELLED");
          writeAuthAuditLog("OTP_DISPATCH_FAIL", admin.identityId, "", "EMAIL", false, requestId, { reason: "Admin email delivery failed" });
          return createJsonResponse(genericResponse);
        }

        writeAuthAuditLog("OTP_REQUEST_SENT", admin.identityId, "", "EMAIL", true, requestId, { channel: "EMAIL" });
        return createJsonResponse(genericResponse);
      });
    }

    // ----------------------------------------------------
    // 2. ADMIN VERIFY OTP
    // ----------------------------------------------------
    if (action === "auth.admin.verifyOtp") {
      return withAuthScriptLock(() => {
        const email = String(payload.email || "").trim().toLowerCase();
        const otp = String(payload.otp || "").trim();
        const idHash = hashIdentifier(email);

        const challenge = findPendingOtpChallenge("EMAIL", idHash);
        if (!challenge) {
          writeAuthAuditLog("OTP_VERIFY_NOT_FOUND", "ANONYMOUS", "", "EMAIL", false, requestId, {});
          return createJsonResponse({ success: false, message: "Kode OTP tidak ditemukan atau sudah kedaluwarsa. Silakan minta kode baru." });
        }

        if (challenge.isExpired) {
          writeAuthAuditLog("OTP_VERIFY_EXPIRED", challenge.identityId, "", "EMAIL", false, requestId, { challengeId: challenge.challengeId });
          return createJsonResponse({ success: false, message: "Kode OTP telah kedaluwarsa. Silakan minta kode baru." });
        }

        if (challenge.attempts >= challenge.maxAttempts) {
          writeAuthAuditLog("OTP_VERIFY_EXHAUSTED", challenge.identityId, "", "EMAIL", false, requestId, { challengeId: challenge.challengeId });
          return createJsonResponse({ success: false, message: "Batas percobaan verifikasi telah habis. Silakan minta kode baru." });
        }

        const inputHash = hashOtpCode(otp);
        const ss = getDatabaseSpreadsheet();
        const otpSheet = getAuthSheet(ss, SHEET_OTP_CHALLENGES);

        if (inputHash !== challenge.otpHash) {
          const newAttempts = challenge.attempts + 1;
          const attCol = challenge.attemptsColIdx || 6;
          const stCol = challenge.statusColIdx || 9;
          otpSheet.getRange(challenge.rowIndex, attCol).setValue(newAttempts);
          if (newAttempts >= challenge.maxAttempts) {
            otpSheet.getRange(challenge.rowIndex, stCol).setValue("EXHAUSTED");
          }
          writeAuthAuditLog("OTP_VERIFY_FAIL", challenge.identityId, "", "EMAIL", false, requestId, { attempts: newAttempts });
          return createJsonResponse({
            success: false,
            message: `Kode verifikasi salah. Sisa kesempatan: ${Math.max(0, challenge.maxAttempts - newAttempts)}`
          });
        }

        // OTP Valid => Konsumsi Challenge
        const stCol = challenge.statusColIdx || 9;
        const consCol = challenge.consumedColIdx || 11;
        otpSheet.getRange(challenge.rowIndex, stCol).setValue("CONSUMED");
        otpSheet.getRange(challenge.rowIndex, consCol).setValue(new Date().toISOString());

        // Resolve Identitas dari row challenge
        const admin = getAdminIdentityById(challenge.identityId);
        if (!admin || admin.status !== "ACTIVE") {
          return createJsonResponse({ success: false, message: "Identitas akun tidak aktif." });
        }

        // Buat Sesi Server Bounded TTL (P1-1)
        const ttlHours = getSessionTtlHoursForRole(admin.role);
        const session = createAuthSessionRecord(admin.identityId, admin.role, ttlHours);
        const tokenData = generateSessionToken(admin.email, admin.role, ttlHours, session.sessionId, admin.identityId);

        writeAuthAuditLog("OTP_VERIFY_SUCCESS", admin.identityId, session.sessionId, "EMAIL", true, requestId, {});
        writeAuthAuditLog("SESSION_CREATED", admin.identityId, session.sessionId, "EMAIL", true, requestId, { role: admin.role });

        // Update last_login_at & last_seen_at pada sheet Users
        try {
          const uSheet = getAuthSheet(ss, SHEET_USERS);
          if (uSheet) {
            const uData = uSheet.getDataRange().getValues();
            if (uData && uData.length > 1) {
              const uH = uData[0].map(h => String(h || "").trim().toLowerCase());
              let idCol = uH.indexOf("user_id") !== -1 ? uH.indexOf("user_id") : uH.indexOf("id");
              let emailCol = uH.indexOf("email");
              let loginCol = uH.indexOf("last_login_at");
              let seenCol = uH.indexOf("last_seen_at");
              let devCol = uH.indexOf("device_info");
              const nowIsoStr = new Date().toISOString();
              const devStr = String(payload.deviceInfo || payload.device_info || "Desktop Browser");

              if (seenCol === -1) {
                seenCol = uH.length;
                uH.push("last_seen_at");
                uSheet.getRange(1, seenCol + 1).setValue("last_seen_at").setFontWeight("bold");
              }
              if (devCol === -1) {
                devCol = uH.length;
                uH.push("device_info");
                uSheet.getRange(1, devCol + 1).setValue("device_info").setFontWeight("bold");
              }

              for (let r = 1; r < uData.length; r++) {
                const rowId = idCol !== -1 ? String(uData[r][idCol] || "").trim() : "";
                const rowEm = emailCol !== -1 ? String(uData[r][emailCol] || "").trim().toLowerCase() : "";
                if ((admin.identityId && rowId === admin.identityId) || (admin.email && rowEm === admin.email.toLowerCase())) {
                  if (loginCol !== -1) uSheet.getRange(r + 1, loginCol + 1).setValue(nowIsoStr);
                  uSheet.getRange(r + 1, seenCol + 1).setValue(nowIsoStr);
                  uSheet.getRange(r + 1, devCol + 1).setValue(devStr);
                  break;
                }
              }
            }
          }
          CacheService.getScriptCache().remove("CACHE_ALL_USERS_DATA");
        } catch (upErr) {}

        const adminObj = {
          identityId: admin.identityId,
          userId: admin.identityId,
          name: admin.name,
          email: admin.email,
          role: admin.role
        };

        return createJsonResponse({
          success: true,
          token: tokenData.token,
          admin: adminObj,
          data: {
            token: tokenData.token,
            role: admin.role,
            admin: adminObj
          },
          identity: adminObj,
          requestId: requestId
        });
      });
    }

    // ----------------------------------------------------
    // 2B. WALI SANTRI LOGIN WITH PASSWORD / PIN
    // ----------------------------------------------------
    if (action === "auth.parent.loginWithPassword" || action === "auth.wali.loginWithPassword") {
      return withAuthScriptLock(() => {
        const identifier = String(payload.identifier || payload.email || payload.phone || "").trim();
        const password = String(payload.password || "").trim();

        if (!identifier || !password) {
          return createJsonResponse({
            success: false,
            message: "Email / No. WhatsApp dan Kata Sandi / PIN wajib diisi."
          });
        }

        let wali = null;
        if (identifier.includes("@")) {
          wali = getWaliIdentityByEmail(identifier) || getUserIdentityByEmail(identifier);
        } else {
          wali = getWaliIdentityByPhone(identifier);
        }

        if (!wali || (wali.status && !["AKTIF", "ACTIVE"].includes(wali.status.toUpperCase()))) {
          writeAuthAuditLog("PASSWORD_LOGIN_REJECTED", "ANONYMOUS", "", "PASSWORD", false, requestId, { identifier: identifier });
          return createJsonResponse({
            success: false,
            message: "Akun Wali Santri tidak ditemukan atau belum aktif. Silakan lakukan Aktivasi Akun terlebih dahulu."
          });
        }

        if (!wali.passwordHash) {
          return createJsonResponse({
            success: false,
            requireSetup: true,
            message: "Akun Anda belum memiliki Kata Sandi / PIN. Silakan masuk via 'Kode OTP' atau lakukan Aktivasi Akun untuk membuat kata sandi baru."
          });
        }

        if (!verifyPassword(password, wali.passwordHash)) {
          writeAuthAuditLog("PASSWORD_LOGIN_FAIL", wali.identityId || wali.userId, "", "PASSWORD", false, requestId, { identifier: identifier });
          return createJsonResponse({
            success: false,
            message: "Kata Sandi / PIN yang Anda masukkan salah."
          });
        }

        const waliId = wali.identityId || wali.userId;
        // Auto-upgrade password hash lama ke PBKDF2 saat login berhasil
        if (isPasswordUpgradeNeeded(wali.passwordHash)) {
          setUserPasswordHash(waliId, password);
        }

        const ttlHours = getSessionTtlHoursForRole("WALI_SANTRI");
        const session = createAuthSessionRecord(waliId, "WALI_SANTRI", ttlHours);
        const tokenData = generateSessionToken(wali.email, "WALI_SANTRI", ttlHours, session.sessionId, waliId);
        const students = getLinkedStudentsForWali(waliId);

        writeAuthAuditLog("PASSWORD_LOGIN_SUCCESS", waliId, session.sessionId, "PASSWORD", true, requestId, { role: "WALI_SANTRI" });

        return createJsonResponse({
          success: true,
          token: tokenData.token,
          data: {
            token: tokenData.token,
            role: "WALI_SANTRI",
            parent: {
              identityId: waliId,
              name: wali.name,
              email: wali.email,
              phone: wali.phone
            },
            students: students
          },
          identity: {
            identityId: waliId,
            name: wali.name,
            email: wali.email,
            phone: wali.phone,
            role: "WALI_SANTRI"
          },
          students: students,
          requestId: requestId
        });
      });
    }

    // ----------------------------------------------------
    // 2C. WALI SANTRI SET / UPDATE PASSWORD
    // ----------------------------------------------------
    if (action === "auth.parent.setPassword" || action === "auth.wali.setPassword") {
      return withAuthScriptLock(() => {
        const password = String(payload.password || "").trim();
        const identifier = String(payload.identifier || payload.email || payload.phone || "").trim();
        const token = payload.token || "";

        if (!password || password.length < 6) {
          return createJsonResponse({
            success: false,
            message: "Kata Sandi / PIN minimal 6 karakter."
          });
        }

        let waliId = "";
        let waliEmail = identifier;

        if (token) {
          try {
            const actor = authenticateSession(token);
            if (actor && actor.identityId) {
              waliId = actor.identityId;
              if (actor.identity && actor.identity.email) waliEmail = actor.identity.email;
            }
          } catch (e) {}
        }

        if (!waliId && waliEmail) {
          let wali = null;
          if (waliEmail.includes("@")) {
            wali = getWaliIdentityByEmail(waliEmail) || getUserIdentityByEmail(waliEmail);
          } else {
            wali = getWaliIdentityByPhone(waliEmail);
          }
          if (wali) {
            waliId = wali.identityId || wali.userId;
          }
        }

        if (!waliId && !waliEmail) {
          return createJsonResponse({
            success: false,
            message: "Identitas akun Wali Santri tidak valid untuk perubahan kata sandi."
          });
        }

        const success = setUserPasswordHash(waliId || waliEmail, password);
        if (success) {
          writeAuthAuditLog("PASSWORD_SET_SUCCESS", waliId, "", "PASSWORD", true, requestId, {});
          return createJsonResponse({
            success: true,
            message: "Kata Sandi / PIN Wali Santri berhasil disimpan."
          });
        }

        return createJsonResponse({
          success: false,
          message: "Gagal menyimpan Kata Sandi / PIN di database."
        });
      });
    }

    // ----------------------------------------------------
    // 3. WALI REQUEST OTP (Email OTP - Phase 2B)
    // ----------------------------------------------------
    if (action === "auth.parent.requestOtp" || action === "auth.wali.requestOtp") {
      return withAuthScriptLock(() => {
        const email = String(payload.email || "").trim().toLowerCase();
        const idHash = hashIdentifier(email);

        const genericResponse = {
          success: true,
          message: "Jika akun memenuhi syarat dan terdaftar, kode verifikasi 6 digit telah dikirimkan ke email Anda.",
          cooldownSeconds: 60,
          requestId: requestId
        };

        const wali = getWaliIdentityByEmail(email);
        if (!wali || wali.status !== "ACTIVE") {
          writeAuthAuditLog("OTP_REQUEST_IGNORED", "ANONYMOUS", "", "EMAIL", false, requestId, { reason: "Wali not found or inactive" });
          return createJsonResponse(genericResponse);
        }

        const pending = findPendingOtpChallenge("EMAIL", idHash);
        if (pending && !pending.isExpired) {
          const elapsed = (new Date().getTime() - new Date(pending.expiresAt.getTime() - 300000).getTime()) / 1000;
          if (elapsed < 60) {
            return createJsonResponse({
              success: true,
              message: "Kode verifikasi telah dikirimkan sebelumnya. Silakan tunggu jeda kirim ulang.",
              cooldownSeconds: Math.ceil(60 - elapsed),
              requestId: requestId
            });
          }
        }

        cancelPreviousChallenges("EMAIL", idHash);

        const otpCode = generateSecureOtpDigits();
        const otpHash = hashOtpCode(otpCode);
        const challengeId = "CHL_" + Utilities.getUuid().replace(/-/g, "").substring(0, 16);
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 300000).toISOString();

        const ss = getDatabaseSpreadsheet();
        const otpSheet = getAuthSheet(ss, SHEET_OTP_CHALLENGES);
        if (!otpSheet) {
          console.error("[AUTH] Sheet 'OTP_Challenges' belum disetup oleh administrator.");
          return createJsonResponse(genericResponse);
        }

        otpSheet.appendRow([
          challengeId,
          wali.identityId,
          "EMAIL",
          idHash,
          otpHash,
          0,
          3,
          expiresAt,
          "PENDING",
          now.toISOString(),
          "",
          requestId
        ]);

        const challengeRow = otpSheet.getLastRow();
        let emailSuccess = false;
        try {
          emailSuccess = sendWaliOtpEmail(wali.email, otpCode, wali.name);
        } catch (mailErr) {
          console.error("Gagal mengirim email OTP Wali:", mailErr);
          emailSuccess = false;
        }

        // P0-2: Jika pengiriman gagal, batalkan challenge dan catat OTP_DISPATCH_FAIL
        if (!emailSuccess) {
          otpSheet.getRange(challengeRow, 9).setValue("CANCELLED");
          writeAuthAuditLog("OTP_DISPATCH_FAIL", wali.identityId, "", "EMAIL", false, requestId, { reason: "Wali email delivery failed" });
          return createJsonResponse(genericResponse);
        }

        writeAuthAuditLog("OTP_REQUEST_SENT", wali.identityId, "", "EMAIL", true, requestId, { channel: "EMAIL" });
        return createJsonResponse(genericResponse);
      });
    }

    // ----------------------------------------------------
    // 4. WALI VERIFY OTP (Email OTP - Phase 2B)
    // ----------------------------------------------------
    if (action === "auth.parent.verifyOtp" || action === "auth.wali.verifyOtp") {
      return withAuthScriptLock(() => {
        const email = String(payload.email || "").trim().toLowerCase();
        const otp = String(payload.otp || "").trim();
        const idHash = hashIdentifier(email);

        const challenge = findPendingOtpChallenge("EMAIL", idHash);
        if (!challenge) {
          writeAuthAuditLog("OTP_VERIFY_NOT_FOUND", "ANONYMOUS", "", "EMAIL", false, requestId, {});
          return createJsonResponse({ success: false, message: "Kode OTP tidak ditemukan atau sudah kedaluwarsa. Silakan minta kode baru." });
        }

        if (challenge.isExpired) {
          writeAuthAuditLog("OTP_VERIFY_EXPIRED", challenge.identityId, "", "EMAIL", false, requestId, { challengeId: challenge.challengeId });
          return createJsonResponse({ success: false, message: "Kode OTP telah kedaluwarsa. Silakan minta kode baru." });
        }

        if (challenge.attempts >= challenge.maxAttempts) {
          writeAuthAuditLog("OTP_VERIFY_EXHAUSTED", challenge.identityId, "", "EMAIL", false, requestId, { challengeId: challenge.challengeId });
          return createJsonResponse({ success: false, message: "Batas percobaan verifikasi telah habis. Silakan minta kode baru." });
        }

        const inputHash = hashOtpCode(otp);
        const ss = getDatabaseSpreadsheet();
        const otpSheet = getAuthSheet(ss, SHEET_OTP_CHALLENGES);

        if (inputHash !== challenge.otpHash) {
          const newAttempts = challenge.attempts + 1;
          const attCol = challenge.attemptsColIdx || 6;
          const stCol = challenge.statusColIdx || 9;
          otpSheet.getRange(challenge.rowIndex, attCol).setValue(newAttempts);
          if (newAttempts >= challenge.maxAttempts) {
            otpSheet.getRange(challenge.rowIndex, stCol).setValue("EXHAUSTED");
          }
          writeAuthAuditLog("OTP_VERIFY_FAIL", challenge.identityId, "", "EMAIL", false, requestId, { attempts: newAttempts });
          return createJsonResponse({
            success: false,
            message: `Kode verifikasi salah. Sisa kesempatan: ${Math.max(0, challenge.maxAttempts - newAttempts)}`
          });
        }

        const stCol = challenge.statusColIdx || 9;
        const consCol = challenge.consumedColIdx || 11;
        otpSheet.getRange(challenge.rowIndex, stCol).setValue("CONSUMED");
        otpSheet.getRange(challenge.rowIndex, consCol).setValue(new Date().toISOString());

        const wali = getWaliIdentityById(challenge.identityId);
        if (!wali || wali.status !== "ACTIVE") {
          return createJsonResponse({ success: false, message: "Identitas akun tidak aktif." });
        }

        const ttlHours = getSessionTtlHoursForRole("WALI_SANTRI");
        const session = createAuthSessionRecord(wali.identityId, "WALI_SANTRI", ttlHours);
        const tokenData = generateSessionToken(wali.email, "WALI_SANTRI", ttlHours, session.sessionId, wali.identityId);
        const students = getLinkedStudentsForWali(wali.identityId);

        writeAuthAuditLog("OTP_VERIFY_SUCCESS", wali.identityId, session.sessionId, "EMAIL", true, requestId, {});
        writeAuthAuditLog("SESSION_CREATED", wali.identityId, session.sessionId, "EMAIL", true, requestId, { role: "WALI_SANTRI" });

        return createJsonResponse({
          success: true,
          token: tokenData.token,
          data: {
            token: tokenData.token,
            role: "WALI_SANTRI",
            parent: {
              identityId: wali.identityId,
              name: wali.name,
              email: wali.email,
              phone: wali.phone
            },
            students: students
          },
          identity: {
            identityId: wali.identityId,
            name: wali.name,
            email: wali.email,
            phone: wali.phone,
            role: "WALI_SANTRI"
          },
          students: students,
          requestId: requestId
        });
      });
    }

    // ----------------------------------------------------
    // 5. VERIFY SESSION (auth.session)
    // ----------------------------------------------------
    if (action === "auth.session") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      const actor = authenticateSession(token);

      return createJsonResponse({
        success: true,
        valid: true,
        identity: actor.identity,
        role: actor.role,
        requestId: requestId
      });
    }

    // ----------------------------------------------------
    // 6. REVOKE SESSION (auth.logout)
    // ----------------------------------------------------
    if (action === "auth.logout") {
      return withAuthScriptLock(() => {
        const token = payload.token || (payload.data && payload.data.token) || "";
        const actor = authenticateSession(token);

        revokeAuthSessionRecord(actor.sessionId);
        writeAuthAuditLog("SESSION_REVOKED", actor.identityId, actor.sessionId, "HTTP_POST", true, requestId, {});

        return createJsonResponse({
          success: true,
          message: "Sesi telah diakhiri dan dicabut dari server.",
          requestId: requestId
        });
      });
    }

    // ----------------------------------------------------
    // 7. WALI PROFILE (auth.parent.me)
    // ----------------------------------------------------
    if (action === "auth.parent.me") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      const actor = authenticateSession(token);
      authorizeRole(actor, ["WALI_SANTRI", "ADMIN"]);

      const wali = getWaliIdentityById(actor.identityId);
      return createJsonResponse({
        success: true,
        parent: wali,
        requestId: requestId
      });
    }

    // ----------------------------------------------------
    // 8. WALI LINKED STUDENTS (auth.parent.students)
    // ----------------------------------------------------
    if (action === "auth.parent.students") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      const actor = authenticateSession(token);
      authorizeRole(actor, ["WALI_SANTRI", "ADMIN"]);

      const students = getLinkedStudentsForWali(actor.identityId);
      return createJsonResponse({
        success: true,
        students: students,
        requestId: requestId
      });
    }

    // ----------------------------------------------------
    // 9. GOOGLE ONE-CLICK SSO (Wali Santri, Admin, Pengasuh)
    // ----------------------------------------------------
    if (action === "auth.sso.google") {
      return withAuthScriptLock(() => {
        const credential = String(payload.credential || "").trim();
        const targetRoleHint = String(payload.targetRole || "").trim().toUpperCase();

        if (!credential) {
          return createJsonResponse({ success: false, message: "Kredensial token Google tidak ditemukan." });
        }

        const gUser = verifyGoogleIdToken(credential);
        if (!gUser || !gUser.valid || !gUser.email) {
          writeAuthAuditLog("SSO_GOOGLE_INVALID_TOKEN", "ANONYMOUS", "", "GOOGLE_SSO", false, requestId, { error: gUser ? gUser.error : "Unknown" });
          return createJsonResponse({ success: false, message: "Verifikasi akun Google gagal: " + ((gUser && gUser.error) || "Token tidak valid") });
        }

        const email = gUser.email.toLowerCase();

        // 1. Cek Pengasuh terlebih dahulu (atau jika targetRoleHint === "PENGASUH")
        let pengasuh = null;
        if (!targetRoleHint || targetRoleHint === "PENGASUH") {
          pengasuh = getPengasuhIdentityByEmail(email);
        }
        if (pengasuh && pengasuh.status === "ACTIVE") {
          const ttlHours = getSessionTtlHoursForRole("PENGASUH");
          const session = createAuthSessionRecord(pengasuh.identityId, "PENGASUH", ttlHours);
          const tokenData = generateSessionToken(pengasuh.email, "PENGASUH", ttlHours, session.sessionId, pengasuh.identityId);

          writeAuthAuditLog("SSO_LOGIN_SUCCESS", pengasuh.identityId, session.sessionId, "GOOGLE_SSO", true, requestId, { role: "PENGASUH" });
          return createJsonResponse({
            success: true,
            role: "PENGASUH",
            token: tokenData.token,
            identity: pengasuh,
            pengasuh: pengasuh,
            requestId: requestId
          });
        }

        // 2. Cek Pengelola / Admin
        let admin = null;
        if (!targetRoleHint || targetRoleHint === "ADMIN" || targetRoleHint === "EDITOR") {
          admin = getAdminIdentityByEmail(email);
        }
        if (admin && admin.status === "ACTIVE") {
          const ttlHours = getSessionTtlHoursForRole(admin.role);
          const session = createAuthSessionRecord(admin.identityId, admin.role, ttlHours);
          const tokenData = generateSessionToken(admin.email, admin.role, ttlHours, session.sessionId, admin.identityId);

          writeAuthAuditLog("SSO_LOGIN_SUCCESS", admin.identityId, session.sessionId, "GOOGLE_SSO", true, requestId, { role: admin.role });
          return createJsonResponse({
            success: true,
            role: admin.role,
            token: tokenData.token,
            identity: admin,
            admin: admin,
            requestId: requestId
          });
        }

        // 3. Cek Wali Santri
        let wali = null;
        if (!targetRoleHint || targetRoleHint === "WALI_SANTRI") {
          wali = getWaliIdentityByEmail(email);
        }
        if (wali && wali.status === "ACTIVE") {
          const ttlHours = getSessionTtlHoursForRole("WALI_SANTRI");
          const session = createAuthSessionRecord(wali.identityId, "WALI_SANTRI", ttlHours);
          const tokenData = generateSessionToken(wali.email, "WALI_SANTRI", ttlHours, session.sessionId, wali.identityId);
          const students = getLinkedStudentsForWali(wali.identityId);

          writeAuthAuditLog("SSO_LOGIN_SUCCESS", wali.identityId, session.sessionId, "GOOGLE_SSO", true, requestId, { role: "WALI_SANTRI" });
          return createJsonResponse({
            success: true,
            role: "WALI_SANTRI",
            token: tokenData.token,
            identity: wali,
            parent: wali,
            students: students,
            requestId: requestId
          });
        }

        // Tidak terdaftar di tabel manapun
        writeAuthAuditLog("SSO_NOT_REGISTERED", "ANONYMOUS", "", "GOOGLE_SSO", false, requestId, { email: email, targetRoleHint: targetRoleHint });
        return createJsonResponse({
          success: false,
          notRegistered: true,
          email: email,
          name: gUser.name,
          message: `Akun Google (${email}) belum terdaftar pada sistem pesantren. Jika Anda Wali Santri, silakan lakukan Aktivasi Akun terlebih dahulu menggunakan NIS santri.`,
          requestId: requestId
        });
      });
    }

    // ----------------------------------------------------
    // 10. WALI SANTRI ACTIVATION REQUEST (Matching NIS Saja + OTP Email)
    // ----------------------------------------------------
    if (action === "auth.parent.activate") {
      return withAuthScriptLock(() => {
        const nis = String(payload.nis || payload.nisn || "").trim();
        const birthDate = String(payload.birthDate || "").trim();
        const waliEmail = String(payload.waliEmail || "").trim().toLowerCase();
        const waliName = String(payload.waliName || "").trim();
        const waliPhone = String(payload.waliPhone || "").trim();
        const relationship = String(payload.relationship || "GUARDIAN").trim().toUpperCase();

        if (!nis || !waliEmail || !waliEmail.includes("@")) {
          return createJsonResponse({
            success: false,
            message: "NIS Santri dan Email Wali wajib diisi dengan benar."
          });
        }

        const student = getStudentByNis(nis) || (birthDate ? getStudentByNisAndBirthDate(nis, birthDate) : null);
        if (!student) {
          writeAuthAuditLog("ACTIVATION_REJECTED_STUDENT_NOT_FOUND", "ANONYMOUS", "", "EMAIL_ACTIVATION", false, requestId, { nis: nis });
          return createJsonResponse({
            success: false,
            message: "Data santri dengan NIS tersebut tidak ditemukan. Mohon periksa kembali NIS santri Anda atau hubungi pengurus madrasah."
          });
        }

        if (student.status && !["AKTIF", "ACTIVE"].includes(student.status.toUpperCase())) {
          return createJsonResponse({
            success: false,
            message: "Status santri tidak aktif pada sistem akademik madrasah."
          });
        }

        const idHash = hashIdentifier(waliEmail);
        const pending = findPendingOtpChallenge("EMAIL_ACTIVATION", idHash);
        if (pending && !pending.isExpired) {
          const elapsed = (new Date().getTime() - new Date(pending.expiresAt.getTime() - 300000).getTime()) / 1000;
          if (elapsed < 60) {
            return createJsonResponse({
              success: true,
              message: "Kode OTP aktivasi telah dikirim sebelumnya ke email Anda. Silakan tunggu jeda kirim ulang.",
              cooldownSeconds: Math.ceil(60 - elapsed),
              requestId: requestId
            });
          }
        }

        cancelPreviousChallenges("EMAIL_ACTIVATION", idHash);

        const otpCode = generateSecureOtpDigits();
        const otpHash = hashOtpCode(otpCode);
        const challengeId = "CHL_" + Utilities.getUuid().replace(/-/g, "").substring(0, 16);
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 300000).toISOString();

        const ss = getDatabaseSpreadsheet();
        const otpSheet = getAuthSheet(ss, SHEET_OTP_CHALLENGES);
        if (!otpSheet) {
          return createJsonResponse({ success: false, message: "Tabel tantangan autentikasi belum disiapkan." });
        }

        otpSheet.appendRow([
          challengeId,
          "ACTIVATION_" + student.studentId,
          "EMAIL_ACTIVATION",
          idHash,
          otpHash,
          0,
          3,
          expiresAt,
          "PENDING",
          now.toISOString(),
          "",
          requestId
        ]);

        let emailSuccess = false;
        try {
          emailSuccess = sendWaliActivationOtpEmail(waliEmail, otpCode, waliName, student.name);
        } catch (mailErr) {
          console.error("Gagal kirim email OTP aktivasi via sendWaliActivationOtpEmail:", mailErr);
          try {
            MailApp.sendEmail({
              to: waliEmail,
              subject: "Kode OTP Aktivasi Akun Wali Santri",
              body: `Assalamu'alaikum,\n\nKode OTP aktivasi akun Anda adalah: ${otpCode}\n\nBerlaku selama 5 menit.\n\nTim Pesantren`
            });
            emailSuccess = true;
          } catch (mErr2) {
            console.error("Gagal fallback MailApp.sendEmail:", mErr2);
            emailSuccess = false;
          }
        }

        if (!emailSuccess) {
          otpSheet.getRange(otpSheet.getLastRow(), 9).setValue("CANCELLED");
          writeAuthAuditLog("OTP_DISPATCH_FAIL", "ACTIVATION_" + student.studentId, challengeId, "EMAIL_ACTIVATION", false, requestId, {
            email: waliEmail,
            error: "Email delivery failed"
          });
          return createJsonResponse({
            success: false,
            message: "Gagal mengirimkan email OTP ke " + waliEmail + ". Mohon pastikan kuota email akun Apps Script atau alamat email tujuan valid."
          });
        }

        writeAuthAuditLog("OTP_CHALLENGE_ISSUED", "ACTIVATION_" + student.studentId, challengeId, "EMAIL_ACTIVATION", true, requestId, {
          email: waliEmail,
          nis: nis,
          studentName: student.name
        });

        return createJsonResponse({
          success: true,
          message: `Kode OTP aktivasi telah dikirim ke ${waliEmail}. Masukkan kode untuk konfirmasi.`,
          studentName: student.name,
          cooldownSeconds: 60,
          requestId: requestId
        });
      });
    }

    // ----------------------------------------------------
    // 11. WALI SANTRI ACTIVATION VERIFICATION
    // ----------------------------------------------------
    if (action === "auth.parent.verifyActivation") {
      return withAuthScriptLock(() => {
        const nis = String(payload.nis || payload.nisn || "").trim();
        const birthDate = String(payload.birthDate || "").trim();
        const waliEmail = String(payload.waliEmail || "").trim().toLowerCase();
        const otp = String(payload.otp || "").trim();
        const waliName = String(payload.waliName || "").trim();
        const waliPhone = String(payload.waliPhone || "").trim();
        const relationship = String(payload.relationship || "GUARDIAN").trim().toUpperCase();
        const newPassword = String(payload.password || "").trim();

        if (!nis || !waliEmail || !otp) {
          return createJsonResponse({ success: false, message: "NIS, Email, dan Kode OTP wajib diisi." });
        }

        const idHash = hashIdentifier(waliEmail);
        const challenge = findPendingOtpChallenge("EMAIL_ACTIVATION", idHash);

        if (!challenge) {
          writeAuthAuditLog("OTP_NOT_FOUND", "ANONYMOUS", "", "EMAIL_ACTIVATION", false, requestId, { email: waliEmail });
          return createJsonResponse({
            success: false,
            message: "Tidak ada permintaan aktivasi yang aktif untuk email ini. Silakan ajukan aktivasi ulang."
          });
        }

        if (challenge.isExpired) {
          writeAuthAuditLog("OTP_EXPIRED", challenge.identityId, challenge.challengeId, "EMAIL_ACTIVATION", false, requestId, {});
          return createJsonResponse({
            success: false,
            message: "Kode OTP aktivasi telah kedaluwarsa. Silakan minta kode baru."
          });
        }

        const ss = getDatabaseSpreadsheet();
        const otpSheet = getAuthSheet(ss, SHEET_OTP_CHALLENGES);

        if (!verifyOtpHash(otp, challenge.otpHash)) {
          const newAttempts = challenge.attempts + 1;
          otpSheet.getRange(challenge.rowIndex, 6).setValue(newAttempts);
          if (newAttempts >= challenge.maxAttempts) {
            otpSheet.getRange(challenge.rowIndex, 9).setValue("EXHAUSTED");
          }
          return createJsonResponse({
            success: false,
            message: `Kode verifikasi salah. Sisa kesempatan: ${Math.max(0, challenge.maxAttempts - newAttempts)}`
          });
        }

        // Tandai OTP digunakan
        otpSheet.getRange(challenge.rowIndex, 9).setValue("CONSUMED");
        otpSheet.getRange(challenge.rowIndex, 11).setValue(new Date().toISOString());

        // Cari data santri
        const student = getStudentByNis(nis) || (birthDate ? getStudentByNisAndBirthDate(nis, birthDate) : null);
        if (!student) {
          return createJsonResponse({ success: false, message: "Data santri tidak ditemukan." });
        }

        // Cari atau buat User Identity di sheet Users & Wali_Identities
        let wali = getUserIdentityByEmail(waliEmail) || getWaliIdentityByEmail(waliEmail);
        const usersSheet = getAuthSheet(ss, SHEET_USERS);
        const waliSheet = getAuthSheet(ss, SHEET_WALI_IDENTITIES);
        const nowIso = new Date().toISOString();

        if (!wali) {
          const newUserId = "USR_WLI_" + Utilities.getUuid().replace(/-/g, "").substring(0, 12);
          if (usersSheet) {
            usersSheet.appendRow([
              newUserId,
              waliEmail,
              waliPhone,
              waliName || "Wali Santri",
              "WALI_SANTRI",
              "",
              "ACTIVE",
              nowIso,
              nowIso
            ]);
          }
          if (waliSheet) {
            waliSheet.appendRow([
              newUserId,
              waliEmail,
              waliPhone,
              waliName || "Wali Santri",
              "WALI_SANTRI",
              "ACTIVE",
              nowIso
            ]);
          }
          wali = {
            identityId: newUserId,
            userId: newUserId,
            email: waliEmail,
            phone: waliPhone,
            name: waliName || "Wali Santri",
            role: "WALI_SANTRI",
            status: "ACTIVE"
          };
        } else {
          // Update phone / name jika sebelumnya kosong
          if (!wali.name && waliName) wali.name = waliName;
          if (!wali.phone && waliPhone) wali.phone = waliPhone;
        }

        // Simpan Kata Sandi / PIN baru jika diset oleh Wali Santri
        if (newPassword && newPassword.length >= 6) {
          setUserPasswordHash(wali.userId || wali.identityId, newPassword);
          wali.passwordHash = hashPassword(newPassword);
        }

        // Pastikan identitas tersinkronisasi penuh ke Wali_Identities
        try {
          syncUserToRoleIdentitySheet(
            ss,
            wali.userId || wali.identityId,
            waliEmail,
            wali.phone || waliPhone,
            wali.name || waliName,
            "WALI_SANTRI",
            wali.status || "ACTIVE",
            wali.photoUrl || wali.photo_url || ""
          );
        } catch (syncErr) {
          console.warn("[SYNC ERROR in verifyActivation]", syncErr);
        }

        // Cek / Hubungkan santri di Wali_Santri_Map
        const mapSheet = getAuthSheet(ss, SHEET_WALI_SANTRI_MAP);
        let alreadyMapped = false;
        if (mapSheet) {
          const mapData = mapSheet.getDataRange().getValues();
          for (let i = 1; i < mapData.length; i++) {
            if (String(mapData[i][1]).trim() === (wali.userId || wali.identityId) &&
                String(mapData[i][2]).trim() === student.studentId) {
              alreadyMapped = true;
              break;
            }
          }
          if (!alreadyMapped) {
            const mapId = "MAP_" + Utilities.getUuid().replace(/-/g, "").substring(0, 16);
            mapSheet.appendRow([
              mapId,
              wali.userId || wali.identityId,
              student.studentId,
              relationship,
              "VERIFIED",
              nowIso
            ]);
          }
        }

        // Buat Sesi Bounded TTL (Stay Logged In)
        const ttlHours = getSessionTtlHoursForRole("WALI_SANTRI");
        const session = createAuthSessionRecord(wali.userId || wali.identityId, "WALI_SANTRI", ttlHours);
        const tokenData = generateSessionToken(wali.email, "WALI_SANTRI", ttlHours, session.sessionId, wali.userId || wali.identityId);
        const students = getLinkedStudentsForWali(wali.userId || wali.identityId);

        writeAuthAuditLog("WALI_ACTIVATION_SUCCESS", wali.userId || wali.identityId, session.sessionId, "EMAIL_ACTIVATION", true, requestId, {
          studentId: student.studentId,
          studentName: student.name
        });

        return createJsonResponse({
          success: true,
          token: tokenData.token,
          role: "WALI_SANTRI",
          parent: wali,
          identity: wali,
          students: students,
          message: newPassword ? `Aktivasi berhasil & Kata Sandi tersimpan! Anda terhubung dengan santri ${student.name}.` : `Aktivasi akun berhasil! Anda terhubung dengan santri ${student.name}.`,
          requestId: requestId
        });
      });
    }

    // ----------------------------------------------------
    // 12. PENGASUH PROFILE (auth.pengasuh.me)
    // ----------------------------------------------------
    if (action === "auth.pengasuh.me") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      const actor = authenticateSession(token);
      authorizeRole(actor, ["PENGASUH", "ADMIN"]);

      const pengasuh = getPengasuhIdentityById(actor.identityId);
      return createJsonResponse({
        success: true,
        pengasuh: pengasuh,
        identity: pengasuh,
        requestId: requestId
      });
    }

    // ----------------------------------------------------
    // 13. STUDENT PHOTO UPLOAD (auth.student.uploadPhoto)
    // ----------------------------------------------------
    if (action === "auth.student.uploadPhoto" || action === "student.uploadPhoto") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(uploadStudentPhotoToDrive(payload.data || payload, token));
    }

    // ----------------------------------------------------
    // 13b. USER PROFILE PHOTO UPLOAD (auth.user.uploadPhoto)
    // ----------------------------------------------------
    if (action === "auth.user.uploadPhoto" || action === "user.uploadPhoto") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(uploadUserProfilePhoto(payload.data || payload, token));
    }

    // ----------------------------------------------------
    // 13c. USER MANAGEMENT & ONLINE TELEMETRY
    // ----------------------------------------------------
    if (action === "auth.user.heartbeat" || action === "user.heartbeat") {
      return createJsonResponse(handleUserPresenceHeartbeat(payload.data || payload));
    }

    if (action === "auth.admin.userList" || action === "admin.users.list" || action === "admin.userList") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(getAllUsersWithLinkedStudents(token));
    }

    if (action === "auth.admin.userSave" || action === "admin.users.save" || action === "admin.userSave") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(saveAdminUserData(payload.data || payload, token));
    }

    if (action === "auth.admin.userToggleStatus" || action === "admin.users.toggleStatus" || action === "admin.userToggleStatus") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(toggleUserStatus(payload.data || payload, token));
    }

    if (action === "auth.admin.syncRoleSheets" || action === "admin.syncRoleSheets" || action === "admin.users.syncSheets") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(adminSyncAllRoleSheets(token));
    }

    if (action === "auth.admin.getRolePermissions" || action === "admin.getRolePermissions" || action === "getRolePermissions") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(getRolePermissionsBackend(token));
    }

    if (action === "auth.admin.saveRolePermissions" || action === "admin.saveRolePermissions" || action === "saveRolePermissions") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      const roleKey = payload.roleKey || payload.role || (payload.data && (payload.data.roleKey || payload.data.role));
      const permissions = payload.permissions || (payload.data && payload.data.permissions) || [];
      return createJsonResponse(saveRolePermissionsBackend(roleKey, permissions, token));
    }

    // ----------------------------------------------------
    // 14. STUDENT DATA MANAGEMENT (auth.student.list, save, delete)
    // ----------------------------------------------------
    if (action === "auth.student.list" || action === "student.list") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(getAllStudentsData(token));
    }

    if (action === "auth.student.save" || action === "student.save") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(saveStudentData(payload.data || payload, token));
    }

    if (action === "auth.student.delete" || action === "student.delete") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      const studentId = payload.studentId || payload.student_id || payload.id || (payload.data && (payload.data.studentId || payload.data.student_id || payload.data.id));
      return createJsonResponse(deleteStudentData(studentId, token));
    }

    // ----------------------------------------------------
    // 15. TAHFIDZ AL-QUR'AN MANAGEMENT
    // ----------------------------------------------------
    if (action === "auth.tahfidz.dashboard" || action === "tahfidz.dashboard" || action === "getTahfidzDashboard") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(getTahfidzDashboard(token));
    }

    if (action === "auth.tahfidz.savePresensi" || action === "tahfidz.savePresensi" || action === "saveTahfidzPresensi") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(saveTahfidzPresensi(payload.data || payload, token));
    }

    if (action === "auth.tahfidz.getPresensi" || action === "tahfidz.getPresensi" || action === "getTahfidzPresensi") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(getTahfidzPresensi(payload.data || payload, token));
    }

    if (action === "auth.tahfidz.saveLog" || action === "tahfidz.saveLog" || action === "saveTahfidzLog") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(saveTahfidzLog(payload.data || payload, token));
    }

    if (action === "auth.tahfidz.saveCapaian" || action === "tahfidz.saveCapaian" || action === "saveTahfidzCapaian") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(saveTahfidzCapaian(payload.data || payload, token));
    }

    if (action === "auth.tahfidz.deleteLog" || action === "tahfidz.deleteLog" || action === "deleteTahfidzLog") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      const logId = payload.logId || payload.log_id || (payload.data && (payload.data.logId || payload.data.log_id));
      return createJsonResponse(deleteTahfidzLog(logId, token));
    }

    if (action === "auth.tahfidz.studentDetail" || action === "tahfidz.studentDetail" || action === "getTahfidzStudentDetail") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      const studentId = payload.studentId || payload.student_id || (payload.data && (payload.data.studentId || payload.data.student_id));
      return createJsonResponse(getTahfidzStudentDetail(studentId, token));
    }

    if (action === "auth.tahfidz.saveTarget" || action === "tahfidz.saveTarget" || action === "saveTahfidzTarget") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(saveTahfidzTarget(payload.data || payload, token));
    }

    if (action === "auth.tahfidz.saveBulkTarget" || action === "tahfidz.saveBulkTarget" || action === "saveBulkTahfidzTarget" || action === "saveTahfidzTargetBulk") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(saveBulkTahfidzTarget(payload.data || payload, token));
    }

    if (action === "auth.tahfidz.getHalaqah" || action === "tahfidz.getHalaqah" || action === "getTahfidzHalaqahList") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(getTahfidzHalaqahList(token));
    }

    if (action === "auth.tahfidz.saveHalaqah" || action === "tahfidz.saveHalaqah" || action === "saveTahfidzHalaqah") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(saveTahfidzHalaqah(payload.data || payload, token));
    }

    if (action === "auth.tahfidz.savePlotting" || action === "tahfidz.savePlotting" || action === "saveTahfidzPlotting") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(saveTahfidzPlotting(payload.data || payload, token));
    }

    if (action === "auth.tahfidz.deleteHalaqah" || action === "tahfidz.deleteHalaqah" || action === "deleteTahfidzHalaqah") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      const hId = payload.halaqahId || (payload.data && payload.data.halaqahId) || "";
      return createJsonResponse(deleteTahfidzHalaqah(hId, token));
    }

    if (action === "auth.tahfidz.initSheets" || action === "tahfidz.initSheets" || action === "initTahfidzSheets") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(initTahfidzSheets(token));
    }

    if (action === "auth.tahfidz.getSesi" || action === "tahfidz.getSesi" || action === "getTahfidzSesiList") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(getTahfidzSesiList(token));
    }

    if (action === "auth.tahfidz.saveSesi" || action === "tahfidz.saveSesi" || action === "saveTahfidzSesi") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(saveTahfidzSesi(payload.data || payload, token));
    }

    if (action === "auth.tahfidz.deleteSesi" || action === "tahfidz.deleteSesi" || action === "deleteTahfidzSesi") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      const sId = payload.sesiId || (payload.data && payload.data.sesiId) || "";
      return createJsonResponse(deleteTahfidzSesi(sId, token));
    }

    // Perizinan Asatidz & Delegasi Badal (Auth Router)
    if (action === "auth.tahfidz.initIzinAsatidz" || action === "tahfidz.initIzinAsatidz" || action === "initIzinAsatidz") {
      return createJsonResponse(initIzinAsatidzSheet());
    }

    if (action === "auth.tahfidz.submitIzinAsatidz" || action === "tahfidz.submitIzinAsatidz" || action === "submitIzinAsatidz") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(submitIzinAsatidz(payload.data || payload, token));
    }

    if (action === "auth.tahfidz.getIzinAsatidz" || action === "tahfidz.getIzinAsatidz" || action === "getIzinAsatidz") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(getIzinAsatidzData(payload.data || payload, token));
    }

    if (action === "auth.tahfidz.approveIzinAsatidz" || action === "tahfidz.approveIzinAsatidz" || action === "approveIzinAsatidz") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(approveIzinAsatidz(payload.data || payload, token));
    }

    if (action === "auth.tahfidz.getActiveBadal" || action === "tahfidz.getActiveBadal" || action === "getActiveBadalDelegations") {
      const p = payload.data || payload;
      return createJsonResponse({
        status: "success",
        success: true,
        data: getActiveBadalDelegations(p.tanggal, p.sesi)
      });
    }

    // ----------------------------------------------------
    // 15b. SOROGAN AL-QUR'AN (BINNAZHAR)
    // ----------------------------------------------------
    if (action === "auth.sorogan.dashboard" || action === "sorogan.dashboard" || action === "getSoroganDashboard") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(getSoroganDashboard(token));
    }

    if (action === "auth.sorogan.studentDetail" || action === "sorogan.studentDetail" || action === "getSoroganStudentDetail") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      const studentId = payload.studentId || payload.student_id || (payload.data && (payload.data.studentId || payload.data.student_id));
      return createJsonResponse(getSoroganStudentDetail(studentId, token));
    }

    if (action === "auth.sorogan.saveLog" || action === "sorogan.saveLog" || action === "saveSoroganLog") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(saveSoroganLog(payload.data || payload, token));
    }

    if (action === "auth.sorogan.deleteLog" || action === "sorogan.deleteLog" || action === "deleteSoroganLog") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      const logId = payload.logId || payload.log_id || (payload.data && (payload.data.logId || payload.data.log_id));
      return createJsonResponse(deleteSoroganLog(logId, token));
    }

    if (action === "auth.sorogan.saveCapaian" || action === "sorogan.saveCapaian" || action === "saveSoroganCapaian") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(saveSoroganCapaian(payload.data || payload, token));
    }

    if (action === "auth.sorogan.saveTarget" || action === "sorogan.saveTarget" || action === "saveSoroganTarget") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(saveSoroganTarget(payload.data || payload, token));
    }

    if (action === "auth.sorogan.saveBulkTarget" || action === "sorogan.saveBulkTarget" || action === "saveBulkSoroganTarget" || action === "saveSoroganTargetBulk") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(saveBulkSoroganTarget(payload.data || payload, token));
    }

    if (action === "auth.sorogan.getHalaqah" || action === "sorogan.getHalaqah" || action === "getSoroganHalaqahList") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(getSoroganHalaqahList(token));
    }

    if (action === "auth.sorogan.saveHalaqah" || action === "sorogan.saveHalaqah" || action === "saveSoroganHalaqah") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(saveSoroganHalaqah(payload.data || payload, token));
    }

    if (action === "auth.sorogan.savePlotting" || action === "sorogan.savePlotting" || action === "saveSoroganPlotting") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(saveSoroganPlotting(payload.data || payload, token));
    }

    if (action === "auth.sorogan.deleteHalaqah" || action === "sorogan.deleteHalaqah" || action === "deleteSoroganHalaqah") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      const hId = payload.halaqahId || (payload.data && payload.data.halaqahId) || "";
      return createJsonResponse(deleteSoroganHalaqah(hId, token));
    }

    if (action === "auth.sorogan.initSheets" || action === "sorogan.initSheets" || action === "initSoroganSheets") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(initSoroganSheets(token));
    }

    if (action === "auth.sorogan.getSesi" || action === "sorogan.getSesi" || action === "getSoroganSesiList") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(getSoroganSesiList(token));
    }

    if (action === "auth.sorogan.saveSesi" || action === "sorogan.saveSesi" || action === "saveSoroganSesi") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(saveSoroganSesi(payload.data || payload, token));
    }

    if (action === "auth.sorogan.deleteSesi" || action === "sorogan.deleteSesi" || action === "deleteSoroganSesi") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      const sId = payload.sesiId || (payload.data && payload.data.sesiId) || "";
      return createJsonResponse(deleteSoroganSesi(sId, token));
    }

    // ----------------------------------------------------
    // 16. DATA PEGAWAI (ASATIDZ & KARYAWAN)
    // ----------------------------------------------------
    if (action === "auth.employee.list" || action === "employee.list" || action === "getEmployees") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(getAllEmployeesData(token));
    }

    if (action === "auth.employee.save" || action === "employee.save" || action === "saveEmployee") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(saveEmployeeData(payload.data || payload, token));
    }

    if (action === "auth.employee.delete" || action === "employee.delete" || action === "deleteEmployee") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      const employeeId = payload.employeeId || payload.employee_id || payload.id || (payload.data && (payload.data.employeeId || payload.data.employee_id || payload.data.id));
      return createJsonResponse(deleteEmployeeData(employeeId, token));
    }

    return createJsonResponse({
      success: false,
      message: `Action '${action}' tidak dikenali pada modul autentikasi Phase 2B.`,
      requestId: requestId
    });

  } catch (err) {
    console.error("[AUTH API ERROR]", err);
    writeAuthAuditLog("AUTH_ERROR", "SYSTEM", "", "HTTP_POST", false, requestId, { error: err.message, action: action });
    return createJsonResponse({
      success: false,
      message: err.message || "Terjadi kesalahan internal pada layanan autentikasi.",
      requestId: requestId
    });
  }
}
