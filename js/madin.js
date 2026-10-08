/**
 * ====================================================================
 * MODUL FRONTEND: MADRASAH DINIYAH (MADIN)
 * PPTQ Roudlotul Mubarokah
 * ====================================================================
 * Mengelola:
 * 1. Struktur Tingkatan / Jenjang Kelas (Awaliyah, Wustho, Ulya)
 * 2. Kurikulum Mata Pelajaran & Kitab Kuning Berjenjang
 * 3. Presensi KBM & Jurnal Tatap Muka Pengampu (Materi & Bab Kitab)
 * 4. Penilaian & Imtihan (Harian, Ujian Lisan/Syafahi, Tulis/Tahriri)
 * 5. Buku Rapor Hasil Belajar Diniyah Santri
 */

const MADIN_STORAGE_KEYS = {
    classes: 'mubarokah_madin_classes',
    subjects: 'mubarokah_madin_subjects',
    sessions: 'mubarokah_madin_sessions',
    grades: 'mubarokah_madin_grades',
    members: 'mubarokah_madin_members'
};

const DEFAULT_MADIN_CLASSES = [
    { classId: 'MD-ULA1', namaKelas: '1 Awaliyah A (Putra)', tingkat: 'Awaliyah', waliKelas: 'Ust. M. Ridwan, S.Pd.I', gender: 'L', totalSantri: 24 },
    { classId: 'MD-ULA2', namaKelas: '1 Awaliyah B (Putri)', tingkat: 'Awaliyah', waliKelas: 'Usth. Siti Maryam, S.Ag', gender: 'P', totalSantri: 22 },
    { classId: 'MD-WST1', namaKelas: '2 Wustho A (Putra)', tingkat: 'Wustho', waliKelas: 'Ust. Ahmad Fauzan', gender: 'L', totalSantri: 20 },
    { classId: 'MD-WST2', namaKelas: '2 Wustho B (Putri)', tingkat: 'Wustho', waliKelas: 'Usth. Fatimah Az-Zahra', gender: 'P', totalSantri: 21 },
    { classId: 'MD-ULY1', namaKelas: '3 Ulya (Aliyah)', tingkat: 'Ulya', waliKelas: 'K.H. Masrur', gender: 'all', totalSantri: 18 }
];

const DEFAULT_MADIN_SUBJECTS = [
    { subjectId: 'SBJ-01', namaKitab: 'Safinatun Naja', bidang: 'Fiqih', classId: 'MD-ULA1', ustadzPengampu: 'Ust. M. Ridwan, S.Pd.I', kkm: 70 },
    { subjectId: 'SBJ-02', namaKitab: 'Al-Jurumiyyah', bidang: 'Nahwu', classId: 'MD-ULA1', ustadzPengampu: 'Ust. Zaidan Al-Hafidz', kkm: 70 },
    { subjectId: 'SBJ-03', namaKitab: 'Taisirul Khalaq', bidang: 'Akhlaq', classId: 'MD-ULA1', ustadzPengampu: 'Ust. Fauzi Rohman', kkm: 75 },
    { subjectId: 'SBJ-04', namaKitab: 'Al-Amtsilah At-Tashrifiyyah', bidang: 'Shorof', classId: 'MD-ULA1', ustadzPengampu: 'Ust. Hasan Basri', kkm: 70 },
    { subjectId: 'SBJ-05', namaKitab: 'Fathul Qorib Al-Mujib', bidang: 'Fiqih', classId: 'MD-WST1', ustadzPengampu: 'Ust. Ahmad Fauzan', kkm: 75 },
    { subjectId: 'SBJ-06', namaKitab: 'Al-Imrithi', bidang: 'Nahwu', classId: 'MD-WST1', ustadzPengampu: 'Ust. Luqman Hakim', kkm: 75 },
    { subjectId: 'SBJ-07', namaKitab: 'Kifayatul Awam', bidang: 'Tauhid', classId: 'MD-ULY1', ustadzPengampu: 'K.H. Masrur', kkm: 75 }
];

function getMadinToken() {
    if (typeof getAdminSessionToken === 'function') {
        try {
            const t = getAdminSessionToken();
            if (t && typeof t === 'string' && t.trim()) return t.trim();
        } catch (e) {}
    }
    const candidateKeys = [
        'mubarokah_admin_token',
        'mubarokah_pengasuh_token',
        'user_token',
        'mubarokah_parent_token'
    ];
    for (const key of candidateKeys) {
        try {
            const sVal = sessionStorage.getItem(key);
            if (sVal && typeof sVal === 'string' && sVal.trim()) return sVal.trim();
            const lVal = localStorage.getItem(key);
            if (lVal && typeof lVal === 'string' && lVal.trim()) return lVal.trim();
        } catch (e) {}
    }
    return '';
}

