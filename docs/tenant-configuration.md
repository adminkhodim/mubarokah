# Tenant Configuration & Identity Contract — Mubarokah App

## 1. Purpose & Architectural Overview

The Tenant Configuration & Identity Contract establishes **a single, immutable source of truth** for all institution-specific parameters in `Mubarokah_App`.

Previously, institutional names, contact details, storage keys, and backend deployment URLs were scattered as hardcoded string literals across frontend scripts and backend Google Apps Script code. This contract decouples the generic application logic from tenant identity and external infrastructure bindings:

```text
               ┌──────────────────────────────┐
               │       js/app-config.js       │
               │   (Central Identity SOT)     │
               └──────────────┬───────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
   [ index.html ]        [ js/api.js ]       [ js/auth.js ]
   (Theme Key)         (Web App URL)       (Auth Endpoints)
         │                    │                    │
         ▼                    ▼                    ▼
   [ js/main.js ]       [ js/pwa.js ]      [ js/admin.js ]
   (Banner Cache)     (PWA Dismissed)     (Tokens & Roles)
```

In the backend (`legacy/Code.gs`), dynamic infrastructure IDs and secrets are injected strictly via **Google Apps Script Script Properties**, keeping the code repository 100% clean of hardcoded tenant environments and secrets.

---

## 2. Tenant Identity

* **Tenant ID:** `mubarokah` (confirmed technical identifier)
* **Application Name:** `Mubarokah App`
* **Short Name:** `Mubarokah`
* **Baseline Palette:** Emerald (`#059669`), Slate (`#0f172a`), Amber (`#f59e0b`)

All institutional facts not yet established by the founder remain explicitly marked as:
`__MUBAROKAH_CONFIG_PENDING__`

---

## 3. Configuration Domain Breakdown

The contract is structured as an immutable object (`Object.freeze`) in `js/app-config.js`:

### A. Tenant Identity (`APP_CONFIG.tenant`)
* `tenantId`: `"mubarokah"`
* `institutionName`: Pending founder input
* `institutionShortName`: Pending founder input
* `institutionType`: Pending founder input

### B. Branding (`APP_CONFIG.branding`)
* `appName`: `"Mubarokah App"`
* `shortName`: `"Mubarokah"`
* `tagline`: Pending founder input
* `logo`: Pending asset provisioning
* `favicon`: Pending asset provisioning
* `primaryColor`: `"#059669"`
* `secondaryColor`: `"#0f172a"`
* `accentColor`: `"#f59e0b"`

### C. Contact (`APP_CONFIG.contact`)
* `address`, `village`, `district`, `regency`, `province`, `postalCode`: Pending founder input
* `phone`, `whatsapp`, `email`, `website`: Pending founder input

### D. Geographic Configuration (`APP_CONFIG.geography`)
* `latitude`, `longitude`: Pending founder input
* `timezone`: `"Asia/Jakarta"` (Technical default for Western Indonesia - WIB)
* `prayerCity`: Pending founder input
* `prayerMethod`: `"LF PBNU"` (Lembaga Falakiyah Nahdlatul Ulama astronomical standard)

### E. Infrastructure Pointers (`APP_CONFIG.infrastructure`)
* `appsScriptWebAppUrl`: Pending Apps Script deployment
* `appsScriptProjectId`: Pending Google Cloud/GAS project setup
* `spreadsheetId`: Pending Google Sheets database creation
* `driveRootFolderId`: Pending Google Drive folder creation
* `driveStudentFolderId`: Pending Google Drive folder creation
* `driveEmployeeFolderId`: Pending Google Drive folder creation
* `vercelProjectId`: Pending Vercel project linking
* `vercelTeamId`: Pending Vercel team setup

### F. Authentication (`APP_CONFIG.authentication`)
* `authApiUrl`: Pending backend authentication endpoint
* `googleClientId`: Pending Google OAuth Client ID

### G. Centralized Storage Keys (`APP_CONFIG.storage`)
* `prefix`: `"mubarokah_"`
* `keys.adminToken`: `"mubarokah_admin_token"`
* `keys.adminRole`: `"mubarokah_admin_role"`
* `keys.adminData`: `"mubarokah_admin_data"`
* `keys.parentToken`: `"mubarokah_parent_token"`
* `keys.parentData`: `"mubarokah_parent_data"`
* `keys.parentStudents`: `"mubarokah_parent_students"`
* `keys.pengasuhToken`: `"mubarokah_pengasuh_token"`
* `keys.pengasuhData`: `"mubarokah_pengasuh_data"`
* `keys.theme`: `"mubarokah_theme"`
* `keys.bannerCache`: `"mubarokah_banner_cache"`
* `keys.pwaDismissed`: `"mubarokah_pwa_dismissed"`
* `keys.prayerCity`: `"mubarokah_prayer_city"`

