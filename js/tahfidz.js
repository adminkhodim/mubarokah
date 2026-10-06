const TAHFIDZ_STORAGE_KEYS = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.storage && APP_CONFIG.storage.keys)
    ? APP_CONFIG.storage.keys
    : {
        adminToken: 'mubarokah_admin_token',
        parentToken: 'mubarokah_parent_token',
        pengasuhToken: 'mubarokah_pengasuh_token'
    };
/**
 * ====================================================================
 * MODUL FRONTEND: TAHFIDZ AL-QUR'AN (PPTQ MUBAROKAH)
 * State Management, Mutaba'ah, Rekapitulasi, & Integrasi API Standar Pesantren Modern
 * ====================================================================
 * Fitur:
 * 1. Multi-role: Admin/Musyrif (Kelola), Wali Santri (Pantau Anak), Pengasuh (Makro)
 * 2. Standar Mushaf Pojok: 20 Halaman per Juz, 2 Halaman per Lembar
 * 3. Pemilih Halaman Interaktif (Halaman 1 - 20) dengan Quick Chips
 * 4. Mutaba'ah 3 Indikator (Target vs Realita: Harian, Pekanan, Bulanan)
 * 5. Manajemen Halaqah & Plotting Santri
 */

// Global State Tahfidz
const ASNTahfidz = {
    data: {
        summary: {
            khatam30Juz: 0,
            rataRataHafalan: "0.0 Juz / Santri",
            totalHafalanJuz: 0,
            aktivitasPekanIni: { ziyadahPercent: 100, murajaahPercent: 0, totalSetoranPekanIni: 0 }
        },
        students: [],
        categories: ["Semua Kategori", "Tahfidz Anak", "Tahfidz Dewasa", "Kitab Kuning", "Reguler"],
        halaqahs: [],
        muhafizList: []
    },
    filteredStudents: [],
    activeStudentDetail: null,
    cache: null,
    catatState: {
        studentId: "",
        juz: 1,
        tipe: "ZIYADAH", // ZIYADAH, MURAJAAH, TASMI
        selectedPages: [1],
        sesi: "Pagi (Ba'da Subuh)",
        nilai: "MUMTAZ"
    },
    targetState: {
        studentId: "",
        ziyadahSesi: 1,
        ziyadahPekan: 10,
        murajaahSesi: 2,
        murajaahPekan: 10
    },
    selectedStudentIds: new Set(),
    bulkTargetState: {
        scope: 'ALL',
        halaqahId: '',
        kategori: '',
        studentIds: []
    },
    halaqahActiveTab: 1,
    detailActiveTab: 1,
    detailFilterTipe: "ALL"
};

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
if (typeof window !== 'undefined' && typeof window.escapeHtml !== 'function') {
    window.escapeHtml = escapeHtml;
}

const TAHFIDZ_CACHE_KEY = 'mubarokah_tahfidz_dashboard_cache';
const TAHFIDZ_CACHE_TTL_MS = 5 * 60 * 1000; // 5 menit
const TAHFIDZ_PRESENSI_STORAGE_KEY = 'mubarokah_tahfidz_presensi_cache';
let _tahfidzPresensiMemoryCache = null;

function getTahfidzPresensiRecords() {
    if (_tahfidzPresensiMemoryCache !== null) {
        return _tahfidzPresensiMemoryCache;
    }
    try {
        const raw = localStorage.getItem(TAHFIDZ_PRESENSI_STORAGE_KEY);
        _tahfidzPresensiMemoryCache = raw ? JSON.parse(raw) : {};
        return _tahfidzPresensiMemoryCache;
    } catch (e) {
        _tahfidzPresensiMemoryCache = {};
        return _tahfidzPresensiMemoryCache;
    }
}

function saveTahfidzPresensiRecords(records) {
    _tahfidzPresensiMemoryCache = records || {};
    try {
        localStorage.setItem(TAHFIDZ_PRESENSI_STORAGE_KEY, JSON.stringify(records));
    } catch (e) {
        console.error('Error saving presensi records:', e);
    }
}

function getStudentPresensiStatus(studentOrId) {
    const id = typeof studentOrId === 'object' ? (studentOrId.studentId || studentOrId.nis) : studentOrId;
    if (!id) return 'HADIR';
    const records = getTahfidzPresensiRecords();
    if (records && records[id]) {
        return records[id].status || 'HADIR';
    }
    if (typeof studentOrId === 'object' && studentOrId.presensiStatus) {
        return studentOrId.presensiStatus;
    }
    return 'HADIR';
}

function getStudentPresensiData(studentOrId) {
    const id = typeof studentOrId === 'object' ? (studentOrId.studentId || studentOrId.nis) : studentOrId;
    if (!id) return null;
    const records = getTahfidzPresensiRecords();
    return (records && records[id]) ? records[id] : null;
}

/**
 * Helper untuk mengatur status loading visual (icon spinner berputar + teks) pada tombol simpan/aksi
 */
function setTahfidzButtonLoading(btnOrId, isLoading, loadingText = "Menyimpan...", defaultText = "") {
    if (typeof window.setButtonLoading === 'function') {
        return window.setButtonLoading(btnOrId, isLoading, loadingText, defaultText);
    }
    const btn = typeof btnOrId === 'string' ? document.getElementById(btnOrId) : btnOrId;
    if (!btn) return;

    if (isLoading) {
        if (!btn.dataset.originalHtml) {
            btn.dataset.originalHtml = btn.innerHTML;
        }
        btn.disabled = true;
        btn.classList.add('opacity-75', 'cursor-not-allowed');
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1.5"></i><span>${escapeHtml(loadingText)}</span>`;
    } else {
        btn.disabled = false;
        btn.classList.remove('opacity-75', 'cursor-not-allowed');
        if (defaultText) {
            btn.innerHTML = defaultText;
        } else if (btn.dataset.originalHtml) {
            btn.innerHTML = btn.dataset.originalHtml;
            delete btn.dataset.originalHtml;
        }
    }
}

// Referensi Surah Awal per Juz untuk Standar Mushaf 30 Juz
const SURAH_JUZ_REFERENCE = {
    1: "Al-Fatihah - Al-Baqarah 141",
    2: "Al-Baqarah 142 - 252",
    3: "Al-Baqarah 253 - Ali 'Imran 92",
    4: "Ali 'Imran 93 - An-Nisa' 23",
    5: "An-Nisa' 24 - 147",
    6: "An-Nisa' 148 - Al-Ma'idah 81",
    7: "Al-Ma'idah 82 - Al-An'am 110",
    8: "Al-An'am 111 - Al-A'raf 87",
    9: "Al-A'raf 88 - Al-Anfal 40",
    10: "Al-Anfal 41 - At-Taubah 92",
    11: "At-Taubah 93 - Hud 5",
    12: "Hud 6 - Yusuf 52",
    13: "Yusuf 53 - Ibrahim 52",
    14: "Al-Hijr 1 - An-Nahl 128",
    15: "Al-Isra' 1 - Al-Kahf 74",
    16: "Al-Kahf 75 - Ta-Ha 135",
    17: "Al-Anbiya' 1 - Al-Hajj 78",
    18: "Al-Mu'minun 1 - Al-Furqan 20",
    19: "Al-Furqan 21 - An-Naml 55",
    20: "An-Naml 56 - Al-'Ankabut 45",
    21: "Al-'Ankabut 46 - Al-Ahzab 30",
    22: "Al-Ahzab 31 - Ya-Sin 27",
    23: "Ya-Sin 28 - Az-Zumar 31",
    24: "Az-Zumar 32 - Fussilat 46",
    25: "Fussilat 47 - Al-Jatsiyah 37",
    26: "Al-Ahqaf 1 - Adz-Dzariyat 30",
    27: "Adz-Dzariyat 31 - Al-Hadid 29",
    28: "Al-Mujadilah 1 - At-Tahrim 12",
    29: "Al-Mulk 1 - Al-Mursalat 50",
    30: "An-Naba' 1 - An-Nas 6 (Juz 'Amma)"
};

// Urutan Kurikulum Tahfidz Pesantren: Juz 30, kemudian Juz 1 s/d 29 (Khatam di Juz 29 Hlm 20)
const JUZ_CURRICULUM_ORDER = [
    30,
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    21, 22, 23, 24, 25, 26, 27, 28, 29
];

// Metadata Lengkap 114 Surah Al-Qur'an (Jumlah Ayat, Halaman Standar Mushaf Pojok, & Pemetaan Juz)
const QURAN_114_SURAHS = [
    { no: 1, name: "Al-Fatihah", ayat: 7, startPage: 1, endPage: 1, juz: [1] },
    { no: 2, name: "Al-Baqarah", ayat: 286, startPage: 2, endPage: 49, juz: [1, 2, 3] },
    { no: 3, name: "Ali 'Imran", ayat: 200, startPage: 50, endPage: 76, juz: [3, 4] },
    { no: 4, name: "An-Nisa'", ayat: 176, startPage: 77, endPage: 106, juz: [4, 5, 6] },
    { no: 5, name: "Al-Ma'idah", ayat: 120, startPage: 106, endPage: 127, juz: [6, 7] },
    { no: 6, name: "Al-An'am", ayat: 165, startPage: 128, endPage: 150, juz: [7, 8] },
    { no: 7, name: "Al-A'raf", ayat: 206, startPage: 151, endPage: 176, juz: [8, 9] },
    { no: 8, name: "Al-Anfal", ayat: 75, startPage: 177, endPage: 186, juz: [9, 10] },
    { no: 9, name: "At-Taubah", ayat: 129, startPage: 187, endPage: 207, juz: [10, 11] },
    { no: 10, name: "Yunus", ayat: 109, startPage: 208, endPage: 221, juz: [11] },
    { no: 11, name: "Hud", ayat: 123, startPage: 221, endPage: 235, juz: [11, 12] },
    { no: 12, name: "Yusuf", ayat: 111, startPage: 235, endPage: 248, juz: [12, 13] },
    { no: 13, name: "Ar-Ra'd", ayat: 43, startPage: 249, endPage: 255, juz: [13] },
    { no: 14, name: "Ibrahim", ayat: 52, startPage: 255, endPage: 261, juz: [13] },
    { no: 15, name: "Al-Hijr", ayat: 99, startPage: 262, endPage: 267, juz: [14] },
    { no: 16, name: "An-Nahl", ayat: 128, startPage: 267, endPage: 281, juz: [14] },
    { no: 17, name: "Al-Isra'", ayat: 111, startPage: 282, endPage: 293, juz: [15] },
    { no: 18, name: "Al-Kahf", ayat: 110, startPage: 293, endPage: 304, juz: [15, 16] },
    { no: 19, name: "Maryam", ayat: 98, startPage: 305, endPage: 312, juz: [16] },
    { no: 20, name: "Ta-Ha", ayat: 135, startPage: 312, endPage: 321, juz: [16] },
    { no: 21, name: "Al-Anbiya'", ayat: 112, startPage: 322, endPage: 331, juz: [17] },
    { no: 22, name: "Al-Hajj", ayat: 78, startPage: 332, endPage: 341, juz: [17] },
    { no: 23, name: "Al-Mu'minun", ayat: 118, startPage: 342, endPage: 349, juz: [18] },
    { no: 24, name: "An-Nur", ayat: 64, startPage: 350, endPage: 359, juz: [18] },
    { no: 25, name: "Al-Furqan", ayat: 77, startPage: 359, endPage: 366, juz: [18, 19] },
    { no: 26, name: "Asy-Syu'ara'", ayat: 227, startPage: 367, endPage: 376, juz: [19] },
    { no: 27, name: "An-Naml", ayat: 93, startPage: 377, endPage: 385, juz: [19, 20] },
    { no: 28, name: "Al-Qashash", ayat: 88, startPage: 385, endPage: 396, juz: [20] },
    { no: 29, name: "Al-'Ankabut", ayat: 69, startPage: 396, endPage: 404, juz: [20, 21] },
    { no: 30, name: "Ar-Rum", ayat: 60, startPage: 404, endPage: 410, juz: [21] },
    { no: 31, name: "Luqman", ayat: 34, startPage: 411, endPage: 414, juz: [21] },
    { no: 32, name: "As-Sajdah", ayat: 30, startPage: 415, endPage: 417, juz: [21] },
    { no: 33, name: "Al-Ahzab", ayat: 73, startPage: 418, endPage: 427, juz: [21, 22] },
    { no: 34, name: "Saba'", ayat: 54, startPage: 428, endPage: 434, juz: [22] },
    { no: 35, name: "Fathir", ayat: 45, startPage: 434, endPage: 440, juz: [22] },
    { no: 36, name: "Ya-Sin", ayat: 83, startPage: 440, endPage: 445, juz: [22, 23] },
    { no: 37, name: "Ash-Shaffat", ayat: 182, startPage: 446, endPage: 452, juz: [23] },
    { no: 38, name: "Shad", ayat: 88, startPage: 453, endPage: 458, juz: [23] },
    { no: 39, name: "Az-Zumar", ayat: 75, startPage: 458, endPage: 467, juz: [23, 24] },
    { no: 40, name: "Ghafir", ayat: 85, startPage: 467, endPage: 476, juz: [24] },
    { no: 41, name: "Fushshilat", ayat: 54, startPage: 477, endPage: 482, juz: [24, 25] },
    { no: 42, name: "Asy-Syura", ayat: 53, startPage: 483, endPage: 489, juz: [25] },
    { no: 43, name: "Az-Zukhruf", ayat: 89, startPage: 489, endPage: 495, juz: [25] },
    { no: 44, name: "Ad-Dukhan", ayat: 59, startPage: 496, endPage: 498, juz: [25] },
    { no: 45, name: "Al-Jatsiyah", ayat: 37, startPage: 499, endPage: 502, juz: [25] },
    { no: 46, name: "Al-Ahqaf", ayat: 35, startPage: 502, endPage: 506, juz: [26] },
    { no: 47, name: "Muhammad", ayat: 38, startPage: 507, endPage: 510, juz: [26] },
    { no: 48, name: "Al-Fath", ayat: 29, startPage: 511, endPage: 515, juz: [26] },
    { no: 49, name: "Al-Hujurat", ayat: 18, startPage: 515, endPage: 517, juz: [26] },
    { no: 50, name: "Qaf", ayat: 45, startPage: 518, endPage: 520, juz: [26] },
    { no: 51, name: "Adz-Dzariyat", ayat: 60, startPage: 520, endPage: 523, juz: [26, 27] },
    { no: 52, name: "Ath-Thur", ayat: 49, startPage: 523, endPage: 525, juz: [27] },
    { no: 53, name: "An-Najm", ayat: 62, startPage: 526, endPage: 528, juz: [27] },
    { no: 54, name: "Al-Qamar", ayat: 55, startPage: 528, endPage: 531, juz: [27] },
    { no: 55, name: "Ar-Rahman", ayat: 78, startPage: 531, endPage: 534, juz: [27] },
    { no: 56, name: "Al-Waqi'ah", ayat: 96, startPage: 534, endPage: 537, juz: [27] },
    { no: 57, name: "Al-Hadid", ayat: 29, startPage: 537, endPage: 541, juz: [27] },
    { no: 58, name: "Al-Mujadilah", ayat: 22, startPage: 542, endPage: 545, juz: [28] },
    { no: 59, name: "Al-Hasyr", ayat: 24, startPage: 545, endPage: 548, juz: [28] },
    { no: 60, name: "Al-Mumtahanah", ayat: 13, startPage: 549, endPage: 551, juz: [28] },
    { no: 61, name: "Ash-Shaff", ayat: 14, startPage: 551, endPage: 552, juz: [28] },
    { no: 62, name: "Al-Jumu'ah", ayat: 11, startPage: 553, endPage: 554, juz: [28] },
    { no: 63, name: "Al-Munafiqun", ayat: 11, startPage: 554, endPage: 555, juz: [28] },
    { no: 64, name: "At-Taghabun", ayat: 18, startPage: 556, endPage: 557, juz: [28] },
    { no: 65, name: "Ath-Thalaq", ayat: 12, startPage: 558, endPage: 559, juz: [28] },
    { no: 66, name: "At-Tahrim", ayat: 12, startPage: 560, endPage: 561, juz: [28] },
    { no: 67, name: "Al-Mulk", ayat: 30, startPage: 562, endPage: 564, juz: [29] },
    { no: 68, name: "Al-Qalam", ayat: 52, startPage: 564, endPage: 566, juz: [29] },
    { no: 69, name: "Al-Haqqah", ayat: 52, startPage: 566, endPage: 568, juz: [29] },
    { no: 70, name: "Al-Ma'arij", ayat: 44, startPage: 568, endPage: 570, juz: [29] },
    { no: 71, name: "Nuh", ayat: 28, startPage: 570, endPage: 571, juz: [29] },
    { no: 72, name: "Al-Jinn", ayat: 28, startPage: 572, endPage: 573, juz: [29] },
    { no: 73, name: "Al-Muzzammil", ayat: 20, startPage: 574, endPage: 575, juz: [29] },
    { no: 74, name: "Al-Muddatstsir", ayat: 56, startPage: 575, endPage: 577, juz: [29] },
    { no: 75, name: "Al-Qiyamah", ayat: 40, startPage: 577, endPage: 578, juz: [29] },
    { no: 76, name: "Al-Insan", ayat: 31, startPage: 578, endPage: 580, juz: [29] },
    { no: 77, name: "Al-Mursalat", ayat: 50, startPage: 580, endPage: 581, juz: [29] },
    { no: 78, name: "An-Naba'", ayat: 40, startPage: 582, endPage: 583, juz: [30] },
    { no: 79, name: "An-Nazi'at", ayat: 46, startPage: 583, endPage: 584, juz: [30] },
    { no: 80, name: "'Abasa", ayat: 42, startPage: 585, endPage: 586, juz: [30] },
    { no: 81, name: "At-Takwir", ayat: 29, startPage: 586, endPage: 586, juz: [30] },
    { no: 82, name: "Al-Infithar", ayat: 19, startPage: 587, endPage: 587, juz: [30] },
    { no: 83, name: "Al-Muthaffifin", ayat: 36, startPage: 587, endPage: 589, juz: [30] },
    { no: 84, name: "Al-Insyiqaq", ayat: 25, startPage: 589, endPage: 590, juz: [30] },
    { no: 85, name: "Al-Buruj", ayat: 22, startPage: 590, endPage: 590, juz: [30] },
    { no: 86, name: "Ath-Thariq", ayat: 17, startPage: 591, endPage: 591, juz: [30] },
    { no: 87, name: "Al-A'la", ayat: 19, startPage: 591, endPage: 592, juz: [30] },
    { no: 88, name: "Al-Ghasyiyah", ayat: 26, startPage: 592, endPage: 593, juz: [30] },
    { no: 89, name: "Al-Fajr", ayat: 30, startPage: 593, endPage: 594, juz: [30] },
    { no: 90, name: "Al-Balad", ayat: 20, startPage: 594, endPage: 595, juz: [30] },
    { no: 91, name: "Asy-Syams", ayat: 15, startPage: 595, endPage: 595, juz: [30] },
    { no: 92, name: "Al-Lail", ayat: 21, startPage: 595, endPage: 596, juz: [30] },
    { no: 93, name: "Adh-Dhuha", ayat: 11, startPage: 596, endPage: 596, juz: [30] },
    { no: 94, name: "Asy-Syarh", ayat: 8, startPage: 596, endPage: 597, juz: [30] },
    { no: 95, name: "At-Tin", ayat: 8, startPage: 597, endPage: 597, juz: [30] },
    { no: 96, name: "Al-'Alaq", ayat: 19, startPage: 597, endPage: 598, juz: [30] },
    { no: 97, name: "Al-Qadr", ayat: 5, startPage: 598, endPage: 598, juz: [30] },
    { no: 98, name: "Al-Bayyinah", ayat: 8, startPage: 598, endPage: 599, juz: [30] },
    { no: 99, name: "Az-Zalzalah", ayat: 8, startPage: 599, endPage: 599, juz: [30] },
    { no: 100, name: "Al-'Adiyat", ayat: 11, startPage: 599, endPage: 600, juz: [30] },
    { no: 101, name: "Al-Qari'ah", ayat: 11, startPage: 600, endPage: 600, juz: [30] },
    { no: 102, name: "At-Takatsur", ayat: 8, startPage: 600, endPage: 600, juz: [30] },
    { no: 103, name: "Al-'Ashr", ayat: 3, startPage: 601, endPage: 601, juz: [30] },
    { no: 104, name: "Al-Humazah", ayat: 9, startPage: 601, endPage: 601, juz: [30] },
    { no: 105, name: "Al-Fil", ayat: 5, startPage: 601, endPage: 601, juz: [30] },
    { no: 106, name: "Quraisy", ayat: 4, startPage: 602, endPage: 602, juz: [30] },
    { no: 107, name: "Al-Ma'un", ayat: 7, startPage: 602, endPage: 602, juz: [30] },
    { no: 108, name: "Al-Kautsar", ayat: 3, startPage: 602, endPage: 602, juz: [30] },
    { no: 109, name: "Al-Kafirun", ayat: 6, startPage: 603, endPage: 603, juz: [30] },
    { no: 110, name: "An-Nashr", ayat: 3, startPage: 603, endPage: 603, juz: [30] },
    { no: 111, name: "Al-Lahab", ayat: 5, startPage: 603, endPage: 603, juz: [30] },
    { no: 112, name: "Al-Ikhlas", ayat: 4, startPage: 604, endPage: 604, juz: [30] },
    { no: 113, name: "Al-Falaq", ayat: 5, startPage: 604, endPage: 604, juz: [30] },
    { no: 114, name: "An-Nas", ayat: 6, startPage: 604, endPage: 604, juz: [30] }
];

/**
 * Mendapatkan indeks urutan rank kurikulum tahfidz (0 = Juz 30 ... 29 = Juz 20)
 */
function getJuzCurriculumIndex(juz) {
    const idx = JUZ_CURRICULUM_ORDER.indexOf(Number(juz));
    return idx !== -1 ? idx : 0;
}

/**
 * Helper untuk mem-parsing halaman terakhir santri secara aman (mencegah overflow akibat format "1, 2, 3..20")
 */
function parseTahfidzLatestPage(halVal) {
    if (halVal === null || halVal === undefined || halVal === '') return 1;
    if (typeof halVal === 'number' && !isNaN(halVal)) {
        return Math.min(20, Math.max(1, Math.round(halVal)));
    }
    const str = String(halVal).trim();
    const matches = str.match(/\d+/g);
    if (!matches || matches.length === 0) return 1;
    const max = Math.max(...matches.map(n => Number(n)).filter(n => !isNaN(n)));
    return Math.min(20, Math.max(1, max));
}

/**
 * Menghitung capaian kumulatif tuntas (halaman) & persentase berbasis kurikulum
 */
function getCurriculumProgress(juz, hal) {
    const r = getJuzCurriculumIndex(juz);
    const h = parseTahfidzLatestPage(hal);
    const totalTuntas = r * 20 + h;
    const isKhatam = (Number(juz) === 29 && h >= 20) || totalTuntas >= 600;
    const percent = isKhatam ? 100 : Math.min(100, Math.max(1, Math.round((totalTuntas / 600) * 100)));
    return { rank: r, totalTuntas, percent, isKhatam };
}

/**
 * Helper Terpadu KPI Tahfidz:
 * Menghitung Capaian Juz Sekarang, Jumlah Juz Disetor, dan Estimasi Khatam
 * Digunakan secara konsisten baik di Kartu Ringkasan Santri (luar) maupun di Buku Mutaba'ah Lengkap (dalam).
 */
function calculateTahfidzMetricsHelper(options = {}) {
    const currentJuz = Number(options.currentJuz || 1);
    const currentHal = Number(options.currentHal || 1);
    const stats = options.stats || {};
    const riwayat = options.riwayat || [];
    const target = options.target || {};

    // 1. Capaian Juz Sekarang
    const curProg = getCurriculumProgress(currentJuz, currentHal);
    const percent = stats.progressPercent || curProg.percent;

    // 2. Total Juz Kurikulum yang Ditempuh (Opsi 1: Menampilkan total juz yang sudah dilewati sesuai kurikulum)
    const curriculumJuzIndex = Number(stats.curriculumJuzIndex) || (curProg.rank + 1);
    const jumlahJuzDisetorText = `${curriculumJuzIndex} Juz`;
    const ziyadahLogs = riwayat.filter(r => (r.tipe || '').toUpperCase() === 'ZIYADAH' && r.statusSetoran !== 'ULANG');

    // 3. Estimasi Khatam (Bulan & Tahun)
    let halamanTuntas = stats.totalHalamanTuntas || curProg.totalTuntas;
    if (ziyadahLogs.length > 0) {
        let maxRankZiyadah = -1;
        let maxHlmZiyadah = 1;
        ziyadahLogs.forEach(log => {
            const j = Number(log.juz || 1);
            const rk = getJuzCurriculumIndex(j);
            const h = parseTahfidzLatestPage(log.halamanList);
            if (rk > maxRankZiyadah || (rk === maxRankZiyadah && h > maxHlmZiyadah)) {
                maxRankZiyadah = rk;
                maxHlmZiyadah = h;
            }
        });
        const calcFromLogs = maxRankZiyadah * 20 + maxHlmZiyadah;
        if (calcFromLogs > halamanTuntas) {
            halamanTuntas = calcFromLogs;
        }
    }

    if (halamanTuntas > 600) halamanTuntas = 600;
    const sisaHalaman = Math.max(0, 600 - halamanTuntas);

    let lajuPekanRiil = 0;
    if (ziyadahLogs.length >= 2) {
        const sortedLogs = [...ziyadahLogs].sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
        const firstDate = new Date(sortedLogs[0].tanggal);
        const lastDate = new Date(sortedLogs[sortedLogs.length - 1].tanggal);
        const diffDays = Math.max(1, Math.round((lastDate - firstDate) / (1000 * 60 * 60 * 24)));
        const totalHlm = sortedLogs.reduce((sum, item) => sum + (Number(item.totalHalaman) || 1), 0);

        if (diffDays >= 7) {
            lajuPekanRiil = (totalHlm / (diffDays / 7));
        } else {
            lajuPekanRiil = totalHlm;
        }
    } else if (ziyadahLogs.length === 1) {
        lajuPekanRiil = Number(ziyadahLogs[0].totalHalaman) || 2;
    }

    const targetSantriPekan = Number(target.ziyadahPekan) || 4;
    let lajuEfektif = (lajuPekanRiil >= 0.5) ? lajuPekanRiil : targetSantriPekan;
    lajuEfektif = Math.max(0.5, lajuEfektif);

    const namaBulanIndo = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];

    let estimasiKhatamText = "";
    let estimasiSubText = "";

    if (sisaHalaman <= 0) {
        estimasiKhatamText = "Khatam 30 Juz 🏆";
        estimasiSubText = "Tuntas 600 Halaman";
    } else {
        const safeRate = Math.max(0.5, lajuEfektif);
        const weeksNeeded = sisaHalaman / safeRate;
        const projDate = new Date();
        projDate.setDate(projDate.getDate() + Math.round(weeksNeeded * 7));
        const bulanName = namaBulanIndo[projDate.getMonth()];
        const tahun = projDate.getFullYear();
        const durasiBulan = Math.max(1, Math.round(weeksNeeded / 4.33));
        estimasiKhatamText = `${bulanName} ${tahun}`;
        estimasiSubText = `± ${durasiBulan} Bulan lagi`;
    }

    return {
        currentJuzText: `Juz ${currentJuz}`,
        percent: percent,
        percentText: `${percent}% Juz`,
        jumlahJuzDisetorText: jumlahJuzDisetorText,
        estimasiKhatamText: estimasiKhatamText,
        estimasiSubText: estimasiSubText,
        totalHalamanTuntas: halamanTuntas,
        sisaHalaman: sisaHalaman
    };
}

/**
 * Mendapatkan rekomendasi juz dan halaman berikutnya berdasarkan kurikulum
 */
function getNextCurriculumPosition(juz, hal) {
    const r = getJuzCurriculumIndex(juz);
    const h = Number(hal) || 1;
    if (h >= 20) {
        if (r < JUZ_CURRICULUM_ORDER.length - 1) {
            return { juz: JUZ_CURRICULUM_ORDER[r + 1], hal: 1, halaman: 1, khatam: false };
        } else {
            return { juz: JUZ_CURRICULUM_ORDER[r], hal: 20, halaman: 20, khatam: true };
        }
    }
    return { juz: JUZ_CURRICULUM_ORDER[r], hal: h + 1, halaman: h + 1, khatam: false };
}

/**
 * Mengambil daftar surah yang berada di juz tertentu
 */
function getSurahsByJuz(juz) {
    const j = Number(juz);
    const filtered = QURAN_114_SURAHS.filter(s => s.juz && s.juz.includes(j));
    return filtered.length > 0 ? filtered : QURAN_114_SURAHS.slice(0, 5);
}

/**
 * Halaman awal mushaf pojok 15 baris untuk juz tertentu
 */
function getJuzStartPage(juz) {
    const j = Number(juz);
    if (j === 1) return 1;
    if (j === 30) return 582;
    return (j - 1) * 20 + 2;
}

/**
 * Memetakan surah & ayat ke nomor halaman relatif juz (1-20 mushaf pojok)
 */
function mapSurahAyatToPage(juz, surah, ayatMulai, ayatSampai) {
    if (!surah) return [1];
    const juzStart = getJuzStartPage(juz);
    let globalStart = surah.startPage || 1;
    let globalEnd = surah.endPage || globalStart;

    if (surah.ayat > 1 && globalEnd > globalStart) {
        const a1 = Math.max(1, Math.min(surah.ayat, Number(ayatMulai) || 1));
        const a2 = Math.max(a1, Math.min(surah.ayat, Number(ayatSampai) || a1));
        const ratio1 = (a1 - 1) / (surah.ayat - 1);
        const ratio2 = (a2 - 1) / (surah.ayat - 1);
        const gP1 = Math.round(globalStart + ratio1 * (globalEnd - globalStart));
        const gP2 = Math.round(globalStart + ratio2 * (globalEnd - globalStart));
        globalStart = gP1;
        globalEnd = Math.max(gP1, gP2);
    }

    const relStart = Math.max(1, Math.min(20, globalStart - juzStart + 1));
    const relEnd = Math.max(1, Math.min(20, globalEnd - juzStart + 1));
    const pages = [];
    for (let p = relStart; p <= relEnd; p++) {
        pages.push(p);
    }
    return pages.length > 0 ? pages : [relStart];
}

// ====================================================================
// 1. DASHBOARD TAHFIDZ (LOAD & RENDER)
// ====================================================================

/**
 * Muat data lengkap dashboard Tahfidz dengan pola SWR (Stale-While-Revalidate).
 * Jika data sudah ada di cache browser, langsung render instan (0 detik!),
 * lalu sinkronkan dengan server di latar belakang.
 */
async function loadAdminTahfidzData(forceRefresh = false) {
    const loader = document.getElementById('admin-tahfidz-loader');
    const tableBody = document.getElementById('admin-tahfidz-table-body');
    const emptyState = document.getElementById('admin-tahfidz-empty');
    const refreshIcon = document.getElementById('btn-refresh-tahfidz-icon');

    if (refreshIcon && forceRefresh) {
        refreshIcon.classList.add('fa-spin');
    }

    const activeRole = String((typeof ASNIdentity !== 'undefined' && ASNIdentity.currentRole) || 
                              sessionStorage.getItem('ASN_ADMIN_ROLE') || 
                              sessionStorage.getItem('mubarokah_admin_role') || 'SUPER_ADMIN').toUpperCase();
    if (activeRole === 'SUPER_ADMIN' || activeRole === 'ADMIN') {
        ASNTahfidz.viewerRole = 'admin';
    }

    // 1. Cek cache lokal (Memory, localStorage, atau sessionStorage)
    // Strategi SWR: Jika ada data, LANGSUNG RENDER INSTAN (< 50ms) tanpa menunggu server!
    let hasRenderedFromCache = false;
    if (!forceRefresh) {
        let cached = ASNTahfidz.cache;
        if (!cached) {
            try {
                const stored = localStorage.getItem(TAHFIDZ_CACHE_KEY) || sessionStorage.getItem(TAHFIDZ_CACHE_KEY);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (parsed && (parsed.data || parsed.students)) {
                        cached = parsed.data || parsed;
                        ASNTahfidz.cache = cached;
                    }
                }
            } catch (e) {
                console.warn("Gagal membaca cache Tahfidz:", e);
            }
        }

        if (cached && (cached.success || cached.status === "success") && Array.isArray(cached.students)) {
            ASNTahfidz.data = cached;
            if (typeof buildTahfidzHalaqahIndex === 'function') buildTahfidzHalaqahIndex();

            populateTahfidzFilters();
            filterTahfidzList();
            renderTahfidzSummaryCards();
            applyTahfidzRolePermissions();
            updateHubTahfidzBadge();
            renderTahfidzHalaqahCards();
            populatePlottingHalaqahSelector();
            renderTahfidzMatriksBeban();
            populateTahfidzCatatSesiDropdown();
            hasRenderedFromCache = true;

            if (emptyState && ASNTahfidz.filteredStudents.length > 0) {
                emptyState.classList.add('hidden');
            }
            if (loader) loader.classList.add('hidden');
        }
    }

    // Hanya tampilkan full loader jika SAMA SEKALI belum ada data di cache lokal
    if (!hasRenderedFromCache) {
        if (loader) loader.classList.remove('hidden');
        if (emptyState) emptyState.classList.add('hidden');
    }

    // Hindari pemanggilan server duplikat jika request sedang berjalan
    if (ASNTahfidz._fetchPromise) {
        return ASNTahfidz._fetchPromise;
    }

    // Jika data sudah berhasil dirender dari cache dan masih segar (< 90 detik), lewati fetch server
    if (!forceRefresh && hasRenderedFromCache && ASNTahfidz.lastFetched && (Date.now() - ASNTahfidz.lastFetched < 90000)) {
        return Promise.resolve(ASNTahfidz.data);
    }

    ASNTahfidz._fetchPromise = (async () => {
        try {
            const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : (sessionStorage.getItem(TAHFIDZ_STORAGE_KEYS.adminToken) || localStorage.getItem(TAHFIDZ_STORAGE_KEYS.adminToken))) || "";
            const response = await apiPost("getTahfidzDashboard", token ? { token } : {});

            if (response && (response.success || response.status === "success")) {
                ASNTahfidz.lastFetched = Date.now();
                // Gabungkan halaqah lokal jika ada halaqah baru yang belum terangkum
                if (Array.isArray(response.halaqahs)) {
                    const currentHalaqahs = ASNTahfidz.data?.halaqahs || [];
                    const mergedHalaqahs = [...response.halaqahs];
                    currentHalaqahs.forEach(loc => {
                        if (loc && loc.halaqahId && !mergedHalaqahs.some(s => s.halaqahId === loc.halaqahId)) {
                            mergedHalaqahs.push(loc);
                        }
                    });
                    response.halaqahs = mergedHalaqahs;
                }

                ASNTahfidz.data = response;
                ASNTahfidz.cache = response;
                if (typeof buildTahfidzHalaqahIndex === 'function') buildTahfidzHalaqahIndex();

                // Sinkronkan status presensi hari ini dari Google Spreadsheet ke cache lokal
                if (Array.isArray(response.students)) {
                    const localRecords = getTahfidzPresensiRecords();
                    let updatedLocal = false;
                    response.students.forEach(st => {
                        const sId = st.studentId || st.nis;
                        if (sId && st.presensiStatus) {
                            if (!localRecords[sId] || localRecords[sId].status !== st.presensiStatus) {
                                localRecords[sId] = {
                                    status: st.presensiStatus,
                                    keterangan: st.presensiKeterangan || ''
                                };
                                updatedLocal = true;
                            }
                        }
                    });
                    if (updatedLocal) {
                        saveTahfidzPresensiRecords(localRecords);
                    }
                }

                try {
                    const cachePayload = JSON.stringify({
                        data: response,
                        timestamp: Date.now()
                    });
                    localStorage.setItem(TAHFIDZ_CACHE_KEY, cachePayload);
                    sessionStorage.setItem(TAHFIDZ_CACHE_KEY, cachePayload);
                } catch (e) {
                    console.warn("Gagal menyimpan cache Tahfidz:", e);
                }

                populateTahfidzFilters();
                filterTahfidzList();
                renderTahfidzSummaryCards();
                applyTahfidzRolePermissions();
                updateHubTahfidzBadge();
                renderTahfidzHalaqahCards();
                populatePlottingHalaqahSelector();
                renderTahfidzMatriksBeban();
                populateTahfidzCatatSesiDropdown();

                if (forceRefresh && typeof showToast === 'function') {
                    showToast("✅ Data Tahfidz berhasil diperbarui.");
                }
            } else {
                console.warn("Gagal memuat tahfidz dashboard:", response);
                if (!hasRenderedFromCache && typeof showToast === 'function') {
                    showToast("⚠️ " + ((response && response.message) || "Gagal memuat data Tahfidz."));
                }
            }
        } catch (err) {
            console.error("Error loadAdminTahfidzData:", err);
            if (!hasRenderedFromCache && typeof showToast === 'function') {
                showToast("❌ Terjadi kendala saat memuat data: " + (err.message || "Gagal memuat data Tahfidz."));
            }
        } finally {
            ASNTahfidz._fetchPromise = null;
            if (loader) loader.classList.add('hidden');
            if (refreshIcon) refreshIcon.classList.remove('fa-spin');
        }
    })();

    return ASNTahfidz._fetchPromise;
}

/**
 * Mencari kelompok halaqah yang diampu oleh Akun Asatidz yang sedang login
 */
