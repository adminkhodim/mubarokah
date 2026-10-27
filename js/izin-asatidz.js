/**
 * ====================================================================
 * MODUL FRONTEND: PERIZINAN ASATIDZ & DELEGASI BADAL HALAQAH
 * PPTQ Roudlotul Mubarokah Dashboard & Control Center
 * ====================================================================
 * Fitur:
 * 1. Formulir Pengajuan Izin Asatidz (Tanggal, Sesi, Kategori, Alasan)
 * 2. Penunjukan Wajib Ustadz Badal (Pengganti Pengampu Halaqah)
 * 3. Integrasi Dual-Write (Google Apps Script API & Client State Storage)
 * 4. Tab Riwayat Izin Saya & Tab Amanah Badal Saya
 * 5. Antarmuka Persetujuan (Approval) Khusus Dewan Pengasuh & Masyayikh:
 *    - Peninjauan permohonan izin asatidz yang masuk (Status PENDING)
 *    - 1-Klik Setujui (Qobul) atau Tolak dengan catatan/dawuh Pengasuh
 *    - Banner notifikasi otomatis di Modul Tahfidz & Badge Pusat Kontrol
 * 6. Feedback visual status (PENDING, APPROVED, REJECTED)
 * 7. Pendelegasian runtime halaqah tahfidz bagi Ustadz Badal
 */

