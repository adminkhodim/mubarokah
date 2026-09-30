        // ==================== PORTAL IBADAH MODAL ====================
        function openIbadahModal(type) {
            const titleEl = document.getElementById('ibadah-title');
            const tagEl = document.getElementById('ibadah-tag');
            const bodyEl = document.getElementById('ibadah-body');

            if (type === 'quran') {
                titleEl.innerHTML = `<i class="fa-solid fa-book-quran text-emerald-600 mr-2"></i> Al-Qur'an Digital`;
                tagEl.className = "text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full uppercase";
                tagEl.innerText = "114 Surah";
                bodyEl.innerHTML = `
                    <div class="space-y-3">
                        <p class="font-semibold text-slate-700">Surah Pilihan Santri:</p>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div class="p-3 bg-white rounded-xl border border-slate-200 flex justify-between items-center cursor-pointer hover:border-emerald-500 transition">
                                <div><span class="font-bold text-xs text-slate-800">1. Al-Fatihah</span> <span class="text-[10px] text-slate-400 block">7 Ayat</span></div>
                                <span class="text-base font-semibold text-emerald-700">الفاتحة</span>
                            </div>
                            <div class="p-3 bg-white rounded-xl border border-slate-200 flex justify-between items-center cursor-pointer hover:border-emerald-500 transition">
                                <div><span class="font-bold text-xs text-slate-800">36. Yasin</span> <span class="text-[10px] text-slate-400 block">83 Ayat</span></div>
                                <span class="text-base font-semibold text-emerald-700">يس</span>
                            </div>
                            <div class="p-3 bg-white rounded-xl border border-slate-200 flex justify-between items-center cursor-pointer hover:border-emerald-500 transition">
                                <div><span class="font-bold text-xs text-slate-800">55. Ar-Rahman</span> <span class="text-[10px] text-slate-400 block">78 Ayat</span></div>
                                <span class="text-base font-semibold text-emerald-700">الرحمن</span>
                            </div>
                            <div class="p-3 bg-white rounded-xl border border-slate-200 flex justify-between items-center cursor-pointer hover:border-emerald-500 transition">
                                <div><span class="font-bold text-xs text-slate-800">67. Al-Mulk</span> <span class="text-[10px] text-slate-400 block">30 Ayat</span></div>
                                <span class="text-base font-semibold text-emerald-700">الملك</span>
                            </div>
                        </div>
                    </div>
                `;
            } else if (type === 'maulid') {
                titleEl.innerHTML = `<i class="fa-solid fa-kaaba text-purple-600 mr-2"></i> Kitab Maulid Nabi`;
                tagEl.className = "text-[10px] font-extrabold bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded-full uppercase";
                tagEl.innerText = "Diba' & Simtuddurar";
                bodyEl.innerHTML = `
                    <div class="space-y-3">
                        <p class="font-semibold text-slate-700">Pilih Kitab Maulid:</p>
                        <div class="space-y-2">
                            <div onclick="closeModal('ibadah-modal'); switchTab('maulid-index'); renderMaulidIndex();" class="p-3 bg-white rounded-xl border border-slate-200 flex justify-between items-center cursor-pointer hover:border-purple-500 transition">
                                <span class="font-bold text-xs text-slate-800">Maulid Ad-Diba'i (الإمام الديبعي)</span>
                                <i class="fa-solid fa-chevron-right text-xs text-slate-400"></i>
                            </div>
                            <div class="p-3 bg-white rounded-xl border border-slate-200 flex justify-between items-center cursor-pointer hover:border-purple-500 transition">
                                <span class="font-bold text-xs text-slate-800">Maulid Simtuddurar (سمط الدرر)</span>
                                <i class="fa-solid fa-chevron-right text-xs text-slate-400"></i>
                            </div>
                            <div class="p-3 bg-white rounded-xl border border-slate-200 flex justify-between items-center cursor-pointer hover:border-purple-500 transition">
                                <span class="font-bold text-xs text-slate-800">Maulid Al-Barzanji (البرزنجي)</span>
                                <i class="fa-solid fa-chevron-right text-xs text-slate-400"></i>
                            </div>
                        </div>
                    </div>
                `;
            } else if (type === 'burdah') {
                titleEl.innerHTML = `<i class="fa-solid fa-scroll text-amber-600 mr-2"></i> Qasidah Burdah`;
                tagEl.className = "text-[10px] font-extrabold bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full uppercase";
                tagEl.innerText = "Fashl 1 - 10";
                bodyEl.innerHTML = `
                    <div class="space-y-3 text-center">
                        <div class="p-4 bg-white rounded-2xl border border-amber-200 space-y-2">
                            <p class="text-base md:text-lg font-bold text-slate-800 font-serif leading-loose" dir="rtl">
                                مَوْلَايَ صَلِّ وَسَلِّمْ دَائِمًا أَبَدًا <br> عَلَى حَبِيبِكَ خَيْرِ الْخَلْقِ كُلِّهِمِ
                            </p>
                            <p class="text-[11px] text-slate-500 italic">"Ya Tuhanku, limpahkanlah shalawat dan salam selalu selama-lamanya kepada Kekasih-Mu, makhluk terbaik seluruhnya."</p>
                        </div>
                    </div>
                `;
            } else if (type === 'tahlil') {
                titleEl.innerHTML = `<i class="fa-solid fa-hands-holding text-blue-600 mr-2"></i> Tahlil & Surat Yasin`;
                tagEl.className = "text-[10px] font-extrabold bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full uppercase";
                tagEl.innerText = "Lengkap + Doa";
                bodyEl.innerHTML = `
                    <div class="space-y-2">
                        <div class="p-3 bg-white rounded-xl border border-slate-200 flex justify-between items-center cursor-pointer hover:border-blue-500 transition">
                            <span class="font-bold text-xs text-slate-800">1. Bacaan Surat Yasin</span>
                            <span class="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-semibold">Teks Arab</span>
                        </div>
                        <div class="p-3 bg-white rounded-xl border border-slate-200 flex justify-between items-center cursor-pointer hover:border-blue-500 transition">
                            <span class="font-bold text-xs text-slate-800">2. Susunan Bacaan Tahlil Lengkap</span>
                            <span class="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-semibold">Urutan Harian</span>
                        </div>
                        <div class="p-3 bg-white rounded-xl border border-slate-200 flex justify-between items-center cursor-pointer hover:border-blue-500 transition">
                            <span class="font-bold text-xs text-slate-800">3. Doa Tahlil & Arwah</span>
                            <span class="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-semibold">Doa Penutup</span>
                        </div>
                    </div>
                `;
            }
        }
        // ==================== AL-QUR'AN FEATURE ====================
        let quranData = [];
        let currentAudio = null;
        let isLatinVisible = false;
        let isTranslationVisible = false;
        let currentQuranPage = 1;
        let currentQuranJuz = 1;
        let quranPageCache = {};
        let quranPojokInitialized = false;
        let pageAudioPlaying = false;
        let currentQuranSubTab = 'surah';
        let quranPageViewMode = 'mushaf'; // 'mushaf' (gambar Kemenag RI) atau 'text' (teks & audio digital)
        let mushafZoom = 1.0;
        let mushafTheme = localStorage.getItem('mubarokah_mushaf_theme') || 'auto';

        const QURAN_CHAPTER_PAGES = [
            { id: 1, name: "Al-Fatihah", startPage: 1, endPage: 1 },
            { id: 2, name: "Al-Baqarah", startPage: 2, endPage: 49 },
            { id: 3, name: "Ali 'Imran", startPage: 50, endPage: 76 },
            { id: 4, name: "An-Nisa'", startPage: 77, endPage: 106 },
            { id: 5, name: "Al-Ma'idah", startPage: 106, endPage: 127 },
            { id: 6, name: "Al-An'am", startPage: 128, endPage: 150 },
            { id: 7, name: "Al-A'raf", startPage: 151, endPage: 176 },
            { id: 8, name: "Al-Anfal", startPage: 177, endPage: 186 },
            { id: 9, name: "At-Taubah", startPage: 187, endPage: 207 },
            { id: 10, name: "Yunus", startPage: 208, endPage: 221 },
            { id: 11, name: "Hud", startPage: 221, endPage: 235 },
            { id: 12, name: "Yusuf", startPage: 235, endPage: 248 },
            { id: 13, name: "Ar-Ra'd", startPage: 249, endPage: 255 },
            { id: 14, name: "Ibrahim", startPage: 255, endPage: 261 },
            { id: 15, name: "Al-Hijr", startPage: 262, endPage: 267 },
            { id: 16, name: "An-Nahl", startPage: 267, endPage: 281 },
            { id: 17, name: "Al-Isra'", startPage: 282, endPage: 293 },
            { id: 18, name: "Al-Kahf", startPage: 293, endPage: 304 },
            { id: 19, name: "Maryam", startPage: 305, endPage: 312 },
            { id: 20, name: "Ta-Ha", startPage: 312, endPage: 321 },
            { id: 21, name: "Al-Anbiya'", startPage: 322, endPage: 331 },
            { id: 22, name: "Al-Hajj", startPage: 332, endPage: 341 },
            { id: 23, name: "Al-Mu'minun", startPage: 342, endPage: 349 },
            { id: 24, name: "An-Nur", startPage: 350, endPage: 359 },
            { id: 25, name: "Al-Furqan", startPage: 359, endPage: 366 },
            { id: 26, name: "Asy-Syu'ara'", startPage: 367, endPage: 376 },
            { id: 27, name: "An-Naml", startPage: 377, endPage: 385 },
            { id: 28, name: "Al-Qashash", startPage: 385, endPage: 396 },
            { id: 29, name: "Al-'Ankabut", startPage: 396, endPage: 404 },
            { id: 30, name: "Ar-Rum", startPage: 404, endPage: 410 },
            { id: 31, name: "Luqman", startPage: 411, endPage: 414 },
            { id: 32, name: "As-Sajdah", startPage: 415, endPage: 417 },
            { id: 33, name: "Al-Ahzab", startPage: 418, endPage: 427 },
            { id: 34, name: "Saba'", startPage: 428, endPage: 434 },
            { id: 35, name: "Fathir", startPage: 434, endPage: 440 },
            { id: 36, name: "Ya-Sin", startPage: 440, endPage: 445 },
            { id: 37, name: "Ash-Shaffat", startPage: 446, endPage: 452 },
            { id: 38, name: "Shad", startPage: 453, endPage: 458 },
            { id: 39, name: "Az-Zumar", startPage: 458, endPage: 467 },
            { id: 40, name: "Ghafir", startPage: 467, endPage: 476 },
            { id: 41, name: "Fushshilat", startPage: 477, endPage: 482 },
            { id: 42, name: "Asy-Syura", startPage: 483, endPage: 489 },
            { id: 43, name: "Az-Zukhruf", startPage: 489, endPage: 495 },
            { id: 44, name: "Ad-Dukhan", startPage: 496, endPage: 498 },
            { id: 45, name: "Al-Jatsiyah", startPage: 499, endPage: 502 },
            { id: 46, name: "Al-Ahqaf", startPage: 502, endPage: 506 },
            { id: 47, name: "Muhammad", startPage: 507, endPage: 510 },
            { id: 48, name: "Al-Fath", startPage: 511, endPage: 515 },
            { id: 49, name: "Al-Hujurat", startPage: 515, endPage: 517 },
            { id: 50, name: "Qaf", startPage: 518, endPage: 520 },
            { id: 51, name: "Adz-Dzariyat", startPage: 520, endPage: 523 },
            { id: 52, name: "Ath-Thur", startPage: 523, endPage: 525 },
            { id: 53, name: "An-Najm", startPage: 526, endPage: 528 },
            { id: 54, name: "Al-Qamar", startPage: 528, endPage: 531 },
            { id: 55, name: "Ar-Rahman", startPage: 531, endPage: 534 },
            { id: 56, name: "Al-Waqi'ah", startPage: 534, endPage: 537 },
            { id: 57, name: "Al-Hadid", startPage: 537, endPage: 541 },
            { id: 58, name: "Al-Mujadilah", startPage: 542, endPage: 545 },
            { id: 59, name: "Al-Hasyr", startPage: 545, endPage: 548 },
            { id: 60, name: "Al-Mumtahanah", startPage: 549, endPage: 551 },
            { id: 61, name: "Ash-Shaff", startPage: 551, endPage: 552 },
            { id: 62, name: "Al-Jumu'ah", startPage: 553, endPage: 554 },
            { id: 63, name: "Al-Munafiqun", startPage: 554, endPage: 555 },
            { id: 64, name: "At-Taghabun", startPage: 556, endPage: 557 },
            { id: 65, name: "Ath-Thalaq", startPage: 558, endPage: 559 },
            { id: 66, name: "At-Tahrim", startPage: 560, endPage: 561 },
            { id: 67, name: "Al-Mulk", startPage: 562, endPage: 564 },
            { id: 68, name: "Al-Qalam", startPage: 564, endPage: 566 },
            { id: 69, name: "Al-Haqqah", startPage: 566, endPage: 568 },
            { id: 70, name: "Al-Ma'arij", startPage: 568, endPage: 570 },
            { id: 71, name: "Nuh", startPage: 570, endPage: 571 },
            { id: 72, name: "Al-Jinn", startPage: 572, endPage: 573 },
            { id: 73, name: "Al-Muzzammil", startPage: 574, endPage: 575 },
            { id: 74, name: "Al-Muddatstsir", startPage: 575, endPage: 577 },
            { id: 75, name: "Al-Qiyamah", startPage: 577, endPage: 578 },
            { id: 76, name: "Al-Insan", startPage: 578, endPage: 580 },
            { id: 77, name: "Al-Mursalat", startPage: 580, endPage: 581 },
            { id: 78, name: "An-Naba'", startPage: 582, endPage: 583 },
            { id: 79, name: "An-Nazi'at", startPage: 583, endPage: 584 },
            { id: 80, name: "'Abasa", startPage: 585, endPage: 586 },
            { id: 81, name: "At-Takwir", startPage: 586, endPage: 586 },
            { id: 82, name: "Al-Infithar", startPage: 587, endPage: 587 },
            { id: 83, name: "Al-Muthaffifin", startPage: 587, endPage: 589 },
            { id: 84, name: "Al-Insyiqaq", startPage: 589, endPage: 590 },
            { id: 85, name: "Al-Buruj", startPage: 590, endPage: 590 },
            { id: 86, name: "Ath-Thariq", startPage: 591, endPage: 591 },
            { id: 87, name: "Al-A'la", startPage: 591, endPage: 592 },
            { id: 88, name: "Al-Ghasyiyah", startPage: 592, endPage: 593 },
            { id: 89, name: "Al-Fajr", startPage: 593, endPage: 594 },
            { id: 90, name: "Al-Balad", startPage: 594, endPage: 595 },
            { id: 91, name: "Asy-Syams", startPage: 595, endPage: 595 },
            { id: 92, name: "Al-Lail", startPage: 595, endPage: 596 },
            { id: 93, name: "Adh-Dhuha", startPage: 596, endPage: 596 },
            { id: 94, name: "Asy-Syarh", startPage: 596, endPage: 597 },
            { id: 95, name: "At-Tin", startPage: 597, endPage: 597 },
            { id: 96, name: "Al-'Alaq", startPage: 597, endPage: 598 },
            { id: 97, name: "Al-Qadr", startPage: 598, endPage: 598 },
            { id: 98, name: "Al-Bayyinah", startPage: 598, endPage: 599 },
            { id: 99, name: "Az-Zalzalah", startPage: 599, endPage: 599 },
            { id: 100, name: "Al-'Adiyat", startPage: 599, endPage: 600 },
            { id: 101, name: "Al-Qari'ah", startPage: 600, endPage: 600 },
            { id: 102, name: "At-Takatsur", startPage: 600, endPage: 600 },
            { id: 103, name: "Al-'Ashr", startPage: 601, endPage: 601 },
            { id: 104, name: "Al-Humazah", startPage: 601, endPage: 601 },
            { id: 105, name: "Al-Fil", startPage: 601, endPage: 601 },
            { id: 106, name: "Quraisy", startPage: 602, endPage: 602 },
            { id: 107, name: "Al-Ma'un", startPage: 602, endPage: 602 },
            { id: 108, name: "Al-Kautsar", startPage: 602, endPage: 602 },
            { id: 109, name: "Al-Kafirun", startPage: 603, endPage: 603 },
            { id: 110, name: "An-Nashr", startPage: 603, endPage: 603 },
            { id: 111, name: "Al-Lahab", startPage: 603, endPage: 603 },
            { id: 112, name: "Al-Ikhlas", startPage: 604, endPage: 604 },
            { id: 113, name: "Al-Falaq", startPage: 604, endPage: 604 },
            { id: 114, name: "An-Nas", startPage: 604, endPage: 604 }
        ];

        const quranSurahNames = [
            "Al-Fatihah", "Al-Baqarah", "Ali 'Imran", "An-Nisa'", "Al-Ma'idah", "Al-An'am", "Al-A'raf", "Al-Anfal", "At-Taubah", "Yunus",
            "Hud", "Yusuf", "Ar-Ra'd", "Ibrahim", "Al-Hijr", "An-Nahl", "Al-Isra'", "Al-Kahf", "Maryam", "Ta-Ha",
            "Al-Anbiya'", "Al-Hajj", "Al-Mu'minun", "An-Nur", "Al-Furqan", "Asy-Syu'ara'", "An-Naml", "Al-Qashash", "Al-'Ankabut", "Ar-Rum",
            "Luqman", "As-Sajdah", "Al-Ahzab", "Saba'", "Fathir", "Ya-Sin", "Ash-Shaffat", "Shad", "Az-Zumar", "Ghafir",
            "Fushshilat", "Asy-Syura", "Az-Zukhruf", "Ad-Dukhan", "Al-Jatsiyah", "Al-Ahqaf", "Muhammad", "Al-Fath", "Al-Hujurat", "Qaf",
            "Adz-Dzariyat", "Ath-Thur", "An-Najm", "Al-Qamar", "Ar-Rahman", "Al-Waqi'ah", "Al-Hadid", "Al-Mujadilah", "Al-Hasyr", "Al-Mumtahanah",
            "Ash-Shaff", "Al-Jumu'ah", "Al-Munafiqun", "At-Taghabun", "Ath-Thalaq", "At-Tahrim", "Al-Mulk", "Al-Qalam", "Al-Haqqah", "Al-Ma'arij",
            "Nuh", "Al-Jinn", "Al-Muzzammil", "Al-Muddatstsir", "Al-Qiyamah", "Al-Insan", "Al-Mursalat", "An-Naba'", "An-Nazi'at", "'Abasa",
            "At-Takwir", "Al-Infithar", "Al-Muthaffifin", "Al-Insyiqaq", "Al-Buruj", "Ath-Thariq", "Al-A'la", "Al-Ghasyiyah", "Al-Fajr", "Al-Balad",
            "Asy-Syams", "Al-Lail", "Adh-Dhuha", "Asy-Syarh", "At-Tin", "Al-'Alaq", "Al-Qadr", "Al-Bayyinah", "Az-Zalzalah", "Al-'Adiyat",
            "Al-Qari'ah", "At-Takatsur", "Al-'Ashr", "Al-Humazah", "Al-Fil", "Quraisy", "Al-Ma'un", "Al-Kautsar", "Al-Kafirun", "An-Nashr",
            "Al-Lahab", "Al-Ikhlas", "Al-Falaq", "An-Nas"
        ];

        async function fetchQuranList() {
            const container = document.getElementById('quran-list-container');
            if (quranData.length > 0) return renderQuranList(quranData); // Already loaded

            try {
                const response = await fetch('https://equran.id/api/v2/surat');
                const data = await response.json();
                if (data.code === 200) {
                    quranData = data.data;
                    renderQuranList(quranData);
                }
            } catch (error) {
                console.error("Gagal memuat daftar surah:", error);
                container.innerHTML = `<div class="col-span-full text-center py-10 text-red-500">Gagal memuat data. Periksa koneksi internet Anda.</div>`;
            }
        }

        function renderQuranList(list) {
            const container = document.getElementById('quran-list-container');
            if (!container) return;
            container.innerHTML = '';

            if (list.length === 0) {
                container.innerHTML = `<div class="col-span-full text-center py-10 text-slate-500">Surah tidak ditemukan.</div>`;
                return;
            }

            list.forEach(surah => {
                const card = document.createElement('div');
                card.className = "bg-white dark:bg-[#15202d] p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-[#253447] flex items-center justify-between cursor-pointer hover:border-emerald-500 hover:shadow-md transition group";
                card.onclick = () => openQuranDetail(surah.nomor);

                card.innerHTML = `
                    <div class="flex items-center space-x-4">
                        <div class="w-10 h-10 bg-slate-50 dark:bg-[#1c2836] text-slate-600 dark:text-slate-300 rounded-xl flex items-center justify-center font-bold text-sm group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/50 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition relative overflow-hidden shrink-0">
                            <span class="relative z-10">${surah.nomor}</span>
                            <div class="absolute inset-0 bg-emerald-100 dark:bg-emerald-900/40 transform scale-0 group-hover:scale-100 transition-transform duration-300 rounded-xl"></div>
                        </div>
                        <div>
                            <h3 class="font-bold text-slate-800 dark:text-slate-100 text-sm group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition">${surah.namaLatin}</h3>
                            <p class="text-[10px] text-slate-400 dark:text-slate-400 mt-0.5 uppercase tracking-wider">${surah.tempatTurun} • ${surah.jumlahAyat} Ayat</p>
                        </div>
                    </div>
                    <div class="text-right shrink-0">
                        <span class="font-arabic text-xl md:text-2xl text-emerald-700 dark:text-emerald-400">${surah.nama}</span>
                        <p class="text-[9px] text-slate-400 dark:text-slate-400 mt-1">${surah.arti}</p>
                    </div>
                `;
                container.appendChild(card);
            });
        }

        function searchSurah() {
            const query = document.getElementById('quran-search').value.toLowerCase();
            const filtered = quranData.filter(s =>
                s.namaLatin.toLowerCase().includes(query) ||
                s.arti.toLowerCase().includes(query)
            );
            renderQuranList(filtered);
        }

        async function openQuranDetail(nomorSurah) {
            switchTab('quran-detail');
            const titleEl = document.getElementById('quran-detail-title');
            const subTitleEl = document.getElementById('quran-detail-subtitle');
            const bismillahEl = document.getElementById('quran-bismillah-container');
            const container = document.getElementById('quran-ayah-container');
            const audioPlayer = document.getElementById('quran-audio-player');
            const btnPlayAudio = document.getElementById('btn-play-audio');
            const iconPlayAudio = document.getElementById('icon-play-audio');
            const textPlayAudio = document.getElementById('text-play-audio');

            // Reset state
            titleEl.innerText = "Memuat...";
            subTitleEl.innerText = "Sabar, sedang mengambil data...";
            bismillahEl.classList.add('hidden');
            container.innerHTML = `<div class="bg-white dark:bg-[#15202d] p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-[#253447] text-center py-10"><i class="fa-solid fa-spinner fa-spin text-3xl text-emerald-500 mb-3"></i><p class="text-sm text-slate-500 dark:text-slate-400">Memuat ayat...</p></div>`;

            if (currentAudio) {
                currentAudio.pause();
                iconPlayAudio.className = "fa-solid fa-play";
                textPlayAudio.innerText = "Putar Murottal";
            }

            try {
                const response = await fetch(`https://equran.id/api/v2/surat/${nomorSurah}`);
                const data = await response.json();

                if (data.code === 200) {
                    const surah = data.data;
                    titleEl.innerText = surah.namaLatin;
                    subTitleEl.innerText = `${surah.arti} • ${surah.jumlahAyat} Ayat`;

                    // Show Bismillah if not Al-Fatihah or At-Taubah
                    if (nomorSurah !== 1 && nomorSurah !== 9) {
                        bismillahEl.classList.remove('hidden');
                    }

                    // Setup Audio
                    if (surah.audioFull && surah.audioFull['05']) {
                        audioPlayer.src = surah.audioFull['05']; // Mishary Rashid Alafasy
                        currentAudio = audioPlayer;
                        btnPlayAudio.classList.remove('hidden');
                    } else {
                        btnPlayAudio.classList.add('hidden');
                    }

                    // Render Ayah
                    container.innerHTML = '';
                    const latinDisplayClass = isLatinVisible ? "" : "hidden";
                    const transDisplayClass = isTranslationVisible ? "" : "hidden";

                    const textToggleLatin = document.getElementById('text-toggle-latin');
                    if (textToggleLatin) textToggleLatin.innerText = isLatinVisible ? "Sembunyikan Latin" : "Tampilkan Latin";
                    const textSurahBtn = document.getElementById('text-toggle-translation');
                    if (textSurahBtn) textSurahBtn.innerText = isTranslationVisible ? "Sembunyikan Terjemah" : "Tampilkan Terjemah";

                    surah.ayat.forEach(ayat => {
                        const div = document.createElement('div');
                        div.className = "bg-white dark:bg-[#15202d] p-5 md:p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-[#253447] space-y-4 hover:border-emerald-200 dark:hover:border-emerald-500/40 transition";
                        div.innerHTML = `
                            <div class="flex items-start justify-between gap-4">
                                <div class="w-8 h-8 shrink-0 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-full flex items-center justify-center font-bold text-xs border border-emerald-100 dark:border-emerald-800/40">
                                    ${ayat.nomorAyat}
                                </div>
                                <p class="font-arabic text-2xl md:text-3xl text-slate-800 dark:text-slate-100 text-right leading-loose flex-1" style="line-height: 2.5;">
                                    ${ayat.teksArab}
                                </p>
                            </div>
                            <div class="pt-3 border-t border-slate-50 dark:border-slate-800 space-y-2">
                                <p class="latin-text text-emerald-700 dark:text-emerald-400 text-xs md:text-sm italic font-medium leading-relaxed ${latinDisplayClass}">${ayat.teksLatin}</p>
                                <p class="quran-translation text-slate-600 dark:text-slate-300 text-xs md:text-sm leading-relaxed ${transDisplayClass}">${ayat.teksIndonesia}</p>
                            </div>
                        `;
                        container.appendChild(div);
                    });
                }
            } catch (error) {
                console.error("Gagal memuat detail surah:", error);
                container.innerHTML = `<div class="bg-white dark:bg-[#15202d] p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-[#253447] text-center py-10 text-red-500">Gagal memuat data. Periksa koneksi internet Anda.</div>`;
            }
        }

        function toggleLatin() {
            isLatinVisible = !isLatinVisible;

            const latinTexts = document.querySelectorAll('.latin-text');
            latinTexts.forEach(el => {
                if (isLatinVisible) {
                    el.classList.remove('hidden');
                } else {
                    el.classList.add('hidden');
                }
            });

            const textToggleLatin = document.getElementById('text-toggle-latin');
            if (textToggleLatin) {
                textToggleLatin.innerText = isLatinVisible ? "Sembunyikan Latin" : "Tampilkan Latin";
            }
            const textTogglePageLatin = document.getElementById('text-toggle-page-latin');
            if (textTogglePageLatin) {
                textTogglePageLatin.innerText = isLatinVisible ? "Sembunyikan Latin" : "Tampilkan Latin";
            }
        }

        function toggleTranslation() {
            isTranslationVisible = !isTranslationVisible;

            const translationTexts = document.querySelectorAll('.quran-translation');
            translationTexts.forEach(el => {
                if (isTranslationVisible) {
                    el.classList.remove('hidden');
                } else {
                    el.classList.add('hidden');
                }
            });

            const textSurahBtn = document.getElementById('text-toggle-translation');
            if (textSurahBtn) {
                textSurahBtn.innerText = isTranslationVisible ? "Sembunyikan Terjemah" : "Tampilkan Terjemah";
            }
            const textPageBtn = document.getElementById('text-toggle-page-trans');
            if (textPageBtn) {
                textPageBtn.innerText = isTranslationVisible ? "Sembunyikan Terjemah" : "Tampilkan Terjemah";
            }
        }

        function toggleQuranAudio() {
            const iconPlayAudio = document.getElementById('icon-play-audio');
            const textPlayAudio = document.getElementById('text-play-audio');
            if (!currentAudio) return;

            if (currentAudio.paused) {
                currentAudio.play();
                iconPlayAudio.className = "fa-solid fa-pause";
                textPlayAudio.innerText = "Jeda Murottal";
            } else {
                currentAudio.pause();
                iconPlayAudio.className = "fa-solid fa-play";
                textPlayAudio.innerText = "Lanjut Putar";
            }
        }

        // Listener to auto-reset button when audio ends
        document.addEventListener('DOMContentLoaded', () => {
            const player = document.getElementById('quran-audio-player');
            if (player) {
                player.addEventListener('ended', function () {
                    const iconPlay = document.getElementById('icon-play-audio');
                    const textPlay = document.getElementById('text-play-audio');
                    if (iconPlay) iconPlay.className = "fa-solid fa-play";
                    if (textPlay) textPlay.innerText = "Putar Murottal";
                });
            }
        });

        // ==================== QUR'AN POJOK (PER HALAMAN 1 JUZ = 20 HALAMAN) ====================
        function getJuzPageRange(juzNo) {
            const j = parseInt(juzNo, 10);
            if (j === 1) return { start: 1, end: 21, totalPages: 21 };
            if (j === 30) return { start: 582, end: 604, totalPages: 23 };
            const start = (j - 1) * 20 + 2;
            const end = j * 20 + 1;
            return { start, end, totalPages: 20 };
        }

        function getJuzFromPage(pageNo) {
            const p = parseInt(pageNo, 10);
            if (p <= 21) return 1;
            if (p >= 582) return 30;
            return Math.floor((p - 2) / 20) + 1;
        }

        function getKemenagPageImageUrl(pageNo) {
            const p = parseInt(pageNo, 10);
            if (isNaN(p) || p < 1 || p > 604) return '';
            const padded = String(p).padStart(3, '0');
            return `https://media.qurankemenag.net/khat2/QK_${padded}.webp`;
        }

        function getSurahInfoFromPage(pageNo) {
            const p = parseInt(pageNo, 10);
            if (isNaN(p) || p < 1 || p > 604) return '';
            const surahs = QURAN_CHAPTER_PAGES.filter(s => p >= s.startPage && p <= s.endPage);
            if (surahs.length === 0) return '';
            if (surahs.length === 1) return `${surahs[0].id}. ${surahs[0].name}`;
            if (surahs.length === 2) return `${surahs[0].id}. ${surahs[0].name} & ${surahs[1].id}. ${surahs[1].name}`;
            return `${surahs[0].id}. ${surahs[0].name} - ${surahs[surahs.length - 1].name} (${surahs.length} Surah)`;
        }

        function switchQuranIndexSubTab(tabName) {
            currentQuranSubTab = tabName;
            const btnSurah = document.getElementById('tab-btn-quran-surah');
            const btnPojok = document.getElementById('tab-btn-quran-pojok');
            const wrapperSurah = document.getElementById('quran-surah-view-wrapper');
            const wrapperPojok = document.getElementById('quran-pojok-view-wrapper');
            const titleHeader = document.getElementById('quran-index-header-title');

            if (tabName === 'surah') {
                if (btnSurah) btnSurah.className = "flex-1 py-2.5 px-3 rounded-xl font-bold text-xs transition-all duration-200 text-center flex items-center justify-center space-x-1.5 bg-white dark:bg-[#15202d] text-emerald-700 dark:text-emerald-400 shadow-sm";
                if (btnPojok) btnPojok.className = "flex-1 py-2.5 px-3 rounded-xl font-bold text-xs transition-all duration-200 text-center flex items-center justify-center space-x-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100";
                if (wrapperSurah) wrapperSurah.classList.remove('hidden');
                if (wrapperPojok) wrapperPojok.classList.add('hidden');
                if (titleHeader) titleHeader.innerText = "Daftar Surah (1-114)";
            } else {
                if (btnPojok) btnPojok.className = "flex-1 py-2.5 px-3 rounded-xl font-bold text-xs transition-all duration-200 text-center flex items-center justify-center space-x-1.5 bg-white dark:bg-[#15202d] text-emerald-700 dark:text-emerald-400 shadow-sm";
                if (btnSurah) btnSurah.className = "flex-1 py-2.5 px-3 rounded-xl font-bold text-xs transition-all duration-200 text-center flex items-center justify-center space-x-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100";
                if (wrapperSurah) wrapperSurah.classList.add('hidden');
                if (wrapperPojok) wrapperPojok.classList.remove('hidden');
                if (titleHeader) titleHeader.innerText = "Qur'an Pojok (Per Halaman & Juz)";
                initQuranPojok();
            }
        }

        function openQuranPojokIndexTab() {
            switchTab('quran-index');
            switchQuranIndexSubTab('pojok');
        }

        function initQuranPojok() {
            if (quranPojokInitialized) return;
            quranPojokInitialized = true;

            // Render 30 Juz Chips
            const chipsContainer = document.getElementById('quran-juz-chips-container');
            if (chipsContainer) {
                chipsContainer.innerHTML = '';
                for (let j = 1; j <= 30; j++) {
                    const btn = document.createElement('button');
                    btn.type = "button";
                    btn.id = `chip-juz-${j}`;
                    const range = getJuzPageRange(j);
                    btn.className = `px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition active:scale-95 ${j === currentQuranJuz ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-[#1c2836] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#253447]'}`;
                    btn.innerText = `Juz ${j}`;
                    btn.title = `Halaman ${range.start} s/d ${range.end}`;
                    btn.onclick = () => selectQuranPojokJuz(j);
                    chipsContainer.appendChild(btn);
                }
            }

            populateJumpPageSelect();
            selectQuranPojokJuz(currentQuranJuz || 1);
        }

        function populateJumpPageSelect() {
            const selectJump = document.getElementById('select-jump-page');
            if (selectJump && selectJump.options.length <= 1) {
                selectJump.innerHTML = '';
                for (let p = 1; p <= 604; p++) {
                    const opt = document.createElement('option');
                    opt.value = p;
                    const sInfo = getSurahInfoFromPage(p);
                    opt.innerText = `Hal. ${p} — ${sInfo}`;
                    selectJump.appendChild(opt);
                }
            }
        }

        function selectQuranPojokJuz(juzNo) {
            currentQuranJuz = parseInt(juzNo, 10);
            const range = getJuzPageRange(currentQuranJuz);

            // Update chip styles
            for (let j = 1; j <= 30; j++) {
                const btn = document.getElementById(`chip-juz-${j}`);
                if (btn) {
                    if (j === currentQuranJuz) {
                        btn.className = "px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition active:scale-95 bg-emerald-600 text-white shadow-sm";
                    } else {
                        btn.className = "px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition active:scale-95 bg-slate-100 dark:bg-[#1c2836] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#253447]";
                    }
                }
            }

            const labelInfo = document.getElementById('label-selected-juz-info');
            if (labelInfo) {
                labelInfo.innerText = `Juz ${currentQuranJuz} (Hal ${range.start} - ${range.end})`;
            }
            const gridTitle = document.getElementById('juz-page-grid-title');
            if (gridTitle) {
                gridTitle.innerText = `Juz ${currentQuranJuz}`;
            }

            // Render 20 pages in grid
            renderQuranPojokPageGrid(currentQuranJuz);
        }

        function renderQuranPojokPageGrid(juzNo) {
            const container = document.getElementById('quran-pages-grid-container');
            if (!container) return;
            container.innerHTML = '';

            const range = getJuzPageRange(juzNo);
            for (let p = range.start; p <= range.end; p++) {
                const card = document.createElement('div');
                card.className = "p-3 bg-slate-50 dark:bg-[#1c2836] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-100 dark:border-[#253447] hover:border-emerald-500 rounded-xl cursor-pointer transition flex flex-col justify-between space-y-2 group shadow-sm active:scale-95";
                const pageInJuz = p - range.start + 1;
                card.onclick = () => openQuranPage(p);

                card.innerHTML = `
                    <div class="flex items-center justify-between">
                        <span class="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px] shadow-sm">
                            ${pageInJuz}
                        </span>
                        <span class="text-[9px] font-bold text-slate-400 group-hover:text-emerald-600">Ayat Pojok</span>
                    </div>
                    <div>
                        <h5 class="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition">
                            Halaman ${p}
                        </h5>
                        <p class="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Lembar ke-${Math.ceil(pageInJuz / 2)}
                        </p>
                    </div>
                `;
                container.appendChild(card);
            }
        }

        function jumpToQuranPageFromInput() {
            const input = document.getElementById('input-quick-jump-page');
            if (!input || !input.value) return;
            const p = parseInt(input.value, 10);
            if (p >= 1 && p <= 604) {
                openQuranPage(p);
            } else {
                alert("Masukkan nomor halaman antara 1 s/d 604.");
            }
        }

        function jumpToQuranPage(pageNo) {
            const p = parseInt(pageNo, 10);
            if (p >= 1 && p <= 604) {
                openQuranPage(p);
            }
        }

        // ==================== KEMENAG MUSHAF THEME & CONTROLS ====================
        function setMushafTheme(theme) {
            mushafTheme = theme;
            localStorage.setItem('mubarokah_mushaf_theme', theme);
            applyMushafTheme();
        }

        function applyMushafTheme() {
            const wrapper = document.getElementById('quran-mushaf-image-wrapper');
            const img = document.getElementById('quran-mushaf-img');
            const btnWhite = document.getElementById('btn-mushaf-theme-white');
            const btnSepia = document.getElementById('btn-mushaf-theme-sepia');
            const btnDark = document.getElementById('btn-mushaf-theme-dark');

            if (!wrapper || !img) return;

            const isAppDark = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
            const effectiveTheme = (mushafTheme === 'auto') ? (isAppDark ? 'dark' : 'white') : mushafTheme;

            // Reset inline styles
            wrapper.style.backgroundColor = '';
            img.style.backgroundColor = 'transparent';
            img.style.filter = '';
            img.style.transition = 'filter 0.3s ease, transform 0.2s ease-out';

            if (effectiveTheme === 'dark') {
                // Area lembar mushaf tetap mode gelap pekat, tulisan arab otomatis menjadi putih terang
                wrapper.style.backgroundColor = '#070d14';
                img.style.filter = 'invert(1) hue-rotate(180deg) brightness(0.96) contrast(1.12)';
            } else if (effectiveTheme === 'sepia') {
                // Kertas krem klasik teduh
                wrapper.style.backgroundColor = '#fbf7ee';
                img.style.filter = 'sepia(0.28) contrast(1.02)';
            } else {
                // Kertas putih alami (khat hitam pekat)
                wrapper.style.backgroundColor = '#ffffff';
                img.style.filter = 'none';
            }

            // Update Theme Switcher Button UI
            const activeClass = "bg-emerald-600 text-white shadow-xs font-bold";
            const inactiveClass = "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium";

            [
                { el: btnDark, active: effectiveTheme === 'dark' },
                { el: btnWhite, active: effectiveTheme === 'white' },
                { el: btnSepia, active: effectiveTheme === 'sepia' }
            ].forEach(({ el, active }) => {
                if (el) {
                    if (active) {
                        el.className = `px-2 py-0.5 rounded-md text-[10px] transition active:scale-95 flex items-center gap-1 cursor-pointer ${activeClass}`;
                    } else {
                        el.className = `px-2 py-0.5 rounded-md text-[10px] transition active:scale-95 flex items-center gap-1 cursor-pointer ${inactiveClass}`;
                    }
                }
            });
        }

        function zoomMushaf(delta) {
            mushafZoom = Math.min(Math.max(0.6, Math.round((mushafZoom + delta) * 100) / 100), 2.5);
            applyMushafZoom();
        }

        function resetMushafZoom() {
            mushafZoom = 1.0;
            applyMushafZoom();
        }

        function toggleMushafZoomClick() {
            if (mushafZoom > 1.05) {
                resetMushafZoom();
            } else {
                zoomMushaf(0.4);
            }
        }

        function applyMushafZoom() {
            const img = document.getElementById('quran-mushaf-img');
            const label = document.getElementById('mushaf-zoom-level');
            if (img) {
                img.style.transform = `scale(${mushafZoom})`;
                img.classList.remove('cursor-zoom-in', 'cursor-zoom-out');
                img.classList.add(mushafZoom > 1.05 ? 'cursor-zoom-out' : 'cursor-zoom-in');
            }
            if (label) {
                label.innerText = `${Math.round(mushafZoom * 100)}%`;
            }
        }

        function loadMushafPageImage(pageNo) {
            resetMushafZoom();
            applyMushafTheme();
            const img = document.getElementById('quran-mushaf-img');
            const skeleton = document.getElementById('mushaf-img-loading');
            if (!img) return;

            if (skeleton) {
                skeleton.innerHTML = `
                    <i class="fa-solid fa-spinner fa-spin text-3xl text-emerald-500"></i>
                    <span class="text-xs font-semibold text-slate-600 dark:text-slate-300">Memuat Lembar Mushaf Kemenag...</span>
                `;
                skeleton.classList.remove('hidden');
            }
            img.classList.add('hidden');

            const url = getKemenagPageImageUrl(pageNo);
            img.src = url;

            preloadAdjacentPages(pageNo);
        }

        function onMushafImageLoaded() {
            const img = document.getElementById('quran-mushaf-img');
            const skeleton = document.getElementById('mushaf-img-loading');
            if (skeleton) skeleton.classList.add('hidden');
            if (img) img.classList.remove('hidden');
            applyMushafTheme();
        }

        function onMushafImageError() {
            const img = document.getElementById('quran-mushaf-img');
            const skeleton = document.getElementById('mushaf-img-loading');
            if (skeleton) {
                skeleton.classList.remove('hidden');
                skeleton.innerHTML = `
                    <div class="text-center p-4 space-y-2">
                        <i class="fa-solid fa-triangle-exclamation text-amber-500 text-2xl"></i>
                        <p class="text-xs text-slate-600 dark:text-slate-300">Gagal memuat gambar Mushaf halaman ${currentQuranPage}.</p>
                        <button type="button" onclick="loadMushafPageImage(${currentQuranPage})" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm active:scale-95">Coba Lagi</button>
                    </div>
                `;
            }
            if (img) img.classList.add('hidden');
        }

        function preloadAdjacentPages(pageNo) {
            const p = parseInt(pageNo, 10);
            if (p < 604) {
                const nextImg = new Image();
                nextImg.src = getKemenagPageImageUrl(p + 1);
            }
            if (p > 1) {
                const prevImg = new Image();
                prevImg.src = getKemenagPageImageUrl(p - 1);
            }
        }

        function switchQuranPageViewMode(mode) {
            quranPageViewMode = mode;
            const btnMushaf = document.getElementById('btn-mode-mushaf');
            const btnText = document.getElementById('btn-mode-text');
            const mushafContainer = document.getElementById('quran-mushaf-view-container');
            const textControls = document.getElementById('quran-text-controls-bar');
            const textContainer = document.getElementById('quran-page-ayah-container');
            const badge = document.getElementById('quran-page-badge');

            if (mode === 'mushaf') {
                if (btnMushaf) {
                    btnMushaf.className = "flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg font-bold text-xs bg-emerald-600 text-white shadow-sm transition active:scale-95 flex items-center justify-center space-x-1.5";
                }
                if (btnText) {
                    btnText.className = "flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg font-bold text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition active:scale-95 flex items-center justify-center space-x-1.5";
                }
                if (mushafContainer) mushafContainer.classList.remove('hidden');
                if (textControls) textControls.classList.add('hidden');
                if (textContainer) textContainer.classList.add('hidden');
                if (badge) badge.innerText = "Mushaf Kemenag RI";
            } else {
                if (btnText) {
                    btnText.className = "flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg font-bold text-xs bg-emerald-600 text-white shadow-sm transition active:scale-95 flex items-center justify-center space-x-1.5";
                }
                if (btnMushaf) {
                    btnMushaf.className = "flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg font-bold text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition active:scale-95 flex items-center justify-center space-x-1.5";
                }
                if (mushafContainer) mushafContainer.classList.add('hidden');
                if (textControls) textControls.classList.remove('hidden');
                if (textControls) textControls.classList.add('flex');
                if (textContainer) textContainer.classList.remove('hidden');
                if (badge) badge.innerText = "Teks & Audio Digital";

                // Muat teks ayat jika belum dimuat
                loadQuranPageText(currentQuranPage);
            }
        }

        async function openQuranPage(pageNo) {
            let p = parseInt(pageNo, 10);
            if (isNaN(p) || p < 1) p = 1;
            if (p > 604) p = 604;
            currentQuranPage = p;
            currentQuranJuz = getJuzFromPage(p);

            switchTab('quran-page');
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // Update UI elements
            const titleEl = document.getElementById('quran-page-title');
            if (titleEl) titleEl.innerText = `Halaman ${p} dari 604`;

            const juzInfoEl = document.getElementById('quran-page-juz-info');
            if (juzInfoEl) juzInfoEl.innerText = `Juz ${currentQuranJuz}`;

            const footerNumEl = document.getElementById('footer-current-page-num');
            if (footerNumEl) footerNumEl.innerText = `Hal. ${p}`;

            populateJumpPageSelect();
            const selectJump = document.getElementById('select-jump-page');
            if (selectJump) selectJump.value = p;

            const btnPrev = document.getElementById('btn-page-prev');
            const btnNext = document.getElementById('btn-page-next');
            if (btnPrev) btnPrev.disabled = (p <= 1);
            if (btnNext) btnNext.disabled = (p >= 604);

            // Update 3-Pill Header Kemenag
            const pillJuz = document.getElementById('mushaf-pill-juz');
            if (pillJuz) pillJuz.innerText = `JUZ ${currentQuranJuz}`;

            const pillPage = document.getElementById('mushaf-pill-page');
            if (pillPage) pillPage.innerText = `${p}`;

            const surahInfoText = getSurahInfoFromPage(p);
            const pillSurah = document.getElementById('mushaf-pill-surah');
            if (pillSurah) pillSurah.innerText = surahInfoText || `Halaman ${p}`;

            const surahInfoEl = document.getElementById('quran-page-surah-info');
            if (surahInfoEl) surahInfoEl.innerText = surahInfoText || `Halaman ${p}`;

            // Reset page audio button
            resetQuranPageAudio();

            // Muat gambar mushaf Kemenag RI
            loadMushafPageImage(p);

            // Sinkronkan tombol toggle latin & terjemah di halaman Quran Pojok
            const textPageLatin = document.getElementById('text-toggle-page-latin');
            if (textPageLatin) textPageLatin.innerText = isLatinVisible ? "Sembunyikan Latin" : "Tampilkan Latin";
            const textPageTrans = document.getElementById('text-toggle-page-trans');
            if (textPageTrans) textPageTrans.innerText = isTranslationVisible ? "Sembunyikan Terjemah" : "Tampilkan Terjemah";

            // Jika sedang di mode teks, muat teks ayat
            if (quranPageViewMode === 'text') {
                loadQuranPageText(p);
            }
        }

        async function loadQuranPageText(p) {
            const container = document.getElementById('quran-page-ayah-container');
            if (!container) return;

            // Check cache
            if (quranPageCache[p]) {
                renderQuranPageAyahs(quranPageCache[p]);
                return;
            }

            container.innerHTML = `
                <div class="bg-white dark:bg-[#15202d] p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-[#253447] text-center space-y-2">
                    <i class="fa-solid fa-spinner fa-spin text-3xl text-emerald-500 mb-2"></i>
                    <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">Memuat Teks Halaman ${p}...</p>
                    <p class="text-xs text-slate-400">Rasm Utsmani & Terjemah Kemenag RI</p>
                </div>
            `;

            try {
                const response = await fetch(`https://api.quran.com/api/v4/verses/by_page/${p}?words=false&translations=33&fields=text_uthmani,chapter_id,verse_number`);
                const data = await response.json();
                if (data && data.verses) {
                    quranPageCache[p] = data.verses;
                    renderQuranPageAyahs(data.verses);
                } else {
                    container.innerHTML = `<div class="p-8 text-center text-red-500">Gagal memuat data ayat halaman ${p}.</div>`;
                }
            } catch (err) {
                console.error("Gagal memuat halaman Qur'an Pojok:", err);
                container.innerHTML = `
                    <div class="bg-white dark:bg-[#15202d] p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-[#253447] text-center space-y-3">
                        <i class="fa-solid fa-triangle-exclamation text-amber-500 text-3xl"></i>
                        <p class="text-sm text-slate-700 dark:text-slate-300">Gagal memuat ayat halaman ${p}. Periksa koneksi internet Anda.</p>
                        <button type="button" onclick="loadQuranPageText(${p})" class="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm active:scale-95">Coba Lagi</button>
                    </div>
                `;
            }
        }

        function renderQuranPageAyahs(verses) {
            const container = document.getElementById('quran-page-ayah-container');
            if (!container) return;
            container.innerHTML = '';

            // Detect chapters in this page
            const chaptersInPage = [...new Set(verses.map(v => v.chapter_id))];
            const surahNamesList = chaptersInPage.map(cId => {
                return (quranSurahNames[cId - 1]) ? `Surat ${quranSurahNames[cId - 1]}` : `Surat ke-${cId}`;
            }).join(', ');

            const surahInfoEl = document.getElementById('quran-page-surah-info');
            if (surahInfoEl) {
                surahInfoEl.innerText = surahNamesList;
            }

            const textTogglePageLatin = document.getElementById('text-toggle-page-latin');
            if (textTogglePageLatin) textTogglePageLatin.innerText = isLatinVisible ? "Sembunyikan Latin" : "Tampilkan Latin";
            const textPageBtn = document.getElementById('text-toggle-page-trans');
            if (textPageBtn) textPageBtn.innerText = isTranslationVisible ? "Sembunyikan Terjemah" : "Tampilkan Terjemah";

            let currentSurahOnPage = null;

            verses.forEach(v => {
                // If this is the first verse of a surah on this page, or beginning of surah
                if (v.verse_number === 1 || v.chapter_id !== currentSurahOnPage) {
                    currentSurahOnPage = v.chapter_id;
                    const surahName = quranSurahNames[currentSurahOnPage - 1] || `Surat ke-${currentSurahOnPage}`;

                    // Surah header banner
                    const surahHeader = document.createElement('div');
                    surahHeader.className = "p-3.5 bg-gradient-to-r from-emerald-600/10 via-teal-600/5 to-transparent dark:from-emerald-950/40 dark:to-transparent bg-white dark:bg-[#15202d] rounded-2xl border border-emerald-500/30 text-center my-2 shadow-sm";
                    surahHeader.innerHTML = `
                        <span class="text-[9px] font-extrabold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Surat ke-${currentSurahOnPage}</span>
                        <h3 class="font-extrabold text-sm md:text-base text-slate-900 dark:text-slate-100">${surahName}</h3>
                    `;
                    container.appendChild(surahHeader);

                    // Bismillah (kecuali Al-Fatihah dan At-Taubah)
                    if (v.chapter_id !== 1 && v.chapter_id !== 9 && v.verse_number === 1) {
                        const bismillah = document.createElement('div');
                        bismillah.className = "p-3 bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-500/20 rounded-2xl text-center my-2";
                        bismillah.innerHTML = `
                            <p class="font-arabic text-xl md:text-2xl text-emerald-950 dark:text-emerald-200" dir="rtl">
                                بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ
                            </p>
                        `;
                        container.appendChild(bismillah);
                    }
                }

                // Render Card Ayat
                const div = document.createElement('div');
                div.className = "bg-white dark:bg-[#15202d] p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-[#253447] space-y-3 hover:border-emerald-500/40 transition";

                const transText = (v.translations && v.translations[0]) ? v.translations[0].text : '';
                const transClass = isTranslationVisible ? '' : 'hidden';

                div.innerHTML = `
                    <div class="flex items-start justify-between gap-3">
                        <span class="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-extrabold text-[11px] shrink-0">
                            ${v.verse_number}
                        </span>
                        <p class="font-arabic text-xl sm:text-2xl md:text-3xl text-slate-900 dark:text-slate-100 text-right leading-loose flex-1" style="line-height: 2.3;" dir="rtl">
                            ${v.text_uthmani} <span class="text-emerald-600 dark:text-emerald-400 text-lg">۝${toArabicNumerals(v.verse_number)}</span>
                        </p>
                    </div>
                    ${transText ? `
                    <div class="quran-translation pt-2 border-t border-slate-100 dark:border-[#253447] ${transClass}">
                        <p class="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                            ${transText}
                        </p>
                    </div>` : ''}
                `;
                container.appendChild(div);
            });
        }

        function toArabicNumerals(num) {
            const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
            return num.toString().split('').map(d => arabicDigits[d] || d).join('');
        }

        function navigateQuranPage(direction) {
            const next = currentQuranPage + direction;
            if (next >= 1 && next <= 604) {
                openQuranPage(next);
            }
        }

        async function toggleQuranPageAudio() {
            const audioPlayer = document.getElementById('quran-page-audio-player');
            const iconElem = document.getElementById('icon-play-page-audio');
            const textElem = document.getElementById('text-play-page-audio');
            if (!audioPlayer) return;

            if (pageAudioPlaying && !audioPlayer.paused) {
                audioPlayer.pause();
                resetQuranPageAudio();
                return;
            }

            try {
                if (iconElem) iconElem.className = "fa-solid fa-spinner fa-spin text-xs";
                if (textElem) textElem.innerText = "Memuat...";

                // Fetch page recitations from quran.com
                const resp = await fetch(`https://api.quran.com/api/v4/recitations/7/by_page/${currentQuranPage}`);
                const data = await resp.json();
                if (data && data.audio_files && data.audio_files.length > 0) {
                    let audioIdx = 0;
                    const audioFiles = data.audio_files;

                    const playNextAyah = () => {
                        if (audioIdx >= audioFiles.length) {
                            resetQuranPageAudio();
                            return;
                        }
                        const file = audioFiles[audioIdx];
                        audioPlayer.src = `https://verses.quran.com/${file.url}`;
                        audioPlayer.play().then(() => {
                            pageAudioPlaying = true;
                            if (iconElem) iconElem.className = "fa-solid fa-pause text-xs";
                            if (textElem) textElem.innerText = `Ayat ${audioIdx + 1}/${audioFiles.length}`;
                        }).catch(e => {
                            console.warn("Audio play error:", e);
                            resetQuranPageAudio();
                        });
                        audioPlayer.onended = () => {
                            audioIdx++;
                            playNextAyah();
                        };
                    };

                    playNextAyah();
                } else {
                    resetQuranPageAudio();
                }
            } catch (e) {
                console.error("Audio error:", e);
                resetQuranPageAudio();
            }
        }

        function resetQuranPageAudio() {
            pageAudioPlaying = false;
            const audioPlayer = document.getElementById('quran-page-audio-player');
            if (audioPlayer && !audioPlayer.paused) {
                audioPlayer.pause();
            }
            const iconElem = document.getElementById('icon-play-page-audio');
            const textElem = document.getElementById('text-play-page-audio');
            if (iconElem) iconElem.className = "fa-solid fa-play text-xs";
            if (textElem) textElem.innerText = "Putar Murottal";
        }

        // ==================== MAULID FEATURE ====================
        function renderMaulidIndex() {
            const container = document.getElementById('maulid-list-container');
            if (!container) return;
            container.innerHTML = '';

            maulidDibai.forEach(chapter => {
                const card = document.createElement('div');
                card.className = "bg-white dark:bg-[#15202d] p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-[#253447] flex items-center justify-between cursor-pointer hover:border-purple-500 hover:shadow-md transition group";
                card.onclick = () => openMaulidDetail(chapter.id);

                card.innerHTML = `
                    <div class="flex items-center space-x-4">
                        <div class="w-10 h-10 bg-slate-50 dark:bg-[#1c2836] text-slate-600 dark:text-slate-300 rounded-xl flex items-center justify-center font-bold text-sm group-hover:bg-purple-50 dark:group-hover:bg-purple-950/40 group-hover:text-purple-700 dark:group-hover:text-purple-300 transition relative overflow-hidden shrink-0">
                            <span class="relative z-10">${chapter.id}</span>
                            <div class="absolute inset-0 bg-purple-100 dark:bg-purple-900/40 transform scale-0 group-hover:scale-100 transition-transform duration-300 rounded-xl"></div>
                        </div>
                        <div>
                            <h3 class="font-bold text-slate-800 dark:text-slate-100 text-sm group-hover:text-purple-700 dark:group-hover:text-purple-400 transition">${chapter.title}</h3>
                        </div>
                    </div>
                    <div class="text-right shrink-0">
                        <i class="fa-solid fa-chevron-right text-slate-400 dark:text-slate-400 group-hover:text-purple-500 transition"></i>
                    </div>
                `;
                container.appendChild(card);
            });
        }

        function openMaulidDetail(id) {
            const chapter = maulidDibai.find(c => c.id === id);
            if (!chapter) return;

            document.getElementById('maulid-detail-title').innerText = chapter.title;
            const container = document.getElementById('maulid-ayah-container');
            container.innerHTML = '';

            chapter.content.forEach((text) => {
                const div = document.createElement('div');
                div.className = "bg-white dark:bg-[#15202d] p-5 md:p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-[#253447] space-y-4 hover:border-purple-200 dark:hover:border-purple-500/40 transition";
                div.innerHTML = `
                    <div class="flex items-start justify-between gap-4">
                        <p class="font-arabic text-2xl md:text-3xl text-slate-800 dark:text-slate-100 text-center md:text-right leading-loose flex-1 w-full" style="line-height: 2.5;" dir="rtl">
                            ${text}
                        </p>
                    </div>
                `;
                container.appendChild(div);
            });

            switchTab('maulid-detail');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // ==================== QASIDAH BURDAH CONTROLLER ====================
        let currentBurdahBabId = 1;
        let burdahShowLatin = false;
        let burdahShowTranslation = false;

        function openBurdahIndex() {
            renderBurdahIndex();
            switchTab('burdah-index');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function renderBurdahIndex() {
            const container = document.getElementById('burdah-list-container');
            if (!container || typeof qasidahBurdah === 'undefined') return;

            container.innerHTML = '';
            qasidahBurdah.forEach(bab => {
                const card = document.createElement('div');
                card.className = "bg-white dark:bg-[#15202d] p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-[#253447] flex items-center justify-between cursor-pointer hover:border-emerald-500 hover:shadow-md transition-all duration-200 group";
                card.onclick = () => openBurdahDetail(bab.id);

                card.innerHTML = `
                    <div class="flex items-center space-x-3.5 min-w-0">
                        <div class="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-xl flex items-center justify-center font-extrabold text-sm group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-200 shrink-0">
                            <span>${bab.id}</span>
                        </div>
                        <div class="min-w-0 space-y-0.5">
                            <h4 class="font-bold text-slate-800 dark:text-slate-100 text-sm group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition truncate">
                                ${bab.title}
                            </h4>
                            <p class="text-[11px] font-arabic text-slate-400 dark:text-slate-400 truncate" dir="rtl">
                                ${bab.arabicTitle}
                            </p>
                        </div>
                    </div>
                    <div class="w-8 h-8 rounded-lg bg-slate-50 dark:bg-[#1c2836] text-slate-400 dark:text-slate-500 group-hover:bg-emerald-50 group-hover:text-emerald-600 dark:group-hover:bg-emerald-950/40 dark:group-hover:text-emerald-400 flex items-center justify-center transition shrink-0 ml-2">
                        <i class="fa-solid fa-chevron-right text-xs"></i>
                    </div>
                `;
                container.appendChild(card);
            });
        }

        function openBurdahDetail(id) {
            if (typeof qasidahBurdah === 'undefined') return;
            const bab = qasidahBurdah.find(b => b.id === id);
            if (!bab) return;

            currentBurdahBabId = bab.id;

            // Set judul
            const titleElem = document.getElementById('burdah-detail-title');
            const subtitleElem = document.getElementById('burdah-detail-subtitle');
            if (titleElem) titleElem.innerText = bab.title;
            if (subtitleElem) subtitleElem.innerText = bab.arabicTitle;

            // Set Refrain
            const refrainBox = document.getElementById('burdah-refrain-container');
            if (refrainBox && bab.refrain) {
                refrainBox.innerHTML = `
                    <span class="inline-block px-3 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold uppercase tracking-wider shadow-sm">
                        Bait Pembuka (Reff)
                    </span>
                    <p class="font-arabic text-xl sm:text-2xl md:text-3xl text-emerald-950 dark:text-emerald-100 leading-loose" dir="rtl">
                        ${bab.refrain.arabic}
                    </p>
                    <p class="burdah-latin text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-400 ${burdahShowLatin ? '' : 'hidden'}">
                        ${bab.refrain.latin}
                    </p>
                    <p class="burdah-translation text-xs text-slate-600 dark:text-slate-300 max-w-xl mx-auto italic ${burdahShowTranslation ? '' : 'hidden'}">
                        "${bab.refrain.translation}"
                    </p>
                `;
            }

            // Render bait-bait
            const container = document.getElementById('burdah-verses-container');
            if (!container) return;
            container.innerHTML = '';

            bab.verses.forEach(v => {
                const div = document.createElement('div');
                div.className = "bg-white dark:bg-[#15202d] p-4 sm:p-5 md:p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-[#253447] space-y-3 hover:border-emerald-500/40 transition";
                div.innerHTML = `
                    <div class="flex items-center justify-between border-b border-slate-100 dark:border-[#253447] pb-2 text-xs">
                        <span class="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-extrabold text-[11px]">
                            ${v.no}
                        </span>
                        <span class="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Bait ke-${v.no}</span>
                    </div>
                    <p class="font-arabic text-xl sm:text-2xl md:text-3xl text-slate-900 dark:text-slate-100 text-right leading-loose w-full" style="line-height: 2.2;" dir="rtl">
                        ${v.arabic}
                    </p>
                    <p class="burdah-latin text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-400 leading-relaxed ${burdahShowLatin ? '' : 'hidden'}">
                        ${v.latin}
                    </p>
                    <p class="burdah-translation text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed ${burdahShowTranslation ? '' : 'hidden'}">
                        ${v.translation}
                    </p>
                `;
                container.appendChild(div);
            });

            // Update tombol navigasi
            const btnPrev = document.getElementById('btn-burdah-prev');
            const btnNext = document.getElementById('btn-burdah-next');
            if (btnPrev) btnPrev.disabled = (currentBurdahBabId <= 1);
            if (btnNext) btnNext.disabled = (currentBurdahBabId >= qasidahBurdah.length);

            const textBurdahLatin = document.getElementById('text-toggle-burdah-latin');
            if (textBurdahLatin) textBurdahLatin.innerText = burdahShowLatin ? "Sembunyikan Latin" : "Tampilkan Latin";
            const textBurdahTrans = document.getElementById('text-toggle-burdah-translation');
            if (textBurdahTrans) textBurdahTrans.innerText = burdahShowTranslation ? "Sembunyikan Terjemah" : "Tampilkan Terjemah";

            switchTab('burdah-detail');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function toggleBurdahLatin() {
            burdahShowLatin = !burdahShowLatin;
            const textElem = document.getElementById('text-toggle-burdah-latin');
            if (textElem) {
                textElem.innerText = burdahShowLatin ? "Sembunyikan Latin" : "Tampilkan Latin";
            }
            const latins = document.querySelectorAll('.burdah-latin');
            latins.forEach(el => {
                if (burdahShowLatin) {
                    el.classList.remove('hidden');
                } else {
                    el.classList.add('hidden');
                }
            });
        }

        function toggleBurdahTranslation() {
            burdahShowTranslation = !burdahShowTranslation;
            const textElem = document.getElementById('text-toggle-burdah-translation');
            if (textElem) {
                textElem.innerText = burdahShowTranslation ? "Sembunyikan Terjemah" : "Tampilkan Terjemah";
            }
            const translations = document.querySelectorAll('.burdah-translation');
            translations.forEach(el => {
                if (burdahShowTranslation) {
                    el.classList.remove('hidden');
                } else {
                    el.classList.add('hidden');
                }
            });
        }

        function navigateBurdahBab(direction) {
            if (typeof qasidahBurdah === 'undefined') return;
            const nextBabId = currentBurdahBabId + direction;
            if (nextBabId >= 1 && nextBabId <= qasidahBurdah.length) {
                openBurdahDetail(nextBabId);
            }
        }

        // ==================== FITUR TAHLIL & SURAT YASIN (QURAN NU ONLINE) ====================
        let currentTahlilYasinSubTab = 'tahlil';
        let tahlilShowLatin = false;
        let tahlilShowTranslation = false;
        let yasinAudioPlaying = false;

        function openTahlilYasinPage(subTab = 'tahlil') {
            switchTab('tahlil-yasin');
            switchTahlilYasinSubTab(subTab);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function switchTahlilYasinSubTab(tabName) {
            currentTahlilYasinSubTab = tabName;

            // Pause audio jika beralih dari Yasin
            const audioPlayer = document.getElementById('tahlil-yasin-audio-player');
            const audioWrapper = document.getElementById('yasin-audio-control-wrapper');
            if (tabName !== 'yasin') {
                if (audioPlayer && !audioPlayer.paused) {
                    audioPlayer.pause();
                }
                resetYasinAudioButton();
                if (audioWrapper) {
                    audioWrapper.classList.add('hidden');
                    audioWrapper.classList.remove('flex');
                }
            } else {
                if (audioWrapper) {
                    audioWrapper.classList.remove('hidden');
                    audioWrapper.classList.add('flex');
                }
            }

            // Update Segmented Pill Tabs UI
            const tabs = ['tahlil', 'yasin', 'doa'];
            tabs.forEach(t => {
                const btn = document.getElementById(`tab-btn-${t}`);
                if (btn) {
                    if (t === tabName) {
                        btn.className = "flex-1 py-2.5 px-3 rounded-xl font-bold text-xs transition-all duration-200 text-center flex items-center justify-center space-x-1.5 bg-white dark:bg-[#15202d] text-emerald-700 dark:text-emerald-400 shadow-sm";
                    } else {
                        btn.className = "flex-1 py-2.5 px-3 rounded-xl font-bold text-xs transition-all duration-200 text-center flex items-center justify-center space-x-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100";
                    }
                }
            });

            // Update Header Title & Badge
            const titleElem = document.getElementById('tahlil-yasin-page-title');
            const badgeElem = document.getElementById('tahlil-yasin-badge');

            const textTahlilLatin = document.getElementById('text-toggle-tahlil-latin');
            if (textTahlilLatin) textTahlilLatin.innerText = tahlilShowLatin ? "Sembunyikan Latin" : "Tampilkan Latin";
            const textTahlilTrans = document.getElementById('text-toggle-tahlil-trans');
            if (textTahlilTrans) textTahlilTrans.innerText = tahlilShowTranslation ? "Sembunyikan Terjemah" : "Tampilkan Terjemah";

            if (tabName === 'tahlil') {
                if (titleElem) titleElem.innerText = "Susunan Tahlil Lengkap";
                if (badgeElem) {
                    badgeElem.innerText = "Amaliah NU";
                    badgeElem.className = "text-[10px] font-extrabold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 px-2.5 py-0.5 rounded-full uppercase tracking-wider";
                }
                renderTahlilContent();
            } else if (tabName === 'yasin') {
                if (titleElem) titleElem.innerText = "Surat Yasin (83 Ayat)";
                if (badgeElem) {
                    badgeElem.innerText = "Makkiyah • 83 Ayat";
                    badgeElem.className = "text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-2.5 py-0.5 rounded-full uppercase tracking-wider";
                }
                renderYasinContent();
            } else if (tabName === 'doa') {
                if (titleElem) titleElem.innerText = "Doa Tahlil & Arwah";
                if (badgeElem) {
                    badgeElem.innerText = "Doa & Munajat";
                    badgeElem.className = "text-[10px] font-extrabold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 px-2.5 py-0.5 rounded-full uppercase tracking-wider";
                }
                renderDoaTahlilContent();
            }
        }

        function renderTahlilContent() {
            const container = document.getElementById('tahlil-yasin-content-container');
            if (!container) return;
            if (typeof dataTahlil === 'undefined') {
                container.innerHTML = `<div class="p-8 text-center text-slate-400">Data Tahlil sedang dimuat...</div>`;
                return;
            }

            container.innerHTML = '';

            // Banner Pengantar Tahlil
            const introDiv = document.createElement('div');
            introDiv.className = "p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent dark:from-blue-950/40 dark:to-transparent bg-white dark:bg-[#15202d] border border-blue-500/20 dark:border-blue-500/30 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3";
            introDiv.innerHTML = `
                <div class="space-y-1">
                    <h3 class="font-extrabold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <i class="fa-solid fa-hands-holding text-blue-600"></i> Susunan Bacaan Tahlil Nahdlatul Ulama
                    </h3>
                    <p class="text-xs text-slate-500 dark:text-slate-400">
                        Dimulai dari hadhrah fatihah, surat-surat pendek, tahlil inti, istighfar, shalawat, hingga doa arwah.
                    </p>
                </div>
                <button type="button" onclick="switchTahlilYasinSubTab('yasin')"
                    class="shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition active:scale-95 flex items-center space-x-1.5">
                    <i class="fa-solid fa-book-open"></i>
                    <span>Baca Surat Yasin Dulu</span>
                </button>
            `;
            container.appendChild(introDiv);

            let hasShownDoaHeader = false;
            dataTahlil.forEach((item, index) => {
                // Header pemisah khusus sebelum masuk Doa Tahlil
                if (item.isDoa && !hasShownDoaHeader) {
                    hasShownDoaHeader = true;
                    const doaHeader = document.createElement('div');
                    doaHeader.className = "pt-4 pb-2";
                    doaHeader.innerHTML = `
                        <div class="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-500/30 rounded-2xl flex items-center justify-between">
                            <div class="flex items-center space-x-2.5">
                                <div class="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                                    <i class="fa-solid fa-hands-praying"></i>
                                </div>
                                <div>
                                    <h4 class="font-extrabold text-xs sm:text-sm text-amber-900 dark:text-amber-200">DOA TAHLIL / DOA ARWAH</h4>
                                    <p class="text-[11px] text-amber-700 dark:text-amber-400">Rangkaian doa penutup pengiriman pahala untuk almarhum / almarhumah</p>
                                </div>
                            </div>
                        </div>
                    `;
                    container.appendChild(doaHeader);
                }

                const card = document.createElement('div');
                card.className = "bg-white dark:bg-[#15202d] p-4 sm:p-5 md:p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-[#253447] space-y-3 hover:border-emerald-500/40 transition";

                let badgeText = `Bacaan ke-${index + 1}`;
                if (index === 0) {
                    badgeText = "Hadhrah Fatihah";
                } else if (item.isDoa) {
                    badgeText = `Doa Tahlil • Bagian ${item.no - 21}`;
                }

                card.innerHTML = `
                    <div class="flex items-center justify-between border-b border-slate-100 dark:border-[#253447] pb-2 text-xs">
                        <span class="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center font-extrabold text-[11px]">
                            ${index + 1}
                        </span>
                        <span class="text-[10px] text-slate-400 dark:text-slate-500 font-medium">${badgeText}</span>
                    </div>
                    <p class="font-arabic text-xl sm:text-2xl md:text-3xl text-slate-900 dark:text-slate-100 text-right leading-loose w-full" style="line-height: 2.2;" dir="rtl">
                        ${item.arabic}
                    </p>
                    <p class="tahlil-latin text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-400 leading-relaxed ${tahlilShowLatin ? '' : 'hidden'}">
                        ${item.latin}
                    </p>
                    <p class="tahlil-translation text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed ${tahlilShowTranslation ? '' : 'hidden'}">
                        ${item.translation}
                    </p>
                `;
                container.appendChild(card);
            });
        }

        function renderYasinContent() {
            const container = document.getElementById('tahlil-yasin-content-container');
            if (!container) return;
            if (typeof dataYasin === 'undefined' || !dataYasin.ayahs) {
                container.innerHTML = `<div class="p-8 text-center text-slate-400">Data Surat Yasin sedang dimuat...</div>`;
                return;
            }

            container.innerHTML = '';

            // Banner Info Surah Yasin
            const banner = document.createElement('div');
            banner.className = "p-5 rounded-2xl bg-gradient-to-r from-emerald-600/10 via-teal-600/5 to-transparent dark:from-emerald-950/50 dark:to-transparent bg-white dark:bg-[#15202d] border border-emerald-500/20 dark:border-emerald-500/40 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4";
            banner.innerHTML = `
                <div class="space-y-1">
                    <div class="flex items-center space-x-2">
                        <span class="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white font-extrabold text-[10px] uppercase tracking-wider">
                            Surat ke-36
                        </span>
                        <span class="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                            ${dataYasin.type} • ${dataYasin.totalAyah} Ayat
                        </span>
                    </div>
                    <h3 class="font-extrabold text-base md:text-lg text-slate-900 dark:text-slate-100">
                        Surat Yasin (سورة يٰس)
                    </h3>
                    <p class="text-xs text-slate-500 dark:text-slate-400">
                        Jantung Al-Qur'an (Qalbul Qur'an), dibaca saat amaliah malam Jumat, ziarah kubur, tahlilan, dan hajat.
                    </p>
                </div>
                <div class="font-arabic text-3xl md:text-4xl text-emerald-800 dark:text-emerald-200 font-bold" dir="rtl">
                    يس
                </div>
            `;
            container.appendChild(banner);

            // Banner Basmalah Pembuka
            const basmalahCard = document.createElement('div');
            basmalahCard.className = "p-4 sm:p-5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border-2 border-emerald-500/30 dark:border-emerald-500/40 text-center space-y-2 shadow-sm";
            basmalahCard.innerHTML = `
                <p class="font-arabic text-2xl sm:text-3xl text-emerald-950 dark:text-emerald-100 leading-loose" dir="rtl">
                    بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ
                </p>
                <p class="tahlil-latin text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-400 ${tahlilShowLatin ? '' : 'hidden'}">
                    Bismillâhir-raḫmânir-raḫîm
                </p>
                <p class="tahlil-translation text-xs text-slate-600 dark:text-slate-300 max-w-md mx-auto italic ${tahlilShowTranslation ? '' : 'hidden'}">
                    "Dengan menyebut nama Allah Yang Maha Pengasih lagi Maha Penyayang."
                </p>
            `;
            container.appendChild(basmalahCard);

            // Loop 83 ayat Yasin
            dataYasin.ayahs.forEach(ayah => {
                const card = document.createElement('div');
                card.className = "bg-white dark:bg-[#15202d] p-4 sm:p-5 md:p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-[#253447] space-y-3 hover:border-emerald-500/40 transition";
                card.id = `yasin-ayah-${ayah.no}`;
                card.innerHTML = `
                    <div class="flex items-center justify-between border-b border-slate-100 dark:border-[#253447] pb-2 text-xs">
                        <span class="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-extrabold text-[11px]">
                            ${ayah.no}
                        </span>
                        <span class="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Ayat ${ayah.no}</span>
                    </div>
                    <p class="font-arabic text-xl sm:text-2xl md:text-3xl text-slate-900 dark:text-slate-100 text-right leading-loose w-full" style="line-height: 2.2;" dir="rtl">
                        ${ayah.arabic}
                    </p>
                    <p class="tahlil-latin text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-400 leading-relaxed ${tahlilShowLatin ? '' : 'hidden'}">
                        ${ayah.latin}
                    </p>
                    <p class="tahlil-translation text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed ${tahlilShowTranslation ? '' : 'hidden'}">
                        ${ayah.translation}
                    </p>
                `;
                container.appendChild(card);
            });
        }

        function renderDoaTahlilContent() {
            const container = document.getElementById('tahlil-yasin-content-container');
            if (!container) return;
            if (typeof dataTahlil === 'undefined') {
                container.innerHTML = `<div class="p-8 text-center text-slate-400">Data Doa Tahlil sedang dimuat...</div>`;
                return;
            }

            container.innerHTML = '';

            // Banner Pengantar Doa Arwah
            const banner = document.createElement('div');
            banner.className = "p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-600/5 to-transparent dark:from-amber-950/40 dark:to-transparent bg-white dark:bg-[#15202d] border border-amber-500/20 dark:border-amber-500/40 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4";
            banner.innerHTML = `
                <div class="space-y-1">
                    <div class="flex items-center space-x-2">
                        <span class="px-2.5 py-0.5 rounded-full bg-amber-600 text-white font-extrabold text-[10px] uppercase tracking-wider">
                            Doa Khusus Arwah
                        </span>
                        <span class="text-xs font-semibold text-amber-700 dark:text-amber-400">
                            Tradisi Pesantren Nahdlatul Ulama
                        </span>
                    </div>
                    <h3 class="font-extrabold text-base md:text-lg text-slate-900 dark:text-slate-100">
                        Doa Tahlil & Pengiriman Pahala Arwah
                    </h3>
                    <p class="text-xs text-slate-500 dark:text-slate-400">
                        Dipanjatkan untuk memohon ampunan, rahmat, dan kelapangan kubur bagi segenap almarhum/almarhumah, orang tua, dan para masyayikh.
                    </p>
                </div>
                <div class="font-arabic text-2xl md:text-3xl text-amber-800 dark:text-amber-200 font-bold" dir="rtl">
                    دعاء التّهليل
                </div>
            `;
            container.appendChild(banner);

            const doaItems = dataTahlil.filter(item => item.isDoa);
            doaItems.forEach((item, idx) => {
                const card = document.createElement('div');
                card.className = "bg-white dark:bg-[#15202d] p-4 sm:p-5 md:p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-[#253447] space-y-3 hover:border-amber-500/40 transition";
                card.innerHTML = `
                    <div class="flex items-center justify-between border-b border-slate-100 dark:border-[#253447] pb-2 text-xs">
                        <span class="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center font-extrabold text-[11px]">
                            ${idx + 1}
                        </span>
                        <span class="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Bagian ${idx + 1}</span>
                    </div>
                    <p class="font-arabic text-xl sm:text-2xl md:text-3xl text-slate-900 dark:text-slate-100 text-right leading-loose w-full" style="line-height: 2.2;" dir="rtl">
                        ${item.arabic}
                    </p>
                    <p class="tahlil-latin text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-400 leading-relaxed ${tahlilShowLatin ? '' : 'hidden'}">
                        ${item.latin}
                    </p>
                    <p class="tahlil-translation text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed ${tahlilShowTranslation ? '' : 'hidden'}">
                        ${item.translation}
                    </p>
                `;
                container.appendChild(card);
            });
        }

        function toggleTahlilLatin() {
            tahlilShowLatin = !tahlilShowLatin;
            const textElem = document.getElementById('text-toggle-tahlil-latin');
            if (textElem) {
                textElem.innerText = tahlilShowLatin ? "Sembunyikan Latin" : "Tampilkan Latin";
            }
            const latins = document.querySelectorAll('.tahlil-latin');
            latins.forEach(el => {
                if (tahlilShowLatin) {
                    el.classList.remove('hidden');
                } else {
                    el.classList.add('hidden');
                }
            });
        }

        function toggleTahlilTranslation() {
            tahlilShowTranslation = !tahlilShowTranslation;
            const textElem = document.getElementById('text-toggle-tahlil-trans');
            if (textElem) {
                textElem.innerText = tahlilShowTranslation ? "Sembunyikan Terjemah" : "Tampilkan Terjemah";
            }
            const translations = document.querySelectorAll('.tahlil-translation');
            translations.forEach(el => {
                if (tahlilShowTranslation) {
                    el.classList.remove('hidden');
                } else {
                    el.classList.add('hidden');
                }
            });
        }

        function toggleYasinAudio() {
            const audioPlayer = document.getElementById('tahlil-yasin-audio-player');
            const playBtn = document.getElementById('btn-play-yasin-audio');
            const iconElem = document.getElementById('icon-play-yasin-audio');
            const textElem = document.getElementById('text-play-yasin-audio');
            if (!audioPlayer || typeof dataYasin === 'undefined') return;

            if (!audioPlayer.src || audioPlayer.src === '' || !audioPlayer.src.includes('.mp3')) {
                audioPlayer.src = dataYasin.audioUrl;
            }

            if (audioPlayer.paused) {
                audioPlayer.play().then(() => {
                    yasinAudioPlaying = true;
                    if (iconElem) {
                        iconElem.className = "fa-solid fa-pause text-xs";
                    }
                    if (textElem) {
                        textElem.innerText = "Jeda Murottal";
                    }
                    if (playBtn) {
                        playBtn.className = "flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition active:scale-95 animate-pulse";
                    }
                }).catch(err => {
                    console.warn("Audio play error:", err);
                });
            } else {
                audioPlayer.pause();
                resetYasinAudioButton();
            }

            audioPlayer.onended = () => {
                resetYasinAudioButton();
            };
            audioPlayer.onerror = () => {
                resetYasinAudioButton();
            };
        }

        function resetYasinAudioButton() {
            yasinAudioPlaying = false;
            const playBtn = document.getElementById('btn-play-yasin-audio');
            const iconElem = document.getElementById('icon-play-yasin-audio');
            const textElem = document.getElementById('text-play-yasin-audio');
            if (iconElem) {
                iconElem.className = "fa-solid fa-play text-xs";
            }
            if (textElem) {
                textElem.innerText = "Putar Murottal";
            }
            if (playBtn) {
                playBtn.className = "flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition active:scale-95";
            }
        }

        // ==================== KEYBOARD NAVIGATION & TOUCH SWIPE UNTUK MUSHAF ====================
        document.addEventListener('keydown', (e) => {
            const pageQuran = document.getElementById('page-quran-page');
            if (!pageQuran || pageQuran.classList.contains('hidden')) return;

            // Jangan picu navigasi keyboard jika user sedang mengetik di input atau dropdown
            if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

            if (e.key === 'ArrowLeft') {
                navigateQuranPage(1); // Panah Kiri = Lembar Selanjutnya (arah RTL Mushaf)
            } else if (e.key === 'ArrowRight') {
                navigateQuranPage(-1); // Panah Kanan = Lembar Sebelumnya (arah RTL Mushaf)
            }
        });

        // Touch Swipe Gesture pada lembar Mushaf Kemenag
        document.addEventListener('DOMContentLoaded', () => {
            const wrapper = document.getElementById('quran-mushaf-image-wrapper');
            if (wrapper) {
                let touchStartX = 0;
                let touchStartY = 0;

                wrapper.addEventListener('touchstart', (e) => {
                    if (e.touches && e.touches.length === 1) {
                        touchStartX = e.touches[0].clientX;
                        touchStartY = e.touches[0].clientY;
                    }
                }, { passive: true });

                wrapper.addEventListener('touchend', (e) => {
                    if (mushafZoom > 1.05) return; // jangan ubah halaman saat sedang diperbesar/zoom
                    if (!e.changedTouches || e.changedTouches.length === 0) return;
                    const diffX = e.changedTouches[0].clientX - touchStartX;
                    const diffY = e.changedTouches[0].clientY - touchStartY;

                    // Swipe horizontal terdeteksi jika pergerakan horizontal dominan dan minimal 50px
                    if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
                        if (diffX < 0) {
                            navigateQuranPage(1); // Geser ke kiri -> Halaman Selanjutnya
                        } else {
                            navigateQuranPage(-1); // Geser ke kanan -> Halaman Sebelumnya
                        }
                    }
                }, { passive: true });
            }
        });

        // Export fungsi ke window object agar selalu aman dipanggil dari inline HTML
        window.openQuranPage = openQuranPage;
        window.loadQuranPageText = loadQuranPageText;
        window.loadMushafPageImage = loadMushafPageImage;
        window.onMushafImageLoaded = onMushafImageLoaded;
        window.onMushafImageError = onMushafImageError;
        window.switchQuranPageViewMode = switchQuranPageViewMode;
        window.zoomMushaf = zoomMushaf;
        window.resetMushafZoom = resetMushafZoom;
        window.toggleMushafZoomClick = toggleMushafZoomClick;
        window.navigateQuranPage = navigateQuranPage;
        window.jumpToQuranPage = jumpToQuranPage;
        window.jumpToQuranPageFromInput = jumpToQuranPageFromInput;
        window.toggleQuranPageAudio = toggleQuranPageAudio;
        window.resetQuranPageAudio = resetQuranPageAudio;
        window.openQuranPojokIndexTab = openQuranPojokIndexTab;
        window.switchQuranIndexSubTab = switchQuranIndexSubTab;
        window.selectQuranPojokJuz = selectQuranPojokJuz;
        window.getKemenagPageImageUrl = getKemenagPageImageUrl;
        window.getSurahInfoFromPage = getSurahInfoFromPage;
        window.populateJumpPageSelect = populateJumpPageSelect;
        window.setMushafTheme = setMushafTheme;
        window.applyMushafTheme = applyMushafTheme;

        // Expose state properties to window for direct inspection/debugging
        try {
            Object.defineProperty(window, 'mushafZoom', {
                get: () => mushafZoom,
                set: (v) => { mushafZoom = v; applyMushafZoom(); }
            });
            Object.defineProperty(window, 'mushafTheme', {
                get: () => mushafTheme,
                set: (v) => { setMushafTheme(v); }
            });
            Object.defineProperty(window, 'quranPageViewMode', {
                get: () => quranPageViewMode,
                set: (v) => { switchQuranPageViewMode(v); }
            });
        } catch (e) {
            // ignore if not supported
        }