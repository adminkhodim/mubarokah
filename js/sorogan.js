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
 * 4. Manajemen Halaqah Sorogan & Muallim Pengampu
 * 5. Integrasi SWR Caching & Sinkronisasi Google Spreadsheet
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
        muallimList: []
    },
    filteredStudents: [],
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

    if (refreshIcon && forceRefresh) {
        refreshIcon.classList.add('fa-spin');
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
            filterSoroganList();
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

    let html = '';
    list.forEach((st, idx) => {
        const surahRef = SOROGAN_JUZ_SURAH_REF[st.juzAktif] || "Al-Qur'an 30 Juz";
        const isUlang = st.statusTerakhir === 'ULANG';

        const statusBadge = isUlang
            ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300"><i class="fa-solid fa-rotate-left"></i> Wajib Mengulang</span>`
            : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/50 dark:text-sky-300"><i class="fa-solid fa-circle-check"></i> Lancar (Lanjut)</span>`;

        // Progress bar per Juz (20 halaman)
        const hal = Math.min(20, Math.max(1, st.halamanTerakhir || 1));
        const percentJuz = Math.round((hal / 20) * 100);

        html += `
            <tr class="hover:bg-slate-50/80 dark:hover:bg-[#1a2636]/60 transition border-b border-slate-100 dark:border-[#202f42] text-xs">
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
                    <div class="text-xs font-semibold text-slate-700 dark:text-slate-200">${escapeHtml(st.namaHalaqah || "Belum Ada Halaqah")}</div>
                    <div class="text-[10px] text-slate-400">Muallim: ${escapeHtml(st.muallimPengampu || "-")}</div>
                </td>
                <td class="p-3">
                    ${statusBadge}
                    ${st.updatedAt ? `<div class="text-[9px] text-slate-400 mt-1">Terakhir: ${st.updatedAt.substring(0, 10)}</div>` : ''}
                </td>
                <td class="p-3 text-right">
                    <button type="button" onclick="openSimakSoroganModal('${escapeHtml(st.studentId)}')"
                        class="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs shadow-sm transition active:scale-95 inline-flex items-center gap-1.5">
                        <i class="fa-solid fa-pen-to-square text-xs"></i>
                        <span>Simak Sorogan</span>
                    </button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
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
    const ok = confirm("Inisialisasi Database Sorogan Al-Qur'an di Google Spreadsheet?\n\nSistem akan membuat 3 tab sheet baru secara otomatis:\n1. Sorogan_Logs\n2. Sorogan_Capaian\n3. Sorogan_Halaqah\n\nLanjutkan?");
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