function getHalaqahForActiveAsatidz() {
    const activeRole = String((typeof ASNIdentity !== 'undefined' && ASNIdentity.currentRole) || 
                              sessionStorage.getItem('ASN_ADMIN_ROLE') || 
                              sessionStorage.getItem('mubarokah_admin_role') || '').toUpperCase();
    if (activeRole !== 'ASATIDZ') return null;

    let user = (typeof ASNIdentity !== 'undefined' && ASNIdentity.currentUser) || null;
    if (!user) {
        try {
            const raw = sessionStorage.getItem('mubarokah_admin_data') || localStorage.getItem('mubarokah_admin_data');
            if (raw) user = JSON.parse(raw);
        } catch (e) {}
    }
    if (!user) return null;

    const halaqahs = ASNTahfidz.data?.halaqahs || [];
    if (!Array.isArray(halaqahs) || halaqahs.length === 0) return null;

    const uName = String(user.name || '').trim().toLowerCase();
    const uEmail = String(user.email || '').trim().toLowerCase();
    const uNip = String(user.nip || '').trim().toLowerCase();
    const cleanUName = uName.replace(/^(ustadz|ustadzah|ust\.|ustd\.|kyai|nyai|gus|ning)\s+/i, '').trim();

    // 1. Prioritas 1: Kecocokan persis pada muhafiz, email, atau NIP
    for (const h of halaqahs) {
        const m = String(h.muhafiz || '').trim().toLowerCase();
        const cleanM = m.replace(/^(ustadz|ustadzah|ust\.|ustd\.|kyai|nyai|gus|ning)\s+/i, '').trim();
        const hemail = String(h.email || h.muhafizEmail || '').trim().toLowerCase();
        const hNip = String(h.nip || h.muhafizNip || '').trim().toLowerCase();

        if (uNip && hNip && uNip === hNip) return h;
        if (uEmail && hemail && uEmail === hemail) return h;
        if (cleanUName && cleanM && cleanUName === cleanM) return h;
        if (uName && m && uName === m) return h;
    }

    // 2. Prioritas 2: Substring / Partial Name match pada nama Muhafiz atau Nama Halaqah
    if (cleanUName && cleanUName.length >= 3) {
        for (const h of halaqahs) {
            const m = String(h.muhafiz || '').trim().toLowerCase();
            const hName = String(h.namaHalaqah || '').trim().toLowerCase();
            const cleanM = m.replace(/^(ustadz|ustadzah|ust\.|ustd\.|kyai|nyai|gus|ning)\s+/i, '').trim();

            if (cleanM && (cleanM.includes(cleanUName) || cleanUName.includes(cleanM))) return h;
            if (hName.includes(cleanUName)) return h;
        }
    }

    // 3. Fallback: jika login sebagai ASATIDZ dan ada daftar halaqah, gunakan halaqah pertama
    return halaqahs[0] || null;
}

/**
 * Kontrol Visibilitas Tombol Tahfidz Berdasarkan Peran Pengguna (RBAC)
 * Memberikan akses penuh bagi Super Admin & Admin untuk manajerial (Kelola Halaqah, Jadwal & Sesi, Target Massal)
 * dan mengaktifkan Tombol Presensi untuk Super Admin, Admin, dan Asatidz.
 */
function applyTahfidzRolePermissions() {
    const activeRole = String((typeof ASNIdentity !== 'undefined' && ASNIdentity.currentRole) || 
                              sessionStorage.getItem('ASN_ADMIN_ROLE') || 
                              sessionStorage.getItem('mubarokah_admin_role') || 'SUPER_ADMIN').toUpperCase();
    const isAdminOrSuper = (activeRole === 'SUPER_ADMIN' || activeRole === 'ADMIN');
    if (isAdminOrSuper && typeof ASNTahfidz !== 'undefined') {
        ASNTahfidz.viewerRole = 'admin';
    }

    const isPengasuh = !isAdminOrSuper && (activeRole === 'PENGASUH' || (typeof ASNTahfidz !== 'undefined' && ASNTahfidz.viewerRole === 'pengasuh'));
    const isAsatidz = !isAdminOrSuper && (activeRole === 'ASATIDZ' || activeRole === 'GURU' || activeRole === 'MUALLIM' || activeRole === 'PEGAWAI');
    const hideAdminActions = !isAdminOrSuper && (isPengasuh || isAsatidz);

    // Tombol manajerial administratif: Kelola Halaqah, Jadwal & Sesi, Target Massal
    document.querySelectorAll('.tahfidz-admin-action').forEach(el => {
        if (hideAdminActions) {
            el.classList.add('hidden');
            el.style.display = 'none';
        } else {
            el.classList.remove('hidden');
            el.style.display = '';
        }
    });

    // Tombol Presensi: Dikontrol secara dinamis dari Konfigurasi Izin (RBAC)
    let showPresensi = false;
    if (typeof window.hasRolePermission === 'function') {
        showPresensi = window.hasRolePermission('tahfidz.presensi', activeRole);
    } else {
        showPresensi = isAdminOrSuper || isAsatidz;
    }
    if (isPengasuh) {
        showPresensi = false;
    }

    document.querySelectorAll('.tahfidz-presensi-action').forEach(el => {
        if (showPresensi) {
            el.classList.remove('hidden');
            el.style.display = '';
        } else {
            el.classList.add('hidden');
            el.style.display = 'none';
        }
    });
}

/**
 * Render 4 Kartu Ringkasan Atas secara Dinamis Sesuai Filter Halaqah (Screenshot 1)
 * 1. Capaian Ziyadah Pekan Ini (Hlm Disetor & % Tuntas Ziyadah)
 * 2. Rata-Rata Hafalan (Juz / Santri)
 * 3. Total Santri Aktif (Terplot dalam halaqah terpilih)
 * 4. Capaian Muroja'ah Pekan Ini (Hlm Disetor & % Tuntas Muroja'ah)
 */
function renderTahfidzSummaryCards(filterHal = null) {
    if (filterHal === null || filterHal === undefined) {
        filterHal = document.getElementById('tahfidz-filter-halaqah')?.value || 'ALL';
    }

    const allStudents = ASNTahfidz.data?.students || [];
    let targetStudents = [];

    if (filterHal === 'ALL') {
        targetStudents = allStudents.filter(st => isStudentInHalaqah(st));
        if (targetStudents.length === 0) targetStudents = allStudents;
    } else if (filterHal === 'UNASSIGNED') {
        targetStudents = allStudents.filter(st => !isStudentInHalaqah(st));
    } else {
        targetStudents = allStudents.filter(st => {
            const inHal = isStudentInHalaqah(st);
            return inHal && st.halaqah && (
                st.halaqah.namaHalaqah === filterHal || 
                st.halaqah.halaqahId === filterHal
            );
        });
    }

    const totalSantri = targetStudents.length;

    // 1. Total Santri Aktif
    const elTotal = document.getElementById('tahfidz-stat-total');
    if (elTotal) elTotal.innerText = totalSantri;

    // 2. Rata-Rata Hafalan Santri
    let totalJuz = 0;
    let khatamCount = 0;
    targetStudents.forEach(st => {
        const p = st.progress;
        const curJuz = Number(st.capaian?.juzAktif || p?.currentJuz || 30);
        const curHal = Number(st.capaian?.halamanTerakhir || p?.currentHalaman || 1);
        const curTot = Number(st.capaian?.totalHalamanTuntas || p?.totalHalamanTuntas || 0);
        const curProg = getCurriculumProgress(curJuz, curHal);
        const isKhatam = Boolean(p && p.isKhatam) || curProg.isKhatam || curTot >= 600;
        const jzComp = isKhatam ? 30 : (curProg.rank + (curHal >= 20 ? 1 : (curHal / 20)));
        totalJuz += jzComp;
        if (isKhatam) khatamCount++;
    });
    const avgJuzStr = totalSantri > 0 ? (totalJuz / totalSantri).toFixed(1) : "0.0";
    const elRata = document.getElementById('tahfidz-stat-rata');
    if (elRata) elRata.innerHTML = `${avgJuzStr} <span class="text-[10px] md:text-xs font-bold text-slate-500 dark:text-slate-400">Juz</span>`;

    // Hitung santri yang berhalangan hadir (Sakit / Izin / Pulang)
    // agar KPI target pekanan tidak turun akibat ketidakhadiran santri berhalangan
    let excusedCount = 0;
    targetStudents.forEach(st => {
        const pres = getStudentPresensiStatus(st);
        if (['SAKIT', 'IZIN', 'PULANG'].includes(pres)) {
            excusedCount++;
        }
    });
    const activeEvaluatedCount = Math.max(0, totalSantri - excusedCount);

    // 3. Capaian Ziyadah Pekan Ini (Pengganti Khatam 30 Juz)
    let weeklyZiyadahPages = 0;
    let tuntasZiyadahCount = 0;
    targetStudents.forEach(st => {
        const rZ = Number(st.rekapPekan?.ziyadah?.realita || 0);
        weeklyZiyadahPages += rZ;
        if (st.rekapPekan?.ziyadah?.isTuntas) tuntasZiyadahCount++;
    });
    const effectiveTotalZiyadah = activeEvaluatedCount > 0 ? activeEvaluatedCount : totalSantri;
    const persenTuntasZiyadah = effectiveTotalZiyadah > 0 ? Math.min(100, Math.round((tuntasZiyadahCount / effectiveTotalZiyadah) * 100)) : 0;

    const elZiyadahPages = document.getElementById('tahfidz-stat-ziyadah-pages');
    if (elZiyadahPages) elZiyadahPages.innerText = weeklyZiyadahPages;

    const elZiyadahTuntas = document.getElementById('tahfidz-stat-ziyadah-tuntas-santri');
    if (elZiyadahTuntas) {
        elZiyadahTuntas.innerText = `${persenTuntasZiyadah}%`;
        if (excusedCount > 0) {
            elZiyadahTuntas.title = `${tuntasZiyadahCount} tuntas dari ${effectiveTotalZiyadah} santri aktif (${excusedCount} santri izin/sakit dikecualikan)`;
        }
    }

    const elZiyadahBarCard = document.getElementById('tahfidz-stat-bar-ziyadah-card');
    if (elZiyadahBarCard) elZiyadahBarCard.style.width = `${Math.min(100, persenTuntasZiyadah)}%`;

    // 4. Capaian Muroja'ah Pekan Ini
    let weeklyMurajaahPages = 0;
    let tuntasMurajaahCount = 0;
    targetStudents.forEach(st => {
        const rM = Number(st.rekapPekan?.murojaah?.realita || 0);
        weeklyMurajaahPages += rM;
        if (st.rekapPekan?.murojaah?.isTuntas) tuntasMurajaahCount++;
    });
    const effectiveTotalMurajaah = activeEvaluatedCount > 0 ? activeEvaluatedCount : totalSantri;
    const persenTuntasMurojaah = effectiveTotalMurajaah > 0 ? Math.min(100, Math.round((tuntasMurajaahCount / effectiveTotalMurajaah) * 100)) : 0;

    const elMurajaahPages = document.getElementById('tahfidz-stat-murojaah-pages');
    if (elMurajaahPages) elMurajaahPages.innerText = weeklyMurajaahPages;

    const elTuntasMurajaah = document.getElementById('tahfidz-stat-murojaah-tuntas-santri');
    if (elTuntasMurajaah) {
        elTuntasMurajaah.innerText = `${persenTuntasMurojaah}%`;
        if (excusedCount > 0) {
            elTuntasMurajaah.title = `${tuntasMurajaahCount} tuntas dari ${effectiveTotalMurajaah} santri aktif (${excusedCount} santri izin/sakit dikecualikan)`;
        }
    }

    // 5. Rasio Aktivitas Ziyadah vs Muroja'ah (Bar Bawah Card 4)
    const totalActivity = weeklyZiyadahPages + weeklyMurajaahPages;
    const ziyadahPercent = totalActivity > 0 ? Math.round((weeklyZiyadahPages / totalActivity) * 100) : 50;
    const murajaahPercent = 100 - ziyadahPercent;

    const elZiyadahBar = document.getElementById('tahfidz-stat-bar-ziyadah');
    if (elZiyadahBar) elZiyadahBar.style.width = `${ziyadahPercent}%`;

    const elZiyadahText = document.getElementById('tahfidz-stat-text-ziyadah');
    if (elZiyadahText) elZiyadahText.innerText = `Ziyadah ( ${ziyadahPercent}% )`;

    const elMurajaahText = document.getElementById('tahfidz-stat-text-murajaah');
    if (elMurajaahText) elMurajaahText.innerText = `Muraja'ah ( ${murajaahPercent}% )`;

    // Fallback legacy element
    const elKhatam = document.getElementById('tahfidz-stat-khatam');
    if (elKhatam) elKhatam.innerText = khatamCount;
}

/**
 * Isi dropdown filter kategori, halaqah, muhafiz
 * Otomatis memilih halaqah bimbingan jika user adalah Akun Asatidz
 */
function populateTahfidzFilters() {
    const selKat = document.getElementById('tahfidz-filter-kategori');
    const selHal = document.getElementById('tahfidz-filter-halaqah');
    const selMuh = document.getElementById('tahfidz-filter-muhafiz');

    if (selKat) {
        const currentVal = selKat.value;
        const categories = (ASNTahfidz.data.categories || []).filter(c => c && c !== 'ALL' && c !== 'Semua Kategori');
        let optKat = `<option value="ALL">Semua Kategori</option>`;
        categories.forEach(k => {
            optKat += `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`;
        });
        selKat.innerHTML = optKat;
        if (currentVal && Array.from(selKat.options).some(o => o.value === currentVal)) {
            selKat.value = currentVal;
        }
    }

    if (selHal) {
        const currentVal = selHal.value;
        let optHtml = `<option value="ALL">Semua Halaqah</option>`;
        (ASNTahfidz.data.halaqahs || []).forEach(h => {
            if (h && h.namaHalaqah) {
                optHtml += `<option value="${escapeHtml(h.namaHalaqah)}">${escapeHtml(h.namaHalaqah)}</option>`;
            }
        });
        optHtml += `<option value="UNASSIGNED">Belum Masuk Halaqah</option>`;
        selHal.innerHTML = optHtml;

        // Auto-select otomatis untuk Akun Asatidz
        const asatidzHalaqah = getHalaqahForActiveAsatidz();
        if (asatidzHalaqah && (!currentVal || currentVal === 'ALL' || !Array.from(selHal.options).some(o => o.value === currentVal))) {
            selHal.value = asatidzHalaqah.namaHalaqah;
        } else if (currentVal && Array.from(selHal.options).some(o => o.value === currentVal)) {
            selHal.value = currentVal;
        }
    }

    if (selMuh) {
        const currentVal = selMuh.value;
        const muhafizList = (ASNTahfidz.data.muhafizList || []).filter(m => m && m !== 'ALL' && m !== 'Semua Muhafiz');
        let optMuh = `<option value="ALL">Semua Muhafiz</option>`;
        muhafizList.forEach(m => {
            optMuh += `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`;
        });
        selMuh.innerHTML = optMuh;
        if (currentVal && Array.from(selMuh.options).some(o => o.value === currentVal)) {
            selMuh.value = currentVal;
        }
    }
}

/**
 * Update badge Tahfidz di Hub Admin (Hanya santri aktif di kelompok halaqah)
 */
function updateHubTahfidzBadge() {
    const hubBadge = document.getElementById('admin-hub-tahfidz-count');
    if (hubBadge) {
        const count = (ASNTahfidz.data.students || []).filter(st => isStudentInHalaqah(st)).length;
        hubBadge.innerText = `${count} Santri`;
    }
}

/**
 * Membangun index Set O(1) untuk seluruh anggota halaqah (eliminasi nested loop O(N*M))
 */
function buildTahfidzHalaqahIndex() {
    const memberSet = new Set();
    const nameSet = new Set();
    const idSet = new Set();
    const halaqahs = ASNTahfidz.data?.halaqahs || [];

    for (let i = 0; i < halaqahs.length; i++) {
        const h = halaqahs[i];
        if (!h) continue;
        if (h.namaHalaqah) nameSet.add(h.namaHalaqah.trim().toLowerCase());
        if (h.halaqahId) idSet.add(String(h.halaqahId).trim().toLowerCase());
        if (Array.isArray(h.studentIds)) {
            for (let j = 0; j < h.studentIds.length; j++) {
                const clean = String(h.studentIds[j] || "").trim().toLowerCase();
                if (clean) memberSet.add(clean);
            }
        }
    }
    ASNTahfidz._halaqahMemberSet = memberSet;
    ASNTahfidz._halaqahNameSet = nameSet;
    ASNTahfidz._halaqahIdSet = idSet;
}

/**
 * Memeriksa apakah santri sudah ditambahkan ke dalam salah satu kelompok halaqah (Super Cepat O(1))
 */
function isStudentInHalaqah(st) {
    if (!st) return false;
    if (typeof st.isInHalaqah === 'boolean') {
        if (st.isInHalaqah) return true;
    }

    // 1. Cek properti halaqahId pada santri
    const hid = String(st.halaqahId || (st.halaqah && st.halaqah.halaqahId) || "").trim();
    if (hid !== "" && hid !== "0" && hid !== "undefined") {
        return true;
    }

    if (!ASNTahfidz._halaqahMemberSet) {
        buildTahfidzHalaqahIndex();
    }

    // 2. Cek apakah nama halaqah valid
    const hname = (st.halaqah?.namaHalaqah || st.halaqahName || "").trim().toLowerCase();
    if (hname && hname !== "belum masuk halaqah") {
        if (ASNTahfidz._halaqahNameSet.size === 0 || ASNTahfidz._halaqahNameSet.has(hname)) {
            return true;
        }
        if (hid && ASNTahfidz._halaqahIdSet.has(hid.toLowerCase())) {
            return true;
        }
    }

    // 3. O(1) Set lookup instan (bebas freeze loop)
    const sId = String(st.studentId || st.nis || st.id || "").trim().toLowerCase();
    const sNis = String(st.nis || "").trim().toLowerCase();
    const sName = String(st.name || "").trim().toLowerCase();

    return Boolean(
        (sId && ASNTahfidz._halaqahMemberSet.has(sId)) ||
        (sNis && ASNTahfidz._halaqahMemberSet.has(sNis)) ||
        (sName && ASNTahfidz._halaqahMemberSet.has(sName))
    );
}

/**
 * Filter realtime data tabel
 */
function filterTahfidzList() {
    const q = (document.getElementById('tahfidz-search-input')?.value || '').toLowerCase().trim();
    const kat = document.getElementById('tahfidz-filter-kategori')?.value || 'Semua Kategori';
    const hal = document.getElementById('tahfidz-filter-halaqah')?.value || 'ALL';
    const muh = document.getElementById('tahfidz-filter-muhafiz')?.value || 'Semua Muhafiz';
    const status = document.getElementById('tahfidz-filter-status')?.value || 'ALL';

    const all = ASNTahfidz.data.students || [];

    ASNTahfidz.filteredStudents = all.filter(st => {
        // Query search
        const matchQ = !q ||
            (st.name && st.name.toLowerCase().includes(q)) ||
            (st.nis && st.nis.toLowerCase().includes(q)) ||
            (st.halaqah && st.halaqah.namaHalaqah && st.halaqah.namaHalaqah.toLowerCase().includes(q));

        // Kategori
        const matchKat = (kat === 'Semua Kategori' || kat === 'ALL') ||
            (st.program && st.program.toLowerCase() === kat.toLowerCase()) ||
            (st.halaqah && st.halaqah.kategori && st.halaqah.kategori.toLowerCase() === kat.toLowerCase());

        // Halaqah Filter:
        // Filter "Semua Halaqah" (ALL) HANYA menampilkan santri yang sudah dimasukkan ke kelompok halaqah
        const inHalaqah = isStudentInHalaqah(st);
        let matchHal = false;

        if (hal === 'ALL') {
            matchHal = inHalaqah;
        } else if (hal === 'UNASSIGNED') {
            matchHal = !inHalaqah;
        } else {
            matchHal = inHalaqah && st.halaqah && (
                st.halaqah.namaHalaqah === hal || 
                st.halaqah.halaqahId === hal
            );
        }

        // Muhafiz
        const matchMuh = (muh === 'Semua Muhafiz' || muh === 'ALL') ||
            (st.halaqah && st.halaqah.muhafiz && st.halaqah.muhafiz.includes(muh)) ||
            (st.setoranTerakhir && st.setoranTerakhir.muhafiz && st.setoranTerakhir.muhafiz.includes(muh));

        // Status On-Track / Mengulang / Target Muroja'ah Mingguan
        let matchStatus = true;
        if (status === 'MUROJAAH_TUNTAS') {
            matchStatus = Boolean(st.rekapPekan && st.rekapPekan.murojaah && st.rekapPekan.murojaah.isTuntas);
        } else if (status === 'MUROJAAH_BELUM') {
            matchStatus = Boolean(!st.rekapPekan || !st.rekapPekan.murojaah || !st.rekapPekan.murojaah.isTuntas);
        } else if (status === 'ON_TRACK') {
            matchStatus = st.progress && st.progress.onTrackStatus && st.progress.onTrackStatus.startsWith('On-Track');
        } else if (status === 'BELUM_SETOR') {
            matchStatus = st.progress && st.progress.onTrackStatus && st.progress.onTrackStatus.includes('Belum Setor');
        } else if (status === 'SAKIT') {
            matchStatus = getStudentPresensiStatus(st) === 'SAKIT';
        } else if (status === 'IZIN_PULANG' || status === 'IZIN') {
            const p = getStudentPresensiStatus(st);
            matchStatus = p === 'IZIN' || p === 'PULANG';
        } else if (status === 'ULANG') {
            const isRepeat = (st.setoranTerakhir && (st.setoranTerakhir.statusSetoran === 'ULANG' || st.setoranTerakhir.nilai === 'DHAIF')) ||
                (st.progress && st.progress.onTrackStatus && st.progress.onTrackStatus.includes('Mengulang'));
            matchStatus = Boolean(isRepeat);
        }

        return matchQ && matchKat && matchHal && matchMuh && matchStatus;
    });

    renderTahfidzStudentTable();
    renderTahfidzSummaryCards(hal);
    applyTahfidzRolePermissions();
}

/**
 * Render Tabel Data Santri (Desktop & Mobile) sesuai Screenshot 1
 */
