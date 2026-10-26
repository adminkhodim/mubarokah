/**
 * PPTQ Roudlotul Mubarokah - High-Performance Scroll Reveal Engine
 * Dirancang ringan, cepat, 60 FPS, dan hemat CPU untuk pengalaman mulus (snappy).
 */
(function initScrollAnimationsEngine() {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
        return;
    }

    // Aktifkan styling animasi
    document.documentElement.classList.add('has-scroll-anim');

    // Konfigurasi IntersectionObserver:
    // rootMargin '100px 0px 40px 0px' memicu animasi sebelum elemen terlihat penuh,
    // sehingga saat pengguna scroll, konten SUDAH siap dan transisi terasa instan/halus tanpa jeda.
    const observerOptions = {
        root: null,
        rootMargin: '100px 0px 40px 0px',
        threshold: 0.01
    };

    let revealObserver = null;

    function handleIntersect(entries, observer) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-revealed');
                observer.unobserve(entry.target);
            }
        });
    }

    try {
        revealObserver = new IntersectionObserver(handleIntersect, observerOptions);
    } catch (e) {
        console.warn('Scroll reveal observer error:', e);
        document.documentElement.classList.remove('has-scroll-anim');
        return;
    }

    // Selektor komponen utama untuk animasi bertahap
    const componentSelectors = [
        '.reveal-on-scroll',
        '.scroll-reveal',
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
        '#berita'
    ];

    function registerElements(root = document) {
        if (!revealObserver) return;

        componentSelectors.forEach(selector => {
            try {
                const nodes = root.querySelectorAll(selector);
                nodes.forEach(node => {
                    if (node.id === 'hero-section-arrawdhah') return;

                    if (!node.classList.contains('reveal-on-scroll')) {
                        node.classList.add('reveal-on-scroll');
                    }
                    if (!node.classList.contains('is-revealed')) {
                        revealObserver.observe(node);
                    }
                });
            } catch (err) {}
        });
    }

    // Inisialisasi awal
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => registerElements());
    } else {
        registerElements();
    }

    // Helper global untuk pemicu manual setelah SPA tab switch
    let debounceTimer = null;
    window.refreshScrollAnimations = function(container) {
        if (debounceTimer) cancelAnimationFrame(debounceTimer);
        debounceTimer = requestAnimationFrame(() => {
            registerElements(container || document);
        });
    };
})();
