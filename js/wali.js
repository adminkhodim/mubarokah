/**
 * ====================================================================
 * MODUL DATA WALI SANTRI & KELUARGA (ASNAWIYYAH-STYLE ADAPTATION)
 * PPTQ Roudlotul Mubarokah Kudus
 * ====================================================================
 * Fitur:
 * 1. 5 KPI Makro: Wali Terdaftar, Santri Terhubung, Multi-Santri, Akun Aktif, Belum Terhubung
 * 2. Filter Tab: Semua, Multi-Santri (>=2 Anak), 1 Santri, Belum Terhubung
 * 3. Pemetaan Many-to-Many Wali & Santri (Kakak-Beradik / Anak Asuhan)
 * 4. Integrasi No. WhatsApp terpusat ke WhatsApp Billing & Kuitansi Otomatis
 * 5. Sinkronisasi Cepat Supabase PostgreSQL (public.guardians & public.student_guardians)
 */

(function () {
    'use strict';

    window.adminWaliData = [];
    window.adminUnlinkedStudents = [];
    let activeWaliFilter = 'all';
    let waliSearchQuery = '';

    /**
     * Memuat Seluruh Data Wali Santri & Relasi Anak Asuhan
     */
    async function loadAdminWaliData(forceReload = false) {
        const loader = document.getElementById('admin-wali-loader');
        const tbody = document.getElementById('admin-wali-table-tbody');
        const mobileList = document.getElementById('admin-wali-mobile-list');
        const refreshIcon = document.getElementById('admin-wali-refresh-icon');

        if (refreshIcon) refreshIcon.classList.add('fa-spin');
        if (loader && (!window.adminWaliData || window.adminWaliData.length === 0 || forceReload)) {
            loader.classList.remove('hidden');
        }

        try {
            // 1. Pastikan Data Santri Induk sudah ada di memory
            if (!window.adminStudentsData || window.adminStudentsData.length === 0) {
                if (typeof loadAdminStudentsData === 'function') {
                    await loadAdminStudentsData(false);
                }
            }
            const allStudents = window.adminStudentsData || [];

            // 2. Ambil Data Wali & Relasi dari Supabase
            let rawGuardians = [];
            if (window.MubarokahSupabase && typeof window.MubarokahSupabase.fetchGuardiansWithRelations === 'function') {
                rawGuardians = await window.MubarokahSupabase.fetchGuardiansWithRelations();
            }

            // Fallback jika Supabase belum ada data: generate dari relasi lokal atau user_identities
            if (!rawGuardians || rawGuardians.length === 0) {
                console.info("[WALI] Mengambil fallback data wali dari API Apps Script...");
                try {
                    const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : null) || "";
                    if (typeof apiPost === 'function') {
                        const res = await apiPost("getWaliSantriList", { token });
                        if (res && res.success && Array.isArray(res.data)) {
                            rawGuardians = res.data;
                        }
                    }
                } catch (apiErr) {
                    console.warn("[WALI] Fallback API Apps Script:", apiErr);
                }
            }

            // 3. Normalisasikan Data Wali
            const studentLinkedSet = new Set();
            const normalizedWali = (rawGuardians || []).map((w, idx) => {
                const id = w.id || w.identity_id || `WALI_${idx + 1}`;
                const identityId = w.identity_id || id;
                const name = String(w.name || w.nama || 'Wali Santri').trim();
                const email = String(w.email || '').trim();
                const phone = String(w.phone || w.whatsapp || w.no_hp || '').trim();
                const status = String(w.status || 'ACTIVE').toUpperCase();

                // Format daftar santri terhubung
                const linkedStudents = [];
                const relations = w.student_guardians || w.students || [];

                relations.forEach(rel => {
                    const st = rel.students || rel;
                    const stId = st.student_id || st.studentId || rel.student_id;
                    const stUuid = st.id || rel.student_id;
                    const stName = st.name || st.student_name || 'Santri';
                    const stNis = st.nis || st.nisn || '';
                    const stProgram = st.program || '';

                    if (stId || stUuid) {
                        studentLinkedSet.add(stId || stUuid);
                        linkedStudents.push({
                            relationId: rel.id || null,
                            studentUuid: stUuid,
                            studentId: stId,
                            name: stName,
                            nis: stNis,
                            program: stProgram,
                            relationship: String(rel.relationship || 'GUARDIAN').toUpperCase()
                        });
                    }
                });

                return {
                    id: id,
                    identityId: identityId,
                    name: name,
                    email: email,
                    phone: phone,
                    status: status,
                    students: linkedStudents
                };
            });

            window.adminWaliData = normalizedWali;

            // 4. Hitung Santri yang Belum Terhubung ke Wali manapun
            window.adminUnlinkedStudents = allStudents.filter(st => {
                const sId = st.studentId || st.student_id || st.id;
                return !studentLinkedSet.has(sId);
            });

            // 5. Update KPI Cards & Render
            updateWaliStats();
            filterAdminWaliList();

        } catch (err) {
            console.error("[WALI] Gagal memuat data wali:", err);
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-rose-500 text-xs">Gagal memuat data: ${err.message}</td></tr>`;
            }
        } finally {
            if (loader) loader.classList.add('hidden');
            if (refreshIcon) refreshIcon.classList.remove('fa-spin');
        }
    }
    window.loadAdminWaliData = loadAdminWaliData;

    /**
     * Hitung 5 Kartu Makro KPI Data Wali Santri
     */
    function updateWaliStats() {
        const waliList = window.adminWaliData || [];
        const unlinked = window.adminUnlinkedStudents || [];

        const totalWali = waliList.length;
        const activeAccounts = waliList.filter(w => w.status === 'ACTIVE' || w.status === 'AKTIF').length;
        
        let totalLinkedSantri = 0;
        const linkedSantriIds = new Set();
        let multiWaliCount = 0;

        waliList.forEach(w => {
            const count = w.students.length;
            if (count >= 2) multiWaliCount++;
            w.students.forEach(st => {
                const key = st.studentId || st.studentUuid;
                if (key && !linkedSantriIds.has(key)) {
                    linkedSantriIds.add(key);
                    totalLinkedSantri++;
                }
            });
        });

        // Update DOM Cards
        const elTotalWali = document.getElementById('stat-wali-total');
        const elLinkedSantri = document.getElementById('stat-wali-linked-santri');
        const elMultiWali = document.getElementById('stat-wali-multi');
        const elActiveAccounts = document.getElementById('stat-wali-active');
        const elUnlinked = document.getElementById('stat-wali-unlinked');

        if (elTotalWali) elTotalWali.textContent = totalWali;
        if (elLinkedSantri) elLinkedSantri.textContent = totalLinkedSantri;
        if (elMultiWali) elMultiWali.textContent = multiWaliCount;
        if (elActiveAccounts) elActiveAccounts.textContent = activeAccounts;
        if (elUnlinked) elUnlinked.textContent = unlinked.length;

        // Update Tab Badges
        const badgeAll = document.getElementById('tab-wali-badge-all');
        const badgeMulti = document.getElementById('tab-wali-badge-multi');
        const badgeSingle = document.getElementById('tab-wali-badge-single');
        const badgeUnlinked = document.getElementById('tab-wali-badge-unlinked');

        if (badgeAll) badgeAll.textContent = totalWali;
        if (badgeMulti) badgeMulti.textContent = multiWaliCount;
        if (badgeSingle) badgeSingle.textContent = waliList.filter(w => w.students.length === 1).length;
        if (badgeUnlinked) badgeUnlinked.textContent = unlinked.length;
    }

    /**
     * Set Filter Tab Aktif (all, multi, single, unlinked)
     */
    function setWaliFilter(filterType) {
        activeWaliFilter = filterType;
        document.querySelectorAll('.wali-filter-btn').forEach(btn => {
            if (btn.dataset.filter === filterType) {
                btn.classList.add('bg-emerald-600', 'text-white', 'font-bold', 'shadow-xs');
                btn.classList.remove('bg-white', 'text-slate-600', 'hover:bg-slate-100', 'dark:bg-[#15202d]', 'dark:text-slate-300');
            } else {
                btn.classList.remove('bg-emerald-600', 'text-white', 'font-bold', 'shadow-xs');
                btn.classList.add('bg-white', 'text-slate-600', 'hover:bg-slate-100', 'dark:bg-[#15202d]', 'dark:text-slate-300');
            }
        });
        filterAdminWaliList();
    }
    window.setWaliFilter = setWaliFilter;

    /**
     * Event Listener Pencarian Data Wali
     */
    function onWaliSearchInput(e) {
        waliSearchQuery = (e.target.value || '').trim().toLowerCase();
        filterAdminWaliList();
    }
    window.onWaliSearchInput = onWaliSearchInput;

    /**
     * Filter & Render Data Wali Santri
     */
    function filterAdminWaliList() {
        const tbody = document.getElementById('admin-wali-table-tbody');
        const mobileList = document.getElementById('admin-wali-mobile-list');
        const emptyState = document.getElementById('admin-wali-empty-state');
        if (!tbody) return;

        // JIKA TAB 'UNLINKED' DIPILIH: TAMPILKAN SANTRI YANG BELUM PUNYA WALI
        if (activeWaliFilter === 'unlinked') {
            renderUnlinkedStudentsTable();
            return;
        }

        let filtered = (window.adminWaliData || []).filter(w => {
            // 1. Filter Kategori
            if (activeWaliFilter === 'multi' && w.students.length < 2) return false;
            if (activeWaliFilter === 'single' && w.students.length !== 1) return false;

            // 2. Filter Search
            if (waliSearchQuery) {
                const matchName = w.name.toLowerCase().includes(waliSearchQuery);
                const matchEmail = w.email.toLowerCase().includes(waliSearchQuery);
                const matchPhone = w.phone.toLowerCase().includes(waliSearchQuery);
                const matchStudent = w.students.some(st => 
                    st.name.toLowerCase().includes(waliSearchQuery) || 
                    st.nis.toLowerCase().includes(waliSearchQuery)
                );
                return matchName || matchEmail || matchPhone || matchStudent;
            }
            return true;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="py-12 text-center text-slate-400 text-xs">Tidak ada data wali santri yang sesuai dengan filter.</td></tr>`;
            if (mobileList) mobileList.innerHTML = `<div class="p-6 bg-white dark:bg-[#15202d] rounded-2xl text-center text-slate-400 text-xs">Tidak ada data wali santri.</div>`;
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }
        if (emptyState) emptyState.classList.add('hidden');

        // Render Desktop Table
        tbody.innerHTML = filtered.map((w, idx) => {
            const rawPhone = w.phone.replace(/[^0-9]/g, '');
            const waNumber = rawPhone.startsWith('0') ? '62' + rawPhone.slice(1) : rawPhone;
            
            const waButton = waNumber ? `
                <a href="https://wa.me/${waNumber}?text=Assalamu'alaikum%20Bapak/Ibu%20${encodeURIComponent(w.name)}" target="_blank"
                   class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 text-xs font-mono font-bold transition">
                    <i class="fa-brands fa-whatsapp text-emerald-600"></i>
                    <span>${w.phone}</span>
                </a>
            ` : `<span class="text-xs text-slate-400 italic">- Belum ada -</span>`;

            // Badge Anak Asuhan
            const studentsBadges = w.students.length > 0 ? w.students.map(st => {
                let relLabel = "Wali";
                if (st.relationship === "FATHER") relLabel = "Ayah";
                if (st.relationship === "MOTHER") relLabel = "Ibu";

                return `
                    <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-[#1e2a38] border border-slate-200/70 dark:border-[#283a4e] text-xs">
                        <i class="fa-solid fa-graduation-cap text-emerald-600 text-[10px]"></i>
                        <span class="font-bold text-slate-800 dark:text-slate-100">${escapeHtml(st.name)}</span>
                        ${st.nis ? `<span class="text-[10px] text-slate-400 font-mono">(${st.nis})</span>` : ''}
                        <span class="text-[9px] px-1.5 py-0.2 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-semibold">${relLabel}</span>
                        ${st.relationId ? `
                            <button type="button" onclick="unlinkStudentWali('${st.relationId}', '${escapeHtml(st.name)}', '${escapeHtml(w.name)}')" 
                                class="text-slate-400 hover:text-rose-500 ml-1 transition" title="Lepas Relasi">
                                <i class="fa-solid fa-xmark text-[10px]"></i>
                            </button>
                        ` : ''}
                    </div>
                `;
            }).join(' ') : `<span class="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-lg border border-amber-200/50 text-[11px] font-medium"><i class="fa-solid fa-triangle-exclamation mr-1"></i> Belum ada santri terhubung</span>`;

            const statusBadge = (w.status === 'ACTIVE' || w.status === 'AKTIF')
                ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 text-[10px] font-bold"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Aktif</span>`
                : `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-[10px] font-bold">Nonaktif</span>`;

            const avatarChar = (w.name.charAt(0) || 'W').toUpperCase();

            return `
                <tr class="border-b border-slate-100 dark:border-[#253447] hover:bg-slate-50/60 dark:hover:bg-[#182332] transition">
                    <td class="py-3 px-3 text-center text-slate-400 font-medium">${idx + 1}</td>
                    <td class="py-3 px-3">
                        <div class="flex items-center gap-3">
                            <div class="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                                ${avatarChar}
                            </div>
                            <div class="min-w-0">
                                <div class="font-bold text-slate-800 dark:text-slate-100 text-xs">${escapeHtml(w.name)}</div>
                                <div class="text-[11px] text-slate-400 truncate">${escapeHtml(w.email || w.identityId)}</div>
                            </div>
                        </div>
                    </td>
                    <td class="py-3 px-3">${waButton}</td>
                    <td class="py-3 px-3 max-w-md">
                        <div class="flex flex-wrap gap-1.5 items-center">${studentsBadges}</div>
                    </td>
                    <td class="py-3 px-3">${statusBadge}</td>
                    <td class="py-3 px-3 text-right">
                        <div class="flex items-center justify-end gap-1.5">
                            <button type="button" onclick="openAdminLinkSantriModal('${w.id}', '${escapeHtml(w.name)}')" 
                                class="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold rounded-xl text-[11px] transition inline-flex items-center gap-1"
                                title="Hubungkan Santri Baru ke Wali Ini">
                                <i class="fa-solid fa-plus text-[10px]"></i>
                                <span>Tambah Anak</span>
                            </button>
                            <button type="button" onclick='openAdminWaliModal(${JSON.stringify(w).replace(/'/g, "&apos;")})' 
                                class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1e2a38] text-slate-700 dark:text-slate-300 flex items-center justify-center transition"
                                title="Edit Data Wali">
                                <i class="fa-solid fa-pen text-xs"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Render Mobile Cards
        if (mobileList) {
            mobileList.innerHTML = filtered.map(w => {
                const avatarChar = (w.name.charAt(0) || 'W').toUpperCase();
                return `
                    <div class="p-4 bg-white dark:bg-[#15202d] rounded-2xl border border-slate-100 dark:border-[#253447] space-y-3 shadow-xs">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-2.5">
                                <div class="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
                                    ${avatarChar}
                                </div>
                                <div>
                                    <h4 class="font-bold text-slate-800 dark:text-slate-100 text-xs">${escapeHtml(w.name)}</h4>
                                    <p class="text-[10px] text-slate-400">${escapeHtml(w.phone || w.email || '-')}</p>
                                </div>
                            </div>
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-md ${w.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}">${w.status}</span>
                        </div>
                        <div class="text-[11px] text-slate-600 dark:text-slate-300">
                            <div class="text-[10px] text-slate-400 uppercase font-bold mb-1">Anak Asuhan:</div>
                            <div class="flex flex-wrap gap-1">${w.students.length > 0 ? w.students.map(s => `<span class="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-[#1e2a38] text-xs font-semibold">${escapeHtml(s.name)}</span>`).join('') : '<span class="text-amber-500 text-xs">Belum terhubung</span>'}</div>
                        </div>
                        <div class="pt-2 border-t border-slate-100 dark:border-[#253447] flex justify-end gap-2">
                            <button type="button" onclick="openAdminLinkSantriModal('${w.id}', '${escapeHtml(w.name)}')" class="px-3 py-1 bg-emerald-600 text-white rounded-xl text-xs font-bold">+ Anak</button>
                            <button type="button" onclick='openAdminWaliModal(${JSON.stringify(w).replace(/'/g, "&apos;")})' class="px-3 py-1 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold">Edit</button>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    /**
     * Tampilan Khusus Tab "Belum Terhubung" (Menampilkan Santri yang Perlu Ditautkan ke Wali)
     */
    function renderUnlinkedStudentsTable() {
        const tbody = document.getElementById('admin-wali-table-tbody');
        const unlinked = window.adminUnlinkedStudents || [];
        if (!tbody) return;

        if (unlinked.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="py-12 text-center text-emerald-600 font-bold text-xs"><i class="fa-solid fa-circle-check text-lg mb-1 block"></i> Alhamdulillah, seluruh santri telah terhubung ke wali santri masing-masing!</td></tr>`;
            return;
        }

        tbody.innerHTML = unlinked.map((st, idx) => `
            <tr class="border-b border-slate-100 dark:border-[#253447] hover:bg-rose-50/30 dark:hover:bg-rose-950/20 transition">
                <td class="py-3 px-3 text-center text-slate-400 font-medium">${idx + 1}</td>
                <td class="py-3 px-3">
                    <div class="font-bold text-slate-800 dark:text-slate-100 text-xs">${escapeHtml(st.name || st.nama)}</div>
                    <div class="text-[10px] text-slate-400 font-mono">NIS: ${escapeHtml(st.nis || '-')} | ID: ${escapeHtml(st.studentId || st.id)}</div>
                </td>
                <td class="py-3 px-3 font-mono text-xs text-slate-600 dark:text-slate-300">${escapeHtml(st.phone || st.whatsapp || '-')}</td>
                <td class="py-3 px-3">
                    <span class="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                        <i class="fa-solid fa-link-slash mr-1"></i> Belum Terhubung
                    </span>
                </td>
                <td class="py-3 px-3">
                    <span class="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">${escapeHtml(st.program || 'Reguler')}</span>
                </td>
                <td class="py-3 px-3 text-right">
                    <button type="button" onclick="openAdminLinkSantriModal(null, null, '${st.studentId || st.id}')"
                        class="px-3 py-1.5 bg-brand-700 hover:bg-brand-800 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1 shadow-xs">
                        <i class="fa-solid fa-link text-xs"></i>
                        <span>Hubungkan ke Wali</span>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    /**
     * Buka Modal Tambah / Edit Wali Santri
     */
    function openAdminWaliModal(wali = null) {
        const modal = document.getElementById('modal-admin-wali');
        const title = document.getElementById('modal-admin-wali-title');
        const form = document.getElementById('adminWaliForm');
        if (!modal || !form) return;

        form.reset();
        if (wali) {
            title.textContent = "Edit Data Wali Santri";
            document.getElementById('admin-wali-form-id').value = wali.id || '';
            document.getElementById('admin-wali-form-identity').value = wali.identityId || '';
            document.getElementById('admin-wali-form-name').value = wali.name || '';
            document.getElementById('admin-wali-form-phone').value = wali.phone || '';
            document.getElementById('admin-wali-form-email').value = wali.email || '';
            document.getElementById('admin-wali-form-status').value = wali.status || 'ACTIVE';
        } else {
            title.textContent = "Tambah Wali Santri Baru";
            document.getElementById('admin-wali-form-id').value = '';
            document.getElementById('admin-wali-form-identity').value = '';
            document.getElementById('admin-wali-form-status').value = 'ACTIVE';
        }

        modal.classList.remove('hidden');
    }
    window.openAdminWaliModal = openAdminWaliModal;

    function closeAdminWaliModal() {
        const modal = document.getElementById('modal-admin-wali');
        if (modal) modal.classList.add('hidden');
    }
    window.closeAdminWaliModal = closeAdminWaliModal;

    /**
     * Submit Form Simpan Wali Santri (Dual-Write ke Supabase & Google Sheets)
     */
    async function submitAdminWaliForm(e) {
        e.preventDefault();
        const btn = document.getElementById('admin-wali-submit-btn');
        const id = document.getElementById('admin-wali-form-id').value;
        const identityId = document.getElementById('admin-wali-form-identity').value;
        const name = (document.getElementById('admin-wali-form-name').value || '').trim();
        const phone = (document.getElementById('admin-wali-form-phone').value || '').trim();
        const email = (document.getElementById('admin-wali-form-email').value || '').trim();
        const status = document.getElementById('admin-wali-form-status').value;

        if (!name) {
            alert("Nama lengkap wali santri wajib diisi.");
            return;
        }

        if (btn) btn.disabled = true;

        try {
            const payload = {
                id: id || undefined,
                identity_id: identityId || undefined,
                name: name,
                phone: phone,
                email: email,
                status: status
            };

            // 1. Simpan ke Supabase
            if (window.MubarokahSupabase && typeof window.MubarokahSupabase.saveGuardian === 'function') {
                await window.MubarokahSupabase.saveGuardian(payload);
            }

            // 2. Simpan ke Apps Script (Dual Write)
            try {
                const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : null) || "";
                if (typeof apiPost === 'function') {
                    await apiPost("saveWaliIdentity", { token, ...payload });
                }
            } catch (postErr) {
                console.warn("[WALI] Apps script sync warn:", postErr);
            }

            if (typeof showToast === 'function') {
                showToast("✅ Data wali santri berhasil disimpan!");
            }

            closeAdminWaliModal();
            await loadAdminWaliData(true);

        } catch (err) {
            console.error("[WALI] Error simpan wali:", err);
            alert("Gagal menyimpan data wali: " + err.message);
        } finally {
            if (btn) btn.disabled = false;
        }
    }
    window.submitAdminWaliForm = submitAdminWaliForm;

    /**
     * Buka Modal Hubungkan Santri ke Wali
     */
    function openAdminLinkSantriModal(prefilledWaliId = null, prefilledWaliName = null, prefilledStudentId = null) {
        const modal = document.getElementById('modal-admin-link-santri');
        if (!modal) return;

        // Populate Wali Select Dropdown
        const waliSelect = document.getElementById('link-santri-wali-select');
        if (waliSelect) {
            waliSelect.innerHTML = `<option value="">-- Pilih Wali Santri --</option>` + 
                (window.adminWaliData || []).map(w => `
                    <option value="${w.id}" ${prefilledWaliId && String(w.id) === String(prefilledWaliId) ? 'selected' : ''}>
                        ${escapeHtml(w.name)} (${w.phone || w.email || 'Tanpa Kontak'})
                    </option>
                `).join('');
        }

        // Populate Student Select Dropdown
        const studentSelect = document.getElementById('link-santri-student-select');
        if (studentSelect) {
            const allStudents = window.adminStudentsData || [];
            studentSelect.innerHTML = `<option value="">-- Pilih Santri --</option>` +
                allStudents.map(st => {
                    const sId = st.studentId || st.student_id || st.id;
                    const isSelected = prefilledStudentId && String(sId) === String(prefilledStudentId);
                    return `
                        <option value="${st.id || sId}" ${isSelected ? 'selected' : ''}>
                            ${escapeHtml(st.name || st.nama)} (NIS: ${st.nis || '-'}, ${st.program || 'Reguler'})
                        </option>
                    `;
                }).join('');
        }

        modal.classList.remove('hidden');
    }
    window.openAdminLinkSantriModal = openAdminLinkSantriModal;

    function closeAdminLinkSantriModal() {
        const modal = document.getElementById('modal-admin-link-santri');
        if (modal) modal.classList.add('hidden');
    }
    window.closeAdminLinkSantriModal = closeAdminLinkSantriModal;

    /**
     * Submit Relasi Hubungkan Santri ke Wali
     */
    async function submitLinkSantriForm(e) {
        e.preventDefault();
        const btn = document.getElementById('link-santri-submit-btn');
        const guardianId = document.getElementById('link-santri-wali-select').value;
        const studentId = document.getElementById('link-santri-student-select').value;
        const relationship = document.getElementById('link-santri-relasi-select').value || 'GUARDIAN';

        if (!guardianId || !studentId) {
            alert("Silakan pilih Wali Santri dan Santri yang ingin dihubungkan.");
            return;
        }

        if (btn) btn.disabled = true;

        try {
            // 1. Simpan ke Supabase student_guardians
            if (window.MubarokahSupabase && typeof window.MubarokahSupabase.linkStudentGuardian === 'function') {
                await window.MubarokahSupabase.linkStudentGuardian({
                    guardian_id: guardianId,
                    student_id: studentId,
                    relationship: relationship
                });
            }

            // 2. Dual write ke Google Sheets jika ada
            try {
                const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : null) || "";
                if (typeof apiPost === 'function') {
                    await apiPost("linkStudentToWali", { token, guardianId, studentId, relationship });
                }
            } catch (sheetErr) {
                console.warn("[WALI] Sheet link warning:", sheetErr);
            }

            if (typeof showToast === 'function') {
                showToast("✅ Santri berhasil dihubungkan ke wali!");
            }

            closeAdminLinkSantriModal();
            await loadAdminWaliData(true);

        } catch (err) {
            console.error("[WALI] Gagal hubungkan santri:", err);
            alert("Gagal menghubungkan: " + err.message);
        } finally {
            if (btn) btn.disabled = false;
        }
    }
    window.submitLinkSantriForm = submitLinkSantriForm;

    /**
     * Lepas Relasi Santri dari Wali
     */
    async function unlinkStudentWali(relationId, studentName, guardianName) {
        if (!confirm(`Lepas relasi anak '${studentName}' dari wali '${guardianName}'?`)) return;

        try {
            if (window.MubarokahSupabase && typeof window.MubarokahSupabase.unlinkStudentGuardian === 'function') {
                await window.MubarokahSupabase.unlinkStudentGuardian(relationId);
            }

            if (typeof showToast === 'function') {
                showToast("✅ Relasi santri berhasil dilepas.");
            }

            await loadAdminWaliData(true);

        } catch (err) {
            console.error("[WALI] Gagal lepas relasi:", err);
            alert("Gagal melepas relasi: " + err.message);
        }
    }
    window.unlinkStudentWali = unlinkStudentWali;

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

})();

