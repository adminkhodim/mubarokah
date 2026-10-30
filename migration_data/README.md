# Panduan Ekspor Data Google Sheets untuk ETL Importer Supabase

Folder ini (`migration_data/`) digunakan oleh skrip otomatis `scripts/migrate_core_domains.js` untuk mengimpor data inti dari spreadsheet lama ke database PostgreSQL Supabase.

## Format Berkas yang Didukung

Anda cukup meletakkan berkas format JSON atau CSV di dalam folder ini dengan penamaan berikut:

1. **`students.json`** (Data Master Santri)
   - Kolom: `student_id`, `nis`, `nik`, `name`, `gender`, `birth_date`, `photo_url`, `program`, `status`
2. **`guardians.json`** (Data Master Wali Santri)
   - Kolom: `identity_id`, `name`, `email`, `phone`, `status`
3. **`tahfidz_capaian.json`** (Akumulasi Progres Tahfidz)
   - Kolom: `student_id`, `student_name`, `juz_aktif`, `halaman_terakhir`, `total_halaman_tuntas`, `nama_halaqah`, `muhafiz_pembina`
4. **`tahfidz_logs.json`** (Catatan Setoran Ziyadah & Muraja'ah Harian)
   - Kolom: `log_id`, `student_id`, `student_name`, `tanggal`, `sesi`, `tipe`, `juz`, `surah`, `total_halaman`, `nilai`, `muhafiz`
5. **`keuangan_tagihan.json`** (Daftar Tagihan Santri)
   - Kolom: `tagihan_id`, `student_id`, `student_name`, `nama_pos`, `periode`, `nominal_tagihan`, `nominal_terbayar`, `sisa_tagihan`, `status`, `due_date`
6. **`keuangan_transaksi.json`** (Bukti Kas Masuk & Pembayaran)
   - Kolom: `transaksi_id`, `no_kuitansi`, `tanggal_bayar`, `student_id`, `student_name`, `nominal_total`, `metode_bayar`, `nama_kasir`

---

## Cara Menjalankan Importer

Setelah berkas diletakkan di folder ini, jalankan perintah di terminal:

```bash
# 1. Mode Uji Coba (Dry-run / Simulasi tanpa menulis ke database)
node scripts/migrate_core_domains.js --dry-run

# 2. Mode Live (Langsung eksekusi & upsert ke PostgreSQL Supabase)
node scripts/migrate_core_domains.js
```

