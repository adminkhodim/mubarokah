        // ==================== API ADAPTER LAYER ====================
        // Seluruh komunikasi backend melewati adapter ini, mengacu pada APP_CONFIG.
        const WEB_APP_URL = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.infrastructure && 
            ((APP_CONFIG.infrastructure.apiBaseUrl && APP_CONFIG.infrastructure.apiBaseUrl !== '__MUBAROKAH_CONFIG_PENDING__') ? APP_CONFIG.infrastructure.apiBaseUrl :
             (APP_CONFIG.infrastructure.appsScriptWebAppUrl && APP_CONFIG.infrastructure.appsScriptWebAppUrl !== '__MUBAROKAH_CONFIG_PENDING__') ? APP_CONFIG.infrastructure.appsScriptWebAppUrl : "")) || "";

        const AUTHORITATIVE_TENANT_ID = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.tenant && APP_CONFIG.tenant.tenantId)
            ? APP_CONFIG.tenant.tenantId
            : "mubarokah";

        async function apiGet(action, params = {}) {
            const isHostedWeb = typeof window !== 'undefined' && window.location && window.location.protocol.startsWith('http');
            const proxyBase = isHostedWeb ? `${window.location.origin}/api/auth` : '';
            const baseUrl = proxyBase || WEB_APP_URL;
            if (!baseUrl) throw new Error("API URL belum dikonfigurasi.");

            const url = new URL(baseUrl);
            url.searchParams.set("action", action);
            Object.entries(params).forEach(([key, value]) => {
                // Prevent client-side or arbitrary query param from overriding authoritative tenantId
                if (key === 'tenantId') {
                    url.searchParams.set("tenantId", AUTHORITATIVE_TENANT_ID);
                } else if (value !== undefined && value !== null) {
                    url.searchParams.set(key, String(value));
                }
            });

            try {
                const response = await fetch(url.toString(), {
                    method: "GET",
                    redirect: "follow",
                    credentials: "omit",
                    headers: { "Accept": "application/json" }
                });

                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return await response.json();
            } catch (err) {
                // Fallback ke WEB_APP_URL langsung jika proxy lokal/offline gagal
                if (baseUrl === proxyBase && WEB_APP_URL && WEB_APP_URL !== proxyBase) {
                    console.warn(`[apiGet] Proxy ${action} gagal, fallback ke direct Apps Script URL...`, err);
                    const fallbackUrl = new URL(WEB_APP_URL);
                    fallbackUrl.searchParams.set("action", action);
                    Object.entries(params).forEach(([key, value]) => {
                        if (key === 'tenantId') fallbackUrl.searchParams.set("tenantId", AUTHORITATIVE_TENANT_ID);
                        else if (value !== undefined && value !== null) fallbackUrl.searchParams.set(key, String(value));
                    });
                    const fallbackRes = await fetch(fallbackUrl.toString(), {
                        method: "GET",
                        redirect: "follow",
                        credentials: "omit",
                        headers: { "Accept": "application/json" }
                    });
                    if (!fallbackRes.ok) throw new Error(`HTTP ${fallbackRes.status}`);
                    return await fallbackRes.json();
                }
                throw err;
            }
        }

        async function apiPost(action, payload = {}) {
            const isHostedWeb = typeof window !== 'undefined' && window.location && window.location.protocol.startsWith('http');
            const proxyBase = isHostedWeb ? `${window.location.origin}/api/auth` : '';
            const targetUrl = proxyBase || WEB_APP_URL;
            if (!targetUrl) throw new Error("WEB_APP_URL belum dikonfigurasi.");

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

            let response;
            try {
                response = await fetch(targetUrl, {
                    method: "POST",
                    redirect: "follow",
                    credentials: "omit",
                    headers: {
                        "Content-Type": "text/plain;charset=utf-8",
                        "Accept": "application/json"
                    },
                    body: JSON.stringify(bodyPayload)
                });
            } catch (postErr) {
                if (targetUrl === proxyBase && WEB_APP_URL && WEB_APP_URL !== proxyBase) {
                    console.warn(`[apiPost] Proxy ${action} gagal, fallback ke direct Apps Script URL...`, postErr);
                    response = await fetch(WEB_APP_URL, {
                        method: "POST",
                        redirect: "follow",
                        credentials: "omit",
                        headers: {
                            "Content-Type": "text/plain;charset=utf-8",
                            "Accept": "application/json"
                        },
                        body: JSON.stringify(bodyPayload)
                    });
                } else {
                    throw postErr;
                }
            }

            // Fallback ke direct Apps Script jika proxy Vercel mengembalikan error 5xx (misal 504 timeout)
            if (!response.ok && (response.status >= 500 && response.status < 600) && targetUrl === proxyBase && WEB_APP_URL && WEB_APP_URL !== proxyBase) {
                console.warn(`[apiPost] Proxy ${action} mengembalikan HTTP ${response.status}. Mencoba langsung ke Google Apps Script...`);
                try {
                    const fallbackRes = await fetch(WEB_APP_URL, {
                        method: "POST",
                        redirect: "follow",
                        credentials: "omit",
                        headers: {
                            "Content-Type": "text/plain;charset=utf-8",
                            "Accept": "application/json"
                        },
                        body: JSON.stringify(bodyPayload)
                    });
                    if (fallbackRes.ok) {
                        return await fallbackRes.json();
                    }
                } catch (fbErr) {
                    console.warn(`[apiPost] Fallback direct Apps Script juga gagal:`, fbErr);
                }
            }

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
        /**
         * Ekstrak 11-karakter YouTube Video ID dari berbagai format input (URL reguler, pendek, live, shorts, embed, maupun tag <iframe>).
         */
        function extractYoutubeId(input) {
            if (!input || typeof input !== 'string') return null;
            let str = input.trim();
            if (!str) return null;

            // Ekstrak nilai src jika user menyalin seluruh kode tag <iframe>
            const iframeSrc = str.match(/src=["']([^"']+)["']/i);
            if (iframeSrc && iframeSrc[1]) {
                str = iframeSrc[1].trim();
            }

            // 1. Raw 11-character video ID
            if (/^[a-zA-Z0-9_-]{11}$/.test(str)) {
                return str;
            }

            // 2. youtu.be/ID atau youtube.com/(embed|shorts|live|v)/ID
            const shortMatch = str.match(/(?:youtu\.be\/|youtube\.com\/(?:embed|shorts|live|v)\/)([a-zA-Z0-9_-]{11})/i);
            if (shortMatch && shortMatch[1]) {
                return shortMatch[1];
            }

            // 3. watch?v=ID atau &v=ID
            const watchMatch = str.match(/[?&]v=([a-zA-Z0-9_-]{11})/i);
            if (watchMatch && watchMatch[1]) {
                return watchMatch[1];
            }

            // 4. youtube.com/embed/ID
            const embedMatch = str.match(/youtube(?:-nocookie)?\.com\/embed\/([a-zA-Z0-9_-]{11})/i);
            if (embedMatch && embedMatch[1]) {
                return embedMatch[1];
            }

            return null;
        }

        /**
         * Konversi berbagai format URL YouTube menjadi URL embed resmi yang aman disematkan dalam <iframe>.
         */
        function formatYoutubeEmbedUrl(rawUrl) {
            if (!rawUrl || typeof rawUrl !== 'string') return "https://www.youtube.com/embed/ZQZqPcAlrk0?rel=0";
            const trimmed = rawUrl.trim();
            if (!trimmed) return "https://www.youtube.com/embed/ZQZqPcAlrk0?rel=0";

            // 1. Playlist
            const playlistMatch = trimmed.match(/[?&]list=([a-zA-Z0-9_-]+)/);
            if (playlistMatch && playlistMatch[1] && !trimmed.includes('watch?v=')) {
                return `https://www.youtube.com/embed/videoseries?list=${playlistMatch[1]}&rel=0`;
            }

            // 2. Ekstrak Video ID
            const videoId = extractYoutubeId(trimmed);
            if (videoId) {
                return `https://www.youtube.com/embed/${videoId}?rel=0`;
            }

            // 3. Jika sudah berformat embed URL
            if (trimmed.includes('youtube.com/embed/') || trimmed.includes('youtube-nocookie.com/embed/')) {
                return trimmed.includes('?') ? trimmed : `${trimmed}?rel=0`;
            }

            return "https://www.youtube.com/embed/ZQZqPcAlrk0?rel=0";
        }

        /**
         * Mengembalikan URL tonton langsung (https://youtu.be/ID) untuk tombol eksternal.
         */
        function getYoutubeWatchUrl(embedOrRawUrl) {
            if (!embedOrRawUrl || typeof embedOrRawUrl !== 'string') return "https://youtu.be/ZQZqPcAlrk0";
            const trimmed = embedOrRawUrl.trim();
            const playlistMatch = trimmed.match(/[?&]list=([a-zA-Z0-9_-]+)/);
            if (playlistMatch && playlistMatch[1] && !trimmed.includes('watch?v=')) {
                return `https://www.youtube.com/playlist?list=${playlistMatch[1]}`;
            }
            const videoId = extractYoutubeId(trimmed);
            if (videoId) {
                return `https://youtu.be/${videoId}`;
            }
            return trimmed;
        }

        if (typeof window !== 'undefined') {
            window.extractYoutubeId = extractYoutubeId;
            window.formatYoutubeEmbedUrl = formatYoutubeEmbedUrl;
            window.getYoutubeWatchUrl = getYoutubeWatchUrl;
        }

        // ==================== STATE MANAGEMENT DATA ====================
        // Canonical real seed news data (Mencegah tampilan mock dummy data saat proses fetching)
        let mockNewsData = [
            {
                news_id: "NWS_1789722096909_3sam",
                slug: "khatam-30-juz-bukan-akhir-pesan-haflah-khotmil-quran-ke-22-roudlotul-mubarokah-dk9t",
                tanggal: "29 September 2025",
                kategori: "Kegiatan",
                judul: "Khatam 30 Juz Bukan Akhir, Pesan Haflah Khotmil Qur’an ke-22 Roudlotul Mubarokah",
                ringkasan: "Haflah Khotmil Qur’an ke-22 Pondok Pesantren Roudlotul Mubarokah menjadi momentum syukur atas pencapaian 35 peserta sekaligus pengingat bahwa khatam 30 juz bukan akhir perjalanan bersama Al-Qur’an.",
                isi: "DEMAK — Menyelesaikan hafalan 30 juz Al-Qur'an bukanlah akhir perjalanan seorang penghafal. Dalam Haflah Khotmil Qur'an ke-22 Pondok Pesantren Roudlotul Mubarokah, khatam ditekankan sebagai awal tanggung jawab untuk menjaga hafalan, memahami kandungan Al-Qur'an, dan mengamalkan nilai-nilainya dalam kehidupan.\n\nPesan tersebut mengemuka dalam Haflah Khotmil Qur'an ke-22 Pondok Pesantren Roudlotul Mubarokah, Rimbukidul, Karangawen, Demak, Minggu (28/9/2025). Mengusung tema “Menuju Generasi Qur'ani penuh berkah, mulia dan membawa kedamaian bagi umat”, kegiatan ini diikuti 35 peserta, terdiri atas 10 peserta Bil Hifdhi, 14 peserta Bin Nadhor, dan 11 peserta Juz Amma.",
                penulis: "Admin",
                gambar: "https://lh3.googleusercontent.com/d/1teGHXQOypKuqq02-jCMsUV-E06ZY28L4",
                views: 24
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

        let mockGaleriData = [
            {
                id: "GLR_1",
                judul: "Halaqah Hafalan Al-Qur'an Santri",
                kategori: "Kegiatan Santri",
                keterangan: "Sima'an rutin bakda Subuh di Masjid Utama",
                gambar: "https://images.unsplash.com/photo-1585036156171-384164a8c675?q=80&w=800&auto=format&fit=crop",
                status: "Aktif",
                timestamp: "2026-03-01T05:30:00.000Z"
            },
            {
                id: "GLR_2",
                judul: "Peringatan Hari Santri Nasional",
                kategori: "Event Utama",
                keterangan: "Apel akbar dan pawai santri pondok",
                gambar: "https://images.unsplash.com/photo-1564769625905-50e93615e769?q=80&w=800&auto=format&fit=crop",
                status: "Aktif",
                timestamp: "2026-03-05T08:00:00.000Z"
            },
            {
                id: "GLR_3",
                judul: "Gedung Asrama & Perpustakaan Digital",
                kategori: "Fasilitas Kampus",
                keterangan: "Kawasan belajar terpadu santri",
                gambar: "https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?q=80&w=800&auto=format&fit=crop",
                status: "Aktif",
                timestamp: "2026-03-10T10:00:00.000Z"
            },
            {
                id: "GLR_4",
                judul: "Juara Umum Musabaqah Hifdzil Qur'an",
                kategori: "Prestasi",
                keterangan: "Penghargaan tingkat kabupaten",
                gambar: "https://images.unsplash.com/photo-1577896851231-70ef18881754?q=80&w=800&auto=format&fit=crop",
                status: "Aktif",
                timestamp: "2026-03-15T14:00:00.000Z"
            }
        ];

        let heroSlideTimer = null;
        let currentHeroSlide = 0;
        let previousTabBeforeNews = 'beranda';

        function checkIsAdminLoggedIn() {
            try {
                if (typeof isAdminLoggedIn !== 'undefined' && isAdminLoggedIn === true) return true;
                if (typeof ASNIdentity !== 'undefined') {
                    const r = String(ASNIdentity.currentRole || '').toUpperCase();
                    if (['SUPER_ADMIN', 'ADMIN', 'BENDAHARA', 'PENGURUS', 'ASATIDZ', 'PEGAWAI', 'EDITOR'].includes(r)) return true;
                }
                const tokenKey = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.storage && APP_CONFIG.storage.keys) ? APP_CONFIG.storage.keys.adminToken : "mubarokah_admin_token";
                const token = sessionStorage.getItem(tokenKey) || localStorage.getItem(tokenKey);
                const roleKey = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.storage && APP_CONFIG.storage.keys) ? APP_CONFIG.storage.keys.adminRole : "mubarokah_admin_role";
                const role = String(sessionStorage.getItem(roleKey) || localStorage.getItem(roleKey) || '').toLowerCase();
                if (token && (['super_admin', 'admin', 'bendahara', 'pengurus', 'asatidz', 'pegawai', 'editor'].includes(role) || role === '')) {
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
                return Boolean(token && (['super_admin', 'admin', 'pegawai', 'editor'].includes(role) || role === ''));
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
            const currentUrl = window.location.href;
            const titleEl = document.getElementById('detail-news-title');
            const title = titleEl ? titleEl.innerText.trim() : 'Warta Pesantren';

            if (navigator.share) {
                navigator.share({
                    title: title,
                    text: `${title}\n\nBaca warta selengkapnya di:`,
                    url: currentUrl
                }).catch(() => {});
                return;
            }

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(currentUrl).then(() => {
                    showToast("Tautan berita berhasil disalin ke clipboard!");
                }).catch(() => {
                    fallbackCopy(currentUrl);
                });
            } else {
                fallbackCopy(currentUrl);
            }
        }

        function fallbackCopy(text) {
            const dummy = document.createElement('input');
            dummy.value = text;
            document.body.appendChild(dummy);
            dummy.select();
            document.execCommand('copy');
            document.body.removeChild(dummy);
            showToast("Tautan berita berhasil disalin!");
        }

        function shareBeritaWhatsApp() {
            const currentUrl = window.location.href;
            const titleEl = document.getElementById('detail-news-title');
            const title = titleEl ? titleEl.innerText.trim() : 'Warta Pesantren';
            const text = `*${title}*\n\nBaca warta resmi selengkapnya di:\n${currentUrl}`;
            const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
            window.open(waUrl, '_blank');
        }

        function shareBeritaFacebook() {
            const currentUrl = window.location.href;
            const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentUrl)}`;
            window.open(fbUrl, '_blank');
        }

        // ==================== LOGIKA KALENDER (TRI-KALENDER: MASEHI, HIJRIYAH & JAWA) ====================
        let currentCalDate = new Date();
        const namaBulanIndo = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        const namaHariIndo = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
        const pasaranJawa = ["Legi", "Pahing", "Pon", "Wage", "Kliwon"];

        const namaBulanHijriyah = [
            "",
            "Muharram",
            "Safar",
            "Rabi'ul Awwal",
            "Rabi'ul Akhir",
            "Jumadil Ula",
            "Jumadil Akhirah",
            "Rajab",
            "Sya'ban",
            "Ramadhan",
            "Syawal",
            "Dzulqa'dah",
            "Dzulhijjah"
        ];

        // Database Hari Besar Islam Berdasarkan Kalender Hijriyah (Format: "Bulan-Tanggal")
        const HARI_BESAR_ISLAM = {
            "1-1": { title: "Tahun Baru Islam", desc: "1 Muharram - Awal Tahun Baru Hijriyah", type: "holiday", badgeColor: "amber", icon: "fa-star-and-crescent" },
            "1-9": { title: "Puasa Tasu'a", desc: "9 Muharram - Puasa Sunnah Tasu'a", type: "fasting", badgeColor: "emerald", icon: "fa-moon" },
            "1-10": { title: "Hari Asyura & Puasa Asyura", desc: "10 Muharram - Puasa Sunnah Pelebur Dosa Setahun", type: "fasting", badgeColor: "emerald", icon: "fa-moon" },
            "3-12": { title: "Maulid Nabi Muhammad SAW", desc: "12 Rabi'ul Awwal - Peringatan Kelahiran Rasulullah SAW", type: "holiday", badgeColor: "amber", icon: "fa-mosque" },
            "7-27": { title: "Isra' Mi'raj Nabi Muhammad SAW", desc: "27 Rajab - Peristiwa Agung Isra' & Mi'raj", type: "holiday", badgeColor: "amber", icon: "fa-mosque" },
            "8-15": { title: "Malam Nisfu Sya'ban", desc: "15 Sya'ban - Malam Pertengahan Bulan Sya'ban & Doa Bersama", type: "event", badgeColor: "indigo", icon: "fa-star" },
            "9-1": { title: "Awal Puasa Ramadhan", desc: "1 Ramadhan - Pembuka Ibadah Puasa Wajib Umat Islam", type: "ramadhan", badgeColor: "emerald", icon: "fa-moon" },
            "9-17": { title: "Peringatan Nuzulul Qur'an", desc: "17 Ramadhan - Peringatan Turunnya Al-Qur'anul Karim", type: "holiday", badgeColor: "amber", icon: "fa-book-quran" },
            "10-1": { title: "Hari Raya Idul Fitri", desc: "1 Syawal - Hari Kemenangan & Shalat Ied (Haram Puasa)", type: "eid", badgeColor: "rose", icon: "fa-mosque" },
            "10-2": { title: "Hari Raya Idul Fitri (Hari Ke-2)", desc: "2 Syawal - Silaturahmi Syawal & Halalbihalal", type: "eid", badgeColor: "rose", icon: "fa-mosque" },
            "12-8": { title: "Hari Tarwiyah", desc: "8 Dzulhijjah - Puasa Sunnah Tarwiyah", type: "fasting", badgeColor: "emerald", icon: "fa-moon" },
            "12-9": { title: "Hari Arafah", desc: "9 Dzulhijjah - Puasa Sunnah Arafah Penghapus Dosa 2 Tahun", type: "fasting", badgeColor: "emerald", icon: "fa-moon" },
            "12-10": { title: "Hari Raya Idul Adha", desc: "10 Dzulhijjah - Shalat Ied Qurban & Penyembelihan (Haram Puasa)", type: "eid", badgeColor: "rose", icon: "fa-cow" },
            "12-11": { title: "Hari Tasyrik Ke-1", desc: "11 Dzulhijjah - Hari Tasyrik Qurban (Haram Puasa)", type: "tasyrik", badgeColor: "rose", icon: "fa-ban" },
            "12-12": { title: "Hari Tasyrik Ke-2", desc: "12 Dzulhijjah - Hari Tasyrik Qurban (Haram Puasa)", type: "tasyrik", badgeColor: "rose", icon: "fa-ban" },
            "12-13": { title: "Hari Tasyrik Ke-3", desc: "13 Dzulhijjah - Hari Tasyrik Qurban (Haram Puasa)", type: "tasyrik", badgeColor: "rose", icon: "fa-ban" }
        };

        // Agenda Tahunan Nasional & Pesantren (Berdasarkan Penanggalan Masehi "Bulan-Tanggal")
        const AGENDA_MASEHI = {
            "8-17": { title: "HUT Kemerdekaan RI", desc: "17 Agustus - Upacara Bendera Santri & Asatidz", type: "national", badgeColor: "red", icon: "fa-flag" },
            "10-22": { title: "Hari Santri Nasional", desc: "22 Oktober - Apel Akbar & Kirab Resolusi Jihad", type: "pesantren", badgeColor: "emerald", icon: "fa-users" }
        };

        // Standar Koreksi Kalender Hijriyah Lembaga Falakiyah PBNU (LF PBNU) & Kemenag RI
        // Kalender Ummul Qura (Arab Saudi) umumnya mendahului 1 hari dibanding Imkanur Rukyah MABIMS LF PBNU di Indonesia.
        // Dengan koreksi -1 hari, tanggal 26 September 2026 bertepatan dengan 14 Rabi'ul Akhir 1448 H (sesuai Falakiyah PBNU).
        const HIJRI_OFFSET_PBNU = -1;

        function getPasaranJawa(dateObj) {
            const timestamp = dateObj.getTime();
            const totalHari = Math.floor((timestamp + (7 * 3600 * 1000)) / 86400000);
            const pasaranIdx = (totalHari + 3) % 5;
            return pasaranJawa[(pasaranIdx + 5) % 5];
        }

        function getHijriDate(dateObj, offsetDays = HIJRI_OFFSET_PBNU) {
            if (!dateObj) dateObj = new Date();
            try {
                // Terapkan penyesuaian hari sesuai hisab / rukyah LF PBNU
                const targetTime = dateObj.getTime() + (offsetDays * 86400000);
                const adjustedDate = new Date(targetTime);

                let fmt;
                try {
                    fmt = new Intl.DateTimeFormat('id-ID-u-ca-islamic-umalqura', {
                        day: 'numeric',
                        month: 'numeric',
                        year: 'numeric'
                    });
                } catch (e1) {
                    fmt = new Intl.DateTimeFormat('id-ID-u-ca-islamic', {
                        day: 'numeric',
                        month: 'numeric',
                        year: 'numeric'
                    });
                }
                const parts = fmt.formatToParts(adjustedDate);
                let day = 1, month = 1, year = 1448;
                for (const p of parts) {
                    if (p.type === 'day') day = parseInt(p.value, 10);
                    if (p.type === 'month') month = parseInt(p.value, 10);
                    if (p.type === 'year') {
                        const cleanYear = p.value.replace(/[^0-9]/g, '');
                        if (cleanYear) year = parseInt(cleanYear, 10);
                    }
                }
                const monthName = namaBulanHijriyah[month] || `Bulan ${month}`;
                return {
                    day,
                    month,
                    year,
                    monthName,
                    formatted: `${day} ${monthName} ${year} H`
                };
            } catch (e) {
                return {
                    day: 1,
                    month: 1,
                    year: 1448,
                    monthName: "Hijriyah",
                    formatted: "1448 H"
                };
            }
        }

        function getIslamicCalendarInfo(dateObj) {
            const hijri = getHijriDate(dateObj);
            const dayOfWeek = dateObj.getDay();
            const masehiKey = `${dateObj.getMonth() + 1}-${dateObj.getDate()}`;
            const hijriKey = `${hijri.month}-${hijri.day}`;

            const holiday = HARI_BESAR_ISLAM[hijriKey] || null;
            const national = AGENDA_MASEHI[masehiKey] || null;

            // Hari yang Diharamkan Berpuasa (1 Syawal & 10-13 Dzulhijjah)
            const isHaramPuasa = (hijri.month === 10 && hijri.day === 1) ||
                                 (hijri.month === 12 && [10, 11, 12, 13].includes(hijri.day));

            // Puasa Wajib Ramadhan
            const isRamadhan = (hijri.month === 9);

            // Puasa Sunnah Ayyamul Bidh (13, 14, 15 Hijriyah) kecuali Ramadhan & 13 Dzulhijjah
            const isAyyamulBidh = !isRamadhan && !isHaramPuasa && [13, 14, 15].includes(hijri.day);

            // Puasa Sunnah Rutin Senin & Kamis
            const isSeninKamis = !isRamadhan && !isHaramPuasa && (dayOfWeek === 1 || dayOfWeek === 4);

            let fastingInfo = null;
            if (isRamadhan) {
                fastingInfo = { name: `Puasa Ramadhan (Hari Ke-${hijri.day})`, type: 'ramadhan' };
            } else if (isAyyamulBidh) {
                const urutan = hijri.day === 13 ? "Hari Ke-1" : hijri.day === 14 ? "Hari Ke-2" : "Hari Ke-3";
                fastingInfo = { name: `Puasa Sunnah Ayyamul Bidh (${urutan})`, type: 'ayyamul-bidh' };
            } else if (isSeninKamis) {
                fastingInfo = { name: `Puasa Sunnah ${dayOfWeek === 1 ? 'Senin' : 'Kamis'}`, type: 'senin-kamis' };
            }

            return {
                hijri,
                holiday,
                national,
                fastingInfo,
                isHaramPuasa,
                isSayyidulAyyam: dayOfWeek === 5
            };
        }

        function renderCalendar() {
            const year = currentCalDate.getFullYear();
            const month = currentCalDate.getMonth();

            const monthYearText = document.getElementById('cal-month-year-text');
            if (monthYearText) monthYearText.innerText = `${namaBulanIndo[month]} ${year}`;

            const firstDateObj = new Date(year, month, 1);
            const lastDate = new Date(year, month + 1, 0).getDate();
            const lastDateObj = new Date(year, month, lastDate);

            // Subheader Rentang Bulan Hijriyah
            const hijriMonthText = document.getElementById('cal-hijri-month-text');
            if (hijriMonthText) {
                const hStart = getHijriDate(firstDateObj);
                const hEnd = getHijriDate(lastDateObj);
                if (hStart.month === hEnd.month) {
                    hijriMonthText.innerText = `${hStart.monthName} ${hStart.year} H`;
                } else if (hStart.year === hEnd.year) {
                    hijriMonthText.innerText = `${hStart.monthName} - ${hEnd.monthName} ${hEnd.year} H`;
                } else {
                    hijriMonthText.innerText = `${hStart.monthName} ${hStart.year} - ${hEnd.monthName} ${hEnd.year} H`;
                }
            }

            const gridContainer = document.getElementById('calendar-days-grid');
            if (!gridContainer) return;
            gridContainer.innerHTML = "";

            const firstDayIndex = firstDateObj.getDay();

            for (let i = 0; i < firstDayIndex; i++) {
                const emptyCell = document.createElement('div');
                emptyCell.className = "p-1 min-h-[44px] sm:min-h-[52px] md:min-h-[58px] bg-slate-50/40 dark:bg-[#15202d]/30 rounded-xl md:rounded-2xl";
                gridContainer.appendChild(emptyCell);
            }

            const today = new Date();
            const eventsInMonth = [];

            for (let day = 1; day <= lastDate; day++) {
                const thisDate = new Date(year, month, day);
                const dayOfWeek = thisDate.getDay();
                const pasaran = getPasaranJawa(thisDate);
                const calInfo = getIslamicCalendarInfo(thisDate);
                const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

                // Koleksi Agenda & Hari Besar Bulan Ini
                if (calInfo.holiday) {
                    eventsInMonth.push({
                        day,
                        title: calInfo.holiday.title,
                        desc: calInfo.holiday.desc,
                        badgeText: "Hari Besar Islam",
                        badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
                        boxBg: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300"
                    });
                }
                if (calInfo.national) {
                    eventsInMonth.push({
                        day,
                        title: calInfo.national.title,
                        desc: calInfo.national.desc,
                        badgeText: "Agenda Nasional",
                        badgeClass: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
                        boxBg: "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-300"
                    });
                }
                if (calInfo.hijri.day === 13 && !calInfo.isHaramPuasa && calInfo.hijri.month !== 9) {
                    eventsInMonth.push({
                        day,
                        title: `Awal Puasa Ayyamul Bidh (${calInfo.hijri.monthName})`,
                        desc: `Puasa Sunnah 13, 14, 15 ${calInfo.hijri.monthName} ${calInfo.hijri.year} H`,
                        badgeText: "Puasa Sunnah",
                        badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
                        boxBg: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-300"
                    });
                }

                // Dot Indikator di Kotak Kalender
                let dotIndicator = `<span class="w-1.5 h-1.5 inline-block"></span>`;
                if (calInfo.holiday) {
                    dotIndicator = `<span class="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="${calInfo.holiday.title}"></span>`;
                } else if (calInfo.fastingInfo) {
                    dotIndicator = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="${calInfo.fastingInfo.name}"></span>`;
                } else if (calInfo.isSayyidulAyyam) {
                    dotIndicator = `<span class="w-1.5 h-1.5 rounded-full bg-teal-400/80 shrink-0" title="Sayyidul Ayyam"></span>`;
                }

                const dayCell = document.createElement('div');
                let cellStyle = "p-1 min-h-[44px] sm:min-h-[52px] md:min-h-[58px] rounded-xl md:rounded-2xl flex flex-col justify-between items-center cursor-pointer transition border border-slate-100 dark:border-[#253447] hover:border-brand-600 dark:hover:border-emerald-500 ";

                if (isToday) {
                    cellStyle += "bg-brand-700 dark:bg-emerald-600 text-white font-bold shadow-md ring-2 ring-brand-500/30 dark:ring-emerald-400/30";
                } else if (dayOfWeek === 0) {
                    cellStyle += "bg-red-50/60 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40";
                } else if (dayOfWeek === 5) {
                    cellStyle += "bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40";
                } else {
                    cellStyle += "bg-slate-50/70 dark:bg-[#1c2836] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#253447]";
                }

                dayCell.className = cellStyle;
                dayCell.onclick = () => selectCalDate(year, month, day, pasaran, dayOfWeek);

                const hijriColor = isToday ? "text-amber-200" : "text-emerald-600 dark:text-emerald-400";
                const pasaranColor = isToday ? "text-amber-300" : (dayOfWeek === 0 ? "text-red-400 dark:text-red-400" : "text-slate-400 dark:text-slate-400");

                dayCell.innerHTML = `
                    <div class="flex justify-between items-center w-full px-0.5 sm:px-1 leading-none">
                        <div class="flex items-center">${dotIndicator}</div>
                        <span class="text-[8.5px] sm:text-[9.5px] font-bold ${hijriColor}">${calInfo.hijri.day}</span>
                    </div>
                    <span class="text-xs sm:text-sm font-extrabold my-0 leading-tight">${day}</span>
                    <span class="text-[7.5px] sm:text-[8.5px] font-semibold leading-none ${pasaranColor}">${pasaran}</span>
                `;
                gridContainer.appendChild(dayCell);
            }

            // Render Daftar Agenda & Hari Besar Bulan Ini
            renderCalendarEvents(eventsInMonth, month);

            // Set Tanggal Terpilih Default
            if (month === today.getMonth() && year === today.getFullYear()) {
                selectCalDate(today.getFullYear(), today.getMonth(), today.getDate(), getPasaranJawa(today), today.getDay());
            } else {
                selectCalDate(year, month, 1, getPasaranJawa(firstDateObj), firstDateObj.getDay());
            }
        }

        function renderCalendarEvents(events, month) {
            const container = document.getElementById('calendar-events-container');
            const countEl = document.getElementById('cal-events-count');
            if (!container) return;

            if (countEl) {
                countEl.innerText = `${events.length} Agenda`;
            }

            if (events.length === 0) {
                container.innerHTML = `
                    <div class="col-span-full p-4 text-center rounded-2xl bg-slate-50 dark:bg-[#1c2836] border border-dashed border-slate-200 dark:border-[#253447] text-xs text-slate-400 dark:text-slate-500">
                        <i class="fa-solid fa-calendar-check text-base text-slate-300 dark:text-slate-600 mb-1 block"></i>
                        Tidak ada peringatan hari besar khusus di bulan ${namaBulanIndo[month]}. Kegiatan pengajian & KBM santri berjalan normal.
                    </div>
                `;
                return;
            }

            const shortMonth = namaBulanIndo[month].substring(0, 3);
            container.innerHTML = events.map(ev => `
                <div class="p-3 bg-slate-50 dark:bg-[#1c2836] rounded-2xl border border-slate-100 dark:border-[#253447] flex items-center space-x-3 transition hover:border-emerald-500/40">
                    <div class="w-10 h-10 ${ev.boxBg} rounded-xl flex flex-col items-center justify-center font-bold shrink-0 shadow-xs">
                        <span class="text-xs font-extrabold leading-none">${ev.day}</span>
                        <span class="text-[8px] uppercase font-semibold leading-none mt-0.5">${shortMonth}</span>
                    </div>
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <h4 class="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">${ev.title}</h4>
                            <span class="text-[9px] font-semibold px-1.5 py-0.5 rounded-md ${ev.badgeClass}">${ev.badgeText}</span>
                        </div>
                        <p class="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">${ev.desc}</p>
                    </div>
                </div>
            `).join('');
        }

        function changeCalMonth(delta) {
            currentCalDate.setMonth(currentCalDate.getMonth() + delta);
            renderCalendar();
        }

        function selectCalDate(year, month, day, pasaran, dayOfWeek) {
            const thisDate = new Date(year, month, day);
            const today = new Date();
            const isToday = (day === today.getDate() && month === today.getMonth() && year === today.getFullYear());
            const info = getIslamicCalendarInfo(thisDate);
            const hari = namaHariIndo[dayOfWeek];
            const bulan = namaBulanIndo[month];

            const statusBadgeEl = document.getElementById('selected-date-status-badge');
            const titleEl = document.getElementById('selected-date-title');
            const subtitleEl = document.getElementById('selected-date-subtitle');
            const tagEl = document.getElementById('selected-date-tag');

            // Baris 1: Status Badge (Hari Ini / Tanggal Terpilih)
            if (statusBadgeEl) {
                if (isToday) {
                    statusBadgeEl.innerText = "Hari Ini";
                    statusBadgeEl.className = "text-[9px] font-extrabold uppercase bg-amber-400/25 text-amber-300 px-2 py-0.5 rounded tracking-wider shrink-0";
                } else {
                    statusBadgeEl.innerText = "Tanggal Terpilih";
                    statusBadgeEl.className = "text-[9px] font-bold uppercase bg-white/15 text-slate-200 px-2 py-0.5 rounded tracking-wider shrink-0";
                }
            }

            // Baris 1: Tag Ibadah / Peringatan / Agenda
            if (tagEl) {
                if (info.holiday) {
                    tagEl.innerHTML = `<i class="fa-solid ${info.holiday.icon} text-amber-300 mr-1.5"></i> ${info.holiday.title}`;
                } else if (info.isHaramPuasa) {
                    tagEl.innerHTML = `<i class="fa-solid fa-ban text-rose-300 mr-1.5"></i> Hari Diharamkan Berpuasa`;
                } else if (info.fastingInfo) {
                    tagEl.innerHTML = `<i class="fa-solid fa-moon text-emerald-300 mr-1.5"></i> ${info.fastingInfo.name}`;
                } else if (info.national) {
                    tagEl.innerHTML = `<i class="fa-solid ${info.national.icon} text-amber-300 mr-1.5"></i> ${info.national.title}`;
                } else if (hari === "Jumat") {
                    tagEl.innerHTML = `<i class="fa-solid fa-mosque text-emerald-300 mr-1.5"></i> Sayyidul Ayyam`;
                } else if (hari === "Minggu") {
                    tagEl.innerHTML = `<i class="fa-solid fa-mug-hot text-amber-300 mr-1.5"></i> Libur KBM Santri`;
                } else {
                    tagEl.innerHTML = `<i class="fa-solid fa-book-quran text-amber-300 mr-1.5"></i> Kegiatan Normal`;
                }
            }

            // Baris 2: Hari, tgl bln thn MASEHI
            if (titleEl) {
                titleEl.innerText = `${hari} ${pasaran}, ${day} ${bulan} ${year}`;
            }

            // Baris 3: Hari, tgl bln thn HIJRIYAH (Standar LF PBNU)
            if (subtitleEl) {
                subtitleEl.innerText = `${hari} ${pasaran}, ${info.hijri.day} ${info.hijri.monthName} ${info.hijri.year} H`;
            }
        }

        window.renderCalendar = renderCalendar;
        window.changeCalMonth = changeCalMonth;
        window.selectCalDate = selectCalDate;
        window.getHijriDate = getHijriDate;
        window.getPasaranJawa = getPasaranJawa;

        /**
         * Helper universal untuk tombol aksi / simpan seluruh modul:
         * - Menangani state loading (spinner, disabled, cursor, teks)
         * - Mencegah double-click / submit berulang
         * - Menjamin pemulihan state tombol di blok finally
         */
        function setButtonLoading(btnOrId, isLoading, loadingText = "Menyimpan...", defaultText = "") {
            const btn = typeof btnOrId === 'string' ? document.getElementById(btnOrId) : btnOrId;
            if (!btn) return;

            if (isLoading) {
                if (!btn.dataset.originalHtml) {
                    btn.dataset.originalHtml = btn.innerHTML;
                }
                btn.disabled = true;
                btn.classList.add('opacity-75', 'cursor-not-allowed');
                const safeText = (typeof escapeHtml === 'function') ? escapeHtml(loadingText) : loadingText;
                btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1.5"></i><span>${safeText}</span>`;
            } else {
                btn.disabled = false;
                btn.classList.remove('opacity-75', 'cursor-not-allowed');
                if (defaultText) {
                    btn.innerHTML = defaultText;
                } else if (btn.dataset.originalHtml) {
                    btn.innerHTML = btn.dataset.originalHtml;
                }
            }
        }
        window.setButtonLoading = setButtonLoading;

