/**
 * ====================================================================
 * MODUL FRONTEND: TPQ YANBU'A (JILID 1 S.D. 7)
 * PPTQ Roudlotul Mubarokah
 * ====================================================================
 * Fitur:
 * 1. Manajemen Bimbingan & Simakan Berjenjang Yanbu'a (Jilid 1 - 7)
 * 2. Posisi Aktif Halaman & Jilid Terkini Setiap Santri
 * 3. Quick Simak Mode (Lanjut, Ulang/I'adah, Naik Jilid, Khatam)
 * 4. Manajemen Kelas TPQ & Plotting Asatidz Pembimbing
 * 5. Integrasi SWR Caching & Auto-Sync Google Spreadsheet
 */

const TPQ_STORAGE_KEYS = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.storage && APP_CONFIG.storage.keys)
    ? APP_CONFIG.storage.keys
    : {
        adminToken: 'mubarokah_admin_token',
        parentToken: 'mubarokah_parent_token',
        pengasuhToken: 'mubarokah_pengasuh_token'
    };

/**
 * Helper pengambilan token autentikasi sesi yang tahan banting (sessionStorage & localStorage)
 */
function getTPQToken() {
    if (typeof getAdminSessionToken === 'function' && getAdminSessionToken !== getTPQToken) {
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

    if (typeof TPQ_STORAGE_KEYS !== 'undefined') {
        if (TPQ_STORAGE_KEYS.adminToken) candidateKeys.unshift(TPQ_STORAGE_KEYS.adminToken);
        if (TPQ_STORAGE_KEYS.pengasuhToken) candidateKeys.unshift(TPQ_STORAGE_KEYS.pengasuhToken);
    }
    if (typeof ASN_STORAGE_KEYS !== 'undefined') {
        if (ASN_STORAGE_KEYS.ADMIN_TOKEN) candidateKeys.unshift(ASN_STORAGE_KEYS.ADMIN_TOKEN);
        if (ASN_STORAGE_KEYS.PENGASUH_TOKEN) candidateKeys.unshift(ASN_STORAGE_KEYS.PENGASUH_TOKEN);
    }

    for (const key of candidateKeys) {
        if (!key) continue;
        try {
            const sVal = sessionStorage.getItem(key);
            if (sVal && typeof sVal === 'string' && sVal.trim()) return sVal.trim();
            const lVal = localStorage.getItem(key);
            if (lVal && typeof lVal === 'string' && lVal.trim()) return lVal.trim();
        } catch (err) {}
    }

    if (typeof ASNIdentity !== 'undefined' && ASNIdentity.currentUser && ASNIdentity.currentUser.token) {
        return ASNIdentity.currentUser.token;
    }
    if (typeof ASNAuth !== 'undefined' && ASNAuth.token) {
        return ASNAuth.token;
    }
    return "";
}

if (typeof window !== 'undefined' && typeof window.getAdminSessionToken !== 'function') {
    window.getAdminSessionToken = getTPQToken;
}

const ASNTPQ = {
    data: {
        summary: {
            totalSantri: 0,
            totalLanjut: 0,
            totalUlang: 0,
            persentaseLanjut: 100,
            distribusiJilid: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 }
        },
        students: [],
        kelasList: [],
        ustadzList: [],
        sesiList: [],
        targets: {}
    },
    filteredStudents: [],
    selectedStudentIds: new Set(),
    kelasActiveTab: 1,
    activePlottingKelas: null,
    activePlottingStudentIds: [],
    bulkTargetState: {
        scope: 'ALL',
        kelasId: '',
        jilid: '1',
        studentIds: []
    },
    cache: null,
    simakState: {
        studentId: "",
        studentName: "",
        nis: "",
        jilid: 1,
        halaman: 1,
        statusSetoran: "LANJUT",
        nilai: "MUMTAZ",
        ustadz: "",
        catatan: "",
        sesi: "Sore (15:45 - 17:00)"
    }
};

const TPQ_CACHE_KEY = 'mubarokah_tpq_dashboard_cache';
const TPQ_CACHE_TTL_MS = 5 * 60 * 1000; // 5 Menit

