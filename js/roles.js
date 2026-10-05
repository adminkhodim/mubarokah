/**
 * Mubarokah_App - Manajemen Peran & Matriks Hak Akses (RBAC)
 * Author: Antigravity IDE
 * Description: Modul kontrol hierarki peran (Role-Based Access Control)
 *              Menyediakan visualisasi matriks hak akses, inspektor peran,
 *              dan integrasi akun pengguna sesuai pedoman keamanan sistem.
 */

(function (window, document) {
    'use strict';

    // Definisi Master 7 Peran Resmi Sistem
    const ROLE_DEFINITIONS = {
        'SUPER_ADMIN': {
            key: 'SUPER_ADMIN',
            name: 'Super Administrator',
            shortName: 'Super Admin',
            tier: 'Tier 1 - Root / Eksekutif',
            badgeBg: 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border-purple-200/60 dark:border-purple-800/40',
            pillBg: 'bg-purple-600 text-white',
            borderColor: 'border-purple-300 dark:border-purple-800',
            icon: 'fa-crown',
            iconColor: 'text-purple-600 dark:text-purple-400',
            summary: 'Otoritas tertinggi sistem dengan kendali mutlak atas seluruh modul, basis data, konfigurasi teknis, dan penetapan peran pengguna.',
            capabilities: [
                'Akses 100% seluruh modul dan fitur aplikasi tanpa batasan',
                'Hak eksklusif membuat, mengubah, dan menetapkan peran Super Admin lain',
                'Akses langsung konfigurasi sistem, database Sheet, dan integrasi API',
                'Kemampuan audit log dan manajemen keamanan tingkat lanjut'
            ],
            scopeNote: 'Dibatasi hanya untuk administrator inti dan penanggung jawab teknis pesantren.'
        },
        'ADMIN': {
            key: 'ADMIN',
            name: 'Administrator Lembaga',
            shortName: 'Admin',
            tier: 'Tier 1 - Pengelola Operasional',
            badgeBg: 'bg-brand-100 text-brand-800 dark:bg-brand-950/80 dark:text-brand-300 border-brand-200/60 dark:border-brand-800/40',
            pillBg: 'bg-brand-700 text-white',
            borderColor: 'border-brand-300 dark:border-brand-800',
            icon: 'fa-shield-halved',
            iconColor: 'text-brand-600 dark:text-brand-400',
            summary: 'Pengelola operasional harian pondok yang mengatur data santri, akademik, kepengurusan, publikasi konten, dan akun pengguna standar.',
            capabilities: [
                'Mengelola Master Data Santri, Pegawai, dan Akademik',
                'Mengatur publikasi Berita, Banner Slider, dan Galeri Pondok',
                'Membuat & memverifikasi akun Wali Santri, Asatidz, Pengurus, dan Bendahara',
                'Melihat laporan rekapitulasi seluruh unit pesantren'
            ],
            scopeNote: 'Tidak dapat mengubah akun berstatus Super Admin untuk mencegah eskalasi privilese.'
        },
        'PENGASUH': {
            key: 'PENGASUH',
            name: 'Dewan Masyayikh / Pengasuh',
            shortName: 'Pengasuh',
            tier: 'Tier 2 - Pengawasan & Kebijakan',
            badgeBg: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/40',
            pillBg: 'bg-amber-600 text-white',
            borderColor: 'border-amber-300 dark:border-amber-800',
            icon: 'fa-hands-praying',
            iconColor: 'text-amber-600 dark:text-amber-400',
            summary: 'Akses khusus Dewan Masyayikh untuk supervisi menyeluruh perkembangan santri, tahfidz, sorogan, kedisiplinan, dan kegiatan pondok tanpa beban input operasional.',
            capabilities: [
                'Dashboard Eksekutif Pengawasan Santri & Mutaba\'ah Qur\'an',
                'Monitoring capaian hafalan Tahfidz, TPQ Yanbu\'a, dan Sorogan',
                'Melihat rekap kehadiran santri dan ketertiban pesantren',
                'Read-Only mode aman: melindungi data agar tidak terhapus tanpa sengaja'
            ],
            scopeNote: 'Didesain bersih, ringkas, dan fokus pada analitik pertumbuhan santri.'
        },
        'ASATIDZ': {
            key: 'ASATIDZ',
            name: 'Dewan Asatidz / Pengajar',
            shortName: 'Asatidz',
            tier: 'Tier 2 - Akademik & Pembelajaran',
            badgeBg: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border-indigo-200/60 dark:border-indigo-800/40',
            pillBg: 'bg-indigo-600 text-white',
            borderColor: 'border-indigo-300 dark:border-indigo-800',
            icon: 'fa-chalkboard-user',
            iconColor: 'text-indigo-600 dark:text-indigo-400',
            summary: 'Guru pengampu pembelajaran dan pengasuh halaqah untuk menginput setoran hafalan, mutaba\'ah harian santri, presensi, dan penilaian berkala.',
            capabilities: [
                'Entri & validasi setoran hafalan Tahfidz Al-Qur\'an',
                'Simakan & mutaba\'ah TPQ metode Yanbu\'a (8 tingkat jilid)',
                'Simakan Sorogan Al-Qur\'an dan Bandongan Kitab',
                'Input presensi kehadiran halaqah dan jadwal mengajar'
            ],
            scopeNote: 'Fokus pada pencatatan kemajuan belajar santri binaannya.'
        },
        'PENGURUS': {
            key: 'PENGURUS',
            name: 'Pengurus / Kesantrian',
            shortName: 'Pengurus',
            tier: 'Tier 2 - Kesantrian & Lapangan',
            badgeBg: 'bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300 border-teal-200/60 dark:border-teal-800/40',
            pillBg: 'bg-teal-600 text-white',
            borderColor: 'border-teal-300 dark:border-teal-800',
            icon: 'fa-clipboard-user',
            iconColor: 'text-teal-600 dark:text-teal-400',
            summary: 'Staf operasional dan pengurus harian pondok yang mengawal ketertiban santri, absensi kegiatan, dokumentasi, ekstrakurikuler, dan PPDB.',
            capabilities: [
                'Pemindaian QR Code dan rekapitulasi Presensi Santri',
                'Pengelolaan Unit Kegiatan Santri (UKS) dan ekstra santri',
                'Pengelolaan pendaftar PPDB Online dan berkas seleksi',
                'Publikasi kabar santri, berita agenda, dan galeri pondok'
            ],
            scopeNote: 'Menangani tata kelola disiplin dan interaksi sosial santri di asrama.'
        },
        'BENDAHARA': {
            key: 'BENDAHARA',
            name: 'Bendahara / Keuangan',
            shortName: 'Bendahara',
            tier: 'Tier 2 - Keuangan & Administrasi',
            badgeBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/40',
            pillBg: 'bg-emerald-600 text-white',
            borderColor: 'border-emerald-300 dark:border-emerald-800',
            icon: 'fa-wallet',
            iconColor: 'text-emerald-600 dark:text-emerald-400',
            summary: 'Petugas administrasi keuangan yang mencatat pembayaran SPP, syahriah, uang gedung, tabungan santri, serta rekapitulasi kas masuk/keluar pondok.',
            capabilities: [
                'Pencatatan pembayaran SPP santri dan cetak kuitansi digital',
                'Verifikasi konfirmasi transfer pembayaran dari Wali Santri',
                'Rekapitulasi tunggakan dan riwayat iuran santri',
                'Laporan rekap kas per periode untuk transparansi yayasan'
            ],
            scopeNote: 'Memiliki isolasi hak akses terhadap data keuangan yang sensitif.'
        },
        'WALI_SANTRI': {
            key: 'WALI_SANTRI',
            name: 'Wali Santri / Orang Tua',
            shortName: 'Wali Santri',
            tier: 'Tier 3 - Eksternal / Portal Wali',
            badgeBg: 'bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border-sky-200/60 dark:border-sky-800/40',
            pillBg: 'bg-sky-600 text-white',
            borderColor: 'border-sky-300 dark:border-sky-800',
            icon: 'fa-user-group',
            iconColor: 'text-sky-600 dark:text-sky-400',
            summary: 'Orang tua atau wali yang terhubung secara khusus dengan data santri putra-putrinya melalui verifikasi NIS dan nomor telepon.',
            capabilities: [
                'Melihat mutaba\'ah setoran Tahfidz, TPQ, dan Sorogan anak',
                'Melihat riwayat presensi harian, sholat, dan kegiatan anak',
                'Mengecek status tagihan SPP dan riwayat pembayaran resmi',
                'Menerima notifikasi perkembangan belajar dan pengumuman pondok'
            ],
            scopeNote: 'Data terisolasi ketat: hanya dapat melihat data santri yang terhubung dengan akunnya.'
        }
    };

    // =========================================================================
    // KAMUS HAK AKSES & MODUL GRANULAR (Mengadopsi Standar KHODIM.COM)
    // =========================================================================
    const PERMISSION_CATEGORIES = [
        {
            key: 'kesantrian',
            label: 'KESANTRIAN & KESISWAAN',
            icon: 'fa-users',
            color: 'emerald',
            items: [
                { key: 'santri.view', label: 'Melihat Data & Profil Santri', desc: 'Akses membaca daftar santri dan rincian data kesantrian' },
                { key: 'santri.create', label: 'Pendaftaran Santri Baru', desc: 'Izin menambahkan santri baru ke dalam database' },
                { key: 'santri.edit', label: 'Mengubah Data Santri', desc: 'Izin memperbarui informasi biodata & wali santri' },
                { key: 'santri.delete', label: 'Menghapus Data Santri', desc: 'Izin menghapus data santri dari database' },
                { key: 'santri.export', label: 'Import Excel / Massal', desc: 'Izin mengimpor dan mengekspor data santri dari file .xlsx' },
                { key: 'unit.manage', label: 'Unit Kegiatan Santri (UKS)', desc: 'Akses mengelola ekstrakurikuler & kegiatan asrama' }
            ]
        },
        {
            key: 'akademik',
            label: 'AKADEMIK, QUR\'AN & PEMBELAJARAN',
            icon: 'fa-book-quran',
            color: 'indigo',
            items: [
                { key: 'tahfidz.view', label: 'Melihat Mutaba\'ah Tahfidz', desc: 'Akses melihat rekapitulasi setoran & capaian hafalan 30 juz' },
                { key: 'tahfidz.entry', label: 'Entri Setoran Tahfidz', desc: 'Izin menginput setoran ziyadah & muraja\'ah santri' },
                { key: 'tahfidz.target', label: 'Mengatur Target Tahfidz', desc: 'Izin menentukan target capaian juz santri' },
                { key: 'tpq.view', label: 'Melihat Mutaba\'ah TPQ', desc: 'Akses melihat capaian 8 jilid Kitab Yanbu\'a santri' },
                { key: 'tpq.entry', label: 'Entri Simakan TPQ Yanbu\'a', desc: 'Izin menginput setoran jilid & halaman santri' },
                { key: 'sorogan.view', label: 'Melihat Mutaba\'ah Sorogan', desc: 'Akses melihat riwayat sorogan binnazhar & kitab kuning' },
                { key: 'sorogan.entry', label: 'Entri Simakan Sorogan', desc: 'Izin menginput setoran sorogan Al-Qur\'an & kitab' },
                { key: 'madin.view', label: 'Melihat Jurnal & Rapor Madin', desc: 'Akses melihat presensi kelas, kurikulum kitab & rapor santri' },
                { key: 'madin.entry', label: 'Presensi KBM & Penilaian Madin', desc: 'Izin menginput absensi kelas, jurnal tatap muka & nilai imtihan' },
                { key: 'madin.manage', label: 'Kelola Kelas & Kitab Diniyah', desc: 'Izin menambah atau memperbarui jenjang kelas dan mata pelajaran kitab' },
                { key: 'presensi.view', label: 'Melihat Rekap Presensi', desc: 'Akses memantau grafik kehadiran kegiatan santri' },
                { key: 'presensi.entry', label: 'Checklist & Scan QR Presensi', desc: 'Izin melakukan absensi live kegiatan & sholat' }
            ]
        },
        {
            key: 'keuangan',
            label: 'KEUANGAN & ADMINISTRASI KASIR',
            icon: 'fa-wallet',
            color: 'amber',
            items: [
                { key: 'keuangan.view', label: 'Dashboard & Saldo Kas Pondok', desc: 'Akses memantau ringkasan saldo, mutasi kas, dan statistik pelunasan' },
                { key: 'keuangan.spp', label: 'Loket Kasir & Pembayaran SPP', desc: 'Izin melayani pembayaran langsung di loket kasir & cetak kuitansi' },
                { key: 'keuangan.tagihan', label: 'Kelola Tagihan & Pos Biaya', desc: 'Izin mengatur pos biaya, tarif SPP, dan generate tagihan massal' },
                { key: 'keuangan.verify', label: 'Verifikasi Pembayaran Transfer', desc: 'Izin memvalidasi konfirmasi bukti transfer wali santri' },
                { key: 'keuangan.billing', label: 'WhatsApp Billing & Broadcast', desc: 'Izin mengirim tagihan penagihan & bukti kuitansi via WhatsApp Gateway' },
                { key: 'ppdb.manage', label: 'Pengelolaan Berkas PPDB', desc: 'Akses seleksi berkas calon santri & formulir pendaftaran' }
            ]
        },
        {
            key: 'akuntansi',
            label: 'AKUNTANSI & PEMBUKUAN PESANTREN',
            icon: 'fa-file-invoice-dollar',
            color: 'teal',
            items: [
                { key: 'akuntansi.view', label: 'Melihat Buku Kas & Pembukuan', desc: 'Akses melihat jurnal kas masuk, pengeluaran, dan buku kas pondok' },
                { key: 'akuntansi.transaksi', label: 'Catat Kas Masuk & Kas Keluar', desc: 'Izin mencatat transaksi penerimaan dan pengeluaran operasional' },
                { key: 'akuntansi.tutupkasir', label: 'Tutup Kasir & Rekonsiliasi', desc: 'Izin melakukan proses tutup shift kasir dan rekonsiliasi fisik uang' },
                { key: 'akuntansi.laporan', label: 'Laporan Keuangan & Arus Kas', desc: 'Akses rekapitulasi surplus/defisit, cetak dan ekspor laporan keuangan' }
            ]
        },
        {
            key: 'konten',
            label: 'KONTEN & PUBLIKASI',
            icon: 'fa-newspaper',
            color: 'sky',
            items: [
                { key: 'berita.manage', label: 'Manajemen Berita & Pengumuman', desc: 'Izin menerbitkan artikel, agenda pondok, dan warta santri' },
                { key: 'banner.manage', label: 'Manajemen Banner Slider', desc: 'Izin mengubah banner promosi & kegiatan beranda' },
                { key: 'galeri.manage', label: 'Manajemen Galeri Foto', desc: 'Izin mengunggah album dokumentasi kegiatan santri' },
                { key: 'notifikasi.broadcast', label: 'Broadcast Pesan & Notifikasi', desc: 'Izin mengirim notifikasi pengumuman ke akun santri/wali' }
            ]
        },
        {
            key: 'kelembagaan',
            label: 'KELEMBAGAAN & PENGATURAN SISTEM',
            icon: 'fa-building-columns',
            color: 'purple',
            items: [
                { key: 'profil.manage', label: 'Profil Lembaga & Pengurus', desc: 'Izin mengubah struktur kepengurusan & sejarah pondok' },
                { key: 'pegawai.manage', label: 'Data Pegawai & Asatidz', desc: 'Akses mengelola data staf & dewan asatidz' },
                { key: 'users.manage', label: 'Manajemen Akun Pengguna', desc: 'Izin membuat, reset sandi, dan status akun' },
                { key: 'roles.manage', label: 'Manajemen Peran (RBAC)', desc: 'Hak khusus mengatur checklist izin peran pengguna' },
                { key: 'system.config', label: 'Konfigurasi Sistem & API', desc: 'Akses kunci integrasi Google Sheets & token sistem' }
            ]
        }
    ];

    // Pemetaan Modul Sistem ke Izin Terkait
    const MODULE_TO_PERMISSIONS = {
        'santri': ['santri.view', 'santri.create', 'santri.edit'],
        'tahfidz': ['tahfidz.view', 'tahfidz.entry'],
        'tpq': ['tpq.view', 'tpq.entry'],
        'sorogan': ['sorogan.view', 'sorogan.entry'],
        'madin': ['madin.view', 'madin.entry', 'madin.manage'],
        'presensi': ['presensi.view', 'presensi.entry'],
        'ppdb': ['ppdb.manage'],
        'program': ['unit.manage', 'profil.manage'],
        'unit-kegiatan': ['unit.manage'],
        'users': ['users.manage'],
        'roles': ['roles.manage'],
        'pegawai': ['pegawai.manage'],
        'berita': ['berita.manage'],
        'banner': ['banner.manage'],
        'galeri': ['galeri.manage'],
        'notifikasi': ['notifikasi.broadcast'],
        'profil-lembaga': ['profil.manage'],
        'pengaturan': ['system.config'],
        'keuangan': ['keuangan.view', 'keuangan.spp', 'keuangan.tagihan', 'keuangan.verify', 'keuangan.billing'],
        'akuntansi': ['akuntansi.view', 'akuntansi.transaksi', 'akuntansi.tutupkasir', 'akuntansi.laporan']
    };

    // Default Baseline Permissions per Role
    const DEFAULT_ROLE_PERMISSIONS_MAP = {
        'SUPER_ADMIN': ['*'],
        'ADMIN': [
            'santri.view', 'santri.create', 'santri.edit', 'santri.export', 'unit.manage',
            'tahfidz.view', 'tahfidz.entry', 'tahfidz.target', 'tpq.view', 'tpq.entry', 'sorogan.view', 'sorogan.entry',
            'madin.view', 'madin.entry', 'madin.manage', 'presensi.view', 'presensi.entry',
            'keuangan.view', 'keuangan.spp', 'keuangan.tagihan', 'keuangan.verify', 'keuangan.billing',
            'akuntansi.view', 'akuntansi.transaksi', 'akuntansi.tutupkasir', 'akuntansi.laporan',
            'ppdb.manage',
            'berita.manage', 'banner.manage', 'galeri.manage', 'notifikasi.broadcast',
            'profil.manage', 'pegawai.manage', 'users.manage', 'roles.manage', 'system.config'
        ],
        'ASATIDZ': [
            'santri.view',
            'tahfidz.view', 'tahfidz.entry', 'tahfidz.target', 'tpq.view', 'tpq.entry', 'sorogan.view', 'sorogan.entry',
            'madin.view', 'madin.entry', 'madin.manage', 'presensi.view', 'presensi.entry',
            'pegawai.manage', 'profil.manage'
        ],
        'BENDAHARA': [
            'santri.view', 'ppdb.manage',
            'keuangan.view', 'keuangan.spp', 'keuangan.tagihan', 'keuangan.verify', 'keuangan.billing',
            'akuntansi.view', 'akuntansi.transaksi', 'akuntansi.tutupkasir', 'akuntansi.laporan',
            'notifikasi.broadcast', 'pegawai.manage', 'profil.manage'
        ],
        'PENGURUS': [
            'santri.view', 'presensi.view', 'presensi.entry', 'unit.manage', 'ppdb.manage', 'berita.manage', 'banner.manage', 'galeri.manage', 'notifikasi.broadcast', 'profil.manage'
        ],
        'PENGASUH': [
            'santri.view', 'tahfidz.view', 'tpq.view', 'sorogan.view', 'madin.view', 'presensi.view', 'unit.manage', 'ppdb.manage',
            'keuangan.view', 'akuntansi.view', 'akuntansi.laporan',
            'berita.manage', 'galeri.manage', 'profil.manage', 'pegawai.manage'
        ],
        'WALI_SANTRI': [
            'santri.view', 'tahfidz.view', 'tpq.view', 'sorogan.view', 'madin.view', 'presensi.view', 'keuangan.view', 'berita.manage', 'galeri.manage', 'profil.manage'
        ]
    };

    // State Permissions Aktif (Diambil dari Local Storage / Backend)
    let ROLE_PERMISSIONS_STATE = (function() {
        try {
            const cached = localStorage.getItem('MUBAROKAH_ROLE_PERMS_CACHE');
            if (cached) return JSON.parse(cached);
        } catch (e) {}
        return JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS_MAP));
    })();

    let currentConfiguringRole = null;
    let currentModalPermissions = [];

    // Matriks Hak Akses per Modul Sistem (CRUD & Permissions)
    // Nilai akses: 'full' (CRUD), 'write' (Input/Edit Mutabaah), 'read' (Lihat Saja), 'none' (Tertutup)
    const MODULE_PERMISSIONS_MATRIX = [
        {
            category: 'Kesiswaan & Akademik',
            module: 'Master Data Santri',
            icon: 'fa-users',
            desc: 'Biodata santri, NIS, kelas, wali, dan status aktif.',
            permissions: {
                SUPER_ADMIN: 'full',
                ADMIN: 'full',
                PENGASUH: 'read',
                ASATIDZ: 'read',
                PENGURUS: 'read',
                BENDAHARA: 'read',
                WALI_SANTRI: 'read_own'
            }
        },
        {
            category: 'Kesiswaan & Akademik',
            module: 'Tahfidz Al-Qur\'an',
            icon: 'fa-book-quran',
            desc: 'Hafalan 30 juz, rekapitulasi, target, mutaba\'ah & estimasi khatam.',
            permissions: {
                SUPER_ADMIN: 'full',
                ADMIN: 'full',
                PENGASUH: 'read',
                ASATIDZ: 'write',
                PENGURUS: 'read',
                BENDAHARA: 'none',
                WALI_SANTRI: 'read_own'
            }
        },
        {
            category: 'Kesiswaan & Akademik',
            module: 'TPQ Yanbu\'a',
            icon: 'fa-book-open',
            desc: 'Mutaba\'ah 8 tingkat jilid Yanbu\'a (356 hal), simakan & matriks.',
            permissions: {
                SUPER_ADMIN: 'full',
                ADMIN: 'full',
                PENGASUH: 'read',
                ASATIDZ: 'write',
                PENGURUS: 'read',
                BENDAHARA: 'none',
                WALI_SANTRI: 'read_own'
            }
        },
        {
            category: 'Kesiswaan & Akademik',
            module: 'Sorogan Al-Qur\'an',
            icon: 'fa-book-bookmark',
            desc: 'Sorogan tartil, tajwid, makharijul huruf, dan bandongan kitab.',
            permissions: {
                SUPER_ADMIN: 'full',
                ADMIN: 'full',
                PENGASUH: 'read',
                ASATIDZ: 'write',
                PENGURUS: 'read',
                BENDAHARA: 'none',
                WALI_SANTRI: 'read_own'
            }
        },
        {
            category: 'Kesiswaan & Akademik',
            module: 'Presensi & Kehadiran',
            icon: 'fa-calendar-check',
            desc: 'Absensi QR Code, jadwal halaqah, dan rekap ketertiban.',
            permissions: {
                SUPER_ADMIN: 'full',
                ADMIN: 'full',
                PENGASUH: 'read',
                ASATIDZ: 'write',
                PENGURUS: 'full',
                BENDAHARA: 'none',
                WALI_SANTRI: 'read_own'
            }
        },
        {
            category: 'Kesiswaan & Akademik',
            module: 'PPDB Santri Baru',
            icon: 'fa-user-plus',
            desc: 'Form pendaftaran online, seleksi berkas, dan aktivasi santri.',
            permissions: {
                SUPER_ADMIN: 'full',
                ADMIN: 'full',
                PENGASUH: 'read',
                ASATIDZ: 'none',
                PENGURUS: 'write',
                BENDAHARA: 'write',
                WALI_SANTRI: 'none'
            }
        },
        {
            category: 'Kesiswaan & Akademik',
            module: 'Unit Kegiatan (UKS)',
            icon: 'fa-futbol',
            desc: 'Organisasi santri, ekstrakurikuler, dan kegiatan asrama.',
            permissions: {
                SUPER_ADMIN: 'full',
                ADMIN: 'full',
                PENGASUH: 'read',
                ASATIDZ: 'read',
                PENGURUS: 'full',
                BENDAHARA: 'none',
                WALI_SANTRI: 'read'
            }
        },
        {
            category: 'Pengguna & SDM',
            module: 'Manajemen Pengguna',
            icon: 'fa-users-gear',
            desc: 'Akun wali santri, pegawai, admin, reset password, dan status.',
            permissions: {
                SUPER_ADMIN: 'full',
                ADMIN: 'full',
                PENGASUH: 'read',
                ASATIDZ: 'none',
                PENGURUS: 'none',
                BENDAHARA: 'none',
                WALI_SANTRI: 'none'
            }
        },
        {
            category: 'Pengguna & SDM',
            module: 'Manajemen Peran (RBAC)',
            icon: 'fa-shield-halved',
            desc: 'Matriks hak akses, inspeksi wewenang, dan hierarki peran.',
            permissions: {
                SUPER_ADMIN: 'full',
                ADMIN: 'read',
                PENGASUH: 'read',
                ASATIDZ: 'none',
                PENGURUS: 'none',
                BENDAHARA: 'none',
                WALI_SANTRI: 'none'
            }
        },
        {
            category: 'Pengguna & SDM',
            module: 'Data Pegawai & Asatidz',
            icon: 'fa-user-tie',
            desc: 'Master NIP, jabatan, riwayat pengajaran, dan profil staf.',
            permissions: {
                SUPER_ADMIN: 'full',
                ADMIN: 'full',
                PENGASUH: 'read',
                ASATIDZ: 'read_own',
                PENGURUS: 'read',
                BENDAHARA: 'read',
                WALI_SANTRI: 'none'
            }
        },
        {
            category: 'Konten & Publikasi',
            module: 'Berita & Pengumuman',
            icon: 'fa-newspaper',
            desc: 'Artikel pondok, agenda pesantren, dan kabar santri.',
            permissions: {
                SUPER_ADMIN: 'full',
                ADMIN: 'full',
                PENGASUH: 'read',
                ASATIDZ: 'none',
                PENGURUS: 'full',
                BENDAHARA: 'none',
                WALI_SANTRI: 'read'
            }
        },
        {
            category: 'Konten & Publikasi',
            module: 'Banner & Galeri Foto',
            icon: 'fa-images',
            desc: 'Slider beranda, album dokumentasi kegiatan santri.',
            permissions: {
                SUPER_ADMIN: 'full',
                ADMIN: 'full',
                PENGASUH: 'read',
                ASATIDZ: 'none',
                PENGURUS: 'full',
                BENDAHARA: 'none',
                WALI_SANTRI: 'read'
            }
        },
        {
            category: 'Kelembagaan & Pengaturan',
            module: 'Profil Lembaga & Masyayikh',
            icon: 'fa-building-columns',
            desc: 'Sejarah, visi misi, struktur kepengurusan pondok.',
            permissions: {
                SUPER_ADMIN: 'full',
                ADMIN: 'full',
                PENGASUH: 'read',
                ASATIDZ: 'read',
                PENGURUS: 'read',
                BENDAHARA: 'read',
                WALI_SANTRI: 'read'
            }
        },
        {
            category: 'Kelembagaan & Pengaturan',
            module: 'Konfigurasi Sistem',
            icon: 'fa-gears',
            desc: 'Pengaturan API, integrasi sheets, token, dan maintenance.',
            permissions: {
                SUPER_ADMIN: 'full',
                ADMIN: 'none',
                PENGASUH: 'none',
                ASATIDZ: 'none',
                PENGURUS: 'none',
                BENDAHARA: 'none',
                WALI_SANTRI: 'none'
            }
        }
    ];

    let currentRoleFilter = 'ALL';
    let currentActiveRoleModal = null;

    /**
     * Memuat dan merender modul Manajemen Peran
     */
    async function loadAdminRolesData() {
        const loadingEl = document.getElementById('admin-roles-loading');
        if (loadingEl) loadingEl.classList.remove('hidden');

        try {
            // Pastikan data pengguna ter-load agar counter pengguna per role akurat
            if (typeof adminUsersList === 'undefined' || !adminUsersList || adminUsersList.length === 0) {
                if (typeof loadAdminUsersData === 'function') {
                    await loadAdminUsersData();
                }
            }

            // Muat konfigurasi izin peran dari backend
            fetchRolePermissionsFromBackend();

            renderAdminRolesView();
        } catch (err) {
            console.error('[LOAD ROLES ERROR]', err);
            if (typeof showToast === 'function') showToast('⚠️ Terjadi kendala saat merender data peran: ' + err.message);
        } finally {
            if (loadingEl) loadingEl.classList.add('hidden');
        }
    }

    /**
     * Render komponen visual Manajemen Peran
     */
    function renderAdminRolesView() {
        renderRolesSummaryKPIs();
        renderRolesMatrixTable();
        renderRoleCardsGrid();
    }

    /**
     * Hitung total akun per role dari adminUsersList
     */
    function getRoleUserCount(roleKey) {
        if (typeof adminUsersList === 'undefined' || !Array.isArray(adminUsersList)) return 0;
        if (roleKey === 'ASATIDZ') {
            return adminUsersList.filter(u => u.role === 'ASATIDZ' || u.role === 'PEGAWAI' || u.role === 'EDITOR').length;
        }
        return adminUsersList.filter(u => String(u.role || '').toUpperCase() === roleKey).length;
    }

    /**
     * Render KPI Metric Cards
     */
    function renderRolesSummaryKPIs() {
        const totalRolesEl = document.getElementById('role-kpi-total-roles');
        const totalUsersEl = document.getElementById('role-kpi-total-users');
        const totalModulesEl = document.getElementById('role-kpi-total-modules');
        const currentAdminRoleEl = document.getElementById('role-kpi-current-role');

        const totalUsers = typeof adminUsersList !== 'undefined' && Array.isArray(adminUsersList) ? adminUsersList.length : 0;
        
        if (totalRolesEl) totalRolesEl.innerText = Object.keys(ROLE_DEFINITIONS).length;
        if (totalUsersEl) totalUsersEl.innerText = totalUsers;
        if (totalModulesEl) totalModulesEl.innerText = MODULE_PERMISSIONS_MATRIX.length;

        if (currentAdminRoleEl) {
            const role = (typeof ASNIdentity !== 'undefined' && ASNIdentity.currentRole) || 
                         sessionStorage.getItem('ASN_ADMIN_ROLE') || 'ADMIN';
            const meta = ROLE_DEFINITIONS[role] || ROLE_DEFINITIONS['ADMIN'];
            currentAdminRoleEl.innerText = meta.shortName;
        }
    }

    /**
     * Format visual badge sel izin
     */
    function renderPermissionBadge(perm) {
        if (perm === 'full') {
            return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300/60" title="Akses Penuh (CRUD: Buat, Lihat, Edit, Hapus)">
                <i class="fa-solid fa-circle-check text-[9px] mr-1 text-emerald-600"></i>Penuh
            </span>`;
        }
        if (perm === 'write') {
            return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300/60" title="Input & Mutaba'ah (Entri data & sunting)">
                <i class="fa-solid fa-pen-nib text-[9px] mr-1 text-amber-600"></i>Entri
            </span>`;
        }
        if (perm === 'read') {
            return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300 border border-sky-300/60" title="Hanya Lihat (Read-Only)">
                <i class="fa-solid fa-eye text-[9px] mr-1 text-sky-600"></i>Lihat
            </span>`;
        }
        if (perm === 'read_own') {
            return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 dark:bg-teal-950/70 dark:text-teal-300 border border-teal-300/60" title="Lihat Data Anak Terhubung Saja">
                <i class="fa-solid fa-user-lock text-[9px] mr-1 text-teal-600"></i>Milik Sendiri
            </span>`;
        }
        return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 border border-slate-200 dark:border-slate-700/60" title="Tidak Memiliki Akses">
            <i class="fa-solid fa-minus text-[8px] mr-1 text-slate-400"></i>Tutup
        </span>`;
    }

    /**
     * Render Matriks Tabel RBAC
     */
    function renderRolesMatrixTable() {
        const tbody = document.getElementById('admin-roles-matrix-body');
        if (!tbody) return;

        const roleKeys = ['SUPER_ADMIN', 'ADMIN', 'PENGASUH', 'ASATIDZ', 'PENGURUS', 'BENDAHARA', 'WALI_SANTRI'];

        tbody.innerHTML = MODULE_PERMISSIONS_MATRIX.map((item, idx) => {
            const isStriped = idx % 2 === 1 ? 'bg-slate-50/50 dark:bg-[#15202d]/50' : 'bg-white dark:bg-[#15202d]';
            const permCells = roleKeys.map(k => {
                const p = item.permissions[k] || 'none';
                return `<td class="p-3 text-center whitespace-nowrap">${renderPermissionBadge(p)}</td>`;
            }).join('');

            return `
                <tr class="${isStriped} hover:bg-emerald-50/30 dark:hover:bg-[#1c2836] transition border-b border-slate-100 dark:border-[#253447]">
                    <td class="p-3.5 min-w-[200px]">
                        <div class="flex items-center space-x-2.5">
                            <div class="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#1c2836] text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs shrink-0 shadow-xs">
                                <i class="fa-solid ${item.icon}"></i>
                            </div>
                            <div>
                                <h5 class="font-bold text-slate-800 dark:text-slate-100 text-xs">${item.module}</h5>
                                <span class="text-[10px] text-slate-400 block">${item.desc}</span>
                            </div>
                        </div>
                    </td>
                    ${permCells}
                </tr>
            `;
        }).join('');
    }

    /**
     * Dapatkan teks counter izin aktif untuk kartu peran
     */
    function getRoleActivePermissionsCount(roleKey) {
        if (roleKey === 'SUPER_ADMIN') return 'Semua Hak Akses';
        const perms = ROLE_PERMISSIONS_STATE[roleKey] || DEFAULT_ROLE_PERMISSIONS_MAP[roleKey] || [];
        if (perms.includes('*')) return 'Semua Hak Akses';
        return `${perms.length} Izin Aktif`;
    }

    /**
     * Render Kartu-Kartu Peran (Role Cards Grid - Mengadopsi Tampilan Screenshot 2 KHODIM.COM)
     */
    function renderRoleCardsGrid() {
        const container = document.getElementById('admin-roles-cards-container');
        if (!container) return;

        const roleKeys = Object.keys(ROLE_DEFINITIONS);
        
        let filteredKeys = roleKeys;
        if (currentRoleFilter === 'EKSEKUTIF') {
            filteredKeys = ['SUPER_ADMIN', 'ADMIN'];
        } else if (currentRoleFilter === 'FUNGSIONAL') {
            filteredKeys = ['ASATIDZ', 'PENGURUS', 'BENDAHARA'];
        } else if (currentRoleFilter === 'MASYAYIKH') {
            filteredKeys = ['PENGASUH'];
        } else if (currentRoleFilter === 'WALI') {
            filteredKeys = ['WALI_SANTRI'];
        }

        const tierCategoryBadge = {
            'SUPER_ADMIN': 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200/60',
            'ADMIN': 'bg-brand-100 text-brand-800 dark:bg-brand-950/80 dark:text-brand-300 border border-brand-200/60',
            'BENDAHARA': 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200/60',
            'ASATIDZ': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200/60',
            'PENGASUH': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200/60',
            'PENGURUS': 'bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border border-sky-200/60',
            'WALI_SANTRI': 'bg-slate-100 text-slate-700 dark:bg-[#1c2836] dark:text-slate-300 border border-slate-200 dark:border-slate-700'
        };

        const tierCategoryLabel = {
            'SUPER_ADMIN': 'AKSES PENUH',
            'ADMIN': 'OPERASIONAL',
            'BENDAHARA': 'FINANSIAL',
            'ASATIDZ': 'AKADEMIK',
            'PENGASUH': 'EKSEKUTIF',
            'PENGURUS': 'KESANTRIAN',
            'WALI_SANTRI': 'EKSTERNAL'
        };

        container.innerHTML = filteredKeys.map(key => {
            const role = ROLE_DEFINITIONS[key];
            const userCount = getRoleUserCount(key);
            const isSuperAdmin = (key === 'SUPER_ADMIN');
            const permsText = getRoleActivePermissionsCount(key);
            const catBadgeClass = tierCategoryBadge[key] || 'bg-slate-100 text-slate-800';
            const catLabel = tierCategoryLabel[key] || 'OTORITAS';

            return `
                <div class="bg-white dark:bg-[#15202d] rounded-3xl border border-slate-200/80 dark:border-[#253447] shadow-xs hover:shadow-md transition p-5 flex flex-col justify-between space-y-4 group">
                    <div class="space-y-3.5">
                        <!-- Top Header: Icon, Role Name, Pill Code & Category Badge -->
                        <div class="flex items-start justify-between gap-2">
                            <div class="flex items-center space-x-3">
                                <div class="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-[#1c2836] ${role.iconColor} flex items-center justify-center text-xl shadow-xs group-hover:scale-105 transition border border-slate-100 dark:border-[#253447]">
                                    <i class="fa-solid ${role.icon}"></i>
                                </div>
                                <div>
                                    <div class="flex items-center space-x-1.5">
                                        <h4 class="font-black text-slate-800 dark:text-slate-100 text-sm md:text-base leading-tight">${role.name}</h4>
                                    </div>
                                    <span class="inline-block mt-0.5 px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-100 dark:bg-[#1c2836] text-slate-500 dark:text-slate-400">
                                        ${key}
                                    </span>
                                </div>
                            </div>
                            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${catBadgeClass} shrink-0">
                                ${catLabel}
                            </span>
                        </div>

                        <!-- Deskripsi Ringkas -->
                        <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed min-h-[36px]">
                            ${role.summary}
                        </p>

                        <!-- Indikator Izin Aktif -->
                        <div class="flex items-center space-x-2 pt-1 text-xs">
                            <i class="fa-solid ${isSuperAdmin ? 'fa-crown text-purple-600 dark:text-purple-400' : 'fa-sliders text-emerald-600 dark:text-emerald-400'}"></i>
                            <span class="font-bold ${isSuperAdmin ? 'text-purple-700 dark:text-purple-300' : 'text-emerald-700 dark:text-emerald-400'}">
                                ${permsText}
                            </span>
                        </div>

                        <!-- Tombol Utama: Konfigurasi Izin (Sesuai Screenshot 2 KHODIM) -->
                        <div>
                            <button type="button" onclick="openRolePermissionsModal('${key}')"
                                class="w-full py-2.5 px-4 rounded-2xl border border-emerald-600/70 hover:border-emerald-600 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-xs font-bold transition flex items-center justify-center space-x-2 active:scale-98 shadow-xs">
                                <i class="fa-solid fa-sliders text-xs"></i>
                                <span>Konfigurasi Izin</span>
                            </button>
                        </div>
                    </div>

                    <!-- Footer Kartu: Akun Pengguna Aktif & Aksi Rinci -->
                    <div class="pt-3 border-t border-slate-100 dark:border-[#253447] flex items-center justify-between">
                        <div class="flex items-center space-x-1.5 text-slate-500 dark:text-slate-400 text-xs">
                            <i class="fa-solid fa-users text-xs"></i>
                            <span class="font-bold text-slate-700 dark:text-slate-200">${userCount}</span>
                            <span class="text-[10px]">Akun Terdaftar</span>
                        </div>
                        <div class="flex items-center space-x-1.5">
                            <button type="button" onclick="filterAndShowUsersByRole('${key}')"
                                class="px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-[#1c2836] rounded-xl transition flex items-center space-x-1"
                                title="Lihat daftar akun dengan peran ${role.shortName}">
                                <span>Lihat Akun</span>
                                <i class="fa-solid fa-arrow-right text-[9px]"></i>
                            </button>
                            <button type="button" onclick="inspectRoleDetails('${key}')"
                                class="w-7 h-7 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1c2836] dark:hover:bg-[#253447] text-slate-600 dark:text-slate-300 flex items-center justify-center transition active:scale-95"
                                title="Detail Wewenang & Batasan">
                                <i class="fa-solid fa-circle-info text-xs"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Filter Kategori Kartu Peran
     */
    function filterRolesCategory(category) {
        currentRoleFilter = category;
        document.querySelectorAll('.role-filter-tab').forEach(btn => {
            if (btn.dataset.roleCat === category) {
                btn.classList.add('active', 'bg-emerald-600', 'text-white');
                btn.classList.remove('text-slate-600', 'dark:text-slate-300');
            } else {
                btn.classList.remove('active', 'bg-emerald-600', 'text-white');
                btn.classList.add('text-slate-600', 'dark:text-slate-300');
            }
        });
        renderRoleCardsGrid();
    }

    /**
     * Navigasi langsung ke tabel Pengguna dengan filter role yang dipilih
     */
    function filterAndShowUsersByRole(roleKey) {
        if (typeof showAdminView === 'function') {
            showAdminView('users');
            setTimeout(() => {
                if (typeof filterAdminUsers === 'function') {
                    filterAdminUsers(roleKey);
                }
            }, 100);
        }
    }

    /**
     * Buka Modal Inspeksi Detail Peran
     */
    function inspectRoleDetails(roleKey) {
        const role = ROLE_DEFINITIONS[roleKey];
        if (!role) return;

        const modal = document.getElementById('modal-admin-role-detail');
        if (!modal) return;

        document.getElementById('role-detail-name').innerText = role.name;
        document.getElementById('role-detail-code').innerText = role.key;
        document.getElementById('role-detail-tier').innerText = role.tier;
        document.getElementById('role-detail-desc').innerText = role.summary;
        document.getElementById('role-detail-scope-note').innerText = role.scopeNote;
        
        const iconEl = document.getElementById('role-detail-icon');
        if (iconEl) iconEl.className = `w-12 h-12 rounded-2xl bg-slate-50 dark:bg-[#1c2836] ${role.iconColor} flex items-center justify-center text-xl shadow-xs`;

        // Render wewenang
        const capEl = document.getElementById('role-detail-capabilities');
        if (capEl) {
            capEl.innerHTML = role.capabilities.map(c => `
                <li class="flex items-start space-x-2 text-xs text-slate-700 dark:text-slate-200">
                    <i class="fa-solid fa-shield-check text-emerald-500 mt-1 shrink-0"></i>
                    <span>${c}</span>
                </li>
            `).join('');
        }

        // Render daftar pengguna dengan peran ini
        const usersListEl = document.getElementById('role-detail-users-list');
        if (usersListEl) {
            let matchedUsers = [];
            if (typeof adminUsersList !== 'undefined' && Array.isArray(adminUsersList)) {
                if (roleKey === 'ASATIDZ') {
                    matchedUsers = adminUsersList.filter(u => u.role === 'ASATIDZ' || u.role === 'PEGAWAI' || u.role === 'EDITOR');
                } else {
                    matchedUsers = adminUsersList.filter(u => String(u.role || '').toUpperCase() === roleKey);
                }
            }

            if (matchedUsers.length === 0) {
                usersListEl.innerHTML = `<p class="text-xs text-slate-400 italic py-2">Belum ada akun pengguna yang terdaftar dengan peran ini.</p>`;
            } else {
                usersListEl.innerHTML = `
                    <div class="max-h-48 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                        ${matchedUsers.map(u => `
                            <div class="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-[#1c2836] border border-slate-100 dark:border-[#253447]">
                                <div class="flex items-center space-x-2">
                                    <div class="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-[10px]">
                                        ${(u.name || 'U').charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h5 class="text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight">${u.name || 'Pengguna'}</h5>
                                        <span class="text-[9px] text-slate-400 font-mono">${u.email || '-'}</span>
                                    </div>
                                </div>
                                <span class="text-[9px] font-bold ${u.status === 'ACTIVE' ? 'text-emerald-600' : 'text-rose-500'}">
                                    ${u.status === 'ACTIVE' ? 'Aktif' : 'Nonaktif'}
                                </span>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
        }

        modal.classList.remove('hidden');
    }

    function closeRoleDetailModal() {
        const modal = document.getElementById('modal-admin-role-detail');
        if (modal) modal.classList.add('hidden');
    }

    /**
     * Buka Modal Panduan RBAC
     */
    function openRoleGuideModal() {
        const modal = document.getElementById('modal-admin-role-guide');
        if (modal) modal.classList.remove('hidden');
    }

    function closeRoleGuideModal() {
        const modal = document.getElementById('modal-admin-role-guide');
        if (modal) modal.classList.add('hidden');
    }

    // =========================================================================
    // MODAL KONFIGURASI IZIN PERAN (RBAC KHODIM-STYLE)
    // =========================================================================

    /**
     * Buka Modal Konfigurasi Izin Peran
     */
    function openRolePermissionsModal(roleKey) {
        const role = ROLE_DEFINITIONS[roleKey];
        if (!role) return;

        currentConfiguringRole = roleKey;

        // Ambil izin yang sedang aktif untuk role ini
        const activePerms = ROLE_PERMISSIONS_STATE[roleKey] || DEFAULT_ROLE_PERMISSIONS_MAP[roleKey] || [];
        currentModalPermissions = [...activePerms];

        const modal = document.getElementById('modal-admin-role-permissions');
        if (!modal) return;

        // Update Header
        const titleEl = document.getElementById('role-perm-title');
        if (titleEl) titleEl.innerText = `Konfigurasi Izin: ${role.name}`;

        const subEl = document.getElementById('role-perm-subtitle');
        if (subEl) subEl.innerText = `Role ID: ${role.key} • ${role.summary}`;

        const iconEl = document.getElementById('role-perm-icon');
        if (iconEl) iconEl.className = `fa-solid ${role.icon}`;

        const iconWrap = document.getElementById('role-perm-icon-wrapper');
        if (iconWrap) {
            iconWrap.className = `w-10 h-10 rounded-2xl bg-slate-100 dark:bg-[#1c2836] ${role.iconColor} flex items-center justify-center text-lg font-bold shadow-xs border border-slate-200 dark:border-[#253447]`;
        }

        // Tampilkan/Sembunyikan Banner Super Admin
        const saBanner = document.getElementById('role-perm-superadmin-banner');
        if (saBanner) {
            if (roleKey === 'SUPER_ADMIN') saBanner.classList.remove('hidden');
            else saBanner.classList.add('hidden');
        }

        // Reset search input
        const searchInput = document.getElementById('role-perm-search-input');
        if (searchInput) searchInput.value = '';

        // Render Checklist Categories & Items
        renderRolePermissionsChecklist();

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    /**
     * Tutup Modal Konfigurasi Izin Peran
     */
    function closeRolePermissionsModal() {
        const modal = document.getElementById('modal-admin-role-permissions');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
        currentConfiguringRole = null;
        currentModalPermissions = [];
    }

    /**
     * Render Daftar Checklist Izin per Kategori (Sesuai Screenshot 3 KHODIM)
     */
    function renderRolePermissionsChecklist(searchFilter = '') {
        const container = document.getElementById('role-permissions-categories-container');
        if (!container) return;

        const isSuperAdmin = (currentConfiguringRole === 'SUPER_ADMIN');
        const filter = String(searchFilter || '').trim().toLowerCase();

        container.innerHTML = PERMISSION_CATEGORIES.map(cat => {
            const filteredItems = cat.items.filter(item => {
                if (!filter) return true;
                return item.label.toLowerCase().includes(filter) ||
                       item.desc.toLowerCase().includes(filter) ||
                       item.key.toLowerCase().includes(filter);
            });

            if (filteredItems.length === 0) return '';

            return `
                <div class="space-y-3 role-perm-category-block" data-category="${cat.key}">
                    <!-- Category Header -->
                    <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#253447]">
                        <div class="flex items-center space-x-2">
                            <div class="w-6 h-6 rounded-lg bg-${cat.color}-100 dark:bg-${cat.color}-950/70 text-${cat.color}-700 dark:text-${cat.color}-300 flex items-center justify-center text-xs font-bold">
                                <i class="fa-solid ${cat.icon}"></i>
                            </div>
                            <h4 class="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-100">${cat.label}</h4>
                        </div>
                        ${!isSuperAdmin ? `
                            <div class="flex items-center space-x-2 text-[10px]">
                                <button type="button" onclick="toggleCategoryPermissions('${cat.key}', true)" 
                                    class="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">
                                    Pilih Semua
                                </button>
                                <span class="text-slate-300 dark:text-slate-600">•</span>
                                <button type="button" onclick="toggleCategoryPermissions('${cat.key}', false)" 
                                    class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                    Kosongkan
                                </button>
                            </div>
                        ` : ''}
                    </div>

                    <!-- 2-Columns Checklist Cards Grid (Screenshot 3 KHODIM) -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        ${filteredItems.map(item => {
                            const isChecked = isSuperAdmin || currentModalPermissions.includes(item.key) || currentModalPermissions.includes('*');
                            const cardBorder = isChecked
                                ? 'border-emerald-500/80 bg-emerald-50/50 dark:bg-emerald-950/20'
                                : 'border-slate-200 dark:border-[#253447] bg-white dark:bg-[#15202d] hover:border-slate-300';
                            
                            const checkClass = isChecked
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'border-2 border-slate-300 dark:border-slate-600 text-transparent';

                            return `
                                <div onclick="${!isSuperAdmin ? `toggleRolePermissionItem('${item.key}')` : ''}"
                                    class="p-3.5 rounded-2xl border ${cardBorder} transition select-none ${isSuperAdmin ? 'cursor-default' : 'cursor-pointer'} flex items-start space-x-3 group">
                                    <div class="w-5 h-5 rounded-lg ${checkClass} flex items-center justify-center text-xs shrink-0 mt-0.5 transition">
                                        <i class="fa-solid fa-check text-[10px]"></i>
                                    </div>
                                    <div class="min-w-0">
                                        <h5 class="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition">${item.label}</h5>
                                        <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">${item.desc}</p>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }).join('');

        updateRolePermissionsCounter();
    }

    /**
     * Toggle satu item izin
     */
    function toggleRolePermissionItem(permKey) {
        if (currentConfiguringRole === 'SUPER_ADMIN') return;
        const idx = currentModalPermissions.indexOf(permKey);
        if (idx !== -1) {
            currentModalPermissions.splice(idx, 1);
        } else {
            currentModalPermissions.push(permKey);
        }
        renderRolePermissionsChecklist(document.getElementById('role-perm-search-input')?.value || '');
    }

    /**
     * Toggle semua izin dalam satu kategori
     */
    function toggleCategoryPermissions(catKey, isSelectAll) {
        if (currentConfiguringRole === 'SUPER_ADMIN') return;
        const category = PERMISSION_CATEGORIES.find(c => c.key === catKey);
        if (!category) return;

        category.items.forEach(item => {
            const idx = currentModalPermissions.indexOf(item.key);
            if (isSelectAll && idx === -1) {
                currentModalPermissions.push(item.key);
            } else if (!isSelectAll && idx !== -1) {
                currentModalPermissions.splice(idx, 1);
            }
        });
        renderRolePermissionsChecklist(document.getElementById('role-perm-search-input')?.value || '');
    }

    /**
     * Pilih Semua / Kosongkan Seluruh Izin
     */
    function selectAllRolePermissions(isSelectAll) {
        if (currentConfiguringRole === 'SUPER_ADMIN') return;
        if (isSelectAll) {
            const allKeys = [];
            PERMISSION_CATEGORIES.forEach(c => c.items.forEach(i => allKeys.push(i.key)));
            currentModalPermissions = allKeys;
        } else {
            currentModalPermissions = [];
        }
        renderRolePermissionsChecklist(document.getElementById('role-perm-search-input')?.value || '');
    }

    /**
     * Live search pada modal konfigurasi izin
     */
    function filterRolePermissionsSearch(keyword) {
        renderRolePermissionsChecklist(keyword);
    }

    /**
     * Update label counter status izin pada footer modal
     */
    function updateRolePermissionsCounter() {
        const badge = document.getElementById('role-perm-counter-badge');
        if (!badge) return;
        if (currentConfiguringRole === 'SUPER_ADMIN') {
            badge.innerText = 'Semua Hak Akses (*)';
            badge.className = 'px-2.5 py-0.5 rounded-full font-bold text-xs bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200/60';
        } else {
            const totalItems = PERMISSION_CATEGORIES.reduce((acc, c) => acc + c.items.length, 0);
            badge.innerText = `${currentModalPermissions.length} dari ${totalItems} Izin Aktif`;
            badge.className = 'px-2.5 py-0.5 rounded-full font-bold text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200/60';
        }
    }

    /**
     * Simpan Perubahan Izin dari Modal ke Backend & Cache
     */
    async function saveRolePermissionsFromModal() {
        if (!currentConfiguringRole) return;
        const roleKey = currentConfiguringRole;
        const role = ROLE_DEFINITIONS[roleKey];
        const saveBtn = document.getElementById('btn-save-role-permissions');
        
        let originalContent = '';
        if (saveBtn) {
            originalContent = saveBtn.innerHTML;
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xs"></i><span>Menyimpan...</span>';
        }

        try {
            // Update state lokal
            ROLE_PERMISSIONS_STATE[roleKey] = [...currentModalPermissions];
            try {
                localStorage.setItem('MUBAROKAH_ROLE_PERMS_CACHE', JSON.stringify(ROLE_PERMISSIONS_STATE));
            } catch (e) {}

            // Kirim ke backend Google Sheets / Script Properties
            if (typeof authApiPost === 'function') {
                try {
                    await authApiPost('auth.admin.saveRolePermissions', {
                        roleKey: roleKey,
                        permissions: currentModalPermissions
                    });
                } catch (netErr) {
                    console.warn('[SAVE ROLE PERMS BACKEND WARN]', netErr);
                }
            }

            // Perbarui UI katalog kartu peran
            renderRoleCardsGrid();

            // Terapkan efek visibilitas menu real-time
            const currentActiveRole = (typeof ASNIdentity !== 'undefined' && ASNIdentity.currentRole) || 
                                     sessionStorage.getItem('ASN_ADMIN_ROLE') || 
                                     sessionStorage.getItem('mubarokah_admin_role') || 'SUPER_ADMIN';
            applyAdminRoleVisibility(currentActiveRole);

            // Tutup modal
            closeRolePermissionsModal();

            if (typeof showToast === 'function') {
                showToast(`Izin peran ${role ? role.name : roleKey} berhasil diperbarui!`);
            } else if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'success',
                    title: 'Izin Disimpan',
                    text: `Konfigurasi izin untuk peran ${role ? role.name : roleKey} berhasil disimpan dan langsung diterapkan ke dashboard.`,
                    timer: 2000,
                    showConfirmButton: false
                });
            } else {
                alert(`Konfigurasi izin untuk peran ${role ? role.name : roleKey} berhasil disimpan.`);
            }
        } catch (err) {
            console.error('[SAVE ROLE PERMISSIONS ERROR]', err);
            alert('Gagal menyimpan izin: ' + err.message);
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalContent;
            }
        }
    }

    /**
     * Ambil Konfigurasi Izin dari Backend Google Sheets
     */
    async function fetchRolePermissionsFromBackend() {
        if (typeof authApiPost !== 'function') return;
        try {
            const res = await authApiPost('auth.admin.getRolePermissions', {});
            if (res && res.success && res.permissions) {
                ROLE_PERMISSIONS_STATE = res.permissions;
                try {
                    localStorage.setItem('MUBAROKAH_ROLE_PERMS_CACHE', JSON.stringify(ROLE_PERMISSIONS_STATE));
                } catch (e) {}
                renderRoleCardsGrid();
                const activeRole = (typeof ASNIdentity !== 'undefined' && ASNIdentity.currentRole) || 
                                  sessionStorage.getItem('ASN_ADMIN_ROLE') || 'SUPER_ADMIN';
                applyAdminRoleVisibility(activeRole);
            }
        } catch (e) {
            console.warn('[FETCH ROLE PERMS WARN]', e);
        }
    }

    // Mapping Modul yang Boleh Diakses per Peran
    const ROLE_ALLOWED_MODULES = {
        'SUPER_ADMIN': [
            'santri', 'tahfidz', 'tpq', 'sorogan', 'madin', 'presensi', 'ppdb', 'program', 'unit-kegiatan',
            'keuangan', 'akuntansi',
            'users', 'roles', 'pegawai',
            'berita', 'banner', 'galeri', 'notifikasi',
            'profil-lembaga', 'pengaturan'
        ],
        'ADMIN': [
            'santri', 'tahfidz', 'tpq', 'sorogan', 'madin', 'presensi', 'ppdb', 'program', 'unit-kegiatan',
            'keuangan', 'akuntansi',
            'users', 'roles', 'pegawai',
            'berita', 'banner', 'galeri', 'notifikasi',
            'profil-lembaga', 'pengaturan'
        ],
        'ASATIDZ': [
            'tahfidz', 'tpq', 'sorogan', 'madin', 'presensi', 'santri', 'pegawai', 'profil-lembaga'
        ],
        'BENDAHARA': [
            'keuangan', 'akuntansi', 'santri', 'ppdb', 'notifikasi', 'pegawai', 'profil-lembaga'
        ],
        'PENGURUS': [
            'presensi', 'unit-kegiatan', 'ppdb', 'santri', 'berita', 'banner', 'galeri', 'notifikasi', 'profil-lembaga'
        ],
        'PENGASUH': [
            'santri', 'tahfidz', 'tpq', 'sorogan', 'madin', 'presensi', 'unit-kegiatan', 'ppdb', 'keuangan', 'akuntansi', 'pegawai', 'berita', 'galeri', 'profil-lembaga'
        ],
        'WALI_SANTRI': [
            'santri', 'tahfidz', 'tpq', 'sorogan', 'madin', 'presensi', 'berita', 'galeri', 'profil-lembaga'
        ]
    };

    // Profil Visual & Konfigurasi KPI Dashboard per Peran
    const ROLE_DASHBOARD_PROFILES = {
        'SUPER_ADMIN': {
            name: 'Super Administrator',
            shortName: 'Super Admin',
            tier: 'Tier 1 - Root Controller',
            badge: 'SUPER ADMIN - ROOT CONTROLLER',
            badgeBg: 'bg-purple-500 text-white',
            btnActiveBg: 'bg-purple-600 text-white shadow-xs',
            title: 'Pusat Kendali Tertinggi (Super Admin)',
            desc: 'Akses tanpa batas ke seluruh basis data, konfigurasi teknis, akun pengguna, dan arsitektur sistem.',
            gradientClass: 'from-purple-950 via-slate-900 to-indigo-950 border-purple-500/40',
            bgIcon: 'fa-crown',
            noticeTitle: 'Otoritas Super Admin (Akses Penuh Tanpa Batas)',
            noticeText: 'Akses 100% tanpa batasan ke seluruh modul kesiswaan, akademik, publikasi, pengaturan sistem, dan akun pengguna.',
            noticeBoxClass: 'bg-purple-50/70 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800/40 text-purple-900 dark:text-purple-200',
            noticeIconClass: 'fa-crown text-purple-600 dark:text-purple-400',
            noticeBadgeClass: 'bg-purple-200/70 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
            kpis: [
                { label: 'Total Santri Terdaftar', icon: 'fa-users', color: 'purple', valueKey: 'santri', sub: 'Santri Aktif' },
                { label: 'Akun Pengguna Sistem', icon: 'fa-user-shield', color: 'indigo', valueKey: 'users', sub: 'Tersebar di 7 Peran' },
                { label: 'Database Cloud Sheets', icon: 'fa-database', color: 'emerald', value: 'Online', sub: 'Terhubung & Sinkron' },
                { label: 'Modul Sistem Terbuka', icon: 'fa-cubes', color: 'amber', value: '17 Modul', sub: 'Akses 100% Bebas' }
            ]
        },
        'ADMIN': {
            name: 'Administrator Lembaga',
            shortName: 'Admin',
            tier: 'Tier 1 - Pengelola Operasional',
            badge: 'ADMINISTRATOR EKSEKUTIF',
            badgeBg: 'bg-brand-600 text-white',
            btnActiveBg: 'bg-brand-700 text-white shadow-xs',
            title: 'Dashboard Operasional Lembaga',
            desc: 'Pengelolaan operasional harian terpadu kesiswaan, bimbingan akademik, media publikasi, dan administrasi.',
            gradientClass: 'from-brand-950 via-slate-900 to-emerald-950 border-brand-500/40',
            bgIcon: 'fa-shield-halved',
            noticeTitle: 'Otoritas Administrator Operasional',
            noticeText: 'Akses operasional penuh kesiswaan, akademik, media, dan manajemen akun pengguna standar (akun Super Admin dilindungi).',
            noticeBoxClass: 'bg-brand-50/70 dark:bg-brand-950/30 border-brand-200 dark:border-brand-800/40 text-brand-900 dark:text-brand-200',
            noticeIconClass: 'fa-shield-halved text-brand-600 dark:text-brand-400',
            noticeBadgeClass: 'bg-brand-200/70 text-brand-800 dark:bg-brand-900 dark:text-brand-200',
            kpis: [
                { label: 'Total Santri Aktif', icon: 'fa-user-graduate', color: 'cyan', valueKey: 'santri', sub: 'Santri Belajar' },
                { label: 'Setoran Tahfidz & TPQ', icon: 'fa-book-quran', color: 'emerald', valueKey: 'tahfidz_tpq', sub: 'Terdata di Sistem' },
                { label: 'Presensi Kegiatan Santri', icon: 'fa-calendar-check', color: 'teal', valueKey: 'presensi', sub: 'Live & QR Code' },
                { label: 'Pendaftar PPDB Baru', icon: 'fa-user-plus', color: 'amber', valueKey: 'ppdb', sub: 'Menunggu Seleksi' }
            ]
        },
        'ASATIDZ': {
            name: 'Dewan Asatidz / Pengampu',
            shortName: 'Asatidz',
            tier: 'Tier 2 - Akademik & Pembelajaran',
            badge: 'DEWAN ASATIDZ / HALAQAH',
            badgeBg: 'bg-indigo-600 text-white',
            btnActiveBg: 'bg-indigo-600 text-white shadow-xs',
            title: 'Dashboard Akademik & Halaqah Asatidz',
            desc: 'Pusat entri setoran hafalan Tahfidz, simakan TPQ Yanbu\'a, Sorogan Al-Qur\'an, dan presensi santri bimbingan.',
            gradientClass: 'from-indigo-950 via-slate-900 to-purple-950 border-indigo-500/40',
            bgIcon: 'fa-chalkboard-user',
            noticeTitle: 'Akses Khusus Dewan Asatidz (Fokus Pembelajaran)',
            noticeText: 'Diberikan hak input simakan Tahfidz, TPQ Yanbu\'a, Sorogan Qur\'an, presensi halaqah, dan data santri bimbingan. Modul teknis dan keuangan disembunyikan.',
            noticeBoxClass: 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/40 text-indigo-900 dark:text-indigo-200',
            noticeIconClass: 'fa-chalkboard-user text-indigo-600 dark:text-indigo-400',
            noticeBadgeClass: 'bg-indigo-200/70 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
            kpis: [
                { label: 'Santri Bimbingan Halaqah', icon: 'fa-users-line', color: 'indigo', valueKey: 'santri', sub: 'Santri Binaan' },
                { label: 'Entri Tahfidz Qur\'an', icon: 'fa-book-quran', color: 'emerald', valueKey: 'tahfidz', sub: '30 Juz Mushaf' },
                { label: 'Simakan TPQ Yanbu\'a', icon: 'fa-book-open-reader', color: 'teal', valueKey: 'tpq', sub: '8 Tingkat Jilid' },
                { label: 'Presensi Halaqah', icon: 'fa-clipboard-check', color: 'sky', valueKey: 'presensi', sub: 'Checklist Harian' }
            ]
        },
        'BENDAHARA': {
            name: 'Bendahara / Keuangan',
            shortName: 'Bendahara',
            tier: 'Tier 2 - Keuangan & Administrasi',
            badge: 'BENDAHARA & KEUANGAN',
            badgeBg: 'bg-emerald-500 text-slate-950 font-black',
            btnActiveBg: 'bg-emerald-600 text-white shadow-xs',
            title: 'Dashboard Keuangan & Iuran Santri',
            desc: 'Pencatatan iuran SPP/syahriah, verifikasi konfirmasi transfer wali santri, dan rekapitulasi kas masuk/keluar.',
            gradientClass: 'from-emerald-950 via-slate-900 to-teal-950 border-emerald-500/40',
            bgIcon: 'fa-wallet',
            noticeTitle: 'Akses Bendahara (Tata Kelola Keuangan Santri)',
            noticeText: 'Diberikan hak akses pencatatan pembayaran SPP santri, verifikasi transfer wali, seleksi berkas PPDB, dan broadcast iuran. Modul akademik disembunyikan.',
            noticeBoxClass: 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200',
            noticeIconClass: 'fa-wallet text-emerald-600 dark:text-emerald-400',
            noticeBadgeClass: 'bg-emerald-200/70 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
            kpis: [
                { label: 'Kas Masuk Bulan Ini', icon: 'fa-vault', color: 'emerald', valueKey: 'keuangan_kas', sub: 'Penerimaan Loket' },
                { label: 'Total Santri Terdata', icon: 'fa-users', color: 'teal', valueKey: 'santri', sub: 'Subjek Iuran' },
                { label: 'Tunggakan Belum Lunas', icon: 'fa-file-invoice-dollar', color: 'amber', valueKey: 'keuangan_tunggakan', sub: 'Piutang Aktif' },
                { label: 'Broadcast Tagihan', icon: 'fa-bell', color: 'rose', value: 'Tersedia', sub: 'Notifikasi Wali' }
            ]
        },
        'PENGURUS': {
            name: 'Pengurus / Kesantrian',
            shortName: 'Pengurus',
            tier: 'Tier 2 - Kesantrian & Lapangan',
            badge: 'PENGURUS & KESANTRIAN',
            badgeBg: 'bg-sky-500 text-white',
            btnActiveBg: 'bg-sky-600 text-white shadow-xs',
            title: 'Dashboard Kesantrian & Pengurus Lapangan',
            desc: 'Pengawalan ketertiban santri, absensi live QR, perizinan, unit kegiatan santri (UKS), dan kabar warta asrama.',
            gradientClass: 'from-sky-950 via-slate-900 to-cyan-950 border-sky-500/40',
            bgIcon: 'fa-clipboard-user',
            noticeTitle: 'Akses Pengurus (Kedisiplinan & Kesantrian)',
            noticeText: 'Diberikan hak akses absensi QR santri, UKS/kegiatan santri, seleksi PPDB, berita, galeri, dan kontak santri/wali. Modul keuangan dan akademik disembunyikan.',
            noticeBoxClass: 'bg-sky-50/70 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800/40 text-sky-900 dark:text-sky-200',
            noticeIconClass: 'fa-clipboard-user text-sky-600 dark:text-sky-400',
            noticeBadgeClass: 'bg-sky-200/70 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
            kpis: [
                { label: 'Presensi Santri Hari Ini', icon: 'fa-qrcode', color: 'emerald', valueKey: 'presensi', sub: 'Scan QR & Manual' },
                { label: 'Data Santri & Asrama', icon: 'fa-id-card', color: 'sky', valueKey: 'santri', sub: 'Kontak Darurat' },
                { label: 'Unit Kegiatan & Ekstra', icon: 'fa-futbol', color: 'teal', value: 'Aktif', sub: 'UKS & Asrama' },
                { label: 'Pendaftar PPDB Online', icon: 'fa-user-check', color: 'amber', valueKey: 'ppdb', sub: 'Seleksi Berkas' }
            ]
        },
        'PENGASUH': {
            name: 'Dewan Masyayikh / Pengasuh',
            shortName: 'Pengasuh',
            tier: 'Tier 2 - Pengawasan & Kebijakan',
            badge: 'DEWAN MASYAYIKH / PENGASUH',
            badgeBg: 'bg-amber-400 text-slate-950 font-black',
            btnActiveBg: 'bg-amber-500 text-slate-950 font-black shadow-xs',
            title: 'Dashboard Eksekutif Dewan Masyayikh',
            desc: 'Ahlan wa Sahlan. Supervisi makro capaian Tahfidz Al-Qur\'an, ketertiban santri, dan laporan pesantren (Mode Aman Read-Only).',
            gradientClass: 'from-emerald-950 via-[#0a2318] to-amber-950 border-amber-400/40',
            bgIcon: 'fa-kaaba',
            noticeTitle: 'Supervisi Eksekutif Dewan Masyayikh (Read-Only Aman)',
            noticeText: 'Akses pengawasan makro aktif untuk memantau capaian Al-Qur\'an santri, presensi, pegawai, dan kabar pondok. Form hapus/edit dinonaktifkan demi perlindungan data.',
            noticeBoxClass: 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/40 text-amber-950 dark:text-amber-200',
            noticeIconClass: 'fa-kaaba text-amber-600 dark:text-amber-400',
            noticeBadgeClass: 'bg-amber-200/70 text-amber-900 dark:bg-amber-900 dark:text-amber-200',
            kpis: [
                { label: 'Total Santriwan & Santriwati', icon: 'fa-users', color: 'amber', valueKey: 'santri', sub: 'Santri Aktif' },
                { label: 'Pantauan Tahfidz Al-Qur\'an', icon: 'fa-book-quran', color: 'emerald', value: '30 Juz', sub: 'Supervisi Makro' },
                { label: 'TPQ Yanbu\'a & Sorogan', icon: 'fa-book-open-reader', color: 'teal', value: '8 Jilid', sub: 'Evaluasi Mutaba\'ah' },
                { label: 'Dewan Asatidz & Pengurus', icon: 'fa-user-tie', color: 'sky', valueKey: 'users', sub: 'Staf & Pembina' }
            ]
        },
        'WALI_SANTRI': {
            name: 'Wali Santri / Orang Tua',
            shortName: 'Wali Santri',
            tier: 'Tier 3 - Eksternal / Portal Wali',
            badge: 'PORTAL RESMI WALI SANTRI',
            badgeBg: 'bg-teal-500 text-white',
            btnActiveBg: 'bg-teal-600 text-white shadow-xs',
            title: 'Portal Terpadu Wali Santri',
            desc: 'Pemantauan real-time perkembangan belajar, hafalan Tahfidz, TPQ Yanbu\'a, presensi, dan informasi resmi untuk putra-putri tercinta.',
            gradientClass: 'from-teal-950 via-slate-900 to-emerald-950 border-teal-500/40',
            bgIcon: 'fa-people-roof',
            noticeTitle: 'Akses Portal Terisolasi Wali Santri',
            noticeText: 'Akses dikhususkan untuk memantau data belajar anak kandung yang terhubung dengan akun Anda. Panel CMS administratif ditutup rapat.',
            noticeBoxClass: 'bg-teal-50/70 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800/40 text-teal-900 dark:text-teal-200',
            noticeIconClass: 'fa-people-roof text-teal-600 dark:text-teal-400',
            noticeBadgeClass: 'bg-teal-200/70 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
            kpis: [
                { label: 'Kartu Santri Terhubung', icon: 'fa-child', color: 'teal', value: 'Terhubung', sub: 'Verifikasi NIS Resmi' },
                { label: 'Mutaba\'ah Tahfidz', icon: 'fa-book-quran', color: 'emerald', value: 'Aktif', sub: 'Setoran Harian' },
                { label: 'Capaian TPQ Yanbu\'a', icon: 'fa-book-open', color: 'cyan', value: 'Aktif', sub: 'Target & Simakan' },
                { label: 'Kehadiran Sholat & Kegiatan', icon: 'fa-calendar-check', color: 'sky', value: 'Terpantau', sub: 'Presensi Harian' }
            ]
        }
    };

    /**
     * Dapatkan daftar modul yang boleh diakses berdasarkan izin yang dicentang oleh Super Admin
     */
    function getAllowedModulesForRole(roleKey) {
        if (!roleKey) {
            roleKey = (typeof ASNIdentity !== 'undefined' && ASNIdentity.currentRole) || 
                      sessionStorage.getItem('ASN_ADMIN_ROLE') || 
                      sessionStorage.getItem('mubarokah_admin_role') || 'SUPER_ADMIN';
        }
        roleKey = String(roleKey).toUpperCase();
        if (roleKey === 'PEGAWAI' || roleKey === 'EDITOR') roleKey = 'ASATIDZ';

        if (roleKey === 'SUPER_ADMIN') return Object.keys(MODULE_TO_PERMISSIONS);

        const rolePerms = ROLE_PERMISSIONS_STATE[roleKey] || DEFAULT_ROLE_PERMISSIONS_MAP[roleKey] || [];
        if (rolePerms.includes('*')) return Object.keys(MODULE_TO_PERMISSIONS);

        const allowed = Object.keys(MODULE_TO_PERMISSIONS).filter(modKey => {
            const reqPerms = MODULE_TO_PERMISSIONS[modKey];
            if (!reqPerms || reqPerms.length === 0) return true;
            return reqPerms.some(pk => rolePerms.includes(pk));
        });

        // Pastikan role ADMIN dan BENDAHARA selalu memiliki modul keuangan dan akuntansi
        if (roleKey === 'ADMIN' || roleKey === 'BENDAHARA') {
            if (!allowed.includes('keuangan')) allowed.push('keuangan');
            if (!allowed.includes('akuntansi')) allowed.push('akuntansi');
        }

        // Pastikan role SUPER_ADMIN, ADMIN, dan ASATIDZ selalu memiliki akses ke modul Presensi
        if (roleKey === 'SUPER_ADMIN' || roleKey === 'ADMIN' || roleKey === 'ASATIDZ') {
            if (!allowed.includes('presensi')) allowed.push('presensi');
        }

        return allowed;
    }

    /**
     * Cek apakah sebuah modul boleh diakses oleh peran tertentu (Dinamis dari Konfigurasi Izin)
     */
    function isModuleAllowedForRole(moduleKey, roleKey) {
        if (!roleKey) {
            roleKey = (typeof ASNIdentity !== 'undefined' && ASNIdentity.currentRole) || 
                      sessionStorage.getItem('ASN_ADMIN_ROLE') || 
                      sessionStorage.getItem('mubarokah_admin_role') || 'ADMIN';
        }
        roleKey = String(roleKey).toUpperCase();
        if (roleKey === 'PEGAWAI' || roleKey === 'EDITOR') roleKey = 'ASATIDZ';
        
        if (roleKey === 'SUPER_ADMIN') return true;

        // Role ADMIN dan BENDAHARA secara default dan mutlak diizinkan mengakses modul Keuangan dan Akuntansi
        if ((roleKey === 'ADMIN' || roleKey === 'BENDAHARA') && (moduleKey === 'keuangan' || moduleKey === 'akuntansi')) {
            return true;
        }

        // Role SUPER_ADMIN, ADMIN, dan ASATIDZ secara default dan mutlak diizinkan mengakses modul Presensi
        if ((roleKey === 'SUPER_ADMIN' || roleKey === 'ADMIN' || roleKey === 'ASATIDZ') && moduleKey === 'presensi') {
            return true;
        }

        const rolePerms = ROLE_PERMISSIONS_STATE[roleKey] || DEFAULT_ROLE_PERMISSIONS_MAP[roleKey] || [];
        if (rolePerms.includes('*')) return true;

        const reqPerms = MODULE_TO_PERMISSIONS[moduleKey];
        if (!reqPerms || reqPerms.length === 0) return true;

        return reqPerms.some(pk => rolePerms.includes(pk));
    }

    /**
     * Dapatkan nilai metrik dinamis untuk KPI
     */
    function getKpiMetricValue(valueKey) {
        if (valueKey === 'santri') {
            return (typeof adminStudentsList !== 'undefined' && Array.isArray(adminStudentsList)) ? adminStudentsList.length + ' Santri' : '0 Santri';
        }
        if (valueKey === 'users') {
            return (typeof adminUsersList !== 'undefined' && Array.isArray(adminUsersList)) ? adminUsersList.length + ' Akun' : '0 Akun';
        }
        if (valueKey === 'tahfidz') {
            const list = (typeof adminTahfidzList !== 'undefined' && Array.isArray(adminTahfidzList))
                ? adminTahfidzList
                : ((typeof ASNTahfidz !== 'undefined' && ASNTahfidz.data && Array.isArray(ASNTahfidz.data.students)) ? ASNTahfidz.data.students : null);
            return list ? list.length + ' Santri' : '30 Juz';
        }
        if (valueKey === 'tpq') {
            return (typeof adminTPQStudents !== 'undefined' && Array.isArray(adminTPQStudents)) ? adminTPQStudents.length + ' Santri' : '8 Jilid';
        }
        if (valueKey === 'tahfidz_tpq') {
            const tList = (typeof adminTahfidzList !== 'undefined' && Array.isArray(adminTahfidzList))
                ? adminTahfidzList
                : ((typeof ASNTahfidz !== 'undefined' && ASNTahfidz.data && Array.isArray(ASNTahfidz.data.students)) ? ASNTahfidz.data.students : []);
            const t = tList.length;
            const q = (typeof adminTPQStudents !== 'undefined' && Array.isArray(adminTPQStudents)) ? adminTPQStudents.length : 0;
            return (t + q) > 0 ? (t + q) + ' Simakan' : 'Aktif';
        }
        if (valueKey === 'presensi') {
            return (typeof adminPresensiData !== 'undefined' && Array.isArray(adminPresensiData)) ? adminPresensiData.length + ' Sesi' : 'Live & QR';
        }
        if (valueKey === 'ppdb') {
            return (typeof adminPPDBList !== 'undefined' && Array.isArray(adminPPDBList)) ? adminPPDBList.length + ' Santri' : '0 Pendaftar';
        }
        if (valueKey === 'keuangan_kas') {
            if (typeof ASNKeuangan !== 'undefined' && ASNKeuangan.data && ASNKeuangan.data.summary && ASNKeuangan.data.summary.totalPendapatanBulanIni > 0) {
                return typeof formatRupiah === 'function' ? formatRupiah(ASNKeuangan.data.summary.totalPendapatanBulanIni) : 'Rp ' + ASNKeuangan.data.summary.totalPendapatanBulanIni;
            }
            return 'Aktif';
        }
        if (valueKey === 'keuangan_tunggakan') {
            if (typeof ASNKeuangan !== 'undefined' && ASNKeuangan.data && ASNKeuangan.data.summary && ASNKeuangan.data.summary.totalTunggakan > 0) {
                return typeof formatRupiah === 'function' ? formatRupiah(ASNKeuangan.data.summary.totalTunggakan) : 'Rp ' + ASNKeuangan.data.summary.totalTunggakan;
            }
            return 'Terpantau';
        }
        return '-';
    }

    /**
     * Terapkan Tampilan Dashboard & Visibilitas Menu Sesuai Peran
     */
    function applyAdminRoleVisibility(roleKey) {
        if (!roleKey) {
            roleKey = (typeof ASNIdentity !== 'undefined' && ASNIdentity.currentRole) || 
                      sessionStorage.getItem('ASN_ADMIN_ROLE') || 
                      sessionStorage.getItem('mubarokah_admin_role') || 'SUPER_ADMIN';
        }
        roleKey = String(roleKey).toUpperCase();
        if (roleKey === 'PEGAWAI' || roleKey === 'EDITOR') roleKey = 'ASATIDZ';

        const profile = ROLE_DASHBOARD_PROFILES[roleKey] || ROLE_DASHBOARD_PROFILES['ADMIN'];
        const allowedModules = getAllowedModulesForRole(roleKey);

        // 1. Perbarui Banner Dashboard
        const banner = document.getElementById('admin-hub-welcome-banner');
        if (banner) {
            banner.className = `bg-gradient-to-r ${profile.gradientClass} text-white p-5 md:p-6 rounded-3xl shadow-sm border relative overflow-hidden space-y-1.5 transition-all duration-300`;
            
            const badgeEl = document.getElementById('admin-hub-welcome-badge');
            if (badgeEl) {
                badgeEl.innerText = profile.shortName;
                badgeEl.className = `${profile.badgeBg} text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase inline-block shadow-sm`;
            }

            const tierEl = document.getElementById('admin-hub-role-tier-badge');
            if (tierEl) tierEl.innerText = profile.tier;

            const titleEl = document.getElementById('admin-hub-welcome-title');
            if (titleEl) titleEl.innerText = profile.title;

            const descEl = document.getElementById('admin-hub-welcome-desc');
            if (descEl) descEl.innerText = profile.desc;

            const bgIconEl = document.getElementById('admin-hub-banner-bg-icon');
            if (bgIconEl) bgIconEl.className = `fa-solid ${profile.bgIcon}`;
        }

        // 2. Perbarui Scope Notice Bar
        const noticeBar = document.getElementById('admin-hub-role-scope-notice');
        if (noticeBar) {
            noticeBar.className = `p-3.5 rounded-2xl border text-xs flex items-start space-x-3 transition-all duration-300 ${profile.noticeBoxClass}`;
            
            const noticeIcon = document.getElementById('admin-hub-notice-icon');
            if (noticeIcon) noticeIcon.className = `fa-solid ${profile.noticeIconClass} mt-0.5 shrink-0 text-sm`;

            const noticeTitle = document.getElementById('admin-hub-notice-title');
            if (noticeTitle) noticeTitle.innerText = profile.noticeTitle;

            const noticeCount = document.getElementById('admin-hub-notice-count-badge');
            if (noticeCount) {
                noticeCount.className = `px-2 py-0.2 rounded-full text-[9px] font-bold ${profile.noticeBadgeClass}`;
                noticeCount.innerText = `${allowedModules.length} Modul Boleh Diakses`;
            }

            const noticeText = document.getElementById('admin-hub-notice-text');
            if (noticeText) noticeText.innerText = profile.noticeText;
        }

        // 3. Render 4 Dynamic KPI Cards
        const kpiGrid = document.getElementById('admin-hub-kpi-grid');
        if (kpiGrid && Array.isArray(profile.kpis)) {
            const colorMap = {
                purple: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-100 dark:border-purple-800/40',
                indigo: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-100 dark:border-indigo-800/40',
                emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-100 dark:border-emerald-800/40',
                cyan: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-100 dark:border-cyan-800/40',
                teal: 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border-teal-100 dark:border-teal-800/40',
                sky: 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border-sky-100 dark:border-sky-800/40',
                amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-100 dark:border-amber-800/40',
                rose: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-100 dark:border-rose-800/40'
            };

            kpiGrid.innerHTML = profile.kpis.map(kpi => {
                const val = kpi.valueKey ? getKpiMetricValue(kpi.valueKey) : (kpi.value || '-');
                const themeClass = colorMap[kpi.color] || colorMap['emerald'];
                return `
                    <div class="bg-white dark:bg-[#15202d] p-3.5 md:p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs flex items-center justify-between space-x-3 transition hover:shadow-sm">
                        <div class="min-w-0">
                            <span class="text-[10px] font-semibold text-slate-400 dark:text-slate-400 block truncate">${kpi.label}</span>
                            <h4 class="text-base md:text-lg font-black text-slate-800 dark:text-slate-100 mt-0.5">${val}</h4>
                            <span class="text-[9px] text-slate-400 dark:text-slate-500 font-medium">${kpi.sub}</span>
                        </div>
                        <div class="w-10 h-10 rounded-2xl ${themeClass} flex items-center justify-center text-base shrink-0 shadow-xs border">
                            <i class="fa-solid ${kpi.icon}"></i>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // 4. Widget Khusus Wali Santri & Pengasuh
        const parentWidget = document.getElementById('admin-hub-parent-widget');
        if (parentWidget) {
            if (roleKey === 'WALI_SANTRI') parentWidget.classList.remove('hidden');
            else parentWidget.classList.add('hidden');
        }

        const pengasuhWidget = document.getElementById('admin-hub-pengasuh-widget');
        if (pengasuhWidget) {
            if (roleKey === 'PENGASUH') pengasuhWidget.classList.remove('hidden');
            else pengasuhWidget.classList.add('hidden');
        }

        // 5. Filter Kartu di Menu Hub Admin
        const hubCards = document.querySelectorAll('#admin-menu-hub [data-admin-module]');
        hubCards.forEach(card => {
            const modKey = card.dataset.adminModule;
            const isAllowed = isModuleAllowedForRole(modKey, roleKey);
            
            if (isAllowed) {
                card.classList.remove('hidden');
            } else {
                card.classList.add('hidden');
            }
        });

        // 6. Hitung & Filter Kategori Hub
        const hubCategories = document.querySelectorAll('.admin-hub-category');
        hubCategories.forEach(cat => {
            const visibleCards = cat.querySelectorAll('[data-admin-module]:not(.hidden)');
            const countBadge = cat.querySelector('.admin-hub-category-count');
            
            if (visibleCards.length === 0) {
                cat.classList.add('hidden');
            } else {
                cat.classList.remove('hidden');
                if (countBadge) {
                    countBadge.textContent = `${visibleCards.length} Menu Layanan`;
                }
            }
        });

        // 7. Filter Sidebar Navigation
        const sidebarNavItems = document.querySelectorAll('#admin-sidebar .admin-nav-item[data-view]');
        sidebarNavItems.forEach(item => {
            const viewKey = item.dataset.view;
            const isAllowed = isModuleAllowedForRole(viewKey, roleKey);
            if (isAllowed) {
                item.classList.remove('hidden');
            } else {
                item.classList.add('hidden');
            }
        });

        // Filter Grup Accordion Sidebar
        const sidebarGroups = document.querySelectorAll('#admin-sidebar .admin-menu-group');
        sidebarGroups.forEach(grp => {
            const visibleItems = grp.querySelectorAll('.admin-nav-item:not(.hidden)');
            if (visibleItems.length === 0) {
                grp.classList.add('hidden');
            } else {
                grp.classList.remove('hidden');
            }
        });

        // 8. Filter Mobile Control Center Grid
        const mobileButtons = document.querySelectorAll('#admin-control-center-grid [data-admin-module]');
        let visibleMobileCount = 0;
        mobileButtons.forEach(btn => {
            const modKey = btn.dataset.adminModule;
            const isAllowed = isModuleAllowedForRole(modKey, roleKey);
            if (isAllowed) {
                btn.classList.remove('hidden');
                visibleMobileCount++;
            } else {
                btn.classList.add('hidden');
            }
        });

        const mobileCountEl = document.getElementById('admin-control-center-count');
        if (mobileCountEl) {
            mobileCountEl.innerText = `${visibleMobileCount} Modul CMS`;
        }

        // 9. Update Active Pill pada Role Switcher Bar
        const roleBtns = document.querySelectorAll('.role-switch-btn');
        roleBtns.forEach(btn => {
            if (btn.dataset.roleBtn === roleKey) {
                btn.className = `role-switch-btn px-2.5 py-1.5 rounded-xl font-bold transition flex items-center space-x-1.5 shrink-0 ${profile.btnActiveBg}`;
            } else {
                btn.className = `role-switch-btn px-2.5 py-1.5 rounded-xl font-bold transition flex items-center space-x-1.5 shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700`;
            }
        });

        const activeTag = document.getElementById('admin-active-role-tag');
        if (activeTag) {
            activeTag.innerText = profile.shortName;
            activeTag.className = `px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${profile.badgeBg}`;
        }
    }

    /**
     * Beralih Pratinjau Peran (Simulator RBAC)
     */
    function switchActiveRolePreview(roleKey) {
        if (!ROLE_DEFINITIONS[roleKey]) return;
        
        sessionStorage.setItem('ASN_ADMIN_ROLE', roleKey);
        sessionStorage.setItem('mubarokah_admin_role', roleKey);
        localStorage.setItem('mubarokah_admin_role', roleKey);
        if (typeof ASNIdentity !== 'undefined') {
            ASNIdentity.currentRole = roleKey;
        }

        applyAdminRoleVisibility(roleKey);

        if (typeof showToast === 'function') {
            showToast(`Beralih ke Dashboard: ${ROLE_DEFINITIONS[roleKey].name}`);
        }
    }

    // Export ke window
    window.loadAdminRolesData = loadAdminRolesData;
    window.renderAdminRolesView = renderAdminRolesView;
    window.filterRolesCategory = filterRolesCategory;
    window.filterAndShowUsersByRole = filterAndShowUsersByRole;
    window.inspectRoleDetails = inspectRoleDetails;
    window.closeRoleDetailModal = closeRoleDetailModal;
    window.openRoleGuideModal = openRoleGuideModal;
    window.closeRoleGuideModal = closeRoleGuideModal;
    window.openRolePermissionsModal = openRolePermissionsModal;
    window.closeRolePermissionsModal = closeRolePermissionsModal;
    window.renderRolePermissionsChecklist = renderRolePermissionsChecklist;
    window.toggleRolePermissionItem = toggleRolePermissionItem;
    window.toggleCategoryPermissions = toggleCategoryPermissions;
    window.selectAllRolePermissions = selectAllRolePermissions;
    window.filterRolePermissionsSearch = filterRolePermissionsSearch;
    window.saveRolePermissionsFromModal = saveRolePermissionsFromModal;
    window.fetchRolePermissionsFromBackend = fetchRolePermissionsFromBackend;
    window.getAllowedModulesForRole = getAllowedModulesForRole;
    window.getRoleActivePermissionsCount = getRoleActivePermissionsCount;
    window.PERMISSION_CATEGORIES = PERMISSION_CATEGORIES;
    window.ROLE_PERMISSIONS_STATE = ROLE_PERMISSIONS_STATE;
    window.ROLE_DEFINITIONS = ROLE_DEFINITIONS;
    window.MODULE_PERMISSIONS_MATRIX = MODULE_PERMISSIONS_MATRIX;
    window.ROLE_ALLOWED_MODULES = ROLE_ALLOWED_MODULES;
    window.ROLE_DASHBOARD_PROFILES = ROLE_DASHBOARD_PROFILES;
    window.isModuleAllowedForRole = isModuleAllowedForRole;
    window.applyAdminRoleVisibility = applyAdminRoleVisibility;
    window.switchActiveRolePreview = switchActiveRolePreview;

})(window, document);