function renderTahfidzStudentTable() {
    const tbody = document.getElementById('admin-tahfidz-table-body');
    const mobileContainer = document.getElementById('admin-tahfidz-mobile-list');
    const emptyState = document.getElementById('admin-tahfidz-empty');
    const countEl = document.getElementById('admin-tahfidz-count');

    const students = ASNTahfidz.filteredStudents || [];

    if (countEl) countEl.innerText = `${students.length} Santri`;

    if (students.length === 0) {
        if (tbody) tbody.innerHTML = '';
        if (mobileContainer) mobileContainer.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    // Desktop Table HTML
    if (tbody) {
        tbody.innerHTML = students.map(st => {
            const initials = (st.name || 'Santri').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'SN';
            const inHal = isStudentInHalaqah(st);
            const halaqahName = inHal ? (st.halaqah?.namaHalaqah || 'Halaqah Aktif') : 'Belum Masuk Halaqah';
            const targetZ = st.target?.ziyadahSesi || 1;
            const targetZPekan = st.target?.ziyadahPekan || 10;
            const targetZBulan = st.target?.ziyadahBulan || 40;
            const targetM = st.target?.murajaahSesi || 2;
            const targetMPekan = st.target?.murajaahPekan || 10;
            const targetMBulan = st.target?.murajaahBulan || 40;

            const last = st.setoranTerakhir;
            const isUlang = last && (last.statusSetoran === 'ULANG' || last.nilai === 'DHAIF');

            const cap = st.capaian || {};
            const mur = st.murojaah || {};

            const currentJuz = Number(cap.juzAktif) || Number(st.progress?.currentJuz) || 30;
            const currentHal = Number(cap.halamanTerakhir) || Number(st.progress?.currentHalaman) || 1;
            const curProg = getCurriculumProgress(currentJuz, currentHal);
            const isKhatam = Boolean(st.progress?.isKhatam) || curProg.isKhatam || (Number(cap.totalHalamanTuntas || st.progress?.totalHalamanTuntas || 0) >= 600);
            const percent = isKhatam ? 100 : curProg.percent;
            const onTrackStatus = st.progress?.onTrackStatus || 'Belum Setor';
            const isOnTrack = onTrackStatus.includes('On-Track');

            const presStatus = getStudentPresensiStatus(st);
            const presData = getStudentPresensiData(st);
            const isExcused = ['SAKIT', 'IZIN', 'PULANG'].includes(presStatus);

            const sabqiHalaman = mur.sabqiHalaman || cap.sabqiHalaman || '';
            const sabqiDisp = sabqiHalaman ? `Hlm ${sabqiHalaman}` : `Juz ${currentJuz}`;
            const manzilJuz = Number(mur.manzilJuz || cap.manzilJuz) || 1;
            const manzilHalaman = Number(mur.manzilHalaman || cap.manzilHalaman) || 1;
            const manzilPutaran = Number(mur.manzilPutaran || cap.manzilPutaran) || 1;
            const rekapM = st.rekapPekan?.murojaah || { realita: 0, isTuntas: false, sisaHalaman: targetMPekan };

            const isSelected = ASNTahfidz.selectedStudentIds && ASNTahfidz.selectedStudentIds.has(st.studentId);

            return `
            <tr class="hover:bg-slate-50/80 dark:hover:bg-[#1c2836]/60 transition border-b border-slate-100 dark:border-[#253447] ${isSelected ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''}">

                <!-- 1. SANTRI & HALAQAH -->
                <td class="px-3.5 py-2.5">
                    <div class="flex items-center space-x-2.5">
                        <div class="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-black flex items-center justify-center text-xs shrink-0 border border-emerald-200 dark:border-emerald-800/40">
                            ${st.photoUrl ? `<img src="${escapeHtml(st.photoUrl)}" class="w-full h-full object-cover rounded-full" onerror="this.onerror=null; this.parentElement.innerText='${initials}';">` : initials}
                        </div>
                        <div class="min-w-0">
                            <h4 class="font-extrabold text-xs md:text-sm text-slate-800 dark:text-slate-100 truncate">${escapeHtml(st.name)}</h4>
                            <p class="text-[10px] text-slate-400">NIS: ${escapeHtml(st.nis || '-')} • Bil Hifdhi</p>
                            <span class="inline-flex items-center gap-1 px-1.5 py-0.2 mt-0.5 rounded text-[9px] font-bold ${inHal ? 'bg-slate-100 dark:bg-[#1c2836] text-slate-600 dark:text-slate-300' : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40'}">
                                <span class="w-1.5 h-1.5 rounded-full ${inHal ? 'bg-emerald-500' : 'bg-amber-400'}"></span>
                                ${escapeHtml(halaqahName)}
                            </span>
                        </div>
                    </div>
                </td>

                <!-- 2. TARGET CAPAIAN (COMPACT INTERACTIVE PILLS) -->
                <td class="px-3.5 py-2.5">
                    <div onclick="openTahfidzTargetModal('${st.studentId}')" class="inline-flex flex-col gap-1 group cursor-pointer" title="Klik untuk atur target capaian santri">
                        <!-- Ziyadah Pill -->
                        <div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50/90 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40 text-[10px] transition hover:bg-emerald-100/90">
                            <i class="fa-solid fa-book-open text-[8px] text-emerald-600 shrink-0"></i>
                            <span class="font-bold">Ziyadah:</span>
                            <span>${targetZ} Hlm/Setor</span>
                            <span class="text-emerald-700/70 dark:text-emerald-400/70 font-semibold text-[9px]">(${targetZPekan}P / ${targetZBulan}B)</span>
                            <i class="fa-solid fa-pencil text-[8px] text-slate-400 group-hover:text-emerald-600 ml-1 opacity-0 group-hover:opacity-100 transition"></i>
                        </div>
                        <!-- Muroja'ah Pill with Weekly Reality -->
                        <div class="flex flex-col gap-0.5">
                            <div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50/90 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40 text-[10px] transition hover:bg-amber-100/90">
                                <i class="fa-solid fa-rotate text-[8px] text-amber-600 shrink-0"></i>
                                <span class="font-bold">Muroja'ah:</span>
                                <span>${targetM} Hlm/Setor</span>
                                <span class="text-amber-700/70 dark:text-amber-400/70 font-semibold text-[9px]">(${targetMPekan}P)</span>
                                <i class="fa-solid fa-pencil text-[8px] text-slate-400 group-hover:text-amber-600 ml-1 opacity-0 group-hover:opacity-100 transition"></i>
                            </div>
                            <div class="flex items-center justify-between px-1 text-[8px] font-bold">
                                <span class="text-slate-500 dark:text-slate-400">Pekan: <b>${rekapM.realita || 0}/${targetMPekan} Hlm</b></span>
                                <span class="px-1 py-0.2 rounded text-[7px] ${rekapM.isTuntas ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300' : ((rekapM.realita || 0) > 0 ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300' : 'bg-slate-100 dark:bg-[#1c2836] text-slate-400')}">
                                    ${rekapM.isTuntas ? '✅ Tuntas' : ((rekapM.realita || 0) > 0 ? `Kurang ${rekapM.sisaHalaman}` : (isExcused ? 'Dikecualikan' : 'Belum'))}
                                </span>
                            </div>
                        </div>
                    </div>
                </td>

                <!-- 3. SETORAN TERAKHIR (STREAMLINED) -->
                <td class="px-3.5 py-2.5 text-xs">
                    ${last ? `
                    <div class="space-y-0.5">
                        <div class="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1">
                            <span class="text-emerald-600 font-extrabold">Juz ${last.juz}</span>
                            <span class="text-slate-400">•</span>
                            <span class="truncate max-w-[140px]">${escapeHtml(last.surah)}</span>
                        </div>
                        <p class="text-[10px] text-slate-500 dark:text-slate-400">
                            Hlm ${escapeHtml(last.halaman)} • <span class="text-slate-400">${escapeHtml(last.sesi)}</span>
                        </p>
                        <p class="text-[9px] text-slate-400 truncate max-w-[170px]">
                            ${escapeHtml(last.tanggal)} • <span class="italic">${escapeHtml(last.muhafiz)}</span>
                        </p>
                    </div>
                    ` : `
                    <span class="text-[10px] text-slate-400 italic">Belum ada riwayat setoran.</span>
                    `}
                </td>

                <!-- 4. STATUS & NILAI -->
                <td class="px-3.5 py-2.5">
                    ${isExcused ? `
                    <div class="space-y-1">
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black ${presStatus === 'SAKIT' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800' : (presStatus === 'PULANG' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-300 dark:border-purple-800' : 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-300 dark:border-blue-800')}" title="${escapeHtml(presData?.keterangan || presStatus)}">
                            <i class="fa-solid ${presStatus === 'SAKIT' ? 'fa-notes-medical' : (presStatus === 'PULANG' ? 'fa-house-user' : 'fa-clipboard-user')} text-[8px]"></i>
                            <span>${presStatus === 'SAKIT' ? '🏥 Sakit (UKS)' : (presStatus === 'PULANG' ? '🏠 Izin Pulang' : '📝 Izin')}</span>
                        </span>
                        <p class="text-[9px] text-slate-400 italic truncate max-w-[130px]">${escapeHtml(presData?.keterangan || (presStatus === 'SAKIT' ? 'Istirahat di asrama/UKS' : (presStatus === 'PULANG' ? 'Izin pulang ke rumah' : 'Izin tugas pondok')))}</p>
                    </div>
                    ` : (last ? `
                    <div class="space-y-1">
                        <div class="flex items-center gap-1 flex-wrap">
                            <span class="inline-block px-2 py-0.5 rounded-full text-[9px] font-extrabold ${last.tipe === 'ZIYADAH' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300' : (last.tipe === 'MURAJAAH_SABQI' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300' : (last.tipe === 'MURAJAAH_MANZIL' ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300' : (last.tipe === 'TASMI' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300')))}">
                                ${last.tipe === 'MURAJAAH_SABQI' ? 'Sabqi' : (last.tipe === 'MURAJAAH_MANZIL' ? 'Manzil' : (last.tipe === 'ZIYADAH' ? 'Ziyadah' : (last.tipe === 'TASMI' ? "Tasmi'" : escapeHtml(last.tipe))))}
                            </span>
                            ${isUlang ? `
                            <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                                <i class="fa-solid fa-rotate-left text-[8px]"></i> Wajib Ulang
                            </span>
                            ` : `
                            <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/40">
                                <i class="fa-solid fa-check text-[8px]"></i> Lulus
                            </span>
                            `}
                        </div>
                        <div class="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                            Nilai: <span class="${isUlang ? 'text-rose-600 font-extrabold' : 'text-emerald-600 font-extrabold'}">${last.nilai === 'MUMTAZ' ? 'A (Mumtaz)' : (last.nilai === 'JAYYID_JIDDAN' ? 'B+ (Jayyid)' : (last.nilai === 'JAYYID' ? 'B (Jayyid)' : 'C (Dha\'if)'))}</span>
                        </div>
                    </div>
                    ` : `<span class="text-[10px] text-slate-400">-</span>`)}
                </td>

                <!-- 5. PROGRESS (0 - 30 JUZ) & ROTASI MUROJA'AH -->
                <td class="px-3.5 py-2.5 w-48">
                    <div class="space-y-1">
                        <div class="flex justify-between items-center text-xs">
                            <span class="font-black text-slate-800 dark:text-slate-100">
                                ${isKhatam ? `<span class="text-amber-500 font-black flex items-center gap-1"><i class="fa-solid fa-crown text-amber-500 text-xs"></i> Khatam 30 Juz</span>` : `Juz ${currentJuz} <span class="text-slate-400 font-normal text-[10px]">/ 30</span>`}
                            </span>
                            <span class="text-[10px] font-extrabold ${isKhatam ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}">${percent}%</span>
                        </div>
                        <div class="w-full bg-slate-100 dark:bg-[#1c2836] h-1.5 rounded-full overflow-hidden">
                            <div class="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-500" style="width: ${percent}%;"></div>
                        </div>
                        <div class="flex items-center justify-between gap-1">
                            ${isExcused ? `
                            <span class="inline-block px-1.5 py-0.2 text-[8px] font-bold rounded bg-slate-100 text-slate-600 dark:bg-[#1c2836] dark:text-slate-300 border border-slate-200 dark:border-[#283a4e]" title="Dikecualikan sementara dari target pekanan">
                                Dikecualikan (${presStatus === 'SAKIT' ? 'Sakit' : (presStatus === 'PULANG' ? 'Pulang' : 'Izin')})
                            </span>
                            ` : `
                            <span class="inline-block px-1.5 py-0.2 text-[8px] font-extrabold rounded ${isOnTrack ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-[#1c2836] dark:text-slate-400'}">
                                ${escapeHtml(onTrackStatus)}
                            </span>
                            `}
                        </div>
                        <!-- Mini Badge Rotasi Muroja'ah (Sabqi & Manzil) -->
                        <div class="flex items-center gap-1 pt-0.5">
                            <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40" title="Muroja'ah Sabqi: Juz ${currentJuz} (${sabqiDisp})">
                                <i class="fa-solid fa-rotate-left text-[7px] text-amber-600"></i>
                                <span>Sabqi: ${sabqiDisp}</span>
                            </span>
                            <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold bg-sky-50 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800/40" title="Muroja'ah Manzil: Juz ${manzilJuz} Hlm ${manzilHalaman} (Putaran Ke-${manzilPutaran})">
                                <i class="fa-solid fa-repeat text-[7px] text-sky-600"></i>
                                <span>Manzil: J${manzilJuz} (P${manzilPutaran})</span>
                            </span>
                        </div>
                    </div>
                </td>

                <!-- 6. AKSI -->
                <td class="px-3.5 py-2.5 text-right">
                    <div class="flex items-center justify-end space-x-1">
                        <button type="button" onclick="openTahfidzCatatModal('${st.studentId}')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 shadow-sm active:scale-95" title="Catat Setoran">
                            <i class="fa-solid fa-plus text-[9px]"></i>
                            <span>Catat</span>
                        </button>
                        <button type="button" onclick="openTahfidzStudentDetail('${st.studentId}')" class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#1c2836] dark:hover:bg-[#253447] text-slate-600 dark:text-slate-300 flex items-center justify-center transition active:scale-95" title="Detail Riwayat & Mutaba'ah">
                            <i class="fa-solid fa-clock-rotate-left text-[11px]"></i>
                        </button>
                        <button type="button" onclick="printTahfidzStudentCard('${st.studentId}')" class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#1c2836] dark:hover:bg-[#253447] text-slate-600 dark:text-slate-300 flex items-center justify-center transition active:scale-95" title="Cetak Rapor Mutaba'ah">
                            <i class="fa-solid fa-print text-[11px]"></i>
                        </button>
                    </div>
                </td>
            </tr>
            `;
        }).join('');
    }

    // Mobile List Card HTML (Compact)
    if (mobileContainer) {
        mobileContainer.innerHTML = students.map(st => {
            const initials = (st.name || 'Santri').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'SN';
            const inHal = isStudentInHalaqah(st);
            const halaqahName = inHal ? (st.halaqah?.namaHalaqah || 'Halaqah Aktif') : 'Belum Masuk Halaqah';
            const last = st.setoranTerakhir;
            const isUlang = last && (last.statusSetoran === 'ULANG' || last.nilai === 'DHAIF');
            const cap = st.capaian || {};
            const mur = st.murojaah || {};

            const currentJuz = Number(cap.juzAktif) || Number(st.progress?.currentJuz) || 30;
            const currentHal = Number(cap.halamanTerakhir) || Number(st.progress?.currentHalaman) || 1;
            const curProg = getCurriculumProgress(currentJuz, currentHal);
            const isKhatam = Boolean(st.progress?.isKhatam) || curProg.isKhatam || (Number(cap.totalHalamanTuntas || st.progress?.totalHalamanTuntas || 0) >= 600);
            const percent = isKhatam ? 100 : curProg.percent;
            const targetZ = st.target?.ziyadahSesi || 1;
            const targetM = st.target?.murajaahSesi || 2;
            const isSelected = ASNTahfidz.selectedStudentIds && ASNTahfidz.selectedStudentIds.has(st.studentId);

            const presStatus = getStudentPresensiStatus(st);
            const isExcused = ['SAKIT', 'IZIN', 'PULANG'].includes(presStatus);

            const sabqiHalaman = mur.sabqiHalaman || cap.sabqiHalaman || '';
            const sabqiDisp = sabqiHalaman ? `Hlm ${sabqiHalaman}` : `Juz ${currentJuz}`;
            const manzilJuz = Number(mur.manzilJuz || cap.manzilJuz) || 1;
            const manzilHalaman = Number(mur.manzilHalaman || cap.manzilHalaman) || 1;
            const manzilPutaran = Number(mur.manzilPutaran || cap.manzilPutaran) || 1;
            const targetMPekan = st.target?.murajaahPekan || (targetM * 5);
            const rekapM = st.rekapPekan?.murojaah || { realita: 0, isTuntas: false, sisaHalaman: targetMPekan };

            return `
            <div class="p-3 bg-white dark:bg-[#15202d] rounded-2xl border ${isSelected ? 'border-amber-400 dark:border-amber-600 bg-amber-50/20' : 'border-slate-100 dark:border-[#253447]'} shadow-sm space-y-2.5">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-2.5 min-w-0">
                        <div class="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-extrabold flex items-center justify-center text-xs shrink-0">
                            ${st.photoUrl ? `<img src="${escapeHtml(st.photoUrl)}" class="w-full h-full object-cover rounded-full">` : initials}
                        </div>
                        <div class="min-w-0">
                            <h4 class="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">${escapeHtml(st.name)}</h4>
                            <p class="text-[10px] text-slate-400">NIS: ${escapeHtml(st.nis || '-')} • <span class="${inHal ? 'text-emerald-600 font-semibold' : 'text-amber-600 dark:text-amber-400 font-semibold'}">${escapeHtml(halaqahName)}</span> ${isExcused ? `<span class="ml-1 px-1.5 py-0.2 rounded text-[8px] font-black ${presStatus === 'SAKIT' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300' : (presStatus === 'PULANG' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300')}">${presStatus === 'SAKIT' ? '🏥 Sakit' : (presStatus === 'PULANG' ? '🏠 Pulang' : '📝 Izin')}</span>` : ''}</p>
                        </div>
                    </div>
                    <button type="button" onclick="openTahfidzCatatModal('${st.studentId}')" class="px-2.5 py-1 bg-emerald-600 text-white font-bold text-xs rounded-lg shadow-sm">
                        + Catat
                    </button>
                </div>

                <!-- Mini Target Pills with Weekly Reality -->
                <div class="space-y-1">
                    <div class="flex items-center gap-1.5 text-[9px] font-bold">
                        <span onclick="openTahfidzTargetModal('${st.studentId}')" class="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 cursor-pointer">
                            Ziyadah: ${targetZ} Hlm/Setor
                        </span>
                        <span onclick="openTahfidzTargetModal('${st.studentId}')" class="px-2 py-0.5 rounded bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 cursor-pointer">
                            Muroja'ah: ${targetM} Hlm/Setor
                        </span>
                    </div>
                    <div class="flex items-center justify-between text-[9px] font-bold px-1 text-slate-500 dark:text-slate-400">
                        <span>Muroja'ah Pekan Ini: <b>${rekapM.realita || 0}/${targetM * 5} Hlm</b></span>
                        <span class="px-1.5 py-0.2 rounded ${rekapM.isTuntas ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300' : ((rekapM.realita || 0) > 0 ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300' : (isExcused ? 'bg-slate-100 dark:bg-[#1c2836] text-slate-400' : 'bg-slate-100 dark:bg-[#1c2836] text-slate-400'))}">
                            ${rekapM.isTuntas ? '✅ Tuntas Target' : ((rekapM.realita || 0) > 0 ? `⚠️ Kurang ${rekapM.sisaHalaman} Hlm` : (isExcused ? 'Dikecualikan' : 'Belum'))}
                        </span>
                    </div>
                </div>

                <!-- Progress Bar -->
                <div class="space-y-1">
                    <div class="flex justify-between text-xs font-bold">
                        <span>Capaian: Juz ${currentJuz} / 30</span>
                        <span class="text-emerald-600">${percent}%</span>
                    </div>
                    <div class="w-full bg-slate-100 dark:bg-[#1c2836] h-1.5 rounded-full overflow-hidden">
                        <div class="bg-emerald-600 h-full rounded-full" style="width: ${percent}%;"></div>
                    </div>
                </div>

                <!-- Info Rotasi Muroja'ah (Sabqi & Manzil) -->
                <div class="flex items-center justify-between text-[10px] font-bold bg-slate-50 dark:bg-[#1c2836] px-2.5 py-1.5 rounded-xl border border-slate-200/70 dark:border-[#253447]">
                    <span class="flex items-center gap-1 text-amber-700 dark:text-amber-300">
                        <i class="fa-solid fa-rotate-left text-[9px] text-amber-500"></i>
                        <span>Sabqi: <b>${sabqiDisp}</b></span>
                    </span>
                    <span class="flex items-center gap-1 text-sky-700 dark:text-sky-300">
                        <i class="fa-solid fa-repeat text-[9px] text-sky-500"></i>
                        <span>Manzil: <b>Juz ${manzilJuz} (P${manzilPutaran})</b></span>
                    </span>
                </div>

                <div class="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-[#253447] text-[10px] text-slate-400">
                    <span>${isExcused ? `<b class="text-amber-600 dark:text-amber-400">${presStatus === 'SAKIT' ? '🏥 Sakit' : (presStatus === 'PULANG' ? '🏠 Pulang' : '📝 Izin')}</b> • Dikecualikan target` : (last ? `Terakhir: Juz ${last.juz} (${last.tipe === 'MURAJAAH_SABQI' ? 'Sabqi' : (last.tipe === 'MURAJAAH_MANZIL' ? 'Manzil' : (last.tipe === 'ZIYADAH' ? 'Ziyadah' : last.tipe))}) ${isUlang ? '• <span class="text-rose-600 font-extrabold">Wajib Ulang</span>' : ''}` : 'Belum setor')}</span>
                    <button type="button" onclick="openTahfidzStudentDetail('${st.studentId}')" class="text-emerald-600 font-bold hover:underline">
                        Lihat Mutaba'ah &gt;
                    </button>
                </div>
            </div>
            `;
        }).join('');
    }

    // Update Bulk Selection Action Bar
    updateTahfidzBulkSelectionBar();
}

// ====================================================================
// 2. MODAL: CATAT SETORAN TAHFIDZ (Screenshot 5)
// ====================================================================

/**
 * Atur keputusan status setoran (LANJUT vs ULANG)
 */
function setTahfidzStatusDecision(decision) {
    ASNTahfidz.catatState.statusSetoran = decision;

    const radioLanjut = document.getElementById('radio-status-lanjut');
    const radioUlang = document.getElementById('radio-status-ulang');
    const labelLanjut = document.getElementById('label-status-lanjut');
    const labelUlang = document.getElementById('label-status-ulang');
    const badgePreview = document.getElementById('tahfidz-status-badge-preview');
    const hint = document.getElementById('tahfidz-status-hint');

    if (decision === 'ULANG') {
        if (radioUlang) radioUlang.checked = true;
        if (radioLanjut) radioLanjut.checked = false;
        if (labelUlang) {
            labelUlang.className = "flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 border-rose-500 bg-rose-50/90 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 cursor-pointer font-bold text-xs transition";
        }
        if (labelLanjut) {
            labelLanjut.className = "flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 border-slate-200 dark:border-[#283a4e] bg-white dark:bg-[#15202d] text-slate-600 dark:text-slate-400 cursor-pointer font-bold text-xs transition hover:border-emerald-300";
        }
        if (badgePreview) {
            badgePreview.innerText = "Wajib Ulang (I'adah)";
            badgePreview.className = "text-[9px] font-black px-2 py-0.5 rounded-md uppercase bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300";
        }
        if (hint) {
            hint.innerHTML = `<span class="text-rose-600 dark:text-rose-400 font-semibold"><i class="fa-solid fa-triangle-exclamation mr-1"></i> Santri dinilai belum lancar. Posisi capaian hafalan belum bertambah, santri wajib mengulang halaman ini pada sesi berikutnya.</span>`;
        }
    } else {
        if (radioLanjut) radioLanjut.checked = true;
        if (radioUlang) radioUlang.checked = false;
        if (labelLanjut) {
            labelLanjut.className = "flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 border-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 cursor-pointer font-bold text-xs transition";
        }
        if (labelUlang) {
            labelUlang.className = "flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 border-slate-200 dark:border-[#283a4e] bg-white dark:bg-[#15202d] text-slate-600 dark:text-slate-400 cursor-pointer font-bold text-xs transition hover:border-rose-300";
        }
        if (badgePreview) {
            badgePreview.innerText = "Lulus & Lanjut";
            badgePreview.className = "text-[9px] font-black px-2 py-0.5 rounded-md uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
        }
        if (hint) {
            hint.innerText = "Santri dinyatakan tuntas dan berhak melanjutkan hafalan ke halaman berikutnya.";
        }
    }
}

/**
 * Mengisi dropdown muhafiz di modal catat setoran
 * Otomatis mendeteksi muhafiz halaqah santri sebagai default (selected)
 * dan menampilkan daftar muhafiz lain untuk antisipasi jika berhalangan.
 */
function populateTahfidzMuhafizSelector(studentId) {
    const selMuh = document.getElementById('tahfidz-catat-muhafiz');
    const badge = document.getElementById('tahfidz-catat-muhafiz-badge');
    const customContainer = document.getElementById('container-tahfidz-muhafiz-manual');
    const customInput = document.getElementById('tahfidz-catat-muhafiz-manual');
    if (!selMuh) return;

    if (customContainer) customContainer.classList.add('hidden');
    if (customInput) customInput.value = '';

    // Ambil data santri
    const st = studentId ? (ASNTahfidz.data.students || []).find(s => (s.studentId === studentId || s.nis === studentId)) : null;

    // Cari halaqah santri dan nama muhafiz pengampu halaqahnya
    let halaqahMuhafiz = "";
    let halaqahName = "";
    if (st) {
        if (st.halaqah && st.halaqah.muhafiz) {
            halaqahMuhafiz = st.halaqah.muhafiz;
            halaqahName = st.halaqah.namaHalaqah || "";
        }
        if (!halaqahMuhafiz && st.halaqahId) {
            const hObj = (ASNTahfidz.data.halaqahs || []).find(h => (h.halaqahId === st.halaqahId || h.id === st.halaqahId || h.namaHalaqah === st.namaHalaqah));
            if (hObj && hObj.muhafiz) {
                halaqahMuhafiz = hObj.muhafiz;
                halaqahName = hObj.namaHalaqah || "";
            }
        }
        if (!halaqahMuhafiz && st.setoranTerakhir?.muhafiz) {
            halaqahMuhafiz = st.setoranTerakhir.muhafiz;
        }
    }

    // Kumpulkan seluruh daftar nama muhafiz unik di sistem
    const setMuhafiz = new Set();
    if (halaqahMuhafiz) setMuhafiz.add(halaqahMuhafiz.trim());

    (ASNTahfidz.data.muhafizList || []).forEach(m => {
        if (m && m !== 'ALL' && m !== 'Semua Muhafiz') setMuhafiz.add(String(m).trim());
    });

    (ASNTahfidz.data.halaqahs || []).forEach(h => {
        if (h && h.muhafiz) setMuhafiz.add(String(h.muhafiz).trim());
    });

    // Buat opsi HTML
    let optHtml = '';
    if (halaqahMuhafiz) {
        optHtml += `<option value="${escapeHtml(halaqahMuhafiz)}" selected>⭐️ ${escapeHtml(halaqahMuhafiz)} (Muhafiz Halaqah${halaqahName ? ': ' + escapeHtml(halaqahName) : ''})</option>`;
        if (badge) {
            badge.innerText = `Halaqah: ${halaqahMuhafiz}`;
            badge.className = "text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
        }
    } else {
        optHtml += `<option value="">-- Pilih Muhafiz Penyimak --</option>`;
        if (badge) {
            badge.innerText = "Pilih Muhafiz";
            badge.className = "text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
        }
    }

    // Opsi muhafiz lainnya (pengganti / badal)
    Array.from(setMuhafiz).sort().forEach(m => {
        if (m !== halaqahMuhafiz) {
            optHtml += `<option value="${escapeHtml(m)}">${escapeHtml(m)} (Asatidz / Badal)</option>`;
        }
    });

    optHtml += `<option value="__CUSTOM__">✍️ + Tulis Nama Lain (Manual)...</option>`;
    selMuh.innerHTML = optHtml;

    // Listener jika memilih custom manual
    selMuh.onchange = function() {
        if (this.value === '__CUSTOM__') {
            if (customContainer) customContainer.classList.remove('hidden');
            if (customInput) customInput.focus();
            if (badge) badge.innerText = "Ketik Manual";
        } else {
            if (customContainer) customContainer.classList.add('hidden');
            if (badge) {
                badge.innerText = (this.value === halaqahMuhafiz && halaqahMuhafiz) ? `Halaqah: ${halaqahMuhafiz}` : "Pengganti / Badal";
            }
        }
    };
}

/**
 * Cek apakah santri sedang dalam status wajib mengulang dari setoran terakhir
 */
function checkAndApplyStudentRepeatState(studentId) {
    const banner = document.getElementById('tahfidz-catat-ulang-banner');
    const bannerInfo = document.getElementById('tahfidz-catat-ulang-info');
    const selJuz = document.getElementById('tahfidz-catat-juz');

    if (!studentId) {
        if (banner) banner.classList.add('hidden');
        setTahfidzStatusDecision('LANJUT');
        return;
    }

    const st = (ASNTahfidz.data.students || []).find(s => (s.studentId === studentId || s.nis === studentId));
    const last = st?.setoranTerakhir;

    if (last && (last.statusSetoran === 'ULANG' || last.nilai === 'DHAIF')) {
        if (banner) banner.classList.remove('hidden');
        if (bannerInfo) {
            bannerInfo.innerHTML = `Setoran terakhir santri pada <b>${escapeHtml(last.tanggal || 'sebelumnya')}</b> (Nilai: <b>${escapeHtml(last.nilai)}</b>) belum tuntas. Wajib mengulang <b>Juz ${last.juz || 1} ${escapeHtml(last.halaman || '')}</b>.`;
        }
        if (selJuz && last.juz) {
            selJuz.value = String(last.juz);
        }
        // Prefill halaman yang diulang
        const parsedPage = parseInt(String(last.halaman || '').replace(/\D+/g, '')) || 1;
        ASNTahfidz.catatState.selectedPages = [parsedPage];
        renderTahfidzPageSelector();
    } else {
        if (banner) banner.classList.add('hidden');
        // Pre-select juz & halaman rekomendasi berikutnya dari Tahfidz_Capaian
        if (st?.capaian && st.capaian.juzAktif) {
            if (selJuz) selJuz.value = String(st.capaian.juzAktif);
            const targetPage = Math.min(20, Math.max(1, Number(st.capaian.halamanTerakhir) || 1));
            ASNTahfidz.catatState.selectedPages = [targetPage];
            renderTahfidzPageSelector();
        }
    }
}

/**
 * Mengisi dropdown Sesi Waktu di modal Catat Setoran sesuai DAFTAR JADWAL SESI WAKTU AKTIF
 */
function populateTahfidzCatatSesiDropdown(selectedSesi = null) {
    const selSesi = document.getElementById('tahfidz-catat-sesi');
    if (!selSesi) return;

    let sesiList = ASNTahfidz.data.sesiList;
    if (!sesiList || sesiList.length === 0) {
        sesiList = [
            { sesiId: "SESI-01", id: "SESI-01", namaSesi: "Pagi (Ba'da Subuh)", nama: "Pagi (Ba'da Subuh)", jamMulai: "05:00", jamSelesai: "06:00", status: "Aktif Digunakan" },
            { sesiId: "SESI-02", id: "SESI-02", namaSesi: "Pagi (MA Tahfidz)", nama: "Pagi (MA Tahfidz)", jamMulai: "08:00", jamSelesai: "09:00", status: "Aktif Digunakan" },
            { sesiId: "SESI-03", id: "SESI-03", namaSesi: "Sore (Ba'da Ashar)", nama: "Sore (Ba'da Ashar)", jamMulai: "16:00", jamSelesai: "17:00", status: "Aktif Digunakan" }
        ];
    }

    // Filter hanya sesi yang AKTIF (status mengandung 'Aktif' dan bukan 'Nonaktif')
    const activeList = sesiList.filter(s => {
        const st = String(s.status || 'Aktif Digunakan').toLowerCase();
        return st.includes('aktif') && !st.includes('nonaktif');
    });

    const listToRender = activeList.length > 0 ? activeList : sesiList;
    const currentVal = selectedSesi || selSesi.value || ASNTahfidz.catatState.sesi || "";

    selSesi.innerHTML = listToRender.map((s, idx) => {
        const nama = s.namaSesi || s.nama || `Sesi 0${idx + 1}`;
        const jmMulai = typeof cleanSesiTime === 'function' ? cleanSesiTime(s.jamMulai, '05:00') : (s.jamMulai || '05:00');
        const jmSelesai = typeof cleanSesiTime === 'function' ? cleanSesiTime(s.jamSelesai, '06:00') : (s.jamSelesai || '06:00');
        const timeStr = `${jmMulai} - ${jmSelesai} WIB`;
        const label = `${nama} ${timeStr}`;
        const isSelected = (currentVal && (currentVal === nama || currentVal === label)) ? 'selected' : (idx === 0 && !currentVal ? 'selected' : '');
        return `<option value="${escapeHtml(nama)}" ${isSelected}>${escapeHtml(label)}</option>`;
    }).join('');

    if (selSesi.value) {
        ASNTahfidz.catatState.sesi = selSesi.value;
    }

    selSesi.onchange = function() {
        ASNTahfidz.catatState.sesi = this.value;
    };
}

/**
 * Switch mode satuan setoran: HALAMAN vs AYAT vs JUZ (Tasmi' Multi-Juz / Manzil)
 */
function setTahfidzSatuanMode(mode) {
    ASNTahfidz.catatState.inputMode = mode;
    const btnHal = document.getElementById('btn-mode-halaman');
    const btnAyat = document.getElementById('btn-mode-ayat');
    const btnJuz = document.getElementById('btn-mode-juz');
    const contHal = document.getElementById('container-mode-halaman');
    const contAyat = document.getElementById('container-mode-ayat');
    const contJuz = document.getElementById('container-mode-juz');
    const rowJuzSingle = document.getElementById('row-tahfidz-catat-juz-single');

    const defaultClass = "px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:text-emerald-600";
    const defaultJuzClass = "px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:text-purple-600";

    if (mode === 'AYAT') {
        if (btnAyat) btnAyat.className = "px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 bg-emerald-600 text-white shadow-sm";
        if (btnHal) btnHal.className = defaultClass;
        if (btnJuz) btnJuz.className = defaultJuzClass;

        if (rowJuzSingle) rowJuzSingle.classList.remove('hidden');
        if (contHal) contHal.classList.add('hidden');
        if (contJuz) contJuz.classList.add('hidden');
        if (contAyat) contAyat.classList.remove('hidden');

        // Populate surah for current juz
        const currentJuz = Number(document.getElementById('tahfidz-catat-juz')?.value || ASNTahfidz.catatState.juz || 30);
        populateTahfidzSurahDropdown(currentJuz, ASNTahfidz.catatState.surahNo);
        onTahfidzAyatChange();
    } else if (mode === 'JUZ') {
        if (btnJuz) btnJuz.className = "px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 bg-purple-600 text-white shadow-sm";
        if (btnHal) btnHal.className = defaultClass;
        if (btnAyat) btnAyat.className = defaultClass;

        if (rowJuzSingle) rowJuzSingle.classList.add('hidden');
        if (contHal) contHal.classList.add('hidden');
        if (contAyat) contAyat.classList.add('hidden');
        if (contJuz) contJuz.classList.remove('hidden');

        const currentJuz = Number(document.getElementById('tahfidz-catat-juz')?.value || ASNTahfidz.catatState.juz || 30);
        populateTahfidzJuzRangeDropdowns(currentJuz, currentJuz);
    } else {
        if (btnHal) btnHal.className = "px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 bg-emerald-600 text-white shadow-sm";
        if (btnAyat) btnAyat.className = defaultClass;
        if (btnJuz) btnJuz.className = defaultJuzClass;

        if (rowJuzSingle) rowJuzSingle.classList.remove('hidden');
        if (contAyat) contAyat.classList.add('hidden');
        if (contJuz) contJuz.classList.add('hidden');
        if (contHal) contHal.classList.remove('hidden');

        renderTahfidzPageSelector();
    }
}

/**
 * Dapatkan rentang surah awal sampai akhir untuk rentang juz
 */
function getSurahRangeForJuz(start, end) {
    if (start === end) {
        return SURAH_JUZ_REFERENCE[start] || `Juz ${start}`;
    }
    const refStart = SURAH_JUZ_REFERENCE[start] || '';
    const refEnd = SURAH_JUZ_REFERENCE[end] || '';
    const surahAwal = refStart.split(' - ')[0] || `Juz ${start}`;
    const surahAkhir = refEnd.includes(' - ') ? refEnd.split(' - ')[1] : (refEnd || `Juz ${end}`);
    return `${surahAwal} - ${surahAkhir}`;
}

/**
 * Mengisi dropdown rentang Juz (Dari Juz X s/d Juz Y) untuk Mode Per Juz / Tasmi' sesuai urutan kurikulum (30-21, lalu 1-20)
 */
function populateTahfidzJuzRangeDropdowns(startJuz = 30, endJuz = 30) {
    const selStart = document.getElementById('tahfidz-catat-juz-mulai');
    const selEnd = document.getElementById('tahfidz-catat-juz-sampai');
    if (!selStart || !selEnd) return;

    let opts = '';
    JUZ_CURRICULUM_ORDER.forEach((j) => {
        opts += `<option value="${j}">Juz ${j} (${SURAH_JUZ_REFERENCE[j] || ''})</option>`;
    });
    selStart.innerHTML = opts;
    selEnd.innerHTML = opts;

    selStart.value = String(startJuz);
    selEnd.value = String(endJuz);

    onTahfidzJuzRangeChange();
}

/**
 * Update highlight chip preset aktif pada Mode Per Juz / Tasmi'
 */
function updateTahfidzPresetChipHighlight(count) {
    const chips = document.querySelectorAll('.btn-tahfidz-preset');
    chips.forEach(btn => {
        const p = Number(btn.dataset.preset);
        if (p === count) {
            if (p === 30) {
                btn.className = "btn-tahfidz-preset px-2.5 py-1 bg-gradient-to-r from-purple-700 to-indigo-700 text-white font-extrabold rounded-lg text-[10px] transition active:scale-95 shadow-md ring-2 ring-purple-400/80";
            } else {
                btn.className = "btn-tahfidz-preset px-2.5 py-1 bg-purple-600 text-white font-black rounded-lg border border-purple-600 text-[10px] transition active:scale-95 shadow-sm ring-2 ring-purple-400/50";
            }
        } else {
            if (p === 30) {
                btn.className = "btn-tahfidz-preset px-2.5 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-lg text-[10px] transition active:scale-95 opacity-85 hover:opacity-100 shadow-xs";
            } else {
                btn.className = "btn-tahfidz-preset px-2.5 py-1 bg-white dark:bg-[#15202d] hover:bg-purple-100 dark:hover:bg-purple-900/50 text-slate-700 dark:text-slate-200 hover:text-purple-800 font-bold rounded-lg border border-purple-200 dark:border-purple-800/60 text-[10px] transition active:scale-95 shadow-xs";
            }
        }
    });
}

/**
 * Handler saat rentang Juz pada mode Per Juz berubah (Mendukung urutan Kurikulum Pesantren 30-21 & 1-20)
 */
function onTahfidzJuzRangeChange() {
    const selStart = document.getElementById('tahfidz-catat-juz-mulai');
    const selEnd = document.getElementById('tahfidz-catat-juz-sampai');
    if (!selStart || !selEnd) return;

    let start = Number(selStart.value) || JUZ_CURRICULUM_ORDER[0];
    let end = Number(selEnd.value) || start;

    let idxStart = JUZ_CURRICULUM_ORDER.indexOf(start);
    let idxEnd = JUZ_CURRICULUM_ORDER.indexOf(end);
    if (idxStart === -1) idxStart = 0;
    if (idxEnd === -1) idxEnd = idxStart;

    let count = 1;
    if (idxEnd >= idxStart) {
        // Mengikuti urutan kurikulum resmi pesantren (30 s/d 21, lalu 1 s/d 20)
        count = idxEnd - idxStart + 1;
    } else if (start <= end) {
        // Fallback jika dipilih secara numerik berurutan
        count = end - start + 1;
    } else {
        // Jika posisi End tidak valid atau mendahului Start, samakan dengan start
        end = start;
        selEnd.value = String(end);
        count = 1;
    }

    // Standar mushaf pojok 20 halaman per juz, khusus 30 juz khataman total 604 halaman
    const totalPages = (count === 30) ? 604 : (count * 20);

    ASNTahfidz.catatState.juz = start;
    ASNTahfidz.catatState.juzStart = start;
    ASNTahfidz.catatState.juzEnd = end;
    ASNTahfidz.catatState.totalJuz = count;
    ASNTahfidz.catatState.totalHalaman = totalPages;

    // Selaraskan juga dropdown juz utama
    const selJuz = document.getElementById('tahfidz-catat-juz');
    if (selJuz) selJuz.value = String(start);

    const summaryRange = document.getElementById('tahfidz-juz-range-summary');
    const summarySurah = document.getElementById('tahfidz-juz-surah-summary');
    const badgeCount = document.getElementById('tahfidz-juz-count-badge');
    const badgePages = document.getElementById('tahfidz-juz-pages-badge');

    const surahRange = getSurahRangeForJuz(start, end);

    if (summaryRange) {
        summaryRange.innerHTML = `<i class="fa-solid fa-book-open text-purple-600 dark:text-purple-400"></i> ${start === end ? `Juz ${start}` : `Juz ${start} s/d Juz ${end}`}`;
    }
    if (summarySurah) {
        summarySurah.innerText = `Surah ${surahRange}`;
    }
    if (badgeCount) {
        badgeCount.innerText = `${count} JUZ PENUH`;
    }
    if (badgePages) {
        badgePages.innerText = `${totalPages} HALAMAN`;
    }

    // Update global state & ringkasan header
    const summaryBadge = document.getElementById('tahfidz-page-summary-badge');
    const summaryList = document.getElementById('tahfidz-page-summary-list');
    if (summaryBadge) {
        summaryBadge.innerText = `TERPILIH: ${count} JUZ (${totalPages} HAL)`;
    }
    if (summaryList) {
        summaryList.innerText = start === end ? `Juz ${start} (20 Halaman)` : `Juz ${start} - ${end} (${count} Juz, ${totalPages} Halaman)`;
    }

    updateTahfidzPresetChipHighlight(count);
}

/**
 * Terapkan Pilihan Cepat Kategori Ujian Tasmi' (1, 3, 5, 10, 15, 30 Juz) Sesuai Kurikulum
 */
function applyTahfidzJuzPreset(presetCount) {
    const selStart = document.getElementById('tahfidz-catat-juz-mulai');
    const selEnd = document.getElementById('tahfidz-catat-juz-sampai');
    if (!selStart || !selEnd) return;

    let start = Number(selStart.value) || JUZ_CURRICULUM_ORDER[0];
    let idxStart = JUZ_CURRICULUM_ORDER.indexOf(start);
    if (idxStart === -1) idxStart = 0;

    if (presetCount === 30) {
        idxStart = 0;
        selStart.value = String(JUZ_CURRICULUM_ORDER[0]);
        selEnd.value = String(JUZ_CURRICULUM_ORDER[JUZ_CURRICULUM_ORDER.length - 1]);
    } else {
        let idxEnd = idxStart + presetCount - 1;
        if (idxEnd >= JUZ_CURRICULUM_ORDER.length) {
            idxEnd = JUZ_CURRICULUM_ORDER.length - 1;
            idxStart = Math.max(0, JUZ_CURRICULUM_ORDER.length - presetCount);
            selStart.value = String(JUZ_CURRICULUM_ORDER[idxStart]);
        }
        selEnd.value = String(JUZ_CURRICULUM_ORDER[idxEnd]);
    }

    onTahfidzJuzRangeChange();
}

/**
 * Mengisi dropdown Juz berdasarkan urutan kurikulum (30, 29, ..., 21, 1, ..., 20)
 */
function populateTahfidzJuzDropdown(selectedJuz = null) {
    const selJuz = document.getElementById('tahfidz-catat-juz');
    if (!selJuz) return;

    let juzHtml = '';
    JUZ_CURRICULUM_ORDER.forEach((j) => {
        juzHtml += `<option value="${j}">Juz ${j} (${SURAH_JUZ_REFERENCE[j] || ''})</option>`;
    });
    selJuz.innerHTML = juzHtml;

    const targetVal = selectedJuz ? String(selectedJuz) : (JUZ_CURRICULUM_ORDER[0] ? String(JUZ_CURRICULUM_ORDER[0]) : "30");
    selJuz.value = targetVal;
    ASNTahfidz.catatState.juz = Number(targetVal);
}

/**
 * Mengisi dropdown Surah berdasarkan Juz terpilih
 */
function populateTahfidzSurahDropdown(juz, preselectedSurahNo = null) {
    const selSurah = document.getElementById('tahfidz-catat-surah');
    if (!selSurah) return;

    const surahs = getSurahsByJuz(juz);
    let optHtml = '';
    surahs.forEach(s => {
        optHtml += `<option value="${s.no}">${s.no}. ${s.name} (${s.ayat} Ayat)</option>`;
    });
    selSurah.innerHTML = optHtml;

    if (preselectedSurahNo && surahs.some(s => s.no === Number(preselectedSurahNo))) {
        selSurah.value = String(preselectedSurahNo);
    } else if (surahs.length > 0) {
        selSurah.value = String(surahs[0].no);
    }

    onTahfidzSurahChange();
}

/**
 * Handler saat Juz diubah pada dropdown
 */
function onTahfidzJuzChange(juzVal) {
    const juz = Number(juzVal || 30);
    ASNTahfidz.catatState.juz = juz;

    if (ASNTahfidz.catatState.inputMode === 'AYAT') {
        populateTahfidzSurahDropdown(juz);
    } else {
        renderTahfidzPageSelector();
    }
}

/**
 * Handler saat Surah diubah pada dropdown mode per ayat
 */
function onTahfidzSurahChange() {
    const selSurah = document.getElementById('tahfidz-catat-surah');
    const inputMulai = document.getElementById('tahfidz-catat-ayat-mulai');
    const inputSampai = document.getElementById('tahfidz-catat-ayat-sampai');
    const infoEl = document.getElementById('tahfidz-surah-info');

    if (!selSurah) return;
    const surahNo = Number(selSurah.value);
    const surahObj = QURAN_114_SURAHS.find(s => s.no === surahNo) || { name: `Surah ${surahNo}`, ayat: 40 };

    ASNTahfidz.catatState.surahNo = surahNo;
    ASNTahfidz.catatState.surahName = surahObj.name;

    if (inputMulai) {
        inputMulai.max = surahObj.ayat;
        if (!inputMulai.value || Number(inputMulai.value) > surahObj.ayat) inputMulai.value = "1";
    }
    if (inputSampai) {
        inputSampai.max = surahObj.ayat;
        const defaultSampai = Math.min(surahObj.ayat, (Number(inputMulai?.value) || 1) + 9);
        inputSampai.value = String(defaultSampai);
    }

    if (infoEl) {
        infoEl.innerHTML = `<i class="fa-solid fa-circle-info text-emerald-500"></i> <span>Surah <b>${escapeHtml(surahObj.name)}</b> (${surahObj.ayat} Ayat)</span>`;
    }

    onTahfidzAyatChange();
}

/**
 * Handler saat input Ayat berubah (menghitung jumlah ayat & memetakan ke halaman mushaf pojok)
 */
function onTahfidzAyatChange() {
    const selSurah = document.getElementById('tahfidz-catat-surah');
    const inputMulai = document.getElementById('tahfidz-catat-ayat-mulai');
    const inputSampai = document.getElementById('tahfidz-catat-ayat-sampai');
    const countEl = document.getElementById('tahfidz-ayat-count-text');
    const badgeHalEl = document.getElementById('tahfidz-ayat-halaman-badge');
    const summaryBadge = document.getElementById('tahfidz-page-summary-badge');
    const summaryList = document.getElementById('tahfidz-page-summary-list');

    const juz = Number(document.getElementById('tahfidz-catat-juz')?.value || ASNTahfidz.catatState.juz || 30);
    const surahNo = Number(selSurah?.value || ASNTahfidz.catatState.surahNo || 78);
    const surahObj = QURAN_114_SURAHS.find(s => s.no === surahNo) || { name: `Surah ${surahNo}`, ayat: 40 };

    let a1 = Math.max(1, Math.min(surahObj.ayat, Number(inputMulai?.value) || 1));
    let a2 = Math.max(1, Math.min(surahObj.ayat, Number(inputSampai?.value) || a1));
    if (a2 < a1) a2 = a1;

    ASNTahfidz.catatState.ayatMulai = a1;
    ASNTahfidz.catatState.ayatSampai = a2;

    const totalAyat = (a2 - a1) + 1;
    if (countEl) countEl.innerText = `${totalAyat} Ayat`;

    // Kalkulasi pemetaan halaman mushaf pojok
    const mappedPages = mapSurahAyatToPage(juz, surahObj, a1, a2);
    ASNTahfidz.catatState.selectedPages = mappedPages;

    const halStr = mappedPages.length === 1 ? `Halaman ${mappedPages[0]}` : `Halaman ${mappedPages[0]} - ${mappedPages[mappedPages.length - 1]}`;
    if (badgeHalEl) {
        badgeHalEl.innerText = `± ${halStr} Mushaf`;
    }

    if (ASNTahfidz.catatState.inputMode === 'AYAT') {
        if (summaryList) {
            summaryList.innerText = `${surahObj.name} : Ayat ${a1} - ${a2} (${halStr})`;
        }
        if (summaryBadge) {
            summaryBadge.innerText = `TERPILIH: ${totalAyat} AYAT (${mappedPages.length} HAL)`;
        }
    }
}

/**
 * Buka modal catat setoran cepat
 */
function openTahfidzCatatModal(studentId = null) {
    const modal = document.getElementById('modal-tahfidz-catat');
    if (!modal) return;

    // Reset State (Default kurikulum diawali dari Juz 30)
    ASNTahfidz.catatState = {
        studentId: studentId || "",
        juz: 30,
        tipe: "ZIYADAH",
        selectedPages: [1],
        sesi: "Pagi (Ba'da Subuh)",
        nilai: "MUMTAZ",
        statusSetoran: "LANJUT",
        inputMode: "HALAMAN",
        surahNo: 78,
        surahName: "An-Naba'",
        ayatMulai: 1,
        ayatSampai: 10
    };

    // Reset Catatan Khusus Tajwid
    const catatanInput = document.getElementById('tahfidz-catat-catatan');
    if (catatanInput) catatanInput.value = "";

    // Populate Sesi Dropdown dari Jadwal Sesi Aktif
    populateTahfidzCatatSesiDropdown();

    // Populate Santri Select
    const selSantri = document.getElementById('tahfidz-catat-santri');
    if (selSantri && ASNTahfidz.data.students) {
        let optHtml = `<option value="">-- Pilih Santri --</option>`;
        ASNTahfidz.data.students.forEach(st => {
            const sId = st.studentId || st.student_id || st.id || "";
            const sName = st.name || st.nama || "";
            const sNis = st.nis || "";
            const sGender = st.gender || "L";
            const sHalaqahId = st.halaqah?.halaqahId || "";
            const sHalaqahName = st.halaqah?.namaHalaqah || "";
            const sMuhafiz = st.halaqah?.muhafiz || "";
            const selected = (studentId && (sId === studentId || sNis === studentId)) ? 'selected' : '';
            optHtml += `<option value="${escapeHtml(sId)}" 
                data-name="${escapeHtml(sName)}" 
                data-nis="${escapeHtml(sNis)}" 
                data-gender="${escapeHtml(sGender)}" 
                data-halaqah-id="${escapeHtml(sHalaqahId)}" 
                data-halaqah-name="${escapeHtml(sHalaqahName)}" 
                data-muhafiz="${escapeHtml(sMuhafiz)}" ${selected}>
                ${escapeHtml(sName || sId)} (${escapeHtml(sNis || '-')})
            </option>`;
        });
        selSantri.innerHTML = optHtml;

        selSantri.onchange = function() {
            checkAndApplyStudentRepeatState(this.value);
            populateTahfidzMuhafizSelector(this.value);
            applyTahfidzRecommendation(this.value, ASNTahfidz.catatState.tipe);
        };
    }

    // Set Tanggal hari ini
    const dateInput = document.getElementById('tahfidz-catat-tanggal');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
    }

    // Set Tipe Setoran Buttons (Ziyadah default)
    setTahfidzCatatTipe('ZIYADAH');

    // Populate Juz Dropdown Sesuai Urutan Kurikulum (30, 29, ..., 21, 1, 2, ..., 20)
    populateTahfidzJuzDropdown(30);

    // Set Nilai Default & Listener
    const nilaiSelect = document.getElementById('tahfidz-catat-nilai');
    if (nilaiSelect) {
        nilaiSelect.value = "MUMTAZ";
        nilaiSelect.onchange = function() {
            if (this.value === 'DHAIF') {
                setTahfidzStatusDecision('ULANG');
            } else {
                setTahfidzStatusDecision('LANJUT');
            }
        };
    }

    // Set Keputusan Default: LANJUT
    setTahfidzStatusDecision('LANJUT');

    // Default Satuan Setoran: HALAMAN
    setTahfidzSatuanMode('HALAMAN');

    // Render Grid Tombol Halaman 1-20 Mushaf Pojok
    renderTahfidzPageSelector();

    // Populate dan deteksi otomatis Muhafiz sesuai santri terpilih
    populateTahfidzMuhafizSelector(studentId);

    // Jika studentId diberikan, cek apakah santri sedang mengulang & terapkan rekomendasi cerdas
    if (studentId) {
        checkAndApplyStudentRepeatState(studentId);
        applyTahfidzRecommendation(studentId, ASNTahfidz.catatState.tipe);
    } else {
        const banner = document.getElementById('tahfidz-catat-ulang-banner');
        if (banner) banner.classList.add('hidden');
    }

    modal.classList.remove('hidden');
}

/**
 * Tutup modal catat setoran
 */
function closeTahfidzCatatModal() {
    const modal = document.getElementById('modal-tahfidz-catat');
    if (modal) modal.classList.add('hidden');
}

/**
 * Terapkan Rekomendasi Pintar Posisi Juz & Halaman berdasarkan Tipe Setoran (Ziyadah, Sabqi, Manzil, Tasmi')
 */
function applyTahfidzRecommendation(studentId, tipe) {
    if (!studentId) {
        studentId = document.getElementById('tahfidz-catat-santri')?.value || ASNTahfidz.catatState.studentId;
    }
    if (!tipe) {
        tipe = ASNTahfidz.catatState.tipe || 'ZIYADAH';
    }

    const st = (ASNTahfidz.data.students || []).find(s => 
        (s.studentId && s.studentId === studentId) ||
        (s.student_id && s.student_id === studentId) ||
        (s.id && s.id === studentId) ||
        (s.nis && s.nis === studentId)
    );

    const selJuz = document.getElementById('tahfidz-catat-juz');
    const badgeEl = document.getElementById('tahfidz-catat-tipe-badge');
    const descEl = document.getElementById('tahfidz-catat-tipe-desc');
    const posEl = document.getElementById('tahfidz-catat-tipe-pos');

    if (!st) {
        if (posEl) posEl.innerText = '-';
        return;
    }

    const cap = st.capaian || {};
    const mur = st.murojaah || {};

    const ziyadahJuz = Number(cap.juzAktif) || Number(st.progress?.currentJuz) || 30;
    const ziyadahHalaman = Number(cap.halamanTerakhir) || Number(st.progress?.currentHalaman) || 1;

    const manzilJuz = Number(mur.manzilJuz || cap.manzilJuz) || 30;
    const manzilHalaman = Number(mur.manzilHalaman || cap.manzilHalaman) || 1;
    const manzilPutaran = Number(mur.manzilPutaran || cap.manzilPutaran) || 1;

    const sabqiHalaman = String(mur.sabqiHalaman || cap.sabqiHalaman || '');

    if (tipe === 'ZIYADAH') {
        if (badgeEl) {
            badgeEl.innerText = 'Ziyadah (Hafalan Baru)';
            badgeEl.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
        }
        if (descEl) descEl.innerHTML = '<i class="fa-solid fa-circle-plus text-emerald-600"></i> <span>Hafalan baru (menentukan batas juz tertinggi)</span>';
        if (posEl) posEl.innerText = `Juz ${ziyadahJuz} Hlm ${ziyadahHalaman}`;

        if (selJuz) selJuz.value = String(ziyadahJuz);
        ASNTahfidz.catatState.juz = ziyadahJuz;
        ASNTahfidz.catatState.selectedPages = [Math.min(20, Math.max(1, ziyadahHalaman))];
        if (ASNTahfidz.catatState.inputMode === 'AYAT') {
            populateTahfidzSurahDropdown(ziyadahJuz);
        } else {
            renderTahfidzPageSelector();
        }
    } else if (tipe === 'MURAJAAH_SABQI') {
        if (badgeEl) {
            badgeEl.innerText = "Muroja'ah Sabqi (Dekat)";
            badgeEl.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
        }
        if (descEl) descEl.innerHTML = '<i class="fa-solid fa-rotate-left text-amber-600"></i> <span>Mengulang hafalan dekat di juz berjalan</span>';
        
        const sabqiDisp = sabqiHalaman ? `Hlm ${sabqiHalaman}` : `Hlm 1 - ${Math.max(1, ziyadahHalaman - 1)}`;
        if (posEl) posEl.innerText = `Juz ${ziyadahJuz} • ${sabqiDisp}`;

        if (selJuz) selJuz.value = String(ziyadahJuz);
        ASNTahfidz.catatState.juz = ziyadahJuz;
        // Default rentang halaman sabqi: halaman-halaman sebelum posisi ziyadah saat ini
        const sabqiEnd = Math.max(1, ziyadahHalaman > 1 ? ziyadahHalaman - 1 : 1);
        const sabqiStart = Math.max(1, sabqiEnd - 1);
        const sabqiPages = [];
        for (let p = sabqiStart; p <= sabqiEnd; p++) {
            sabqiPages.push(p);
        }
        ASNTahfidz.catatState.selectedPages = sabqiPages.length > 0 ? sabqiPages : [1];
        if (ASNTahfidz.catatState.inputMode === 'AYAT') {
            populateTahfidzSurahDropdown(ziyadahJuz);
        } else {
            renderTahfidzPageSelector();
        }
    } else if (tipe === 'MURAJAAH_MANZIL') {
        if (badgeEl) {
            badgeEl.innerText = `Muroja'ah Manzil (Putaran ${manzilPutaran})`;
            badgeEl.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300';
        }
        if (descEl) descEl.innerHTML = `<i class="fa-solid fa-repeat text-sky-600"></i> <span>Perputaran seluruh juz lama (Siklus Ke-${manzilPutaran})</span>`;
        if (posEl) posEl.innerText = `Juz ${manzilJuz} Hlm ${manzilHalaman} (Putaran ${manzilPutaran})`;

        if (selJuz) selJuz.value = String(manzilJuz);
        ASNTahfidz.catatState.juz = manzilJuz;
        const targetPage = Math.min(20, Math.max(1, manzilHalaman));
        ASNTahfidz.catatState.selectedPages = [targetPage];
        if (ASNTahfidz.catatState.inputMode === 'AYAT') {
            populateTahfidzSurahDropdown(manzilJuz);
        } else {
            renderTahfidzPageSelector();
        }
    } else if (tipe === 'TASMI') {
        if (badgeEl) {
            badgeEl.innerText = "Tasmi' Ujian Sekali Duduk";
            badgeEl.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300';
        }
        if (descEl) descEl.innerHTML = '<i class="fa-solid fa-award text-purple-600"></i> <span>Ujian tasmi\' bil ghoib sekali duduk (1, 3, 5, 10, 30 Juz)</span>';
        if (posEl) posEl.innerText = `Juz ${ziyadahJuz}`;

        if (selJuz) selJuz.value = String(ziyadahJuz);
        ASNTahfidz.catatState.juz = ziyadahJuz;
        setTahfidzSatuanMode('JUZ');
        populateTahfidzJuzRangeDropdowns(ziyadahJuz, ziyadahJuz);
    }
}

/**
 * Toggle Tipe Setoran (Ziyadah, Muroja'ah Sabqi, Muroja'ah Manzil, Tasmi')
 */
function setTahfidzCatatTipe(tipe) {
    ASNTahfidz.catatState.tipe = tipe;

    const btnZ = document.getElementById('btn-tipe-ziyadah');
    const btnSabqi = document.getElementById('btn-tipe-sabqi');
    const btnManzil = document.getElementById('btn-tipe-manzil');
    const btnT = document.getElementById('btn-tipe-tasmi');

    const defaultBtnClass = 'py-2.5 px-2 rounded-xl border font-bold text-xs flex flex-col items-center justify-center gap-1 transition active:scale-95 bg-slate-50 dark:bg-[#1c2836] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#283a4e]';

    [btnZ, btnSabqi, btnManzil, btnT].forEach(b => {
        if (!b) return;
        b.className = defaultBtnClass;
    });

    const rowJuzSingle = document.getElementById('row-tahfidz-catat-juz-single');
    const rowSatuan = document.getElementById('row-tahfidz-catat-satuan');

    if (tipe === 'ZIYADAH' && btnZ) {
        btnZ.className = 'py-2.5 px-2 rounded-xl border font-bold text-xs flex flex-col items-center justify-center gap-1 transition active:scale-95 bg-emerald-600 text-white border-emerald-600 shadow-sm ring-2 ring-emerald-500/20';
        if (rowJuzSingle) rowJuzSingle.classList.remove('hidden');
        if (rowSatuan) rowSatuan.classList.remove('hidden');
        if (ASNTahfidz.catatState.inputMode === 'JUZ') {
            setTahfidzSatuanMode('HALAMAN');
        }
    } else if (tipe === 'MURAJAAH_SABQI' && btnSabqi) {
        btnSabqi.className = 'py-2.5 px-2 rounded-xl border font-bold text-xs flex flex-col items-center justify-center gap-1 transition active:scale-95 bg-amber-600 text-white border-amber-600 shadow-sm ring-2 ring-amber-500/20';
        if (rowJuzSingle) rowJuzSingle.classList.remove('hidden');
        if (rowSatuan) rowSatuan.classList.remove('hidden');
        if (ASNTahfidz.catatState.inputMode === 'JUZ') {
            setTahfidzSatuanMode('HALAMAN');
        }
    } else if (tipe === 'MURAJAAH_MANZIL' && btnManzil) {
        btnManzil.className = 'py-2.5 px-2 rounded-xl border font-bold text-xs flex flex-col items-center justify-center gap-1 transition active:scale-95 bg-sky-600 text-white border-sky-600 shadow-sm ring-2 ring-sky-500/20';
        if (rowSatuan) rowSatuan.classList.remove('hidden');
        if (ASNTahfidz.catatState.inputMode === 'JUZ') {
            if (rowJuzSingle) rowJuzSingle.classList.add('hidden');
        } else {
            if (rowJuzSingle) rowJuzSingle.classList.remove('hidden');
        }
    } else if (tipe === 'TASMI' && btnT) {
        btnT.className = 'py-2.5 px-2 rounded-xl border font-bold text-xs flex flex-col items-center justify-center gap-1 transition active:scale-95 bg-purple-600 text-white border-purple-600 shadow-sm ring-2 ring-purple-500/20';
        if (rowJuzSingle) rowJuzSingle.classList.add('hidden');
        if (rowSatuan) rowSatuan.classList.add('hidden');
        setTahfidzSatuanMode('JUZ');
    }

    const currentStudentId = document.getElementById('tahfidz-catat-santri')?.value || ASNTahfidz.catatState.studentId;
    if (currentStudentId) {
        applyTahfidzRecommendation(currentStudentId, tipe);
    }
}

/**
 * Render Pemilih Halaman Mushaf Pojok (1 - 20)
 */
function renderTahfidzPageSelector() {
    const container = document.getElementById('tahfidz-page-grid');
    const summaryBadge = document.getElementById('tahfidz-page-summary-badge');
    const summaryList = document.getElementById('tahfidz-page-summary-list');

    if (!container) return;

    const selected = ASNTahfidz.catatState.selectedPages || [1];

    let gridHtml = '';
    for (let p = 1; p <= 20; p++) {
        const isSel = selected.includes(p);
        gridHtml += `
        <button type="button" onclick="toggleTahfidzPage(${p})" class="h-10 rounded-xl font-extrabold text-xs transition border flex items-center justify-center ${isSel ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm scale-105' : 'bg-slate-50 dark:bg-[#1c2836] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-[#283a4e] hover:bg-slate-100'}">
            ${p}
        </button>
        `;
    }
    container.innerHTML = gridHtml;

    // Update Summary
    const count = selected.length;
    if (summaryBadge) {
        summaryBadge.innerText = `TERPILIH: ${count} HALAMAN`;
    }
    if (summaryList) {
        if (selected.length === 1) {
            summaryList.innerText = `Halaman ${selected[0]}`;
        } else if (selected.length > 1) {
            const min = Math.min(...selected);
            const max = Math.max(...selected);
            summaryList.innerText = `Halaman ${min} - ${max} (${count} Halaman)`;
        } else {
            summaryList.innerText = "Belum ada halaman terpilih";
        }
    }
}

/**
 * Toggle satu halaman
 */
function toggleTahfidzPage(pageNumber) {
    let sel = ASNTahfidz.catatState.selectedPages;
    if (sel.includes(pageNumber)) {
        sel = sel.filter(p => p !== pageNumber);
    } else {
        sel.push(pageNumber);
    }
    sel.sort((a, b) => a - b);
    if (sel.length === 0) sel = [pageNumber];
    ASNTahfidz.catatState.selectedPages = sel;
    renderTahfidzPageSelector();
}

/**
 * Pintasan Cepat Pemilih Halaman (Quick Chips)
 * e.g. 0.5 Hal, 1 Hal, 1 Lembar (2 Hal), 1/2 Juz (10 Hal), 1 Juz (20 Hal)
 */
function applyTahfidzQuickChip(pagesCount) {
    const start = (ASNTahfidz.catatState.selectedPages && ASNTahfidz.catatState.selectedPages.length > 0) ? ASNTahfidz.catatState.selectedPages[0] : 1;
    const newPages = [];
    const count = Math.max(1, Math.round(pagesCount));

    for (let i = 0; i < count; i++) {
        const pageVal = start + i;
        if (pageVal <= 20) {
            newPages.push(pageVal);
        }
    }

    if (newPages.length === 0) newPages.push(1);
    ASNTahfidz.catatState.selectedPages = newPages;
    renderTahfidzPageSelector();
}

/**
 * Simpan catatan setoran ke backend
 */
async function submitTahfidzCatat(e) {
    if (e) e.preventDefault();

    const selSantri = document.getElementById('tahfidz-catat-santri');
    const studentId = selSantri ? selSantri.value : "";
    if (!studentId) {
        if (typeof showToast === 'function') showToast("⚠️ Harap pilih santri terlebih dahulu.");
        return;
    }

    const selectedOption = (selSantri && selSantri.options) ? selSantri.options[selSantri.selectedIndex] : null;
    const optName = selectedOption?.dataset?.name || "";
    const optNis = selectedOption?.dataset?.nis || "";
    const optGender = selectedOption?.dataset?.gender || "L";
    const optHalaqahId = selectedOption?.dataset?.halaqahId || "";
    const optHalaqahName = selectedOption?.dataset?.halaqahName || "";
    const optMuhafiz = selectedOption?.dataset?.muhafiz || "";

    const student = (ASNTahfidz.data.students || []).find(s => 
        (s.studentId && s.studentId === studentId) ||
        (s.student_id && s.student_id === studentId) ||
        (s.id && s.id === studentId) ||
        (s.nis && s.nis === studentId)
    );

    const studentName = (student?.name || student?.nama || optName || (selectedOption ? selectedOption.text.split('(')[0].trim() : "")).trim();
    const nis = (student?.nis || optNis || "").trim();
    const gender = (student?.gender || optGender || "L").toUpperCase();
    const halaqahId = student?.halaqah?.halaqahId || optHalaqahId || "";
    const namaHalaqah = student?.halaqah?.namaHalaqah || optHalaqahName || "";

    const tanggal = document.getElementById('tahfidz-catat-tanggal')?.value || "";
    const sesi = document.getElementById('tahfidz-catat-sesi')?.value || "Pagi (Ba'da Subuh)";
    const juz = Number(document.getElementById('tahfidz-catat-juz')?.value || ASNTahfidz.catatState.juz || 30);
    const selMuhafiz = document.getElementById('tahfidz-catat-muhafiz');
    let muhafiz = selMuhafiz ? selMuhafiz.value : "";
    if (muhafiz === '__CUSTOM__') {
        muhafiz = (document.getElementById('tahfidz-catat-muhafiz-manual')?.value || '').trim();
    }

    const nilai = document.getElementById('tahfidz-catat-nilai')?.value || ASNTahfidz.catatState.nilai || "MUMTAZ";
    const catatan = (document.getElementById('tahfidz-catat-catatan')?.value || "").trim();

    let surah = SURAH_JUZ_REFERENCE[juz] || `Juz ${juz}`;
    let halamanList = "";
    let totalHalaman = 1;
    let ayatMulaiVal = null;
    let ayatSampaiVal = null;

    if (ASNTahfidz.catatState.inputMode === 'AYAT') {
        const selSurah = document.getElementById('tahfidz-catat-surah');
        const surahNo = Number(selSurah?.value || ASNTahfidz.catatState.surahNo || 78);
        const surahObj = QURAN_114_SURAHS.find(s => s.no === surahNo) || { name: `Surah ${surahNo}`, ayat: 40 };
        const a1 = Math.max(1, Number(document.getElementById('tahfidz-catat-ayat-mulai')?.value) || 1);
        const a2 = Math.max(a1, Number(document.getElementById('tahfidz-catat-ayat-sampai')?.value) || a1);
        ayatMulaiVal = a1;
        ayatSampaiVal = a2;
        surah = `${surahObj.name} : ${a1} - ${a2}`;

        const calcPages = mapSurahAyatToPage(juz, surahObj, a1, a2);
        ASNTahfidz.catatState.selectedPages = calcPages;
        halamanList = calcPages.join(",");
        totalHalaman = calcPages.length;
    } else if (ASNTahfidz.catatState.inputMode === 'JUZ') {
        const jStart = Number(document.getElementById('tahfidz-catat-juz-mulai')?.value || ASNTahfidz.catatState.juzStart || juz);
        const jEnd = Number(document.getElementById('tahfidz-catat-juz-sampai')?.value || ASNTahfidz.catatState.juzEnd || jStart);
        const countJuz = Math.max(1, jEnd - jStart + 1);
        totalHalaman = (countJuz === 30) ? 604 : (countJuz * 20);
        surah = jStart === jEnd 
            ? `Juz ${jStart} (${SURAH_JUZ_REFERENCE[jStart] || ''})` 
            : `Juz ${jStart} s/d Juz ${jEnd} (${getSurahRangeForJuz(jStart, jEnd)})`;
        halamanList = jStart === jEnd ? "1-20" : `1-20 (Juz ${jStart}-${jEnd})`;
    } else {
        const selectedPages = ASNTahfidz.catatState.selectedPages || [1];
        halamanList = selectedPages.join(",");
        totalHalaman = selectedPages.length;
    }

    const statusSetoran = document.querySelector('input[name="tahfidz-status-setoran"]:checked')?.value || ASNTahfidz.catatState.statusSetoran || (nilai === 'DHAIF' ? 'ULANG' : 'LANJUT');

    const btn = document.getElementById('btn-submit-tahfidz-catat');
    setTahfidzButtonLoading(btn, true, "Menyimpan Setoran...");

    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(TAHFIDZ_STORAGE_KEYS.adminToken)) || "";
        const finalJuzStart = (ASNTahfidz.catatState.inputMode === 'JUZ') ? (ASNTahfidz.catatState.juzStart || juz) : juz;
        const finalJuzEnd = (ASNTahfidz.catatState.inputMode === 'JUZ') ? (ASNTahfidz.catatState.juzEnd || juz) : juz;
        const finalCatatan = (ASNTahfidz.catatState.tipe === 'TASMI' && ASNTahfidz.catatState.inputMode === 'JUZ')
            ? (catatan ? `[Ujian Tasmi' ${ASNTahfidz.catatState.totalJuz || 1} Juz Sekali Duduk] ${catatan}` : `[Ujian Tasmi' ${ASNTahfidz.catatState.totalJuz || 1} Juz Sekali Duduk]`)
            : catatan;

        const payload = {
            token,
            studentId,
            student_id: studentId,
            nis: nis,
            studentName: studentName,
            student_name: studentName,
            name: studentName,
            gender: gender,
            halaqahId: halaqahId,
            halaqah_id: halaqahId,
            namaHalaqah: namaHalaqah,
            nama_halaqah: namaHalaqah,
            tanggal,
            sesi,
            tipe: ASNTahfidz.catatState.tipe,
            satuan: ASNTahfidz.catatState.inputMode,
            juz: finalJuzStart,
            juz_sampai: finalJuzEnd,
            surah,
            ayatMulai: ayatMulaiVal,
            ayatSampai: ayatSampaiVal,
            ayat_mulai: ayatMulaiVal,
            ayat_sampai: ayatSampaiVal,
            halamanList,
            halaman_list: halamanList,
            totalHalaman,
            total_halaman: totalHalaman,
            nilai,
            statusSetoran,
            status_setoran: statusSetoran,
            muhafiz: muhafiz || optMuhafiz || (student?.halaqah?.muhafiz || "Ustadz Pembina"),
            catatan: finalCatatan
        };

        const response = await apiPost("saveTahfidzLog", payload);

        if (response && (response.success || response.status === "success")) {
            if (typeof showToast === 'function') {
                const toastMsg = statusSetoran === 'ULANG' 
                    ? "⚠️ Setoran dicatat sebagai Wajib Mengulang (I'adah). Posisi capaian hafalan belum bertambah."
                    : (response.message || "✅ Setoran tahfidz santri berhasil disimpan!");
                showToast(toastMsg);
            }

            // Optimistic update pada data santri di memori lokal
            const updateStudentData = (st) => {
                if (!st) return;
                st.setoranTerakhir = {
                    juz: finalJuzStart,
                    juzSampai: finalJuzEnd,
                    surah: surah,
                    ayatMulai: ayatMulaiVal,
                    ayatSampai: ayatSampaiVal,
                    halaman: `Halaman ${halamanList}`,
                    totalHalaman: totalHalaman,
                    tanggal: tanggal,
                    sesi: sesi,
                    tipe: ASNTahfidz.catatState.tipe,
                    nilai: nilai,
                    statusSetoran: statusSetoran,
                    muhafiz: muhafiz || (st.halaqah?.muhafiz || "Ustadz Pembina")
                };
                if (!st.progress) st.progress = {};
                if (!st.murojaah) st.murojaah = {};

                const tipeAktif = ASNTahfidz.catatState.tipe || 'ZIYADAH';

                if (tipeAktif === 'ZIYADAH') {
                    if (statusSetoran === 'LANJUT') {
                        const curRank = getJuzCurriculumIndex(juz);
                        const prevRank = getJuzCurriculumIndex(st.progress.currentJuz || 30);
                        const maxP = Math.max(...(ASNTahfidz.catatState.selectedPages || [1]));
                        if (curRank > prevRank || (curRank === prevRank && maxP >= (st.progress.currentHalaman || 1))) {
                            if (maxP >= 20) {
                                const nextPos = getNextCurriculumPosition(juz, 20);
                                st.progress.currentJuz = nextPos.juz;
                                st.progress.currentHalaman = nextPos.halaman;
                                if (nextPos.khatam) {
                                    st.progress.isKhatam = true;
                                    st.progress.percent = 100;
                                }
                            } else {
                                st.progress.currentJuz = juz;
                                st.progress.currentHalaman = maxP + 1;
                            }
                            const prog = getCurriculumProgress(st.progress.currentJuz, st.progress.currentHalaman);
                            st.progress.percent = (st.progress && st.progress.isKhatam) ? 100 : prog.percent;
                        }
                        st.progress.onTrackStatus = "On-Track (Lulus Ziyadah)";
                    } else {
                        st.progress.onTrackStatus = `Wajib Ulang Ziyadah (Hlm ${halamanList})`;
                    }
                } else if (tipeAktif === 'MURAJAAH_SABQI') {
                    if (statusSetoran === 'LANJUT') {
                        st.murojaah.sabqiHalaman = halamanList;
                        st.progress.onTrackStatus = "On-Track (Lulus Sabqi)";
                    } else {
                        st.progress.onTrackStatus = `Wajib Ulang Sabqi (Hlm ${halamanList})`;
                    }
                } else if (tipeAktif === 'MURAJAAH_MANZIL') {
                    if (statusSetoran === 'LANJUT') {
                        const lastP = Math.max(...(ASNTahfidz.catatState.selectedPages || [1]));
                        if (lastP >= 20) {
                            const nextPos = getNextCurriculumPosition(juz, 20);
                            const limitRank = getJuzCurriculumIndex(st.progress.currentJuz || 30);
                            if (nextPos.khatam || getJuzCurriculumIndex(nextPos.juz) > limitRank) {
                                st.murojaah.manzilJuz = JUZ_CURRICULUM_ORDER[0];
                                st.murojaah.manzilHalaman = 1;
                                st.murojaah.manzilPutaran = (st.murojaah.manzilPutaran || 1) + 1;
                            } else {
                                st.murojaah.manzilJuz = nextPos.juz;
                                st.murojaah.manzilHalaman = 1;
                            }
                        } else {
                            st.murojaah.manzilJuz = juz;
                            st.murojaah.manzilHalaman = lastP + 1;
                        }
                        st.progress.onTrackStatus = "On-Track (Lulus Manzil)";
                    } else {
                        st.progress.onTrackStatus = `Wajib Ulang Manzil (Hlm ${halamanList})`;
                    }
                } else if (tipeAktif === 'TASMI') {
                    const tasmiCount = ASNTahfidz.catatState.inputMode === 'JUZ' ? (ASNTahfidz.catatState.totalJuz || 1) : 1;
                    st.progress.onTrackStatus = statusSetoran === 'LANJUT' 
                        ? (tasmiCount > 1 ? `Lulus Tasmi' ${tasmiCount} Juz` : "Lulus Tasmi'") 
                        : "Ulang Tasmi'";
                }
                st.totalSetoran = (st.totalSetoran || 0) + 1;
            };

            const targetStudent = (ASNTahfidz.data.students || []).find(s => (s.studentId === studentId || s.nis === studentId));
            updateStudentData(targetStudent);
            const targetFiltered = (ASNTahfidz.filteredStudents || []).find(s => (s.studentId === studentId || s.nis === studentId));
            updateStudentData(targetFiltered);

            // Re-render tabel instan tanpa menunggu reload dari server
            renderTahfidzStudentTable();
            closeTahfidzCatatModal();

            // Sinkronisasi data lengkap di latar belakang (tanpa menutup layar dengan spinner)
            loadAdminTahfidzData(true);
        } else {
            const msg = (response && response.message) || "Gagal menyimpan setoran.";
            if (typeof showToast === 'function') showToast("❌ " + msg);
        }
    } catch (err) {
        console.error("Gagal submitTahfidzCatat:", err);
        if (typeof showToast === 'function') showToast("❌ Terjadi kendala: " + err.message);
    } finally {
        setTahfidzButtonLoading(btn, false);
    }
}

