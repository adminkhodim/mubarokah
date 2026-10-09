/**
 * Mubarokah App — Enterprise On-Demand Asset & Library Lazy Loader
 * Memastikan pustaka berat pihak ketiga (SheetJS, Leaflet, Midtrans, Html5Qrcode)
 * hanya diunduh saat fiturnya benar-benar dipanggil oleh pengguna, menghemat
 * payload pembuka Beranda hingga > 1.2 MB.
 */
(function (window) {
    'use strict';

    const loadedScripts = new Set();
    const loadedStyles = new Set();

    function loadScript(src, attributes = {}) {
        if (loadedScripts.has(src) || document.querySelector(`script[src="${src}"]`)) {
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            Object.keys(attributes).forEach((attr) => {
                script.setAttribute(attr, attributes[attr]);
            });
            script.onload = () => {
                loadedScripts.add(src);
                resolve();
            };
            script.onerror = () => {
                reject(new Error(`[LazyLoader] Gagal mengunduh script: ${src}`));
            };
            document.head.appendChild(script);
        });
    }

    function loadStyle(href, attributes = {}) {
        if (loadedStyles.has(href) || document.querySelector(`link[href="${href}"]`)) {
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            Object.keys(attributes).forEach((attr) => {
                link.setAttribute(attr, attributes[attr]);
            });
            link.onload = () => {
                loadedStyles.add(href);
                resolve();
            };
            link.onerror = () => {
                reject(new Error(`[LazyLoader] Gagal mengunduh stylesheet: ${href}`));
            };
            document.head.appendChild(link);
        });
    }

    window.MubarokahLazy = {
        loadScript,
        loadStyle,

        /**
         * SheetJS (Excel .xlsx Export & Read) ~800 KB
         * Hanya diunduh saat pengguna menekan tombol Export Rekap Excel
         */
        ensureXLSX: async function () {
            if (typeof window.XLSX !== 'undefined') return window.XLSX;
            await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
            return window.XLSX;
        },

        /**
         * Leaflet JS & CSS (~180 KB)
         * Hanya diunduh saat halaman peta sebaran alumni atau lokasi dibuka
         */
        ensureLeaflet: async function () {
            if (typeof window.L !== 'undefined') return window.L;
            await Promise.all([
                loadStyle('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', {
                    integrity: 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=',
                    crossorigin: ''
                }),
                loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', {
                    integrity: 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=',
                    crossorigin: ''
                })
            ]);
            return window.L;
        },

        /**
         * Midtrans Snap SDK (~100 KB)
         * Hanya diunduh saat proses checkout pembayaran SPP / PPDB dipicu
         */
        ensureMidtransSnap: async function (clientKey = 'Mid-client-tioY0m0hPoGgF5wE') {
            if (typeof window.snap !== 'undefined' && typeof window.snap.pay === 'function') {
                return window.snap;
            }
            await loadScript('https://app.sandbox.midtrans.com/snap/snap.js', {
                'data-client-key': clientKey
            });
            return window.snap;
        },

        /**
         * Html5Qrcode Scanner (~120 KB)
         * Hanya diunduh saat kamera pemindai QR Presensi diaktifkan
         */
        ensureHtml5Qrcode: async function () {
            if (typeof window.Html5Qrcode !== 'undefined') return window.Html5Qrcode;
            await loadScript('https://unpkg.com/html5-qrcode');
            return window.Html5Qrcode;
        }
    };
})(window);
