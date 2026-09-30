/**
 * ====================================================================
 * MODUL FRONTEND: PRESENSI KEGIATAN SANTRI (HYBRID & EXCEPTION-BASED)
 * PPTQ Roudlotul Mubarokah
 * ====================================================================
 * Fitur:
 * 1. Manajemen Master Kegiatan Santri (Dinamis / Kondisional)
 * 2. Buka Sesi Absensi & Live Checklist Massal di HP (1-Klik Hadir Semua)
 * 3. Scanner Kamera QR Live Kartu Santri (Hybrid)
 * 4. Exception-Based Storage (Hanya kirim & simpan Izin, Sakit, Alpa ke Sheets)
 * 5. Rekapitulasi & Kedisiplinan Kehadiran Santri (Tingkat Kehadiran %)
 * 6. Ekspor Excel & Lembar Rapor Presensi
 */

const PRESENSI_STORAGE_KEYS = {
    cacheDashboard: 'mubarokah_presensi_dashboard_cache',
    adminToken: 'mubarokah_admin_token',
    parentToken: 'mubarokah_parent_token',
    pengasuhToken: 'mubarokah_pengasuh_token'
};

const ASNPresensi = {
    data: {
        todayStr: '',
        kegiatanList: [],
        todaySessions: [],
        recentSessions: [],
        students: [],
        stats: {
            totalKegiatanAktif: 0,
            totalSesiBulanIni: 0,
            rerataKehadiranPct: 100,
            totalIzinHariIni: 0,
            totalSakitHariIni: 0,
            totalAlpaHariIni: 0,
            totalSantriAktif: 0
        },
        activeSession: null,
        activeStudentsMap: {}, // studentId -> { status: 'Hadir'|'Izin'|'Sakit'|'Alpa', keterangan: '', metode: 'CHECKLIST'|'QR_SCAN' }
        activeFilter: {
            gender: 'all',
            search: ''
        },
        rekapData: null
    },
    scanner: null,
    scannerRunning: false,
    activeMainTab: 'today',     // 'today' | 'live' | 'rekap' | 'agenda'
    liveInputMode: 'checklist'  // 'checklist' | 'qr'
};

const DEFAULT_PRESENSI_KEGIATAN = [
    { kegiatanId: 'ACT-01', namaKegiatan: 'Shalat Subuh & Wirid', kategori: 'Ibadah', jadwalRutin: 'Setiap Hari (04:30 - 05:30 WIB)', targetPeserta: 'Semua Santri', penanggungJawab: 'Ustadz Pembina Asrama', status: 'Aktif' },
    { kegiatanId: 'ACT-02', namaKegiatan: 'Shalat Maghrib & Isya Berjamaah', kategori: 'Ibadah', jadwalRutin: 'Setiap Hari (17:45 - 19:30 WIB)', targetPeserta: 'Semua Santri', penanggungJawab: 'Ustadz Pembina Asrama', status: 'Aktif' },
    { kegiatanId: 'ACT-03', namaKegiatan: "Kajian Kitab Diniyah / Ta'lim", kategori: "Ta'lim", jadwalRutin: 'Senin - Kamis (20:00 - 21:00 WIB)', targetPeserta: 'Semua Santri', penanggungJawab: 'Dewan Asatidz', status: 'Aktif' },
    { kegiatanId: 'ACT-04', namaKegiatan: "Ro'an & Kerja Bakti Kebersihan", kategori: 'Keasramaan', jadwalRutin: 'Ahad Pagi (07:00 - 08:30 WIB)', targetPeserta: 'Semua Santri', penanggungJawab: 'Pengurus Pondok', status: 'Aktif' },
    { kegiatanId: 'ACT-05', namaKegiatan: 'Muhadharah / Khitobah Santri', kategori: 'Minat & Bakat', jadwalRutin: 'Malam Jumat (20:00 - 21:30 WIB)', targetPeserta: 'Semua Santri', penanggungJawab: 'Pembina Bahasa', status: 'Aktif' }
];

/**
 * Universal API Adapter Bridge untuk Presensi
 */
async function callApi(payload = {}) {
    if (!payload || !payload.action) throw new Error("Parameter action wajib diisi.");
    const action = payload.action;
    const body = { ...payload };
    delete body.action;
    if (typeof apiPost === 'function') {
        return await apiPost(action, body);
    }
    throw new Error("Adapter apiPost tidak tersedia.");
}

/**
 * Helper pengambilan token yang aman
 */
function getPresensiToken() {
    if (typeof getTPQToken === 'function') return getTPQToken();
    if (typeof getAdminSessionToken === 'function') {
        try {
            const t = getAdminSessionToken();
            if (t && typeof t === 'string' && t.trim()) return t.trim();
        } catch (e) {}
    }
    const candidateKeys = [
        'mubarokah_admin_token',
        'mubarokah_pengasuh_token',
        'user_token',
        'mubarokah_parent_token'
    ];
    for (const key of candidateKeys) {
        try {
            const sVal = sessionStorage.getItem(key);
            if (sVal && sVal.trim()) return sVal.trim();
            const lVal = localStorage.getItem(key);
            if (lVal && lVal.trim()) return lVal.trim();
        } catch (e) {}
    }
    return '';
}

/**
 * Memuat seluruh data dashboard Presensi Kegiatan
 */
async function loadAdminPresensiData(forceRefresh = false) {
    const loader = document.getElementById('admin-presensi-loader');
    if (loader) loader.classList.remove('hidden');

    try {
        const token = getPresensiToken();
        let res = null;
        if (typeof apiPost === 'function') {
            res = await apiPost('getPresensiDashboard', { token });
        } else {
            res = await callApi({ action: 'getPresensiDashboard', token });
        }

        if (res && (res.ok || res.success || res.status === 'success') && res.data) {
            ASNPresensi.data.todayStr = res.data.todayStr || new Date().toISOString().substring(0, 10);
            ASNPresensi.data.kegiatanList = (res.data.kegiatanList && res.data.kegiatanList.length > 0)
                ? res.data.kegiatanList
                : DEFAULT_PRESENSI_KEGIATAN;
            ASNPresensi.data.todaySessions = res.data.todaySessions || [];
            ASNPresensi.data.recentSessions = res.data.recentSessions || [];
            ASNPresensi.data.students = res.data.students || [];
            ASNPresensi.data.stats = res.data.stats || ASNPresensi.data.stats;

            // Cache lokal untuk SWR
            try {
                localStorage.setItem(PRESENSI_STORAGE_KEYS.cacheDashboard, JSON.stringify(res.data));
            } catch (e) {}
        } else {
            // Gunakan kegiatan default jika respon kosong
            if (!ASNPresensi.data.kegiatanList || ASNPresensi.data.kegiatanList.length === 0) {
                ASNPresensi.data.kegiatanList = DEFAULT_PRESENSI_KEGIATAN;
            }
        }
    } catch (err) {
        console.warn('[Presensi] Gagal memuat data dari server, membaca cache:', err);
        try {
            const cached = localStorage.getItem(PRESENSI_STORAGE_KEYS.cacheDashboard);
            if (cached) {
                const parsed = JSON.parse(cached);
                ASNPresensi.data.todayStr = parsed.todayStr || '';
                ASNPresensi.data.kegiatanList = parsed.kegiatanList || DEFAULT_PRESENSI_KEGIATAN;
                ASNPresensi.data.todaySessions = parsed.todaySessions || [];
                ASNPresensi.data.recentSessions = parsed.recentSessions || [];
                ASNPresensi.data.students = parsed.students || [];
                ASNPresensi.data.stats = parsed.stats || ASNPresensi.data.stats;
            } else {
                ASNPresensi.data.kegiatanList = DEFAULT_PRESENSI_KEGIATAN;
            }
        } catch (ce) {
            ASNPresensi.data.kegiatanList = DEFAULT_PRESENSI_KEGIATAN;
        }
    } finally {
        // Fallback populasi santri dari adminStudentsData jika data students masih kosong
        if ((!ASNPresensi.data.students || ASNPresensi.data.students.length === 0) && typeof adminStudentsData !== 'undefined' && Array.isArray(adminStudentsData) && adminStudentsData.length > 0) {
            ASNPresensi.data.students = adminStudentsData.map(s => ({
                studentId: s.student_id || s.studentId || s.id || '',
                nis: s.nis || '',
                name: s.name || s.student_name || '',
                gender: s.gender || 'L',
                photoUrl: s.photo_url || '',
                program: s.program || '',
                status: s.status || 'Aktif',
                qrCode: s.qr_code || s.nis || s.student_id || ''
            }));
            if (ASNPresensi.data.stats) {
                ASNPresensi.data.stats.totalSantriAktif = ASNPresensi.data.students.length;
            }
        }

        if (loader) loader.classList.add('hidden');
        renderPresensiDashboard();
    }
}

