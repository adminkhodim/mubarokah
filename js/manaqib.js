/**
 * PPTQ Roudlotul Mubarokah - Modul Pembaca Manaqib Syekh Abdul Qadir Al-Jailani
 * Sumber Bacaan: NU Online (https://quran.nu.or.id/wirid/manaqib-syekh-abdul-qadir)
 * Menampilkan teks Arab murni berharakat lengkap (9 Bab / Fashl) dalam halaman penuh
 */

(function () {
    let currentBabFilter = 'all';
    let arabicFontSize = 24;

    // Load saved font size preference
    try {
        const savedSize = localStorage.getItem('mubarokah_manaqib_font_size');
        if (savedSize) {
            const parsed = parseInt(savedSize, 10);
            if (!isNaN(parsed) && parsed >= 18 && parsed <= 38) {
                arabicFontSize = parsed;
            }
        }
    } catch (e) {}

    function openManaqibPage(updateUrl = true) {
        if (typeof switchTab === 'function') {
            switchTab('manaqib', updateUrl, '/app/ibadah/wirid/manaqib');
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        renderManaqibContent();
    }

    function adjustManaqibFontSize(delta) {
        const newSize = arabicFontSize + delta;
        if (newSize >= 18 && newSize <= 38) {
            arabicFontSize = newSize;
            try {
                localStorage.setItem('mubarokah_manaqib_font_size', arabicFontSize.toString());
            } catch (e) {}
            applyManaqibFontSize();
        }
    }

    function resetManaqibFontSize() {
        arabicFontSize = 24;
        try {
            localStorage.setItem('mubarokah_manaqib_font_size', '24');
        } catch (e) {}
        applyManaqibFontSize();
    }

    function applyManaqibFontSize() {
        const container = document.getElementById('manaqib-content-container');
        if (container) {
            container.style.setProperty('--manaqib-arabic-size', `${arabicFontSize}px`);
        }
        const sizeBadge = document.getElementById('manaqib-font-size-indicator');
        if (sizeBadge) {
            sizeBadge.innerText = `${arabicFontSize}px`;
        }
    }

    function filterManaqibBab(filterVal) {
        currentBabFilter = filterVal;
        
        // Update select dropdown
        const selectEl = document.getElementById('manaqib-bab-select');
        if (selectEl && selectEl.value !== filterVal) {
            selectEl.value = filterVal;
        }

        // Update pill buttons
        document.querySelectorAll('.manaqib-pill-btn').forEach(btn => {
            const val = btn.getAttribute('data-bab');
            if (val === filterVal) {
                btn.className = 'manaqib-pill-btn active px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap bg-rose-600 text-white shadow-sm transition active:scale-95';
            } else {
                btn.className = 'manaqib-pill-btn px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap bg-slate-100 dark:bg-[#1c2836] text-slate-600 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 transition active:scale-95';
            }
        });

        renderManaqibContent();

        // Smooth scroll to top of reading area
        const readingArea = document.getElementById('manaqib-reading-area');
        if (readingArea) {
            readingArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function renderManaqibContent() {
        const container = document.getElementById('manaqib-content-container');
        if (!container) return;

        const data = window.dataManaqib || [];
        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="p-8 text-center bg-white dark:bg-[#15202d] rounded-2xl border border-slate-100 dark:border-[#253447] text-slate-500">
                    <i class="fa-solid fa-spinner fa-spin text-2xl text-rose-600 mb-2"></i>
                    <p class="text-sm font-semibold">Memuat teks Manaqib Syekh Abdul Qadir Al-Jailani...</p>
                </div>
            `;
            return;
        }

        applyManaqibFontSize();

        const chaptersToRender = currentBabFilter === 'all' 
            ? data 
            : data.filter(d => d.id.toString() === currentBabFilter.toString());

        if (chaptersToRender.length === 0) {
            container.innerHTML = `
                <div class="p-8 text-center bg-white dark:bg-[#15202d] rounded-2xl border border-slate-100 dark:border-[#253447] text-slate-500">
                    <p class="text-sm font-semibold">Bab yang dipilih tidak ditemukan.</p>
                </div>
            `;
            return;
        }

        let html = '';

        chaptersToRender.forEach((chapter) => {
            const isQasidah = (chapter.id === 9);
            const isDoa = (chapter.id === 8);

            html += `
                <article id="manaqib-chapter-${chapter.id}" class="space-y-4 mb-8">
                    <!-- Chapter Header Card -->
                    <div class="relative overflow-hidden bg-gradient-to-r from-rose-900/90 via-slate-900/95 to-rose-950/90 text-white p-4 sm:p-6 rounded-2xl shadow-sm border border-rose-800/40">
                        <div class="absolute -right-4 -bottom-6 text-white/5 text-8xl font-arabic pointer-events-none select-none">
                            ${chapter.arabicTitle.split(' ')[0] || 'مناقب'}
                        </div>
                        <div class="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div class="space-y-1">
                                <div class="flex items-center space-x-2">
                                    <span class="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-rose-500/30 text-rose-200 border border-rose-400/30">
                                        ${isQasidah ? 'Bait Tawassul' : isDoa ? 'Doa Munajat' : `Bab ke-${chapter.babNumber}`}
                                    </span>
                                    <span class="text-[11px] text-slate-300">
                                        ${chapter.paragraphs.length} ${isQasidah ? 'Bait' : 'Paragraf'} Teks Arab
                                    </span>
                                </div>
                                <h3 class="text-base sm:text-lg font-bold text-white tracking-wide">
                                    ${chapter.title}
                                </h3>
                                <p class="text-xs text-rose-200/90 italic">
                                    ${chapter.subtitle}
                                </p>
                            </div>
                            <div class="text-right sm:text-left self-end sm:self-center">
                                <span class="font-arabic text-xl sm:text-2xl font-bold text-rose-200 block" dir="rtl">
                                    ${chapter.arabicTitle}
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Chapter Paragraphs Container (Pure Arabic Text Only) -->
                    <div class="space-y-3 sm:space-y-4">
            `;

            chapter.paragraphs.forEach((pText, pIdx) => {
                // Bab 9 (Qasidah Tawassul 'Ibadallah): Tampilkan dengan estetika syi'ir Islami
                if (isQasidah) {
                    const lines = pText.split('\n').map(l => l.trim()).filter(Boolean);
                    html += `
                        <div class="manaqib-para-card group p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#15202d] border border-slate-200/80 dark:border-[#253447] shadow-sm hover:border-rose-400/60 dark:hover:border-rose-800/60 hover:shadow-md transition-all">
                            <div class="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-[#253447]/60">
                                <span class="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-md">
                                    Bait ${pIdx + 1}
                                </span>
                                <button type="button" onclick="copyManaqibParagraph(this)" data-text="${encodeURIComponent(pText)}" title="Salin Bait Ini"
                                    class="text-xs text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition p-1">
                                    <i class="fa-regular fa-copy"></i>
                                </button>
                            </div>
                            <div class="text-center space-y-2 py-1">
                                ${lines.map(line => {
                                    // Berikan highlight emas/rose untuk pemisah bait ۞
                                    const formattedLine = line.replace(/۞/g, '<span class="text-amber-500 dark:text-amber-400 font-bold px-2">۞</span>');
                                    return `
                                        <p class="font-arabic text-right sm:text-center text-slate-900 dark:text-slate-100 tracking-wide"
                                            style="font-size: var(--manaqib-arabic-size, 24px); line-height: 2.3; word-spacing: 2px;"
                                            dir="rtl">
                                            ${formattedLine}
                                        </p>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    `;
                } else {
                    // Paragraf prosa Arab biasa (Bab 1 - 8)
                    // Deteksi jika paragraf adalah judul kecil seperti "اللجين الداني" atau "الباب الأول"
                    const isShortHeader = pText.trim().length < 35 && !pText.includes('بِسْمِ اللهِ') && !pText.includes('اَللّٰهُمَّ');
                    
                    if (isShortHeader) {
                        html += `
                            <div class="text-center py-2">
                                <span class="inline-block px-4 py-1.5 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-900/40 font-arabic text-rose-700 dark:text-rose-300 font-bold text-lg sm:text-xl" dir="rtl">
                                    ${pText}
                                </span>
                            </div>
                        `;
                    } else {
                        html += `
                            <div class="manaqib-para-card group p-4 sm:p-6 rounded-2xl bg-white dark:bg-[#15202d] border border-slate-200/80 dark:border-[#253447] shadow-sm hover:border-rose-400/60 dark:hover:border-rose-800/60 hover:shadow-md transition-all">
                                <div class="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100 dark:border-[#253447]/60">
                                    <span class="inline-flex items-center gap-1.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2.5 py-0.5 rounded-md">
                                        <i class="fa-solid fa-feather text-[9px]"></i> Paragraf ${pIdx + 1}
                                    </span>
                                    <button type="button" onclick="copyManaqibParagraph(this)" data-text="${encodeURIComponent(pText)}" title="Salin Paragraf Ini"
                                        class="text-xs text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition p-1">
                                        <i class="fa-regular fa-copy"></i>
                                    </button>
                                </div>
                                <p class="font-arabic text-right text-slate-900 dark:text-slate-100 tracking-wide select-text"
                                    style="font-size: var(--manaqib-arabic-size, 24px); line-height: 2.4; word-spacing: 2px;"
                                    dir="rtl">
                                    ${pText}
                                </p>
                            </div>
                        `;
                    }
                }
            });

            html += `
                    </div>
                </article>
            `;
        });

        container.innerHTML = html;
    }

    function copyManaqibParagraph(btn) {
        try {
            const raw = btn.getAttribute('data-text');
            if (!raw) return;
            const text = decodeURIComponent(raw);
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(() => {
                    showManaqibToast('Teks Arab berhasil disalin ke clipboard');
                }).catch(() => {
                    fallbackCopyManaqib(text);
                });
            } else {
                fallbackCopyManaqib(text);
            }
        } catch (e) {
            console.error('Gagal menyalin:', e);
        }
    }

    function fallbackCopyManaqib(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showManaqibToast('Teks Arab berhasil disalin');
    }

    function showManaqibToast(msg) {
        const existing = document.getElementById('manaqib-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'manaqib-toast';
        toast.className = 'fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg border border-slate-700 backdrop-blur flex items-center gap-2 animate-fade-in';
        toast.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-400"></i> <span>${msg}</span>`;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.transition = 'opacity 0.3s ease';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 2200);
    }

    // Expose to window global
    window.openManaqibPage = openManaqibPage;
    window.renderManaqibContent = renderManaqibContent;
    window.adjustManaqibFontSize = adjustManaqibFontSize;
    window.resetManaqibFontSize = resetManaqibFontSize;
    window.filterManaqibBab = filterManaqibBab;
    window.copyManaqibParagraph = copyManaqibParagraph;

    // Auto-init on page load if direct URL
    document.addEventListener('DOMContentLoaded', () => {
        applyManaqibFontSize();
    });
})();
