/**
 * ====================================================================
 * MODERN AUTH & POSTGRESQL SESSION ENGINE (SUPABASE NATIVE)
 * ====================================================================
 * High-performance, low-latency (<50ms) authentication service:
 * - PBKDF2-HMAC-SHA256 password hashing & constant-time verification
 * - Backward compatibility with legacy SHA-256 and plaintext hashes
 * - Server-side PostgreSQL Session management (token hash + TTL)
 * - Security Audit Logging for compliance
 * - Multi-tenancy support for KHODIM EDU Core
 */

const crypto = require('crypto');
const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL || "https://qyurpxbawyjijoqpijnw.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5dXJweGJhd3lqaWpvcXBpam53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyOTg3NjMsImV4cCI6MjEwODg3NDc2M30.lEUT2SWaOCVo0__dh5eVwcNirimV57LO9dxJVeAQKdM";
const DEFAULT_TENANT_SLUG = "mubarokah";

// ==================== HELPER POSTGREST ====================

function supabaseQuery(endpoint, method = 'GET', body = null, prefer = null) {
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

// Cache tenant UUID
let cachedTenantId = null;
async function getTenantId(slug = DEFAULT_TENANT_SLUG) {
    if (cachedTenantId) return cachedTenantId;
    const tenants = await supabaseQuery(`/rest/v1/tenants?slug=eq.${encodeURIComponent(slug)}&select=id`);
    if (tenants && tenants.length > 0) {
        cachedTenantId = tenants[0].id;
        return cachedTenantId;
    }
    return null;
}

// ==================== KRIPTOGRAFI PASSWORD & TOKEN ====================

function constantTimeCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

function hashPasswordPbkdf2(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const iterations = 5000;
    const derived = crypto.pbkdf2Sync(String(password), salt, iterations, 32, 'sha256').toString('hex');
    return `PBKDF2$sha256$${iterations}$${salt}$${derived}`;
}

function verifyPassword(inputPassword, storedHash) {
    if (!storedHash || !inputPassword) return false;
    const stored = String(storedHash).trim();

    // 1. Standar Kuat: PBKDF2-HMAC-SHA256
    if (stored.startsWith("PBKDF2$sha256$")) {
        const parts = stored.split("$");
        if (parts.length === 5) {
            const iterations = parseInt(parts[2], 10) || 5000;
            const salt = parts[3];
            const expected = parts[4];
            const derived = crypto.pbkdf2Sync(String(inputPassword), salt, iterations, 32, 'sha256').toString('hex');
            return constantTimeCompare(derived, expected);
        }
    }

    // 2. Backward Compatibility: Plain SHA-256 (64 hex characters)
    if (/^[a-fA-F0-9]{64}$/.test(stored)) {
        const hash = crypto.createHash('sha256').update(String(inputPassword)).digest('hex');
        if (constantTimeCompare(hash.toLowerCase(), stored.toLowerCase())) {
            return true;
        }
        // Legacy with legacy salt fallback
        const legacyHash = crypto.createHash('sha256').update(String(inputPassword) + "mubarokah_salt").digest('hex');
        if (constantTimeCompare(legacyHash.toLowerCase(), stored.toLowerCase())) {
            return true;
        }
    }

    // 3. Plaintext fallback (hanya untuk migrasi awal jika ada)
    return constantTimeCompare(String(inputPassword), stored);
}

function isPasswordUpgradeNeeded(storedHash) {
    if (!storedHash) return true;
    return !String(storedHash).startsWith("PBKDF2$sha256$5000$");
}

function hashToken(token) {
    return crypto.createHash('sha256').update(String(token)).digest('hex');
}

// ==================== AUDIT LOGGING ====================

async function writeAuditLog(tenantId, eventType, identityId, sessionId, channel = 'PASSWORD', success = true, metadata = {}) {
    try {
        await supabaseQuery('/rest/v1/auth_audit_logs', 'POST', {
            tenant_id: tenantId,
            event_type: eventType,
            identity_id: identityId,
            session_id: sessionId,
            channel: channel,
            success: success,
            metadata: metadata
        });
    } catch (e) {
        console.warn('[AUTH AUDIT ERROR]', e.message);
    }
}

// ==================== AUTH SERVICE FUNCTIONS ====================

/**
 * Login Admin / Pengelola dengan Email & Password
 */
async function loginAdminWithPassword(email, password, reqInfo = {}) {
    const tenantId = await getTenantId();
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (!cleanEmail || !password) {
        return { success: false, message: "Email dan Kata Sandi / PIN wajib diisi." };
    }

    // Cari akun admin di user_identities
    const users = await supabaseQuery(
        `/rest/v1/user_identities?tenant_id=eq.${tenantId}&email=ilike.${encodeURIComponent(cleanEmail)}&status=eq.ACTIVE&select=*`
    );

    if (!users || users.length === 0) {
        return null; // Belum ada di Supabase, serahkan ke Google Apps Script fallback
    }

    const user = users[0];
    const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'PENGURUS', 'PENGASUH', 'BENDAHARA', 'ASATIDZ', 'PEGAWAI', 'EDITOR'];
    if (!allowedRoles.includes(user.role)) {
        await writeAuditLog(tenantId, "LOGIN_FORBIDDEN_ROLE", user.identity_id, "", "PASSWORD", false, { role: user.role });
        return { success: false, message: "Akun Anda tidak memiliki hak akses administrator." };
    }

    if (!user.password_hash) {
        return {
            success: false,
            requireSetup: true,
            message: "Akun Anda belum memiliki Kata Sandi / PIN. Silakan buat sandi baru terlebih dahulu."
        };
    }

    if (!verifyPassword(password, user.password_hash)) {
        await writeAuditLog(tenantId, "PASSWORD_LOGIN_FAIL", user.identity_id, "", "PASSWORD", false, { email: cleanEmail });
        return { success: false, message: "Kata Sandi / PIN yang Anda masukkan salah." };
    }

    // Auto-upgrade hash ke PBKDF2 jika perlu
    if (isPasswordUpgradeNeeded(user.password_hash)) {
        const newHash = hashPasswordPbkdf2(password);
        await supabaseQuery(
            `/rest/v1/user_identities?id=eq.${user.id}`,
            'PATCH',
            { password_hash: newHash, updated_at: new Date().toISOString() }
        ).catch(() => {});
    }

    // Buat Sesi PostgreSQL Baru
    const token = 'mub_' + crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const sessionId = 'SES_' + Date.now() + '_' + crypto.randomBytes(6).toString('hex');
    const ttlHours = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' ? 24 : 12;
    const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString();

    await supabaseQuery('/rest/v1/auth_sessions', 'POST', {
        tenant_id: tenantId,
        session_id: sessionId,
        user_id: user.id,
        raw_identity_id: user.identity_id,
        role: user.role,
        token_hash: tokenHash,
        ip_address: reqInfo.ip || null,
        user_agent: reqInfo.userAgent || null,
        status: 'ACTIVE',
        expires_at: expiresAt
    });

    // Update last_login_at
    await supabaseQuery(
        `/rest/v1/user_identities?id=eq.${user.id}`,
        'PATCH',
        { last_login_at: new Date().toISOString() }
    ).catch(() => {});

    await writeAuditLog(tenantId, "PASSWORD_LOGIN_SUCCESS", user.identity_id, sessionId, "PASSWORD", true, { role: user.role });

    return {
        success: true,
        token: token,
        data: {
            token: token,
            role: user.role,
            admin: {
                identityId: user.identity_id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        },
        identity: {
            identityId: user.identity_id,
            name: user.name,
            email: user.email,
            role: user.role
        }
    };
}

/**
 * Login Wali Santri dengan Email/Nomor HP & Password
 */
async function loginParentWithPassword(identifier, password, reqInfo = {}) {
    const tenantId = await getTenantId();
    const cleanId = String(identifier || '').trim();

    if (!cleanId || !password) {
        return { success: false, message: "Nomor WhatsApp / Email dan Kata Sandi wajib diisi." };
    }

    let filter = '';
    if (cleanId.includes('@')) {
        filter = `email=ilike.${encodeURIComponent(cleanId.toLowerCase())}`;
    } else {
        const cleanPhone = cleanId.replace(/[^0-9]/g, '');
        // Cocokkan nomor telepon variasi 08xxx atau +628xxx
        const last8 = cleanPhone.slice(-8);
        filter = `phone=like.*${last8}*`;
    }

    const users = await supabaseQuery(
        `/rest/v1/user_identities?tenant_id=eq.${tenantId}&${filter}&status=eq.ACTIVE&select=*`
    );

    if (!users || users.length === 0) {
        return null; // Fallback ke Google Apps Script
    }

    const user = users[0];
    if (!user.password_hash) {
        return {
            success: false,
            requireSetup: true,
            message: "Akun Anda belum memiliki Kata Sandi / PIN. Silakan masuk via 'Kode OTP' atau aktivasi akun terlebih dahulu."
        };
    }

    if (!verifyPassword(password, user.password_hash)) {
        await writeAuditLog(tenantId, "PASSWORD_LOGIN_FAIL", user.identity_id, "", "PASSWORD", false, { identifier: cleanId });
        return { success: false, message: "Kata Sandi / PIN yang Anda masukkan salah." };
    }

    // Auto-upgrade password hash ke PBKDF2 jika masih hash lama
    if (isPasswordUpgradeNeeded(user.password_hash)) {
        const newHash = hashPasswordPbkdf2(password);
        await supabaseQuery(
            `/rest/v1/user_identities?id=eq.${user.id}`,
            'PATCH',
            { password_hash: newHash, updated_at: new Date().toISOString() }
        ).catch(() => {});
    }

    // Ambil daftar santri yang terhubung dengan wali ini
    let linkedStudents = [];
    try {
        const maps = await supabaseQuery(
            `/rest/v1/student_guardians?tenant_id=eq.${tenantId}&guardian_id=eq.${user.id}&select=student_id,relationship`
        );
        if (maps && maps.length > 0) {
            const studentIds = maps.map(m => `id=eq.${m.student_id}`).join(',');
            const students = await supabaseQuery(`/rest/v1/students?or=(${studentIds})&select=*`);
            linkedStudents = students || [];
        }
    } catch (e) {}

    // Buat Sesi PostgreSQL Baru untuk Wali (TTL 7 hari)
    const token = 'mub_' + crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const sessionId = 'SES_' + Date.now() + '_' + crypto.randomBytes(6).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

    await supabaseQuery('/rest/v1/auth_sessions', 'POST', {
        tenant_id: tenantId,
        session_id: sessionId,
        user_id: user.id,
        raw_identity_id: user.identity_id,
        role: 'WALI_SANTRI',
        token_hash: tokenHash,
        ip_address: reqInfo.ip || null,
        user_agent: reqInfo.userAgent || null,
        status: 'ACTIVE',
        expires_at: expiresAt
    });

    await supabaseQuery(
        `/rest/v1/user_identities?id=eq.${user.id}`,
        'PATCH',
        { last_login_at: new Date().toISOString() }
    ).catch(() => {});

    await writeAuditLog(tenantId, "PASSWORD_LOGIN_SUCCESS", user.identity_id, sessionId, "PASSWORD", true, { role: "WALI_SANTRI" });

    return {
        success: true,
        token: token,
        data: {
            token: token,
            role: "WALI_SANTRI",
            parent: {
                identityId: user.identity_id,
                name: user.name,
                email: user.email,
                phone: user.phone
            },
            students: linkedStudents
        },
        identity: {
            identityId: user.identity_id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: "WALI_SANTRI"
        },
        students: linkedStudents
    };
}

/**
 * Validasi Sesi Token Aktif (auth.session)
 */
async function verifySessionToken(token) {
    if (!token || typeof token !== 'string') return null;

    const tokenHash = hashToken(token);
    const nowIso = new Date().toISOString();

    // Cari sesi aktif di PostgreSQL
    const sessions = await supabaseQuery(
        `/rest/v1/auth_sessions?token_hash=eq.${tokenHash}&status=eq.ACTIVE&expires_at=gt.${encodeURIComponent(nowIso)}&select=*,user:user_identities(*)`
    );

    if (!sessions || sessions.length === 0) {
        return null; // Tidak ditemukan di PostgreSQL
    }

    const session = sessions[0];
    const user = session.user;

    if (!user || user.status !== 'ACTIVE') {
        return null;
    }

    return {
        valid: true,
        sessionId: session.session_id,
        role: session.role,
        identity: {
            identityId: user.identity_id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: session.role
        }
    };
}

/**
 * Cabut Sesi (auth.logout)
 */
async function revokeSession(token) {
    if (!token) return false;
    const tokenHash = hashToken(token);

    const updated = await supabaseQuery(
        `/rest/v1/auth_sessions?token_hash=eq.${tokenHash}`,
        'PATCH',
        { status: 'REVOKED', revoked_at: new Date().toISOString() }
    );
    return true;
}

module.exports = {
    loginAdminWithPassword,
    loginParentWithPassword,
    verifySessionToken,
    revokeSession,
    hashPasswordPbkdf2,
    verifyPassword
};

