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
     * Render Kartu-Kartu Peran (Role Cards Grid)
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

        container.innerHTML = filteredKeys.map(key => {
            const role = ROLE_DEFINITIONS[key];
            const userCount = getRoleUserCount(key);

            return `
                <div class="bg-white dark:bg-[#15202d] rounded-2xl border ${role.borderColor} shadow-xs hover:shadow-md transition p-4 flex flex-col justify-between space-y-4 group">
                    <div>
                        <!-- Header Kartu -->
                        <div class="flex items-start justify-between">
                            <div class="flex items-center space-x-3">
                                <div class="w-11 h-11 rounded-2xl bg-slate-50 dark:bg-[#1c2836] ${role.iconColor} flex items-center justify-center text-lg shadow-xs group-hover:scale-105 transition">
                                    <i class="fa-solid ${role.icon}"></i>
                                </div>
                                <div>
                                    <span class="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">${role.tier}</span>
                                    <h4 class="font-black text-slate-800 dark:text-slate-100 text-sm md:text-base">${role.name}</h4>
                                </div>
                            </div>
                            <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold ${role.badgeBg}">
                                ${key}
                            </span>
                        </div>

                        <!-- Deskripsi Ringkas -->
                        <p class="text-xs text-slate-600 dark:text-slate-300 mt-3 leading-relaxed">
                            ${role.summary}
                        </p>

                        <!-- Poin Kapabilitas Utama -->
                        <div class="mt-3.5 space-y-1.5 border-t border-slate-100 dark:border-[#253447] pt-3">
                            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Wewenang Utama:</span>
                            ${role.capabilities.map(cap => `
                                <div class="flex items-start space-x-1.5 text-xs text-slate-700 dark:text-slate-200">
                                    <i class="fa-solid fa-check text-[10px] text-emerald-500 mt-1 shrink-0"></i>
                                    <span class="text-[11px] leading-tight">${cap}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Footer Kartu: Akun Pengguna Aktif & Aksi -->
                    <div class="pt-3 border-t border-slate-100 dark:border-[#253447] flex items-center justify-between">
                        <div class="flex items-center space-x-1.5">
                            <i class="fa-solid fa-users text-xs text-slate-400"></i>
                            <span class="text-xs font-bold text-slate-700 dark:text-slate-300">${userCount}</span>
                            <span class="text-[10px] text-slate-400">Akun Terdaftar</span>
                        </div>
                        <div class="flex items-center space-x-1.5">
                            <button type="button" onclick="filterAndShowUsersByRole('${key}')"
                                class="px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 rounded-xl transition active:scale-95 flex items-center space-x-1"
                                title="Lihat seluruh pengguna dengan peran ${role.shortName}">
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

    // Export ke window
    window.loadAdminRolesData = loadAdminRolesData;
    window.renderAdminRolesView = renderAdminRolesView;
    window.filterRolesCategory = filterRolesCategory;
    window.filterAndShowUsersByRole = filterAndShowUsersByRole;
    window.inspectRoleDetails = inspectRoleDetails;
    window.closeRoleDetailModal = closeRoleDetailModal;
    window.openRoleGuideModal = openRoleGuideModal;
    window.closeRoleGuideModal = closeRoleGuideModal;
    window.ROLE_DEFINITIONS = ROLE_DEFINITIONS;
    window.MODULE_PERMISSIONS_MATRIX = MODULE_PERMISSIONS_MATRIX;

})(window, document);