// ====================================================================
// 3. MODAL: DETAIL SANTRI / MUTABA'AH REALITA VS TARGET (Screenshot 4)
// ====================================================================

/**
 * Buka modal detail mutaba'ah (bisa diakses Admin, Pengasuh, & Wali Santri)
 */
async function openTahfidzStudentDetail(studentId, viewerRole = null) {
    if (viewerRole) {
        ASNTahfidz.viewerRole = viewerRole;
    } else if (typeof ASNIdentity !== 'undefined') {
        const r = String(ASNIdentity.currentRole || '').toUpperCase();
        if (r === 'WALI_SANTRI' || r === 'PARENT') {
            ASNTahfidz.viewerRole = 'parent';
        } else if (r === 'PENGASUH') {
            ASNTahfidz.viewerRole = 'pengasuh';
        } else {
            ASNTahfidz.viewerRole = 'admin';
        }
    } else {
        ASNTahfidz.viewerRole = 'admin';
    }

    const modal = document.getElementById('modal-tahfidz-detail');
    if (!modal) return;

    modal.classList.remove('hidden');
    ASNTahfidz.detailActiveTab = 1;
    switchTahfidzDetailTab(1);

    const loader = document.getElementById('tahfidz-detail-loader');
    const errorBox = document.getElementById('tahfidz-detail-error');
    const errorText = document.getElementById('tahfidz-detail-error-text');
    const bodyBox = document.getElementById('tahfidz-detail-body');

    if (loader) loader.classList.remove('hidden');
    if (errorBox) errorBox.classList.add('hidden');
    if (bodyBox) bodyBox.classList.add('hidden');

    // Pastikan tombol aksi (+ Setor & Edit Target) disembunyikan segera jika peran adalah wali santri
    const btnSetorInit = document.getElementById('btn-tahfidz-detail-catat-setoran');
    const btnEditTargetInit = document.getElementById('btn-tahfidz-detail-edit-target');
    const isParentRoleInit = ASNTahfidz.viewerRole === 'parent';
    if (btnSetorInit) {
        if (isParentRoleInit) btnSetorInit.classList.add('hidden');
        else btnSetorInit.classList.remove('hidden');
    }
    if (btnEditTargetInit) {
        if (isParentRoleInit) btnEditTargetInit.classList.add('hidden');
        else btnEditTargetInit.classList.remove('hidden');
    }

    // Pre-populate student header if available in memory for instant feedback
    const existingStudent = (ASNTahfidz.data.students || []).find(s => {
        const sId = String(s.studentId || s.student_id || s.id || '').trim();
        const sNis = String(s.nis || '').trim();
        const targetId = String(studentId || '').trim();
        return sId === targetId || sNis === targetId;
    });

    if (existingStudent) {
        const elName = document.getElementById('tahfidz-detail-name');
        const elNis = document.getElementById('tahfidz-detail-nis');
        const elAvatar = document.getElementById('tahfidz-detail-avatar');
        const halaqahName = existingStudent.halaqah?.namaHalaqah || existingStudent.halaqah || 'Halaqah Utama';

        if (elName) elName.innerText = existingStudent.name || "Santri";
        if (elNis) elNis.innerText = `NIS: ${existingStudent.nis || '-'} • Bil Hifdhi • ${escapeHtml(halaqahName)}`;
        if (elAvatar) {
            const initials = (existingStudent.name || 'Santri').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
            elAvatar.innerHTML = existingStudent.photoUrl ? `<img src="${escapeHtml(existingStudent.photoUrl)}" class="w-full h-full object-cover rounded-2xl">` : initials;
        }
    }

    try {
        const token = (typeof ASNIdentity !== 'undefined' ? (
            sessionStorage.getItem(TAHFIDZ_STORAGE_KEYS.parentToken) ||
            localStorage.getItem(TAHFIDZ_STORAGE_KEYS.parentToken) ||
            sessionStorage.getItem(TAHFIDZ_STORAGE_KEYS.pengasuhToken) ||
            localStorage.getItem(TAHFIDZ_STORAGE_KEYS.pengasuhToken) ||
            sessionStorage.getItem(TAHFIDZ_STORAGE_KEYS.adminToken) ||
            localStorage.getItem(TAHFIDZ_STORAGE_KEYS.adminToken)
        ) : '') || (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(TAHFIDZ_STORAGE_KEYS.adminToken)) || "";

        const response = await apiPost("getTahfidzStudentDetail", { token, studentId });

        if (response && (response.success || response.status === "success")) {
            ASNTahfidz.activeStudentDetail = response;
            if (loader) loader.classList.add('hidden');
            if (errorBox) errorBox.classList.add('hidden');
            if (bodyBox) bodyBox.classList.remove('hidden');
            renderTahfidzStudentDetailView();
        } else {
            if (loader) loader.classList.add('hidden');
            if (errorBox) {
                errorBox.classList.remove('hidden');
                if (errorText) errorText.innerText = `Gagal memuat detail: ${response?.message || 'Data tidak ditemukan'}`;
            }
        }
    } catch (err) {
        console.error("Gagal load detail santri:", err);
        if (loader) loader.classList.add('hidden');
        if (errorBox) {
            errorBox.classList.remove('hidden');
            if (errorText) errorText.innerText = `Terjadi kendala saat memuat data santri: ${err.message || err}`;
        }
    }
}

/**
 * Tutup modal detail santri
 */
function closeTahfidzStudentDetail() {
    const modal = document.getElementById('modal-tahfidz-detail');
    if (modal) modal.classList.add('hidden');
    ASNTahfidz.activeStudentDetail = null;
}

/**
 * Ganti tab dalam modal detail santri (Tab 1: Rekap 3 Indikator, Tab 2: Riwayat, Tab 3: Estimasi Khatam)
 */
function switchTahfidzDetailTab(tabIndex) {
    ASNTahfidz.detailActiveTab = tabIndex;

    const tab1Btn = document.getElementById('btn-detail-tab-1');
    const tab2Btn = document.getElementById('btn-detail-tab-2');
    const tab3Btn = document.getElementById('btn-detail-tab-3');
    const tab4Btn = document.getElementById('btn-detail-tab-4');
    const panel1 = document.getElementById('panel-detail-tab-1');
    const panel2 = document.getElementById('panel-detail-tab-2');
    const panel3 = document.getElementById('panel-detail-tab-3');
    const panel4 = document.getElementById('panel-detail-tab-4');

    const activeClasses = "px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-700 text-white shadow-sm transition flex items-center gap-1.5 shrink-0";
    const inactiveClasses = "px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 dark:bg-[#1c2836] text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition flex items-center gap-1.5 shrink-0";

    if (tab1Btn) tab1Btn.className = (tabIndex === 1) ? activeClasses : inactiveClasses;
    if (tab2Btn) tab2Btn.className = (tabIndex === 2) ? activeClasses : inactiveClasses;
    if (tab3Btn) tab3Btn.className = (tabIndex === 3) ? activeClasses : inactiveClasses;
    if (tab4Btn) tab4Btn.className = (tabIndex === 4) ? activeClasses : inactiveClasses;

    if (panel1) panel1.classList.toggle('hidden', tabIndex !== 1);
    if (panel2) panel2.classList.toggle('hidden', tabIndex !== 2);
    if (panel3) panel3.classList.toggle('hidden', tabIndex !== 3);
    if (panel4) panel4.classList.toggle('hidden', tabIndex !== 4);

    if (tabIndex === 3) {
        renderTahfidzEstimasiKhatam();
    } else if (tabIndex === 4) {
        renderTahfidzStudentPresensiTab();
    }
}

/**
 * Hitung dan Render Tab Estimasi Waktu Khatam 30 Juz
 * Berdasarkan tren laju setoran riil santri
 */
function renderTahfidzEstimasiKhatam() {
    const res = ASNTahfidz.activeStudentDetail;
    if (!res) return;

    const st = res.student || {};
    const stats = res.stats || {};
    const riwayat = res.riwayat || [];

    // 1. Hitung total halaman yang sudah tuntas (Max 600 halaman Mushaf Pojok) berbasis kurikulum (30-21 lalu 1-20)
    const progressJuz = Number(stats.progressJuz || st.progress?.currentJuz || 30);
    const lastHalamanRaw = String(st.setoranTerakhir?.halaman || stats.progressHalaman || '1');
    const lastHalamanNum = parseTahfidzLatestPage(lastHalamanRaw);

    let halamanTuntas = stats.totalHalamanTuntas || getCurriculumProgress(progressJuz, lastHalamanNum).totalTuntas;

    // Validasi dengan riwayat setoran ziyadah unik jika ada
    const ziyadahLogs = riwayat.filter(r => (r.tipe || '').toUpperCase() === 'ZIYADAH' && r.statusSetoran !== 'ULANG');
    if (ziyadahLogs.length > 0) {
        let maxRankZiyadah = -1;
        let maxHlmZiyadah = 1;
        ziyadahLogs.forEach(log => {
            const j = Number(log.juz || 30);
            const rk = getJuzCurriculumIndex(j);
            const h = parseTahfidzLatestPage(log.halamanList);
            if (rk > maxRankZiyadah || (rk === maxRankZiyadah && h > maxHlmZiyadah)) {
                maxRankZiyadah = rk;
                maxHlmZiyadah = h;
            }
        });
        const calcFromLogs = maxRankZiyadah * 20 + maxHlmZiyadah;
        if (calcFromLogs > halamanTuntas) {
            halamanTuntas = calcFromLogs;
        }
    }

    if (halamanTuntas > 600) halamanTuntas = 600;
    const sisaHalaman = Math.max(0, 600 - halamanTuntas);
    const persenMilestone = Math.min(100, Math.round((halamanTuntas / 600) * 100));

    // 2. Hitung Tren Kecepatan Setoran Riil (Laju per Pekan & per Bulan)
    let lajuPekanRiil = 0;
    if (ziyadahLogs.length >= 2) {
        const sortedLogs = [...ziyadahLogs].sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
        const firstDate = new Date(sortedLogs[0].tanggal);
        const lastDate = new Date(sortedLogs[sortedLogs.length - 1].tanggal);
        const diffDays = Math.max(1, Math.round((lastDate - firstDate) / (1000 * 60 * 60 * 24)));
        const totalHlm = sortedLogs.reduce((sum, item) => sum + (Number(item.totalHalaman) || 1), 0);

        if (diffDays >= 7) {
            lajuPekanRiil = (totalHlm / (diffDays / 7));
        } else {
            lajuPekanRiil = totalHlm;
        }
    } else if (ziyadahLogs.length === 1) {
        lajuPekanRiil = Number(ziyadahLogs[0].totalHalaman) || 2;
    }

    // Jika tren riil belum cukup data (< 0.5 hal/pekan), gunakan target capaian santri atau standar pesantren
    const targetSantriPekan = Number(st.target?.ziyadahPekan) || 4;
    let lajuEfektif = (lajuPekanRiil >= 0.5) ? lajuPekanRiil : targetSantriPekan;
    lajuEfektif = Math.max(0.5, lajuEfektif); // minimal 0.5 hal/pekan agar tidak division by zero

    const lajuBulanRiil = lajuEfektif * 4.33;

    // 3. Proyeksi Tanggal Khatam (Bulan & Tahun)
    const namaBulanIndo = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];

    const getProjectionDate = (ratePerWeek) => {
        if (sisaHalaman <= 0) return { text: "Alhamdulillah Khatam 30 Juz!", durasiText: "(Tuntas 600 Halaman)", durasiBulan: 0 };
        const safeRate = Math.max(0.5, ratePerWeek);
        const weeksNeeded = sisaHalaman / safeRate;
        const projDate = new Date();
        projDate.setDate(projDate.getDate() + Math.round(weeksNeeded * 7));
        const bulanName = namaBulanIndo[projDate.getMonth()];
        const tahun = projDate.getFullYear();
        const durasiBulan = Math.max(1, Math.round(weeksNeeded / 4.33));
        return {
            text: `${bulanName} ${tahun}`,
            durasiText: `(± ${durasiBulan} Bulan lagi)`,
            durasiBulan: durasiBulan,
            weeksNeeded: Math.round(weeksNeeded)
        };
    };

    const projRiil = getProjectionDate(lajuEfektif);
    const projTarget = getProjectionDate(targetSantriPekan);
    const projAkselerasi = getProjectionDate(12); // 12 hal/pekan (1 lembar per hari, 6 hari)

    // 4. Update DOM Elements
    const elKhatamBulanTahun = document.getElementById('tahfidz-estimasi-khatam-bulan-tahun');
    const elKhatamDurasi = document.getElementById('tahfidz-estimasi-khatam-durasi');
    const elLajuText = document.getElementById('tahfidz-estimasi-laju-text');
    const elLajuSub = document.getElementById('tahfidz-estimasi-laju-sub');
    const elHalamanTuntas = document.getElementById('tahfidz-estimasi-halaman-tuntas');
    const elSisaHalaman = document.getElementById('tahfidz-estimasi-sisa-halaman');
    const elMeterBar = document.getElementById('tahfidz-estimasi-meter-bar');
    const elBadgeStatus = document.getElementById('tahfidz-estimasi-badge-status');

    if (sisaHalaman <= 0) {
        if (elKhatamBulanTahun) elKhatamBulanTahun.innerText = "Khatam 30 Juz 🏆";
        if (elKhatamDurasi) elKhatamDurasi.innerText = "(Tuntas 600 Halaman)";
        if (elBadgeStatus) {
            elBadgeStatus.innerText = "Khatam Mutqin";
            elBadgeStatus.className = "px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 font-black text-[10px]";
        }
    } else {
        if (elKhatamBulanTahun) elKhatamBulanTahun.innerText = projRiil.text;
        if (elKhatamDurasi) elKhatamDurasi.innerText = projRiil.durasiText;
        if (elBadgeStatus) {
            elBadgeStatus.innerText = (lajuPekanRiil >= targetSantriPekan) ? "Laju Sangat Baik" : "Aktif Menghafal";
            elBadgeStatus.className = (lajuPekanRiil >= targetSantriPekan)
                ? "px-2 py-0.5 rounded-full bg-emerald-300 text-emerald-950 font-black text-[10px]"
                : "px-2 py-0.5 rounded-full bg-emerald-400 text-emerald-950 font-black text-[10px]";
        }
    }

    if (elLajuText) elLajuText.innerText = `${lajuEfektif.toFixed(1)} Hal / Pekan`;
    if (elLajuSub) elLajuSub.innerText = `${Math.round(lajuBulanRiil)} Hal / Bulan`;
    if (elHalamanTuntas) elHalamanTuntas.innerText = `${halamanTuntas}`;
    if (elSisaHalaman) elSisaHalaman.innerText = `Sisa ${sisaHalaman} Halaman (${Math.ceil(sisaHalaman / 20)} Juz lagi)`;
    if (elMeterBar) elMeterBar.style.width = `${Math.min(100, Math.max(1, persenMilestone))}%`;

    // 3 Cards Metrik
    const elCardTren = document.getElementById('tahfidz-estimasi-card-tren');
    const elCardTarget = document.getElementById('tahfidz-estimasi-card-target');
    const elCardKualitas = document.getElementById('tahfidz-estimasi-card-kualitas');

    if (elCardTren) {
        elCardTren.innerHTML = `${lajuPekanRiil > 0 ? lajuPekanRiil.toFixed(1) : targetSantriPekan} Hlm/Pekan <span class="text-xs font-normal text-slate-400">(${ziyadahLogs.length}x setoran ziyadah)</span>`;
    }
    if (elCardTarget) {
        elCardTarget.innerHTML = `${targetSantriPekan} Hlm/Pekan <span class="text-xs font-normal text-slate-400">(${targetSantriPekan * 4} Hlm/Bulan)</span>`;
    }
    if (elCardKualitas) {
        const totalLogs = riwayat.length;
        const passLogs = riwayat.filter(r => r.statusSetoran !== 'ULANG').length;
        const passPercent = totalLogs > 0 ? Math.round((passLogs / totalLogs) * 100) : 100;
        elCardKualitas.innerHTML = `${passPercent}% Lulus <span class="text-xs font-normal text-slate-400">(${stats.rataRataNilai || 'Mumtaz'})</span>`;
    }

    // Skenario Dates
    const elSkenarioRiil = document.getElementById('tahfidz-skenario-riil-date');
    const elSkenarioTarget = document.getElementById('tahfidz-skenario-target-date');
    const elSkenarioAkselerasi = document.getElementById('tahfidz-skenario-akselerasi-date');

    if (elSkenarioRiil) elSkenarioRiil.innerText = `${projRiil.text} ${projRiil.durasiText || ''}`;
    if (elSkenarioTarget) elSkenarioTarget.innerText = `${projTarget.text} ${projTarget.durasiText || ''}`;
    if (elSkenarioAkselerasi) elSkenarioAkselerasi.innerText = `${projAkselerasi.text} ${projAkselerasi.durasiText || ''}`;
}

