# STEP 04B-1: Google Drive Hierarchy Provisioning Report

**Target Project:** `C:\Users\pc\Documents\APP\Mubarokah_App`  
**Source Project:** `C:\Users\pc\Documents\APP\asnawiyyah` (Untouched, Read-Only)  
**Execution Timestamp:** 2026-09-16T04:33:19Z (11:33:19 WIB)  
**Final Status:** **STEP 04B-1 — GOOGLE DRIVE HIERARCHY PROVISIONED & VERIFIED**

---

## 1. Authenticated Google Account Identity

* **Authenticated Account Email:** `izzatatabik@gmail.com`
* **Account Display Name:** `izzat atabik`
* **Email Verification State:** Verified (`email_verified: true`)
* **OAuth Authorization Mechanism:** Local User OAuth2 Credentials (via `clasp` token store with granted `drive.file` scope)
* **Founder Review Note:** The currently authenticated account (`izzatatabik@gmail.com`) was verified and used for provisioning. Per safety policy, this account is not assumed to be the permanent production institutional owner; the Founder may audit this ownership and transfer resources to a dedicated institutional Google Workspace account at a future stage if desired.

---

## 2. Provisioned Google Drive Hierarchy & Identifiers

All 4 folders were freshly created in Google Drive with zero parentage link to any existing ASNawiyyah hierarchy.

```text
Mubarokah App/ [ID: 1cry1i8SkbfZs8VHbOaYuHje7DIc06I-L]
├── Media/ [ID: 16sG7CQLOKt7kRfv0Us9qJCno50vm1D7f]
├── User Photos/ [ID: 13665dGDEPCEXX9-zKdEEG95ENLvwgANW]
└── Student Photos/ [ID: 1vM14jSf7V6LaxE7xJMZbruvRuQvavPnT]
```

### Authoritative Infrastructure IDs

| Folder Path | Name | Google Drive Folder ID | Parent Folder ID | Status |
| :--- | :--- | :--- | :--- | :---: |
| `/` | `Mubarokah App` | `1cry1i8SkbfZs8VHbOaYuHje7DIc06I-L` | *Drive Root* | **CREATED** |
| `/Media` | `Media` | `16sG7CQLOKt7kRfv0Us9qJCno50vm1D7f` | `1cry1i8SkbfZs8VHbOaYuHje7DIc06I-L` | **CREATED** |
| `/User Photos` | `User Photos` | `13665dGDEPCEXX9-zKdEEG95ENLvwgANW` | `1cry1i8SkbfZs8VHbOaYuHje7DIc06I-L` | **CREATED** |
| `/Student Photos` | `Student Photos` | `1vM14jSf7V6LaxE7xJMZbruvRuQvavPnT` | `1cry1i8SkbfZs8VHbOaYuHje7DIc06I-L` | **CREATED** |

---

## 3. Intended Purpose & Operational Mapping

1. **`Mubarokah App/` (Root Container - ID: `1cry1i8SkbfZs8VHbOaYuHje7DIc06I-L`)**
   - **Operational Purpose:** Top-level application-managed container in Google Drive. Serves as the designated parent container for the future Mubarokah Spreadsheet database and all application media storage folders.
   - **PII Level:** Aggregated / Container.
   - **Configuration Mapping:** Script Property `DRIVE_FOLDER_ID` (Root reference) / Internal Workspace Admin container.

2. **`Media/` (ID: `16sG7CQLOKt7kRfv0Us9qJCno50vm1D7f`)**
   - **Operational Purpose:** Application-managed storage for all public portal assets. Used by `legacy/Code.gs` upload routines for:
     - `Berita` (News article images)
     - `Banner` (Hero carousel and promotional banners)
     - `Galeri` (Institutional photo gallery items)
     - `Unit Kegiatan` (Extracurricular / UKS activity documentation photos)
     - `Notifikasi` (Announcement popup images)
     - `Pengaturan` (Institution logo and profile imagery)
     - `Data_Alumni` (Alumni tracer directory photos)
   - **PII Level:** LOW (Public institutional media + self-submitted alumni photos).
   - **Configuration Mapping:** Script Property `DRIVE_FOLDER_ID`.

3. **`User Photos/` (ID: `13665dGDEPCEXX9-zKdEEG95ENLvwgANW`)**
   - **Operational Purpose:** Application-managed avatar and profile picture storage for:
     - Asatidz / Faculty / Staff
     - Pengasuh / Institutional Leadership
     - Administrators
     - Wali Santri (Guardians)
   - **PII Level:** HIGH (Personnel and guardian photographs).
   - **Configuration Mapping:** Script Property `DRIVE_FOLDER_USER_PHOTOS`.

