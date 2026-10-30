/**
 * ============================================================================
 * 04_Tahfidz.gs
 * PPTQ Roudlotul Mubarokah Backend Architecture - Modul Tahfidz Al-Qur'an Terintegrasi
 * ============================================================================
 * Tanggung Jawab Domain:
 *  - Mutaba'ah & Riwayat Setoran Tahfidz (saveTahfidzLog, deleteTahfidzLog, saveTahfidzCapaian)
 *  - Kurikulum Tahfidz & Progress Calculation (getNextTahfidzCurriculumPosition_, etc.)
 *  - Halaqah Management & Santri Plotting (saveTahfidzHalaqah, saveTahfidzPlotting)
 *  - Target Tahfidz Individu & Bulk Target
 *  - Rekap Capaian & Deduplikasi Real-Time
 *  - Jadwal Sesi Tahfidz Waktu & Presensi
 *  - Dashboard Agregat Makro & Detail Santri
 *  - Perizinan Asatidz & Badal Halaqah
 * ============================================================================
 */


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
