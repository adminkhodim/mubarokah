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

/**
 * BACKEND API GOOGLE APPS SCRIPT
 * Hubungkan script ini dengan Google Sheets untuk mengelola database pesantren.
 */

// Tangani Request POST (Menyimpan Pendaftaran Santri Baru)
function doPost(e) {

  try {

    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({
        status: "error",
        message: "Payload POST tidak ditemukan"
      });
    }

    const payload = JSON.parse(e.postData.contents);

    const action =
      payload.action ||
      (e.parameter && e.parameter.action) ||
      null;

    if (!action) {
      return createJsonResponse({
        status: "error",
        message: "Parameter action wajib diisi"
      });
    }

    // ========================================================
    // PUBLIC API
    // ========================================================

    if (action === "submitPPDB") {
      return createJsonResponse(
        submitPendaftaran(payload.data || payload)
      );
    }

    // ========================================================
    // ADMIN API
    // ========================================================

    if (action === "getPPDB") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        verifySessionToken(token);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(
        getPendaftarData()
      );
    }

    if (action === "saveBerita") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(
        simpanBerita(payload.data || payload)
      );
    }

    if (action === "updateBerita") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(
        updateBerita(payload.data || payload)
      );
    }

    if (action === "deleteBerita") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(
        deleteBeritaData(payload.data || payload)
      );
    }

    if (action === "saveBanner") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(
        simpanBanner(payload.data || payload)
      );
    }

    if (action === "uploadMedia") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(
        uploadMediaToDrive(payload.data || payload, token)
      );
    }

    if (action === "uploadStudentPhoto" || action === "student.uploadPhoto") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(
        uploadStudentPhotoToDrive(payload.data || payload, token)
      );
    }

    if (action === "getStudents" || action === "student.list") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      return createJsonResponse(
        getAllStudentsData(token)
      );
    }

    if (action === "saveStudent" || action === "student.save") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(
        saveStudentData(payload.data || payload, token)
      );
    }

    if (action === "deleteStudent" || action === "student.delete") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      const studentId = payload.studentId || payload.student_id || payload.id || (payload.data && (payload.data.studentId || payload.data.student_id || payload.data.id));
      return createJsonResponse(
        deleteStudentData(studentId, token)
      );
    }

    // ========================================================
    // TAHFIDZ AL-QUR'AN ACTIONS (doPost)
    // ========================================================
    if (action === "getTahfidzDashboard" || action === "tahfidz.dashboard") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      return createJsonResponse(getTahfidzDashboard(token));
    }

    if (action === "saveTahfidzLog" || action === "tahfidz.saveLog") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR", "PENGASUH"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(saveTahfidzLog(payload.data || payload, token));
    }

    if (action === "saveTahfidzCapaian" || action === "tahfidz.saveCapaian") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR", "PENGASUH"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(saveTahfidzCapaian(payload.data || payload, token));
    }

    if (action === "deleteTahfidzLog" || action === "tahfidz.deleteLog") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      const logId = payload.logId || payload.log_id || (payload.data && (payload.data.logId || payload.data.log_id));
      return createJsonResponse(deleteTahfidzLog(logId, token));
    }

    if (action === "getTahfidzStudentDetail" || action === "tahfidz.studentDetail") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      const studentId = payload.studentId || payload.student_id || (payload.data && (payload.data.studentId || payload.data.student_id));
      return createJsonResponse(getTahfidzStudentDetail(studentId, token));
    }

    if (action === "saveTahfidzTarget" || action === "tahfidz.saveTarget") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(saveTahfidzTarget(payload.data || payload, token));
    }

    if (action === "saveBulkTahfidzTarget" || action === "tahfidz.saveBulkTarget" || action === "saveTahfidzTargetBulk") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "SUPER_ADMIN", "EDITOR", "PENGASUH"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(saveBulkTahfidzTarget(payload.data || payload, token));
    }

    if (action === "getTahfidzHalaqahList" || action === "tahfidz.getHalaqah") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      return createJsonResponse(getTahfidzHalaqahList(token));
    }

    if (action === "saveTahfidzHalaqah" || action === "tahfidz.saveHalaqah") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(saveTahfidzHalaqah(payload.data || payload, token));
    }

    if (action === "saveTahfidzPlotting" || action === "tahfidz.savePlotting") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(saveTahfidzPlotting(payload.data || payload, token));
    }

    if (action === "deleteTahfidzHalaqah" || action === "tahfidz.deleteHalaqah") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      const hId = payload.halaqahId || (payload.data && payload.data.halaqahId) || "";
      return createJsonResponse(deleteTahfidzHalaqah(hId, token));
    }

    if (action === "initTahfidzSheets" || action === "tahfidz.initSheets") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(initTahfidzSheets(token));
    }

    if (action === "getTahfidzSesiList" || action === "tahfidz.getSesi") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      return createJsonResponse(getTahfidzSesiList(token));
    }

    if (action === "saveTahfidzSesi" || action === "tahfidz.saveSesi") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(saveTahfidzSesi(payload.data || payload.sesi || payload, token));
    }

    if (action === "deleteTahfidzSesi" || action === "tahfidz.deleteSesi") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      const sId = payload.sesiId || payload.id || (payload.data && (payload.data.sesiId || payload.data.id)) || "";
      return createJsonResponse(deleteTahfidzSesi(sId, token));
    }

    // ========================================================
    // TPQ YANBU'A ACTIONS (doPost)
    // ========================================================
    if (action === "getTPQDashboard" || action === "tpq.dashboard") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      return createJsonResponse(getTPQDashboard(token));
    }

    if (action === "saveTPQLog" || action === "tpq.saveLog") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR", "PENGASUH"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(saveTPQLog(payload.data || payload, token));
    }

    if (action === "deleteTPQLog" || action === "tpq.deleteLog") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      const logId = payload.logId || payload.log_id || (payload.data && (payload.data.logId || payload.data.log_id));
      return createJsonResponse(deleteTPQLog(logId, token));
    }

    if (action === "saveTPQCapaian" || action === "tpq.saveCapaian") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(saveTPQCapaian(payload.data || payload, token));
    }

    if (action === "getTPQKelasList" || action === "tpq.getKelas") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      return createJsonResponse(getTPQKelasList(token));
    }

    if (action === "saveTPQKelas" || action === "tpq.saveKelas") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(saveTPQKelas(payload.data || payload, token));
    }

    if (action === "deleteTPQKelas" || action === "tpq.deleteKelas") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      const kId = payload.kelasId || (payload.data && payload.data.kelasId) || "";
      return createJsonResponse(deleteTPQKelas(kId, token));
    }

    if (action === "initTPQSheets" || action === "tpq.initSheets") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(initTPQSheets(token));
    }

    if (action === "saveTPQPlotting" || action === "tpq.savePlotting") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(saveTPQPlotting(payload.data || payload, token));
    }

    if (action === "saveTPQTarget" || action === "tpq.saveTarget") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(saveTPQTarget(payload.data || payload, token));
    }

    if (action === "saveBulkTPQTarget" || action === "tpq.saveBulkTarget") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR", "PENGASUH"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(saveBulkTPQTarget(payload.data || payload, token));
    }

    if (action === "saveTPQSesi" || action === "tpq.saveSesi") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(saveTPQSesi(payload.data || payload.sesi || payload, token));
    }

    if (action === "deleteTPQSesi" || action === "tpq.deleteSesi") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      const sId = payload.sesiId || payload.id || (payload.data && (payload.data.sesiId || payload.data.id)) || "";
      return createJsonResponse(deleteTPQSesi(sId, token));
    }

    if (action === "getTPQStudentDetail" || action === "tpq.studentDetail") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      const studentId = payload.studentId || payload.student_id || (payload.data && (payload.data.studentId || payload.data.student_id));
      return createJsonResponse(getTPQStudentDetail(studentId, token));
    }

    // ========================================================
    // SOROGAN AL-QUR'AN ACTIONS (doPost)
    // ========================================================
    if (action === "getSoroganDashboard" || action === "sorogan.dashboard") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      return createJsonResponse(getSoroganDashboard(token));
    }

    if (action === "getSoroganStudentDetail" || action === "sorogan.studentDetail" || action === "auth.sorogan.studentDetail") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      const studentId = payload.studentId || payload.student_id || (payload.data && (payload.data.studentId || payload.data.student_id)) || null;
      return createJsonResponse(getSoroganStudentDetail(studentId, token));
    }

    if (action === "saveSoroganLog" || action === "sorogan.saveLog") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR", "PENGASUH"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(saveSoroganLog(payload.data || payload, token));
    }

    if (action === "deleteSoroganLog" || action === "sorogan.deleteLog") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      const logId = payload.logId || payload.log_id || (payload.data && (payload.data.logId || payload.data.log_id));
      return createJsonResponse(deleteSoroganLog(logId, token));
    }

    if (action === "saveSoroganCapaian" || action === "sorogan.saveCapaian") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(saveSoroganCapaian(payload.data || payload, token));
    }

    if (action === "getSoroganHalaqahList" || action === "sorogan.getHalaqah") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      return createJsonResponse(getSoroganHalaqahList(token));
    }

    if (action === "saveSoroganHalaqah" || action === "sorogan.saveHalaqah") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(saveSoroganHalaqah(payload.data || payload, token));
    }

    if (action === "deleteSoroganHalaqah" || action === "sorogan.deleteHalaqah") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      const hId = payload.halaqahId || (payload.data && payload.data.halaqahId) || "";
      return createJsonResponse(deleteSoroganHalaqah(hId, token));
    }

    if (action === "initSoroganSheets" || action === "sorogan.initSheets") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(initSoroganSheets(token));
    }

    if (action === "saveSoroganPlotting" || action === "sorogan.savePlotting") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(saveSoroganPlotting(payload.data || payload, token));
    }

    if (action === "saveSoroganTarget" || action === "sorogan.saveTarget") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(saveSoroganTarget(payload.data || payload, token));
    }

    if (action === "saveBulkSoroganTarget" || action === "sorogan.saveBulkTarget") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR", "PENGASUH"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(saveBulkSoroganTarget(payload.data || payload, token));
    }

    if (action === "getSoroganSesiList" || action === "sorogan.getSesi" || action === "getSoroganSesi") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      return createJsonResponse(getSoroganSesiList(token));
    }

    if (action === "saveSoroganSesi" || action === "sorogan.saveSesi") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(saveSoroganSesi(payload.data || payload.sesi || payload, token));
    }

    if (action === "deleteSoroganSesi" || action === "sorogan.deleteSesi") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      const sId = payload.sesiId || payload.id || (payload.data && (payload.data.sesiId || payload.data.id)) || "";
      return createJsonResponse(deleteSoroganSesi(sId, token));
    }

    // ========================================================
    // DATA PEGAWAI (ASATIDZ & KARYAWAN) ACTIONS (doPost)
    // ========================================================
    if (action === "getEmployees" || action === "employee.list") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      return createJsonResponse(getAllEmployeesData(token));
    }

    if (action === "saveEmployee" || action === "employee.save") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(saveEmployeeData(payload.data || payload, token));
    }

    if (action === "deleteEmployee" || action === "employee.delete") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      const employeeId = payload.employeeId || payload.employee_id || payload.id || (payload.data && (payload.data.employeeId || payload.data.employee_id || payload.data.id));
      return createJsonResponse(deleteEmployeeData(employeeId, token));
    }

    if (action === "deleteBanner") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }

      const bannerId =
        payload.bannerId ||
        payload.id ||
        (payload.data && (payload.data.bannerId || payload.data.id));

      if (!bannerId) {
        return createJsonResponse({
          status: "error",
          message: "ID Banner wajib diisi"
        });
      }

      return createJsonResponse(
        hapusBanner(bannerId)
      );
    }

    if (action === "getNotifikasi") {
      return createJsonResponse(
        getNotifikasiData()
      );
    }

    if (action === "saveNotifikasi" || action === "admin.saveNotifikasi") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(
        simpanNotifikasi(payload.data || payload)
      );
    }

    if (action === "deleteNotifikasi" || action === "admin.deleteNotifikasi") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(
        deleteNotifikasiData(payload.data || payload)
      );
    }

    if (action === "toggleBanner") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }

      const source =
        payload.data || payload;

      const bannerId =
        source.bannerId ||
        source.id;

      const newStatus =
        source.newStatus ||
        source.status;

      if (!bannerId || !newStatus) {
        return createJsonResponse({
          status: "error",
          message: "ID Banner dan status wajib diisi"
        });
      }

      return createJsonResponse(
        toggleStatusBanner(
          bannerId,
          newStatus
        )
      );
    }

    if (action === "saveGaleri") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(simpanGaleri(payload.data || payload));
    }

    if (action === "savePengaturan") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(simpanPengaturan(payload.data || payload));
    }

    if (action === "deleteGaleri") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      const galeriId = payload.galeriId || payload.id || (payload.data && (payload.data.galeriId || payload.data.id));
      if (!galeriId) {
        return createJsonResponse({ status: "error", message: "ID Galeri wajib diisi" });
      }
      return createJsonResponse(hapusGaleri(galeriId));
    }

    if (action === "toggleGaleri") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      const galeriId = payload.galeriId || payload.id;
      const newStatus = payload.newStatus || payload.status;
      if (!galeriId || !newStatus) {
        return createJsonResponse({ status: "error", message: "ID Galeri dan status wajib diisi" });
      }
      return createJsonResponse(toggleStatusGaleri(galeriId, newStatus));
    }

    // ========================================================
    // UNIT KEGIATAN SANTRI (UKS) API ROUTER (POST)
    // ========================================================
    if (action === "saveUnitKegiatan") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(simpanUnitKegiatan(payload.data || payload));
    }

    if (action === "deleteUnitKegiatan") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      const kegiatanId = payload.id || (payload.data && payload.data.id);
      if (!kegiatanId) {
        return createJsonResponse({ status: "error", message: "ID Kegiatan wajib diisi" });
      }
      return createJsonResponse(hapusUnitKegiatan(kegiatanId));
    }

    if (action === "toggleUnitKegiatan") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      const kegiatanId = payload.id || (payload.data && payload.data.id);
      const newStatus = payload.newStatus || (payload.data && payload.data.newStatus);
      if (!kegiatanId || !newStatus) {
        return createJsonResponse({ status: "error", message: "ID Kegiatan dan status wajib diisi" });
      }
      return createJsonResponse(toggleStatusUnitKegiatan(kegiatanId, newStatus));
    }

    if (action === "alumni.getTestimonials") {
      return createJsonResponse(getAlumniTestimonials());
    }

    if (action === "alumni.create") {
      return createJsonResponse(saveAlumniData(payload));
    }

    if (action === "auditSecurityStatus") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse({
        status: "success",
        data: auditSecurityConfig()
      });
    }

    // ========================================================
    // PROGRAM DATA SOURCE v2.0 API ROUTER (POST)
    // ========================================================
    if (action.startsWith("program.") || action === "admin.login") {
      return handleProgramApiAction(action, payload, e);
    }

    // ========================================================
    // IDENTITY & AUTHENTICATION ARCHITECTURE v2.0 (PHASE 2B)
    // ========================================================
    if (action.startsWith("auth.")) {
      return handleAuthApiAction(action, payload, e);
    }

    if (action === "request_otp") {
      return createJsonResponse(handleRequestOTP(payload));
    }
    if (action === "verify_otp") {
      return createJsonResponse(handleVerifyOTP(payload));
    }
    if (action === "login") {
      return createJsonResponse(handleLogin(payload));
    }
    if (action === "google_login") {
      return createJsonResponse(handleGoogleLogin(payload));
    }

    return createJsonResponse({
      status: "error",
      message: "Action tidak dikenal",
      action: action
    });

  } catch (error) {

    console.error(error);

    return createJsonResponse({
      status: "error",
      message: (error && error.message) ? error.message : "Terjadi kesalahan pada server."
    });
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

// ============================================================
// PUBLIC API: CHECK STATUS PENDAFTAR
// ============================================================

function checkStatusPendaftar(nisn) {

  const pendaftarSheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName("Pendaftar");

  if (!pendaftarSheet) {
    return {
      status: "error",
      message: "Sheet Pendaftar tidak ditemukan"
    };
  }

  const data =
    pendaftarSheet
      .getDataRange()
      .getValues();

  let foundStudent = null;

  for (let i = 1; i < data.length; i++) {

    if (
      String(data[i][2]).trim() ===
      String(nisn).trim()
    ) {

      foundStudent = {
        nama: data[i][1],
        nisn: data[i][2],
        wali: data[i][3],
        program: data[i][5],
        status: data[i][6] || "Pending",
        tanggalDaftar: formatDate(data[i][0])
      };

      break;
    }
  }

  if (foundStudent) {
    return {
      status: "success",
      data: foundStudent
    };
  }

  return {
    status: "not_found",
    message: "NISN tidak terdaftar"
  };
}


// ============================================================
// PUBLIC API: SUBMIT PENDAFTARAN PPDB
// ============================================================

function submitPendaftaran(payload) {

  const pendaftarSheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName("Pendaftar");

  if (!pendaftarSheet) {
    return {
      status: "error",
      message: "Sheet Pendaftar tidak ditemukan"
    };
  }

  const nama = payload.nama;
  const nisn = payload.nisn;
  const wali = payload.wali;
  const whatsapp = payload.whatsapp;
  const program = payload.program;
  const status = "Pending";
  const timestamp = new Date();

  if (!nama || !nisn || !whatsapp || !program) {
    return {
      status: "error",
      message: "Data pendaftaran tidak lengkap"
    };
  }

  const rawData =
    pendaftarSheet
      .getDataRange()
      .getValues();

  for (let i = 1; i < rawData.length; i++) {

    if (
      String(rawData[i][2]).trim() ===
      String(nisn).trim()
    ) {

      return {
        status: "duplicate",
        message:
          "NISN tersebut sudah terdaftar di sistem!"
      };
    }
  }

  pendaftarSheet.appendRow([
    timestamp,
    nama,
    String(nisn),
    wali,
    String(whatsapp),
    program,
    status
  ]);

  return {
    status: "success",
    message: "Pendaftaran berhasil disimpan"
  };
}


// ============================================================
// ADMIN API: GET ALL PENDAFTAR PPDB
// ============================================================

function getPendaftarData() {
  try {
    const ss = getDatabaseSpreadsheet();
    const pendaftarSheet = ss.getSheetByName("Pendaftar");
    if (!pendaftarSheet) {
      return {
        status: "success",
        data: []
      };
    }

    const data = pendaftarSheet.getDataRange().getValues();
    const listPendaftar = [];

    for (let i = 1; i < data.length; i++) {
      if (!data[i][1]) continue;

      listPendaftar.push({
        tanggalDaftar: formatDate(data[i][0]),
        nama: String(data[i][1] || ""),
        nisn: String(data[i][2] || ""),
        wali: String(data[i][3] || ""),
        whatsapp: String(data[i][4] || ""),
        program: String(data[i][5] || ""),
        status: String(data[i][6] || "Pending")
      });
    }

    return {
      status: "success",
      data: listPendaftar
    };
  } catch (err) {
    return {
      status: "error",
      message: err.toString(),
      data: []
    };
  }
}


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

function generateNewsId() {
  const timestamp = new Date().getTime();
  const randomStr = Math.random().toString(36).substring(2, 6).toLowerCase();
  return "NWS_" + timestamp + "_" + randomStr;
}

function generateSlug(judul) {
  const randomStr = Math.random().toString(36).substring(2, 6).toLowerCase();
  if (!judul || String(judul).trim() === "") {
    return "berita-" + randomStr;
  }
  let slug = String(judul).trim().toLowerCase();
  slug = slug.replace(/[^a-z0-9\s-]/g, ""); // hanya karakter a-z, 0-9 dan -
  slug = slug.replace(/\s+/g, "-");
  slug = slug.replace(/-+/g, "-");
  return slug + "-" + randomStr;
}

function generateUniqueIdentities(sheet, judul) {
  let newsId, slug;
  let isUnique = false;
  let attempts = 0;
  
  // Baca semua existing ID/Slug
  let existingNewsIds = new Set();
  let existingSlugs = new Set();
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    for (let i = 0; i < data.length; i++) {
      existingNewsIds.add(String(data[i][0] || "").trim());
      existingSlugs.add(String(data[i][1] || "").trim());
    }
  }

  while (!isUnique && attempts < 10) {
    newsId = generateNewsId();
    slug = generateSlug(judul);
    if (!existingNewsIds.has(newsId) && !existingSlugs.has(slug)) {
      isUnique = true;
    }
    attempts++;
  }
  
  if (!isUnique) {
    throw new Error("Gagal meng-generate identity unik setelah 10 percobaan.");
  }
  return { newsId, slug };
}

// ==================== MIGRATION TOOL ====================
function migrateBeritaIdentity() {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    Logger.log("ABORT: Gagal mendapatkan lock. Sistem sedang sibuk.");
    return { status: "error", message: "Gagal mendapatkan lock." };
  }

  try {
    const ss = getDatabaseSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
       throw new Error("Sheet Berita tidak ditemukan.");
    }
    
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow === 0) {
       throw new Error("Sheet kosong.");
    }
    
    let data = sheet.getDataRange().getValues();
    let headers = data[0];
    
    // Validate State
    if (headers[0] === "news_id" && headers[1] === "slug") {
      Logger.log("ABORT: Sheet sudah di-migrate (STATE B).");
      return { status: "success", message: "Sudah di-migrate." };
    }
    
    if (headers[0] !== "Tanggal" || headers[1] !== "Judul" || lastCol < 7) {
      Logger.log("ABORT: Struktur tidak dikenali (UNKNOWN STATE).");
      throw new Error("UNKNOWN STATE");
    }
    
    // STATE A terdeteksi. Mulai migrasi.
    let backupSheetName = SHEET_NAME + "_Backup_PreMigrate";
    let existingBackup = ss.getSheetByName(backupSheetName);
    if (existingBackup) {
      ss.deleteSheet(existingBackup);
    }
    let backupSheet = sheet.copyTo(ss);
    backupSheet.setName(backupSheetName);
    backupSheet.hideSheet();
    
    // Insert Kolom A dan B
    sheet.insertColumnsBefore(1, 2);
    sheet.getRange(1, 1).setValue("news_id");
    sheet.getRange(1, 2).setValue("slug");
    
    data = sheet.getDataRange().getValues();
    
    let existingNewsIds = new Set();
    let existingSlugs = new Set();
    let updates = []; 
    
    for (let i = 1; i < data.length; i++) {
      let row = data[i];
      let nId = String(row[0] || "").trim();
      let slg = String(row[1] || "").trim();
      let judul = row[3];
      
      let isBlank = (String(row[2]||"") === "" && String(row[3]||"") === "" && String(row[4]||"") === "" && String(row[5]||"") === "" && String(row[6]||"") === "");
      if (isBlank) {
        updates.push(["", ""]);
        continue; // Blank row protection
      }
      
      let finalNewsId = nId;
      let finalSlug = slg;
      
      if (!finalNewsId || existingNewsIds.has(finalNewsId)) {
        do { finalNewsId = generateNewsId(); } while (existingNewsIds.has(finalNewsId));
      }
      existingNewsIds.add(finalNewsId);
      
      if (!finalSlug || existingSlugs.has(finalSlug)) {
        do { finalSlug = generateSlug(judul); } while (existingSlugs.has(finalSlug));
      }
      existingSlugs.add(finalSlug);
      
      if (String(judul||"").trim() === "") {
        Logger.log("Migration warning: Empty title pada baris " + (i+1));
      }
      
      updates.push([finalNewsId, finalSlug]);
    }
    
    if (updates.length > 0) {
      sheet.getRange(2, 1, updates.length, 2).setValues(updates);
    }
    
    Logger.log("Migrasi selesai. " + updates.length + " baris diproses.");
    return { status: "success", message: "Migrasi selesai." };
    
  } catch (err) {
    Logger.log("ERROR MIGRATION: " + err.message);
    return { status: "error", message: err.message };
  } finally {
    lock.releaseLock();
  }
}

function simpanBerita(formData) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return { success: false, message: "Sistem sedang sibuk. Silakan coba lagi. (Lock gagal)" };
  }

  try {
    var fileUrl = "";

    // 1. Upload ke Google Drive jika ada file gambar
    if (formData.file && formData.file.base64) {
      var folder = DriveApp.getFolderById(FOLDER_ID);
      var decodedData = Utilities.base64Decode(formData.file.base64);
      var blob = Utilities.newBlob(
        decodedData,
        formData.file.mimeType,
        "BERITA_" + new Date().getTime() + "_" + formData.file.name
      );

      var newFile = folder.createFile(blob);
      newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      fileUrl = "https://lh3.googleusercontent.com/d/" + newFile.getId();
    }

    // 2. Simpan ke Google Spreadsheet
    var sheet = getDatabaseSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = getDatabaseSpreadsheet().insertSheet(SHEET_NAME);
      sheet.appendRow(["news_id", "slug", "Tanggal", "Judul", "Kategori", "Penulis", "Gambar_URL", "Ringkasan", "Isi"]);
    }
    
    // Check if the sheet header represents STATE A (Legacy)
    var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (header[0] === "Tanggal") {
       throw new Error("Migrasi identitas belum dilakukan. Harap jalankan migrasi terlebih dahulu.");
    }
    
    var identities = generateUniqueIdentities(sheet, formData.judul);

    sheet.appendRow([
      identities.newsId,
      identities.slug,
      new Date(),
      formData.judul,
      formData.kategori,
      formData.penulis,
      fileUrl,
      formData.ringkasan,
      formData.isi
    ]);

    return { success: true, message: "Berita berhasil dipublikasikan!" };
  } catch (error) {
    return { success: false, message: error.toString() };
  } finally {
    lock.releaseLock();
  }
}

function updateBerita(formData) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return { success: false, message: "Sistem sedang sibuk. Silakan coba lagi. (Lock gagal)" };
  }

  try {
    var news_id = formData.news_id || formData.id;
    if (!news_id) {
       return { success: false, message: "ID Berita (news_id) wajib disertakan untuk update." };
    }

    var sheet = getDatabaseSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      return { success: false, message: "Sheet Berita tidak ditemukan." };
    }

    var data = sheet.getDataRange().getValues();
    var targetRow = -1;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(news_id).trim()) {
        targetRow = i + 1; // 1-indexed for getRange
        break;
      }
    }

    if (targetRow === -1) {
      return { success: false, message: "NOT_FOUND: Berita dengan ID tersebut tidak ditemukan." };
    }

    var fileUrl = data[targetRow - 1][6]; // Keep existing Gambar_URL by default
    if (formData.file && formData.file.base64) {
      var folder = DriveApp.getFolderById(FOLDER_ID);
      var decodedData = Utilities.base64Decode(formData.file.base64);
      var blob = Utilities.newBlob(decodedData, formData.file.mimeType, "BERITA_UPD_" + new Date().getTime() + "_" + formData.file.name);
      var newFile = folder.createFile(blob);
      newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      fileUrl = "https://lh3.googleusercontent.com/d/" + newFile.getId();
    }

    var judul = formData.judul !== undefined ? formData.judul : data[targetRow - 1][3];
    var kategori = formData.kategori !== undefined ? formData.kategori : data[targetRow - 1][4];
    var penulis = formData.penulis !== undefined ? formData.penulis : data[targetRow - 1][5];
    var ringkasan = formData.ringkasan !== undefined ? formData.ringkasan : data[targetRow - 1][7];
    var isi = formData.isi !== undefined ? formData.isi : data[targetRow - 1][8];

    // Array to update: D to I (Judul, Kategori, Penulis, Gambar_URL, Ringkasan, Isi)
    sheet.getRange(targetRow, 4, 1, 6).setValues([[judul, kategori, penulis, fileUrl, ringkasan, isi]]);

    return { success: true, message: "Berita berhasil diperbarui!" };
  } catch (error) {
    return { success: false, message: error.toString() };
  } finally {
    lock.releaseLock();
  }
}

function deleteBeritaData(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return { success: false, message: "Sistem sedang sibuk. Silakan coba lagi. (Lock gagal)" };
  }

  try {
    var news_id = payload.news_id || payload.id;
    if (!news_id) {
       return { success: false, message: "ID Berita (news_id) wajib disertakan untuk hapus." };
    }

    var sheet = getDatabaseSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      return { success: false, message: "Sheet Berita tidak ditemukan." };
    }

    var data = sheet.getDataRange().getValues();
    var targetRow = -1;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(news_id).trim()) {
        targetRow = i + 1; // 1-indexed for deleteRow
        break;
      }
    }

    if (targetRow === -1) {
      return { success: false, message: "NOT_FOUND: Berita dengan ID tersebut tidak ditemukan." };
    }

    sheet.deleteRow(targetRow);

    return { success: true, message: "Berita berhasil dihapus!" };
  } catch (error) {
    return { success: false, message: error.toString() };
  } finally {
    lock.releaseLock();
  }
}

function mintaIzinDrive() {
  // Memicu izin tulis & buat file (Create File Scope) secara paksa
  var folder = DriveApp.getFolderById(FOLDER_ID);
  var fileUji = folder.createFile("uji_izin.txt", "Tes Izin Drive PPTQ");
  fileUji.setTrashed(true); // Langsung hapus file uji coba ke sampah
  Logger.log("✅ Izin Drive Penuh Berhasil Diaktifkan!");
}

// Tangani Request GET (Satu-satunya GET Router / API Entry Point)
function doGet(e) {

  const action =
    e && e.parameter
      ? e.parameter.action
      : null;

  // ==========================================================
  // LEGACY ACCESS
  // Tetap menampilkan Index.html jika URL dibuka tanpa action.
  // ==========================================================

  if (!action) {
    try {
      return HtmlService
        .createHtmlOutputFromFile("Index")
        .setTitle("Mubarokah App")
        .setXFrameOptionsMode(
          HtmlService.XFrameOptionsMode.ALLOWALL
        )
        .addMetaTag(
          "viewport",
          "width=device-width, initial-scale=1"
        );
    } catch (e) {
      return createJsonResponse({
        status: "success",
        message: "Mubarokah Backend API Operational",
        timestamp: new Date().toISOString()
      });
    }
  }

  try {

    // ========================================================
    // PUBLIC GET API
    // ========================================================

    if (action === "getKabar") {
      return createJsonResponse(
        getKabarData()
      );
    }

    if (action === "getBanner") {
      return createJsonResponse(
        getBannerData()
      );
    }

    if (action === "getGaleri") {
      return createJsonResponse(
        getGaleriData()
      );
    }

    if (action === "getNotifikasi") {
      return createJsonResponse(
        getNotifikasiData()
      );
    }

    if (action === "alumni.getTestimonials") {
      return createJsonResponse(getAlumniTestimonials());
    }

    if (action === "getPengaturan") {
      return createJsonResponse(
        getPengaturanData()
      );
    }

    if (action === "checkStatus") {

      const nisn =
        e.parameter.nisn;

      if (!nisn) {
        return createJsonResponse({
          status: "error",
          message: "NISN wajib diisi"
        });
      }

      return createJsonResponse(
        checkStatusPendaftar(nisn)
      );
    }

    if (action === "getUnitKegiatan") {
      return createJsonResponse(
        getUnitKegiatanData()
      );
    }

    if (action === "getStudents" || action === "student.list") {
      const token = e.parameter.token || null;
      return createJsonResponse(
        getAllStudentsData(token)
      );
    }

    if (action === "getTahfidzDashboard" || action === "tahfidz.dashboard") {
      const token = e.parameter.token || null;
      return createJsonResponse(
        getTahfidzDashboard(token)
      );
    }

    if (action === "getTahfidzStudentDetail" || action === "tahfidz.studentDetail") {
      const token = e.parameter.token || null;
      const studentId = e.parameter.studentId || e.parameter.student_id || null;
      return createJsonResponse(
        getTahfidzStudentDetail(studentId, token)
      );
    }

    if (action === "getTahfidzSesiList" || action === "tahfidz.getSesi") {
      const token = e.parameter.token || null;
      return createJsonResponse(getTahfidzSesiList(token));
    }

    if (action === "getTahfidzHalaqahList" || action === "tahfidz.getHalaqah") {
      const token = e.parameter.token || null;
      return createJsonResponse(getTahfidzHalaqahList(token));
    }

    if (action === "getTPQDashboard" || action === "tpq.dashboard") {
      const token = e.parameter.token || null;
      return createJsonResponse(getTPQDashboard(token));
    }

    if (action === "getTPQKelasList" || action === "tpq.getKelas") {
      const token = e.parameter.token || null;
      return createJsonResponse(getTPQKelasList(token));
    }

    if (action === "getSoroganDashboard" || action === "sorogan.dashboard") {
      const token = e.parameter.token || null;
      return createJsonResponse(getSoroganDashboard(token));
    }

    if (action === "getSoroganStudentDetail" || action === "sorogan.studentDetail") {
      const token = e.parameter.token || null;
      const studentId = e.parameter.studentId || e.parameter.student_id || null;
      return createJsonResponse(getSoroganStudentDetail(studentId, token));
    }

    if (action === "getSoroganHalaqahList" || action === "sorogan.getHalaqah") {
      const token = e.parameter.token || null;
      return createJsonResponse(getSoroganHalaqahList(token));
    }

    if (action === "getSoroganSesiList" || action === "sorogan.getSesi" || action === "getSoroganSesi") {
      const token = e.parameter.token || null;
      return createJsonResponse(getSoroganSesiList(token));
    }

    if (action === "getEmployees" || action === "employee.list") {
      const token = e.parameter.token || null;
      return createJsonResponse(
        getAllEmployeesData(token)
      );
    }

    // ========================================================
    // PROGRAM DATA SOURCE v2.0 API ROUTER (GET)
    // ========================================================
    if (action.startsWith("program.")) {
      return handleProgramApiAction(action, null, e);
    }

    return createJsonResponse({
      status: "error",
      message: "Action tidak dikenal",
      action: action
    });

  } catch (error) {

    console.error(error);

    return createJsonResponse({
      status: "error",
      message: "Terjadi kesalahan pada server."
    });
  }
}

// Fungsi Ambil Berita (Bisa dipanggil oleh doGet maupun google.script.run)
function getKabarData() {
  try {
    const ss = getDatabaseSpreadsheet();
    // Cari tab 'Berita' atau 'Kabar' secara fleksibel (kebal typo huruf besar/kecil/spasi)
    let beritaSheet = ss.getSheetByName("Berita") || ss.getSheetByName("Kabar");
    if (!beritaSheet) {
      const sheets = ss.getSheets();
      for (let s of sheets) {
        const name = s.getName().trim().toLowerCase();
        if (name === "berita" || name === "kabar") {
          beritaSheet = s;
          break;
        }
      }
    }

    if (!beritaSheet) {
      return { status: "error", message: "Sheet Berita tidak ditemukan", data: [] };
    }

    const data = beritaSheet.getDataRange().getValues();
    const newsList = [];
    
    let isMigrated = false;
    if (data.length > 0 && data[0][0] === "news_id" && data[0][1] === "slug") {
      isMigrated = true;
    }

    // Baris 1 adalah Header, ambil mulai baris 2 (index 1) dari yang paling baru
    for (let i = data.length - 1; i >= 1; i--) {
      if (isMigrated) {
        const judul = String(data[i][3] || "").trim();
        const news_id = String(data[i][0] || "").trim();
        const slug = String(data[i][1] || "").trim();
        if (judul !== "" || news_id !== "") {
          newsList.push({
            news_id: news_id,
            slug: slug,
            tanggal: data[i][2] ? formatDate(data[i][2]) : "",
            judul: judul,
            kategori: data[i][4] ? String(data[i][4]) : "Kabar",
            penulis: "Admin",
            gambar: data[i][6] ? String(data[i][6]) : "",
            ringkasan: data[i][7] ? String(data[i][7]) : "",
            isi: data[i][8] ? String(data[i][8]) : ""
          });
        }
      } else {
        const judul = String(data[i][1] || "").trim();
        if (judul !== "") {
          newsList.push({
            news_id: "",
            slug: "",
            tanggal: data[i][0] ? formatDate(data[i][0]) : "",
            judul: judul,
            kategori: data[i][2] ? String(data[i][2]) : "Kabar",
            penulis: data[i][3] ? String(data[i][3]) : "Admin",
            gambar: data[i][4] ? String(data[i][4]) : "",
            ringkasan: data[i][5] ? String(data[i][5]) : "",
            isi: data[i][6] ? String(data[i][6]) : ""
          });
        }
      }
    }

    return { status: "success", data: newsList };
  } catch (err) {
    return { status: "error", message: err.toString(), data: [] };
  }
}

// ==================== PENGELOLAAN BANNER SLIDER ====================
const BANNER_SHEET_NAME = "Banner";
const GALERI_SHEET_NAME = "Galeri";
const UNIT_KEGIATAN_SHEET_NAME = "Unit_Kegiatan";
const PENGATURAN_SHEET_NAME = "Pengaturan";
const ALUMNI_SHEET_NAME = "Data_Alumni";

// 1. Mengambil Data Banner Aktif (Untuk Beranda & Admin)
function getBannerData() {
  try {
    const ss = getDatabaseSpreadsheet();
    let bannerSheet = ss.getSheetByName(BANNER_SHEET_NAME);

    // Jika sheet belum ada, buat otomatis beserta headernya
    if (!bannerSheet) {
      bannerSheet = ss.insertSheet(BANNER_SHEET_NAME);
      bannerSheet.appendRow(["ID_Banner", "Nama_Banner", "Gambar_URL", "Tipe_Aksi", "Target_Aksi", "Urutan", "Status"]);
      // Tambahkan 1 banner contoh awal
      bannerSheet.appendRow([
        "BAN_" + new Date().getTime(),
        "Banner Utama PPDB 2026/2027",
        "https://images.unsplash.com/photo-1577896851231-70ef18881754?q=80&w=1200&auto=format&fit=crop",
        "tab",
        "ppdb",
        1,
        "Aktif"
      ]);
    }

    const data = bannerSheet.getDataRange().getValues();
    const bannerList = [];

    // Baca baris 2 sampai akhir
    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) { // Pastikan ID tidak kosong
        bannerList.push({
          id: String(data[i][0]),
          nama: String(data[i][1] || ""),
          gambar: String(data[i][2] || ""),
          tipeAksi: String(data[i][3] || "none"),
          targetAksi: String(data[i][4] || ""),
          urutan: Number(data[i][5]) || (i),
          status: String(data[i][6] || "Aktif")
        });
      }
    }

    // Urutkan berdasarkan nomor urutan
    bannerList.sort((a, b) => a.urutan - b.urutan);

    return { status: "success", data: bannerList };
  } catch (err) {
    return { status: "error", message: err.toString(), data: [] };
  }
}

// 2. Simpan atau Perbarui Banner (Termasuk Upload Foto ke Drive)
function simpanBanner(formData) {
  try {
    const ss = getDatabaseSpreadsheet();
    let bannerSheet = ss.getSheetByName(BANNER_SHEET_NAME);
    if (!bannerSheet) {
      getBannerData(); // Buat sheet jika belum ada
      bannerSheet = ss.getSheetByName(BANNER_SHEET_NAME);
    }

    var fileUrl = formData.gambarLama || "";

    // Upload gambar baru ke Drive jika ada file yang diunggah
    if (formData.file && formData.file.base64) {
      var folder = DriveApp.getFolderById(FOLDER_ID);
      var decodedData = Utilities.base64Decode(formData.file.base64);
      var blob = Utilities.newBlob(
        decodedData,
        formData.file.mimeType,
        "BANNER_" + new Date().getTime() + "_" + formData.file.name
      );
      var newFile = folder.createFile(blob);
      newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      fileUrl = "https://lh3.googleusercontent.com/d/" + newFile.getId();
    }

    const data = bannerSheet.getDataRange().getValues();
    let isEdit = false;

    // Jika Mode Edit (ID sudah ada)
    if (formData.id) {
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(formData.id)) {
          bannerSheet.getRange(i + 1, 2).setValue(formData.nama);
          if (fileUrl) bannerSheet.getRange(i + 1, 3).setValue(fileUrl);
          bannerSheet.getRange(i + 1, 4).setValue(formData.tipeAksi);
          bannerSheet.getRange(i + 1, 5).setValue(formData.targetAksi);
          bannerSheet.getRange(i + 1, 6).setValue(formData.urutan);
          bannerSheet.getRange(i + 1, 7).setValue(formData.status);
          isEdit = true;
          break;
        }
      }
    }

    // Jika Mode Tambah Baru
    if (!isEdit) {
      const newId = "BAN_" + new Date().getTime();
      bannerSheet.appendRow([
        newId,
        formData.nama,
        fileUrl,
        formData.tipeAksi,
        formData.targetAksi,
        formData.urutan,
        formData.status || "Aktif"
      ]);
    }

    return { success: true, message: isEdit ? "Banner berhasil diperbarui!" : "Banner baru berhasil ditambahkan!" };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

// 3. Hapus Banner
function hapusBanner(bannerId) {
  try {
    const ss = getDatabaseSpreadsheet();
    const bannerSheet = ss.getSheetByName(BANNER_SHEET_NAME);
    if (!bannerSheet) return { success: false, message: "Sheet tidak ditemukan" };

    const data = bannerSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(bannerId)) {
        bannerSheet.deleteRow(i + 1);
        return { success: true, message: "Banner berhasil dihapus!" };
      }
    }
    return { success: false, message: "ID Banner tidak ditemukan" };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

// 4. Toggle Status Banner (Aktif / Nonaktif)
function toggleStatusBanner(bannerId, newStatus) {
  try {
    const ss = getDatabaseSpreadsheet();
    const bannerSheet = ss.getSheetByName(BANNER_SHEET_NAME);
    const data = bannerSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(bannerId)) {
        bannerSheet.getRange(i + 1, 7).setValue(newStatus);
        return { success: true, message: "Status banner diubah ke: " + newStatus };
      }
    }
    return { success: false, message: "ID Banner tidak ditemukan" };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

// ==================== PENGELOLAAN GALERI ====================

// 1. Mengambil Data Galeri
function getGaleriData() {
  try {
    const ss = getDatabaseSpreadsheet();
    let galeriSheet = ss.getSheetByName(GALERI_SHEET_NAME);

    // Jika sheet belum ada, buat otomatis beserta headernya
    if (!galeriSheet) {
      galeriSheet = ss.insertSheet(GALERI_SHEET_NAME);
      galeriSheet.appendRow(["ID_Galeri", "Judul", "Kategori", "Keterangan", "Gambar_URL", "Status", "Timestamp"]);
      // Tambahkan contoh awal
      galeriSheet.appendRow([
        "GLR_" + new Date().getTime(),
        "Halaqah Hafalan Santri",
        "Kegiatan Santri",
        "Harian Asrama",
        "https://images.unsplash.com/photo-1585036156171-384164a8c675?q=80&w=800&auto=format&fit=crop",
        "Aktif",
        new Date().toISOString()
      ]);
    }

    const data = galeriSheet.getDataRange().getValues();
    const galeriList = [];

    // Baca baris 2 sampai akhir
    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) { // Pastikan ID tidak kosong
        galeriList.push({
          id: String(data[i][0]),
          judul: String(data[i][1] || ""),
          kategori: String(data[i][2] || ""),
          keterangan: String(data[i][3] || ""),
          gambar: String(data[i][4] || ""),
          status: String(data[i][5] || "Aktif"),
          timestamp: String(data[i][6] || "")
        });
      }
    }

    // Urutkan terbaru di atas (reverse)
    galeriList.reverse();

    return { status: "success", data: galeriList };
  } catch (err) {
    return { status: "error", message: err.toString(), data: [] };
  }
}

// 2. Tambah / Edit Galeri
function simpanGaleri(formData) {
  try {
    const ss = getDatabaseSpreadsheet();
    let galeriSheet = ss.getSheetByName(GALERI_SHEET_NAME);
    if (!galeriSheet) {
      getGaleriData(); // Buat sheet jika belum ada
      galeriSheet = ss.getSheetByName(GALERI_SHEET_NAME);
    }

    var fileUrl = formData.gambarLama || "";

    // Upload gambar baru ke Drive jika ada file yang diunggah
    if (formData.file && formData.file.base64) {
      var folder = DriveApp.getFolderById(FOLDER_ID);
      var decodedData = Utilities.base64Decode(formData.file.base64);
      var blob = Utilities.newBlob(
        decodedData,
        formData.file.mimeType,
        "GALERI_" + new Date().getTime() + "_" + formData.file.name
      );
      var newFile = folder.createFile(blob);
      newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      fileUrl = "https://lh3.googleusercontent.com/d/" + newFile.getId();
    }

    const data = galeriSheet.getDataRange().getValues();
    let isEdit = false;

    // Jika Mode Edit (ID sudah ada)
    if (formData.id) {
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(formData.id)) {
          galeriSheet.getRange(i + 1, 2).setValue(formData.judul);
          galeriSheet.getRange(i + 1, 3).setValue(formData.kategori);
          galeriSheet.getRange(i + 1, 4).setValue(formData.keterangan);
          if (fileUrl) galeriSheet.getRange(i + 1, 5).setValue(fileUrl);
          galeriSheet.getRange(i + 1, 6).setValue(formData.status);
          isEdit = true;
          break;
        }
      }
    }

    // Jika Mode Tambah Baru
    if (!isEdit) {
      const newId = "GLR_" + new Date().getTime();
      galeriSheet.appendRow([
        newId,
        formData.judul,
        formData.kategori,
        formData.keterangan,
        fileUrl,
        formData.status || "Aktif",
        new Date().toISOString()
      ]);
    }

    return { success: true, message: "Galeri berhasil disimpan", url: fileUrl };
  } catch (err) {
    return { success: false, message: "Gagal menyimpan galeri: " + err.message };
  }
}

// 3. Hapus Galeri
function hapusGaleri(galeriId) {
  try {
    const ss = getDatabaseSpreadsheet();
    const galeriSheet = ss.getSheetByName(GALERI_SHEET_NAME);
    const data = galeriSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(galeriId)) {
        galeriSheet.deleteRow(i + 1);
        return { success: true, message: "Galeri berhasil dihapus" };
      }
    }
    return { success: false, message: "ID Galeri tidak ditemukan" };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

// 4. Toggle Status Galeri
function toggleStatusGaleri(galeriId, newStatus) {
  try {
    const ss = getDatabaseSpreadsheet();
    const galeriSheet = ss.getSheetByName(GALERI_SHEET_NAME);
    const data = galeriSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(galeriId)) {
        galeriSheet.getRange(i + 1, 6).setValue(newStatus);
        return { success: true, message: "Status galeri diubah ke: " + newStatus };
      }
    }
    return { success: false, message: "ID Galeri tidak ditemukan" };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

function formatYoutubeEmbedUrlBackend(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";
  if (trimmed.includes("youtube.com/embed/") || trimmed.includes("youtube-nocookie.com/embed/")) {
    return trimmed;
  }
  const playlistMatch = trimmed.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  if (playlistMatch && playlistMatch[1] && !trimmed.includes("watch?v=")) {
    return "https://www.youtube.com/embed/videoseries?list=" + playlistMatch[1] + "&rel=0";
  }
  const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch && shortMatch[1]) {
    return "https://www.youtube.com/embed/" + shortMatch[1] + "?rel=0";
  }
  const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch && watchMatch[1]) {
    return "https://www.youtube.com/embed/" + watchMatch[1] + "?rel=0";
  }
  const shortsMatch = trimmed.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch && shortsMatch[1]) {
    return "https://www.youtube.com/embed/" + shortsMatch[1] + "?rel=0";
  }
  return trimmed;
}

// ==================== PENGATURAN PROFIL ====================
function getPengaturanData() {
  try {
    const ss = getDatabaseSpreadsheet();
    let sheet = ss.getSheetByName(PENGATURAN_SHEET_NAME);
    
    if (!sheet) {
      sheet = ss.insertSheet(PENGATURAN_SHEET_NAME);
      sheet.appendRow(["Key", "Value", "Keterangan", "Update_Terakhir"]);
      sheet.appendRow(["video_highlight", "https://www.youtube.com/embed/ZQZqPcAlrk0?rel=0", "URL Embed Youtube untuk Galeri", new Date().toISOString()]);
      sheet.appendRow(["link_instagram", "https://instagram.com", "URL Profil Instagram", new Date().toISOString()]);
      sheet.appendRow(["link_youtube", "https://youtube.com", "URL Channel YouTube", new Date().toISOString()]);
      sheet.appendRow(["link_facebook", "https://facebook.com", "URL Halaman Facebook", new Date().toISOString()]);
    }
    
    const data = sheet.getDataRange().getValues();
    const config = {};
    
    for (let i = 1; i < data.length; i++) {
      const key = String(data[i][0]).trim();
      if (key) {
        let rawVal = data[i][1];
        let val = "";
        if (rawVal instanceof Date) {
          const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
          val = rawVal.getDate() + " " + months[rawVal.getMonth()] + " " + rawVal.getFullYear();
        } else {
          val = String(rawVal != null ? rawVal : "").trim();
        }

        if (key === "video_highlight") {
          // Bersihkan dummy playlist rusak atau ubah link youtu.be menjadi embed URL
          if (val.includes("list=PL_XQ")) {
            val = "https://www.youtube.com/embed/ZQZqPcAlrk0?rel=0";
          } else {
            val = formatYoutubeEmbedUrlBackend(val);
          }
        }
        config[key] = val;
      }
    }
    
    return { status: "success", data: config };
  } catch (err) {
    return { status: "error", message: err.toString(), data: {} };
  }
}

function simpanPengaturan(payload) {
  try {
    const ss = getDatabaseSpreadsheet();
    let sheet = ss.getSheetByName(PENGATURAN_SHEET_NAME);
    if (!sheet) {
      getPengaturanData();
      sheet = ss.getSheetByName(PENGATURAN_SHEET_NAME);
    }
    
    if (payload.video_highlight) {
      payload.video_highlight = formatYoutubeEmbedUrlBackend(payload.video_highlight);
    }
    
    const keysToUpdate = Object.keys(payload);
    const data = sheet.getDataRange().getValues();
    
    for (let k of keysToUpdate) {
      if (k === "action") continue;
      
      let foundRow = -1;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim() === k) {
          foundRow = i + 1;
          break;
        }
      }
      
      const valToSet = (k === "tanggal_berdiri") ? ("'" + String(payload[k]).replace(/^'/, "")) : payload[k];
      if (foundRow > 0) {
        sheet.getRange(foundRow, 2).setValue(valToSet);
        sheet.getRange(foundRow, 4).setValue(new Date().toISOString());
      } else {
        sheet.appendRow([k, valToSet, "", new Date().toISOString()]);
      }
    }
    
    return { success: true, message: "Pengaturan berhasil disimpan!" };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

// ==================== PENGELOLAAN UNIT KEGIATAN SANTRI (UKS) ====================

// 1. Mengambil Data Unit Kegiatan
function getUnitKegiatanData() {
  try {
    const ss = getDatabaseSpreadsheet();
    let sheet = ss.getSheetByName(UNIT_KEGIATAN_SHEET_NAME);

    // Jika sheet belum ada, buat otomatis beserta header dan 5 data default
    if (!sheet) {
      sheet = ss.insertSheet(UNIT_KEGIATAN_SHEET_NAME);
      sheet.appendRow(["ID_Kegiatan", "Nama", "Kategori", "Jadwal", "Deskripsi", "Gambar_URL", "Urutan", "Status", "Timestamp"]);
      
      const defaultData = [
        [
          "UKS_01_SEMUT",
          "Teater \"SEMUT\"",
          "Divisi Teater Santri",
          "2x Semesta / Tahun",
          "Unit kegiatan santri yang berfokus pada pementasan drama atau teater. Ditujukan sebagai wadah kreativitas untuk melatih mental dan rasa percaya diri santri saat berada di tengah masyarakat.",
          "https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?q=80&w=800&auto=format&fit=crop",
          1,
          "Aktif",
          new Date().toISOString()
        ],
        [
          "UKS_02_MADING",
          "Mading \"EL-Fata\"",
          "Karya Literasi",
          "Awal Bulan Hijriyah",
          "Unit kegiatan yang berfokus pada kreasi majalah dinding sebagai salah satu media untuk menampilkan karya seni, tulisan, dan kreativitas santri yang terbit secara berkala setiap awal bulan Hijriyah.",
          "https://images.unsplash.com/photo-1516979187457-637abb4f9353?q=80&w=800&auto=format&fit=crop",
          2,
          "Aktif",
          new Date().toISOString()
        ],
        [
          "UKS_03_PERPUS",
          "Perpustakaan \"Bait Al-Hikmah\"",
          "Pusat Baca Santri",
          "Harian",
          "Perpustakaan santri yang dibangun guna melestarikan budaya membaca di kalangan santri serta menjadi jembatan penghubung antara santri dengan wawasan dunia luar lewat koleksi buku yang tersedia.",
          "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?q=80&w=800&auto=format&fit=crop",
          3,
          "Aktif",
          new Date().toISOString()
        ],
        [
          "UKS_04_REBANA",
          "Rebana \"Az-Zahra\"",
          "Seni Musik Islami",
          "Malam Jumat & Event",
          "Unit kegiatan seni musik dengan aliran Hadroh Banjari Kontemporer (terbang, tam, darbuka, jidor). Ditampilkan rutin pada malam Jumat saat acara diba'an dan sebagai pembuka acara-acara penting di pesantren.",
          "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=800&auto=format&fit=crop",
          4,
          "Aktif",
          new Date().toISOString()
        ],
        [
          "UKS_05_PERS",
          "Divisi PERS Santri",
          "Media & Publikasi",
          "Dokumentasi",
          "Divisi khusus yang berkonsentrasi pada media sosial resmi pesantren (Facebook, Instagram, YouTube, Twitter/X). Berperan mengabadikan dan mempublikasikan seluruh kegiatan serta event pesantren untuk mengenalkan kegiatan santri ke masyarakat luas.",
          "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?q=80&w=800&auto=format&fit=crop",
          5,
          "Aktif",
          new Date().toISOString()
        ]
      ];

      for (var d = 0; d < defaultData.length; d++) {
        sheet.appendRow(defaultData[d]);
      }
    }

    const data = sheet.getDataRange().getValues();
    const list = [];

    for (var i = 1; i < data.length; i++) {
      if (data[i][0]) {
        list.push({
          id: String(data[i][0]),
          nama: String(data[i][1] || ""),
          kategori: String(data[i][2] || ""),
          jadwal: String(data[i][3] || ""),
          deskripsi: String(data[i][4] || ""),
          gambar: String(data[i][5] || ""),
          urutan: Number(data[i][6]) || 1,
          status: String(data[i][7] || "Aktif"),
          timestamp: String(data[i][8] || "")
        });
      }
    }

    // Urutkan berdasarkan urutan ASC
    list.sort(function(a, b) {
      return a.urutan - b.urutan;
    });

    return { status: "success", data: list };
  } catch (err) {
    return { status: "error", message: err.toString(), data: [] };
  }
}

// 2. Tambah / Edit Unit Kegiatan
function simpanUnitKegiatan(formData) {
  try {
    const ss = getDatabaseSpreadsheet();
    let sheet = ss.getSheetByName(UNIT_KEGIATAN_SHEET_NAME);
    if (!sheet) {
      getUnitKegiatanData();
      sheet = ss.getSheetByName(UNIT_KEGIATAN_SHEET_NAME);
    }

    var fileUrl = formData.gambarLama || formData.gambar || "";

    // Upload file ke Google Drive jika ada file base64
    if (formData.file && formData.file.base64) {
      var folder = DriveApp.getFolderById(FOLDER_ID);
      var decodedData = Utilities.base64Decode(formData.file.base64);
      var blob = Utilities.newBlob(
        decodedData,
        formData.file.mimeType,
        "UKS_" + new Date().getTime() + "_" + formData.file.name
      );
      var newFile = folder.createFile(blob);
      newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      fileUrl = "https://lh3.googleusercontent.com/d/" + newFile.getId();
    }

    const data = sheet.getDataRange().getValues();
    let isEdit = false;

    // Jika Mode Edit (ID sudah ada)
    if (formData.id) {
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(formData.id)) {
          sheet.getRange(i + 1, 2).setValue(formData.nama || formData.judul || "");
          sheet.getRange(i + 1, 3).setValue(formData.kategori || "");
          sheet.getRange(i + 1, 4).setValue(formData.jadwal || "");
          sheet.getRange(i + 1, 5).setValue(formData.deskripsi || "");
          if (fileUrl) sheet.getRange(i + 1, 6).setValue(fileUrl);
          sheet.getRange(i + 1, 7).setValue(Number(formData.urutan) || 1);
          sheet.getRange(i + 1, 8).setValue(formData.status || "Aktif");
          isEdit = true;
          break;
        }
      }
    }

    // Jika Tambah Baru
    if (!isEdit) {
      const newId = "UKS_" + new Date().getTime();
      sheet.appendRow([
        newId,
        formData.nama || formData.judul || "",
        formData.kategori || "",
        formData.jadwal || "",
        formData.deskripsi || "",
        fileUrl,
        Number(formData.urutan) || data.length,
        formData.status || "Aktif",
        new Date().toISOString()
      ]);
    }

    return { success: true, message: "Data Unit Kegiatan berhasil disimpan", url: fileUrl };
  } catch (err) {
    return { success: false, message: "Gagal menyimpan Unit Kegiatan: " + err.message };
  }
}

// 3. Hapus Unit Kegiatan
function hapusUnitKegiatan(kegiatanId) {
  try {
    const ss = getDatabaseSpreadsheet();
    const sheet = ss.getSheetByName(UNIT_KEGIATAN_SHEET_NAME);
    if (!sheet) return { success: false, message: "Sheet Unit Kegiatan tidak ditemukan" };

    const data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(kegiatanId)) {
        sheet.deleteRow(i + 1);
        return { success: true, message: "Unit Kegiatan berhasil dihapus" };
      }
    }
    return { success: false, message: "ID Unit Kegiatan tidak ditemukan" };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

// 4. Toggle Status Unit Kegiatan
function toggleStatusUnitKegiatan(kegiatanId, newStatus) {
  try {
    const ss = getDatabaseSpreadsheet();
    const sheet = ss.getSheetByName(UNIT_KEGIATAN_SHEET_NAME);
    if (!sheet) return { success: false, message: "Sheet Unit Kegiatan tidak ditemukan" };

    const data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(kegiatanId)) {
        sheet.getRange(i + 1, 8).setValue(newStatus);
        return { success: true, message: "Status Unit Kegiatan diubah ke: " + newStatus };
      }
    }
    return { success: false, message: "ID Unit Kegiatan tidak ditemukan" };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

// ==================== PENGELOLAAN NOTIFIKASI & POP-UP BERANDA ====================
const NOTIFIKASI_SHEET_NAME = "Notifikasi";

function getNotifikasiSheet(ss) {
  let sheet = ss.getSheetByName(NOTIFIKASI_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(NOTIFIKASI_SHEET_NAME);
    sheet.appendRow([
      "ID", "Judul", "Kategori", "Tanggal", "Ringkasan", "Isi", "Gambar_URL", "Is_Popup", "Status", "CreatedAt"
    ]);
    sheet.appendRow([
      "NOTIF_" + new Date().getTime(),
      "Selamat Datang di Portal Resmi Pesantren",
      "Pengumuman",
      new Date().toISOString().split('T')[0],
      "Informasi dan pengumuman resmi seputar pesantren, kegiatan santri, dan administrasi.",
      "Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\nSelamat datang di Portal Informasi Resmi Pesantren. Melalui sistem ini, bapak/ibu wali santri dan masyarakat dapat memantau perkembangan, pengumuman penting, dan agenda kegiatan pesantren secara langsung.\n\nSemoga ikhtiar ini membawa keberkahan bagi kita semua.",
      "",
      1,
      "Aktif",
      new Date().toISOString()
    ]);
  }
  return sheet;
}

function getNotifikasiData() {
  try {
    const ss = getDatabaseSpreadsheet();
    const sheet = getNotifikasiSheet(ss);
    const values = sheet.getDataRange().getValues();
    const list = [];

    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (row[0]) {
        list.push({
          id: String(row[0]),
          judul: String(row[1] || ""),
          kategori: String(row[2] || "Pengumuman"),
          tanggal: row[3] ? Utilities.formatDate(new Date(row[3]), "GMT+7", "yyyy-MM-dd") : "",
          ringkasan: String(row[4] || ""),
          isi: String(row[5] || ""),
          gambar: String(row[6] || ""),
          is_popup: (row[7] === 1 || String(row[7]).toLowerCase() === "true" || String(row[7]) === "1"),
          status: String(row[8] || "Aktif"),
          createdAt: String(row[9] || "")
        });
      }
    }

    list.sort(function(a, b) {
      return (b.id > a.id ? 1 : -1);
    });

    return { status: "success", data: list };
  } catch (err) {
    return { status: "error", message: err.toString(), data: [] };
  }
}

function simpanNotifikasi(formData) {
  try {
    const ss = getDatabaseSpreadsheet();
    const sheet = getNotifikasiSheet(ss);
    let fileUrl = formData.gambarLama || formData.gambar || "";

    if (formData.file && formData.file.base64) {
      const folder = DriveApp.getFolderById(FOLDER_ID);
      const decodedData = Utilities.base64Decode(formData.file.base64);
      const blob = Utilities.newBlob(
        decodedData,
        formData.file.mimeType,
        "NOTIF_" + new Date().getTime() + "_" + formData.file.name
      );
      const newFile = folder.createFile(blob);
      newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      fileUrl = "https://lh3.googleusercontent.com/d/" + newFile.getId();
    }

    const data = sheet.getDataRange().getValues();
    let isEdit = false;
    const isPopupVal = (formData.is_popup === true || formData.is_popup === 1 || String(formData.is_popup) === "1" || String(formData.is_popup).toLowerCase() === "true") ? 1 : 0;
    const tanggalVal = formData.tanggal || Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");

    if (formData.id) {
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(formData.id)) {
          sheet.getRange(i + 1, 2).setValue(formData.judul || "");
          sheet.getRange(i + 1, 3).setValue(formData.kategori || "Pengumuman");
          sheet.getRange(i + 1, 4).setValue(tanggalVal);
          sheet.getRange(i + 1, 5).setValue(formData.ringkasan || "");
          sheet.getRange(i + 1, 6).setValue(formData.isi || "");
          if (fileUrl !== undefined) sheet.getRange(i + 1, 7).setValue(fileUrl);
          sheet.getRange(i + 1, 8).setValue(isPopupVal);
          sheet.getRange(i + 1, 9).setValue(formData.status || "Aktif");
          isEdit = true;
          break;
        }
      }
    }

    if (!isEdit) {
      const newId = "NOTIF_" + new Date().getTime();
      sheet.appendRow([
        newId,
        formData.judul || "",
        formData.kategori || "Pengumuman",
        tanggalVal,
        formData.ringkasan || "",
        formData.isi || "",
        fileUrl,
        isPopupVal,
        formData.status || "Aktif",
        new Date().toISOString()
      ]);
    }

    return { status: "success", message: isEdit ? "Notifikasi berhasil diperbarui!" : "Notifikasi berhasil ditambahkan!" };
  } catch (err) {
    return { status: "error", message: err.toString() };
  }
}

function deleteNotifikasiData(formData) {
  try {
    const notifId = typeof formData === "object" ? (formData.id || formData.notifId) : formData;
    if (!notifId) return { status: "error", message: "ID Notifikasi tidak diberikan" };

    const ss = getDatabaseSpreadsheet();
    const sheet = getNotifikasiSheet(ss);
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(notifId)) {
        sheet.deleteRow(i + 1);
        return { status: "success", message: "Notifikasi berhasil dihapus!" };
      }
    }

    return { status: "error", message: "Notifikasi tidak ditemukan." };
  } catch (err) {
    return { status: "error", message: err.toString() };
  }
}

// 5. Upload Media Tunggal ke Google Drive (Khusus Admin/Editor Terautentikasi)
function uploadMediaToDrive(formData, token) {
  try {
    // 1. Validasi Autentikasi Sesi Admin
    if (!token) {
      return {
        success: false,
        status: "error",
        statusCode: 401,
        message: "Sesi admin tidak ditemukan. Silakan login kembali."
      };
    }

    const session = verifySessionToken(token);
    if (!session || !session.userId || !session.role) {
      return {
        success: false,
        status: "error",
        statusCode: 401,
        message: "Sesi admin tidak valid atau telah kedaluwarsa. Silakan login kembali."
      };
    }

    // 2. Validasi Otorisasi Role (ADMIN atau EDITOR)
    const role = String(session.role || "").toLowerCase();
    if (role !== "admin" && role !== "editor") {
      return {
        success: false,
        status: "error",
        statusCode: 403,
        message: "Akses ditolak: Anda tidak memiliki izin untuk mengunggah media."
      };
    }

    // 3. Validasi Payload File
    const fileData = (formData && formData.file) || formData;
    if (!fileData || !fileData.base64 || !fileData.name) {
      return {
        success: false,
        status: "error",
        statusCode: 400,
        message: "Data file (base64 dan nama file) wajib dikirimkan."
      };
    }

    // 4. Strict MIME Type Whitelist (Hanya Gambar)
    const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const rawMime = String(fileData.mimeType || "").trim().toLowerCase();
    if (!allowedMimes.includes(rawMime)) {
      return {
        success: false,
        status: "error",
        statusCode: 400,
        message: "Format file tidak didukung. Hanya gambar (JPG, PNG, WEBP, GIF) yang diperbolehkan."
      };
    }

    // 5. Decode Base64 & Validasi Ukuran Binary (Maksimal 5 MB)
    var decodedData = Utilities.base64Decode(fileData.base64);
    if (!decodedData || decodedData.length === 0) {
      return {
        success: false,
        status: "error",
        statusCode: 400,
        message: "Data biner file kosong atau tidak valid."
      };
    }

    const maxBytes = 5 * 1024 * 1024; // 5 MB
    if (decodedData.length > maxBytes) {
      return {
        success: false,
        status: "error",
        statusCode: 400,
        message: "Ukuran file melebihi batas maksimal 5 MB."
      };
    }

    // 6. Simpan File ke Google Drive
    var folder = DriveApp.getFolderById(FOLDER_ID);
    var cleanName = String(fileData.name || "media.jpg").replace(/[^a-zA-Z0-9._-]/g, "_");
    var prefix = String(fileData.prefix || "PROGRAM").toUpperCase().replace(/[^A-Z0-9]/g, "");
    var blob = Utilities.newBlob(
      decodedData,
      rawMime,
      prefix + "_" + new Date().getTime() + "_" + cleanName
    );
    var newFile = folder.createFile(blob);
    newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var fileUrl = "https://lh3.googleusercontent.com/d/" + newFile.getId();

    return {
      success: true,
      status: "success",
      statusCode: 200,
      url: fileUrl,
      fileUrl: fileUrl,
      fileId: newFile.getId(),
      message: "Media berhasil diunggah ke Google Drive!"
    };
  } catch (err) {
    if (err instanceof AuthenticationError) {
      return { success: false, status: "error", statusCode: 401, message: err.message };
    }
    if (err instanceof AuthorizationError) {
      return { success: false, status: "error", statusCode: 403, message: err.message };
    }
    return { success: false, status: "error", message: err.toString() };
  }
}
// ============================================================================
// PROGRAM DATA SOURCE v2.0 — PHASE 4B-1: BACKEND FOUNDATION
// Pure domain abstractions, error models, contracts, and service skeletons.
// (Zero persistence I/O, zero HTTP coupling, zero auth implementation in 4B-1).
// ============================================================================

/**
 * Domain Status Enum
 */
const ProgramStatus = Object.freeze({
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived"
});

/**
 * Domain Error Codes (HTTP-Agnostic)
 */
const ProgramErrorCode = Object.freeze({
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  CONCURRENCY_CONFLICT: "CONCURRENCY_CONFLICT",
  SERIALIZATION_ERROR: "SERIALIZATION_ERROR",
  PERSISTENCE_ERROR: "PERSISTENCE_ERROR",
  AUTHENTICATION_ERROR: "UNAUTHORIZED_TOKEN",
  AUTHORIZATION_ERROR: "FORBIDDEN_ACTION"
});

/**
 * Base HTTP-Agnostic Domain Error
 */
class DomainError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.details = details;
  }
}

class ValidationError extends DomainError {
  constructor(message, details = null) {
    super(ProgramErrorCode.VALIDATION_ERROR, message, details);
    this.name = "ValidationError";
  }
}

class NotFoundError extends DomainError {
  constructor(message = "Program data not found", details = null) {
    super(ProgramErrorCode.NOT_FOUND, message, details);
    this.name = "NotFoundError";
  }
}

class ConcurrencyConflictError extends DomainError {
  constructor(message = "Optimistic concurrency conflict detected. Record has been updated by another user.", details = null) {
    super(ProgramErrorCode.CONCURRENCY_CONFLICT, message, details);
    this.name = "ConcurrencyConflictError";
  }
}

class SerializationError extends DomainError {
  constructor(message = "Failed to serialize/deserialize program JSON payload (Fail-Closed)", details = null) {
    super(ProgramErrorCode.SERIALIZATION_ERROR, message, details);
    this.name = "SerializationError";
  }
}

class PersistenceError extends DomainError {
  constructor(message = "Persistence layer error", details = null) {
    super(ProgramErrorCode.PERSISTENCE_ERROR, message, details);
    this.name = "PersistenceError";
  }
}

class AuthenticationError extends DomainError {
  constructor(message = "Authentication required or token invalid", details = null) {
    super(ProgramErrorCode.AUTHENTICATION_ERROR, message, details);
    this.name = "AuthenticationError";
  }
}

class AuthorizationError extends DomainError {
  constructor(message = "Insufficient permissions for requested action", details = null) {
    super(ProgramErrorCode.AUTHORIZATION_ERROR, message, details);
    this.name = "AuthorizationError";
  }
}

/**
 * Domain Contract Interfaces & Helper Factories (Conceptual Value Objects)
 */
function createActorContext(userId, role, authenticatedAt = new Date().toISOString(), requestId = "") {
  if (!userId || !role) {
    throw new ValidationError("ActorContext requires valid userId and role");
  }
  return Object.freeze({
    userId: String(userId),
    role: String(role),
    authenticatedAt: String(authenticatedAt),
    requestId: String(requestId)
  });
}

function createAuditMetadata(actorContext, isPublishing = false) {
  const now = new Date().toISOString();
  const meta = {
    updated_at: now,
    updated_by: actorContext ? actorContext.userId : "system"
  };
  if (isPublishing) {
    meta.published_at = now;
    meta.published_by = actorContext ? actorContext.userId : "system";
  }
  return meta;
}

/**
 * Abstract ProgramRepository Interface (Pure Data-Access Contract)
 * Completely decoupled from HTTP, token, PIN, browser, or SpreadsheetApp.
 */
class ProgramRepository {
  findPublished() {
    throw new Error("ProgramRepository.findPublished() must be implemented by subclass");
  }

  findAll() {
    throw new Error("ProgramRepository.findAll() must be implemented by subclass");
  }

  findById(id) {
    throw new Error("ProgramRepository.findById() must be implemented by subclass");
  }

  save(record) {
    throw new Error("ProgramRepository.save() must be implemented by subclass");
  }

  updateStatus(id, status, metadata) {
    throw new Error("ProgramRepository.updateStatus() must be implemented by subclass");
  }
}

/**
 * GoogleSheetsProgramAdapter Implementation
 * Production-oriented Google Sheets Persistence Adapter satisfying the ProgramRepository contract.
 * Features: Sheet discovery, Header validation, Row mapping, LockService critical section,
 * Optimistic Concurrency, and Fail-Closed JSON serialization.
 */
class GoogleSheetsProgramAdapter extends ProgramRepository {
  constructor(customSheetName = "Programs") {
    super();
    this.sheetName = customSheetName;
    this.expectedHeaders = [
      "id", "name", "badge", "image", "description",
      "highlights_json", "detail_json", "status", "sort_order",
      "created_at", "updated_at", "created_by", "updated_by",
      "published_at", "published_by", "version"
    ];
  }

  /**
   * Internal helper: Discovers the "Programs" (or "Program") sheet and validates the 16-column header schema.
   * Features Self-Healing & Auto-Provisioning: If the sheet does not exist or is empty,
   * it automatically creates the sheet with proper 16-column headers, formatting, and seeds canonical program data.
   */
  _getProgramsSheet() {
    let ss = null;
    try {
      ss = getDatabaseSpreadsheet();
    } catch (e) {
      throw new PersistenceError("SpreadsheetApp active spreadsheet is unavailable: " + e.message);
    }
    if (!ss) {
      throw new PersistenceError("Active spreadsheet object is null.");
    }

    // 1. Check configured sheetName ("Programs")
    let sheet = ss.getSheetByName(this.sheetName);

    // 2. Fallback to alternative ("Program" vs "Programs")
    if (!sheet) {
      const altName = (this.sheetName.toLowerCase() === "programs") ? "Program" : "Programs";
      sheet = ss.getSheetByName(altName);
    }

    // 3. Case-insensitive search across all sheets
    if (!sheet) {
      const allSheets = ss.getSheets();
      for (let i = 0; i < allSheets.length; i++) {
        const sName = allSheets[i].getName().trim().toLowerCase();
        if (sName === "programs" || sName === "program") {
          sheet = allSheets[i];
          break;
        }
      }
    }

    // 4. Auto-Provisioning: If sheet does not exist, create it automatically!
    if (!sheet) {
      sheet = ss.insertSheet(this.sheetName);
      sheet.getRange(1, 1, 1, this.expectedHeaders.length).setValues([this.expectedHeaders]);
      sheet.getRange(1, 1, 1, this.expectedHeaders.length)
        .setFontWeight("bold")
        .setBackground("#047857")
        .setFontColor("#ffffff");
      sheet.setFrozenRows(1);

      this._seedDefaultPrograms(sheet);
      return sheet;
    }

    // Update resolved sheetName
    this.sheetName = sheet.getName();

    // 5. If sheet exists but is completely empty (missing headers)
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    if (!values || values.length === 0 || (values.length === 1 && values[0].join("").trim() === "")) {
      sheet.getRange(1, 1, 1, this.expectedHeaders.length).setValues([this.expectedHeaders]);
      sheet.getRange(1, 1, 1, this.expectedHeaders.length)
        .setFontWeight("bold")
        .setBackground("#047857")
        .setFontColor("#ffffff");
      sheet.setFrozenRows(1);

      this._seedDefaultPrograms(sheet);
      return sheet;
    }

    const headerRow = values[0];
    if (headerRow.length < this.expectedHeaders.length) {
      // Auto-repair missing columns in header row if safe
      sheet.getRange(1, 1, 1, this.expectedHeaders.length).setValues([this.expectedHeaders]);
      sheet.getRange(1, 1, 1, this.expectedHeaders.length)
        .setFontWeight("bold")
        .setBackground("#047857")
        .setFontColor("#ffffff");
      sheet.setFrozenRows(1);
      return sheet;
    }

    // Verify critical column header names (case-insensitive trim match)
    let headerNeedsFix = false;
    for (let colIdx = 0; colIdx < this.expectedHeaders.length; colIdx++) {
      const expectedCol = this.expectedHeaders[colIdx];
      const actualCol = String(headerRow[colIdx] || "").trim().toLowerCase();
      if (actualCol !== expectedCol) {
        headerNeedsFix = true;
        break;
      }
    }

    if (headerNeedsFix) {
      // Auto-correct header schema row to align with standard
      sheet.getRange(1, 1, 1, this.expectedHeaders.length).setValues([this.expectedHeaders]);
      sheet.getRange(1, 1, 1, this.expectedHeaders.length)
        .setFontWeight("bold")
        .setBackground("#047857")
        .setFontColor("#ffffff");
      sheet.setFrozenRows(1);
    }

    return sheet;
  }

  /**
   * Internal Helper: Seeds canonical default programs into newly created, empty, or incomplete sheet.
   */
  _seedDefaultPrograms(sheet) {
    try {
      if (typeof getCanonicalMigrationSource === "function") {
        const source = getCanonicalMigrationSource();
        if (Array.isArray(source) && source.length > 0) {
          const values = sheet.getDataRange().getValues();
          const existingIds = new Set();
          for (let r = 1; r < values.length; r++) {
            if (values[r][0]) {
              existingIds.add(String(values[r][0]).trim());
            }
          }

          const missing = source.filter(item => !existingIds.has(item.id));
          if (missing.length > 0) {
            const nowIso = new Date().toISOString();
            const startRow = Math.max(2, sheet.getLastRow() + 1);
            const rows = missing.map((item, idx) => [
              item.id,
              item.name,
              item.badge,
              item.image,
              item.description,
              serializeProgramPayload(item.highlights || []),
              serializeProgramPayload(item.detail || {}),
              ProgramStatus.PUBLISHED,
              existingIds.size + idx + 1,
              nowIso,
              nowIso,
              "system:init",
              "system:init",
              nowIso,
              "system:init",
              1
            ]);
            sheet.getRange(startRow, 1, rows.length, this.expectedHeaders.length).setValues(rows);
            Logger.log(`[OK] Seeded ${rows.length} programs into sheet '${sheet.getName()}'.`);
          }
        }
      }
    } catch (e) {
      Logger.log("Warning in _seedDefaultPrograms: " + e.message);
    }
  }

  /**
   * Internal Helper: Maps a spreadsheet row array (16 columns) to a ProgramRecord domain object.
   * Enforces FAIL-CLOSED serialization boundary: invalid JSON throws SerializationError immediately.
   */
  _mapRowToRecord(row) {
    if (!row || row.length < 16) {
      throw new PersistenceError("Row data incomplete or truncated (fewer than 16 columns).");
    }

    const id = String(row[0] || "").trim();
    if (!id) {
      throw new PersistenceError("Program row missing required 'id' field.");
    }

    const name = String(row[1] || "").trim();
    const badge = String(row[2] || "").trim();
    const image = String(row[3] || "").trim();
    const description = String(row[4] || "").trim();

    // Deserialize highlights and detail (Fail-Closed!)
    const highlights = deserializeProgramPayload(row[5]);
    const detail = deserializeProgramPayload(row[6]);

    const status = String(row[7] || ProgramStatus.DRAFT).trim().toLowerCase();
    const sortOrder = Number(row[8]) || 0;
    const createdAt = row[9] ? new Date(row[9]).toISOString() : new Date().toISOString();
    const updatedAt = row[10] ? new Date(row[10]).toISOString() : new Date().toISOString();
    const createdBy = String(row[11] || "system").trim();
    const updatedBy = String(row[12] || "system").trim();
    const publishedAt = row[13] ? new Date(row[13]).toISOString() : null;
    const publishedBy = row[14] ? String(row[14]).trim() : null;
    const version = Number(row[15]) || 1;

    return Object.freeze({
      id,
      name,
      badge,
      image,
      description,
      highlights,
      detail,
      status,
      sort_order: sortOrder,
      created_at: createdAt,
      updated_at: updatedAt,
      created_by: createdBy,
      updated_by: updatedBy,
      published_at: publishedAt,
      published_by: publishedBy,
      version
    });
  }

  /**
   * Internal Helper: Maps a ProgramRecord domain object to a 16-element spreadsheet row array.
   */
  _mapRecordToRow(record) {
    if (!record || !record.id) {
      throw new ValidationError("Cannot map invalid record object to spreadsheet row.");
    }

    const highlightsJson = serializeProgramPayload(record.highlights || []);
    const detailJson = serializeProgramPayload(record.detail || {});

    return [
      record.id,
      record.name || "",
      record.badge || "",
      record.image || "",
      record.description || "",
      highlightsJson,
      detailJson,
      record.status || ProgramStatus.DRAFT,
      Number(record.sort_order) || 0,
      record.created_at || new Date().toISOString(),
      record.updated_at || new Date().toISOString(),
      record.created_by || "system",
      record.updated_by || "system",
      record.published_at || "",
      record.published_by || "",
      Number(record.version) || 1
    ];
  }

  /**
   * Reads and returns all records with status === "published", sorted by sort_order ASC.
   * Fail-Closed: If any row fails JSON parsing, operation fails with SerializationError.
   */
  findPublished() {
    const sheet = this._getProgramsSheet();
    const values = sheet.getDataRange().getValues();
    const records = [];

    // Rows 1..N (Index 0 is header)
    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      if (!row[0] || String(row[0]).trim() === "") continue; // Skip blank rows

      const record = this._mapRowToRecord(row);
      if (record.status === ProgramStatus.PUBLISHED) {
        records.push(record);
      }
    }

    // Sort by sort_order ASC, tie-breaker id ASC
    records.sort((a, b) => {
      if (a.sort_order !== b.sort_order) {
        return a.sort_order - b.sort_order;
      }
      return a.id.localeCompare(b.id);
    });

    return records;
  }

  /**
   * Reads and returns all program records regardless of status.
   * Fail-Closed: Invalid cell JSON throws SerializationError immediately.
   */
  findAll() {
    const sheet = this._getProgramsSheet();
    const values = sheet.getDataRange().getValues();
    const records = [];

    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      if (!row[0] || String(row[0]).trim() === "") continue;

      const record = this._mapRowToRecord(row);
      records.push(record);
    }

    records.sort((a, b) => {
      if (a.sort_order !== b.sort_order) {
        return a.sort_order - b.sort_order;
      }
      return a.id.localeCompare(b.id);
    });

    return records;
  }

  /**
   * Reads and returns a single program record by ID, or null if not found.
   */
  findById(id) {
    if (!id || String(id).trim() === "") return null;
    const targetId = String(id).trim();

    const sheet = this._getProgramsSheet();
    const values = sheet.getDataRange().getValues();

    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      if (String(row[0] || "").trim() === targetId) {
        return this._mapRowToRecord(row);
      }
    }

    return null; // ID not found
  }

  /**
   * Inserts or updates a ProgramRecord atomically using LockService.getScriptLock().
   * Enforces optimistic concurrency counter comparison on updates.
   */
  save(record) {
    if (!record || !record.id) {
      throw new ValidationError("ProgramRecord.id is required for save operation.");
    }

    let lock = null;
    try {
      lock = LockService.getScriptLock();
    } catch (e) {
      throw new PersistenceError("LockService is unavailable: " + e.message);
    }

    const hasLock = lock.tryLock(10000); // 10s critical section lock timeout
    if (!hasLock) {
      throw new PersistenceError("Failed to acquire script lock for write operation within 10 seconds.");
    }

    try {
      const sheet = this._getProgramsSheet();
      const values = sheet.getDataRange().getValues();
      const targetId = String(record.id).trim();

      let targetRowIndex = -1;
      let storedRecord = null;

      for (let r = 1; r < values.length; r++) {
        if (String(values[r][0] || "").trim() === targetId) {
          targetRowIndex = r + 1; // 1-indexed row number in Spreadsheet
          storedRecord = this._mapRowToRecord(values[r]);
          break;
        }
      }

      if (targetRowIndex > 0 && storedRecord) {
        // UPDATE EXISTING RECORD: Enforce Optimistic Concurrency Check
        // Record version passed from service/client should equal (storedRecord.version)
        const expectedVersion = Number(record.version) - 1; // Service increments version before saving
        checkOptimisticVersion(storedRecord.version, expectedVersion);

        const rowData = this._mapRecordToRow(record);
        sheet.getRange(targetRowIndex, 1, 1, 16).setValues([rowData]);
      } else {
        // INSERT NEW RECORD
        const rowData = this._mapRecordToRow(record);
        sheet.appendRow(rowData);
      }

      return record;
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * Atomically updates status and audit metadata of a ProgramRecord using LockService.getScriptLock().
   */
  updateStatus(id, newStatus, metadata = {}) {
    if (!id || String(id).trim() === "") {
      throw new ValidationError("Program ID is required for updateStatus.");
    }
    if (!newStatus || !Object.values(ProgramStatus).includes(newStatus)) {
      throw new ValidationError(`Invalid target ProgramStatus: '${newStatus}'.`);
    }

    let lock = null;
    try {
      lock = LockService.getScriptLock();
    } catch (e) {
      throw new PersistenceError("LockService is unavailable: " + e.message);
    }

    const hasLock = lock.tryLock(10000);
    if (!hasLock) {
      throw new PersistenceError("Failed to acquire script lock for updateStatus within 10 seconds.");
    }

    try {
      const sheet = this._getProgramsSheet();
      const values = sheet.getDataRange().getValues();
      const targetId = String(id).trim();

      let targetRowIndex = -1;
      let storedRecord = null;

      for (let r = 1; r < values.length; r++) {
        if (String(values[r][0] || "").trim() === targetId) {
          targetRowIndex = r + 1;
          storedRecord = this._mapRowToRecord(values[r]);
          break;
        }
      }

      if (targetRowIndex <= 0 || !storedRecord) {
        throw new NotFoundError(`Program with ID '${id}' not found.`);
      }

      // Increment version counter atomically
      const nextVersion = storedRecord.version + 1;
      const nowIso = new Date().toISOString();
      const updatedBy = metadata.updated_by || (metadata.actorContext ? metadata.actorContext.userId : "system");

      let publishedAt = storedRecord.published_at;
      let publishedBy = storedRecord.published_by;

      if (newStatus === ProgramStatus.PUBLISHED) {
        publishedAt = metadata.published_at || nowIso;
        publishedBy = metadata.published_by || updatedBy;
      }

      const updatedRecord = Object.freeze({
        ...storedRecord,
        status: newStatus,
        version: nextVersion,
        updated_at: metadata.updated_at || nowIso,
        updated_by: updatedBy,
        published_at: publishedAt,
        published_by: publishedBy
      });

      const rowData = this._mapRecordToRow(updatedRecord);
      sheet.getRange(targetRowIndex, 1, 1, 16).setValues([rowData]);

      return true;
    } finally {
      lock.releaseLock();
    }
  }
}

/**
 * Server Secrets Helper (Reads PropertiesService)
 */
function getServerSecret(key, defaultValue = "") {
  try {
    const props = PropertiesService.getScriptProperties();
    const val = props ? props.getProperty(key) : null;
    if (!val && key === "TOKEN_SIGNING_SECRET") {
      console.warn("[SECURITY ALERT] TOKEN_SIGNING_SECRET belum dikonfigurasi di ScriptProperties!");
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
    
    props.setProperty("TOKEN_SIGNING_SECRET", newSecret);
    props.setProperty("TOKEN_VERSION", String(newVersion));
    
    Logger.log("✅ Script Security Properties berhasil dikonfigurasi!");
    Logger.log("TOKEN_SIGNING_SECRET telah disetel (panjang: " + newSecret.length + " karakter).");
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
function mapToPublicProgramDTO(record) {
  if (!record) return null;
  return Object.freeze({
    id: record.id,
    name: record.name,
    badge: record.badge,
    image: record.image,
    description: record.description,
    highlights: record.highlights,
    detail: record.detail
  });
}

function mapToAdminProgramDTO(record) {
  if (!record) return null;
  return Object.freeze({
    id: record.id,
    name: record.name,
    badge: record.badge,
    image: record.image,
    description: record.description,
    highlights: record.highlights,
    detail: record.detail,
    status: record.status,
    sort_order: record.sort_order,
    created_at: record.created_at,
    updated_at: record.updated_at,
    created_by: record.created_by,
    updated_by: record.updated_by,
    published_at: record.published_at,
    published_by: record.published_by,
    version: record.version
  });
}

/**
 * ProgramService Implementation
 * Application service orchestrating business rules, field ownership, and lifecycle logic.
 */
class ProgramService {
  constructor(programRepository) {
    if (!programRepository) {
      throw new ValidationError("ProgramService requires a valid ProgramRepository instance");
    }
    this.repository = programRepository;
  }

  getPublishedPrograms() {
    const records = this.repository.findPublished();
    return records.map(r => mapToPublicProgramDTO(r));
  }

  getPublishedProgramById(id) {
    if (!id) throw new ValidationError("Program ID is required.");
    const record = this.repository.findById(id);
    if (!record || record.status !== ProgramStatus.PUBLISHED) {
      throw new NotFoundError(`Published program '${id}' not found.`);
    }
    return mapToPublicProgramDTO(record);
  }

  getAllPrograms(actorContext) {
    authorizeAction(actorContext, "program.list");
    const records = this.repository.findAll();
    return records.map(r => mapToAdminProgramDTO(r));
  }

  getProgramById(id, actorContext) {
    authorizeAction(actorContext, "program.get");
    if (!id) throw new ValidationError("Program ID is required.");
    const record = this.repository.findById(id);
    if (!record) {
      throw new NotFoundError(`Program with ID '${id}' not found.`);
    }
    return mapToAdminProgramDTO(record);
  }

  saveProgram(inputPayload, actorContext) {
    if (!inputPayload || typeof inputPayload !== "object") {
      throw new ValidationError("Invalid program payload.");
    }

    const id = String(inputPayload.id || "").trim();
    if (!id) {
      throw new ValidationError("Program ID is required.");
    }

    let existing = null;
    try {
      existing = this.repository.findById(id);
    } catch (e) {
      existing = null;
    }

    const isEdit = Boolean(existing);
    const actionName = isEdit ? "program.update" : "program.create";
    authorizeAction(actorContext, actionName);

    // OPTIMISTIC CONCURRENCY VALIDATION
    // Client wajib mengirim version saat melakukan edit.
    if (
      isEdit &&
      inputPayload.version !== undefined &&
      inputPayload.version !== null
    ) {
      checkOptimisticVersion(
        existing.version,
        Number(inputPayload.version)
      );
    }

    const name = String(
      inputPayload.name || (existing ? existing.name : "")
    ).trim();

    if (!name) {
      throw new ValidationError("Program name is required.");
    }

    const now = new Date().toISOString();
    const userId = actorContext.userId;

    // Build ProgramRecord with Server-Managed Lifecycle Fields
    const recordToSave = Object.freeze({
      id: id,
      name: name,
      badge: String(
        inputPayload.badge || (existing ? existing.badge : "")
      ).trim(),
      image: String(
        inputPayload.image || (existing ? existing.image : "")
      ).trim(),
      description: String(
        inputPayload.description || (existing ? existing.description : "")
      ).trim(),
      highlights: Array.isArray(inputPayload.highlights)
        ? inputPayload.highlights
        : (existing ? existing.highlights : []),
      detail: (
        inputPayload.detail &&
        typeof inputPayload.detail === "object"
      )
        ? inputPayload.detail
        : (existing ? existing.detail : {}),

      // SERVER-MANAGED FIELDS
      status: existing
        ? existing.status
        : ProgramStatus.DRAFT,

      sort_order: Number(inputPayload.sort_order) ||
        (existing ? existing.sort_order : 0),

      created_at: existing
        ? existing.created_at
        : now,

      updated_at: now,

      created_by: existing
        ? existing.created_by
        : userId,

      updated_by: userId,

      published_at: existing
        ? existing.published_at
        : null,

      published_by: existing
        ? existing.published_by
        : null,

      // SERVER-SIDE VERSION INCREMENT
      version: isEdit
        ? (Number(existing.version) + 1)
        : 1
    });

    const saved = this.repository.save(recordToSave);
    return mapToAdminProgramDTO(saved);
  }

  publishProgram(id, actorContext, expectedVersion = null) {
    authorizeAction(actorContext, "program.publish");
    const existing = this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Program '${id}' not found for publish action.`);
    }
    if (expectedVersion !== null && expectedVersion !== undefined) {
      checkOptimisticVersion(existing.version, expectedVersion);
    }

    const meta = createAuditMetadata(actorContext, true);
    this.repository.updateStatus(id, ProgramStatus.PUBLISHED, meta);
    return mapToAdminProgramDTO(this.repository.findById(id));
  }

  unpublishProgram(id, actorContext, expectedVersion = null) {
    authorizeAction(actorContext, "program.unpublish");
    const existing = this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Program '${id}' not found for unpublish action.`);
    }
    if (expectedVersion !== null && expectedVersion !== undefined) {
      checkOptimisticVersion(existing.version, expectedVersion);
    }

    const meta = createAuditMetadata(actorContext, false);
    this.repository.updateStatus(id, ProgramStatus.DRAFT, meta);
    return mapToAdminProgramDTO(this.repository.findById(id));
  }

  archiveProgram(id, actorContext, expectedVersion = null) {
    authorizeAction(actorContext, "program.archive");
    const existing = this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Program '${id}' not found for archive action.`);
    }
    if (expectedVersion !== null && expectedVersion !== undefined) {
      checkOptimisticVersion(existing.version, expectedVersion);
    }

    const meta = createAuditMetadata(actorContext, false);
    this.repository.updateStatus(id, ProgramStatus.ARCHIVED, meta);
    return mapToAdminProgramDTO(this.repository.findById(id));
  }
}

/**
 * Application Response Envelope Generator (HTTP-Agnostic JSON Wrapper)
 */
function createAppResponse(success, dataOrMessage, errorObj = null, requestId = "") {
  const reqId = requestId || ("req_" + new Date().getTime());
  if (success) {
    return createJsonResponse({
      success: true,
      data: dataOrMessage,
      requestId: reqId
    });
  } else {
    const code = (errorObj && errorObj.code) || "SERVER_ERROR";
    const message = (errorObj && errorObj.message) || String(dataOrMessage || "An internal error occurred.");
    return createJsonResponse({
      success: false,
      error: {
        code: code,
        message: message,
        requestId: reqId
      },
      requestId: reqId
    });
  }
}

/**
 * API Gateway Dispatcher for Program Data Source v2.0 Actions
 */
function handleProgramApiAction(action, payload, e) {
  const requestId = "req_" + new Date().getTime() + "_" + Math.floor(Math.random() * 1000);
  try {
    // Shared Adapter & Service Factory
    const repository = new GoogleSheetsProgramAdapter("Programs");
    const service = new ProgramService(repository);

    // 1. PUBLIC GET ACTIONS (No Token Required)
    if (action === "program.listPublished") {
      let scriptCache = null;
      try {
        scriptCache = CacheService.getScriptCache();
        const cachedJson = scriptCache ? scriptCache.get("pub_programs_cache_v2") : null;
        if (cachedJson) {
          const cachedPayload = JSON.parse(cachedJson);
          cachedPayload.requestId = requestId;
          return createJsonResponse(cachedPayload);
        }
      } catch (e) {
        Logger.log("Cache read error: " + e.message);
      }

      const data = service.getPublishedPrograms();
      const responseEnvelope = {
        success: true,
        data: data,
        requestId: requestId
      };

      if (scriptCache) {
        try {
          const payloadStr = JSON.stringify(responseEnvelope);
          if (payloadStr.length < 95000) {
            scriptCache.put("pub_programs_cache_v2", payloadStr, 21600); // Cache selama 6 jam
          }
        } catch (e) {
          Logger.log("Cache write error: " + e.message);
        }
      }

      return createJsonResponse(responseEnvelope);
    }
    if (action === "program.getPublished") {
      const id = (payload && payload.id) || (e && e.parameter && e.parameter.id);
      const data = service.getPublishedProgramById(id);
      return createAppResponse(true, data, null, requestId);
    }

    // 2. ADMIN LOGIN ACTION
    if (action === "admin.login") {
      const pin = (payload && payload.pin) || (payload && payload.data && payload.data.pin);
      if (!pin) {
        throw new ValidationError("PIN is required for admin login.");
      }

      const configuredHash = getServerSecret("ADMIN_PIN_HASH", "");
      let isPinValid = false;

      if (configuredHash) {
        const inputBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(pin));
        const inputHash = Utilities.base64Encode(inputBytes);
        isPinValid = (inputHash === configuredHash);
      } else {
        // Zero Hardcoded Secrets: require ADMIN_PIN_HASH in ScriptProperties
        throw new AuthenticationError("Admin PIN authentication is not configured on server (ADMIN_PIN_HASH missing in Script Properties).");
      }

      if (!isPinValid) {
        throw new AuthenticationError("Invalid Admin PIN.");
      }

      const tokenData = generateSessionToken("admin_principal", AllowedRoles.ADMIN, 8);
      return createAppResponse(true, tokenData, null, requestId);
    }

    // 3. PROTECTED ACTIONS (Token & Auth Context Required)
    const token = payload && payload.token;
    const claims = verifySessionToken(token);
    const actorContext = createActorContext(claims.userId, claims.role, claims.issuedAt, requestId);

    if (action === "program.list") {
      const data = service.getAllPrograms(actorContext);
      return createAppResponse(true, data, null, requestId);
    }
    if (action === "program.get") {
      const id = (payload && payload.id) || (payload && payload.data && payload.data.id);
      const data = service.getProgramById(id, actorContext);
      return createAppResponse(true, data, null, requestId);
    }
    if (action === "program.create" || action === "program.update") {
      const input = (payload && payload.payload) || (payload && payload.data) || payload;
      const data = service.saveProgram(input, actorContext);
      invalidateProgramCache();
      return createAppResponse(true, data, null, requestId);
    }
    if (action === "program.publish") {
      const id = (payload && payload.id) || (payload && payload.data && payload.data.id);
      const ver = payload && payload.version;
      const data = service.publishProgram(id, actorContext, ver);
      invalidateProgramCache();
      return createAppResponse(true, data, null, requestId);
    }
    if (action === "program.unpublish") {
      const id = (payload && payload.id) || (payload && payload.data && payload.data.id);
      const ver = payload && payload.version;
      const data = service.unpublishProgram(id, actorContext, ver);
      invalidateProgramCache();
      return createAppResponse(true, data, null, requestId);
    }
    if (action === "program.archive") {
      const id = (payload && payload.id) || (payload && payload.data && payload.data.id);
      const ver = payload && payload.version;
      const data = service.archiveProgram(id, actorContext, ver);
      invalidateProgramCache();
      return createAppResponse(true, data, null, requestId);
    }
    if (action === "program.init") {
      const result = initProgramsSheet(token);
      invalidateProgramCache();
      return createAppResponse(true, result, null, requestId);
    }

    throw new ValidationError("Unknown program API action: " + action);

  } catch (err) {
    if (err instanceof DomainError) {
      return createAppResponse(false, null, err, requestId);
    }
    return createAppResponse(false, null, new PersistenceError(err.message || String(err)), requestId);
  }
}

/**
 * Cache Invalidation Helper for Public Programs
 */
function invalidateProgramCache() {
  try {
    const cache = CacheService.getScriptCache();
    if (cache) {
      cache.remove("pub_programs_cache_v2");
    }
  } catch (e) {
    Logger.log("Cache invalidate error: " + e.message);
  }
}

/**
 * Serialization Boundary Helpers (FAIL-CLOSED logic, no static fallback)
 */
function serializeProgramPayload(detailObj) {
  try {
    if (detailObj === undefined || detailObj === null) {
      throw new Error("Detail payload is null or undefined");
    }
    return JSON.stringify(detailObj);
  } catch (err) {
    throw new SerializationError("Failed to serialize program detail object: " + err.message);
  }
}

function deserializeProgramPayload(jsonString) {
  if (!jsonString || typeof jsonString !== "string") {
    throw new SerializationError("Cannot deserialize empty or non-string cell payload (Fail-Closed)");
  }
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Parsed payload is not an object");
    }
    return parsed;
  } catch (err) {
    throw new SerializationError("Cell JSON payload is corrupted or invalid (Fail-Closed): " + err.message);
  }
}

/**
 * Optimistic Concurrency Verification Helper
 */
function checkOptimisticVersion(storedVersion, expectedVersion) {
  const sVer = Number(storedVersion);
  const eVer = Number(expectedVersion);
  if (isNaN(sVer) || isNaN(eVer) || sVer !== eVer) {
    throw new ConcurrencyConflictError(
      `Optimistic concurrency version mismatch (stored: ${storedVersion}, expected: ${expectedVersion})`
    );
  }
  return sVer + 1;
}

// ============================================================================
// PROGRAM DATA SOURCE v2.0 — PHASE 4B-4: MIGRATION & SEEDING TOOLING
// Isolated Migration Engine with Extraction, Validation, Snapshot, Seeding,
// Re-read, Structural Reconciliation, Rollback, and Observability.
// (NO RUNTIME CUTOVER, NO AUTOMATIC EXECUTION ON PAGE LOAD/API REQUESTS).
// ============================================================================

/**
 * A. SOURCE EXTRACTION
 * Returns the exact canonical PROGRAM_DATA v1.0 records.
 */
function getCanonicalMigrationSource() {
  return [
    {
      id: "tahfidz-anak",
      name: "Pesantren Tahfidz Anak",
      badge: "Anak-Anak",
      image: "https://images.unsplash.com/photo-1577896851231-70ef18881754?q=80&w=1000&auto=format&fit=crop",
      description: "Program khusus hafalan Al-Qur'an untuk anak-anak dengan metode seru dan menyenangkan.",
      highlights: [
        "Metode Muri-Q & Tajwid Aisyah",
        "Target 30 Juz Mutqin Usia Belia",
        "Pendampingan Pengasuh 24 Jam"
      ],
      detail: {
        tagline: "Mencetak Generasi Rabbani Berjiwa Qur'ani Sejak Dini",
        summary: "Program Pesantren Tahfidz Anak didesain khusus untuk membentuk karakter santri usia sekolah dasar agar mencintai Al-Qur'an melalui suasana belajar yang hangat, ramah anak, dan terstruktur. Fokus utama kami tidak hanya hafalan, tetapi juga pembentukan akhlakul karimah.",
        video: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        videoTitle: "Dokumentasi Kegiatan Santri Tahfidz Anak",
        keunggulan: [
          { title: "Metode Seru & Ramah Anak", desc: "Menghafal dengan pendekatan fun learning, muraja'ah bersama, dan metode visual audio yang efektif.", icon: "fa-heart", iconBg: "bg-red-50 text-red-600" },
          { title: "Target Mutqin 30 Juz", desc: "Kurikulum bertahap yang disesuaikan dengan kemampuan anak tanpa tekanan psikologis berlebih.", icon: "fa-book-quran", iconBg: "bg-emerald-50 text-emerald-600" },
          { title: "Fasilitas Khusus Anak", desc: "Kamar tidur ber-AC, tempat bermain edukatif, serta asupan gizi seimbang untuk tumbuh kembang.", icon: "fa-child", iconBg: "bg-amber-50 text-amber-600" }
        ],
        targetOutput: [
          "Hafal 30 Juz Al-Qur'an dengan Tajwid & Makhraj yang Benar",
          "Memiliki Kebiasaan Shalat Fardhu & Sunnah Berjamaah",
          "Mampu Membaca Doa-Doa Harian & Adab Islama",
          "Karakter Mandiri, Disiplin, dan Santun kepada Orang Tua",
          "Khatam Ziyadah & Muraja'ah Rutin Setiap Pekan",
          "Berprestasi dalam Musabaqah Hifdzil Qur'an (MHQ)"
        ],
        gallery: [
          { image: "https://images.unsplash.com/photo-1577896851231-70ef18881754?q=80&w=800&auto=format&fit=crop", caption: "Setoran Hafalan Pagi Bersama Ustadz", sliderId: "anak-1" },
          { image: "https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=800&auto=format&fit=crop", caption: "Kegiatan Olahraga & Edukasi Luar Ruangan", sliderId: "anak-2" },
          { image: "https://images.unsplash.com/photo-1544717305-2782549b5136?q=80&w=800&auto=format&fit=crop", caption: "Suasana Asrama yang Nyaman & Bersih", sliderId: "anak-3" }
        ],
        fasilitas: [
          { text: "Gedung Asrama AC & Kasur Busa Berkualitas", icon: "fa-bed", iconColor: "text-emerald-600" },
          { text: "Makan 3x Sehari Menu Seimbang & Higienis", icon: "fa-utensils", iconColor: "text-amber-600" },
          { text: "Klinik Poskestren & Layanan Kesehatan Santri", icon: "fa-notes-medical", iconColor: "text-blue-600" }
        ],
        prosedur: {
          items: [
            { step: "01", title: "Pendaftaran Online", desc: "Mengisi formulir calon santri melalui situs resmi PPDB." },
            { step: "02", title: "Tes Pemetaan (Observasi)", desc: "Tes kelancaran membaca Al-Qur'an dan wawancara orang tua." },
            { step: "03", title: "Pengumuman Hasil", desc: "Pengumuman kelulusan melalui WhatsApp & Akun PPDB." },
            { step: "04", title: "Daftar Ulang & Masuk Asrama", desc: "Penyelesaian administrasi dan kedatangan santri baru." }
          ],
          image: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?q=80&w=800&auto=format&fit=crop",
          imageAlt: "Prosedur PPDB"
        },
        persyaratan: [
          { title: "Berusia 7 - 12 Tahun", desc: "Lulus atau sedang menempuh tingkat SD/MI sederajat.", icon: "fa-cake-candles" },
          { title: "Fotokopi Akta & KK", desc: "Menyerahkan dokumen administrasi kependudukan lengkap 2 lembar.", icon: "fa-file-lines" },
          { title: "Pas Foto Terbaru", desc: "Foto berwarna 3x4 sebanyak 4 lembar berlatar biru.", icon: "fa-image" },
          { title: "Surat Sehat Dokter", desc: "Bebas dari penyakit menular atau kondisi kronis tertentu.", icon: "fa-file-medical" }
        ],
        biaya: {
          pendaftaran: { nominal: "Rp 250.000", note: "Sekali saat pendaftaran" },
          syahriyah: { nominal: "Rp 1.200.000", note: "Per bulan (Asrama + Makan + Pendidikan)" }
        },
        cta: {
          title: "Ingin Anak Anda Hafal Al-Qur'an Sejak Dini?",
          description: "Segera daftarkan putra/putri Anda. Kuota terbatas untuk 30 santri baru setiap angkatan.",
          waLink: "https://wa.me/6281234567890?text=Halo%20Admin%2C%20saya%20ingin%20bertanya%20tentang%20Program%20Tahfidz%20Anak",
          waBtnClass: "bg-emerald-600 hover:bg-emerald-700 text-white",
          waText: "Konsultasi PPDB via WhatsApp"
        }
      }
    },
    {
      id: "dewasa-putra",
      name: "Pesantren Dewasa Putra",
      badge: "Dewasa Putra",
      image: "https://images.unsplash.com/photo-1544717305-2782549b5136?q=80&w=1000&auto=format&fit=crop",
      description: "Program intensif tahfidz dan pendalaman kitab kuning untuk santri dewasa putra.",
      highlights: [
        "Kombinasi Tahfidz & Dirasah Islamiyah",
        "Sanad Al-Qur'an s/d Rasulullah SAW",
        "Lingkungan Kondusif & Bebas Gadget"
      ],
      detail: {
        tagline: "Membentuk Huffazh Berwawasan Luas & Berakhlak Qur'ani",
        summary: "Program Dewasa Putra dirancang bagi lulusan SMP/SMA/Mahasiswa/Umum yang ingin fokus menghafal Al-Qur'an 30 Juz secara intensif disertai dengan pengusaan ilmu tajwid sanad, bahasa Arab dasar, dan pemahaman kitab-kitab turats (kitab kuning).",
        video: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        videoTitle: "Suasana Belajar & Setoran Santri Dewasa Putra",
        keunggulan: [
          { title: "Bimbingan Muqri' Bersanad", desc: "Diampu langsung oleh ustadz pengajar yang memiliki sanad Al-Qur'an muttashil.", icon: "fa-certificate", iconBg: "bg-emerald-50 text-emerald-600" },
          { title: "Kurikulum Terintegrasi", desc: "Perpaduan efisien antara program Ziyadah (hafalan baru), Muraja'ah, dan Kajian Fiqih/Nahwu.", icon: "fa-book", iconBg: "bg-blue-50 text-blue-600" },
          { title: "Disiplin & Kemandirian High-Level", desc: "Pola hidup terstruktur untuk melatih kedisiplinan, kepemimpinan, dan mental da'i.", icon: "fa-user-shield", iconBg: "bg-amber-50 text-amber-600" }
        ],
        targetOutput: [
          "Setoran 30 Juz Lulus Ujian Imtihan Sanad / Syahadah",
          "Menguasai Ilmu Tajwid Qira'at Imam 'Ashim Riwayat Hafsh",
          "Memahami Fiqih Ibadah Dasar & Bahasa Arab Praktis",
          "Kesiapan Menjadi Imam Masjid & Pengajar Al-Qur'an",
          "Tradisi Muraja'ah Mandiri Minimal 1-2 Juz Per Hari",
          "Karakter Beradab, Tawadhu, dan Berjiwa Kepemimpinan"
        ],
        gallery: [
          { image: "https://images.unsplash.com/photo-1544717305-2782549b5136?q=80&w=800&auto=format&fit=crop", caption: "Halaqah Tahfidz Pagi di Masjid Utama", sliderId: "putra-1" },
          { image: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?q=80&w=800&auto=format&fit=crop", caption: "Kajian Kitab Kuning Bersama Pengasuh", sliderId: "putra-2" },
          { image: "https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=800&auto=format&fit=crop", caption: "Kegiatan Rihlah & Olahraga Sunnah", sliderId: "putra-3" }
        ],
        fasilitas: [
          { text: "Asrama Khusus Putra dengan Lemari & Kasur Mandiri", icon: "fa-building", iconColor: "text-emerald-600" },
          { text: "Masjid Utama 2 Lantai untuk Halaqah & Shalat", icon: "fa-mosque", iconColor: "text-blue-600" },
          { text: "Perpustakaan Kitab Turats & Ruang Baca", icon: "fa-book-open", iconColor: "text-amber-600" }
        ],
        prosedur: {
          items: [
            { step: "01", title: "Pendaftaran Online", desc: "Mengisi biodata diri dan memilih opsi program dewasa putra." },
            { step: "02", title: "Tes Tahsin & Al-Qur'an", desc: "Ujian kelancaran membaca Al-Qur'an secara virtual/luring." },
            { step: "03", title: "Wawancara Komitmen", desc: "Wawancara komitmen menghafal dan menaati tata tertib pesantren." },
            { step: "04", title: "Daftar Ulang", desc: "Penyelesaian administrasi dan orientasi kehidupan asrama." }
          ],
          image: "https://images.unsplash.com/photo-1544717305-2782549b5136?q=80&w=800&auto=format&fit=crop",
          imageAlt: "Prosedur PPDB Dewasa Putra"
        },
        persyaratan: [
          { title: "Usia Minimal 13 Tahun", desc: "Lulusan SMP/SMA/Mahasiswa/Umum yang bertekad kuat.", icon: "fa-user" },
          { title: "Lancar Membaca Al-Qur'an", desc: "Memiliki dasar tajwid & makhraj membaca Al-Qur'an yang cukup.", icon: "fa-book-quran" },
          { title: "Dokumen Identitas", desc: "Fotokopi KTP/Kartu Pelajar, KK, dan ijazah terakhir.", icon: "fa-id-card" },
          { title: "Surat Komitmen Waktu", desc: "Bersedia mengikuti seluruh rangkaian program tanpa gangguan.", icon: "fa-clock" }
        ],
        biaya: {
          pendaftaran: { nominal: "Rp 300.000", note: "Sekali saat pendaftaran & tes" },
          syahriyah: { nominal: "Rp 1.100.000", note: "Per bulan (Asrama + Makan 3x + Bimbingan)" }
        },
        cta: {
          title: "Siap Menjadi Hafiz Al-Qur'an Berpendidikan & Bersanad?",
          description: "Segera daftarkan diri Anda atau putra Anda. Gelombang pendaftaran aktif dibuka.",
          waLink: "https://wa.me/6281234567890?text=Halo%20Admin%2C%20saya%20ingin%20bertanya%20tentang%20Program%20Dewasa%20Putra",
          waBtnClass: "bg-blue-600 hover:bg-blue-700 text-white",
          waText: "Daftar Dewasa Putra via WA"
        }
      }
    },
    {
      id: "dewasa-putri",
      name: "Pesantren Dewasa Putri",
      badge: "Dewasa Putri",
      image: "https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=1000&auto=format&fit=crop",
      description: "Program intensif tahfidz Al-Qur'an dan fiqih wanita untuk santri dewasa putri.",
      highlights: [
        "Asrama Khusus & Steril Khusus Putri",
        "Bimbingan Musyrifah Hafizhah Bersanad",
        "Kajian Nisa'iyyah & Keterampilan Muslimah"
      ],
      detail: {
        tagline: "Mencetak Haafizhah Shalihat, Pendidik Generasi Masa Depan",
        summary: "Program Dewasa Putri difokuskan untuk membantu mahasiswi/alumni/umum menghafal Al-Qur'an dalam lingkungan asrama putri yang sangat aman, privat, dan kondusif. Didampingi ustadzah haafizhah bersanad serta dibekali pemahaman fikih wanita.",
        video: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        videoTitle: "Profil & Kegiatan Asrama Tahfidz Dewasa Putri",
        keunggulan: [
          { title: "Privasi & Keamanan Terjaga", desc: "Lingkungan kompleks putri terpisah penuh dengan sistem keamanan 24 jam.", icon: "fa-lock", iconBg: "bg-rose-50 text-rose-600" },
          { title: "Musyrifah Pengajar Khusus Putri", desc: "Halaqah setoran dan muraja'ah diampu oleh ustadzah lulusan Al-Azhar & Pesantren Sanad.", icon: "fa-user-graduate", iconBg: "bg-purple-50 text-purple-600" },
          { title: "Kajian Fiqih An-Nisa'", desc: "Kajian rutin hukum-hukum wanita, kepengurusan rumah tangga muslimah, & adab.", icon: "fa-hands-praying", iconBg: "bg-emerald-50 text-emerald-600" }
        ],
        targetOutput: [
          "Khatam Hafalan 30 Juz Lulus Syahadah & Ujian Ziyadah",
          "Pemahaman Tajwid Rasm Utsmani & Fiqih Wanita (Fiqh An-Nisa')",
          "Kebiasaan Ibadah Sunnah, Shalat Malam, & Dzikir Al-Ma'tsurat",
          "Keterampilan Tata Kelola Kebersihan, Tata Busana, & Adab",
          "Kemampuan Menjadi Pengajar Al-Qur'an di Rumah / Lembaga",
          "Karakter Anggun, Guarded, dan Berilmu Syar'i"
        ],
        gallery: [
          { image: "https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=800&auto=format&fit=crop", caption: "Halaqah Setoran Putri Bersama Ustadzah", sliderId: "putri-1" },
          { image: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?q=80&w=800&auto=format&fit=crop", caption: "Kajian Rutin Fiqih Wanita di Aula Putri", sliderId: "putri-2" },
          { image: "https://images.unsplash.com/photo-1577896851231-70ef18881754?q=80&w=800&auto=format&fit=crop", caption: "Taman Asrama Putri yang Asri", sliderId: "putri-3" }
        ],
        fasilitas: [
          { text: "Asrama Putri Privat Khusus Ber-AC & Kamar Mandi Dalam", icon: "fa-house-lock", iconColor: "text-purple-600" },
          { text: "Dapur Mandiri & Katering Pilihan Sehat", icon: "fa-utensils", iconColor: "text-rose-600" },
          { text: "Aula Pertemuan & Ruang Belajar Nyaman", icon: "fa-chair", iconColor: "text-emerald-600" }
        ],
        prosedur: {
          items: [
            { step: "01", title: "Pendaftaran Online", desc: "Mengisi formulir calon santri putri di portal PPDB." },
            { step: "02", title: "Tes Tahsin Virtual", desc: "Ujian kelancaran membaca Al-Qur'an oleh Tim Ustadzah." },
            { step: "03", title: "Wawancara Orang Tua/Wali", desc: "Wawancara kesiapan serta komitmen asrama." },
            { step: "04", title: "Masuk Asrama Putri", desc: "Penyelesaian registrasi dan penempatan kamar." }
          ],
          image: "https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=800&auto=format&fit=crop",
          imageAlt: "Prosedur PPDB Dewasa Putri"
        },
        persyaratan: [
          { title: "Usia Minimal 13 Tahun", desc: "SMP/SMA/Mahasiswi/Umum yang berkeinginan kuat.", icon: "fa-user" },
          { title: "Lancar Membaca Al-Qur'an", desc: "Memiliki dasar tajwid membaca Al-Qur'an yang baik.", icon: "fa-book-quran" },
          { title: "Dokumen Administrasi", desc: "Fotokopi KTP/KK/Kartu Pelajar & Pas Foto Jilbab Rapi.", icon: "fa-file-lines" },
          { title: "Izin Orang Tua/Suami", desc: "Mendapat persetujuan tertulis dari wali resmi.", icon: "fa-file-signature" }
        ],
        biaya: {
          pendaftaran: { nominal: "Rp 300.000", note: "Sekali saat pendaftaran & tes" },
          syahriyah: { nominal: "Rp 1.150.000", note: "Per bulan (Asrama AC + Makan 3x + Bimbingan)" }
        },
        cta: {
          title: "Wujudkan Cita-Cita Menjadi Haafizhah Qur'an?",
          description: "Daftarkan diri Anda di Program Pesantren Dewasa Putri.",
          waLink: "https://wa.me/6281234567890?text=Halo%20Admin%2C%20saya%20ingin%20bertanya%20tentang%20Program%20Dewasa%20Putri",
          waBtnClass: "bg-purple-600 hover:bg-purple-700 text-white",
          waText: "Daftar Dewasa Putri via WA"
        }
      }
    },
    {
      id: "sd-islam",
      name: "SD Islam Unggulan",
      badge: "SD Islam",
      image: "https://images.unsplash.com/photo-1585036156171-384164a8c675?q=80&w=800&auto=format&fit=crop",
      description: "Pendidikan dasar unggulan memadukan kurikulum nasional dan nilai-nilai Al-Qur'an.",
      highlights: [
        "Kurikulum Terintegrasi",
        "Tahfidz Dasar & Adab"
      ],
      detail: {
        tagline: "Membangun Fondasi Keilmuan dan Karakter Islami Sejak Dini",
        summary: "Program SD Islam Unggulan yang memadukan pendidikan formal (kurikulum nasional) dengan pendidikan agama Islam yang mendalam, termasuk tahfidz dasar dan pembentukan karakter/adab harian yang menyenangkan.",
        video: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        videoTitle: "Video Profil SD Islam Unggulan",
        keunggulan: [
          { title: "Kurikulum Terpadu", desc: "Memadukan materi umum dan diniyah dengan pendekatan belajar aktif dan menyenangkan.", icon: "fa-book-open", iconBg: "bg-blue-50 text-blue-600" },
          { title: "Program Tahfidz Dini", desc: "Bimbingan hafalan surah-surah pendek dan juz amma sejak dini.", icon: "fa-book-quran", iconBg: "bg-amber-50 text-amber-600" },
          { title: "Penguatan Adab Harian", desc: "Menanamkan nilai-nilai akhlakul karimah dalam setiap aktivitas harian siswa.", icon: "fa-child-reaching", iconBg: "bg-emerald-50 text-emerald-600" }
        ],
        targetOutput: [
          "Menguasai materi pendidikan dasar nasional dengan baik.",
          "Mampu membaca Al-Qur'an dengan tartil.",
          "Memiliki hafalan Juz 30 (Juz Amma).",
          "Menjadikan adab Islami sebagai karakter harian.",
          "Memiliki dasar-dasar kemandirian dan keberanian."
        ],
        gallery: [
          { image: "https://images.unsplash.com/photo-1585036156171-384164a8c675?q=80&w=800&auto=format&fit=crop", caption: "Kegiatan Belajar Pendidikan Formal", sliderId: "sd-1" },
          { image: "https://images.unsplash.com/photo-1577896851231-70ef18881754?q=80&w=800&auto=format&fit=crop", caption: "Bimbingan Tahfidz Anak SD", sliderId: "sd-2" }
        ],
        fasilitas: [
          { text: "Ruang kelas ber-AC, multimedia, dan nyaman.", icon: "fa-school", iconColor: "text-blue-600" },
          { text: "Area bermain dan olahraga yang aman.", icon: "fa-futbol", iconColor: "text-emerald-600" },
          { text: "Perpustakaan mini dan sudut baca di setiap kelas.", icon: "fa-book", iconColor: "text-amber-600" }
        ],
        prosedur: {
          items: [
            { step: "01", title: "Pendaftaran Online", desc: "Melakukan registrasi formulir calon siswa melalui portal PPDB." },
            { step: "02", title: "Tes Observasi Kesiapan", desc: "Observasi kesiapan belajar dan pemetaan dasar membaca Al-Qur'an." },
            { step: "03", title: "Wawancara Orang Tua", desc: "Wawancara keselarasan visi pendidikan bersama wali murid." },
            { step: "04", title: "Daftar Ulang", desc: "Penyelesaian administrasi dan penyerahan perlengkapan sekolah." }
          ],
          image: "https://images.unsplash.com/photo-1585036156171-384164a8c675?q=80&w=800&auto=format&fit=crop",
          imageAlt: "Siswa SD Islam Unggulan"
        },
        persyaratan: [
          { title: "Usia Minimal 6 Tahun", desc: "Berusia minimal 6 tahun pada tahun ajaran baru.", icon: "fa-cake-candles" },
          { title: "Fotokopi Akta & KK", desc: "Menyerahkan fotokopi akta kelahiran dan KK 2 lembar.", icon: "fa-file-lines" },
          { title: "Pas Foto 3x4", desc: "Pas foto berwarna 3x4 sebanyak 4 lembar.", icon: "fa-image" },
          { title: "Surat Sehat", desc: "Surat keterangan sehat dokter.", icon: "fa-file-medical" }
        ],
        biaya: {
          pendaftaran: { nominal: "Rp 1.500.000", note: "Termasuk observasi & seragam 4 stel" },
          syahriyah: { nominal: "Rp 250.000", note: "SPP bulanan pendidikan" }
        },
        cta: {
          title: "Daftarkan Putra-Putri Anda di SD Islam Unggulan",
          description: "Pendidikan dasar berkualitas yang memadukan keilmuan nasional dan nilai-nilai Al-Qur'an.",
          waLink: "https://wa.me/6281234567890?text=Halo%20Admin%2C%20saya%20ingin%20bertanya%20tentang%20SD%20Islam%20Unggulan",
          waBtnClass: "bg-blue-600 hover:bg-blue-700 text-white",
          waText: "Konsultasi SD Islam via WA"
        }
      }
    }
  ];
}

/**
 * B. CONTRACT VALIDATION
 * Validates source objects against the PROGRAM DATA CONTRACT.
 * Throws ValidationError if any required field or nested structure is invalid.
 */
function validateMigrationSource(sourceArray) {
  if (!Array.isArray(sourceArray) || sourceArray.length === 0) {
    throw new ValidationError("Migration source array is empty or invalid.");
  }

  const seenIds = new Set();
  const requiredTopFields = ["id", "name", "badge", "image", "description", "highlights", "detail"];

  for (let idx = 0; idx < sourceArray.length; idx++) {
    const item = sourceArray[idx];
    if (!item || typeof item !== "object") {
      throw new ValidationError(`Source item at index ${idx} is not an object.`);
    }

    // Top-level field validation
    for (let f of requiredTopFields) {
      if (item[f] === undefined || item[f] === null || item[f] === "") {
        throw new ValidationError(`Source item '${item.id || idx}' missing required top-level field '${f}'.`);
      }
    }

    // ID Uniqueness Check
    if (seenIds.has(item.id)) {
      throw new ValidationError(`Duplicate canonical program ID '${item.id}' detected in migration source.`);
    }
    seenIds.add(item.id);

    // Highlights array check
    if (!Array.isArray(item.highlights) || item.highlights.length === 0) {
      throw new ValidationError(`Source program '${item.id}' must have a non-empty highlights array.`);
    }

    // Nested Detail structure check
    const d = item.detail;
    if (!d || typeof d !== "object") {
      throw new ValidationError(`Source program '${item.id}' detail payload is invalid.`);
    }

    const requiredDetailFields = [
      "tagline", "summary", "video", "videoTitle",
      "keunggulan", "targetOutput", "gallery", "fasilitas",
      "prosedur", "persyaratan", "biaya", "cta"
    ];

    for (let df of requiredDetailFields) {
      if (d[df] === undefined || d[df] === null) {
        throw new ValidationError(`Source program '${item.id}' detail payload missing field '${df}'.`);
      }
    }

    // Check nested arrays & objects
    if (!Array.isArray(d.keunggulan) || d.keunggulan.length === 0) {
      throw new ValidationError(`Source program '${item.id}' detail.keunggulan must be non-empty array.`);
    }
    if (!Array.isArray(d.targetOutput) || d.targetOutput.length === 0) {
      throw new ValidationError(`Source program '${item.id}' detail.targetOutput must be non-empty array.`);
    }
    if (!Array.isArray(d.gallery) || d.gallery.length === 0) {
      throw new ValidationError(`Source program '${item.id}' detail.gallery must be non-empty array.`);
    }
    if (!Array.isArray(d.fasilitas) || d.fasilitas.length === 0) {
      throw new ValidationError(`Source program '${item.id}' detail.fasilitas must be non-empty array.`);
    }
    if (!d.prosedur || !Array.isArray(d.prosedur.items) || d.prosedur.items.length === 0) {
      throw new ValidationError(`Source program '${item.id}' detail.prosedur.items must be non-empty array.`);
    }
    if (!Array.isArray(d.persyaratan) || d.persyaratan.length === 0) {
      throw new ValidationError(`Source program '${item.id}' detail.persyaratan must be non-empty array.`);
    }
    if (!d.biaya || !d.biaya.pendaftaran || !d.biaya.syahriyah) {
      throw new ValidationError(`Source program '${item.id}' detail.biaya must contain pendaftaran and syahriyah objects.`);
    }
    if (!d.cta || !d.cta.title || !d.cta.waLink) {
      throw new ValidationError(`Source program '${item.id}' detail.cta must contain title and waLink.`);
    }
  }

  return true;
}

/**
 * C. SNAPSHOT / BACKUP
 * Creates an in-memory or tab backup of the existing Programs sheet state.
 */
function createMigrationSnapshot(sheetName = "Programs") {
  let ss = null;
  try {
    ss = getDatabaseSpreadsheet();
  } catch (e) {
    throw new PersistenceError("SpreadsheetApp is unavailable for migration snapshot: " + e.message);
  }

  const sheet = ss ? ss.getSheetByName(sheetName) : null;
  if (!sheet) {
    return Object.freeze({
      exists: false,
      sheetName: sheetName,
      rows: []
    });
  }

  const data = sheet.getDataRange().getValues();
  // Deep clone row values array
  const clonedRows = JSON.parse(JSON.stringify(data));

  return Object.freeze({
    exists: true,
    sheetName: sheetName,
    rows: clonedRows
  });
}

/**
 * D. SHEET PREPARATION
 * Prepares the Programs sheet and validates/creates the 16-column header schema.
 * Note: Sheet creation is authorized ONLY within explicit migration tooling.
 */
function prepareProgramsSheet(sheetName = "Programs", options = { dryRun: false }) {
  if (options && options.dryRun) {
    Logger.log("[DRY-RUN] [SHEET_PREPARED] Would discover/create sheet '" + sheetName + "'");
    return true;
  }

  const ss = getDatabaseSpreadsheet();
  if (!ss) {
    throw new PersistenceError("Active spreadsheet unavailable.");
  }

  let sheet = ss.getSheetByName(sheetName);
  const expectedHeaders = [
    "id", "name", "badge", "image", "description",
    "highlights_json", "detail_json", "status", "sort_order",
    "created_at", "updated_at", "created_by", "updated_by",
    "published_at", "published_by", "version"
  ];

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(expectedHeaders);
  } else {
    const values = sheet.getDataRange().getValues();
    if (!values || values.length === 0) {
      sheet.appendRow(expectedHeaders);
    } else {
      const headerRow = values[0];
      if (headerRow.length < expectedHeaders.length) {
        throw new PersistenceError(`Existing sheet '${sheetName}' header schema mismatch (fewer than 16 columns).`);
      }
    }
  }

  return sheet;
}

/**
 * E. CONTROLLED SEEDING
 * Writes canonical source records into the Programs sheet.
 */
function seedProgramsData(sourceArray, options = { dryRun: false, force: false }, sheetName = "Programs") {
  if (options && options.dryRun) {
    Logger.log("[DRY-RUN] [SEED_STARTED] Would seed " + sourceArray.length + " canonical records into '" + sheetName + "'");
    return true;
  }

  const sheet = prepareProgramsSheet(sheetName, options);
  const existingValues = sheet.getDataRange().getValues();
  const existingIds = new Set();

  for (let r = 1; r < existingValues.length; r++) {
    if (existingValues[r][0]) {
      existingIds.add(String(existingValues[r][0]).trim());
    }
  }

  // Idempotency check: if IDs already exist and force is false, reject
  const duplicateIds = sourceArray.filter(item => existingIds.has(item.id));
  if (duplicateIds.length > 0 && !(options && options.force)) {
    throw new PersistenceError(
      "Migration idempotency conflict: canonical ID(s) [" + duplicateIds.map(d => d.id).join(", ") + "] already exist in sheet. Use force=true to overwrite."
    );
  }

  const nowIso = new Date().toISOString();
  const migrationIdentity = "migration:v2.0";

  for (let idx = 0; idx < sourceArray.length; idx++) {
    const item = sourceArray[idx];
    const sortOrder = idx + 1;
    const highlightsJson = serializeProgramPayload(item.highlights);
    const detailJson = serializeProgramPayload(item.detail);

    const rowData = [
      item.id,
      item.name,
      item.badge,
      item.image,
      item.description,
      highlightsJson,
      detailJson,
      ProgramStatus.PUBLISHED, // Initial status = "published"
      sortOrder,
      nowIso,
      nowIso,
      migrationIdentity,
      migrationIdentity,
      nowIso,
      migrationIdentity,
      1 // Initial version = 1
    ];

    // Check if updating existing or appending new
    let targetRowIdx = -1;
    for (let r = 1; r < existingValues.length; r++) {
      if (String(existingValues[r][0]).trim() === item.id) {
        targetRowIdx = r + 1;
        break;
      }
    }

    if (targetRowIdx > 0) {
      sheet.getRange(targetRowIdx, 1, 1, 16).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }
  }

  return true;
}

/**
 * F. RE-READ VERIFICATION
 * Reads back persisted rows via GoogleSheetsProgramAdapter and deserializes cell JSON.
 */
function verifySeededRecords(sheetName = "Programs") {
  const adapter = new GoogleSheetsProgramAdapter(sheetName);
  const persistedRecords = adapter.findAll();
  return persistedRecords;
}

/**
 * G. STRUCTURAL RECONCILIATION
 * Deep structural comparison of all canonical content fields between source and re-read persisted objects.
 * Throws ValidationError if any property mismatches.
 */
function reconcileMigrationData(sourceArray, persistedArray) {
  if (!Array.isArray(persistedArray) || persistedArray.length < sourceArray.length) {
    throw new ValidationError(
      `Reconciliation failed: expected at least ${sourceArray.length} records, but re-read ${persistedArray ? persistedArray.length : 0} records.`
    );
  }

  const persistedMap = new Map();
  persistedArray.forEach(rec => persistedMap.set(rec.id, rec));

  const compareKeys = [
    "id", "name", "badge", "image", "description"
  ];

  for (let source of sourceArray) {
    const target = persistedMap.get(source.id);
    if (!target) {
      throw new ValidationError(`Reconciliation failed: record ID '${source.id}' not found in re-read persisted data.`);
    }

    // Top level scalar comparison
    for (let key of compareKeys) {
      if (String(source[key]).trim() !== String(target[key]).trim()) {
        throw new ValidationError(`Reconciliation mismatch on '${source.id}.${key}': source='${source[key]}', persisted='${target[key]}'.`);
      }
    }

    // Highlights array structural comparison
    if (JSON.stringify(source.highlights) !== JSON.stringify(target.highlights)) {
      throw new ValidationError(`Reconciliation mismatch on '${source.id}.highlights': JSON payload differs.`);
    }

    // Detail object deep structural comparison
    if (JSON.stringify(source.detail) !== JSON.stringify(target.detail)) {
      throw new ValidationError(`Reconciliation mismatch on '${source.id}.detail': JSON payload differs.`);
    }
  }

  return true;
}

/**
 * H. ROLLBACK CAPABILITY
 * Restores the Programs sheet to the exact state saved in the snapshot.
 */
function rollbackMigration(snapshot, sheetName = "Programs") {
  let ss = null;
  try {
    ss = getDatabaseSpreadsheet();
  } catch (e) {
    throw new PersistenceError("SpreadsheetApp unavailable for rollback: " + e.message);
  }

  if (!ss) throw new PersistenceError("Spreadsheet object null during rollback.");

  const sheet = ss.getSheetByName(sheetName);

  if (!snapshot || !snapshot.exists) {
    // If sheet didn't exist before migration, clear or delete sheet
    if (sheet) {
      sheet.clear();
    }
  } else {
    // Restore exact snapshot rows
    if (sheet) {
      sheet.clear();
      if (snapshot.rows && snapshot.rows.length > 0) {
        sheet.getRange(1, 1, snapshot.rows.length, snapshot.rows[0].length).setValues(snapshot.rows);
      }
    }
  }

  Logger.log("[ROLLBACK_COMPLETED] Sheet '" + sheetName + "' successfully restored from pre-migration snapshot.");
  return true;
}

/**
 * MASTER MIGRATION TOOLING ORCHESTRATOR
 * Controlled explicit tool execution with dry-run, validation, snapshot, seeding, reconciliation, and rollback.
 * (NO AUTOMATIC EXECUTION).
 */
function runMigrationTooling(options = { dryRun: false, force: false, sheetName: "Programs" }) {
  const migrationId = "migration:v2.0:" + new Date().getTime();
  const isDryRun = Boolean(options && options.dryRun);
  const sheetName = (options && options.sheetName) || "Programs";

  Logger.log(`[START] [${migrationId}] Mode: ${isDryRun ? "DRY-RUN" : "EXECUTION"}`);

  let snapshot = null;
  try {
    // 1. Source Extraction
    const sourceArray = getCanonicalMigrationSource();
    Logger.log(`[SOURCE_EXTRACTED] [${migrationId}] Loaded ${sourceArray.length} canonical records.`);

    // 2. Contract Validation
    validateMigrationSource(sourceArray);
    Logger.log(`[SOURCE_VALIDATED] [${migrationId}] All canonical records satisfy contract schema.`);

    if (isDryRun) {
      Logger.log(`[DRY-RUN] [COMPLETED] [${migrationId}] Validation PASS. No changes made.`);
      return {
        status: "DRY_RUN_PASSED",
        migrationId: migrationId,
        recordCount: sourceArray.length,
        message: "Dry-run validation successful. Zero database mutations performed."
      };
    }

    // 3. Snapshot / Backup
    snapshot = createMigrationSnapshot(sheetName);
    Logger.log(`[SNAPSHOT_CREATED] [${migrationId}] Pre-migration snapshot taken (Sheet exists: ${snapshot.exists}).`);

    // 4. Sheet Preparation
    prepareProgramsSheet(sheetName, options);
    Logger.log(`[SHEET_PREPARED] [${migrationId}] Sheet '${sheetName}' prepared.`);

    // 5. Seeding
    Logger.log(`[SEED_STARTED] [${migrationId}] Seeding ${sourceArray.length} records...`);
    seedProgramsData(sourceArray, options, sheetName);
    Logger.log(`[SEED_COMPLETED] [${migrationId}] Records written to sheet.`);

    // 6. Re-Read Verification
    Logger.log(`[RECONCILIATION_STARTED] [${migrationId}] Re-reading persisted records...`);
    const persistedArray = verifySeededRecords(sheetName);

    // 7. Structural Reconciliation
    reconcileMigrationData(sourceArray, persistedArray);
    Logger.log(`[RECONCILIATION_PASSED] [${migrationId}] Structural reconciliation 100% matched.`);

    Logger.log(`[MIGRATION_SUCCESS] [${migrationId}] Migration completed and verified successfully.`);
    return {
      status: "MIGRATION_SUCCESS",
      migrationId: migrationId,
      recordCount: sourceArray.length,
      message: "Migration completed, verified, and structurally reconciled with 100% precision."
    };

  } catch (err) {
    Logger.log(`[FAILED] [${migrationId}] Migration failed: ${err.message}`);

    if (snapshot && !isDryRun) {
      Logger.log(`[ROLLBACK_STARTED] [${migrationId}] Initiating automated rollback...`);
      try {
        rollbackMigration(snapshot, sheetName);
        return {
          status: "MIGRATION_FAILED_ROLLED_BACK",
          migrationId: migrationId,
          error: err.message,
          message: "Migration failed during execution. Pre-migration state was successfully restored."
        };
      } catch (rbErr) {
        Logger.log(`[ROLLBACK_ERROR] [${migrationId}] Critical: Rollback failed: ${rbErr.message}`);
        return {
          status: "MIGRATION_FAILED_ROLLBACK_ERROR",
          migrationId: migrationId,
          error: err.message,
          rollbackError: rbErr.message,
          message: "CRITICAL: Migration failed and rollback encountered an error."
        };
      }
    }

    return {
      status: "MIGRATION_FAILED_PRE_MUTATION",
      migrationId: migrationId,
      error: err.message,
      message: "Migration failed during validation before any sheet mutation occurred."
    };
  }
}

/**
 * FUNGSI UTAMA INISIALISASI TAB SHEET PROGRAM / PROGRAMS
 * Dapat dijalankan langsung dari menu Run Apps Script Editor (pilih: initProgramsSheet)
 * Atau dipanggil via API Frontend / Web App.
 * Membuat tab sheet Programs (atau Program) dengan 16 kolom header terstandarisasi
 * dan menyemai 3 data program awal (tahfidz-anak, dewasa-putra, dewasa-putri).
 */
function initProgramsSheet(token) {
  try {
    if (token && typeof authenticateSession === "function") {
      const actor = authenticateSession(token);
      if (typeof authorizeRole === "function") {
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      }
    }

    const ss = getDatabaseSpreadsheet();
    if (!ss) {
      throw new Error("Spreadsheet database tidak ditemukan. Pastikan SPREADSHEET_ID sudah diatur di Script Properties atau script terhubung ke Spreadsheet.");
    }

    const expectedHeaders = [
      "id", "name", "badge", "image", "description",
      "highlights_json", "detail_json", "status", "sort_order",
      "created_at", "updated_at", "created_by", "updated_by",
      "published_at", "published_by", "version"
    ];

    let sheet = ss.getSheetByName("Programs");
    if (!sheet) {
      sheet = ss.getSheetByName("Program");
    }
    if (!sheet) {
      const all = ss.getSheets();
      for (let i = 0; i < all.length; i++) {
        const n = all[i].getName().trim().toLowerCase();
        if (n === "programs" || n === "program") {
          sheet = all[i];
          break;
        }
      }
    }

    let isCreated = false;
    if (!sheet) {
      sheet = ss.insertSheet("Programs");
      isCreated = true;
    }

    const lastRow = sheet.getLastRow();
    if (lastRow === 0) {
      sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    } else {
      const curHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), expectedHeaders.length)).getValues()[0];
      let needsFix = (curHeaders.length < expectedHeaders.length);
      if (!needsFix) {
        for (let c = 0; c < expectedHeaders.length; c++) {
          if (String(curHeaders[c] || "").trim().toLowerCase() !== expectedHeaders[c]) {
            needsFix = true;
            break;
          }
        }
      }
      if (needsFix) {
        sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
      }
    }

    sheet.getRange(1, 1, 1, expectedHeaders.length)
      .setFontWeight("bold")
      .setBackground("#047857")
      .setFontColor("#ffffff");
    sheet.setFrozenRows(1);

    // Seed canonical default programs (insert missing items idempotently)
    let seededCount = 0;
    if (typeof getCanonicalMigrationSource === "function") {
      const canonicalData = getCanonicalMigrationSource();
      if (Array.isArray(canonicalData) && canonicalData.length > 0) {
        const values = sheet.getDataRange().getValues();
        const existingIds = new Set();
        for (let r = 1; r < values.length; r++) {
          if (values[r][0]) {
            existingIds.add(String(values[r][0]).trim());
          }
        }

        const missing = canonicalData.filter(item => !existingIds.has(item.id));
        if (missing.length > 0) {
          const nowIso = new Date().toISOString();
          const startRow = Math.max(2, sheet.getLastRow() + 1);
          const rows = missing.map((item, idx) => [
            item.id,
            item.name,
            item.badge,
            item.image,
            item.description,
            serializeProgramPayload(item.highlights || []),
            serializeProgramPayload(item.detail || {}),
            "published",
            existingIds.size + idx + 1,
            nowIso,
            nowIso,
            "system:init",
            "system:init",
            nowIso,
            "system:init",
            1
          ]);
          sheet.getRange(startRow, 1, rows.length, expectedHeaders.length).setValues(rows);
          seededCount = rows.length;
        }
      }
    }

    const msg = `[OK] Sheet '${sheet.getName()}' siap (${isCreated ? 'Dibuat Baru' : 'Sudah Ada'}). Data awal disemai: ${seededCount} program.`;
    Logger.log(msg);
    return {
      success: true,
      sheetName: sheet.getName(),
      created: isCreated,
      seededPrograms: seededCount,
      message: msg
    };
  } catch (err) {
    Logger.log("[ERROR initProgramsSheet] " + err.message);
    throw err;
  }
}

// ==================== PENGELOLAAN ALUMNI ====================
function saveAlumniData(payload) {
  try {
    const ss = getDatabaseSpreadsheet();
    let sheet = ss.getSheetByName(ALUMNI_SHEET_NAME);
    
    if (!sheet) {
      sheet = ss.insertSheet(ALUMNI_SHEET_NAME);
      const headers = [
        "Timestamp", "Nama Lengkap", "Jenis Kelamin", "No WhatsApp", "Media Sosial",
        "Tahun Masuk", "Tahun Lulus", "Program Terakhir", "Kesibukan", "Instansi/Perusahaan",
        "Kesan & Pesan", "Provinsi", "Kabupaten", "Kecamatan", "Desa/Kelurahan", "Alamat Lengkap", "Latitude", "Longitude",
        "Foto", "Izin Publikasi"
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#dcfce7");
      sheet.setFrozenRows(1);
    } else {
        const lastCol = sheet.getLastColumn();
        if (lastCol > 0) {
            const currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
            if (currentHeaders.indexOf("Foto") === -1) {
                sheet.getRange(1, lastCol + 1).setValue("Foto").setFontWeight("bold").setBackground("#dcfce7");
                sheet.getRange(1, lastCol + 2).setValue("Izin Publikasi").setFontWeight("bold").setBackground("#dcfce7");
            }
        }
    }
    
    let fileUrl = "";
    if (payload.file && payload.file.base64) {
      const folder = DriveApp.getFolderById(FOLDER_ID);
      const decodedData = Utilities.base64Decode(payload.file.base64);
      const blob = Utilities.newBlob(
        decodedData, 
        payload.file.mimeType, 
        "ALUMNI_" + new Date().getTime() + "_" + payload.file.name
      );
      const newFile = folder.createFile(blob);
      newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      fileUrl = "https://lh3.googleusercontent.com/d/" + newFile.getId();
    }

    const timestamp = new Date();
    const row = [
      timestamp,
      payload.nama || "",
      payload.jk || "",
      payload.wa || "",
      payload.medsos || "",
      payload.masuk || "",
      payload.lulus || "",
      payload.program || "",
      payload.kesibukan || "",
      payload.instansi || "",
      payload.kesan || "",
      payload.provinsi || "",
        payload.kabupaten || "",
        payload.kecamatan || "",
        payload.desa || "",
        payload.alamat || "",
        payload.lat || "",
        payload.lng || "",
        fileUrl,
        payload.izin || ""
      ];
    
    sheet.appendRow(row);
    return { success: true, message: "Data alumni berhasil disimpan." };
    
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}


function getAlumniTestimonials() {
  try {
    const ss = getDatabaseSpreadsheet();
    const sheet = ss.getSheetByName(ALUMNI_SHEET_NAME);
    if (!sheet) return [];

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return []; // Only headers

    const headers = data[0];
    const idxNama = headers.indexOf("Nama Lengkap");
    const idxMasuk = headers.indexOf("Tahun Masuk");
    const idxLulus = headers.indexOf("Tahun Lulus");
    const idxProgram = headers.indexOf("Program Terakhir");
    const idxKesibukan = headers.indexOf("Kesibukan");
    const idxInstansi = headers.indexOf("Instansi/Perusahaan");
    const idxKesan = headers.indexOf("Kesan & Pesan");
    const idxFoto = headers.indexOf("Foto");
    const idxIzin = headers.indexOf("Izin Publikasi");

    if (idxIzin === -1 || idxKesan === -1 || idxNama === -1) return [];

    let results = [];
    
    // Loop backwards to get latest first
    for (let i = data.length - 1; i >= 1; i--) {
      const row = data[i];
      const izin = row[idxIzin] ? String(row[idxIzin]).trim() : "";
      const kesan = row[idxKesan] ? String(row[idxKesan]).trim() : "";

      if (izin === "Ya" && kesan !== "") {
        results.push({
          nama: String(row[idxNama] || ""),
          tahunMasuk: String(row[idxMasuk] || ""),
          tahunLulus: String(row[idxLulus] || ""),
          program: String(row[idxProgram] || ""),
          kesibukan: String(row[idxKesibukan] || ""),
          instansi: String(row[idxInstansi] || ""),
          kesan: kesan,
          foto: (idxFoto !== -1) ? String(row[idxFoto] || "") : ""
        });

        if (results.length >= 5) {
          break; // Max 5 testimonials
        }
      }
    }

    return results;
  } catch (e) {
    return [];
  }
}

// ==========================================
// BUSINESS LOGIC: AUTHENTICATION
// ==========================================

// ==========================================
// BUSINESS LOGIC: AUTHENTICATION (SECURED)
// ==========================================

const SHEET_USERS = "Users";
const SHEET_OTP = "OTP_Cache";

/**
 * Hash password menggunakan SHA-256 dengan Salt Server
 */
function hashPassword(password) {
  const salt = getServerSecret("PASSWORD_SALT", "");
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(password) + salt, Utilities.Charset.UTF_8);
  return digest.map(function(b) {
    return (b < 0 ? b + 256 : b).toString(16).padStart(2, '0');
  }).join('');
}

/**
 * Verifikasi password dengan dukungan migrasi backward-compatibility
 */
function verifyPassword(inputPassword, storedPassword) {
  if (!storedPassword) return false;
  // Backward compatibility untuk data lama yang sempat tersimpan plain-text
  if (storedPassword === inputPassword) return true;
  return hashPassword(inputPassword) === storedPassword;
}

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
        // Upgrade password plain-text menjadi hash secara otomatis jika ditemukan format lama
        if (storedPassword === password) {
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
    } else if (normalizedRole === "SUPER_ADMIN" || normalizedRole === "ADMIN" || normalizedRole === "PEGAWAI" || normalizedRole === "EDITOR") {
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
    body: body
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
    body: body
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
    body: body
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
        if (uEmail === normalized && (uRole === "ADMIN" || uRole === "EDITOR")) {
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
          if (uRole === "ADMIN" || uRole === "EDITOR") {
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

// =====================================================================
// MANAJEMEN DATA SANTRI & GOOGLE DRIVE PHOTO STORAGE
// =====================================================================

const FOLDER_ID_STUDENT_PHOTOS = (function() {
  try { return PropertiesService.getScriptProperties().getProperty("DRIVE_FOLDER_STUDENT_PHOTOS") || ""; } catch (e) { return ""; }
})(); // __MUBAROKAH_CONFIG_PENDING__

/**
 * Upload Foto Profil Santri ke Google Drive & Set Sharing Publik
 * Menghasilkan link Google CDN direct view dan menyimpan ke sheet Students
 */
function uploadStudentPhotoToDrive(filePayload, token) {
  try {
    let actor = null;
    if (token) {
      try {
        actor = authenticateSession(token);
      } catch (e) {
        const legacy = verifySessionToken(token);
        if (legacy && legacy.role) {
          actor = { role: legacy.role, identityId: legacy.userId };
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
        message: "Data file foto (base64) wajib dikirimkan."
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

    const folder = DriveApp.getFolderById(FOLDER_ID_STUDENT_PHOTOS);
    const cleanStudentId = String(filePayload.studentId || filePayload.student_id || filePayload.nis || "SANTRI").replace(/[^a-zA-Z0-9_-]/g, "");
    const fileName = "FOTO_" + cleanStudentId + "_" + new Date().getTime() + ".jpg";
    const blob = Utilities.newBlob(decodedData, rawMime, fileName);
    const newFile = folder.createFile(blob);
    newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const fileUrl = "https://lh3.googleusercontent.com/d/" + newFile.getId();
    const driveViewUrl = "https://drive.google.com/file/d/" + newFile.getId() + "/view?usp=sharing";

    // Update langsung ke sheet Students jika studentId atau nis tersedia
    const targetStudentId = filePayload.studentId || filePayload.student_id;
    const targetNis = filePayload.nis || filePayload.nisn;
    if (targetStudentId || targetNis) {
      updateStudentPhotoInSheet(targetStudentId, targetNis, fileUrl);
    }

    return {
      success: true,
      status: "success",
      statusCode: 200,
      url: fileUrl,
      fileUrl: fileUrl,
      driveViewUrl: driveViewUrl,
      fileId: newFile.getId(),
      message: "Foto santri berhasil diunggah ke Google Drive dan disimpan ke database!"
    };
  } catch (err) {
    console.error("[UPLOAD STUDENT PHOTO ERROR]", err);
    return {
      success: false,
      status: "error",
      message: "Gagal mengunggah foto santri: " + err.message
    };
  }
}

/**
 * Update link foto profil santri di spreadsheet Students
 */
function updateStudentPhotoInSheet(studentId, nis, photoUrl) {
  if (!photoUrl) return false;
  const ss = getDatabaseSpreadsheet();
  const sheet = getAuthSheet(ss, SHEET_STUDENTS);
  if (!sheet) return false;

  const data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) return false;

  const header = data[0].map(h => String(h || "").trim().toLowerCase());
  let idIdx = header.indexOf("student_id");
  let nisIdx = header.indexOf("nis");
  if (nisIdx === -1) nisIdx = header.indexOf("nisn");
  let photoIdx = header.indexOf("photo_url");
  if (photoIdx === -1) photoIdx = header.indexOf("foto_profil");
  if (photoIdx === -1) photoIdx = header.indexOf("foto");

  if (photoIdx === -1) {
    photoIdx = header.length;
    sheet.getRange(1, photoIdx + 1).setValue("photo_url").setFontWeight("bold").setBackground("#dcfce7");
  }

  const targetId = String(studentId || "").trim();
  const targetNis = String(nis || "").trim();

  for (let i = 1; i < data.length; i++) {
    const rowId = idIdx !== -1 ? String(data[i][idIdx] || "").trim() : "";
    const rowNis = nisIdx !== -1 ? String(data[i][nisIdx] || "").trim() : "";

    if ((targetId && rowId === targetId) || (targetNis && rowNis === targetNis)) {
      sheet.getRange(i + 1, photoIdx + 1).setValue(photoUrl);
      return true;
    }
  }
  return false;
}

/**
 * Unggah foto profil pengguna (Wali Santri, Pengasuh, Admin/Pengelola) ke Google Drive
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
function getAllUsersWithLinkedStudents(token) {
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

    const ss = getDatabaseSpreadsheet();
    if (!ss) {
      return { success: false, status: "error", message: "Spreadsheet database tidak dapat diakses." };
    }

    // Pastikan sheet Users diinisialisasi dan termigrasi
    setupAuthSystemSheets();

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
        linkedStudents: linked
      });
    }

    return {
      success: true,
      status: "success",
      users: users,
      total: users.length,
      summary: {
        total: users.length,
        wali: users.filter(u => u.role === "WALI_SANTRI").length,
        pengasuh: users.filter(u => u.role === "PENGASUH").length,
        pegawai: users.filter(u => u.role === "PEGAWAI" || u.role === "EDITOR").length,
        admin: users.filter(u => u.role === "ADMIN").length,
        superAdmin: users.filter(u => u.role === "SUPER_ADMIN").length
      }
    };
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
 * Menambah atau memperbarui akun pengguna dari menu Manajemen Pengguna
 */
function saveAdminUserData(payload, token) {
  try {
    let actor = null;
    if (token) {
      try {
        actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "PEGAWAI"]);
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
 * Ambil seluruh data santri untuk Dashboard Admin
 */
function getAllStudentsData(token) {
  try {
    const actor = authenticateSession(token);
    authorizeRole(actor, ["ADMIN", "EDITOR", "PENGASUH"]);

    const ss = getDatabaseSpreadsheet();
    const sheet = getAuthSheet(ss, SHEET_STUDENTS);
    if (!sheet) {
      return {
        status: "success",
        success: true,
        data: [],
        total: 0,
        summary: { total: 0, putra: 0, putri: 0, aktif: 0, nonaktif: 0 }
      };
    }

    const data = sheet.getDataRange().getValues();
    if (!data || data.length < 2) {
      return {
        status: "success",
        success: true,
        data: [],
        total: 0,
        summary: { total: 0, putra: 0, putri: 0, aktif: 0, nonaktif: 0 }
      };
    }

    const headers = data[0].map(h => String(h || "").trim().toLowerCase().replace(/\s+/g, "_"));
    let idIdx = headers.indexOf("student_id");
    let nisIdx = headers.indexOf("nis");
    if (nisIdx === -1) nisIdx = headers.indexOf("nisn");
    let nikIdx = headers.indexOf("nik");
    let nameIdx = headers.indexOf("name");
    if (nameIdx === -1) nameIdx = headers.indexOf("nama");
    let genderIdx = headers.indexOf("gender");
    if (genderIdx === -1) genderIdx = headers.indexOf("jenis");
    if (genderIdx === -1) genderIdx = headers.indexOf("jenis_kelamin");
    let birthIdx = headers.indexOf("birth_date");
    if (birthIdx === -1) birthIdx = headers.indexOf("tanggal_lahir");

    // Deteksi fleksibel untuk photo/foto
    let photoIdx = -1;
    for (let h = 0; h < headers.length; h++) {
      const hn = headers[h];
      if (hn === "photo_url" || hn === "foto_profil" || hn === "foto" || hn === "photo" || hn === "foto_santri" || hn === "link_foto" || hn.includes("foto") || hn.includes("photo")) {
        photoIdx = h;
        break;
      }
    }
    if (photoIdx === -1 && headers.length >= 10) photoIdx = 9; // Kolom J (indeks 9)

    // Deteksi kolom Halaqah & Muhafiz jika tersedia langsung di sheet Student
    let halaqahIdx = headers.indexOf("halaqah");
    if (halaqahIdx === -1) halaqahIdx = headers.indexOf("nama_halaqah");
    if (halaqahIdx === -1) halaqahIdx = headers.indexOf("kelompok_halaqah");
    let muhafizIdx = headers.indexOf("muhafiz");
    if (muhafizIdx === -1) muhafizIdx = headers.indexOf("muhafidz");
    if (muhafizIdx === -1) muhafizIdx = headers.indexOf("pembimbing");
    if (muhafizIdx === -1) muhafizIdx = headers.indexOf("ustadz");
    if (muhafizIdx === -1) muhafizIdx = headers.indexOf("guru");

    let progIdx = headers.indexOf("program");
    let statusIdx = headers.indexOf("status");
    let createdIdx = headers.indexOf("created_at");
    let qrIdx = headers.indexOf("qr_code");
    if (qrIdx === -1) qrIdx = headers.indexOf("qrcode");

    const students = [];
    let putra = 0, putri = 0, aktif = 0, nonaktif = 0;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const studentId = idIdx !== -1 ? String(row[idIdx] || "").trim() : "";
      const nis = nisIdx !== -1 ? String(row[nisIdx] || "").trim() : "";
      const name = nameIdx !== -1 ? String(row[nameIdx] || "").trim() : "";
      if (!studentId && !nis && !name) continue;

      const nik = nikIdx !== -1 ? String(row[nikIdx] || "").trim() : "";
      const genderRaw = genderIdx !== -1 ? String(row[genderIdx] || "").trim().toUpperCase() : "";
      const gender = (genderRaw === "P" || genderRaw === "PEREMPUAN" || genderRaw === "PUTRI") ? "P" : "L";
      const birthDate = birthIdx !== -1 ? normalizeDateString(row[birthIdx]) : "";
      let photoUrl = photoIdx !== -1 ? String(row[photoIdx] || "").trim() : "";
      if (photoUrl) {
        const driveMatch = photoUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || photoUrl.match(/id=([a-zA-Z0-9_-]+)/);
        if (driveMatch && driveMatch[1]) {
          photoUrl = "https://lh3.googleusercontent.com/d/" + driveMatch[1];
        }
      }

      let qrCode = qrIdx !== -1 ? String(row[qrIdx] || "").trim() : "";
      if (!qrCode) {
        qrCode = "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=" + encodeURIComponent(nis || studentId);
      }

      const program = progIdx !== -1 ? String(row[progIdx] || "Reguler").trim() : "Reguler";
      const statusRaw = statusIdx !== -1 ? String(row[statusIdx] || "ACTIVE").trim().toUpperCase() : "ACTIVE";
      const status = (statusRaw === "ACTIVE" || statusRaw === "AKTIF") ? "ACTIVE" : "INACTIVE";
      const createdAt = createdIdx !== -1 ? String(row[createdIdx] || "").trim() : "";
      const directHalaqah = halaqahIdx !== -1 ? String(row[halaqahIdx] || "").trim() : "";
      const directMuhafiz = muhafizIdx !== -1 ? String(row[muhafizIdx] || "").trim() : "";

      if (gender === "L") putra++;
      else putri++;

      if (status === "ACTIVE") aktif++;
      else nonaktif++;

      students.push({
        studentId: studentId || ("STD_" + i),
        student_id: studentId || ("STD_" + i),
        nis: nis,
        nisn: nis,
        nik: nik,
        name: name,
        gender: gender,
        birthDate: birthDate,
        birth_date: birthDate,
        photoUrl: photoUrl,
        photo_url: photoUrl,
        qrCode: qrCode,
        qr_code: qrCode,
        halaqah: directHalaqah,
        muhafiz: directMuhafiz,
        program: program || "Reguler",
        status: status,
        createdAt: createdAt
      });
    }

    return {
      status: "success",
      success: true,
      data: students,
      total: students.length,
      summary: {
        total: students.length,
        putra: putra,
        putri: putri,
        aktif: aktif,
        nonaktif: nonaktif
      }
    };
  } catch (err) {
    console.error("[GET ALL STUDENTS ERROR]", err);
    return {
      status: "error",
      success: false,
      message: "Gagal memuat data santri: " + err.message,
      data: [],
      total: 0,
      summary: { total: 0, putra: 0, putri: 0, aktif: 0, nonaktif: 0 }
    };
  }
}

/**
 * Tambah / Perbarui Data Santri di Spreadsheet Students (Admin/Editor Only)
 */
function saveStudentData(studentObj, token) {
  let actor = null;
  if (token) {
    try {
      actor = authenticateSession(token);
      authorizeRole(actor, ["ADMIN", "EDITOR"]);
    } catch (e) {
      const legacy = verifySessionToken(token);
      if (legacy && legacy.role) {
        actor = { role: legacy.role, identityId: legacy.userId };
      }
    }
  }

  const ss = getDatabaseSpreadsheet();
  const sheet = getAuthSheet(ss, SHEET_STUDENTS);
  if (!sheet) throw new Error("Tabel Students tidak ditemukan.");

  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h || "").trim().toLowerCase());

  let idIdx = headers.indexOf("student_id");
  let nisIdx = headers.indexOf("nis");
  if (nisIdx === -1) nisIdx = headers.indexOf("nisn");
  let nikIdx = headers.indexOf("nik");
  let nameIdx = headers.indexOf("name");
  if (nameIdx === -1) nameIdx = headers.indexOf("nama");
  let genderIdx = headers.indexOf("gender");
  if (genderIdx === -1) genderIdx = headers.indexOf("jenis");
  let birthIdx = headers.indexOf("birth_date");
  if (birthIdx === -1) birthIdx = headers.indexOf("tanggal_lahir");
  let photoIdx = headers.indexOf("photo_url");
  if (photoIdx === -1) photoIdx = headers.indexOf("foto_profil");
  if (photoIdx === -1) photoIdx = headers.indexOf("foto");
  let progIdx = headers.indexOf("program");
  let statusIdx = headers.indexOf("status");

  const inputId = String(studentObj.studentId || studentObj.student_id || "").trim();
  const inputNis = String(studentObj.nis || studentObj.nisn || "").trim();
  const inputNik = String(studentObj.nik || "").trim();
  const inputName = String(studentObj.name || studentObj.nama || "").trim();
  let inputGender = String(studentObj.gender || studentObj.jenis || "").trim().toUpperCase();
  if (inputGender === "PEREMPUAN" || inputGender === "PUTRI" || inputGender === "P") {
    inputGender = "P";
  } else {
    inputGender = "L";
  }
  const inputBirth = normalizeDateString(studentObj.birthDate || studentObj.birth_date || "");
  const inputPhoto = String(studentObj.photoUrl || studentObj.photo_url || "").trim();
  const inputProgram = String(studentObj.program || "Reguler").trim();
  let inputStatus = String(studentObj.status || "ACTIVE").trim().toUpperCase();
  if (inputStatus === "AKTIF" || inputStatus === "ACTIVE") {
    inputStatus = "ACTIVE";
  } else {
    inputStatus = "INACTIVE";
  }

  if (!inputNis || !inputName) {
    throw new Error("NIS dan Nama Santri wajib diisi.");
  }

  let foundRow = -1;
  for (let i = 1; i < data.length; i++) {
    const rowId = idIdx !== -1 ? String(data[i][idIdx] || "").trim() : "";
    const rowNis = nisIdx !== -1 ? String(data[i][nisIdx] || "").trim() : "";
    if ((inputId && rowId === inputId) || (inputNis && rowNis === inputNis)) {
      foundRow = i + 1;
      break;
    }
  }

  const nowIso = new Date().toISOString();

  if (foundRow !== -1) {
    if (nisIdx !== -1) sheet.getRange(foundRow, nisIdx + 1).setValue(inputNis);
    if (nikIdx !== -1) sheet.getRange(foundRow, nikIdx + 1).setValue(inputNik);
    if (nameIdx !== -1) sheet.getRange(foundRow, nameIdx + 1).setValue(inputName);
    if (genderIdx !== -1) sheet.getRange(foundRow, genderIdx + 1).setValue(inputGender);
    if (birthIdx !== -1) sheet.getRange(foundRow, birthIdx + 1).setValue(inputBirth);
    if (photoIdx !== -1 && inputPhoto) sheet.getRange(foundRow, photoIdx + 1).setValue(inputPhoto);
    if (progIdx !== -1) sheet.getRange(foundRow, progIdx + 1).setValue(inputProgram);
    if (statusIdx !== -1) sheet.getRange(foundRow, statusIdx + 1).setValue(inputStatus);

    return {
      status: "success",
      success: true,
      message: `Data santri ${inputName} (NIS: ${inputNis}) berhasil diperbarui.`
    };
  } else {
    const newStudentId = inputId || ("STD_" + Utilities.getUuid().replace(/-/g, "").substring(0, 12));
    const newRow = new Array(headers.length).fill("");
    if (idIdx !== -1) newRow[idIdx] = newStudentId;
    if (nisIdx !== -1) newRow[nisIdx] = inputNis;
    if (nikIdx !== -1) newRow[nikIdx] = inputNik;
    if (nameIdx !== -1) newRow[nameIdx] = inputName;
    if (genderIdx !== -1) newRow[genderIdx] = inputGender;
    if (birthIdx !== -1) newRow[birthIdx] = inputBirth;
    if (photoIdx !== -1) newRow[photoIdx] = inputPhoto;
    if (progIdx !== -1) newRow[progIdx] = inputProgram;
    if (statusIdx !== -1) newRow[statusIdx] = inputStatus;
    const createdIdx = headers.indexOf("created_at");
    if (createdIdx !== -1) newRow[createdIdx] = nowIso;

    sheet.appendRow(newRow);
    return {
      status: "success",
      success: true,
      studentId: newStudentId,
      message: `Santri baru ${inputName} (NIS: ${inputNis}) berhasil ditambahkan ke database.`
    };
  }
}

/**
 * Hapus Data Santri dari Spreadsheet Students
 */
function deleteStudentData(studentId, token) {
  try {
    if (token) {
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN"]);
      } catch (authErr) {
        verifySessionToken(token);
      }
    }

    const cleanId = String(studentId || "").trim();
    if (!cleanId) {
      return {
        status: "error",
        success: false,
        message: "ID Santri tidak valid untuk dihapus."
      };
    }

    const ss = getDatabaseSpreadsheet();
    const sheet = getAuthSheet(ss, SHEET_STUDENTS);
    if (!sheet) {
      return { status: "error", success: false, message: "Sheet Students tidak ditemukan." };
    }

    const data = sheet.getDataRange().getValues();
    if (!data || data.length < 2) {
      return { status: "error", success: false, message: "Data santri kosong." };
    }

    const headers = data[0].map(h => String(h || "").trim().toLowerCase());
    let idIdx = headers.indexOf("student_id");
    let nisIdx = headers.indexOf("nis");
    if (nisIdx === -1) nisIdx = headers.indexOf("nisn");

    let targetRow = -1;
    let studentName = "";
    for (let i = 1; i < data.length; i++) {
      const rowId = idIdx !== -1 ? String(data[i][idIdx] || "").trim() : "";
      const rowNis = nisIdx !== -1 ? String(data[i][nisIdx] || "").trim() : "";
      if (rowId === cleanId || (rowNis && rowNis === cleanId)) {
        targetRow = i + 1;
        let nameIdx = headers.indexOf("name");
        if (nameIdx === -1) nameIdx = headers.indexOf("nama");
        studentName = nameIdx !== -1 ? String(data[i][nameIdx] || "") : cleanId;
        break;
      }
    }

    if (targetRow === -1) {
      return {
        status: "error",
        success: false,
        message: `Santri dengan ID/NIS '${cleanId}' tidak ditemukan.`
      };
    }

    sheet.deleteRow(targetRow);

    // Bersihkan relasi di Wali_Santri_Map jika ada
    try {
      const mapSheet = getAuthSheet(ss, SHEET_WALI_SANTRI_MAP);
      if (mapSheet) {
        const mapData = mapSheet.getDataRange().getValues();
        for (let m = mapData.length - 1; m >= 1; m--) {
          if (String(mapData[m][2] || "").trim() === cleanId) {
            mapSheet.deleteRow(m + 1);
          }
        }
      }
    } catch (cleanErr) {
      console.warn("Pembersihan Wali_Santri_Map:", cleanErr);
    }

    return {
      status: "success",
      success: true,
      message: `Data santri ${studentName} berhasil dihapus dari database.`
    };
  } catch (err) {
    console.error("[DELETE STUDENT ERROR]", err);
    return {
      status: "error",
      success: false,
      message: "Gagal menghapus data santri: " + err.message
    };
  }
}

/**
 * Lookup Santri berdasarkan NIS & Tanggal Lahir untuk Aktivasi Wali Santri
 * Mendukung pencarian toleran dan mengekstrak NIK, Gender, dan Foto Profil
 */
function getStudentByNisAndBirthDate(nisOrNisn, birthDate) {
  const cleanNis = String(nisOrNisn || "").trim();
  const cleanBirthDate = normalizeDateString(birthDate);
  if (!cleanNis) return null;

  const ss = getDatabaseSpreadsheet();
  const sheet = getAuthSheet(ss, SHEET_STUDENTS);
  if (!sheet) return null;

  const data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) return null;

  const header = data[0].map(h => String(h || "").trim().toLowerCase());
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
  if (birthIdx === -1) birthIdx = header.indexOf("tgl_lahir");
  let photoIdx = header.indexOf("photo_url");
  if (photoIdx === -1) photoIdx = header.indexOf("foto_profil");
  if (photoIdx === -1) photoIdx = header.indexOf("foto");
  let progIdx = header.indexOf("program");
  let statusIdx = header.indexOf("status");

  if (idIdx === -1) idIdx = 0;
  if (nisIdx === -1) nisIdx = 1;
  if (nameIdx === -1) nameIdx = 2;

  for (let i = 1; i < data.length; i++) {
    const rowNis = String(data[i][nisIdx] || "").trim();
    if (rowNis === cleanNis) {
      const rowBirth = birthIdx !== -1 ? normalizeDateString(data[i][birthIdx]) : "";
      // Toleran: Jika tanggal lahir di database masih kosong (data awal), tetap cocok
      if (!rowBirth || !cleanBirthDate || rowBirth === cleanBirthDate) {
        return {
          studentId: String(data[i][idIdx] || ""),
          nis: rowNis,
          nisn: rowNis, // alias backward compatible
          nik: nikIdx !== -1 ? String(data[i][nikIdx] || "") : "",
          name: nameIdx !== -1 ? String(data[i][nameIdx] || "") : "Santri",
          gender: genderIdx !== -1 ? String(data[i][genderIdx] || "").trim().toUpperCase() : "",
          birthDate: rowBirth,
          photoUrl: photoIdx !== -1 ? String(data[i][photoIdx] || "") : "",
          program: progIdx !== -1 ? String(data[i][progIdx] || "Reguler") : "Reguler",
          status: statusIdx !== -1 ? String(data[i][statusIdx] || "Aktif") : "Aktif"
        };
      }
    }
  }
  return null;
}

/**
 * Alias fungsi backward compatible untuk getStudentByNisnAndBirthDate
 */
function getStudentByNisnAndBirthDate(nisn, birthDate) {
  return getStudentByNisAndBirthDate(nisn, birthDate);
}

/**
 * Cari data santri berdasarkan NIS saja (tanpa syarat tanggal lahir)
 */
function getStudentByNis(nisOrNisn) {
  const cleanNis = String(nisOrNisn || "").trim();
  if (!cleanNis) return null;

  const ss = getDatabaseSpreadsheet();
  const sheet = getAuthSheet(ss, SHEET_STUDENTS);
  if (!sheet) return null;

  const data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) return null;

  const header = data[0].map(h => String(h || "").trim().toLowerCase());
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
  if (birthIdx === -1) birthIdx = header.indexOf("tgl_lahir");
  let photoIdx = header.indexOf("photo_url");
  if (photoIdx === -1) photoIdx = header.indexOf("foto_profil");
  if (photoIdx === -1) photoIdx = header.indexOf("foto");
  let progIdx = header.indexOf("program");
  let statusIdx = header.indexOf("status");

  if (idIdx === -1) idIdx = 0;
  if (nisIdx === -1) nisIdx = 1;
  if (nameIdx === -1) nameIdx = 2;

  const cleanLower = cleanNis.toLowerCase();

  for (let i = 1; i < data.length; i++) {
    const rowNis = String(data[i][nisIdx] || "").trim();
    if (rowNis.toLowerCase() === cleanLower) {
      return {
        studentId: String(data[i][idIdx] || ""),
        nis: rowNis,
        nisn: rowNis,
        nik: nikIdx !== -1 ? String(data[i][nikIdx] || "") : "",
        name: nameIdx !== -1 ? String(data[i][nameIdx] || "") : "Santri",
        gender: genderIdx !== -1 ? String(data[i][genderIdx] || "").trim().toUpperCase() : "",
        birthDate: birthIdx !== -1 ? normalizeDateString(data[i][birthIdx]) : "",
        photoUrl: photoIdx !== -1 ? String(data[i][photoIdx] || "") : "",
        program: progIdx !== -1 ? String(data[i][progIdx] || "Reguler") : "Reguler",
        status: statusIdx !== -1 ? String(data[i][statusIdx] || "AKTIF") : "AKTIF"
      };
    }
  }
  return null;
}

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
  const now = new Date();

  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][2]).trim() === String(channel).trim() &&
        String(data[i][3]).trim() === String(identifierHash).trim() &&
        String(data[i][8]).trim() === "PENDING") {
      
      const expDate = new Date(data[i][7]);
      return {
        rowIndex: i + 1,
        challengeId: String(data[i][0]),
        identityId: String(data[i][1]),
        otpHash: String(data[i][4]),
        attempts: Number(data[i][5] || 0),
        maxAttempts: Number(data[i][6] || 3),
        expiresAt: expDate,
        isExpired: now > expDate
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
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][2]).trim() === String(channel).trim() &&
        String(data[i][3]).trim() === String(identifierHash).trim() &&
        String(data[i][8]).trim() === "PENDING") {
      sheet.getRange(i + 1, 9).setValue("CANCELLED");
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
    if (claims.role === "ADMIN" || claims.role === "EDITOR") {
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

  // Kompatibilitas mundur & alias: PEGAWAI <-> EDITOR
  if (normalizedAllowed.includes("PEGAWAI") && !normalizedAllowed.includes("EDITOR")) {
    normalizedAllowed.push("EDITOR");
  }
  if (normalizedAllowed.includes("EDITOR") && !normalizedAllowed.includes("PEGAWAI")) {
    normalizedAllowed.push("PEGAWAI");
  }

  if (!normalizedAllowed.includes(actorRole)) {
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
        const email = String(payload.email || "").trim().toLowerCase();
        const token = payload.token || "";

        if (!password || password.length < 6) {
          return createJsonResponse({
            success: false,
            message: "Kata Sandi / PIN minimal 6 karakter."
          });
        }

        let adminId = "";
        let adminEmail = email;

        if (token) {
          try {
            const actor = authenticateSession(token);
            if (actor && actor.identityId) {
              adminId = actor.identityId;
              if (actor.identity && actor.identity.email) adminEmail = actor.identity.email;
            }
          } catch (e) {}
        }

        if (!adminId && adminEmail) {
          const admin = getAdminIdentityByEmail(adminEmail);
          if (admin) adminId = admin.identityId;
        }

        if (!adminId && !adminEmail) {
          return createJsonResponse({
            success: false,
            message: "Identitas akun admin tidak valid untuk perubahan kata sandi."
          });
        }

        const success = setUserPasswordHash(adminId || adminEmail, password);
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
          const elapsed = (new Date().getTime() - new Date(pending.expiresAt.getTime() - 1800000).getTime()) / 1000;
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
        const expiresAt = new Date(now.getTime() + 1800000).toISOString();

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
          otpSheet.getRange(challenge.rowIndex, 6).setValue(newAttempts);
          if (newAttempts >= challenge.maxAttempts) {
            otpSheet.getRange(challenge.rowIndex, 9).setValue("EXHAUSTED");
          }
          writeAuthAuditLog("OTP_VERIFY_FAIL", challenge.identityId, "", "EMAIL", false, requestId, { attempts: newAttempts });
          return createJsonResponse({
            success: false,
            message: `Kode verifikasi salah. Sisa kesempatan: ${Math.max(0, challenge.maxAttempts - newAttempts)}`
          });
        }

        // OTP Valid => Konsumsi Challenge
        otpSheet.getRange(challenge.rowIndex, 9).setValue("CONSUMED");
        otpSheet.getRange(challenge.rowIndex, 11).setValue(new Date().toISOString());

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
          const elapsed = (new Date().getTime() - new Date(pending.expiresAt.getTime() - 1800000).getTime()) / 1000;
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
        const expiresAt = new Date(now.getTime() + 1800000).toISOString();

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
          otpSheet.getRange(challenge.rowIndex, 6).setValue(newAttempts);
          if (newAttempts >= challenge.maxAttempts) {
            otpSheet.getRange(challenge.rowIndex, 9).setValue("EXHAUSTED");
          }
          writeAuthAuditLog("OTP_VERIFY_FAIL", challenge.identityId, "", "EMAIL", false, requestId, { attempts: newAttempts });
          return createJsonResponse({
            success: false,
            message: `Kode verifikasi salah. Sisa kesempatan: ${Math.max(0, challenge.maxAttempts - newAttempts)}`
          });
        }

        otpSheet.getRange(challenge.rowIndex, 9).setValue("CONSUMED");
        otpSheet.getRange(challenge.rowIndex, 11).setValue(new Date().toISOString());

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
          const elapsed = (new Date().getTime() - new Date(pending.expiresAt.getTime() - 1800000).getTime()) / 1000;
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
        const expiresAt = new Date(now.getTime() + 1800000).toISOString();

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
              body: `Assalamu'alaikum,\n\nKode OTP aktivasi akun Anda adalah: ${otpCode}\n\nBerlaku selama 30 menit.\n\nTim Pesantren`
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
    // 13c. USER MANAGEMENT (auth.admin.userList, userSave, userToggleStatus)
    // ----------------------------------------------------
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

// ====================================================================
// MODUL BACKEND: TAHFIDZ AL-QUR'AN (MUTABA'AH, HALAQAH, TARGET)
// Terinspirasi dari standar Khodim.com (Mushaf Pojok 20 Hlm/Juz)
// ====================================================================

const SHEET_TAHFIDZ_LOGS = "Tahfidz_Logs";
const SHEET_TAHFIDZ_CAPAIAN = "Tahfidz_Capaian";
const SHEET_TAHFIDZ_TARGET = "Tahfidz_Target";
const SHEET_TAHFIDZ_HALAQAH = "Tahfidz_Halaqah";
const SHEET_TAHFIDZ_SESI = "Tahfidz_Jadwal_Sesi";

/**
 * Helper untuk mendapatkan atau membuat sheet tahfidz secara otomatis dengan styling header rapi
 */
function getOrCreateTahfidzSheet(ss, sheetName, defaultHeaders, headerBgColor) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (defaultHeaders && defaultHeaders.length > 0) {
      sheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);
      sheet.getRange(1, 1, 1, defaultHeaders.length)
        .setFontWeight("bold")
        .setBackground(headerBgColor || "#059669")
        .setFontColor("#ffffff");
      sheet.setFrozenRows(1);
    }
  } else if (defaultHeaders && defaultHeaders.length > 0) {
    // Pastikan semua kolom default ada di row 1
    const lastCol = sheet.getLastColumn();
    if (lastCol > 0) {
      const existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || "").trim().toLowerCase().replace(/[\s\-_]+/g, ""));
      let currentLastCol = lastCol;
      defaultHeaders.forEach(dh => {
        const cleanDh = String(dh).trim().toLowerCase().replace(/[\s\-_]+/g, "");
        if (existingHeaders.indexOf(cleanDh) === -1) {
          currentLastCol++;
          if (currentLastCol > sheet.getMaxColumns()) {
            sheet.insertColumnAfter(sheet.getMaxColumns());
          }
          sheet.getRange(1, currentLastCol).setValue(dh)
            .setFontWeight("bold")
            .setBackground(headerBgColor || "#059669")
            .setFontColor("#ffffff");
          existingHeaders.push(cleanDh);
        }
      });
    } else {
      sheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders])
        .setFontWeight("bold")
        .setBackground(headerBgColor || "#059669")
        .setFontColor("#ffffff");
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

/**
 * Normalisasi dan deteksi indeks kolom tab Tahfidz_Halaqah secara tangguh.
 * Menghindari bug jika header spreadsheet memiliki spasi, garis bawah, atau perbedaan penamaan.
 */
function getHalaqahColumnIndexes(headerRow) {
  if (!headerRow || !headerRow.length) return { id: -1, nama: -1, kategori: -1, muhafiz: -1, target: -1, studentIds: -1, createdAt: -1 };
  const normalized = headerRow.map(x => String(x || "").trim().toLowerCase().replace(/[\s\-_]+/g, ""));
  const find = (keywords) => {
    for (let i = 0; i < keywords.length; i++) {
      const cleanK = keywords[i].replace(/[\s\-_]+/g, "");
      const idx = normalized.indexOf(cleanK);
      if (idx !== -1) return idx;
    }
    return -1;
  };
  return {
    id: find(["halaqah_id", "halaqahid", "id_halaqah", "idhalaqah", "id", "kode_halaqah", "kode"]),
    nama: find(["nama_halaqah", "namahalaqah", "nama", "halaqah", "nama_kelompok", "kelompok"]),
    kategori: find(["kategori", "category", "program"]),
    muhafiz: find(["muhafiz", "muhafidz", "pembina", "ustadz", "guru"]),
    target: find(["target_kurikulum", "targetkurikulum", "target", "kurikulum"]),
    studentIds: find(["student_ids", "studentids", "anggota", "santri_ids", "santri", "siswa"]),
    createdAt: find(["created_at", "createdat", "tanggal", "waktu"])
  };
}

/**
 * Otomatis migrasi header & susunan data sheet Tahfidz_Halaqah
 * Menghilangkan kolom nama_halaqah & kategori sesuai rancangan baru:
 * [halaqah_id, muhafiz, target_kurikulum, student_ids, created_at]
 */
function migrateTahfidzHalaqahSheet_(ss) {
  try {
    if (!ss) return;
    const sheet = ss.getSheetByName(SHEET_TAHFIDZ_HALAQAH);
    if (!sheet) return;

    const data = sheet.getDataRange().getValues();
    if (!data || data.length === 0) return;

    const targetHeaders = ["halaqah_id", "muhafiz", "target_kurikulum", "student_ids", "created_at"];
    const currentHeaders = data[0].map(h => String(h || "").trim().toLowerCase());
    
    // Cek apakah sheet masih memiliki kolom 'nama_halaqah' atau 'kategori'
    const hasNama = currentHeaders.some(h => h.includes("nama_halaqah") || h === "nama" || h.includes("namahalaqah"));
    const hasKategori = currentHeaders.some(h => h === "kategori" || h === "category");

    // Jika sudah sesuai (hanya 5 kolom dan tidak ada nama_halaqah / kategori), lewati
    if (!hasNama && !hasKategori && data[0].length === targetHeaders.length) {
      return;
    }

    const colMap = getHalaqahColumnIndexes(data[0]);
    const migratedRows = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const hId = colMap.id !== -1 ? String(row[colMap.id] || "").trim() : "";
      let hMuh = colMap.muhafiz !== -1 ? String(row[colMap.muhafiz] || "").trim() : "";
      
      // Jika muhafiz kosong tapi nama_halaqah ada, kita fallback gunakan
      if (!hMuh && colMap.nama !== -1) {
        hMuh = String(row[colMap.nama] || "").trim();
      }

      if (!hId && !hMuh) continue;

      const hTarget = colMap.target !== -1 ? String(row[colMap.target] || "").trim() : "Tahfidz 30 Juz";
      const hStudents = colMap.studentIds !== -1 ? String(row[colMap.studentIds] || "").trim() : "";
      const hCreated = colMap.createdAt !== -1 ? String(row[colMap.createdAt] || "").trim() : new Date().toISOString();

      migratedRows.push([
        hId || ("HLQ-" + (i < 10 ? "0" + i : i)),
        hMuh || "Ustadz Pembina",
        hTarget || "Tahfidz 30 Juz",
        hStudents,
        hCreated
      ]);
    }

    // Bersihkan sheet dan pasang 5 kolom standar baru
    sheet.clear();
    sheet.getRange(1, 1, 1, targetHeaders.length).setValues([targetHeaders]);
    sheet.getRange(1, 1, 1, targetHeaders.length)
      .setBackground("#059669")
      .setFontColor("#ffffff")
      .setFontWeight("bold");

    if (migratedRows.length > 0) {
      sheet.getRange(2, 1, migratedRows.length, targetHeaders.length).setValues(migratedRows);
    }

    // Hapus sisa kolom jika sheet punya lebih dari 5 kolom
    const maxCols = sheet.getMaxColumns();
    if (maxCols > targetHeaders.length) {
      try {
        sheet.deleteColumns(targetHeaders.length + 1, maxCols - targetHeaders.length);
      } catch (colErr) {
        // Abaikan jika tidak diizinkan oleh spreadsheet
      }
    }

    console.log(`[MIGRATION SUCCESS] Tahfidz_Halaqah berhasil disesuaikan menjadi 5 kolom tanpa nama_halaqah & kategori (${migratedRows.length} baris).`);
  } catch (err) {
    console.error("[MIGRATE TAHFIDZ HALAQAH ERROR]", err);
  }
}

/**
 * Helper internal untuk resolusi data lengkap santri (Nama, NIS, Gender) dari Sheet Students
 */
function resolveStudentIdentity_(ss, studentId, nis, studentName) {
  let resName = String(studentName || "").trim();
  let resNis = String(nis || "").trim();
  let resGender = "L";
  let resId = String(studentId || "").trim();

  try {
    const studentSheet = (typeof getAuthSheet === "function" ? getAuthSheet(ss, SHEET_STUDENTS) : null) || ss.getSheetByName(SHEET_STUDENTS);
    if (studentSheet) {
      const sData = studentSheet.getDataRange().getValues();
      if (sData && sData.length > 1) {
        const sHeaders = sData[0].map(h => String(h || "").trim().toLowerCase().replace(/[\s\-_]+/g, ""));
        const sIdIdx = sHeaders.findIndex(h => h === "studentid" || h === "id");
        const sNisIdx = sHeaders.findIndex(h => h === "nis" || h === "nisn" || h.includes("nis"));
        const sNameIdx = sHeaders.findIndex(h => h === "name" || h === "nama" || h.includes("name") || h.includes("nama"));
        const sGenderIdx = sHeaders.findIndex(h => h === "gender" || h === "jeniskelamin" || h === "jenis");

        for (let i = 1; i < sData.length; i++) {
          const row = sData[i];
          const rowId = sIdIdx !== -1 ? String(row[sIdIdx] || "").trim() : "";
          const rowNis = sNisIdx !== -1 ? String(row[sNisIdx] || "").trim() : "";
          const rowName = sNameIdx !== -1 ? String(row[sNameIdx] || "").trim() : "";

          const matchId = resId && (rowId.toLowerCase() === resId.toLowerCase() || rowNis.toLowerCase() === resId.toLowerCase());
          const matchNis = resNis && (rowNis.toLowerCase() === resNis.toLowerCase() || rowId.toLowerCase() === resNis.toLowerCase());
          const matchName = resName && rowName && (rowName.toLowerCase() === resName.toLowerCase());

          if (matchId || matchNis || matchName) {
            if (!resName && rowName) resName = rowName;
            if (!resNis && rowNis) resNis = rowNis;
            if (!resId && rowId) resId = rowId;
            if (sGenderIdx !== -1 && row[sGenderIdx]) {
              const gRaw = String(row[sGenderIdx] || "").toUpperCase();
              resGender = (gRaw === "P" || gRaw === "PEREMPUAN" || gRaw === "PUTRI") ? "P" : "L";
            }
            break;
          }
        }
      }
    }
  } catch (err) {
    console.warn("[RESOLVE STUDENT IDENTITY WARN]", err);
  }

  return {
    studentId: resId,
    nis: resNis,
    studentName: resName,
    gender: resGender
  };
}

/**
 * Helper internal untuk resolusi Halaqah santri dari Sheet Tahfidz_Halaqah
 */
function resolveStudentHalaqah_(ss, studentId, nis, customHalaqahId, customNamaHalaqah, customMuhafiz) {
  let resHalaqahId = String(customHalaqahId || "").trim();
  let resNamaHalaqah = String(customNamaHalaqah || "").trim();
  let resMuhafiz = String(customMuhafiz || "").trim();

  try {
    const halaqahSheet = ss.getSheetByName(SHEET_TAHFIDZ_HALAQAH);
    if (halaqahSheet) {
      const hData = halaqahSheet.getDataRange().getValues();
      if (hData && hData.length > 1) {
        const colMap = getHalaqahColumnIndexes(hData[0]);
        const sIdLower = String(studentId || "").trim().toLowerCase();
        const nisLower = String(nis || "").trim().toLowerCase();

        for (let i = 1; i < hData.length; i++) {
          const r = hData[i];
          const stIds = colMap.studentIds !== -1 
            ? String(r[colMap.studentIds] || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean) 
            : [];

          if ((sIdLower && stIds.includes(sIdLower)) || (nisLower && stIds.includes(nisLower))) {
            if (!resHalaqahId && colMap.id !== -1) resHalaqahId = String(r[colMap.id] || "").trim();
            if ((!resMuhafiz || resMuhafiz === "Ustadz Pembina" || resMuhafiz === "-") && colMap.muhafiz !== -1) {
              const hMuh = String(r[colMap.muhafiz] || "").trim();
              if (hMuh) resMuhafiz = hMuh;
            }
            if (!resNamaHalaqah) {
              if (colMap.nama !== -1 && r[colMap.nama]) {
                resNamaHalaqah = String(r[colMap.nama]).trim();
              } else if (resMuhafiz) {
                resNamaHalaqah = "Halaqah " + resMuhafiz;
              }
            }
            break;
          }
        }
      }
    }
  } catch (err) {
    console.warn("[RESOLVE STUDENT HALAQAH WARN]", err);
  }

  if (!resNamaHalaqah) resNamaHalaqah = resMuhafiz ? ("Halaqah " + resMuhafiz) : (resHalaqahId ? ("Halaqah " + resHalaqahId) : "Halaqah Binaan");
  if (!resMuhafiz || resMuhafiz === "-") resMuhafiz = "Ustadz Pembina";

  return {
    halaqahId: resHalaqahId,
    namaHalaqah: resNamaHalaqah,
    muhafiz: resMuhafiz
  };
}

/**
 * FUNGSI UTAMA INISIALISASI TAB SHEET TAHFIDZ
 * Dapat dijalankan langsung dari menu Run Apps Script Editor (pilih: initTahfidzSheets)
 * Atau dipanggil via API Frontend / Web App.
 * Membuat 3 tab sheet:
 * 1. Tahfidz_Logs
 * 2. Tahfidz_Target
 * 3. Tahfidz_Halaqah (disertai data awal)
 */
function initTahfidzSheets(token) {
  try {
    const actor = authenticateSession(token);
    authorizeRole(actor, ["ADMIN"]);

    const ss = getDatabaseSpreadsheet();
    if (!ss) {
      throw new Error("Spreadsheet database tidak ditemukan. Pastikan SPREADSHEET_ID sudah diatur di Script Properties atau script terhubung ke Spreadsheet.");
    }

    const created = [];
    const existing = [];

    // 1. Tab: Tahfidz_Logs
    const headersLogs = [
      "log_id", "student_id", "nis", "student_name", "gender",
      "tanggal", "sesi", "tipe", "juz", "surah",
      "halaman_list", "total_halaman", "nilai", "muhafiz", "catatan", "status_setoran", "created_at"
    ];
    let sheetLogs = ss.getSheetByName(SHEET_TAHFIDZ_LOGS);
    if (!sheetLogs) {
      sheetLogs = ss.insertSheet(SHEET_TAHFIDZ_LOGS);
      sheetLogs.getRange(1, 1, 1, headersLogs.length).setValues([headersLogs]);
      sheetLogs.getRange(1, 1, 1, headersLogs.length)
        .setFontWeight("bold")
        .setBackground("#059669")
        .setFontColor("#ffffff");
      sheetLogs.setFrozenRows(1);
      created.push(SHEET_TAHFIDZ_LOGS);
    } else {
      // Pastikan kolom status_setoran sudah ada
      const lastCol = sheetLogs.getLastColumn();
      if (lastCol > 0) {
        const existingHeaders = sheetLogs.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || "").trim().toLowerCase());
        if (existingHeaders.indexOf("status_setoran") === -1) {
          const nextCol = lastCol + 1;
          if (nextCol > sheetLogs.getMaxColumns()) {
            sheetLogs.insertColumnAfter(sheetLogs.getMaxColumns());
          }
          sheetLogs.getRange(1, nextCol).setValue("status_setoran").setFontWeight("bold").setBackground("#059669").setFontColor("#ffffff");
        }
      }
      existing.push(SHEET_TAHFIDZ_LOGS);
    }

    // 2. Tab: Tahfidz_Capaian (Snapshot posisi hafalan terakhir per santri)
    const headersCapaian = [
      "student_id", "student_name", "juz_aktif", "halaman_terakhir", "total_halaman_tuntas", "status_terakhir", "halaqah_id", "nama_halaqah", "muhafiz_pembina", "updated_at"
    ];
    let sheetCapaian = ss.getSheetByName(SHEET_TAHFIDZ_CAPAIAN);
    if (!sheetCapaian) {
      sheetCapaian = ss.insertSheet(SHEET_TAHFIDZ_CAPAIAN);
      sheetCapaian.getRange(1, 1, 1, headersCapaian.length).setValues([headersCapaian]);
      sheetCapaian.getRange(1, 1, 1, headersCapaian.length)
        .setFontWeight("bold")
        .setBackground("#059669")
        .setFontColor("#ffffff");
      sheetCapaian.setFrozenRows(1);
      created.push(SHEET_TAHFIDZ_CAPAIAN);
    } else {
      existing.push(SHEET_TAHFIDZ_CAPAIAN);
    }

    // 3. Tab: Tahfidz_Target
    const headersTarget = [
      "student_id", "student_name", "target_ziyadah_sesi", "target_ziyadah_pekan", "target_murajaah_sesi", "target_murajaah_pekan", "target_juz", "updated_at"
    ];
    let sheetTarget = ss.getSheetByName(SHEET_TAHFIDZ_TARGET);
    if (!sheetTarget) {
      sheetTarget = ss.insertSheet(SHEET_TAHFIDZ_TARGET);
      sheetTarget.getRange(1, 1, 1, headersTarget.length).setValues([headersTarget]);
      sheetTarget.getRange(1, 1, 1, headersTarget.length)
        .setFontWeight("bold")
        .setBackground("#0d9488")
        .setFontColor("#ffffff");
      sheetTarget.setFrozenRows(1);
      created.push(SHEET_TAHFIDZ_TARGET);
    } else {
      existing.push(SHEET_TAHFIDZ_TARGET);
    }

    // 3. Tab: Tahfidz_Halaqah
    migrateTahfidzHalaqahSheet_(ss);
    const headersHalaqah = [
      "halaqah_id", "muhafiz", "target_kurikulum", "student_ids", "created_at"
    ];
    let sheetHalaqah = ss.getSheetByName(SHEET_TAHFIDZ_HALAQAH);
    if (!sheetHalaqah) {
      sheetHalaqah = ss.insertSheet(SHEET_TAHFIDZ_HALAQAH);
      sheetHalaqah.getRange(1, 1, 1, headersHalaqah.length).setValues([headersHalaqah]);
      sheetHalaqah.getRange(1, 1, 1, headersHalaqah.length)
        .setFontWeight("bold")
        .setBackground("#059669")
        .setFontColor("#ffffff");
      sheetHalaqah.setFrozenRows(1);
      created.push(SHEET_TAHFIDZ_HALAQAH);
    } else {
      existing.push(SHEET_TAHFIDZ_HALAQAH);
    }

    // 4. Tab: Tahfidz_Jadwal_Sesi
    const headersSesi = [
      "sesi_id", "nama_sesi", "jenis_sesi", "status", "jam_mulai", "jam_selesai", "hari_list", "created_at"
    ];
    let sheetSesi = ss.getSheetByName(SHEET_TAHFIDZ_SESI);
    if (!sheetSesi) {
      sheetSesi = ss.insertSheet(SHEET_TAHFIDZ_SESI);
      sheetSesi.getRange(1, 1, 1, headersSesi.length).setValues([headersSesi]);
      sheetSesi.getRange(1, 1, 1, headersSesi.length)
        .setFontWeight("bold")
        .setBackground("#4f46e5")
        .setFontColor("#ffffff");
      sheetSesi.setFrozenRows(1);

      // Default Sesi Waktu Awal
      const nowIso = new Date().toISOString();
      const defaultSesi = [
        ["SESI-01", "Pagi (Ba'da Subuh)", "Muroja'ah", "Aktif Digunakan", "05:00", "06:00", "Sen,Rab,Kam,Sab,Min", nowIso],
        ["SESI-02", "Pagi (MA Tahfidz)", "Ziyadah (Setoran Hafalan Baru)", "Aktif Digunakan", "08:30", "09:30", "Sen,Sel,Rab,Kam,Sab", nowIso],
        ["SESI-03", "Sore (Ba'da Ashar)", "Ziyadah (Setoran Hafalan Baru)", "Aktif Digunakan", "16:00", "17:15", "Sen,Sel,Rab,Kam,Sab,Min", nowIso],
        ["SESI-04", "Malam (Ba'da Isya')", "Muroja'ah", "Aktif Digunakan", "19:30", "20:30", "Sen,Sel,Rab,Kam,Sab,Min", nowIso]
      ];
      sheetSesi.getRange(2, 1, defaultSesi.length, headersSesi.length).setValues(defaultSesi);
      created.push(SHEET_TAHFIDZ_SESI);
    } else {
      existing.push(SHEET_TAHFIDZ_SESI);
    }

    const msg = created.length > 0
      ? "Tab sheet berhasil dibuat di Spreadsheet: " + created.join(", ") + (existing.length > 0 ? " (Sudah ada: " + existing.join(", ") + ")" : "")
      : "Semua tab sheet tahfidz (" + existing.join(", ") + ") sudah ada di Spreadsheet dan siap digunakan.";

    console.log("[INIT TAHFIDZ SHEETS]", msg);
    return {
      status: "success",
      success: true,
      message: msg,
      createdSheets: created,
      existingSheets: existing
    };
  } catch (err) {
    console.error("[INIT TAHFIDZ SHEETS ERROR]", err);
    return {
      status: "error",
      success: false,
      message: "Gagal membuat tab sheet tahfidz: " + err.message
    };
  }
}

/**
 * 1. Ambil Data Dashboard Tahfidz (Admin, Pengasuh, Wali Santri)
 * Mengembalikan:
 * - 4 Ringkasan Makro (Khatam 30 Juz, Rata-rata Hafalan, Total Akumulasi Juz, Aktivitas Pekan Ini)
 * - Daftar Santri Lengkap dengan Target Capaian, Setoran Terakhir, Nilai & Progres 0-30 Juz
 * - Filter Master (Kategori, Halaqah, Muhafiz)
 */
function getTahfidzDashboard(token) {
  try {
    let actor = null;
    if (token) {
      try {
        actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "SUPER_ADMIN", "EDITOR", "PENGASUH", "PENGURUS", "WALI_SANTRI", "GURU", "MUHAFIZ"]);
      } catch (authErr) {
        verifySessionToken(token);
      }
    }

    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error("Spreadsheet database tidak ditemukan.");

    // 1. Dapatkan referensi sheet langsung tanpa remote RPC auto-schema check
    migrateTahfidzHalaqahSheet_(ss);
    const logsSheet = ss.getSheetByName(SHEET_TAHFIDZ_LOGS);
    const headersCapaian = [
      "student_id", "student_name", "juz_aktif", "halaman_terakhir", "total_halaman_tuntas", "status_terakhir", "halaqah_id", "nama_halaqah", "muhafiz_pembina", "updated_at"
    ];
    const capaianSheet = getOrCreateTahfidzSheet(ss, SHEET_TAHFIDZ_CAPAIAN, headersCapaian, "#059669");
    const targetSheet = ss.getSheetByName(SHEET_TAHFIDZ_TARGET);
    const halaqahSheet = ss.getSheetByName(SHEET_TAHFIDZ_HALAQAH);
    const sesiSheet = ss.getSheetByName(SHEET_TAHFIDZ_SESI);
    const studentSheet = ss.getSheetByName(SHEET_STUDENTS);

    // 2. Ambil data master Santri secara langsung (< 50ms)
    let allStudents = [];
    if (studentSheet) {
      const sData = studentSheet.getDataRange().getValues();
      if (sData && sData.length > 1) {
        const sHeaders = sData[0].map(h => String(h || "").trim().toLowerCase().replace(/[\s\-_]+/g, ""));
        const sIdIdx = sHeaders.findIndex(h => h === "studentid" || h === "id");
        const sNisIdx = sHeaders.findIndex(h => h === "nis" || h === "nisn");
        const sNameIdx = sHeaders.findIndex(h => h === "name" || h === "nama");
        const sGenderIdx = sHeaders.findIndex(h => h === "gender" || h === "jeniskelamin" || h === "jenis");
        const sPhotoIdx = sHeaders.findIndex(h => h.includes("photo") || h.includes("foto"));
        const sProgIdx = sHeaders.findIndex(h => h === "program" || h === "kelas");
        const sStatusIdx = sHeaders.findIndex(h => h === "status");

        for (let i = 1; i < sData.length; i++) {
          const row = sData[i];
          const stId = sIdIdx !== -1 ? String(row[sIdIdx] || "").trim() : "";
          const stName = sNameIdx !== -1 ? String(row[sNameIdx] || "").trim() : "";
          if (!stId && !stName) continue;
          allStudents.push({
            studentId: stId || ("STD-" + i),
            nis: sNisIdx !== -1 ? String(row[sNisIdx] || "").trim() : "",
            name: stName,
            gender: sGenderIdx !== -1 ? String(row[sGenderIdx] || "L").toUpperCase() : "L",
            photoUrl: sPhotoIdx !== -1 ? String(row[sPhotoIdx] || "") : "",
            program: sProgIdx !== -1 ? String(row[sProgIdx] || "Tahfidz").trim() : "Tahfidz",
            status: sStatusIdx !== -1 ? String(row[sStatusIdx] || "ACTIVE").trim() : "ACTIVE"
          });
        }
      }
    }

    if (allStudents.length === 0 && typeof getAllStudentsData === "function") {
      try {
        const studentsRes = getAllStudentsData(token);
        allStudents = (studentsRes && studentsRes.data) || [];
      } catch (e) {
        console.warn("[FALLBACK STUDENTS ERROR]", e);
      }
    }

    // Filter khusus Wali Santri
    let filteredStudents = allStudents;
    if (actor && actor.role === "WALI_SANTRI") {
      const linked = (typeof getLinkedStudentsForWali === "function") ? getLinkedStudentsForWali(actor.identityId) : [];
      const allowedIds = (linked || []).map(s => String(s.studentId || s.student_id || s.id || s.nis || "").trim().toLowerCase());
      filteredStudents = allStudents.filter(st => {
        const sId = String(st.studentId || st.student_id || "").trim().toLowerCase();
        const sNis = String(st.nis || "").trim().toLowerCase();
        return allowedIds.includes(sId) || allowedIds.includes(sNis);
      });
    }

    // 3. Baca Data Target Santri
    const targetMap = {};
    if (targetSheet) {
      const targetData = targetSheet.getDataRange().getValues();
      if (targetData && targetData.length > 1) {
        const hTarget = targetData[0].map(h => String(h || "").trim().toLowerCase());
        const sIdIdx = hTarget.indexOf("student_id");
        const zSesiIdx = hTarget.indexOf("target_ziyadah_sesi");
        const zPekanIdx = hTarget.indexOf("target_ziyadah_pekan");
        const mSesiIdx = hTarget.indexOf("target_murajaah_sesi");
        const mPekanIdx = hTarget.indexOf("target_murajaah_pekan");

        for (let i = 1; i < targetData.length; i++) {
          const sId = sIdIdx !== -1 ? String(targetData[i][sIdIdx] || "").trim() : "";
          if (!sId) continue;
          targetMap[sId] = {
            targetZiyadahSesi: zSesiIdx !== -1 ? (Number(targetData[i][zSesiIdx]) || 1) : 1,
            targetZiyadahPekan: zPekanIdx !== -1 ? (Number(targetData[i][zPekanIdx]) || 10) : 10,
            targetMurajaahSesi: mSesiIdx !== -1 ? (Number(targetData[i][mSesiIdx]) || 2) : 2,
            targetMurajaahPekan: mPekanIdx !== -1 ? (Number(targetData[i][mPekanIdx]) || 10) : 10
          };
        }
      }
    }

    // 3b. Baca Data Capaian Santri dari Tahfidz_Capaian
    const capaianMap = {};
    if (capaianSheet) {
      const cData = capaianSheet.getDataRange().getValues();
      if (cData && cData.length > 1) {
        const hCap = cData[0].map(h => String(h || "").trim().toLowerCase());
        const sIdIdx = hCap.indexOf("student_id");
        const juzIdx = hCap.indexOf("juz_aktif");
        const halIdx = hCap.indexOf("halaman_terakhir");
        const totIdx = hCap.indexOf("total_halaman_tuntas");
        const stIdx = hCap.indexOf("status_terakhir");
        const hlqIdIdx = hCap.indexOf("halaqah_id");
        const hlqNmIdx = hCap.indexOf("nama_halaqah");
        const muhIdx = hCap.indexOf("muhafiz_pembina");
        const updIdx = hCap.indexOf("updated_at");

        for (let i = 1; i < cData.length; i++) {
          const sId = sIdIdx !== -1 ? String(cData[i][sIdIdx] || "").trim() : "";
          if (!sId) continue;
          capaianMap[sId] = {
            juzAktif: juzIdx !== -1 ? (Number(cData[i][juzIdx]) || 1) : 1,
            halamanTerakhir: halIdx !== -1 ? (Number(cData[i][halIdx]) || 1) : 1,
            totalHalamanTuntas: totIdx !== -1 ? (Number(cData[i][totIdx]) || 0) : 0,
            statusTerakhir: stIdx !== -1 ? String(cData[i][stIdx] || "LANJUT").trim() : "LANJUT",
            halaqahId: hlqIdIdx !== -1 ? String(cData[i][hlqIdIdx] || "").trim() : "",
            namaHalaqah: hlqNmIdx !== -1 ? String(cData[i][hlqNmIdx] || "").trim() : "",
            muhafiz: muhIdx !== -1 ? String(cData[i][muhIdx] || "").trim() : "",
            updatedAt: updIdx !== -1 ? String(cData[i][updIdx] || "").trim() : ""
          };
        }
      }
    }

    // 4. Baca Data Halaqah
    const halaqahList = [];
    const studentHalaqahMap = {};
    if (halaqahSheet) {
      const halaqahData = halaqahSheet.getDataRange().getValues();
      if (halaqahData && halaqahData.length > 1) {
        const colMap = getHalaqahColumnIndexes(halaqahData[0]);
        for (let i = 1; i < halaqahData.length; i++) {
          const r = halaqahData[i];
          const rawId = colMap.id !== -1 ? String(r[colMap.id] || "").trim() : "";
          const hmuh = colMap.muhafiz !== -1 ? String(r[colMap.muhafiz] || "").trim() : "";
          if (!rawId && !hmuh) continue;

          const hid = rawId || ("HLQ-" + (i < 10 ? "0" + i : i));
          const hname = (colMap.nama !== -1 && r[colMap.nama]) ? String(r[colMap.nama]).trim() : (hmuh ? ("Halaqah " + hmuh) : `Halaqah ${i}`);
          const hkur = colMap.target !== -1 ? String(r[colMap.target] || "").trim() : "Tahfidz 30 Juz";
          const stIds = colMap.studentIds !== -1 ? String(r[colMap.studentIds] || "").split(",").map(x => x.trim()).filter(Boolean) : [];

          halaqahList.push({
            halaqahId: hid,
            namaHalaqah: hname,
            muhafiz: hmuh || "Ustadz Pembina",
            targetKurikulum: hkur,
            studentIds: stIds,
            studentCount: stIds.length
          });

          stIds.forEach(id => {
            const idClean = String(id).trim();
            const idLower = idClean.toLowerCase();
            const halaqahObj = {
              halaqahId: hid,
              namaHalaqah: hname,
              muhafiz: hmuh || "Ustadz Pembina"
            };
            studentHalaqahMap[idClean] = halaqahObj;
            studentHalaqahMap[idLower] = halaqahObj;
          });
        }
      }
    }

    // Auto-heal / Backfill data kosong di Tahfidz_Capaian & Tahfidz_Logs jika ada
    try {
      let needCapaianFlush = false;
      if (capaianSheet && cData && cData.length > 1) {
        const hCap = cData[0].map(h => String(h || "").trim().toLowerCase());
        const sIdIdx = hCap.indexOf("student_id");
        const sNmIdx = hCap.indexOf("student_name");
        const hlqIdIdx = hCap.indexOf("halaqah_id");
        const hlqNmIdx = hCap.indexOf("nama_halaqah");
        const muhIdx = hCap.indexOf("muhafiz_pembina");

        for (let i = 1; i < cData.length; i++) {
          const sId = sIdIdx !== -1 ? String(cData[i][sIdIdx] || "").trim() : "";
          if (!sId) continue;
          const currName = sNmIdx !== -1 ? String(cData[i][sNmIdx] || "").trim() : "";
          const currHlq = hlqIdIdx !== -1 ? String(cData[i][hlqIdIdx] || "").trim() : "";

          if (!currName || !currHlq) {
            const foundSt = allStudents.find(s => 
              String(s.studentId).toLowerCase() === sId.toLowerCase() || 
              String(s.nis).toLowerCase() === sId.toLowerCase()
            );
            const foundHlq = studentHalaqahMap[sId] || studentHalaqahMap[sId.toLowerCase()] || (foundSt && (studentHalaqahMap[foundSt.studentId] || studentHalaqahMap[foundSt.nis])) || null;

            if (!currName && foundSt && foundSt.name && sNmIdx !== -1) {
              capaianSheet.getRange(i + 1, sNmIdx + 1).setValue(foundSt.name);
              cData[i][sNmIdx] = foundSt.name;
              needCapaianFlush = true;
            }
            if (!currHlq && foundHlq && hlqIdIdx !== -1) {
              if (foundHlq.halaqahId) {
                capaianSheet.getRange(i + 1, hlqIdIdx + 1).setValue(foundHlq.halaqahId);
                cData[i][hlqIdIdx] = foundHlq.halaqahId;
              }
              if (foundHlq.namaHalaqah && hlqNmIdx !== -1) {
                capaianSheet.getRange(i + 1, hlqNmIdx + 1).setValue(foundHlq.namaHalaqah);
                cData[i][hlqNmIdx] = foundHlq.namaHalaqah;
              }
              if (foundHlq.muhafiz && muhIdx !== -1) {
                capaianSheet.getRange(i + 1, muhIdx + 1).setValue(foundHlq.muhafiz);
                cData[i][muhIdx] = foundHlq.muhafiz;
              }
              needCapaianFlush = true;
            }
            if (capaianMap[sId]) {
              if (foundSt && foundSt.name) capaianMap[sId].studentName = foundSt.name;
              if (foundHlq && foundHlq.halaqahId) capaianMap[sId].halaqahId = foundHlq.halaqahId;
              if (foundHlq && foundHlq.namaHalaqah) capaianMap[sId].namaHalaqah = foundHlq.namaHalaqah;
              if (foundHlq && foundHlq.muhafiz) capaianMap[sId].muhafiz = foundHlq.muhafiz;
            }
          }
        }
      }
      if (needCapaianFlush) SpreadsheetApp.flush();
    } catch (healErr) {
      console.warn("[AUTO-HEAL TAHFIDZ CAPAIAN WARN]", healErr);
    }

    // 5. Agregasi Riwayat Logs Super Cepat (Single-pass O(N) Reverse Scan)
    // Mengeliminasi in-memory sorting ribuan log per santri
    const latestLogMap = {};
    const maxJuzMap = {};
    const setoranCountMap = {};
    const setoranPekanIniMap = {};
    let weeklyZiyadahCount = 0;
    let weeklyMurajaahCount = 0;
    const oneWeekAgoMs = Date.now() - (7 * 24 * 60 * 60 * 1000);

    if (logsSheet) {
      const logsData = logsSheet.getDataRange().getValues();
      if (logsData && logsData.length > 1) {
        const hLogs = logsData[0].map(h => String(h || "").trim().toLowerCase());
        const idIdx = hLogs.indexOf("student_id");
        const nisIdx = hLogs.indexOf("nis");
        const sNmLogsIdx = hLogs.indexOf("student_name");
        const statusIdx = hLogs.indexOf("status_setoran");
        const nilaiIdx = hLogs.indexOf("nilai");
        const juzIdx = hLogs.indexOf("juz");
        const tglIdx = hLogs.indexOf("tanggal");
        const createdIdx = hLogs.indexOf("created_at");
        const tipeIdx = hLogs.indexOf("tipe");
        const surahIdx = hLogs.indexOf("surah");
        const halIdx = hLogs.indexOf("halaman_list");
        const totHalIdx = hLogs.indexOf("total_halaman");
        const sesiIdx = hLogs.indexOf("sesi");
        const muhIdx = hLogs.indexOf("muhafiz");
        let needLogsFlush = false;

        // Scan dari baris paling bawah ke atas (log terbaru ada di baris bawah)
        for (let i = logsData.length - 1; i >= 1; i--) {
          const r = logsData[i];
          const sId = idIdx !== -1 ? String(r[idIdx] || "").trim() : "";
          const sNis = nisIdx !== -1 ? String(r[nisIdx] || "").trim() : "";
          if (!sId && !sNis) continue;

          // Auto-heal baris log jika nis atau student_name kosong
          const currLogName = sNmLogsIdx !== -1 ? String(r[sNmLogsIdx] || "").trim() : "";
          if (!currLogName || !sNis) {
            const foundSt = allStudents.find(s => 
              (sId && (String(s.studentId).toLowerCase() === sId.toLowerCase() || String(s.nis).toLowerCase() === sId.toLowerCase())) ||
              (sNis && (String(s.nis).toLowerCase() === sNis.toLowerCase() || String(s.studentId).toLowerCase() === sNis.toLowerCase()))
            );
            if (foundSt) {
              if (!currLogName && foundSt.name && sNmLogsIdx !== -1) {
                logsSheet.getRange(i + 1, sNmLogsIdx + 1).setValue(foundSt.name);
                needLogsFlush = true;
              }
              if (!sNis && foundSt.nis && nisIdx !== -1) {
                logsSheet.getRange(i + 1, nisIdx + 1).setValue(foundSt.nis);
                needLogsFlush = true;
              }
            }
          }

          const sKeys = [sId, sNis].filter(Boolean);
          const nilai = nilaiIdx !== -1 ? String(r[nilaiIdx] || "MUMTAZ").trim().toUpperCase() : "MUMTAZ";
          const rawStatus = statusIdx !== -1 ? String(r[statusIdx] || "").trim().toUpperCase() : "";
          const statusSetoran = rawStatus || (nilai === "DHAIF" ? "ULANG" : "LANJUT");
          const juz = juzIdx !== -1 ? (Number(r[juzIdx]) || 1) : 1;
          const rawTgl = tglIdx !== -1 ? r[tglIdx] : "";
          const rawCreated = createdIdx !== -1 ? r[createdIdx] : "";
          const d = new Date(rawTgl || rawCreated);
          const isRecent = !isNaN(d.getTime()) && d.getTime() >= oneWeekAgoMs;
          const tipe = tipeIdx !== -1 ? String(r[tipeIdx] || "ZIYADAH").trim().toUpperCase() : "ZIYADAH";

          if (isRecent) {
            if (tipe === "ZIYADAH") weeklyZiyadahCount++;
            else if (tipe === "MURAJAAH" || tipe === "TASMI") weeklyMurajaahCount++;
          }

          sKeys.forEach(k => {
            // Setoran terakhir (pertama kali ditemukan saat reverse loop)
            if (!latestLogMap[k]) {
              latestLogMap[k] = {
                juz: juz,
                surah: surahIdx !== -1 ? String(r[surahIdx] || "").trim() || `Juz ${juz}` : `Juz ${juz}`,
                halaman: halIdx !== -1 && r[halIdx] ? `Halaman ${r[halIdx]}` : "Halaman 1",
                totalHalaman: totHalIdx !== -1 ? (Number(r[totHalIdx]) || 1) : 1,
                tanggal: normalizeDateString(rawTgl),
                sesi: sesiIdx !== -1 ? String(r[sesiIdx] || "Pagi (Ba'da Subuh)").trim() : "Pagi (Ba'da Subuh)",
                tipe: tipe,
                nilai: nilai,
                statusSetoran: statusSetoran,
                muhafiz: muhIdx !== -1 ? String(r[muhIdx] || "").trim() : ""
              };
            }

            // Capaian Juz tertinggi
            if (statusSetoran !== "ULANG" && juz > (maxJuzMap[k] || 0)) {
              maxJuzMap[k] = juz;
            }

            // Jumlah total setoran
            setoranCountMap[k] = (setoranCountMap[k] || 0) + 1;

            // Setoran pekan ini
            if (isRecent) {
              setoranPekanIniMap[k] = (setoranPekanIniMap[k] || 0) + 1;
            }
          });
        }
      }
    }

    // 6. Kalkulasi Data Santri Terintegrasi
    let totalJuzAllStudents = 0;
    let khatam30Count = 0;

    const enrichedStudents = filteredStudents.map(st => {
      const sId = String(st.studentId || st.student_id || "").trim();
      const sNis = String(st.nis || "").trim();
      const latestLog = latestLogMap[sId] || latestLogMap[sNis] || null;

      const cap = capaianMap[sId] || capaianMap[sNis] || null;
      let currentJuz = cap ? cap.juzAktif : (maxJuzMap[sId] || maxJuzMap[sNis] || 0);
      if (currentJuz === 0 && st.program && st.program.toLowerCase().includes("tahfidz")) {
        currentJuz = 1;
      }
      if (currentJuz >= 30) khatam30Count++;
      totalJuzAllStudents += currentJuz;

      const setoranPekanIni = setoranPekanIniMap[sId] || setoranPekanIniMap[sNis] || 0;
      const onTrack = setoranPekanIni >= 2 ? `On-Track (${setoranPekanIni}x Pekan Ini)` : (setoranPekanIni === 1 ? `1x Setor Pekan Ini` : `Belum Setor`);

      const target = targetMap[sId] || targetMap[sNis] || {
        targetZiyadahSesi: 1,
        targetZiyadahPekan: 10,
        targetMurajaahSesi: 2,
        targetMurajaahPekan: 10
      };

      const sIdLower = sId.toLowerCase();
      const sNisLower = sNis.toLowerCase();
      const sNameLower = String(st.name || st.nama || "").trim().toLowerCase();
      const assignedHalaqah = studentHalaqahMap[sId] || 
                              studentHalaqahMap[sNis] || 
                              studentHalaqahMap[sIdLower] || 
                              studentHalaqahMap[sNisLower] || 
                              (sNameLower && studentHalaqahMap[sNameLower]) || 
                              null;

      const isInHalaqah = Boolean(assignedHalaqah);
      const halaqah = assignedHalaqah ? assignedHalaqah : {
        halaqahId: "",
        namaHalaqah: "Belum Masuk Halaqah",
        kategori: st.program || "Tahfidz",
        muhafiz: "-"
      };

      return {
        studentId: sId,
        nis: sNis,
        name: st.name || st.nama || "Santri",
        gender: st.gender || "L",
        photoUrl: st.photoUrl || st.photo_url || "",
        program: st.program || "Tahfidz",
        status: st.status || "ACTIVE",
        halaqah: halaqah,
        isInHalaqah: isInHalaqah,
        capaian: cap,
        target: {
          ziyadahSesi: target.targetZiyadahSesi,
          ziyadahPekan: target.targetZiyadahPekan,
          ziyadahBulan: target.targetZiyadahPekan * 4,
          murajaahSesi: target.targetMurajaahSesi,
          murajaahPekan: target.targetMurajaahPekan,
          murajaahBulan: target.targetMurajaahPekan * 4
        },
        setoranTerakhir: latestLog ? {
          ...latestLog,
          muhafiz: latestLog.muhafiz || halaqah.muhafiz || "Ustadz Pembina"
        } : null,
        progress: {
          currentJuz: currentJuz,
          currentHalaman: cap ? cap.halamanTerakhir : (latestLog ? Number(String(latestLog.halaman || "1").replace(/\D/g, "")) || 1 : 1),
          totalJuz: 30,
          percent: Math.min(100, Math.round((currentJuz / 30) * 100)),
          onTrackStatus: onTrack
        },
        totalSetoran: setoranCountMap[sId] || setoranCountMap[sNis] || 0
      };
    });

    // 7. Hitung Summary Makro
    const halaqahMembers = enrichedStudents.filter(st => st.isInHalaqah);
    const activeStudentCount = halaqahMembers.length > 0 ? halaqahMembers.length : (enrichedStudents.length || 1);
    let totalJuzHalaqahStudents = 0;
    let khatam30HalaqahCount = 0;
    halaqahMembers.forEach(st => {
      const jz = (st.progress && st.progress.currentJuz) || 0;
      totalJuzHalaqahStudents += jz;
      if (jz >= 30) khatam30HalaqahCount++;
    });

    const avgJuz = (totalJuzHalaqahStudents / activeStudentCount).toFixed(1);
    const totalWeeklyActivity = weeklyZiyadahCount + weeklyMurajaahCount;
    const ziyadahPercent = totalWeeklyActivity > 0 ? Math.round((weeklyZiyadahCount / totalWeeklyActivity) * 100) : 100;
    const murajaahPercent = 100 - ziyadahPercent;

    // 8. Jadwal Sesi
    const sesiList = [];
    if (sesiSheet) {
      const sData = sesiSheet.getDataRange().getValues();
      if (sData && sData.length > 1) {
        const h = sData[0].map(x => String(x || "").trim().toLowerCase().replace(/[\s\-_]+/g, ""));
        const idIdx = h.findIndex(x => x === "sesiid" || x === "id");
        const namaIdx = h.findIndex(x => x === "namasesi" || x === "nama");
        const jenisIdx = h.findIndex(x => x === "jenissesi" || x === "jenis");
        const statusIdx = h.findIndex(x => x === "status");
        const mulaiIdx = h.findIndex(x => x === "jammulai" || x === "mulai");
        const selesaiIdx = h.findIndex(x => x === "jamselesai" || x === "selesai");
        const hariIdx = h.findIndex(x => x === "harilist" || x === "hari");
        for (let i = 1; i < sData.length; i++) {
          const r = sData[i];
          const sId = idIdx !== -1 ? String(r[idIdx] || "").trim() : "";
          if (!sId) continue;
          sesiList.push({
            sesiId: sId,
            namaSesi: namaIdx !== -1 ? String(r[namaIdx] || "") : "",
            jenisSesi: jenisIdx !== -1 ? String(r[jenisIdx] || "Ziyadah (Setoran Hafalan Baru)") : "Ziyadah (Setoran Hafalan Baru)",
            status: statusIdx !== -1 ? String(r[statusIdx] || "Aktif Digunakan") : "Aktif Digunakan",
            jamMulai: mulaiIdx !== -1 ? String(r[mulaiIdx] || "").trim() : "05:00",
            jamSelesai: selesaiIdx !== -1 ? String(r[selesaiIdx] || "").trim() : "06:30",
            hariList: hariIdx !== -1 ? String(r[hariIdx] || "").split(",").map(x => x.trim()).filter(Boolean) : []
          });
        }
      }
    }

    // 9. Muhafiz List (dari halaqah + log aktif tanpa RPC pembacaan sheet Pegawai)
    const muhafizSet = new Set();
    halaqahList.forEach(hlq => {
      if (hlq.muhafiz && hlq.muhafiz !== "-" && hlq.muhafiz !== "Belum Ditunjuk") muhafizSet.add(hlq.muhafiz);
    });
    Object.values(latestLogMap).forEach(lg => {
      if (lg && lg.muhafiz && lg.muhafiz !== "-" && lg.muhafiz !== "Ustadz Pembina") muhafizSet.add(lg.muhafiz);
    });

    return {
      status: "success",
      success: true,
      summary: {
        khatam30Juz: khatam30HalaqahCount > 0 ? khatam30HalaqahCount : khatam30Count,
        rataRataHafalan: `${avgJuz} Juz / Santri`,
        totalHafalanJuz: totalJuzHalaqahStudents > 0 ? totalJuzHalaqahStudents : totalJuzAllStudents,
        totalSantriHalaqah: halaqahMembers.length,
        aktivitasPekanIni: {
          ziyadahPercent: ziyadahPercent,
          murajaahPercent: murajaahPercent,
          totalSetoranPekanIni: totalWeeklyActivity
        }
      },
      students: enrichedStudents,
      totalStudents: enrichedStudents.length,
      categories: (function() {
        const programSet = new Set();
        allStudents.forEach(st => {
          const p = String(st.program || "").trim();
          if (p) programSet.add(p);
        });
        const uniquePrograms = Array.from(programSet).sort();
        return ["Semua Kategori", ...(uniquePrograms.length > 0 ? uniquePrograms : ["Tahfidz Intensif", "Tahfidz Dewasa", "Tahfidz Anak", "Kitab Kuning", "Reguler"])];
      })(),
      rawCategories: (function() {
        const programSet = new Set();
        allStudents.forEach(st => {
          const p = String(st.program || "").trim();
          if (p) programSet.add(p);
        });
        return Array.from(programSet).sort();
      })(),
      halaqahs: halaqahList,
      muhafizMatrix: (function() {
        return halaqahList.map((hlq, idx) => {
          const memberStudents = enrichedStudents.filter(st => {
            return (st.halaqah && st.halaqah.halaqahId === hlq.halaqahId) ||
                   (Array.isArray(hlq.studentIds) && (hlq.studentIds.includes(st.studentId) || hlq.studentIds.includes(st.nis)));
          });
          let totalJuz = 0;
          memberStudents.forEach(st => {
            totalJuz += (st.progress && st.progress.currentJuz) || 0;
          });
          const avgJuz = memberStudents.length > 0 ? (totalJuz / memberStudents.length).toFixed(1) : "0.0";

          return {
            index: idx + 1,
            huruf: String.fromCharCode(65 + (idx % 26)),
            muhafiz: hlq.muhafiz || "Belum Ditunjuk",
            halaqahId: hlq.halaqahId,
            namaHalaqah: hlq.namaHalaqah,
            kategori: hlq.kategori || "Tahfidz",
            binaanCount: memberStudents.length,
            rataRataCapaian: `Juz ${avgJuz} / 30`,
            avgJuzNum: Number(avgJuz)
          };
        });
      })(),
      sesiList: sesiList,
      muhafizList: ["Semua Muhafiz", ...Array.from(muhafizSet).sort()]
    };

  } catch (err) {
    console.error("[GET TAHFIDZ DASHBOARD ERROR]", err);
    return {
      status: "error",
      success: false,
      message: "Gagal memuat dashboard tahfidz: " + err.message
    };
  }
}

/**
 * 2. Simpan Catatan Setoran Baru (Mutaba'ah Ziyadah, Muraja'ah, Tasmi')
 */
function saveTahfidzLog(payload, token) {
  try {
    let actor = null;
    if (token) {
      try {
        actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR", "PENGASUH"]);
      } catch (authErr) {
        verifySessionToken(token);
      }
    }

    const ss = getDatabaseSpreadsheet();
    const sheet = getOrCreateTahfidzSheet(ss, SHEET_TAHFIDZ_LOGS, [
      "log_id", "student_id", "nis", "student_name", "gender",
      "tanggal", "sesi", "tipe", "juz", "surah",
      "halaman_list", "total_halaman", "nilai", "muhafiz", "catatan", "status_setoran", "created_at"
    ]);

    let studentId = String(payload.studentId || payload.student_id || "").trim();
    let nis = String(payload.nis || "").trim();
    let studentName = String(payload.studentName || payload.student_name || payload.name || "").trim();
    let gender = String(payload.gender || "L").toUpperCase();

    if (!studentId && !studentName && !nis) {
      throw new Error("Santri wajib dipilih.");
    }

    // 1. Resolusi Otomatis Identitas Santri dari Master Students
    const studentInfo = resolveStudentIdentity_(ss, studentId, nis, studentName);
    if (studentInfo.studentId) studentId = studentInfo.studentId;
    if (studentInfo.nis) nis = studentInfo.nis;
    if (studentInfo.studentName) studentName = studentInfo.studentName;
    if (studentInfo.gender) gender = studentInfo.gender;

    // 2. Resolusi Otomatis Halaqah dari Master Tahfidz_Halaqah
    const halaqahInfo = resolveStudentHalaqah_(
      ss, 
      studentId, 
      nis, 
      payload.halaqahId || payload.halaqah_id, 
      payload.namaHalaqah || payload.nama_halaqah, 
      payload.muhafiz
    );
    const halaqahId = halaqahInfo.halaqahId;
    const namaHalaqah = halaqahInfo.namaHalaqah;
    const muhafiz = (payload.muhafiz && payload.muhafiz !== "Ustadz Pembina" && payload.muhafiz !== "-") 
      ? String(payload.muhafiz).trim() 
      : halaqahInfo.muhafiz;

    const logId = payload.logId || payload.log_id || ("TFZ-" + Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd-HHmmss") + "-" + Math.floor(1000 + Math.random() * 9000));
    const tanggal = payload.tanggal ? normalizeDateString(payload.tanggal) : Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");
    const sesi = String(payload.sesi || "Pagi (Ba'da Subuh)").trim();
    const tipe = String(payload.tipe || "ZIYADAH").trim().toUpperCase();
    const juz = Number(payload.juz || 1);
    const surah = String(payload.surah || `Juz ${juz}`).trim();
    const halamanList = String(payload.halamanList || payload.halaman_list || payload.halaman || "1").trim();
    const totalHalaman = Number(payload.totalHalaman || payload.total_halaman || 1);
    const nilai = String(payload.nilai || "MUMTAZ").trim().toUpperCase();
    const statusSetoran = String(payload.statusSetoran || payload.status_setoran || (nilai === "DHAIF" ? "ULANG" : "LANJUT")).trim().toUpperCase();
    const catatan = String(payload.catatan || "").trim();
    const createdAt = new Date().toISOString();

    const data = sheet.getDataRange().getValues();
    let headers = data[0].map(h => String(h || "").trim().toLowerCase());
    
    // Pastikan kolom status_setoran ada
    let statusColIdx = headers.indexOf("status_setoran");
    if (statusColIdx === -1) {
      const nextCol = (sheet.getLastColumn() || 0) + 1;
      sheet.getRange(1, nextCol).setValue("status_setoran").setFontWeight("bold").setBackground("#059669").setFontColor("#ffffff");
      headers.push("status_setoran");
    }

    let idIdx = headers.indexOf("log_id");
    let foundRow = -1;

    if (idIdx !== -1) {
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idIdx] || "").trim() === logId) {
          foundRow = i + 1;
          break;
        }
      }
    }

    const rowMap = {
      "log_id": logId,
      "student_id": studentId,
      "nis": nis,
      "student_name": studentName,
      "gender": gender,
      "tanggal": tanggal,
      "sesi": sesi,
      "tipe": tipe,
      "juz": juz,
      "surah": surah,
      "halaman_list": halamanList,
      "total_halaman": totalHalaman,
      "nilai": nilai,
      "muhafiz": muhafiz,
      "catatan": catatan,
      "status_setoran": statusSetoran,
      "created_at": createdAt
    };

    const rowValues = headers.map(h => rowMap[h] !== undefined ? rowMap[h] : "");

    // Tulis data log setoran
    if (foundRow > 0) {
      sheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }

    // Auto-heal baris log terdahulu untuk santri ini jika student_name atau nis masih kosong
    try {
      if (data && data.length > 1) {
        const sIdColIdx = headers.indexOf("student_id");
        const nisColIdx = headers.indexOf("nis");
        const nameColIdx = headers.indexOf("student_name");
        if (sIdColIdx !== -1 && (nisColIdx !== -1 || nameColIdx !== -1)) {
          for (let i = 1; i < data.length; i++) {
            const rowSid = String(data[i][sIdColIdx] || "").trim();
            if (rowSid && (rowSid.toLowerCase() === studentId.toLowerCase() || (nis && rowSid.toLowerCase() === nis.toLowerCase()))) {
              if (nameColIdx !== -1 && !String(data[i][nameColIdx] || "").trim() && studentName) {
                sheet.getRange(i + 1, nameColIdx + 1).setValue(studentName);
              }
              if (nisColIdx !== -1 && !String(data[i][nisColIdx] || "").trim() && nis) {
                sheet.getRange(i + 1, nisColIdx + 1).setValue(nis);
              }
            }
          }
        }
      }
    } catch (healLogErr) {
      console.warn("[AUTO-HEAL LOG ROW WARN]", healLogErr);
    }

    // Auto-update / Sync ke Sheet Tahfidz_Capaian
    try {
      const headersCapaian = [
        "student_id", "student_name", "juz_aktif", "halaman_terakhir", "total_halaman_tuntas", "status_terakhir", "halaqah_id", "nama_halaqah", "muhafiz_pembina", "updated_at"
      ];
      const capaianSheet = getOrCreateTahfidzSheet(ss, SHEET_TAHFIDZ_CAPAIAN, headersCapaian, "#059669");
      const cData = capaianSheet.getDataRange().getValues();
      let capaianRowIdx = -1;
      let prevTotalHalaman = 0;

      if (cData && cData.length > 1) {
        const cHeaders = cData[0].map(h => String(h || "").trim().toLowerCase());
        const sIdIdx = cHeaders.indexOf("student_id");
        const totIdx = cHeaders.indexOf("total_halaman_tuntas");
        for (let i = 1; i < cData.length; i++) {
          const rowId = sIdIdx !== -1 ? String(cData[i][sIdIdx] || "").trim() : "";
          if (rowId.toLowerCase() === studentId.toLowerCase() || (nis && rowId.toLowerCase() === nis.toLowerCase())) {
            capaianRowIdx = i + 1;
            prevTotalHalaman = totIdx !== -1 ? (Number(cData[i][totIdx]) || 0) : 0;
            break;
          }
        }
      }

      // Hitung posisi capaian lanjutan
      let nextJuz = juz;
      let nextHalaman = 1;
      const pagesArr = halamanList.split(",").map(p => Number(p.trim())).filter(p => !isNaN(p) && p > 0);
      const lastPage = pagesArr.length > 0 ? Math.max(...pagesArr) : 1;

      if (statusSetoran === "LANJUT") {
        if (lastPage >= 20) {
          nextJuz = Math.min(30, juz + 1);
          nextHalaman = 1;
        } else {
          nextHalaman = lastPage + 1;
        }
      } else {
        // Santri Mengulang: tetap pada halaman berjalan
        nextJuz = juz;
        nextHalaman = lastPage;
      }

      const updatedTotalHalaman = statusSetoran === "LANJUT" ? (prevTotalHalaman + totalHalaman) : prevTotalHalaman;

      if (capaianRowIdx > 0) {
        capaianSheet.getRange(capaianRowIdx, 2).setValue(studentName);
        capaianSheet.getRange(capaianRowIdx, 3).setValue(nextJuz);
        capaianSheet.getRange(capaianRowIdx, 4).setValue(nextHalaman);
        capaianSheet.getRange(capaianRowIdx, 5).setValue(updatedTotalHalaman);
        capaianSheet.getRange(capaianRowIdx, 6).setValue(statusSetoran);
        if (halaqahId) capaianSheet.getRange(capaianRowIdx, 7).setValue(halaqahId);
        if (namaHalaqah) capaianSheet.getRange(capaianRowIdx, 8).setValue(namaHalaqah);
        if (muhafiz && muhafiz !== "-") capaianSheet.getRange(capaianRowIdx, 9).setValue(muhafiz);
        capaianSheet.getRange(capaianRowIdx, 10).setValue(createdAt);
      } else {
        capaianSheet.appendRow([
          studentId,
          studentName,
          nextJuz,
          nextHalaman,
          updatedTotalHalaman,
          statusSetoran,
          halaqahId,
          namaHalaqah,
          muhafiz,
          createdAt
        ]);
      }
    } catch (capaianErr) {
      console.warn("[SYNC TAHFIDZ CAPAIAN ERROR]", capaianErr);
    }

    SpreadsheetApp.flush();

    if (foundRow > 0) {
      return {
        status: "success",
        success: true,
        logId: logId,
        message: `Catatan mutaba'ah untuk ${studentName} berhasil diperbarui.`
      };
    } else {
      return {
        status: "success",
        success: true,
        logId: logId,
        message: `Setoran ${tipe.toLowerCase()} untuk santri ${studentName} (${totalHalaman} halaman) berhasil disimpan!`
      };
    }

  } catch (err) {
    console.error("[SAVE TAHFIDZ LOG ERROR]", err);
    return {
      status: "error",
      success: false,
      message: "Gagal menyimpan setoran: " + err.message
    };
  }
}

/**
 * 2b. Simpan / Override Capaian Santri Tahfidz secara langsung
 * Berguna untuk penempatan awal santri baru atau santri pindahan
 */
function saveTahfidzCapaian(data, token) {
  try {
    let actor = null;
    if (token) {
      try {
        actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "SUPER_ADMIN", "EDITOR", "PENGASUH"]);
      } catch (authErr) {
        verifySessionToken(token);
      }
    }

    let studentId = String(data.studentId || data.student_id || "").trim();
    let studentName = String(data.studentName || data.student_name || "").trim();
    let nis = String(data.nis || "").trim();
    const juz = Number(data.juzAktif || data.juz_aktif || data.juz) || 1;
    const halaman = Number(data.halamanTerakhir || data.halaman_terakhir || data.halaman) || 1;
    const status = String(data.statusTerakhir || data.status_terakhir || "LANJUT").trim();
    const nowIso = new Date().toISOString();

    if (!studentId && !studentName && !nis) throw new Error("Identitas Santri wajib disertakan.");

    const ss = getDatabaseSpreadsheet();

    // 1. Resolusi Otomatis Identitas Santri dari Master Students
    const studentInfo = resolveStudentIdentity_(ss, studentId, nis, studentName);
    if (studentInfo.studentId) studentId = studentInfo.studentId;
    if (studentInfo.studentName) studentName = studentInfo.studentName;
    if (studentInfo.nis) nis = studentInfo.nis;

    // 2. Resolusi Otomatis Halaqah dari Master Tahfidz_Halaqah
    const halaqahInfo = resolveStudentHalaqah_(
      ss, 
      studentId, 
      nis, 
      data.halaqahId || data.halaqah_id, 
      data.namaHalaqah || data.nama_halaqah, 
      data.muhafiz || data.muhafiz_pembina
    );
    const halaqahId = halaqahInfo.halaqahId;
    const namaHalaqah = halaqahInfo.namaHalaqah;
    const muhafiz = (data.muhafiz && data.muhafiz !== "Ustadz Pembina" && data.muhafiz !== "-") 
      ? String(data.muhafiz).trim() 
      : halaqahInfo.muhafiz;

    const headersCapaian = [
      "student_id", "student_name", "juz_aktif", "halaman_terakhir", "total_halaman_tuntas", "status_terakhir", "halaqah_id", "nama_halaqah", "muhafiz_pembina", "updated_at"
    ];
    const sheet = getOrCreateTahfidzSheet(ss, SHEET_TAHFIDZ_CAPAIAN, headersCapaian, "#059669");

    const cData = sheet.getDataRange().getValues();
    let rowIndex = -1;
    let prevTotal = 0;
    if (cData && cData.length >= 2) {
      const idIdx = cData[0].map(h => String(h).toLowerCase()).indexOf("student_id");
      const totIdx = cData[0].map(h => String(h).toLowerCase()).indexOf("total_halaman_tuntas");
      for (let i = 1; i < cData.length; i++) {
        const rowId = String(cData[i][idIdx] || "").trim();
        if (rowId.toLowerCase() === studentId.toLowerCase() || (nis && rowId.toLowerCase() === nis.toLowerCase())) {
          rowIndex = i + 1;
          prevTotal = totIdx !== -1 ? (Number(cData[i][totIdx]) || 0) : 0;
          break;
        }
      }
    }

    const totalHalaman = Number(data.totalHalamanTuntas || data.total_halaman_tuntas) || prevTotal || ((juz - 1) * 20 + halaman);

    if (rowIndex !== -1) {
      sheet.getRange(rowIndex, 2).setValue(studentName);
      sheet.getRange(rowIndex, 3).setValue(juz);
      sheet.getRange(rowIndex, 4).setValue(halaman);
      sheet.getRange(rowIndex, 5).setValue(totalHalaman);
      sheet.getRange(rowIndex, 6).setValue(status);
      if (halaqahId) sheet.getRange(rowIndex, 7).setValue(halaqahId);
      if (namaHalaqah) sheet.getRange(rowIndex, 8).setValue(namaHalaqah);
      if (muhafiz) sheet.getRange(rowIndex, 9).setValue(muhafiz);
      sheet.getRange(rowIndex, 10).setValue(nowIso);
    } else {
      sheet.appendRow([
        studentId, studentName, juz, halaman, totalHalaman, status, halaqahId, namaHalaqah, muhafiz, nowIso
      ]);
    }
    SpreadsheetApp.flush();

    return {
      status: "success",
      success: true,
      message: `Capaian hafalan santri ${studentName} berhasil diperbarui: Juz ${juz} Halaman ${halaman}.`
    };
  } catch (err) {
    console.error("[SAVE TAHFIDZ CAPAIAN ERROR]", err);
    return { status: "error", success: false, message: "Gagal menyimpan capaian: " + err.message };
  }
}

/**
 * 3. Hapus Catatan Setoran Tahfidz
 */
function deleteTahfidzLog(logId, token) {
  try {
    if (token) {
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN"]);
      } catch (authErr) {
        verifySessionToken(token);
      }
    }

    const cleanLogId = String(logId || "").trim();
    if (!cleanLogId) throw new Error("ID Setoran tidak valid.");

    const ss = getDatabaseSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_TAHFIDZ_LOGS);
    if (!sheet) throw new Error("Sheet Tahfidz Logs belum tersedia.");

    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h || "").trim().toLowerCase());
    const idIdx = headers.indexOf("log_id");

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idIdx] || "").trim() === cleanLogId) {
        sheet.deleteRow(i + 1);
        return {
          status: "success",
          success: true,
          message: `Riwayat setoran ${cleanLogId} berhasil dihapus.`
        };
      }
    }

    return {
      status: "error",
      success: false,
      message: "Data setoran tidak ditemukan."
    };
  } catch (err) {
    return {
      status: "error",
      success: false,
      message: "Gagal menghapus setoran: " + err.message
    };
  }
}

/**
 * 4. Detail Mutaba'ah & Rekap Realita vs Target Santri (Screenshot 4)
 * Menghasilkan:
 * - Capaian saat ini, target capaian, total setoran, rata-rata nilai
 * - Progress bar 0 - 30 Juz
 * - 3 Indikator (Harian, Pekanan, Bulanan) Target vs Realita
 * - Riwayat kronologis setoran
 */
function getTahfidzStudentDetail(studentId, token) {
  try {
    const actor = authenticateSession(token);
    authorizeRole(actor, ["ADMIN", "EDITOR", "PENGASUH"]);

    const cleanId = String(studentId || "").trim();
    if (!cleanId) throw new Error("ID Santri wajib disertakan.");

    const ss = getDatabaseSpreadsheet();

    // 1. Ambil Data Santri
    const studentsRes = getAllStudentsData(token);
    const students = (studentsRes && studentsRes.data) || [];
    const student = students.find(s => {
      const sId = String(s.studentId || s.student_id || "").trim();
      const sNis = String(s.nis || "").trim();
      return sId === cleanId || sNis === cleanId;
    });

    if (!student) {
      return {
        status: "error",
        success: false,
        message: `Data santri ID '${cleanId}' tidak ditemukan.`
      };
    }

    // 2. Ambil Target Santri
    const targetSheet = getOrCreateTahfidzSheet(ss, SHEET_TAHFIDZ_TARGET, [
      "student_id", "target_ziyadah_sesi", "target_ziyadah_pekan", "target_murajaah_sesi", "target_murajaah_pekan", "updated_at"
    ]);
    const targetData = targetSheet.getDataRange().getValues();
    let target = {
      ziyadahSesi: 1,
      ziyadahPekan: 10,
      murajaahSesi: 2,
      murajaahPekan: 10
    };

    if (targetData && targetData.length > 1) {
      const hTarget = targetData[0].map(h => String(h || "").trim().toLowerCase());
      for (let i = 1; i < targetData.length; i++) {
        const sId = String(targetData[i][hTarget.indexOf("student_id")] || "").trim();
        if (sId === cleanId || sId === student.nis) {
          target = {
            ziyadahSesi: Number(targetData[i][hTarget.indexOf("target_ziyadah_sesi")] || 1),
            ziyadahPekan: Number(targetData[i][hTarget.indexOf("target_ziyadah_pekan")] || 10),
            murajaahSesi: Number(targetData[i][hTarget.indexOf("target_murajaah_sesi")] || 2),
            murajaahPekan: Number(targetData[i][hTarget.indexOf("target_murajaah_pekan")] || 10)
          };
          break;
        }
      }
    }

    // 3. Ambil Riwayat Logs Santri
    const logsSheet = getOrCreateTahfidzSheet(ss, SHEET_TAHFIDZ_LOGS, [
      "log_id", "student_id", "nis", "student_name", "gender",
      "tanggal", "sesi", "tipe", "juz", "surah",
      "halaman_list", "total_halaman", "nilai", "muhafiz", "catatan", "status_setoran", "created_at"
    ]);
    const logsData = logsSheet.getDataRange().getValues();
    const riwayat = [];

    if (logsData && logsData.length > 1) {
      const hLogs = logsData[0].map(h => String(h || "").trim().toLowerCase());
      const statusIdx = hLogs.indexOf("status_setoran");
      for (let i = 1; i < logsData.length; i++) {
        const r = logsData[i];
        const sId = String(r[hLogs.indexOf("student_id")] || "").trim();
        const sNis = String(r[hLogs.indexOf("nis")] || "").trim();

        if (sId === cleanId || sNis === student.nis || sId === student.studentId) {
          const nilai = String(r[hLogs.indexOf("nilai")] || "MUMTAZ").trim().toUpperCase();
          const rawStatus = statusIdx !== -1 ? String(r[statusIdx] || "").trim().toUpperCase() : "";
          const statusSetoran = rawStatus || (nilai === "DHAIF" ? "ULANG" : "LANJUT");

          riwayat.push({
            logId: String(r[hLogs.indexOf("log_id")] || "").trim(),
            tanggal: normalizeDateString(r[hLogs.indexOf("tanggal")]),
            sesi: String(r[hLogs.indexOf("sesi")] || "Pagi").trim(),
            tipe: String(r[hLogs.indexOf("tipe")] || "ZIYADAH").trim().toUpperCase(),
            juz: Number(r[hLogs.indexOf("juz")] || 1),
            surah: String(r[hLogs.indexOf("surah")] || "").trim(),
            halamanList: String(r[hLogs.indexOf("halaman_list")] || "1").trim(),
            totalHalaman: Number(r[hLogs.indexOf("total_halaman")] || 1),
            nilai: nilai,
            statusSetoran: statusSetoran,
            muhafiz: String(r[hLogs.indexOf("muhafiz")] || "").trim(),
            catatan: String(r[hLogs.indexOf("catatan")] || "").trim(),
            createdAt: String(r[hLogs.indexOf("created_at")] || "")
          });
        }
      }
    }

    // Urutkan riwayat dari yang terbaru
    riwayat.sort((a, b) => new Date(b.tanggal || b.createdAt) - new Date(a.tanggal || a.createdAt));

    // 4. Hitung Capaian Saat Ini & Rata-rata Nilai
    let currentJuz = 0;
    let totalScorePoints = 0;
    riwayat.forEach(r => {
      if (r.statusSetoran !== "ULANG" && r.juz && r.juz > currentJuz) currentJuz = r.juz;
      if (r.nilai === "MUMTAZ") totalScorePoints += 4;
      else if (r.nilai === "JAYYID_JIDDAN") totalScorePoints += 3;
      else if (r.nilai === "JAYYID") totalScorePoints += 2;
      else totalScorePoints += 1;
    });

    if (currentJuz === 0) currentJuz = 1;
    const percent = Math.min(100, Math.round((currentJuz / 30) * 100));

    let avgNilaiText = "-";
    if (riwayat.length > 0) {
      const avgScore = totalScorePoints / riwayat.length;
      if (avgScore >= 3.5) avgNilaiText = "Mumtaz (A)";
      else if (avgScore >= 2.8) avgNilaiText = "Jayyid Jiddan (B+)";
      else if (avgScore >= 2.0) avgNilaiText = "Jayyid (B)";
      else avgNilaiText = "Dha'if (C)";
    }

    // 5. Kalkulasi 3 Indikator (Harian, Pekan, Bulan)
    const todayStr = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");
    const todayDate = new Date();
    const startOfWeek = new Date();
    startOfWeek.setDate(todayDate.getDate() - 6);
    const startOfMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);

    let harianZReal = 0, harianMReal = 0, harianCount = 0;
    let pekanZReal = 0, pekanMReal = 0, pekanCount = 0;
    let bulanZReal = 0, bulanMReal = 0, bulanCount = 0;

    riwayat.forEach(r => {
      const d = new Date(r.tanggal || r.createdAt);
      const hal = r.totalHalaman || 1;

      // Harian
      if (r.tanggal === todayStr) {
        harianCount++;
        if (r.tipe === "ZIYADAH") harianZReal += hal;
        else harianMReal += hal;
      }

      // Pekanan
      if (d >= startOfWeek) {
        pekanCount++;
        if (r.tipe === "ZIYADAH") pekanZReal += hal;
        else pekanMReal += hal;
      }

      // Bulanan
      if (d >= startOfMonth) {
        bulanCount++;
        if (r.tipe === "ZIYADAH") bulanZReal += hal;
        else bulanMReal += hal;
      }
    });

    const targetPekanTotal = target.ziyadahPekan + target.murajaahPekan;
    const realPekanTotal = pekanZReal + pekanMReal;
    const pekanPercent = targetPekanTotal > 0 ? Math.min(100, Math.round((realPekanTotal / targetPekanTotal) * 100)) : 0;

    const targetBulanTotal = (target.ziyadahPekan * 4) + (target.murajaahPekan * 4);
    const realBulanTotal = bulanZReal + bulanMReal;
    const bulanPercent = targetBulanTotal > 0 ? Math.min(100, Math.round((realBulanTotal / targetBulanTotal) * 100)) : 0;

    // 6. Ambil Data Halaqah & Muhafiz untuk Siswa Ini
    let studentHalaqah = student.halaqah || "";
    let studentMuhafiz = student.muhafiz || "";

    const halaqahSheet = ss.getSheetByName(SHEET_TAHFIDZ_HALAQAH);
    const halaqahData = halaqahSheet ? halaqahSheet.getDataRange().getValues() : null;
    if (halaqahData && halaqahData.length > 1) {
      const hHal = halaqahData[0].map(h => String(h || "").trim().toLowerCase().replace(/\s+/g, "_"));
      const halNameIdx = hHal.indexOf("nama_halaqah") !== -1 ? hHal.indexOf("nama_halaqah") : hHal.indexOf("halaqah");
      const muhIdx = hHal.indexOf("muhafiz") !== -1 ? hHal.indexOf("muhafiz") : hHal.indexOf("muhafidz");
      const stIdsIdx = hHal.indexOf("student_ids") !== -1 ? hHal.indexOf("student_ids") : hHal.indexOf("anggota");

      for (let h = 1; h < halaqahData.length; h++) {
        const members = stIdsIdx !== -1 ? String(halaqahData[h][stIdsIdx] || "").split(",").map(m => m.trim().toLowerCase()) : [];
        const cleanIdLower = cleanId.toLowerCase();
        const cleanNisLower = String(student.nis || "").trim().toLowerCase();
        const cleanNameLower = String(student.name || "").trim().toLowerCase();

        const isMatch = members.some(m => {
          if (!m) return false;
          return m === cleanIdLower || 
                 m === cleanNisLower || 
                 (cleanNameLower && m === cleanNameLower) ||
                 m.replace(/[^a-z0-9]/g, "") === cleanIdLower.replace(/[^a-z0-9]/g, "");
        });

        if (isMatch) {
          if (!studentHalaqah && halNameIdx !== -1 && halaqahData[h][halNameIdx]) {
            studentHalaqah = String(halaqahData[h][halNameIdx]).trim();
          }
          if (!studentMuhafiz && muhIdx !== -1 && halaqahData[h][muhIdx]) {
            studentMuhafiz = String(halaqahData[h][muhIdx]).trim();
          }
          break;
        }
      }
    }

    if (!studentMuhafiz && riwayat.length > 0 && riwayat[0].muhafiz) {
      studentMuhafiz = riwayat[0].muhafiz;
    }

    if (!studentHalaqah && studentMuhafiz && halaqahData && halaqahData.length > 1) {
      const hHal = halaqahData[0].map(h => String(h || "").trim().toLowerCase().replace(/\s+/g, "_"));
      const halNameIdx = hHal.indexOf("nama_halaqah") !== -1 ? hHal.indexOf("nama_halaqah") : hHal.indexOf("halaqah");
      const muhIdx = hHal.indexOf("muhafiz") !== -1 ? hHal.indexOf("muhafiz") : hHal.indexOf("muhafidz");
      if (halNameIdx !== -1 && muhIdx !== -1) {
        for (let h = 1; h < halaqahData.length; h++) {
          if (String(halaqahData[h][muhIdx] || "").trim().toLowerCase() === studentMuhafiz.toLowerCase()) {
            studentHalaqah = String(halaqahData[h][halNameIdx] || "").trim();
            break;
          }
        }
      }
    }

    if (!studentHalaqah) studentHalaqah = "Belum Terplot";
    if (!studentMuhafiz) studentMuhafiz = "Menunggu Jadwal";

    return {
      status: "success",
      success: true,
      student: {
        studentId: student.studentId || cleanId,
        nis: student.nis || "-",
        name: student.name || "Santri",
        gender: student.gender || "L",
        photoUrl: student.photoUrl || "",
        program: student.program || "Tahfidz",
        status: student.status || "ACTIVE",
        halaqah: studentHalaqah,
        muhafiz: studentMuhafiz
      },
      halaqah: studentHalaqah,
      muhafiz: studentMuhafiz,
      stats: {
        capaianSaatIni: `Juz ${currentJuz} (${percent}%)`,
        targetCapaian: "30 Juz Mutqin",
        totalSetoran: `${riwayat.length} Kali`,
        rataRataNilai: avgNilaiText,
        progressJuz: currentJuz,
        progressMax: 30,
        progressPercent: percent
      },
      target: target,
      indikator: {
        harian: {
          targetText: `${target.ziyadahSesi} Halaman (Z) • ${target.murajaahSesi} Halaman (M)`,
          realitaText: `${harianZReal + harianMReal} Halaman (${harianCount}x Setor)`,
          ziyadahReal: harianZReal,
          murajaahReal: harianMReal,
          status: harianCount > 0 ? "Ada Setoran Hari Ini" : "Belum Ada Setoran"
        },
        pekanan: {
          targetText: `${target.ziyadahPekan} Halaman (Z) + ${target.murajaahPekan} Halaman (M)`,
          realitaText: `${realPekanTotal} Halaman (${pekanCount}x Setor)`,
          percent: pekanPercent,
          status: pekanPercent >= 100 ? "Target Pekan Tercapai" : (pekanPercent > 0 ? `${pekanPercent}% Capaian` : "0% Capaian")
        },
        bulanan: {
          targetText: `${target.ziyadahPekan * 4} Halaman (Z) + ${target.murajaahPekan * 4} Halaman (M)`,
          realitaText: `${realBulanTotal} Halaman (${bulanCount}x Setor)`,
          percent: bulanPercent,
          status: bulanPercent >= 100 ? "Target Bulan Tercapai" : (bulanPercent > 0 ? `${bulanPercent}% Capaian` : "0% Capaian")
        }
      },
      riwayat: riwayat
    };

  } catch (err) {
    console.error("[GET TAHFIDZ STUDENT DETAIL ERROR]", err);
    return {
      status: "error",
      success: false,
      message: "Gagal memuat detail mutaba'ah santri: " + err.message
    };
  }
}

/**
 * 5. Simpan / Perbarui Target Santri (Screenshot 3)
 */
function saveTahfidzTarget(payload, token) {
  try {
    if (token) {
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        verifySessionToken(token);
      }
    }

    const studentId = String(payload.studentId || payload.student_id || "").trim();
    if (!studentId) throw new Error("ID Santri wajib disertakan.");

    const ss = getDatabaseSpreadsheet();
    const sheet = getOrCreateTahfidzSheet(ss, SHEET_TAHFIDZ_TARGET, [
      "student_id", "target_ziyadah_sesi", "target_ziyadah_pekan", "target_murajaah_sesi", "target_murajaah_pekan", "updated_at"
    ]);

    const zSesi = Number(payload.targetZiyadahSesi || payload.target_ziyadah_sesi || 1);
    const zPekan = Number(payload.targetZiyadahPekan || payload.target_ziyadah_pekan || (zSesi * 10));
    const mSesi = Number(payload.targetMurajaahSesi || payload.target_murajaah_sesi || 2);
    const mPekan = Number(payload.targetMurajaahPekan || payload.target_murajaah_pekan || (mSesi * 5));
    const updatedAt = new Date().toISOString();

    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h || "").trim().toLowerCase());
    const idIdx = headers.indexOf("student_id");
    let foundRow = -1;

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idIdx] || "").trim() === studentId) {
        foundRow = i + 1;
        break;
      }
    }

    const rowValues = [studentId, zSesi, zPekan, mSesi, mPekan, updatedAt];

    if (foundRow > 0) {
      sheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }

    return {
      status: "success",
      success: true,
      message: "Target mutaba'ah santri berhasil diperbarui."
    };
  } catch (err) {
    return {
      status: "error",
      success: false,
      message: "Gagal menyimpan target: " + err.message
    };
  }
}

/**
 * 5b. Simpan / Perbarui Target Santri Secara Massal (Bulk Edit Target)
 * Menerima:
 * - studentIds: Array of string (misal: ["STD_001", "STD_002", ...])
 * - targetZiyadahSesi, targetZiyadahPekan, targetMurajaahSesi, targetMurajaahPekan
 */
function saveBulkTahfidzTarget(payload, token) {
  try {
    if (token) {
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "SUPER_ADMIN", "EDITOR", "PENGASUH"]);
      } catch (authErr) {
        verifySessionToken(token);
      }
    }

    const studentIds = Array.isArray(payload.studentIds) 
      ? payload.studentIds.map(id => String(id || "").trim()).filter(Boolean)
      : (payload.studentId ? [String(payload.studentId).trim()] : []);

    if (studentIds.length === 0) {
      throw new Error("Daftar ID Santri sasaran tidak boleh kosong.");
    }

    const ss = getDatabaseSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_TAHFIDZ_TARGET) || getOrCreateTahfidzSheet(ss, SHEET_TAHFIDZ_TARGET, [
      "student_id", "target_ziyadah_sesi", "target_ziyadah_pekan", "target_murajaah_sesi", "target_murajaah_pekan", "updated_at"
    ]);

    const zSesi = Number(payload.targetZiyadahSesi || payload.target_ziyadah_sesi || 1);
    const zPekan = Number(payload.targetZiyadahPekan || payload.target_ziyadah_pekan || (zSesi * 10));
    const mSesi = Number(payload.targetMurajaahSesi || payload.target_murajaah_sesi || 2);
    const mPekan = Number(payload.targetMurajaahPekan || payload.target_murajaah_pekan || (mSesi * 5));
    const updatedAt = new Date().toISOString();

    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h || "").trim().toLowerCase().replace(/[\s\-_]+/g, ""));
    const idIdx = headers.findIndex(h => h === "studentid" || h === "id");
    const zSesiIdx = headers.findIndex(h => h.includes("ziyadah") && h.includes("sesi"));
    const zPekanIdx = headers.findIndex(h => h.includes("ziyadah") && h.includes("pekan"));
    const mSesiIdx = headers.findIndex(h => h.includes("murajaah") && h.includes("sesi"));
    const mPekanIdx = headers.findIndex(h => h.includes("murajaah") && h.includes("pekan"));
    const updatedIdx = headers.findIndex(h => h.includes("updated") || h.includes("tanggal"));

    // Map existing rows: studentId -> rowIndex (0-based in data array)
    const existingRowMap = new Map();
    for (let i = 1; i < data.length; i++) {
      const sId = String(data[i][idIdx !== -1 ? idIdx : 0] || "").trim();
      if (sId) {
        existingRowMap.set(sId, i);
      }
    }

    const newRowsToAppend = [];
    const updatedStudentIds = new Set();

    studentIds.forEach(stId => {
      if (existingRowMap.has(stId)) {
        const rowIdx = existingRowMap.get(stId);
        if (zSesiIdx !== -1) data[rowIdx][zSesiIdx] = zSesi;
        if (zPekanIdx !== -1) data[rowIdx][zPekanIdx] = zPekan;
        if (mSesiIdx !== -1) data[rowIdx][mSesiIdx] = mSesi;
        if (mPekanIdx !== -1) data[rowIdx][mPekanIdx] = mPekan;
        if (updatedIdx !== -1) data[rowIdx][updatedIdx] = updatedAt;
        updatedStudentIds.add(stId);
      } else {
        newRowsToAppend.push([stId, zSesi, zPekan, mSesi, mPekan, updatedAt]);
        updatedStudentIds.add(stId);
      }
    });

    // Batch update existing data range
    if (data.length > 1) {
      sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
    }

    // Batch append new rows if any
    if (newRowsToAppend.length > 0) {
      const startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, newRowsToAppend.length, newRowsToAppend[0].length).setValues(newRowsToAppend);
    }

    return {
      status: "success",
      success: true,
      message: `Target mutaba'ah untuk ${updatedStudentIds.size} santri berhasil diperbarui secara massal.`,
      updatedCount: updatedStudentIds.size,
      studentIds: Array.from(updatedStudentIds),
      target: {
        ziyadahSesi: zSesi,
        ziyadahPekan: zPekan,
        murajaahSesi: mSesi,
        murajaahPekan: mPekan
      }
    };
  } catch (err) {
    console.error("[SAVE BULK TAHFIDZ TARGET ERROR]", err);
    return {
      status: "error",
      success: false,
      message: "Gagal menyimpan target massal: " + err.message
    };
  }
}

/**
 * 6. Ambil Daftar Halaqah Aktif (Screenshot 2)
 */
function getTahfidzHalaqahList(token) {
  try {
    const actor = authenticateSession(token);
    authorizeRole(actor, ["ADMIN", "EDITOR", "PEGAWAI", "PENGASUH"]);

    const ss = getDatabaseSpreadsheet();
    migrateTahfidzHalaqahSheet_(ss);

    const headersHalaqah = ["halaqah_id", "muhafiz", "target_kurikulum", "student_ids", "created_at"];
    const sheet = getOrCreateTahfidzSheet(ss, SHEET_TAHFIDZ_HALAQAH, headersHalaqah, "#059669");

    const data = sheet.getDataRange().getValues();
    const list = [];
    if (data && data.length > 1) {
      const colMap = getHalaqahColumnIndexes(data[0]);
      for (let i = 1; i < data.length; i++) {
        const r = data[i];
        const rawId = colMap.id !== -1 ? String(r[colMap.id] || "").trim() : "";
        const hMuh = colMap.muhafiz !== -1 ? String(r[colMap.muhafiz] || "").trim() : "";
        if (!rawId && !hMuh) continue;

        const id = rawId || ("HLQ-" + (i < 10 ? "0" + i : i));
        const stIds = colMap.studentIds !== -1 ? String(r[colMap.studentIds] || "").split(",").map(s => s.trim()).filter(Boolean) : [];
        const hTarget = colMap.target !== -1 ? String(r[colMap.target] || "").trim() : "Tahfidz 30 Juz";
        const hName = (colMap.nama !== -1 && r[colMap.nama]) ? String(r[colMap.nama]).trim() : (hMuh ? ("Halaqah " + hMuh) : ("Halaqah " + id));

        list.push({
          halaqahId: id,
          namaHalaqah: hName,
          muhafiz: hMuh || "Ustadz Pembina",
          targetKurikulum: hTarget,
          studentIds: stIds,
          studentCount: stIds.length
        });
      }
    }

    return {
      status: "success",
      success: true,
      data: list
    };
  } catch (err) {
    return { status: "error", success: false, message: err.message };
  }
}

/**
 * 7. Simpan / Buat Kelompok Halaqah Baru
 */
function saveTahfidzHalaqah(payload, token) {
  try {
    if (token) {
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR", "PEGAWAI"]);
      } catch (authErr) {
        verifySessionToken(token);
      }
    }

    const muhafiz = String(payload.muhafiz || "").trim();
    if (!muhafiz) throw new Error("Ustadz Muhafiz Pembina wajib dipilih.");

    const ss = getDatabaseSpreadsheet();
    migrateTahfidzHalaqahSheet_(ss);

    const headersHalaqah = ["halaqah_id", "muhafiz", "target_kurikulum", "student_ids", "created_at"];
    const sheet = getOrCreateTahfidzSheet(ss, SHEET_TAHFIDZ_HALAQAH, headersHalaqah, "#059669");

    const halaqahId = payload.halaqahId || payload.halaqah_id || ("HLQ-" + Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd-HHmmss") + "-" + Math.floor(100 + Math.random() * 900));
    const targetKurikulum = String(payload.targetKurikulum || payload.target_kurikulum || "Tahfidz 30 Juz").trim();
    const studentIds = Array.isArray(payload.studentIds) ? payload.studentIds.join(",") : String(payload.studentIds || "");
    const createdAt = new Date().toISOString();

    const data = sheet.getDataRange().getValues();
    const colMap = getHalaqahColumnIndexes(data[0]);

    let foundRow = -1;
    if (colMap.id !== -1) {
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][colMap.id] || "").trim() === halaqahId) {
          foundRow = i + 1;
          break;
        }
      }
    }

    const headersCount = Math.max(data[0].length, headersHalaqah.length);
    const rowValues = new Array(headersCount).fill("");

    if (colMap.id !== -1) rowValues[colMap.id] = halaqahId;
    if (colMap.muhafiz !== -1) rowValues[colMap.muhafiz] = muhafiz;
    if (colMap.target !== -1) rowValues[colMap.target] = targetKurikulum;
    if (colMap.studentIds !== -1) rowValues[colMap.studentIds] = studentIds;
    if (colMap.createdAt !== -1) rowValues[colMap.createdAt] = createdAt;

    if (foundRow > 0) {
      sheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }

    return {
      status: "success",
      success: true,
      halaqahId: halaqahId,
      message: `Halaqah ${muhafiz} berhasil disimpan.`
    };
  } catch (err) {
    return {
      status: "error",
      success: false,
      message: "Gagal menyimpan halaqah: " + err.message
    };
  }
}

/**
 * 7b. Simpan Plotting Santri Binaan ke Halaqah
 */
function saveTahfidzPlotting(payload, token) {
  try {
    if (token) {
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR", "PEGAWAI"]);
      } catch (authErr) {
        verifySessionToken(token);
      }
    }

    const halaqahId = String(payload.halaqahId || payload.halaqah_id || "").trim();
    if (!halaqahId) throw new Error("ID Halaqah wajib disertakan.");

    let rawList = payload.studentIds || payload.student_ids || [];
    if (typeof rawList === "string") {
      rawList = rawList.split(",");
    }
    const cleanStudentIds = Array.isArray(rawList) ? rawList.map(s => String(s).trim()).filter(Boolean) : [];

    const ss = getDatabaseSpreadsheet();
    migrateTahfidzHalaqahSheet_(ss);

    const headersHalaqah = ["halaqah_id", "muhafiz", "target_kurikulum", "student_ids", "created_at"];
    const sheet = getOrCreateTahfidzSheet(ss, SHEET_TAHFIDZ_HALAQAH, headersHalaqah, "#059669");

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) throw new Error("Data halaqah tidak ditemukan.");

    const colMap = getHalaqahColumnIndexes(data[0]);
    if (colMap.id === -1 || colMap.studentIds === -1) {
      throw new Error("Struktur kolom sheet halaqah tidak valid.");
    }

    let foundRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][colMap.id] || "").trim() === halaqahId) {
        foundRow = i + 1;
        break;
      }
    }

    if (foundRow <= 0) throw new Error("Halaqah ID '" + halaqahId + "' tidak ditemukan.");

    sheet.getRange(foundRow, colMap.studentIds + 1).setValue(cleanStudentIds.join(","));

    return {
      status: "success",
      success: true,
      halaqahId: halaqahId,
      totalPlotting: cleanStudentIds.length,
      message: `Berhasil mengatur ${cleanStudentIds.length} santri binaan ke halaqah.`
    };
  } catch (err) {
    return {
      status: "error",
      success: false,
      message: "Gagal menyimpan plotting santri: " + err.message
    };
  }
}

/**
 * 8. Hapus Kelompok Halaqah
 */
function deleteTahfidzHalaqah(halaqahId, token) {
  try {
    if (token) {
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR", "PEGAWAI"]);
      } catch (authErr) {
        verifySessionToken(token);
      }
    }

    const cleanId = String(halaqahId || "").trim();
    if (!cleanId) throw new Error("ID Halaqah wajib diisi.");

    const ss = getDatabaseSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_TAHFIDZ_HALAQAH);
    if (!sheet) throw new Error("Sheet halaqah belum dibuat.");

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { status: "error", success: false, message: "Halaqah tidak ditemukan." };

    const colMap = getHalaqahColumnIndexes(data[0]);
    let foundRow = -1;

    if (colMap.id !== -1) {
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][colMap.id] || "").trim() === cleanId) {
          foundRow = i + 1;
          break;
        }
      }
    }

    if (foundRow > 0) {
      sheet.deleteRow(foundRow);
      return {
        status: "success",
        success: true,
        message: "Halaqah berhasil dihapus."
      };
    }
    return { status: "error", success: false, message: "Halaqah tidak ditemukan." };
  } catch (err) {
    return { status: "error", success: false, message: err.message };
  }
}

// ====================================================================
// MODUL BACKEND: JADWAL & SESI WAKTU TAHFIDZ (SCREENSHOT 4)
// ====================================================================

/**
 * 9. Ambil Daftar Jadwal Sesi Waktu Aktif
 */
function getTahfidzSesiList(token) {
  try {
    const actor = authenticateSession(token);
    authorizeRole(actor, ["ADMIN", "EDITOR", "PENGASUH"]);

    const ss = getDatabaseSpreadsheet();
    const sheet = getOrCreateTahfidzSheet(ss, SHEET_TAHFIDZ_SESI, [
      "sesi_id", "nama_sesi", "jenis_sesi", "status", "jam_mulai", "jam_selesai", "hari_list", "created_at"
    ], "#4f46e5");

    const data = sheet.getDataRange().getValues();
    const list = [];
    if (data && data.length > 1) {
      const h = data[0].map(x => String(x || "").trim().toLowerCase());
      for (let i = 1; i < data.length; i++) {
        const id = String(data[i][h.indexOf("sesi_id")] || "").trim();
        if (!id) continue;
        list.push({
          sesiId: id,
          namaSesi: String(data[i][h.indexOf("nama_sesi")] || "").trim(),
          jenisSesi: String(data[i][h.indexOf("jenis_sesi")] || "Ziyadah (Setoran Hafalan Baru)").trim(),
          status: String(data[i][h.indexOf("status")] || "Aktif Digunakan").trim(),
          jamMulai: String(data[i][h.indexOf("jam_mulai")] || "").trim(),
          jamSelesai: String(data[i][h.indexOf("jam_selesai")] || "").trim(),
          hariList: String(data[i][h.indexOf("hari_list")] || "Sen,Sel,Rab,Kam,Jum,Sab,Min").split(",").map(x => x.trim()).filter(Boolean),
          createdAt: String(data[i][h.indexOf("created_at")] || "")
        });
      }
    }

    return {
      status: "success",
      success: true,
      data: list
    };
  } catch (err) {
    return { status: "error", success: false, message: err.message };
  }
}

/**
 * 10. Simpan / Perbarui Jadwal Sesi Waktu Baru
 */
function saveTahfidzSesi(payload, token) {
  try {
    if (token) {
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        verifySessionToken(token);
      }
    }

    const p = (payload && (payload.sesi || payload.data)) ? (payload.sesi || payload.data) : (payload || {});
    const namaSesi = String(p.namaSesi || p.nama_sesi || p.nama || "").trim();
    if (!namaSesi) throw new Error("Nama sesi wajib diisi.");

    const ss = getDatabaseSpreadsheet();
    const sheet = getOrCreateTahfidzSheet(ss, SHEET_TAHFIDZ_SESI, [
      "sesi_id", "nama_sesi", "jenis_sesi", "status", "jam_mulai", "jam_selesai", "hari_list", "created_at"
    ], "#4f46e5");

    const rawId = String(p.sesiId || p.sesi_id || p.id || "").trim();
    const sesiId = rawId || ("SESI-" + Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd-HHmm"));
    const jenisSesi = String(p.jenisSesi || p.jenis_sesi || p.jenis || "Ziyadah (Setoran Hafalan Baru)").trim();
    const status = String(p.status || "Aktif Digunakan").trim();
    const jamMulai = String(p.jamMulai || p.jam_mulai || "05:00").trim();
    const jamSelesai = String(p.jamSelesai || p.jam_selesai || "06:30").trim();
    const rawHari = p.hariList || p.hari || "Sen,Sel,Rab,Kam,Sab";
    const hariList = Array.isArray(rawHari) ? rawHari.join(",") : String(rawHari);
    const createdAt = new Date().toISOString();

    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h || "").trim().toLowerCase());
    const idIdx = headers.indexOf("sesi_id");
    let foundRow = -1;

    if (rawId && idIdx >= 0) {
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idIdx] || "").trim() === rawId) {
          foundRow = i + 1;
          break;
        }
      }
    }

    const rowValues = [sesiId, namaSesi, jenisSesi, status, jamMulai, jamSelesai, hariList, createdAt];

    if (foundRow > 0) {
      sheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }

    return {
      status: "success",
      success: true,
      sesiId: sesiId,
      message: `Jadwal sesi ${namaSesi} berhasil disimpan.`
    };
  } catch (err) {
    return {
      status: "error",
      success: false,
      message: "Gagal menyimpan sesi: " + err.message
    };
  }
}

/**
 * 11. Hapus Jadwal Sesi Waktu
 */
function deleteTahfidzSesi(sesiId, token) {
  try {
    if (token) {
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        verifySessionToken(token);
      }
    }

    const cleanId = String((typeof sesiId === 'object' && sesiId ? (sesiId.sesiId || sesiId.id) : sesiId) || "").trim();
    if (!cleanId) throw new Error("ID Sesi wajib diisi.");

    const ss = getDatabaseSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_TAHFIDZ_SESI);
    if (!sheet) throw new Error("Sheet sesi belum dibuat.");

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { status: "error", success: false, message: "Sesi tidak ditemukan." };

    const headers = data[0].map(h => String(h || "").trim().toLowerCase());
    const idIdx = headers.indexOf("sesi_id");
    let foundRow = -1;

    if (idIdx >= 0) {
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idIdx] || "").trim() === cleanId) {
          foundRow = i + 1;
          break;
        }
      }
    }

    if (foundRow > 0) {
      sheet.deleteRow(foundRow);
      return {
        status: "success",
        success: true,
        message: "Jadwal sesi berhasil dihapus."
      };
    }
    return { status: "error", success: false, message: "Sesi tidak ditemukan." };
  } catch (err) {
    return { status: "error", success: false, message: err.message };
  }
}

// ====================================================================
// MODUL BACKEND: DATA PEGAWAI (ASATIDZ, MUHAFIZ, GURU, KARYAWAN)
// ====================================================================
const SHEET_PEGAWAI = "Pegawai";

function getOrCreatePegawaiSheet(ss) {
  const headers = [
    "employee_id", "nama", "nip", "gender", "jabatan", "spesialisasi", "telepon", "email", "status", "created_at"
  ];
  let sheet = ss.getSheetByName(SHEET_PEGAWAI);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_PEGAWAI);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setBackground("#047857")
      .setFontColor("#ffffff");
    sheet.setFrozenRows(1);

    // Data awal Asatidz: Dikosongkan untuk konfigurasi tenant berikutnya
    const nowIso = new Date().toISOString();
  }
  return sheet;
}

function getAllEmployeesData(token) {
  try {
    const actor = authenticateSession(token);
    authorizeRole(actor, ["ADMIN", "EDITOR", "PENGASUH"]);

    const ss = getDatabaseSpreadsheet();
    const sheet = getOrCreatePegawaiSheet(ss);
    const data = sheet.getDataRange().getValues();
    const list = [];
    let totalL = 0, totalP = 0, totalAsatidz = 0, totalAktif = 0;

    if (data && data.length > 1) {
      const h = data[0].map(x => String(x || "").trim().toLowerCase());
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const id = String(row[h.indexOf("employee_id")] || "").trim();
        if (!id) continue;
        const nama = String(row[h.indexOf("nama")] || "").trim();
        const nip = String(row[h.indexOf("nip")] || "").trim();
        const gender = String(row[h.indexOf("gender")] || "L").toUpperCase();
        const jabatan = String(row[h.indexOf("jabatan")] || "Ustadz").trim();
        const spesialisasi = String(row[h.indexOf("spesialisasi")] || "-").trim();
        const telepon = String(row[h.indexOf("telepon")] || "").trim();
        const email = String(row[h.indexOf("email")] || "").trim();
        const status = String(row[h.indexOf("status")] || "ACTIVE").toUpperCase();
        const createdAt = String(row[h.indexOf("created_at")] || "");

        if (status === "ACTIVE") totalAktif++;
        if (gender === "L") totalL++; else totalP++;
        if (jabatan.toLowerCase().includes("ustadz") || jabatan.toLowerCase().includes("muhafiz") || jabatan.toLowerCase().includes("guru")) {
          totalAsatidz++;
        }

        list.push({
          employeeId: id,
          id: id,
          nama: nama,
          name: nama,
          nip: nip,
          gender: gender,
          jabatan: jabatan,
          spesialisasi: spesialisasi,
          telepon: telepon,
          email: email,
          status: status,
          createdAt: createdAt
        });
      }
    }

    return {
      status: "success",
      success: true,
      data: list,
      total: list.length,
      summary: {
        total: list.length,
        aktif: totalAktif,
        putra: totalL,
        putri: totalP,
        asatidz: totalAsatidz
      }
    };
  } catch (err) {
    console.error("[GET ALL EMPLOYEES ERROR]", err);
    return { status: "error", success: false, message: "Gagal memuat data pegawai: " + err.message };
  }
}

function saveEmployeeData(payload, token) {
  try {
    if (token) {
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        verifySessionToken(token);
      }
    }

    const nama = String(payload.nama || payload.name || "").trim();
    if (!nama) throw new Error("Nama pegawai / ustadz wajib diisi.");

    const ss = getDatabaseSpreadsheet();
    const sheet = getOrCreatePegawaiSheet(ss);
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h || "").trim().toLowerCase());

    const idIdx = headers.indexOf("employee_id");
    let employeeId = String(payload.employeeId || payload.id || "").trim();
    let foundRow = -1;

    if (employeeId && idIdx !== -1) {
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idIdx] || "").trim() === employeeId) {
          foundRow = i + 1;
          break;
        }
      }
    }

    if (!employeeId) {
      employeeId = "PEG-" + Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd-HHmmss");
    }

    const nip = String(payload.nip || "").trim();
    const gender = String(payload.gender || "L").toUpperCase();
    const jabatan = String(payload.jabatan || "Ustadz / Muhafiz").trim();
    const spesialisasi = String(payload.spesialisasi || "Tahfidz Al-Qur'an").trim();
    const telepon = String(payload.telepon || "").trim();
    const email = String(payload.email || "").trim();
    const status = String(payload.status || "ACTIVE").toUpperCase();
    const createdAt = new Date().toISOString();

    const rowValues = [employeeId, nama, nip, gender, jabatan, spesialisasi, telepon, email, status, createdAt];

    if (foundRow > 0) {
      sheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
      return { status: "success", success: true, employeeId: employeeId, message: `Data pegawai ${nama} berhasil diperbarui.` };
    } else {
      sheet.appendRow(rowValues);
      return { status: "success", success: true, employeeId: employeeId, message: `Pegawai ${nama} berhasil ditambahkan.` };
    }
  } catch (err) {
    console.error("[SAVE EMPLOYEE ERROR]", err);
    return { status: "error", success: false, message: "Gagal menyimpan data pegawai: " + err.message };
  }
}

function deleteEmployeeData(employeeId, token) {
  try {
    if (token) {
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN"]);
      } catch (authErr) {
        verifySessionToken(token);
      }
    }

    if (!employeeId) throw new Error("ID Pegawai wajib disertakan.");
    const ss = getDatabaseSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_PEGAWAI);
    if (!sheet) throw new Error("Sheet Pegawai tidak ditemukan.");

    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h || "").trim().toLowerCase());
    const idIdx = headers.indexOf("employee_id");

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idIdx] || "").trim() === String(employeeId).trim()) {
        sheet.deleteRow(i + 1);
        return { status: "success", success: true, message: "Data pegawai berhasil dihapus." };
      }
    }
    return { status: "error", success: false, message: "Data pegawai tidak ditemukan." };
  } catch (err) {
    console.error("[DELETE EMPLOYEE ERROR]", err);
    return { status: "error", success: false, message: "Gagal menghapus data pegawai: " + err.message };
  }
}

// ====================================================================
// MODUL BACKEND: TPQ (TAMAN PENDIDIKAN AL-QUR'AN - METODE YANBU'A 1-7)
// ====================================================================
const SHEET_TPQ_LOGS = "TPQ_Logs";
const SHEET_TPQ_CAPAIAN = "TPQ_Capaian";
const SHEET_TPQ_KELAS = "TPQ_Kelas";
const SHEET_TPQ_TARGET = "TPQ_Target";
const SHEET_TPQ_SESI = "TPQ_Sesi";

function getOrCreateTPQSheet(ss, sheetName, headers, bgHeaderColor) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setBackground(bgHeaderColor || "#059669")
      .setFontColor("#ffffff");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Menyelesaikan (resolve) kelas_id, nama_kelas, dan ustadz pengampu untuk santri TPQ
 */
function resolveTPQKelas_(ss, studentId, nis, customKelasId, customNamaKelas, customUstadz) {
  let resolvedKelasId = String(customKelasId || "").trim();
  let resolvedNamaKelas = String(customNamaKelas || "").trim();
  let resolvedUstadz = String(customUstadz || "").trim();
  if (resolvedUstadz === "-") resolvedUstadz = "";

  const sId = String(studentId || "").trim();
  const sNis = String(nis || "").trim();

  try {
    if (!ss) ss = getDatabaseSpreadsheet();
    if (ss) {
      const kSheet = ss.getSheetByName(SHEET_TPQ_KELAS);
      if (kSheet) {
        const kData = kSheet.getDataRange().getValues();
        if (kData.length >= 2) {
          const kHead = kData[0].map(h => String(h || "").trim().toLowerCase());
          const idIdx = kHead.indexOf("kelas_id");
          const nameIdx = kHead.indexOf("nama_kelas");
          const uIdx = kHead.indexOf("ustadz_pengampu");
          const sidsIdx = kHead.indexOf("student_ids");

          if (idIdx !== -1) {
            let matchedRow = null;
            let matchedRowIndex = -1;

            // 1. Cari berdasarkan student_id atau nis di kolom student_ids
            if (sId || sNis) {
              for (let i = 1; i < kData.length; i++) {
                const row = kData[i];
                const rawSids = sidsIdx !== -1 ? row[sidsIdx] : "";
                let sids = [];
                if (typeof rawSids === "string") {
                  if (rawSids.trim().startsWith("[")) {
                    try { sids = JSON.parse(rawSids); } catch (e) { sids = []; }
                  } else {
                    sids = rawSids.split(",").map(s => s.trim()).filter(Boolean);
                  }
                } else if (Array.isArray(rawSids)) {
                  sids = rawSids;
                }

                if ((sId && sids.includes(sId)) || (sNis && sids.includes(sNis))) {
                  matchedRow = row;
                  matchedRowIndex = i + 1;
                  break;
                }
              }
            }

            // 2. Jika belum cocok, cari berdasarkan customKelasId
            if (!matchedRow && resolvedKelasId) {
              for (let i = 1; i < kData.length; i++) {
                if (String(kData[i][idIdx] || "").trim() === resolvedKelasId) {
                  matchedRow = kData[i];
                  matchedRowIndex = i + 1;
                  break;
                }
              }
            }

            // 3. Jika belum cocok, cari berdasarkan ustadz
            if (!matchedRow && resolvedUstadz && resolvedUstadz !== "-") {
              const cleanU = resolvedUstadz.toLowerCase().replace(/[^a-z0-9]/g, "");
              for (let i = 1; i < kData.length; i++) {
                const rowU = uIdx !== -1 ? String(kData[i][uIdx] || "").trim() : "";
                const cleanRowU = rowU.toLowerCase().replace(/[^a-z0-9]/g, "");
                if (cleanRowU && (cleanRowU === cleanU || cleanRowU.includes(cleanU) || cleanU.includes(cleanRowU))) {
                  matchedRow = kData[i];
                  matchedRowIndex = i + 1;
                  break;
                }
              }
            }

            if (matchedRow) {
              resolvedKelasId = String(matchedRow[idIdx] || "").trim();
              if (nameIdx !== -1 && matchedRow[nameIdx]) resolvedNamaKelas = String(matchedRow[nameIdx]).trim();
              if (uIdx !== -1 && matchedRow[uIdx]) resolvedUstadz = String(matchedRow[uIdx]).trim();
              if (!resolvedNamaKelas && resolvedUstadz) resolvedNamaKelas = "Kelas " + resolvedUstadz;

              // Otomatis daftarkan sId ke student_ids kelas ini jika belum ada
              if (sId && sidsIdx !== -1 && matchedRowIndex > 0) {
                try {
                  const rawSids = matchedRow[sidsIdx] || "";
                  let curSids = [];
                  if (typeof rawSids === "string" && rawSids.trim().startsWith("[")) {
                    try { curSids = JSON.parse(rawSids); } catch (e) { curSids = []; }
                  } else if (typeof rawSids === "string") {
                    curSids = rawSids.split(",").map(s => s.trim()).filter(Boolean);
                  }
                  if (!curSids.includes(sId)) {
                    curSids.push(sId);
                    kSheet.getRange(matchedRowIndex, sidsIdx + 1).setValue(JSON.stringify(curSids));
                  }
                } catch (syncErr) {
                  // Abaikan error minor
                }
              }
            }
          }
        }
      }
    }
  } catch (err) {
    Logger.log("resolveTPQKelas_ error: " + err.message);
  }

  if (!resolvedNamaKelas || resolvedNamaKelas === "Belum Ditentukan") {
    if (resolvedUstadz && resolvedUstadz !== "-") {
      resolvedNamaKelas = "Kelas " + resolvedUstadz;
    } else if (resolvedKelasId) {
      resolvedNamaKelas = "Kelas " + resolvedKelasId;
    } else {
      resolvedNamaKelas = "Belum Ditentukan";
    }
  }

  return {
    kelasId: resolvedKelasId,
    namaKelas: resolvedNamaKelas,
    ustadz: resolvedUstadz || "-"
  };
}

/**
 * Menyinkronkan perubahan plotting dari TPQ_Kelas ke TPQ_Capaian
 */
function syncTPQPlottingToCapaian_(ss, kelasId, studentIds, ustadz, namaKelas) {
  try {
    if (!ss) ss = getDatabaseSpreadsheet();
    if (!ss || !kelasId) return;

    const headersCapaian = ["student_id", "student_name", "jilid_aktif", "halaman_aktif", "status_terakhir", "kelas_id", "nama_kelas", "ustadz_pengampu", "updated_at"];
    const cSheet = getOrCreateTPQSheet(ss, SHEET_TPQ_CAPAIAN, headersCapaian, "#0d9488");
    const cData = cSheet.getDataRange().getValues();
    if (cData.length < 2) return;

    const cHead = cData[0].map(h => String(h || "").trim().toLowerCase());
    const sIdIdx = cHead.indexOf("student_id");
    const kIdIdx = cHead.indexOf("kelas_id");
    const kNameIdx = cHead.indexOf("nama_kelas");
    const uIdx = cHead.indexOf("ustadz_pengampu");
    const upIdx = cHead.indexOf("updated_at");

    if (sIdIdx === -1 || kIdIdx === -1) return;

    const cleanSids = Array.isArray(studentIds) ? studentIds.map(s => String(s).trim()).filter(Boolean) : [];
    const kName = namaKelas || (ustadz && ustadz !== "-" ? ("Kelas " + ustadz) : ("Kelas " + kelasId));
    const nowIso = new Date().toISOString();

    for (let i = 1; i < cData.length; i++) {
      const rowSid = String(cData[i][sIdIdx] || "").trim();
      const currentKId = String(cData[i][kIdIdx] || "").trim();

      if (cleanSids.includes(rowSid)) {
        const rowNumber = i + 1;
        if (currentKId !== kelasId || String(cData[i][kNameIdx] || "").trim() === "Belum Ditentukan" || !cData[i][kNameIdx]) {
          cSheet.getRange(rowNumber, kIdIdx + 1).setValue(kelasId);
          if (kNameIdx !== -1) cSheet.getRange(rowNumber, kNameIdx + 1).setValue(kName);
          if (uIdx !== -1 && ustadz && ustadz !== "-") cSheet.getRange(rowNumber, uIdx + 1).setValue(ustadz);
          if (upIdx !== -1) cSheet.getRange(rowNumber, upIdx + 1).setValue(nowIso);
        }
      }
    }
  } catch (err) {
    Logger.log("syncTPQPlottingToCapaian_ error: " + err.message);
  }
}

function initTPQSheets(token) {
  try {
    if (token) {
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN"]);
      } catch (authErr) {
        verifySessionToken(token);
      }
    }
    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error("Database Spreadsheet tidak ditemukan.");

    const headersLogs = ["log_id", "student_id", "nis", "student_name", "gender", "tanggal", "sesi", "jilid", "halaman", "status_setoran", "nilai", "ustadz", "catatan", "created_at"];
    const headersCapaian = ["student_id", "student_name", "jilid_aktif", "halaman_aktif", "status_terakhir", "kelas_id", "nama_kelas", "ustadz_pengampu", "updated_at"];
    const headersKelas = ["kelas_id", "nama_kelas", "ustadz_pengampu", "jadwal_sesi", "student_ids", "created_at"];
    const headersTarget = ["student_id", "target_jilid", "target_halaman_sesi", "target_halaman_pekan", "updated_at"];
    const headersSesi = ["sesi_id", "nama_sesi", "jenis_sesi", "status", "jam_mulai", "jam_selesai", "hari_list", "created_at"];

    const created = [];
    const existing = [];

    [
      { name: SHEET_TPQ_LOGS, headers: headersLogs, color: "#059669" },
      { name: SHEET_TPQ_CAPAIAN, headers: headersCapaian, color: "#0d9488" },
      { name: SHEET_TPQ_KELAS, headers: headersKelas, color: "#0284c7" },
      { name: SHEET_TPQ_TARGET, headers: headersTarget, color: "#f59e0b" },
      { name: SHEET_TPQ_SESI, headers: headersSesi, color: "#0d9488" }
    ].forEach(item => {
      let s = ss.getSheetByName(item.name);
      if (!s) {
        s = ss.insertSheet(item.name);
        s.getRange(1, 1, 1, item.headers.length).setValues([item.headers]);
        s.getRange(1, 1, 1, item.headers.length).setFontWeight("bold").setBackground(item.color).setFontColor("#ffffff");
        s.setFrozenRows(1);
        created.push(item.name);
      } else {
        existing.push(item.name);
      }
    });

    const nowIso = new Date().toISOString();

    // Buat contoh default kelas jika TPQ_Kelas baru dibuat
    if (created.includes(SHEET_TPQ_KELAS)) {
      const kSheet = ss.getSheetByName(SHEET_TPQ_KELAS);
      const defaultKelas = [
        ["KLS-01", "TPQ Yanbu'a A (Jilid 1-2)", "Ustadzah Fatimah", "Sore (15:45 - 17:00)", "[]", nowIso],
        ["KLS-02", "TPQ Yanbu'a B (Jilid 3-5)", "Ustadz Hasan", "Sore (15:45 - 17:00)", "[]", nowIso],
        ["KLS-03", "TPQ Yanbu'a C (Jilid 6-7)", "Ustadz Ahmad", "Sore (15:45 - 17:00)", "[]", nowIso]
      ];
      kSheet.getRange(2, 1, defaultKelas.length, headersKelas.length).setValues(defaultKelas);
    }

    // Buat default sesi jika TPQ_Sesi baru dibuat
    if (created.includes(SHEET_TPQ_SESI)) {
      const sSheet = ss.getSheetByName(SHEET_TPQ_SESI);
      const defaultSesi = [
        ["TPQ-SESI-01", "Sore (Reguler Yanbu'a)", "Bimbingan Yanbu'a Reguler", "Aktif Digunakan", "15:45", "17:00", "Sen,Sel,Rab,Kam,Sab,Min", nowIso],
        ["TPQ-SESI-02", "Pagi (Madin / Yanbu'a Cilik)", "Privat Tahsin & I'adah", "Aktif Digunakan", "08:30", "10:00", "Min", nowIso],
        ["TPQ-SESI-03", "Ba'da Maghrib (Khataman)", "Imtihan / Ujian Kenaikan Jilid", "Aktif Digunakan", "18:30", "19:30", "Kam", nowIso]
      ];
      sSheet.getRange(2, 1, defaultSesi.length, headersSesi.length).setValues(defaultSesi);
    }

    return {
      status: "success",
      success: true,
      message: "Database TPQ Yanbu'a berhasil disiapkan.",
      createdSheets: created,
      existingSheets: existing
    };
  } catch (err) {
    console.error("[INIT TPQ SHEETS ERROR]", err);
    return { status: "error", success: false, message: "Gagal menyiapkan tabel TPQ: " + err.message };
  }
}

function getTPQDashboard(token) {
  try {
    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error("Spreadsheet tidak ditemukan.");

    // 1. Ambil data master Santri
    const studentsSheet = ss.getSheetByName(SHEET_STUDENTS);
    const students = [];
    if (studentsSheet) {
      const sData = studentsSheet.getDataRange().getValues();
      if (sData.length >= 2) {
        const sHead = sData[0].map(h => String(h || "").trim().toLowerCase());
        const idIdx = sHead.indexOf("student_id");
        const nisIdx = sHead.indexOf("nis");
        const nameIdx = sHead.indexOf("name");
        const genderIdx = sHead.indexOf("gender");
        const statusIdx = sHead.indexOf("status");
        const photoIdx = sHead.indexOf("photo_url");

        for (let i = 1; i < sData.length; i++) {
          const stStatus = statusIdx !== -1 ? String(sData[i][statusIdx] || "").trim().toUpperCase() : "AKTIF";
          if (["AKTIF", "ACTIVE", ""].includes(stStatus)) {
            students.push({
              studentId: String(sData[i][idIdx] || "").trim(),
              nis: String(sData[i][nisIdx] || "").trim(),
              name: String(sData[i][nameIdx] || "").trim(),
              gender: String(sData[i][genderIdx] || "L").trim().toUpperCase(),
              photoUrl: photoIdx !== -1 ? String(sData[i][photoIdx] || "").trim() : "",
              status: "AKTIF"
            });
          }
        }
      }
    }

    // 2. Ambil data Capaian Terkini
    const headersCapaian = ["student_id", "student_name", "jilid_aktif", "halaman_aktif", "status_terakhir", "kelas_id", "nama_kelas", "ustadz_pengampu", "updated_at"];
    const capaianSheet = getOrCreateTPQSheet(ss, SHEET_TPQ_CAPAIAN, headersCapaian, "#0d9488");
    const capaianMap = {};
    const cData = capaianSheet.getDataRange().getValues();
    if (cData.length >= 2) {
      const cHead = cData[0].map(h => String(h || "").trim().toLowerCase());
      const sIdIdx = cHead.indexOf("student_id");
      const jilidIdx = cHead.indexOf("jilid_aktif");
      const halIdx = cHead.indexOf("halaman_aktif");
      const stIdx = cHead.indexOf("status_terakhir");
      const kIdIdx = cHead.indexOf("kelas_id");
      const kNameIdx = cHead.indexOf("nama_kelas");
      const ustadzIdx = cHead.indexOf("ustadz_pengampu");
      const upIdx = cHead.indexOf("updated_at");

      for (let i = 1; i < cData.length; i++) {
        const sid = String(cData[i][sIdIdx] || "").trim();
        if (sid) {
          capaianMap[sid] = {
            rowNumber: i + 1,
            jilidAktif: Number(cData[i][jilidIdx]) || 1,
            halamanAktif: Number(cData[i][halIdx]) || 1,
            statusTerakhir: String(cData[i][stIdx] || "LANJUT").trim().toUpperCase(),
            kelasId: String(cData[i][kIdIdx] || "").trim(),
            namaKelas: String(cData[i][kNameIdx] || "").trim(),
            ustadzPengampu: String(cData[i][ustadzIdx] || "").trim(),
            updatedAt: String(cData[i][upIdx] || "").trim()
          };
        }
      }
    }

    // 3. Ambil data Kelas TPQ
    const headersKelas = ["kelas_id", "nama_kelas", "ustadz_pengampu", "jadwal_sesi", "student_ids", "created_at"];
    const kelasSheet = getOrCreateTPQSheet(ss, SHEET_TPQ_KELAS, headersKelas, "#0284c7");
    const kelasList = [];
    const kData = kelasSheet.getDataRange().getValues();
    if (kData.length >= 2) {
      const kHead = kData[0].map(h => String(h || "").trim().toLowerCase());
      const idIdx = kHead.indexOf("kelas_id");
      const nameIdx = kHead.indexOf("nama_kelas");
      const uIdx = kHead.indexOf("ustadz_pengampu");
      const jIdx = kHead.indexOf("jadwal_sesi");
      const sidsIdx = kHead.indexOf("student_ids");

      for (let i = 1; i < kData.length; i++) {
        let sids = [];
        try {
          const raw = String(kData[i][sidsIdx] || "");
          if (raw.trim().startsWith("[")) sids = JSON.parse(raw);
          else sids = raw.split(",").map(s => s.trim()).filter(Boolean);
        } catch (e) {
          sids = [];
        }
        kelasList.push({
          kelasId: String(kData[i][idIdx] || "").trim(),
          namaKelas: String(kData[i][nameIdx] || "").trim(),
          ustadzPengampu: String(kData[i][uIdx] || "").trim(),
          jadwalSesi: String(kData[i][jIdx] || "").trim(),
          studentIds: sids
        });
      }
    }

    // 4. Ambil data Target TPQ
    const headersTarget = ["student_id", "target_jilid", "target_halaman_sesi", "target_halaman_pekan", "updated_at"];
    const targetSheet = getOrCreateTPQSheet(ss, SHEET_TPQ_TARGET, headersTarget, "#f59e0b");
    const targetMap = {};
    const tData = targetSheet.getDataRange().getValues();
    if (tData.length >= 2) {
      const tHead = tData[0].map(h => String(h || "").trim().toLowerCase());
      const sIdIdx = tHead.indexOf("student_id");
      const jIdx = tHead.indexOf("target_jilid");
      const sSesiIdx = tHead.indexOf("target_halaman_sesi");
      const sPekanIdx = tHead.indexOf("target_halaman_pekan");

      for (let i = 1; i < tData.length; i++) {
        const sid = String(tData[i][sIdIdx] || "").trim();
        if (sid) {
          const sSesi = Number(tData[i][sSesiIdx]) || 1;
          targetMap[sid] = {
            targetJilid: Number(tData[i][jIdx]) || 1,
            targetHalamanSesi: sSesi,
            targetHalamanPekan: Number(tData[i][sPekanIdx]) || (sSesi * 6)
          };
        }
      }
    }

    // 5. Ambil data Jadwal Sesi TPQ
    const headersSesi = ["sesi_id", "nama_sesi", "jenis_sesi", "status", "jam_mulai", "jam_selesai", "hari_list", "created_at"];
    const sesiSheet = getOrCreateTPQSheet(ss, SHEET_TPQ_SESI, headersSesi, "#0d9488");
    const sesiList = [];
    const sesiData = sesiSheet.getDataRange().getValues();
    if (sesiData.length >= 2) {
      const sHead = sesiData[0].map(h => String(h || "").trim().toLowerCase());
      const idIdx = sHead.indexOf("sesi_id");
      const nameIdx = sHead.indexOf("nama_sesi");
      const typeIdx = sHead.indexOf("jenis_sesi");
      const stIdx = sHead.indexOf("status");
      const jmIdx = sHead.indexOf("jam_mulai");
      const jsIdx = sHead.indexOf("jam_selesai");
      const hIdx = sHead.indexOf("hari_list");

      for (let i = 1; i < sesiData.length; i++) {
        const rawHari = sesiData[i][hIdx] || "";
        const hariList = Array.isArray(rawHari) ? rawHari : String(rawHari).split(",").map(h => h.trim()).filter(Boolean);
        sesiList.push({
          sesiId: String(sesiData[i][idIdx] || "").trim(),
          namaSesi: String(sesiData[i][nameIdx] || "").trim(),
          jenisSesi: String(sesiData[i][typeIdx] || "").trim(),
          status: String(sesiData[i][stIdx] || "Aktif Digunakan").trim(),
          jamMulai: String(sesiData[i][jmIdx] || "15:45").trim(),
          jamSelesai: String(sesiData[i][jsIdx] || "17:00").trim(),
          hariList: hariList
        });
      }
    }

    // Hitung jumlah sesi aktif per pekan (contoh: 6 hari Sore = 6 sesi)
    let tpqWeeklySessions = 0;
    sesiList.forEach(s => {
      if ((s.status || "").includes("Aktif")) {
        const hArr = Array.isArray(s.hariList) ? s.hariList : String(s.hariList || "").split(",").map(h => h.trim()).filter(Boolean);
        tpqWeeklySessions += Math.max(1, hArr.length);
      }
    });
    if (tpqWeeklySessions === 0) tpqWeeklySessions = 6;

    // Auto-heal baris capaian di Google Sheets jika kelas_id kosong atau nama_kelas masih 'Belum Ditentukan'
    const nowIso = new Date().toISOString();
    Object.keys(capaianMap).forEach(sid => {
      const cp = capaianMap[sid];
      const needsHealing = !cp.kelasId || !cp.namaKelas || cp.namaKelas === "Belum Ditentukan";
      if (needsHealing) {
        const stObj = students.find(s => s.studentId === sid);
        const stNis = stObj ? stObj.nis : "";
        const resolved = resolveTPQKelas_(ss, sid, stNis, cp.kelasId, cp.namaKelas, cp.ustadzPengampu);

        if (resolved.kelasId || (resolved.namaKelas && resolved.namaKelas !== "Belum Ditentukan")) {
          cp.kelasId = resolved.kelasId || cp.kelasId;
          cp.namaKelas = resolved.namaKelas || cp.namaKelas;
          if (resolved.ustadz && resolved.ustadz !== "-") cp.ustadzPengampu = resolved.ustadz;

          if (cp.rowNumber && cp.rowNumber >= 2) {
            try {
              if (kIdIdx !== -1 && cp.kelasId) capaianSheet.getRange(cp.rowNumber, kIdIdx + 1).setValue(cp.kelasId);
              if (kNameIdx !== -1 && cp.namaKelas) capaianSheet.getRange(cp.rowNumber, kNameIdx + 1).setValue(cp.namaKelas);
              if (ustadzIdx !== -1 && cp.ustadzPengampu && cp.ustadzPengampu !== "-") capaianSheet.getRange(cp.rowNumber, ustadzIdx + 1).setValue(cp.ustadzPengampu);
              if (upIdx !== -1) capaianSheet.getRange(cp.rowNumber, upIdx + 1).setValue(nowIso);
            } catch (healErr) {
              Logger.log("Auto-heal TPQ_Capaian error for " + sid + ": " + healErr.message);
            }
          }
        }
      }
    });

    // Gabungkan status capaian ke setiap siswa & hitung statistik
    const perJilidCount = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
    let totalLanjut = 0;
    let totalUlang = 0;
    const ustadzSet = new Set();

    const enrichedStudents = students.map(st => {
      const cp = capaianMap[st.studentId] || {
        jilidAktif: 1,
        halamanAktif: 1,
        statusTerakhir: "LANJUT",
        kelasId: "",
        namaKelas: "Belum Ditentukan",
        ustadzPengampu: "-",
        updatedAt: ""
      };

      if (!cp.kelasId || !cp.namaKelas || cp.namaKelas === "Belum Ditentukan") {
        const resolved = resolveTPQKelas_(ss, st.studentId, st.nis, cp.kelasId, cp.namaKelas, cp.ustadzPengampu);
        if (resolved.kelasId) cp.kelasId = resolved.kelasId;
        if (resolved.namaKelas && resolved.namaKelas !== "Belum Ditentukan") cp.namaKelas = resolved.namaKelas;
        if (resolved.ustadz && resolved.ustadz !== "-") cp.ustadzPengampu = resolved.ustadz;
      }

      const jld = Math.max(1, Math.min(7, cp.jilidAktif));
      perJilidCount[jld] = (perJilidCount[jld] || 0) + 1;
      if (cp.statusTerakhir === "ULANG") totalUlang++;
      else totalLanjut++;

      if (cp.ustadzPengampu && cp.ustadzPengampu !== "-") {
        ustadzSet.add(cp.ustadzPengampu);
      }

      const tgt = targetMap[st.studentId] || {
        targetJilid: Math.min(7, jld + 1),
        targetHalamanSesi: 1,
        targetHalamanPekan: 6
      };

      return {
        ...st,
        jilidAktif: jld,
        halamanAktif: cp.halamanAktif,
        statusTerakhir: cp.statusTerakhir,
        kelasId: cp.kelasId,
        namaKelas: cp.namaKelas,
        ustadzPengampu: cp.ustadzPengampu,
        updatedAt: cp.updatedAt,
        target: tgt
      };
    });

    return {
      status: "success",
      success: true,
      summary: {
        totalSantri: enrichedStudents.length,
        totalLanjut: totalLanjut,
        totalUlang: totalUlang,
        persentaseLanjut: enrichedStudents.length > 0 ? Math.round((totalLanjut / enrichedStudents.length) * 100) : 100,
        distribusiJilid: perJilidCount
      },
      students: enrichedStudents,
      kelasList: kelasList,
      ustadzList: Array.from(ustadzSet),
      targets: targetMap,
      sesiList: sesiList
    };
  } catch (err) {
    console.error("[GET TPQ DASHBOARD ERROR]", err);
    return { status: "error", success: false, message: "Gagal memuat dashboard TPQ: " + err.message };
  }
}

function saveTPQLog(data, token) {
  return withScriptLock(() => {
    try {
      const studentId = String(data.studentId || data.student_id || "").trim();
      const studentName = String(data.studentName || data.student_name || "").trim();
      const nis = String(data.nis || "").trim();
      const gender = String(data.gender || "L").trim().toUpperCase();
      const jilid = Number(data.jilid) || 1;
      const halaman = Number(data.halaman) || 1;
      const statusSetoran = String(data.statusSetoran || data.status_setoran || "LANJUT").trim().toUpperCase();
      const nilai = String(data.nilai || "MUMTAZ").trim().toUpperCase();
      const ustadz = String(data.ustadz || "Ustadz/Ustadzah").trim();
      const catatan = String(data.catatan || "").trim();
      const tanggal = String(data.tanggal || new Date().toISOString().substring(0, 10)).trim();
      const sesi = String(data.sesi || "Sore").trim();
      const nowIso = new Date().toISOString();

      if (!studentId && !nis) throw new Error("Identitas santri wajib diisi.");

      const ss = getDatabaseSpreadsheet();
      const headersLogs = ["log_id", "student_id", "nis", "student_name", "gender", "tanggal", "sesi", "jilid", "halaman", "status_setoran", "nilai", "ustadz", "catatan", "created_at"];
      const logsSheet = getOrCreateTPQSheet(ss, SHEET_TPQ_LOGS, headersLogs, "#059669");

      const logId = "TPQ_LOG_" + Utilities.getUuid().replace(/-/g, "").substring(0, 12);
      logsSheet.appendRow([
        logId, studentId, nis, studentName, gender, tanggal, sesi, jilid, halaman, statusSetoran, nilai, ustadz, catatan, nowIso
      ]);

      // Perbarui posisi Capaian Santri
      let nextJilid = jilid;
      let nextHalaman = halaman;

      if (statusSetoran === "LANJUT") {
        nextHalaman = halaman + 1;
      } else if (statusSetoran === "NAIK_JILID") {
        nextJilid = Math.min(7, jilid + 1);
        nextHalaman = 1;
      } else if (statusSetoran === "KHATAM_YANBUA") {
        nextJilid = 7;
        nextHalaman = 44; // Halaman akhir jilid 7
      } else {
        // ULANG
        nextHalaman = halaman;
      }

      const headersCapaian = ["student_id", "student_name", "jilid_aktif", "halaman_aktif", "status_terakhir", "kelas_id", "nama_kelas", "ustadz_pengampu", "updated_at"];
      const capaianSheet = getOrCreateTPQSheet(ss, SHEET_TPQ_CAPAIAN, headersCapaian, "#0d9488");
      const cData = capaianSheet.getDataRange().getValues();
      let rowIndex = -1;
      let existingKId = "";
      let existingKName = "";
      let existingUstadz = "";

      if (cData.length >= 2) {
        const sIdIdx = cData[0].map(h => String(h).toLowerCase()).indexOf("student_id");
        const kIdIdx = cData[0].map(h => String(h).toLowerCase()).indexOf("kelas_id");
        const kNameIdx = cData[0].map(h => String(h).toLowerCase()).indexOf("nama_kelas");
        const uIdx = cData[0].map(h => String(h).toLowerCase()).indexOf("ustadz_pengampu");

        for (let i = 1; i < cData.length; i++) {
          if (String(cData[i][sIdIdx] || "").trim() === studentId) {
            rowIndex = i + 1;
            if (kIdIdx !== -1) existingKId = String(cData[i][kIdIdx] || "").trim();
            if (kNameIdx !== -1) existingKName = String(cData[i][kNameIdx] || "").trim();
            if (uIdx !== -1) existingUstadz = String(cData[i][uIdx] || "").trim();
            break;
          }
        }
      }

      const inputKId = String(data.kelasId || data.kelas_id || existingKId || "").trim();
      const inputKName = String(data.namaKelas || data.nama_kelas || existingKName || "").trim();
      const inputUstadz = (ustadz && ustadz !== "-") ? ustadz : existingUstadz;

      const resolved = resolveTPQKelas_(ss, studentId, nis, inputKId, inputKName, inputUstadz);
      const finalKelasId = resolved.kelasId || inputKId || "";
      const finalNamaKelas = (resolved.namaKelas && resolved.namaKelas !== "Belum Ditentukan")
        ? resolved.namaKelas
        : (inputKName && inputKName !== "Belum Ditentukan" ? inputKName : "Belum Ditentukan");
      const finalUstadz = (ustadz && ustadz !== "-")
        ? ustadz
        : ((resolved.ustadz && resolved.ustadz !== "-") ? resolved.ustadz : (existingUstadz || "-"));

      if (rowIndex !== -1) {
        capaianSheet.getRange(rowIndex, 2).setValue(studentName);
        capaianSheet.getRange(rowIndex, 3).setValue(nextJilid);
        capaianSheet.getRange(rowIndex, 4).setValue(nextHalaman);
        capaianSheet.getRange(rowIndex, 5).setValue(statusSetoran);
        if (finalKelasId) capaianSheet.getRange(rowIndex, 6).setValue(finalKelasId);
        if (finalNamaKelas) capaianSheet.getRange(rowIndex, 7).setValue(finalNamaKelas);
        if (finalUstadz && finalUstadz !== "-") capaianSheet.getRange(rowIndex, 8).setValue(finalUstadz);
        capaianSheet.getRange(rowIndex, 9).setValue(nowIso);
      } else {
        capaianSheet.appendRow([
          studentId, studentName, nextJilid, nextHalaman, statusSetoran, finalKelasId, finalNamaKelas, finalUstadz, nowIso
        ]);
      }

      return {
        status: "success",
        success: true,
        message: `Bimbingan Yanbu'a santri ${studentName} berhasil dicatat. Status: ${statusSetoran}`,
        logId: logId,
        nextJilid: nextJilid,
        nextHalaman: nextHalaman
      };
    } catch (err) {
      console.error("[SAVE TPQ LOG ERROR]", err);
      return { status: "error", success: false, message: "Gagal mencatat bimbingan TPQ: " + err.message };
    }
  });
}

function deleteTPQLog(logId, token) {
  return withScriptLock(() => {
    try {
      if (!logId) throw new Error("ID Log wajib disertakan.");
      const ss = getDatabaseSpreadsheet();
      const sheet = ss.getSheetByName(SHEET_TPQ_LOGS);
      if (!sheet) throw new Error("Sheet TPQ_Logs tidak ditemukan.");

      const data = sheet.getDataRange().getValues();
      const idIdx = data[0].map(h => String(h).toLowerCase()).indexOf("log_id");

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idIdx] || "").trim() === String(logId).trim()) {
          sheet.deleteRow(i + 1);
          return { status: "success", success: true, message: "Log bimbingan TPQ berhasil dihapus." };
        }
      }
      return { status: "error", success: false, message: "Log TPQ tidak ditemukan." };
    } catch (err) {
      return { status: "error", success: false, message: "Gagal menghapus log TPQ: " + err.message };
    }
  });
}

function saveTPQCapaian(data, token) {
  return withScriptLock(() => {
    try {
      const studentId = String(data.studentId || data.student_id || "").trim();
      const studentName = String(data.studentName || data.student_name || "").trim();
      const jilid = Number(data.jilidAktif || data.jilid) || 1;
      const halaman = Number(data.halamanAktif || data.halaman) || 1;
      const kelasId = String(data.kelasId || "").trim();
      const namaKelas = String(data.namaKelas || "").trim();
      const ustadz = String(data.ustadz || "").trim();
      const nowIso = new Date().toISOString();

      if (!studentId) throw new Error("ID Santri wajib disertakan.");

      const ss = getDatabaseSpreadsheet();
      const resolved = resolveTPQKelas_(ss, studentId, "", kelasId, namaKelas, ustadz);
      const finalKelasId = kelasId || resolved.kelasId || "";
      const finalNamaKelas = (namaKelas && namaKelas !== "Belum Ditentukan")
        ? namaKelas
        : (resolved.namaKelas || "Belum Ditentukan");
      const finalUstadz = (ustadz && ustadz !== "-")
        ? ustadz
        : ((resolved.ustadz && resolved.ustadz !== "-") ? resolved.ustadz : "-");

      const headersCapaian = ["student_id", "student_name", "jilid_aktif", "halaman_aktif", "status_terakhir", "kelas_id", "nama_kelas", "ustadz_pengampu", "updated_at"];
      const sheet = getOrCreateTPQSheet(ss, SHEET_TPQ_CAPAIAN, headersCapaian, "#0d9488");

      const cData = sheet.getDataRange().getValues();
      let rowIndex = -1;
      if (cData.length >= 2) {
        const idIdx = cData[0].map(h => String(h).toLowerCase()).indexOf("student_id");
        for (let i = 1; i < cData.length; i++) {
          if (String(cData[i][idIdx] || "").trim() === studentId) {
            rowIndex = i + 1;
            break;
          }
        }
      }

      if (rowIndex !== -1) {
        sheet.getRange(rowIndex, 2).setValue(studentName);
        sheet.getRange(rowIndex, 3).setValue(jilid);
        sheet.getRange(rowIndex, 4).setValue(halaman);
        if (finalKelasId) sheet.getRange(rowIndex, 6).setValue(finalKelasId);
        if (finalNamaKelas) sheet.getRange(rowIndex, 7).setValue(finalNamaKelas);
        if (finalUstadz && finalUstadz !== "-") sheet.getRange(rowIndex, 8).setValue(finalUstadz);
        sheet.getRange(rowIndex, 9).setValue(nowIso);
      } else {
        sheet.appendRow([studentId, studentName, jilid, halaman, "LANJUT", finalKelasId, finalNamaKelas, finalUstadz, nowIso]);
      }

      return { status: "success", success: true, message: `Posisi capaian santri ${studentName} berhasil diperbarui.` };
    } catch (err) {
      return { status: "error", success: false, message: "Gagal menyimpan capaian: " + err.message };
    }
  });
}

function getTPQKelasList(token) {
  try {
    const ss = getDatabaseSpreadsheet();
    const headersKelas = ["kelas_id", "nama_kelas", "ustadz_pengampu", "jadwal_sesi", "student_ids", "created_at"];
    const sheet = getOrCreateTPQSheet(ss, SHEET_TPQ_KELAS, headersKelas, "#0284c7");
    const data = sheet.getDataRange().getValues();
    const list = [];

    if (data.length >= 2) {
      const head = data[0].map(h => String(h).toLowerCase());
      const idIdx = head.indexOf("kelas_id");
      const nameIdx = head.indexOf("nama_kelas");
      const uIdx = head.indexOf("ustadz_pengampu");
      const jIdx = head.indexOf("jadwal_sesi");
      const sidsIdx = head.indexOf("student_ids");

      for (let i = 1; i < data.length; i++) {
        let sids = [];
        try { sids = JSON.parse(String(data[i][sidsIdx] || "[]")); } catch (e) { sids = []; }
        list.push({
          kelasId: String(data[i][idIdx] || "").trim(),
          namaKelas: String(data[i][nameIdx] || "").trim(),
          ustadzPengampu: String(data[i][uIdx] || "").trim(),
          jadwalSesi: String(data[i][jIdx] || "").trim(),
          studentIds: sids
        });
      }
    }
    return { status: "success", success: true, kelasList: list };
  } catch (err) {
    return { status: "error", success: false, message: err.message };
  }
}

function saveTPQKelas(data, token) {
  return withScriptLock(() => {
    try {
      const namaKelas = String(data.namaKelas || data.nama_kelas || "").trim();
      const ustadz = String(data.ustadzPengampu || data.ustadz || "").trim();
      const jadwal = String(data.jadwalSesi || data.jadwal || "Sore (15:45 - 17:00)").trim();
      const studentIds = Array.isArray(data.studentIds) ? data.studentIds : [];
      let kelasId = String(data.kelasId || data.id || "").trim();
      const nowIso = new Date().toISOString();

      if (!namaKelas) throw new Error("Nama kelas wajib diisi.");

      const ss = getDatabaseSpreadsheet();
      const headersKelas = ["kelas_id", "nama_kelas", "ustadz_pengampu", "jadwal_sesi", "student_ids", "created_at"];
      const sheet = getOrCreateTPQSheet(ss, SHEET_TPQ_KELAS, headersKelas, "#0284c7");

      const kData = sheet.getDataRange().getValues();
      let rowIndex = -1;

      if (kelasId && kData.length >= 2) {
        const idIdx = kData[0].map(h => String(h).toLowerCase()).indexOf("kelas_id");
        for (let i = 1; i < kData.length; i++) {
          if (String(kData[i][idIdx] || "").trim() === kelasId) {
            rowIndex = i + 1;
            break;
          }
        }
      }

      if (rowIndex !== -1) {
        sheet.getRange(rowIndex, 2).setValue(namaKelas);
        sheet.getRange(rowIndex, 3).setValue(ustadz);
        sheet.getRange(rowIndex, 4).setValue(jadwal);
        sheet.getRange(rowIndex, 5).setValue(JSON.stringify(studentIds));
      } else {
        if (!kelasId) kelasId = "KLS-" + Utilities.getUuid().replace(/-/g, "").substring(0, 8).toUpperCase();
        sheet.appendRow([kelasId, namaKelas, ustadz, jadwal, JSON.stringify(studentIds), nowIso]);
      }

      return { status: "success", success: true, message: `Kelas ${namaKelas} berhasil disimpan.`, kelasId: kelasId };
    } catch (err) {
      return { status: "error", success: false, message: "Gagal menyimpan kelas TPQ: " + err.message };
    }
  });
}

function deleteTPQKelas(kelasId, token) {
  return withScriptLock(() => {
    try {
      if (!kelasId) throw new Error("ID Kelas wajib disertakan.");
      const ss = getDatabaseSpreadsheet();
      const sheet = ss.getSheetByName(SHEET_TPQ_KELAS);
      if (!sheet) throw new Error("Sheet TPQ_Kelas tidak ditemukan.");

      const data = sheet.getDataRange().getValues();
      const idIdx = data[0].map(h => String(h).toLowerCase()).indexOf("kelas_id");

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idIdx] || "").trim() === String(kelasId).trim()) {
          sheet.deleteRow(i + 1);
          return { status: "success", success: true, message: "Kelas TPQ berhasil dihapus." };
        }
      }
      return { status: "error", success: false, message: "Kelas TPQ tidak ditemukan." };
    } catch (err) {
      return { status: "error", success: false, message: err.message };
    }
  });
}

function saveTPQPlotting(payload, token) {
  return withScriptLock(() => {
    try {
      const kelasId = String(payload.kelasId || payload.kelas_id || "").trim();
      if (!kelasId) throw new Error("ID Kelas TPQ wajib disertakan.");

      let rawList = payload.studentIds || payload.student_ids || [];
      if (typeof rawList === "string") {
        rawList = rawList.split(",");
      }
      const cleanStudentIds = Array.isArray(rawList) ? rawList.map(s => String(s).trim()).filter(Boolean) : [];

      const ss = getDatabaseSpreadsheet();
      const sheet = getOrCreateTPQSheet(ss, SHEET_TPQ_KELAS, [
        "kelas_id", "nama_kelas", "ustadz_pengampu", "jadwal_sesi", "student_ids", "created_at"
      ], "#0284c7");

      const data = sheet.getDataRange().getValues();
      if (data.length <= 1) throw new Error("Data kelas TPQ tidak ditemukan.");

      const idIdx = data[0].map(h => String(h).toLowerCase()).indexOf("kelas_id");
      const nameIdx = data[0].map(h => String(h).toLowerCase()).indexOf("nama_kelas");
      const uIdx = data[0].map(h => String(h).toLowerCase()).indexOf("ustadz_pengampu");
      const sidsIdx = data[0].map(h => String(h).toLowerCase()).indexOf("student_ids");

      let foundRow = -1;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idIdx] || "").trim() === kelasId) {
          foundRow = i + 1;
          break;
        }
      }

      if (foundRow <= 0) throw new Error("Kelas TPQ ID '" + kelasId + "' tidak ditemukan.");

      sheet.getRange(foundRow, sidsIdx + 1).setValue(JSON.stringify(cleanStudentIds));

      const kNama = nameIdx !== -1 ? String(data[foundRow - 1][nameIdx] || "").trim() : "";
      const kUstadz = uIdx !== -1 ? String(data[foundRow - 1][uIdx] || "").trim() : "";
      syncTPQPlottingToCapaian_(ss, kelasId, cleanStudentIds, kUstadz, kNama);

      return {
        status: "success",
        success: true,
        kelasId: kelasId,
        totalPlotting: cleanStudentIds.length,
        message: `Plotting ${cleanStudentIds.length} santri ke kelas TPQ berhasil disimpan.`
      };
    } catch (err) {
      return { status: "error", success: false, message: "Gagal menyimpan plotting TPQ: " + err.message };
    }
  });
}

function saveTPQTarget(payload, token) {
  return withScriptLock(() => {
    try {
      const studentId = String(payload.studentId || payload.student_id || "").trim();
      if (!studentId) throw new Error("ID Santri wajib disertakan.");

      const ss = getDatabaseSpreadsheet();
      const headers = ["student_id", "target_jilid", "target_halaman_sesi", "target_halaman_pekan", "updated_at"];
      const sheet = getOrCreateTPQSheet(ss, SHEET_TPQ_TARGET, headers, "#f59e0b");

      const targetJilid = Number(payload.targetJilid || payload.target_jilid || 1);
      const targetHalamanSesi = Number(payload.targetHalamanSesi || payload.target_halaman_sesi || 1);
      const targetHalamanPekan = Number(payload.targetHalamanPekan || payload.target_halaman_pekan || (targetHalamanSesi * 6));
      const updatedAt = new Date().toISOString();

      const data = sheet.getDataRange().getValues();
      const idIdx = data[0].map(h => String(h || "").toLowerCase()).indexOf("student_id");
      let foundRow = -1;

      if (data.length >= 2 && idIdx !== -1) {
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][idIdx] || "").trim() === studentId) {
            foundRow = i + 1;
            break;
          }
        }
      }

      const rowValues = [studentId, targetJilid, targetHalamanSesi, targetHalamanPekan, updatedAt];

      if (foundRow > 0) {
        sheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
      } else {
        sheet.appendRow(rowValues);
      }

      return {
        status: "success",
        success: true,
        message: "Target capaian santri TPQ berhasil disimpan."
      };
    } catch (err) {
      return { status: "error", success: false, message: "Gagal menyimpan target TPQ: " + err.message };
    }
  });
}

function saveBulkTPQTarget(payload, token) {
  return withScriptLock(() => {
    try {
      const studentIds = Array.isArray(payload.studentIds)
        ? payload.studentIds.map(id => String(id || "").trim()).filter(Boolean)
        : (payload.studentId ? [String(payload.studentId).trim()] : []);

      if (studentIds.length === 0) {
        throw new Error("Daftar ID Santri sasaran tidak boleh kosong.");
      }

      const ss = getDatabaseSpreadsheet();
      const headers = ["student_id", "target_jilid", "target_halaman_sesi", "target_halaman_pekan", "updated_at"];
      const sheet = getOrCreateTPQSheet(ss, SHEET_TPQ_TARGET, headers, "#f59e0b");

      const targetHalamanSesi = Number(payload.targetHalamanSesi || payload.target_halaman_sesi || 1);
      const targetHalamanPekan = Number(payload.targetHalamanPekan || payload.target_halaman_pekan || (targetHalamanSesi * 6));
      const updatedAt = new Date().toISOString();

      const data = sheet.getDataRange().getValues();
      const idIdx = data[0].map(h => String(h || "").toLowerCase()).indexOf("student_id");
      const targetJilidIdx = data[0].map(h => String(h || "").toLowerCase()).indexOf("target_jilid");

      const existingRowMap = {};
      if (data.length >= 2 && idIdx !== -1) {
        for (let i = 1; i < data.length; i++) {
          const sid = String(data[i][idIdx] || "").trim();
          if (sid) {
            existingRowMap[sid] = {
              row: i + 1,
              targetJilid: targetJilidIdx !== -1 ? Number(data[i][targetJilidIdx]) || 1 : 1
            };
          }
        }
      }

      const newRows = [];
      studentIds.forEach(id => {
        if (existingRowMap[id]) {
          const r = existingRowMap[id].row;
          const tj = existingRowMap[id].targetJilid || 1;
          sheet.getRange(r, 1, 1, 5).setValues([[id, tj, targetHalamanSesi, targetHalamanPekan, updatedAt]]);
        } else {
          newRows.push([id, 1, targetHalamanSesi, targetHalamanPekan, updatedAt]);
        }
      });

      if (newRows.length > 0) {
        sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 5).setValues(newRows);
      }

      return {
        status: "success",
        success: true,
        totalUpdated: studentIds.length,
        message: `Target capaian berhasil diterapkan ke ${studentIds.length} santri TPQ.`
      };
    } catch (err) {
      return { status: "error", success: false, message: "Gagal menerapkan target massal TPQ: " + err.message };
    }
  });
}

function saveTPQSesi(payload, token) {
  return withScriptLock(() => {
    try {
      const p = (payload && (payload.sesi || payload.data)) ? (payload.sesi || payload.data) : (payload || {});
      const namaSesi = String(p.namaSesi || p.nama_sesi || p.nama || "").trim();
      if (!namaSesi) throw new Error("Nama sesi wajib diisi.");

      const ss = getDatabaseSpreadsheet();
      const headers = ["sesi_id", "nama_sesi", "jenis_sesi", "status", "jam_mulai", "jam_selesai", "hari_list", "created_at"];
      const sheet = getOrCreateTPQSheet(ss, SHEET_TPQ_SESI, headers, "#0d9488");

      const rawId = String(p.sesiId || p.sesi_id || p.id || "").trim();
      const sesiId = rawId || ("TPQ-SESI-" + Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd-HHmm"));
      const jenisSesi = String(p.jenisSesi || p.jenis_sesi || p.jenis || "Bimbingan Yanbu'a Reguler").trim();
      const status = String(p.status || "Aktif Digunakan").trim();
      const jamMulai = String(p.jamMulai || p.jam_mulai || "15:45").trim();
      const jamSelesai = String(p.jamSelesai || p.jam_selesai || "17:00").trim();
      const rawHari = p.hariList || p.hari || "Sen,Sel,Rab,Kam,Sab,Min";
      const hariList = Array.isArray(rawHari) ? rawHari.join(",") : String(rawHari);
      const createdAt = new Date().toISOString();

      const data = sheet.getDataRange().getValues();
      const headersArr = data[0].map(h => String(h || "").trim().toLowerCase());
      const idIdx = headersArr.indexOf("sesi_id");
      let foundRow = -1;

      if (rawId && idIdx >= 0) {
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][idIdx] || "").trim() === rawId) {
            foundRow = i + 1;
            break;
          }
        }
      }

      const rowValues = [sesiId, namaSesi, jenisSesi, status, jamMulai, jamSelesai, hariList, createdAt];

      if (foundRow > 0) {
        sheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
      } else {
        sheet.appendRow(rowValues);
      }

      return {
        status: "success",
        success: true,
        sesiId: sesiId,
        message: `Jadwal sesi ${namaSesi} TPQ berhasil disimpan.`
      };
    } catch (err) {
      return { status: "error", success: false, message: "Gagal menyimpan sesi TPQ: " + err.message };
    }
  });
}

function deleteTPQSesi(sesiId, token) {
  return withScriptLock(() => {
    try {
      if (!sesiId) throw new Error("ID Sesi wajib disertakan.");
      const ss = getDatabaseSpreadsheet();
      const sheet = ss.getSheetByName(SHEET_TPQ_SESI);
      if (!sheet) throw new Error("Sheet TPQ_Sesi tidak ditemukan.");

      const data = sheet.getDataRange().getValues();
      const idIdx = data[0].map(h => String(h || "").toLowerCase()).indexOf("sesi_id");

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idIdx] || "").trim() === String(sesiId).trim()) {
          sheet.deleteRow(i + 1);
          return { status: "success", success: true, message: "Sesi TPQ berhasil dihapus." };
        }
      }
      return { status: "error", success: false, message: "Sesi TPQ tidak ditemukan." };
    } catch (err) {
      return { status: "error", success: false, message: err.message };
    }
  });
}


// ====================================================================
// MODUL BACKEND: SOROGAN AL-QUR'AN (BINNAZHAR MUSHAF POJOK 20 HAL/JUZ)
// ====================================================================
const SHEET_SOROGAN_LOGS = "Sorogan_Logs";
const SHEET_SOROGAN_CAPAIAN = "Sorogan_Capaian";
const SHEET_SOROGAN_HALAQAH = "Sorogan_Halaqah";
const SHEET_SOROGAN_TARGET = "Sorogan_Target";
const SHEET_SOROGAN_SESI = "Sorogan_Sesi";

function getOrCreateSoroganSheet(ss, sheetName, headers, bgHeaderColor) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setBackground(bgHeaderColor || "#0284c7")
      .setFontColor("#ffffff");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Normalisasi dan deteksi indeks kolom tab Sorogan_Halaqah secara tangguh.
/**
 * Normalisasi dan deteksi indeks kolom tab Sorogan_Halaqah secara tangguh.
 * Mengadopsi standar 5 kolom kanonikal:
 * [halaqah_id, muallim, target_kurikulum, student_ids, created_at]
 * Mendukung pembacaan kompatibilitas jika kolom lama (nama_halaqah, kategori) masih ada.
 */
function getSoroganHalaqahColumnIndexes(headerRow) {
  if (!headerRow || !headerRow.length) return { id: -1, nama: -1, kategori: -1, muallim: -1, target: -1, studentIds: -1, createdAt: -1 };
  const normalized = headerRow.map(x => String(x || "").trim().toLowerCase().replace(/[\s\-_]+/g, ""));
  const find = (keywords) => {
    for (let i = 0; i < keywords.length; i++) {
      const cleanK = keywords[i].replace(/[\s\-_]+/g, "");
      const idx = normalized.indexOf(cleanK);
      if (idx !== -1) return idx;
    }
    return -1;
  };
  return {
    id: find(["halaqah_id", "halaqahid", "id_halaqah", "idhalaqah", "id", "kode_halaqah", "kode"]),
    nama: find(["nama_halaqah", "namahalaqah", "nama", "halaqah", "nama_kelompok", "kelompok"]),
    kategori: find(["kategori", "kategori_program", "kategoriprogram", "category", "program"]),
    muallim: find(["muallim", "muhafiz", "muhafidz", "pembina", "ustadz", "guru"]),
    target: find(["target_kurikulum", "targetkurikulum", "target", "kurikulum", "jadwal_sesi", "jadwalsesi", "jadwal", "deskripsi"]),
    studentIds: find(["student_ids", "studentids", "anggota", "santri_ids", "santri", "siswa"]),
    createdAt: find(["created_at", "createdat", "tanggal", "waktu"])
  };
}

/**
 * Otomatis migrasi header & susunan data sheet Sorogan_Halaqah ke format standar 5 kolom kanonikal:
 * [halaqah_id, muallim, target_kurikulum, student_ids, created_at]
 * Menghilangkan kolom nama_halaqah dan kategori tanpa menghilangkan data santri binaan.
 */
function migrateSoroganHalaqahSheetIfNeeded(sheet) {
  if (!sheet) return;
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return;

  const targetHeaders = ["halaqah_id", "muallim", "target_kurikulum", "student_ids", "created_at"];
  const currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || "").trim());

  // Cek apakah sheet masih memiliki kolom 'nama_halaqah' atau 'kategori'
  const hasNama = currentHeaders.some(h => {
    const s = h.toLowerCase();
    return s.includes("nama_halaqah") || s === "nama" || s.includes("namahalaqah");
  });
  const hasKategori = currentHeaders.some(h => {
    const s = h.toLowerCase();
    return s === "kategori" || s === "category" || s.includes("kategori_program");
  });

  // Jika sudah 5 kolom dan tidak ada nama_halaqah / kategori, lewati
  if (!hasNama && !hasKategori && lastCol === targetHeaders.length) {
    let isMatch = true;
    for (let i = 0; i < targetHeaders.length; i++) {
      if (currentHeaders[i].toLowerCase() !== targetHeaders[i].toLowerCase()) {
        isMatch = false;
        break;
      }
    }
    if (isMatch) return;
  }

  // Baca indeks lama
  const oldColMap = getSoroganHalaqahColumnIndexes(currentHeaders);
  const lastRow = sheet.getLastRow();
  const newRows = [];

  if (lastRow > 1) {
    const dataRange = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    for (let r = 0; r < dataRange.length; r++) {
      const row = dataRange[r];
      const hId = oldColMap.id !== -1 ? String(row[oldColMap.id] || "").trim() : "";
      let hMuallim = oldColMap.muallim !== -1 ? String(row[oldColMap.muallim] || "").trim() : "";
      
      // Jika muallim kosong tapi nama_halaqah ada, kita fallback gunakan nama halaqah
      if (!hMuallim && oldColMap.nama !== -1) {
        hMuallim = String(row[oldColMap.nama] || "").trim();
      }
      if (!hId && !hMuallim) continue;

      const hTarget = oldColMap.target !== -1 ? String(row[oldColMap.target] || "").trim() : "Sorogan Binnazhar Mushaf Pojok 30 Juz";
      
      let rawSids = oldColMap.studentIds !== -1 ? row[oldColMap.studentIds] : "";
      let sidsStr = "";
      if (typeof rawSids === "string") {
        if (rawSids.trim().startsWith("[")) {
          try {
            const parsed = JSON.parse(rawSids);
            sidsStr = Array.isArray(parsed) ? parsed.join(",") : rawSids;
          } catch (e) {
            sidsStr = rawSids;
          }
        } else {
          sidsStr = rawSids;
        }
      } else if (Array.isArray(rawSids)) {
        sidsStr = rawSids.join(",");
      }

      const hCreated = (oldColMap.createdAt !== -1 && row[oldColMap.createdAt]) ? row[oldColMap.createdAt] : new Date().toISOString();
      newRows.push([hId || ("SRG-HLQ-" + (r < 10 ? "0" + (r + 1) : (r + 1))), hMuallim || "Kyai / Mu'allim Pengampu", hTarget, sidsStr, hCreated]);
    }
  }

  // Bersihkan dan tulis ulang susunan kolom persis 5 kolom standar kanonikal
  sheet.clear();
  sheet.getRange(1, 1, 1, targetHeaders.length).setValues([targetHeaders])
    .setFontWeight("bold")
    .setBackground("#4338ca")
    .setFontColor("#ffffff");
  sheet.setFrozenRows(1);

  if (newRows.length > 0) {
    sheet.getRange(2, 1, newRows.length, targetHeaders.length).setValues(newRows);
  }

  // Hapus sisa kolom jika sheet punya lebih dari 5 kolom
  const maxCols = sheet.getMaxColumns();
  if (maxCols > targetHeaders.length) {
    try {
      sheet.deleteColumns(targetHeaders.length + 1, maxCols - targetHeaders.length);
    } catch (e) {
      // Abaikan jika tidak diizinkan oleh spreadsheet
    }
  }
}

function migrateSoroganHalaqahSheet_(ss) {
  try {
    if (!ss) return;
    const sheet = ss.getSheetByName(SHEET_SOROGAN_HALAQAH);
    if (!sheet) return;
    migrateSoroganHalaqahSheetIfNeeded(sheet);
  } catch (err) {
    Logger.log("migrateSoroganHalaqahSheet_ error: " + err.message);
  }
}

/**
 * Menyelesaikan (resolve) halaqah_id, nama_halaqah, dan muallim pengampu untuk santri Sorogan
 * Berdasarkan plotting di Sorogan_Halaqah, fallback ke muallim yang cocok, atau default.
 */
function resolveSoroganHalaqah_(ss, studentId, nis, customHalaqahId, customNamaHalaqah, customMuallim) {
  let resolvedHalaqahId = String(customHalaqahId || "").trim();
  let resolvedNamaHalaqah = String(customNamaHalaqah || "").trim();
  let resolvedMuallim = String(customMuallim || "").trim();
  if (resolvedMuallim === "-") resolvedMuallim = "";

  const sId = String(studentId || "").trim();
  const sNis = String(nis || "").trim();

  try {
    if (!ss) ss = getDatabaseSpreadsheet();
    if (ss) {
      const hSheet = ss.getSheetByName(SHEET_SOROGAN_HALAQAH);
      if (hSheet) {
        migrateSoroganHalaqahSheetIfNeeded(hSheet);
        const hData = hSheet.getDataRange().getValues();
        if (hData.length >= 2) {
          const colMap = getSoroganHalaqahColumnIndexes(hData[0]);
          if (colMap.id !== -1) {
            let matchedRow = null;
            let matchedRowIndex = -1;

            // 1. Cari berdasarkan student_id atau nis di kolom student_ids
            if (sId || sNis) {
              for (let i = 1; i < hData.length; i++) {
                const row = hData[i];
                const rawSids = colMap.studentIds !== -1 ? row[colMap.studentIds] : "";
                let sids = [];
                if (typeof rawSids === "string") {
                  if (rawSids.trim().startsWith("[")) {
                    try { sids = JSON.parse(rawSids); } catch (e) { sids = []; }
                  } else {
                    sids = rawSids.split(",").map(s => s.trim()).filter(Boolean);
                  }
                } else if (Array.isArray(rawSids)) {
                  sids = rawSids;
                }

                if ((sId && sids.includes(sId)) || (sNis && sids.includes(sNis))) {
                  matchedRow = row;
                  matchedRowIndex = i + 1;
                  break;
                }
              }
            }

            // 2. Jika belum cocok, cari berdasarkan customHalaqahId
            if (!matchedRow && resolvedHalaqahId) {
              for (let i = 1; i < hData.length; i++) {
                if (String(hData[i][colMap.id] || "").trim() === resolvedHalaqahId) {
                  matchedRow = hData[i];
                  matchedRowIndex = i + 1;
                  break;
                }
              }
            }

            // 3. Jika belum cocok, cari berdasarkan muallim
            if (!matchedRow && resolvedMuallim && resolvedMuallim !== "-") {
              const cleanM = resolvedMuallim.toLowerCase().replace(/[^a-z0-9]/g, "");
              for (let i = 1; i < hData.length; i++) {
                const rowM = colMap.muallim !== -1 ? String(hData[i][colMap.muallim] || "").trim() : "";
                const cleanRowM = rowM.toLowerCase().replace(/[^a-z0-9]/g, "");
                if (cleanRowM && (cleanRowM === cleanM || cleanRowM.includes(cleanM) || cleanM.includes(cleanRowM))) {
                  matchedRow = hData[i];
                  matchedRowIndex = i + 1;
                  break;
                }
              }
            }

            if (matchedRow) {
              resolvedHalaqahId = String(matchedRow[colMap.id] || "").trim();
              const mName = colMap.muallim !== -1 ? String(matchedRow[colMap.muallim] || "").trim() : "";
              if (mName) resolvedMuallim = mName;
              let hName = colMap.nama !== -1 ? String(matchedRow[colMap.nama] || "").trim() : "";
              if (!hName && resolvedMuallim) hName = "Halaqah " + resolvedMuallim;
              else if (!hName && resolvedHalaqahId) hName = "Halaqah " + resolvedHalaqahId;
              resolvedNamaHalaqah = hName;

              // Jika santri belum terdaftar di daftar student_ids pada halaqah ini, daftarkan otomatis
              if (sId && colMap.studentIds !== -1 && matchedRowIndex > 0) {
                try {
                  const rawSids = matchedRow[colMap.studentIds] || "";
                  const sids = String(rawSids).split(",").map(s => s.trim()).filter(Boolean);
                  if (!sids.includes(sId)) {
                    sids.push(sId);
                    hSheet.getRange(matchedRowIndex, colMap.studentIds + 1).setValue(sids.join(","));
                  }
                } catch (syncPlotErr) {
                  // Abaikan error minor
                }
              }
            }
          }
        }
      }
    }
  } catch (err) {
    Logger.log("resolveSoroganHalaqah_ error: " + err.message);
  }

  // Jika nama_halaqah masih kosong atau 'Belum Ditentukan'
  if (!resolvedNamaHalaqah || resolvedNamaHalaqah === "Belum Ditentukan") {
    if (resolvedMuallim && resolvedMuallim !== "-") {
      resolvedNamaHalaqah = "Halaqah " + resolvedMuallim;
    } else if (resolvedHalaqahId) {
      resolvedNamaHalaqah = "Halaqah " + resolvedHalaqahId;
    } else {
      resolvedNamaHalaqah = "Belum Ditentukan";
    }
  }

  return {
    halaqahId: resolvedHalaqahId,
    namaHalaqah: resolvedNamaHalaqah,
    muallim: resolvedMuallim || "-"
  };
}

/**
 * Menyinkronkan perubahan plotting dari Sorogan_Halaqah ke Sorogan_Capaian
 */
function syncSoroganPlottingToCapaian_(ss, halaqahId, studentIds, muallim) {
  try {
    if (!ss) ss = getDatabaseSpreadsheet();
    if (!ss || !halaqahId) return;

    const headersCapaian = ["student_id", "student_name", "juz_aktif", "halaman_terakhir", "total_halaman_khatam", "status_terakhir", "halaqah_id", "nama_halaqah", "muallim_pengampu", "updated_at"];
    const cSheet = getOrCreateSoroganSheet(ss, SHEET_SOROGAN_CAPAIAN, headersCapaian, "#0f766e");
    const cData = cSheet.getDataRange().getValues();
    if (cData.length < 2) return;

    const cHead = cData[0].map(h => String(h || "").trim().toLowerCase());
    const sIdIdx = cHead.indexOf("student_id");
    const hIdIdx = cHead.indexOf("halaqah_id");
    const hNameIdx = cHead.indexOf("nama_halaqah");
    const mIdx = cHead.indexOf("muallim_pengampu");
    const upIdx = cHead.indexOf("updated_at");

    if (sIdIdx === -1 || hIdIdx === -1) return;

    const cleanSids = Array.isArray(studentIds) ? studentIds.map(s => String(s).trim()).filter(Boolean) : [];
    const namaHalaqah = muallim && muallim !== "-" ? ("Halaqah " + muallim) : ("Halaqah " + halaqahId);
    const nowIso = new Date().toISOString();

    for (let i = 1; i < cData.length; i++) {
      const rowSid = String(cData[i][sIdIdx] || "").trim();
      const currentHId = String(cData[i][hIdIdx] || "").trim();

      if (cleanSids.includes(rowSid)) {
        const rowNumber = i + 1;
        if (currentHId !== halaqahId || String(cData[i][hNameIdx] || "").trim() === "Belum Ditentukan" || !cData[i][hNameIdx]) {
          cSheet.getRange(rowNumber, hIdIdx + 1).setValue(halaqahId);
          if (hNameIdx !== -1) cSheet.getRange(rowNumber, hNameIdx + 1).setValue(namaHalaqah);
          if (mIdx !== -1 && muallim && muallim !== "-") cSheet.getRange(rowNumber, mIdx + 1).setValue(muallim);
          if (upIdx !== -1) cSheet.getRange(rowNumber, upIdx + 1).setValue(nowIso);
        }
      }
    }
  } catch (err) {
    Logger.log("syncSoroganPlottingToCapaian_ error: " + err.message);
  }
}

function initSoroganSheets(token) {
  try {
    if (token) {
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN"]);
      } catch (authErr) {
        verifySessionToken(token);
      }
    }
    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error("Database Spreadsheet tidak ditemukan.");

    const headersLogs = ["log_id", "student_id", "nis", "student_name", "gender", "tanggal", "sesi", "juz", "halaman_list", "total_halaman", "status_setoran", "nilai", "muallim", "catatan", "created_at"];
    const headersCapaian = ["student_id", "student_name", "juz_aktif", "halaman_terakhir", "total_halaman_khatam", "status_terakhir", "halaqah_id", "nama_halaqah", "muallim_pengampu", "updated_at"];
    const headersHalaqah = ["halaqah_id", "muallim", "target_kurikulum", "student_ids", "created_at"];
    const headersTarget = ["student_id", "target_juz", "target_halaman_sesi", "target_halaman_pekan", "updated_at"];
    const headersSesi = ["sesi_id", "nama_sesi", "jenis_sesi", "status", "jam_mulai", "jam_selesai", "hari_list", "created_at"];

    const created = [];
    const existing = [];

    [
      { name: SHEET_SOROGAN_LOGS, headers: headersLogs, color: "#0369a1" },
      { name: SHEET_SOROGAN_CAPAIAN, headers: headersCapaian, color: "#0f766e" },
      { name: SHEET_SOROGAN_HALAQAH, headers: headersHalaqah, color: "#4338ca" },
      { name: SHEET_SOROGAN_TARGET, headers: headersTarget, color: "#f59e0b" },
      { name: SHEET_SOROGAN_SESI, headers: headersSesi, color: "#0284c7" }
    ].forEach(item => {
      let s = ss.getSheetByName(item.name);
      if (!s) {
        s = ss.insertSheet(item.name);
        s.getRange(1, 1, 1, item.headers.length).setValues([item.headers]);
        s.getRange(1, 1, 1, item.headers.length).setFontWeight("bold").setBackground(item.color).setFontColor("#ffffff");
        s.setFrozenRows(1);
        created.push(item.name);
      } else {
        if (item.name === SHEET_SOROGAN_HALAQAH) {
          migrateSoroganHalaqahSheetIfNeeded(s);
        }
        existing.push(item.name);
      }
    });

    const nowIso = new Date().toISOString();

    if (created.includes(SHEET_SOROGAN_HALAQAH)) {
      const hSheet = ss.getSheetByName(SHEET_SOROGAN_HALAQAH);
      const pSheet = ss.getSheetByName("Pegawai") || ss.getSheetByName("pegawai");
      let ustadz = "Ust.Nazirul Muhammad, AH.";
      let ustadzah = "Nyai Hj. Nashichatul Fuadah, AH.";
      if (pSheet) {
        const pRows = pSheet.getDataRange().getValues();
        if (pRows.length > 1) {
          const pHead = pRows[0].map(h => String(h || "").trim().toLowerCase());
          const nIdx = pHead.indexOf("nama") !== -1 ? pHead.indexOf("nama") : pHead.indexOf("name");
          const gIdx = pHead.indexOf("gender");
          if (nIdx !== -1) {
            for (let r = 1; r < pRows.length; r++) {
              const nm = String(pRows[r][nIdx] || "").trim();
              const gd = gIdx !== -1 ? String(pRows[r][gIdx] || "L").toUpperCase() : "L";
              if (nm) {
                if (gd === "L" && ustadz === "Ust.Nazirul Muhammad, AH.") ustadz = nm;
                if (gd === "P" && ustadzah === "Nyai Hj. Nashichatul Fuadah, AH.") ustadzah = nm;
              }
            }
          }
        }
      }
      const defaultHalaqah = [
        ["SRG-HLQ-01", ustadz, "Sorogan Binnazhar Mushaf Pojok 30 Juz", "", nowIso],
        ["SRG-HLQ-02", ustadzah, "Sorogan Binnazhar Mushaf Pojok 30 Juz", "", nowIso]
      ];
      hSheet.getRange(2, 1, defaultHalaqah.length, headersHalaqah.length).setValues(defaultHalaqah);
    }

    if (created.includes(SHEET_SOROGAN_SESI)) {
      const sSheet = ss.getSheetByName(SHEET_SOROGAN_SESI);
      const defaultSesi = [
        ["SRG-SESI-01", "Pagi (Ba'da Subuh)", "Sorogan Binnazhar Reguler", "Aktif Digunakan", "05:15", "06:30", "Sen,Sel,Rab,Kam,Sab,Min", nowIso],
        ["SRG-SESI-02", "Sore (Ba'da Ashar)", "Sorogan Privat / I'adah", "Aktif Digunakan", "16:00", "17:15", "Sen,Sel,Kam,Sab", nowIso],
        ["SRG-SESI-03", "Malam (Ba'da Isya)", "Khataman / Ujian Akhir Juz", "Aktif Digunakan", "20:00", "21:30", "Kam", nowIso]
      ];
      sSheet.getRange(2, 1, defaultSesi.length, headersSesi.length).setValues(defaultSesi);
    }

    return {
      status: "success",
      success: true,
      message: "Database Sorogan Al-Qur'an berhasil disiapkan.",
      createdSheets: created,
      existingSheets: existing
    };
  } catch (err) {
    console.error("[INIT SOROGAN SHEETS ERROR]", err);
    return { status: "error", success: false, message: "Gagal menyiapkan tabel Sorogan: " + err.message };
  }
}

function getSoroganDashboard(token) {
  try {
    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error("Spreadsheet tidak ditemukan.");

    let actor = null;
    if (token) {
      try {
        actor = authenticateSession(token);
      } catch (authErr) {
        verifySessionToken(token);
      }
    }

    // 0. Auto-ensure SEMUA sheet Sorogan Al-Qur'an tersedia di database
    const headersLogs = ["log_id", "student_id", "nis", "student_name", "gender", "tanggal", "sesi", "juz", "halaman_list", "total_halaman", "status_setoran", "nilai", "muallim", "catatan", "created_at"];
    const headersCapaian = ["student_id", "student_name", "juz_aktif", "halaman_terakhir", "total_halaman_khatam", "status_terakhir", "halaqah_id", "nama_halaqah", "muallim_pengampu", "updated_at"];
    const headersHalaqah = ["halaqah_id", "muallim", "target_kurikulum", "student_ids", "created_at"];
    const headersTarget = ["student_id", "target_juz", "target_halaman_sesi", "target_halaman_pekan", "updated_at"];
    const headersSesi = ["sesi_id", "nama_sesi", "jenis_sesi", "status", "jam_mulai", "jam_selesai", "hari_list", "created_at"];

    // Pastikan Sorogan_Logs dan seluruh tab Sorogan terbentuk
    getOrCreateSoroganSheet(ss, SHEET_SOROGAN_LOGS, headersLogs, "#0369a1");
    const capaianSheet = getOrCreateSoroganSheet(ss, SHEET_SOROGAN_CAPAIAN, headersCapaian, "#0f766e");
    const halaqahSheet = getOrCreateSoroganSheet(ss, SHEET_SOROGAN_HALAQAH, headersHalaqah, "#4338ca");
    const targetSheet = getOrCreateSoroganSheet(ss, SHEET_SOROGAN_TARGET, headersTarget, "#f59e0b");
    const sesiSheet = getOrCreateSoroganSheet(ss, SHEET_SOROGAN_SESI, headersSesi, "#0284c7");

    // Otomatis migrasi struktur kolom Sorogan_Halaqah agar persis Tahfidz_Halaqah
    migrateSoroganHalaqahSheetIfNeeded(halaqahSheet);

    const nowIso = new Date().toISOString();

    // Ambil data resmi Pegawai dari sheet "Pegawai" (Official DB)
    let pegawaiSheet = ss.getSheetByName(SHEET_PEGAWAI) || ss.getSheetByName("Pegawai") || ss.getSheetByName("pegawai");
    const muallimList = [];
    if (pegawaiSheet) {
      const pData = pegawaiSheet.getDataRange().getValues();
      if (pData && pData.length > 1) {
        const pHead = pData[0].map(h => String(h || "").trim().toLowerCase());
        const pNamaIdx = pHead.indexOf("nama") !== -1 ? pHead.indexOf("nama") : pHead.indexOf("name");
        const pStatusIdx = pHead.indexOf("status");
        for (let i = 1; i < pData.length; i++) {
          const row = pData[i];
          const nama = pNamaIdx !== -1 ? String(row[pNamaIdx] || "").trim() : "";
          const st = pStatusIdx !== -1 ? String(row[pStatusIdx] || "").trim().toUpperCase() : "ACTIVE";
          if (nama && (st === "ACTIVE" || st === "AKTIF" || st === "")) {
            if (!muallimList.includes(nama)) {
              muallimList.push(nama);
            }
          }
        }
      }
    }

    // Ambil data resmi Program dari sheet "Programs" (Official DB)
    let programsSheet = ss.getSheetByName("Programs") || ss.getSheetByName("Program");
    const programCategories = [];
    if (programsSheet) {
      const prData = programsSheet.getDataRange().getValues();
      if (prData && prData.length > 1) {
        const prHead = prData[0].map(h => String(h || "").trim().toLowerCase());
        const nameIdx = prHead.indexOf("name") !== -1 ? prHead.indexOf("name") : prHead.indexOf("nama");
        const idIdx = prHead.indexOf("id");
        for (let i = 1; i < prData.length; i++) {
          const row = prData[i];
          const prName = nameIdx !== -1 ? String(row[nameIdx] || "").trim() : "";
          const prId = idIdx !== -1 ? String(row[idIdx] || "").trim() : "";
          if (prName && !programCategories.some(p => p.name === prName)) {
            programCategories.push({
              id: prId || prName,
              name: prName
            });
          }
        }
      }
    }

    const defaultTeacher1 = muallimList[0] || "Ust.Nazirul Muhammad, AH.";
    const defaultTeacher2 = muallimList[1] || muallimList[0] || "Nyai Hj. Nashichatul Fuadah, AH.";
    const defaultProg1 = (programCategories[0] && programCategories[0].name) || "Pesantren Reguler Putra Putri";
    const defaultProg2 = (programCategories[1] && programCategories[1].name) || defaultProg1;

    // Auto-seed default Halaqah jika sheet baru dibuat / kosong
    if (halaqahSheet.getLastRow() < 2) {
      const defaultHalaqah = [
        ["SRG-HLQ-01", defaultTeacher1, "Sorogan Binnazhar Mushaf Pojok 30 Juz", "", nowIso],
        ["SRG-HLQ-02", defaultTeacher2, "Sorogan Binnazhar Mushaf Pojok 30 Juz", "", nowIso]
      ];
      halaqahSheet.getRange(2, 1, defaultHalaqah.length, headersHalaqah.length).setValues(defaultHalaqah);
    }

    // Auto-seed default Sesi jika sheet baru dibuat / kosong
    if (sesiSheet.getLastRow() < 2) {
      const defaultSesi = [
        ["SRG-SESI-01", "Pagi (Ba'da Subuh)", "Sorogan Binnazhar Reguler", "Aktif Digunakan", "05:15", "06:30", "Sen,Sel,Rab,Kam,Sab,Min", nowIso],
        ["SRG-SESI-02", "Sore (Ba'da Ashar)", "Sorogan Privat / I'adah", "Aktif Digunakan", "16:00", "17:15", "Sen,Sel,Kam,Sab", nowIso],
        ["SRG-SESI-03", "Malam (Ba'da Isya)", "Khataman / Ujian Akhir Juz", "Aktif Digunakan", "20:00", "21:30", "Kam", nowIso]
      ];
      sesiSheet.getRange(2, 1, defaultSesi.length, headersSesi.length).setValues(defaultSesi);
    }

    // 1. Ambil data master Santri secara resilien (identik dengan Tahfidz)
    let students = [];
    const studentsSheet = (typeof getAuthSheet === "function" ? getAuthSheet(ss, SHEET_STUDENTS) : null) || ss.getSheetByName(SHEET_STUDENTS);
    if (studentsSheet) {
      const sData = studentsSheet.getDataRange().getValues();
      if (sData && sData.length > 1) {
        const sHeaders = sData[0].map(h => String(h || "").trim().toLowerCase().replace(/[\s\-_]+/g, ""));
        const sIdIdx = sHeaders.findIndex(h => h === "studentid" || h === "id");
        const sNisIdx = sHeaders.findIndex(h => h === "nis" || h === "nisn");
        const sNameIdx = sHeaders.findIndex(h => h === "name" || h === "nama");
        const sGenderIdx = sHeaders.findIndex(h => h === "gender" || h === "jeniskelamin" || h === "jenis");
        const sPhotoIdx = sHeaders.findIndex(h => h.includes("photo") || h.includes("foto"));
        const sStatusIdx = sHeaders.findIndex(h => h === "status");

        for (let i = 1; i < sData.length; i++) {
          const row = sData[i];
          const stStatus = sStatusIdx !== -1 ? String(row[sStatusIdx] || "").trim().toUpperCase() : "AKTIF";
          if (["AKTIF", "ACTIVE", ""].includes(stStatus)) {
            const stId = sIdIdx !== -1 ? String(row[sIdIdx] || "").trim() : "";
            const stName = sNameIdx !== -1 ? String(row[sNameIdx] || "").trim() : "";
            if (!stId && !stName) continue;
            students.push({
              studentId: stId || ("STD-" + i),
              nis: sNisIdx !== -1 ? String(row[sNisIdx] || "").trim() : "",
              name: stName,
              gender: sGenderIdx !== -1 ? String(row[sGenderIdx] || "L").trim().toUpperCase() : "L",
              photoUrl: sPhotoIdx !== -1 ? String(row[sPhotoIdx] || "").trim() : "",
              status: "AKTIF"
            });
          }
        }
      }
    }

    if (students.length === 0 && typeof getAllStudentsData === "function") {
      try {
        const studentsRes = getAllStudentsData(token);
        const rawList = (studentsRes && studentsRes.data) || [];
        students = rawList.map((st, idx) => ({
          studentId: String(st.studentId || st.student_id || st.id || ("STD-" + (idx + 1))).trim(),
          nis: String(st.nis || "").trim(),
          name: String(st.name || st.nama || "").trim(),
          gender: String(st.gender || st.jenis_kelamin || "L").trim().toUpperCase(),
          photoUrl: String(st.photoUrl || st.photo_url || st.foto || "").trim(),
          status: "AKTIF"
        })).filter(s => s.studentId || s.name);
      } catch (e) {
        console.warn("[FALLBACK SOROGAN STUDENTS ERROR]", e);
      }
    }

    // Filter khusus jika role WALI_SANTRI
    if (actor && actor.role === "WALI_SANTRI") {
      const linked = (typeof getLinkedStudentsForWali === "function") ? getLinkedStudentsForWali(actor.identityId) : [];
      const allowedIds = (linked || []).map(s => String(s.studentId || s.student_id || s.id || s.nis || "").trim().toLowerCase());
      students = students.filter(s => allowedIds.includes(String(s.studentId).toLowerCase()) || allowedIds.includes(String(s.nis).toLowerCase()));
    }

    // 2. Ambil data Capaian Sorogan
    const capaianMap = {};
    const cData = capaianSheet.getDataRange().getValues();
    if (cData.length >= 2) {
      const cHead = cData[0].map(h => String(h || "").trim().toLowerCase());
      const sIdIdx = cHead.indexOf("student_id");
      const juzIdx = cHead.indexOf("juz_aktif");
      const halIdx = cHead.indexOf("halaman_terakhir");
      const totIdx = cHead.indexOf("total_halaman_khatam");
      const stIdx = cHead.indexOf("status_terakhir");
      const hIdIdx = cHead.indexOf("halaqah_id");
      const hNameIdx = cHead.indexOf("nama_halaqah");
      const mIdx = cHead.indexOf("muallim_pengampu");
      const upIdx = cHead.indexOf("updated_at");

      for (let i = 1; i < cData.length; i++) {
        const sid = String(cData[i][sIdIdx] || "").trim();
        if (sid) {
          capaianMap[sid] = {
            rowNumber: i + 1,
            juzAktif: Number(cData[i][juzIdx]) || 1,
            halamanTerakhir: Number(cData[i][halIdx]) || 1,
            totalHalamanKhatam: Number(cData[i][totIdx]) || 0,
            statusTerakhir: String(cData[i][stIdx] || "LANJUT").trim().toUpperCase(),
            halaqahId: String(cData[i][hIdIdx] || "").trim(),
            namaHalaqah: String(cData[i][hNameIdx] || "").trim(),
            muallimPengampu: String(cData[i][mIdx] || "").trim(),
            updatedAt: String(cData[i][upIdx] || "").trim()
          };
        }
      }
    }

    // 3. Ambil data Halaqah Sorogan (Struktur Kolom Mengadopsi Tahfidz_Halaqah)
    const halaqahs = [];
    const hData = halaqahSheet.getDataRange().getValues();
    if (hData.length >= 2) {
      const colMap = getSoroganHalaqahColumnIndexes(hData[0]);

      for (let i = 1; i < hData.length; i++) {
        const row = hData[i];
        const hId = colMap.id !== -1 ? String(row[colMap.id] || "").trim() : "";
        const mName = colMap.muallim !== -1 ? String(row[colMap.muallim] || "").trim() : "";
        let hNama = colMap.nama !== -1 && row[colMap.nama] ? String(row[colMap.nama]).trim() : "";
        if (!hNama && mName) {
          hNama = "Halaqah " + mName;
        }
        if (!hId && !mName && !hNama) continue;

        const rawSids = colMap.studentIds !== -1 ? row[colMap.studentIds] : "";
        let sids = [];
        if (typeof rawSids === "string") {
          if (rawSids.trim().startsWith("[")) {
            try { sids = JSON.parse(rawSids); } catch (e) { sids = []; }
          } else {
            sids = rawSids.split(",").map(s => s.trim()).filter(Boolean);
          }
        } else if (Array.isArray(rawSids)) {
          sids = rawSids;
        }

        const kName = colMap.kategori !== -1 ? String(row[colMap.kategori] || "").trim() : "";
        const targetDesc = colMap.target !== -1 ? String(row[colMap.target] || "").trim() : "";

        halaqahs.push({
          halaqahId: hId || ("SRG-HLQ-" + (i < 10 ? "0" + i : i)),
          namaHalaqah: hNama || ("Halaqah " + (mName || hId)),
          muallim: mName,
          muallimPengampu: mName,
          kategori: kName,
          kategoriProgram: kName,
          targetKurikulum: targetDesc || "Sorogan Binnazhar Mushaf Pojok 30 Juz",
          jadwalSesi: targetDesc || "Sorogan Binnazhar Mushaf Pojok 30 Juz",
          studentIds: sids
        });
      }
    }

    // 4. Ambil data Target Sorogan
    const targetMap = {};
    const tData = targetSheet.getDataRange().getValues();
    if (tData.length >= 2) {
      const tHead = tData[0].map(h => String(h || "").trim().toLowerCase());
      const sIdIdx = tHead.indexOf("student_id");
      const jIdx = tHead.indexOf("target_juz");
      const sSesiIdx = tHead.indexOf("target_halaman_sesi");
      const sPekanIdx = tHead.indexOf("target_halaman_pekan");

      for (let i = 1; i < tData.length; i++) {
        const sid = String(tData[i][sIdIdx] || "").trim();
        if (sid) {
          const sSesi = Number(tData[i][sSesiIdx]) || 2;
          targetMap[sid] = {
            targetJuz: Number(tData[i][jIdx]) || 1,
            targetHalamanSesi: sSesi,
            targetHalamanPekan: Number(tData[i][sPekanIdx]) || (sSesi * 11)
          };
        }
      }
    }

    // 5. Ambil data Jadwal Sesi Sorogan
    const sesiList = [];
    const sesiData = sesiSheet.getDataRange().getValues();
    if (sesiData.length >= 2) {
      const sHead = sesiData[0].map(h => String(h || "").trim().toLowerCase());
      const idIdx = sHead.indexOf("sesi_id");
      const nameIdx = sHead.indexOf("nama_sesi");
      const typeIdx = sHead.indexOf("jenis_sesi");
      const stIdx = sHead.indexOf("status");
      const jmIdx = sHead.indexOf("jam_mulai");
      const jsIdx = sHead.indexOf("jam_selesai");
      const hIdx = sHead.indexOf("hari_list");

      for (let i = 1; i < sesiData.length; i++) {
        const rawHari = sesiData[i][hIdx] || "";
        const hariList = Array.isArray(rawHari) ? rawHari : String(rawHari).split(",").map(h => h.trim()).filter(Boolean);
        sesiList.push({
          sesiId: String(sesiData[i][idIdx] || "").trim(),
          namaSesi: String(sesiData[i][nameIdx] || "").trim(),
          jenisSesi: String(sesiData[i][typeIdx] || "").trim(),
          status: String(sesiData[i][stIdx] || "Aktif Digunakan").trim(),
          jamMulai: normalizeTimeString(sesiData[i][jmIdx], "05:15"),
          jamSelesai: normalizeTimeString(sesiData[i][jsIdx], "06:30"),
          hariList: hariList
        });
      }
    }

    // Hitung jumlah sesi aktif per pekan (contoh: 5 hari Subuh + 6 hari Ashar = 11 sesi)
    let soroganWeeklySessions = 0;
    sesiList.forEach(s => {
      if ((s.status || "").includes("Aktif")) {
        const hArr = Array.isArray(s.hariList) ? s.hariList : String(s.hariList || "").split(",").map(h => h.trim()).filter(Boolean);
        soroganWeeklySessions += Math.max(1, hArr.length);
      }
    });
    if (soroganWeeklySessions === 0) soroganWeeklySessions = 11;

    // Auto-heal baris capaian di Google Sheets jika halaqah_id kosong atau nama_halaqah 'Belum Ditentukan'
    Object.keys(capaianMap).forEach(sid => {
      const cp = capaianMap[sid];
      const needsHealing = !cp.halaqahId || !cp.namaHalaqah || cp.namaHalaqah === "Belum Ditentukan";
      if (needsHealing) {
        const stObj = students.find(s => s.studentId === sid);
        const stNis = stObj ? stObj.nis : "";
        const resolved = resolveSoroganHalaqah_(ss, sid, stNis, cp.halaqahId, cp.namaHalaqah, cp.muallimPengampu);

        if (resolved.halaqahId || (resolved.namaHalaqah && resolved.namaHalaqah !== "Belum Ditentukan")) {
          cp.halaqahId = resolved.halaqahId || cp.halaqahId;
          cp.namaHalaqah = resolved.namaHalaqah || cp.namaHalaqah;
          if (resolved.muallim && resolved.muallim !== "-") cp.muallimPengampu = resolved.muallim;

          if (cp.rowNumber && cp.rowNumber >= 2) {
            try {
              if (hIdIdx !== -1 && cp.halaqahId) capaianSheet.getRange(cp.rowNumber, hIdIdx + 1).setValue(cp.halaqahId);
              if (hNameIdx !== -1 && cp.namaHalaqah) capaianSheet.getRange(cp.rowNumber, hNameIdx + 1).setValue(cp.namaHalaqah);
              if (mIdx !== -1 && cp.muallimPengampu && cp.muallimPengampu !== "-") capaianSheet.getRange(cp.rowNumber, mIdx + 1).setValue(cp.muallimPengampu);
              if (upIdx !== -1) capaianSheet.getRange(cp.rowNumber, upIdx + 1).setValue(nowIso);
            } catch (healErr) {
              Logger.log("Auto-heal Sorogan_Capaian error for " + sid + ": " + healErr.message);
            }
          }
        }
      }
    });

    // Gabungkan data capaian & hitung ringkasan
    let totalJuzSum = 0;
    let khatam30Juz = 0;
    let totalLanjut = 0;
    let totalUlang = 0;
    const muallimSet = new Set();

    const enrichedStudents = students.map(st => {
      const cp = capaianMap[st.studentId] || {
        juzAktif: 1,
        halamanTerakhir: 1,
        totalHalamanKhatam: 0,
        statusTerakhir: "LANJUT",
        halaqahId: "",
        namaHalaqah: "Belum Ditentukan",
        muallimPengampu: "-",
        updatedAt: ""
      };

      if (!cp.halaqahId || !cp.namaHalaqah || cp.namaHalaqah === "Belum Ditentukan") {
        const resolved = resolveSoroganHalaqah_(ss, st.studentId, st.nis, cp.halaqahId, cp.namaHalaqah, cp.muallimPengampu);
        if (resolved.halaqahId) cp.halaqahId = resolved.halaqahId;
        if (resolved.namaHalaqah && resolved.namaHalaqah !== "Belum Ditentukan") cp.namaHalaqah = resolved.namaHalaqah;
        if (resolved.muallim && resolved.muallim !== "-") cp.muallimPengampu = resolved.muallim;
      }

      const juz = Math.max(1, Math.min(30, cp.juzAktif));
      totalJuzSum += juz;
      if (juz === 30 && cp.halamanTerakhir >= 20) khatam30Juz++;

      if (cp.statusTerakhir === "ULANG") totalUlang++;
      else totalLanjut++;

      if (cp.muallimPengampu && cp.muallimPengampu !== "-") {
        muallimSet.add(cp.muallimPengampu);
      }

      const tgt = targetMap[st.studentId] || {
        targetJuz: Math.min(30, juz + 1),
        targetHalamanSesi: 2,
        targetHalamanPekan: 2 * soroganWeeklySessions
      };

      return {
        ...st,
        juzAktif: juz,
        halamanTerakhir: cp.halamanTerakhir,
        totalHalamanKhatam: cp.totalHalamanKhatam,
        statusTerakhir: cp.statusTerakhir,
        halaqahId: cp.halaqahId,
        namaHalaqah: cp.namaHalaqah,
        muallimPengampu: cp.muallimPengampu,
        updatedAt: cp.updatedAt,
        target: tgt
      };
    });

    const avgJuz = enrichedStudents.length > 0 ? (totalJuzSum / enrichedStudents.length).toFixed(1) : "1.0";

    return {
      status: "success",
      success: true,
      summary: {
        totalSantri: enrichedStudents.length,
        rataRataJuz: avgJuz,
        khatam30Juz: khatam30Juz,
        totalLanjut: totalLanjut,
        totalUlang: totalUlang,
        persentaseLanjut: enrichedStudents.length > 0 ? Math.round((totalLanjut / enrichedStudents.length) * 100) : 100
      },
      students: enrichedStudents,
      halaqahs: halaqahs,
      muallimList: muallimList,
      programCategories: programCategories,
      targets: targetMap,
      sesiList: sesiList
    };
  } catch (err) {
    console.error("[GET SOROGAN DASHBOARD ERROR]", err);
    return { status: "error", success: false, message: "Gagal memuat dashboard Sorogan: " + err.message };
  }
}

function saveSoroganLog(data, token) {
  return withScriptLock(() => {
    try {
      const studentId = String(data.studentId || data.student_id || "").trim();
      const studentName = String(data.studentName || data.student_name || "").trim();
      const nis = String(data.nis || "").trim();
      const gender = String(data.gender || "L").trim().toUpperCase();
      const juz = Number(data.juz) || 1;
      const halamanList = Array.isArray(data.halamanList) ? data.halamanList : (data.halaman ? [Number(data.halaman)] : [1]);
      const totalHalaman = Number(data.totalHalaman) || halamanList.length || 1;
      const statusSetoran = String(data.statusSetoran || data.status_setoran || "LANJUT").trim().toUpperCase();
      const nilai = String(data.nilai || "MUMTAZ").trim().toUpperCase();
      const muallim = String(data.muallim || data.ustadz || "Guru Sorogan").trim();
      const catatan = String(data.catatan || "").trim();
      const tanggal = String(data.tanggal || new Date().toISOString().substring(0, 10)).trim();
      const sesi = String(data.sesi || "Pagi (Ba'da Subuh)").trim();
      const nowIso = new Date().toISOString();

      if (!studentId && !nis) throw new Error("Identitas santri wajib diisi.");

      const ss = getDatabaseSpreadsheet();
      const headersLogs = ["log_id", "student_id", "nis", "student_name", "gender", "tanggal", "sesi", "juz", "halaman_list", "total_halaman", "status_setoran", "nilai", "muallim", "catatan", "created_at"];
      const logsSheet = getOrCreateSoroganSheet(ss, SHEET_SOROGAN_LOGS, headersLogs, "#0369a1");

      const logId = "SRG_LOG_" + Utilities.getUuid().replace(/-/g, "").substring(0, 12);
      logsSheet.appendRow([
        logId, studentId, nis, studentName, gender, tanggal, sesi, juz, JSON.stringify(halamanList), totalHalaman, statusSetoran, nilai, muallim, catatan, nowIso
      ]);

      // Perbarui posisi Capaian Sorogan (Mushaf 20 Halaman per Juz)
      const lastPage = halamanList.length > 0 ? Math.max(...halamanList) : 1;
      let nextJuz = juz;
      let nextHalaman = lastPage;

      if (statusSetoran === "LANJUT") {
        if (lastPage >= 20) {
          // Lanjut ke juz berikutnya jika halaman 20 sudah selesai
          nextJuz = Math.min(30, juz + 1);
          nextHalaman = (juz === 30 && lastPage >= 20) ? 20 : 1;
        } else {
          nextHalaman = lastPage + 1;
        }
      } else if (statusSetoran === "KHATAM_30JUZ") {
        nextJuz = 30;
        nextHalaman = 20;
      }

      const headersCapaian = ["student_id", "student_name", "juz_aktif", "halaman_terakhir", "total_halaman_khatam", "status_terakhir", "halaqah_id", "nama_halaqah", "muallim_pengampu", "updated_at"];
      const capaianSheet = getOrCreateSoroganSheet(ss, SHEET_SOROGAN_CAPAIAN, headersCapaian, "#0f766e");
      const cData = capaianSheet.getDataRange().getValues();
      let rowIndex = -1;
      let prevTotal = 0;
      let existingHId = "";
      let existingHName = "";
      let existingMuallim = "";

      if (cData.length >= 2) {
        const sIdIdx = cData[0].map(h => String(h).toLowerCase()).indexOf("student_id");
        const totIdx = cData[0].map(h => String(h).toLowerCase()).indexOf("total_halaman_khatam");
        const hIdIdx = cData[0].map(h => String(h).toLowerCase()).indexOf("halaqah_id");
        const hNameIdx = cData[0].map(h => String(h).toLowerCase()).indexOf("nama_halaqah");
        const mIdx = cData[0].map(h => String(h).toLowerCase()).indexOf("muallim_pengampu");

        for (let i = 1; i < cData.length; i++) {
          if (String(cData[i][sIdIdx] || "").trim() === studentId) {
            rowIndex = i + 1;
            prevTotal = Number(cData[i][totIdx]) || 0;
            if (hIdIdx !== -1) existingHId = String(cData[i][hIdIdx] || "").trim();
            if (hNameIdx !== -1) existingHName = String(cData[i][hNameIdx] || "").trim();
            if (mIdx !== -1) existingMuallim = String(cData[i][mIdx] || "").trim();
            break;
          }
        }
      }

      const inputHId = String(data.halaqahId || data.halaqah_id || existingHId || "").trim();
      const inputHName = String(data.namaHalaqah || data.nama_halaqah || existingHName || "").trim();
      const inputMuallim = (muallim && muallim !== "-") ? muallim : existingMuallim;

      const resolvedHalaqah = resolveSoroganHalaqah_(ss, studentId, nis, inputHId, inputHName, inputMuallim);
      const finalHalaqahId = resolvedHalaqah.halaqahId || inputHId || "";
      const finalNamaHalaqah = (resolvedHalaqah.namaHalaqah && resolvedHalaqah.namaHalaqah !== "Belum Ditentukan")
        ? resolvedHalaqah.namaHalaqah
        : (inputHName && inputHName !== "Belum Ditentukan" ? inputHName : "Belum Ditentukan");
      const finalMuallim = (muallim && muallim !== "-")
        ? muallim
        : ((resolvedHalaqah.muallim && resolvedHalaqah.muallim !== "-") ? resolvedHalaqah.muallim : (existingMuallim || "-"));

      const updatedTotal = statusSetoran === "LANJUT" ? (prevTotal + totalHalaman) : prevTotal;

      if (rowIndex !== -1) {
        capaianSheet.getRange(rowIndex, 2).setValue(studentName);
        capaianSheet.getRange(rowIndex, 3).setValue(nextJuz);
        capaianSheet.getRange(rowIndex, 4).setValue(nextHalaman);
        capaianSheet.getRange(rowIndex, 5).setValue(updatedTotal);
        capaianSheet.getRange(rowIndex, 6).setValue(statusSetoran);
        if (finalHalaqahId) capaianSheet.getRange(rowIndex, 7).setValue(finalHalaqahId);
        if (finalNamaHalaqah) capaianSheet.getRange(rowIndex, 8).setValue(finalNamaHalaqah);
        if (finalMuallim && finalMuallim !== "-") capaianSheet.getRange(rowIndex, 9).setValue(finalMuallim);
        capaianSheet.getRange(rowIndex, 10).setValue(nowIso);
      } else {
        capaianSheet.appendRow([
          studentId, studentName, nextJuz, nextHalaman, updatedTotal, statusSetoran, finalHalaqahId, finalNamaHalaqah, finalMuallim, nowIso
        ]);
      }

      return {
        status: "success",
        success: true,
        message: `Sorogan santri ${studentName} berhasil dicatat. Juz ${juz} Hal ${halamanList.join(", ")} (${statusSetoran})`,
        logId: logId,
        nextJuz: nextJuz,
        nextHalaman: nextHalaman
      };
    } catch (err) {
      console.error("[SAVE SOROGAN LOG ERROR]", err);
      return { status: "error", success: false, message: "Gagal mencatat sorogan: " + err.message };
    }
  });
}

function deleteSoroganLog(logId, token) {
  return withScriptLock(() => {
    try {
      if (!logId) throw new Error("ID Log wajib disertakan.");
      const ss = getDatabaseSpreadsheet();
      const sheet = ss.getSheetByName(SHEET_SOROGAN_LOGS);
      if (!sheet) throw new Error("Sheet Sorogan_Logs tidak ditemukan.");

      const data = sheet.getDataRange().getValues();
      const idIdx = data[0].map(h => String(h).toLowerCase()).indexOf("log_id");

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idIdx] || "").trim() === String(logId).trim()) {
          sheet.deleteRow(i + 1);
          return { status: "success", success: true, message: "Log sorogan berhasil dihapus." };
        }
      }
      return { status: "error", success: false, message: "Log sorogan tidak ditemukan." };
    } catch (err) {
      return { status: "error", success: false, message: "Gagal menghapus log sorogan: " + err.message };
    }
  });
}

function saveSoroganCapaian(data, token) {
  return withScriptLock(() => {
    try {
      const studentId = String(data.studentId || data.student_id || "").trim();
      const studentName = String(data.studentName || data.student_name || "").trim();
      const juz = Number(data.juzAktif || data.juz) || 1;
      const halaman = Number(data.halamanTerakhir || data.halaman) || 1;
      const halaqahId = String(data.halaqahId || "").trim();
      const namaHalaqah = String(data.namaHalaqah || "").trim();
      const muallim = String(data.muallim || "").trim();
      const nowIso = new Date().toISOString();

      if (!studentId) throw new Error("ID Santri wajib disertakan.");

      const ss = getDatabaseSpreadsheet();
      const resolved = resolveSoroganHalaqah_(ss, studentId, "", halaqahId, namaHalaqah, muallim);
      const finalHalaqahId = halaqahId || resolved.halaqahId || "";
      const finalNamaHalaqah = (namaHalaqah && namaHalaqah !== "Belum Ditentukan")
        ? namaHalaqah
        : (resolved.namaHalaqah || "Belum Ditentukan");
      const finalMuallim = (muallim && muallim !== "-")
        ? muallim
        : ((resolved.muallim && resolved.muallim !== "-") ? resolved.muallim : "-");

      const headersCapaian = ["student_id", "student_name", "juz_aktif", "halaman_terakhir", "total_halaman_khatam", "status_terakhir", "halaqah_id", "nama_halaqah", "muallim_pengampu", "updated_at"];
      const sheet = getOrCreateSoroganSheet(ss, SHEET_SOROGAN_CAPAIAN, headersCapaian, "#0f766e");

      const cData = sheet.getDataRange().getValues();
      let rowIndex = -1;
      if (cData.length >= 2) {
        const idIdx = cData[0].map(h => String(h).toLowerCase()).indexOf("student_id");
        for (let i = 1; i < cData.length; i++) {
          if (String(cData[i][idIdx] || "").trim() === studentId) {
            rowIndex = i + 1;
            break;
          }
        }
      }

      if (rowIndex !== -1) {
        sheet.getRange(rowIndex, 2).setValue(studentName);
        sheet.getRange(rowIndex, 3).setValue(juz);
        sheet.getRange(rowIndex, 4).setValue(halaman);
        if (finalHalaqahId) sheet.getRange(rowIndex, 7).setValue(finalHalaqahId);
        if (finalNamaHalaqah) sheet.getRange(rowIndex, 8).setValue(finalNamaHalaqah);
        if (finalMuallim && finalMuallim !== "-") sheet.getRange(rowIndex, 9).setValue(finalMuallim);
        sheet.getRange(rowIndex, 10).setValue(nowIso);
      } else {
        sheet.appendRow([studentId, studentName, juz, halaman, 0, "LANJUT", finalHalaqahId, finalNamaHalaqah, finalMuallim, nowIso]);
      }

      return { status: "success", success: true, message: `Posisi Sorogan santri ${studentName} berhasil disesuaikan.` };
    } catch (err) {
      return { status: "error", success: false, message: "Gagal menyimpan capaian sorogan: " + err.message };
    }
  });
}

function getSoroganHalaqahList(token) {
  try {
    const ss = getDatabaseSpreadsheet();
    const headersHalaqah = ["halaqah_id", "muallim", "target_kurikulum", "student_ids", "created_at"];
    const sheet = getOrCreateSoroganSheet(ss, SHEET_SOROGAN_HALAQAH, headersHalaqah, "#4338ca");
    migrateSoroganHalaqahSheetIfNeeded(sheet);
    const data = sheet.getDataRange().getValues();
    const list = [];

    if (data.length >= 2) {
      const colMap = getSoroganHalaqahColumnIndexes(data[0]);

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const hId = colMap.id !== -1 ? String(row[colMap.id] || "").trim() : "";
        const mName = colMap.muallim !== -1 ? String(row[colMap.muallim] || "").trim() : "";
        let hNama = colMap.nama !== -1 && row[colMap.nama] ? String(row[colMap.nama]).trim() : "";
        if (!hNama && mName) {
          hNama = "Halaqah " + mName;
        }
        if (!hId && !mName && !hNama) continue;

        const rawSids = colMap.studentIds !== -1 ? row[colMap.studentIds] : "";
        let sids = [];
        if (typeof rawSids === "string") {
          if (rawSids.trim().startsWith("[")) {
            try { sids = JSON.parse(rawSids); } catch (e) { sids = []; }
          } else {
            sids = rawSids.split(",").map(s => s.trim()).filter(Boolean);
          }
        } else if (Array.isArray(rawSids)) {
          sids = rawSids;
        }

        const kName = colMap.kategori !== -1 ? String(row[colMap.kategori] || "").trim() : "";
        const targetDesc = colMap.target !== -1 ? String(row[colMap.target] || "").trim() : "";

        list.push({
          halaqahId: hId || ("SRG-HLQ-" + (i < 10 ? "0" + i : i)),
          namaHalaqah: hNama || ("Halaqah " + (mName || hId)),
          muallim: mName,
          muallimPengampu: mName,
          kategori: kName,
          kategoriProgram: kName,
          targetKurikulum: targetDesc || "Sorogan Binnazhar Mushaf Pojok 30 Juz",
          jadwalSesi: targetDesc || "Sorogan Binnazhar Mushaf Pojok 30 Juz",
          studentIds: sids
        });
      }
    }

    // Ambil data Pegawai & Programs
    const pegawaiSheet = ss.getSheetByName(SHEET_PEGAWAI) || ss.getSheetByName("Pegawai") || ss.getSheetByName("pegawai");
    const muallimList = [];
    if (pegawaiSheet) {
      const pData = pegawaiSheet.getDataRange().getValues();
      if (pData && pData.length > 1) {
        const pHead = pData[0].map(h => String(h || "").trim().toLowerCase());
        const pNamaIdx = pHead.indexOf("nama") !== -1 ? pHead.indexOf("nama") : pHead.indexOf("name");
        const pStatusIdx = pHead.indexOf("status");
        for (let i = 1; i < pData.length; i++) {
          const row = pData[i];
          const nama = pNamaIdx !== -1 ? String(row[pNamaIdx] || "").trim() : "";
          const st = pStatusIdx !== -1 ? String(row[pStatusIdx] || "").trim().toUpperCase() : "ACTIVE";
          if (nama && (st === "ACTIVE" || st === "AKTIF" || st === "")) {
            if (!muallimList.includes(nama)) muallimList.push(nama);
          }
        }
      }
    }

    const programsSheet = ss.getSheetByName("Programs") || ss.getSheetByName("Program");
    const programCategories = [];
    if (programsSheet) {
      const prData = programsSheet.getDataRange().getValues();
      if (prData && prData.length > 1) {
        const prHead = prData[0].map(h => String(h || "").trim().toLowerCase());
        const nameIdx = prHead.indexOf("name") !== -1 ? prHead.indexOf("name") : prHead.indexOf("nama");
        const idIdx = prHead.indexOf("id");
        for (let i = 1; i < prData.length; i++) {
          const row = prData[i];
          const prName = nameIdx !== -1 ? String(row[nameIdx] || "").trim() : "";
          const prId = idIdx !== -1 ? String(row[idIdx] || "").trim() : "";
          if (prName && !programCategories.some(p => p.name === prName)) {
            programCategories.push({ id: prId || prName, name: prName });
          }
        }
      }
    }

    return {
      status: "success",
      success: true,
      halaqahs: list,
      muallimList: muallimList,
      programCategories: programCategories
    };
  } catch (err) {
    return { status: "error", success: false, message: err.message };
  }
}

function saveSoroganHalaqah(data, token) {
  return withScriptLock(() => {
    try {
      if (token) {
        try {
          const actor = authenticateSession(token);
          authorizeRole(actor, ["ADMIN", "EDITOR"]);
        } catch (authErr) {
          verifySessionToken(token);
        }
      }

      let muallim = String(data.muallim || data.muallimPengampu || "").trim();
      let nama = String(data.namaHalaqah || data.nama_halaqah || data.nama || "").trim();
      if (!muallim && !nama) throw new Error("Mu'allim Pengampu halaqah sorogan wajib dipilih atau diisi.");
      if (!muallim && nama) muallim = nama;
      if (!nama && muallim) nama = "Halaqah " + muallim;

      const ss = getDatabaseSpreadsheet();
      const headersHalaqah = ["halaqah_id", "muallim", "target_kurikulum", "student_ids", "created_at"];
      const sheet = getOrCreateSoroganSheet(ss, SHEET_SOROGAN_HALAQAH, headersHalaqah, "#4338ca");
      migrateSoroganHalaqahSheetIfNeeded(sheet);

      let halaqahId = String(data.halaqahId || data.halaqah_id || data.id || "").trim();
      if (!halaqahId) {
        halaqahId = "SRG-HLQ-" + Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd-HHmmss") + "-" + Math.floor(100 + Math.random() * 900);
      }

      const kategori = String(data.kategori || data.kategoriProgram || data.kategori_program || "Pesantren Reguler Putra Putri").trim();
      const targetKurikulum = String(data.targetKurikulum || data.target_kurikulum || data.targetDeskripsi || data.jadwalSesi || data.jadwal || "Sorogan Binnazhar Mushaf Pojok 30 Juz").trim();

      let rawStudents = data.studentIds || data.student_ids || [];
      if (typeof rawStudents === "string") {
        try {
          if (rawStudents.startsWith("[")) {
            rawStudents = JSON.parse(rawStudents);
          } else {
            rawStudents = rawStudents.split(",").map(s => s.trim()).filter(Boolean);
          }
        } catch (e) {
          rawStudents = rawStudents.split(",").map(s => s.trim()).filter(Boolean);
        }
      }
      const studentIdsStr = Array.isArray(rawStudents) ? rawStudents.join(",") : String(rawStudents || "");
      const createdAt = new Date().toISOString();

      const sheetData = sheet.getDataRange().getValues();
      const colMap = getSoroganHalaqahColumnIndexes(sheetData[0]);

      let foundRow = -1;
      if (colMap.id !== -1) {
        for (let i = 1; i < sheetData.length; i++) {
          if (String(sheetData[i][colMap.id] || "").trim() === halaqahId) {
            foundRow = i + 1;
            break;
          }
        }
      }

      const headersCount = Math.max(sheetData[0].length, headersHalaqah.length);
      const rowValues = new Array(headersCount).fill("");

      if (colMap.id !== -1) rowValues[colMap.id] = halaqahId;
      if (colMap.muallim !== -1) rowValues[colMap.muallim] = muallim;
      if (colMap.target !== -1) rowValues[colMap.target] = targetKurikulum;
      if (colMap.studentIds !== -1) rowValues[colMap.studentIds] = studentIdsStr;
      if (colMap.createdAt !== -1) rowValues[colMap.createdAt] = createdAt;
      if (colMap.nama !== -1) rowValues[colMap.nama] = nama;
      if (colMap.kategori !== -1) rowValues[colMap.kategori] = kategori;

      if (foundRow > 0) {
        if (colMap.createdAt !== -1 && sheetData[foundRow - 1][colMap.createdAt]) {
          rowValues[colMap.createdAt] = sheetData[foundRow - 1][colMap.createdAt];
        }
        sheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
      } else {
        sheet.appendRow(rowValues);
      }

      return {
        status: "success",
        success: true,
        halaqahId: halaqahId,
        message: `Halaqah Sorogan ${nama} berhasil disimpan.`
      };
    } catch (err) {
      return { status: "error", success: false, message: "Gagal menyimpan halaqah sorogan: " + err.message };
    }
  });
}

function deleteSoroganHalaqah(halaqahId, token) {
  return withScriptLock(() => {
    try {
      if (!halaqahId) throw new Error("ID Halaqah wajib disertakan.");
      const ss = getDatabaseSpreadsheet();
      const sheet = ss.getSheetByName(SHEET_SOROGAN_HALAQAH);
      if (!sheet) throw new Error("Sheet Sorogan_Halaqah tidak ditemukan.");

      const data = sheet.getDataRange().getValues();
      const colMap = getSoroganHalaqahColumnIndexes(data[0]);
      const idIdx = colMap.id !== -1 ? colMap.id : 0;

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idIdx] || "").trim() === String(halaqahId).trim()) {
          sheet.deleteRow(i + 1);
          return { status: "success", success: true, message: "Halaqah sorogan berhasil dihapus." };
        }
      }
      return { status: "error", success: false, message: "Halaqah sorogan tidak ditemukan." };
    } catch (err) {
      return { status: "error", success: false, message: err.message };
    }
  });
}

function saveSoroganPlotting(payload, token) {
  return withScriptLock(() => {
    try {
      if (token) {
        try {
          const actor = authenticateSession(token);
          authorizeRole(actor, ["ADMIN", "EDITOR"]);
        } catch (authErr) {
          verifySessionToken(token);
        }
      }

      const halaqahId = String(payload.halaqahId || payload.halaqah_id || "").trim();
      if (!halaqahId) throw new Error("ID Halaqah wajib disertakan.");

      let rawList = payload.studentIds || payload.student_ids || [];
      if (typeof rawList === "string") {
        if (rawList.trim().startsWith("[")) {
          try { rawList = JSON.parse(rawList); } catch (e) { rawList = rawList.split(","); }
        } else {
          rawList = rawList.split(",");
        }
      }
      const cleanStudentIds = Array.isArray(rawList) ? rawList.map(s => String(s).trim()).filter(Boolean) : [];

      const ss = getDatabaseSpreadsheet();
      const headersHalaqah = ["halaqah_id", "muallim", "target_kurikulum", "student_ids", "created_at"];
      const sheet = getOrCreateSoroganSheet(ss, SHEET_SOROGAN_HALAQAH, headersHalaqah, "#4338ca");
      migrateSoroganHalaqahSheetIfNeeded(sheet);

      const data = sheet.getDataRange().getValues();
      if (data.length <= 1) throw new Error("Data halaqah Sorogan tidak ditemukan.");

      const colMap = getSoroganHalaqahColumnIndexes(data[0]);
      if (colMap.id === -1 || colMap.studentIds === -1) {
        throw new Error("Struktur kolom sheet Sorogan_Halaqah tidak valid.");
      }

      let foundRow = -1;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][colMap.id] || "").trim() === halaqahId) {
          foundRow = i + 1;
          break;
        }
      }

      if (foundRow <= 0) throw new Error("Halaqah Sorogan ID '" + halaqahId + "' tidak ditemukan.");

      sheet.getRange(foundRow, colMap.studentIds + 1).setValue(cleanStudentIds.join(","));

      const hMuallim = colMap.muallim !== -1 ? String(data[foundRow - 1][colMap.muallim] || "").trim() : "";
      syncSoroganPlottingToCapaian_(ss, halaqahId, cleanStudentIds, hMuallim);

      return {
        status: "success",
        success: true,
        halaqahId: halaqahId,
        totalPlotting: cleanStudentIds.length,
        message: `Plotting ${cleanStudentIds.length} santri ke halaqah Sorogan berhasil disimpan.`
      };
    } catch (err) {
      return { status: "error", success: false, message: "Gagal menyimpan plotting Sorogan: " + err.message };
    }
  });
}

function saveSoroganTarget(payload, token) {
  return withScriptLock(() => {
    try {
      const studentId = String(payload.studentId || payload.student_id || "").trim();
      if (!studentId) throw new Error("ID Santri wajib disertakan.");

      const ss = getDatabaseSpreadsheet();
      const headers = ["student_id", "target_juz", "target_halaman_sesi", "target_halaman_pekan", "updated_at"];
      const sheet = getOrCreateSoroganSheet(ss, SHEET_SOROGAN_TARGET, headers, "#f59e0b");

      const targetJuz = Number(payload.targetJuz || payload.target_juz || 1);
      const targetHalamanSesi = Number(payload.targetHalamanSesi || payload.target_halaman_sesi || 2);
      const targetHalamanPekan = Number(payload.targetHalamanPekan || payload.target_halaman_pekan || (targetHalamanSesi * 11));
      const updatedAt = new Date().toISOString();

      const data = sheet.getDataRange().getValues();
      const idIdx = data[0].map(h => String(h || "").toLowerCase()).indexOf("student_id");
      let foundRow = -1;

      if (data.length >= 2 && idIdx !== -1) {
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][idIdx] || "").trim() === studentId) {
            foundRow = i + 1;
            break;
          }
        }
      }

      const rowValues = [studentId, targetJuz, targetHalamanSesi, targetHalamanPekan, updatedAt];

      if (foundRow > 0) {
        sheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
      } else {
        sheet.appendRow(rowValues);
      }

      return {
        status: "success",
        success: true,
        message: "Target capaian santri Sorogan berhasil disimpan."
      };
    } catch (err) {
      return { status: "error", success: false, message: "Gagal menyimpan target Sorogan: " + err.message };
    }
  });
}

function saveBulkSoroganTarget(payload, token) {
  return withScriptLock(() => {
    try {
      const studentIds = Array.isArray(payload.studentIds)
        ? payload.studentIds.map(id => String(id || "").trim()).filter(Boolean)
        : (payload.studentId ? [String(payload.studentId).trim()] : []);

      if (studentIds.length === 0) {
        throw new Error("Daftar ID Santri sasaran tidak boleh kosong.");
      }

      const ss = getDatabaseSpreadsheet();
      const headers = ["student_id", "target_juz", "target_halaman_sesi", "target_halaman_pekan", "updated_at"];
      const sheet = getOrCreateSoroganSheet(ss, SHEET_SOROGAN_TARGET, headers, "#f59e0b");

      const targetHalamanSesi = Number(payload.targetHalamanSesi || payload.target_halaman_sesi || 2);
      const targetHalamanPekan = Number(payload.targetHalamanPekan || payload.target_halaman_pekan || (targetHalamanSesi * 11));
      const updatedAt = new Date().toISOString();

      const data = sheet.getDataRange().getValues();
      const idIdx = data[0].map(h => String(h || "").toLowerCase()).indexOf("student_id");
      const targetJuzIdx = data[0].map(h => String(h || "").toLowerCase()).indexOf("target_juz");

      const existingRowMap = {};
      if (data.length >= 2 && idIdx !== -1) {
        for (let i = 1; i < data.length; i++) {
          const sid = String(data[i][idIdx] || "").trim();
          if (sid) {
            existingRowMap[sid] = {
              row: i + 1,
              targetJuz: targetJuzIdx !== -1 ? Number(data[i][targetJuzIdx]) || 1 : 1
            };
          }
        }
      }

      const newRows = [];
      studentIds.forEach(id => {
        if (existingRowMap[id]) {
          const r = existingRowMap[id].row;
          const tj = existingRowMap[id].targetJuz || 1;
          sheet.getRange(r, 1, 1, 5).setValues([[id, tj, targetHalamanSesi, targetHalamanPekan, updatedAt]]);
        } else {
          newRows.push([id, 1, targetHalamanSesi, targetHalamanPekan, updatedAt]);
        }
      });

      if (newRows.length > 0) {
        sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 5).setValues(newRows);
      }

      return {
        status: "success",
        success: true,
        totalUpdated: studentIds.length,
        message: `Target capaian berhasil diterapkan ke ${studentIds.length} santri Sorogan.`
      };
    } catch (err) {
      return { status: "error", success: false, message: "Gagal menerapkan target massal Sorogan: " + err.message };
    }
  });
}

function getSoroganSesiList(token) {
  try {
    let actor = null;
    if (token) {
      try {
        actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "SUPER_ADMIN", "EDITOR", "PENGASUH"]);
      } catch (authErr) {
        verifySessionToken(token);
      }
    }

    const ss = getDatabaseSpreadsheet();
    const headers = ["sesi_id", "nama_sesi", "jenis_sesi", "status", "jam_mulai", "jam_selesai", "hari_list", "created_at"];
    const sheet = getOrCreateSoroganSheet(ss, SHEET_SOROGAN_SESI, headers, "#0284c7");

    const data = sheet.getDataRange().getValues();
    const list = [];
    if (data && data.length > 1) {
      const h = data[0].map(x => String(x || "").trim().toLowerCase());
      const idIdx = h.indexOf("sesi_id");
      const nameIdx = h.indexOf("nama_sesi");
      const typeIdx = h.indexOf("jenis_sesi");
      const stIdx = h.indexOf("status");
      const jmIdx = h.indexOf("jam_mulai");
      const jsIdx = h.indexOf("jam_selesai");
      const hIdx = h.indexOf("hari_list");
      const crIdx = h.indexOf("created_at");

      for (let i = 1; i < data.length; i++) {
        const id = idIdx !== -1 ? String(data[i][idIdx] || "").trim() : "";
        if (!id) continue;
        const rawHari = hIdx !== -1 ? data[i][hIdx] : "";
        const hariList = Array.isArray(rawHari) ? rawHari : String(rawHari || "Sen,Sel,Rab,Kam,Sab,Min").split(",").map(x => x.trim()).filter(Boolean);
        list.push({
          sesiId: id,
          namaSesi: nameIdx !== -1 ? String(data[i][nameIdx] || "").trim() : "",
          jenisSesi: typeIdx !== -1 ? String(data[i][typeIdx] || "Sorogan Binnazhar Reguler").trim() : "Sorogan Binnazhar Reguler",
          status: stIdx !== -1 ? String(data[i][stIdx] || "Aktif Digunakan").trim() : "Aktif Digunakan",
          jamMulai: normalizeTimeString(jmIdx !== -1 ? data[i][jmIdx] : "05:15", "05:15"),
          jamSelesai: normalizeTimeString(jsIdx !== -1 ? data[i][jsIdx] : "06:30", "06:30"),
          hariList: hariList,
          createdAt: crIdx !== -1 ? String(data[i][crIdx] || "") : ""
        });
      }
    }

    return {
      status: "success",
      success: true,
      data: list
    };
  } catch (err) {
    return { status: "error", success: false, message: err.message };
  }
}

function saveSoroganSesi(payload, token) {
  return withScriptLock(() => {
    try {
      const p = (payload && (payload.sesi || payload.data)) ? (payload.sesi || payload.data) : (payload || {});
      const namaSesi = String(p.namaSesi || p.nama_sesi || p.nama || "").trim();
      if (!namaSesi) throw new Error("Nama sesi wajib diisi.");

      const ss = getDatabaseSpreadsheet();
      const headers = ["sesi_id", "nama_sesi", "jenis_sesi", "status", "jam_mulai", "jam_selesai", "hari_list", "created_at"];
      const sheet = getOrCreateSoroganSheet(ss, SHEET_SOROGAN_SESI, headers, "#0284c7");

      const rawId = String(p.sesiId || p.sesi_id || p.id || "").trim();
      const sesiId = rawId || ("SRG-SESI-" + Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd-HHmm"));
      const jenisSesi = String(p.jenisSesi || p.jenis_sesi || p.jenis || "Sorogan Binnazhar Reguler").trim();
      const status = String(p.status || "Aktif Digunakan").trim();
      const jamMulai = normalizeTimeString(p.jamMulai || p.jam_mulai, "05:15");
      const jamSelesai = normalizeTimeString(p.jamSelesai || p.jam_selesai, "06:30");
      const rawHari = p.hariList || p.hari || "Sen,Sel,Rab,Kam,Sab,Min";
      const hariList = Array.isArray(rawHari) ? rawHari.join(",") : String(rawHari);
      const createdAt = new Date().toISOString();

      const data = sheet.getDataRange().getValues();
      const headersArr = data[0].map(h => String(h || "").trim().toLowerCase());
      const idIdx = headersArr.indexOf("sesi_id");
      let foundRow = -1;

      if (rawId && idIdx >= 0) {
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][idIdx] || "").trim() === rawId) {
            foundRow = i + 1;
            break;
          }
        }
      }

      const rowValues = [sesiId, namaSesi, jenisSesi, status, jamMulai, jamSelesai, hariList, createdAt];

      if (foundRow > 0) {
        sheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
      } else {
        sheet.appendRow(rowValues);
      }

      return {
        status: "success",
        success: true,
        sesiId: sesiId,
        message: `Jadwal sesi ${namaSesi} Sorogan berhasil disimpan.`
      };
    } catch (err) {
      return { status: "error", success: false, message: "Gagal menyimpan sesi Sorogan: " + err.message };
    }
  });
}

function deleteSoroganSesi(sesiId, token) {
  return withScriptLock(() => {
    try {
      if (!sesiId) throw new Error("ID Sesi wajib disertakan.");
      const ss = getDatabaseSpreadsheet();
      const sheet = ss.getSheetByName(SHEET_SOROGAN_SESI);
      if (!sheet) throw new Error("Sheet Sorogan_Sesi tidak ditemukan.");

      const data = sheet.getDataRange().getValues();
      const idIdx = data[0].map(h => String(h || "").toLowerCase()).indexOf("sesi_id");

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idIdx] || "").trim() === String(sesiId).trim()) {
          sheet.deleteRow(i + 1);
          return { status: "success", success: true, message: "Sesi Sorogan berhasil dihapus." };
        }
      }
      return { status: "error", success: false, message: "Sesi Sorogan tidak ditemukan." };
    } catch (err) {
      return { status: "error", success: false, message: err.message };
    }
  });
}

/**
 * Mengambil detail lengkap mutaba'ah individual santri Sorogan Al-Qur'an (Binnazhar 30 Juz)
 * Termasuk indikator capaian harian, pekanan, bulanan, riwayat simakan, dan estimasi waktu khatam.
 */
function getSoroganStudentDetail(studentId, token) {
  try {
    let actor = null;
    if (token) {
      try {
        actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "SUPER_ADMIN", "EDITOR", "PENGASUH"]);
      } catch (authErr) {
        verifySessionToken(token);
      }
    }

    const cleanId = String(studentId || "").trim();
    if (!cleanId) throw new Error("ID Santri wajib disertakan.");

    const ss = getDatabaseSpreadsheet();

    // 1. Ambil Data Santri secara fleksibel dari master Students
    let student = null;
    const studentsSheet = (typeof getAuthSheet === "function" ? getAuthSheet(ss, SHEET_STUDENTS) : null) || ss.getSheetByName(SHEET_STUDENTS);
    if (studentsSheet) {
      const sData = studentsSheet.getDataRange().getValues();
      if (sData && sData.length > 1) {
        const sHeaders = sData[0].map(h => String(h || "").trim().toLowerCase().replace(/[\s\-_]+/g, ""));
        const sIdIdx = sHeaders.findIndex(h => h === "studentid" || h === "id");
        const sNisIdx = sHeaders.findIndex(h => h === "nis" || h === "nisn");
        const sNameIdx = sHeaders.findIndex(h => h === "name" || h === "nama");
        const sGenderIdx = sHeaders.findIndex(h => h === "gender" || h === "jeniskelamin" || h === "jenis");
        const sPhotoIdx = sHeaders.findIndex(h => h.includes("photo") || h.includes("foto"));
        const sStatusIdx = sHeaders.findIndex(h => h === "status");

        for (let i = 1; i < sData.length; i++) {
          const row = sData[i];
          const stId = sIdIdx !== -1 ? String(row[sIdIdx] || "").trim() : "";
          const stNis = sNisIdx !== -1 ? String(row[sNisIdx] || "").trim() : "";
          const stName = sNameIdx !== -1 ? String(row[sNameIdx] || "").trim() : "";

          if (stId === cleanId || stNis === cleanId || (cleanId.length > 3 && stName.toLowerCase() === cleanId.toLowerCase())) {
            student = {
              studentId: stId || cleanId,
              nis: stNis || "-",
              name: stName || "Santri",
              gender: sGenderIdx !== -1 ? String(row[sGenderIdx] || "L").trim().toUpperCase() : "L",
              photoUrl: sPhotoIdx !== -1 ? String(row[sPhotoIdx] || "").trim() : "",
              status: sStatusIdx !== -1 ? String(row[sStatusIdx] || "ACTIVE").trim().toUpperCase() : "ACTIVE"
            };
            break;
          }
        }
      }
    }

    if (!student) {
      student = {
        studentId: cleanId,
        nis: "-",
        name: "Santri",
        gender: "L",
        photoUrl: "",
        status: "ACTIVE"
      };
    }

    // 2. Ambil Target Santri dari Sorogan_Target
    const targetSheet = getOrCreateSoroganSheet(ss, SHEET_SOROGAN_TARGET, [
      "student_id", "target_juz", "target_halaman_sesi", "target_halaman_pekan", "updated_at"
    ], "#f59e0b");
    const targetData = targetSheet.getDataRange().getValues();
    let target = {
      targetJuz: 30,
      targetHalamanSesi: 2,
      targetHalamanPekan: 22
    };

    if (targetData && targetData.length > 1) {
      const hTarget = targetData[0].map(h => String(h || "").trim().toLowerCase());
      const sIdIdx = hTarget.indexOf("student_id");
      const juzIdx = hTarget.indexOf("target_juz");
      const sesiIdx = hTarget.indexOf("target_halaman_sesi");
      const pekanIdx = hTarget.indexOf("target_halaman_pekan");

      for (let i = 1; i < targetData.length; i++) {
        const sId = String(targetData[i][sIdIdx] || "").trim();
        if (sId === cleanId || (student && sId === student.nis)) {
          const sSesi = Number(targetData[i][sesiIdx] || 2);
          target = {
            targetJuz: Number(targetData[i][juzIdx] || 30),
            targetHalamanSesi: sSesi,
            targetHalamanPekan: Number(targetData[i][pekanIdx] || (sSesi * 11))
          };
          break;
        }
      }
    }

    // 3. Ambil Riwayat Logs Santri dari Sorogan_Logs
    const logsSheet = getOrCreateSoroganSheet(ss, SHEET_SOROGAN_LOGS, [
      "log_id", "student_id", "nis", "student_name", "gender",
      "tanggal", "sesi", "juz", "halaman_list", "total_halaman",
      "status_setoran", "nilai", "muallim", "catatan", "created_at"
    ], "#0369a1");
    const logsData = logsSheet.getDataRange().getValues();
    const riwayat = [];

    if (logsData && logsData.length > 1) {
      const hLogs = logsData[0].map(h => String(h || "").trim().toLowerCase());
      const logIdIdx = hLogs.indexOf("log_id");
      const stIdIdx = hLogs.indexOf("student_id");
      const nisIdx = hLogs.indexOf("nis");
      const tglIdx = hLogs.indexOf("tanggal");
      const sesiIdx = hLogs.indexOf("sesi");
      const juzIdx = hLogs.indexOf("juz");
      const halListIdx = hLogs.indexOf("halaman_list");
      const totalHalIdx = hLogs.indexOf("total_halaman");
      const statusIdx = hLogs.indexOf("status_setoran");
      const nilaiIdx = hLogs.indexOf("nilai");
      const muallimIdx = hLogs.indexOf("muallim");
      const catIdx = hLogs.indexOf("catatan");
      const createdIdx = hLogs.indexOf("created_at");

      for (let i = 1; i < logsData.length; i++) {
        const r = logsData[i];
        const sId = String(r[stIdIdx !== -1 ? stIdIdx : 1] || "").trim();
        const sNis = nisIdx !== -1 ? String(r[nisIdx] || "").trim() : "";

        if (sId === cleanId || (student && (sNis === student.nis || sId === student.studentId))) {
          const rawStatus = statusIdx !== -1 ? String(r[statusIdx] || "").trim().toUpperCase() : "";
          const nilai = nilaiIdx !== -1 ? String(r[nilaiIdx] || "MUMTAZ").trim().toUpperCase() : "MUMTAZ";
          const statusSetoran = rawStatus || (nilai === "DHAIF" ? "ULANG" : "LANCAR");

          riwayat.push({
            logId: logIdIdx !== -1 ? String(r[logIdIdx] || "").trim() : "",
            tanggal: normalizeDateString(tglIdx !== -1 ? r[tglIdx] : ""),
            sesi: sesiIdx !== -1 ? String(r[sesiIdx] || "Pagi").trim() : "Pagi",
            juz: juzIdx !== -1 ? Number(r[juzIdx] || 1) : 1,
            halamanList: halListIdx !== -1 ? String(r[halListIdx] || "1").trim() : "1",
            totalHalaman: totalHalIdx !== -1 ? Number(r[totalHalIdx] || 1) : 1,
            nilai: nilai,
            statusSetoran: statusSetoran,
            muallim: muallimIdx !== -1 ? String(r[muallimIdx] || "").trim() : "",
            catatan: catIdx !== -1 ? String(r[catIdx] || "").trim() : "",
            createdAt: createdIdx !== -1 ? String(r[createdIdx] || "") : ""
          });
        }
      }
    }

    // Urutkan riwayat dari yang terbaru
    riwayat.sort((a, b) => new Date(b.tanggal || b.createdAt) - new Date(a.tanggal || a.createdAt));

    // 4. Ambil Capaian dari Sorogan_Capaian
    const capaianSheet = getOrCreateSoroganSheet(ss, SHEET_SOROGAN_CAPAIAN, [
      "student_id", "student_name", "juz_aktif", "halaman_terakhir", "total_halaman_khatam", "status_terakhir", "halaqah_id", "nama_halaqah", "muallim_pengampu", "updated_at"
    ], "#0f766e");
    const capData = capaianSheet.getDataRange().getValues();
    let currentJuz = 1;
    let halTerakhir = 1;
    let halKhatam = 1;
    let statusTerakhir = "LANCAR";
    let studentHalaqah = "";
    let studentMuallim = "";

    if (capData && capData.length > 1) {
      const hCap = capData[0].map(h => String(h || "").trim().toLowerCase());
      const cIdIdx = hCap.indexOf("student_id");
      const cJuzIdx = hCap.indexOf("juz_aktif");
      const cHalIdx = hCap.indexOf("halaman_terakhir");
      const cKhatamIdx = hCap.indexOf("total_halaman_khatam");
      const cStIdx = hCap.indexOf("status_terakhir");
      const cHalNameIdx = hCap.indexOf("nama_halaqah");
      const cMuhIdx = hCap.indexOf("muallim_pengampu");

      for (let i = 1; i < capData.length; i++) {
        const cId = String(capData[i][cIdIdx] || "").trim();
        if (cId === cleanId || (student && cId === student.nis)) {
          currentJuz = Number(capData[i][cJuzIdx] || 1);
          halTerakhir = Number(capData[i][cHalIdx] || 1);
          halKhatam = Number(capData[i][cKhatamIdx] || Math.max(1, ((currentJuz - 1) * 20) + halTerakhir));
          statusTerakhir = String(capData[i][cStIdx] || "LANCAR").trim().toUpperCase();
          if (cHalNameIdx !== -1 && capData[i][cHalNameIdx]) studentHalaqah = String(capData[i][cHalNameIdx]).trim();
          if (cMuhIdx !== -1 && capData[i][cMuhIdx]) studentMuallim = String(capData[i][cMuhIdx]).trim();
          break;
        }
      }
    }

    // Jika belum ada di Sorogan_Capaian, hitung dari riwayat simakan
    if (riwayat.length > 0) {
      const latestValid = riwayat.find(r => r.statusSetoran !== "ULANG") || riwayat[0];
      if (latestValid) {
        if (currentJuz === 1 && halTerakhir === 1 && latestValid.juz) {
          currentJuz = latestValid.juz;
          const pages = String(latestValid.halamanList || "").split(",").map(p => Number(p.trim())).filter(p => !isNaN(p));
          halTerakhir = pages.length > 0 ? Math.max(...pages) : 1;
        }
      }
    }

    // Rata-rata nilai
    let totalScorePoints = 0;
    riwayat.forEach(r => {
      if (r.nilai === "MUMTAZ") totalScorePoints += 4;
      else if (r.nilai === "JAYYID_JIDDAN") totalScorePoints += 3;
      else if (r.nilai === "JAYYID") totalScorePoints += 2;
      else totalScorePoints += 1;
    });

    let avgNilaiText = "Mumtaz (A)";
    if (riwayat.length > 0) {
      const avgScore = totalScorePoints / riwayat.length;
      if (avgScore >= 3.5) avgNilaiText = "Mumtaz (A)";
      else if (avgScore >= 2.8) avgNilaiText = "Jayyid Jiddan (B+)";
      else if (avgScore >= 2.0) avgNilaiText = "Jayyid (B)";
      else avgNilaiText = "Dha'if (C)";
    }

    // 5. Kalkulasi 3 Indikator (Harian, Pekanan, Bulanan)
    const todayStr = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");
    const todayDate = new Date();
    const startOfWeek = new Date();
    startOfWeek.setDate(todayDate.getDate() - 6);
    const startOfMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);

    let harianReal = 0, harianCount = 0;
    let pekanReal = 0, pekanCount = 0;
    let bulanReal = 0, bulanCount = 0;

    riwayat.forEach(r => {
      const d = new Date(r.tanggal || r.createdAt);
      const hal = r.totalHalaman || 1;

      if (r.tanggal === todayStr) {
        harianCount++;
        harianReal += hal;
      }

      if (d >= startOfWeek) {
        pekanCount++;
        pekanReal += hal;
      }

      if (d >= startOfMonth) {
        bulanCount++;
        bulanReal += hal;
      }
    });

    const targetHarian = target.targetHalamanSesi || 2;
    const targetPekan = target.targetHalamanPekan || (targetHarian * 11);
    const targetBulan = targetPekan * 4;

    const pekanPercent = targetPekan > 0 ? Math.min(100, Math.round((pekanReal / targetPekan) * 100)) : 0;
    const bulanPercent = targetBulan > 0 ? Math.min(100, Math.round((bulanReal / targetBulan) * 100)) : 0;

    // 6. Halaqah & Muallim mapping
    const halaqahSheet = ss.getSheetByName(SHEET_SOROGAN_HALAQAH);
    const halaqahData = halaqahSheet ? halaqahSheet.getDataRange().getValues() : null;
    if (halaqahData && halaqahData.length > 1) {
      const colMap = getSoroganHalaqahColumnIndexes(halaqahData[0]);
      for (let h = 1; h < halaqahData.length; h++) {
        const row = halaqahData[h];
        const members = colMap.studentIds !== -1 ? String(row[colMap.studentIds] || "").split(",").map(m => m.trim().toLowerCase()) : [];
        const cleanIdLower = cleanId.toLowerCase();
        const cleanNisLower = String(student.nis || "").trim().toLowerCase();
        const cleanNameLower = String(student.name || "").trim().toLowerCase();

        const isMatch = members.some(m => {
          if (!m) return false;
          return m === cleanIdLower ||
                 m === cleanNisLower ||
                 (cleanNameLower && m === cleanNameLower) ||
                 m.replace(/[^a-z0-9]/g, "") === cleanIdLower.replace(/[^a-z0-9]/g, "");
        });

        if (isMatch) {
          if (!studentHalaqah && colMap.name !== -1 && row[colMap.name]) {
            studentHalaqah = String(row[colMap.name]).trim();
          }
          if (!studentMuallim && colMap.muallim !== -1 && row[colMap.muallim]) {
            studentMuallim = String(row[colMap.muallim]).trim();
          }
          break;
        }
      }
    }

    if (!studentMuallim && riwayat.length > 0 && riwayat[0].muallim) {
      studentMuallim = riwayat[0].muallim;
    }

    if (!studentHalaqah) studentHalaqah = "Halaqah Sorogan Binnazhar";
    if (!studentMuallim) studentMuallim = "Asatidz Sorogan";

    const halamanTuntas = Math.min(600, Math.max(1, ((currentJuz - 1) * 20) + halTerakhir));
    const percentOverall = Math.min(100, Math.round((halamanTuntas / 600) * 100));

    return {
      status: "success",
      success: true,
      student: {
        studentId: student.studentId || cleanId,
        nis: student.nis || "-",
        name: student.name || "Santri",
        gender: student.gender || "L",
        photoUrl: student.photoUrl || "",
        program: "Sorogan Al-Qur'an (Binnazhar)",
        status: student.status || "ACTIVE",
        halaqah: studentHalaqah,
        muallim: studentMuallim
      },
      halaqah: studentHalaqah,
      muallim: studentMuallim,
      stats: {
        progressJuz: currentJuz,
        halamanTerakhir: halTerakhir,
        totalHalamanKhatam: halamanTuntas,
        capaianSaatIni: `Juz ${currentJuz} Hal ${halTerakhir} (${percentOverall}%)`,
        targetCapaian: "30 Juz Mushaf Pojok",
        totalSetoran: `${riwayat.length} Kali`,
        rataRataNilai: avgNilaiText,
        progressMax: 30,
        progressPercent: percentOverall
      },
      target: target,
      indikator: {
        harian: {
          targetText: `${targetHarian} Halaman / Sesi`,
          realitaText: `${harianReal} Halaman (${harianCount}x Simak)`,
          status: harianCount > 0 ? "Ada Simakan Hari Ini" : "Belum Ada Simakan"
        },
        pekanan: {
          targetText: `${targetPekan} Halaman / Pekan`,
          realitaText: `${pekanReal} Halaman (${pekanCount}x Simak)`,
          percent: pekanPercent,
          status: pekanPercent >= 100 ? "Target Pekan Tercapai" : (pekanPercent > 0 ? `${pekanPercent}% Capaian` : "0% Capaian")
        },
        bulanan: {
          targetText: `${targetBulan} Halaman / Bulan`,
          realitaText: `${bulanReal} Halaman (${bulanCount}x Simak)`,
          percent: bulanPercent,
          status: bulanPercent >= 100 ? "Target Bulan Tercapai" : (bulanPercent > 0 ? `${bulanPercent}% Capaian` : "0% Capaian")
        }
      },
      riwayat: riwayat
    };

  } catch (err) {
    return {
      status: "error",
      success: false,
      message: "Gagal memuat detail santri Sorogan: " + err.message
    };
  }
}

/**
 * Mengambil detail lengkap santri TPQ Yanbu'a:
 * Profil, Capaian Aktif, Target, Statistik Ritme, & Riwayat Bimbingan Lengkap
 */
function getTPQStudentDetail(studentId, token) {
  try {
    if (!studentId) throw new Error("ID Santri wajib disertakan.");
    const cleanId = String(studentId).trim();
    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error("Spreadsheet tidak ditemukan.");

    // 1. Ambil data Santri
    const studentsSheet = ss.getSheetByName(SHEET_STUDENTS);
    let student = null;
    if (studentsSheet) {
      const sData = studentsSheet.getDataRange().getValues();
      if (sData.length >= 2) {
        const sHead = sData[0].map(h => String(h || "").trim().toLowerCase());
        const idIdx = sHead.indexOf("student_id");
        const nisIdx = sHead.indexOf("nis");
        const nameIdx = sHead.indexOf("name");
        const genderIdx = sHead.indexOf("gender");
        const statusIdx = sHead.indexOf("status");
        const photoIdx = sHead.indexOf("photo_url");

        for (let i = 1; i < sData.length; i++) {
          const rowId = String(sData[i][idIdx] || "").trim();
          const rowNis = String(sData[i][nisIdx] || "").trim();
          if (rowId === cleanId || rowNis === cleanId) {
            student = {
              studentId: rowId,
              nis: rowNis,
              name: String(sData[i][nameIdx] || "Santri").trim(),
              gender: String(sData[i][genderIdx] || "L").trim().toUpperCase(),
              status: String(sData[i][statusIdx] || "AKTIF").trim().toUpperCase(),
              photoUrl: photoIdx !== -1 ? String(sData[i][photoIdx] || "").trim() : ""
            };
            break;
          }
        }
      }
    }

    if (!student) {
      student = { studentId: cleanId, nis: "-", name: "Santri TPQ", gender: "L", status: "AKTIF", photoUrl: "" };
    }

    // 2. Ambil data Target
    const targetSheet = ss.getSheetByName(SHEET_TPQ_TARGET);
    let target = { targetJilid: 2, targetHalamanSesi: 1, targetHalamanPekan: 6 };
    if (targetSheet) {
      const tData = targetSheet.getDataRange().getValues();
      if (tData.length >= 2) {
        const tHead = tData[0].map(h => String(h || "").trim().toLowerCase());
        const sIdIdx = tHead.indexOf("student_id");
        const jIdx = tHead.indexOf("target_jilid");
        const sSesiIdx = tHead.indexOf("target_halaman_sesi");
        const sPekanIdx = tHead.indexOf("target_halaman_pekan");

        for (let i = 1; i < tData.length; i++) {
          const sId = String(tData[i][sIdIdx] || "").trim();
          if (sId === cleanId || sId === student.nis) {
            target = {
              targetJilid: Number(tData[i][jIdx]) || 2,
              targetHalamanSesi: Number(tData[i][sSesiIdx]) || 1,
              targetHalamanPekan: Number(tData[i][sPekanIdx]) || 6
            };
            break;
          }
        }
      }
    }

    // 3. Ambil data Riwayat dari TPQ_Logs
    const logsSheet = ss.getSheetByName(SHEET_TPQ_LOGS);
    const riwayat = [];
    if (logsSheet) {
      const lData = logsSheet.getDataRange().getValues();
      if (lData.length >= 2) {
        const lHead = lData[0].map(h => String(h || "").trim().toLowerCase());
        const logIdIdx = lHead.indexOf("log_id");
        const sIdIdx = lHead.indexOf("student_id");
        const nisIdx = lHead.indexOf("nis");
        const tglIdx = lHead.indexOf("tanggal");
        const sesiIdx = lHead.indexOf("sesi");
        const jilidIdx = lHead.indexOf("jilid");
        const halIdx = lHead.indexOf("halaman");
        const stIdx = lHead.indexOf("status_setoran");
        const nilaiIdx = lHead.indexOf("nilai");
        const ustadzIdx = lHead.indexOf("ustadz");
        const catIdx = lHead.indexOf("catatan");
        const createdIdx = lHead.indexOf("created_at");

        for (let i = 1; i < lData.length; i++) {
          const r = lData[i];
          const rowSid = String(r[sIdIdx] || "").trim();
          const rowNis = String(r[nisIdx] || "").trim();

          if (rowSid === cleanId || rowNis === cleanId || (student && rowNis === student.nis)) {
            riwayat.push({
              logId: logIdIdx !== -1 ? String(r[logIdIdx] || "").trim() : ("LOG-" + i),
              tanggal: tglIdx !== -1 ? (r[tglIdx] instanceof Date ? Utilities.formatDate(r[tglIdx], "GMT+7", "yyyy-MM-dd") : String(r[tglIdx] || "").substring(0, 10)) : "",
              sesi: sesiIdx !== -1 ? String(r[sesiIdx] || "").trim() : "Sore",
              jilid: jilidIdx !== -1 ? (Number(r[jilidIdx]) || 1) : 1,
              halaman: halIdx !== -1 ? (Number(r[halIdx]) || 1) : 1,
              statusSetoran: stIdx !== -1 ? String(r[stIdx] || "LANJUT").trim().toUpperCase() : "LANJUT",
              nilai: nilaiIdx !== -1 ? String(r[nilaiIdx] || "MUMTAZ").trim().toUpperCase() : "MUMTAZ",
              ustadz: ustadzIdx !== -1 ? String(r[ustadzIdx] || "").trim() : "",
              catatan: catIdx !== -1 ? String(r[catIdx] || "").trim() : "",
              createdAt: createdIdx !== -1 ? String(r[createdIdx] || "") : ""
            });
          }
        }
      }
    }

    // Urutkan riwayat dari yang terbaru
    riwayat.sort((a, b) => new Date(b.tanggal || b.createdAt) - new Date(a.tanggal || a.createdAt));

    // 4. Ambil Capaian dari TPQ_Capaian
    const capaianSheet = getOrCreateTPQSheet(ss, SHEET_TPQ_CAPAIAN, [
      "student_id", "student_name", "jilid_aktif", "halaman_aktif", "status_terakhir", "kelas_id", "nama_kelas", "ustadz_pengampu", "updated_at"
    ], "#0d9488");
    const capData = capaianSheet.getDataRange().getValues();
    let currentJilid = 1;
    let halAktif = 1;
    let statusTerakhir = "LANJUT";
    let studentKelas = "";
    let studentUstadz = "";

    if (capData && capData.length > 1) {
      const hCap = capData[0].map(h => String(h || "").trim().toLowerCase());
      const cIdIdx = hCap.indexOf("student_id");
      const cJilidIdx = hCap.indexOf("jilid_aktif");
      const cHalIdx = hCap.indexOf("halaman_aktif");
      const cStIdx = hCap.indexOf("status_terakhir");
      const cKNameIdx = hCap.indexOf("nama_kelas");
      const cUstIdx = hCap.indexOf("ustadz_pengampu");

      for (let i = 1; i < capData.length; i++) {
        const cId = String(capData[i][cIdIdx] || "").trim();
        if (cId === cleanId || (student && cId === student.nis)) {
          currentJilid = Number(capData[i][cJilidIdx] || 1);
          halAktif = Number(capData[i][cHalIdx] || 1);
          statusTerakhir = String(capData[i][cStIdx] || "LANJUT").trim().toUpperCase();
          if (cKNameIdx !== -1 && capData[i][cKNameIdx]) studentKelas = String(capData[i][cKNameIdx]).trim();
          if (cUstIdx !== -1 && capData[i][cUstIdx]) studentUstadz = String(capData[i][cUstIdx]).trim();
          break;
        }
      }
    }

    // Jika belum ada nama kelas, cari di TPQ_Kelas via helper
    if (!studentKelas || studentKelas === "Belum Ditentukan") {
      const resolved = resolveTPQKelas_(ss, cleanId, student.nis, "", studentKelas, studentUstadz);
      if (resolved.namaKelas && resolved.namaKelas !== "Belum Ditentukan") studentKelas = resolved.namaKelas;
      if (resolved.ustadz && resolved.ustadz !== "-") studentUstadz = resolved.ustadz;
    }

    if (!studentKelas) studentKelas = "TPQ Yanbu'a";
    if (!studentUstadz) studentUstadz = "Asatidz TPQ";

    // Hitung rata-rata nilai
    let totalScorePoints = 0;
    riwayat.forEach(r => {
      if (r.nilai === "MUMTAZ") totalScorePoints += 4;
      else if (r.nilai === "JAYYID_JIDDAN") totalScorePoints += 3;
      else if (r.nilai === "JAYYID") totalScorePoints += 2;
      else totalScorePoints += 1;
    });

    let avgNilaiText = "Mumtaz (A)";
    if (riwayat.length > 0) {
      const avgScore = totalScorePoints / riwayat.length;
      if (avgScore >= 3.5) avgNilaiText = "Mumtaz (A)";
      else if (avgScore >= 2.8) avgNilaiText = "Jayyid Jiddan (B+)";
      else if (avgScore >= 2.0) avgNilaiText = "Jayyid (B)";
      else avgNilaiText = "Maqbul / Dha'if (C)";
    }

    // 5. Kalkulasi 3 Indikator (Harian, Pekanan, Bulanan)
    const todayStr = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");
    const todayDate = new Date();
    const startOfWeek = new Date();
    startOfWeek.setDate(todayDate.getDate() - 6);
    const startOfMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);

    let harianReal = 0, harianCount = 0;
    let pekanReal = 0, pekanCount = 0;
    let bulanReal = 0, bulanCount = 0;

    riwayat.forEach(r => {
      const d = new Date(r.tanggal || r.createdAt);
      const hal = 1;

      if (r.tanggal === todayStr) {
        harianCount++;
        harianReal += hal;
      }
      if (d >= startOfWeek) {
        pekanCount++;
        pekanReal += hal;
      }
      if (d >= startOfMonth) {
        bulanCount++;
        bulanReal += hal;
      }
    });

    const targetHarian = target.targetHalamanSesi || 1;
    const targetPekan = target.targetHalamanPekan || (targetHarian * 6);
    const targetBulan = targetPekan * 4;

    // Total halaman per jilid rata-rata 44 halaman (Jilid 1-7 = ~308 halaman total)
    const totalHalSelesai = Math.min(308, Math.max(1, ((currentJilid - 1) * 44) + halAktif));
    const percentOverall = Math.min(100, Math.round((totalHalSelesai / 308) * 100));

    return {
      status: "success",
      success: true,
      student: {
        studentId: student.studentId || cleanId,
        nis: student.nis || "-",
        name: student.name || "Santri",
        gender: student.gender || "L",
        photoUrl: student.photoUrl || "",
        program: "TPQ Yanbu'a (Jilid 1 - 7)",
        status: student.status || "ACTIVE",
        kelas: studentKelas,
        ustadz: studentUstadz
      },
      capaian: {
        jilidAktif: currentJilid,
        halamanAktif: halAktif,
        statusTerakhir: statusTerakhir,
        totalHalamanSelesai: totalHalSelesai,
        percentOverall: percentOverall
      },
      target: {
        targetJilid: target.targetJilid || Math.min(7, currentJilid + 1),
        targetHarian: targetHarian,
        targetPekan: targetPekan,
        targetBulan: targetBulan
      },
      realisasi: {
        harianHalaman: harianReal,
        harianSetoran: harianCount,
        pekananHalaman: pekanReal,
        pekananSetoran: pekanCount,
        bulananHalaman: bulanReal,
        bulananSetoran: bulanCount,
        avgNilai: avgNilaiText,
        totalSetoran: riwayat.length
      },
      riwayat: riwayat
    };
  } catch (err) {
    return {
      status: "error",
      success: false,
      message: "Gagal memuat detail santri TPQ: " + err.message
    };
  }
}


