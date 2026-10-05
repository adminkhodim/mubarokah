/**
 * ====================================================================
 * MODUL FRONTEND: SOROGAN AL-QUR'AN (BINNAZHAR)
 * Standar Mushaf Pojok (30 Juz, 1 Juz = 20 Halaman, Tanpa Ayat)
 * PPTQ Roudlotul Mubarokah
 * ====================================================================
 * Fitur:
 * 1. Simakan Tatap Muka Al-Qur'an Binnazhar (Juz 1 - 30)
 * 2. Pemilih Halaman Interaktif Mushaf Pojok (Halaman 1 - 20)
 * 3. Status Simakan: Lanjut (Naik Hal/Juz), Ulang (I'adah), Khatam 30 Juz
 * 4. Manajemen Halaqah Sorogan & Plotting Santri (4 Tab: Halaqah, Plotting, Matriks, Sesi)
 * 5. Target Capaian Individual & Massal (Mushaf Pojok)
 * 6. Integrasi SWR Caching & Sinkronisasi Google Spreadsheet
 */

const SOROGAN_STORAGE_KEYS = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.storage && APP_CONFIG.storage.keys)
    ? APP_CONFIG.storage.keys
    : {
        adminToken: 'mubarokah_admin_token',
        parentToken: 'mubarokah_parent_token',
        pengasuhToken: 'mubarokah_pengasuh_token'
    };

const ASNSorogan = {
    data: {
        summary: {
            totalSantri: 0,
            rataRataJuz: "1.0",
            khatam30Juz: 0,
            totalLanjut: 0,
            totalUlang: 0,
            persentaseLanjut: 100
        },
        students: [],
        halaqahs: [],
        muallimList: [],
        programCategories: [],
        sesiList: [],
        targets: {}
    },
    filteredStudents: [],
    selectedStudentIds: new Set(),
    activeStudentDetail: null,
    detailActiveTab: 1,
    viewerRole: 'admin',
    halaqahActiveTab: 1,
    activePlottingHalaqah: null,
    activePlottingStudentIds: [],
    bulkTargetState: {
        scope: 'ALL',
        halaqahId: '',
        juz: 1,
        studentIds: []
    },
    cache: null,
    simakState: {
        studentId: "",
        studentName: "",
        nis: "",
        juz: 1,
        selectedPages: [1],
        statusSetoran: "LANJUT",
        nilai: "MUMTAZ",
        muallim: "",
        catatan: "",
        sesi: "Pagi (Ba'da Subuh)"
    }
};

const SOROGAN_CACHE_KEY = 'mubarokah_sorogan_dashboard_cache';
const SOROGAN_CACHE_TTL_MS = 5 * 60 * 1000; // 5 Menit

// Referensi Surah & Juz Mushaf Pojok 30 Juz
const SOROGAN_JUZ_SURAH_REF = {
    1: "Al-Fatihah - Al-Baqarah 141",
    2: "Al-Baqarah 142 - 252",
    3: "Al-Baqarah 253 - Ali 'Imran 92",
    4: "Ali 'Imran 93 - An-Nisa' 23",
    5: "An-Nisa' 24 - 147",
    6: "An-Nisa' 148 - Al-Ma'idah 81",
    7: "Al-Ma'idah 82 - Al-An'am 110",
    8: "Al-An'am 111 - Al-A'raf 87",
    9: "Al-A'raf 88 - Al-Anfal 40",
    10: "Al-Anfal 41 - At-Taubah 92",
    11: "At-Taubah 93 - Hud 5",
    12: "Hud 6 - Yusuf 52",
    13: "Yusuf 53 - Ibrahim 52",
    14: "Al-Hijr 1 - An-Nahl 128",
    15: "Al-Isra' 1 - Al-Kahf 74",
    16: "Al-Kahf 75 - Ta Ha 135",
    17: "Al-Anbiya' 1 - Al-Hajj 78",
    18: "Al-Mu'minun 1 - Al-Furqan 20",
    19: "Al-Furqan 21 - An-Naml 55",
    20: "An-Naml 56 - Al-'Ankabut 45",
    21: "Al-'Ankabut 46 - Al-Ahzab 30",
    22: "Al-Ahzab 31 - Ya Sin 27",
    23: "Ya Sin 28 - Az-Zumar 31",
    24: "Az-Zumar 32 - Fussilat 46",
    25: "Fussilat 47 - Al-Jatsiyah 37",
    26: "Al-Ahqaf 1 - Az-Zariyat 30",
    27: "Az-Zariyat 31 - Al-Hadid 29",
    28: "Al-Mujadilah 1 - At-Tahrim 12",
    29: "Al-Mulk 1 - Al-Mursalat 50",
    30: "An-Naba' 1 - An-Nas 6 (Juz 'Amma)"
};

/**
 * Muat data lengkap dashboard Sorogan Al-Qur'an (SWR)
 */
async function loadAdminSoroganData(forceRefresh = false) {
    const loader = document.getElementById('admin-sorogan-loader');
    const emptyState = document.getElementById('admin-sorogan-empty');
    const refreshIcon = document.getElementById('btn-refresh-sorogan-icon');

    if (forceRefresh) {
        if (refreshIcon) refreshIcon.classList.add('fa-spin');
        try {
            sessionStorage.removeItem(SOROGAN_CACHE_KEY);
            localStorage.removeItem(SOROGAN_CACHE_KEY);
        } catch (e) {}
        ASNSorogan.cache = null;
    }

    // 1. Cek cache lokal (Memory, localStorage, atau sessionStorage)
    // Strategi SWR: Jika ada data, LANGSUNG RENDER INSTAN (< 50ms) tanpa menunggu server!
    let hasRenderedFromCache = false;
    if (!forceRefresh) {
        let cached = ASNSorogan.cache;
        if (!cached) {
            try {
                const stored = localStorage.getItem(SOROGAN_CACHE_KEY) || sessionStorage.getItem(SOROGAN_CACHE_KEY);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (parsed && (parsed.data || parsed.students)) {
                        cached = parsed.data || parsed;
                        ASNSorogan.cache = cached;
                    }
                }
            } catch (e) {}
        }

        if (cached && (cached.success || cached.status === "success") && Array.isArray(cached.students)) {
            ASNSorogan.data = cached;
            renderSoroganSummaryCards();
            populateSoroganFilters();
            populateSoroganProgramDropdown();
            populateSoroganMuallimDropdown();
            filterSoroganList();
            hasRenderedFromCache = true;
            if (emptyState && ASNSorogan.filteredStudents.length > 0) {
                emptyState.classList.add('hidden');
            }
            if (loader) loader.classList.add('hidden');
        }
    }

    // Hanya tampilkan full loader jika SAMA SEKALI belum ada data di cache lokal
    if (!hasRenderedFromCache) {
        if (loader) loader.classList.remove('hidden');
        if (emptyState) emptyState.classList.add('hidden');
    }

    // Hindari pemanggilan server duplikat jika request sedang berjalan
    if (ASNSorogan._fetchPromise) {
        return ASNSorogan._fetchPromise;
    }

    ASNSorogan._fetchPromise = (async () => {
        try {
            const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : (sessionStorage.getItem(SOROGAN_STORAGE_KEYS.adminToken) || localStorage.getItem(SOROGAN_STORAGE_KEYS.adminToken))) || "";
            let response;
            try {
                response = await apiPost("getSoroganDashboard", { token });
            } catch (apiErr) {
                response = await apiPost("getSoroganDashboard", {});
            }

            if (response && (response.success || response.status === "success")) {
                ASNSorogan.data = response;
                ASNSorogan.cache = response;
                try {
                    const cachePayload = JSON.stringify({ data: response, timestamp: Date.now() });
                    localStorage.setItem(SOROGAN_CACHE_KEY, cachePayload);
                    sessionStorage.setItem(SOROGAN_CACHE_KEY, cachePayload);
                } catch (e) {}

                renderSoroganSummaryCards();
                populateSoroganFilters();
                populateSoroganProgramDropdown();
                populateSoroganMuallimDropdown();
                filterSoroganList();

                if (forceRefresh && typeof showToast === 'function') {
                    showToast("✅ Data Sorogan berhasil diperbarui.");
                }
            } else if (response && (response.message || response.error)) {
                console.warn("Respon Sorogan gagal:", response.message || response.error);
            }
        } catch (err) {
            console.error("Gagal sinkronisasi data Sorogan:", err);
        } finally {
            ASNSorogan._fetchPromise = null;
            if (loader) loader.classList.add('hidden');
            if (refreshIcon) refreshIcon.classList.remove('fa-spin');
        }
    })();

    return ASNSorogan._fetchPromise;
}

/**
 * Cek apakah seorang santri telah dimasukkan ke dalam plotting kelompok halaqah Sorogan
 */
function isStudentInSoroganHalaqah(st) {
    if (!st) return false;
    const halaqahs = (ASNSorogan.data && ASNSorogan.data.halaqahs) || [];
    const sId = String(st.studentId || "").trim();
    const sNis = String(st.nis || "").trim();

    // 1. Cek jika ID atau NIS santri ada di dalam list studentIds salah satu halaqah
    const inHalaqahList = halaqahs.some(h => {
        const sids = Array.isArray(h.studentIds) ? h.studentIds.map(x => String(x).trim()) : [];
        return (sId && sids.includes(sId)) || (sNis && sids.includes(sNis));
    });
    if (inHalaqahList) return true;

    // 2. Cek jika properti halaqahId atau namaHalaqah terisi valid
    const hId = String(st.halaqahId || "").trim();
    const hName = String(st.namaHalaqah || "").trim();
    if (hId && hName && hName !== "Belum Ditentukan" && hName !== "Belum Ada Halaqah") {
        return true;
    }

    return false;
}
window.isStudentInSoroganHalaqah = isStudentInSoroganHalaqah;

/**
 * Render kartu ringkasan Sorogan (Dihitung berdasarkan santri binaan yang telah dimasukkan ke halaqah)
 */
