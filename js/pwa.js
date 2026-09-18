/**
 * PWA Controller
 * Progressive Web App installation, service worker lifecycle, and update management
 */

(function () {
    'use strict';

    // Global reference
    window.deferredPwaPrompt = null;

    /**
     * Memeriksa apakah aplikasi sedang berjalan dalam mode standalone (sudah terinstal)
     */
    function isRunningStandalone() {
        return (
            window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone === true ||
            document.referrer.includes('android-app://')
        );
    }

    /**
     * Deteksi apakah pengguna menggunakan perangkat Apple iOS (iPhone/iPad/iPod)
     */
    function isIosDevice() {
        const ua = window.navigator.userAgent.toLowerCase();
        return /iphone|ipad|ipod/.test(ua);
    }

    /**
     * Deteksi apakah pengguna menggunakan perangkat Mobile (Android / iOS / Small Touch Screen)
     */
    function isMobileDevice() {
        const ua = (window.navigator.userAgent || window.navigator.vendor || window.opera).toLowerCase();
        const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
        const isTouchScreen = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        const isSmallScreen = window.innerWidth < 768;
        return isMobileUA || (isTouchScreen && isSmallScreen);
    }

    const PWA_DISMISSED_KEY = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.storage && APP_CONFIG.storage.keys)
        ? APP_CONFIG.storage.keys.pwaDismissed
        : 'mubarokah_pwa_dismissed';

    /**
     * Cek apakah banner install baru saja ditutup dalam periode tertentu (default 7 hari)
     */
    function isBannerDismissed() {
        try {
            const dismissedAt = localStorage.getItem(PWA_DISMISSED_KEY);
            if (!dismissedAt) return false;
            const diffDays = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24);
            return diffDays < 7; // Ditutup kurang dari 7 hari yang lalu
        } catch (e) {
            return false;
        }
    }

    /**
     * Memperbarui tampilan tombol Pasang Aplikasi di navigasi Header (HANYA Mobile)
     */
    function updateNavInstallButtons(show) {
        // Tombol desktop dinonaktifkan permanen
        const deskBtn = document.getElementById('desk-btn-install-app');
        if (deskBtn) {
            deskBtn.classList.add('hidden');
            deskBtn.classList.remove('flex');
        }

        const mobileBtn = document.getElementById('mobile-btn-install-app');
        if (mobileBtn) {
            if (show && isMobileDevice()) {
                mobileBtn.classList.remove('hidden');
                mobileBtn.classList.add('flex');
            } else {
                mobileBtn.classList.add('hidden');
                mobileBtn.classList.remove('flex');
            }
        }
    }

    /**
     * Menampilkan Smart Floating Install Banner (HANYA Mobile Android & iOS)
     */
    function showFloatingInstallBanner() {
        if (!isMobileDevice() || isRunningStandalone() || isBannerDismissed()) {
            return;
        }

        const banner = document.getElementById('pwa-smart-install-banner');
        if (!banner) return;

        banner.classList.remove('hidden');
        // Trigger animasi slide up
        setTimeout(() => {
            banner.classList.remove('translate-y-full', 'opacity-0');
            banner.classList.add('translate-y-0', 'opacity-100');
        }, 120);
    }

    /**
     * Menutup Smart Floating Install Banner
     */
    window.dismissPwaBanner = function (remember) {
        const banner = document.getElementById('pwa-smart-install-banner');
        if (banner) {
            banner.classList.remove('translate-y-0', 'opacity-100');
            banner.classList.add('translate-y-full', 'opacity-0');
            setTimeout(() => {
                banner.classList.add('hidden');
            }, 300);
        }

        if (remember) {
            try {
                localStorage.setItem(PWA_DISMISSED_KEY, Date.now().toString());
            } catch (e) {}
        }
    };

    /**
     * Membuka Modal Panduan Instalasi Khusus iPhone (iOS Safari)
     */
    window.openIosInstallGuideModal = function () {
        const modal = document.getElementById('modal-ios-install-guide');
        const content = document.getElementById('modal-ios-install-content');
        if (!modal) return;

        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            modal.classList.add('opacity-100');
            if (content) {
                content.classList.remove('scale-95', 'opacity-0');
                content.classList.add('scale-100', 'opacity-100');
            }
        }, 20);
    };

    /**
     * Menutup Modal Panduan Instalasi Khusus iPhone
     */
    window.closeIosInstallGuideModal = function () {
        const modal = document.getElementById('modal-ios-install-guide');
        const content = document.getElementById('modal-ios-install-content');
        if (!modal) return;

        if (content) {
            content.classList.remove('scale-100', 'opacity-100');
            content.classList.add('scale-95', 'opacity-0');
        }
        modal.classList.remove('opacity-100');
        modal.classList.add('opacity-0');

        setTimeout(() => {
            modal.classList.add('hidden');
        }, 250);
    };

    /**
     * Trigger Utama Instalasi Aplikasi (Bisa dipanggil dari tombol mana pun)
     */
    window.triggerInstallApp = async function () {
        // 1. Jika pengguna di perangkat iOS (iPhone / iPad)
        if (isIosDevice()) {
            window.dismissPwaBanner(false);
            window.openIosInstallGuideModal();
            return;
        }

        // 2. Jika prompt instalasi bawaan browser (Android Chrome / Edge / Desktop) tersedia
        if (window.deferredPwaPrompt) {
            try {
                window.deferredPwaPrompt.prompt();
                const choiceResult = await window.deferredPwaPrompt.userChoice;
                if (choiceResult.outcome === 'accepted') {
                    console.log('Pengguna menyetujui pemasangan PWA');
                    window.dismissPwaBanner(true);
                } else {
                    console.log('Pengguna membatalkan pemasangan PWA');
                }
                window.deferredPwaPrompt = null;
            } catch (err) {
                console.warn('Gagal memicu prompt instalasi:', err);
            }
            return;
        }

        // 3. Fallback jika dibuka dari browser Android/Desktop lain tanpa prompt otomatis
        if (typeof showCustomToast === 'function') {
            showCustomToast(
                'Untuk memasang aplikasi, buka menu browser (titik 3 di kanan atas) lalu pilih "Instal Aplikasi" atau "Tambahkan ke Layar Utama".',
                'info'
            );
        } else {
            alert('Untuk memasang aplikasi: buka menu browser (titik 3) lalu pilih "Instal Aplikasi" atau "Tambahkan ke Layar Utama".');
        }
    };

    // ==========================================
    // Event Listeners Lifecycle PWA
    // ==========================================

    // Tangkap event sebelum prompt instalasi muncul (Hanya tampilkan UI pada Mobile)
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        window.deferredPwaPrompt = e;

        if (!isRunningStandalone() && isMobileDevice()) {
            updateNavInstallButtons(true);
            showFloatingInstallBanner();
        } else {
            updateNavInstallButtons(false);
        }
    });

    // Ketika aplikasi berhasil dipasang
    window.addEventListener('appinstalled', () => {
        window.deferredPwaPrompt = null;
        updateNavInstallButtons(false);
        window.dismissPwaBanner(true);

        if (typeof showCustomToast === 'function') {
            showCustomToast('Alhamdulillah, aplikasi berhasil dipasang di perangkat Anda!', 'success');
        }
        console.log('Aplikasi berhasil dipasang sebagai PWA.');
    });

    // Inisialisasi saat DOM siap
    function initPwa() {
        // Jika bukan mobile atau sudah standalone, sembunyikan semua UI instalasi
        if (isRunningStandalone() || !isMobileDevice()) {
            updateNavInstallButtons(false);
            const banner = document.getElementById('pwa-smart-install-banner');
            if (banner) banner.classList.add('hidden');
            return;
        }

        // Jika di mobile iOS dan belum standalone, tampilkan tombol Pasang di mobile header & banner
        if (isIosDevice()) {
            updateNavInstallButtons(true);
            showFloatingInstallBanner();
        }
    }

    // Dengarkan perubahan ukuran layar (Resize)
    window.addEventListener('resize', () => {
        if (!isMobileDevice()) {
            updateNavInstallButtons(false);
            const banner = document.getElementById('pwa-smart-install-banner');
            if (banner) banner.classList.add('hidden');
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPwa);
    } else {
        initPwa();
    }

})();