### H. Progressive Web App (`APP_CONFIG.pwa`)
* `manifestName`: `"Mubarokah App"`
* `manifestShortName`: `"Mubarokah"`
* `manifestDescription`: `"Portal Pesantren & Layanan Tahfidz Terpadu"`
* `serviceWorkerCacheName`: `"mubarokah-cache-pending"`

---

## 4. Required Configuration Matrix

| Configuration | Current Value | Status | Future Source |
| :--- | :--- | :--- | :--- |
| **tenantId** | `mubarokah` | **CONFIRMED** | Application Baseline |
| **institutionName** | `__MUBAROKAH_CONFIG_PENDING__` | **REQUIRED** | Founder Input |
| **address** | `__MUBAROKAH_CONFIG_PENDING__` | **REQUIRED** | Founder Input |
| **phone** | `__MUBAROKAH_CONFIG_PENDING__` | **REQUIRED** | Founder Input |
| **email** | `__MUBAROKAH_CONFIG_PENDING__` | **REQUIRED** | Founder Input |
| **latitude** | `__MUBAROKAH_CONFIG_PENDING__` | **REQUIRED** | Founder Input |
| **longitude** | `__MUBAROKAH_CONFIG_PENDING__` | **REQUIRED** | Founder Input |
| **Apps Script URL** | `__MUBAROKAH_CONFIG_PENDING__` | **FUTURE** | Apps Script Deployment |
| **Spreadsheet ID** | `__MUBAROKAH_CONFIG_PENDING__` | **FUTURE** | Google Sheets Setup |
| **Drive Folder IDs**| `__MUBAROKAH_CONFIG_PENDING__` | **FUTURE** | Google Drive Setup |
| **Vercel Project ID**| `__MUBAROKAH_CONFIG_PENDING__` | **FUTURE** | Vercel Project Link |
| **secrets** | *NOT STORED IN REPO* | **SECURITY** | Apps Script Script Properties |

---

## 5. Values That Must NEVER Be Committed

Under no circumstances should the following be committed to this repository or added to `js/app-config.js`:

1. **HMAC Secrets / Signing Keys:** (e.g. `APP_SECRET_KEY`)
2. **Password Hashes / Salts:** (e.g. `APP_SALT`)
3. **Google Service Account Private Keys**
4. **OAuth Client Secrets**
5. **Database / Spreadsheet Direct Credentials**
6. **Production Session / Admin Tokens**

Backend secrets must always be stored in Google Apps Script via:
`Project Settings > Script Properties`

---

## 6. Frontend & Backend Consumption Guide

### Frontend Consumption
`js/app-config.js` is loaded synchronously in the `<head>` of `index.html` before any application scripts:
```html
<script src="js/app-config.js"></script>
```

In any client-side JavaScript module:
```javascript
// Access storage key
const tokenKey = APP_CONFIG.storage.keys.adminToken;

// Access backend endpoint
const apiUrl = APP_CONFIG.infrastructure.appsScriptWebAppUrl;
if (apiUrl !== '__MUBAROKAH_CONFIG_PENDING__') {
    // Proceed with remote network call
}
```

### Backend Consumption (`legacy/Code.gs`)
Backend handlers retrieve deployment-specific configurations and drive folders using the `getTenantConfig_()` boundary:
```javascript
function getTenantConfig_() {
  const props = PropertiesService.getScriptProperties();
  return {
    tenantId: "mubarokah",
    driveRootFolderId: props.getProperty("DRIVE_FOLDER_ID") || "",
    driveUserPhotosFolderId: props.getProperty("DRIVE_FOLDER_USER_PHOTOS") || "",
    driveStudentPhotosFolderId: props.getProperty("DRIVE_FOLDER_STUDENT_PHOTOS") || ""
  };
}
```

---

## 7. Security Boundaries

1. **Immutability:** The entire configuration tree returned by `js/app-config.js` is recursively frozen via `Object.freeze` to prevent accidental or malicious runtime tampering.
2. **Decoupling of Dynamic Content:** Dynamic institution profile text (history, vision/mission, management structures stored in Google Sheets) is managed in a separate runtime state object (`window.APP_PROFIL_STATE`) to avoid collisions with the immutable tenant contract.
3. **Graceful Fallbacks:** If `APP_CONFIG` is loaded in an unconfigured environment, all network adapters cleanly disable remote calls and report descriptive configuration pending errors rather than failing silently or leaking data.