(function (window, document) {
    'use strict';

    const ASNIzinAsatidz = {
        list: [],
        myList: [],
        delegatedToMeList: [],
        pendingApprovalList: [],
        activeTab: 'FORM', // 'FORM' | 'MY_HISTORY' | 'DELEGATIONS' | 'APPROVAL'
        isLoading: false,
        form: {
            asatidzId: '',
            namaAsatidz: '',
            tanggalMulai: '',
            tanggalSelesai: '',
            sesi: 'FULL_DAY',
            kategori: 'SAKIT',
            alasan: '',
            badalId: '',
            namaBadal: '',
            catatanBadal: '',
            lampiranUrl: ''
        }
    };

    window.ASNIzinAsatidz = ASNIzinAsatidz;

    const STORAGE_KEY_IZIN_FALLBACK = 'MUBAROKAH_IZIN_ASATIDZ_CACHE_V1';

    // Helper: Escape HTML
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    }

    // Helper: Format Tanggal Indonesia
    function formatDateIndo(dateStr) {
        if (!dateStr) return '-';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return String(dateStr);
            return d.toLocaleDateString('id-ID', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
        } catch (e) {
            return String(dateStr);
        }
    }

    // Helper: Mendapatkan Identitas Asatidz yang Sedang Login
    function getCurrentAsatidzIdentity() {
        let name = '';
        let id = '';

        if (window.ASNIdentity && window.ASNIdentity.currentUser) {
            name = window.ASNIdentity.currentUser.name || window.ASNIdentity.currentUser.nama || '';
            id = window.ASNIdentity.currentUser.id || window.ASNIdentity.currentUser.employee_id || '';
        }

        if (!name) {
            name = sessionStorage.getItem('MUBAROKAH_ADMIN_NAME') || 
                   sessionStorage.getItem('mubarokah_admin_name') || 
                   sessionStorage.getItem('ASN_ADMIN_NAME') || 
                   sessionStorage.getItem('asnawiyyah_admin_name') || 
                   localStorage.getItem('mubarokah_admin_name') || '';
        }

        if (!id) {
            id = sessionStorage.getItem('MUBAROKAH_ADMIN_ID') || 
                 sessionStorage.getItem('mubarokah_admin_id') || 
                 sessionStorage.getItem('ASN_ADMIN_ID') || 
                 sessionStorage.getItem('asnawiyyah_admin_id') || 
                 localStorage.getItem('mubarokah_admin_id') || '';
        }

        return { name, id };
    }

    // Helper: Cek Apakah User Memiliki Hak Otoritas Approval Pengasuh
    function canApproveIzinAsatidz() {
        let role = '';
        if (window.ASNIdentity && window.ASNIdentity.currentRole) {
            role = window.ASNIdentity.currentRole;
        } else if (window.ASNIdentity && window.ASNIdentity.currentUser) {
            role = window.ASNIdentity.currentUser.role || '';
        }
        if (!role) {
            role = sessionStorage.getItem('MUBAROKAH_ADMIN_ROLE') || 
                   sessionStorage.getItem('mubarokah_admin_role') || 
                   sessionStorage.getItem('ASN_ADMIN_ROLE') || 
                   sessionStorage.getItem('asnawiyyah_admin_role') || 
                   localStorage.getItem('mubarokah_admin_role') || '';
        }
        const r = String(role).toUpperCase();
        return r === 'PENGASUH' || r === 'SUPER_ADMIN' || r === 'ADMIN' || r === 'LURAH';
    }

    // Helper: Mendapatkan Daftar Asatidz untuk Dropdown Badal
    function getAvailableAsatidzList(excludeName = '') {
        const asatidzSet = new Map();
        const cleanExclude = String(excludeName || '').trim().toLowerCase();

        // 1. Dari master pegawai (ASNPegawai)
        if (window.ASNPegawai && Array.isArray(window.ASNPegawai.list)) {
            window.ASNPegawai.list.forEach(p => {
                const pName = String(p.nama || p.name || '').trim();
                const pId = String(p.employee_id || p.id || '').trim();
                const pJabatan = String(p.jabatan || p.spesialisasi || '').toLowerCase();
                const isGuru = pJabatan.includes('tahfidz') || pJabatan.includes('muhafiz') || 
                               pJabatan.includes('ustadz') || pJabatan.includes('pengajar') ||
                               pJabatan.includes('asatidz') || pJabatan.includes('guru') ||
                               !pJabatan; // default include

                if (pName && isGuru && pName.toLowerCase() !== cleanExclude) {
                    asatidzSet.set(pName.toLowerCase(), { id: pId, name: pName });
                }
            });
        }

        // 2. Dari data halaqah tahfidz (ASNTahfidz)
        if (window.ASNTahfidz && window.ASNTahfidz.data && Array.isArray(window.ASNTahfidz.data.halaqahs)) {
            window.ASNTahfidz.data.halaqahs.forEach(h => {
                const hMuh = String(h.muhafiz || '').trim();
                if (hMuh && hMuh.toLowerCase() !== cleanExclude && !hMuh.toLowerCase().includes('ustadz pembina')) {
                    if (!asatidzSet.has(hMuh.toLowerCase())) {
                        asatidzSet.set(hMuh.toLowerCase(), { id: h.halaqahId || '', name: hMuh });
                    }
                }
            });
        }

        // 3. Dari adminUsersList (Role ASATIDZ / PEGAWAI)
        if (typeof adminUsersList !== 'undefined' && Array.isArray(adminUsersList)) {
            adminUsersList.forEach(u => {
                if (u.role === 'ASATIDZ' || u.role === 'PEGAWAI') {
                    const uName = String(u.name || u.nama || u.username || '').trim();
                    const uId = String(u.id || u.user_id || '').trim();
                    if (uName && uName.toLowerCase() !== cleanExclude) {
                        if (!asatidzSet.has(uName.toLowerCase())) {
                            asatidzSet.set(uName.toLowerCase(), { id: uId, name: uName });
                        }
                    }
                }
            });
        }

        return Array.from(asatidzSet.values()).sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Buka Modal Pengajuan / Approval Izin Asatidz
     * @param {string} initialTab - Tab awal: 'FORM' | 'MY_HISTORY' | 'DELEGATIONS' | 'APPROVAL'
     */
    function openIzinAsatidzModal(initialTab) {
        const modal = document.getElementById('modal-izin-asatidz');
        if (!modal) return;

        // Reset form data
        const current = getCurrentAsatidzIdentity();
        const todayStr = new Date().toISOString().split('T')[0];

        ASNIzinAsatidz.form = {
            asatidzId: current.id,
            namaAsatidz: current.name,
            tanggalMulai: todayStr,
            tanggalSelesai: todayStr,
            sesi: 'FULL_DAY',
            kategori: 'SAKIT',
            alasan: '',
            badalId: '',
            namaBadal: '',
            catatanBadal: '',
            lampiranUrl: ''
        };

        // Render input values
        const inNama = document.getElementById('izin-asatidz-nama');
        const inTglMulai = document.getElementById('izin-asatidz-tgl-mulai');
        const inTglSelesai = document.getElementById('izin-asatidz-tgl-selesai');
        const inAlasan = document.getElementById('izin-asatidz-alasan');
        const inCatatanBadal = document.getElementById('izin-asatidz-catatan-badal');
        const inLampiran = document.getElementById('izin-asatidz-lampiran');

        if (inNama) inNama.value = current.name || '';
        if (inTglMulai) inTglMulai.value = todayStr;
        if (inTglSelesai) inTglSelesai.value = todayStr;
        if (inAlasan) inAlasan.value = '';
        if (inCatatanBadal) inCatatanBadal.value = '';
        if (inLampiran) inLampiran.value = '';

        // Reset pilihan sesi chips
        setIzinAsatidzSesi('FULL_DAY');
        setIzinAsatidzKategori('SAKIT');

        // Populate dropdown Badal
        populateBadalDropdown(current.name);

        // Tampilkan tab approval jika memiliki hak otoritas Pengasuh / Admin
        const isApprover = canApproveIzinAsatidz();
        const tabBtnApproval = document.getElementById('tab-btn-izin-approval');
        if (tabBtnApproval) {
            tabBtnApproval.classList.toggle('hidden', !isApprover);
        }

        // Tentukan tab awal
        let targetTab = initialTab || 'FORM';
        if (!initialTab && isApprover && ASNIzinAsatidz.pendingApprovalList && ASNIzinAsatidz.pendingApprovalList.length > 0) {
            targetTab = 'APPROVAL';
        }

        switchIzinAsatidzTab(targetTab);

        // Tampilkan modal
        modal.classList.remove('hidden');
        if (document.body) document.body.classList.add('overflow-hidden');

        // Muat data riwayat & persetujuan di background
        loadIzinAsatidzHistory();
    }

    /**
     * Tutup Modal
     */
    function closeIzinAsatidzModal() {
        const modal = document.getElementById('modal-izin-asatidz');
        if (!modal) return;
        modal.classList.add('hidden');
        if (document.body) document.body.classList.remove('overflow-hidden');
    }

    /**
     * Pilih Sesi Izin (Quick Chips)
     */
    function setIzinAsatidzSesi(sesiValue) {
        ASNIzinAsatidz.form.sesi = sesiValue;
        document.querySelectorAll('.izin-asatidz-sesi-btn').forEach(btn => {
            const val = btn.getAttribute('data-sesi');
            if (val === sesiValue) {
                btn.className = 'izin-asatidz-sesi-btn px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border-2 border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 shadow-xs';
            } else {
                btn.className = 'izin-asatidz-sesi-btn px-3 py-2 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 border border-slate-200 dark:border-[#253447] bg-slate-50 dark:bg-[#1c2836] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#253447]';
            }
        });
    }

    /**
     * Pilih Kategori Izin (Quick Chips)
     */
    function setIzinAsatidzKategori(kategoriValue) {
        ASNIzinAsatidz.form.kategori = kategoriValue;
        const select = document.getElementById('izin-asatidz-kategori');
        if (select) select.value = kategoriValue;
    }

    /**
     * Isi Pilihan Dropdown Ustadz Badal
     */
    function populateBadalDropdown(excludeName = '') {
        const select = document.getElementById('izin-asatidz-badal');
        if (!select) return;

        const list = getAvailableAsatidzList(excludeName);
        let html = '<option value="">-- Pilih Ustadz Badal (Wajib) --</option>';

        if (list.length === 0) {
            html += '<option value="" disabled>Belum ada data Asatidz lain. Ketik manual nama badal di bawah.</option>';
        } else {
            list.forEach(a => {
                html += `<option value="${escapeHtml(a.name)}" data-id="${escapeHtml(a.id)}">${escapeHtml(a.name)}</option>`;
            });
        }

        select.innerHTML = html;
    }

    /**
     * Navigasi Tab dalam Modal: Form Pengajuan vs Riwayat Izin vs Delegasi Badal vs Restu Pengasuh
     */
    function switchIzinAsatidzTab(tabName) {
        ASNIzinAsatidz.activeTab = tabName;

        const tabBtnForm = document.getElementById('tab-btn-izin-form');
        const tabBtnMy = document.getElementById('tab-btn-izin-my');
        const tabBtnBadal = document.getElementById('tab-btn-izin-badal');
        const tabBtnApproval = document.getElementById('tab-btn-izin-approval');

        const paneForm = document.getElementById('pane-izin-asatidz-form');
        const paneMy = document.getElementById('pane-izin-asatidz-my');
        const paneBadal = document.getElementById('pane-izin-asatidz-badal');
        const paneApproval = document.getElementById('pane-izin-asatidz-approval');

        // Style Tab Buttons
        const activeClass = 'px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 bg-emerald-600 text-white shadow-xs';
        const inactiveClass = 'px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-[#253447]';

        const activeApprovalClass = 'px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 bg-amber-600 text-white shadow-xs';
        const inactiveApprovalClass = 'px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 text-amber-800 dark:text-amber-200 hover:bg-amber-100/70 dark:hover:bg-amber-950/60 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80';

        if (tabBtnForm) tabBtnForm.className = (tabName === 'FORM') ? activeClass : inactiveClass;
        if (tabBtnMy) tabBtnMy.className = (tabName === 'MY_HISTORY') ? activeClass : inactiveClass;
        if (tabBtnBadal) tabBtnBadal.className = (tabName === 'DELEGATIONS') ? activeClass : inactiveClass;
        if (tabBtnApproval) tabBtnApproval.className = (tabName === 'APPROVAL') ? activeApprovalClass : inactiveApprovalClass;

        if (paneForm) paneForm.classList.toggle('hidden', tabName !== 'FORM');
        if (paneMy) paneMy.classList.toggle('hidden', tabName !== 'MY_HISTORY');
        if (paneBadal) paneBadal.classList.toggle('hidden', tabName !== 'DELEGATIONS');
        if (paneApproval) paneApproval.classList.toggle('hidden', tabName !== 'APPROVAL');

        if (tabName !== 'FORM') {
            loadIzinAsatidzHistory();
        }
    }

    /**
     * Submit Form Pengajuan Izin Asatidz
     */
    async function submitIzinAsatidzForm(event) {
        if (event) event.preventDefault();

        const btnSubmit = document.getElementById('btn-submit-izin-asatidz');
        const btnIcon = document.getElementById('btn-submit-izin-icon');
        const btnText = document.getElementById('btn-submit-izin-text');

        const inNama = document.getElementById('izin-asatidz-nama');
        const inTglMulai = document.getElementById('izin-asatidz-tgl-mulai');
        const inTglSelesai = document.getElementById('izin-asatidz-tgl-selesai');
        const selKategori = document.getElementById('izin-asatidz-kategori');
        const selBadal = document.getElementById('izin-asatidz-badal');
        const inAlasan = document.getElementById('izin-asatidz-alasan');
        const inCatatanBadal = document.getElementById('izin-asatidz-catatan-badal');
        const inLampiran = document.getElementById('izin-asatidz-lampiran');

        const namaAsatidz = String(inNama ? inNama.value : '').trim();
        const tglMulai = inTglMulai ? inTglMulai.value : '';
        const tglSelesai = inTglSelesai ? inTglSelesai.value : tglMulai;
        const kategori = selKategori ? selKategori.value : 'SAKIT';
        const namaBadal = selBadal ? selBadal.value : '';
        const selectedBadalOpt = selBadal ? selBadal.options[selBadal.selectedIndex] : null;
        const badalId = selectedBadalOpt ? (selectedBadalOpt.getAttribute('data-id') || '') : '';
        const alasan = inAlasan ? inAlasan.value.trim() : '';
        const catatanBadal = inCatatanBadal ? inCatatanBadal.value.trim() : '';
        const lampiranUrl = inLampiran ? inLampiran.value.trim() : '';
        const sesi = ASNIzinAsatidz.form.sesi || 'FULL_DAY';

        // Validasi Wajib
        if (!namaAsatidz) {
            alertToast('Nama Asatidz pemohon wajib diisi.', 'warning');
            if (inNama) inNama.focus();
            return;
        }

        if (!tglMulai) {
            alertToast('Tanggal mulai izin wajib ditentukan.', 'warning');
            if (inTglMulai) inTglMulai.focus();
            return;
        }

        if (!namaBadal) {
            alertToast('Ustadz Badal (pengganti) wajib dipilih untuk menjamin kelangsungan halaqah santri.', 'warning');
            if (selBadal) selBadal.focus();
            return;
        }

        if (!alasan) {
            alertToast('Alasan perizinan wajib disertakan.', 'warning');
            if (inAlasan) inAlasan.focus();
            return;
        }

        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : (sessionStorage.getItem('mubarokah_admin_token') || sessionStorage.getItem('asnawiyyah_admin_token'))) || '';

        const payload = {
            asatidzId: ASNIzinAsatidz.form.asatidzId || '',
            namaAsatidz: namaAsatidz,
            tanggalMulai: tglMulai,
            tanggalSelesai: tglSelesai,
            sesi: sesi,
            kategori: kategori,
            alasan: alasan,
            badalId: badalId,
            namaBadal: namaBadal,
            catatanBadal: catatanBadal,
            lampiranUrl: lampiranUrl,
            status: 'PENDING',
            token: token
        };

        // UI Loading State
        if (btnSubmit) btnSubmit.disabled = true;
        if (btnIcon) btnIcon.className = 'fa-solid fa-spinner fa-spin text-xs';
        if (btnText) btnText.textContent = 'Mengirim Permohonan...';

        try {
            let res = null;

            // 1. Kirim ke Backend Google Apps Script API
            if (typeof apiPost === 'function') {
                try {
                    res = await apiPost('submitIzinAsatidz', payload);
                } catch (apiErr) {
                    console.warn('[API SUBMIT IZIN ASATIDZ FALLBACK]', apiErr);
                }
            }

            // Fallback via URL fetch jika apiPost gagal
            if (!res || !res.success) {
                const apiUrl = (window.APP_CONFIG && window.APP_CONFIG.API_URL) || (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '');
                if (apiUrl) {
                    const fetchRes = await fetch(apiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'submitIzinAsatidz', data: payload, token: token })
                    });
                    res = await fetchRes.json();
                }
            }

            // Local cache dual-write fallback
            const idIzin = (res && res.data && res.data.idIzin) ? res.data.idIzin : `IZA-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;
            const cachedItem = {
                ...payload,
                idIzin: idIzin,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            saveToLocalIzinCache(cachedItem);

            alertToast('✅ Permohonan izin mengajar berhasil diajukan! Menunggu persetujuan Dewan Pengasuh.', 'success');

            // Reset form
            if (inAlasan) inAlasan.value = '';
            if (inCatatanBadal) inCatatanBadal.value = '';
            if (inLampiran) inLampiran.value = '';

            // Buka tab Riwayat Izin Saya agar pemohon langsung melihat status izinnya
            switchIzinAsatidzTab('MY_HISTORY');
            loadIzinAsatidzHistory();

        } catch (err) {
            console.error('[SUBMIT IZIN ASATIDZ ERROR]', err);
            alertToast('Gagal mengajukan izin: ' + (err.message || 'Terjadi kesalahan sistem'), 'error');
        } finally {
            if (btnSubmit) btnSubmit.disabled = false;
            if (btnIcon) btnIcon.className = 'fa-solid fa-paper-plane text-xs';
            if (btnText) btnText.textContent = 'Kirim Pengajuan Izin';
        }
    }

    /**
     * Muat Riwayat Izin Asatidz & Persetujuan Pengasuh
     */
    async function loadIzinAsatidzHistory() {
        const current = getCurrentAsatidzIdentity();
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : (sessionStorage.getItem('mubarokah_admin_token') || sessionStorage.getItem('asnawiyyah_admin_token'))) || '';
        const myHistoryList = document.getElementById('izin-asatidz-my-list');
        const badalList = document.getElementById('izin-asatidz-badal-list');
        const approvalList = document.getElementById('izin-asatidz-approval-list');

        if (myHistoryList && ASNIzinAsatidz.activeTab === 'MY_HISTORY') myHistoryList.innerHTML = renderLoadingState('Memuat riwayat izin Anda...');
        if (badalList && ASNIzinAsatidz.activeTab === 'DELEGATIONS') badalList.innerHTML = renderLoadingState('Memuat tugas badal Anda...');
        if (approvalList && ASNIzinAsatidz.activeTab === 'APPROVAL') approvalList.innerHTML = renderLoadingState('Memuat data persetujuan Pengasuh...');

        try {
            let data = [];

            // 1. Ambil dari Google Apps Script API
            if (typeof apiPost === 'function') {
                try {
                    const apiRes = await apiPost('getIzinAsatidz', { token });
                    if (apiRes && apiRes.success && Array.isArray(apiRes.data)) {
                        data = apiRes.data;
                    }
                } catch (eApi) {
                    console.warn('[API GET IZIN ASATIDZ FALLBACK]', eApi);
                }
            }

            // 2. Gabungkan dengan data lokal fallback jika ada
            const localData = getLocalIzinCache();
            if (Array.isArray(localData) && localData.length > 0) {
                const mapIds = new Set(data.map(d => String(d.idIzin || '')));
                localData.forEach(item => {
                    if (!mapIds.has(String(item.idIzin || ''))) {
                        data.push(item);
                    }
                });
            }

            ASNIzinAsatidz.list = data;

            // Filter riwayat saya (nama asatidz pemohon cocok)
            const cleanMyName = String(current.name || '').trim().toLowerCase();
            ASNIzinAsatidz.myList = data.filter(item => {
                const iName = String(item.namaAsatidz || item.nama_asatidz || '').trim().toLowerCase();
                return cleanMyName && iName.includes(cleanMyName);
            });

            // Filter tugas badal saya (nama badal cocok)
            ASNIzinAsatidz.delegatedToMeList = data.filter(item => {
                const bName = String(item.namaBadal || item.nama_badal || '').trim().toLowerCase();
                return cleanMyName && bName.includes(cleanMyName);
            });

            // Filter permohonan pending yang membutuhkan persetujuan Pengasuh / Admin
            ASNIzinAsatidz.pendingApprovalList = data.filter(item => {
                const st = String(item.status || 'PENDING').toUpperCase();
                return st === 'PENDING';
            });

            // Update badge counters
            const badgeMy = document.getElementById('badge-count-izin-my');
            const badgeBadal = document.getElementById('badge-count-izin-badal');
            const badgeApproval = document.getElementById('badge-count-izin-approval');
            if (badgeMy) badgeMy.textContent = String(ASNIzinAsatidz.myList.length);
            if (badgeBadal) badgeBadal.textContent = String(ASNIzinAsatidz.delegatedToMeList.length);
            if (badgeApproval) badgeApproval.textContent = String(ASNIzinAsatidz.pendingApprovalList.length);

            // Update status visual banner di Modul Tahfidz & Badge di Pusat Kontrol Pengasuh
            const isApprover = canApproveIzinAsatidz();
            const bannerTahfidz = document.getElementById('banner-pengasuh-izin-asatidz');
            const bannerBadge = document.getElementById('banner-pengasuh-izin-badge');
            const bannerText = document.getElementById('banner-pengasuh-izin-text');
            const pengasuhBadgeGrid = document.getElementById('pengasuh-tahfidz-izin-badge');

            const pendingCount = ASNIzinAsatidz.pendingApprovalList.length;

            if (bannerTahfidz) {
                if (isApprover && pendingCount > 0) {
                    bannerTahfidz.classList.remove('hidden');
                    if (bannerBadge) bannerBadge.textContent = `${pendingCount} Menunggu Restu`;
                    if (bannerText) bannerText.textContent = `Ada ${pendingCount} permohonan izin mengajar Asatidz yang memerlukan persetujuan Pengasuh untuk mengaktifkan Badal Halaqah santri.`;
                } else {
                    bannerTahfidz.classList.add('hidden');
                }
            }

            if (pengasuhBadgeGrid) {
                if (isApprover && pendingCount > 0) {
                    pengasuhBadgeGrid.textContent = String(pendingCount);
                    pengasuhBadgeGrid.classList.remove('hidden');
                } else {
                    pengasuhBadgeGrid.classList.add('hidden');
                }
            }

            // Tampilkan atau sembunyikan tombol tab approval
            const tabBtnApproval = document.getElementById('tab-btn-izin-approval');
            if (tabBtnApproval) {
                tabBtnApproval.classList.toggle('hidden', !isApprover);
            }

            // Render Tab "Izin Saya"
            renderMyHistoryList();

            // Render Tab "Amanah Badal Saya"
            renderDelegatedList();

            // Render Tab "Persetujuan Pengasuh"
            renderApprovalList();

            // Sinkronkan badge visual badal pada daftar halaqah & tabel santri jika modul Tahfidz aktif
            if (typeof renderTahfidzHalaqahCards === 'function') {
                try { renderTahfidzHalaqahCards(); } catch (eR) {}
            }
            if (typeof populateTahfidzFilters === 'function') {
                try { populateTahfidzFilters(); } catch (eR) {}
            }
            if (typeof filterTahfidzList === 'function') {
                try { filterTahfidzList(); } catch (eR) {}
            }

        } catch (err) {
            console.error('[LOAD IZIN ASATIDZ HISTORY ERROR]', err);
            if (myHistoryList) myHistoryList.innerHTML = renderEmptyState('Gagal memuat data riwayat.');
            if (badalList) badalList.innerHTML = renderEmptyState('Gagal memuat data badal.');
            if (approvalList) approvalList.innerHTML = renderEmptyState('Gagal memuat data persetujuan.');
        }
    }

    /**
     * Render Daftar Riwayat Izin Pemohon
     */
    function renderMyHistoryList() {
        const container = document.getElementById('izin-asatidz-my-list');
        if (!container) return;

        if (ASNIzinAsatidz.myList.length === 0) {
            container.innerHTML = renderEmptyState('Belum ada riwayat perizinan yang Anda ajukan.');
            return;
        }

        let html = '';
        ASNIzinAsatidz.myList.forEach(item => {
            const statusBadge = getStatusBadge(item.status);
            const sesiLabel = getSesiLabel(item.sesi);
            const tglRange = (item.tanggalMulai === item.tanggalSelesai || !item.tanggalSelesai)
                ? formatDateIndo(item.tanggalMulai)
                : `${formatDateIndo(item.tanggalMulai)} s/d ${formatDateIndo(item.tanggalSelesai)}`;

            html += `
                <div class="p-3.5 rounded-2xl border border-slate-200/80 dark:border-[#253447] bg-white dark:bg-[#1c2836] shadow-xs space-y-2.5 transition hover:border-emerald-300 dark:hover:border-emerald-700">
                    <div class="flex items-start justify-between gap-2">
                        <div>
                            <div class="flex items-center gap-1.5 flex-wrap">
                                <span class="font-bold text-xs text-slate-800 dark:text-slate-100">${escapeHtml(item.kategori || 'Izin')}</span>
                                <span class="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-[#253447] text-slate-600 dark:text-slate-300">${sesiLabel}</span>
                            </div>
                            <span class="text-[11px] font-mono text-slate-400 mt-0.5 block">${tglRange}</span>
                        </div>
                        <div>${statusBadge}</div>
                    </div>

                    <div class="p-2 rounded-xl bg-slate-50 dark:bg-[#15202d] text-xs text-slate-600 dark:text-slate-300 space-y-1">
                        <div><strong class="text-slate-700 dark:text-slate-200">Ustadz Badal:</strong> ${escapeHtml(item.namaBadal || item.nama_badal || '-')}</div>
                        <div><strong class="text-slate-700 dark:text-slate-200">Alasan:</strong> ${escapeHtml(item.alasan || '-')}</div>
                        ${item.catatanBadal ? `<div><strong class="text-slate-700 dark:text-slate-200">Pesan Badal:</strong> <span class="italic font-mono text-[11px]">${escapeHtml(item.catatanBadal)}</span></div>` : ''}
                    </div>

                    ${item.pengasuhApprovedBy ? `
                        <div class="pt-1 text-[10px] text-emerald-700 dark:text-emerald-300 flex items-center justify-between border-t border-slate-100 dark:border-[#253447]">
                            <span><i class="fa-solid fa-check-double mr-1"></i>Disetujui oleh: <strong>${escapeHtml(item.pengasuhApprovedBy)}</strong></span>
                            ${item.catatanPengasuh ? `<span class="italic text-slate-400 truncate max-w-[200px]" title="${escapeHtml(item.catatanPengasuh)}">"${escapeHtml(item.catatanPengasuh)}"</span>` : ''}
                        </div>
                    ` : (item.status === 'REJECTED' ? `
                        <div class="pt-1 text-[10px] text-rose-600 dark:text-rose-400 border-t border-slate-100 dark:border-[#253447]">
                            <i class="fa-solid fa-ban mr-1"></i>Permohonan ditolak oleh Pengasuh: ${escapeHtml(item.catatanPengasuh || 'Tidak memenuhi kriteria')}
                        </div>
                    ` : `
                        <div class="pt-1 text-[10px] text-amber-600 dark:text-amber-400 border-t border-slate-100 dark:border-[#253447] flex items-center gap-1">
                            <i class="fa-solid fa-hourglass-half"></i> Sedang menunggu restu / verifikasi Dewan Pengasuh
                        </div>
                    `)}
                </div>
            `;
        });

        container.innerHTML = html;
    }

    /**
     * Render Daftar Amanah Badal yang Ditugaskan ke Ustadz ini
     */
    function renderDelegatedList() {
        const container = document.getElementById('izin-asatidz-badal-list');
        if (!container) return;

        if (ASNIzinAsatidz.delegatedToMeList.length === 0) {
            container.innerHTML = renderEmptyState('Belum ada pendelegasian halaqah badal dari ustadz lain.');
            return;
        }

        let html = '';
        ASNIzinAsatidz.delegatedToMeList.forEach(item => {
            const statusBadge = getStatusBadge(item.status);
            const sesiLabel = getSesiLabel(item.sesi);
            const tglRange = (item.tanggalMulai === item.tanggalSelesai || !item.tanggalSelesai)
                ? formatDateIndo(item.tanggalMulai)
                : `${formatDateIndo(item.tanggalMulai)} s/d ${formatDateIndo(item.tanggalSelesai)}`;

            html += `
                <div class="p-3.5 rounded-2xl border border-indigo-200/80 dark:border-indigo-900/40 bg-white dark:bg-[#1c2836] shadow-xs space-y-2.5 transition hover:border-indigo-400">
                    <div class="flex items-start justify-between gap-2">
                        <div>
                            <span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                AMANAH BADAL
                            </span>
                            <h4 class="font-bold text-xs text-slate-800 dark:text-slate-100 mt-1">Menggantikan: ${escapeHtml(item.namaAsatidz || item.nama_asatidz)}</h4>
                            <span class="text-[11px] font-mono text-slate-400">${tglRange} • ${sesiLabel}</span>
                        </div>
                        <div>${statusBadge}</div>
                    </div>

                    <div class="p-2.5 rounded-xl bg-indigo-50/50 dark:bg-[#15202d] text-xs text-slate-700 dark:text-slate-300 space-y-1">
                        <div><strong>Kategori Izin:</strong> ${escapeHtml(item.kategori || 'Sakit')} (${escapeHtml(item.alasan || '-')})</div>
                        ${item.catatanBadal ? `
                            <div class="p-2 rounded-lg bg-white dark:bg-[#1c2836] border border-indigo-100 dark:border-indigo-950 mt-1">
                                <span class="font-bold text-[10px] uppercase tracking-wider text-indigo-600 block mb-0.5">Pesan Materi untuk Anda:</span>
                                <p class="italic text-[11px]">${escapeHtml(item.catatanBadal)}</p>
                            </div>
                        ` : ''}
                    </div>

                    ${item.status === 'APPROVED' ? `
                        <div class="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 flex items-center justify-between text-xs">
                            <span class="text-emerald-800 dark:text-emerald-200 font-semibold text-[11px]"><i class="fa-solid fa-circle-check text-emerald-600 mr-1"></i>Halaqah titipan telah aktif di modul Tahfidz</span>
                            <button type="button" onclick="closeIzinAsatidzModal(); openTahfidzCatatModal();" class="px-2.5 py-1 bg-emerald-600 text-white font-bold rounded-lg text-[10px] hover:bg-emerald-700 transition">
                                Input Setoran
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;
        });

        container.innerHTML = html;
    }

    /**
     * Render Daftar Permohonan Izin Menunggu Persetujuan Pengasuh & Masyayikh
     */
    function renderApprovalList() {
        const container = document.getElementById('izin-asatidz-approval-list');
        if (!container) return;

        const allPending = ASNIzinAsatidz.pendingApprovalList || [];
        const allProcessed = (ASNIzinAsatidz.list || []).filter(item => {
            const st = String(item.status || '').toUpperCase();
            return st !== 'PENDING';
        });

        if (allPending.length === 0 && allProcessed.length === 0) {
            container.innerHTML = renderEmptyState('Belum ada data permohonan izin asatidz.');
            return;
        }

        let html = '';

        // 1. Bagian Permohonan Menunggu Restu (PENDING)
        if (allPending.length > 0) {
            html += `
                <div class="flex items-center justify-between pb-1">
                    <span class="text-[11px] font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider flex items-center gap-1.5">
                        <i class="fa-solid fa-hourglass-half text-amber-500"></i>
                        <span>Perlu Tindakan Pengasuh (${allPending.length})</span>
                    </span>
                    <span class="text-[10px] text-slate-400">Pilih Qobul untuk mengaktifkan Badal</span>
                </div>
            `;

            allPending.forEach(item => {
                const sesiLabel = getSesiLabel(item.sesi);
                const tglRange = (item.tanggalMulai === item.tanggalSelesai || !item.tanggalSelesai)
                    ? formatDateIndo(item.tanggalMulai)
                    : `${formatDateIndo(item.tanggalMulai)} s/d ${formatDateIndo(item.tanggalSelesai)}`;

                html += `
                    <div class="p-4 rounded-3xl border-2 border-amber-300/90 dark:border-amber-700/70 bg-white dark:bg-[#1c2836] shadow-sm space-y-3 transition hover:shadow-md">
                        <div class="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-[#253447] pb-2.5">
                            <div class="flex items-center gap-2.5">
                                <div class="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 flex items-center justify-center text-sm font-bold shadow-xs shrink-0">
                                    <i class="fa-solid fa-user-clock"></i>
                                </div>
                                <div>
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <h4 class="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100">${escapeHtml(item.namaAsatidz || item.nama_asatidz)}</h4>
                                        <span class="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/60">${escapeHtml(item.kategori || 'Izin')}</span>
                                    </div>
                                    <span class="text-[11px] font-mono text-slate-400 mt-0.5 block">
                                        <i class="fa-regular fa-calendar mr-1"></i>${tglRange} • <i class="fa-regular fa-clock mr-1"></i>${sesiLabel}
                                    </span>
                                </div>
                            </div>
                            <span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 shrink-0">
                                <i class="fa-solid fa-clock mr-1"></i>Menunggu Restu
                            </span>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                            <div class="p-2.5 rounded-2xl bg-slate-50 dark:bg-[#15202d] border border-slate-100 dark:border-[#253447] space-y-1">
                                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Alasan Berhalangan:</span>
                                <p class="text-slate-700 dark:text-slate-200 font-medium">${escapeHtml(item.alasan || '-')}</p>
                                ${item.lampiranUrl ? `
                                    <div class="pt-1">
                                        <a href="${escapeHtml(item.lampiranUrl)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:underline">
                                            <i class="fa-solid fa-paperclip"></i> Buka Lampiran Surat/Bukti
                                        </a>
                                    </div>
                                ` : ''}
                            </div>

                            <div class="p-2.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 space-y-1">
                                <span class="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider block flex items-center gap-1">
                                    <i class="fa-solid fa-handshake-angle"></i> Ustadz Badal (Pengganti):
                                </span>
                                <p class="font-bold text-indigo-950 dark:text-indigo-200 text-xs">${escapeHtml(item.namaBadal || item.nama_badal || '-')}</p>
                                ${item.catatanBadal ? `
                                    <div class="text-[10.5px] text-indigo-900/80 dark:text-indigo-300/80 italic mt-0.5 border-t border-indigo-100 dark:border-indigo-900/50 pt-1">
                                        "${escapeHtml(item.catatanBadal)}"
                                    </div>
                                ` : ''}
                            </div>
                        </div>

                        <!-- Form Persetujuan Langsung Pengasuh -->
                        <div class="pt-2 border-t border-slate-100 dark:border-[#253447] space-y-2">
                            <div>
                                <label class="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    <i class="fa-solid fa-pen-fancy text-amber-500 mr-1"></i>Dawuh / Catatan Restu Pengasuh <span class="text-slate-400 font-normal">(Opsional)</span>:
                                </label>
                                <input type="text" id="catatan-pengasuh-${escapeHtml(item.idIzin)}" placeholder="Contoh: Syafahullah, semoga lekas sehat. Halaqah diamanahkan ke Ustadz Badal." class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#253447] text-xs bg-slate-50 dark:bg-[#15202d] text-slate-800 dark:text-slate-100 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition" />
                            </div>

                            <div class="flex items-center justify-end gap-2 pt-1">
                                <button type="button" id="btn-tolak-${escapeHtml(item.idIzin)}" onclick="processApprovalAction('${escapeHtml(item.idIzin)}', 'REJECTED')" class="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 dark:text-rose-300 font-bold rounded-xl text-xs transition border border-rose-200 dark:border-rose-900/60 active:scale-95 flex items-center gap-1.5">
                                    <i class="fa-solid fa-ban text-[11px]"></i>
                                    <span>Tolak</span>
                                </button>
                                <button type="button" id="btn-setujui-${escapeHtml(item.idIzin)}" onclick="processApprovalAction('${escapeHtml(item.idIzin)}', 'APPROVED')" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition active:scale-95 flex items-center gap-1.5">
                                    <i class="fa-solid fa-check-double text-[11px]"></i>
                                    <span>Beri Restu (Qobul)</span>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        // 2. Bagian Riwayat yang Telah Diproses (APPROVED / REJECTED)
        if (allProcessed.length > 0) {
            html += `
                <div class="pt-4 flex items-center justify-between pb-1 border-t border-slate-200/60 dark:border-[#253447]">
                    <span class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <i class="fa-solid fa-clock-rotate-left"></i>
                        <span>Riwayat Izin yang Telah Diproses (${allProcessed.length})</span>
                    </span>
                </div>
            `;

            allProcessed.forEach(item => {
                const statusBadge = getStatusBadge(item.status);
                const sesiLabel = getSesiLabel(item.sesi);
                const tglRange = (item.tanggalMulai === item.tanggalSelesai || !item.tanggalSelesai)
                    ? formatDateIndo(item.tanggalMulai)
                    : `${formatDateIndo(item.tanggalMulai)} s/d ${formatDateIndo(item.tanggalSelesai)}`;

                html += `
                    <div class="p-3.5 rounded-2xl border border-slate-200/80 dark:border-[#253447] bg-white dark:bg-[#1c2836] shadow-2xs space-y-2 opacity-90 transition hover:opacity-100">
                        <div class="flex items-start justify-between gap-2">
                            <div>
                                <div class="flex items-center gap-2">
                                    <h4 class="font-bold text-xs text-slate-800 dark:text-slate-100">${escapeHtml(item.namaAsatidz || item.nama_asatidz)}</h4>
                                    <span class="text-[10px] text-slate-400">(${escapeHtml(item.kategori || 'Izin')})</span>
                                </div>
                                <span class="text-[11px] font-mono text-slate-400">${tglRange} • ${sesiLabel}</span>
                            </div>
                            <div>${statusBadge}</div>
                        </div>

                        <div class="p-2 rounded-xl bg-slate-50 dark:bg-[#15202d] text-xs text-slate-600 dark:text-slate-300">
                            <div><strong>Badal:</strong> ${escapeHtml(item.namaBadal || item.nama_badal || '-')}</div>
                            <div><strong>Alasan:</strong> ${escapeHtml(item.alasan || '-')}</div>
                        </div>

                        ${item.pengasuhApprovedBy ? `
                            <div class="text-[10.5px] text-emerald-700 dark:text-emerald-300 flex items-center justify-between border-t border-slate-100 dark:border-[#253447] pt-1">
                                <span><i class="fa-solid fa-circle-check mr-1 text-emerald-600"></i>Diproses oleh: <strong>${escapeHtml(item.pengasuhApprovedBy)}</strong></span>
                                ${item.catatanPengasuh ? `<span class="italic text-slate-400 truncate max-w-[200px]" title="${escapeHtml(item.catatanPengasuh)}">"${escapeHtml(item.catatanPengasuh)}"</span>` : ''}
                            </div>
                        ` : ''}
                    </div>
                `;
            });
        }

        container.innerHTML = html;
    }

    /**
     * Eksekusi Keputusan Persetujuan Pengasuh (Qobul / Tolak)
     */
    async function processApprovalAction(idIzin, decision) {
        if (!idIzin) return;

        const catatanInput = document.getElementById(`catatan-pengasuh-${idIzin}`);
        const catatan = catatanInput ? catatanInput.value.trim() : '';

        if (decision === 'REJECTED' && !catatan) {
            const confirmReject = confirm("Apakah Anda yakin ingin menolak permohonan izin ini tanpa catatan alasan?");
            if (!confirmReject) {
                if (catatanInput) catatanInput.focus();
                return;
            }
        }

        const btnSetujui = document.getElementById(`btn-setujui-${idIzin}`);
        const btnTolak = document.getElementById(`btn-tolak-${idIzin}`);

        if (btnSetujui) btnSetujui.disabled = true;
        if (btnTolak) btnTolak.disabled = true;

        const current = getCurrentAsatidzIdentity();
        const approverName = current.name || 'Dewan Pengasuh';
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : (sessionStorage.getItem('mubarokah_admin_token') || sessionStorage.getItem('asnawiyyah_admin_token'))) || '';

        const payload = {
            idIzin: idIzin,
            decision: decision,
            catatan: catatan,
            approvedBy: approverName,
            token: token
        };

        alertToast('⏳ Memproses keputusan Pengasuh...', 'info');

        try {
            let res = null;

            // 1. Kirim ke Google Apps Script Backend
            if (typeof apiPost === 'function') {
                try {
                    res = await apiPost('approveIzinAsatidz', payload);
                } catch (apiErr) {
                    console.warn('[API APPROVE IZIN ASATIDZ FALLBACK]', apiErr);
                }
            }

            // Fallback via direct fetch
            if (!res || !res.success) {
                const apiUrl = (window.APP_CONFIG && window.APP_CONFIG.API_URL) || (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '');
                if (apiUrl) {
                    const fetchRes = await fetch(apiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'approveIzinAsatidz', data: payload, token: token })
                    });
                    res = await fetchRes.json();
                }
            }

            // Update status di local cache
            updateLocalIzinCacheStatus(idIzin, decision, approverName, catatan);

            if (decision === 'APPROVED') {
                alertToast('🤲 Alhamdulillah, permohonan izin disetujui (Qobul). Pendelegasian halaqah ke Ustadz Badal telah aktif!', 'success');
            } else {
                alertToast('Permohonan izin Asatidz telah ditolak.', 'info');
            }

            // Segarkan data izin dan antarmuka
            await loadIzinAsatidzHistory();

            // Segarkan data halaqah tahfidz jika sedang terbuka agar delegasi langsung aktif
            if (typeof loadAdminTahfidzData === 'function') {
                loadAdminTahfidzData(true);
            }

        } catch (err) {
            console.error('[PROCESS APPROVAL ACTION ERROR]', err);
            alertToast('Gagal memproses persetujuan: ' + (err.message || 'Terjadi kesalahan sistem'), 'error');
        } finally {
            if (btnSetujui) btnSetujui.disabled = false;
            if (btnTolak) btnTolak.disabled = false;
        }
    }

    // Helper: Local cache
    function getLocalIzinCache() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_IZIN_FALLBACK);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function saveToLocalIzinCache(item) {
        try {
            const list = getLocalIzinCache();
            const filtered = list.filter(i => String(i.idIzin) !== String(item.idIzin));
            filtered.unshift(item);
            localStorage.setItem(STORAGE_KEY_IZIN_FALLBACK, JSON.stringify(filtered.slice(0, 100)));
        } catch (e) {}
    }

    function updateLocalIzinCacheStatus(idIzin, status, approvedBy, catatan) {
        try {
            const list = getLocalIzinCache();
            const found = list.find(i => String(i.idIzin) === String(idIzin));
            if (found) {
                found.status = status;
                found.pengasuhApprovedBy = approvedBy;
                found.catatanPengasuh = catatan;
                found.pengasuhApprovedAt = new Date().toISOString();
                found.updatedAt = new Date().toISOString();
                localStorage.setItem(STORAGE_KEY_IZIN_FALLBACK, JSON.stringify(list));
            }
        } catch (e) {}
    }

    // Helper: Badge Status
    function getStatusBadge(status) {
        const st = String(status || 'PENDING').toUpperCase();
        if (st === 'APPROVED' || st === 'DISETUJUI') {
            return `<span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300/60"><i class="fa-solid fa-check mr-1"></i>Disetujui</span>`;
        }
        if (st === 'REJECTED' || st === 'DITOLAK') {
            return `<span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300/60"><i class="fa-solid fa-xmark mr-1"></i>Ditolak</span>`;
        }
        return `<span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300/60"><i class="fa-solid fa-clock mr-1"></i>Menunggu Pengasuh</span>`;
    }

    // Helper: Label Sesi
    function getSesiLabel(sesi) {
        const s = String(sesi || 'FULL_DAY').toUpperCase();
        if (s === 'SUBUH') return "Sesi Subuh";
        if (s === 'ASHAR') return "Sesi Ashar";
        if (s === 'MAGHRIB') return "Sesi Maghrib-Isya";
        return "Seharian Penuh";
    }

    // Helper: Render Loading State
    function renderLoadingState(text) {
        return `
            <div class="py-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-2">
                <i class="fa-solid fa-circle-notch fa-spin text-xl text-emerald-600"></i>
                <span>${escapeHtml(text)}</span>
            </div>
        `;
    }

    // Helper: Render Empty State
    function renderEmptyState(text) {
        return `
            <div class="py-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-1.5 border border-dashed border-slate-200 dark:border-[#253447] rounded-2xl">
                <i class="fa-regular fa-folder-open text-2xl text-slate-300 dark:text-slate-600"></i>
                <span class="max-w-xs">${escapeHtml(text)}</span>
            </div>
        `;
    }

    // Helper: Notifikasi Toast / Alert
    function alertToast(msg, type = 'info') {
        if (typeof showToast === 'function') {
            showToast(msg);
        } else if (typeof showAdminToast === 'function') {
            showAdminToast(msg, type);
        } else {
            alert(msg);
        }
    }

    /**
     * Helper: Dapatkan informasi delegasi badal aktif hari ini untuk halaqah atau muhafiz tertentu
     * @param {Object|string} target - Objek halaqah atau nama muhafiz
     * @returns {Object|null} Informasi delegasi badal atau null
     */
    function getHalaqahDelegation(target) {
        if (!target) return null;

        // 1. Jika objek halaqah sudah membawa delegasi aktif dari backend Apps Script
        if (typeof target === 'object' && target.delegation && target.delegation.isDelegated) {
            return target.delegation;
        }

        // 2. Ambil nama muhafiz / nama halaqah
        const rawName = typeof target === 'object'
            ? (target.muhafiz || target.namaHalaqah || target.nama || '')
            : String(target || '');

        const cleanTarget = String(rawName).trim().toLowerCase()
            .replace(/^(ustadz|ustadzah|ust\.|ustd\.|kyai|nyai|gus|ning)\s+/i, '').trim();
        if (!cleanTarget) return null;

        // 3. Cek daftar izin di runtime memory (ASNIzinAsatidz.list atau local cache)
        let list = (Array.isArray(ASNIzinAsatidz.list) && ASNIzinAsatidz.list.length > 0)
            ? ASNIzinAsatidz.list
            : getLocalIzinCache();

        if (!Array.isArray(list) || list.length === 0) return null;

        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        for (const item of list) {
            const st = String(item.status || '').toUpperCase();
            if (st !== 'APPROVED' && st !== 'DISETUJUI') continue;

            const tMulai = String(item.tanggalMulai || item.tanggal_mulai || '').trim();
            const tSelesai = String(item.tanggalSelesai || item.tanggal_selesai || tMulai).trim();
            if (tMulai && (todayStr < tMulai || todayStr > tSelesai)) continue;

            const iAsatidz = String(item.namaAsatidz || item.nama_asatidz || '').trim().toLowerCase();
            const cleanAsatidz = iAsatidz.replace(/^(ustadz|ustadzah|ust\.|ustd\.|kyai|nyai|gus|ning)\s+/i, '').trim();

            if (cleanTarget === cleanAsatidz || (cleanTarget.length >= 3 && cleanAsatidz.includes(cleanTarget)) || (cleanAsatidz.length >= 3 && cleanTarget.includes(cleanAsatidz))) {
                return {
                    isDelegated: true,
                    badalId: item.badalId || item.badal_id || '',
                    namaBadal: item.namaBadal || item.nama_badal || 'Ustadz Badal',
                    sesi: item.sesi || 'FULL_DAY',
                    catatanBadal: item.catatanBadal || item.catatan_badal || '',
                    idIzin: item.idIzin || item.id_izin || ''
                };
            }
        }

        return null;
    }

    // Expose public functions to window
    window.openIzinAsatidzModal = openIzinAsatidzModal;
    window.closeIzinAsatidzModal = closeIzinAsatidzModal;
    window.submitIzinAsatidzForm = submitIzinAsatidzForm;
    window.setIzinAsatidzSesi = setIzinAsatidzSesi;
    window.setIzinAsatidzKategori = setIzinAsatidzKategori;
    window.switchIzinAsatidzTab = switchIzinAsatidzTab;
    window.loadIzinAsatidzHistory = loadIzinAsatidzHistory;
    window.canApproveIzinAsatidz = canApproveIzinAsatidz;
    window.renderApprovalList = renderApprovalList;
    window.processApprovalAction = processApprovalAction;
    window.getHalaqahDelegation = getHalaqahDelegation;

})(window, document);
