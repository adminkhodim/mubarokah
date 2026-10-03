/**
 * ====================================================================
 * MODUL FRONTEND: KEUANGAN, KASIR & TAGIHAN SANTRI (TAHAP 1)
 * PPTQ Roudlotul Mubarokah Kudus
 * ====================================================================
 * Fitur:
 * 1. Loket Kasir Cepat (Quick POS): Bayar SPP Bulanan & Tahunan < 10 Detik
 * 2. Kuitansi Digital & WhatsApp Gateway Bukti Bayar Otomatis
 * 3. Manajemen Tagihan Santri & Generator Tagihan Bulanan Massal
 * 4. Master Pos & Tarif Biaya Pesantren
 * 5. Dashboard Ringkasan Kas & Tunggakan dengan SWR Caching
 */

const KEUANGAN_CACHE_KEY = 'mubarokah_keuangan_dashboard_cache';
const KEUANGAN_CACHE_TTL_MS = 5 * 60 * 1000; // 5 Menit

const ASNKeuangan = {
    data: {
        summary: {
            totalPendapatanBulanIni: 0,
            totalTunggakan: 0,
            countLunas: 0,
            countBelumLunas: 0,
            persentasePelunasan: 100,
            totalSantriAktif: 0
        },
        tarifList: [],
        tagihanList: [],
        recentTransactions: [],
        students: []
    },
    filteredTagihan: [],
    filteredTransactions: [],
    cache: null,
    activeTab: 'pos', // 'pos' | 'tagihan' | 'transaksi' | 'tarif'
    pos: {
        selectedStudent: null,
        selectedTagihanIds: new Set(),
        selectedTagihanMap: {}, // tagihanId -> bayarNominal
        metodeBayar: 'TUNAI',
        nominalDiterima: 0,
        catatan: ''
    },
    lastKuitansi: null,
    _fetchPromise: null
};

/**
 * Format angka ke mata uang Rupiah
 */
function formatRupiah(num) {
    const val = Number(num) || 0;
    return 'Rp ' + val.toLocaleString('id-ID');
}
window.formatRupiah = formatRupiah;

/**
 * Helper format tanggal Indonesia
 */
function formatTglIndo(tglStr) {
    if (!tglStr) return '-';
    try {
        const d = new Date(tglStr);
        if (isNaN(d.getTime())) return tglStr;
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
        return tglStr;
    }
}
window.formatTglIndo = formatTglIndo;

/**
 * Helper nama bulan dalam Bahasa Indonesia
 */
function getNamaBulanIndo(bulanNum) {
    const bulan = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    return bulan[bulanNum - 1] || "";
}
window.getNamaBulanIndo = getNamaBulanIndo;

// ====================================================================
// ROLE ACCESS CONTROL (SUPER_ADMIN, ADMIN, BENDAHARA)
// ====================================================================

function getKeuanganActiveRole() {
    let r = (typeof ASNIdentity !== 'undefined' && ASNIdentity.currentRole) || 
            sessionStorage.getItem('ASN_ADMIN_ROLE') || 
            sessionStorage.getItem('mubarokah_admin_role') || 'SUPER_ADMIN';
    return String(r).toUpperCase().trim();
}
window.getKeuanganActiveRole = getKeuanganActiveRole;

function checkKeuanganRoleAccess() {
    const role = getKeuanganActiveRole();
    let isAllowed = ['SUPER_ADMIN', 'ADMIN', 'BENDAHARA'].includes(role);
    if (!isAllowed && typeof isModuleAllowedForRole === 'function') {
        isAllowed = isModuleAllowedForRole('keuangan', role) || isModuleAllowedForRole('akuntansi', role);
    }
    return { isAllowed, role };
}
window.checkKeuanganRoleAccess = checkKeuanganRoleAccess;

/**
 * Muat data lengkap dashboard Keuangan dengan pola SWR (Stale-While-Revalidate)
 */
async function loadAdminKeuanganData(forceRefresh = false) {
    const loader = document.getElementById('admin-keuangan-loader');
    const refreshIcon = document.getElementById('btn-refresh-keuangan-icon');

    // 0. Cek Hak Akses Role Khusus (SUPER_ADMIN, ADMIN, BENDAHARA)
    const roleCheck = checkKeuanganRoleAccess();
    const deniedEl = document.getElementById('keuangan-access-denied');
    const mainEl = document.getElementById('keuangan-main-content');
    const roleBadgeEl = document.getElementById('keuangan-operator-role');
    const roleIconEl = document.getElementById('keuangan-operator-icon');

    if (!roleCheck.isAllowed) {
        if (mainEl) mainEl.classList.add('hidden');
        if (deniedEl) {
            deniedEl.classList.remove('hidden');
            const roleNameEl = document.getElementById('keuangan-denied-role-name');
            if (roleNameEl) roleNameEl.innerText = roleCheck.role || "AKUN TERBATAS";
        }
        if (loader) loader.classList.add('hidden');
        return false;
    }

    if (deniedEl) deniedEl.classList.add('hidden');
    if (mainEl) mainEl.classList.remove('hidden');
    if (roleBadgeEl) {
        const roleLabels = {
            'SUPER_ADMIN': 'Super Admin',
            'ADMIN': 'Administrator',
            'BENDAHARA': 'Bendahara Pesantren'
        };
        roleBadgeEl.innerText = roleLabels[roleCheck.role] || roleCheck.role;
    }
    if (roleIconEl) {
        if (roleCheck.role === 'SUPER_ADMIN') {
            roleIconEl.className = "fa-solid fa-crown text-[8px] text-amber-500";
        } else if (roleCheck.role === 'ADMIN') {
            roleIconEl.className = "fa-solid fa-shield-halved text-[8px] text-indigo-500";
        } else {
            roleIconEl.className = "fa-solid fa-wallet text-[8px] text-emerald-600";
        }
    }

    if (refreshIcon && forceRefresh) {
        refreshIcon.classList.add('fa-spin');
        try {
            sessionStorage.removeItem(KEUANGAN_CACHE_KEY);
            localStorage.removeItem(KEUANGAN_CACHE_KEY);
        } catch (e) {}
        ASNKeuangan.cache = null;
    }

    // 1. Cek cache lokal untuk render instan (< 30ms)
    let hasRenderedFromCache = false;
    if (!forceRefresh) {
        let cached = ASNKeuangan.cache;
        if (!cached) {
            try {
                const stored = localStorage.getItem(KEUANGAN_CACHE_KEY) || sessionStorage.getItem(KEUANGAN_CACHE_KEY);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (parsed && (parsed.data || parsed.tagihanList || parsed.students)) {
                        cached = parsed.data || parsed;
                        ASNKeuangan.cache = cached;
                    }
                }
            } catch (e) {
                console.warn("Gagal membaca cache Keuangan:", e);
            }
        }

        // Fallback: Jika cache keuangan belum ada, pinjam master santri dari window.adminStudentsData
        if (!cached && typeof window !== 'undefined' && Array.isArray(window.adminStudentsData) && window.adminStudentsData.length > 0) {
            cached = {
                success: true,
                summary: {
                    totalPendapatanBulanIni: 0,
                    totalTunggakan: 0,
                    countLunas: 0,
                    countBelumLunas: 0,
                    persentasePelunasan: 100,
                    totalSantriAktif: window.adminStudentsData.length
                },
                tarifList: [
                    { tarifId: "TRF-SPP-01", namaPos: "SPP & Syahriah Pesantren", kategori: "BULANAN", tipePeriode: "BULANAN", nominalDefault: 350000, program: "SEMUA", isActive: true },
                    { tarifId: "TRF-MKN-01", namaPos: "Katering & Makan Santri", kategori: "BULANAN", tipePeriode: "BULANAN", nominalDefault: 250000, program: "SEMUA", isActive: true },
                    { tarifId: "TRF-DU-01", namaPos: "Daftar Ulang Tahunan", kategori: "TAHUNAN", tipePeriode: "TAHUNAN", nominalDefault: 500000, program: "SEMUA", isActive: true }
                ],
                tagihanList: [],
                recentTransactions: [],
                students: window.adminStudentsData.map(st => ({
                    studentId: st.studentId || st.id,
                    nis: st.nis || "",
                    name: st.name || st.nama,
                    gender: (st.gender || "L").toUpperCase(),
                    program: st.program || "Tahfidz",
                    photoUrl: st.photoUrl || st.foto || "",
                    status: "AKTIF"
                }))
            };
        }

        if (cached && (cached.success || cached.status === "success")) {
            ASNKeuangan.data = cached;
            renderKeuanganSummaryCards();
            renderKeuanganTarifTable();
            populateKeuanganTagihanProgramFilter();
            filterKeuanganTagihan();
            renderKeuanganTransaksiTable();
            renderKeuanganPengeluaranTable();
            populateKategoriPengeluaranDropdown();
            if (ASNKeuangan.activeTab === 'tutup-kasir') loadTutupKasirRealtime();
            if (ASNKeuangan.activeTab === 'laporan') renderKeuanganLaporanView();
            hasRenderedFromCache = true;
            if (loader) loader.classList.add('hidden');
        }
    }

    if (!hasRenderedFromCache && loader) {
        loader.classList.remove('hidden');
    }

    if (ASNKeuangan._fetchPromise) {
        return ASNKeuangan._fetchPromise;
    }

    ASNKeuangan._fetchPromise = (async () => {
        try {
            const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : null) || "";
            let response;
            try {
                response = await apiPost("keuangan.dashboard", { token });
            } catch (errPost) {
                response = await apiGet("keuangan.dashboard", token ? { token } : {});
            }

            if (response && (response.success || response.status === "success")) {
                ASNKeuangan.data = response;
                ASNKeuangan.cache = response;

                try {
                    const payloadCache = JSON.stringify({ data: response, timestamp: Date.now() });
                    localStorage.setItem(KEUANGAN_CACHE_KEY, payloadCache);
                    sessionStorage.setItem(KEUANGAN_CACHE_KEY, payloadCache);
                } catch (e) {}

                renderKeuanganSummaryCards();
                renderKeuanganTarifTable();
                populateKeuanganTagihanProgramFilter();
                filterKeuanganTagihan();
                renderKeuanganTransaksiTable();
                renderKeuanganPengeluaranTable();
                populateKategoriPengeluaranDropdown();
                if (ASNKeuangan.activeTab === 'tutup-kasir') loadTutupKasirRealtime();
                if (ASNKeuangan.activeTab === 'laporan') renderKeuanganLaporanView();

                if (forceRefresh && typeof showToast === 'function') {
                    showToast("✅ Data Keuangan berhasil disinkronkan.");
                }
            } else {
                console.warn("Respon Keuangan tidak sukses:", response);
            }
        } catch (err) {
            console.error("Gagal sinkronisasi data keuangan:", err);
            if (!hasRenderedFromCache && typeof showToast === 'function') {
                showToast("⚠️ Menampilkan data offline / lokal.");
            }
        } finally {
            ASNKeuangan._fetchPromise = null;
            if (loader) loader.classList.add('hidden');
            if (refreshIcon) refreshIcon.classList.remove('fa-spin');
        }
    })();

    return ASNKeuangan._fetchPromise;
}
window.loadAdminKeuanganData = loadAdminKeuanganData;

/**
 * Inisialisasi sheet keuangan langsung dari tombol UI jika belum dibuat
 */
async function initKeuanganDatabaseSheets() {
    if (!confirm("Inisialisasi tabel Keuangan (Tarif, Tagihan, dan Transaksi) di Google Spreadsheet sekarang?")) return;
    try {
        if (typeof showToast === 'function') showToast("⏳ Menginisialisasi sheet keuangan...");
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : null) || "";
        const res = await apiPost("keuangan.initSheets", { token });
        if (res && res.success) {
            if (typeof showToast === 'function') showToast("✅ Sheet Keuangan berhasil diinisialisasi.");
            loadAdminKeuanganData(true);
        } else {
            alert("Gagal inisialisasi sheet: " + ((res && res.message) || "Terjadi kesalahan"));
        }
    } catch (e) {
        alert("Error: " + e.message);
    }
}
window.initKeuanganDatabaseSheets = initKeuanganDatabaseSheets;

/**
 * Render Kartu Statistik Ringkasan Keuangan (Inflow, Outflow, Surplus-Defisit, Piutang, Kepatuhan)
 */
function renderKeuanganSummaryCards() {
    const sum = ASNKeuangan.data.summary || {};
    const elPendapatan = document.getElementById('keuangan-stat-pendapatan');
    const elPengeluaran = document.getElementById('keuangan-stat-pengeluaran');
    const elSurplus = document.getElementById('keuangan-stat-surplus');
    const elTunggakan = document.getElementById('keuangan-stat-tunggakan');
    const elLunas = document.getElementById('keuangan-stat-lunas');
    const elPersen = document.getElementById('keuangan-stat-persentase');

    const totalMasuk = Number(sum.totalPendapatanBulanIni) || 0;
    const totalKeluar = Number(sum.totalPengeluaranBulanIni) || 0;
    const surplusDefisit = sum.surplusDefisit !== undefined ? Number(sum.surplusDefisit) : (totalMasuk - totalKeluar);

    if (elPendapatan) elPendapatan.innerText = formatRupiah(totalMasuk);
    if (elPengeluaran) elPengeluaran.innerText = formatRupiah(totalKeluar);

    if (elSurplus) {
        if (surplusDefisit >= 0) {
            elSurplus.innerText = formatRupiah(surplusDefisit);
            elSurplus.className = "text-sm sm:text-base md:text-lg font-black text-teal-700 dark:text-teal-300";
        } else {
            elSurplus.innerText = `-${formatRupiah(Math.abs(surplusDefisit))}`;
            elSurplus.className = "text-sm sm:text-base md:text-lg font-black text-rose-600 dark:text-rose-400";
        }
    }

    if (elTunggakan) elTunggakan.innerText = formatRupiah(sum.totalTunggakan || 0);
    if (elLunas) elLunas.innerText = `(${sum.countLunas || 0} Lunas / ${sum.countBelumLunas || 0} Belum)`;
    if (elPersen) elPersen.innerText = `${sum.persentasePelunasan || 100}%`;

    // Sinkronisasi KPI Ringkasan View Akuntansi & Pembukuan
    const elAkunInflow = document.getElementById('akuntansi-stat-inflow');
    const elAkunOutflow = document.getElementById('akuntansi-stat-outflow');
    const elAkunSurplus = document.getElementById('akuntansi-stat-surplus');
    const elAkunPiutang = document.getElementById('akuntansi-stat-piutang');
    if (elAkunInflow) elAkunInflow.innerText = formatRupiah(totalMasuk);
    if (elAkunOutflow) elAkunOutflow.innerText = formatRupiah(totalKeluar);
    if (elAkunSurplus) {
        if (surplusDefisit >= 0) {
            elAkunSurplus.innerText = formatRupiah(surplusDefisit);
            elAkunSurplus.className = "text-sm sm:text-base md:text-lg font-black text-teal-700 dark:text-teal-300";
        } else {
            elAkunSurplus.innerText = `-${formatRupiah(Math.abs(surplusDefisit))}`;
            elAkunSurplus.className = "text-sm sm:text-base md:text-lg font-black text-rose-600 dark:text-rose-400";
        }
    }
    if (elAkunPiutang) elAkunPiutang.innerText = formatRupiah(sum.totalTunggakan || 0);

    // Badge Pending Konfirmasi Transfer (Fase 3)
    const pendingCount = Number(sum.pendingKonfirmasiCount) || 0;
    const badgePending = document.getElementById('keuangan-badge-pending-count');
    if (badgePending) {
        if (pendingCount > 0) {
            badgePending.innerText = pendingCount;
            badgePending.classList.remove('hidden');
        } else {
            badgePending.classList.add('hidden');
        }
    }
}
window.renderKeuanganSummaryCards = renderKeuanganSummaryCards;

const KEUANGAN_SANTRI_TABS = ['pos', 'tagihan', 'verifikasi', 'broadcast', 'tabungan', 'kantin'];
const AKUNTANSI_TABS = ['transaksi', 'pengeluaran', 'tutup-kasir', 'laporan', 'analytics', 'tarif'];

/**
 * Berpindah Tab di Modul 1: Keuangan & Kasir Santri (Front-Office)
 */
function switchKeuanganTab(tabName) {
    if (AKUNTANSI_TABS.includes(tabName)) {
        if (typeof showAdminView === 'function') showAdminView('akuntansi');
        switchAkuntansiTab(tabName);
        return;
    }

    ASNKeuangan.activeTab = tabName;

    KEUANGAN_SANTRI_TABS.forEach(t => {
        const btn = document.getElementById(`tab-btn-keuangan-${t}`);
        const view = document.getElementById(`keuangan-panel-${t}`);
        if (btn) {
            if (t === tabName) {
                btn.className = "px-3.5 py-2 rounded-xl text-xs font-bold transition bg-emerald-600 text-white shadow-sm flex items-center gap-1.5 shrink-0";
            } else {
                btn.className = "px-3.5 py-2 rounded-xl text-xs font-bold transition text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1c2836] flex items-center gap-1.5 shrink-0";
            }
        }
        if (view) {
            if (t === tabName) view.classList.remove('hidden');
            else view.classList.add('hidden');
        }
    });

    if (tabName === 'pos') {
        const input = document.getElementById('keuangan-pos-search-input');
        if (input) setTimeout(() => input.focus(), 150);
    } else if (tabName === 'tagihan') {
        filterKeuanganTagihan();
    } else if (tabName === 'verifikasi') {
        renderKeuanganVerifikasiTable();
    } else if (tabName === 'broadcast') {
        loadBroadcastTagihanData();
    } else if (tabName === 'tabungan') {
        loadTabunganDashboardData();
    } else if (tabName === 'kantin') {
        initKantinCashlessPOS();
    }
}
window.switchKeuanganTab = switchKeuanganTab;

/**
 * Berpindah Tab di Modul 2: Akuntansi & Pembukuan (Back-Office & Tata Kelola)
 */
function switchAkuntansiTab(tabName) {
    if (KEUANGAN_SANTRI_TABS.includes(tabName)) {
        if (typeof showAdminView === 'function') showAdminView('keuangan');
        switchKeuanganTab(tabName);
        return;
    }

    ASNKeuangan.activeAkuntansiTab = tabName;

    AKUNTANSI_TABS.forEach(t => {
        const btn = document.getElementById(`tab-btn-akuntansi-${t}`) || document.getElementById(`tab-btn-keuangan-${t}`);
        const view = document.getElementById(`keuangan-panel-${t}`);
        if (btn) {
            if (t === tabName) {
                btn.className = "px-3.5 py-2 rounded-xl text-xs font-bold transition bg-teal-600 text-white shadow-sm flex items-center gap-1.5 shrink-0";
            } else {
                btn.className = "px-3.5 py-2 rounded-xl text-xs font-bold transition text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1c2836] flex items-center gap-1.5 shrink-0";
            }
        }
        if (view) {
            if (t === tabName) view.classList.remove('hidden');
            else view.classList.add('hidden');
        }
    });

    if (tabName === 'transaksi') {
        renderKeuanganTransaksiTable();
    } else if (tabName === 'pengeluaran') {
        renderKeuanganPengeluaranTable();
        populateKategoriPengeluaranDropdown();
    } else if (tabName === 'tutup-kasir') {
        loadTutupKasirRealtime();
    } else if (tabName === 'laporan') {
        renderKeuanganLaporanView();
    } else if (tabName === 'analytics') {
        loadExecutiveAnalyticsData();
    } else if (tabName === 'tarif') {
        renderKeuanganTarifTable();
        populateKeuanganTarifProgramDropdown();
    }
}
window.switchAkuntansiTab = switchAkuntansiTab;

// ====================================================================
// SUB-MODUL 1: KASIR CEPAT (QUICK POS)
// ====================================================================

/**
 * Autocomplete pencarian santri di loket POS
 */
function onKeuanganPOSSearch(query) {
    const q = String(query || "").trim().toLowerCase();
    const dropdown = document.getElementById('keuangan-pos-search-results');
    if (!dropdown) return;

    if (!q || q.length < 1) {
        dropdown.classList.add('hidden');
        dropdown.innerHTML = '';
        return;
    }

    const students = ASNKeuangan.data.students || [];
    const matches = students.filter(st => {
        const name = (st.name || "").toLowerCase();
        const nis = (st.nis || "").toLowerCase();
        const prog = (st.program || "").toLowerCase();
        return name.includes(q) || nis.includes(q) || prog.includes(q);
    }).slice(0, 8); // Ambil maksimal 8 matches

    if (matches.length === 0) {
        dropdown.innerHTML = `
            <div class="p-3 text-xs text-slate-400 text-center">
                <i class="fa-solid fa-circle-exclamation mr-1"></i> Tidak ditemukan santri dengan kata kunci tersebut.
            </div>
        `;
        dropdown.classList.remove('hidden');
        return;
    }

    let html = '';
    matches.forEach(st => {
        html += `
            <div onclick="selectKeuanganPOSStudent('${escapeHtml(st.studentId)}')"
                class="p-2.5 hover:bg-emerald-50 dark:hover:bg-[#1a2b3c] cursor-pointer flex items-center justify-between border-b border-slate-100 dark:border-[#253447] last:border-0 transition">
                <div class="flex items-center space-x-2.5">
                    <div class="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800">
                        ${st.photoUrl ? `<img src="${escapeHtml(st.photoUrl)}" class="w-full h-full rounded-full object-cover">` : `<i class="fa-solid fa-user text-xs"></i>`}
                    </div>
                    <div>
                        <div class="text-xs font-bold text-slate-800 dark:text-slate-100 leading-snug">${escapeHtml(st.name)}</div>
                        <div class="text-[10px] text-slate-400">NIS: ${escapeHtml(st.nis || "-")} • Program: ${escapeHtml(st.program || "Tahfidz")}</div>
                    </div>
                </div>
                <span class="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-200/50">
                    Pilih
                </span>
            </div>
        `;
    });

    dropdown.innerHTML = html;
    dropdown.classList.remove('hidden');
}
window.onKeuanganPOSSearch = onKeuanganPOSSearch;

