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
        ustadzList: []
    },
    filteredStudents: [],
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

// Deskripsi Materi Resmi Yanbu'a Jilid 1 - 7
const YANBUA_JILID_INFO = {
    1: { name: "Jilid 1", desc: "Huruf Hijaiyah Tunggal Fathah & Makhraj Dasar", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    2: { name: "Jilid 2", desc: "Huruf Bersambung & Mad Thabi'i Dasar", badge: "bg-teal-50 text-teal-700 border-teal-200" },
    3: { name: "Jilid 3", desc: "Kasrah, Dhammah, Sukun & Tanwin", badge: "bg-sky-50 text-sky-700 border-sky-200" },
    4: { name: "Jilid 4", desc: "Tasydid, Ikhfa', Iqlab, Idgham & Alif Lam", badge: "bg-blue-50 text-blue-700 border-blue-200" },
    5: { name: "Jilid 5", desc: "Waqaf, Ibtida' & Tanda Baca Mushaf", badge: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    6: { name: "Jilid 6", desc: "Gharib & Musykilat Bacaan Al-Qur'an", badge: "bg-purple-50 text-purple-700 border-purple-200" },
    7: { name: "Jilid 7", desc: "Kaidah Tajwid Lengkap & Pra Al-Qur'an", badge: "bg-amber-50 text-amber-700 border-amber-200" }
};

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
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(TPQ_STORAGE_KEYS.adminToken)) || "";
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
        for (let j = 1; j <= 7; j++) {
            const count = dist[j] || 0;
            const jInfo = YANBUA_JILID_INFO[j] || { name: `Jilid ${j}` };
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
 * Render tabel daftar capaian santri TPQ
 */
function renderTPQTable() {
    const tbody = document.getElementById('admin-tpq-table-body');
    const emptyState = document.getElementById('admin-tpq-empty');
    const countEl = document.getElementById('admin-tpq-count');

    const list = ASNTPQ.filteredStudents || [];

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
        const jInfo = YANBUA_JILID_INFO[st.jilidAktif] || { name: `Jilid ${st.jilidAktif}`, badge: "bg-slate-50 text-slate-700 border-slate-200" };
        const isUlang = st.statusTerakhir === 'ULANG';

        const statusBadge = isUlang
            ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300"><i class="fa-solid fa-rotate-left"></i> Wajib Mengulang</span>`
            : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300"><i class="fa-solid fa-circle-check"></i> Lancar (Lanjut)</span>`;

        html += `
            <tr class="hover:bg-slate-50/80 dark:hover:bg-[#1a2636]/60 transition border-b border-slate-100 dark:border-[#202f42] text-xs">
                <td class="p-3 text-center text-slate-400 font-medium">${idx + 1}</td>
                <td class="p-3">
                    <div class="flex items-center space-x-2.5">
                        <div class="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800/40">
                            ${st.photoUrl ? `<img src="${escapeHtml(st.photoUrl)}" class="w-full h-full rounded-full object-cover">` : `<i class="fa-solid fa-user text-xs"></i>`}
                        </div>
                        <div>
                            <div class="font-bold text-slate-800 dark:text-slate-100 leading-snug">${escapeHtml(st.name)}</div>
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
                            Halaman <strong class="text-emerald-600 dark:text-emerald-400 font-black text-sm">${st.halamanAktif || 1}</strong>
                        </span>
                    </div>
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
                    <button type="button" onclick="openSimakTPQModal('${escapeHtml(st.studentId)}')"
                        class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-sm transition active:scale-95 inline-flex items-center gap-1.5">
                        <i class="fa-solid fa-pen-nib text-xs"></i>
                        <span>Simak Santri</span>
                    </button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

/**
 * Buka modal Quick Simak untuk santri terpilih
 */
function openSimakTPQModal(studentId) {
    const st = (ASNTPQ.data.students || []).find(s => s.studentId === studentId);
    if (!st) return;

    ASNTPQ.simakState = {
        studentId: st.studentId,
        studentName: st.name,
        nis: st.nis || "",
        jilid: st.jilidAktif || 1,
        halaman: st.halamanAktif || 1,
        statusSetoran: "LANJUT",
        nilai: "MUMTAZ",
        ustadz: st.ustadzPengampu && st.ustadzPengampu !== "-" ? st.ustadzPengampu : "Ustadz/Ustadzah",
        catatan: "",
        sesi: "Sore (15:45 - 17:00)"
    };

    // Populate modal form elements
    const elName = document.getElementById('tpq-simak-modal-name');
    const elNis = document.getElementById('tpq-simak-modal-nis');
    const elJilid = document.getElementById('tpq-simak-modal-jilid');
    const elHalaman = document.getElementById('tpq-simak-modal-halaman');
    const elUstadz = document.getElementById('tpq-simak-modal-ustadz');
    const elCatatan = document.getElementById('tpq-simak-modal-catatan');

    if (elName) elName.innerText = st.name;
    if (elNis) elNis.innerText = `NIS: ${st.nis || "-"}`;
    if (elJilid) elJilid.value = ASNTPQ.simakState.jilid;
    if (elHalaman) elHalaman.value = ASNTPQ.simakState.halaman;
    if (elUstadz) elUstadz.value = ASNTPQ.simakState.ustadz;
    if (elCatatan) elCatatan.value = "";

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
 * Tombol cepat pilih status simakan
 */
function selectTPQQuickStatus(status) {
    ASNTPQ.simakState.statusSetoran = status;

    document.querySelectorAll('.tpq-btn-status').forEach(btn => {
        if (btn.dataset.status === status) {
            btn.classList.add('ring-2', 'ring-offset-1', 'font-black');
            if (status === 'LANJUT') btn.classList.add('ring-emerald-500', 'bg-emerald-600', 'text-white');
            else if (status === 'ULANG') btn.classList.add('ring-rose-500', 'bg-rose-600', 'text-white');
            else if (status === 'NAIK_JILID') btn.classList.add('ring-amber-500', 'bg-amber-600', 'text-white');
        } else {
            btn.classList.remove('ring-2', 'ring-offset-1', 'font-black', 'bg-emerald-600', 'bg-rose-600', 'bg-amber-600', 'text-white');
        }
    });

    const labelHelp = document.getElementById('tpq-simak-status-help');
    if (labelHelp) {
        if (status === 'LANJUT') {
            labelHelp.innerHTML = `<span class="text-emerald-600 font-semibold"><i class="fa-solid fa-circle-check mr-1"></i> Bacaan lancar. Santri akan lanjut ke halaman berikutnya.</span>`;
        } else if (status === 'ULANG') {
            labelHelp.innerHTML = `<span class="text-rose-600 font-semibold"><i class="fa-solid fa-rotate-left mr-1"></i> Perlu latihan. Santri mengulang halaman yang sama pada sesi berikutnya.</span>`;
        } else if (status === 'NAIK_JILID') {
            labelHelp.innerHTML = `<span class="text-amber-600 font-semibold"><i class="fa-solid fa-award mr-1"></i> Khatam Jilid! Santri otomatis promosi ke Jilid berikutnya Halaman 1.</span>`;
        }
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
        tanggal: new Date().toISOString().substring(0, 10),
        sesi: "Sore (15:45 - 17:00)"
    };

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Menyimpan...`;
    }

    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(TPQ_STORAGE_KEYS.adminToken)) || "";
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
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(TPQ_STORAGE_KEYS.adminToken)) || "";
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
