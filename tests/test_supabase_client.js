/**
 * ====================================================================
 * UNIT TEST: SUPABASE CLIENT & STRANGLER FIG INTEGRATION
 * ====================================================================
 */

const assert = require('assert');
const SupabaseClient = require('../js/supabase-client.js');

async function runTests() {
    console.log("🧪 Memulai Pengujian Supabase Client Adapter...\n");

    // 1. Uji Inisialisasi dan Konfigurasi
    assert.strictEqual(SupabaseClient.isEnabled(), true, "Supabase harus aktif sesuai konfigurasi");
    const cfg = SupabaseClient.getConfig();
    assert.ok(cfg.url.includes("supabase.co"), "URL Supabase harus valid");
    assert.ok(cfg.anonKey && cfg.anonKey.length > 20, "Anon key Supabase harus ada");
    console.log("  ✅ 1. Inisialisasi & Konfigurasi Supabase Tervalidasi");

    // 2. Uji Helper Format Tanggal Indonesia
    const formatted = SupabaseClient.formatTanggalIndo("2025-09-29T08:00:00+07:00");
    assert.ok(formatted.includes("29") && formatted.includes("September") && formatted.includes("2025"), 
        `Format tanggal harus '29 September 2025', hasil: ${formatted}`);
    console.log("  ✅ 2. Helper Format Tanggal Indonesia Berfungsi Sempurna");

    // 3. Uji Pengambilan & Normalisasi Banner dari Database Live Supabase
    const banners = await SupabaseClient.fetchBanners();
    assert.ok(Array.isArray(banners), "Banner harus berupa Array");
    assert.strictEqual(banners.length, 3, "Harus mengembalikan 3 banner aktif");

    const firstBanner = banners[0];
    assert.ok(firstBanner.nama, "Banner harus memiliki atribut 'nama'");
    assert.ok(firstBanner.gambar, "Banner harus memiliki atribut 'gambar'");
    assert.ok(firstBanner.tipeAksi, "Banner harus memiliki atribut 'tipeAksi'");
    assert.ok(firstBanner.targetAksi, "Banner harus memiliki atribut 'targetAksi'");
    assert.strictEqual(firstBanner.status, "Aktif", "Status banner harus 'Aktif'");
    console.log("  ✅ 3. Query & Normalisasi Banners Supabase Berhasil (3/3 baris)");

    // 4. Uji Pengambilan & Normalisasi Berita dari Database Live Supabase
    const news = await SupabaseClient.fetchNews();
    assert.ok(Array.isArray(news), "Berita harus berupa Array");
    assert.ok(news.length >= 1, "Harus ada minimal 1 artikel berita");

    const firstNews = news[0];
    assert.ok(firstNews.news_id, "Berita harus memiliki atribut 'news_id'");
    assert.ok(firstNews.judul, "Berita harus memiliki atribut 'judul'");
    assert.ok(firstNews.slug, "Berita harus memiliki atribut 'slug'");
    assert.ok(firstNews.kategori, "Berita harus memiliki atribut 'kategori'");
    assert.ok(firstNews.isi, "Berita harus memiliki isi artikel");
    assert.ok(firstNews.tanggal.includes("September 2025"), "Tanggal berita harus terformat bahasa Indonesia");
    console.log("  ✅ 4. Query & Normalisasi Berita Supabase Berhasil (1/1 baris)");

    // 5. Uji Pengambilan Testimoni Alumni
    const testimonials = await SupabaseClient.fetchAlumniTestimonials();
    assert.ok(Array.isArray(testimonials), "Testimoni alumni harus berupa Array");
    console.log("  ✅ 5. Query Testimoni Alumni Berhasil Dieksekusi");

    console.log("\n🎉 SEMUA PENGUJIAN SUPABASE CLIENT BERHASIL 100%!");
}

runTests().catch(err => {
    console.error("\n❌ PENGUJIAN GAGAL:", err);
    process.exit(1);
});
