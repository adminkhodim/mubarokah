        // ==================== FORM ALUMNI & LEAFLET ====================
        let alumniMap = null;
        // ==================== WILAYAH INDONESIA API ====================
        async function fetchWilayah(url, selectElementId, defaultText) {
            const select = document.getElementById(selectElementId);
            select.innerHTML = `<option value="" disabled selected>Memuat...</option>`;
            select.disabled = true;
            try {
                const response = await fetch(url);
                const data = await response.json();
                select.innerHTML = `<option value="" disabled selected>${defaultText}</option>`;
                data.forEach(item => {
                    const opt = document.createElement('option');
                    // Simpan NAMA sebagai value, dan ID sebagai data-id untuk berjenjang
                    opt.value = item.name;
                    opt.setAttribute('data-id', item.id);
                    opt.textContent = item.name;
                    select.appendChild(opt);
                });
                select.disabled = false;
            } catch (err) {
                console.error("Gagal memuat wilayah:", err);
                select.innerHTML = `<option value="" disabled selected>Gagal memuat data</option>`;
            }
        }

        function initWilayah() {
            const provSelect = document.getElementById('al-provinsi');
            const kabSelect = document.getElementById('al-kabupaten');
            const kecSelect = document.getElementById('al-kecamatan');
            const desaSelect = document.getElementById('al-desa');

            if (!provSelect) return;

            // Load Provinsi
            fetchWilayah('https://www.emsifa.com/api-wilayah-indonesia/api/provinces.json', 'al-provinsi', 'Pilih Provinsi');

            provSelect.addEventListener('change', function() {
                const id = this.options[this.selectedIndex].getAttribute('data-id');
                kabSelect.innerHTML = '<option value="" disabled selected>Pilih Kabupaten/Kota</option>';
                kecSelect.innerHTML = '<option value="" disabled selected>Pilih Kecamatan</option>';
                desaSelect.innerHTML = '<option value="" disabled selected>Pilih Desa/Kelurahan</option>';
                kabSelect.disabled = true; kecSelect.disabled = true; desaSelect.disabled = true;
                if(id) fetchWilayah(`https://www.emsifa.com/api-wilayah-indonesia/api/regencies/${id}.json`, 'al-kabupaten', 'Pilih Kabupaten/Kota');
            });

            kabSelect.addEventListener('change', function() {
                const id = this.options[this.selectedIndex].getAttribute('data-id');
                kecSelect.innerHTML = '<option value="" disabled selected>Pilih Kecamatan</option>';
                desaSelect.innerHTML = '<option value="" disabled selected>Pilih Desa/Kelurahan</option>';
                kecSelect.disabled = true; desaSelect.disabled = true;
                if(id) fetchWilayah(`https://www.emsifa.com/api-wilayah-indonesia/api/districts/${id}.json`, 'al-kecamatan', 'Pilih Kecamatan');
            });

            kecSelect.addEventListener('change', function() {
                const id = this.options[this.selectedIndex].getAttribute('data-id');
                desaSelect.innerHTML = '<option value="" disabled selected>Pilih Desa/Kelurahan</option>';
                desaSelect.disabled = true;
                if(id) fetchWilayah(`https://www.emsifa.com/api-wilayah-indonesia/api/villages/${id}.json`, 'al-desa', 'Pilih Desa/Kelurahan');
            });
        }


        async function initAlumniMap() {
            if (alumniMap) {
                setTimeout(() => { alumniMap.invalidateSize(); }, 300);
                return;
            }

            if (typeof L === 'undefined' && window.MubarokahLazy) {
                try {
                    await window.MubarokahLazy.ensureLeaflet();
                } catch (e) {
                    console.error('[Alumni] Gagal memuat Leaflet on-demand:', e);
                    return;
                }
            }
            if (typeof L === 'undefined') return;
            
            alumniMap = L.map('alumni-map', {
                center: [-6.9147, 110.6384],
                zoom: 10,
                zoomControl: false
            });
            
            L.control.zoom({ position: 'bottomleft' }).addTo(alumniMap);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap'
            }).addTo(alumniMap);

            alumniMap.on('moveend', function() {
                const center = alumniMap.getCenter();
                document.getElementById('al-lat').value = center.lat;
                document.getElementById('al-lng').value = center.lng;
            });
            
            document.getElementById('al-lat').value = -6.9147;
            document.getElementById('al-lng').value = 110.6384;
        }

        function getGPSLocation() {
            if (navigator.geolocation) {
                const btn = document.querySelector('button[onclick="getGPSLocation()"]');
                const origHtml = btn.innerHTML;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const lat = position.coords.latitude;
                        const lng = position.coords.longitude;
                        if (alumniMap) {
                            alumniMap.flyTo([lat, lng], 15);
                            document.getElementById('al-lat').value = lat;
                            document.getElementById('al-lng').value = lng;
                        }
                        btn.innerHTML = origHtml;
                    },
                    (error) => {
                        btn.innerHTML = origHtml;
                        showToast("⚠️ Gagal mendapat lokasi GPS. Geser peta secara manual.");
                    },
                    { enableHighAccuracy: true, timeout: 5000 }
                );
            } else {
                showToast("⚠️ Browser tidak mendukung Geolocation.");
            }
        }

        function nextAlumniStep(current) {
            const form = document.getElementById('alumni-form');
            if (current === 1) {
                if (!document.getElementById('al-nama').checkValidity()) {
                    document.getElementById('al-nama').reportValidity();
                    return;
                }
                if (!document.getElementById('al-jk').checkValidity()) {
                    document.getElementById('al-jk').reportValidity();
                    return;
                }
                if (!document.getElementById('al-wa').checkValidity()) {
                    document.getElementById('al-wa').reportValidity();
                    return;
                }
            } else if (current === 2) {
                if (!document.getElementById('al-masuk').checkValidity()) {
                    document.getElementById('al-masuk').reportValidity();
                    return;
                }
                if (!document.getElementById('al-lulus').checkValidity()) {
                    document.getElementById('al-lulus').reportValidity();
                    return;
                }
                if (!document.getElementById('al-program').checkValidity()) {
                    document.getElementById('al-program').reportValidity();
                    return;
                }
                if (!document.getElementById('al-kesibukan').checkValidity()) {
                    document.getElementById('al-kesibukan').reportValidity();
                    return;
                }
            }

            document.getElementById('alumni-step-' + current).classList.add('hidden');
            document.getElementById('alumni-step-' + current).classList.remove('block');
            
            const next = current + 1;
            document.getElementById('alumni-step-' + next).classList.remove('hidden');
            document.getElementById('alumni-step-' + next).classList.add('block');
            
            const prog = next === 2 ? 'w-2/3' : 'w-full';
            const bar = document.getElementById('alumni-progress-bar');
            bar.className = 'h-full bg-emerald-500 transition-all duration-300 ' + prog;
            
            if (next === 3) {
                initAlumniMap();
                setTimeout(() => { if(alumniMap) alumniMap.invalidateSize(); }, 200);
            }
            window.scrollTo({top: 0, behavior: 'smooth'});
        }

        function prevAlumniStep(current) {
            document.getElementById('alumni-step-' + current).classList.add('hidden');
            document.getElementById('alumni-step-' + current).classList.remove('block');
            
            const prev = current - 1;
            document.getElementById('alumni-step-' + prev).classList.remove('hidden');
            document.getElementById('alumni-step-' + prev).classList.add('block');
            
            const prog = prev === 1 ? 'w-1/3' : 'w-2/3';
            const bar = document.getElementById('alumni-progress-bar');
            bar.className = 'h-full bg-emerald-500 transition-all duration-300 ' + prog;
            window.scrollTo({top: 0, behavior: 'smooth'});
        }

        async function submitAlumniForm(e) {
            e.preventDefault();
            const btn = document.getElementById('al-submit-btn');
            const errBox = document.getElementById('alumni-error');
            
            errBox.classList.add('hidden');
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Menyimpan...</span>';

            let fileData = null;
            const fileInput = document.getElementById('al-foto');
            if (fileInput && fileInput.files.length > 0) {
                const file = fileInput.files[0];
                fileData = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const base64 = e.target.result.split(',')[1];
                        resolve({
                            base64: base64,
                            mimeType: file.type,
                            filename: file.name
                        });
                    };
                    reader.readAsDataURL(file);
                });
            }

            const payload = {
                nama: document.getElementById('al-nama').value.trim(),
                jk: document.getElementById('al-jk').value,
                wa: document.getElementById('al-wa').value.trim(),
                medsos: document.getElementById('al-medsos').value.trim(),
                masuk: document.getElementById('al-masuk').value,
                lulus: document.getElementById('al-lulus').value,
                program: document.getElementById('al-program').value,
                kesibukan: document.getElementById('al-kesibukan').value,
                instansi: document.getElementById('al-instansi').value.trim(),
                kesan: document.getElementById('al-kesan').value.trim(),
                provinsi: document.getElementById('al-provinsi').value.trim(),
                kabupaten: document.getElementById('al-kabupaten').value.trim(),
                kecamatan: document.getElementById('al-kecamatan').value.trim(),
                desa: document.getElementById('al-desa').value.trim(),
                alamat: document.getElementById('al-alamat').value.trim(),
                lat: document.getElementById('al-lat').value,
                lng: document.getElementById('al-lng').value,
                izin: document.getElementById('al-izin').checked ? "Ya" : "Tidak",
                file: fileData
            };

            try {
                const res = await apiPost("alumni.create", payload);
                if (res.success) {
                    document.getElementById('alumni-form').classList.add('hidden');
                    document.getElementById('alumni-form-success').classList.remove('hidden');
                    document.getElementById('alumni-form').reset();
                    window.scrollTo({top: 0, behavior: 'smooth'});
                } else {
                    errBox.innerText = res.error?.message || "Gagal menyimpan data.";
                    errBox.classList.remove('hidden');
                }
            } catch (err) {
                document.getElementById('alumni-form').classList.add('hidden');
                document.getElementById('alumni-form-success').classList.remove('hidden');
                window.scrollTo({top: 0, behavior: 'smooth'});
                console.warn(err);
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> <span>Simpan Data</span>';
            }
        }
        async function loadAlumniTestimonials() {
            const container = document.getElementById('alumni-testimonials-container');
            if (!container) return;

            // 1. Coba ambil testimoni dari Supabase terlebih dahulu (Strangler Fig Pattern)
            if (typeof MubarokahSupabase !== 'undefined' && MubarokahSupabase.isEnabled()) {
                try {
                    const sbData = await MubarokahSupabase.fetchAlumniTestimonials();
                    if (Array.isArray(sbData) && sbData.length > 0) {
                        renderTestimonialsList(container, sbData);
                        return;
                    }
                } catch (sbErr) {
                    console.warn("[loadAlumniTestimonials] Supabase error, fallback ke Apps Script:", sbErr);
                }
            }

            try {
                const data = await apiGet('alumni.getTestimonials');
                renderTestimonialsList(container, data);
            } catch (err) {
                console.error(err);
                container.innerHTML = '<div class="md:col-span-3 text-center text-xs text-rose-500 py-10">Gagal memuat testimoni.</div>';
            }
        }

        function renderTestimonialsList(container, data) {
            if (!data || data.length === 0) {
                container.innerHTML = '<div class="md:col-span-3 text-center text-xs text-slate-500 dark:text-slate-400 py-10">Belum ada testimoni terbaru.</div>';
                return;
            }

            container.innerHTML = '';
            const colors = ['brand', 'purple', 'sky', 'rose', 'amber'];

            data.forEach((item, index) => {
                const color = colors[index % colors.length];
                const inisial = (item.nama || 'AL').substring(0, 2).toUpperCase();
                
                const avatarHtml = item.foto && item.foto !== "" 
                    ? `<img src="${item.foto}" alt="${escapeHtml(item.nama)}" class="w-12 h-12 rounded-full object-cover shrink-0 border-2 border-${color}-300">`
                    : `<div class="w-12 h-12 bg-${color}-700 text-white rounded-full flex items-center justify-center font-bold text-sm shrink-0 border-2 border-${color}-300">${inisial}</div>`;

                let pekerjaan = item.instansi || item.kesibukan || 'Alumni';
                
                let cardHtml = `
                    <div class="bg-slate-50 dark:bg-[#1c2836] p-4 rounded-2xl border border-slate-100 dark:border-[#253447] space-y-3 flex flex-col justify-between">
                        <div class="space-y-2">
                            <div class="flex items-center space-x-3">
                                ${avatarHtml}
                                <div>
                                    <h4 class="text-xs md:text-sm font-bold text-slate-800 dark:text-slate-100 line-clamp-1">${escapeHtml(item.nama)}</h4>
                                    <p class="text-[10px] text-${color}-700 font-semibold">Alumni Angkatan ${escapeHtml(item.tahunLulus || item.tahunMasuk || '-')}</p>
                                </div>
                            </div>
                            <span class="inline-block bg-${color}-100 text-${color}-800 text-[9px] font-extrabold px-2 py-0.5 rounded-md line-clamp-1">
                                ${escapeHtml(pekerjaan)}
                            </span>
                            <p class="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed italic line-clamp-4">
                                "${escapeHtml(item.kesan || '')}"
                            </p>
                        </div>
                    </div>
                `;
                container.innerHTML += cardHtml;
            });
        }