/**
 * Merender dashboard utama Presensi
 */
function renderPresensiDashboard() {
    const stats = ASNPresensi.data.stats || {};

    // 1. Update Stat Cards
    const elTodaySess = document.getElementById('presensi-stat-today-sessions');
    if (elTodaySess) elTodaySess.textContent = (ASNPresensi.data.todaySessions || []).length + ' Sesi';

    const elRerata = document.getElementById('presensi-stat-rerata-pct');
    if (elRerata) elRerata.textContent = (stats.rerataKehadiranPct != null ? stats.rerataKehadiranPct : 100) + '%';

    const elIzinSakit = document.getElementById('presensi-stat-izin-sakit');
    if (elIzinSakit) {
        const totalIS = (stats.totalIzinHariIni || 0) + (stats.totalSakitHariIni || 0);
        elIzinSakit.textContent = totalIS + ' Santri';
    }

    const elAlpa = document.getElementById('presensi-stat-alpa');
    if (elAlpa) elAlpa.textContent = (stats.totalAlpaHariIni || 0) + ' Santri';

    // 2. Render sub-views berdasarkan tab yang sedang aktif
    renderPresensiTodaySessions();
    renderPresensiKegiatanMaster();

    // 3. Update dropdown kegiatan pada modal buka sesi
    populatePresensiKegiatanDropdown();
}

/**
 * Berpindah tab utama Presensi: 'today' | 'live' | 'rekap' | 'agenda'
 */
function switchPresensiMainTab(tabName) {
    ASNPresensi.activeMainTab = tabName;

    const tabs = ['today', 'live', 'rekap', 'agenda'];
    tabs.forEach(t => {
        const btn = document.getElementById(`tab-presensi-btn-${t}`);
        const panel = document.getElementById(`panel-presensi-${t}`);
        if (btn) {
            if (t === tabName) {
                btn.className = "flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 text-white shadow-sm transition active:scale-95 shrink-0";
            } else {
                btn.className = "flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1c2836] transition active:scale-95 shrink-0";
            }
        }
        if (panel) {
            if (t === tabName) panel.classList.remove('hidden');
            else panel.classList.add('hidden');
        }
    });

    if (tabName === 'live') {
        renderLiveStudentList();
    } else if (tabName === 'rekap') {
        loadPresensiRekapData();
    } else if (tabName === 'agenda') {
        renderPresensiKegiatanMaster();
    } else {
        // Hentikan scanner jika keluar dari tab live
        stopPresensiQRScanner();
    }
}

/**
 * Merender daftar sesi hari ini & riwayat sesi sebelumnya
 */
function renderPresensiTodaySessions() {
    const containerToday = document.getElementById('presensi-today-sessions-list');
    const containerRecent = document.getElementById('presensi-recent-sessions-list');
    const emptyToday = document.getElementById('presensi-today-empty');

    const todaySessions = ASNPresensi.data.todaySessions || [];
    const recentSessions = ASNPresensi.data.recentSessions || [];

    if (containerToday) {
        if (todaySessions.length === 0) {
            containerToday.innerHTML = '';
            if (emptyToday) emptyToday.classList.remove('hidden');
        } else {
            if (emptyToday) emptyToday.classList.add('hidden');
            let html = '';
            todaySessions.forEach(s => {
                const total = s.totalPeserta || 0;
                const hadir = s.totalHadir || 0;
                const pct = total > 0 ? Math.round((hadir / total) * 100) : 100;
                const isTutup = s.statusSesi === 'Tutup';

                html += `
                <div class="bg-white dark:bg-[#15202d] p-4 rounded-2xl border border-slate-100 dark:border-[#253447] shadow-sm hover:shadow-md transition space-y-3">
                    <div class="flex items-start justify-between">
                        <div class="space-y-1">
                            <div class="flex items-center gap-2 flex-wrap">
                                <span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
                                    ${escapeHtml(s.namaKegiatan)}
                                </span>
                                <span class="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                                    <i class="fa-regular fa-clock text-[10px]"></i> ${escapeHtml(s.waktuBuka || '-')} WIB
                                </span>
                                <span class="px-2 py-0.5 rounded-full text-[9px] font-bold ${isTutup ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' : 'bg-emerald-500 text-white animate-pulse'}">
                                    ${isTutup ? 'Selesai Direkap' : 'Sedang Buka (Live)'}
                                </span>
                            </div>
                            <p class="text-xs text-slate-500 dark:text-slate-400">Petugas: <strong class="text-slate-700 dark:text-slate-200">${escapeHtml(s.petugas || 'Admin')}</strong></p>
                        </div>
                        <div class="flex items-center gap-1.5 shrink-0">
                            <button type="button" onclick="resumePresensiSesi('${escapeHtml(s.sesiId)}')" 
                                class="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-xl text-xs font-bold transition flex items-center gap-1 active:scale-95"
                                title="Buka Checklist Absensi">
                                <i class="fa-solid fa-clipboard-user text-xs"></i>
                                <span>${isTutup ? 'Lihat / Edit' : 'Absen Santri'}</span>
                            </button>
                            <button type="button" onclick="deletePresensiSesiAction('${escapeHtml(s.sesiId)}')" 
                                class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition flex items-center justify-center text-xs"
                                title="Hapus Sesi">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Progress Bar Kehadiran -->
                    <div class="space-y-1.5 pt-1 border-t border-slate-100 dark:border-[#253447]">
                        <div class="flex justify-between text-[11px] font-medium text-slate-600 dark:text-slate-300">
                            <span>Tingkat Kehadiran: <strong class="text-emerald-600 dark:text-emerald-400 font-bold">${pct}%</strong> (${hadir}/${total} Santri)</span>
                            <div class="flex items-center gap-2 text-[10px]">
                                <span class="text-blue-600 font-bold">${s.totalIzin || 0} Izin</span>
                                <span class="text-amber-600 font-bold">${s.totalSakit || 0} Sakit</span>
                                <span class="text-rose-600 font-bold">${s.totalAlpa || 0} Alpa</span>
                            </div>
                        </div>
                        <div class="w-full h-2 bg-slate-100 dark:bg-[#1c2836] rounded-full overflow-hidden flex">
                            <div class="bg-emerald-500 h-full transition-all" style="width: ${pct}%"></div>
                            <div class="bg-blue-400 h-full" style="width: ${(total > 0 ? (s.totalIzin/total)*100 : 0)}%"></div>
                            <div class="bg-amber-400 h-full" style="width: ${(total > 0 ? (s.totalSakit/total)*100 : 0)}%"></div>
                            <div class="bg-rose-500 h-full" style="width: ${(total > 0 ? (s.totalAlpa/total)*100 : 0)}%"></div>
                        </div>
                    </div>
                </div>`;
            });
            containerToday.innerHTML = html;
        }
    }

    if (containerRecent) {
        if (recentSessions.length === 0) {
            containerRecent.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">Belum ada riwayat sesi presensi terdahulu.</p>';
        } else {
            let htmlRecent = '';
            recentSessions.slice(0, 10).forEach(s => {
                htmlRecent += `
                <tr class="border-b border-slate-50 dark:border-[#1e2a3a] hover:bg-slate-50/60 dark:hover:bg-[#1c2836]/40 transition text-xs">
                    <td class="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-200">${escapeHtml(s.tanggal)}</td>
                    <td class="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-100">${escapeHtml(s.namaKegiatan)}</td>
                    <td class="py-2.5 px-3 text-slate-500">${escapeHtml(s.petugas || '-')}</td>
                    <td class="py-2.5 px-3 text-center">
                        <span class="font-bold text-emerald-600">${s.totalHadir}</span> / <span class="text-slate-400">${s.totalPeserta}</span>
                    </td>
                    <td class="py-2.5 px-3 text-center">
                        <span class="text-[10px] text-blue-600 font-bold mr-1.5">${s.totalIzin || 0} I</span>
                        <span class="text-[10px] text-amber-600 font-bold mr-1.5">${s.totalSakit || 0} S</span>
                        <span class="text-[10px] text-rose-600 font-bold">${s.totalAlpa || 0} A</span>
                    </td>
                    <td class="py-2.5 px-3 text-right">
                        <button type="button" onclick="resumePresensiSesi('${escapeHtml(s.sesiId)}')" 
                            class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-700 text-[11px] font-bold transition">
                            Detail
                        </button>
                    </td>
                </tr>`;
            });
            containerRecent.innerHTML = htmlRecent;
        }
    }
}

