# Laporan Perbaikan Navigasi P0 (Navigation Repair P0)
**Proyek:** Mubarokah_App (`C:\Users\pc\Documents\APP\Mubarokah_App`)  
**Mode:** Controlled Source Repair  
**Cakupan:** Desktop & Mobile Menu/Submenu Navigasi  
**Tanggal:** 17 September 2026  

---

## 1. Masalah Awal (Initial Problem)
- Tombol dropdown navigasi desktop di Mubarokah App tidak dapat diakses atau macet (stuck), dan beberapa submenu tidak dapat membuka halaman konten internal terkait.
- Mobile menu drawer dan accordion submenunya memiliki potensi konflik event listener dan penutupan yang kurang terisolasi dari state desktop.
- Terjadi kesalahan konsol `Uncaught SyntaxError: Identifier 'BANNER_CACHE_KEY' has already been declared` yang menyebabkan parsing `js/main.js` dihentikan oleh browser, sehingga fungsi navigasi seperti `switchTab()` tidak terdefinisi pada saat klik dilakukan.

---

## 2. Temuan Forensik (Forensic Findings)
Berdasarkan perbandingan dengan baseline implementasi pada referensi `ASNawiyyah`:
1. **Dropdown Desktop ASNawiyyah murni berbasis CSS `group-hover`:**
   - Menggunakan utilitas Tailwind `group`, `group-hover:opacity-100 group-hover:visible`, dan `pt-2` sebagai jembatan hover mulus.
   - Tidak memerlukan pengendali JavaScript dropdown terpisah (`toggleDeskDropdown`, `closeAllDropdowns`), dan tidak memiliki listener klik dokumen (`document.addEventListener('click')`) yang rentan konflik event propagation.
2. **Kompleksitas Berlebih di Mubarokah:**
   - Menggabungkan CSS `group-hover` dengan manipulasi kelas `.desk-dropdown-open` via `toggleDeskDropdown()` dan `closeAllDropdowns()`.
   - Lebih dari 20 elemen navigasi disematkan pemanggilan inline `closeAllDropdowns()`.
   - Listener global `document.addEventListener('click')` menutup dropdown secara agresif saat berinteraksi dengan elemen grup.
3. **Pemetaan State Aktif `PARENT_DESK_MAP` & `PARENT_MOB_MAP` Mengandung Target Fiktif:**
   - `'ppdb': 'desk-nav-ppdb'` dan `'notifikasi': 'desk-nav-notifikasi'` pada `PARENT_DESK_MAP` mereferensikan ID DOM yang tidak ada di desktop header (tombol aksi PPDB dan Notifikasi berada di kontainer aksi terpisah `desk-action-menu`).
   - Fallback `|| desk-nav-${tabId}` memicu query DOM untuk elemen tak berwujud ketika berada di tab administratif/eksternal.
   - `'kalender'` belum dipetakan ke `mobile-nav-kalender` pada `PARENT_MOB_MAP`.
4. **Deklarasi Variabel Global Bentrok:**
   - `const BANNER_CACHE_KEY` dideklarasikan di `js/admin.js` dan di `js/main.js` pada lingkup skrip global, memicu fatal SyntaxError di Chrome runtime.

---

## 3. Akar Masalah (Exact Root Causes)
1. **Dua Mekanisme Bersaing pada Dropdown Desktop:** Persaingan antara transisi CSS Tailwind `group-hover` dengan state JavaScript `toggleDeskDropdown()` / `closeAllDropdowns()`.
2. **Kopling State Desktop dan Mobile:** `closeMobileMenu()` memanggil `closeAllDropdowns()` yang memicu mutasi kelas DOM yang tidak diperlukan.
3. **Kegagalan Runtime Script Execution:** `Uncaught SyntaxError: Identifier 'BANNER_CACHE_KEY' has already been declared` menghentikan eksekusi seluruh modul `js/main.js`, melumpuhkan fungsi navigasi `switchTab`.

---