// Konfigurasi Resmi Jenjang & Halaman Kitab Yanbu'a (Pemula: 48, Jld 1: 44, Jld 2: 43, Jld 3: 44, Jld 4: 45, Jld 5: 46, Jld 6: 47, Jld 7: 39)
const YANBUA_JILID_INFO = {
    0: { name: "Pemula", jilid: 0, totalHalaman: 48, desc: "Huruf Hijaiyah & Harakat Dasar (Pemula)", badge: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900" },
    1: { name: "Jilid 1", jilid: 1, totalHalaman: 44, desc: "Huruf Hijaiyah Tunggal Fathah & Makhraj Dasar", badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900" },
    2: { name: "Jilid 2", jilid: 2, totalHalaman: 43, desc: "Huruf Bersambung & Mad Thabi'i Dasar", badge: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-900" },
    3: { name: "Jilid 3", jilid: 3, totalHalaman: 44, desc: "Kasrah, Dhammah, Sukun & Tanwin", badge: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-900" },
    4: { name: "Jilid 4", jilid: 4, totalHalaman: 45, desc: "Tasydid, Ikhfa', Iqlab, Idgham & Alif Lam", badge: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900" },
    5: { name: "Jilid 5", jilid: 5, totalHalaman: 46, desc: "Waqaf, Ibtida' & Tanda Baca Mushaf", badge: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-900" },
    6: { name: "Jilid 6", jilid: 6, totalHalaman: 47, desc: "Gharib & Musykilat Bacaan Al-Qur'an", badge: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-900" },
    7: { name: "Jilid 7", jilid: 7, totalHalaman: 39, desc: "Kaidah Tajwid Lengkap & Pra Al-Qur'an", badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900" }
};
YANBUA_JILID_INFO["pemula"] = YANBUA_JILID_INFO[0];
YANBUA_JILID_INFO["Pemula"] = YANBUA_JILID_INFO[0];

const TOTAL_YANBUA_PAGES = 48 + 44 + 43 + 44 + 45 + 46 + 47 + 39; // 356 Halaman Total

function getYanbuaJilidMaxPages(jilid) {
    if (jilid === 0 || String(jilid).toLowerCase() === "pemula") return 48;
    const num = Number(jilid);
    if (YANBUA_JILID_INFO[num]) return YANBUA_JILID_INFO[num].totalHalaman;
    return 44;
}
window.getYanbuaJilidMaxPages = getYanbuaJilidMaxPages;

function getYanbuaCumulativePages(jilid, halaman) {
    let jKey = 1;
    if (jilid === 0 || String(jilid).toLowerCase() === "pemula") jKey = 0;
    else jKey = Number(jilid) || 1;

    const hal = Number(halaman) || 1;
    const pageMap = [48, 44, 43, 44, 45, 46, 47, 39];
    let cumulative = 0;
    for (let i = 0; i < jKey && i < pageMap.length; i++) {
        cumulative += pageMap[i];
    }
    const maxInJilid = (jKey >= 0 && jKey < pageMap.length) ? pageMap[jKey] : 44;
    cumulative += Math.min(maxInJilid, Math.max(1, hal));
    return Math.min(TOTAL_YANBUA_PAGES, cumulative);
}
window.getYanbuaCumulativePages = getYanbuaCumulativePages;

/**
 * Hitung jumlah sesi aktif per pekan untuk TPQ berdasarkan ASNTPQ.data.sesiList
 * (Contoh: Sesi Pagi 5 hari + Sesi Sore 6 hari = 11 sesi per pekan)
 */
function getTPQActiveWeeklySessionCounts() {
    let sesiList = (ASNTPQ.data && ASNTPQ.data.sesiList) || [];
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
window.getTPQActiveWeeklySessionCounts = getTPQActiveWeeklySessionCounts;

function updateTPQSimakMaxHalaman(jilid) {
    const elHalaman = document.getElementById('tpq-simak-modal-halaman');
    if (elHalaman) {
        const maxHal = getYanbuaJilidMaxPages(jilid);
        elHalaman.max = maxHal;
        if (Number(elHalaman.value) > maxHal) {
            elHalaman.value = maxHal;
        }
    }
}
window.updateTPQSimakMaxHalaman = updateTPQSimakMaxHalaman;

/**
 * Normalisasi format waktu menjadi HH:mm yang bersih (misal 15:45, 05:00)
 * Mencegah string panjang Date Google Sheets (misal Sat Dec 30 1899 ...)
 */
function formatTPQTime(val, defaultVal = "15:45") {
    if (!val && val !== 0) return defaultVal;
    if (val instanceof Date && !isNaN(val.getTime())) {
        const hh = String(val.getHours()).padStart(2, "0");
        const mm = String(val.getMinutes()).padStart(2, "0");
        return `${hh}:${mm}`;
    }
    const s = String(val).trim();
    if (/^\d{1,2}:\d{2}$/.test(s)) {
        const parts = s.split(":");
        return `${parts[0].padStart(2, "0")}:${parts[1]}`;
    }
    const match = s.match(/(?:(?:1899|1900|\d{4})[^\d]+)?(\d{1,2}):(\d{2})(?::\d{2})?/);
    if (match) {
        return `${match[1].padStart(2, "0")}:${match[2].padStart(2, "0")}`;
    }
    return s || defaultVal;
}

/**
 * Muat data lengkap dashboard TPQ Yanbu'a dengan pola SWR (Stale-While-Revalidate)
 */
async function loadAdminTPQData(forceRefresh = false) {
    const loader = document.getElementById('admin-tpq-loader');
    const tableBody = document.getElementById('admin-tpq-table-body');
    const emptyState = document.getElementById('admin-tpq-empty');
    const refreshIcon = document.getElementById('btn-refresh-tpq-icon');

    if (refreshIcon && forceRefresh) {
        refreshIcon.classList.add('fa-spin');
    }

    let hasRenderedFromCache = false;
    if (!forceRefresh) {
        let cached = ASNTPQ.cache;
        if (!cached) {
            try {
                const stored = sessionStorage.getItem(TPQ_CACHE_KEY);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (parsed && parsed.data && (Date.now() - (parsed.timestamp || 0) < TPQ_CACHE_TTL_MS)) {
                        cached = parsed.data;
                        ASNTPQ.cache = cached;
                    }
                }
            } catch (e) {
                console.warn("Gagal membaca cache TPQ:", e);
            }
        }

        if (cached && (cached.success || cached.status === "success") && Array.isArray(cached.students)) {
            ASNTPQ.data = cached;
            renderTPQSummaryCards();
            populateTPQFilters();
            filterTPQList();
            hasRenderedFromCache = true;
            if (emptyState && ASNTPQ.filteredStudents.length > 0) {
                emptyState.classList.add('hidden');
            }
        }
    }

    if (!hasRenderedFromCache) {
        if (loader) loader.classList.remove('hidden');
        if (emptyState) emptyState.classList.add('hidden');
    }

    try {
        const token = getTPQToken();
        let response;
        try {
            response = await apiPost("getTPQDashboard", { token });
        } catch (apiErr) {
            response = await apiPost("getTPQDashboard", {});
        }

        if (response && (response.success || response.status === "success")) {
            ASNTPQ.data = response;
            ASNTPQ.cache = response;
            try {
                sessionStorage.setItem(TPQ_CACHE_KEY, JSON.stringify({ data: response, timestamp: Date.now() }));
            } catch (e) {}

            renderTPQSummaryCards();
            populateTPQFilters();
            filterTPQList();
        } else {
            console.warn("Respon TPQ kosong atau tidak sukses:", response);
        }
    } catch (err) {
        console.error("Gagal sinkronisasi data TPQ dari server:", err);
    } finally {
        if (loader) loader.classList.add('hidden');
        if (refreshIcon) refreshIcon.classList.remove('fa-spin');
    }
}

/**
 * Render kartu ringkasan statistik TPQ
 */
function renderTPQSummaryCards() {
    const sum = ASNTPQ.data.summary || {};
    const dist = sum.distribusiJilid || {};

    const elTotal = document.getElementById('tpq-stat-total-santri');
    const elLanjut = document.getElementById('tpq-stat-total-lanjut');
    const elUlang = document.getElementById('tpq-stat-total-ulang');
    const elPersen = document.getElementById('tpq-stat-persentase-lanjut');
    const elDistBar = document.getElementById('tpq-stat-distribusi-container');

    if (elTotal) elTotal.innerText = sum.totalSantri || 0;
    if (elLanjut) elLanjut.innerText = sum.totalLanjut || 0;
    if (elUlang) elUlang.innerText = sum.totalUlang || 0;
    if (elPersen) elPersen.innerText = `${sum.persentaseLanjut || 100}%`;

    // Render bar jilid mini
    if (elDistBar) {
        let html = '';
        for (let j = 0; j <= 7; j++) {
            const count = dist[j] || 0;
            const jInfo = YANBUA_JILID_INFO[j] || { name: (j === 0 ? "Pemula" : `Jilid ${j}`) };
            html += `
                <div class="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50 dark:bg-[#1c2836] border border-slate-100 dark:border-[#253447] text-center min-w-[70px]">
                    <span class="text-[10px] font-bold text-slate-500 dark:text-slate-400">${jInfo.name}</span>
                    <span class="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">${count}</span>
                    <span class="text-[9px] text-slate-400">Santri</span>
                </div>
            `;
        }
        elDistBar.innerHTML = html;
    }
}

/**
 * Isi dropdown filter kelas & jilid
 */
function populateTPQFilters() {
    const filterKelas = document.getElementById('tpq-filter-kelas');
    if (filterKelas && Array.isArray(ASNTPQ.data.kelasList)) {
        const currentVal = filterKelas.value;
        let opt = '<option value="ALL">Semua Kelas TPQ</option>';
        ASNTPQ.data.kelasList.forEach(k => {
            opt += `<option value="${escapeHtml(k.kelasId)}">${escapeHtml(k.namaKelas)}</option>`;
        });
        filterKelas.innerHTML = opt;
        if (currentVal) filterKelas.value = currentVal;
    }
}

/**
 * Filter santri berdasarkan search, kelas, jilid, dan status
 */
function filterTPQList() {
    const searchInput = document.getElementById('tpq-search-input');
    const filterKelas = document.getElementById('tpq-filter-kelas');
    const filterJilid = document.getElementById('tpq-filter-jilid');
    const filterStatus = document.getElementById('tpq-filter-status');

    const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
    const selKelas = filterKelas ? filterKelas.value : "ALL";
    const selJilid = filterJilid ? filterJilid.value : "ALL";
    const selStatus = filterStatus ? filterStatus.value : "ALL";

    const all = ASNTPQ.data.students || [];

    ASNTPQ.filteredStudents = all.filter(st => {
        // Search
        if (query) {
            const matchName = (st.name || "").toLowerCase().includes(query);
            const matchNis = (st.nis || "").toLowerCase().includes(query);
            const matchKelas = (st.namaKelas || "").toLowerCase().includes(query);
            const matchUstadz = (st.ustadzPengampu || "").toLowerCase().includes(query);
            if (!matchName && !matchNis && !matchKelas && !matchUstadz) return false;
        }

        // Kelas
        if (selKelas !== "ALL") {
            if (st.kelasId !== selKelas) return false;
        }

        // Jilid
        if (selJilid !== "ALL") {
            if (String(st.jilidAktif) !== String(selJilid)) return false;
        }

        // Status
        if (selStatus !== "ALL") {
            if (st.statusTerakhir !== selStatus) return false;
        }

        return true;
    });

    renderTPQTable();
}

/**
 * Multi-select santri TPQ
 */
function toggleSelectAllTPQStudents(checked) {
    if (!ASNTPQ.selectedStudentIds) {
        ASNTPQ.selectedStudentIds = new Set();
    }
    const currentStudents = (ASNTPQ.filteredStudents && ASNTPQ.filteredStudents.length > 0)
        ? ASNTPQ.filteredStudents
        : (ASNTPQ.data.students || []);

    currentStudents.forEach(st => {
        if (st && st.studentId) {
            if (checked) {
                ASNTPQ.selectedStudentIds.add(st.studentId);
            } else {
                ASNTPQ.selectedStudentIds.delete(st.studentId);
            }
        }
    });

    document.querySelectorAll('.tpq-row-checkbox').forEach(cb => {
        cb.checked = checked;
    });

    updateTPQBulkSelectionBar();
}

function toggleSelectTPQStudent(studentId, checked) {
    if (!ASNTPQ.selectedStudentIds) {
        ASNTPQ.selectedStudentIds = new Set();
    }
    if (checked) {
        ASNTPQ.selectedStudentIds.add(studentId);
    } else {
        ASNTPQ.selectedStudentIds.delete(studentId);
    }
    updateTPQBulkSelectionBar();
}

function clearTPQSelectedStudents() {
    if (ASNTPQ.selectedStudentIds) {
        ASNTPQ.selectedStudentIds.clear();
    }
    document.querySelectorAll('.tpq-row-checkbox').forEach(cb => {
        cb.checked = false;
    });
    const checkAll = document.getElementById('tpq-check-all');
    if (checkAll) {
        checkAll.checked = false;
        checkAll.indeterminate = false;
    }
    updateTPQBulkSelectionBar();
}

function updateTPQBulkSelectionBar() {
    const bar = document.getElementById('tpq-bulk-selection-bar');
    const textEl = document.getElementById('tpq-selected-count-text');
    const checkAll = document.getElementById('tpq-check-all');
    const count = ASNTPQ.selectedStudentIds ? ASNTPQ.selectedStudentIds.size : 0;
    const totalVisible = (ASNTPQ.filteredStudents || []).length;

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
 * Render tabel daftar capaian santri TPQ (Desktop Table & Mobile Card List tanpa scroll kanan)
 */
function renderTPQTable() {
    const tbody = document.getElementById('admin-tpq-table-body');
    const mobileContainer = document.getElementById('admin-tpq-mobile-list');
    const emptyState = document.getElementById('admin-tpq-empty');
    const countEl = document.getElementById('admin-tpq-count');

    const list = ASNTPQ.filteredStudents || [];

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

    const selectedSet = ASNTPQ.selectedStudentIds || new Set();
    const targets = (ASNTPQ.data && ASNTPQ.data.targets) || {};

    let html = '';
    list.forEach((st, idx) => {
        const jInfo = YANBUA_JILID_INFO[st.jilidAktif] || { name: `Jilid ${st.jilidAktif}`, badge: "bg-slate-50 text-slate-700 border-slate-200" };
        const isUlang = st.statusTerakhir === 'ULANG';
        const isChecked = selectedSet.has(st.studentId);

        const statusBadge = isUlang
            ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300"><i class="fa-solid fa-rotate-left"></i> Wajib Mengulang</span>`
            : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300"><i class="fa-solid fa-circle-check"></i> Lancar (Lanjut)</span>`;

        // Target Info
        const tgt = targets[st.studentId] || st.target || {
            targetJilid: Math.min(7, (st.jilidAktif || 1) + 1),
            targetHalamanSesi: 1
        };

        html += `
            <tr class="hover:bg-slate-50/80 dark:hover:bg-[#1a2636]/60 transition border-b border-slate-100 dark:border-[#202f42] text-xs">
                <td class="p-3 text-center">
                    <input type="checkbox" class="tpq-row-checkbox rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                        ${isChecked ? 'checked' : ''} onchange="toggleSelectTPQStudent('${escapeHtml(st.studentId)}', this.checked)">
                </td>
                <td class="p-3 text-center text-slate-400 font-medium">${idx + 1}</td>
                <td class="p-3">
                    <div class="flex items-center space-x-2.5">
                        <div onclick="openTPQStudentDetail('${escapeHtml(st.studentId)}')" class="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 font-bold flex items-center justify-center shrink-0 border border-teal-200 dark:border-teal-800/40 cursor-pointer" title="Lihat Mutaba'ah">
                            ${st.photoUrl ? `<img src="${escapeHtml(st.photoUrl)}" class="w-full h-full rounded-full object-cover">` : `<i class="fa-solid fa-user text-xs"></i>`}
                        </div>
                        <div>
                            <div onclick="openTPQStudentDetail('${escapeHtml(st.studentId)}')" class="font-bold text-slate-800 dark:text-slate-100 leading-snug cursor-pointer hover:text-teal-600 transition" title="Lihat Rapor Mutaba'ah">${escapeHtml(st.name)}</div>
                            <div class="text-[10px] text-slate-400">NIS: ${escapeHtml(st.nis || "-")} • ${st.gender === 'P' ? 'Santriwati' : 'Santri'}</div>
                        </div>
                    </div>
                </td>
                <td class="p-3">
                    <div class="flex flex-col gap-1">
                        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black border ${jInfo.badge} w-fit">
                            <i class="fa-solid fa-book-open-reader text-xs"></i>
                            <span>${jInfo.name}</span>
                        </span>
                        <span class="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                            Halaman <strong class="text-teal-600 dark:text-teal-400 font-black text-sm">${st.halamanAktif || 1}</strong> <span class="text-[10px] text-slate-400 font-normal">/ ${jInfo.totalHalaman || 44}</span>
                        </span>
                    </div>
                </td>
                <td class="p-3">
                    <button type="button" onclick="openTPQTargetModal('${escapeHtml(st.studentId)}')"
                        class="text-left group/tgt hover:opacity-80 transition" title="Klik untuk ubah target">
                        <div class="flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200">
                            <i class="fa-solid fa-bullseye text-[10px] text-amber-500"></i>
                            <span>${(tgt.targetJilid === 0 || String(tgt.targetJilid).toLowerCase() === 'pemula') ? 'Pemula' : `Jilid ${tgt.targetJilid || Math.min(7, (st.jilidAktif || 1) + 1)}`}</span>
                        </div>
                        <div class="text-[10px] text-slate-400 group-hover/tgt:text-teal-600 font-medium">
                            ${tgt.targetHalamanSesi || 1} Hal/Sesi (${Math.round((tgt.targetHalamanSesi || 1) * getTPQActiveWeeklySessionCounts() * 10) / 10} Hal/Pekan)
                        </div>
                    </button>
                </td>
                <td class="p-3">
                    <div class="text-xs font-semibold text-slate-700 dark:text-slate-200">${escapeHtml(st.namaKelas || "Belum Ada Kelas")}</div>
                    <div class="text-[10px] text-slate-400">Pengampu: ${escapeHtml(st.ustadzPengampu || "-")}</div>
                </td>
                <td class="p-3">
                    ${statusBadge}
                    ${st.updatedAt ? `<div class="text-[9px] text-slate-400 mt-1">Terakhir: ${st.updatedAt.substring(0, 10)}</div>` : ''}
                </td>
                <td class="p-3 text-right">
                    <div class="flex items-center justify-end gap-1.5">
                        <button type="button" onclick="openTPQTargetModal('${escapeHtml(st.studentId)}')"
                            class="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-[#1c2836] dark:hover:bg-[#253447] dark:text-slate-300 rounded-xl text-xs transition" title="Atur Target">
                            <i class="fa-solid fa-bullseye text-amber-600"></i>
                        </button>
                        <button type="button" onclick="openTPQStudentDetail('${escapeHtml(st.studentId)}')"
                            class="w-7 h-7 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1c2836] dark:hover:bg-[#253447] text-slate-600 dark:text-slate-300 flex items-center justify-center transition active:scale-95" title="Detail Riwayat & Mutaba'ah">
                            <i class="fa-solid fa-clock-rotate-left text-xs"></i>
                        </button>
                        <button type="button" onclick="openSimakTPQModal('${escapeHtml(st.studentId)}')"
                            class="px-2.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs shadow-sm transition active:scale-95 inline-flex items-center gap-1">
                            <i class="fa-solid fa-pen-nib text-[10px]"></i>
                            <span>Simak</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    if (tbody) tbody.innerHTML = html;

    // Render Compact Card List untuk Tampilan Mobile (Tidak Perlu Scroll Kanan)
    if (mobileContainer) {
        mobileContainer.innerHTML = list.map(st => {
            const initials = (st.name || 'Santri').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'SN';
            const inKls = !!(st.namaKelas && st.namaKelas !== 'Belum Ada Kelas' && st.namaKelas !== 'Belum Ditentukan');
            const klsName = inKls ? st.namaKelas : 'Belum Masuk Kelas';
            const isUlang = st.statusTerakhir === 'ULANG';
            const jInfo = YANBUA_JILID_INFO[st.jilidAktif] || { name: (st.jilidAktif === 0 ? 'Pemula' : `Jilid ${st.jilidAktif}`), totalHalaman: 44, badge: "bg-slate-50 text-slate-700 border-slate-200" };
            const tgt = targets[st.studentId] || st.target || {
                targetJilid: Math.min(7, (st.jilidAktif || 1) + 1),
                targetHalamanSesi: 1
            };
            const targetSesi = tgt.targetHalamanSesi || 1;
            const weeklySessions = getTPQActiveWeeklySessionCounts();
            const targetPekan = Math.round(targetSesi * weeklySessions * 10) / 10;
            const isSelected = selectedSet.has(st.studentId);

            const statusBadge = isUlang
                ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300"><i class="fa-solid fa-rotate-left"></i> Mengulang</span>`
                : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300"><i class="fa-solid fa-circle-check"></i> Lancar</span>`;

            return `
            <div class="p-3.5 bg-white dark:bg-[#15202d] rounded-2xl border ${isSelected ? 'border-amber-400 dark:border-amber-600 bg-amber-50/20' : 'border-slate-100 dark:border-[#253447]'} shadow-sm space-y-2.5">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-2.5 min-w-0">
                        <input type="checkbox" onchange="toggleSelectTPQStudent('${escapeHtml(st.studentId)}', this.checked)" ${isSelected ? 'checked' : ''} class="tpq-row-checkbox rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer shrink-0" title="Pilih ${escapeHtml(st.name || '')}">
                        <div onclick="openTPQStudentDetail('${escapeHtml(st.studentId)}')" class="w-9 h-9 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 font-extrabold flex items-center justify-center text-xs shrink-0 cursor-pointer" title="Lihat Mutaba'ah">
                            ${st.photoUrl ? `<img src="${escapeHtml(st.photoUrl)}" class="w-full h-full object-cover rounded-full">` : initials}
                        </div>
                        <div class="min-w-0">
                            <h4 onclick="openTPQStudentDetail('${escapeHtml(st.studentId)}')" class="font-bold text-xs text-slate-800 dark:text-slate-100 truncate cursor-pointer hover:text-teal-600 transition">${escapeHtml(st.name)}</h4>
                            <p class="text-[10px] text-slate-400">NIS: ${escapeHtml(st.nis || '-')} • <span class="${inKls ? 'text-teal-600 dark:text-teal-400 font-semibold' : 'text-amber-600 dark:text-amber-400 font-semibold'}">${escapeHtml(klsName)}</span></p>
                        </div>
                    </div>
                    <button type="button" onclick="openSimakTPQModal('${escapeHtml(st.studentId)}')" class="px-2.5 py-1.5 bg-teal-600 text-white font-bold text-xs rounded-xl shadow-sm active:scale-95 transition shrink-0 inline-flex items-center gap-1">
                        <i class="fa-solid fa-pen-nib text-[10px]"></i>
                        <span>Simak</span>
                    </button>
                </div>

                <!-- Posisi Jilid & Status Pill Row -->
                <div class="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-[#253447]">
                    <div class="flex items-center gap-2">
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-black border ${jInfo.badge}">
                            <i class="fa-solid fa-book-open-reader text-[10px]"></i>
                            <span>${jInfo.name}</span>
                        </span>
                        <span class="text-xs font-bold text-slate-700 dark:text-slate-200">
                            Hal <strong class="text-teal-600 dark:text-teal-400 font-black">${st.halamanAktif || 1}</strong> <span class="text-[10px] text-slate-400 font-normal">/ ${jInfo.totalHalaman || 44}</span>
                        </span>
                    </div>
                    <div>
                        ${statusBadge}
                    </div>
                </div>

                <!-- Target Pills Row -->
                <div class="flex items-center justify-between text-[10px] font-bold pt-0.5">
                    <div class="flex items-center gap-1.5">
                        <span onclick="openTPQTargetModal('${escapeHtml(st.studentId)}')" class="px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 cursor-pointer border border-teal-200/50">
                            Target: ${targetSesi} Hal/Sesi (${targetPekan} Hal/Pekan)
                        </span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <button type="button" onclick="openTPQTargetModal('${escapeHtml(st.studentId)}')" class="p-1.5 bg-slate-100 dark:bg-[#1c2836] text-slate-600 dark:text-slate-300 rounded-lg text-xs" title="Atur Target">
                            <i class="fa-solid fa-bullseye text-amber-500"></i>
                        </button>
                        <button type="button" onclick="openTPQStudentDetail('${escapeHtml(st.studentId)}')" class="p-1.5 bg-slate-100 dark:bg-[#1c2836] text-slate-600 dark:text-slate-300 rounded-lg text-xs" title="Detail Riwayat & Mutaba'ah">
                            <i class="fa-solid fa-clock-rotate-left text-teal-600"></i>
                        </button>
                    </div>
                </div>

                <!-- Footer Link Mutaba'ah Lengkap -->
                <div class="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-[#253447] text-[10px] text-slate-400">
                    <span>Terakhir: ${jInfo.name} Hal ${st.halamanAktif || 1} • ${isUlang ? '<span class="text-rose-600 font-extrabold">Wajib Ulang</span>' : '<span class="text-teal-600 font-bold">Lancar</span>'}</span>
                    <button type="button" onclick="openTPQStudentDetail('${escapeHtml(st.studentId)}')" class="text-teal-600 font-bold hover:underline inline-flex items-center gap-1">
                        <span>Lihat Mutaba'ah</span>
                        <i class="fa-solid fa-chevron-right text-[9px]"></i>
                    </button>
                </div>
            </div>
            `;
        }).join('');
    }

    updateTPQBulkSelectionBar();
}

/**
 * Buka modal Quick Simak untuk santri terpilih
 */
function openSimakTPQModal(studentId) {
    const st = (ASNTPQ.data.students || []).find(s => s.studentId === studentId);
    if (!st) return;

    const initJilid = (st.jilidAktif === 0 || String(st.jilidAktif).toLowerCase() === "pemula") ? 0 : (Number(st.jilidAktif) || 1);
    ASNTPQ.simakState = {
        studentId: st.studentId,
        studentName: st.name,
        nis: st.nis || "",
        jilid: initJilid,
        halaman: st.halamanAktif || 1,
        statusSetoran: "LANJUT",
        nilai: "MUMTAZ",
        ustadz: st.ustadzPengampu && st.ustadzPengampu !== "-" ? st.ustadzPengampu : "Ustadz/Ustadzah",
        catatan: "",
        sesi: "Sore (15:45 - 17:00)",
        kelasId: st.kelasId || "",
        namaKelas: st.namaKelas || ""
    };

    // Populate modal form elements
    const elName = document.getElementById('tpq-simak-modal-name');
    const elNis = document.getElementById('tpq-simak-modal-nis');
    const elJilid = document.getElementById('tpq-simak-modal-jilid');
    const elHalaman = document.getElementById('tpq-simak-modal-halaman');
    const elUstadz = document.getElementById('tpq-simak-modal-ustadz');
    const elCatatan = document.getElementById('tpq-simak-modal-catatan');
    const elTanggal = document.getElementById('tpq-simak-modal-tanggal');
    const elSesi = document.getElementById('tpq-simak-modal-sesi');

    if (elName) elName.innerText = st.name;
    if (elNis) elNis.innerText = `NIS: ${st.nis || "-"}`;
    if (elJilid) {
        elJilid.value = String(ASNTPQ.simakState.jilid);
        updateTPQSimakMaxHalaman(ASNTPQ.simakState.jilid);
    }
    if (elHalaman) elHalaman.value = ASNTPQ.simakState.halaman;
    if (elUstadz) elUstadz.value = ASNTPQ.simakState.ustadz;
    if (elCatatan) elCatatan.value = "";

    // Set Tanggal hari ini
    if (elTanggal) {
        const todayStr = new Date().toISOString().substring(0, 10);
        elTanggal.value = todayStr;
    }

    // Populate opsi sesi waktu
    if (elSesi) {
        let sesiOptions = '';
        const sesiArr = (ASNTPQ.data && ASNTPQ.data.sesiList && ASNTPQ.data.sesiList.length > 0)
            ? ASNTPQ.data.sesiList.filter(s => (s.status || '').includes('Aktif'))
            : [];

        if (sesiArr.length > 0) {
            sesiArr.forEach(s => {
                const jmMulai = formatTPQTime(s.jamMulai, '15:45');
                const jmSelesai = formatTPQTime(s.jamSelesai, '17:00');
                const timeLabel = (jmMulai && jmSelesai) ? ` (${jmMulai} - ${jmSelesai} WIB)` : '';
                sesiOptions += `<option value="${escapeHtml(s.namaSesi)}">${escapeHtml(s.namaSesi + timeLabel)}</option>`;
            });
        } else {
            sesiOptions = `
                <option value="Sore (15:45 - 17:00)">Sore (15:45 - 17:00 WIB)</option>
                <option value="Pagi (08:30 - 10:00)">Pagi (08:30 - 10:00 WIB)</option>
                <option value="Malam (18:30 - 19:30)">Malam (18:30 - 19:30 WIB)</option>
            `;
        }
        elSesi.innerHTML = sesiOptions;

        // Auto-select berdasarkan jam saat ini
        const curHour = new Date().getHours();
        if (curHour >= 6 && curHour < 12) {
            const opt = Array.from(elSesi.options).find(o => o.value.toLowerCase().includes('pagi'));
            if (opt) elSesi.value = opt.value;
        } else if (curHour >= 12 && curHour < 18) {
            const opt = Array.from(elSesi.options).find(o => o.value.toLowerCase().includes('sore'));
            if (opt) elSesi.value = opt.value;
        } else {
            const opt = Array.from(elSesi.options).find(o => o.value.toLowerCase().includes('malam'));
            if (opt) elSesi.value = opt.value;
        }
    }

    selectTPQQuickStatus("LANJUT");
    selectTPQQuickNilai("MUMTAZ");

    const modal = document.getElementById('modal-simak-tpq');
    if (modal) modal.classList.remove('hidden');
}

function closeSimakTPQModal() {
    const modal = document.getElementById('modal-simak-tpq');
    if (modal) modal.classList.add('hidden');
}

/**
 * Tombol cepat pilih status simakan dengan penanganan kontras warna & teks yang presisi
 */
function selectTPQQuickStatus(status) {
    ASNTPQ.simakState.statusSetoran = status;

    const statusConfig = {
        LANJUT: {
            activeClass: 'bg-emerald-600 border-emerald-600 text-white shadow-sm ring-2 ring-emerald-400/50',
            iconClass: 'fa-solid fa-circle-check text-white text-sm',
            textClass: 'font-bold text-white',
            help: '<span class="text-emerald-600 dark:text-emerald-400 font-semibold"><i class="fa-solid fa-circle-check mr-1"></i> Bacaan lancar. Santri akan lanjut ke halaman berikutnya (+1 hal).</span>'
        },
        ULANG: {
            activeClass: 'bg-rose-600 border-rose-600 text-white shadow-sm ring-2 ring-rose-400/50',
            iconClass: 'fa-solid fa-rotate-left text-white text-sm',
            textClass: 'font-bold text-white',
            help: '<span class="text-rose-600 dark:text-rose-400 font-semibold"><i class="fa-solid fa-rotate-left mr-1"></i> Perlu latihan. Santri mengulang halaman yang sama pada sesi berikutnya.</span>'
        },
        NAIK_JILID: {
            activeClass: 'bg-amber-600 border-amber-600 text-white shadow-sm ring-2 ring-amber-400/50',
            iconClass: 'fa-solid fa-award text-white text-sm',
            textClass: 'font-bold text-white',
            help: '<span class="text-amber-600 dark:text-amber-400 font-semibold"><i class="fa-solid fa-award mr-1"></i> Naik Jilid! Santri otomatis promosi ke Jilid berikutnya Halaman 1.</span>'
        },
        KHATAM_YANBUA: {
            activeClass: 'bg-purple-600 border-purple-600 text-white shadow-sm ring-2 ring-purple-400/50',
            iconClass: 'fa-solid fa-crown text-white text-sm',
            textClass: 'font-bold text-white',
            help: '<span class="text-purple-600 dark:text-purple-400 font-semibold"><i class="fa-solid fa-crown mr-1"></i> Barakallah! Santri telah khatam seluruh 7 Jilid Yanbu\'a dan siap naik ke Sorogan Al-Qur\'an.</span>'
        }
    };

    const inactiveClass = 'bg-white dark:bg-[#1c2836] border-slate-200 dark:border-[#253447] text-slate-700 dark:text-slate-300';

    document.querySelectorAll('.tpq-btn-status').forEach(btn => {
        const btnStatus = btn.dataset.status;
        const icon = btn.querySelector('i');
        const textSpan = btn.querySelector('span');

        // Reset all classes
        btn.className = 'tpq-btn-status py-2.5 px-2 rounded-xl border text-xs flex flex-col items-center gap-1 transition active:scale-95';

        if (btnStatus === status && statusConfig[status]) {
            btn.className += ' ' + statusConfig[status].activeClass;
            if (icon) icon.className = statusConfig[status].iconClass;
            if (textSpan) textSpan.className = statusConfig[status].textClass + ' truncate';
        } else {
            btn.className += ' ' + inactiveClass;
            if (icon) {
                if (btnStatus === 'LANJUT') icon.className = 'fa-solid fa-circle-check text-emerald-500 text-sm';
                else if (btnStatus === 'ULANG') icon.className = 'fa-solid fa-rotate-left text-rose-500 text-sm';
                else if (btnStatus === 'NAIK_JILID') icon.className = 'fa-solid fa-award text-amber-500 text-sm';
                else if (btnStatus === 'KHATAM_YANBUA') icon.className = 'fa-solid fa-crown text-purple-500 text-sm';
            }
            if (textSpan) textSpan.className = 'font-semibold truncate text-slate-700 dark:text-slate-300';
        }
    });

    const labelHelp = document.getElementById('tpq-simak-status-help');
    if (labelHelp && statusConfig[status]) {
        labelHelp.innerHTML = statusConfig[status].help;
    }
}

/**
 * Tombol cepat pilih nilai
 */
function selectTPQQuickNilai(nilai) {
    ASNTPQ.simakState.nilai = nilai;
    document.querySelectorAll('.tpq-btn-nilai').forEach(btn => {
        if (btn.dataset.nilai === nilai) {
            btn.classList.add('bg-emerald-600', 'text-white', 'font-bold');
            btn.classList.remove('bg-slate-100', 'text-slate-700');
        } else {
            btn.classList.remove('bg-emerald-600', 'text-white', 'font-bold');
            btn.classList.add('bg-slate-100', 'text-slate-700');
        }
    });
}

/**
 * Simpan hasil simakan ke backend
 */
async function submitSimakTPQ(e) {
    if (e && e.preventDefault) e.preventDefault();

    const btn = document.getElementById('btn-submit-simak-tpq');
    const elJilid = document.getElementById('tpq-simak-modal-jilid');
    const elHalaman = document.getElementById('tpq-simak-modal-halaman');
    const elUstadz = document.getElementById('tpq-simak-modal-ustadz');
    const elCatatan = document.getElementById('tpq-simak-modal-catatan');
    const elTanggal = document.getElementById('tpq-simak-modal-tanggal');
    const elSesi = document.getElementById('tpq-simak-modal-sesi');

    const payload = {
        studentId: ASNTPQ.simakState.studentId,
        studentName: ASNTPQ.simakState.studentName,
        nis: ASNTPQ.simakState.nis,
        jilid: elJilid ? Number(elJilid.value) : ASNTPQ.simakState.jilid,
        halaman: elHalaman ? Number(elHalaman.value) : ASNTPQ.simakState.halaman,
        statusSetoran: ASNTPQ.simakState.statusSetoran,
        nilai: ASNTPQ.simakState.nilai,
        ustadz: elUstadz ? elUstadz.value.trim() : ASNTPQ.simakState.ustadz,
        catatan: elCatatan ? elCatatan.value.trim() : "",
        tanggal: elTanggal && elTanggal.value ? elTanggal.value : new Date().toISOString().substring(0, 10),
        sesi: elSesi && elSesi.value ? elSesi.value : "Sore (15:45 - 17:00)",
        kelasId: ASNTPQ.simakState.kelasId || "",
        namaKelas: ASNTPQ.simakState.namaKelas || ""
    };

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Menyimpan...`;
    }

    try {
        const token = getTPQToken();
        const res = await apiPost("saveTPQLog", { ...payload, token });

        if (res && (res.success || res.status === "success")) {
            closeSimakTPQModal();
            if (typeof showToast === 'function') {
                showToast(res.message || "Simakan TPQ Yanbu'a berhasil dicatat!");
            }

            // Update posisi lokal seketika
            const targetSt = (ASNTPQ.data.students || []).find(s => s.studentId === payload.studentId);
            if (targetSt) {
                targetSt.jilidAktif = res.nextJilid || payload.jilid;
                targetSt.halamanAktif = res.nextHalaman || payload.halaman;
                targetSt.statusTerakhir = payload.statusSetoran;
                targetSt.updatedAt = new Date().toISOString();
                filterTPQList();
            }

            // Revalidate backend di latar belakang
            loadAdminTPQData(true);
        } else {
            alert("Gagal mencatat bimbingan: " + (res && res.message ? res.message : "Kesalahan tidak dikenal"));
        }
    } catch (err) {
        alert("Terjadi kesalahan jaringan saat menyimpan data TPQ.");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-circle-check mr-1.5"></i> Selesai & Simpan`;
        }
    }
}

/**
 * Inisialisasi Database Sheet TPQ jika belum ada
 */
async function initTPQDatabaseSheets() {
    const ok = confirm("Inisialisasi Database TPQ Yanbu'a di Google Spreadsheet?\n\nSistem akan membuat 3 tab sheet baru secara otomatis jika belum ada:\n1. TPQ_Logs\n2. TPQ_Capaian\n3. TPQ_Kelas\n\nLanjutkan?");
    if (!ok) return;

    try {
        const token = getTPQToken();
        const res = await apiPost("initTPQSheets", { token });
        if (res && res.success) {
            alert(res.message);
            loadAdminTPQData(true);
        } else {
            alert("Gagal inisialisasi: " + (res.message || "Error"));
        }
    } catch (e) {
        alert("Kesalahan jaringan saat inisialisasi sheet TPQ.");
    }
}

// ====================================================================
// FITUR MANAJEMEN KELAS & PLOTTING TPQ (4 TAB LENGKAP)
// ====================================================================

/**
 * Buka modal kelola kelas TPQ & plotting
 * @param {number} defaultTab 1 = Kelas, 2 = Plotting, 3 = Matriks, 4 = Jadwal Sesi
 */
function openTPQKelasModal(defaultTab = 1) {
    const modal = document.getElementById('modal-tpq-kelas');
    if (!modal) return;

    populateTPQUstadzDropdown();
    modal.classList.remove('hidden');
    switchTPQKelasTab(defaultTab || 1);
}

function closeTPQKelasModal() {
    const modal = document.getElementById('modal-tpq-kelas');
    if (modal) modal.classList.add('hidden');
}

/**
 * Switch 4 Tab pada Modal Kelola Kelas TPQ
 */
function switchTPQKelasTab(tabNum) {
    ASNTPQ.kelasActiveTab = tabNum;

    for (let i = 1; i <= 4; i++) {
        const btn = document.getElementById(`tab-btn-tpq-kls-${i}`);
        const panel = document.getElementById(`panel-tpq-kls-tab-${i}`);

        if (i === tabNum) {
            if (btn) {
                btn.className = "px-4 py-2.5 text-xs font-extrabold border-b-2 border-teal-600 text-teal-700 dark:text-teal-400 flex items-center gap-1.5 whitespace-nowrap transition";
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
        renderTPQKelasCards();
    } else if (tabNum === 2) {
        populatePlottingTPQKelasSelector();
    } else if (tabNum === 3) {
        renderTPQMatriksBeban();
    } else if (tabNum === 4) {
        renderTPQSesiCards();
    }
}

/**
 * Sinkronkan dropdown Ustadz Pengampu dari data Pegawai / Asatidz
 */
function populateTPQUstadzDropdown() {
    const sel = document.getElementById('input-tpq-kelas-ustadz');
    if (!sel) return;

    let teachers = [];

    // 1. Dari data dashboard TPQ (yang sudah mengambil dari Sheet Pegawai aktif)
    if (Array.isArray(ASNTPQ.data.ustadzList) && ASNTPQ.data.ustadzList.length > 0) {
        teachers = [...ASNTPQ.data.ustadzList];
    }

    // 2. Dari data Pegawai Admin global jika tersedia
    if (typeof ASNAdmin !== 'undefined' && ASNAdmin.data && Array.isArray(ASNAdmin.data.employees)) {
        ASNAdmin.data.employees.forEach(e => {
            const n = e.name || e.nama;
            if (n && !teachers.includes(n)) teachers.push(n);
        });
    }

    // 3. Dari modul Tahfidz / Sorogan jika tersedia
    if (typeof ASNTahfidz !== 'undefined' && ASNTahfidz.data && Array.isArray(ASNTahfidz.data.asatidz)) {
        ASNTahfidz.data.asatidz.forEach(n => {
            if (n && !teachers.includes(n)) teachers.push(n);
        });
    }
    if (typeof ASNSorogan !== 'undefined' && ASNSorogan.data && Array.isArray(ASNSorogan.data.muallimList)) {
        ASNSorogan.data.muallimList.forEach(n => {
            if (n && !teachers.includes(n)) teachers.push(n);
        });
    }

    teachers = teachers.filter(Boolean);

    const currentVal = sel.value;
    sel.innerHTML = `<option value="">-- Pilih dari Data Pegawai --</option>` +
        teachers.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');

    if (currentVal && teachers.includes(currentVal)) {
        sel.value = currentVal;
    }
}

/**
 * Render Kartu Kelas TPQ Aktif (Tab 1)
 */
function renderTPQKelasCards() {
    const container = document.getElementById('tpq-kelas-cards-container');
    const badgeCount = document.getElementById('tpq-kelas-count-badge');
    if (!container) return;

    const kelasList = ASNTPQ.data.kelasList || [];
    if (badgeCount) badgeCount.innerText = `${kelasList.length} Kelas`;

    if (kelasList.length === 0) {
        container.innerHTML = `
        <div class="col-span-1 sm:col-span-2 text-center py-8 px-4 bg-slate-50 dark:bg-[#1c2836] rounded-2xl border border-dashed border-slate-200 dark:border-[#283a4e] space-y-2">
            <div class="w-10 h-10 mx-auto rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center text-base">
                <i class="fa-solid fa-chalkboard-user"></i>
            </div>
            <p class="text-xs font-bold text-slate-700 dark:text-slate-200">Belum Ada Kelas TPQ Aktif</p>
            <p class="text-[10px] text-slate-400 max-w-sm mx-auto">Silakan buat kelas bimbingan Yanbu'a baru di atas untuk mulai memplot santri.</p>
        </div>`;
        return;
    }

    const students = ASNTPQ.data.students || [];

    container.innerHTML = kelasList.map((k, i) => {
        const enrolledCount = Array.isArray(k.studentIds) ? k.studentIds.length : (
            students.filter(s => s.kelasId === k.kelasId).length
        );

        return `
        <div class="p-4 bg-slate-50 dark:bg-[#1c2836] rounded-2xl border border-slate-200 dark:border-[#283a4e] space-y-3 relative group">
            <div class="flex justify-between items-start">
                <div class="min-w-0">
                    <h4 class="font-black text-sm text-slate-800 dark:text-slate-100 truncate">${escapeHtml(k.ustadzPengampu || k.namaKelas || 'Ustadz Pengampu')}</h4>
                    <span class="inline-block mt-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                        ${escapeHtml(k.deskripsi || 'Bimbingan Yanbu\'a')}
                    </span>
                </div>
                <div class="flex items-center space-x-1.5 shrink-0">
                    <button type="button" onclick="deleteTPQKelasConfirm('${k.kelasId}', '${escapeHtml(k.ustadzPengampu || k.namaKelas)}')" class="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300 flex items-center justify-center text-[10px] transition" title="Hapus Kelas">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                    <span class="w-7 h-7 rounded-lg bg-white dark:bg-[#15202d] text-slate-500 dark:text-slate-300 flex items-center justify-center text-xs font-bold shadow-sm">
                        ${String.fromCharCode(65 + (i % 26))}
                    </span>
                </div>
            </div>
            <div class="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                <p class="flex items-center gap-1.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                    <i class="fa-solid fa-chalkboard-user text-teal-600"></i>
                    <span>Pengampu: <strong class="text-slate-700 dark:text-slate-200 font-bold">${escapeHtml(k.ustadzPengampu || '-')}</strong></span>
                </p>
            </div>
            <div class="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-[#283a4e] text-xs">
                <span class="font-bold text-slate-700 dark:text-slate-300">${enrolledCount} Santri Terdaftar</span>
                <button type="button" onclick="openPlottingFromKelasCard('${k.kelasId}')" class="px-3 py-1 bg-white dark:bg-[#15202d] hover:bg-teal-50 text-teal-700 dark:text-teal-300 font-bold rounded-lg border border-slate-200 dark:border-[#283a4e] text-[10px] transition flex items-center gap-1">
                    <i class="fa-solid fa-user-plus text-[9px]"></i>
                    <span>+ Atur Santri</span>
                </button>
            </div>
        </div>
        `;
    }).join('');
}

/**
 * Submit Tambah Kelas Baru (Cukup Ustadz Pengampu & Deskripsi)
 */
async function submitNewTPQKelas(e) {
    if (e && e.preventDefault) e.preventDefault();

    const inputUstadz = document.getElementById('input-tpq-kelas-ustadz');
    const inputTarget = document.getElementById('input-tpq-kelas-target');
    const btn = document.getElementById('btn-submit-tpq-kelas');

    const ustadz = inputUstadz ? inputUstadz.value.trim() : "";
    const deskripsi = inputTarget ? inputTarget.value.trim() : "";

    if (!ustadz) {
        alert("Nama Ustadz / Ustadzah pengampu wajib dipilih dari daftar data pegawai!");
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Menyimpan...`;
    }

    try {
        const token = getTPQToken();
        const res = await apiPost("saveTPQKelas", {
            token,
            ustadzPengampu: ustadz,
            deskripsi: deskripsi || "Bimbingan Yanbu'a",
            studentIds: []
        });

        if (res && (res.success || res.status === "success")) {
            if (typeof showToast === 'function') showToast(res.message || "Kelas TPQ berhasil ditambahkan!");
            if (inputTarget) inputTarget.value = '';
            if (inputUstadz) inputUstadz.value = '';

            // Update state lokal
            const newK = {
                kelasId: res.kelasId || ("TPQ-KLS-" + Date.now().toString().substring(8)),
                namaKelas: "Kelas " + ustadz,
                ustadzPengampu: ustadz,
                deskripsi: deskripsi || "Bimbingan Yanbu'a",
                studentIds: []
            };
            ASNTPQ.data.kelasList = ASNTPQ.data.kelasList || [];
            ASNTPQ.data.kelasList.push(newK);

            renderTPQKelasCards();
            populateTPQFilters();
            loadAdminTPQData(true);
        } else {
            alert("Gagal menyimpan kelas: " + ((res && res.message) || "Kesalahan server"));
        }
    } catch (err) {
        alert("Terjadi kesalahan jaringan saat menyimpan kelas TPQ.");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-plus text-[10px]"></i><span>Tambah Kelas</span>`;
        }
    }
}

/**
 * Hapus Kelas TPQ
 */
async function deleteTPQKelasConfirm(kelasId, namaKelas) {
    const ok = confirm(`Hapus kelas "${namaKelas}"?\nSantri yang ada di kelas ini tidak akan dihapus, tetapi status kelasnya akan di-reset.`);
    if (!ok) return;

    try {
        const token = getTPQToken();
        const res = await apiPost("deleteTPQKelas", { token, kelasId });

        if (res && (res.success || res.status === "success")) {
            if (typeof showToast === 'function') showToast("Kelas TPQ berhasil dihapus!");
            ASNTPQ.data.kelasList = (ASNTPQ.data.kelasList || []).filter(k => k.kelasId !== kelasId);
            renderTPQKelasCards();
            populateTPQFilters();
            loadAdminTPQData(true);
        } else {
            alert("Gagal menghapus: " + ((res && res.message) || "Error"));
        }
    } catch (e) {
        alert("Kesalahan jaringan saat menghapus kelas.");
    }
}

/**
 * Tombol "+ Atur Santri" di kartu kelas
 */
function openPlottingFromKelasCard(kelasId) {
    switchTPQKelasTab(2);
    const sel = document.getElementById('select-plotting-tpq-kelas');
    if (sel && kelasId) {
        sel.value = kelasId;
    }
    onSelectPlottingTPQKelas(kelasId);
}

/**
 * Mengisi dropdown pilihan kelas di Tab 2 Plotting
 */
function populatePlottingTPQKelasSelector() {
    const sel = document.getElementById('select-plotting-tpq-kelas');
    if (!sel) return;

    const kelasList = ASNTPQ.data.kelasList || [];
    if (kelasList.length === 0) {
        sel.innerHTML = `<option value="">-- Belum Ada Kelas --</option>`;
        ASNTPQ.activePlottingKelas = null;
        ASNTPQ.activePlottingStudentIds = [];
        renderTPQPlottingLists();
        return;
    }

    const currentVal = sel.value;
    sel.innerHTML = kelasList.map(k => `<option value="${escapeHtml(k.kelasId)}">${escapeHtml(k.namaKelas)}</option>`).join('');

    let targetId = currentVal;
    if (!targetId || !kelasList.some(k => k.kelasId === targetId)) {
        targetId = kelasList[0].kelasId;
    }
    sel.value = targetId;
    onSelectPlottingTPQKelas(targetId);
}

function onSelectPlottingTPQKelas(kelasId) {
    const kelasList = ASNTPQ.data.kelasList || [];
    const kelas = kelasList.find(k => k.kelasId === kelasId) || kelasList[0] || null;

    ASNTPQ.activePlottingKelas = kelas;
    if (!kelas) {
        ASNTPQ.activePlottingStudentIds = [];
        renderTPQPlottingLists();
        return;
    }

    let currentIds = [];
    if (Array.isArray(kelas.studentIds) && kelas.studentIds.length > 0) {
        currentIds = [...kelas.studentIds];
    } else if (Array.isArray(ASNTPQ.data.students)) {
        currentIds = ASNTPQ.data.students
            .filter(st => st.kelasId === kelas.kelasId)
            .map(st => st.studentId || st.nis);
    }
    ASNTPQ.activePlottingStudentIds = currentIds.map(id => String(id).trim()).filter(Boolean);

    const ustadzEl = document.getElementById('tab2-tpq-plotting-ustadz');
    const targetEl = document.getElementById('tab2-tpq-plotting-target');
    if (ustadzEl) ustadzEl.innerText = kelas.ustadzPengampu || 'Belum Ditunjuk';
    if (targetEl) targetEl.innerText = kelas.jadwalSesi || kelas.kategori || 'Yanbu\'a';

    renderTPQPlottingLists();
}

/**
 * Render daftar santri di Tab 2 Plotting (Enrolled vs Available)
 */
function renderTPQPlottingLists() {
    const enrolledContainer = document.getElementById('tab2-tpq-plotting-enrolled-container');
    const availableContainer = document.getElementById('tab2-tpq-plotting-available-container');
    const countBadge = document.getElementById('tab2-tpq-plotting-count-badge');
    const enrolledCountBadge = document.getElementById('tab2-tpq-plotting-enrolled-count');

    const allStudents = ASNTPQ.data.students || [];
    const currentEnrolledIds = new Set(ASNTPQ.activePlottingStudentIds.map(s => String(s).trim()));

    const enrolledStudents = allStudents.filter(st => {
        const sId = String(st.studentId || "").trim();
        const sNis = String(st.nis || "").trim();
        return currentEnrolledIds.has(sId) || currentEnrolledIds.has(sNis);
    });

    const searchInp = document.getElementById('tab2-tpq-plotting-search');
    const filterGen = document.getElementById('tab2-tpq-plotting-filter-gender');

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
                    <p>Belum ada santri yang dimasukkan ke kelas ini.</p>
                    <p class="text-[10px] text-slate-400 mt-0.5">Pilih santri dari daftar di bawah lalu klik + Masukkan.</p>
                </div>`;
        } else {
            enrolledContainer.innerHTML = enrolledStudents.map(st => {
                const sId = st.studentId || st.nis;
                const initials = (st.name || "S").substring(0, 2).toUpperCase();
                return `
                <div class="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-[#15202d] border border-slate-200/80 dark:border-[#283a4e] text-xs">
                    <div class="flex items-center space-x-2.5 min-w-0">
                        <div class="w-7 h-7 rounded-lg ${st.gender === 'P' ? 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300' : 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300'} flex items-center justify-center font-bold text-[10px] shrink-0">
                            ${initials}
                        </div>
                        <div class="min-w-0">
                            <h5 class="font-bold text-slate-800 dark:text-slate-100 truncate">${escapeHtml(st.name)}</h5>
                            <p class="text-[10px] text-slate-400">NIS: ${escapeHtml(st.nis || '-')} • Jilid ${st.jilidAktif || 1}</p>
                        </div>
                    </div>
                    <button type="button" onclick="removeStudentFromTPQPlotting('${sId}')" class="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-bold text-[10px] transition shrink-0 flex items-center gap-1">
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
                    <p>Semua santri yang cocok sudah dimasukkan ke kelas ini.</p>
                </div>`;
        } else {
            availableContainer.innerHTML = availableStudents.map(st => {
                const sId = st.studentId || st.nis;
                const initials = (st.name || "S").substring(0, 2).toUpperCase();
                const curKelas = st.namaKelas && st.namaKelas !== "Belum Ditentukan" ? st.namaKelas : null;
                return `
                <div class="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-[#15202d] border border-slate-200/80 dark:border-[#283a4e] text-xs hover:border-teal-300 transition">
                    <div class="flex items-center space-x-2.5 min-w-0">
                        <div class="w-7 h-7 rounded-lg ${st.gender === 'P' ? 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300' : 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300'} flex items-center justify-center font-bold text-[10px] shrink-0">
                            ${initials}
                        </div>
                        <div class="min-w-0">
                            <h5 class="font-bold text-slate-800 dark:text-slate-100 truncate">${escapeHtml(st.name)}</h5>
                            <p class="text-[10px] text-slate-400 truncate">
                                NIS: ${escapeHtml(st.nis || '-')} • Jilid ${st.jilidAktif || 1}
                                ${curKelas ? ` • <span class="text-amber-600 dark:text-amber-400 font-semibold">(Saat ini: ${escapeHtml(curKelas)})</span>` : ''}
                            </p>
                        </div>
                    </div>
                    <button type="button" onclick="addStudentToTPQPlotting('${sId}')" class="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 font-bold text-[10px] transition shrink-0 flex items-center gap-1">
                        <i class="fa-solid fa-user-plus"></i>
                        <span>+ Masukkan</span>
                    </button>
                </div>`;
            }).join('');
        }
    }
}

function filterTPQPlottingAvailableList() {
    renderTPQPlottingLists();
}

function addStudentToTPQPlotting(studentId) {
    const cleanId = String(studentId || "").trim();
    if (!cleanId) return;

    if (!ASNTPQ.activePlottingStudentIds.includes(cleanId)) {
        ASNTPQ.activePlottingStudentIds.push(cleanId);
        renderTPQPlottingLists();
    }
}

function removeStudentFromTPQPlotting(studentId) {
    const cleanId = String(studentId || "").trim();
    if (!cleanId) return;

    ASNTPQ.activePlottingStudentIds = ASNTPQ.activePlottingStudentIds.filter(id => id !== cleanId);
    renderTPQPlottingLists();
}

async function submitTPQPlotting() {
    if (!ASNTPQ.activePlottingKelas) {
        alert("Pilih kelas TPQ terlebih dahulu.");
        return;
    }

    const kelasId = ASNTPQ.activePlottingKelas.kelasId;
    const studentIds = ASNTPQ.activePlottingStudentIds || [];
    const btn = document.getElementById('tab2-btn-save-tpq-plotting');

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Menyimpan...`;
    }

    try {
        const token = getTPQToken();
        const res = await apiPost("saveTPQPlotting", {
            token,
            kelasId,
            studentIds
        });

        if (res && (res.success || res.status === "success")) {
            if (typeof showToast === 'function') {
                showToast(`✅ Berhasil mengatur ${studentIds.length} santri binaan ke ${ASNTPQ.activePlottingKelas.namaKelas}!`);
            }
            if (ASNTPQ.activePlottingKelas) {
                ASNTPQ.activePlottingKelas.studentIds = studentIds;
            }
            renderTPQKelasCards();
            renderTPQMatriksBeban();
            loadAdminTPQData(true);
        } else {
            alert("Gagal menyimpan plotting: " + ((res && res.message) || "Kesalahan server"));
        }
    } catch (e) {
        alert("Kesalahan jaringan saat menyimpan plotting santri.");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i><span>Simpan Plotting Santri</span>`;
        }
    }
}

/**
 * TAB 3: Matriks Beban Asatidz TPQ
 */
function renderTPQMatriksBeban() {
    const tbody = document.getElementById('tpq-matriks-beban-tbody');
    const mobileContainer = document.getElementById('tpq-matriks-beban-mobile-list');
    if (!tbody && !mobileContainer) return;

    const kelasList = ASNTPQ.data.kelasList || [];
    const students = ASNTPQ.data.students || [];

    if (kelasList.length === 0) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-xs text-slate-400">Belum ada data distribusi beban Ustadz TPQ.</td></tr>`;
        if (mobileContainer) mobileContainer.innerHTML = `<div class="p-6 text-center text-xs text-slate-400 bg-white dark:bg-[#15202d] rounded-2xl border border-dashed border-slate-200 dark:border-[#283a4e]">Belum ada data distribusi beban Ustadz TPQ.</div>`;
        return;
    }

    const rowsHtml = [];
    const cardsHtml = [];

    kelasList.forEach(k => {
        const enrolled = students.filter(st => {
            if (Array.isArray(k.studentIds) && (k.studentIds.includes(st.studentId) || k.studentIds.includes(st.nis))) return true;
            return st.kelasId === k.kelasId;
        });

        let totalJilid = 0;
        enrolled.forEach(st => {
            totalJilid += Number(st.jilidAktif || 1);
        });
        const avg = enrolled.length > 0 ? (totalJilid / enrolled.length).toFixed(1) : "1.0";
        const ustadz = (k.ustadzPengampu && k.ustadzPengampu !== '-') ? k.ustadzPengampu : (k.namaKelas || 'Ustadz TPQ');
        const deskripsi = k.deskripsi || k.namaKelas || 'Bimbingan Yanbu\'a';
        const kategori = k.kategori || 'Yanbu\'a';

        // 1. Desktop Table Row (w-full table-fixed, no horizontal scroll)
        rowsHtml.push(`
        <tr class="hover:bg-slate-50 dark:hover:bg-[#1c2836]/60 transition">
            <td class="py-3 px-4 font-bold text-slate-800 dark:text-slate-100">
                <div class="flex items-center gap-2 min-w-0">
                    <div class="w-7 h-7 rounded-lg bg-teal-100/70 dark:bg-teal-950 text-teal-700 dark:text-teal-300 flex items-center justify-center text-xs shrink-0 font-bold">
                        <i class="fa-solid fa-user-tie"></i>
                    </div>
                    <span class="truncate" title="${escapeHtml(ustadz)}">${escapeHtml(ustadz)}</span>
                </div>
            </td>
            <td class="py-3 px-4 font-semibold text-slate-700 dark:text-slate-200">
                <span class="truncate block" title="${escapeHtml(deskripsi)}">${escapeHtml(deskripsi)}</span>
            </td>
            <td class="py-3 px-3">
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 whitespace-nowrap">
                    ${escapeHtml(kategori)}
                </span>
            </td>
            <td class="py-3 px-3 font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">${enrolled.length} Santri</td>
            <td class="py-3 px-4 font-bold text-teal-600 dark:text-teal-400 whitespace-nowrap">Jilid ${avg} / 7</td>
        </tr>
        `);

        // 2. Mobile Card (100% width, langsung tampak utuh tanpa scroll horizontal)
        cardsHtml.push(`
        <div class="p-3.5 bg-white dark:bg-[#15202d] rounded-2xl border border-slate-200 dark:border-[#283a4e] shadow-sm space-y-2.5">
            <div class="flex items-start justify-between gap-2">
                <div class="flex items-center gap-2.5 min-w-0 flex-1">
                    <div class="w-8 h-8 rounded-xl bg-teal-100/80 dark:bg-teal-950 text-teal-700 dark:text-teal-300 flex items-center justify-center text-xs shrink-0 font-bold shadow-xs">
                        <i class="fa-solid fa-user-tie"></i>
                    </div>
                    <div class="min-w-0 flex-1">
                        <h5 class="font-extrabold text-xs text-slate-800 dark:text-slate-100 truncate">${escapeHtml(ustadz)}</h5>
                        <p class="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate">${escapeHtml(deskripsi)}</p>
                    </div>
                </div>
                <span class="shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/50">
                    <i class="fa-solid fa-users text-[9px]"></i> ${enrolled.length} Santri
                </span>
            </div>
            
            <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-[#283a4e]/60 text-xs">
                <div class="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-[#1c2836] border border-slate-200/50 dark:border-[#283a4e]">
                    <span class="text-[10px] font-semibold text-slate-400">Kategori</span>
                    <span class="text-[10px] font-bold text-teal-700 dark:text-teal-300">${escapeHtml(kategori)}</span>
                </div>
                <div class="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-[#1c2836] border border-slate-200/50 dark:border-[#283a4e]">
                    <span class="text-[10px] font-semibold text-slate-400">Rata-rata</span>
                    <span class="text-[10px] font-black text-emerald-600 dark:text-emerald-400">Jilid ${avg} <span class="font-normal text-slate-400 text-[9px]">/ 7</span></span>
                </div>
            </div>

            <div class="flex justify-end pt-0.5">
                <button type="button" onclick="openPlottingFromKelasCard('${escapeHtml(k.kelasId)}')" class="text-[10px] font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400 inline-flex items-center gap-1 transition">
                    <span>Atur Plotting Santri</span>
                    <i class="fa-solid fa-arrow-right text-[9px]"></i>
                </button>
            </div>
        </div>
        `);
    });

    if (tbody) tbody.innerHTML = rowsHtml.join('');
    if (mobileContainer) mobileContainer.innerHTML = cardsHtml.join('');
}

/**
 * TAB 4: Jadwal & Sesi Bimbingan TPQ
 */
function resetTPQSesiForm() {
    const idInput = document.getElementById('input-tpq-sesi-id');
    const namaInput = document.getElementById('input-tpq-sesi-nama');
    const tipeInput = document.getElementById('input-tpq-sesi-tipe');
    const statusInput = document.getElementById('input-tpq-sesi-status');
    const jamMulaiInput = document.getElementById('input-tpq-sesi-jam-mulai');
    const jamSelesaiInput = document.getElementById('input-tpq-sesi-jam-selesai');
    const btnText = document.getElementById('btn-submit-tpq-sesi-text');
    const btnCancel = document.getElementById('btn-cancel-tpq-sesi');

    if (idInput) idInput.value = '';
    if (namaInput) namaInput.value = '';
    if (tipeInput) tipeInput.value = 'Bimbingan Yanbu\'a Reguler';
    if (statusInput) statusInput.value = 'Aktif Digunakan';
    if (jamMulaiInput) jamMulaiInput.value = '15:45';
    if (jamSelesaiInput) jamSelesaiInput.value = '17:00';
    if (btnText) btnText.innerText = "Simpan Sesi";
    if (btnCancel) btnCancel.classList.add('hidden');

    document.querySelectorAll('input[name="tpq-sesi-hari"]').forEach(chk => {
        chk.checked = ['Sen', 'Sel', 'Rab', 'Kam', 'Sab', 'Min'].includes(chk.value);
    });
}

function renderTPQSesiCards() {
    const container = document.getElementById('tpq-sesi-cards-container');
    const badgeCount = document.getElementById('tpq-sesi-count-badge');
    if (!container) return;

    let sesiList = ASNTPQ.data.sesiList || [];

    if (!sesiList || sesiList.length === 0) {
        sesiList = [
            { sesiId: "TPQ-SESI-01", namaSesi: "Sore (Reguler Yanbu'a)", jenisSesi: "Bimbingan Yanbu'a Reguler", jamMulai: "15:45", jamSelesai: "17:00", hariList: ["Sen", "Sel", "Rab", "Kam", "Sab", "Min"], status: "Aktif Digunakan" },
            { sesiId: "TPQ-SESI-02", namaSesi: "Pagi (Madin / Yanbu'a Cilik)", jenisSesi: "Privat Tahsin & I'adah", jamMulai: "08:30", jamSelesai: "10:00", hariList: ["Ahad"], status: "Aktif Digunakan" },
            { sesiId: "TPQ-SESI-03", namaSesi: "Ba'da Maghrib (Khataman)", jenisSesi: "Imtihan / Ujian Kenaikan Jilid", jamMulai: "18:30", jamSelesai: "19:30", hariList: ["Kam"], status: "Aktif Digunakan" }
        ];
    }

    const activeCount = sesiList.filter(s => (s.status || '').includes('Aktif')).length;
    if (badgeCount) badgeCount.innerText = `${activeCount} Sesi Aktif (${sesiList.length} Total)`;

    container.innerHTML = sesiList.map((s, idx) => {
        const id = s.sesiId || `TPQ-SESI-0${idx + 1}`;
        const nama = s.namaSesi || 'Sesi';
        const jenis = s.jenisSesi || 'Reguler';
        const isAktif = (s.status || '').includes('Aktif');
        const rawHari = s.hariList || [];
        const hariList = Array.isArray(rawHari) ? rawHari : String(rawHari).split(',').map(h => h.trim()).filter(Boolean);
        const hariStr = hariList.join(', ');

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
                    <span class="px-2 py-0.5 rounded-full text-[9px] font-extrabold ${isAktif ? 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300' : 'bg-slate-200 text-slate-600'}">
                        ${isAktif ? 'Aktif' : 'Nonaktif'}
                    </span>
                    <button type="button" onclick="editTPQSesi('${escapeHtml(id)}')" class="w-6 h-6 rounded-lg bg-white dark:bg-[#15202d] hover:bg-slate-100 text-slate-500 hover:text-teal-600 flex items-center justify-center text-[10px] shadow-sm transition" title="Edit Sesi">
                        <i class="fa-solid fa-pencil"></i>
                    </button>
                    <button type="button" onclick="deleteTPQSesiConfirm('${escapeHtml(id)}', '${escapeHtml(nama)}')" class="w-6 h-6 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300 flex items-center justify-center text-[10px] transition" title="Hapus Sesi">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
            <div class="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                <p class="flex items-center gap-1.5 font-semibold text-teal-700 dark:text-teal-300">
                    <i class="fa-solid fa-book-open-reader"></i>
                    <span>${escapeHtml(jenis)}</span>
                </p>
                <div class="flex items-center justify-between text-[11px] pt-1">
                    <span class="font-bold flex items-center gap-1">
                        <i class="fa-regular fa-clock text-teal-600"></i> ${escapeHtml(formatTPQTime(s.jamMulai, '15:45'))} - ${escapeHtml(formatTPQTime(s.jamSelesai, '17:00'))} WIB
                    </span>
                    <span class="text-slate-400 text-[10px]">${hariStr || 'Setiap Hari'}</span>
                </div>
            </div>
        </div>`;
    }).join('');
}

function editTPQSesi(sesiId) {
    const sesiList = ASNTPQ.data.sesiList || [];
    const sesi = sesiList.find(s => s.sesiId === sesiId);
    if (!sesi) return;

    const idInput = document.getElementById('input-tpq-sesi-id');
    const namaInput = document.getElementById('input-tpq-sesi-nama');
    const tipeInput = document.getElementById('input-tpq-sesi-tipe');
    const statusInput = document.getElementById('input-tpq-sesi-status');
    const jamMulaiInput = document.getElementById('input-tpq-sesi-jam-mulai');
    const jamSelesaiInput = document.getElementById('input-tpq-sesi-jam-selesai');
    const btnText = document.getElementById('btn-submit-tpq-sesi-text');
    const btnCancel = document.getElementById('btn-cancel-tpq-sesi');

    if (idInput) idInput.value = sesi.sesiId;
    if (namaInput) namaInput.value = sesi.namaSesi || '';
    if (tipeInput) tipeInput.value = sesi.jenisSesi || 'Bimbingan Yanbu\'a Reguler';
    if (statusInput) statusInput.value = sesi.status || 'Aktif Digunakan';
    if (jamMulaiInput) jamMulaiInput.value = formatTPQTime(sesi.jamMulai, '15:45');
    if (jamSelesaiInput) jamSelesaiInput.value = formatTPQTime(sesi.jamSelesai, '17:00');
    if (btnText) btnText.innerText = "Perbarui Sesi";
    if (btnCancel) btnCancel.classList.remove('hidden');

    const rawHari = sesi.hariList || [];
    const arrHari = Array.isArray(rawHari) ? rawHari : String(rawHari).split(',').map(h => h.trim());
    document.querySelectorAll('input[name="tpq-sesi-hari"]').forEach(chk => {
        chk.checked = arrHari.includes(chk.value);
    });
}

async function submitTPQSesi(e) {
    if (e && e.preventDefault) e.preventDefault();

    const idInput = document.getElementById('input-tpq-sesi-id');
    const namaInput = document.getElementById('input-tpq-sesi-nama');
    const tipeInput = document.getElementById('input-tpq-sesi-tipe');
    const statusInput = document.getElementById('input-tpq-sesi-status');
    const jamMulaiInput = document.getElementById('input-tpq-sesi-jam-mulai');
    const jamSelesaiInput = document.getElementById('input-tpq-sesi-jam-selesai');
    const btn = document.getElementById('btn-submit-tpq-sesi');

    const hariList = [];
    document.querySelectorAll('input[name="tpq-sesi-hari"]:checked').forEach(chk => hariList.push(chk.value));

    const payload = {
        sesiId: idInput ? idInput.value.trim() : "",
        namaSesi: namaInput ? namaInput.value.trim() : "",
        jenisSesi: tipeInput ? tipeInput.value : "Bimbingan Yanbu'a Reguler",
        status: statusInput ? statusInput.value : "Aktif Digunakan",
        jamMulai: formatTPQTime(jamMulaiInput ? jamMulaiInput.value : "15:45", "15:45"),
        jamSelesai: formatTPQTime(jamSelesaiInput ? jamSelesaiInput.value : "17:00", "17:00"),
        hariList
    };

    if (!payload.namaSesi) {
        alert("Nama sesi wajib diisi!");
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Menyimpan...`;
    }

    try {
        const token = getTPQToken();
        const res = await apiPost("saveTPQSesi", { token, ...payload });

        if (res && (res.success || res.status === "success")) {
            if (typeof showToast === 'function') showToast("Jadwal sesi TPQ berhasil disimpan!");
            resetTPQSesiForm();

            if (!ASNTPQ.data.sesiList) ASNTPQ.data.sesiList = [];
            const existingIdx = ASNTPQ.data.sesiList.findIndex(s => s.sesiId === payload.sesiId);
            if (existingIdx >= 0) {
                ASNTPQ.data.sesiList[existingIdx] = { ...ASNTPQ.data.sesiList[existingIdx], ...payload };
            } else {
                ASNTPQ.data.sesiList.push({ ...payload, sesiId: res.sesiId || ("TPQ-SESI-" + Date.now().toString().substring(8)) });
            }
            renderTPQSesiCards();
        } else {
            alert("Gagal: " + ((res && res.message) || "Kesalahan server"));
        }
    } catch (err) {
        alert("Terjadi kesalahan jaringan saat menyimpan sesi.");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-plus text-[10px]"></i><span id="btn-submit-tpq-sesi-text">Simpan Sesi</span>`;
        }
    }
}

async function deleteTPQSesiConfirm(sesiId, namaSesi) {
    const ok = confirm(`Hapus jadwal sesi "${namaSesi}"?`);
    if (!ok) return;

    try {
        const token = getTPQToken();
        const res = await apiPost("deleteTPQSesi", { token, sesiId });

        if (res && (res.success || res.status === "success")) {
            if (typeof showToast === 'function') showToast("Sesi berhasil dihapus.");
            ASNTPQ.data.sesiList = (ASNTPQ.data.sesiList || []).filter(s => s.sesiId !== sesiId);
            renderTPQSesiCards();
        } else {
            alert("Gagal menghapus: " + ((res && res.message) || "Error"));
        }
    } catch (e) {
        alert("Kesalahan jaringan.");
    }
}


// ====================================================================
// TARGET CAPAIAN TPQ (INDIVIDUAL & MASSAL)
// ====================================================================

function openTPQTargetModal(studentId) {
    const st = (ASNTPQ.data.students || []).find(s => s.studentId === studentId);
    if (!st) return;

    const modal = document.getElementById('modal-tpq-target');
    if (!modal) return;

    const targets = (ASNTPQ.data && ASNTPQ.data.targets) || {};
    const tgt = targets[studentId] || st.target || {
        targetJilid: Math.min(7, (st.jilidAktif || 1) + 1),
        targetHalamanSesi: 1
    };

    const nameEl = document.getElementById('tpq-target-student-name');
    const nisEl = document.getElementById('tpq-target-student-nis');
    const posEl = document.getElementById('tpq-target-current-pos');
    const idInput = document.getElementById('input-tpq-target-student-id');
    const jilidSel = document.getElementById('input-tpq-target-jilid');
    const sesiInput = document.getElementById('input-tpq-target-sesi');

    const curJilid = (st.jilidAktif === 0 || String(st.jilidAktif).toLowerCase() === "pemula") ? 0 : Number(st.jilidAktif || 1);
    const curHal = Number(st.halamanAktif || 1);
    const maxHal = getYanbuaJilidMaxPages(curJilid);
    const sisaHal = Math.max(0, maxHal - curHal);
    const jName = curJilid === 0 ? "Pemula" : `Jilid ${curJilid}`;

    if (nameEl) nameEl.innerText = st.name;
    if (nisEl) nisEl.innerText = `NIS: ${st.nis || "-"} • Kelas: ${st.namaKelas || "TPQ"}`;
    if (posEl) {
        posEl.innerHTML = `
            <div class="font-extrabold text-xs text-teal-800 dark:text-teal-200">${jName} • Hal ${curHal} / ${maxHal}</div>
            <div class="text-[10px] text-slate-400 font-semibold">(Sisa ${sisaHal} hal jilid ini)</div>
        `;
    }
    if (idInput) idInput.value = st.studentId;
    if (jilidSel) jilidSel.value = String(tgt.targetJilid !== undefined ? tgt.targetJilid : (curJilid === 0 ? 1 : Math.min(7, curJilid + 1)));
    if (sesiInput) sesiInput.value = tgt.targetHalamanSesi || 1;

    recalculateTPQTargetWeekly();
    modal.classList.remove('hidden');
}

function closeTPQTargetModal() {
    const modal = document.getElementById('modal-tpq-target');
    if (modal) modal.classList.add('hidden');
}

function setTPQTargetChip(field, val) {
    if (field === 'SESI') {
        const inp = document.getElementById('input-tpq-target-sesi');
        if (inp) {
            inp.value = val;
            recalculateTPQTargetWeekly();
        }
    }
}

function recalculateTPQTargetWeekly() {
    const sesiInp = document.getElementById('input-tpq-target-sesi');
    const pekanInp = document.getElementById('input-tpq-target-pekan');
    const bulanInp = document.getElementById('input-tpq-target-bulan');
    const labelPekan = document.getElementById('label-tpq-target-pekan');
    const labelBulan = document.getElementById('label-tpq-target-bulan');
    const idInput = document.getElementById('input-tpq-target-student-id');

    const weeklySessions = getTPQActiveWeeklySessionCounts();
    if (labelPekan) {
        labelPekan.innerText = `Estimasi Target Pekanan (${weeklySessions} Sesi):`;
    }
    if (labelBulan) {
        labelBulan.innerText = `Estimasi Target Bulanan (4 Pekan):`;
    }

    const sesi = Number(sesiInp?.value || 1);
    const pekan = Math.round(sesi * weeklySessions * 10) / 10;
    const bulan = Math.round(pekan * 4 * 10) / 10;

    if (pekanInp) pekanInp.value = `${pekan} Halaman / Pekan`;
    if (bulanInp) bulanInp.value = `${bulan} Halaman (~${(bulan / 44).toFixed(1)} Jilid / Bulan)`;

    // Hitung Proyeksi Waktu Capaian
    const studentId = idInput ? idInput.value : "";
    const st = (ASNTPQ.data.students || []).find(s => s.studentId === studentId);
    if (st) {
        const curJilid = (st.jilidAktif === 0 || String(st.jilidAktif).toLowerCase() === "pemula") ? 0 : Number(st.jilidAktif || 1);
        const curHal = Number(st.halamanAktif || 1);
        const maxHal = getYanbuaJilidMaxPages(curJilid);
        const sisaHalJilid = Math.max(0, maxHal - curHal);

        const cumulativeDone = getYanbuaCumulativePages(curJilid, curHal);
        const sisaHalTotal = Math.max(0, TOTAL_YANBUA_PAGES - cumulativeDone);

        const elSisaJilid = document.getElementById('tpq-target-sisa-jilid');
        const elEstimasiKhatam = document.getElementById('tpq-target-estimasi-khatam');

        const pekanUntukJilid = pekan > 0 ? Math.ceil(sisaHalJilid / pekan) : 1;
        const sesiUntukJilid = sesi > 0 ? Math.ceil(sisaHalJilid / sesi) : sisaHalJilid;

        if (elSisaJilid) {
            elSisaJilid.innerHTML = `${sisaHalJilid} Hal <span class="text-teal-600 dark:text-teal-400 font-bold">(~${pekanUntukJilid} pekan / ${sesiUntukJilid} sesi)</span>`;
        }

        const pekanUntukKhatam = pekan > 0 ? Math.ceil(sisaHalTotal / pekan) : 1;
        const bulanUntukKhatam = Math.round((pekanUntukKhatam / 4) * 10) / 10;
        if (elEstimasiKhatam) {
            elEstimasiKhatam.innerHTML = `${sisaHalTotal} Hal tersisa <span class="text-teal-600 dark:text-teal-400 font-bold">(~${pekanUntukKhatam} pekan / ~${bulanUntukKhatam} bln)</span>`;
        }
    }
}

async function submitTPQTarget() {
    const idInput = document.getElementById('input-tpq-target-student-id');
    const jilidSel = document.getElementById('input-tpq-target-jilid');
    const sesiInput = document.getElementById('input-tpq-target-sesi');
    const btn = document.getElementById('btn-save-tpq-target');

    const studentId = idInput ? idInput.value : "";
    const targetJilid = Number(jilidSel?.value || 1);
    const targetHalamanSesi = Number(sesiInput?.value || 1);

    if (!studentId) return;

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Menyimpan...`;
    }

    try {
        const token = getTPQToken();
        const weeklySessions = getTPQActiveWeeklySessionCounts();
        const res = await apiPost("saveTPQTarget", {
            token,
            studentId,
            targetJilid,
            targetHalamanSesi,
            targetHalamanPekan: Math.round(targetHalamanSesi * weeklySessions * 10) / 10
        });

        if (res && (res.success || res.status === "success")) {
            closeTPQTargetModal();
            if (typeof showToast === 'function') showToast("Target santri berhasil disimpan!");

            if (!ASNTPQ.data.targets) ASNTPQ.data.targets = {};
            ASNTPQ.data.targets[studentId] = {
                targetJilid,
                targetHalamanSesi
            };
            renderTPQTable();
        } else {
            alert("Gagal: " + ((res && res.message) || "Error"));
        }
    } catch (e) {
        alert("Kesalahan jaringan saat menyimpan target.");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i><span>Simpan Target</span>`;
        }
    }
}

/**
 * Target Massal (Bulk Target) TPQ
 */
function openTPQBulkTargetModal(initialScope = 'ALL') {
    const modal = document.getElementById('modal-tpq-target-bulk');
    if (!modal) return;

    // Populate Kelas Dropdown
    const selKelas = document.getElementById('tpq-bulk-target-select-kelas');
    if (selKelas) {
        const kelasList = ASNTPQ.data.kelasList || [];
        selKelas.innerHTML = kelasList.length > 0
            ? kelasList.map(k => `<option value="${escapeHtml(k.kelasId)}">${escapeHtml(k.namaKelas)}</option>`).join('')
            : '<option value="">(Belum ada kelas)</option>';
    }

    const selCount = ASNTPQ.selectedStudentIds ? ASNTPQ.selectedStudentIds.size : 0;
    const scopeToUse = (initialScope === 'SELECTED' && selCount === 0) ? 'ALL' : initialScope;
    setTPQBulkTargetScope(scopeToUse);

    recalculateTPQBulkTargetWeekly();
    modal.classList.remove('hidden');
}

function closeTPQBulkTargetModal() {
    const modal = document.getElementById('modal-tpq-target-bulk');
    if (modal) modal.classList.add('hidden');
}

function setTPQBulkTargetScope(scope) {
    if (!ASNTPQ.bulkTargetState) {
        ASNTPQ.bulkTargetState = { scope: 'ALL', kelasId: '', jilid: '1', studentIds: [] };
    }
    ASNTPQ.bulkTargetState.scope = scope;

    const scopes = ['all', 'kelas', 'jilid', 'selected'];
    scopes.forEach(s => {
        const btn = document.getElementById(`btn-tpq-scope-${s}`);
        if (!btn) return;
        if (s.toUpperCase() === scope) {
            btn.className = 'px-3 py-2 rounded-xl font-bold text-xs border text-center transition flex flex-col items-center gap-1 bg-white dark:bg-[#15202d] border-teal-500 text-teal-700 dark:text-teal-300 shadow-sm ring-2 ring-teal-500/20';
        } else {
            btn.className = 'px-3 py-2 rounded-xl font-bold text-xs border text-center transition flex flex-col items-center gap-1 bg-white dark:bg-[#15202d] border-slate-200 dark:border-[#283a4e] text-slate-600 dark:text-slate-300 hover:border-amber-400';
        }
    });

    const subContainer = document.getElementById('tpq-bulk-target-subselect-container');
    const kelasWrap = document.getElementById('tpq-bulk-target-kelas-wrapper');
    const jilidWrap = document.getElementById('tpq-bulk-target-jilid-wrapper');

    if (subContainer) {
        if (scope === 'KELAS' || scope === 'JILID') {
            subContainer.classList.remove('hidden');
        } else {
            subContainer.classList.add('hidden');
        }
    }

    if (kelasWrap) {
        if (scope === 'KELAS') kelasWrap.classList.remove('hidden');
        else kelasWrap.classList.add('hidden');
    }

    if (jilidWrap) {
        if (scope === 'JILID') jilidWrap.classList.remove('hidden');
        else jilidWrap.classList.add('hidden');
    }

    onTPQBulkTargetScopeChange();
}

function onTPQBulkTargetScopeChange() {
    const scope = ASNTPQ.bulkTargetState?.scope || 'ALL';
    const students = ASNTPQ.data.students || [];
    let count = 0;
    let summaryText = "";

    if (scope === 'ALL') {
        count = students.length;
        summaryText = "Target akan diterapkan ke seluruh santri TPQ aktif";
    } else if (scope === 'KELAS') {
        const selKelas = document.getElementById('tpq-bulk-target-select-kelas');
        const kId = selKelas ? selKelas.value : "";
        count = students.filter(s => s.kelasId === kId).length;
        summaryText = `Target akan diterapkan ke santri di kelas terpilih (${count} santri)`;
    } else if (scope === 'JILID') {
        const selJilid = document.getElementById('tpq-bulk-target-select-jilid');
        const j = selJilid ? Number(selJilid.value) : 1;
        const jName = j === 0 ? "Pemula" : `Jilid ${j}`;
        count = students.filter(s => s.jilidAktif === j).length;
        summaryText = `Target akan diterapkan ke semua santri ${jName} (${count} santri)`;
    } else if (scope === 'SELECTED') {
        count = ASNTPQ.selectedStudentIds ? ASNTPQ.selectedStudentIds.size : 0;
        summaryText = `Target akan diterapkan ke ${count} santri yang dicentang`;
    }

    const badgeEl = document.getElementById('tpq-bulk-target-recipient-badge');
    const sumEl = document.getElementById('tpq-bulk-target-summary-text');
    const prevEl = document.getElementById('tpq-bulk-target-student-preview');

    if (badgeEl) badgeEl.innerText = `${count} Santri Sasaran`;
    if (sumEl) sumEl.innerText = summaryText;
    if (prevEl) prevEl.innerText = `${count} santri`;
}

function setTPQBulkTargetChip(field, val) {
    if (field === 'SESI') {
        const inp = document.getElementById('input-tpq-bulk-target-sesi');
        if (inp) {
            inp.value = val;
            recalculateTPQBulkTargetWeekly();
        }
    }
}

function recalculateTPQBulkTargetWeekly() {
    const sesiInp = document.getElementById('input-tpq-bulk-target-sesi');
    const pekanInp = document.getElementById('input-tpq-bulk-target-pekan');
    const bulanInp = document.getElementById('input-tpq-bulk-target-bulan');
    const labelPekan = document.getElementById('label-tpq-bulk-target-pekan');
    const labelBulan = document.getElementById('label-tpq-bulk-target-bulan');

    const weeklySessions = getTPQActiveWeeklySessionCounts();
    if (labelPekan) {
        labelPekan.innerText = `Target Pekanan (${weeklySessions} Sesi):`;
    }
    if (labelBulan) {
        labelBulan.innerText = `Target Bulanan (4 Pekan):`;
    }

    const sesi = Number(sesiInp?.value || 1);
    const pekan = Math.round(sesi * weeklySessions * 10) / 10;
    const bulan = Math.round(pekan * 4 * 10) / 10;

    if (pekanInp) pekanInp.value = `${pekan} Halaman`;
    if (bulanInp) bulanInp.value = `${bulan} Halaman (~${(bulan / 44).toFixed(1)} Jilid / Bulan)`;
}

async function submitTPQBulkTarget() {
    const scope = ASNTPQ.bulkTargetState?.scope || 'ALL';
    const students = ASNTPQ.data.students || [];
    let targetStudentIds = [];

    if (scope === 'ALL') {
        targetStudentIds = students.map(s => s.studentId);
    } else if (scope === 'KELAS') {
        const selKelas = document.getElementById('tpq-bulk-target-select-kelas');
        const kId = selKelas ? selKelas.value : "";
        targetStudentIds = students.filter(s => s.kelasId === kId).map(s => s.studentId);
    } else if (scope === 'JILID') {
        const selJilid = document.getElementById('tpq-bulk-target-select-jilid');
        const j = selJilid ? Number(selJilid.value) : 1;
        targetStudentIds = students.filter(s => s.jilidAktif === j).map(s => s.studentId);
    } else if (scope === 'SELECTED') {
        targetStudentIds = Array.from(ASNTPQ.selectedStudentIds || []);
    }

    if (targetStudentIds.length === 0) {
        alert("Tidak ada santri sasaran yang terpilih.");
        return;
    }

    const sesiInp = document.getElementById('input-tpq-bulk-target-sesi');
    const targetHalamanSesi = Number(sesiInp?.value || 1);
    const btn = document.getElementById('btn-save-tpq-target-bulk');

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Menerapkan Target...`;
    }

    try {
        const token = getTPQToken();
        const weeklySessions = getTPQActiveWeeklySessionCounts();
        const res = await apiPost("saveBulkTPQTarget", {
            token,
            studentIds: targetStudentIds,
            targetHalamanSesi,
            targetHalamanPekan: Math.round(targetHalamanSesi * weeklySessions * 10) / 10
        });

        if (res && (res.success || res.status === "success")) {
            closeTPQBulkTargetModal();
            if (typeof showToast === 'function') {
                showToast(`✅ Target berhasil diterapkan ke ${targetStudentIds.length} santri TPQ!`);
            }
            if (!ASNTPQ.data.targets) ASNTPQ.data.targets = {};
            targetStudentIds.forEach(id => {
                ASNTPQ.data.targets[id] = {
                    targetHalamanSesi
                };
            });
            clearTPQSelectedStudents();
            renderTPQTable();
        } else {
            alert("Gagal menerapkan target massal: " + ((res && res.message) || "Kesalahan server"));
        }
    } catch (e) {
        alert("Kesalahan jaringan saat menyimpan target massal.");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-bullseye"></i><span>Terapkan Target Massal</span>`;
        }
    }
}

// Window global exports
window.openTPQKelasModal = openTPQKelasModal;
window.closeTPQKelasModal = closeTPQKelasModal;
window.switchTPQKelasTab = switchTPQKelasTab;
window.submitNewTPQKelas = submitNewTPQKelas;
window.deleteTPQKelasConfirm = deleteTPQKelasConfirm;
window.openPlottingFromKelasCard = openPlottingFromKelasCard;
window.onSelectPlottingTPQKelas = onSelectPlottingTPQKelas;
window.filterTPQPlottingAvailableList = filterTPQPlottingAvailableList;
window.addStudentToTPQPlotting = addStudentToTPQPlotting;
window.removeStudentFromTPQPlotting = removeStudentFromTPQPlotting;
window.submitTPQPlotting = submitTPQPlotting;
window.resetTPQSesiForm = resetTPQSesiForm;
window.editTPQSesi = editTPQSesi;
window.submitTPQSesi = submitTPQSesi;
window.deleteTPQSesiConfirm = deleteTPQSesiConfirm;
window.toggleSelectAllTPQStudents = toggleSelectAllTPQStudents;
window.toggleSelectTPQStudent = toggleSelectTPQStudent;
window.clearTPQSelectedStudents = clearTPQSelectedStudents;
window.openTPQTargetModal = openTPQTargetModal;
window.closeTPQTargetModal = closeTPQTargetModal;
window.setTPQTargetChip = setTPQTargetChip;
window.recalculateTPQTargetWeekly = recalculateTPQTargetWeekly;
window.submitTPQTarget = submitTPQTarget;
window.openTPQBulkTargetModal = openTPQBulkTargetModal;
window.closeTPQBulkTargetModal = closeTPQBulkTargetModal;
window.setTPQBulkTargetScope = setTPQBulkTargetScope;
window.onTPQBulkTargetScopeChange = onTPQBulkTargetScopeChange;
window.setTPQBulkTargetChip = setTPQBulkTargetChip;
window.recalculateTPQBulkTargetWeekly = recalculateTPQBulkTargetWeekly;
window.submitTPQBulkTarget = submitTPQBulkTarget;
window.formatTPQTime = formatTPQTime;
window.renderTPQMatriksBeban = renderTPQMatriksBeban;

// ====================================================================
// MODAL DETAIL SANTRI & MUTABA'AH TPQ YANBU'A (ADOPTING SOROGAN)
// ====================================================================

let tpqRiwayatViewMode = 'card';

/**
 * Buka modal detail santri & mutaba'ah TPQ
 */
async function openTPQStudentDetail(studentId, viewerRole = null) {
    if (viewerRole) {
        ASNTPQ.viewerRole = viewerRole;
    } else if (typeof ASNIdentity !== 'undefined') {
        const r = String(ASNIdentity.currentRole || '').toUpperCase();
        if (r === 'WALI_SANTRI' || r === 'PARENT') {
            ASNTPQ.viewerRole = 'parent';
        } else if (r === 'PENGASUH') {
            ASNTPQ.viewerRole = 'pengasuh';
        } else {
            ASNTPQ.viewerRole = 'admin';
        }
    } else {
        ASNTPQ.viewerRole = 'admin';
    }

    const modal = document.getElementById('modal-tpq-detail');
    if (!modal) return;

    modal.classList.remove('hidden');
    ASNTPQ.detailActiveTab = 1;
    switchTPQDetailTab(1);

    const loader = document.getElementById('tpq-detail-loader');
    const errorBox = document.getElementById('tpq-detail-error');
    const errorText = document.getElementById('tpq-detail-error-text');
    const bodyBox = document.getElementById('tpq-detail-body');

    if (loader) loader.classList.remove('hidden');
    if (errorBox) errorBox.classList.add('hidden');
    if (bodyBox) bodyBox.classList.add('hidden');

    // Pre-populate student header from memory if available
    const existingStudent = (ASNTPQ.data.students || []).find(s => {
        const sId = String(s.studentId || s.student_id || s.id || '').trim();
        const sNis = String(s.nis || '').trim();
        const targetId = String(studentId || '').trim();
        return sId === targetId || sNis === targetId;
    });

    if (existingStudent) {
        const elName = document.getElementById('tpq-detail-name');
        const elNis = document.getElementById('tpq-detail-nis');
        const elAvatar = document.getElementById('tpq-detail-avatar');
        const kelasName = existingStudent.namaKelas || 'Kelas TPQ';

        if (elName) elName.innerText = existingStudent.name || "Santri";
        if (elNis) elNis.innerText = `NIS: ${existingStudent.nis || '-'} • Yanbu'a • ${escapeHtml(kelasName)}`;
        if (elAvatar) {
            const initials = (existingStudent.name || 'Santri').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
            elAvatar.innerHTML = existingStudent.photoUrl ? `<img src="${escapeHtml(existingStudent.photoUrl)}" class="w-full h-full object-cover rounded-2xl">` : initials;
        }
    }

    try {
        const token = getTPQToken();
        let response;
        try {
            response = await apiPost("getTPQStudentDetail", { token, studentId });
        } catch (apiErr) {
            response = await apiPost("getTPQStudentDetail", { studentId });
        }

        if (response && (response.success || response.status === "success")) {
            ASNTPQ.activeStudentDetail = response;
            if (loader) loader.classList.add('hidden');
            if (errorBox) errorBox.classList.add('hidden');
            if (bodyBox) bodyBox.classList.remove('hidden');
            renderTPQStudentDetailView();
        } else {
            if (loader) loader.classList.add('hidden');
            if (errorBox) errorBox.classList.remove('hidden');
            if (errorText) errorText.innerText = (response && response.message) || "Gagal memuat detail rapor mutaba'ah santri TPQ.";
        }
    } catch (err) {
        if (loader) loader.classList.add('hidden');
        if (errorBox) errorBox.classList.remove('hidden');
        if (errorText) errorText.innerText = "Terjadi gangguan jaringan saat memuat detail rapor mutaba'ah: " + err.message;
    }
}

/**
 * Tutup modal detail santri TPQ
 */
function closeTPQStudentDetail() {
    const modal = document.getElementById('modal-tpq-detail');
    if (modal) modal.classList.add('hidden');
}

/**
 * Alihkan tab pada modal detail santri TPQ
 */
function switchTPQDetailTab(tabIndex) {
    ASNTPQ.detailActiveTab = tabIndex;

    const tab1Btn = document.getElementById('btn-tpq-detail-tab-1');
    const tab2Btn = document.getElementById('btn-tpq-detail-tab-2');
    const tab3Btn = document.getElementById('btn-tpq-detail-tab-3');
    const panel1 = document.getElementById('panel-tpq-detail-tab-1');
    const panel2 = document.getElementById('panel-tpq-detail-tab-2');
    const panel3 = document.getElementById('panel-tpq-detail-tab-3');

    const activeClasses = "px-3 py-1.5 text-xs font-bold rounded-xl bg-teal-700 text-white shadow-sm transition flex items-center gap-1.5 shrink-0";
    const inactiveClasses = "px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 dark:bg-[#1c2836] text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition flex items-center gap-1.5 shrink-0";

    if (tab1Btn) tab1Btn.className = (tabIndex === 1) ? activeClasses : inactiveClasses;
    if (tab2Btn) tab2Btn.className = (tabIndex === 2) ? activeClasses : inactiveClasses;
    if (tab3Btn) tab3Btn.className = (tabIndex === 3) ? activeClasses : inactiveClasses;

    if (panel1) panel1.classList.toggle('hidden', tabIndex !== 1);
    if (panel2) panel2.classList.toggle('hidden', tabIndex !== 2);
    if (panel3) panel3.classList.toggle('hidden', tabIndex !== 3);

    if (tabIndex === 3) {
        renderTPQEstimasiKhatam();
    }
}

/**
 * Render detail view mutaba'ah santri TPQ Yanbu'a
 */
function renderTPQStudentDetailView() {
    const res = ASNTPQ.activeStudentDetail;
    if (!res) return;

    const st = res.student || {};
    const capaian = res.capaian || {};
    const stats = res.stats || {};
    const ind = res.indikator || {};
    const riwayat = res.riwayat || [];
    const target = res.target || {};

    const elName = document.getElementById('tpq-detail-name');
    const elNis = document.getElementById('tpq-detail-nis');
    const elAvatar = document.getElementById('tpq-detail-avatar');
    const elBadge = document.getElementById('tpq-detail-badge-status');
    const kelasName = st.kelas || res.kelas || 'Kelas TPQ';

    if (elName) elName.innerText = st.name || "Santri";
    if (elNis) elNis.innerText = `NIS: ${st.nis || '-'} • Yanbu'a • ${escapeHtml(kelasName)}`;
    if (elAvatar) {
        const initials = (st.name || 'Santri').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
        elAvatar.innerHTML = st.photoUrl ? `<img src="${escapeHtml(st.photoUrl)}" class="w-full h-full object-cover rounded-2xl">` : initials;
    }
    if (elBadge) {
        elBadge.innerText = (st.status === 'ACTIVE' || !st.status) ? "TPQ Aktif" : st.status;
    }

    const curJilid = (capaian.jilidAktif === 0 || String(capaian.jilidAktif).toLowerCase() === "pemula") ? 0 : Number(capaian.jilidAktif || 1);
    const halTerakhir = Number(capaian.halamanAktif || 1);
    const jInfo = YANBUA_JILID_INFO[curJilid] || { name: (curJilid === 0 ? "Pemula" : `Jilid ${curJilid}`), totalHalaman: 44 };
    const jName = jInfo.name;
    const halamanTuntas = getYanbuaCumulativePages(curJilid, halTerakhir);
    const percentOverall = Math.min(100, Math.round((halamanTuntas / TOTAL_YANBUA_PAGES) * 100));

    // 4 Stat Strip Cards
    const elStatCapaian = document.getElementById('tpq-detail-stat-capaian');
    const elStatTarget = document.getElementById('tpq-detail-stat-target');
    const elStatTotal = document.getElementById('tpq-detail-stat-total');
    const elStatNilai = document.getElementById('tpq-detail-stat-nilai');

    if (elStatCapaian) {
        elStatCapaian.innerHTML = `${jName} Hal ${halTerakhir} <span class="text-xs font-bold text-slate-400">(${percentOverall}%)</span>`;
    }
    if (elStatTarget) {
        const tgtJilid = target.targetJilid !== undefined ? target.targetJilid : 7;
        elStatTarget.innerText = (tgtJilid === 0 || String(tgtJilid).toLowerCase() === 'pemula') ? "Pemula" : `Jilid ${tgtJilid}`;
    }
    if (elStatTotal) {
        elStatTotal.innerText = `${riwayat.length} Kali`;
    }
    if (elStatNilai) {
        elStatNilai.innerText = stats.rataRataNilai || (res.realisasi && res.realisasi.avgNilai) || "Mumtaz (A)";
    }

    // Progress Yanbu'a (356 Halaman) Bar
    const elProgText = document.getElementById('tpq-detail-progress-text');
    const elProgBar = document.getElementById('tpq-detail-progress-bar');
    if (elProgText) {
        elProgText.innerText = `${jName} (Hal ${halTerakhir}/${jInfo.totalHalaman}) • ${halamanTuntas} / ${TOTAL_YANBUA_PAGES} Halaman (${percentOverall}%)`;
    }
    if (elProgBar) {
        elProgBar.style.width = `${percentOverall}%`;
    }

    // Tab 1 Indikator Harian, Pekanan, Bulanan
    const elDateHarian = document.getElementById('tpq-date-harian');
    if (elDateHarian && !elDateHarian.value) {
        elDateHarian.value = new Date().toISOString().split('T')[0];
    }

    const indH = ind.harian || {};
    const indP = ind.pekanan || {};
    const indB = ind.bulanan || {};

    const elIndHStatus = document.getElementById('tpq-ind-harian-status');
    const elIndHReal = document.getElementById('tpq-ind-harian-realita');
    const elIndHTgt = document.getElementById('tpq-ind-harian-target');

    if (elIndHStatus) {
        elIndHStatus.innerText = indH.status || (riwayat.length > 0 ? "Ada Simakan" : "Belum Ada Simakan");
        elIndHStatus.className = (indH.status && indH.status.includes("Ada"))
            ? "text-[9px] font-extrabold px-2 py-0.5 rounded bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300"
            : "text-[9px] font-extrabold px-2 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300";
    }
    if (elIndHReal) elIndHReal.innerText = indH.realitaText || "0 Halaman";
    if (elIndHTgt) elIndHTgt.innerText = indH.targetText || `${target.targetHarian || 1} Halaman / Sesi`;

    const elIndPStatus = document.getElementById('tpq-ind-pekan-status');
    const elIndPReal = document.getElementById('tpq-ind-pekan-realita');
    const elIndPTgt = document.getElementById('tpq-ind-pekan-target');
    const elIndPBar = document.getElementById('tpq-ind-pekan-bar');

    const weeklySessions = getTPQActiveWeeklySessionCounts();
    const fallbackTargetPekan = target.targetPekan || ((target.targetHarian || 1) * weeklySessions);
    const fallbackTargetBulan = target.targetBulan || (fallbackTargetPekan * 4);

    if (elIndPStatus) elIndPStatus.innerText = indP.status || "0% Capaian";
    if (elIndPReal) elIndPReal.innerText = indP.realitaText || "0 Halaman";
    if (elIndPTgt) elIndPTgt.innerText = indP.targetText || `${fallbackTargetPekan} Halaman`;
    if (elIndPBar) elIndPBar.style.width = `${Math.min(100, indP.percent || 0)}%`;

    const elIndBStatus = document.getElementById('tpq-ind-bulan-status');
    const elIndBReal = document.getElementById('tpq-ind-bulan-realita');
    const elIndBTgt = document.getElementById('tpq-ind-bulan-target');
    const elIndBBar = document.getElementById('tpq-ind-bulan-bar');

    if (elIndBStatus) elIndBStatus.innerText = indB.status || "0% Capaian";
    if (elIndBReal) elIndBReal.innerText = indB.realitaText || "0 Halaman";
    if (elIndBTgt) elIndBTgt.innerText = indB.targetText || `${fallbackTargetBulan} Halaman`;
    if (elIndBBar) elIndBBar.style.width = `${Math.min(100, indB.percent || 0)}%`;

    // Render Matriks 8 Tingkat Yanbu'a Grid (Pemula s.d. Jilid 7)
    const elJilidGrid = document.getElementById('tpq-detail-jilid-grid');
    if (elJilidGrid) {
        let gridHtml = '';
        for (let j = 0; j <= 7; j++) {
            const jItem = YANBUA_JILID_INFO[j] || { name: (j === 0 ? "Pemula" : `Jilid ${j}`), totalHalaman: 44 };
            const isCompleted = j < curJilid;
            const isCurrent = j === curJilid;

            let cardClass = "";
            let badgeText = "";
            if (isCompleted) {
                cardClass = "bg-teal-600 text-white border-teal-700 shadow-sm";
                badgeText = `<i class="fa-solid fa-check text-[10px]"></i>`;
            } else if (isCurrent) {
                cardClass = "bg-teal-50 dark:bg-teal-950/80 border-2 border-teal-500 text-teal-800 dark:text-teal-200 shadow-sm animate-pulse";
                badgeText = `<span class="text-[9px] font-black">Hal ${halTerakhir}</span>`;
            } else {
                cardClass = "bg-white dark:bg-[#1a2636] border border-slate-200 dark:border-[#283a4e] text-slate-400";
                badgeText = `<span class="text-[9px] text-slate-400">${jItem.totalHalaman} Hal</span>`;
            }

            gridHtml += `
                <div class="p-2 rounded-xl border flex flex-col items-center justify-center text-center transition ${cardClass}" title="${jItem.name} (${jItem.desc || ''})">
                    <span class="text-[11px] font-black">${jItem.name}</span>
                    ${badgeText}
                </div>
            `;
        }
        elJilidGrid.innerHTML = gridHtml;
    }

    // Tab 2 Riwayat Simakan - Dual View: Kartu Responsif (Default HP) & Tabel Lengkap
    const tbody = document.getElementById('tpq-detail-riwayat-tbody');
    const riwayatCardList = document.getElementById('tpq-detail-riwayat-card-list');
    const countBadge = document.getElementById('tpq-detail-riwayat-count-badge');
    const isParentOrPengasuh = ASNTPQ.viewerRole === 'parent' || ASNTPQ.viewerRole === 'pengasuh';

    if (countBadge) countBadge.innerText = riwayat.length;

    // 1. Render Tampilan Kartu Responsif (Default HP)
    if (riwayatCardList) {
        if (riwayat.length === 0) {
            riwayatCardList.innerHTML = `<div class="p-8 text-center text-slate-400">Belum ada riwayat simakan TPQ Yanbu'a.</div>`;
        } else {
            riwayatCardList.innerHTML = riwayat.map(r => {
                const isUlang = r.statusSetoran === 'ULANG';
                const statusBadge = isUlang
                    ? `<span class="px-2 py-0.5 rounded text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950 dark:text-rose-300">Wajib Ulang</span>`
                    : `<span class="px-2 py-0.5 rounded text-[10px] font-black bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950 dark:text-teal-300">Lancar</span>`;
                const rJilidName = (r.jilid === 0 || String(r.jilid).toLowerCase() === "pemula") ? "Pemula" : `Jilid ${r.jilid}`;

                return `
                <div class="p-3 bg-slate-50 dark:bg-[#1c2836] rounded-2xl border border-slate-200/70 dark:border-[#283a4e] space-y-2">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100">
                            <i class="fa-regular fa-calendar text-teal-600 text-xs"></i>
                            <span>${r.tanggal || "-"}</span>
                            <span class="text-[10px] text-slate-400 font-normal">(${escapeHtml(r.sesi || "Sore")})</span>
                        </div>
                        <div class="flex items-center gap-1">
                            ${statusBadge}
                            ${isParentOrPengasuh ? '' : `
                            <button type="button" onclick="deleteTPQSimakanLog('${escapeHtml(r.logId || "")}')" class="w-6 h-6 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300 flex items-center justify-center text-[10px] transition shrink-0 ml-1" title="Hapus Catatan Ini">
                                <i class="fa-solid fa-trash"></i>
                            </button>`}
                        </div>
                    </div>

                    <div class="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 dark:border-[#253447]">
                        <div class="font-extrabold text-teal-700 dark:text-teal-300">
                            ${rJilidName} • Halaman ${r.halaman || 1}
                        </div>
                        <div class="text-[10px] font-bold text-slate-500">
                            Nilai: <span class="text-teal-600 dark:text-teal-400 font-black">${escapeHtml(r.nilai || "MUMTAZ")}</span>
                        </div>
                    </div>

                    ${(r.ustadz || r.catatan) ? `
                    <div class="flex items-center justify-between gap-2 text-[10px] text-slate-400 pt-0.5">
                        <div class="truncate">
                            <i class="fa-solid fa-chalkboard-user text-[9px] text-teal-600 mr-1"></i>
                            <span class="font-semibold text-slate-600 dark:text-slate-300">${escapeHtml(r.ustadz || "-")}</span>
                        </div>
                        ${r.catatan ? `<div class="italic truncate max-w-[160px]" title="${escapeHtml(r.catatan)}">${escapeHtml(r.catatan)}</div>` : ''}
                    </div>` : ''}
                </div>`;
            }).join('');
        }
    }

    // 2. Render Tampilan Tabel Lengkap
    if (tbody) {
        if (riwayat.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-slate-400">Belum ada riwayat simakan TPQ Yanbu'a.</td></tr>`;
        } else {
            tbody.innerHTML = riwayat.map(r => {
                const isUlang = r.statusSetoran === 'ULANG';
                const statusBadge = isUlang
                    ? `<span class="px-2 py-0.5 rounded text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950 dark:text-rose-300">Wajib Ulang</span>`
                    : `<span class="px-2 py-0.5 rounded text-[10px] font-black bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950 dark:text-teal-300">Lancar</span>`;
                const rJilidName = (r.jilid === 0 || String(r.jilid).toLowerCase() === "pemula") ? "Pemula" : `Jilid ${r.jilid}`;

                return `
                <tr class="hover:bg-slate-50/80 dark:hover:bg-[#1a2636]/60 transition border-b border-slate-100 dark:border-[#202f42]">
                    <td class="py-2.5 px-3">
                        <div class="font-bold text-slate-800 dark:text-slate-100">${r.tanggal || "-"}</div>
                        <div class="text-[10px] text-slate-400">${escapeHtml(r.sesi || "Sore")}</div>
                    </td>
                    <td class="py-2.5 px-3">
                        <div class="font-bold text-teal-700 dark:text-teal-300">${rJilidName}</div>
                        <div class="text-[10px] text-slate-400">Halaman: ${r.halaman || 1}</div>
                    </td>
                    <td class="py-2.5 px-3">
                        ${statusBadge}
                        <div class="text-[10px] font-semibold text-slate-500 mt-0.5">Nilai: ${escapeHtml(r.nilai || "MUMTAZ")}</div>
                    </td>
                    <td class="py-2.5 px-3">
                        <div class="font-semibold text-slate-700 dark:text-slate-200">${escapeHtml(r.ustadz || "-")}</div>
                        <div class="text-[10px] text-slate-400 italic">${escapeHtml(r.catatan || "-")}</div>
                    </td>
                    <td class="py-2.5 px-3 text-right">
                        ${isParentOrPengasuh ? '<span class="text-[9px] font-semibold text-slate-400">Tercatat</span>' : `
                        <button type="button" onclick="deleteTPQSimakanLog('${escapeHtml(r.logId || "")}')" class="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition" title="Hapus Catatan Ini">
                            <i class="fa-solid fa-trash text-xs"></i>
                        </button>`}
                    </td>
                </tr>
                `;
            }).join('');
        }
    }

    setTPQRiwayatView(tpqRiwayatViewMode);
    renderTPQEstimasiKhatam();
}

/**
 * Ganti mode tampilan riwayat simakan TPQ: 'card' (optimal HP tanpa scroll) atau 'table' (tabel lengkap)
 */
function setTPQRiwayatView(mode) {
    tpqRiwayatViewMode = mode;
    const cardList = document.getElementById('tpq-detail-riwayat-card-list');
    const tableWrapper = document.getElementById('tpq-detail-riwayat-table-wrapper');
    const btnCard = document.getElementById('btn-tpq-view-card');
    const btnTable = document.getElementById('btn-tpq-view-table');

    if (!cardList || !tableWrapper) return;

    if (mode === 'table') {
        cardList.classList.add('hidden');
        tableWrapper.classList.remove('hidden');
        if (btnTable) btnTable.className = "px-2 py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-[#15202d] text-teal-700 dark:text-teal-300 shadow-sm transition";
        if (btnCard) btnCard.className = "px-2 py-1 rounded-lg text-[10px] font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition";
    } else {
        cardList.classList.remove('hidden');
        tableWrapper.classList.add('hidden');
        if (btnCard) btnCard.className = "px-2 py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-[#15202d] text-teal-700 dark:text-teal-300 shadow-sm transition";
        if (btnTable) btnTable.className = "px-2 py-1 rounded-lg text-[10px] font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition";
    }
}

/**
 * Render estimasi khatam TPQ Yanbu'a (356 Halaman Total)
 */
function renderTPQEstimasiKhatam() {
    const res = ASNTPQ.activeStudentDetail;
    if (!res) return;

    const capaian = res.capaian || {};
    const riwayat = res.riwayat || [];
    const target = res.target || {};

    const curJilid = (capaian.jilidAktif === 0 || String(capaian.jilidAktif).toLowerCase() === "pemula") ? 0 : Number(capaian.jilidAktif || 1);
    const halTerakhir = Number(capaian.halamanAktif || 1);
    const halamanTuntas = Math.min(TOTAL_YANBUA_PAGES, getYanbuaCumulativePages(curJilid, halTerakhir));
    const sisaHalaman = Math.max(0, TOTAL_YANBUA_PAGES - halamanTuntas);
    const persenMilestone = Math.min(100, Math.round((halamanTuntas / TOTAL_YANBUA_PAGES) * 100));

    // Laju simakan per pekan
    const lancarLogs = riwayat.filter(r => r.statusSetoran !== 'ULANG');
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const logs30Days = lancarLogs.filter(r => new Date(r.tanggal || r.createdAt) >= thirtyDaysAgo);
    let hal30Days = logs30Days.length; // Setiap setoran bernilai ~1 halaman
    let lajuPerPekan = Math.round((hal30Days / 4.2) * 10) / 10;

    const weeklySessions = getTPQActiveWeeklySessionCounts();
    if (lajuPerPekan <= 0) {
        lajuPerPekan = target.targetHarian ? Math.round(target.targetHarian * weeklySessions * 10) / 10 : 11.0;
    }

    const lajuPerBulan = Math.round(lajuPerPekan * 4 * 10) / 10;
    const durasiMinggu = lajuPerPekan > 0 ? Math.ceil(sisaHalaman / lajuPerPekan) : 52;
    const durasiBulan = Math.round((durasiMinggu / 4.2) * 10) / 10;

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + (durasiMinggu * 7));
    const bulanNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const targetBulanTahun = `${bulanNames[targetDate.getMonth()]} ${targetDate.getFullYear()}`;

    // Update DOM Estimasi
    const elKhatamText = document.getElementById('tpq-estimasi-khatam-bulan-tahun');
    const elDurasiText = document.getElementById('tpq-estimasi-khatam-durasi');
    const elLajuText = document.getElementById('tpq-estimasi-laju-text');
    const elLajuSub = document.getElementById('tpq-estimasi-laju-sub');
    const elTuntas = document.getElementById('tpq-estimasi-halaman-tuntas');
    const elSisa = document.getElementById('tpq-estimasi-sisa-halaman');
    const elMeterBar = document.getElementById('tpq-estimasi-meter-bar');

    if (elKhatamText) elKhatamText.innerText = sisaHalaman === 0 ? "Khatam Yanbu'a!" : targetBulanTahun;
    if (elDurasiText) elDurasiText.innerText = sisaHalaman === 0 ? "(Telah Selesai)" : `(± ${Math.ceil(durasiBulan)} Bulan lagi)`;
    if (elLajuText) elLajuText.innerText = `${lajuPerPekan} Hal / Pekan`;
    if (elLajuSub) elLajuSub.innerText = `${lajuPerBulan} Hal / Bulan`;
    if (elTuntas) elTuntas.innerText = halamanTuntas;
    if (elSisa) elSisa.innerText = `Sisa ${sisaHalaman} Halaman`;
    if (elMeterBar) elMeterBar.style.width = `${persenMilestone}%`;

    // 3 Skenario Waktu Khatam
    const elSken1 = document.getElementById('tpq-skenario-riil-date');
    const elSken2 = document.getElementById('tpq-skenario-target-date');
    const elSken3 = document.getElementById('tpq-skenario-akselerasi-date');

    if (elSken1) {
        elSken1.innerText = `${targetBulanTahun} (~${Math.ceil(durasiBulan)} bln)`;
    }

    if (elSken2) {
        const targetPekanVal = target.targetPekan || (weeklySessions * (target.targetHarian || 1));
        const mingguTarget = targetPekanVal > 0 ? Math.ceil(sisaHalaman / targetPekanVal) : 52;
        const bulanTarget = Math.round((mingguTarget / 4.2) * 10) / 10;
        const dTarget = new Date();
        dTarget.setDate(dTarget.getDate() + (mingguTarget * 7));
        elSken2.innerText = `${bulanNames[dTarget.getMonth()]} ${dTarget.getFullYear()} (~${Math.ceil(bulanTarget)} bln)`;
    }

    if (elSken3) {
        const speedAkselerasi = weeklySessions * 1; // 1 hal per sesi
        const mingguAks = speedAkselerasi > 0 ? Math.ceil(sisaHalaman / speedAkselerasi) : 30;
        const bulanAks = Math.round((mingguAks / 4.2) * 10) / 10;
        const dAks = new Date();
        dAks.setDate(dAks.getDate() + (mingguAks * 7));
        elSken3.innerText = `${bulanNames[dAks.getMonth()]} ${dAks.getFullYear()} (~${Math.ceil(bulanAks)} bln)`;
    }
}

/**
 * Filter tanggal indikator harian TPQ
 */
function onChangeTPQIndikatorDate(type, dateStr) {
    if (!dateStr || !ASNTPQ.activeStudentDetail) return;
    const riwayat = ASNTPQ.activeStudentDetail.riwayat || [];
    const targetHarian = (ASNTPQ.activeStudentDetail.target && ASNTPQ.activeStudentDetail.target.targetHarian) || 1;

    const filtered = riwayat.filter(r => r.tanggal === dateStr);
    const count = filtered.length;
    const realHalaman = count * 1;

    const elIndHStatus = document.getElementById('tpq-ind-harian-status');
    const elIndHReal = document.getElementById('tpq-ind-harian-realita');
    const elIndHTgt = document.getElementById('tpq-ind-harian-target');

    if (elIndHStatus) {
        elIndHStatus.innerText = count > 0 ? `Ada Simakan (${count}x)` : "Belum Ada Simakan";
        elIndHStatus.className = count > 0
            ? "text-[9px] font-extrabold px-2 py-0.5 rounded bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300"
            : "text-[9px] font-extrabold px-2 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300";
    }
    if (elIndHReal) elIndHReal.innerText = `${realHalaman} Halaman (${count}x Simak)`;
    if (elIndHTgt) elIndHTgt.innerText = `${targetHarian} Halaman / Sesi`;
}

/**
 * Tombol preset tanggal indikator harian
 */
function setTPQIndikatorPreset(preset) {
    const el = document.getElementById('tpq-date-harian');
    if (!el) return;

    const d = new Date();
    if (preset === 'yesterday') {
        d.setDate(d.getDate() - 1);
    }
    const val = d.toISOString().split('T')[0];
    el.value = val;
    onChangeTPQIndikatorDate('daily', val);
}

/**
 * Hapus catatan log simakan TPQ
 */
async function deleteTPQSimakanLog(logId) {
    if (!logId) return;
    if (!confirm("Apakah Anda yakin ingin menghapus catatan simakan ini?")) return;

    try {
        const token = getTPQToken();
        const res = await apiPost("deleteTPQLog", { token, logId });
        if (res && (res.success || res.status === "success")) {
            if (typeof showToast === 'function') showToast("✅ Catatan simakan TPQ berhasil dihapus.");
            if (ASNTPQ.activeStudentDetail && ASNTPQ.activeStudentDetail.student) {
                openTPQStudentDetail(ASNTPQ.activeStudentDetail.student.studentId);
            }
            loadAdminTPQData(true);
        } else {
            alert("Gagal menghapus catatan: " + ((res && res.message) || "Terjadi kesalahan."));
        }
    } catch (e) {
        alert("Kesalahan jaringan saat menghapus catatan: " + e.message);
    }
}

/**
 * Cetak rapor mutaba'ah santri TPQ Yanbu'a
 */
function printTPQStudentMutabaah() {
    const res = ASNTPQ.activeStudentDetail;
    if (!res || !res.student) {
        alert("Data mutaba'ah santri belum siap dicetak.");
        return;
    }

    const st = res.student;
    const capaian = res.capaian || {};
    const stats = res.stats || {};
    const riwayat = res.riwayat || [];
    const curJilid = (capaian.jilidAktif === 0 || String(capaian.jilidAktif).toLowerCase() === "pemula") ? 0 : Number(capaian.jilidAktif || 1);
    const jInfo = YANBUA_JILID_INFO[curJilid] || { name: (curJilid === 0 ? "Pemula" : `Jilid ${curJilid}`), totalHalaman: 44 };
    const halamanTuntas = getYanbuaCumulativePages(curJilid, capaian.halamanAktif || 1);
    const persen = Math.min(100, Math.round((halamanTuntas / TOTAL_YANBUA_PAGES) * 100));

    const printWin = window.open('', '_blank');
    if (!printWin) {
        alert("Izinkan pop-up peramban untuk mencetak rapor.");
        return;
    }

    const rowsHtml = riwayat.slice(0, 25).map((r, i) => `
        <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${i + 1}</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px;">${r.tanggal || '-'} (${escapeHtml(r.sesi || '-')})</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: bold;">${(r.jilid === 0 || String(r.jilid).toLowerCase() === 'pemula') ? 'Pemula' : 'Jilid ' + r.jilid} Hal ${r.halaman || 1}</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${r.statusSetoran === 'ULANG' ? 'Wajib Ulang' : 'Lancar'}</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${escapeHtml(r.nilai || 'MUMTAZ')}</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px;">${escapeHtml(r.ustadz || '-')}</td>
        </tr>
    `).join('');

    printWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Rapor Mutaba'ah TPQ Yanbu'a - ${escapeHtml(st.name)}</title>
            <style>
                body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; padding: 20px; line-height: 1.4; }
                .header { text-align: center; border-bottom: 2px solid #0d9488; padding-bottom: 10px; margin-bottom: 15px; }
                .header h2 { margin: 0; color: #0f766e; }
                .header p { margin: 2px 0; color: #64748b; font-size: 11px; }
                .info-table { width: 100%; margin-bottom: 15px; }
                .info-table td { padding: 4px; }
                .metric-box { display: flex; gap: 10px; margin-bottom: 15px; }
                .metric-card { flex: 1; border: 1px solid #0d9488; border-radius: 8px; padding: 8px; text-align: center; background: #f0fdfa; }
                .metric-card b { display: block; font-size: 14px; color: #0f766e; }
                table.data { width: 100%; border-collapse: collapse; margin-top: 10px; }
                table.data th { background: #0d9488; color: white; border: 1px solid #0f766e; padding: 6px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h2>LEMBAR MUTABA'AH TPQ YANBU'A</h2>
                <p>Pondok Pesantren Mubarokah • Bimbingan Tartil Al-Qur'an Yanbu'a</p>
            </div>
            <table class="info-table">
                <tr>
                    <td width="15%"><b>Nama Santri</b></td><td width="35%">: ${escapeHtml(st.name)}</td>
                    <td width="15%"><b>Kelas TPQ</b></td><td width="35%">: ${escapeHtml(st.kelas || '-')}</td>
                </tr>
                <tr>
                    <td><b>NIS</b></td><td>: ${escapeHtml(st.nis || '-')}</td>
                    <td><b>Ustadz Pengampu</b></td><td>: ${escapeHtml(st.ustadz || '-')}</td>
                </tr>
            </table>
            <div class="metric-box">
                <div class="metric-card"><span>Capaian Saat Ini</span><b>${jInfo.name} Hal ${capaian.halamanAktif || 1}</b></div>
                <div class="metric-card"><span>Progress Kumulatif</span><b>${halamanTuntas} / ${TOTAL_YANBUA_PAGES} Hal (${persen}%)</b></div>
                <div class="metric-card"><span>Total Simakan</span><b>${riwayat.length} Kali</b></div>
                <div class="metric-card"><span>Rata-Rata Nilai</span><b>${escapeHtml(stats.rataRataNilai || 'Mumtaz (A)')}</b></div>
            </div>
            <h4>Riwayat Simakan Terbaru:</h4>
            <table class="data">
                <thead>
                    <tr>
                        <th width="5%">No</th>
                        <th width="20%">Tanggal / Sesi</th>
                        <th width="25%">Jenjang & Halaman</th>
                        <th width="15%">Hasil</th>
                        <th width="15%">Nilai</th>
                        <th width="20%">Ustadz</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml || '<tr><td colspan="6" style="text-align: center; padding: 10px;">Belum ada data simakan.</td></tr>'}
                </tbody>
            </table>
            <script>
                window.onload = function() { window.print(); }
            </script>
        </body>
        </html>
    `);
    printWin.document.close();
}

window.openTPQStudentDetail = openTPQStudentDetail;
window.closeTPQStudentDetail = closeTPQStudentDetail;
window.switchTPQDetailTab = switchTPQDetailTab;
window.renderTPQStudentDetailView = renderTPQStudentDetailView;
window.setTPQRiwayatView = setTPQRiwayatView;
window.renderTPQEstimasiKhatam = renderTPQEstimasiKhatam;
window.onChangeTPQIndikatorDate = onChangeTPQIndikatorDate;
window.setTPQIndikatorPreset = setTPQIndikatorPreset;
window.deleteTPQSimakanLog = deleteTPQSimakanLog;
window.printTPQStudentMutabaah = printTPQStudentMutabaah;


