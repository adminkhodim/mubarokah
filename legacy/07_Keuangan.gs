/**
 * ============================================================================
 * 07_Keuangan.gs
 * PPTQ Roudlotul Mubarokah Backend Architecture - Keuangan, Tabungan, Cashless & Midtrans
 * ============================================================================
 * Tanggung Jawab Domain:
 *  - Inisialisasi Sheet Keuangan & Tarif Master
 *  - Dashboard Keuangan & Rekap Eksekutif
 *  - Tagihan & Billing Santri (generateBulkMonthlyBills, getStudentBilling)
 *  - Transaksi Pembayaran & Kas Masuk
 *  - Kas Keluar & Tutup Kasir Harian
 *  - Konfirmasi Transfer Online & Verifikasi Rekening
 *  - Smart Pesantren Tabungan & Cashless Kantin
 *  - Payment Gateway Midtrans (createMidtransSnapToken, handleMidtransWebhook)
 * ============================================================================
 */


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


function generateBulkYearlyBills(payload, token) {
  return withScriptLock(() => {
    try {
      const ss = getDatabaseSpreadsheet();
      if (!ss) throw new Error("Spreadsheet database tidak ditemukan.");

      const tahunAjaran = String(payload.tahunAjaran || payload.periode || "").trim();
      if (!tahunAjaran) {
        throw new Error("Tahun Ajaran / Periode Tahunan wajib diisi (contoh: 2026/2027).");
      }

      const dueDate = String(payload.dueDate || "").trim();
      const posIds = Array.isArray(payload.posIds) ? payload.posIds.map(String) : [];
      const programFilter = String(payload.programFilter || "SEMUA").trim();
      const targetFilter = String(payload.targetFilter || "SEMUA").trim();

      const tSheet = ss.getSheetByName(SHEET_KEUANGAN_TARIF);
      const tagihanSheet = ss.getSheetByName(SHEET_KEUANGAN_TAGIHAN);
      const studentsSheet = ss.getSheetByName(SHEET_STUDENTS);

      if (!tSheet || !tagihanSheet || !studentsSheet) {
        throw new Error("Sheet database belum lengkap.");
      }

      // 1. Ambil pos tarif tahunan aktif
      const activeTarifs = [];
      const tData = tSheet.getDataRange().getValues();
      for (let i = 1; i < tData.length; i++) {
        const tId = String(tData[i][0]).trim();
        const isAct = String(tData[i][6]).toUpperCase() === "TRUE";
        const kat = String(tData[i][2]).toUpperCase();
        const tip = String(tData[i][3]).toUpperCase();

        const isTahunan = (kat === "TAHUNAN" || tip === "TAHUNAN");
        const isSelected = posIds.length > 0 ? posIds.includes(tId) : isTahunan;

        if (tId && isAct && isSelected) {
          activeTarifs.push({
            tarifId: tId,
            namaPos: String(tData[i][1] || "").trim(),
            nominal: Number(tData[i][4]) || 0,
            program: String(tData[i][5] || "SEMUA").trim()
          });
        }
      }

      if (activeTarifs.length === 0) {
        throw new Error("Tidak ada pos tarif tahunan aktif yang dipilih atau ditemukan.");
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
            const stProg = progIdx !== -1 ? String(sData[i][progIdx] || "").trim() : "Tahfidz";
            if (programFilter === "SEMUA" || stProg.toLowerCase() === programFilter.toLowerCase()) {
              activeStudents.push({
                studentId: sId,
                name: String(sData[i][nameIdx] || "").trim(),
                program: stProg
              });
            }
          }
        }
      }

      if (activeStudents.length === 0) {
        throw new Error("Tidak ada data santri aktif yang sesuai kriteria.");
      }

      // 3. Index tagihan yang sudah ada di periode tahunan ini untuk mencegah duplikasi
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

      // 4. Buat baris tagihan tahunan baru
      const nowIso = new Date().toISOString();
      const newRows = [];
      const cleanThn = tahunAjaran.replace(/[^a-zA-Z0-9]/g, "");

      activeStudents.forEach(st => {
        activeTarifs.forEach(trf => {
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

          const key = `${st.studentId}_${trf.tarifId}_${tahunAjaran}`;
          if (!existingTagihanKeys.has(key)) {
            const tagihanId = `TGH-THN-${cleanThn}-${st.studentId}-${trf.tarifId}`;
            newRows.push([
              tagihanId,
              st.studentId,
              st.name,
              trf.tarifId,
              trf.namaPos,
              tahunAjaran,
              trf.nominal,
              0,          // nominal_terbayar
              trf.nominal,// sisa_tagihan
              "BELUM_BAYAR",
              dueDate || "",
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
        message: `Berhasil menerbitkan ${newRows.length} item tagihan tahunan untuk Tahun Ajaran ${tahunAjaran}.`
      };
    } catch (err) {
      console.error("[GENERATE BULK YEARLY BILLS ERROR]", err);
      return { status: "error", success: false, message: "Gagal menerbitkan tagihan tahunan: " + err.message };
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