/**
 * Membuka Modal Buka Sesi Absen Baru
 */
function openPresensiBukaSesiModal(defaultKegiatanId = '') {
    const modal = document.getElementById('modal-presensi-buka-sesi');
    if (!modal) return;

    populatePresensiKegiatanDropdown();

    const selectKeg = document.getElementById('presensi-modal-kegiatan-id');
    if (selectKeg && defaultKegiatanId) {
        selectKeg.value = defaultKegiatanId;
    }

    const tglInput = document.getElementById('presensi-modal-tanggal');
    if (tglInput) tglInput.value = ASNPresensi.data.todayStr || new Date().toISOString().substring(0, 10);

    const waktuInput = document.getElementById('presensi-modal-waktu');
    if (waktuInput) {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        waktuInput.value = `${hh}:${mm}`;
    }

    modal.classList.remove('hidden');
}

function closePresensiBukaSesiModal() {
    const modal = document.getElementById('modal-presensi-buka-sesi');
    if (modal) modal.classList.add('hidden');
}

/**
 * Mengisi dropdown pilihan kegiatan
 */
function populatePresensiKegiatanDropdown() {
    const select = document.getElementById('presensi-modal-kegiatan-id');
    if (!select) return;

    const list = ASNPresensi.data.kegiatanList || [];
    let opts = '<option value="">-- Pilih Kegiatan Pondok --</option>';
    list.forEach(k => {
        if (k.status === 'Aktif') {
            opts += `<option value="${escapeHtml(k.kegiatanId)}" data-nama="${escapeHtml(k.namaKegiatan)}" data-target="${escapeHtml(k.targetPeserta)}">
                [${escapeHtml(k.kategori)}] ${escapeHtml(k.namaKegiatan)} (${escapeHtml(k.jadwalRutin || 'Rutin')})
            </option>`;
        }
    });
    select.innerHTML = opts;
}

/**
 * Submit form pembukaan sesi baru
 */
function submitPresensiBukaSesi(e) {
    if (e && e.preventDefault) e.preventDefault();

    const select = document.getElementById('presensi-modal-kegiatan-id');
    const tglInput = document.getElementById('presensi-modal-tanggal');
    const waktuInput = document.getElementById('presensi-modal-waktu');
    const petugasInput = document.getElementById('presensi-modal-petugas');
    const catatanInput = document.getElementById('presensi-modal-catatan');

    if (!select || !select.value) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({ icon: 'warning', title: 'Pilih Kegiatan', text: 'Silakan pilih kegiatan yang akan diabsen!' });
        } else alert('Silakan pilih kegiatan yang akan diabsen!');
        return;
    }

    const selectedOpt = select.options[select.selectedIndex];
    const kegiatanId = select.value;
    const namaKegiatan = selectedOpt ? selectedOpt.dataset.nama || selectedOpt.text : 'Kegiatan Santri';
    const targetPeserta = selectedOpt ? selectedOpt.dataset.target || 'Semua Santri' : 'Semua Santri';
    const tanggal = tglInput ? tglInput.value : new Date().toISOString().substring(0, 10);
    const waktuBuka = waktuInput ? waktuInput.value : '05:00';
    const petugas = petugasInput ? petugasInput.value.trim() : 'Admin';
    const catatan = catatanInput ? catatanInput.value.trim() : '';

    // Filter santri yang memenuhi target peserta
    let eligibleStudents = ASNPresensi.data.students || [];
    if (targetPeserta.toLowerCase().includes('putra')) {
        eligibleStudents = eligibleStudents.filter(s => String(s.gender || 'L').toUpperCase() === 'L');
    } else if (targetPeserta.toLowerCase().includes('putri')) {
        eligibleStudents = eligibleStudents.filter(s => String(s.gender || 'P').toUpperCase() === 'P');
    }

    // Inisialisasi Sesi Aktif
    const newSesiId = 'SESI-' + tanggal.replace(/-/g, '') + '-' + waktuBuka.replace(/:/g, '') + '-' + Math.floor(Math.random() * 100);
    ASNPresensi.data.activeSession = {
        sesiId: newSesiId,
        kegiatanId: kegiatanId,
        namaKegiatan: namaKegiatan,
        targetPeserta: targetPeserta,
        tanggal: tanggal,
        waktuBuka: waktuBuka,
        petugas: petugas,
        totalPeserta: eligibleStudents.length,
        statusSesi: 'Buka',
        catatan: catatan
    };

    // Default: Semua santri berstatus 'Hadir' (Zero exception)
    ASNPresensi.data.activeStudentsMap = {};
    eligibleStudents.forEach(st => {
        ASNPresensi.data.activeStudentsMap[st.studentId] = {
            status: 'Hadir',
            keterangan: '',
            metode: 'CHECKLIST'
        };
    });

    closePresensiBukaSesiModal();

    // Pindah ke Tab Live Attendance
    switchPresensiMainTab('live');

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'success',
            title: 'Sesi Absensi Dimulai',
            text: `Kegiatan: ${namaKegiatan} (${eligibleStudents.length} Santri). Seluruh santri otomatis berstatus Hadir. Anda cukup menandai santri yang Izin, Sakit, atau Alpa.`,
            timer: 2500,
            showConfirmButton: false
        });
    }
}

/**
 * Melanjutkan / Membuka kembali sesi presensi yang sudah tersimpan
 */