/**
 * Pilih Santri di Loket POS
 */
function selectKeuanganPOSStudent(studentId) {
    const dropdown = document.getElementById('keuangan-pos-search-results');
    if (dropdown) dropdown.classList.add('hidden');

    const students = ASNKeuangan.data.students || [];
    const st = students.find(s => String(s.studentId) === String(studentId));
    if (!st) return;

    ASNKeuangan.pos.selectedStudent = st;
    ASNKeuangan.pos.selectedTagihanIds = new Set();
    ASNKeuangan.pos.selectedTagihanMap = {};
    ASNKeuangan.pos.nominalDiterima = 0;

    // Render Info Santri
    const cardEl = document.getElementById('keuangan-pos-student-card');
    const emptyEl = document.getElementById('keuangan-pos-empty-prompt');
    const nameEl = document.getElementById('keuangan-pos-st-name');
    const nisEl = document.getElementById('keuangan-pos-st-nis');
    const progEl = document.getElementById('keuangan-pos-st-program');
    const photoEl = document.getElementById('keuangan-pos-st-photo');

    if (nameEl) nameEl.innerText = st.name;
    if (nisEl) nisEl.innerText = `NIS: ${st.nis || '-'}`;
    if (progEl) progEl.innerText = `${st.program || 'Tahfidz'} • ${st.gender === 'P' ? 'Santriwati' : 'Santri'}`;
    if (photoEl) {
        if (st.photoUrl) {
            photoEl.innerHTML = `<img src="${escapeHtml(st.photoUrl)}" class="w-full h-full rounded-full object-cover">`;
        } else {
            photoEl.innerHTML = `<i class="fa-solid fa-user text-base text-emerald-700 dark:text-emerald-300"></i>`;
        }
    }

    if (cardEl) cardEl.classList.remove('hidden');
    if (emptyEl) emptyEl.classList.add('hidden');

    // Ambil tagihan santri ini
    renderKeuanganPOSTagihanList();
}
window.selectKeuanganPOSStudent = selectKeuanganPOSStudent;

/**
 * Render daftar tagihan yang belum lunas milik santri terpilih di loket POS
 */
function renderKeuanganPOSTagihanList() {
    const container = document.getElementById('keuangan-pos-tagihan-container');
    if (!container) return;

    const st = ASNKeuangan.pos.selectedStudent;
    if (!st) {
        container.innerHTML = `<p class="text-xs text-slate-400 text-center py-6">Pilih santri terlebih dahulu untuk menampilkan tagihan.</p>`;
        return;
    }

    const allTagihan = ASNKeuangan.data.tagihanList || [];
    const stTagihan = allTagihan.filter(t => String(t.studentId) === String(st.studentId) && t.status !== "LUNAS");

    if (stTagihan.length === 0) {
        container.innerHTML = `
            <div class="p-6 text-center bg-emerald-50/60 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200 dark:border-emerald-800/40 space-y-2">
                <i class="fa-solid fa-circle-check text-2xl text-emerald-600 dark:text-emerald-400"></i>
                <div class="text-xs font-bold text-emerald-800 dark:text-emerald-200">Alhamdulillah, Tidak Ada Tagihan Tertunggak!</div>
                <p class="text-[11px] text-slate-500">Seluruh tagihan ananda ${escapeHtml(st.name)} telah lunas.</p>
                <div class="pt-2">
                    <button type="button" onclick="openGenerateBulkTagihanModal()" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition">
                        <i class="fa-solid fa-plus-circle mr-1"></i> Terbitkan Tagihan Baru
                    </button>
                </div>
            </div>
        `;
        calcKeuanganPOSTotal();
        return;
    }

    let html = `
        <div class="space-y-2">
            <div class="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-[#253447]">
                <span class="text-[11px] font-bold text-slate-500 uppercase">Pilih Tagihan yang Dibayar:</span>
                <button type="button" onclick="toggleSelectAllPOSTagihan()" class="text-[11px] font-bold text-emerald-600 hover:text-emerald-700">
                    Pilih Semua
                </button>
            </div>
    `;

    stTagihan.forEach(t => {
        const isChecked = ASNKeuangan.pos.selectedTagihanIds.has(t.tagihanId);
        const sisa = t.sisaTagihan !== undefined ? t.sisaTagihan : t.nominalTagihan;
        const curBayar = ASNKeuangan.pos.selectedTagihanMap[t.tagihanId] !== undefined ? ASNKeuangan.pos.selectedTagihanMap[t.tagihanId] : sisa;

        html += `
            <div class="p-3 rounded-2xl border transition ${isChecked ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 shadow-sm' : 'bg-white dark:bg-[#15202d] border-slate-200 dark:border-[#253447]'}">
                <div class="flex items-start justify-between gap-2">
                    <label class="flex items-start space-x-2.5 cursor-pointer select-none flex-1">
                        <input type="checkbox" onchange="toggleKeuanganPOSTagihan('${escapeHtml(t.tagihanId)}', this.checked, ${sisa})"
                            class="mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" ${isChecked ? 'checked' : ''}>
                        <div>
                            <div class="text-xs font-bold text-slate-800 dark:text-slate-100">${escapeHtml(t.namaPos)}</div>
                            <div class="text-[10px] text-slate-400">Periode: <strong class="text-slate-600 dark:text-slate-300">${escapeHtml(t.periode)}</strong> • Jatuh Tempo: ${t.dueDate || '-'}</div>
                            ${t.status === 'SEBAGIAN' ? `<span class="inline-block mt-1 text-[9px] font-extrabold text-amber-600 bg-amber-50 dark:bg-amber-950 px-1.5 py-0.5 rounded border border-amber-200">Cicil (Sudah Masuk: ${formatRupiah(t.nominalTerbayar)})</span>` : ''}
                        </div>
                    </label>
                    <div class="text-right shrink-0">
                        <span class="text-xs font-black text-slate-800 dark:text-slate-100 block">${formatRupiah(sisa)}</span>
                        <span class="text-[9px] text-slate-400">Sisa Tagihan</span>
                    </div>
                </div>

                ${isChecked ? `
                    <div class="mt-2.5 pt-2 border-t border-emerald-200/60 dark:border-emerald-800/40 flex items-center justify-between gap-2">
                        <span class="text-[10px] text-slate-500 font-semibold">Nominal Bayar:</span>
                        <div class="relative w-36">
                            <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">Rp</span>
                            <input type="number" value="${curBayar}" max="${sisa}" min="1000" step="5000"
                                oninput="updateKeuanganPOSBayarNominal('${escapeHtml(t.tagihanId)}', this.value, ${sisa})"
                                class="w-full pl-7 pr-2 py-1 text-right text-xs font-bold rounded-lg border border-slate-300 dark:border-[#2c3d52] bg-white dark:bg-[#1c2836] focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    });

    html += `</div>`;
    container.innerHTML = html;
    calcKeuanganPOSTotal();
}
window.renderKeuanganPOSTagihanList = renderKeuanganPOSTagihanList;

function toggleSelectAllPOSTagihan() {
    const st = ASNKeuangan.pos.selectedStudent;
    if (!st) return;

    const allTagihan = ASNKeuangan.data.tagihanList || [];
    const stTagihan = allTagihan.filter(t => String(t.studentId) === String(st.studentId) && t.status !== "LUNAS");

    const allChecked = stTagihan.every(t => ASNKeuangan.pos.selectedTagihanIds.has(t.tagihanId));

    if (allChecked) {
        ASNKeuangan.pos.selectedTagihanIds.clear();
        ASNKeuangan.pos.selectedTagihanMap = {};
    } else {
        stTagihan.forEach(t => {
            ASNKeuangan.pos.selectedTagihanIds.add(t.tagihanId);
            const sisa = t.sisaTagihan !== undefined ? t.sisaTagihan : t.nominalTagihan;
            ASNKeuangan.pos.selectedTagihanMap[t.tagihanId] = sisa;
        });
    }

    renderKeuanganPOSTagihanList();
}
window.toggleSelectAllPOSTagihan = toggleSelectAllPOSTagihan;

function toggleKeuanganPOSTagihan(tagihanId, checked, maxSisa) {
    if (checked) {
        ASNKeuangan.pos.selectedTagihanIds.add(tagihanId);
        ASNKeuangan.pos.selectedTagihanMap[tagihanId] = maxSisa;
    } else {
        ASNKeuangan.pos.selectedTagihanIds.delete(tagihanId);
        delete ASNKeuangan.pos.selectedTagihanMap[tagihanId];
    }
    renderKeuanganPOSTagihanList();
}
window.toggleKeuanganPOSTagihan = toggleKeuanganPOSTagihan;

function updateKeuanganPOSBayarNominal(tagihanId, val, maxSisa) {
    let num = Number(val) || 0;
    if (num > maxSisa) num = maxSisa;
    ASNKeuangan.pos.selectedTagihanMap[tagihanId] = num;
    calcKeuanganPOSTotal();
}
window.updateKeuanganPOSBayarNominal = updateKeuanganPOSBayarNominal;

/**
 * Hitung kalkulasi total tagihan, uang diterima, dan kembalian di loket POS
 */
function calcKeuanganPOSTotal() {
    let subtotal = 0;
    Object.values(ASNKeuangan.pos.selectedTagihanMap).forEach(v => {
        subtotal += Number(v) || 0;
    });

    const elSubtotal = document.getElementById('keuangan-pos-total-tagihan');
    const elKembalian = document.getElementById('keuangan-pos-kembalian');
    const btnSubmit = document.getElementById('keuangan-pos-btn-submit');
    const inputDiterima = document.getElementById('keuangan-pos-input-diterima');

    if (elSubtotal) elSubtotal.innerText = formatRupiah(subtotal);

    let diterima = Number(inputDiterima ? inputDiterima.value : 0) || 0;
    // Jika metode bukan Tunai (Transfer / QRIS), otomatis nominal diterima = subtotal
    const metode = ASNKeuangan.pos.metodeBayar;
    if (metode !== 'TUNAI') {
        diterima = subtotal;
        if (inputDiterima) inputDiterima.value = subtotal;
    }

    const kembalian = Math.max(0, diterima - subtotal);
    if (elKembalian) {
        elKembalian.innerText = formatRupiah(kembalian);
        if (diterima < subtotal && subtotal > 0 && metode === 'TUNAI') {
            elKembalian.innerText = "Kurang " + formatRupiah(subtotal - diterima);
            elKembalian.className = "text-sm font-black text-rose-600";
        } else {
            elKembalian.className = "text-sm font-black text-emerald-600 dark:text-emerald-400";
        }
    }

    if (btnSubmit) {
        const canSubmit = subtotal > 0 && (diterima >= subtotal || metode !== 'TUNAI');
        btnSubmit.disabled = !canSubmit;
        if (canSubmit) {
            btnSubmit.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
            btnSubmit.classList.add('opacity-50', 'cursor-not-allowed');
        }
    }

    // Update Floating Sticky Bottom Bar khusus Mobile POS
    const mobileBar = document.getElementById('keuangan-pos-mobile-bar');
    const mobileTotal = document.getElementById('keuangan-pos-mobile-total');
    const mobileCount = document.getElementById('keuangan-pos-mobile-count');
    const selCount = ASNKeuangan.pos.selectedTagihanIds.size;

    if (mobileTotal) mobileTotal.innerText = formatRupiah(subtotal);
    if (mobileCount) mobileCount.innerText = `${selCount} Tagihan Dipilih`;
    if (mobileBar) {
        if (subtotal > 0 && selCount > 0) {
            mobileBar.classList.remove('hidden');
        } else {
            mobileBar.classList.add('hidden');
        }
    }
}
window.calcKeuanganPOSTotal = calcKeuanganPOSTotal;

function scrollKeuanganPOSToCheckout() {
    const target = document.getElementById('keuangan-pos-wrap-diterima') || document.getElementById('keuangan-pos-btn-submit');
    if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const btn = document.getElementById('keuangan-pos-btn-submit');
        if (btn) {
            btn.classList.add('ring-4', 'ring-emerald-400');
            setTimeout(() => btn.classList.remove('ring-4', 'ring-emerald-400'), 1500);
        }
    }
}
window.scrollKeuanganPOSToCheckout = scrollKeuanganPOSToCheckout;

function setKeuanganPOSMetode(metode) {
    ASNKeuangan.pos.metodeBayar = metode;
    const btns = ['TUNAI', 'TRANSFER_BCA', 'TRANSFER_BRI', 'QRIS'];
    btns.forEach(m => {
        const el = document.getElementById(`keuangan-metode-btn-${m}`);
        if (el) {
            if (m === metode) {
                el.className = "px-2.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white shadow-sm border border-emerald-600";
            } else {
                el.className = "px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-[#1c2836] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#253447]";
            }
        }
    });

    const wrapDiterima = document.getElementById('keuangan-pos-wrap-diterima');
    if (wrapDiterima) {
        if (metode === 'TUNAI') wrapDiterima.classList.remove('hidden');
        else wrapDiterima.classList.add('hidden');
    }

    calcKeuanganPOSTotal();
}
window.setKeuanganPOSMetode = setKeuanganPOSMetode;

function setKeuanganPOSQuickNominal(val) {
    const inputDiterima = document.getElementById('keuangan-pos-input-diterima');
    if (inputDiterima) {
        inputDiterima.value = val;
        calcKeuanganPOSTotal();
    }
}
window.setKeuanganPOSQuickNominal = setKeuanganPOSQuickNominal;

function setKeuanganPOSUangPas() {
    let subtotal = 0;
    Object.values(ASNKeuangan.pos.selectedTagihanMap).forEach(v => {
        subtotal += Number(v) || 0;
    });
    setKeuanganPOSQuickNominal(subtotal);
}
window.setKeuanganPOSUangPas = setKeuanganPOSUangPas;

/**
 * Eksekusi Pembayaran Kasir
 */
async function submitKeuanganPOSPayment() {
    const st = ASNKeuangan.pos.selectedStudent;
    if (!st) {
        alert("Pilih santri terlebih dahulu.");
        return;
    }

    const items = [];
    Object.entries(ASNKeuangan.pos.selectedTagihanMap).forEach(([tId, bayarNom]) => {
        if (bayarNom > 0) {
            items.push({ tagihanId: tId, bayarNominal: bayarNom });
        }
    });

    if (items.length === 0) {
        alert("Pilih minimal 1 pos tagihan yang ingin dibayar.");
        return;
    }

    const btnSubmit = document.getElementById('keuangan-pos-btn-submit');
    const noteInput = document.getElementById('keuangan-pos-catatan');
    const catatan = noteInput ? noteInput.value.trim() : "";

    try {
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Memproses Pembayaran...`;
        }

        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : null) || "";
        const payload = {
            token: token,
            studentId: st.studentId,
            studentName: st.name,
            nis: st.nis || "",
            metodeBayar: ASNKeuangan.pos.metodeBayar,
            catatan: catatan,
            items: items
        };

        const res = await apiPost("bayarTagihan", payload);

        if (res && res.success && res.kuitansi) {
            ASNKeuangan.lastKuitansi = res.kuitansi;

            // Reset form POS
            resetKeuanganPOS();

            // Refresh data di background
            loadAdminKeuanganData(true);

            // Buka Modal Kuitansi
            openKuitansiModal(res.kuitansi);

            if (typeof showToast === 'function') {
                showToast("✅ Pembayaran berhasil dicatat. Kuitansi diterbitkan.");
            }
        } else {
            alert("Gagal memproses pembayaran: " + ((res && res.message) || "Terjadi kesalahan sistem."));
        }
    } catch (e) {
        alert("Terjadi kendala: " + e.message);
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = `<i class="fa-solid fa-receipt mr-1.5"></i> Proses Pembayaran & Terbitkan Kuitansi`;
        }
    }
}
window.submitKeuanganPOSPayment = submitKeuanganPOSPayment;

function resetKeuanganPOS() {
    ASNKeuangan.pos.selectedStudent = null;
    ASNKeuangan.pos.selectedTagihanIds.clear();
    ASNKeuangan.pos.selectedTagihanMap = {};
    ASNKeuangan.pos.metodeBayar = 'TUNAI';

    const cardEl = document.getElementById('keuangan-pos-student-card');
    const emptyEl = document.getElementById('keuangan-pos-empty-prompt');
    const searchInput = document.getElementById('keuangan-pos-search-input');
    const inputDiterima = document.getElementById('keuangan-pos-input-diterima');
    const noteInput = document.getElementById('keuangan-pos-catatan');

    if (cardEl) cardEl.classList.add('hidden');
    if (emptyEl) emptyEl.classList.remove('hidden');
    if (searchInput) searchInput.value = '';
    if (inputDiterima) inputDiterima.value = '';
    if (noteInput) noteInput.value = '';

    const container = document.getElementById('keuangan-pos-tagihan-container');
    if (container) container.innerHTML = `<p class="text-xs text-slate-400 text-center py-6">Pilih santri terlebih dahulu untuk menampilkan tagihan.</p>`;

    const mobileBar = document.getElementById('keuangan-pos-mobile-bar');
    if (mobileBar) mobileBar.classList.add('hidden');

    calcKeuanganPOSTotal();
}
window.resetKeuanganPOS = resetKeuanganPOS;

/**
 * Helper mencari nomor telepon/WhatsApp wali santri secara otomatis
 */
function getStudentPhoneNumber(studentId, nis) {
    if (!studentId && !nis) return "";
    let phone = "";

    // 1. Dari data students di ASNKeuangan
    const list = ASNKeuangan.data.students || [];
    const st = list.find(s => (studentId && (s.studentId === studentId || s.id === studentId)) || (nis && s.nis === nis));
    if (st) {
        phone = st.parentPhone || st.phone || st.no_hp || st.telepon || st.whatsapp || st.wali_phone || st.kontak || "";
    }

    // 2. Dari adminStudentsData jika belum ketemu
    if (!phone && typeof window !== 'undefined' && Array.isArray(window.adminStudentsData)) {
        const ast = window.adminStudentsData.find(s => (studentId && (s.studentId === studentId || s.id === studentId)) || (nis && s.nis === nis));
        if (ast) {
            phone = ast.parentPhone || ast.phone || ast.no_hp || ast.telepon || ast.whatsapp || ast.wali_phone || ast.kontak || ast.no_wali || "";
        }
    }

    return String(phone || "").trim();
}
window.getStudentPhoneNumber = getStudentPhoneNumber;

// ====================================================================
// SUB-MODUL 2: KUITANSI DIGITAL & WHATSAPP GATEWAY
// ====================================================================

/**
 * Format nama resmi lembaga untuk Kuitansi, Bukti Bayar & Laporan Resmi
 * Mencegah redundansi kata seperti "PPTQ Pondok Pesantren Roudlotul Mubarokah"
 * Menjadi standar "PPTQ Roudlotul Mubarokah"
 */
function getNamaLembagaKuitansi() {
    const profilState = window.APP_PROFIL_STATE || {};
    let raw = String(profilState.nama_pesantren || 'Roudlotul Mubarokah').trim();
    raw = raw.replace(/^PPTQ\s*/i, '')
             .replace(/^(Pondok\s+Pesantren|Pesantren)\s*/i, '')
             .trim();
    if (!raw) raw = 'Roudlotul Mubarokah';
    return 'PPTQ ' + raw;
}
window.getNamaLembagaKuitansi = getNamaLembagaKuitansi;

function openKuitansiModal(kuitansi) {
    ASNKeuangan.lastKuitansi = kuitansi;
    const modal = document.getElementById('modal-keuangan-kuitansi');
    if (!modal) return;

    const noEl = document.getElementById('kuitansi-no');
    const tglEl = document.getElementById('kuitansi-tanggal');
    const nameEl = document.getElementById('kuitansi-nama-santri');
    const nisEl = document.getElementById('kuitansi-nis');
    const totalEl = document.getElementById('kuitansi-total-bayar');
    const metodeEl = document.getElementById('kuitansi-metode');
    const kasirEl = document.getElementById('kuitansi-kasir');
    const rincianContainer = document.getElementById('kuitansi-rincian-list');
    const voidBanner = document.getElementById('kuitansi-void-banner');
    const statusTextEl = document.getElementById('kuitansi-status-text');
    const btnVoid = document.getElementById('btn-kuitansi-void');
    const btnWA = document.getElementById('btn-kuitansi-whatsapp');
    const kopNamaEl = document.getElementById('kuitansi-kop-nama');
    const kopAlamatEl = document.getElementById('kuitansi-kop-alamat');

    // Sinkronkan Nama & Alamat Pesantren Resmi pada Kop Kuitansi
    const namaPesantren = getNamaLembagaKuitansi();
    let alamatPesantren = (window.APP_PROFIL_STATE && window.APP_PROFIL_STATE.alamat_pesantren) || '';
    if (!alamatPesantren) {
        try {
            alamatPesantren = localStorage.getItem('mubarokah_alamat_pesantren') || '';
        } catch(e) {}
    }
    if (!alamatPesantren) {
        alamatPesantren = "Rimbukidul, RT 01 / RW 07, Rejosari, Karangawen, Demak, Jawa Tengah";
    }
    const subTitleEl = document.getElementById('kuitansi-header-subtitle');
    if (subTitleEl) subTitleEl.innerText = namaPesantren;
    if (kopNamaEl) kopNamaEl.innerText = namaPesantren;
    if (kopAlamatEl) kopAlamatEl.innerText = alamatPesantren;

    const isVoid = String(kuitansi.status || '').toUpperCase() === 'VOID' || 
                   String(kuitansi.catatan || '').includes('[VOID/BATAL]');

    if (voidBanner) {
        if (isVoid) voidBanner.classList.remove('hidden');
        else voidBanner.classList.add('hidden');
    }

    if (statusTextEl) {
        if (isVoid) {
            statusTextEl.innerText = "DIBATALKAN (VOID)";
            statusTextEl.className = "text-rose-600 font-bold uppercase";
        } else {
            statusTextEl.innerText = "LUNAS / DITERIMA";
            statusTextEl.className = "text-emerald-600 font-bold";
        }
    }

    // Role check untuk tombol Void
    const roleCheck = checkKeuanganRoleAccess();
    if (btnVoid) {
        if (isVoid || !roleCheck.isAllowed) {
            btnVoid.classList.add('hidden');
        } else {
            btnVoid.classList.remove('hidden');
        }
    }

    if (btnWA) {
        if (isVoid) {
            btnWA.classList.add('opacity-50', 'pointer-events-none');
            btnWA.title = "Tidak dapat mengirim kuitansi yang telah dibatalkan (VOID)";
        } else {
            btnWA.classList.remove('opacity-50', 'pointer-events-none');
            btnWA.title = "Kirim kuitansi ke WhatsApp Wali Santri";
        }
    }

    if (noEl) noEl.innerText = kuitansi.noKuitansi || '-';
    if (tglEl) tglEl.innerText = formatTglIndo(kuitansi.tanggalBayar);
    if (nameEl) nameEl.innerText = kuitansi.studentName || '-';
    if (nisEl) nisEl.innerText = kuitansi.nis || '-';
    
    if (totalEl) {
        if (isVoid) {
            totalEl.innerHTML = `<span class="line-through opacity-60 text-slate-400 mr-2">${formatRupiah(kuitansi.nominalTotal || 0)}</span> <span class="text-rose-600 font-black text-sm">BATAL</span>`;
        } else {
            totalEl.innerText = formatRupiah(kuitansi.nominalTotal || 0);
        }
    }

    if (metodeEl) metodeEl.innerText = kuitansi.metodeBayar || 'TUNAI';
    if (kasirEl) kasirEl.innerText = kuitansi.namaKasir || 'Bendahara Pesantren';

    if (rincianContainer) {
        let html = '';
        const items = kuitansi.rincianItems || [];
        items.forEach((item, idx) => {
            html += `
                <tr class="border-b border-slate-100 dark:border-[#253447] text-xs">
                    <td class="py-2 text-slate-400 text-center">${idx + 1}</td>
                    <td class="py-2 font-semibold text-slate-800 dark:text-slate-100">
                        ${escapeHtml(item.namaPos)}
                        <span class="text-[10px] text-slate-400 block">${escapeHtml(item.periode || '')}</span>
                    </td>
                    <td class="py-2 text-right font-bold ${isVoid ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-100'}">${formatRupiah(item.nominalBayar)}</td>
                </tr>
            `;
        });
        rincianContainer.innerHTML = html;
    }

    modal.classList.remove('hidden');
}
window.openKuitansiModal = openKuitansiModal;

function closeKuitansiModal() {
    const modal = document.getElementById('modal-keuangan-kuitansi');
    if (modal) modal.classList.add('hidden');
}
window.closeKuitansiModal = closeKuitansiModal;

function printKuitansi() {
    window.print();
}
window.printKuitansi = printKuitansi;

function handleKuitansiModalVoid() {
    const k = ASNKeuangan.lastKuitansi;
    if (!k || !k.transaksiId) {
        alert("Data transaksi kuitansi tidak valid.");
        return;
    }
    promptVoidKeuanganTransaksi(k.transaksiId, k.noKuitansi, k.nominalTotal);
}
window.handleKuitansiModalVoid = handleKuitansiModalVoid;

function shareKuitansiWhatsApp(kuitansiParam) {
    const k = kuitansiParam || ASNKeuangan.lastKuitansi;
    if (!k) return;

    const isVoid = String(k.status || '').toUpperCase() === 'VOID' || String(k.catatan || '').includes('[VOID/BATAL]');
    if (isVoid) {
        alert("Peringatan: Transaksi ini sudah dibatalkan (VOID) dan tidak dapat dikirim ke wali santri.");
        return;
    }

    // Ambil nomor HP wali santri secara otomatis
    let defaultPhone = k.parentPhone || k.phone || k.telepon || k.noHp || k.whatsapp || k.waliPhone || "";
    if (!defaultPhone) {
        defaultPhone = getStudentPhoneNumber(k.studentId, k.nis);
    }

    // Format tampilan awal (08... jika ada)
    if (defaultPhone.startsWith('62')) {
        defaultPhone = '0' + defaultPhone.substring(2);
    }

    let phoneInput = prompt(
        `Kirim Kuitansi WhatsApp ke Wali Santri: ${k.studentName}\n` +
        `Nomor HP otomatis terisi jika terdaftar di biodata santri:`,
        defaultPhone
    );
    if (!phoneInput) return;

    let phone = phoneInput.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) {
        phone = '62' + phone.substring(1);
    } else if (phone.startsWith('8')) {
        phone = '62' + phone;
    }

    if (phone.length < 9) {
        alert("Nomor telepon tidak valid. Pastikan format nomor benar.");
        return;
    }

    let itemsText = '';
    const items = k.rincianItems || [];
    items.forEach(it => {
        itemsText += `• ${it.namaPos} (${it.periode || '-'}): ${formatRupiah(it.nominalBayar)}\n`;
    });

    const namaLembaga = getNamaLembagaKuitansi();

    const msg = `*BUKTI PEMBAYARAN RESMI*\n*${namaLembaga.toUpperCase()}*\n----------------------------------------\n` +
        `Assalamu'alaikum Wr. Wb.\n` +
        `Yth. Wali Santri dari ananda *${k.studentName}* (NIS: ${k.nis || '-'}),\n\n` +
        `Alhamdulillah, telah kami terima pembayaran administrasi:\n` +
        `📄 *No. Kuitansi* : ${k.noKuitansi}\n` +
        `📅 *Tanggal*      : ${formatTglIndo(k.tanggalBayar)}\n` +
        `💳 *Metode*       : ${k.metodeBayar}\n` +
        `👤 *Penerima*     : ${k.namaKasir || 'Bendahara Pesantren'}\n\n` +
        `*Rincian Pos Pembayaran:*\n` +
        itemsText +
        `----------------------------------------\n` +
        `*TOTAL DITERIMA : ${formatRupiah(k.nominalTotal)} (LUNAS)*\n\n` +
        `Semoga membawa berkah bagi ananda dan keluarga. Jazakumullahu khairan katsiran atas amanah dan kerjasamanya.\n\n` +
        `Wassalamu'alaikum Wr. Wb.\n` +
        `_Bendahara ${namaLembaga}_`;

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
}
window.shareKuitansiWhatsApp = shareKuitansiWhatsApp;

// ====================================================================
// SUB-MODUL 3: DAFTAR TAGIHAN & GENERATE BULANAN
// ====================================================================

function normalizeYearMonthTagihan(val) {
    if (!val) return "";
    if (val instanceof Date) {
        const y = val.getFullYear();
        const m = String(val.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
    }
    const s = String(val).trim();
    const match = s.match(/^(\d{4})[-\/](\d{1,2})/);
    if (match) {
        return `${match[1]}-${String(match[2]).padStart(2, '0')}`;
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
    }
    return s;
}

function filterKeuanganTagihan() {
    const searchInput = document.getElementById('keuangan-tagihan-search');
    const filterStatus = document.getElementById('keuangan-tagihan-filter-status');
    const filterProgram = document.getElementById('keuangan-tagihan-filter-program');
    const filterPeriode = document.getElementById('keuangan-tagihan-filter-periode');

    const q = searchInput ? searchInput.value.trim().toLowerCase() : "";
    const stStatus = (filterStatus && filterStatus.value) ? filterStatus.value.trim() : "ALL";
    const stProgram = (filterProgram && filterProgram.value) ? filterProgram.value.trim() : "ALL";
    const stPeriode = (filterPeriode && filterPeriode.value && filterPeriode.value.trim()) ? filterPeriode.value.trim() : "ALL";

    const all = ASNKeuangan.data.tagihanList || [];

    ASNKeuangan.filteredTagihan = all.filter(t => {
        // 1. Pencarian Teks Bebas (Nama, Pos, Periode, Program)
        if (q) {
            const mName = (t.studentName || "").toLowerCase().includes(q);
            const mPos = (t.namaPos || "").toLowerCase().includes(q);
            const mPer = (t.periode || "").toLowerCase().includes(q);
            const mProg = (t.studentProgram || "").toLowerCase().includes(q);
            const mId = (t.studentId || "").toLowerCase().includes(q);
            if (!mName && !mPos && !mPer && !mProg && !mId) return false;
        }

        // 2. Filter Status Pembayaran
        if (stStatus && stStatus !== "ALL") {
            const curStatus = String(t.status || "").trim().toUpperCase();
            if (stStatus === "BELUM_BAYAR") {
                if (curStatus !== "BELUM_BAYAR" && curStatus !== "UNPAID") return false;
            } else if (stStatus === "SEBAGIAN") {
                if (curStatus !== "SEBAGIAN" && curStatus !== "PARTIAL") return false;
            } else if (stStatus === "LUNAS") {
                if (curStatus !== "LUNAS" && curStatus !== "PAID") return false;
            } else {
                if (curStatus !== stStatus) return false;
            }
        }

        // 3. Filter Program Santri (dengan Normalisasi Nama Program)
        if (stProgram && stProgram !== "ALL") {
            const curProg = String(t.studentProgram || "").toLowerCase().trim();
            const targetProg = stProgram.toLowerCase().trim();
            if (curProg && curProg !== targetProg) {
                const cleanCur = curProg.replace(/^pesantren\s+/i, '').trim();
                const cleanTarget = targetProg.replace(/^pesantren\s+/i, '').trim();
                if (cleanCur !== cleanTarget && !curProg.includes(targetProg) && !targetProg.includes(curProg)) {
                    return false;
                }
            }
        }

        // 4. Filter Periode Bulan (dengan Normalisasi Tanggal YYYY-MM)
        if (stPeriode && stPeriode !== "ALL") {
            const curPeriode = normalizeYearMonthTagihan(t.periode);
            const targetPeriode = normalizeYearMonthTagihan(stPeriode);
            if (curPeriode && targetPeriode && curPeriode !== targetPeriode) return false;
        }

        return true;
    });

    // Otomatis Tampilkan Semua: Jika hasil filter kosong padahal data tagihan ada di database,
    // dan user tidak sedang mengetik pencarian khusus, otomatis lepas filter periode agar data langsung tampil
    if (ASNKeuangan.filteredTagihan.length === 0 && all.length > 0 && !q && stStatus === "ALL" && stProgram === "ALL") {
        if (filterPeriode && filterPeriode.value) {
            filterPeriode.value = "";
            ASNKeuangan.filteredTagihan = all;
        }
    }

    renderKeuanganTagihanTable();
}
window.filterKeuanganTagihan = filterKeuanganTagihan;

/**
 * Reset Filter Tagihan ke Posisi Default (Semua)
 */
function resetKeuanganTagihanFilter() {
    const searchInput = document.getElementById('keuangan-tagihan-search');
    const filterStatus = document.getElementById('keuangan-tagihan-filter-status');
    const filterProgram = document.getElementById('keuangan-tagihan-filter-program');
    const filterPeriode = document.getElementById('keuangan-tagihan-filter-periode');

    if (searchInput) searchInput.value = "";
    if (filterStatus) filterStatus.value = "ALL";
    if (filterProgram) filterProgram.value = "ALL";
    if (filterPeriode) filterPeriode.value = "";

    filterKeuanganTagihan();
}
window.resetKeuanganTagihanFilter = resetKeuanganTagihanFilter;

function renderKeuanganTagihanTable() {
    const tbody = document.getElementById('keuangan-tagihan-table-body');
    const mobileList = document.getElementById('keuangan-tagihan-mobile-list');
    const emptyEl = document.getElementById('keuangan-tagihan-empty');
    const countEl = document.getElementById('keuangan-tagihan-count');

    const list = ASNKeuangan.filteredTagihan || [];

    if (countEl) countEl.innerText = `${list.length} Tagihan`;

    if (list.length === 0) {
        if (tbody) tbody.innerHTML = '';
        if (mobileList) mobileList.innerHTML = '';
        if (emptyEl) emptyEl.classList.remove('hidden');
        return;
    }

    if (emptyEl) emptyEl.classList.add('hidden');

    // Desktop
    let htmlDesktop = '';
    let htmlMobile = '';

    list.forEach((t, idx) => {
        const isLunas = t.status === "LUNAS";
        const isCicil = t.status === "SEBAGIAN";

        const badge = isLunas
            ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300"><i class="fa-solid fa-circle-check"></i> Lunas</span>`
            : isCicil
            ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300"><i class="fa-solid fa-clock-rotate-left"></i> Cicilan</span>`
            : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300"><i class="fa-solid fa-circle-exclamation"></i> Belum Lunas</span>`;

        const progBadge = t.studentProgram ? `<span class="inline-block px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50"><i class="fa-solid fa-graduation-cap text-[8px] mr-1"></i>${escapeHtml(t.studentProgram)}</span>` : '';

        htmlDesktop += `
            <tr class="hover:bg-slate-50/80 dark:hover:bg-[#1a2636]/60 transition border-b border-slate-100 dark:border-[#202f42] text-xs">
                <td class="p-3 text-center text-slate-400 font-medium">${idx + 1}</td>
                <td class="p-3">
                    <div class="font-bold text-slate-800 dark:text-slate-100">${escapeHtml(t.studentName)}</div>
                    <div class="flex items-center gap-1.5 mt-0.5">
                        ${progBadge}
                        <span class="text-[10px] text-slate-400">ID: ${escapeHtml(t.studentId)}</span>
                    </div>
                </td>
                <td class="p-3">
                    <div class="font-semibold text-slate-800 dark:text-slate-200">${escapeHtml(t.namaPos)}</div>
                    <div class="text-[10px] text-slate-400 font-medium">Periode: ${escapeHtml(t.periode)}</div>
                </td>
                <td class="p-3 font-semibold text-slate-800 dark:text-slate-200">${formatRupiah(t.nominalTagihan)}</td>
                <td class="p-3 font-bold text-emerald-600 dark:text-emerald-400">${formatRupiah(t.nominalTerbayar || 0)}</td>
                <td class="p-3 font-black text-rose-600 dark:text-rose-400">${formatRupiah(t.sisaTagihan)}</td>
                <td class="p-3 text-center">${badge}</td>
                <td class="p-3 text-right">
                    ${!isLunas ? `
                        <button type="button" onclick="selectKeuanganPOSStudent('${escapeHtml(t.studentId)}'); switchKeuanganTab('pos');"
                            class="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 dark:text-emerald-300 rounded-lg text-xs font-bold transition border border-emerald-200 dark:border-emerald-800">
                            <i class="fa-solid fa-cash-register mr-1"></i> Bayar di POS
                        </button>
                    ` : `
                        <span class="text-[10px] text-slate-400 font-semibold">Tuntas</span>
                    `}
                </td>
            </tr>
        `;

        htmlMobile += `
            <div class="p-3.5 bg-white dark:bg-[#15202d] rounded-2xl border border-slate-100 dark:border-[#253447] shadow-sm space-y-2">
                <div class="flex items-start justify-between gap-2">
                    <div>
                        <div class="text-xs font-bold text-slate-800 dark:text-slate-100">${escapeHtml(t.studentName)}</div>
                        <div class="flex items-center gap-1.5 mt-0.5 mb-1">${progBadge}</div>
                        <div class="text-[10px] text-slate-400">${escapeHtml(t.namaPos)} • Periode: ${escapeHtml(t.periode)}</div>
                    </div>
                    ${badge}
                </div>
                <div class="grid grid-cols-3 gap-1 pt-1 border-t border-slate-100 dark:border-[#253447] text-center">
                    <div>
                        <span class="text-[9px] text-slate-400 block">Kewajiban</span>
                        <span class="text-xs font-bold text-slate-700 dark:text-slate-200">${formatRupiah(t.nominalTagihan)}</span>
                    </div>
                    <div>
                        <span class="text-[9px] text-slate-400 block">Masuk</span>
                        <span class="text-xs font-bold text-emerald-600">${formatRupiah(t.nominalTerbayar || 0)}</span>
                    </div>
                    <div>
                        <span class="text-[9px] text-slate-400 block">Sisa</span>
                        <span class="text-xs font-black text-rose-600">${formatRupiah(t.sisaTagihan)}</span>
                    </div>
                </div>
                ${!isLunas ? `
                    <div class="pt-1">
                        <button type="button" onclick="selectKeuanganPOSStudent('${escapeHtml(t.studentId)}'); switchKeuanganTab('pos');"
                            class="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm">
                            <i class="fa-solid fa-cash-register text-xs"></i> Buka di Kasir POS
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    });

    if (tbody) tbody.innerHTML = htmlDesktop;
    if (mobileList) mobileList.innerHTML = htmlMobile;
}
window.renderKeuanganTagihanTable = renderKeuanganTagihanTable;

// Generate Tagihan Bulanan Massal Modal
function openGenerateBulkTagihanModal() {
    const modal = document.getElementById('modal-keuangan-generate-tagihan');
    if (!modal) return;

    // Default bulan berikutnya
    const now = new Date();
    const yr = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, "0");
    const inputPeriode = document.getElementById('generate-tagihan-periode');
    const inputDueDate = document.getElementById('generate-tagihan-due-date');

    if (inputPeriode) inputPeriode.value = `${yr}-${mo}`;
    if (inputDueDate) inputDueDate.value = `${yr}-${mo}-10`;

    modal.classList.remove('hidden');
}
window.openGenerateBulkTagihanModal = openGenerateBulkTagihanModal;

function closeGenerateBulkTagihanModal() {
    const modal = document.getElementById('modal-keuangan-generate-tagihan');
    if (modal) modal.classList.add('hidden');
}
window.closeGenerateBulkTagihanModal = closeGenerateBulkTagihanModal;

async function submitGenerateBulkTagihan() {
    const inputPeriode = document.getElementById('generate-tagihan-periode');
    const inputDueDate = document.getElementById('generate-tagihan-due-date');
    const btn = document.getElementById('btn-submit-generate-tagihan');

    const periode = inputPeriode ? inputPeriode.value.trim() : "";
    const dueDate = inputDueDate ? inputDueDate.value.trim() : "";

    if (!periode) {
        alert("Pilih periode tagihan (contoh: 2026-10).");
        return;
    }

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Menerbitkan Tagihan...`;
        }

        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : null) || "";
        const res = await apiPost("generateBulkMonthlyBills", {
            token: token,
            periode: periode,
            dueDate: dueDate
        });

        if (res && res.success) {
            closeGenerateBulkTagihanModal();
            loadAdminKeuanganData(true);
            if (typeof showToast === 'function') {
                showToast(`✅ ${res.message || "Tagihan berhasil diterbitkan."}`);
            } else {
                alert(res.message);
            }
        } else {
            alert("Gagal menerbitkan tagihan: " + ((res && res.message) || "Terjadi kesalahan"));
        }
    } catch (e) {
        alert("Error: " + e.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-bolt mr-1.5"></i> Terbitkan Tagihan Massal`;
        }
    }
}
window.submitGenerateBulkTagihan = submitGenerateBulkTagihan;

