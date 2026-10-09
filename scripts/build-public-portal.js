const fs = require('fs');

const raw = fs.readFileSync('app.html', 'utf8');
const lines = raw.split('\n');

// 1. Part 1: Lines 1 - 5449 (0 to 5449 exclusive)
const part1 = lines.slice(0, 5449);

// 2. Part 2: Lines 12138 - 12473 (12137 to 12473 exclusive)
const part2 = lines.slice(12137, 12473);

// 3. Part 3: Lines 12474 - 12517 (12473 to 12517 exclusive)
const part3 = lines.slice(12473, 12517);

// 4. Public Modals:
// Modal Layanan & Warta: Lines 14226 - 14289 (14225 to 14289 exclusive)
const modalLayananWarta = lines.slice(14225, 14289);

// Modal Program Preview, Toast, Poster Beranda, Detail Notif: Lines 19738 - 19861 (19737 to 19861 exclusive)
const modalProgramNotif = lines.slice(19737, 19861);

// PWA Install Banner & iOS Modal: Lines 19918 - 20053 (19917 to 20053 exclusive)
const modalPwaIos = lines.slice(19917, 20053);

// Lightbox Galeri: Lines 20473 - 20496 (20472 to 20496 exclusive)
const modalLightbox = lines.slice(20472, 20496);

// Public Scripts:
const publicScripts = [
  '    <!-- ==================== APPLICATION SCRIPTS & MODULES ==================== -->',
  '    <!-- Service Worker PWA -->',
  '    <script>',
  '        if (\'serviceWorker\' in navigator) {',
  '            window.addEventListener(\'load\', () => {',
  '                navigator.serviceWorker.register(\'/sw.js?v=40\').then(registration => {',
  '                    if (typeof registration.update === \'function\') {',
  '                        registration.update();',
  '                    }',
  '                    console.log(\'ServiceWorker PWA berhasil didaftarkan dengan scope:\', registration.scope);',
  '                }).catch(err => {',
  '                    console.log(\'ServiceWorker pendaftaran gagal:\', err);',
  '                });',
  '            });',
  '        }',
  '    </script>',
  '',
  '    <!-- PWA Smart Install Controller -->',
  '    <script src="/js/pwa.js"></script>',
  '',
  '    <!-- Data & API Core -->',
  '    <script src="/data-maulid-dibai.js"></script>',
  '    <script src="/data-qasidah-burdah.js"></script>',
  '    <script src="/data-tahlil-yasin.js"></script>',
  '    <script src="/js/api.js?v=2"></script>',
  '    <script src="/js/data-programs.js"></script>',
  '',
  '    <!-- Public Logic Modules -->',
  '    <script src="/js/programs.js"></script>',
  '    <script src="/js/ppdb.js"></script>',
  '    <script src="/js/ibadah.js"></script>',
  '    <script src="/js/jadwal-sholat.js"></script>',
  '    <script src="/js/alumni.js"></script>',
  '    <script src="/js/panduan.js?v=1"></script>',
  '',
  '    <!-- Main Controller & Navigation -->',
  '    <script src="/js/main.js?v=21"></script>',
  '</body>',
  '',
  '</html>'
];

let assembledLines = [
  ...part1,
  ...part2,
  ...part3,
  ...modalLayananWarta,
  ...modalProgramNotif,
  ...modalPwaIos,
  ...modalLightbox,
  ...publicScripts
];

let content = assembledLines.join('\n');

// Sekarang sisipkan tombol SIMTren ke Desktop Header jika belum ada
if (!content.includes('SIMTren App') && !content.includes('href="/app"')) {
  // Tambahkan di desk-action-menu
  const deskActionTarget = '<div id="desk-action-menu" class="flex items-center space-x-2.5">';
  const deskButton = `<div id="desk-action-menu" class="flex items-center space-x-2.5">
                    <!-- Tombol Masuk SIMTren App -->
                    <a href="/app"
                        class="bg-emerald-600/95 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl font-bold text-xs shadow-md transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 flex items-center space-x-1.5 border border-emerald-400/30"
                        title="Masuk ke Sistem Informasi Manajemen Pesantren (SIMTren)">
                        <i class="fa-solid fa-graduation-cap text-xs"></i>
                        <span>SIMTren App</span>
                    </a>`;
  content = content.replace(deskActionTarget, deskButton);

  // Tambahkan juga di drawer mobile
  const mobDrawerTarget = `<button onclick="switchTab('ppdb'); closeMobileMenu();"
                    class="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-brand-dark font-extrabold text-xs shadow flex items-center justify-center space-x-2">
                    <i class="fa-solid fa-user-plus"></i>
                    <span>Daftar PPDB Online</span>
                </button>`;
  const mobDrawerButtons = `<button onclick="switchTab('ppdb'); closeMobileMenu();"
                    class="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-brand-dark font-extrabold text-xs shadow flex items-center justify-center space-x-2">
                    <i class="fa-solid fa-user-plus"></i>
                    <span>Daftar PPDB Online</span>
                </button>
                <a href="/app"
                    class="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold text-xs shadow flex items-center justify-center space-x-2 border border-emerald-500/30 transition active:scale-95">
                    <i class="fa-solid fa-graduation-cap"></i>
                    <span>Masuk SIMTren / Khodim App</span>
                </a>`;
  content = content.replace(mobDrawerTarget, mobDrawerButtons);
}

fs.writeFileSync('index.html', content, 'utf8');

const finalStat = fs.statSync('index.html');
console.log('index.html successfully updated!');
console.log('New line count:', content.split('\n').length);
console.log('New byte size:', finalStat.size, 'bytes (~', (finalStat.size / 1024).toFixed(2), 'KB)');