async function resumePresensiSesi(sesiId) {
    if (!sesiId) return;

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Memuat Sesi Presensi...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });
    }

    try {
        const token = getPresensiToken();
        const res = await callApi({
            action: 'getPresensiSesiDetail',
            sesiId: sesiId,
            token: token
        });

        if (res && res.ok && res.data) {
            const sesi = res.data.sesi;
            const students = res.data.students || [];

            ASNPresensi.data.activeSession = sesi;
            ASNPresensi.data.activeStudentsMap = {};

            students.forEach(st => {
                ASNPresensi.data.activeStudentsMap[st.studentId] = {
                    status: st.statusKehadiran || 'Hadir',
                    keterangan: st.keterangan || '',
                    metode: st.metodeAbsen || 'CHECKLIST'
                };
            });

            if (typeof Swal !== 'undefined') Swal.close();

            switchPresensiMainTab('live');
        } else {
            throw new Error(res.message || 'Sesi tidak dapat dibuka');
        }
    } catch (err) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({ icon: 'error', title: 'Gagal Memuat Sesi', text: err.message });
        } else alert('Gagal: ' + err.message);
    }
}

/**
 * Menghapus Sesi Presensi
 */
async function deletePresensiSesiAction(sesiId) {
    if (!sesiId) return;

    let confirm = true;
    if (typeof Swal !== 'undefined') {
        const r = await Swal.fire({
            icon: 'warning',
            title: 'Hapus Sesi Presensi?',
            text: 'Data rekapan sesi dan catatan absen santri pada sesi ini akan dihapus permanen.',
            showCancelButton: true,
            confirmButtonColor: '#e11d48',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Ya, Hapus',
            cancelButtonText: 'Batal'
        });
        confirm = r.isConfirmed;
    } else {
        confirm = window.confirm('Hapus sesi presensi ini?');
    }
    if (!confirm) return;

    try {
        const token = getPresensiToken();
        const res = await callApi({
            action: 'deletePresensiSesi',
            sesiId: sesiId,
            token: token
        });
        if (res && (res.ok || res.success)) {
            if (typeof Swal !== 'undefined') {
                Swal.fire({ icon: 'success', title: 'Terhapus', text: 'Sesi presensi berhasil dihapus.', timer: 1500 });
            }
            loadAdminPresensiData(true);
        } else {
            throw new Error(res.message || 'Gagal menghapus');
        }
    } catch (err) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({ icon: 'error', title: 'Error', text: err.message });
        } else alert('Error: ' + err.message);
    }
}

/**
 * Merender daftar santri pada sesi aktif (Checklist Massal)
 */
function renderLiveStudentList() {
    const session = ASNPresensi.data.activeSession;
    const headerTitle = document.getElementById('presensi-live-session-title');
    const headerMeta = document.getElementById('presensi-live-session-meta');

    if (!session) {
        const emptyNotice = document.getElementById('presensi-live-no-session');
        const liveContent = document.getElementById('presensi-live-content');
        if (emptyNotice) emptyNotice.classList.remove('hidden');
        if (liveContent) liveContent.classList.add('hidden');
        return;
    }

    const emptyNotice = document.getElementById('presensi-live-no-session');
    const liveContent = document.getElementById('presensi-live-content');
    if (emptyNotice) emptyNotice.classList.add('hidden');
    if (liveContent) liveContent.classList.remove('hidden');

    if (headerTitle) headerTitle.textContent = session.namaKegiatan || 'Presensi Kegiatan';
    if (headerMeta) {
        headerMeta.textContent = `${session.tanggal} | Pukul ${session.waktuBuka} WIB | Petugas: ${session.petugas || 'Admin'}`;
    }

    // Ambil list santri dan terapkan filter pencarian / gender
    let students = ASNPresensi.data.students || [];
    const filter = ASNPresensi.data.activeFilter;

    // Filter target peserta sesi (jika sesi khusus putra / putri)
    const targetPeserta = (session.targetPeserta || 'Semua Santri').toLowerCase();
    if (targetPeserta.includes('putra')) {
        students = students.filter(s => String(s.gender || 'L').toUpperCase() === 'L');
    } else if (targetPeserta.includes('putri')) {
        students = students.filter(s => String(s.gender || 'P').toUpperCase() === 'P');
    }

    // Filter gender tab live
    if (filter.gender !== 'all') {
        students = students.filter(s => String(s.gender || 'L').toUpperCase() === filter.gender.toUpperCase());
    }

    // Filter teks pencarian
    if (filter.search) {
        const q = filter.search.toLowerCase();
        students = students.filter(s => (s.name || '').toLowerCase().includes(q) || (s.nis || '').includes(q));
    }

    // Hitung counter dinamis
    let countHadir = 0;
    let countIzin = 0;
    let countSakit = 0;
    let countAlpa = 0;

    for (const stId in ASNPresensi.data.activeStudentsMap) {
        const st = ASNPresensi.data.activeStudentsMap[stId];
        if (st.status === 'Hadir') countHadir++;
        else if (st.status === 'Izin') countIzin++;
        else if (st.status === 'Sakit') countSakit++;
        else if (st.status === 'Alpa') countAlpa++;
    }

    const totalEligible = Object.keys(ASNPresensi.data.activeStudentsMap).length || students.length;

    // Update Counter Bar
    const bHadir = document.getElementById('presensi-count-hadir');
    const bIzin = document.getElementById('presensi-count-izin');
    const bSakit = document.getElementById('presensi-count-sakit');
    const bAlpa = document.getElementById('presensi-count-alpa');
    const bTotal = document.getElementById('presensi-count-total');

    if (bHadir) bHadir.textContent = countHadir;
    if (bIzin) bIzin.textContent = countIzin;
    if (bSakit) bSakit.textContent = countSakit;
    if (bAlpa) bAlpa.textContent = countAlpa;
    if (bTotal) bTotal.textContent = totalEligible;

    // Render Desktop Table & Mobile Cards
    const tableBody = document.getElementById('presensi-live-table-body');
    const mobileCards = document.getElementById('presensi-live-mobile-cards');

    let tableHtml = '';
    let cardsHtml = '';

    students.forEach((st, idx) => {
        const stId = st.studentId;
        const entry = ASNPresensi.data.activeStudentsMap[stId] || { status: 'Hadir', keterangan: '', metode: 'CHECKLIST' };
        const status = entry.status;
        const ket = entry.keterangan || '';

        // DESKTOP TABLE ROW
        tableHtml += `
        <tr class="border-b border-slate-100 dark:border-[#253447] hover:bg-slate-50/50 dark:hover:bg-[#1c2836]/40 transition text-xs">
            <td class="py-3 px-3 text-center text-slate-400 font-bold">${idx + 1}</td>
            <td class="py-3 px-3">
                <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-center text-xs shrink-0">
                        ${escapeHtml((st.name || 'S').charAt(0))}
                    </div>
                    <div>
                        <span class="font-bold text-slate-800 dark:text-slate-100 block">${escapeHtml(st.name)}</span>
                        <span class="text-[10px] text-slate-400">NIS: ${escapeHtml(st.nis || '-')} | ${st.gender === 'L' ? 'Putra' : 'Putri'}</span>
                    </div>
                </div>
            </td>
            <td class="py-3 px-3 text-center">
                <div class="inline-flex rounded-xl p-1 bg-slate-100 dark:bg-[#1c2836] border border-slate-200 dark:border-[#283a4e] gap-1">
                    <button type="button" onclick="setStudentAttendance('${escapeHtml(stId)}', 'Hadir')" 
                        class="px-2.5 py-1 rounded-lg font-extrabold text-[10px] transition active:scale-95 ${status === 'Hadir' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-emerald-700'}">
                        H
                    </button>
                    <button type="button" onclick="setStudentAttendance('${escapeHtml(stId)}', 'Izin')" 
                        class="px-2.5 py-1 rounded-lg font-extrabold text-[10px] transition active:scale-95 ${status === 'Izin' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-blue-700'}">
                        I
                    </button>
                    <button type="button" onclick="setStudentAttendance('${escapeHtml(stId)}', 'Sakit')" 
                        class="px-2.5 py-1 rounded-lg font-extrabold text-[10px] transition active:scale-95 ${status === 'Sakit' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-500 hover:text-amber-700'}">
                        S
                    </button>
                    <button type="button" onclick="setStudentAttendance('${escapeHtml(stId)}', 'Alpa')" 
                        class="px-2.5 py-1 rounded-lg font-extrabold text-[10px] transition active:scale-95 ${status === 'Alpa' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-500 hover:text-rose-700'}">
                        A
                    </button>
                </div>
            </td>
            <td class="py-3 px-3">
                <input type="text" value="${escapeHtml(ket)}" placeholder="${status === 'Izin' || status === 'Sakit' ? 'Alasan / keterangan (wajib)' : 'Catatan khusus...'}" 
                    onchange="updateStudentAttendanceNote('${escapeHtml(stId)}', this.value)"
                    class="w-full text-xs px-2.5 py-1 rounded-lg bg-white dark:bg-[#15202d] border ${status !== 'Hadir' ? 'border-amber-300 dark:border-amber-700 bg-amber-50/30' : 'border-slate-200 dark:border-[#283a4e]'} text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500">
            </td>
        </tr>`;

        // MOBILE CARD (ZERO-SCROLL PASS DI HP)
        let statusBadgeBg = 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300';
        if (status === 'Izin') statusBadgeBg = 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300';
        else if (status === 'Sakit') statusBadgeBg = 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300';
        else if (status === 'Alpa') statusBadgeBg = 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300';

        cardsHtml += `
        <div class="bg-white dark:bg-[#15202d] p-3 rounded-2xl border ${status !== 'Hadir' ? 'border-amber-300 dark:border-amber-700 shadow-sm' : 'border-slate-100 dark:border-[#253447]'} space-y-2.5">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 overflow-hidden">
                    <span class="w-6 h-6 rounded-full bg-slate-100 dark:bg-[#1c2836] text-[10px] font-bold text-slate-500 flex items-center justify-center shrink-0">
                        ${idx + 1}
                    </span>
                    <div class="truncate">
                        <h4 class="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">${escapeHtml(st.name)}</h4>
                        <span class="text-[10px] text-slate-400">NIS: ${escapeHtml(st.nis || '-')}</span>
                    </div>
                </div>
                <span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border ${statusBadgeBg} shrink-0">
                    ${status}
                </span>
            </div>

            <!-- CHIPS PEMILIH STATUS -->
            <div class="grid grid-cols-4 gap-1.5 pt-1 border-t border-slate-100 dark:border-[#253447]">
                <button type="button" onclick="setStudentAttendance('${escapeHtml(stId)}', 'Hadir')" 
                    class="py-1.5 rounded-xl font-bold text-[11px] transition active:scale-95 ${status === 'Hadir' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-[#1c2836] text-slate-600 dark:text-slate-300'}">
                    Hadir
                </button>
                <button type="button" onclick="setStudentAttendance('${escapeHtml(stId)}', 'Izin')" 
                    class="py-1.5 rounded-xl font-bold text-[11px] transition active:scale-95 ${status === 'Izin' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-[#1c2836] text-slate-600 dark:text-slate-300'}">
                    Izin
                </button>
                <button type="button" onclick="setStudentAttendance('${escapeHtml(stId)}', 'Sakit')" 
                    class="py-1.5 rounded-xl font-bold text-[11px] transition active:scale-95 ${status === 'Sakit' ? 'bg-amber-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-[#1c2836] text-slate-600 dark:text-slate-300'}">
                    Sakit
                </button>
                <button type="button" onclick="setStudentAttendance('${escapeHtml(stId)}', 'Alpa')" 
                    class="py-1.5 rounded-xl font-bold text-[11px] transition active:scale-95 ${status === 'Alpa' ? 'bg-rose-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-[#1c2836] text-slate-600 dark:text-slate-300'}">
                    Alpa
                </button>
            </div>

            <!-- INPUT KETERANGAN JIKA TIDAK HADIR -->
            ${status !== 'Hadir' ? `
            <div class="pt-1">
                <input type="text" value="${escapeHtml(ket)}" placeholder="Tulis alasan izin / sakit..." 
                    onchange="updateStudentAttendanceNote('${escapeHtml(stId)}', this.value)"
                    class="w-full text-xs px-2.5 py-1.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500">
            </div>` : ''}
        </div>`;
    });

    if (tableBody) tableBody.innerHTML = tableHtml || '<tr><td colspan="4" class="text-center py-6 text-slate-400">Tidak ada santri yang sesuai filter.</td></tr>';
    if (mobileCards) mobileCards.innerHTML = cardsHtml || '<p class="text-xs text-center py-6 text-slate-400">Tidak ada santri yang sesuai filter.</p>';
}