function renderSoroganSummaryCards() {
    const all = ASNSorogan.data.students || [];
    const plotted = all.filter(isStudentInSoroganHalaqah);
    const activeCohort = plotted.length > 0 ? plotted : all;

    let totalJuzSum = 0;
    let khatam30 = 0;
    let totalLanjut = 0;
    let totalUlang = 0;

    activeCohort.forEach(st => {
        const j = Math.max(1, Math.min(30, Number(st.juzAktif) || 1));
        totalJuzSum += j;
        if (j === 30 && Number(st.halamanTerakhir) >= 20) khatam30++;
        if (st.statusTerakhir === 'ULANG') totalUlang++;
        else totalLanjut++;
    });

    const totalSantri = activeCohort.length;
    const avgJuz = totalSantri > 0 ? (totalJuzSum / totalSantri).toFixed(1) : "1.0";
    const pctLanjut = totalSantri > 0 ? Math.round((totalLanjut / totalSantri) * 100) : 100;
    const pctUlang = Math.max(0, 100 - pctLanjut);

    const elTotal = document.getElementById('sorogan-stat-total-santri');
    const elAvgJuz = document.getElementById('sorogan-stat-avg-juz');
    const elKhatam = document.getElementById('sorogan-stat-khatam');
    const elPersen = document.getElementById('sorogan-stat-persen-lanjut');
    const elTextLanjut = document.getElementById('sorogan-stat-text-lanjut');
    const elTextUlang = document.getElementById('sorogan-stat-text-ulang');
    const elBarLanjut = document.getElementById('sorogan-stat-bar-lanjut');

    if (elTotal) elTotal.innerText = totalSantri;
    if (elAvgJuz) elAvgJuz.innerText = `Juz ${avgJuz}`;
    if (elKhatam) elKhatam.innerText = `${khatam30} Santri`;
    if (elPersen) elPersen.innerText = `${pctLanjut}%`;

    if (elTextLanjut) {
        elTextLanjut.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-sky-600 shrink-0"></span> Lancar (${pctLanjut}%)`;
    }
    if (elTextUlang) {
        elTextUlang.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span> Mengulang (${pctUlang}%)`;
    }
    if (elBarLanjut) {
        elBarLanjut.style.width = `${pctLanjut}%`;
    }
}

/**
 * Dapatkan kelompok halaqah Sorogan milik Asatidz/Mu'allim yang sedang aktif login
 */
function getHalaqahForActiveMuallim() {
    let user = (typeof ASNIdentity !== 'undefined' && ASNIdentity.currentUser) || null;
    if (!user) {
        try {
            const raw = sessionStorage.getItem('mubarokah_admin_data') || localStorage.getItem('mubarokah_admin_data');
            if (raw) user = JSON.parse(raw);
        } catch (e) {}
    }
    if (!user) return null;

    const halaqahs = ASNSorogan.data?.halaqahs || [];
    if (!Array.isArray(halaqahs) || halaqahs.length === 0) return null;

    const uName = String(user.name || '').trim().toLowerCase();
    const uEmail = String(user.email || '').trim().toLowerCase();
    const uNip = String(user.nip || '').trim().toLowerCase();
    const cleanUName = uName.replace(/^(ustadz|ustadzah|ust\.|ustd\.|kyai|nyai|gus|ning)\s+/i, '').trim();

    // 1. Prioritas 1: Kecocokan persis pada muallim/pembina, email, atau NIP
    for (const h of halaqahs) {
        const m = String(h.muallim || h.muallimPengampu || '').trim().toLowerCase();
        const cleanM = m.replace(/^(ustadz|ustadzah|ust\.|ustd\.|kyai|nyai|gus|ning)\s+/i, '').trim();
        const hemail = String(h.email || h.muallimEmail || '').trim().toLowerCase();
        const hNip = String(h.nip || h.muallimNip || '').trim().toLowerCase();

        if (uNip && hNip && uNip === hNip) return h;
        if (uEmail && hemail && uEmail === hemail) return h;
        if (cleanUName && cleanM && cleanUName === cleanM) return h;
        if (uName && m && uName === m) return h;
    }

    // 2. Prioritas 2: Substring match pada nama Muallim atau Nama Halaqah
    if (cleanUName && cleanUName.length >= 3) {
        for (const h of halaqahs) {
            const m = String(h.muallim || h.muallimPengampu || '').trim().toLowerCase();
            const hName = String(h.namaHalaqah || '').trim().toLowerCase();
            const cleanM = m.replace(/^(ustadz|ustadzah|ust\.|ustd\.|kyai|nyai|gus|ning)\s+/i, '').trim();

            if (cleanM && (cleanM.includes(cleanUName) || cleanUName.includes(cleanM))) return h;
            if (hName.includes(cleanUName)) return h;
        }
    }

    // 3. Fallback: jika peran ASATIDZ dan ada daftar halaqah, gunakan halaqah pertama
    const activeRole = String((typeof ASNIdentity !== 'undefined' && ASNIdentity.currentRole) || 
                              sessionStorage.getItem('ASN_ADMIN_ROLE') || 
                              sessionStorage.getItem('mubarokah_admin_role') || '').toUpperCase();
    if (activeRole === 'ASATIDZ') {
        return halaqahs[0] || null;
    }

    return null;
}

/**
 * Kontrol Visibilitas Tombol Sorogan Berdasarkan Peran Pengguna (RBAC)
 * Menyembunyikan tombol ekspor (Excel, Cetak, Inisialisasi Sheet) & manajerial (Kelola Halaqah, Jadwal & Sesi, Target Massal) untuk Akun Asatidz / Pengasuh
 */
function applySoroganRolePermissions() {
    const activeRole = String((typeof ASNIdentity !== 'undefined' && ASNIdentity.currentRole) || 
                              sessionStorage.getItem('ASN_ADMIN_ROLE') || 
                              sessionStorage.getItem('mubarokah_admin_role') || 'SUPER_ADMIN').toUpperCase();
    const isPengasuh = activeRole === 'PENGASUH' || (typeof ASNSorogan !== 'undefined' && ASNSorogan.viewerRole === 'pengasuh');
    const isAsatidz = activeRole === 'ASATIDZ';
    const hideAdminActions = isPengasuh || isAsatidz;

    document.querySelectorAll('.sorogan-admin-action').forEach(el => {
        if (hideAdminActions) {
            el.classList.add('hidden');
            el.style.display = 'none';
        } else {
            el.classList.remove('hidden');
            el.style.display = '';
        }
    });
}

/**
 * Isi filter halaqah & juz
 */
function populateSoroganFilters() {
    const filterHalaqah = document.getElementById('sorogan-filter-halaqah');
    if (filterHalaqah && Array.isArray(ASNSorogan.data.halaqahs)) {
        const currentVal = filterHalaqah.value;
        let opt = '<option value="ALL">Semua Halaqah</option>';
        ASNSorogan.data.halaqahs.forEach(h => {
            if (h && h.namaHalaqah) {
                opt += `<option value="${escapeHtml(h.halaqahId)}">${escapeHtml(h.namaHalaqah)}</option>`;
            }
        });
        opt += '<option value="UNASSIGNED">Belum Masuk Halaqah</option>';
        filterHalaqah.innerHTML = opt;

        const activeRole = String((typeof ASNIdentity !== 'undefined' && ASNIdentity.currentRole) || 
                                  sessionStorage.getItem('ASN_ADMIN_ROLE') || 
                                  sessionStorage.getItem('mubarokah_admin_role') || '').toUpperCase();
        if (activeRole === 'ASATIDZ') {
            const myHalaqah = getHalaqahForActiveMuallim();
            if (myHalaqah && myHalaqah.halaqahId) {
                filterHalaqah.value = myHalaqah.halaqahId;
            } else if (currentVal && Array.from(filterHalaqah.options).some(o => o.value === currentVal)) {
                filterHalaqah.value = currentVal;
            }
        } else if (currentVal && Array.from(filterHalaqah.options).some(o => o.value === currentVal)) {
            filterHalaqah.value = currentVal;
        }
    }

    applySoroganRolePermissions();
}

/**
 * Filter santri sorogan berdasarkan plotting kelompok halaqah
 */
function filterSoroganList() {
    const searchInput = document.getElementById('sorogan-search-input');
    const filterHalaqah = document.getElementById('sorogan-filter-halaqah');
    const filterJuz = document.getElementById('sorogan-filter-juz');
    const filterStatus = document.getElementById('sorogan-filter-status');

    const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
    const selHalaqah = filterHalaqah ? filterHalaqah.value : "ALL";
    const selJuz = filterJuz ? filterJuz.value : "ALL";
    const selStatus = filterStatus ? filterStatus.value : "ALL";

    const all = ASNSorogan.data.students || [];

    ASNSorogan.filteredStudents = all.filter(st => {
        if (query) {
            const matchName = (st.name || "").toLowerCase().includes(query);
            const matchNis = (st.nis || "").toLowerCase().includes(query);
            const matchHalaqah = (st.namaHalaqah || "").toLowerCase().includes(query);
            const matchMuallim = (st.muallimPengampu || "").toLowerCase().includes(query);
            if (!matchName && !matchNis && !matchHalaqah && !matchMuallim) return false;
        }

        // Filter berdasarkan Halaqah & Plotting (Mengadopsi pola Tahfidz)
        const inHalaqah = isStudentInSoroganHalaqah(st);
        if (selHalaqah === "ALL") {
            // Default "Semua Halaqah": Menampilkan santri yang sudah dimasukkan ke kelompok halaqah
            if (!inHalaqah) return false;
        } else if (selHalaqah === "UNASSIGNED" || selHalaqah === "UNPLOTTED") {
            // Khusus santri yang belum masuk kelompok halaqah
            if (inHalaqah) return false;
        } else if (selHalaqah === "ALL_STUDENTS") {
            // Tampilkan semua santri (fallback)
        } else {
            // Filter per halaqah tertentu
            const halaqahs = (ASNSorogan.data && ASNSorogan.data.halaqahs) || [];
            const curH = halaqahs.find(h => h.halaqahId === selHalaqah || h.namaHalaqah === selHalaqah);
            const inCurHalaqah = (st.halaqahId === selHalaqah) || 
                (st.namaHalaqah === selHalaqah) || 
                (curH && (curH.halaqahId === st.halaqahId || curH.namaHalaqah === st.namaHalaqah)) || 
                (curH && Array.isArray(curH.studentIds) && (curH.studentIds.includes(st.studentId) || curH.studentIds.includes(st.nis)));
            if (!inCurHalaqah) return false;
        }

        if (selJuz !== "ALL" && String(st.juzAktif) !== String(selJuz)) return false;
        if (selStatus !== "ALL" && st.statusTerakhir !== selStatus) return false;

        return true;
    });

    renderSoroganTable();
}

/**
 * Multi-select santri Sorogan
 */
function toggleSelectAllSoroganStudents(checked) {
    if (!ASNSorogan.selectedStudentIds) {
        ASNSorogan.selectedStudentIds = new Set();
    }
    const currentStudents = (ASNSorogan.filteredStudents && ASNSorogan.filteredStudents.length > 0)
        ? ASNSorogan.filteredStudents
        : (ASNSorogan.data.students || []);

    currentStudents.forEach(st => {
        if (st && st.studentId) {
            if (checked) {
                ASNSorogan.selectedStudentIds.add(st.studentId);
            } else {
                ASNSorogan.selectedStudentIds.delete(st.studentId);
            }
        }
    });

    document.querySelectorAll('.sorogan-row-checkbox').forEach(cb => {
        cb.checked = checked;
    });

    updateSoroganBulkSelectionBar();
}

function toggleSelectSoroganStudent(studentId, checked) {
    if (!ASNSorogan.selectedStudentIds) {
        ASNSorogan.selectedStudentIds = new Set();
    }
    if (checked) {
        ASNSorogan.selectedStudentIds.add(studentId);
    } else {
        ASNSorogan.selectedStudentIds.delete(studentId);
    }
    updateSoroganBulkSelectionBar();
}

function clearSoroganSelectedStudents() {
    if (ASNSorogan.selectedStudentIds) {
        ASNSorogan.selectedStudentIds.clear();
    }
    document.querySelectorAll('.sorogan-row-checkbox').forEach(cb => {
        cb.checked = false;
    });
    const checkAll = document.getElementById('sorogan-check-all');
    if (checkAll) {
        checkAll.checked = false;
        checkAll.indeterminate = false;
    }
    updateSoroganBulkSelectionBar();
}

function updateSoroganBulkSelectionBar() {
    const bar = document.getElementById('sorogan-bulk-selection-bar');
    const textEl = document.getElementById('sorogan-selected-count-text');
    const checkAll = document.getElementById('sorogan-check-all');
    const count = ASNSorogan.selectedStudentIds ? ASNSorogan.selectedStudentIds.size : 0;
    const totalVisible = (ASNSorogan.filteredStudents || []).length;

    if (bar) {
        if (count > 0) bar.classList.remove('hidden');
        else bar.classList.add('hidden');
    }

    if (textEl) {
        textEl.innerText = `${count} santri dipilih`;
    }

    if (checkAll) {
        if (count === 0) {
            checkAll.checked = false;
            checkAll.indeterminate = false;
        } else if (totalVisible > 0 && count >= totalVisible) {
            checkAll.checked = true;
            checkAll.indeterminate = false;
        } else {
            checkAll.indeterminate = true;
        }
    }
}

/**
 * Render tabel daftar santri sorogan
 */
function renderSoroganTable() {
    const tbody = document.getElementById('admin-sorogan-table-body');
    const mobileContainer = document.getElementById('admin-sorogan-mobile-list');
    const emptyState = document.getElementById('admin-sorogan-empty');
    const countEl = document.getElementById('admin-sorogan-count');

    const list = ASNSorogan.filteredStudents || [];

    if (countEl) {
        countEl.innerText = `${list.length} Santri`;
    }

    if (list.length === 0) {
        if (tbody) tbody.innerHTML = '';
        if (mobileContainer) mobileContainer.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    const selectedSet = ASNSorogan.selectedStudentIds || new Set();
    const targets = (ASNSorogan.data && ASNSorogan.data.targets) || {};
    const weeklySessions = getSoroganActiveWeeklySessionCounts();

    let html = '';
    list.forEach((st, idx) => {
        const surahRef = SOROGAN_JUZ_SURAH_REF[st.juzAktif] || "Al-Qur'an 30 Juz";
        const isUlang = st.statusTerakhir === 'ULANG';
        const isChecked = selectedSet.has(st.studentId);

        const statusBadge = isUlang
            ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300"><i class="fa-solid fa-rotate-left"></i> Wajib Mengulang</span>`
            : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/50 dark:text-sky-300"><i class="fa-solid fa-circle-check"></i> Lancar (Lanjut)</span>`;

        // Progress bar akumulatif 30 Juz (600 Halaman) & Deteksi Khatam 30 Juz
        const currentJuz = Number(st.juzAktif) || 1;
        const hal = Math.min(20, Math.max(1, Number(st.halamanTerakhir) || 1));
        const totalHalaman600 = ((currentJuz - 1) * 20) + hal;
        const isKhatam = (currentJuz === 30 && hal >= 20) || (Number(st.totalHalamanKhatam || 0) >= 600);
        const percent = isKhatam ? 100 : Math.min(100, Math.max(1, Math.round((totalHalaman600 / 600) * 100)));

        // Target Info Dinamis sesuai jadwal sesi aktif mingguan
        const tgt = targets[st.studentId] || st.target || {
            targetJuz: Math.min(30, currentJuz + 1),
            targetHalamanSesi: 2
        };
        const tSesi = Number(tgt.targetHalamanSesi) || 2;
        const tPekan = Number(tgt.targetHalamanPekan) || (tSesi * weeklySessions);

        html += `
            <tr class="hover:bg-slate-50/80 dark:hover:bg-[#1a2636]/60 transition border-b border-slate-100 dark:border-[#202f42] text-xs">
                <td class="p-3 text-center">
                    <input type="checkbox" class="sorogan-row-checkbox rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                        ${isChecked ? 'checked' : ''} onchange="toggleSelectSoroganStudent('${escapeHtml(st.studentId)}', this.checked)">
                </td>
                <td class="p-3 text-center text-slate-400 font-medium">${idx + 1}</td>
                <td class="p-3">
                    <div class="flex items-center space-x-2.5">
                        <div class="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 font-bold flex items-center justify-center shrink-0 border border-sky-200 dark:border-sky-800/40">
                            ${st.photoUrl ? `<img src="${escapeHtml(st.photoUrl)}" class="w-full h-full rounded-full object-cover">` : `<i class="fa-solid fa-user text-xs"></i>`}
                        </div>
                        <div>
                            <div class="font-bold text-slate-800 dark:text-slate-100 leading-snug">${escapeHtml(st.name)}</div>
                            <div class="text-[10px] text-slate-400">NIS: ${escapeHtml(st.nis || "-")} • ${st.gender === 'P' ? 'Santriwati' : 'Santri'}</div>
                        </div>
                    </div>
                </td>
                <td class="p-3">
                    <div class="space-y-1">
                        <div class="flex items-center justify-between gap-1 text-xs">
                            <span class="font-black text-slate-800 dark:text-slate-100">
                                ${isKhatam 
                                    ? `<span class="text-amber-500 font-black flex items-center gap-1"><i class="fa-solid fa-crown text-amber-500 text-xs"></i> Khatam 30 Juz</span>` 
                                    : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-black bg-sky-50 text-sky-800 border border-sky-200 dark:bg-sky-950 dark:text-sky-300"><i class="fa-solid fa-book-bookmark text-xs"></i> Juz ${currentJuz}</span> <span class="text-xs font-bold text-slate-700 dark:text-slate-200">Hlm <strong class="text-sky-600 dark:text-sky-400 font-black">${hal}</strong>/20</span>`}
                            </span>
                            <span class="text-[10px] font-extrabold ${isKhatam ? 'text-amber-600 dark:text-amber-400' : 'text-sky-600 dark:text-sky-400'}">${percent}%</span>
                        </div>
                        <div class="text-[10px] text-slate-400 truncate max-w-[200px]" title="${escapeHtml(surahRef)}">
                            ${escapeHtml(surahRef)}
                        </div>
                        <div class="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                            <div class="${isKhatam ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-sky-600'} h-full rounded-full transition-all" style="width: ${percent}%;"></div>
                        </div>
                    </div>
                </td>
                <td class="p-3">
                    <button type="button" onclick="openSoroganTargetModal('${escapeHtml(st.studentId)}')"
                        class="text-left group/tgt hover:opacity-80 transition" title="Klik untuk atur target">
                        <div class="flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200">
                            <i class="fa-solid fa-bullseye text-[10px] text-amber-500"></i>
                            <span>Target Juz ${tgt.targetJuz || Math.min(30, currentJuz + 1)}</span>
                        </div>
                        <div class="text-[10px] text-slate-400 group-hover/tgt:text-sky-600 font-medium">
                            ${tSesi} Hal/Sesi (${tPekan} Hal/Pekan)
                        </div>
                    </button>
                </td>
                <td class="p-3">
                    <div class="text-xs font-semibold text-slate-700 dark:text-slate-200">${escapeHtml(st.namaHalaqah || "Belum Ada Halaqah")}</div>
                    <div class="text-[10px] text-slate-400">Muallim: ${escapeHtml(st.muallimPengampu || "-")}</div>
                </td>
                <td class="p-3">
                    ${statusBadge}
                    ${st.updatedAt ? `<div class="text-[9px] text-slate-400 mt-1">Terakhir: ${st.updatedAt.substring(0, 10)}</div>` : ''}
                </td>
                <td class="p-3 text-right">
                    <div class="flex items-center justify-end gap-1.5">
                        <button type="button" onclick="openSoroganTargetModal('${escapeHtml(st.studentId)}')"
                            class="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-[#1c2836] dark:hover:bg-[#253447] dark:text-slate-300 rounded-xl text-xs transition" title="Atur Target">
                            <i class="fa-solid fa-bullseye text-amber-600"></i>
                        </button>
                        <button type="button" onclick="openSoroganStudentDetail('${escapeHtml(st.studentId)}')"
                            class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#1c2836] dark:hover:bg-[#253447] text-slate-600 dark:text-slate-300 flex items-center justify-center transition active:scale-95" title="Detail Riwayat & Mutaba'ah">
                            <i class="fa-solid fa-clock-rotate-left text-xs"></i>
                        </button>
                        <button type="button" onclick="openSimakSoroganModal('${escapeHtml(st.studentId)}')"
                            class="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs shadow-sm transition active:scale-95 inline-flex items-center gap-1.5">
                            <i class="fa-solid fa-pen-to-square text-xs"></i>
                            <span>Simak</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    if (tbody) tbody.innerHTML = html;

    // Mobile List Card HTML (Compact)
    if (mobileContainer) {
        mobileContainer.innerHTML = list.map(st => {
            const initials = (st.name || 'Santri').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'SN';
            const inHal = !!(st.namaHalaqah && st.namaHalaqah !== 'Belum Ada Halaqah');
            const halaqahName = inHal ? st.namaHalaqah : 'Belum Masuk Halaqah';
            const isUlang = st.statusTerakhir === 'ULANG';
            const currentJuz = Number(st.juzAktif) || 1;
            const hal = Math.min(20, Math.max(1, Number(st.halamanTerakhir) || 1));
            const totalHalaman600 = ((currentJuz - 1) * 20) + hal;
            const isKhatam = (currentJuz === 30 && hal >= 20) || (Number(st.totalHalamanKhatam || 0) >= 600);
            const percent = isKhatam ? 100 : Math.min(100, Math.max(1, Math.round((totalHalaman600 / 600) * 100)));
            const tgt = targets[st.studentId] || st.target || {
                targetJuz: Math.min(30, currentJuz + 1),
                targetHalamanSesi: 2
            };
            const targetSesi = Number(tgt.targetHalamanSesi) || 2;
            const targetPekan = Number(tgt.targetHalamanPekan) || (targetSesi * weeklySessions);
            const isSelected = selectedSet.has(st.studentId);

            return `
            <div class="p-3 bg-white dark:bg-[#15202d] rounded-2xl border ${isSelected ? 'border-amber-400 dark:border-amber-600 bg-amber-50/20' : 'border-slate-100 dark:border-[#253447]'} shadow-sm space-y-2.5">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-2.5 min-w-0">
                        <input type="checkbox" onchange="toggleSelectSoroganStudent('${escapeHtml(st.studentId)}', this.checked)" ${isSelected ? 'checked' : ''} class="sorogan-row-checkbox rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer shrink-0" title="Pilih ${escapeHtml(st.name || '')}">
                        <div class="w-9 h-9 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-extrabold flex items-center justify-center text-xs shrink-0">
                            ${st.photoUrl ? `<img src="${escapeHtml(st.photoUrl)}" class="w-full h-full object-cover rounded-full">` : initials}
                        </div>
                        <div class="min-w-0">
                            <h4 class="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">${escapeHtml(st.name)}</h4>
                            <p class="text-[10px] text-slate-400">NIS: ${escapeHtml(st.nis || '-')} • <span class="${inHal ? 'text-sky-600 font-semibold' : 'text-amber-600 dark:text-amber-400 font-semibold'}">${escapeHtml(halaqahName)}</span></p>
                        </div>
                    </div>
                    <button type="button" onclick="openSimakSoroganModal('${escapeHtml(st.studentId)}')" class="px-2.5 py-1 bg-sky-600 text-white font-bold text-xs rounded-lg shadow-sm active:scale-95 transition">
                        + Simak
                    </button>
                </div>

                <!-- Mini Target Pills -->
                <div class="flex items-center gap-1.5 text-[9px] font-bold">
                    <span onclick="openSoroganTargetModal('${escapeHtml(st.studentId)}')" class="px-2 py-0.5 rounded bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 cursor-pointer">
                        Target Sesi: ${targetSesi} Hlm
                    </span>
                    <span onclick="openSoroganTargetModal('${escapeHtml(st.studentId)}')" class="px-2 py-0.5 rounded bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 cursor-pointer">
                        Target Pekan: ${targetPekan} Hlm
                    </span>
                    <span class="px-2 py-0.5 rounded bg-slate-100 dark:bg-[#1c2836] text-slate-600 dark:text-slate-400">
                        Juz ${tgt.targetJuz || 30}
                    </span>
                </div>

                <!-- Progress Bar -->
                <div class="space-y-1">
                    <div class="flex justify-between text-xs font-bold">
                        <span>${isKhatam ? `<span class="text-amber-500 font-black flex items-center gap-1"><i class="fa-solid fa-crown text-amber-500 text-xs"></i> Khatam 30 Juz</span>` : `Capaian: Juz ${currentJuz} / 30 (Hal ${hal}/20)`}</span>
                        <span class="${isKhatam ? 'text-amber-600 dark:text-amber-400' : 'text-sky-600'}">${percent}%</span>
                    </div>
                    <div class="w-full bg-slate-100 dark:bg-[#1c2836] h-1.5 rounded-full overflow-hidden">
                        <div class="${isKhatam ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-sky-600'} h-full rounded-full transition-all" style="width: ${percent}%;"></div>
                    </div>
                </div>

                <div class="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-[#253447] text-[10px] text-slate-400">
                    <span>Terakhir: Juz ${currentJuz} Hal ${hal} • ${isUlang ? '<span class="text-rose-600 font-extrabold">Wajib Ulang</span>' : '<span class="text-sky-600 font-bold">Lancar</span>'}</span>
                    <button type="button" onclick="openSoroganStudentDetail('${escapeHtml(st.studentId)}')" class="text-sky-600 font-bold hover:underline">
                        Lihat Mutaba'ah &gt;
                    </button>
                </div>
            </div>
            `;
        }).join('');
    }

    updateSoroganBulkSelectionBar();
}

/**
 * Buka modal Simak Sorogan Al-Qur'an (Grid 20 Halaman per Juz)
 */
function openSimakSoroganModal(studentId = null) {
    let st = null;
    if (studentId) {
        st = (ASNSorogan.data.students || []).find(s => s.studentId === studentId || s.nis === studentId);
    } else if (ASNSorogan.filteredStudents && ASNSorogan.filteredStudents.length > 0) {
        st = ASNSorogan.filteredStudents[0];
    } else if (ASNSorogan.data.students && ASNSorogan.data.students.length > 0) {
        st = ASNSorogan.data.students[0];
    }

    if (!st) {
        if (typeof showToast === 'function') showToast("⚠️ Tidak ada data santri sorogan yang tersedia.");
        else alert("Tidak ada data santri sorogan yang tersedia.");
        return;
    }

    const startPage = Math.min(20, Math.max(1, st.halamanTerakhir || 1));

    ASNSorogan.simakState = {
        studentId: st.studentId,
        studentName: st.name,
        nis: st.nis || "",
        juz: st.juzAktif || 1,
        selectedPages: [startPage],
        statusSetoran: "LANJUT",
        nilai: "MUMTAZ",
        muallim: st.muallimPengampu && st.muallimPengampu !== "-" ? st.muallimPengampu : "Guru Sorogan",
        catatan: "",
        sesi: "Pagi (Ba'da Subuh)",
        halaqahId: st.halaqahId || "",
        namaHalaqah: st.namaHalaqah || ""
    };

    const elName = document.getElementById('sorogan-simak-modal-name');
    const elNis = document.getElementById('sorogan-simak-modal-nis');
    const elJuz = document.getElementById('sorogan-simak-modal-juz');
    const elMuallim = document.getElementById('sorogan-simak-modal-muallim');
    const elCatatan = document.getElementById('sorogan-simak-modal-catatan');
    const elTanggal = document.getElementById('sorogan-simak-modal-tanggal');
    const elSesi = document.getElementById('sorogan-simak-modal-sesi');

    if (elName) elName.innerText = st.name;
    if (elNis) elNis.innerText = `NIS: ${st.nis || "-"}`;
    if (elJuz) elJuz.value = ASNSorogan.simakState.juz;
    if (elMuallim) elMuallim.value = ASNSorogan.simakState.muallim;
    if (elCatatan) elCatatan.value = "";

    if (elTanggal) {
        elTanggal.value = new Date().toISOString().substring(0, 10);
    }

    if (elSesi) {
        const sesiList = ASNSorogan.data.sesiList || [];
        const activeSesi = sesiList.filter(s => (s.status || 'Aktif').includes('Aktif'));
        if (activeSesi.length > 0) {
            elSesi.innerHTML = activeSesi.map(s => {
                const jM = cleanSoroganSesiTime(s.jamMulai, '05:15');
                const jS = cleanSoroganSesiTime(s.jamSelesai, '06:30');
                return `<option value="${escapeHtml(s.namaSesi)}">${escapeHtml(s.namaSesi)} (${jM} - ${jS} WIB)</option>`;
            }).join('');
        } else {
            elSesi.innerHTML = `
                <option value="Pagi (Ba'da Subuh)">Pagi (Ba'da Subuh) 05:15 - 06:30 WIB</option>
                <option value="Sore (Ba'da Ashar)">Sore (Ba'da Ashar) 16:00 - 17:15 WIB</option>
                <option value="Malam (Ba'da Isya)">Malam (Ba'da Isya) 20:00 - 21:30 WIB</option>
            `;
        }

        // Otomatis pilih sesi sesuai jam lokal saat ini
        const hour = new Date().getHours();
        if (hour < 11) {
            const p = activeSesi.find(s => s.namaSesi.toLowerCase().includes('pagi') || s.namaSesi.toLowerCase().includes('subuh'));
            if (p) elSesi.value = p.namaSesi;
        } else if (hour < 18) {
            const s = activeSesi.find(s => s.namaSesi.toLowerCase().includes('sore') || s.namaSesi.toLowerCase().includes('ashar'));
            if (s) elSesi.value = s.namaSesi;
        } else {
            const m = activeSesi.find(s => s.namaSesi.toLowerCase().includes('malam') || s.namaSesi.toLowerCase().includes('isya'));
            if (m) elSesi.value = m.namaSesi;
        }
    }

    onSoroganJuzChanged();

    // Set Nilai Default & Listener otomatisasi status (persis seperti modul Tahfidz)
    const elNilai = document.getElementById('sorogan-simak-modal-nilai');
    if (elNilai) {
        elNilai.value = "MUMTAZ";
        ASNSorogan.simakState.nilai = "MUMTAZ";
        elNilai.onchange = function() {
            ASNSorogan.simakState.nilai = this.value;
            if (this.value === 'DHAIF') {
                selectSoroganQuickStatus('ULANG');
            } else {
                selectSoroganQuickStatus('LANJUT');
            }
        };
    }

    // Set Keputusan Default: LANJUT
    selectSoroganQuickStatus("LANJUT");

    const modal = document.getElementById('modal-simak-sorogan');
    if (modal) modal.classList.remove('hidden');
}

function closeSimakSoroganModal() {
    const modal = document.getElementById('modal-simak-sorogan');
    if (modal) modal.classList.add('hidden');
}

/**
 * Update info surah saat Juz diubah pada modal
 */
function onSoroganJuzChanged() {
    const elJuz = document.getElementById('sorogan-simak-modal-juz');
    const juz = elJuz ? Number(elJuz.value) : ASNSorogan.simakState.juz;
    ASNSorogan.simakState.juz = juz;

    const infoSurah = document.getElementById('sorogan-simak-juz-info');
    if (infoSurah) {
        infoSurah.innerText = SOROGAN_JUZ_SURAH_REF[juz] || `Juz ${juz}`;
    }

    renderSoroganPageSelector();
}

/**
 * Render Grid Interaktif 20 Halaman Mushaf Pojok
 */
function renderSoroganPageSelector() {
    const container = document.getElementById('sorogan-page-chips-container');
    if (!container) return;

    const selected = ASNSorogan.simakState.selectedPages || [1];

    let html = '';
    for (let p = 1; p <= 20; p++) {
        const isSelected = selected.includes(p);
        const cls = isSelected
            ? 'bg-sky-600 text-white font-black shadow-sm ring-2 ring-sky-400'
            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-[#1c2836] dark:hover:bg-[#253447] dark:text-slate-300 font-semibold';

        html += `
            <button type="button" onclick="toggleSoroganPage(${p})"
                class="w-8 h-8 rounded-xl text-xs transition active:scale-95 flex items-center justify-center ${cls}">
                ${p}
            </button>
        `;
    }
    container.innerHTML = html;

    const countText = document.getElementById('sorogan-selected-pages-count');
    if (countText) {
        countText.innerText = `${selected.length} Halaman Terpilih (Hal: ${selected.sort((a,b)=>a-b).join(', ')})`;
    }
}

/**
 * Toggle halaman pada grid 20 halaman
 */
function toggleSoroganPage(page) {
    let sel = ASNSorogan.simakState.selectedPages || [];
    if (sel.includes(page)) {
        if (sel.length > 1) {
            sel = sel.filter(p => p !== page);
        }
    } else {
        sel.push(page);
    }
    ASNSorogan.simakState.selectedPages = sel;
    renderSoroganPageSelector();
}

/**
 * Pilihan cepat rentang halaman (1 Hal, 2 Hal / 1 Lembar, 10 Hal)
 */
function selectSoroganQuickRange(count) {
    const start = (ASNSorogan.simakState.selectedPages && ASNSorogan.simakState.selectedPages.length > 0)
        ? ASNSorogan.simakState.selectedPages[0]
        : 1;

    const newPages = [];
    for (let i = 0; i < count; i++) {
        const p = start + i;
        if (p <= 20) newPages.push(p);
    }
    ASNSorogan.simakState.selectedPages = newPages.length > 0 ? newPages : [start];
    renderSoroganPageSelector();
}

/**
 * Status simakan sorogan (Keputusan Hasil Setoran: Lulus & Lanjut vs Wajib Ulang I'adah)
 */
function selectSoroganQuickStatus(status) {
    ASNSorogan.simakState.statusSetoran = status;

    const radioLanjut = document.getElementById('sorogan-radio-status-lanjut');
    const radioUlang = document.getElementById('sorogan-radio-status-ulang');
    const labelLanjut = document.getElementById('sorogan-label-status-lanjut');
    const labelUlang = document.getElementById('sorogan-label-status-ulang');
    const badgePreview = document.getElementById('sorogan-status-badge-preview');
    const hint = document.getElementById('sorogan-status-hint');

    if (status === 'ULANG') {
        if (radioUlang) radioUlang.checked = true;
        if (radioLanjut) radioLanjut.checked = false;
        if (labelUlang) {
            labelUlang.className = "flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 border-rose-500 bg-rose-50/90 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 cursor-pointer font-bold text-xs transition";
        }
        if (labelLanjut) {
            labelLanjut.className = "flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 border-slate-200 dark:border-[#283a4e] bg-white dark:bg-[#15202d] text-slate-600 dark:text-slate-400 cursor-pointer font-bold text-xs transition hover:border-sky-300";
        }
        if (badgePreview) {
            badgePreview.innerText = "Wajib Ulang (I'adah)";
            badgePreview.className = "text-[9px] font-black px-2 py-0.5 rounded-md uppercase bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300";
        }
        if (hint) {
            hint.innerHTML = `<span class="text-rose-600 dark:text-rose-400 font-semibold"><i class="fa-solid fa-triangle-exclamation mr-1"></i> Santri dinilai belum lancar. Posisi capaian sorogan belum bertambah, santri wajib mengulang halaman ini pada sesi berikutnya.</span>`;
        }
    } else {
        if (radioLanjut) radioLanjut.checked = true;
        if (radioUlang) radioUlang.checked = false;
        if (labelLanjut) {
            labelLanjut.className = "flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 border-sky-500 bg-sky-50/90 dark:bg-sky-950/50 text-sky-800 dark:text-sky-200 cursor-pointer font-bold text-xs transition";
        }
        if (labelUlang) {
            labelUlang.className = "flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 border-slate-200 dark:border-[#283a4e] bg-white dark:bg-[#15202d] text-slate-600 dark:text-slate-400 cursor-pointer font-bold text-xs transition hover:border-rose-300";
        }
        if (badgePreview) {
            badgePreview.innerText = "Lulus & Lanjut";
            badgePreview.className = "text-[9px] font-black px-2 py-0.5 rounded-md uppercase bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300";
        }
        if (hint) {
            hint.innerText = "Santri dinyatakan tuntas dan berhak melanjutkan ke halaman berikutnya.";
        }
    }
}

/**
 * Pilihan cepat nilai (Sinkron dengan dropdown Kualitas Nilai)
 */
function selectSoroganQuickNilai(nilai) {
    ASNSorogan.simakState.nilai = nilai;
    const elNilai = document.getElementById('sorogan-simak-modal-nilai');
    if (elNilai) {
        elNilai.value = nilai;
        if (nilai === 'DHAIF') {
            selectSoroganQuickStatus('ULANG');
        } else {
            selectSoroganQuickStatus('LANJUT');
        }
    }
}

/**
 * Simpan hasil simakan sorogan ke backend
 */
async function submitSimakSorogan(e) {
    if (e && e.preventDefault) e.preventDefault();

    const btn = document.getElementById('btn-submit-simak-sorogan');
    const elJuz = document.getElementById('sorogan-simak-modal-juz');
    const elMuallim = document.getElementById('sorogan-simak-modal-muallim');
    const elCatatan = document.getElementById('sorogan-simak-modal-catatan');
    const elTanggal = document.getElementById('sorogan-simak-modal-tanggal');
    const elSesi = document.getElementById('sorogan-simak-modal-sesi');
    const elNilai = document.getElementById('sorogan-simak-modal-nilai');

    const selectedPages = ASNSorogan.simakState.selectedPages || [1];
    const tanggalVal = (elTanggal && elTanggal.value) ? elTanggal.value : new Date().toISOString().substring(0, 10);
    const sesiVal = (elSesi && elSesi.value) ? elSesi.value : "Pagi (Ba'da Subuh)";
    const nilaiVal = (elNilai && elNilai.value) ? elNilai.value : (ASNSorogan.simakState.nilai || "MUMTAZ");

    const payload = {
        studentId: ASNSorogan.simakState.studentId,
        studentName: ASNSorogan.simakState.studentName,
        nis: ASNSorogan.simakState.nis,
        halaqahId: ASNSorogan.simakState.halaqahId || "",
        namaHalaqah: ASNSorogan.simakState.namaHalaqah || "",
        juz: elJuz ? Number(elJuz.value) : ASNSorogan.simakState.juz,
        halamanList: selectedPages,
        totalHalaman: selectedPages.length,
        statusSetoran: ASNSorogan.simakState.statusSetoran || "LANJUT",
        nilai: nilaiVal,
        muallim: elMuallim ? elMuallim.value.trim() : ASNSorogan.simakState.muallim,
        catatan: elCatatan ? elCatatan.value.trim() : "",
        tanggal: tanggalVal,
        sesi: sesiVal
    };

    if (typeof setButtonLoading === 'function') {
        setButtonLoading(btn, true, "Menyimpan...");
    } else if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Menyimpan...`;
    }

    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(SOROGAN_STORAGE_KEYS.adminToken)) || "";
        const res = await apiPost("saveSoroganLog", { ...payload, token });

        if (res && (res.success || res.status === "success")) {
            closeSimakSoroganModal();
            if (typeof showToast === 'function') {
                showToast(res.message || "Simakan Sorogan berhasil dicatat!");
            }

            const targetSt = (ASNSorogan.data.students || []).find(s => s.studentId === payload.studentId);
            if (targetSt) {
                targetSt.juzAktif = res.nextJuz || payload.juz;
                targetSt.halamanTerakhir = res.nextHalaman || Math.max(...selectedPages);
                targetSt.statusTerakhir = payload.statusSetoran;
                targetSt.updatedAt = new Date().toISOString();
                filterSoroganList();
            }

            loadAdminSoroganData(true);
        } else {
            const msg = (res && res.message) || "Kesalahan server saat mencatat sorogan.";
            if (typeof showToast === 'function') showToast("❌ " + msg);
            else alert(msg);
        }
    } catch (err) {
        if (typeof showToast === 'function') showToast("❌ Terjadi kesalahan jaringan saat menyimpan sorogan.");
        else alert("Terjadi kesalahan jaringan saat menyimpan sorogan.");
    } finally {
        if (typeof setButtonLoading === 'function') {
            setButtonLoading(btn, false, "", `<i class="fa-solid fa-circle-check mr-1.5"></i> Selesai & Simpan`);
        } else if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-circle-check mr-1.5"></i> Selesai & Simpan`;
        }
    }
}

