/**
 * ====================================================================
 * MIGRASI IDENTITAS PENGGUNA: GOOGLE SHEETS -> SUPABASE POSTGRESQL
 * ====================================================================
 * Memasukkan data akun Wali Santri dan Akun Administrator ke tabel public.user_identities.
 * 
 * Penggunaan:
 *   node scripts/migrate_auth_identities.js [--dry-run] [--key=<SERVICE_ROLE_KEY>]
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

function supabaseRequest(endpoint, method = 'GET', body = null, prefer = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(endpoint, SUPABASE_URL);
        const headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY,
            'Accept': 'application/json'
        };

        if (prefer) headers['Prefer'] = prefer;
        if (body) headers['Content-Type'] = 'application/json';

        const req = https.request(url, { method, headers }, (res) => {
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

function parseCleanPhone(val) {
    if (!val) return null;
    let s = String(val).replace(/[^0-9+]/g, '');
    if (s.startsWith('62')) s = '+' + s;
    if (s.startsWith('08')) s = '+628' + s.substring(2);
    if (!s.startsWith('+') && s.length >= 9) s = '+62' + s;
    return s || null;
}

async function run() {
    console.log("====================================================================");
    console.log("🚀 MEMULAI MIGRASI IDENTITAS PENGGUNA KE SUPABASE POSTGRESQL");
    console.log(`   Target Server : ${SUPABASE_URL}`);
    console.log(`   Tenant Target : ${TENANT_SLUG}`);
    console.log(`   Mode Eksekusi : ${isDryRun ? 'DRY-RUN (Simulasi)' : 'LIVE INSERT / UPSERT'}`);
    console.log("====================================================================\n");

    // 1. Ambil Tenant ID
    const tenants = await supabaseRequest(`/rest/v1/tenants?slug=eq.${TENANT_SLUG}&select=id,name`);
    if (!tenants || tenants.length === 0) {
        throw new Error(`Tenant '${TENANT_SLUG}' tidak ditemukan.`);
    }
    const tenantId = tenants[0].id;
    console.log(`   ✅ Tenant: ${tenants[0].name} (UUID: ${tenantId})\n`);

    const usersToInsert = [];

    // 2. Akun Super Admin Utama
    usersToInsert.push({
        tenant_id: tenantId,
        identity_id: 'ADM_001',
        email: 'izzatatabik@gmail.com',
        phone: '+6281234567890',
        name: 'Izzat Atabik',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        photo_url: '',
        password_hash: null // Password diatur via OTP atau setPassword
    });

    // 3. Akun Wali Santri dari migration_data/guardians.json
    const guardiansPath = path.join(MIGRATION_DATA_DIR, 'guardians.json');
    if (fs.existsSync(guardiansPath)) {
        const rawGuardians = JSON.parse(fs.readFileSync(guardiansPath, 'utf8'));
        console.log(`   📂 Terdeteksi ${rawGuardians.length} baris data wali santri.`);

        rawGuardians.forEach(g => {
            const rawId = String(g.identity_id || g.id || '').trim();
            if (!rawId) return;

            usersToInsert.push({
                tenant_id: tenantId,
                identity_id: rawId,
                email: g.email ? String(g.email).trim().toLowerCase() : null,
                phone: parseCleanPhone(g.phone),
                name: String(g.name || 'Wali Santri').trim(),
                role: 'WALI_SANTRI',
                status: 'ACTIVE',
                photo_url: g.photo_url || '',
                password_hash: g.password_hash || null
            });
        });
    }

    console.log(`   📋 Total identitas yang akan disinkronkan: ${usersToInsert.length} pengguna.`);

    if (!isDryRun) {
        const result = await supabaseRequest(
            '/rest/v1/user_identities?on_conflict=tenant_id,identity_id',
            'POST',
            usersToInsert,
            'resolution=merge-duplicates,return=representation'
        );
        console.log(`   ✅ ${usersToInsert.length} Identitas Pengguna berhasil diimpor & di-upsert ke PostgreSQL!\n`);
    } else {
        console.log(`   [Dry-run] Selesai simulasi untuk ${usersToInsert.length} identitas.\n`);
    }

    console.log("====================================================================");
    console.log("🎉 SINKRONISASI IDENTITAS SELESAI!");
    console.log("====================================================================");
}

run().catch(err => {
    console.error("\n❌ GAGAL:", err.message);
    process.exit(1);
});

