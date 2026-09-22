const TAHFIDZ_STORAGE_KEYS = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.storage && APP_CONFIG.storage.keys)
    ? APP_CONFIG.storage.keys
    : {
        adminToken: 'mubarokah_admin_token',
        parentToken: 'mubarokah_parent_token',
        pengasuhToken: 'mubarokah_pengasuh_token'
    };
/**
 * ====================================================================
 * MODUL FRONTEND: TAHFIDZ AL-QUR'AN
 * State Management, Mutaba'ah, Rekapitulasi, & Integrasi APIesantren Modern (Khodim.com)
 * ====================================================================
 * Fitur:
 * 1. Multi-role: Admin/Musyrif (Kelola), Wali Santri (Pantau Anak), Pengasuh (Makro)
 * 2. Standar Mushaf Pojok: 20 Halaman per Juz, 2 Halaman per Lembar
 * 3. Pemilih Halaman Interaktif (Halaman 1 - 20) dengan Quick Chips
 * 4. Mutaba'ah 3 Indikator (Target vs Realita: Harian, Pekanan, Bulanan)
 * 5. Manajemen Halaqah & Plotting Santri
 */

// Global State Tahfidz
const ASNTahfidz = {
    data: {
        summary: {
            khatam30Juz: 0,
            rataRataHafalan: "0.0 Juz / Santri",
            totalHafalanJuz: 0,
            aktivitasPekanIni: { ziyadahPercent: 100, murajaahPercent: 0, totalSetoranPekanIni: 0 }
        },
        students: [],
        categories: ["Semua Kategori", "Tahfidz Anak", "Tahfidz Dewasa", "Kitab Kuning", "Reguler"],
        halaqahs: [],
        muhafizList: []
    },
    filteredStudents: [],
    activeStudentDetail: null,
    cache: null,
    catatState: {
        studentId: "",
        juz: 1,
        tipe: "ZIYADAH", // ZIYADAH, MURAJAAH, TASMI
        selectedPages: [1],
        sesi: "Pagi (Ba'da Subuh)",
        nilai: "MUMTAZ"
    },
    targetState: {
        studentId: "",
        ziyadahSesi: 1,
        ziyadahPekan: 10,
        murajaahSesi: 2,
        murajaahPekan: 10
    },
    selectedStudentIds: new Set(),
    bulkTargetState: {
        scope: 'ALL',
        halaqahId: '',
        kategori: '',
        studentIds: []
    },
    halaqahActiveTab: 1,
    detailActiveTab: 1,
    detailFilterTipe: "ALL"
};

const TAHFIDZ_CACHE_KEY = 'mubarokah_tahfidz_dashboard_cache';
const TAHFIDZ_CACHE_TTL_MS = 5 * 60 * 1000; // 5 menit

/**
 * Helper untuk mengatur status loading visual (icon spinner berputar + teks) pada tombol simpan/aksi
 */
function setTahfidzButtonLoading(btnOrId, isLoading, loadingText = "Menyimpan...") {
    const btn = typeof btnOrId === 'string' ? document.getElementById(btnOrId) : btnOrId;
    if (!btn) return;

    if (isLoading) {
        if (!btn.dataset.originalHtml) {
            btn.dataset.originalHtml = btn.innerHTML;
        }
        btn.disabled = true;
        btn.classList.add('opacity-75', 'cursor-not-allowed');
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1.5"></i><span>${escapeHtml(loadingText)}</span>`;
    } else {
        btn.disabled = false;
        btn.classList.remove('opacity-75', 'cursor-not-allowed');
        if (btn.dataset.originalHtml) {
            btn.innerHTML = btn.dataset.originalHtml;
            delete btn.dataset.originalHtml;
        }
    }
}

// Referensi Surah Awal per Juz untuk Standar Mushaf 30 Juz
const SURAH_JUZ_REFERENCE = {
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
    16: "Al-Kahf 75 - Ta-Ha 135",
    17: "Al-Anbiya' 1 - Al-Hajj 78",
    18: "Al-Mu'minun 1 - Al-Furqan 20",
    19: "Al-Furqan 21 - An-Naml 55",
    20: "An-Naml 56 - Al-'Ankabut 45",
    21: "Al-'Ankabut 46 - Al-Ahzab 30",
    22: "Al-Ahzab 31 - Ya-Sin 27",
    23: "Ya-Sin 28 - Az-Zumar 31",
    24: "Az-Zumar 32 - Fussilat 46",
    25: "Fussilat 47 - Al-Jatsiyah 37",
    26: "Al-Ahqaf 1 - Adz-Dzariyat 30",
    27: "Adz-Dzariyat 31 - Al-Hadid 29",
    28: "Al-Mujadilah 1 - At-Tahrim 12",
    29: "Al-Mulk 1 - Al-Mursalat 50",
    30: "An-Naba' 1 - An-Nas 6 (Juz 'Amma)"
};

// ====================================================================
// 1. DASHBOARD TAHFIDZ (LOAD & RENDER)
// ====================================================================

/**
 * Muat data lengkap dashboard Tahfidz dengan pola SWR (Stale-While-Revalidate).
 * Jika data sudah ada di cache browser, langsung render instan (0 detik!),
 * lalu sinkronkan dengan server di latar belakang.
 */
async function loadAdminTahfidzData(forceRefresh = false) {
    const loader = document.getElementById('admin-tahfidz-loader');
    const tableBody = document.getElementById('admin-tahfidz-table-body');
    const emptyState = document.getElementById('admin-tahfidz-empty');
    const refreshIcon = document.getElementById('btn-refresh-tahfidz-icon');

    if (refreshIcon && forceRefresh) {
        refreshIcon.classList.add('fa-spin');
    }

    // 1. Cek cache lokal (Memory atau SessionStorage)
    let hasRenderedFromCache = false;
    if (!forceRefresh) {
        let cached = ASNTahfidz.cache;
        if (!cached) {
            try {
                const stored = sessionStorage.getItem(TAHFIDZ_CACHE_KEY);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (parsed && parsed.data && (Date.now() - (parsed.timestamp || 0) < TAHFIDZ_CACHE_TTL_MS)) {
                        cached = parsed.data;
                        ASNTahfidz.cache = cached;
                    }
                }
            } catch (e) {
                console.warn("Gagal membaca cache Tahfidz:", e);
            }
        }

        if (cached && (cached.success || cached.status === "success") && Array.isArray(cached.students)) {
            ASNTahfidz.data = cached;

            renderTahfidzSummaryCards();
            populateTahfidzFilters();
            filterTahfidzList();
            updateHubTahfidzBadge();
            renderTahfidzHalaqahCards();
            populatePlottingHalaqahSelector();
            renderTahfidzMatriksBeban();
            hasRenderedFromCache = true;

            if (emptyState && ASNTahfidz.filteredStudents.length > 0) {
                emptyState.classList.add('hidden');
            }
        }
    }

    // Hanya tampilkan loader jika TIDAK ada data di cache sebelumnya
    if (!hasRenderedFromCache) {
        if (loader) loader.classList.remove('hidden');
        if (emptyState) emptyState.classList.add('hidden');
    }

    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(TAHFIDZ_STORAGE_KEYS.adminToken)) || "";
        const response = await apiPost("getTahfidzDashboard", token ? { token } : {});

        if (response && (response.success || response.status === "success")) {
            // Gabungkan halaqah lokal jika ada halaqah baru yang belum terangkum
            if (Array.isArray(response.halaqahs)) {
                const currentHalaqahs = ASNTahfidz.data?.halaqahs || [];
                const mergedHalaqahs = [...response.halaqahs];
                currentHalaqahs.forEach(loc => {
                    if (loc && loc.halaqahId && !mergedHalaqahs.some(s => s.halaqahId === loc.halaqahId)) {
                        mergedHalaqahs.push(loc);
                    }
                });
                response.halaqahs = mergedHalaqahs;
            }

            ASNTahfidz.data = response;
            ASNTahfidz.cache = response;
            try {
                sessionStorage.setItem(TAHFIDZ_CACHE_KEY, JSON.stringify({
                    data: response,
                    timestamp: Date.now()
                }));
            } catch (e) {
                console.warn("Gagal menyimpan cache Tahfidz:", e);
            }

            renderTahfidzSummaryCards();
            populateTahfidzFilters();
            filterTahfidzList();
            updateHubTahfidzBadge();
            renderTahfidzHalaqahCards();
            populatePlottingHalaqahSelector();
            renderTahfidzMatriksBeban();

            if (forceRefresh && typeof showToast === 'function') {
                showToast("✅ Data Tahfidz berhasil diperbarui.");
            }
        } else {
            console.warn("Gagal memuat tahfidz dashboard:", response);
            if (!hasRenderedFromCache && typeof showToast === 'function') {
                showToast("⚠️ " + ((response && response.message) || "Gagal memuat data Tahfidz."));
            }
        }
    } catch (err) {
        console.error("Error loadAdminTahfidzData:", err);
        if (!hasRenderedFromCache && typeof showToast === 'function') {
            showToast("❌ Terjadi kendala saat memuat data: " + (err.message || "Gagal memuat data Tahfidz."));
        }
    } finally {
        if (loader) loader.classList.add('hidden');
        if (refreshIcon) refreshIcon.classList.remove('fa-spin');
    }
}

/**
 * Render 4 Kartu Ringkasan Atas (Screenshot 1)
 */
function renderTahfidzSummaryCards() {
    const sum = ASNTahfidz.data.summary || {};

    const elKhatam = document.getElementById('tahfidz-stat-khatam');
    if (elKhatam) elKhatam.innerText = sum.khatam30Juz || 0;

    const elRata = document.getElementById('tahfidz-stat-rata');
    if (elRata) elRata.innerText = sum.rataRataHafalan || "0.0 Juz / Santri";

    const elTotal = document.getElementById('tahfidz-stat-total');
    if (elTotal) elTotal.innerText = `${sum.totalHafalanJuz || 0} Akumulasi Juz`;

    const elZiyadahBar = document.getElementById('tahfidz-stat-bar-ziyadah');
    const elZiyadahText = document.getElementById('tahfidz-stat-text-ziyadah');
    const elMurajaahText = document.getElementById('tahfidz-stat-text-murajaah');

    const akt = sum.aktivitasPekanIni || { ziyadahPercent: 100, murajaahPercent: 0 };
    if (elZiyadahBar) elZiyadahBar.style.width = `${akt.ziyadahPercent || 100}%`;
    if (elZiyadahText) elZiyadahText.innerText = `Ziyadah ( ${akt.ziyadahPercent || 100}% )`;
    if (elMurajaahText) elMurajaahText.innerText = `Muraja'ah ( ${akt.murajaahPercent || 0}% )`;
}

/**
 * Isi dropdown filter kategori, halaqah, muhafiz
 */
function populateTahfidzFilters() {
    const selKat = document.getElementById('tahfidz-filter-kategori');
    const selHal = document.getElementById('tahfidz-filter-halaqah');
    const selMuh = document.getElementById('tahfidz-filter-muhafiz');

    if (selKat) {
        const currentVal = selKat.value;
        const categories = (ASNTahfidz.data.categories || []).filter(c => c && c !== 'ALL' && c !== 'Semua Kategori');
        let optKat = `<option value="ALL">Semua Kategori</option>`;
        categories.forEach(k => {
            optKat += `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`;
        });
        selKat.innerHTML = optKat;
        if (currentVal && Array.from(selKat.options).some(o => o.value === currentVal)) {
            selKat.value = currentVal;
        }
    }

    if (selHal) {
        const currentVal = selHal.value;
        let optHtml = `<option value="ALL">Semua Halaqah</option>`;
        (ASNTahfidz.data.halaqahs || []).forEach(h => {
            if (h && h.namaHalaqah) {
                optHtml += `<option value="${escapeHtml(h.namaHalaqah)}">${escapeHtml(h.namaHalaqah)}</option>`;
            }
        });
        optHtml += `<option value="UNASSIGNED">Belum Masuk Halaqah</option>`;
        selHal.innerHTML = optHtml;
        if (currentVal && Array.from(selHal.options).some(o => o.value === currentVal)) {
            selHal.value = currentVal;
        }
    }

    if (selMuh) {
        const currentVal = selMuh.value;
        const muhafizList = (ASNTahfidz.data.muhafizList || []).filter(m => m && m !== 'ALL' && m !== 'Semua Muhafiz');
        let optMuh = `<option value="ALL">Semua Muhafiz</option>`;
        muhafizList.forEach(m => {
            optMuh += `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`;
        });
        selMuh.innerHTML = optMuh;
        if (currentVal && Array.from(selMuh.options).some(o => o.value === currentVal)) {
            selMuh.value = currentVal;
        }
    }
}

/**
 * Update badge Tahfidz di Hub Admin (Hanya santri aktif di kelompok halaqah)
 */
function updateHubTahfidzBadge() {
    const hubBadge = document.getElementById('admin-hub-tahfidz-count');
    if (hubBadge) {
        const count = (ASNTahfidz.data.students || []).filter(st => isStudentInHalaqah(st)).length;
        hubBadge.innerText = `${count} Santri`;
    }
}

/**
 * Memeriksa apakah santri sudah ditambahkan ke dalam salah satu kelompok halaqah
 */
function isStudentInHalaqah(st) {
    if (!st) return false;
    if (typeof st.isInHalaqah === 'boolean') {
        if (st.isInHalaqah) return true;
    }

    // 1. Cek properti halaqahId pada santri
    const hid = st.halaqahId || (st.halaqah && st.halaqah.halaqahId);
    if (hid && String(hid).trim() !== "" && String(hid).trim() !== "0") {
        return true;
    }

    // 2. Cek apakah nama halaqah valid (bukan 'Belum Masuk Halaqah')
    const hname = st.halaqah?.namaHalaqah || st.halaqahName || "";
    if (hname && hname !== "Belum Masuk Halaqah") {
        const registeredHalaqahs = ASNTahfidz.data?.halaqahs || [];
        if (registeredHalaqahs.length === 0) return true;
        const existsInRegistered = registeredHalaqahs.some(h => 
            (h.namaHalaqah && h.namaHalaqah.trim().toLowerCase() === hname.trim().toLowerCase()) ||
            (h.halaqahId && hid && h.halaqahId === hid)
        );
        if (existsInRegistered) return true;
    }

    // 3. Cek apakah ID/NIS santri terdaftar di studentIds salah satu halaqah
    const sId = String(st.studentId || st.nis || st.id || "").trim().toLowerCase();
    const sNis = String(st.nis || "").trim().toLowerCase();
    const sName = String(st.name || "").trim().toLowerCase();
    const halaqahs = ASNTahfidz.data?.halaqahs || [];

    for (let i = 0; i < halaqahs.length; i++) {
        const h = halaqahs[i];
        if (!h || !Array.isArray(h.studentIds)) continue;
        const hasMember = h.studentIds.some(mId => {
            const clean = String(mId).trim().toLowerCase();
            return clean === sId || (sNis && clean === sNis) || (sName && clean === sName);
        });
        if (hasMember) return true;
    }

    return false;
}

/**
 * Filter realtime data tabel
 */
function filterTahfidzList() {
    const q = (document.getElementById('tahfidz-search-input')?.value || '').toLowerCase().trim();
    const kat = document.getElementById('tahfidz-filter-kategori')?.value || 'Semua Kategori';
    const hal = document.getElementById('tahfidz-filter-halaqah')?.value || 'ALL';
    const muh = document.getElementById('tahfidz-filter-muhafiz')?.value || 'Semua Muhafiz';
    const status = document.getElementById('tahfidz-filter-status')?.value || 'ALL';

    const all = ASNTahfidz.data.students || [];

    ASNTahfidz.filteredStudents = all.filter(st => {
        // Query search
        const matchQ = !q ||
            (st.name && st.name.toLowerCase().includes(q)) ||
            (st.nis && st.nis.toLowerCase().includes(q)) ||
            (st.halaqah && st.halaqah.namaHalaqah && st.halaqah.namaHalaqah.toLowerCase().includes(q));

        // Kategori
        const matchKat = (kat === 'Semua Kategori' || kat === 'ALL') ||
            (st.program && st.program.toLowerCase() === kat.toLowerCase()) ||
            (st.halaqah && st.halaqah.kategori && st.halaqah.kategori.toLowerCase() === kat.toLowerCase());

        // Halaqah Filter:
        // Filter "Semua Halaqah" (ALL) HANYA menampilkan santri yang sudah dimasukkan ke kelompok halaqah
        const inHalaqah = isStudentInHalaqah(st);
        let matchHal = false;

        if (hal === 'ALL') {
            matchHal = inHalaqah;
        } else if (hal === 'UNASSIGNED') {
            matchHal = !inHalaqah;
        } else {
            matchHal = inHalaqah && st.halaqah && (
                st.halaqah.namaHalaqah === hal || 
                st.halaqah.halaqahId === hal
            );
        }

        // Muhafiz
        const matchMuh = (muh === 'Semua Muhafiz' || muh === 'ALL') ||
            (st.halaqah && st.halaqah.muhafiz && st.halaqah.muhafiz.includes(muh)) ||
            (st.setoranTerakhir && st.setoranTerakhir.muhafiz && st.setoranTerakhir.muhafiz.includes(muh));

        // Status On-Track / Mengulang
        let matchStatus = true;
        if (status === 'ON_TRACK') {
            matchStatus = st.progress && st.progress.onTrackStatus && st.progress.onTrackStatus.startsWith('On-Track');
        } else if (status === 'BELUM_SETOR') {
            matchStatus = st.progress && st.progress.onTrackStatus && st.progress.onTrackStatus.includes('Belum Setor');
        } else if (status === 'ULANG') {
            const isRepeat = (st.setoranTerakhir && (st.setoranTerakhir.statusSetoran === 'ULANG' || st.setoranTerakhir.nilai === 'DHAIF')) ||
                (st.progress && st.progress.onTrackStatus && st.progress.onTrackStatus.includes('Mengulang'));
            matchStatus = Boolean(isRepeat);
        }

        return matchQ && matchKat && matchHal && matchMuh && matchStatus;
    });

    renderTahfidzStudentTable();
}

/**
 * Render Tabel Data Santri (Desktop & Mobile) sesuai Screenshot 1
 */
