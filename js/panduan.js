/**
 * ==============================================================================
 * PANDUAN PENGGUNAAN APLIKASI MUBAROKAH APP (WALI SANTRI)
 * PPTQ ROUDLOTUL MUBAROKAH
 * ==============================================================================
 * File: js/panduan.js
 * Deskripsi: Mengontrol Modal Panduan Bergambar Wali Santri (tab navigasi,
 *            ganti OS Android/iOS, bagikan via WA, dan integrasi aktivasi).
 */

let currentPanduanStep = 1;
let currentPanduanOs = 'android';

/**
 * Buka modal panduan pada langkah tertentu (default: langkah 1)
 * @param {number} step - Nomor langkah 1 s.d 6
 */
function openPanduanModal(step = 1) {
    const modal = document.getElementById('modal-panduan-wali');
    if (!modal) {
        console.warn('modal-panduan-wali tidak ditemukan');
        return;
    }

    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');

    switchPanduanTab(step);

    // Pasang listener tombol Escape
    document.removeEventListener('keydown', handlePanduanKeydown);
    document.addEventListener('keydown', handlePanduanKeydown);
}

/**
 * Tutup modal panduan
 */
function closePanduanModal() {
    const modal = document.getElementById('modal-panduan-wali');
    if (modal) {
        modal.classList.add('hidden');
    }
    document.body.classList.remove('overflow-hidden');
    document.removeEventListener('keydown', handlePanduanKeydown);
}

/**
 * Keyboard handler untuk Escape
 */
function handlePanduanKeydown(e) {
    if (e.key === 'Escape') {
        closePanduanModal();
    }
}

/**
 * Ganti tab langkah panduan (1..6)
 * @param {number} stepIndex 
 */
function switchPanduanTab(stepIndex) {
    const validStep = Math.max(1, Math.min(6, parseInt(stepIndex) || 1));
    currentPanduanStep = validStep;

    // Sembunyikan seluruh section konten langkah
    for (let i = 1; i <= 6; i++) {
        const contentEl = document.getElementById(`panduan-content-step-${i}`);
        const btnTab = document.getElementById(`panduan-btn-step-${i}`);

        if (contentEl) {
            if (i === validStep) {
                contentEl.classList.remove('hidden');
            } else {
                contentEl.classList.add('hidden');
            }
        }

        if (btnTab) {
            if (i === validStep) {
                btnTab.className = 'px-3 py-1.5 rounded-xl text-xs font-bold transition bg-emerald-600 text-white shadow-sm flex items-center space-x-1.5 cursor-pointer';
                // Scroll tab container jika diperlukan
                btnTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            } else {
                btnTab.className = 'px-3 py-1.5 rounded-xl text-xs font-bold transition bg-white dark:bg-[#172331] text-slate-600 dark:text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-[#1f2f42] flex items-center space-x-1.5 cursor-pointer';
            }
        }
    }

    // Perbarui Tombol Navigasi Bawah (Prev & Next)
    const btnPrev = document.getElementById('panduan-btn-prev');
    const btnNext = document.getElementById('panduan-btn-next');
    const labelStep = document.getElementById('panduan-current-step-label');

    if (labelStep) {
        labelStep.textContent = `Langkah ${validStep} dari 6`;
    }

    if (btnPrev) {
        if (validStep === 1) {
            btnPrev.classList.add('opacity-40', 'cursor-not-allowed');
            btnPrev.classList.remove('cursor-pointer', 'hover:bg-slate-200', 'dark:hover:bg-[#1a2838]');
        } else {
            btnPrev.classList.remove('opacity-40', 'cursor-not-allowed');
            btnPrev.classList.add('cursor-pointer', 'hover:bg-slate-200', 'dark:hover:bg-[#1a2838]');
        }
    }

    if (btnNext) {
        if (validStep === 6) {
            btnNext.innerHTML = `<span>Selesai Membaca ✓</span><i class="fa-solid fa-check text-[10px]"></i>`;
            btnNext.className = 'px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white transition flex items-center space-x-1.5 shadow-sm active:scale-95 cursor-pointer';
        } else {
            btnNext.innerHTML = `<span>Selanjutnya</span><i class="fa-solid fa-chevron-right text-[10px]"></i>`;
            btnNext.className = 'px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center space-x-1.5 shadow-sm active:scale-95 cursor-pointer';
        }
    }

    // Scroll konten modal kembali ke atas
    const modalScrollArea = document.querySelector('#modal-panduan-wali .flex-1.overflow-y-auto');
    if (modalScrollArea) {
        modalScrollArea.scrollTop = 0;
    }
}