/**
 * Filter santri pada Live Checklist
 */
function setLiveFilterGender(gender) {
    ASNPresensi.data.activeFilter.gender = gender;
    const btns = ['all', 'L', 'P'];
    btns.forEach(g => {
        const b = document.getElementById(`presensi-filter-gender-${g}`);
        if (b) {
            if (g === gender) b.className = "px-3 py-1.5 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-sm";
            else b.className = "px-3 py-1.5 bg-slate-100 dark:bg-[#1c2836] text-slate-600 dark:text-slate-300 font-semibold text-xs rounded-xl hover:bg-slate-200 transition";
        }
    });
    renderLiveStudentList();
}

function onSearchLiveStudent(query) {
    ASNPresensi.data.activeFilter.search = query || '';
    renderLiveStudentList();
}

/**
 * Fitur 1-Klik: "Tandai Semua Hadir"
 */
function setAllStudentsAttendance(targetStatus = 'Hadir') {
    const session = ASNPresensi.data.activeSession;
    if (!session) return;

    for (const stId in ASNPresensi.data.activeStudentsMap) {
        ASNPresensi.data.activeStudentsMap[stId].status = targetStatus;
    }
    renderLiveStudentList();

    if (typeof Swal !== 'undefined') {
        const toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
        toast.fire({ icon: 'success', title: `Seluruh santri ditandai ${targetStatus}` });
    }
}

/**
 * Mengubah status per santri
 */
function setStudentAttendance(studentId, newStatus) {
    if (!ASNPresensi.data.activeStudentsMap[studentId]) {
        ASNPresensi.data.activeStudentsMap[studentId] = { status: 'Hadir', keterangan: '', metode: 'CHECKLIST' };
    }
    ASNPresensi.data.activeStudentsMap[studentId].status = newStatus;
    renderLiveStudentList();
}

function updateStudentAttendanceNote(studentId, note) {
    if (ASNPresensi.data.activeStudentsMap[studentId]) {
        ASNPresensi.data.activeStudentsMap[studentId].keterangan = note.trim();
    }
}

/**
 * Menyimpan Sesi Presensi ke Backend
 * INTI: HANYA MENGIRIM KETERANGAN SELAIN HADIR (Exception-Based)
 */
