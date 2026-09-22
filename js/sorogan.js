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
        try { sessionStorage.removeItem(SOROGAN_CACHE_KEY); } catch (e) {}
        ASNSorogan.cache = null;
    }

    let hasRenderedFromCache = false;
    if (!forceRefresh) {
        let cached = ASNSorogan.cache;
        if (!cached) {
            try {
                const stored = sessionStorage.getItem(SOROGAN_CACHE_KEY);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (parsed && parsed.data && (Date.now() - (parsed.timestamp || 0) < SOROGAN_CACHE_TTL_MS)) {
                        cached = parsed.data;
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
        }
    }

    if (!hasRenderedFromCache) {
        if (loader) loader.classList.remove('hidden');
        if (emptyState) emptyState.classList.add('hidden');
    }

    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(SOROGAN_STORAGE_KEYS.adminToken)) || "";
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
                sessionStorage.setItem(SOROGAN_CACHE_KEY, JSON.stringify({ data: response, timestamp: Date.now() }));
            } catch (e) {}

            renderSoroganSummaryCards();
            populateSoroganFilters();
            populateSoroganProgramDropdown();
            populateSoroganMuallimDropdown();
            filterSoroganList();
        } else if (response && (response.message || response.error)) {
            console.warn("Respon Sorogan gagal:", response.message || response.error);
        }
    } catch (err) {
        console.error("Gagal sinkronisasi data Sorogan:", err);
    } finally {
        if (loader) loader.classList.add('hidden');
        if (refreshIcon) refreshIcon.classList.remove('fa-spin');
    }
}

/**
 * Render kartu ringkasan Sorogan
 */
function renderSoroganSummaryCards() {
    const sum = ASNSorogan.data.summary || {};

    const elTotal = document.getElementById('sorogan-stat-total-santri');
    const elAvgJuz = document.getElementById('sorogan-stat-avg-juz');
    const elKhatam = document.getElementById('sorogan-stat-khatam');
    const elPersen = document.getElementById('sorogan-stat-persen-lanjut');

    if (elTotal) elTotal.innerText = sum.totalSantri || 0;
    if (elAvgJuz) elAvgJuz.innerText = `Juz ${sum.rataRataJuz || '1.0'}`;
    if (elKhatam) elKhatam.innerText = `${sum.khatam30Juz || 0} Santri`;
    if (elPersen) elPersen.innerText = `${sum.persentaseLanjut || 100}%`;
}

/**
 * Isi filter halaqah & juz
 */
function populateSoroganFilters() {
    const filterHalaqah = document.getElementById('sorogan-filter-halaqah');
    if (filterHalaqah && Array.isArray(ASNSorogan.data.halaqahs)) {
        const currentVal = filterHalaqah.value;
        let opt = '<option value="ALL">Semua Halaqah Sorogan</option>';
        ASNSorogan.data.halaqahs.forEach(h => {
            opt += `<option value="${escapeHtml(h.halaqahId)}">${escapeHtml(h.namaHalaqah)}</option>`;
        });
        filterHalaqah.innerHTML = opt;
        if (currentVal) filterHalaqah.value = currentVal;
    }
}

