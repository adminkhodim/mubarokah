// IDENTITY & ACCOUNT CENTER (PHASE 1 & 2A)=====================================================================

/**
 * Official Product Roles
 */
const ASN_ROLES = Object.freeze({
    PUBLIC: 'PUBLIC',
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    BENDAHARA: 'BENDAHARA',
    PENGURUS: 'PENGURUS',
    ASATIDZ: 'ASATIDZ',
    PEGAWAI: 'ASATIDZ', // Alias for backward compatibility
    EDITOR: 'ASATIDZ', // Alias for backward compatibility
    PENGASUH: 'PENGASUH',
    WALI_SANTRI: 'WALI_SANTRI'
});

/**
 * Frontend Identity State Machine States (Phase 3)
 */
const ASN_STATES = Object.freeze({
    UNINITIALIZED: 'UNINITIALIZED',
    HYDRATING: 'HYDRATING',
    PUBLIC: 'PUBLIC',
    WALI_LOGIN: 'WALI_LOGIN',
    WALI_OTP: 'WALI_OTP',
    WALI_ACTIVATION: 'WALI_ACTIVATION',
    WALI_ACTIVATION_OTP: 'WALI_ACTIVATION_OTP',
    WALI_HYDRATING: 'WALI_HYDRATING',
    WALI_AUTH_ACTIVE: 'WALI_AUTH_ACTIVE',
    ADMIN_LOGIN: 'ADMIN_LOGIN',
    ADMIN_OTP: 'ADMIN_OTP',
    ADMIN_AUTH_ACTIVE: 'ADMIN_AUTH_ACTIVE',
    PENGASUH_LOGIN: 'PENGASUH_LOGIN',
    PENGASUH_AUTH_ACTIVE: 'PENGASUH_AUTH_ACTIVE',
    LOGGING_OUT: 'LOGGING_OUT',
    SESSION_EXPIRED: 'SESSION_EXPIRED'
});

/**
 * Endpoint Contract Definition for Phase 2B Backend Baseline (Version 57)
 */
const ASN_AUTH_ACTIONS = Object.freeze({
    ADMIN_LOGIN_PASSWORD: 'auth.admin.loginWithPassword',
    PARENT_LOGIN_NIS: 'auth.parent.loginWithNis',
    ADMIN_SET_PASSWORD: 'auth.admin.setPassword',
    PARENT_LOGIN_PASSWORD: 'auth.parent.loginWithPassword',
    PARENT_SET_PASSWORD: 'auth.parent.setPassword',
    ADMIN_REQUEST_OTP: 'auth.admin.requestOtp',
    ADMIN_VERIFY_OTP: 'auth.admin.verifyOtp',
    PARENT_REQUEST_OTP: 'auth.parent.requestOtp',
    PARENT_VERIFY_OTP: 'auth.parent.verifyOtp',
    PARENT_ACTIVATE: 'auth.parent.activate',
    PARENT_VERIFY_ACTIVATION: 'auth.parent.verifyActivation',
    SESSION_VERIFY: 'auth.session',
    PARENT_ME: 'auth.parent.me',
    PARENT_STUDENTS: 'auth.parent.students',
    PENGASUH_ME: 'auth.pengasuh.me',
    SSO_GOOGLE: 'auth.sso.google',
    LOGOUT: 'auth.logout',
    USER_UPLOAD_PHOTO: 'auth.user.uploadPhoto',
    ADMIN_USER_LIST: 'auth.admin.userList',
    ADMIN_USER_SAVE: 'auth.admin.userSave',
    ADMIN_USER_TOGGLE_STATUS: 'auth.admin.userToggleStatus'
});

/**
 * Storage Keys for Session Integrity, referencing APP_CONFIG
 */
const ASN_STORAGE_KEYS = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.storage && APP_CONFIG.storage.keys)
    ? Object.freeze({
        ADMIN_TOKEN: APP_CONFIG.storage.keys.adminToken,
        ADMIN_ROLE: APP_CONFIG.storage.keys.adminRole,
        ADMIN_DATA: APP_CONFIG.storage.keys.adminData,
        PARENT_TOKEN: APP_CONFIG.storage.keys.parentToken,
        PARENT_DATA: APP_CONFIG.storage.keys.parentData,
        PARENT_STUDENTS: APP_CONFIG.storage.keys.parentStudents,
        PENGASUH_TOKEN: APP_CONFIG.storage.keys.pengasuhToken,
        PENGASUH_DATA: APP_CONFIG.storage.keys.pengasuhData,
        TEMP_ADMIN_EMAIL: APP_CONFIG.storage.keys.tempAdminEmail || 'mubarokah_temp_admin_email',
        TEMP_PARENT_EMAIL: APP_CONFIG.storage.keys.tempParentEmail || 'mubarokah_temp_parent_email',
        TEMP_PARENT_PHONE: APP_CONFIG.storage.keys.tempParentPhone || 'mubarokah_temp_parent_phone',
        TEMP_ACTIVATION_DATA: APP_CONFIG.storage.keys.tempActivationData || 'mubarokah_temp_activation_data'
    })
    : Object.freeze({
        ADMIN_TOKEN: 'mubarokah_admin_token',
        ADMIN_ROLE: 'mubarokah_admin_role',
        ADMIN_DATA: 'mubarokah_admin_data',
        PARENT_TOKEN: 'mubarokah_parent_token',
        PARENT_DATA: 'mubarokah_parent_data',
        PARENT_STUDENTS: 'mubarokah_parent_students',
        PENGASUH_TOKEN: 'mubarokah_pengasuh_token',
        PENGASUH_DATA: 'mubarokah_pengasuh_data',
        TEMP_ADMIN_EMAIL: 'mubarokah_temp_admin_email',
        TEMP_PARENT_EMAIL: 'mubarokah_temp_parent_email',
        TEMP_PARENT_PHONE: 'mubarokah_temp_parent_phone',
        TEMP_ACTIVATION_DATA: 'mubarokah_temp_activation_data'
    });

/**
 * Dedicated Phase 2B Auth API Endpoint, referencing APP_CONFIG
 */
const ASN_PHASE2B_AUTH_URL = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.authentication && APP_CONFIG.authentication.authApiUrl && APP_CONFIG.authentication.authApiUrl !== '__MUBAROKAH_CONFIG_PENDING__')
    ? APP_CONFIG.authentication.authApiUrl
    : (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.infrastructure && (APP_CONFIG.infrastructure.apiBaseUrl || APP_CONFIG.infrastructure.appsScriptWebAppUrl) && (APP_CONFIG.infrastructure.apiBaseUrl || APP_CONFIG.infrastructure.appsScriptWebAppUrl) !== '__MUBAROKAH_CONFIG_PENDING__')
    ? (APP_CONFIG.infrastructure.apiBaseUrl || APP_CONFIG.infrastructure.appsScriptWebAppUrl)
    : ""; // __MUBAROKAH_CONFIG_PENDING__

