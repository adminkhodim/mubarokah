/**
 * ====================================================================
 * 1-CLICK EXPORTER GOOGLE SHEETS KE JSON UNTUK MIGRASI SUPABASE
 * ====================================================================
 * Salin fungsi ini ke Editor Google Apps Script proyek pesantren Anda:
 * 1. Buka Apps Script (script.google.com)
 * 2. Buat file baru (atau tempel di baris paling bawah)
 * 3. Pilih fungsi 'exportAllSheetsToJson' di toolbar atas
 * 4. Klik 'Run'
 * 
 * Hasil ekspor otomatis tersimpan di Google Drive dalam folder 'MUBAROKAH_MIGRATION_DATA'.
 */

function exportAllSheetsToJson() {
  // Gunakan fungsi getDatabaseSpreadsheet() bawaan proyek atau buka langsung via ID
  const ss = (typeof getDatabaseSpreadsheet === 'function') 
    ? getDatabaseSpreadsheet() 
    : SpreadsheetApp.openById("1cZSRh2rtKpT6E8m3GFJonVbiQG51fh24eN8J5JWtOJY");

  if (!ss) {
    throw new Error("Spreadsheet database tidak ditemukan. Pastikan SPREADSHEET_ID valid.");
  }
  const sheetsToExport = [
    { sheetName: "Students", fileName: "students.json" },
    { sheetName: "Tahfidz_Capaian", fileName: "tahfidz_capaian.json" },
    { sheetName: "Tahfidz_Logs", fileName: "tahfidz_logs.json" },
    { sheetName: "Keuangan_Tagihan", fileName: "keuangan_tagihan.json" },
    { sheetName: "Keuangan_Transaksi", fileName: "keuangan_transaksi.json" },
    { sheetName: "Wali_Identities", fileName: "guardians.json" }
  ];

  let folderIterator = DriveApp.getFoldersByName("MUBAROKAH_MIGRATION_DATA");
  let folder = folderIterator.hasNext() ? folderIterator.next() : DriveApp.createFolder("MUBAROKAH_MIGRATION_DATA");

  Logger.log("=================================================");
  Logger.log("MEMULAI EKSPOR OTOMATIS DATA GOOGLE SHEETS...");
  Logger.log("Folder Tujuan Google Drive: " + folder.getName());
  Logger.log("=================================================");

  sheetsToExport.forEach(item => {
    // Cari sheet berdasarkan variasi nama (case-insensitive & spasi/underscore)
    let sheet = ss.getSheetByName(item.sheetName);
    if (!sheet) {
      const targetClean = item.sheetName.toLowerCase().replace(/[\s_]+/g, "");
      const allSheets = ss.getSheets();
      for (let s = 0; s < allSheets.length; s++) {
        if (allSheets[s].getName().toLowerCase().replace(/[\s_]+/g, "") === targetClean) {
          sheet = allSheets[s];
          break;
        }
      }
    }

    if (!sheet) {
      Logger.log("⚠️ Sheet '" + item.sheetName + "' tidak ditemukan, dilewati.");
      return;
    }

    const data = sheet.getDataRange().getValues();
    if (!data || data.length <= 1) {
      Logger.log("ℹ️ Sheet '" + item.sheetName + "' masih kosong, dilewati.");
      return;
    }

    const headers = data[0].map(h => String(h || "").trim().toLowerCase().replace(/[\s\-_]+/g, "_"));
    const records = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row.every(cell => cell === "" || cell === null || cell === undefined)) continue;
      const obj = {};
      headers.forEach((h, idx) => {
        let val = row[idx];
        if (val instanceof Date) {
          val = Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
        }
        obj[h] = val;
      });
      records.push(obj);
    }

    // Buang file lama dengan nama yang sama jika ada di folder
    const existingFiles = folder.getFilesByName(item.fileName);
    while (existingFiles.hasNext()) {
      existingFiles.next().setTrashed(true);
    }

    folder.createFile(item.fileName, JSON.stringify(records, null, 2), "application/json");
    Logger.log("✅ BERHASIL: " + item.sheetName + " -> " + item.fileName + " (" + records.length + " baris)");
  });

  Logger.log("=================================================");
  Logger.log("🎉 SELURUH DATA BERHASIL DIEKSPOR KE GOOGLE DRIVE!");
  Logger.log("Buka folder Google Drive Anda: " + folder.getUrl());
  Logger.log("=================================================");
}