/**
 * Inisialisasi Database Sheet Sorogan jika belum ada
 */
async function initSoroganDatabaseSheets() {
    const ok = confirm("Inisialisasi Database Sorogan Al-Qur'an di Google Spreadsheet?\n\nSistem akan membuat tab sheet baru secara otomatis:\n1. Sorogan_Logs\n2. Sorogan_Capaian\n3. Sorogan_Halaqah\n4. Sorogan_Target\n5. Sorogan_Sesi\n\nLanjutkan?");
    if (!ok) return;

    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(SOROGAN_STORAGE_KEYS.adminToken)) || "";
        const res = await apiPost("initSoroganSheets", { token });
        if (res && res.success) {
            alert(res.message);
            loadAdminSoroganData(true);
        } else {
            alert("Gagal inisialisasi: " + (res.message || "Error"));
        }
    } catch (e) {
        alert("Kesalahan jaringan saat inisialisasi sheet Sorogan.");
    }
}

// ====================================================================
// FITUR MANAJEMEN HALAQAH & PLOTTING SOROGAN (4 TAB LENGKAP)
// ====================================================================

/**
 * Buka modal kelola halaqah Sorogan & plotting
 * @param {number} defaultTab 1 = Halaqah, 2 = Plotting, 3 = Matriks, 4 = Jadwal Sesi
 */
function openSoroganHalaqahModal(defaultTab = 1) {
    const modal = document.getElementById('modal-sorogan-halaqah');
    if (!modal) return;

    populateSoroganProgramDropdown();
    populateSoroganMuallimDropdown();
    modal.classList.remove('hidden');
    switchSoroganHalaqahTab(defaultTab || 1);
}

function closeSoroganHalaqahModal() {
    const modal = document.getElementById('modal-sorogan-halaqah');
    if (modal) modal.classList.add('hidden');
}

/**
 * Switch 4 Tab pada Modal Kelola Halaqah Sorogan
 */
function switchSoroganHalaqahTab(tabNum) {
    ASNSorogan.halaqahActiveTab = tabNum;

    for (let i = 1; i <= 4; i++) {
        const btn = document.getElementById(`tab-btn-srg-hlq-${i}`);
        const panel = document.getElementById(`panel-srg-hlq-tab-${i}`);

        if (i === tabNum) {
            if (btn) {
                btn.className = "px-4 py-2.5 text-xs font-extrabold border-b-2 border-sky-600 text-sky-700 dark:text-sky-400 flex items-center gap-1.5 whitespace-nowrap transition";
            }
            if (panel) panel.classList.remove('hidden');
        } else {
            if (btn) {
                btn.className = "px-4 py-2.5 text-xs font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1.5 whitespace-nowrap transition";
            }
            if (panel) panel.classList.add('hidden');
        }
    }

    if (tabNum === 1) {
        renderSoroganHalaqahCards();
    } else if (tabNum === 2) {
        populatePlottingSoroganHalaqahSelector();
    } else if (tabNum === 3) {
        renderSoroganMatriksBeban();
    } else if (tabNum === 4) {
        renderSoroganSesiCards();
    }
}

/**
 * Sinkronkan dropdown Kategori Program dari data resmi sheet "Programs" (OFFICIAL DB)
 */
function populateSoroganProgramDropdown() {
    const sel = document.getElementById('input-sorogan-halaqah-kategori');
    if (!sel) return;

    let progs = [];
    if (Array.isArray(ASNSorogan.data.programCategories) && ASNSorogan.data.programCategories.length > 0) {
        progs = ASNSorogan.data.programCategories.map(p => (typeof p === 'string' ? p : (p.name || p.nama || p.id))).filter(Boolean);
    } else if (typeof ASNAdmin !== 'undefined' && ASNAdmin.data && Array.isArray(ASNAdmin.data.programs) && ASNAdmin.data.programs.length > 0) {
        progs = ASNAdmin.data.programs.map(p => p.name || p.nama || p.id).filter(Boolean);
    }

    const currentVal = sel.value;
    if (progs.length === 0) {
        sel.innerHTML = `<option value="">-- Belum ada data Programs --</option>`;
    } else {
        sel.innerHTML = `<option value="">-- Pilih Kategori Program --</option>` +
            progs.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');
    }

    if (currentVal && progs.includes(currentVal)) {
        sel.value = currentVal;
    } else if (progs.length > 0 && !currentVal) {
        sel.value = progs[0];
    }
}

/**
 * Sinkronkan dropdown Mu'allim Pengampu dari data resmi sheet "Pegawai" (OFFICIAL DB)
 */
function populateSoroganMuallimDropdown() {
    const sel = document.getElementById('input-sorogan-halaqah-muallim');
    if (!sel) return;

    let teachers = [];
    if (Array.isArray(ASNSorogan.data.muallimList) && ASNSorogan.data.muallimList.length > 0) {
        teachers = ASNSorogan.data.muallimList;
    } else if (typeof ASNAdmin !== 'undefined' && ASNAdmin.data && Array.isArray(ASNAdmin.data.employees) && ASNAdmin.data.employees.length > 0) {
        teachers = ASNAdmin.data.employees.map(e => e.nama || e.name).filter(Boolean);
    }

    const currentVal = sel.value;
    if (teachers.length === 0) {
        sel.innerHTML = `<option value="">-- Belum ada data Pegawai --</option>`;
    } else {
        sel.innerHTML = `<option value="">-- Pilih Mu'allim Pengampu --</option>` +
            teachers.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
    }

    if (currentVal && teachers.includes(currentVal)) {
        sel.value = currentVal;
    }
}

