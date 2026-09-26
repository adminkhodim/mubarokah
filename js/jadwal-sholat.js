/**
 * ====================================================================
 * JADWAL SHOLAT & IMSAKIYAH ENGINE (v1.0)
 * Standar Lembaga Falakiyah Pengurus Besar Nahdlatul Ulama (LF PBNU)
 * Mengadopsi Fitur & Formula dari https://jadwalsholat.nu.or.id/
 */

const ASNJadwalSholat = (function () {
    // 1. DATABASE KOORDINAT KOTA (DEFAULT: KAB. DEMAK)
    const CITIES = {
        demak: {
            name: "Kab. Demak",
            province: "Jawa Tengah",
            lat: -6.9535,
            lng: 110.6402,
            tz: 7,
            tzName: "WIB"
        },
        semarang: {
            name: "Kota Semarang",
            province: "Jawa Tengah",
            lat: -6.9667,
            lng: 110.4167,
            tz: 7,
            tzName: "WIB"
        },
        kudus: {
            name: "Kab. Kudus",
            province: "Jawa Tengah",
            lat: -6.8048,
            lng: 110.8405,
            tz: 7,
            tzName: "WIB"
        },
        jepara: {
            name: "Kab. Jepara",
            province: "Jawa Tengah",
            lat: -6.5936,
            lng: 110.6783,
            tz: 7,
            tzName: "WIB"
        },
        surakarta: {
            name: "Kota Surakarta (Solo)",
            province: "Jawa Tengah",
            lat: -7.5755,
            lng: 110.8243,
            tz: 7,
            tzName: "WIB"
        },
        surabaya: {
            name: "Kota Surabaya",
            province: "Jawa Timur",
            lat: -7.2575,
            lng: 112.7521,
            tz: 7,
            tzName: "WIB"
        },
        jakarta: {
            name: "DKI Jakarta",
            province: "DKI Jakarta",
            lat: -6.2088,
            lng: 106.8456,
            tz: 7,
            tzName: "WIB"
        },
        bandung: {
            name: "Kota Bandung",
            province: "Jawa Barat",
            lat: -6.9175,
            lng: 107.6191,
            tz: 7,
            tzName: "WIB"
        },
        yogyakarta: {
            name: "DI Yogyakarta",
            province: "DI Yogyakarta",
            lat: -7.7956,
            lng: 110.3695,
            tz: 7,
            tzName: "WIB"
        },
        makassar: {
            name: "Kota Makassar",
            province: "Sulawesi Selatan",
            lat: -5.1477,
            lng: 119.4327,
            tz: 8,
            tzName: "WITA"
        },
        medan: {
            name: "Kota Medan",
            province: "Sumatera Utara",
            lat: 3.5952,
            lng: 98.6722,
            tz: 7,
            tzName: "WIB"
        }
    };

    // State Aplikasi
    const PRAYER_CITY_KEY = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.storage && APP_CONFIG.storage.keys)
        ? APP_CONFIG.storage.keys.prayerCity
        : "mubarokah_prayer_city";
    let currentCityKey = localStorage.getItem(PRAYER_CITY_KEY) || "demak";
    if (!CITIES[currentCityKey]) currentCityKey = "demak";

    let viewDate = new Date();
    let monthlyYear = viewDate.getFullYear();
    let monthlyMonth = viewDate.getMonth(); // 0-indexed
    let liveTimer = null;

    // Nama Bulan Hijriyah
    const HIJRI_MONTHS = [
        "Muharram", "Safar", "Rabi'ul Awwal", "Rabi'ul Akhir",
        "Jumadil Ula", "Jumadil Akhir", "Rajab", "Sya'ban",
        "Ramadhan", "Syawwal", "Dzulqa'dah", "Dzulhijjah"
    ];

    // ----------------------------------------------------------------
    // 2. ENGINE HISAB FALAKIYAH NU (ASTRONOMICAL SOLAR CALCULATION)
    // ----------------------------------------------------------------
    const D2R = Math.PI / 180;
    const R2D = 180 / Math.PI;

    function sinD(d) { return Math.sin(d * D2R); }
    function cosD(d) { return Math.cos(d * D2R); }
    function tanD(d) { return Math.tan(d * D2R); }
    function asinD(x) { return Math.asin(x) * R2D; }
    function acosD(x) { return Math.acos(x) * R2D; }
    function atanD(x) { return Math.atan(x) * R2D; }

    function fixAngle(a) {
        a = a - 360.0 * Math.floor(a / 360.0);
        return a < 0 ? a + 360.0 : a;
    }

    function fixHour(h) {
        h = h - 24.0 * Math.floor(h / 24.0);
        return h < 0 ? h + 24.0 : h;
    }

    // Julian Date dari kalender Gregorian
    function julianDate(year, month, day) {
        if (month <= 2) {
            year -= 1;
            month += 12;
        }
        const A = Math.floor(year / 100);
        const B = 2 - A + Math.floor(A / 4);
        return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
    }

    // Posisi Matahari (Deklinasi & Equation of Time)
    function getSunPosition(jd) {
        const D = jd - 2451545.0;
        const g = fixAngle(357.529 + 0.98560028 * D);
        const q = fixAngle(280.459 + 0.98564736 * D);
        const L = fixAngle(q + 1.915 * sinD(g) + 0.020 * sinD(2 * g));

        const e = 23.439 - 0.00000036 * D; // kemiringan ekliptika
        const d = asinD(sinD(e) * sinD(L)); // deklinasi matahari
        let RA = atanD(cosD(e) * sinD(L) / cosD(L)) / 15.0; // asensio rekta
        if (cosD(L) < 0) RA += 12;
        else if (cosD(e) * sinD(L) < 0) RA += 24;

        const EqT = q / 15.0 - fixHour(RA); // Persamaan Waktu (Equation of Time dalam jam)
        return { declination: d, equationOfTime: EqT };
    }

    /**
     * Hitung Waktu Sholat untuk Suatu Hari Tertentu
     * Parameter Falakiyah NU:
     * - Subuh: 20 derajat
     * - Isya: 18 derajat
     * - Ashar: Bayangan 1x (Syafi'i)
     * - Ihtiyat: +2 menit (Subuh, Zuhur, Ashar, Maghrib, Isya)
     * - Imsak: -10 menit sebelum Subuh
     * - Dhuha: Matahari naik 4.5 derajat
     */
    function calculateDay(date, city) {
        const y = date.getFullYear();
        const m = date.getMonth() + 1;
        const d = date.getDate();

        const jd = julianDate(y, m, d);
        const sun = getSunPosition(jd);

        const lat = city.lat;
        const lng = city.lng;
        const tz = city.tz;

        // Waktu Tengah Hari (Zawal / Meridian Transit)
        const noon = fixHour(12 + tz - lng / 15.0 - sun.equationOfTime);

        // Sudut jam (Hour Angle) untuk sudut matahari tertentu (h0)
        function hourAngle(h0) {
            const cosHA = (sinD(h0) - sinD(lat) * sinD(sun.declination)) / (cosD(lat) * cosD(sun.declination));
            if (cosHA > 1 || cosHA < -1) return null; // Matahari tidak pernah mencapai ketinggian ini
            return acosD(cosHA) / 15.0;
        }

        // 1. Subuh: -20 derajat
        const haFajr = hourAngle(-20.0);
        const fajrBase = haFajr !== null ? noon - haFajr : noon - 1.5;

        // 2. Terbit (Sunrise): -0.833 derajat (refraksi 34' + semi-diameter 16')
        const haSunrise = hourAngle(-0.833);
        const sunriseBase = haSunrise !== null ? noon - haSunrise : noon - 1.0;

        // 3. Dhuha: Ketinggian +4.5 derajat
        const haDhuha = hourAngle(4.5);
        const dhuhaBase = haDhuha !== null ? noon - haDhuha : sunriseBase + 0.35;

        // 4. Zuhur: Meridian transit
        const dhuhrBase = noon;

        // 5. Ashar (Syafi'i): bayangan = 1 + tan|lat - dec|
        const diffLatDec = Math.abs(lat - sun.declination);
        const asrAltitude = acosD((sinD(90 - diffLatDec) + 1.0) !== 0 ? (1 / (1 + tanD(diffLatDec))) : 0.5) || 35.0;
        // Rumus tinggi matahari Ashar: arccot(1 + tan|phi - delta|)
        const altAshar = atanD(1.0 / (1.0 + tanD(diffLatDec)));
        const haAsr = hourAngle(altAshar);
        const asrBase = haAsr !== null ? noon + haAsr : noon + 3.0;

        // 6. Maghrib (Sunset): -0.833 derajat
        const haSunset = hourAngle(-0.833);
        const sunsetBase = haSunset !== null ? noon + haSunset : noon + 6.0;

        // 7. Isya': -18 derajat
        const haIsha = hourAngle(-18.0);
        const ishaBase = haIsha !== null ? noon + haIsha : noon + 7.2;

        // Konversi jam pecahan ke Menit + Koreksi Ihtiyat (+2 menit standar Kemenag & Falakiyah NU)
        function formatWithIhtiyat(baseHours, ihtiyatMinutes = 2) {
            const totalMinutes = Math.round(baseHours * 60) + ihtiyatMinutes;
            const h = Math.floor(fixHour(totalMinutes / 60));
            const min = totalMinutes % 60;
            return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
        }

        const subuhStr = formatWithIhtiyat(fajrBase, 2);
        const terbitStr = formatWithIhtiyat(sunriseBase, 0); // Terbit tanpa ihtiyat tambah (agar akurat)
        const dhuhaStr = formatWithIhtiyat(dhuhaBase, 2);
        const zuhurStr = formatWithIhtiyat(dhuhrBase, 2);
        const asharStr = formatWithIhtiyat(asrBase, 2);
        const maghribStr = formatWithIhtiyat(sunsetBase, 2);
        const isyaStr = formatWithIhtiyat(ishaBase, 2);

        // Imsak: 10 menit sebelum Subuh
        const [subH, subM] = subuhStr.split(':').map(Number);
        let imsakTotalMin = (subH * 60 + subM) - 10;
        if (imsakTotalMin < 0) imsakTotalMin += 1440;
        const imsakH = Math.floor(imsakTotalMin / 60);
        const imsakM = imsakTotalMin % 60;
        const imsakStr = `${String(imsakH).padStart(2, '0')}:${String(imsakM).padStart(2, '0')}`;

        // Konversi Penanggalan Hijriyah
        const hijri = gregorianToHijri(y, m, d);

        return {
            date: date,
            dateString: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
            dayName: ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][date.getDay()],
            pasaran: typeof getPasaranJawa === 'function' ? getPasaranJawa(date) : "",
            masehiDay: d,
            masehiMonth: m,
            masehiYear: y,
            hijri: hijri,
            times: {
                imsak: imsakStr,
                subuh: subuhStr,
                terbit: terbitStr,
                dhuha: dhuhaStr,
                zuhur: zuhurStr,
                ashar: asharStr,
                maghrib: maghribStr,
                isya: isyaStr
            },
            tzName: city.tzName
        };
    }

    // ----------------------------------------------------------------
    // 3. KONVERSI PENANGGALAN HIJRIYAH (STANDAR UMMUL QURA / FALAKIYAH)
    // ----------------------------------------------------------------
    function gregorianToHijri(year, month, day) {
        let m = month;
        let y = year;
        if (m < 3) {
            y -= 1;
            m += 12;
        }
        let a = Math.floor(y / 100);
        let b = 2 - a + Math.floor(a / 4);
        let jd = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524;

        // Julian Day to Hijri (Koreksi +1 untuk sinkronisasi hisab rukyat rukyah Indonesia)
        let l = jd - 1948440 + 10632 + 1;
        let n = Math.floor((l - 1) / 10631);
        l = l - 10631 * n + 354;
        let j = (Math.floor((10985 - l) / 5316)) * (Math.floor((50 * l) / 17719)) + (Math.floor(l / 5670)) * (Math.floor((43 * l) / 15238));
        l = l - (Math.floor((30 - j) / 15)) * (Math.floor((17719 * j) / 50)) - (Math.floor(j / 16)) * (Math.floor((15238 * j) / 43)) + 29;
        let hijriMonth = Math.floor((24 * l) / 709);
        let hijriDay = l - Math.floor((709 * hijriMonth) / 24);
        let hijriYear = 30 * n + j - 30;

        return {
            day: hijriDay,
            month: hijriMonth,
            monthName: HIJRI_MONTHS[hijriMonth - 1] || "Hijriyah",
            year: hijriYear,
            formatted: `${hijriDay} ${HIJRI_MONTHS[hijriMonth - 1] || ''} ${hijriYear} H`
        };
    }

    // ----------------------------------------------------------------
    // 4. HITUNG REALTIME SHOLAT TERDEKAT & COUNTDOWN
    // ----------------------------------------------------------------
    function getNextPrayerInfo(daySchedule) {
        const now = new Date();
        const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

        // 8 Waktu urut
        const prayerList = [
            { key: "imsak", name: "Imsak", time: daySchedule.times.imsak, icon: "fa-mug-hot" },
            { key: "subuh", name: "Subuh", time: daySchedule.times.subuh, icon: "fa-cloud-sun" },
            { key: "terbit", name: "Terbit", time: daySchedule.times.terbit, icon: "fa-sun" },
            { key: "dhuha", name: "Dhuha", time: daySchedule.times.dhuha, icon: "fa-sun-plant-wilt" },
            { key: "zuhur", name: "Zuhur", time: daySchedule.times.zuhur, icon: "fa-sun" },
            { key: "ashar", name: "Ashar", time: daySchedule.times.ashar, icon: "fa-cloud-sun" },
            { key: "maghrib", name: "Maghrib", time: daySchedule.times.maghrib, icon: "fa-cloud-moon" },
            { key: "isya", name: "Isya'", time: daySchedule.times.isya, icon: "fa-moon" }
        ];

        let activePrayer = prayerList[prayerList.length - 1]; // default malam: Isya
        let nextPrayer = prayerList[0];
        let targetSec = 0;

        for (let i = 0; i < prayerList.length; i++) {
            const [h, m] = prayerList[i].time.split(':').map(Number);
            const pSec = h * 3600 + m * 60;

            if (nowSec >= pSec) {
                activePrayer = prayerList[i];
            } else {
                nextPrayer = prayerList[i];
                targetSec = pSec;
                break;
            }
        }

        // Jika sudah lewat Isya, target berikutnya adalah Imsak besok
        if (targetSec === 0) {
            nextPrayer = prayerList[0];
            const [h, m] = prayerList[0].time.split(':').map(Number);
            targetSec = 24 * 3600 + h * 3600 + m * 60;
        }

        const diffSec = targetSec - nowSec;
        const hrs = Math.floor(diffSec / 3600);
        const mins = Math.floor((diffSec % 3600) / 60);
        const secs = diffSec % 60;
        const countdownStr = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

        return {
            activePrayer,
            nextPrayer,
            countdown: countdownStr,
            diffSeconds: diffSec
        };
    }

    // ----------------------------------------------------------------
    // 5. RENDER UI UTAMA
    // ----------------------------------------------------------------
    function initJadwalSholat() {
        populateCitySelector();
        renderView();

        // Interval Countdown Live (1 detik)
        if (liveTimer) clearInterval(liveTimer);
        liveTimer = setInterval(() => {
            updateCountdownLive();
        }, 1000);
    }

    function populateCitySelector() {
        const selectEl = document.getElementById('sholat-city-select');
        const settingsSelectEl = document.getElementById('prayer-city-select');

        const optionsHtml = Object.entries(CITIES).map(([k, c]) => {
            return `<option value="${k}" ${k === currentCityKey ? 'selected' : ''}>${c.name}</option>`;
        }).join('');

        if (selectEl) {
            selectEl.innerHTML = optionsHtml;
            selectEl.value = currentCityKey;
        }
        if (settingsSelectEl) {
            settingsSelectEl.innerHTML = optionsHtml;
            settingsSelectEl.value = currentCityKey;
        }

        renderSettingsPreview();
    }

    function renderSettingsPreview() {
        const city = CITIES[currentCityKey] || CITIES.demak;
        const sched = calculateDay(new Date(), city);
        if (!sched || !sched.times) return;

        const subuhEl = document.getElementById('settings-preview-subuh');
        const zuhurEl = document.getElementById('settings-preview-zuhur');
        const asharEl = document.getElementById('settings-preview-ashar');
        const maghribEl = document.getElementById('settings-preview-maghrib');
        const isyaEl = document.getElementById('settings-preview-isya');

        if (subuhEl) subuhEl.innerText = sched.times.subuh;
        if (zuhurEl) zuhurEl.innerText = sched.times.zuhur;
        if (asharEl) asharEl.innerText = sched.times.ashar;
        if (maghribEl) maghribEl.innerText = sched.times.maghrib;
        if (isyaEl) isyaEl.innerText = sched.times.isya;
    }

    function renderView() {
        const city = CITIES[currentCityKey] || CITIES.demak;
        const todaySchedule = calculateDay(viewDate, city);

        // 1. Update Info Lokasi & Waktu
        const locBadge = document.getElementById('sholat-header-location');
        if (locBadge) locBadge.innerText = `📍 ${city.name}`;

        // 2. Update Tanggal Masehi & Hijriyah
        const masehiEl = document.getElementById('sholat-date-masehi');
        const hijriEl = document.getElementById('sholat-date-hijri');
        if (masehiEl) {
            masehiEl.innerText = `${todaySchedule.dayName} ${todaySchedule.pasaran ? todaySchedule.pasaran + ',' : ''} ${todaySchedule.masehiDay} ${namaBulanIndo[todaySchedule.masehiMonth - 1]} ${todaySchedule.masehiYear}`;
        }
        if (hijriEl) {
            hijriEl.innerText = todaySchedule.hijri.formatted;
        }

        // 3. Update Grid 8 Waktu Sholat
        renderCards8Times(todaySchedule);

        // 4. Update Countdown Live
        updateCountdownLive();

        // 5. Render Tabel Bulanan
        renderMonthlyTable();
    }

    function renderCards8Times(sched) {
        const grid = document.getElementById('sholat-cards-grid');
        if (!grid) return;

        const nextInfo = getNextPrayerInfo(sched);

        const cardDefs = [
            { key: "imsak", name: "Imsak", time: sched.times.imsak, icon: "fa-mug-hot", bgIcon: "text-amber-500/20" },
            { key: "subuh", name: "Subuh", time: sched.times.subuh, icon: "fa-cloud-sun", bgIcon: "text-blue-500/20" },
            { key: "terbit", name: "Terbit", time: sched.times.terbit, icon: "fa-sun", bgIcon: "text-orange-500/20" },
            { key: "dhuha", name: "Dhuha", time: sched.times.dhuha, icon: "fa-sun-plant-wilt", bgIcon: "text-amber-400/20" },
            { key: "zuhur", name: "Zuhur", time: sched.times.zuhur, icon: "fa-sun", bgIcon: "text-yellow-500/20" },
            { key: "ashar", name: "Ashar", time: sched.times.ashar, icon: "fa-cloud-sun", bgIcon: "text-emerald-500/20" },
            { key: "maghrib", name: "Maghrib", time: sched.times.maghrib, icon: "fa-cloud-moon", bgIcon: "text-rose-500/20" },
            { key: "isya", name: "Isya'", time: sched.times.isya, icon: "fa-moon", bgIcon: "text-indigo-500/20" }
        ];

        grid.innerHTML = cardDefs.map(c => {
            const isNext = (c.key === nextInfo.nextPrayer.key);
            const isActive = (c.key === nextInfo.activePrayer.key);

            let cardClasses = "relative p-2.5 sm:p-3.5 rounded-xl md:rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden ";
            if (isNext) {
                // Highlight waktu berikutnya (warna khas hijau emerald NU yang elegan tanpa scale over)
                cardClasses += "bg-gradient-to-br from-emerald-600 to-brand-800 text-white shadow-md border-emerald-500 ring-2 ring-emerald-400/40";
            } else if (isActive) {
                cardClasses += "bg-emerald-50/80 dark:bg-[#1c2836] border-emerald-300 dark:border-emerald-600/50 text-slate-800 dark:text-slate-100";
            } else {
                cardClasses += "bg-white dark:bg-[#15202d] border-slate-100 dark:border-[#253447] text-slate-700 dark:text-slate-300 hover:border-slate-200 dark:hover:border-slate-600";
            }

            const timeColor = isNext ? "text-amber-300" : "text-brand-800 dark:text-emerald-400";
            const badgeTag = isNext ? `<span class="text-[8px] md:text-[9px] bg-amber-400 text-brand-dark px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider">Aktif</span>` : "";

            return `
                <div class="${cardClasses}">
                    <div class="flex justify-between items-start">
                        <span class="text-xs sm:text-sm font-bold ${isNext ? 'text-white' : 'text-slate-600 dark:text-slate-300'}">${c.name}</span>
                        ${badgeTag}
                    </div>
                    <div class="mt-1 sm:mt-2 flex items-baseline justify-between">
                        <span class="text-base sm:text-lg md:text-xl font-black tracking-tight ${timeColor}">
                            ${c.time} <span class="text-[9px] font-semibold opacity-70">${sched.tzName}</span>
                        </span>
                        <i class="fa-solid ${c.icon} text-sm sm:text-base opacity-40"></i>
                    </div>
                </div>
            `;
        }).join('');
    }

    function updateCountdownLive() {
        const city = CITIES[currentCityKey] || CITIES.demak;
        const todaySchedule = calculateDay(viewDate, city);
        const nextInfo = getNextPrayerInfo(todaySchedule);

        // Update di Card Submenu Jadwal Sholat
        const nextNameEl = document.getElementById('sholat-next-name');
        const nextTimeEl = document.getElementById('sholat-next-time');
        const countdownEl = document.getElementById('sholat-next-countdown');

        if (nextNameEl) nextNameEl.innerText = nextInfo.nextPrayer.name;
        if (nextTimeEl) nextTimeEl.innerText = `${nextInfo.nextPrayer.time} ${todaySchedule.tzName}`;
        if (countdownEl) countdownEl.innerText = nextInfo.countdown;

        // Sinkronisasi otomatis ke Widget Beranda (Mobile & Desktop)
        const cleanCityName = (city.name || '').replace(/\s*\(Default\)/gi, '');
        const locString = `${cleanCityName}${city.province ? ', ' + city.province : ''}`;

        // 1. Lokasi (Kiri Baris 1)
        ['home-prayer-location', 'home-prayer-location-desktop'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerText = locString;
        });

        // 2. Hari (Kiri Baris 2)
        ['home-current-day', 'home-current-day-desktop'].forEach(id => {
            const el = document.getElementById(id);
            if (el && todaySchedule) {
                const pasaran = todaySchedule.pasaran ? ` ${todaySchedule.pasaran}` : '';
                el.innerText = `${todaySchedule.dayName}${pasaran}`;
            }
        });

        // 3. Waktu Shalat Terdekat (Kanan Baris 1)
        ['home-next-prayer-name', 'home-next-prayer-name-desktop'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = `${nextInfo.nextPrayer.name} <span class="text-amber-300 font-normal ml-1">${nextInfo.nextPrayer.time} ${todaySchedule.tzName}</span>`;
        });

        // 4. Countdown Waktu Shalat (Kanan Baris 2)
        ['home-prayer-countdown', 'home-prayer-countdown-desktop'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerText = nextInfo.countdown;
        });

        // 5. Tanggal Masehi (Baris 3 Kiri)
        const masehiStr = `${todaySchedule.masehiDay} ${namaBulanIndo[todaySchedule.masehiMonth - 1]} ${todaySchedule.masehiYear}`;
        ['home-date-masehi', 'home-date-masehi-desktop'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const valEl = el.querySelector('.home-date-masehi-val');
                if (valEl) valEl.innerText = masehiStr;
                else el.innerText = masehiStr;
            }
        });

        // 6. Tanggal Hijriyah (Baris 3 Kanan)
        const hijriStr = todaySchedule.hijri ? todaySchedule.hijri.formatted : '';
        ['home-date-hijri', 'home-date-hijri-desktop'].forEach(id => {
            const el = document.getElementById(id);
            if (el && hijriStr) {
                const valEl = el.querySelector('.home-date-hijri-val');
                if (valEl) valEl.innerText = hijriStr;
                else el.innerText = hijriStr;
            }
        });

        // Fallback untuk home-current-date
        ['home-current-date', 'home-current-date-desktop'].forEach(id => {
            const el = document.getElementById(id);
            if (el && todaySchedule) {
                const hari = todaySchedule.dayName;
                const pasaran = todaySchedule.pasaran ? ` ${todaySchedule.pasaran},` : ',';
                el.innerText = `${hari}${pasaran} ${masehiStr}`;
            }
        });
    }

    // ----------------------------------------------------------------
    // 6. TABEL KALENDER BULANAN (1 BULAN PENUH)
    // ----------------------------------------------------------------
    function renderMonthlyTable() {
        const city = CITIES[currentCityKey] || CITIES.demak;
        const tbody = document.getElementById('sholat-monthly-tbody');
        const titleEl = document.getElementById('sholat-monthly-title');
        const hijriSpanEl = document.getElementById('sholat-monthly-hijri-span');
        if (!tbody) return;

        const totalDays = new Date(monthlyYear, monthlyMonth + 1, 0).getDate();
        const monthName = namaBulanIndo[monthlyMonth];

        // Hitung estimasi bulan Hijriyah pada awal dan akhir bulan
        const hijriStart = gregorianToHijri(monthlyYear, monthlyMonth + 1, 1);
        const hijriEnd = gregorianToHijri(monthlyYear, monthlyMonth + 1, totalDays);

        if (titleEl) {
            titleEl.innerText = `${monthName} ${monthlyYear}`;
        }
        if (hijriSpanEl) {
            hijriSpanEl.innerText = (hijriStart.monthName === hijriEnd.monthName)
                ? `${hijriStart.monthName} ${hijriStart.year} H`
                : `${hijriStart.monthName} – ${hijriEnd.monthName} ${hijriEnd.year} H`;
        }

        const todayObj = new Date();
        const isCurrentMonth = (todayObj.getFullYear() === monthlyYear && todayObj.getMonth() === monthlyMonth);
        const todayDateNum = todayObj.getDate();

        let rowsHtml = '';
        for (let day = 1; day <= totalDays; day++) {
            const dateObj = new Date(monthlyYear, monthlyMonth, day);
            const sched = calculateDay(dateObj, city);
            const isToday = isCurrentMonth && (day === todayDateNum);

            const rowClass = isToday
                ? "bg-emerald-100/70 dark:bg-emerald-950/60 font-bold border-l-4 border-emerald-600 text-slate-900 dark:text-emerald-200"
                : "hover:bg-slate-50 dark:hover:bg-[#1c2836] text-slate-700 dark:text-slate-300";

            rowsHtml += `
                <tr class="border-b border-slate-100 dark:border-[#253447] text-[11px] md:text-xs transition ${rowClass}">
                    <td class="py-2.5 px-3 whitespace-nowrap">
                        <span class="font-semibold">${sched.dayName}</span>
                        <span class="text-[9px] text-slate-400 block">${sched.pasaran || ''}</span>
                    </td>
                    <td class="py-2.5 px-2.5 text-center whitespace-nowrap text-emerald-700 dark:text-emerald-400 font-semibold">
                        ${sched.hijri.day}
                    </td>
                    <td class="py-2.5 px-2.5 text-center whitespace-nowrap font-bold">
                        ${sched.masehiDay}
                    </td>
                    <td class="py-2.5 px-2.5 text-center font-mono">${sched.times.imsak}</td>
                    <td class="py-2.5 px-2.5 text-center font-mono">${sched.times.subuh}</td>
                    <td class="py-2.5 px-2.5 text-center font-mono text-slate-400">${sched.times.terbit}</td>
                    <td class="py-2.5 px-2.5 text-center font-mono">${sched.times.dhuha}</td>
                    <td class="py-2.5 px-2.5 text-center font-mono">${sched.times.zuhur}</td>
                    <td class="py-2.5 px-2.5 text-center font-mono">${sched.times.ashar}</td>
                    <td class="py-2.5 px-2.5 text-center font-mono text-rose-600 dark:text-rose-400 font-semibold">${sched.times.maghrib}</td>
                    <td class="py-2.5 px-2.5 text-center font-mono">${sched.times.isya}</td>
                </tr>
            `;
        }

        tbody.innerHTML = rowsHtml;
    }

    // ----------------------------------------------------------------
    // 7. NAVIGASI TANGGAL & BULAN
    // ----------------------------------------------------------------
    function shiftDate(deltaDays) {
        viewDate.setDate(viewDate.getDate() + deltaDays);
        renderView();
    }

    function resetToToday() {
        viewDate = new Date();
        monthlyYear = viewDate.getFullYear();
        monthlyMonth = viewDate.getMonth();
        renderView();
    }

    function shiftMonth(deltaMonths) {
        monthlyMonth += deltaMonths;
        if (monthlyMonth < 0) {
            monthlyMonth = 11;
            monthlyYear -= 1;
        } else if (monthlyMonth > 11) {
            monthlyMonth = 0;
            monthlyYear += 1;
        }
        renderMonthlyTable();
    }

    function changeCity(newCityKey) {
        if (!CITIES[newCityKey]) return;
        currentCityKey = newCityKey;
        localStorage.setItem(PRAYER_CITY_KEY, newCityKey);

        const selectEl = document.getElementById('sholat-city-select');
        const settingsSelectEl = document.getElementById('prayer-city-select');
        if (selectEl && selectEl.value !== newCityKey) selectEl.value = newCityKey;
        if (settingsSelectEl && settingsSelectEl.value !== newCityKey) settingsSelectEl.value = newCityKey;

        renderSettingsPreview();
        renderView();

        if (typeof showToast === 'function') {
            showToast(`Wilayah jadwal shalat diubah ke ${CITIES[newCityKey].name}`);
        }
    }

    // ----------------------------------------------------------------
    // 8. NOTIFIKASI PENGINGAT AZAN & WAKTU SHALAT REAL-TIME
    // ----------------------------------------------------------------
    const NOTIF_STORAGE_KEY = "mubarokah_prayer_notification_enabled";
    let lastNotifiedKey = null;
    let notifCheckTimer = null;

    function isNotificationEnabled() {
        const val = localStorage.getItem(NOTIF_STORAGE_KEY);
        return val === null ? true : (val === "true");
    }

    /**
     * Memainkan lantunan nada genta adzan / Islamic prayer chime menggunakan Web Audio API
     * Bebas ketergantungan file eksternal (0 KB overhead, zero-network error)
     */
    function playPrayerChime(isTest = false) {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            if (ctx.state === 'suspended') {
                ctx.resume();
            }

            // Lantunan nada genta bertingkat bernuansa khidmat islami
            const notes = isTest ? [
                { freq: 523.25, start: 0.0, dur: 0.5 }, // C5
                { freq: 659.25, start: 0.45, dur: 0.6 }, // E5
                { freq: 784.00, start: 1.0, dur: 1.2 }  // G5
            ] : [
                { freq: 261.63, start: 0.0, dur: 0.9 }, // Do (C4)
                { freq: 392.00, start: 0.8, dur: 1.1 }, // Sol (G4)
                { freq: 523.25, start: 1.8, dur: 1.3 }, // Do' (C5)
                { freq: 659.25, start: 3.0, dur: 1.2 }, // Mi' (E5)
                { freq: 587.33, start: 4.1, dur: 1.3 }, // Re' (D5)
                { freq: 523.25, start: 5.3, dur: 2.2 }  // Do' (C5 panjang)
            ];

            notes.forEach(n => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(n.freq, ctx.currentTime + n.start);

                // Attack lembut & decay bertahap
                gain.gain.setValueAtTime(0.0001, ctx.currentTime + n.start);
                gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + n.start + 0.06);
                gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + n.start + n.dur);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(ctx.currentTime + n.start);
                osc.stop(ctx.currentTime + n.start + n.dur + 0.1);
            });
        } catch (err) {
            console.warn("AudioContext chime not available:", err);
        }
    }

    function sendPrayerNotification(prayerName, timeStr, cityName) {
        playPrayerChime(false);

        // 1. Browser Native Notification
        if ("Notification" in window && Notification.permission === "granted") {
            try {
                new Notification(`🕌 Waktu Shalat ${prayerName} Telah Tiba`, {
                    body: `Saatnya menunaikan shalat ${prayerName} (${timeStr} WIB) untuk wilayah ${cityName}. Mari tegakkan shalat berjamaah.`,
                    icon: "favicon.ico",
                    badge: "favicon.ico",
                    tag: `mubarokah-prayer-${prayerName}-${timeStr}`
                });
            } catch (e) {
                console.warn("Browser notification trigger failed:", e);
            }
        }

        // 2. In-App Banner Toast
        if (typeof showToast === 'function') {
            showToast(`🕌 Waktu Shalat ${prayerName} telah tiba (${timeStr}) untuk wilayah ${cityName}!`);
        }
    }

    function checkPrayerTimes() {
        if (!isNotificationEnabled()) return;

        const city = CITIES[currentCityKey] || CITIES.demak;
        const now = new Date();
        const sched = calculateDay(now, city);
        if (!sched || !sched.times) return;

        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const currentHM = `${hh}:${mm}`;
        const todayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

        const prayers = [
            { name: "Subuh", time: sched.times.subuh },
            { name: "Dzuhur", time: sched.times.zuhur },
            { name: "Ashar", time: sched.times.ashar },
            { name: "Maghrib", time: sched.times.maghrib },
            { name: "Isya'", time: sched.times.isya }
        ];

        for (const p of prayers) {
            if (p.time === currentHM) {
                const notifKey = `${todayStr}_${p.name}_${p.time}`;
                if (lastNotifiedKey !== notifKey) {
                    lastNotifiedKey = notifKey;
                    sendPrayerNotification(p.name, p.time, city.name);
                }
                break;
            }
        }
    }

    function startPrayerNotificationChecker() {
        if (notifCheckTimer) clearInterval(notifCheckTimer);
        notifCheckTimer = setInterval(checkPrayerTimes, 25000);
        checkPrayerTimes();
    }

    function toggleNotification(enabled) {
        localStorage.setItem(NOTIF_STORAGE_KEY, enabled ? "true" : "false");
        const toggleEl = document.getElementById('prayer-notification-toggle');
        if (toggleEl) toggleEl.checked = enabled;

        updatePermissionStatusUI();

        if (enabled) {
            if ("Notification" in window) {
                if (Notification.permission === "default") {
                    Notification.requestPermission().then(perm => {
                        updatePermissionStatusUI();
                        if (perm === "granted") {
                            if (typeof showToast === 'function') showToast("✅ Notifikasi Azan diaktifkan & izin browser diberikan!");
                            playPrayerChime(true);
                        } else {
                            if (typeof showToast === 'function') showToast("🔔 Pengingat suara & banner dalam aplikasi tetap aktif!");
                            playPrayerChime(true);
                        }
                    });
                    return;
                } else if (Notification.permission === "granted") {
                    if (typeof showToast === 'function') showToast("✅ Pengingat Azan & Waktu Shalat diaktifkan!");
                    playPrayerChime(true);
                } else {
                    if (typeof showToast === 'function') showToast("🔔 Pengingat suara & banner dalam aplikasi diaktifkan!");
                    playPrayerChime(true);
                }
            } else {
                if (typeof showToast === 'function') showToast("✅ Pengingat Azan & Waktu Shalat diaktifkan!");
                playPrayerChime(true);
            }
        } else {
            if (typeof showToast === 'function') showToast("Pengingat Azan dinonaktifkan");
        }
    }

    function updatePermissionStatusUI() {
        const statusEl = document.getElementById('prayer-notif-permission-status');
        if (!statusEl) return;

        const enabled = isNotificationEnabled();
        if (!enabled) {
            statusEl.innerHTML = `<i class="fa-solid fa-bell-slash text-slate-400"></i> Mode: Nonaktif`;
            return;
        }

        if ("Notification" in window && Notification.permission === "granted") {
            statusEl.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-500"></i> Mode: Suara + Notifikasi Sistem`;
        } else {
            statusEl.innerHTML = `<i class="fa-solid fa-volume-high text-amber-500"></i> Mode: Suara & Spanduk Aplikasi`;
        }
    }

    function initPrayerSettings() {
        populateCitySelector();
        renderSettingsPreview();

        const toggleEl = document.getElementById('prayer-notification-toggle');
        if (toggleEl) {
            toggleEl.checked = isNotificationEnabled();
        }

        updatePermissionStatusUI();
    }

    // ----------------------------------------------------------------
    // 9. SALIN JADWAL HARI INI KE CLIPBOARD (WHATSAPP READY)
    // ----------------------------------------------------------------
    function copyTodaySchedule() {
        const city = CITIES[currentCityKey] || CITIES.demak;
        const sched = calculateDay(viewDate, city);

        const text = `*JADWAL SHOLAT & IMSAKIYAH*\n` +
            `📍 ${city.name}\n` +
            `🗓️ ${sched.dayName} ${sched.pasaran ? sched.pasaran + ',' : ''} ${sched.masehiDay} ${namaBulanIndo[sched.masehiMonth - 1]} ${sched.masehiYear}\n` +
            `🌙 ${sched.hijri.formatted}\n\n` +
            `• Imsak   : ${sched.times.imsak} ${sched.tzName}\n` +
            `• Subuh   : ${sched.times.subuh} ${sched.tzName}\n` +
            `• Terbit  : ${sched.times.terbit} ${sched.tzName}\n` +
            `• Dhuha   : ${sched.times.dhuha} ${sched.tzName}\n` +
            `• Zuhur   : ${sched.times.zuhur} ${sched.tzName}\n` +
            `• Ashar   : ${sched.times.ashar} ${sched.tzName}\n` +
            `• Maghrib : ${sched.times.maghrib} ${sched.tzName}\n` +
            `• Isya'   : ${sched.times.isya} ${sched.tzName}\n\n` +
            `_Standar Hisab Falakiyah NU_\n`;

        navigator.clipboard.writeText(text).then(() => {
            if (typeof showToast === 'function') showToast("✅ Jadwal sholat berhasil disalin!");
            else alert("Jadwal sholat berhasil disalin ke clipboard!");
        }).catch(() => {
            if (typeof showToast === 'function') showToast("Gagal menyalin jadwal.");
        });
    }

    // Cetak Tabel Bulanan
    function printMonthlySchedule() {
        window.print();
    }

    // ----------------------------------------------------------------
    // 10. PUBLIC API & AUTO-EXPORT
    // ----------------------------------------------------------------
    return {
        init: initJadwalSholat,
        renderView: renderView,
        shiftDate: shiftDate,
        resetToToday: resetToToday,
        shiftMonth: shiftMonth,
        changeCity: changeCity,
        copyTodaySchedule: copyTodaySchedule,
        printMonthlySchedule: printMonthlySchedule,
        calculateDay: calculateDay,
        CITIES: CITIES,
        getCurrentCity: () => CITIES[currentCityKey] || CITIES.demak,
        initPrayerSettings: initPrayerSettings,
        renderSettingsPreview: renderSettingsPreview,
        populateCitySelector: populateCitySelector,
        playPrayerChime: playPrayerChime,
        toggleNotification: toggleNotification,
        startPrayerNotificationChecker: startPrayerNotificationChecker
    };
})();

// Jalankan inisialisasi pengaturan sholat & background checker saat dokumen siap
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (typeof ASNJadwalSholat !== 'undefined') {
            ASNJadwalSholat.initPrayerSettings();
            ASNJadwalSholat.startPrayerNotificationChecker();
        }
    });
} else {
    if (typeof ASNJadwalSholat !== 'undefined') {
        ASNJadwalSholat.initPrayerSettings();
        ASNJadwalSholat.startPrayerNotificationChecker();
    }
}

// Helper navigasi pembuka tab dari menu Ibadah
function openJadwalSholatPage() {
    if (typeof switchTab === 'function') {
        switchTab('jadwal-sholat');
    }
    if (typeof ASNJadwalSholat !== 'undefined') {
        ASNJadwalSholat.init();
    }
}

// Global Window Exports
window.ASNJadwalSholat = ASNJadwalSholat;
window.openJadwalSholatPage = openJadwalSholatPage;

