# STEP 04B-4/5: SCRIPT PROPERTIES & NATIVE SPREADSHEET SCHEMA INITIALIZATION
**Final Safety Correction Report — FULLY FAIL-CLOSED TWO-PHASE ARCHITECTURE**

- **Date / Timestamp**: 2026-09-16T12:28:00+07:00
- **Operator**: Antigravity (Pair Programming Assistant)
- **Target Repository**: `C:\Users\pc\Documents\APP\Mubarokah_App`
- **Source Repository**: `C:\Users\pc\Documents\APP\asnawiyyah` (Strictly READ-ONLY & Untouched at commit `12ac316`)
- **Execution Mode**: Initializer Staged / Execution Pending
- **Status**: **STEP 04B-4/5 — FINAL SAFETY CORRECTED / READY FOR FOUNDER AUDIT**

---

## 0. ARCHITECTURE REFACTORING: TWO STRICT PHASES

To guarantee that the initializer is **fully fail-closed** and can never leave the spreadsheet in a partially modified state upon encountering an anomaly or existing data, `initializeMubarokahInfrastructure()` was refactored into two strictly decoupled phases:

```
+-------------------------------------------------------------------------+
|                  initializeMubarokahInfrastructure()                    |
+-------------------------------------------------------------------------+
                                    │
                                    ▼
+-------------------------------------------------------------------------+
|                    PHASE A — READ-ONLY PREFLIGHT                        |
|                       inspectSpreadsheet_(ss)                           |
+-------------------------------------------------------------------------+
| - Opens target Spreadsheet (read-only inspection).                      |
| - Scans all 22 authoritative sheets.                                    |
| - Inspects Pendaftar (schema pending).                                  |
| - Inspects default sheets (Sheet1, Lembar1).                            |
| - Detects:                                                              |
|     * Existing data rows (lastRow > 1) -> VIOLATION                     |
|     * Header mismatches -> VIOLATION                                    |
|     * Pendaftar content (lastRow > 0) -> VIOLATION                      |
|     * Non-empty default sheets -> VIOLATION                             |
|     * Unexpected non-authoritative sheets                               |
| - STRICT SAFETY: ZERO mutations (no insertSheet, setValues,             |
|   setFontWeight, setFrozenRows, deleteSheet, setProperty, or secrets).  |
+-------------------------------------------------------------------------+
                                    │
                       Is preflight clean (ok == true)?
                                    │
                   NO ──────────────┴────────────── YES
                   ▼                                 ▼
+------------------------------------+   +------------------------------------+
|               HALT                 |   |        PHASE B — MUTATION          |
|  - Throws immediately.             |   |    executeInitialization_(ss)      |
|  - Log detailed error list.        |   +------------------------------------+
|  - SPREADSHEET REMAINS 100%        |   | 1. Set Script Properties (Infra).  |
|    UNTOUCHED AND UNMODIFIED.       |   | 2. Generate CSPRNG secrets (UUID). |
+------------------------------------+   | 3. Create missing sheets.          |
                                         | 4. Write verified headers & format.|
                                         | 5. Remove verified empty Sheet1.   |
                                         | 6. Final read-only verification.   |
                                         +------------------------------------+
```

---

## 1. PRE-FLIGHT & AUTHENTICATED RESOURCE IDENTITY

| Resource | Expected Identifier / State | Verified Current State | Status |
|---|---|---|---|
| **Google Account** | `izzatatabik@gmail.com` | `izzatatabik@gmail.com` | **PASS** |
| **Spreadsheet ID** | `1cZSRh2rtKpT6E8m3GFJonVbiQG51fh24eN8J5JWtOJY` | `1cZSRh2rtKpT6E8m3GFJonVbiQG51fh24eN8J5JWtOJY` ("Mubarokah App Database [OFFICIAL]") | **PASS** |
| **Drive Root Folder** | `1cry1i8SkbfZs8VHbOaYuHje7DIc06I-L` | `1cry1i8SkbfZs8VHbOaYuHje7DIc06I-L` ("Mubarokah App") | **PASS** |
| **Drive Media Folder** | `16sG7CQLOKt7kRfv0Us9qJCno50vm1D7f` | `16sG7CQLOKt7kRfv0Us9qJCno50vm1D7f` ("Media") | **PASS** |
| **Drive User Photos** | `13665dGDEPCEXX9-zKdEEG95ENLvwgANW` | `13665dGDEPCEXX9-zKdEEG95ENLvwgANW` ("User Photos") | **PASS** |
| **Drive Student Photos**| `1vM14jSf7V6LaxE7xJMZbruvRuQvavPnT` | `1vM14jSf7V6LaxE7xJMZbruvRuQvavPnT` ("Student Photos") | **PASS** |
| **Apps Script Project** | `1YeVAlO95CdmoimR7Njl1pJHurBgTZmtQ8eUAjmWBpBsm-htfu3HqKc4B` | `1YeVAlO95CdmoimR7Njl1pJHurBgTZmtQ8eUAjmWBpBsm-htfu3HqKc4B` ("Mubarokah_Backend_API") | **PASS** |