// ====================================================================
// SUB-MODUL 4: RIWAYAT TRANSAKSI / BUKU KAS
// ====================================================================

/**
 * Prompt dan eksekusi Void / Pembatalan Transaksi Kasir
 */
async function promptVoidKeuanganTransaksi(transaksiId, noKuitansi, nominalTotal) {
    const roleCheck = checkKeuanganRoleAccess();
    if (!roleCheck.isAllowed) {
        alert("Akses ditolak: Hanya Super Admin, Admin, atau Bendahara yang diizinkan membatalkan transaksi.");
        return;
    }

    const alasan = prompt(
        `⚠️ KONFIRMASI PEMBATALAN TRANSAKSI (VOID KASIR)\n\n` +
        `• No. Kuitansi : ${noKuitansi || '-'}\n` +
        `• Nominal      : ${formatRupiah(nominalTotal)}\n\n` +
        `PERHATIAN:\n` +
        `1. Sisa tagihan santri akan otomatis dipulihkan/dikembalikan seperti sebelum bayar.\n` +
        `2. Total kas masuk di laporan akan dikurangi.\n` +
        `3. Transaksi ini akan ditandai permanen sebagai VOID di audit log.\n\n` +
        `Silakan ketik alasan pembatalan (wajib, min. 3 karakter):`
    );

    if (alasan === null) return; // User batalkan prompt
    const trimmedAlasan = alasan.trim();
    if (!trimmedAlasan || trimmedAlasan.length < 3) {
        alert("Pembatalan gagal: Alasan pembatalan wajib diisi minimal 3 karakter untuk audit trail pembukuan.");
        return;
    }

    if (!confirm(`Apakah Anda benar-benar yakin ingin membatalkan (VOID) kuitansi ${noKuitansi || transaksiId}? Tindakan ini bersifat permanen!`)) {
        return;
    }

    try {
        if (typeof showToast === 'function') showToast("⏳ Memproses pembatalan transaksi (VOID)...");
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : null) || "";
        const res = await apiPost("keuangan.batalTransaksi", {
            token: token,
            transaksiId: transaksiId,
            alasan: trimmedAlasan
        });

        if (res && res.success) {
            closeKuitansiModal();
            if (typeof showToast === 'function') {
                showToast(`✅ ${res.message || "Transaksi berhasil dibatalkan (VOID)."}`);
            } else {
                alert(res.message || "Transaksi berhasil dibatalkan (VOID).");
            }
            // Muat ulang data dashboard kasir & tagihan
            await loadAdminKeuanganData(true);
        } else {
            alert("Gagal membatalkan transaksi: " + ((res && res.message) || "Terjadi kesalahan sistem."));
        }
    } catch (e) {
        alert("Error pembatalan transaksi: " + e.message);
    }
}
window.promptVoidKeuanganTransaksi = promptVoidKeuanganTransaksi;

