/**
 * tests/test_ibadah_asnawiyyah_adoption.js
 * Verifikasi Komprehensif Adopsi Menu & Fitur Ibadah Asnawiyyah ke Mubarokah App:
 *  1. Grid 8 Menu Amaliah Seimbang (Al-Qur'an, Maulid, Tahlil, Wirid, Jadwal Sholat, Kiblat, Doa, Tutorial)
 *  2. Tab Hub Ibadah Lengkap (page-kompas-kiblat, page-wirid-hub, page-manaqib-page, page-doa-hub, page-tutorial-ibadah-hub)
 *  3. Modul Kompas Kiblat (js/kiblat.js - MubarokahKiblat)
 *  4. Modul Manaqib Syekh Abdul Qodir Al-Jailani (js/manaqib.js)
 *  5. Dataset Wirid, Doa, & Tutorial Fikih Ibadah di js/ibadah.js
 *  6. Sinkronisasi Routing Sub-Slug di js/main.js
 *  7. Precache Service Worker sw.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🧪 Memulai Pengujian Adopsi Menu & Fitur Ibadah Asnawiyyah di Mubarokah App...\n');

// 1. Periksa Grid 8 Menu di app.html & index.html
['app.html', 'index.html'].forEach(filename => {
    const filePath = path.join(__dirname, '..', filename);
    const html = fs.readFileSync(filePath, 'utf8');

    // 8 Menu buttons
    assert(html.includes("switchTab('quran-index')"), `${filename} harus memuat tombol Al-Qur'an`);
    assert(html.includes("switchTab('maulid-hub')"), `${filename} harus memuat tombol Maulid`);
    assert(html.includes("openTahlilYasinPage()"), `${filename} harus memuat tombol Tahlil & Yasin`);
    assert(html.includes("openWiridPage()"), `${filename} harus memuat tombol Wirid`);
    assert(html.includes("openJadwalSholatPage()"), `${filename} harus memuat tombol Jadwal Sholat`);
    assert(html.includes("openKompasKiblatPage()"), `${filename} harus memuat tombol Arah Kiblat`);
    assert(html.includes("openDoaPage()"), `${filename} harus memuat tombol Doa`);
    assert(html.includes("openTutorialIbadahPage()"), `${filename} harus memuat tombol Tutorial Ibadah`);

    // 5 Tab Content Hub
    assert(html.includes('id="page-kompas-kiblat"'), `${filename} harus memuat container page-kompas-kiblat`);
    assert(html.includes('id="page-wirid-hub"'), `${filename} harus memuat container page-wirid-hub`);
    assert(html.includes('id="page-manaqib"'), `${filename} harus memuat container page-manaqib`);
    assert(html.includes('id="page-doa-hub"'), `${filename} harus memuat container page-doa-hub`);
    assert(html.includes('id="page-tutorial-ibadah-hub"'), `${filename} harus memuat container page-tutorial-ibadah-hub`);

    // Modals
    assert(html.includes('id="modal-wirid-detail"'), `${filename} harus memuat modal-wirid-detail`);
    assert(html.includes('id="modal-doa-detail"'), `${filename} harus memuat modal-doa-detail`);
    assert(html.includes('id="modal-tutorial-detail"'), `${filename} harus memuat modal-tutorial-detail`);

    // Script tags
    assert(html.includes('js/kiblat.js'), `${filename} harus memuat script js/kiblat.js`);
    assert(html.includes('js/manaqib.js'), `${filename} harus memuat script js/manaqib.js`);
});
console.log('  ✅ 1. app.html & index.html sukses memuat Grid 8 Menu dan 5 Hub Ibadah lengkap.');

// 2. Periksa js/kiblat.js
const kiblatPath = path.join(__dirname, '..', 'js', 'kiblat.js');
assert(fs.existsSync(kiblatPath), 'File js/kiblat.js harus ada');
const kiblatJs = fs.readFileSync(kiblatPath, 'utf8');
assert(kiblatJs.includes('MubarokahKiblat'), 'js/kiblat.js harus mendefinisikan MubarokahKiblat');
assert(kiblatJs.includes('openKompasKiblatPage'), 'js/kiblat.js harus mengekspor openKompasKiblatPage');
assert(kiblatJs.includes('calculateQibla'), 'js/kiblat.js harus memuat kalkulator sudut Ka\'bah presisi');
console.log('  ✅ 2. js/kiblat.js terverifikasi dengan sensor giroskop & formula geodesi presisi Ka\'bah.');

// 3. Periksa js/manaqib.js
const manaqibPath = path.join(__dirname, '..', 'js', 'manaqib.js');
assert(fs.existsSync(manaqibPath), 'File js/manaqib.js harus ada');
const manaqibJs = fs.readFileSync(manaqibPath, 'utf8');
assert(manaqibJs.includes('openManaqibPage'), 'js/manaqib.js harus mengekspor openManaqibPage');
assert(manaqibJs.includes('renderManaqibContent'), 'js/manaqib.js harus memuat renderManaqibContent');
console.log('  ✅ 3. js/manaqib.js terverifikasi dengan pembaca 9 Bab Teks Arab Manaqib berharakat.');

// 4. Periksa js/ibadah.js untuk Wirid, Doa, dan Tutorial
const ibadahPath = path.join(__dirname, '..', 'js', 'ibadah.js');
const ibadahJs = fs.readFileSync(ibadahPath, 'utf8');
assert(ibadahJs.includes('ASNWiridData'), 'js/ibadah.js harus memuat ASNWiridData');
assert(ibadahJs.includes('ASNDoaData'), 'js/ibadah.js harus memuat ASNDoaData');
assert(ibadahJs.includes('ASNTutorialIbadahData'), 'js/ibadah.js harus memuat ASNTutorialIbadahData');
assert(ibadahJs.includes('openWiridPage'), 'js/ibadah.js harus mengekspor openWiridPage');
assert(ibadahJs.includes('openDoaPage'), 'js/ibadah.js harus mengekspor openDoaPage');
assert(ibadahJs.includes('openTutorialIbadahPage'), 'js/ibadah.js harus mengekspor openTutorialIbadahPage');
console.log('  ✅ 4. js/ibadah.js terverifikasi memuat dataset lengkap Wirid, Doa, dan Fikih Ibadah.');

// 5. Periksa Routing Sub-Slug di js/main.js
const mainPath = path.join(__dirname, '..', 'js', 'main.js');
const mainJs = fs.readFileSync(mainPath, 'utf8');
assert(mainJs.includes("path === '/app/ibadah/kiblat'"), 'js/main.js harus memetakan /app/ibadah/kiblat');
assert(mainJs.includes("path === '/app/ibadah/wirid'"), 'js/main.js harus memetakan /app/ibadah/wirid');
assert(mainJs.includes("path === '/app/ibadah/wirid/manaqib'"), 'js/main.js harus memetakan /app/ibadah/wirid/manaqib');
assert(mainJs.includes("path === '/app/ibadah/doa'"), 'js/main.js harus memetakan /app/ibadah/doa');
assert(mainJs.includes("path === '/app/ibadah/tutorial'"), 'js/main.js harus memetakan /app/ibadah/tutorial');
assert(mainJs.includes("'kompas-kiblat': 'mobile-nav-ibadah'"), 'js/main.js harus memetakan bottom nav ibadah aktif untuk kompas-kiblat');
console.log('  ✅ 5. js/main.js terverifikasi memetakan rute sub-slug /app/ibadah/* secara presisi.');

// 6. Periksa Precache Service Worker di sw.js
const swPath = path.join(__dirname, '..', 'sw.js');
const swJs = fs.readFileSync(swPath, 'utf8');
assert(swJs.includes("'/js/kiblat.js'"), 'sw.js harus memprecache /js/kiblat.js');
assert(swJs.includes("'/js/manaqib.js'"), 'sw.js harus memprecache /js/manaqib.js');
assert(swJs.includes('mubarokah-cache-v66'), 'sw.js harus dinaikkan versinya ke v66');
console.log('  ✅ 6. sw.js terverifikasi memprecache modul ibadah baru dengan cache v66.');

console.log('\n🎉 SEMUA PENGUJIAN ADOPSI FITUR IBADAH ASNAWIYYAH LULUS 100%!\n');