## 4. Berkas yang Dimodifikasi (Files Modified)
Hanya berkas yang diizinkan dalam scope P0:
1. [`index.html`](file:///c:/Users/pc/Documents/APP/Mubarokah_App/index.html)
2. [`js/main.js`](file:///c:/Users/pc/Documents/APP/Mubarokah_App/js/main.js)
3. [`docs/walkthrough_navigation_repair_p0.md`](file:///c:/Users/pc/Documents/APP/Mubarokah_App/docs/walkthrough_navigation_repair_p0.md) (Dokumen laporan ini)

---

## 5. Berkas yang TIDAK Dimodifikasi (Files NOT Modified)
Sesuai aturan keamanan ketat:
- Seluruh direktori `legacy/` (`Code.gs`, `Setup.gs`, dll.)
- Seluruh direktori `api/` & skrip backend / Apps Script / Spreadsheet / Drive
- `app-config.js`
- `sw.js` (Service Worker) & `manifest.json`
- `package.json` & `package-lock.json`
- `vercel.json` & konfigurasi deployment
- Seluruh repositori referensi `ASNawiyyah` (tetap terisolasi penuh, 0 mutasi)

---

## 6. Perbaikan Navigasi Desktop (Desktop Navigation Repair)
- Menghapus blok `<style>.desk-dropdown-open ...</style>` dari `index.html`.
- Mengembalikan panel dropdown ke pure CSS transition:
  `class="absolute left-0 top-full pt-2 w-52 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200 z-50"`
- Menghapus `onclick="toggleDeskDropdown(...)"` pada 4 tombol grup induk (Tentang Kami, Pendidikan, Kehidupan Santri, Layanan).
- Menghapus pemanggilan inline `closeAllDropdowns()` dari seluruh tombol navigasi di `index.html`.
- Di `js/main.js`, menghapus fungsi mutasi dropdown kompleks dan menggantinya dengan fungsi compatibility no-op, serta menghapus listener klik global `.group`.

---

## 7. Perbaikan Navigasi Mobile (Mobile Navigation Repair)
- Mempertahankan penuh struktur drawer navigasi `#mobile-nav-drawer` beserta accordion (Tentang Kami, Pendidikan, Kehidupan Santri, Layanan).
- Mengisolasi `closeMobileMenu()` agar hanya memanggil `closeMobileDrawer()` tanpa mencampuri state desktop.
- Menambahkan interaksi penutupan drawer saat klik pada area backdrop (luar menu drawer).
- Menambahkan event listener keyboard `Escape` untuk menutup drawer secara intuitif dan aksesibel.

---

## 8. Perbaikan State Aktif (Active-State Repair)
- Membersihkan `PARENT_DESK_MAP` dengan menghapus entri target DOM fiktif (`ppdb` dan `notifikasi`).
- Mengubah pemilihan tombol desktop aktif agar langsung mengambil dari mapping tanpa fallback sintetis yang tidak valid.
- Memperbaiki `PARENT_MOB_MAP` dengan menambahkan tab `kalender` (`mobile-nav-kalender`) dan menghapus entri tidak valid.
- Menyelesaikan tabrakan pengenal `BANNER_CACHE_KEY` pada `js/main.js` menjadi `MAIN_BANNER_CACHE_KEY`.

---

## 9. Verifikasi Perutean (Routing Verification)
Semua rute internal yang ada tetap berfungsi 100% tanpa perubahan rute atau penamaan ID halaman:
- Beranda (`beranda`)
- Tentang Kami:
  - Profil Singkat (`profil` -> `/tentang-kami/`)
  - Profil & Sejarah (`sejarah-berdirinya` -> `/sejarah-berdirinya`)
  - Visi & Misi (`tujuan-visi-misi` -> `/tujuan-visi-misi`)
  - Struktur Kepengurusan (`struktur-kepengurusan` -> `/struktur-kepengurusan`)
- Pendidikan:
  - Semua Program (`program-pilihan` -> `/pendidikan/semua-program-pilihan/`)
  - SD Islam Unggulan (`sd-islam` -> `/pendidikan/sd-islam-unggulan/`)
  - Pesantren Tahfidz Anak (`tahfidz-anak` -> `/pendidikan/pesantren-tahfidz-anak/`)
  - Pesantren Dewasa Putra (`dewasa-putra` -> `/pendidikan/pesantren-dewasa-putra/`)
  - Pesantren Dewasa Putri (`dewasa-putri` -> `/pendidikan/pesantren-dewasa-putri/`)
- Kehidupan Santri:
  - Jadwal Kegiatan Santri (`jadwal-kegiatan` -> `/kehidupan-santri/jadwal-kegiatan/`)
  - Unit Kegiatan Santri (`unit-kegiatan` -> `/kehidupan-santri/unit-kegiatan/`)
  - Ikatan Alumni (`alumni` -> `/kehidupan-santri/ikatan-alumni/`)
- Berita (`kabar` -> `/berita/`)
- Layanan:
  - Pusat Layanan (`layanan-hub` -> `/layanan/`)
  - Galeri Dokumentasi (`galeri` -> `/layanan/galeri/`)
  - Kalender (`kalender` -> `/layanan/kalender/`)
  - Portal Ibadah (`ibadah` -> `/layanan/portal-ibadah/`)
- PPDB (`ppdb`)

---

## 10. Verifikasi Browser / Runtime (Browser/Runtime Verification)
- Uji runtime browser otomatis mengonfirmasi:
  - Menu drawer mobile membuka dan menutup secara mulus.
  - Seluruh tombol menu bawah (Beranda, Ibadah, Berita, Kalender, Pengaturan) mengarahkan ke halaman terkait dengan indikator aktif yang presisi.
  - Accordion mobile dan link submenu berpindah ke halaman yang tepat dan menutup drawer secara otomatis.
  - Dropdown desktop menggunakan transisi CSS hover mulus tanpa hambatan.

---

## 11. Hasil Konsol Browser (Console Result)
- `Uncaught SyntaxError: Identifier 'BANNER_CACHE_KEY' has already been declared` telah **TERATASI (RESOLVED / GONE)**.
- Tidak ada fatal TypeError, ReferenceError, atau SyntaxError baru yang berasal dari navigasi.
- Seluruh modul skrip utama `js/main.js` terkompilasi dan berjalan normal.

---

## 12. Hasil Pemeriksaan Git (Git Status Result)
```
$ git status --short
 M index.html
 M js/main.js
?? docs/walkthrough_navigation_repair_p0.md
```
- Tidak ada mutasi git commit/push yang dijalankan oleh agen AI.
- Tidak ada berkas lain di luar boundary yang termodifikasi.

---

## 13. Klasifikasi Akhir (Final Classification)

# **PASS**

Semua kriteria penerimaan (Acceptance Criteria) terpenuhi secara sempurna tanpa melanggar batasan keamanan proyek.