/**
 * Render Kartu Halaqah Sorogan Aktif (Tab 1)
 */
function renderSoroganHalaqahCards() {
    const container = document.getElementById('sorogan-halaqah-cards-container');
    const badgeCount = document.getElementById('sorogan-halaqah-count-badge');
    if (!container) return;

    const halaqahs = ASNSorogan.data.halaqahs || [];
    if (badgeCount) badgeCount.innerText = `${halaqahs.length} Halaqah`;

    if (halaqahs.length === 0) {
        container.innerHTML = `
        <div class="col-span-1 sm:col-span-2 text-center py-8 px-4 bg-slate-50 dark:bg-[#1c2836] rounded-2xl border border-dashed border-slate-200 dark:border-[#283a4e] space-y-2">
            <div class="w-10 h-10 mx-auto rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center text-base">
                <i class="fa-solid fa-users-rectangle"></i>
            </div>
            <p class="text-xs font-bold text-slate-700 dark:text-slate-200">Belum Ada Kelompok Halaqah Aktif</p>
            <p class="text-[10px] text-slate-400 max-w-sm mx-auto">Silakan buat kelompok halaqah sorogan baru di atas dan tunjuk Kyai / Mu'allim Pengampu untuk mulai memplot santri binaan.</p>
        </div>`;
        return;
    }

    const students = ASNSorogan.data.students || [];

    container.innerHTML = halaqahs.map((h, i) => {
        const letter = String.fromCharCode(65 + (i % 26));
        const muallimName = h.muallim || h.muallimPengampu || h.namaHalaqah || 'Kyai / Mu\'allim Pengampu';
        const targetKurikulum = h.targetKurikulum || h.jadwalSesi || 'Sorogan Binnazhar Mushaf Pojok 30 Juz';
        const safeDeleteName = escapeHtml(muallimName).replace(/'/g, "\\'");
        const enrolledCount = Array.isArray(h.studentIds) ? h.studentIds.length : (
            students.filter(s => s.halaqahId === h.halaqahId).length
        );

        return `
        <div class="p-4 bg-slate-50 dark:bg-[#1c2836] rounded-2xl border border-slate-200 dark:border-[#283a4e] space-y-3 relative group transition hover:border-sky-500/50">
            <div class="flex justify-between items-start">
                <div class="pr-2">
                    <div class="flex items-center gap-2">
                        <span class="w-6 h-6 rounded-lg bg-sky-600 text-white flex items-center justify-center text-xs font-black shrink-0 shadow-sm">
                            ${letter}
                        </span>
                        <h4 class="font-black text-sm text-slate-800 dark:text-slate-100 leading-tight">
                            ${escapeHtml(muallimName)}
                        </h4>
                    </div>
                    <span class="inline-block mt-2 px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800/40">
                        <i class="fa-solid fa-flag text-[9px] mr-1"></i>${escapeHtml(targetKurikulum)}
                    </span>
                </div>
                <div class="flex items-center space-x-1.5 shrink-0">
                    <button type="button" onclick="deleteSoroganHalaqahConfirm('${h.halaqahId}', '${safeDeleteName}')" class="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300 flex items-center justify-center text-[10px] transition" title="Hapus Halaqah">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
            <div class="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-[#283a4e] text-xs">
                <span class="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <i class="fa-solid fa-users text-sky-600 text-xs"></i>
                    <span>${enrolledCount} Santri Binaan</span>
                </span>
                <button type="button" onclick="openPlottingFromHalaqahCard('${h.halaqahId}')" class="px-3 py-1 bg-white dark:bg-[#15202d] hover:bg-sky-50 hover:text-sky-700 text-slate-700 dark:text-slate-200 font-bold rounded-lg border border-slate-200 dark:border-[#283a4e] text-[10px] transition flex items-center gap-1 shadow-sm">
                    <i class="fa-solid fa-user-plus text-[9px] text-sky-600"></i>
                    <span>+ Atur Santri</span>
                </button>
            </div>
        </div>
        `;
    }).join('');
}

/**
 * Submit Tambah Halaqah Baru
 */
async function submitNewSoroganHalaqah(e) {
    if (e && e.preventDefault) e.preventDefault();

    const inputMuallim = document.getElementById('input-sorogan-halaqah-muallim');
    const inputTarget = document.getElementById('input-sorogan-halaqah-target');
    const btn = document.getElementById('btn-submit-sorogan-halaqah');

    const muallim = inputMuallim ? inputMuallim.value.trim() : "";
    const targetDeskripsi = inputTarget ? inputTarget.value.trim() : "";

    if (!muallim) {
        if (typeof showToast === 'function') showToast("⚠️ Pilih Kyai / Mu'allim Pengampu terlebih dahulu!");
        else alert("Pilih Kyai / Mu'allim Pengampu terlebih dahulu!");
        return;
    }

    if (typeof setButtonLoading === 'function') {
        setButtonLoading(btn, true, "Menyimpan...");
    } else if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Menyimpan...`;
    }

    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(SOROGAN_STORAGE_KEYS.adminToken)) || "";
        const res = await apiPost("saveSoroganHalaqah", {
            token,
            muallim,
            muallimPengampu: muallim,
            targetKurikulum: targetDeskripsi || "Sorogan Binnazhar Mushaf Pojok 30 Juz",
            studentIds: []
        });

        if (res && (res.success || res.status === "success")) {
            if (inputTarget) inputTarget.value = '';

            const newH = {
                halaqahId: res.halaqahId || ("SRG-HLQ-" + Date.now().toString().substring(8)),
                namaHalaqah: "Halaqah " + muallim,
                muallim,
                muallimPengampu: muallim,
                targetKurikulum: targetDeskripsi || "Sorogan Binnazhar Mushaf Pojok 30 Juz",
                studentIds: []
            };
            ASNSorogan.data.halaqahs = ASNSorogan.data.halaqahs || [];
            ASNSorogan.data.halaqahs.push(newH);

            renderSoroganHalaqahCards();
            populateSoroganFilters();
            populatePlottingSoroganHalaqahSelector();
            loadAdminSoroganData(true);

            // Transisi cerdas: Otomatis alihkan ke Tab 2 (Plotting Santri) dengan halaqah baru aktif
            if (typeof openPlottingFromHalaqahCard === 'function') {
                openPlottingFromHalaqahCard(newH.halaqahId);
            }
            if (typeof showToast === 'function') {
                showToast(`✅ Halaqah ${newH.namaHalaqah} berhasil dibuat! Mengalihkan ke plotting santri...`);
            }
        } else {
            const msg = ((res && res.message) || "Kesalahan server saat menyimpan halaqah.");
            if (typeof showToast === 'function') showToast("❌ " + msg);
            else alert(msg);
        }
    } catch (err) {
        if (typeof showToast === 'function') showToast("❌ Terjadi kesalahan jaringan saat menyimpan halaqah Sorogan.");
        else alert("Terjadi kesalahan jaringan saat menyimpan halaqah Sorogan.");
    } finally {
        if (typeof setButtonLoading === 'function') {
            setButtonLoading(btn, false, "", `<i class="fa-solid fa-plus text-[10px]"></i><span>Tambah Halaqah</span>`);
        } else if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-plus text-[10px]"></i><span>Tambah Halaqah</span>`;
        }
    }
}

/**
 * Hapus Halaqah Sorogan
 */
async function deleteSoroganHalaqahConfirm(halaqahId, namaHalaqah) {
    const ok = confirm(`Hapus halaqah "${namaHalaqah}"?\nSantri di halaqah ini tidak akan dihapus, tetapi status kelompoknya akan di-reset.`);
    if (!ok) return;

    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(SOROGAN_STORAGE_KEYS.adminToken)) || "";
        const res = await apiPost("deleteSoroganHalaqah", { token, halaqahId });

        if (res && (res.success || res.status === "success")) {
            if (typeof showToast === 'function') showToast("Halaqah Sorogan berhasil dihapus!");
            ASNSorogan.data.halaqahs = (ASNSorogan.data.halaqahs || []).filter(h => h.halaqahId !== halaqahId);
            renderSoroganHalaqahCards();
            populateSoroganFilters();
            loadAdminSoroganData(true);
        } else {
            if (typeof showToast === "function") showToast("❌ Gagal menghapus: " + ((res && res.message) || "Error")); else if (typeof showToast === "function") showToast("❌ Gagal menghapus: " + ((res && res.message) || "Error")); else alert("Gagal menghapus: " + ((res && res.message) || "Error"));
        }
    } catch (e) {
        if (typeof showToast === "function") showToast("❌ Kesalahan jaringan saat menghapus halaqah."); else if (typeof showToast === "function") showToast("❌ Kesalahan jaringan saat menghapus sesi."); else alert("Kesalahan jaringan.");
    }
}

/**
 * Tombol "+ Atur Santri" di kartu halaqah
 */
function openPlottingFromHalaqahCard(halaqahId) {
    switchSoroganHalaqahTab(2);
    const sel = document.getElementById('select-plotting-sorogan-halaqah');
    if (sel && halaqahId) {
        sel.value = halaqahId;
    }
    onSelectPlottingSoroganHalaqah(halaqahId);
}

/**
 * Mengisi dropdown pilihan halaqah di Tab 2 Plotting
 */
function populatePlottingSoroganHalaqahSelector() {
    const sel = document.getElementById('select-plotting-sorogan-halaqah');
    if (!sel) return;

    const halaqahs = ASNSorogan.data.halaqahs || [];
    if (halaqahs.length === 0) {
        sel.innerHTML = `<option value="">-- Belum Ada Halaqah --</option>`;
        ASNSorogan.activePlottingHalaqah = null;
        ASNSorogan.activePlottingStudentIds = [];
        renderSoroganPlottingLists();
        return;
    }

    const currentVal = sel.value;
    sel.innerHTML = halaqahs.map((h, i) => {
        const letter = String.fromCharCode(65 + (i % 26));
        const muallim = h.muallim || h.muallimPengampu || h.namaHalaqah || `Halaqah ${letter}`;
        const target = h.targetKurikulum ? ` (${h.targetKurikulum})` : '';
        return `<option value="${escapeHtml(h.halaqahId)}">${letter}. ${escapeHtml(muallim)}${escapeHtml(target)}</option>`;
    }).join('');

    let targetId = currentVal;
    if (!targetId || !halaqahs.some(h => h.halaqahId === targetId)) {
        targetId = halaqahs[0].halaqahId;
    }
    sel.value = targetId;
    onSelectPlottingSoroganHalaqah(targetId);
}

function onSelectPlottingSoroganHalaqah(halaqahId) {
    const halaqahs = ASNSorogan.data.halaqahs || [];
    const halaqah = halaqahs.find(h => h.halaqahId === halaqahId) || halaqahs[0] || null;

    ASNSorogan.activePlottingHalaqah = halaqah;
    if (!halaqah) {
        ASNSorogan.activePlottingStudentIds = [];
        renderSoroganPlottingLists();
        return;
    }

    let currentIds = [];
    if (Array.isArray(halaqah.studentIds) && halaqah.studentIds.length > 0) {
        currentIds = [...halaqah.studentIds];
    } else if (Array.isArray(ASNSorogan.data.students)) {
        currentIds = ASNSorogan.data.students
            .filter(st => st.halaqahId === halaqah.halaqahId)
            .map(st => st.studentId || st.nis);
    }
    ASNSorogan.activePlottingStudentIds = currentIds.map(id => String(id).trim()).filter(Boolean);

    const muallimEl = document.getElementById('tab2-sorogan-plotting-muallim');
    const targetEl = document.getElementById('tab2-sorogan-plotting-target');
    if (muallimEl) muallimEl.innerText = halaqah.muallim || halaqah.muallimPengampu || 'Belum Ditunjuk';
    if (targetEl) targetEl.innerText = halaqah.targetKurikulum || halaqah.jadwalSesi || halaqah.kategori || 'Sorogan Binnazhar';

    renderSoroganPlottingLists();
}

/**
 * Render daftar santri di Tab 2 Plotting (Enrolled vs Available)
 */
function renderSoroganPlottingLists() {
    const enrolledContainer = document.getElementById('tab2-sorogan-plotting-enrolled-container');
    const availableContainer = document.getElementById('tab2-sorogan-plotting-available-container');
    const countBadge = document.getElementById('tab2-sorogan-plotting-count-badge');
    const enrolledCountBadge = document.getElementById('tab2-sorogan-plotting-enrolled-count');

    const allStudents = ASNSorogan.data.students || [];
    const currentEnrolledIds = new Set(ASNSorogan.activePlottingStudentIds.map(s => String(s).trim()));

    const enrolledStudents = allStudents.filter(st => {
        const sId = String(st.studentId || "").trim();
        const sNis = String(st.nis || "").trim();
        return currentEnrolledIds.has(sId) || currentEnrolledIds.has(sNis);
    });

    const searchInp = document.getElementById('tab2-sorogan-plotting-search');
    const filterGen = document.getElementById('tab2-sorogan-plotting-filter-gender');

    const searchQuery = (searchInp?.value || "").toLowerCase().trim();
    const genderFilter = (filterGen?.value || "ALL").toUpperCase();

    const availableStudents = allStudents.filter(st => {
        const sId = String(st.studentId || "").trim();
        const sNis = String(st.nis || "").trim();
        if (currentEnrolledIds.has(sId) || currentEnrolledIds.has(sNis)) return false;

        const matchSearch = !searchQuery ||
            (st.name && st.name.toLowerCase().includes(searchQuery)) ||
            (st.nis && st.nis.toLowerCase().includes(searchQuery));

        const matchGender = (genderFilter === 'ALL') || (String(st.gender || 'L').toUpperCase() === genderFilter);
        return matchSearch && matchGender;
    });

    if (countBadge) countBadge.innerText = `${enrolledStudents.length} Santri Terplot`;
    if (enrolledCountBadge) enrolledCountBadge.innerText = enrolledStudents.length;

    // 1. Enrolled List
    if (enrolledContainer) {
        if (enrolledStudents.length === 0) {
            enrolledContainer.innerHTML = `
                <div class="py-5 text-center text-xs text-slate-400">
                    <p>Belum ada santri yang dimasukkan ke halaqah ini.</p>
                    <p class="text-[10px] text-slate-400 mt-0.5">Pilih santri dari daftar di bawah lalu klik + Masukkan.</p>
                </div>`;
        } else {
            enrolledContainer.innerHTML = enrolledStudents.map(st => {
                const sId = st.studentId || st.nis;
                const initials = (st.name || "S").substring(0, 2).toUpperCase();
                return `
                <div class="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-[#15202d] border border-slate-200/80 dark:border-[#283a4e] text-xs">
                    <div class="flex items-center space-x-2.5 min-w-0">
                        <div class="w-7 h-7 rounded-lg ${st.gender === 'P' ? 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300' : 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'} flex items-center justify-center font-bold text-[10px] shrink-0">
                            ${initials}
                        </div>
                        <div class="min-w-0">
                            <h5 class="font-bold text-slate-800 dark:text-slate-100 truncate">${escapeHtml(st.name)}</h5>
                            <p class="text-[10px] text-slate-400">NIS: ${escapeHtml(st.nis || '-')} • Juz ${st.juzAktif || 1} (Hal ${st.halamanTerakhir || 1})</p>
                        </div>
                    </div>
                    <button type="button" onclick="removeStudentFromSoroganPlotting('${sId}')" class="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-bold text-[10px] transition shrink-0 flex items-center gap-1">
                        <i class="fa-solid fa-user-minus"></i>
                        <span>Keluarkan</span>
                    </button>
                </div>`;
            }).join('');
        }
    }

    // 2. Available List
    if (availableContainer) {
        if (availableStudents.length === 0) {
            availableContainer.innerHTML = `
                <div class="py-6 text-center text-xs text-slate-400">
                    <p>Semua santri yang cocok sudah dimasukkan ke halaqah ini.</p>
                </div>`;
        } else {
            availableContainer.innerHTML = availableStudents.map(st => {
                const sId = st.studentId || st.nis;
                const initials = (st.name || "S").substring(0, 2).toUpperCase();
                const curHalaqah = st.namaHalaqah && st.namaHalaqah !== "Belum Ada Halaqah" ? st.namaHalaqah : null;
                return `
                <div class="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-[#15202d] border border-slate-200/80 dark:border-[#283a4e] text-xs hover:border-sky-300 transition">
                    <div class="flex items-center space-x-2.5 min-w-0">
                        <div class="w-7 h-7 rounded-lg ${st.gender === 'P' ? 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300' : 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'} flex items-center justify-center font-bold text-[10px] shrink-0">
                            ${initials}
                        </div>
                        <div class="min-w-0">
                            <h5 class="font-bold text-slate-800 dark:text-slate-100 truncate">${escapeHtml(st.name)}</h5>
                            <p class="text-[10px] text-slate-400 truncate">
                                NIS: ${escapeHtml(st.nis || '-')} • Juz ${st.juzAktif || 1} (Hal ${st.halamanTerakhir || 1})
                                ${curHalaqah ? ` • <span class="text-amber-600 dark:text-amber-400 font-semibold">(Saat ini: ${escapeHtml(curHalaqah)})</span>` : ''}
                            </p>
                        </div>
                    </div>
                    <button type="button" onclick="addStudentToSoroganPlotting('${sId}')" class="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 font-bold text-[10px] transition shrink-0 flex items-center gap-1">
                        <i class="fa-solid fa-user-plus"></i>
                        <span>+ Masukkan</span>
                    </button>
                </div>`;
            }).join('');
        }
    }
}

function filterSoroganPlottingAvailableList() {
    renderSoroganPlottingLists();
}

function addStudentToSoroganPlotting(studentId) {
    const cleanId = String(studentId || "").trim();
    if (!cleanId) return;

    if (!ASNSorogan.activePlottingStudentIds.includes(cleanId)) {
        ASNSorogan.activePlottingStudentIds.push(cleanId);
        renderSoroganPlottingLists();
    }
}

function removeStudentFromSoroganPlotting(studentId) {
    const cleanId = String(studentId || "").trim();
    if (!cleanId) return;

    ASNSorogan.activePlottingStudentIds = ASNSorogan.activePlottingStudentIds.filter(id => id !== cleanId);
    renderSoroganPlottingLists();
}