function renderKeuanganTransaksiTable() {
    const tbody = document.getElementById('keuangan-transaksi-table-body');
    const mobileList = document.getElementById('keuangan-transaksi-mobile-list');
    const list = ASNKeuangan.data.recentTransactions || [];

    if (!tbody && !mobileList) return;

    if (list.length === 0) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="py-6 text-center text-xs text-slate-400">Belum ada riwayat transaksi pembayaran.</td></tr>`;
        if (mobileList) mobileList.innerHTML = `<div class="p-6 text-center bg-white dark:bg-[#15202d] rounded-2xl border border-slate-100 dark:border-[#253447] text-xs text-slate-400"><i class="fa-solid fa-receipt text-2xl text-slate-300 dark:text-slate-600 block mb-1.5"></i>Belum ada riwayat transaksi pembayaran kasir.</div>`;
        return;
    }

    let htmlDesktop = '';
    let htmlMobile = '';

    list.forEach((trx, idx) => {
        const isVoid = String(trx.status || '').toUpperCase() === 'VOID' || String(trx.catatan || '').includes('[VOID/BATAL]');
        const statusBadge = isVoid
            ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300" title="${escapeHtml(trx.catatan || 'VOID')}"><i class="fa-solid fa-ban text-[9px]"></i> VOID</span>`
            : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300"><i class="fa-solid fa-circle-check text-[9px]"></i> Berhasil</span>`;

        const nomDisplay = isVoid
            ? `<span class="line-through text-slate-400 font-semibold">${formatRupiah(trx.nominalTotal)}</span>`
            : `<span class="font-black text-slate-800 dark:text-slate-100">${formatRupiah(trx.nominalTotal)}</span>`;

        const jsonStr = escapeHtml(JSON.stringify(trx));

        htmlDesktop += `
            <tr class="hover:bg-slate-50/80 dark:hover:bg-[#1a2636]/60 transition border-b border-slate-100 dark:border-[#202f42] text-xs ${isVoid ? 'bg-rose-50/20 dark:bg-rose-950/10' : ''}">
                <td class="p-3 text-center text-slate-400 font-medium">${idx + 1}</td>
                <td class="p-3 font-mono font-bold ${isVoid ? 'text-slate-400 line-through' : 'text-emerald-700 dark:text-emerald-400'}">${escapeHtml(trx.noKuitansi)}</td>
                <td class="p-3 text-slate-500">${formatTglIndo(trx.tanggalBayar)}</td>
                <td class="p-3 font-bold text-slate-800 dark:text-slate-100">${escapeHtml(trx.studentName)}</td>
                <td class="p-3">${nomDisplay}</td>
                <td class="p-3">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-[#1c2836] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#253447]">
                        ${escapeHtml(trx.metodeBayar)}
                    </span>
                </td>
                <td class="p-3 text-center">${statusBadge}</td>
                <td class="p-3 text-right space-x-1">
                    <button type="button" onclick="openKuitansiModal(${jsonStr})"
                        class="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#1c2836] transition" title="Lihat Kuitansi">
                        <i class="fa-solid fa-receipt text-xs text-emerald-600"></i>
                    </button>
                    ${!isVoid ? `
                        <button type="button" onclick="promptVoidKeuanganTransaksi('${escapeHtml(trx.transaksiId)}', '${escapeHtml(trx.noKuitansi)}', ${Number(trx.nominalTotal) || 0})"
                            class="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition" title="Batalkan Transaksi (VOID)">
                            <i class="fa-solid fa-ban text-xs"></i>
                        </button>
                    ` : ''}
                </td>
            </tr>
        `;

        htmlMobile += `
            <div class="p-3.5 bg-white dark:bg-[#15202d] rounded-2xl border border-slate-100 dark:border-[#253447] shadow-xs space-y-2.5 ${isVoid ? 'border-rose-200/80 bg-rose-50/10' : ''}">
                <div class="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-[#202f42] pb-2">
                    <div class="flex items-center space-x-2">
                        <div class="w-7 h-7 rounded-lg ${isVoid ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600' : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600'} flex items-center justify-center text-xs">
                            <i class="fa-solid ${isVoid ? 'fa-ban' : 'fa-receipt'}"></i>
                        </div>
                        <span class="font-mono text-xs font-bold ${isVoid ? 'text-slate-400 line-through' : 'text-emerald-700 dark:text-emerald-400'}">${escapeHtml(trx.noKuitansi)}</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        ${statusBadge}
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-[#1c2836] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#253447]">
                            ${escapeHtml(trx.metodeBayar)}
                        </span>
                    </div>
                </div>
                <div class="flex items-start justify-between gap-2">
                    <div>
                        <div class="text-xs font-bold text-slate-800 dark:text-slate-100">${escapeHtml(trx.studentName)}</div>
                        <div class="text-[10px] text-slate-400 mt-0.5">${formatTglIndo(trx.tanggalBayar)}</div>
                    </div>
                    <div class="text-right">
                        <div class="text-sm font-black ${isVoid ? 'text-slate-400 line-through' : 'text-emerald-600 dark:text-emerald-400'}">${formatRupiah(trx.nominalTotal)}</div>
                        <span class="text-[9px] text-slate-400">${isVoid ? 'Dibatalkan (VOID)' : 'Total Diterima'}</span>
                    </div>
                </div>
                <div class="pt-1 flex items-center gap-2">
                    <button type="button" onclick="openKuitansiModal(${jsonStr})"
                        class="flex-1 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 dark:text-emerald-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-emerald-200 dark:border-emerald-800">
                        <i class="fa-solid fa-receipt text-xs"></i>
                        <span>Buka Kuitansi</span>
                    </button>
                    ${!isVoid ? `
                        <button type="button" onclick="shareKuitansiWhatsApp(${jsonStr})"
                            class="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1" title="Kirim ke WhatsApp">
                            <i class="fa-brands fa-whatsapp text-sm"></i>
                        </button>
                        <button type="button" onclick="promptVoidKeuanganTransaksi('${escapeHtml(trx.transaksiId)}', '${escapeHtml(trx.noKuitansi)}', ${Number(trx.nominalTotal) || 0})"
                            class="py-1.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 border border-rose-200 dark:border-rose-900/40" title="Batalkan Transaksi (VOID)">
                            <i class="fa-solid fa-ban text-xs"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    });

    if (tbody) tbody.innerHTML = htmlDesktop;
    if (mobileList) mobileList.innerHTML = htmlMobile;
}
window.renderKeuanganTransaksiTable = renderKeuanganTransaksiTable;

// ====================================================================
// PROGRAM PESANTREN SYNC (SHEET "Programs" KOLOM B: name)
// ====================================================================

function getKeuanganProgramsList() {
    const list = new Set();

    // 1. Dari respons backend getKeuanganDashboard (Sheet Programs resmi)
    if (Array.isArray(ASNKeuangan.data.programs)) {
        ASNKeuangan.data.programs.forEach(p => {
            const name = typeof p === 'string' ? p : (p && (p.name || p.title));
            if (name && name.trim()) list.add(name.trim());
        });
    }

    // 2. Dari adminProgramData (jika sudah di-load di admin.js)
    if (typeof adminProgramData !== 'undefined' && Array.isArray(adminProgramData)) {
        adminProgramData.forEach(p => {
            const name = (p && (p.name || p.title)) ? String(p.name || p.title).trim() : "";
            if (name) list.add(name);
        });
    }

    // 3. Dari localStorage mubarokah_programs_cache_v3
    try {
        const cachedRaw = localStorage.getItem('mubarokah_programs_cache_v3') || localStorage.getItem('mubarokah_programs_cache_v2');
        if (cachedRaw) {
            const cached = JSON.parse(cachedRaw);
            if (Array.isArray(cached)) {
                cached.forEach(p => {
                    const name = (p && (p.name || p.title)) ? String(p.name || p.title).trim() : "";
                    if (name) list.add(name);
                });
            }
        }
    } catch (e) {}

    // 4. Dari data santri yang sedang aktif di keuangan
    if (Array.isArray(ASNKeuangan.data.students)) {
        ASNKeuangan.data.students.forEach(s => {
            if (s && s.program && s.program.trim() && s.program !== "Tahfidz") {
                list.add(s.program.trim());
            }
        });
    }

    // 5. Fallback resmi jika belum ada cache
    if (list.size === 0) {
        list.add("Pesantren Tahfidz Dewasa");
        list.add("Pesantren Reguler Putra Putri");
        list.add("Pesantren Tahfidz Anak");
        list.add("MA Tahfidz");
    }

    return Array.from(list);
}
window.getKeuanganProgramsList = getKeuanganProgramsList;

function populateKeuanganTarifProgramDropdown(selectedProg = "") {
    const selectEl = document.getElementById('tarif-input-program');
    if (!selectEl) return;

    const progList = getKeuanganProgramsList();
    const selVal = selectedProg ? selectedProg.trim() : "SEMUA";

    let html = `<option value="SEMUA"${selVal === 'SEMUA' || selVal.toLowerCase() === 'semua santri' ? ' selected' : ''}>Semua Santri / Program</option>`;
    progList.forEach(prog => {
        const isSel = (selVal.toLowerCase() === prog.toLowerCase());
        html += `<option value="${escapeHtml(prog)}"${isSel ? ' selected' : ''}>Khusus ${escapeHtml(prog)}</option>`;
    });

    selectEl.innerHTML = html;
    selectEl.value = selVal;
}
window.populateKeuanganTarifProgramDropdown = populateKeuanganTarifProgramDropdown;

function populateKeuanganTagihanProgramFilter() {
    const filterEl = document.getElementById('keuangan-tagihan-filter-program');
    if (!filterEl) return;

    const curVal = filterEl.value || "ALL";
    const progList = getKeuanganProgramsList();

    let html = `<option value="ALL">Semua Program</option>`;
    progList.forEach(prog => {
        html += `<option value="${escapeHtml(prog)}"${curVal === prog ? ' selected' : ''}>${escapeHtml(prog)}</option>`;
    });

    filterEl.innerHTML = html;
    if (curVal !== "ALL") filterEl.value = curVal;
}
window.populateKeuanganTagihanProgramFilter = populateKeuanganTagihanProgramFilter;

// ====================================================================
// SUB-MODUL 5: MASTER POS & TARIF BIAYA
// ====================================================================

function renderKeuanganTarifTable() {
    const tbody = document.getElementById('keuangan-tarif-table-body');
    const mobileList = document.getElementById('keuangan-tarif-mobile-list');
    const list = ASNKeuangan.data.tarifList || [];

    if (!tbody && !mobileList) return;

    if (list.length === 0) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-xs text-slate-400">Belum ada master tarif biaya terdaftar.</td></tr>`;
        if (mobileList) mobileList.innerHTML = `<div class="p-6 text-center bg-white dark:bg-[#15202d] rounded-2xl border border-slate-100 dark:border-[#253447] text-xs text-slate-400"><i class="fa-solid fa-tags text-2xl text-slate-300 dark:text-slate-600 block mb-1.5"></i>Belum ada master tarif biaya terdaftar.</div>`;
        return;
    }

    let htmlDesktop = '';
    let htmlMobile = '';

    list.forEach((trf, idx) => {
        const isAllProg = (!trf.program || trf.program === 'SEMUA' || trf.program.toUpperCase() === 'SEMUA SANTRI' || trf.program.toUpperCase() === 'SEMUA PROGRAM');
        const progBadge = isAllProg
            ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-[#1c2836] dark:text-slate-300">Semua Program</span>`
            : `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 inline-flex items-center gap-1">
                <i class="fa-solid fa-graduation-cap text-[9px]"></i> ${escapeHtml(trf.program)}
               </span>`;

        htmlDesktop += `
            <tr class="hover:bg-slate-50/80 dark:hover:bg-[#1a2636]/60 transition border-b border-slate-100 dark:border-[#202f42] text-xs">
                <td class="p-3 text-center text-slate-400 font-medium">${idx + 1}</td>
                <td class="p-3 font-bold text-slate-800 dark:text-slate-100">${escapeHtml(trf.namaPos)}</td>
                <td class="p-3">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold ${trf.kategori === 'BULANAN' ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}">
                        ${escapeHtml(trf.kategori)}
                    </span>
                </td>
                <td class="p-3 font-black text-slate-800 dark:text-slate-100">${formatRupiah(trf.nominalDefault)}</td>
                <td class="p-3">${progBadge}</td>
                <td class="p-3 text-center">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold ${trf.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}">
                        ${trf.isActive ? 'Aktif' : 'Non-Aktif'}
                    </span>
                </td>
                <td class="p-3 text-right space-x-1">
                    <button type="button" onclick="openTarifModal('${escapeHtml(trf.tarifId)}')"
                        class="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#1c2836] transition" title="Edit Tarif">
                        <i class="fa-solid fa-pen-to-square text-xs text-blue-600"></i>
                    </button>
                    <button type="button" onclick="deleteMasterTarif('${escapeHtml(trf.tarifId)}')"
                        class="p-1.5 rounded-lg text-slate-600 hover:bg-rose-50 dark:text-slate-300 dark:hover:bg-rose-950/40 transition" title="Hapus Tarif">
                        <i class="fa-solid fa-trash-can text-xs text-rose-600"></i>
                    </button>
                </td>
            </tr>
        `;

        htmlMobile += `
            <div class="p-3.5 bg-white dark:bg-[#15202d] rounded-2xl border border-slate-100 dark:border-[#253447] shadow-xs space-y-2.5">
                <div class="flex items-start justify-between gap-2">
                    <div>
                        <div class="text-xs font-bold text-slate-800 dark:text-slate-100">${escapeHtml(trf.namaPos)}</div>
                        <div class="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span class="px-1.5 py-0.5 rounded text-[9px] font-bold ${trf.kategori === 'BULANAN' ? 'bg-teal-50 text-teal-700 border border-teal-200/50' : 'bg-amber-50 text-amber-700 border border-amber-200/50'}">
                                ${escapeHtml(trf.kategori)}
                            </span>
                            ${progBadge}
                        </div>
                    </div>
                    <span class="px-2 py-0.5 rounded text-[9px] font-bold shrink-0 ${trf.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' : 'bg-slate-100 text-slate-400'}">
                        ${trf.isActive ? 'Aktif' : 'Non-Aktif'}
                    </span>
                </div>
                <div class="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-[#202f42]">
                    <div>
                        <span class="text-[9px] text-slate-400 block">Nominal Standar</span>
                        <div class="text-sm font-black text-slate-800 dark:text-slate-100">${formatRupiah(trf.nominalDefault)}</div>
                    </div>
                    <div class="flex items-center space-x-1.5">
                        <button type="button" onclick="openTarifModal('${escapeHtml(trf.tarifId)}')"
                            class="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 rounded-xl text-xs font-bold transition flex items-center gap-1">
                            <i class="fa-solid fa-pen-to-square text-[10px]"></i> Edit
                        </button>
                        <button type="button" onclick="deleteMasterTarif('${escapeHtml(trf.tarifId)}')"
                            class="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 rounded-xl text-xs font-bold transition" title="Hapus">
                            <i class="fa-solid fa-trash-can text-xs"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });

    if (tbody) tbody.innerHTML = htmlDesktop;
    if (mobileList) mobileList.innerHTML = htmlMobile;
}
window.renderKeuanganTarifTable = renderKeuanganTarifTable;

function openTarifModal(tarifId = "") {
    const modal = document.getElementById('modal-keuangan-tarif');
    if (!modal) return;

    const idInput = document.getElementById('tarif-input-id');
    const namaInput = document.getElementById('tarif-input-nama');
    const katInput = document.getElementById('tarif-input-kategori');
    const nomInput = document.getElementById('tarif-input-nominal');
    const actInput = document.getElementById('tarif-input-active');
    const titleEl = document.getElementById('modal-tarif-title');

    let currentProgram = "SEMUA";

    if (tarifId) {
        const list = ASNKeuangan.data.tarifList || [];
        const t = list.find(x => x.tarifId === tarifId);
        if (t) {
            if (idInput) idInput.value = t.tarifId;
            if (namaInput) namaInput.value = t.namaPos;
            if (katInput) katInput.value = t.kategori;
            if (nomInput) nomInput.value = t.nominalDefault;
            currentProgram = t.program || "SEMUA";
            if (actInput) actInput.checked = t.isActive !== false;
            if (titleEl) titleEl.innerText = "Edit Master Tarif Biaya";
        }
    } else {
        if (idInput) idInput.value = "";
        if (namaInput) namaInput.value = "";
        if (katInput) katInput.value = "BULANAN";
        if (nomInput) nomInput.value = "";
        currentProgram = "SEMUA";
        if (actInput) actInput.checked = true;
        if (titleEl) titleEl.innerText = "Tambah Master Tarif Biaya";
    }

    // Populate dropdown Program secara dinamis sesuai Sheet "Programs" (kolom B: name)
    populateKeuanganTarifProgramDropdown(currentProgram);

    modal.classList.remove('hidden');
}
window.openTarifModal = openTarifModal;

function closeTarifModal() {
    const modal = document.getElementById('modal-keuangan-tarif');
    if (modal) modal.classList.add('hidden');
}
window.closeTarifModal = closeTarifModal;

async function submitSaveTarif() {
    const idInput = document.getElementById('tarif-input-id');
    const namaInput = document.getElementById('tarif-input-nama');
    const katInput = document.getElementById('tarif-input-kategori');
    const nomInput = document.getElementById('tarif-input-nominal');
    const progInput = document.getElementById('tarif-input-program');
    const actInput = document.getElementById('tarif-input-active');

    const nama = namaInput ? namaInput.value.trim() : "";
    const nominal = Number(nomInput ? nomInput.value : 0) || 0;

    if (!nama) {
        alert("Nama pos biaya wajib diisi.");
        return;
    }
    if (nominal <= 0) {
        alert("Nominal biaya harus lebih besar dari Rp 0.");
        return;
    }

    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : null) || "";
        const payload = {
            token: token,
            tarifId: idInput ? idInput.value.trim() : "",
            namaPos: nama,
            kategori: katInput ? katInput.value : "BULANAN",
            tipePeriode: katInput ? katInput.value : "BULANAN",
            nominalDefault: nominal,
            program: progInput ? progInput.value : "SEMUA",
            isActive: actInput ? actInput.checked : true
        };

        const res = await apiPost("saveMasterTarif", payload);
        if (res && res.success) {
            closeTarifModal();
            loadAdminKeuanganData(true);
            if (typeof showToast === 'function') showToast("✅ Master tarif berhasil disimpan.");
        } else {
            alert("Gagal menyimpan tarif: " + ((res && res.message) || "Terjadi kesalahan"));
        }
    } catch (e) {
        alert("Error: " + e.message);
    }
}
window.submitSaveTarif = submitSaveTarif;

async function deleteMasterTarif(tarifId) {
    if (!confirm("Apakah Anda yakin ingin menghapus pos tarif ini?")) return;
    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : null) || "";
        const res = await apiPost("deleteMasterTarif", { token, tarifId });
        if (res && res.success) {
            loadAdminKeuanganData(true);
            if (typeof showToast === 'function') showToast("✅ Tarif berhasil dihapus.");
        } else {
            alert("Gagal menghapus tarif: " + ((res && res.message) || "Terjadi kesalahan"));
        }
    } catch (e) {
        alert("Error: " + e.message);
    }
}
window.deleteMasterTarif = deleteMasterTarif;

// ====================================================================
// SUB-MODUL 5: BUKU KAS KELUAR (PENGELUARAN OPERASIONAL)
// ====================================================================

function populateKategoriPengeluaranDropdown() {
    const select = document.getElementById('pengeluaran-input-kategori');
    if (!select) return;
    const cats = ASNKeuangan.data.kategoriPengeluaranList || [];

    if (cats.length === 0) {
        select.innerHTML = `
            <option value="EXP-CAT-01">Dapur & Konsumsi Santri</option>
            <option value="EXP-CAT-02">Honorarium Asatidz & Pegawai</option>
            <option value="EXP-CAT-03">Utilitas (Listrik, Air & Internet)</option>
            <option value="EXP-CAT-04">Pemeliharaan Gedung & Sarpras</option>
            <option value="EXP-CAT-05">ATK & Kebutuhan Kantor</option>
            <option value="EXP-CAT-06">Kegiatan, Lomba & PHBI</option>
            <option value="EXP-CAT-07">Kesehatan & P3K Santri</option>
            <option value="EXP-CAT-08" selected>Kas Kecil & Pengeluaran Darurat</option>
        `;
        return;
    }

    let html = '';
    cats.forEach(c => {
        html += `<option value="${escapeHtml(c.kategoriId)}">${escapeHtml(c.namaKategori)} (${escapeHtml(c.tipe || 'OPERASIONAL')})</option>`;
    });
    select.innerHTML = html;
}
window.populateKategoriPengeluaranDropdown = populateKategoriPengeluaranDropdown;

function openModalPengeluaran() {
    const modal = document.getElementById('modal-keuangan-pengeluaran');
    if (!modal) return;

    const tglInput = document.getElementById('pengeluaran-input-tanggal');
    const nomInput = document.getElementById('pengeluaran-input-nominal');
    const penInput = document.getElementById('pengeluaran-input-penerima');
    const ketInput = document.getElementById('pengeluaran-input-keterangan');
    const metInput = document.getElementById('pengeluaran-input-metode');

    if (tglInput) tglInput.value = new Date().toISOString().substring(0, 10);
    if (nomInput) nomInput.value = '';
    if (penInput) penInput.value = '';
    if (ketInput) ketInput.value = '';
    if (metInput) metInput.value = 'TUNAI';

    populateKategoriPengeluaranDropdown();
    modal.classList.remove('hidden');
    if (nomInput) setTimeout(() => nomInput.focus(), 150);
}
window.openModalPengeluaran = openModalPengeluaran;

function closeModalPengeluaran() {
    const modal = document.getElementById('modal-keuangan-pengeluaran');
    if (modal) modal.classList.add('hidden');
}
window.closeModalPengeluaran = closeModalPengeluaran;

async function submitSavePengeluaran() {
    const roleCheck = checkKeuanganRoleAccess();
    if (!roleCheck.isAllowed) {
        alert("Akses ditolak: Hanya Super Admin, Admin, atau Bendahara yang diizinkan mencatat kas keluar.");
        return;
    }

    const tglInput = document.getElementById('pengeluaran-input-tanggal');
    const catInput = document.getElementById('pengeluaran-input-kategori');
    const nomInput = document.getElementById('pengeluaran-input-nominal');
    const penInput = document.getElementById('pengeluaran-input-penerima');
    const ketInput = document.getElementById('pengeluaran-input-keterangan');
    const metInput = document.getElementById('pengeluaran-input-metode');
    const btnSubmit = document.getElementById('btn-submit-pengeluaran');

    const tanggal = tglInput ? tglInput.value.trim() : "";
    const kategoriId = catInput ? catInput.value.trim() : "";
    const namaKategori = catInput && catInput.selectedOptions[0] ? catInput.selectedOptions[0].text.split(' (')[0].trim() : "Beban Operasional";
    const nominal = nomInput ? (Number(nomInput.value) || 0) : 0;
    const dibayarkanKepada = penInput ? penInput.value.trim() : "";
    const keterangan = ketInput ? ketInput.value.trim() : "";
    const metodeBayar = metInput ? metInput.value.trim() : "TUNAI";

    if (!tanggal) {
        alert("Pilih tanggal pengeluaran.");
        return;
    }
    if (nominal <= 0) {
        alert("Masukkan nominal pengeluaran lebih dari Rp 0.");
        if (nomInput) nomInput.focus();
        return;
    }
    if (!keterangan || keterangan.length < 3) {
        alert("Tuliskan keterangan / rincian keperluan pengeluaran (min. 3 karakter).");
        if (ketInput) ketInput.focus();
        return;
    }

    try {
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Menyimpan...`;
        }

        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : null) || "";
        const res = await apiPost("keuangan.savePengeluaran", {
            token: token,
            tanggal: tanggal,
            kategoriId: kategoriId,
            namaKategori: namaKategori,
            nominal: nominal,
            metodeBayar: metodeBayar,
            dibayarkanKepada: dibayarkanKepada,
            keterangan: keterangan
        });

        if (res && res.success) {
            closeModalPengeluaran();
            if (typeof showToast === 'function') {
                showToast(`✅ ${res.message || "Pengeluaran kas berhasil dicatat."}`);
            } else {
                alert(res.message);
            }
            loadAdminKeuanganData(true);
        } else {
            alert("Gagal mencatat pengeluaran: " + ((res && res.message) || "Terjadi kesalahan sistem."));
        }
    } catch (e) {
        alert("Error pengeluaran: " + e.message);
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = `Simpan Kas Keluar`;
        }
    }
}
window.submitSavePengeluaran = submitSavePengeluaran;

