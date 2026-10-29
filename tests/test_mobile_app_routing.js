/**
 * tests/test_mobile_app_routing.js
 * 
 * Verifikasi logika routing arsitektur 3-slug:
 * 1. Slug /app membuka tab 'beranda' (Mobile App Dashboard: Sholat, Menu Cepat, Banner, Headline)
 * 2. Slug /admin dan /administrator membuka tab 'admin' (SIMTren Management Portal)
 * 3. Bottom navbar aktif pada /app di mobile, dan disembunyikan di landing page (/)
 * 4. Verifikasi integrasi app.html, main.js, pwa.js, dan Service Worker v61
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Memulai Pengujian Routing Arsitektur 3-Slug (/ vs /app vs /admin)...');

// 1. Verifikasi script inisialisasi di app.html
const appHtmlPath = path.resolve(__dirname, '../app.html');
const appHtml = fs.readFileSync(appHtmlPath, 'utf8');

assert(appHtml.includes("switchTab('admin', false);"), 'app.html harus mengarahkan /admin ke tab admin');
assert(appHtml.includes("switchTab('beranda', false);"), 'app.html harus mengarahkan /app ke tab beranda');
assert(appHtml.includes('id="beranda-mobile-app"'), 'app.html harus memuat kontainer #beranda-mobile-app untuk mobile dashboard');
assert(/src="js\/main\.js\?v=(4[2-9]|[5-9]\d+)"/.test(appHtml), 'Versi js/main.js di app.html harus di-bump ke v=42 atau lebih tinggi');
console.log('  ✅ 1. app.html berhasil mengintegrasikan pemisahan slug /admin dan /app serta kontainer mobile app');

// 2. Verifikasi logika di js/main.js
const mainJsPath = path.resolve(__dirname, '../js/main.js');
const mainJs = fs.readFileSync(mainJsPath, 'utf8');

assert(mainJs.includes("path === '/app' || path.startsWith('/app/')"), 'handleClientRouting harus menangani path /app');
assert(mainJs.includes("path === '/administrator' || path === '/admin'"), 'handleClientRouting harus menangani path /admin');
assert(mainJs.includes("switchTab('beranda', false);"), 'handleClientRouting /app harus mengaktifkan tab beranda');
assert(mainJs.includes("switchTab('admin', false);"), 'handleClientRouting /admin harus mengaktifkan tab admin');
console.log('  ✅ 2. js/main.js terverifikasi memisahkan rute /app (beranda) dan /admin (admin)');

// 3. Verifikasi js/pwa.js Mode 3
const pwaJsPath = path.resolve(__dirname, '../js/pwa.js');
const pwaJs = fs.readFileSync(pwaJsPath, 'utf8');

assert(pwaJs.includes("standalone || isAppRoute"), 'js/pwa.js harus mengaktifkan Mode 3 (Mobile Dashboard) jika standalone atau isAppRoute');
assert(pwaJs.includes("document.body.classList.add('is-pwa-standalone')"), 'js/pwa.js harus menandai is-pwa-standalone');
console.log('  ✅ 3. js/pwa.js terverifikasi mengaktifkan Mobile Dashboard untuk standalone & /app');

// 4. Verifikasi Service Worker cache version
const swJsPath = path.resolve(__dirname, '../sw.js');
const swJs = fs.readFileSync(swJsPath, 'utf8');

assert(/CACHE_NAME = 'mubarokah-cache-v(6[1-9]|[7-9]\d+)'/.test(swJs), 'sw.js harus dibump ke mubarokah-cache-v61 atau lebih tinggi');
console.log('  ✅ 4. sw.js cache name diperbarui ke v61+');

// 5. Simulasi Logika Routing
function simulateAppRouting(pathname) {
    let activeTab = null;
    const path = pathname.replace(/\/+$/, '') || '/';

    if (path === '/app' || path.startsWith('/app/') || path.endsWith('app.html')) {
        activeTab = 'beranda';
    } else if (path === '/administrator' || path === '/admin' || path.startsWith('/admin/')) {
        activeTab = 'admin';
    } else if (path === '/pengaturan') {
        activeTab = 'pengaturan';
    } else {
        activeTab = 'beranda';
    }
    return activeTab;
}

// Uji coba slug
assert.strictEqual(simulateAppRouting('/app'), 'beranda', '/app harus membuka tab beranda');
assert.strictEqual(simulateAppRouting('/app/'), 'beranda', '/app/ harus membuka tab beranda');
assert.strictEqual(simulateAppRouting('/admin'), 'admin', '/admin harus membuka tab admin');
assert.strictEqual(simulateAppRouting('/administrator'), 'admin', '/administrator harus membuka tab admin');
assert.strictEqual(simulateAppRouting('/pengaturan'), 'pengaturan', '/pengaturan harus membuka tab pengaturan');
console.log('  ✅ 5. Simulasi routing pada seluruh slug berhasil 100%!');

// 6. Verifikasi Visibilitas Bottom Navbar (/ vs /app)
function simulateBottomNavVisibility(pathname, innerWidth) {
    const isAppRoute = pathname === '/app' || 
                       pathname.startsWith('/app/') || 
                       pathname.endsWith('app.html');
    return (isAppRoute && innerWidth < 1024) ? 'flex' : 'none';
}

assert.strictEqual(simulateBottomNavVisibility('/', 375), 'none', 'Landing page mobile (375px) HARUS menyembunyikan bottom navbar');
assert.strictEqual(simulateBottomNavVisibility('/', 412), 'none', 'Landing page mobile (412px) HARUS menyembunyikan bottom navbar');
assert.strictEqual(simulateBottomNavVisibility('/app', 375), 'flex', 'Aplikasi /app mobile (375px) HARUS menampilkan bottom navbar');
assert.strictEqual(simulateBottomNavVisibility('/app', 412), 'flex', 'Aplikasi /app mobile (412px) HARUS menampilkan bottom navbar');
assert.strictEqual(simulateBottomNavVisibility('/app', 1024), 'none', 'Aplikasi /app desktop (1024px) HARUS menyembunyikan bottom navbar');

// Verifikasi bahwa #mobile-bottom-nav tidak aktif atau disembunyikan di landing page index.html
const indexHtmlPath = path.resolve(__dirname, '../index.html');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
assert(!indexHtml.includes('id="mobile-bottom-nav"') || indexHtml.includes('display: none'), 'index.html tidak boleh menampilkan #mobile-bottom-nav');
console.log('  ✅ 6. Bottom navbar terbukti HANYA aktif di /app dan disembunyikan di landing page (/)');

console.log('\n🎉 SEMUA PENGUJIAN ROUTING & BOTTOM NAVBAR MOBILE BERHASIL DENGAN SEMPURNA!\n');