function renderTahfidzStudentTable() {
    const tbody = document.getElementById('admin-tahfidz-table-body');
    const mobileContainer = document.getElementById('admin-tahfidz-mobile-list');
    const emptyState = document.getElementById('admin-tahfidz-empty');
    const countEl = document.getElementById('admin-tahfidz-count');

    const students = ASNTahfidz.filteredStudents || [];

    if (countEl) countEl.innerText = `${students.length} Santri`;

    if (students.length === 0) {
        if (tbody) tbody.innerHTML = '';
        if (mobileContainer) mobileContainer.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    // Desktop Table HTML
    if (tbody) {
        tbody.innerHTML = students.map(st => {
            const initials = (st.name || 'Santri').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'SN';
            const inHal = isStudentInHalaqah(st);
            const halaqahName = inHal ? (st.halaqah?.namaHalaqah || 'Halaqah Aktif') : 'Belum Masuk Halaqah';
            const targetZ = st.target?.ziyadahSesi || 1;
            const targetZPekan = st.target?.ziyadahPekan || 10;
            const targetZBulan = st.target?.ziyadahBulan || 40;
            const targetM = st.target?.murajaahSesi || 2;
            const targetMPekan = st.target?.murajaahPekan || 10;
            const targetMBulan = st.target?.murajaahBulan || 40;

            const last = st.setoranTerakhir;
            const isUlang = last && (last.statusSetoran === 'ULANG' || last.nilai === 'DHAIF');
            const currentJuz = st.progress?.currentJuz || 1;
            const percent = st.progress?.percent || 3;
            const onTrackStatus = st.progress?.onTrackStatus || 'Belum Setor';
            const isOnTrack = onTrackStatus.includes('On-Track');

            const isSelected = ASNTahfidz.selectedStudentIds && ASNTahfidz.selectedStudentIds.has(st.studentId);

            return `
            <tr class="hover:bg-slate-50/80 dark:hover:bg-[#1c2836]/60 transition border-b border-slate-100 dark:border-[#253447] ${isSelected ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''}">
                <!-- 0. CHECKBOX SELECTION -->
                <td class="py-2.5 px-3 w-10 text-center">
                    <input type="checkbox" onchange="toggleSelectTahfidzStudent('${st.studentId}', this.checked)" ${isSelected ? 'checked' : ''} class="tahfidz-row-checkbox rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer" title="Pilih ${escapeHtml(st.name || '')}">
                </td>

                <!-- 1. SANTRI & HALAQAH -->
                <td class="px-3.5 py-2.5">
                    <div class="flex items-center space-x-2.5">
                        <div class="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-black flex items-center justify-center text-xs shrink-0 border border-emerald-200 dark:border-emerald-800/40">
                            ${st.photoUrl ? `<img src="${escapeHtml(st.photoUrl)}" class="w-full h-full object-cover rounded-full" onerror="this.onerror=null; this.parentElement.innerText='${initials}';">` : initials}
                        </div>
                        <div class="min-w-0">
                            <h4 class="font-extrabold text-xs md:text-sm text-slate-800 dark:text-slate-100 truncate">${escapeHtml(st.name)}</h4>
                            <p class="text-[10px] text-slate-400">NIS: ${escapeHtml(st.nis || '-')} • Bil Hifdhi</p>
                            <span class="inline-flex items-center gap-1 px-1.5 py-0.2 mt-0.5 rounded text-[9px] font-bold ${inHal ? 'bg-slate-100 dark:bg-[#1c2836] text-slate-600 dark:text-slate-300' : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40'}">
                                <span class="w-1.5 h-1.5 rounded-full ${inHal ? 'bg-emerald-500' : 'bg-amber-400'}"></span>
                                ${escapeHtml(halaqahName)}
                            </span>
                        </div>
                    </div>
                </td>

                <!-- 2. TARGET CAPAIAN (COMPACT INTERACTIVE PILLS) -->
                <td class="px-3.5 py-2.5">
                    <div onclick="openTahfidzTargetModal('${st.studentId}')" class="inline-flex flex-col gap-1 group cursor-pointer" title="Klik untuk atur target capaian santri">
                        <!-- Ziyadah Pill -->
                        <div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50/90 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40 text-[10px] transition hover:bg-emerald-100/90">
                            <i class="fa-solid fa-book-open text-[8px] text-emerald-600 shrink-0"></i>
                            <span class="font-bold">Ziyadah:</span>
                            <span>${targetZ} Hlm/Setor</span>
                            <span class="text-emerald-700/70 dark:text-emerald-400/70 font-semibold text-[9px]">(${targetZPekan}P / ${targetZBulan}B)</span>
                            <i class="fa-solid fa-pencil text-[8px] text-slate-400 group-hover:text-emerald-600 ml-1 opacity-0 group-hover:opacity-100 transition"></i>
                        </div>
                        <!-- Muroja'ah Pill -->
                        <div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50/90 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40 text-[10px] transition hover:bg-amber-100/90">
                            <i class="fa-solid fa-rotate text-[8px] text-amber-600 shrink-0"></i>
                            <span class="font-bold">Muroja'ah:</span>
                            <span>${targetM} Hlm/Setor</span>
                            <span class="text-amber-700/70 dark:text-amber-400/70 font-semibold text-[9px]">(${targetMPekan}P / ${targetMBulan}B)</span>
                            <i class="fa-solid fa-pencil text-[8px] text-slate-400 group-hover:text-amber-600 ml-1 opacity-0 group-hover:opacity-100 transition"></i>
                        </div>
                    </div>
                </td>

                <!-- 3. SETORAN TERAKHIR (STREAMLINED) -->
                <td class="px-3.5 py-2.5 text-xs">
                    ${last ? `
                    <div class="space-y-0.5">
                        <div class="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1">
                            <span class="text-emerald-600 font-extrabold">Juz ${last.juz}</span>
                            <span class="text-slate-400">•</span>
                            <span class="truncate max-w-[140px]">${escapeHtml(last.surah)}</span>
                        </div>
                        <p class="text-[10px] text-slate-500 dark:text-slate-400">
                            Hlm ${escapeHtml(last.halaman)} • <span class="text-slate-400">${escapeHtml(last.sesi)}</span>
                        </p>
                        <p class="text-[9px] text-slate-400 truncate max-w-[170px]">
                            ${escapeHtml(last.tanggal)} • <span class="italic">${escapeHtml(last.muhafiz)}</span>
                        </p>
                    </div>
                    ` : `
                    <span class="text-[10px] text-slate-400 italic">Belum ada riwayat setoran.</span>
                    `}
                </td>

                <!-- 4. STATUS & NILAI -->
                <td class="px-3.5 py-2.5">
                    ${last ? `
                    <div class="space-y-1">
                        <div class="flex items-center gap-1 flex-wrap">
                            <span class="inline-block px-2 py-0.5 rounded-full text-[9px] font-extrabold ${last.tipe === 'ZIYADAH' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300' : (last.tipe === 'TASMI' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300')}">
                                ${escapeHtml(last.tipe)}
                            </span>
                            ${isUlang ? `
                            <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                                <i class="fa-solid fa-rotate-left text-[8px]"></i> Wajib Ulang
                            </span>
                            ` : `
                            <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/40">
                                <i class="fa-solid fa-check text-[8px]"></i> Lulus
                            </span>
                            `}
                        </div>
                        <div class="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                            Nilai: <span class="${isUlang ? 'text-rose-600 font-extrabold' : 'text-emerald-600 font-extrabold'}">${last.nilai === 'MUMTAZ' ? 'A (Mumtaz)' : (last.nilai === 'JAYYID_JIDDAN' ? 'B+ (Jayyid)' : (last.nilai === 'JAYYID' ? 'B (Jayyid)' : 'C (Dha\'if)'))}</span>
                        </div>
                    </div>
                    ` : `<span class="text-[10px] text-slate-400">-</span>`}
                </td>

                <!-- 5. PROGRESS (0 - 30 JUZ) -->
                <td class="px-3.5 py-2.5 w-44">
                    <div class="space-y-1">
                        <div class="flex justify-between items-center text-xs">
                            <span class="font-black text-slate-800 dark:text-slate-100">Juz ${currentJuz} <span class="text-slate-400 font-normal text-[10px]">/ 30</span></span>
                            <span class="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">${percent}%</span>
                        </div>
                        <div class="w-full bg-slate-100 dark:bg-[#1c2836] h-1.5 rounded-full overflow-hidden">
                            <div class="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-500" style="width: ${percent}%;"></div>
                        </div>
                        <span class="inline-block px-1.5 py-0.2 text-[8px] font-extrabold rounded ${isOnTrack ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-[#1c2836] dark:text-slate-400'}">
                            ${escapeHtml(onTrackStatus)}
                        </span>
                    </div>
                </td>

                <!-- 6. AKSI -->
                <td class="px-3.5 py-2.5 text-right">
                    <div class="flex items-center justify-end space-x-1">
                        <button type="button" onclick="openTahfidzCatatModal('${st.studentId}')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 shadow-sm active:scale-95" title="Catat Setoran">
                            <i class="fa-solid fa-plus text-[9px]"></i>
                            <span>Catat</span>
                        </button>
                        <button type="button" onclick="openTahfidzStudentDetail('${st.studentId}')" class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#1c2836] dark:hover:bg-[#253447] text-slate-600 dark:text-slate-300 flex items-center justify-center transition active:scale-95" title="Detail Riwayat & Mutaba'ah">
                            <i class="fa-solid fa-clock-rotate-left text-[11px]"></i>
                        </button>
                        <button type="button" onclick="printTahfidzStudentCard('${st.studentId}')" class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#1c2836] dark:hover:bg-[#253447] text-slate-600 dark:text-slate-300 flex items-center justify-center transition active:scale-95" title="Cetak Rapor Mutaba'ah">
                            <i class="fa-solid fa-print text-[11px]"></i>
                        </button>
                    </div>
                </td>
            </tr>
            `;
        }).join('');
    }

    // Mobile List Card HTML (Compact)
    if (mobileContainer) {
        mobileContainer.innerHTML = students.map(st => {
            const initials = (st.name || 'Santri').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'SN';
            const inHal = isStudentInHalaqah(st);
            const halaqahName = inHal ? (st.halaqah?.namaHalaqah || 'Halaqah Aktif') : 'Belum Masuk Halaqah';
            const last = st.setoranTerakhir;
            const isUlang = last && (last.statusSetoran === 'ULANG' || last.nilai === 'DHAIF');
            const currentJuz = st.progress?.currentJuz || 1;
            const percent = st.progress?.percent || 3;
            const targetZ = st.target?.ziyadahSesi || 1;
            const targetM = st.target?.murajaahSesi || 2;
            const isSelected = ASNTahfidz.selectedStudentIds && ASNTahfidz.selectedStudentIds.has(st.studentId);

            return `
            <div class="p-3 bg-white dark:bg-[#15202d] rounded-2xl border ${isSelected ? 'border-amber-400 dark:border-amber-600 bg-amber-50/20' : 'border-slate-100 dark:border-[#253447]'} shadow-sm space-y-2.5">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-2.5 min-w-0">
                        <input type="checkbox" onchange="toggleSelectTahfidzStudent('${st.studentId}', this.checked)" ${isSelected ? 'checked' : ''} class="tahfidz-row-checkbox rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0" title="Pilih ${escapeHtml(st.name || '')}">
                        <div class="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-extrabold flex items-center justify-center text-xs shrink-0">
                            ${st.photoUrl ? `<img src="${escapeHtml(st.photoUrl)}" class="w-full h-full object-cover rounded-full">` : initials}
                        </div>
                        <div class="min-w-0">
                            <h4 class="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">${escapeHtml(st.name)}</h4>
                            <p class="text-[10px] text-slate-400">NIS: ${escapeHtml(st.nis || '-')} • <span class="${inHal ? 'text-emerald-600 font-semibold' : 'text-amber-600 dark:text-amber-400 font-semibold'}">${escapeHtml(halaqahName)}</span></p>
                        </div>
                    </div>
                    <button type="button" onclick="openTahfidzCatatModal('${st.studentId}')" class="px-2.5 py-1 bg-emerald-600 text-white font-bold text-xs rounded-lg shadow-sm">
                        + Catat
                    </button>
                </div>

                <!-- Mini Target Pills -->
                <div class="flex items-center gap-1.5 text-[9px] font-bold">
                    <span onclick="openTahfidzTargetModal('${st.studentId}')" class="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 cursor-pointer">
                        Ziyadah: ${targetZ} Hlm/Setor
                    </span>
                    <span onclick="openTahfidzTargetModal('${st.studentId}')" class="px-2 py-0.5 rounded bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 cursor-pointer">
                        Muroja'ah: ${targetM} Hlm/Setor
                    </span>
                </div>

                <!-- Progress Bar -->
                <div class="space-y-1">
                    <div class="flex justify-between text-xs font-bold">
                        <span>Capaian: Juz ${currentJuz} / 30</span>
                        <span class="text-emerald-600">${percent}%</span>
                    </div>
                    <div class="w-full bg-slate-100 dark:bg-[#1c2836] h-1.5 rounded-full overflow-hidden">
                        <div class="bg-emerald-600 h-full rounded-full" style="width: ${percent}%;"></div>
                    </div>
                </div>

                <div class="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-[#253447] text-[10px] text-slate-400">
                    <span>${last ? `Terakhir: Juz ${last.juz} (${last.tipe}) ${isUlang ? '• <span class="text-rose-600 font-extrabold">Wajib Ulang</span>' : ''}` : 'Belum setor'}</span>
                    <button type="button" onclick="openTahfidzStudentDetail('${st.studentId}')" class="text-emerald-600 font-bold hover:underline">
                        Lihat Mutaba'ah &gt;
                    </button>
                </div>
            </div>
            `;
        }).join('');
    }

    // Update Bulk Selection Action Bar
    updateTahfidzBulkSelectionBar();
}

// ====================================================================
// 2. MODAL: CATAT SETORAN TAHFIDZ (Screenshot 5)
// ====================================================================

/**
 * Atur keputusan status setoran (LANJUT vs ULANG)
 */
function setTahfidzStatusDecision(decision) {
    ASNTahfidz.catatState.statusSetoran = decision;

    const radioLanjut = document.getElementById('radio-status-lanjut');
    const radioUlang = document.getElementById('radio-status-ulang');
    const labelLanjut = document.getElementById('label-status-lanjut');
    const labelUlang = document.getElementById('label-status-ulang');
    const badgePreview = document.getElementById('tahfidz-status-badge-preview');
    const hint = document.getElementById('tahfidz-status-hint');

    if (decision === 'ULANG') {
        if (radioUlang) radioUlang.checked = true;
        if (radioLanjut) radioLanjut.checked = false;
        if (labelUlang) {
            labelUlang.className = "flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 border-rose-500 bg-rose-50/90 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 cursor-pointer font-bold text-xs transition";
        }
        if (labelLanjut) {
            labelLanjut.className = "flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 border-slate-200 dark:border-[#283a4e] bg-white dark:bg-[#15202d] text-slate-600 dark:text-slate-400 cursor-pointer font-bold text-xs transition hover:border-emerald-300";
        }
        if (badgePreview) {
            badgePreview.innerText = "Wajib Ulang (I'adah)";
            badgePreview.className = "text-[9px] font-black px-2 py-0.5 rounded-md uppercase bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300";
        }
        if (hint) {
            hint.innerHTML = `<span class="text-rose-600 dark:text-rose-400 font-semibold"><i class="fa-solid fa-triangle-exclamation mr-1"></i> Santri dinilai belum lancar. Posisi capaian hafalan belum bertambah, santri wajib mengulang halaman ini pada sesi berikutnya.</span>`;
        }
    } else {
        if (radioLanjut) radioLanjut.checked = true;
        if (radioUlang) radioUlang.checked = false;
        if (labelLanjut) {
            labelLanjut.className = "flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 border-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 cursor-pointer font-bold text-xs transition";
        }
        if (labelUlang) {
            labelUlang.className = "flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 border-slate-200 dark:border-[#283a4e] bg-white dark:bg-[#15202d] text-slate-600 dark:text-slate-400 cursor-pointer font-bold text-xs transition hover:border-rose-300";
        }
        if (badgePreview) {
            badgePreview.innerText = "Lulus & Lanjut";
            badgePreview.className = "text-[9px] font-black px-2 py-0.5 rounded-md uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
        }
        if (hint) {
            hint.innerText = "Santri dinyatakan tuntas dan berhak melanjutkan hafalan ke halaman berikutnya.";
        }
    }
}

/**
 * Mengisi dropdown muhafiz di modal catat setoran
 * Otomatis mendeteksi muhafiz halaqah santri sebagai default (selected)
 * dan menampilkan daftar muhafiz lain untuk antisipasi jika berhalangan.
 */
function populateTahfidzMuhafizSelector(studentId) {
    const selMuh = document.getElementById('tahfidz-catat-muhafiz');
    const badge = document.getElementById('tahfidz-catat-muhafiz-badge');
    const customContainer = document.getElementById('container-tahfidz-muhafiz-manual');
    const customInput = document.getElementById('tahfidz-catat-muhafiz-manual');
    if (!selMuh) return;

    if (customContainer) customContainer.classList.add('hidden');
    if (customInput) customInput.value = '';

    // Ambil data santri
    const st = studentId ? (ASNTahfidz.data.students || []).find(s => (s.studentId === studentId || s.nis === studentId)) : null;

    // Cari halaqah santri dan nama muhafiz pengampu halaqahnya
    let halaqahMuhafiz = "";
    let halaqahName = "";
    if (st) {
        if (st.halaqah && st.halaqah.muhafiz) {
            halaqahMuhafiz = st.halaqah.muhafiz;
            halaqahName = st.halaqah.namaHalaqah || "";
        }
        if (!halaqahMuhafiz && st.halaqahId) {
            const hObj = (ASNTahfidz.data.halaqahs || []).find(h => (h.halaqahId === st.halaqahId || h.id === st.halaqahId || h.namaHalaqah === st.namaHalaqah));
            if (hObj && hObj.muhafiz) {
                halaqahMuhafiz = hObj.muhafiz;
                halaqahName = hObj.namaHalaqah || "";
            }
        }
        if (!halaqahMuhafiz && st.setoranTerakhir?.muhafiz) {
            halaqahMuhafiz = st.setoranTerakhir.muhafiz;
        }
    }

    // Kumpulkan seluruh daftar nama muhafiz unik di sistem
    const setMuhafiz = new Set();
    if (halaqahMuhafiz) setMuhafiz.add(halaqahMuhafiz.trim());

    (ASNTahfidz.data.muhafizList || []).forEach(m => {
        if (m && m !== 'ALL' && m !== 'Semua Muhafiz') setMuhafiz.add(String(m).trim());
    });

    (ASNTahfidz.data.halaqahs || []).forEach(h => {
        if (h && h.muhafiz) setMuhafiz.add(String(h.muhafiz).trim());
    });

    // Buat opsi HTML
    let optHtml = '';
    if (halaqahMuhafiz) {
        optHtml += `<option value="${escapeHtml(halaqahMuhafiz)}" selected>⭐️ ${escapeHtml(halaqahMuhafiz)} (Muhafiz Halaqah${halaqahName ? ': ' + escapeHtml(halaqahName) : ''})</option>`;
        if (badge) {
            badge.innerText = `Halaqah: ${halaqahMuhafiz}`;
            badge.className = "text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
        }
    } else {
        optHtml += `<option value="">-- Pilih Muhafiz Penyimak --</option>`;
        if (badge) {
            badge.innerText = "Pilih Muhafiz";
            badge.className = "text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
        }
    }

    // Opsi muhafiz lainnya (pengganti / badal)
    Array.from(setMuhafiz).sort().forEach(m => {
        if (m !== halaqahMuhafiz) {
            optHtml += `<option value="${escapeHtml(m)}">${escapeHtml(m)} (Asatidz / Badal)</option>`;
        }
    });

    optHtml += `<option value="__CUSTOM__">✍️ + Tulis Nama Lain (Manual)...</option>`;
    selMuh.innerHTML = optHtml;

    // Listener jika memilih custom manual
    selMuh.onchange = function() {
        if (this.value === '__CUSTOM__') {
            if (customContainer) customContainer.classList.remove('hidden');
            if (customInput) customInput.focus();
            if (badge) badge.innerText = "Ketik Manual";
        } else {
            if (customContainer) customContainer.classList.add('hidden');
            if (badge) {
                badge.innerText = (this.value === halaqahMuhafiz && halaqahMuhafiz) ? `Halaqah: ${halaqahMuhafiz}` : "Pengganti / Badal";
            }
        }
    };
}

/**
 * Cek apakah santri sedang dalam status wajib mengulang dari setoran terakhir
 */
function checkAndApplyStudentRepeatState(studentId) {
    const banner = document.getElementById('tahfidz-catat-ulang-banner');
    const bannerInfo = document.getElementById('tahfidz-catat-ulang-info');
    const selJuz = document.getElementById('tahfidz-catat-juz');

    if (!studentId) {
        if (banner) banner.classList.add('hidden');
        setTahfidzStatusDecision('LANJUT');
        return;
    }

    const st = (ASNTahfidz.data.students || []).find(s => (s.studentId === studentId || s.nis === studentId));
    const last = st?.setoranTerakhir;

    if (last && (last.statusSetoran === 'ULANG' || last.nilai === 'DHAIF')) {
        if (banner) banner.classList.remove('hidden');
        if (bannerInfo) {
            bannerInfo.innerHTML = `Setoran terakhir santri pada <b>${escapeHtml(last.tanggal || 'sebelumnya')}</b> (Nilai: <b>${escapeHtml(last.nilai)}</b>) belum tuntas. Wajib mengulang <b>Juz ${last.juz || 1} ${escapeHtml(last.halaman || '')}</b>.`;
        }
        if (selJuz && last.juz) {
            selJuz.value = String(last.juz);
        }
        // Prefill halaman yang diulang
        const parsedPage = parseInt(String(last.halaman || '').replace(/\D+/g, '')) || 1;
        ASNTahfidz.catatState.selectedPages = [parsedPage];
        renderTahfidzPageSelector();
    } else {
        if (banner) banner.classList.add('hidden');
    }
}

/**
 * Buka modal catat setoran cepat
 */
function openTahfidzCatatModal(studentId = null) {
    const modal = document.getElementById('modal-tahfidz-catat');
    if (!modal) return;

    // Reset State
    ASNTahfidz.catatState = {
        studentId: studentId || "",
        juz: 1,
        tipe: "ZIYADAH",
        selectedPages: [1],
        sesi: "Pagi (Ba'da Subuh)",
        nilai: "MUMTAZ",
        statusSetoran: "LANJUT"
    };

    // Populate Santri Select
    const selSantri = document.getElementById('tahfidz-catat-santri');
    if (selSantri && ASNTahfidz.data.students) {
        let optHtml = `<option value="">-- Pilih Santri --</option>`;
        ASNTahfidz.data.students.forEach(st => {
            const selected = (studentId && st.studentId === studentId) ? 'selected' : '';
            optHtml += `<option value="${st.studentId}" ${selected}>${escapeHtml(st.name)} (${escapeHtml(st.nis || '-')})</option>`;
        });
        selSantri.innerHTML = optHtml;

        selSantri.onchange = function() {
            checkAndApplyStudentRepeatState(this.value);
            populateTahfidzMuhafizSelector(this.value);
        };
    }

    // Set Tanggal hari ini
    const dateInput = document.getElementById('tahfidz-catat-tanggal');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
    }

    // Set Tipe Setoran Buttons (Ziyadah default)
    setTahfidzCatatTipe('ZIYADAH');

    // Populate Juz Dropdown 1 - 30
    const selJuz = document.getElementById('tahfidz-catat-juz');
    if (selJuz) {
        let juzHtml = '';
        for (let j = 1; j <= 30; j++) {
            juzHtml += `<option value="${j}">Juz ${j} (${SURAH_JUZ_REFERENCE[j] || ''})</option>`;
        }
        selJuz.innerHTML = juzHtml;
        selJuz.value = "1";
    }

    // Set Nilai Default & Listener
    const nilaiSelect = document.getElementById('tahfidz-catat-nilai');
    if (nilaiSelect) {
        nilaiSelect.value = "MUMTAZ";
        nilaiSelect.onchange = function() {
            if (this.value === 'DHAIF') {
                setTahfidzStatusDecision('ULANG');
            } else {
                setTahfidzStatusDecision('LANJUT');
            }
        };
    }

    // Set Keputusan Default: LANJUT
    setTahfidzStatusDecision('LANJUT');

    // Render Grid Tombol Halaman 1-20 Mushaf Pojok
    renderTahfidzPageSelector();

    // Populate dan deteksi otomatis Muhafiz sesuai santri terpilih
    populateTahfidzMuhafizSelector(studentId);

    // Jika studentId diberikan, cek apakah santri sedang mengulang
    if (studentId) {
        checkAndApplyStudentRepeatState(studentId);
    } else {
        const banner = document.getElementById('tahfidz-catat-ulang-banner');
        if (banner) banner.classList.add('hidden');
    }

    modal.classList.remove('hidden');
}