const ASNMadin = {
    data: {
        classes: [],
        subjects: [],
        sessions: [],
        grades: {},
        classMembers: {}, // classId -> [ { studentId, nis, nama, gender }, ... ]
        activeTab: 'jurnal',
        selectedClassId: '',
        selectedSubjectId: '',
        selectedDate: '',
        sessionStudents: [],
        studentAttendanceMap: {} // studentId -> { status: 'H'|'S'|'I'|'A', keterangan: '' }
    },

    plottingState: {
        currentClassId: '',
        selectedStudentIds: new Set(),
        searchQuery: '',
        filterStatus: 'ALL'
    },

    init: function () {
        this.loadStorage();
        const today = new Date().toISOString().split('T')[0];
        this.data.selectedDate = today;

        const dateInput = document.getElementById('madin-jurnal-filter-date');
        if (dateInput) dateInput.value = today;

        const modalDateInput = document.getElementById('modal-sesi-tanggal');
        if (modalDateInput) modalDateInput.value = today;

        this.renderStats();
        this.populateClassDropdowns();
        this.renderMasterClasses();
        this.renderMasterSubjects();
        this.renderRecentSessions();
        this.ensureEmployeeDataLoaded();
        this.fetchMasterStudents().then(() => this.renderMasterClasses()).catch(() => {});
    },

    loadStorage: function () {
        try {
            const rawClasses = localStorage.getItem(MADIN_STORAGE_KEYS.classes);
            this.data.classes = rawClasses ? JSON.parse(rawClasses) : [...DEFAULT_MADIN_CLASSES];

            const rawSubjects = localStorage.getItem(MADIN_STORAGE_KEYS.subjects);
            this.data.subjects = rawSubjects ? JSON.parse(rawSubjects) : [...DEFAULT_MADIN_SUBJECTS];

            const rawSessions = localStorage.getItem(MADIN_STORAGE_KEYS.sessions);
            this.data.sessions = rawSessions ? JSON.parse(rawSessions) : [];

            const rawGrades = localStorage.getItem(MADIN_STORAGE_KEYS.grades);
            this.data.grades = rawGrades ? JSON.parse(rawGrades) : {};

            const rawMembers = localStorage.getItem(MADIN_STORAGE_KEYS.members);
            this.data.classMembers = rawMembers ? JSON.parse(rawMembers) : {};

            // Sinkronkan totalSantri di data kelas jika sudah ada data plotting
            if (this.data.classMembers && typeof this.data.classMembers === 'object') {
                this.data.classes.forEach(c => {
                    if (Array.isArray(this.data.classMembers[c.classId])) {
                        c.totalSantri = this.data.classMembers[c.classId].length;
                    }
                });
            }
        } catch (err) {
            console.error('Gagal memuat local storage Madin:', err);
            this.data.classes = [...DEFAULT_MADIN_CLASSES];
            this.data.subjects = [...DEFAULT_MADIN_SUBJECTS];
            this.data.classMembers = {};
        }
    },

    saveStorage: function () {
        try {
            localStorage.setItem(MADIN_STORAGE_KEYS.classes, JSON.stringify(this.data.classes));
            localStorage.setItem(MADIN_STORAGE_KEYS.subjects, JSON.stringify(this.data.subjects));
            localStorage.setItem(MADIN_STORAGE_KEYS.sessions, JSON.stringify(this.data.sessions));
            localStorage.setItem(MADIN_STORAGE_KEYS.grades, JSON.stringify(this.data.grades));
            localStorage.setItem(MADIN_STORAGE_KEYS.members, JSON.stringify(this.data.classMembers || {}));
        } catch (e) {
            console.error('Gagal menyimpan storage Madin:', e);
        }
    },

    loadData: function (forceRefresh = false) {
        this.init();
        this.fetchRemoteData(forceRefresh);
        if (forceRefresh && typeof showToast === 'function') {
            showToast('✅ Data Madrasah Diniyah berhasil dimuat');
        }
    },

    refreshData: function (isManual = false) {
        this.loadStorage();
        this.renderStats();
        this.populateClassDropdowns();
        this.renderMasterClasses();
        this.renderMasterSubjects();
        this.renderRecentSessions();
        this.fetchRemoteData(isManual);
        if (isManual && typeof showToast === 'function') {
            showToast('🔄 Memperbarui data Madrasah Diniyah...');
        }
    },

    initDatabaseSheets: async function () {
        const ok = confirm("Inisialisasi Database Madrasah Diniyah di Google Spreadsheet?\n\nSistem akan otomatis membuat 5 tab sheet baru jika belum ada:\n1. Madin_Kelas\n2. Madin_Kitab\n3. Madin_Jurnal\n4. Madin_Presensi\n5. Madin_Nilai\n\nLanjutkan?");
        if (!ok) return;

        try {
            const token = getMadinToken();
            if (typeof apiPost === 'function') {
                const res = await apiPost("initMadinSheets", { token });
                if (res && (res.status === 'success' || res.success)) {
                    alert(res.message || "Tabel Madrasah Diniyah berhasil diinisialisasi.");
                    this.fetchRemoteData(true);
                } else {
                    alert("Status inisialisasi: " + (res.message || "Berhasil"));
                }
            } else {
                alert("Mode lokal aktif: Tab sheet virtual Madin siap digunakan.");
            }
        } catch (e) {
            console.warn("Inisialisasi sheet madin offline fallback:", e);
            alert("Koneksi cloud terjadwal. Struktur lokal Madin siap digunakan.");
        }
    },

    fetchRemoteData: async function (showToastFeedback = false) {
        try {
            if (typeof apiPost !== 'function' && typeof apiGet !== 'function') return;
            const token = getMadinToken();
            let res = null;
            if (typeof apiPost === 'function') {
                res = await apiPost("getMadinData", { token });
            } else if (typeof apiGet === 'function') {
                res = await apiGet("getMadinData", { token });
            }

            if (res && res.data) {
                if (Array.isArray(res.data.classes) && res.data.classes.length > 0) {
                    this.data.classes = res.data.classes;
                }
                if (Array.isArray(res.data.subjects) && res.data.subjects.length > 0) {
                    this.data.subjects = res.data.subjects;
                }
                if (Array.isArray(res.data.sessions) && res.data.sessions.length > 0) {
                    this.data.sessions = res.data.sessions;
                }
                if (res.data.grades && typeof res.data.grades === 'object') {
                    this.data.grades = res.data.grades;
                }
                if (res.data.classMembers && typeof res.data.classMembers === 'object') {
                    this.data.classMembers = res.data.classMembers;
                    // Sinkronkan totalSantri di data kelas
                    this.data.classes.forEach(c => {
                        if (Array.isArray(this.data.classMembers[c.classId])) {
                            c.totalSantri = this.data.classMembers[c.classId].length;
                        }
                    });
                }
                this.saveStorage();
                this.renderStats();
                this.populateClassDropdowns();
                this.renderMasterClasses();
                this.renderMasterSubjects();
                this.renderRecentSessions();
                if (showToastFeedback && typeof showToast === 'function') {
                    showToast('☁️ Data Madrasah Diniyah tersinkron dengan Spreadsheet');
                }
            }
        } catch (err) {
            console.log('Sinkronisasi cloud Madin offline fallback:', err);
        }
    },

    // ==================== SUB-TAB SWITCHER ====================
    switchTab: function (tabKey) {
        this.data.activeTab = tabKey;
        const tabs = ['jurnal', 'nilai', 'rapor', 'master'];

        tabs.forEach(t => {
            const btn = document.getElementById('btn-madin-tab-' + t);
            const panel = document.getElementById('panel-madin-' + t);

            if (btn) {
                if (t === tabKey) {
                    btn.className = 'madin-tab-btn flex-1 min-w-[130px] px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 bg-indigo-600 text-white shadow-sm';
                } else {
                    btn.className = 'madin-tab-btn flex-1 min-w-[130px] px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1c2836]';
                }
            }

            if (panel) {
                if (t === tabKey) {
                    panel.classList.remove('hidden');
                } else {
                    panel.classList.add('hidden');
                }
            }
        });

        if (tabKey === 'master') {
            this.renderMasterClasses();
            this.renderMasterSubjects();
        } else if (tabKey === 'nilai') {
            this.populateGradeDropdowns();
        } else if (tabKey === 'rapor') {
            this.populateRaporDropdowns();
        }
    },

    // ==================== STATISTIK ====================
    renderStats: function () {
        const totalKelasEl = document.getElementById('madin-stat-total-kelas');
        const totalKitabEl = document.getElementById('madin-stat-total-kitab');
        const sesiBulanEl = document.getElementById('madin-stat-sesi-bulan');
        const pctEl = document.getElementById('madin-stat-kehadiran-pct');

        if (totalKelasEl) totalKelasEl.textContent = `${this.data.classes.length} Kelas`;
        if (totalKitabEl) totalKitabEl.textContent = `${this.data.subjects.length} Kitab`;
        if (sesiBulanEl) sesiBulanEl.textContent = `${this.data.sessions.length} Sesi`;

        // Hitung rerata kehadiran
        let totalHadir = 0;
        let totalPeserta = 0;
        this.data.sessions.forEach(s => {
            if (s.kehadiran) {
                Object.values(s.kehadiran).forEach(st => {
                    totalPeserta++;
                    if (st.status === 'H') totalHadir++;
                });
            }
        });

        const pct = totalPeserta > 0 ? Math.round((totalHadir / totalPeserta) * 100) : 100;
        if (pctEl) pctEl.textContent = `${pct}%`;
        const barEl = document.getElementById('madin-stat-bar-kehadiran');
        if (barEl) barEl.style.width = `${pct}%`;
    },

    // ==================== POPULASI DROPDOWNS ====================
    populateClassDropdowns: function () {
        const selectJurnal = document.getElementById('madin-jurnal-filter-kelas');
        const selectModal = document.getElementById('modal-sesi-kelas');
        const selectKitabModal = document.getElementById('modal-kitab-kelas');

        let optionsHtml = '<option value="">-- Pilih Kelas --</option>';
        this.data.classes.forEach(c => {
            optionsHtml += `<option value="${c.classId}">${c.namaKelas} (${c.tingkat})</option>`;
        });

        if (selectJurnal) {
            selectJurnal.innerHTML = optionsHtml;
            if (this.data.classes.length > 0 && !this.data.selectedClassId) {
                selectJurnal.value = this.data.classes[0].classId;
                this.data.selectedClassId = this.data.classes[0].classId;
                this.onClassChanged();
            }
        }
        if (selectModal) selectModal.innerHTML = optionsHtml;
        if (selectKitabModal) selectKitabModal.innerHTML = optionsHtml;
    },

    onClassChanged: function () {
        const selectJurnal = document.getElementById('madin-jurnal-filter-kelas');
        if (!selectJurnal) return;
        this.data.selectedClassId = selectJurnal.value;

        const selectKitab = document.getElementById('madin-jurnal-filter-kitab');
        if (!selectKitab) return;

        const classSubjects = this.data.subjects.filter(s => s.classId === this.data.selectedClassId);
        let opts = '<option value="">-- Pilih Kitab / Mapel --</option>';
        classSubjects.forEach(s => {
            opts += `<option value="${s.subjectId}">${s.namaKitab} (${s.bidang}) - ${s.ustadzPengampu}</option>`;
        });

        selectKitab.innerHTML = opts;
        if (classSubjects.length > 0) {
            selectKitab.value = classSubjects[0].subjectId;
            this.data.selectedSubjectId = classSubjects[0].subjectId;
            this.onSubjectChanged();
        } else {
            this.data.selectedSubjectId = '';
        }
    },

    onSubjectChanged: function () {
        const selectKitab = document.getElementById('madin-jurnal-filter-kitab');
        if (!selectKitab) return;
        this.data.selectedSubjectId = selectKitab.value;

        const sub = this.data.subjects.find(s => s.subjectId === this.data.selectedSubjectId);
        const ustadzSelect = document.getElementById('madin-jurnal-ustadz');
        if (ustadzSelect) {
            this.populateTeacherDropdown('madin-jurnal-ustadz', sub ? sub.ustadzPengampu : '');
        }
    },

    // ==================== INTEGRASI DATA PEGAWAI ====================
    getTeacherList: function () {
        // 1. Ambil dari ASNPegawai.list jika ada data terisi
        if (window.ASNPegawai && Array.isArray(window.ASNPegawai.list) && window.ASNPegawai.list.length > 0) {
            return window.ASNPegawai.list.map(p => ({
                nama: String(p.nama || '').trim(),
                jabatan: String(p.jabatan || 'Pegawai / Asatidz').trim(),
                nip: p.nip || ''
            })).filter(t => t.nama);
        }

        // 2. Fallback Asatidz Pesantren standar jika database pegawai belum di-load
        return [
            { nama: "Ust. M. Ridwan, S.Pd.I", jabatan: "Pengajar Diniyah" },
            { nama: "Usth. Siti Maryam, S.Ag", jabatan: "Pengajar Diniyah" },
            { nama: "Ust. Ahmad Fauzan", jabatan: "Pengajar Diniyah" },
            { nama: "Usth. Fatimah Az-Zahra", jabatan: "Pengajar Diniyah" },
            { nama: "K.H. Masrur", jabatan: "Pengasuh / Kepala Madin" },
            { nama: "Ust. Zaidan Al-Hafidz", jabatan: "Muhafiz / Asatidz" },
            { nama: "Ust. Fauzi Rohman", jabatan: "Pengajar Diniyah" },
            { nama: "Ust. Hasan Basri", jabatan: "Pengajar Diniyah" },
            { nama: "Ust. Luqman Hakim", jabatan: "Pengajar Diniyah" }
        ];
    },

    populateTeacherDropdown: function (elementId, selectedValue = '') {
        const selectEl = document.getElementById(elementId);
        if (!selectEl) return;

        const teachers = this.getTeacherList();
        let opts = '<option value="">-- Pilih dari Data Pegawai --</option>';

        let valueFound = false;
        teachers.forEach(t => {
            const isSel = selectedValue && t.nama.toLowerCase() === selectedValue.toLowerCase();
            if (isSel) valueFound = true;
            opts += `<option value="${t.nama}" ${isSel ? 'selected' : ''}>${t.nama} (${t.jabatan})</option>`;
        });

        // Jika nilai lama ada namun belum terdaftar di pegawai, pertahankan agar tidak hilang
        if (selectedValue && !valueFound) {
            opts += `<option value="${selectedValue}" selected>${selectedValue} (Data Tersimpan)</option>`;
        }

        selectEl.innerHTML = opts;
        if (selectedValue) {
            selectEl.value = selectedValue;
        }
    },

    ensureEmployeeDataLoaded: function () {
        if ((!window.ASNPegawai || !window.ASNPegawai.list || window.ASNPegawai.list.length === 0) && typeof loadAdminEmployeesData === 'function') {
            loadAdminEmployeesData().then(() => {
                // Refresh dropdown jika sedang terbuka
                const waliEl = document.getElementById('modal-kelas-wali');
                if (waliEl) this.populateTeacherDropdown('modal-kelas-wali', waliEl.value);
                const subUstadzEl = document.getElementById('modal-kitab-ustadz');
                if (subUstadzEl) this.populateTeacherDropdown('modal-kitab-ustadz', subUstadzEl.value);
                const sesUstadzEl = document.getElementById('modal-sesi-ustadz');
                if (sesUstadzEl) this.populateTeacherDropdown('modal-sesi-ustadz', sesUstadzEl.value);
                const jrnUstadzEl = document.getElementById('madin-jurnal-ustadz');
                if (jrnUstadzEl) this.populateTeacherDropdown('madin-jurnal-ustadz', jrnUstadzEl.value);
            }).catch(e => console.log('Load employees for madin:', e));
        } else {
            const jrnUstadzEl = document.getElementById('madin-jurnal-ustadz');
            if (jrnUstadzEl && !jrnUstadzEl.value) this.populateTeacherDropdown('madin-jurnal-ustadz', '');
        }
    },

    onDateChanged: function () {
        const dateInput = document.getElementById('madin-jurnal-filter-date');
        if (dateInput) this.data.selectedDate = dateInput.value;
    },

    // ==================== LOGIKA PRESENSI KBM ====================
    loadSessionStudents: function () {
        const classId = this.data.selectedClassId;
        const subjectId = this.data.selectedSubjectId;

        if (!classId) {
            alert('Silakan pilih kelas terlebih dahulu');
            return;
        }

        const cls = this.data.classes.find(c => c.classId === classId);
        const sub = this.data.subjects.find(s => s.subjectId === subjectId);

        // Header info
        const titleEl = document.getElementById('madin-session-header-title');
        const badgeEl = document.getElementById('madin-session-header-badge');
        const descEl = document.getElementById('madin-session-header-desc');

        if (titleEl) titleEl.textContent = cls ? cls.namaKelas : 'Presensi Kelas';
        if (badgeEl) badgeEl.textContent = sub ? `${sub.namaKitab} • ${sub.bidang}` : 'Kitab Belum Dipilih';
        if (descEl) descEl.textContent = `Wali Kelas: ${cls ? cls.waliKelas : '-'} • Pengampu: ${sub ? sub.ustadzPengampu : '-'}`;

        // Dapatkan data santri dari global app jika ada, atau buat data santri kelas
        let students = this.getStudentsForClass(cls);
        this.data.sessionStudents = students;

        // Default: semua status Hadir (H)
        this.data.studentAttendanceMap = {};
        students.forEach(st => {
            this.data.studentAttendanceMap[st.id || st.nis] = { status: 'H', keterangan: '' };
        });

        this.renderAttendanceList();
        this.updateAttendanceCounters();
    },

    fetchMasterStudents: async function (forceRefresh = false) {
        if (!forceRefresh) {
            if (window.adminStudentsData && Array.isArray(window.adminStudentsData) && window.adminStudentsData.length > 0) {
                return window.adminStudentsData;
            }
            if (window.cachedStudents && Array.isArray(window.cachedStudents) && window.cachedStudents.length > 0) {
                return window.cachedStudents;
            }
            try {
                const s = localStorage.getItem('mubarokah_admin_students');
                if (s) {
                    const parsed = JSON.parse(s);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        window.adminStudentsData = parsed;
                        window.cachedStudents = parsed;
                        return parsed;
                    }
                }
            } catch (e) {}
        }

        // 1. Coba panggil window.loadAdminStudentsData jika tersedia
        if (typeof window.loadAdminStudentsData === 'function') {
            try {
                await window.loadAdminStudentsData();
                if (window.adminStudentsData && Array.isArray(window.adminStudentsData) && window.adminStudentsData.length > 0) {
                    return window.adminStudentsData;
                }
            } catch (e) {
                console.warn('loadAdminStudentsData call fallback:', e);
            }
        }

        // 2. Fallback: panggil API getStudents langsung dari server
        try {
            const token = getMadinToken();
            let res = null;
            if (typeof apiPost === 'function') {
                res = await apiPost("getStudents", { token });
            } else if (typeof apiGet === 'function') {
                res = await apiGet("getStudents", token ? { token } : {});
            }

            if (res && (res.status === 'success' || res.success) && Array.isArray(res.data) && res.data.length > 0) {
                window.adminStudentsData = res.data;
                window.cachedStudents = res.data;
                try {
                    localStorage.setItem('mubarokah_admin_students', JSON.stringify(res.data));
                } catch (e) {}
                return res.data;
            }
        } catch (err) {
            console.warn("fetchMasterStudents API error:", err);
        }

        return [];
    },

    getAllMasterStudents: function () {
        let list = [];
        if (window.adminStudentsData && Array.isArray(window.adminStudentsData) && window.adminStudentsData.length > 0) {
            list = window.adminStudentsData;
        } else if (window.cachedStudents && Array.isArray(window.cachedStudents) && window.cachedStudents.length > 0) {
            list = window.cachedStudents;
        } else if (window.ASNPresensi && window.ASNPresensi.data && Array.isArray(window.ASNPresensi.data.students) && window.ASNPresensi.data.students.length > 0) {
            list = window.ASNPresensi.data.students;
        } else if (window.ASNTahfidz && window.ASNTahfidz.data && Array.isArray(window.ASNTahfidz.data.students) && window.ASNTahfidz.data.students.length > 0) {
            list = window.ASNTahfidz.data.students;
        } else {
            try {
                const s = localStorage.getItem('mubarokah_admin_students');
                if (s) {
                    const parsed = JSON.parse(s);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        list = parsed;
                        window.adminStudentsData = parsed;
                    }
                }
            } catch (e) {}
        }

        if (list.length > 0) {
            return list.map((st, idx) => ({
                id: String(st.id || st.studentId || st.nis || `STD-${idx + 1}`).trim(),
                studentId: String(st.studentId || st.id || st.nis || `STD-${idx + 1}`).trim(),
                nis: String(st.nis || '').trim(),
                nama: String(st.nama || st.name || `Santri ${idx + 1}`).trim(),
                gender: String(st.gender || st.jenisKelamin || 'L').toUpperCase(),
                status: String(st.status || 'ACTIVE').toUpperCase()
            }));
        }

        return [];
    },

    getStudentsForClass: function (cls) {
        if (!cls) return [];
        const classId = typeof cls === 'string' ? cls : cls.classId;

        // 1. Cek apakah kelas ini sudah memiliki santri ter-plot
        const assigned = this.data.classMembers && this.data.classMembers[classId];
        if (Array.isArray(assigned) && assigned.length > 0) {
            const allMaster = this.getAllMasterStudents();
            const masterMap = new Map();
            allMaster.forEach(st => {
                const sid = String(st.id || st.studentId || st.nis || '').trim();
                if (sid) masterMap.set(sid, st);
                if (st.nis) masterMap.set(String(st.nis).trim(), st);
            });

            return assigned.map(m => {
                const sid = String(m.studentId || m.id || m.nis || '').trim();
                const fromMaster = masterMap.get(sid) || (m.nis ? masterMap.get(String(m.nis).trim()) : null);
                if (fromMaster) {
                    return {
                        id: sid,
                        studentId: sid,
                        nis: fromMaster.nis || m.nis || '',
                        nama: fromMaster.nama || fromMaster.name || m.nama || m.name || 'Santri',
                        gender: fromMaster.gender || fromMaster.jenisKelamin || m.gender || 'L'
                    };
                }
                return {
                    id: sid,
                    studentId: sid,
                    nis: m.nis || '',
                    nama: m.nama || m.name || 'Santri',
                    gender: m.gender || 'L'
                };
            });
        }

        // 2. Fallback jika belum di-plot: filter berdasarkan gender dari master
        const allStudents = this.getAllMasterStudents();
        const targetGender = typeof cls === 'object' ? cls.gender : 'all';

        if (targetGender === 'L') {
            return allStudents.filter(s => (s.gender || s.jenisKelamin || 'L').toUpperCase() === 'L').slice(0, 25);
        } else if (targetGender === 'P') {
            return allStudents.filter(s => (s.gender || s.jenisKelamin || 'P').toUpperCase() === 'P').slice(0, 25);
        }
        return allStudents.slice(0, 30);
    },

    renderAttendanceList: function () {
        const container = document.getElementById('madin-student-attendance-list');
        if (!container) return;

        const students = this.data.sessionStudents;
        if (students.length === 0) {
            container.innerHTML = `
                <div class="py-8 text-center text-slate-400 text-xs">
                    Tidak ada santri yang terdaftar dalam kelas ini.
                </div>
            `;
            return;
        }

        let html = '';
        students.forEach((st, idx) => {
            const stId = st.id || st.nis;
            const att = this.data.studentAttendanceMap[stId] || { status: 'H', keterangan: '' };

            const isH = att.status === 'H';
            const isS = att.status === 'S';
            const isI = att.status === 'I';
            const isA = att.status === 'A';

            html += `
                <div class="p-2.5 rounded-xl border border-slate-100 dark:border-[#253447] bg-white dark:bg-[#182332] flex flex-wrap items-center justify-between gap-2.5 hover:shadow-xs transition">
                    <div class="flex items-center space-x-2.5 min-w-[200px]">
                        <span class="w-6 h-6 rounded-full bg-slate-100 dark:bg-[#1f2d3d] text-slate-500 font-bold text-[10px] flex items-center justify-center shrink-0">
                            ${idx + 1}
                        </span>
                        <div>
                            <h4 class="font-bold text-xs text-slate-800 dark:text-slate-100 leading-tight">${st.nama}</h4>
                            <p class="text-[10px] text-slate-400 font-mono">NIS: ${st.nis || '-'}</p>
                        </div>
                    </div>

                    <!-- 4 Tombol Status Presensi Cepat -->
                    <div class="flex items-center gap-1">
                        <button type="button" onclick="ASNMadin.setStudentStatus('${stId}', 'H')"
                            class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition ${isH ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-500 hover:bg-emerald-50 dark:bg-[#1c2836] dark:text-slate-400'}">
                            Hadir
                        </button>
                        <button type="button" onclick="ASNMadin.setStudentStatus('${stId}', 'S')"
                            class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition ${isS ? 'bg-amber-500 text-white shadow-xs' : 'bg-slate-100 text-slate-500 hover:bg-amber-50 dark:bg-[#1c2836] dark:text-slate-400'}">
                            Sakit
                        </button>
                        <button type="button" onclick="ASNMadin.setStudentStatus('${stId}', 'I')"
                            class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition ${isI ? 'bg-sky-500 text-white shadow-xs' : 'bg-slate-100 text-slate-500 hover:bg-sky-50 dark:bg-[#1c2836] dark:text-slate-400'}">
                            Izin
                        </button>
                        <button type="button" onclick="ASNMadin.setStudentStatus('${stId}', 'A')"
                            class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition ${isA ? 'bg-rose-600 text-white shadow-xs' : 'bg-slate-100 text-slate-500 hover:bg-rose-50 dark:bg-[#1c2836] dark:text-slate-400'}">
                            Alpa
                        </button>
                    </div>

                    <!-- Keterangan Alasan jika tidak hadir -->
                    <div class="w-full sm:w-48 ${isH ? 'hidden' : 'block'}">
                        <input type="text" placeholder="Keterangan..." value="${att.keterangan || ''}"
                            onchange="ASNMadin.setStudentKeterangan('${stId}', this.value)"
                            class="w-full px-2 py-1 text-[11px] rounded-lg border border-slate-200 dark:border-[#283a4e] bg-slate-50 dark:bg-[#1c2836] text-slate-800 dark:text-slate-100">
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    setStudentStatus: function (stId, status) {
        if (!this.data.studentAttendanceMap[stId]) {
            this.data.studentAttendanceMap[stId] = { status: 'H', keterangan: '' };
        }
        this.data.studentAttendanceMap[stId].status = status;
        this.renderAttendanceList();
        this.updateAttendanceCounters();
    },

    setStudentKeterangan: function (stId, ket) {
        if (this.data.studentAttendanceMap[stId]) {
            this.data.studentAttendanceMap[stId].keterangan = ket;
        }
    },

    markAllPresent: function () {
        this.data.sessionStudents.forEach(st => {
            const stId = st.id || st.nis;
            this.data.studentAttendanceMap[stId] = { status: 'H', keterangan: '' };
        });
        this.renderAttendanceList();
        this.updateAttendanceCounters();
        if (typeof showToast === 'function') {
            showToast('✅ Seluruh santri ditandai HADIR');
        }
    },

    updateAttendanceCounters: function () {
        let h = 0, s = 0, i = 0, a = 0;
        Object.values(this.data.studentAttendanceMap).forEach(v => {
            if (v.status === 'H') h++;
            else if (v.status === 'S') s++;
            else if (v.status === 'I') i++;
            else if (v.status === 'A') a++;
        });

        const cH = document.getElementById('madin-count-hadir');
        const cS = document.getElementById('madin-count-sakit');
        const cI = document.getElementById('madin-count-izin');
        const cA = document.getElementById('madin-count-alpa');

        if (cH) cH.textContent = h;
        if (cS) cS.textContent = s;
        if (cI) cI.textContent = i;
        if (cA) cA.textContent = a;
    },

    filterStudentList: function () {
        const q = (document.getElementById('madin-search-student')?.value || '').toLowerCase();
        const items = document.querySelectorAll('#madin-student-attendance-list > div');
        items.forEach(el => {
            const txt = el.textContent.toLowerCase();
            el.style.display = txt.includes(q) ? '' : 'none';
        });
    },

    saveAttendanceAndJournal: function () {
        const classId = this.data.selectedClassId;
        const subjectId = this.data.selectedSubjectId;

        if (!classId) {
            alert('Pilih kelas terlebih dahulu.');
            return;
        }

        const cls = this.data.classes.find(c => c.classId === classId);
        const sub = this.data.subjects.find(s => s.subjectId === subjectId);

        const bab = document.getElementById('madin-jurnal-bab')?.value || '-';
        const catatan = document.getElementById('madin-jurnal-catatan')?.value || '';
        const ustadz = document.getElementById('madin-jurnal-ustadz')?.value || sub?.ustadzPengampu || '-';
        const tanggal = this.data.selectedDate || new Date().toISOString().split('T')[0];

        const sessionRecord = {
            sessionId: 'SES-' + Date.now(),
            classId: classId,
            namaKelas: cls ? cls.namaKelas : classId,
            subjectId: subjectId,
            namaKitab: sub ? sub.namaKitab : 'Kitab Diniyah',
            tanggal: tanggal,
            asatidz: ustadz,
            materiBab: bab,
            catatan: catatan,
            kehadiran: { ...this.data.studentAttendanceMap },
            timestamp: new Date().toISOString()
        };

        this.data.sessions.unshift(sessionRecord);
        this.saveStorage();
        this.renderRecentSessions();
        this.renderStats();

        // Sinkronisasi asinkron ke Google Sheets
        if (typeof apiPost === 'function') {
            const token = getMadinToken();
            apiPost("saveMadinSession", { ...sessionRecord, token }).catch(e => {
                console.log('Background sync madin session:', e);
            });
        }

        if (typeof showToast === 'function') {
            showToast('✅ Presensi & Jurnal KBM berhasil disimpan');
        } else {
            alert('Presensi & Jurnal KBM berhasil disimpan!');
        }
    },

    renderRecentSessions: function () {
        const container = document.getElementById('madin-history-session-list');
        if (!container) return;

        if (this.data.sessions.length === 0) {
            container.innerHTML = '<div class="py-6 text-center text-xs text-slate-400">Belum ada riwayat tatap muka tersimpan.</div>';
            return;
        }

        let html = '';
        this.data.sessions.slice(0, 5).forEach(ses => {
            let hadirCount = 0;
            let total = 0;
            if (ses.kehadiran) {
                Object.values(ses.kehadiran).forEach(v => {
                    total++;
                    if (v.status === 'H') hadirCount++;
                });
            }

            html += `
                <div class="p-3 rounded-xl border border-slate-100 dark:border-[#253447] bg-slate-50/50 dark:bg-[#182332] flex items-center justify-between gap-2">
                    <div class="space-y-0.5">
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-xs text-slate-800 dark:text-slate-100">${ses.namaKelas}</span>
                            <span class="text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-semibold">${ses.namaKitab}</span>
                        </div>
                        <p class="text-[11px] text-slate-500 dark:text-slate-400">Materi: <strong>${ses.materiBab}</strong> • Guru: ${ses.asatidz}</p>
                    </div>
                    <div class="text-right shrink-0">
                        <span class="text-xs font-bold text-emerald-600 dark:text-emerald-400">${hadirCount}/${total} Hadir</span>
                        <p class="text-[10px] text-slate-400">${ses.tanggal}</p>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    // ==================== MASTER KELAS & KITAB ====================
    renderMasterClasses: function () {
        const list = document.getElementById('madin-master-classes-list');
        if (!list) return;

        let html = '';
        this.data.classes.forEach(c => {
            const memberCount = (this.data.classMembers && Array.isArray(this.data.classMembers[c.classId])) 
                ? this.data.classMembers[c.classId].length 
                : (c.totalSantri || 0);

            html += `
                <div class="p-3 rounded-xl border border-slate-100 dark:border-[#253447] bg-white dark:bg-[#182332] flex items-center justify-between gap-2 hover:border-indigo-200 dark:hover:border-indigo-900/60 transition">
                    <div>
                        <div class="flex items-center gap-1.5">
                            <h5 class="font-bold text-xs text-slate-800 dark:text-slate-100">${c.namaKelas}</h5>
                            <span class="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 dark:bg-[#1f2d3d] dark:text-slate-300 uppercase">${c.tingkat}</span>
                        </div>
                        <p class="text-[11px] text-slate-400 mt-0.5">Wali: ${c.waliKelas || '-'} • Target: ${c.gender === 'L' ? 'Putra' : (c.gender === 'P' ? 'Putri' : 'Campur')}</p>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <button type="button" onclick="ASNMadin.openPlottingModal('${c.classId}')" class="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] flex items-center gap-1.5 transition border border-indigo-200/50 dark:border-indigo-800/50" title="Kelola Anggota Santri">
                            <i class="fa-solid fa-users text-xs"></i>
                            <span>${memberCount} Santri</span>
                        </button>
                        <button type="button" onclick="ASNMadin.openClassModal('${c.classId}')" class="w-7 h-7 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-[#1c2836] flex items-center justify-center transition" title="Edit Kelas">
                            <i class="fa-solid fa-pen-to-square text-xs"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        list.innerHTML = html;
    },

    renderMasterSubjects: function () {
        const list = document.getElementById('madin-master-subjects-list');
        if (!list) return;

        let html = '';
        this.data.subjects.forEach(s => {
            const cls = this.data.classes.find(c => c.classId === s.classId);
            html += `
                <div class="p-3 rounded-xl border border-slate-100 dark:border-[#253447] bg-white dark:bg-[#182332] flex items-center justify-between gap-2">
                    <div>
                        <div class="flex items-center gap-1.5">
                            <h5 class="font-bold text-xs text-slate-800 dark:text-slate-100">${s.namaKitab}</h5>
                            <span class="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 uppercase">${s.bidang}</span>
                        </div>
                        <p class="text-[11px] text-slate-400 mt-0.5">Kelas: ${cls ? cls.namaKelas : s.classId} • Pengampu: ${s.ustadzPengampu || '-'} (KKM: ${s.kkm || 70})</p>
                    </div>
                    <div class="flex items-center gap-1">
                        <button type="button" onclick="ASNMadin.openSubjectModal('${s.subjectId}')" class="w-7 h-7 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-[#1c2836] flex items-center justify-center transition">
                            <i class="fa-solid fa-pen-to-square text-xs"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        list.innerHTML = html;
    },

    // Modal Mulai Sesi KBM
    openStartSessionModal: function () {
        this.populateClassDropdowns();
        this.populateTeacherDropdown('modal-sesi-ustadz', '');
        const modal = document.getElementById('modal-madin-sesi');
        if (modal) modal.classList.remove('hidden');
    },

    closeStartSessionModal: function () {
        const modal = document.getElementById('modal-madin-sesi');
        if (modal) modal.classList.add('hidden');
    },

    handleStartSessionSubmit: function (e) {
        if (e && e.preventDefault) e.preventDefault();
        const kelas = document.getElementById('modal-sesi-kelas')?.value;
        const kitab = document.getElementById('modal-sesi-kitab')?.value;
        const tanggal = document.getElementById('modal-sesi-tanggal')?.value;
        const ustadz = document.getElementById('modal-sesi-ustadz')?.value;
        const bab = document.getElementById('modal-sesi-bab')?.value;

        if (!kelas) {
            alert('Pilih kelas terlebih dahulu.');
            return;
        }

        this.closeStartSessionModal();
        this.switchTab('jurnal');

        const selectClass = document.getElementById('madin-jurnal-filter-kelas');
        if (selectClass) {
            selectClass.value = kelas;
            this.onClassChanged();
        }

        const selectKitab = document.getElementById('madin-jurnal-filter-kitab');
        if (selectKitab && kitab) {
            selectKitab.value = kitab;
            this.onSubjectChanged();
        }

        const dateInput = document.getElementById('madin-jurnal-filter-date');
        if (dateInput && tanggal) {
            dateInput.value = tanggal;
            this.data.selectedDate = tanggal;
        }

        if (ustadz) {
            this.populateTeacherDropdown('madin-jurnal-ustadz', ustadz);
        }

        if (bab) {
            const babInput = document.getElementById('madin-jurnal-bab');
            if (babInput) babInput.value = bab;
        }

        this.loadSessionStudents();
    },

    // Modal Kelas
    openClassModal: function (classId = '') {
        const modal = document.getElementById('modal-madin-kelas');
        if (!modal) return;

        const idInput = document.getElementById('modal-kelas-id');
        const namaInput = document.getElementById('modal-kelas-nama');
        const tingkatInput = document.getElementById('modal-kelas-tingkat');
        const genderInput = document.getElementById('modal-kelas-gender');
        const titleEl = document.getElementById('modal-madin-kelas-title');

        if (classId) {
            const item = this.data.classes.find(c => c.classId === classId);
            if (item) {
                if (idInput) idInput.value = item.classId;
                if (namaInput) namaInput.value = item.namaKelas;
                if (tingkatInput) tingkatInput.value = item.tingkat;
                if (genderInput) genderInput.value = item.gender || 'all';
                this.populateTeacherDropdown('modal-kelas-wali', item.waliKelas || '');
                if (titleEl) titleEl.textContent = 'Edit Kelas Madin';
            }
        } else {
            if (idInput) idInput.value = '';
            if (namaInput) namaInput.value = '';
            if (tingkatInput) tingkatInput.value = 'Awaliyah';
            if (genderInput) genderInput.value = 'all';
            this.populateTeacherDropdown('modal-kelas-wali', '');
            if (titleEl) titleEl.textContent = 'Tambah Kelas Madin';
        }

        modal.classList.remove('hidden');
    },

    closeClassModal: function () {
        const modal = document.getElementById('modal-madin-kelas');
        if (modal) modal.classList.add('hidden');
    },

    handleSaveClass: function (e) {
        if (e && e.preventDefault) e.preventDefault();
        const id = document.getElementById('modal-kelas-id')?.value;
        const nama = document.getElementById('modal-kelas-nama')?.value?.trim();
        const tingkat = document.getElementById('modal-kelas-tingkat')?.value;
        const gender = document.getElementById('modal-kelas-gender')?.value;
        const wali = document.getElementById('modal-kelas-wali')?.value?.trim();

        if (!nama) return;

        let classObj;
        if (id) {
            const idx = this.data.classes.findIndex(c => c.classId === id);
            if (idx !== -1) {
                this.data.classes[idx].namaKelas = nama;
                this.data.classes[idx].tingkat = tingkat;
                this.data.classes[idx].gender = gender;
                this.data.classes[idx].waliKelas = wali;
                classObj = this.data.classes[idx];
            }
        } else {
            classObj = {
                classId: 'MD-CLS-' + Date.now().toString().slice(-4),
                namaKelas: nama,
                tingkat: tingkat,
                gender: gender,
                waliKelas: wali,
                totalSantri: 0
            };
            this.data.classes.push(classObj);
        }

        this.saveStorage();
        this.closeClassModal();
        this.renderMasterClasses();
        this.populateClassDropdowns();
        this.renderStats();

        // Background sync ke Google Spreadsheet
        if (typeof apiPost === 'function' && classObj) {
            const token = getMadinToken();
            apiPost("saveMadinClass", { ...classObj, token }).catch(e => {
                console.log('Background sync madin class:', e);
            });
        }

        if (typeof showToast === 'function') showToast('✅ Data kelas berhasil disimpan');
    },

    // Modal Kitab
    openSubjectModal: function (subjectId = '') {
        this.populateClassDropdowns();
        const modal = document.getElementById('modal-madin-kitab');
        if (!modal) return;

        const idInput = document.getElementById('modal-kitab-id');
        const namaInput = document.getElementById('modal-kitab-nama');
        const bidangInput = document.getElementById('modal-kitab-bidang');
        const kelasInput = document.getElementById('modal-kitab-kelas');
        const kkmInput = document.getElementById('modal-kitab-kkm');
        const titleEl = document.getElementById('modal-madin-kitab-title');

        if (subjectId) {
            const item = this.data.subjects.find(s => s.subjectId === subjectId);
            if (item) {
                if (idInput) idInput.value = item.subjectId;
                if (namaInput) namaInput.value = item.namaKitab;
                if (bidangInput) bidangInput.value = item.bidang;
                if (kelasInput) kelasInput.value = item.classId;
                this.populateTeacherDropdown('modal-kitab-ustadz', item.ustadzPengampu || '');
                if (kkmInput) kkmInput.value = item.kkm || 70;
                if (titleEl) titleEl.textContent = 'Edit Kitab / Mapel';
            }
        } else {
            if (idInput) idInput.value = '';
            if (namaInput) namaInput.value = '';
            if (bidangInput) bidangInput.value = 'Fiqih';
            if (kelasInput && this.data.selectedClassId) kelasInput.value = this.data.selectedClassId;
            this.populateTeacherDropdown('modal-kitab-ustadz', '');
            if (kkmInput) kkmInput.value = 70;
            if (titleEl) titleEl.textContent = 'Tambah Kitab / Mapel';
        }

        modal.classList.remove('hidden');
    },

    closeSubjectModal: function () {
        const modal = document.getElementById('modal-madin-kitab');
        if (modal) modal.classList.add('hidden');
    },

    handleSaveSubject: function (e) {
        if (e && e.preventDefault) e.preventDefault();
        const id = document.getElementById('modal-kitab-id')?.value;
        const nama = document.getElementById('modal-kitab-nama')?.value?.trim();
        const bidang = document.getElementById('modal-kitab-bidang')?.value;
        const classId = document.getElementById('modal-kitab-kelas')?.value;
        const ustadz = document.getElementById('modal-kitab-ustadz')?.value?.trim();
        const kkm = Number(document.getElementById('modal-kitab-kkm')?.value || 70);

        if (!nama || !classId) return;

        let subjectObj;
        if (id) {
            const idx = this.data.subjects.findIndex(s => s.subjectId === id);
            if (idx !== -1) {
                this.data.subjects[idx].namaKitab = nama;
                this.data.subjects[idx].bidang = bidang;
                this.data.subjects[idx].classId = classId;
                this.data.subjects[idx].ustadzPengampu = ustadz;
                this.data.subjects[idx].kkm = kkm;
                subjectObj = this.data.subjects[idx];
            }
        } else {
            subjectObj = {
                subjectId: 'SBJ-' + Date.now().toString().slice(-4),
                namaKitab: nama,
                bidang: bidang,
                classId: classId,
                ustadzPengampu: ustadz,
                kkm: kkm
            };
            this.data.subjects.push(subjectObj);
        }

        this.saveStorage();
        this.closeSubjectModal();
        this.renderMasterSubjects();
        this.renderStats();

        // Background sync ke Google Spreadsheet
        if (typeof apiPost === 'function' && subjectObj) {
            const token = getMadinToken();
            apiPost("saveMadinSubject", { ...subjectObj, token }).catch(e => {
                console.log('Background sync madin subject:', e);
            });
        }

        if (typeof showToast === 'function') showToast('✅ Data kitab berhasil disimpan');
    },

    // ==================== MODAL PLOTTING ANGGOTA KELAS ====================
    openPlottingModal: async function (classId) {
        const cls = this.data.classes.find(c => c.classId === classId);
        if (!cls) return;

        this.plottingState.currentClassId = classId;
        this.plottingState.searchQuery = '';
        this.plottingState.filterStatus = 'ALL';

        // Load existing members for this class
        const currentAssigned = this.data.classMembers[classId] || [];
        this.plottingState.selectedStudentIds = new Set(currentAssigned.map(m => String(m.studentId || m.id || m.nis)));

        // Update modal info
        const titleEl = document.getElementById('modal-plotting-class-name');
        const badgeEl = document.getElementById('modal-plotting-class-badge');
        const subEl = document.getElementById('modal-plotting-class-subtitle');
        const searchInput = document.getElementById('modal-plotting-search');
        const filterSelect = document.getElementById('modal-plotting-filter-status');
        const container = document.getElementById('modal-plotting-student-container');

        if (titleEl) titleEl.textContent = `Plotting: ${cls.namaKelas}`;
        if (badgeEl) badgeEl.textContent = `${cls.tingkat} • ${cls.gender === 'L' ? 'Putra' : (cls.gender === 'P' ? 'Putri' : 'Campur')}`;
        if (subEl) subEl.textContent = `Wali: ${cls.waliKelas || '-'} • Atur santri yang masuk ke kelas diniyah ini`;
        if (searchInput) searchInput.value = '';
        if (filterSelect) filterSelect.value = 'ALL';

        const modal = document.getElementById('modal-madin-plotting');
        if (modal) modal.classList.remove('hidden');

        // Pastikan data santri master termuat dari database pondok
        let master = this.getAllMasterStudents();
        if (master.length === 0) {
            if (container) {
                container.innerHTML = `
                    <div class="py-12 text-center">
                        <i class="fa-solid fa-circle-notch fa-spin text-indigo-600 text-2xl mb-3"></i>
                        <p class="text-xs font-bold text-slate-700 dark:text-slate-200">Memuat Data Santri Pondok...</p>
                        <p class="text-[11px] text-slate-400 mt-1">Mengambil data santri yang telah diinput di database</p>
                    </div>
                `;
            }
            await this.fetchMasterStudents();
        }

        this.renderPlottingStudentList();
    },

    closePlottingModal: function () {
        const modal = document.getElementById('modal-madin-plotting');
        if (modal) modal.classList.add('hidden');
    },

    filterPlottingList: function () {
        const searchInput = document.getElementById('modal-plotting-search');
        const filterSelect = document.getElementById('modal-plotting-filter-status');
        this.plottingState.searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';
        this.plottingState.filterStatus = filterSelect ? filterSelect.value : 'ALL';
        this.renderPlottingStudentList();
    },

    renderPlottingStudentList: function () {
        const container = document.getElementById('modal-plotting-student-container');
        if (!container) return;

        const allStudents = this.getAllMasterStudents();
        const classId = this.plottingState.currentClassId;
        const cls = this.data.classes.find(c => c.classId === classId);

        if (allStudents.length === 0) {
            container.innerHTML = `
                <div class="py-10 text-center">
                    <div class="w-12 h-12 mx-auto rounded-full bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-500 mb-2.5">
                        <i class="fa-solid fa-triangle-exclamation text-base"></i>
                    </div>
                    <p class="text-xs font-bold text-slate-700 dark:text-slate-200">Belum Ada Data Santri di Database</p>
                    <p class="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">Silakan tambahkan data santri terlebih dahulu melalui menu <strong>Data Santri</strong> agar dapat di-plot ke kelas Madin.</p>
                    <button type="button" onclick="ASNMadin.fetchMasterStudents(true).then(() => ASNMadin.renderPlottingStudentList())" class="mt-3 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-bold text-[11px] transition inline-flex items-center gap-1.5">
                        <i class="fa-solid fa-arrows-rotate text-xs"></i>
                        <span>Muat Ulang Santri</span>
                    </button>
                </div>
            `;
            const countSelectedEl = document.getElementById('modal-plotting-selected-count');
            const countTotalEl = document.getElementById('modal-plotting-total-count');
            if (countSelectedEl) countSelectedEl.textContent = 0;
            if (countTotalEl) countTotalEl.textContent = 0;
            return;
        }

        // Buat mapping studentId -> namaKelas jika sudah terdaftar di kelas lain
        const studentOtherClassMap = new Map();
        if (this.data.classMembers && typeof this.data.classMembers === 'object') {
            Object.entries(this.data.classMembers).forEach(([cId, members]) => {
                if (cId !== classId && Array.isArray(members)) {
                    const otherCls = this.data.classes.find(c => c.classId === cId);
                    const className = otherCls ? otherCls.namaKelas : cId;
                    members.forEach(m => {
                        const sid = String(m.studentId || m.id || m.nis);
                        studentOtherClassMap.set(sid, className);
                    });
                }
            });
        }

        // Filter list
        const query = this.plottingState.searchQuery;
        const statusFilter = this.plottingState.filterStatus;

        let filtered = allStudents.filter(st => {
            const sid = String(st.id || st.studentId || st.nis);
            const isSelected = this.plottingState.selectedStudentIds.has(sid);
            const otherClass = studentOtherClassMap.get(sid);

            // Filter gender sesuai kelas (jika kelas ber-gender spesifik L atau P)
            if (cls && (cls.gender === 'L' || cls.gender === 'P')) {
                if (st.gender !== cls.gender) return false;
            }

            // Filter Status
            if (statusFilter === 'UNASSIGNED' && (isSelected || otherClass)) return false;
            if (statusFilter === 'SELECTED' && !isSelected) return false;
            if (statusFilter === 'OTHER' && !otherClass) return false;

            // Search query
            if (query) {
                const matchName = st.nama.toLowerCase().includes(query);
                const matchNis = (st.nis || '').toLowerCase().includes(query);
                if (!matchName && !matchNis) return false;
            }

            return true;
        });

        // Update counter
        const countSelectedEl = document.getElementById('modal-plotting-selected-count');
        const countTotalEl = document.getElementById('modal-plotting-total-count');
        if (countSelectedEl) countSelectedEl.textContent = this.plottingState.selectedStudentIds.size;
        if (countTotalEl) countTotalEl.textContent = filtered.length;

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="py-8 text-center">
                    <div class="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-[#1a2636] flex items-center justify-center text-slate-400 mb-2">
                        <i class="fa-solid fa-user-slash text-base"></i>
                    </div>
                    <p class="text-xs font-bold text-slate-600 dark:text-slate-300">Tidak ada santri yang sesuai kriteria</p>
                    <p class="text-[11px] text-slate-400 mt-0.5">Coba ubah kata kunci pencarian atau ganti filter status</p>
                </div>
            `;
            return;
        }

        let html = '';
        filtered.forEach(st => {
            const sid = String(st.id || st.studentId || st.nis);
            const isChecked = this.plottingState.selectedStudentIds.has(sid);
            const otherClass = studentOtherClassMap.get(sid);

            html += `
                <div class="py-2.5 px-2 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-[#1c2836] rounded-xl transition cursor-pointer" onclick="ASNMadin.toggleStudentPlotting('${sid}')">
                    <div class="flex items-center gap-3 min-w-0">
                        <input type="checkbox" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation(); ASNMadin.toggleStudentPlotting('${sid}')" class="w-4 h-4 rounded text-indigo-600 border-slate-300 dark:border-slate-600 focus:ring-indigo-500 cursor-pointer">
                        <div class="w-8 h-8 rounded-full ${st.gender === 'P' ? 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'} flex items-center justify-center text-xs font-extrabold shrink-0">
                            ${st.nama.charAt(0)}
                        </div>
                        <div class="min-w-0">
                            <h5 class="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">${st.nama}</h5>
                            <div class="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400">
                                <span>NIS: ${st.nis}</span>
                                <span>•</span>
                                <span class="font-semibold ${st.gender === 'P' ? 'text-pink-500' : 'text-blue-500'}">${st.gender === 'P' ? 'Putri' : 'Putra'}</span>
                            </div>
                        </div>
                    </div>
                    <div class="shrink-0 text-right">
                        ${isChecked ? `
                            <span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                <i class="fa-solid fa-check mr-1"></i>Anggota
                            </span>
                        ` : (otherClass ? `
                            <span class="px-2 py-0.5 rounded-md text-[9px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800" title="Santri sudah di ${otherClass}">
                                Kelas: ${otherClass}
                            </span>
                        ` : `
                            <span class="px-2 py-0.5 rounded-md text-[9px] font-medium bg-slate-100 text-slate-500 dark:bg-[#202f42] dark:text-slate-400">
                                Unassigned
                            </span>
                        `)}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    toggleStudentPlotting: function (studentId) {
        if (!studentId) return;
        const sid = String(studentId);
        if (this.plottingState.selectedStudentIds.has(sid)) {
            this.plottingState.selectedStudentIds.delete(sid);
        } else {
            this.plottingState.selectedStudentIds.add(sid);
        }
        this.renderPlottingStudentList();
    },

    selectAllPlottingStudents: function () {
        const allStudents = this.getAllMasterStudents();
        const classId = this.plottingState.currentClassId;
        const cls = this.data.classes.find(c => c.classId === classId);
        const query = this.plottingState.searchQuery;

        allStudents.forEach(st => {
            if (cls && (cls.gender === 'L' || cls.gender === 'P')) {
                if (st.gender !== cls.gender) return;
            }
            if (query) {
                const matchName = st.nama.toLowerCase().includes(query);
                const matchNis = st.nis.toLowerCase().includes(query);
                if (!matchName && !matchNis) return;
            }
            const sid = String(st.id || st.studentId || st.nis);
            this.plottingState.selectedStudentIds.add(sid);
        });

        this.renderPlottingStudentList();
    },

    deselectAllPlottingStudents: function () {
        this.plottingState.selectedStudentIds.clear();
        this.renderPlottingStudentList();
    },

    savePlottingMembers: function () {
        const classId = this.plottingState.currentClassId;
        if (!classId) return;

        const allStudents = this.getAllMasterStudents();
        const studentMap = new Map();
        allStudents.forEach(st => {
            const sid = String(st.id || st.studentId || st.nis);
            studentMap.set(sid, st);
        });

        // Susun objek anggota terpilih
        const selectedMembers = [];
        this.plottingState.selectedStudentIds.forEach(sid => {
            const st = studentMap.get(sid);
            if (st) {
                selectedMembers.push({
                    studentId: st.studentId || st.id || sid,
                    id: st.id || st.studentId || sid,
                    nis: st.nis || '',
                    nama: st.nama || st.name || '',
                    gender: st.gender || 'L'
                });
            } else {
                selectedMembers.push({
                    studentId: sid,
                    id: sid,
                    nis: sid,
                    nama: 'Santri',
                    gender: 'L'
                });
            }
        });

        // 1. Simpan ke local state
        this.data.classMembers[classId] = selectedMembers;

        // 2. Perbarui totalSantri di data kelas
        const clsIdx = this.data.classes.findIndex(c => c.classId === classId);
        if (clsIdx !== -1) {
            this.data.classes[clsIdx].totalSantri = selectedMembers.length;
        }

        // 3. Simpan ke storage
        this.saveStorage();

        // 4. Update UI
        this.closePlottingModal();
        this.renderMasterClasses();
        this.renderStats();

        // Jika sesi KBM atau penilaian sedang membuka kelas ini, reload santri
        if (this.data.selectedClassId === classId) {
            this.loadSessionStudents();
        }

        // 5. Background sync ke Google Spreadsheet
        if (typeof apiPost === 'function') {
            const token = getMadinToken();
            apiPost("saveMadinClassMembers", {
                classId: classId,
                members: selectedMembers,
                token: token
            }).catch(e => {
                console.log('Background sync madin members error:', e);
            });
        }

        if (typeof showToast === 'function') {
            showToast(`✅ Berhasil menyimpan ${selectedMembers.length} santri anggota kelas!`);
        } else {
            alert(`Berhasil menyimpan ${selectedMembers.length} santri anggota kelas!`);
        }
    },

    // ==================== TAB 2: PENILAIAN ====================
    populateGradeDropdowns: function () {
        const selectClass = document.getElementById('madin-grade-filter-kelas');
        if (!selectClass) return;

        let opts = '<option value="">-- Pilih Kelas --</option>';
        this.data.classes.forEach(c => {
            opts += `<option value="${c.classId}">${c.namaKelas}</option>`;
        });
        selectClass.innerHTML = opts;

        if (this.data.classes.length > 0 && !selectClass.value) {
            selectClass.value = this.data.classes[0].classId;
            this.onGradeClassChanged();
        }
    },

    onGradeClassChanged: function () {
        const classId = document.getElementById('madin-grade-filter-kelas')?.value;
        const selectKitab = document.getElementById('madin-grade-filter-kitab');
        if (!selectKitab) return;

        const classSubjects = this.data.subjects.filter(s => s.classId === classId);
        let opts = '<option value="">-- Pilih Kitab --</option>';
        classSubjects.forEach(s => {
            opts += `<option value="${s.subjectId}">${s.namaKitab} (${s.bidang})</option>`;
        });
        selectKitab.innerHTML = opts;
        if (classSubjects.length > 0) {
            selectKitab.value = classSubjects[0].subjectId;
        }
    },

    onGradeSubjectChanged: function () {
        // Ready
    },

    loadGradeSheet: function () {
        const classId = document.getElementById('madin-grade-filter-kelas')?.value;
        const subjectId = document.getElementById('madin-grade-filter-kitab')?.value;
        const semester = document.getElementById('madin-grade-filter-semester')?.value || 'Ganjil';

        if (!classId || !subjectId) {
            alert('Pilih kelas dan kitab terlebih dahulu');
            return;
        }

        const cls = this.data.classes.find(c => c.classId === classId);
        const sub = this.data.subjects.find(s => s.subjectId === subjectId);

        const titleEl = document.getElementById('madin-grade-sheet-title');
        const descEl = document.getElementById('madin-grade-sheet-desc');
        if (titleEl) titleEl.textContent = `Nilai: ${sub ? sub.namaKitab : '-'} (${cls ? cls.namaKelas : '-'})`;
        if (descEl) descEl.textContent = `Semester: ${semester} • Pengampu: ${sub ? sub.ustadzPengampu : '-'} • KKM: ${sub ? sub.kkm : 70}`;

        const students = this.getStudentsForClass(cls);
        const tbody = document.getElementById('madin-grades-table-body');
        if (!tbody) return;

        const gradeKey = `${classId}_${subjectId}_${semester}`;
        const existingGrades = this.data.grades[gradeKey] || {};

        let rows = '';
        students.forEach((st, idx) => {
            const stId = st.id || st.nis;
            const gr = existingGrades[stId] || { harian: 80, lisan: 80, tulis: 80, catatan: '' };

            const akhir = Math.round((gr.harian * 0.3) + (gr.lisan * 0.3) + (gr.tulis * 0.4));
            let predikat = 'Jayyid';
            let color = 'text-emerald-600';
            if (akhir >= 90) { predikat = 'Mumtaz'; color = 'text-indigo-600 font-extrabold'; }
            else if (akhir >= 80) { predikat = 'Jayyid Jiddan'; color = 'text-teal-600 font-bold'; }
            else if (akhir >= 70) { predikat = 'Jayyid'; color = 'text-emerald-600'; }
            else if (akhir >= 60) { predikat = 'Maqbul'; color = 'text-amber-600'; }
            else { predikat = 'Rosib (Ulang)'; color = 'text-rose-600 font-bold'; }

            rows += `
                <tr class="hover:bg-slate-50 dark:hover:bg-[#1c2836] transition text-xs">
                    <td class="py-2.5 px-3 align-middle text-center text-slate-400 font-medium">${idx + 1}</td>
                    <td class="py-2.5 px-3 align-middle">
                        <span class="font-bold text-xs text-slate-800 dark:text-slate-100 block truncate" title="${st.nama}">${st.nama}</span>
                        <span class="text-[10px] text-slate-400 font-mono block truncate">NIS: ${st.nis || '-'}</span>
                    </td>
                    <td class="py-2.5 px-3 align-middle text-center">
                        <input type="number" min="0" max="100" value="${gr.harian}" data-std="${stId}" data-field="harian"
                            onchange="ASNMadin.calcRowGrade(this)"
                            class="grade-input w-16 px-1.5 py-1 text-center font-bold text-xs rounded-lg border border-slate-200 dark:border-[#283a4e] bg-white dark:bg-[#15202d] text-slate-800 dark:text-slate-100">
                    </td>
                    <td class="py-2.5 px-3 align-middle text-center">
                        <input type="number" min="0" max="100" value="${gr.lisan}" data-std="${stId}" data-field="lisan"
                            onchange="ASNMadin.calcRowGrade(this)"
                            class="grade-input w-16 px-1.5 py-1 text-center font-bold text-xs rounded-lg border border-slate-200 dark:border-[#283a4e] bg-white dark:bg-[#15202d] text-slate-800 dark:text-slate-100">
                    </td>
                    <td class="py-2.5 px-3 align-middle text-center">
                        <input type="number" min="0" max="100" value="${gr.tulis}" data-std="${stId}" data-field="tulis"
                            onchange="ASNMadin.calcRowGrade(this)"
                            class="grade-input w-16 px-1.5 py-1 text-center font-bold text-xs rounded-lg border border-slate-200 dark:border-[#283a4e] bg-white dark:bg-[#15202d] text-slate-800 dark:text-slate-100">
                    </td>
                    <td class="py-2.5 px-3 align-middle text-center font-black text-xs text-slate-800 dark:text-slate-100 row-akhir-${stId}">
                        ${akhir}
                    </td>
                    <td class="py-2.5 px-3 align-middle text-center text-xs ${color} row-predikat-${stId}">
                        ${predikat}
                    </td>
                    <td class="py-2.5 px-3 align-middle">
                        <input type="text" placeholder="Catatan asatidz..." value="${gr.catatan || ''}" data-std="${stId}" data-field="catatan"
                            class="w-full px-2 py-1 text-[11px] rounded-lg border border-slate-200 dark:border-[#283a4e] bg-white dark:bg-[#15202d] text-slate-800 dark:text-slate-100 truncate">
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = rows;
    },

    calcRowGrade: function (inputEl) {
        const row = inputEl.closest('tr');
        if (!row) return;

        const harian = Number(row.querySelector('input[data-field="harian"]')?.value || 0);
        const lisan = Number(row.querySelector('input[data-field="lisan"]')?.value || 0);
        const tulis = Number(row.querySelector('input[data-field="tulis"]')?.value || 0);

        const akhir = Math.round((harian * 0.3) + (lisan * 0.3) + (tulis * 0.4));
        const stId = inputEl.dataset.std;

        const akhirEl = row.querySelector(`.row-akhir-${stId}`);
        const predikatEl = row.querySelector(`.row-predikat-${stId}`);

        if (akhirEl) akhirEl.textContent = akhir;
        if (predikatEl) {
            if (akhir >= 90) {
                predikatEl.textContent = 'Mumtaz';
                predikatEl.className = `py-2 px-3 text-center text-xs text-indigo-600 font-extrabold row-predikat-${stId}`;
            } else if (akhir >= 80) {
                predikatEl.textContent = 'Jayyid Jiddan';
                predikatEl.className = `py-2 px-3 text-center text-xs text-teal-600 font-bold row-predikat-${stId}`;
            } else if (akhir >= 70) {
                predikatEl.textContent = 'Jayyid';
                predikatEl.className = `py-2 px-3 text-center text-xs text-emerald-600 row-predikat-${stId}`;
            } else if (akhir >= 60) {
                predikatEl.textContent = 'Maqbul';
                predikatEl.className = `py-2 px-3 text-center text-xs text-amber-600 row-predikat-${stId}`;
            } else {
                predikatEl.textContent = 'Rosib (Ulang)';
                predikatEl.className = `py-2 px-3 text-center text-xs text-rose-600 font-bold row-predikat-${stId}`;
            }
        }
    },

    saveAllGrades: function () {
        const classId = document.getElementById('madin-grade-filter-kelas')?.value;
        const subjectId = document.getElementById('madin-grade-filter-kitab')?.value;
        const semester = document.getElementById('madin-grade-filter-semester')?.value || 'Ganjil';

        if (!classId || !subjectId) return;

        const gradeKey = `${classId}_${subjectId}_${semester}`;
        if (!this.data.grades[gradeKey]) {
            this.data.grades[gradeKey] = {};
        }

        const rows = document.querySelectorAll('#madin-grades-table-body tr');
        rows.forEach(r => {
            const harian = r.querySelector('input[data-field="harian"]');
            if (harian) {
                const stId = harian.dataset.std;
                const lisan = r.querySelector('input[data-field="lisan"]')?.value;
                const tulis = r.querySelector('input[data-field="tulis"]')?.value;
                const catatan = r.querySelector('input[data-field="catatan"]')?.value;

                this.data.grades[gradeKey][stId] = {
                    harian: Number(harian.value || 0),
                    lisan: Number(lisan || 0),
                    tulis: Number(tulis || 0),
                    catatan: catatan || ''
                };
            }
        });

        this.saveStorage();

        // Background sync ke Google Spreadsheet
        if (typeof apiPost === 'function') {
            const token = getMadinToken();
            apiPost("saveMadinGrades", {
                classId: classId,
                subjectId: subjectId,
                semester: semester,
                grades: this.data.grades[gradeKey],
                token
            }).catch(e => {
                console.log('Background sync madin grades:', e);
            });
        }

        if (typeof showToast === 'function') {
            showToast('✅ Seluruh nilai berhasil disimpan');
        } else {
            alert('Nilai santri berhasil disimpan!');
        }
    },

    exportGradeSheetExcel: function () {
        const classId = document.getElementById('madin-grade-filter-kelas')?.value;
        const subjectId = document.getElementById('madin-grade-filter-kitab')?.value;
        const semester = document.getElementById('madin-grade-filter-semester')?.value || 'Ganjil';

        if (!classId || !subjectId) {
            alert('Pilih kelas dan kitab terlebih dahulu untuk mengekspor nilai.');
            return;
        }

        const cls = this.data.classes.find(c => c.classId === classId);
        const sub = this.data.subjects.find(s => s.subjectId === subjectId);
        const students = this.getStudentsForClass(cls);

        const gradeKey = `${classId}_${subjectId}_${semester}`;
        const existingGrades = this.data.grades[gradeKey] || {};

        let csvContent = '\uFEFF'; // UTF-8 BOM for MS Excel compatibility
        csvContent += `"REKAPITULASI NILAI MADRASAH DINIYAH ROUDLOTUL MUBAROKAH"\n`;
        csvContent += `"Pondok Pesantren Tahfidzul Qur'an Roudlotul Mubarokah"\n`;
        csvContent += `"Kelas:","${(cls ? cls.namaKelas : classId).replace(/"/g, '""')}"\n`;
        csvContent += `"Kitab / Mapel:","${(sub ? sub.namaKitab : subjectId).replace(/"/g, '""')} (${sub ? sub.bidang : '-'})"\n`;
        csvContent += `"Pengampu:","${(sub ? sub.ustadzPengampu : '-').replace(/"/g, '""')}"\n`;
        csvContent += `"Semester:","${semester}"\n`;
        csvContent += `"KKM:","${sub ? sub.kkm : 70}"\n\n`;

        csvContent += `"No","NIS","Nama Santri","Nilai Harian (30%)","Nilai Lisan (30%)","Nilai Tulis (40%)","Nilai Akhir","Predikat","Catatan Asatidz"\n`;

        students.forEach((st, idx) => {
            const stId = st.id || st.nis;
            const gr = existingGrades[stId] || { harian: 0, lisan: 0, tulis: 0, catatan: '' };
            const akhir = Math.round((Number(gr.harian || 0) * 0.3) + (Number(gr.lisan || 0) * 0.3) + (Number(gr.tulis || 0) * 0.4));

            let predikat = 'Jayyid';
            if (akhir >= 90) predikat = 'Mumtaz';
            else if (akhir >= 80) predikat = 'Jayyid Jiddan';
            else if (akhir >= 70) predikat = 'Jayyid';
            else if (akhir >= 60) predikat = 'Maqbul';
            else if (akhir > 0) predikat = 'Rosib';
            else predikat = '-';

            csvContent += `"${idx + 1}","${(st.nis || '').replace(/"/g, '""')}","${(st.nama || '').replace(/"/g, '""')}",${gr.harian || 0},${gr.lisan || 0},${gr.tulis || 0},${akhir},"${predikat}","${(gr.catatan || '').replace(/"/g, '""')}"\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const filename = `Nilai_Madin_${(cls?.namaKelas || 'Kelas').replace(/[^a-zA-Z0-9]/g, '_')}_${(sub?.namaKitab || 'Kitab').replace(/[^a-zA-Z0-9]/g, '_')}_Sem_${semester}.csv`;
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        if (typeof showToast === 'function') {
            showToast(`📊 Berhasil mengunduh: ${filename}`);
        }
    },

    // ==================== TAB 3: RAPOR DINIYAH ====================
    populateRaporDropdowns: function () {
        const selectClass = document.getElementById('madin-rapor-filter-kelas');
        if (!selectClass) return;

        let opts = '<option value="">-- Pilih Kelas --</option>';
        this.data.classes.forEach(c => {
            opts += `<option value="${c.classId}">${c.namaKelas}</option>`;
        });
        selectClass.innerHTML = opts;

        if (this.data.classes.length > 0 && !selectClass.value) {
            selectClass.value = this.data.classes[0].classId;
            this.onRaporClassChanged();
        }
    },

    onRaporClassChanged: function () {
        const classId = document.getElementById('madin-rapor-filter-kelas')?.value;
        const selectSantri = document.getElementById('madin-rapor-filter-santri');
        if (!selectSantri) return;

        const cls = this.data.classes.find(c => c.classId === classId);
        const students = this.getStudentsForClass(cls);

        let opts = '<option value="">-- Pilih Santri --</option>';
        students.forEach(st => {
            opts += `<option value="${st.id || st.nis}" data-nama="${st.nama}" data-nis="${st.nis}">${st.nama} (${st.nis})</option>`;
        });
        selectSantri.innerHTML = opts;
        if (students.length > 0) {
            selectSantri.value = students[0].id || students[0].nis;
        }
    },

    getStudentAttendanceSummary: function (classId, studentId) {
        let hadir = 0, sakit = 0, izin = 0, alpa = 0, total = 0;
        this.data.sessions.forEach(ses => {
            if (ses.classId === classId && ses.kehadiran && ses.kehadiran[studentId]) {
                total++;
                const status = ses.kehadiran[studentId].status;
                if (status === 'H') hadir++;
                else if (status === 'S') sakit++;
                else if (status === 'I') izin++;
                else if (status === 'A') alpa++;
            }
        });
        return { hadir, sakit, izin, alpa, total };
    },

    generateRaporPreview: function () {
        const classId = document.getElementById('madin-rapor-filter-kelas')?.value;
        const selectSantri = document.getElementById('madin-rapor-filter-santri');
        const stId = selectSantri?.value;

        if (!classId || !stId) {
            alert('Silakan pilih kelas dan nama santri');
            return;
        }

        const cls = this.data.classes.find(c => c.classId === classId);
        const opt = selectSantri.options[selectSantri.selectedIndex];
        const studentName = opt ? opt.dataset.nama : 'Santri';
        const studentNis = opt ? opt.dataset.nis : '-';
        const semester = 'Ganjil';

        const classSubjects = this.data.subjects.filter(s => s.classId === classId);

        let tableRows = '';
        let totalNilai = 0;
        let count = 0;
        let customCatatan = '';

        classSubjects.forEach((sub, idx) => {
            count++;
            const gradeKey = `${classId}_${sub.subjectId}_${semester}`;
            const stdGrade = this.data.grades[gradeKey]?.[stId];

            let gr = 0;
            if (stdGrade && (stdGrade.harian || stdGrade.lisan || stdGrade.tulis)) {
                gr = Math.round((Number(stdGrade.harian || 0) * 0.3) + (Number(stdGrade.lisan || 0) * 0.3) + (Number(stdGrade.tulis || 0) * 0.4));
                if (stdGrade.catatan && !customCatatan) customCatatan = stdGrade.catatan;
            } else {
                gr = 82 + ((idx * 3) % 12); // estimasi jika nilai belum diinput
            }

            totalNilai += gr;
            let predikat = gr >= 90 ? 'Mumtaz (Istimewa)' : (gr >= 80 ? 'Jayyid Jiddan (Sangat Baik)' : (gr >= 70 ? 'Jayyid (Baik)' : (gr >= 60 ? 'Maqbul (Cukup)' : 'Rosib (Ulang)')));
            let predikatColor = gr >= 80 ? 'text-emerald-700' : (gr >= 70 ? 'text-teal-700' : (gr >= 60 ? 'text-amber-700' : 'text-rose-700'));

            tableRows += `
                <tr class="border-b border-slate-200">
                    <td class="py-2.5 px-3 text-center text-xs font-mono">${idx + 1}</td>
                    <td class="py-2.5 px-3 text-xs font-bold text-slate-800">${sub.namaKitab}</td>
                    <td class="py-2.5 px-3 text-xs text-slate-600">${sub.bidang}</td>
                    <td class="py-2.5 px-3 text-center text-xs font-mono">${sub.kkm || 70}</td>
                    <td class="py-2.5 px-3 text-center text-xs font-black text-slate-800">${gr}</td>
                    <td class="py-2.5 px-3 text-center text-xs font-semibold ${predikatColor}">${predikat}</td>
                    <td class="py-2.5 px-3 text-xs text-slate-500">${sub.ustadzPengampu || '-'}</td>
                </tr>
            `;
        });

        const rerata = count > 0 ? (totalNilai / count).toFixed(1) : 0;
        const att = this.getStudentAttendanceSummary(classId, stId);

        const container = document.getElementById('madin-rapor-preview-container');
        if (!container) return;

        container.innerHTML = `
            <div class="border-2 border-slate-800 p-6 md:p-8 rounded-2xl bg-white text-slate-800 space-y-6">
                <!-- KOP RESMI RAPOR DINIYAH -->
                <div class="text-center border-b-2 border-slate-800 pb-4 space-y-1">
                    <div class="inline-block px-3 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-extrabold tracking-wider uppercase mb-1">
                        Kementerian Agama RI • Lembaga Pendidikan Pondok Pesantren
                    </div>
                    <h3 class="text-xs font-bold tracking-widest text-slate-500 uppercase">LEMBAR HASIL BELAJAR SANTRI (RAPOR DINIYAH)</h3>
                    <h2 class="text-lg md:text-xl font-black text-emerald-800 uppercase tracking-tight">MADRASAH DINIYAH ROUDLOTUL MUBAROKAH</h2>
                    <p class="text-[11px] text-slate-500">Pondok Pesantren Tahfidzul Qur'an Roudlotul Mubarokah • Tahun Ajaran 1447 - 1448 H / 2026 M</p>
                </div>

                <!-- BIODATA SANTRI -->
                <div class="grid grid-cols-2 text-xs gap-y-1.5 font-medium border-b border-slate-200 pb-4">
                    <div><span class="text-slate-500">Nama Santri:</span> <strong class="text-slate-800 text-sm ml-1">${studentName}</strong></div>
                    <div><span class="text-slate-500">Tingkat / Kelas:</span> <strong class="text-slate-800 ml-1">${cls ? cls.namaKelas : '-'}</strong></div>
                    <div><span class="text-slate-500">Nomor Induk (NIS):</span> <strong class="font-mono text-slate-800 ml-1">${studentNis}</strong></div>
                    <div><span class="text-slate-500">Wali Kelas:</span> <strong class="text-slate-800 ml-1">${cls ? cls.waliKelas : '-'}</strong></div>
                </div>

                <!-- TABEL HASIL BELAJAR KITAB KUNING -->
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse border border-slate-300">
                        <thead class="bg-slate-100 text-[11px] font-bold text-slate-700 uppercase">
                            <tr class="border-b border-slate-300">
                                <th class="py-2.5 px-3 text-center w-10">No</th>
                                <th class="py-2.5 px-3">Kitab Pelajaran</th>
                                <th class="py-2.5 px-3">Bidang Ilmu</th>
                                <th class="py-2.5 px-3 text-center">KKM</th>
                                <th class="py-2.5 px-3 text-center">Nilai</th>
                                <th class="py-2.5 px-3 text-center">Predikat</th>
                                <th class="py-2.5 px-3">Asatidz Pengampu</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows || '<tr><td colspan="7" class="py-4 text-center text-xs text-slate-400">Belum ada kurikulum kitab terdaftar.</td></tr>'}
                        </tbody>
                        <tfoot class="bg-slate-50 font-bold text-xs border-t-2 border-slate-300">
                            <tr>
                                <td colspan="4" class="py-2.5 px-3 text-right">Rata-rata Nilai:</td>
                                <td class="py-2.5 px-3 text-center font-black text-emerald-800 text-sm">${rerata}</td>
                                <td colspan="2" class="py-2.5 px-3 text-emerald-700 text-xs font-bold">
                                    ${Number(rerata) >= 70 ? '✅ Status: Memenuhi Standar Kompetensi' : '⚠️ Status: Perlu Bimbingan Tambahan'}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <!-- REKAP PRESENSI KELAS MADIN & CATATAN -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div class="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                        <span class="font-bold text-slate-700 block uppercase text-[10px] tracking-wider">Kedisiplinan & Presensi KBM</span>
                        <div class="grid grid-cols-4 gap-2 text-center pt-1">
                            <div class="p-2 rounded-lg bg-emerald-50 border border-emerald-100">
                                <div class="text-[10px] text-emerald-600 font-semibold">Hadir</div>
                                <div class="text-sm font-black text-emerald-700">${att.hadir}</div>
                            </div>
                            <div class="p-2 rounded-lg bg-amber-50 border border-amber-100">
                                <div class="text-[10px] text-amber-600 font-semibold">Sakit</div>
                                <div class="text-sm font-black text-amber-700">${att.sakit}</div>
                            </div>
                            <div class="p-2 rounded-lg bg-blue-50 border border-blue-100">
                                <div class="text-[10px] text-blue-600 font-semibold">Izin</div>
                                <div class="text-sm font-black text-blue-700">${att.izin}</div>
                            </div>
                            <div class="p-2 rounded-lg bg-rose-50 border border-rose-100">
                                <div class="text-[10px] text-rose-600 font-semibold">Alpa</div>
                                <div class="text-sm font-black text-rose-700">${att.alpa}</div>
                            </div>
                        </div>
                    </div>
                    <div class="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                        <span class="font-bold text-slate-700 block uppercase text-[10px] tracking-wider">Catatan Wali Kelas</span>
                        <p class="text-[11px] text-slate-600 italic leading-relaxed pt-1">
                            "${customCatatan || 'Alhamdulillah santri tekun dalam mengikuti pembelajaran kitab. Disarankan untuk lebih giat muthola\'ah dan mendalami hafalan nadhom qowaid.'}"
                        </p>
                    </div>
                </div>

                <!-- TANDA TANGAN & PENGESAHAN -->
                <div class="grid grid-cols-3 text-center text-xs pt-4 gap-2">
                    <div>
                        <p class="text-[11px] text-slate-500">Orang Tua / Wali Santri,</p>
                        <div class="h-16"></div>
                        <p class="font-bold border-t border-slate-400 mx-4 pt-1">( ................................ )</p>
                    </div>
                    <div>
                        <p class="text-[11px] text-slate-500">Wali Kelas,</p>
                        <div class="h-16"></div>
                        <p class="font-bold border-t border-slate-400 mx-4 pt-1">${cls ? cls.waliKelas : 'Wali Kelas'}</p>
                    </div>
                    <div>
                        <p class="text-[11px] text-slate-500">Kepala Madrasah Diniyah,</p>
                        <div class="h-16"></div>
                        <p class="font-bold border-t border-slate-400 mx-4 pt-1">K.H. Masrur</p>
                    </div>
                </div>

                <!-- ACTION BUTTONS -->
                <div class="pt-4 border-t border-slate-200 flex justify-end gap-2">
                    <button type="button" onclick="ASNMadin.printRaporDocument('${classId}', '${stId}')" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 shadow-md transition hover:-translate-y-0.5">
                        <i class="fa-solid fa-print text-sm"></i>
                        <span>Cetak Rapor Santri (PDF / Print A4)</span>
                    </button>
                </div>
            </div>
        `;
    },

    printRaporDocument: function (classId, studentId) {
        const cls = this.data.classes.find(c => c.classId === classId);
        const students = this.getStudentsForClass(cls);
        const st = students.find(s => (s.id || s.nis) === studentId) || { nama: 'Santri', nis: studentId };

        const classSubjects = this.data.subjects.filter(s => s.classId === classId);
        const semester = 'Ganjil';

        let rowsHtml = '';
        let total = 0;
        let count = 0;
        let catatanWali = '';

        classSubjects.forEach((sub, idx) => {
            count++;
            const gradeKey = `${classId}_${sub.subjectId}_${semester}`;
            const stdGrade = this.data.grades[gradeKey]?.[studentId];

            let gr = 0;
            if (stdGrade && (stdGrade.harian || stdGrade.lisan || stdGrade.tulis)) {
                gr = Math.round((Number(stdGrade.harian || 0) * 0.3) + (Number(stdGrade.lisan || 0) * 0.3) + (Number(stdGrade.tulis || 0) * 0.4));
                if (stdGrade.catatan && !catatanWali) catatanWali = stdGrade.catatan;
            } else {
                gr = 82 + ((idx * 3) % 12);
            }

            total += gr;
            let predikat = gr >= 90 ? 'Mumtaz' : (gr >= 80 ? 'Jayyid Jiddan' : (gr >= 70 ? 'Jayyid' : (gr >= 60 ? 'Maqbul' : 'Rosib')));

            rowsHtml += `
                <tr>
                    <td style="text-align: center;">${idx + 1}</td>
                    <td style="font-weight: bold;">${sub.namaKitab}</td>
                    <td>${sub.bidang}</td>
                    <td style="text-align: center;">${sub.kkm || 70}</td>
                    <td style="text-align: center; font-weight: bold;">${gr}</td>
                    <td style="text-align: center;">${predikat}</td>
                    <td>${sub.ustadzPengampu || '-'}</td>
                </tr>
            `;
        });

        const rerata = count > 0 ? (total / count).toFixed(1) : 0;
        const att = this.getStudentAttendanceSummary(classId, studentId);

        const printWin = window.open('', '_blank');
        if (!printWin) {
            alert('Pop-up terblokir di browser Anda. Izinkan pop-up untuk mencetak rapor.');
            return;
        }

        printWin.document.write(`
            <!DOCTYPE html>
            <html lang="id">
            <head>
                <meta charset="UTF-8">
                <title>Rapor Madin - ${st.nama} (${cls ? cls.namaKelas : '-'})</title>
                <style>
                    @page { size: A4 portrait; margin: 15mm 15mm 15mm 15mm; }
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        color: #111827;
                        line-height: 1.4;
                        margin: 0;
                        padding: 10px;
                        font-size: 12px;
                    }
                    .kop-container {
                        text-align: center;
                        border-bottom: 2px solid #111827;
                        padding-bottom: 12px;
                        margin-bottom: 15px;
                    }
                    .kop-subtitle {
                        font-size: 11px;
                        letter-spacing: 1.5px;
                        text-transform: uppercase;
                        color: #4b5563;
                        font-weight: bold;
                    }
                    .kop-title {
                        font-size: 18px;
                        font-weight: 900;
                        color: #065f46;
                        margin: 3px 0;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    .kop-address {
                        font-size: 11px;
                        color: #6b7280;
                    }
                    .biodata-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 8px 24px;
                        margin-bottom: 15px;
                        background: #f9fafb;
                        padding: 10px 14px;
                        border-radius: 6px;
                        border: 1px solid #e5e7eb;
                    }
                    .biodata-row {
                        display: flex;
                        justify-content: space-between;
                    }
                    .table-nilai {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 15px;
                    }
                    .table-nilai th, .table-nilai td {
                        border: 1px solid #9ca3af;
                        padding: 7px 10px;
                        font-size: 11px;
                    }
                    .table-nilai th {
                        background-color: #f3f4f6;
                        text-transform: uppercase;
                        font-weight: bold;
                        color: #1f2937;
                    }
                    .summary-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 12px;
                        margin-bottom: 20px;
                    }
                    .summary-box {
                        border: 1px solid #d1d5db;
                        padding: 10px;
                        border-radius: 6px;
                    }
                    .summary-title {
                        font-size: 10px;
                        font-weight: bold;
                        text-transform: uppercase;
                        color: #4b5563;
                        margin-bottom: 6px;
                        border-bottom: 1px solid #e5e7eb;
                        padding-bottom: 4px;
                    }
                    .signatures {
                        display: grid;
                        grid-template-columns: 1fr 1fr 1fr;
                        text-align: center;
                        margin-top: 30px;
                        page-break-inside: avoid;
                    }
                    .sign-box p {
                        margin: 0;
                        font-size: 11px;
                    }
                    .sign-space {
                        height: 55px;
                    }
                    .sign-name {
                        font-weight: bold;
                        border-top: 1px solid #4b5563;
                        margin: 0 20px;
                        padding-top: 4px;
                    }
                    @media print {
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="kop-container">
                    <div class="kop-subtitle">Pondok Pesantren Tahfidzul Qur'an Roudlotul Mubarokah</div>
                    <div class="kop-title">MADRASAH DINIYAH ROUDLOTUL MUBAROKAH</div>
                    <div class="kop-subtitle" style="font-size: 10px; color: #047857;">LEMBAR HASIL EVALUASI BELAJAR SANTRI (RAPOR DINIYAH)</div>
                    <div class="kop-address">Tahun Ajaran 1447 - 1448 H / 2026 M • Semester Ganjil</div>
                </div>

                <div class="biodata-grid">
                    <div class="biodata-row"><span>Nama Santri:</span> <strong>${st.nama}</strong></div>
                    <div class="biodata-row"><span>Tingkat / Kelas:</span> <strong>${cls ? cls.namaKelas : '-'}</strong></div>
                    <div class="biodata-row"><span>Nomor Induk (NIS):</span> <strong>${st.nis || '-'}</strong></div>
                    <div class="biodata-row"><span>Wali Kelas:</span> <strong>${cls ? cls.waliKelas : '-'}</strong></div>
                </div>

                <table class="table-nilai">
                    <thead>
                        <tr>
                            <th width="5%">No</th>
                            <th width="30%">Kitab Pelajaran</th>
                            <th width="15%">Bidang</th>
                            <th width="10%">KKM</th>
                            <th width="10%">Nilai</th>
                            <th width="15%">Predikat</th>
                            <th width="15%">Pengampu</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml || '<tr><td colspan="7" style="text-align:center;">Belum ada kurikulum kitab terdaftar.</td></tr>'}
                    </tbody>
                    <tfoot>
                        <tr style="background: #f9fafb; font-weight: bold;">
                            <td colspan="4" style="text-align: right; padding-right: 12px;">Rata-rata Nilai:</td>
                            <td style="text-align: center; color: #065f46; font-size: 12px;">${rerata}</td>
                            <td colspan="2" style="font-size: 10px; color: #047857;">
                                ${Number(rerata) >= 70 ? 'Lulus / Memenuhi KKM' : 'Perlu Pendampingan'}
                            </td>
                        </tr>
                    </tfoot>
                </table>

                <div class="summary-grid">
                    <div class="summary-box">
                        <div class="summary-title">Rekapitulasi Kehadiran KBM</div>
                        <div style="display: flex; justify-content: space-around; font-size: 11px; padding: 4px 0;">
                            <div>Hadir: <strong>${att.hadir}</strong> sesi</div>
                            <div>Sakit: <strong>${att.sakit}</strong> hari</div>
                            <div>Izin: <strong>${att.izin}</strong> hari</div>
                            <div>Alpa: <strong>${att.alpa}</strong> hari</div>
                        </div>
                    </div>
                    <div class="summary-box">
                        <div class="summary-title">Catatan & Nasehat Wali Kelas</div>
                        <div style="font-size: 11px; font-style: italic; color: #374151; padding: 2px 4px;">
                            "${catatanWali || 'Pertahankan semangat muthola\'ah dan ta\'dzim kepada guru. Semoga ilmunya berkah dan bermanfaat.'}"
                        </div>
                    </div>
                </div>

                <div class="signatures">
                    <div class="sign-box">
                        <p>Orang Tua / Wali Santri,</p>
                        <div class="sign-space"></div>
                        <p class="sign-name">( ................................ )</p>
                    </div>
                    <div class="sign-box">
                        <p>Wali Kelas,</p>
                        <div class="sign-space"></div>
                        <p class="sign-name">${cls ? cls.waliKelas : 'Wali Kelas'}</p>
                    </div>
                    <div class="sign-box">
                        <p>Kepala Madrasah Diniyah,</p>
                        <div class="sign-space"></div>
                        <p class="sign-name">K.H. Masrur</p>
                    </div>
                </div>

                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 300);
                    };
                </script>
            </body>
            </html>
        `);
        printWin.document.close();
    }
};

window.ASNMadin = ASNMadin;
window.loadAdminMadinData = function (force) {
    if (window.ASNMadin) {
        window.ASNMadin.loadData(force);
    }
};

// Auto-initialize when document is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ASNMadin.init());
} else {
    ASNMadin.init();
}
