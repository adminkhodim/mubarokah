/// <reference lib="webworker" />

const CACHE_NAME = 'mubarokah-cache-v59';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/app',
  '/app.html',
  '/admin',
  '/manifest.json',
  '/css/styles.min.css',
  '/js/app-config.js',
  '/js/lazy-loader.js',
  '/js/scroll-animations.js',
  '/data-maulid-dibai.js',
  '/data-qasidah-burdah.js',
  '/data-tahlil-yasin.js',
  '/js/pwa.js',
  '/js/api.js',
  '/js/data-programs.js',
  '/js/programs.js',
  '/js/ppdb.js',
  '/js/ibadah.js',
  '/js/jadwal-sholat.js',
  '/js/admin.js',
  '/js/alumni.js',
  '/js/auth.js',
  '/js/roles.js',
  '/js/pegawai.js',
  '/js/tahfidz.js',
  '/js/izin-asatidz.js',
  '/js/tpq.js',
  '/js/sorogan.js',
  '/js/presensi.js',
  '/js/keuangan.js',
  '/js/madin.js',
  '/js/panduan.js',
  '/js/main.js',
  '/assets/img/splash-logo.png',
  '/assets/img/icon-192.png',
  '/assets/img/icon-512.png',
  '/assets/img/apple-touch-icon.png',
  '/assets/img/header-logo.png',
  '/assets/img/hero-santri.png',
  '/assets/audio/mecca_56_22.mp3',
  '/assets/audio/Adzan-Shubuh-Abu-Hazim.mp3',
  '/assets/audio/adzan_by_mishari_rashid_al-afasy-2.mp3'
];


self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS).catch(err => {
        console.warn('Pre-caching some assets failed:', err);
      });
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName !== CACHE_NAME;
        }).map(cacheName => {
          return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Hanya proses request GET dengan skema http/https (Cache API tidak mendukung non-GET maupun skema non-http seperti chrome-extension://)
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  // Network-first strategy: Ambil dari internet dulu, kalau gagal (offline) baru ambil dari cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Jangan cache respon yang tidak valid (dukung basic dan cors untuk font/icon)
        if (!response || response.status !== 200 || (response.type !== 'basic' && response.type !== 'cors')) {
          return response;
        }

        // Kloning respons karena stream hanya bisa dibaca sekali
        const responseToCache = response.clone();

        caches.open(CACHE_NAME)
          .then(cache => {
            cache.put(event.request, responseToCache);
          });

        return response;
      })
      .catch(() => {
        // Jika offline atau jaringan gagal, cari di cache (ignoreSearch agar query parameter ?v=xx dan ?source=pwa cocok)
        return caches.match(event.request, { ignoreSearch: true }).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.mode === 'navigate') {
            try {
              const reqUrl = new URL(event.request.url);
              const path = reqUrl.pathname.replace(/\/+$/, '') || '/';
              if (path === '/app' || path.startsWith('/app/') || path.endsWith('app.html') || path === '/admin' || path === '/administrator') {
                return caches.match('/app.html') || caches.match('/app') || caches.match('/index.html') || caches.match('/');
              }
            } catch (e) { }
            return caches.match('/index.html') || caches.match('/');
          }
        });
      })
  );
});
