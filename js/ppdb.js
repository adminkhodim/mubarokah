        // ==================== PPDB & PENDAFTARAN ====================
        function togglePPDBSubPage(type) {
            const btnDaftar = document.getElementById('ppdb-sub-daftar');
            const btnCek = document.getElementById('ppdb-sub-cek');
            const containerDaftar = document.getElementById('ppdb-container-daftar');
            const containerCek = document.getElementById('ppdb-container-cek');

            if (type === 'daftar') {
                btnDaftar.className = "flex-1 text-center py-2 text-xs font-bold rounded-xl bg-white dark:bg-[#1c2836] text-brand-900 dark:text-emerald-400 shadow-sm transition";
                btnCek.className = "flex-1 text-center py-2 text-xs font-bold rounded-xl text-slate-500 dark:text-slate-400 hover:text-brand-900 dark:hover:text-emerald-400 transition";
                containerDaftar.classList.remove('hidden');
                containerCek.classList.add('hidden');
            } else {
                btnCek.className = "flex-1 text-center py-2 text-xs font-bold rounded-xl bg-white dark:bg-[#1c2836] text-brand-900 dark:text-emerald-400 shadow-sm transition";
                btnDaftar.className = "flex-1 text-center py-2 text-xs font-bold rounded-xl text-slate-500 dark:text-slate-400 hover:text-brand-900 dark:hover:text-emerald-400 transition";
                containerDaftar.classList.add('hidden');
                containerCek.classList.remove('hidden');
            }
        }

        function openRegisterModal() {
            switchTab('ppdb');
            togglePPDBSubPage('daftar');
            showToast("Silakan isi formulir registrasi yang tersedia.");
        }

        async function handlePPDBSubmit(event) {
            event.preventDefault();

            const nama = document.getElementById('ppdb-nama').value;
            const nisn = document.getElementById('ppdb-nisn').value;
            const wali = document.getElementById('ppdb-wali').value;
            const whatsapp = document.getElementById('ppdb-whatsapp').value;
            const program = document.getElementById('ppdb-program').value;

            const btn = document.getElementById('submit-btn');
            const btnIcon = document.getElementById('submit-btn-icon');
            const btnText = document.getElementById('submit-btn-text');

            if (!isApiConfigured()) {
                showToast("Maaf, API pendaftaran belum terpasang (WEB_APP_URL kosong).");
                return;
            }

            btn.disabled = true;
            btnIcon.className = "fa-solid fa-spinner animate-spin mr-2";
            btnText.innerText = "Mengirim data ke database...";

            try {
                const response = await apiPost("submitPPDB", {
                    nama, nisn, wali, whatsapp, program
                });

                if (response && response.status === "success") {
                    showToast("Alhamdulillah! Berkas Pendaftaran Anda berhasil disimpan.");
                    document.getElementById('ppdbForm').reset();
                    setTimeout(() => { switchTab('beranda'); }, 2500);
                } else if (response && response.status === "duplicate") {
                    showToast("⚠️ " + response.message);
                } else {
                    showToast("❌ " + (response ? response.message : "Pendaftaran gagal diproses."));
                }
            } catch (error) {
                console.error("Gagal submit pendaftaran:", error);
                showToast("Terjadi kendala koneksi ke database. Silakan coba kembali.");
            } finally {
                btn.disabled = false;
                btnIcon.className = "fa-solid fa-circle-check";
                btnText.innerText = "Kirim Formulir Pendaftaran";
            }
        }

        async function handleStatusCheck() {
            const nisnInput = document.getElementById('search-nisn-input').value.trim();
            const resultBox = document.getElementById('status-result-box');
            const btnText = document.getElementById('search-btn-text');
            const spinner = document.getElementById('search-spinner');

            if (!nisnInput || nisnInput.length < 5) {
                showToast("Masukkan 10 digit NISN yang valid!");
                return;
            }

            if (!WEB_APP_URL) {
                showToast("Maaf, API status kelulusan belum terpasang (WEB_APP_URL kosong).");
                return;
            }

            spinner.classList.remove('hidden');
            btnText.innerText = "Mencari data...";

            try {
                const response = await apiGet("checkStatus", { nisn: nisnInput });
                resultBox.classList.remove('hidden');
                if (response.status === "success") {
                    const student = response.data;
                    let statusBadge = "";
                    if (student.status.toLowerCase() === "pending") {
                        statusBadge = `<span class="bg-amber-100 text-amber-700 text-xs px-2.5 py-1 rounded-full font-bold">Sedang Ditinjau (Pending)</span>`;
                    } else if (student.status.toLowerCase() === "diterima" || student.status.toLowerCase() === "lulus") {
                        statusBadge = `<span class="bg-green-100 text-green-700 text-xs px-2.5 py-1 rounded-full font-bold">Selamat! Diterima</span>`;
                    } else {
                        statusBadge = `<span class="bg-red-100 text-red-700 text-xs px-2.5 py-1 rounded-full font-bold">Ditolak / Gugur</span>`;
                    }

                    resultBox.innerHTML = `
                            <div class="text-center pb-3 border-b border-slate-200/60 mb-3">
                                <h4 class="font-bold text-slate-800 text-sm">Data Santri Ditemukan</h4>
                                <p class="text-[10px] text-slate-400">Terdaftar tanggal: ${escapeHtml(student.tanggalDaftar)}</p>
                            </div>
                            <div class="space-y-2 text-xs">
                                <div class="flex justify-between"><span class="text-slate-400">Nama Santri:</span><span class="font-bold text-slate-700">${escapeHtml(student.nama)}</span></div>
                                <div class="flex justify-between"><span class="text-slate-400">NISN:</span><span class="font-bold text-slate-700">${escapeHtml(student.nisn)}</span></div>
                                <div class="flex justify-between"><span class="text-slate-400">Wali Santri:</span><span class="font-bold text-slate-700">${escapeHtml(student.wali)}</span></div>
                                <div class="flex justify-between"><span class="text-slate-400">Program Studi:</span><span class="font-bold text-slate-700">${escapeHtml(student.program)}</span></div>
                                <div class="flex justify-between items-center pt-2 border-t border-slate-200/60"><span class="text-slate-400">Status Seleksi:</span>${statusBadge}</div>
                            </div>
                        `;
                } else if (response.status === "not_found") {
                    resultBox.innerHTML = `
                            <div class="text-center space-y-2 p-3">
                                <i class="fa-solid fa-user-slash text-rose-500 text-2xl"></i>
                                <h4 class="font-bold text-slate-800 text-xs">NISN Tidak Ditemukan</h4>
                                <p class="text-[11px] text-slate-500 leading-relaxed">Maaf, nomor NISN <strong>${escapeHtml(nisnInput)}</strong> belum terdaftar di sistem PPDB kami.</p>
                            </div>
                        `;
                } else {
                    showToast(response.message || "Gagal mengambil data.");
                }
            } catch (err) {
                console.error("Gagal verifikasi status santri:", err);
                showToast("Database tidak merespon. Mohon periksa kembali koneksi.");
            } finally {
                spinner.classList.add('hidden');
                btnText.innerText = "Cari Data Santri";
            }
        }