async function submitSoroganPlotting() {
    if (!ASNSorogan.activePlottingHalaqah) {
        if (typeof showToast === 'function') showToast("⚠️ Pilih halaqah Sorogan terlebih dahulu.");
        else alert("Pilih halaqah Sorogan terlebih dahulu.");
        return;
    }

    const halaqahId = ASNSorogan.activePlottingHalaqah.halaqahId;
    const studentIds = ASNSorogan.activePlottingStudentIds || [];
    const btn = document.getElementById('tab2-btn-save-sorogan-plotting');

    if (typeof setButtonLoading === 'function') {
        setButtonLoading(btn, true, "Menyimpan Plotting...");
    } else if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Menyimpan...`;
    }

    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(SOROGAN_STORAGE_KEYS.adminToken)) || "";
        const res = await apiPost("saveSoroganPlotting", {
            token,
            halaqahId,
            studentIds
        });

        if (res && (res.success || res.status === "success")) {
            if (typeof showToast === 'function') {
                showToast(`✅ Berhasil mengatur ${studentIds.length} santri binaan ke ${ASNSorogan.activePlottingHalaqah.namaHalaqah}!`);
            }
            if (ASNSorogan.activePlottingHalaqah) {
                ASNSorogan.activePlottingHalaqah.studentIds = studentIds;
            }
            renderSoroganHalaqahCards();
            renderSoroganMatriksBeban();
            loadAdminSoroganData(true);
        } else {
            const msg = ((res && res.message) || "Kesalahan server saat menyimpan plotting.");
            if (typeof showToast === 'function') showToast("❌ " + msg);
            else alert(msg);
        }
    } catch (e) {
        if (typeof showToast === 'function') showToast("❌ Kesalahan jaringan saat menyimpan plotting santri.");
        else alert("Kesalahan jaringan saat menyimpan plotting santri.");
    } finally {
        if (typeof setButtonLoading === 'function') {
            setButtonLoading(btn, false, "", `<i class="fa-solid fa-floppy-disk"></i><span>Simpan Plotting Santri</span>`);
        } else if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i><span>Simpan Plotting Santri</span>`;
        }
    }
}

/**
 * TAB 3: Matriks Beban Mu'allim Sorogan
 */
function renderSoroganMatriksBeban() {
    const tbody = document.getElementById('sorogan-matriks-beban-tbody');
    if (!tbody) return;

    const halaqahs = ASNSorogan.data.halaqahs || [];
    const students = ASNSorogan.data.students || [];

    if (halaqahs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="py-8 text-center text-xs text-slate-400">Belum ada data distribusi beban Mu'allim Sorogan.</td></tr>`;
        return;
    }

    tbody.innerHTML = halaqahs.map(h => {
        const enrolled = students.filter(st => {
            if (Array.isArray(h.studentIds) && (h.studentIds.includes(st.studentId) || h.studentIds.includes(st.nis))) return true;
            return st.halaqahId === h.halaqahId;
        });

        let totalJuz = 0;
        enrolled.forEach(st => {
            totalJuz += Number(st.juzAktif || 1);
        });
        const avg = enrolled.length > 0 ? (totalJuz / enrolled.length).toFixed(1) : "1.0";
        const muallimName = h.muallim || h.muallimPengampu || h.namaHalaqah || 'Mu\'allim Sorogan';
        const targetKurikulum = h.targetKurikulum || h.jadwalSesi || 'Sorogan Binnazhar Mushaf Pojok 30 Juz';

        return `
        <tr class="hover:bg-slate-50 dark:hover:bg-[#1c2836]/60 transition">
            <td class="py-3 px-4 font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <div class="w-7 h-7 rounded-lg bg-sky-100/70 dark:bg-sky-950 text-sky-700 dark:text-sky-300 flex items-center justify-center text-xs shrink-0">
                    <i class="fa-solid fa-user-tie"></i>
                </div>
                <span class="truncate font-bold">${escapeHtml(muallimName)}</span>
            </td>
            <td class="py-3 px-4">
                <span class="px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800/40">
                    <i class="fa-solid fa-flag text-[9px] mr-1"></i>${escapeHtml(targetKurikulum)}
                </span>
            </td>
            <td class="py-3 px-4 font-bold text-slate-800 dark:text-slate-100">${enrolled.length} Santri</td>
            <td class="py-3 px-4 font-bold text-sky-600 dark:text-sky-400">Juz ${avg} / 30</td>
        </tr>
        `;
    }).join('');
}

/**
 * TAB 4: Jadwal & Sesi Bimbingan Sorogan
 */

/**
 * Membersihkan format waktu sesi (HH:mm) dari Date object atau string format Google Sheets
 * (mencegah kebocoran string Date bawaan Google Sheets: Sat Dec 30 1899 05:15:00 GMT+0707...)
 */
function cleanSoroganSesiTime(timeVal, defaultVal = "00:00") {
    if (!timeVal && timeVal !== 0) return defaultVal;
    if (typeof timeVal === 'object' && timeVal instanceof Date && !isNaN(timeVal.getTime())) {
        const hh = String(timeVal.getHours()).padStart(2, '0');
        const mm = String(timeVal.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
    }
    const str = String(timeVal).trim();
    if (/^\d{1,2}:\d{2}$/.test(str)) {
        const parts = str.split(':');
        return `${parts[0].padStart(2, '0')}:${parts[1]}`;
    }
    const match = str.match(/(?:(?:1899|1900|\d{4})[^\d]+)?(\d{1,2}):(\d{2})(?::\d{2})?/);
    if (match) {
        return `${match[1].padStart(2, '0')}:${match[2].padStart(2, '0')}`;
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    return defaultVal;
}

function resetSoroganSesiForm() {
    const idInput = document.getElementById('input-sorogan-sesi-id');
    const namaInput = document.getElementById('input-sorogan-sesi-nama');
    const tipeInput = document.getElementById('input-sorogan-sesi-tipe');
    const statusInput = document.getElementById('input-sorogan-sesi-status');
    const jamMulaiInput = document.getElementById('input-sorogan-sesi-jam-mulai');
    const jamSelesaiInput = document.getElementById('input-sorogan-sesi-jam-selesai');
    const btnText = document.getElementById('btn-submit-sorogan-sesi-text');
    const btnCancel = document.getElementById('btn-cancel-sorogan-sesi');

    if (idInput) idInput.value = '';
    if (namaInput) namaInput.value = '';
    if (tipeInput) tipeInput.value = 'Sorogan Binnazhar Reguler';
    if (statusInput) statusInput.value = 'Aktif Digunakan';
    if (jamMulaiInput) jamMulaiInput.value = '05:15';
    if (jamSelesaiInput) jamSelesaiInput.value = '06:30';
    if (btnText) btnText.innerText = "Simpan Sesi";
    if (btnCancel) btnCancel.classList.add('hidden');

    document.querySelectorAll('input[name="sorogan-sesi-hari"]').forEach(chk => {
        chk.checked = ['Sen', 'Sel', 'Rab', 'Kam', 'Sab', 'Min'].includes(chk.value);
    });
}

function renderSoroganSesiCards() {
    const container = document.getElementById('sorogan-sesi-cards-container');
    const badgeCount = document.getElementById('sorogan-sesi-count-badge');
    if (!container) return;

    let sesiList = ASNSorogan.data.sesiList || [];

    if (!sesiList || sesiList.length === 0) {
        sesiList = [
            { sesiId: "SRG-SESI-01", namaSesi: "Pagi (Ba'da Subuh)", jenisSesi: "Sorogan Binnazhar Reguler", jamMulai: "05:15", jamSelesai: "06:30", hariList: ["Sen", "Sel", "Rab", "Kam", "Sab", "Min"], status: "Aktif Digunakan" },
            { sesiId: "SRG-SESI-02", namaSesi: "Sore (Ba'da Ashar)", jenisSesi: "Sorogan Privat / I'adah", jamMulai: "16:00", jamSelesai: "17:15", hariList: ["Sen", "Sel", "Kam", "Sab"], status: "Aktif Digunakan" },
            { sesiId: "SRG-SESI-03", namaSesi: "Malam (Ba'da Isya)", jenisSesi: "Khataman / Ujian Akhir Juz", jamMulai: "20:00", jamSelesai: "21:30", hariList: ["Kam"], status: "Aktif Digunakan" }
        ];
    }

    const activeCount = sesiList.filter(s => (s.status || '').includes('Aktif')).length;
    if (badgeCount) badgeCount.innerText = `${activeCount} Sesi Aktif (${sesiList.length} Total)`;

    container.innerHTML = sesiList.map((s, idx) => {
        const id = s.sesiId || `SRG-SESI-0${idx + 1}`;
        const nama = s.namaSesi || 'Sesi';
        const jenis = s.jenisSesi || 'Reguler';
        const isAktif = (s.status || '').includes('Aktif');
        const rawHari = s.hariList || [];
        const hariList = Array.isArray(rawHari) ? rawHari : String(rawHari).split(',').map(h => h.trim()).filter(Boolean);
        const hariStr = hariList.join(', ');

        const jamMulaiClean = cleanSoroganSesiTime(s.jamMulai, '05:15');
        const jamSelesaiClean = cleanSoroganSesiTime(s.jamSelesai, '06:30');

        return `
        <div class="p-3.5 bg-slate-50 dark:bg-[#1c2836] rounded-2xl border border-slate-200 dark:border-[#283a4e] space-y-2 relative group">
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2">
                    <span class="px-2 py-0.5 rounded text-[9px] font-extrabold bg-white dark:bg-[#15202d] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#283a4e]">
                        SESI 0${idx + 1}
                    </span>
                    <h5 class="font-black text-xs text-slate-800 dark:text-slate-100 truncate">${escapeHtml(nama)}</h5>
                </div>
                <div class="flex items-center space-x-1.5">
                    <span class="px-2 py-0.5 rounded-full text-[9px] font-extrabold ${isAktif ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300' : 'bg-slate-200 text-slate-600'}">
                        ${isAktif ? 'Aktif' : 'Nonaktif'}
                    </span>
                    <button type="button" onclick="editSoroganSesi('${escapeHtml(id)}')" class="w-6 h-6 rounded-lg bg-white dark:bg-[#15202d] hover:bg-slate-100 text-slate-500 hover:text-sky-600 flex items-center justify-center text-[10px] shadow-sm transition" title="Edit Sesi">
                        <i class="fa-solid fa-pencil"></i>
                    </button>
                    <button type="button" onclick="deleteSoroganSesiConfirm('${escapeHtml(id)}', '${escapeHtml(nama)}')" class="w-6 h-6 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300 flex items-center justify-center text-[10px] transition" title="Hapus Sesi">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
            <div class="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                <p class="flex items-center gap-1.5 font-semibold text-sky-700 dark:text-sky-300">
                    <i class="fa-solid fa-book-bookmark"></i>
                    <span>${escapeHtml(jenis)}</span>
                </p>
                <div class="flex items-center justify-between text-[11px] pt-1">
                    <span class="font-bold flex items-center gap-1 text-slate-700 dark:text-slate-200">
                        <i class="fa-regular fa-clock text-sky-600"></i> ${escapeHtml(jamMulaiClean)} - ${escapeHtml(jamSelesaiClean)} WIB
                    </span>
                    <span class="text-slate-400 text-[10px]">${hariStr || 'Setiap Hari'}</span>
                </div>
            </div>
        </div>`;
    }).join('');
}

function editSoroganSesi(sesiId) {
    const sesiList = ASNSorogan.data.sesiList || [];
    const sesi = sesiList.find(s => s.sesiId === sesiId);
    if (!sesi) return;

    const idInput = document.getElementById('input-sorogan-sesi-id');
    const namaInput = document.getElementById('input-sorogan-sesi-nama');
    const tipeInput = document.getElementById('input-sorogan-sesi-tipe');
    const statusInput = document.getElementById('input-sorogan-sesi-status');
    const jamMulaiInput = document.getElementById('input-sorogan-sesi-jam-mulai');
    const jamSelesaiInput = document.getElementById('input-sorogan-sesi-jam-selesai');
    const btnText = document.getElementById('btn-submit-sorogan-sesi-text');
    const btnCancel = document.getElementById('btn-cancel-sorogan-sesi');

    if (idInput) idInput.value = sesi.sesiId;
    if (namaInput) namaInput.value = sesi.namaSesi || '';
    if (tipeInput) tipeInput.value = sesi.jenisSesi || 'Sorogan Binnazhar Reguler';
    if (statusInput) statusInput.value = sesi.status || 'Aktif Digunakan';
    if (jamMulaiInput) jamMulaiInput.value = cleanSoroganSesiTime(sesi.jamMulai, '05:15');
    if (jamSelesaiInput) jamSelesaiInput.value = cleanSoroganSesiTime(sesi.jamSelesai, '06:30');
    if (btnText) btnText.innerText = "Perbarui Sesi";
    if (btnCancel) btnCancel.classList.remove('hidden');

    const rawHari = sesi.hariList || [];
    const arrHari = Array.isArray(rawHari) ? rawHari : String(rawHari).split(',').map(h => h.trim());
    document.querySelectorAll('input[name="sorogan-sesi-hari"]').forEach(chk => {
        chk.checked = arrHari.includes(chk.value);
    });
}

async function submitSoroganSesi(e) {
    if (e && e.preventDefault) e.preventDefault();

    const idInput = document.getElementById('input-sorogan-sesi-id');
    const namaInput = document.getElementById('input-sorogan-sesi-nama');
    const tipeInput = document.getElementById('input-sorogan-sesi-tipe');
    const statusInput = document.getElementById('input-sorogan-sesi-status');
    const jamMulaiInput = document.getElementById('input-sorogan-sesi-jam-mulai');
    const jamSelesaiInput = document.getElementById('input-sorogan-sesi-jam-selesai');
    const btn = document.getElementById('btn-submit-sorogan-sesi');

    const hariList = [];
    document.querySelectorAll('input[name="sorogan-sesi-hari"]:checked').forEach(chk => hariList.push(chk.value));

    const jamMulaiClean = cleanSoroganSesiTime(jamMulaiInput ? jamMulaiInput.value : "05:15", "05:15");
    const jamSelesaiClean = cleanSoroganSesiTime(jamSelesaiInput ? jamSelesaiInput.value : "06:30", "06:30");

    const payload = {
        sesiId: idInput ? idInput.value.trim() : "",
        namaSesi: namaInput ? namaInput.value.trim() : "",
        jenisSesi: tipeInput ? tipeInput.value : "Sorogan Binnazhar Reguler",
        status: statusInput ? statusInput.value : "Aktif Digunakan",
        jamMulai: jamMulaiClean,
        jamSelesai: jamSelesaiClean,
        hariList
    };

    if (!payload.namaSesi) {
        if (typeof showToast === 'function') showToast("⚠️ Nama sesi Sorogan wajib diisi!");
        else alert("Nama sesi wajib diisi!");
        return;
    }

    if (typeof setButtonLoading === 'function') {
        setButtonLoading(btn, true, "Menyimpan...");
    } else if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Menyimpan...`;
    }

    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(SOROGAN_STORAGE_KEYS.adminToken)) || "";
        const res = await apiPost("saveSoroganSesi", { token, ...payload });

        if (res && (res.success || res.status === "success")) {
            if (typeof showToast === 'function') showToast("Jadwal sesi Sorogan berhasil disimpan!");
            resetSoroganSesiForm();

            if (!ASNSorogan.data.sesiList) ASNSorogan.data.sesiList = [];
            const cleanPayload = {
                ...payload,
                jamMulai: jamMulaiClean,
                jamSelesai: jamSelesaiClean
            };
            const existingIdx = ASNSorogan.data.sesiList.findIndex(s => s.sesiId === payload.sesiId);
            if (existingIdx >= 0) {
                ASNSorogan.data.sesiList[existingIdx] = { ...ASNSorogan.data.sesiList[existingIdx], ...cleanPayload };
            } else {
                ASNSorogan.data.sesiList.push({ ...cleanPayload, sesiId: res.sesiId || ("SRG-SESI-" + Date.now().toString().substring(8)) });
            }
            renderSoroganSesiCards();
        } else {
            const msg = ((res && res.message) || "Kesalahan server saat menyimpan sesi.");
            if (typeof showToast === 'function') showToast("❌ " + msg);
            else alert(msg);
        }
    } catch (err) {
        if (typeof showToast === 'function') showToast("❌ Terjadi kesalahan jaringan saat menyimpan sesi Sorogan.");
        else alert("Terjadi kesalahan jaringan saat menyimpan sesi.");
    } finally {
        if (typeof setButtonLoading === 'function') {
            setButtonLoading(btn, false, "", `<i class="fa-solid fa-plus text-[10px]"></i><span id="btn-submit-sorogan-sesi-text">Simpan Sesi</span>`);
        } else if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-plus text-[10px]"></i><span id="btn-submit-sorogan-sesi-text">Simpan Sesi</span>`;
        }
    }
}

async function deleteSoroganSesiConfirm(sesiId, namaSesi) {
    const ok = confirm(`Hapus jadwal sesi "${namaSesi}"?`);
    if (!ok) return;

    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(SOROGAN_STORAGE_KEYS.adminToken)) || "";
        const res = await apiPost("deleteSoroganSesi", { token, sesiId });

        if (res && (res.success || res.status === "success")) {
            if (typeof showToast === 'function') showToast("Sesi berhasil dihapus.");
            ASNSorogan.data.sesiList = (ASNSorogan.data.sesiList || []).filter(s => s.sesiId !== sesiId);
            renderSoroganSesiCards();
        } else {
            alert("Gagal menghapus: " + ((res && res.message) || "Error"));
        }
    } catch (e) {
        alert("Kesalahan jaringan.");
    }
}


// ====================================================================
// TARGET CAPAIAN SOROGAN (INDIVIDUAL & MASSAL)
// ====================================================================

function populateSoroganJuzSelectOptions() {
    const selIndividual = document.getElementById('input-sorogan-target-juz');
    const selBulk = document.getElementById('sorogan-bulk-target-select-juz');

    let opts = '';
    for (let j = 1; j <= 30; j++) {
        opts += `<option value="${j}">Juz ${j} - ${SOROGAN_JUZ_SURAH_REF[j] || "Al-Qur'an"}</option>`;
    }

    if (selIndividual && selIndividual.children.length === 0) {
        selIndividual.innerHTML = opts;
    }
    if (selBulk && selBulk.children.length === 0) {
        selBulk.innerHTML = opts;
    }
}