---

## 2. SECURITY SPECIFICATION: CRYPTOGRAPHIC SECRETS & DATA INTEGRITY

### A. CSPRNG-Only Secret Generation
- **Entropy Source**: Exclusively `Utilities.getUuid()`, backed by Java `SecureRandom`.
- **Prohibited Sources**: Zero `Math.random()`, zero timestamp/clock-based entropy, zero project/script ID derivations.
- **Minimum Strength**: 4 independent UUIDs per secret (488 bits total entropy) passed into HMAC-SHA256 to produce 32 bytes (64 hex characters).
- **Overwrite Protection**: Any secret key already having `length >= 64` is never overwritten.
- **Containment**: Secret values are never logged, printed, or leaked via `getTenantConfig_()`.

### B. Fail-Closed Data Integrity
- **Zero Data Wipe Calls**: Zero calls to `sheet.clear()`, `sheet.clearContents()`, `getRange().clear()`, `deleteRow()`, or `deleteRows()`.
- **Default Sheet Deletion**: Default empty sheets (`Sheet1`, `Lembar1`) are deleted *only* if confirmed to have `lastRow == 0` during Phase A preflight.
- **Pendaftar Protection**: Staged as schema pending (`null`). If content exists (`lastRow > 0`), Phase A fails immediately.

---

## 3. VERIFICATION: 10-POINT STATIC CHECKLIST

All 10 verification points specified in the safety contract were executed and verified against `Setup.gs`:

| # | Verification Requirement | Automated Check Scope | Result | Details |
|:---:|---|---|:---:|---|
| **1** | **No `Math.random`** | Literal grep on `Setup.gs` | **PASS** | 0 occurrences |
| **2** | **No timestamp entropy** | Regex `(?:new Date\|Date\.now\|getTime)` on `Setup.gs` | **PASS** | 0 occurrences |
| **3** | **No `sheet.clear()`** | Regex `\.clear\w*\s*\(` on `Setup.gs` | **PASS** | 0 occurrences |
| **4** | **No `deleteRow` / `deleteRows`** | Regex `deleteRows?\s*\(` on `Setup.gs` | **PASS** | 0 occurrences |
| **5** | **No mutation before preflight PASS** | Ast/Regex check on `inspectSpreadsheet_` body | **PASS** | 0 mutation methods called; strict control flow verified (`preflight` -> `if (!preflight.ok) throw` -> `executeInitialization_`) |
| **6** | **Existing data causes preflight failure** | Inspection logic verification (`lastRow > 1`) | **PASS** | Verified: sets `result.ok = false` and registers error |
| **7** | **Header mismatch causes preflight failure** | Header comparison verification | **PASS** | Verified: sets `result.ok = false` and registers error |
| **8** | **Pendaftar content causes preflight failure** | Pendaftar inspection verification (`lastRow > 0`) | **PASS** | Verified: sets `result.ok = false` and registers error |
| **9** | **Non-empty Sheet1 causes preflight failure** | Default sheet inspection (`lastRow > 0`) | **PASS** | Verified: sets `result.ok = false` and registers error |
| **10** | **ASNawiyyah remains untouched** | Git status & log on `C:\Users\pc\Documents\APP\asnawiyyah` | **PASS** | Untouched, 0 changes, clean HEAD at `12ac316` |

---

## 4. INSTRUCTIONS FOR FOUNDER AUDIT & EXECUTION

The refactored, fully fail-closed `Setup.gs` is staged both locally at `legacy/Setup.gs` and remotely in the Apps Script project `1YeVAlO95CdmoimR7Njl1pJHurBgTZmtQ8eUAjmWBpBsm-htfu3HqKc4B`.

### Founder Run Steps (When Ready):
1. Open the Apps Script Editor in your browser:  
   [https://script.google.com/d/1YeVAlO95CdmoimR7Njl1pJHurBgTZmtQ8eUAjmWBpBsm-htfu3HqKc4B/edit](https://script.google.com/d/1YeVAlO95CdmoimR7Njl1pJHurBgTZmtQ8eUAjmWBpBsm-htfu3HqKc4B/edit)
2. In the function dropdown, select: **`initializeMubarokahInfrastructure`**.
3. Click **Run** and grant the standard OAuth permissions for `izzatatabik@gmail.com`.
4. Review the Execution Log. You should observe:
   - `=== PHASE A: READ-ONLY PREFLIGHT ===`
   - `[PASS] PHASE A: PREFLIGHT CLEAN — ALL CHECKS PASSED`
   - `=== PHASE B: MUTATION AUTHORIZED ===`
   - `=== MUBAROKAH STEP 04B-4/5 INITIALIZATION COMPLETE ===`
5. In **Project Settings > Script Properties**, set **`ADMIN_PIN_HASH`** with your offline SHA-256 Base64 hash.

---

## 5. FINAL STATUS

**STEP 04B-4/5 — FINAL SAFETY CORRECTED / READY FOR FOUNDER AUDIT**

*(STOP. No execution performed by assistant. Waiting for Founder audit).*