/**
 * Tutup modal catat setoran
 */
function closeTahfidzCatatModal() {
    const modal = document.getElementById('modal-tahfidz-catat');
    if (modal) modal.classList.add('hidden');
}

/**
 * Toggle Tipe Setoran (Ziyadah, Muraja'ah, Tasmi')
 */
function setTahfidzCatatTipe(tipe) {
    ASNTahfidz.catatState.tipe = tipe;

    const btnZ = document.getElementById('btn-tipe-ziyadah');
    const btnM = document.getElementById('btn-tipe-murajaah');
    const btnT = document.getElementById('btn-tipe-tasmi');

    const activeClasses = ['bg-emerald-600', 'text-white', 'border-emerald-600', 'shadow-sm'];
    const inactiveClasses = ['bg-slate-50', 'dark:bg-[#1c2836]', 'text-slate-700', 'dark:text-slate-300', 'border-slate-200', 'dark:border-[#283a4e]'];

    [btnZ, btnM, btnT].forEach(b => {
        if (!b) return;
        b.classList.remove(...activeClasses);
        b.classList.add(...inactiveClasses);
    });

    if (tipe === 'ZIYADAH' && btnZ) {
        btnZ.classList.add(...activeClasses);
        btnZ.classList.remove(...inactiveClasses);
    } else if (tipe === 'MURAJAAH' && btnM) {
        btnM.classList.add(...activeClasses);
        btnM.classList.remove(...inactiveClasses);
    } else if (tipe === 'TASMI' && btnT) {
        btnT.classList.add(...activeClasses);
        btnT.classList.remove(...inactiveClasses);
    }
}

/**
 * Render Pemilih Halaman Mushaf Pojok (1 - 20)
 */
function renderTahfidzPageSelector() {
    const container = document.getElementById('tahfidz-page-grid');
    const summaryBadge = document.getElementById('tahfidz-page-summary-badge');
    const summaryList = document.getElementById('tahfidz-page-summary-list');

    if (!container) return;

    const selected = ASNTahfidz.catatState.selectedPages || [1];

    let gridHtml = '';
    for (let p = 1; p <= 20; p++) {
        const isSel = selected.includes(p);
        gridHtml += `
        <button type="button" onclick="toggleTahfidzPage(${p})" class="h-10 rounded-xl font-extrabold text-xs transition border flex items-center justify-center ${isSel ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm scale-105' : 'bg-slate-50 dark:bg-[#1c2836] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-[#283a4e] hover:bg-slate-100'}">
            ${p}
        </button>
        `;
    }
    container.innerHTML = gridHtml;

    // Update Summary
    const count = selected.length;
    if (summaryBadge) {
        summaryBadge.innerText = `TERPILIH: ${count} HALAMAN`;
    }
    if (summaryList) {
        if (selected.length === 1) {
            summaryList.innerText = `Halaman ${selected[0]}`;
        } else if (selected.length > 1) {
            const min = Math.min(...selected);
            const max = Math.max(...selected);
            summaryList.innerText = `Halaman ${min} - ${max} (${count} Halaman)`;
        } else {
            summaryList.innerText = "Belum ada halaman terpilih";
        }
    }
}

/**
 * Toggle satu halaman
 */
function toggleTahfidzPage(pageNumber) {
    let sel = ASNTahfidz.catatState.selectedPages;
    if (sel.includes(pageNumber)) {
        sel = sel.filter(p => p !== pageNumber);
    } else {
        sel.push(pageNumber);
    }
    sel.sort((a, b) => a - b);
    if (sel.length === 0) sel = [pageNumber];
    ASNTahfidz.catatState.selectedPages = sel;
    renderTahfidzPageSelector();
}

/**
 * Pintasan Cepat Pemilih Halaman (Quick Chips)
 * e.g. 0.5 Hal, 1 Hal, 1 Lembar (2 Hal), 1/2 Juz (10 Hal), 1 Juz (20 Hal)
 */
function applyTahfidzQuickChip(pagesCount) {
    const start = (ASNTahfidz.catatState.selectedPages && ASNTahfidz.catatState.selectedPages.length > 0) ? ASNTahfidz.catatState.selectedPages[0] : 1;
    const newPages = [];
    const count = Math.max(1, Math.round(pagesCount));

    for (let i = 0; i < count; i++) {
        const pageVal = start + i;
        if (pageVal <= 20) {
            newPages.push(pageVal);
        }
    }

    if (newPages.length === 0) newPages.push(1);
    ASNTahfidz.catatState.selectedPages = newPages;
    renderTahfidzPageSelector();
}

/**
 * Simpan catatan setoran ke backend
 */
async function submitTahfidzCatat(e) {
    if (e) e.preventDefault();

    const selSantri = document.getElementById('tahfidz-catat-santri');
    const studentId = selSantri ? selSantri.value : "";
    if (!studentId) {
        if (typeof showToast === 'function') showToast("⚠️ Harap pilih santri terlebih dahulu.");
        return;
    }

    const student = (ASNTahfidz.data.students || []).find(s => s.studentId === studentId);
    const tanggal = document.getElementById('tahfidz-catat-tanggal')?.value || "";
    const sesi = document.getElementById('tahfidz-catat-sesi')?.value || "Pagi (Ba'da Subuh)";
    const juz = Number(document.getElementById('tahfidz-catat-juz')?.value || 1);
    const selMuhafiz = document.getElementById('tahfidz-catat-muhafiz');
    let muhafiz = selMuhafiz ? selMuhafiz.value : "";
    if (muhafiz === '__CUSTOM__') {
        muhafiz = (document.getElementById('tahfidz-catat-muhafiz-manual')?.value || '').trim();
    }

    const selectedPages = ASNTahfidz.catatState.selectedPages || [1];
    const halamanList = selectedPages.join(",");
    const totalHalaman = selectedPages.length;
    const statusSetoran = document.querySelector('input[name="tahfidz-status-setoran"]:checked')?.value || ASNTahfidz.catatState.statusSetoran || (nilai === 'DHAIF' ? 'ULANG' : 'LANJUT');

    const btn = document.getElementById('btn-submit-tahfidz-catat');
    setTahfidzButtonLoading(btn, true, "Menyimpan Setoran...");

    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(TAHFIDZ_STORAGE_KEYS.adminToken)) || "";
        const payload = {
            token,
            studentId,
            student_id: studentId,
            nis: student?.nis || "",
            studentName: student?.name || "",
            gender: student?.gender || "L",
            tanggal,
            sesi,
            tipe: ASNTahfidz.catatState.tipe,
            juz,
            surah: SURAH_JUZ_REFERENCE[juz] || `Juz ${juz}`,
            halamanList,
            halaman_list: halamanList,
            totalHalaman,
            total_halaman: totalHalaman,
            nilai,
            statusSetoran,
            status_setoran: statusSetoran,
            muhafiz: muhafiz || (student?.halaqah?.muhafiz || "Ustadz Pembina"),
            catatan
        };

        const response = await apiPost("saveTahfidzLog", payload);

        if (response && (response.success || response.status === "success")) {
            if (typeof showToast === 'function') {
                const toastMsg = statusSetoran === 'ULANG' 
                    ? "⚠️ Setoran dicatat sebagai Wajib Mengulang (I'adah). Posisi capaian hafalan belum bertambah."
                    : (response.message || "✅ Setoran tahfidz santri berhasil disimpan!");
                showToast(toastMsg);
            }

            // Optimistic update pada data santri di memori lokal
            const updateStudentData = (st) => {
                if (!st) return;
                st.setoranTerakhir = {
                    juz: juz,
                    surah: SURAH_JUZ_REFERENCE[juz] || `Juz ${juz}`,
                    halaman: `Halaman ${halamanList}`,
                    totalHalaman: totalHalaman,
                    tanggal: tanggal,
                    sesi: sesi,
                    tipe: ASNTahfidz.catatState.tipe,
                    nilai: nilai,
                    statusSetoran: statusSetoran,
                    muhafiz: muhafiz || (st.halaqah?.muhafiz || "Ustadz Pembina")
                };
                if (!st.progress) st.progress = {};
                if (statusSetoran === 'LANJUT') {
                    if (juz > (st.progress.currentJuz || 0)) {
                        st.progress.currentJuz = juz;
                        st.progress.percent = Math.min(100, Math.round((juz / 30) * 100));
                    }
                    st.progress.onTrackStatus = "On-Track (Lulus Setor)";
                } else {
                    // Santri Mengulang: Progres hafalan tidak dinaikkan
                    st.progress.onTrackStatus = `Wajib Mengulang (Hlm ${halamanList})`;
                }
                st.totalSetoran = (st.totalSetoran || 0) + 1;
            };

            const targetStudent = (ASNTahfidz.data.students || []).find(s => (s.studentId === studentId || s.nis === studentId));
            updateStudentData(targetStudent);
            const targetFiltered = (ASNTahfidz.filteredStudents || []).find(s => (s.studentId === studentId || s.nis === studentId));
            updateStudentData(targetFiltered);

            // Re-render tabel instan tanpa menunggu reload dari server
            renderTahfidzStudentTable();
            closeTahfidzCatatModal();

            // Sinkronisasi data lengkap di latar belakang (tanpa menutup layar dengan spinner)
            loadAdminTahfidzData(true);
        } else {
            const msg = (response && response.message) || "Gagal menyimpan setoran.";
            if (typeof showToast === 'function') showToast("❌ " + msg);
        }
    } catch (err) {
        console.error("Gagal submitTahfidzCatat:", err);
        if (typeof showToast === 'function') showToast("❌ Terjadi kendala: " + err.message);
    } finally {
        setTahfidzButtonLoading(btn, false);
    }
}

// ====================================================================
// 3. MODAL: DETAIL SANTRI / MUTABA'AH REALITA VS TARGET (Screenshot 4)
// ====================================================================

/**
 * Buka modal detail mutaba'ah (bisa diakses Admin, Pengasuh, & Wali Santri)
 */
async function openTahfidzStudentDetail(studentId, viewerRole = null) {
    if (viewerRole) {
        ASNTahfidz.viewerRole = viewerRole;
    } else if (typeof ASNIdentity !== 'undefined') {
        const r = String(ASNIdentity.currentRole || '').toUpperCase();
        if (r === 'WALI_SANTRI' || r === 'PARENT') {
            ASNTahfidz.viewerRole = 'parent';
        } else if (r === 'PENGASUH') {
            ASNTahfidz.viewerRole = 'pengasuh';
        } else {
            ASNTahfidz.viewerRole = 'admin';
        }
    } else {
        ASNTahfidz.viewerRole = 'admin';
    }

    const modal = document.getElementById('modal-tahfidz-detail');
    if (!modal) return;

    modal.classList.remove('hidden');
    ASNTahfidz.detailActiveTab = 1;
    switchTahfidzDetailTab(1);

    const loader = document.getElementById('tahfidz-detail-loader');
    const errorBox = document.getElementById('tahfidz-detail-error');
    const errorText = document.getElementById('tahfidz-detail-error-text');
    const bodyBox = document.getElementById('tahfidz-detail-body');

    if (loader) loader.classList.remove('hidden');
    if (errorBox) errorBox.classList.add('hidden');
    if (bodyBox) bodyBox.classList.add('hidden');

    // Pre-populate student header if available in memory for instant feedback
    const existingStudent = (ASNTahfidz.data.students || []).find(s => {
        const sId = String(s.studentId || s.student_id || s.id || '').trim();
        const sNis = String(s.nis || '').trim();
        const targetId = String(studentId || '').trim();
        return sId === targetId || sNis === targetId;
    });

    if (existingStudent) {
        const elName = document.getElementById('tahfidz-detail-name');
        const elNis = document.getElementById('tahfidz-detail-nis');
        const elAvatar = document.getElementById('tahfidz-detail-avatar');
        const halaqahName = existingStudent.halaqah?.namaHalaqah || existingStudent.halaqah || 'Halaqah Utama';

        if (elName) elName.innerText = existingStudent.name || "Santri";
        if (elNis) elNis.innerText = `NIS: ${existingStudent.nis || '-'} • Bil Hifdhi • ${escapeHtml(halaqahName)}`;
        if (elAvatar) {
            const initials = (existingStudent.name || 'Santri').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
            elAvatar.innerHTML = existingStudent.photoUrl ? `<img src="${escapeHtml(existingStudent.photoUrl)}" class="w-full h-full object-cover rounded-2xl">` : initials;
        }
    }

    try {
        const token = (typeof ASNIdentity !== 'undefined' ? (
            sessionStorage.getItem(TAHFIDZ_STORAGE_KEYS.parentToken) ||
            localStorage.getItem(TAHFIDZ_STORAGE_KEYS.parentToken) ||
            sessionStorage.getItem(TAHFIDZ_STORAGE_KEYS.pengasuhToken) ||
            localStorage.getItem(TAHFIDZ_STORAGE_KEYS.pengasuhToken) ||
            sessionStorage.getItem(TAHFIDZ_STORAGE_KEYS.adminToken) ||
            localStorage.getItem(TAHFIDZ_STORAGE_KEYS.adminToken)
        ) : '') || (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(TAHFIDZ_STORAGE_KEYS.adminToken)) || "";

        const response = await apiPost("getTahfidzStudentDetail", { token, studentId });

        if (response && (response.success || response.status === "success")) {
            ASNTahfidz.activeStudentDetail = response;
            if (loader) loader.classList.add('hidden');
            if (errorBox) errorBox.classList.add('hidden');
            if (bodyBox) bodyBox.classList.remove('hidden');
            renderTahfidzStudentDetailView();
        } else {
            if (loader) loader.classList.add('hidden');
            if (errorBox) {
                errorBox.classList.remove('hidden');
                if (errorText) errorText.innerText = `Gagal memuat detail: ${response?.message || 'Data tidak ditemukan'}`;
            }
        }
    } catch (err) {
        console.error("Gagal load detail santri:", err);
        if (loader) loader.classList.add('hidden');
        if (errorBox) {
            errorBox.classList.remove('hidden');
            if (errorText) errorText.innerText = `Terjadi kendala saat memuat data santri: ${err.message || err}`;
        }
    }
}

/**
 * Tutup modal detail santri
 */
function closeTahfidzStudentDetail() {
    const modal = document.getElementById('modal-tahfidz-detail');
    if (modal) modal.classList.add('hidden');
    ASNTahfidz.activeStudentDetail = null;
}

/**
 * Ganti tab dalam modal detail santri (Tab 1: Rekap 3 Indikator, Tab 2: Riwayat, Tab 3: Estimasi Khatam)
 */
function switchTahfidzDetailTab(tabIndex) {
    ASNTahfidz.detailActiveTab = tabIndex;

    const tab1Btn = document.getElementById('btn-detail-tab-1');
    const tab2Btn = document.getElementById('btn-detail-tab-2');
    const tab3Btn = document.getElementById('btn-detail-tab-3');
    const panel1 = document.getElementById('panel-detail-tab-1');
    const panel2 = document.getElementById('panel-detail-tab-2');
    const panel3 = document.getElementById('panel-detail-tab-3');

    const activeClasses = "px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-700 text-white shadow-sm transition flex items-center gap-1.5 shrink-0";
    const inactiveClasses = "px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 dark:bg-[#1c2836] text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition flex items-center gap-1.5 shrink-0";

    if (tab1Btn) tab1Btn.className = (tabIndex === 1) ? activeClasses : inactiveClasses;
    if (tab2Btn) tab2Btn.className = (tabIndex === 2) ? activeClasses : inactiveClasses;
    if (tab3Btn) tab3Btn.className = (tabIndex === 3) ? activeClasses : inactiveClasses;

    if (panel1) panel1.classList.toggle('hidden', tabIndex !== 1);
    if (panel2) panel2.classList.toggle('hidden', tabIndex !== 2);
    if (panel3) panel3.classList.toggle('hidden', tabIndex !== 3);

    if (tabIndex === 3) {
        renderTahfidzEstimasiKhatam();
    }
}

/**
 * Hitung dan Render Tab Estimasi Waktu Khatam 30 Juz
 * Berdasarkan tren laju setoran riil santri
 */