async function promptVoidPengeluaran(pengeluaranId, noBukti, nominal) {
    const roleCheck = checkKeuanganRoleAccess();
    if (!roleCheck.isAllowed) {
        alert("Akses ditolak: Hanya Super Admin, Admin, atau Bendahara yang diizinkan membatalkan pengeluaran.");
        return;
    }

    const alasan = prompt(
        `⚠️ KONFIRMASI PEMBATALAN PENGELUARAN (VOID)\n\n` +
        `• No. Bukti : ${noBukti || pengeluaranId}\n` +
        `• Nominal   : ${formatRupiah(nominal)}\n\n` +
        `PERHATIAN:\n` +
        `Pengeluaran ini akan dibatalkan, total beban bulan ini akan dikurangi kembali.\n\n` +
        `Silakan ketik alasan pembatalan (wajib, min. 3 karakter):`
    );

    if (alasan === null) return;
    const trimmed = alasan.trim();
    if (!trimmed || trimmed.length < 3) {
        alert("Alasan pembatalan wajib diisi minimal 3 karakter untuk audit trail pembukuan.");
        return;
    }

    try {
        if (typeof showToast === 'function') showToast("⏳ Memproses pembatalan pengeluaran...");
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : null) || "";
        const res = await apiPost("keuangan.batalPengeluaran", {
            token: token,
            pengeluaranId: pengeluaranId,
            alasan: trimmed
        });

        if (res && res.success) {
            if (typeof showToast === 'function') {
                showToast(`✅ ${res.message || "Pengeluaran berhasil dibatalkan (VOID)."}`);
            } else {
                alert(res.message);
            }
            loadAdminKeuanganData(true);
        } else {
            alert("Gagal membatalkan pengeluaran: " + ((res && res.message) || "Terjadi kesalahan."));
        }
    } catch (e) {
        alert("Error pembatalan pengeluaran: " + e.message);
    }
}
window.promptVoidPengeluaran = promptVoidPengeluaran;

function renderKeuanganPengeluaranTable() {
    const tbody = document.getElementById('keuangan-pengeluaran-table-body');
    const mobileList = document.getElementById('keuangan-pengeluaran-mobile-list');
    const list = ASNKeuangan.data.recentExpenses || [];

    if (!tbody && !mobileList) return;

    if (list.length === 0) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="py-6 text-center text-xs text-slate-400">Belum ada catatan pengeluaran kas. Klik 'Catat Kas Keluar' untuk menambah.</td></tr>`;
        if (mobileList) mobileList.innerHTML = `<div class="p-6 text-center bg-white dark:bg-[#15202d] rounded-2xl border border-slate-100 dark:border-[#253447] text-xs text-slate-400"><i class="fa-solid fa-money-bill-transfer text-2xl text-slate-300 dark:text-slate-600 block mb-1.5"></i>Belum ada riwayat pengeluaran kas keluar.</div>`;
        return;
    }

    let htmlDesktop = '';
    let htmlMobile = '';

    list.forEach((exp, idx) => {
        const isVoid = String(exp.status || '').toUpperCase() === 'VOID' || String(exp.keterangan || '').includes('[VOID');
        const statusBadge = isVoid
            ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300"><i class="fa-solid fa-ban text-[9px]"></i> VOID</span>`
            : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300"><i class="fa-solid fa-circle-check text-[9px]"></i> Terbayar</span>`;

        const nomDisplay = isVoid
            ? `<span class="line-through text-slate-400 font-semibold">${formatRupiah(exp.nominal)}</span>`
            : `<span class="font-black text-rose-600 dark:text-rose-400">${formatRupiah(exp.nominal)}</span>`;

        htmlDesktop += `
            <tr class="hover:bg-slate-50/80 dark:hover:bg-[#1a2636]/60 transition border-b border-slate-100 dark:border-[#202f42] text-xs ${isVoid ? 'bg-rose-50/20 dark:bg-rose-950/10' : ''}">
                <td class="p-3 text-center text-slate-400 font-medium">${idx + 1}</td>
                <td class="p-3 font-mono font-bold ${isVoid ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}">${escapeHtml(exp.noBukti || exp.pengeluaranId)}</td>
                <td class="p-3 text-slate-500">${formatTglIndo(exp.tanggal)}</td>
                <td class="p-3 font-bold text-slate-800 dark:text-slate-100">${escapeHtml(exp.namaKategori)}</td>
                <td class="p-3 text-slate-600 dark:text-slate-300">
                    <div class="font-semibold">${escapeHtml(exp.dibayarkanKepada || '-')}</div>
                    <div class="text-[10px] text-slate-400 truncate max-w-xs">${escapeHtml(exp.keterangan || '')}</div>
                </td>
                <td class="p-3 font-bold">${nomDisplay}</td>
                <td class="p-3">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-[#1c2836] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#253447]">
                        ${escapeHtml(exp.metodeBayar)}
                    </span>
                </td>
                <td class="p-3 text-center">${statusBadge}</td>
                <td class="p-3 text-right">
                    ${!isVoid ? `
                        <button type="button" onclick="promptVoidPengeluaran('${escapeHtml(exp.pengeluaranId)}', '${escapeHtml(exp.noBukti)}', ${Number(exp.nominal) || 0})"
                            class="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition" title="Batalkan Pengeluaran (VOID)">
                            <i class="fa-solid fa-ban text-xs"></i>
                        </button>
                    ` : '<span class="text-slate-300 text-xs">-</span>'}
                </td>
            </tr>
        `;

        htmlMobile += `
            <div class="p-3.5 bg-white dark:bg-[#15202d] rounded-2xl border border-slate-100 dark:border-[#253447] shadow-xs space-y-2.5 ${isVoid ? 'border-rose-200/80 bg-rose-50/10' : ''}">
                <div class="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-[#202f42] pb-2">
                    <div class="flex items-center space-x-2">
                        <span class="font-mono text-xs font-bold ${isVoid ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}">${escapeHtml(exp.noBukti || exp.pengeluaranId)}</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        ${statusBadge}
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-[#1c2836] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#253447]">
                            ${escapeHtml(exp.metodeBayar)}
                        </span>
                    </div>
                </div>
                <div class="flex items-start justify-between gap-2">
                    <div>
                        <div class="text-xs font-bold text-slate-800 dark:text-slate-100">${escapeHtml(exp.namaKategori)}</div>
                        <div class="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">${escapeHtml(exp.dibayarkanKepada || '-')}</div>
                        <div class="text-[10px] text-slate-400 mt-0.5">${escapeHtml(exp.keterangan || '')}</div>
                        <div class="text-[9px] text-slate-400 mt-1">${formatTglIndo(exp.tanggal)} • Oleh: ${escapeHtml(exp.petugas || 'Bendahara')}</div>
                    </div>
                    <div class="text-right shrink-0">
                        <div class="text-sm font-black ${isVoid ? 'text-slate-400 line-through' : 'text-rose-600 dark:text-rose-400'}">${formatRupiah(exp.nominal)}</div>
                    </div>
                </div>
                ${!isVoid ? `
                    <div class="pt-1 flex items-center justify-end">
                        <button type="button" onclick="promptVoidPengeluaran('${escapeHtml(exp.pengeluaranId)}', '${escapeHtml(exp.noBukti)}', ${Number(exp.nominal) || 0})"
                            class="py-1 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300 rounded-lg text-xs font-bold transition flex items-center gap-1 border border-rose-200 dark:border-rose-900/40">
                            <i class="fa-solid fa-ban text-[10px]"></i>
                            <span>Batalkan (VOID)</span>
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    });

    if (tbody) tbody.innerHTML = htmlDesktop;
    if (mobileList) mobileList.innerHTML = htmlMobile;
}
window.renderKeuanganPengeluaranTable = renderKeuanganPengeluaranTable;

// ====================================================================
// SUB-MODUL 6: REKONSILIASI TUTUP KASIR HARIAN
// ====================================================================

function loadTutupKasirRealtime() {
    const today = new Date().toISOString().substring(0, 10);
    const dateDisplay = document.getElementById('tutup-kasir-date-display');
    if (dateDisplay) dateDisplay.innerText = formatTglIndo(today);

    const sum = ASNKeuangan.data.summary || {};
    const masukTunaiEl = document.getElementById('tutup-kasir-masuk-tunai');
    const nonTunaiEl = document.getElementById('tutup-kasir-non-tunai');
    const keluarTunaiEl = document.getElementById('tutup-kasir-keluar-tunai');

    const masukTunai = Number(sum.kasMasukHariIniTunai) || 0;
    const nonTunai = Number(sum.kasMasukHariIniNonTunai) || 0;
    const keluarTunai = Number(sum.kasKeluarHariIniTunai) || 0;

    if (masukTunaiEl) masukTunaiEl.innerText = formatRupiah(masukTunai);
    if (nonTunaiEl) nonTunaiEl.innerText = `(Transfer/QRIS: ${formatRupiah(nonTunai)})`;
    if (keluarTunaiEl) keluarTunaiEl.innerText = formatRupiah(keluarTunai);

    calcTutupKasirSelisih();
    renderKeuanganClosingTable();
}
window.loadTutupKasirRealtime = loadTutupKasirRealtime;

function calcTutupKasirSelisih() {
    const modalAwalInput = document.getElementById('tutup-kasir-modal-awal');
    const saldoFisikInput = document.getElementById('tutup-kasir-saldo-fisik');
    const saldoSistemEl = document.getElementById('tutup-kasir-saldo-sistem');
    const selisihBadge = document.getElementById('tutup-kasir-selisih-badge');
    const selisihNominalEl = document.getElementById('tutup-kasir-selisih-nominal');

    const sum = ASNKeuangan.data.summary || {};
    const modalAwal = modalAwalInput ? (Number(modalAwalInput.value) || 0) : 0;
    const masukTunai = Number(sum.kasMasukHariIniTunai) || 0;
    const keluarTunai = Number(sum.kasKeluarHariIniTunai) || 0;

    const saldoSistem = (modalAwal + masukTunai) - keluarTunai;
    if (saldoSistemEl) saldoSistemEl.innerText = formatRupiah(saldoSistem);

    const fisikVal = saldoFisikInput ? saldoFisikInput.value.trim() : "";
    if (!fisikVal) {
        if (selisihBadge) {
            selisihBadge.innerText = "Masukkan hitungan uang fisik...";
            selisihBadge.className = "text-xs font-semibold text-slate-400";
        }
        if (selisihNominalEl) selisihNominalEl.innerText = "Selisih: Rp 0";
        return;
    }

    const saldoFisik = Number(fisikVal) || 0;
    const selisih = saldoFisik - saldoSistem;

    if (selisihNominalEl) {
        selisihNominalEl.innerText = `Selisih: ${formatRupiah(selisih)}`;
    }

    if (selisihBadge) {
        if (selisih === 0) {
            selisihBadge.innerText = "✅ SEIMBANG (Uang Fisik Klop)";
            selisihBadge.className = "text-sm font-black text-emerald-600 dark:text-emerald-400";
        } else if (selisih > 0) {
            selisihBadge.innerText = `⚠️ LEBIH KAS (+${formatRupiah(selisih)})`;
            selisihBadge.className = "text-sm font-black text-teal-600 dark:text-teal-400";
        } else {
            selisihBadge.innerText = `🚨 SELISIH KURANG (-${formatRupiah(Math.abs(selisih))})`;
            selisihBadge.className = "text-sm font-black text-rose-600 dark:text-rose-400";
        }
    }
}
window.calcTutupKasirSelisih = calcTutupKasirSelisih;

async function submitTutupKasir() {
    const roleCheck = checkKeuanganRoleAccess();
    if (!roleCheck.isAllowed) {
        alert("Akses ditolak: Hanya kasir / bendahara yang berwenang melakukan tutup kasir.");
        return;
    }

    const modalAwalInput = document.getElementById('tutup-kasir-modal-awal');
    const saldoFisikInput = document.getElementById('tutup-kasir-saldo-fisik');
    const catatanInput = document.getElementById('tutup-kasir-catatan');
    const btnSubmit = document.getElementById('btn-submit-tutup-kasir');

    const fisikVal = saldoFisikInput ? saldoFisikInput.value.trim() : "";
    if (fisikVal === "") {
        alert("Silakan masukkan jumlah uang fisik yang ada di laci kasir terlebih dahulu.");
        if (saldoFisikInput) saldoFisikInput.focus();
        return;
    }

    const modalAwal = modalAwalInput ? (Number(modalAwalInput.value) || 0) : 0;
    const saldoFisik = Number(fisikVal) || 0;
    const catatan = catatanInput ? catatanInput.value.trim() : "";
    const sum = ASNKeuangan.data.summary || {};
    const masukTunai = Number(sum.kasMasukHariIniTunai) || 0;
    const masukTransfer = Number(sum.kasMasukHariIniNonTunai) || 0;
    const keluarTunai = Number(sum.kasKeluarHariIniTunai) || 0;
    const saldoSistem = (modalAwal + masukTunai) - keluarTunai;
    const selisih = saldoFisik - saldoSistem;

    if (!confirm(`Konfirmasi Tutup Kasir Hari Ini:\n• Saldo Sistem: ${formatRupiah(saldoSistem)}\n• Uang Fisik: ${formatRupiah(saldoFisik)}\n• Selisih: ${formatRupiah(selisih)}\n\nLanjutkan mengunci rekonsiliasi kasir?`)) {
        return;
    }

    try {
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Menyimpan...`;
        }

        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : null) || "";
        const res = await apiPost("keuangan.submitTutupKasir", {
            token: token,
            tanggal: new Date().toISOString().substring(0, 10),
            modalAwal: modalAwal,
            masukTunai: masukTunai,
            masukTransfer: masukTransfer,
            keluarTunai: keluarTunai,
            saldoFisik: saldoFisik,
            catatan: catatan
        });

        if (res && res.success) {
            if (typeof showToast === 'function') {
                showToast(`✅ ${res.message || "Tutup kasir berhasil disimpan."}`);
            } else {
                alert(res.message);
            }
            if (saldoFisikInput) saldoFisikInput.value = '';
            if (catatanInput) catatanInput.value = '';
            loadAdminKeuanganData(true);
        } else {
            alert("Gagal tutup kasir: " + ((res && res.message) || "Terjadi kesalahan sistem."));
        }
    } catch (e) {
        alert("Error tutup kasir: " + e.message);
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = `<i class="fa-solid fa-lock text-xs mr-1"></i> Kunci & Simpan Tutup Kasir`;
        }
    }
}
window.submitTutupKasir = submitTutupKasir;

function renderKeuanganClosingTable() {
    const tbody = document.getElementById('keuangan-closing-table-body');
    const mobileList = document.getElementById('keuangan-closing-mobile-list');
    const list = ASNKeuangan.data.recentClosingList || [];

    if (!tbody && !mobileList) return;

    if (list.length === 0) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="py-6 text-center text-xs text-slate-400">Belum ada arsip rekonsiliasi tutup kasir.</td></tr>`;
        if (mobileList) mobileList.innerHTML = `<div class="p-6 text-center bg-white dark:bg-[#15202d] rounded-2xl border border-slate-100 dark:border-[#253447] text-xs text-slate-400">Belum ada arsip tutup kasir.</div>`;
        return;
    }

    let htmlDesktop = '';
    let htmlMobile = '';

    list.forEach((c, idx) => {
        const sel = Number(c.selisih) || 0;
        let selBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">Paspasan</span>`;
        if (sel > 0) selBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">+${formatRupiah(sel)}</span>`;
        else if (sel < 0) selBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">${formatRupiah(sel)}</span>`;

        htmlDesktop += `
            <tr class="hover:bg-slate-50/80 dark:hover:bg-[#1a2636]/60 transition border-b border-slate-100 dark:border-[#202f42] text-xs">
                <td class="p-2.5 text-center text-slate-400">${idx + 1}</td>
                <td class="p-2.5 font-bold text-slate-800 dark:text-slate-100">${formatTglIndo(c.tanggal)}</td>
                <td class="p-2.5 text-slate-600 dark:text-slate-300">${escapeHtml(c.namaKasir || '-')}</td>
                <td class="p-2.5">${formatRupiah(c.modalAwal)}</td>
                <td class="p-2.5 font-bold text-emerald-600">${formatRupiah(c.masukTunai)}</td>
                <td class="p-2.5 font-bold text-blue-600">${formatRupiah(c.saldoSistem)}</td>
                <td class="p-2.5 font-black text-slate-800 dark:text-slate-100">${formatRupiah(c.saldoFisik)}</td>
                <td class="p-2.5 text-center">${selBadge}</td>
                <td class="p-2.5 text-[11px] text-slate-500 max-w-xs truncate">${escapeHtml(c.catatan || '-')}</td>
            </tr>
        `;

        htmlMobile += `
            <div class="p-3 bg-white dark:bg-[#15202d] rounded-2xl border border-slate-100 dark:border-[#253447] text-xs space-y-1.5">
                <div class="flex items-center justify-between">
                    <span class="font-bold text-slate-800 dark:text-slate-100">${formatTglIndo(c.tanggal)}</span>
                    ${selBadge}
                </div>
                <div class="flex items-center justify-between text-slate-500">
                    <span>Kasir: ${escapeHtml(c.namaKasir || '-')}</span>
                    <span>Fisik: <strong class="text-slate-800 dark:text-slate-100">${formatRupiah(c.saldoFisik)}</strong></span>
                </div>
            </div>
        `;
    });

    if (tbody) tbody.innerHTML = htmlDesktop;
    if (mobileList) mobileList.innerHTML = htmlMobile;
}
window.renderKeuanganClosingTable = renderKeuanganClosingTable;

// ====================================================================
// SUB-MODUL 7: LAPORAN ARUS KAS & NERACA PESANTREN
// ====================================================================

