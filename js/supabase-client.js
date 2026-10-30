/**
 * ====================================================================
 * SUPABASE CLIENT ADAPTER - STRANGLER FIG DATA MODERNIZATION
 * ====================================================================
 * High-performance, dependency-free adapter using native browser Fetch
 * to communicate directly with Supabase PostgreSQL (PostgREST API).
 * 
 * Multi-Tenant Architecture ready for KHODIM EDU.
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        // Node / CommonJS (testing environment)
        module.exports = factory(require('./app-config.js'));
    } else {
        // Browser Global
        root.MubarokahSupabase = factory(root.APP_CONFIG);
    }
})(typeof self !== 'undefined' ? self : this, function (config) {
    'use strict';

    // Ambil konfigurasi Supabase dari APP_CONFIG
    const sbConfig = (config && config.supabase) ? config.supabase : {
        enabled: true,
        url: "https://qyurpxbawyjijoqpijnw.supabase.co",
        anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5dXJweGJhd3lqaWpvcXBpam53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyOTg3NjMsImV4cCI6MjEwODg3NDc2M30.lEUT2SWaOCVo0__dh5eVwcNirimV57LO9dxJVeAQKdM",
        defaultTenantSlug: "mubarokah"
    };

    /**
     * Memeriksa apakah integrasi Supabase aktif dan terkonfigurasi
     */
    function isEnabled() {
        return Boolean(sbConfig.enabled && sbConfig.url && sbConfig.anonKey);
    }

    /**
     * Helper request internal ke REST API PostgREST Supabase
     */
    async function request(endpoint, options = {}) {
        if (!isEnabled()) {
            throw new Error("[MubarokahSupabase] Layanan Supabase belum aktif atau belum dikonfigurasi.");
        }

        const url = new URL(endpoint, sbConfig.url);
        const headers = {
            'apikey': sbConfig.anonKey,
            'Authorization': 'Bearer ' + sbConfig.anonKey,
            'Accept': 'application/json',
            ...(options.headers || {})
        };

        if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(options.body);
        }

        const response = await fetch(url.toString(), {
            ...options,
            headers
        });

        if (!response.ok) {
            const errBody = await response.text().catch(() => '');
            throw new Error(`[MubarokahSupabase] HTTP ${response.status}: ${errBody}`);
        }

        const text = await response.text();
        return text ? JSON.parse(text) : null;
    }

    /**
     * Helper memformat tanggal ISO ke format Indonesia yang rapi
     * Contoh: "2025-09-29T01:00:00Z" -> "29 September 2025"
     */
    function formatTanggalIndo(dateStr) {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return String(dateStr);

            const bulan = [
                'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
            ];

            const day = date.getDate();
            const month = bulan[date.getMonth()];
            const year = date.getFullYear();

            return `${day} ${month} ${year}`;
        } catch (e) {
            return String(dateStr);
        }
    }

    /**
     * Mengambil daftar banner beranda aktif dari Supabase
     * Memetakan skema database ke struktur UI yang diharapkan slider Mubarokah App
     */
    async function fetchBanners() {
        try {
            const rows = await request('/rest/v1/banners?select=*&is_active=eq.true&order=display_order.asc');
            if (!Array.isArray(rows)) return [];

            return rows.map(b => ({
                id: b.id,
                nama: b.title,
                gambar: b.image_url,
                tipeAksi: (b.link_url && (b.link_url.startsWith('http://') || b.link_url.startsWith('https://'))) ? 'url' : 'tab',
                targetAksi: b.link_url ? b.link_url.replace(/^\//, '') : 'beranda',
                urutan: Number(b.display_order) || 0,
                status: b.is_active ? 'Aktif' : 'Nonaktif',
                badge: b.badge_text || ''
            }));
        } catch (error) {
            console.warn('[MubarokahSupabase] Gagal mengambil banner:', error);
            throw error;
        }
    }

    /**
     * Mengambil daftar warta berita yang diterbitkan dari Supabase
     * Memetakan skema database ke struktur UI berita Mubarokah App
     */
    async function fetchNews() {
        try {
            const rows = await request('/rest/v1/news_articles?select=*&is_published=eq.true&order=published_at.desc');
            if (!Array.isArray(rows)) return [];

            return rows.map(n => ({
                news_id: n.id,
                id: n.id,
                slug: n.slug,
                judul: n.title,
                kategori: n.category || 'Kegiatan',
                penulis: n.author || 'Tim Redaksi',
                gambar: n.cover_image || '',
                ringkasan: n.summary || '',
                isi: n.content || '',
                tanggal: formatTanggalIndo(n.published_at),
                views: Number(n.views_count) || 0
            }));
        } catch (error) {
            console.warn('[MubarokahSupabase] Gagal mengambil berita:', error);
            throw error;
        }
    }

    /**
     * Mengambil testimoni alumni yang mengizinkan publikasi
     */
    async function fetchAlumniTestimonials() {
        try {
            const rows = await request('/rest/v1/alumni_records?select=*&izin_publikasi=eq.true&order=created_at.desc&limit=12');
            if (!Array.isArray(rows)) return [];

            return rows.map(item => ({
                nama: item.nama || '',
                foto: item.foto_url || '',
                instansi: item.instansi || '',
                kesibukan: item.kesibukan || '',
                tahunMasuk: item.tahun_masuk || '',
                tahunLulus: item.tahun_lulus || '',
                kesan: item.kesan_pesan || ''
            }));
        } catch (error) {
            console.warn('[MubarokahSupabase] Gagal mengambil testimoni alumni:', error);
            throw error;
        }
    }

    /**
     * Mendaftarkan formulir alumni baru ke database
     */
    async function submitAlumni(payload) {
        try {
            // Ambil id tenant default mubarokah jika ada
            const tenants = await request(`/rest/v1/tenants?slug=eq.${encodeURIComponent(sbConfig.defaultTenantSlug)}&select=id`);
            const tenantId = (Array.isArray(tenants) && tenants.length > 0) ? tenants[0].id : null;

            const record = {
                tenant_id: tenantId,
                nama: payload.nama,
                jenis_kelamin: payload.jk || payload.jenis_kelamin,
                wa: payload.wa,
                medsos: payload.medsos,
                tahun_masuk: String(payload.masuk || payload.tahun_masuk || ''),
                tahun_lulus: String(payload.lulus || payload.tahun_lulus || ''),
                program_terakhir: payload.program || payload.program_terakhir,
                kesibukan: payload.kesibukan,
                instansi: payload.instansi,
                kesan_pesan: payload.kesan || payload.kesan_pesan,
                provinsi: payload.provinsi,
                kabupaten: payload.kabupaten,
                kecamatan: payload.kecamatan,
                desa: payload.desa,
                alamat: payload.alamat,
                latitude: payload.lat ? Number(payload.lat) : null,
                longitude: payload.lng ? Number(payload.lng) : null,
                izin_publikasi: (payload.izin === 'Ya' || payload.izin === true),
                foto_url: payload.foto_url || ''
            };

            const inserted = await request('/rest/v1/alumni_records', {
                method: 'POST',
                headers: {
                    'Prefer': 'return=representation'
                },
                body: record
            });

            return { success: true, data: inserted };
        } catch (error) {
            console.error('[MubarokahSupabase] Gagal mendaftarkan alumni:', error);
            return { success: false, error: { message: error.message } };
        }
    }

    return Object.freeze({
        isEnabled,
        fetchBanners,
        fetchNews,
        fetchAlumniTestimonials,
        submitAlumni,
        formatTanggalIndo,
        getConfig: () => Object.assign({}, sbConfig)
    });
});
