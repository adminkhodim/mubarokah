        // ==================== MOBILE SPLASH LOGIC ====================
        let isSplashDismissed = false;
        function initMobileSplash() {
            if (isSplashDismissed) return;
            const splashScreen = document.getElementById('mobile-splash-screen');
            const logoContainer = document.getElementById('mobile-splash-logo-container');
            if (!splashScreen) return;

            // Jika desktop (layar >= 768px), langsung sembunyikan splash agar tidak blocking
            if (window.innerWidth >= 768) {
                isSplashDismissed = true;
                splashScreen.style.display = 'none';
                return;
            }

            // Tampilkan animasi logo
            if (logoContainer) {
                setTimeout(() => {
                    logoContainer.classList.remove('scale-110', 'opacity-0');
                    logoContainer.classList.add('scale-100', 'opacity-100');
                }, 50);
            }

            // Hilangkan perlahan dan matikan pointer events (800ms)
            setTimeout(() => {
                splashScreen.classList.add('opacity-0', 'pointer-events-none');
            }, 800);

            // Sembunyikan total dari layout (1500ms)
            setTimeout(() => {
                isSplashDismissed = true;
                splashScreen.style.display = 'none';
            }, 1500);
        }

        // ==================== DROPDOWN & MOBILE NAV CONTROLLERS ====================
        // Desktop dropdown menggunakan pure CSS group-hover & group-focus-within (seperti ASNawiyyah).
        // Fungsi compatibility no-op dipertahankan untuk keamanan panggilan residual.
        function toggleDeskDropdown() {}
        function closeAllDropdowns() {}

        function toggleMobileMenu() {
            const drawer = document.getElementById('mobile-nav-drawer');
            const icon = document.getElementById('mobile-hamburger-icon');
            if (!drawer) return;
            const isOpen = !drawer.classList.contains('hidden');
            if (isOpen) {
                drawer.classList.add('hidden');
                if (icon) icon.className = 'fa-solid fa-bars';
            } else {
                drawer.classList.remove('hidden');
                if (icon) icon.className = 'fa-solid fa-xmark';
            }
        }

        function closeMobileDrawer() {
            const drawer = document.getElementById('mobile-nav-drawer');
            const icon = document.getElementById('mobile-hamburger-icon');
            if (drawer) drawer.classList.add('hidden');
            if (icon) icon.className = 'fa-solid fa-bars';
        }

        function closeMobileMenu() {
            closeMobileDrawer();
        }

        function toggleMobileSubmenu(id) {
            const target = document.getElementById(id);
            if (!target) return;
            const isHidden = target.classList.contains('hidden');
            const arrow = document.getElementById(id.replace('mob-sub-', 'mob-arrow-'));
            if (isHidden) {
                target.classList.remove('hidden');
                if (arrow) arrow.style.transform = 'rotate(180deg)';
            } else {
                target.classList.add('hidden');
                if (arrow) arrow.style.transform = 'rotate(0deg)';
            }
        }

        // Handler backdrop & Escape untuk Mobile Drawer
        (function initMobileDrawerInteractions() {
            const drawer = document.getElementById('mobile-nav-drawer');
            if (drawer) {
                drawer.addEventListener('click', function (e) {
                    if (e.target === drawer) {
                        closeMobileDrawer();
                    }
                });
            }
            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape') {
                    closeMobileDrawer();
                }
            });
        })();

        // Trigger sedini mungkin agar mobile tidak menunggu asset berat
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                initMobileSplash();
            });
        } else {
            initMobileSplash();
        }

        // ==================== INISIALISASI UTAMA (SINGLE ONLOAD) ====================
        window.onload = function () {
            initThemeUI();
            initMobileSplash();
            initializeProgramRuntime();
            // Eksekusi paralel tanpa blocking waterfall
            loadBanners();
            loadNews();
            loadGaleri();
            loadPengaturan();
            loadUnitKegiatan();
            loadNotifikasi();
            if (typeof renderCalendar === 'function') {
                try {
                    renderCalendar();
                } catch (calErr) {
                    console.warn("Calendar render skipped/error:", calErr);
                }
            }
            // Client-side routing dieksekusi secara independen agar deep link selalu aktif
            handleClientRouting();

            // Non-blocking ASNIdentity session hydration (tidak menghambat render aplikasi publik)
            if (typeof ASNIdentity !== 'undefined' && typeof ASNIdentity.hydrateSession === 'function') {
                ASNIdentity.hydrateSession().catch(err => {
                    console.warn("ASNIdentity background hydration error:", err);
                });
            }
        };

        // Render program, banner & notifikasi secepat kilat sebelum window.onload (Stale-While-Revalidate)
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                if (typeof initializeProgramRuntime === 'function') initializeProgramRuntime();
                loadBanners();
                loadNotifikasi();
            });
        } else {
            if (typeof initializeProgramRuntime === 'function') initializeProgramRuntime();
            loadBanners();
            loadNotifikasi();
        }

        function navigateToNews() {
            const target = '/berita/';

            if (window.location.pathname !== target) {
                history.pushState({}, '', target);
            }

            switchTab('kabar');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        function handleClientRouting() {
            // Cek URL fallback dari 404.html (GitHub Pages)
            const params = new URLSearchParams(window.location.search);
            const route = params.get('route');
            if (route) {
                window.history.replaceState({}, '', route);
            }

            const path = window.location.pathname.replace(/\/+$/, '') || '/';

            if (path === '/berita') {
                switchTab('kabar', false);
            } else if (path === '/tentang-kami') {
                switchTab('profil', false);
            } else if (path === '/sejarah-berdirinya') {
                switchTab('sejarah-berdirinya', false);
            } else if (path === '/tujuan-visi-misi') {
                switchTab('tujuan-visi-misi', false);
            } else if (path === '/struktur-kepengurusan') {
                switchTab('struktur-kepengurusan', false);
            } else if (path === '/pendidikan/semua-program-pilihan') {
                switchTab('program-pilihan', false);
            } else if (path === '/pendidikan/sd-islam-unggulan') {
                switchTab('sd-islam', false);
            } else if (path === '/pendidikan/pesantren-tahfidz-anak') {
                switchTab('tahfidz-anak', false);
            } else if (path === '/pendidikan/pesantren-dewasa-putra') {
                switchTab('dewasa-putra', false);
            } else if (path === '/pendidikan/pesantren-dewasa-putri') {
                switchTab('dewasa-putri', false);
            } else if (path === '/kehidupan-santri/jadwal-kegiatan') {
                switchTab('jadwal-kegiatan', false);
            } else if (path === '/kehidupan-santri/unit-kegiatan') {
                switchTab('unit-kegiatan', false);
            } else if (path === '/kehidupan-santri/poskestren') {
                switchTab('poskestren', false);
            } else if (path === '/administrator') {
                const isMobile = window.innerWidth < 768;
                if (isMobile) {
                    window.history.replaceState({ tab: 'pengaturan' }, '', '/');
                    switchTab('pengaturan', false);
                } else {
                    switchTab('admin', false);
                }
            } else if (path === '/pengaturan') {
                const isMobile = window.innerWidth < 768;
                const isAdmin = (typeof isAdminLoggedIn !== 'undefined' && isAdminLoggedIn) || (typeof ASNIdentity !== 'undefined' && (ASNIdentity.currentRole === 'admin' || ASNIdentity.currentRole === 'editor'));
                if (isMobile) {
                    window.history.replaceState({ tab: 'pengaturan' }, '', '/');
                    switchTab('pengaturan', false);
                } else if (isAdmin) {
                    window.history.replaceState({ tab: 'admin' }, '', '/administrator');
                    switchTab('admin', false);
                } else {
                    switchTab('pengaturan', false);
                }
            } else if (path === '/notifikasi') {
                  switchTab('notifikasi', false);
                  const notifIdParam = params.get('id');
                  if (notifIdParam) {
                      setTimeout(() => openNotifikasiDetail(notifIdParam), 400);
                  }
            } else if (path === '/kehidupan-santri/ikatan-alumni') {
                  switchTab('alumni', false);
              } else if (path === '/kehidupan-santri/ikatan-alumni/form-data-alumni') {
                  switchTab('form-alumni', false);
            } else if (path === '/layanan') {
                switchTab('layanan-hub', false);
            } else if (path === '/layanan/galeri') {
                switchTab('galeri', false);
            } else if (path === '/layanan/kalender') {
                switchTab('kalender', false);
            } else if (path === '/layanan/portal-ibadah') {
                switchTab('ibadah', false);
            } else if (path === '/layanan/portal-ibadah/maulid') {
                switchTab('maulid-hub', false);
            } else if (path === '/layanan/portal-ibadah/maulid/ad-dibai') {
                switchTab('maulid-index', false);
            } else if (path === '/layanan/portal-ibadah/maulid/ad-dibai/baca') {
                switchTab('maulid-detail', false);
            } else if (path === '/layanan/portal-ibadah/burdah') {
                if (typeof openBurdahIndex === 'function') openBurdahIndex();
                else switchTab('burdah-index', false);
            } else if (path === '/layanan/portal-ibadah/tahlil-dan-yasin') {
                if (typeof openTahlilYasinPage === 'function') openTahlilYasinPage();
                else switchTab('tahlil-yasin', false);
            } else if (path === '/layanan/portal-ibadah/quran/pojok') {
                if (typeof openQuranPojokIndexTab === 'function') openQuranPojokIndexTab();
                else switchTab('quran-index', false);
            } else if (path === '/layanan/portal-ibadah/quran/halaman') {
                switchTab('quran-page', false);
            } else if (path.startsWith('/berita/')) {
                const slug = path.split('/berita/')[1];
                if (slug) {
                    bacaBerita(slug, true);
                }
            }

            const legacyId = params.get('id');
            if (legacyId) {
                bacaBerita(legacyId);
            }
        }
        window.addEventListener('popstate', (e) => {
            const path = window.location.pathname.replace(/\/+$/, '') || '/';
            if (path.startsWith('/berita/')) {
                const slug = path.split('/berita/')[1];
                if (slug) bacaBerita(slug, true);
            } else if (path === '/berita') {
                switchTab('kabar', false);
            } else if (path === '/tentang-kami') {
                switchTab('profil', false);
            } else if (path === '/sejarah-berdirinya') {
                switchTab('sejarah-berdirinya', false);
            } else if (path === '/tujuan-visi-misi') {
                switchTab('tujuan-visi-misi', false);
            } else if (path === '/struktur-kepengurusan') {
                switchTab('struktur-kepengurusan', false);
            } else if (path === '/pendidikan/semua-program-pilihan') {
                switchTab('program-pilihan', false);
            } else if (path === '/pendidikan/sd-islam-unggulan') {
                switchTab('sd-islam', false);
            } else if (path === '/pendidikan/pesantren-tahfidz-anak') {
                switchTab('tahfidz-anak', false);
            } else if (path === '/pendidikan/pesantren-dewasa-putra') {
                switchTab('dewasa-putra', false);
            } else if (path === '/pendidikan/pesantren-dewasa-putri') {
                switchTab('dewasa-putri', false);
            } else if (path === '/kehidupan-santri/jadwal-kegiatan') {
                switchTab('jadwal-kegiatan', false);
            } else if (path === '/kehidupan-santri/unit-kegiatan') {
                switchTab('unit-kegiatan', false);
            } else if (path === '/kehidupan-santri/poskestren') {
                switchTab('poskestren', false);
            } else if (path === '/kehidupan-santri/ikatan-alumni') {
                  switchTab('alumni', false);
              } else if (path === '/kehidupan-santri/ikatan-alumni/form-data-alumni') {
                  switchTab('form-alumni', false);
            } else if (path === '/layanan') {
                switchTab('layanan-hub', false);
            } else if (path === '/layanan/galeri') {
                switchTab('galeri', false);
            } else if (path === '/layanan/kalender') {
                switchTab('kalender', false);
            } else if (path === '/layanan/portal-ibadah') {
                switchTab('ibadah', false);
            } else if (path === '/layanan/portal-ibadah/maulid') {
                switchTab('maulid-hub', false);
            } else if (path === '/layanan/portal-ibadah/maulid/ad-dibai') {
                switchTab('maulid-index', false);
            } else if (path === '/layanan/portal-ibadah/burdah') {
                if (typeof openBurdahIndex === 'function') openBurdahIndex();
                else switchTab('burdah-index', false);
            } else if (path === '/layanan/portal-ibadah/tahlil-dan-yasin') {
                if (typeof openTahlilYasinPage === 'function') openTahlilYasinPage();
                else switchTab('tahlil-yasin', false);
            } else if (path === '/layanan/portal-ibadah/quran/pojok') {
                if (typeof openQuranPojokIndexTab === 'function') openQuranPojokIndexTab();
                else switchTab('quran-index', false);
            } else if (path === '/layanan/portal-ibadah/quran/halaman') {
                switchTab('quran-page', false);
            } else if (path === '/administrator') {
                const isMobile = window.innerWidth < 768;
                if (isMobile) {
                    window.history.replaceState({ tab: 'pengaturan' }, '', '/');
                    switchTab('pengaturan', false);
                } else {
                    switchTab('admin', false);
                }
            } else if (path === '/pengaturan') {
                const isMobile = window.innerWidth < 768;
                const isAdmin = (typeof isAdminLoggedIn !== 'undefined' && isAdminLoggedIn) || (typeof ASNIdentity !== 'undefined' && (ASNIdentity.currentRole === 'admin' || ASNIdentity.currentRole === 'editor'));
                if (isMobile) {
                    window.history.replaceState({ tab: 'pengaturan' }, '', '/');
                    switchTab('pengaturan', false);
                } else if (isAdmin) {
                    window.history.replaceState({ tab: 'admin' }, '', '/administrator');
                    switchTab('admin', false);
                } else {
                    switchTab('pengaturan', false);
                }
            } else {
                switchTab('beranda', false);
            }
        });

        // ==================== SISTEM TABS (NAVIGASI SPA) ====================
        function scrollToSection(id) {
            setTimeout(() => {
                const el = document.getElementById(id);
                if (el) {
                    const y = el.getBoundingClientRect().top + window.pageYOffset - 100;
                    window.scrollTo({ top: y, behavior: 'smooth' });
                }
            }, 300);
        }

        function switchTab(tabId, updateUrl = true, customUrl = null) {
            if (tabId === 'admin' && window.innerWidth < 768 && (typeof isAdminLoggedIn === 'undefined' || !isAdminLoggedIn)) {
                if (updateUrl) {
                    window.history.replaceState({ tab: 'pengaturan' }, '', '/');
                }
                switchTab('pengaturan', updateUrl);
                return;
            }

            if (tabId === 'pengaturan' && window.innerWidth >= 768) {
                const isAdmin = (typeof isAdminLoggedIn !== 'undefined' && isAdminLoggedIn) || (typeof ASNIdentity !== 'undefined' && (ASNIdentity.currentRole === 'admin' || ASNIdentity.currentRole === 'editor'));
                if (isAdmin) {
                    switchTab('admin', updateUrl);
                    return;
                }
            }

            // Pada mobile, navigasi ke tab 'pengaturan' tidak memodifikasi URL browser (tetap di URL saat ini / bersih tanpa /pengaturan)
            if (tabId === 'pengaturan' && window.innerWidth < 768) {
                updateUrl = false;
            }

            if (updateUrl) {
                let targetUrl = '/';
                if (customUrl) {
                    targetUrl = customUrl;
                } else if (tabId === 'profil') targetUrl = '/tentang-kami/';
                else if (tabId === 'sejarah-berdirinya') targetUrl = '/sejarah-berdirinya';
                else if (tabId === 'tujuan-visi-misi') targetUrl = '/tujuan-visi-misi';
                else if (tabId === 'struktur-kepengurusan') targetUrl = '/struktur-kepengurusan';
                else if (tabId === 'kabar') targetUrl = '/berita/';
                else if (tabId === 'program-pilihan') targetUrl = '/pendidikan/semua-program-pilihan/';
                else if (tabId === 'sd-islam') targetUrl = '/pendidikan/sd-islam-unggulan/';
                else if (tabId === 'tahfidz-anak') targetUrl = '/pendidikan/pesantren-tahfidz-anak/';
                else if (tabId === 'dewasa-putra') targetUrl = '/pendidikan/pesantren-dewasa-putra/';
                else if (tabId === 'dewasa-putri') targetUrl = '/pendidikan/pesantren-dewasa-putri/';
                else if (tabId === 'jadwal-kegiatan') targetUrl = '/kehidupan-santri/jadwal-kegiatan/';
                else if (tabId === 'unit-kegiatan') targetUrl = '/kehidupan-santri/unit-kegiatan/';
                else if (tabId === 'poskestren') targetUrl = '/kehidupan-santri/poskestren/';
                else if (tabId === 'admin') targetUrl = '/administrator';
                else if (tabId === 'pengaturan') targetUrl = '/pengaturan';
                else if (tabId === 'notifikasi') targetUrl = '/notifikasi';
                else if (tabId === 'alumni') targetUrl = '/kehidupan-santri/ikatan-alumni/';
                else if (tabId === 'form-alumni') targetUrl = '/kehidupan-santri/ikatan-alumni/form-data-alumni/';
                else if (tabId === 'layanan-hub') targetUrl = '/layanan/';
                else if (tabId === 'galeri') targetUrl = '/layanan/galeri/';
                else if (tabId === 'kalender') targetUrl = '/layanan/kalender/';
                else if (tabId === 'ibadah') targetUrl = '/layanan/portal-ibadah/';
                else if (tabId === 'quran-index') targetUrl = '/layanan/portal-ibadah/quran/';
                else if (tabId === 'quran-detail') targetUrl = '/layanan/portal-ibadah/quran/baca/';
                else if (tabId === 'maulid-hub') targetUrl = '/layanan/portal-ibadah/maulid/';
                else if (tabId === 'maulid-index') targetUrl = '/layanan/portal-ibadah/maulid/ad-dibai/';
                else if (tabId === 'maulid-detail') targetUrl = '/layanan/portal-ibadah/maulid/ad-dibai/baca/';
                else if (tabId === 'burdah-index') targetUrl = '/layanan/portal-ibadah/burdah/';
                else if (tabId === 'tahlil-yasin') targetUrl = '/layanan/portal-ibadah/tahlil-dan-yasin/';
                else if (tabId === 'quran-page') targetUrl = '/layanan/portal-ibadah/quran/halaman/';

                if (window.location.pathname !== targetUrl && (
                    tabId === 'profil' || tabId === 'sejarah-berdirinya' || tabId === 'tujuan-visi-misi' || tabId === 'struktur-kepengurusan' ||
                    tabId === 'kabar' || tabId === 'program-pilihan' ||
                    tabId === 'sd-islam' || tabId === 'tahfidz-anak' || tabId === 'dewasa-putra' || tabId === 'dewasa-putri' ||
                    tabId === 'jadwal-kegiatan' || tabId === 'unit-kegiatan' || tabId === 'poskestren' || tabId === 'admin' || tabId === 'pengaturan' || tabId === 'notifikasi' || tabId === 'alumni' || tabId === 'form-alumni' ||
                    tabId === 'layanan-hub' || tabId === 'galeri' || tabId === 'kalender' || tabId === 'ibadah' ||
                    tabId === 'quran-index' || tabId === 'quran-detail' || tabId === 'quran-page' ||
                    tabId === 'maulid-hub' || tabId === 'maulid-index' || tabId === 'maulid-detail' ||
                    tabId === 'burdah-index' || tabId === 'tahlil-yasin' ||
                    tabId === 'beranda')) {
                    history.pushState({ tab: tabId }, '', targetUrl);
                }
            }

            if (tabId === 'profil' || tabId === 'sejarah-berdirinya' || tabId === 'tujuan-visi-misi' || tabId === 'struktur-kepengurusan') {
                loadPublicProfilLembaga();
            }

            document.querySelectorAll('.tab-content').forEach(el => {
                el.classList.add('hidden');
                el.classList.remove('block');
            });

            const targetTab = document.getElementById(`page-${tabId}`);
            if (targetTab) {
                targetTab.classList.remove('hidden');
                if (!targetTab.classList.contains('flex')) {
                    targetTab.classList.add('block');
                }
            }

            // Hide menus for Admin layout
            const deskNavMenu = document.getElementById('desk-nav-menu');
            const deskActionMenu = document.getElementById('desk-action-menu');
            const mobileBottomNav = document.getElementById('mobile-bottom-nav');
            const mainFooter = document.querySelector('footer');

            if (tabId === 'admin') {
                if (deskNavMenu) deskNavMenu.classList.add('hidden');
                if (deskActionMenu) deskActionMenu.classList.add('hidden');
                if (mobileBottomNav) mobileBottomNav.classList.add('hidden');
                if (mainFooter) mainFooter.classList.add('hidden');
                if (!isAdminLoggedIn) {
                    setTimeout(() => {
                        if (typeof openAdminAuthModal === 'function') {
                            openAdminAuthModal();
                        } else if (typeof openAdminLoginModal === 'function') {
                            openAdminLoginModal();
                        }
                    }, 100);
                }
            } else {
                if (deskNavMenu) deskNavMenu.classList.remove('hidden');
                if (deskActionMenu) deskActionMenu.classList.remove('hidden');
                if (mobileBottomNav) mobileBottomNav.classList.remove('hidden');
                if (mainFooter) mainFooter.classList.remove('hidden');
            }

            if (tabId === 'alumni') {
                loadAlumniTestimonials();
            }
            if (tabId === 'form-alumni') {
                initWilayah();
            }
            if (tabId === 'quran-index') {
                fetchQuranList();
            } else if (tabId === 'maulid-index') {
                renderMaulidIndex();
            } else if (tabId === 'pengaturan') {
                if (typeof ASNIdentity !== 'undefined' && typeof ASNIdentity.renderAccountCenterUI === 'function') {
                    ASNIdentity.renderAccountCenterUI();
                }
            } else if (tabId === 'notifikasi') {
                loadNotifikasi();
            } else if (tabId === 'beranda') {
                checkHomePosterPopup();
            } else if (tabId === 'jadwal-sholat') {
                if (typeof ASNJadwalSholat !== 'undefined') {
                    ASNJadwalSholat.init();
                }
            }

            // Nav Mobile Mapping
            const PARENT_MOB_MAP = {
                'beranda': 'mobile-nav-beranda',
                'kabar': 'mobile-nav-kabar',
                'detail-berita': 'mobile-nav-kabar',
                'ibadah': 'mobile-nav-ibadah',
                'quran-index': 'mobile-nav-ibadah',
                'quran-detail': 'mobile-nav-ibadah',
                'quran-page': 'mobile-nav-ibadah',
                'maulid-hub': 'mobile-nav-ibadah',
                'maulid-index': 'mobile-nav-ibadah',
                'maulid-detail': 'mobile-nav-ibadah',
                'burdah-index': 'mobile-nav-ibadah',
                'burdah-detail': 'mobile-nav-ibadah',
                'tahlil-yasin': 'mobile-nav-ibadah',
                'kalender': 'mobile-nav-kalender',
                'pengaturan': 'mobile-nav-pengaturan',
                'admin': 'mobile-nav-pengaturan'
            };

            document.querySelectorAll('.nav-mob-btn').forEach(btn => {
                btn.classList.remove('text-emerald-300', 'font-bold');
                btn.classList.add('text-white/80');
            });
            const targetMobId = PARENT_MOB_MAP[tabId];
            if (targetMobId) {
                const activeMobBtn = document.getElementById(targetMobId);
                if (activeMobBtn) {
                    activeMobBtn.classList.remove('text-white/80');
                    activeMobBtn.classList.add('text-emerald-300', 'font-bold');
                }
            }

            // Nav Desktop Mapping (Hubungkan submenu ke tombol induk di header)
            const PARENT_DESK_MAP = {
                'beranda': 'desk-nav-beranda',
                'profil': 'desk-nav-profil',
                'sejarah-berdirinya': 'desk-nav-profil',
                'tujuan-visi-misi': 'desk-nav-profil',
                'struktur-kepengurusan': 'desk-nav-profil',
                'program-pilihan': 'desk-nav-program-pilihan',
                'sd-islam': 'desk-nav-program-pilihan',
                'tahfidz-anak': 'desk-nav-program-pilihan',
                'dewasa-putra': 'desk-nav-program-pilihan',
                'dewasa-putri': 'desk-nav-program-pilihan',
                'jadwal-kegiatan': 'desk-nav-jadwal-kegiatan',
                'unit-kegiatan': 'desk-nav-jadwal-kegiatan',
                'alumni': 'desk-nav-jadwal-kegiatan',
                'form-alumni': 'desk-nav-jadwal-kegiatan',
                'poskestren': 'desk-nav-jadwal-kegiatan',
                'kabar': 'desk-nav-berita',
                'detail-berita': 'desk-nav-berita',
                'layanan-hub': 'desk-nav-layanan-hub',
                'galeri': 'desk-nav-layanan-hub',
                'kalender': 'desk-nav-layanan-hub',
                'ibadah': 'desk-nav-layanan-hub',
                'jadwal-sholat': 'desk-nav-layanan-hub',
                'maulid-hub': 'desk-nav-layanan-hub',
                'maulid-index': 'desk-nav-layanan-hub',
                'maulid-detail': 'desk-nav-layanan-hub',
                'burdah-index': 'desk-nav-layanan-hub',
                'burdah-detail': 'desk-nav-layanan-hub',
                'tahlil-yasin': 'desk-nav-layanan-hub',
                'quran-index': 'desk-nav-layanan-hub',
                'quran-detail': 'desk-nav-layanan-hub',
                'quran-page': 'desk-nav-layanan-hub'
            };

            document.querySelectorAll('.nav-desk-btn').forEach(btn => {
                btn.classList.remove('bg-teal-800', 'bg-brand-800', 'text-white');
                btn.classList.add('text-teal-100', 'hover:bg-teal-800/80', 'hover:text-white');
            });
            const targetDeskId = PARENT_DESK_MAP[tabId];
            if (targetDeskId) {
                const activeDeskBtn = document.getElementById(targetDeskId);
                if (activeDeskBtn) {
                    activeDeskBtn.classList.remove('text-teal-100', 'hover:bg-teal-800/80');
                    activeDeskBtn.classList.add('bg-teal-800', 'text-white');
                }
            }
            closeMobileDrawer();

            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        async function loadNews() {
            if (!isApiConfigured()) {
                renderAllNewsViews(mockNewsData);
                checkPendingNewsRoute();
                return;
            }

            try {
                const response = await apiGet("getKabar");
                if (response && response.status === "success" &&
                    Array.isArray(response.data) && response.data.length > 0) {
                    mockNewsData = response.data;
                }
                renderAllNewsViews(mockNewsData);
                checkPendingNewsRoute();
            } catch (err) {
                console.error("Gagal memuat berita via API:", err);
                renderAllNewsViews(mockNewsData);
                checkPendingNewsRoute();
            }
        }

        function checkPendingNewsRoute() {
            const path = window.location.pathname.replace(/\/+$/, '') || '/';
            const params = new URLSearchParams(window.location.search);
            if (path.startsWith('/berita/') || params.get('id')) {
                handleClientRouting();
            }
        }

        function renderAllNewsViews(newsArray) {
            renderNews(newsArray);
            renderHeadlineNews(newsArray);
            renderAdminNewsList();
        }

        function renderNews(newsArray) {
            const gridContainer = document.getElementById('news-grid-container');
            if (!gridContainer) return;
            gridContainer.innerHTML = "";

            newsArray.forEach((news, idx) => {
                const card = document.createElement('article');
                card.className = "bg-slate-50 dark:bg-[#15202d] hover:bg-emerald-50/50 dark:hover:bg-[#1c2836] p-4 rounded-2xl border border-slate-100 dark:border-[#253447] hover:border-brand-100 dark:hover:border-emerald-500/40 flex flex-col gap-3 cursor-pointer group transition duration-200";
                card.onclick = () => bacaBerita(news.news_id || news.slug);

                const defaultNewsImage = "https://images.unsplash.com/photo-1585036156171-384164a8c675?q=80&w=600&auto=format&fit=crop";
                const imgSource = (news.gambar && String(news.gambar).trim()) ? news.gambar : defaultNewsImage;
                const imgHtml = `<img src="${imgSource}" alt="${escapeHtml(news.judul)}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" onerror="this.onerror=null;this.src='${defaultNewsImage}';">`;

                card.innerHTML = `
                    <div class="w-full h-40 bg-brand-800 rounded-xl relative flex items-center justify-center overflow-hidden">
                        ${imgHtml}
                        <span class="absolute top-2.5 left-2.5 bg-brand-600 text-white text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">${news.kategori}</span>
                    </div>
                    <div class="space-y-1.5">
                        <div class="flex items-center space-x-2 text-[10px] text-slate-400 dark:text-slate-400">
                            <span><i class="fa-solid fa-calendar mr-1"></i> ${news.tanggal}</span>
                            <span>•</span>
                            <span class="text-brand-700 dark:text-emerald-400 font-bold">${news.penulis}</span>
                        </div>
                        <h3 class="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition line-clamp-2 leading-snug">
                            ${news.judul}
                        </h3>
                        <p class="text-xs text-slate-500 dark:text-slate-300 line-clamp-2 leading-relaxed">
                            ${news.ringkasan}
                        </p>
                    </div>
                `;
                gridContainer.appendChild(card);
            });
        }

        function renderHeadlineNews(newsArray) {
            const containerMobile = document.getElementById('headline-news-container');
            const containerDesktop = document.getElementById('headline-news-container-desktop');
            const topHeadline = newsArray.slice(0, 3);
            const defaultThumb = "https://images.unsplash.com/photo-1585036156171-384164a8c675?q=80&w=400&auto=format&fit=crop";

            // Mobile Render
            if (containerMobile) {
                containerMobile.innerHTML = "";
                topHeadline.forEach((news, idx) => {
                    const item = document.createElement('article');
                    item.className = `flex items-center justify-between gap-3 ${idx < topHeadline.length - 1 ? 'border-b border-slate-100 dark:border-[#253447] pb-4' : ''} cursor-pointer group`;
                    item.onclick = () => bacaBerita(news.news_id || news.slug);
                    const thumbSrc = news.gambar || defaultThumb;
                    item.innerHTML = `
                        <div class="space-y-1.5 flex-1 min-w-0">
                            <div>
                                <span class="inline-block px-2.5 py-0.5 bg-emerald-700 text-white text-[9px] font-extrabold rounded-md uppercase tracking-wider">${news.kategori}</span>
                            </div>
                            <h4 class="text-xs md:text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition line-clamp-2 leading-snug">
                                ${news.judul}
                            </h4>
                        </div>
                        <div class="w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden shrink-0 border border-slate-100 dark:border-[#253447] bg-slate-100 dark:bg-[#1c2836]">
                            <img src="${thumbSrc}" alt="${news.judul}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
                        </div>
                    `;
                    containerMobile.appendChild(item);
                });
            }

            // Desktop Render
            if (containerDesktop) {
                containerDesktop.innerHTML = "";
                if (topHeadline.length > 0) {
                    const bigNews = topHeadline[0];
                    const bigThumb = bigNews.gambar || defaultThumb;
                    const plainContent = (bigNews.ringkasan || bigNews.isi || "").replace(/<[^>]*>?/gm, '');

                    let html = `
                        <!-- Featured Big News -->
                        <div class="grid grid-cols-12 gap-6 bg-white dark:bg-[#15202d] p-5 rounded-2xl border border-slate-200/80 dark:border-[#253447] shadow-sm">
                            <div class="col-span-6 rounded-xl overflow-hidden cursor-pointer" onclick="bacaBerita('${bigNews.news_id || bigNews.slug}')">
                                <img src="${bigThumb}" alt="${bigNews.judul}" class="w-full h-full object-cover hover:scale-105 transition duration-300">
                            </div>
                            <div class="col-span-6 flex flex-col justify-between py-1">
                                <div class="space-y-2">
                                    <span class="text-xs font-semibold text-emerald-700 dark:text-emerald-400">${bigNews.kategori} • ${bigNews.tanggal}</span>
                                    <h4 onclick="bacaBerita('${bigNews.news_id || bigNews.slug}')"
                                        class="font-bold text-base text-slate-900 dark:text-slate-100 leading-snug hover:text-emerald-700 dark:hover:text-emerald-400 transition cursor-pointer line-clamp-2">
                                        ${bigNews.judul}
                                    </h4>
                                    <p class="text-xs text-slate-500 dark:text-slate-300 line-clamp-3">
                                        ${plainContent}
                                    </p>
                                </div>
                                <button onclick="bacaBerita('${bigNews.news_id || bigNews.slug}')"
                                    class="text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-400 inline-flex items-center gap-1 pt-3">
                                    Baca Selengkapnya <span>→</span>
                                </button>
                            </div>
                        </div>
                    `;

                    if (topHeadline.length > 1) {
                        html += `<div class="grid grid-cols-2 gap-4 mt-6">`;
                        for (let i = 1; i < topHeadline.length; i++) {
                            const smallNews = topHeadline[i];
                            html += `
                                <div onclick="bacaBerita('${smallNews.news_id || smallNews.slug}')"
                                    class="bg-white dark:bg-[#15202d] p-4 rounded-xl border border-slate-200/70 dark:border-[#253447] hover:border-slate-300 dark:hover:border-slate-600 transition cursor-pointer">
                                    <span class="text-[11px] font-medium text-slate-400 dark:text-slate-400">${smallNews.kategori} • ${smallNews.tanggal}</span>
                                    <h5 class="font-bold text-xs text-slate-800 dark:text-slate-100 mt-1 line-clamp-2 hover:text-emerald-700 dark:hover:text-emerald-400">
                                        ${smallNews.judul}
                                    </h5>
                                </div>
                            `;
                        }
                        html += `</div>`;
                    }
                    containerDesktop.innerHTML = html;
                }
            }

        }

        function bacaBerita(id, skipHistory = false) {
            const news = mockNewsData.find(n => n.news_id === id || n.slug === id);
            if (!news) return;

            if (!skipHistory) {
                const canonicalUrl = `/berita/${news.slug}`;
                if (window.location.pathname !== canonicalUrl) {
                    window.history.pushState({ id: news.news_id }, news.judul, canonicalUrl);
                }
            }

            const activeTabEl = document.querySelector('.tab-content:not(.hidden)');
            if (activeTabEl && activeTabEl.id !== 'page-detail-berita') {
                previousTabBeforeNews = activeTabEl.id.replace('page-', '');
            }

            document.getElementById('detail-news-title').innerText = news.judul || '';
            document.getElementById('detail-news-badge').innerText = news.kategori || 'Kabar';
            document.getElementById('detail-news-date').innerHTML = `<i class="fa-solid fa-calendar mr-1"></i> ${news.tanggal || '-'}`;
            document.getElementById('detail-news-author').innerText = news.penulis || 'Admin';

            const summaryBox = document.getElementById('detail-news-summary-box');
            const summaryEl = document.getElementById('detail-news-summary');
            if (news.ringkasan && news.ringkasan.trim() !== '') {
                summaryEl.innerText = news.ringkasan;
                summaryBox.classList.remove('hidden');
            } else {
                summaryBox.classList.add('hidden');
            }

            document.getElementById('detail-news-body').innerText = news.isi || '';

            const imgEl = document.getElementById('detail-news-img');
            const imgContainer = document.getElementById('detail-news-img-container');
            if (news.gambar && news.gambar.trim() !== '') {
                imgEl.src = news.gambar;
                imgContainer.classList.remove('hidden');
            } else {
                imgContainer.classList.add('hidden');
            }

            switchTab('detail-berita');
        }

        function kembaliDariBerita() {
            if (window.location.pathname.startsWith('/berita/')) {
                window.history.pushState(null, '', '/');
            }
            switchTab(previousTabBeforeNews || 'beranda');
        }

        // ==================== SLIDER BANNER BERANDA (OPTIMIZED SWR) ====================
        const MAIN_BANNER_CACHE_KEY = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.storage && APP_CONFIG.storage.keys)
            ? APP_CONFIG.storage.keys.bannerCache
            : 'mubarokah_banner_cache';

        function optimizeImageUrl(url, width = 1000) {
            if (!url || typeof url !== 'string') return '';
            // Google Drive direct user content
            if (url.includes('googleusercontent.com')) {
                const cleanUrl = url.split('=')[0];
                return `${cleanUrl}=w${width}-rw`;
            }
            // Unsplash images
            if (url.includes('images.unsplash.com')) {
                try {
                    const u = new URL(url);
                    u.searchParams.set('auto', 'format');
                    u.searchParams.set('fit', 'crop');
                    u.searchParams.set('q', '80');
                    u.searchParams.set('w', String(width));
                    return u.toString();
                } catch (e) {
                    return url;
                }
            }
            return url;
        }

        async function loadBanners() {
            // 1. STALE: Coba render secepat kilat dari cache lokal jika ada
            try {
                const cached = localStorage.getItem(MAIN_BANNER_CACHE_KEY);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        mockBannerData = parsed;
                        renderHeroSlider();
                        if (typeof renderAdminBannerList === 'function') renderAdminBannerList();
                    }
                } else if (Array.isArray(mockBannerData) && mockBannerData.length > 0) {
                    renderHeroSlider();
                    if (typeof renderAdminBannerList === 'function') renderAdminBannerList();
                }
            } catch (e) {
                console.warn("Gagal membaca cache banner:", e);
            }

            if (!isApiConfigured()) return;

            // 2. REVALIDATE: Ambil data segar dari backend di background
            try {
                const response = await apiGet("getBanner");
                if (response && response.status === "success" &&
                    Array.isArray(response.data) && response.data.length > 0) {
                    const newDataStr = JSON.stringify(response.data);
                    const oldDataStr = localStorage.getItem(MAIN_BANNER_CACHE_KEY);

                    localStorage.setItem(MAIN_BANNER_CACHE_KEY, newDataStr);
                    mockBannerData = response.data;

                    // Update UI jika ada perubahan data dari cache sebelumnya
                    if (newDataStr !== oldDataStr) {
                        renderHeroSlider();
                        if (typeof renderAdminBannerList === 'function') renderAdminBannerList();
                    }
                }
            } catch (err) {
                console.error("Gagal memuat banner via API:", err);
            }
        }

        function renderHeroSlider() {
            const isDesktop = window.innerWidth >= 768;
            const sliderPairs = [
                {
                    slider: document.getElementById('hero-slider-container'),
                    dots: document.getElementById('hero-dots-container'),
                    type: 'mobile'
                },
                {
                    slider: document.getElementById('hero-slider-container-desktop'),
                    dots: document.getElementById('hero-dots-container-desktop'),
                    type: 'desktop'
                }
            ];

            const activeBanners = mockBannerData.filter(b => b.status === "Aktif");
            const labelMap = { ppdb: 'Pendaftaran', kabar: 'Berita', 'program-pilihan': 'Program', profil: 'Profil', galeri: 'Galeri', alumni: 'Alumni', beranda: 'Beranda', 'jadwal-kegiatan': 'Jadwal', 'unit-kegiatan': 'Unit', poskestren: 'Poskestren' };

            sliderPairs.forEach(({ slider, dots, type }) => {
                if (!slider || !dots) return;

                if (activeBanners.length === 0) {
                    const emptyClass = type === 'desktop'
                        ? 'w-full h-full flex items-center justify-center text-emerald-400/60 text-xs italic'
                        : 'w-full h-full flex items-center justify-center text-slate-400 text-xs italic bg-slate-100 dark:bg-[#15202d]';
                    slider.innerHTML = `<div class="${emptyClass}">Belum ada banner aktif.</div>`;
                    dots.innerHTML = "";
                    return;
                }

                slider.innerHTML = "";
                dots.innerHTML = "";

                const isCurrentViewport = (type === 'desktop' && isDesktop) || (type === 'mobile' && !isDesktop);
                const targetWidth = type === 'desktop' ? 1200 : 750;

                activeBanners.forEach((banner, idx) => {
                    const slideDiv = document.createElement('div');
                    slideDiv.className = `hero-slide absolute inset-0 transition-opacity duration-500 cursor-pointer ${idx === 0 ? 'opacity-100' : 'opacity-0'}`;

                    if (banner.tipeAksi === "tab" && banner.targetAksi) {
                        slideDiv.onclick = () => switchTab(banner.targetAksi);
                    } else if (banner.tipeAksi === "url" && banner.targetAksi) {
                        slideDiv.onclick = () => window.open(banner.targetAksi, '_blank');
                    }

                    const optImgUrl = optimizeImageUrl(banner.gambar, targetWidth);
                    // Atribut prioritas pemuatan:
                    // Slide 0 pada viewport aktif: eager + high priority untuk LCP instan
                    // Slide lainnya atau viewport tersembunyi: lazy loading
                    const isEager = isCurrentViewport && idx === 0;
                    const loadingAttr = isEager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';

                    if (type === 'desktop') {
                        const label = banner.tipeAksi === 'tab' ? (labelMap[banner.targetAksi] || banner.targetAksi || 'Info') : (banner.tipeAksi === 'url' ? 'Tautan' : 'Info');
                        slideDiv.innerHTML = `
                            <img src="${optImgUrl}" alt="${escapeHtml(banner.nama)}" class="w-full h-full object-cover" ${loadingAttr} decoding="async">
                            <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-6">
                                <div>
                                    <span class="px-2.5 py-1 rounded bg-emerald-500 text-xs font-bold text-slate-950 uppercase">${escapeHtml(label)}</span>
                                    <p class="text-sm font-medium text-white mt-1">${escapeHtml(banner.nama)}</p>
                                </div>
                            </div>`;
                    } else {
                        slideDiv.innerHTML = `<img src="${optImgUrl}" alt="${escapeHtml(banner.nama)}" class="w-full h-full object-cover" ${loadingAttr} decoding="async">`;
                    }

                    slider.appendChild(slideDiv);

                    const dotBtn = document.createElement('button');
                    dotBtn.className = `hero-dot rounded-full transition-all duration-300 ${idx === 0 ? 'w-2.5 h-2.5 bg-brand-700 dark:bg-emerald-400' : 'w-2 h-2 bg-slate-300 dark:bg-slate-600'}`;
                    dotBtn.onclick = () => setHeroSlide(idx);
                    dots.appendChild(dotBtn);
                });
            });

            currentHeroSlide = 0;
            if (heroSlideTimer) clearInterval(heroSlideTimer);

            if (activeBanners.length > 1) {
                heroSlideTimer = setInterval(() => {
                    const activeSelector = isDesktop ? '#hero-slider-container-desktop .hero-slide' : '#hero-slider-container .hero-slide';
                    const slides = document.querySelectorAll(activeSelector);
                    if (slides.length > 0) {
                        currentHeroSlide = (currentHeroSlide + 1) % slides.length;
                        setHeroSlide(currentHeroSlide);
                    }
                }, 4000);
            }
        }

        function setHeroSlide(index) {
            currentHeroSlide = index;

            const containers = [
                { slides: document.querySelectorAll('#hero-slider-container .hero-slide'), dots: document.querySelectorAll('#hero-dots-container .hero-dot') },
                { slides: document.querySelectorAll('#hero-slider-container-desktop .hero-slide'), dots: document.querySelectorAll('#hero-dots-container-desktop .hero-dot') }
            ];

            containers.forEach(({ slides, dots }) => {
                if (!slides.length) return;

                slides.forEach((slide, i) => {
                    if (i === index) {
                        slide.classList.remove('opacity-0');
                        slide.classList.add('opacity-100');
                    } else {
                        slide.classList.remove('opacity-100');
                        slide.classList.add('opacity-0');
                    }
                });

                dots.forEach((dot, i) => {
                    if (i === index) {
                        dot.className = "hero-dot w-2.5 h-2.5 rounded-full bg-brand-700 dark:bg-emerald-400 transition-all duration-300";
                    } else {
                        dot.className = "hero-dot w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 hover:bg-slate-400 dark:hover:bg-slate-500 transition-all duration-300";
                    }
                });
            });
        }


        // ==================== FITUR PENGATURAN USER ====================
        function initThemeUI() {
            const isDark = document.documentElement.classList.contains('dark');
            const toggle = document.getElementById('dark-mode-toggle');
            const icon = document.getElementById('theme-icon');
            const text = document.getElementById('theme-status-text');

            if (toggle) toggle.checked = isDark;
            if (icon) {
                icon.className = isDark ? "fa-solid fa-moon text-indigo-400" : "fa-solid fa-sun text-amber-500";
            }
            if (text) {
                text.innerText = isDark ? "Mode Gelap (Dark)" : "Mode Terang (Light)";
            }
        }

        function toggleDarkMode(isDark) {
            const icon = document.getElementById('theme-icon');
            const text = document.getElementById('theme-status-text');
            const toggle = document.getElementById('dark-mode-toggle');

            if (toggle && toggle.checked !== isDark) {
                toggle.checked = isDark;
            }

            const themeKey = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.storage && APP_CONFIG.storage.keys)
                ? APP_CONFIG.storage.keys.theme
                : 'mubarokah_theme';

            if (isDark) {
                document.documentElement.classList.add('dark');
                if (icon) icon.className = 'fa-solid fa-moon text-amber-400';
                if (text) text.innerText = 'Mode Gelap Aktif';
                localStorage.setItem(themeKey, 'dark');
            } else {
                document.documentElement.classList.remove('dark');
                if (icon) icon.className = 'fa-solid fa-sun text-amber-500';
                if (text) text.innerText = 'Mode Terang Aktif';
                localStorage.setItem(themeKey, 'light');
            }
        }

        function openEditProfileModal() { document.getElementById('editProfileModal').classList.remove('hidden'); }
        function closeEditProfileModal() { document.getElementById('editProfileModal').classList.add('hidden'); }

        function saveProfileChanges() {
            const name = document.getElementById('edit-nama-input').value;
            const email = document.getElementById('edit-email-input').value;
            const phone = document.getElementById('edit-phone-input').value;

            if (name) document.getElementById('user-display-name').innerText = name;
            if (email) document.getElementById('user-display-email').innerHTML = `<i class="fa-regular fa-envelope mr-1"></i> ${email}`;
            if (phone) document.getElementById('user-display-phone').innerHTML = `<i class="fa-brands fa-whatsapp mr-1 text-emerald-600"></i> ${phone}`;

            document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=15803d&color=fff&size=128`;
            closeEditProfileModal();
            showToast("Profil berhasil diperbarui!");
        }

        function updatePrayerLocation(city) { showToast(`Lokasi shalat diubah ke: ${city}`); }
        function togglePrayerNotification(enabled) { showToast(enabled ? "Notifikasi Azan diaktifkan" : "Notifikasi Azan dinonaktifkan"); }
        function openFeedbackModal() { document.getElementById('feedbackModal').classList.remove('hidden'); }
        function closeFeedbackModal() { document.getElementById('feedbackModal').classList.add('hidden'); }

        function submitFeedback() {
            const text = document.getElementById('feedback-textarea').value.trim();
            if (!text) {
                showToast("Mohon tuliskan masukan Anda terlebih dahulu!");
                return;
            }
            document.getElementById('feedback-textarea').value = "";
            closeFeedbackModal();
            showToast("Terima kasih! Masukan Anda telah terkirim.");
        }

        function toggleAuthSession() {
            const btnIcon = document.getElementById('auth-btn-icon');
            const btnText = document.getElementById('auth-btn-text');
            const authBtn = document.getElementById('auth-btn');
            const mobileHeaderAuthIcon = document.getElementById('mobile-header-auth-icon');

            if (isLoggedIn) {
                isLoggedIn = false;
                if (btnIcon) btnIcon.className = "fa-solid fa-right-to-bracket";
                if (btnText) btnText.innerText = "Masuk ke Akun (Log In)";
                if (authBtn) authBtn.className = "w-full bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold py-3.5 px-6 rounded-2xl border border-brand-100 transition flex items-center justify-center space-x-2";
                if (mobileHeaderAuthIcon) mobileHeaderAuthIcon.className = "fa-solid fa-right-to-bracket";
                showToast("Anda telah keluar dari akun.");
            } else {
                isLoggedIn = true;
                if (btnIcon) btnIcon.className = "fa-solid fa-right-from-bracket";
                if (btnText) btnText.innerText = "Keluar dari Akun (Log Out)";
                if (authBtn) authBtn.className = "w-full bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold py-3.5 px-6 rounded-2xl border border-rose-100 transition flex items-center justify-center space-x-2";
                if (mobileHeaderAuthIcon) mobileHeaderAuthIcon.className = "fa-solid fa-right-from-bracket";
                showToast("Berhasil masuk ke akun!");
            }
        }

        // ==================== WIDGET SHALAT & COUNTDOWN ====================
        const prayerTimes = [
            { name: "Subuh", time: "04:32" },
            { name: "Dzuhur", time: "11:51" },
            { name: "Ashar", time: "15:12" },
            { name: "Maghrib", time: "17:48" },
            { name: "Isya", time: "18:58" }
        ];

        function initHomePrayerWidget() {
            const now = new Date();

            let activeTimes = prayerTimes;
            let tzLabel = "WIB";

            if (typeof ASNJadwalSholat !== 'undefined' && typeof ASNJadwalSholat.calculateDay === 'function') {
                const curCity = ASNJadwalSholat.getCurrentCity();
                const calc = ASNJadwalSholat.calculateDay(now, curCity);
                if (calc && calc.times) {
                    activeTimes = [
                        { name: "Subuh", time: calc.times.subuh },
                        { name: "Dhuha", time: calc.times.dhuha },
                        { name: "Zuhur", time: calc.times.zuhur },
                        { name: "Ashar", time: calc.times.ashar },
                        { name: "Maghrib", time: calc.times.maghrib },
                        { name: "Isya", time: calc.times.isya }
                    ];
                    tzLabel = calc.tzName || "WIB";
                }
            }

            const nowInSeconds = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds();

            let nextPrayer = activeTimes[0];
            let targetSeconds = 0;

            for (let i = 0; i < activeTimes.length; i++) {
                const [h, m] = activeTimes[i].time.split(':').map(Number);
                const pSeconds = (h * 3600) + (m * 60);
                if (pSeconds > nowInSeconds) {
                    nextPrayer = activeTimes[i];
                    targetSeconds = pSeconds;
                    break;
                }
            }

            if (targetSeconds === 0) {
                const [h, m] = activeTimes[0].time.split(':').map(Number);
                targetSeconds = (24 * 3600) + (h * 3600) + (m * 60);
            }

            const diffSeconds = targetSeconds - nowInSeconds;
            const hoursLeft = Math.floor(diffSeconds / 3600);
            const minsLeft = Math.floor((diffSeconds % 3600) / 60);
            const secsLeft = diffSeconds % 60;
            const formattedCountdown = `${String(hoursLeft).padStart(2, '0')}:${String(minsLeft).padStart(2, '0')}:${String(secsLeft).padStart(2, '0')}`;

            const prayerHtml = `${nextPrayer.name} <span class="text-amber-300 font-normal ml-1">${nextPrayer.time} ${tzLabel}</span>`;

            ['home-next-prayer-name', 'home-next-prayer-name-desktop'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = prayerHtml;
            });

            ['home-prayer-countdown', 'home-prayer-countdown-desktop'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerText = formattedCountdown;
            });

            // Update Current Date dynamically
            if (typeof namaHariIndo !== 'undefined' && typeof namaBulanIndo !== 'undefined' && typeof getPasaranJawa !== 'undefined') {
                const hari = namaHariIndo[now.getDay()];
                const pasaran = getPasaranJawa(now);
                const tgl = now.getDate();
                const bln = namaBulanIndo[now.getMonth()];
                const thn = now.getFullYear();

                ['home-current-date', 'home-current-date-desktop'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.innerText = `${hari} ${pasaran}, ${tgl} ${bln} ${thn}`;
                });
            }
        }

        setInterval(initHomePrayerWidget, 1000);
        initHomePrayerWidget();

        // ==================== SUB-TABS & FILTERS ====================
        function toggleJadwalSubPage(subTab) {
            document.querySelectorAll('.jadwal-sub-container').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('.jadwal-sub-btn').forEach(btn => {
                btn.className = "jadwal-sub-btn flex-1 text-center py-2 text-[11px] md:text-xs font-bold rounded-xl text-slate-500 dark:text-slate-400 hover:text-brand-900 dark:hover:text-emerald-300 transition";
            });

            const targetContainer = document.getElementById(`jadwal-container-${subTab}`);
            if (targetContainer) targetContainer.classList.remove('hidden');

            const activeBtn = document.getElementById(`jadwal-sub-${subTab}`);
            if (activeBtn) activeBtn.className = "jadwal-sub-btn flex-1 text-center py-2 text-[11px] md:text-xs font-bold rounded-xl bg-white dark:bg-[#253447] text-brand-900 dark:text-emerald-300 shadow-sm dark:shadow-none transition";
        }

        let currentGaleriFilter = "all";

        function renderGaleriList() {
            const gridContainer = document.getElementById('galeri-grid');
            const filterContainer = document.getElementById('galeri-filter-container');

            if (!gridContainer || !filterContainer) return;

            const activeGaleri = mockGaleriData.filter(g => g.status === "Aktif");

            if (activeGaleri.length === 0) {
                filterContainer.innerHTML = '';
                gridContainer.innerHTML = `<div class="col-span-full text-center py-10 text-slate-400 dark:text-slate-500 text-xs bg-slate-50 dark:bg-[#1c2836] rounded-2xl">Belum ada foto galeri.</div>`;
                return;
            }

            // Generate filter buttons dynamically
            const categories = new Set(activeGaleri.map(g => g.kategori).filter(Boolean));
            let filterHtml = `
                <button onclick="filterGaleri('all')" id="btn-galeri-all" class="btn-filter-galeri px-4 py-2 rounded-2xl text-xs font-bold ${currentGaleriFilter === 'all' ? 'bg-brand-700 text-white shadow-sm' : 'bg-slate-100 dark:bg-[#1c2836] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#253447]'} shrink-0 transition">Semua</button>
            `;

            categories.forEach(cat => {
                const safeCat = cat.replace(/\s+/g, '-').toLowerCase();
                const isActive = currentGaleriFilter === safeCat;
                filterHtml += `
                    <button onclick="filterGaleri('${safeCat}')" id="btn-galeri-${safeCat}" class="btn-filter-galeri px-4 py-2 rounded-2xl text-xs font-bold ${isActive ? 'bg-brand-700 text-white shadow-sm' : 'bg-slate-100 dark:bg-[#1c2836] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#253447]'} shrink-0 transition" data-category="${cat}">${cat}</button>
                `;
            });
            filterContainer.innerHTML = filterHtml;

            // Generate grid
            gridContainer.innerHTML = "";
            let itemsFound = 0;

            activeGaleri.forEach(galeri => {
                const safeCat = (galeri.kategori || "").replace(/\s+/g, '-').toLowerCase();

                if (currentGaleriFilter !== 'all' && currentGaleriFilter !== safeCat) return;

                itemsFound++;

                const bgColors = ["bg-amber-500", "bg-purple-600", "bg-blue-600", "bg-rose-500", "bg-emerald-600"];
                const tagColor = bgColors[Math.abs(galeri.kategori.length) % bgColors.length];

                const card = document.createElement('div');
                card.className = "galeri-item relative aspect-video rounded-2xl overflow-hidden shadow-sm group border border-slate-100 dark:border-[#253447] bg-slate-100 dark:bg-[#1c2836]";
                card.innerHTML = `
                    <img src="${galeri.gambar}" alt="${galeri.judul}" class="w-full h-full object-contain group-hover:scale-105 transition duration-500">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-90 md:opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                        <span class="${tagColor} ${tagColor === 'bg-amber-500' ? 'text-brand-dark' : 'text-white'} text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase self-start mb-1 shadow-sm">${galeri.kategori}</span>
                        <h4 class="text-xs font-bold text-white leading-snug">${galeri.judul}</h4>
                        <p class="text-[10px] text-emerald-200 mt-0.5"><i class="fa-solid fa-tag mr-1"></i>${galeri.keterangan || '-'}</p>
                    </div>
                `;
                gridContainer.appendChild(card);
            });

            if (itemsFound === 0) {
                gridContainer.innerHTML = `<div class="col-span-full text-center py-10 text-slate-400 dark:text-slate-500 text-xs bg-slate-50 dark:bg-[#1c2836] rounded-2xl">Tidak ada foto untuk kategori ini.</div>`;
            }
        }

        function filterGaleri(category) {
            currentGaleriFilter = category;
            renderGaleriList();
        }

        // ==================== PUSAT NOTIFIKASI & POP-UP BERANDA ====================
        function escapeHtml(str) {
            if (!str) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        let notifikasiList = [];
        let activeNotifFilter = 'all';
        let currentDetailNotifId = null;

        const NOTIF_READ_IDS_KEY = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.storage && APP_CONFIG.storage.keys && APP_CONFIG.storage.keys.readNotifIds)
            ? APP_CONFIG.storage.keys.readNotifIds
            : 'mubarokah_read_notif_ids';
        const NOTIF_CACHE_KEY = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.storage && APP_CONFIG.storage.keys && APP_CONFIG.storage.keys.cachedNotifikasi)
            ? APP_CONFIG.storage.keys.cachedNotifikasi
            : 'mubarokah_cached_notifikasi';

        function toggleNotifRead(event, id) {
            if (event) {
                event.stopPropagation();
            }
            if (!id) return;
            try {
                let ids = getReadNotifIds();
                const index = ids.indexOf(id);
                if (index > -1) {
                    ids.splice(index, 1);
                    if (typeof showToast === 'function') {
                        showToast('Pengumuman ditandai belum dibaca.');
                    }
                } else {
                    ids.push(id);
                    if (typeof showToast === 'function') {
                        showToast('✅ Pengumuman telah diceklis / dibaca.');
                    }
                }
                localStorage.setItem(NOTIF_READ_IDS_KEY, JSON.stringify(ids));
                updateNotifBadge();
                renderNotifikasiList();
            } catch (e) {
                console.warn('toggleNotifRead error:', e);
            }
        }
        window.toggleNotifRead = toggleNotifRead;

        function getReadNotifIds() {
            try {
                const stored = localStorage.getItem(NOTIF_READ_IDS_KEY);
                return stored ? JSON.parse(stored) : [];
            } catch (e) {
                return [];
            }
        }

        function saveReadNotifId(id) {
            if (!id) return;
            try {
                const ids = getReadNotifIds();
                if (!ids.includes(id)) {
                    ids.push(id);
                    localStorage.setItem(NOTIF_READ_IDS_KEY, JSON.stringify(ids));
                }
                updateNotifBadge();
            } catch (e) {}
        }

        function updateNotifBadge() {
            try {
                const readIds = getReadNotifIds();
                const activeNotifs = notifikasiList.filter(n => (n.status || 'Aktif') === 'Aktif');
                const unreadCount = activeNotifs.filter(n => !readIds.includes(n.id)).length;

                const mobileBadge = document.getElementById('mobile-notif-badge');
                const deskBadge = document.getElementById('desk-notif-badge');
                const pillBadge = document.getElementById('notif-unread-pill');

                [mobileBadge, deskBadge].forEach(badge => {
                    if (badge) {
                        if (unreadCount > 0) {
                            badge.innerText = unreadCount > 9 ? '9+' : unreadCount;
                            badge.classList.remove('hidden');
                        } else {
                            badge.classList.add('hidden');
                        }
                    }
                });

                if (pillBadge) {
                    if (unreadCount > 0) {
                        pillBadge.innerText = unreadCount;
                        pillBadge.classList.remove('hidden');
                    } else {
                        pillBadge.classList.add('hidden');
                    }
                }
            } catch (e) {
                console.warn('updateNotifBadge error:', e);
            }
        }

        async function loadNotifikasi() {
            // 1. Render immediate cached data (Stale-While-Revalidate)
            const cached = localStorage.getItem(NOTIF_CACHE_KEY);
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        const cleanCached = parsed.filter(n => n && n.id && !String(n.id).startsWith('NOTIF_INIT'));
                        if (cleanCached.length > 0) {
                            notifikasiList = cleanCached;
                        }
                    }
                } catch (e) {}
            }
            renderNotifikasiList();
            updateNotifBadge();
            if (notifikasiList.length > 0) {
                checkHomePosterPopup();
            }

            if (typeof isApiConfigured === 'function' && !isApiConfigured()) {
                return;
            }

            // 2. Fetch fresh data from server in background
            try {
                let response = null;
                if (typeof apiGet === 'function') {
                    response = await apiGet('getNotifikasi');
                } else if (typeof API_URL !== 'undefined') {
                    const res = await fetch(`${API_URL}?action=getNotifikasi`);
                    response = await res.json();
                }

                if (response && response.status === 'success' && Array.isArray(response.data)) {
                    notifikasiList = response.data.filter(n => n && n.id && !String(n.id).startsWith('NOTIF_INIT'));
                    try {
                        localStorage.setItem(NOTIF_CACHE_KEY, JSON.stringify(notifikasiList));
                    } catch (e) {}
                    renderNotifikasiList();
                    updateNotifBadge();
                    checkHomePosterPopup();
                }
            } catch (err) {
                console.warn('Gagal memuat notifikasi dari server:', err);
            }
        }

        function setNotifFilter(filter) {
            activeNotifFilter = filter;
            document.querySelectorAll('.notif-chip').forEach(btn => {
                btn.classList.remove('bg-brand-900', 'text-white', 'shadow-sm');
                btn.classList.add('bg-white', 'dark:bg-[#15202d]', 'text-slate-600', 'dark:text-slate-300');
            });

            const activeBtn = document.getElementById(`notif-filter-${filter}`);
            if (activeBtn) {
                activeBtn.classList.remove('bg-white', 'dark:bg-[#15202d]', 'text-slate-600', 'dark:text-slate-300');
                activeBtn.classList.add('bg-brand-900', 'text-white', 'shadow-sm');
            }

            renderNotifikasiList();
        }

        function renderNotifikasiList() {
            const container = document.getElementById('notifikasi-list-container');
            const emptyState = document.getElementById('notifikasi-empty-state');
            if (!container) return;

            const readIds = getReadNotifIds();
            let filtered = notifikasiList.filter(n => (n.status || 'Aktif') === 'Aktif');

            if (activeNotifFilter === 'unread') {
                filtered = filtered.filter(n => !readIds.includes(n.id));
            } else if (activeNotifFilter !== 'all') {
                filtered = filtered.filter(n => (n.kategori || '').toLowerCase() === activeNotifFilter.toLowerCase());
            }

            if (filtered.length === 0) {
                container.innerHTML = '';
                if (emptyState) emptyState.classList.remove('hidden');
                return;
            }

            if (emptyState) emptyState.classList.add('hidden');

            container.innerHTML = filtered.map(item => {
                const isRead = readIds.includes(item.id);
                const unreadDot = !isRead 
                    ? `<span class="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" title="Belum dibaca"></span>`
                    : '';
                const imgThumb = item.gambar 
                    ? `<div class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden shrink-0 border border-slate-100 dark:border-[#253447] bg-slate-100 dark:bg-slate-900">
                         <img src="${escapeHtml(item.gambar)}" alt="${escapeHtml(item.judul)}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" loading="lazy" onerror="this.parentElement.style.display='none'">
                       </div>`
                    : '';

                let badgeBg = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300';
                if (item.kategori === 'Pengumuman') badgeBg = 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300';
                if (item.kategori === 'Pembayaran') badgeBg = 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300';
                if (item.kategori === 'Kegiatan') badgeBg = 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300';

                return `
                    <div onclick="openNotifikasiDetail('${escapeHtml(item.id)}')"
                        class="group bg-white dark:bg-[#15202d] p-4 sm:p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-[#253447] hover:border-emerald-300 dark:hover:border-emerald-500/50 transition duration-200 cursor-pointer flex flex-col gap-3 relative overflow-hidden ${!isRead ? 'ring-1 ring-emerald-500/20 bg-emerald-50/10 dark:bg-emerald-950/10' : ''}">
                        <div class="flex items-start gap-3.5 sm:gap-4">
                            ${imgThumb}
                            <div class="flex-1 min-w-0 space-y-1">
                                <div class="flex items-center justify-between gap-2">
                                    <div class="flex items-center space-x-2">
                                        <span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${badgeBg}">
                                            ${escapeHtml(item.kategori || 'Pengumuman')}
                                        </span>
                                        ${item.is_popup ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"><i class="fa-solid fa-star text-[8px] mr-1"></i>Popup Beranda</span>` : ''}
                                    </div>
                                    <div class="flex items-center space-x-1.5 text-[11px] text-slate-400">
                                        <span>${escapeHtml(item.tanggal || '')}</span>
                                        ${unreadDot}
                                    </div>
                                </div>
                                <h3 class="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition leading-snug">
                                    ${escapeHtml(item.judul)}
                                </h3>
                                <p class="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                                    ${escapeHtml(item.ringkasan || item.isi)}
                                </p>
                            </div>
                        </div>

                        <!-- Action Bar: Ceklis & Buka Detail -->
                        <div class="pt-2 border-t border-slate-100 dark:border-[#253447] flex items-center justify-between gap-2">
                            <button type="button" onclick="toggleNotifRead(event, '${escapeHtml(item.id)}')"
                                class="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition active:scale-95 ${isRead ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : 'bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 dark:bg-[#1c2836] dark:hover:bg-emerald-950/40 dark:text-slate-300 border border-slate-200 dark:border-[#253447]'}"
                                title="${isRead ? 'Klik untuk tandai belum dibaca' : 'Ceklis bahwa pengumuman telah dibaca'}">
                                <i class="fa-solid ${isRead ? 'fa-circle-check text-emerald-600 dark:text-emerald-400 text-xs' : 'fa-circle text-slate-300 dark:text-slate-500 text-xs'}"></i>
                                <span>${isRead ? 'Sudah Dibaca' : 'Ceklis Telah Dibaca'}</span>
                            </button>
                            <div class="flex items-center text-[11px] font-bold text-emerald-600 dark:text-emerald-400 group-hover:translate-x-1 transition duration-200">
                                <span>Baca Warta Lengkap</span>
                                <i class="fa-solid fa-arrow-right text-[9px] ml-1"></i>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function openNotifikasiDetail(id) {
            const notif = notifikasiList.find(n => String(n.id) === String(id));
            if (!notif) return;

            currentDetailNotifId = notif.id;
            saveReadNotifId(notif.id);

            const modal = document.getElementById('notifikasiDetailModal');
            const content = document.getElementById('notifikasiDetailContent');
            const titleEl = document.getElementById('notif-detail-title');
            const bodyEl = document.getElementById('notif-detail-body');
            const dateEl = document.getElementById('notif-detail-date');
            const badgeEl = document.getElementById('notif-detail-badge');
            const imgWrapper = document.getElementById('notif-detail-img-wrapper');
            const imgEl = document.getElementById('notif-detail-img');

            if (titleEl) titleEl.innerText = notif.judul;
            if (bodyEl) bodyEl.innerText = notif.isi || notif.ringkasan || '';
            if (dateEl) dateEl.innerText = notif.tanggal || '';
            if (badgeEl) badgeEl.innerText = notif.kategori || 'Pengumuman';

            if (imgWrapper && imgEl) {
                if (notif.gambar) {
                    imgEl.src = notif.gambar;
                    imgWrapper.classList.remove('hidden');
                } else {
                    imgWrapper.classList.add('hidden');
                }
            }

            if (modal && content) {
                modal.classList.remove('hidden');
                setTimeout(() => {
                    content.classList.remove('scale-95', 'opacity-0');
                    content.classList.add('scale-100', 'opacity-100');
                }, 20);
            }
        }

        function closeNotifikasiDetail() {
            const modal = document.getElementById('notifikasiDetailModal');
            const content = document.getElementById('notifikasiDetailContent');
            if (modal && content) {
                content.classList.remove('scale-100', 'opacity-100');
                content.classList.add('scale-95', 'opacity-0');
                setTimeout(() => {
                    modal.classList.add('hidden');
                    currentDetailNotifId = null;
                }, 250);
            }
        }

        function shareNotifToWA(id) {
            const notifId = id || currentDetailNotifId;
            const notif = notifikasiList.find(n => String(n.id) === String(notifId));
            if (!notif) {
                if (typeof showToast === 'function') showToast('Warta tidak ditemukan.');
                return;
            }

            const shareUrl = `/notifikasi?id=${encodeURIComponent(notif.id)}`;
            const text = `*${notif.judul}*\n\n${notif.ringkasan || (notif.isi ? notif.isi.substring(0, 160) : '')}\n\n_Baca warta resmi selengkapnya di:_ \n${shareUrl}`;
            const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
            window.open(waUrl, '_blank');
        }

        function markAllNotifAsRead() {
            const allIds = notifikasiList.map(n => n.id);
            try {
                localStorage.setItem(NOTIF_READ_IDS_KEY, JSON.stringify(allIds));
            } catch (e) {}
            updateNotifBadge();
            renderNotifikasiList();
            if (typeof showToast === 'function') {
                showToast('Semua notifikasi telah ditandai dibaca.');
            }
        }

        // ==================== POPUP POSTER BERANDA ====================
        let homePosterTimer = null;

        function checkHomePosterPopup(force = false) {
            try {
                // Pastikan berada di tab Beranda (jika tab lain sedang aktif, jangan munculkan)
                const berandaTab = document.getElementById('page-beranda');
                if (berandaTab && berandaTab.classList.contains('hidden') && !force) {
                    return;
                }

                // Cari notifikasi aktif dengan flag is_popup === true
                const popupNotif = notifikasiList.find(n => 
                    (n.status || 'Aktif') === 'Aktif' && 
                    (n.is_popup === true || n.is_popup === 1 || String(n.is_popup) === '1' || String(n.is_popup).toLowerCase() === 'true') &&
                    n.gambar && String(n.gambar).trim() !== ''
                );
                if (!popupNotif) return;

                // Hanya sembunyikan jika user telah MENGEKLIS bahwa pengumuman telah dibaca di halaman Notifikasi
                const readIds = getReadNotifIds();
                if (!force && readIds.includes(popupNotif.id)) {
                    return;
                }

                const modal = document.getElementById('homePosterModal');
                const content = document.getElementById('homePosterContent');
                const imgEl = document.getElementById('home-poster-img');
                const titleEl = document.getElementById('home-poster-title');
                const summaryEl = document.getElementById('home-poster-summary');
                const badgeEl = document.getElementById('home-poster-badge');

                if (titleEl) titleEl.innerText = popupNotif.judul;
                if (summaryEl) summaryEl.innerText = popupNotif.ringkasan || (popupNotif.isi ? popupNotif.isi.substring(0, 150) : '');
                if (badgeEl) badgeEl.innerText = popupNotif.kategori || 'Warta Terkini';
                if (imgEl && popupNotif.gambar) {
                    imgEl.src = popupNotif.gambar;
                }

                if (modal && content) {
                    modal.dataset.notifId = popupNotif.id;

                    // Batalkan timer lama jika ada
                    if (homePosterTimer) clearTimeout(homePosterTimer);

                    // Deteksi apakah Mobile Splash Screen sedang aktif
                    const splash = document.getElementById('mobile-splash-screen');
                    const isSplashActive = splash && window.getComputedStyle(splash).display !== 'none' && !splash.classList.contains('opacity-0');
                    
                    // Jika splash masih aktif di mobile, tunggu hingga splash selesai memudar (2200ms)
                    const displayDelay = isSplashActive ? 2200 : 350;

                    homePosterTimer = setTimeout(() => {
                        // Pastikan masih di tab Beranda saat timeout selesai
                        const curBeranda = document.getElementById('page-beranda');
                        if (curBeranda && curBeranda.classList.contains('hidden') && !force) return;

                        modal.classList.remove('hidden');
                        setTimeout(() => {
                            content.classList.remove('scale-95', 'opacity-0');
                            content.classList.add('scale-100', 'opacity-100');
                        }, 50);
                    }, displayDelay);
                }
            } catch (e) {
                console.warn('checkHomePosterPopup error:', e);
            }
        }

        function closeHomePoster() {
            const modal = document.getElementById('homePosterModal');
            const content = document.getElementById('homePosterContent');
            if (modal && content) {
                content.classList.remove('scale-100', 'opacity-100');
                content.classList.add('scale-95', 'opacity-0');
                setTimeout(() => {
                    modal.classList.add('hidden');
                }, 250);
            }
        }

        function openNotifFromPoster(id) {
            const modal = document.getElementById('homePosterModal');
            const notifId = id || (modal ? modal.dataset.notifId : null);
            closeHomePoster(false); // Jangan blokir permanen sesi jika user hanya ingin membaca warta

            switchTab('notifikasi');
            if (typeof setNotifFilter === 'function') {
                setNotifFilter('Pengumuman');
            }

            if (notifId) {
                setTimeout(() => {
                    openNotifikasiDetail(notifId);
                }, 300);
            }
        }

        window.checkHomePosterPopup = checkHomePosterPopup;
        window.closeHomePoster = closeHomePoster;
        window.openNotifFromPoster = openNotifFromPoster;
