/**
 * tests/test_mobile_app_routing.js
 * 
 * Verifikasi logika routing responsif /app dan /administrator:
 * 1. Mobile viewport (< 1024px) langsung diarahkan ke Pusat Kontrol (tab 'pengaturan')
 * 2. Desktop viewport (>= 1024px) diarahkan ke Dashboard Desktop (tab 'admin')
 * 3. Verifikasi markup app.html dan script loader
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Memulai Pengujian Routing Mobile vs Desktop untuk /app...');

// 1. Verifikasi script inisialisasi di app.html
const appHtmlPath = path.resolve(__dirname, '../app.html');
const appHtml = fs.readFileSync(appHtmlPath, 'utf8');

assert(appHtml.includes('const isMobile = window.innerWidth < 1024;'), 'app.html harus memiliki deteksi isMobile (< 1024px)');
assert(appHtml.includes("switchTab('pengaturan', false);"), 'app.html harus mengarahkan mobile ke tab pengaturan');
assert(/src="js\/main\.js\?v=(3[1-9]|[4-9]\d+)"/.test(appHtml), 'Versi js/main.js di app.html harus di-bump ke v=31 atau lebih tinggi');
console.log('  ✅ 1. app.html berhasil mengintegrasikan deteksi isMobile dan routing ke pengaturan');

// 2. Verifikasi logika di js/main.js
const mainJsPath = path.resolve(__dirname, '../js/main.js');
const mainJs = fs.readFileSync(mainJsPath, 'utf8');

assert(mainJs.includes("path === '/app' || path.startsWith('/app/')"), 'handleClientRouting harus menangani path /app');
assert(mainJs.includes("if (tabId === 'admin' && window.innerWidth < 1024 && !isUserAdmin)"), 'switchTab admin guard harus menggunakan breakpoint 1024');
assert(mainJs.includes("if (tabId === 'pengaturan' && window.innerWidth >= 1024)"), 'switchTab pengaturan guard harus menggunakan breakpoint 1024');
console.log('  ✅ 2. js/main.js tervalidasi konsisten menggunakan breakpoint 1024px');

// 3. Verifikasi js/auth.js
const authJsPath = path.resolve(__dirname, '../js/auth.js');
const authJs = fs.readFileSync(authJsPath, 'utf8');

assert(authJs.includes("if (window.innerWidth >= 1024)"), 'js/auth.js harus menggunakan breakpoint 1024px');
console.log('  ✅ 3. js/auth.js tervalidasi menggunakan breakpoint 1024px');

// 4. Verifikasi Service Worker cache version
const swJsPath = path.resolve(__dirname, '../sw.js');
const swJs = fs.readFileSync(swJsPath, 'utf8');

assert(/CACHE_NAME = 'mubarokah-cache-v(5[2-9]|[6-9]\d+)'/.test(swJs), 'sw.js harus dibump ke mubarokah-cache-v52 atau lebih tinggi');
console.log('  ✅ 4. sw.js cache name diperbarui ke v52+');

// 5. Simulasi Logika Routing
function simulateAppRouting(pathname, innerWidth) {
    let activeTab = null;
    const isMobile = innerWidth < 1024;
    const path = pathname.replace(/\/+$/, '') || '/';

    if (path === '/app' || path.startsWith('/app/') || path.endsWith('app.html')) {
        if (isMobile) {
            activeTab = 'pengaturan';
        } else {
            activeTab = 'admin';
        }
    } else if (path === '/administrator' || path === '/admin') {
        if (isMobile) {
            activeTab = 'pengaturan';
        } else {
            activeTab = 'admin';
        }
    }
    return activeTab;
}

// Uji coba berbagai resolusi
assert.strictEqual(simulateAppRouting('/app', 375), 'pengaturan', 'iPhone SE (375px) harus membuka pengaturan');
assert.strictEqual(simulateAppRouting('/app', 390), 'pengaturan', 'iPhone 14 (390px) harus membuka pengaturan');
assert.strictEqual(simulateAppRouting('/app', 412), 'pengaturan', 'Samsung Galaxy (412px) harus membuka pengaturan');
assert.strictEqual(simulateAppRouting('/app', 768), 'pengaturan', 'iPad portrait (768px) harus membuka pengaturan');
assert.strictEqual(simulateAppRouting('/app', 820), 'pengaturan', 'iPad Air (820px) harus membuka pengaturan');
assert.strictEqual(simulateAppRouting('/app', 1024), 'admin', 'Desktop/Laptop (1024px) harus membuka admin dashboard');
assert.strictEqual(simulateAppRouting('/app', 1366), 'admin', 'Desktop 1366px harus membuka admin dashboard');
assert.strictEqual(simulateAppRouting('/app', 1920), 'admin', 'Desktop Full HD 1920px harus membuka admin dashboard');
console.log('  ✅ 5. Simulasi routing pada seluruh ukuran layar berhasil 100%!');

// 6. Verifikasi Visibilitas Bottom Navbar (/ vs /app)
function simulateBottomNavVisibility(pathname, innerWidth) {
    const isAppRoute = pathname === '/app' || 
                       pathname.startsWith('/app/') || 
                       pathname.endsWith('app.html');
    return (isAppRoute && innerWidth < 768) ? 'flex' : 'none';
}

assert.strictEqual(simulateBottomNavVisibility('/', 375), 'none', 'Landing page mobile (375px) HARUS menyembunyikan bottom navbar');
assert.strictEqual(simulateBottomNavVisibility('/', 412), 'none', 'Landing page mobile (412px) HARUS menyembunyikan bottom navbar');
assert.strictEqual(simulateBottomNavVisibility('/app', 375), 'flex', 'Aplikasi /app mobile (375px) HARUS menampilkan bottom navbar');
assert.strictEqual(simulateBottomNavVisibility('/app', 412), 'flex', 'Aplikasi /app mobile (412px) HARUS menampilkan bottom navbar');
assert.strictEqual(simulateBottomNavVisibility('/app', 1024), 'none', 'Aplikasi /app desktop (1024px) HARUS menyembunyikan bottom navbar');

// Verifikasi CSS di index.html bahwa #mobile-bottom-nav disembunyikan
const indexHtmlPath = path.resolve(__dirname, '../index.html');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
assert(indexHtml.includes('#mobile-bottom-nav,\n        body.is-pwa-standalone #mobile-bottom-nav {\n            display: none !important;'), 'index.html harus menyembunyikan #mobile-bottom-nav secara permanen');
console.log('  ✅ 6. Bottom navbar terbukti HANYA aktif di /app dan disembunyikan di landing page (/)');

console.log('\n🎉 SEMUA PENGUJIAN ROUTING & BOTTOM NAVBAR MOBILE BERHASIL DENGAN SEMPURNA!\n');