function openSoroganTargetModal(studentId) {
    populateSoroganJuzSelectOptions();

    const st = (ASNSorogan.data.students || []).find(s => s.studentId === studentId);
    if (!st) return;

    const modal = document.getElementById('modal-sorogan-target');
    if (!modal) return;

    const targets = (ASNSorogan.data && ASNSorogan.data.targets) || {};
    const tgt = targets[studentId] || st.target || {
        targetJuz: Math.min(30, (st.juzAktif || 1) + 1),
        targetHalamanSesi: 2
    };

    const nameEl = document.getElementById('sorogan-target-student-name');
    const nisEl = document.getElementById('sorogan-target-student-nis');
    const posEl = document.getElementById('sorogan-target-current-pos');
    const idInput = document.getElementById('input-sorogan-target-student-id');
    const juzSel = document.getElementById('input-sorogan-target-juz');
    const sesiInput = document.getElementById('input-sorogan-target-sesi');

    if (nameEl) nameEl.innerText = st.name;
    if (nisEl) nisEl.innerText = `NIS: ${st.nis || "-"} • Halaqah: ${st.namaHalaqah || "Sorogan"}`;
    if (posEl) posEl.innerText = `Juz ${st.juzAktif || 1} • Hal ${st.halamanTerakhir || 1}`;
    if (idInput) idInput.value = st.studentId;
    if (juzSel) juzSel.value = String(tgt.targetJuz || Math.min(30, (st.juzAktif || 1) + 1));
    if (sesiInput) sesiInput.value = tgt.targetHalamanSesi || 2;

    recalculateSoroganTargetWeekly();
    modal.classList.remove('hidden');
}

function closeSoroganTargetModal() {
    const modal = document.getElementById('modal-sorogan-target');
    if (modal) modal.classList.add('hidden');
}

function setSoroganTargetChip(field, val) {
    if (field === 'SESI') {
        const inp = document.getElementById('input-sorogan-target-sesi');
        if (inp) {
            inp.value = val;
            recalculateSoroganTargetWeekly();
        }
    }
}

/**
 * Hitung jumlah sesi aktif per pekan untuk Sorogan berdasarkan ASNSorogan.data.sesiList
 * (Contoh: Sesi Pagi 5 hari + Sesi Sore 6 hari = 11 sesi per pekan)
 */
function getSoroganActiveWeeklySessionCounts() {
    let sesiList = (ASNSorogan.data && ASNSorogan.data.sesiList) || [];
    if (!sesiList || sesiList.length === 0) {
        return 11;
    }

    const activeSessions = sesiList.filter(s => (s.status || 'Aktif Digunakan').includes('Aktif'));
    if (activeSessions.length === 0) return 11;

    let count = 0;
    activeSessions.forEach(s => {
        const rawHari = s.hariList || s.hari || [];
        const hariArr = Array.isArray(rawHari) ? rawHari : String(rawHari).split(',').map(x => x.trim()).filter(Boolean);
        count += Math.max(1, hariArr.length);
    });

    return count > 0 ? count : 11;
}
window.getSoroganActiveWeeklySessionCounts = getSoroganActiveWeeklySessionCounts;

function recalculateSoroganTargetWeekly() {
    const sesiInp = document.getElementById('input-sorogan-target-sesi');
    const pekanInp = document.getElementById('input-sorogan-target-pekan');
    const bulanInp = document.getElementById('input-sorogan-target-bulan');
    const labelPekan = document.getElementById('label-sorogan-target-pekan');

    const weeklySessions = getSoroganActiveWeeklySessionCounts();
    if (labelPekan) {
        labelPekan.innerText = `Estimasi Target Pekanan (${weeklySessions} Sesi):`;
    }

    const sesi = Number(sesiInp?.value || 2);
    const pekan = Math.round(sesi * weeklySessions * 10) / 10;
    const bulan = Math.round(pekan * 4 * 10) / 10;

    const lembarPekan = (pekan / 2).toFixed(1);

    if (pekanInp) pekanInp.value = `${pekan} Halaman (${lembarPekan} Lembar)`;
    if (bulanInp) bulanInp.value = `${bulan} Halaman (~${(bulan / 20).toFixed(1)} Juz)`;
}

async function submitSoroganTarget() {
    const idInput = document.getElementById('input-sorogan-target-student-id');
    const juzSel = document.getElementById('input-sorogan-target-juz');
    const sesiInput = document.getElementById('input-sorogan-target-sesi');
    const btn = document.getElementById('btn-save-sorogan-target');

    const studentId = idInput ? idInput.value : "";
    const targetJuz = Number(juzSel?.value || 1);
    const targetHalamanSesi = Number(sesiInput?.value || 2);

    if (!studentId) return;

    if (typeof setButtonLoading === 'function') {
        setButtonLoading(btn, true, "Menyimpan...");
    } else if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Menyimpan...`;
    }

    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(SOROGAN_STORAGE_KEYS.adminToken)) || "";
        const weeklySessions = getSoroganActiveWeeklySessionCounts();
        const targetHalamanPekan = Math.round(targetHalamanSesi * weeklySessions * 10) / 10;

        const res = await apiPost("saveSoroganTarget", {
            token,
            studentId,
            targetJuz,
            targetHalamanSesi,
            targetHalamanPekan
        });

        if (res && (res.success || res.status === "success")) {
            closeSoroganTargetModal();
            if (typeof showToast === 'function') showToast("Target santri Sorogan berhasil disimpan!");

            if (!ASNSorogan.data.targets) ASNSorogan.data.targets = {};
            ASNSorogan.data.targets[studentId] = {
                targetJuz,
                targetHalamanSesi,
                targetHalamanPekan
            };
            renderSoroganTable();
        } else {
            const msg = ((res && res.message) || "Gagal menyimpan target sorogan santri.");
            if (typeof showToast === 'function') showToast("❌ " + msg);
            else alert(msg);
        }
    } catch (e) {
        if (typeof showToast === 'function') showToast("❌ Kesalahan jaringan saat menyimpan target.");
        else alert("Kesalahan jaringan saat menyimpan target.");
    } finally {
        if (typeof setButtonLoading === 'function') {
            setButtonLoading(btn, false, "", `<i class="fa-solid fa-floppy-disk"></i><span>Simpan Target</span>`);
        } else if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i><span>Simpan Target</span>`;
        }
    }
}

/**
 * Target Massal (Bulk Target) Sorogan
 */
function openSoroganBulkTargetModal(initialScope = 'ALL') {
    populateSoroganJuzSelectOptions();

    const modal = document.getElementById('modal-sorogan-target-bulk');
    if (!modal) return;

    // Populate Halaqah Dropdown
    const selHalaqah = document.getElementById('sorogan-bulk-target-select-halaqah');
    if (selHalaqah) {
        const halaqahs = ASNSorogan.data.halaqahs || [];
        selHalaqah.innerHTML = halaqahs.length > 0
            ? halaqahs.map(h => `<option value="${escapeHtml(h.halaqahId)}">${escapeHtml(h.namaHalaqah)}</option>`).join('')
            : '<option value="">(Belum ada halaqah)</option>';
    }

    const selCount = ASNSorogan.selectedStudentIds ? ASNSorogan.selectedStudentIds.size : 0;
    const scopeToUse = (initialScope === 'SELECTED' && selCount === 0) ? 'ALL' : initialScope;
    setSoroganBulkTargetScope(scopeToUse);

    recalculateSoroganBulkTargetWeekly();
    modal.classList.remove('hidden');
}

function closeSoroganBulkTargetModal() {
    const modal = document.getElementById('modal-sorogan-target-bulk');
    if (modal) modal.classList.add('hidden');
}

function setSoroganBulkTargetScope(scope) {
    if (!ASNSorogan.bulkTargetState) {
        ASNSorogan.bulkTargetState = { scope: 'ALL', halaqahId: '', juz: 1, studentIds: [] };
    }
    ASNSorogan.bulkTargetState.scope = scope;

    const scopes = ['all', 'halaqah', 'juz', 'selected'];
    scopes.forEach(s => {
        const btn = document.getElementById(`btn-sorogan-scope-${s}`);
        if (!btn) return;
        if (s.toUpperCase() === scope) {
            btn.className = 'px-3 py-2 rounded-xl font-bold text-xs border text-center transition flex flex-col items-center gap-1 bg-white dark:bg-[#15202d] border-sky-500 text-sky-700 dark:text-sky-300 shadow-sm ring-2 ring-sky-500/20';
        } else {
            btn.className = 'px-3 py-2 rounded-xl font-bold text-xs border text-center transition flex flex-col items-center gap-1 bg-white dark:bg-[#15202d] border-slate-200 dark:border-[#283a4e] text-slate-600 dark:text-slate-300 hover:border-amber-400';
        }
    });

    const subContainer = document.getElementById('sorogan-bulk-target-subselect-container');
    const halaqahWrap = document.getElementById('sorogan-bulk-target-halaqah-wrapper');
    const juzWrap = document.getElementById('sorogan-bulk-target-juz-wrapper');

    if (subContainer) {
        if (scope === 'HALAQAH' || scope === 'JUZ') {
            subContainer.classList.remove('hidden');
        } else {
            subContainer.classList.add('hidden');
        }
    }

    if (halaqahWrap) {
        if (scope === 'HALAQAH') halaqahWrap.classList.remove('hidden');
        else halaqahWrap.classList.add('hidden');
    }

    if (juzWrap) {
        if (scope === 'JUZ') juzWrap.classList.remove('hidden');
        else juzWrap.classList.add('hidden');
    }

    onSoroganBulkTargetScopeChange();
}

function onSoroganBulkTargetScopeChange() {
    const scope = ASNSorogan.bulkTargetState?.scope || 'ALL';
    const students = ASNSorogan.data.students || [];
    let count = 0;
    let summaryText = "";

    if (scope === 'ALL') {
        count = students.length;
        summaryText = "Target akan diterapkan ke seluruh santri Sorogan aktif";
    } else if (scope === 'HALAQAH') {
        const selHalaqah = document.getElementById('sorogan-bulk-target-select-halaqah');
        const hId = selHalaqah ? selHalaqah.value : "";
        count = students.filter(s => s.halaqahId === hId).length;
        summaryText = `Target akan diterapkan ke santri di halaqah terpilih (${count} santri)`;
    } else if (scope === 'JUZ') {
        const selJuz = document.getElementById('sorogan-bulk-target-select-juz');
        const j = selJuz ? Number(selJuz.value) : 1;
        count = students.filter(s => Number(s.juzAktif) === j).length;
        summaryText = `Target akan diterapkan ke semua santri Juz ${j} (${count} santri)`;
    } else if (scope === 'SELECTED') {
        count = ASNSorogan.selectedStudentIds ? ASNSorogan.selectedStudentIds.size : 0;
        summaryText = `Target akan diterapkan ke ${count} santri yang dicentang`;
    }

    const badgeEl = document.getElementById('sorogan-bulk-target-recipient-badge');
    const sumEl = document.getElementById('sorogan-bulk-target-summary-text');
    const prevEl = document.getElementById('sorogan-bulk-target-student-preview');

    if (badgeEl) badgeEl.innerText = `${count} Santri Sasaran`;
    if (sumEl) sumEl.innerText = summaryText;
    if (prevEl) prevEl.innerText = `${count} santri`;
}

function setSoroganBulkTargetChip(field, val) {
    if (field === 'SESI') {
        const inp = document.getElementById('input-sorogan-bulk-target-sesi');
        if (inp) {
            inp.value = val;
            recalculateSoroganBulkTargetWeekly();
        }
    }
}

function recalculateSoroganBulkTargetWeekly() {
    const sesiInp = document.getElementById('input-sorogan-bulk-target-sesi');
    const pekanInp = document.getElementById('input-sorogan-bulk-target-pekan');
    const bulanInp = document.getElementById('input-sorogan-bulk-target-bulan');
    const labelPekan = document.getElementById('label-sorogan-bulk-target-pekan');

    const weeklySessions = getSoroganActiveWeeklySessionCounts();
    if (labelPekan) {
        labelPekan.innerText = `Target Pekanan (${weeklySessions} Sesi):`;
    }

    const sesi = Number(sesiInp?.value || 2);
    const pekan = Math.round(sesi * weeklySessions * 10) / 10;
    const bulan = Math.round(pekan * 4 * 10) / 10;

    const lembarPekan = (pekan / 2).toFixed(1);

    if (pekanInp) pekanInp.value = `${pekan} Halaman (${lembarPekan} Lembar)`;
    if (bulanInp) bulanInp.value = `${bulan} Halaman (~${(bulan / 20).toFixed(1)} Juz)`;
}

async function submitSoroganBulkTarget() {
    const scope = ASNSorogan.bulkTargetState?.scope || 'ALL';
    const students = ASNSorogan.data.students || [];
    let targetStudentIds = [];

    if (scope === 'ALL') {
        targetStudentIds = students.map(s => s.studentId);
    } else if (scope === 'HALAQAH') {
        const selHalaqah = document.getElementById('sorogan-bulk-target-select-halaqah');
        const hId = selHalaqah ? selHalaqah.value : "";
        targetStudentIds = students.filter(s => s.halaqahId === hId).map(s => s.studentId);
    } else if (scope === 'JUZ') {
        const selJuz = document.getElementById('sorogan-bulk-target-select-juz');
        const j = selJuz ? Number(selJuz.value) : 1;
        targetStudentIds = students.filter(s => Number(s.juzAktif) === j).map(s => s.studentId);
    } else if (scope === 'SELECTED') {
        targetStudentIds = Array.from(ASNSorogan.selectedStudentIds || []);
    }

    if (targetStudentIds.length === 0) {
        alert("Tidak ada santri sasaran yang terpilih.");
        return;
    }

    const sesiInp = document.getElementById('input-sorogan-bulk-target-sesi');
    const targetHalamanSesi = Number(sesiInp?.value || 2);
    const btn = document.getElementById('btn-save-sorogan-target-bulk');

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Menerapkan Target...`;
    }

    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(SOROGAN_STORAGE_KEYS.adminToken)) || "";
        const weeklySessions = getSoroganActiveWeeklySessionCounts();
        const targetHalamanPekan = Math.round(targetHalamanSesi * weeklySessions * 10) / 10;

        const res = await apiPost("saveBulkSoroganTarget", {
            token,
            studentIds: targetStudentIds,
            targetHalamanSesi,
            targetHalamanPekan
        });

        if (res && (res.success || res.status === "success")) {
            closeSoroganBulkTargetModal();
            if (typeof showToast === 'function') {
                showToast(`✅ Target berhasil diterapkan ke ${targetStudentIds.length} santri Sorogan!`);
            }
            if (!ASNSorogan.data.targets) ASNSorogan.data.targets = {};
            targetStudentIds.forEach(id => {
                ASNSorogan.data.targets[id] = {
                    targetHalamanSesi,
                    targetHalamanPekan
                };
            });
            clearSoroganSelectedStudents();
            renderSoroganTable();
        } else {
            const msg = ((res && res.message) || "Kesalahan server saat menerapkan target massal.");
            if (typeof showToast === 'function') showToast("❌ " + msg);
            else alert(msg);
        }
    } catch (e) {
        if (typeof showToast === 'function') showToast("❌ Kesalahan jaringan saat menyimpan target massal.");
        else alert("Kesalahan jaringan saat menyimpan target massal.");
    } finally {
        if (typeof setButtonLoading === 'function') {
            setButtonLoading(btn, false, "", `<i class="fa-solid fa-bullseye"></i><span>Terapkan Target Massal</span>`);
        } else if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-bullseye"></i><span>Terapkan Target Massal</span>`;
        }
    }
}

// Window global exports
window.loadAdminSoroganData = loadAdminSoroganData;
window.renderSoroganSummaryCards = renderSoroganSummaryCards;
window.populateSoroganFilters = populateSoroganFilters;
window.filterSoroganList = filterSoroganList;
window.renderSoroganTable = renderSoroganTable;
window.openSimakSoroganModal = openSimakSoroganModal;
window.closeSimakSoroganModal = closeSimakSoroganModal;
window.onSoroganJuzChanged = onSoroganJuzChanged;
window.renderSoroganPageSelector = renderSoroganPageSelector;
window.toggleSoroganPage = toggleSoroganPage;
window.selectSoroganQuickRange = selectSoroganQuickRange;
window.selectSoroganQuickStatus = selectSoroganQuickStatus;
window.selectSoroganQuickNilai = selectSoroganQuickNilai;
window.submitSimakSorogan = submitSimakSorogan;
window.initSoroganDatabaseSheets = initSoroganDatabaseSheets;

// Halaqah & Plotting exports
window.openSoroganHalaqahModal = openSoroganHalaqahModal;
window.closeSoroganHalaqahModal = closeSoroganHalaqahModal;
window.switchSoroganHalaqahTab = switchSoroganHalaqahTab;
window.submitNewSoroganHalaqah = submitNewSoroganHalaqah;
window.deleteSoroganHalaqahConfirm = deleteSoroganHalaqahConfirm;
window.openPlottingFromHalaqahCard = openPlottingFromHalaqahCard;
window.onSelectPlottingSoroganHalaqah = onSelectPlottingSoroganHalaqah;
window.filterSoroganPlottingAvailableList = filterSoroganPlottingAvailableList;
window.addStudentToSoroganPlotting = addStudentToSoroganPlotting;
window.removeStudentFromSoroganPlotting = removeStudentFromSoroganPlotting;
window.submitSoroganPlotting = submitSoroganPlotting;
window.resetSoroganSesiForm = resetSoroganSesiForm;
window.editSoroganSesi = editSoroganSesi;
window.submitSoroganSesi = submitSoroganSesi;
window.deleteSoroganSesiConfirm = deleteSoroganSesiConfirm;

// Multi-select & Target exports
window.toggleSelectAllSoroganStudents = toggleSelectAllSoroganStudents;
window.toggleSelectSoroganStudent = toggleSelectSoroganStudent;
window.clearSoroganSelectedStudents = clearSoroganSelectedStudents;
window.openSoroganTargetModal = openSoroganTargetModal;
window.closeSoroganTargetModal = closeSoroganTargetModal;
window.setSoroganTargetChip = setSoroganTargetChip;
window.recalculateSoroganTargetWeekly = recalculateSoroganTargetWeekly;
window.submitSoroganTarget = submitSoroganTarget;
window.openSoroganBulkTargetModal = openSoroganBulkTargetModal;
window.closeSoroganBulkTargetModal = closeSoroganBulkTargetModal;
window.setSoroganBulkTargetScope = setSoroganBulkTargetScope;
window.onSoroganBulkTargetScopeChange = onSoroganBulkTargetScopeChange;
window.setSoroganBulkTargetChip = setSoroganBulkTargetChip;
window.recalculateSoroganBulkTargetWeekly = recalculateSoroganBulkTargetWeekly;
window.submitSoroganBulkTarget = submitSoroganBulkTarget;

// ====================================================================
// MODAL DETAIL SANTRI & MUTABA'AH SOROGAN AL-QUR'AN
// ====================================================================