function renderKeuanganLaporanView() {
    const sum = ASNKeuangan.data.summary || {};
    const totalMasuk = Number(sum.totalPendapatanBulanIni) || 0;
    const totalKeluar = Number(sum.totalPengeluaranBulanIni) || 0;
    const surplusDefisit = sum.surplusDefisit !== undefined ? Number(sum.surplusDefisit) : (totalMasuk - totalKeluar);

    const elMasuk = document.getElementById('laporan-total-masuk');
    const elKeluar = document.getElementById('laporan-total-keluar');
    const elSurplus = document.getElementById('laporan-surplus-defisit');
    const elPeriode = document.getElementById('laporan-periode-text');
    const elKopLaporan = document.getElementById('laporan-kop-nama');
    const container = document.getElementById('laporan-breakdown-kategori');

    if (elKopLaporan) {
        elKopLaporan.innerText = getNamaLembagaKuitansi().toUpperCase();
    }

    const now = new Date();
    const namaBulan = getNamaBulanIndo(now.getMonth() + 1);
    if (elPeriode) elPeriode.innerText = `Bulan ${namaBulan} ${now.getFullYear()}`;

    if (elMasuk) elMasuk.innerText = formatRupiah(totalMasuk);
    if (elKeluar) elKeluar.innerText = formatRupiah(totalKeluar);
    if (elSurplus) {
        if (surplusDefisit >= 0) {
            elSurplus.innerText = formatRupiah(surplusDefisit);
            elSurplus.className = "text-base sm:text-lg font-black text-teal-700 dark:text-teal-300";
        } else {
            elSurplus.innerText = `-${formatRupiah(Math.abs(surplusDefisit))}`;
            elSurplus.className = "text-base sm:text-lg font-black text-rose-600 dark:text-rose-400";
        }
    }

    if (!container) return;

    // Breakdown per kategori pengeluaran
    const expenses = ASNKeuangan.data.recentExpenses || [];
    const catTotals = {};

    expenses.forEach(exp => {
        if (String(exp.status || '').toUpperCase() !== 'VOID') {
            const cat = exp.namaKategori || 'Lain-lain';
            catTotals[cat] = (catTotals[cat] || 0) + (Number(exp.nominal) || 0);
        }
    });

    const catEntries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
    if (catEntries.length === 0) {
        container.innerHTML = `<div class="p-4 text-center text-slate-400 text-xs">Belum ada pengeluaran kas operasional bulan ini.</div>`;
        return;
    }

    let html = '';
    catEntries.forEach(([catName, nom]) => {
        const pct = totalKeluar > 0 ? Math.round((nom / totalKeluar) * 100) : 0;
        html += `
            <div class="p-3 bg-white dark:bg-[#15202d] flex items-center justify-between gap-3">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between mb-1">
                        <span class="font-bold text-slate-800 dark:text-slate-100 truncate">${escapeHtml(catName)}</span>
                        <span class="font-bold text-rose-600 dark:text-rose-400 shrink-0 ml-2">${formatRupiah(nom)} (${pct}%)</span>
                    </div>
                    <div class="w-full bg-slate-100 dark:bg-[#1c2836] h-1.5 rounded-full overflow-hidden">
                        <div class="bg-rose-500 h-full rounded-full transition-all duration-500" style="width: ${pct}%"></div>
                    </div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}
window.renderKeuanganLaporanView = renderKeuanganLaporanView;

function printLaporanKeuangan() {
    window.print();
}
window.printLaporanKeuangan = printLaporanKeuangan;

// ====================================================================
// FASE 3: VERIFIKASI TRANSFER ONLINE, WHATSAPP BILLING & PORTAL WALI
// ====================================================================

/**
 * Render Tabel Konfirmasi Transfer Online Santri/Wali untuk Verifikasi Bendahara
 */
function renderKeuanganVerifikasiTable() {
    const list = ASNKeuangan.data.recentKonfirmasiList || [];
    const tbody = document.getElementById('keuangan-verifikasi-table-body');
    const mobileContainer = document.getElementById('keuangan-verifikasi-mobile-list');

    if (!tbody && !mobileContainer) return;

    if (list.length === 0) {
        const emptyMsg = `<tr><td colspan="8" class="py-8 text-center text-slate-400 text-xs">Belum ada pengajuan konfirmasi transfer online dari wali santri.</td></tr>`;
        if (tbody) tbody.innerHTML = emptyMsg;
        if (mobileContainer) mobileContainer.innerHTML = `<div class="p-6 bg-white dark:bg-[#15202d] rounded-2xl text-center text-slate-400 text-xs border border-slate-100 dark:border-[#253447]">Belum ada data transfer online masuk.</div>`;
        return;
    }

    let desktopHtml = '';
    let mobileHtml = '';

    list.forEach((item, index) => {
        const st = String(item.status || 'PENDING').toUpperCase();
        let statusBadge = '';
        let actionButtons = '';

        if (st === 'VERIFIED') {
            statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60"><i class="fa-solid fa-check mr-1"></i>Lunas / Verified</span>`;
            actionButtons = item.noKuitansi ? `<span class="font-mono text-[10px] font-bold text-emerald-600 block">${escapeHtml(item.noKuitansi)}</span>` : '<span class="text-[10px] text-slate-400">Selesai</span>';
        } else if (st === 'REJECTED') {
            statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/60"><i class="fa-solid fa-xmark mr-1"></i>Ditolak</span>`;
            actionButtons = `<span class="text-[10px] text-slate-400 italic" title="${escapeHtml(item.catatanVerifikasi || '')}">Ditolak</span>`;
        } else {
            statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/60 animate-pulse"><i class="fa-solid fa-clock mr-1"></i>Menunggu Verifikasi</span>`;
            actionButtons = `
                <div class="flex items-center justify-end space-x-1.5">
                    <button type="button" onclick="confirmVerifyTransfer('${escapeHtml(item.konfirmasiId)}')"
                        class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition shadow-xs active:scale-95 flex items-center gap-1"
                        title="Verifikasi & Terbitkan Kuitansi Kas">
                        <i class="fa-solid fa-check"></i>
                        <span>Setujui</span>
                    </button>
                    <button type="button" onclick="promptRejectTransfer('${escapeHtml(item.konfirmasiId)}')"
                        class="px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 rounded-lg text-[10px] font-bold transition"
                        title="Tolak Pembayaran">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `;
        }

        const buktiThumbnail = item.buktiTransferUrl ? `
            <button type="button" onclick="previewBuktiTransfer('${encodeURIComponent(item.buktiTransferUrl)}', '${escapeHtml(item.namaPengirim)}', '${escapeHtml(item.konfirmasiId)}')"
                class="px-2 py-1 bg-slate-100 hover:bg-cyan-50 dark:bg-[#1c2836] text-cyan-600 dark:text-cyan-400 rounded-lg text-[11px] font-semibold border border-slate-200 dark:border-[#2c3d52] flex items-center gap-1 mx-auto transition">
                <i class="fa-solid fa-image"></i>
                <span>Lihat Bukti</span>
            </button>
        ` : `<span class="text-[10px] text-slate-400 italic">Tidak ada foto</span>`;

        // Desktop Row
        desktopHtml += `
            <tr class="border-b border-slate-100 dark:border-[#253447] hover:bg-slate-50/50 dark:hover:bg-[#182332] transition">
                <td class="py-3 px-3 text-center text-slate-400 font-medium">${index + 1}</td>
                <td class="py-3 px-3">
                    <div class="font-mono font-bold text-slate-800 dark:text-slate-100">${escapeHtml(item.konfirmasiId)}</div>
                    <div class="text-[10px] text-slate-400">${escapeHtml(item.tanggalTransfer || item.createdAt.substring(0, 10))}</div>
                </td>
                <td class="py-3 px-3">
                    <div class="font-bold text-slate-800 dark:text-slate-100">${escapeHtml(item.studentName)}</div>
                    <div class="text-[10px] text-slate-400 font-mono">ID: ${escapeHtml(item.studentId)}</div>
                </td>
                <td class="py-3 px-3 font-bold text-emerald-600 dark:text-emerald-400">
                    ${formatRupiah(item.nominalTransfer)}
                </td>
                <td class="py-3 px-3">
                    <div class="font-semibold text-slate-700 dark:text-slate-200">${escapeHtml(item.bankTujuan)}</div>
                    <div class="text-[10px] text-slate-400 truncate">a.n ${escapeHtml(item.namaPengirim)}</div>
                </td>
                <td class="py-3 px-3 text-center">${buktiThumbnail}</td>
                <td class="py-3 px-3 text-center">${statusBadge}</td>
                <td class="py-3 px-3 text-right">${actionButtons}</td>
            </tr>
        `;

        // Mobile Card
        mobileHtml += `
            <div class="bg-white dark:bg-[#15202d] p-3.5 rounded-2xl border border-slate-100 dark:border-[#253447] shadow-xs space-y-2.5">
                <div class="flex items-center justify-between">
                    <div>
                        <span class="font-mono text-[10px] font-bold text-slate-500">${escapeHtml(item.konfirmasiId)}</span>
                        <h4 class="font-bold text-xs text-slate-800 dark:text-slate-100 mt-0.5">${escapeHtml(item.studentName)}</h4>
                    </div>
                    <div>${statusBadge}</div>
                </div>
                <div class="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-[#253447]">
                    <div>
                        <span class="text-[10px] text-slate-400 block">${escapeHtml(item.bankTujuan)} a.n ${escapeHtml(item.namaPengirim)}</span>
                        <div class="font-bold text-emerald-600 dark:text-emerald-400">${formatRupiah(item.nominalTransfer)}</div>
                    </div>
                    <div class="flex items-center space-x-2">
                        ${buktiThumbnail}
                        ${st === 'PENDING' ? `
                            <button type="button" onclick="confirmVerifyTransfer('${escapeHtml(item.konfirmasiId)}')"
                                class="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-xs">
                                Setujui
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    });

    if (tbody) tbody.innerHTML = desktopHtml;
    if (mobileContainer) mobileContainer.innerHTML = mobileHtml;
}
window.renderKeuanganVerifikasiTable = renderKeuanganVerifikasiTable;

/**
 * Pratinjau Modal Gambar Bukti Transfer
 */
function previewBuktiTransfer(imgUrlEncoded, senderName, konfirmasiId) {
    const imgUrl = decodeURIComponent(imgUrlEncoded || '');
    const modal = document.getElementById('modal-preview-bukti-transfer');
    const img = document.getElementById('modal-preview-bukti-image');
    const sub = document.getElementById('modal-preview-bukti-subtitle');
    const sender = document.getElementById('modal-preview-bukti-sender');
    const dl = document.getElementById('modal-preview-bukti-download');

    if (!imgUrl || !modal) return;

    if (img) img.src = imgUrl;
    if (sub) sub.innerText = `Konfirmasi #${konfirmasiId}`;
    if (sender) sender.innerText = `Pengirim: ${senderName || '-'}`;
    if (dl) {
        dl.href = imgUrl;
        dl.download = `Bukti_${konfirmasiId}.jpg`;
    }

    modal.classList.remove('hidden');
}
window.previewBuktiTransfer = previewBuktiTransfer;

function closeModalPreviewBuktiTransfer() {
    const modal = document.getElementById('modal-preview-bukti-transfer');
    if (modal) modal.classList.add('hidden');
}
window.closeModalPreviewBuktiTransfer = closeModalPreviewBuktiTransfer;

/**
 * Setujui & Verifikasi Konfirmasi Transfer Online oleh Bendahara
 */
async function confirmVerifyTransfer(konfirmasiId) {
    if (!konfirmasiId) return;
    if (!confirm(`Verifikasi dan setujui konfirmasi transfer ${konfirmasiId}?\nSistem akan secara otomatis melunasi tagihan santri dan menerbitkan kuitansi kas resmi.`)) return;

    try {
        if (typeof showToast === 'function') showToast("⏳ Memproses verifikasi transfer...");
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : null) || "";
        const res = await apiPost("keuangan.verifyKonfirmasiTransfer", {
            token: token,
            konfirmasiId: konfirmasiId,
            actionType: "VERIFY"
        });

        if (res && res.success) {
            if (typeof showToast === 'function') {
                showToast(`✅ ${res.message}`);
            } else {
                alert(res.message);
            }
            loadAdminKeuanganData(true);
        } else {
            alert("Gagal verifikasi transfer: " + ((res && res.message) || "Terjadi kesalahan"));
        }
    } catch (e) {
        console.error("[CONFIRM VERIFY TRANSFER ERROR]", e);
        alert("Error: " + e.message);
    }
}
window.confirmVerifyTransfer = confirmVerifyTransfer;

/**
 * Tolak Konfirmasi Transfer Online
 */
async function promptRejectTransfer(konfirmasiId) {
    if (!konfirmasiId) return;
    const alasan = prompt("Masukkan alasan penolakan konfirmasi transfer (misal: Bukti transfer tidak jelas / dana belum masuk rekening pesantren):");
    if (!alasan || alasan.trim().length < 3) {
        alert("Penolakan dibatalkan. Alasan penolakan wajib diisi.");
        return;
    }

    try {
        if (typeof showToast === 'function') showToast("⏳ Memproses penolakan transfer...");
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : null) || "";
        const res = await apiPost("keuangan.verifyKonfirmasiTransfer", {
            token: token,
            konfirmasiId: konfirmasiId,
            actionType: "REJECT",
            alasan: alasan.trim()
        });

        if (res && res.success) {
            if (typeof showToast === 'function') showToast(`✅ Transfer ${konfirmasiId} ditolak.`);
            loadAdminKeuanganData(true);
        } else {
            alert("Gagal menolak transfer: " + ((res && res.message) || "Terjadi kesalahan"));
        }
    } catch (e) {
        console.error("[PROMPT REJECT TRANSFER ERROR]", e);
        alert("Error: " + e.message);
    }
}
window.promptRejectTransfer = promptRejectTransfer;

/**
 * Kalkulasi Data WhatsApp Billing Langsung dari In-Memory Data (Zero-Delay & Resilient)
 */
function generateLocalBroadcastList(filterPeriode, filterProgram) {
    const allTagihan = (ASNKeuangan.data && ASNKeuangan.data.tagihanList) || [];
    const allStudents = (ASNKeuangan.data && ASNKeuangan.data.students) || (window.adminStudentsData || []);

    const studentMap = {};
    allStudents.forEach(st => {
        const id = st.studentId || st.id;
        if (id) studentMap[id] = st;
    });

    const unpaidMap = {};
    const normFilterPeriode = filterPeriode ? normalizeYearMonthTagihan(filterPeriode) : "";

    allTagihan.forEach(t => {
        const status = String(t.status || "").trim().toUpperCase();
        if (status === "LUNAS" || status === "PAID") return;

        const sId = t.studentId;
        if (!sId) return;

        const stInfo = studentMap[sId] || { name: t.studentName, program: t.studentProgram, phone: t.phone || "" };

        // Filter Program
        if (filterProgram && filterProgram !== "SEMUA" && filterProgram !== "ALL") {
            const prog = String(stInfo.program || t.studentProgram || "").toLowerCase();
            const target = filterProgram.toLowerCase();
            if (!prog.includes(target) && !target.includes(prog)) return;
        }

        // Filter Periode
        if (normFilterPeriode) {
            const curPer = normalizeYearMonthTagihan(t.periode);
            if (curPer && curPer !== normFilterPeriode) return;
        }

        const sisa = Number(t.sisaTagihan !== undefined ? t.sisaTagihan : (t.nominalTagihan - (t.nominalTerbayar || 0))) || 0;
        if (sisa <= 0) return;

        if (!unpaidMap[sId]) {
            let phone = String(stInfo.phone || stInfo.no_hp || stInfo.telepon || stInfo.whatsapp || stInfo.no_wa || t.phone || "").trim();
            unpaidMap[sId] = {
                studentId: sId,
                studentName: stInfo.name || stInfo.nama || t.studentName,
                program: stInfo.program || t.studentProgram || "Tahfidz",
                phone: phone,
                totalTunggakan: 0,
                items: []
            };
        }

        unpaidMap[sId].totalTunggakan += sisa;
        unpaidMap[sId].items.push({
            namaPos: t.namaPos || "Tagihan",
            periode: t.periode || "-",
            sisa: sisa
        });
    });

    const list = Object.values(unpaidMap).map(st => {
        let rincianText = st.items.map(it => `• ${it.namaPos} (${it.periode}): ${formatRupiah(it.sisa)}`).join("\n");
        let rawWa = String(st.phone || "").replace(/[^0-9]/g, "");
        if (rawWa.startsWith("0")) rawWa = "62" + rawWa.substring(1);

        const template = 
`Assalamu'alaikum Wr. Wb.
Yth. Bapak/Ibu Wali Santri dari ananda *${st.studentName}* (${st.program}).

Semoga senantiasa dalam limpahan taufiq dan hidayah Allah SWT.

Kami dari Administrasi & Keuangan PPTQ Roudlotul Mubarokah menginformasikan rincian kewajiban administrasi santri yang belum terselesaikan:

${rincianText}

*Total Kewajiban: ${formatRupiah(st.totalTunggakan)}*

Pembayaran dapat dilakukan melalui loket kantor pesantren atau transfer ke rekening resmi:
Bank Syariah Indonesia (BSI)
No. Rekening: *7200-888-999*
A.n: *PPTQ ROUDLOTUL MUBAROKAH*

Mohon konfirmasi setelah melakukan transfer melalui portal resmi wali santri:
https://mubarokah.my.id/portal-wali

Jazakumullah Khairan Katsiran.
Wassalamu'alaikum Wr. Wb.`;

        let waLink = rawWa ? `https://wa.me/${rawWa}?text=${encodeURIComponent(template)}` : "";

        return {
            ...st,
            messageTemplate: template,
            waLink: waLink
        };
    });

    list.sort((a, b) => b.totalTunggakan - a.totalTunggakan);
    return list;
}

/**
 * Memuat Data WhatsApp Billing & Pengingat Tagihan Terjadwal (Hybrid Resilient)
 */
async function loadBroadcastTagihanData() {
    const tbody = document.getElementById('keuangan-broadcast-table-body');
    const mobileContainer = document.getElementById('keuangan-broadcast-mobile-list');
    const statCount = document.getElementById('broadcast-stat-count');
    const statNominal = document.getElementById('broadcast-stat-nominal');

    const periodeInput = document.getElementById('broadcast-filter-periode');
    const programSelect = document.getElementById('broadcast-filter-program');

    const periode = periodeInput ? periodeInput.value : '';
    const program = programSelect ? programSelect.value : 'SEMUA';

    if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400 text-xs"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Mengkalkulasi daftar tagihan santri...</td></tr>`;

    try {
        let list = [];
    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : null) || "";
        const res = await apiPost("keuangan.getBroadcastTagihanList", {
            token: token,
            periode: periode,
            program: program
        });

        if (res && res.success && Array.isArray(res.broadcastList)) {
            list = res.broadcastList;
        } else {
            list = generateLocalBroadcastList(periode, program);
        }
    } catch (err) {
        console.warn("[BROADCAST] Network API gagal, fallback ke kalkulasi data lokal:", err);
        list = generateLocalBroadcastList(periode, program);
    }
        const totalNominal = list.reduce((acc, curr) => acc + (Number(curr.totalTunggakan) || 0), 0);

        if (statCount) statCount.innerText = `${list.length} Santri`;
        if (statNominal) statNominal.innerText = `(${formatRupiah(totalNominal)})`;

        if (list.length === 0) {
            const emptyMsg = `<tr><td colspan="7" class="py-8 text-center text-slate-400 text-xs">Alhamdulillah, seluruh santri telah lunas untuk kriteria yang dipilih.</td></tr>`;
            if (tbody) tbody.innerHTML = emptyMsg;
            if (mobileContainer) mobileContainer.innerHTML = `<div class="p-6 bg-white dark:bg-[#15202d] rounded-2xl text-center text-slate-400 text-xs border border-slate-100 dark:border-[#253447]">Semua tagihan santri telah lunas.</div>`;
            return;
        }

        let desktopHtml = '';
        let mobileHtml = '';

        list.forEach((st, idx) => {
            const rincianHtml = (st.items || []).map(it => `
                <div class="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
                    <span>${escapeHtml(it.namaPos)} (${escapeHtml(it.periode)}):</span>
                    <span class="font-bold text-slate-800 dark:text-slate-100 ml-2">${formatRupiah(it.sisa)}</span>
                </div>
            `).join('');

            const waBtn = st.waLink ? `
                <a href="${st.waLink}" target="_blank"
                    class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold transition inline-flex items-center gap-1.5 shadow-xs active:scale-95">
                    <i class="fa-brands fa-whatsapp text-sm"></i>
                    <span>Kirim WA</span>
                </a>
            ` : `<span class="text-[10px] text-slate-400 italic">No WA belum ada</span>`;

            desktopHtml += `
                <tr class="border-b border-slate-100 dark:border-[#253447] hover:bg-slate-50/50 dark:hover:bg-[#182332] transition">
                    <td class="py-3 px-3 text-center text-slate-400 font-medium">${idx + 1}</td>
                    <td class="py-3 px-3">
                        <div class="font-bold text-slate-800 dark:text-slate-100">${escapeHtml(st.studentName)}</div>
                        <div class="text-[10px] text-slate-400 font-mono">ID: ${escapeHtml(st.studentId)}</div>
                    </td>
                    <td class="py-3 px-3">
                        <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-[#1c2836] text-slate-700 dark:text-slate-300">${escapeHtml(st.program)}</span>
                    </td>
                    <td class="py-3 px-3 font-mono text-slate-600 dark:text-slate-300">
                        ${escapeHtml(st.phone || '-')}
                    </td>
                    <td class="py-3 px-3 max-w-xs space-y-0.5">${rincianHtml}</td>
                    <td class="py-3 px-3 font-bold text-rose-600 dark:text-rose-400">
                        ${formatRupiah(st.totalTunggakan)}
                    </td>
                    <td class="py-3 px-3 text-right">${waBtn}</td>
                </tr>
            `;

            mobileHtml += `
                <div class="bg-white dark:bg-[#15202d] p-3.5 rounded-2xl border border-slate-100 dark:border-[#253447] shadow-xs space-y-2.5">
                    <div class="flex items-center justify-between">
                        <div>
                            <h4 class="font-bold text-xs text-slate-800 dark:text-slate-100">${escapeHtml(st.studentName)}</h4>
                            <span class="text-[10px] text-slate-400">${escapeHtml(st.program)} • ${escapeHtml(st.phone || 'Tanpa No. WA')}</span>
                        </div>
                        <div class="font-bold text-rose-600 dark:text-rose-400 text-xs">${formatRupiah(st.totalTunggakan)}</div>
                    </div>
                    <div class="p-2.5 bg-slate-50 dark:bg-[#182332] rounded-xl space-y-1 text-xs">
                        ${rincianHtml}
                    </div>
                    <div class="flex justify-end pt-1">
                        ${waBtn}
                    </div>
                </div>
            `;
        });

        if (tbody) tbody.innerHTML = desktopHtml;
        if (mobileContainer) mobileContainer.innerHTML = mobileHtml;

    } catch (e) {
        console.error("[LOAD BROADCAST ERROR]", e);
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-rose-500 text-xs">Gagal memuat broadcast: ${e.message}</td></tr>`;
    }
}
window.loadBroadcastTagihanData = loadBroadcastTagihanData;

