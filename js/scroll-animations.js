/**
 * PPTQ Roudlotul Mubarokah - Scroll Reveal Animation Engine
 * Menghadirkan efek animasi muncul dari bawah secara halus (smooth fade-up)
 * pada semua komponen saat pengguna menggulir (scroll) ke bawah.
 */
(function initScrollAnimationsEngine() {
    // 1. Guard lingkungan browser & ketersediaan IntersectionObserver
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
        return; // Fallback graceful tanpa animasi jika browser tidak mendukung
    }

    // 2. Aktifkan penanda CSS animasi pada dokumen root
    document.documentElement.classList.add('has-scroll-anim');

    // 3. Konfigurasi IntersectionObserver
    // rootMargin '0px 0px -40px 0px' memicu animasi saat elemen mulai memasuki 40px dari tepi bawah viewport
    const observerOptions = {
        root: null,
        rootMargin: '0px 0px -40px 0px',
        threshold: 0.08
    };

    let revealObserver = null;

    function handleIntersect(entries, observer) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-revealed');
                // Unobserve agar animasi berjalan sekali dan tetap tampil stabil tanpa flickering
                observer.unobserve(entry.target);
            }
        });
    }

    try {
        revealObserver = new IntersectionObserver(handleIntersect, observerOptions);
    } catch (e) {
        console.warn('Scroll reveal observer initialization error:', e);
        document.documentElement.classList.remove('has-scroll-anim');
        return;
    }

    // Selektor komponen otomatis yang wajib mendapatkan animasi muncul dari bawah
    const autoComponentSelectors = [
        // Sesi/Fold Utama Landing Page
        '#legalitas-akreditasi',
        '#sambutan',
        '#profil',
        '#program',
        '#kurikulum',
        '#dewan-guru',
        '#fasilitas',
        '#ramah-santri',
        '#testimoni',
        '#faq',
        '#berita',
        '#beranda-portal-content > section',
        '#beranda-portal-content > footer',
        // Kartu & Grid Blok Internal
        '#legalitas-akreditasi .group',
        '#sambutan .grid > div',
        '#profil .grid > div',
        '#program .program-card-wrap',
        '#program .grid > div',
        '#kurikulum .kurikulum-card-item',
        '#dewan-guru .teacher-marquee-container',
        '#fasilitas .grid > div',
        '#ramah-santri .grid > div',
        '#testimoni-cards-container > div',
        '#faq-items-container .faq-item',
        '#headline-news-container > div',
        '#headline-news-container-app > div'
    ];

    /**
     * Mendaftarkan elemen-elemen ke observer
     */
    function registerElements(root = document) {
        if (!revealObserver) return;

        // A. Daftarkan elemen dengan class eksplisit
        const explicitNodes = root.querySelectorAll('.reveal-on-scroll, .scroll-reveal');
        explicitNodes.forEach(el => {
            if (!el.classList.contains('is-revealed')) {
                revealObserver.observe(el);
            }
        });

        // B. Daftarkan elemen dari daftar komponen otomatis
        autoComponentSelectors.forEach(selector => {
            try {
                const nodes = root.querySelectorAll(selector);
                nodes.forEach(node => {
                    // Kecualikan hero fold pertama agar first paint langsung instan
                    if (node.id === 'hero-section-arrawdhah') return;

                    if (!node.classList.contains('reveal-on-scroll') && !node.classList.contains('scroll-reveal')) {
                        node.classList.add('reveal-on-scroll');

                        // Tambahkan stagger delay halus jika berada di dalam deretan kartu
                        if (node.parentElement && node.parentElement.children.length > 1) {
                            const siblings = Array.from(node.parentElement.children);
                            const idx = siblings.indexOf(node);
                            if (idx >= 0 && idx < 5) {
                                node.classList.add(`reveal-delay-${idx + 1}`);
                            }
                        }
                    }

                    if (!node.classList.contains('is-revealed')) {
                        revealObserver.observe(node);
                    }
                });
            } catch (err) {}
        });

        // C. Periksa elemen yang sudah berada di viewport awal saat halaman dibuka
        const windowHeight = window.innerHeight || document.documentElement.clientHeight;
        const allObserved = root.querySelectorAll('.reveal-on-scroll:not(.is-revealed), .scroll-reveal:not(.is-revealed)');
        allObserved.forEach(el => {
            const rect = el.getBoundingClientRect();
            // Jika elemen sudah masuk viewport (misal di bagian atas halaman yang sedang aktif)
            if (rect.top < windowHeight - 20 && rect.bottom > 0) {
                el.classList.add('is-revealed');
                revealObserver.unobserve(el);
            }
        });
    }

    // Inisialisasi awal saat DOM siap
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => registerElements());
    } else {
        registerElements();
    }

    // Re-check saat semua gambar dan layout selesai termuat
    window.addEventListener('load', () => {
        registerElements();
    });

    // Helper global untuk pemicu manual (misal setelah switch tab SPA atau fetch API dinamis)
    window.refreshScrollAnimations = function(container) {
        setTimeout(() => {
            registerElements(container || document);
        }, 80);
    };

    // Amati pemuatan konten dinamis (misalnya berita atau program yang dirender via JS)
    if (typeof MutationObserver !== 'undefined') {
        const dynamicObserver = new MutationObserver((mutations) => {
            let hasNewNodes = false;
            for (const mutation of mutations) {
                if (mutation.addedNodes.length > 0) {
                    hasNewNodes = true;
                    break;
                }
            }
            if (hasNewNodes) {
                registerElements();
            }
        });

        const observeTarget = document.getElementById('beranda-portal-content') || document.body;
        if (observeTarget) {
            dynamicObserver.observe(observeTarget, { childList: true, subtree: true });
        }
    }
})();