/**
 * Buka modal detail santri & mutaba'ah sorogan
 */
async function openSoroganStudentDetail(studentId, viewerRole = null) {
    if (viewerRole) {
        ASNSorogan.viewerRole = viewerRole;
    } else if (typeof ASNIdentity !== 'undefined') {
        const r = String(ASNIdentity.currentRole || '').toUpperCase();
        if (r === 'WALI_SANTRI' || r === 'PARENT') {
            ASNSorogan.viewerRole = 'parent';
        } else if (r === 'PENGASUH') {
            ASNSorogan.viewerRole = 'pengasuh';
        } else {
            ASNSorogan.viewerRole = 'admin';
        }
    } else {
        ASNSorogan.viewerRole = 'admin';
    }

    const modal = document.getElementById('modal-sorogan-detail');
    if (!modal) return;

    modal.classList.remove('hidden');
    ASNSorogan.detailActiveTab = 1;
    switchSoroganDetailTab(1);

    const loader = document.getElementById('sorogan-detail-loader');
    const errorBox = document.getElementById('sorogan-detail-error');
    const errorText = document.getElementById('sorogan-detail-error-text');
    const bodyBox = document.getElementById('sorogan-detail-body');

    if (loader) loader.classList.remove('hidden');
    if (errorBox) errorBox.classList.add('hidden');
    if (bodyBox) bodyBox.classList.add('hidden');

    // Pre-populate student header from memory if available
    const existingStudent = (ASNSorogan.data.students || []).find(s => {
        const sId = String(s.studentId || s.student_id || s.id || '').trim();
        const sNis = String(s.nis || '').trim();
        const targetId = String(studentId || '').trim();
        return sId === targetId || sNis === targetId;
    });

    if (existingStudent) {
        const elName = document.getElementById('sorogan-detail-name');
        const elNis = document.getElementById('sorogan-detail-nis');
        const elAvatar = document.getElementById('sorogan-detail-avatar');
        const halaqahName = existingStudent.namaHalaqah || 'Halaqah Sorogan';

        if (elName) elName.innerText = existingStudent.name || "Santri";
        if (elNis) elNis.innerText = `NIS: ${existingStudent.nis || '-'} • Binnazhar • ${escapeHtml(halaqahName)}`;
        if (elAvatar) {
            const initials = (existingStudent.name || 'Santri').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
            elAvatar.innerHTML = existingStudent.photoUrl ? `<img src="${escapeHtml(existingStudent.photoUrl)}" class="w-full h-full object-cover rounded-2xl">` : initials;
        }
    }

    try {
        const token = (typeof ASNIdentity !== 'undefined' ? (
            sessionStorage.getItem(SOROGAN_STORAGE_KEYS.parentToken) ||
            localStorage.getItem(SOROGAN_STORAGE_KEYS.parentToken) ||
            sessionStorage.getItem(SOROGAN_STORAGE_KEYS.pengasuhToken) ||
            localStorage.getItem(SOROGAN_STORAGE_KEYS.pengasuhToken) ||
            sessionStorage.getItem(SOROGAN_STORAGE_KEYS.adminToken) ||
            localStorage.getItem(SOROGAN_STORAGE_KEYS.adminToken)
        ) : '') || (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(SOROGAN_STORAGE_KEYS.adminToken)) || "";

        let response;
        try {
            response = await apiPost("getSoroganStudentDetail", { token, studentId });
        } catch (apiErr) {
            response = await apiPost("getSoroganStudentDetail", { studentId });
        }

        if (response && (response.success || response.status === "success")) {
            ASNSorogan.activeStudentDetail = response;
            if (loader) loader.classList.add('hidden');
            if (errorBox) errorBox.classList.add('hidden');
            if (bodyBox) bodyBox.classList.remove('hidden');
            renderSoroganStudentDetailView();
        } else {
            if (loader) loader.classList.add('hidden');
            if (errorBox) {
                errorBox.classList.remove('hidden');
                if (errorText) errorText.innerText = `Gagal memuat detail: ${response?.message || 'Data tidak ditemukan'}`;
            }
        }
    } catch (err) {
        console.error("Gagal load detail santri sorogan:", err);
        if (loader) loader.classList.add('hidden');
        if (errorBox) {
            errorBox.classList.remove('hidden');
            if (errorText) errorText.innerText = `Terjadi kendala saat memuat data santri: ${err.message || err}`;
        }
    }
}

/**
 * Tutup modal detail santri sorogan
 */
function closeSoroganStudentDetail() {
    const modal = document.getElementById('modal-sorogan-detail');
    if (modal) modal.classList.add('hidden');
    ASNSorogan.activeStudentDetail = null;
}

/**
 * Ganti tab dalam modal detail santri sorogan
 */
function switchSoroganDetailTab(tabIndex) {
    ASNSorogan.detailActiveTab = tabIndex;

    const tab1Btn = document.getElementById('btn-sorogan-detail-tab-1');
    const tab2Btn = document.getElementById('btn-sorogan-detail-tab-2');
    const tab3Btn = document.getElementById('btn-sorogan-detail-tab-3');
    const panel1 = document.getElementById('panel-sorogan-detail-tab-1');
    const panel2 = document.getElementById('panel-sorogan-detail-tab-2');
    const panel3 = document.getElementById('panel-sorogan-detail-tab-3');

    const activeClasses = "px-3 py-1.5 text-xs font-bold rounded-xl bg-sky-700 text-white shadow-sm transition flex items-center gap-1.5 shrink-0";
    const inactiveClasses = "px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 dark:bg-[#1c2836] text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition flex items-center gap-1.5 shrink-0";

    if (tab1Btn) tab1Btn.className = (tabIndex === 1) ? activeClasses : inactiveClasses;
    if (tab2Btn) tab2Btn.className = (tabIndex === 2) ? activeClasses : inactiveClasses;
    if (tab3Btn) tab3Btn.className = (tabIndex === 3) ? activeClasses : inactiveClasses;

    if (panel1) panel1.classList.toggle('hidden', tabIndex !== 1);
    if (panel2) panel2.classList.toggle('hidden', tabIndex !== 2);
    if (panel3) panel3.classList.toggle('hidden', tabIndex !== 3);

    if (tabIndex === 3) {
        renderSoroganEstimasiKhatam();
    }
}

/**
 * Render detail view mutaba'ah santri sorogan
 */
function renderSoroganStudentDetailView() {
    const res = ASNSorogan.activeStudentDetail;
    if (!res) return;

    const st = res.student || {};
    const stats = res.stats || {};
    const ind = res.indikator || {};
    const riwayat = res.riwayat || [];
    const target = res.target || {};

    const elName = document.getElementById('sorogan-detail-name');
    const elNis = document.getElementById('sorogan-detail-nis');
    const elAvatar = document.getElementById('sorogan-detail-avatar');
    const elBadge = document.getElementById('sorogan-detail-badge-status');
    const halaqahName = st.halaqah || res.halaqah || 'Halaqah Sorogan';

    if (elName) elName.innerText = st.name || "Santri";
    if (elNis) elNis.innerText = `NIS: ${st.nis || '-'} • Binnazhar • ${escapeHtml(halaqahName)}`;
    if (elAvatar) {
        const initials = (st.name || 'Santri').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
        elAvatar.innerHTML = st.photoUrl ? `<img src="${escapeHtml(st.photoUrl)}" class="w-full h-full object-cover rounded-2xl">` : initials;
    }
    if (elBadge) {
        elBadge.innerText = (st.status === 'ACTIVE' || !st.status) ? "Sorogan Aktif" : st.status;
    }

    // 4 Stat Strip Cards
    const elStatCapaian = document.getElementById('sorogan-detail-stat-capaian');
    const elStatTarget = document.getElementById('sorogan-detail-stat-target');
    const elStatTotal = document.getElementById('sorogan-detail-stat-total');
    const elStatNilai = document.getElementById('sorogan-detail-stat-nilai');

    const progressJuz = Number(stats.progressJuz || 1);
    const halTerakhir = Number(stats.halamanTerakhir || 1);
    const halamanTuntas = Math.max(1, ((progressJuz - 1) * 20) + halTerakhir);
    const isKhatam = (progressJuz === 30 && halTerakhir >= 20) || halamanTuntas >= 600 || !!(stats && stats.isKhatam);
    const percentMilestone = isKhatam ? 100 : Math.min(100, Math.round((halamanTuntas / 600) * 100));

    if (elStatCapaian) {
        elStatCapaian.innerHTML = isKhatam
            ? `<span class="text-amber-500 font-black flex items-center gap-1"><i class="fa-solid fa-crown text-amber-500 text-xs"></i> Khatam 30 Juz (100%)</span>`
            : `Juz ${progressJuz} Hal ${halTerakhir} <span class="text-xs font-bold text-slate-400">(${percentMilestone}%)</span>`;
    }
    if (elStatTarget) {
        elStatTarget.innerText = `Juz ${target.targetJuz || 30}`;
    }
    if (elStatTotal) {
        elStatTotal.innerText = `${riwayat.length} Kali`;
    }
    if (elStatNilai) {
        elStatNilai.innerText = stats.rataRataNilai || "Mumtaz (A)";
    }

    // Progress 600 Halaman (30 Juz)
    const elProgText = document.getElementById('sorogan-detail-progress-text');
    const elProgBar = document.getElementById('sorogan-detail-progress-bar');
    if (elProgText) {
        elProgText.innerText = isKhatam
            ? `Khatam 30 Juz Mushaf Pojok • 600 / 600 Halaman (100%)`
            : `Juz ${progressJuz} (Hal ${halTerakhir}/20) • ${halamanTuntas} / 600 Halaman (${percentMilestone}%)`;
    }
    if (elProgBar) {
        elProgBar.style.width = `${percentMilestone}%`;
        if (isKhatam) {
            elProgBar.className = "h-full rounded-full transition-all bg-gradient-to-r from-amber-400 to-amber-500";
        } else {
            elProgBar.className = "bg-sky-600 h-full rounded-full transition-all";
        }
    }

    // Tab 1 Indikator Harian, Pekanan, Bulanan
    const elDateHarian = document.getElementById('sorogan-date-harian');
    if (elDateHarian && !elDateHarian.value) {
        elDateHarian.value = new Date().toISOString().split('T')[0];
    }

    const indH = ind.harian || {};
    const indP = ind.pekanan || {};
    const indB = ind.bulanan || {};

    const elIndHStatus = document.getElementById('sorogan-ind-harian-status');
    const elIndHReal = document.getElementById('sorogan-ind-harian-realita');
    const elIndHTgt = document.getElementById('sorogan-ind-harian-target');

    if (elIndHStatus) {
        elIndHStatus.innerText = indH.status || (riwayat.length > 0 ? "Ada Simakan" : "Belum Ada Simakan");
        elIndHStatus.className = (indH.status && indH.status.includes("Ada"))
            ? "text-[9px] font-extrabold px-2 py-0.5 rounded bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
            : "text-[9px] font-extrabold px-2 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300";
    }
    if (elIndHReal) elIndHReal.innerText = indH.realitaText || "0 Halaman";
    if (elIndHTgt) elIndHTgt.innerText = indH.targetText || `${target.targetHalamanSesi || 2} Halaman / Sesi`;

    const elIndPStatus = document.getElementById('sorogan-ind-pekan-status');
    const elIndPReal = document.getElementById('sorogan-ind-pekan-realita');
    const elIndPTgt = document.getElementById('sorogan-ind-pekan-target');
    const elIndPBar = document.getElementById('sorogan-ind-pekan-bar');

    const weeklySessions = getSoroganActiveWeeklySessionCounts();
    const fallbackTargetPekan = target.targetHalamanPekan || ((target.targetHalamanSesi || 2) * weeklySessions);
    const fallbackTargetBulan = fallbackTargetPekan * 4;

    if (elIndPStatus) elIndPStatus.innerText = indP.status || "0% Capaian";
    if (elIndPReal) elIndPReal.innerText = indP.realitaText || "0 Halaman";
    if (elIndPTgt) elIndPTgt.innerText = indP.targetText || `${fallbackTargetPekan} Halaman`;
    if (elIndPBar) elIndPBar.style.width = `${Math.min(100, indP.percent || 0)}%`;

    const elIndBStatus = document.getElementById('sorogan-ind-bulan-status');
    const elIndBReal = document.getElementById('sorogan-ind-bulan-realita');
    const elIndBTgt = document.getElementById('sorogan-ind-bulan-target');
    const elIndBBar = document.getElementById('sorogan-ind-bulan-bar');

    if (elIndBStatus) elIndBStatus.innerText = indB.status || "0% Capaian";
    if (elIndBReal) elIndBReal.innerText = indB.realitaText || "0 Halaman";
    if (elIndBTgt) elIndBTgt.innerText = indB.targetText || `${fallbackTargetBulan} Halaman`;
    if (elIndBBar) elIndBBar.style.width = `${Math.min(100, indB.percent || 0)}%`;

    // Render Matriks 30 Juz Mushaf Pojok Grid
    const elJuzGrid = document.getElementById('sorogan-detail-juz-grid');
    if (elJuzGrid) {
        let gridHtml = '';
        for (let j = 1; j <= 30; j++) {
            const isCompleted = isKhatam || (j < progressJuz);
            const isCurrent = !isKhatam && (j === progressJuz);

            let cardClass = "";
            let badgeText = "";
            if (isKhatam && j === 30) {
                cardClass = "bg-gradient-to-br from-amber-500 to-amber-600 text-white border-amber-600 shadow-sm";
                badgeText = `<span class="text-[9px] font-black flex items-center gap-0.5"><i class="fa-solid fa-crown text-[8px]"></i> Khatam</span>`;
            } else if (isCompleted) {
                cardClass = "bg-sky-600 text-white border-sky-700 shadow-sm";
                badgeText = `<i class="fa-solid fa-check text-[10px]"></i>`;
            } else if (isCurrent) {
                cardClass = "bg-sky-50 dark:bg-sky-950/80 border-2 border-sky-500 text-sky-800 dark:text-sky-200 shadow-sm animate-pulse";
                badgeText = `<span class="text-[9px] font-black">Hal ${halTerakhir}</span>`;
            } else {
                cardClass = "bg-white dark:bg-[#1a2636] border border-slate-200 dark:border-[#283a4e] text-slate-400";
                badgeText = `<span class="text-[9px] text-slate-400">20 Hal</span>`;
            }

            gridHtml += `
                <div class="p-2 rounded-xl border flex flex-col items-center justify-center text-center transition ${cardClass}" title="Juz ${j} (${SOROGAN_JUZ_SURAH_REF[j] || ''})">
                    <span class="text-[11px] font-black">Juz ${j}</span>
                    ${badgeText}
                </div>
            `;
        }
        elJuzGrid.innerHTML = gridHtml;
    }

    // Tab 2 Riwayat Simakan - Dual View: Kartu Responsif (Default HP) & Tabel Lengkap
    const tbody = document.getElementById('sorogan-detail-riwayat-tbody');
    const riwayatCardList = document.getElementById('sorogan-detail-riwayat-card-list');
    const countBadge = document.getElementById('sorogan-detail-riwayat-count-badge');
    const isParentOrPengasuh = ASNSorogan.viewerRole === 'parent' || ASNSorogan.viewerRole === 'pengasuh';

    if (countBadge) {
        countBadge.innerText = `${riwayat.length} Simakan`;
    }

    // 1. Render Tampilan Kartu (Optimal untuk HP agar tampil 100% utuh tanpa scroll kanan)
    if (riwayatCardList) {
        if (riwayat.length === 0) {
            riwayatCardList.innerHTML = `
            <div class="py-8 text-center text-xs text-slate-400 bg-slate-50 dark:bg-[#1c2836] rounded-2xl border border-dashed border-slate-200 dark:border-[#283a4e]">
                <i class="fa-solid fa-clock-rotate-left text-2xl text-slate-300 dark:text-slate-600 mb-2 block"></i>
                Belum ada riwayat simakan sorogan untuk santri ini.
            </div>`;
        } else {
            riwayatCardList.innerHTML = riwayat.map(r => {
                const isUlang = r.statusSetoran === 'ULANG';
                const statusBadge = isUlang
                    ? '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60"><i class="fa-solid fa-rotate-left text-[8px]"></i> Ulang</span>'
                    : '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-900/60"><i class="fa-solid fa-check text-[8px]"></i> Lancar</span>';

                const deleteBtn = isParentOrPengasuh ? '' : `
                    <button type="button" onclick="deleteSoroganSimakanLog('${escapeHtml(r.logId || "")}')" class="w-6 h-6 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300 flex items-center justify-center text-[10px] transition shrink-0 ml-1" title="Hapus Catatan Ini">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>`;

                const surahRef = SOROGAN_JUZ_SURAH_REF[r.juz] || "Al-Qur'an 30 Juz";

                return `
                <div class="p-3 bg-slate-50 dark:bg-[#1c2836] rounded-2xl border border-slate-200/80 dark:border-[#283a4e] space-y-2 transition hover:border-sky-500/40">
                    <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-1.5 flex-wrap min-w-0">
                            <span class="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shrink-0 bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                                ${escapeHtml(r.sesi || "Pagi")}
                            </span>
                            <span class="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                                <i class="fa-regular fa-calendar text-[10px] text-slate-400"></i>
                                <span>${escapeHtml(r.tanggal || "-")}</span>
                            </span>
                        </div>
                        <div class="flex items-center gap-1 shrink-0">
                            <span class="font-extrabold text-xs ${isUlang ? 'text-rose-600 dark:text-rose-400' : 'text-sky-600 dark:text-sky-400'}">
                                ${escapeHtml(r.nilai || "MUMTAZ")}
                            </span>
                            ${statusBadge}
                            ${deleteBtn}
                        </div>
                    </div>

                    <div class="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200/60 dark:border-[#283a4e]/60 text-xs">
                        <div class="min-w-0">
                            <span class="font-black text-sky-700 dark:text-sky-400 text-xs">Juz ${r.juz || 1}</span>
                            <span class="text-slate-600 dark:text-slate-300 text-[11px] font-medium ml-1 truncate" title="${escapeHtml(surahRef)}">
                                (${escapeHtml(surahRef)})
                            </span>
                        </div>
                        <div class="text-[10px] font-semibold text-slate-500 dark:text-slate-400 shrink-0 bg-white dark:bg-[#15202d] px-2 py-0.5 rounded-lg border border-slate-200/60 dark:border-[#283a4e]">
                            Hal ${escapeHtml(r.halamanList || "1")} (${r.totalHalaman || 1} Hal)
                        </div>
                    </div>

                    ${(r.muallim || r.catatan) ? `
                    <div class="flex items-center justify-between gap-2 text-[10px] text-slate-400 pt-0.5">
                        <div class="truncate">
                            <i class="fa-solid fa-chalkboard-user text-[9px] text-sky-600 mr-1"></i>
                            <span class="font-semibold text-slate-600 dark:text-slate-300">${escapeHtml(r.muallim || "-")}</span>
                        </div>
                        ${r.catatan ? `<div class="italic truncate max-w-[160px]" title="${escapeHtml(r.catatan)}">${escapeHtml(r.catatan)}</div>` : ''}
                    </div>` : ''}
                </div>`;
            }).join('');
        }
    }

    // 2. Render Tampilan Tabel Lengkap (Bisa dialihkan via toggle)
    if (tbody) {
        if (riwayat.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-slate-400">Belum ada riwayat simakan sorogan.</td></tr>`;
        } else {
            tbody.innerHTML = riwayat.map(r => {
                const isUlang = r.statusSetoran === 'ULANG';
                const statusBadge = isUlang
                    ? `<span class="px-2 py-0.5 rounded text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950 dark:text-rose-300">Wajib Ulang</span>`
                    : `<span class="px-2 py-0.5 rounded text-[10px] font-black bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950 dark:text-sky-300">Lancar</span>`;

                return `
                <tr class="hover:bg-slate-50/80 dark:hover:bg-[#1a2636]/60 transition border-b border-slate-100 dark:border-[#202f42]">
                    <td class="py-2.5 px-3">
                        <div class="font-bold text-slate-800 dark:text-slate-100">${r.tanggal || "-"}</div>
                        <div class="text-[10px] text-slate-400">${escapeHtml(r.sesi || "Pagi")}</div>
                    </td>
                    <td class="py-2.5 px-3">
                        <div class="font-bold text-sky-700 dark:text-sky-300">Juz ${r.juz || 1}</div>
                        <div class="text-[10px] text-slate-400">Halaman: ${escapeHtml(r.halamanList || "1")} (${r.totalHalaman || 1} Hal)</div>
                    </td>
                    <td class="py-2.5 px-3">
                        ${statusBadge}
                        <div class="text-[10px] font-semibold text-slate-500 mt-0.5">Nilai: ${escapeHtml(r.nilai || "MUMTAZ")}</div>
                    </td>
                    <td class="py-2.5 px-3">
                        <div class="font-semibold text-slate-700 dark:text-slate-200">${escapeHtml(r.muallim || "-")}</div>
                        <div class="text-[10px] text-slate-400 italic">${escapeHtml(r.catatan || "-")}</div>
                    </td>
                    <td class="py-2.5 px-3 text-right">
                        ${isParentOrPengasuh ? '<span class="text-[9px] font-semibold text-slate-400">Tercatat</span>' : `
                        <button type="button" onclick="deleteSoroganSimakanLog('${escapeHtml(r.logId || "")}')" class="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition" title="Hapus Catatan Ini">
                            <i class="fa-solid fa-trash text-xs"></i>
                        </button>`}
                    </td>
                </tr>
                `;
            }).join('');
        }
    }

    // Set mode tampilan default
    setSoroganRiwayatView(soroganRiwayatViewMode);

    // Tab 3 Estimasi Khatam
    renderSoroganEstimasiKhatam();
}