async function saveLivePresensiProgress(isFinal = false) {
    const session = ASNPresensi.data.activeSession;
    if (!session) return;

    // Ekstraksi HANYA yang BUKAN 'Hadir' (Izin, Sakit, Alpa)
    const exceptions = [];
    const students = ASNPresensi.data.students || [];
    const studentLookup = {};
    students.forEach(s => { studentLookup[s.studentId] = s; });

    for (const stId in ASNPresensi.data.activeStudentsMap) {
        const entry = ASNPresensi.data.activeStudentsMap[stId];
        if (entry && entry.status !== 'Hadir') {
            const stObj = studentLookup[stId] || {};
            exceptions.push({
                studentId: stId,
                nis: stObj.nis || '',
                studentName: stObj.name || '',
                gender: stObj.gender || 'L',
                statusKehadiran: entry.status,
                metodeAbsen: entry.metode || 'CHECKLIST',
                keterangan: entry.keterangan || ''
            });
        }
    }

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: isFinal ? 'Menyimpan & Menutup Sesi...' : 'Menyimpan Presensi...',
            text: `Menyimpan rekap sesi (${exceptions.length} santri tidak hadir)...`,
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });
    }

    try {
        const token = getPresensiToken();
        const payload = {
            action: 'savePresensiSesi',
            token: token,
            sesiId: session.sesiId,
            kegiatanId: session.kegiatanId,
            namaKegiatan: session.namaKegiatan,
            tanggal: session.tanggal,
            waktuBuka: session.waktuBuka,
            petugas: session.petugas,
            totalPeserta: session.totalPeserta || Object.keys(ASNPresensi.data.activeStudentsMap).length,
            statusSesi: isFinal ? 'Tutup' : 'Buka',
            catatan: session.catatan || '',
            exceptions: exceptions // HANYA PENGECUALIAN YANG DIKIRIM!
        };

        const res = await callApi(payload);
        if (res && (res.ok || res.success)) {
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'success',
                    title: isFinal ? 'Sesi Presensi Selesai' : 'Tersimpan',
                    text: res.message || 'Presensi berhasil disimpan ke spreadsheet.',
                    timer: 2000,
                    showConfirmButton: false
                });
            }

            // Refresh data dashboard di background
            await loadAdminPresensiData(true);

            if (isFinal) {
                switchPresensiMainTab('today');
            }
        } else {
            throw new Error(res.message || 'Gagal menyimpan presensi');
        }
    } catch (err) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({ icon: 'error', title: 'Gagal Menyimpan', text: err.message });
        } else alert('Gagal: ' + err.message);
    }
}

/**
 * ====================================================================
 * FITUR SCANNER KAMERA QR SANTRI (HYBRID MODE)
 * ====================================================================
 */
function setLiveInputMode(mode) {
    ASNPresensi.liveInputMode = mode;

    const btnChecklist = document.getElementById('presensi-btn-mode-checklist');
    const btnQR = document.getElementById('presensi-btn-mode-qr');
    const panelChecklist = document.getElementById('presensi-panel-checklist');
    const panelQR = document.getElementById('presensi-panel-qr');

    if (mode === 'checklist') {
        if (btnChecklist) btnChecklist.className = "px-3.5 py-1.5 rounded-xl font-bold text-xs bg-emerald-600 text-white shadow-sm";
        if (btnQR) btnQR.className = "px-3.5 py-1.5 rounded-xl font-semibold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition";
        if (panelChecklist) panelChecklist.classList.remove('hidden');
        if (panelQR) panelQR.classList.add('hidden');
        stopPresensiQRScanner();
    } else {
        if (btnChecklist) btnChecklist.className = "px-3.5 py-1.5 rounded-xl font-semibold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition";
        if (btnQR) btnQR.className = "px-3.5 py-1.5 rounded-xl font-bold text-xs bg-emerald-600 text-white shadow-sm";
        if (panelChecklist) panelChecklist.classList.add('hidden');
        if (panelQR) panelQR.classList.remove('hidden');
        startPresensiQRScanner();
    }
}

async function startPresensiQRScanner() {
    const readerElem = document.getElementById('presensi-qr-reader');
    if (!readerElem) return;

    if (typeof Html5Qrcode === 'undefined') {
        readerElem.innerHTML = `
        <div class="p-6 text-center text-xs text-slate-500 space-y-2">
            <i class="fa-solid fa-triangle-exclamation text-amber-500 text-2xl"></i>
            <p>Pustaka kamera QR belum siap. Silakan pastikan koneksi internet aktif atau gunakan mode Checklist Massal.</p>
        </div>`;
        return;
    }

    try {
        if (!ASNPresensi.scanner) {
            ASNPresensi.scanner = new Html5Qrcode("presensi-qr-reader");
        }

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        await ASNPresensi.scanner.start(
            { facingMode: "environment" },
            config,
            (decodedText) => onQRCodeScanned(decodedText),
            (errorMessage) => {}
        );
        ASNPresensi.scannerRunning = true;
    } catch (err) {
        console.warn('[Presensi QR] Gagal memulai kamera:', err);
        readerElem.innerHTML = `
        <div class="p-6 text-center text-xs text-slate-500 space-y-2">
            <i class="fa-solid fa-camera-slash text-slate-400 text-2xl"></i>
            <p>Kamera tidak dapat diakses atau izin kamera ditolak: ${escapeHtml(err.message || '')}</p>
        </div>`;
    }
}

function stopPresensiQRScanner() {
    if (ASNPresensi.scanner && ASNPresensi.scannerRunning) {
        ASNPresensi.scanner.stop().then(() => {
            ASNPresensi.scannerRunning = false;
        }).catch(err => {
            ASNPresensi.scannerRunning = false;
        });
    }
}

/**
 * Handler saat kode QR Santri terdeteksi
 */
function onQRCodeScanned(decodedText) {
    if (!decodedText) return;
    const cleanCode = decodedText.trim();

    // Cocokkan ke santri
    const students = ASNPresensi.data.students || [];
    const matched = students.find(s => s.studentId === cleanCode || s.nis === cleanCode || s.qrCode === cleanCode);

    const bannerResult = document.getElementById('presensi-qr-scan-result');

    if (matched) {
        // Tandai HADIR via QR
        if (!ASNPresensi.data.activeStudentsMap[matched.studentId]) {
            ASNPresensi.data.activeStudentsMap[matched.studentId] = { status: 'Hadir', keterangan: '', metode: 'QR_SCAN' };
        } else {
            ASNPresensi.data.activeStudentsMap[matched.studentId].status = 'Hadir';
            ASNPresensi.data.activeStudentsMap[matched.studentId].metode = 'QR_SCAN';
        }

        // Play Beep Sound (Web Audio API)
        playSuccessBeep();

        if (bannerResult) {
            bannerResult.innerHTML = `
            <div class="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded-2xl flex items-center gap-3 animate-bounce">
                <div class="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-lg font-bold">
                    <i class="fa-solid fa-circle-check"></i>
                </div>
                <div>
                    <h5 class="text-xs font-bold text-emerald-900 dark:text-emerald-200">${escapeHtml(matched.name)} (NIS: ${escapeHtml(matched.nis)})</h5>
                    <p class="text-[10px] text-emerald-700 dark:text-emerald-400">Presensi Berhasil: <strong>HADIR</strong></p>
                </div>
            </div>`;
        }
    } else {
        if (bannerResult) {
            bannerResult.innerHTML = `
            <div class="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 rounded-2xl flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center text-lg font-bold">
                    <i class="fa-solid fa-circle-xmark"></i>
                </div>
                <div>
                    <h5 class="text-xs font-bold text-rose-900 dark:text-rose-200">Kartu Santri Tidak Dikenal</h5>
                    <p class="text-[10px] text-rose-700 dark:text-rose-400">Kode: ${escapeHtml(cleanCode)}</p>
                </div>
            </div>`;
        }
    }
}

function playSuccessBeep() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // 880 Hz
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {}
}

/**
 * ====================================================================
 * TAB MASTER AGENDA KEGIATAN (CRUD)
 * ====================================================================
 */