function renderTahfidzEstimasiKhatam() {
    const res = ASNTahfidz.activeStudentDetail;
    if (!res) return;

    const st = res.student || {};
    const stats = res.stats || {};
    const riwayat = res.riwayat || [];

    // 1. Hitung total halaman yang sudah tuntas (Max 600 halaman Mushaf Pojok)
    const progressJuz = Number(stats.progressJuz || 1);
    const lastHalamanRaw = String(st.setoranTerakhir?.halaman || '1');
    const lastHalamanNum = parseInt(lastHalamanRaw.replace(/\D+/g, '')) || 1;

    let halamanTuntas = Math.max(0, (progressJuz - 1) * 20 + Math.min(20, lastHalamanNum));

    // Validasi dengan riwayat setoran ziyadah unik jika ada
    const ziyadahLogs = riwayat.filter(r => (r.tipe || '').toUpperCase() === 'ZIYADAH' && r.statusSetoran !== 'ULANG');
    if (ziyadahLogs.length > 0) {
        let maxJuzZiyadah = 1;
        let maxHlmZiyadah = 1;
        ziyadahLogs.forEach(log => {
            const j = Number(log.juz || 1);
            const h = parseInt(String(log.halamanList || '1').replace(/\D+/g, '')) || 1;
            if (j > maxJuzZiyadah || (j === maxJuzZiyadah && h > maxHlmZiyadah)) {
                maxJuzZiyadah = j;
                maxHlmZiyadah = h;
            }
        });
        const calcFromLogs = (maxJuzZiyadah - 1) * 20 + Math.min(20, maxHlmZiyadah);
        if (calcFromLogs > halamanTuntas) {
            halamanTuntas = calcFromLogs;
        }
    }

    if (halamanTuntas > 600) halamanTuntas = 600;
    const sisaHalaman = Math.max(0, 600 - halamanTuntas);
    const persenMilestone = Math.min(100, Math.round((halamanTuntas / 600) * 100));

    // 2. Hitung Tren Kecepatan Setoran Riil (Laju per Pekan & per Bulan)
    let lajuPekanRiil = 0;
    if (ziyadahLogs.length >= 2) {
        const sortedLogs = [...ziyadahLogs].sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
        const firstDate = new Date(sortedLogs[0].tanggal);
        const lastDate = new Date(sortedLogs[sortedLogs.length - 1].tanggal);
        const diffDays = Math.max(1, Math.round((lastDate - firstDate) / (1000 * 60 * 60 * 24)));
        const totalHlm = sortedLogs.reduce((sum, item) => sum + (Number(item.totalHalaman) || 1), 0);

        if (diffDays >= 7) {
            lajuPekanRiil = (totalHlm / (diffDays / 7));
        } else {
            lajuPekanRiil = totalHlm;
        }
    } else if (ziyadahLogs.length === 1) {
        lajuPekanRiil = Number(ziyadahLogs[0].totalHalaman) || 2;
    }

    // Jika tren riil belum cukup data (< 0.5 hal/pekan), gunakan target capaian santri atau standar pesantren
    const targetSantriPekan = Number(st.target?.ziyadahPekan) || 4;
    let lajuEfektif = (lajuPekanRiil >= 0.5) ? lajuPekanRiil : targetSantriPekan;
    lajuEfektif = Math.max(0.5, lajuEfektif); // minimal 0.5 hal/pekan agar tidak division by zero

    const lajuBulanRiil = lajuEfektif * 4.33;

    // 3. Proyeksi Tanggal Khatam (Bulan & Tahun)
    const namaBulanIndo = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];

    const getProjectionDate = (ratePerWeek) => {
        if (sisaHalaman <= 0) return { text: "Alhamdulillah Khatam 30 Juz!", durasiText: "(Tuntas 600 Halaman)", durasiBulan: 0 };
        const safeRate = Math.max(0.5, ratePerWeek);
        const weeksNeeded = sisaHalaman / safeRate;
        const projDate = new Date();
        projDate.setDate(projDate.getDate() + Math.round(weeksNeeded * 7));
        const bulanName = namaBulanIndo[projDate.getMonth()];
        const tahun = projDate.getFullYear();
        const durasiBulan = Math.max(1, Math.round(weeksNeeded / 4.33));
        return {
            text: `${bulanName} ${tahun}`,
            durasiText: `(± ${durasiBulan} Bulan lagi)`,
            durasiBulan: durasiBulan,
            weeksNeeded: Math.round(weeksNeeded)
        };
    };

    const projRiil = getProjectionDate(lajuEfektif);
    const projTarget = getProjectionDate(targetSantriPekan);
    const projAkselerasi = getProjectionDate(12); // 12 hal/pekan (1 lembar per hari, 6 hari)

    // 4. Update DOM Elements
    const elKhatamBulanTahun = document.getElementById('tahfidz-estimasi-khatam-bulan-tahun');
    const elKhatamDurasi = document.getElementById('tahfidz-estimasi-khatam-durasi');
    const elLajuText = document.getElementById('tahfidz-estimasi-laju-text');
    const elLajuSub = document.getElementById('tahfidz-estimasi-laju-sub');
    const elHalamanTuntas = document.getElementById('tahfidz-estimasi-halaman-tuntas');
    const elSisaHalaman = document.getElementById('tahfidz-estimasi-sisa-halaman');
    const elMeterBar = document.getElementById('tahfidz-estimasi-meter-bar');
    const elBadgeStatus = document.getElementById('tahfidz-estimasi-badge-status');

    if (sisaHalaman <= 0) {
        if (elKhatamBulanTahun) elKhatamBulanTahun.innerText = "Khatam 30 Juz 🏆";
        if (elKhatamDurasi) elKhatamDurasi.innerText = "(Tuntas 600 Halaman)";
        if (elBadgeStatus) {
            elBadgeStatus.innerText = "Khatam Mutqin";
            elBadgeStatus.className = "px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 font-black text-[10px]";
        }
    } else {
        if (elKhatamBulanTahun) elKhatamBulanTahun.innerText = projRiil.text;
        if (elKhatamDurasi) elKhatamDurasi.innerText = projRiil.durasiText;
        if (elBadgeStatus) {
            elBadgeStatus.innerText = (lajuPekanRiil >= targetSantriPekan) ? "Laju Sangat Baik" : "Aktif Menghafal";
            elBadgeStatus.className = (lajuPekanRiil >= targetSantriPekan)
                ? "px-2 py-0.5 rounded-full bg-emerald-300 text-emerald-950 font-black text-[10px]"
                : "px-2 py-0.5 rounded-full bg-emerald-400 text-emerald-950 font-black text-[10px]";
        }
    }

    if (elLajuText) elLajuText.innerText = `${lajuEfektif.toFixed(1)} Hal / Pekan`;
    if (elLajuSub) elLajuSub.innerText = `${Math.round(lajuBulanRiil)} Hal / Bulan`;
    if (elHalamanTuntas) elHalamanTuntas.innerText = `${halamanTuntas}`;
    if (elSisaHalaman) elSisaHalaman.innerText = `Sisa ${sisaHalaman} Halaman (${Math.ceil(sisaHalaman / 20)} Juz lagi)`;
    if (elMeterBar) elMeterBar.style.width = `${Math.min(100, Math.max(1, persenMilestone))}%`;

    // 3 Cards Metrik
    const elCardTren = document.getElementById('tahfidz-estimasi-card-tren');
    const elCardTarget = document.getElementById('tahfidz-estimasi-card-target');
    const elCardKualitas = document.getElementById('tahfidz-estimasi-card-kualitas');

    if (elCardTren) {
        elCardTren.innerHTML = `${lajuPekanRiil > 0 ? lajuPekanRiil.toFixed(1) : targetSantriPekan} Hlm/Pekan <span class="text-xs font-normal text-slate-400">(${ziyadahLogs.length}x setoran ziyadah)</span>`;
    }
    if (elCardTarget) {
        elCardTarget.innerHTML = `${targetSantriPekan} Hlm/Pekan <span class="text-xs font-normal text-slate-400">(${targetSantriPekan * 4} Hlm/Bulan)</span>`;
    }
    if (elCardKualitas) {
        const totalLogs = riwayat.length;
        const passLogs = riwayat.filter(r => r.statusSetoran !== 'ULANG').length;
        const passPercent = totalLogs > 0 ? Math.round((passLogs / totalLogs) * 100) : 100;
        elCardKualitas.innerHTML = `${passPercent}% Lulus <span class="text-xs font-normal text-slate-400">(${stats.rataRataNilai || 'Mumtaz'})</span>`;
    }

    // Skenario Dates
    const elSkenarioRiil = document.getElementById('tahfidz-skenario-riil-date');
    const elSkenarioTarget = document.getElementById('tahfidz-skenario-target-date');
    const elSkenarioAkselerasi = document.getElementById('tahfidz-skenario-akselerasi-date');

    if (elSkenarioRiil) elSkenarioRiil.innerText = `${projRiil.text} ${projRiil.durasiText || ''}`;
    if (elSkenarioTarget) elSkenarioTarget.innerText = `${projTarget.text} ${projTarget.durasiText || ''}`;
    if (elSkenarioAkselerasi) elSkenarioAkselerasi.innerText = `${projAkselerasi.text} ${projAkselerasi.durasiText || ''}`;
}

ASNTahfidz.detailFilterTipe = "ALL"; // ALL, ZIYADAH, MURAJAAH
ASNTahfidz.detailSelectedDate = new Date().toISOString().split('T')[0];

/**
 * Filter Tipe Setoran di Modal Detail Santri (Semua / Ziyadah / Muroja'ah)
 */
function setTahfidzDetailTipeFilter(tipe) {
    ASNTahfidz.detailFilterTipe = tipe || "ALL";

    const btnAll = document.getElementById('btn-filter-detail-all');
    const chkZ = document.getElementById('chk-detail-ziyadah');
    const chkM = document.getElementById('chk-detail-murajaah');

    if (btnAll) {
        if (tipe === 'ALL') {
            btnAll.className = "px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-700 text-white transition";
            if (chkZ) chkZ.checked = true;
            if (chkM) chkM.checked = true;
        } else {
            btnAll.className = "px-2.5 py-0.5 rounded-md text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition";
            if (tipe === 'ZIYADAH') {
                if (chkZ) chkZ.checked = true;
                if (chkM) chkM.checked = false;
            } else if (tipe === 'MURAJAAH') {
                if (chkZ) chkZ.checked = false;
                if (chkM) chkM.checked = true;
            }
        }
    }

    renderTahfidzStudentDetailView();
}

/**
 * Event ubah tanggal harian
 */
function onChangeIndikatorDate(mode, val) {
    if (val) {
        ASNTahfidz.detailSelectedDate = val;
        renderTahfidzStudentDetailView();
    }
}

/**
 * Navigasi Pekan (< >)
 */
function shiftIndikatorWeek(dir) {
    const cur = new Date(ASNTahfidz.detailSelectedDate || new Date());
    cur.setDate(cur.getDate() + (dir * 7));
    ASNTahfidz.detailSelectedDate = cur.toISOString().split('T')[0];
    renderTahfidzStudentDetailView();
}

/**
 * Navigasi Bulan (< >)
 */
function shiftIndikatorMonth(dir) {
    const cur = new Date(ASNTahfidz.detailSelectedDate || new Date());
    cur.setMonth(cur.getMonth() + dir);
    ASNTahfidz.detailSelectedDate = cur.toISOString().split('T')[0];
    renderTahfidzStudentDetailView();
}

/**
 * Preset Tanggal Cepat: today, yesterday, thisWeek, thisMonth
 */
function setIndikatorPreset(preset) {
    const d = new Date();
    if (preset === 'yesterday') {
        d.setDate(d.getDate() - 1);
    }
    ASNTahfidz.detailSelectedDate = d.toISOString().split('T')[0];
    renderTahfidzStudentDetailView();
}

/**
 * Render Tampilan Rapor Mutaba'ah Santri (Screenshot 5)
 */
function renderTahfidzStudentDetailView() {
    const res = ASNTahfidz.activeStudentDetail;
    if (!res) return;

    const st = res.student || {};
    const stats = res.stats || {};
    const ind = res.indikator || {};
    let riwayat = res.riwayat || [];

    // Filter riwayat berdasarkan tipe jika dipilih
    if (ASNTahfidz.detailFilterTipe === 'ZIYADAH') {
        riwayat = riwayat.filter(r => (r.tipe || '').toUpperCase() === 'ZIYADAH');
    } else if (ASNTahfidz.detailFilterTipe === 'MURAJAAH') {
        riwayat = riwayat.filter(r => (r.tipe || '').toUpperCase().includes('MURAJA'));
    }

    // Header Info (Screenshot 5: Inisial, Nama, Badge, NIS • Bil Hifdhi • Halaqah)
    const elName = document.getElementById('tahfidz-detail-name');
    const elNis = document.getElementById('tahfidz-detail-nis');
    const elAvatar = document.getElementById('tahfidz-detail-avatar');
    const halaqahName = st.halaqah?.namaHalaqah || st.halaqah || 'Halaqah Utama';

    if (elName) elName.innerText = st.name || "Santri";
    if (elNis) elNis.innerText = `NIS: ${st.nis || '-'} • Bil Hifdhi • ${escapeHtml(halaqahName)}`;
    if (elAvatar) {
        const initials = (st.name || 'Santri').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
        elAvatar.innerHTML = st.photoUrl ? `<img src="${escapeHtml(st.photoUrl)}" class="w-full h-full object-cover rounded-2xl">` : initials;
    }

    // 4 Strip Stat Cards (Screenshot 5)
    const elCapaian = document.getElementById('tahfidz-detail-stat-capaian');
    const elTarget = document.getElementById('tahfidz-detail-stat-target');
    const elTotal = document.getElementById('tahfidz-detail-stat-total');
    const elNilai = document.getElementById('tahfidz-detail-stat-nilai');

    if (elCapaian) elCapaian.innerHTML = `Juz ${stats.progressJuz || 1} <span class="text-xs font-bold text-slate-400">(${stats.progressPercent || 3}%)</span>`;
    if (elTarget) elTarget.innerText = stats.targetCapaian || "-";
    if (elTotal) elTotal.innerText = `${riwayat.length || stats.totalSetoran || 0} Kali`;
    if (elNilai) elNilai.innerText = stats.rataRataNilai || "-";

    // Progress Bar 30 Juz
    const elProgressText = document.getElementById('tahfidz-detail-progress-text');
    const elProgressBar = document.getElementById('tahfidz-detail-progress-bar');
    if (elProgressText) elProgressText.innerText = `${stats.progressJuz || 1} / 30 Juz`;
    if (elProgressBar) elProgressBar.style.width = `${Math.min(100, Math.max(2, stats.progressPercent || 3))}%`;

    // Sinkronisasi Date Inputs & Labels
    const dateHarian = document.getElementById('tahfidz-date-harian');
    if (dateHarian) dateHarian.value = ASNTahfidz.detailSelectedDate || new Date().toISOString().split('T')[0];

    const curD = new Date(ASNTahfidz.detailSelectedDate || new Date());
    const pekanLabel = document.getElementById('tahfidz-pekan-label');
    if (pekanLabel) {
        const startW = new Date(curD);
        startW.setDate(curD.getDate() - curD.getDay() + 1);
        pekanLabel.innerText = `${startW.getDate().toString().padStart(2, '0')} ${startW.toLocaleString('id-ID', { month: 'short' })}...`;
    }

    const bulanLabel = document.getElementById('tahfidz-bulan-label');
    if (bulanLabel) {
        bulanLabel.innerText = curD.toLocaleString('id-ID', { month: 'long' });
    }

    // 3 Indikator (Harian, Pekanan, Bulanan)
    const elHarianTarget = document.getElementById('tahfidz-ind-harian-target');
    const elHarianRealita = document.getElementById('tahfidz-ind-harian-realita');
    const elHarianStatus = document.getElementById('tahfidz-ind-harian-status');

    if (elHarianTarget) elHarianTarget.innerText = ind.harian?.targetText || "1 Halaman / Setor (Z) • 2 Halaman / Setor (M)";
    if (elHarianRealita) elHarianRealita.innerText = ind.harian?.realitaText || "0 Hal (0x Setor)";
    if (elHarianStatus) {
        const stText = ind.harian?.status || "Belum Ada Setoran";
        elHarianStatus.innerText = stText;
        elHarianStatus.className = stText.includes('Belum')
            ? "text-[9px] font-extrabold px-2 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
            : "text-[9px] font-extrabold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
    }

    const elPekanTarget = document.getElementById('tahfidz-ind-pekan-target');
    const elPekanRealita = document.getElementById('tahfidz-ind-pekan-realita');
    const elPekanStatus = document.getElementById('tahfidz-ind-pekan-status');

    if (elPekanTarget) elPekanTarget.innerText = ind.pekanan?.targetText || "10 Halaman (Z) + 10 Halaman (M)";
    if (elPekanRealita) elPekanRealita.innerText = ind.pekanan?.realitaText || "1 Hal (2x Setor)";
    if (elPekanStatus) elPekanStatus.innerText = ind.pekanan?.status || "0% Capaian";

    const elBulanTarget = document.getElementById('tahfidz-ind-bulan-target');
    const elBulanRealita = document.getElementById('tahfidz-ind-bulan-realita');
    const elBulanStatus = document.getElementById('tahfidz-ind-bulan-status');

    if (elBulanTarget) elBulanTarget.innerText = ind.bulanan?.targetText || "40 Halaman (Z) + 40 Halaman (M)";
    if (elBulanRealita) elBulanRealita.innerText = ind.bulanan?.realitaText || "1 Hal (2x Setor)";
    if (elBulanStatus) elBulanStatus.innerText = ind.bulanan?.status || "0% Capaian";

    // Render Riwayat Setoran Table (Tab 2)
    const riwayatTbody = document.getElementById('tahfidz-detail-riwayat-tbody');
    const isParentOrPengasuh = ASNTahfidz.viewerRole === 'parent' || ASNTahfidz.viewerRole === 'pengasuh';
    if (riwayatTbody) {
        if (riwayat.length === 0) {
            riwayatTbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-xs text-slate-400">Belum ada riwayat setoran hafalan untuk kriteria ini.</td></tr>`;
        } else {
            riwayatTbody.innerHTML = riwayat.map((r, idx) => `
            <tr class="hover:bg-slate-50 dark:hover:bg-[#1c2836]/50 border-b border-slate-100 dark:border-[#253447] text-xs">
                <td class="px-3 py-2.5 font-bold text-slate-700 dark:text-slate-200">${escapeHtml(r.tanggal)}</td>
                <td class="px-3 py-2.5">
                    <span class="px-2 py-0.5 rounded text-[9px] font-extrabold ${r.tipe === 'ZIYADAH' ? 'bg-emerald-100 text-emerald-800' : (r.tipe === 'TASMI' ? 'bg-purple-100 text-purple-800' : 'bg-amber-100 text-amber-800')}">
                        ${escapeHtml(r.tipe)}
                    </span>
                </td>
                <td class="px-3 py-2.5">
                    <span class="font-bold text-emerald-700 dark:text-emerald-400">Juz ${r.juz}</span>
                    <span class="text-slate-400 text-[10px]">(${escapeHtml(r.surah)})</span>
                </td>
                <td class="px-3 py-2.5">Halaman ${escapeHtml(r.halamanList || '1')} (${r.totalHalaman} Hlm)</td>
                <td class="px-3 py-2.5">
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="font-bold ${r.statusSetoran === 'ULANG' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}">${escapeHtml(r.nilai)}</span>
                        ${r.statusSetoran === 'ULANG'
                            ? '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60"><i class="fa-solid fa-rotate-left text-[8px]"></i> Wajib Ulang</span>'
                            : '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60"><i class="fa-solid fa-check text-[8px]"></i> Lulus</span>'
                        }
                    </div>
                </td>
                <td class="px-3 py-2.5 text-right">
                    ${isParentOrPengasuh ? '<span class="text-[9px] font-semibold text-slate-400">Tercatat</span>' : `
                    <button type="button" onclick="deleteTahfidzLogEntry('${r.logId}')" class="text-slate-400 hover:text-rose-600 text-xs p-1 transition" title="Hapus Riwayat">
                        <i class="fa-solid fa-trash"></i>
                    </button>`}
                </td>
            </tr>
            `).join('');
        }
    }

    // Hitung dan siapkan data Tab Estimasi Waktu Khatam
    renderTahfidzEstimasiKhatam();
}

/**
 * Hapus entri log dari riwayat
 */
async function deleteTahfidzLogEntry(logId) {
    if (!confirm("Apakah Anda yakin ingin menghapus catatan setoran ini?")) return;

    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(TAHFIDZ_STORAGE_KEYS.adminToken)) || "";
        const res = await apiPost("deleteTahfidzLog", { token, logId });
        if (res && (res.success || res.status === "success")) {
            if (typeof showToast === 'function') showToast("Catatan setoran berhasil dihapus.");
            if (ASNTahfidz.activeStudentDetail?.student?.studentId) {
                openTahfidzStudentDetail(ASNTahfidz.activeStudentDetail.student.studentId);
            }
            loadAdminTahfidzData(true);
        } else {
            if (typeof showToast === 'function') showToast("❌ Gagal menghapus catatan.");
        }
    } catch (e) {
        console.error(e);
    }
}

// ====================================================================
// 4. MODAL: TARGET CAPAIAN SANTRI (Screenshot 3)
// ====================================================================

/**
 * Bersihkan format jam dari Google Sheets epoch / Date string menjadi HH:mm rapi
 */
