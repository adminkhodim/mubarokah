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

/**
 * Muat data lengkap dashboard Keuangan dengan pola SWR (Stale-While-Revalidate)
 */
async function loadAdminKeuanganData(forceRefresh = false) {
    const loader = document.getElementById('admin-keuangan-loader');
    const refreshIcon = document.getElementById('btn-refresh-keuangan-icon');

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
            filterKeuanganTagihan();
            renderKeuanganTransaksiTable();
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
                filterKeuanganTagihan();
                renderKeuanganTransaksiTable();

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
 * Render Kartu Statistik Ringkasan Keuangan
 */
function renderKeuanganSummaryCards() {
    const sum = ASNKeuangan.data.summary || {};
    const elPendapatan = document.getElementById('keuangan-stat-pendapatan');
    const elTunggakan = document.getElementById('keuangan-stat-tunggakan');
    const elLunas = document.getElementById('keuangan-stat-lunas');
    const elPersen = document.getElementById('keuangan-stat-persentase');

    if (elPendapatan) elPendapatan.innerText = formatRupiah(sum.totalPendapatanBulanIni || 0);
    if (elTunggakan) elTunggakan.innerText = formatRupiah(sum.totalTunggakan || 0);
    if (elLunas) elLunas.innerText = `${sum.countLunas || 0} Lunas / ${sum.countBelumLunas || 0} Tertunggak`;
    if (elPersen) elPersen.innerText = `${sum.persentasePelunasan || 100}%`;
}
window.renderKeuanganSummaryCards = renderKeuanganSummaryCards;

/**
 * Berpindah Tab Utama di Modul Keuangan:
 * - 'pos'       : Kasir Cepat
 * - 'tagihan'   : Daftar Tagihan & Piutang Santri
 * - 'transaksi' : Buku Kas & Kuitansi
 * - 'tarif'     : Master Tarif Biaya
 */
function switchKeuanganTab(tabName) {
    ASNKeuangan.activeTab = tabName;

    const tabs = ['pos', 'tagihan', 'transaksi', 'tarif'];
    tabs.forEach(t => {
        const btn = document.getElementById(`tab-btn-keuangan-${t}`);
        const view = document.getElementById(`keuangan-panel-${t}`);
        if (btn) {
            if (t === tabName) {
                btn.className = "px-3 py-2 rounded-xl text-xs font-bold transition bg-emerald-600 text-white shadow-sm";
            } else {
                btn.className = "px-3 py-2 rounded-xl text-xs font-bold transition text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1c2836]";
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
    }
}
window.switchKeuanganTab = switchKeuanganTab;

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
}
window.calcKeuanganPOSTotal = calcKeuanganPOSTotal;

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

    calcKeuanganPOSTotal();
}
window.resetKeuanganPOS = resetKeuanganPOS;

// ====================================================================
// SUB-MODUL 2: KUITANSI DIGITAL & WHATSAPP GATEWAY
// ====================================================================

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

    if (noEl) noEl.innerText = kuitansi.noKuitansi || '-';
    if (tglEl) tglEl.innerText = formatTglIndo(kuitansi.tanggalBayar);
    if (nameEl) nameEl.innerText = kuitansi.studentName || '-';
    if (nisEl) nisEl.innerText = kuitansi.nis || '-';
    if (totalEl) totalEl.innerText = formatRupiah(kuitansi.nominalTotal || 0);
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
                    <td class="py-2 text-right font-bold text-slate-800 dark:text-slate-100">${formatRupiah(item.nominalBayar)}</td>
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

function shareKuitansiWhatsApp() {
    const k = ASNKeuangan.lastKuitansi;
    if (!k) return;

    let phoneInput = prompt("Masukkan nomor WhatsApp Wali Santri (contoh: 08123456789):", "");
    if (!phoneInput) return;

    let phone = phoneInput.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) {
        phone = '62' + phone.substring(1);
    }

    let itemsText = '';
    const items = k.rincianItems || [];
    items.forEach(it => {
        itemsText += `• ${it.namaPos} (${it.periode || '-'}): ${formatRupiah(it.nominalBayar)}\n`;
    });

    const msg = `*BUKTI PEMBAYARAN RESMI*\n*PPTQ ROUDLOTUL MUBAROKAH KUDUS*\n----------------------------------------\n` +
        `Assalamu'alaikum Wr. Wb.\n` +
        `Yth. Wali Santri dari ananda *${k.studentName}* (NIS: ${k.nis || '-'}),\n\n` +
        `Alhamdulillah, telah kami terima pembayaran administrasi:\n` +
        `📄 *No. Kuitansi* : ${k.noKuitansi}\n` +
        `📅 *Tanggal*      : ${formatTglIndo(k.tanggalBayar)}\n` +
        `💳 *Metode*       : ${k.metodeBayar}\n` +
        `👤 *Penerima*     : ${k.namaKasir}\n\n` +
        `*Rincian Pos Pembayaran:*\n` +
        itemsText +
        `----------------------------------------\n` +
        `*TOTAL DITERIMA : ${formatRupiah(k.nominalTotal)} (LUNAS)*\n\n` +
        `Semoga membawa berkah bagi ananda dan keluarga. Jazakumullahu khairan katsiran atas amanah dan kerjasamanya.\n\n` +
        `Wassalamu'alaikum Wr. Wb.\n` +
        `_Bendahara PPTQ Roudlotul Mubarokah_`;

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
}
window.shareKuitansiWhatsApp = shareKuitansiWhatsApp;

// ====================================================================
// SUB-MODUL 3: DAFTAR TAGIHAN & GENERATE BULANAN
// ====================================================================

function filterKeuanganTagihan() {
    const searchInput = document.getElementById('keuangan-tagihan-search');
    const filterStatus = document.getElementById('keuangan-tagihan-filter-status');
    const filterPeriode = document.getElementById('keuangan-tagihan-filter-periode');

    const q = searchInput ? searchInput.value.trim().toLowerCase() : "";
    const stStatus = filterStatus ? filterStatus.value : "ALL";
    const stPeriode = filterPeriode ? filterPeriode.value : "ALL";

    const all = ASNKeuangan.data.tagihanList || [];

    ASNKeuangan.filteredTagihan = all.filter(t => {
        if (q) {
            const mName = (t.studentName || "").toLowerCase().includes(q);
            const mPos = (t.namaPos || "").toLowerCase().includes(q);
            const mPer = (t.periode || "").toLowerCase().includes(q);
            if (!mName && !mPos && !mPer) return false;
        }

        if (stStatus !== "ALL") {
            if (t.status !== stStatus) return false;
        }

        if (stPeriode !== "ALL") {
            if (t.periode !== stPeriode) return false;
        }

        return true;
    });

    renderKeuanganTagihanTable();
}
window.filterKeuanganTagihan = filterKeuanganTagihan;

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

        htmlDesktop += `
            <tr class="hover:bg-slate-50/80 dark:hover:bg-[#1a2636]/60 transition border-b border-slate-100 dark:border-[#202f42] text-xs">
                <td class="p-3 text-center text-slate-400 font-medium">${idx + 1}</td>
                <td class="p-3">
                    <div class="font-bold text-slate-800 dark:text-slate-100">${escapeHtml(t.studentName)}</div>
                    <div class="text-[10px] text-slate-400">ID: ${escapeHtml(t.studentId)}</div>
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

function renderKeuanganTransaksiTable() {
    const tbody = document.getElementById('keuangan-transaksi-table-body');
    const list = ASNKeuangan.data.recentTransactions || [];

    if (!tbody) return;

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-xs text-slate-400">Belum ada riwayat transaksi pembayaran.</td></tr>`;
        return;
    }

    let html = '';
    list.forEach((trx, idx) => {
        html += `
            <tr class="hover:bg-slate-50/80 dark:hover:bg-[#1a2636]/60 transition border-b border-slate-100 dark:border-[#202f42] text-xs">
                <td class="p-3 text-center text-slate-400 font-medium">${idx + 1}</td>
                <td class="p-3 font-mono font-bold text-emerald-700 dark:text-emerald-400">${escapeHtml(trx.noKuitansi)}</td>
                <td class="p-3 text-slate-500">${formatTglIndo(trx.tanggalBayar)}</td>
                <td class="p-3 font-bold text-slate-800 dark:text-slate-100">${escapeHtml(trx.studentName)}</td>
                <td class="p-3 font-black text-slate-800 dark:text-slate-100">${formatRupiah(trx.nominalTotal)}</td>
                <td class="p-3">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-[#1c2836] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#253447]">
                        ${escapeHtml(trx.metodeBayar)}
                    </span>
                </td>
                <td class="p-3 text-right space-x-1">
                    <button type="button" onclick="openKuitansiModal(${escapeHtml(JSON.stringify(trx))})"
                        class="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#1c2836] transition" title="Lihat Kuitansi">
                        <i class="fa-solid fa-receipt text-xs text-emerald-600"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}
window.renderKeuanganTransaksiTable = renderKeuanganTransaksiTable;

// ====================================================================
// SUB-MODUL 5: MASTER POS & TARIF BIAYA
// ====================================================================

function renderKeuanganTarifTable() {
    const tbody = document.getElementById('keuangan-tarif-table-body');
    const list = ASNKeuangan.data.tarifList || [];

    if (!tbody) return;

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-xs text-slate-400">Belum ada master tarif biaya terdaftar.</td></tr>`;
        return;
    }

    let html = '';
    list.forEach((trf, idx) => {
        html += `
            <tr class="hover:bg-slate-50/80 dark:hover:bg-[#1a2636]/60 transition border-b border-slate-100 dark:border-[#202f42] text-xs">
                <td class="p-3 text-center text-slate-400 font-medium">${idx + 1}</td>
                <td class="p-3 font-bold text-slate-800 dark:text-slate-100">${escapeHtml(trf.namaPos)}</td>
                <td class="p-3">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold ${trf.kategori === 'BULANAN' ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}">
                        ${escapeHtml(trf.kategori)}
                    </span>
                </td>
                <td class="p-3 font-black text-slate-800 dark:text-slate-100">${formatRupiah(trf.nominalDefault)}</td>
                <td class="p-3 text-slate-500">${escapeHtml(trf.program || 'SEMUA')}</td>
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
    });

    tbody.innerHTML = html;
}
window.renderKeuanganTarifTable = renderKeuanganTarifTable;

function openTarifModal(tarifId = "") {
    const modal = document.getElementById('modal-keuangan-tarif');
    if (!modal) return;

    const idInput = document.getElementById('tarif-input-id');
    const namaInput = document.getElementById('tarif-input-nama');
    const katInput = document.getElementById('tarif-input-kategori');
    const nomInput = document.getElementById('tarif-input-nominal');
    const progInput = document.getElementById('tarif-input-program');
    const actInput = document.getElementById('tarif-input-active');
    const titleEl = document.getElementById('modal-tarif-title');

    if (tarifId) {
        const list = ASNKeuangan.data.tarifList || [];
        const t = list.find(x => x.tarifId === tarifId);
        if (t) {
            if (idInput) idInput.value = t.tarifId;
            if (namaInput) namaInput.value = t.namaPos;
            if (katInput) katInput.value = t.kategori;
            if (nomInput) nomInput.value = t.nominalDefault;
            if (progInput) progInput.value = t.program || "SEMUA";
            if (actInput) actInput.checked = t.isActive !== false;
            if (titleEl) titleEl.innerText = "Edit Master Tarif Biaya";
        }
    } else {
        if (idInput) idInput.value = "";
        if (namaInput) namaInput.value = "";
        if (katInput) katInput.value = "BULANAN";
        if (nomInput) nomInput.value = "";
        if (progInput) progInput.value = "SEMUA";
        if (actInput) actInput.checked = true;
        if (titleEl) titleEl.innerText = "Tambah Master Tarif Biaya";
    }

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