ASNTahfidz.detailFilterTipe = "ALL"; // ALL, ZIYADAH, MURAJAAH
ASNTahfidz.detailSelectedDate = new Date().toISOString().split('T')[0];

/**
 * Filter Tipe Setoran di Modal Detail Santri (Semua / Ziyadah / Sabqi / Manzil / Tasmi')
 */
function setTahfidzDetailTipeFilter(tipe) {
    ASNTahfidz.detailFilterTipe = tipe || "ALL";

    const filterBtns = {
        'ALL': document.getElementById('btn-filter-detail-all'),
        'ZIYADAH': document.getElementById('btn-filter-detail-ziyadah'),
        'MURAJAAH_SABQI': document.getElementById('btn-filter-detail-sabqi'),
        'MURAJAAH_MANZIL': document.getElementById('btn-filter-detail-manzil'),
        'TASMI': document.getElementById('btn-filter-detail-tasmi')
    };

    const activeClasses = {
        'ALL': 'px-2.5 py-1 rounded-lg font-bold bg-emerald-700 text-white transition shrink-0',
        'ZIYADAH': 'px-2.5 py-1 rounded-lg font-bold bg-emerald-600 text-white transition shrink-0 shadow-sm',
        'MURAJAAH_SABQI': 'px-2.5 py-1 rounded-lg font-bold bg-amber-600 text-white transition shrink-0 shadow-sm',
        'MURAJAAH_MANZIL': 'px-2.5 py-1 rounded-lg font-bold bg-sky-600 text-white transition shrink-0 shadow-sm',
        'TASMI': 'px-2.5 py-1 rounded-lg font-bold bg-purple-600 text-white transition shrink-0 shadow-sm'
    };

    const inactiveClass = 'px-2.5 py-1 rounded-lg font-bold bg-slate-100 dark:bg-[#1c2836] text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition shrink-0';

    Object.keys(filterBtns).forEach(k => {
        const btn = filterBtns[k];
        if (!btn) return;
        if (k === tipe) {
            btn.className = activeClasses[k] || activeClasses['ALL'];
        } else {
            btn.className = inactiveClass;
        }
    });

    renderTahfidzStudentDetailView();
}

/**
 * Event ubah tanggal harian
 */
function onChangeIndikatorDate(mode, val) {
    if (val) {
        ASNTahfidz.detailSelectedDate = val;
        renderTahfidzStudentDetailView();
    }
}

/**
 * Navigasi Pekan (< >)
 */
function shiftIndikatorWeek(dir) {
    const cur = new Date(ASNTahfidz.detailSelectedDate || new Date());
    cur.setDate(cur.getDate() + (dir * 7));
    ASNTahfidz.detailSelectedDate = cur.toISOString().split('T')[0];
    renderTahfidzStudentDetailView();
}

/**
 * Navigasi Bulan (< >)
 */
function shiftIndikatorMonth(dir) {
    const cur = new Date(ASNTahfidz.detailSelectedDate || new Date());
    cur.setMonth(cur.getMonth() + dir);
    ASNTahfidz.detailSelectedDate = cur.toISOString().split('T')[0];
    renderTahfidzStudentDetailView();
}

/**
 * Preset Tanggal Cepat: today, yesterday, thisWeek, thisMonth
 */
function setIndikatorPreset(preset) {
    const d = new Date();
    if (preset === 'yesterday') {
        d.setDate(d.getDate() - 1);
    }
    ASNTahfidz.detailSelectedDate = d.toISOString().split('T')[0];
    renderTahfidzStudentDetailView();
}

/**
 * Render Tampilan Rapor Mutaba'ah Santri (Screenshot 5)
 */
function renderTahfidzStudentDetailView() {
    const res = ASNTahfidz.activeStudentDetail;
    if (!res) return;

    const st = res.student || {};
    const stats = res.stats || {};
    const ind = res.indikator || {};
    let riwayat = res.riwayat || [];

    // Filter riwayat berdasarkan tipe jika dipilih
    if (ASNTahfidz.detailFilterTipe === 'ZIYADAH') {
        riwayat = riwayat.filter(r => (r.tipe || '').toUpperCase() === 'ZIYADAH');
    } else if (ASNTahfidz.detailFilterTipe === 'MURAJAAH_SABQI') {
        riwayat = riwayat.filter(r => (r.tipe || '').toUpperCase() === 'MURAJAAH_SABQI');
    } else if (ASNTahfidz.detailFilterTipe === 'MURAJAAH_MANZIL') {
        riwayat = riwayat.filter(r => (r.tipe || '').toUpperCase() === 'MURAJAAH_MANZIL');
    } else if (ASNTahfidz.detailFilterTipe === 'TASMI') {
        riwayat = riwayat.filter(r => (r.tipe || '').toUpperCase() === 'TASMI');
    }

    // Header Info (Screenshot 5: Inisial, Nama, Badge, NIS • Bil Hifdhi • Halaqah)
    const elName = document.getElementById('tahfidz-detail-name');
    const elNis = document.getElementById('tahfidz-detail-nis');
    const elAvatar = document.getElementById('tahfidz-detail-avatar');
    const halaqahName = st.halaqah?.namaHalaqah || st.halaqah || 'Halaqah Utama';

    if (elName) elName.innerText = st.name || "Santri";
    if (elNis) elNis.innerText = `NIS: ${st.nis || '-'} • Bil Hifdhi • ${escapeHtml(halaqahName)}`;
    if (elAvatar) {
        const initials = (st.name || 'Santri').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
        elAvatar.innerHTML = st.photoUrl ? `<img src="${escapeHtml(st.photoUrl)}" class="w-full h-full object-cover rounded-2xl">` : initials;
    }

    // 4 Strip Stat Cards (Selaras antara luar dan dalam)
    const elCapaian = document.getElementById('tahfidz-detail-stat-capaian');
    const elTarget = document.getElementById('tahfidz-detail-stat-target');
    const elTotal = document.getElementById('tahfidz-detail-stat-total');
    const elNilai = document.getElementById('tahfidz-detail-stat-nilai');

    const curJuzNo = Number(stats.progressJuz || st.progress?.currentJuz || 30);
    const curHalNo = Number(stats.progressHalaman || st.progress?.currentHalaman || 1);
    const curJuzIdx = stats.curriculumJuzIndex || (getJuzCurriculumIndex(curJuzNo) + 1);

    const unifiedMetrics = calculateTahfidzMetricsHelper({
        currentJuz: curJuzNo,
        currentHal: curHalNo,
        stats: stats,
        riwayat: res.riwayat || [],
        target: res.target || st.target || {}
    });

    const curPercent = unifiedMetrics.percent;

    if (elCapaian) elCapaian.innerHTML = `${unifiedMetrics.currentJuzText} <span class="text-xs font-bold text-slate-400">(${curPercent}%)</span>`;
    if (elTarget) elTarget.innerText = unifiedMetrics.jumlahJuzDisetorText || "1 Juz";
    if (elTotal) elTotal.innerText = unifiedMetrics.estimasiKhatamText || "-";
    if (elNilai) elNilai.innerText = stats.rataRataNilai || "-";

    // Kontrol Visibilitas Tombol untuk Akun Wali Santri (+ Setor & Edit Target disembunyikan)
    const btnSetor = document.getElementById('btn-tahfidz-detail-catat-setoran');
    const btnEditTarget = document.getElementById('btn-tahfidz-detail-edit-target');
    const isParentRole = ASNTahfidz.viewerRole === 'parent';

    if (btnSetor) {
        if (isParentRole) {
            btnSetor.classList.add('hidden');
        } else {
            btnSetor.classList.remove('hidden');
        }
    }
    if (btnEditTarget) {
        if (isParentRole) {
            btnEditTarget.classList.add('hidden');
        } else {
            btnEditTarget.classList.remove('hidden');
        }
    }

    // Progress Bar 30 Juz
    const elProgressText = document.getElementById('tahfidz-detail-progress-text');
    const elProgressBar = document.getElementById('tahfidz-detail-progress-bar');
    if (elProgressText) elProgressText.innerText = `Juz ${curJuzNo} • Progres ${curJuzIdx}/30 Juz Kurikulum (${curPercent}%)`;
    if (elProgressBar) elProgressBar.style.width = `${Math.min(100, Math.max(2, curPercent))}%`;

    // Posisi Muroja'ah Sabqi & Manzil
    const cap = res.capaian || st.capaian || {};
    const mur = res.murojaah || st.murojaah || {};

    const ziyadahJuz = Number(cap.juzAktif) || Number(stats.progressJuz) || 1;
    const ziyadahHlm = Number(cap.halamanTerakhir) || 1;
    const sabqiHalaman = mur.sabqiHalaman || cap.sabqiHalaman || '';
    const manzilJuz = Number(mur.manzilJuz || cap.manzilJuz) || 1;
    const manzilHalaman = Number(mur.manzilHalaman || cap.manzilHalaman) || 1;
    const manzilPutaran = Number(mur.manzilPutaran || cap.manzilPutaran) || 1;

    const elSabqiPos = document.getElementById('tahfidz-detail-sabqi-pos');
    const elManzilPos = document.getElementById('tahfidz-detail-manzil-pos');

    if (elSabqiPos) {
        elSabqiPos.innerHTML = `<span class="text-amber-700 dark:text-amber-300">Juz ${ziyadahJuz}</span> • <span>${sabqiHalaman ? `Halaman ${sabqiHalaman}` : `Halaman 1 - ${Math.max(1, ziyadahHlm - 1)}`}</span>`;
    }
    if (elManzilPos) {
        elManzilPos.innerHTML = `<span class="text-sky-700 dark:text-sky-300">Juz ${manzilJuz} Hlm ${manzilHalaman}</span> <span class="text-slate-400 font-semibold text-[10px]">(Putaran Ke-${manzilPutaran})</span>`;
    }

    // Sinkronisasi Date Inputs & Labels
    const dateHarian = document.getElementById('tahfidz-date-harian');
    if (dateHarian) dateHarian.value = ASNTahfidz.detailSelectedDate || new Date().toISOString().split('T')[0];

    const curD = new Date(ASNTahfidz.detailSelectedDate || new Date());
    const pekanLabel = document.getElementById('tahfidz-pekan-label');
    if (pekanLabel) {
        const startW = new Date(curD);
        startW.setDate(curD.getDate() - curD.getDay() + 1);
        pekanLabel.innerText = `${startW.getDate().toString().padStart(2, '0')} ${startW.toLocaleString('id-ID', { month: 'short' })}...`;
    }

    const bulanLabel = document.getElementById('tahfidz-bulan-label');
    if (bulanLabel) {
        bulanLabel.innerText = curD.toLocaleString('id-ID', { month: 'long' });
    }

    // 3 Indikator (Harian, Pekanan, Bulanan)
    const elHarianTarget = document.getElementById('tahfidz-ind-harian-target');
    const elHarianRealita = document.getElementById('tahfidz-ind-harian-realita');
    const elHarianStatus = document.getElementById('tahfidz-ind-harian-status');

    if (elHarianTarget) elHarianTarget.innerText = ind.harian?.targetText || "1 Halaman / Setor (Z) • 2 Halaman / Setor (M)";
    if (elHarianRealita) elHarianRealita.innerText = ind.harian?.realitaText || "0 Hal (0x Setor)";
    if (elHarianStatus) {
        const stText = ind.harian?.status || "Belum Ada Setoran";
        elHarianStatus.innerText = stText;
        elHarianStatus.className = stText.includes('Belum')
            ? "text-[9px] font-extrabold px-2 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
            : "text-[9px] font-extrabold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
    }

    const elPekanTarget = document.getElementById('tahfidz-ind-pekan-target');
    const elPekanRealita = document.getElementById('tahfidz-ind-pekan-realita');
    const elPekanStatus = document.getElementById('tahfidz-ind-pekan-status');

    if (elPekanTarget) elPekanTarget.innerText = ind.pekanan?.targetText || "10 Halaman (Z) + 10 Halaman (M)";
    if (elPekanRealita) elPekanRealita.innerText = ind.pekanan?.realitaText || "0 Hal (0x Setor)";
    if (elPekanStatus) {
        const isTuntas = ind.pekanan?.isMurojaahTuntas;
        elPekanStatus.innerText = ind.pekanan?.status || "0% Capaian";
        elPekanStatus.className = isTuntas 
            ? "text-[9px] font-extrabold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
            : "text-[9px] font-extrabold px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
    }

    const elPekanZReal = document.getElementById('tahfidz-ind-pekan-ziyadah-real');
    const elPekanMReal = document.getElementById('tahfidz-ind-pekan-murojaah-real');

    if (elPekanZReal) {
        const zR = ind.pekanan?.ziyadahReal || 0;
        const zT = ind.pekanan?.ziyadahTarget || 10;
        elPekanZReal.innerText = `${zR} / ${zT} Halaman ${zR >= zT ? '✅' : ''}`;
    }
    if (elPekanMReal) {
        const mR = ind.pekanan?.murajaahReal || 0;
        const mT = ind.pekanan?.murajaahTarget || 10;
        const sR = ind.pekanan?.sabqiReal || 0;
        const mManzil = ind.pekanan?.manzilReal || 0;
        elPekanMReal.innerText = `${mR} / ${mT} Halaman (Sabqi: ${sR}, Manzil: ${mManzil}) ${mR >= mT ? '✅' : ''}`;
    }

    const elBulanTarget = document.getElementById('tahfidz-ind-bulan-target');
    const elBulanRealita = document.getElementById('tahfidz-ind-bulan-realita');
    const elBulanStatus = document.getElementById('tahfidz-ind-bulan-status');

    if (elBulanTarget) elBulanTarget.innerText = ind.bulanan?.targetText || "40 Halaman (Z) + 40 Halaman (M)";
    if (elBulanRealita) elBulanRealita.innerText = ind.bulanan?.realitaText || "1 Hal (2x Setor)";
    if (elBulanStatus) elBulanStatus.innerText = ind.bulanan?.status || "0% Capaian";

    // Render Riwayat Setoran (Tab 2) - Dual View: Kartu Responsif (Default HP) & Tabel Lengkap
    const riwayatTbody = document.getElementById('tahfidz-detail-riwayat-tbody');
    const riwayatCardList = document.getElementById('tahfidz-detail-riwayat-card-list');
    const riwayatCountBadge = document.getElementById('tahfidz-detail-riwayat-count-badge');
    const isParentOrPengasuh = ASNTahfidz.viewerRole === 'parent' || ASNTahfidz.viewerRole === 'pengasuh';

    if (riwayatCountBadge) {
        riwayatCountBadge.innerText = `${riwayat.length} Setoran`;
    }

    // 1. Render Tampilan Kartu (Optimal untuk HP agar tampil 100% utuh tanpa scroll kanan)
    if (riwayatCardList) {
        if (riwayat.length === 0) {
            riwayatCardList.innerHTML = `
            <div class="py-8 text-center text-xs text-slate-400 bg-slate-50 dark:bg-[#1c2836] rounded-2xl border border-dashed border-slate-200 dark:border-[#283a4e]">
                <i class="fa-solid fa-clock-rotate-left text-2xl text-slate-300 dark:text-slate-600 mb-2 block"></i>
                Belum ada riwayat setoran hafalan untuk kriteria ini.
            </div>`;
        } else {
            riwayatCardList.innerHTML = riwayat.map((r) => {
                const isUlang = r.statusSetoran === 'ULANG';
                const badgeColor = r.tipe === 'ZIYADAH' 
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                    : (r.tipe === 'MURAJAAH_SABQI' 
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' 
                        : (r.tipe === 'MURAJAAH_MANZIL' 
                            ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300' 
                            : (r.tipe === 'TASMI' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300')));

                const tipeLabel = r.tipe === 'MURAJAAH_SABQI' ? "Muroja'ah Sabqi" : (r.tipe === 'MURAJAAH_MANZIL' ? "Muroja'ah Manzil" : (r.tipe === 'ZIYADAH' ? "Ziyadah" : (r.tipe === 'TASMI' ? "Tasmi'" : escapeHtml(r.tipe))));
                
                const statusBadge = isUlang
                    ? '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60"><i class="fa-solid fa-rotate-left text-[8px]"></i> Ulang</span>'
                    : '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60"><i class="fa-solid fa-check text-[8px]"></i> Lulus</span>';

                const deleteBtn = isParentOrPengasuh ? '' : `
                    <button type="button" onclick="deleteTahfidzLogEntry('${r.logId}')" class="w-6 h-6 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300 flex items-center justify-center text-[10px] transition shrink-0 ml-1" title="Hapus Riwayat">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>`;

                return `
                <div class="p-3 bg-slate-50 dark:bg-[#1c2836] rounded-2xl border border-slate-200/80 dark:border-[#283a4e] space-y-2 transition hover:border-emerald-500/40">
                    <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-1.5 flex-wrap min-w-0">
                            <span class="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shrink-0 ${badgeColor}">
                                ${tipeLabel}
                            </span>
                            <span class="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                                <i class="fa-regular fa-calendar text-[10px] text-slate-400"></i>
                                <span>${escapeHtml(r.tanggal)}</span>
                            </span>
                        </div>
                        <div class="flex items-center gap-1 shrink-0">
                            <span class="font-extrabold text-xs ${isUlang ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}">
                                ${escapeHtml(r.nilai)}
                            </span>
                            ${statusBadge}
                            ${deleteBtn}
                        </div>
                    </div>

                    <div class="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200/60 dark:border-[#283a4e]/60 text-xs">
                        <div class="min-w-0">
                            <span class="font-black text-emerald-700 dark:text-emerald-400 text-xs">Juz ${r.juz}</span>
                            <span class="text-slate-600 dark:text-slate-300 text-[11px] font-medium ml-1 truncate">
                                (${escapeHtml(r.surah)})
                            </span>
                        </div>
                        <div class="text-[10px] font-semibold text-slate-500 dark:text-slate-400 shrink-0 bg-white dark:bg-[#15202d] px-2 py-0.5 rounded-lg border border-slate-200/60 dark:border-[#283a4e]">
                            Hlm ${escapeHtml(r.halamanList || '1')} (${r.totalHalaman} Hlm)
                        </div>
                    </div>
                </div>`;
            }).join('');
        }
    }

    // 2. Render Tampilan Tabel Lengkap (Bisa dialihkan via tombol toggle)
    if (riwayatTbody) {
        if (riwayat.length === 0) {
            riwayatTbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-xs text-slate-400">Belum ada riwayat setoran hafalan untuk kriteria ini.</td></tr>`;
        } else {
            riwayatTbody.innerHTML = riwayat.map((r, idx) => `
            <tr class="hover:bg-slate-50 dark:hover:bg-[#1c2836]/50 border-b border-slate-100 dark:border-[#253447] text-xs">
                <td class="px-3 py-2.5 font-bold text-slate-700 dark:text-slate-200">${escapeHtml(r.tanggal)}</td>
                <td class="px-3 py-2.5">
                    <span class="px-2 py-0.5 rounded text-[9px] font-extrabold ${r.tipe === 'ZIYADAH' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : (r.tipe === 'MURAJAAH_SABQI' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' : (r.tipe === 'MURAJAAH_MANZIL' ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300' : (r.tipe === 'TASMI' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' : 'bg-amber-100 text-amber-800')))}">
                        ${r.tipe === 'MURAJAAH_SABQI' ? 'Sabqi' : (r.tipe === 'MURAJAAH_MANZIL' ? 'Manzil' : (r.tipe === 'ZIYADAH' ? 'Ziyadah' : (r.tipe === 'TASMI' ? "Tasmi'" : escapeHtml(r.tipe))))}
                    </span>
                </td>
                <td class="px-3 py-2.5">
                    <span class="font-bold text-emerald-700 dark:text-emerald-400">Juz ${r.juz}</span>
                    <span class="text-slate-400 text-[10px]">(${escapeHtml(r.surah)})</span>
                </td>
                <td class="px-3 py-2.5">Halaman ${escapeHtml(r.halamanList || '1')} (${r.totalHalaman} Hlm)</td>
                <td class="px-3 py-2.5">
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="font-bold ${r.statusSetoran === 'ULANG' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}">${escapeHtml(r.nilai)}</span>
                        ${r.statusSetoran === 'ULANG'
                            ? '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60"><i class="fa-solid fa-rotate-left text-[8px]"></i> Wajib Ulang</span>'
                            : '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60"><i class="fa-solid fa-check text-[8px]"></i> Lulus</span>'
                        }
                    </div>
                </td>
                <td class="px-3 py-2.5 text-right">
                    ${isParentOrPengasuh ? '<span class="text-[9px] font-semibold text-slate-400">Tercatat</span>' : `
                    <button type="button" onclick="deleteTahfidzLogEntry('${r.logId}')" class="text-slate-400 hover:text-rose-600 text-xs p-1 transition" title="Hapus Riwayat">
                        <i class="fa-solid fa-trash"></i>
                    </button>`}
                </td>
            </tr>
            `).join('');
        }
    }

    // Set mode tampilan default
    setTahfidzRiwayatView(tahfidzRiwayatViewMode);

    // Hitung dan siapkan data Tab Estimasi Waktu Khatam
    renderTahfidzEstimasiKhatam();

    // Hitung dan siapkan data Tab Presensi & Udzur
    renderTahfidzStudentPresensiTab();
}

/**
 * Hapus entri log dari riwayat
 */
async function deleteTahfidzLogEntry(logId) {
    if (!confirm("Apakah Anda yakin ingin menghapus catatan setoran ini?")) return;

    try {
        const token = (typeof ASNIdentity !== 'undefined' && ASNIdentity.getSessionToken ? ASNIdentity.getSessionToken() : '') ||
                      (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : '') ||
                      sessionStorage.getItem(TAHFIDZ_STORAGE_KEYS.adminToken) ||
                      sessionStorage.getItem("mubarokah_admin_token") || "";
        const res = await apiPost("deleteTahfidzLog", { token, logId });
        if (res && (res.success || res.status === "success")) {
            if (typeof showToast === 'function') showToast(res.message || "Catatan setoran berhasil dihapus.");
            if (ASNTahfidz.activeStudentDetail?.student?.studentId) {
                openTahfidzStudentDetail(ASNTahfidz.activeStudentDetail.student.studentId);
            }
            loadAdminTahfidzData(true);
        } else {
            const errorMsg = (res && res.message) ? ("❌ " + res.message) : "❌ Gagal menghapus catatan.";
            if (typeof showToast === 'function') showToast(errorMsg);
        }
    } catch (e) {
        console.error(e);
        if (typeof showToast === 'function') showToast("❌ Gagal menghapus catatan: " + (e.message || "Koneksi bermasalah"));
    }
}

let tahfidzRiwayatViewMode = 'card';

/**
 * Ganti mode tampilan riwayat setoran: 'card' (optimal HP tanpa scroll) atau 'table' (tabel lengkap)
 */
function setTahfidzRiwayatView(mode) {
    tahfidzRiwayatViewMode = mode || 'card';
    const cardList = document.getElementById('tahfidz-detail-riwayat-card-list');
    const tableWrapper = document.getElementById('tahfidz-detail-riwayat-table-wrapper');
    const btnCard = document.getElementById('btn-riwayat-view-card');
    const btnTable = document.getElementById('btn-riwayat-view-table');

    if (tahfidzRiwayatViewMode === 'card') {
        if (cardList) cardList.classList.remove('hidden');
        if (tableWrapper) tableWrapper.classList.add('hidden');
        if (btnCard) btnCard.className = "px-2.5 py-1 rounded-md text-[10px] font-bold transition bg-white dark:bg-[#15202d] text-emerald-700 dark:text-emerald-400 shadow-sm";
        if (btnTable) btnTable.className = "px-2.5 py-1 rounded-md text-[10px] font-bold transition text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200";
    } else {
        if (cardList) cardList.classList.add('hidden');
        if (tableWrapper) tableWrapper.classList.remove('hidden');
        if (btnTable) btnTable.className = "px-2.5 py-1 rounded-md text-[10px] font-bold transition bg-white dark:bg-[#15202d] text-emerald-700 dark:text-emerald-400 shadow-sm";
        if (btnCard) btnCard.className = "px-2.5 py-1 rounded-md text-[10px] font-bold transition text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200";
    }
}
window.setTahfidzRiwayatView = setTahfidzRiwayatView;

/**
 * Render Tab 4: Riwayat Presensi & Catatan Udzur Santri (Screenshot 5 / Modal Detail)
 */
function renderTahfidzStudentPresensiTab() {
    const res = ASNTahfidz.activeStudentDetail;
    if (!res) return;

    const st = res.student || {};
    let riwayatPresensi = Array.isArray(res.riwayatPresensi) ? [...res.riwayatPresensi] : [];

    // Fallback: Jika di respons backend belum ada riwayatPresensi (misal cache/offline), cek dari cache lokal
    if (riwayatPresensi.length === 0) {
        try {
            const rawCache = localStorage.getItem('asn_tahfidz_presensi_cache') || localStorage.getItem('Tahfidz_Presensi');
            if (rawCache) {
                const parsed = JSON.parse(rawCache);
                const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.data) ? parsed.data : []);
                const sId = String(st.studentId || st.student_id || '').trim();
                const sNis = String(st.nis || '').trim();
                const matched = list.filter(item => {
                    const iId = String(item.studentId || item.student_id || '').trim();
                    const iNis = String(item.nis || '').trim();
                    return (iId && (iId === sId || iId === sNis)) || (iNis && (iNis === sId || iNis === sNis));
                });
                if (matched.length > 0) riwayatPresensi = matched;
            }
        } catch (e) {
            console.warn("[renderTahfidzStudentPresensiTab] Fallback cache reading error:", e);
        }
    }

    // Urutkan dari yang terbaru
    riwayatPresensi.sort((a, b) => new Date(b.tanggal || b.updatedAt || 0) - new Date(a.tanggal || a.updatedAt || 0));

    // 1. Status Kehadiran Hari Ini
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayFormatted = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

    const elTodayBadge = document.getElementById('tahfidz-presensi-status-today-badge');
    const elTodayDate = document.getElementById('tahfidz-presensi-today-date');
    const elTodayNotes = document.getElementById('tahfidz-presensi-today-notes');

    if (elTodayDate) {
        elTodayDate.innerText = todayFormatted;
    }

    const todayRecord = riwayatPresensi.find(r => {
        const rTgl = String(r.tanggal || '').split('T')[0];
        return rTgl === todayStr;
    });

    if (todayRecord) {
        const stUp = String(todayRecord.status || 'HADIR').toUpperCase();
        let badgeBg = "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300 dark:border-rose-800";
        let iconHtml = '<i class="fa-solid fa-bed-pulse text-rose-600 dark:text-rose-400"></i>';
        let label = "Sakit";

        if (stUp === 'IZIN') {
            badgeBg = "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 dark:border-amber-800";
            iconHtml = '<i class="fa-solid fa-envelope-open-text text-amber-600 dark:text-amber-400"></i>';
            label = "Izin";
        } else if (stUp === 'PULANG') {
            badgeBg = "bg-orange-100 text-orange-800 dark:bg-orange-950/80 dark:text-orange-300 border-orange-300 dark:border-orange-800";
            iconHtml = '<i class="fa-solid fa-house-chimney text-orange-600 dark:text-orange-400"></i>';
            label = "Pulang ke Rumah";
        }

        if (elTodayBadge) {
            elTodayBadge.className = `px-3 py-1 rounded-full text-xs font-black inline-flex items-center gap-1.5 border ${badgeBg}`;
            elTodayBadge.innerHTML = `${iconHtml} <span>${label} (${escapeHtml(todayRecord.sesi || 'Sesi')})</span>`;
        }
        if (elTodayNotes) {
            elTodayNotes.innerHTML = `<span class="font-bold text-slate-700 dark:text-slate-300">Catatan:</span> ${escapeHtml(todayRecord.keterangan || 'Tidak ada catatan tambahan')}`;
        }
    } else {
        // Santri Hadir (karena exception-based logging hanya mencatat udzur)
        if (elTodayBadge) {
            elTodayBadge.className = "px-3 py-1 rounded-full text-xs font-black inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800";
            elTodayBadge.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-600 dark:text-emerald-400"></i> Hadir Istiqomah';
        }
        if (elTodayNotes) {
            elTodayNotes.innerText = "Alhamdulillah, santri hadir halaqah hari ini tanpa catatan udzur";
        }
    }

    // 2. Tiga Stat Metrik
    const totalUdzur = riwayatPresensi.length;
    const totalSakit = riwayatPresensi.filter(r => (r.status || '').toUpperCase() === 'SAKIT').length;
    const totalIzin = riwayatPresensi.filter(r => ['IZIN', 'PULANG'].includes((r.status || '').toUpperCase())).length;

    const elTotalUdzur = document.getElementById('tahfidz-presensi-stat-total-udzur');
    const elTotalSakit = document.getElementById('tahfidz-presensi-stat-sakit');
    const elTotalIzin = document.getElementById('tahfidz-presensi-stat-izin');
    const elLogCountBadge = document.getElementById('tahfidz-presensi-log-count-badge');

    if (elTotalUdzur) elTotalUdzur.innerText = `${totalUdzur}`;
    if (elTotalSakit) elTotalSakit.innerText = `${totalSakit}`;
    if (elTotalIzin) elTotalIzin.innerText = `${totalIzin}`;
    if (elLogCountBadge) elLogCountBadge.innerText = `${totalUdzur} Catatan`;

    // 3. Render Daftar Timeline Riwayat Udzur
    const elListContainer = document.getElementById('tahfidz-presensi-log-list');
    if (!elListContainer) return;

    if (riwayatPresensi.length === 0) {
        elListContainer.innerHTML = `
            <div class="py-8 px-4 text-center bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl border border-dashed border-emerald-300 dark:border-emerald-800/60 space-y-2">
                <div class="w-12 h-12 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center text-xl shadow-sm">
                    <i class="fa-solid fa-award"></i>
                </div>
                <h5 class="text-xs font-black text-emerald-900 dark:text-emerald-200">Kehadiran Istiqomah 100%</h5>
                <p class="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                    Alhamdulillah, belum ada catatan udzur / ketidakhadiran (Sakit, Izin, Pulang) pada akun santri ini. Pertahankan terus kedisiplinan dan istiqomah mengaji!
                </p>
            </div>
        `;
    } else {
        elListContainer.innerHTML = riwayatPresensi.map(r => {
            const stUp = String(r.status || 'HADIR').toUpperCase();
            let statusBadge = '';
            if (stUp === 'SAKIT') {
                statusBadge = '<span class="px-2 py-0.5 rounded-lg text-[10px] font-black bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-900 flex items-center gap-1"><i class="fa-solid fa-bed-pulse text-[9px]"></i> SAKIT</span>';
            } else if (stUp === 'IZIN') {
                statusBadge = '<span class="px-2 py-0.5 rounded-lg text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-900 flex items-center gap-1"><i class="fa-solid fa-envelope-open-text text-[9px]"></i> IZIN</span>';
            } else if (stUp === 'PULANG') {
                statusBadge = '<span class="px-2 py-0.5 rounded-lg text-[10px] font-black bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 border border-orange-200 dark:border-orange-900 flex items-center gap-1"><i class="fa-solid fa-house-chimney text-[9px]"></i> PULANG</span>';
            } else {
                statusBadge = `<span class="px-2 py-0.5 rounded-lg text-[10px] font-black bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">${escapeHtml(stUp)}</span>`;
            }

            let dateLabel = r.tanggal || '-';
            try {
                if (r.tanggal && !isNaN(new Date(r.tanggal).getTime())) {
                    dateLabel = new Date(r.tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
                }
            } catch (e) {}

            return `
                <div class="p-3 bg-white dark:bg-[#15202d] rounded-2xl border border-slate-200/80 dark:border-[#253447] shadow-sm space-y-2 hover:border-slate-300 dark:hover:border-slate-600 transition">
                    <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2">
                            ${statusBadge}
                            <span class="text-xs font-bold text-slate-800 dark:text-slate-100">${escapeHtml(dateLabel)}</span>
                        </div>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#1c2836] text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-[#283a4e]">
                            <i class="fa-regular fa-clock text-[9px] mr-1 text-slate-400"></i>Sesi ${escapeHtml(r.sesi || 'Pagi')}
                        </span>
                    </div>

                    <div class="p-2 rounded-xl bg-slate-50 dark:bg-[#1c2836] border border-slate-200/60 dark:border-[#283a4e] text-xs text-slate-700 dark:text-slate-300">
                        <span class="font-bold text-slate-500 dark:text-slate-400 text-[10px] uppercase block mb-0.5">Keterangan / Alasan Udzur:</span>
                        <p class="italic leading-relaxed">${escapeHtml(r.keterangan || 'Tidak ada catatan tambahan')}</p>
                    </div>

                    <div class="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                        <span class="flex items-center gap-1">
                            <i class="fa-solid fa-chalkboard-user text-emerald-600"></i>
                            Pencatat: <b class="text-slate-600 dark:text-slate-300 font-semibold">${escapeHtml(r.muhafiz || 'Muhafiz')}</b>
                        </span>
                        <span>${r.namaHalaqah ? escapeHtml(r.namaHalaqah) : ''}</span>
                    </div>
                </div>
            `;
        }).join('');
    }
}
window.renderTahfidzStudentPresensiTab = renderTahfidzStudentPresensiTab;

// ====================================================================
// 4. MODAL: TARGET CAPAIAN SANTRI (Screenshot 3)
// ====================================================================

/**
 * Bersihkan format jam dari Google Sheets epoch / Date string menjadi HH:mm rapi
 */
function cleanSesiTime(timeVal, defaultVal = "00:00") {
    if (!timeVal) return defaultVal;
    const str = String(timeVal).trim();
    // Tangkap pola HH:mm
    const match = str.match(/(?:(?:1899|1900|\d{4})[^\d]+)?(\d{1,2}):(\d{2})(?::\d{2})?/);
    if (match) {
        return `${match[1].padStart(2, '0')}:${match[2].padStart(2, '0')}`;
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    return defaultVal;
}

/**
 * Hitung jumlah sesi aktif per pekan untuk Ziyadah dan Muroja'ah berdasarkan Sheet Tahfidz_Jadwal_Sesi
 */
function getTahfidzActiveWeeklySessionCounts() {
    let sesiList = ASNTahfidz.data.sesiList || [];
    if (!sesiList || sesiList.length === 0) {
        // Fallback default jika data sesi belum dimuat
        return {
            ziyadahWeeklySessions: 10,
            murajaahWeeklySessions: 5,
            activeSessions: []
        };
    }

    const activeSessions = sesiList.filter(s => (s.status || 'Aktif Digunakan').includes('Aktif'));
    let ziyadahCount = 0;
    let murajaahCount = 0;

    activeSessions.forEach(s => {
        const j = (s.jenisSesi || s.jenis || '').toUpperCase();
        const rawHari = s.hariList || s.hari || [];
        const hariArr = Array.isArray(rawHari) ? rawHari : String(rawHari).split(',').map(x => x.trim()).filter(Boolean);
        const dayCount = Math.max(1, hariArr.length);

        const isMurajaah = j.includes('MURAJA') || j.includes('MUROJA') || j.includes('TASMI') || j.includes('ULANG') || j.includes('UJIAN');
        if (isMurajaah) {
            murajaahCount += dayCount;
        } else {
            // Default Ziyadah (Hafalan Baru)
            ziyadahCount += dayCount;
        }
    });

    return {
        ziyadahWeeklySessions: ziyadahCount > 0 ? ziyadahCount : 10,
        murajaahWeeklySessions: murajaahCount > 0 ? murajaahCount : 5,
        activeSessions: activeSessions
    };
}

/**
 * Render kartu jadwal sesi aktif di dalam Modal Target Capaian Santri (Konsep Khodim.com)
 */
function renderTahfidzTargetModalSessions() {
    const container = document.getElementById('tahfidz-target-sesi-container');
    const badgeZ = document.getElementById('tahfidz-target-badge-ziyadah');
    const badgeM = document.getElementById('tahfidz-target-badge-murajaah');

    const counts = getTahfidzActiveWeeklySessionCounts();

    if (badgeZ) badgeZ.innerText = `${counts.ziyadahWeeklySessions} Sesi Ziyadah/Pekan`;
    if (badgeM) badgeM.innerText = `${counts.murajaahWeeklySessions} Sesi Muroja'ah/Pekan`;

    if (!container) return;

    if (!counts.activeSessions || counts.activeSessions.length === 0) {
        container.innerHTML = `
            <div class="col-span-full p-2.5 bg-white dark:bg-[#15202d] rounded-xl border border-slate-200/60 dark:border-[#283a4e] text-center text-slate-400">
                Belum ada jadwal sesi aktif di sheet Tahfidz_Jadwal_Sesi.
            </div>
        `;
        return;
    }

    container.innerHTML = counts.activeSessions.map((s, idx) => {
        const nama = s.namaSesi || s.nama || `Sesi 0${idx + 1}`;
        const jamMulai = cleanSesiTime(s.jamMulai, '05:00');
        const jamSelesai = cleanSesiTime(s.jamSelesai, '06:00');
        const jamStr = `${jamMulai} - ${jamSelesai} WIB`;

        const j = (s.jenisSesi || s.jenis || '').toUpperCase();
        const rawHari = s.hariList || s.hari || [];
        const hariArr = Array.isArray(rawHari) ? rawHari : String(rawHari).split(',').map(x => x.trim()).filter(Boolean);
        const dayCount = hariArr.length || 5;

        let badgeLabel = 'Ziyadah';
        let badgeColor = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';

        if (j.includes('TASMI') || j.includes('UJIAN')) {
            badgeLabel = s.jenisSesi || s.jenis || 'Ujian Kenaikan Juz';
            badgeColor = 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300';
        } else if (j.includes('MURAJA') || j.includes('MUROJA')) {
            badgeLabel = "Muroja'ah";
            badgeColor = 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
        }

        return `
        <div class="p-2.5 bg-white dark:bg-[#15202d] rounded-xl border border-slate-200/70 dark:border-[#283a4e] space-y-1.5 flex flex-col justify-between">
            <div class="flex items-center justify-between gap-1">
                <span class="font-extrabold text-slate-800 dark:text-slate-100 truncate text-[11px]">${escapeHtml(nama)}</span>
                <span class="px-1.5 py-0.5 rounded text-[8px] font-extrabold shrink-0 ${badgeColor}">
                    ${escapeHtml(badgeLabel)}
                </span>
            </div>
            <div class="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[10px] pt-0.5">
                <span class="font-semibold">${escapeHtml(jamStr)}</span>
                <span class="text-slate-400 font-bold shrink-0">${dayCount} Hari/Pekan</span>
            </div>
        </div>
        `;
    }).join('');
}

/**
 * Hitung otomatis Target Mingguan & Bulanan berdasarkan Rumus:
 * Target Mingguan = Target Sesi x Jumlah Sesi Aktif Pekan
 * Target Bulanan = Target Mingguan x 4 Pekan
 * Standar Mushaf: 2 Hlm = 1 Lembar • 20 Hlm = 1 Juz (10 Lembar)
 */
function recalculateTahfidzTargetWeekly() {
    const counts = getTahfidzActiveWeeklySessionCounts();

    const elZSesi = document.getElementById('input-target-ziyadah-sesi');
    const elZPekan = document.getElementById('input-target-ziyadah-pekan');
    const elZBulan = document.getElementById('input-target-ziyadah-bulan');

    const elMSesi = document.getElementById('input-target-murajaah-sesi');
    const elMPekan = document.getElementById('input-target-murajaah-pekan');
    const elMBulan = document.getElementById('input-target-murajaah-bulan');

    const zSesi = Math.max(0.5, parseFloat(elZSesi?.value) || 1);
    const mSesi = Math.max(0.5, parseFloat(elMSesi?.value) || 2);

    const zPekanTotal = Number((zSesi * counts.ziyadahWeeklySessions).toFixed(1));
    const zBulanTotal = Number((zPekanTotal * 4).toFixed(1));

    const mPekanTotal = Number((mSesi * counts.murajaahWeeklySessions).toFixed(1));
    const mBulanTotal = Number((mPekanTotal * 4).toFixed(1));

    const formatHal = (n) => (Number.isInteger(n) ? n.toString() : n.toFixed(1));

    if (elZPekan) {
        const lembar = formatHal(Number((zPekanTotal / 2).toFixed(1)));
        const juz = formatHal(Number((zPekanTotal / 20).toFixed(1)));
        elZPekan.value = `${formatHal(zPekanTotal)} Halaman (${lembar} Lembar / ~${juz} Juz / Pekan)`;
    }

    if (elZBulan) {
        const lembar = formatHal(Number((zBulanTotal / 2).toFixed(1)));
        const juz = formatHal(Number((zBulanTotal / 20).toFixed(1)));
        elZBulan.value = `${formatHal(zBulanTotal)} Halaman (${lembar} Lembar / ~${juz} Juz / Bulan)`;
    }

    if (elMPekan) {
        const lembar = formatHal(Number((mPekanTotal / 2).toFixed(1)));
        const juz = formatHal(Number((mPekanTotal / 20).toFixed(1)));
        elMPekan.value = `${formatHal(mPekanTotal)} Halaman (${lembar} Lembar / ~${juz} Juz / Pekan)`;
    }

    if (elMBulan) {
        const lembar = formatHal(Number((mBulanTotal / 2).toFixed(1)));
        const juz = formatHal(Number((mBulanTotal / 20).toFixed(1)));
        elMBulan.value = `${formatHal(mBulanTotal)} Halaman (${lembar} Lembar / ~${juz} Juz / Bulan)`;
    }

    return { zPekanTotal, zBulanTotal, mPekanTotal, mBulanTotal };
}

/**
 * Buka modal atur target santri
 */
function openTahfidzTargetModal(studentId) {
    const modal = document.getElementById('modal-tahfidz-target');
    if (!modal) return;

    const student = (ASNTahfidz.data.students || []).find(s => s.studentId === studentId || s.nis === studentId);
    if (!student) return;

    ASNTahfidz.targetState.studentId = studentId;

    const nameEl = document.getElementById('tahfidz-target-student-name');
    if (nameEl) nameEl.innerText = `${student.name} • NIS: ${student.nis || '-'}`;

    // Render sesi dinamis dari sheet Tahfidz_Jadwal_Sesi (Konsep Khodim)
    renderTahfidzTargetModalSessions();

    const zSesi = student.target?.ziyadahSesi || 1;
    const mSesi = student.target?.murajaahSesi || 2;

    const elZSesi = document.getElementById('input-target-ziyadah-sesi');
    const elMSesi = document.getElementById('input-target-murajaah-sesi');

    if (elZSesi) elZSesi.value = zSesi;
    if (elMSesi) elMSesi.value = mSesi;

    // Hitung otomatis Target Mingguan & Bulanan
    recalculateTahfidzTargetWeekly();

    modal.classList.remove('hidden');
}

/**
 * Tutup modal atur target santri
 */
function closeTahfidzTargetModal() {
    const modal = document.getElementById('modal-tahfidz-target');
    if (modal) modal.classList.add('hidden');
}

/**
 * Quick chip penambah target
 */
function setTahfidzTargetChip(type, val) {
    if (type === 'ZIYADAH') {
        const el = document.getElementById('input-target-ziyadah-sesi');
        if (el) el.value = val;
    } else {
        const el = document.getElementById('input-target-murajaah-sesi');
        if (el) el.value = val;
    }
    recalculateTahfidzTargetWeekly();
}

/**
 * Simpan target mutaba'ah santri
 */
async function submitTahfidzTarget() {
    const studentId = ASNTahfidz.targetState.studentId;
    if (!studentId) return;

    const zSesi = Number(document.getElementById('input-target-ziyadah-sesi')?.value || 1);
    const mSesi = Number(document.getElementById('input-target-murajaah-sesi')?.value || 2);

    const { zPekanTotal, mPekanTotal } = recalculateTahfidzTargetWeekly();

    const btn = document.getElementById('btn-save-tahfidz-target');
    setTahfidzButtonLoading(btn, true, "Menyimpan Target...");

    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(TAHFIDZ_STORAGE_KEYS.adminToken)) || "";
        const response = await apiPost("saveTahfidzTarget", {
            token,
            studentId,
            targetZiyadahSesi: zSesi,
            targetZiyadahPekan: zPekanTotal,
            targetMurajaahSesi: mSesi,
            targetMurajaahPekan: mPekanTotal
        });

        if (response && (response.success || response.status === "success")) {
            if (typeof showToast === 'function') showToast("✅ Target santri berhasil diperbarui!");
            // Update local student target in memory
            const updateTargetInStudent = (st) => {
                if (!st) return;
                if (!st.target) st.target = {};
                st.target.ziyadahSesi = zSesi;
                st.target.ziyadahPekan = zPekanTotal;
                st.target.ziyadahBulan = zPekanTotal * 4;
                st.target.murajaahSesi = mSesi;
                st.target.murajaahPekan = mPekanTotal;
                st.target.murajaahBulan = mPekanTotal * 4;
            };

            const st = (ASNTahfidz.data.students || []).find(s => s.studentId === studentId || s.nis === studentId);
            updateTargetInStudent(st);
            const stFiltered = (ASNTahfidz.filteredStudents || []).find(s => s.studentId === studentId || s.nis === studentId);
            updateTargetInStudent(stFiltered);

            // Re-render tabel instan dengan target baru
            renderTahfidzStudentTable();
            closeTahfidzTargetModal();

            // Sinkronisasi data di latar belakang
            loadAdminTahfidzData(true);
        } else {
            if (typeof showToast === 'function') showToast("❌ " + ((response && response.message) || "Gagal menyimpan target."));
        }
    } catch (err) {
        console.error(err);
        if (typeof showToast === 'function') showToast("❌ Terjadi kesalahan saat menyimpan target: " + (err.message || err));
    } finally {
        setTahfidzButtonLoading(btn, false);
    }
}

// ====================================================================
// 4B. MANAJEMEN SELEKSI & TARGET MASSAL (BULK EDIT TARGET)
// ====================================================================

/**
 * Update UI floating bulk selection action bar dan checkbox check-all
 */
function updateTahfidzBulkSelectionBar() {
    const bar = document.getElementById('tahfidz-bulk-selection-bar');
    const text = document.getElementById('tahfidz-selected-count-text');
    const checkAll = document.getElementById('tahfidz-check-all');
    const count = ASNTahfidz.selectedStudentIds ? ASNTahfidz.selectedStudentIds.size : 0;

    if (bar) {
        if (count > 0) {
            bar.classList.remove('hidden');
        } else {
            bar.classList.add('hidden');
        }
    }
    if (text) {
        text.innerText = `${count} santri dipilih`;
    }

    const currentStudents = (ASNTahfidz.filteredStudents && ASNTahfidz.filteredStudents.length > 0)
        ? ASNTahfidz.filteredStudents
        : (ASNTahfidz.data.students || []);

    if (checkAll && currentStudents.length > 0) {
        const allChecked = count > 0 && currentStudents.every(st => ASNTahfidz.selectedStudentIds.has(st.studentId));
        checkAll.checked = allChecked;
        checkAll.indeterminate = count > 0 && !allChecked;
    } else if (checkAll) {
        checkAll.checked = false;
        checkAll.indeterminate = false;
    }
}

/**
 * Toggle checklist seluruh santri pada tabel mutaba'ah
 */
function toggleSelectAllTahfidzStudents(checked) {
    if (!ASNTahfidz.selectedStudentIds) {
        ASNTahfidz.selectedStudentIds = new Set();
    }
    const currentStudents = (ASNTahfidz.filteredStudents && ASNTahfidz.filteredStudents.length > 0)
        ? ASNTahfidz.filteredStudents
        : (ASNTahfidz.data.students || []);

    currentStudents.forEach(st => {
        if (st && st.studentId) {
            if (checked) {
                ASNTahfidz.selectedStudentIds.add(st.studentId);
            } else {
                ASNTahfidz.selectedStudentIds.delete(st.studentId);
            }
        }
    });

    document.querySelectorAll('.tahfidz-row-checkbox').forEach(cb => {
        cb.checked = checked;
    });

    updateTahfidzBulkSelectionBar();
}

/**
 * Toggle checklist perorangan santri
 */
function toggleSelectTahfidzStudent(studentId, checked) {
    if (!ASNTahfidz.selectedStudentIds) {
        ASNTahfidz.selectedStudentIds = new Set();
    }
    if (checked) {
        ASNTahfidz.selectedStudentIds.add(studentId);
    } else {
        ASNTahfidz.selectedStudentIds.delete(studentId);
    }
    updateTahfidzBulkSelectionBar();
}

/**
 * Batalkan seluruh pilihan santri
 */
function clearTahfidzSelectedStudents() {
    if (ASNTahfidz.selectedStudentIds) {
        ASNTahfidz.selectedStudentIds.clear();
    }
    document.querySelectorAll('.tahfidz-row-checkbox').forEach(cb => {
        cb.checked = false;
    });
    const checkAll = document.getElementById('tahfidz-check-all');
    if (checkAll) {
        checkAll.checked = false;
        checkAll.indeterminate = false;
    }
    updateTahfidzBulkSelectionBar();
}

/**
 * Buka modal atur target massal
 */
function openTahfidzBulkTargetModal(initialScope = 'ALL') {
    const modal = document.getElementById('modal-tahfidz-target-bulk');
    if (!modal) return;

    // Populate Halaqah Dropdown
    const selHalaqah = document.getElementById('bulk-target-select-halaqah');
    if (selHalaqah) {
        const halaqahs = ASNTahfidz.data.halaqahs || [];
        selHalaqah.innerHTML = halaqahs.length > 0
            ? halaqahs.map(h => `<option value="${escapeHtml(h.id || h.halaqahId || h.namaHalaqah)}">${escapeHtml(h.namaHalaqah || h.nama)}</option>`).join('')
            : '<option value="">(Belum ada halaqah)</option>';
    }

    // Update Session Badges
    const counts = getTahfidzActiveWeeklySessionCounts();
    const badgeZ = document.getElementById('bulk-target-badge-ziyadah');
    const badgeM = document.getElementById('bulk-target-badge-murajaah');
    if (badgeZ) badgeZ.innerText = `${counts.ziyadahWeeklySessions} Sesi Ziyadah/Pekan`;
    if (badgeM) badgeM.innerText = `${counts.murajaahWeeklySessions} Sesi Muroja'ah/Pekan`;

    // Tentukan scope awal: cukup Semua Santri (ALL) atau Per Halaqah (HALAQAH)
    const scopeToUse = (initialScope === 'HALAQAH') ? 'HALAQAH' : 'ALL';
    setBulkTargetScope(scopeToUse);

    // Hitung target otomatis
    recalculateBulkTargetWeekly();

    modal.classList.remove('hidden');
}

/**
 * Tutup modal target massal
 */
function closeTahfidzBulkTargetModal() {
    const modal = document.getElementById('modal-tahfidz-target-bulk');
    if (modal) modal.classList.add('hidden');
}

/**
 * Set target scope (ALL, HALAQAH, KATEGORI, SELECTED)
 */
function setBulkTargetScope(scope) {
    if (scope !== 'HALAQAH') scope = 'ALL';
    if (!ASNTahfidz.bulkTargetState) {
        ASNTahfidz.bulkTargetState = { scope: 'ALL', halaqahId: '', kategori: '', studentIds: [] };
    }
    ASNTahfidz.bulkTargetState.scope = scope;

    const scopes = ['ALL', 'HALAQAH'];
    scopes.forEach(s => {
        const btn = document.getElementById(`btn-scope-${s.toLowerCase()}`);
        if (!btn) return;
        if (s === scope) {
            btn.className = 'px-3 py-2.5 rounded-xl font-bold text-xs border text-center transition flex flex-col items-center gap-1.5 bg-white dark:bg-[#15202d] border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-sm ring-2 ring-emerald-500/20 active:scale-95';
        } else {
            btn.className = 'px-3 py-2.5 rounded-xl font-bold text-xs border text-center transition flex flex-col items-center gap-1.5 bg-white dark:bg-[#15202d] border-slate-200 dark:border-[#283a4e] text-slate-600 dark:text-slate-300 hover:border-amber-400 active:scale-95';
        }
    });

    const subContainer = document.getElementById('bulk-target-subselect-container');
    const halaqahWrap = document.getElementById('bulk-target-halaqah-wrapper');
    const kategoriWrap = document.getElementById('bulk-target-kategori-wrapper');

    if (subContainer) {
        if (scope === 'HALAQAH') {
            subContainer.classList.remove('hidden');
        } else {
            subContainer.classList.add('hidden');
        }
    }

    if (halaqahWrap) {
        if (scope === 'HALAQAH') halaqahWrap.classList.remove('hidden');
        else halaqahWrap.classList.add('hidden');
    }

    if (kategoriWrap) {
        kategoriWrap.classList.add('hidden');
    }

    onBulkTargetScopeChange();
}

/**
 * Filter santri sasaran berdasarkan scope aktif
 */
function onBulkTargetScopeChange() {
    if (!ASNTahfidz.bulkTargetState) {
        ASNTahfidz.bulkTargetState = { scope: 'ALL', halaqahId: '', kategori: '', studentIds: [] };
    }
    const scope = ASNTahfidz.bulkTargetState.scope || 'ALL';
    const allStudents = ASNTahfidz.data.students || [];

    let targetStudents = [];
    let summaryText = "";

    if (scope === 'HALAQAH') {
        const selHalaqah = document.getElementById('bulk-target-select-halaqah');
        const halaqahVal = selHalaqah ? selHalaqah.value : "";
        const halaqahObj = (ASNTahfidz.data.halaqahs || []).find(h => (h.id || h.halaqahId || h.namaHalaqah) === halaqahVal);
        const halaqahName = halaqahObj ? (halaqahObj.namaHalaqah || halaqahObj.nama) : halaqahVal;

        targetStudents = allStudents.filter(st => {
            const hid = st.halaqahId || (st.halaqah && (st.halaqah.halaqahId || st.halaqah.id || st.halaqah.namaHalaqah));
            const hname = st.halaqah?.namaHalaqah || st.halaqahName || "";
            return (hid && hid === halaqahVal) || (hname && hname === halaqahName);
        });
        summaryText = `Target diterapkan ke santri kelompok: ${halaqahName || 'Halaqah terpilih'} (${targetStudents.length} santri)`;
    } else {
        // Default ALL: semua santri aktif yang sudah masuk halaqah
        targetStudents = allStudents.filter(st => isStudentInHalaqah(st));
        summaryText = `Target akan diterapkan ke seluruh santri halaqah aktif (${targetStudents.length} santri)`;
    }

    const targetIds = targetStudents.map(st => st.studentId).filter(Boolean);
    ASNTahfidz.bulkTargetState.studentIds = targetIds;

    const badge = document.getElementById('bulk-target-recipient-badge');
    const summaryEl = document.getElementById('bulk-target-summary-text');
    const previewEl = document.getElementById('bulk-target-student-preview');

    if (badge) {
        badge.innerText = `${targetIds.length} Santri Sasaran`;
        if (targetIds.length > 0) {
            badge.className = 'text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
        } else {
            badge.className = 'text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300';
        }
    }
    if (summaryEl) summaryEl.innerText = summaryText;

    if (previewEl) {
        if (targetStudents.length === 0) {
            previewEl.innerText = 'Tidak ada santri yang cocok';
        } else if (targetStudents.length <= 3) {
            previewEl.innerText = targetStudents.map(s => s.name).join(', ');
        } else {
            const firstThree = targetStudents.slice(0, 3).map(s => s.name).join(', ');
            previewEl.innerText = `${firstThree}, dan ${targetStudents.length - 3} lainnya`;
        }
    }
}

/**
 * Hitung otomatis Target Mingguan & Bulanan pada form massal
 */
function recalculateBulkTargetWeekly() {
    const counts = getTahfidzActiveWeeklySessionCounts();

    const elZSesi = document.getElementById('input-bulk-target-ziyadah-sesi');
    const elZPekan = document.getElementById('input-bulk-target-ziyadah-pekan');
    const elZBulan = document.getElementById('input-bulk-target-ziyadah-bulan');

    const elMSesi = document.getElementById('input-bulk-target-murajaah-sesi');
    const elMPekan = document.getElementById('input-bulk-target-murajaah-pekan');
    const elMBulan = document.getElementById('input-bulk-target-murajaah-bulan');

    const zSesi = Math.max(0.5, parseFloat(elZSesi?.value) || 1);
    const mSesi = Math.max(0.5, parseFloat(elMSesi?.value) || 2);

    const zPekanTotal = Number((zSesi * counts.ziyadahWeeklySessions).toFixed(1));
    const zBulanTotal = Number((zPekanTotal * 4).toFixed(1));

    const mPekanTotal = Number((mSesi * counts.murajaahWeeklySessions).toFixed(1));
    const mBulanTotal = Number((mPekanTotal * 4).toFixed(1));

    const formatHal = (n) => (Number.isInteger(n) ? n.toString() : n.toFixed(1));

    if (elZPekan) {
        const lembar = formatHal(Number((zPekanTotal / 2).toFixed(1)));
        const juz = formatHal(Number((zPekanTotal / 20).toFixed(1)));
        elZPekan.value = `${formatHal(zPekanTotal)} Halaman (${lembar} Lembar / ~${juz} Juz / Pekan)`;
    }

    if (elZBulan) {
        const lembar = formatHal(Number((zBulanTotal / 2).toFixed(1)));
        const juz = formatHal(Number((zBulanTotal / 20).toFixed(1)));
        elZBulan.value = `${formatHal(zBulanTotal)} Halaman (${lembar} Lembar / ~${juz} Juz / Bulan)`;
    }

    if (elMPekan) {
        const lembar = formatHal(Number((mPekanTotal / 2).toFixed(1)));
        const juz = formatHal(Number((mPekanTotal / 20).toFixed(1)));
        elMPekan.value = `${formatHal(mPekanTotal)} Halaman (${lembar} Lembar / ~${juz} Juz / Pekan)`;
    }

    if (elMBulan) {
        const lembar = formatHal(Number((mBulanTotal / 2).toFixed(1)));
        const juz = formatHal(Number((mBulanTotal / 20).toFixed(1)));
        elMBulan.value = `${formatHal(mBulanTotal)} Halaman (${lembar} Lembar / ~${juz} Juz / Bulan)`;
    }

    return { zSesi, zPekanTotal, zBulanTotal, mSesi, mPekanTotal, mBulanTotal };
}

/**
 * Quick chip target massal
 */
function setTahfidzBulkTargetChip(type, val) {
    if (type === 'ZIYADAH') {
        const el = document.getElementById('input-bulk-target-ziyadah-sesi');
        if (el) el.value = val;
    } else {
        const el = document.getElementById('input-bulk-target-murajaah-sesi');
        if (el) el.value = val;
    }
    recalculateBulkTargetWeekly();
}

/**
 * Simpan target massal santri
 */
async function submitTahfidzBulkTarget() {
    const studentIds = ASNTahfidz.bulkTargetState?.studentIds || [];
    if (!studentIds || studentIds.length === 0) {
        if (typeof showToast === 'function') {
            showToast("⚠️ Tidak ada santri sasaran yang dipilih.");
        } else {
            if (typeof showToast === "function") showToast("⚠️ Tidak ada santri sasaran yang dipilih."); else alert("Tidak ada santri sasaran yang dipilih.");
        }
        return;
    }

    const { zSesi, zPekanTotal, mSesi, mPekanTotal } = recalculateBulkTargetWeekly();

    const btn = document.getElementById('btn-save-tahfidz-target-bulk');
    setTahfidzButtonLoading(btn, true, "Menerapkan Massal...");

    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(TAHFIDZ_STORAGE_KEYS.adminToken)) || "";
        const response = await apiPost("saveBulkTahfidzTarget", {
            token,
            studentIds,
            targetZiyadahSesi: zSesi,
            targetZiyadahPekan: zPekanTotal,
            targetMurajaahSesi: mSesi,
            targetMurajaahPekan: mPekanTotal
        });

        if (response && (response.success || response.status === "success")) {
            if (typeof showToast === 'function') {
                showToast(`✅ Berhasil menerapkan target untuk ${studentIds.length} santri!`);
            }

            // Update local memory
            const idSet = new Set(studentIds);
            const updateStudentTarget = (st) => {
                if (!st || !idSet.has(st.studentId)) return;
                if (!st.target) st.target = {};
                st.target.ziyadahSesi = zSesi;
                st.target.ziyadahPekan = zPekanTotal;
                st.target.ziyadahBulan = zPekanTotal * 4;
                st.target.murajaahSesi = mSesi;
                st.target.murajaahPekan = mPekanTotal;
                st.target.murajaahBulan = mPekanTotal * 4;
            };

            (ASNTahfidz.data.students || []).forEach(updateStudentTarget);
            (ASNTahfidz.filteredStudents || []).forEach(updateStudentTarget);

            // Re-render tabel instan
            renderTahfidzStudentTable();

            // Clear pilihan & tutup modal
            clearTahfidzSelectedStudents();
            closeTahfidzBulkTargetModal();

            // Sinkronisasi data latar belakang
            loadAdminTahfidzData(true);
        } else {
            if (typeof showToast === 'function') {
                showToast("❌ " + ((response && response.message) || "Gagal menyimpan target massal."));
            }
        }
    } catch (err) {
        console.error("Error submitTahfidzBulkTarget:", err);
        if (typeof showToast === 'function') {
            showToast("❌ Terjadi kesalahan saat menyimpan target: " + (err.message || err));
        }
    } finally {
        setTahfidzButtonLoading(btn, false);
    }
}