4. **`Student Photos/` (ID: `1vM14jSf7V6LaxE7xJMZbruvRuQvavPnT`)**
   - **Operational Purpose:** Application-managed storage for:
     - Santri / Student profile photographs
     - Digital student identity card photo assets
   - **PII Level:** HIGH (Photographs of minor students).
   - **Configuration Mapping:** Script Property `DRIVE_FOLDER_STUDENT_PHOTOS`.

---

## 4. Sharing & Access Policy Verification

* **Root Folder Sharing Status:** `shared: false`
* **Default Owner:** `izzatatabik@gmail.com`
* **Public Link Sharing:** Not enabled on the root folder.
* **Anonymous Edit Access:** **STRICTLY PROHIBITED & DISABLED**. Zero anonymous edit permissions granted.
* **Web View Link (Owner Only):** `https://drive.google.com/drive/folders/1cry1i8SkbfZs8VHbOaYuHje7DIc06I-L`
* **Serving Policy Note:** Serving access for individual uploaded files will be handled programmatically by Apps Script upload routines at runtime (`ANYONE_WITH_LINK, VIEW` on individual file blobs as defined in `legacy/Code.gs`), keeping the container folders private to the owner.

---

## 5. Verification & Negative Assertions

| Check | Target / Requirement | Verification Result | Evidence |
| :--- | :--- | :---: | :--- |
| **A. Root Folder Exists** | `Mubarokah App` | **PASS** | Verified via Drive API `files.get`. ID: `1cry1i8SkbfZs8VHbOaYuHje7DIc06I-L`. |
| **B. Exactly 3 Child Folders** | `Media`, `User Photos`, `Student Photos` | **PASS** | `files.list` with parent filter returns exactly 3 children. |
| **C. Distinct Folder IDs** | 4 unique IDs | **PASS** | All 4 IDs are mutually distinct (`Set.size === 4`). |
| **D. No ASNawiyyah ID Reused** | Zero matching IDs | **PASS** | None match `1xKMwCsHJ9`, `15N2sd_Etm`, `1XJi_lcDly`, or `AKfycbxIz`. |
| **E. Zero Files Uploaded** | 0 files | **PASS** | All folders created completely empty. No files uploaded. |
| **F. Zero PII Transferred** | 0 records / photos | **PASS** | Zero student, staff, or alumni photos transferred from ASNawiyyah. |
| **G. Source Repository Untouched** | Read-Only | **PASS** | `git status` on ASNawiyyah is clean; HEAD remains at `12ac316`. |
| **H. Target Source Untouched** | No source edits | **PASS** | Zero source files in `Mubarokah_App` modified (only this report added). |
| **I. No Spreadsheet Created** | 0 Spreadsheets | **PASS** | Step 04B-2 deferred. No spreadsheet created. |
| **J. No Apps Script Created** | 0 Apps Script projects | **PASS** | Step 04B-3 deferred. No Apps Script created. |
| **K. No Web App Deployed** | 0 deployments | **PASS** | Step 04B-7 deferred. No deployment executed. |
| **L. No Secrets Generated** | 0 secrets | **PASS** | Zero tokens, salts, PINs, or HMAC secrets generated. |
| **M. APP_CONFIG Untouched** | Placeholders preserved | **PASS** | `js/app-config.js` retains `__MUBAROKAH_CONFIG_PENDING__`. |

---

## 6. Warnings and Unresolved Items for Founder Review

1. **Institutional Account Confirmation:** The Drive hierarchy is currently provisioned under Google Account `izzatatabik@gmail.com`. The Founder should review whether to keep this account as the infrastructure host or transfer ownership to a formal institutional Google Workspace account before creating the Spreadsheet and Apps Script.
2. **Configuration Boundary Upheld:** In accordance with instructions, the newly generated Drive IDs have **NOT** been written into `js/app-config.js`. They will be configured into Google Apps Script `Script Properties` in Step 04B-4, and the frontend config will only receive public non-secret pointers after Web App deployment.

---

### **FINAL STATUS:**
**STEP 04B-1 — GOOGLE DRIVE HIERARCHY PROVISIONED & VERIFIED**  
**READY FOR FOUNDER AUDIT**
