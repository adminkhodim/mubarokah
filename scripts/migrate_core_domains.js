/**
 * ====================================================================
 * ETL DATA MIGRATION IMPORTER: GOOGLE SHEETS -> SUPABASE POSTGRESQL
 * ====================================================================
 * Otomatisasi migrasi data domain inti:
 * 1. Students (Master Santri)
 * 2. Guardians (Wali Santri)
 * 3. Tahfidz_Capaian & Tahfidz_Logs
 * 4. Keuangan_Tagihan & Keuangan_Transaksi
 * 
 * Penggunaan:
 *   node scripts/migrate_core_domains.js [--dry-run] [--key=<SERVICE_ROLE_KEY>]
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const config = require('../js/app-config.js');

const keyArg = process.argv.find(a => a.startsWith('--key='));
const SUPABASE_URL = process.env.SUPABASE_URL || config.supabase.url;
const SUPABASE_KEY = keyArg ? keyArg.split('=')[1] : (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || config.supabase.anonKey);
const TENANT_SLUG = config.supabase.defaultTenantSlug || 'mubarokah';
const MIGRATION_DATA_DIR = path.join(__dirname, '..', 'migration_data');

const isDryRun = process.argv.includes('--dry-run');

// ==================== HELPER POSTGREST SUPABASE ====================

function supabaseRequest(endpoint, method = 'GET', body = null, prefer = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(endpoint, SUPABASE_URL);
        const headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY,
            'Accept': 'application/json'
        };

        if (prefer) headers['Prefer'] = prefer;
        if (body) {
            headers['Content-Type'] = 'application/json';
        }

        const req = https.request(url, {
            method,
            headers
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(data ? JSON.parse(data) : null);
                    } catch (e) {
                        resolve(data);
                    }
                } else {
                    reject(new Error(`Supabase HTTP ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
        req.end();
    });
}

// ==================== HELPER NORMALISASI CERDAS ====================

function normalizeStudentStatus(val) {
    if (!val) return 'Aktif';
    const s = String(val).trim().toUpperCase();
    if (s === 'ACTIVE' || s === 'AKTIF') return 'Aktif';
    if (s === 'LULUS' || s === 'GRADUATED') return 'Lulus';
    if (s === 'MUTASI' || s === 'MOVED') return 'Mutasi';
    if (s === 'NONAKTIF' || s === 'INACTIVE' || s === 'NON-AKTIF') return 'Nonaktif';
    if (s === 'ALUMNI') return 'Alumni';
    return 'Aktif';
}

function normalizeTahfidzTipe(val) {
    if (!val) return 'Ziyadah';
    const s = String(val).trim().toUpperCase();
    if (s.includes('ZIYADAH')) return 'Ziyadah';
    if (s.includes('MURAJAAH') || s.includes('MURAJA')) return "Muraja'ah";
    if (s.includes('NADZOR') || s.includes('NADHOR')) return 'Bin-Nadzor';
    if (s.includes('TAHSIN')) return 'Tahsin';
    if (s.includes('UJIAN') || s.includes('TES')) return 'Ujian';
    return 'Ziyadah';
}

function normalizeTagihanStatus(val, sisa = 0, terbayar = 0) {
    const s = String(val || '').trim().toUpperCase();
    if (s === 'LUNAS' || s === 'PAID') return 'LUNAS';
    if (s === 'SEBAGIAN' || s === 'PARTIAL') return 'SEBAGIAN';
    if (s === 'BATAL' || s === 'VOID' || s === 'CANCEL') return 'BATAL';
    if (s === 'BELUM_BAYAR' || s === 'BELUM_LUNAS' || s === 'UNPAID') return 'BELUM_LUNAS';
    
    // Fallback berdasarkan sisa nominal
    if (sisa <= 0 && terbayar > 0) return 'LUNAS';
    if (terbayar > 0) return 'SEBAGIAN';
    return 'BELUM_LUNAS';
}

function normalizeTransaksiStatus(val) {
    const s = String(val || '').trim().toUpperCase();
    if (s === 'SUKSES' || s === 'SUCCESS' || s === 'BERHASIL') return 'SUCCESS';
    if (s === 'BATAL' || s === 'VOID' || s === 'FAILED') return 'BATAL';
    if (s === 'PENDING') return 'PENDING';
    return 'SUCCESS';
}

function parseCleanDate(val) {
    if (!val) return null;
    if (val instanceof Date) return val.toISOString().split('T')[0];
    const s = String(val).trim();
    if (!s) return null;

    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        return s.substring(0, 10);
    }
    const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmy) {
        const day = dmy[1].padStart(2, '0');
        const month = dmy[2].padStart(2, '0');
        const year = dmy[3];
        return `${year}-${month}-${day}`;
    }
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
    }
    return null;
}

function parseCleanNumber(val, defaultVal = 0) {
    if (val === null || val === undefined || val === '') return defaultVal;
    if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
    const cleaned = String(val).replace(/[^0-9\.\-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? defaultVal : num;
}

function parseCleanPhone(val) {
    if (!val) return null;
    let s = String(val).replace(/[^0-9+]/g, '');
    if (s.startsWith('62')) s = '+' + s;
    if (s.startsWith('08')) s = '+628' + s.substring(2);
    return s || null;
}

function readJsonOrCsv(baseName) {
    const jsonPath = path.join(MIGRATION_DATA_DIR, `${baseName}.json`);
    if (fs.existsSync(jsonPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            if (Array.isArray(data)) return data;
        } catch (e) {
            console.warn(`[WARN] Gagal parse ${baseName}.json:`, e.message);
        }
    }
    return [];
}

// ==================== ALUR UTAMA ETL ====================

async function runMigration() {
    console.log("====================================================================");
    console.log("🚀 MEMULAI ETL DATA IMPORTER (GOOGLE SHEETS -> SUPABASE POSTGRESQL)");
    console.log(`   Target Server : ${SUPABASE_URL}`);
    console.log(`   Tenant Target : ${TENANT_SLUG}`);
    console.log(`   Mode Eksekusi : ${isDryRun ? 'DRY-RUN (Simulasi)' : 'LIVE INSERT / UPSERT'}`);
    console.log("====================================================================\n");

    // 1. Ambil Tenant ID
    console.log("📌 Langkah 1: Memverifikasi Tenant...");
    const tenants = await supabaseRequest(`/rest/v1/tenants?slug=eq.${TENANT_SLUG}&select=id,name`);
    if (!tenants || tenants.length === 0) {
        throw new Error(`Tenant '${TENANT_SLUG}' tidak ditemukan di tabel public.tenants.`);
    }
    const tenantId = tenants[0].id;
    console.log(`   ✅ Tenant Terverifikasi: ${tenants[0].name} (UUID: ${tenantId})\n`);

    const studentMap = {}; // raw_id / nis -> uuid

    function registerStudentId(rawId, uuid) {
        if (!rawId) return;
        const clean = String(rawId).trim();
        studentMap[clean] = uuid;
        studentMap[clean.toUpperCase()] = uuid;
        studentMap[clean.toLowerCase()] = uuid;
        studentMap[clean.replace(/_/g, '-')] = uuid;
        studentMap[clean.replace(/-/g, '_')] = uuid;
    }

    // 2. Migrasi Master Santri (Students)
    console.log("📌 Langkah 2: Memproses Master Santri (Students)...");
    let rawStudents = readJsonOrCsv('students');
    if (rawStudents.length > 0) {
        console.log(`   📂 Terdeteksi ${rawStudents.length} baris data santri.`);
        const studentPayload = rawStudents.map(s => {
            const sid = String(s.student_id || s.studentid || s.id || s.nis || '').trim();
            return {
                tenant_id: tenantId,
                student_id: sid,
                nis: s.nis ? String(s.nis).trim() : null,
                nik: s.nik ? String(s.nik).trim() : null,
                name: String(s.name || s.nama || s.student_name || 'Santri').trim(),
                gender: (String(s.gender || s.jk || s.jenis_kelamin || 'L').toUpperCase().startsWith('P')) ? 'P' : 'L',
                birth_date: parseCleanDate(s.birth_date || s.tanggal_lahir || s.tgl_lahir),
                photo_url: s.photo_url || s.foto || '',
                program: s.program || 'Tahfidz Al-Qur\'an',
                status: normalizeStudentStatus(s.status),
                qr_code: s.qr_code || ''
            };
        }).filter(s => s.student_id !== '');

        if (!isDryRun) {
            const inserted = await supabaseRequest(
                '/rest/v1/students?on_conflict=tenant_id,student_id',
                'POST',
                studentPayload,
                'resolution=merge-duplicates,return=representation'
            );
            if (Array.isArray(inserted)) {
                inserted.forEach(st => {
                    registerStudentId(st.student_id, st.id);
                    if (st.nis) registerStudentId(st.nis, st.id);
                });
            }
            console.log(`   ✅ ${studentPayload.length} Santri berhasil diimpor & di-upsert ke database!\n`);
        } else {
            studentPayload.forEach(st => {
                registerStudentId(st.student_id, 'dummy-uuid-' + st.student_id);
                if (st.nis) registerStudentId(st.nis, 'dummy-uuid-' + st.student_id);
            });
            console.log(`   [Dry-run] Siap memasukkan ${studentPayload.length} santri.\n`);
        }
    } else {
        console.log("   ℹ️ Belum ada berkas students.json di folder migration_data/.\n");
    }

    // Ambil seluruh santri dari database untuk melengkapi peta FK jika sebagian sudah ada
    const dbStudents = await supabaseRequest(`/rest/v1/students?tenant_id=eq.${tenantId}&select=id,student_id,nis`);
    if (Array.isArray(dbStudents)) {
        dbStudents.forEach(st => {
            registerStudentId(st.student_id, st.id);
            if (st.nis) registerStudentId(st.nis, st.id);
        });
    }

    // 3. Migrasi Master Wali Santri (Guardians)
    console.log("📌 Langkah 3: Memproses Master Wali Santri (Guardians)...");
    let rawGuardians = readJsonOrCsv('guardians');
    if (rawGuardians.length > 0) {
        console.log(`   📂 Terdeteksi ${rawGuardians.length} baris data wali santri.`);
        const guardianPayload = rawGuardians.map(g => ({
            tenant_id: tenantId,
            identity_id: String(g.identity_id || g.id || g.wali_id).trim(),
            name: String(g.name || g.nama || 'Wali Santri').trim(),
            email: g.email || null,
            phone: parseCleanPhone(g.phone || g.telepon || g.wa),
            photo_url: g.photo_url || g.foto || '',
            status: 'ACTIVE'
        })).filter(g => g.identity_id !== '');

        if (!isDryRun && guardianPayload.length > 0) {
            await supabaseRequest(
                '/rest/v1/guardians?on_conflict=tenant_id,identity_id',
                'POST',
                guardianPayload,
                'resolution=merge-duplicates'
            );
            console.log(`   ✅ ${guardianPayload.length} Wali Santri berhasil diimpor!\n`);
        } else {
            console.log(`   [Dry-run] Siap memasukkan ${guardianPayload.length} wali santri.\n`);
        }
    } else {
        console.log("   ℹ️ Belum ada berkas guardians.json di migration_data/.\n");
    }

    // 4. Migrasi Capaian Tahfidz (Tahfidz_Capaian)
    console.log("📌 Langkah 4: Memproses Capaian Tahfidz (Tahfidz_Capaian)...");
    let rawCapaian = readJsonOrCsv('tahfidz_capaian');
    if (rawCapaian.length > 0) {
        console.log(`   📂 Terdeteksi ${rawCapaian.length} baris data capaian tahfidz.`);
        const capaianPayload = rawCapaian.map(c => {
            const rawSid = String(c.student_id || c.studentid || c.nis || '').trim();
            const sidUuid = studentMap[rawSid] || null;
            return {
                tenant_id: tenantId,
                student_id: sidUuid,
                raw_student_id: rawSid,
                student_name: c.student_name || c.studentname || c.name || c.nama || '',
                juz_aktif: Math.min(30, Math.max(1, parseInt(c.juz_aktif) || 30)),
                halaman_terakhir: parseInt(c.halaman_terakhir) || 1,
                total_halaman_tuntas: parseCleanNumber(c.total_halaman_tuntas),
                status_terakhir: c.status_terakhir || 'Berjalan',
                halaqah_id: c.halaqah_id || '',
                nama_halaqah: c.nama_halaqah || '',
                muhafiz_pembina: c.muhafiz_pembina || c.muhafiz || '',
                sabqi_halaman: parseInt(c.sabqi_halaman) || 0,
                manzil_juz: parseInt(c.manzil_juz) || 0,
                manzil_halaman: parseInt(c.manzil_halaman) || 0,
                manzil_putaran: parseInt(c.manzil_putaran) || 0,
                total_halaman_murojaah: parseCleanNumber(c.total_halaman_murojaah)
            };
        }).filter(c => c.student_id !== null);

        if (!isDryRun && capaianPayload.length > 0) {
            await supabaseRequest(
                '/rest/v1/tahfidz_capaian?on_conflict=tenant_id,student_id',
                'POST',
                capaianPayload,
                'resolution=merge-duplicates'
            );
            console.log(`   ✅ ${capaianPayload.length} Capaian Tahfidz berhasil diimpor!\n`);
        } else {
            console.log(`   [Dry-run] Siap memasukkan ${capaianPayload.length} capaian tahfidz.\n`);
        }
    } else {
        console.log("   ℹ️ Belum ada berkas tahfidz_capaian.json di migration_data/.\n");
    }

    // 5. Migrasi Log Setoran Harian (Tahfidz_Logs)
    console.log("📌 Langkah 5: Memproses Log Setoran Harian Tahfidz (Tahfidz_Logs)...");
    let rawLogs = readJsonOrCsv('tahfidz_logs');
    if (rawLogs.length > 0) {
        console.log(`   📂 Terdeteksi ${rawLogs.length} baris data log setoran.`);
        const logsPayload = rawLogs.map(l => {
            const rawSid = String(l.student_id || l.studentid || l.nis || '').trim();
            const sidUuid = studentMap[rawSid] || null;
            return {
                tenant_id: tenantId,
                log_id: l.log_id || l.id || null,
                student_id: sidUuid,
                raw_student_id: rawSid,
                student_name: l.student_name || l.nama || '',
                gender: (String(l.gender || 'L').toUpperCase().startsWith('P')) ? 'P' : 'L',
                tanggal: parseCleanDate(l.tanggal) || new Date().toISOString().split('T')[0],
                sesi: l.sesi || 'Pagi (Subuh)',
                tipe: normalizeTahfidzTipe(l.tipe),
                juz: Math.min(30, Math.max(1, parseInt(l.juz) || 30)),
                surah: l.surah || '',
                halaman_list: String(l.halaman_list || ''),
                total_halaman: parseCleanNumber(l.total_halaman),
                nilai: l.nilai || 'JAYYID',
                muhafiz: l.muhafiz || '',
                catatan: l.catatan || '',
                status_setoran: (String(l.status_setoran || '').toUpperCase() === 'ULANG') ? 'ULANG' : 'LANJUT',
                satuan: 'HALAMAN',
                ayat_mulai: l.ayat_mulai ? parseInt(l.ayat_mulai) : null,
                ayat_sampai: l.ayat_sampai ? parseInt(l.ayat_sampai) : null
            };
        }).filter(l => l.student_id !== null);

        if (!isDryRun && logsPayload.length > 0) {
            // Bulk insert per batch 50 baris agar aman dari payload limit
            const batchSize = 50;
            for (let i = 0; i < logsPayload.length; i += batchSize) {
                const batch = logsPayload.slice(i, i + batchSize);
                await supabaseRequest('/rest/v1/tahfidz_logs', 'POST', batch);
            }
            console.log(`   ✅ ${logsPayload.length} Log Setoran Tahfidz berhasil diimpor!\n`);
        } else {
            console.log(`   [Dry-run] Siap memasukkan ${logsPayload.length} log setoran.\n`);
        }
    } else {
        console.log("   ℹ️ Belum ada berkas tahfidz_logs.json di migration_data/.\n");
    }

    // 6. Migrasi Tagihan Keuangan (Keuangan_Tagihan)
    console.log("📌 Langkah 6: Memproses Tagihan Keuangan (Keuangan_Tagihan)...");
    let rawTagihan = readJsonOrCsv('keuangan_tagihan');
    if (rawTagihan.length > 0) {
        console.log(`   📂 Terdeteksi ${rawTagihan.length} baris data tagihan keuangan.`);
        const tagihanPayload = rawTagihan.map(t => {
            const rawSid = String(t.student_id || t.studentid || t.nis || '').trim();
            const sidUuid = studentMap[rawSid] || null;
            const nominal = parseCleanNumber(t.nominal_tagihan || t.nominal);
            const terbayar = parseCleanNumber(t.nominal_terbayar);
            const sisa = parseCleanNumber(t.sisa_tagihan !== undefined ? t.sisa_tagihan : (nominal - terbayar));

            return {
                tenant_id: tenantId,
                tagihan_id: String(t.tagihan_id || t.id).trim(),
                student_id: sidUuid,
                raw_student_id: rawSid,
                student_name: t.student_name || t.nama || '',
                pos_id: t.pos_id || '',
                nama_pos: t.nama_pos || 'SPP & Syahriah',
                periode: t.periode || 'Oktober 2026',
                nominal_tagihan: nominal,
                nominal_terbayar: terbayar,
                sisa_tagihan: sisa,
                status: normalizeTagihanStatus(t.status, sisa, terbayar),
                due_date: parseCleanDate(t.due_date)
            };
        }).filter(t => t.student_id !== null && t.tagihan_id !== '');

        if (!isDryRun && tagihanPayload.length > 0) {
            await supabaseRequest(
                '/rest/v1/keuangan_tagihan?on_conflict=tenant_id,tagihan_id',
                'POST',
                tagihanPayload,
                'resolution=merge-duplicates'
            );
            console.log(`   ✅ ${tagihanPayload.length} Tagihan Keuangan berhasil diimpor!\n`);
        } else {
            console.log(`   [Dry-run] Siap memasukkan ${tagihanPayload.length} tagihan keuangan.\n`);
        }
    } else {
        console.log("   ℹ️ Belum ada berkas keuangan_tagihan.json di migration_data/.\n");
    }

    // 7. Migrasi Transaksi Kas Masuk (Keuangan_Transaksi)
    console.log("📌 Langkah 7: Memproses Transaksi Pembayaran Santri (Keuangan_Transaksi)...");
    let rawTransaksi = readJsonOrCsv('keuangan_transaksi');
    if (rawTransaksi.length > 0) {
        console.log(`   📂 Terdeteksi ${rawTransaksi.length} baris data transaksi keuangan.`);
        const transaksiPayload = rawTransaksi.map(tr => {
            const rawSid = String(tr.student_id || tr.studentid || tr.nis || '').trim();
            const sidUuid = studentMap[rawSid] || null;
            const nominal = parseCleanNumber(tr.nominal_total || tr.nominal);

            let tagihanIds = [];
            try {
                if (tr.tagihan_ids_json) {
                    tagihanIds = typeof tr.tagihan_ids_json === 'string' ? JSON.parse(tr.tagihan_ids_json) : tr.tagihan_ids_json;
                }
            } catch (e) {
                tagihanIds = [];
            }

            return {
                tenant_id: tenantId,
                transaksi_id: String(tr.transaksi_id || tr.id).trim(),
                no_kuitansi: tr.no_kuitansi || tr.kuitansi || `KWT-${Date.now()}`,
                tanggal_bayar: tr.tanggal_bayar ? (parseCleanDate(tr.tanggal_bayar) + 'T00:00:00Z') : new Date().toISOString(),
                student_id: sidUuid,
                raw_student_id: rawSid,
                student_name: tr.student_name || tr.nama || '',
                tagihan_ids_json: Array.isArray(tagihanIds) ? tagihanIds : [],
                nominal_total: nominal,
                metode_bayar: tr.metode_bayar || 'TUNAI',
                nama_kasir: tr.nama_kasir || tr.kasir || 'Kasir Pesantren',
                catatan: tr.catatan || '',
                status: normalizeTransaksiStatus(tr.status)
            };
        }).filter(tr => tr.transaksi_id !== '');

        if (!isDryRun && transaksiPayload.length > 0) {
            await supabaseRequest(
                '/rest/v1/keuangan_transaksi?on_conflict=tenant_id,transaksi_id',
                'POST',
                transaksiPayload,
                'resolution=merge-duplicates'
            );
            console.log(`   ✅ ${transaksiPayload.length} Transaksi Keuangan berhasil diimpor!\n`);
        } else {
            console.log(`   [Dry-run] Siap memasukkan ${transaksiPayload.length} transaksi keuangan.\n`);
        }
    } else {
        console.log("   ℹ️ Belum ada berkas keuangan_transaksi.json di migration_data/.\n");
    }

    console.log("====================================================================");
    console.log("🎉 SELURUH DATA DOMAIN INTI BERHASIL DIMIGRASIKAN KE POSTGRESQL!");
    console.log("====================================================================");
}

runMigration().catch(err => {
    console.error("\n❌ PROSES ETL GAGAL:", err.message);
    process.exit(1);
});