/**
 * Navigasi ke langkah berikutnya
 */
function nextPanduanStep() {
    if (currentPanduanStep < 6) {
        switchPanduanTab(currentPanduanStep + 1);
    } else {
        closePanduanModal();
    }
}

/**
 * Navigasi ke langkah sebelumnya
 */
function prevPanduanStep() {
    if (currentPanduanStep > 1) {
        switchPanduanTab(currentPanduanStep - 1);
    }
}

/**
 * Ganti tampilan OS Android vs iOS pada Langkah 2
 * @param {'android'|'ios'} os 
 */
function setPanduanOs(os) {
    currentPanduanOs = os;
    const panelAndroid = document.getElementById('panduan-os-panel-android');
    const panelIos = document.getElementById('panduan-os-panel-ios');
    const btnAndroid = document.getElementById('panduan-os-btn-android');
    const btnIos = document.getElementById('panduan-os-btn-ios');

    if (os === 'android') {
        if (panelAndroid) panelAndroid.classList.remove('hidden');
        if (panelIos) panelIos.classList.add('hidden');

        if (btnAndroid) {
            btnAndroid.className = 'flex-1 py-2 px-3 rounded-xl text-xs font-bold transition bg-emerald-600 text-white shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer';
        }
        if (btnIos) {
            btnIos.className = 'flex-1 py-2 px-3 rounded-xl text-xs font-bold transition text-slate-600 dark:text-slate-300 hover:text-emerald-600 flex items-center justify-center space-x-1.5 cursor-pointer';
        }
    } else {
        if (panelAndroid) panelAndroid.classList.add('hidden');
        if (panelIos) panelIos.classList.remove('hidden');

        if (btnAndroid) {
            btnAndroid.className = 'flex-1 py-2 px-3 rounded-xl text-xs font-bold transition text-slate-600 dark:text-slate-300 hover:text-emerald-600 flex items-center justify-center space-x-1.5 cursor-pointer';
        }
        if (btnIos) {
            btnIos.className = 'flex-1 py-2 px-3 rounded-xl text-xs font-bold transition bg-emerald-600 text-white shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer';
        }
    }
}

/**
 * Bagikan link panduan via WhatsApp
 */
function sharePanduanWA() {
    const text = 
`Assalamu'alaikum Warahmatullahi Wabarakatuh.

Berikut Panduan Resmi Penggunaan Mubarokah App untuk Wali Santri PPTQ Roudlotul Mubarokah:
1. Akses Website: https://mubarokah.my.id
2. Pasang di Layar Utama HP (Android & iPhone)
3. Sinkronisasi Data Santri (NIS & Tanggal Lahir)
4. Verifikasi Kode OTP Keamanan
5. Pantau Mutaba'ah Tahfidz, Presensi Sholat, & Syahriyah SPP

Panduan lengkap bergambar dapat dibuka langsung di aplikasi melalui menu Pengaturan > Panduan Penggunaan.

Syukron Katsir.
Wassalamu'alaikum Warahmatullahi Wabarakatuh.`;

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Pemicu pasang aplikasi PWA
 */
function triggerInstallApp() {
    if (window.deferredPrompt) {
        window.deferredPrompt.prompt();
        window.deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('Pengguna menyetujui instalasi PWA');
            }
            window.deferredPrompt = null;
        });
    } else {
        // Jika browser belum memicu banner otomatis
        alert('Untuk memasang di Android:\n1. Klik tanda Titik Tiga (⋮) di pojok kanan atas Chrome.\n2. Pilih "Tambahkan ke Layar Utama" atau "Instal Aplikasi".');
    }
}

// Global exposure
window.openPanduanModal = openPanduanModal;
window.closePanduanModal = closePanduanModal;
window.switchPanduanTab = switchPanduanTab;
window.nextPanduanStep = nextPanduanStep;
window.prevPanduanStep = prevPanduanStep;
window.setPanduanOs = setPanduanOs;
window.sharePanduanWA = sharePanduanWA;
window.triggerInstallApp = triggerInstallApp;