function cleanSesiTime(timeVal, defaultVal = "00:00") {
    if (!timeVal) return defaultVal;
    const str = String(timeVal).trim();
    // Tangkap pola HH:mm
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

/**
 * Hitung jumlah sesi aktif per pekan untuk Ziyadah dan Muroja'ah berdasarkan Sheet Tahfidz_Jadwal_Sesi
 */
function getTahfidzActiveWeeklySessionCounts() {
    let sesiList = ASNTahfidz.data.sesiList || [];
    if (!sesiList || sesiList.length === 0) {
        // Fallback default jika data sesi belum dimuat
        return {
            ziyadahWeeklySessions: 10,
            murajaahWeeklySessions: 5,
            activeSessions: []
        };
    }

    const activeSessions = sesiList.filter(s => (s.status || 'Aktif Digunakan').includes('Aktif'));
    let ziyadahCount = 0;
    let murajaahCount = 0;

    activeSessions.forEach(s => {
        const j = (s.jenisSesi || s.jenis || '').toUpperCase();
        const rawHari = s.hariList || s.hari || [];
        const hariArr = Array.isArray(rawHari) ? rawHari : String(rawHari).split(',').map(x => x.trim()).filter(Boolean);
        const dayCount = Math.max(1, hariArr.length);

        const isMurajaah = j.includes('MURAJA') || j.includes('MUROJA') || j.includes('TASMI') || j.includes('ULANG') || j.includes('UJIAN');
        if (isMurajaah) {
            murajaahCount += dayCount;
        } else {
            // Default Ziyadah (Hafalan Baru)
            ziyadahCount += dayCount;
        }
    });

    return {
        ziyadahWeeklySessions: ziyadahCount > 0 ? ziyadahCount : 10,
        murajaahWeeklySessions: murajaahCount > 0 ? murajaahCount : 5,
        activeSessions: activeSessions
    };
}

/**
 * Render kartu jadwal sesi aktif di dalam Modal Target Capaian Santri (Konsep Khodim.com)
 */
function renderTahfidzTargetModalSessions() {
    const container = document.getElementById('tahfidz-target-sesi-container');
    const badgeZ = document.getElementById('tahfidz-target-badge-ziyadah');
    const badgeM = document.getElementById('tahfidz-target-badge-murajaah');

    const counts = getTahfidzActiveWeeklySessionCounts();

    if (badgeZ) badgeZ.innerText = `${counts.ziyadahWeeklySessions} Sesi Ziyadah/Pekan`;
    if (badgeM) badgeM.innerText = `${counts.murajaahWeeklySessions} Sesi Muroja'ah/Pekan`;

    if (!container) return;

    if (!counts.activeSessions || counts.activeSessions.length === 0) {
        container.innerHTML = `
            <div class="col-span-full p-2.5 bg-white dark:bg-[#15202d] rounded-xl border border-slate-200/60 dark:border-[#283a4e] text-center text-slate-400">
                Belum ada jadwal sesi aktif di sheet Tahfidz_Jadwal_Sesi.
            </div>
        `;
        return;
    }

    container.innerHTML = counts.activeSessions.map((s, idx) => {
        const nama = s.namaSesi || s.nama || `Sesi 0${idx + 1}`;
        const jamMulai = cleanSesiTime(s.jamMulai, '05:00');
        const jamSelesai = cleanSesiTime(s.jamSelesai, '06:00');
        const jamStr = `${jamMulai} - ${jamSelesai} WIB`;

        const j = (s.jenisSesi || s.jenis || '').toUpperCase();
        const rawHari = s.hariList || s.hari || [];
        const hariArr = Array.isArray(rawHari) ? rawHari : String(rawHari).split(',').map(x => x.trim()).filter(Boolean);
        const dayCount = hariArr.length || 5;

        let badgeLabel = 'Ziyadah';
        let badgeColor = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';

        if (j.includes('TASMI') || j.includes('UJIAN')) {
            badgeLabel = s.jenisSesi || s.jenis || 'Ujian Kenaikan Juz';
            badgeColor = 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300';
        } else if (j.includes('MURAJA') || j.includes('MUROJA')) {
            badgeLabel = "Muroja'ah";
            badgeColor = 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
        }

        return `
        <div class="p-2.5 bg-white dark:bg-[#15202d] rounded-xl border border-slate-200/70 dark:border-[#283a4e] space-y-1.5 flex flex-col justify-between">
            <div class="flex items-center justify-between gap-1">
                <span class="font-extrabold text-slate-800 dark:text-slate-100 truncate text-[11px]">${escapeHtml(nama)}</span>
                <span class="px-1.5 py-0.5 rounded text-[8px] font-extrabold shrink-0 ${badgeColor}">
                    ${escapeHtml(badgeLabel)}
                </span>
            </div>
            <div class="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[10px] pt-0.5">
                <span class="font-semibold">${escapeHtml(jamStr)}</span>
                <span class="text-slate-400 font-bold shrink-0">${dayCount} Hari/Pekan</span>
            </div>
        </div>
        `;
    }).join('');
}

/**
 * Hitung otomatis Target Mingguan & Bulanan berdasarkan Rumus:
 * Target Mingguan = Target Sesi x Jumlah Sesi Aktif Pekan
 * Target Bulanan = Target Mingguan x 4 Pekan
 * Standar Mushaf: 2 Hlm = 1 Lembar • 20 Hlm = 1 Juz (10 Lembar)
 */
function recalculateTahfidzTargetWeekly() {
    const counts = getTahfidzActiveWeeklySessionCounts();

    const elZSesi = document.getElementById('input-target-ziyadah-sesi');
    const elZPekan = document.getElementById('input-target-ziyadah-pekan');
    const elZBulan = document.getElementById('input-target-ziyadah-bulan');

    const elMSesi = document.getElementById('input-target-murajaah-sesi');
    const elMPekan = document.getElementById('input-target-murajaah-pekan');
    const elMBulan = document.getElementById('input-target-murajaah-bulan');

    const zSesi = Math.max(0.5, parseFloat(elZSesi?.value) || 1);
    const mSesi = Math.max(0.5, parseFloat(elMSesi?.value) || 2);

    const zPekanTotal = Number((zSesi * counts.ziyadahWeeklySessions).toFixed(1));
    const zBulanTotal = Number((zPekanTotal * 4).toFixed(1));

    const mPekanTotal = Number((mSesi * counts.murajaahWeeklySessions).toFixed(1));
    const mBulanTotal = Number((mPekanTotal * 4).toFixed(1));

    const formatHal = (n) => (Number.isInteger(n) ? n.toString() : n.toFixed(1));

    if (elZPekan) {
        const lembar = formatHal(Number((zPekanTotal / 2).toFixed(1)));
        const juz = formatHal(Number((zPekanTotal / 20).toFixed(1)));
        elZPekan.value = `${formatHal(zPekanTotal)} Halaman (${lembar} Lembar / ~${juz} Juz / Pekan)`;
    }

    if (elZBulan) {
        const lembar = formatHal(Number((zBulanTotal / 2).toFixed(1)));
        const juz = formatHal(Number((zBulanTotal / 20).toFixed(1)));
        elZBulan.value = `${formatHal(zBulanTotal)} Halaman (${lembar} Lembar / ~${juz} Juz / Bulan)`;
    }

    if (elMPekan) {
        const lembar = formatHal(Number((mPekanTotal / 2).toFixed(1)));
        const juz = formatHal(Number((mPekanTotal / 20).toFixed(1)));
        elMPekan.value = `${formatHal(mPekanTotal)} Halaman (${lembar} Lembar / ~${juz} Juz / Pekan)`;
    }

    if (elMBulan) {
        const lembar = formatHal(Number((mBulanTotal / 2).toFixed(1)));
        const juz = formatHal(Number((mBulanTotal / 20).toFixed(1)));
        elMBulan.value = `${formatHal(mBulanTotal)} Halaman (${lembar} Lembar / ~${juz} Juz / Bulan)`;
    }

    return { zPekanTotal, zBulanTotal, mPekanTotal, mBulanTotal };
}

/**
 * Buka modal atur target santri
 */
function openTahfidzTargetModal(studentId) {
    const modal = document.getElementById('modal-tahfidz-target');
    if (!modal) return;

    const student = (ASNTahfidz.data.students || []).find(s => s.studentId === studentId || s.nis === studentId);
    if (!student) return;

    ASNTahfidz.targetState.studentId = studentId;

    const nameEl = document.getElementById('tahfidz-target-student-name');
    if (nameEl) nameEl.innerText = `${student.name} • NIS: ${student.nis || '-'}`;

    // Render sesi dinamis dari sheet Tahfidz_Jadwal_Sesi (Konsep Khodim)
    renderTahfidzTargetModalSessions();

    const zSesi = student.target?.ziyadahSesi || 1;
    const mSesi = student.target?.murajaahSesi || 2;

    const elZSesi = document.getElementById('input-target-ziyadah-sesi');
    const elMSesi = document.getElementById('input-target-murajaah-sesi');

    if (elZSesi) elZSesi.value = zSesi;
    if (elMSesi) elMSesi.value = mSesi;

    // Hitung otomatis Target Mingguan & Bulanan
    recalculateTahfidzTargetWeekly();

    modal.classList.remove('hidden');
}

/**
 * Tutup modal atur target santri
 */
function closeTahfidzTargetModal() {
    const modal = document.getElementById('modal-tahfidz-target');
    if (modal) modal.classList.add('hidden');
}

/**
 * Quick chip penambah target
 */
function setTahfidzTargetChip(type, val) {
    if (type === 'ZIYADAH') {
        const el = document.getElementById('input-target-ziyadah-sesi');
        if (el) el.value = val;
    } else {
        const el = document.getElementById('input-target-murajaah-sesi');
        if (el) el.value = val;
    }
    recalculateTahfidzTargetWeekly();
}

/**
 * Simpan target mutaba'ah santri
 */
async function submitTahfidzTarget() {
    const studentId = ASNTahfidz.targetState.studentId;
    if (!studentId) return;

    const zSesi = Number(document.getElementById('input-target-ziyadah-sesi')?.value || 1);
    const mSesi = Number(document.getElementById('input-target-murajaah-sesi')?.value || 2);

    const { zPekanTotal, mPekanTotal } = recalculateTahfidzTargetWeekly();

    const btn = document.getElementById('btn-save-tahfidz-target');
    setTahfidzButtonLoading(btn, true, "Menyimpan Target...");

    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(TAHFIDZ_STORAGE_KEYS.adminToken)) || "";
        const response = await apiPost("saveTahfidzTarget", {
            token,
            studentId,
            targetZiyadahSesi: zSesi,
            targetZiyadahPekan: zPekanTotal,
            targetMurajaahSesi: mSesi,
            targetMurajaahPekan: mPekanTotal
        });

        if (response && (response.success || response.status === "success")) {
            if (typeof showToast === 'function') showToast("✅ Target santri berhasil diperbarui!");
            // Update local student target in memory
            const updateTargetInStudent = (st) => {
                if (!st) return;
                if (!st.target) st.target = {};
                st.target.ziyadahSesi = zSesi;
                st.target.ziyadahPekan = zPekanTotal;
                st.target.ziyadahBulan = zPekanTotal * 4;
                st.target.murajaahSesi = mSesi;
                st.target.murajaahPekan = mPekanTotal;
                st.target.murajaahBulan = mPekanTotal * 4;
            };

            const st = (ASNTahfidz.data.students || []).find(s => s.studentId === studentId || s.nis === studentId);
            updateTargetInStudent(st);
            const stFiltered = (ASNTahfidz.filteredStudents || []).find(s => s.studentId === studentId || s.nis === studentId);
            updateTargetInStudent(stFiltered);

            // Re-render tabel instan dengan target baru
            renderTahfidzStudentTable();
            closeTahfidzTargetModal();

            // Sinkronisasi data di latar belakang
            loadAdminTahfidzData(true);
        } else {
            if (typeof showToast === 'function') showToast("❌ " + ((response && response.message) || "Gagal menyimpan target."));
        }
    } catch (err) {
        console.error(err);
        if (typeof showToast === 'function') showToast("❌ Terjadi kesalahan saat menyimpan target: " + (err.message || err));
    } finally {
        setTahfidzButtonLoading(btn, false);
    }
}

// ====================================================================
// 4B. MANAJEMEN SELEKSI & TARGET MASSAL (BULK EDIT TARGET)
// ====================================================================

/**
 * Update UI floating bulk selection action bar dan checkbox check-all
 */
function updateTahfidzBulkSelectionBar() {
    const bar = document.getElementById('tahfidz-bulk-selection-bar');
    const text = document.getElementById('tahfidz-selected-count-text');
    const checkAll = document.getElementById('tahfidz-check-all');
    const count = ASNTahfidz.selectedStudentIds ? ASNTahfidz.selectedStudentIds.size : 0;

    if (bar) {
        if (count > 0) {
            bar.classList.remove('hidden');
        } else {
            bar.classList.add('hidden');
        }
    }
    if (text) {
        text.innerText = `${count} santri dipilih`;
    }

    const currentStudents = (ASNTahfidz.filteredStudents && ASNTahfidz.filteredStudents.length > 0)
        ? ASNTahfidz.filteredStudents
        : (ASNTahfidz.data.students || []);

    if (checkAll && currentStudents.length > 0) {
        const allChecked = count > 0 && currentStudents.every(st => ASNTahfidz.selectedStudentIds.has(st.studentId));
        checkAll.checked = allChecked;
        checkAll.indeterminate = count > 0 && !allChecked;
    } else if (checkAll) {
        checkAll.checked = false;
        checkAll.indeterminate = false;
    }
}

/**
 * Toggle checklist seluruh santri pada tabel mutaba'ah
 */
function toggleSelectAllTahfidzStudents(checked) {
    if (!ASNTahfidz.selectedStudentIds) {
        ASNTahfidz.selectedStudentIds = new Set();
    }
    const currentStudents = (ASNTahfidz.filteredStudents && ASNTahfidz.filteredStudents.length > 0)
        ? ASNTahfidz.filteredStudents
        : (ASNTahfidz.data.students || []);

    currentStudents.forEach(st => {
        if (st && st.studentId) {
            if (checked) {
                ASNTahfidz.selectedStudentIds.add(st.studentId);
            } else {
                ASNTahfidz.selectedStudentIds.delete(st.studentId);
            }
        }
    });

    document.querySelectorAll('.tahfidz-row-checkbox').forEach(cb => {
        cb.checked = checked;
    });

    updateTahfidzBulkSelectionBar();
}

/**
 * Toggle checklist perorangan santri
 */
function toggleSelectTahfidzStudent(studentId, checked) {
    if (!ASNTahfidz.selectedStudentIds) {
        ASNTahfidz.selectedStudentIds = new Set();
    }
    if (checked) {
        ASNTahfidz.selectedStudentIds.add(studentId);
    } else {
        ASNTahfidz.selectedStudentIds.delete(studentId);
    }
    updateTahfidzBulkSelectionBar();
}

/**
 * Batalkan seluruh pilihan santri
 */
function clearTahfidzSelectedStudents() {
    if (ASNTahfidz.selectedStudentIds) {
        ASNTahfidz.selectedStudentIds.clear();
    }
    document.querySelectorAll('.tahfidz-row-checkbox').forEach(cb => {
        cb.checked = false;
    });
    const checkAll = document.getElementById('tahfidz-check-all');
    if (checkAll) {
        checkAll.checked = false;
        checkAll.indeterminate = false;
    }
    updateTahfidzBulkSelectionBar();
}

/**
 * Buka modal atur target massal
 */
function openTahfidzBulkTargetModal(initialScope = 'ALL') {
    const modal = document.getElementById('modal-tahfidz-target-bulk');
    if (!modal) return;

    // Populate Halaqah Dropdown
    const selHalaqah = document.getElementById('bulk-target-select-halaqah');
    if (selHalaqah) {
        const halaqahs = ASNTahfidz.data.halaqahs || [];
        selHalaqah.innerHTML = halaqahs.length > 0
            ? halaqahs.map(h => `<option value="${escapeHtml(h.id || h.halaqahId || h.namaHalaqah)}">${escapeHtml(h.namaHalaqah || h.nama)}</option>`).join('')
            : '<option value="">(Belum ada halaqah)</option>';
    }

    // Populate Kategori Dropdown
    const selKategori = document.getElementById('bulk-target-select-kategori');
    if (selKategori) {
        const categories = (ASNTahfidz.data.categories || []).filter(c => c && c !== 'Semua Kategori');
        selKategori.innerHTML = categories.length > 0
            ? categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')
            : '<option value="">(Belum ada program)</option>';
    }

    // Update Session Badges
    const counts = getTahfidzActiveWeeklySessionCounts();
    const badgeZ = document.getElementById('bulk-target-badge-ziyadah');
    const badgeM = document.getElementById('bulk-target-badge-murajaah');
    if (badgeZ) badgeZ.innerText = `${counts.ziyadahWeeklySessions} Sesi Ziyadah/Pekan`;
    if (badgeM) badgeM.innerText = `${counts.murajaahWeeklySessions} Sesi Muroja'ah/Pekan`;

    // Tentukan scope awal
    const selCount = ASNTahfidz.selectedStudentIds ? ASNTahfidz.selectedStudentIds.size : 0;
    const scopeToUse = (initialScope === 'SELECTED' && selCount === 0) ? 'ALL' : initialScope;
    setBulkTargetScope(scopeToUse);

    // Hitung target otomatis
    recalculateBulkTargetWeekly();

    modal.classList.remove('hidden');
}

/**
 * Tutup modal target massal
 */
function closeTahfidzBulkTargetModal() {
    const modal = document.getElementById('modal-tahfidz-target-bulk');
    if (modal) modal.classList.add('hidden');
}

/**
 * Set target scope (ALL, HALAQAH, KATEGORI, SELECTED)
 */
function setBulkTargetScope(scope) {
    if (!ASNTahfidz.bulkTargetState) {
        ASNTahfidz.bulkTargetState = { scope: 'ALL', halaqahId: '', kategori: '', studentIds: [] };
    }
    ASNTahfidz.bulkTargetState.scope = scope;

    const scopes = ['ALL', 'HALAQAH', 'KATEGORI', 'SELECTED'];
    scopes.forEach(s => {
        const btn = document.getElementById(`btn-scope-${s.toLowerCase()}`);
        if (!btn) return;
        if (s === scope) {
            btn.className = 'px-3 py-2 rounded-xl font-bold text-xs border text-center transition flex flex-col items-center gap-1 bg-white dark:bg-[#15202d] border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-sm ring-2 ring-emerald-500/20';
        } else {
            btn.className = 'px-3 py-2 rounded-xl font-bold text-xs border text-center transition flex flex-col items-center gap-1 bg-white dark:bg-[#15202d] border-slate-200 dark:border-[#283a4e] text-slate-600 dark:text-slate-300 hover:border-amber-400';
        }
    });

    const subContainer = document.getElementById('bulk-target-subselect-container');
    const halaqahWrap = document.getElementById('bulk-target-halaqah-wrapper');
    const kategoriWrap = document.getElementById('bulk-target-kategori-wrapper');

    if (subContainer) {
        if (scope === 'HALAQAH' || scope === 'KATEGORI') {
            subContainer.classList.remove('hidden');
        } else {
            subContainer.classList.add('hidden');
        }
    }

    if (halaqahWrap) {
        if (scope === 'HALAQAH') halaqahWrap.classList.remove('hidden');
        else halaqahWrap.classList.add('hidden');
    }

    if (kategoriWrap) {
        if (scope === 'KATEGORI') kategoriWrap.classList.remove('hidden');
        else kategoriWrap.classList.add('hidden');
    }

    onBulkTargetScopeChange();
}

/**
 * Filter santri sasaran berdasarkan scope aktif
 */
function onBulkTargetScopeChange() {
    if (!ASNTahfidz.bulkTargetState) {
        ASNTahfidz.bulkTargetState = { scope: 'ALL', halaqahId: '', kategori: '', studentIds: [] };
    }
    const scope = ASNTahfidz.bulkTargetState.scope || 'ALL';
    const allStudents = ASNTahfidz.data.students || [];

    let targetStudents = [];
    let summaryText = "";

    if (scope === 'ALL') {
        targetStudents = allStudents.filter(st => isStudentInHalaqah(st));
        summaryText = `Target akan diterapkan ke seluruh santri halaqah aktif (${targetStudents.length} santri)`;
    } else if (scope === 'HALAQAH') {
        const selHalaqah = document.getElementById('bulk-target-select-halaqah');
        const halaqahVal = selHalaqah ? selHalaqah.value : "";
        const halaqahObj = (ASNTahfidz.data.halaqahs || []).find(h => (h.id || h.halaqahId || h.namaHalaqah) === halaqahVal);
        const halaqahName = halaqahObj ? (halaqahObj.namaHalaqah || halaqahObj.nama) : halaqahVal;

        targetStudents = allStudents.filter(st => {
            const hid = st.halaqahId || (st.halaqah && (st.halaqah.halaqahId || st.halaqah.id || st.halaqah.namaHalaqah));
            const hname = st.halaqah?.namaHalaqah || st.halaqahName || "";
            return (hid && hid === halaqahVal) || (hname && hname === halaqahName);
        });
        summaryText = `Target diterapkan ke santri kelompok: ${halaqahName || 'Halaqah terpilih'} (${targetStudents.length} santri)`;
    } else if (scope === 'KATEGORI') {
        const selKategori = document.getElementById('bulk-target-select-kategori');
        const kategoriVal = selKategori ? selKategori.value : "";

        targetStudents = allStudents.filter(st => {
            return (st.kategori && st.kategori === kategoriVal) || (st.program && st.program === kategoriVal);
        });
        summaryText = `Target diterapkan ke program: ${kategoriVal || 'Program terpilih'} (${targetStudents.length} santri)`;
    } else if (scope === 'SELECTED') {
        const selSet = ASNTahfidz.selectedStudentIds || new Set();
        targetStudents = allStudents.filter(st => selSet.has(st.studentId));
        summaryText = `Target diterapkan ke santri yang dicentang (${targetStudents.length} santri)`;
    }

    const targetIds = targetStudents.map(st => st.studentId).filter(Boolean);
    ASNTahfidz.bulkTargetState.studentIds = targetIds;

    const badge = document.getElementById('bulk-target-recipient-badge');
    const summaryEl = document.getElementById('bulk-target-summary-text');
    const previewEl = document.getElementById('bulk-target-student-preview');

    if (badge) {
        badge.innerText = `${targetIds.length} Santri Sasaran`;
        if (targetIds.length > 0) {
            badge.className = 'text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
        } else {
            badge.className = 'text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300';
        }
    }
    if (summaryEl) summaryEl.innerText = summaryText;

    if (previewEl) {
        if (targetStudents.length === 0) {
            previewEl.innerText = 'Tidak ada santri yang cocok';
        } else if (targetStudents.length <= 3) {
            previewEl.innerText = targetStudents.map(s => s.name).join(', ');
        } else {
            const firstThree = targetStudents.slice(0, 3).map(s => s.name).join(', ');
            previewEl.innerText = `${firstThree}, dan ${targetStudents.length - 3} lainnya`;
        }
    }
}

/**
 * Hitung otomatis Target Mingguan & Bulanan pada form massal
 */