// ====================================================================
// 5. MODAL: KELOLA HALAQAH & PLOTTING (Screenshot 2)
// ====================================================================
// 5. MODAL: KELOLA HALAQAH & PLOTTING (4 TAB LENGKAP - SCREENSHOT 1, 3, 4)
// ====================================================================

ASNTahfidz.halaqahActiveTab = 1;
ASNTahfidz.activePlottingHalaqah = null;
ASNTahfidz.activePlottingStudentIds = [];

/**
 * Buka modal kelola halaqah & plotting
 * @param {number} defaultTab Tab awal yang dibuka (1 = Halaqah, 2 = Plotting, 3 = Matriks, 4 = Jadwal Sesi)
 */
function openTahfidzHalaqahModal(defaultTab = 1) {
    const modal = document.getElementById('modal-tahfidz-halaqah');
    if (!modal) return;

    // 1. Sinkronkan Kategori Program dari kolom D (program) tab Students
    const selKat = document.getElementById('input-halaqah-kategori');
    if (selKat) {
        let programs = (ASNTahfidz.data && (ASNTahfidz.data.rawCategories || ASNTahfidz.data.categories)) || [];
        programs = programs.filter(p => p !== 'Semua Kategori' && p !== 'ALL');
        if (programs.length === 0) {
            programs = ["Pesantren Tahfidz Anak", "Tahfidz Dewasa", "Madrasah Diniyah", "Kitab Kuning"];
        }
        const currentKat = selKat.value;
        selKat.innerHTML = programs.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');
        if (currentKat && programs.includes(currentKat)) {
            selKat.value = currentKat;
        }
    }

    // 2. Sinkronkan Dropdown Ustadz Muhafiz Pembina dari Data Pegawai
    if (typeof populateTahfidzMuhafizDropdown === 'function') {
        populateTahfidzMuhafizDropdown();
    } else if (typeof loadAdminEmployeesData === 'function') {
        loadAdminEmployeesData().then(() => {
            if (typeof populateTahfidzMuhafizDropdown === 'function') populateTahfidzMuhafizDropdown();
        });
    }

    modal.classList.remove('hidden');
    switchHalaqahTab(defaultTab || 1);
}

/**
 * Tutup modal kelola halaqah
 */
function closeTahfidzHalaqahModal() {
    const modal = document.getElementById('modal-tahfidz-halaqah');
    if (modal) modal.classList.add('hidden');
}

/**
 * Switch antara 4 tab di modal Kelola Halaqah
 * @param {number} tabNum 1: Kelompok Halaqah, 2: Plotting Santri, 3: Matriks Beban, 4: Jadwal & Sesi
 */
function switchHalaqahTab(tabNum) {
    ASNTahfidz.halaqahActiveTab = tabNum;

    for (let i = 1; i <= 4; i++) {
        const btn = document.getElementById(`tab-btn-hlq-${i}`);
        const panel = document.getElementById(`panel-hlq-tab-${i}`);

        if (i === tabNum) {
            if (btn) {
                btn.className = "px-4 py-2.5 text-xs font-extrabold border-b-2 border-emerald-600 text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 whitespace-nowrap transition";
            }
            if (panel) panel.classList.remove('hidden');
        } else {
            if (btn) {
                btn.className = "px-4 py-2.5 text-xs font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1.5 whitespace-nowrap transition";
            }
            if (panel) panel.classList.add('hidden');
        }
    }

    if (tabNum === 1) {
        renderTahfidzHalaqahCards();
    } else if (tabNum === 2) {
        populatePlottingHalaqahSelector();
    } else if (tabNum === 3) {
        renderTahfidzMatriksBeban();
    } else if (tabNum === 4) {
        renderTahfidzSesiCards();
    }
}

/**
 * Render daftar kartu halaqah aktif (Tab 1)
 */