// ====================================================================
// SUB-MODUL PORTAL TAGIHAN MANDIRI WALI SANTRI
// ====================================================================

let portalActiveStudent = null;
let portalSelectedTagihan = {};
let portalBuktiBase64 = '';

/**
 * Buka Modal Portal Tagihan Mandiri Wali Santri
 */
function openPortalWaliTagihanModal(targetStudentId) {
    const modal = document.getElementById('modal-portal-wali-tagihan');
    if (!modal) return;

    const students = ASNKeuangan.data.students || [];
    if (students.length === 0) {
        // Jika data santri belum ter-load di memori, trigger load
        loadAdminKeuanganData().then(() => openPortalWaliTagihanModal(targetStudentId));
        return;
    }

    let activeSt = null;
    if (targetStudentId) {
        activeSt = students.find(s => String(s.id).trim() === String(targetStudentId).trim());
    }

    // Fallback ke santri pertama jika belum dipilih
    if (!activeSt) {
        activeSt = students[0];
    }

    portalActiveStudent = activeSt;
    portalSelectedTagihan = {};
    portalBuktiBase64 = '';

    // Isi Header Modal
    const nameEl = document.getElementById('portal-wali-student-name');
    const infoEl = document.getElementById('portal-wali-student-info');
    if (nameEl) nameEl.innerText = activeSt.name;
    if (infoEl) infoEl.innerText = `ID: ${activeSt.id} • Program: ${activeSt.program || 'Santri Aktif'}`;

    // Selector jika banyak santri
    const selWrap = document.getElementById('portal-wali-student-selector-wrap');
    const selEl = document.getElementById('portal-wali-student-select');
    if (selWrap && selEl && students.length > 1) {
        selWrap.classList.remove('hidden');
        selEl.innerHTML = students.map(s => `<option value="${escapeHtml(s.id)}" ${s.id === activeSt.id ? 'selected' : ''}>${escapeHtml(s.name)} (${escapeHtml(s.program || 'Santri')})</option>`).join('');
    } else if (selWrap) {
        selWrap.classList.add('hidden');
    }

    // Render Checklist Tagihan Santri Aktif
    renderPortalWaliTagihanChecklist(activeSt.id);

    // Render Riwayat Kuitansi Santri Aktif
    renderPortalWaliRiwayatKuitansi(activeSt.id);

    // Reset Form Upload Bukti
    const fileInp = document.getElementById('portal-transfer-bukti-file');
    const prevWrap = document.getElementById('portal-bukti-preview-wrap');
    const senderInp = document.getElementById('portal-transfer-nama-pengirim');
    if (fileInp) fileInp.value = '';
    if (prevWrap) prevWrap.classList.add('hidden');
    if (senderInp) senderInp.value = '';

    switchPortalWaliTab('tagihan');
    modal.classList.remove('hidden');
}
window.openPortalWaliTagihanModal = openPortalWaliTagihanModal;

function closePortalWaliTagihanModal() {
    const modal = document.getElementById('modal-portal-wali-tagihan');
    if (modal) modal.classList.add('hidden');
}
window.closePortalWaliTagihanModal = closePortalWaliTagihanModal;

function onSelectPortalWaliStudent(studentId) {
    openPortalWaliTagihanModal(studentId);
}
window.onSelectPortalWaliStudent = onSelectPortalWaliStudent;

function switchPortalWaliTab(subTab) {
    const btnTagihan = document.getElementById('tab-portal-tagihan');
    const btnRiwayat = document.getElementById('tab-portal-riwayat');
    const viewTagihan = document.getElementById('portal-view-tagihan');
    const viewRiwayat = document.getElementById('portal-view-riwayat');
    const submitBtn = document.getElementById('btn-submit-portal-transfer');

    if (subTab === 'tagihan') {
        if (btnTagihan) btnTagihan.className = "px-3 py-1.5 rounded-xl font-bold transition bg-emerald-600 text-white text-xs";
        if (btnRiwayat) btnRiwayat.className = "px-3 py-1.5 rounded-xl font-bold transition text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1c2836] text-xs";
        if (viewTagihan) viewTagihan.classList.remove('hidden');
        if (viewRiwayat) viewRiwayat.classList.add('hidden');
        if (submitBtn) submitBtn.classList.remove('hidden');
    } else {
        if (btnRiwayat) btnRiwayat.className = "px-3 py-1.5 rounded-xl font-bold transition bg-emerald-600 text-white text-xs";
        if (btnTagihan) btnTagihan.className = "px-3 py-1.5 rounded-xl font-bold transition text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1c2836] text-xs";
        if (viewRiwayat) viewRiwayat.classList.remove('hidden');
        if (viewTagihan) viewTagihan.classList.add('hidden');
        if (submitBtn) submitBtn.classList.add('hidden');
    }
}
window.switchPortalWaliTab = switchPortalWaliTab;

function renderPortalWaliTagihanChecklist(studentId) {
    const container = document.getElementById('portal-tagihan-checklist-container');
    if (!container) return;

    const allTagihan = ASNKeuangan.data.tagihanList || [];
    const myTagihan = allTagihan.filter(t => String(t.studentId).trim() === String(studentId).trim() && String(t.status).toUpperCase() !== 'LUNAS');

    if (myTagihan.length === 0) {
        container.innerHTML = `<div class="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl text-center text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200/60"><i class="fa-solid fa-circle-check text-base mb-1 block"></i>Alhamdulillah! Tidak ada tunggakan tagihan untuk ananda saat ini.</div>`;
        updatePortalTotalDisplay();
        return;
    }

    portalSelectedTagihan = {};
    let html = '';
    myTagihan.forEach(t => {
        // Default: pilih semua tagihan yang belum lunas
        portalSelectedTagihan[t.tagihanId] = t.sisaTagihan;
        html += `
            <label class="p-3 bg-white dark:bg-[#1c2836] rounded-xl border border-slate-200 dark:border-[#253447] flex items-center justify-between gap-3 cursor-pointer hover:border-emerald-400 transition">
                <div class="flex items-center space-x-2.5">
                    <input type="checkbox" checked onchange="togglePortalTagihanItem('${escapeHtml(t.tagihanId)}', ${t.sisaTagihan}, this.checked)"
                        class="w-4 h-4 text-emerald-600 rounded-sm focus:ring-emerald-500 border-slate-300">
                    <div>
                        <div class="font-bold text-xs text-slate-800 dark:text-slate-100">${escapeHtml(t.namaPos)}</div>
                        <div class="text-[10px] text-slate-400">Periode: ${escapeHtml(t.periode || '-')}</div>
                    </div>
                </div>
                <div class="text-right">
                    <div class="font-bold text-xs text-rose-600 dark:text-rose-400">${formatRupiah(t.sisaTagihan)}</div>
                    <span class="text-[9px] text-slate-400 block">${t.nominalTerbayar > 0 ? 'Cicilan' : 'Belum Bayar'}</span>
                </div>
            </label>
        `;
    });

    container.innerHTML = html;
    updatePortalTotalDisplay();
}

function togglePortalTagihanItem(tagihanId, sisaNominal, isChecked) {
    if (isChecked) {
        portalSelectedTagihan[tagihanId] = sisaNominal;
    } else {
        delete portalSelectedTagihan[tagihanId];
    }
    updatePortalTotalDisplay();
}
window.togglePortalTagihanItem = togglePortalTagihanItem;

function selectAllPortalTagihan(selectAll) {
    const checkboxes = document.querySelectorAll('#portal-tagihan-checklist-container input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = selectAll;
        cb.dispatchEvent(new Event('change'));
    });
}
window.selectAllPortalTagihan = selectAllPortalTagihan;

function updatePortalTotalDisplay() {
    const totalEl = document.getElementById('portal-total-bayar-display');
    const countEl = document.getElementById('portal-item-count-display');
    const keys = Object.keys(portalSelectedTagihan);
    const sum = keys.reduce((acc, k) => acc + (Number(portalSelectedTagihan[k]) || 0), 0);

    if (totalEl) totalEl.innerText = formatRupiah(sum);
    if (countEl) countEl.innerText = `${keys.length} pos dipilih`;
}

function renderPortalWaliRiwayatKuitansi(studentId) {
    const container = document.getElementById('portal-riwayat-transaksi-list');
    if (!container) return;

    const allTrx = ASNKeuangan.data.recentTransactions || [];
    const myTrx = allTrx.filter(t => String(t.studentId).trim() === String(studentId).trim());

    if (myTrx.length === 0) {
        container.innerHTML = `<div class="p-6 bg-slate-50 dark:bg-[#1c2836] rounded-xl text-center text-slate-400 text-xs">Belum ada riwayat transaksi pembayaran kasir.</div>`;
        return;
    }

    container.innerHTML = myTrx.map(trx => `
        <div class="p-3 bg-white dark:bg-[#1c2836] rounded-xl border border-slate-200 dark:border-[#253447] flex items-center justify-between gap-3">
            <div>
                <span class="font-mono text-[10px] font-bold text-emerald-600 block">${escapeHtml(trx.noKuitansi)}</span>
                <h5 class="font-bold text-xs text-slate-800 dark:text-slate-100">${escapeHtml(trx.studentName)}</h5>
                <span class="text-[10px] text-slate-400">${escapeHtml(trx.tanggalBayar)} • ${escapeHtml(trx.metodeBayar)}</span>
            </div>
            <div class="text-right flex flex-col items-end space-y-1">
                <div class="font-bold text-xs text-emerald-600 dark:text-emerald-400">${formatRupiah(trx.nominalTotal)}</div>
                <button type="button" onclick="openKuitansiModal(${JSON.stringify(trx).replace(/"/g, '&quot;')})"
                    class="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-lg text-[10px] font-bold transition flex items-center gap-1">
                    <i class="fa-solid fa-receipt text-xs"></i>
                    <span>Kuitansi</span>
                </button>
            </div>
        </div>
    `).join('');
}

function copyRekeningNumber(rek) {
    if (!rek) return;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(rek);
        if (typeof showToast === 'function') showToast(`✅ Nomor rekening ${rek} berhasil disalin.`);
        else alert(`Nomor rekening ${rek} berhasil disalin.`);
    } else {
        prompt("Salin nomor rekening:", rek);
    }
}
window.copyRekeningNumber = copyRekeningNumber;

function onPortalBuktiFileSelected(input) {
    const file = input && input.files && input.files[0];
    const previewWrap = document.getElementById('portal-bukti-preview-wrap');
    const previewImg = document.getElementById('portal-bukti-img-preview');

    if (!file) {
        portalBuktiBase64 = '';
        if (previewWrap) previewWrap.classList.add('hidden');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        portalBuktiBase64 = e.target.result;
        if (previewImg) previewImg.src = portalBuktiBase64;
        if (previewWrap) previewWrap.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}
window.onPortalBuktiFileSelected = onPortalBuktiFileSelected;

async function submitPortalWaliTransfer() {
    if (!portalActiveStudent) {
        alert("Pilih data santri terlebih dahulu.");
        return;
    }

    const tagihanIds = Object.keys(portalSelectedTagihan);
    const nominalTotal = tagihanIds.reduce((acc, k) => acc + (Number(portalSelectedTagihan[k]) || 0), 0);

    if (nominalTotal <= 0 || tagihanIds.length === 0) {
        alert("Silakan pilih minimal 1 pos tagihan yang akan dibayar.");
        return;
    }

    const bankTujuan = document.getElementById('portal-transfer-bank-tujuan')?.value || 'BSI';
    const namaPengirim = document.getElementById('portal-transfer-nama-pengirim')?.value.trim();

    if (!namaPengirim) {
        alert("Nama pemilik rekening pengirim wajib diisi agar bendahara mudah memverifikasi.");
        document.getElementById('portal-transfer-nama-pengirim')?.focus();
        return;
    }

    if (!portalBuktiBase64) {
        alert("Silakan unggah foto bukti transfer (screenshot transfer / struk ATM).");
        return;
    }

    const submitBtn = document.getElementById('btn-submit-portal-transfer');
    let origText = '';
    if (submitBtn) {
        origText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Mengirim...';
    }

    try {
        const payload = {
            studentId: portalActiveStudent.id,
            studentName: portalActiveStudent.name,
            tagihanIds: tagihanIds,
            nominalTransfer: nominalTotal,
            bankTujuan: bankTujuan,
            namaPengirim: namaPengirim,
            tanggalTransfer: new Date().toISOString().substring(0, 10),
            buktiTransferUrl: portalBuktiBase64
        };

        const res = await apiPost("keuangan.submitKonfirmasiTransfer", payload);
        if (res && res.success) {
            alert(`Alhamdulillah! ${res.message}\nBendahara pesantren akan memverifikasi mutasi bank dan menerbitkan kuitansi resmi.`);
            closePortalWaliTagihanModal();
            loadAdminKeuanganData(true);
        } else {
            alert("Gagal mengirim konfirmasi transfer: " + ((res && res.message) || "Terjadi kesalahan"));
        }
    } catch (e) {
        console.error("[SUBMIT PORTAL TRANSFER ERROR]", e);
        alert("Error: " + e.message);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = origText;
        }
    }
}
window.submitPortalWaliTransfer = submitPortalWaliTransfer;

// ====================================================================
// FASE 4: SMART PESANTREN, TABUNGAN UANG SAKU, CASHLESS & ANALYTICS
// ====================================================================

let ASNTabunganData = {
    summary: {},
    accounts: [],
    recentMutasi: []
};

let kantinActiveStudent = null;

/**
 * Muat Data Dashboard Tabungan & Uang Saku Santri
 */
async function loadTabunganDashboardData(forceRefresh) {
    const tbody = document.getElementById('keuangan-tabungan-table-body');
    const mobileContainer = document.getElementById('keuangan-tabungan-mobile-list');
    const mutasiTbody = document.getElementById('keuangan-tabungan-mutasi-table-body');

    if (tbody && (!ASNTabunganData.accounts || ASNTabunganData.accounts.length === 0)) {
        tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-slate-400 text-xs"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Memuat rekening tabungan santri...</td></tr>`;
    }

    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : null) || "";
        const res = await apiPost("keuangan.getTabunganDashboard", { token });

        if (res && res.success) {
            ASNTabunganData = res;
            renderTabunganDashboard(res);
            if (forceRefresh && typeof showToast === 'function') {
                showToast("✅ Data Tabungan Santri berhasil diperbarui.");
            }
        } else {
            console.warn("Gagal memuat data tabungan:", res);
        }
    } catch (e) {
        console.error("[LOAD TABUNGAN ERROR]", e);
        if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="py-6 text-center text-rose-500 text-xs">Gagal memuat tabungan: ${e.message}</td></tr>`;
    }
}
window.loadTabunganDashboardData = loadTabunganDashboardData;

/**
 * Render Kartu Statistik dan Tabel Tabungan Santri
 */
function renderTabunganDashboard(data) {
    const sum = data.summary || {};
    const accounts = data.accounts || [];
    const mutasi = data.recentMutasi || [];

    // 1. Update 4 Stat Cards
    const elSaldo = document.getElementById('tabungan-stat-total-saldo');
    const elTopup = document.getElementById('tabungan-stat-total-topup');
    const elJajan = document.getElementById('tabungan-stat-total-jajan');
    const elTarik = document.getElementById('tabungan-stat-total-tarik');

    if (elSaldo) elSaldo.innerText = formatRupiah(sum.totalSaldoMengendap || 0);
    if (elTopup) elTopup.innerText = formatRupiah(sum.totalTopupBulanIni || 0);
    if (elJajan) elJajan.innerText = formatRupiah(sum.totalJajanBulanIni || 0);
    if (elTarik) elTarik.innerText = formatRupiah(sum.totalTarikBulanIni || 0);

    // 2. Render Tabel Rekening Santri (Desktop & Mobile)
    renderTabunganAccountsTable(accounts);

    // 3. Render Log Mutasi
    const mutasiTbody = document.getElementById('keuangan-tabungan-mutasi-table-body');
    if (mutasiTbody) {
        if (mutasi.length === 0) {
            mutasiTbody.innerHTML = `<tr><td colspan="7" class="py-4 text-center text-slate-400 text-xs">Belum ada riwayat mutasi uang saku.</td></tr>`;
        } else {
            mutasiTbody.innerHTML = mutasi.map(m => {
                let badgeClass = "bg-slate-100 text-slate-700";
                let sign = "+";
                let nomColor = "text-emerald-600";

                if (m.jenisMutasi === "TOPUP") {
                    badgeClass = "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
                    sign = "+";
                    nomColor = "text-emerald-600 dark:text-emerald-400";
                } else if (m.jenisMutasi === "JAJAN_KANTIN") {
                    badgeClass = "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300";
                    sign = "-";
                    nomColor = "text-indigo-600 dark:text-indigo-400";
                } else if (m.jenisMutasi === "TARIK_TUNAI") {
                    badgeClass = "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
                    sign = "-";
                    nomColor = "text-amber-600 dark:text-amber-400";
                }

                return `
                    <tr class="border-b border-slate-100 dark:border-[#253447] hover:bg-slate-50/50 dark:hover:bg-[#182332]">
                        <td class="py-2.5 px-2 font-mono text-[10px] font-bold text-slate-500">${escapeHtml(m.mutasiId)}</td>
                        <td class="py-2.5 px-2 font-bold text-slate-800 dark:text-slate-100">${escapeHtml(m.studentName)}</td>
                        <td class="py-2.5 px-2"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${badgeClass}">${escapeHtml(m.jenisMutasi)}</span></td>
                        <td class="py-2.5 px-2 font-bold ${nomColor}">${sign}${formatRupiah(m.nominal)}</td>
                        <td class="py-2.5 px-2 font-bold text-slate-700 dark:text-slate-300">${formatRupiah(m.saldoSesudah)}</td>
                        <td class="py-2.5 px-2 text-slate-500 text-[11px] truncate max-w-xs" title="${escapeHtml(m.keterangan)}">${escapeHtml(m.keterangan)}</td>
                        <td class="py-2.5 px-2 text-right text-[10px] text-slate-400">${escapeHtml(m.createdAt.substring(0, 16).replace("T", " "))}</td>
                    </tr>
                `;
            }).join('');
        }
    }
}

function renderTabunganAccountsTable(accounts) {
    const tbody = document.getElementById('keuangan-tabungan-table-body');
    const mobileContainer = document.getElementById('keuangan-tabungan-mobile-list');

    if (!tbody && !mobileContainer) return;

    if (!accounts || accounts.length === 0) {
        const emptyMsg = `<tr><td colspan="8" class="py-6 text-center text-slate-400 text-xs">Belum ada akun tabungan santri.</td></tr>`;
        if (tbody) tbody.innerHTML = emptyMsg;
        if (mobileContainer) mobileContainer.innerHTML = `<div class="p-6 bg-white dark:bg-[#15202d] rounded-2xl text-center text-slate-400 text-xs border border-slate-100 dark:border-[#253447]">Belum ada akun tabungan santri.</div>`;
        return;
    }

    let desktopHtml = '';
    let mobileHtml = '';

    accounts.forEach((acc, idx) => {
        const isLocked = acc.isLocked;
        const lockBadge = isLocked ? `
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200">
                <i class="fa-solid fa-lock mr-1"></i>Dibekukan
            </span>
        ` : `
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200">
                <i class="fa-solid fa-check mr-1"></i>Aktif
            </span>
        `;

        const sisaLimit = Math.max(0, acc.limitHarian - acc.totalJajanHariIni);

        desktopHtml += `
            <tr class="border-b border-slate-100 dark:border-[#253447] hover:bg-slate-50/50 dark:hover:bg-[#182332] transition">
                <td class="py-3 px-3 text-center text-slate-400 font-medium">${idx + 1}</td>
                <td class="py-3 px-3">
                    <div class="font-bold text-slate-800 dark:text-slate-100">${escapeHtml(acc.studentName)}</div>
                    <div class="text-[10px] text-slate-400 font-mono">ID: ${escapeHtml(acc.studentId)}</div>
                </td>
                <td class="py-3 px-3">
                    <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-[#1c2836] text-slate-700 dark:text-slate-300">${escapeHtml(acc.program)}</span>
                </td>
                <td class="py-3 px-3 font-black text-emerald-600 dark:text-emerald-400 text-xs">
                    ${formatRupiah(acc.saldoTabungan)}
                </td>
                <td class="py-3 px-3 font-semibold text-slate-700 dark:text-slate-200">
                    ${acc.limitHarian > 0 ? formatRupiah(acc.limitHarian) : '<span class="text-slate-400">Tanpa Limit</span>'}
                </td>
                <td class="py-3 px-3">
                    <div class="font-bold text-slate-700 dark:text-slate-200">${formatRupiah(acc.totalJajanHariIni)}</div>
                    <span class="text-[9px] text-slate-400">Sisa limit: ${formatRupiah(sisaLimit)}</span>
                </td>
                <td class="py-3 px-3 text-center">${lockBadge}</td>
                <td class="py-3 px-3 text-right">
                    <div class="flex items-center justify-end space-x-1.5">
                        <button type="button" onclick="openModalTopupTabungan('${escapeHtml(acc.studentId)}')"
                            class="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-lg text-[10px] font-bold transition flex items-center gap-1" title="Topup">
                            <i class="fa-solid fa-plus"></i> Setor
                        </button>
                        <button type="button" onclick="openModalTarikTabungan('${escapeHtml(acc.studentId)}')"
                            class="px-2 py-1 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 rounded-lg text-[10px] font-bold transition flex items-center gap-1" title="Tarik">
                            <i class="fa-solid fa-minus"></i> Tarik
                        </button>
                        <button type="button" onclick="openModalSetLimitTabungan('${escapeHtml(acc.studentId)}', ${acc.limitHarian}, ${isLocked})"
                            class="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-[#1c2836] text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold transition" title="Atur Limit / Kunci">
                            <i class="fa-solid fa-gear"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;

        mobileHtml += `
            <div class="bg-white dark:bg-[#15202d] p-3.5 rounded-2xl border border-slate-100 dark:border-[#253447] shadow-xs space-y-2.5">
                <div class="flex items-center justify-between">
                    <div>
                        <h4 class="font-bold text-xs text-slate-800 dark:text-slate-100">${escapeHtml(acc.studentName)}</h4>
                        <span class="text-[10px] text-slate-400 font-mono">${escapeHtml(acc.studentId)} • ${escapeHtml(acc.program)}</span>
                    </div>
                    <div>${lockBadge}</div>
                </div>
                <div class="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-[#253447]">
                    <div>
                        <span class="text-[9px] text-slate-400 block">Saldo Uang Saku</span>
                        <div class="font-black text-emerald-600 dark:text-emerald-400 text-sm">${formatRupiah(acc.saldoTabungan)}</div>
                    </div>
                    <div class="text-right">
                        <span class="text-[9px] text-slate-400 block">Jajan Hari Ini</span>
                        <div class="font-bold text-slate-700 dark:text-slate-200">${formatRupiah(acc.totalJajanHariIni)}</div>
                    </div>
                </div>
                <div class="flex items-center justify-end space-x-1.5 pt-1 border-t border-slate-100 dark:border-[#253447]">
                    <button type="button" onclick="openModalTopupTabungan('${escapeHtml(acc.studentId)}')"
                        class="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[11px] font-bold">Setor</button>
                    <button type="button" onclick="openModalTarikTabungan('${escapeHtml(acc.studentId)}')"
                        class="px-2.5 py-1 bg-amber-600 text-white rounded-lg text-[11px] font-bold">Tarik</button>
                    <button type="button" onclick="openModalSetLimitTabungan('${escapeHtml(acc.studentId)}', ${acc.limitHarian}, ${isLocked})"
                        class="px-2.5 py-1 bg-slate-100 dark:bg-[#1c2836] text-slate-600 dark:text-slate-300 rounded-lg text-[11px] font-bold">Limit</button>
                </div>
            </div>
        `;
    });

    if (tbody) tbody.innerHTML = desktopHtml;
    if (mobileContainer) mobileContainer.innerHTML = mobileHtml;
}