function recalculateBulkTargetWeekly() {
    const counts = getTahfidzActiveWeeklySessionCounts();

    const elZSesi = document.getElementById('input-bulk-target-ziyadah-sesi');
    const elZPekan = document.getElementById('input-bulk-target-ziyadah-pekan');
    const elZBulan = document.getElementById('input-bulk-target-ziyadah-bulan');

    const elMSesi = document.getElementById('input-bulk-target-murajaah-sesi');
    const elMPekan = document.getElementById('input-bulk-target-murajaah-pekan');
    const elMBulan = document.getElementById('input-bulk-target-murajaah-bulan');

    const zSesi = Math.max(0.5, parseFloat(elZSesi?.value) || 1);
    const mSesi = Math.max(0.5, parseFloat(elMSesi?.value) || 2);

    const zPekanTotal = Number((zSesi * counts.ziyadahWeeklySessions).toFixed(1));
    const zBulanTotal = Number((zPekanTotal * 4).toFixed(1));

    const mPekanTotal = Number((mSesi * counts.murajaahWeeklySessions).toFixed(1));
    const mBulanTotal = Number((mPekanTotal * 4).toFixed(1));

    const formatHal = (n) => (Number.isInteger(n) ? n.toString() : n.toFixed(1));

    if (elZPekan) {
        const lembar = formatHal(Number((zPekanTotal / 2).toFixed(1)));
        const juz = formatHal(Number((zPekanTotal / 20).toFixed(1)));
        elZPekan.value = `${formatHal(zPekanTotal)} Halaman (${lembar} Lembar / ~${juz} Juz / Pekan)`;
    }

    if (elZBulan) {
        const lembar = formatHal(Number((zBulanTotal / 2).toFixed(1)));
        const juz = formatHal(Number((zBulanTotal / 20).toFixed(1)));
        elZBulan.value = `${formatHal(zBulanTotal)} Halaman (${lembar} Lembar / ~${juz} Juz / Bulan)`;
    }

    if (elMPekan) {
        const lembar = formatHal(Number((mPekanTotal / 2).toFixed(1)));
        const juz = formatHal(Number((mPekanTotal / 20).toFixed(1)));
        elMPekan.value = `${formatHal(mPekanTotal)} Halaman (${lembar} Lembar / ~${juz} Juz / Pekan)`;
    }

    if (elMBulan) {
        const lembar = formatHal(Number((mBulanTotal / 2).toFixed(1)));
        const juz = formatHal(Number((mBulanTotal / 20).toFixed(1)));
        elMBulan.value = `${formatHal(mBulanTotal)} Halaman (${lembar} Lembar / ~${juz} Juz / Bulan)`;
    }

    return { zSesi, zPekanTotal, zBulanTotal, mSesi, mPekanTotal, mBulanTotal };
}

/**
 * Quick chip target massal
 */
function setTahfidzBulkTargetChip(type, val) {
    if (type === 'ZIYADAH') {
        const el = document.getElementById('input-bulk-target-ziyadah-sesi');
        if (el) el.value = val;
    } else {
        const el = document.getElementById('input-bulk-target-murajaah-sesi');
        if (el) el.value = val;
    }
    recalculateBulkTargetWeekly();
}

/**
 * Simpan target massal santri
 */
async function submitTahfidzBulkTarget() {
    const studentIds = ASNTahfidz.bulkTargetState?.studentIds || [];
    if (!studentIds || studentIds.length === 0) {
        if (typeof showToast === 'function') {
            showToast("⚠️ Tidak ada santri sasaran yang dipilih.");
        } else {
            alert("Tidak ada santri sasaran yang dipilih.");
        }
        return;
    }

    const { zSesi, zPekanTotal, mSesi, mPekanTotal } = recalculateBulkTargetWeekly();

    const btn = document.getElementById('btn-save-tahfidz-target-bulk');
    setTahfidzButtonLoading(btn, true, "Menerapkan Massal...");

    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(TAHFIDZ_STORAGE_KEYS.adminToken)) || "";
        const response = await apiPost("saveBulkTahfidzTarget", {
            token,
            studentIds,
            targetZiyadahSesi: zSesi,
            targetZiyadahPekan: zPekanTotal,
            targetMurajaahSesi: mSesi,
            targetMurajaahPekan: mPekanTotal
        });

        if (response && (response.success || response.status === "success")) {
            if (typeof showToast === 'function') {
                showToast(`✅ Berhasil menerapkan target untuk ${studentIds.length} santri!`);
            }

            // Update local memory
            const idSet = new Set(studentIds);
            const updateStudentTarget = (st) => {
                if (!st || !idSet.has(st.studentId)) return;
                if (!st.target) st.target = {};
                st.target.ziyadahSesi = zSesi;
                st.target.ziyadahPekan = zPekanTotal;
                st.target.ziyadahBulan = zPekanTotal * 4;
                st.target.murajaahSesi = mSesi;
                st.target.murajaahPekan = mPekanTotal;
                st.target.murajaahBulan = mPekanTotal * 4;
            };

            (ASNTahfidz.data.students || []).forEach(updateStudentTarget);
            (ASNTahfidz.filteredStudents || []).forEach(updateStudentTarget);

            // Re-render tabel instan
            renderTahfidzStudentTable();

            // Clear pilihan & tutup modal
            clearTahfidzSelectedStudents();
            closeTahfidzBulkTargetModal();

            // Sinkronisasi data latar belakang
            loadAdminTahfidzData(true);
        } else {
            if (typeof showToast === 'function') {
                showToast("❌ " + ((response && response.message) || "Gagal menyimpan target massal."));
            }
        }
    } catch (err) {
        console.error("Error submitTahfidzBulkTarget:", err);
        if (typeof showToast === 'function') {
            showToast("❌ Terjadi kesalahan saat menyimpan target: " + (err.message || err));
        }
    } finally {
        setTahfidzButtonLoading(btn, false);
    }
}

// ====================================================================
// 5. MODAL: KELOLA HALAQAH & PLOTTING (Screenshot 2)
// ====================================================================
// 5. MODAL: KELOLA HALAQAH & PLOTTING (4 TAB LENGKAP - SCREENSHOT 1, 3, 4)
// ====================================================================

ASNTahfidz.halaqahActiveTab = 1;
ASNTahfidz.activePlottingHalaqah = null;
ASNTahfidz.activePlottingStudentIds = [];

/**
 * Buka modal kelola halaqah & plotting
 * @param {number} defaultTab Tab awal yang dibuka (1 = Halaqah, 2 = Plotting, 3 = Matriks, 4 = Jadwal Sesi)
 */
function openTahfidzHalaqahModal(defaultTab = 1) {
    const modal = document.getElementById('modal-tahfidz-halaqah');
    if (!modal) return;

    // 1. Sinkronkan Kategori Program dari kolom D (program) tab Students
    const selKat = document.getElementById('input-halaqah-kategori');
    if (selKat) {
        let programs = (ASNTahfidz.data && (ASNTahfidz.data.rawCategories || ASNTahfidz.data.categories)) || [];
        programs = programs.filter(p => p !== 'Semua Kategori' && p !== 'ALL');
        if (programs.length === 0) {
            programs = ["Pesantren Tahfidz Anak", "Tahfidz Dewasa", "Madrasah Diniyah", "Kitab Kuning"];
        }
        const currentKat = selKat.value;
        selKat.innerHTML = programs.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');
        if (currentKat && programs.includes(currentKat)) {
            selKat.value = currentKat;
        }
    }

    // 2. Sinkronkan Dropdown Ustadz Muhafiz Pembina dari Data Pegawai
    if (typeof populateTahfidzMuhafizDropdown === 'function') {
        populateTahfidzMuhafizDropdown();
    } else if (typeof loadAdminEmployeesData === 'function') {
        loadAdminEmployeesData().then(() => {
            if (typeof populateTahfidzMuhafizDropdown === 'function') populateTahfidzMuhafizDropdown();
        });
    }

    modal.classList.remove('hidden');
    switchHalaqahTab(defaultTab || 1);
}

/**
 * Tutup modal kelola halaqah
 */
function closeTahfidzHalaqahModal() {
    const modal = document.getElementById('modal-tahfidz-halaqah');
    if (modal) modal.classList.add('hidden');
}

/**
 * Switch antara 4 tab di modal Kelola Halaqah
 * @param {number} tabNum 1: Kelompok Halaqah, 2: Plotting Santri, 3: Matriks Beban, 4: Jadwal & Sesi
 */
function switchHalaqahTab(tabNum) {
    ASNTahfidz.halaqahActiveTab = tabNum;

    for (let i = 1; i <= 4; i++) {
        const btn = document.getElementById(`tab-btn-hlq-${i}`);
        const panel = document.getElementById(`panel-hlq-tab-${i}`);

        if (i === tabNum) {
            if (btn) {
                btn.className = "px-4 py-2.5 text-xs font-extrabold border-b-2 border-emerald-600 text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 whitespace-nowrap transition";
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
        renderTahfidzHalaqahCards();
    } else if (tabNum === 2) {
        populatePlottingHalaqahSelector();
    } else if (tabNum === 3) {
        renderTahfidzMatriksBeban();
    } else if (tabNum === 4) {
        renderTahfidzSesiCards();
    }
}

/**
 * Render daftar kartu halaqah aktif (Tab 1)
 */
function renderTahfidzHalaqahCards() {
    const container = document.getElementById('tahfidz-halaqah-cards-container');
    const badgeCount = document.getElementById('tahfidz-halaqah-count-badge');
    if (!container) return;

    const halaqahs = ASNTahfidz.data.halaqahs || [];
    if (badgeCount) badgeCount.innerText = `${halaqahs.length} Halaqah`;

    if (halaqahs.length === 0) {
        container.innerHTML = `
        <div class="col-span-1 sm:col-span-2 text-center py-8 px-4 bg-slate-50 dark:bg-[#1c2836] rounded-2xl border border-dashed border-slate-200 dark:border-[#283a4e] space-y-2">
            <div class="w-10 h-10 mx-auto rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-base">
                <i class="fa-solid fa-users-rectangle"></i>
            </div>
            <p class="text-xs font-bold text-slate-700 dark:text-slate-200">Belum Ada Kelompok Halaqah Aktif</p>
            <p class="text-[10px] text-slate-400 max-w-sm mx-auto">Silakan buat kelompok halaqah baru di atas dan tunjuk Ustadz Muhafiz Pembina untuk mulai memplot santri binaan.</p>
        </div>`;
        return;
    }

    container.innerHTML = halaqahs.map((h, i) => `
    <div class="p-4 bg-slate-50 dark:bg-[#1c2836] rounded-2xl border border-slate-200 dark:border-[#283a4e] space-y-3 relative group">
        <div class="flex justify-between items-start">
            <div>
                <h4 class="font-black text-sm text-slate-800 dark:text-slate-100">${escapeHtml(h.namaHalaqah)}</h4>
                <span class="inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    ${escapeHtml(h.kategori || 'Tahfidz Anak')}
                </span>
            </div>
            <div class="flex items-center space-x-1.5">
                <button type="button" onclick="deleteTahfidzHalaqahConfirm('${h.halaqahId}', '${escapeHtml(h.namaHalaqah)}')" class="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300 flex items-center justify-center text-[10px] transition" title="Hapus Halaqah">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
                <span class="w-7 h-7 rounded-lg bg-white dark:bg-[#15202d] text-slate-500 dark:text-slate-300 flex items-center justify-center text-xs font-bold shadow-sm">
                    ${String.fromCharCode(65 + i)}
                </span>
            </div>
        </div>
        <div class="space-y-1 text-xs text-slate-600 dark:text-slate-300">
            <p class="flex items-center gap-1.5 truncate font-semibold">
                <i class="fa-solid fa-user-tie text-emerald-600"></i>
                <span>${escapeHtml(h.muhafiz || 'Ustadz Pembina')}</span>
            </p>
            <p class="text-[10px] text-slate-400 truncate">
                <i class="fa-solid fa-flag mr-1"></i> ${escapeHtml(h.targetKurikulum || 'Target Mushaf Pojok Standar')}
            </p>
        </div>
        <div class="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-[#283a4e] text-xs">
            <span class="font-bold text-slate-700 dark:text-slate-300">${h.studentCount || 0} Santri Binaan</span>
            <button type="button" onclick="openPlottingFromHalaqahCard('${h.halaqahId}')" class="px-3 py-1 bg-white dark:bg-[#15202d] hover:bg-emerald-50 text-emerald-700 dark:text-emerald-300 font-bold rounded-lg border border-slate-200 dark:border-[#283a4e] text-[10px] transition flex items-center gap-1">
                <i class="fa-solid fa-user-plus text-[9px]"></i>
                <span>+ Atur Santri</span>
            </button>
        </div>
    </div>
    `).join('');
}

/**
 * Buka modal plotting santri untuk halaqah tertentu (kompatibilitas modal terpisah & Tab 2)
 */
function openPlottingSantri(halaqahId) {
    const modal = document.getElementById('modal-tahfidz-plotting');
    if (!modal) {
        openPlottingFromHalaqahCard(halaqahId);
        return;
    }

    const halaqahs = ASNTahfidz.data.halaqahs || [];
    const halaqah = halaqahs.find(h => h.halaqahId === halaqahId);

    if (!halaqah) {
        if (typeof showToast === 'function') showToast("⚠️ Data halaqah tidak ditemukan.");
        return;
    }

    ASNTahfidz.activePlottingHalaqah = halaqah;

    // Ambil daftar studentIds yang sudah ada di halaqah ini
    let currentIds = [];
    if (Array.isArray(halaqah.studentIds) && halaqah.studentIds.length > 0) {
        currentIds = [...halaqah.studentIds];
    } else if (Array.isArray(ASNTahfidz.data.students)) {
        currentIds = ASNTahfidz.data.students
            .filter(st => st.halaqah && (st.halaqah.halaqahId === halaqahId || st.halaqah.namaHalaqah === halaqah.namaHalaqah))
            .map(st => st.studentId || st.nis);
    }
    ASNTahfidz.activePlottingStudentIds = currentIds.map(id => String(id).trim()).filter(Boolean);

    // Update Header & Info Halaqah
    const badgeEl = document.getElementById('tahfidz-plotting-badge-halaqah');
    const infoEl = document.getElementById('tahfidz-plotting-halaqah-info');
    const muhEl = document.getElementById('tahfidz-plotting-muhafiz');
    const targetEl = document.getElementById('tahfidz-plotting-target');

    if (badgeEl) badgeEl.innerText = halaqah.namaHalaqah || halaqahId;
    if (infoEl) infoEl.innerText = `Atur santri binaan untuk ${halaqah.namaHalaqah} (${halaqah.kategori || 'Tahfidz'})`;
    if (muhEl) muhEl.innerText = halaqah.muhafiz || 'Belum Ditunjuk';
    if (targetEl) targetEl.innerText = halaqah.targetKurikulum || 'Target Mushaf Pojok Standar';

    // Reset search & filter
    const searchInp = document.getElementById('tahfidz-plotting-search');
    const filterGen = document.getElementById('tahfidz-plotting-filter-gender');
    if (searchInp) searchInp.value = '';
    if (filterGen) filterGen.value = 'ALL';

    renderTahfidzPlottingLists();
    modal.classList.remove('hidden');
}

/**
 * Tutup modal plotting santri
 */
function closeTahfidzPlottingModal() {
    const modal = document.getElementById('modal-tahfidz-plotting');
    if (modal) modal.classList.add('hidden');
    ASNTahfidz.activePlottingHalaqah = null;
    ASNTahfidz.activePlottingStudentIds = [];
}

/**
 * Tombol "+ Atur Santri" di kartu halaqah Tab 1 diklik:
 * Langsung switch ke Tab 2 dengan halaqah tersebut aktif dipilih
 */
function openPlottingFromHalaqahCard(halaqahId) {
    switchHalaqahTab(2);
    const sel = document.getElementById('select-plotting-halaqah');
    if (sel && halaqahId) {
        sel.value = halaqahId;
    }
    onSelectPlottingHalaqah(halaqahId);
}

/**
 * Mengisi dropdown pilihan halaqah di Tab 2
 */
function populatePlottingHalaqahSelector() {
    const sel = document.getElementById('select-plotting-halaqah');
    if (!sel) return;

    const halaqahs = ASNTahfidz.data.halaqahs || [];
    if (halaqahs.length === 0) {
        sel.innerHTML = `<option value="">-- Belum Ada Halaqah --</option>`;
        ASNTahfidz.activePlottingHalaqah = null;
        ASNTahfidz.activePlottingStudentIds = [];
        renderTahfidzPlottingLists();
        return;
    }

    const currentVal = sel.value;
    sel.innerHTML = halaqahs.map(h => `<option value="${escapeHtml(h.halaqahId)}">${escapeHtml(h.namaHalaqah)} (${escapeHtml(h.kategori || 'Tahfidz')})</option>`).join('');

    let targetId = currentVal;
    if (!targetId || !halaqahs.some(h => h.halaqahId === targetId)) {
        targetId = halaqahs[0].halaqahId;
    }
    sel.value = targetId;
    onSelectPlottingHalaqah(targetId);
}

/**
 * Handler saat halaqah di dropdown Tab 2 dipilih
 */
function onSelectPlottingHalaqah(halaqahId) {
    const halaqahs = ASNTahfidz.data.halaqahs || [];
    const halaqah = halaqahs.find(h => h.halaqahId === halaqahId) || halaqahs[0] || null;

    ASNTahfidz.activePlottingHalaqah = halaqah;
    if (!halaqah) {
        ASNTahfidz.activePlottingStudentIds = [];
        renderTahfidzPlottingLists();
        return;
    }

    // Ambil daftar studentIds yang sudah ada di halaqah ini
    let currentIds = [];
    if (Array.isArray(halaqah.studentIds) && halaqah.studentIds.length > 0) {
        currentIds = [...halaqah.studentIds];
    } else if (Array.isArray(ASNTahfidz.data.students)) {
        currentIds = ASNTahfidz.data.students
            .filter(st => st.halaqah && (st.halaqah.halaqahId === halaqah.halaqahId || st.halaqah.namaHalaqah === halaqah.namaHalaqah))
            .map(st => st.studentId || st.nis);
    }
    ASNTahfidz.activePlottingStudentIds = currentIds.map(id => String(id).trim()).filter(Boolean);

    // Update banner halaqah di Tab 2
    const muhEl = document.getElementById('tab2-plotting-muhafiz');
    const targetEl = document.getElementById('tab2-plotting-target');
    if (muhEl) muhEl.innerText = halaqah.muhafiz || 'Belum Ditunjuk';
    if (targetEl) targetEl.innerText = halaqah.targetKurikulum || 'Target Mushaf Pojok Standar';

    renderTahfidzPlottingLists();
}

/**
 * Render daftar santri terplot (enrolled) dan santri yang tersedia (available)
 */
function renderTahfidzPlottingLists() {
    const enrolledContainer = document.getElementById('tab2-plotting-enrolled-container') || document.getElementById('tahfidz-plotting-enrolled-container');
    const availableContainer = document.getElementById('tab2-plotting-available-container') || document.getElementById('tahfidz-plotting-available-container');
    const countBadge = document.getElementById('tab2-plotting-count-badge') || document.getElementById('tahfidz-plotting-count-badge');
    const enrolledCountBadge = document.getElementById('tab2-plotting-enrolled-count') || document.getElementById('tahfidz-plotting-enrolled-count');

    const allStudents = ASNTahfidz.data.students || [];
    const currentEnrolledIds = new Set(ASNTahfidz.activePlottingStudentIds.map(s => String(s).trim()));

    // Pisahkan enrolled vs available
    const enrolledStudents = allStudents.filter(st => {
        const sId = String(st.studentId || "").trim();
        const sNis = String(st.nis || "").trim();
        return currentEnrolledIds.has(sId) || currentEnrolledIds.has(sNis);
    });

    const searchInp = document.getElementById('tab2-plotting-search') || document.getElementById('tahfidz-plotting-search');
    const filterGen = document.getElementById('tab2-plotting-filter-gender') || document.getElementById('tahfidz-plotting-filter-gender');

    const searchQuery = (searchInp?.value || "").toLowerCase().trim();
    const genderFilter = (filterGen?.value || "ALL").toUpperCase();

    const availableStudents = allStudents.filter(st => {
        const sId = String(st.studentId || "").trim();
        const sNis = String(st.nis || "").trim();
        const isAlreadyEnrolled = currentEnrolledIds.has(sId) || currentEnrolledIds.has(sNis);
        if (isAlreadyEnrolled) return false;

        const matchSearch = !searchQuery ||
            (st.name && st.name.toLowerCase().includes(searchQuery)) ||
            (st.nis && st.nis.toLowerCase().includes(searchQuery)) ||
            (st.program && st.program.toLowerCase().includes(searchQuery));

        const matchGender = (genderFilter === 'ALL') || (String(st.gender || 'L').toUpperCase() === genderFilter);

        return matchSearch && matchGender;
    });

    if (countBadge) countBadge.innerText = `${enrolledStudents.length} Santri Terplot`;
    if (enrolledCountBadge) enrolledCountBadge.innerText = enrolledStudents.length;

    // 1. Render Enrolled List
    if (enrolledContainer) {
        if (enrolledStudents.length === 0) {
            enrolledContainer.innerHTML = `
                <div class="py-5 text-center text-xs text-slate-400">
                    <p>Belum ada santri yang dimasukkan ke halaqah ini.</p>
                    <p class="text-[10px] text-slate-400 mt-0.5">Pilih santri dari daftar di bawah lalu klik + Masukkan.</p>
                </div>
            `;
        } else {
            enrolledContainer.innerHTML = enrolledStudents.map(st => {
                const sId = st.studentId || st.nis;
                const initials = (st.name || "S").substring(0, 2).toUpperCase();
                return `
                <div class="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-[#15202d] border border-slate-200/80 dark:border-[#283a4e] text-xs">
                    <div class="flex items-center space-x-2.5 min-w-0">
                        <div class="w-7 h-7 rounded-lg ${st.gender === 'P' ? 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'} flex items-center justify-center font-bold text-[10px] shrink-0">
                            ${initials}
                        </div>
                        <div class="min-w-0">
                            <h5 class="font-bold text-slate-800 dark:text-slate-100 truncate">${escapeHtml(st.name)}</h5>
                            <p class="text-[10px] text-slate-400">NIS: ${escapeHtml(st.nis || '-')} • ${escapeHtml(st.program || 'Tahfidz')}</p>
                        </div>
                    </div>
                    <button type="button" onclick="removeStudentFromPlotting('${sId}')" class="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-bold text-[10px] transition shrink-0 flex items-center gap-1">
                        <i class="fa-solid fa-user-minus"></i>
                        <span>Keluarkan</span>
                    </button>
                </div>
                `;
            }).join('');
        }
    }

    // 2. Render Available List
    if (availableContainer) {
        if (availableStudents.length === 0) {
            availableContainer.innerHTML = `
                <div class="py-6 text-center text-xs text-slate-400">
                    <p>Semua santri yang cocok sudah dimasukkan ke halaqah ini.</p>
                </div>
            `;
        } else {
            availableContainer.innerHTML = availableStudents.map(st => {
                const sId = st.studentId || st.nis;
                const initials = (st.name || "S").substring(0, 2).toUpperCase();
                const curHal = st.halaqah && st.halaqah.namaHalaqah ? st.halaqah.namaHalaqah : null;
                return `
                <div class="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-[#15202d] border border-slate-200/80 dark:border-[#283a4e] text-xs hover:border-emerald-300 transition">
                    <div class="flex items-center space-x-2.5 min-w-0">
                        <div class="w-7 h-7 rounded-lg ${st.gender === 'P' ? 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'} flex items-center justify-center font-bold text-[10px] shrink-0">
                            ${initials}
                        </div>
                        <div class="min-w-0">
                            <h5 class="font-bold text-slate-800 dark:text-slate-100 truncate">${escapeHtml(st.name)}</h5>
                            <p class="text-[10px] text-slate-400 truncate">
                                NIS: ${escapeHtml(st.nis || '-')} • ${escapeHtml(st.program || 'Tahfidz')}
                                ${curHal ? ` • <span class="text-amber-600 dark:text-amber-400 font-semibold">(Saat ini: ${escapeHtml(curHal)})</span>` : ''}
                            </p>
                        </div>
                    </div>
                    <button type="button" onclick="addStudentToPlotting('${sId}')" class="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold text-[10px] transition shrink-0 flex items-center gap-1">
                        <i class="fa-solid fa-user-plus"></i>
                        <span>+ Masukkan</span>
                    </button>
                </div>
                `;
            }).join('');
        }
    }
}

/**
 * Filter santri yang tersedia saat mengetik pencarian
 */
function filterTahfidzPlottingAvailableList() {
    renderTahfidzPlottingLists();
}

/**
 * Masukkan santri ke list halaqah
 */
function addStudentToPlotting(studentId) {
    const cleanId = String(studentId || "").trim();
    if (!cleanId) return;

    if (!ASNTahfidz.activePlottingStudentIds.includes(cleanId)) {
        ASNTahfidz.activePlottingStudentIds.push(cleanId);
        renderTahfidzPlottingLists();
    }
}

/**
 * Keluarkan santri dari list halaqah
 */
function removeStudentFromPlotting(studentId) {
    const cleanId = String(studentId || "").trim();
    if (!cleanId) return;

    ASNTahfidz.activePlottingStudentIds = ASNTahfidz.activePlottingStudentIds.filter(id => id !== cleanId);
    renderTahfidzPlottingLists();
}

/**
 * Simpan Plotting Santri ke Backend
 */
async function submitTahfidzPlotting() {
    if (!ASNTahfidz.activePlottingHalaqah) {
        if (typeof showToast === 'function') showToast("⚠️ Pilih kelompok halaqah terlebih dahulu.");
        return;
    }

    const halaqahId = ASNTahfidz.activePlottingHalaqah.halaqahId;
    const studentIds = ASNTahfidz.activePlottingStudentIds || [];

    const btnSubmit = document.getElementById('tab2-btn-save-plotting') || document.getElementById('btn-save-tahfidz-plotting');
    setTahfidzButtonLoading(btnSubmit, true, "Menyimpan Plotting...");

    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(TAHFIDZ_STORAGE_KEYS.adminToken)) || "";
        const res = await apiPost("saveTahfidzPlotting", {
            token,
            halaqahId: halaqahId,
            studentIds: studentIds
        });

        if (res && (res.success || res.status === "success")) {
            if (typeof showToast === 'function') {
                showToast(`✅ Berhasil mengatur ${studentIds.length} santri binaan ke ${ASNTahfidz.activePlottingHalaqah.namaHalaqah}!`);
            }
            // Update jumlah santri di halaqah lokal
            if (ASNTahfidz.activePlottingHalaqah) {
                ASNTahfidz.activePlottingHalaqah.studentCount = studentIds.length;
            }
            renderTahfidzHalaqahCards();
            populatePlottingHalaqahSelector();
            renderTahfidzMatriksBeban();

            // Sinkronisasi data di latar belakang
            loadAdminTahfidzData(true);
        } else {
            if (typeof showToast === 'function') {
                showToast("❌ Gagal menyimpan plotting: " + ((res && res.message) || "Terjadi kesalahan"));
            }
        }
    } catch (err) {
        console.error(err);
        if (typeof showToast === 'function') showToast("❌ Terjadi kendala jaringan saat menyimpan plotting.");
    } finally {
        setTahfidzButtonLoading(btnSubmit, false);
    }
}

