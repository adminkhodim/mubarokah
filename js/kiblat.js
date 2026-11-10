/**
 * ====================================================================
 * MUBAROKAH KOMPAS KIBLAT ENGINE (Falakiyyah Geodesi Presisi)
 * Mengadopsi Standar Presisi & Desain Kompas Falak Lembaga Falakiyah NU
 * Sensor Mutlak: DeviceOrientationAbsolute (Android) & WebkitCompassHeading (iOS)
 * Koordinat Ka'bah: 21° 25' 21" N, 39° 49' 34" E (Makkah al-Mukarramah)
 * ====================================================================
 */

const MubarokahKiblat = (function () {
    // 1. KOORDINAT TITIK PUSAT KA'BAH MAKKAH AL-MUKARRAMAH
    const KAABA_COORDS = {
        lat: 21.422487,
        lng: 39.826206
    };

    // 2. DATABASE KOORDINAT KOTA CADANGAN (Sebagai fallback jika GPS tidak aktif)
    const CITIES = {
        demak: { name: "Kab. Demak (PPTQ Roudlotul Mubarokah)", lat: -6.8944, lng: 110.6386 },
        semarang: { name: "Kota Semarang", lat: -6.9667, lng: 110.4167 },
        kudus: { name: "Kab. Kudus", lat: -6.8048, lng: 110.8405 },
        jepara: { name: "Kab. Jepara", lat: -6.5936, lng: 110.6783 },
        surakarta: { name: "Kota Surakarta (Solo)", lat: -7.5755, lng: 110.8243 },
        surabaya: { name: "Kota Surabaya", lat: -7.2575, lng: 112.7521 },
        jakarta: { name: "DKI Jakarta", lat: -6.2088, lng: 106.8456 },
        bandung: { name: "Kota Bandung", lat: -6.9175, lng: 107.6191 },
        yogyakarta: { name: "DI Yogyakarta", lat: -7.7956, lng: 110.3695 },
        makassar: { name: "Kota Makassar", lat: -5.1477, lng: 119.4327 },
        medan: { name: "Kota Medan", lat: 3.5952, lng: 98.6722 }
    };

    // 3. STATE LOKASI & SENSOR
    let savedLat = null;
    let savedLng = null;
    let savedLocName = null;
    let savedAccuracy = null;

    try {
        savedLat = localStorage.getItem("mubarokah_qibla_lat") || localStorage.getItem("asnawiyyah_qibla_lat");
        savedLng = localStorage.getItem("mubarokah_qibla_lng") || localStorage.getItem("asnawiyyah_qibla_lng");
        savedLocName = localStorage.getItem("mubarokah_qibla_loc_name") || localStorage.getItem("asnawiyyah_qibla_loc_name");
        savedAccuracy = localStorage.getItem("mubarokah_qibla_acc") || localStorage.getItem("asnawiyyah_qibla_acc");
    } catch (e) {}

    let userCoords = {
        lat: savedLat ? parseFloat(savedLat) : -6.8944,
        lng: savedLng ? parseFloat(savedLng) : 110.6386,
        accuracy: savedAccuracy ? parseFloat(savedAccuracy) : null,
        locationName: savedLocName || (savedLat ? "Lokasi Presisi Terhubung" : "Menghubungkan GPS..."),
        isGps: !!savedLat,
        sourceType: savedLat ? "saved_gps" : "detecting"
    };

    let qiblaBearing = 294.52; // Standar presisi Demak (± 294.5°)
    let qiblaDistance = 8335;
    let currentHeading = 0;
    let isCompassListening = false;
    let hasSensorSupport = false;
    let lastVibratedState = false;
    let isRequestingLocation = false;
    let hasAbsoluteOrientation = false;

    // ----------------------------------------------------------------
    // 4. FORMULA FALAKIYAH GEODESI (SPHERICAL TRIGONOMETRY)
    // ----------------------------------------------------------------
    function calculateQibla(lat, lng) {
        const toRad = deg => (deg * Math.PI) / 180;
        const toDeg = rad => (rad * 180) / Math.PI;

        const phi1 = toRad(lat);
        const phi2 = toRad(KAABA_COORDS.lat);
        const deltaLambda = toRad(KAABA_COORDS.lng - lng);

        const y = Math.sin(deltaLambda);
        const x = Math.cos(phi1) * Math.tan(phi2) - Math.sin(phi1) * Math.cos(deltaLambda);

        let qiblaRad = Math.atan2(y, x);
        let qiblaDeg = toDeg(qiblaRad);

        // Normalisasi ke 0° - 360°
        qiblaDeg = (qiblaDeg + 360) % 360;

        // Jarak Great Circle Haversine ke Ka'bah (Radius Bumi = 6371 km)
        const R = 6371;
        const dLat = phi2 - phi1;
        const dLng = deltaLambda;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distanceKm = Math.round(R * c);

        return {
            bearing: Number(qiblaDeg.toFixed(2)),
            distanceKm: distanceKm
        };
    }

    // ----------------------------------------------------------------
    // 5. KALKULASI HEADING SENSOR KOMPAS MUTLAK (TRUE/MAGNETIC NORTH)
    // ----------------------------------------------------------------
    function extractCompassHeading(event) {
        // 1. iOS Safari: WebkitCompassHeading memberikan kompas sejati 0-360 derajat
        if (typeof event.webkitCompassHeading === "number" && !isNaN(event.webkitCompassHeading)) {
            return event.webkitCompassHeading;
        }

        // 2. Android Chrome Absolute Orientation
        if (typeof event.alpha === "number" && !isNaN(event.alpha)) {
            const beta = event.beta || 0;
            const gamma = event.gamma || 0;

            // Jika ponsel diletakkan mendatar di atas meja (flat, pitch & roll < 25°)
            if (Math.abs(beta) < 25 && Math.abs(gamma) < 25) {
                // Pada permukaan meja datar: alpha adalah rotasi counter-clockwise dari Utara
                // Heading kompas searah jarum jam (0=U, 90=T, 180=S, 270=B):
                return (360 - event.alpha + 360) % 360;
            }

            // Jika ponsel dipegang miring: kalkulasi 3D Tilt-Compensated W3C
            const degToRad = Math.PI / 180;
            const a = event.alpha * degToRad;
            const b = beta * degToRad;
            const g = gamma * degToRad;

            const cA = Math.cos(a), sA = Math.sin(a);
            const cB = Math.cos(b), sB = Math.sin(b);
            const cG = Math.cos(g), sG = Math.sin(g);

            // Vektor hadap atas smartphone diproyeksikan ke bidang horizontal bumi
            const vx = -cA * sG - sA * sB * cG;
            const vy = -sA * sG + cA * sB * cG;

            let h = Math.atan2(vx, vy) * (180 / Math.PI);
            return (h + 360) % 360;
        }

        return null;
    }

    function onAbsoluteOrientationEvent(event) {
        hasSensorSupport = true;
        hasAbsoluteOrientation = true;
        const heading = extractCompassHeading(event);
        if (heading !== null) {
            currentHeading = (heading + 360) % 360;
            updateCompassUI(currentHeading);
        }
    }

    function onRelativeOrientationEvent(event) {
        // Hanya gunakan jika event absolute belum pernah dipancarkan
        if (hasAbsoluteOrientation) return;
        hasSensorSupport = true;
        const heading = extractCompassHeading(event);
        if (heading !== null) {
            currentHeading = (heading + 360) % 360;
            updateCompassUI(currentHeading);
        }
    }

    // ----------------------------------------------------------------
    // 6. UPDATE TAMPILAN KOMPAS REAL-TIME (ALA NU ONLINE)
    // ----------------------------------------------------------------
    function updateCompassUI(heading) {
        const dialEl = document.getElementById("qibla-compass-dial");
        const needleEl = document.getElementById("qibla-compass-needle");
        const statusBadgeEl = document.getElementById("qibla-status-badge");
        const glowHaloEl = document.getElementById("qibla-glow-halo");

        // 1. Putar piringan mata angin kompas sesuai arah hadap smartphone
        if (dialEl) {
            dialEl.style.transform = `rotate(${-heading}deg)`;
        }

        // 2. Putar jarum kiblat merah dengan Ka'bah di ujungnya
        const diff = (qiblaBearing - heading + 360) % 360;
        const needleAngle = diff;

        if (needleEl) {
            needleEl.style.transform = `rotate(${needleAngle}deg)`;
        }

        // 3. Toleransi deviasi presisi tepat menghadap kiblat (±2.5°)
        const isFacingQibla = diff <= 2.5 || diff >= 357.5;

        if (statusBadgeEl) {
            if (isFacingQibla) {
                statusBadgeEl.className = "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black bg-emerald-500 text-white shadow-lg animate-pulse border border-emerald-300";
                statusBadgeEl.innerHTML = `<i class="fa-solid fa-kaaba text-amber-300"></i> Tepat Menghadap Kiblat`;
                if (glowHaloEl) {
                    glowHaloEl.classList.remove("opacity-0");
                    glowHaloEl.classList.add("opacity-100");
                }

                // Haptic feedback getar halus sekali saat tepat menghadap Ka'bah
                if (!lastVibratedState) {
                    lastVibratedState = true;
                    if (typeof navigator !== "undefined" && navigator.vibrate) {
                        try {
                            navigator.vibrate([40, 60, 40]);
                        } catch (e) {}
                    }
                }
            } else {
                lastVibratedState = false;
                if (glowHaloEl) {
                    glowHaloEl.classList.remove("opacity-100");
                    glowHaloEl.classList.add("opacity-0");
                }

                let turnDirection = "";
                if (diff > 180) {
                    turnDirection = `Putar ponsel ke kiri ${(360 - diff).toFixed(0)}°`;
                } else {
                    turnDirection = `Putar ponsel ke kanan ${diff.toFixed(0)}°`;
                }

                statusBadgeEl.className = "inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur-md text-white border border-white/20";
                statusBadgeEl.innerHTML = `<i class="fa-solid fa-compass text-amber-300"></i> ${turnDirection}`;
            }
        }
    }

    // ----------------------------------------------------------------
    // 7. PENANGANAN LISTENER SENSOR KOMPAS
    // ----------------------------------------------------------------
    function startCompassListener() {
        if (isCompassListening) return;

        // Pasang event listener langsung ke deviceorientationabsolute (Android Chrome)
        try {
            window.addEventListener("deviceorientationabsolute", onAbsoluteOrientationEvent, true);
        } catch (e) {}

        // Pasang fallback standard deviceorientation
        try {
            window.addEventListener("deviceorientation", onRelativeOrientationEvent, true);
        } catch (e) {}

        isCompassListening = true;

        // Cek izin sensor khusus iOS Safari (iOS 13 s.d. iOS 18+)
        const needsIosSensorPermission = typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function";
        if (needsIosSensorPermission) {
            const btnIos = document.getElementById("btn-qibla-request-sensor");
            if (btnIos) btnIos.classList.remove("hidden");
        }

        // Cek setelah 2.5 detik jika perangkat tidak memiliki sensor magnetometer
        setTimeout(() => {
            const noticeEl = document.getElementById("qibla-sensor-notice");
            if (!hasSensorSupport && noticeEl) {
                const btnIos = document.getElementById("btn-qibla-request-sensor");
                const isWaitingIosPermission = btnIos && !btnIos.classList.contains("hidden");
                if (!isWaitingIosPermission) {
                    noticeEl.classList.remove("hidden");
                }
            }
        }, 2500);
    }

    function requestIosSensorPermission(onSuccessCallback) {
        if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
            DeviceOrientationEvent.requestPermission()
                .then(response => {
                    if (response === "granted") {
                        const btnIos = document.getElementById("btn-qibla-request-sensor");
                        if (btnIos) btnIos.classList.add("hidden");
                        const noticeEl = document.getElementById("qibla-sensor-notice");
                        if (noticeEl) noticeEl.classList.add("hidden");

                        window.addEventListener("deviceorientation", onRelativeOrientationEvent, true);
                        isCompassListening = true;
                        hasSensorSupport = true;
                        if (typeof showToast === "function") {
                            showToast("🧭 Sensor Kompas iPhone berhasil diaktifkan!");
                        }
                        if (typeof onSuccessCallback === "function") {
                            onSuccessCallback();
                        }
                    } else {
                        alert("Izin sensor orientasi tidak diberikan. Safari memerlukan izin kompas agar jarum berputar otomatis.");
                    }
                })
                .catch(err => {
                    console.warn("Gagal meminta izin sensor iOS:", err);
                });
        } else if (typeof onSuccessCallback === "function") {
            onSuccessCallback();
        }
    }

    function syncAllSensorAndLocation(interactive = true) {
        if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
            requestIosSensorPermission(() => {
                requestDeviceLocation(interactive);
            });
        } else {
            requestDeviceLocation(interactive);
        }
    }

    function stopCompassListener() {
        if (!isCompassListening) return;
        try {
            window.removeEventListener("deviceorientationabsolute", onAbsoluteOrientationEvent, true);
            window.removeEventListener("deviceorientation", onRelativeOrientationEvent, true);
        } catch (e) {}
        isCompassListening = false;
    }

    // ----------------------------------------------------------------
    // 8. HUBUNGKAN FITUR LOKASI PERANGKAT (GPS GEOLOCATION)
    // ----------------------------------------------------------------
    function requestDeviceLocation(interactive = false) {
        if (!navigator || !navigator.geolocation) {
            if (interactive) {
                alert("Browser atau perangkat Anda tidak memiliki fitur akses lokasi Geolocation.");
            }
            return;
        }

        if (isRequestingLocation) return;
        isRequestingLocation = true;

        const options = {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: interactive ? 0 : 60000
        };

        const locNameEl = document.getElementById("qibla-current-location");
        if (locNameEl) locNameEl.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Mendeteksi GPS...`;

        navigator.geolocation.getCurrentPosition(
            position => {
                isRequestingLocation = false;
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const accuracy = Math.round(position.coords.accuracy || 0);

                userCoords.lat = lat;
                userCoords.lng = lng;
                userCoords.accuracy = accuracy;
                userCoords.isGps = true;
                userCoords.sourceType = "gps";

                try {
                    localStorage.setItem("mubarokah_qibla_lat", lat.toString());
                    localStorage.setItem("mubarokah_qibla_lng", lng.toString());
                    localStorage.setItem("mubarokah_qibla_acc", accuracy.toString());
                } catch (e) {}

                updateQiblaFromCurrentCoords();
                reverseGeocode(lat, lng);

                if (interactive && typeof showToast === "function") {
                    showToast(`📍 Lokasi presisi terhubung (Akurasi: ±${accuracy}m)`);
                }
            },
            err => {
                isRequestingLocation = false;
                console.warn("Geolocation warning:", err.code, err.message);

                if (savedLat && savedLng) {
                    updateQiblaFromCurrentCoords();
                }

                if (interactive) {
                    alert("Tidak dapat mengakses GPS. Pastikan toggle Lokasi di smartphone aktif dan berikan izin lokasi pada browser.");
                }
            },
            options
        );
    }

    // Reverse Geocoding Menghasilkan: "Desa, Kecamatan"
    async function reverseGeocode(lat, lng) {
        try {
            const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
            const timeoutId = controller ? setTimeout(() => controller.abort(), 4500) : null;
            
            const fetchOptions = controller ? { signal: controller.signal } : {};
            const resp = await fetch(
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=id`,
                fetchOptions
            );
            if (timeoutId) clearTimeout(timeoutId);

            if (resp.ok) {
                const data = await resp.json();
                let village = data.locality || "";
                let district = "";
                let city = data.city || "";

                if (Array.isArray(data.localityInfo?.administrative)) {
                    data.localityInfo.administrative.forEach(item => {
                        const name = item.name || "";
                        if (item.adminLevel === 7 || name.toLowerCase().includes("kecamatan") || name.toLowerCase().includes("kec.")) {
                            district = name.replace(/kecamatan/i, "Kec.").trim();
                        }
                    });
                }

                if (!district && city) {
                    district = city.includes("Kec.") ? city : `Kec. ${city}`;
                }

                let finalLabel = "";
                if (village && district) {
                    finalLabel = `${village}, ${district}`;
                } else if (village) {
                    finalLabel = village;
                } else if (district) {
                    finalLabel = district;
                } else {
                    finalLabel = data.city || "Lokasi Presisi Perangkat";
                }

                userCoords.locationName = finalLabel;
                try {
                    localStorage.setItem("mubarokah_qibla_loc_name", finalLabel);
                } catch (e) {}

                const locEl = document.getElementById("qibla-current-location");
                if (locEl) locEl.innerText = finalLabel;
            }
        } catch (e) {}
    }

    // ----------------------------------------------------------------
    // 9. UPDATE PERHITUNGAN KIBLAT DARI KOORDINAT AKTIF
    // ----------------------------------------------------------------
    function updateQiblaFromCurrentCoords() {
        const result = calculateQibla(userCoords.lat, userCoords.lng);
        qiblaBearing = result.bearing;
        qiblaDistance = result.distanceKm;

        const degEl = document.getElementById("qibla-target-deg");
        const locEl = document.getElementById("qibla-current-location");
        const distEl = document.getElementById("qibla-target-distance-val");

        if (degEl) degEl.innerText = `${qiblaBearing.toFixed(2)}°`;
        if (locEl) locEl.innerText = userCoords.locationName;
        if (distEl) distEl.innerText = `${qiblaDistance.toLocaleString("id-ID")} km`;

        updateCompassUI(currentHeading);
    }

    function changeCity(cityKey) {
        if (!cityKey || !CITIES[cityKey]) return;
        userCoords = {
            lat: CITIES[cityKey].lat,
            lng: CITIES[cityKey].lng,
            accuracy: null,
            locationName: CITIES[cityKey].name,
            isGps: false,
            sourceType: "manual"
        };
        updateQiblaFromCurrentCoords();
    }

    // ----------------------------------------------------------------
    // 10. INISIALISASI
    // ----------------------------------------------------------------
    function init() {
        const selectEl = document.getElementById("qibla-city-select");
        if (selectEl && selectEl.options.length <= 1) {
            selectEl.innerHTML = `<option value="">-- Pilihan Kota Manual --</option>`;
            Object.keys(CITIES).forEach(key => {
                const opt = document.createElement("option");
                opt.value = key;
                opt.innerText = CITIES[key].name;
                selectEl.appendChild(opt);
            });
        }

        updateQiblaFromCurrentCoords();
        startCompassListener();
        requestDeviceLocation(false);
    }

    return {
        init: init,
        calculateQibla: calculateQibla,
        changeCity: changeCity,
        requestDeviceLocation: requestDeviceLocation,
        useGpsLocation: () => requestDeviceLocation(true),
        requestIosSensorPermission: requestIosSensorPermission,
        syncAllSensorAndLocation: syncAllSensorAndLocation,
        sync: () => syncAllSensorAndLocation(true),
        startCompassListener: startCompassListener,
        stopCompassListener: stopCompassListener,
        getCities: () => CITIES,
        getUserCoords: () => userCoords
    };
})();

// Helper navigasi pembuka tab dari menu Ibadah
function openKompasKiblatPage() {
    if (typeof switchTab === "function") {
        switchTab("kompas-kiblat");
    }
    if (typeof MubarokahKiblat !== "undefined") {
        MubarokahKiblat.init();
    }
}

// Global Window Exports
window.MubarokahKiblat = MubarokahKiblat;
window.ASNKiblat = MubarokahKiblat; // Kompatibilitas alias
window.openKompasKiblatPage = openKompasKiblatPage;