async function authApiPost(action, payload = {}) {
    const directUrl = ASN_PHASE2B_AUTH_URL || (typeof WEB_APP_URL !== 'undefined' ? WEB_APP_URL : '');
    const targetUrl = directUrl;
    if (!targetUrl) throw new Error("Endpoint autentikasi belum dikonfigurasi.");

    const token = payload.token || 
                  (typeof getAdminSessionToken === "function" ? getAdminSessionToken() : (sessionStorage.getItem(ASN_STORAGE_KEYS.ADMIN_TOKEN) || localStorage.getItem(ASN_STORAGE_KEYS.ADMIN_TOKEN))) || 
                  sessionStorage.getItem(ASN_STORAGE_KEYS.PARENT_TOKEN) || 
                  localStorage.getItem(ASN_STORAGE_KEYS.PARENT_TOKEN) ||
                  sessionStorage.getItem(ASN_STORAGE_KEYS.PENGASUH_TOKEN) ||
                  localStorage.getItem(ASN_STORAGE_KEYS.PENGASUH_TOKEN) || "";

    const bodyPayload = { action, ...payload };
    if (token && !bodyPayload.token) {
        bodyPayload.token = token;
    }

    // Authoritative tenant lock
    const authoritativeTenantId = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.tenant && APP_CONFIG.tenant.tenantId)
        ? APP_CONFIG.tenant.tenantId
        : "mubarokah";
    bodyPayload.tenantId = authoritativeTenantId;

    const response = await fetch(targetUrl, {
        method: "POST",
        redirect: "follow",
        credentials: "omit",
        headers: {
            "Content-Type": "text/plain;charset=utf-8",
            "Accept": "application/json"
        },
        body: JSON.stringify(bodyPayload)
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
}

/**
 * Authentication API Abstraction Layer (Fail-Safe)
 * Bertindak sebagai boundary interface antara UI dan Backend.
 */
const ASNAuthAPI = {
    async loginAdminWithPassword(email, password) {
        if (!email || !password) {
            return { success: false, message: 'Email dan password wajib diisi.' };
        }
        try {
            const response = await authApiPost(ASN_AUTH_ACTIONS.ADMIN_LOGIN_PASSWORD, {
                email: email.trim(),
                password: password
            });
            if (response && response.success && response.token) {
                const role = response.role || (response.identity && response.identity.role) || ASN_ROLES.ADMIN;
                const adminObj = response.identity || (response.data && response.data.admin) || { email, name: 'Administrator' };
                adminObj.role = role === 'EDITOR' ? ASN_ROLES.PEGAWAI : (ASN_ROLES[role] || role);
                return {
                    success: true,
                    token: response.token,
                    role: adminObj.role,
                    admin: adminObj
                };
            }
            return {
                success: false,
                requireSetup: response && response.requireSetup,
                message: (response && response.message) || 'Login admin gagal. Periksa kembali email dan password Anda.'
            };
        } catch (err) {
            console.warn('[ASNAuthAPI] loginAdminWithPassword error:', err);
            return {
                success: false,
                unavailable: true,
                message: 'Gagal menghubungi server autentikasi.'
            };
        }
    },

    async setAdminPassword(password, email = '', token = '') {
        try {
            const response = await authApiPost(ASN_AUTH_ACTIONS.ADMIN_SET_PASSWORD, {
                password,
                email,
                token
            });
            return response;
        } catch (err) {
            return { success: false, message: 'Gagal menyimpan password admin.' };
        }
    },

    async loginParentWithNis(nis, birthDate) {
        if (!nis || !birthDate) {
            return { success: false, message: 'NIS Santri dan PIN Tanggal Lahir (dd/mm/yyyy) wajib diisi.' };
        }
        try {
            const response = await authApiPost(ASN_AUTH_ACTIONS.PARENT_LOGIN_NIS, {
                nis: String(nis).trim(),
                birthDate: String(birthDate).trim()
            });
            if (response && response.success && response.token) {
                const parentObj = response.identity || (response.data && response.data.identity) || {
                    name: 'Wali Santri',
                    role: ASN_ROLES.WALI_SANTRI
                };
                const students = response.students || (response.data && response.data.students) || (response.student ? [response.student] : []);
                return {
                    success: true,
                    token: response.token,
                    identity: parentObj,
                    students: students
                };
            }
            return {
                success: false,
                message: (response && response.message) || 'Kombinasi NIS dan PIN Tanggal Lahir tidak cocok.'
            };
        } catch (err) {
            console.warn('[ASNAuthAPI] loginParentWithNis error:', err);
            return {
                success: false,
                unavailable: true,
                message: 'Gagal menghubungi server autentikasi.'
            };
        }
    },

    async loginParentWithPassword(identifier, password) {
        if (!identifier || !password) {
            return { success: false, message: 'Email / No. HP dan password wajib diisi.' };
        }
        try {
            const response = await authApiPost(ASN_AUTH_ACTIONS.PARENT_LOGIN_PASSWORD, {
                identifier: identifier.trim(),
                password: password
            });
            if (response && response.success && response.token) {
                return {
                    success: true,
                    token: response.token,
                    role: ASN_ROLES.WALI_SANTRI,
                    parent: response.parent || response.identity || { email: identifier, name: 'Wali Santri' },
                    students: response.students || (response.data && response.data.students) || []
                };
            }
            return {
                success: false,
                requireSetup: response && response.requireSetup,
                message: (response && response.message) || 'Login Wali Santri gagal. Periksa kembali email/No. HP dan password Anda.'
            };
        } catch (err) {
            console.warn('[ASNAuthAPI] loginParentWithPassword error:', err);
            return {
                success: false,
                unavailable: true,
                message: 'Gagal menghubungi server autentikasi.'
            };
        }
    },

    async setParentPassword(password, identifier = '', token = '') {
        try {
            const response = await authApiPost(ASN_AUTH_ACTIONS.PARENT_SET_PASSWORD, {
                password,
                identifier,
                token
            });
            return response;
        } catch (err) {
            return { success: false, message: 'Gagal menyimpan password wali santri.' };
        }
    },
    async requestAdminOtp(email) {
        if (!email || !email.includes('@')) {
            return { success: false, message: 'Alamat email tidak valid.' };
        }

        try {
            const response = await authApiPost(ASN_AUTH_ACTIONS.ADMIN_REQUEST_OTP, { email: email.trim() });
            if (response && response.success) {
                return { 
                    success: true, 
                    message: response.message || 'OTP berhasil dikirim ke email.',
                    cooldownSeconds: response.cooldownSeconds || 60
                };
            }

            return {
                success: false,
                unavailable: false,
                message: (response && response.message) 
                    ? response.message 
                    : 'Gagal mengirimkan kode OTP ke email pengelola.'
            };
        } catch (err) {
            console.warn('[ASNAuthAPI] requestAdminOtp error:', err);
            return {
                success: false,
                unavailable: true,
                message: 'Gagal menghubungi server autentikasi. Pastikan koneksi internet stabil.'
            };
        }
    },

    async verifyAdminOtp(email, otp) {
        if (!email || !otp || otp.length !== 6) {
            return { success: false, message: 'Kode OTP harus berupa 6 digit angka.' };
        }

        try {
            const deviceInfo = typeof detectClientDeviceInfo === 'function' ? detectClientDeviceInfo() : 'Desktop';
            const response = await authApiPost(ASN_AUTH_ACTIONS.ADMIN_VERIFY_OTP, { 
                email: email.trim(), 
                otp: otp.trim(),
                deviceInfo: deviceInfo
            });

            if (response && response.success) {
                const token = response.token || (response.data && response.data.token);
                const rawRole = response.role || (response.data && response.data.role) || (response.identity && response.identity.role) || ASN_ROLES.ADMIN;
                const role = rawRole === 'EDITOR' ? ASN_ROLES.PEGAWAI : (ASN_ROLES[rawRole] || rawRole);
                const adminData = response.admin || response.identity || (response.data && response.data.admin) || { email: email, name: 'Administrator' };
                adminData.role = role;
                if (!adminData.email) adminData.email = email.trim();

                if (token) {
                    return {
                        success: true,
                        token: token,
                        role: role,
                        admin: adminData
                    };
                }
            }

            return {
                success: false,
                unavailable: false,
                message: (response && response.message) 
                    ? response.message 
                    : 'Verifikasi OTP gagal.'
            };
        } catch (err) {
            console.warn('[ASNAuthAPI] verifyAdminOtp error:', err);
            return {
                success: false,
                unavailable: true,
                message: 'Verifikasi OTP gagal. Terjadi kendala komunikasi ke server.'
            };
        }
    },

    async requestParentOtp(email) {
        const normalized = String(email || '').trim().toLowerCase();
        if (!normalized || !normalized.includes('@')) {
            return { success: false, message: 'Alamat email tidak valid.' };
        }

        try {
            const response = await authApiPost(ASN_AUTH_ACTIONS.PARENT_REQUEST_OTP, { email: normalized });
            if (response && response.success) {
                return { 
                    success: true, 
                    message: response.message || 'Kode OTP telah dikirimkan ke email Anda.',
                    cooldownSeconds: response.cooldownSeconds || 60
                };
            }

            return {
                success: false,
                unavailable: false,
                message: (response && response.message) 
                    ? response.message 
                    : 'Gagal mengirimkan kode OTP ke email.'
            };
        } catch (err) {
            console.warn('[ASNAuthAPI] requestParentOtp error:', err);
            return {
                success: false,
                unavailable: true,
                message: 'Gagal menghubungi server autentikasi Email OTP.'
            };
        }
    },

    async verifyParentOtp(email, otp) {
        const normalized = String(email || '').trim().toLowerCase();
        const cleanOtp = String(otp || '').trim();
        if (!normalized || !cleanOtp || cleanOtp.length !== 6) {
            return { success: false, message: 'Kode OTP harus berupa 6 digit angka.' };
        }

        try {
            const response = await authApiPost(ASN_AUTH_ACTIONS.PARENT_VERIFY_OTP, { 
                email: normalized, 
                otp: cleanOtp 
            });

            if (response && response.success) {
                const token = response.token || (response.data && response.data.token);
                const role = response.role || (response.data && response.data.role) || ASN_ROLES.WALI_SANTRI;
                const parentData = response.identity || (response.data && response.data.parent) || { email: normalized, name: 'Wali Santri' };
                const students = response.students || (response.data && response.data.students) || [];

                if (token) {
                    return {
                        success: true,
                        token: token,
                        role: role,
                        parent: parentData,
                        students: students
                    };
                }
            }

            return {
                success: false,
                unavailable: false,
                message: (response && response.message) 
                    ? response.message 
                    : 'Verifikasi Email OTP gagal.'
            };
        } catch (err) {
            console.warn('[ASNAuthAPI] verifyParentOtp error:', err);
            return {
                success: false,
                unavailable: true,
                message: 'Verifikasi Email OTP gagal. Terjadi kendala komunikasi ke server.'
            };
        }
    },

    async verifySession(token) {
        if (!token) return { success: false, valid: false };
        try {
            const response = await authApiPost(ASN_AUTH_ACTIONS.SESSION_VERIFY, { token: token });
            if (response && response.success && response.valid) {
                return {
                    success: true,
                    valid: true,
                    role: response.role,
                    identity: response.identity
                };
            }
            const msg = String((response && response.message) || '').toLowerCase();
            const isExplicitAuthRejection = msg.includes('expired') || 
                                            msg.includes('kedaluwarsa') || 
                                            msg.includes('kadaluarsa') || 
                                            msg.includes('revoked') || 
                                            msg.includes('dicabut') || 
                                            msg.includes('inactive') || 
                                            msg.includes('tidak aktif') || 
                                            msg.includes('suspended') || 
                                            msg.includes('tampered') || 
                                            msg.includes('invalid authentication token') ||
                                            msg.includes('unauthorized');

            if (!isExplicitAuthRejection) {
                // Error non-auth (misal timeout spreadsheet, script lock timeout, server overload) -> anggap unavailable
                console.warn('[ASNAuthAPI] Response non-auth saat verifikasi sesi (dianggap transien):', response && response.message);
                return { success: false, valid: false, unavailable: true, message: (response && response.message) || 'Layanan server sedang sibuk.' };
            }

            return { success: false, valid: false, unavailable: false, message: (response && response.message) || 'Sesi tidak valid.' };
        } catch (err) {
            console.warn('[ASNAuthAPI] verifySession network/catch error:', err);
            return { success: false, valid: false, unavailable: true, message: 'Gagal memverifikasi sesi ke server.' };
        }
    },

    async getParentProfile(token) {
        if (!token) return { success: false };
        try {
            const response = await authApiPost(ASN_AUTH_ACTIONS.PARENT_ME, { token: token });
            if (response && response.success && response.parent) {
                return { success: true, parent: response.parent };
            }
            return { success: false, message: (response && response.message) || 'Gagal memuat profil wali santri.' };
        } catch (err) {
            console.warn('[ASNAuthAPI] getParentProfile error:', err);
            return { success: false, unavailable: true, message: 'Gagal menghubungi server.' };
        }
    },

    async getParentStudents(token) {
        if (!token) return { success: false, students: [] };
        try {
            const response = await authApiPost(ASN_AUTH_ACTIONS.PARENT_STUDENTS, { token: token });
            if (response && response.success && Array.isArray(response.students)) {
                return { success: true, students: response.students };
            }
            return { success: false, students: [], message: (response && response.message) || 'Gagal memuat daftar santri.' };
        } catch (err) {
            console.warn('[ASNAuthAPI] getParentStudents error:', err);
            return { success: false, students: [], unavailable: true, message: 'Gagal menghubungi server.' };
        }
    },

    async logoutSession(token) {
        if (!token) return { success: true };
        try {
            const response = await authApiPost(ASN_AUTH_ACTIONS.LOGOUT, { token: token });
            return response || { success: true };
        } catch (err) {
            console.warn('[ASNAuthAPI] logoutSession error:', err);
            return { success: false, error: err.message };
        }
    },

    async ssoGoogle(credential, targetRole = "") {
        if (!credential) return { success: false, message: "Kredensial token Google tidak ditemukan." };
        try {
            const response = await authApiPost(ASN_AUTH_ACTIONS.SSO_GOOGLE, {
                credential: credential,
                targetRole: targetRole
            });
            return response;
        } catch (err) {
            console.warn('[ASNAuthAPI] ssoGoogle error:', err);
            return { success: false, unavailable: true, message: 'Gagal menghubungi server Google SSO.' };
        }
    },

    async activateParent(payload) {
        try {
            const response = await authApiPost(ASN_AUTH_ACTIONS.PARENT_ACTIVATE, payload);
            return response;
        } catch (err) {
            console.warn('[ASNAuthAPI] activateParent error:', err);
            return { success: false, unavailable: true, message: 'Gagal menghubungi server aktivasi santri.' };
        }
    },

    async verifyParentActivation(payload) {
        try {
            const response = await authApiPost(ASN_AUTH_ACTIONS.PARENT_VERIFY_ACTIVATION, payload);
            return response;
        } catch (err) {
            console.warn('[ASNAuthAPI] verifyParentActivation error:', err);
            return { success: false, unavailable: true, message: 'Gagal memverifikasi aktivasi santri.' };
        }
    },

    async getPengasuhProfile(token) {
        if (!token) return { success: false };
        try {
            const response = await authApiPost(ASN_AUTH_ACTIONS.PENGASUH_ME, { token: token });
            return response;
        } catch (err) {
            console.warn('[ASNAuthAPI] getPengasuhProfile error:', err);
            return { success: false, unavailable: true, message: 'Gagal memuat profil pengasuh.' };
        }
    },

    async uploadUserPhoto(filePayload, role, identityId) {
        const token = sessionStorage.getItem(ASN_STORAGE_KEYS.PENGASUH_TOKEN) || 
                      localStorage.getItem(ASN_STORAGE_KEYS.PENGASUH_TOKEN) || 
                      sessionStorage.getItem(ASN_STORAGE_KEYS.ADMIN_TOKEN) || 
                      localStorage.getItem(ASN_STORAGE_KEYS.ADMIN_TOKEN) || 
                      sessionStorage.getItem(ASN_STORAGE_KEYS.PARENT_TOKEN) || 
                      localStorage.getItem(ASN_STORAGE_KEYS.PARENT_TOKEN) || "";
        return await authApiPost(ASN_AUTH_ACTIONS.USER_UPLOAD_PHOTO, {
            token: token,
            data: {
                file: filePayload,
                role: role,
                identityId: identityId
            }
        });
    }
};

/**
 * Identity Manager & State Machine (Phase 3)
 */
const ASNIdentity = {
    currentState: ASN_STATES.UNINITIALIZED,
    currentRole: ASN_ROLES.PUBLIC,
    currentUser: null,
    linkedStudents: [],
    isHydrating: false,
    studentsLoadFailed: false,

    init() {
        // Optimistic cache load: periksa sesi lokal terlebih dahulu agar UI instan (0 ms)
        const pengasuhToken = sessionStorage.getItem(ASN_STORAGE_KEYS.PENGASUH_TOKEN) || localStorage.getItem(ASN_STORAGE_KEYS.PENGASUH_TOKEN);
        const adminToken = sessionStorage.getItem(ASN_STORAGE_KEYS.ADMIN_TOKEN) || localStorage.getItem(ASN_STORAGE_KEYS.ADMIN_TOKEN);
        const parentToken = sessionStorage.getItem(ASN_STORAGE_KEYS.PARENT_TOKEN) || localStorage.getItem(ASN_STORAGE_KEYS.PARENT_TOKEN);

        if (pengasuhToken) {
            this.currentRole = ASN_ROLES.PENGASUH;
            this.currentState = ASN_STATES.PENGASUH_AUTH_ACTIVE;
            try {
                const saved = sessionStorage.getItem(ASN_STORAGE_KEYS.PENGASUH_DATA) || localStorage.getItem(ASN_STORAGE_KEYS.PENGASUH_DATA);
                if (saved) this.currentUser = JSON.parse(saved);
            } catch (e) {}
        } else if (adminToken) {
            const savedRole = sessionStorage.getItem(ASN_STORAGE_KEYS.ADMIN_ROLE) || localStorage.getItem(ASN_STORAGE_KEYS.ADMIN_ROLE);
            this.currentRole = savedRole === 'EDITOR' ? ASN_ROLES.PEGAWAI : (ASN_ROLES[savedRole] || savedRole || ASN_ROLES.ADMIN);
            this.currentState = ASN_STATES.ADMIN_AUTH_ACTIVE;
            try {
                const savedData = sessionStorage.getItem(ASN_STORAGE_KEYS.ADMIN_DATA) || localStorage.getItem(ASN_STORAGE_KEYS.ADMIN_DATA);
                this.currentUser = savedData ? JSON.parse(savedData) : { name: 'Administrator Pesantren', email: '', role: this.currentRole };
            } catch (e) {}
            if (typeof isAdminLoggedIn !== 'undefined') isAdminLoggedIn = true;
        } else if (parentToken) {
            this.currentRole = ASN_ROLES.WALI_SANTRI;
            this.currentState = ASN_STATES.PARENT_AUTH_ACTIVE;
            try {
                const saved = sessionStorage.getItem(ASN_STORAGE_KEYS.PARENT_DATA) || localStorage.getItem(ASN_STORAGE_KEYS.PARENT_DATA);
                if (saved) this.currentUser = JSON.parse(saved);
                const savedStuds = sessionStorage.getItem(ASN_STORAGE_KEYS.PARENT_STUDENTS) || localStorage.getItem(ASN_STORAGE_KEYS.PARENT_STUDENTS);
                if (savedStuds) this.linkedStudents = JSON.parse(savedStuds);
            } catch (e) {}
        } else {
            this.currentRole = ASN_ROLES.PUBLIC;
            this.currentState = ASN_STATES.PUBLIC;
            this.currentUser = null;
        }

        // Tampilkan antarmuka seketika (0 ms) tanpa kedipan skeleton
        this.renderAccountCenterUI();

        // Muat konfigurasi izin peran dari backend
        if (typeof fetchRolePermissionsFromBackend === 'function') {
            fetchRolePermissionsFromBackend();
        }

        // Silent background session re-validation
        if (pengasuhToken || adminToken || parentToken) {
            this.hydrateSession(true).catch(err => {
                console.warn('[ASNIdentity] Silent hydration caught error:', err);
            });
        }
    },

    /**
     * Decode token payload dan cek apakah sudah expired secara client-side.
     * Mengembalikan { expired: boolean, claims: object|null }
     */
    _checkTokenExpiryLocally(token) {
        try {
            if (!token || typeof token !== 'string' || !token.includes('.')) return { expired: true, claims: null };
            const payloadStr = token.split('.')[0];
            const jsonStr = atob(payloadStr);
            const claims = JSON.parse(jsonStr);
            if (!claims || !claims.expiresAt) return { expired: false, claims: claims }; // Tidak bisa ditentukan, anggap belum expired
            const expTime = new Date(claims.expiresAt).getTime();
            if (isNaN(expTime)) return { expired: false, claims: claims };
            return { expired: Date.now() >= expTime, claims: claims };
        } catch (e) {
            console.warn('[ASNIdentity] Gagal decode token secara lokal:', e);
            return { expired: false, claims: null }; // Jika gagal parse, anggap belum expired (biarkan server yang memutuskan)
        }
    },

    async hydrateSession(isSilent = false) {
        if (this.isHydrating) return;
        this.isHydrating = true;
        if (!isSilent) {
            this.currentState = ASN_STATES.HYDRATING;
            this.renderAccountCenterUI();
        }

        const pengasuhToken = sessionStorage.getItem(ASN_STORAGE_KEYS.PENGASUH_TOKEN) || localStorage.getItem(ASN_STORAGE_KEYS.PENGASUH_TOKEN);
        const adminToken = sessionStorage.getItem(ASN_STORAGE_KEYS.ADMIN_TOKEN) || localStorage.getItem(ASN_STORAGE_KEYS.ADMIN_TOKEN);
        const parentToken = sessionStorage.getItem(ASN_STORAGE_KEYS.PARENT_TOKEN) || localStorage.getItem(ASN_STORAGE_KEYS.PARENT_TOKEN);
        const token = pengasuhToken || adminToken || parentToken;

        if (!token) {
            this.clearLocalSession();
            this.currentState = ASN_STATES.PUBLIC;
            this.currentRole = ASN_ROLES.PUBLIC;
            this.currentUser = null;
            this.isHydrating = false;
            this.renderAccountCenterUI();
            return;
        }

        // CLIENT-SIDE EXPIRY CHECK: Cek apakah token sudah benar-benar expired
        // Jika expired secara lokal, langsung clear tanpa perlu tanya server
        const localCheck = this._checkTokenExpiryLocally(token);
        if (localCheck.expired) {
            console.warn('[ASNIdentity] Token sudah expired secara lokal (client-side). Membersihkan sesi.');
            this.clearLocalSession();
            this.currentState = ASN_STATES.SESSION_EXPIRED;
            this.currentRole = ASN_ROLES.PUBLIC;
            this.currentUser = null;
            this.isHydrating = false;
            this.renderAccountCenterUI();
            return;
        }

        try {
            const verifyRes = await ASNAuthAPI.verifySession(token);
            if (!verifyRes.success || !verifyRes.valid) {
                if (verifyRes.unavailable) {
                    console.warn('[ASNIdentity] Server belum dapat dihubungi saat hydration, mempertahankan sesi lokal (Stay Logged In).');
                    this.isHydrating = false;
                    return;
                }
                // Server secara eksplisit menolak token (expired/revoked di server)
                console.warn('[ASNIdentity] Sesi ditolak atau telah dicabut server.');
                this.clearLocalSession();
                this.currentState = ASN_STATES.SESSION_EXPIRED;
                this.currentRole = ASN_ROLES.PUBLIC;
                this.currentUser = null;
                this.isHydrating = false;
                this.renderAccountCenterUI();
                return;
            }

            const serverRole = String(verifyRes.role || '').toUpperCase();
            if (serverRole === 'PENGASUH') {
                this.currentRole = ASN_ROLES.PENGASUH;
                const profRes = await ASNAuthAPI.getPengasuhProfile(token);
                if (profRes.success && profRes.pengasuh) {
                    this.currentUser = profRes.pengasuh;
                    sessionStorage.setItem(ASN_STORAGE_KEYS.PENGASUH_DATA, JSON.stringify(profRes.pengasuh));
                    localStorage.setItem(ASN_STORAGE_KEYS.PENGASUH_DATA, JSON.stringify(profRes.pengasuh));
                } else if (verifyRes.identity) {
                    this.currentUser = verifyRes.identity;
                }
                this.currentState = ASN_STATES.PENGASUH_AUTH_ACTIVE;
                this.isHydrating = false;
                this.renderAccountCenterUI();
            } else if (['SUPER_ADMIN', 'ADMIN', 'BENDAHARA', 'PENGURUS', 'ASATIDZ', 'PEGAWAI', 'EDITOR'].includes(serverRole)) {
                const normalizedRole = (serverRole === 'EDITOR' || serverRole === 'PEGAWAI') ? ASN_ROLES.ASATIDZ : (ASN_ROLES[serverRole] || serverRole);
                this.currentRole = normalizedRole;
                this.currentUser = verifyRes.identity || {
                    name: 'Administrator Pesantren',
                    email: '',
                    role: normalizedRole
                };
                sessionStorage.setItem(ASN_STORAGE_KEYS.ADMIN_ROLE, normalizedRole);
                localStorage.setItem(ASN_STORAGE_KEYS.ADMIN_ROLE, normalizedRole);
                sessionStorage.setItem(ASN_STORAGE_KEYS.ADMIN_DATA, JSON.stringify(this.currentUser));
                localStorage.setItem(ASN_STORAGE_KEYS.ADMIN_DATA, JSON.stringify(this.currentUser));
                if (typeof isAdminLoggedIn !== 'undefined') isAdminLoggedIn = true;
                this.currentState = ASN_STATES.ADMIN_AUTH_ACTIVE;
                this.isHydrating = false;
                this.renderAccountCenterUI();
            } else if (serverRole === 'WALI_SANTRI') {
                this.currentRole = ASN_ROLES.WALI_SANTRI;
                if (!isSilent) {
                    this.currentState = ASN_STATES.WALI_HYDRATING;
                    this.renderAccountCenterUI();
                }

                // Hydrate parent profile & student relationships from server
                const [profRes, studRes] = await Promise.all([
                    ASNAuthAPI.getParentProfile(token),
                    ASNAuthAPI.getParentStudents(token)
                ]);

                if (profRes.success && profRes.parent) {
                    this.currentUser = profRes.parent;
                    sessionStorage.setItem(ASN_STORAGE_KEYS.PARENT_DATA, JSON.stringify(profRes.parent));
                    localStorage.setItem(ASN_STORAGE_KEYS.PARENT_DATA, JSON.stringify(profRes.parent));
                } else if (verifyRes.identity) {
                    this.currentUser = verifyRes.identity;
                }

                if (studRes.success && Array.isArray(studRes.students)) {
                    this.linkedStudents = studRes.students;
                    sessionStorage.setItem(ASN_STORAGE_KEYS.PARENT_STUDENTS, JSON.stringify(studRes.students));
                    localStorage.setItem(ASN_STORAGE_KEYS.PARENT_STUDENTS, JSON.stringify(studRes.students));
                    this.studentsLoadFailed = false;
                } else {
                    console.warn('[ASNIdentity] Gagal memuat daftar santri terhubung.');
                    this.studentsLoadFailed = true;
                }

                this.currentState = ASN_STATES.WALI_AUTH_ACTIVE;
                this.isHydrating = false;
                this.renderAccountCenterUI();
            } else {
                this.clearLocalSession();
                this.currentState = ASN_STATES.PUBLIC;
                this.currentRole = ASN_ROLES.PUBLIC;
                this.currentUser = null;
                this.isHydrating = false;
                this.renderAccountCenterUI();
            }
        } catch (err) {
            // TOLERAN TERHADAP ERROR TRANSIEN: Jangan hapus sesi jika hanya error jaringan/server
            // Sesi lokal dipertahankan selama token belum expired (sudah dicek di atas)
            console.warn('[ASNIdentity] Exception saat session hydration (sesi lokal dipertahankan):', err.message || err);
            this.isHydrating = false;
            // Tidak perlu render ulang UI karena state dari init() sudah menampilkan sesi yang benar
        }
    },

    getRole() {
        return this.currentRole;
    },

    getUser() {
        return this.currentUser;
    },

    resolveIdentity() {
        return this.currentRole;
    },

    setPengasuhSession(token, pengasuhData) {
        if (!token) return;
        sessionStorage.setItem(ASN_STORAGE_KEYS.PENGASUH_TOKEN, token);
        localStorage.setItem(ASN_STORAGE_KEYS.PENGASUH_TOKEN, token);
        sessionStorage.setItem(ASN_STORAGE_KEYS.PENGASUH_DATA, JSON.stringify(pengasuhData || {}));
        localStorage.setItem(ASN_STORAGE_KEYS.PENGASUH_DATA, JSON.stringify(pengasuhData || {}));
        this.currentRole = ASN_ROLES.PENGASUH;
        this.currentUser = pengasuhData;
        this.currentState = ASN_STATES.PENGASUH_AUTH_ACTIVE;
        this.renderAccountCenterUI();
    },

    setAdminSession(token, adminData, roleOverride) {
        if (!token) return;
        const rawRole = roleOverride || (adminData && adminData.role) || sessionStorage.getItem(ASN_STORAGE_KEYS.ADMIN_ROLE) || 'ADMIN';
        const role = rawRole === 'EDITOR' ? ASN_ROLES.PEGAWAI : (ASN_ROLES[rawRole] || rawRole);
        if (adminData && typeof adminData === 'object') adminData.role = role;
        sessionStorage.setItem(ASN_STORAGE_KEYS.ADMIN_TOKEN, token);
        localStorage.setItem(ASN_STORAGE_KEYS.ADMIN_TOKEN, token);
        sessionStorage.setItem(ASN_STORAGE_KEYS.ADMIN_ROLE, role);
        localStorage.setItem(ASN_STORAGE_KEYS.ADMIN_ROLE, role);
        sessionStorage.setItem(ASN_STORAGE_KEYS.ADMIN_DATA, JSON.stringify(adminData || {}));
        localStorage.setItem(ASN_STORAGE_KEYS.ADMIN_DATA, JSON.stringify(adminData || {}));
        this.currentRole = role;
        this.currentUser = adminData;
        if (typeof isAdminLoggedIn !== 'undefined') isAdminLoggedIn = true;
        this.currentState = ASN_STATES.ADMIN_AUTH_ACTIVE;
        this.renderAccountCenterUI();
    },

    setParentSession(token, parentData, students) {
        if (!token) return;
        sessionStorage.setItem(ASN_STORAGE_KEYS.PARENT_TOKEN, token);
        localStorage.setItem(ASN_STORAGE_KEYS.PARENT_TOKEN, token);
        sessionStorage.setItem(ASN_STORAGE_KEYS.PARENT_DATA, JSON.stringify(parentData || {}));
        localStorage.setItem(ASN_STORAGE_KEYS.PARENT_DATA, JSON.stringify(parentData || {}));
        sessionStorage.setItem(ASN_STORAGE_KEYS.PARENT_STUDENTS, JSON.stringify(students || []));
        localStorage.setItem(ASN_STORAGE_KEYS.PARENT_STUDENTS, JSON.stringify(students || []));
        this.currentRole = ASN_ROLES.WALI_SANTRI;
        this.currentUser = parentData;
        this.linkedStudents = Array.isArray(students) ? students : [];
        this.studentsLoadFailed = false;
        this.currentState = ASN_STATES.WALI_AUTH_ACTIVE;
        this.renderAccountCenterUI();
    },

    async retryLoadStudents() {
        const token = sessionStorage.getItem(ASN_STORAGE_KEYS.PARENT_TOKEN) || localStorage.getItem(ASN_STORAGE_KEYS.PARENT_TOKEN);
        if (!token) return;
        const listContainer = document.getElementById('parent-linked-students-list');
        if (listContainer) {
            listContainer.innerHTML = `
                <div class="p-4 bg-slate-50 dark:bg-[#1c2836] rounded-2xl border border-slate-100 dark:border-[#253447] text-center space-y-1">
                    <i class="fa-solid fa-spinner fa-spin text-emerald-600 text-lg mb-1"></i>
                    <p class="text-xs font-bold text-slate-700 dark:text-slate-200">Memuat ulang data santri...</p>
                </div>
            `;
        }

        const studRes = await ASNAuthAPI.getParentStudents(token);
        if (studRes.success && Array.isArray(studRes.students)) {
            this.linkedStudents = studRes.students;
            sessionStorage.setItem(ASN_STORAGE_KEYS.PARENT_STUDENTS, JSON.stringify(studRes.students));
            localStorage.setItem(ASN_STORAGE_KEYS.PARENT_STUDENTS, JSON.stringify(studRes.students));
            this.studentsLoadFailed = false;
            this.renderLinkedStudents();
        } else {
            this.studentsLoadFailed = true;
            this.renderLinkedStudents();
            if (typeof showToast === 'function') {
                showToast('Gagal memuat santri. Silakan periksa koneksi.');
            }
        }
    },

    async logout(triggerBtn) {
        if (triggerBtn) {
            try {
                triggerBtn.disabled = true;
                triggerBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xs"></i><span class="ml-1 text-xs">Keluar...</span>';
            } catch (e) {}
        }
        try {
            document.querySelectorAll('button[onclick*="logout"]').forEach(b => {
                b.disabled = true;
                b.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xs"></i><span class="ml-1 text-xs">Keluar...</span>';
            });
        } catch (e) {}

        const token = sessionStorage.getItem(ASN_STORAGE_KEYS.PENGASUH_TOKEN) || 
                      localStorage.getItem(ASN_STORAGE_KEYS.PENGASUH_TOKEN) || 
                      sessionStorage.getItem(ASN_STORAGE_KEYS.ADMIN_TOKEN) || 
                      localStorage.getItem(ASN_STORAGE_KEYS.ADMIN_TOKEN) || 
                      sessionStorage.getItem(ASN_STORAGE_KEYS.PARENT_TOKEN) ||
                      localStorage.getItem(ASN_STORAGE_KEYS.PARENT_TOKEN);

        this.currentState = ASN_STATES.LOGGING_OUT;
        this.renderAccountCenterUI();

        // 1. Server-Side Revocation (Phase 2B): beritahu backend untuk mencabut sesi
        if (token) {
            try {
                await ASNAuthAPI.logoutSession(token);
            } catch (e) {
                console.warn('[ASNIdentity] Server logout notice failed:', e);
            }
        }

        // 2. Clear local storage & memory state
        this.clearLocalSession();

        this.currentRole = ASN_ROLES.PUBLIC;
        this.currentUser = null;
        this.linkedStudents = [];
        this.studentsLoadFailed = false;
        this.currentState = ASN_STATES.PUBLIC;
        if (typeof isAdminLoggedIn !== 'undefined') isAdminLoggedIn = false;

        this.renderAccountCenterUI();
        if (window.location.pathname.replace(/\/+$/, '') === '/admin' || window.location.pathname.replace(/\/+$/, '') === '/administrator') {
            document.body.classList.remove('is-admin-view');
            setTimeout(() => {
                if (typeof openAdminAuthModal === 'function') openAdminAuthModal();
            }, 300);
        }
        if (typeof showToast === 'function') {
            showToast('Anda telah keluar dari akun.');
        }
    },

    clearLocalSession() {
        sessionStorage.removeItem(ASN_STORAGE_KEYS.PENGASUH_TOKEN);
        localStorage.removeItem(ASN_STORAGE_KEYS.PENGASUH_TOKEN);
        sessionStorage.removeItem(ASN_STORAGE_KEYS.PENGASUH_DATA);
        localStorage.removeItem(ASN_STORAGE_KEYS.PENGASUH_DATA);
        sessionStorage.removeItem(ASN_STORAGE_KEYS.ADMIN_TOKEN);
        localStorage.removeItem(ASN_STORAGE_KEYS.ADMIN_TOKEN);
        sessionStorage.removeItem(ASN_STORAGE_KEYS.ADMIN_ROLE);
        localStorage.removeItem(ASN_STORAGE_KEYS.ADMIN_ROLE);
        sessionStorage.removeItem(ASN_STORAGE_KEYS.ADMIN_DATA);
        localStorage.removeItem(ASN_STORAGE_KEYS.ADMIN_DATA);
        sessionStorage.removeItem(ASN_STORAGE_KEYS.PARENT_TOKEN);
        localStorage.removeItem(ASN_STORAGE_KEYS.PARENT_TOKEN);
        sessionStorage.removeItem(ASN_STORAGE_KEYS.PARENT_DATA);
        localStorage.removeItem(ASN_STORAGE_KEYS.PARENT_DATA);
        sessionStorage.removeItem(ASN_STORAGE_KEYS.PARENT_STUDENTS);
        localStorage.removeItem(ASN_STORAGE_KEYS.PARENT_STUDENTS);
        sessionStorage.removeItem(ASN_STORAGE_KEYS.TEMP_ADMIN_EMAIL);
        sessionStorage.removeItem(ASN_STORAGE_KEYS.TEMP_PARENT_EMAIL);
        sessionStorage.removeItem(ASN_STORAGE_KEYS.TEMP_PARENT_PHONE);
        sessionStorage.removeItem(ASN_STORAGE_KEYS.TEMP_ACTIVATION_DATA);

        // Bersihkan token legacy jika ada
        localStorage.removeItem('user_token');
        localStorage.removeItem('user_data');
    },

    renderAccountCenterUI() {
        const hydratingEl = document.getElementById('account-state-hydrating');
        const publicStateEl = document.getElementById('account-state-public');
        const adminStateEl = document.getElementById('account-state-admin');
        const waliStateEl = document.getElementById('account-state-wali');
        const pengasuhStateEl = document.getElementById('account-state-pengasuh');

        if (!publicStateEl || !adminStateEl || !waliStateEl) return;

        // Reset visibility
        if (hydratingEl) hydratingEl.classList.add('hidden');
        publicStateEl.classList.add('hidden');
        adminStateEl.classList.add('hidden');
        waliStateEl.classList.add('hidden');
        if (pengasuhStateEl) pengasuhStateEl.classList.add('hidden');

        // Update Desktop Navigation button
        this.updateDesktopNavButton();

        if (this.currentState === ASN_STATES.HYDRATING) {
            if (hydratingEl) hydratingEl.classList.remove('hidden');
            return;
        }

        if (this.currentRole === ASN_ROLES.PENGASUH) {
            if (pengasuhStateEl) {
                pengasuhStateEl.classList.remove('hidden');
                const nameEl = document.getElementById('pengasuh-display-name');
                const emailEl = document.getElementById('pengasuh-display-email');
                if (nameEl) nameEl.innerText = (this.currentUser && (this.currentUser.titleName || this.currentUser.name)) || 'Pengasuh Pesantren';
                if (emailEl) emailEl.innerHTML = `<i class="fa-regular fa-envelope mr-1.5 text-amber-400"></i> ${escapeHtml((this.currentUser && this.currentUser.email) || '-')}`;
                this.updateAvatarUI(ASN_ROLES.PENGASUH, (this.currentUser && (this.currentUser.photoUrl || this.currentUser.photo_url)) || '');
                if (typeof applyAdminRoleVisibility === 'function') {
                    applyAdminRoleVisibility('PENGASUH');
                }
            }
        } else if (['SUPER_ADMIN', 'ADMIN', 'BENDAHARA', 'PENGURUS', 'ASATIDZ', 'PEGAWAI', 'EDITOR'].includes(this.currentRole)) {
            const isAppContext = window.location.pathname.startsWith('/app') || 
                                 window.location.pathname.endsWith('app.html') ||
                                 document.body.classList.contains('is-app-mode') ||
                                 document.body.classList.contains('is-pwa-standalone');
            if (window.innerWidth >= 1024 && !isAppContext) {
                const pagePengaturan = document.getElementById('page-pengaturan');
                if (pagePengaturan && !pagePengaturan.classList.contains('hidden')) {
                    setTimeout(() => {
                        if (typeof switchTab === 'function') switchTab('admin');
                        if (typeof showAdminView === 'function') showAdminView('hub');
                    }, 50);
                }
            }
            adminStateEl.classList.remove('hidden');
            const nameEl = document.getElementById('admin-display-name');
            const emailEl = document.getElementById('admin-display-email');
            const roleBadgeEl = document.getElementById('admin-display-role-badge');
            const currentName = (this.currentUser && this.currentUser.name) || 'Administrator';
            if (nameEl) nameEl.innerText = currentName;
            if (emailEl) emailEl.innerHTML = `<i class="fa-regular fa-envelope mr-1"></i> ${escapeHtml((this.currentUser && this.currentUser.email) || '')}`;
            
            let displayRole = 'Admin';
            if (this.currentRole === ASN_ROLES.SUPER_ADMIN) displayRole = 'Super Admin';
            else if (this.currentRole === 'BENDAHARA') displayRole = 'Bendahara';
            else if (this.currentRole === 'PENGURUS') displayRole = 'Pengurus';
            else if (this.currentRole === 'ASATIDZ' || this.currentRole === 'PEGAWAI') displayRole = 'Asatidz';
            
            if (roleBadgeEl) roleBadgeEl.innerText = displayRole;

            let initial = 'SU';
            if (currentName) {
                const words = currentName.trim().split(/\s+/);
                initial = words.length >= 2 ? (words[0][0] + words[1][0]).toUpperCase() : words[0].substring(0, 2).toUpperCase();
            }

            // Sinkronkan info identitas di desktop topbar
            const topbarNameEl = document.getElementById('admin-topbar-username');
            if (topbarNameEl) topbarNameEl.innerText = currentName;
            const topbarRoleEl = document.getElementById('admin-topbar-role');
            if (topbarRoleEl) topbarRoleEl.innerText = displayRole;
            const topbarRoleBadgeEl = document.getElementById('admin-topbar-role-badge');
            if (topbarRoleBadgeEl) topbarRoleBadgeEl.innerText = `(${displayRole.includes('Super') ? 'Super Admin' : displayRole})`;
            const topbarInitialEl = document.getElementById('admin-topbar-avatar-initial');
            if (topbarInitialEl) topbarInitialEl.innerText = initial;
            const dropdownEmailEl = document.getElementById('admin-dropdown-email');
            if (dropdownEmailEl) {
                dropdownEmailEl.innerText = (this.currentUser && (this.currentUser.email || this.currentUser.username)) || 'admin@mubarokah.ponpes.id';
            }

            this.updateAvatarUI(this.currentRole, (this.currentUser && (this.currentUser.photoUrl || this.currentUser.photo_url)) || '');

            // Terapkan penyaringan menu Pusat Kontrol & Hub sesuai wewenang peran aktif
            if (typeof applyAdminRoleVisibility === 'function') {
                applyAdminRoleVisibility(this.currentRole);
            }
        } else if (this.currentRole === ASN_ROLES.WALI_SANTRI) {
            waliStateEl.classList.remove('hidden');
            const nameEl = document.getElementById('parent-display-name');
            const emailEl = document.getElementById('parent-display-email') || document.getElementById('parent-display-phone');
            if (nameEl) nameEl.innerText = (this.currentUser && this.currentUser.name) || 'Wali Santri';
            if (emailEl) emailEl.innerHTML = `<i class="fa-regular fa-envelope mr-1.5 text-emerald-600 dark:text-emerald-400"></i> ${escapeHtml((this.currentUser && this.currentUser.email) || '-')}`;
            this.updateAvatarUI(ASN_ROLES.WALI_SANTRI, (this.currentUser && (this.currentUser.photoUrl || this.currentUser.photo_url)) || '');
            
            // Render linked students
            this.renderLinkedStudents();
        } else {
            // PUBLIC
            publicStateEl.classList.remove('hidden');
        }
    },

    updateDesktopNavButton() {
        const btn = document.getElementById('desk-nav-account-btn');
        const label = document.getElementById('desk-nav-account-label');
        const icon = document.getElementById('desk-nav-account-icon');
        if (!btn || !label) return;

        if (this.currentRole === ASN_ROLES.PENGASUH) {
            label.innerText = 'Pengasuh';
            if (icon) icon.className = 'fa-solid fa-kaaba text-xs text-amber-300';
            btn.className = 'bg-emerald-950 hover:bg-emerald-900 text-amber-200 border border-amber-500/40 px-3.5 py-2 rounded-xl font-bold text-xs shadow-sm transition-all duration-200 flex items-center space-x-1.5';
        } else if (['SUPER_ADMIN', 'ADMIN', 'BENDAHARA', 'PENGURUS', 'ASATIDZ', 'PEGAWAI', 'EDITOR'].includes(this.currentRole)) {
            let roleLabel = 'Pengelola';
            if (this.currentRole === ASN_ROLES.SUPER_ADMIN) roleLabel = 'Super Admin';
            else if (this.currentRole === 'BENDAHARA') roleLabel = 'Bendahara';
            else if (this.currentRole === 'PENGURUS') roleLabel = 'Pengurus';
            else if (this.currentRole === 'ASATIDZ' || this.currentRole === 'PEGAWAI') roleLabel = 'Asatidz';
            else if (this.currentRole === ASN_ROLES.ADMIN) roleLabel = 'Admin';
            label.innerText = roleLabel;
            if (icon) icon.className = 'fa-solid fa-shield-halved text-xs text-emerald-300';
            btn.className = 'bg-brand-800 hover:bg-brand-700 text-emerald-300 border border-emerald-500/30 px-3.5 py-2 rounded-xl font-bold text-xs shadow-sm transition-all duration-200 flex items-center space-x-1.5';
        } else if (this.currentRole === ASN_ROLES.WALI_SANTRI) {
            label.innerText = 'Wali Santri';
            if (icon) icon.className = 'fa-solid fa-people-roof text-xs text-emerald-300';
            btn.className = 'bg-emerald-800 hover:bg-emerald-700 text-white border border-emerald-500/30 px-3.5 py-2 rounded-xl font-bold text-xs shadow-sm transition-all duration-200 flex items-center space-x-1.5';
        } else {
            label.innerText = 'Masuk / Akun';
            if (icon) icon.className = 'fa-solid fa-user-lock text-xs text-emerald-200';
            btn.className = 'bg-brand-800/80 hover:bg-brand-800 text-emerald-100 hover:text-white border border-emerald-500/20 px-3.5 py-2 rounded-xl font-bold text-xs shadow-sm transition-all duration-200 flex items-center space-x-1.5';
        }
    },

    renderLinkedStudents() {
        const listContainer = document.getElementById('parent-linked-students-list');
        if (!listContainer) return;

        if (this.currentState === ASN_STATES.WALI_HYDRATING) {
            listContainer.innerHTML = `
                <div class="p-4 bg-slate-50 dark:bg-[#1c2836] rounded-2xl border border-slate-100 dark:border-[#253447] text-center space-y-1 animate-pulse">
                    <i class="fa-solid fa-spinner fa-spin text-emerald-600 text-lg mb-1"></i>
                    <p class="text-xs font-bold text-slate-700 dark:text-slate-200">Memuat data santri dari database...</p>
                </div>
            `;
            return;
        }

        if (this.studentsLoadFailed) {
            listContainer.innerHTML = `
                <div class="p-4 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-100 dark:border-rose-900/40 text-center space-y-2">
                    <i class="fa-solid fa-triangle-exclamation text-rose-600 text-lg"></i>
                    <h4 class="text-xs font-bold text-rose-800 dark:text-rose-200">Gagal Memuat Data Santri</h4>
                    <p class="text-[10px] text-rose-600 dark:text-rose-300">Terjadi kendala saat mengambil data santri terhubung.</p>
                    <button type="button" onclick="ASNIdentity.retryLoadStudents()" class="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[11px] font-bold transition">
                        Coba Muat Ulang Data Santri
                    </button>
                </div>
            `;
            return;
        }

        let students = this.linkedStudents;
        if (!Array.isArray(students) || students.length === 0) {
            try {
                const raw = sessionStorage.getItem(ASN_STORAGE_KEYS.PARENT_STUDENTS);
                if (raw) students = JSON.parse(raw);
            } catch (e) {
                students = [];
            }
        }

        if (!Array.isArray(students) || students.length === 0) {
            listContainer.innerHTML = `
                <div class="p-5 bg-slate-50 dark:bg-[#1c2836] rounded-2xl border border-slate-100 dark:border-[#253447] text-center space-y-1.5">
                    <div class="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto text-base">
                        <i class="fa-solid fa-user-graduate"></i>
                    </div>
                    <h4 class="text-xs font-bold text-slate-700 dark:text-slate-200">Belum Ada Santri Terhubung</h4>
                    <p class="text-[10px] text-slate-500 dark:text-slate-400 max-w-xs mx-auto">Silakan hubungi bagian administrasi madrasah untuk verifikasi data putra/putri Anda.</p>
                </div>
            `;
            return;
        }

        // Render Kartu Digital Santri (KTS Digital) & Kotak Indikator Tahfidz Terpisah
        listContainer.innerHTML = students.map((s, idx) => {
            let studentPhoto = s.photoUrl || s.photo_url || '';
            let thumbnailFallback = '';
            if (studentPhoto) {
                const driveMatch = studentPhoto.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || studentPhoto.match(/id=([a-zA-Z0-9_-]+)/) || studentPhoto.match(/\/d\/([a-zA-Z0-9_-]+)/);
                if (driveMatch && driveMatch[1]) {
                    studentPhoto = "https://lh3.googleusercontent.com/d/" + driveMatch[1];
                    thumbnailFallback = "https://drive.google.com/thumbnail?id=" + driveMatch[1] + "&sz=w400";
                }
            }

            const studentGender = (s.gender || s.jenis || '').toUpperCase();
            const studentNis = s.nis || s.nisn || '-';
            const studentName = s.name || s.nama || 'Santri';
            const studentProgram = s.program || 'Tahfidz Al-Qur\'an';
            const studentId = s.studentId || s.student_id || s.id || s.nis;
            const cleanId = String(studentId || idx).replace(/[^a-zA-Z0-9_-]/g, '_');
            const tahfidz = s.tahfidzSummary || {};
            const studentHalaqah = s.halaqah || tahfidz.halaqah || 'Belum Terplot';
            const studentMuhafiz = s.muhafiz || tahfidz.muhafiz || 'Menunggu Jadwal';
            const currentJuz = tahfidz.currentJuz || 1;
            const percent = tahfidz.percent || Math.round((currentJuz / 30) * 100);
            const targetPekan = tahfidz.targetPekan || 10;
            const avgNilai = tahfidz.avgNilai || (tahfidz.lastSetoran && tahfidz.lastSetoran.nilai) || 'Mumtaz';
            const lastSurah = (tahfidz.lastSetoran && tahfidz.lastSetoran.surah) ? tahfidz.lastSetoran.surah : 'Aktif Bimbingan';
            const studentQrCode = s.qrCode || s.qr_code || ('https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(studentNis || studentId));

            // Monogram Initials Fallback
            const initials = studentName.split(' ').filter(Boolean).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || 'ST';

            // Trigger client-side real-data enrichment if tahfidzSummary is not yet present
            if (!s.tahfidzSummary) {
                setTimeout(() => {
                    ASNIdentity.enrichTahfidzDataForStudent(studentId, cleanId);
                }, 100 * (idx + 1));
            }

            return `
            <div class="space-y-3 pb-2">
                <!-- 1. KOTAK KARTU SANTRI DIGITAL (KTS Digital - Proporsi ID Card Fisik Asli CR80) -->
                <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-900 via-[#064e3b] to-[#042f2e] text-white p-4 sm:p-5 border border-emerald-500/40 shadow-xl space-y-3.5 transition-all duration-300">
                    <!-- Background Ambient Watermark & Ornaments -->
                    <div class="absolute -right-6 -bottom-6 text-emerald-400/5 text-9xl pointer-events-none select-none">
                        <i class="fa-solid fa-kaaba"></i>
                    </div>
                    <div class="absolute -top-12 -left-12 w-32 h-32 bg-emerald-400/10 rounded-full blur-2xl pointer-events-none"></div>

                    <!-- Header Kartu: Logo Brand di Kiri, QR NIS Minimalis Seukuran Logo di Kanan -->
                    <div class="flex items-center justify-between relative z-10">
                        <div class="flex items-center space-x-2.5">
                            <img src="assets/img/header-logo.png" alt="PP. Roudlotul Mubarokah" class="h-7 sm:h-8 w-auto object-contain drop-shadow-sm">
                            <div class="leading-none pl-2 border-l border-emerald-400/30">
                                <span class="text-[9px] font-extrabold text-amber-300 tracking-wider block uppercase">KTS Digital</span>
                                <span class="text-[8px] text-emerald-200/80 block">Madrasah & Tahfidz</span>
                            </div>
                        </div>
                        
                        <!-- QR NIS Minimalis (Ukuran Sama dengan Logo h-7 sm:h-8) -->
                        <button type="button" 
                            onclick="openStudentQrModal('${escapeHtml(studentNis)}', '${escapeHtml(studentName)}', '${escapeHtml(studentQrCode)}')"
                            class="h-7 w-7 sm:h-8 sm:w-8 p-0.5 rounded-lg bg-white/95 hover:bg-white border border-amber-400/50 shadow-sm cursor-pointer active:scale-95 transition-all flex items-center justify-center shrink-0"
                            title="Ketuk untuk memperbesar QR Code NIS">
                            <img src="${escapeHtml(studentQrCode)}" alt="QR NIS" class="w-full h-full object-contain rounded-sm">
                        </button>
                    </div>

                    <!-- Body Kartu: Pasfoto 3x4 di Kiri & Identitas Lengkap di Kanan -->
                    <div class="flex items-center space-x-3 sm:space-x-4 relative z-10 py-1">
                        <!-- Frame Foto Santri (Format 3x4 Proporsional) -->
                        <div id="kts-photo-box-${cleanId}" class="w-20 h-28 sm:w-24 sm:h-32 rounded-2xl overflow-hidden border-2 border-amber-400/60 shadow-md bg-emerald-950 flex items-center justify-center shrink-0 relative">
                            ${studentPhoto ? `
                                <img id="kts-photo-img-${cleanId}" src="${escapeHtml(studentPhoto)}" alt="${escapeHtml(studentName)}" class="w-full h-full object-cover" 
                                    onerror="if (!this.dataset.triedThumbnail && '${escapeHtml(thumbnailFallback)}') { this.dataset.triedThumbnail='1'; this.src='${escapeHtml(thumbnailFallback)}'; } else { this.onerror=null; this.parentElement.innerHTML='<div class=\\'w-full h-full flex flex-col items-center justify-center text-amber-300/80 bg-emerald-950\\'><i class=\\'fa-solid fa-user-graduate text-2xl\\'></i><span class=\\'text-[9px] mt-1 font-bold text-amber-200\\'>${escapeHtml(initials)}</span></div>'; }">
                            ` : `
                                <div class="w-full h-full flex flex-col items-center justify-center text-amber-300/80 bg-emerald-950">
                                    <i class="fa-solid fa-user-graduate text-2xl"></i>
                                    <span class="text-[9px] mt-1 font-bold text-amber-200">${escapeHtml(initials)}</span>
                                </div>
                            `}
                        </div>

                        <!-- Identitas Detail Santri -->
                        <div class="min-w-0 flex-1 space-y-1 sm:space-y-1.5">
                            <h4 class="text-sm sm:text-base font-extrabold text-white tracking-wide leading-tight line-clamp-2">
                                ${escapeHtml(studentName)}
                            </h4>
                            <div class="flex items-center gap-1.5 flex-wrap">
                                <span class="px-2 py-0.5 rounded-md bg-white/10 text-amber-200 text-[10px] font-mono font-bold tracking-wider border border-white/10">
                                    NIS: ${escapeHtml(studentNis)}
                                </span>
                                ${studentGender ? `
                                    <span class="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md ${studentGender === 'L' ? 'bg-blue-500/25 text-blue-200 border border-blue-400/30' : 'bg-pink-500/25 text-pink-200 border border-pink-400/30'}">
                                        ${studentGender === 'L' ? 'Santri Putra' : 'Santri Putri'}
                                    </span>
                                ` : ''}
                            </div>
                            <p class="text-[11px] text-emerald-100/90 font-medium flex items-center gap-1.5 truncate pt-0.5">
                                <i class="fa-solid fa-book-bookmark text-amber-300 text-[10px] w-3 text-center"></i>
                                <span>${escapeHtml(studentProgram)}</span>
                            </p>
                            <p class="text-[10px] text-slate-200 flex items-center gap-1.5 truncate">
                                <i class="fa-solid fa-chalkboard-user text-emerald-400 text-[10px] w-3 text-center"></i>
                                <span class="text-emerald-300 font-semibold">Halaqah:</span>
                                <span id="kts-halaqah-${cleanId}" class="font-bold text-white">${escapeHtml(studentHalaqah)}</span>
                            </p>
                            <p class="text-[10px] text-slate-200 flex items-center gap-1.5 truncate">
                                <i class="fa-solid fa-user-tie text-amber-300 text-[10px] w-3 text-center"></i>
                                <span class="text-amber-300 font-semibold">Muhafiz:</span>
                                <span id="kts-muhafiz-${cleanId}" class="font-bold text-white">${escapeHtml(studentMuhafiz)}</span>
                            </p>
                        </div>
                    </div>
                </div>

                <!-- KARTU KEUANGAN & PEMBAYARAN SPP SANTRI (KHUSUS MOBILE - DI ATAS KARTU MUTABA'AH) -->
                <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-[#06382c] to-slate-900 text-white p-4 sm:p-5 border border-emerald-500/40 shadow-lg space-y-3.5 transition-all">
                    <div class="flex items-center justify-between text-xs font-bold">
                        <span class="flex items-center gap-1.5 text-emerald-300 uppercase tracking-wider text-[11px]">
                            <i class="fa-solid fa-receipt text-xs text-amber-400"></i> Keuangan & Syahriah Santri
                        </span>
                        <span class="text-amber-300 text-[10px] bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-500/30 font-extrabold flex items-center gap-1">
                            <i class="fa-solid fa-shield-halved text-[9px]"></i> Portal Mandiri
                        </span>
                    </div>

                    <div class="flex items-center justify-between bg-white/5 rounded-2xl p-3 border border-white/10 gap-3">
                        <div class="min-w-0 space-y-0.5">
                            <span class="text-[10px] text-emerald-200/80 font-medium block">Pembayaran SPP & Tagihan</span>
                            <h5 class="text-xs sm:text-sm font-black text-white truncate">Syahriah & Operasional</h5>
                            <span class="text-[9px] text-slate-300 block">QRIS, VA Bank & Transfer Manual</span>
                        </div>
                        <button type="button" onclick="openPortalWaliTagihanModal('${escapeHtml(studentId)}')"
                            class="px-3.5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-950/40 active:scale-95 transition-all flex items-center gap-1.5 shrink-0"
                            title="Bayar SPP & Tagihan Santri">
                            <i class="fa-solid fa-wallet text-[11px]"></i>
                            <span>Bayar SPP</span>
                        </button>
                    </div>

                    <div class="flex items-center justify-between text-[10px] text-slate-300 px-1 pt-0.5">
                        <span class="flex items-center gap-1">
                            <i class="fa-solid fa-circle-check text-emerald-400 text-[10px]"></i> BSI, Bank Jateng & Midtrans
                        </span>
                        <button type="button" onclick="openPortalWaliTagihanModal('${escapeHtml(studentId)}')" class="text-amber-300 hover:text-amber-200 font-bold flex items-center gap-1 hover:underline">
                            <span>Rincian & Kuitansi</span>
                            <i class="fa-solid fa-chevron-right text-[8px]"></i>
                        </button>
                    </div>
                </div>

                <!-- 2. KOTAK INDIKATOR TAHFIDZ & BUKU MUTABA'AH (Terpisah Mandiri) -->
                <div class="relative overflow-hidden rounded-3xl bg-slate-900/95 dark:bg-[#15202d] text-white p-4 sm:p-5 border border-emerald-500/30 shadow-lg space-y-3.5 transition-all">
                    <div class="flex items-center justify-between text-xs font-bold">
                        <span class="flex items-center gap-1.5 text-amber-300 uppercase tracking-wider text-[11px]">
                            <i class="fa-solid fa-star text-xs"></i> Indikator Capaian Tahfidz
                        </span>
                        <span class="text-emerald-300 text-[10px] bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-extrabold">
                            Standar 30 Juz
                        </span>
                    </div>

                    <!-- 3 Metrik Box -->
                    <div class="grid grid-cols-3 gap-2 text-center">
                        <!-- 1. Capaian Juz -->
                        <div class="p-2.5 rounded-2xl bg-white/5 border border-white/5 flex flex-col justify-center">
                            <span class="text-[9px] text-slate-400 font-medium">Capaian</span>
                            <span class="text-xs sm:text-sm font-extrabold text-amber-300 mt-0.5" id="kts-juz-${cleanId}">Juz ${currentJuz}</span>
                            <span class="text-[8px] text-emerald-400 mt-0.5 font-bold" id="kts-percent-${cleanId}">${percent}% Juz</span>
                        </div>

                        <!-- 2. Target Pekanan -->
                        <div class="p-2.5 rounded-2xl bg-white/5 border border-white/5 flex flex-col justify-center">
                            <span class="text-[9px] text-slate-400 font-medium">Target Pekan</span>
                            <span class="text-xs sm:text-sm font-extrabold text-white mt-0.5" id="kts-target-${cleanId}">${targetPekan} Hlm</span>
                            <span class="text-[8px] text-slate-400 mt-0.5">Ziyadah/Muraja'ah</span>
                        </div>

                        <!-- 3. Nilai / Setoran Terakhir -->
                        <div class="p-2.5 rounded-2xl bg-white/5 border border-white/5 flex flex-col justify-center">
                            <span class="text-[9px] text-slate-400 font-medium">Nilai Terakhir</span>
                            <span class="text-xs sm:text-sm font-extrabold text-emerald-400 mt-0.5 truncate" id="kts-nilai-${cleanId}">${escapeHtml(avgNilai)}</span>
                            <span class="text-[8px] text-slate-400 mt-0.5 truncate" id="kts-surah-${cleanId}">${escapeHtml(lastSurah)}</span>
                        </div>
                    </div>

                    <!-- Progress Bar 30 Juz -->
                    <div class="space-y-1 pt-0.5">
                        <div class="flex justify-between text-[10px] text-emerald-200/90 font-medium">
                            <span>Progres Khatam Hafalan</span>
                            <span id="kts-bar-label-${cleanId}">Juz ${currentJuz} dari 30 Juz (${percent}%)</span>
                        </div>
                        <div class="w-full h-2.5 rounded-full bg-black/40 overflow-hidden p-0.5 border border-emerald-500/20">
                            <div id="kts-bar-${cleanId}" class="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 shadow-[0_0_8px_rgba(52,211,153,0.5)] transition-all duration-700" style="width: ${Math.max(4, percent)}%;"></div>
                        </div>
                    </div>

                    <!-- Tombol Aksi Mutaba'ah Lengkap -->
                    <div class="pt-1">
                        <button type="button" data-student-id="${escapeHtml(studentId)}" onclick="openTahfidzStudentDetail(this.getAttribute('data-student-id'), 'parent')" class="w-full py-2.5 px-4 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-slate-950 rounded-2xl font-extrabold text-xs tracking-wide shadow-lg shadow-amber-900/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2" title="Buka Buku Mutaba'ah & Capaian Santri">
                            <i class="fa-solid fa-book-quran text-sm text-slate-950"></i>
                            <span>Buka Buku Mutaba'ah Lengkap</span>
                        </button>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    },

    /**
     * Client-side real data hydrator: Mengambil detail mutaba'ah tahfidz santri dari backend
     * jika sesi lokal belum memiliki tahfidzSummary, lalu memperbarui tampilan secara live.
     */
    enrichTahfidzDataForStudent(studentId, cleanId) {
        if (!studentId) return;
        const token = (typeof ASNIdentity !== 'undefined' ? (
            sessionStorage.getItem(ASN_STORAGE_KEYS.PARENT_TOKEN) ||
            localStorage.getItem(ASN_STORAGE_KEYS.PARENT_TOKEN) ||
            sessionStorage.getItem(ASN_STORAGE_KEYS.ADMIN_TOKEN)
        ) : '') || "";

        if (typeof apiPost !== 'function') return;

        apiPost("getTahfidzStudentDetail", { token, studentId }).then(res => {
            if (res && (res.success || res.status === "success")) {
                const stats = res.stats || {};
                const target = res.target || {};
                const currentJuz = stats.progressJuz || 1;
                const percent = stats.progressPercent || Math.round((currentJuz / 30) * 100);
                const targetPekan = (target.ziyadahPekan || 10) + (target.murajaahPekan || 10);
                const avgNilai = stats.rataRataNilai || "Mumtaz (A)";
                const lastLog = (res.riwayat && res.riwayat.length > 0) ? res.riwayat[0] : null;

                const elJuz = document.getElementById(`kts-juz-${cleanId}`);
                if (elJuz) elJuz.innerText = `Juz ${currentJuz}`;
                const elPercent = document.getElementById(`kts-percent-${cleanId}`);
                if (elPercent) elPercent.innerText = `${percent}% Juz`;
                const elTarget = document.getElementById(`kts-target-${cleanId}`);
                if (elTarget) elTarget.innerText = `${targetPekan} Hlm`;
                const elNilai = document.getElementById(`kts-nilai-${cleanId}`);
                if (elNilai) elNilai.innerText = avgNilai;
                const elSurah = document.getElementById(`kts-surah-${cleanId}`);
                if (elSurah) elSurah.innerText = lastLog ? (lastLog.surah || `Juz ${lastLog.juz}`) : "Aktif";
                const elBarLabel = document.getElementById(`kts-bar-label-${cleanId}`);
                if (elBarLabel) elBarLabel.innerText = `Juz ${currentJuz} dari 30 Juz (${percent}%)`;
                const elBar = document.getElementById(`kts-bar-${cleanId}`);
                if (elBar) elBar.style.width = `${Math.max(4, percent)}%`;

                // Live Hydrate Halaqah & Muhafiz
                const hName = res.halaqah || (res.student && res.student.halaqah);
                if (hName && hName !== "Belum Terplot") {
                    const elHal = document.getElementById(`kts-halaqah-${cleanId}`);
                    if (elHal) elHal.innerText = hName;
                }
                const mName = res.muhafiz || (res.student && res.student.muhafiz);
                if (mName && mName !== "Menunggu Jadwal") {
                    const elMuh = document.getElementById(`kts-muhafiz-${cleanId}`);
                    if (elMuh) elMuh.innerText = mName;
                }

                // Live Hydrate Foto Santri jika sebelumnya kosong/fallback
                if (res.student && res.student.photoUrl) {
                    const elImg = document.getElementById(`kts-photo-img-${cleanId}`);
                    const photoBox = document.getElementById(`kts-photo-box-${cleanId}`);
                    let nPhoto = res.student.photoUrl;
                    const driveMatch = nPhoto.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || nPhoto.match(/id=([a-zA-Z0-9_-]+)/) || nPhoto.match(/\/d\/([a-zA-Z0-9_-]+)/);
                    let fallbackUrl = '';
                    if (driveMatch && driveMatch[1]) {
                        nPhoto = "https://lh3.googleusercontent.com/d/" + driveMatch[1];
                        fallbackUrl = "https://drive.google.com/thumbnail?id=" + driveMatch[1] + "&sz=w400";
                    }
                    if (elImg) {
                        elImg.src = nPhoto;
                    } else if (photoBox && photoBox.querySelector(".fa-user-graduate")) {
                        photoBox.innerHTML = `<img id="kts-photo-img-${cleanId}" src="${escapeHtml(nPhoto)}" alt="Santri" class="w-full h-full object-cover" onerror="if (!this.dataset.triedThumbnail && '${escapeHtml(fallbackUrl)}') { this.dataset.triedThumbnail='1'; this.src='${escapeHtml(fallbackUrl)}'; }">`;
                    }
                }

                // Update session storage cache
                try {
                    const raw = sessionStorage.getItem(ASN_STORAGE_KEYS.PARENT_STUDENTS);
                    if (raw) {
                        const cached = JSON.parse(raw);
                        const targetSt = cached.find(c => String(c.studentId || c.id || c.nis).trim() === String(studentId).trim());
                        if (targetSt) {
                            if (hName) targetSt.halaqah = hName;
                            if (mName) targetSt.muhafiz = mName;
                            if (res.student && res.student.photoUrl) targetSt.photoUrl = res.student.photoUrl;
                            targetSt.tahfidzSummary = {
                                currentJuz,
                                percent,
                                targetPekan,
                                avgNilai,
                                halaqah: hName || targetSt.halaqah || "Belum Terplot",
                                muhafiz: mName || targetSt.muhafiz || "Menunggu Jadwal",
                                lastSetoran: lastLog ? { surah: lastLog.surah, nilai: lastLog.nilai } : null
                            };
                            sessionStorage.setItem(ASN_STORAGE_KEYS.PARENT_STUDENTS, JSON.stringify(cached));
                            localStorage.setItem(ASN_STORAGE_KEYS.PARENT_STUDENTS, JSON.stringify(cached));
                        }
                    }
                } catch (e) {}
            }
        }).catch(e => {
            console.warn("[KTS Hydration] Failed to fetch tahfidz details:", e);
        });
    },

    /**
     * Helper formatting CDN URL untuk foto profil
     */
    formatPhotoUrl(photoUrl) {
        if (!photoUrl) return '';
        const driveMatch = photoUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || photoUrl.match(/id=([a-zA-Z0-9_-]+)/) || photoUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (driveMatch && driveMatch[1]) {
            return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
        }
        return photoUrl;
    },

    /**
     * Memperbarui elemen Avatar pada UI berdasarkan peran
     */
    updateAvatarUI(role, photoUrl) {
        const normalizedRole = String(role || this.currentRole || '').toUpperCase();
        let imgId = '';
        let iconId = '';

        if (normalizedRole === ASN_ROLES.PENGASUH) {
            imgId = 'pengasuh-avatar-img';
            iconId = 'pengasuh-avatar-icon';
        } else if (['SUPER_ADMIN', 'ADMIN', 'BENDAHARA', 'PENGURUS', 'ASATIDZ', 'PEGAWAI', 'EDITOR'].includes(normalizedRole)) {
            imgId = 'admin-avatar-img';
            iconId = 'admin-avatar-icon';
        } else {
            imgId = 'parent-avatar-img';
            iconId = 'parent-avatar-icon';
        }

        const imgEl = document.getElementById(imgId);
        const iconEl = document.getElementById(iconId);
        if (!imgEl) return;

        const topbarImg = document.getElementById('admin-topbar-avatar-img');
        const topbarInitial = document.getElementById('admin-topbar-avatar-initial');

        if (photoUrl) {
            const formatted = this.formatPhotoUrl(photoUrl);
            imgEl.src = formatted;
            imgEl.classList.remove('hidden');
            if (iconEl) iconEl.classList.add('hidden');
            imgEl.onerror = () => {
                imgEl.classList.add('hidden');
                if (iconEl) iconEl.classList.remove('hidden');
            };

            if (topbarImg) {
                topbarImg.src = formatted;
                topbarImg.classList.remove('hidden');
                if (topbarInitial) topbarInitial.classList.add('hidden');
                topbarImg.onerror = () => {
                    topbarImg.classList.add('hidden');
                    if (topbarInitial) topbarInitial.classList.remove('hidden');
                };
            }
        } else {
            imgEl.src = '';
            imgEl.classList.add('hidden');
            if (iconEl) iconEl.classList.remove('hidden');

            if (topbarImg) {
                topbarImg.src = '';
                topbarImg.classList.add('hidden');
                if (topbarInitial) topbarInitial.classList.remove('hidden');
            }
        }
    },

    /**
     * Trigger file input picker untuk unggah foto profil
     */
    triggerAvatarUpload(role) {
        this._targetAvatarRole = role || this.currentRole;
        const fileInput = document.getElementById('user-avatar-file-input');
        if (fileInput) {
            fileInput.value = '';
            fileInput.click();
        }
    },

    /**
     * Handler saat file foto dipilih
     */
    async handleAvatarFileSelected(input) {
        const file = input && input.files && input.files[0];
        if (!file) return;

        const role = this._targetAvatarRole || this.currentRole;
        const targetId = (this.currentUser && (this.currentUser.identityId || this.currentUser.email)) || '';

        // Validasi tipe mime
        if (!file.type.match(/^image\/(jpeg|png|webp|gif)/i)) {
            if (typeof showToast === 'function') showToast('Format foto tidak didukung. Pilih foto JPG, PNG, atau WEBP.');
            else alert('Format foto tidak didukung. Pilih foto JPG, PNG, atau WEBP.');
            return;
        }

        if (typeof showToast === 'function') {
            showToast('Mengompresi dan mengunggah foto profil...');
        }

        try {
            const compressed = await this.compressImageFile(file, 400, 400, 0.85);
            const result = await ASNAuthAPI.uploadUserPhoto(compressed, role, targetId);

            if (result && (result.success || result.status === 'success')) {
                const photoUrl = result.url || result.fileUrl;
                if (photoUrl) {
                    // Update state memori
                    if (this.currentUser) {
                        this.currentUser.photoUrl = photoUrl;
                        this.currentUser.photo_url = photoUrl;
                    }

                    // Update storage lokal
                    if (role === ASN_ROLES.PENGASUH) {
                        sessionStorage.setItem(ASN_STORAGE_KEYS.PENGASUH_DATA, JSON.stringify(this.currentUser || {}));
                        localStorage.setItem(ASN_STORAGE_KEYS.PENGASUH_DATA, JSON.stringify(this.currentUser || {}));
                    } else if (['SUPER_ADMIN', 'ADMIN', 'BENDAHARA', 'PENGURUS', 'ASATIDZ', 'PEGAWAI', 'EDITOR'].includes(role)) {
                        sessionStorage.setItem(ASN_STORAGE_KEYS.ADMIN_DATA, JSON.stringify(this.currentUser || {}));
                        localStorage.setItem(ASN_STORAGE_KEYS.ADMIN_DATA, JSON.stringify(this.currentUser || {}));
                    } else if (role === ASN_ROLES.WALI_SANTRI) {
                        sessionStorage.setItem(ASN_STORAGE_KEYS.PARENT_DATA, JSON.stringify(this.currentUser || {}));
                        localStorage.setItem(ASN_STORAGE_KEYS.PARENT_DATA, JSON.stringify(this.currentUser || {}));
                    }

                    this.updateAvatarUI(role, photoUrl);

                    if (typeof showToast === 'function') {
                        showToast('Foto profil berhasil diperbarui!');
                    } else {
                        alert('Foto profil berhasil diperbarui!');
                    }
                }
            } else {
                const msg = (result && result.message) || 'Gagal mengunggah foto profil.';
                if (typeof showToast === 'function') showToast(msg);
                else alert(msg);
            }
        } catch (err) {
            console.error('[ASNIdentity] Error upload avatar:', err);
            if (typeof showToast === 'function') {
                showToast('Gagal mengunggah foto: ' + (err.message || err));
            } else {
                alert('Gagal mengunggah foto: ' + (err.message || err));
            }
        }
    },

    /**
     * Kompresi gambar client-side dengan canvas ke rasio persegi
     */
    compressImageFile(file, maxWidth = 400, maxHeight = 400, quality = 0.85) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
            reader.onload = (e) => {
                const img = new Image();
                img.onerror = () => reject(new Error('Format gambar tidak valid.'));
                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');

                        // Square crop dari tengah
                        const minDim = Math.min(img.width, img.height);
                        const sx = (img.width - minDim) / 2;
                        const sy = (img.height - minDim) / 2;

                        const targetSize = Math.min(maxWidth, maxHeight, minDim);
                        canvas.width = targetSize;
                        canvas.height = targetSize;

                        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, targetSize, targetSize);
                        const dataUrl = canvas.toDataURL('image/jpeg', quality);
                        const base64 = dataUrl.split(',')[1];

                        resolve({
                            base64: base64,
                            mimeType: 'image/jpeg',
                            name: file.name,
                            size: Math.round((base64.length * 3) / 4)
                        });
                    } catch (err) {
                        // Fallback ke raw read jika canvas gagal
                        const rawBase64 = e.target.result.split(',')[1];
                        resolve({
                            base64: rawBase64,
                            mimeType: file.type || 'image/jpeg',
                            name: file.name,
                            size: file.size
                        });
                    }
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }
};

// =====================================================================
// QR CODE MODAL PREVIEW CONTROLLER
// =====================================================================
function openStudentQrModal(nis, name, qrUrl) {
    const modal = document.getElementById('modal-student-qr-preview');
    if (!modal) return;
    const nameEl = document.getElementById('qr-modal-student-name');
    const nisEl = document.getElementById('qr-modal-student-nis');
    const imgEl = document.getElementById('qr-modal-image');

    if (nameEl) nameEl.innerText = name || 'Santri';
    if (nisEl) nisEl.innerText = 'NIS: ' + (nis || '-');
    if (imgEl) {
        const finalUrl = qrUrl || ('https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=' + encodeURIComponent(nis || 'ASN'));
        imgEl.src = finalUrl;
    }

    modal.classList.remove('hidden');
    setTimeout(() => {
        const content = document.getElementById('modal-student-qr-content');
        if (content) content.classList.remove('scale-95', 'opacity-0');
    }, 30);
}

function closeStudentQrModal() {
    const modal = document.getElementById('modal-student-qr-preview');
    const content = document.getElementById('modal-student-qr-content');
    if (!modal) return;
    if (content) content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 200);
}

// =====================================================================
// PHASE 2A: AUTHENTICATION UI CONTROLLERS
// =====================================================================

// ----- Helper: Toggle Password Visibility -----
function togglePasswordVisibility(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        if (icon) {
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        }
    } else {
        input.type = 'password';
        if (icon) {
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }
}

// ----- Admin Modal Controllers (Asnawiyyah Passwordless OTP) -----
function toggleAdminAuthMode(mode) {
    if (mode === 'verify') {
        switchToAdminVerifyStep();
    } else {
        resetAdminAuthStep();
    }
}

function openAdminAuthModal() {
    if (typeof checkIsAdminLoggedIn === 'function' && checkIsAdminLoggedIn()) {
        return;
    }
    if (typeof isAdminLoggedIn !== 'undefined' && isAdminLoggedIn) {
        return;
    }

    const modal = document.getElementById('modal-auth-admin');
    const content = document.getElementById('modal-auth-admin-content');
    if (!modal || !content) return;

    resetAdminAuthStep();
    if (typeof switchAdminAuthTab === 'function') switchAdminAuthTab('google');
    modal.classList.remove('hidden');
    setTimeout(() => {
        content.classList.remove('scale-95', 'opacity-0');
        const emailInput = document.getElementById('admin-auth-email');
        if (emailInput) emailInput.focus();
        if (typeof initGoogleAuth === 'function') initGoogleAuth();
    }, 50);
}

function closeAdminAuthModal() {
    const modal = document.getElementById('modal-auth-admin');
    const content = document.getElementById('modal-auth-admin-content');
    if (!modal || !content) return;

    if (adminOtpCooldownTimer) {
        clearInterval(adminOtpCooldownTimer);
        adminOtpCooldownTimer = null;
    }

    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
        const activeTabEl = document.querySelector('.tab-content:not(.hidden)');
        const isStillAdmin = (typeof checkIsAdminLoggedIn === 'function') ? checkIsAdminLoggedIn() : (typeof isAdminLoggedIn !== 'undefined' && isAdminLoggedIn);
        if (activeTabEl && activeTabEl.id === 'page-admin' && !isStillAdmin) {
            if (typeof switchTab === 'function') switchTab('beranda');
        }
    }, 250);
}

function resetAdminAuthStep() {
    if (adminOtpCooldownTimer) {
        clearInterval(adminOtpCooldownTimer);
        adminOtpCooldownTimer = null;
    }
    adminOtpCooldownSeconds = 0;
    const cooldownEl = document.getElementById('admin-otp-cooldown');
    if (cooldownEl) {
        cooldownEl.className = 'text-slate-400';
        cooldownEl.innerHTML = 'Kirim ulang dalam 60s';
    }

    const formReq = document.getElementById('form-admin-request-otp');
    const formVer = document.getElementById('form-admin-verify-otp');
    const alertBox = document.getElementById('admin-auth-alert');

    if (formReq) formReq.classList.remove('hidden');
    if (formVer) formVer.classList.add('hidden');
    if (alertBox) alertBox.classList.add('hidden');

    const otpInput = document.getElementById('admin-auth-otp');
    if (otpInput) otpInput.value = '';
}

// Admin OTP Cooldown & Resend Controller
let adminOtpCooldownTimer = null;
let adminOtpCooldownSeconds = 0;

function startAdminOtpCooldown(seconds = 60) {
    if (adminOtpCooldownTimer) {
        clearInterval(adminOtpCooldownTimer);
        adminOtpCooldownTimer = null;
    }
    adminOtpCooldownSeconds = seconds;
    renderAdminOtpCooldown();

    adminOtpCooldownTimer = setInterval(() => {
        adminOtpCooldownSeconds--;
        if (adminOtpCooldownSeconds <= 0) {
            clearInterval(adminOtpCooldownTimer);
            adminOtpCooldownTimer = null;
            renderAdminOtpCooldown();
        } else {
            renderAdminOtpCooldown();
        }
    }, 1000);
}

function renderAdminOtpCooldown() {
    const el = document.getElementById('admin-otp-cooldown');
    if (!el) return;
    if (adminOtpCooldownSeconds > 0) {
        el.className = 'text-slate-400';
        el.innerHTML = `Kirim ulang dalam ${adminOtpCooldownSeconds}s`;
    } else {
        el.className = 'text-brand-700 dark:text-emerald-400 font-semibold';
        el.innerHTML = `<button type="button" onclick="handleAdminResendOtp()" class="hover:underline">Kirim ulang OTP</button>`;
    }
}

async function handleAdminResendOtp() {
    const email = sessionStorage.getItem(ASN_STORAGE_KEYS.TEMP_ADMIN_EMAIL);
    if (!email) {
        resetAdminAuthStep();
        return;
    }

    const el = document.getElementById('admin-otp-cooldown');
    if (el) {
        el.className = 'text-slate-400';
        el.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i>Mengirim...`;
    }

    const alertBox = document.getElementById('admin-auth-alert');
    const alertText = document.getElementById('admin-auth-alert-text');
    if (alertBox) alertBox.classList.add('hidden');

    try {
        const result = await ASNAuthAPI.requestAdminOtp(email);
        if (result.success) {
            if (typeof showToast === 'function') {
                showToast('Kode OTP baru telah dikirimkan.');
            }
            startAdminOtpCooldown(result.cooldownSeconds || 60);
        } else {
            if (alertBox && alertText) {
                alertText.innerText = result.message || 'Gagal mengirim ulang OTP.';
                alertBox.classList.remove('hidden');
            }
            adminOtpCooldownSeconds = 0;
            renderAdminOtpCooldown();
        }
    } catch (err) {
        if (alertBox && alertText) {
            alertText.innerText = 'Terjadi kesalahan sistem saat meminta kirim ulang OTP.';
            alertBox.classList.remove('hidden');
        }
        adminOtpCooldownSeconds = 0;
        renderAdminOtpCooldown();
    }
}

async function handleAdminRequestOtp(e) {
    e.preventDefault();
    const emailInput = document.getElementById('admin-auth-email');
    const btn = document.getElementById('btn-admin-request-otp');
    const alertBox = document.getElementById('admin-auth-alert');
    const alertText = document.getElementById('admin-auth-alert-text');

    if (!emailInput || !btn) return;
    const email = emailInput.value.trim();
    if (!email) return;

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>Memproses...</span>`;
    if (alertBox) alertBox.classList.add('hidden');

    try {
        const result = await ASNAuthAPI.requestAdminOtp(email);
        if (result.success) {
            // Pindah ke step 2
            document.getElementById('form-admin-request-otp').classList.add('hidden');
            document.getElementById('form-admin-verify-otp').classList.remove('hidden');
            document.getElementById('admin-auth-target-email').innerText = email;
            sessionStorage.setItem(ASN_STORAGE_KEYS.TEMP_ADMIN_EMAIL, email);

            startAdminOtpCooldown(result.cooldownSeconds || 60);

            const otpInput = document.getElementById('admin-auth-otp');
            if (otpInput) {
                otpInput.value = '';
                setTimeout(() => otpInput.focus(), 150);
            }
        } else {
            // Tampilkan error secara aman (fail safely)
            if (alertBox && alertText) {
                alertText.innerText = result.message || 'Gagal meminta OTP.';
                alertBox.classList.remove('hidden');
            }
        }
    } catch (err) {
        if (alertBox && alertText) {
            alertText.innerText = 'Terjadi kesalahan sistem saat meminta OTP.';
            alertBox.classList.remove('hidden');
        }
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<span>Kirim Kode OTP</span><i class="fa-solid fa-arrow-right"></i>`;
    }
}

async function handleAdminVerifyOtp(e) {
    e.preventDefault();
    const email = sessionStorage.getItem(ASN_STORAGE_KEYS.TEMP_ADMIN_EMAIL);
    const otpInput = document.getElementById('admin-auth-otp');
    const btn = document.getElementById('btn-admin-verify-otp');
    const alertBox = document.getElementById('admin-auth-alert');
    const alertText = document.getElementById('admin-auth-alert-text');

    if (!otpInput || !btn) return;
    const otp = otpInput.value.trim();

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>Memverifikasi...</span>`;
    if (alertBox) alertBox.classList.add('hidden');

    try {
        const result = await ASNAuthAPI.verifyAdminOtp(email, otp);
        if (result.success && result.token) {
            const adminData = result.admin || { email: email, name: 'Administrator' };
            if (!adminData.email) adminData.email = email;
            try {
                localStorage.setItem('mubarokah_admin_email', email);
                sessionStorage.setItem('mubarokah_admin_email', email);
            } catch (e) {}
            ASNIdentity.setAdminSession(result.token, adminData);
            if (typeof startUserPresenceHeartbeat === 'function') {
                startUserPresenceHeartbeat();
            }
            closeAdminAuthModal();
            if (typeof showToast === 'function') {
                showToast('Login Admin Berhasil!');
            }
            if (window.innerWidth >= 1024) {
                if (typeof switchTab === 'function') switchTab('admin');
                if (typeof showAdminView === 'function') showAdminView('hub');
            }
        } else {
            // Fail safely: tampilkan error, jangan login, jangan bypass!
            if (alertBox && alertText) {
                alertText.innerText = result.message || 'Kode OTP tidak valid atau layanan server belum siap.';
                alertBox.classList.remove('hidden');
            }
        }
    } catch (err) {
        if (alertBox && alertText) {
            alertText.innerText = 'Verifikasi OTP gagal.';
            alertBox.classList.remove('hidden');
        }
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<span>Verifikasi & Masuk</span><i class="fa-solid fa-check"></i>`;
    }
}

/**
 * Pindah langsung ke form input OTP 6-digit Admin (Fallback jika OTP sudah masuk ke Gmail)
 */
function switchToAdminVerifyStep() {
    const emailInput = document.getElementById('admin-auth-email');
    const email = (emailInput && emailInput.value.trim().toLowerCase()) || sessionStorage.getItem(ASN_STORAGE_KEYS.TEMP_ADMIN_EMAIL) || '';
    
    document.getElementById('form-admin-request-otp').classList.add('hidden');
    document.getElementById('form-admin-verify-otp').classList.remove('hidden');
    
    if (email) {
        document.getElementById('admin-auth-target-email').innerText = email;
        sessionStorage.setItem(ASN_STORAGE_KEYS.TEMP_ADMIN_EMAIL, email);
    } else {
        document.getElementById('admin-auth-target-email').innerText = 'Email Terdaftar';
    }
    
    const alertBox = document.getElementById('admin-auth-alert');
    if (alertBox) alertBox.classList.add('hidden');
    
    startAdminOtpCooldown(60);
    const otpInput = document.getElementById('admin-auth-otp');
    if (otpInput) {
        otpInput.value = '';
        setTimeout(() => otpInput.focus(), 150);
    }
}

// ----- Parent / Wali Santri Modal Controllers -----
// ----- Parent / Wali Santri Modal Controllers (Asnawiyyah Passwordless OTP) -----
function toggleParentAuthMode(mode) {
    if (mode === 'verify') {
        switchToParentVerifyStep();
    } else {
        resetParentAuthStep();
    }
}

function openParentAuthModal() {
    const modal = document.getElementById('modal-auth-parent');
    const content = document.getElementById('modal-auth-parent-content');
    if (!modal || !content) return;

    resetParentAuthStep();
    if (typeof switchParentAuthTab === 'function') switchParentAuthTab('nis');
    modal.classList.remove('hidden');
    setTimeout(() => {
        content.classList.remove('scale-95', 'opacity-0');
        const nisInput = document.getElementById('parent-login-nis');
        if (nisInput) nisInput.focus();
        if (typeof initGoogleAuth === 'function') initGoogleAuth();
    }, 50);
}

function closeParentAuthModal() {
    const modal = document.getElementById('modal-auth-parent');
    const content = document.getElementById('modal-auth-parent-content');
    if (!modal || !content) return;

    if (parentOtpCooldownTimer) {
        clearInterval(parentOtpCooldownTimer);
        parentOtpCooldownTimer = null;
    }

    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 250);
}

function resetParentAuthStep() {
    if (parentOtpCooldownTimer) {
        clearInterval(parentOtpCooldownTimer);
        parentOtpCooldownTimer = null;
    }
    parentOtpCooldownSeconds = 0;
    const cooldownEl = document.getElementById('parent-otp-cooldown');
    if (cooldownEl) {
        cooldownEl.className = 'text-slate-400';
        cooldownEl.innerHTML = 'Kirim ulang dalam 60s';
    }

    const formReq = document.getElementById('form-parent-request-otp');
    const formVer = document.getElementById('form-parent-verify-otp');
    const alertBox = document.getElementById('parent-auth-alert');

    if (formReq) formReq.classList.remove('hidden');
    if (formVer) formVer.classList.add('hidden');
    if (alertBox) alertBox.classList.add('hidden');

    const otpInput = document.getElementById('parent-otp-code');
    if (otpInput) otpInput.value = '';
}

// Wali Santri OTP Cooldown & Resend Controller
let parentOtpCooldownTimer = null;
let parentOtpCooldownSeconds = 0;

function startParentOtpCooldown(seconds = 60) {
    if (parentOtpCooldownTimer) {
        clearInterval(parentOtpCooldownTimer);
        parentOtpCooldownTimer = null;
    }
    parentOtpCooldownSeconds = seconds;
    renderParentOtpCooldown();

    parentOtpCooldownTimer = setInterval(() => {
        parentOtpCooldownSeconds--;
        if (parentOtpCooldownSeconds <= 0) {
            clearInterval(parentOtpCooldownTimer);
            parentOtpCooldownTimer = null;
            renderParentOtpCooldown();
        } else {
            renderParentOtpCooldown();
        }
    }, 1000);
}

function renderParentOtpCooldown() {
    const el = document.getElementById('parent-otp-cooldown');
    if (!el) return;
    if (parentOtpCooldownSeconds > 0) {
        el.className = 'text-slate-400';
        el.innerHTML = `Kirim ulang dalam ${parentOtpCooldownSeconds}s`;
    } else {
        el.className = 'text-emerald-600 dark:text-emerald-400 font-semibold';
        el.innerHTML = `<button type="button" onclick="handleParentResendOtp()" class="hover:underline">Kirim ulang OTP</button>`;
    }
}

async function handleParentResendOtp() {
    const email = sessionStorage.getItem(ASN_STORAGE_KEYS.TEMP_PARENT_EMAIL);
    if (!email) {
        resetParentAuthStep();
        return;
    }

    const el = document.getElementById('parent-otp-cooldown');
    if (el) {
        el.className = 'text-slate-400';
        el.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i>Mengirim...`;
    }

    const alertBox = document.getElementById('parent-auth-alert');
    const alertText = document.getElementById('parent-auth-alert-text');
    if (alertBox) alertBox.classList.add('hidden');

    try {
        const result = await ASNAuthAPI.requestParentOtp(email);
        if (result.success) {
            if (typeof showToast === 'function') {
                showToast('Kode OTP baru telah dikirimkan ke email.');
            }
            startParentOtpCooldown(result.cooldownSeconds || 60);
        } else {
            if (alertBox && alertText) {
                alertText.innerText = result.message || 'Gagal mengirim ulang OTP.';
                alertBox.classList.remove('hidden');
            }
            parentOtpCooldownSeconds = 0;
            renderParentOtpCooldown();
        }
    } catch (err) {
        if (alertBox && alertText) {
            alertText.innerText = 'Terjadi kesalahan sistem saat meminta kirim ulang OTP.';
            alertBox.classList.remove('hidden');
        }
        parentOtpCooldownSeconds = 0;
        renderParentOtpCooldown();
    }
}

async function handleParentRequestOtp(e) {
    e.preventDefault();
    const emailInput = document.getElementById('parent-auth-email') || document.getElementById('parent-auth-phone');
    const btn = document.getElementById('btn-parent-request-otp');
    const alertBox = document.getElementById('parent-auth-alert');
    const alertText = document.getElementById('parent-auth-alert-text');

    if (!emailInput || !btn) return;
    const email = emailInput.value.trim().toLowerCase();
    if (!email) return;

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>Memproses...</span>`;
    if (alertBox) alertBox.classList.add('hidden');

    try {
        const result = await ASNAuthAPI.requestParentOtp(email);
        if (result.success) {
            document.getElementById('form-parent-request-otp').classList.add('hidden');
            document.getElementById('form-parent-verify-otp').classList.remove('hidden');
            const targetEl = document.getElementById('parent-auth-target-email') || document.getElementById('parent-auth-target-phone');
            if (targetEl) targetEl.innerText = email;
            sessionStorage.setItem(ASN_STORAGE_KEYS.TEMP_PARENT_EMAIL, email);

            startParentOtpCooldown(result.cooldownSeconds || 60);

            const otpInput = document.getElementById('parent-otp-code');
            if (otpInput) {
                otpInput.value = '';
                setTimeout(() => otpInput.focus(), 150);
            }
        } else {
            // Fail safely: tampilkan error, jangan login, jangan bypass!
            if (alertBox && alertText) {
                alertText.innerText = result.message || 'Gagal meminta OTP.';
                alertBox.classList.remove('hidden');
            }
        }
    } catch (err) {
        if (alertBox && alertText) {
            alertText.innerText = 'Terjadi kesalahan sistem saat meminta OTP.';
            alertBox.classList.remove('hidden');
        }
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<span>Kirim Kode OTP ke Email</span><i class="fa-solid fa-paper-plane"></i>`;
    }
}

async function handleParentVerifyOtp(e) {
    e.preventDefault();
    const email = sessionStorage.getItem(ASN_STORAGE_KEYS.TEMP_PARENT_EMAIL) || sessionStorage.getItem(ASN_STORAGE_KEYS.TEMP_PARENT_PHONE);
    const otpInput = document.getElementById('parent-otp-code');
    const btn = document.getElementById('btn-parent-verify-otp');
    const alertBox = document.getElementById('parent-auth-alert');
    const alertText = document.getElementById('parent-auth-alert-text');

    if (!otpInput || !btn) return;
    const otp = otpInput.value.trim();

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>Memverifikasi...</span>`;
    if (alertBox) alertBox.classList.add('hidden');

    try {
        const result = await ASNAuthAPI.verifyParentOtp(email, otp);
        if (result.success && result.token) {
            ASNIdentity.setParentSession(result.token, result.parent, result.students);
            closeParentAuthModal();
            if (typeof showToast === 'function') {
                showToast('Login Wali Santri Berhasil!');
            }
        } else {
            // Fail safely: tampilkan error, jangan login, jangan bypass!
            if (alertBox && alertText) {
                alertText.innerText = result.message || 'Kode OTP tidak valid atau layanan server belum siap.';
                alertBox.classList.remove('hidden');
            }
        }
    } catch (err) {
        if (alertBox && alertText) {
            alertText.innerText = 'Verifikasi OTP gagal.';
            alertBox.classList.remove('hidden');
        }
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<span>Verifikasi & Masuk Dashboard Wali</span><i class="fa-solid fa-check"></i>`;
    }
}

/**
 * Pindah langsung ke form input OTP 6-digit Wali Santri (Fallback jika OTP sudah masuk ke Gmail)
 */
function switchToParentVerifyStep() {
    const emailInput = document.getElementById('parent-auth-email') || document.getElementById('parent-auth-phone');
    const email = (emailInput && emailInput.value.trim().toLowerCase()) || sessionStorage.getItem(ASN_STORAGE_KEYS.TEMP_PARENT_EMAIL) || '';
    
    document.getElementById('form-parent-request-otp').classList.add('hidden');
    document.getElementById('form-parent-verify-otp').classList.remove('hidden');
    
    if (email) {
        const targetEl = document.getElementById('parent-auth-target-email') || document.getElementById('parent-auth-target-phone');
        if (targetEl) targetEl.innerText = email;
        sessionStorage.setItem(ASN_STORAGE_KEYS.TEMP_PARENT_EMAIL, email);
    }
    
    const alertBox = document.getElementById('parent-auth-alert');
    if (alertBox) alertBox.classList.add('hidden');
    
    startParentOtpCooldown(60);
    const otpInput = document.getElementById('parent-otp-code');
    if (otpInput) {
        otpInput.value = '';
        setTimeout(() => otpInput.focus(), 150);
    }
}

// ----- Wali Santri Activation Controllers -----
function openParentActivationModal(prefillEmail = "", prefillName = "") {
    const modal = document.getElementById('modal-parent-activation');
    const content = document.getElementById('modal-parent-activation-content');
    if (!modal || !content) return;

    resetParentActivationStep();
    if (prefillEmail) {
        const emailInput = document.getElementById('activation-wali-email');
        if (emailInput) emailInput.value = prefillEmail;
    }
    if (prefillName) {
        const nameInput = document.getElementById('activation-wali-name');
        if (nameInput) nameInput.value = prefillName;
    }

    modal.classList.remove('hidden');
    setTimeout(() => {
        content.classList.remove('scale-95', 'opacity-0');
        const nisInput = document.getElementById('activation-nis') || document.getElementById('activation-nisn');
        if (nisInput) nisInput.focus();
    }, 50);
}

function closeParentActivationModal() {
    const modal = document.getElementById('modal-parent-activation');
    const content = document.getElementById('modal-parent-activation-content');
    if (!modal || !content) return;

    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 250);
}

function resetParentActivationStep() {
    const step1 = document.getElementById('form-activation-step1');
    const step2 = document.getElementById('form-activation-step2');
    const alertBox = document.getElementById('activation-alert');

    if (step1) step1.classList.remove('hidden');
    if (step2) step2.classList.add('hidden');
    if (alertBox) alertBox.classList.add('hidden');

    const otpInput = document.getElementById('activation-otp-code');
    if (otpInput) otpInput.value = '';
}

async function handleParentActivationRequest(e) {
    e.preventDefault();
    const nis = (document.getElementById('activation-nis')?.value || document.getElementById('activation-nisn')?.value || '').trim();
    const birthDate = (document.getElementById('activation-birth-date')?.value || '').trim();
    const waliName = (document.getElementById('activation-wali-name')?.value || '').trim();
    const waliEmail = (document.getElementById('activation-wali-email')?.value || '').trim().toLowerCase();
    const waliPhone = (document.getElementById('activation-wali-phone')?.value || '').trim();
    const relationship = (document.getElementById('activation-relationship')?.value || 'GUARDIAN').trim();

    const btn = document.getElementById('btn-activation-step1');
    const alertBox = document.getElementById('activation-alert');
    const alertText = document.getElementById('activation-alert-text');

    if (!nis || !waliEmail) {
        if (alertBox && alertText) {
            alertText.innerText = 'NIS Santri dan Email Wali wajib diisi.';
            alertBox.classList.remove('hidden');
        }
        return;
    }

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>Mencocokkan Data Santri...</span>`;
    if (alertBox) alertBox.classList.add('hidden');

    const payload = {
        nis,
        nisn: nis, // alias backward compatible
        birthDate: birthDate || '',
        waliName,
        waliEmail,
        waliPhone,
        relationship
    };

    try {
        const result = await ASNAuthAPI.activateParent(payload);
        if (result && result.success) {
            sessionStorage.setItem(ASN_STORAGE_KEYS.TEMP_ACTIVATION_DATA, JSON.stringify(payload));
            document.getElementById('form-activation-step1').classList.add('hidden');
            document.getElementById('form-activation-step2').classList.remove('hidden');

            const targetEmail = document.getElementById('activation-target-email');
            if (targetEmail) targetEmail.innerText = waliEmail;

            const targetStudent = document.getElementById('activation-target-student');
            if (targetStudent) targetStudent.innerText = result.studentName || 'Santri Ditemukan';

            const otpInput = document.getElementById('activation-otp-code');
            if (otpInput) {
                otpInput.value = '';
                setTimeout(() => otpInput.focus(), 150);
            }
        } else {
            if (alertBox && alertText) {
                alertText.innerText = (result && result.message) || 'Data santri tidak cocok.';
                alertBox.classList.remove('hidden');
            }
        }
    } catch (err) {
        if (alertBox && alertText) {
            alertText.innerText = 'Terjadi kesalahan sistem saat meminta kode verifikasi.';
            alertBox.classList.remove('hidden');
        }
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<span>Lanjut Verifikasi OTP</span><i class="fa-solid fa-arrow-right"></i>`;
    }
}

async function handleParentActivationVerify(e) {
    e.preventDefault();
    const otp = (document.getElementById('activation-otp-code')?.value || '').trim();
    const newPassword = (document.getElementById('activation-new-password')?.value || '').trim();
    const btn = document.getElementById('btn-activation-step2');
    const alertBox = document.getElementById('activation-alert');
    const alertText = document.getElementById('activation-alert-text');

    let payload = {};
    try {
        const raw = sessionStorage.getItem(ASN_STORAGE_KEYS.TEMP_ACTIVATION_DATA);
        if (raw) payload = JSON.parse(raw);
    } catch (e) {}

    const hasNis = payload.nis || payload.nisn;
    if (!hasNis || !payload.waliEmail) {
        if (alertBox && alertText) {
            alertText.innerText = 'Sesi aktivasi kedaluwarsa. Silakan isi ulang data formulir.';
            alertBox.classList.remove('hidden');
        }
        return;
    }

    payload.otp = otp;
    if (newPassword) {
        payload.password = newPassword;
    }
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>Mengaktifkan Akun...</span>`;
    if (alertBox) alertBox.classList.add('hidden');

    try {
        const result = await ASNAuthAPI.verifyParentActivation(payload);
        if (result && result.success && result.token) {
            sessionStorage.removeItem(ASN_STORAGE_KEYS.TEMP_ACTIVATION_DATA);
            ASNIdentity.setParentSession(result.token, result.parent || result.identity, result.students);
            closeParentActivationModal();
            if (typeof showToast === 'function') {
                showToast(result.message || 'Akun Wali Santri berhasil diaktifkan!');
            }
        } else {
            if (alertBox && alertText) {
                alertText.innerText = (result && result.message) || 'Kode OTP aktivasi salah atau kedaluwarsa.';
                alertBox.classList.remove('hidden');
            }
        }
    } catch (err) {
        if (alertBox && alertText) {
            alertText.innerText = 'Verifikasi aktivasi gagal.';
            alertBox.classList.remove('hidden');
        }
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<span>Selesaikan Aktivasi</span><i class="fa-solid fa-circle-check"></i>`;
    }
}

// ----- Pengasuh Modal Controllers -----
function openPengasuhAuthModal() {
    const modal = document.getElementById('modal-auth-pengasuh');
    const content = document.getElementById('modal-auth-pengasuh-content');
    if (!modal || !content) return;

    const alertBox = document.getElementById('pengasuh-auth-alert');
    if (alertBox) alertBox.classList.add('hidden');

    modal.classList.remove('hidden');
    setTimeout(() => {
        content.classList.remove('scale-95', 'opacity-0');
        if (typeof initGoogleAuth === 'function') initGoogleAuth();
    }, 50);
}

function closePengasuhAuthModal() {
    const modal = document.getElementById('modal-auth-pengasuh');
    const content = document.getElementById('modal-auth-pengasuh-content');
    if (!modal || !content) return;

    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 250);
}

function togglePintuAksesResmi() {
    const dropdown = document.getElementById('dropdown-pintu-akses');
    const icon = document.getElementById('icon-pintu-akses');
    const btn = document.getElementById('btn-pintu-akses');
    if (!dropdown) return;

    const isHidden = dropdown.classList.contains('hidden');
    if (isHidden) {
        dropdown.classList.remove('hidden');
        if (icon) icon.classList.add('rotate-180');
        if (btn) btn.setAttribute('aria-expanded', 'true');
    } else {
        dropdown.classList.add('hidden');
        if (icon) icon.classList.remove('rotate-180');
        if (btn) btn.setAttribute('aria-expanded', 'false');
    }
}

function openAdminModuleFromControlCenter(viewName) {
    if (typeof isModuleAllowedForRole === 'function' && !isModuleAllowedForRole(viewName)) {
        if (typeof showToast === 'function') {
            showToast('Akses ditutup: Anda tidak memiliki izin untuk membuka modul ini.');
        } else {
            alert('Akses ditutup: Anda tidak memiliki izin untuk membuka modul ini.');
        }
        return;
    }
    if (typeof switchTab === 'function') {
        switchTab('admin', false);
    }
    if (typeof showAdminView === 'function') {
        showAdminView(viewName);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleLegacyAuthPanel() {
    const panel = document.getElementById('legacy-auth-panel');
    const chevron = document.getElementById('legacy-auth-chevron');
    if (!panel) return;

    const isHidden = panel.classList.contains('hidden');
    if (isHidden) {
        panel.classList.remove('hidden');
        if (chevron) chevron.classList.add('rotate-180');
    } else {
        panel.classList.add('hidden');
        if (chevron) chevron.classList.remove('rotate-180');
    }
}


// =====================================================================
// LEGACY AUTHENTICATION COMPATIBILITY LAYER
// (Dipertahankan untuk kompatibilitas backward selama migrasi)
// =====================================================================
const AUTH_API_URL = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.authentication && APP_CONFIG.authentication.authApiUrl && APP_CONFIG.authentication.authApiUrl !== '__MUBAROKAH_CONFIG_PENDING__')
    ? APP_CONFIG.authentication.authApiUrl
    : (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.infrastructure && (APP_CONFIG.infrastructure.apiBaseUrl || APP_CONFIG.infrastructure.appsScriptWebAppUrl) && (APP_CONFIG.infrastructure.apiBaseUrl || APP_CONFIG.infrastructure.appsScriptWebAppUrl) !== '__MUBAROKAH_CONFIG_PENDING__')
    ? (APP_CONFIG.infrastructure.apiBaseUrl || APP_CONFIG.infrastructure.appsScriptWebAppUrl)
    : ""; // __MUBAROKAH_CONFIG_PENDING__
const GOOGLE_CLIENT_ID = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.authentication && APP_CONFIG.authentication.googleClientId && APP_CONFIG.authentication.googleClientId !== '__MUBAROKAH_CONFIG_PENDING__')
    ? APP_CONFIG.authentication.googleClientId
    : "967127815898-6padn433letamnjfuacb5eg8pnv728p4.apps.googleusercontent.com"; 

document.addEventListener('DOMContentLoaded', () => {
    // Inisialisasi Identity Architecture baru
    ASNIdentity.init();

    // Kompatibilitas Legacy
    checkAuthState();
    initGoogleAuth();
});

function checkAuthState() {
    // Sesi baru diutamakan
    ASNIdentity.resolveIdentity();
    ASNIdentity.renderAccountCenterUI();

    const token = localStorage.getItem('user_token');
    const userDataStr = localStorage.getItem('user_data');
    
    const legacyLoggedInView = document.getElementById('profile-logged-in');
    const legacyLoggedOutView = document.getElementById('profile-logged-out');
    
    if (legacyLoggedInView && legacyLoggedOutView) {
        if (token && userDataStr) {
            legacyLoggedInView.classList.remove('hidden');
            legacyLoggedOutView.classList.add('hidden');
        } else {
            legacyLoggedInView.classList.add('hidden');
            legacyLoggedOutView.classList.remove('hidden');
        }
    }
}

function handleLogout() {
    ASNIdentity.logout();
}

async function handleEmailAuth(e) {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const btn = document.getElementById('btn-auth-email');
    const errorMsg = document.getElementById('login-error-msg');
    
    if (!email || !password) return;
    
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Memproses...`;
    btn.disabled = true;
    if (errorMsg) errorMsg.classList.add('hidden');
    
    try {
        const response = await fetch(AUTH_API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'login', email: email, password: password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            localStorage.setItem('user_token', data.token);
            localStorage.setItem('user_data', JSON.stringify(data.user));
            checkAuthState();
            if (typeof showToast === 'function') showToast('Login berhasil!');
        } else {
            if (data.message && (data.message.includes('belum terdaftar') || data.message.includes('not found'))) {
                const otpResp = await fetch(AUTH_API_URL, {
                    method: 'POST',
                    body: JSON.stringify({ action: 'request_otp', email: email })
                });
                const otpData = await otpResp.json();
                
                if (otpData.success) {
                    const targetEl = document.getElementById('otp-target-email');
                    if (targetEl) targetEl.innerText = email;
                    
                    sessionStorage.setItem('temp_reg_email', email);
                    sessionStorage.setItem('temp_reg_password', password);
                    
                    const modal = document.getElementById('otpModal');
                    if (modal) {
                        modal.classList.remove('hidden');
                        setTimeout(() => {
                            const content = document.getElementById('otpModalContent');
                            if (content) content.classList.remove('scale-95', 'opacity-0');
                        }, 50);
                    }
                } else {
                    throw new Error(otpData.message || "Gagal mengirim OTP");
                }
            } else {
                throw new Error(data.message || "Login gagal");
            }
        }
    } catch (error) {
        if (errorMsg) {
            errorMsg.innerText = error.message;
            errorMsg.classList.remove('hidden');
        }
    } finally {
        btn.innerHTML = `Masuk (Legacy)`;
        btn.disabled = false;
    }
}

function closeOtpModal() {
    const content = document.getElementById('otpModalContent');
    const modal = document.getElementById('otpModal');
    if (content) content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        if (modal) modal.classList.add('hidden');
    }, 300);
}

async function submitOtp(e) {
    e.preventDefault();
    const otp = document.getElementById('otp-input').value;
    const email = sessionStorage.getItem('temp_reg_email');
    const password = sessionStorage.getItem('temp_reg_password');
    const btn = document.getElementById('btn-submit-otp');
    const errorMsg = document.getElementById('otp-error-msg');
    
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Memverifikasi...`;
    btn.disabled = true;
    if (errorMsg) errorMsg.classList.add('hidden');
    
    try {
        const response = await fetch(AUTH_API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'verify_otp', email: email, otp: otp, password: password })
        });
        
        const data = await response.json();
        if (data.success) {
            localStorage.setItem('user_token', data.token);
            localStorage.setItem('user_data', JSON.stringify(data.user));
            
            sessionStorage.removeItem('temp_reg_email');
            sessionStorage.removeItem('temp_reg_password');
            
            closeOtpModal();
            checkAuthState();
            if (typeof showToast === 'function') showToast('Akun berhasil diverifikasi!');
        } else {
            throw new Error(data.message || "Verifikasi OTP gagal");
        }
    } catch (error) {
        if (errorMsg) {
            errorMsg.innerText = error.message;
            errorMsg.classList.remove('hidden');
        }
    } finally {
        btn.innerHTML = `<span>Verifikasi Akun</span><i class="fa-solid fa-check-circle"></i>`;
        btn.disabled = false;
    }
}

function initGoogleAuth() {
    if (typeof google === 'undefined' || !google.accounts || !google.accounts.id) {
        setTimeout(initGoogleAuth, 500);
        return;
    }
    
    if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.includes('PENDING') || GOOGLE_CLIENT_ID.includes('GANTI_DENGAN')) {
        console.warn('[GoogleAuth] Google Client ID belum dikonfigurasi.');
        return;
    }

    try {
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleCredentialResponse
        });
    } catch (e) {
        console.warn('[GoogleAuth] initialize error:', e);
        return;
    }

    const pengasuhBtn = document.getElementById("google-signin-pengasuh");
    if (pengasuhBtn) {
        google.accounts.id.renderButton(
            pengasuhBtn,
            { theme: "filled_blue", size: "large", text: "continue_with", shape: "pill" }
        );
    }

    const parentBtn = document.getElementById("google-signin-parent");
    if (parentBtn) {
        google.accounts.id.renderButton(
            parentBtn,
            { theme: "outline", size: "large", text: "continue_with", shape: "pill" }
        );
    }

    const adminBtn = document.getElementById("google-signin-admin");
    if (adminBtn) {
        google.accounts.id.renderButton(
            adminBtn,
            { theme: "outline", size: "large", text: "continue_with", shape: "pill" }
        );
    }

    const legacyContainer = document.getElementById("google-signin-container");
    if (legacyContainer) {
        google.accounts.id.renderButton(
            legacyContainer,
            { theme: "outline", size: "large", text: "continue_with", shape: "pill" }
        );
    }
}

async function handleCredentialResponse(response) {
    const token = response.credential;
    if (!token) return;

    // Deteksi modal atau tab mana yang sedang aktif
    let roleHint = "";
    const pengasuhModalOpen = document.getElementById('modal-auth-pengasuh') && !document.getElementById('modal-auth-pengasuh').classList.contains('hidden');
    const adminModalOpen = document.getElementById('modal-auth-admin') && !document.getElementById('modal-auth-admin').classList.contains('hidden');
    const parentModalOpen = document.getElementById('modal-auth-parent') && !document.getElementById('modal-auth-parent').classList.contains('hidden');

    if (pengasuhModalOpen) roleHint = "PENGASUH";
    else if (adminModalOpen) roleHint = "ADMIN";
    else if (parentModalOpen) roleHint = "WALI_SANTRI";

    if (typeof showToast === 'function') {
        showToast('Memverifikasi akun Google...');
    }

    try {
        const ssoResult = await ASNAuthAPI.ssoGoogle(token, roleHint);
        if (ssoResult && ssoResult.success) {
            const role = String(ssoResult.role || '').toUpperCase();
            if (role === 'PENGASUH') {
                ASNIdentity.setPengasuhSession(ssoResult.token, ssoResult.pengasuh || ssoResult.identity);
                if (typeof closePengasuhAuthModal === 'function') closePengasuhAuthModal();
                if (typeof showToast === 'function') showToast(`Ahlan wa Sahlan, ${ssoResult.identity?.name || 'Pengasuh'}`);
            } else if (['SUPER_ADMIN', 'ADMIN', 'BENDAHARA', 'PENGURUS', 'ASATIDZ', 'PEGAWAI', 'EDITOR'].includes(role)) {
                const adminObj = ssoResult.admin || ssoResult.identity || {};
                const normalizedRole = (role === 'EDITOR' || role === 'PEGAWAI') ? ASN_ROLES.ASATIDZ : (ASN_ROLES[role] || role);
                adminObj.role = normalizedRole;
                ASNIdentity.setAdminSession(ssoResult.token, adminObj, normalizedRole);
                if (typeof closeAdminAuthModal === 'function') closeAdminAuthModal();
                if (typeof showToast === 'function') showToast('Login Pengelola Berhasil!');
                if (window.innerWidth >= 1024 && (window.location.pathname.replace(/\/+$/, '') === '/administrator' || document.getElementById('page-admin')?.classList.contains('block'))) {
                    if (typeof switchTab === 'function') switchTab('admin');
                    if (typeof showAdminView === 'function') showAdminView('hub');
                }
            } else if (role === 'WALI_SANTRI') {
                ASNIdentity.setParentSession(ssoResult.token, ssoResult.parent || ssoResult.identity, ssoResult.students);
                if (typeof closeParentAuthModal === 'function') closeParentAuthModal();
                if (typeof showToast === 'function') showToast('Login Wali Santri Berhasil!');
            }
            return;
        }

        if (ssoResult && ssoResult.notRegistered) {
            if (roleHint === 'WALI_SANTRI' || !roleHint) {
                if (typeof closeParentAuthModal === 'function') closeParentAuthModal();
                if (typeof openParentActivationModal === 'function') {
                    openParentActivationModal(ssoResult.email, ssoResult.name);
                }
                if (typeof showToast === 'function') {
                    showToast('Email belum terdaftar. Silakan aktivasi akun menggunakan NISN & Tanggal Lahir santri.');
                }
            } else {
                const alertEl = document.getElementById(roleHint === 'ADMIN' ? 'admin-auth-alert' : 'pengasuh-auth-alert');
                const alertText = document.getElementById(roleHint === 'ADMIN' ? 'admin-auth-alert-text' : 'pengasuh-auth-alert-text');
                if (alertEl && alertText) {
                    alertText.innerText = ssoResult.message || 'Email Google tidak terdaftar dalam daftar resmi.';
                    alertEl.classList.remove('hidden');
                } else if (typeof showToast === 'function') {
                    showToast(ssoResult.message || 'Email Google tidak terdaftar.');
                }
            }
            return;
        }

        const msg = (ssoResult && ssoResult.message) || 'Verifikasi Google Sign-In gagal.';
        if (typeof showToast === 'function') showToast(msg);
    } catch (e) {
        console.error('[Google SSO] Exception:', e);
        if (typeof showToast === 'function') showToast('Terjadi kendala memproses Google Sign-In.');
    }
}

// ====================================================================
// ONLINE PRESENCE TELEMETRY & HEARTBEAT
// ====================================================================

let userPresenceTimer = null;

function detectClientDeviceInfo() {
    if (typeof window === 'undefined') return 'Desktop Browser';
    const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
    
    let os = 'Desktop';
    if (/Android/i.test(ua)) os = 'Android';
    else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
    else if (/Windows/i.test(ua)) os = 'Windows';
    else if (/Macintosh|Mac OS X/i.test(ua)) os = 'Mac';
    else if (/Linux/i.test(ua)) os = 'Linux';

    let browser = 'Browser';
    if (/Edg/i.test(ua)) browser = 'Edge';
    else if (/Chrome/i.test(ua)) browser = 'Chrome';
    else if (/Safari/i.test(ua)) browser = 'Safari';
    else if (/Firefox/i.test(ua)) browser = 'Firefox';

    if (isStandalone) {
        return `📱 PWA ${os}`;
    }
    if (os === 'Android' || os === 'iOS') {
        return `📱 Mobile ${browser} (${os})`;
    }
    return `💻 ${browser} ${os}`;
}

function calculateUserOnlineStatus(lastSeenAt) {
    if (!lastSeenAt) return { status: 'offline', label: 'Offline', color: 'slate', text: 'Belum aktif', isOnline: false };
    const dateVal = new Date(lastSeenAt);
    if (isNaN(dateVal.getTime())) return { status: 'offline', label: 'Offline', color: 'slate', text: 'Belum aktif', isOnline: false };
    
    const diffMs = Date.now() - dateVal.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins <= 3) return { status: 'online', label: 'Online', color: 'emerald', text: 'Online sekarang', isOnline: true };
    if (diffMins <= 7) return { status: 'idle', label: 'Idle', color: 'amber', text: `${diffMins} mnt lalu (Idle)`, isOnline: true };
    if (diffMins < 60) return { status: 'offline', label: 'Offline', color: 'slate', text: `${diffMins} mnt lalu`, isOnline: false };
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return { status: 'offline', label: 'Offline', color: 'slate', text: `${diffHours}jam lalu`, isOnline: false };
    return { status: 'offline', label: 'Offline', color: 'slate', text: `${Math.floor(diffHours / 24)}hari lalu`, isOnline: false };
}

async function sendUserPresenceHeartbeat() {
    let currentId = null;
    let currentEmail = null;
    let currentPhone = null;
    let currentToken = null;
    let currentRole = null;

    // 0. Prioritaskan ASNIdentity aktif di memori
    if (typeof ASNIdentity !== 'undefined' && ASNIdentity.currentUser) {
        const u = ASNIdentity.currentUser;
        currentId = u.userId || u.user_id || u.identityId || u.id;
        currentEmail = u.email;
        currentPhone = u.phone || u.telepon;
        currentRole = ASNIdentity.currentRole;
    }

    // 1. Cek Admin / Pegawai / Pengurus
    try {
        const adminDataStr = sessionStorage.getItem('mubarokah_admin_data') || localStorage.getItem('mubarokah_admin_data');
        if (adminDataStr) {
            const admin = JSON.parse(adminDataStr);
            if (!currentId) currentId = admin.userId || admin.user_id || admin.identityId || admin.id;
            if (!currentEmail) currentEmail = admin.email;
            if (!currentPhone) currentPhone = admin.phone || admin.telepon;
            if (!currentRole) currentRole = admin.role || sessionStorage.getItem('mubarokah_admin_role') || localStorage.getItem('mubarokah_admin_role');
            currentToken = sessionStorage.getItem('mubarokah_admin_token') || localStorage.getItem('mubarokah_admin_token');
        }
    } catch (e) {}

    // Fallback email admin jika disimpan terpisah
    if (!currentEmail) {
        currentEmail = localStorage.getItem('mubarokah_admin_email') || sessionStorage.getItem('mubarokah_admin_email');
    }

    // 2. Cek Pengasuh
    if (!currentId && !currentEmail) {
        try {
            const pengasuhDataStr = sessionStorage.getItem('mubarokah_pengasuh_data') || localStorage.getItem('mubarokah_pengasuh_data');
            if (pengasuhDataStr) {
                const pengasuh = JSON.parse(pengasuhDataStr);
                currentId = pengasuh.userId || pengasuh.user_id || pengasuh.identityId || pengasuh.id;
                currentEmail = pengasuh.email;
                currentPhone = pengasuh.phone;
                currentRole = 'PENGASUH';
                currentToken = sessionStorage.getItem('mubarokah_pengasuh_token') || localStorage.getItem('mubarokah_pengasuh_token');
            }
        } catch (e) {}
    }

    // 3. Cek Wali Santri
    if (!currentId && !currentEmail) {
        try {
            const parentDataStr = sessionStorage.getItem('mubarokah_parent_data') || localStorage.getItem('mubarokah_parent_data');
            if (parentDataStr) {
                const parent = JSON.parse(parentDataStr);
                currentId = parent.userId || parent.user_id || parent.identityId || parent.id;
                currentEmail = parent.email;
                currentPhone = parent.phone || parent.telepon;
                currentRole = 'WALI_SANTRI';
                currentToken = sessionStorage.getItem('mubarokah_parent_token') || localStorage.getItem('mubarokah_parent_token');
            }
        } catch (e) {}
    }

    if (!currentId && !currentEmail && !currentPhone && !currentToken) return;

    try {
        const deviceInfo = detectClientDeviceInfo();
        const payload = {
            action: 'auth.user.heartbeat',
            userId: currentId,
            email: currentEmail,
            phone: currentPhone,
            role: currentRole,
            token: currentToken,
            deviceInfo: deviceInfo
        };

        if (typeof authApiPost === 'function') {
            await authApiPost('auth.user.heartbeat', payload);
        } else if (typeof apiPost === 'function') {
            await apiPost('auth.user.heartbeat', payload);
        }
    } catch (e) {
        // Silent failover for telemetry
    }
}

function startUserPresenceHeartbeat() {
    sendUserPresenceHeartbeat();
    if (!userPresenceTimer && typeof setInterval !== 'undefined') {
        userPresenceTimer = setInterval(sendUserPresenceHeartbeat, 60000);
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            sendUserPresenceHeartbeat();
        }
    });
}

// Inisialisasi awal saat auth.js dimuat
if (typeof window !== 'undefined') {
    window.detectClientDeviceInfo = detectClientDeviceInfo;
    window.calculateUserOnlineStatus = calculateUserOnlineStatus;
    window.sendUserPresenceHeartbeat = sendUserPresenceHeartbeat;
    window.startUserPresenceHeartbeat = startUserPresenceHeartbeat;

    setTimeout(() => {
        if (
            sessionStorage.getItem('mubarokah_admin_token') || localStorage.getItem('mubarokah_admin_token') ||
            sessionStorage.getItem('mubarokah_pengasuh_token') || localStorage.getItem('mubarokah_pengasuh_token') ||
            sessionStorage.getItem('mubarokah_parent_token') || localStorage.getItem('mubarokah_parent_token')
        ) {
            startUserPresenceHeartbeat();
        }
    }, 1500);
}
// ====================================================================
// ASNAWIYYAH AUTHENTICATION SYSTEM ADOPTION: UI & TAB CONTROLLERS
// ====================================================================

function switchParentAuthTab(tabName) {
    const paneNis = document.getElementById('parent-auth-pane-nis');
    const paneOtp = document.getElementById('parent-auth-pane-otp');
    const btnNis = document.getElementById('tab-btn-parent-nis');
    const btnOtp = document.getElementById('tab-btn-parent-otp');
    const alertBox = document.getElementById('parent-auth-alert');
    if (alertBox) alertBox.classList.add('hidden');

    if (tabName === 'nis') {
        if (paneNis) paneNis.classList.remove('hidden');
        if (paneOtp) paneOtp.classList.add('hidden');
        if (btnNis) {
            btnNis.className = "py-2 rounded-xl transition shadow-xs bg-white dark:bg-[#15202d] text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-1.5";
        }
        if (btnOtp) {
            btnOtp.className = "py-2 rounded-xl transition text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center gap-1.5";
        }
    } else {
        if (paneNis) paneNis.classList.add('hidden');
        if (paneOtp) paneOtp.classList.remove('hidden');
        if (btnOtp) {
            btnOtp.className = "py-2 rounded-xl transition shadow-xs bg-white dark:bg-[#15202d] text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-1.5";
        }
        if (btnNis) {
            btnNis.className = "py-2 rounded-xl transition text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center gap-1.5";
        }
        if (typeof initGoogleAuth === 'function') initGoogleAuth();
    }
}
window.switchParentAuthTab = switchParentAuthTab;

function switchAdminAuthTab(tabName) {
    const paneGoogle = document.getElementById('admin-auth-pane-google');
    const paneOtp = document.getElementById('admin-auth-pane-otp');
    const btnGoogle = document.getElementById('tab-btn-admin-google');
    const btnOtp = document.getElementById('tab-btn-admin-otp');
    const alertBox = document.getElementById('admin-auth-alert');
    if (alertBox) alertBox.classList.add('hidden');

    if (tabName === 'google') {
        if (paneGoogle) paneGoogle.classList.remove('hidden');
        if (paneOtp) paneOtp.classList.add('hidden');
        if (btnGoogle) {
            btnGoogle.className = "py-2 rounded-xl transition shadow-xs bg-white dark:bg-[#15202d] text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-1.5";
        }
        if (btnOtp) {
            btnOtp.className = "py-2 rounded-xl transition text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center gap-1.5";
        }
        if (typeof initGoogleAuth === 'function') initGoogleAuth();
    } else {
        if (paneGoogle) paneGoogle.classList.add('hidden');
        if (paneOtp) paneOtp.classList.remove('hidden');
        if (btnOtp) {
            btnOtp.className = "py-2 rounded-xl transition shadow-xs bg-white dark:bg-[#15202d] text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-1.5";
        }
        if (btnGoogle) {
            btnGoogle.className = "py-2 rounded-xl transition text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center gap-1.5";
        }
    }
}
window.switchAdminAuthTab = switchAdminAuthTab;

function promptGoogleAccountChooser(roleHint = 'ADMIN') {
    if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.includes('PENDING') || GOOGLE_CLIENT_ID.includes('GANTI_DENGAN')) {
        if (typeof showToast === 'function') {
            showToast('Google Sign-In belum dikonfigurasi. Silakan masuk menggunakan tab Email OTP atau NIS & PIN.', 'warning');
        }
        return;
    }
    if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
        try {
            google.accounts.id.prompt();
            return;
        } catch (e) {
            console.warn('[GoogleAuth] prompt error:', e);
        }
    }
    if (typeof showToast === 'function') {
        showToast('Pilih akun Google Anda pada tombol yang tersedia.');
    }
}
window.promptGoogleAccountChooser = promptGoogleAccountChooser;

async function handleParentLoginWithNis(e) {
    if (e && e.preventDefault) e.preventDefault();
    const nisInput = document.getElementById('parent-login-nis');
    const dobInput = document.getElementById('parent-login-dob');
    const btn = document.getElementById('btn-parent-login-nis');
    const alertBox = document.getElementById('parent-auth-alert');
    const alertText = document.getElementById('parent-auth-alert-text');

    const nis = nisInput ? nisInput.value.trim() : '';
    const birthDate = dobInput ? dobInput.value.trim() : '';

    if (!nis || !birthDate) {
        if (alertBox && alertText) {
            alertText.innerText = 'NIS Santri dan PIN Tanggal Lahir wajib diisi.';
            alertBox.classList.remove('hidden');
        }
        return;
    }

    if (alertBox) alertBox.classList.add('hidden');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin text-xs"></i> <span>Memverifikasi...</span>`;
    }

    try {
        const res = await ASNAuthAPI.loginParentWithNis(nis, birthDate);
        if (res && res.success && res.token) {
            ASNIdentity.setParentSession(res.token, res.identity, res.students);
            closeParentAuthModal();
            const studentName = (res.students && res.students[0] && res.students[0].name) || (res.identity && res.identity.name) || 'Santri';
            if (typeof showToast === 'function') {
                showToast(`✅ Selamat datang, Wali dari ${studentName}!`);
            }
            if (typeof refreshWaliView === 'function') {
                refreshWaliView();
            }
            if (typeof switchTab === 'function') {
                const isAppContext = window.location.pathname.startsWith('/app') || window.location.pathname.endsWith('app.html');
                switchTab(isAppContext ? 'pengaturan' : 'beranda', true);
            }
        } else {
            if (alertBox && alertText) {
                alertText.innerText = res.message || 'Kombinasi NIS dan PIN Tanggal Lahir tidak cocok.';
                alertBox.classList.remove('hidden');
            }
        }
    } catch (err) {
        if (alertBox && alertText) {
            alertText.innerText = err.message || 'Gagal memproses autentikasi.';
            alertBox.classList.remove('hidden');
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<span>Masuk ke Dashboard Wali Santri</span> <i class="fa-solid fa-arrow-right text-xs"></i>`;
        }
    }
}
window.handleParentLoginWithNis = handleParentLoginWithNis;