/**
 * ====================================================================
 * TAB 3: MATRIKS BEBAN USTADZ MUHAFIZ (MATCH SCREENSHOT 3)
 * ====================================================================
 */
function renderTahfidzMatriksBeban() {
    const tbody = document.getElementById('tahfidz-matriks-beban-tbody');
    if (!tbody) return;

    let matrix = ASNTahfidz.data.muhafizMatrix || [];

    // Jika belum ada dari backend, hitung secara dinamis dari halaqah & students
    if (!matrix || matrix.length === 0) {
        const halaqahs = ASNTahfidz.data.halaqahs || [];
        const students = ASNTahfidz.data.students || [];

        matrix = halaqahs.map(h => {
            const enrolled = students.filter(st => st.halaqah && (st.halaqah.halaqahId === h.halaqahId || st.halaqah.namaHalaqah === h.namaHalaqah));
            let totalJuz = 0;
            enrolled.forEach(st => {
                totalJuz += Number(st.progress?.currentJuz || 0);
            });
            const avg = enrolled.length > 0 ? (totalJuz / enrolled.length).toFixed(1) : "0.0";
            return {
                muhafiz: h.muhafiz || 'Ustadz Pembina',
                namaHalaqah: h.namaHalaqah,
                kategori: h.kategori || 'Tahfidz Anak',
                binaanCount: enrolled.length,
                avgCapaian: avg
            };
        });
    }

    if (matrix.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-xs text-slate-400">Belum ada data distribusi beban Ustadz Muhafiz.</td></tr>`;
        return;
    }

    tbody.innerHTML = matrix.map(m => {
        const isAnak = (m.kategori || '').toLowerCase().includes('anak');
        const badgeColor = isAnak
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
            : 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300';
        return `
        <tr class="hover:bg-slate-50 dark:hover:bg-[#1c2836]/60 transition">
            <td class="py-3 px-4 font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <div class="w-7 h-7 rounded-lg bg-emerald-100/70 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-xs">
                    <i class="fa-solid fa-user-tie"></i>
                </div>
                <span class="truncate">${escapeHtml(m.muhafiz || 'Ustadz Pembina')}</span>
            </td>
            <td class="py-3 px-4 font-semibold text-slate-700 dark:text-slate-200">${escapeHtml(m.namaHalaqah || '-')}</td>
            <td class="py-3 px-4">
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${badgeColor}">
                    ${escapeHtml(m.kategori || 'Tahfidz')}
                </span>
            </td>
            <td class="py-3 px-4 font-bold text-slate-800 dark:text-slate-100">${m.binaanCount || 0} Santri</td>
            <td class="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400">Juz ${m.avgCapaian || '0.0'} / 30</td>
        </tr>
        `;
    }).join('');
}

/**
 * ====================================================================
 * TAB 4: JADWAL & SESI WAKTU (MATCH SCREENSHOT 4)
 * ====================================================================
 */

/**
 * Reset form jadwal sesi waktu
 */
function resetTahfidzSesiForm() {
    const idInput = document.getElementById('input-sesi-id');
    const namaInput = document.getElementById('input-sesi-nama');
    const tipeInput = document.getElementById('input-sesi-tipe');
    const statusInput = document.getElementById('input-sesi-status');
    const jamMulaiInput = document.getElementById('input-sesi-jam-mulai');
    const jamSelesaiInput = document.getElementById('input-sesi-jam-selesai');
    const btnText = document.getElementById('btn-submit-sesi-text');
    const btnIcon = document.getElementById('btn-submit-sesi-icon');
    const btnCancel = document.getElementById('btn-cancel-sesi');

    if (idInput) idInput.value = '';
    if (namaInput) namaInput.value = '';
    if (tipeInput) tipeInput.value = 'Ziyadah (Setoran Hafalan Baru)';
    if (statusInput) statusInput.value = 'Aktif Digunakan';
    if (jamMulaiInput) jamMulaiInput.value = '05:15';
    if (jamSelesaiInput) jamSelesaiInput.value = '06:30';
    if (btnText) btnText.innerText = "Simpan Sesi";
    if (btnIcon) btnIcon.className = "fa-solid fa-plus text-[10px]";
    if (btnCancel) btnCancel.classList.add('hidden');

    document.querySelectorAll('input[name="sesi-hari"]').forEach(chk => {
        chk.checked = ['Sen', 'Sel', 'Rab', 'Kam', 'Sab', 'Min'].includes(chk.value);
    });
}

/**
 * Render daftar kartu sesi waktu aktif (Daftar Jadwal Sesi Waktu Aktif Tenant)
 */