function renderPresensiKegiatanMaster() {
    const container = document.getElementById('presensi-agenda-list');
    if (!container) return;

    const list = ASNPresensi.data.kegiatanList || [];
    if (list.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-400 text-center py-8">Belum ada agenda kegiatan yang terdaftar.</p>';
        return;
    }

    let html = '';
    list.forEach(k => {
        let catColor = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
        if (k.kategori === 'Ibadah') catColor = 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300';
        else if (k.kategori === 'Ta\'lim') catColor = 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300';
        else if (k.kategori === 'Keasramaan') catColor = 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300';

        html += `
        <div class="bg-white dark:bg-[#15202d] p-4 rounded-2xl border border-slate-100 dark:border-[#253447] shadow-sm hover:shadow transition flex flex-col justify-between space-y-3">
            <div class="flex items-start justify-between">
                <div class="space-y-1">
                    <span class="px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase ${catColor}">
                        ${escapeHtml(k.kategori || 'Umum')}
                    </span>
                    <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100">${escapeHtml(k.namaKegiatan)}</h4>
                    <p class="text-[11px] text-slate-500"><i class="fa-regular fa-clock text-[10px] mr-1"></i>${escapeHtml(k.jadwalRutin || 'Sesuai Jadwal')}</p>
                </div>
                <span class="px-2 py-0.5 rounded-full text-[9px] font-bold ${k.status === 'Aktif' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}">
                    ${k.status || 'Aktif'}
                </span>
            </div>
            
            <div class="text-[10px] text-slate-400 pt-2 border-t border-slate-50 dark:border-[#253447] flex justify-between items-center">
                <span>Target: <strong>${escapeHtml(k.targetPeserta || 'Semua')}</strong></span>
                <span>PJ: <strong>${escapeHtml(k.penanggungJawab || '-')}</strong></span>
            </div>

            <div class="flex items-center gap-1.5 pt-1">
                <button type="button" onclick="openPresensiBukaSesiModal('${escapeHtml(k.kegiatanId)}')"
                    class="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95">
                    <i class="fa-solid fa-play text-[10px]"></i>
                    <span>Buka Sesi</span>
                </button>
                <button type="button" onclick="openPresensiKegiatanModal('${escapeHtml(k.kegiatanId)}')"
                    class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1c2836] text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs transition" title="Edit">
                    <i class="fa-solid fa-pencil"></i>
                </button>
                <button type="button" onclick="deletePresensiKegiatanAction('${escapeHtml(k.kegiatanId)}')"
                    class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-rose-100 dark:bg-[#1c2836] text-slate-400 hover:text-rose-600 flex items-center justify-center text-xs transition" title="Hapus">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        </div>`;
    });

    container.innerHTML = html;
}

function openPresensiKegiatanModal(kegiatanId = '') {
    const modal = document.getElementById('modal-presensi-kegiatan');
    if (!modal) return;

    const idInput = document.getElementById('presensi-agenda-form-id');
    const namaInput = document.getElementById('presensi-agenda-form-nama');
    const katInput = document.getElementById('presensi-agenda-form-kategori');
    const jadwalInput = document.getElementById('presensi-agenda-form-jadwal');
    const targetInput = document.getElementById('presensi-agenda-form-target');
    const pjInput = document.getElementById('presensi-agenda-form-pj');
    const statusInput = document.getElementById('presensi-agenda-form-status');

    if (kegiatanId) {
        const item = (ASNPresensi.data.kegiatanList || []).find(k => k.kegiatanId === kegiatanId);
        if (item) {
            if (idInput) idInput.value = item.kegiatanId;
            if (namaInput) namaInput.value = item.namaKegiatan;
            if (katInput) katInput.value = item.kategori;
            if (jadwalInput) jadwalInput.value = item.jadwalRutin;
            if (targetInput) {
                const t = (item.targetPeserta || 'Semua Santri').toLowerCase();
                if (t.includes('putri')) targetInput.value = 'Khusus Santri Putri';
                else if (t.includes('putra')) targetInput.value = 'Khusus Santri Putra';
                else targetInput.value = 'Semua Santri';
            }
            if (pjInput) pjInput.value = item.penanggungJawab;
            if (statusInput) statusInput.value = item.status;
        }
    } else {
        if (idInput) idInput.value = '';
        if (namaInput) namaInput.value = '';
        if (katInput) katInput.value = 'Ibadah';
        if (jadwalInput) jadwalInput.value = '';
        if (targetInput) targetInput.value = 'Semua Santri';
        if (pjInput) pjInput.value = '';
        if (statusInput) statusInput.value = 'Aktif';
    }

    modal.classList.remove('hidden');
}

function closePresensiKegiatanModal() {
    const modal = document.getElementById('modal-presensi-kegiatan');
    if (!modal) return;
    modal.classList.add('hidden');
}

async function submitPresensiKegiatan(e) {
    if (e && e.preventDefault) e.preventDefault();

    const idInput = document.getElementById('presensi-agenda-form-id');
    const namaInput = document.getElementById('presensi-agenda-form-nama');
    const katInput = document.getElementById('presensi-agenda-form-kategori');
    const jadwalInput = document.getElementById('presensi-agenda-form-jadwal');
    const targetInput = document.getElementById('presensi-agenda-form-target');
    const pjInput = document.getElementById('presensi-agenda-form-pj');
    const statusInput = document.getElementById('presensi-agenda-form-status');

    const nama = namaInput ? namaInput.value.trim() : '';
    if (!nama) {
        alert('Nama kegiatan wajib diisi');
        return;
    }

    const payload = {
        action: 'savePresensiKegiatan',
        token: getPresensiToken(),
        kegiatanId: idInput ? idInput.value : '',
        namaKegiatan: nama,
        kategori: katInput ? katInput.value : 'Umum',
        jadwalRutin: jadwalInput ? jadwalInput.value.trim() : '',
        targetPeserta: targetInput ? targetInput.value : 'Semua Santri',
        penanggungJawab: pjInput ? pjInput.value.trim() : '',
        status: statusInput ? statusInput.value : 'Aktif'
    };

    if (typeof Swal !== 'undefined') {
        Swal.fire({ title: 'Menyimpan Agenda...', didOpen: () => Swal.showLoading() });
    }

    try {
        const res = await callApi(payload);
        if (res && (res.ok || res.success)) {
            closePresensiKegiatanModal();
            if (typeof Swal !== 'undefined') {
                Swal.fire({ icon: 'success', title: 'Berhasil', text: res.message || 'Agenda kegiatan berhasil disimpan.', timer: 1500 });
            }
            loadAdminPresensiData(true);
        } else {
            throw new Error(res.message || 'Gagal menyimpan');
        }
    } catch (err) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({ icon: 'error', title: 'Error', text: err.message });
        } else alert('Error: ' + err.message);
    }
}