/**
 * Render estimasi khatam sorogan 30 juz
 */
function renderSoroganEstimasiKhatam() {
    const res = ASNSorogan.activeStudentDetail;
    if (!res) return;

    const st = res.student || {};
    const stats = res.stats || {};
    const riwayat = res.riwayat || [];
    const target = res.target || {};

    const progressJuz = Number(stats.progressJuz || 1);
    const halTerakhir = Number(stats.halamanTerakhir || 1);
    const halamanTuntas = Math.min(600, Math.max(1, ((progressJuz - 1) * 20) + halTerakhir));
    const sisaHalaman = Math.max(0, 600 - halamanTuntas);
    const persenMilestone = Math.min(100, Math.round((halamanTuntas / 600) * 100));

    // Laju simakan per pekan
    const lancarLogs = riwayat.filter(r => r.statusSetoran !== 'ULANG');
    let lajuPekanRiil = 0;
    if (lancarLogs.length >= 2) {
        const sorted = [...lancarLogs].sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
        const firstDate = new Date(sorted[0].tanggal);
        const lastDate = new Date(sorted[sorted.length - 1].tanggal);
        const diffDays = Math.max(1, Math.round((lastDate - firstDate) / (1000 * 60 * 60 * 24)));
        const totalHlm = sorted.reduce((sum, item) => sum + (Number(item.totalHalaman) || 1), 0);
        lajuPekanRiil = (diffDays >= 7) ? (totalHlm / (diffDays / 7)) : totalHlm;
    } else if (lancarLogs.length === 1) {
        lajuPekanRiil = Number(lancarLogs[0].totalHalaman) || 2;
    }

    const weeklySessions = getSoroganActiveWeeklySessionCounts();
    const targetPekan = Number(target.targetHalamanPekan) || ((Number(target.targetHalamanSesi) || 2) * weeklySessions);
    let lajuEfektif = (lajuPekanRiil >= 0.5) ? lajuPekanRiil : targetPekan;
    lajuEfektif = Math.max(0.5, lajuEfektif);

    const lajuBulanRiil = lajuEfektif * 4.33;

    const namaBulanIndo = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];

    const getProjectionDate = (ratePerWeek) => {
        if (sisaHalaman <= 0) return { text: "Alhamdulillah Khatam 30 Juz!", durasiText: "(Tuntas 600 Halaman)" };
        const safeRate = Math.max(0.5, ratePerWeek);
        const weeksNeeded = sisaHalaman / safeRate;
        const projDate = new Date();
        projDate.setDate(projDate.getDate() + Math.round(weeksNeeded * 7));
        const bulanName = namaBulanIndo[projDate.getMonth()];
        const tahun = projDate.getFullYear();
        const durasiBulan = Math.max(1, Math.round(weeksNeeded / 4.33));
        return {
            text: `${bulanName} ${tahun}`,
            durasiText: `(± ${durasiBulan} Bulan lagi)`
        };
    };

    const projRiil = getProjectionDate(lajuEfektif);
    const projTarget = getProjectionDate(targetPekan);
    const projAkselerasi = getProjectionDate(12);

    const elKhatamBulanTahun = document.getElementById('sorogan-estimasi-khatam-bulan-tahun');
    const elKhatamDurasi = document.getElementById('sorogan-estimasi-khatam-durasi');
    const elLajuText = document.getElementById('sorogan-estimasi-laju-text');
    const elLajuSub = document.getElementById('sorogan-estimasi-laju-sub');
    const elHalamanTuntas = document.getElementById('sorogan-estimasi-halaman-tuntas');
    const elSisaHalaman = document.getElementById('sorogan-estimasi-sisa-halaman');
    const elMeterBar = document.getElementById('sorogan-estimasi-meter-bar');

    if (elKhatamBulanTahun) elKhatamBulanTahun.innerText = projRiil.text;
    if (elKhatamDurasi) elKhatamDurasi.innerText = projRiil.durasiText;
    if (elLajuText) elLajuText.innerText = `${lajuEfektif.toFixed(1)} Hal / Pekan`;
    if (elLajuSub) elLajuSub.innerText = `${lajuBulanRiil.toFixed(1)} Hal / Bulan`;
    if (elHalamanTuntas) elHalamanTuntas.innerText = halamanTuntas;
    if (elSisaHalaman) elSisaHalaman.innerText = `Sisa ${sisaHalaman} Halaman`;
    if (elMeterBar) elMeterBar.style.width = `${persenMilestone}%`;

    const elSkenarioRiil = document.getElementById('sorogan-skenario-riil-date');
    const elSkenarioTarget = document.getElementById('sorogan-skenario-target-date');
    const elSkenarioAkselerasi = document.getElementById('sorogan-skenario-akselerasi-date');

    if (elSkenarioRiil) elSkenarioRiil.innerText = `${projRiil.text} ${projRiil.durasiText}`;
    if (elSkenarioTarget) elSkenarioTarget.innerText = `${projTarget.text} ${projTarget.durasiText}`;
    if (elSkenarioAkselerasi) elSkenarioAkselerasi.innerText = `${projAkselerasi.text} ${projAkselerasi.durasiText}`;
}

/**
 * Filter tanggal indikator harian sorogan
 */
function onChangeSoroganIndikatorDate(mode, val) {
    if (val && ASNSorogan.activeStudentDetail) {
        const riwayat = ASNSorogan.activeStudentDetail.riwayat || [];
        const dayLogs = riwayat.filter(r => r.tanggal === val);
        const dayHal = dayLogs.reduce((acc, cur) => acc + (Number(cur.totalHalaman) || 1), 0);

        const elIndHStatus = document.getElementById('sorogan-ind-harian-status');
        const elIndHReal = document.getElementById('sorogan-ind-harian-realita');
        if (elIndHStatus) {
            elIndHStatus.innerText = dayLogs.length > 0 ? "Ada Simakan" : "Belum Ada Simakan";
            elIndHStatus.className = dayLogs.length > 0
                ? "text-[9px] font-extrabold px-2 py-0.5 rounded bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                : "text-[9px] font-extrabold px-2 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300";
        }
        if (elIndHReal) elIndHReal.innerText = `${dayHal} Halaman (${dayLogs.length}x Simakan)`;
    }
}

/**
 * Preset tanggal indikator: today / yesterday
 */
function setSoroganIndikatorPreset(preset) {
    const elDate = document.getElementById('sorogan-date-harian');
    const d = new Date();
    if (preset === 'yesterday') {
        d.setDate(d.getDate() - 1);
    }
    const val = d.toISOString().split('T')[0];
    if (elDate) elDate.value = val;
    onChangeSoroganIndikatorDate('daily', val);
}

/**
 * Hapus catatan log simakan sorogan
 */
async function deleteSoroganSimakanLog(logId) {
    if (!logId) return;
    if (!confirm("Apakah Anda yakin ingin menghapus catatan simakan ini?")) return;

    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(SOROGAN_STORAGE_KEYS.adminToken)) || "";
        const res = await apiPost("deleteSoroganLog", { token, logId });
        if (res && (res.success || res.status === "success")) {
            if (typeof showToast === 'function') showToast("✅ Catatan simakan berhasil dihapus.");
            if (ASNSorogan.activeStudentDetail && ASNSorogan.activeStudentDetail.student) {
                openSoroganStudentDetail(ASNSorogan.activeStudentDetail.student.studentId);
            }
            loadAdminSoroganData(true);
        } else {
            if (typeof showToast === "function") showToast("❌ Gagal menghapus catatan: " + ((res && res.message) || "Terjadi kesalahan.")); else alert("Gagal menghapus catatan.");
        }
    } catch (e) {
        if (typeof showToast === "function") showToast("❌ Kesalahan jaringan saat menghapus catatan: " + e.message); else alert("Kesalahan jaringan: " + e.message);
    }
}

let soroganRiwayatViewMode = 'card';

/**
 * Ganti mode tampilan riwayat simakan sorogan: 'card' (optimal HP tanpa scroll) atau 'table' (tabel lengkap)
 */
function setSoroganRiwayatView(mode) {
    soroganRiwayatViewMode = mode || 'card';
    const cardList = document.getElementById('sorogan-detail-riwayat-card-list');
    const tableWrapper = document.getElementById('sorogan-detail-riwayat-table-wrapper');
    const btnCard = document.getElementById('btn-sorogan-riwayat-view-card');
    const btnTable = document.getElementById('btn-sorogan-riwayat-view-table');

    if (soroganRiwayatViewMode === 'card') {
        if (cardList) cardList.classList.remove('hidden');
        if (tableWrapper) tableWrapper.classList.add('hidden');
        if (btnCard) btnCard.className = "px-2.5 py-1 rounded-md text-[10px] font-bold transition bg-white dark:bg-[#15202d] text-sky-700 dark:text-sky-400 shadow-sm";
        if (btnTable) btnTable.className = "px-2.5 py-1 rounded-md text-[10px] font-bold transition text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200";
    } else {
        if (cardList) cardList.classList.add('hidden');
        if (tableWrapper) tableWrapper.classList.remove('hidden');
        if (btnTable) btnTable.className = "px-2.5 py-1 rounded-md text-[10px] font-bold transition bg-white dark:bg-[#15202d] text-sky-700 dark:text-sky-400 shadow-sm";
        if (btnCard) btnCard.className = "px-2.5 py-1 rounded-md text-[10px] font-bold transition text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200";
    }
}
window.setSoroganRiwayatView = setSoroganRiwayatView;

// ====================================================================
// EXPORT & PRINT SOROGAN
// ====================================================================

/**
 * Cetak Rapor Mutaba'ah Sorogan Santri
 */
function printSoroganStudentCard(studentId) {
    if (studentId) openSoroganStudentDetail(studentId);
    setTimeout(() => {
        window.print();
    }, 500);
}

/**
 * Cetak Rekapitulasi Sorogan
 */
function printSoroganRekap() {
    window.print();
}

/**
 * Ekspor Data Sorogan ke Excel (.xlsx) menggunakan SheetJS
 */
function exportSoroganDataXLSX() {
    const students = ASNSorogan.filteredStudents || (ASNSorogan.data && ASNSorogan.data.students) || [];
    if (students.length === 0) {
        if (typeof showToast === 'function') showToast("⚠️ Tidak ada data sorogan untuk diekspor.");
        else alert("Tidak ada data sorogan untuk diekspor.");
        return;
    }

    const doExport = () => {
        try {
            const headers = [
                "No", "NIS", "Nama Santri", "Gender", "Program",
                "Halaqah Sorogan", "Muallim Pengampu", "Juz Aktif", "Halaman Terakhir",
                "Target Juz", "Target Hal/Sesi", "Target Hal/Pekan",
                "Status Terakhir", "Terakhir Diperbarui"
            ];

            const weeklySessions = getSoroganActiveWeeklySessionCounts();
            const rows = students.map((st, idx) => {
                const tgt = (ASNSorogan.data.targets && ASNSorogan.data.targets[st.studentId]) || st.target || {};
                const tSesi = tgt.targetHalamanSesi || 2;
                const tPekan = tgt.targetHalamanPekan || (tSesi * weeklySessions);
                return [
                    idx + 1,
                    st.nis || "-",
                    st.name || "-",
                    st.gender === "P" ? "Perempuan" : "Laki-laki",
                    "Sorogan Al-Qur'an (Binnazhar)",
                    st.namaHalaqah || "-",
                    st.muallimPengampu || "-",
                    st.juzAktif || 1,
                    st.halamanTerakhir || 1,
                    tgt.targetJuz || 30,
                    tSesi,
                    tPekan,
                    st.statusTerakhir === 'ULANG' ? "Wajib Mengulang" : "Lancar (Lanjut)",
                    st.updatedAt ? st.updatedAt.substring(0, 10) : "-"
                ];
            });

            const wsData = [headers, ...rows];
            const ws = XLSX.utils.aoa_to_sheet(wsData);

            ws['!cols'] = [
                { wch: 5 },  // No
                { wch: 14 }, // NIS
                { wch: 28 }, // Nama
                { wch: 12 }, // Gender
                { wch: 28 }, // Program
                { wch: 24 }, // Halaqah
                { wch: 24 }, // Muallim
                { wch: 12 }, // Juz
                { wch: 16 }, // Halaman
                { wch: 12 }, // Target Juz
                { wch: 16 }, // Target Sesi
                { wch: 16 }, // Target Pekan
                { wch: 20 }, // Status Terakhir
                { wch: 18 }  // Update
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Rekap Sorogan Al-Qur'an");

            const dateStr = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `Rekap_Sorogan_Mubarokah_${dateStr}.xlsx`);
            if (typeof showToast === 'function') showToast("📥 Rekap Sorogan (.xlsx) berhasil diunduh!");
        } catch (err) {
            console.error("Gagal export XLSX:", err);
            exportSoroganDataCSVFallback();
        }
    };

    if (typeof XLSX !== 'undefined') {
        doExport();
    } else {
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
        script.onload = () => doExport();
        script.onerror = () => {
            console.warn("Gagal memuat SheetJS CDN, beralih ke format CSV...");
            exportSoroganDataCSVFallback();
        };
        document.head.appendChild(script);
    }
}

/**
 * Fallback Ekspor CSV
 */
function exportSoroganDataCSVFallback() {
    const students = ASNSorogan.filteredStudents || (ASNSorogan.data && ASNSorogan.data.students) || [];
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "No,NIS,Nama Santri,Gender,Halaqah,Muallim,Juz Aktif,Halaman Terakhir,Status Terakhir\n";

    students.forEach((st, idx) => {
        const row = [
            idx + 1,
            `"${st.nis || ''}"`,
            `"${st.name || ''}"`,
            `"${st.gender || 'L'}"`,
            `"${st.namaHalaqah || ''}"`,
            `"${st.muallimPengampu || ''}"`,
            st.juzAktif || 1,
            st.halamanTerakhir || 1,
            `"${st.statusTerakhir || 'LANJUT'}"`
        ].join(",");
        csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Rekap_Sorogan_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (typeof showToast === 'function') showToast("📥 Rekap Sorogan (.csv) berhasil diunduh.");
}

function exportSoroganDataCSV() {
    exportSoroganDataXLSX();
}

// Window global exports untuk Detail, Export & Print
window.openSoroganStudentDetail = openSoroganStudentDetail;
window.closeSoroganStudentDetail = closeSoroganStudentDetail;
window.switchSoroganDetailTab = switchSoroganDetailTab;
window.renderSoroganStudentDetailView = renderSoroganStudentDetailView;
window.renderSoroganEstimasiKhatam = renderSoroganEstimasiKhatam;
window.onChangeSoroganIndikatorDate = onChangeSoroganIndikatorDate;
window.setSoroganIndikatorPreset = setSoroganIndikatorPreset;
window.deleteSoroganSimakanLog = deleteSoroganSimakanLog;
window.printSoroganStudentCard = printSoroganStudentCard;
window.printSoroganRekap = printSoroganRekap;
window.exportSoroganDataXLSX = exportSoroganDataXLSX;
window.exportSoroganDataCSV = exportSoroganDataCSV;
window.cleanSoroganSesiTime = cleanSoroganSesiTime;
if (!window.cleanSesiTime) window.cleanSesiTime = cleanSoroganSesiTime;
window.setSoroganRiwayatView = setSoroganRiwayatView;
window.applySoroganRolePermissions = applySoroganRolePermissions;
window.getHalaqahForActiveMuallim = getHalaqahForActiveMuallim;