/**
 * Filter santri sorogan
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

        if (selHalaqah !== "ALL" && st.halaqahId !== selHalaqah) return false;
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
    const emptyState = document.getElementById('admin-sorogan-empty');
    const countEl = document.getElementById('admin-sorogan-count');

    const list = ASNSorogan.filteredStudents || [];

    if (countEl) {
        countEl.innerText = `${list.length} Santri`;
    }

    if (!tbody) return;

    if (list.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    const selectedSet = ASNSorogan.selectedStudentIds || new Set();
    const targets = (ASNSorogan.data && ASNSorogan.data.targets) || {};

    let html = '';
    list.forEach((st, idx) => {
        const surahRef = SOROGAN_JUZ_SURAH_REF[st.juzAktif] || "Al-Qur'an 30 Juz";
        const isUlang = st.statusTerakhir === 'ULANG';
        const isChecked = selectedSet.has(st.studentId);

        const statusBadge = isUlang
            ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300"><i class="fa-solid fa-rotate-left"></i> Wajib Mengulang</span>`
            : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/50 dark:text-sky-300"><i class="fa-solid fa-circle-check"></i> Lancar (Lanjut)</span>`;

        // Progress bar per Juz (20 halaman)
        const hal = Math.min(20, Math.max(1, st.halamanTerakhir || 1));
        const percentJuz = Math.round((hal / 20) * 100);

        // Target Info
        const tgt = targets[st.studentId] || st.target || {
            targetJuz: Math.min(30, (st.juzAktif || 1) + 1),
            targetHalamanSesi: 2
        };

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
                        <div class="flex items-center gap-2">
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-black bg-sky-50 text-sky-800 border border-sky-200 dark:bg-sky-950 dark:text-sky-300">
                                <i class="fa-solid fa-book-bookmark text-xs"></i>
                                <span>Juz ${st.juzAktif || 1}</span>
                            </span>
                            <span class="text-xs font-bold text-slate-700 dark:text-slate-200">
                                Halaman <strong class="text-sky-600 dark:text-sky-400 font-black">${hal}</strong> / 20
                            </span>
                        </div>
                        <div class="text-[10px] text-slate-400 truncate max-w-[200px]" title="${escapeHtml(surahRef)}">
                            ${escapeHtml(surahRef)}
                        </div>
                        <div class="w-28 bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                            <div class="bg-sky-600 h-full rounded-full transition-all" style="width: ${percentJuz}%;"></div>
                        </div>
                    </div>
                </td>
                <td class="p-3">
                    <button type="button" onclick="openSoroganTargetModal('${escapeHtml(st.studentId)}')"
                        class="text-left group/tgt hover:opacity-80 transition" title="Klik untuk atur target">
                        <div class="flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200">
                            <i class="fa-solid fa-bullseye text-[10px] text-amber-500"></i>
                            <span>Target Juz ${tgt.targetJuz || Math.min(30, (st.juzAktif || 1) + 1)}</span>
                        </div>
                        <div class="text-[10px] text-slate-400 group-hover/tgt:text-sky-600 font-medium">
                            ${tgt.targetHalamanSesi || 2} Hal/Sesi (${(tgt.targetHalamanSesi || 2) * 6} Hal/Pekan)
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

    tbody.innerHTML = html;
    updateSoroganBulkSelectionBar();
}

/**
 * Buka modal Simak Sorogan Al-Qur'an (Grid 20 Halaman per Juz)
 */
function openSimakSoroganModal(studentId) {
    const st = (ASNSorogan.data.students || []).find(s => s.studentId === studentId);
    if (!st) return;

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
        sesi: "Pagi (Ba'da Subuh)"
    };

    const elName = document.getElementById('sorogan-simak-modal-name');
    const elNis = document.getElementById('sorogan-simak-modal-nis');
    const elJuz = document.getElementById('sorogan-simak-modal-juz');
    const elMuallim = document.getElementById('sorogan-simak-modal-muallim');
    const elCatatan = document.getElementById('sorogan-simak-modal-catatan');

    if (elName) elName.innerText = st.name;
    if (elNis) elNis.innerText = `NIS: ${st.nis || "-"}`;
    if (elJuz) elJuz.value = ASNSorogan.simakState.juz;
    if (elMuallim) elMuallim.value = ASNSorogan.simakState.muallim;
    if (elCatatan) elCatatan.value = "";

    onSoroganJuzChanged();
    selectSoroganQuickStatus("LANJUT");
    selectSoroganQuickNilai("MUMTAZ");

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
 * Status simakan sorogan
 */
function selectSoroganQuickStatus(status) {
    ASNSorogan.simakState.statusSetoran = status;

    document.querySelectorAll('.sorogan-btn-status').forEach(btn => {
        if (btn.dataset.status === status) {
            btn.classList.add('ring-2', 'ring-offset-1', 'font-black');
            if (status === 'LANJUT') btn.classList.add('ring-sky-500', 'bg-sky-600', 'text-white');
            else if (status === 'ULANG') btn.classList.add('ring-rose-500', 'bg-rose-600', 'text-white');
            else if (status === 'KHATAM_30JUZ') btn.classList.add('ring-amber-500', 'bg-amber-600', 'text-white');
        } else {
            btn.classList.remove('ring-2', 'ring-offset-1', 'font-black', 'bg-sky-600', 'bg-rose-600', 'bg-amber-600', 'text-white');
        }
    });
}