async function deletePresensiKegiatanAction(kegiatanId) {
    if (!kegiatanId) return;
    if (!window.confirm('Hapus agenda kegiatan ini?')) return;

    try {
        const res = await callApi({
            action: 'deletePresensiKegiatan',
            token: getPresensiToken(),
            kegiatanId: kegiatanId
        });
        if (res && (res.ok || res.success)) {
            loadAdminPresensiData(true);
        } else {
            alert('Gagal: ' + (res.message || ''));
        }
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

/**
 * ====================================================================
 * TAB REKAPITULASI & STATISTIK KEDISIPLINAN
 * ====================================================================
 */
async function loadPresensiRekapData() {
    const tableBody = document.getElementById('presensi-rekap-table-body');
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="7" class="text-center py-6 text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Mengkalkulasi rekapitulasi kehadiran...</td></tr>';

    const tglMulai = document.getElementById('presensi-rekap-filter-start')?.value || '';
    const tglSelesai = document.getElementById('presensi-rekap-filter-end')?.value || '';
    const kegiatanId = document.getElementById('presensi-rekap-filter-kegiatan')?.value || '';
    const gender = document.getElementById('presensi-rekap-filter-gender')?.value || '';

    try {
        const res = await callApi({
            action: 'getPresensiRekap',
            token: getPresensiToken(),
            filter: {
                startDate: tglMulai,
                endDate: tglSelesai,
                kegiatanId: kegiatanId,
                gender: gender
            }
        });

        if (res && res.ok && res.data) {
            ASNPresensi.data.rekapData = res.data;
            renderPresensiRekapTable(res.data.rekap || []);
        }
    } catch (err) {
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-rose-500">Gagal memuat rekap: ${escapeHtml(err.message)}</td></tr>`;
    }
}

function renderPresensiRekapTable(list = []) {
    const tableBody = document.getElementById('presensi-rekap-table-body');
    const mobileCards = document.getElementById('presensi-rekap-mobile-cards');

    if (!list || list.length === 0) {
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="7" class="text-center py-6 text-slate-400">Tidak ada data rekap yang sesuai filter.</td></tr>';
        if (mobileCards) mobileCards.innerHTML = '<p class="text-xs text-center py-6 text-slate-400">Tidak ada data rekap yang sesuai filter.</p>';
        return;
    }

    let tHtml = '';
    let mHtml = '';

    list.forEach((st, idx) => {
        const pct = st.persentase != null ? st.persentase : 100;
        let pctColor = 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200';
        if (pct < 75) pctColor = 'text-rose-600 bg-rose-50 dark:bg-rose-950/60 border-rose-200';
        else if (pct < 90) pctColor = 'text-amber-600 bg-amber-50 dark:bg-amber-950/60 border-amber-200';

        tHtml += `
        <tr class="border-b border-slate-50 dark:border-[#1e2a3a] hover:bg-slate-50/60 dark:hover:bg-[#1c2836]/40 transition text-xs">
            <td class="py-2.5 px-3 text-center text-slate-400 font-bold">${idx + 1}</td>
            <td class="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-100">${escapeHtml(st.name)}</td>
            <td class="py-2.5 px-3 text-slate-400">${escapeHtml(st.nis || '-')}</td>
            <td class="py-2.5 px-3 text-center font-bold text-slate-700 dark:text-slate-200">${st.totalSesi || 0}</td>
            <td class="py-2.5 px-3 text-center font-bold text-emerald-600">${st.hadir || 0}</td>
            <td class="py-2.5 px-3 text-center">
                <span class="text-blue-600 font-bold mr-1.5">${st.izin || 0} I</span>
                <span class="text-amber-600 font-bold mr-1.5">${st.sakit || 0} S</span>
                <span class="text-rose-600 font-bold">${st.alpa || 0} A</span>
            </td>
            <td class="py-2.5 px-3 text-center">
                <span class="px-2.5 py-1 rounded-lg text-xs font-black border ${pctColor}">
                    ${pct}%
                </span>
            </td>
        </tr>`;

        mHtml += `
        <div class="bg-white dark:bg-[#15202d] p-3 rounded-2xl border border-slate-100 dark:border-[#253447] shadow-sm space-y-2">
            <div class="flex items-center justify-between">
                <div>
                    <h5 class="text-xs font-bold text-slate-800 dark:text-slate-100">${escapeHtml(st.name)}</h5>
                    <span class="text-[10px] text-slate-400">NIS: ${escapeHtml(st.nis || '-')}</span>
                </div>
                <span class="px-2.5 py-1 rounded-xl text-xs font-black border ${pctColor}">
                    ${pct}% Hadir
                </span>
            </div>
            <div class="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-50 dark:border-[#253447]">
                <span class="text-slate-500">Total: <strong>${st.totalSesi || 0} Sesi</strong></span>
                <div class="space-x-2 text-[10px]">
                    <span class="text-emerald-600 font-bold">${st.hadir || 0} Hadir</span>
                    <span class="text-blue-600 font-bold">${st.izin || 0} Izin</span>
                    <span class="text-amber-600 font-bold">${st.sakit || 0} Sakit</span>
                    <span class="text-rose-600 font-bold">${st.alpa || 0} Alpa</span>
                </div>
            </div>
        </div>`;
    });

    if (tableBody) tableBody.innerHTML = tHtml;
    if (mobileCards) mobileCards.innerHTML = mHtml;
}

/**
 * Ekspor Data Rekap ke Excel (XLSX)
 */
function exportPresensiRekapXLSX() {
    if (!ASNPresensi.data.rekapData || !ASNPresensi.data.rekapData.rekap) {
        alert('Data rekapitulasi belum dimuat.');
        return;
    }
    const list = ASNPresensi.data.rekapData.rekap;
    if (typeof XLSX === 'undefined') {
        alert('Pustaka XLSX belum tersedia.');
        return;
    }

    const rows = list.map((st, i) => ({
        "No": i + 1,
        "Nama Santri": st.name,
        "NIS": st.nis,
        "Gender": st.gender === 'L' ? 'Putra' : 'Putri',
        "Total Sesi": st.totalSesi,
        "Hadir": st.hadir,
        "Izin": st.izin,
        "Sakit": st.sakit,
        "Alpa": st.alpa,
        "Persentase Kehadiran (%)": (st.persentase || 100) + '%'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap Presensi");
    XLSX.writeFile(wb, `Rekap_Presensi_Kegiatan_${new Date().toISOString().substring(0, 10)}.xlsx`);
}

// ====================================================================
// EXPORTS KE GLOBAL WINDOW
// ====================================================================
window.loadAdminPresensiData = loadAdminPresensiData;
window.renderPresensiDashboard = renderPresensiDashboard;
window.switchPresensiMainTab = switchPresensiMainTab;
window.openPresensiBukaSesiModal = openPresensiBukaSesiModal;
window.closePresensiBukaSesiModal = closePresensiBukaSesiModal;
window.submitPresensiBukaSesi = submitPresensiBukaSesi;
window.handleStartPresensiSession = submitPresensiBukaSesi;
window.resumePresensiSesi = resumePresensiSesi;
window.deletePresensiSesiAction = deletePresensiSesiAction;
window.deletePresensiSesi = deletePresensiSesiAction;
window.setLiveFilterGender = setLiveFilterGender;
window.onSearchLiveStudent = onSearchLiveStudent;
window.setAllStudentsAttendance = setAllStudentsAttendance;
window.setStudentAttendance = setStudentAttendance;
window.updateStudentAttendanceNote = updateStudentAttendanceNote;
window.saveLivePresensiProgress = saveLivePresensiProgress;
window.setLiveInputMode = setLiveInputMode;
window.startPresensiQRScanner = startPresensiQRScanner;
window.stopPresensiQRScanner = stopPresensiQRScanner;
window.openPresensiKegiatanModal = openPresensiKegiatanModal;
window.closePresensiKegiatanModal = closePresensiKegiatanModal;
window.submitPresensiKegiatan = submitPresensiKegiatan;
window.handleSavePresensiKegiatan = submitPresensiKegiatan;
window.deletePresensiKegiatanAction = deletePresensiKegiatanAction;
window.deletePresensiKegiatan = deletePresensiKegiatanAction;
window.loadPresensiRekapData = loadPresensiRekapData;
window.exportPresensiRekapXLSX = exportPresensiRekapXLSX;
window.callApi = callApi;