function renderTahfidzHalaqahCards() {
    const container = document.getElementById('tahfidz-halaqah-cards-container');
    const badgeCount = document.getElementById('tahfidz-halaqah-count-badge');
    if (!container) return;

    const halaqahs = ASNTahfidz.data.halaqahs || [];
    if (badgeCount) badgeCount.innerText = `${halaqahs.length} Halaqah`;

    if (halaqahs.length === 0) {
        container.innerHTML = `
        <div class="col-span-1 sm:col-span-2 text-center py-8 px-4 bg-slate-50 dark:bg-[#1c2836] rounded-2xl border border-dashed border-slate-200 dark:border-[#283a4e] space-y-2">
            <div class="w-10 h-10 mx-auto rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-base">
                <i class="fa-solid fa-users-rectangle"></i>
            </div>
            <p class="text-xs font-bold text-slate-700 dark:text-slate-200">Belum Ada Kelompok Halaqah Aktif</p>
            <p class="text-[10px] text-slate-400 max-w-sm mx-auto">Silakan buat kelompok halaqah baru di atas dan tunjuk Ustadz Muhafiz Pembina untuk mulai memplot santri binaan.</p>
        </div>`;
        return;
    }

    container.innerHTML = halaqahs.map((h, i) => {
        const letter = String.fromCharCode(65 + (i % 26));
        const muhafizName = h.muhafiz || 'Ustadz Pembina';
        const targetKurikulum = h.targetKurikulum || 'Tahfidz 30 Juz';
        const safeDeleteName = escapeHtml(muhafizName).replace(/'/g, "\\'");

        return `
        <div class="p-4 bg-slate-50 dark:bg-[#1c2836] rounded-2xl border border-slate-200 dark:border-[#283a4e] space-y-3 relative group transition hover:border-emerald-500/50">
            <div class="flex justify-between items-start">
                <div class="pr-2">
                    <div class="flex items-center gap-2">
                        <span class="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs font-black shrink-0 shadow-sm">
                            ${letter}
                        </span>
                        <h4 class="font-black text-sm text-slate-800 dark:text-slate-100 leading-tight">
                            ${escapeHtml(muhafizName)}
                        </h4>
                    </div>
                    <span class="inline-block mt-2 px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                        <i class="fa-solid fa-flag text-[9px] mr-1"></i>${escapeHtml(targetKurikulum)}
                    </span>
                </div>
                <div class="flex items-center space-x-1.5 shrink-0">
                    <button type="button" onclick="deleteTahfidzHalaqahConfirm('${h.halaqahId}', '${safeDeleteName}')" class="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300 flex items-center justify-center text-[10px] transition" title="Hapus Halaqah">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
            <div class="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-[#283a4e] text-xs">
                <span class="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <i class="fa-solid fa-users text-emerald-600 text-xs"></i>
                    <span>${h.studentCount || 0} Santri Binaan</span>
                </span>
                <button type="button" onclick="openPlottingFromHalaqahCard('${h.halaqahId}')" class="px-3 py-1 bg-white dark:bg-[#15202d] hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 dark:text-slate-200 font-bold rounded-lg border border-slate-200 dark:border-[#283a4e] text-[10px] transition flex items-center gap-1 shadow-sm">
                    <i class="fa-solid fa-user-plus text-[9px] text-emerald-600"></i>
                    <span>+ Atur Santri</span>
                </button>
            </div>
        </div>
        `;
    }).join('');
}

/**
 * Buka modal plotting santri untuk halaqah tertentu (kompatibilitas modal terpisah & Tab 2)
 */
function openPlottingSantri(halaqahId) {
    const modal = document.getElementById('modal-tahfidz-plotting');
    if (!modal) {
        openPlottingFromHalaqahCard(halaqahId);
        return;
    }

    const halaqahs = ASNTahfidz.data.halaqahs || [];
    const halaqah = halaqahs.find(h => h.halaqahId === halaqahId);

    if (!halaqah) {
        if (typeof showToast === 'function') showToast("⚠️ Data halaqah tidak ditemukan.");
        return;
    }

    ASNTahfidz.activePlottingHalaqah = halaqah;

    // Ambil daftar studentIds yang sudah ada di halaqah ini
    let currentIds = [];
    if (Array.isArray(halaqah.studentIds) && halaqah.studentIds.length > 0) {
        currentIds = [...halaqah.studentIds];
    } else if (Array.isArray(ASNTahfidz.data.students)) {
        currentIds = ASNTahfidz.data.students
            .filter(st => st.halaqah && (st.halaqah.halaqahId === halaqahId || st.halaqah.namaHalaqah === halaqah.namaHalaqah))
            .map(st => st.studentId || st.nis);
    }
    ASNTahfidz.activePlottingStudentIds = currentIds.map(id => String(id).trim()).filter(Boolean);

    // Update Header & Info Halaqah
    const badgeEl = document.getElementById('tahfidz-plotting-badge-halaqah');
    const infoEl = document.getElementById('tahfidz-plotting-halaqah-info');
    const muhEl = document.getElementById('tahfidz-plotting-muhafiz');
    const targetEl = document.getElementById('tahfidz-plotting-target');

    if (badgeEl) badgeEl.innerText = halaqah.muhafiz || halaqah.namaHalaqah || halaqahId;
    if (infoEl) infoEl.innerText = `Atur santri binaan untuk bimbingan ${halaqah.muhafiz || 'Ustadz Pembina'}`;
    if (muhEl) muhEl.innerText = halaqah.muhafiz || 'Belum Ditunjuk';
    if (targetEl) targetEl.innerText = halaqah.targetKurikulum || 'Tahfidz 30 Juz';

    // Reset search & filter
    const searchInp = document.getElementById('tahfidz-plotting-search');
    const filterGen = document.getElementById('tahfidz-plotting-filter-gender');
    if (searchInp) searchInp.value = '';
    if (filterGen) filterGen.value = 'ALL';

    renderTahfidzPlottingLists();
    modal.classList.remove('hidden');
}

/**
 * Tutup modal plotting santri
 */
function closeTahfidzPlottingModal() {
    const modal = document.getElementById('modal-tahfidz-plotting');
    if (modal) modal.classList.add('hidden');
    ASNTahfidz.activePlottingHalaqah = null;
    ASNTahfidz.activePlottingStudentIds = [];
}

/**
 * Tombol "+ Atur Santri" di kartu halaqah Tab 1 diklik:
 * Langsung switch ke Tab 2 dengan halaqah tersebut aktif dipilih
 */
function openPlottingFromHalaqahCard(halaqahId) {
    switchHalaqahTab(2);
    const sel = document.getElementById('select-plotting-halaqah');
    if (sel && halaqahId) {
        sel.value = halaqahId;
    }
    onSelectPlottingHalaqah(halaqahId);
}

/**
 * Mengisi dropdown pilihan halaqah di Tab 2
 */
function populatePlottingHalaqahSelector(preserveHalaqahId) {
    const sel = document.getElementById('select-plotting-halaqah');
    if (!sel) return;

    const halaqahs = ASNTahfidz.data.halaqahs || [];
    if (halaqahs.length === 0) {
        sel.innerHTML = `<option value="">-- Belum Ada Halaqah --</option>`;
        ASNTahfidz.activePlottingHalaqah = null;
        ASNTahfidz.activePlottingStudentIds = [];
        renderTahfidzPlottingLists();
        return;
    }

    const currentVal = sel.value;
    sel.innerHTML = halaqahs.map((h, i) => {
        const letter = String.fromCharCode(65 + (i % 26));
        const muh = h.muhafiz || h.namaHalaqah || 'Ustadz Pembina';
        const tgt = h.targetKurikulum || 'Tahfidz 30 Juz';
        return `<option value="${escapeHtml(h.halaqahId)}">${letter}. ${escapeHtml(muh)} (${escapeHtml(tgt)})</option>`;
    }).join('');

    let targetId = preserveHalaqahId || (ASNTahfidz.activePlottingHalaqah && ASNTahfidz.activePlottingHalaqah.halaqahId) || currentVal;
    if (!targetId || !halaqahs.some(h => String(h.halaqahId).trim() === String(targetId).trim())) {
        targetId = halaqahs[0].halaqahId;
    }
    sel.value = targetId;
    onSelectPlottingHalaqah(targetId);
}

/**
 * Handler saat halaqah di dropdown Tab 2 dipilih
 */
function onSelectPlottingHalaqah(halaqahId) {
    const halaqahs = ASNTahfidz.data.halaqahs || [];
    const halaqah = halaqahs.find(h => String(h.halaqahId).trim() === String(halaqahId).trim()) || halaqahs[0] || null;

    ASNTahfidz.activePlottingHalaqah = halaqah;
    if (!halaqah) {
        ASNTahfidz.activePlottingStudentIds = [];
        renderTahfidzPlottingLists();
        return;
    }

    // Ambil daftar studentIds yang sudah ada di halaqah ini secara akurat
    const idSet = new Set();
    if (Array.isArray(halaqah.studentIds)) {
        halaqah.studentIds.forEach(id => {
            const clean = String(id || '').trim();
            if (clean) idSet.add(clean);
        });
    }

    // Cocokkan santri yang terdata memiliki halaqahId atau namaHalaqah yang persis sama
    if (Array.isArray(ASNTahfidz.data.students)) {
        ASNTahfidz.data.students.forEach(st => {
            const hId = String(st.halaqah?.halaqahId || '').trim().toLowerCase();
            const hName = String(st.halaqah?.namaHalaqah || '').trim().toLowerCase();
            const targetHId = String(halaqah.halaqahId || '').trim().toLowerCase();
            const targetHName = String(halaqah.namaHalaqah || '').trim().toLowerCase();

            const matchHId = Boolean(targetHId && hId && hId === targetHId);
            const matchHName = Boolean(targetHName && hName && hName === targetHName);

            if (matchHId || matchHName) {
                const sId = String(st.studentId || st.nis || st.id || '').trim();
                if (sId) idSet.add(sId);
            }
        });
    }
    ASNTahfidz.activePlottingStudentIds = Array.from(idSet);

    // Update banner halaqah di Tab 2
    const muhEl = document.getElementById('tab2-plotting-muhafiz');
    const targetEl = document.getElementById('tab2-plotting-target');
    if (muhEl) muhEl.innerText = halaqah.muhafiz || 'Belum Ditunjuk';
    if (targetEl) targetEl.innerText = halaqah.targetKurikulum || 'Target Mushaf Pojok Standar';

    renderTahfidzPlottingLists();
}

/**
 * Render daftar santri terplot (enrolled) dan santri yang tersedia (available)
 */
function renderTahfidzPlottingLists() {
    const enrolledContainer = document.getElementById('tab2-plotting-enrolled-container') || document.getElementById('tahfidz-plotting-enrolled-container');
    const availableContainer = document.getElementById('tab2-plotting-available-container') || document.getElementById('tahfidz-plotting-available-container');
    const countBadge = document.getElementById('tab2-plotting-count-badge') || document.getElementById('tahfidz-plotting-count-badge');
    const enrolledCountBadge = document.getElementById('tab2-plotting-enrolled-count') || document.getElementById('tahfidz-plotting-enrolled-count');

    const allStudents = ASNTahfidz.data.students || [];
    const currentEnrolledIds = new Set((ASNTahfidz.activePlottingStudentIds || []).map(s => String(s).trim().toLowerCase()));

    // Pisahkan enrolled vs available (case-insensitive & tangguh terhadap sId, NIS, dan id)
    const enrolledStudents = allStudents.filter(st => {
        const sId = String(st.studentId || "").trim().toLowerCase();
        const sNis = String(st.nis || "").trim().toLowerCase();
        const sIdNum = String(st.id || "").trim().toLowerCase();
        return (sId && currentEnrolledIds.has(sId)) || 
               (sNis && currentEnrolledIds.has(sNis)) ||
               (sIdNum && currentEnrolledIds.has(sIdNum));
    });

    const searchInp = document.getElementById('tab2-plotting-search') || document.getElementById('tahfidz-plotting-search');
    const filterGen = document.getElementById('tab2-plotting-filter-gender') || document.getElementById('tahfidz-plotting-filter-gender');

    const searchQuery = (searchInp?.value || "").toLowerCase().trim();
    const genderFilter = (filterGen?.value || "ALL").toUpperCase();

    const availableStudents = allStudents.filter(st => {
        const sId = String(st.studentId || "").trim().toLowerCase();
        const sNis = String(st.nis || "").trim().toLowerCase();
        const sIdNum = String(st.id || "").trim().toLowerCase();
        const isAlreadyEnrolled = (sId && currentEnrolledIds.has(sId)) || 
                                  (sNis && currentEnrolledIds.has(sNis)) || 
                                  (sIdNum && currentEnrolledIds.has(sIdNum));
        if (isAlreadyEnrolled) return false;

        const matchSearch = !searchQuery ||
            (st.name && st.name.toLowerCase().includes(searchQuery)) ||
            (st.nis && String(st.nis).toLowerCase().includes(searchQuery)) ||
            (st.studentId && String(st.studentId).toLowerCase().includes(searchQuery)) ||
            (st.program && st.program.toLowerCase().includes(searchQuery));

        const matchGender = (genderFilter === 'ALL') || (String(st.gender || 'L').toUpperCase() === genderFilter);

        return matchSearch && matchGender;
    });

    if (countBadge) countBadge.innerText = `${enrolledStudents.length} Santri Terplot`;
    if (enrolledCountBadge) enrolledCountBadge.innerText = enrolledStudents.length;

    // 1. Render Enrolled List
    if (enrolledContainer) {
        if (enrolledStudents.length === 0) {
            enrolledContainer.innerHTML = `
                <div class="py-5 text-center text-xs text-slate-400">
                    <p>Belum ada santri yang dimasukkan ke halaqah ini.</p>
                    <p class="text-[10px] text-slate-400 mt-0.5">Pilih santri dari daftar di bawah lalu klik + Masukkan.</p>
                </div>
            `;
        } else {
            enrolledContainer.innerHTML = enrolledStudents.map(st => {
                const sId = st.studentId || st.nis || st.id;
                const initials = (st.name || "S").substring(0, 2).toUpperCase();
                return `
                <div class="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-[#15202d] border border-slate-200/80 dark:border-[#283a4e] text-xs">
                    <div class="flex items-center space-x-2.5 min-w-0">
                        <div class="w-7 h-7 rounded-lg ${st.gender === 'P' ? 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'} flex items-center justify-center font-bold text-[10px] shrink-0">
                            ${initials}
                        </div>
                        <div class="min-w-0">
                            <h5 class="font-bold text-slate-800 dark:text-slate-100 truncate">${escapeHtml(st.name)}</h5>
                            <p class="text-[10px] text-slate-400">NIS: ${escapeHtml(st.nis || '-')} • ${escapeHtml(st.program || 'Tahfidz')}</p>
                        </div>
                    </div>
                    <button type="button" onclick="removeStudentFromPlotting('${escapeHtml(String(sId))}')" class="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-bold text-[10px] transition shrink-0 flex items-center gap-1 active:scale-95" title="Keluarkan santri dari halaqah ini">
                        <i class="fa-solid fa-user-minus"></i>
                        <span>Keluarkan</span>
                    </button>
                </div>
                `;
            }).join('');
        }
    }

    // 2. Render Available List
    if (availableContainer) {
        if (availableStudents.length === 0) {
            availableContainer.innerHTML = `
                <div class="py-6 text-center text-xs text-slate-400">
                    <p>Semua santri yang cocok sudah dimasukkan ke halaqah ini.</p>
                </div>
            `;
        } else {
            availableContainer.innerHTML = availableStudents.map(st => {
                const sId = st.studentId || st.nis || st.id;
                const initials = (st.name || "S").substring(0, 2).toUpperCase();
                const curHal = st.halaqah && st.halaqah.namaHalaqah ? st.halaqah.namaHalaqah : null;
                return `
                <div class="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-[#15202d] border border-slate-200/80 dark:border-[#283a4e] text-xs hover:border-emerald-300 transition">
                    <div class="flex items-center space-x-2.5 min-w-0">
                        <div class="w-7 h-7 rounded-lg ${st.gender === 'P' ? 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'} flex items-center justify-center font-bold text-[10px] shrink-0">
                            ${initials}
                        </div>
                        <div class="min-w-0">
                            <h5 class="font-bold text-slate-800 dark:text-slate-100 truncate">${escapeHtml(st.name)}</h5>
                            <p class="text-[10px] text-slate-400 truncate">
                                NIS: ${escapeHtml(st.nis || '-')} • ${escapeHtml(st.program || 'Tahfidz')}
                                ${curHal ? ` • <span class="text-amber-600 dark:text-amber-400 font-semibold">(Saat ini: ${escapeHtml(curHal)})</span>` : ''}
                            </p>
                        </div>
                    </div>
                    <button type="button" onclick="addStudentToPlotting('${escapeHtml(String(sId))}')" class="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold text-[10px] transition shrink-0 flex items-center gap-1 active:scale-95" title="Masukkan santri ke halaqah ini">
                        <i class="fa-solid fa-user-plus"></i>
                        <span>+ Masukkan</span>
                    </button>
                </div>
                `;
            }).join('');
        }
    }
}

/**
 * Filter santri yang tersedia saat mengetik pencarian
 */
function filterTahfidzPlottingAvailableList() {
    renderTahfidzPlottingLists();
}

/**
 * Masukkan santri ke list halaqah
 */
function addStudentToPlotting(studentId) {
    const cleanId = String(studentId || "").trim();
    if (!cleanId) return;

    const allStudents = ASNTahfidz.data.students || [];
    const st = allStudents.find(s => 
        String(s.studentId || '').trim().toLowerCase() === cleanId.toLowerCase() ||
        String(s.nis || '').trim().toLowerCase() === cleanId.toLowerCase() ||
        String(s.id || '').trim().toLowerCase() === cleanId.toLowerCase()
    );
    const primaryId = st ? (st.studentId || st.nis || cleanId) : cleanId;

    if (!ASNTahfidz.activePlottingStudentIds.some(id => String(id).trim().toLowerCase() === primaryId.toLowerCase())) {
        ASNTahfidz.activePlottingStudentIds.push(primaryId);
        renderTahfidzPlottingLists();
        if (typeof showToast === 'function') {
            showToast(`➕ ${st?.name || 'Santri'} ditambahkan ke daftar halaqah.`);
        }
    }
}

/**
 * Keluarkan santri dari list halaqah
 * Menghapus seluruh varian ID santri (studentId, nis, id) dari antrean plotting
 */
function removeStudentFromPlotting(studentId) {
    const cleanId = String(studentId || "").trim().toLowerCase();
    if (!cleanId) return;

    const allStudents = ASNTahfidz.data.students || [];
    const st = allStudents.find(s => 
        String(s.studentId || '').trim().toLowerCase() === cleanId ||
        String(s.nis || '').trim().toLowerCase() === cleanId ||
        String(s.id || '').trim().toLowerCase() === cleanId
    );

    // Kumpulkan seluruh ID yang berkaitan dengan santri ini agar tidak ada sisa pencocokan
    const idsToRemove = new Set([cleanId]);
    if (st) {
        if (st.studentId) idsToRemove.add(String(st.studentId).trim().toLowerCase());
        if (st.nis) idsToRemove.add(String(st.nis).trim().toLowerCase());
        if (st.id) idsToRemove.add(String(st.id).trim().toLowerCase());
    }

    ASNTahfidz.activePlottingStudentIds = (ASNTahfidz.activePlottingStudentIds || []).filter(id => {
        const idLower = String(id || '').trim().toLowerCase();
        return !idsToRemove.has(idLower);
    });

    renderTahfidzPlottingLists();
    if (typeof showToast === 'function') {
        showToast(`🗑️ ${st?.name || 'Santri'} dikeluarkan dari halaqah. Klik "Simpan Perubahan" untuk menyimpan.`);
    }
}

/**
 * Simpan Plotting Santri ke Backend
 */
async function submitTahfidzPlotting() {
    if (!ASNTahfidz.activePlottingHalaqah) {
        if (typeof showToast === 'function') showToast("⚠️ Pilih kelompok halaqah terlebih dahulu.");
        return;
    }

    const halaqah = ASNTahfidz.activePlottingHalaqah;
    const halaqahId = halaqah.halaqahId;
    const studentIds = (ASNTahfidz.activePlottingStudentIds || []).map(s => String(s).trim()).filter(Boolean);

    const btnSubmit = document.getElementById('tab2-btn-save-plotting') || 
                      document.getElementById('btn-save-tahfidz-plotting') || 
                      document.querySelector('button[onclick="saveAllHalaqahChanges()"]');
    setTahfidzButtonLoading(btnSubmit, true, "Menyimpan Plotting...");

    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(TAHFIDZ_STORAGE_KEYS.adminToken)) || "";
        const res = await apiPost("saveTahfidzPlotting", {
            token,
            halaqahId: halaqahId,
            studentIds: studentIds
        });

        if (res && (res.success || res.status === "success")) {
            // 1. Update data halaqah aktif di memori
            halaqah.studentIds = [...studentIds];
            halaqah.studentCount = studentIds.length;

            // 2. Update objek halaqah di ASNTahfidz.data.halaqahs
            if (Array.isArray(ASNTahfidz.data.halaqahs)) {
                const targetH = ASNTahfidz.data.halaqahs.find(h => String(h.halaqahId).trim() === String(halaqahId).trim());
                if (targetH) {
                    targetH.studentIds = [...studentIds];
                    targetH.studentCount = studentIds.length;
                }
            }

            // 3. Update status halaqah pada setiap santri di ASNTahfidz.data.students
            const enrolledSet = new Set(studentIds.map(s => s.toLowerCase()));
            if (Array.isArray(ASNTahfidz.data.students)) {
                ASNTahfidz.data.students.forEach(st => {
                    const sId = String(st.studentId || "").trim().toLowerCase();
                    const sNis = String(st.nis || "").trim().toLowerCase();
                    const isNowEnrolled = (sId && enrolledSet.has(sId)) || (sNis && enrolledSet.has(sNis));

                    if (isNowEnrolled) {
                        st.halaqah = {
                            halaqahId: halaqah.halaqahId,
                            namaHalaqah: halaqah.namaHalaqah || ("Halaqah " + (halaqah.muhafiz || "Pembina")),
                            muhafiz: halaqah.muhafiz || "Ustadz Pembina"
                        };
                        st.isInHalaqah = true;
                    } else if (st.halaqah && (String(st.halaqah.halaqahId).trim() === String(halaqahId).trim() || st.halaqah.namaHalaqah === halaqah.namaHalaqah)) {
                        st.halaqah = {
                            halaqahId: "",
                            namaHalaqah: st.program || "Tahfidz",
                            muhafiz: "Pembina Tahfidz"
                        };
                        st.isInHalaqah = false;
                    }
                });
            }

            // 4. Update index pencarian halaqah
            if (typeof buildTahfidzHalaqahIndex === 'function') buildTahfidzHalaqahIndex();

            // 5. Simpan snapshot mutakhir ke storage lokal
            try {
                const cachePayload = JSON.stringify({
                    data: ASNTahfidz.data,
                    timestamp: Date.now()
                });
                localStorage.setItem(TAHFIDZ_CACHE_KEY, cachePayload);
                sessionStorage.setItem(TAHFIDZ_CACHE_KEY, cachePayload);
            } catch (e) {}

            // 6. Tetap pertahankan santri terdaftar dan re-render komponen secara sinkron
            ASNTahfidz.activePlottingStudentIds = [...studentIds];
            renderTahfidzPlottingLists();
            renderTahfidzHalaqahCards();
            renderTahfidzMatriksBeban();

            // 7. Update dropdown selector tanpa mereset activePlottingStudentIds
            const sel = document.getElementById('select-plotting-halaqah');
            if (sel) sel.value = halaqahId;

            if (typeof showToast === 'function') {
                showToast(`✅ Berhasil mengatur ${studentIds.length} santri binaan ke ${halaqah.namaHalaqah || halaqah.muhafiz}!`);
            }

            // 8. Sinkronisasi data di latar belakang
            loadAdminTahfidzData(true);
        } else {
            if (typeof showToast === 'function') {
                showToast("❌ Gagal menyimpan plotting: " + ((res && res.message) || "Terjadi kesalahan"));
            }
        }
    } catch (err) {
        console.error(err);
        if (typeof showToast === 'function') showToast("❌ Terjadi kendala jaringan saat menyimpan plotting.");
    } finally {
        setTahfidzButtonLoading(btnSubmit, false);
    }
}

/**
 * ====================================================================
 * TAB 3: MATRIKS BEBAN USTADZ MUHAFIZ (MATCH SCREENSHOT 3)
 * ====================================================================
 */