function selectSoroganQuickNilai(nilai) {
    ASNSorogan.simakState.nilai = nilai;
    document.querySelectorAll('.sorogan-btn-nilai').forEach(btn => {
        if (btn.dataset.nilai === nilai) {
            btn.classList.add('bg-sky-600', 'text-white', 'font-bold');
            btn.classList.remove('bg-slate-100', 'text-slate-700');
        } else {
            btn.classList.remove('bg-sky-600', 'text-white', 'font-bold');
            btn.classList.add('bg-slate-100', 'text-slate-700');
        }
    });
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

    const selectedPages = ASNSorogan.simakState.selectedPages || [1];

    const payload = {
        studentId: ASNSorogan.simakState.studentId,
        studentName: ASNSorogan.simakState.studentName,
        nis: ASNSorogan.simakState.nis,
        juz: elJuz ? Number(elJuz.value) : ASNSorogan.simakState.juz,
        halamanList: selectedPages,
        totalHalaman: selectedPages.length,
        statusSetoran: ASNSorogan.simakState.statusSetoran,
        nilai: ASNSorogan.simakState.nilai,
        muallim: elMuallim ? elMuallim.value.trim() : ASNSorogan.simakState.muallim,
        catatan: elCatatan ? elCatatan.value.trim() : "",
        tanggal: new Date().toISOString().substring(0, 10),
        sesi: "Pagi (Ba'da Subuh)"
    };

    if (btn) {
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
            alert("Gagal mencatat sorogan: " + (res && res.message ? res.message : "Kesalahan server"));
        }
    } catch (err) {
        alert("Terjadi kesalahan jaringan saat menyimpan sorogan.");
    } finally {
        if (btn) {
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
                <i class="fa-solid fa-layer-group"></i>
            </div>
            <p class="text-xs font-bold text-slate-700 dark:text-slate-200">Belum Ada Halaqah Sorogan Aktif</p>
            <p class="text-[10px] text-slate-400 max-w-sm mx-auto">Silakan buat kelompok halaqah sorogan baru di atas untuk mulai memplot santri.</p>
        </div>`;
        return;
    }

    const students = ASNSorogan.data.students || [];

    container.innerHTML = halaqahs.map((h, i) => {
        const enrolledCount = Array.isArray(h.studentIds) ? h.studentIds.length : (
            students.filter(s => s.halaqahId === h.halaqahId).length
        );

        return `
        <div class="p-4 bg-slate-50 dark:bg-[#1c2836] rounded-2xl border border-slate-200 dark:border-[#283a4e] space-y-3 relative group">
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="font-black text-sm text-slate-800 dark:text-slate-100">${escapeHtml(h.namaHalaqah)}</h4>
                    <span class="inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                        ${escapeHtml(h.kategori || h.kategoriProgram || 'Sorogan Binnazhar')}
                    </span>
                </div>
                <div class="flex items-center space-x-1.5">
                    <button type="button" onclick="deleteSoroganHalaqahConfirm('${h.halaqahId}', '${escapeHtml(h.namaHalaqah)}')" class="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300 flex items-center justify-center text-[10px] transition" title="Hapus Halaqah">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                    <span class="w-7 h-7 rounded-lg bg-white dark:bg-[#15202d] text-slate-500 dark:text-slate-300 flex items-center justify-center text-xs font-bold shadow-sm">
                        ${String.fromCharCode(65 + (i % 26))}
                    </span>
                </div>
            </div>
            <div class="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                <p class="flex items-center gap-1.5 truncate font-semibold">
                    <i class="fa-solid fa-user-tie text-sky-600"></i>
                    <span>${escapeHtml(h.muallim || h.muallimPengampu || 'Mu\'allim Pengampu')}</span>
                </p>
                <p class="text-[10px] text-slate-400 truncate">
                    <i class="fa-solid fa-book-open mr-1"></i> ${escapeHtml(h.targetKurikulum || h.jadwalSesi || 'Sorogan Binnazhar Mushaf Pojok 30 Juz')}
                </p>
            </div>
            <div class="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-[#283a4e] text-xs">
                <span class="font-bold text-slate-700 dark:text-slate-300">${enrolledCount} Santri Terdaftar</span>
                <button type="button" onclick="openPlottingFromHalaqahCard('${h.halaqahId}')" class="px-3 py-1 bg-white dark:bg-[#15202d] hover:bg-sky-50 text-sky-700 dark:text-sky-300 font-bold rounded-lg border border-slate-200 dark:border-[#283a4e] text-[10px] transition flex items-center gap-1">
                    <i class="fa-solid fa-user-plus text-[9px]"></i>
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

    const inputNama = document.getElementById('input-sorogan-halaqah-nama');
    const inputKat = document.getElementById('input-sorogan-halaqah-kategori');
    const inputMuallim = document.getElementById('input-sorogan-halaqah-muallim');
    const inputTarget = document.getElementById('input-sorogan-halaqah-target');
    const btn = document.getElementById('btn-submit-sorogan-halaqah');

    const namaHalaqah = inputNama ? inputNama.value.trim() : "";
    const kategori = inputKat ? inputKat.value.trim() : "";
    const muallim = inputMuallim ? inputMuallim.value.trim() : "";
    const targetDeskripsi = inputTarget ? inputTarget.value.trim() : "";

    if (!namaHalaqah || !muallim) {
        alert("Nama halaqah dan Mu'allim pengampu wajib diisi!");
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Menyimpan...`;
    }

    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(SOROGAN_STORAGE_KEYS.adminToken)) || "";
        const res = await apiPost("saveSoroganHalaqah", {
            token,
            namaHalaqah,
            kategori,
            kategoriProgram: kategori,
            muallim,
            muallimPengampu: muallim,
            targetKurikulum: targetDeskripsi || "Sorogan Binnazhar Mushaf Pojok 30 Juz",
            jadwalSesi: targetDeskripsi || "Sorogan Binnazhar Mushaf Pojok 30 Juz",
            studentIds: []
        });

        if (res && (res.success || res.status === "success")) {
            if (typeof showToast === 'function') showToast(res.message || "Halaqah Sorogan berhasil ditambahkan!");
            if (inputNama) inputNama.value = '';
            if (inputTarget) inputTarget.value = '';

            const newH = {
                halaqahId: res.halaqahId || ("HLQ-SRG-" + Date.now().toString().substring(8)),
                namaHalaqah,
                kategori,
                kategoriProgram: kategori,
                muallim,
                muallimPengampu: muallim,
                targetKurikulum: targetDeskripsi || "Sorogan Binnazhar Mushaf Pojok 30 Juz",
                jadwalSesi: targetDeskripsi || "Sorogan Binnazhar Mushaf Pojok 30 Juz",
                studentIds: []
            };
            ASNSorogan.data.halaqahs = ASNSorogan.data.halaqahs || [];
            ASNSorogan.data.halaqahs.push(newH);

            renderSoroganHalaqahCards();
            populateSoroganFilters();
            loadAdminSoroganData(true);
        } else {
            alert("Gagal menyimpan halaqah: " + ((res && res.message) || "Kesalahan server"));
        }
    } catch (err) {
        alert("Terjadi kesalahan jaringan saat menyimpan halaqah Sorogan.");
    } finally {
        if (btn) {
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
            alert("Gagal menghapus: " + ((res && res.message) || "Error"));
        }
    } catch (e) {
        alert("Kesalahan jaringan saat menghapus halaqah.");
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
    sel.innerHTML = halaqahs.map(h => `<option value="${escapeHtml(h.halaqahId)}">${escapeHtml(h.namaHalaqah)}</option>`).join('');

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
        alert("Pilih halaqah Sorogan terlebih dahulu.");
        return;
    }

    const halaqahId = ASNSorogan.activePlottingHalaqah.halaqahId;
    const studentIds = ASNSorogan.activePlottingStudentIds || [];
    const btn = document.getElementById('tab2-btn-save-sorogan-plotting');

    if (btn) {
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
 * TAB 3: Matriks Beban Mu'allim Sorogan
 */
function renderSoroganMatriksBeban() {
    const tbody = document.getElementById('sorogan-matriks-beban-tbody');
    if (!tbody) return;

    const halaqahs = ASNSorogan.data.halaqahs || [];
    const students = ASNSorogan.data.students || [];

    if (halaqahs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-xs text-slate-400">Belum ada data distribusi beban Mu'allim Sorogan.</td></tr>`;
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

        return `
        <tr class="hover:bg-slate-50 dark:hover:bg-[#1c2836]/60 transition">
            <td class="py-3 px-4 font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <div class="w-7 h-7 rounded-lg bg-sky-100/70 dark:bg-sky-950 text-sky-700 dark:text-sky-300 flex items-center justify-center text-xs">
                    <i class="fa-solid fa-user-tie"></i>
                </div>
                <span class="truncate">${escapeHtml(h.muallimPengampu || 'Mu\'allim Sorogan')}</span>
            </td>
            <td class="py-3 px-4 font-semibold text-slate-700 dark:text-slate-200">${escapeHtml(h.namaHalaqah || '-')}</td>
            <td class="py-3 px-4">
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                    ${escapeHtml(h.kategori || 'Sorogan')}
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
                    <span class="font-bold flex items-center gap-1">
                        <i class="fa-regular fa-clock text-sky-600"></i> ${escapeHtml(s.jamMulai || '05:15')} - ${escapeHtml(s.jamSelesai || '06:30')} WIB
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
    if (jamMulaiInput) jamMulaiInput.value = sesi.jamMulai || '05:15';
    if (jamSelesaiInput) jamSelesaiInput.value = sesi.jamSelesai || '06:30';
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

    const payload = {
        sesiId: idInput ? idInput.value.trim() : "",
        namaSesi: namaInput ? namaInput.value.trim() : "",
        jenisSesi: tipeInput ? tipeInput.value : "Sorogan Binnazhar Reguler",
        status: statusInput ? statusInput.value : "Aktif Digunakan",
        jamMulai: jamMulaiInput ? jamMulaiInput.value : "05:15",
        jamSelesai: jamSelesaiInput ? jamSelesaiInput.value : "06:30",
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
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(SOROGAN_STORAGE_KEYS.adminToken)) || "";
        const res = await apiPost("saveSoroganSesi", { token, ...payload });

        if (res && (res.success || res.status === "success")) {
            if (typeof showToast === 'function') showToast("Jadwal sesi Sorogan berhasil disimpan!");
            resetSoroganSesiForm();

            if (!ASNSorogan.data.sesiList) ASNSorogan.data.sesiList = [];
            const existingIdx = ASNSorogan.data.sesiList.findIndex(s => s.sesiId === payload.sesiId);
            if (existingIdx >= 0) {
                ASNSorogan.data.sesiList[existingIdx] = { ...ASNSorogan.data.sesiList[existingIdx], ...payload };
            } else {
                ASNSorogan.data.sesiList.push({ ...payload, sesiId: res.sesiId || ("SRG-SESI-" + Date.now().toString().substring(8)) });
            }
            renderSoroganSesiCards();
        } else {
            alert("Gagal: " + ((res && res.message) || "Kesalahan server"));
        }
    } catch (err) {
        alert("Terjadi kesalahan jaringan saat menyimpan sesi.");
    } finally {
        if (btn) {
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

function recalculateSoroganTargetWeekly() {
    const sesiInp = document.getElementById('input-sorogan-target-sesi');
    const pekanInp = document.getElementById('input-sorogan-target-pekan');
    const bulanInp = document.getElementById('input-sorogan-target-bulan');

    const sesi = Number(sesiInp?.value || 2);
    const pekan = Math.round(sesi * 6 * 10) / 10;
    const bulan = Math.round(pekan * 4 * 10) / 10;

    const lembarSesi = (sesi / 2).toFixed(1);
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

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Menyimpan...`;
    }

    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(SOROGAN_STORAGE_KEYS.adminToken)) || "";
        const res = await apiPost("saveSoroganTarget", {
            token,
            studentId,
            targetJuz,
            targetHalamanSesi,
            targetHalamanPekan: targetHalamanSesi * 6
        });

        if (res && (res.success || res.status === "success")) {
            closeSoroganTargetModal();
            if (typeof showToast === 'function') showToast("Target santri Sorogan berhasil disimpan!");

            if (!ASNSorogan.data.targets) ASNSorogan.data.targets = {};
            ASNSorogan.data.targets[studentId] = {
                targetJuz,
                targetHalamanSesi
            };
            renderSoroganTable();
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

    const sesi = Number(sesiInp?.value || 2);
    const pekan = Math.round(sesi * 6 * 10) / 10;
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
        const res = await apiPost("saveBulkSoroganTarget", {
            token,
            studentIds: targetStudentIds,
            targetHalamanSesi,
            targetHalamanPekan: targetHalamanSesi * 6
        });

        if (res && (res.success || res.status === "success")) {
            closeSoroganBulkTargetModal();
            if (typeof showToast === 'function') {
                showToast(`✅ Target berhasil diterapkan ke ${targetStudentIds.length} santri Sorogan!`);
            }
            if (!ASNSorogan.data.targets) ASNSorogan.data.targets = {};
            targetStudentIds.forEach(id => {
                ASNSorogan.data.targets[id] = {
                    targetHalamanSesi
                };
            });
            clearSoroganSelectedStudents();
            renderSoroganTable();
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
