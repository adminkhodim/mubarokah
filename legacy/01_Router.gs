/**
 * ============================================================================
 * 01_Router.gs
 * PPTQ Roudlotul Mubarokah Backend Architecture - HTTP Gateway & Request Router
 * ============================================================================
 * Tanggung Jawab Domain:
 *  - HTTP POST Gateway (doPost): Action dispatcher, payload parsing, CORS handling,
 *    unified RBAC guards, dan payload routing ke domain handler.
 *  - HTTP GET Gateway (doGet): Public query dispatcher, fallback status envelope.
 *  - Drive Permission Helper (mintaIzinDrive).
 * ============================================================================
 */


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
if (action === "generateBulkYearlyBills" || action === "keuangan.generateTahunan" || action === "generateBulkYearlyTagihan") {
      const token = payload.token || (payload.data && payload.data.token) || "";
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["SUPER_ADMIN", "ADMIN", "BENDAHARA"]);
        return createJsonResponse(generateBulkYearlyBills(payload.data || payload, token, actor));
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
