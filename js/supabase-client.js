/**
 * ====================================================================
 * SUPABASE CLIENT ADAPTER - STRANGLER FIG DATA MODERNIZATION
 * ====================================================================
 * High-performance, dependency-free adapter using native browser Fetch
 * to communicate directly with Supabase PostgreSQL (PostgREST API).
 * 
 * Multi-Tenant Architecture ready for KHODIM EDU.
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        // Node / CommonJS (testing environment)
        module.exports = factory(require('./app-config.js'));
    } else {
        // Browser Global
        root.MubarokahSupabase = factory(root.APP_CONFIG);
    }
})(typeof self !== 'undefined' ? self : this, function (config) {
    'use strict';

    // Ambil konfigurasi Supabase dari APP_CONFIG
    const sbConfig = (config && config.supabase) ? config.supabase : {
        enabled: true,
        url: "https://qyurpxbawyjijoqpijnw.supabase.co",
        anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5dXJweGJhd3lqaWpvcXBpam53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyOTg3NjMsImV4cCI6MjEwODg3NDc2M30.lEUT2SWaOCVo0__dh5eVwcNirimV57LO9dxJVeAQKdM",
        defaultTenantSlug: "mubarokah"
    };

    /**
     * Memeriksa apakah integrasi Supabase aktif dan terkonfigurasi
     */
    function isEnabled() {
        return Boolean(sbConfig.enabled && sbConfig.url && sbConfig.anonKey);
    }

    /**
     * Helper request internal ke REST API PostgREST Supabase
     */
    async function request(endpoint, options = {}) {
        if (!isEnabled()) {
            throw new Error("[MubarokahSupabase] Layanan Supabase belum aktif atau belum dikonfigurasi.");
        }

        const url = new URL(endpoint, sbConfig.url);
        const headers = {
            'apikey': sbConfig.anonKey,
            'Authorization': 'Bearer ' + sbConfig.anonKey,
            'Accept': 'application/json',
            ...(options.headers || {})
        };

        if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(options.body);
        }

        const response = await fetch(url.toString(), {
            ...options,
            headers
        });

        if (!response.ok) {
            const errBody = await response.text().catch(() => '');
            throw new Error(`[MubarokahSupabase] HTTP ${response.status}: ${errBody}`);
        }

        const text = await response.text();
        return text ? JSON.parse(text) : null;
    }

    /**
     * Helper memformat tanggal ISO ke format Indonesia yang rapi
     * Contoh: "2025-09-29T01:00:00Z" -> "29 September 2025"
     */
    function formatTanggalIndo(dateStr) {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return String(dateStr);

            const bulan = [
                'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
            ];

            const day = date.getDate();
            const month = bulan[date.getMonth()];
            const year = date.getFullYear();

            return `${day} ${month} ${year}`;
        } catch (e) {
            return String(dateStr);
        }
    }

    /**
     * Mengambil daftar banner beranda aktif dari Supabase
     * Memetakan skema database ke struktur UI yang diharapkan slider Mubarokah App
     */
    async function fetchBanners() {
        try {
            const rows = await request('/rest/v1/banners?select=*&is_active=eq.true&order=display_order.asc');
            if (!Array.isArray(rows)) return [];

            return rows.map(b => ({
                id: b.id,
                nama: b.title,
                gambar: b.image_url,
                tipeAksi: (b.link_url && (b.link_url.startsWith('http://') || b.link_url.startsWith('https://')))
                    ? 'url'
                    : (b.link_url ? 'tab' : 'none'),
                targetAksi: b.link_url ? b.link_url.replace(/^\//, '') : '',
                urutan: Number(b.display_order) || 0,
                status: b.is_active ? 'Aktif' : 'Nonaktif',
                badge: b.badge_text || ''
            }));
        } catch (error) {
            console.warn('[MubarokahSupabase] Gagal mengambil banner:', error);
            throw error;
        }
    }

    /**
     * Mengambil daftar warta berita yang diterbitkan dari Supabase
     * Memetakan skema database ke struktur UI berita Mubarokah App
     */
    async function fetchNews() {
        try {
            const rows = await request('/rest/v1/news_articles?select=*&is_published=eq.true&order=published_at.desc');
            if (!Array.isArray(rows)) return [];

            return rows.map(n => ({
                news_id: n.id,
                id: n.id,
                slug: n.slug,
                judul: n.title,
                kategori: n.category || 'Kegiatan',
                penulis: n.author || 'Tim Redaksi',
                gambar: n.cover_image || '',
                ringkasan: n.summary || '',
                isi: n.content || '',
                tanggal: formatTanggalIndo(n.published_at),
                views: Number(n.views_count) || 0
            }));
        } catch (error) {
            console.warn('[MubarokahSupabase] Gagal mengambil berita:', error);
            throw error;
        }
    }

    /**
     * Mengambil testimoni alumni yang mengizinkan publikasi
     */
    async function fetchAlumniTestimonials() {
        try {
            const rows = await request('/rest/v1/alumni_records?select=*&izin_publikasi=eq.true&order=created_at.desc&limit=12');
            if (!Array.isArray(rows)) return [];

            return rows.map(item => ({
                nama: item.nama || '',
                foto: item.foto_url || '',
                instansi: item.instansi || '',
                kesibukan: item.kesibukan || '',
                tahunMasuk: item.tahun_masuk || '',
                tahunLulus: item.tahun_lulus || '',
                kesan: item.kesan_pesan || ''
            }));
        } catch (error) {
            console.warn('[MubarokahSupabase] Gagal mengambil testimoni alumni:', error);
            throw error;
        }
    }

    /**
     * Mendaftarkan formulir alumni baru ke database
     */
    async function submitAlumni(payload) {
        try {
            // Ambil id tenant default mubarokah jika ada
            const tenants = await request(`/rest/v1/tenants?slug=eq.${encodeURIComponent(sbConfig.defaultTenantSlug)}&select=id`);
            const tenantId = (Array.isArray(tenants) && tenants.length > 0) ? tenants[0].id : null;

            const record = {
                tenant_id: tenantId,
                nama: payload.nama,
                jenis_kelamin: payload.jk || payload.jenis_kelamin,
                wa: payload.wa,
                medsos: payload.medsos,
                tahun_masuk: String(payload.masuk || payload.tahun_masuk || ''),
                tahun_lulus: String(payload.lulus || payload.tahun_lulus || ''),
                program_terakhir: payload.program || payload.program_terakhir,
                kesibukan: payload.kesibukan,
                instansi: payload.instansi,
                kesan_pesan: payload.kesan || payload.kesan_pesan,
                provinsi: payload.provinsi,
                kabupaten: payload.kabupaten,
                kecamatan: payload.kecamatan,
                desa: payload.desa,
                alamat: payload.alamat,
                latitude: payload.lat ? Number(payload.lat) : null,
                longitude: payload.lng ? Number(payload.lng) : null,
                izin_publikasi: (payload.izin === 'Ya' || payload.izin === true),
                foto_url: payload.foto_url || ''
            };

            const inserted = await request('/rest/v1/alumni_records', {
                method: 'POST',
                headers: {
                    'Prefer': 'return=representation'
                },
                body: record
            });

            return { success: true, data: inserted };
        } catch (error) {
            console.error('[MubarokahSupabase] Gagal mendaftarkan alumni:', error);
            return { success: false, error: { message: error.message } };
        }
    }

    /**
     * Mengambil galeri foto kegiatan pesantren aktif
     */
    async function fetchGalleries() {
        try {
            const rows = await request('/rest/v1/galleries?select=*&is_active=eq.true&order=created_at.desc');
            if (!Array.isArray(rows)) return [];
            return rows.map(g => ({
                id: g.gallery_id || g.id,
                judul: g.title,
                kategori: g.category,
                keterangan: g.description || '',
                gambar: g.image_url,
                status: g.is_active ? 'Aktif' : 'Nonaktif',
                timestamp: g.created_at
            }));
        } catch (error) {
            console.warn('[MubarokahSupabase] Gagal mengambil galeri:', error);
            throw error;
        }
    }

    /**
     * Mengambil unit kegiatan santri aktif
     */
    async function fetchUnitActivities() {
        try {
            const rows = await request('/rest/v1/unit_activities?select=*&is_active=eq.true&order=display_order.asc');
            if (!Array.isArray(rows)) return [];
            return rows.map(u => ({
                id: u.unit_id || u.id,
                nama: u.name,
                kategori: u.category,
                jadwal: u.schedule || '',
                deskripsi: u.description || '',
                gambar: u.image_url || '',
                urutan: Number(u.display_order) || 1,
                status: u.is_active ? 'Aktif' : 'Nonaktif',
                timestamp: u.created_at
            }));
        } catch (error) {
            console.warn('[MubarokahSupabase] Gagal mengambil unit kegiatan:', error);
            throw error;
        }
    }

    /**
     * Mengambil notifikasi pengumuman aktif
     */
    async function fetchNotifications() {
        try {
            const rows = await request('/rest/v1/notifications?select=*&is_active=eq.true&order=created_at.desc');
            if (!Array.isArray(rows)) return [];
            return rows.map(n => ({
                id: n.notification_id || n.id,
                judul: n.title,
                kategori: n.category,
                tanggal: n.date_display || '',
                ringkasan: n.summary || '',
                isi: n.content || '',
                gambar: n.image_url || '',
                is_popup: Boolean(n.is_popup),
                status: n.is_active ? 'Aktif' : 'Nonaktif',
                createdAt: n.created_at
            }));
        } catch (error) {
            console.warn('[MubarokahSupabase] Gagal mengambil notifikasi:', error);
            throw error;
        }
    }

    /**
     * Mengambil pengaturan profil lembaga
     */
    async function fetchTenantSettings() {
        try {
            const rows = await request('/rest/v1/tenant_settings?select=*&limit=1');
            if (!Array.isArray(rows) || rows.length === 0) return null;
            const s = rows[0];
            const social = s.social_links || {};
            return {
                nama_pesantren: s.institution_name,
                alamat_pesantren: s.address,
                tahun_berdiri: s.founded_year,
                tanggal_berdiri: s.founded_date,
                visi_misi: s.vision_mission,
                sejarah: s.history,
                video_highlight: s.video_highlight,
                link_facebook: social.facebook || '',
                link_instagram: social.instagram || '',
                link_youtube: social.youtube || ''
            };
        } catch (error) {
            console.warn('[MubarokahSupabase] Gagal mengambil pengaturan:', error);
            throw error;
        }
    }

    /**
     * Mengambil master tarif pesantren
     */
    async function fetchTariffs() {
        try {
            const rows = await request('/rest/v1/financial_tariffs?select=*&is_active=eq.true&order=created_at.asc');
            if (!Array.isArray(rows)) return [];
            return rows.map(t => ({
                id: t.tariff_id || t.id,
                namaPos: t.name,
                kategori: t.category,
                tipePeriode: t.period_type,
                nominalDefault: Number(t.amount) || 0,
                program: t.program || 'SEMUA',
                isActive: Boolean(t.is_active)
            }));
        } catch (error) {
            console.warn('[MubarokahSupabase] Gagal mengambil master tarif:', error);
            throw error;
        }
    }

    /**
     * Mengambil dompet tabungan santri
     */
    async function fetchStudentWallets() {
        try {
            const rows = await request('/rest/v1/student_wallets?select=*,student:students(name,nis,program)&order=student_code.asc');
            if (!Array.isArray(rows)) return [];
            return rows.map(w => ({
                id: w.id,
                studentId: w.student_code,
                studentName: w.student ? w.student.name : '',
                nis: w.student ? w.student.nis : '',
                program: w.student ? w.student.program : '',
                saldoTabungan: Number(w.balance) || 0,
                limitHarian: Number(w.daily_limit) || 25000,
                totalJajanHariIni: Number(w.daily_spent) || 0,
                isLocked: Boolean(w.is_locked),
                updatedAt: w.updated_at
            }));
        } catch (error) {
            console.warn('[MubarokahSupabase] Gagal mengambil dompet santri:', error);
            throw error;
        }
    }

    /**
     * Mengambil jadwal kegiatan harian & mingguan santri
     */
    async function fetchActivitySchedules() {
        try {
            const rows = await request('/rest/v1/activity_schedules?select=*&status=eq.Aktif&order=order_index.asc');
            if (!Array.isArray(rows)) return [];
            return rows.map(j => ({
                id: j.schedule_id || j.id,
                nama: j.name,
                tipe: j.type,
                waktu: j.time_range,
                tag: j.tag,
                deskripsi: j.description || '',
                urutan: j.order_index,
                status: j.status
            }));
        } catch (error) {
            console.warn('[MubarokahSupabase] Gagal mengambil jadwal kegiatan:', error);
            throw error;
        }
    }

    /**
     * Mengambil pendaftaran PPDB
     */
    async function fetchPPDBRegistrations() {
        try {
            const rows = await request('/rest/v1/ppdb_registrations?select=*&order=created_at.desc');
            if (!Array.isArray(rows)) return [];
            return rows.map(p => ({
                id: p.id,
                registrationNo: p.registration_no,
                nama: p.name,
                nisn: p.nisn,
                wali: p.guardian_name,
                whatsapp: p.whatsapp,
                program: p.program,
                status: p.status,
                tanggalDaftar: p.registration_date || p.created_at
            }));
        } catch (error) {
            console.warn('[MubarokahSupabase] Gagal mengambil data PPDB:', error);
            throw error;
        }
    }

    /**
     * Mengambil matriks peran dan izin RBAC
     */
    async function fetchRolePermissions() {
        try {
            const rows = await request('/rest/v1/roles_permissions?select=*&order=role_key.asc');
            if (!Array.isArray(rows)) return [];
            return rows.map(r => ({
                roleKey: r.role_key,
                roleName: r.role_name,
                totalActive: r.total_active,
                permissions: r.permissions || []
            }));
        } catch (error) {
            console.warn('[MubarokahSupabase] Gagal mengambil role permissions:', error);
            throw error;
        }
    }

    /**
     * Mengambil master kegiatan presensi santri
     */
    async function fetchPresenceActivities() {
        try {
            const rows = await request('/rest/v1/presence_activities?select=*&status=eq.Aktif&order=activity_code.asc');
            if (!Array.isArray(rows)) return [];
            return rows.map(a => ({
                id: a.activity_code || a.id,
                namaKegiatan: a.name,
                kategori: a.category,
                jadwalRutin: a.routine_schedule,
                targetPeserta: a.target_audience,
                penanggungJawab: a.person_in_charge,
                status: a.status
            }));
        } catch (error) {
            console.warn('[MubarokahSupabase] Gagal mengambil master kegiatan presensi:', error);
            throw error;
        }
    }

    /**
     * Mengambil riwayat sesi presensi
     */
    async function fetchPresenceSessions() {
        try {
            const rows = await request('/rest/v1/presence_sessions?select=*&order=date.desc,created_at.desc');
            if (!Array.isArray(rows)) return [];
            return rows.map(s => ({
                id: s.session_code || s.id,
                kegiatanId: s.activity_code,
                namaKegiatan: s.activity_name,
                tanggal: s.date,
                waktuBuka: s.open_time,
                petugas: s.officer_name,
                totalPeserta: s.total_students,
                totalHadir: s.total_present,
                totalIzin: s.total_permit,
                totalSakit: s.total_sick,
                totalAlpa: s.total_absent,
                statusSesi: s.session_status,
                catatan: s.notes
            }));
        } catch (error) {
            console.warn('[MubarokahSupabase] Gagal mengambil sesi presensi:', error);
            throw error;
        }
    }

    /**
     * Mengambil daftar kelas/halaqah belajar Yanbu'a (TPQ)
     */
    async function fetchTPQClasses() {
        try {
            const rows = await request('/rest/v1/tpq_classes?select=*&order=class_code.asc');
            if (!Array.isArray(rows)) return [];
            return rows.map(c => ({
                id: c.class_code || c.id,
                namaKelas: c.name,
                ustadzPengampu: c.teacher_name,
                deskripsi: c.description || '',
                studentIds: c.student_ids || []
            }));
        } catch (error) {
            console.warn('[MubarokahSupabase] Gagal mengambil kelas TPQ:', error);
            throw error;
        }
    }

    /**
     * Mengambil jadwal sesi belajar Yanbu'a (TPQ)
     */
    async function fetchTPQSessions() {
        try {
            const rows = await request('/rest/v1/tpq_sessions?select=*&order=session_code.asc');
            if (!Array.isArray(rows)) return [];
            return rows.map(s => ({
                id: s.session_code || s.id,
                namaSesi: s.name,
                jenisSesi: s.session_type,
                status: s.status,
                jamMulai: s.start_time,
                jamSelesai: s.end_time,
                hariList: s.days || []
            }));
        } catch (error) {
            console.warn('[MubarokahSupabase] Gagal mengambil sesi TPQ:', error);
            throw error;
        }
    }

    /**
     * Mengambil progress capaian santri Yanbu'a (TPQ)
     */
    async function fetchTPQCapaian() {
        try {
            const rows = await request('/rest/v1/tpq_capaian?select=*,student:students(nis,gender,program)&order=active_jilid.desc,active_page.desc');
            if (!Array.isArray(rows)) return [];
            return rows.map(cp => ({
                id: cp.id,
                studentId: cp.student_code,
                studentName: cp.student_name,
                nis: cp.student ? cp.student.nis : '',
                gender: cp.student ? cp.student.gender : '',
                jilidAktif: cp.active_jilid,
                halamanAktif: cp.active_page,
                statusTerakhir: cp.last_status,
                kelasId: cp.class_code,
                namaKelas: cp.class_name,
                ustadzPengampu: cp.teacher_name,
                targetJilid: cp.target_jilid,
                targetHalamanSesi: cp.target_page_per_session,
                targetHalamanPekan: cp.target_page_per_week,
                updatedAt: cp.updated_at
            }));
        } catch (error) {
            console.warn('[MubarokahSupabase] Gagal mengambil capaian TPQ:', error);
            throw error;
        }
    }

    /**
     * Mengambil anggota santri rombel kelas Madin
     */
    async function fetchMadinClassMembers(classId) {
        try {
            let endpoint = '/rest/v1/madin_class_members?select=*&order=nis.asc';
            if (classId) endpoint += `&class_id=eq.${encodeURIComponent(classId)}`;
            const rows = await request(endpoint);
            if (!Array.isArray(rows)) return [];
            return rows.map(m => ({
                id: m.id,
                classId: m.class_id,
                studentId: m.student_code,
                nis: m.nis,
                name: m.student_name,
                gender: m.gender
            }));
        } catch (error) {
            console.warn('[MubarokahSupabase] Gagal mengambil anggota kelas Madin:', error);
            throw error;
        }
    }

    /**
     * Mengambil jurnal KBM harian Madin
     */
    async function fetchMadinJournals(classId) {
        try {
            let endpoint = '/rest/v1/madin_journals?select=*&order=date.desc,created_at.desc';
            if (classId) endpoint += `&class_id=eq.${encodeURIComponent(classId)}`;
            const rows = await request(endpoint);
            if (!Array.isArray(rows)) return [];
            return rows.map(j => ({
                id: j.session_code || j.id,
                tanggal: j.date,
                classId: j.class_id,
                namaKelas: j.class_name,
                subjectId: j.subject_id,
                namaKitab: j.subject_name,
                asatidz: j.teacher_name,
                materiBab: j.topic_material,
                catatan: j.notes
            }));
        } catch (error) {
            console.warn('[MubarokahSupabase] Gagal mengambil jurnal Madin:', error);
            throw error;
        }
    }

    /**
     * Mengambil target progres sorogan santri
     */
    async function fetchSoroganTargets() {
        try {
            const rows = await request('/rest/v1/sorogan_targets?select=*,student:students(name,nis,gender)&order=student_code.asc');
            if (!Array.isArray(rows)) return [];
            return rows.map(t => ({
                id: t.id,
                studentId: t.student_code,
                name: t.student ? t.student.name : '',
                nis: t.student ? t.student.nis : '',
                gender: t.student ? t.student.gender : '',
                targetJuz: t.target_juz,
                targetHalamanSesi: t.target_page_per_session,
                targetHalamanPekan: t.target_page_per_week
            }));
        } catch (error) {
            console.warn('[MubarokahSupabase] Gagal mengambil target sorogan:', error);
            throw error;
        }
    }

    /**
     * Mengambil daftar halaqah tahfidz
     */
    async function fetchTahfidzHalaqah() {
        try {
            const rows = await request('/rest/v1/tahfidz_halaqah?select=*&order=halaqah_code.asc');
            if (!Array.isArray(rows)) return [];
            return rows.map(h => ({
                id: h.halaqah_code || h.id,
                namaHalaqah: h.name,
                muhafiz: h.muhafiz_name,
                targetKurikulum: h.curriculum_target,
                studentIds: h.student_ids || [],
                studentCount: h.student_count
            }));
        } catch (error) {
            console.warn('[MubarokahSupabase] Gagal mengambil halaqah tahfidz:', error);
            throw error;
        }
    }

    /**
     * Mengambil jadwal sesi tahfidz
     */
    async function fetchTahfidzSessions() {
        try {
            const rows = await request('/rest/v1/tahfidz_sessions?select=*&order=session_code.asc');
            if (!Array.isArray(rows)) return [];
            return rows.map(s => ({
                id: s.session_code || s.id,
                namaSesi: s.name,
                jenisSesi: s.session_type,
                status: s.status,
                jamMulai: s.start_time,
                jamSelesai: s.end_time,
                hariList: s.days || []
            }));
        } catch (error) {
            console.warn('[MubarokahSupabase] Gagal mengambil sesi tahfidz:', error);
            throw error;
        }
    }

    /**
     * Mengambil data master dewan asatidz & pegawai pesantren
     */
    async function fetchEmployees() {
        try {
            const rows = await request('/rest/v1/employees?select=*&order=employee_code.asc');
            if (!Array.isArray(rows)) return [];
            return rows.map(e => ({
                id: e.employee_code || e.id,
                nama: e.name,
                gender: e.gender,
                jabatan: e.position,
                spesialisasi: e.specialization,
                status: e.status
            }));
        } catch (error) {
            console.warn('[MubarokahSupabase] Gagal mengambil data pegawai:', error);
            throw error;
        }
    }

    /**
     * DUAL-WRITE MUTATION APIS:
     * Menuliskan input data baru langsung ke database Supabase PostgreSQL
     */
    const DEFAULT_TENANT_UUID = 'baa9eb9b-2d87-4648-a674-059bb289cb63';

    async function submitPPDB(payload) {
        try {
            const data = {
                tenant_id: DEFAULT_TENANT_UUID,
                name: String(payload.nama || '').trim(),
                nisn: String(payload.nisn || '').trim(),
                guardian_name: String(payload.wali || '').trim(),
                whatsapp: String(payload.whatsapp || '').trim(),
                program: String(payload.program || '').trim(),
                status: 'Pending',
                notes: String(payload.catatan || '').trim() || null
            };
            const inserted = await request('/rest/v1/ppdb_registrations', {
                method: 'POST',
                headers: { 'Prefer': 'return=representation' },
                body: data
            });
            return { status: 'success', success: true, data: inserted };
        } catch (error) {
            console.error('[MubarokahSupabase] Gagal submit PPDB:', error);
            return { status: 'error', success: false, message: error.message };
        }
    }

    async function saveNews(payload) {
        try {
            const slug = (payload.slug || payload.judul || 'berita')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)+/g, '');

            const data = {
                tenant_id: DEFAULT_TENANT_UUID,
                title: String(payload.judul || payload.title || '').trim(),
                slug: slug,
                category: String(payload.kategori || payload.category || 'Berita').trim(),
                author: String(payload.penulis || payload.author || 'Tim Redaksi').trim(),
                image_url: String(payload.gambar || payload.image_url || '').trim(),
                summary: String(payload.ringkasan || payload.summary || '').trim(),
                content: String(payload.isi || payload.content || '').trim(),
                status: 'published',
                published_at: new Date().toISOString()
            };

            const inserted = await request('/rest/v1/news_articles', {
                method: 'POST',
                headers: { 'Prefer': 'return=representation,resolution=merge-duplicates' },
                body: data
            });
            return { status: 'success', success: true, data: inserted };
        } catch (error) {
            console.error('[MubarokahSupabase] Gagal menyimpan berita:', error);
            return { status: 'error', success: false, message: error.message };
        }
    }

    async function deleteNews(newsIdOrSlug) {
        try {
            const param = String(newsIdOrSlug).includes('-') ? `slug=eq.${encodeURIComponent(newsIdOrSlug)}` : `id=eq.${encodeURIComponent(newsIdOrSlug)}`;
            await request(`/rest/v1/news_articles?${param}`, { method: 'DELETE' });
            return { status: 'success', success: true };
        } catch (error) {
            console.error('[MubarokahSupabase] Gagal menghapus berita:', error);
            return { status: 'error', success: false, message: error.message };
        }
    }

    async function saveBanner(payload) {
        try {
            const data = {
                tenant_id: DEFAULT_TENANT_UUID,
                title: String(payload.nama || payload.title || '').trim(),
                subtitle: String(payload.deskripsi || payload.subtitle || '').trim(),
                image_url: String(payload.gambar || payload.image_url || '').trim(),
                action_type: String(payload.tipeAksi || payload.action_type || 'none').toLowerCase(),
                action_target: String(payload.targetAksi || payload.action_target || '').trim(),
                order_index: Number(payload.urutan || payload.order_index) || 0,
                is_active: payload.status === 'Aktif' || payload.is_active !== false
            };

            const inserted = await request('/rest/v1/banners', {
                method: 'POST',
                headers: { 'Prefer': 'return=representation' },
                body: data
            });
            return { status: 'success', success: true, data: inserted };
        } catch (error) {
            console.error('[MubarokahSupabase] Gagal menyimpan banner:', error);
            return { status: 'error', success: false, message: error.message };
        }
    }

    async function deleteBanner(id) {
        try {
            await request(`/rest/v1/banners?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
            return { status: 'success', success: true };
        } catch (error) {
            console.error('[MubarokahSupabase] Gagal menghapus banner:', error);
            return { status: 'error', success: false, message: error.message };
        }
    }

    async function saveGallery(payload) {
        try {
            const data = {
                tenant_id: DEFAULT_TENANT_UUID,
                title: String(payload.judul || payload.title || '').trim(),
                category: String(payload.kategori || payload.category || 'Dokumentasi').trim(),
                image_url: String(payload.gambar || payload.image_url || '').trim(),
                description: String(payload.deskripsi || payload.description || '').trim(),
                order_index: Number(payload.urutan) || 0,
                is_active: true
            };
            const inserted = await request('/rest/v1/galleries', {
                method: 'POST',
                headers: { 'Prefer': 'return=representation' },
                body: data
            });
            return { status: 'success', success: true, data: inserted };
        } catch (error) {
            console.error('[MubarokahSupabase] Gagal menyimpan galeri:', error);
            return { status: 'error', success: false, message: error.message };
        }
    }

    async function saveNotification(payload) {
        try {
            const data = {
                tenant_id: DEFAULT_TENANT_UUID,
                title: String(payload.judul || payload.title || '').trim(),
                category: String(payload.kategori || payload.category || 'Pengumuman').trim(),
                summary: String(payload.ringkasan || payload.summary || '').trim(),
                content: String(payload.isi || payload.content || '').trim(),
                image_url: String(payload.gambar || payload.image_url || '').trim(),
                date_display: String(payload.tanggal || ''),
                is_popup: Boolean(payload.is_popup),
                is_active: true
            };
            const inserted = await request('/rest/v1/notifications', {
                method: 'POST',
                headers: { 'Prefer': 'return=representation' },
                body: data
            });
            return { status: 'success', success: true, data: inserted };
        } catch (error) {
            console.error('[MubarokahSupabase] Gagal menyimpan notifikasi:', error);
            return { status: 'error', success: false, message: error.message };
        }
    }

    
    async function saveTagihanBatch(items) {
        if (!isEnabled() || !Array.isArray(items) || items.length === 0) return { success: true, count: 0 };
        try {
            const rows = items.map(item => ({
                tenant_id: DEFAULT_TENANT_UUID,
                tagihan_id: String(item.tagihanId || '').trim(),
                raw_student_id: String(item.studentId || item.raw_student_id || '').trim(),
                student_name: String(item.studentName || item.name || '').trim(),
                pos_id: String(item.posId || item.pos_id || item.tarifId || '').trim(),
                nama_pos: String(item.namaPos || item.nama_pos || item.name || '').trim(),
                periode: String(item.periode || '').trim(),
                nominal_tagihan: Number(item.nominalTagihan || item.nominal_tagihan || item.nominal || 0),
                nominal_terbayar: Number(item.nominalTerbayar || item.nominal_terbayar || 0),
                sisa_tagihan: Number(item.sisaTagihan || item.sisa_tagihan || item.nominal || 0),
                status: String(item.status || 'BELUM_BAYAR').toUpperCase().replace('BELUM_BAYAR', 'BELUM_LUNAS'),
                due_date: item.dueDate || item.due_date || null
            }));

            await request('/rest/v1/keuangan_tagihan', {
                method: 'POST',
                headers: {
                    'Prefer': 'resolution=merge-duplicates,return=minimal'
                },
                body: rows
            });
            return { status: 'success', success: true, count: rows.length };
        } catch (error) {
            console.error('[MubarokahSupabase] Gagal menyimpan batch tagihan:', error);
            return { status: 'error', success: false, message: error.message };
        }
    }

    async function fetchGuardiansWithRelations() {
        try {
            const data = await request('/rest/v1/guardians?select=*,student_guardians(*,students(id,student_id,name,nis,program,gender,photo_url))&order=name.asc');
            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.error('[MubarokahSupabase] Gagal mengambil data wali & relasi:', error);
            return [];
        }
    }

    async function saveGuardian(payload) {
        if (!isEnabled()) return { success: false, message: "Supabase disabled" };
        try {
            const row = {
                tenant_id: DEFAULT_TENANT_UUID,
                name: String(payload.name || payload.nama || '').trim(),
                email: String(payload.email || '').trim() || null,
                phone: String(payload.phone || payload.whatsapp || payload.no_hp || '').trim() || null,
                photo_url: String(payload.photo_url || '').trim() || null,
                status: String(payload.status || 'ACTIVE').toUpperCase(),
                updated_at: new Date().toISOString()
            };

            let identityId = String(payload.identity_id || payload.identityId || '').trim();
            if (!identityId) {
                identityId = 'USR_WLI_' + Math.random().toString(36).substring(2, 10);
            }
            row.identity_id = identityId;

            let result = null;
            if (payload.id) {
                result = await request(`/rest/v1/guardians?id=eq.${payload.id}`, {
                    method: 'PATCH',
                    headers: { 'Prefer': 'return=representation' },
                    body: row
                });
            } else {
                result = await request('/rest/v1/guardians', {
                    method: 'POST',
                    headers: { 'Prefer': 'return=representation' },
                    body: row
                });
            }

            return { status: 'success', success: true, data: result };
        } catch (error) {
            console.error('[MubarokahSupabase] Gagal menyimpan wali:', error);
            return { status: 'error', success: false, message: error.message };
        }
    }

    async function linkStudentGuardian(payload) {
        if (!isEnabled()) return { success: false, message: "Supabase disabled" };
        try {
            const row = {
                tenant_id: DEFAULT_TENANT_UUID,
                guardian_id: payload.guardian_id || payload.guardianId,
                student_id: payload.student_id || payload.studentId,
                relationship: String(payload.relationship || 'GUARDIAN').toUpperCase(),
                is_primary: Boolean(payload.is_primary !== undefined ? payload.is_primary : true)
            };

            const result = await request('/rest/v1/student_guardians', {
                method: 'POST',
                headers: { 'Prefer': 'return=representation' },
                body: row
            });
            return { status: 'success', success: true, data: result };
        } catch (error) {
            console.error('[MubarokahSupabase] Gagal menghubungkan santri ke wali:', error);
            return { status: 'error', success: false, message: error.message };
        }
    }

    async function unlinkStudentGuardian(relationId) {
        if (!isEnabled()) return { success: false, message: "Supabase disabled" };
        try {
            await request(`/rest/v1/student_guardians?id=eq.${relationId}`, {
                method: 'DELETE'
            });
            return { status: 'success', success: true };
        } catch (error) {
            console.error('[MubarokahSupabase] Gagal melepas relasi santri-wali:', error);
            return { status: 'error', success: false, message: error.message };
        }
    }

    return Object.freeze({
        isEnabled,
        fetchBanners,
        fetchNews,
        fetchAlumniTestimonials,
        submitAlumni,
        fetchGalleries,
        fetchUnitActivities,
        fetchNotifications,
        fetchTenantSettings,
        fetchTariffs,
        fetchStudentWallets,
        fetchActivitySchedules,
        fetchPPDBRegistrations,
        fetchRolePermissions,
        fetchPresenceActivities,
        fetchPresenceSessions,
        fetchTPQClasses,
        fetchTPQSessions,
        fetchTPQCapaian,
        fetchMadinClassMembers,
        fetchMadinJournals,
        fetchSoroganTargets,
        fetchTahfidzHalaqah,
        fetchTahfidzSessions,
        fetchEmployees,
        fetchGuardiansWithRelations,
        saveGuardian,
        linkStudentGuardian,
        unlinkStudentGuardian,
        // Dual-Write mutation APIs
        submitPPDB,
        saveNews,
        deleteNews,
        saveBanner,
        deleteBanner,
        saveGallery,
        saveNotification,
        saveTagihanBatch,
        formatTanggalIndo,
        getConfig: () => Object.assign({}, sbConfig)
    });
});