function filterTabunganSantriTable(query) {
    const q = String(query || "").trim().toLowerCase();
    const all = ASNTabunganData.accounts || [];
    if (!q) {
        renderTabunganAccountsTable(all);
        return;
    }
    const filtered = all.filter(a =>
        a.studentName.toLowerCase().includes(q) ||
        a.studentId.toLowerCase().includes(q) ||
        (a.program && a.program.toLowerCase().includes(q))
    );
    renderTabunganAccountsTable(filtered);
}
window.filterTabunganSantriTable = filterTabunganSantriTable;

// ==================== MODAL TOPUP TABUNGAN ====================

function openModalTopupTabungan(defaultStudentId) {
    const modal = document.getElementById('modal-topup-tabungan');
    const select = document.getElementById('topup-input-student');
    const nominalInp = document.getElementById('topup-input-nominal');
    const catatanInp = document.getElementById('topup-input-catatan');

    if (!modal || !select) return;

    const accounts = ASNTabunganData.accounts || [];
    select.innerHTML = accounts.map(a => `
        <option value="${escapeHtml(a.studentId)}" ${a.studentId === defaultStudentId ? 'selected' : ''}>
            ${escapeHtml(a.studentName)} (${escapeHtml(a.studentId)}) - Saldo: ${formatRupiah(a.saldoTabungan)}
        </option>
    `).join('');

    if (defaultStudentId) {
        select.value = defaultStudentId;
    }

    onTopupStudentSelected(select.value);
    if (nominalInp) nominalInp.value = '';
    if (catatanInp) catatanInp.value = '';

    modal.classList.remove('hidden');
}
window.openModalTopupTabungan = openModalTopupTabungan;

function closeModalTopupTabungan() {
    const modal = document.getElementById('modal-topup-tabungan');
    if (modal) modal.classList.add('hidden');
}
window.closeModalTopupTabungan = closeModalTopupTabungan;

function onTopupStudentSelected(studentId) {
    const el = document.getElementById('topup-student-current-saldo');
    if (!el) return;
    const acc = (ASNTabunganData.accounts || []).find(a => a.studentId === studentId);
    if (acc) {
        el.innerText = `Saldo saat ini: ${formatRupiah(acc.saldoTabungan)}`;
    } else {
        el.innerText = 'Saldo saat ini: Rp 0';
    }
}
window.onTopupStudentSelected = onTopupStudentSelected;

async function submitTopupTabungan() {
    const studentId = document.getElementById('topup-input-student')?.value;
    const nominal = Number(document.getElementById('topup-input-nominal')?.value) || 0;
    const metode = document.getElementById('topup-input-metode')?.value || 'TUNAI';
    const catatan = document.getElementById('topup-input-catatan')?.value.trim();

    if (!studentId) {
        alert("Pilih santri terlebih dahulu.");
        return;
    }
    if (nominal <= 0) {
        alert("Masukkan nominal topup yang valid (minimal Rp 5.000).");
        return;
    }

    const btn = document.getElementById('btn-submit-topup-tabungan');
    let origText = '';
    if (btn) {
        origText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Menyimpan...';
    }

    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : null) || "";
        const res = await apiPost("keuangan.topupTabungan", {
            token: token,
            studentId: studentId,
            nominalTopup: nominal,
            metodeBayar: metode,
            catatan: catatan
        });

        if (res && res.success) {
            if (typeof showToast === 'function') showToast(`✅ ${res.message}`);
            else alert(res.message);
            closeModalTopupTabungan();
            loadTabunganDashboardData(true);
        } else {
            alert("Gagal topup: " + ((res && res.message) || "Terjadi kesalahan"));
        }
    } catch (e) {
        console.error("[SUBMIT TOPUP ERROR]", e);
        alert("Error: " + e.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origText;
        }
    }
}
window.submitTopupTabungan = submitTopupTabungan;

// ==================== MODAL TARIK TABUNGAN ====================

function openModalTarikTabungan(defaultStudentId) {
    const modal = document.getElementById('modal-tarik-tabungan');
    const select = document.getElementById('tarik-input-student');
    const nominalInp = document.getElementById('tarik-input-nominal');
    const keperluanInp = document.getElementById('tarik-input-keperluan');

    if (!modal || !select) return;

    const accounts = ASNTabunganData.accounts || [];
    select.innerHTML = accounts.map(a => `
        <option value="${escapeHtml(a.studentId)}" ${a.studentId === defaultStudentId ? 'selected' : ''}>
            ${escapeHtml(a.studentName)} (${escapeHtml(a.studentId)}) - Saldo: ${formatRupiah(a.saldoTabungan)}
        </option>
    `).join('');

    if (defaultStudentId) {
        select.value = defaultStudentId;
    }

    onTarikStudentSelected(select.value);
    if (nominalInp) nominalInp.value = '';
    if (keperluanInp) keperluanInp.value = '';

    modal.classList.remove('hidden');
}
window.openModalTarikTabungan = openModalTarikTabungan;

function closeModalTarikTabungan() {
    const modal = document.getElementById('modal-tarik-tabungan');
    if (modal) modal.classList.add('hidden');
}
window.closeModalTarikTabungan = closeModalTarikTabungan;

function onTarikStudentSelected(studentId) {
    const el = document.getElementById('tarik-student-current-saldo');
    if (!el) return;
    const acc = (ASNTabunganData.accounts || []).find(a => a.studentId === studentId);
    if (acc) {
        el.innerText = `Saldo saat ini: ${formatRupiah(acc.saldoTabungan)}`;
    } else {
        el.innerText = 'Saldo saat ini: Rp 0';
    }
}
window.onTarikStudentSelected = onTarikStudentSelected;

async function submitTarikTabungan() {
    const studentId = document.getElementById('tarik-input-student')?.value;
    const nominal = Number(document.getElementById('tarik-input-nominal')?.value) || 0;
    const keperluan = document.getElementById('tarik-input-keperluan')?.value.trim();

    if (!studentId) {
        alert("Pilih santri terlebih dahulu.");
        return;
    }
    if (nominal <= 0) {
        alert("Masukkan nominal penarikan yang valid.");
        return;
    }
    if (!keperluan) {
        alert("Tuliskan keperluan penarikan uang saku santri.");
        return;
    }

    const btn = document.getElementById('btn-submit-tarik-tabungan');
    let origText = '';
    if (btn) {
        origText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Memproses...';
    }

    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : null) || "";
        const res = await apiPost("keuangan.tarikTabungan", {
            token: token,
            studentId: studentId,
            nominalTarik: nominal,
            keperluan: keperluan
        });

        if (res && res.success) {
            if (typeof showToast === 'function') showToast(`✅ ${res.message}`);
            else alert(res.message);
            closeModalTarikTabungan();
            loadTabunganDashboardData(true);
        } else {
            alert("Gagal penarikan: " + ((res && res.message) || "Terjadi kesalahan"));
        }
    } catch (e) {
        console.error("[SUBMIT TARIK ERROR]", e);
        alert("Error: " + e.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origText;
        }
    }
}
window.submitTarikTabungan = submitTarikTabungan;

// ==================== MODAL SET LIMIT & KUNCI KARTU ====================

function openModalSetLimitTabungan(studentId, currentLimit, isLocked) {
    const modal = document.getElementById('modal-set-limit-tabungan');
    const idInp = document.getElementById('set-limit-student-id');
    const sub = document.getElementById('set-limit-modal-subtitle');
    const limitInp = document.getElementById('set-limit-input-nominal');
    const lockedInp = document.getElementById('set-limit-input-locked');

    if (!modal) return;

    const acc = (ASNTabunganData.accounts || []).find(a => a.studentId === studentId);
    if (idInp) idInp.value = studentId;
    if (sub) sub.innerText = `Santri: ${acc ? acc.studentName : studentId}`;
    if (limitInp) limitInp.value = currentLimit !== undefined ? currentLimit : 25000;
    if (lockedInp) lockedInp.checked = !!isLocked;

    modal.classList.remove('hidden');
}
window.openModalSetLimitTabungan = openModalSetLimitTabungan;

function closeModalSetLimitTabungan() {
    const modal = document.getElementById('modal-set-limit-tabungan');
    if (modal) modal.classList.add('hidden');
}
window.closeModalSetLimitTabungan = closeModalSetLimitTabungan;

async function submitUpdateLimitTabungan() {
    const studentId = document.getElementById('set-limit-student-id')?.value;
    const limitHarian = Number(document.getElementById('set-limit-input-nominal')?.value);
    const isLocked = document.getElementById('set-limit-input-locked')?.checked;

    if (!studentId) return;

    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : null) || "";
        const res = await apiPost("keuangan.updateLimitTabungan", {
            token: token,
            studentId: studentId,
            limitHarian: limitHarian,
            isLocked: isLocked
        });

        if (res && res.success) {
            if (typeof showToast === 'function') showToast("✅ Pengaturan kartu uang saku berhasil disimpan.");
            closeModalSetLimitTabungan();
            loadTabunganDashboardData(true);
        } else {
            alert("Gagal memperbarui limit: " + ((res && res.message) || "Terjadi kesalahan"));
        }
    } catch (e) {
        console.error("[SUBMIT UPDATE LIMIT ERROR]", e);
        alert("Error: " + e.message);
    }
}
window.submitUpdateLimitTabungan = submitUpdateLimitTabungan;

// ====================================================================
// SUB-MODUL POS KANTIN & KOPERASI CASHLESS
// ====================================================================

function initKantinCashlessPOS() {
    if (!ASNTabunganData.accounts || ASNTabunganData.accounts.length === 0) {
        loadTabunganDashboardData();
    }
    const input = document.getElementById('kantin-search-student-input');
    if (input) setTimeout(() => input.focus(), 150);
}
window.initKantinCashlessPOS = initKantinCashlessPOS;

function onKantinStudentSearch(query) {
    const q = String(query || "").trim().toLowerCase();
    const dropdown = document.getElementById('kantin-search-results');
    if (!dropdown) return;

    if (!q) {
        dropdown.classList.add('hidden');
        dropdown.innerHTML = '';
        return;
    }

    const accounts = ASNTabunganData.accounts || [];
    const matched = accounts.filter(a =>
        a.studentName.toLowerCase().includes(q) ||
        a.studentId.toLowerCase().includes(q)
    ).slice(0, 10);

    if (matched.length === 0) {
        dropdown.innerHTML = `<div class="p-3 text-center text-slate-400 text-xs">Santri tidak ditemukan.</div>`;
        dropdown.classList.remove('hidden');
        return;
    }

    dropdown.innerHTML = matched.map(a => `
        <div onclick="selectKantinStudent('${escapeHtml(a.studentId)}')"
            class="p-2.5 hover:bg-slate-50 dark:hover:bg-[#1a2533] cursor-pointer flex items-center justify-between">
            <div>
                <div class="font-bold text-slate-800 dark:text-slate-100">${escapeHtml(a.studentName)}</div>
                <div class="text-[10px] text-slate-400 font-mono">ID: ${escapeHtml(a.studentId)} • ${escapeHtml(a.program)}</div>
            </div>
            <div class="text-right">
                <span class="font-black text-emerald-600 text-xs">${formatRupiah(a.saldoTabungan)}</span>
                <span class="text-[9px] text-slate-400 block">${a.isLocked ? '🔒 Dikunci' : '✅ Aktif'}</span>
            </div>
        </div>
    `).join('');
    dropdown.classList.remove('hidden');
}
window.onKantinStudentSearch = onKantinStudentSearch;

function selectKantinStudent(studentId) {
    const dropdown = document.getElementById('kantin-search-results');
    const input = document.getElementById('kantin-search-student-input');
    if (dropdown) dropdown.classList.add('hidden');

    const acc = (ASNTabunganData.accounts || []).find(a => a.studentId === studentId);
    if (!acc) return;

    kantinActiveStudent = acc;
    if (input) input.value = `${acc.studentName} (${acc.studentId})`;

    // Update Visual Kartu
    const nameEl = document.getElementById('kantin-card-student-name');
    const infoEl = document.getElementById('kantin-card-student-info');
    const saldoEl = document.getElementById('kantin-card-student-saldo');
    const limitEl = document.getElementById('kantin-card-student-limit');

    if (nameEl) nameEl.innerText = acc.studentName;
    if (infoEl) infoEl.innerText = `NIS: ${acc.studentId} • Program: ${acc.program || 'Santri Aktif'}`;
    if (saldoEl) saldoEl.innerText = formatRupiah(acc.saldoTabungan);

    const sisaLimit = Math.max(0, acc.limitHarian - acc.totalJajanHariIni);
    if (limitEl) limitEl.innerText = acc.limitHarian > 0 ? formatRupiah(sisaLimit) : 'Tanpa Limit';

    // Focus ke nominal
    document.getElementById('kantin-input-nominal')?.focus();
}
window.selectKantinStudent = selectKantinStudent;

function setKantinNominal(nom) {
    const inp = document.getElementById('kantin-input-nominal');
    if (inp) {
        inp.value = nom;
        inp.focus();
    }
}
window.setKantinNominal = setKantinNominal;

async function submitKantinCashlessTransaction() {
    if (!kantinActiveStudent) {
        alert("Pilih atau scan kartu santri terlebih dahulu.");
        document.getElementById('kantin-search-student-input')?.focus();
        return;
    }

    const nominal = Number(document.getElementById('kantin-input-nominal')?.value) || 0;
    const namaBarang = document.getElementById('kantin-input-keterangan')?.value.trim() || 'Jajan Kantin';

    if (nominal <= 0) {
        alert("Masukkan nominal belanja yang valid.");
        document.getElementById('kantin-input-nominal')?.focus();
        return;
    }

    if (!confirm(`Konfirmasi Belanja Cashless:\nSantri: ${kantinActiveStudent.studentName}\nNominal: Rp ${nominal.toLocaleString("id-ID")}\nKeterangan: ${namaBarang}\n\nPotong saldo kartu santri sekarang?`)) {
        return;
    }

    const btn = document.getElementById('btn-submit-kantin-cashless');
    let origText = '';
    if (btn) {
        origText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Memproses Cashless...';
    }

    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : null) || "";
        const res = await apiPost("keuangan.transaksiKantin", {
            token: token,
            studentId: kantinActiveStudent.studentId,
            nominalBelanja: nominal,
            namaBarang: namaBarang
        });

        if (res && res.success) {
            alert(`✅ Transaksi Berhasil!\n${res.message}\nSisa kuota jajan hari ini: ${formatRupiah(res.sisaLimitHariIni)}.`);
            
            // Reset Form Belanja
            document.getElementById('kantin-input-nominal').value = '';
            document.getElementById('kantin-input-keterangan').value = '';

            // Update Kartu
            kantinActiveStudent.saldoTabungan = res.sisaSaldo;
            selectKantinStudent(kantinActiveStudent.studentId);

            // Refresh Background
            loadTabunganDashboardData(false);
        } else {
            alert("Transaksi Gagal: " + ((res && res.message) || "Terjadi kesalahan"));
        }
    } catch (e) {
        console.error("[SUBMIT KANTIN TRANSACTION ERROR]", e);
        alert("Error: " + e.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origText;
        }
    }
}
window.submitKantinCashlessTransaction = submitKantinCashlessTransaction;

// ====================================================================
// SUB-MODUL EXECUTIVE FINANCIAL ANALYTICS
// ====================================================================

async function loadExecutiveAnalyticsData() {
    try {
        if (typeof showToast === 'function') showToast("⏳ Mengkalkulasi analitik keuangan pesantren...");
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : null) || "";
        const res = await apiPost("keuangan.getExecutiveAnalytics", { token });

        if (res && res.success) {
            renderExecutiveAnalytics(res);
            if (typeof showToast === 'function') showToast("✅ Analitik eksekutif berhasil dimuat.");
        } else {
            alert("Gagal memuat analitik: " + ((res && res.message) || "Terjadi kesalahan"));
        }
    } catch (e) {
        console.error("[LOAD EXECUTIVE ANALYTICS ERROR]", e);
        alert("Error: " + e.message);
    }
}
window.loadExecutiveAnalyticsData = loadExecutiveAnalyticsData;

function renderExecutiveAnalytics(data) {
    const health = data.financialHealth || {};
    const aging = data.agingPiutang || {};
    const kat = aging.kategori || {};

    // 1. KPI Cards
    const elFlow = document.getElementById('analytics-stat-net-flow');
    const elRate = document.getElementById('analytics-stat-collection-rate');
    const elRunway = document.getElementById('analytics-stat-runway');
    const elTab = document.getElementById('analytics-stat-tabungan');

    if (elFlow) {
        const net = Number(health.surplusDefisit) || 0;
        if (net >= 0) {
            elFlow.innerText = `+${formatRupiah(net)}`;
            elFlow.className = "text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5";
        } else {
            elFlow.innerText = `-${formatRupiah(Math.abs(net))}`;
            elFlow.className = "text-sm sm:text-base font-black text-rose-600 dark:text-rose-400 mt-0.5";
        }
    }

    if (elRate) elRate.innerText = `${health.collectionRate || 100}%`;
    if (elRunway) elRunway.innerText = `${health.runwayBulan} Bulan`;
    if (elTab) elTab.innerText = formatRupiah(health.totalDanaTabunganMengendap || 0);

    // 2. Aging Piutang
    const elTotPiutang = document.getElementById('analytics-aging-total-piutang');
    if (elTotPiutang) elTotPiutang.innerText = formatRupiah(aging.totalPiutang || 0);

    const l = kat.lancar || { count: 0, nominal: 0 };
    const p = kat.perhatian || { count: 0, nominal: 0 };
    const kl = kat.kurangLancar || { count: 0, nominal: 0 };
    const m = kat.macet || { count: 0, nominal: 0 };

    const cLancar = document.getElementById('aging-count-lancar');
    const nLancar = document.getElementById('aging-nom-lancar');
    if (cLancar) cLancar.innerText = `${l.count} Tagihan`;
    if (nLancar) nLancar.innerText = formatRupiah(l.nominal);

    const cPerhatian = document.getElementById('aging-count-perhatian');
    const nPerhatian = document.getElementById('aging-nom-perhatian');
    if (cPerhatian) cPerhatian.innerText = `${p.count} Tagihan`;
    if (nPerhatian) nPerhatian.innerText = formatRupiah(p.nominal);

    const cKurang = document.getElementById('aging-count-kurang-lancar');
    const nKurang = document.getElementById('aging-nom-kurang-lancar');
    if (cKurang) cKurang.innerText = `${kl.count} Tagihan`;
    if (nKurang) nKurang.innerText = formatRupiah(kl.nominal);

    const cMacet = document.getElementById('aging-count-macet');
    const nMacet = document.getElementById('aging-nom-macet');
    if (cMacet) cMacet.innerText = `${m.count} Tagihan`;
    if (nMacet) nMacet.innerText = formatRupiah(m.nominal);
}
window.renderExecutiveAnalytics = renderExecutiveAnalytics;

