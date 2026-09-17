        // ==================== RUNTIME PROGRAM DATA SOURCE & STATE MANAGEMENT ====================
        let RUNTIME_PROGRAM_DATA = [];
        let programRuntimeState = {
            status: "idle", // "idle" | "loading" | "ready" | "empty" | "error"
            error: null,
            requestId: null
        };

        function getProgramUiTheme(prog) {
            const id = prog ? (prog.id || "") : "";
            if (id === "sd-islam") {
                return {
                    berandaBadgeStyle: "bg-blue-600/90 text-white",
                    pilihanBadgeStyle: "bg-blue-500 text-white",
                    headerBadge: "Usia Sekolah Dasar (6 – 12 Tahun)",
                    headerTheme: "from-blue-900 via-blue-800 to-cyan-800",
                    headerIcon: "fa-school",
                    headerCategoryColor: "text-blue-700"
                };
            } else if (id === "tahfidz-anak") {
                return {
                    berandaBadgeStyle: "bg-emerald-800/90 text-white",
                    pilihanBadgeStyle: "bg-amber-500 text-brand-dark",
                    headerBadge: "Usia Sekolah Dasar / MI (6 – 12 Tahun)",
                    headerTheme: "from-brand-900 via-brand-800 to-emerald-800",
                    headerIcon: "fa-child-reaching",
                    headerCategoryColor: "text-brand-700"
                };
            } else if (id === "dewasa-putra") {
                return {
                    berandaBadgeStyle: "bg-slate-900/90 text-white",
                    pilihanBadgeStyle: "bg-brand-600 text-white",
                    headerBadge: "Lulusan SMA / MA / Mahasiswa / Umum (Dewasa)",
                    headerTheme: "from-brand-900 via-brand-800 to-emerald-800",
                    headerIcon: "fa-user-graduate",
                    headerCategoryColor: "text-brand-700"
                };
            } else if (id === "dewasa-putri") {
                return {
                    berandaBadgeStyle: "bg-purple-900/90 text-white",
                    pilihanBadgeStyle: "bg-purple-600 text-white",
                    headerBadge: "Khusus Santriwati Dewasa (Putri)",
                    headerTheme: "from-purple-900 via-purple-800 to-brand-900",
                    headerIcon: "fa-person-shelter",
                    headerCategoryColor: "text-purple-700"
                };
            }
            return {
                berandaBadgeStyle: (prog && prog.berandaBadgeStyle) || "bg-brand-800/90 text-white",
                pilihanBadgeStyle: (prog && prog.pilihanBadgeStyle) || "bg-brand-700 text-white",
                headerBadge: (prog && (prog.headerBadge || prog.badge)) || "Program Pesantren",
                headerTheme: (prog && prog.headerTheme) || "from-brand-900 via-brand-800 to-emerald-800",
                headerIcon: (prog && prog.headerIcon) || "fa-book-quran",
                headerCategoryColor: (prog && prog.headerCategoryColor) || "text-brand-700"
            };
        }

        // ==================== PROGRAM DATA RENDERERS ====================
        function getProgramById(programId) {
            return RUNTIME_PROGRAM_DATA.find(item => item.id === programId);
        }

        async function initializeProgramRuntime() {
            // Render instan dari PROGRAM_DATA lokal (Stale-While-Revalidate) agar halaman tidak pernah kosong
            if (Array.isArray(PROGRAM_DATA) && PROGRAM_DATA.length > 0) {
                RUNTIME_PROGRAM_DATA = [...PROGRAM_DATA];
                programRuntimeState.status = "ready";
                renderProgramAllViews();
            } else {
                programRuntimeState.status = "loading";
                renderProgramLoadingState();
            }

            if (!isApiConfigured()) {
                return;
            }

            try {
                const response = await apiGet("program.listPublished");

                if (!response || typeof response !== "object") {
                    throw new Error("Format respons API tidak valid");
                }

                if (response.success !== true) {
                    const errObj = response.error || {};
                    const errCode = errObj.code || "SERVER_ERROR";
                    const errMsg = errObj.message || "Gagal memuat data program dari server.";
                    throw new Error(`[${errCode}] ${errMsg}`);
                }

                const data = response.data;
                if (!Array.isArray(data) || data.length === 0) {
                    throw new Error("Data program dari server kosong");
                }

                // Validate payload contract items (Fail-Closed per item)
                for (let idx = 0; idx < data.length; idx++) {
                    const prog = data[idx];
                    if (!prog || !prog.id || !prog.name || !prog.badge || !prog.image || !prog.description || !Array.isArray(prog.highlights) || !prog.detail) {
                        throw new Error(`Item program index ${idx} tidak memenuhi kontrak schema.`);
                    }
                }

                programRuntimeState.status = "ready";
                programRuntimeState.requestId = response.requestId || null;
                RUNTIME_PROGRAM_DATA = data;

                // Merge local PROGRAM_DATA for items not present in API (e.g., local dummy templates)
                PROGRAM_DATA.forEach(localProg => {
                    if (!RUNTIME_PROGRAM_DATA.find(p => p.id === localProg.id)) {
                        RUNTIME_PROGRAM_DATA.push(localProg);
                    }
                });

                renderProgramAllViews();

            } catch (err) {
                console.warn("Gagal memuat runtime PROGRAM_DATA via API, beralih ke fallback PROGRAM_DATA lokal:", err);
                if (Array.isArray(PROGRAM_DATA) && PROGRAM_DATA.length > 0) {
                    programRuntimeState.status = "ready";
                    programRuntimeState.error = null;
                    RUNTIME_PROGRAM_DATA = [...PROGRAM_DATA];
                    renderProgramAllViews();
                } else {
                    programRuntimeState.status = "error";
                    programRuntimeState.error = err.message || "Terjadi kesalahan koneksi server.";
                    renderProgramErrorState();
                }
            }
        }

        function renderProgramLoadingState() {
            const showcase = document.getElementById('beranda-program-showcase');
            const grid = document.getElementById('program-pilihan-grid');
            const skeletonHtml = `
                <div class="col-span-full p-8 text-center bg-white rounded-2xl border border-slate-200/80 shadow-sm animate-pulse space-y-3">
                    <i class="fa-solid fa-spinner fa-spin text-brand-600 text-2xl"></i>
                    <p class="text-xs font-semibold text-slate-600">Memuat data program pesantren...</p>
                </div>
            `;
            if (showcase) showcase.innerHTML = skeletonHtml;
            if (grid) grid.innerHTML = skeletonHtml;
        }

        function renderProgramEmptyState() {
            const showcase = document.getElementById('beranda-program-showcase');
            const grid = document.getElementById('program-pilihan-grid');
            const emptyHtml = `
                <div class="col-span-full p-8 text-center bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
                    <i class="fa-solid fa-folder-open text-slate-300 text-3xl"></i>
                    <p class="text-xs font-bold text-slate-600">Tidak ada program yang tersedia saat ini.</p>
                </div>
            `;
            if (showcase) showcase.innerHTML = emptyHtml;
            if (grid) grid.innerHTML = emptyHtml;
        }

        function renderProgramErrorState() {
            const showcase = document.getElementById('beranda-program-showcase');
            const grid = document.getElementById('program-pilihan-grid');
            const reqIdInfo = programRuntimeState.requestId ? `<span class="block text-[10px] text-slate-400 font-mono mt-1">Ref ID: ${escapeHtml(programRuntimeState.requestId)}</span>` : '';
            const errorHtml = `
                <div class="col-span-full p-8 text-center bg-rose-50/80 rounded-2xl border border-rose-200 shadow-sm space-y-2">
                    <i class="fa-solid fa-triangle-exclamation text-rose-500 text-2xl"></i>
                    <p class="text-xs font-bold text-rose-800">Gagal memuat data program pesantren.</p>
                    <p class="text-[11px] text-rose-600">${escapeHtml(programRuntimeState.error || 'Terjadi kesalahan sistem.')}</p>
                    ${reqIdInfo}
                </div>
            `;
            if (showcase) showcase.innerHTML = errorHtml;
            if (grid) grid.innerHTML = errorHtml;
        }

        function renderProgramShowcaseBeranda() {
            const container = document.getElementById('beranda-program-showcase');
            if (!container) return;

            if (programRuntimeState.status !== "ready" || RUNTIME_PROGRAM_DATA.length === 0) {
                return;
            }

            container.innerHTML = RUNTIME_PROGRAM_DATA.map(prog => {
                const theme = getProgramUiTheme(prog);
                return `
                <div onclick="switchTab('${prog.id}')"
                    class="group bg-white dark:bg-[#15202d] rounded-2xl border border-slate-200/80 dark:border-[#253447] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer">
                    <div class="relative h-48 overflow-hidden">
                        <img src="${prog.image}" alt="${prog.name}"
                            class="w-full h-full object-cover group-hover:scale-105 transition duration-500">
                        <span
                            class="absolute top-4 left-4 ${theme.berandaBadgeStyle} text-xs font-semibold px-3 py-1 rounded-full backdrop-blur">
                            ${prog.badge}
                        </span>
                    </div>
                    <div class="p-6 space-y-3">
                        <h3 class="font-bold text-lg text-slate-900 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition">
                            ${prog.name}</h3>
                        <p class="text-xs text-slate-500 dark:text-slate-300 leading-relaxed">
                            ${prog.description}
                        </p>
                        <ul class="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 pt-2">
                            ${prog.highlights.slice(0, 3).map(item => `<li class="flex items-center gap-2">✓ ${item}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            `}).join('');
        }

        function renderProgramPilihanGrid() {
            const container = document.getElementById('program-pilihan-grid');
            if (!container) return;

            if (programRuntimeState.status !== "ready" || RUNTIME_PROGRAM_DATA.length === 0) {
                return;
            }

            container.innerHTML = RUNTIME_PROGRAM_DATA.map(prog => {
                const theme = getProgramUiTheme(prog);
                return `
                <div onclick="switchTab('${prog.id}')"
                    class="relative aspect-[21/9] md:aspect-[16/10] rounded-2xl md:rounded-3xl overflow-hidden shadow-sm group border border-slate-100 dark:border-[#253447] transition hover:shadow-lg flex flex-col justify-end p-3 md:p-5 cursor-pointer">
                    <img src="${prog.image}" alt="${prog.name}"
                        class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-500">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
                    <div class="relative z-10 space-y-1">
                        <div class="flex items-center justify-between">
                            <span class="${theme.pilihanBadgeStyle} text-[8px] md:text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase inline-block shadow">${prog.badge}</span>
                            <span class="text-[10px] text-amber-300 font-bold">selengkapnya <i class="fa-solid fa-chevron-right text-[8px]"></i></span>
                        </div>
                        <h3 class="text-base md:text-2xl font-bold text-white leading-snug">${prog.name}</h3>
                        <p class="text-[10px] md:text-xs text-emerald-100 line-clamp-1 leading-normal">${prog.description}</p>
                    </div>
                </div>
            `}).join('');
        }

        function renderAllProgramDetails() {
            if (programRuntimeState.status !== "ready") return;

            RUNTIME_PROGRAM_DATA.forEach(prog => {
                const pageEl = document.getElementById(`page-${prog.id}`);
                if (!pageEl) return;

                const d = prog.detail;
                const theme = getProgramUiTheme(prog);
                const categoryColor = theme.headerCategoryColor;

                pageEl.innerHTML = `
                    <div class="bg-white dark:bg-[#15202d] p-4 md:p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-[#253447] space-y-8">

                        <!-- BARIS KEMBALI & HEADER UTAMA -->
                        <div class="flex items-center justify-between border-b border-slate-100 dark:border-[#253447] pb-2 mb-1">
                            <div class="flex items-center space-x-2.5">
                                <button onclick="switchTab('program-pilihan')"
                                    class="w-8 h-8 bg-slate-100 dark:bg-[#1c2836] hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg flex items-center justify-center transition active:scale-95 shrink-0"
                                    title="Kembali">
                                    <i class="fa-solid fa-arrow-left text-xs"></i>
                                </button>
                                <span class="text-[11px] font-extrabold ${categoryColor} uppercase tracking-wider">Program Unggulan</span>
                            </div>
                            <button onclick="switchTab('ppdb')"
                                class="hidden md:flex px-3.5 py-1.5 bg-brand-700 hover:bg-brand-800 text-white font-bold text-xs rounded-lg shadow transition items-center space-x-1.5">
                                <span>Daftar PPDB</span>
                                <i class="fa-solid fa-arrow-right text-[10px]"></i>
                            </button>
                        </div>

                        <!-- A. HEADER & TAGLINE PROGRAM -->
                        <section class="relative bg-gradient-to-r ${theme.headerTheme} text-white p-6 md:p-8 rounded-3xl overflow-hidden shadow-md">
                            <div class="absolute -right-8 -bottom-8 text-white/5 text-9xl pointer-events-none">
                                <i class="fa-solid ${theme.headerIcon}"></i>
                            </div>
                            <div class="relative z-10 space-y-2.5">
                                <span class="${theme.pilihanBadgeStyle} text-[10px] font-extrabold px-3 py-1 rounded-full uppercase inline-block shadow">${theme.headerBadge}</span>
                                <h1 class="text-xl md:text-3xl font-extrabold leading-tight">${prog.name}</h1>
                                <p class="text-xs md:text-sm text-amber-300 font-semibold italic">
                                    ${d.tagline}
                                </p>
                            </div>
                        </section>

                        <!-- B. DESKRIPSI SINGKAT PROGRAM -->
                        <section class="bg-slate-50 dark:bg-[#1c2836] p-5 rounded-2xl border border-slate-100 dark:border-[#253447]">
                            <p class="text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                ${d.summary}
                            </p>
                        </section>

                        <!-- C. VIDEO CHANNEL YOUTUBE -->
                        <section class="space-y-2">
                            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center">
                                <span class="w-1.5 h-4 bg-brand-600 rounded-full mr-2"></span> Video Profil Kegiatan
                            </h3>
                            <div class="relative aspect-video rounded-3xl overflow-hidden shadow-md border border-slate-200 dark:border-[#253447] bg-black">
                                <iframe class="w-full h-full" src="${(typeof formatYoutubeEmbedUrl === 'function') ? formatYoutubeEmbedUrl(d.video) : d.video}" title="${d.videoTitle}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
                            </div>
                        </section>

                        <!-- D. KEUNGGULAN & METODE PEMBELAJARAN -->
                        <section class="space-y-3">
                            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center">
                                <span class="w-1.5 h-4 bg-brand-600 rounded-full mr-2"></span> Keunggulan & Metode Pembelajaran
                            </h3>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                ${(d.keunggulan || []).map(k => `
                                    <div class="p-4 bg-slate-50 dark:bg-[#1c2836] rounded-2xl border border-slate-100 dark:border-[#253447] space-y-1.5">
                                        <div class="w-9 h-9 ${k.iconBg || 'bg-brand-100 text-brand-700'} rounded-xl flex items-center justify-center text-sm font-bold mb-2">
                                            <i class="fa-solid ${k.icon}"></i>
                                        </div>
                                        <h4 class="text-sm md:text-lg font-bold text-slate-800 dark:text-slate-100">${k.title}</h4>
                                        <p class="text-[11px] text-slate-500 dark:text-slate-300 leading-relaxed">${k.desc}</p>
                                    </div>
                                `).join('')}
                            </div>
                        </section>

                        <!-- E. TARGET CAPAIAN SANTRI -->
                        <section class="bg-emerald-700 text-white p-5 md:p-6 rounded-3xl shadow-sm space-y-4">
                            <h3 class="text-base font-bold text-center">Target Output Santri</h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                ${(d.targetOutput || []).map(out => `
                                    <div class="flex items-start space-x-3 bg-white/10 p-3 rounded-2xl backdrop-blur-sm">
                                        <i class="fa-solid fa-square-check text-amber-400 mt-0.5 text-base shrink-0"></i>
                                        <span>${out}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </section>

                        <!-- F. GALERI FOTO -->
                        <section class="space-y-3">
                            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center">
                                <span class="w-1.5 h-4 bg-brand-600 rounded-full mr-2"></span> Galeri Dokumentasi Kegiatan
                            </h3>
                            <div class="relative aspect-video rounded-3xl overflow-hidden shadow-md bg-slate-900">
                                <div id="${d.gallery && d.gallery[0] ? d.gallery[0].sliderId : 'galeri-1'}" class="w-full h-full relative">
                                    <img src="${d.gallery && d.gallery[0] ? d.gallery[0].image : ''}" alt="${d.gallery && d.gallery[0] ? d.gallery[0].caption : ''}" class="absolute inset-0 w-full h-full object-cover">
                                </div>
                                <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-4 md:p-6">
                                    <p class="text-xs md:text-sm font-bold text-white"><i class="fa-solid fa-camera mr-2 text-amber-400"></i> ${d.gallery && d.gallery[0] ? d.gallery[0].caption : 'Dokumentasi Santri'}</p>
                                </div>
                            </div>
                        </section>

                        <!-- G. FASILITAS -->
                        <section class="space-y-3">
                            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center">
                                <span class="w-1.5 h-4 bg-brand-600 rounded-full mr-2"></span> Fasilitas Santri
                            </h3>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                                ${(d.fasilitas || []).map(f => `
                                    <div class="p-3.5 bg-slate-50 dark:bg-[#1c2836] rounded-2xl border border-slate-100 dark:border-[#253447] flex items-center space-x-3">
                                        <i class="${f.icon} ${f.iconColor || 'text-brand-700'} text-lg"></i>
                                        <span class="text-xs font-semibold text-slate-700 dark:text-slate-200">${f.text}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </section>

                        <!-- H. PROSEDUR PENDAFTARAN -->
                        <section class="bg-slate-50 dark:bg-[#1c2836] p-5 md:p-6 rounded-3xl border border-slate-100 dark:border-[#253447] space-y-4">
                            <h3 class="text-base font-bold text-slate-800 dark:text-slate-100 text-center">Prosedur Pendaftaran</h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                                <div class="space-y-3">
                                    ${(d.prosedur?.items || []).map((p, idx) => `
                                        <div class="flex items-start space-x-3">
                                            <i class="fa-solid fa-check text-brand-700 dark:text-emerald-400 font-bold text-sm mt-0.5 shrink-0"></i>
                                            <p class="text-xs text-slate-700 dark:text-slate-200 ${idx === 0 ? 'font-semibold' : ''}">${p.title ? `${p.step ? `${p.step}. ` : ''}${p.title}: ${p.desc}` : p}</p>
                                        </div>
                                    `).join('')}
                                </div>
                                <div class="rounded-2xl overflow-hidden border border-slate-200 dark:border-[#253447] aspect-[4/3]">
                                    <img src="${d.prosedur?.image}" alt="${d.prosedur?.imageAlt || 'Prosedur PPDB'}" class="w-full h-full object-cover">
                                </div>
                            </div>
                        </section>

                        <!-- I. PERSYARATAN PENDAFTARAN -->
                        <section class="space-y-4">
                            <h3 class="text-base font-bold text-slate-800 dark:text-slate-100 text-center">Persyaratan Pendaftaran</h3>
                            <div class="space-y-3 max-w-2xl mx-auto">
                                ${(d.persyaratan || []).map(req => `
                                    <div class="flex items-start space-x-4 p-4 bg-slate-50 dark:bg-[#1c2836] rounded-2xl border border-slate-100 dark:border-[#253447]">
                                        <div class="w-10 h-10 bg-emerald-500 text-white rounded-full flex items-center justify-center text-lg shrink-0">
                                            <i class="fa-solid ${req.icon || 'fa-check'}"></i>
                                        </div>
                                        <div>
                                            <h4 class="text-xs md:text-sm font-bold text-slate-800 dark:text-slate-100">${req.title}</h4>
                                            <p class="text-[11px] text-slate-500 dark:text-slate-300 mt-0.5">${req.desc}</p>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </section>

                        <!-- J. BIAYA PENDIDIKAN -->
                        <section class="space-y-4">
                            <h3 class="text-base font-bold text-slate-800 dark:text-slate-100 text-center">Biaya Pendidikan</h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <!-- Biaya Pendaftaran -->
                                <div class="bg-white dark:bg-[#1c2836] p-6 rounded-3xl border border-slate-200 dark:border-[#253447] shadow-sm space-y-4 text-center">
                                    <div>
                                        <h4 class="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Biaya Pendaftaran</h4>
                                        <div class="text-2xl md:text-3xl font-extrabold text-slate-800 dark:text-slate-100 mt-2">${d.biaya?.pendaftaran?.nominal}</div>
                                        ${d.biaya?.pendaftaran?.note ? `<p class="text-[10px] text-slate-400 dark:text-slate-400 mt-1">${d.biaya?.pendaftaran?.note}</p>` : ''}
                                    </div>
                                    ${Array.isArray(d.biaya?.pendaftaran?.items) ? `
                                        <div class="space-y-2 text-xs text-left pt-3 border-t border-slate-100 dark:border-[#253447]">
                                            ${(d.biaya?.pendaftaran?.items || []).map(item => `
                                                <div class="flex items-center space-x-2.5 text-slate-700 dark:text-slate-200">
                                                    <i class="fa-solid fa-check text-emerald-600 dark:text-emerald-400 font-bold"></i>
                                                    <span>${item}</span>
                                                </div>
                                            `).join('')}
                                        </div>
                                    ` : ''}
                                </div>

                                <!-- Biaya Bulanan -->
                                <div class="bg-white dark:bg-[#1c2836] p-6 rounded-3xl border border-slate-200 dark:border-[#253447] shadow-sm space-y-4 text-center">
                                    <div>
                                        <h4 class="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Biaya Syahriyah (Bulanan)</h4>
                                        <div class="text-2xl md:text-3xl font-extrabold text-slate-800 dark:text-slate-100 mt-2">${d.biaya?.syahriyah?.nominal}</div>
                                        ${d.biaya?.syahriyah?.note ? `<p class="text-[10px] text-slate-400 dark:text-slate-400 mt-1">${d.biaya?.syahriyah?.note}</p>` : ''}
                                    </div>
                                    ${Array.isArray(d.biaya?.syahriyah?.items) ? `
                                        <div class="space-y-2 text-xs text-left pt-3 border-t border-slate-100 dark:border-[#253447]">
                                            ${(d.biaya?.syahriyah?.items || []).map(item => `
                                                <div class="flex items-center space-x-2.5 text-slate-700 dark:text-slate-200">
                                                    <i class="fa-solid fa-check text-emerald-600 dark:text-emerald-400 font-bold"></i>
                                                    <span>${item}</span>
                                                </div>
                                            `).join('')}
                                            ${Array.isArray(d.biaya?.syahriyah?.excludedItems) ? d.biaya?.syahriyah?.excludedItems.map(item => `
                                                <div class="flex items-center space-x-2.5 text-slate-400 dark:text-slate-400 line-through">
                                                    <i class="fa-solid fa-xmark text-rose-500 font-bold"></i>
                                                    <span>${item}</span>
                                                </div>
                                            `).join('') : ''}
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        </section>

                        <!-- K. CALL TO ACTION (CTA) -->
                        <section class="bg-gradient-to-r ${theme.headerTheme} text-white p-6 md:p-8 rounded-3xl shadow-lg text-center space-y-4">
                            <h3 class="text-lg md:text-xl font-bold">${d.cta?.title}</h3>
                            <p class="text-xs text-emerald-100 max-w-md mx-auto leading-relaxed">
                                ${d.cta?.description}
                            </p>
                            <div class="flex flex-col sm:flex-row justify-center items-center gap-3 pt-2">
                                <button onclick="switchTab('ppdb')"
                                    class="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-brand-dark font-extrabold px-6 py-3 rounded-2xl text-xs shadow-md transition flex items-center justify-center space-x-2">
                                    <i class="fa-solid fa-file-signature"></i>
                                    <span>Daftar Sekarang ke Form PPDB</span>
                                </button>
                                <a href="${d.cta?.waLink}" target="_blank"
                                    class="w-full sm:w-auto ${d.cta?.waBtnClass || 'bg-emerald-600 text-white'} font-bold px-6 py-3 rounded-2xl text-xs shadow-md transition flex items-center justify-center space-x-2 border">
                                    <i class="fa-brands fa-whatsapp text-sm"></i>
                                    <span>${d.cta?.waText || 'Konsultasi via WA'}</span>
                                </a>
                            </div>
                        </section>

                    </div>
                `;
            });
        }

        function renderProgramAllViews() {
            renderProgramShowcaseBeranda();
            renderProgramPilihanGrid();
            renderAllProgramDetails();
        }