function renderTahfidzMatriksBeban() {
    const tbody = document.getElementById('tahfidz-matriks-beban-tbody');
    if (!tbody) return;

    let matrix = ASNTahfidz.data.muhafizMatrix || [];

    // Jika belum ada dari backend, hitung secara dinamis dari halaqah & students
    if (!matrix || matrix.length === 0) {
        const halaqahs = ASNTahfidz.data.halaqahs || [];
        const students = ASNTahfidz.data.students || [];

        matrix = halaqahs.map(h => {
            const enrolled = students.filter(st => st.halaqah && (st.halaqah.halaqahId === h.halaqahId || st.halaqah.namaHalaqah === h.namaHalaqah || st.halaqah.muhafiz === h.muhafiz));
            let totalJuzTuntas = 0;
            enrolled.forEach(st => {
                const jz = Number(st.capaian?.juzAktif || st.progress?.currentJuz || 30);
                const hl = Number(st.capaian?.halamanTerakhir || st.progress?.currentHalaman || 1);
                const prog = getCurriculumProgress(jz, hl);
                totalJuzTuntas += (prog.totalTuntas / 20);
            });
            const avg = enrolled.length > 0 ? (totalJuzTuntas / enrolled.length).toFixed(1) : "0.0";
            return {
                muhafiz: h.muhafiz || 'Ustadz Pembina',
                targetKurikulum: h.targetKurikulum || 'Tahfidz 30 Juz',
                binaanCount: enrolled.length,
                avgCapaian: avg
            };
        });
    }

    if (matrix.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="py-8 text-center text-xs text-slate-400">Belum ada data distribusi beban Ustadz Muhafiz.</td></tr>`;
        return;
    }

    tbody.innerHTML = matrix.map(m => `
        <tr class="hover:bg-slate-50 dark:hover:bg-[#1c2836]/60 transition">
            <td class="py-3 px-4 font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <div class="w-7 h-7 rounded-lg bg-emerald-100/70 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-xs shrink-0">
                    <i class="fa-solid fa-user-tie"></i>
                </div>
                <span class="truncate font-bold">${escapeHtml(m.muhafiz || 'Ustadz Pembina')}</span>
            </td>
            <td class="py-3 px-4">
                <span class="px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                    <i class="fa-solid fa-flag text-[9px] mr-1"></i>${escapeHtml(m.targetKurikulum || 'Tahfidz 30 Juz')}
                </span>
            </td>
            <td class="py-3 px-4 font-bold text-slate-800 dark:text-slate-100">${m.binaanCount || 0} Santri</td>
            <td class="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400">Juz ${m.avgCapaian || '0.0'} / 30</td>
        </tr>
    `).join('');
}

/**
 * ====================================================================
 * TAB 4: JADWAL & SESI WAKTU (MATCH SCREENSHOT 4)
 * ====================================================================
 */

/**
 * Reset form jadwal sesi waktu
 */
function resetTahfidzSesiForm() {
    const idInput = document.getElementById('input-sesi-id');
    const namaInput = document.getElementById('input-sesi-nama');
    const tipeInput = document.getElementById('input-sesi-tipe');
    const statusInput = document.getElementById('input-sesi-status');
    const jamMulaiInput = document.getElementById('input-sesi-jam-mulai');
    const jamSelesaiInput = document.getElementById('input-sesi-jam-selesai');
    const btnText = document.getElementById('btn-submit-sesi-text');
    const btnIcon = document.getElementById('btn-submit-sesi-icon');
    const btnCancel = document.getElementById('btn-cancel-sesi');

    if (idInput) idInput.value = '';
    if (namaInput) namaInput.value = '';
    if (tipeInput) tipeInput.value = 'Ziyadah (Setoran Hafalan Baru)';
    if (statusInput) statusInput.value = 'Aktif Digunakan';
    if (jamMulaiInput) jamMulaiInput.value = '05:15';
    if (jamSelesaiInput) jamSelesaiInput.value = '06:30';
    if (btnText) btnText.innerText = "Simpan Sesi";
    if (btnIcon) btnIcon.className = "fa-solid fa-plus text-[10px]";
    if (btnCancel) btnCancel.classList.add('hidden');

    document.querySelectorAll('input[name="sesi-hari"]').forEach(chk => {
        chk.checked = ['Sen', 'Sel', 'Rab', 'Kam', 'Sab', 'Min'].includes(chk.value);
    });
}

/**
 * Render daftar kartu sesi waktu aktif (Daftar Jadwal Sesi Waktu Aktif Tenant)
 */
function renderTahfidzSesiCards() {
    const container = document.getElementById('tahfidz-sesi-cards-container');
    const badgeCount = document.getElementById('tahfidz-sesi-count-badge');
    if (!container) return;

    let sesiList = ASNTahfidz.data.sesiList || [];

    // Default sesi jika belum ada di database
    if (!sesiList || sesiList.length === 0) {
        sesiList = [
            { sesiId: "SESI-01", id: "SESI-01", namaSesi: "Pagi (Ba'da Subuh)", nama: "Pagi (Ba'da Subuh)", jenisSesi: "Muroja'ah (Pengulangan)", jenis: "Muroja'ah (Pengulangan)", jamMulai: "05:00", jamSelesai: "06:00", hariList: ["Sen", "Rab", "Kam", "Sab", "Min"], hari: ["Sen", "Rab", "Kam", "Sab", "Min"], status: "Aktif Digunakan" },
            { sesiId: "SESI-02", id: "SESI-02", namaSesi: "Pagi (MA Tahfidz)", nama: "Pagi (MA Tahfidz)", jenisSesi: "Ziyadah (Setoran Hafalan Baru)", jenis: "Ziyadah (Setoran Hafalan Baru)", jamMulai: "08:30", jamSelesai: "09:30", hariList: ["Sen", "Sel", "Rab", "Kam", "Sab"], hari: ["Sen", "Sel", "Rab", "Kam", "Sab"], status: "Aktif Digunakan" },
            { sesiId: "SESI-03", id: "SESI-03", namaSesi: "Sore (Ba'da Ashar)", nama: "Sore (Ba'da Ashar)", jenisSesi: "Ziyadah (Setoran Hafalan Baru)", jenis: "Ziyadah (Setoran Hafalan Baru)", jamMulai: "16:00", jamSelesai: "17:15", hariList: ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab"], hari: ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab"], status: "Aktif Digunakan" },
            { sesiId: "SESI-04", id: "SESI-04", namaSesi: "Malam (Ba'da Maghrib / Isya)", nama: "Malam (Ba'da Maghrib / Isya)", jenisSesi: "Muroja'ah & Tasmi'", jenis: "Muroja'ah & Tasmi'", jamMulai: "18:45", jamSelesai: "20:30", hariList: ["Sen", "Sel", "Rab", "Kam", "Min"], hari: ["Sen", "Sel", "Rab", "Kam", "Min"], status: "Aktif Digunakan" }
        ];
    }

    const activeCount = sesiList.filter(s => (s.status || '').includes('Aktif')).length;
    if (badgeCount) badgeCount.innerText = `${activeCount} Sesi Aktif (${sesiList.length} Total)`;

    container.innerHTML = sesiList.map((s, idx) => {
        const id = s.sesiId || s.id || `SESI-0${idx + 1}`;
        const nama = s.namaSesi || s.nama || 'Sesi';
        const jenis = s.jenisSesi || s.jenis || 'Ziyadah';
        const isAktif = (s.status || '').includes('Aktif');
        const rawHari = s.hariList || s.hari || [];
        const hariList = Array.isArray(rawHari) ? rawHari : String(rawHari).split(',').map(h => h.trim()).filter(Boolean);
        const hariStr = hariList.join(', ');
        const iconSesi = jenis.includes('Ziyadah') ? 'fa-book-open text-emerald-600' : (jenis.includes('Muroja') ? 'fa-clock-rotate-left text-amber-600' : 'fa-certificate text-purple-600');

        return `
        <div class="p-3.5 bg-slate-50 dark:bg-[#1c2836] rounded-2xl border border-slate-200 dark:border-[#283a4e] space-y-2 relative group">
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2">
                    <span class="px-2 py-0.5 rounded text-[9px] font-extrabold bg-white dark:bg-[#15202d] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#283a4e]">
                        SESI 0${idx + 1}
                    </span>
                    <h5 class="font-black text-xs text-slate-800 dark:text-slate-100 truncate">${escapeHtml(nama)}</h5>
                </div>
                <div class="flex items-center space-x-1.5">
                    <span class="px-2 py-0.5 rounded-full text-[9px] font-extrabold ${isAktif ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-200 text-slate-600'}">
                        ${isAktif ? 'Aktif' : 'Nonaktif'}
                    </span>
                    <button type="button" onclick="editTahfidzSesi('${escapeHtml(id)}')" class="w-6 h-6 rounded-lg bg-white dark:bg-[#15202d] hover:bg-slate-100 text-slate-500 hover:text-emerald-600 flex items-center justify-center text-[10px] shadow-sm transition" title="Edit Sesi">
                        <i class="fa-solid fa-pencil"></i>
                    </button>
                    <button type="button" onclick="deleteTahfidzSesiConfirm('${escapeHtml(id)}', '${escapeHtml(nama)}')" class="w-6 h-6 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300 flex items-center justify-center text-[10px] transition" title="Hapus Sesi">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
            <div class="text-[11px] text-slate-600 dark:text-slate-300 flex items-center space-x-2">
                <i class="fa-solid ${iconSesi}"></i>
                <span class="font-bold">${cleanSesiTime(s.jamMulai, '05:00')} - ${cleanSesiTime(s.jamSelesai, '06:00')} WIB</span>
                <span class="text-slate-400">•</span>
                <span class="text-slate-500 dark:text-slate-400 font-semibold truncate">${escapeHtml(jenis)}</span>
            </div>
            <div class="pt-1.5 border-t border-slate-200/60 dark:border-[#283a4e] text-[10px] text-slate-400 flex items-center gap-1.5">
                <span class="font-bold text-slate-600 dark:text-slate-300">Hari:</span>
                <span class="truncate">${escapeHtml(hariStr || 'Setiap Hari')}</span>
            </div>
        </div>
        `;
    }).join('');
}

/**
 * Submit form tambah / edit jadwal sesi baru
 */
async function submitTahfidzSesi(e) {
    if (e) e.preventDefault();

    const idInput = document.getElementById('input-sesi-id');
    const namaInput = document.getElementById('input-sesi-nama');
    const tipeInput = document.getElementById('input-sesi-tipe');
    const statusInput = document.getElementById('input-sesi-status');
    const jamMulaiInput = document.getElementById('input-sesi-jam-mulai');
    const jamSelesaiInput = document.getElementById('input-sesi-jam-selesai');

    const nama = namaInput?.value.trim() || '';
    if (!nama) {
        if (typeof showToast === 'function') showToast("⚠️ Nama sesi wajib diisi.");
        return;
    }

    const selectedHari = [];
    document.querySelectorAll('input[name="sesi-hari"]:checked').forEach(chk => {
        selectedHari.push(chk.value);
    });

    const isEdit = Boolean(idInput && idInput.value);
    const existingId = idInput?.value || '';

    const payload = {
        sesiId: existingId,
        id: existingId,
        namaSesi: nama,
        nama: nama,
        jenisSesi: tipeInput ? tipeInput.value : 'Ziyadah (Setoran Hafalan Baru)',
        jenis: tipeInput ? tipeInput.value : 'Ziyadah (Setoran Hafalan Baru)',
        status: statusInput ? statusInput.value : 'Aktif Digunakan',
        jamMulai: jamMulaiInput ? jamMulaiInput.value : '05:15',
        jamSelesai: jamSelesaiInput ? jamSelesaiInput.value : '06:30',
        hariList: selectedHari,
        hari: selectedHari
    };

    const btn = document.getElementById('btn-submit-sesi');
    setTahfidzButtonLoading(btn, true, isEdit ? "Memperbarui Sesi..." : "Menyimpan Sesi...");

    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(TAHFIDZ_STORAGE_KEYS.adminToken)) || "";
        const res = await apiPost("saveTahfidzSesi", { token, sesi: payload, data: payload, ...payload });

        if (res && (res.success || res.status === "success")) {
            if (typeof showToast === 'function') showToast(isEdit ? "✅ Jadwal sesi berhasil diperbarui!" : "✅ Jadwal sesi baru berhasil disimpan!");
            
            // Optimistically update local state
            if (!ASNTahfidz.data.sesiList) ASNTahfidz.data.sesiList = [];
            const savedId = res.sesiId || payload.sesiId || ("SESI-" + Date.now());
            payload.sesiId = savedId;
            payload.id = savedId;

            const idx = ASNTahfidz.data.sesiList.findIndex(s => (s.sesiId || s.id) === savedId);
            if (idx >= 0) {
                ASNTahfidz.data.sesiList[idx] = payload;
            } else {
                ASNTahfidz.data.sesiList.push(payload);
            }

            resetTahfidzSesiForm();
            renderTahfidzSesiCards();
            populateTahfidzCatatSesiDropdown();
            loadAdminTahfidzData(true);
        } else {
            if (typeof showToast === 'function') showToast("❌ Gagal menyimpan sesi: " + ((res && res.message) || "Terjadi kesalahan"));
        }
    } catch (err) {
        console.error(err);
        if (typeof showToast === 'function') showToast("❌ Terjadi kendala saat menyimpan jadwal sesi: " + (err.message || err));
    } finally {
        setTahfidzButtonLoading(btn, false);
    }
}

/**
 * Edit jadwal sesi waktu (mengisi form)
 */
function editTahfidzSesi(sesiId) {
    const sesiList = ASNTahfidz.data.sesiList || [];
    const sesi = sesiList.find(s => (s.sesiId || s.id) === sesiId);
    if (!sesi) {
        if (typeof showToast === 'function') showToast("⚠️ Data sesi tidak ditemukan.");
        return;
    }

    const idInput = document.getElementById('input-sesi-id');
    const namaInput = document.getElementById('input-sesi-nama');
    const tipeInput = document.getElementById('input-sesi-tipe');
    const statusInput = document.getElementById('input-sesi-status');
    const jamMulaiInput = document.getElementById('input-sesi-jam-mulai');
    const jamSelesaiInput = document.getElementById('input-sesi-jam-selesai');
    const btnText = document.getElementById('btn-submit-sesi-text');
    const btnIcon = document.getElementById('btn-submit-sesi-icon');
    const btnCancel = document.getElementById('btn-cancel-sesi');

    const id = sesi.sesiId || sesi.id || '';
    const nama = sesi.namaSesi || sesi.nama || '';
    const jenis = sesi.jenisSesi || sesi.jenis || '';
    const status = sesi.status || 'Aktif Digunakan';
    const jamMulai = cleanSesiTime(sesi.jamMulai, '05:15');
    const jamSelesai = cleanSesiTime(sesi.jamSelesai, '06:30');

    if (idInput) idInput.value = id;
    if (namaInput) namaInput.value = nama;
    if (tipeInput && jenis) tipeInput.value = jenis;
    if (statusInput && status) statusInput.value = status;
    if (jamMulaiInput && jamMulai) jamMulaiInput.value = jamMulai;
    if (jamSelesaiInput && jamSelesai) jamSelesaiInput.value = jamSelesai;
    if (btnText) btnText.innerText = "Update Sesi";
    if (btnIcon) btnIcon.className = "fa-solid fa-pen-to-square text-[10px]";
    if (btnCancel) btnCancel.classList.remove('hidden');

    const rawHari = sesi.hariList || sesi.hari || [];
    const hariList = Array.isArray(rawHari) ? rawHari : String(rawHari).split(',').map(h => h.trim());
    document.querySelectorAll('input[name="sesi-hari"]').forEach(chk => {
        chk.checked = hariList.includes(chk.value);
    });

    // Scroll form into view
    document.getElementById('form-tahfidz-sesi')?.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Hapus jadwal sesi waktu
 */
async function deleteTahfidzSesiConfirm(sesiId, namaSesi) {
    if (!confirm(`Hapus jadwal sesi "${namaSesi || sesiId}"?`)) return;

    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(TAHFIDZ_STORAGE_KEYS.adminToken)) || "";
        const res = await apiPost("deleteTahfidzSesi", { token, sesiId, id: sesiId });

        if (res && (res.success || res.status === "success")) {
            if (typeof showToast === 'function') showToast("🗑️ Jadwal sesi berhasil dihapus.");
            if (ASNTahfidz.data.sesiList) {
                ASNTahfidz.data.sesiList = ASNTahfidz.data.sesiList.filter(s => (s.sesiId || s.id) !== sesiId);
            }
            resetTahfidzSesiForm();
            renderTahfidzSesiCards();
            populateTahfidzCatatSesiDropdown();
            loadAdminTahfidzData(true);
        } else {
            if (typeof showToast === 'function') showToast("❌ Gagal menghapus sesi: " + ((res && res.message) || "Terjadi kesalahan"));
        }
    } catch (err) {
        console.error(err);
        if (typeof showToast === 'function') showToast("❌ Terjadi kendala saat menghapus sesi.");
    }
}

/**
 * Simpan semua perubahan di footer modal halaqah
 */
async function saveAllHalaqahChanges() {
    const activeTab = ASNTahfidz.halaqahActiveTab || 1;
    if (activeTab === 2) {
        // Jika sedang berada di Tab 2 (Plotting Santri), simpan plotting santri ke database
        await submitTahfidzPlotting();
        closeTahfidzHalaqahModal();
        return;
    }

    if (typeof showToast === 'function') showToast("⏳ Menyimpan seluruh perubahan & menyinkronkan data...");
    await loadAdminTahfidzData(true);
    if (typeof showToast === 'function') showToast("✅ Data halaqah, plotting & sesi berhasil disinkronkan.");
    closeTahfidzHalaqahModal();
}

/**
 * Konfirmasi & Hapus Kelompok Halaqah
 */
async function deleteTahfidzHalaqahConfirm(halaqahId, muhafizName) {
    if (!halaqahId) return;
    if (!confirm(`Hapus kelompok halaqah pembinaan "${muhafizName || halaqahId}"? Santri yang terplotting akan dilepas dari halaqah ini.`)) {
        return;
    }

    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(TAHFIDZ_STORAGE_KEYS.adminToken)) || "";
        const res = await apiPost("deleteTahfidzHalaqah", { halaqahId, token });

        if (res && (res.success || res.status === "success")) {
            if (typeof showToast === 'function') showToast("🗑️ Halaqah berhasil dihapus!");
            if (ASNTahfidz.data.halaqahs) {
                ASNTahfidz.data.halaqahs = ASNTahfidz.data.halaqahs.filter(h => h.halaqahId !== halaqahId);
            }
            try {
                sessionStorage.setItem(TAHFIDZ_CACHE_KEY, JSON.stringify({
                    data: ASNTahfidz.data,
                    timestamp: Date.now()
                }));
            } catch (e) {
                console.warn("Gagal simpan cache:", e);
            }

            renderTahfidzHalaqahCards();
            populatePlottingHalaqahSelector();
            renderTahfidzMatriksBeban();
            populateTahfidzFilters();

            await loadAdminTahfidzData(true);
            renderTahfidzHalaqahCards();
            populatePlottingHalaqahSelector();
            renderTahfidzMatriksBeban();
            populateTahfidzFilters();
        } else {
            if (typeof showToast === 'function') showToast("❌ Gagal menghapus halaqah: " + ((res && res.message) || "Terjadi kesalahan"));
        }
    } catch (err) {
        console.error(err);
        if (typeof showToast === 'function') showToast("❌ Terjadi kesalahan saat menghapus halaqah.");
    }
}

/**
 * Tambah halaqah baru (Tab 1)
 */
async function submitNewHalaqah(e) {
    if (e) e.preventDefault();

    const muh = (document.getElementById('input-halaqah-muhafiz')?.value || '').trim();
    const target = (document.getElementById('input-halaqah-target')?.value || '').trim() || "Tahfidz 30 Juz";

    if (!muh) {
        if (typeof showToast === 'function') showToast("⚠️ Silakan pilih Ustadz Muhafiz Pembina terlebih dahulu.");
        return;
    }

    const btn = document.getElementById('btn-submit-tahfidz-halaqah');
    setTahfidzButtonLoading(btn, true, "Menyimpan Halaqah...");

    try {
        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(TAHFIDZ_STORAGE_KEYS.adminToken)) || "";
        const res = await apiPost("saveTahfidzHalaqah", {
            token,
            muhafiz: muh,
            targetKurikulum: target
        });

        if (res && (res.success || res.status === "success")) {
            if (typeof showToast === 'function') showToast("✅ Kelompok halaqah berhasil dibuat!");
            if (document.getElementById('input-halaqah-muhafiz')) document.getElementById('input-halaqah-muhafiz').value = '';
            if (document.getElementById('input-halaqah-target')) document.getElementById('input-halaqah-target').value = '';
            
            const newHalaqah = {
                halaqahId: res.halaqahId || ("HLQ-" + Date.now()),
                muhafiz: muh,
                namaHalaqah: "Halaqah " + muh,
                targetKurikulum: target,
                studentCount: 0,
                studentIds: []
            };

            // Tambahkan halaqah lokal ke state
            if (!ASNTahfidz.data.halaqahs) ASNTahfidz.data.halaqahs = [];
            const existingIdx = ASNTahfidz.data.halaqahs.findIndex(h => h.halaqahId === newHalaqah.halaqahId);
            if (existingIdx !== -1) {
                ASNTahfidz.data.halaqahs[existingIdx] = newHalaqah;
            } else {
                ASNTahfidz.data.halaqahs.push(newHalaqah);
            }

            // Segera sinkronkan cache browser agar state baru tidak hilang
            try {
                sessionStorage.setItem(TAHFIDZ_CACHE_KEY, JSON.stringify({
                    data: ASNTahfidz.data,
                    timestamp: Date.now()
                }));
            } catch (e) {
                console.warn("Gagal simpan cache:", e);
            }

            // Segera render tampilan kartu, selector plotting, matriks dan dropdown filter dashboard
            renderTahfidzHalaqahCards();
            populatePlottingHalaqahSelector();
            renderTahfidzMatriksBeban();
            populateTahfidzFilters();

            // Sinkronisasi data di latar belakang
            await loadAdminTahfidzData(true);

            // Re-render sekali lagi untuk memastikan keselarasan data server
            renderTahfidzHalaqahCards();
            populatePlottingHalaqahSelector();
            renderTahfidzMatriksBeban();
            populateTahfidzFilters();

            // Transisi cerdas: Otomatis alihkan ke Tab 2 (Plotting Santri) dengan halaqah baru aktif
            if (typeof openPlottingFromHalaqahCard === 'function') {
                openPlottingFromHalaqahCard(newHalaqah.halaqahId);
            }
            if (typeof showToast === 'function') {
                showToast(`✅ Halaqah ${newHalaqah.namaHalaqah} berhasil dibuat! Mengalihkan ke plotting santri...`);
            }
        } else {
            if (typeof showToast === 'function') showToast("❌ Gagal membuat halaqah: " + ((res && res.message) || "Terjadi kesalahan"));
        }
    } catch (err) {
        console.error(err);
        if (typeof showToast === 'function') showToast("❌ Gagal menghubungi server.");
    } finally {
        setTahfidzButtonLoading(btn, false);
    }
}

// ====================================================================
// 6. EXPORT & PRINT
// ====================================================================

/**
 * Cetak Rapor Mutaba'ah Santri Perorangan
 */
function printTahfidzStudentCard(studentId) {
    openTahfidzStudentDetail(studentId);
    setTimeout(() => {
        window.print();
    }, 500);
}

/**
 * Cetak Rekapitulasi Tahfidz Pesantren
 */
function printTahfidzRekap() {
    window.print();
}

/**
 * Ekspor Data Mutaba'ah ke CSV
 */
/**
 * Ekspor Data Mutaba'ah ke Excel (.xlsx) menggunakan SheetJS
 */
function exportTahfidzDataXLSX() {
    const students = ASNTahfidz.filteredStudents || (ASNTahfidz.data && ASNTahfidz.data.students) || [];
    if (students.length === 0) {
        if (typeof showToast === 'function') showToast("⚠️ Tidak ada data untuk diekspor.");
        return;
    }

    const doExport = () => {
        try {
            // 1. Siapkan header dan baris data
            const headers = [
                "No", "NIS", "Nama Santri", "Gender", "Program / Kelas",
                "Kelompok Halaqah", "Muhafiz Pembina", "Capaian (Juz)",
                "Persentase Capaian", "Target Ziyadah / Sesi", "Target Ziyadah / Pekan",
                "Target Muraja'ah / Sesi", "Target Muraja'ah / Pekan",
                "Setoran Terakhir", "Nilai Terakhir", "Status Kelulusan", "Status On-Track"
            ];

            const rows = students.map((st, idx) => [
                idx + 1,
                st.nis || "-",
                st.name || "-",
                st.gender === "P" ? "Perempuan" : "Laki-laki",
                st.program || "Tahfidz",
                st.halaqah?.namaHalaqah || "-",
                st.halaqah?.muhafiz || "-",
                st.progress?.currentJuz || 1,
                `${st.progress?.percent || 0}%`,
                st.target?.ziyadahSesi || 1,
                st.target?.ziyadahPekan || 10,
                st.target?.murajaahSesi || 2,
                st.target?.murajaahPekan || 10,
                st.setoranTerakhir ? `${st.setoranTerakhir.surah || ''} (${st.setoranTerakhir.tanggal || ''})` : "Belum Setor",
                st.setoranTerakhir?.nilai || "-",
                st.setoranTerakhir?.statusSetoran === 'ULANG' ? "Wajib Mengulang (I'adah)" : (st.setoranTerakhir ? "Lulus / Lanjut" : "-"),
                st.progress?.onTrackStatus || "-"
            ]);

            const wsData = [headers, ...rows];
            const ws = XLSX.utils.aoa_to_sheet(wsData);

            // 2. Tentukan lebar kolom ideal agar terbaca rapi di Microsoft Excel
            ws['!cols'] = [
                { wch: 5 },  // No
                { wch: 14 }, // NIS
                { wch: 28 }, // Nama Santri
                { wch: 14 }, // Gender
                { wch: 22 }, // Program
                { wch: 24 }, // Halaqah
                { wch: 24 }, // Muhafiz
                { wch: 14 }, // Capaian Juz
                { wch: 18 }, // Persentase
                { wch: 20 }, // Target Ziyadah / Sesi
                { wch: 20 }, // Target Ziyadah / Pekan
                { wch: 22 }, // Target Murajaah / Sesi
                { wch: 22 }, // Target Murajaah / Pekan
                { wch: 28 }, // Setoran Terakhir
                { wch: 14 }, // Nilai Terakhir
                { wch: 26 }, // Status Kelulusan (I'adah)
                { wch: 22 }  // Status On-Track
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Rekap Capaian Tahfidz");

            const dateStr = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `Rekap_Tahfidz_PPTQ_Mubarokah_${dateStr}.xlsx`);
            if (typeof showToast === 'function') showToast("📥 Rekap Tahfidz (.xlsx) berhasil diunduh!");
        } catch (err) {
            console.error("Gagal export XLSX:", err);
            exportTahfidzDataCSVFallback();
        }
    };

    if (typeof XLSX !== 'undefined') {
        doExport();
    } else {
        // Load SheetJS secara on-demand jika belum terpasang
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
        script.onload = () => doExport();
        script.onerror = () => {
            console.warn("Gagal memuat SheetJS CDN, beralih ke format CSV...");
            exportTahfidzDataCSVFallback();
        };
        document.head.appendChild(script);
    }
}

/**
 * Fallback Ekspor CSV jika library Excel offline
 */
function exportTahfidzDataCSVFallback() {
    const students = ASNTahfidz.filteredStudents || (ASNTahfidz.data && ASNTahfidz.data.students) || [];
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "NIS,Nama Santri,Gender,Program,Halaqah,Capaian Juz,Persentase,Target Ziyadah Harian,Target Ziyadah Pekan,Status Mutabaah,Status On-Track\n";

    students.forEach(st => {
        const row = [
            `"${st.nis || ''}"`,
            `"${st.name || ''}"`,
            `"${st.gender || 'L'}"`,
            `"${st.program || ''}"`,
            `"${st.halaqah?.namaHalaqah || ''}"`,
            `"${st.progress?.currentJuz || 1}"`,
            `"${st.progress?.percent || 0}%"`,
            `"${st.target?.ziyadahSesi || 1}"`,
            `"${st.target?.ziyadahPekan || 10}"`,
            `"${st.setoranTerakhir?.statusSetoran === 'ULANG' ? 'Wajib Mengulang' : 'Lanjut'}"`,
            `"${st.progress?.onTrackStatus || ''}"`
        ].join(",");
        csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Rekap_Tahfidz_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (typeof showToast === 'function') showToast("📥 Rekap Tahfidz (.csv) berhasil diunduh.");
}

// Alias untuk kompatibilitas
function exportTahfidzDataCSV() {
    exportTahfidzDataXLSX();
}

// ====================================================================
// 7. INTEGRASI WALI SANTRI & PENGASUH
// ====================================================================

/**
 * Buka Pantauan Lengkap Tahfidz untuk Pengasuh
 */
function openTahfidzPengasuhView() {
    ASNTahfidz.viewerRole = 'pengasuh';
    if (typeof loadAdminTahfidzData === 'function') {
        loadAdminTahfidzData();
    }
    if (typeof switchTab === 'function') {
        switchTab('admin', false);
    }
    if (typeof showAdminView === 'function') {
        showAdminView('tahfidz');
    }

    // Sembunyikan kontrol administratif harian agar tampilan Pengasuh fokus pada evaluasi mutu
    setTimeout(() => {
        document.querySelectorAll('.tahfidz-admin-action').forEach(el => {
            el.style.display = 'none';
        });
    }, 150);
}

/**
 * Inisialisasi Tab Sheet Database Tahfidz di Google Spreadsheet
 */
async function triggerInitTahfidzSheets() {
    const ok = confirm("Inisialisasi Database Tahfidz di Google Spreadsheet?\n\nSistem akan membuat 5 tab sheet resmi secara otomatis jika belum ada:\n1. Tahfidz_Logs (Riwayat Setoran)\n2. Tahfidz_Capaian (Snapshot Posisi Capaian Santri)\n3. Tahfidz_Target (Target Individual Santri)\n4. Tahfidz_Halaqah (Kelompok Halaqah)\n5. Tahfidz_Jadwal_Sesi (Jadwal Sesi Waktu Aktif)\n\nLanjutkan?");
    if (!ok) return;

    try {
        if (typeof showToast === 'function') {
            showToast("⏳ Menghubungi Spreadsheet untuk membuat tab sheet...");
        }

        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : sessionStorage.getItem(TAHFIDZ_STORAGE_KEYS.adminToken)) || "";
        const res = await apiPost("initTahfidzSheets", { token });

        if (res && (res.success || res.status === "success")) {
            const msg = res.message || "Tab sheet Tahfidz berhasil dibuat di Spreadsheet!";
            if (typeof showToast === 'function') {
                showToast("✅ " + msg);
            }
            if (typeof showToast === "function") showToast("✅ " + msg); else alert(msg);
            loadAdminTahfidzData();
        } else {
            if (typeof showToast === "function") showToast("⚠️ " + ((res && res.message) || "Gagal membuat tab sheet.")); else alert((res && res.message) || "Gagal membuat tab sheet.");
        }
    } catch (err) {
        console.error("Error triggerInitTahfidzSheets:", err);
        if (typeof showToast === "function") showToast("❌ Terjadi kendala koneksi: " + err.message); else alert("Terjadi kendala koneksi: " + err.message);
    }
}

/**
 * ====================================================================
 * MANAJEMEN PRESENSI CEPAT HALAQAH & PENGECUALIAN TARGET
 * ====================================================================
 */
ASNTahfidz.presensiState = {
    activeHalaqahId: '',
    date: new Date().toISOString().split('T')[0],
    sesi: "Pagi (Ba'da Subuh)",
    records: {},
    query: ''
};

function getStudentsForPresensiHalaqah(halaqahIdOrName) {
    const all = ASNTahfidz.data?.students || [];
    if (!halaqahIdOrName || halaqahIdOrName === 'ALL') {
        return all.filter(st => isStudentInHalaqah(st));
    }

    const halList = ASNTahfidz.data?.halaqahs || [];
    const clean = String(halaqahIdOrName).trim().toLowerCase();

    // Temukan objek master halaqah untuk mendapatkan ID dan Nama resminya
    const refHal = halList.find(h => 
        h && (
            String(h.halaqahId || '').trim().toLowerCase() === clean ||
            String(h.namaHalaqah || '').trim().toLowerCase() === clean
        )
    );

    const targetId = refHal ? String(refHal.halaqahId || '').trim().toLowerCase() : clean;
    const targetName = refHal ? String(refHal.namaHalaqah || '').trim().toLowerCase() : clean;

    return all.filter(st => {
        if (!st || !isStudentInHalaqah(st)) return false;
        const sHId = String(st.halaqahId || (st.halaqah && (st.halaqah.halaqahId || st.halaqah.id)) || '').trim().toLowerCase();
        const sHName = String(st.halaqahName || (st.halaqah && (st.halaqah.namaHalaqah || st.halaqah.name)) || (typeof st.halaqah === 'string' ? st.halaqah : '')).trim().toLowerCase();

        // 1. Cocokkan ID atau Nama Halaqah
        if (targetId && sHId === targetId) return true;
        if (targetName && sHName === targetName) return true;
        if (clean && (sHId === clean || sHName === clean)) return true;

        // 2. Cek apakah studentId/nis terdaftar di halaqah referensi
        if (refHal && Array.isArray(refHal.studentIds)) {
            const sid = String(st.studentId || st.nis || '').trim();
            if (sid && (refHal.studentIds.includes(sid) || refHal.studentIds.includes(String(st.nis || '').trim()))) {
                return true;
            }
        }

        return false;
    });
}

function openTahfidzPresensiModal(optionalHalaqahId = null) {
    const modal = document.getElementById('modal-tahfidz-presensi');
    if (!modal) {
        console.error('Modal presensi tahfidz (#modal-tahfidz-presensi) tidak ditemukan di DOM');
        return;
    }

    // Pastikan modal langsung tampil di layar secara absolut
    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    // 0. Sinkronisasi instan dari cache lokal jika memory state belum siap
    if (!ASNTahfidz.data || !Array.isArray(ASNTahfidz.data.students) || ASNTahfidz.data.students.length === 0) {
        try {
            const stored = localStorage.getItem(TAHFIDZ_CACHE_KEY) || sessionStorage.getItem(TAHFIDZ_CACHE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                const cachedData = parsed.data || parsed;
                if (cachedData && Array.isArray(cachedData.students) && cachedData.students.length > 0) {
                    ASNTahfidz.data = cachedData;
                    ASNTahfidz.cache = cachedData;
                    if (typeof buildTahfidzHalaqahIndex === 'function') buildTahfidzHalaqahIndex();
                }
            }
        } catch (e) {
            console.warn("Gagal membaca cache Tahfidz saat membuka presensi:", e);
        }
    }

    // Jika data masih benar-benar kosong (misal login pertama kali), tampilkan loader elegan di dalam modal
    const presensiListContainer = document.getElementById('tahfidz-presensi-list');
    if ((!ASNTahfidz.data || !Array.isArray(ASNTahfidz.data.students) || ASNTahfidz.data.students.length === 0)) {
        if (presensiListContainer) {
            presensiListContainer.innerHTML = `
                <div class="py-12 text-center text-slate-500 space-y-2">
                    <i class="fa-solid fa-spinner fa-spin text-3xl text-emerald-600 mb-2"></i>
                    <p class="font-bold text-sm text-slate-700 dark:text-slate-200">Memuat Data Halaqah & Santri...</p>
                    <p class="text-xs text-slate-400">Sedang mengambil daftar halaqah terkini dari server</p>
                </div>
            `;
        }
        if (typeof loadAdminTahfidzData === 'function') {
            loadAdminTahfidzData().then(() => {
                if (modal && !modal.classList.contains('hidden')) {
                    openTahfidzPresensiModal(optionalHalaqahId);
                }
            });
        }
        return;
    }

    try {
        const halList = ASNTahfidz.data?.halaqahs || [];
        const dashboardVal = document.getElementById('tahfidz-filter-halaqah')?.value;

        // 1. Tentukan target halaqah: sinkron otomatis dengan filter yang sedang aktif di Dashboard Mutaba'ah
        let targetHalaqah = optionalHalaqahId;
        if (!targetHalaqah) {
            if (dashboardVal && dashboardVal !== 'ALL' && dashboardVal !== 'UNASSIGNED') {
                targetHalaqah = dashboardVal;
            } else {
                const asatidzHal = typeof getHalaqahForActiveAsatidz === 'function' ? getHalaqahForActiveAsatidz() : null;
                if (asatidzHal) {
                    targetHalaqah = asatidzHal.halaqahId || asatidzHal.namaHalaqah;
                } else if (halList.length > 0) {
                    targetHalaqah = halList[0].halaqahId || halList[0].namaHalaqah;
                }
            }
        }

        // Cari objek halaqah yang cocok
        const matchedHal = halList.find(h => 
            h && (
                h.halaqahId === targetHalaqah || 
                h.namaHalaqah === targetHalaqah ||
                String(h.halaqahId || '').trim().toLowerCase() === String(targetHalaqah || '').trim().toLowerCase() ||
                String(h.namaHalaqah || '').trim().toLowerCase() === String(targetHalaqah || '').trim().toLowerCase()
            )
        ) || (halList.length > 0 ? halList[0] : null);

        const activeHalVal = matchedHal ? (matchedHal.halaqahId || matchedHal.namaHalaqah) : (targetHalaqah || '');

        const todayStr = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('tahfidz-presensi-date');
        if (dateInput) {
            dateInput.value = todayStr;
        }

        const halSelect = document.getElementById('tahfidz-presensi-halaqah-select');
        if (halSelect) {
            halSelect.innerHTML = halList.map(h => {
                const hId = h.halaqahId || h.namaHalaqah;
                const isSel = matchedHal && (h.halaqahId === matchedHal.halaqahId || h.namaHalaqah === matchedHal.namaHalaqah);
                return `<option value="${escapeHtml(hId)}" ${isSel ? 'selected' : ''}>${escapeHtml(h.namaHalaqah)} (${escapeHtml(h.muhafiz || 'Muhafiz')})</option>`;
            }).join('');
            if (halList.length === 0) {
                halSelect.innerHTML = `<option value="">Belum ada halaqah</option>`;
            }
            if (activeHalVal) {
                halSelect.value = activeHalVal;
            }
        }

        if (!ASNTahfidz.presensiState) {
            ASNTahfidz.presensiState = {
                activeHalaqahId: '',
                date: todayStr,
                sesi: "Pagi (Ba'da Subuh)",
                records: {},
                query: ''
            };
        }

        ASNTahfidz.presensiState.activeHalaqahId = (halSelect && halSelect.value) ? halSelect.value : activeHalVal;
        ASNTahfidz.presensiState.date = todayStr;
        ASNTahfidz.presensiState.sesi = document.getElementById('tahfidz-presensi-sesi')?.value || "Pagi (Ba'da Subuh)";
        ASNTahfidz.presensiState.query = '';

        const searchInput = document.getElementById('tahfidz-presensi-search');
        if (searchInput) searchInput.value = '';

        const savedRecords = getTahfidzPresensiRecords();
        ASNTahfidz.presensiState.records = { ...savedRecords };

        renderTahfidzPresensiList();
    } catch (err) {
        console.error('Error saat mempersiapkan presensi halaqah:', err);
    }
}

function closeTahfidzPresensiModal() {
    const modal = document.getElementById('modal-tahfidz-presensi');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

function onTahfidzPresensiHalaqahChange() {
    const sel = document.getElementById('tahfidz-presensi-halaqah-select');
    if (sel) {
        ASNTahfidz.presensiState.activeHalaqahId = sel.value;
        renderTahfidzPresensiList();
    }
}

function onTahfidzPresensiDateChange() {
    const d = document.getElementById('tahfidz-presensi-date');
    if (d) {
        ASNTahfidz.presensiState.date = d.value;
    }
}

function onTahfidzPresensiSesiChange() {
    const s = document.getElementById('tahfidz-presensi-sesi');
    if (s) {
        ASNTahfidz.presensiState.sesi = s.value;
    }
}

function filterTahfidzPresensiModalList() {
    const q = document.getElementById('tahfidz-presensi-search')?.value || '';
    ASNTahfidz.presensiState.query = q.toLowerCase().trim();
    renderTahfidzPresensiList();
}

function renderTahfidzPresensiList() {
    const container = document.getElementById('tahfidz-presensi-list');
    const badgeEl = document.getElementById('tahfidz-presensi-target-badge');
    const summaryText = document.getElementById('tahfidz-presensi-summary-text');
    if (!container) return;

    const halId = ASNTahfidz.presensiState.activeHalaqahId;
    const halObj = (ASNTahfidz.data?.halaqahs || []).find(h => h.halaqahId === halId || h.namaHalaqah === halId);
    const halName = halObj ? halObj.namaHalaqah : 'Halaqah';

    if (badgeEl) {
        badgeEl.innerText = halName;
    }

    let students = getStudentsForPresensiHalaqah(halId);
    const q = ASNTahfidz.presensiState.query;
    if (q) {
        students = students.filter(s => (s.name && s.name.toLowerCase().includes(q)) || (s.nis && s.nis.toLowerCase().includes(q)));
    }

    if (students.length === 0) {
        container.innerHTML = `
            <div class="py-8 text-center text-slate-400 space-y-1">
                <i class="fa-solid fa-user-slash text-2xl mb-1 text-slate-300 dark:text-slate-600"></i>
                <p class="text-xs font-semibold">Tidak ada santri di halaqah ini.</p>
                <p class="text-[10px]">Silakan masukkan santri melalui menu Kelola Halaqah.</p>
            </div>
        `;
        if (summaryText) summaryText.innerText = '0 Santri';
        return;
    }

    let countH = 0;
    let countS = 0;
    let countI = 0;
    let countP = 0;

    const html = students.map(st => {
        const sId = st.studentId || st.nis;
        const currentRec = ASNTahfidz.presensiState.records[sId] || { status: 'HADIR', keterangan: '' };
        const status = currentRec.status || 'HADIR';
        const ket = currentRec.keterangan || '';

        if (status === 'HADIR') countH++;
        else if (status === 'SAKIT') countS++;
        else if (status === 'IZIN') countI++;
        else if (status === 'PULANG') countP++;

        const initials = (st.name || 'SN').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

        return `
        <div class="p-2.5 rounded-2xl border ${status === 'HADIR' ? 'border-slate-100 dark:border-[#253447] bg-white dark:bg-[#15202d]' : (status === 'SAKIT' ? 'border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20' : (status === 'PULANG' ? 'border-purple-200 dark:border-purple-900/60 bg-purple-50/40 dark:bg-purple-950/20' : 'border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20'))} shadow-sm transition space-y-2">
            <div class="flex items-center justify-between gap-2">
                <!-- Info Santri -->
                <div class="flex items-center space-x-2.5 min-w-0">
                    <div class="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#1c2836] text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center text-xs shrink-0 border border-slate-200 dark:border-[#283a4e]">
                        ${initials}
                    </div>
                    <div class="min-w-0">
                        <h4 class="font-extrabold text-xs text-slate-800 dark:text-slate-100 truncate">${escapeHtml(st.name)}</h4>
                        <p class="text-[10px] text-slate-400">NIS: ${escapeHtml(st.nis || '-')}</p>
                    </div>
                </div>

                <!-- 4 Quick Attendance Chips -->
                <div class="flex items-center gap-1 shrink-0">
                    <button type="button" onclick="setTahfidzStudentPresensi('${sId}', 'HADIR')" class="px-2.5 py-1 rounded-lg text-[10px] font-black transition active:scale-95 ${status === 'HADIR' ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400/30' : 'bg-slate-100 hover:bg-slate-200 dark:bg-[#1c2836] text-slate-600 dark:text-slate-300'}" title="Hadir">
                        H
                    </button>
                    <button type="button" onclick="setTahfidzStudentPresensi('${sId}', 'SAKIT')" class="px-2.5 py-1 rounded-lg text-[10px] font-black transition active:scale-95 ${status === 'SAKIT' ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-400/30' : 'bg-slate-100 hover:bg-slate-200 dark:bg-[#1c2836] text-slate-600 dark:text-slate-300'}" title="Izin Sakit">
                        S
                    </button>
                    <button type="button" onclick="setTahfidzStudentPresensi('${sId}', 'IZIN')" class="px-2.5 py-1 rounded-lg text-[10px] font-black transition active:scale-95 ${status === 'IZIN' ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400/30' : 'bg-slate-100 hover:bg-slate-200 dark:bg-[#1c2836] text-slate-600 dark:text-slate-300'}" title="Izin Kegiatan / Udzur">
                        I
                    </button>
                    <button type="button" onclick="setTahfidzStudentPresensi('${sId}', 'PULANG')" class="px-2.5 py-1 rounded-lg text-[10px] font-black transition active:scale-95 ${status === 'PULANG' ? 'bg-purple-600 text-white shadow-sm ring-2 ring-purple-400/30' : 'bg-slate-100 hover:bg-slate-200 dark:bg-[#1c2836] text-slate-600 dark:text-slate-300'}" title="Izin Pulang ke Rumah">
                        P
                    </button>
                </div>
            </div>

            <!-- Keterangan Input jika bukan Hadir -->
            ${status !== 'HADIR' ? `
            <div class="pt-1 border-t border-dashed ${status === 'SAKIT' ? 'border-amber-200 dark:border-amber-900/60' : (status === 'PULANG' ? 'border-purple-200 dark:border-purple-900/60' : 'border-blue-200 dark:border-blue-900/60')} flex items-center gap-1.5">
                <i class="fa-solid fa-pen text-[9px] ${status === 'SAKIT' ? 'text-amber-500' : (status === 'PULANG' ? 'text-purple-500' : 'text-blue-500')} ml-1"></i>
                <input type="text" value="${escapeHtml(ket)}" oninput="updateTahfidzStudentPresensiKet('${sId}', this.value)" placeholder="${status === 'SAKIT' ? 'Catatan sakit: cth. Demam di UKS / Asrama...' : (status === 'PULANG' ? 'Catatan pulang: cth. Izin keluarga s.d. Ahad...' : 'Catatan izin: cth. Tugas pengurus pondok...')}" class="w-full px-2 py-0.5 text-[10px] rounded-lg bg-white dark:bg-[#15202d] border border-slate-200 dark:border-[#283a4e] text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-emerald-500">
            </div>
            ` : ''}
        </div>
        `;
    }).join('');

    container.innerHTML = html;

    if (summaryText) {
        summaryText.innerHTML = `
            <span class="text-emerald-600 font-bold">${countH} Hadir</span>
            <span class="text-slate-300 dark:text-slate-600">•</span>
            <span class="text-amber-600 font-bold">${countS} Sakit</span>
            <span class="text-slate-300 dark:text-slate-600">•</span>
            <span class="text-blue-600 font-bold">${countI} Izin</span>
            <span class="text-slate-300 dark:text-slate-600">•</span>
            <span class="text-purple-600 font-bold">${countP} Pulang</span>
        `;
    }
}

function setTahfidzStudentPresensi(studentId, status) {
    if (!studentId) return;
    if (!ASNTahfidz.presensiState.records[studentId]) {
        ASNTahfidz.presensiState.records[studentId] = { status: 'HADIR', keterangan: '' };
    }
    ASNTahfidz.presensiState.records[studentId].status = status;
    renderTahfidzPresensiList();
}

function updateTahfidzStudentPresensiKet(studentId, keterangan) {
    if (!studentId) return;
    if (!ASNTahfidz.presensiState.records[studentId]) {
        ASNTahfidz.presensiState.records[studentId] = { status: 'HADIR', keterangan: '' };
    }
    ASNTahfidz.presensiState.records[studentId].keterangan = keterangan;
}

function setAllTahfidzPresensi(status) {
    const halId = ASNTahfidz.presensiState.activeHalaqahId;
    const students = getStudentsForPresensiHalaqah(halId);
    students.forEach(st => {
        const sId = st.studentId || st.nis;
        if (!ASNTahfidz.presensiState.records[sId]) {
            ASNTahfidz.presensiState.records[sId] = { status, keterangan: '' };
        } else {
            ASNTahfidz.presensiState.records[sId].status = status;
        }
    });
    renderTahfidzPresensiList();
    if (typeof showToast === 'function') {
        showToast(`✅ Semua santri halaqah ditandai ${status === 'HADIR' ? 'Hadir' : status}.`);
    }
}

async function saveTahfidzPresensi() {
    const btn = document.getElementById('btn-save-tahfidz-presensi');
    setTahfidzButtonLoading(btn, true, 'Menyimpan Presensi ke Spreadsheet...');

    try {
        const halId = ASNTahfidz.presensiState.activeHalaqahId;
        const halObj = (ASNTahfidz.data?.halaqahs || []).find(h => h.halaqahId === halId || h.namaHalaqah === halId);
        let students = getStudentsForPresensiHalaqah(halId);
        const currentRecords = ASNTahfidz.presensiState.records || {};

        // 1. Simpan ke local cache terlebih dahulu (responsif instan tanpa jeda)
        saveTahfidzPresensiRecords(currentRecords);

        // Update in-memory students
        (ASNTahfidz.data?.students || []).forEach(st => {
            const sId = st.studentId || st.nis;
            if (currentRecords[sId]) {
                st.presensiStatus = currentRecords[sId].status;
                st.presensiKeterangan = currentRecords[sId].keterangan;
            }
        });

        // Re-render student table & re-calculate KPI
        const activeHalFilter = document.getElementById('tahfidz-filter-halaqah')?.value || 'ALL';
        renderTahfidzStudentTable();
        renderTahfidzSummaryCards(activeHalFilter);

        // 2. Siapkan payload untuk disinkronkan ke Google Spreadsheet (Sheet Tahfidz_Presensi)
        if (students.length === 0 && Object.keys(currentRecords).length > 0) {
            const all = ASNTahfidz.data?.students || [];
            students = all.filter(st => {
                const sId = st.studentId || st.nis;
                return currentRecords[sId] !== undefined;
            });
        }
        if (students.length === 0) {
            students = (ASNTahfidz.data?.students || []).filter(st => isStudentInHalaqah(st));
        }
        if (students.length === 0) {
            students = ASNTahfidz.data?.students || [];
        }

        let recordPayload = students.map(st => {
            const sId = st.studentId || st.nis;
            const cur = currentRecords[sId] || { status: 'HADIR', keterangan: '' };
            return {
                studentId: sId,
                nis: st.nis || sId,
                studentName: st.name || '',
                status: cur.status || 'HADIR',
                keterangan: cur.keterangan || '',
                halaqahId: halId || (st.halaqah?.halaqahId || ''),
                namaHalaqah: halObj ? halObj.namaHalaqah : (st.halaqah?.namaHalaqah || 'Halaqah')
            };
        });

        if (recordPayload.length === 0 && Object.keys(currentRecords).length > 0) {
            recordPayload = Object.entries(currentRecords).map(([sId, cur]) => {
                const st = (ASNTahfidz.data?.students || []).find(s => (s.studentId || s.nis) === sId);
                return {
                    studentId: sId,
                    nis: st ? (st.nis || sId) : sId,
                    studentName: st ? (st.name || '') : 'Santri',
                    status: (cur && cur.status) || 'HADIR',
                    keterangan: (cur && cur.keterangan) || '',
                    halaqahId: halId,
                    namaHalaqah: halObj ? halObj.namaHalaqah : 'Halaqah'
                };
            });
        }

        const token = (typeof getAdminSessionToken === 'function' ? getAdminSessionToken() : (sessionStorage.getItem(TAHFIDZ_STORAGE_KEYS.adminToken) || localStorage.getItem(TAHFIDZ_STORAGE_KEYS.adminToken))) || "";
        const postData = {
            token: token,
            tanggal: ASNTahfidz.presensiState.date || new Date().toISOString().split('T')[0],
            sesi: ASNTahfidz.presensiState.sesi || "Pagi (Ba'da Subuh)",
            halaqahId: halId,
            namaHalaqah: halObj ? halObj.namaHalaqah : 'Halaqah',
            muhafiz: halObj ? (halObj.muhafiz || '') : '',
            records: recordPayload,
            payload: {
                tanggal: ASNTahfidz.presensiState.date || new Date().toISOString().split('T')[0],
                sesi: ASNTahfidz.presensiState.sesi || "Pagi (Ba'da Subuh)",
                halaqahId: halId,
                namaHalaqah: halObj ? halObj.namaHalaqah : 'Halaqah',
                muhafiz: halObj ? (halObj.muhafiz || '') : '',
                records: recordPayload
            }
        };

        closeTahfidzPresensiModal();

        // 3. Kirim ke backend Google Apps Script secara asynchronous
        const res = await apiPost("saveTahfidzPresensi", postData);
        if (res && (res.success || res.status === "success")) {
            if (typeof showToast === 'function') {
                const countUdzur = typeof res.savedCount === 'number' ? res.savedCount : recordPayload.filter(r => r.status !== 'HADIR').length;
                if (countUdzur > 0) {
                    showToast(`✅ Presensi halaqah tersimpan (${countUdzur} catatan udzur dicatat di Spreadsheet).`);
                } else {
                    showToast(`✅ Presensi halaqah tersimpan. Semua santri hadir!`);
                }
            }
        } else {
            console.warn("Sinkronisasi presensi ke server:", res);
            if (typeof showToast === 'function') {
                showToast('⚠️ Presensi tersimpan lokal. Sinkronisasi spreadsheet: ' + ((res && res.message) || 'Tertunda'));
            }
        }
    } catch (err) {
        console.error('Error saving tahfidz presensi:', err);
        if (typeof showToast === 'function') {
            showToast('⚠️ Presensi tersimpan di perangkat lokal, kendala server: ' + err.message);
        }
        closeTahfidzPresensiModal();
    } finally {
        setTahfidzButtonLoading(btn, false, 'Menyimpan Presensi...', '<i class="fa-solid fa-floppy-disk"></i><span>Simpan Presensi</span>');
    }
}

// Auto-export to global window
window.ASNTahfidz = ASNTahfidz;
window.loadAdminTahfidzData = loadAdminTahfidzData;
window.triggerInitTahfidzSheets = triggerInitTahfidzSheets;
window.filterTahfidzList = filterTahfidzList;
window.openTahfidzCatatModal = openTahfidzCatatModal;
window.closeTahfidzCatatModal = closeTahfidzCatatModal;
window.populateTahfidzCatatSesiDropdown = populateTahfidzCatatSesiDropdown;
window.setTahfidzCatatTipe = setTahfidzCatatTipe;
window.applyTahfidzRecommendation = applyTahfidzRecommendation;
window.toggleTahfidzPage = toggleTahfidzPage;
window.applyTahfidzQuickChip = applyTahfidzQuickChip;
window.submitTahfidzCatat = submitTahfidzCatat;
window.openTahfidzStudentDetail = openTahfidzStudentDetail;
window.closeTahfidzStudentDetail = closeTahfidzStudentDetail;
window.switchTahfidzDetailTab = switchTahfidzDetailTab;
window.deleteTahfidzLogEntry = deleteTahfidzLogEntry;
window.openTahfidzTargetModal = openTahfidzTargetModal;
window.cleanSesiTime = cleanSesiTime;
window.closeTahfidzTargetModal = closeTahfidzTargetModal;
window.setTahfidzTargetChip = setTahfidzTargetChip;
window.submitTahfidzTarget = submitTahfidzTarget;
window.openTahfidzHalaqahModal = openTahfidzHalaqahModal;
window.closeTahfidzHalaqahModal = closeTahfidzHalaqahModal;
window.switchHalaqahTab = switchHalaqahTab;
window.openPlottingFromHalaqahCard = openPlottingFromHalaqahCard;
window.populatePlottingHalaqahSelector = populatePlottingHalaqahSelector;
window.onSelectPlottingHalaqah = onSelectPlottingHalaqah;
window.renderTahfidzMatriksBeban = renderTahfidzMatriksBeban;
window.renderTahfidzSesiCards = renderTahfidzSesiCards;
window.submitTahfidzSesi = submitTahfidzSesi;
window.deleteTahfidzSesiConfirm = deleteTahfidzSesiConfirm;
window.editTahfidzSesi = editTahfidzSesi;
window.saveAllHalaqahChanges = saveAllHalaqahChanges;
window.setTahfidzDetailTipeFilter = setTahfidzDetailTipeFilter;
window.onChangeIndikatorDate = onChangeIndikatorDate;
window.shiftIndikatorWeek = shiftIndikatorWeek;
window.shiftIndikatorMonth = shiftIndikatorMonth;
window.setIndikatorPreset = setIndikatorPreset;
window.submitNewHalaqah = submitNewHalaqah;
window.printTahfidzStudentCard = printTahfidzStudentCard;
window.printTahfidzRekap = printTahfidzRekap;
window.exportTahfidzDataCSV = exportTahfidzDataCSV;
window.exportTahfidzDataXLSX = exportTahfidzDataXLSX;
window.openTahfidzPengasuhView = openTahfidzPengasuhView;
window.deleteTahfidzHalaqahConfirm = deleteTahfidzHalaqahConfirm;
window.openPlottingSantri = openPlottingSantri;
window.closeTahfidzPlottingModal = closeTahfidzPlottingModal;
window.addStudentToPlotting = addStudentToPlotting;
window.removeStudentFromPlotting = removeStudentFromPlotting;
window.filterTahfidzPlottingAvailableList = filterTahfidzPlottingAvailableList;
window.submitTahfidzPlotting = submitTahfidzPlotting;
window.resetTahfidzSesiForm = resetTahfidzSesiForm;
window.recalculateTahfidzTargetWeekly = recalculateTahfidzTargetWeekly;
window.renderTahfidzTargetModalSessions = renderTahfidzTargetModalSessions;
window.getTahfidzActiveWeeklySessionCounts = getTahfidzActiveWeeklySessionCounts;

// Bulk Target & Selection Functions
window.updateTahfidzBulkSelectionBar = updateTahfidzBulkSelectionBar;
window.toggleSelectAllTahfidzStudents = toggleSelectAllTahfidzStudents;
window.toggleSelectTahfidzStudent = toggleSelectTahfidzStudent;
window.clearTahfidzSelectedStudents = clearTahfidzSelectedStudents;
window.openTahfidzBulkTargetModal = openTahfidzBulkTargetModal;
window.closeTahfidzBulkTargetModal = closeTahfidzBulkTargetModal;
window.setBulkTargetScope = setBulkTargetScope;
window.onBulkTargetScopeChange = onBulkTargetScopeChange;
window.recalculateBulkTargetWeekly = recalculateBulkTargetWeekly;
window.setTahfidzBulkTargetChip = setTahfidzBulkTargetChip;
window.submitTahfidzBulkTarget = submitTahfidzBulkTarget;
window.isStudentInHalaqah = isStudentInHalaqah;
window.populateTahfidzMuhafizSelector = populateTahfidzMuhafizSelector;
window.renderTahfidzEstimasiKhatam = renderTahfidzEstimasiKhatam;
window.setTahfidzSatuanMode = setTahfidzSatuanMode;
window.getSurahRangeForJuz = getSurahRangeForJuz;
window.populateTahfidzJuzRangeDropdowns = populateTahfidzJuzRangeDropdowns;
window.onTahfidzJuzRangeChange = onTahfidzJuzRangeChange;
window.applyTahfidzJuzPreset = applyTahfidzJuzPreset;
window.updateTahfidzPresetChipHighlight = updateTahfidzPresetChipHighlight;
window.applyTahfidzRolePermissions = applyTahfidzRolePermissions;
window.getHalaqahForActiveAsatidz = getHalaqahForActiveAsatidz;

// Presensi Halaqah Functions
window.openTahfidzPresensiModal = openTahfidzPresensiModal;
window.closeTahfidzPresensiModal = closeTahfidzPresensiModal;
window.onTahfidzPresensiHalaqahChange = onTahfidzPresensiHalaqahChange;
window.onTahfidzPresensiDateChange = onTahfidzPresensiDateChange;
window.onTahfidzPresensiSesiChange = onTahfidzPresensiSesiChange;
window.filterTahfidzPresensiModalList = filterTahfidzPresensiModalList;
window.renderTahfidzPresensiList = renderTahfidzPresensiList;
window.setTahfidzStudentPresensi = setTahfidzStudentPresensi;
window.updateTahfidzStudentPresensiKet = updateTahfidzStudentPresensiKet;
window.setAllTahfidzPresensi = setAllTahfidzPresensi;
window.saveTahfidzPresensi = saveTahfidzPresensi;
window.getStudentPresensiStatus = getStudentPresensiStatus;
window.getStudentPresensiData = getStudentPresensiData;

// Kurikulum Tahfidz [Juz 30, 1..29] & Navigasi Posisi
window.JUZ_CURRICULUM_ORDER = JUZ_CURRICULUM_ORDER;
window.getJuzCurriculumIndex = getJuzCurriculumIndex;
window.getCurriculumProgress = getCurriculumProgress;
window.getNextCurriculumPosition = getNextCurriculumPosition;

// Inisialisasi Database Sheets
window.triggerInitTahfidzSheets = triggerInitTahfidzSheets;


