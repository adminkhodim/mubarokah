/**
 * ====================================================================
 * TENANT CONFIGURATION & IDENTITY CONTRACT
 * ====================================================================
 * Single Source of Truth for Mubarokah App tenant identity,
 * branding, contact, geographic settings, infrastructure pointers,
 * authentication endpoints, storage key namespace, and PWA options.
 *
 * RULES:
 * 1. DO NOT invent institutional facts. Unconfirmed data must remain:
 *    "__MUBAROKAH_CONFIG_PENDING__"
 * 2. NEVER put secrets, passwords, HMAC keys, or tokens in this file.
 * 3. This configuration is public and consumed by the browser application.
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        // Node / CommonJS
        module.exports = factory();
    } else {
        // Browser Global
        root.APP_CONFIG = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const PENDING = "__MUBAROKAH_CONFIG_PENDING__";

    const APP_CONFIG = Object.freeze({
        // A. Tenant Identity
        tenant: Object.freeze({
            tenantId: "mubarokah",
            institutionName: PENDING,
            institutionShortName: PENDING,
            institutionType: PENDING
        }),

        // B. Branding
        branding: Object.freeze({
            appName: "Mubarokah App",
            shortName: "Mubarokah",
            tagline: PENDING,
            logo: PENDING,
            favicon: PENDING,
            primaryColor: "#059669",     // Tailwind emerald-600 baseline
            secondaryColor: "#0f172a",   // Slate-900 baseline
            accentColor: "#f59e0b"       // Amber-500 baseline
        }),

        // C. Contact Information
        contact: Object.freeze({
            address: PENDING,
            village: PENDING,
            district: PENDING,
            regency: PENDING,
            province: PENDING,
            postalCode: PENDING,
            phone: PENDING,
            whatsapp: PENDING,
            email: PENDING,
            website: PENDING
        }),

        // D. Geographic Configuration
        geography: Object.freeze({
            latitude: PENDING,
            longitude: PENDING,
            timezone: "Asia/Jakarta",    // Safe technical default for Indonesia (WIB)
            prayerCity: PENDING,
            prayerMethod: "LF PBNU"      // Lembaga Falakiyah Nahdlatul Ulama calculation formula
        }),

        // E. Infrastructure Pointers (External services - unpopulated until provisioned)
        infrastructure: Object.freeze({
            apiBaseUrl: (typeof window !== 'undefined' && (window.location.protocol === 'http:' || window.location.protocol === 'https:'))
                ? "/api/auth"
                : "https://script.google.com/macros/s/AKfycbz4To49WTzqN2r3M8M3H4_YyAbeMjfTWRgxLrz6-YXuf7oFAVZZ6okh14LTIkZdMj9qGg/exec",
            appsScriptWebAppUrl: "https://script.google.com/macros/s/AKfycbz4To49WTzqN2r3M8M3H4_YyAbeMjfTWRgxLrz6-YXuf7oFAVZZ6okh14LTIkZdMj9qGg/exec",
            appsScriptProjectId: PENDING,
            spreadsheetId: PENDING,
            driveRootFolderId: PENDING,
            driveStudentFolderId: PENDING,
            driveEmployeeFolderId: PENDING,
            vercelProjectId: PENDING,
            vercelTeamId: PENDING
        }),

        // F. Authentication
        authentication: Object.freeze({
            authApiUrl: (typeof window !== 'undefined' && (window.location.protocol === 'http:' || window.location.protocol === 'https:'))
                ? "/api/auth"
                : "https://script.google.com/macros/s/AKfycbz4To49WTzqN2r3M8M3H4_YyAbeMjfTWRgxLrz6-YXuf7oFAVZZ6okh14LTIkZdMj9qGg/exec",
            googleClientId: PENDING
        }),

        // G. Centralized Storage Keys Namespace
        storage: Object.freeze({
            prefix: "mubarokah_",
            keys: Object.freeze({
                adminToken: "mubarokah_admin_token",
                adminRole: "mubarokah_admin_role",
                adminData: "mubarokah_admin_data",
                parentToken: "mubarokah_parent_token",
                parentData: "mubarokah_parent_data",
                parentStudents: "mubarokah_parent_students",
                pengasuhToken: "mubarokah_pengasuh_token",
                pengasuhData: "mubarokah_pengasuh_data",
                theme: "mubarokah_theme",
                bannerCache: "mubarokah_banner_cache",
                pwaDismissed: "mubarokah_pwa_dismissed",
                prayerCity: "mubarokah_prayer_city",
                readNotifIds: "mubarokah_read_notif_ids",
                cachedNotifikasi: "mubarokah_cached_notifikasi",
                tempAdminEmail: "mubarokah_temp_admin_email",
                tempParentEmail: "mubarokah_temp_parent_email",
                tempParentPhone: "mubarokah_temp_parent_phone",
                tempActivationData: "mubarokah_temp_activation_data"
            })
        }),

        // H. Progressive Web App (PWA) Options
        pwa: Object.freeze({
            manifestName: "Mubarokah App",
            manifestShortName: "Mubarokah",
            manifestDescription: "Portal Pesantren & Layanan Tahfidz Terpadu",
            serviceWorkerCacheName: "mubarokah-cache-v2"
        })
    });

    return APP_CONFIG;
});