function renderTahfidzSesiCards() {
    const container = document.getElementById('tahfidz-sesi-cards-container');
    const badgeCount = document.getElementById('tahfidz-sesi-count-badge');
    if (!container) return;

    let sesiList = ASNTahfidz.data.sesiList || [];

    // Default sesi jika belum ada di database
    if (!sesiList || sesiList.length === 0) {
        sesiList = [
            { sesiId: "SESI-01", id: "SESI-01", namaSesi: "Pagi (Ba'da Subuh)", nama: "Pagi (Ba'da Subuh)", jenisSesi: "Muroja'ah (Pengulangan)", jenis: "Muroja'ah (Pengulangan)", jamMulai: "05:00", jamSelesai: "06:00", hariList: ["Sen", "Rab", "Kam", "Sab", "Min"], hari: ["Sen", "Rab", "Kam", "Sab", "Min"], status: "Aktif Digunakan" },
            { sesiId: "SESI-02", id: "SESI-02", namaSesi: "Pagi (MA Tahfidz)", nama: "Pagi (MA Tahfidz)", jenisSesi: "Ziyadah (Setoran Hafalan Baru)", jenis: "Ziyadah (Setoran Hafalan Baru)", jamMulai: "08:30", jamSelesai: "09:30", hariList: ["Sen", "Sel", "Rab", "Kam", "Sab"], hari: ["Sen", "Sel", "Rab", "Kam", "Sab"], status: "Aktif Digunakan" },
            { sesiId: "SESI-03", id: "SESI-03", namaSesi: "Sore (Ba'da Ashar)", nama: "Sore (Ba'da Ashar)", jenisSesi: "Ziyadah (Setoran Hafalan Baru)", jenis: "Ziyadah (Setoran Hafalan Baru)", jamMulai: "16:00", jamSelesai: "17:15", hariList: ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab"], hari: ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab"], status: "Aktif Digunakan" },
            { sesiId: "SESI-04", id: "SESI-04", namaSesi: "Malam (Ba'da Maghrib / Isya)", nama: "Malam (Ba'da Maghrib / Isya)", jenisSesi: "Muroja'ah & Tasmi'", jenis: "Muroja'ah & Tasmi'", jamMulai: "18:45", jamSelesai: "20:30", hariList: ["Sen", "Sel", "Rab", "Kam", "Min"], hari: ["Sen", "Sel", "Rab", "Kam", "Min"], status: "Aktif Digunakan" }
        ];
    }

    const activeCount = sesiList.filter(s => (s.status || '').includes('Aktif')).length;
    if (badgeCount) badgeCount.innerText = `${activeCount} Sesi Aktif (${sesiList.length} Total)`;

    container.innerHTML = sesiList.map((s, idx) => {
        const id = s.sesiId || s.id || `SESI-0${idx + 1}`;
        const nama = s.namaSesi || s.nama || 'Sesi';
        const jenis = s.jenisSesi || s.jenis || 'Ziyadah';
        const isAktif = (s.status || '').includes('Aktif');
        const rawHari = s.hariList || s.hari || [];
        const hariList = Array.isArray(rawHari) ? rawHari : String(rawHari).split(',').map(h => h.trim()).filter(Boolean);
        const hariStr = hariList.join(', ');
        const iconSesi = jenis.includes('Ziyadah') ? 'fa-book-open text-emerald-600' : (jenis.includes('Muroja') ? 'fa-clock-rotate-left text-amber-600' : 'fa-certificate text-purple-600');

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
                    <span class="px-2 py-0.5 rounded-full text-[9px] font-extrabold ${isAktif ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-200 text-slate-600'}">
                        ${isAktif ? 'Aktif' : 'Nonaktif'}
                    </span>
                    <button type="button" onclick="editTahfidzSesi('${escapeHtml(id)}')" class="w-6 h-6 rounded-lg bg-white dark:bg-[#15202d] hover:bg-slate-100 text-slate-500 hover:text-emerald-600 flex items-center justify-center text-[10px] shadow-sm transition" title="Edit Sesi">
                        <i class="fa-solid fa-pencil"></i>
                    </button>
                    <button type="button" onclick="deleteTahfidzSesiConfirm('${escapeHtml(id)}', '${escapeHtml(nama)}')" class="w-6 h-6 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300 flex items-center justify-center text-[10px] transition" title="Hapus Sesi">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
            <div class="text-[11px] text-slate-600 dark:text-slate-300 flex items-center space-x-2">
                <i class="fa-solid ${iconSesi}"></i>
                <span class="font-bold">${cleanSesiTime(s.jamMulai, '05:00')} - ${cleanSesiTime(s.jamSelesai, '06:00')} WIB</span>
                <span class="text-slate-400">•</span>
                <span class="text-slate-500 dark:text-slate-400 font-semibold truncate">${escapeHtml(jenis)}</span>
            </div>
            <div class="pt-1.5 border-t border-slate-200/60 dark:border-[#283a4e] text-[10px] text-slate-400 flex items-center gap-1.5">
                <span class="font-bold text-slate-600 dark:text-slate-300">Hari:</span>
                <span class="truncate">${escapeHtml(hariStr || 'Setiap Hari')}</span>
            </div>
        </div>
        `;
    }).join('');
}

/**
 * Submit form tambah / edit jadwal sesi baru
 */
async function submitTahfidzSesi(e) {
    if (e) e.preventDefault();

    const idInput = document.getElementById('input-sesi-id');
    const namaInput = document.getElementById('input-sesi-nama');
    const tipeInput = document.getElementById('input-sesi-tipe');
    const statusInput = document.getElementById('input-sesi-status');
    const jamMulaiInput = document.getElementById('input-sesi-jam-mulai');
    const jamSelesaiInput = document.getElementById('input-sesi-jam-selesai');

    const nama = namaInput?.value.trim() || '';
    if (!nama) {
        if (typeof showToast === 'function') showToast("⚠️ Nama sesi wajib diisi.");
        return;
    }

    const selectedHari = [];
    document.querySelectorAll('input[name="sesi-hari"]:checked').forEach(chk => {
        selectedHari.push(chk.value);
    });

    const isEdit = Boolean(idInput && idInput.value);
    const existingId = idInput?.value || '';

    const payload = {
        sesiId: existingId,
        id: existingId,
        namaSesi: nama,
        nama: nama,
        jenisSesi: tipeInput ? tipeInput.value : 'Ziyadah (Setoran Hafalan Baru)',
        jenis: tipeInput ? tipeInput.value : 'Ziyadah (Setoran Hafalan Baru)',
        status: statusInput ? statusInput.value : 'Aktif Digunakan',
        jamMulai: jamMulaiInput ? jamMulaiInput.value : '05:15',
        jamSelesai: jamSelesaiInput ? jamSelesaiInput.value : '06:30',
        hariList: selectedHari,
        hari: selectedHari
    };

    const btn = document.getElementById('btn-submit-sesi');
    setTahfidzButtonLoading(btn, true, isEdit ? "Memperbarui Sesi..." : "Menyimpan Sesi...");

    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(TAHFIDZ_STORAGE_KEYS.adminToken)) || "";
        const res = await apiPost("saveTahfidzSesi", { token, sesi: payload, data: payload, ...payload });

        if (res && (res.success || res.status === "success")) {
            if (typeof showToast === 'function') showToast(isEdit ? "✅ Jadwal sesi berhasil diperbarui!" : "✅ Jadwal sesi baru berhasil disimpan!");
            
            // Optimistically update local state
            if (!ASNTahfidz.data.sesiList) ASNTahfidz.data.sesiList = [];
            const savedId = res.sesiId || payload.sesiId || ("SESI-" + Date.now());
            payload.sesiId = savedId;
            payload.id = savedId;

            const idx = ASNTahfidz.data.sesiList.findIndex(s => (s.sesiId || s.id) === savedId);
            if (idx >= 0) {
                ASNTahfidz.data.sesiList[idx] = payload;
            } else {
                ASNTahfidz.data.sesiList.push(payload);
            }

            resetTahfidzSesiForm();
            renderTahfidzSesiCards();
            loadAdminTahfidzData(true);
        } else {
            if (typeof showToast === 'function') showToast("❌ Gagal menyimpan sesi: " + ((res && res.message) || "Terjadi kesalahan"));
        }
    } catch (err) {
        console.error(err);
        if (typeof showToast === 'function') showToast("❌ Terjadi kendala saat menyimpan jadwal sesi: " + (err.message || err));
    } finally {
        setTahfidzButtonLoading(btn, false);
    }
}

/**
 * Edit jadwal sesi waktu (mengisi form)
 */
function editTahfidzSesi(sesiId) {
    const sesiList = ASNTahfidz.data.sesiList || [];
    const sesi = sesiList.find(s => (s.sesiId || s.id) === sesiId);
    if (!sesi) {
        if (typeof showToast === 'function') showToast("⚠️ Data sesi tidak ditemukan.");
        return;
    }

    const idInput = document.getElementById('input-sesi-id');
    const namaInput = document.getElementById('input-sesi-nama');
    const tipeInput = document.getElementById('input-sesi-tipe');
    const statusInput = document.getElementById('input-sesi-status');
    const jamMulaiInput = document.getElementById('input-sesi-jam-mulai');
    const jamSelesaiInput = document.getElementById('input-sesi-jam-selesai');
    const btnText = document.getElementById('btn-submit-sesi-text');
    const btnIcon = document.getElementById('btn-submit-sesi-icon');
    const btnCancel = document.getElementById('btn-cancel-sesi');

    const id = sesi.sesiId || sesi.id || '';
    const nama = sesi.namaSesi || sesi.nama || '';
    const jenis = sesi.jenisSesi || sesi.jenis || '';
    const status = sesi.status || 'Aktif Digunakan';
    const jamMulai = cleanSesiTime(sesi.jamMulai, '05:15');
    const jamSelesai = cleanSesiTime(sesi.jamSelesai, '06:30');

    if (idInput) idInput.value = id;
    if (namaInput) namaInput.value = nama;
    if (tipeInput && jenis) tipeInput.value = jenis;
    if (statusInput && status) statusInput.value = status;
    if (jamMulaiInput && jamMulai) jamMulaiInput.value = jamMulai;
    if (jamSelesaiInput && jamSelesai) jamSelesaiInput.value = jamSelesai;
    if (btnText) btnText.innerText = "Update Sesi";
    if (btnIcon) btnIcon.className = "fa-solid fa-pen-to-square text-[10px]";
    if (btnCancel) btnCancel.classList.remove('hidden');

    const rawHari = sesi.hariList || sesi.hari || [];
    const hariList = Array.isArray(rawHari) ? rawHari : String(rawHari).split(',').map(h => h.trim());
    document.querySelectorAll('input[name="sesi-hari"]').forEach(chk => {
        chk.checked = hariList.includes(chk.value);
    });

    // Scroll form into view
    document.getElementById('form-tahfidz-sesi')?.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Hapus jadwal sesi waktu
 */
async function deleteTahfidzSesiConfirm(sesiId, namaSesi) {
    if (!confirm(`Hapus jadwal sesi "${namaSesi || sesiId}"?`)) return;

    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(TAHFIDZ_STORAGE_KEYS.adminToken)) || "";
        const res = await apiPost("deleteTahfidzSesi", { token, sesiId, id: sesiId });

        if (res && (res.success || res.status === "success")) {
            if (typeof showToast === 'function') showToast("🗑️ Jadwal sesi berhasil dihapus.");
            if (ASNTahfidz.data.sesiList) {
                ASNTahfidz.data.sesiList = ASNTahfidz.data.sesiList.filter(s => (s.sesiId || s.id) !== sesiId);
            }
            resetTahfidzSesiForm();
            renderTahfidzSesiCards();
            loadAdminTahfidzData(true);
        } else {
            if (typeof showToast === 'function') showToast("❌ Gagal menghapus sesi: " + ((res && res.message) || "Terjadi kesalahan"));
        }
    } catch (err) {
        console.error(err);
        if (typeof showToast === 'function') showToast("❌ Terjadi kendala saat menghapus sesi.");
    }
}

/**
 * Simpan semua perubahan di footer modal halaqah
 */
async function saveAllHalaqahChanges() {
    if (typeof showToast === 'function') showToast("⏳ Menyimpan seluruh perubahan & menyinkronkan data...");
    await loadAdminTahfidzData(true);
    if (typeof showToast === 'function') showToast("✅ Data halaqah, plotting & sesi berhasil disinkronkan.");
    closeTahfidzHalaqahModal();
}

/**
 * Konfirmasi & Hapus Kelompok Halaqah
 */
async function deleteTahfidzHalaqahConfirm(halaqahId, namaHalaqah) {
    if (!halaqahId) return;
    if (!confirm(`Hapus kelompok halaqah "${namaHalaqah || halaqahId}"? Santri yang terplotting akan dilepas dari halaqah ini.`)) {
        return;
    }

    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(TAHFIDZ_STORAGE_KEYS.adminToken)) || "";
        const res = await apiPost("deleteTahfidzHalaqah", { halaqahId, token });

        if (res && (res.success || res.status === "success")) {
            if (typeof showToast === 'function') showToast("🗑️ Halaqah berhasil dihapus!");
            if (ASNTahfidz.data.halaqahs) {
                ASNTahfidz.data.halaqahs = ASNTahfidz.data.halaqahs.filter(h => h.halaqahId !== halaqahId);
            }
            try {
                sessionStorage.setItem(TAHFIDZ_CACHE_KEY, JSON.stringify({
                    data: ASNTahfidz.data,
                    timestamp: Date.now()
                }));
            } catch (e) {
                console.warn("Gagal simpan cache:", e);
            }

            renderTahfidzHalaqahCards();
            populatePlottingHalaqahSelector();
            renderTahfidzMatriksBeban();
            populateTahfidzFilters();

            await loadAdminTahfidzData(true);
            renderTahfidzHalaqahCards();
            populatePlottingHalaqahSelector();
            renderTahfidzMatriksBeban();
            populateTahfidzFilters();
        } else {
            if (typeof showToast === 'function') showToast("❌ Gagal menghapus halaqah: " + ((res && res.message) || "Terjadi kesalahan"));
        }
    } catch (err) {
        console.error(err);
        if (typeof showToast === 'function') showToast("❌ Terjadi kesalahan saat menghapus halaqah.");
    }
}

/**
 * Tambah halaqah baru (Tab 1)
 */
async function submitNewHalaqah(e) {
    if (e) e.preventDefault();

    const nama = document.getElementById('input-halaqah-nama')?.value || '';
    const kat = document.getElementById('input-halaqah-kategori')?.value || 'Tahfidz Anak';
    const muh = document.getElementById('input-halaqah-muhafiz')?.value || '';
    const target = document.getElementById('input-halaqah-target')?.value || '';

    if (!nama) {
        if (typeof showToast === 'function') showToast("⚠️ Nama Halaqah wajib diisi.");
        return;
    }

    const btn = document.getElementById('btn-submit-tahfidz-halaqah');
    setTahfidzButtonLoading(btn, true, "Menyimpan Halaqah...");

    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(TAHFIDZ_STORAGE_KEYS.adminToken)) || "";
        const res = await apiPost("saveTahfidzHalaqah", {
            token,
            namaHalaqah: nama,
            kategori: kat,
            muhafiz: muh,
            targetKurikulum: target
        });

        if (res && (res.success || res.status === "success")) {
            if (typeof showToast === 'function') showToast("✅ Halaqah baru berhasil dibuat!");
            if (document.getElementById('input-halaqah-nama')) document.getElementById('input-halaqah-nama').value = '';
            if (document.getElementById('input-halaqah-target')) document.getElementById('input-halaqah-target').value = '';
            
            const newHalaqah = {
                halaqahId: res.halaqahId || ("HLQ-" + Date.now()),
                namaHalaqah: nama,
                kategori: kat,
                muhafiz: muh,
                targetKurikulum: target,
                studentCount: 0
            };

            // Tambahkan halaqah lokal ke state
            if (!ASNTahfidz.data.halaqahs) ASNTahfidz.data.halaqahs = [];
            const existingIdx = ASNTahfidz.data.halaqahs.findIndex(h => h.halaqahId === newHalaqah.halaqahId);
            if (existingIdx !== -1) {
                ASNTahfidz.data.halaqahs[existingIdx] = newHalaqah;
            } else {
                ASNTahfidz.data.halaqahs.push(newHalaqah);
            }

            // Segera sinkronkan cache browser agar state baru tidak hilang
            try {
                sessionStorage.setItem(TAHFIDZ_CACHE_KEY, JSON.stringify({
                    data: ASNTahfidz.data,
                    timestamp: Date.now()
                }));
            } catch (e) {
                console.warn("Gagal simpan cache:", e);
            }

            // Segera render tampilan kartu, selector plotting, matriks dan dropdown filter dashboard
            renderTahfidzHalaqahCards();
            populatePlottingHalaqahSelector();
            renderTahfidzMatriksBeban();
            populateTahfidzFilters();

            // Sinkronisasi data di latar belakang
            await loadAdminTahfidzData(true);

            // Re-render sekali lagi untuk memastikan keselarasan data server
            renderTahfidzHalaqahCards();
            populatePlottingHalaqahSelector();
            renderTahfidzMatriksBeban();
            populateTahfidzFilters();
        } else {
            if (typeof showToast === 'function') showToast("❌ Gagal membuat halaqah: " + ((res && res.message) || "Terjadi kesalahan"));
        }
    } catch (err) {
        console.error(err);
        if (typeof showToast === 'function') showToast("❌ Gagal menghubungi server.");
    } finally {
        setTahfidzButtonLoading(btn, false);
    }
}

// ====================================================================
// 6. EXPORT & PRINT
// ====================================================================

/**
 * Cetak Rapor Mutaba'ah Santri Perorangan
 */
function printTahfidzStudentCard(studentId) {
    openTahfidzStudentDetail(studentId);
    setTimeout(() => {
        window.print();
    }, 500);
}

/**
 * Cetak Rekapitulasi Tahfidz Pesantren
 */
function printTahfidzRekap() {
    window.print();
}

/**
 * Ekspor Data Mutaba'ah ke CSV
 */
/**
 * Ekspor Data Mutaba'ah ke Excel (.xlsx) menggunakan SheetJS
 */
function exportTahfidzDataXLSX() {
    const students = ASNTahfidz.filteredStudents || (ASNTahfidz.data && ASNTahfidz.data.students) || [];
    if (students.length === 0) {
        if (typeof showToast === 'function') showToast("⚠️ Tidak ada data untuk diekspor.");
        return;
    }

    const doExport = () => {
        try {
            // 1. Siapkan header dan baris data
            const headers = [
                "No", "NIS", "Nama Santri", "Gender", "Program / Kelas",
                "Kelompok Halaqah", "Muhafiz Pembina", "Capaian (Juz)",
                "Persentase Capaian", "Target Ziyadah / Sesi", "Target Ziyadah / Pekan",
                "Target Muraja'ah / Sesi", "Target Muraja'ah / Pekan",
                "Setoran Terakhir", "Nilai Terakhir", "Status Kelulusan", "Status On-Track"
            ];

            const rows = students.map((st, idx) => [
                idx + 1,
                st.nis || "-",
                st.name || "-",
                st.gender === "P" ? "Perempuan" : "Laki-laki",
                st.program || "Tahfidz",
                st.halaqah?.namaHalaqah || "-",
                st.halaqah?.muhafiz || "-",
                st.progress?.currentJuz || 1,
                `${st.progress?.percent || 0}%`,
                st.target?.ziyadahSesi || 1,
                st.target?.ziyadahPekan || 10,
                st.target?.murajaahSesi || 2,
                st.target?.murajaahPekan || 10,
                st.setoranTerakhir ? `${st.setoranTerakhir.surah || ''} (${st.setoranTerakhir.tanggal || ''})` : "Belum Setor",
                st.setoranTerakhir?.nilai || "-",
                st.setoranTerakhir?.statusSetoran === 'ULANG' ? "Wajib Mengulang (I'adah)" : (st.setoranTerakhir ? "Lulus / Lanjut" : "-"),
                st.progress?.onTrackStatus || "-"
            ]);

            const wsData = [headers, ...rows];
            const ws = XLSX.utils.aoa_to_sheet(wsData);

            // 2. Tentukan lebar kolom ideal agar terbaca rapi di Microsoft Excel
            ws['!cols'] = [
                { wch: 5 },  // No
                { wch: 14 }, // NIS
                { wch: 28 }, // Nama Santri
                { wch: 14 }, // Gender
                { wch: 22 }, // Program
                { wch: 24 }, // Halaqah
                { wch: 24 }, // Muhafiz
                { wch: 14 }, // Capaian Juz
                { wch: 18 }, // Persentase
                { wch: 20 }, // Target Ziyadah / Sesi
                { wch: 20 }, // Target Ziyadah / Pekan
                { wch: 22 }, // Target Murajaah / Sesi
                { wch: 22 }, // Target Murajaah / Pekan
                { wch: 28 }, // Setoran Terakhir
                { wch: 14 }, // Nilai Terakhir
                { wch: 26 }, // Status Kelulusan (I'adah)
                { wch: 22 }  // Status On-Track
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Rekap Capaian Tahfidz");

            const dateStr = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `Rekap_Tahfidz_Mubarokah_${dateStr}.xlsx`);
            if (typeof showToast === 'function') showToast("📥 Rekap Tahfidz (.xlsx) berhasil diunduh!");
        } catch (err) {
            console.error("Gagal export XLSX:", err);
            exportTahfidzDataCSVFallback();
        }
    };

    if (typeof XLSX !== 'undefined') {
        doExport();
    } else {
        // Load SheetJS secara on-demand jika belum terpasang
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
        script.onload = () => doExport();
        script.onerror = () => {
            console.warn("Gagal memuat SheetJS CDN, beralih ke format CSV...");
            exportTahfidzDataCSVFallback();
        };
        document.head.appendChild(script);
    }
}

/**
 * Fallback Ekspor CSV jika library Excel offline
 */
function exportTahfidzDataCSVFallback() {
    const students = ASNTahfidz.filteredStudents || (ASNTahfidz.data && ASNTahfidz.data.students) || [];
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "NIS,Nama Santri,Gender,Program,Halaqah,Capaian Juz,Persentase,Target Ziyadah Harian,Target Ziyadah Pekan,Status Mutabaah,Status On-Track\n";

    students.forEach(st => {
        const row = [
            `"${st.nis || ''}"`,
            `"${st.name || ''}"`,
            `"${st.gender || 'L'}"`,
            `"${st.program || ''}"`,
            `"${st.halaqah?.namaHalaqah || ''}"`,
            `"${st.progress?.currentJuz || 1}"`,
            `"${st.progress?.percent || 0}%"`,
            `"${st.target?.ziyadahSesi || 1}"`,
            `"${st.target?.ziyadahPekan || 10}"`,
            `"${st.setoranTerakhir?.statusSetoran === 'ULANG' ? 'Wajib Mengulang' : 'Lanjut'}"`,
            `"${st.progress?.onTrackStatus || ''}"`
        ].join(",");
        csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Rekap_Tahfidz_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (typeof showToast === 'function') showToast("📥 Rekap Tahfidz (.csv) berhasil diunduh.");
}

// Alias untuk kompatibilitas
function exportTahfidzDataCSV() {
    exportTahfidzDataXLSX();
}

// ====================================================================
// 7. INTEGRASI WALI SANTRI & PENGASUH
// ====================================================================

/**
 * Buka Pantauan Lengkap Tahfidz untuk Pengasuh
 */
function openTahfidzPengasuhView() {
    ASNTahfidz.viewerRole = 'pengasuh';
    if (typeof loadAdminTahfidzData === 'function') {
        loadAdminTahfidzData();
    }
    if (typeof switchTab === 'function') {
        switchTab('admin', false);
    }
    if (typeof showAdminView === 'function') {
        showAdminView('tahfidz');
    }

    // Sembunyikan kontrol administratif harian agar tampilan Pengasuh fokus pada evaluasi mutu
    setTimeout(() => {
        document.querySelectorAll('.tahfidz-admin-action').forEach(el => {
            el.style.display = 'none';
        });
    }, 150);
}

/**
 * Inisialisasi Tab Sheet Database Tahfidz di Google Spreadsheet
 */
async function triggerInitTahfidzSheets() {
    const ok = confirm("Inisialisasi Database Tahfidz di Google Spreadsheet?\n\nSistem akan membuat 3 tab sheet baru secara otomatis jika belum ada:\n1. Tahfidz_Logs (Riwayat Setoran)\n2. Tahfidz_Target (Target Individual)\n3. Tahfidz_Halaqah (Kelompok Halaqah)\n\nLanjutkan?");
    if (!ok) return;

    try {
        if (typeof showToast === 'function') {
            showToast("⏳ Menghubungi Spreadsheet untuk membuat tab sheet...");
        }

        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(TAHFIDZ_STORAGE_KEYS.adminToken)) || "";
        const res = await apiPost("initTahfidzSheets", { token });

        if (res && (res.success || res.status === "success")) {
            const msg = res.message || "Tab sheet Tahfidz berhasil dibuat di Spreadsheet!";
            if (typeof showToast === 'function') {
                showToast("✅ " + msg);
            }
            alert("SUKSES:\n" + msg);
            loadAdminTahfidzData();
        } else {
            alert("Pemberitahuan:\n" + ((res && res.message) || "Gagal membuat tab sheet. Pastikan Anda sudah login sebagai Admin."));
        }
    } catch (err) {
        console.error("Error triggerInitTahfidzSheets:", err);
        alert("Terjadi kendala koneksi: " + err.message);
    }
}

// Auto-export to global window
window.ASNTahfidz = ASNTahfidz;
window.loadAdminTahfidzData = loadAdminTahfidzData;
window.triggerInitTahfidzSheets = triggerInitTahfidzSheets;
window.filterTahfidzList = filterTahfidzList;
window.openTahfidzCatatModal = openTahfidzCatatModal;
window.closeTahfidzCatatModal = closeTahfidzCatatModal;
window.setTahfidzCatatTipe = setTahfidzCatatTipe;
window.toggleTahfidzPage = toggleTahfidzPage;
window.applyTahfidzQuickChip = applyTahfidzQuickChip;
window.submitTahfidzCatat = submitTahfidzCatat;
window.openTahfidzStudentDetail = openTahfidzStudentDetail;
window.closeTahfidzStudentDetail = closeTahfidzStudentDetail;
window.switchTahfidzDetailTab = switchTahfidzDetailTab;
window.deleteTahfidzLogEntry = deleteTahfidzLogEntry;
window.openTahfidzTargetModal = openTahfidzTargetModal;
window.cleanSesiTime = cleanSesiTime;
window.closeTahfidzTargetModal = closeTahfidzTargetModal;
window.setTahfidzTargetChip = setTahfidzTargetChip;
window.submitTahfidzTarget = submitTahfidzTarget;
window.openTahfidzHalaqahModal = openTahfidzHalaqahModal;
window.closeTahfidzHalaqahModal = closeTahfidzHalaqahModal;
window.switchHalaqahTab = switchHalaqahTab;
window.openPlottingFromHalaqahCard = openPlottingFromHalaqahCard;
window.populatePlottingHalaqahSelector = populatePlottingHalaqahSelector;
window.onSelectPlottingHalaqah = onSelectPlottingHalaqah;
window.renderTahfidzMatriksBeban = renderTahfidzMatriksBeban;
window.renderTahfidzSesiCards = renderTahfidzSesiCards;
window.submitTahfidzSesi = submitTahfidzSesi;
window.deleteTahfidzSesiConfirm = deleteTahfidzSesiConfirm;
window.editTahfidzSesi = editTahfidzSesi;
window.saveAllHalaqahChanges = saveAllHalaqahChanges;
window.setTahfidzDetailTipeFilter = setTahfidzDetailTipeFilter;
window.onChangeIndikatorDate = onChangeIndikatorDate;
window.shiftIndikatorWeek = shiftIndikatorWeek;
window.shiftIndikatorMonth = shiftIndikatorMonth;
window.setIndikatorPreset = setIndikatorPreset;
window.submitNewHalaqah = submitNewHalaqah;
window.printTahfidzStudentCard = printTahfidzStudentCard;
window.printTahfidzRekap = printTahfidzRekap;
window.exportTahfidzDataCSV = exportTahfidzDataCSV;
window.exportTahfidzDataXLSX = exportTahfidzDataXLSX;
window.openTahfidzPengasuhView = openTahfidzPengasuhView;
window.deleteTahfidzHalaqahConfirm = deleteTahfidzHalaqahConfirm;
window.openPlottingSantri = openPlottingSantri;
window.closeTahfidzPlottingModal = closeTahfidzPlottingModal;
window.addStudentToPlotting = addStudentToPlotting;
window.removeStudentFromPlotting = removeStudentFromPlotting;
window.filterTahfidzPlottingAvailableList = filterTahfidzPlottingAvailableList;
window.submitTahfidzPlotting = submitTahfidzPlotting;
window.resetTahfidzSesiForm = resetTahfidzSesiForm;
window.recalculateTahfidzTargetWeekly = recalculateTahfidzTargetWeekly;
window.renderTahfidzTargetModalSessions = renderTahfidzTargetModalSessions;
window.getTahfidzActiveWeeklySessionCounts = getTahfidzActiveWeeklySessionCounts;

// Bulk Target & Selection Functions
window.updateTahfidzBulkSelectionBar = updateTahfidzBulkSelectionBar;
window.toggleSelectAllTahfidzStudents = toggleSelectAllTahfidzStudents;
window.toggleSelectTahfidzStudent = toggleSelectTahfidzStudent;
window.clearTahfidzSelectedStudents = clearTahfidzSelectedStudents;
window.openTahfidzBulkTargetModal = openTahfidzBulkTargetModal;
window.closeTahfidzBulkTargetModal = closeTahfidzBulkTargetModal;
window.setBulkTargetScope = setBulkTargetScope;
window.onBulkTargetScopeChange = onBulkTargetScopeChange;
window.recalculateBulkTargetWeekly = recalculateBulkTargetWeekly;
window.setTahfidzBulkTargetChip = setTahfidzBulkTargetChip;
window.submitTahfidzBulkTarget = submitTahfidzBulkTarget;
window.isStudentInHalaqah = isStudentInHalaqah;
window.populateTahfidzMuhafizSelector = populateTahfidzMuhafizSelector;
window.renderTahfidzEstimasiKhatam = renderTahfidzEstimasiKhatam;
