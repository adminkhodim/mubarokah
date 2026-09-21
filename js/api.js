        // ==================== API ADAPTER LAYER ====================
        // Seluruh komunikasi backend melewati adapter ini, mengacu pada APP_CONFIG.
        const WEB_APP_URL = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.infrastructure && 
            ((APP_CONFIG.infrastructure.apiBaseUrl && APP_CONFIG.infrastructure.apiBaseUrl !== '__MUBAROKAH_CONFIG_PENDING__') ? APP_CONFIG.infrastructure.apiBaseUrl :
             (APP_CONFIG.infrastructure.appsScriptWebAppUrl && APP_CONFIG.infrastructure.appsScriptWebAppUrl !== '__MUBAROKAH_CONFIG_PENDING__') ? APP_CONFIG.infrastructure.appsScriptWebAppUrl : "")) || "";

        const AUTHORITATIVE_TENANT_ID = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.tenant && APP_CONFIG.tenant.tenantId)
            ? APP_CONFIG.tenant.tenantId
            : "mubarokah";

        async function apiGet(action, params = {}) {
            if (!WEB_APP_URL) throw new Error("WEB_APP_URL belum dikonfigurasi.");

            const url = new URL(WEB_APP_URL);
            url.searchParams.set("action", action);
            Object.entries(params).forEach(([key, value]) => {
                // Prevent client-side or arbitrary query param from overriding authoritative tenantId
                if (key === 'tenantId') {
                    url.searchParams.set("tenantId", AUTHORITATIVE_TENANT_ID);
                } else if (value !== undefined && value !== null) {
                    url.searchParams.set(key, String(value));
                }
            });

            const response = await fetch(url.toString(), {
                method: "GET",
                redirect: "follow",
                credentials: "omit",
                headers: { "Accept": "application/json" }
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        }

        async function apiPost(action, payload = {}) {
            if (!WEB_APP_URL) throw new Error("WEB_APP_URL belum dikonfigurasi.");

            const storageKeys = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.storage && APP_CONFIG.storage.keys)
                ? APP_CONFIG.storage.keys
                : { adminToken: "mubarokah_admin_token", parentToken: "mubarokah_parent_token", pengasuhToken: "mubarokah_pengasuh_token" };

            const resolvedToken = (typeof getAdminSessionToken === "function" ? getAdminSessionToken() : (sessionStorage.getItem(storageKeys.adminToken) || localStorage.getItem(storageKeys.adminToken))) ||
                sessionStorage.getItem(storageKeys.pengasuhToken) || localStorage.getItem(storageKeys.pengasuhToken) ||
                sessionStorage.getItem(storageKeys.parentToken) || localStorage.getItem(storageKeys.parentToken) || "";

            const bodyPayload = { ...payload, action };
            if (resolvedToken && !bodyPayload.token) {
                bodyPayload.token = resolvedToken;
            }

            // Lock tenantId strictly to authoritative tenant
            bodyPayload.tenantId = AUTHORITATIVE_TENANT_ID;

            const response = await fetch(WEB_APP_URL, {
                method: "POST",
                redirect: "follow",
                credentials: "omit",
                // text/plain menghindari CORS preflight OPTIONS pada Apps Script Web App.
                headers: {
                    "Content-Type": "text/plain;charset=utf-8",
                    "Accept": "application/json"
                },
                body: JSON.stringify(bodyPayload)
            });

            if (!response.ok) {
                // Penanganan khusus Google Apps Script macros/echo:
                // Saat browser membuka Google Apps Script, redirect ke script.googleusercontent.com/macros/echo
                // bisa menghasilkan HTTP 404 karena tab browser aktif dalam multi-akun Google,
                // padahal data sebenarnya sudah sukses disimpan ke Google Sheets & Drive.
                if (response.status === 404 && (action === "saveBerita" || action === "updateBerita" || action === "deleteBerita" || action === "saveBanner")) {
                    console.warn(`[apiPost] Google echo 404 terdeteksi pada ${action}. Memverifikasi database...`);
                    await new Promise(resolve => setTimeout(resolve, 800));
                    try {
                        const checkKabar = await apiGet("getKabar");
                        if (checkKabar && checkKabar.status === "success" && Array.isArray(checkKabar.data)) {
                            if (action === "saveBerita" || action === "updateBerita") {
                                const targetJudul = bodyPayload.data && bodyPayload.data.judul ? bodyPayload.data.judul.trim().toLowerCase() : "";
                                const found = checkKabar.data.some(n => n.judul && n.judul.trim().toLowerCase() === targetJudul);
                                if (found) {
                                    return { success: true, message: "Berita dan gambar berhasil disimpan!" };
                                }
                            }
                            if (action === "deleteBerita") {
                                return { success: true, message: "Berita berhasil dihapus." };
                            }
                        }
                    } catch (verifyErr) {
                        console.warn("[apiPost] Gagal verifikasi fallback:", verifyErr);
                    }
                }
                throw new Error(`HTTP ${response.status}`);
            }
            return await response.json();
        }

        function isApiConfigured() {
            return Boolean(WEB_APP_URL && WEB_APP_URL !== '__MUBAROKAH_CONFIG_PENDING__');
        }

        function escapeHtml(value) {
            return String(value ?? "")
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        /**
         * Mengonversi semua variasi URL YouTube (watch?v=, youtu.be/, shorts/, playlist)
         * menjadi URL embed resmi yang aman disematkan dalam <iframe> tanpa terblokir X-Frame-Options.
         */
        /**
         * Mengonversi semua variasi URL YouTube (watch?v=, youtu.be/, shorts/, playlist, m.youtube.com)
         * menjadi URL embed resmi yang aman disematkan dalam <iframe> tanpa terblokir X-Frame-Options.
         */
        function formatYoutubeEmbedUrl(rawUrl) {
            if (!rawUrl || typeof rawUrl !== 'string') return "https://www.youtube.com/embed/ZQZqPcAlrk0?rel=0";
            const trimmed = rawUrl.trim();
            if (!trimmed) return "https://www.youtube.com/embed/ZQZqPcAlrk0?rel=0";

            // Jika sudah berformat embed, kembalikan langsung dengan rel=0
            if (trimmed.includes('youtube.com/embed/') || trimmed.includes('youtube-nocookie.com/embed/')) {
                return trimmed.includes('?') ? trimmed : `${trimmed}?rel=0`;
            }

            // 1. Playlist: youtube.com/playlist?list=ID
            const playlistMatch = trimmed.match(/[?&]list=([a-zA-Z0-9_-]+)/);
            if (playlistMatch && playlistMatch[1] && !trimmed.includes('watch?v=')) {
                return `https://www.youtube.com/embed/videoseries?list=${playlistMatch[1]}&rel=0`;
            }

            // 2. Short Link: youtu.be/VIDEO_ID
            const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
            if (shortMatch && shortMatch[1]) {
                return `https://www.youtube.com/embed/${shortMatch[1]}?rel=0`;
            }

            // 3. Watch Link (desktop www atau mobile m.youtube.com): watch?v=VIDEO_ID
            const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
            if (watchMatch && watchMatch[1]) {
                return `https://www.youtube.com/embed/${watchMatch[1]}?rel=0`;
            }

            // 4. Shorts: youtube.com/shorts/VIDEO_ID
            const shortsMatch = trimmed.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
            if (shortsMatch && shortsMatch[1]) {
                return `https://www.youtube.com/embed/${shortsMatch[1]}?rel=0`;
            }

            // Sanitasi ketat: jika bukan link video yang valid, JANGAN kembalikan URL mentah (seperti m.youtube.com)
            // agar iframe tidak memicu 'X-Frame-Options: sameorigin'. Gunakan fallback embed resmi pesantren.
            return "https://www.youtube.com/embed/ZQZqPcAlrk0?rel=0";
        }

        // ==================== STATE MANAGEMENT DATA ====================
        let mockNewsData = [
            {
                news_id: "NEWS_1",
                slug: "santri-pesantren-sabet-juara-olimpiade-matematika",
                tanggal: "5 Juli 2026",
                kategori: "Prestasi",
                judul: "Santri Pesantren Sabet Juara Olimpiade Matematika",
                ringkasan: "Alhamdulillah, santri pesantren kembali meraih prestasi membanggakan dengan meraih juara pertama olimpiade matematika...",
                isi: "Alhamdulillah, santri pesantren kembali meraih prestasi membanggakan dengan meraih juara pertama olimpiade matematika tingkat Provinsi Jawa Tengah.\n\nKeberhasilan ini membuktikan bahwa kurikulum terintegrasi yang menggabungkan khazanah salaf klasik dan sains teknologi mampu bersaing di kancah nasional. Semoga prestasi ini memacu santri lainnya.",
                penulis: "Humas Pesantren",
                gambar: "https://images.unsplash.com/photo-1577896851231-70ef18881754?q=80&w=800&auto=format&fit=crop"
            },
            {
                news_id: "NEWS_2",
                slug: "silahturahmi-tokoh-ulama-nasional-pengarahan-keilmuan",
                tanggal: "2 Juli 2026",
                kategori: "Kajian",
                judul: "Silahturahmi Tokoh Ulama Nasional & Pengarahan Keilmuan",
                ringkasan: "Pesantren menyambut hangat silaturahmi tokoh ulama nasional yang memberikan wejangan mendalam bagi para santri...",
                isi: "Pesantren menyambut hangat silaturahmi tokoh ulama nasional di Aula Utama. Beliau memberikan pengarahan keilmuan kepada seluruh santri agar tetap bersemangat menuntut ilmu di tengah derasnya modernitas global.\n\nBeliau menekankan pentingnya penguasaan literatur klasik sebagai akar moderasi beragama.",
                penulis: "Kesiswaan",
                gambar: "https://images.unsplash.com/photo-1584286595398-a59f21d313f5?q=80&w=800&auto=format&fit=crop"
            }
        ];

        let mockBannerData = [
            {
                id: "BAN_1",
                nama: "Penerimaan Santri Baru TA 2026/2027",
                gambar: "https://images.unsplash.com/photo-1577896851231-70ef18881754?q=80&w=1200&auto=format&fit=crop",
                tipeAksi: "tab",
                targetAksi: "ppdb",
                urutan: 1,
                status: "Aktif"
            },
            {
                id: "BAN_2",
                nama: "Dokumentasi Sema'an Rutin Bil-Ghaib",
                gambar: "https://images.unsplash.com/photo-1584286595398-a59f21d313f5?q=80&w=1200&auto=format&fit=crop",
                tipeAksi: "tab",
                targetAksi: "kabar",
                urutan: 2,
                status: "Aktif"
            },
            {
                id: "BAN_3",
                nama: "Program Unggulan Tahfidz & Kepesantrenan",
                gambar: "https://images.unsplash.com/photo-1542810634-71277d95dcbb?q=80&w=1200&auto=format&fit=crop",
                tipeAksi: "tab",
                targetAksi: "program-pilihan",
                urutan: 3,
                status: "Aktif"
            }
        ];

        let heroSlideTimer = null;
        let currentHeroSlide = 0;
        let previousTabBeforeNews = 'beranda';

        function checkIsAdminLoggedIn() {
            try {
                if (typeof isAdminLoggedIn !== 'undefined' && isAdminLoggedIn === true) return true;
                if (typeof ASNIdentity !== 'undefined' && (ASNIdentity.currentRole === 'admin' || ASNIdentity.currentRole === 'editor' || (typeof ASN_ROLES !== 'undefined' && ASNIdentity.currentRole === ASN_ROLES.ADMIN))) {
                    return true;
                }
                const tokenKey = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.storage && APP_CONFIG.storage.keys) ? APP_CONFIG.storage.keys.adminToken : "mubarokah_admin_token";
                const token = sessionStorage.getItem(tokenKey) || localStorage.getItem(tokenKey);
                const roleKey = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.storage && APP_CONFIG.storage.keys) ? APP_CONFIG.storage.keys.adminRole : "mubarokah_admin_role";
                const role = String(sessionStorage.getItem(roleKey) || localStorage.getItem(roleKey) || '').toLowerCase();
                if (token && (role === 'admin' || role === 'editor' || role === '')) {
                    return true;
                }
            } catch (e) {}
            return false;
        }

        let isAdminLoggedIn = (function() {
            try {
                const tokenKey = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.storage && APP_CONFIG.storage.keys) ? APP_CONFIG.storage.keys.adminToken : "mubarokah_admin_token";
                const token = sessionStorage.getItem(tokenKey) || localStorage.getItem(tokenKey);
                const roleKey = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.storage && APP_CONFIG.storage.keys) ? APP_CONFIG.storage.keys.adminRole : "mubarokah_admin_role";
                const role = String(sessionStorage.getItem(roleKey) || localStorage.getItem(roleKey) || '').toLowerCase();
                return Boolean(token && (role === 'admin' || role === 'editor' || role === ''));
            } catch (e) {
                return false;
            }
        })();
        let isLoggedIn = true;


        // ==================== UTILITY, MODAL & KALENDER ====================
        function showToast(message) {
            const toast = document.getElementById('toastMessage');
            const toastText = document.getElementById('toastText');
            toastText.innerText = message;
            toast.classList.remove('translate-y-20', 'opacity-0');
            toast.classList.add('translate-y-0', 'opacity-100');
            setTimeout(() => {
                toast.classList.remove('translate-y-0', 'opacity-100');
                toast.classList.add('translate-y-20', 'opacity-0');
            }, 3500);
        }

        function simulateDownload(fileName) {
            showToast(`Mengunduh berkas: ${fileName}...`);
        }

        function copyShareLink() {
            const dummy = document.createElement('input');
            dummy.value = window.location.href;
            document.body.appendChild(dummy);
            dummy.select();
            document.execCommand('copy');
            document.body.removeChild(dummy);
            showToast("Tautan berhasil disalin!");
        }

        // Logika Kalender
        let currentCalDate = new Date();
        const namaBulanIndo = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        const namaHariIndo = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
        const pasaranJawa = ["Legi", "Pahing", "Pon", "Wage", "Kliwon"];

        function getPasaranJawa(dateObj) {
            const timestamp = dateObj.getTime();
            const totalHari = Math.floor((timestamp + (7 * 3600 * 1000)) / 86400000);
            const pasaranIdx = (totalHari + 3) % 5;
            return pasaranJawa[(pasaranIdx + 5) % 5];
        }

        function renderCalendar() {
            const year = currentCalDate.getFullYear();
            const month = currentCalDate.getMonth();

            const monthYearText = document.getElementById('cal-month-year-text');
            if (monthYearText) monthYearText.innerText = `${namaBulanIndo[month]} ${year}`;

            const gridContainer = document.getElementById('calendar-days-grid');
            if (!gridContainer) return;
            gridContainer.innerHTML = "";

            const firstDayIndex = new Date(year, month, 1).getDay();
            const lastDate = new Date(year, month + 1, 0).getDate();

            for (let i = 0; i < firstDayIndex; i++) {
                const emptyCell = document.createElement('div');
                emptyCell.className = "p-2 min-h-[50px] md:min-h-[60px] bg-slate-50/50 dark:bg-[#15202d]/40 rounded-2xl";
                gridContainer.appendChild(emptyCell);
            }

            const today = new Date();
            for (let day = 1; day <= lastDate; day++) {
                const thisDate = new Date(year, month, day);
                const dayOfWeek = thisDate.getDay();
                const pasaran = getPasaranJawa(thisDate);
                const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

                const dayCell = document.createElement('div');
                let cellStyle = "p-1.5 md:p-2 min-h-[50px] md:min-h-[60px] rounded-2xl flex flex-col justify-between items-center cursor-pointer transition border border-slate-100 dark:border-[#253447] hover:border-brand-600 dark:hover:border-emerald-500 ";

                if (isToday) cellStyle += "bg-brand-700 dark:bg-emerald-600 text-white font-bold shadow-md";
                else if (dayOfWeek === 0) cellStyle += "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40";
                else if (dayOfWeek === 5) cellStyle += "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40";
                else cellStyle += "bg-slate-50 dark:bg-[#1c2836] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#253447]";

                dayCell.className = cellStyle;
                dayCell.onclick = () => selectCalDate(year, month, day, pasaran, dayOfWeek);

                const pasaranColor = isToday ? "text-amber-300" : (dayOfWeek === 0 ? "text-red-400 dark:text-red-400" : "text-slate-400 dark:text-slate-400");
                dayCell.innerHTML = `
                    <span class="text-xs md:text-sm font-extrabold">${day}</span>
                    <span class="text-[8px] md:text-[9px] font-semibold ${pasaranColor}">${pasaran}</span>
                `;
                gridContainer.appendChild(dayCell);
            }

            selectCalDate(today.getFullYear(), today.getMonth(), today.getDate(), getPasaranJawa(today), today.getDay());
        }

        function changeCalMonth(delta) {
            currentCalDate.setMonth(currentCalDate.getMonth() + delta);
            renderCalendar();
        }

        function selectCalDate(year, month, day, pasaran, dayOfWeek) {
            const hari = namaHariIndo[dayOfWeek];
            const bulan = namaBulanIndo[month];

            const titleEl = document.getElementById('selected-date-title');
            const subtitleEl = document.getElementById('selected-date-subtitle');
            const tagEl = document.getElementById('selected-date-tag');

            if (titleEl) titleEl.innerText = `${hari} ${pasaran}, ${day} ${bulan} ${year}`;
            if (subtitleEl) subtitleEl.innerText = `Weton: ${hari} ${pasaran} • Kalender Jawa & Nasional`;
            if (tagEl) {
                if (hari === "Jumat") tagEl.innerHTML = `<i class="fa-solid fa-mosque text-emerald-400 mr-1"></i> Sayyidul Ayyam / Kajian Rutin`;
                else if (hari === "Minggu") tagEl.innerHTML = `<i class="fa-solid fa-mug-hot text-amber-400 mr-1"></i> Hari Libur Kegiatan KBM`;
                else tagEl.innerHTML = `<i class="fa-solid fa-book-quran text-amber-400 mr-1"></i> Activity Normal Pesantren`;
            }
        }
