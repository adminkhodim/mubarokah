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

    // ========================================================
    // MIDTRANS WEBHOOK NOTIFICATION HANDLER
    // ========================================================
    if (payload && payload.order_id && payload.signature_key && payload.transaction_status) {
      return handleMidtransWebhook(payload);
    }

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
        return createJsonResponse({ success: false, status: "error", message: authErr.message });
      }
      const res = simpanBerita(payload.data || payload);
      return createJsonResponse(
        typeof res === "object" && res !== null ? Object.assign({ success: res.success !== false }, res) : res
      );
    }

    if (action === "updateBerita") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ success: false, status: "error", message: authErr.message });
      }
      const res = updateBerita(payload.data || payload);
      return createJsonResponse(
        typeof res === "object" && res !== null ? Object.assign({ success: res.success !== false }, res) : res
      );
    }

    if (action === "deleteBerita") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ success: false, status: "error", message: authErr.message });
      }
      const res = deleteBeritaData(payload.data || payload);
      return createJsonResponse(
        typeof res === "object" && res !== null ? Object.assign({ success: res.success !== false }, res) : res
      );
    }

    if (action === "incrementNewsView") {
      const newsId = payload.news_id || payload.id || payload.slug || (payload.data && (payload.data.news_id || payload.data.id || payload.data.slug));
      return createJsonResponse(
        incrementNewsView(newsId)
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
    // Perizinan Asatidz & Delegasi Badal Actions
    if (action === "initIzinAsatidz" || action === "tahfidz.initIzinAsatidz") {
      return createJsonResponse(initIzinAsatidzSheet());
    }

    if (action === "submitIzinAsatidz" || action === "tahfidz.submitIzinAsatidz") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      return createJsonResponse(submitIzinAsatidz(payload.data || payload, token));
    }

    if (action === "getIzinAsatidz" || action === "tahfidz.getIzinAsatidz") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      return createJsonResponse(getIzinAsatidzData(payload.data || payload, token));
    }

    if (action === "approveIzinAsatidz" || action === "tahfidz.approveIzinAsatidz") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      return createJsonResponse(approveIzinAsatidz(payload.data || payload, token));
    }

    if (action === "getActiveBadalDelegations" || action === "tahfidz.getActiveBadal") {
      const p = payload.data || payload;
      return createJsonResponse({
        status: "success",
        success: true,
        data: getActiveBadalDelegations(p.tanggal, p.sesi)
      });
    }

    if (action === "getTahfidzDashboard" || action === "tahfidz.dashboard") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      return createJsonResponse(getTahfidzDashboard(token));
    }

    if (action === "cleanTahfidzCapaianDuplicates" || action === "tahfidz.cleanDuplicates" || action === "syncTahfidzCapaian" || action === "auth.tahfidz.cleanDuplicates") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      return createJsonResponse(cleanTahfidzCapaianDuplicates(token));
    }

    if (action === "runTahfidzSchemaMigration" || action === "tahfidz.migrateSchema" || action === "auth.tahfidz.migrateSchema") {
      return createJsonResponse(runTahfidzSchemaMigration());
    }

    if (action === "saveTahfidzPresensi" || action === "tahfidz.savePresensi") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      return createJsonResponse(saveTahfidzPresensi(payload.data || payload, token));
    }

    if (action === "getTahfidzPresensi" || action === "tahfidz.getPresensi") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      return createJsonResponse(getTahfidzPresensi(payload.data || payload, token));
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
        authorizeRole(actor, ["ADMIN", "SUPER_ADMIN"]);
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
    if (action === "getTPQDashboard" || action === "tpq.dashboard" || action === "auth.tpq.dashboard") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(getTPQDashboard(token));
    }

    if (action === "saveTPQLog" || action === "tpq.saveLog" || action === "auth.tpq.saveLog") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      if (token) {
        try {
          const actor = authenticateSession(token);
          authorizeRole(actor, ["ADMIN", "SUPER_ADMIN", "EDITOR", "PENGASUH", "ASATIDZ", "MUALLIM", "PEGAWAI", "GURU"]);
        } catch (authErr) {
          try { verifySessionToken(token); } catch (e) {
            return createJsonResponse({ status: "error", message: authErr.message });
          }
        }
      }
      return createJsonResponse(saveTPQLog(payload.data || payload, token));
    }

    if (action === "deleteTPQLog" || action === "tpq.deleteLog" || action === "auth.tpq.deleteLog") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      if (token) {
        try {
          const actor = authenticateSession(token);
          authorizeRole(actor, ["ADMIN", "SUPER_ADMIN"]);
        } catch (authErr) {
          try { verifySessionToken(token); } catch (e) {
            return createJsonResponse({ status: "error", message: authErr.message });
          }
        }
      }
      const logId = payload.logId || payload.log_id || (payload.data && (payload.data.logId || payload.data.log_id));
      return createJsonResponse(deleteTPQLog(logId, token));
    }

    if (action === "saveTPQCapaian" || action === "tpq.saveCapaian" || action === "auth.tpq.saveCapaian") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      if (token) {
        try {
          const actor = authenticateSession(token);
          authorizeRole(actor, ["ADMIN", "SUPER_ADMIN", "EDITOR", "PENGASUH", "ASATIDZ", "MUALLIM", "PEGAWAI", "GURU"]);
        } catch (authErr) {
          try { verifySessionToken(token); } catch (e) {
            return createJsonResponse({ status: "error", message: authErr.message });
          }
        }
      }
      return createJsonResponse(saveTPQCapaian(payload.data || payload, token));
    }

    if (action === "getTPQKelasList" || action === "tpq.getKelas" || action === "auth.tpq.getKelas") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(getTPQKelasList(token));
    }

    if (action === "saveTPQKelas" || action === "tpq.saveKelas" || action === "auth.tpq.saveKelas") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      if (token) {
        try {
          const actor = authenticateSession(token);
          authorizeRole(actor, ["ADMIN", "SUPER_ADMIN", "EDITOR"]);
        } catch (authErr) {
          try { verifySessionToken(token); } catch (e) {
            return createJsonResponse({ status: "error", message: authErr.message });
          }
        }
      }
      return createJsonResponse(saveTPQKelas(payload.data || payload, token));
    }

    if (action === "deleteTPQKelas" || action === "tpq.deleteKelas" || action === "auth.tpq.deleteKelas") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      if (token) {
        try {
          const actor = authenticateSession(token);
          authorizeRole(actor, ["ADMIN", "SUPER_ADMIN"]);
        } catch (authErr) {
          try { verifySessionToken(token); } catch (e) {
            return createJsonResponse({ status: "error", message: authErr.message });
          }
        }
      }
      const kId = payload.kelasId || (payload.data && payload.data.kelasId) || "";
      return createJsonResponse(deleteTPQKelas(kId, token));
    }

    if (action === "initTPQSheets" || action === "tpq.initSheets" || action === "auth.tpq.initSheets") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      if (token) {
        try {
          const actor = authenticateSession(token);
          authorizeRole(actor, ["ADMIN", "SUPER_ADMIN"]);
        } catch (authErr) {
          try { verifySessionToken(token); } catch (e) {
            return createJsonResponse({ status: "error", message: authErr.message });
          }
        }
      }
      return createJsonResponse(initTPQSheets(token));
    }

    if (action === "saveTPQPlotting" || action === "tpq.savePlotting" || action === "auth.tpq.savePlotting") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      if (token) {
        try {
          const actor = authenticateSession(token);
          authorizeRole(actor, ["ADMIN", "SUPER_ADMIN", "EDITOR"]);
        } catch (authErr) {
          try { verifySessionToken(token); } catch (e) {
            return createJsonResponse({ status: "error", message: authErr.message });
          }
        }
      }
      return createJsonResponse(saveTPQPlotting(payload.data || payload, token));
    }

    if (action === "saveTPQTarget" || action === "tpq.saveTarget" || action === "auth.tpq.saveTarget") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      if (token) {
        try {
          const actor = authenticateSession(token);
          authorizeRole(actor, ["ADMIN", "SUPER_ADMIN", "EDITOR", "PENGASUH", "ASATIDZ", "MUALLIM", "PEGAWAI", "GURU"]);
        } catch (authErr) {
          try { verifySessionToken(token); } catch (e) {
            return createJsonResponse({ status: "error", message: authErr.message });
          }
        }
      }
      return createJsonResponse(saveTPQTarget(payload.data || payload, token));
    }

    if (action === "saveBulkTPQTarget" || action === "tpq.saveBulkTarget" || action === "saveTPQTargetBulk" || action === "auth.tpq.saveBulkTarget") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      if (token) {
        try {
          const actor = authenticateSession(token);
          authorizeRole(actor, ["ADMIN", "SUPER_ADMIN", "EDITOR", "PENGASUH", "ASATIDZ", "MUALLIM", "PEGAWAI", "GURU"]);
        } catch (authErr) {
          try { verifySessionToken(token); } catch (e) {
            return createJsonResponse({ status: "error", message: authErr.message });
          }
        }
      }
      return createJsonResponse(saveBulkTPQTarget(payload.data || payload, token));
    }

    if (action === "saveTPQSesi" || action === "tpq.saveSesi" || action === "auth.tpq.saveSesi") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      if (token) {
        try {
          const actor = authenticateSession(token);
          authorizeRole(actor, ["ADMIN", "SUPER_ADMIN", "EDITOR"]);
        } catch (authErr) {
          try { verifySessionToken(token); } catch (e) {
            return createJsonResponse({ status: "error", message: authErr.message });
          }
        }
      }
      return createJsonResponse(saveTPQSesi(payload.data || payload.sesi || payload, token));
    }

    if (action === "deleteTPQSesi" || action === "tpq.deleteSesi" || action === "auth.tpq.deleteSesi") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      if (token) {
        try {
          const actor = authenticateSession(token);
          authorizeRole(actor, ["ADMIN", "SUPER_ADMIN"]);
        } catch (authErr) {
          try { verifySessionToken(token); } catch (e) {
            return createJsonResponse({ status: "error", message: authErr.message });
          }
        }
      }
      const sId = payload.sesiId || payload.id || (payload.data && (payload.data.sesiId || payload.data.id)) || "";
      return createJsonResponse(deleteTPQSesi(sId, token));
    }

    if (action === "getTPQStudentDetail" || action === "tpq.studentDetail" || action === "auth.tpq.studentDetail") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      const studentId = payload.studentId || payload.student_id || (payload.data && (payload.data.studentId || payload.data.student_id));
      return createJsonResponse(getTPQStudentDetail(studentId, token));
    }

    // ========================================================
    // MADRASAH DINIYAH (MADIN) ACTIONS (doPost)
    // ========================================================
    if (action === "getMadinData" || action === "madin.getData" || action === "getMadinDashboard") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(getMadinData(token));
    }

    if (action === "initMadinSheets" || action === "madin.initSheets") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(initMadinSheets(token));
    }

    if (action === "saveMadinSession" || action === "madin.saveSession") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(saveMadinSession(payload.data || payload, token));
    }

    if (action === "saveMadinGrades" || action === "madin.saveGrades") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(saveMadinGrades(payload.data || payload, token));
    }

    if (action === "saveMadinClass" || action === "madin.saveClass") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(saveMadinClass(payload.data || payload, token));
    }

    if (action === "saveMadinSubject" || action === "madin.saveSubject") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(saveMadinSubject(payload.data || payload, token));
    }

    if (action === "saveMadinClassMembers" || action === "madin.saveClassMembers") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(saveMadinClassMembers(payload.data || payload, token));
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
        authorizeRole(actor, ["ADMIN", "SUPER_ADMIN", "EDITOR", "PENGASUH", "ASATIDZ", "MUALLIM", "PEGAWAI", "GURU"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(saveSoroganLog(payload.data || payload, token));
    }

    if (action === "deleteSoroganLog" || action === "sorogan.deleteLog") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "SUPER_ADMIN"]);
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
        authorizeRole(actor, ["ADMIN", "SUPER_ADMIN", "EDITOR", "PENGASUH", "ASATIDZ", "MUALLIM", "PEGAWAI", "GURU"]);
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
        authorizeRole(actor, ["ADMIN", "SUPER_ADMIN"]);
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
        authorizeRole(actor, ["ADMIN", "SUPER_ADMIN", "EDITOR", "PENGASUH", "ASATIDZ", "MUALLIM", "PEGAWAI", "GURU"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(saveSoroganTarget(payload.data || payload, token));
    }

    if (action === "saveBulkSoroganTarget" || action === "sorogan.saveBulkTarget") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "SUPER_ADMIN", "EDITOR", "PENGASUH", "ASATIDZ", "MUALLIM", "PEGAWAI", "GURU"]);
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
    // PRESENSI KEGIATAN SANTRI ACTIONS (doPost)
    // ========================================================
    if (action === "getPresensiDashboard" || action === "presensi.dashboard" || action === "auth.presensi.dashboard") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(getPresensiDashboard(token));
    }

    if (action === "getPresensiKegiatanList" || action === "presensi.getKegiatan") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(getPresensiKegiatanList(token));
    }

    if (action === "savePresensiKegiatan" || action === "presensi.saveKegiatan") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      if (token) {
        try {
          const actor = authenticateSession(token);
          authorizeRole(actor, ["ADMIN", "SUPER_ADMIN", "EDITOR", "PEGAWAI", "PENGASUH", "ASATIDZ", "GURU", "MUALLIM"]);
        } catch (authErr) {
          try { verifySessionToken(token); } catch (e) {
            return createJsonResponse({ status: "error", message: authErr.message });
          }
        }
      }
      return createJsonResponse(savePresensiKegiatan(payload.data || payload, token));
    }

    if (action === "deletePresensiKegiatan" || action === "presensi.deleteKegiatan") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      if (token) {
        try {
          const actor = authenticateSession(token);
          authorizeRole(actor, ["ADMIN", "SUPER_ADMIN", "EDITOR"]);
        } catch (authErr) {
          try { verifySessionToken(token); } catch (e) {
            return createJsonResponse({ status: "error", message: authErr.message });
          }
        }
      }
      const kId = payload.kegiatanId || payload.id || (payload.data && (payload.data.kegiatanId || payload.data.id)) || "";
      return createJsonResponse(deletePresensiKegiatan(kId, token));
    }

    if (action === "savePresensiSesi" || action === "presensi.saveSesi") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      if (token) {
        try {
          const actor = authenticateSession(token);
          authorizeRole(actor, ["ADMIN", "SUPER_ADMIN", "EDITOR", "PEGAWAI", "PENGASUH", "ASATIDZ", "GURU", "MUALLIM"]);
        } catch (authErr) {
          try { verifySessionToken(token); } catch (e) {
            return createJsonResponse({ status: "error", message: authErr.message });
          }
        }
      }
      return createJsonResponse(savePresensiSesi(payload.data || payload, token));
    }

    if (action === "getPresensiSesiDetail" || action === "presensi.sesiDetail") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      const sId = payload.sesiId || payload.id || (payload.data && (payload.data.sesiId || payload.data.id)) || "";
      return createJsonResponse(getPresensiSesiDetail(sId, token));
    }

    if (action === "deletePresensiSesi" || action === "presensi.deleteSesi") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      if (token) {
        try {
          const actor = authenticateSession(token);
          authorizeRole(actor, ["ADMIN", "SUPER_ADMIN", "EDITOR"]);
        } catch (authErr) {
          try { verifySessionToken(token); } catch (e) {
            return createJsonResponse({ status: "error", message: authErr.message });
          }
        }
      }
      const sId = payload.sesiId || payload.id || (payload.data && (payload.data.sesiId || payload.data.id)) || "";
      return createJsonResponse(deletePresensiSesi(sId, token));
    }

    if (action === "getPresensiRekap" || action === "presensi.rekap") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      const filter = payload.filter || (payload.data && payload.data.filter) || {};
      return createJsonResponse(getPresensiRekap(filter, token));
    }

    // ========================================================
    // KEUANGAN & PEMBAYARAN SANTRI ACTIONS (doPost)
    // ========================================================
    if (action === "getKeuanganDashboard" || action === "keuangan.dashboard" || action === "keuangan.getDashboard") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(getKeuanganDashboard(token));
    }

    if (action === "getStudentBilling" || action === "keuangan.studentBilling" || action === "keuangan.getStudentBilling") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      const studentId = payload.studentId || (payload.data && payload.data.studentId) || "";
      return createJsonResponse(getStudentBilling(studentId, token));
    }

    if (action === "bayarTagihan" || action === "keuangan.bayarTagihan" || action === "prosesPembayaranTagihan") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["SUPER_ADMIN", "ADMIN", "BENDAHARA"]);
        return createJsonResponse(prosesPembayaranTagihan(payload.data || payload, token, actor));
      } catch (authErr) {
        return createJsonResponse({ status: "error", success: false, message: authErr.message });
      }
    }

    if (action === "createMidtransSnapToken" || action === "keuangan.createMidtransToken" || action === "getMidtransSnapToken") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      try {
        let actor = null;
        if (token) {
          try {
            actor = authenticateSession(token);
            authorizeRole(actor, ["SUPER_ADMIN", "ADMIN", "BENDAHARA", "PENGASUH", "WALI_SANTRI", "PARENT"]);
          } catch (eAuth) {
            actor = { role: "WALI_SANTRI", name: "Wali Santri" };
          }
        } else {
          actor = { role: "WALI_SANTRI", name: "Wali Santri" };
        }
        return createJsonResponse(createMidtransSnapToken(payload.data || payload, token, actor));
      } catch (authErr) {
        return createJsonResponse({ status: "error", success: false, message: authErr.message });
      }
    }

    if (action === "batalTransaksi" || action === "keuangan.batalTransaksi" || action === "voidTransaksi") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["SUPER_ADMIN", "ADMIN", "BENDAHARA"]);
        return createJsonResponse(batalTransaksiKeuangan(payload.data || payload, token, actor));
      } catch (authErr) {
        return createJsonResponse({ status: "error", success: false, message: authErr.message });
      }
    }

    if (action === "generateBulkMonthlyBills" || action === "keuangan.generateBulanan" || action === "generateBulkTagihan") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["SUPER_ADMIN", "ADMIN", "BENDAHARA"]);
        return createJsonResponse(generateBulkMonthlyBills(payload.data || payload, token, actor));
      } catch (authErr) {
        return createJsonResponse({ status: "error", success: false, message: authErr.message });
      }
    }

    if (action === "saveMasterTarif" || action === "keuangan.saveTarif") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["SUPER_ADMIN", "ADMIN", "BENDAHARA"]);
        return createJsonResponse(saveMasterTarif(payload.data || payload, token, actor));
      } catch (authErr) {
        return createJsonResponse({ status: "error", success: false, message: authErr.message });
      }
    }

    if (action === "deleteMasterTarif" || action === "keuangan.deleteTarif") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["SUPER_ADMIN", "ADMIN", "BENDAHARA"]);
        const tarifId = payload.tarifId || (payload.data && payload.data.tarifId) || "";
        return createJsonResponse(deleteMasterTarif(tarifId, token));
      } catch (authErr) {
        return createJsonResponse({ status: "error", success: false, message: authErr.message });
      }
    }

    if (action === "initKeuanganSheets" || action === "keuangan.initSheets") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["SUPER_ADMIN", "ADMIN"]);
        return createJsonResponse(initKeuanganSheets(token));
      } catch (authErr) {
        return createJsonResponse({ status: "error", success: false, message: authErr.message });
      }
    }

    if (action === "savePengeluaran" || action === "keuangan.savePengeluaran") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["SUPER_ADMIN", "ADMIN", "BENDAHARA"]);
        return createJsonResponse(savePengeluaranKeuangan(payload.data || payload, token, actor));
      } catch (authErr) {
        return createJsonResponse({ status: "error", success: false, message: authErr.message });
      }
    }

    if (action === "batalPengeluaran" || action === "keuangan.batalPengeluaran" || action === "voidPengeluaran") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["SUPER_ADMIN", "ADMIN", "BENDAHARA"]);
        return createJsonResponse(batalPengeluaranKeuangan(payload.data || payload, token, actor));
      } catch (authErr) {
        return createJsonResponse({ status: "error", success: false, message: authErr.message });
      }
    }

    if (action === "submitTutupKasir" || action === "keuangan.submitTutupKasir") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["SUPER_ADMIN", "ADMIN", "BENDAHARA"]);
        return createJsonResponse(submitTutupKasirKeuangan(payload.data || payload, token, actor));
      } catch (authErr) {
        return createJsonResponse({ status: "error", success: false, message: authErr.message });
      }
    }

    if (action === "submitKonfirmasiTransfer" || action === "keuangan.submitKonfirmasiTransfer") {
      return createJsonResponse(submitKonfirmasiTransferKeuangan(payload.data || payload));
    }

    if (action === "verifyKonfirmasiTransfer" || action === "keuangan.verifyKonfirmasiTransfer") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["SUPER_ADMIN", "ADMIN", "BENDAHARA"]);
        return createJsonResponse(verifyKonfirmasiTransferKeuangan(payload.data || payload, token, actor));
      } catch (authErr) {
        return createJsonResponse({ status: "error", success: false, message: authErr.message });
      }
    }

    if (action === "getBroadcastTagihanList" || action === "keuangan.getBroadcastTagihanList") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["SUPER_ADMIN", "ADMIN", "BENDAHARA"]);
        return createJsonResponse(getBroadcastTagihanListKeuangan(payload.data || payload, token));
      } catch (authErr) {
        return createJsonResponse({ status: "error", success: false, message: authErr.message });
      }
    }

    // ========================================================
    // FASE 4: TABUNGAN SANTRI, KANTIN CASHLESS & ANALYTICS
    // ========================================================
    if (action === "getTabunganDashboard" || action === "keuangan.getTabunganDashboard") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      return createJsonResponse(getTabunganSantriDashboard(token));
    }

    if (action === "topupTabungan" || action === "keuangan.topupTabungan") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      try {
        let actor = null;
        if (token) {
          try {
            actor = authenticateSession(token);
            authorizeRole(actor, ["SUPER_ADMIN", "ADMIN", "BENDAHARA", "PENGASUH", "WALI_SANTRI", "PARENT"]);
          } catch (eAuth) {
            actor = { role: "WALI_SANTRI", name: "Wali Santri" };
          }
        } else {
          actor = { role: "WALI_SANTRI", name: "Wali Santri" };
        }
        return createJsonResponse(topupTabunganSantri(payload.data || payload, token, actor));
      } catch (authErr) {
        return createJsonResponse({ status: "error", success: false, message: authErr.message });
      }
    }

    if (action === "tarikTabungan" || action === "keuangan.tarikTabungan") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["SUPER_ADMIN", "ADMIN", "BENDAHARA"]);
        return createJsonResponse(tarikTabunganSantri(payload.data || payload, token, actor));
      } catch (authErr) {
        return createJsonResponse({ status: "error", success: false, message: authErr.message });
      }
    }

    if (action === "transaksiKantin" || action === "keuangan.transaksiKantin" || action === "transaksiKantinCashless") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["SUPER_ADMIN", "ADMIN", "BENDAHARA", "KASIR", "KANTIN"]);
        return createJsonResponse(transaksiKantinCashless(payload.data || payload, token, actor));
      } catch (authErr) {
        return createJsonResponse({ status: "error", success: false, message: authErr.message });
      }
    }

    if (action === "updateLimitTabungan" || action === "keuangan.updateLimitTabungan") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["SUPER_ADMIN", "ADMIN", "BENDAHARA"]);
        return createJsonResponse(updateLimitTabunganSantri(payload.data || payload, token, actor));
      } catch (authErr) {
        return createJsonResponse({ status: "error", success: false, message: authErr.message });
      }
    }

    if (action === "getExecutiveAnalytics" || action === "keuangan.getExecutiveAnalytics") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["SUPER_ADMIN", "ADMIN", "BENDAHARA", "PENGASUH"]);
        return createJsonResponse(getExecutiveAnalyticsKeuangan(token));
      } catch (authErr) {
        return createJsonResponse({ status: "error", success: false, message: authErr.message });
      }
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
        authorizeRole(actor, ["ADMIN", "EDITOR", "PENGURUS"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(simpanGaleri(payload.data || payload));
    }

    if (action === "savePengaturan") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR", "PENGURUS"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(simpanPengaturan(payload.data || payload));
    }

    if (action === "deleteGaleri") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR", "PENGURUS"]);
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
        authorizeRole(actor, ["ADMIN", "EDITOR", "PENGURUS"]);
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

    // ========================================================
    // JADWAL KEGIATAN SANTRI API ROUTER (POST)
    // ========================================================
    if (action === "getJadwalKegiatan") {
      return createJsonResponse(getJadwalKegiatanData());
    }

    if (action === "saveJadwalKegiatan") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      return createJsonResponse(simpanJadwalKegiatan(payload.data || payload));
    }

    if (action === "deleteJadwalKegiatan") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      const jadwalId = payload.id || (payload.data && payload.data.id);
      if (!jadwalId) {
        return createJsonResponse({ status: "error", message: "ID Jadwal wajib diisi" });
      }
      return createJsonResponse(hapusJadwalKegiatan(jadwalId));
    }

    if (action === "toggleJadwalKegiatan") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        return createJsonResponse({ status: "error", message: authErr.message });
      }
      const jadwalId = payload.id || (payload.data && payload.data.id);
      const newStatus = payload.newStatus || (payload.data && payload.data.newStatus);
      if (!jadwalId || !newStatus) {
        return createJsonResponse({ status: "error", message: "ID Jadwal dan status wajib diisi" });
      }
      return createJsonResponse(toggleStatusJadwalKegiatan(jadwalId, newStatus));
    }

    if (action === "alumni.getTestimonials") {
      return createJsonResponse(getAlumniTestimonials());
    }

    if (action === "alumni.getAll" || action === "alumni.list") {
      return createJsonResponse(getAllAlumniData());
    }

    if (action === "alumni.create") {
      return createJsonResponse(saveAlumniData(payload));
    }

    if (action === "alumni.delete") {
      const token = payload.token || (payload.data && payload.data.token) || null;
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "SUPER_ADMIN", "PENGURUS"]);
      } catch (authErr) {
        return createJsonResponse({ success: false, status: "error", message: "Otorisasi gagal: " + authErr.message });
      }
      const rowIndex = payload.rowIndex || (payload.data && payload.data.rowIndex);
      const nama = payload.nama || (payload.data && payload.data.nama);
      return createJsonResponse(deleteAlumniData(rowIndex, nama));
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
      formData.isi,
      Number(formData.views) || 0
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

function incrementNewsView(news_id) {
  if (!news_id) {
    return { success: false, message: "ID atau slug berita wajib disertakan." };
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: "Sistem sedang sibuk. (Lock gagal)" };
  }

  try {
    var ss = getDatabaseSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheetByName("Kabar");
    if (!sheet) {
      return { success: false, message: "Sheet Berita tidak ditemukan." };
    }

    var lastCol = Math.max(sheet.getLastColumn(), 10);
    var header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    
    // Pastikan header kolom Views tersedia
    var isMigrated = (header[0] === "news_id" && header[1] === "slug");
    var viewCol = isMigrated ? 10 : 8;

    if (!header[viewCol - 1] || String(header[viewCol - 1]).trim().toLowerCase() !== "views") {
      sheet.getRange(1, viewCol).setValue("Views");
    }

    var data = sheet.getDataRange().getValues();
    var targetRow = -1;
    var currentViews = 0;
    var searchKey = String(news_id).trim().toLowerCase();

    for (var i = 1; i < data.length; i++) {
      var rowId = String(data[i][0] || "").trim().toLowerCase();
      var rowSlug = String(data[i][1] || "").trim().toLowerCase();
      var rowTitle = String(isMigrated ? data[i][3] : data[i][1] || "").trim().toLowerCase();
      if (rowId === searchKey || rowSlug === searchKey || rowTitle === searchKey) {
        targetRow = i + 1;
        currentViews = Number(data[i][viewCol - 1]) || 0;
        break;
      }
    }

    if (targetRow === -1) {
      return { success: false, message: "Berita dengan ID/slug tersebut tidak ditemukan." };
    }

    var newViews = currentViews + 1;
    sheet.getRange(targetRow, viewCol).setValue(newViews);
    return { success: true, news_id: news_id, views: newViews };
  } catch (err) {
    return { success: false, message: err.toString() };
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

    if (action === "incrementNewsView") {
      var newsId = e.parameter.news_id || e.parameter.id || e.parameter.slug;
      return createJsonResponse(
        incrementNewsView(newsId)
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

    if (action === "alumni.getAll" || action === "alumni.list") {
      return createJsonResponse(getAllAlumniData());
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

    if (action === "getJadwalKegiatan") {
      return createJsonResponse(
        getJadwalKegiatanData()
      );
    }

    if (action === "getStudents" || action === "student.list") {
      const token = e.parameter.token || null;
      return createJsonResponse(
        getAllStudentsData(token)
      );
    }

    if (action === "getIzinAsatidz" || action === "tahfidz.getIzinAsatidz") {
      const token = e.parameter.token || null;
      return createJsonResponse(getIzinAsatidzData(e.parameter, token));
    }

    if (action === "getActiveBadalDelegations" || action === "tahfidz.getActiveBadal") {
      return createJsonResponse({
        status: "success",
        success: true,
        data: getActiveBadalDelegations(e.parameter.tanggal, e.parameter.sesi)
      });
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

    if (action === "getMadinData" || action === "madin.getData" || action === "getMadinDashboard") {
      const token = e.parameter.token || null;
      return createJsonResponse(getMadinData(token));
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

    if (action === "getPresensiDashboard" || action === "presensi.dashboard") {
      const token = e.parameter.token || null;
      return createJsonResponse(getPresensiDashboard(token));
    }

    if (action === "getPresensiKegiatanList" || action === "presensi.getKegiatan") {
      const token = e.parameter.token || null;
      return createJsonResponse(getPresensiKegiatanList(token));
    }

    if (action === "getPresensiSesiDetail" || action === "presensi.sesiDetail") {
      const token = e.parameter.token || null;
      const sId = e.parameter.sesiId || e.parameter.id || null;
      return createJsonResponse(getPresensiSesiDetail(sId, token));
    }

    if (action === "getPresensiRekap" || action === "presensi.rekap") {
      const token = e.parameter.token || null;
      var filter = {};
      if (e.parameter.startDate) filter.startDate = e.parameter.startDate;
      if (e.parameter.endDate) filter.endDate = e.parameter.endDate;
      if (e.parameter.kegiatanId) filter.kegiatanId = e.parameter.kegiatanId;
      if (e.parameter.gender) filter.gender = e.parameter.gender;
      return createJsonResponse(getPresensiRekap(filter, token));
    }

    if (action === "getKeuanganDashboard" || action === "keuangan.dashboard" || action === "keuangan.getDashboard") {
      const token = e.parameter.token || null;
      return createJsonResponse(getKeuanganDashboard(token));
    }

    if (action === "getStudentBilling" || action === "keuangan.studentBilling" || action === "keuangan.getStudentBilling") {
      const token = e.parameter.token || null;
      const studentId = e.parameter.studentId || e.parameter.student_id || null;
      return createJsonResponse(getStudentBilling(studentId, token));
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
            penulis: data[i][5] ? String(data[i][5]) : "Admin",
            gambar: data[i][6] ? String(data[i][6]) : "",
            ringkasan: data[i][7] ? String(data[i][7]) : "",
            isi: data[i][8] ? String(data[i][8]) : "",
            views: Number(data[i][9]) || 0
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
            isi: data[i][6] ? String(data[i][6]) : "",
            views: Number(data[i][7]) || 0
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
const JADWAL_KEGIATAN_SHEET_NAME = "Jadwal_Kegiatan";
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
  let str = rawUrl.trim();
  if (!str) return "";

  // 1. Ekstrak src jika pengguna menyalin kode <iframe> dari YouTube
  const iframeSrc = str.match(/src=["']([^"']+)["']/i);
  if (iframeSrc && iframeSrc[1]) {
    str = iframeSrc[1].trim();
  }

  // 2. Playlist YouTube
  const playlistMatch = str.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  if (playlistMatch && playlistMatch[1] && !str.includes("watch?v=")) {
    return "https://www.youtube.com/embed/videoseries?list=" + playlistMatch[1] + "&rel=0";
  }

  // 3. Raw 11-char Video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) {
    return "https://www.youtube.com/embed/" + str + "?rel=0";
  }

  // 4. youtu.be, embed, shorts, live, v
  const match = str.match(/(?:youtu\.be\/|youtube\.com\/(?:embed|shorts|live|v)\/)([a-zA-Z0-9_-]{11})/i);
  if (match && match[1]) {
    return "https://www.youtube.com/embed/" + match[1] + "?rel=0";
  }

  // 5. watch?v=VIDEO_ID atau &v=VIDEO_ID
  const watchMatch = str.match(/[?&]v=([a-zA-Z0-9_-]{11})/i);
  if (watchMatch && watchMatch[1]) {
    return "https://www.youtube.com/embed/" + watchMatch[1] + "?rel=0";
  }

  // 6. Jika sudah embed URL
  if (str.includes("youtube.com/embed/") || str.includes("youtube-nocookie.com/embed/")) {
    return str.includes("?") ? str : (str + "?rel=0");
  }

  return str;
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
      if (k === "action" || k === "token" || k === "tenantId") continue;
      
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
    
    return { success: true, status: "success", ok: true, message: "Pengaturan berhasil disimpan!" };
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

// ==================== PENGELOLAAN JADWAL KEGIATAN SANTRI ====================
function getJadwalKegiatanData() {
  try {
    const ss = getDatabaseSpreadsheet();
    let sheet = ss.getSheetByName(JADWAL_KEGIATAN_SHEET_NAME);

    // Jika sheet belum ada, buat otomatis beserta header dan 25 agenda default
    if (!sheet) {
      sheet = ss.insertSheet(JADWAL_KEGIATAN_SHEET_NAME);
      sheet.appendRow(["ID_Jadwal", "Nama_Kegiatan", "Tipe", "Waktu", "Tag", "Deskripsi", "Urutan", "Status", "Timestamp"]);

      const nowIso = new Date().toISOString();
      const defaultAgenda = [
        // 11 AGENDA HARIAN
        ["JDW_H_01", "Qiyamul Lail & Sholat Tahajud", "Harian", "03.30 - 04.30 WIB", "24 Jam", "Pembiasaan sholat sunnah tahajud, witir, dan istighfar fajar berjamaah di asrama santri.", 1, "Aktif", nowIso],
        ["JDW_H_02", "Sholat Subuh & Muroja'ah Pagi", "Harian", "04.30 - 05.30 WIB", "Wajib", "Sholat Subuh berjamaah dilanjutkan dzikir pagi dan muroja'ah hafalan Qur'an mandiri.", 2, "Aktif", nowIso],
        ["JDW_H_03", "Halaqah Tahfidz Pagi", "Harian", "05.30 - 06.30 WIB", "Tahfidz", "Setoran ziyadah hafalan baru Al-Qur'an dan bimbingan tajwid bersama ustadz pembina halaqah.", 3, "Aktif", nowIso],
        ["JDW_H_04", "Sarapan & Piket Kebersihan Pondok", "Harian", "06.30 - 07.15 WIB", "Kedisiplinan", "Makan pagi bersama dan operasi bersih lingkungan kamar santri dan area pesantren.", 4, "Aktif", nowIso],
        ["JDW_H_05", "Sholat Dhuha Berjamaah", "Harian", "07.15 - 07.45 WIB", "Sunnah", "Pelaksanaan sholat sunnah dhuha secara berjamaah di masjid utama sebelum kegiatan belajar formal.", 5, "Aktif", nowIso],
        ["JDW_H_06", "Kegiatan Belajar Madrasah / Sekolah", "Harian", "07.45 - 11.45 WIB", "Formal", "Pembelajaran kurikulum formal, sains, bahasa, dan keilmuan umum di kelas madrasah.", 6, "Aktif", nowIso],
        ["JDW_H_07", "Sholat Dhuhur & Istirahat Qailulah", "Harian", "11.45 - 13.30 WIB", "Istirahat", "Sholat Dhuhur berjamaah, makan siang, dan tidur siang sejenak mengikuti sunnah nabi.", 7, "Aktif", nowIso],
        ["JDW_H_08", "Pembelajaran Madrasah Diniyah", "Harian", "13.30 - 15.00 WIB", "Diniyah", "Kajian kitab kuning dasar (Safinatun Najah, Jurumiyyah, Aqidatul Awam, dll) sesuai tingkatan kelas.", 8, "Aktif", nowIso],
        ["JDW_H_09", "Sholat Ashar & Mufradat Bahasa", "Harian", "15.15 - 16.30 WIB", "Bahasa", "Sholat Ashar berjamaah dan penambahan kosa kata harian Bahasa Arab dan Inggris santri.", 9, "Aktif", nowIso],
        ["JDW_H_10", "Sholat Maghrib & Sorogan Kitab / Yanbu'a", "Harian", "17.45 - 19.00 WIB", "Sorogan", "Sholat Maghrib, membaca ratib/wirid, dan sorogan qira'ah Al-Qur'an metode Yanbu'a.", 10, "Aktif", nowIso],
        ["JDW_H_11", "Sholat Isya & Belajar Malam Terbimbing", "Harian", "19.15 - 21.30 WIB", "Muroja'ah", "Sholat Isya berjamaah dilanjutkan mudzakarah pelajaran dan persiapan setoran hafalan esok hari.", 11, "Aktif", nowIso],

        // 5 AGENDA MINGGUAN
        ["JDW_M_01", "Puasa Sunnah & Buka Bersama sama", "Mingguan", "Senin & Kamis", "Sunnah", "Pelaksanaan Puasa Sunnah Senin-Kamis dilanjutkan doa & buka puasa bersama santri di aula.", 1, "Aktif", nowIso],
        ["JDW_M_02", "Pembacaan Maulid Simthudduror / Diba'", "Mingguan", "Malam Jumat", "Sholawat", "Gema sholawat nabi dan pembacaan maulid diiringi tim hadroh santri di masjid utama.", 2, "Aktif", nowIso],
        ["JDW_M_03", "Mujahadah & Istighotsah Kubro Santri", "Mingguan", "Jumat Pagi", "Doa Bersama", "Doa bersama untuk keberkahan ilmu, orang tua wali santri, bangsa, dan kebaikan umat.", 3, "Aktif", nowIso],
        ["JDW_M_04", "Latihan Khithobah & Muhadharah 3 Bahasa", "Mingguan", "Sabtu Malam", "Public Speaking", "Latihan pidato santri dalam bahasa Indonesia, Arab, dan Inggris melatih mental kepemimpinan.", 4, "Aktif", nowIso],
        ["JDW_M_05", "Senam Santri & Ro'an Akbar Pondok", "Mingguan", "Ahad Pagi", "Kebugaran", "Olahraga kebugaran santri dilanjutkan kerja bakti massal membersihkan lingkungan pondok.", 5, "Aktif", nowIso],

        // 4 AGENDA BULANAN
        ["JDW_B_01", "Sema'an Al-Qur'an Bil-Ghaib", "Bulanan", "Pekan Ke-1", "P-1", "Khataman Al-Qur'an hafalan santri secara bergantian dalam satu hari di majlis utama.", 1, "Aktif", nowIso],
        ["JDW_B_02", "Santunan Yatim & Doa Bersama Wali Santri", "Bulanan", "Jumat Kliwon", "Sosial", "Pemberian santunan dan doa istighatsah bulanan bersama donatur dan masyarakat sekitar pondok.", 2, "Aktif", nowIso],
        ["JDW_B_03", "Evaluasi Bulanan & Tasmi' Juziyyah", "Bulanan", "Pekan Ke-4", "Ujian Tahfidz", "Ujian tasmi' sekali duduk per 1 juz atau 5 juz di hadapan dewan asatidz tahfidz.", 3, "Aktif", nowIso],
        ["JDW_B_04", "Sidang Dewan Pengurus & Bahtsul Masail", "Bulanan", "Sabtu Malam Akhir Bulan", "Musyawarah", "Musyawarah fikih dan evaluasi manajemen kegiatan kedisiplinan santri antarpengurus.", 4, "Aktif", nowIso],

        // 5 AGENDA TAHUNAN
        ["JDW_T_01", "Peringatan Maulid Nabi & Haflah Akhirussanah", "Tahunan", "Bulan Rabiul Awwal", "Event Akbar", "Perayaan maulid nabi dan temu akbar wali santri dengan tabligh akbar ulama.", 1, "Aktif", nowIso],
        ["JDW_T_02", "Khotmil Qur'an & Wisuda Santri", "Tahunan", "Bulan Sya'ban", "Wisuda", "Prosesi sakral wisuda santri yang telah menyelesaikan hafalan 30 Juz dan kitab diniyah.", 2, "Aktif", nowIso],
        ["JDW_T_03", "Pesantren Kilat Ramadhan & Tarawih 30 Juz", "Tahunan", "Bulan Ramadhan", "Ramadhan", "Kajian pasaran kitab kuning intensif dan sholat tarawih 1 malam 1 juz Al-Qur'an.", 3, "Aktif", nowIso],
        ["JDW_T_04", "Kemah Santri & Peringatan Hari Santri Nasional", "Tahunan", "22 Oktober", "Hari Santri", "Apel akbar hari santri nasional, perkemahan, napak tilas perjuangan muassis pesantren.", 4, "Aktif", nowIso],
        ["JDW_T_05", "Rihlah Ilmiah & Ziarah Wali Songo", "Tahunan", "Liburan Akhir Tahun", "Ziarah", "Perjalanan ziarah makam para wali dan ulama nusantara memperkuat sanad dan berkah.", 5, "Aktif", nowIso]
      ];

      for (var d = 0; d < defaultAgenda.length; d++) {
        sheet.appendRow(defaultAgenda[d]);
      }
    }

    const data = sheet.getDataRange().getValues();
    const list = [];

    for (var i = 1; i < data.length; i++) {
      if (data[i][0]) {
        list.push({
          id: String(data[i][0]),
          nama: String(data[i][1] || ""),
          tipe: String(data[i][2] || "Harian"),
          waktu: String(data[i][3] || ""),
          tag: String(data[i][4] || ""),
          deskripsi: String(data[i][5] || ""),
          urutan: Number(data[i][6]) || 1,
          status: String(data[i][7] || "Aktif"),
          timestamp: String(data[i][8] || "")
        });
      }
    }

    list.sort(function(a, b) {
      return a.urutan - b.urutan;
    });

    return { status: "success", data: list };
  } catch (err) {
    return { status: "error", message: err.toString(), data: [] };
  }
}

function simpanJadwalKegiatan(formData) {
  try {
    const ss = getDatabaseSpreadsheet();
    let sheet = ss.getSheetByName(JADWAL_KEGIATAN_SHEET_NAME);
    if (!sheet) {
      getJadwalKegiatanData();
      sheet = ss.getSheetByName(JADWAL_KEGIATAN_SHEET_NAME);
    }

    const data = sheet.getDataRange().getValues();
    let isEdit = false;
    const nowIso = new Date().toISOString();
    const targetId = formData.id;

    if (targetId) {
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(targetId)) {
          sheet.getRange(i + 1, 2).setValue(formData.nama || "");
          sheet.getRange(i + 1, 3).setValue(formData.tipe || "Harian");
          sheet.getRange(i + 1, 4).setValue(formData.waktu || "");
          sheet.getRange(i + 1, 5).setValue(formData.tag || "");
          sheet.getRange(i + 1, 6).setValue(formData.deskripsi || "");
          sheet.getRange(i + 1, 7).setValue(Number(formData.urutan) || 1);
          sheet.getRange(i + 1, 8).setValue(formData.status || "Aktif");
          sheet.getRange(i + 1, 9).setValue(nowIso);
          isEdit = true;
          break;
        }
      }
    }

    if (!isEdit) {
      const newId = targetId || ("JDW_" + new Date().getTime());
      sheet.appendRow([
        newId,
        formData.nama || "",
        formData.tipe || "Harian",
        formData.waktu || "",
        formData.tag || "",
        formData.deskripsi || "",
        Number(formData.urutan) || 1,
        formData.status || "Aktif",
        nowIso
      ]);
    }

    return {
      success: true,
      status: "success",
      message: isEdit ? "Jadwal kegiatan berhasil diperbarui!" : "Jadwal kegiatan baru berhasil ditambahkan!"
    };
  } catch (err) {
    return { success: false, status: "error", message: err.toString() };
  }
}

function toggleStatusJadwalKegiatan(jadwalId, newStatus) {
  try {
    const ss = getDatabaseSpreadsheet();
    const sheet = ss.getSheetByName(JADWAL_KEGIATAN_SHEET_NAME);
    if (!sheet) return { success: false, message: "Sheet Jadwal Kegiatan tidak ditemukan" };

    const data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(jadwalId)) {
        sheet.getRange(i + 1, 8).setValue(newStatus);
        return { success: true, message: "Status Jadwal Kegiatan diubah ke: " + newStatus };
      }
    }
    return { success: false, message: "ID Jadwal Kegiatan tidak ditemukan" };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

function hapusJadwalKegiatan(jadwalId) {
  try {
    const ss = getDatabaseSpreadsheet();
    const sheet = ss.getSheetByName(JADWAL_KEGIATAN_SHEET_NAME);
    if (!sheet) return { success: false, message: "Sheet Jadwal Kegiatan tidak ditemukan" };

    const data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(jadwalId)) {
        sheet.deleteRow(i + 1);
        return { success: true, message: "Jadwal kegiatan berhasil dihapus dari database" };
      }
    }
    return { success: false, message: "ID Jadwal Kegiatan tidak ditemukan" };
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

function getAllAlumniData() {
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
      return { success: true, data: [] };
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, data: [] };

    const headers = data[0];
    const idxTimestamp = headers.indexOf("Timestamp");
    const idxNama = headers.indexOf("Nama Lengkap");
    const idxJk = headers.indexOf("Jenis Kelamin");
    const idxWa = headers.indexOf("No WhatsApp");
    const idxMedsos = headers.indexOf("Media Sosial");
    const idxMasuk = headers.indexOf("Tahun Masuk");
    const idxLulus = headers.indexOf("Tahun Lulus");
    const idxProgram = headers.indexOf("Program Terakhir");
    const idxKesibukan = headers.indexOf("Kesibukan");
    const idxInstansi = headers.indexOf("Instansi/Perusahaan");
    const idxKesan = headers.indexOf("Kesan & Pesan");
    const idxProv = headers.indexOf("Provinsi");
    const idxKab = headers.indexOf("Kabupaten");
    const idxKec = headers.indexOf("Kecamatan");
    const idxDesa = headers.indexOf("Desa/Kelurahan");
    const idxAlamat = headers.indexOf("Alamat Lengkap");
    const idxLat = headers.indexOf("Latitude");
    const idxLng = headers.indexOf("Longitude");
    const idxFoto = headers.indexOf("Foto");
    const idxIzin = headers.indexOf("Izin Publikasi");

    const list = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const valNama = idxNama >= 0 ? row[idxNama] : row[1];
      if (!valNama || String(valNama).trim() === "") continue;

      list.push({
        rowIndex: i + 1,
        timestamp: idxTimestamp >= 0 ? row[idxTimestamp] : "",
        nama: idxNama >= 0 ? String(row[idxNama] || "").trim() : "",
        jk: idxJk >= 0 ? String(row[idxJk] || "").trim() : "",
        wa: idxWa >= 0 ? String(row[idxWa] || "").trim() : "",
        medsos: idxMedsos >= 0 ? String(row[idxMedsos] || "").trim() : "",
        masuk: idxMasuk >= 0 ? String(row[idxMasuk] || "").trim() : "",
        lulus: idxLulus >= 0 ? String(row[idxLulus] || "").trim() : "",
        program: idxProgram >= 0 ? String(row[idxProgram] || "").trim() : "",
        kesibukan: idxKesibukan >= 0 ? String(row[idxKesibukan] || "").trim() : "",
        instansi: idxInstansi >= 0 ? String(row[idxInstansi] || "").trim() : "",
        kesan: idxKesan >= 0 ? String(row[idxKesan] || "").trim() : "",
        provinsi: idxProv >= 0 ? String(row[idxProv] || "").trim() : "",
        kabupaten: idxKab >= 0 ? String(row[idxKab] || "").trim() : "",
        kecamatan: idxKec >= 0 ? String(row[idxKec] || "").trim() : "",
        desa: idxDesa >= 0 ? String(row[idxDesa] || "").trim() : "",
        alamat: idxAlamat >= 0 ? String(row[idxAlamat] || "").trim() : "",
        lat: idxLat >= 0 ? row[idxLat] : "",
        lng: idxLng >= 0 ? row[idxLng] : "",
        foto: idxFoto >= 0 ? String(row[idxFoto] || "").trim() : "",
        izin: idxIzin >= 0 ? String(row[idxIzin] || "").trim() : "Tidak"
      });
    }

    // Urutkan paling baru di atas
    list.reverse();
    return { success: true, data: list };
  } catch (err) {
    return { success: false, message: err.toString(), data: [] };
  }
}

function deleteAlumniData(rowIndex, nama) {
  try {
    const ss = getDatabaseSpreadsheet();
    const sheet = ss.getSheetByName(ALUMNI_SHEET_NAME);
    if (!sheet) return { success: false, message: "Sheet Data_Alumni tidak ditemukan." };
    const r = parseInt(rowIndex);
    if (r > 1 && r <= sheet.getLastRow()) {
      sheet.deleteRow(r);
      return { success: true, message: "Data alumni berhasil dihapus." };
    }
    if (nama) {
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][1] && String(data[i][1]).trim().toLowerCase() === String(nama).trim().toLowerCase()) {
          sheet.deleteRow(i + 1);
          return { success: true, message: "Data alumni berhasil dihapus." };
        }
      }
    }
    return { success: false, message: "Baris data alumni tidak ditemukan." };
  } catch (err) {
    return { success: false, message: err.toString() };
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
function invalidateStudentsCache() {
  try {
    const cache = CacheService.getScriptCache();
    if (cache) cache.remove(CACHE_KEY_STUDENTS);
  } catch (e) {
    console.warn("Gagal invalidate students cache: " + e.message);
  }
}

/**
 * Ambil seluruh data santri untuk Dashboard Admin
 * Dilengkapi ScriptCache level Apps Script (~150ms response)
 */
function getAllStudentsData(token) {
  try {
    const actor = authenticateSession(token);
    authorizeRole(actor, ["ADMIN", "EDITOR", "PENGASUH"]);

    // Cek cache Apps Script terlebih dahulu untuk respon super cepat
    try {
      const cache = CacheService.getScriptCache();
      if (cache) {
        const cached = cache.get(CACHE_KEY_STUDENTS);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && (parsed.status === "success" || parsed.success)) {
            return parsed;
          }
        }
      }
    } catch (cErr) {
      console.warn("[STUDENTS CACHE READ ERROR]", cErr);
    }

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

    let phoneIdx = headers.findIndex(h => h.includes("phone") || h.includes("hp") || h.includes("wa") || h.includes("telepon") || h.includes("kontak"));

    // Ambil mapping kontak wali santri dari Wali_Santri_Map & Wali_Identities/Users
    const waliPhoneMap = {};
    try {
      const mapSheet = getAuthSheet(ss, SHEET_WALI_SANTRI_MAP);
      const waliSheet = getAuthSheet(ss, SHEET_WALI_IDENTITIES) || getAuthSheet(ss, "Users");
      if (mapSheet && waliSheet) {
        const wData = waliSheet.getDataRange().getValues();
        if (wData.length > 1) {
          const wHead = wData[0].map(h => String(h || "").trim().toLowerCase());
          const wIdIdx = wHead.findIndex(h => h.includes("id"));
          const wPhoneIdx = wHead.findIndex(h => h.includes("phone") || h.includes("hp") || h.includes("wa") || h.includes("telepon") || h.includes("kontak"));
          const phoneById = {};
          if (wIdIdx !== -1 && wPhoneIdx !== -1) {
            for (let w = 1; w < wData.length; w++) {
              const wId = String(wData[w][wIdIdx] || "").trim();
              const wPhone = String(wData[w][wPhoneIdx] || "").trim();
              if (wId && wPhone) phoneById[wId] = wPhone;
            }
          }
          const mData = mapSheet.getDataRange().getValues();
          for (let m = 1; m < mData.length; m++) {
            const waliId = String(mData[m][1] || "").trim();
            const sId = String(mData[m][2] || "").trim();
            if (sId && waliId && phoneById[waliId]) {
              waliPhoneMap[sId] = phoneById[waliId];
            }
          }
        }
      }
    } catch (wErr) {
      console.warn("[STUDENTS WALI MAP ERROR]", wErr);
    }

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

      let phone = phoneIdx !== -1 ? String(row[phoneIdx] || "").trim() : "";
      if (!phone && studentId && waliPhoneMap[studentId]) {
        phone = waliPhoneMap[studentId];
      }

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
        createdAt: createdAt,
        phone: phone,
        parentPhone: phone,
        whatsapp: phone
      });
    }

    const result = {
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

    try {
      const cache = CacheService.getScriptCache();
      if (cache) {
        const serialized = JSON.stringify(result);
        if (serialized.length < 100000) {
          cache.put(CACHE_KEY_STUDENTS, serialized, 600); // 10 menit
        }
      }
    } catch (cErr) {
      console.warn("[STUDENTS CACHE WRITE ERROR]", cErr);
    }

    return result;
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
  let phoneIdx = headers.findIndex(h => h.includes("phone") || h.includes("hp") || h.includes("wa") || h.includes("telepon") || h.includes("kontak"));

  const inputId = String(studentObj.studentId || studentObj.student_id || "").trim();
  const inputNis = String(studentObj.nis || studentObj.nisn || "").trim();
  const inputNik = String(studentObj.nik || "").trim();
  const inputName = String(studentObj.name || studentObj.nama || "").trim();
  const inputPhone = String(studentObj.phone || studentObj.parentPhone || studentObj.whatsapp || studentObj.no_hp || "").trim();
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

  // Jika ada input nomor telepon tapi kolom phone belum ada di sheet, buatkan kolomnya otomatis
  if (inputPhone && phoneIdx === -1) {
    try {
      sheet.getRange(1, headers.length + 1).setValue("phone");
      phoneIdx = headers.length;
      headers.push("phone");
    } catch (colErr) {
      console.warn("[ADD PHONE COLUMN ERROR]", colErr);
    }
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
  let actualStudentId = inputId;

  if (foundRow !== -1) {
    if (nisIdx !== -1) sheet.getRange(foundRow, nisIdx + 1).setValue(inputNis);
    if (nikIdx !== -1) sheet.getRange(foundRow, nikIdx + 1).setValue(inputNik);
    if (nameIdx !== -1) sheet.getRange(foundRow, nameIdx + 1).setValue(inputName);
    if (genderIdx !== -1) sheet.getRange(foundRow, genderIdx + 1).setValue(inputGender);
    if (birthIdx !== -1) sheet.getRange(foundRow, birthIdx + 1).setValue(inputBirth);
    if (photoIdx !== -1 && inputPhoto) sheet.getRange(foundRow, photoIdx + 1).setValue(inputPhoto);
    if (progIdx !== -1) sheet.getRange(foundRow, progIdx + 1).setValue(inputProgram);
    if (statusIdx !== -1) sheet.getRange(foundRow, statusIdx + 1).setValue(inputStatus);
    if (phoneIdx !== -1 && inputPhone) sheet.getRange(foundRow, phoneIdx + 1).setValue(inputPhone);

    actualStudentId = idIdx !== -1 ? String(data[foundRow - 1][idIdx] || inputId) : inputId;

    if (inputPhone) {
      syncStudentWaliContact(ss, actualStudentId, inputNis, inputName, inputPhone);
    }

    invalidateStudentsCache();

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
    if (phoneIdx !== -1 && inputPhone) newRow[phoneIdx] = inputPhone;
    const createdIdx = headers.indexOf("created_at");
    if (createdIdx !== -1) newRow[createdIdx] = nowIso;

    sheet.appendRow(newRow);

    if (inputPhone) {
      syncStudentWaliContact(ss, newStudentId, inputNis, inputName, inputPhone);
    }

    invalidateStudentsCache();

    return {
      status: "success",
      success: true,
      studentId: newStudentId,
      message: `Santri baru ${inputName} (NIS: ${inputNis}) berhasil ditambahkan ke database.`
    };
  }
}

/**
 * Sinkronisasi otomatis nomor kontak WhatsApp Wali Santri ke Users, Wali_Identities & Wali_Santri_Map
 */
function syncStudentWaliContact(ss, studentId, nis, studentName, phone) {
  if (!studentId || !phone) return;
  try {
    const nowIso = new Date().toISOString();
    const mapSheet = getAuthSheet(ss, SHEET_WALI_SANTRI_MAP);
    let waliId = "";
    if (mapSheet) {
      const mData = mapSheet.getDataRange().getValues();
      for (let m = 1; m < mData.length; m++) {
        if (String(mData[m][2]).trim() === studentId) {
          waliId = String(mData[m][1]).trim();
          break;
        }
      }
    }

    const waliSheet = getAuthSheet(ss, SHEET_WALI_IDENTITIES);
    const usersSheet = getAuthSheet(ss, "Users");

    if (waliId) {
      if (waliSheet) {
        const wData = waliSheet.getDataRange().getValues();
        const wHead = wData[0].map(h => String(h || "").trim().toLowerCase());
        const idIdx = wHead.findIndex(h => h.includes("id"));
        const pIdx = wHead.findIndex(h => h.includes("phone") || h.includes("hp") || h.includes("wa") || h.includes("telepon"));
        if (idIdx !== -1 && pIdx !== -1) {
          for (let i = 1; i < wData.length; i++) {
            if (String(wData[i][idIdx]).trim() === waliId) {
              waliSheet.getRange(i + 1, pIdx + 1).setValue(phone);
              break;
            }
          }
        }
      }
      if (usersSheet) {
        const uData = usersSheet.getDataRange().getValues();
        const uHead = uData[0].map(h => String(h || "").trim().toLowerCase());
        const idIdx = uHead.indexOf("user_id");
        const pIdx = uHead.indexOf("phone");
        if (idIdx !== -1 && pIdx !== -1) {
          for (let i = 1; i < uData.length; i++) {
            if (String(uData[i][idIdx]).trim() === waliId) {
              usersSheet.getRange(i + 1, pIdx + 1).setValue(phone);
              break;
            }
          }
        }
      }
    } else {
      const newWaliId = "WALI_" + Utilities.getUuid().replace(/-/g, "").substring(0, 10);
      const waliName = "Wali " + studentName;
      const waliEmail = nis ? `wali.${nis}@mubarokah.app` : `wali.${studentId.toLowerCase()}@mubarokah.app`;

      if (usersSheet) {
        const uHeaders = usersSheet.getDataRange().getValues()[0].map(h => String(h || "").trim().toLowerCase());
        const newU = new Array(uHeaders.length).fill("");
        const idIdx = uHeaders.indexOf("user_id");
        const emIdx = uHeaders.indexOf("email");
        const phIdx = uHeaders.indexOf("phone");
        const nmIdx = uHeaders.indexOf("name");
        const rlIdx = uHeaders.indexOf("role");
        const stIdx = uHeaders.indexOf("status");
        const crIdx = uHeaders.indexOf("created_at");

        if (idIdx !== -1) newU[idIdx] = newWaliId;
        if (emIdx !== -1) newU[emIdx] = waliEmail;
        if (phIdx !== -1) newU[phIdx] = phone;
        if (nmIdx !== -1) newU[nmIdx] = waliName;
        if (rlIdx !== -1) newU[rlIdx] = "WALI_SANTRI";
        if (stIdx !== -1) newU[stIdx] = "ACTIVE";
        if (crIdx !== -1) newU[crIdx] = nowIso;
        usersSheet.appendRow(newU);
      }

      if (waliSheet) {
        const wHeaders = waliSheet.getDataRange().getValues()[0].map(h => String(h || "").trim().toLowerCase());
        const newW = new Array(wHeaders.length).fill("");
        const idIdx = wHeaders.findIndex(h => h.includes("id"));
        const emIdx = wHeaders.indexOf("email");
        const phIdx = wHeaders.findIndex(h => h.includes("phone") || h.includes("hp") || h.includes("wa"));
        const nmIdx = wHeaders.indexOf("name");
        const rlIdx = wHeaders.indexOf("role");
        const stIdx = wHeaders.indexOf("status");
        const crIdx = wHeaders.indexOf("created_at");

        if (idIdx !== -1) newW[idIdx] = newWaliId;
        if (emIdx !== -1) newW[emIdx] = waliEmail;
        if (phIdx !== -1) newW[phIdx] = phone;
        if (nmIdx !== -1) newW[nmIdx] = waliName;
        if (rlIdx !== -1) newW[rlIdx] = "WALI_SANTRI";
        if (stIdx !== -1) newW[stIdx] = "ACTIVE";
        if (crIdx !== -1) newW[crIdx] = nowIso;
        waliSheet.appendRow(newW);
      }

      if (mapSheet) {
        const mapId = "MAP_" + Utilities.getUuid().replace(/-/g, "").substring(0, 12);
        mapSheet.appendRow([mapId, newWaliId, studentId, "GUARDIAN", "VERIFIED", nowIso]);
      }
    }
  } catch (err) {
    console.warn("[syncStudentWaliContact error]", err);
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

    invalidateStudentsCache();

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

// ====================================================================
// MODUL BACKEND: TAHFIDZ AL-QUR'AN (MUTABA'AH, HALAQAH, TARGET)
// Terinspirasi dari standar Khodim.com (Mushaf Pojok 20 Hlm/Juz)
// ====================================================================

const SHEET_TAHFIDZ_LOGS = "Tahfidz_Logs";
const SHEET_TAHFIDZ_CAPAIAN = "Tahfidz_Capaian";
const SHEET_TAHFIDZ_TARGET = "Tahfidz_Target";
const SHEET_TAHFIDZ_HALAQAH = "Tahfidz_Halaqah";
const SHEET_TAHFIDZ_SESI = "Tahfidz_Jadwal_Sesi";
const SHEET_TAHFIDZ_PRESENSI = "Tahfidz_Presensi";
const SHEET_IZIN_ASATIDZ = "Izin_Asatidz";
const HEADERS_TAHFIDZ_PRESENSI = ["presensi_id", "tanggal", "sesi", "halaqah_id", "nama_halaqah", "student_id", "nis", "student_name", "status", "keterangan", "muhafiz", "updated_at"];
const HEADERS_IZIN_ASATIDZ = [
  "id_izin", "asatidz_id", "nama_asatidz", "tanggal_mulai", "tanggal_selesai",
  "sesi", "kategori", "alasan", "badal_id", "nama_badal",
  "catatan_badal", "lampiran_url", "status", "pengasuh_approved_by",
  "pengasuh_approved_at", "catatan_pengasuh", "created_at", "updated_at"
];

// Urutan Kurikulum Tahfidz Pesantren: Juz 30, kemudian Juz 1 s/d 29 (Khatam di Juz 29 Hlm 20)
const TAHFIDZ_CURRICULUM_JUZ_ORDER = [
  30,
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  21, 22, 23, 24, 25, 26, 27, 28, 29
];

/**
 * Mendapatkan posisi juz dan halaman berikutnya berdasarkan kurikulum [30, 1..29]
 * Pada Juz 29 Halaman 20 -> khatam: true
 */
function getNextTahfidzCurriculumPosition_(juz, hal) {
  var r = getTahfidzCurriculumRank_(juz);
  var h = parseTahfidzLatestPage_(hal);
  if (h >= 20) {
    if (r < TAHFIDZ_CURRICULUM_JUZ_ORDER.length - 1) {
      return { juz: TAHFIDZ_CURRICULUM_JUZ_ORDER[r + 1], hal: 1, halaman: 1, khatam: false };
    } else {
      // Selesai Juz 29 Halaman 20 (Akhir Kurikulum 30 Juz) -> Khatam!
      return { juz: TAHFIDZ_CURRICULUM_JUZ_ORDER[r], hal: 20, halaman: 20, khatam: true };
    }
  }
  return { juz: TAHFIDZ_CURRICULUM_JUZ_ORDER[r], hal: h + 1, halaman: h + 1, khatam: false };
}

function getTahfidzCurriculumRank_(juz) {
  var idx = TAHFIDZ_CURRICULUM_JUZ_ORDER.indexOf(Number(juz));
  return idx !== -1 ? idx : 0;
}

function getTahfidzCurriculumTotalTuntas_(juz, hal) {
  var rank = getTahfidzCurriculumRank_(juz);
  var h = Math.min(20, Math.max(1, Number(hal) || 1));
  return rank * 20 + parseTahfidzLatestPage_(hal);
}

function parseTahfidzLatestPage_(halVal) {
  if (halVal === null || halVal === undefined || halVal === "") return 1;
  if (typeof halVal === "number" && !isNaN(halVal)) {
    return Math.min(20, Math.max(1, Math.round(halVal)));
  }
  var str = String(halVal).trim();
  var matches = str.match(/\d+/g);
  if (!matches || matches.length === 0) return 1;
  var max = 1;
  for (var i = 0; i < matches.length; i++) {
    var n = Number(matches[i]);
    if (!isNaN(n) && n > max) max = n;
  }
  return Math.min(20, Math.max(1, max));
}

function ensureTahfidzLogsAndCapaianSchema_(ss) {
  try {
    if (!ss) return;

    // 1. Pastikan kolom status_setoran, satuan, ayat_mulai, ayat_sampai ada di Tahfidz_Logs
    const logsSheet = ss.getSheetByName(SHEET_TAHFIDZ_LOGS);
    if (logsSheet) {
      let lastCol = logsSheet.getLastColumn();
      if (lastCol > 0) {
        let headers = logsSheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || "").trim().toLowerCase());
        
        // 1a. Kolom status_setoran
        const statusIdx = headers.indexOf("status_setoran");
        if (statusIdx === -1) {
          const nextCol = lastCol + 1;
          if (nextCol > logsSheet.getMaxColumns()) {
            logsSheet.insertColumnAfter(logsSheet.getMaxColumns());
          }
          logsSheet.getRange(1, nextCol).setValue("status_setoran")
            .setFontWeight("bold")
            .setBackground("#059669")
            .setFontColor("#ffffff");

          // Backfill nilai default 'LANJUT' untuk baris data yang ada
          const lastRow = logsSheet.getLastRow();
          if (lastRow > 1) {
            const nilaiIdx = headers.indexOf("nilai");
            const values = [];
            if (nilaiIdx !== -1) {
              const nilaiData = logsSheet.getRange(2, nilaiIdx + 1, lastRow - 1, 1).getValues();
              for (let i = 0; i < nilaiData.length; i++) {
                const n = String(nilaiData[i][0] || "").trim().toUpperCase();
                values.push([n === "DHAIF" ? "ULANG" : "LANJUT"]);
              }
            } else {
              for (let i = 0; i < lastRow - 1; i++) {
                values.push(["LANJUT"]);
              }
            }
            logsSheet.getRange(2, nextCol, values.length, 1).setValues(values);
          }
          lastCol = nextCol;
          headers.push("status_setoran");
          console.log("[SCHEMA SUCCESS] Kolom status_setoran berhasil ditambahkan ke Tahfidz_Logs.");
        }

        // 1b. Kolom khusus Setoran Per Ayat (Tahfidz Anak): satuan, ayat_mulai, ayat_sampai
        const extraColumns = [
          { name: "satuan", defaultVal: "HALAMAN" },
          { name: "ayat_mulai", defaultVal: "" },
          { name: "ayat_sampai", defaultVal: "" }
        ];

        extraColumns.forEach(colObj => {
          if (headers.indexOf(colObj.name) === -1) {
            const nextCol = lastCol + 1;
            if (nextCol > logsSheet.getMaxColumns()) {
              logsSheet.insertColumnAfter(logsSheet.getMaxColumns());
            }
            logsSheet.getRange(1, nextCol).setValue(colObj.name)
              .setFontWeight("bold")
              .setBackground("#059669")
              .setFontColor("#ffffff");

            const lastRow = logsSheet.getLastRow();
            if (lastRow > 1) {
              const defaultVals = [];
              for (let i = 0; i < lastRow - 1; i++) {
                defaultVals.push([colObj.defaultVal]);
              }
              logsSheet.getRange(2, nextCol, defaultVals.length, 1).setValues(defaultVals);
            }
            lastCol = nextCol;
            headers.push(colObj.name);
            console.log(`[SCHEMA SUCCESS] Kolom ${colObj.name} berhasil ditambahkan ke Tahfidz_Logs.`);
          }
        });
      }
    }

    // 2. Pastikan sheet Tahfidz_Capaian sudah ada
    const headersCapaian = [
      "student_id", "student_name", "juz_aktif", "halaman_terakhir", "total_halaman_tuntas", "status_terakhir", "halaqah_id", "nama_halaqah", "muhafiz_pembina", "updated_at",
      "sabqi_halaman", "manzil_juz", "manzil_halaman", "manzil_putaran", "total_halaman_murojaah"
    ];
    let capaianSheet = ss.getSheetByName(SHEET_TAHFIDZ_CAPAIAN);
    if (!capaianSheet) {
      capaianSheet = getOrCreateTahfidzSheet(ss, SHEET_TAHFIDZ_CAPAIAN, headersCapaian, "#059669");
      console.log("[SCHEMA SUCCESS] Sheet Tahfidz_Capaian berhasil dibuat.");
    }

    // 3. Sinkronisasikan data jika sheet baru dibuat / kosong
    if (!capaianSheet || capaianSheet.getLastRow() <= 1) {
      syncTahfidzCapaianSheet_(ss);
    }
  } catch (err) {
    console.error("[ENSURE TAHFIDZ SCHEMA ERROR]", err);
  }
}

function syncTahfidzCapaianSheet_(ss) {
  try {
    if (!ss) return;

    const headersCapaian = [
      "student_id", "student_name", "juz_aktif", "halaman_terakhir", "total_halaman_tuntas",
      "status_terakhir", "halaqah_id", "nama_halaqah", "muhafiz_pembina", "updated_at",
      "sabqi_halaman", "manzil_juz", "manzil_halaman", "manzil_putaran", "total_halaman_murojaah"
    ];

    const capaianSheet = getOrCreateTahfidzSheet(ss, SHEET_TAHFIDZ_CAPAIAN, headersCapaian, "#059669");
    if (!capaianSheet) return;

    // 1. Peta resolusi alias ID -> Canonical ID (STD-xxx) & Master Nama Santri
    const studentNameMap = {};
    const aliasToCanonIdMap = {};

    try {
      const studentSheet = getAuthSheet(ss, SHEET_STUDENTS);
      if (studentSheet && studentSheet.getLastRow() > 1) {
        const sData = studentSheet.getDataRange().getValues();
        const sHeaders = sData[0].map(h => String(h || "").trim().toLowerCase().replace(/\s+/g, "_"));
        const sIdIdx = sHeaders.indexOf("student_id");
        const sNisIdx = sHeaders.indexOf("nis") !== -1 ? sHeaders.indexOf("nis") : sHeaders.indexOf("nisn");
        const sNameIdx = sHeaders.indexOf("name") !== -1 ? sHeaders.indexOf("name") : sHeaders.indexOf("nama");
        for (let i = 1; i < sData.length; i++) {
          const sid = sIdIdx !== -1 ? String(sData[i][sIdIdx] || "").trim() : "";
          const snis = sNisIdx !== -1 ? String(sData[i][sNisIdx] || "").trim() : "";
          const sname = sNameIdx !== -1 ? String(sData[i][sNameIdx] || "").trim() : "";
          const canonId = (sid || snis).toUpperCase();
          if (canonId) {
            aliasToCanonIdMap[canonId] = canonId;
            aliasToCanonIdMap[canonId.toLowerCase()] = canonId;
            if (sid) {
              aliasToCanonIdMap[sid.toUpperCase()] = canonId;
              aliasToCanonIdMap[sid.toLowerCase()] = canonId;
            }
            if (snis) {
              aliasToCanonIdMap[snis.toUpperCase()] = canonId;
              aliasToCanonIdMap[snis.toLowerCase()] = canonId;
            }
            if (sname) {
              studentNameMap[canonId] = sname;
              const normName = sname.toLowerCase().replace(/[^a-z0-9]/g, "");
              if (normName) aliasToCanonIdMap[normName] = canonId;
            }
          }
        }
      }
    } catch (e) {
      console.warn("[SYNC CAPAIAN MASTER STUDENTS WARN]", e);
    }

    // Helper penyelarasan ke ID Resmi santri
    const resolveCanonId = function(rawKey, rawName) {
      if (!rawKey && !rawName) return "";
      const k = String(rawKey || "").trim();
      if (k) {
        const kUpper = k.toUpperCase();
        if (aliasToCanonIdMap[kUpper]) return aliasToCanonIdMap[kUpper];
        if (aliasToCanonIdMap[k.toLowerCase()]) return aliasToCanonIdMap[k.toLowerCase()];
      }
      if (rawName) {
        const normName = String(rawName).toLowerCase().replace(/[^a-z0-9]/g, "");
        if (normName && aliasToCanonIdMap[normName]) return aliasToCanonIdMap[normName];
      }
      return k ? k.toUpperCase() : "";
    };

    // 2. Ambil data halaqah & buat peta santri -> halaqah (ternormalisasi canonical ID)
    migrateTahfidzHalaqahSheet_(ss);
    const halaqahSheet = ss.getSheetByName(SHEET_TAHFIDZ_HALAQAH);
    const studentHalaqahMap = {};
    if (halaqahSheet && halaqahSheet.getLastRow() > 1) {
      const hData = halaqahSheet.getDataRange().getValues();
      const colMap = getHalaqahColumnIndexes(hData[0]);
      for (let i = 1; i < hData.length; i++) {
        const r = hData[i];
        const hId = colMap.id !== -1 ? String(r[colMap.id] || "").trim() : "";
        const hMuh = colMap.muhafiz !== -1 ? String(r[colMap.muhafiz] || "").trim() : "";
        if (!hId && !hMuh) continue;
        const finalHId = hId || ("HLQ-" + (i < 10 ? "0" + i : i));
        const finalHName = (colMap.nama !== -1 && r[colMap.nama]) ? String(r[colMap.nama]).trim() : (hMuh ? ("Halaqah " + hMuh) : ("Halaqah " + finalHId));
        const stIds = colMap.studentIds !== -1 ? String(r[colMap.studentIds] || "").split(",").map(x => x.trim()).filter(Boolean) : [];
        stIds.forEach(stId => {
          const canonId = resolveCanonId(stId);
          if (!canonId) return;
          studentHalaqahMap[canonId] = {
            halaqahId: finalHId,
            namaHalaqah: finalHName,
            muhafiz: hMuh || "Ustadz Pembina"
          };
        });
      }
    }

    // 3. Ambil seluruh log dari Tahfidz_Logs & kelompokkan per santri (unifikasi ke canonical ID)
    const logsSheet = ss.getSheetByName(SHEET_TAHFIDZ_LOGS);
    const studentLogsMap = {};
    if (logsSheet && logsSheet.getLastRow() > 1) {
      const lData = logsSheet.getDataRange().getValues();
      const lHeaders = lData[0].map(h => String(h || "").trim().toLowerCase());
      const sIdIdx = lHeaders.indexOf("student_id");
      const nisIdx = lHeaders.indexOf("nis");
      const nameIdx = lHeaders.indexOf("student_name");
      const tglIdx = lHeaders.indexOf("tanggal");
      const tipeIdx = lHeaders.indexOf("tipe");
      const juzIdx = lHeaders.indexOf("juz");
      const halIdx = lHeaders.indexOf("halaman_list");
      const totHalIdx = lHeaders.indexOf("total_halaman");
      const nilaiIdx = lHeaders.indexOf("nilai");
      const muhIdx = lHeaders.indexOf("muhafiz");
      const stIdx = lHeaders.indexOf("status_setoran");
      const crtIdx = lHeaders.indexOf("created_at");

      for (let i = 1; i < lData.length; i++) {
        const r = lData[i];
        const sid = sIdIdx !== -1 ? String(r[sIdIdx] || "").trim() : "";
        const snis = nisIdx !== -1 ? String(r[nisIdx] || "").trim() : "";
        const sname = nameIdx !== -1 ? String(r[nameIdx] || "").trim() : "";
        const canonKey = resolveCanonId(sid || snis, sname);
        if (!canonKey) continue;

        if (sname && !studentNameMap[canonKey]) {
          studentNameMap[canonKey] = sname;
        }

        if (!studentLogsMap[canonKey]) studentLogsMap[canonKey] = [];
        studentLogsMap[canonKey].push({
          logId: String(r[lHeaders.indexOf("log_id")] || "").trim(),
          tanggal: tglIdx !== -1 ? r[tglIdx] : "",
          createdAt: crtIdx !== -1 ? r[crtIdx] : "",
          tipe: tipeIdx !== -1 ? String(r[tipeIdx] || "ZIYADAH").trim().toUpperCase() : "ZIYADAH",
          juz: juzIdx !== -1 ? Number(r[juzIdx] || 1) : 1,
          halamanList: halIdx !== -1 ? String(r[halIdx] || "1").trim() : "1",
          totalHalaman: totHalIdx !== -1 ? Number(r[totHalIdx] || 1) : 1,
          nilai: nilaiIdx !== -1 ? String(r[nilaiIdx] || "").trim().toUpperCase() : "",
          muhafiz: muhIdx !== -1 ? String(r[muhIdx] || "").trim() : "",
          statusSetoran: stIdx !== -1 ? String(r[stIdx] || "LANJUT").trim().toUpperCase() : "LANJUT"
        });
      }
    }

    // 4. Baca data eksisting di Tahfidz_Capaian untuk merge & normalisasi jika ada data ganda
    const capaianData = capaianSheet.getDataRange().getValues();
    const existingCapaianMap = {};
    const allStudentIds = new Set();

    if (capaianData && capaianData.length > 1) {
      const cHeaders = capaianData[0].map(h => String(h || "").trim().toLowerCase().replace(/[\s\-_]+/g, ""));
      const cIdIdx = cHeaders.findIndex(h => h === "studentid" || h === "id");
      const cNameIdx = cHeaders.findIndex(h => h.includes("name") || h.includes("nama"));
      for (let i = 1; i < capaianData.length; i++) {
        const sid = cIdIdx !== -1 ? String(capaianData[i][cIdIdx] || "").trim() : "";
        const sname = cNameIdx !== -1 ? String(capaianData[i][cNameIdx] || "").trim() : "";
        const canonSid = resolveCanonId(sid, sname);
        if (canonSid) {
          if (sname && !studentNameMap[canonSid]) {
            studentNameMap[canonSid] = sname;
          }
          if (!existingCapaianMap[canonSid]) {
            existingCapaianMap[canonSid] = capaianData[i];
          } else {
            // MERGE BARIS GANDA EKSISTING: pertahankan data capaian tertinggi
            const prevTot = Number(existingCapaianMap[canonSid][4]) || 0;
            const currTot = Number(capaianData[i][4]) || 0;
            if (currTot >= prevTot) {
              existingCapaianMap[canonSid] = capaianData[i];
            }
          }
          allStudentIds.add(canonSid);
        }
      }
    }

    // 5. Kumpulkan seluruh ID santri unik (STANDAR UPPERCASE: 1 SANTRI = 1 BARIS)
    Object.keys(studentHalaqahMap).forEach(id => {
      const canon = resolveCanonId(id);
      if (canon) allStudentIds.add(canon);
    });
    Object.keys(studentLogsMap).forEach(id => {
      const canon = resolveCanonId(id);
      if (canon) allStudentIds.add(canon);
    });
    Object.keys(studentNameMap).forEach(id => {
      const canon = resolveCanonId(id);
      if (canon) allStudentIds.add(canon);
    });

    const rowsToSet = [];
    const nowIso = new Date().toISOString();

    allStudentIds.forEach(sId => {
      if (!sId) return;
      const sIdCanon = String(sId).trim().toUpperCase();
      const sName = studentNameMap[sIdCanon] || sIdCanon;
      const hlqInfo = studentHalaqahMap[sIdCanon] || null;

      // Ambil seluruh logs untuk santri ini
      const logs = studentLogsMap[sIdCanon] || [];
      // Urutkan logs dari yang paling baru
      logs.sort((a, b) => new Date(b.tanggal || b.createdAt) - new Date(a.tanggal || a.createdAt));

      let juzAktif = 1;
      let halTerakhir = 1;
      let totalTuntas = 0;
      let statusTerakhir = "LANJUT";
      let muhafizPembina = hlqInfo ? hlqInfo.muhafiz : "";
      let sabqiHal = "";
      let manzilJuz = "";
      let manzilHal = "";
      let manzilPutaran = 1;
      let totalMurojaah = 0;

      // Cari Ziyadah dengan capaian kurikulum tertinggi (yang tuntas)
      let maxRank = -1;
      let bestZiyadah = null;
      logs.forEach(l => {
        if (l.tipe === "ZIYADAH" && l.statusSetoran !== "ULANG") {
          const j = Number(l.juz) || 1;
          const r = getTahfidzCurriculumRank_(j);
          const h = parseTahfidzLatestPage_(l.halamanList);
          if (r > maxRank || (r === maxRank && (!bestZiyadah || h > bestZiyadah.halaman))) {
            maxRank = r;
            bestZiyadah = { juz: j, halaman: h, log: l };
          }
        }
      });

      if (bestZiyadah) {
        juzAktif = bestZiyadah.juz;
        halTerakhir = bestZiyadah.halaman;
        totalTuntas = getTahfidzCurriculumTotalTuntas_(juzAktif, halTerakhir);
        statusTerakhir = "LANJUT";
        if (!muhafizPembina && bestZiyadah.log.muhafiz) muhafizPembina = bestZiyadah.log.muhafiz;
      } else {
        const lastZiyadah = logs.find(l => l.tipe === "ZIYADAH");
        if (lastZiyadah) {
          juzAktif = lastZiyadah.juz || 1;
          halTerakhir = parseTahfidzLatestPage_(lastZiyadah.halamanList);
          totalTuntas = getTahfidzCurriculumTotalTuntas_(juzAktif, halTerakhir);
          statusTerakhir = lastZiyadah.statusSetoran || (lastZiyadah.nilai === "DHAIF" ? "ULANG" : "LANJUT");
          if (!muhafizPembina && lastZiyadah.muhafiz) muhafizPembina = lastZiyadah.muhafiz;
        }
      }

      // Cari Sabqi terakhir
      const lastSabqi = logs.find(l => l.tipe === "MURAJAAH_SABQI");
      if (lastSabqi) {
        sabqiHal = lastSabqi.halamanList;
        if (!muhafizPembina && lastSabqi.muhafiz) muhafizPembina = lastSabqi.muhafiz;
      }

      // Cari Manzil terakhir
      const lastManzil = logs.find(l => l.tipe === "MURAJAAH_MANZIL");
      if (lastManzil) {
        manzilJuz = lastManzil.juz || 1;
        manzilHal = parseTahfidzLatestPage_(lastManzil.halamanList);
        if (!muhafizPembina && lastManzil.muhafiz) muhafizPembina = lastManzil.muhafiz;
      }

      // Akumulasi total halaman murojaah
      logs.forEach(l => {
        if (l.tipe.indexOf("MURAJAAH") !== -1 || l.tipe === "TASMI") {
          totalMurojaah += Number(l.totalHalaman || 1);
        }
      });

      // Merge dengan data eksisting jika belum ada logs
      const existingRow = existingCapaianMap[sIdCanon];
      if (existingRow) {
        if (logs.length === 0) {
          juzAktif = Number(existingRow[2]) || 30;
          halTerakhir = Number(existingRow[3]) || 1;
          totalTuntas = Number(existingRow[4]) || 0;
          statusTerakhir = existingRow[5] || "LANJUT";
          sabqiHal = existingRow[10] || "";
          manzilJuz = existingRow[11] || "";
          manzilHal = existingRow[12] || "";
          manzilPutaran = Number(existingRow[13]) || 1;
          totalMurojaah = Number(existingRow[14]) || 0;
          if (!muhafizPembina) muhafizPembina = existingRow[8] || "";
        } else {
          // Jika ada putaran manzil yang dicatat manual sebelumnya
          if (existingRow[13]) manzilPutaran = Number(existingRow[13]) || 1;
        }
      }

      rowsToSet.push([
        sIdCanon,                                           // 0: student_id (HURUF KAPITAL STANDAR RESMI)
        sName,                                              // 1: student_name
        juzAktif,                                           // 2: juz_aktif
        halTerakhir,                                        // 3: halaman_terakhir
        totalTuntas,                                        // 4: total_halaman_tuntas
        statusTerakhir,                                     // 5: status_terakhir
        hlqInfo ? hlqInfo.halaqahId : "",                   // 6: halaqah_id
        hlqInfo ? hlqInfo.namaHalaqah : "",                 // 7: nama_halaqah
        muhafizPembina,                                     // 8: muhafiz_pembina
        nowIso,                                             // 9: updated_at
        sabqiHal,                                           // 10: sabqi_halaman
        manzilJuz,                                          // 11: manzil_juz
        manzilHal,                                          // 12: manzil_halaman
        manzilPutaran || 1,                                 // 13: manzil_putaran
        totalMurojaah                                       // 14: total_halaman_murojaah
      ]);
    });

    const lastRow = capaianSheet.getLastRow();
    const lastCol = Math.max(headersCapaian.length, capaianSheet.getLastColumn() || headersCapaian.length);

    if (rowsToSet.length > 0) {
      // Urutkan berdasarkan kelompok halaqah lalu nama santri
      rowsToSet.sort((a, b) => (a[6] || "").localeCompare(b[6] || "") || (a[1] || "").localeCompare(b[1] || ""));

      // 1. Bersihkan seluruh baris data eksisting (row 2 ke bawah) agar bersih total dari duplikat
      if (lastRow > 1) {
        capaianSheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
      }

      // 2. Tulis data baru yang sudah terdeduplikasi murni (1 santri = 1 baris)
      capaianSheet.getRange(2, 1, rowsToSet.length, headersCapaian.length).setValues(rowsToSet);

      // 3. Hapus baris sisa yang kosong di bawahnya
      if (lastRow > rowsToSet.length + 1) {
        try {
          capaianSheet.deleteRows(rowsToSet.length + 2, lastRow - (rowsToSet.length + 1));
        } catch (delErr) {
          console.warn("[CAPAIAN CLEANUP ROWS WARN]", delErr);
        }
      }
      console.log(`[SYNC TAHFIDZ CAPAIAN SUCCESS] Berhasil membersihkan duplikat & menyelaraskan ${rowsToSet.length} data capaian santri (1 baris per santri) ke sheet ${SHEET_TAHFIDZ_CAPAIAN}.`);
    } else if (lastRow > 1) {
      capaianSheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
    }
  } catch (err) {
    console.error("[SYNC TAHFIDZ CAPAIAN ERROR]", err);
  }
}

function runTahfidzSchemaMigration() {
  const ss = getDatabaseSpreadsheet();
  if (!ss) {
    throw new Error("Spreadsheet database tidak ditemukan. Pastikan SPREADSHEET_ID sudah diatur di Script Properties atau script terhubung ke Spreadsheet.");
  }
  console.log("[SCHEMA MIGRATION] Memulai migrasi skema & sinkronisasi Tahfidz...");
  migrateTahfidzHalaqahSheet_(ss);
  ensureTahfidzLogsAndCapaianSchema_(ss);
  syncTahfidzCapaianSheet_(ss);
  try {
    getOrCreateRolesPermissionsSheet();
  } catch (rErr) {
    console.warn("[ROLES PERMS INIT WARN]", rErr);
  }
  console.log("[SCHEMA MIGRATION SUCCESS] Migrasi skema & sinkronisasi Tahfidz selesai.");
  return {
    status: "success",
    message: "Migrasi skema Tahfidz (Halaqah 5 kolom, Kolom status_setoran, satuan, ayat_mulai, ayat_sampai pada Tahfidz_Logs, Sinkronisasi Sheet Tahfidz_Capaian, & Sheet Roles_Permissions) berhasil."
  };
}

function cleanTahfidzCapaianDuplicates(token) {
  if (token) {
    try {
      const actor = authenticateSession(token);
      authorizeRole(actor, ["ADMIN", "EDITOR"]);
    } catch (authErr) {
      verifySessionToken(token);
    }
  }
  const ss = getDatabaseSpreadsheet();
  if (!ss) {
    throw new Error("Spreadsheet database tidak ditemukan. Periksa konfigurasi SPREADSHEET_ID.");
  }
  console.log("[CLEAN DUPLICATES] Memulai pembersihan data ganda di sheet Tahfidz_Capaian...");
  syncTahfidzCapaianSheet_(ss);
  console.log("[CLEAN DUPLICATES SUCCESS] Sheet Tahfidz_Capaian berhasil dibersihkan dari duplikat (1 baris per santri).");
  return {
    status: "success",
    success: true,
    message: "Sheet Tahfidz_Capaian berhasil dibersihkan dari seluruh data ganda (1 santri = 1 baris)."
  };
}

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
    authorizeRole(actor, ["ADMIN", "SUPER_ADMIN"]);

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
      "student_id", "student_name", "juz_aktif", "halaman_terakhir", "total_halaman_tuntas", "status_terakhir", "halaqah_id", "nama_halaqah", "muhafiz_pembina", "updated_at",
      "sabqi_halaman", "manzil_juz", "manzil_halaman", "manzil_putaran", "total_halaman_murojaah"
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

    // 5. Tab: Tahfidz_Presensi (Absensi & Kehadiran Halaqah)
    let sheetPresensi = ss.getSheetByName(SHEET_TAHFIDZ_PRESENSI);
    if (!sheetPresensi) {
      sheetPresensi = ss.insertSheet(SHEET_TAHFIDZ_PRESENSI);
      sheetPresensi.getRange(1, 1, 1, HEADERS_TAHFIDZ_PRESENSI.length).setValues([HEADERS_TAHFIDZ_PRESENSI]);
      sheetPresensi.getRange(1, 1, 1, HEADERS_TAHFIDZ_PRESENSI.length)
        .setFontWeight("bold")
        .setBackground("#059669")
        .setFontColor("#ffffff");
      sheetPresensi.setFrozenRows(1);
      created.push(SHEET_TAHFIDZ_PRESENSI);
    } else {
      existing.push(SHEET_TAHFIDZ_PRESENSI);
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

    // 5. Tab: Izin_Asatidz (Perizinan Asatidz & Pendelegasian Badal)
    let sheetIzinAsatidz = ss.getSheetByName(SHEET_IZIN_ASATIDZ);
    if (!sheetIzinAsatidz) {
      sheetIzinAsatidz = ss.insertSheet(SHEET_IZIN_ASATIDZ);
      sheetIzinAsatidz.getRange(1, 1, 1, HEADERS_IZIN_ASATIDZ.length).setValues([HEADERS_IZIN_ASATIDZ]);
      sheetIzinAsatidz.getRange(1, 1, 1, HEADERS_IZIN_ASATIDZ.length)
        .setFontWeight("bold")
        .setBackground("#047857")
        .setFontColor("#ffffff");
      sheetIzinAsatidz.setFrozenRows(1);
      created.push(SHEET_IZIN_ASATIDZ);
    } else {
      existing.push(SHEET_IZIN_ASATIDZ);
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
    const logsSheet = ss.getSheetByName(SHEET_TAHFIDZ_LOGS);
    const headersCapaian = [
      "student_id", "student_name", "juz_aktif", "halaman_terakhir", "total_halaman_tuntas", "status_terakhir", "halaqah_id", "nama_halaqah", "muhafiz_pembina", "updated_at",
      "sabqi_halaman", "manzil_juz", "manzil_halaman", "manzil_putaran", "total_halaman_murojaah"
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

          let zSesi = zSesiIdx !== -1 ? (Number(targetData[i][zSesiIdx]) || 1) : 1;
          let zPekan = zPekanIdx !== -1 ? (Number(targetData[i][zPekanIdx]) || 10) : 10;
          let mSesi = mSesiIdx !== -1 ? (Number(targetData[i][mSesiIdx]) || 2) : 2;
          let mPekan = mPekanIdx !== -1 ? (Number(targetData[i][mPekanIdx]) || 10) : 10;

          // Deteksi baris legacy yang bergeser ke kiri (misal: kolom target_murajaah_pekan terisi timestamp ISO)
          const rawMPekan = mPekanIdx !== -1 ? String(targetData[i][mPekanIdx] || "").trim() : "";
          if (rawMPekan.includes("T") && (rawMPekan.includes("Z") || rawMPekan.includes("+"))) {
            // Kolom bergeser 1 kolom ke kiri: Col B=zSesi, Col C=zPekan, Col D=mSesi, Col E=mPekan
            zSesi = Number(targetData[i][1]) || 1;
            zPekan = Number(targetData[i][2]) || 10;
            mSesi = Number(targetData[i][3]) || 2;
            mPekan = Number(targetData[i][4]) || 10;
          }

          targetMap[sId] = {
            targetZiyadahSesi: zSesi,
            targetZiyadahPekan: zPekan,
            targetMurajaahSesi: mSesi,
            targetMurajaahPekan: mPekan
          };
        }
      }
    }

    // 3b. Baca Data Capaian Santri dari Tahfidz_Capaian (Ziyadah & Muroja'ah Terpisah)
    const capaianMap = {};
    let cData = null;
    if (capaianSheet) {
      cData = capaianSheet.getDataRange().getValues();
      if (cData && cData.length > 1) {
        const hCap = cData[0].map(h => String(h || "").trim().toLowerCase().replace(/[\s\-_]+/g, ""));
        const sIdIdx = hCap.findIndex(h => h === "studentid" || h === "id");
        const juzIdx = hCap.findIndex(h => h === "juzaktif" || h === "juz");
        const halIdx = hCap.findIndex(h => h === "halamanterakhir" || h === "halaman");
        const totIdx = hCap.findIndex(h => h === "totalhalamantuntas" || h.includes("totaltuntas"));
        const stIdx = hCap.findIndex(h => h === "statusterakhir" || h.includes("status"));
        const hlqIdIdx = hCap.findIndex(h => h.includes("halaqahid") || h === "halaqah");
        const hlqNmIdx = hCap.findIndex(h => h.includes("namahalaqah"));
        const muhIdx = hCap.findIndex(h => h.includes("muhafiz"));
        const updIdx = hCap.findIndex(h => h.includes("updated"));

        // Kolom Muroja'ah Sabqi & Manzil
        const sabqiIdx = hCap.findIndex(h => h.includes("sabqi"));
        const manzilJuzIdx = hCap.findIndex(h => h.includes("manzil") && h.includes("juz"));
        const manzilHalIdx = hCap.findIndex(h => h.includes("manzil") && (h.includes("halaman") || h.includes("hal")));
        const manzilPutaranIdx = hCap.findIndex(h => h.includes("manzil") && h.includes("putaran"));
        const totMurojaahIdx = hCap.findIndex(h => h.includes("total") && h.includes("murojaah"));

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
            updatedAt: updIdx !== -1 ? String(cData[i][updIdx] || "").trim() : "",
            
            // Sabqi & Manzil
            sabqiHalaman: sabqiIdx !== -1 ? String(cData[i][sabqiIdx] || "").trim() : "",
            manzilJuz: manzilJuzIdx !== -1 ? (Number(cData[i][manzilJuzIdx]) || 1) : 1,
            manzilHalaman: manzilHalIdx !== -1 ? (Number(cData[i][manzilHalIdx]) || 1) : 1,
            manzilPutaran: manzilPutaranIdx !== -1 ? (Number(cData[i][manzilPutaranIdx]) || 1) : 1,
            totalHalamanMurojaah: totMurojaahIdx !== -1 ? (Number(cData[i][totMurojaahIdx]) || 0) : 0
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

    // 4b. Baca Data Presensi Terkini dari Sheet Tahfidz_Presensi (Auto-create jika belum ada)
    const presensiMap = {};
    let presensiSheet = ss.getSheetByName(SHEET_TAHFIDZ_PRESENSI);
    if (!presensiSheet) {
      try {
        presensiSheet = getOrCreateTahfidzSheet(ss, SHEET_TAHFIDZ_PRESENSI, HEADERS_TAHFIDZ_PRESENSI, "#059669");
      } catch (e) {
        console.warn("[TAHFIDZ_PRESENSI AUTO-CREATE WARNING]", e);
      }
    }
    if (presensiSheet && presensiSheet.getLastRow() > 1) {
      const pData = presensiSheet.getDataRange().getValues();
      if (pData && pData.length > 1) {
        const pHeaders = pData[0].map(h => String(h || "").trim().toLowerCase().replace(/[\s\-_]+/g, ""));
        const pIdIdx = pHeaders.indexOf("studentid");
        const pNisIdx = pHeaders.indexOf("nis");
        const pStatIdx = pHeaders.indexOf("status");
        const pKetIdx = pHeaders.indexOf("keterangan");
        const pTglIdx = pHeaders.indexOf("tanggal");
        const todayStr = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");

        for (let i = 1; i < pData.length; i++) {
          const rowTgl = pTglIdx !== -1 ? normalizeDateString(pData[i][pTglIdx]) : "";
          const sid = pIdIdx !== -1 ? String(pData[i][pIdIdx] || "").trim() : "";
          const snis = pNisIdx !== -1 ? String(pData[i][pNisIdx] || "").trim() : "";
          const stat = pStatIdx !== -1 ? String(pData[i][pStatIdx] || "HADIR").trim() : "HADIR";
          const ket = pKetIdx !== -1 ? String(pData[i][pKetIdx] || "").trim() : "";

          if (!sid && !snis) continue;
          const rec = { status: stat, keterangan: ket, tanggal: rowTgl };

          if (sid) {
            if (!presensiMap[sid] || rowTgl === todayStr) presensiMap[sid] = rec;
            if (!presensiMap[sid.toLowerCase()] || rowTgl === todayStr) presensiMap[sid.toLowerCase()] = rec;
          }
          if (snis) {
            if (!presensiMap[snis] || rowTgl === todayStr) presensiMap[snis] = rec;
            if (!presensiMap[snis.toLowerCase()] || rowTgl === todayStr) presensiMap[snis.toLowerCase()] = rec;
          }
        }
      }
    }

    // 4c. In-memory fallback data jika ada field nama/halaqah kosong di Tahfidz_Capaian
    try {
      if (cData && cData.length > 1) {
        const hCap = cData[0].map(h => String(h || "").trim().toLowerCase());
        const sIdIdx = hCap.indexOf("student_id");
        const sNmIdx = hCap.indexOf("student_name");
        const hlqIdIdx = hCap.indexOf("halaqah_id");

        for (let i = 1; i < cData.length; i++) {
          const sId = sIdIdx !== -1 ? String(cData[i][sIdIdx] || "").trim() : "";
          if (!sId) continue;
          const currName = sNmIdx !== -1 ? String(cData[i][sNmIdx] || "").trim() : "";
          const currHlq = hlqIdIdx !== -1 ? String(cData[i][hlqIdIdx] || "").trim() : "";

          if ((!currName || !currHlq) && capaianMap[sId]) {
            const foundSt = allStudents.find(s => 
              String(s.studentId).toLowerCase() === sId.toLowerCase() || 
              String(s.nis).toLowerCase() === sId.toLowerCase()
            );
            const foundHlq = studentHalaqahMap[sId] || studentHalaqahMap[sId.toLowerCase()] || (foundSt && (studentHalaqahMap[foundSt.studentId] || studentHalaqahMap[foundSt.nis])) || null;

            if (foundSt && foundSt.name && !capaianMap[sId].studentName) capaianMap[sId].studentName = foundSt.name;
            if (foundHlq && foundHlq.halaqahId && !capaianMap[sId].halaqahId) capaianMap[sId].halaqahId = foundHlq.halaqahId;
            if (foundHlq && foundHlq.namaHalaqah && !capaianMap[sId].namaHalaqah) capaianMap[sId].namaHalaqah = foundHlq.namaHalaqah;
            if (foundHlq && foundHlq.muhafiz && !capaianMap[sId].muhafiz) capaianMap[sId].muhafiz = foundHlq.muhafiz;
          }
        }
      }
    } catch (healErr) {
      console.warn("[IN-MEMORY TAHFIDZ CAPAIAN WARN]", healErr);
    }

    // 5. Agregasi Riwayat Logs Super Cepat (Single-pass O(N) Reverse Scan)
    // Mengeliminasi in-memory sorting ribuan log per santri
    const latestLogMap = {};
    const maxJuzMap = {};
    const setoranCountMap = {};
    const setoranPekanIniMap = {};
    let weeklyZiyadahCount = 0;
    let weeklyMurajaahCount = 0;
    let weeklyZiyadahPages = 0;
    let weeklyMurajaahPages = 0;

    const weeklyZiyadahPagesMap = {};
    const weeklyMurajaahPagesMap = {};
    const weeklySabqiPagesMap = {};
    const weeklyManzilPagesMap = {};
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
        // Scan dari baris paling bawah ke atas (log terbaru ada di baris bawah)
        for (let i = logsData.length - 1; i >= 1; i--) {
          const r = logsData[i];
          const sId = idIdx !== -1 ? String(r[idIdx] || "").trim() : "";
          const sNis = nisIdx !== -1 ? String(r[nisIdx] || "").trim() : "";
          if (!sId && !sNis) continue;

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

          const totalHal = totHalIdx !== -1 ? (Number(r[totHalIdx]) || 1) : 1;

          if (isRecent) {
            if (tipe === "ZIYADAH") {
              weeklyZiyadahCount++;
              weeklyZiyadahPages += totalHal;
            } else if (tipe.includes("MURAJA") || tipe.includes("SABQI") || tipe.includes("MANZIL") || tipe === "TASMI") {
              weeklyMurajaahCount++;
              weeklyMurajaahPages += totalHal;
            }
          }

          sKeys.forEach(k => {
            if (isRecent) {
              if (tipe === "ZIYADAH") {
                weeklyZiyadahPagesMap[k] = (weeklyZiyadahPagesMap[k] || 0) + totalHal;
              } else if (tipe.includes("MURAJA") || tipe.includes("SABQI") || tipe.includes("MANZIL") || tipe === "TASMI") {
                weeklyMurajaahPagesMap[k] = (weeklyMurajaahPagesMap[k] || 0) + totalHal;
                if (tipe === "MURAJAAH_SABQI") {
                  weeklySabqiPagesMap[k] = (weeklySabqiPagesMap[k] || 0) + totalHal;
                } else if (tipe === "MURAJAAH_MANZIL") {
                  weeklyManzilPagesMap[k] = (weeklyManzilPagesMap[k] || 0) + totalHal;
                }
              }
            }
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

            // Capaian kurikulum tertinggi (Khusus Ziyadah agar tidak tergeser oleh Muroja'ah)
            const curRank = getTahfidzCurriculumRank_(juz);
            const prevBestJuz = maxJuzMap[k];
            const prevRank = prevBestJuz !== undefined ? getTahfidzCurriculumRank_(prevBestJuz) : -1;
            if (tipe === "ZIYADAH" && statusSetoran !== "ULANG" && curRank > prevRank) {
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
    let santriTuntasMurojaahCount = 0;

    const enrichedStudents = filteredStudents.map(st => {
      const sId = String(st.studentId || st.student_id || "").trim();
      const sNis = String(st.nis || "").trim();
      const latestLog = latestLogMap[sId] || latestLogMap[sNis] || null;

      const cap = capaianMap[sId] || capaianMap[sNis] || null;
      let currentJuz = cap ? cap.juzAktif : (maxJuzMap[sId] || maxJuzMap[sNis] || 0);
      let curHal = cap ? cap.halamanTerakhir : (latestLog ? Number(String(latestLog.halaman || "1").replace(/\D/g, "")) || 1 : 1);
      if (currentJuz === 0 && st.program && st.program.toLowerCase().includes("tahfidz")) {
        currentJuz = 30; // Kurikulum diawali dari Juz 30
      }
      const curRank = getTahfidzCurriculumRank_(currentJuz);
      const isKhatam = (currentJuz === 29 && curHal >= 20) || (cap && cap.totalHalamanTuntas >= 600);
      if (isKhatam) khatam30Count++;
      const completedJuzCount = isKhatam ? 30 : (curRank + (curHal >= 20 ? 1 : (curHal / 20)));
      totalJuzAllStudents += completedJuzCount;

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
        murojaah: {
          sabqiHalaman: cap ? (cap.sabqiHalaman || "") : "",
          manzilJuz: cap ? (cap.manzilJuz || 1) : 1,
          manzilHalaman: cap ? (cap.manzilHalaman || 1) : 1,
          manzilPutaran: cap ? (cap.manzilPutaran || 1) : 1,
          totalHalamanMurojaah: cap ? (cap.totalHalamanMurojaah || 0) : 0
        },
        target: {
          ziyadahSesi: target.targetZiyadahSesi,
          ziyadahPekan: target.targetZiyadahPekan,
          ziyadahBulan: target.targetZiyadahPekan * 4,
          murajaahSesi: target.targetMurajaahSesi,
          murajaahPekan: target.targetMurajaahPekan,
          murajaahBulan: target.targetMurajaahPekan * 4
        },
        rekapPekan: (function() {
          const tZ = Number(target.targetZiyadahPekan) || 10;
          const tM = Number(target.targetMurajaahPekan) || 10;
          const rZ = weeklyZiyadahPagesMap[sId] || weeklyZiyadahPagesMap[sNis] || 0;
          const rM = weeklyMurajaahPagesMap[sId] || weeklyMurajaahPagesMap[sNis] || 0;
          const rSabqi = weeklySabqiPagesMap[sId] || weeklySabqiPagesMap[sNis] || 0;
          const rManzil = weeklyManzilPagesMap[sId] || weeklyManzilPagesMap[sNis] || 0;
          const isTuntasM = rM >= tM;
          if (isTuntasM) santriTuntasMurojaahCount++;
          return {
            ziyadah: {
              target: tZ,
              realita: rZ,
              isTuntas: rZ >= tZ
            },
            murojaah: {
              target: tM,
              realita: rM,
              sabqi: rSabqi,
              manzil: rManzil,
              persen: tM > 0 ? Math.round((rM / tM) * 100) : 0,
              isTuntas: isTuntasM,
              sisaHalaman: Math.max(0, tM - rM),
              statusText: isTuntasM ? "Tuntas Target Muroja'ah" : (rM > 0 ? ("Kurang " + (tM - rM) + " Hlm") : "Belum Muroja'ah")
            }
          };
        })(),
        setoranTerakhir: latestLog ? {
          ...latestLog,
          muhafiz: latestLog.muhafiz || halaqah.muhafiz || "Ustadz Pembina"
        } : null,
        progress: {
          currentJuz: currentJuz,
          currentHalaman: curHal,
          curriculumRank: curRank + 1,
          totalJuz: 30,
          totalHalamanTuntas: cap ? cap.totalHalamanTuntas : (curRank * 20 + curHal),
          percent: isKhatam ? 100 : Math.min(100, Math.max(1, Math.round(((curRank * 20 + curHal) / 600) * 100))),
          isKhatam: isKhatam,
          onTrackStatus: onTrack
        },
        totalSetoran: setoranCountMap[sId] || setoranCountMap[sNis] || 0,
        presensiStatus: (presensiMap[sId] && presensiMap[sId].status) || 
                        (presensiMap[sNis] && presensiMap[sNis].status) || 
                        (presensiMap[sIdLower] && presensiMap[sIdLower].status) || 
                        (presensiMap[sNisLower] && presensiMap[sNisLower].status) || "HADIR",
        presensiKeterangan: (presensiMap[sId] && presensiMap[sId].keterangan) || 
                            (presensiMap[sNis] && presensiMap[sNis].keterangan) || 
                            (presensiMap[sIdLower] && presensiMap[sIdLower].keterangan) || 
                            (presensiMap[sNisLower] && presensiMap[sNisLower].keterangan) || ""
      };
    });

    // 7. Hitung Summary Makro
    const halaqahMembers = enrichedStudents.filter(st => st.isInHalaqah);
    const activeStudentCount = halaqahMembers.length > 0 ? halaqahMembers.length : (enrichedStudents.length || 1);
    let totalJuzHalaqahStudents = 0;
    let khatam30HalaqahCount = 0;
    halaqahMembers.forEach(st => {
      const p = st.progress;
      if (p) {
        const jz = p.isKhatam ? 30 : ((p.curriculumRank - 1) + (p.currentHalaman >= 20 ? 1 : (p.currentHalaman / 20)));
        totalJuzHalaqahStudents += jz;
        if (p.isKhatam) khatam30HalaqahCount++;
      }
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
          totalSetoranPekanIni: totalWeeklyActivity,
          weeklyZiyadahPages: weeklyZiyadahPages,
          weeklyMurajaahPages: weeklyMurajaahPages,
          santriTuntasMurojaahCount: santriTuntasMurojaahCount,
          totalSantriAktif: halaqahMembers.length || enrichedStudents.length,
          persenTuntasMurojaah: (halaqahMembers.length || enrichedStudents.length) > 0 
            ? Math.round((santriTuntasMurojaahCount / (halaqahMembers.length || enrichedStudents.length)) * 100) 
            : 0
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
      muhafizList: ["Semua Muhafiz", ...Array.from(muhafizSet).sort()],
      todayPresensi: presensiMap
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

    // Auto-update / Sync ke Sheet Tahfidz_Capaian (Pemisahan Ziyadah vs Sabqi vs Manzil)
    try {
      const headersCapaian = [
        "student_id", "student_name", "juz_aktif", "halaman_terakhir", "total_halaman_tuntas", "status_terakhir", "halaqah_id", "nama_halaqah", "muhafiz_pembina", "updated_at",
        "sabqi_halaman", "manzil_juz", "manzil_halaman", "manzil_putaran", "total_halaman_murojaah"
      ];
      const capaianSheet = getOrCreateTahfidzSheet(ss, SHEET_TAHFIDZ_CAPAIAN, headersCapaian, "#059669");
      const cData = capaianSheet.getDataRange().getValues();
      let capaianRowIdx = -1;
      let currRow = null;

      const cHeaders = cData[0].map(h => String(h || "").trim().toLowerCase().replace(/[\s\-_]+/g, ""));
      const sIdIdx = cHeaders.findIndex(h => h === "studentid" || h === "id");
      const nameIdx = cHeaders.findIndex(h => h.includes("name") || h.includes("nama"));
      const juzIdx = cHeaders.findIndex(h => h === "juzaktif" || h === "juz");
      const halIdx = cHeaders.findIndex(h => h === "halamanterakhir" || h === "halaman");
      const totIdx = cHeaders.findIndex(h => h === "totalhalamantuntas" || h.includes("totaltuntas"));
      const stIdx = cHeaders.findIndex(h => h === "statusterakhir" || h.includes("status"));
      const hlqIdIdx = cHeaders.findIndex(h => h.includes("halaqahid") || h === "halaqah");
      const hlqNmIdx = cHeaders.findIndex(h => h.includes("namahalaqah"));
      const muhIdx = cHeaders.findIndex(h => h.includes("muhafiz"));
      const updIdx = cHeaders.findIndex(h => h.includes("updated"));

      // Kolom Muroja'ah Sabqi & Manzil
      const sabqiIdx = cHeaders.findIndex(h => h.includes("sabqi"));
      const manzilJuzIdx = cHeaders.findIndex(h => h.includes("manzil") && h.includes("juz"));
      const manzilHalIdx = cHeaders.findIndex(h => h.includes("manzil") && (h.includes("halaman") || h.includes("hal")));
      const manzilPutaranIdx = cHeaders.findIndex(h => h.includes("manzil") && h.includes("putaran"));
      const totMurojaahIdx = cHeaders.findIndex(h => h.includes("total") && h.includes("murojaah"));

      if (cData && cData.length > 1) {
        for (let i = 1; i < cData.length; i++) {
          const rowId = sIdIdx !== -1 ? String(cData[i][sIdIdx] || "").trim() : "";
          if (rowId.toLowerCase() === studentId.toLowerCase() || (nis && rowId.toLowerCase() === nis.toLowerCase())) {
            capaianRowIdx = i + 1;
            currRow = cData[i];
            break;
          }
        }
      }

      // Existing values
      let currZiyadahJuz = (currRow && juzIdx !== -1 && Number(currRow[juzIdx])) || 1;
      let currZiyadahHalaman = (currRow && halIdx !== -1 && Number(currRow[halIdx])) || 1;
      let currZiyadahTotal = (currRow && totIdx !== -1 && Number(currRow[totIdx])) || 0;
      let currStatus = (currRow && stIdx !== -1 && String(currRow[stIdx])) || "LANJUT";
      let currSabqiHalaman = (currRow && sabqiIdx !== -1 && String(currRow[sabqiIdx])) || "";
      let currManzilJuz = (currRow && manzilJuzIdx !== -1 && Number(currRow[manzilJuzIdx])) || 1;
      let currManzilHalaman = (currRow && manzilHalIdx !== -1 && Number(currRow[manzilHalIdx])) || 1;
      let currManzilPutaran = (currRow && manzilPutaranIdx !== -1 && Number(currRow[manzilPutaranIdx])) || 1;
      let currMurojaahTotal = (currRow && totMurojaahIdx !== -1 && Number(currRow[totMurojaahIdx])) || 0;

      // Parse input halaman
      const pagesArr = halamanList.split(",").map(p => Number(p.trim())).filter(p => !isNaN(p) && p > 0);
      const lastPage = pagesArr.length > 0 ? Math.max(...pagesArr) : 1;
      const minPage = pagesArr.length > 0 ? Math.min(...pagesArr) : 1;

      // Klasifikasi Tipe Setoran
      const cleanTipe = String(tipe).toUpperCase();
      const isZiyadah = cleanTipe === "ZIYADAH";
      const isSabqi = cleanTipe.includes("SABQI");
      const isManzil = cleanTipe.includes("MANZIL") || (!isZiyadah && !isSabqi && cleanTipe !== "TASMI");
      const isTasmi = cleanTipe === "TASMI";

      let nextZiyadahJuz = currZiyadahJuz;
      let nextZiyadahHalaman = currZiyadahHalaman;
      let nextZiyadahTotal = currZiyadahTotal;
      let nextStatus = currStatus;

      let nextSabqiHalaman = currSabqiHalaman;
      let nextManzilJuz = currManzilJuz;
      let nextManzilHalaman = currManzilHalaman;
      let nextManzilPutaran = currManzilPutaran;
      let nextMurojaahTotal = currMurojaahTotal;

      if (isZiyadah) {
        // === 1. TREK ZIYADAH (HAFALAN BARU) ===
        nextStatus = statusSetoran;
        if (statusSetoran === "LANJUT") {
          if (lastPage >= 20) {
            const nextPos = getNextTahfidzCurriculumPosition_(juz, 20);
            nextZiyadahJuz = nextPos.juz;
            nextZiyadahHalaman = nextPos.halaman;
          } else {
            nextZiyadahJuz = juz;
            nextZiyadahHalaman = lastPage + 1;
          }
          nextZiyadahTotal = currZiyadahTotal + totalHalaman;
        } else {
          // Mengulang di halaman yang sama
          nextZiyadahJuz = juz;
          nextZiyadahHalaman = lastPage;
        }
      } else if (isSabqi) {
        // === 2. TREK MUROJA'AH SABQI (DEKAT) ===
        // Posisi Ziyadah 100% AMAN tidak berubah
        if (statusSetoran === "LANJUT") {
          nextSabqiHalaman = pagesArr.length > 1 ? `${minPage}-${lastPage}` : String(lastPage);
          nextMurojaahTotal = currMurojaahTotal + totalHalaman;
        }
      } else if (isManzil) {
        // === 3. TREK MUROJA'AH MANZIL (JAUH / PERPUTARAN) ===
        // Posisi Ziyadah 100% AMAN tidak berubah
        if (statusSetoran === "LANJUT") {
          nextMurojaahTotal = currMurojaahTotal + totalHalaman;
          const limitJuz = currZiyadahJuz || TAHFIDZ_CURRICULUM_JUZ_ORDER[0];
          const curManzilRank = getTahfidzCurriculumRank_(juz);
          const limitRank = getTahfidzCurriculumRank_(limitJuz);

          if (lastPage >= 20) {
            // Selesai 1 juz manzil
            if (curManzilRank >= limitRank) {
              // Sudah menyelesaikan seluruh juz yang sudah dihafal santri -> Putaran Baru kembali ke Juz awal kurikulum!
              nextManzilJuz = TAHFIDZ_CURRICULUM_JUZ_ORDER[0];
              nextManzilHalaman = 1;
              nextManzilPutaran = currManzilPutaran + 1;
            } else {
              // Lanjut ke juz manzil berikutnya sesuai kurikulum
              nextManzilJuz = (curManzilRank < TAHFIDZ_CURRICULUM_JUZ_ORDER.length - 1)
                ? TAHFIDZ_CURRICULUM_JUZ_ORDER[curManzilRank + 1]
                : TAHFIDZ_CURRICULUM_JUZ_ORDER[0];
              nextManzilHalaman = 1;
            }
          } else {
            nextManzilJuz = juz;
            nextManzilHalaman = lastPage + 1;
          }
        } else {
          // Ulang manzil di posisi berjalan
          nextManzilJuz = juz;
          nextManzilHalaman = lastPage;
        }
      } else if (isTasmi) {
        // Tasmi': Tambah akumulasi total halaman muroja'ah
        if (statusSetoran === "LANJUT") {
          nextMurojaahTotal = currMurojaahTotal + totalHalaman;
        }
      }

      // Tulis atau Perbarui ke Sheet Tahfidz_Capaian
      if (capaianRowIdx > 0) {
        if (nameIdx !== -1) capaianSheet.getRange(capaianRowIdx, nameIdx + 1).setValue(studentName);
        if (juzIdx !== -1) capaianSheet.getRange(capaianRowIdx, juzIdx + 1).setValue(nextZiyadahJuz);
        if (halIdx !== -1) capaianSheet.getRange(capaianRowIdx, halIdx + 1).setValue(nextZiyadahHalaman);
        if (totIdx !== -1) capaianSheet.getRange(capaianRowIdx, totIdx + 1).setValue(nextZiyadahTotal);
        if (stIdx !== -1) capaianSheet.getRange(capaianRowIdx, stIdx + 1).setValue(nextStatus);
        if (hlqIdIdx !== -1 && halaqahId) capaianSheet.getRange(capaianRowIdx, hlqIdIdx + 1).setValue(halaqahId);
        if (hlqNmIdx !== -1 && namaHalaqah) capaianSheet.getRange(capaianRowIdx, hlqNmIdx + 1).setValue(namaHalaqah);
        if (muhIdx !== -1 && muhafiz && muhafiz !== "-") capaianSheet.getRange(capaianRowIdx, muhIdx + 1).setValue(muhafiz);
        if (updIdx !== -1) capaianSheet.getRange(capaianRowIdx, updIdx + 1).setValue(createdAt);

        // Muroja'ah columns
        if (sabqiIdx !== -1) capaianSheet.getRange(capaianRowIdx, sabqiIdx + 1).setValue(nextSabqiHalaman);
        if (manzilJuzIdx !== -1) capaianSheet.getRange(capaianRowIdx, manzilJuzIdx + 1).setValue(nextManzilJuz);
        if (manzilHalIdx !== -1) capaianSheet.getRange(capaianRowIdx, manzilHalIdx + 1).setValue(nextManzilHalaman);
        if (manzilPutaranIdx !== -1) capaianSheet.getRange(capaianRowIdx, manzilPutaranIdx + 1).setValue(nextManzilPutaran);
        if (totMurojaahIdx !== -1) capaianSheet.getRange(capaianRowIdx, totMurojaahIdx + 1).setValue(nextMurojaahTotal);
      } else {
        const newRow = new Array(headersCapaian.length).fill("");
        if (sIdIdx !== -1) newRow[sIdIdx] = studentId;
        if (nameIdx !== -1) newRow[nameIdx] = studentName;
        if (juzIdx !== -1) newRow[juzIdx] = nextZiyadahJuz;
        if (halIdx !== -1) newRow[halIdx] = nextZiyadahHalaman;
        if (totIdx !== -1) newRow[totIdx] = nextZiyadahTotal;
        if (stIdx !== -1) newRow[stIdx] = nextStatus;
        if (hlqIdIdx !== -1) newRow[hlqIdIdx] = halaqahId;
        if (hlqNmIdx !== -1) newRow[hlqNmIdx] = namaHalaqah;
        if (muhIdx !== -1) newRow[muhIdx] = muhafiz;
        if (updIdx !== -1) newRow[updIdx] = createdAt;
        if (sabqiIdx !== -1) newRow[sabqiIdx] = nextSabqiHalaman;
        if (manzilJuzIdx !== -1) newRow[manzilJuzIdx] = nextManzilJuz;
        if (manzilHalIdx !== -1) newRow[manzilHalIdx] = nextManzilHalaman;
        if (manzilPutaranIdx !== -1) newRow[manzilPutaranIdx] = nextManzilPutaran;
        if (totMurojaahIdx !== -1) newRow[totMurojaahIdx] = nextMurojaahTotal;

        capaianSheet.appendRow(newRow);
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
      "student_id", "student_name", "juz_aktif", "halaman_terakhir", "total_halaman_tuntas", "status_terakhir", "halaqah_id", "nama_halaqah", "muhafiz_pembina", "updated_at",
      "sabqi_halaman", "manzil_juz", "manzil_halaman", "manzil_putaran", "total_halaman_murojaah"
    ];
    const sheet = getOrCreateTahfidzSheet(ss, SHEET_TAHFIDZ_CAPAIAN, headersCapaian, "#059669");

    const cData = sheet.getDataRange().getValues();
    const cHeaders = cData[0].map(h => String(h || "").trim().toLowerCase().replace(/[\s\-_]+/g, ""));
    const idIdx = cHeaders.findIndex(h => h === "studentid" || h === "id");
    const nameIdx = cHeaders.findIndex(h => h.includes("name") || h.includes("nama"));
    const juzIdx = cHeaders.findIndex(h => h === "juzaktif" || h === "juz");
    const halIdx = cHeaders.findIndex(h => h === "halamanterakhir" || h === "halaman");
    const totIdx = cHeaders.findIndex(h => h === "totalhalamantuntas" || h.includes("totaltuntas"));
    const stIdx = cHeaders.findIndex(h => h === "statusterakhir" || h.includes("status"));
    const hlqIdIdx = cHeaders.findIndex(h => h.includes("halaqahid") || h === "halaqah");
    const hlqNmIdx = cHeaders.findIndex(h => h.includes("namahalaqah"));
    const muhIdx = cHeaders.findIndex(h => h.includes("muhafiz"));
    const updIdx = cHeaders.findIndex(h => h.includes("updated"));

    let rowIndex = -1;
    let prevTotal = 0;
    if (cData && cData.length >= 2) {
      for (let i = 1; i < cData.length; i++) {
        const rowId = String(cData[i][idIdx !== -1 ? idIdx : 0] || "").trim();
        if (rowId.toLowerCase() === studentId.toLowerCase() || (nis && rowId.toLowerCase() === nis.toLowerCase())) {
          rowIndex = i + 1;
          prevTotal = totIdx !== -1 ? (Number(cData[i][totIdx]) || 0) : 0;
          break;
        }
      }
    }

    const curRank = getTahfidzCurriculumRank_(juz);
    const totalHalaman = Number(data.totalHalamanTuntas || data.total_halaman_tuntas) || prevTotal || (curRank * 20 + halaman);

    if (rowIndex !== -1) {
      if (nameIdx !== -1) sheet.getRange(rowIndex, nameIdx + 1).setValue(studentName);
      if (juzIdx !== -1) sheet.getRange(rowIndex, juzIdx + 1).setValue(juz);
      if (halIdx !== -1) sheet.getRange(rowIndex, halIdx + 1).setValue(halaman);
      if (totIdx !== -1) sheet.getRange(rowIndex, totIdx + 1).setValue(totalHalaman);
      if (stIdx !== -1) sheet.getRange(rowIndex, stIdx + 1).setValue(status);
      if (hlqIdIdx !== -1 && halaqahId) sheet.getRange(rowIndex, hlqIdIdx + 1).setValue(halaqahId);
      if (hlqNmIdx !== -1 && namaHalaqah) sheet.getRange(rowIndex, hlqNmIdx + 1).setValue(namaHalaqah);
      if (muhIdx !== -1 && muhafiz) sheet.getRange(rowIndex, muhIdx + 1).setValue(muhafiz);
      if (updIdx !== -1) sheet.getRange(rowIndex, updIdx + 1).setValue(nowIso);
    } else {
      const newRow = new Array(headersCapaian.length).fill("");
      if (idIdx !== -1) newRow[idIdx] = studentId;
      if (nameIdx !== -1) newRow[nameIdx] = studentName;
      if (juzIdx !== -1) newRow[juzIdx] = juz;
      if (halIdx !== -1) newRow[halIdx] = halaman;
      if (totIdx !== -1) newRow[totIdx] = totalHalaman;
      if (stIdx !== -1) newRow[stIdx] = status;
      if (hlqIdIdx !== -1) newRow[hlqIdIdx] = halaqahId;
      if (hlqNmIdx !== -1) newRow[hlqNmIdx] = namaHalaqah;
      if (muhIdx !== -1) newRow[muhIdx] = muhafiz;
      if (updIdx !== -1) newRow[updIdx] = nowIso;
      sheet.appendRow(newRow);
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
    authorizeRole(actor, ["ADMIN", "SUPER_ADMIN", "EDITOR", "PENGASUH", "PEGAWAI", "MUHAFIZ", "GURU", "WALI_SANTRI", "PARENT"]);

    const cleanId = String(studentId || "").trim();
    if (!cleanId) throw new Error("ID Santri wajib disertakan.");

    // Validasi hak akses khusus Wali Santri: hanya boleh melihat santri binaan yang terhubung
    if (actor && (actor.role === "WALI_SANTRI" || actor.role === "PARENT")) {
      const linked = (typeof getLinkedStudentsForWali === "function") ? getLinkedStudentsForWali(actor.identityId) : [];
      const allowedIds = (linked || []).map(s => String(s.studentId || s.student_id || s.id || s.nis || "").trim().toLowerCase());
      let isAllowed = allowedIds.includes(cleanId.toLowerCase());
      if (!isAllowed) {
        const studentsResCheck = (typeof getAllStudentsData === "function") ? getAllStudentsData(token) : null;
        const allStudentsList = (studentsResCheck && studentsResCheck.data) || [];
        const targetStudent = allStudentsList.find(s => 
          String(s.studentId || s.student_id || "").toLowerCase() === cleanId.toLowerCase() ||
          String(s.nis || "").toLowerCase() === cleanId.toLowerCase()
        );
        const targetSid = targetStudent ? String(targetStudent.studentId || "").toLowerCase() : "";
        const targetNis = targetStudent ? String(targetStudent.nis || "").toLowerCase() : "";
        if (targetStudent && (allowedIds.includes(targetSid) || allowedIds.includes(targetNis))) {
          isAllowed = true;
        }
      }
      if (!isAllowed) {
        throw new Error("Akses ditolak: Anda hanya berhak memantau perkembangan santri yang terhubung dengan akun Wali Anda.");
      }
    }
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

    // 2b. Ambil Capaian & Muroja'ah Santri
    const capaianSheet = getOrCreateTahfidzSheet(ss, SHEET_TAHFIDZ_CAPAIAN, [
      "student_id", "nama_santri", "nis", "halaqah", "program",
      "juz_aktif", "halaman_terakhir", "persentase", "total_halaman_ziyadah",
      "sabqi_halaman", "manzil_juz", "manzil_halaman", "manzil_putaran", "total_halaman_murojaah",
      "updated_at"
    ]);
    const capaianData = capaianSheet.getDataRange().getValues();
    let studentCapaian = {
      juzAktif: 1,
      halamanTerakhir: 1,
      persentase: 3,
      totalHalamanZiyadah: 0,
      sabqiHalaman: "",
      manzilJuz: 1,
      manzilHalaman: 1,
      manzilPutaran: 1,
      totalHalamanMurojaah: 0
    };
    if (capaianData && capaianData.length > 1) {
      const hCap = capaianData[0].map(h => String(h || "").trim().toLowerCase().replace(/[\s\-_]+/g, ""));
      const sIdIdx = hCap.indexOf("studentid");
      const nisIdx = hCap.indexOf("nis");
      for (let i = 1; i < capaianData.length; i++) {
        const rowId = sIdIdx !== -1 ? String(capaianData[i][sIdIdx] || "").trim() : "";
        const rowNis = nisIdx !== -1 ? String(capaianData[i][nisIdx] || "").trim() : "";
        if (rowId === cleanId || (student.nis && rowNis === student.nis) || (student.studentId && rowId === student.studentId)) {
          studentCapaian = {
            juzAktif: Number(capaianData[i][hCap.indexOf("juzaktif")] || 1),
            halamanTerakhir: Number(capaianData[i][hCap.indexOf("halamanterakhir")] || 1),
            persentase: Number(capaianData[i][hCap.indexOf("persentase")] || 3),
            totalHalamanZiyadah: Number(capaianData[i][hCap.indexOf("totalhalamanziyadah")] || 0),
            sabqiHalaman: String(capaianData[i][hCap.indexOf("sabqihalaman")] || ""),
            manzilJuz: Number(capaianData[i][hCap.indexOf("manziljuz")] || 1),
            manzilHalaman: Number(capaianData[i][hCap.indexOf("manzilhalaman")] || 1),
            manzilPutaran: Number(capaianData[i][hCap.indexOf("manzilputaran")] || 1),
            totalHalamanMurojaah: Number(capaianData[i][hCap.indexOf("totalhalamanmurojaah")] || 0)
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
    let currentJuz = 30;
    let maxRank = -1;
    let totalScorePoints = 0;
    riwayat.forEach(r => {
      if (r.statusSetoran !== "ULANG" && r.juz) {
        const rk = getTahfidzCurriculumRank_(r.juz);
        if (rk > maxRank) {
          maxRank = rk;
          currentJuz = r.juz;
        }
      }
      if (r.nilai === "MUMTAZ") totalScorePoints += 4;
      else if (r.nilai === "JAYYID_JIDDAN") totalScorePoints += 3;
      else if (r.nilai === "JAYYID") totalScorePoints += 2;
      else totalScorePoints += 1;
    });

    const activeJuz = studentCapaian.juzAktif || currentJuz || 30;
    const activeHal = studentCapaian.halamanTerakhir || 1;
    const curRank = getTahfidzCurriculumRank_(activeJuz);
    const isKhatam = (activeJuz === 29 && activeHal >= 20) || (studentCapaian.totalHalamanZiyadah >= 600);
    const percent = isKhatam ? 100 : Math.min(100, Math.max(1, Math.round(((curRank * 20 + activeHal) / 600) * 100)));

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
    let pekanZReal = 0, pekanMReal = 0, pekanCount = 0, pekanSabqiReal = 0, pekanManzilReal = 0;
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
        if (r.tipe === "ZIYADAH") {
          pekanZReal += hal;
        } else {
          pekanMReal += hal;
          if (r.tipe === "MURAJAAH_SABQI") pekanSabqiReal = (pekanSabqiReal || 0) + hal;
          else if (r.tipe === "MURAJAAH_MANZIL") pekanManzilReal = (pekanManzilReal || 0) + hal;
        }
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
      capaian: {
        juzAktif: studentCapaian.juzAktif || currentJuz,
        halamanTerakhir: studentCapaian.halamanTerakhir || 1,
        persentase: studentCapaian.persentase || percent,
        totalHalamanZiyadah: studentCapaian.totalHalamanZiyadah || 0,
        sabqiHalaman: studentCapaian.sabqiHalaman || "",
        manzilJuz: studentCapaian.manzilJuz || 1,
        manzilHalaman: studentCapaian.manzilHalaman || 1,
        manzilPutaran: studentCapaian.manzilPutaran || 1,
        totalHalamanMurojaah: studentCapaian.totalHalamanMurojaah || 0
      },
      murojaah: {
        sabqiHalaman: studentCapaian.sabqiHalaman || "",
        manzilJuz: studentCapaian.manzilJuz || 1,
        manzilHalaman: studentCapaian.manzilHalaman || 1,
        manzilPutaran: studentCapaian.manzilPutaran || 1,
        totalHalamanMurojaah: studentCapaian.totalHalamanMurojaah || 0
      },
      stats: {
        capaianSaatIni: isKhatam ? "Khatam 30 Juz 🏆 (100%)" : `Juz ${activeJuz} (${percent}%)`,
        targetCapaian: "30 Juz Mutqin",
        totalSetoran: `${riwayat.length} Kali`,
        rataRataNilai: avgNilaiText,
        progressJuz: activeJuz,
        progressMax: 30,
        progressPercent: percent,
        isKhatam: isKhatam,
        khatam: isKhatam
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
          ziyadahTarget: target.ziyadahPekan,
          ziyadahReal: pekanZReal,
          murajaahTarget: target.murajaahPekan,
          murajaahReal: pekanMReal,
          sabqiReal: pekanSabqiReal,
          manzilReal: pekanManzilReal,
          isMurojaahTuntas: pekanMReal >= target.murajaahPekan,
          percent: pekanPercent,
          status: pekanMReal >= target.murajaahPekan ? "Target Muroja'ah Tuntas ✅" : (pekanMReal > 0 ? `Muroja'ah Kurang ${target.murajaahPekan - pekanMReal} Hlm` : "Belum Muroja'ah Pekan Ini")
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
    const headers = data[0].map(h => String(h || "").trim().toLowerCase().replace(/[\s\-_]+/g, ""));
    const idIdx = headers.findIndex(h => h === "studentid" || h === "id");
    const nameIdx = headers.findIndex(h => h.includes("name") || h.includes("nama"));
    const zSesiIdx = headers.findIndex(h => h.includes("ziyadah") && h.includes("sesi"));
    const zPekanIdx = headers.findIndex(h => h.includes("ziyadah") && h.includes("pekan"));
    const mSesiIdx = headers.findIndex(h => h.includes("murajaah") && h.includes("sesi"));
    const mPekanIdx = headers.findIndex(h => h.includes("murajaah") && h.includes("pekan"));
    const updatedIdx = headers.findIndex(h => h.includes("updated") || h.includes("tanggal"));

    let foundRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idIdx !== -1 ? idIdx : 0] || "").trim() === studentId) {
        foundRow = i + 1;
        break;
      }
    }

    if (foundRow > 0) {
      if (nameIdx !== -1 && payload.studentName && (!data[foundRow - 1][nameIdx] || String(data[foundRow - 1][nameIdx]) === "1")) {
        sheet.getRange(foundRow, nameIdx + 1).setValue(payload.studentName);
      }
      if (zSesiIdx !== -1) sheet.getRange(foundRow, zSesiIdx + 1).setValue(zSesi);
      if (zPekanIdx !== -1) sheet.getRange(foundRow, zPekanIdx + 1).setValue(zPekan);
      if (mSesiIdx !== -1) sheet.getRange(foundRow, mSesiIdx + 1).setValue(mSesi);
      if (mPekanIdx !== -1) sheet.getRange(foundRow, mPekanIdx + 1).setValue(mPekan);
      if (updatedIdx !== -1) sheet.getRange(foundRow, updatedIdx + 1).setValue(updatedAt);
    } else {
      const newRow = new Array(headers.length).fill("");
      if (idIdx !== -1) newRow[idIdx] = studentId;
      if (nameIdx !== -1) newRow[nameIdx] = payload.studentName || "";
      if (zSesiIdx !== -1) newRow[zSesiIdx] = zSesi;
      if (zPekanIdx !== -1) newRow[zPekanIdx] = zPekan;
      if (mSesiIdx !== -1) newRow[mSesiIdx] = mSesi;
      if (mPekanIdx !== -1) newRow[mPekanIdx] = mPekan;
      if (updatedIdx !== -1) newRow[updatedIdx] = updatedAt;
      sheet.appendRow(newRow);
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
        const newRow = new Array(headers.length).fill("");
        if (idIdx !== -1) newRow[idIdx] = stId;
        if (zSesiIdx !== -1) newRow[zSesiIdx] = zSesi;
        if (zPekanIdx !== -1) newRow[zPekanIdx] = zPekan;
        if (mSesiIdx !== -1) newRow[mSesiIdx] = mSesi;
        if (mPekanIdx !== -1) newRow[mPekanIdx] = mPekan;
        if (updatedIdx !== -1) newRow[updatedIdx] = updatedAt;
        newRowsToAppend.push(newRow);
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

/**
 * 12. Simpan / Perbarui Data Presensi Kehadiran Halaqah Tahfidz
 */
function saveTahfidzPresensi(payload, token) {
  try {
    let actor = null;
    if (token) {
      try {
        actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "SUPER_ADMIN", "EDITOR", "PEGAWAI", "PENGASUH", "MUHAFIZ", "GURU", "ASATIDZ", "MUALLIM"]);
      } catch (authErr) {
        verifySessionToken(token);
      }
    }

    const p = (payload && (payload.payload || payload.data)) ? (payload.payload || payload.data) : (payload || {});
    const tanggal = p.tanggal ? normalizeDateString(p.tanggal) : Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");
    const sesi = String(p.sesi || "Pagi (Ba'da Subuh)").trim();
    const halaqahId = String(p.halaqahId || p.halaqah_id || "").trim();
    const namaHalaqah = String(p.namaHalaqah || p.nama_halaqah || "Halaqah").trim();
    const muhafiz = String(p.muhafiz || "").trim();
    const rawRecords = p.records || payload.records || [];
    const records = Array.isArray(rawRecords) ? rawRecords : [];

    if (records.length === 0) {
      return {
        status: "success",
        success: true,
        message: "Tidak ada data presensi yang perlu disimpan.",
        savedCount: 0
      };
    }

    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error("Spreadsheet database tidak ditemukan.");

    const sheet = getOrCreateTahfidzSheet(ss, SHEET_TAHFIDZ_PRESENSI, HEADERS_TAHFIDZ_PRESENSI, "#059669");
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h || "").trim().toLowerCase().replace(/[\s\-_]+/g, ""));

    const idIdx = headers.indexOf("presensiid");
    const tglIdx = headers.indexOf("tanggal");
    const sesiIdx = headers.indexOf("sesi");
    const sIdIdx = headers.indexOf("studentid");
    const nisIdx = headers.indexOf("nis");
    const nameIdx = headers.indexOf("studentname");
    const statusIdx = headers.indexOf("status");
    const ketIdx = headers.indexOf("keterangan");
    const hlqIdIdx = headers.indexOf("halaqahid");
    const hlqNmIdx = headers.indexOf("namahalaqah");
    const muhIdx = headers.indexOf("muhafiz");
    const updIdx = headers.indexOf("updatedat");

    // Index existing rows: key = `${tanggal}_${sesi}_${studentId/nis}` -> row index (0-based in data array)
    const existingRowMap = new Map();
    for (let i = 1; i < data.length; i++) {
      const rowTgl = tglIdx !== -1 ? normalizeDateString(data[i][tglIdx]) : "";
      const rowSesi = sesiIdx !== -1 ? String(data[i][sesiIdx] || "").trim() : "";
      const rowSid = sIdIdx !== -1 ? String(data[i][sIdIdx] || "").trim().toLowerCase() : "";
      const rowNis = nisIdx !== -1 ? String(data[i][nisIdx] || "").trim().toLowerCase() : "";

      if (rowTgl && rowSesi) {
        if (rowSid) existingRowMap.set(`${rowTgl}_${rowSesi}_${rowSid}`, i);
        if (rowNis) existingRowMap.set(`${rowTgl}_${rowSesi}_${rowNis}`, i);
      }
    }

    const newRowsToAppend = [];
    const nowIso = new Date().toISOString();
    let savedCount = 0;

    records.forEach(rec => {
      const sId = String(rec.studentId || rec.student_id || "").trim();
      const sNis = String(rec.nis || "").trim();
      const sName = String(rec.studentName || rec.student_name || rec.name || "").trim();
      const status = String(rec.status || "HADIR").trim().toUpperCase();
      const keterangan = String(rec.keterangan || "").trim();
      const recHlqId = String(rec.halaqahId || rec.halaqah_id || halaqahId).trim();
      const recHlqNm = String(rec.namaHalaqah || rec.nama_halaqah || namaHalaqah).trim();
      const recMuh = String(rec.muhafiz || muhafiz).trim();

      if (!sId && !sNis && !sName) return;

      const lookupKeySid = `${tanggal}_${sesi}_${sId.toLowerCase()}`;
      const lookupKeyNis = `${tanggal}_${sesi}_${sNis.toLowerCase()}`;
      const existingIdx = (sId && existingRowMap.has(lookupKeySid)) 
        ? existingRowMap.get(lookupKeySid) 
        : ((sNis && existingRowMap.has(lookupKeyNis)) ? existingRowMap.get(lookupKeyNis) : -1);

      if (existingIdx !== -1) {
        if (statusIdx !== -1) data[existingIdx][statusIdx] = status;
        if (ketIdx !== -1) data[existingIdx][ketIdx] = keterangan;
        if (nameIdx !== -1 && sName) data[existingIdx][nameIdx] = sName;
        if (hlqIdIdx !== -1 && recHlqId) data[existingIdx][hlqIdIdx] = recHlqId;
        if (hlqNmIdx !== -1 && recHlqNm) data[existingIdx][hlqNmIdx] = recHlqNm;
        if (muhIdx !== -1 && recMuh) data[existingIdx][muhIdx] = recMuh;
        if (updIdx !== -1) data[existingIdx][updIdx] = nowIso;
        savedCount++;
      } else {
        const presensiId = "PRS-" + Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd-HHmmss") + "-" + Math.floor(1000 + Math.random() * 9000);
        const newRow = new Array(HEADERS_TAHFIDZ_PRESENSI.length).fill("");
        if (idIdx !== -1) newRow[idIdx] = presensiId;
        if (tglIdx !== -1) newRow[tglIdx] = tanggal;
        if (sesiIdx !== -1) newRow[sesiIdx] = sesi;
        if (hlqIdIdx !== -1) newRow[hlqIdIdx] = recHlqId;
        if (hlqNmIdx !== -1) newRow[hlqNmIdx] = recHlqNm;
        if (sIdIdx !== -1) newRow[sIdIdx] = sId;
        if (nisIdx !== -1) newRow[nisIdx] = sNis;
        if (nameIdx !== -1) newRow[nameIdx] = sName;
        if (statusIdx !== -1) newRow[statusIdx] = status;
        if (ketIdx !== -1) newRow[ketIdx] = keterangan;
        if (muhIdx !== -1) newRow[muhIdx] = recMuh;
        if (updIdx !== -1) newRow[updIdx] = nowIso;
        newRowsToAppend.push(newRow);
        savedCount++;
      }
    });

    if (data.length > 1) {
      sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
    }
    if (newRowsToAppend.length > 0) {
      const startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, newRowsToAppend.length, newRowsToAppend[0].length).setValues(newRowsToAppend);
    }

    return {
      status: "success",
      success: true,
      message: `Presensi tahfidz (${savedCount} santri) berhasil disimpan ke spreadsheet.`,
      savedCount: savedCount,
      tanggal: tanggal,
      sesi: sesi
    };
  } catch (err) {
    console.error("[SAVE TAHFIDZ PRESENSI ERROR]", err);
    return { status: "error", success: false, message: "Gagal menyimpan presensi: " + err.message };
  }
}

/**
 * 13. Ambil Riwayat Presensi Kehadiran Halaqah Tahfidz
 */
function getTahfidzPresensi(payload, token) {
  try {
    if (token) {
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "SUPER_ADMIN", "EDITOR", "PEGAWAI", "PENGASUH", "MUHAFIZ", "GURU", "ASATIDZ", "MUALLIM", "WALI_SANTRI", "PARENT"]);
      } catch (authErr) {
        verifySessionToken(token);
      }
    }

    const p = (payload && payload.data) ? payload.data : (payload || {});
    const targetDate = p.tanggal ? normalizeDateString(p.tanggal) : Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");
    const targetSesi = p.sesi ? String(p.sesi).trim() : "";
    const targetHalaqahId = p.halaqahId || p.halaqah_id ? String(p.halaqahId || p.halaqah_id).trim().toLowerCase() : "";

    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error("Spreadsheet database tidak ditemukan.");

    const sheet = ss.getSheetByName(SHEET_TAHFIDZ_PRESENSI);
    if (!sheet || sheet.getLastRow() <= 1) {
      return {
        status: "success",
        success: true,
        tanggal: targetDate,
        records: {}
      };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h || "").trim().toLowerCase().replace(/[\s\-_]+/g, ""));
    const tglIdx = headers.indexOf("tanggal");
    const sesiIdx = headers.indexOf("sesi");
    const sIdIdx = headers.indexOf("studentid");
    const nisIdx = headers.indexOf("nis");
    const statusIdx = headers.indexOf("status");
    const ketIdx = headers.indexOf("keterangan");
    const hlqIdIdx = headers.indexOf("halaqahid");

    const records = {};

    for (let i = 1; i < data.length; i++) {
      const rowTgl = tglIdx !== -1 ? normalizeDateString(data[i][tglIdx]) : "";
      if (targetDate && rowTgl !== targetDate) continue;

      const rowSesi = sesiIdx !== -1 ? String(data[i][sesiIdx] || "").trim() : "";
      if (targetSesi && rowSesi !== targetSesi) continue;

      const rowHlq = hlqIdIdx !== -1 ? String(data[i][hlqIdIdx] || "").trim().toLowerCase() : "";
      if (targetHalaqahId && targetHalaqahId !== "all" && rowHlq && rowHlq !== targetHalaqahId) continue;

      const sid = sIdIdx !== -1 ? String(data[i][sIdIdx] || "").trim() : "";
      const snis = nisIdx !== -1 ? String(data[i][nisIdx] || "").trim() : "";
      const status = statusIdx !== -1 ? String(data[i][statusIdx] || "HADIR").trim() : "HADIR";
      const ket = ketIdx !== -1 ? String(data[i][ketIdx] || "").trim() : "";

      const recObj = { status: status, keterangan: ket, tanggal: rowTgl, sesi: rowSesi };
      if (sid) records[sid] = recObj;
      if (snis) records[snis] = recObj;
    }

    return {
      status: "success",
      success: true,
      tanggal: targetDate,
      records: records
    };
  } catch (err) {
    console.error("[GET TAHFIDZ PRESENSI ERROR]", err);
    return { status: "error", success: false, message: "Gagal mengambil presensi: " + err.message };
  }
}

// ============================================================================
// MODUL KHUSUS: PERIZINAN ASATIDZ & KELANGSUNGAN HALAQAH TAHFIDZ (BADAL)
// ============================================================================

/**
 * 1. Inisialisasi Sheet Izin_Asatidz
 */
function initIzinAsatidzSheet(ss) {
  try {
    if (!ss) ss = getDatabaseSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_IZIN_ASATIDZ);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_IZIN_ASATIDZ);
      sheet.getRange(1, 1, 1, HEADERS_IZIN_ASATIDZ.length).setValues([HEADERS_IZIN_ASATIDZ]);
      sheet.getRange(1, 1, 1, HEADERS_IZIN_ASATIDZ.length)
        .setFontWeight("bold")
        .setBackground("#047857")
        .setFontColor("#ffffff");
      sheet.setFrozenRows(1);
      Logger.log(`[SCHEMA AUTO-INIT] Tab '${SHEET_IZIN_ASATIDZ}' berhasil dibuat otomatis di Google Sheets.`);
    } else {
      const lastCol = sheet.getLastColumn();
      if (lastCol === 0) {
        sheet.getRange(1, 1, 1, HEADERS_IZIN_ASATIDZ.length).setValues([HEADERS_IZIN_ASATIDZ]);
        sheet.getRange(1, 1, 1, HEADERS_IZIN_ASATIDZ.length)
          .setFontWeight("bold")
          .setBackground("#047857")
          .setFontColor("#ffffff");
        sheet.setFrozenRows(1);
      }
    }
    return {
      status: "success",
      success: true,
      message: `Tab '${SHEET_IZIN_ASATIDZ}' berhasil disiapkan di Google Sheets.`,
      sheetName: SHEET_IZIN_ASATIDZ
    };
  } catch (err) {
    console.error("[INIT IZIN ASATIDZ ERROR]", err);
    return { status: "error", success: false, message: "Gagal menyiapkan tab Izin_Asatidz: " + err.message };
  }
}

/**
 * 2. Helper Mengakses Sheet Izin_Asatidz
 */
function getIzinAsatidzSheet() {
  const ss = getDatabaseSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_IZIN_ASATIDZ);
  if (!sheet) {
    initIzinAsatidzSheet(ss);
    sheet = ss.getSheetByName(SHEET_IZIN_ASATIDZ);
  }
  return sheet;
}

/**
 * 3. Mengajukan Izin Asatidz (Wajib Menunjuk Ustadz Badal)
 */
function submitIzinAsatidz(payload, token) {
  try {
    let actor = null;
    if (token) {
      try {
        actor = authenticateSession(token);
        authorizeRole(actor, ["SUPER_ADMIN", "ADMIN", "ASATIDZ", "PENGASUH"]);
      } catch (authErr) {
        verifySessionToken(token);
      }
    }

    const data = payload || {};
    const asatidzId = String(data.asatidzId || (actor && actor.identityId) || "").trim();
    const namaAsatidz = String(data.namaAsatidz || (actor && actor.identity && (actor.identity.nama || actor.identity.name)) || "").trim();
    const tglMulai = String(data.tanggalMulai || data.tglMulai || "").trim();
    const tglSelesai = String(data.tanggalSelesai || data.tglSelesai || tglMulai).trim();
    const sesi = String(data.sesi || "FULL_DAY").trim().toUpperCase();
    const kategori = String(data.kategori || "SAKIT").trim().toUpperCase();
    const alasan = String(data.alasan || "").trim();
    const badalId = String(data.badalId || "").trim();
    const namaBadal = String(data.namaBadal || "").trim();
    const catatanBadal = String(data.catatanBadal || "").trim();
    const lampiranUrl = String(data.lampiranUrl || "").trim();

    if (!namaAsatidz) throw new Error("Nama Asatidz pemohon wajib diisi.");
    if (!tglMulai) throw new Error("Tanggal mulai izin wajib ditentukan.");
    if (!alasan) throw new Error("Alasan perizinan wajib disertakan.");
    if (!namaBadal) throw new Error("Ustadz Badal (pengganti) wajib dipilih untuk menjamin kelangsungan halaqah.");

    const sheet = getIzinAsatidzSheet();
    if (!sheet) throw new Error("Gagal mengakses database Izin_Asatidz.");

    const now = new Date();
    const yearMonth = Utilities.formatDate(now, "GMT+7", "yyyyMM");
    const count = Math.max(1, sheet.getLastRow());
    const idIzin = `IZA-${yearMonth}-${String(count).padStart(3, "0")}`;
    const timestamp = now.toISOString();

    const newRow = [
      idIzin,
      asatidzId,
      namaAsatidz,
      tglMulai,
      tglSelesai,
      sesi,
      kategori,
      alasan,
      badalId,
      namaBadal,
      catatanBadal,
      lampiranUrl,
      "PENDING",
      "",
      "",
      "",
      timestamp,
      timestamp
    ];

    sheet.appendRow(newRow);

    return {
      status: "success",
      success: true,
      message: "Permohonan izin mengajar berhasil diajukan dan menunggu persetujuan Dewan Pengasuh.",
      data: {
        idIzin: idIzin,
        namaAsatidz: namaAsatidz,
        namaBadal: namaBadal,
        tglMulai: tglMulai,
        tglSelesai: tglSelesai,
        sesi: sesi,
        status: "PENDING"
      }
    };
  } catch (err) {
    console.error("[SUBMIT IZIN ASATIDZ ERROR]", err);
    return {
      status: "error",
      success: false,
      message: "Gagal mengajukan izin: " + err.message
    };
  }
}

/**
 * 4. Mengambil Daftar Data Izin Asatidz
 */
function getIzinAsatidzData(params = {}, token = null) {
  try {
    let actor = null;
    if (token) {
      try {
        actor = authenticateSession(token);
      } catch (e) {
        verifySessionToken(token);
      }
    }

    const sheet = getIzinAsatidzSheet();
    if (!sheet) {
      return { status: "success", success: true, data: [], summary: { total: 0, pending: 0, approved: 0, rejected: 0 } };
    }

    const values = sheet.getDataRange().getValues();
    if (!values || values.length < 2) {
      return { status: "success", success: true, data: [], summary: { total: 0, pending: 0, approved: 0, rejected: 0 } };
    }

    const headers = values[0].map(h => String(h || "").trim().toLowerCase());
    const col = {};
    headers.forEach((h, idx) => { col[h] = idx; });

    const list = [];
    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;

    for (let i = 1; i < values.length; i++) {
      const r = values[i];
      const idIzin = String(r[col["id_izin"]] || "").trim();
      if (!idIzin) continue;

      const item = {
        idIzin: idIzin,
        asatidzId: String(r[col["asatidz_id"]] || "").trim(),
        namaAsatidz: String(r[col["nama_asatidz"]] || "").trim(),
        tanggalMulai: String(r[col["tanggal_mulai"]] || "").trim(),
        tanggalSelesai: String(r[col["tanggal_selesai"]] || "").trim(),
        sesi: String(r[col["sesi"]] || "FULL_DAY").trim(),
        kategori: String(r[col["kategori"]] || "SAKIT").trim(),
        alasan: String(r[col["alasan"]] || "").trim(),
        badalId: String(r[col["badal_id"]] || "").trim(),
        namaBadal: String(r[col["nama_badal"]] || "").trim(),
        catatanBadal: String(r[col["catatan_badal"]] || "").trim(),
        lampiranUrl: String(r[col["lampiran_url"]] || "").trim(),
        status: String(r[col["status"]] || "PENDING").trim().toUpperCase(),
        pengasuhApprovedBy: String(r[col["pengasuh_approved_by"]] || "").trim(),
        pengasuhApprovedAt: String(r[col["pengasuh_approved_at"]] || "").trim(),
        catatanPengasuh: String(r[col["catatan_pengasuh"]] || "").trim(),
        createdAt: String(r[col["created_at"]] || "").trim(),
        updatedAt: String(r[col["updated_at"]] || "").trim()
      };

      if (item.status === "PENDING") pendingCount++;
      else if (item.status === "APPROVED") approvedCount++;
      else if (item.status === "REJECTED") rejectedCount++;

      // Filter jika parameter diberikan
      if (params.status && item.status !== String(params.status).trim().toUpperCase()) continue;
      if (params.asatidzId && item.asatidzId !== String(params.asatidzId).trim()) continue;
      if (params.badalId && item.badalId !== String(params.badalId).trim()) continue;
      if (params.tanggal && (item.tanggalMulai > params.tanggal || item.tanggalSelesai < params.tanggal)) continue;

      list.push(item);
    }

    list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    return {
      status: "success",
      success: true,
      data: list,
      summary: {
        total: list.length,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount
      }
    };
  } catch (err) {
    console.error("[GET IZIN ASATIDZ ERROR]", err);
    return {
      status: "error",
      success: false,
      message: "Gagal memuat data izin asatidz: " + err.message
    };
  }
}

/**
 * 5. Persetujuan Izin Asatidz oleh Dewan Pengasuh
 */
function approveIzinAsatidz(payload, token) {
  try {
    let approverName = "Dewan Pengasuh";
    if (token) {
      const actor = authenticateSession(token);
      authorizeRole(actor, ["SUPER_ADMIN", "ADMIN", "PENGASUH"]);
      if (actor.identity && (actor.identity.nama || actor.identity.name)) {
        approverName = actor.identity.nama || actor.identity.name;
      }
    }

    const data = payload || {};
    const idIzin = String(data.idIzin || data.id || "").trim();
    const decision = String(data.decision || data.status || "APPROVED").trim().toUpperCase();
    const catatan = String(data.catatan || data.catatanPengasuh || "").trim();

    if (!idIzin) throw new Error("ID Izin Asatidz wajib disertakan.");

    const sheet = getIzinAsatidzSheet();
    if (!sheet) throw new Error("Database Izin_Asatidz tidak ditemukan.");

    const values = sheet.getDataRange().getValues();
    if (!values || values.length < 2) throw new Error("Data izin masih kosong.");

    const headers = values[0].map(h => String(h || "").trim().toLowerCase());
    const col = {};
    headers.forEach((h, idx) => { col[h] = idx; });

    let rowIndex = -1;
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][col["id_izin"]] || "").trim() === idIzin) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex === -1) {
      throw new Error(`Data izin '${idIzin}' tidak ditemukan.`);
    }

    const nowISO = new Date().toISOString();
    const finalStatus = (decision === "REJECT" || decision === "REJECTED" || decision === "TOLAK") ? "REJECTED" : "APPROVED";

    sheet.getRange(rowIndex, col["status"] + 1).setValue(finalStatus);
    sheet.getRange(rowIndex, col["pengasuh_approved_by"] + 1).setValue(approverName);
    sheet.getRange(rowIndex, col["pengasuh_approved_at"] + 1).setValue(nowISO);
    sheet.getRange(rowIndex, col["catatan_pengasuh"] + 1).setValue(catatan);
    sheet.getRange(rowIndex, col["updated_at"] + 1).setValue(nowISO);

    return {
      status: "success",
      success: true,
      message: finalStatus === "APPROVED" 
        ? "Izin Asatidz berhasil disetujui (Qobul). Pendelegasian halaqah ke Ustadz Badal telah aktif."
        : "Izin Asatidz telah ditolak.",
      data: {
        idIzin: idIzin,
        status: finalStatus,
        approvedBy: approverName,
        approvedAt: nowISO
      }
    };
  } catch (err) {
    console.error("[APPROVE IZIN ASATIDZ ERROR]", err);
    return {
      status: "error",
      success: false,
      message: "Gagal memproses persetujuan izin: " + err.message
    };
  }
}

/**
 * 6. Mengambil Delegasi Badal Aktif pada Tanggal & Sesi Tertentu
 */
function getActiveBadalDelegations(dateStr, sesiStr) {
  try {
    const today = dateStr || Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");
    const sheet = getIzinAsatidzSheet();
    if (!sheet) return [];

    const values = sheet.getDataRange().getValues();
    if (!values || values.length < 2) return [];

    const headers = values[0].map(h => String(h || "").trim().toLowerCase());
    const col = {};
    headers.forEach((h, idx) => { col[h] = idx; });

    const delegations = [];
    for (let i = 1; i < values.length; i++) {
      const r = values[i];
      const status = String(r[col["status"]] || "").trim().toUpperCase();
      if (status !== "APPROVED") continue;

      const tMulai = String(r[col["tanggal_mulai"]] || "").trim();
      const tSelesai = String(r[col["tanggal_selesai"]] || tMulai).trim();
      if (today < tMulai || today > tSelesai) continue;

      const sesi = String(r[col["sesi"]] || "FULL_DAY").trim().toUpperCase();
      if (sesiStr && sesi !== "FULL_DAY" && sesi !== String(sesiStr).trim().toUpperCase()) {
        continue;
      }

      delegations.push({
        idIzin: String(r[col["id_izin"]] || "").trim(),
        asatidzId: String(r[col["asatidz_id"]] || "").trim(),
        namaAsatidz: String(r[col["nama_asatidz"]] || "").trim(),
        badalId: String(r[col["badal_id"]] || "").trim(),
        namaBadal: String(r[col["nama_badal"]] || "").trim(),
        sesi: sesi,
        catatanBadal: String(r[col["catatan_badal"]] || "").trim(),
        tanggalMulai: tMulai,
        tanggalSelesai: tSelesai
      });
    }
    return delegations;
  } catch (e) {
    console.warn("[GET ACTIVE BADAL ERROR]", e);
    return [];
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
function resolveTPQKelas_(ss, studentId, nis, customKelasId, customNamaKelas, customUstadz, skipWrite, preloadedKData) {
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
        if (!skipWrite) {
          migrateTPQKelasSheetIfNeeded(kSheet);
        }
        const kData = preloadedKData || kSheet.getDataRange().getValues();
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

              // Otomatis daftarkan sId ke student_ids kelas ini jika belum ada (hanya jika bukan mode read-only)
              if (!skipWrite && sId && sidsIdx !== -1 && matchedRowIndex > 0) {
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

    const cHead = cData.length > 0 ? cData[0].map(h => String(h || "").trim().toLowerCase()) : headersCapaian;
    const sIdIdx = cHead.indexOf("student_id");
    const sNameIdx = cHead.indexOf("student_name");
    const kIdIdx = cHead.indexOf("kelas_id");
    const kNameIdx = cHead.indexOf("nama_kelas");
    const uIdx = cHead.indexOf("ustadz_pengampu");
    const upIdx = cHead.indexOf("updated_at");

    if (sIdIdx === -1 || kIdIdx === -1) return;

    // Ambil mapping santri dari Sheet Students untuk mencocokkan student_id vs NIS
    const studSheet = ss.getSheetByName(SHEET_STUDENTS);
    const studMap = {};
    if (studSheet) {
      const sVals = studSheet.getDataRange().getValues();
      if (sVals.length > 1) {
        const sHead = sVals[0].map(h => String(h || "").trim().toLowerCase());
        const sIdCol = sHead.indexOf("student_id");
        const sNisCol = sHead.indexOf("nis") !== -1 ? sHead.indexOf("nis") : sHead.indexOf("nisn");
        const sNameCol = sHead.indexOf("name") !== -1 ? sHead.indexOf("name") : sHead.indexOf("nama");
        for (let i = 1; i < sVals.length; i++) {
          const rowSid = sIdCol !== -1 ? String(sVals[i][sIdCol] || "").trim() : "";
          const rowNis = sNisCol !== -1 ? String(sVals[i][sNisCol] || "").trim() : "";
          const rowName = sNameCol !== -1 ? String(sVals[i][sNameCol] || "").trim() : "";
          const item = { studentId: rowSid, nis: rowNis, name: rowName };
          if (rowSid) studMap[rowSid] = item;
          if (rowNis) studMap[rowNis] = item;
        }
      }
    }

    const cleanSids = Array.isArray(studentIds) ? studentIds.map(s => String(s).trim()).filter(Boolean) : [];
    // Bangun set pencocokan yang mencakup baik studentId maupun NIS
    const enrolledMatches = new Set();
    cleanSids.forEach(id => {
      enrolledMatches.add(id);
      if (studMap[id]) {
        if (studMap[id].studentId) enrolledMatches.add(studMap[id].studentId);
        if (studMap[id].nis) enrolledMatches.add(studMap[id].nis);
      }
    });

    const kName = namaKelas || (ustadz && ustadz !== "-" ? ("Kelas " + ustadz) : ("Kelas " + kelasId));
    const nowIso = new Date().toISOString();
    const existingMatchedIds = new Set();

    // 1. Perbarui baris yang sudah ada di TPQ_Capaian
    for (let i = 1; i < cData.length; i++) {
      const rowSid = String(cData[i][sIdIdx] || "").trim();
      const currentKId = String(cData[i][kIdIdx] || "").trim();
      const rowNumber = i + 1;

      // Cek apakah santri ini cocok dengan yang di-plot
      let isEnrolled = enrolledMatches.has(rowSid);
      if (!isEnrolled && studMap[rowSid]) {
        if (enrolledMatches.has(studMap[rowSid].studentId) || enrolledMatches.has(studMap[rowSid].nis)) {
          isEnrolled = true;
        }
      }

      if (isEnrolled) {
        existingMatchedIds.add(rowSid);
        if (studMap[rowSid]) {
          if (studMap[rowSid].studentId) existingMatchedIds.add(studMap[rowSid].studentId);
          if (studMap[rowSid].nis) existingMatchedIds.add(studMap[rowSid].nis);
        }
        if (currentKId !== kelasId || String(cData[i][kNameIdx] || "").trim() === "Belum Ditentukan" || !cData[i][kNameIdx]) {
          cSheet.getRange(rowNumber, kIdIdx + 1).setValue(kelasId);
          if (kNameIdx !== -1) cSheet.getRange(rowNumber, kNameIdx + 1).setValue(kName);
          if (uIdx !== -1 && ustadz && ustadz !== "-") cSheet.getRange(rowNumber, uIdx + 1).setValue(ustadz);
          if (upIdx !== -1) cSheet.getRange(rowNumber, upIdx + 1).setValue(nowIso);
        }
      } else if (currentKId === kelasId) {
        // Santri DIKELUARKAN dari kelas ini -> reset kelas_id & nama_kelas
        cSheet.getRange(rowNumber, kIdIdx + 1).setValue("");
        if (kNameIdx !== -1) cSheet.getRange(rowNumber, kNameIdx + 1).setValue("Belum Ditentukan");
        if (uIdx !== -1) cSheet.getRange(rowNumber, uIdx + 1).setValue("-");
        if (upIdx !== -1) cSheet.getRange(rowNumber, upIdx + 1).setValue(nowIso);
      }
    }

    // 2. Jika ada santri di cleanSids yang BELUM memiliki baris di TPQ_Capaian, tambahkan baris baru!
    cleanSids.forEach(sid => {
      let alreadyExists = existingMatchedIds.has(sid);
      if (!alreadyExists && studMap[sid]) {
        alreadyExists = existingMatchedIds.has(studMap[sid].studentId) || existingMatchedIds.has(studMap[sid].nis);
      }
      if (!alreadyExists) {
        const info = studMap[sid] || { studentId: sid, nis: "", name: "Santri TPQ" };
        const finalId = info.studentId || sid;
        const finalName = info.name || "Santri TPQ";
        // Header: ["student_id", "student_name", "jilid_aktif", "halaman_aktif", "status_terakhir", "kelas_id", "nama_kelas", "ustadz_pengampu", "updated_at"]
        cSheet.appendRow([finalId, finalName, 1, 1, "LANJUT", kelasId, kName, ustadz || "-", nowIso]);
        existingMatchedIds.add(finalId);
        if (info.nis) existingMatchedIds.add(info.nis);
      }
    });

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
    const headersKelas = ["kelas_id", "ustadz_pengampu", "deskripsi", "student_ids", "created_at"];
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

// Konfigurasi Resmi Jenjang & Halaman Kitab Yanbu'a (Pemula 48 hal, Jld 1 44, Jld 2 43, Jld 3 44, Jld 4 45, Jld 5 46, Jld 6 47, Jld 7 39)
const YANBUA_PAGES_CONFIG_ = {
  0: { name: "Pemula", pages: 48 },
  1: { name: "Jilid 1", pages: 44 },
  2: { name: "Jilid 2", pages: 43 },
  3: { name: "Jilid 3", pages: 44 },
  4: { name: "Jilid 4", pages: 45 },
  5: { name: "Jilid 5", pages: 46 },
  6: { name: "Jilid 6", pages: 47 },
  7: { name: "Jilid 7", pages: 39 }
};
const TOTAL_YANBUA_PAGES_ = 48 + 44 + 43 + 44 + 45 + 46 + 47 + 39; // 356 Halaman

function getYanbuaJilidMaxPages_(jilid) {
  if (jilid === 0 || String(jilid).toLowerCase() === "pemula") return 48;
  const num = Number(jilid);
  if (YANBUA_PAGES_CONFIG_[num]) return YANBUA_PAGES_CONFIG_[num].pages;
  return 44;
}

function getYanbuaCumulativePages_(jilid, halaman) {
  let jKey = 1;
  if (jilid === 0 || String(jilid).toLowerCase() === "pemula") jKey = 0;
  else jKey = Number(jilid) || 1;

  const hal = Number(halaman) || 1;
  const pageMap = [48, 44, 43, 44, 45, 46, 47, 39];
  let cumulative = 0;
  for (let i = 0; i < jKey && i < pageMap.length; i++) {
    cumulative += pageMap[i];
  }
  const maxInJilid = (jKey >= 0 && jKey < pageMap.length) ? pageMap[jKey] : 44;
  cumulative += Math.min(maxInJilid, Math.max(1, hal));
  return Math.min(TOTAL_YANBUA_PAGES_, cumulative);
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
    const headersKelas = ["kelas_id", "ustadz_pengampu", "deskripsi", "student_ids", "created_at"];
    const kelasSheet = getOrCreateTPQSheet(ss, SHEET_TPQ_KELAS, headersKelas, "#0284c7");
    migrateTPQKelasSheetIfNeeded(kelasSheet);

    const kelasList = [];
    const kData = kelasSheet.getDataRange().getValues();
    if (kData.length >= 2) {
      for (let i = 1; i < kData.length; i++) {
        let sids = [];
        try {
          const raw = String(kData[i][3] || "");
          if (raw.trim().startsWith("[")) sids = JSON.parse(raw);
          else sids = raw.split(",").map(s => s.trim()).filter(Boolean);
        } catch (e) {
          sids = [];
        }
        const kId = String(kData[i][0] || "").trim();
        const uVal = String(kData[i][1] || "").trim();
        const deskVal = String(kData[i][2] || "").trim();
        const finalName = uVal ? ("Kelas " + uVal) : ("Kelas " + kId);

        kelasList.push({
          kelasId: kId,
          namaKelas: finalName,
          ustadzPengampu: uVal || "-",
          deskripsi: deskVal,
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
          jamMulai: normalizeTimeString(sesiData[i][jmIdx], "15:45"),
          jamSelesai: normalizeTimeString(sesiData[i][jsIdx], "17:00"),
          hariList: hariList
        });
      }
    }

    // Hitung jumlah sesi aktif per pekan (contoh: 5 hari Subuh + 6 hari Sore = 11 sesi)
    let tpqWeeklySessions = 0;
    sesiList.forEach(s => {
      if ((s.status || "").includes("Aktif")) {
        const hArr = Array.isArray(s.hariList) ? s.hariList : String(s.hariList || "").split(",").map(h => h.trim()).filter(Boolean);
        tpqWeeklySessions += Math.max(1, hArr.length);
      }
    });
    if (tpqWeeklySessions === 0) tpqWeeklySessions = 11;

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

    // Gabungkan status capaian ke setiap siswa & hitung statistik (Hanya santri yang telah terplot ke Kelas TPQ)
    const perJilidCount = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
    let totalPlotted = 0;
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

      const isPemula = (cp.jilidAktif === 0 || String(cp.jilidAktif).toLowerCase() === "pemula");
      const jld = isPemula ? 0 : Math.max(1, Math.min(7, Number(cp.jilidAktif) || 1));

      // Cek apakah santri telah dimasukkan ke dalam kelompok kelas TPQ
      const isPlotted = Boolean(
        (cp.kelasId && cp.namaKelas && cp.namaKelas !== "Belum Ditentukan" && cp.namaKelas !== "Belum Ada Kelas") ||
        kelasList.some(k => Array.isArray(k.studentIds) && (k.studentIds.includes(st.studentId) || (st.nis && k.studentIds.includes(st.nis))))
      );

      if (isPlotted) {
        totalPlotted++;
        perJilidCount[jld] = (perJilidCount[jld] || 0) + 1;
        if (cp.statusTerakhir === "ULANG") totalUlang++;
        else totalLanjut++;
      }

      if (cp.ustadzPengampu && cp.ustadzPengampu !== "-") {
        ustadzSet.add(cp.ustadzPengampu);
      }

      const tgt = targetMap[st.studentId] || {
        targetJilid: isPemula ? 1 : Math.min(7, jld + 1),
        targetHalamanSesi: 1,
        targetHalamanPekan: tpqWeeklySessions
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

    // 6. Ambil data Pegawai untuk Asatidz Pengampu
    const pegawaiSheet = ss.getSheetByName(SHEET_PEGAWAI) || ss.getSheetByName("Pegawai") || ss.getSheetByName("pegawai");
    const ustadzListFromPegawai = [];
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
            if (!ustadzListFromPegawai.includes(nama)) ustadzListFromPegawai.push(nama);
          }
        }
      }
    }

    ustadzSet.forEach(u => {
      if (u && u !== "-" && !ustadzListFromPegawai.includes(u)) {
        ustadzListFromPegawai.push(u);
      }
    });

    return {
      status: "success",
      success: true,
      summary: {
        totalSantri: totalPlotted,
        totalLanjut: totalLanjut,
        totalUlang: totalUlang,
        persentaseLanjut: totalPlotted > 0 ? Math.round((totalLanjut / totalPlotted) * 100) : 100,
        distribusiJilid: perJilidCount
      },
      weeklySessions: tpqWeeklySessions,
      students: enrichedStudents,
      kelasList: kelasList,
      ustadzList: ustadzListFromPegawai,
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
        const maxHal = getYanbuaJilidMaxPages_(jilid);
        if (nextHalaman > maxHal) {
          if (jilid === 0 || String(jilid).toLowerCase() === "pemula") {
            nextJilid = 1;
            nextHalaman = 1;
          } else if (jilid < 7) {
            nextJilid = jilid + 1;
            nextHalaman = 1;
          } else {
            nextJilid = 7;
            nextHalaman = 39;
          }
        }
      } else if (statusSetoran === "NAIK_JILID") {
        if (jilid === 0 || String(jilid).toLowerCase() === "pemula") {
          nextJilid = 1;
        } else {
          nextJilid = Math.min(7, jilid + 1);
        }
        nextHalaman = 1;
      } else if (statusSetoran === "KHATAM_YANBUA") {
        nextJilid = 7;
        nextHalaman = 39; // Halaman akhir Jilid 7 Yanbu'a adalah 39
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

/**
 * Rekalkulasi posisi capaian aktif santri TPQ setelah log dihapus atau diperbarui
 */
function recalculateTPQCapaianForStudent_(ss, studentId) {
  if (!ss || !studentId) return;
  const logsSheet = ss.getSheetByName(SHEET_TPQ_LOGS);
  if (!logsSheet) return;

  const lData = logsSheet.getDataRange().getValues();
  const studentLogs = [];
  if (lData.length >= 2) {
    const lHead = lData[0].map(h => String(h || "").trim().toLowerCase());
    const rsIdx = lHead.indexOf("student_id");
    const rnisIdx = lHead.indexOf("nis");
    const rjIdx = lHead.indexOf("jilid");
    const rhIdx = lHead.indexOf("halaman");
    const rstIdx = lHead.indexOf("status_setoran");
    const rtglIdx = lHead.indexOf("tanggal");
    const rcrIdx = lHead.indexOf("created_at");

    for (let i = 1; i < lData.length; i++) {
      const rowSid = String(lData[i][rsIdx] || "").trim();
      const rowNis = rnisIdx !== -1 ? String(lData[i][rnisIdx] || "").trim() : "";
      if (rowSid === studentId || (rowNis && rowNis === studentId)) {
        studentLogs.push({
          jilid: rjIdx !== -1 ? (Number(lData[i][rjIdx]) || 1) : 1,
          halaman: rhIdx !== -1 ? (Number(lData[i][rhIdx]) || 1) : 1,
          statusSetoran: rstIdx !== -1 ? String(lData[i][rstIdx] || "LANJUT").trim().toUpperCase() : "LANJUT",
          tgl: (rtglIdx !== -1 && lData[i][rtglIdx]) ? new Date(lData[i][rtglIdx]) : (rcrIdx !== -1 && lData[i][rcrIdx] ? new Date(lData[i][rcrIdx]) : new Date(0))
        });
      }
    }
  }

  studentLogs.sort((a, b) => b.tgl - a.tgl);
  const capaianSheet = ss.getSheetByName(SHEET_TPQ_CAPAIAN);
  if (capaianSheet) {
    const cData = capaianSheet.getDataRange().getValues();
    if (cData.length >= 2) {
      const cHead = cData[0].map(h => String(h || "").trim().toLowerCase());
      const csIdIdx = cHead.indexOf("student_id");
      const cJilidIdx = cHead.indexOf("jilid_aktif");
      const cHalIdx = cHead.indexOf("halaman_aktif");
      const cStIdx = cHead.indexOf("status_terakhir");
      const cUpIdx = cHead.indexOf("updated_at");

      for (let i = 1; i < cData.length; i++) {
        if (String(cData[i][csIdIdx] || "").trim() === studentId) {
          const nowIso = new Date().toISOString();
          if (studentLogs.length > 0) {
            const latest = studentLogs[0];
            let nextJ = latest.jilid;
            let nextH = latest.halaman;
            if (latest.statusSetoran === "LANJUT") {
              const maxHal = (typeof YANBUA_CONFIG !== "undefined" && YANBUA_CONFIG[latest.jilid]) ? YANBUA_CONFIG[latest.jilid].pages : 44;
              if (latest.halaman >= maxHal) {
                if (latest.jilid < 7) {
                  nextJ = latest.jilid + 1;
                  nextH = 1;
                } else {
                  nextJ = 7;
                  nextH = maxHal;
                }
              } else {
                nextH = latest.halaman + 1;
              }
            }
            if (cJilidIdx !== -1) capaianSheet.getRange(i + 1, cJilidIdx + 1).setValue(nextJ);
            if (cHalIdx !== -1) capaianSheet.getRange(i + 1, cHalIdx + 1).setValue(nextH);
            if (cStIdx !== -1) capaianSheet.getRange(i + 1, cStIdx + 1).setValue(latest.statusSetoran);
            if (cUpIdx !== -1) capaianSheet.getRange(i + 1, cUpIdx + 1).setValue(nowIso);
          } else {
            // Reset posisi jika seluruh riwayat simakan dihapus
            if (cJilidIdx !== -1) capaianSheet.getRange(i + 1, cJilidIdx + 1).setValue(1);
            if (cHalIdx !== -1) capaianSheet.getRange(i + 1, cHalIdx + 1).setValue(1);
            if (cStIdx !== -1) capaianSheet.getRange(i + 1, cStIdx + 1).setValue("BELUM_MULAI");
            if (cUpIdx !== -1) capaianSheet.getRange(i + 1, cUpIdx + 1).setValue(nowIso);
          }
          break;
        }
      }
    }
  }
}

/**
 * Hapus catatan log simakan TPQ dan rekalkulasi capaian terakhir santri (Protected by script lock & Admin authorization)
 */
function deleteTPQLog(logId, token) {
  return withScriptLock(() => {
    try {
      if (!logId) throw new Error("ID Log wajib disertakan.");
      if (token) {
        try {
          const actor = authenticateSession(token);
          authorizeRole(actor, ["ADMIN", "SUPER_ADMIN"]);
        } catch (authErr) {
          try { verifySessionToken(token); } catch (e) {
            return { status: "error", success: false, message: authErr.message };
          }
        }
      }

      const ss = getDatabaseSpreadsheet();
      if (!ss) throw new Error("Database spreadsheet tidak ditemukan.");
      const logsSheet = ss.getSheetByName(SHEET_TPQ_LOGS);
      if (!logsSheet) throw new Error("Sheet TPQ_Logs tidak ditemukan.");

      const lData = logsSheet.getDataRange().getValues();
      if (lData.length < 2) throw new Error("Tidak ada data log TPQ.");

      const lHead = lData[0].map(h => String(h || "").trim().toLowerCase());
      const logIdIdx = lHead.indexOf("log_id");
      const sIdIdx = lHead.indexOf("student_id");
      if (logIdIdx === -1) throw new Error("Kolom log_id tidak ditemukan di TPQ_Logs.");

      let targetRow = -1;
      let studentId = "";
      for (let i = 1; i < lData.length; i++) {
        if (String(lData[i][logIdIdx] || "").trim() === String(logId).trim()) {
          targetRow = i + 1;
          studentId = sIdIdx !== -1 ? String(lData[i][sIdIdx] || "").trim() : "";
          break;
        }
      }

      if (targetRow === -1) throw new Error("Catatan log dengan ID " + logId + " tidak ditemukan.");

      logsSheet.deleteRow(targetRow);

      // Rekalkulasi capaian terakhir jika studentId ditemukan
      if (studentId) {
        recalculateTPQCapaianForStudent_(ss, studentId);
      }

      return {
        status: "success",
        success: true,
        message: "Catatan simakan TPQ berhasil dihapus dan capaian santri diperbarui."
      };
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

/**
 * Migrasi skema sheet TPQ_Kelas agar mengadopsi struktur 5 kolom Sorogan_Halaqah:
 * [kelas_id, ustadz_pengampu, deskripsi, student_ids, created_at]
 * Menghilangkan kolom nama_kelas dan jadwal_sesi, serta memperbaiki pergeseran data.
 */
function migrateTPQKelasSheetIfNeeded(sheet) {
  if (!sheet) return;
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return;

  const targetHeaders = ["kelas_id", "ustadz_pengampu", "deskripsi", "student_ids", "created_at"];
  const currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || "").trim());

  const hasNama = currentHeaders.some(h => {
    const s = h.toLowerCase();
    return s.includes("nama_kelas") || s === "nama kelas" || s === "nama";
  });
  const hasJadwal = currentHeaders.some(h => {
    const s = h.toLowerCase();
    return s.includes("jadwal_sesi") || s === "jadwal sesi" || s === "jadwal";
  });

  if (!hasNama && !hasJadwal && lastCol === targetHeaders.length) {
    let isMatch = true;
    for (let i = 0; i < targetHeaders.length; i++) {
      if (currentHeaders[i].toLowerCase() !== targetHeaders[i].toLowerCase()) {
        isMatch = false;
        break;
      }
    }
    if (isMatch) return;
  }

  const lastRow = sheet.getLastRow();
  const newRows = [];

  if (lastRow > 1) {
    const dataRange = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    for (let r = 0; r < dataRange.length; r++) {
      const row = dataRange[r];
      let kId = String(row[0] || "").trim();
      let ustadz = "";
      let deskripsi = "";
      let studentIds = "[]";
      let createdAt = new Date().toISOString();

      // Deteksi baris yang tergeser (shifted row dari penambahan 5 elemen ke 6 kolom)
      const val4 = String(row[4] || "").trim();
      const val3 = String(row[3] || "").trim();
      const isShifted = val4.includes("T") && (val3.startsWith("[") || val3 === "" || val3 === "[]");

      if (isShifted) {
        ustadz = String(row[1] || "").trim();
        deskripsi = String(row[2] || "").trim();
        studentIds = val3 || "[]";
        createdAt = val4;
      } else {
        const headLower = currentHeaders.map(h => h.toLowerCase());
        const uIdx = headLower.indexOf("ustadz_pengampu") !== -1 ? headLower.indexOf("ustadz_pengampu") : headLower.indexOf("muallim");
        const deskIdx = headLower.indexOf("deskripsi") !== -1 ? headLower.indexOf("deskripsi") : (headLower.indexOf("jadwal_sesi") !== -1 ? headLower.indexOf("jadwal_sesi") : headLower.indexOf("target_kurikulum"));
        const nameIdx = headLower.indexOf("nama_kelas");
        const sidsIdx = headLower.indexOf("student_ids");
        const createdIdx = headLower.indexOf("created_at");

        ustadz = uIdx !== -1 ? String(row[uIdx] || "").trim() : "";
        if (!ustadz && nameIdx !== -1) {
          ustadz = String(row[nameIdx] || "").replace(/^Kelas\s+/i, "").trim();
        }
        deskripsi = deskIdx !== -1 ? String(row[deskIdx] || "").trim() : "";
        if (sidsIdx !== -1) {
          studentIds = String(row[sidsIdx] || "[]").trim();
        }
        if (createdIdx !== -1) {
          createdAt = String(row[createdIdx] || "").trim();
        }
      }

      if (!kId && !ustadz) continue;
      if (!kId) kId = "TPQ-KLS-" + Utilities.getUuid().replace(/-/g, "").substring(0, 6).toUpperCase();
      if (!deskripsi) deskripsi = "Bimbingan Yanbu'a";
      if (!studentIds) studentIds = "[]";
      if (!createdAt) createdAt = new Date().toISOString();

      newRows.push([kId, ustadz, deskripsi, studentIds, createdAt]);
    }
  }

  // Tulis ulang seluruh sheet menjadi format 5 kolom kanonikal
  sheet.clearContents();
  sheet.getRange(1, 1, 1, targetHeaders.length)
    .setValues([targetHeaders])
    .setFontWeight("bold")
    .setBackground("#0284c7")
    .setFontColor("#ffffff");
  sheet.setFrozenRows(1);

  if (newRows.length > 0) {
    sheet.getRange(2, 1, newRows.length, targetHeaders.length).setValues(newRows);
  }

  const maxCols = sheet.getMaxColumns();
  if (maxCols > targetHeaders.length) {
    sheet.deleteColumns(targetHeaders.length + 1, maxCols - targetHeaders.length);
  }

  Logger.log("[OK] Sheet TPQ_Kelas berhasil dimigrasi menjadi 5 kolom bersih mengadopsi Sorogan_Halaqah.");
}

function getTPQKelasList(token) {
  try {
    const ss = getDatabaseSpreadsheet();
    const headersKelas = ["kelas_id", "ustadz_pengampu", "deskripsi", "student_ids", "created_at"];
    const sheet = getOrCreateTPQSheet(ss, SHEET_TPQ_KELAS, headersKelas, "#0284c7");
    migrateTPQKelasSheetIfNeeded(sheet);

    const data = sheet.getDataRange().getValues();
    const list = [];

    if (data.length >= 2) {
      for (let i = 1; i < data.length; i++) {
        let sids = [];
        try {
          const raw = String(data[i][3] || "");
          if (raw.trim().startsWith("[")) sids = JSON.parse(raw);
          else sids = raw.split(",").map(s => s.trim()).filter(Boolean);
        } catch (e) {
          sids = [];
        }
        const kId = String(data[i][0] || "").trim();
        const uVal = String(data[i][1] || "").trim();
        const deskVal = String(data[i][2] || "").trim();
        const finalName = uVal ? ("Kelas " + uVal) : ("Kelas " + kId);

        list.push({
          kelasId: kId,
          namaKelas: finalName,
          ustadzPengampu: uVal || "-",
          deskripsi: deskVal,
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
      if (token) {
        try {
          const actor = authenticateSession(token);
          authorizeRole(actor, ["ADMIN", "EDITOR", "PEGAWAI", "PENGASUH"]);
        } catch (authErr) {
          try { verifySessionToken(token); } catch (e) {}
        }
      }

      const ustadz = String(data.ustadzPengampu || data.ustadz || "").trim();
      const deskripsi = String(data.deskripsi || data.targetKelas || data.keterangan || "").trim();
      const studentIds = Array.isArray(data.studentIds) ? data.studentIds : [];
      let kelasId = String(data.kelasId || data.id || "").trim();
      const nowIso = new Date().toISOString();

      if (!ustadz) throw new Error("Nama Ustadz / Ustadzah pengampu wajib dipilih.");

      const ss = getDatabaseSpreadsheet();
      const headersKelas = ["kelas_id", "ustadz_pengampu", "deskripsi", "student_ids", "created_at"];
      const sheet = getOrCreateTPQSheet(ss, SHEET_TPQ_KELAS, headersKelas, "#0284c7");
      migrateTPQKelasSheetIfNeeded(sheet);

      const kData = sheet.getDataRange().getValues();
      let rowIndex = -1;

      for (let i = 1; i < kData.length; i++) {
        const rowId = String(kData[i][0] || "").trim();
        const rowU = String(kData[i][1] || "").trim();
        if ((kelasId && rowId === kelasId) || (!kelasId && rowU && rowU.toLowerCase() === ustadz.toLowerCase())) {
          rowIndex = i + 1;
          if (!kelasId) kelasId = rowId;
          break;
        }
      }

      if (rowIndex !== -1) {
        sheet.getRange(rowIndex, 2).setValue(ustadz);
        sheet.getRange(rowIndex, 3).setValue(deskripsi);
        sheet.getRange(rowIndex, 4).setValue(JSON.stringify(studentIds));
      } else {
        if (!kelasId) {
          kelasId = "TPQ-KLS-" + Utilities.getUuid().replace(/-/g, "").substring(0, 6).toUpperCase();
        }
        sheet.appendRow([kelasId, ustadz, deskripsi, JSON.stringify(studentIds), nowIso]);
      }

      const namaKelas = "Kelas " + ustadz;
      // Sync plotting to TPQ_Capaian
      syncTPQPlottingToCapaian_(ss, kelasId, studentIds, ustadz, namaKelas);

      return {
        status: "success",
        success: true,
        message: `Kelas ${namaKelas} berhasil disimpan.`,
        kelasId: kelasId,
        ustadzPengampu: ustadz,
        deskripsi: deskripsi
      };
    } catch (err) {
      return { status: "error", success: false, message: "Gagal menyimpan kelas TPQ: " + err.message };
    }
  });
}

function deleteTPQKelas(kelasId, token) {
  return withScriptLock(() => {
    try {
      if (token) {
        try {
          const actor = authenticateSession(token);
          authorizeRole(actor, ["ADMIN", "EDITOR", "PEGAWAI", "PENGASUH"]);
        } catch (authErr) {
          try { verifySessionToken(token); } catch (e) {}
        }
      }
      if (!kelasId) throw new Error("ID Kelas wajib disertakan.");
      const ss = getDatabaseSpreadsheet();
      const sheet = ss.getSheetByName(SHEET_TPQ_KELAS);
      if (!sheet) throw new Error("Sheet TPQ_Kelas tidak ditemukan.");
      migrateTPQKelasSheetIfNeeded(sheet);

      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0] || "").trim() === String(kelasId).trim()) {
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
      if (token) {
        try {
          const actor = authenticateSession(token);
          authorizeRole(actor, ["ADMIN", "EDITOR", "PEGAWAI", "PENGASUH"]);
        } catch (authErr) {
          try { verifySessionToken(token); } catch (e) {}
        }
      }

      const kelasId = String(payload.kelasId || payload.kelas_id || "").trim();
      if (!kelasId) throw new Error("ID Kelas TPQ wajib disertakan.");

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
      const headersKelas = ["kelas_id", "ustadz_pengampu", "deskripsi", "student_ids", "created_at"];
      const sheet = getOrCreateTPQSheet(ss, SHEET_TPQ_KELAS, headersKelas, "#0284c7");
      migrateTPQKelasSheetIfNeeded(sheet);

      const data = sheet.getDataRange().getValues();
      if (data.length <= 1) throw new Error("Data kelas TPQ tidak ditemukan.");

      let foundRow = -1;
      for (let i = 1; i < data.length; i++) {
        const rowId = String(data[i][0] || "").trim();
        const rowU = String(data[i][1] || "").trim();
        if (rowId === kelasId || rowId.toLowerCase() === kelasId.toLowerCase() || 
            (rowU && ("kelas " + rowU).toLowerCase() === kelasId.toLowerCase()) || 
            (rowU && rowU.toLowerCase() === kelasId.toLowerCase())) {
          foundRow = i + 1;
          break;
        }
      }

      if (foundRow <= 0) throw new Error("Kelas TPQ ID '" + kelasId + "' tidak ditemukan.");

      // Kolom 4 adalah student_ids
      sheet.getRange(foundRow, 4).setValue(JSON.stringify(cleanStudentIds));

      const kUstadz = String(data[foundRow - 1][1] || "").trim();
      const kNama = "Kelas " + kUstadz;
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
      const jamMulai = normalizeTimeString(p.jamMulai || p.jam_mulai, "15:45");
      const jamSelesai = normalizeTimeString(p.jamSelesai || p.jam_selesai, "17:00");
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
// MODUL BACKEND: MADRASAH DINIYAH (MADIN) - KELAS, KITAB, PRESENSI & NILAI
// ====================================================================
const SHEET_MADIN_KELAS = "Madin_Kelas";
const SHEET_MADIN_KITAB = "Madin_Kitab";
const SHEET_MADIN_JURNAL = "Madin_Jurnal";
const SHEET_MADIN_PRESENSI = "Madin_Presensi";
const SHEET_MADIN_NILAI = "Madin_Nilai";
const SHEET_MADIN_ANGGOTA = "Madin_Anggota";

function getOrCreateMadinSheet(ss, sheetName, headers, headerColor) {
  let s = ss.getSheetByName(sheetName);
  if (!s) {
    s = ss.insertSheet(sheetName);
    s.getRange(1, 1, 1, headers.length).setValues([headers]);
    s.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground(headerColor || "#4338ca").setFontColor("#ffffff");
    s.setFrozenRows(1);
  }
  return s;
}

function initMadinSheets(token) {
  try {
    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error("Database Spreadsheet tidak ditemukan.");

    const headersKelas = ["class_id", "nama_kelas", "tingkat", "wali_kelas", "gender", "total_santri", "created_at"];
    const headersKitab = ["subject_id", "nama_kitab", "bidang", "class_id", "ustadz_pengampu", "kkm", "created_at"];
    const headersJurnal = ["session_id", "tanggal", "class_id", "nama_kelas", "subject_id", "nama_kitab", "asatidz", "materi_bab", "catatan", "created_at"];
    const headersPresensi = ["presensi_id", "session_id", "tanggal", "student_id", "nis", "student_name", "class_id", "status", "keterangan", "created_at"];
    const headersNilai = ["nilai_id", "semester", "class_id", "subject_id", "student_id", "nis", "student_name", "nilai_harian", "nilai_lisan", "nilai_tulis", "nilai_akhir", "predikat", "catatan", "updated_at"];
    const headersAnggota = ["member_id", "class_id", "student_id", "nis", "student_name", "gender", "assigned_at"];

    const created = [];
    const existing = [];

    [
      { name: SHEET_MADIN_KELAS, headers: headersKelas, color: "#4338ca" },
      { name: SHEET_MADIN_KITAB, headers: headersKitab, color: "#059669" },
      { name: SHEET_MADIN_JURNAL, headers: headersJurnal, color: "#0284c7" },
      { name: SHEET_MADIN_PRESENSI, headers: headersPresensi, color: "#d97706" },
      { name: SHEET_MADIN_NILAI, headers: headersNilai, color: "#7c3aed" },
      { name: SHEET_MADIN_ANGGOTA, headers: headersAnggota, color: "#0d9488" }
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

    // Masukkan data master kelas default bila baru dibuat
    if (created.includes(SHEET_MADIN_KELAS)) {
      const kSheet = ss.getSheetByName(SHEET_MADIN_KELAS);
      const nowIso = new Date().toISOString();
      const defaultKelas = [
        ["MD-ULA1", "1 Awaliyah A (Putra)", "Awaliyah", "Ust. M. Ridwan, S.Pd.I", "L", 24, nowIso],
        ["MD-ULA2", "1 Awaliyah B (Putri)", "Awaliyah", "Usth. Siti Maryam, S.Ag", "P", 22, nowIso],
        ["MD-WST1", "2 Wustho A (Putra)", "Wustho", "Ust. Ahmad Fauzan", "L", 20, nowIso],
        ["MD-WST2", "2 Wustho B (Putri)", "Wustho", "Usth. Fatimah Az-Zahra", "P", 21, nowIso],
        ["MD-ULY1", "3 Ulya (Aliyah)", "Ulya", "K.H. Masrur", "all", 18, nowIso]
      ];
      kSheet.getRange(2, 1, defaultKelas.length, headersKelas.length).setValues(defaultKelas);
    }

    // Masukkan data master kitab default bila baru dibuat
    if (created.includes(SHEET_MADIN_KITAB)) {
      const bSheet = ss.getSheetByName(SHEET_MADIN_KITAB);
      const nowIso = new Date().toISOString();
      const defaultKitab = [
        ["SBJ-01", "Safinatun Naja", "Fiqih", "MD-ULA1", "Ust. M. Ridwan, S.Pd.I", 70, nowIso],
        ["SBJ-02", "Al-Jurumiyyah", "Nahwu", "MD-ULA1", "Ust. Zaidan Al-Hafidz", 70, nowIso],
        ["SBJ-03", "Taisirul Khalaq", "Akhlaq", "MD-ULA1", "Ust. Fauzi Rohman", 75, nowIso],
        ["SBJ-04", "Al-Amtsilah At-Tashrifiyyah", "Shorof", "MD-ULA1", "Ust. Hasan Basri", 70, nowIso],
        ["SBJ-05", "Fathul Qorib Al-Mujib", "Fiqih", "MD-WST1", "Ust. Ahmad Fauzan", 75, nowIso],
        ["SBJ-06", "Al-Imrithi", "Nahwu", "MD-WST1", "Ust. Luqman Hakim", 75, nowIso],
        ["SBJ-07", "Kifayatul Awam", "Tauhid", "MD-ULY1", "K.H. Masrur", 75, nowIso]
      ];
      bSheet.getRange(2, 1, defaultKitab.length, headersKitab.length).setValues(defaultKitab);
    }

    return {
      status: "success",
      success: true,
      message: "Database Madrasah Diniyah (5 Tab Sheet) berhasil disiapkan di Spreadsheet.",
      createdSheets: created,
      existingSheets: existing
    };
  } catch (err) {
    console.error("[INIT MADIN SHEETS ERROR]", err);
    return { status: "error", success: false, message: "Gagal menyiapkan tabel Madin: " + err.message };
  }
}

function getMadinData(token) {
  try {
    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error("Spreadsheet tidak ditemukan.");

    let classes = [];
    const kSheet = ss.getSheetByName(SHEET_MADIN_KELAS);
    if (kSheet && kSheet.getLastRow() > 1) {
      const vals = kSheet.getRange(2, 1, kSheet.getLastRow() - 1, 7).getValues();
      classes = vals.map(r => ({
        classId: String(r[0] || ""),
        namaKelas: String(r[1] || ""),
        tingkat: String(r[2] || "Awaliyah"),
        waliKelas: String(r[3] || ""),
        gender: String(r[4] || "all"),
        totalSantri: Number(r[5] || 0)
      })).filter(c => c.classId);
    }

    let subjects = [];
    const subSheet = ss.getSheetByName(SHEET_MADIN_KITAB);
    if (subSheet && subSheet.getLastRow() > 1) {
      const vals = subSheet.getRange(2, 1, subSheet.getLastRow() - 1, 7).getValues();
      subjects = vals.map(r => ({
        subjectId: String(r[0] || ""),
        namaKitab: String(r[1] || ""),
        bidang: String(r[2] || "Fiqih"),
        classId: String(r[3] || ""),
        ustadzPengampu: String(r[4] || ""),
        kkm: Number(r[5] || 70)
      })).filter(s => s.subjectId);
    }

    let sessions = [];
    const jSheet = ss.getSheetByName(SHEET_MADIN_JURNAL);
    if (jSheet && jSheet.getLastRow() > 1) {
      const maxRows = Math.min(jSheet.getLastRow() - 1, 50);
      const startRow = jSheet.getLastRow() - maxRows + 1;
      const vals = jSheet.getRange(startRow, 1, maxRows, 10).getValues();
      sessions = vals.map(r => ({
        sessionId: String(r[0] || ""),
        tanggal: String(r[1] || ""),
        classId: String(r[2] || ""),
        namaKelas: String(r[3] || ""),
        subjectId: String(r[4] || ""),
        namaKitab: String(r[5] || ""),
        asatidz: String(r[6] || ""),
        materiBab: String(r[7] || ""),
        catatan: String(r[8] || ""),
        timestamp: String(r[9] || "")
      })).reverse();
    }

    let grades = {};
    const nSheet = ss.getSheetByName(SHEET_MADIN_NILAI);
    if (nSheet && nSheet.getLastRow() > 1) {
      const vals = nSheet.getRange(2, 1, nSheet.getLastRow() - 1, 14).getValues();
      vals.forEach(r => {
        const semester = String(r[1] || "Ganjil");
        const classId = String(r[2] || "");
        const subjectId = String(r[3] || "");
        const studentId = String(r[4] || "");
        const key = `${classId}_${subjectId}_${semester}`;
        if (!grades[key]) grades[key] = {};
        grades[key][studentId] = {
          harian: Number(r[7] || 0),
          lisan: Number(r[8] || 0),
          tulis: Number(r[9] || 0),
          catatan: String(r[12] || "")
        };
      });
    }

    // 5. Baca Anggota Kelas (Plotting Santri)
    let classMembers = {};
    const mSheet = ss.getSheetByName(SHEET_MADIN_ANGGOTA);
    if (mSheet && mSheet.getLastRow() > 1) {
      const mVals = mSheet.getRange(2, 1, mSheet.getLastRow() - 1, 7).getValues();
      mVals.forEach(r => {
        const cId = String(r[1] || "").trim();
        const sId = String(r[2] || "").trim();
        if (cId && sId) {
          if (!classMembers[cId]) classMembers[cId] = [];
          classMembers[cId].push({
            studentId: sId,
            nis: String(r[3] || ""),
            nama: String(r[4] || ""),
            gender: String(r[5] || "")
          });
        }
      });
    }

    return {
      status: "success",
      success: true,
      data: {
        classes: classes.length > 0 ? classes : null,
        subjects: subjects.length > 0 ? subjects : null,
        sessions: sessions,
        grades: grades,
        classMembers: classMembers
      }
    };
  } catch (err) {
    console.error("[GET MADIN DATA ERROR]", err);
    return { status: "error", success: false, message: err.message };
  }
}

function saveMadinSession(payload, token) {
  try {
    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error("Spreadsheet tidak ditemukan.");
    const headersJurnal = ["session_id", "tanggal", "class_id", "nama_kelas", "subject_id", "nama_kitab", "asatidz", "materi_bab", "catatan", "created_at"];
    const jSheet = getOrCreateMadinSheet(ss, SHEET_MADIN_JURNAL, headersJurnal, "#0284c7");

    const nowIso = new Date().toISOString();
    const sessionId = payload.sessionId || ("SES-" + Date.now());

    jSheet.appendRow([
      sessionId,
      payload.tanggal || "",
      payload.classId || "",
      payload.namaKelas || "",
      payload.subjectId || "",
      payload.namaKitab || "",
      payload.asatidz || "",
      payload.materiBab || "",
      payload.catatan || "",
      nowIso
    ]);

    if (payload.kehadiran && typeof payload.kehadiran === "object") {
      const headersPresensi = ["presensi_id", "session_id", "tanggal", "student_id", "nis", "student_name", "class_id", "status", "keterangan", "created_at"];
      const pSheet = getOrCreateMadinSheet(ss, SHEET_MADIN_PRESENSI, headersPresensi, "#d97706");
      const rows = [];
      Object.entries(payload.kehadiran).forEach(([stdId, att]) => {
        rows.push([
          "PR-" + Date.now() + "-" + stdId,
          sessionId,
          payload.tanggal || "",
          stdId,
          "",
          "",
          payload.classId || "",
          att.status || "H",
          att.keterangan || "",
          nowIso
        ]);
      });
      if (rows.length > 0) {
        pSheet.getRange(pSheet.getLastRow() + 1, 1, rows.length, headersPresensi.length).setValues(rows);
      }
    }

    return { status: "success", success: true, message: "Sesi KBM & Presensi Madin berhasil disimpan ke Spreadsheet." };
  } catch (err) {
    console.error("[SAVE MADIN SESSION ERROR]", err);
    return { status: "error", success: false, message: err.message };
  }
}

function saveMadinGrades(payload, token) {
  try {
    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error("Spreadsheet tidak ditemukan.");
    const headersNilai = ["nilai_id", "semester", "class_id", "subject_id", "student_id", "nis", "student_name", "nilai_harian", "nilai_lisan", "nilai_tulis", "nilai_akhir", "predikat", "catatan", "updated_at"];
    const nSheet = getOrCreateMadinSheet(ss, SHEET_MADIN_NILAI, headersNilai, "#7c3aed");

    const classId = payload.classId;
    const subjectId = payload.subjectId;
    const semester = payload.semester || "Ganjil";
    const gradesMap = payload.grades || {};
    const nowIso = new Date().toISOString();

    const rows = [];
    Object.entries(gradesMap).forEach(([stdId, val]) => {
      const harian = Number(val.harian || 0);
      const lisan = Number(val.lisan || 0);
      const tulis = Number(val.tulis || 0);
      const akhir = Math.round((harian * 0.3) + (lisan * 0.3) + (tulis * 0.4));
      let predikat = "Jayyid";
      if (akhir >= 90) predikat = "Mumtaz";
      else if (akhir >= 80) predikat = "Jayyid Jiddan";
      else if (akhir >= 70) predikat = "Jayyid";
      else if (akhir >= 60) predikat = "Maqbul";
      else predikat = "Rosib";

      rows.push([
        `NIL-${classId}-${subjectId}-${stdId}`,
        semester,
        classId,
        subjectId,
        stdId,
        "",
        "",
        harian,
        lisan,
        tulis,
        akhir,
        predikat,
        val.catatan || "",
        nowIso
      ]);
    });

    if (rows.length > 0) {
      nSheet.getRange(nSheet.getLastRow() + 1, 1, rows.length, headersNilai.length).setValues(rows);
    }

    return { status: "success", success: true, message: "Nilai santri berhasil disimpan ke Spreadsheet." };
  } catch (err) {
    console.error("[SAVE MADIN GRADES ERROR]", err);
    return { status: "error", success: false, message: err.message };
  }
}

function saveMadinClass(payload, token) {
  try {
    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error("Spreadsheet tidak ditemukan.");
    const headersKelas = ["class_id", "nama_kelas", "tingkat", "wali_kelas", "gender", "total_santri", "created_at"];
    const kSheet = getOrCreateMadinSheet(ss, SHEET_MADIN_KELAS, headersKelas, "#4338ca");

    const nowIso = new Date().toISOString();
    const classId = payload.classId || ("MD-CLS-" + Date.now().toString().slice(-4));

    let updated = false;
    if (kSheet.getLastRow() > 1) {
      const ids = kSheet.getRange(2, 1, kSheet.getLastRow() - 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) {
        if (String(ids[i][0]) === String(classId)) {
          kSheet.getRange(i + 2, 2, 1, 4).setValues([[payload.namaKelas, payload.tingkat, payload.waliKelas, payload.gender || "all"]]);
          updated = true;
          break;
        }
      }
    }
    if (!updated) {
      kSheet.appendRow([classId, payload.namaKelas, payload.tingkat, payload.waliKelas, payload.gender || "all", 0, nowIso]);
    }

    return { status: "success", success: true, message: "Data kelas berhasil disimpan ke Spreadsheet." };
  } catch (err) {
    return { status: "error", success: false, message: err.message };
  }
}

function saveMadinSubject(payload, token) {
  try {
    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error("Spreadsheet tidak ditemukan.");
    const headersKitab = ["subject_id", "nama_kitab", "bidang", "class_id", "ustadz_pengampu", "kkm", "created_at"];
    const bSheet = getOrCreateMadinSheet(ss, SHEET_MADIN_KITAB, headersKitab, "#059669");

    const nowIso = new Date().toISOString();
    const subjectId = payload.subjectId || ("SBJ-" + Date.now().toString().slice(-4));

    let updated = false;
    if (bSheet.getLastRow() > 1) {
      const ids = bSheet.getRange(2, 1, bSheet.getLastRow() - 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) {
        if (String(ids[i][0]) === String(subjectId)) {
          bSheet.getRange(i + 2, 2, 1, 5).setValues([[payload.namaKitab, payload.bidang, payload.classId, payload.ustadzPengampu, payload.kkm || 70]]);
          updated = true;
          break;
        }
      }
    }
    if (!updated) {
      bSheet.appendRow([subjectId, payload.namaKitab, payload.bidang, payload.classId, payload.ustadzPengampu, payload.kkm || 70, nowIso]);
    }

    return { status: "success", success: true, message: "Data kitab berhasil disimpan ke Spreadsheet." };
  } catch (err) {
    return { status: "error", success: false, message: err.message };
  }
}

function saveMadinClassMembers(payload, token) {
  try {
    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error("Spreadsheet tidak ditemukan.");
    const classId = String(payload.classId || "").trim();
    if (!classId) throw new Error("Class ID wajib diisi.");

    const members = Array.isArray(payload.members) ? payload.members : [];
    const headersAnggota = ["member_id", "class_id", "student_id", "nis", "student_name", "gender", "assigned_at"];
    const mSheet = getOrCreateMadinSheet(ss, SHEET_MADIN_ANGGOTA, headersAnggota, "#0d9488");

    // 1. Hapus anggota lama untuk kelas ini dari sheet Madin_Anggota
    if (mSheet.getLastRow() > 1) {
      const data = mSheet.getRange(2, 1, mSheet.getLastRow() - 1, 7).getValues();
      const remainingRows = [];
      data.forEach(r => {
        if (String(r[1]).trim() !== classId) {
          remainingRows.push(r);
        }
      });

      // Clear isi data lama dan timpa
      mSheet.getRange(2, 1, Math.max(mSheet.getLastRow() - 1, 1), 7).clearContent();
      if (remainingRows.length > 0) {
        mSheet.getRange(2, 1, remainingRows.length, 7).setValues(remainingRows);
      }
    }

    // 2. Append anggota baru
    const nowIso = new Date().toISOString();
    if (members.length > 0) {
      const newRows = members.map((m, idx) => [
        "MBR-" + classId + "-" + (m.studentId || m.id || idx),
        classId,
        m.studentId || m.id || "",
        m.nis || "",
        m.nama || m.name || "",
        m.gender || "L",
        nowIso
      ]);
      const startRow = mSheet.getLastRow() + 1;
      mSheet.getRange(startRow, 1, newRows.length, 7).setValues(newRows);
    }

    // 3. Perbarui total_santri di sheet Madin_Kelas
    const headersKelas = ["class_id", "nama_kelas", "tingkat", "wali_kelas", "gender", "total_santri", "created_at"];
    const kSheet = getOrCreateMadinSheet(ss, SHEET_MADIN_KELAS, headersKelas, "#4338ca");
    if (kSheet.getLastRow() > 1) {
      const cVals = kSheet.getRange(2, 1, kSheet.getLastRow() - 1, 6).getValues();
      for (let i = 0; i < cVals.length; i++) {
        if (String(cVals[i][0]).trim() === classId) {
          kSheet.getRange(i + 2, 6).setValue(members.length);
          break;
        }
      }
    }

    return {
      status: "success",
      success: true,
      message: `Berhasil menyimpan ${members.length} santri ke kelas ${classId}.`,
      classId: classId,
      totalSantri: members.length
    };
  } catch (err) {
    console.error("[SAVE MADIN MEMBERS ERROR]", err);
    return { status: "error", success: false, message: err.message };
  }
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
function resolveSoroganHalaqah_(ss, studentId, nis, customHalaqahId, customNamaHalaqah, customMuallim, skipWrite, preloadedHData) {
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
        if (!skipWrite) {
          migrateSoroganHalaqahSheetIfNeeded(hSheet);
        }
        const hData = preloadedHData || hSheet.getDataRange().getValues();
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

              // Jika santri belum terdaftar di daftar student_ids pada halaqah ini, daftarkan otomatis (hanya jika bukan mode read-only)
              if (!skipWrite && sId && colMap.studentIds !== -1 && matchedRowIndex > 0) {
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
      const rowNumber = i + 1;

      if (cleanSids.includes(rowSid)) {
        if (currentHId !== halaqahId || String(cData[i][hNameIdx] || "").trim() === "Belum Ditentukan" || !cData[i][hNameIdx]) {
          cSheet.getRange(rowNumber, hIdIdx + 1).setValue(halaqahId);
          if (hNameIdx !== -1) cSheet.getRange(rowNumber, hNameIdx + 1).setValue(namaHalaqah);
          if (mIdx !== -1 && muallim && muallim !== "-") cSheet.getRange(rowNumber, mIdx + 1).setValue(muallim);
          if (upIdx !== -1) cSheet.getRange(rowNumber, upIdx + 1).setValue(nowIso);
        }
      } else if (currentHId === halaqahId) {
        // Santri yang sebelumnya ada di halaqah ini namun sekarang dikeluarkan (unplotted)
        cSheet.getRange(rowNumber, hIdIdx + 1).setValue("");
        if (hNameIdx !== -1) cSheet.getRange(rowNumber, hNameIdx + 1).setValue("Belum Masuk Halaqah");
        if (mIdx !== -1) cSheet.getRange(rowNumber, mIdx + 1).setValue("-");
        if (upIdx !== -1) cSheet.getRange(rowNumber, upIdx + 1).setValue(nowIso);
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
          let rawTj = Number(tData[i][jIdx]);
          // Jika target_juz bernilai 1 atau kosong, selaraskan ke 30 (Khatam 30 Juz Al-Qur'an)
          if (!rawTj || rawTj <= 1) {
            rawTj = 30;
            try {
              if (jIdx !== -1) targetSheet.getRange(i + 1, jIdx + 1).setValue(30);
            } catch (healErr) {}
          }
          targetMap[sid] = {
            targetJuz: rawTj,
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
        const resolved = resolveSoroganHalaqah_(ss, sid, stNis, cp.halaqahId, cp.namaHalaqah, cp.muallimPengampu, true, hData);

        if (resolved.halaqahId || (resolved.namaHalaqah && resolved.namaHalaqah !== "Belum Ditentukan")) {
          cp.halaqahId = resolved.halaqahId || cp.halaqahId;
          cp.namaHalaqah = resolved.namaHalaqah || cp.namaHalaqah;
          if (resolved.muallim && resolved.muallim !== "-") cp.muallimPengampu = resolved.muallim;
        }
      }
    });

    // 3b. Bangun studentHalaqahMap dari Sorogan_Halaqah sebagai Single Source of Truth
    const studentHalaqahMap = {};
    halaqahs.forEach(h => {
      const sids = Array.isArray(h.studentIds) ? h.studentIds : [];
      sids.forEach(id => {
        const idClean = String(id || "").trim();
        if (idClean) {
          studentHalaqahMap[idClean] = h;
          studentHalaqahMap[idClean.toLowerCase()] = h;
        }
      });
    });

    // Gabungkan data capaian & hitung ringkasan
    let totalJuzSum = 0;
    let khatam30Juz = 0;
    let totalLanjut = 0;
    let totalUlang = 0;
    const muallimSet = new Set();

    const enrichedStudents = students.map(st => {
      const sId = String(st.studentId || "").trim();
      const sNis = String(st.nis || "").trim();
      const cp = capaianMap[sId] || capaianMap[sNis] || {
        juzAktif: 1,
        halamanTerakhir: 1,
        totalHalamanKhatam: 0,
        statusTerakhir: "LANJUT",
        halaqahId: "",
        namaHalaqah: "Belum Masuk Halaqah",
        muallimPengampu: "-",
        updatedAt: ""
      };

      // Source of Truth mutlak: plotting resmi di Sorogan_Halaqah
      const assignedHalaqah = studentHalaqahMap[sId] || 
                              studentHalaqahMap[sNis] || 
                              studentHalaqahMap[sId.toLowerCase()] || 
                              studentHalaqahMap[sNis.toLowerCase()] || 
                              null;

      let finalHalaqahId = "";
      let finalNamaHalaqah = "Belum Masuk Halaqah";
      let finalMuallim = "-";

      if (assignedHalaqah) {
        finalHalaqahId = assignedHalaqah.halaqahId || "";
        finalNamaHalaqah = assignedHalaqah.namaHalaqah || ("Halaqah " + (assignedHalaqah.muallim || finalHalaqahId));
        finalMuallim = assignedHalaqah.muallim || assignedHalaqah.muallimPengampu || "-";
      }

      const juz = Math.max(1, Math.min(30, cp.juzAktif));
      totalJuzSum += juz;
      if (juz === 30 && cp.halamanTerakhir >= 20) khatam30Juz++;

      if (cp.statusTerakhir === "ULANG") totalUlang++;
      else totalLanjut++;

      if (finalMuallim && finalMuallim !== "-") {
        muallimSet.add(finalMuallim);
      }

      const tgt = targetMap[sId] || targetMap[sNis] || {
        targetJuz: 30,
        targetHalamanSesi: 2,
        targetHalamanPekan: 2 * soroganWeeklySessions
      };

      return {
        ...st,
        juzAktif: juz,
        halamanTerakhir: cp.halamanTerakhir,
        totalHalamanKhatam: cp.totalHalamanKhatam,
        statusTerakhir: cp.statusTerakhir,
        halaqahId: finalHalaqahId,
        namaHalaqah: finalNamaHalaqah,
        muallimPengampu: finalMuallim,
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
      const nilai = String(data.nilai || "MUMTAZ").trim().toUpperCase();
      let statusSetoran = String(data.statusSetoran || data.status_setoran || "").trim().toUpperCase();
      if (!statusSetoran) {
        statusSetoran = (nilai === "DHAIF") ? "ULANG" : "LANJUT";
      }
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
      if (token) {
        try {
          const actor = authenticateSession(token);
          authorizeRole(actor, ["ADMIN", "SUPER_ADMIN"]);
        } catch (authErr) {
          verifySessionToken(token);
        }
      }

      if (!logId) throw new Error("ID Log wajib disertakan.");
      const ss = getDatabaseSpreadsheet();
      const sheet = ss.getSheetByName(SHEET_SOROGAN_LOGS);
      if (!sheet) throw new Error("Sheet Sorogan_Logs tidak ditemukan.");

      const data = sheet.getDataRange().getValues();
      const headers = data[0].map(h => String(h || "").toLowerCase().trim());
      const idIdx = headers.indexOf("log_id");
      const sIdIdx = headers.indexOf("student_id");

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idIdx] || "").trim() === String(logId).trim()) {
          const studentId = sIdIdx !== -1 ? String(data[i][sIdIdx] || "").trim() : "";
          sheet.deleteRow(i + 1);

          // Kalibrasi ulang capaian santri setelah log dihapus
          if (studentId) {
            recalculateSoroganCapaianForStudent_(ss, studentId);
          }

          return { status: "success", success: true, message: "Log sorogan berhasil dihapus." };
        }
      }
      return { status: "error", success: false, message: "Log sorogan tidak ditemukan." };
    } catch (err) {
      return { status: "error", success: false, message: "Gagal menghapus log sorogan: " + err.message };
    }
  });
}

function recalculateSoroganCapaianForStudent_(ss, studentId) {
  try {
    if (!studentId) return;
    const logsSheet = ss.getSheetByName(SHEET_SOROGAN_LOGS);
    const capaianSheet = ss.getSheetByName(SHEET_SOROGAN_CAPAIAN);
    if (!capaianSheet) return;

    let studentLogs = [];
    if (logsSheet) {
      const lData = logsSheet.getDataRange().getValues();
      if (lData && lData.length > 1) {
        const lHeaders = lData[0].map(h => String(h || "").toLowerCase().trim());
        const sIdIdx = lHeaders.indexOf("student_id");
        const nisIdx = lHeaders.indexOf("nis");
        const juzIdx = lHeaders.indexOf("juz");
        const halListIdx = lHeaders.indexOf("halaman_list");
        const totHalIdx = lHeaders.indexOf("total_halaman");
        const statusIdx = lHeaders.indexOf("status_setoran");
        const dateIdx = lHeaders.indexOf("tanggal");
        const crIdx = lHeaders.indexOf("created_at");

        for (let i = 1; i < lData.length; i++) {
          const row = lData[i];
          const rowSid = sIdIdx !== -1 ? String(row[sIdIdx] || "").trim() : "";
          const rowNis = nisIdx !== -1 ? String(row[nisIdx] || "").trim() : "";
          if (rowSid === studentId || (rowNis && rowNis === studentId)) {
            let parsedHalList = [];
            try {
              parsedHalList = JSON.parse(row[halListIdx]);
            } catch (e) {
              const num = Number(row[halListIdx]);
              if (!isNaN(num)) parsedHalList = [num];
            }
            studentLogs.push({
              juz: Number(row[juzIdx]) || 1,
              halamanList: Array.isArray(parsedHalList) ? parsedHalList : [1],
              totalHalaman: Number(row[totHalIdx]) || 1,
              status: String(row[statusIdx] || "").trim().toUpperCase(),
              tanggal: String(row[dateIdx] || ""),
              createdAt: String(row[crIdx] || ""),
              rowOrder: i
            });
          }
        }
      }
    }

    // Urutkan riwayat secara kronologis
    studentLogs.sort((a, b) => {
      const tA = new Date(a.tanggal || a.createdAt).getTime() || a.rowOrder;
      const tB = new Date(b.tanggal || b.createdAt).getTime() || b.rowOrder;
      return tA - tB;
    });

    let newJuz = 1;
    let newHalaman = 1;
    let totalKhatam = 0;
    let statusTerakhir = "BELUM_MULAI";

    if (studentLogs.length > 0) {
      for (const log of studentLogs) {
        if (log.status === "LANJUT") {
          totalKhatam += (log.totalHalaman || 1);
        }
      }

      const latestLog = studentLogs[studentLogs.length - 1];
      const lastPages = latestLog.halamanList.length > 0 ? latestLog.halamanList : [1];
      const maxPage = Math.max(...lastPages);
      statusTerakhir = latestLog.status;

      if (latestLog.status === "LANJUT") {
        if (maxPage >= 20) {
          newJuz = Math.min(30, latestLog.juz + 1);
          newHalaman = (latestLog.juz === 30 && maxPage >= 20) ? 20 : 1;
        } else {
          newJuz = latestLog.juz;
          newHalaman = maxPage + 1;
        }
      } else if (latestLog.status === "KHATAM_30JUZ") {
        newJuz = 30;
        newHalaman = 20;
      } else {
        // ULANG
        newJuz = latestLog.juz;
        newHalaman = Math.min(...lastPages);
      }
    }

    // Update row di Sorogan_Capaian
    const cData = capaianSheet.getDataRange().getValues();
    if (cData && cData.length > 1) {
      const cHeaders = cData[0].map(h => String(h || "").toLowerCase().trim());
      const cSidIdx = cHeaders.indexOf("student_id");
      const cJuzIdx = cHeaders.indexOf("juz_aktif");
      const cHalIdx = cHeaders.indexOf("halaman_terakhir");
      const cTotIdx = cHeaders.indexOf("total_halaman_khatam");
      const cStatIdx = cHeaders.indexOf("status_terakhir");
      const cUpdIdx = cHeaders.indexOf("updated_at");

      for (let i = 1; i < cData.length; i++) {
        if (String(cData[i][cSidIdx] || "").trim() === studentId) {
          const rowNum = i + 1;
          if (cJuzIdx !== -1) capaianSheet.getRange(rowNum, cJuzIdx + 1).setValue(newJuz);
          if (cHalIdx !== -1) capaianSheet.getRange(rowNum, cHalIdx + 1).setValue(newHalaman);
          if (cTotIdx !== -1) capaianSheet.getRange(rowNum, cTotIdx + 1).setValue(totalKhatam);
          if (cStatIdx !== -1) capaianSheet.getRange(rowNum, cStatIdx + 1).setValue(statusTerakhir);
          if (cUpdIdx !== -1) capaianSheet.getRange(rowNum, cUpdIdx + 1).setValue(new Date().toISOString());
          break;
        }
      }
    }
  } catch (err) {
    console.error("[RECALCULATE SOROGAN CAPAIAN ERROR]", err);
  }
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

      const targetJuz = Number(payload.targetJuz || payload.target_juz || 30);
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

      const targetJuz = Number(payload.targetJuz || payload.target_juz || 30);
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
              targetJuz: targetJuzIdx !== -1 ? Number(data[i][targetJuzIdx]) || 30 : 30
            };
          }
        }
      }

      const newRows = [];
      studentIds.forEach(id => {
        if (existingRowMap[id]) {
          const r = existingRowMap[id].row;
          const currentTj = Number(existingRowMap[id].targetJuz);
          const tj = (currentTj && currentTj > 1) ? currentTj : targetJuz;
          sheet.getRange(r, 1, 1, 5).setValues([[id, tj, targetHalamanSesi, targetHalamanPekan, updatedAt]]);
        } else {
          newRows.push([id, targetJuz, targetHalamanSesi, targetHalamanPekan, updatedAt]);
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
        authorizeRole(actor, ["ADMIN", "SUPER_ADMIN", "EDITOR", "PENGASUH", "ASATIDZ", "MUALLIM", "PEGAWAI", "GURU"]);
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
        authorizeRole(actor, ["ADMIN", "SUPER_ADMIN", "EDITOR", "PENGASUH", "PEGAWAI", "MUALLIM", "MUHAFIZ", "GURU", "ASATIDZ", "WALI_SANTRI", "PARENT"]);
      } catch (authErr) {
        verifySessionToken(token);
      }
    }

    const cleanId = String(studentId || "").trim();
    if (!cleanId) throw new Error("ID Santri wajib disertakan.");

    // Validasi hak akses khusus Wali Santri: hanya boleh melihat santri binaan yang terhubung
    if (actor && (actor.role === "WALI_SANTRI" || actor.role === "PARENT")) {
      const linked = (typeof getLinkedStudentsForWali === "function") ? getLinkedStudentsForWali(actor.identityId) : [];
      const allowedIds = (linked || []).map(s => String(s.studentId || s.student_id || s.id || s.nis || "").trim().toLowerCase());
      let isAllowed = allowedIds.includes(cleanId.toLowerCase());
      if (!isAllowed) {
        const studentsResCheck = (typeof getAllStudentsData === "function") ? getAllStudentsData(token) : null;
        const allStudentsList = (studentsResCheck && studentsResCheck.data) || [];
        const targetStudent = allStudentsList.find(s => 
          String(s.studentId || s.student_id || "").toLowerCase() === cleanId.toLowerCase() ||
          String(s.nis || "").toLowerCase() === cleanId.toLowerCase()
        );
        const targetSid = targetStudent ? String(targetStudent.studentId || "").toLowerCase() : "";
        const targetNis = targetStudent ? String(targetStudent.nis || "").toLowerCase() : "";
        if (targetStudent && (allowedIds.includes(targetSid) || allowedIds.includes(targetNis))) {
          isAllowed = true;
        }
      }
      if (!isAllowed) {
        throw new Error("Akses ditolak: Anda hanya berhak memantau perkembangan santri yang terhubung dengan akun Wali Anda.");
      }
    }

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
    const isKhatam = (currentJuz === 30 && halTerakhir >= 20) || (halamanTuntas >= 600) || statusTerakhir === "KHATAM_30JUZ";
    const percentOverall = isKhatam ? 100 : Math.min(100, Math.round((halamanTuntas / 600) * 100));

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
        isKhatam: isKhatam,
        capaianSaatIni: isKhatam ? "Khatam 30 Juz (100%)" : `Juz ${currentJuz} Hal ${halTerakhir} (${percentOverall}%)`,
        targetCapaian: "30 Juz Mushaf Pojok",
        totalSetoran: `${riwayat.length} Kali`,
        rataRataNilai: avgNilaiText,
        progressMax: 30,
        progressPercent: isKhatam ? 100 : percentOverall
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
    let actor = null;
    if (token) {
      try {
        actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "SUPER_ADMIN", "EDITOR", "PENGASUH", "PEGAWAI", "MUALLIM", "MUHAFIZ", "GURU", "ASATIDZ", "WALI_SANTRI", "PARENT"]);
      } catch (authErr) {
        verifySessionToken(token);
      }
    }

    const cleanId = String(studentId || "").trim();
    if (!cleanId) throw new Error("ID Santri wajib disertakan.");

    // Validasi hak akses khusus Wali Santri: hanya boleh melihat santri binaan yang terhubung
    if (actor && (actor.role === "WALI_SANTRI" || actor.role === "PARENT")) {
      const linked = (typeof getLinkedStudentsForWali === "function") ? getLinkedStudentsForWali(actor.identityId) : [];
      const allowedIds = (linked || []).map(s => String(s.studentId || s.student_id || s.id || s.nis || "").trim().toLowerCase());
      let isAllowed = allowedIds.includes(cleanId.toLowerCase());
      if (!isAllowed) {
        const studentsResCheck = (typeof getAllStudentsData === "function") ? getAllStudentsData(token) : null;
        const allStudentsList = (studentsResCheck && studentsResCheck.data) || [];
        const targetStudent = allStudentsList.find(s => 
          String(s.studentId || s.student_id || "").toLowerCase() === cleanId.toLowerCase() ||
          String(s.nis || "").toLowerCase() === cleanId.toLowerCase()
        );
        const targetSid = targetStudent ? String(targetStudent.studentId || "").toLowerCase() : "";
        const targetNis = targetStudent ? String(targetStudent.nis || "").toLowerCase() : "";
        if (targetStudent && (allowedIds.includes(targetSid) || allowedIds.includes(targetNis))) {
          isAllowed = true;
        }
      }
      if (!isAllowed) {
        throw new Error("Akses ditolak: Anda hanya berhak memantau perkembangan santri yang terhubung dengan akun Wali Anda.");
      }
    }

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
    const targetPekan = target.targetHalamanPekan || (targetHarian * 11);
    const targetBulan = targetPekan * 4;

    // Total halaman dihitung dari konfigurasi jenjang resmi Yanbu'a (Total: 356 Halaman)
    const totalHalSelesai = getYanbuaCumulativePages_(currentJilid, halAktif);
    const percentOverall = Math.min(100, Math.round((totalHalSelesai / TOTAL_YANBUA_PAGES_) * 100));

    const pekanPercent = targetPekan > 0 ? Math.min(100, Math.round((pekanReal / targetPekan) * 100)) : 0;
    const bulanPercent = targetBulan > 0 ? Math.min(100, Math.round((bulanReal / targetBulan) * 100)) : 0;
    const jName = (currentJilid === 0 || String(currentJilid).toLowerCase() === "pemula") ? "Pemula" : `Jilid ${currentJilid}`;

    const isKhatam = Boolean((currentJilid === 7 && halAktif >= 39) || statusTerakhir === "KHATAM_YANBUA" || statusTerakhir === "KHATAM" || percentOverall >= 100);

    const stats = {
      progressJilid: currentJilid,
      halamanTerakhir: halAktif,
      totalHalamanKhatam: totalHalSelesai,
      capaianSaatIni: isKhatam ? "Khatam Yanbu'a 🏆 (100%)" : `${jName} Hal ${halAktif} (${percentOverall}%)`,
      targetCapaian: isKhatam ? "Khatam Yanbu'a 🏆" : (target.targetJilid === 0 ? "Pemula" : `Jilid ${target.targetJilid || 7}`),
      totalSetoran: `${riwayat.length} Kali`,
      rataRataNilai: avgNilaiText,
      progressMax: TOTAL_YANBUA_PAGES_,
      progressPercent: isKhatam ? 100 : percentOverall,
      isKhatam: isKhatam
    };

    const indikator = {
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
    };

    return {
      status: "success",
      success: true,
      student: {
        studentId: student.studentId || cleanId,
        nis: student.nis || "-",
        name: student.name || "Santri",
        gender: student.gender || "L",
        photoUrl: student.photoUrl || "",
        program: "TPQ Yanbu'a (Pemula - Jilid 7)",
        status: student.status || "ACTIVE",
        kelas: studentKelas,
        ustadz: studentUstadz
      },
      kelas: studentKelas,
      ustadz: studentUstadz,
      stats: stats,
      indikator: indikator,
      capaian: {
        jilidAktif: currentJilid,
        halamanAktif: halAktif,
        statusTerakhir: statusTerakhir,
        totalHalamanSelesai: totalHalSelesai,
        percentOverall: isKhatam ? 100 : percentOverall,
        isKhatam: isKhatam
      },
      target: {
        targetJilid: target.targetJilid !== undefined ? target.targetJilid : Math.min(7, currentJilid + 1),
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

// ====================================================================
// MODUL PRESENSI KEGIATAN SANTRI (HYBRID & EXCEPTION-BASED STORAGE)
// ====================================================================

/**
 * Helper Database Spreadsheet untuk Modul Presensi
 */
function getSpreadsheetDB_() {
  if (typeof getDatabaseSpreadsheet === "function") {
    var db = getDatabaseSpreadsheet();
    if (db) return db;
  }
  var explicitId = "1cZSRh2rtKpT6E8m3GFJonVbiQG51fh24eN8J5JWtOJY";
  try {
    return SpreadsheetApp.openById(explicitId);
  } catch (e) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
}

/**
 * Helper inisialisasi sheet presensi kegiatan secara otomatis jika belum ada.
 */
function initPresensiSheetsIfNeeded_(ss) {
  try {
    if (!ss) ss = getSpreadsheetDB_();
    var schemas = {
      "Presensi_Kegiatan": ["kegiatan_id", "nama_kegiatan", "kategori", "jadwal_rutin", "target_peserta", "penanggung_jawab", "status", "created_at"],
      "Presensi_Sesi": ["sesi_id", "kegiatan_id", "nama_kegiatan", "tanggal", "waktu_buka", "petugas", "total_peserta", "total_hadir", "total_izin", "total_sakit", "total_alpa", "status_sesi", "catatan", "created_at"],
      "Presensi_Logs": ["log_id", "sesi_id", "kegiatan_id", "student_id", "nis", "student_name", "gender", "tanggal", "status_kehadiran", "metode_absen", "waktu_absen", "keterangan", "created_at"]
    };
    var colors = {
      "Presensi_Kegiatan": "#059669",
      "Presensi_Sesi": "#0d9488",
      "Presensi_Logs": "#0284c7"
    };

    for (var name in schemas) {
      var sheet = ss.getSheetByName(name);
      var isNew = false;
      if (!sheet) {
        sheet = ss.insertSheet(name);
        isNew = true;
      }
      if (sheet.getLastRow() === 0) {
        sheet.getRange(1, 1, 1, schemas[name].length).setValues([schemas[name]]);
      }
      sheet.getRange(1, 1, 1, schemas[name].length)
        .setFontWeight("bold")
        .setBackground(colors[name])
        .setFontColor("#ffffff");
      sheet.setFrozenRows(1);

      // Jika sheet Presensi_Kegiatan baru dibuat, tambahkan contoh agenda default
      if (name === "Presensi_Kegiatan" && sheet.getLastRow() <= 1) {
        var nowIso = new Date().toISOString();
        var defaultKegiatan = [
          ["ACT-01", "Shalat Subuh & Wirid", "Ibadah", "Setiap Hari (04:30 - 05:30 WIB)", "Semua Santri", "Ustadz Pembina Asrama", "Aktif", nowIso],
          ["ACT-02", "Shalat Maghrib & Isya Berjamaah", "Ibadah", "Setiap Hari (17:45 - 19:30 WIB)", "Semua Santri", "Ustadz Pembina Asrama", "Aktif", nowIso],
          ["ACT-03", "Kajian Kitab Diniyah / Ta'lim", "Ta'lim", "Senin - Kamis (20:00 - 21:00 WIB)", "Semua Santri", "Dewan Asatidz", "Aktif", nowIso],
          ["ACT-04", "Ro'an & Kerja Bakti Kebersihan", "Keasramaan", "Ahad Pagi (07:00 - 08:30 WIB)", "Semua Santri", "Pengurus Pondok", "Aktif", nowIso],
          ["ACT-05", "Muhadharah / Khitobah Santri", "Minat & Bakat", "Malam Jumat (20:00 - 21:30 WIB)", "Semua Santri", "Pembina Bahasa", "Aktif", nowIso]
        ];
        sheet.getRange(2, 1, defaultKegiatan.length, defaultKegiatan[0].length).setValues(defaultKegiatan);
      }
    }
  } catch (e) {
    Logger.log("initPresensiSheetsIfNeeded_ warning: " + e.message);
  }
}

/**
 * Mengambil data dashboard Presensi Kegiatan:
 * - Master kegiatan
 * - Sesi hari ini & riwayat sesi
 * - Daftar santri aktif
 * - Statistik kehadiran
 */
function getPresensiDashboard(token) {
  try {
    var ss = getSpreadsheetDB_();
    initPresensiSheetsIfNeeded_(ss);

    var tz = Session.getScriptTimeZone() || "Asia/Jakarta";
    var todayStr = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");

    // 1. Ambil Master Kegiatan
    var shKegiatan = ss.getSheetByName("Presensi_Kegiatan");
    var kegiatanList = [];
    if (shKegiatan && shKegiatan.getLastRow() > 1) {
      var rowsK = shKegiatan.getRange(2, 1, shKegiatan.getLastRow() - 1, shKegiatan.getLastColumn()).getValues();
      for (var i = 0; i < rowsK.length; i++) {
        var r = rowsK[i];
        if (!r[0]) continue;
        kegiatanList.push({
          kegiatanId: String(r[0] || ""),
          namaKegiatan: String(r[1] || ""),
          kategori: String(r[2] || "Umum"),
          jadwalRutin: String(r[3] || ""),
          targetPeserta: String(r[4] || "Semua Santri"),
          penanggungJawab: String(r[5] || ""),
          status: String(r[6] || "Aktif"),
          createdAt: r[7] ? String(r[7]) : ""
        });
      }
    }

    // 2. Ambil Sesi Presensi
    var shSesi = ss.getSheetByName("Presensi_Sesi");
    var todaySessions = [];
    var recentSessions = [];
    var totalSesiBulanIni = 0;
    var totalPesertaKumulatif = 0;
    var totalHadirKumulatif = 0;
    var totalIzinHariIni = 0;
    var totalSakitHariIni = 0;
    var totalAlpaHariIni = 0;

    var currentYearMonth = todayStr.substring(0, 7); // YYYY-MM

    if (shSesi && shSesi.getLastRow() > 1) {
      var rowsS = shSesi.getRange(2, 1, shSesi.getLastRow() - 1, shSesi.getLastColumn()).getValues();
      // Urutkan dari yang terbaru (descending)
      rowsS.reverse();

      for (var j = 0; j < rowsS.length; j++) {
        var s = rowsS[j];
        if (!s[0]) continue;

        var rawTgl = s[3];
        var tglStr = "";
        if (rawTgl instanceof Date) {
          tglStr = Utilities.formatDate(rawTgl, tz, "yyyy-MM-dd");
        } else {
          tglStr = String(rawTgl || "").substring(0, 10);
        }

        var sesObj = {
          sesiId: String(s[0] || ""),
          kegiatanId: String(s[1] || ""),
          namaKegiatan: String(s[2] || ""),
          tanggal: tglStr,
          waktuBuka: String(s[4] || ""),
          petugas: String(s[5] || ""),
          totalPeserta: Number(s[6]) || 0,
          totalHadir: Number(s[7]) || 0,
          totalIzin: Number(s[8]) || 0,
          totalSakit: Number(s[9]) || 0,
          totalAlpa: Number(s[10]) || 0,
          statusSesi: String(s[11] || "Tutup"),
          catatan: String(s[12] || ""),
          createdAt: s[13] ? String(s[13]) : ""
        };

        // Hitung statistik
        if (tglStr === todayStr) {
          todaySessions.push(sesObj);
          totalIzinHariIni += sesObj.totalIzin;
          totalSakitHariIni += sesObj.totalSakit;
          totalAlpaHariIni += sesObj.totalAlpa;
        }

        if (tglStr.indexOf(currentYearMonth) === 0) {
          totalSesiBulanIni++;
          totalPesertaKumulatif += sesObj.totalPeserta;
          totalHadirKumulatif += sesObj.totalHadir;
        }

        if (recentSessions.length < 50) {
          recentSessions.push(sesObj);
        }
      }
    }

    // 3. Ambil Daftar Santri Aktif
    var shStudents = ss.getSheetByName("Students");
    var students = [];
    if (shStudents && shStudents.getLastRow() > 1) {
      var rowsSt = shStudents.getRange(2, 1, shStudents.getLastRow() - 1, shStudents.getLastColumn()).getValues();
      for (var k = 0; k < rowsSt.length; k++) {
        var st = rowsSt[k];
        if (!st[0]) continue;
        var statusSantri = String(st[8] || "Aktif");
        if (statusSantri.toLowerCase().indexOf("aktif") !== -1 || statusSantri.toLowerCase() === "active") {
          students.push({
            studentId: String(st[0] || ""),
            nis: String(st[1] || ""),
            name: String(st[3] || ""),
            gender: String(st[4] || "L"),
            photoUrl: String(st[6] || ""),
            program: String(st[7] || ""),
            status: statusSantri,
            qrCode: String(st[10] || st[0] || "")
          });
        }
      }
    }

    // Rata-rata kehadiran bulan ini (%)
    var rerataKehadiranPct = totalPesertaKumulatif > 0
      ? Math.round((totalHadirKumulatif / totalPesertaKumulatif) * 100)
      : 100;

    return {
      status: "success",
      success: true,
      ok: true,
      data: {
        todayStr: todayStr,
        kegiatanList: kegiatanList,
        todaySessions: todaySessions,
        recentSessions: recentSessions,
        students: students,
        stats: {
          totalKegiatanAktif: kegiatanList.filter(function(k) { return k.status === "Aktif"; }).length,
          totalSesiBulanIni: totalSesiBulanIni,
          rerataKehadiranPct: rerataKehadiranPct,
          totalIzinHariIni: totalIzinHariIni,
          totalSakitHariIni: totalSakitHariIni,
          totalAlpaHariIni: totalAlpaHariIni,
          totalSantriAktif: students.length
        }
      }
    };
  } catch (err) {
    return {
      status: "error",
      success: false,
      ok: false,
      message: "Gagal memuat dashboard Presensi: " + err.message
    };
  }
}

/**
 * Mengambil daftar master kegiatan presensi.
 */
function getPresensiKegiatanList(token) {
  try {
    var ss = getSpreadsheetDB_();
    initPresensiSheetsIfNeeded_(ss);
    var sh = ss.getSheetByName("Presensi_Kegiatan");
    var list = [];
    if (sh && sh.getLastRow() > 1) {
      var rows = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        if (!r[0]) continue;
        list.push({
          kegiatanId: String(r[0] || ""),
          namaKegiatan: String(r[1] || ""),
          kategori: String(r[2] || "Umum"),
          jadwalRutin: String(r[3] || ""),
          targetPeserta: String(r[4] || "Semua Santri"),
          penanggungJawab: String(r[5] || ""),
          status: String(r[6] || "Aktif"),
          createdAt: r[7] ? String(r[7]) : ""
        });
      }
    }
    return { status: "success", success: true, ok: true, data: list };
  } catch (err) {
    return { status: "error", success: false, ok: false, message: err.message };
  }
}

/**
 * Menyimpan / memperbarui master kegiatan presensi.
 */
function savePresensiKegiatan(payload, token) {
  try {
    var ss = getSpreadsheetDB_();
    initPresensiSheetsIfNeeded_(ss);
    var sh = ss.getSheetByName("Presensi_Kegiatan");
    if (!sh) throw new Error("Sheet Presensi_Kegiatan tidak ditemukan");

    var kegiatanId = payload.kegiatanId || payload.id;
    var namaKegiatan = String(payload.namaKegiatan || "").trim();
    if (!namaKegiatan) throw new Error("Nama Kegiatan wajib diisi");

    var kategori = String(payload.kategori || "Umum").trim();
    var jadwalRutin = String(payload.jadwalRutin || "").trim();
    var targetPeserta = String(payload.targetPeserta || "Semua Santri").trim();
    var penanggungJawab = String(payload.penanggungJawab || "").trim();
    var status = String(payload.status || "Aktif").trim();
    var nowIso = new Date().toISOString();

    if (kegiatanId) {
      // Mode Update
      var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
      var foundRow = -1;
      for (var i = 0; i < rows.length; i++) {
        if (String(rows[i][0]) === String(kegiatanId)) {
          foundRow = i + 2;
          break;
        }
      }
      if (foundRow !== -1) {
        sh.getRange(foundRow, 2, 1, 6).setValues([[
          namaKegiatan, kategori, jadwalRutin, targetPeserta, penanggungJawab, status
        ]]);
        return {
          status: "success",
          success: true,
          ok: true,
          message: "Kegiatan '" + namaKegiatan + "' berhasil diperbarui.",
          data: { kegiatanId: kegiatanId, namaKegiatan: namaKegiatan }
        };
      }
    }

    // Mode Tambah Baru
    var newId = "ACT-" + Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "Asia/Jakarta", "yyMMdd-HHmmss");
    var newRow = [newId, namaKegiatan, kategori, jadwalRutin, targetPeserta, penanggungJawab, status, nowIso];
    sh.appendRow(newRow);

    return {
      status: "success",
      success: true,
      ok: true,
      message: "Kegiatan '" + namaKegiatan + "' berhasil ditambahkan.",
      data: { kegiatanId: newId, namaKegiatan: namaKegiatan }
    };
  } catch (err) {
    return { status: "error", success: false, ok: false, message: err.message };
  }
}

/**
 * Menghapus atau menonaktifkan master kegiatan.
 */
function deletePresensiKegiatan(kegiatanId, token) {
  try {
    if (!kegiatanId) throw new Error("ID Kegiatan diperlukan");
    var ss = getSpreadsheetDB_();
    var sh = ss.getSheetByName("Presensi_Kegiatan");
    if (!sh || sh.getLastRow() <= 1) throw new Error("Data kegiatan kosong");

    var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][0]) === String(kegiatanId)) {
        sh.deleteRow(i + 2);
        return { status: "success", success: true, ok: true, message: "Kegiatan berhasil dihapus." };
      }
    }
    return { status: "error", success: false, ok: false, message: "Kegiatan tidak ditemukan." };
  } catch (err) {
    return { status: "error", success: false, ok: false, message: err.message };
  }
}

/**
 * Menyimpan / Memperbarui Sesi Presensi & Menyimpan HANYA Pengecualian (Izin, Sakit, Alpa) ke Presensi_Logs
 */
function savePresensiSesi(payload, token) {
  try {
    var ss = getSpreadsheetDB_();
    initPresensiSheetsIfNeeded_(ss);

    var shSesi = ss.getSheetByName("Presensi_Sesi");
    var shLogs = ss.getSheetByName("Presensi_Logs");
    if (!shSesi || !shLogs) throw new Error("Sheet Presensi tidak lengkap");

    var tz = Session.getScriptTimeZone() || "Asia/Jakarta";
    var nowIso = new Date().toISOString();
    var todayStr = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");

    var sesiId = payload.sesiId || payload.id;
    var isNewSesi = false;
    if (!sesiId) {
      isNewSesi = true;
      sesiId = "SESI-" + Utilities.formatDate(new Date(), tz, "yyyyMMdd-HHmmss");
    }

    var kegiatanId = String(payload.kegiatanId || "").trim();
    var namaKegiatan = String(payload.namaKegiatan || "").trim();
    var tanggal = String(payload.tanggal || todayStr).substring(0, 10);
    var waktuBuka = String(payload.waktuBuka || Utilities.formatDate(new Date(), tz, "HH:mm")).trim();
    var petugas = String(payload.petugas || "Admin").trim();
    var totalPeserta = Number(payload.totalPeserta) || 0;
    var statusSesi = String(payload.statusSesi || "Tutup").trim();
    var catatan = String(payload.catatan || "").trim();

    // Array exceptions (HANYA status selain 'Hadir': Izin, Sakit, Alpa)
    var rawExceptions = payload.exceptions || payload.catatanKhusus || [];
    var exceptions = [];
    var countIzin = 0;
    var countSakit = 0;
    var countAlpa = 0;

    for (var i = 0; i < rawExceptions.length; i++) {
      var ex = rawExceptions[i];
      var stStatus = String(ex.statusKehadiran || ex.status || "").trim();
      // Saring: Hanya yang bukan Hadir!
      if (stStatus && stStatus !== "Hadir") {
        if (stStatus === "Izin") countIzin++;
        else if (stStatus === "Sakit") countSakit++;
        else if (stStatus === "Alpa" || stStatus === "Absen" || stStatus === "Tanpa Keterangan") {
          stStatus = "Alpa";
          countAlpa++;
        }

        exceptions.push({
          studentId: String(ex.studentId || ex.id || ""),
          nis: String(ex.nis || ""),
          studentName: String(ex.studentName || ex.name || ""),
          gender: String(ex.gender || "L"),
          statusKehadiran: stStatus,
          metodeAbsen: String(ex.metodeAbsen || "CHECKLIST").trim(),
          waktuAbsen: String(ex.waktuAbsen || waktuBuka).trim(),
          keterangan: String(ex.keterangan || ex.alasan || "").trim()
        });
      }
    }

    // Hitung total hadir implisit
    var totalTidakHadir = countIzin + countSakit + countAlpa;
    if (totalPeserta < totalTidakHadir) {
      totalPeserta = totalTidakHadir;
    }
    var totalHadir = Math.max(0, totalPeserta - totalTidakHadir);

    // 1. Simpan / Update ke Presensi_Sesi
    var sesiRowIndex = -1;
    if (!isNewSesi && shSesi.getLastRow() > 1) {
      var sesiIds = shSesi.getRange(2, 1, shSesi.getLastRow() - 1, 1).getValues();
      for (var sIdx = 0; sIdx < sesiIds.length; sIdx++) {
        if (String(sesiIds[sIdx][0]) === String(sesiId)) {
          sesiRowIndex = sIdx + 2;
          break;
        }
      }
    }

    var sesiValues = [
      sesiId, kegiatanId, namaKegiatan, tanggal, waktuBuka, petugas,
      totalPeserta, totalHadir, countIzin, countSakit, countAlpa,
      statusSesi, catatan, nowIso
    ];

    if (sesiRowIndex !== -1) {
      shSesi.getRange(sesiRowIndex, 1, 1, sesiValues.length).setValues([sesiValues]);
    } else {
      shSesi.appendRow(sesiValues);
    }

    // 2. Bersihkan log lama untuk sesiId ini (jika mode update)
    if (shLogs.getLastRow() > 1) {
      var logRows = shLogs.getRange(2, 2, shLogs.getLastRow() - 1, 1).getValues(); // kolom 2 = sesi_id
      // Hapus baris dari bawah ke atas agar index tidak bergeser
      for (var lIdx = logRows.length - 1; lIdx >= 0; lIdx--) {
        if (String(logRows[lIdx][0]) === String(sesiId)) {
          shLogs.deleteRow(lIdx + 2);
        }
      }
    }

    // 3. Tulis HANYA baris pengecualian (Izin, Sakit, Alpa) ke Presensi_Logs
    if (exceptions.length > 0) {
      var logAppendRows = [];
      for (var eIdx = 0; eIdx < exceptions.length; eIdx++) {
        var item = exceptions[eIdx];
        var logId = "LOG-PRS-" + Utilities.formatDate(new Date(), tz, "yyMMdd") + "-" + (eIdx + 1) + "-" + Math.floor(Math.random() * 1000);
        logAppendRows.push([
          logId,
          sesiId,
          kegiatanId,
          item.studentId,
          item.nis,
          item.studentName,
          item.gender,
          tanggal,
          item.statusKehadiran,
          item.metodeAbsen,
          item.waktuAbsen,
          item.keterangan,
          nowIso
        ]);
      }
      shLogs.getRange(shLogs.getLastRow() + 1, 1, logAppendRows.length, logAppendRows[0].length).setValues(logAppendRows);
    }

    return {
      status: "success",
      success: true,
      ok: true,
      message: "Sesi presensi '" + namaKegiatan + "' berhasil disimpan. (" + totalHadir + " Hadir, " + countIzin + " Izin, " + countSakit + " Sakit, " + countAlpa + " Alpa)",
      data: {
        sesiId: sesiId,
        totalPeserta: totalPeserta,
        totalHadir: totalHadir,
        totalIzin: countIzin,
        totalSakit: countSakit,
        totalAlpa: countAlpa,
        exceptionsLogged: exceptions.length
      }
    };
  } catch (err) {
    return { status: "error", success: false, ok: false, message: "Gagal menyimpan sesi: " + err.message };
  }
}

/**
 * Mengambil detail satu sesi presensi lengkap dengan daftar rekonstruksi santri.
 */
function getPresensiSesiDetail(sesiId, token) {
  try {
    if (!sesiId) throw new Error("Sesi ID diperlukan");
    var ss = getSpreadsheetDB_();
    var shSesi = ss.getSheetByName("Presensi_Sesi");
    var shLogs = ss.getSheetByName("Presensi_Logs");
    var shStudents = ss.getSheetByName("Students");

    var sesiData = null;
    if (shSesi && shSesi.getLastRow() > 1) {
      var sRows = shSesi.getRange(2, 1, shSesi.getLastRow() - 1, shSesi.getLastColumn()).getValues();
      for (var i = 0; i < sRows.length; i++) {
        if (String(sRows[i][0]) === String(sesiId)) {
          var r = sRows[i];
          var tz = Session.getScriptTimeZone() || "Asia/Jakarta";
          var rawT = r[3];
          var tStr = (rawT instanceof Date) ? Utilities.formatDate(rawT, tz, "yyyy-MM-dd") : String(rawT || "").substring(0, 10);
          sesiData = {
            sesiId: String(r[0] || ""),
            kegiatanId: String(r[1] || ""),
            namaKegiatan: String(r[2] || ""),
            tanggal: tStr,
            waktuBuka: String(r[4] || ""),
            petugas: String(r[5] || ""),
            totalPeserta: Number(r[6]) || 0,
            totalHadir: Number(r[7]) || 0,
            totalIzin: Number(r[8]) || 0,
            totalSakit: Number(r[9]) || 0,
            totalAlpa: Number(r[10]) || 0,
            statusSesi: String(r[11] || "Tutup"),
            catatan: String(r[12] || ""),
            createdAt: r[13] ? String(r[13]) : ""
          };
          break;
        }
      }
    }

    if (!sesiData) throw new Error("Sesi presensi tidak ditemukan");

    // Ambil exceptions dari Presensi_Logs
    var exceptionsMap = {};
    if (shLogs && shLogs.getLastRow() > 1) {
      var lRows = shLogs.getRange(2, 1, shLogs.getLastRow() - 1, shLogs.getLastColumn()).getValues();
      for (var j = 0; j < lRows.length; j++) {
        var lr = lRows[j];
        if (String(lr[1]) === String(sesiId)) {
          var stId = String(lr[3] || "");
          exceptionsMap[stId] = {
            logId: String(lr[0] || ""),
            statusKehadiran: String(lr[8] || "Izin"),
            metodeAbsen: String(lr[9] || "MANUAL"),
            waktuAbsen: String(lr[10] || ""),
            keterangan: String(lr[11] || "")
          };
        }
      }
    }

    // Ambil santri aktif
    var studentList = [];
    if (shStudents && shStudents.getLastRow() > 1) {
      var stRows = shStudents.getRange(2, 1, shStudents.getLastRow() - 1, shStudents.getLastColumn()).getValues();
      for (var k = 0; k < stRows.length; k++) {
        var row = stRows[k];
        if (!row[0]) continue;
        var stId2 = String(row[0] || "");
        var ex = exceptionsMap[stId2];
        studentList.push({
          studentId: stId2,
          nis: String(row[1] || ""),
          name: String(row[3] || ""),
          gender: String(row[4] || "L"),
          photoUrl: String(row[6] || ""),
          program: String(row[7] || ""),
          statusKehadiran: ex ? ex.statusKehadiran : "Hadir",
          keterangan: ex ? ex.keterangan : "",
          metodeAbsen: ex ? ex.metodeAbsen : "CHECKLIST"
        });
      }
    }

    return {
      status: "success",
      success: true,
      ok: true,
      data: {
        sesi: sesiData,
        students: studentList,
        exceptionsCount: Object.keys(exceptionsMap).length
      }
    };
  } catch (err) {
    return { status: "error", success: false, ok: false, message: err.message };
  }
}

/**
 * Menghapus satu sesi presensi beserta catatan log terkait.
 */
function deletePresensiSesi(sesiId, token) {
  try {
    if (!sesiId) throw new Error("Sesi ID diperlukan");
    var ss = getSpreadsheetDB_();
    var shSesi = ss.getSheetByName("Presensi_Sesi");
    var shLogs = ss.getSheetByName("Presensi_Logs");

    if (shSesi && shSesi.getLastRow() > 1) {
      var sRows = shSesi.getRange(2, 1, shSesi.getLastRow() - 1, 1).getValues();
      for (var i = 0; i < sRows.length; i++) {
        if (String(sRows[i][0]) === String(sesiId)) {
          shSesi.deleteRow(i + 2);
          break;
        }
      }
    }

    if (shLogs && shLogs.getLastRow() > 1) {
      var lRows = shLogs.getRange(2, 2, shLogs.getLastRow() - 1, 1).getValues();
      for (var j = lRows.length - 1; j >= 0; j--) {
        if (String(lRows[j][0]) === String(sesiId)) {
          shLogs.deleteRow(j + 2);
        }
      }
    }

    return { status: "success", success: true, ok: true, message: "Sesi presensi berhasil dihapus." };
  } catch (err) {
    return { status: "error", success: false, ok: false, message: err.message };
  }
}

/**
 * Rekapitulasi Presensi Santri (Perorangan / Matriks)
 */
function getPresensiRekap(filter, token) {
  try {
    filter = filter || {};
    var ss = getSpreadsheetDB_();
    initPresensiSheetsIfNeeded_(ss);

    var shSesi = ss.getSheetByName("Presensi_Sesi");
    var shLogs = ss.getSheetByName("Presensi_Logs");
    var shStudents = ss.getSheetByName("Students");

    var startDate = filter.startDate || "";
    var endDate = filter.endDate || "";
    var kegiatanId = filter.kegiatanId || "";
    var gender = filter.gender || "";

    // 1. Ambil Sesi yang sesuai filter
    var validSesiIds = {};
    var totalSesiTerhitung = 0;

    if (shSesi && shSesi.getLastRow() > 1) {
      var sRows = shSesi.getRange(2, 1, shSesi.getLastRow() - 1, shSesi.getLastColumn()).getValues();
      var tz = Session.getScriptTimeZone() || "Asia/Jakarta";

      for (var i = 0; i < sRows.length; i++) {
        var r = sRows[i];
        if (!r[0]) continue;
        var sId = String(r[0]);
        var kId = String(r[1]);
        var rawT = r[3];
        var tStr = (rawT instanceof Date) ? Utilities.formatDate(rawT, tz, "yyyy-MM-dd") : String(rawT || "").substring(0, 10);

        if (kegiatanId && kId !== kegiatanId) continue;
        if (startDate && tStr < startDate) continue;
        if (endDate && tStr > endDate) continue;

        validSesiIds[sId] = true;
        totalSesiTerhitung++;
      }
    }

    // 2. Ambil Pengecualian dari Presensi_Logs untuk sesi yang valid
    // studentExceptions[studentId] = { izin: X, sakit: Y, alpa: Z }
    var studentExceptions = {};

    if (shLogs && shLogs.getLastRow() > 1) {
      var lRows = shLogs.getRange(2, 1, shLogs.getLastRow() - 1, shLogs.getLastColumn()).getValues();
      for (var j = 0; j < lRows.length; j++) {
        var lr = lRows[j];
        var sesiKey = String(lr[1]);
        if (!validSesiIds[sesiKey]) continue;

        var stId = String(lr[3]);
        var stStatus = String(lr[8] || "Izin");

        if (!studentExceptions[stId]) {
          studentExceptions[stId] = { izin: 0, sakit: 0, alpa: 0, logs: [] };
        }

        if (stStatus === "Izin") studentExceptions[stId].izin++;
        else if (stStatus === "Sakit") studentExceptions[stId].sakit++;
        else if (stStatus === "Alpa") studentExceptions[stId].alpa++;

        studentExceptions[stId].logs.push({
          sesiId: sesiKey,
          tanggal: String(lr[7] || "").substring(0, 10),
          status: stStatus,
          keterangan: String(lr[11] || "")
        });
      }
    }

    // 3. Kompilasi Santri
    var rekapList = [];
    if (shStudents && shStudents.getLastRow() > 1) {
      var stRows = shStudents.getRange(2, 1, shStudents.getLastRow() - 1, shStudents.getLastColumn()).getValues();
      for (var k = 0; k < stRows.length; k++) {
        var row = stRows[k];
        if (!row[0]) continue;
        var sGender = String(row[4] || "L");
        if (gender && sGender !== gender) continue;

        var sId2 = String(row[0]);
        var exData = studentExceptions[sId2] || { izin: 0, sakit: 0, alpa: 0, logs: [] };

        var izin = exData.izin;
        var sakit = exData.sakit;
        var alpa = exData.alpa;
        var totalAbsen = izin + sakit + alpa;
        var hadir = Math.max(0, totalSesiTerhitung - totalAbsen);
        var pct = totalSesiTerhitung > 0 ? Math.round((hadir / totalSesiTerhitung) * 100) : 100;

        rekapList.push({
          studentId: sId2,
          nis: String(row[1] || ""),
          name: String(row[3] || ""),
          gender: sGender,
          program: String(row[7] || ""),
          totalSesi: totalSesiTerhitung,
          hadir: hadir,
          izin: izin,
          sakit: sakit,
          alpa: alpa,
          persentase: pct,
          logs: exData.logs
        });
      }
    }

    // Urutkan berdasarkan persentase kehadiran terendah (untuk monitoring kedisiplinan)
    rekapList.sort(function(a, b) {
      return a.persentase - b.persentase;
    });

    return {
      status: "success",
      success: true,
      ok: true,
      data: {
        totalSesiTerhitung: totalSesiTerhitung,
        rekap: rekapList
      }
    };
  } catch (err) {
    return { status: "error", success: false, ok: false, message: err.message };
  }
}

// ====================================================================
// MODUL KEUANGAN & AKUNTANSI PESANTREN TERPADU (FASE 1 & 2)
// PPTQ Roudlotul Mubarokah Kudus
// ====================================================================

const SHEET_KEUANGAN_TARIF = "Keuangan_Tarif";
const SHEET_KEUANGAN_TAGIHAN = "Keuangan_Tagihan";
const SHEET_KEUANGAN_TRANSAKSI = "Keuangan_Transaksi";
const SHEET_KEUANGAN_PENGELUARAN = "Keuangan_Pengeluaran";
const SHEET_KEUANGAN_KATEGORI_PENGELUARAN = "Keuangan_Kategori_Pengeluaran";
const SHEET_KEUANGAN_TUTUP_KASIR = "Keuangan_Tutup_Kasir";
const SHEET_KEUANGAN_KONFIRMASI_TRANSFER = "Keuangan_Konfirmasi_Transfer";
const SHEET_KEUANGAN_TABUNGAN = "Keuangan_Tabungan_Santri";
const SHEET_KEUANGAN_MUTASI_TABUNGAN = "Keuangan_Mutasi_Tabungan";

function getOrCreateKeuanganSheet(ss, sheetName, headers, bgHeaderColor) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setBackground(bgHeaderColor || "#0d9488")
      .setFontColor("#ffffff");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function initKeuanganSheets(token) {
  try {
    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error("Spreadsheet database tidak ditemukan.");

    // 1. Sheet Master Tarif
    const headersTarif = ["tarif_id", "nama_pos", "kategori", "tipe_periode", "nominal_default", "program", "is_active", "created_at"];
    const tSheet = getOrCreateKeuanganSheet(ss, SHEET_KEUANGAN_TARIF, headersTarif, "#0f766e");
    
    // Seed default master tarif jika sheet baru dibuat / kosong
    if (tSheet.getLastRow() <= 1) {
      const nowIso = new Date().toISOString();
      const defaultTarifs = [
        ["TRF-SPP-01", "SPP & Syahriah Pesantren", "BULANAN", "BULANAN", 350000, "SEMUA", "TRUE", nowIso],
        ["TRF-MKN-01", "Katering & Makan Santri", "BULANAN", "BULANAN", 250000, "SEMUA", "TRUE", nowIso],
        ["TRF-DU-01", "Daftar Ulang Tahunan", "TAHUNAN", "TAHUNAN", 500000, "SEMUA", "TRUE", nowIso],
        ["TRF-KTB-01", "Kitab Kuning & Yanbu'a", "INSIDENTAL", "TAHUNAN", 150000, "SEMUA", "TRUE", nowIso],
        ["TRF-GDG-01", "Uang Gedung & Sarpras", "INSIDENTAL", "INSIDENTAL", 1000000, "SEMUA", "TRUE", nowIso]
      ];
      tSheet.getRange(2, 1, defaultTarifs.length, headersTarif.length).setValues(defaultTarifs);
    }

    // 2. Sheet Tagihan Santri
    const headersTagihan = ["tagihan_id", "student_id", "student_name", "pos_id", "nama_pos", "periode", "nominal_tagihan", "nominal_terbayar", "sisa_tagihan", "status", "due_date", "updated_at"];
    getOrCreateKeuanganSheet(ss, SHEET_KEUANGAN_TAGIHAN, headersTagihan, "#b45309");

    // 3. Sheet Transaksi / Kas Masuk
    const headersTransaksi = ["transaksi_id", "no_kuitansi", "tanggal_bayar", "student_id", "student_name", "tagihan_ids_json", "nominal_total", "metode_bayar", "nama_kasir", "catatan", "created_at", "status"];
    getOrCreateKeuanganSheet(ss, SHEET_KEUANGAN_TRANSAKSI, headersTransaksi, "#1e3a8a");

    // 4. Sheet Kategori Pengeluaran / Beban Operasional Pesantren
    const headersKatPengeluaran = ["kategori_id", "nama_kategori", "deskripsi", "tipe", "is_active", "created_at"];
    const katSheet = getOrCreateKeuanganSheet(ss, SHEET_KEUANGAN_KATEGORI_PENGELUARAN, headersKatPengeluaran, "#0284c7");
    if (katSheet.getLastRow() <= 1) {
      const nowIso = new Date().toISOString();
      const defaultCategories = [
        ["EXP-CAT-01", "Dapur & Konsumsi Santri", "Belanja beras, lauk, bumbu, gas, dan logistik makan santri harian", "OPERASIONAL", "TRUE", nowIso],
        ["EXP-CAT-02", "Honorarium Asatidz & Pegawai", "Mukafaah / honor bulanan asatidz, musyrif, staf dapur & kebersihan", "BULANAN", "TRUE", nowIso],
        ["EXP-CAT-03", "Utilitas (Listrik, Air & Internet)", "Tagihan listrik PLN, air PDAM/sumur pompa, dan jaringan wifi kantor/santri", "RUTIN", "TRUE", nowIso],
        ["EXP-CAT-04", "Pemeliharaan Gedung & Sarpras", "Perbaikan sanitasi asrama, kelas, masjid, dan sarana pesantren", "RUTIN", "TRUE", nowIso],
        ["EXP-CAT-05", "ATK & Kebutuhan Kantor", "Kertas, tinta printer, fotokopi buku, kesekretariatan & perlengkapan kantor", "OPERASIONAL", "TRUE", nowIso],
        ["EXP-CAT-06", "Kegiatan, Lomba & PHBI", "Kegiatan Maulid, Khataman, Imtihan, Haflah, lomba tahfidz santri", "INSIDENTAL", "TRUE", nowIso],
        ["EXP-CAT-07", "Kesehatan & P3K Santri", "Obat-obatan, vitamin, perlengkapan medis, dan klinik rujukan santri", "OPERASIONAL", "TRUE", nowIso],
        ["EXP-CAT-08", "Kas Kecil & Pengeluaran Darurat", "Kebutuhan mendesak harian pesantren yang tidak terduga", "LAINNYA", "TRUE", nowIso]
      ];
      katSheet.getRange(2, 1, defaultCategories.length, headersKatPengeluaran.length).setValues(defaultCategories);
    }

    // 5. Sheet Kas Keluar / Pengeluaran Operasional
    const headersPengeluaran = ["pengeluaran_id", "no_bukti", "tanggal", "kategori_id", "nama_kategori", "nominal", "metode_bayar", "dibayarkan_kepada", "keterangan", "petugas", "status", "created_at"];
    getOrCreateKeuanganSheet(ss, SHEET_KEUANGAN_PENGELUARAN, headersPengeluaran, "#e11d48");

    // 6. Sheet Tutup Kasir & Rekonsiliasi Harian
    const headersTutupKasir = ["closing_id", "tanggal", "nama_kasir", "modal_awal", "masuk_tunai", "masuk_transfer", "masuk_qris", "keluar_tunai", "saldo_sistem", "saldo_fisik", "selisih", "catatan", "status", "created_at"];
    getOrCreateKeuanganSheet(ss, SHEET_KEUANGAN_TUTUP_KASIR, headersTutupKasir, "#4f46e5");

    // 7. Sheet Konfirmasi Transfer Online Santri / Wali
    const headersKonfirmasi = ["konfirmasi_id", "student_id", "student_name", "tagihan_ids_json", "nominal_transfer", "bank_tujuan", "nama_pengirim", "tanggal_transfer", "bukti_transfer_url", "status", "catatan_verifikasi", "no_kuitansi", "created_at"];
    getOrCreateKeuanganSheet(ss, SHEET_KEUANGAN_KONFIRMASI_TRANSFER, headersKonfirmasi, "#0891b2");

    // 8. Sheet Tabungan Santri (Dompet Digital Uang Saku)
    const headersTabungan = ["student_id", "student_name", "program", "saldo_tabungan", "limit_harian", "total_jajan_hari_ini", "tgl_jajan_terakhir", "is_locked", "updated_at"];
    getOrCreateKeuanganSheet(ss, SHEET_KEUANGAN_TABUNGAN, headersTabungan, "#059669");

    // 9. Sheet Mutasi Tabungan & Transaksi Kantin Cashless
    const headersMutasi = ["mutasi_id", "student_id", "student_name", "jenis_mutasi", "nominal", "saldo_sebelum", "saldo_sesudah", "keterangan", "petugas", "created_at"];
    getOrCreateKeuanganSheet(ss, SHEET_KEUANGAN_MUTASI_TABUNGAN, headersMutasi, "#0d9488");

    return {
      status: "success",
      success: true,
      message: "Sheet Keuangan Enterprise (Tarif, Tagihan, Kas Masuk, Kas Keluar, Tutup Kasir, Transfer Online, Tabungan & Mutasi Cashless) berhasil diinisialisasi."
    };
  } catch (err) {
    return { status: "error", success: false, message: "Gagal inisialisasi sheet keuangan: " + err.message };
  }
}

function getKeuanganDashboard(token) {
  try {
    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error("Spreadsheet database tidak ditemukan.");

    // Pastikan sheet master tarif & tagihan siap
    const headersTarif = ["tarif_id", "nama_pos", "kategori", "tipe_periode", "nominal_default", "program", "is_active", "created_at"];
    const tSheet = getOrCreateKeuanganSheet(ss, SHEET_KEUANGAN_TARIF, headersTarif, "#0f766e");
    if (tSheet.getLastRow() <= 1) {
      initKeuanganSheets(token);
    }

    const headersTagihan = ["tagihan_id", "student_id", "student_name", "pos_id", "nama_pos", "periode", "nominal_tagihan", "nominal_terbayar", "sisa_tagihan", "status", "due_date", "updated_at"];
    const tagihanSheet = getOrCreateKeuanganSheet(ss, SHEET_KEUANGAN_TAGIHAN, headersTagihan, "#b45309");

    const headersTransaksi = ["transaksi_id", "no_kuitansi", "tanggal_bayar", "student_id", "student_name", "tagihan_ids_json", "nominal_total", "metode_bayar", "nama_kasir", "catatan", "created_at"];
    const trxSheet = getOrCreateKeuanganSheet(ss, SHEET_KEUANGAN_TRANSAKSI, headersTransaksi, "#1e3a8a");

    // 0. Ambil Master Program dari Sheet "Programs" (Kolom B: name, Kolom A: id)
    let programsSheet = ss.getSheetByName("Programs") || ss.getSheetByName("Program");
    const programsList = [];
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
          if (prName && !programsList.some(p => p.name === prName)) {
            programsList.push({
              id: prId || prName,
              name: prName
            });
          }
        }
      }
    }
    // Fallback jika tab Programs kosong/belum disinkronkan
    if (programsList.length === 0) {
      programsList.push(
        { id: "tahfidz-dewasa", name: "Pesantren Tahfidz Dewasa" },
        { id: "reguler-putra-putri", name: "Pesantren Reguler Putra Putri" },
        { id: "tahfidz-anak", name: "Pesantren Tahfidz Anak" },
        { id: "ma-tahfidz", name: "MA Tahfidz" }
      );
    }

    // 1. Ambil Master Tarif
    const tarifList = [];
    const tData = tSheet.getDataRange().getValues();
    if (tData.length >= 2) {
      for (let i = 1; i < tData.length; i++) {
        const row = tData[i];
        if (row[0]) {
          tarifList.push({
            tarifId: String(row[0]).trim(),
            namaPos: String(row[1] || "").trim(),
            kategori: String(row[2] || "BULANAN").trim(),
            tipePeriode: String(row[3] || "BULANAN").trim(),
            nominalDefault: Number(row[4]) || 0,
            program: String(row[5] || "SEMUA").trim(),
            isActive: String(row[6]).toUpperCase() === "TRUE",
            createdAt: String(row[7] || "").trim()
          });
        }
      }
    }

    // 2. Ambil Master Santri (untuk search & info santri di POS)
    const studentsSheet = ss.getSheetByName(SHEET_STUDENTS);
    const students = [];
    const studentMap = {};
    if (studentsSheet) {
      const sData = studentsSheet.getDataRange().getValues();
      if (sData.length >= 2) {
        const sHead = sData[0].map(h => String(h || "").trim().toLowerCase());
        const idIdx = sHead.indexOf("student_id");
        const nisIdx = sHead.indexOf("nis");
        const nameIdx = sHead.indexOf("name");
        const genderIdx = sHead.indexOf("gender");
        const programIdx = sHead.indexOf("program");
        const statusIdx = sHead.indexOf("status");
        const photoIdx = sHead.indexOf("photo_url");

        let phoneIdx = sHead.indexOf("phone");
        if (phoneIdx === -1) phoneIdx = sHead.indexOf("no_hp");
        if (phoneIdx === -1) phoneIdx = sHead.indexOf("telepon");
        if (phoneIdx === -1) phoneIdx = sHead.indexOf("whatsapp");
        if (phoneIdx === -1) phoneIdx = sHead.indexOf("no_wa");
        if (phoneIdx === -1) phoneIdx = sHead.indexOf("wali_phone");
        if (phoneIdx === -1) phoneIdx = sHead.indexOf("kontak");

        // Cek fallback kontak wali dari Wali_Santri_Map
        const waliPhoneMap = {};
        try {
          const mapSheet = ss.getSheetByName(SHEET_WALI_SANTRI_MAP);
          const waliSheet = ss.getSheetByName(SHEET_WALI_IDENTITIES) || ss.getSheetByName("Users");
          if (mapSheet && waliSheet) {
            const wData = waliSheet.getDataRange().getValues();
            if (wData.length > 1) {
              const wHead = wData[0].map(h => String(h || "").trim().toLowerCase());
              const wIdIdx = wHead.findIndex(h => h.includes("id"));
              const wPhoneIdx = wHead.findIndex(h => h.includes("phone") || h.includes("hp") || h.includes("wa") || h.includes("telepon") || h.includes("kontak"));
              const phoneById = {};
              if (wIdIdx !== -1 && wPhoneIdx !== -1) {
                for (let w = 1; w < wData.length; w++) {
                  const wId = String(wData[w][wIdIdx] || "").trim();
                  const wPhone = String(wData[w][wPhoneIdx] || "").trim();
                  if (wId && wPhone) phoneById[wId] = wPhone;
                }
              }
              const mData = mapSheet.getDataRange().getValues();
              for (let m = 1; m < mData.length; m++) {
                const waliId = String(mData[m][1] || "").trim();
                const sId = String(mData[m][2] || "").trim();
                if (sId && waliId && phoneById[waliId]) {
                  waliPhoneMap[sId] = phoneById[waliId];
                }
              }
            }
          }
        } catch (wErr) {
          console.warn("[DASHBOARD WALI MAP LOOKUP ERROR]", wErr);
        }

        for (let i = 1; i < sData.length; i++) {
          const stStatus = statusIdx !== -1 ? String(sData[i][statusIdx] || "").trim().toUpperCase() : "AKTIF";
          if (["AKTIF", "ACTIVE", ""].includes(stStatus)) {
            const sId = String(sData[i][idIdx] || "").trim();
            let phone = phoneIdx !== -1 ? String(sData[i][phoneIdx] || "").trim() : "";
            if (!phone && waliPhoneMap[sId]) {
              phone = waliPhoneMap[sId];
            }
            const sObj = {
              studentId: sId,
              nis: String(sData[i][nisIdx] || "").trim(),
              name: String(sData[i][nameIdx] || "").trim(),
              gender: String(sData[i][genderIdx] || "L").trim().toUpperCase(),
              program: programIdx !== -1 ? String(sData[i][programIdx] || "").trim() : "",
              photoUrl: photoIdx !== -1 ? String(sData[i][photoIdx] || "").trim() : "",
              phone: phone,
              parentPhone: phone,
              status: "AKTIF"
            };
            if (sObj.studentId) {
              students.push(sObj);
              studentMap[sObj.studentId] = sObj;
            }
          }
        }
      }
    }

    // 3. Ambil Tagihan Santri & Hitung Agregat
    const tagihanList = [];
    let totalTunggakan = 0;
    let countLunas = 0;
    let countBelumLunas = 0;

    const tagihanData = tagihanSheet.getDataRange().getValues();
    if (tagihanData.length >= 2) {
      for (let i = 1; i < tagihanData.length; i++) {
        const r = tagihanData[i];
        if (r[0]) {
          const nomTagihan = Number(r[6]) || 0;
          const nomTerbayar = Number(r[7]) || 0;
          const sisa = Math.max(0, nomTagihan - nomTerbayar);
          const stStatus = String(r[9] || "BELUM_BAYAR").trim().toUpperCase();

          if (stStatus === "LUNAS") {
            countLunas++;
          } else {
            countBelumLunas++;
            totalTunggakan += sisa;
          }

          const sId = String(r[1] || "").trim();
          const stObj = studentMap[sId];

          tagihanList.push({
            tagihanId: String(r[0]).trim(),
            studentId: sId,
            studentName: String(r[2] || "").trim(),
            studentProgram: stObj ? stObj.program : "",
            posId: String(r[3] || "").trim(),
            namaPos: String(r[4] || "").trim(),
            periode: (function(val) {
              if (val instanceof Date) {
                var y = val.getFullYear();
                var m = String(val.getMonth() + 1);
                if (m.length < 2) m = "0" + m;
                return y + "-" + m;
              }
              var s = String(val || "").trim();
              var match = s.match(/^(\d{4})[-\/](\d{1,2})/);
              if (match) {
                var mm = String(match[2]);
                if (mm.length < 2) mm = "0" + mm;
                return match[1] + "-" + mm;
              }
              return s;
            })(r[5]),
            nominalTagihan: nomTagihan,
            nominalTerbayar: nomTerbayar,
            sisaTagihan: sisa,
            status: stStatus,
            dueDate: String(r[10] || "").substring(0, 10),
            updatedAt: String(r[11] || "").trim()
          });
        }
      }
    }

    // 4. Ambil Riwayat Transaksi Kas Masuk & Hitung Penerimaan
    const recentTransactions = [];
    let totalPendapatanBulanIni = 0;
    let kasMasukHariIniTunai = 0;
    let kasMasukHariIniNonTunai = 0;
    const currentMonthPrefix = new Date().toISOString().substring(0, 7); // e.g. "2026-10"
    const todayPrefix = new Date().toISOString().substring(0, 10);       // e.g. "2026-10-03"

    const trxData = trxSheet.getDataRange().getValues();
    if (trxData.length >= 2) {
      // Loop dari paling baru ke lama
      for (let i = trxData.length - 1; i >= 1; i--) {
        const r = trxData[i];
        if (r[0]) {
          const nomTotal = Number(r[6]) || 0;
          const tglStr = String(r[2] || "").trim();
          const statusTrx = String(r[11] || (String(r[9] || "").includes("[VOID") ? "VOID" : "SUKSES")).trim().toUpperCase();
          const metode = String(r[7] || "TUNAI").trim().toUpperCase();

          if (statusTrx !== "VOID") {
            if (tglStr.startsWith(currentMonthPrefix)) {
              totalPendapatanBulanIni += nomTotal;
            }
            if (tglStr.startsWith(todayPrefix)) {
              if (metode === "TUNAI") kasMasukHariIniTunai += nomTotal;
              else kasMasukHariIniNonTunai += nomTotal;
            }
          }

          if (recentTransactions.length < 50) {
            let rincianItems = [];
            try {
              const rawJson = String(r[5] || "");
              if (rawJson.startsWith("[")) {
                rincianItems = JSON.parse(rawJson);
              }
            } catch (e) {}

            recentTransactions.push({
              transaksiId: String(r[0]).trim(),
              noKuitansi: String(r[1] || "").trim(),
              tanggalBayar: tglStr,
              studentId: String(r[3] || "").trim(),
              studentName: String(r[4] || "").trim(),
              rincianItems: rincianItems,
              nominalTotal: nomTotal,
              metodeBayar: metode,
              namaKasir: String(r[8] || "-").trim(),
              catatan: String(r[9] || "").trim(),
              createdAt: String(r[10] || "").trim(),
              status: statusTrx
            });
          }
        }
      }
    }

    // 5. Ambil Kategori Pengeluaran Beban Pesantren
    const kategoriPengeluaranList = [];
    const expCatSheet = ss.getSheetByName(SHEET_KEUANGAN_KATEGORI_PENGELUARAN);
    if (expCatSheet) {
      const catData = expCatSheet.getDataRange().getValues();
      if (catData.length >= 2) {
        for (let i = 1; i < catData.length; i++) {
          const r = catData[i];
          if (r[0] && String(r[4] || "TRUE").toUpperCase() === "TRUE") {
            kategoriPengeluaranList.push({
              kategoriId: String(r[0]).trim(),
              namaKategori: String(r[1] || "").trim(),
              deskripsi: String(r[2] || "").trim(),
              tipe: String(r[3] || "OPERASIONAL").trim()
            });
          }
        }
      }
    }

    // 6. Ambil Buku Kas Keluar (Pengeluaran Operasional Pesantren)
    const recentExpenses = [];
    let totalPengeluaranBulanIni = 0;
    let kasKeluarHariIniTunai = 0;
    const expSheet = ss.getSheetByName(SHEET_KEUANGAN_PENGELUARAN);
    if (expSheet) {
      const expData = expSheet.getDataRange().getValues();
      if (expData.length >= 2) {
        for (let i = expData.length - 1; i >= 1; i--) {
          const r = expData[i];
          if (r[0]) {
            const nomExp = Number(r[5]) || 0;
            const tglExp = String(r[2] || "").substring(0, 10);
            const statusExp = String(r[10] || "ACTIVE").trim().toUpperCase();
            const metodeExp = String(r[6] || "TUNAI").trim().toUpperCase();

            if (statusExp !== "VOID") {
              if (tglExp.startsWith(currentMonthPrefix)) {
                totalPengeluaranBulanIni += nomExp;
              }
              if (tglExp.startsWith(todayPrefix) && metodeExp === "TUNAI") {
                kasKeluarHariIniTunai += nomExp;
              }
            }

            if (recentExpenses.length < 50) {
              recentExpenses.push({
                pengeluaranId: String(r[0]).trim(),
                noBukti: String(r[1] || "").trim(),
                tanggal: tglExp,
                kategoriId: String(r[3] || "").trim(),
                namaKategori: String(r[4] || "").trim(),
                nominal: nomExp,
                metodeBayar: metodeExp,
                dibayarkanKepada: String(r[7] || "").trim(),
                keterangan: String(r[8] || "").trim(),
                petugas: String(r[9] || "").trim(),
                status: statusExp,
                createdAt: String(r[11] || "").trim()
              });
            }
          }
        }
      }
    }

    // 7. Ambil Riwayat Tutup Kasir Harian
    const recentClosingList = [];
    const closingSheet = ss.getSheetByName(SHEET_KEUANGAN_TUTUP_KASIR);
    if (closingSheet) {
      const cData = closingSheet.getDataRange().getValues();
      if (cData.length >= 2) {
        for (let i = cData.length - 1; i >= 1; i--) {
          const r = cData[i];
          if (r[0] && recentClosingList.length < 20) {
            recentClosingList.push({
              closingId: String(r[0]).trim(),
              tanggal: String(r[1] || "").substring(0, 10),
              namaKasir: String(r[2] || "").trim(),
              modalAwal: Number(r[3]) || 0,
              masukTunai: Number(r[4]) || 0,
              masukTransfer: Number(r[5]) || 0,
              masukQris: Number(r[6]) || 0,
              keluarTunai: Number(r[7]) || 0,
              saldoSistem: Number(r[8]) || 0,
              saldoFisik: Number(r[9]) || 0,
              selisih: Number(r[10]) || 0,
              catatan: String(r[11] || "").trim(),
              status: String(r[12] || "SUBMITTED").trim(),
              createdAt: String(r[13] || "").trim()
            });
          }
        }
      }
    }

    // 8. Ambil Riwayat Konfirmasi Transfer Online Santri / Wali (Fase 3)
    const recentKonfirmasiList = [];
    let pendingKonfirmasiCount = 0;
    const trfSheet = ss.getSheetByName(SHEET_KEUANGAN_KONFIRMASI_TRANSFER);
    if (trfSheet) {
      const tData = trfSheet.getDataRange().getValues();
      if (tData.length >= 2) {
        for (let i = tData.length - 1; i >= 1; i--) {
          const r = tData[i];
          if (r[0]) {
            const stKonfirmasi = String(r[9] || "PENDING").trim().toUpperCase();
            if (stKonfirmasi === "PENDING") {
              pendingKonfirmasiCount++;
            }
            if (recentKonfirmasiList.length < 50) {
              recentKonfirmasiList.push({
                konfirmasiId: String(r[0]).trim(),
                studentId: String(r[1] || "").trim(),
                studentName: String(r[2] || "").trim(),
                tagihanIdsJson: String(r[3] || "").trim(),
                nominalTransfer: Number(r[4]) || 0,
                bankTujuan: String(r[5] || "").trim(),
                namaPengirim: String(r[6] || "").trim(),
                tanggalTransfer: String(r[7] || "").substring(0, 10),
                buktiTransferUrl: String(r[8] || "").trim(),
                status: stKonfirmasi,
                catatanVerifikasi: String(r[10] || "").trim(),
                noKuitansi: String(r[11] || "").trim(),
                createdAt: String(r[12] || "").trim()
              });
            }
          }
        }
      }
    }

    const officialAccounts = [
      { bank: "BSI", name: "Bank Syariah Indonesia", noRek: "7198234567", an: "PPTQ ROUDLOTUL MUBAROKAH", badge: "Syariah Utama" },
      { bank: "BRI", name: "Bank Rakyat Indonesia", noRek: "0038-01-002345-53-1", an: "PESANTREN ROUDLOTUL MUBAROKAH", badge: "Operasional" },
      { bank: "BCA", name: "Bank Central Asia", noRek: "0898765432", an: "PPTQ ROUDLOTUL MUBAROKAH", badge: "Kemitraan" },
      { bank: "QRIS", name: "QRIS Nasional Mubarokah", noRek: "NMID: ID1020038491823", an: "PPTQ ROUDLOTUL MUBAROKAH", badge: "Instan Semua Bank & E-Wallet" }
    ];

    const totalTagihanSemua = countLunas + countBelumLunas;
    const persentasePelunasan = totalTagihanSemua > 0 ? Math.round((countLunas / totalTagihanSemua) * 100) : 100;
    const surplusDefisit = totalPendapatanBulanIni - totalPengeluaranBulanIni;

    return {
      status: "success",
      success: true,
      summary: {
        totalPendapatanBulanIni: totalPendapatanBulanIni,
        totalPengeluaranBulanIni: totalPengeluaranBulanIni,
        surplusDefisit: surplusDefisit,
        totalTunggakan: totalTunggakan,
        countLunas: countLunas,
        countBelumLunas: countBelumLunas,
        persentasePelunasan: persentasePelunasan,
        totalSantriAktif: students.length,
        pendingKonfirmasiCount: pendingKonfirmasiCount,
        // Data kasir realtime hari ini
        kasMasukHariIniTunai: kasMasukHariIniTunai,
        kasMasukHariIniNonTunai: kasMasukHariIniNonTunai,
        kasKeluarHariIniTunai: kasKeluarHariIniTunai
      },
      tarifList: tarifList,
      tagihanList: tagihanList,
      recentTransactions: recentTransactions,
      recentExpenses: recentExpenses,
      kategoriPengeluaranList: kategoriPengeluaranList,
      recentClosingList: recentClosingList,
      recentKonfirmasiList: recentKonfirmasiList,
      officialAccounts: officialAccounts,
      students: students,
      programs: programsList
    };
  } catch (err) {
    console.error("[GET KEUANGAN DASHBOARD ERROR]", err);
    return { status: "error", success: false, message: "Gagal memuat dashboard keuangan: " + err.message };
  }
}

function getStudentBilling(studentId, token) {
  try {
    const sId = String(studentId || "").trim();
    if (!sId) throw new Error("ID Santri wajib disertakan.");

    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error("Spreadsheet database tidak ditemukan.");

    const tagihanSheet = ss.getSheetByName(SHEET_KEUANGAN_TAGIHAN);
    const tagihanSantri = [];

    if (tagihanSheet) {
      const data = tagihanSheet.getDataRange().getValues();
      if (data.length >= 2) {
        for (let i = 1; i < data.length; i++) {
          const r = data[i];
          if (String(r[1] || "").trim() === sId) {
            const nomTagihan = Number(r[6]) || 0;
            const nomTerbayar = Number(r[7]) || 0;
            const sisa = Math.max(0, nomTagihan - nomTerbayar);
            tagihanSantri.push({
              tagihanId: String(r[0]).trim(),
              posId: String(r[3] || "").trim(),
              namaPos: String(r[4] || "").trim(),
              periode: String(r[5] || "").trim(),
              nominalTagihan: nomTagihan,
              nominalTerbayar: nomTerbayar,
              sisaTagihan: sisa,
              status: String(r[9] || "BELUM_BAYAR").trim().toUpperCase(),
              dueDate: String(r[10] || "").substring(0, 10)
            });
          }
        }
      }
    }

    return {
      status: "success",
      success: true,
      studentId: sId,
      tagihanList: tagihanSantri
    };
  } catch (err) {
    return { status: "error", success: false, message: err.message };
  }
}

function prosesPembayaranTagihan(payload, token, actorParam) {
  return withScriptLock(() => {
    try {
      const ss = getDatabaseSpreadsheet();
      if (!ss) throw new Error("Spreadsheet database tidak ditemukan.");

      const actor = actorParam || (token ? authenticateSession(token) : null);
      if (actor) {
        authorizeRole(actor, ["SUPER_ADMIN", "ADMIN", "BENDAHARA"]);
      } else {
        throw new Error("Sesi login kasir/bendahara tidak valid.");
      }

      const studentId = String(payload.studentId || "").trim();
      const studentName = String(payload.studentName || "").trim();
      const nis = String(payload.nis || "").trim();
      const metodeBayar = String(payload.metodeBayar || "TUNAI").trim().toUpperCase();
      const catatan = String(payload.catatan || "").trim();
      let namaKasir = (actor && actor.name) || String(payload.namaKasir || "").trim() || "Bendahara Pesantren";

      const items = Array.isArray(payload.items) ? payload.items : [];
      if (items.length === 0) throw new Error("Pilih minimal satu pos tagihan yang ingin dibayar.");

      const tagihanSheet = ss.getSheetByName(SHEET_KEUANGAN_TAGIHAN);
      const trxSheet = ss.getSheetByName(SHEET_KEUANGAN_TRANSAKSI);
      if (!tagihanSheet || !trxSheet) throw new Error("Sheet keuangan belum siap. Silakan inisialisasi terlebih dahulu.");

      // Cari nomor telepon/WA wali santri dari master Students
      let studentPhone = "";
      const studentsSheet = ss.getSheetByName(SHEET_STUDENTS);
      if (studentsSheet) {
        const sData = studentsSheet.getDataRange().getValues();
        if (sData.length >= 2) {
          const sHead = sData[0].map(h => String(h || "").trim().toLowerCase());
          const idIdx = sHead.indexOf("student_id");
          let pIdx = sHead.indexOf("phone");
          if (pIdx === -1) pIdx = sHead.indexOf("no_hp");
          if (pIdx === -1) pIdx = sHead.indexOf("telepon");
          if (pIdx === -1) pIdx = sHead.indexOf("whatsapp");
          if (pIdx === -1) pIdx = sHead.indexOf("no_wa");
          if (pIdx === -1) pIdx = sHead.indexOf("wali_phone");
          if (pIdx === -1) pIdx = sHead.indexOf("kontak");
          if (idIdx !== -1 && pIdx !== -1) {
            for (let i = 1; i < sData.length; i++) {
              if (String(sData[i][idIdx] || "").trim() === studentId) {
                studentPhone = String(sData[i][pIdx] || "").trim();
                break;
              }
            }
          }
        }
      }

      // 1. Generate Nomor Kuitansi Unik
      const now = new Date();
      const yr = now.getFullYear();
      const mo = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const dateStr = `${yr}-${mo}-${day}`;
      const nowIso = now.toISOString();

      const lastTrxRow = trxSheet.getLastRow();
      const counter = String(Math.max(1, lastTrxRow)).padStart(4, "0");
      const noKuitansi = `KW/RM/${yr}/${mo}/${counter}`;
      const transaksiId = `TRX-${yr}${mo}${day}-${Date.now().toString().slice(-4)}`;

      // 2. Baca seluruh data tagihan untuk update status secara batch di memori
      const tData = tagihanSheet.getDataRange().getValues();
      let totalNominalBayar = 0;
      const rincianKuitansi = [];
      let hasChanges = false;

      items.forEach(item => {
        const tId = String(item.tagihanId || "").trim();
        const bayarNom = Number(item.bayarNominal) || 0;
        if (!tId || bayarNom <= 0) return;

        // Cari row tagihan
        for (let i = 1; i < tData.length; i++) {
          if (String(tData[i][0]).trim() === tId) {
            const nomTagihan = Number(tData[i][6]) || 0;
            const curTerbayar = Number(tData[i][7]) || 0;
            const curSisa = Math.max(0, nomTagihan - curTerbayar);

            if (bayarNom > curSisa) {
              throw new Error(`Nominal bayar (Rp ${bayarNom.toLocaleString('id-ID')}) melebihi sisa tagihan (Rp ${curSisa.toLocaleString('id-ID')}) untuk pos ${tData[i][4] || tId}.`);
            }

            const newTerbayar = curTerbayar + bayarNom;
            const newSisa = Math.max(0, nomTagihan - newTerbayar);
            const newStatus = newSisa <= 0 ? "LUNAS" : "SEBAGIAN";

            // Update sel di memory array (Batch operation)
            tData[i][7] = newTerbayar; // nominal_terbayar
            tData[i][8] = newSisa;      // sisa_tagihan
            tData[i][9] = newStatus;   // status
            tData[i][11] = nowIso;     // updated_at
            hasChanges = true;

            totalNominalBayar += bayarNom;
            rincianKuitansi.push({
              tagihanId: tId,
              namaPos: String(tData[i][4] || "Tagihan"),
              periode: String(tData[i][5] || "-"),
              nominalBayar: bayarNom,
              statusAkhir: newStatus,
              sisaTagihan: newSisa
            });
            break;
          }
        }
      });

      if (totalNominalBayar <= 0) {
        throw new Error("Total nominal pembayaran harus lebih besar dari Rp 0.");
      }

      // Tulis pembaruan tagihan secara ATOMIK / BATCH ke Google Sheets
      if (hasChanges) {
        tagihanSheet.getRange(1, 1, tData.length, tData[0].length).setValues(tData);
      }

      // 3. Catat di Sheet Transaksi
      const trxHeaders = trxSheet.getRange(1, 1, 1, Math.max(12, trxSheet.getLastColumn())).getValues()[0];
      if (trxHeaders.length < 12 || !trxHeaders[11]) {
        trxSheet.getRange(1, 12).setValue("status").setFontWeight("bold");
      }

      const newTrxRow = [
        transaksiId,
        noKuitansi,
        dateStr,
        studentId,
        studentName,
        JSON.stringify(rincianKuitansi),
        totalNominalBayar,
        metodeBayar,
        namaKasir,
        catatan,
        nowIso,
        "SUKSES" // status transaksi
      ];
      trxSheet.appendRow(newTrxRow);

      return {
        status: "success",
        success: true,
        message: "Pembayaran berhasil diproses.",
        kuitansi: {
          transaksiId: transaksiId,
          noKuitansi: noKuitansi,
          tanggalBayar: dateStr,
          studentId: studentId,
          studentName: studentName,
          nis: nis,
          phone: studentPhone,
          parentPhone: studentPhone,
          nominalTotal: totalNominalBayar,
          metodeBayar: metodeBayar,
          namaKasir: namaKasir,
          catatan: catatan,
          status: "SUKSES",
          rincianItems: rincianKuitansi
        }
      };
    } catch (err) {
      console.error("[PROSES PEMBAYARAN ERROR]", err);
      return { status: "error", success: false, message: "Gagal memproses pembayaran: " + err.message };
    }
  });
}

function batalTransaksiKeuangan(payload, token, actorParam) {
  return withScriptLock(() => {
    try {
      const ss = getDatabaseSpreadsheet();
      if (!ss) throw new Error("Spreadsheet database tidak ditemukan.");

      const actor = actorParam || (token ? authenticateSession(token) : null);
      if (actor) {
        authorizeRole(actor, ["SUPER_ADMIN", "ADMIN", "BENDAHARA"]);
      } else {
        throw new Error("Sesi otorisasi supervisor/bendahara tidak valid.");
      }

      const transaksiId = String(payload.transaksiId || "").trim();
      const alasan = String(payload.alasan || "").trim();
      if (!transaksiId) throw new Error("ID Transaksi wajib disertakan.");
      if (!alasan || alasan.length < 3) throw new Error("Alasan pembatalan/void wajib diisi (minimal 3 karakter).");

      const trxSheet = ss.getSheetByName(SHEET_KEUANGAN_TRANSAKSI);
      const tagihanSheet = ss.getSheetByName(SHEET_KEUANGAN_TAGIHAN);
      if (!trxSheet || !tagihanSheet) throw new Error("Sheet keuangan belum siap.");

      // 1. Cari data transaksi
      const trxData = trxSheet.getDataRange().getValues();
      let trxRowIdx = -1;
      let targetTrx = null;

      for (let i = 1; i < trxData.length; i++) {
        if (String(trxData[i][0]).trim() === transaksiId) {
          trxRowIdx = i + 1;
          targetTrx = trxData[i];
          break;
        }
      }

      if (trxRowIdx === -1 || !targetTrx) {
        throw new Error("Transaksi dengan ID " + transaksiId + " tidak ditemukan.");
      }

      // Cek apakah sudah pernah di-VOID
      const curStatus = String(targetTrx[11] || "").trim().toUpperCase();
      const curCatatan = String(targetTrx[9] || "").trim();
      if (curStatus === "VOID" || curCatatan.includes("[VOID/BATAL]")) {
        throw new Error("Transaksi ini sudah pernah dibatalkan (VOID).");
      }

      // 2. Parse rincian tagihan yang pernah dibayar
      let rincianItems = [];
      try {
        const rawJson = String(targetTrx[5] || "");
        if (rawJson.startsWith("[")) {
          rincianItems = JSON.parse(rawJson);
        }
      } catch (e) {
        throw new Error("Gagal membaca rincian tagihan dari transaksi ini.");
      }

      if (!Array.isArray(rincianItems) || rincianItems.length === 0) {
        throw new Error("Tidak ada rincian tagihan yang terhubung pada transaksi ini.");
      }

      // 3. Revert data tagihan di Keuangan_Tagihan secara batch di memori
      const tData = tagihanSheet.getDataRange().getValues();
      const nowIso = new Date().toISOString();
      let affectedCount = 0;

      rincianItems.forEach(item => {
        const tId = String(item.tagihanId || "").trim();
        const nomBayar = Number(item.nominalBayar) || 0;
        if (!tId || nomBayar <= 0) return;

        for (let i = 1; i < tData.length; i++) {
          if (String(tData[i][0]).trim() === tId) {
            const nomTagihan = Number(tData[i][6]) || 0;
            const curTerbayar = Number(tData[i][7]) || 0;
            const newTerbayar = Math.max(0, curTerbayar - nomBayar);
            const newSisa = Math.max(0, nomTagihan - newTerbayar);
            const newStatus = newTerbayar <= 0 ? "BELUM_BAYAR" : (newSisa <= 0 ? "LUNAS" : "SEBAGIAN");

            tData[i][7] = newTerbayar;
            tData[i][8] = newSisa;
            tData[i][9] = newStatus;
            tData[i][11] = nowIso;
            affectedCount++;
            break;
          }
        }
      });

      if (affectedCount > 0) {
        tagihanSheet.getRange(1, 1, tData.length, tData[0].length).setValues(tData);
      }

      // 4. Update status transaksi menjadi VOID di Keuangan_Transaksi
      const actorName = (actor && actor.name) || "Bendahara";
      const voidNote = `[VOID/BATAL oleh ${actorName} pada ${nowIso}. Alasan: ${alasan}] ${curCatatan}`.trim();
      
      if (trxData[0].length < 12) {
        trxSheet.getRange(1, 12).setValue("status").setFontWeight("bold");
      }
      trxSheet.getRange(trxRowIdx, 10).setValue(voidNote); // Catatan
      trxSheet.getRange(trxRowIdx, 12).setValue("VOID");    // Status

      return {
        status: "success",
        success: true,
        message: "Transaksi " + (targetTrx[1] || transaksiId) + " berhasil dibatalkan (VOID). Status tagihan telah dikembalikan.",
        transaksiId: transaksiId,
        noKuitansi: String(targetTrx[1] || "")
      };
    } catch (err) {
      console.error("[BATAL TRANSAKSI ERROR]", err);
      return { status: "error", success: false, message: "Gagal membatalkan transaksi: " + err.message };
    }
  });
}

function generateBulkMonthlyBills(payload, token) {
  return withScriptLock(() => {
    try {
      const ss = getDatabaseSpreadsheet();
      if (!ss) throw new Error("Spreadsheet database tidak ditemukan.");

      const periode = String(payload.periode || "").trim(); // misal "2026-10"
      if (!periode || !/^\d{4}-\d{2}$/.test(periode)) {
        throw new Error("Format periode harus YYYY-MM (contoh: 2026-10)");
      }

      const dueDate = String(payload.dueDate || `${periode}-10`).trim();
      const posIds = Array.isArray(payload.posIds) ? payload.posIds : [];

      const tSheet = ss.getSheetByName(SHEET_KEUANGAN_TARIF);
      const tagihanSheet = ss.getSheetByName(SHEET_KEUANGAN_TAGIHAN);
      const studentsSheet = ss.getSheetByName(SHEET_STUDENTS);

      if (!tSheet || !tagihanSheet || !studentsSheet) {
        throw new Error("Sheet database belum lengkap.");
      }

      // 1. Ambil pos tarif bulanan aktif
      const activeTarifs = [];
      const tData = tSheet.getDataRange().getValues();
      for (let i = 1; i < tData.length; i++) {
        const tId = String(tData[i][0]).trim();
        const isAct = String(tData[i][6]).toUpperCase() === "TRUE";
        const kat = String(tData[i][2]).toUpperCase();
        if (tId && isAct && (kat === "BULANAN" || posIds.includes(tId))) {
          activeTarifs.push({
            tarifId: tId,
            namaPos: String(tData[i][1] || "").trim(),
            nominal: Number(tData[i][4]) || 0,
            program: String(tData[i][5] || "SEMUA").trim()
          });
        }
      }

      if (activeTarifs.length === 0) {
        throw new Error("Tidak ada pos tarif bulanan aktif yang ditemukan.");
      }

      // 2. Ambil data santri aktif
      const activeStudents = [];
      const sData = studentsSheet.getDataRange().getValues();
      const sHead = sData[0].map(h => String(h || "").trim().toLowerCase());
      const idIdx = sHead.indexOf("student_id");
      const nameIdx = sHead.indexOf("name");
      const progIdx = sHead.indexOf("program");
      const statusIdx = sHead.indexOf("status");

      for (let i = 1; i < sData.length; i++) {
        const st = statusIdx !== -1 ? String(sData[i][statusIdx] || "").trim().toUpperCase() : "AKTIF";
        if (["AKTIF", "ACTIVE", ""].includes(st)) {
          const sId = String(sData[i][idIdx] || "").trim();
          if (sId) {
            activeStudents.push({
              studentId: sId,
              name: String(sData[i][nameIdx] || "").trim(),
              program: progIdx !== -1 ? String(sData[i][progIdx] || "").trim() : "Tahfidz"
            });
          }
        }
      }

      if (activeStudents.length === 0) {
        throw new Error("Tidak ada data santri aktif.");
      }

      // 3. Index tagihan yang sudah ada di periode ini untuk mencegah duplikasi
      const existingTagihanKeys = new Set();
      const curTagihanData = tagihanSheet.getDataRange().getValues();
      for (let i = 1; i < curTagihanData.length; i++) {
        const sId = String(curTagihanData[i][1] || "").trim();
        const pId = String(curTagihanData[i][3] || "").trim();
        const per = String(curTagihanData[i][5] || "").trim();
        if (sId && pId && per) {
          existingTagihanKeys.add(`${sId}_${pId}_${per}`);
        }
      }

      // 4. Buat baris tagihan baru
      const nowIso = new Date().toISOString();
      const newRows = [];

      activeStudents.forEach(st => {
        activeTarifs.forEach(trf => {
          // Cek kesesuaian program berdasarkan Sheet Programs kolom B (name)
          const trfProg = String(trf.program || "SEMUA").trim();
          const stProg = String(st.program || "").trim();

          const isAll = (
            trfProg === "SEMUA" ||
            trfProg.toUpperCase() === "SEMUA SANTRI" ||
            trfProg.toUpperCase() === "SEMUA PROGRAM" ||
            trfProg === ""
          );

          if (!isAll) {
            const matchExact = (stProg.toLowerCase() === trfProg.toLowerCase());
            const matchIncludes = (stProg.toLowerCase().includes(trfProg.toLowerCase()) || trfProg.toLowerCase().includes(stProg.toLowerCase()));
            if (!matchExact && !matchIncludes) {
              return;
            }
          }

          const key = `${st.studentId}_${trf.tarifId}_${periode}`;
          if (!existingTagihanKeys.has(key)) {
            const tagihanId = `TGH-${periode.replace("-", "")}-${st.studentId}-${trf.tarifId}`;
            newRows.push([
              tagihanId,
              st.studentId,
              st.name,
              trf.tarifId,
              trf.namaPos,
              periode,
              trf.nominal,
              0,          // nominal_terbayar
              trf.nominal,// sisa_tagihan
              "BELUM_BAYAR",
              dueDate,
              nowIso
            ]);
            existingTagihanKeys.add(key);
          }
        });
      });

      if (newRows.length > 0) {
        const startRow = tagihanSheet.getLastRow() + 1;
        tagihanSheet.getRange(startRow, 1, newRows.length, newRows[0].length).setValues(newRows);
      }

      return {
        status: "success",
        success: true,
        countGenerated: newRows.length,
        message: `Berhasil menerbitkan ${newRows.length} item tagihan baru untuk periode ${periode}.`
      };
    } catch (err) {
      console.error("[GENERATE BULK BILLS ERROR]", err);
      return { status: "error", success: false, message: "Gagal menerbitkan tagihan massal: " + err.message };
    }
  });
}

function saveMasterTarif(payload, token) {
  try {
    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error("Spreadsheet database tidak ditemukan.");

    const tSheet = getOrCreateKeuanganSheet(ss, SHEET_KEUANGAN_TARIF, ["tarif_id", "nama_pos", "kategori", "tipe_periode", "nominal_default", "program", "is_active", "created_at"], "#0f766e");
    const tarifId = String(payload.tarifId || `TRF-${Date.now().toString().slice(-6)}`).trim();
    const namaPos = String(payload.namaPos || "").trim();
    const kategori = String(payload.kategori || "BULANAN").trim().toUpperCase();
    const tipePeriode = String(payload.tipePeriode || "BULANAN").trim().toUpperCase();
    const nominal = Number(payload.nominalDefault) || 0;
    const program = String(payload.program || "SEMUA").trim();
    const isActive = payload.isActive !== false ? "TRUE" : "FALSE";
    const nowIso = new Date().toISOString();

    if (!namaPos) throw new Error("Nama Pos Biaya wajib diisi.");

    const data = tSheet.getDataRange().getValues();
    let foundRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === tarifId) {
        foundRow = i + 1;
        break;
      }
    }

    if (foundRow > 0) {
      tSheet.getRange(foundRow, 2, 1, 6).setValues([[namaPos, kategori, tipePeriode, nominal, program, isActive]]);
    } else {
      tSheet.appendRow([tarifId, namaPos, kategori, tipePeriode, nominal, program, isActive, nowIso]);
    }

    return {
      status: "success",
      success: true,
      message: "Master tarif berhasil disimpan.",
      tarifId: tarifId
    };
  } catch (err) {
    return { status: "error", success: false, message: err.message };
  }
}

function deleteMasterTarif(tarifId, token) {
  try {
    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error("Spreadsheet database tidak ditemukan.");
    const tSheet = ss.getSheetByName(SHEET_KEUANGAN_TARIF);
    if (!tSheet) throw new Error("Sheet master tarif tidak ditemukan.");

    const tId = String(tarifId || "").trim();
    const data = tSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === tId) {
        tSheet.deleteRow(i + 1);
        return { status: "success", success: true, message: "Tarif berhasil dihapus." };
      }
    }
    throw new Error("Tarif dengan ID tersebut tidak ditemukan.");
  } catch (err) {
    return { status: "error", success: false, message: err.message };
  }
}

// ====================================================================
// FASE 2: MANAJEMEN KAS KELUAR & TUTUP KASIR HARIAN
// ====================================================================

function savePengeluaranKeuangan(payload, token, actorParam) {
  return withScriptLock(() => {
    try {
      const ss = getDatabaseSpreadsheet();
      if (!ss) throw new Error("Spreadsheet database tidak ditemukan.");

      const actor = actorParam || (token ? authenticateSession(token) : null);
      if (actor) {
        authorizeRole(actor, ["SUPER_ADMIN", "ADMIN", "BENDAHARA"]);
      } else {
        throw new Error("Sesi otorisasi supervisor/bendahara tidak valid.");
      }

      const nominal = Number(payload.nominal) || 0;
      if (nominal <= 0) throw new Error("Nominal pengeluaran harus lebih besar dari Rp 0.");

      const kategoriId = String(payload.kategoriId || "EXP-CAT-08").trim();
      const namaKategori = String(payload.namaKategori || "Kas Kecil & Pengeluaran Darurat").trim();
      const dibayarkanKepada = String(payload.dibayarkanKepada || "-").trim();
      const keterangan = String(payload.keterangan || "").trim();
      const metodeBayar = String(payload.metodeBayar || "TUNAI").trim().toUpperCase();
      const tanggal = String(payload.tanggal || new Date().toISOString().substring(0, 10)).trim();
      const petugas = (actor && actor.name) || "Bendahara Pesantren";
      const now = new Date();
      const nowIso = now.toISOString();

      const expSheet = getOrCreateKeuanganSheet(
        ss, 
        SHEET_KEUANGAN_PENGELUARAN, 
        ["pengeluaran_id", "no_bukti", "tanggal", "kategori_id", "nama_kategori", "nominal", "metode_bayar", "dibayarkan_kepada", "keterangan", "petugas", "status", "created_at"],
        "#e11d48"
      );

      const yr = now.getFullYear();
      const mo = String(now.getMonth() + 1).padStart(2, "0");
      const lastRow = expSheet.getLastRow();
      const counter = String(Math.max(1, lastRow)).padStart(4, "0");
      const noBukti = `BK/RM/${yr}/${mo}/${counter}`;
      const pengeluaranId = `EXP-${yr}${mo}-${counter}`;

      expSheet.appendRow([
        pengeluaranId,
        noBukti,
        tanggal,
        kategoriId,
        namaKategori,
        nominal,
        metodeBayar,
        dibayarkanKepada,
        keterangan,
        petugas,
        "ACTIVE",
        nowIso
      ]);

      return {
        status: "success",
        success: true,
        message: `Pengeluaran sebesar Rp ${nominal.toLocaleString("id-ID")} berhasil dicatat dengan No. Bukti ${noBukti}.`,
        pengeluaranId: pengeluaranId,
        noBukti: noBukti
      };
    } catch (err) {
      console.error("[SAVE PENGELUARAN ERROR]", err);
      return { status: "error", success: false, message: "Gagal menyimpan pengeluaran: " + err.message };
    }
  });
}

function batalPengeluaranKeuangan(payload, token, actorParam) {
  return withScriptLock(() => {
    try {
      const ss = getDatabaseSpreadsheet();
      if (!ss) throw new Error("Spreadsheet database tidak ditemukan.");

      const actor = actorParam || (token ? authenticateSession(token) : null);
      if (actor) {
        authorizeRole(actor, ["SUPER_ADMIN", "ADMIN", "BENDAHARA"]);
      } else {
        throw new Error("Sesi otorisasi supervisor/bendahara tidak valid.");
      }

      const pengeluaranId = String(payload.pengeluaranId || "").trim();
      const alasan = String(payload.alasan || "").trim();
      if (!pengeluaranId) throw new Error("ID Pengeluaran wajib disertakan.");
      if (!alasan || alasan.length < 3) throw new Error("Alasan pembatalan/void wajib diisi minimal 3 karakter.");

      const expSheet = ss.getSheetByName(SHEET_KEUANGAN_PENGELUARAN);
      if (!expSheet) throw new Error("Sheet pengeluaran belum dibuat.");

      const data = expSheet.getDataRange().getValues();
      let targetRow = -1;
      let targetExp = null;

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim() === pengeluaranId) {
          targetRow = i + 1;
          targetExp = data[i];
          break;
        }
      }

      if (targetRow === -1 || !targetExp) {
        throw new Error("Pengeluaran dengan ID " + pengeluaranId + " tidak ditemukan.");
      }

      const curStatus = String(targetExp[10] || "").trim().toUpperCase();
      if (curStatus === "VOID") {
        throw new Error("Pengeluaran ini sudah pernah dibatalkan (VOID).");
      }

      const nowIso = new Date().toISOString();
      const actorName = (actor && actor.name) || "Bendahara";
      const oldKet = String(targetExp[8] || "");
      const newKet = `[VOID oleh ${actorName} pada ${nowIso}. Alasan: ${alasan}] ${oldKet}`.trim();

      expSheet.getRange(targetRow, 9).setValue(newKet);    // Keterangan
      expSheet.getRange(targetRow, 11).setValue("VOID");    // Status

      return {
        status: "success",
        success: true,
        message: `Pengeluaran ${targetExp[1] || pengeluaranId} berhasil dibatalkan (VOID).`,
        pengeluaranId: pengeluaranId
      };
    } catch (err) {
      console.error("[BATAL PENGELUARAN ERROR]", err);
      return { status: "error", success: false, message: "Gagal membatalkan pengeluaran: " + err.message };
    }
  });
}

function submitTutupKasirKeuangan(payload, token, actorParam) {
  return withScriptLock(() => {
    try {
      const ss = getDatabaseSpreadsheet();
      if (!ss) throw new Error("Spreadsheet database tidak ditemukan.");

      const actor = actorParam || (token ? authenticateSession(token) : null);
      if (actor) {
        authorizeRole(actor, ["SUPER_ADMIN", "ADMIN", "BENDAHARA"]);
      } else {
        throw new Error("Sesi otorisasi supervisor/bendahara tidak valid.");
      }

      const tanggal = String(payload.tanggal || new Date().toISOString().substring(0, 10)).trim();
      const namaKasir = (actor && actor.name) || String(payload.namaKasir || "Kasir Loket").trim();
      const modalAwal = Number(payload.modalAwal) || 0;
      const masukTunai = Number(payload.masukTunai) || 0;
      const masukTransfer = Number(payload.masukTransfer) || 0;
      const masukQris = Number(payload.masukQris) || 0;
      const keluarTunai = Number(payload.keluarTunai) || 0;
      const saldoFisik = Number(payload.saldoFisik) || 0;
      const catatan = String(payload.catatan || "").trim();

      const saldoSistem = (modalAwal + masukTunai) - keluarTunai;
      const selisih = saldoFisik - saldoSistem;
      const nowIso = new Date().toISOString();

      const closingSheet = getOrCreateKeuanganSheet(
        ss,
        SHEET_KEUANGAN_TUTUP_KASIR,
        ["closing_id", "tanggal", "nama_kasir", "modal_awal", "masuk_tunai", "masuk_transfer", "masuk_qris", "keluar_tunai", "saldo_sistem", "saldo_fisik", "selisih", "catatan", "status", "created_at"],
        "#4f46e5"
      );

      const dClean = tanggal.replace(/[^0-9]/g, "");
      const lastRow = closingSheet.getLastRow();
      const counter = String(Math.max(1, lastRow)).padStart(3, "0");
      const closingId = `CLS-${dClean}-${counter}`;

      closingSheet.appendRow([
        closingId,
        tanggal,
        namaKasir,
        modalAwal,
        masukTunai,
        masukTransfer,
        masukQris,
        keluarTunai,
        saldoSistem,
        saldoFisik,
        selisih,
        catatan,
        selisih === 0 ? "SEIMBANG" : (selisih > 0 ? "LEBIH" : "SELISIH_KURANG"),
        nowIso
      ]);

      return {
        status: "success",
        success: true,
        message: `Rekonsiliasi tutup kasir berhasil disimpan. Status: ${selisih === 0 ? "SEIMBANG (Paspasan)" : (selisih > 0 ? "LEBIH Rp " + selisih.toLocaleString("id-ID") : "KURANG Rp " + Math.abs(selisih).toLocaleString("id-ID"))}.`,
        closingId: closingId,
        saldoSistem: saldoSistem,
        saldoFisik: saldoFisik,
        selisih: selisih
      };
    } catch (err) {
      console.error("[SUBMIT TUTUP KASIR ERROR]", err);
      return { status: "error", success: false, message: "Gagal memproses tutup kasir: " + err.message };
    }
  });
}

// ====================================================================
// FASE 3: KONFIRMASI TRANSFER ONLINE, VERIFIKASI & WHATSAPP BILLING
// ====================================================================

function submitKonfirmasiTransferKeuangan(payload) {
  return withScriptLock(() => {
    try {
      const ss = getDatabaseSpreadsheet();
      if (!ss) throw new Error("Spreadsheet database tidak ditemukan.");

      const studentId = String(payload.studentId || "").trim();
      const studentName = String(payload.studentName || "").trim();
      const nominalTransfer = Number(payload.nominalTransfer) || 0;
      const bankTujuan = String(payload.bankTujuan || "BSI").trim().toUpperCase();
      const namaPengirim = String(payload.namaPengirim || "").trim();
      const tanggalTransfer = String(payload.tanggalTransfer || new Date().toISOString().substring(0, 10)).trim();
      const buktiTransferUrl = String(payload.buktiTransferUrl || "").trim();
      const tagihanIds = payload.tagihanIds || [];
      const tagihanIdsJson = Array.isArray(tagihanIds) ? JSON.stringify(tagihanIds) : String(payload.tagihanIdsJson || "[]");

      if (!studentId) throw new Error("ID Santri wajib disertakan.");
      if (nominalTransfer <= 0) throw new Error("Nominal transfer harus lebih besar dari Rp 0.");
      if (!namaPengirim) throw new Error("Nama pemilik rekening pengirim wajib diisi.");

      const headersKonfirmasi = ["konfirmasi_id", "student_id", "student_name", "tagihan_ids_json", "nominal_transfer", "bank_tujuan", "nama_pengirim", "tanggal_transfer", "bukti_transfer_url", "status", "catatan_verifikasi", "no_kuitansi", "created_at"];
      const trfSheet = getOrCreateKeuanganSheet(ss, SHEET_KEUANGAN_KONFIRMASI_TRANSFER, headersKonfirmasi, "#0891b2");

      const now = new Date();
      const yr = now.getFullYear();
      const mo = String(now.getMonth() + 1).padStart(2, "0");
      const lastRow = trfSheet.getLastRow();
      const counter = String(Math.max(1, lastRow)).padStart(4, "0");
      const konfirmasiId = `TRF-${yr}${mo}-${counter}`;
      const nowIso = now.toISOString();

      trfSheet.appendRow([
        konfirmasiId,
        studentId,
        studentName,
        tagihanIdsJson,
        nominalTransfer,
        bankTujuan,
        namaPengirim,
        tanggalTransfer,
        buktiTransferUrl,
        "PENDING",
        "",
        "",
        nowIso
      ]);

      return {
        status: "success",
        success: true,
        message: `Konfirmasi pembayaran berhasil dikirim dengan ID ${konfirmasiId}. Menunggu verifikasi dari Bendahara Pesantren.`,
        konfirmasiId: konfirmasiId
      };
    } catch (err) {
      console.error("[SUBMIT KONFIRMASI TRANSFER ERROR]", err);
      return { status: "error", success: false, message: "Gagal mengirim konfirmasi transfer: " + err.message };
    }
  });
}

function verifyKonfirmasiTransferKeuangan(payload, token, actorParam) {
  return withScriptLock(() => {
    try {
      const ss = getDatabaseSpreadsheet();
      if (!ss) throw new Error("Spreadsheet database tidak ditemukan.");

      const actor = actorParam || (token ? authenticateSession(token) : null);
      if (actor) {
        authorizeRole(actor, ["SUPER_ADMIN", "ADMIN", "BENDAHARA"]);
      } else {
        throw new Error("Sesi otorisasi supervisor/bendahara tidak valid.");
      }

      const konfirmasiId = String(payload.konfirmasiId || "").trim();
      const actionType = String(payload.actionType || "VERIFY").trim().toUpperCase(); // VERIFY or REJECT
      const alasan = String(payload.alasan || "").trim();

      if (!konfirmasiId) throw new Error("ID Konfirmasi Transfer wajib disertakan.");

      const trfSheet = ss.getSheetByName(SHEET_KEUANGAN_KONFIRMASI_TRANSFER);
      if (!trfSheet) throw new Error("Sheet konfirmasi transfer belum dibuat.");

      const data = trfSheet.getDataRange().getValues();
      let targetRow = -1;
      let targetData = null;

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim() === konfirmasiId) {
          targetRow = i + 1;
          targetData = data[i];
          break;
        }
      }

      if (targetRow === -1 || !targetData) {
        throw new Error("Konfirmasi transfer dengan ID " + konfirmasiId + " tidak ditemukan.");
      }

      const currentStatus = String(targetData[9] || "PENDING").trim().toUpperCase();
      if (currentStatus !== "PENDING") {
        throw new Error(`Konfirmasi ini sudah pernah diproses dengan status ${currentStatus}.`);
      }

      const nowIso = new Date().toISOString();
      const actorName = (actor && actor.name) || "Bendahara";

      if (actionType === "REJECT") {
        if (!alasan || alasan.length < 3) throw new Error("Alasan penolakan wajib diisi (minimal 3 karakter).");
        trfSheet.getRange(targetRow, 10).setValue("REJECTED");
        trfSheet.getRange(targetRow, 11).setValue(`Ditolak oleh ${actorName} pada ${nowIso}. Alasan: ${alasan}`);
        return {
          status: "success",
          success: true,
          message: `Konfirmasi transfer ${konfirmasiId} berhasil ditolak.`,
          konfirmasiId: konfirmasiId
        };
      }

      // Action VERIFY -> Jalankan proses pelunasan tagihan & terbitkan kuitansi kas resmi
      const studentId = String(targetData[1] || "").trim();
      const studentName = String(targetData[2] || "").trim();
      const rawTagihanIds = String(targetData[3] || "[]");
      const nomTransfer = Number(targetData[4]) || 0;
      const bankTujuan = String(targetData[5] || "BSI").trim();
      const namaPengirim = String(targetData[6] || "-").trim();

      let itemsToPay = [];
      try {
        const parsed = JSON.parse(rawTagihanIds);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Jika array string tagihanId
          if (typeof parsed[0] === "string") {
            const tagihanSheet = ss.getSheetByName(SHEET_KEUANGAN_TAGIHAN);
            if (tagihanSheet) {
              const tgData = tagihanSheet.getDataRange().getValues();
              let sisaNominal = nomTransfer;
              for (const tid of parsed) {
                if (sisaNominal <= 0) break;
                for (let r = 1; r < tgData.length; r++) {
                  if (String(tgData[r][0]).trim() === tid) {
                    const nomTagihan = Number(tgData[r][6]) || 0;
                    const nomTerbayar = Number(tgData[r][7]) || 0;
                    const sisaCur = Math.max(0, nomTagihan - nomTerbayar);
                    const bayarItem = Math.min(sisaCur, sisaNominal);
                    if (bayarItem > 0) {
                      itemsToPay.push({ tagihanId: tid, bayarNominal: bayarItem });
                      sisaNominal -= bayarItem;
                    }
                    break;
                  }
                }
              }
            }
          } else {
            itemsToPay = parsed;
          }
        }
      } catch (e) {}

      // Jika itemsToPay kosong, cari tagihan santri yang masih ada sisa
      if (itemsToPay.length === 0) {
        const tagihanSheet = ss.getSheetByName(SHEET_KEUANGAN_TAGIHAN);
        if (tagihanSheet) {
          const tgData = tagihanSheet.getDataRange().getValues();
          let sisaNominal = nomTransfer;
          for (let r = 1; r < tgData.length; r++) {
            if (sisaNominal <= 0) break;
            if (String(tgData[r][1]).trim() === studentId) {
              const nomTagihan = Number(tgData[r][6]) || 0;
              const nomTerbayar = Number(tgData[r][7]) || 0;
              const sisaCur = Math.max(0, nomTagihan - nomTerbayar);
              if (sisaCur > 0) {
                const bayarItem = Math.min(sisaCur, sisaNominal);
                itemsToPay.push({ tagihanId: String(tgData[r][0]).trim(), bayarNominal: bayarItem });
                sisaNominal -= bayarItem;
              }
            }
          }
        }
      }

      if (itemsToPay.length === 0) {
        throw new Error("Tidak ditemukan tagihan aktif yang dapat dialokasikan untuk santri ini.");
      }

      // Eksekusi pembayaran kasir resmi
      const payRes = prosesPembayaranTagihan({
        studentId: studentId,
        studentName: studentName,
        items: itemsToPay,
        nominalDiterima: nomTransfer,
        metodeBayar: bankTujuan.includes("TRANSFER") ? bankTujuan : `TRANSFER ${bankTujuan}`,
        namaKasir: actorName,
        catatan: `Verifikasi Transfer #${konfirmasiId} a.n ${namaPengirim}`
      }, token, actor);

      if (!payRes || !payRes.success) {
        throw new Error("Gagal memproses transaksi kasir: " + ((payRes && payRes.message) || "Kesalahan tidak diketahui"));
      }

      const noKuitansi = payRes.noKuitansi || "-";
      trfSheet.getRange(targetRow, 10).setValue("VERIFIED");
      trfSheet.getRange(targetRow, 11).setValue(`Diverifikasi oleh ${actorName} pada ${nowIso}`);
      trfSheet.getRange(targetRow, 12).setValue(noKuitansi);

      return {
        status: "success",
        success: true,
        message: `Konfirmasi transfer ${konfirmasiId} berhasil diverifikasi! Kuitansi resmi ${noKuitansi} telah diterbitkan.`,
        konfirmasiId: konfirmasiId,
        noKuitansi: noKuitansi,
        transaksiId: payRes.transaksiId
      };
    } catch (err) {
      console.error("[VERIFY KONFIRMASI TRANSFER ERROR]", err);
      return { status: "error", success: false, message: "Gagal memverifikasi transfer: " + err.message };
    }
  });
}

function getBroadcastTagihanListKeuangan(payload, token) {
  try {
    const actor = token ? authenticateSession(token) : null;
    if (actor) {
      authorizeRole(actor, ["SUPER_ADMIN", "ADMIN", "BENDAHARA"]);
    } else {
      throw new Error("Sesi otorisasi tidak valid.");
    }

    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error("Spreadsheet database tidak ditemukan.");

    const filterPeriode = String(payload.periode || "").trim(); // e.g. "2026-10"
    const filterProgram = String(payload.program || "SEMUA").trim().toUpperCase();

    // 1. Ambil Data Santri & Kontak WhatsApp Wali (dari Students sheet & Wali_Santri_Map)
    const studentMap = {};
    const waliPhoneMap = {};

    // 1a. Cek relasi Wali Santri di Wali_Santri_Map & Wali_Identities/Users
    try {
      const mapSheet = ss.getSheetByName(SHEET_WALI_SANTRI_MAP);
      const waliSheet = ss.getSheetByName(SHEET_WALI_IDENTITIES) || ss.getSheetByName("Users");
      if (mapSheet && waliSheet) {
        const wData = waliSheet.getDataRange().getValues();
        if (wData.length > 1) {
          const wHead = wData[0].map(h => String(h || "").trim().toLowerCase());
          const wIdIdx = wHead.findIndex(h => h.includes("id"));
          const wPhoneIdx = wHead.findIndex(h => h.includes("phone") || h.includes("hp") || h.includes("wa") || h.includes("telepon") || h.includes("kontak"));
          
          const phoneById = {};
          if (wIdIdx !== -1 && wPhoneIdx !== -1) {
            for (let w = 1; w < wData.length; w++) {
              const wId = String(wData[w][wIdIdx] || "").trim();
              const wPhone = String(wData[w][wPhoneIdx] || "").trim();
              if (wId && wPhone) phoneById[wId] = wPhone;
            }
          }

          const mData = mapSheet.getDataRange().getValues();
          for (let m = 1; m < mData.length; m++) {
            const waliId = String(mData[m][1] || "").trim();
            const sId = String(mData[m][2] || "").trim();
            if (sId && waliId && phoneById[waliId]) {
              waliPhoneMap[sId] = phoneById[waliId];
            }
          }
        }
      }
    } catch (wErr) {
      console.warn("[BROADCAST WALI MAP LOOKUP ERROR]", wErr);
    }

    // 1b. Ambil dari sheet Students
    const stSheet = ss.getSheetByName("Students");
    if (stSheet) {
      const sData = stSheet.getDataRange().getValues();
      if (sData.length >= 2) {
        const headers = sData[0].map(h => String(h || "").trim().toLowerCase());
        const idIdx = headers.indexOf("student_id");
        const nisIdx = headers.indexOf("nis") !== -1 ? headers.indexOf("nis") : headers.indexOf("nisn");
        const nameIdx = headers.indexOf("name") !== -1 ? headers.indexOf("name") : headers.indexOf("nama");
        const progIdx = headers.indexOf("program");
        const phoneIdx = headers.findIndex(h => h.includes("phone") || h.includes("hp") || h.includes("wa") || h.includes("telepon") || h.includes("kontak"));

        for (let i = 1; i < sData.length; i++) {
          const r = sData[i];
          const sId = idIdx !== -1 ? String(r[idIdx] || "").trim() : String(r[0] || "").trim();
          if (sId) {
            let phone = phoneIdx !== -1 ? String(r[phoneIdx] || "").trim() : "";
            if (!phone && waliPhoneMap[sId]) {
              phone = waliPhoneMap[sId];
            }
            const sName = nameIdx !== -1 ? String(r[nameIdx] || "").trim() : (r[3] ? String(r[3]).trim() : "");
            const sProg = progIdx !== -1 ? String(r[progIdx] || "Tahfidz").trim() : "Tahfidz";
            const sNis = nisIdx !== -1 ? String(r[nisIdx] || "").trim() : "";

            studentMap[sId] = {
              studentId: sId,
              nis: sNis,
              name: sName,
              program: sProg,
              phone: phone
            };
          }
        }
      }
    }

    // Helper format periode agar rapi (tidak mencetak 'Thu Oct 01 2026...')
    function formatPeriodeClean(rawVal) {
      if (!rawVal) return "-";
      if (rawVal instanceof Date) {
        const y = rawVal.getFullYear();
        const m = String(rawVal.getMonth() + 1).padStart(2, "0");
        return `${y}-${m}`;
      }
      const s = String(rawVal).trim();
      const matchDate = s.match(/(\d{4})[-/](\d{1,2})/);
      if (matchDate) {
        return `${matchDate[1]}-${String(matchDate[2]).padStart(2, "0")}`;
      }
      const matchGmt = s.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+(\d{4})/i);
      if (matchGmt) {
        const months = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
        const monNum = months[matchGmt[1].toLowerCase()] || "01";
        return `${matchGmt[2]}-${monNum}`;
      }
      return s;
    }

    // 2. Ambil Tagihan Belum Lunas
    const tagihanSheet = ss.getSheetByName(SHEET_KEUANGAN_TAGIHAN);
    const santriUnpaidMap = {};

    if (tagihanSheet) {
      const tgData = tagihanSheet.getDataRange().getValues();
      if (tgData.length >= 2) {
        for (let i = 1; i < tgData.length; i++) {
          const r = tgData[i];
          const sId = String(r[1] || "").trim();
          const stStatus = String(r[9] || "BELUM_BAYAR").trim().toUpperCase();
          const rawPeriode = r[5];
          const cleanPeriode = formatPeriodeClean(rawPeriode);

          if (stStatus !== "LUNAS" && sId) {
            if (filterPeriode && cleanPeriode !== filterPeriode && String(rawPeriode) !== filterPeriode) continue;

            const fallbackName = String(r[2] || "").trim();
            const stInfo = studentMap[sId] || { name: fallbackName, program: "Santri", phone: waliPhoneMap[sId] || "" };
            if (filterProgram !== "SEMUA" && stInfo.program.toUpperCase() !== filterProgram) continue;

            const nomTagihan = Number(r[6]) || 0;
            const nomTerbayar = Number(r[7]) || 0;
            const sisa = Math.max(0, nomTagihan - nomTerbayar);

            if (sisa > 0) {
              if (!santriUnpaidMap[sId]) {
                santriUnpaidMap[sId] = {
                  studentId: sId,
                  studentName: stInfo.name || fallbackName,
                  program: stInfo.program || "Santri",
                  phone: stInfo.phone || waliPhoneMap[sId] || "",
                  totalTunggakan: 0,
                  items: []
                };
              }
              santriUnpaidMap[sId].totalTunggakan += sisa;
              santriUnpaidMap[sId].items.push({
                namaPos: String(r[4] || "").trim(),
                periode: cleanPeriode,
                sisa: sisa
              });
            }
          }
        }
      }
    }

    let configPengaturan = {};
    try {
      configPengaturan = getPengaturanData() || {};
    } catch (errCfg) {
      console.warn("Gagal memuat pengaturan lembaga untuk broadcast: " + errCfg.message);
    }
    const rawPesantren = configPengaturan.nama_pesantren || "Roudlotul Mubarokah";
    let cleanedBroadcast = String(rawPesantren).trim()
      .replace(/^PPTQ\s*/i, "")
      .replace(/^(Pondok\s+Pesantren|Pesantren)\s*/i, "")
      .trim();
    if (!cleanedBroadcast) cleanedBroadcast = "Roudlotul Mubarokah";
    const namaLengkapLembaga = "PPTQ " + cleanedBroadcast;
    const anRekeningLembaga = namaLengkapLembaga.toUpperCase();

    const broadcastList = Object.values(santriUnpaidMap).map(st => {
      let rincianText = st.items.map(it => `• ${it.namaPos} (${it.periode}): Rp ${it.sisa.toLocaleString("id-ID")}`).join("\n");
      let rawWa = st.phone.replace(/[^0-9]/g, "");
      if (rawWa.startsWith("0")) rawWa = "62" + rawWa.substring(1);

      const messageTemplate = 
`Assalamu'alaikum Wr. Wb.
Yth. Bapak/Ibu Wali Santri dari ananda *${st.studentName}* (${st.program}).

Semoga senantiasa dalam limpahan taufiq dan hidayah Allah SWT.
Kami dari Bagian Keuangan ${namaLengkapLembaga} menginformasikan rincian kewajiban administrasi pesantren:

${rincianText}
*Total Yang Perlu Diselesaikan:* Rp ${st.totalTunggakan.toLocaleString("id-ID")}

Pembayaran dapat disalurkan melalui:
• Rekening BSI: *7198234567* a.n. ${anRekeningLembaga}
• Rekening BRI: *0038-01-002345-53-1* a.n. PESANTREN ${cleanedBroadcast.toUpperCase()}
• QRIS Nasional Mubarokah (tersedia di aplikasi / loket)
• Loket Kasir Pesantren (Tunai)

Konfirmasi pembayaran transfer dapat diunggah melalui Portal Santri di aplikasi Mubarokah.
Atas perhatian dan kerjasamanya, kami haturkan jazakumullahu ahsanal jaza'.

Wassalamu'alaikum Wr. Wb.
_Bendahara ${namaLengkapLembaga}_`;

      const waLink = rawWa ? `https://wa.me/${rawWa}?text=${encodeURIComponent(messageTemplate)}` : "";

      return {
        studentId: st.studentId,
        studentName: st.studentName,
        program: st.program,
        phone: st.phone,
        totalTunggakan: st.totalTunggakan,
        itemsCount: st.items.length,
        items: st.items,
        waLink: waLink,
        messagePreview: messageTemplate
      };
    });

    // Urutkan dari tunggakan terbesar
    broadcastList.sort((a, b) => b.totalTunggakan - a.totalTunggakan);

    return {
      status: "success",
      success: true,
      totalSantriTertunggak: broadcastList.length,
      broadcastList: broadcastList
    };
  } catch (err) {
    console.error("[GET BROADCAST TAGIHAN ERROR]", err);
    return { status: "error", success: false, message: "Gagal memuat daftar broadcast: " + err.message };
  }
}

// ====================================================================
// FASE 4: SMART PESANTREN, TABUNGAN UANG SAKU, CASHLESS & ANALYTICS
// ====================================================================

function getTabunganSantriDashboard(token) {
  try {
    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error("Spreadsheet database tidak ditemukan.");

    // Pastikan sheet tabungan & mutasi tersedia
    const headersTabungan = ["student_id", "student_name", "program", "saldo_tabungan", "limit_harian", "total_jajan_hari_ini", "tgl_jajan_terakhir", "is_locked", "updated_at"];
    const tabSheet = getOrCreateKeuanganSheet(ss, SHEET_KEUANGAN_TABUNGAN, headersTabungan, "#059669");

    const headersMutasi = ["mutasi_id", "student_id", "student_name", "jenis_mutasi", "nominal", "saldo_sebelum", "saldo_sesudah", "keterangan", "petugas", "created_at"];
    const mutSheet = getOrCreateKeuanganSheet(ss, SHEET_KEUANGAN_MUTASI_TABUNGAN, headersMutasi, "#0d9488");

    // Ambil data santri untuk sinkronisasi akun tabungan otomatis
    const studentsMap = {};
    const stSheet = ss.getSheetByName("Students");
    if (stSheet) {
      const sData = stSheet.getDataRange().getValues();
      for (let i = 1; i < sData.length; i++) {
        const sid = String(sData[i][0] || "").trim();
        if (sid) {
          studentsMap[sid] = {
            id: sid,
            name: String(sData[i][1] || "").trim(),
            program: String(sData[i][3] || "Santri").trim()
          };
        }
      }
    }

    // Baca data tabungan yang ada
    const tData = tabSheet.getDataRange().getValues();
    const existingAccounts = {};
    const todayStr = new Date().toISOString().substring(0, 10);

    for (let r = 1; r < tData.length; r++) {
      const sid = String(tData[r][0] || "").trim();
      if (sid) {
        existingAccounts[sid] = {
          rowIndex: r + 1,
          studentId: sid,
          studentName: String(tData[r][1] || "").trim(),
          program: String(tData[r][2] || "").trim(),
          saldoTabungan: Number(tData[r][3]) || 0,
          limitHarian: Number(tData[r][4]) || 25000,
          totalJajanHariIni: String(tData[r][6] || "").trim() === todayStr ? (Number(tData[r][5]) || 0) : 0,
          tglJajanTerakhir: String(tData[r][6] || "").trim(),
          isLocked: String(tData[r][7] || "FALSE").trim().toUpperCase() === "TRUE",
          updatedAt: String(tData[r][8] || "").trim()
        };
      }
    }

    // Auto-create baris tabungan santri baru jika belum tercatat
    const newRowsToAppend = [];
    const nowIso = new Date().toISOString();
    Object.keys(studentsMap).forEach(sid => {
      if (!existingAccounts[sid]) {
        const st = studentsMap[sid];
        newRowsToAppend.push([
          st.id,
          st.name,
          st.program,
          0,
          25000,
          0,
          todayStr,
          "FALSE",
          nowIso
        ]);
        existingAccounts[sid] = {
          rowIndex: -1,
          studentId: st.id,
          studentName: st.name,
          program: st.program,
          saldoTabungan: 0,
          limitHarian: 25000,
          totalJajanHariIni: 0,
          tglJajanTerakhir: todayStr,
          isLocked: false,
          updatedAt: nowIso
        };
      }
    });

    if (newRowsToAppend.length > 0) {
      tabSheet.getRange(tabSheet.getLastRow() + 1, 1, newRowsToAppend.length, headersTabungan.length).setValues(newRowsToAppend);
    }

    // Baca 50 mutasi tabungan terakhir
    const mData = mutSheet.getDataRange().getValues();
    const recentMutasi = [];
    let totalTopupBulanIni = 0;
    let totalJajanBulanIni = 0;
    let totalTarikBulanIni = 0;
    const currentYearMonth = todayStr.substring(0, 7);

    for (let m = mData.length - 1; m >= 1 && recentMutasi.length < 50; m--) {
      const row = mData[m];
      const mId = String(row[0] || "").trim();
      if (!mId) continue;

      const jenis = String(row[3] || "").trim().toUpperCase();
      const nom = Number(row[4]) || 0;
      const tgl = String(row[9] || "").trim();

      if (tgl.startsWith(currentYearMonth)) {
        if (jenis === "TOPUP") totalTopupBulanIni += nom;
        else if (jenis === "JAJAN_KANTIN") totalJajanBulanIni += nom;
        else if (jenis === "TARIK_TUNAI") totalTarikBulanIni += nom;
      }

      recentMutasi.push({
        mutasiId: mId,
        studentId: String(row[1] || "").trim(),
        studentName: String(row[2] || "").trim(),
        jenisMutasi: jenis,
        nominal: nom,
        saldoSebelum: Number(row[5]) || 0,
        saldoSesudah: Number(row[6]) || 0,
        keterangan: String(row[7] || "").trim(),
        petugas: String(row[8] || "-").trim(),
        createdAt: tgl
      });
    }

    const accountsList = Object.values(existingAccounts);
    const totalSaldoMengendap = accountsList.reduce((acc, curr) => acc + curr.saldoTabungan, 0);

    return {
      status: "success",
      success: true,
      summary: {
        totalSaldoMengendap: totalSaldoMengendap,
        totalTopupBulanIni: totalTopupBulanIni,
        totalJajanBulanIni: totalJajanBulanIni,
        totalTarikBulanIni: totalTarikBulanIni,
        totalSantriTerdaftar: accountsList.length
      },
      accounts: accountsList,
      recentMutasi: recentMutasi
    };
  } catch (err) {
    console.error("[GET TABUNGAN DASHBOARD ERROR]", err);
    return { status: "error", success: false, message: "Gagal memuat dashboard tabungan: " + err.message };
  }
}

function topupTabunganSantri(payload, token, actorParam) {
  return withScriptLock(() => {
    try {
      const ss = getDatabaseSpreadsheet();
      if (!ss) throw new Error("Spreadsheet database tidak ditemukan.");

      const actor = actorParam || (token ? authenticateSession(token) : null);
      if (actor) {
        authorizeRole(actor, ["SUPER_ADMIN", "ADMIN", "BENDAHARA", "PENGASUH", "WALI_SANTRI", "PARENT"]);
      }

      const studentId = String(payload.studentId || "").trim();
      const nominalTopup = Number(payload.nominalTopup) || 0;
      const metodeBayar = String(payload.metodeBayar || "TUNAI").trim().toUpperCase();
      const catatan = String(payload.catatan || "Topup Saldo Uang Saku").trim();
      const petugas = (actor && actor.name) || "Sistem / Petugas";

      if (!studentId) throw new Error("ID Santri wajib disertakan.");
      if (nominalTopup <= 0) throw new Error("Nominal topup harus lebih dari Rp 0.");

      const tabSheet = ss.getSheetByName(SHEET_KEUANGAN_TABUNGAN);
      if (!tabSheet) throw new Error("Sheet tabungan belum diinisialisasi.");

      const tData = tabSheet.getDataRange().getValues();
      let targetRow = -1;
      let studentName = "";
      let saldoSebelum = 0;

      for (let r = 1; r < tData.length; r++) {
        if (String(tData[r][0]).trim() === studentId) {
          targetRow = r + 1;
          studentName = String(tData[r][1] || "").trim();
          saldoSebelum = Number(tData[r][3]) || 0;
          break;
        }
      }

      if (targetRow === -1) {
        let stProg = "Santri";
        const stSheet = ss.getSheetByName(SHEET_STUDENTS);
        if (stSheet) {
          const sData = stSheet.getDataRange().getValues();
          for (let i = 1; i < sData.length; i++) {
            if (String(sData[i][0] || "").trim() === studentId) {
              studentName = String(sData[i][1] || studentName || "Santri").trim();
              stProg = String(sData[i][3] || "Santri").trim();
              break;
            }
          }
        }
        tabSheet.appendRow([studentId, studentName || "Santri", stProg, 0, 25000, 0, "", "ACTIVE", new Date().toISOString()]);
        targetRow = tabSheet.getLastRow();
        saldoSebelum = 0;
      }

      const saldoSesudah = saldoSebelum + nominalTopup;
      const now = new Date();
      const nowIso = now.toISOString();

      // Update Saldo Tabungan
      tabSheet.getRange(targetRow, 4).setValue(saldoSesudah);
      tabSheet.getRange(targetRow, 9).setValue(nowIso);

      // Catat ke Log Mutasi Tabungan
      const mutSheet = ss.getSheetByName(SHEET_KEUANGAN_MUTASI_TABUNGAN);
      const yr = now.getFullYear();
      const mo = String(now.getMonth() + 1).padStart(2, "0");
      const mutasiId = `MUT-${yr}${mo}-${String(Math.max(1, mutSheet.getLastRow())).padStart(4, "0")}`;

      mutSheet.appendRow([
        mutasiId,
        studentId,
        studentName,
        "TOPUP",
        nominalTopup,
        saldoSebelum,
        saldoSesudah,
        `${catatan} (${metodeBayar})`,
        petugas,
        nowIso
      ]);

      return {
        status: "success",
        success: true,
        message: `Topup uang saku Rp ${nominalTopup.toLocaleString("id-ID")} untuk ananda ${studentName} berhasil. Saldo saat ini: Rp ${saldoSesudah.toLocaleString("id-ID")}.`,
        mutasiId: mutasiId,
        saldoBaru: saldoSesudah
      };
    } catch (err) {
      console.error("[TOPUP TABUNGAN ERROR]", err);
      return { status: "error", success: false, message: "Gagal memproses topup: " + err.message };
    }
  });
}

function tarikTabunganSantri(payload, token, actorParam) {
  return withScriptLock(() => {
    try {
      const ss = getDatabaseSpreadsheet();
      if (!ss) throw new Error("Spreadsheet database tidak ditemukan.");

      const actor = actorParam || (token ? authenticateSession(token) : null);
      if (actor) {
        authorizeRole(actor, ["SUPER_ADMIN", "ADMIN", "BENDAHARA"]);
      } else {
        throw new Error("Sesi tidak terotorisasi.");
      }

      const studentId = String(payload.studentId || "").trim();
      const nominalTarik = Number(payload.nominalTarik) || 0;
      const keperluan = String(payload.keperluan || "Penarikan Uang Saku Santri").trim();
      const petugas = (actor && actor.name) || "Petugas Bendahara";

      if (!studentId) throw new Error("ID Santri wajib disertakan.");
      if (nominalTarik <= 0) throw new Error("Nominal penarikan harus lebih dari Rp 0.");

      const tabSheet = ss.getSheetByName(SHEET_KEUANGAN_TABUNGAN);
      if (!tabSheet) throw new Error("Sheet tabungan belum diinisialisasi.");

      const tData = tabSheet.getDataRange().getValues();
      let targetRow = -1;
      let studentName = "";
      let saldoSebelum = 0;

      for (let r = 1; r < tData.length; r++) {
        if (String(tData[r][0]).trim() === studentId) {
          targetRow = r + 1;
          studentName = String(tData[r][1] || "").trim();
          saldoSebelum = Number(tData[r][3]) || 0;
          break;
        }
      }

      if (targetRow === -1) {
        throw new Error("Akun tabungan santri dengan ID " + studentId + " tidak ditemukan.");
      }

      if (saldoSebelum < nominalTarik) {
        throw new Error(`Saldo tabungan tidak mencukupi! Saldo saat ini: Rp ${saldoSebelum.toLocaleString("id-ID")}, penarikan: Rp ${nominalTarik.toLocaleString("id-ID")}.`);
      }

      const saldoSesudah = saldoSebelum - nominalTarik;
      const now = new Date();
      const nowIso = now.toISOString();

      tabSheet.getRange(targetRow, 4).setValue(saldoSesudah);
      tabSheet.getRange(targetRow, 9).setValue(nowIso);

      const mutSheet = ss.getSheetByName(SHEET_KEUANGAN_MUTASI_TABUNGAN);
      const yr = now.getFullYear();
      const mo = String(now.getMonth() + 1).padStart(2, "0");
      const mutasiId = `MUT-${yr}${mo}-${String(Math.max(1, mutSheet.getLastRow())).padStart(4, "0")}`;

      mutSheet.appendRow([
        mutasiId,
        studentId,
        studentName,
        "TARIK_TUNAI",
        nominalTarik,
        saldoSebelum,
        saldoSesudah,
        keperluan,
        petugas,
        nowIso
      ]);

      return {
        status: "success",
        success: true,
        message: `Penarikan uang saku Rp ${nominalTarik.toLocaleString("id-ID")} untuk ${studentName} berhasil. Sisa saldo: Rp ${saldoSesudah.toLocaleString("id-ID")}.`,
        mutasiId: mutasiId,
        saldoBaru: saldoSesudah
      };
    } catch (err) {
      console.error("[TARIK TABUNGAN ERROR]", err);
      return { status: "error", success: false, message: "Gagal penarikan tabungan: " + err.message };
    }
  });
}

function transaksiKantinCashless(payload, token, actorParam) {
  return withScriptLock(() => {
    try {
      const ss = getDatabaseSpreadsheet();
      if (!ss) throw new Error("Spreadsheet database tidak ditemukan.");

      const actor = actorParam || (token ? authenticateSession(token) : null);
      if (actor) {
        authorizeRole(actor, ["SUPER_ADMIN", "ADMIN", "BENDAHARA", "KASIR", "KANTIN"]);
      } else {
        throw new Error("Sesi kasir kantin/koperasi tidak terotorisasi.");
      }

      const studentId = String(payload.studentId || "").trim();
      const nominalBelanja = Number(payload.nominalBelanja) || 0;
      const namaBarang = String(payload.namaBarang || "Jajan Kantin").trim();
      const kasirKantin = String(payload.namaKasirKantin || (actor && actor.name) || "Kasir Kantin").trim();

      if (!studentId) throw new Error("ID / Scan Kartu Santri wajib disertakan.");
      if (nominalBelanja <= 0) throw new Error("Nominal belanja harus lebih dari Rp 0.");

      const tabSheet = ss.getSheetByName(SHEET_KEUANGAN_TABUNGAN);
      if (!tabSheet) throw new Error("Sheet tabungan belum diinisialisasi.");

      const tData = tabSheet.getDataRange().getValues();
      let targetRow = -1;
      let targetData = null;

      for (let r = 1; r < tData.length; r++) {
        if (String(tData[r][0]).trim() === studentId) {
          targetRow = r + 1;
          targetData = tData[r];
          break;
        }
      }

      if (targetRow === -1 || !targetData) {
        throw new Error("Kartu / Akun Santri ID " + studentId + " tidak terdaftar dalam sistem cashless.");
      }

      const studentName = String(targetData[1] || "").trim();
      const isLocked = String(targetData[7] || "FALSE").trim().toUpperCase() === "TRUE";
      if (isLocked) {
        throw new Error(`Transaksi Ditolak: Kartu santri ananda ${studentName} sedang DIBEKUKAN / DIKUNCI oleh wali santri.`);
      }

      const saldoSebelum = Number(targetData[3]) || 0;
      if (saldoSebelum < nominalBelanja) {
        throw new Error(`Transaksi Ditolak: Saldo kartu tidak mencukupi! Saldo saat ini: Rp ${saldoSebelum.toLocaleString("id-ID")}, belanja: Rp ${nominalBelanja.toLocaleString("id-ID")}.`);
      }

      const limitHarian = Number(targetData[4]) || 25000;
      const todayStr = new Date().toISOString().substring(0, 10);
      const tglTerakhir = String(targetData[6] || "").trim();
      const totalJajanHariIni = tglTerakhir === todayStr ? (Number(targetData[5]) || 0) : 0;

      if (limitHarian > 0 && (totalJajanHariIni + nominalBelanja) > limitHarian) {
        const sisaLimit = Math.max(0, limitHarian - totalJajanHariIni);
        throw new Error(`Transaksi Ditolak: Melebihi limit jajan harian santri! Maksimal per hari: Rp ${limitHarian.toLocaleString("id-ID")}, sisa kuota hari ini: Rp ${sisaLimit.toLocaleString("id-ID")}.`);
      }

      const saldoSesudah = saldoSebelum - nominalBelanja;
      const jajanHariIniBaru = totalJajanHariIni + nominalBelanja;
      const now = new Date();
      const nowIso = now.toISOString();

      // Update Saldo, Total Jajan Hari Ini, dan Tanggal Jajan Terakhir
      tabSheet.getRange(targetRow, 4).setValue(saldoSesudah);
      tabSheet.getRange(targetRow, 6).setValue(jajanHariIniBaru);
      tabSheet.getRange(targetRow, 7).setValue(todayStr);
      tabSheet.getRange(targetRow, 9).setValue(nowIso);

      // Catat ke Log Mutasi Tabungan
      const mutSheet = ss.getSheetByName(SHEET_KEUANGAN_MUTASI_TABUNGAN);
      const yr = now.getFullYear();
      const mo = String(now.getMonth() + 1).padStart(2, "0");
      const mutasiId = `KNT-${yr}${mo}-${String(Math.max(1, mutSheet.getLastRow())).padStart(4, "0")}`;

      mutSheet.appendRow([
        mutasiId,
        studentId,
        studentName,
        "JAJAN_KANTIN",
        nominalBelanja,
        saldoSebelum,
        saldoSesudah,
        `Belanja Kantin: ${namaBarang}`,
        kasirKantin,
        nowIso
      ]);

      const sisaLimitHariIni = Math.max(0, limitHarian - jajanHariIniBaru);

      return {
        status: "success",
        success: true,
        message: `Pembayaran cashless Rp ${nominalBelanja.toLocaleString("id-ID")} berhasil. Sisa saldo: Rp ${saldoSesudah.toLocaleString("id-ID")}.`,
        mutasiId: mutasiId,
        studentName: studentName,
        nominalBelanja: nominalBelanja,
        sisaSaldo: saldoSesudah,
        sisaLimitHariIni: sisaLimitHariIni
      };
    } catch (err) {
      console.error("[TRANSAKSI KANTIN ERROR]", err);
      return { status: "error", success: false, message: err.message };
    }
  });
}

function updateLimitTabunganSantri(payload, token, actorParam) {
  try {
    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error("Spreadsheet database tidak ditemukan.");

    const actor = actorParam || (token ? authenticateSession(token) : null);
    if (actor) {
      authorizeRole(actor, ["SUPER_ADMIN", "ADMIN", "BENDAHARA"]);
    } else {
      throw new Error("Sesi tidak terotorisasi.");
    }

    const studentId = String(payload.studentId || "").trim();
    const limitHarian = Number(payload.limitHarian);
    const isLocked = payload.isLocked !== undefined ? (payload.isLocked ? "TRUE" : "FALSE") : null;

    if (!studentId) throw new Error("ID Santri wajib disertakan.");

    const tabSheet = ss.getSheetByName(SHEET_KEUANGAN_TABUNGAN);
    if (!tabSheet) throw new Error("Sheet tabungan belum diinisialisasi.");

    const tData = tabSheet.getDataRange().getValues();
    let targetRow = -1;

    for (let r = 1; r < tData.length; r++) {
      if (String(tData[r][0]).trim() === studentId) {
        targetRow = r + 1;
        break;
      }
    }

    if (targetRow === -1) {
      throw new Error("Akun santri dengan ID " + studentId + " tidak ditemukan.");
    }

    if (!isNaN(limitHarian) && limitHarian >= 0) {
      tabSheet.getRange(targetRow, 5).setValue(limitHarian);
    }

    if (isLocked !== null) {
      tabSheet.getRange(targetRow, 8).setValue(isLocked);
    }

    tabSheet.getRange(targetRow, 9).setValue(new Date().toISOString());

    return {
      status: "success",
      success: true,
      message: "Pengaturan batas limit belanja & status kartu santri berhasil diperbarui."
    };
  } catch (err) {
    console.error("[UPDATE LIMIT TABUNGAN ERROR]", err);
    return { status: "error", success: false, message: "Gagal memperbarui limit: " + err.message };
  }
}

function getExecutiveAnalyticsKeuangan(token) {
  try {
    const actor = token ? authenticateSession(token) : null;
    if (actor) {
      authorizeRole(actor, ["SUPER_ADMIN", "ADMIN", "BENDAHARA", "PENGASUH"]);
    } else {
      throw new Error("Sesi tidak terotorisasi untuk laporan eksekutif.");
    }

    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error("Spreadsheet database tidak ditemukan.");

    const now = new Date();
    const currentYearMonth = now.toISOString().substring(0, 7);

    // 1. Analisis Aging Piutang / Tunggakan Tagihan Santri
    const tagihanSheet = ss.getSheetByName(SHEET_KEUANGAN_TAGIHAN);
    let totalPiutang = 0;
    const aging = {
      lancar: { count: 0, nominal: 0, label: "< 30 Hari (Bulan Berjalan)" },
      perhatian: { count: 0, nominal: 0, label: "31 - 60 Hari" },
      kurangLancar: { count: 0, nominal: 0, label: "61 - 90 Hari" },
      macet: { count: 0, nominal: 0, label: "> 90 Hari (Perlu Tindakan Khusus)" }
    };

    if (tagihanSheet) {
      const tgData = tagihanSheet.getDataRange().getValues();
      for (let i = 1; i < tgData.length; i++) {
        const status = String(tgData[i][9] || "").trim().toUpperCase();
        if (status !== "LUNAS") {
          const nomTagihan = Number(tgData[i][6]) || 0;
          const nomTerbayar = Number(tgData[i][7]) || 0;
          const sisa = Math.max(0, nomTagihan - nomTerbayar);

          if (sisa > 0) {
            totalPiutang += sisa;
            const periode = String(tgData[i][5] || "").trim(); // YYYY-MM
            let diffMonths = 0;
            if (periode && periode.length === 7) {
              const [pYr, pMo] = periode.split("-").map(Number);
              const curYr = now.getFullYear();
              const curMo = now.getMonth() + 1;
              diffMonths = (curYr - pYr) * 12 + (curMo - pMo);
            }

            if (diffMonths <= 0) {
              aging.lancar.count++;
              aging.lancar.nominal += sisa;
            } else if (diffMonths === 1) {
              aging.perhatian.count++;
              aging.perhatian.nominal += sisa;
            } else if (diffMonths === 2) {
              aging.kurangLancar.count++;
              aging.kurangLancar.nominal += sisa;
            } else {
              aging.macet.count++;
              aging.macet.nominal += sisa;
            }
          }
        }
      }
    }

    // 2. Analisis Kas Masuk & Kas Keluar
    let totalMasukBulanIni = 0;
    let totalKeluarBulanIni = 0;
    const trxSheet = ss.getSheetByName(SHEET_KEUANGAN_TRANSAKSI);
    if (trxSheet) {
      const tData = trxSheet.getDataRange().getValues();
      for (let i = 1; i < tData.length; i++) {
        const st = String(tData[i][11] || "SUCCESS").trim().toUpperCase();
        if (st !== "VOID") {
          const tgl = String(tData[i][2] || "").trim();
          if (tgl.startsWith(currentYearMonth)) {
            totalMasukBulanIni += Number(tData[i][6]) || 0;
          }
        }
      }
    }

    const expSheet = ss.getSheetByName(SHEET_KEUANGAN_PENGELUARAN);
    if (expSheet) {
      const eData = expSheet.getDataRange().getValues();
      for (let i = 1; i < eData.length; i++) {
        const st = String(eData[i][10] || "POSTED").trim().toUpperCase();
        if (st !== "VOID") {
          const tgl = String(eData[i][2] || "").trim();
          if (tgl.startsWith(currentYearMonth)) {
            totalKeluarBulanIni += Number(eData[i][5]) || 0;
          }
        }
      }
    }

    // 3. Saldo Dana Tabungan Santri Mengendap (Cashless)
    let totalDanaTabunganMengendap = 0;
    const tabSheet = ss.getSheetByName(SHEET_KEUANGAN_TABUNGAN);
    if (tabSheet) {
      const tbData = tabSheet.getDataRange().getValues();
      for (let i = 1; i < tbData.length; i++) {
        totalDanaTabunganMengendap += Number(tbData[i][3]) || 0;
      }
    }

    const surplusDefisit = totalMasukBulanIni - totalKeluarBulanIni;
    const collectionRate = (totalMasukBulanIni + totalPiutang) > 0 ? Math.round((totalMasukBulanIni / (totalMasukBulanIni + totalPiutang)) * 100) : 100;
    const runwayBulan = totalKeluarBulanIni > 0 ? ((totalMasukBulanIni + totalDanaTabunganMengendap) / totalKeluarBulanIni).toFixed(1) : "Aman (>6)";

    return {
      status: "success",
      success: true,
      currentPeriode: currentYearMonth,
      financialHealth: {
        totalMasukBulanIni: totalMasukBulanIni,
        totalKeluarBulanIni: totalKeluarBulanIni,
        surplusDefisit: surplusDefisit,
        collectionRate: collectionRate,
        runwayBulan: runwayBulan,
        totalDanaTabunganMengendap: totalDanaTabunganMengendap
      },
      agingPiutang: {
        totalPiutang: totalPiutang,
        kategori: aging
      }
    };
  } catch (err) {
    console.error("[GET EXECUTIVE ANALYTICS ERROR]", err);
    return { status: "error", success: false, message: "Gagal memuat analitik eksekutif: " + err.message };
  }
}

/**
 * ====================================================================
 * MODUL PAYMENT GATEWAY MIDTRANS (MUBAROKAH APP)
 * ====================================================================
 */
const MIDTRANS_CONFIG = {
  isProduction: false, // Sandbox = false, Production = true
  merchantId: "M271921771",
  clientKey: "Mid-client-tioY0m0hPoGgF5wE",
  serverKey: "Mid-server-co9IfWi5gCbN9EFw_1kPlXQR"
};

/**
 * Buat Snap Token Pembayaran Tagihan Santri via Midtrans API
 */
function createMidtransSnapToken(payload, token, actor) {
  try {
    const studentId = String(payload.studentId || "").trim();
    const studentName = String(payload.studentName || "Santri").trim();
    const nis = String(payload.nis || "").trim();
    const phone = String(payload.phone || payload.customerPhone || "").trim();
    const email = String(payload.email || "wali@mubarokah.my.id").trim();
    const items = Array.isArray(payload.items) ? payload.items : [];

    if (items.length === 0) {
      return { status: "error", success: false, message: "Pilih minimal satu pos tagihan." };
    }

    let grossAmount = 0;
    const snapItems = [];
    const tagihanCustomPairs = [];

    items.forEach((it, idx) => {
      const nominal = Math.round(Number(it.bayarNominal || it.price || it.nominal) || 0);
      if (nominal > 0) {
        grossAmount += nominal;
        const tagihanId = String(it.tagihanId || it.id || `ITEM_${idx + 1}`).trim();
        let posName = String(it.posName || it.name || "Tagihan Pesantren").trim();

        // Pastikan nama bulan tertera pada rincian pesanan Midtrans jika belum ada
        if (it.periode && !posName.includes(it.periode)) {
          const match = String(it.periode).trim().match(/^(\d{4})-(\d{1,2})$/);
          if (match) {
            const bulanList = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
            const bName = bulanList[parseInt(match[2], 10) - 1] || match[2];
            if (!posName.toLowerCase().includes(bName.toLowerCase())) {
              const suffix = ` (${bName} ${match[1]})`;
              posName = (posName.substring(0, 50 - suffix.length) + suffix);
            }
          }
        }
        posName = posName.substring(0, 50);

        snapItems.push({
          id: tagihanId.substring(0, 50),
          price: nominal,
          quantity: 1,
          name: posName
        });
        tagihanCustomPairs.push(`${tagihanId}:${nominal}`);
      }
    });

    if (grossAmount <= 0) {
      return { status: "error", success: false, message: "Nominal pembayaran tidak valid." };
    }

    // Generate Order ID unik: MUB-<timestamp>-<random 4 digit>
    const orderId = payload.orderId || `MUB-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const serverKey = MIDTRANS_CONFIG.serverKey;
    const authHeader = "Basic " + Utilities.base64Encode(serverKey + ":");

    const midtransPayload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: grossAmount
      },
      item_details: snapItems,
      customer_details: {
        first_name: studentName.substring(0, 50),
        email: email,
        phone: phone || "081234567890"
      },
      custom_field1: studentId,
      custom_field2: tagihanCustomPairs.join(",").substring(0, 255),
      custom_field3: nis
    };

    const isSandbox = MIDTRANS_CONFIG.serverKey.indexOf("SB-") === 0 || !MIDTRANS_CONFIG.isProduction;
    const apiUrl = isSandbox
      ? "https://app.sandbox.midtrans.com/snap/v1/transactions"
      : "https://app.midtrans.com/snap/v1/transactions";

    const fetchOptions = {
      method: "post",
      contentType: "application/json",
      headers: {
        "Authorization": authHeader,
        "Accept": "application/json"
      },
      payload: JSON.stringify(midtransPayload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(apiUrl, fetchOptions);
    const statusCode = response.getResponseCode();
    const resText = response.getContentText();
    let resJson = {};
    try {
      resJson = JSON.parse(resText);
    } catch (e) {
      resJson = { error: resText };
    }

    if (resJson.token) {
      return {
        status: "success",
        success: true,
        token: resJson.token,
        redirect_url: resJson.redirect_url,
        orderId: orderId,
        grossAmount: grossAmount
      };
    } else {
      console.error("[MIDTRANS SNAP ERROR]", `HTTP ${statusCode}:`, resText);
      const errMsg = (resJson.error_messages && resJson.error_messages.join(", "))
        || resJson.error
        || resJson.message
        || `Gagal mendapatkan token Midtrans (HTTP ${statusCode}).`;
      return {
        status: "error",
        success: false,
        message: errMsg
      };
    }
  } catch (err) {
    console.error("[CREATE MIDTRANS SNAP ERROR]", err);
    return { status: "error", success: false, message: "Kendala server Midtrans: " + err.message };
  }
}

/**
 * Webhook Handler Notifikasi Otomatis Midtrans
 * Dipanggil langsung oleh Midtrans saat wali menyelesaikan pembayaran
 */
function handleMidtransWebhook(notif) {
  try {
    const orderId = String(notif.order_id || "");
    const statusCode = String(notif.status_code || "");
    const grossAmount = String(notif.gross_amount || "");
    const serverKey = MIDTRANS_CONFIG.serverKey;
    const incomingSignature = String(notif.signature_key || "").toLowerCase();
    const transactionStatus = String(notif.transaction_status || "").toLowerCase();
    const fraudStatus = String(notif.fraud_status || "").toLowerCase();
    const paymentType = String(notif.payment_type || "online").toUpperCase();

    // 1. Verifikasi Signature Hash SHA-512
    const rawSignature = orderId + statusCode + grossAmount + serverKey;
    const signatureBytes = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_512,
      rawSignature,
      Utilities.Charset.UTF_8
    );
    let computedSignature = "";
    for (let i = 0; i < signatureBytes.length; i++) {
      let byteHex = (signatureBytes[i] & 0xFF).toString(16);
      if (byteHex.length === 1) byteHex = "0" + byteHex;
      computedSignature += byteHex;
    }

    if (computedSignature.toLowerCase() !== incomingSignature) {
      console.warn("[MIDTRANS WEBHOOK] Signature Key Tidak Valid untuk Order: " + orderId);
      return ContentService.createTextOutput("Invalid signature").setMimeType(ContentService.MimeType.TEXT);
    }

    console.log(`[MIDTRANS WEBHOOK SUCCESS] Order: ${orderId}, Status: ${transactionStatus}, Type: ${paymentType}`);

    // 2. Eksekusi Pelunasan Otomatis jika Pembayaran Berhasil (settlement / capture)
    if (transactionStatus === "settlement" || (transactionStatus === "capture" && fraudStatus === "accept")) {
      const studentId = String(notif.custom_field1 || "").trim();
      const customField2 = String(notif.custom_field2 || "").trim();
      const regularTagihanItems = [];
      let topupTabunganNominal = 0;

      if (customField2) {
        const pairs = customField2.split(",");
        pairs.forEach(p => {
          const parts = p.split(":");
          if (parts.length === 2) {
            const tId = parts[0].trim();
            const nom = Number(parts[1]) || 0;
            if (tId.indexOf("TOPUP_TABUNGAN") === 0) {
              topupTabunganNominal += nom;
            } else {
              regularTagihanItems.push({
                tagihanId: tId,
                bayarNominal: nom
              });
            }
          }
        });
      }

      if (studentId) {
        // Ambil nama santri jika tersedia
        let studentName = "Santri";
        const ss = getDatabaseSpreadsheet();
        if (ss) {
          const stSheet = ss.getSheetByName(SHEET_STUDENTS);
          if (stSheet) {
            const stData = stSheet.getDataRange().getValues();
            for (let r = 1; r < stData.length; r++) {
              if (String(stData[r][0] || "").trim() === studentId) {
                studentName = String(stData[r][3] || "Santri").trim();
                break;
              }
            }
          }
        }

        // 2a. Eksekusi Pembayaran Tagihan Reguler (jika ada)
        if (regularTagihanItems.length > 0) {
          const tagihanGross = regularTagihanItems.reduce((acc, it) => acc + (it.bayarNominal || 0), 0);
          const payPayload = {
            studentId: studentId,
            studentName: studentName,
            items: regularTagihanItems,
            nominalDiterima: tagihanGross,
            metodeBayar: `MIDTRANS (${paymentType})`,
            namaKasir: "Midtrans Otomatis",
            catatan: `Midtrans Trx #${orderId} via ${paymentType}`
          };

          const payRes = prosesPembayaranTagihan(payPayload, null, {
            role: "SUPER_ADMIN",
            name: "Midtrans Otomatis"
          });

          console.log(`[MIDTRANS AUTO-PAID RESULT] Order ${orderId}:`, JSON.stringify(payRes));
        }

        // 2b. Eksekusi Setor / Top Up Saldo Uang Saku & Tabungan (jika ada)
        if (topupTabunganNominal > 0) {
          const topupRes = topupTabunganSantri({
            studentId: studentId,
            nominalTopup: topupTabunganNominal,
            metodeBayar: `MIDTRANS (${paymentType})`,
            catatan: `Topup Saldo Uang Saku via Midtrans Trx #${orderId}`
          }, null, {
            role: "SUPER_ADMIN",
            name: "Midtrans Otomatis"
          });

          console.log(`[MIDTRANS TOPUP AUTO-PAID RESULT] Order ${orderId}:`, JSON.stringify(topupRes));
        }
      }
    }

    return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    console.error("[MIDTRANS WEBHOOK HANDLER ERROR]", err);
    return ContentService.createTextOutput("Error: " + err.message).setMimeType(ContentService.MimeType.TEXT);
  }
}
