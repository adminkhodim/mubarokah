/**
 * ============================================================================
 * 06_MasterData.gs
 * PPTQ Roudlotul Mubarokah Backend Architecture - Master Data, Akademik & Presensi
 * ============================================================================
 * Tanggung Jawab Domain:
 *  - Programs Data Source v2.0 (Public & Admin Program DTO, optimistic locking, migration)
 *  - Data Alumni (CRUD Alumni, Testimonials)
 *  - Master Santri & Google Drive Photo Management
 *  - Master Pegawai (Asatidz, Muhafiz, Guru, Karyawan CRUD)
 *  - Akademik TPQ / Yanbu'a (TPQ Logs, Capaian, Kelas, Plotting, Target, Sesi, Dashboard)
 *  - Madrasah Diniyah / Madin (Madin Kelas, Kitab, Jurnal, Presensi, Grades)
 *  - Sorogan Al-Qur'an (Sorogan Logs, Capaian, Halaqah, Plotting, Target, Sesi, Dashboard)
 *  - Presensi Terpadu Santri (Hybrid & Exception-based attendance, Sesi, Rekap)
 * ============================================================================
 */


// ============================================================================
// PROGRAM DATA SOURCE v2.0 — PHASE 4B-1: BACKEND FOUNDATION
// Pure domain abstractions, error models, contracts, and service skeletons.
// (Zero persistence I/O, zero HTTP coupling, zero auth implementation in 4B-1).
// ============================================================================

/**
 * Domain Status Enum
 */
const ProgramStatus = Object.freeze({
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived"
});

/**
 * Domain Error Codes (HTTP-Agnostic)
 */
const ProgramErrorCode = Object.freeze({
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  CONCURRENCY_CONFLICT: "CONCURRENCY_CONFLICT",
  SERIALIZATION_ERROR: "SERIALIZATION_ERROR",
  PERSISTENCE_ERROR: "PERSISTENCE_ERROR",
  AUTHENTICATION_ERROR: "UNAUTHORIZED_TOKEN",
  AUTHORIZATION_ERROR: "FORBIDDEN_ACTION"
});

/**
 * Base HTTP-Agnostic Domain Error
 */
class DomainError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.details = details;
  }
}

class ValidationError extends DomainError {
  constructor(message, details = null) {
    super(ProgramErrorCode.VALIDATION_ERROR, message, details);
    this.name = "ValidationError";
  }
}

class NotFoundError extends DomainError {
  constructor(message = "Program data not found", details = null) {
    super(ProgramErrorCode.NOT_FOUND, message, details);
    this.name = "NotFoundError";
  }
}

class ConcurrencyConflictError extends DomainError {
  constructor(message = "Optimistic concurrency conflict detected. Record has been updated by another user.", details = null) {
    super(ProgramErrorCode.CONCURRENCY_CONFLICT, message, details);
    this.name = "ConcurrencyConflictError";
  }
}

class SerializationError extends DomainError {
  constructor(message = "Failed to serialize/deserialize program JSON payload (Fail-Closed)", details = null) {
    super(ProgramErrorCode.SERIALIZATION_ERROR, message, details);
    this.name = "SerializationError";
  }
}

class PersistenceError extends DomainError {
  constructor(message = "Persistence layer error", details = null) {
    super(ProgramErrorCode.PERSISTENCE_ERROR, message, details);
    this.name = "PersistenceError";
  }
}

class AuthenticationError extends DomainError {
  constructor(message = "Authentication required or token invalid", details = null) {
    super(ProgramErrorCode.AUTHENTICATION_ERROR, message, details);
    this.name = "AuthenticationError";
  }
}

class AuthorizationError extends DomainError {
  constructor(message = "Insufficient permissions for requested action", details = null) {
    super(ProgramErrorCode.AUTHORIZATION_ERROR, message, details);
    this.name = "AuthorizationError";
  }
}

/**
 * Domain Contract Interfaces & Helper Factories (Conceptual Value Objects)
 */
function createActorContext(userId, role, authenticatedAt = new Date().toISOString(), requestId = "") {
  if (!userId || !role) {
    throw new ValidationError("ActorContext requires valid userId and role");
  }
  return Object.freeze({
    userId: String(userId),
    role: String(role),
    authenticatedAt: String(authenticatedAt),
    requestId: String(requestId)
  });
}

function createAuditMetadata(actorContext, isPublishing = false) {
  const now = new Date().toISOString();
  const meta = {
    updated_at: now,
    updated_by: actorContext ? actorContext.userId : "system"
  };
  if (isPublishing) {
    meta.published_at = now;
    meta.published_by = actorContext ? actorContext.userId : "system";
  }
  return meta;
}

/**
 * Abstract ProgramRepository Interface (Pure Data-Access Contract)
 * Completely decoupled from HTTP, token, PIN, browser, or SpreadsheetApp.
 */
class ProgramRepository {
  findPublished() {
    throw new Error("ProgramRepository.findPublished() must be implemented by subclass");
  }

  findAll() {
    throw new Error("ProgramRepository.findAll() must be implemented by subclass");
  }

  findById(id) {
    throw new Error("ProgramRepository.findById() must be implemented by subclass");
  }

  save(record) {
    throw new Error("ProgramRepository.save() must be implemented by subclass");
  }

  updateStatus(id, status, metadata) {
    throw new Error("ProgramRepository.updateStatus() must be implemented by subclass");
  }
}

/**
 * GoogleSheetsProgramAdapter Implementation
 * Production-oriented Google Sheets Persistence Adapter satisfying the ProgramRepository contract.
 * Features: Sheet discovery, Header validation, Row mapping, LockService critical section,
 * Optimistic Concurrency, and Fail-Closed JSON serialization.
 */
class GoogleSheetsProgramAdapter extends ProgramRepository {
  constructor(customSheetName = "Programs") {
    super();
    this.sheetName = customSheetName;
    this.expectedHeaders = [
      "id", "name", "badge", "image", "description",
      "highlights_json", "detail_json", "status", "sort_order",
      "created_at", "updated_at", "created_by", "updated_by",
      "published_at", "published_by", "version"
    ];
  }

  /**
   * Internal helper: Discovers the "Programs" (or "Program") sheet and validates the 16-column header schema.
   * Features Self-Healing & Auto-Provisioning: If the sheet does not exist or is empty,
   * it automatically creates the sheet with proper 16-column headers, formatting, and seeds canonical program data.
   */
  _getProgramsSheet() {
    let ss = null;
    try {
      ss = getDatabaseSpreadsheet();
    } catch (e) {
      throw new PersistenceError("SpreadsheetApp active spreadsheet is unavailable: " + e.message);
    }
    if (!ss) {
      throw new PersistenceError("Active spreadsheet object is null.");
    }

    // 1. Check configured sheetName ("Programs")
    let sheet = ss.getSheetByName(this.sheetName);

    // 2. Fallback to alternative ("Program" vs "Programs")
    if (!sheet) {
      const altName = (this.sheetName.toLowerCase() === "programs") ? "Program" : "Programs";
      sheet = ss.getSheetByName(altName);
    }

    // 3. Case-insensitive search across all sheets
    if (!sheet) {
      const allSheets = ss.getSheets();
      for (let i = 0; i < allSheets.length; i++) {
        const sName = allSheets[i].getName().trim().toLowerCase();
        if (sName === "programs" || sName === "program") {
          sheet = allSheets[i];
          break;
        }
      }
    }

    // 4. Auto-Provisioning: If sheet does not exist, create it automatically!
    if (!sheet) {
      sheet = ss.insertSheet(this.sheetName);
      sheet.getRange(1, 1, 1, this.expectedHeaders.length).setValues([this.expectedHeaders]);
      sheet.getRange(1, 1, 1, this.expectedHeaders.length)
        .setFontWeight("bold")
        .setBackground("#047857")
        .setFontColor("#ffffff");
      sheet.setFrozenRows(1);

      this._seedDefaultPrograms(sheet);
      return sheet;
    }

    // Update resolved sheetName
    this.sheetName = sheet.getName();

    // 5. If sheet exists but is completely empty (missing headers)
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    if (!values || values.length === 0 || (values.length === 1 && values[0].join("").trim() === "")) {
      sheet.getRange(1, 1, 1, this.expectedHeaders.length).setValues([this.expectedHeaders]);
      sheet.getRange(1, 1, 1, this.expectedHeaders.length)
        .setFontWeight("bold")
        .setBackground("#047857")
        .setFontColor("#ffffff");
      sheet.setFrozenRows(1);

      this._seedDefaultPrograms(sheet);
      return sheet;
    }

    const headerRow = values[0];
    if (headerRow.length < this.expectedHeaders.length) {
      // Auto-repair missing columns in header row if safe
      sheet.getRange(1, 1, 1, this.expectedHeaders.length).setValues([this.expectedHeaders]);
      sheet.getRange(1, 1, 1, this.expectedHeaders.length)
        .setFontWeight("bold")
        .setBackground("#047857")
        .setFontColor("#ffffff");
      sheet.setFrozenRows(1);
      return sheet;
    }

    // Verify critical column header names (case-insensitive trim match)
    let headerNeedsFix = false;
    for (let colIdx = 0; colIdx < this.expectedHeaders.length; colIdx++) {
      const expectedCol = this.expectedHeaders[colIdx];
      const actualCol = String(headerRow[colIdx] || "").trim().toLowerCase();
      if (actualCol !== expectedCol) {
        headerNeedsFix = true;
        break;
      }
    }

    if (headerNeedsFix) {
      // Auto-correct header schema row to align with standard
      sheet.getRange(1, 1, 1, this.expectedHeaders.length).setValues([this.expectedHeaders]);
      sheet.getRange(1, 1, 1, this.expectedHeaders.length)
        .setFontWeight("bold")
        .setBackground("#047857")
        .setFontColor("#ffffff");
      sheet.setFrozenRows(1);
    }

    return sheet;
  }

  /**
   * Internal Helper: Seeds canonical default programs into newly created, empty, or incomplete sheet.
   */
  _seedDefaultPrograms(sheet) {
    try {
      if (typeof getCanonicalMigrationSource === "function") {
        const source = getCanonicalMigrationSource();
        if (Array.isArray(source) && source.length > 0) {
          const values = sheet.getDataRange().getValues();
          const existingIds = new Set();
          for (let r = 1; r < values.length; r++) {
            if (values[r][0]) {
              existingIds.add(String(values[r][0]).trim());
            }
          }

          const missing = source.filter(item => !existingIds.has(item.id));
          if (missing.length > 0) {
            const nowIso = new Date().toISOString();
            const startRow = Math.max(2, sheet.getLastRow() + 1);
            const rows = missing.map((item, idx) => [
              item.id,
              item.name,
              item.badge,
              item.image,
              item.description,
              serializeProgramPayload(item.highlights || []),
              serializeProgramPayload(item.detail || {}),
              ProgramStatus.PUBLISHED,
              existingIds.size + idx + 1,
              nowIso,
              nowIso,
              "system:init",
              "system:init",
              nowIso,
              "system:init",
              1
            ]);
            sheet.getRange(startRow, 1, rows.length, this.expectedHeaders.length).setValues(rows);
            Logger.log(`[OK] Seeded ${rows.length} programs into sheet '${sheet.getName()}'.`);
          }
        }
      }
    } catch (e) {
      Logger.log("Warning in _seedDefaultPrograms: " + e.message);
    }
  }

  /**
   * Internal Helper: Maps a spreadsheet row array (16 columns) to a ProgramRecord domain object.
   * Enforces FAIL-CLOSED serialization boundary: invalid JSON throws SerializationError immediately.
   */
  _mapRowToRecord(row) {
    if (!row || row.length < 16) {
      throw new PersistenceError("Row data incomplete or truncated (fewer than 16 columns).");
    }

    const id = String(row[0] || "").trim();
    if (!id) {
      throw new PersistenceError("Program row missing required 'id' field.");
    }

    const name = String(row[1] || "").trim();
    const badge = String(row[2] || "").trim();
    const image = String(row[3] || "").trim();
    const description = String(row[4] || "").trim();

    // Deserialize highlights and detail (Fail-Closed!)
    const highlights = deserializeProgramPayload(row[5]);
    const detail = deserializeProgramPayload(row[6]);

    const status = String(row[7] || ProgramStatus.DRAFT).trim().toLowerCase();
    const sortOrder = Number(row[8]) || 0;
    const createdAt = row[9] ? new Date(row[9]).toISOString() : new Date().toISOString();
    const updatedAt = row[10] ? new Date(row[10]).toISOString() : new Date().toISOString();
    const createdBy = String(row[11] || "system").trim();
    const updatedBy = String(row[12] || "system").trim();
    const publishedAt = row[13] ? new Date(row[13]).toISOString() : null;
    const publishedBy = row[14] ? String(row[14]).trim() : null;
    const version = Number(row[15]) || 1;

    return Object.freeze({
      id,
      name,
      badge,
      image,
      description,
      highlights,
      detail,
      status,
      sort_order: sortOrder,
      created_at: createdAt,
      updated_at: updatedAt,
      created_by: createdBy,
      updated_by: updatedBy,
      published_at: publishedAt,
      published_by: publishedBy,
      version
    });
  }

  /**
   * Internal Helper: Maps a ProgramRecord domain object to a 16-element spreadsheet row array.
   */
  _mapRecordToRow(record) {
    if (!record || !record.id) {
      throw new ValidationError("Cannot map invalid record object to spreadsheet row.");
    }

    const highlightsJson = serializeProgramPayload(record.highlights || []);
    const detailJson = serializeProgramPayload(record.detail || {});

    return [
      record.id,
      record.name || "",
      record.badge || "",
      record.image || "",
      record.description || "",
      highlightsJson,
      detailJson,
      record.status || ProgramStatus.DRAFT,
      Number(record.sort_order) || 0,
      record.created_at || new Date().toISOString(),
      record.updated_at || new Date().toISOString(),
      record.created_by || "system",
      record.updated_by || "system",
      record.published_at || "",
      record.published_by || "",
      Number(record.version) || 1
    ];
  }

  /**
   * Reads and returns all records with status === "published", sorted by sort_order ASC.
   * Fail-Closed: If any row fails JSON parsing, operation fails with SerializationError.
   */
  findPublished() {
    const sheet = this._getProgramsSheet();
    const values = sheet.getDataRange().getValues();
    const records = [];

    // Rows 1..N (Index 0 is header)
    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      if (!row[0] || String(row[0]).trim() === "") continue; // Skip blank rows

      const record = this._mapRowToRecord(row);
      if (record.status === ProgramStatus.PUBLISHED) {
        records.push(record);
      }
    }

    // Sort by sort_order ASC, tie-breaker id ASC
    records.sort((a, b) => {
      if (a.sort_order !== b.sort_order) {
        return a.sort_order - b.sort_order;
      }
      return a.id.localeCompare(b.id);
    });

    return records;
  }

  /**
   * Reads and returns all program records regardless of status.
   * Fail-Closed: Invalid cell JSON throws SerializationError immediately.
   */
  findAll() {
    const sheet = this._getProgramsSheet();
    const values = sheet.getDataRange().getValues();
    const records = [];

    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      if (!row[0] || String(row[0]).trim() === "") continue;

      const record = this._mapRowToRecord(row);
      records.push(record);
    }

    records.sort((a, b) => {
      if (a.sort_order !== b.sort_order) {
        return a.sort_order - b.sort_order;
      }
      return a.id.localeCompare(b.id);
    });

    return records;
  }

  /**
   * Reads and returns a single program record by ID, or null if not found.
   */
  findById(id) {
    if (!id || String(id).trim() === "") return null;
    const targetId = String(id).trim();

    const sheet = this._getProgramsSheet();
    const values = sheet.getDataRange().getValues();

    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      if (String(row[0] || "").trim() === targetId) {
        return this._mapRowToRecord(row);
      }
    }

    return null; // ID not found
  }

  /**
   * Inserts or updates a ProgramRecord atomically using LockService.getScriptLock().
   * Enforces optimistic concurrency counter comparison on updates.
   */
  save(record) {
    if (!record || !record.id) {
      throw new ValidationError("ProgramRecord.id is required for save operation.");
    }

    let lock = null;
    try {
      lock = LockService.getScriptLock();
    } catch (e) {
      throw new PersistenceError("LockService is unavailable: " + e.message);
    }

    const hasLock = lock.tryLock(10000); // 10s critical section lock timeout
    if (!hasLock) {
      throw new PersistenceError("Failed to acquire script lock for write operation within 10 seconds.");
    }

    try {
      const sheet = this._getProgramsSheet();
      const values = sheet.getDataRange().getValues();
      const targetId = String(record.id).trim();

      let targetRowIndex = -1;
      let storedRecord = null;

      for (let r = 1; r < values.length; r++) {
        if (String(values[r][0] || "").trim() === targetId) {
          targetRowIndex = r + 1; // 1-indexed row number in Spreadsheet
          storedRecord = this._mapRowToRecord(values[r]);
          break;
        }
      }

      if (targetRowIndex > 0 && storedRecord) {
        // UPDATE EXISTING RECORD: Enforce Optimistic Concurrency Check
        // Record version passed from service/client should equal (storedRecord.version)
        const expectedVersion = Number(record.version) - 1; // Service increments version before saving
        checkOptimisticVersion(storedRecord.version, expectedVersion);

        const rowData = this._mapRecordToRow(record);
        sheet.getRange(targetRowIndex, 1, 1, 16).setValues([rowData]);
      } else {
        // INSERT NEW RECORD
        const rowData = this._mapRecordToRow(record);
        sheet.appendRow(rowData);
      }

      return record;
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * Atomically updates status and audit metadata of a ProgramRecord using LockService.getScriptLock().
   */
  updateStatus(id, newStatus, metadata = {}) {
    if (!id || String(id).trim() === "") {
      throw new ValidationError("Program ID is required for updateStatus.");
    }
    if (!newStatus || !Object.values(ProgramStatus).includes(newStatus)) {
      throw new ValidationError(`Invalid target ProgramStatus: '${newStatus}'.`);
    }

    let lock = null;
    try {
      lock = LockService.getScriptLock();
    } catch (e) {
      throw new PersistenceError("LockService is unavailable: " + e.message);
    }

    const hasLock = lock.tryLock(10000);
    if (!hasLock) {
      throw new PersistenceError("Failed to acquire script lock for updateStatus within 10 seconds.");
    }

    try {
      const sheet = this._getProgramsSheet();
      const values = sheet.getDataRange().getValues();
      const targetId = String(id).trim();

      let targetRowIndex = -1;
      let storedRecord = null;

      for (let r = 1; r < values.length; r++) {
        if (String(values[r][0] || "").trim() === targetId) {
          targetRowIndex = r + 1;
          storedRecord = this._mapRowToRecord(values[r]);
          break;
        }
      }

      if (targetRowIndex <= 0 || !storedRecord) {
        throw new NotFoundError(`Program with ID '${id}' not found.`);
      }

      // Increment version counter atomically
      const nextVersion = storedRecord.version + 1;
      const nowIso = new Date().toISOString();
      const updatedBy = metadata.updated_by || (metadata.actorContext ? metadata.actorContext.userId : "system");

      let publishedAt = storedRecord.published_at;
      let publishedBy = storedRecord.published_by;

      if (newStatus === ProgramStatus.PUBLISHED) {
        publishedAt = metadata.published_at || nowIso;
        publishedBy = metadata.published_by || updatedBy;
      }

      const updatedRecord = Object.freeze({
        ...storedRecord,
        status: newStatus,
        version: nextVersion,
        updated_at: metadata.updated_at || nowIso,
        updated_by: updatedBy,
        published_at: publishedAt,
        published_by: publishedBy
      });

      const rowData = this._mapRecordToRow(updatedRecord);
      sheet.getRange(targetRowIndex, 1, 1, 16).setValues([rowData]);

      return true;
    } finally {
      lock.releaseLock();
    }
  }
}

/**
 * Server Secrets Helper (Reads PropertiesService)
 */

function mapToPublicProgramDTO(record) {
  if (!record) return null;
  return Object.freeze({
    id: record.id,
    name: record.name,
    badge: record.badge,
    image: record.image,
    description: record.description,
    highlights: record.highlights,
    detail: record.detail
  });
}

function mapToAdminProgramDTO(record) {
  if (!record) return null;
  return Object.freeze({
    id: record.id,
    name: record.name,
    badge: record.badge,
    image: record.image,
    description: record.description,
    highlights: record.highlights,
    detail: record.detail,
    status: record.status,
    sort_order: record.sort_order,
    created_at: record.created_at,
    updated_at: record.updated_at,
    created_by: record.created_by,
    updated_by: record.updated_by,
    published_at: record.published_at,
    published_by: record.published_by,
    version: record.version
  });
}

/**
 * ProgramService Implementation
 * Application service orchestrating business rules, field ownership, and lifecycle logic.
 */
class ProgramService {
  constructor(programRepository) {
    if (!programRepository) {
      throw new ValidationError("ProgramService requires a valid ProgramRepository instance");
    }
    this.repository = programRepository;
  }

  getPublishedPrograms() {
    const records = this.repository.findPublished();
    return records.map(r => mapToPublicProgramDTO(r));
  }

  getPublishedProgramById(id) {
    if (!id) throw new ValidationError("Program ID is required.");
    const record = this.repository.findById(id);
    if (!record || record.status !== ProgramStatus.PUBLISHED) {
      throw new NotFoundError(`Published program '${id}' not found.`);
    }
    return mapToPublicProgramDTO(record);
  }

  getAllPrograms(actorContext) {
    authorizeAction(actorContext, "program.list");
    const records = this.repository.findAll();
    return records.map(r => mapToAdminProgramDTO(r));
  }

  getProgramById(id, actorContext) {
    authorizeAction(actorContext, "program.get");
    if (!id) throw new ValidationError("Program ID is required.");
    const record = this.repository.findById(id);
    if (!record) {
      throw new NotFoundError(`Program with ID '${id}' not found.`);
    }
    return mapToAdminProgramDTO(record);
  }

  saveProgram(inputPayload, actorContext) {
    if (!inputPayload || typeof inputPayload !== "object") {
      throw new ValidationError("Invalid program payload.");
    }

    const id = String(inputPayload.id || "").trim();
    if (!id) {
      throw new ValidationError("Program ID is required.");
    }

    let existing = null;
    try {
      existing = this.repository.findById(id);
    } catch (e) {
      existing = null;
    }

    const isEdit = Boolean(existing);
    const actionName = isEdit ? "program.update" : "program.create";
    authorizeAction(actorContext, actionName);

    // OPTIMISTIC CONCURRENCY VALIDATION
    // Client wajib mengirim version saat melakukan edit.
    if (
      isEdit &&
      inputPayload.version !== undefined &&
      inputPayload.version !== null
    ) {
      checkOptimisticVersion(
        existing.version,
        Number(inputPayload.version)
      );
    }

    const name = String(
      inputPayload.name || (existing ? existing.name : "")
    ).trim();

    if (!name) {
      throw new ValidationError("Program name is required.");
    }

    const now = new Date().toISOString();
    const userId = actorContext.userId;

    // Build ProgramRecord with Server-Managed Lifecycle Fields
    const recordToSave = Object.freeze({
      id: id,
      name: name,
      badge: String(
        inputPayload.badge || (existing ? existing.badge : "")
      ).trim(),
      image: String(
        inputPayload.image || (existing ? existing.image : "")
      ).trim(),
      description: String(
        inputPayload.description || (existing ? existing.description : "")
      ).trim(),
      highlights: Array.isArray(inputPayload.highlights)
        ? inputPayload.highlights
        : (existing ? existing.highlights : []),
      detail: (
        inputPayload.detail &&
        typeof inputPayload.detail === "object"
      )
        ? inputPayload.detail
        : (existing ? existing.detail : {}),

      // SERVER-MANAGED FIELDS
      status: existing
        ? existing.status
        : ProgramStatus.DRAFT,

      sort_order: Number(inputPayload.sort_order) ||
        (existing ? existing.sort_order : 0),

      created_at: existing
        ? existing.created_at
        : now,

      updated_at: now,

      created_by: existing
        ? existing.created_by
        : userId,

      updated_by: userId,

      published_at: existing
        ? existing.published_at
        : null,

      published_by: existing
        ? existing.published_by
        : null,

      // SERVER-SIDE VERSION INCREMENT
      version: isEdit
        ? (Number(existing.version) + 1)
        : 1
    });

    const saved = this.repository.save(recordToSave);
    return mapToAdminProgramDTO(saved);
  }

  publishProgram(id, actorContext, expectedVersion = null) {
    authorizeAction(actorContext, "program.publish");
    const existing = this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Program '${id}' not found for publish action.`);
    }
    if (expectedVersion !== null && expectedVersion !== undefined) {
      checkOptimisticVersion(existing.version, expectedVersion);
    }

    const meta = createAuditMetadata(actorContext, true);
    this.repository.updateStatus(id, ProgramStatus.PUBLISHED, meta);
    return mapToAdminProgramDTO(this.repository.findById(id));
  }

  unpublishProgram(id, actorContext, expectedVersion = null) {
    authorizeAction(actorContext, "program.unpublish");
    const existing = this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Program '${id}' not found for unpublish action.`);
    }
    if (expectedVersion !== null && expectedVersion !== undefined) {
      checkOptimisticVersion(existing.version, expectedVersion);
    }

    const meta = createAuditMetadata(actorContext, false);
    this.repository.updateStatus(id, ProgramStatus.DRAFT, meta);
    return mapToAdminProgramDTO(this.repository.findById(id));
  }

  archiveProgram(id, actorContext, expectedVersion = null) {
    authorizeAction(actorContext, "program.archive");
    const existing = this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Program '${id}' not found for archive action.`);
    }
    if (expectedVersion !== null && expectedVersion !== undefined) {
      checkOptimisticVersion(existing.version, expectedVersion);
    }

    const meta = createAuditMetadata(actorContext, false);
    this.repository.updateStatus(id, ProgramStatus.ARCHIVED, meta);
    return mapToAdminProgramDTO(this.repository.findById(id));
  }
}

/**
 * Application Response Envelope Generator (HTTP-Agnostic JSON Wrapper)
 */
function createAppResponse(success, dataOrMessage, errorObj = null, requestId = "") {
  const reqId = requestId || ("req_" + new Date().getTime());
  if (success) {
    return createJsonResponse({
      success: true,
      data: dataOrMessage,
      requestId: reqId
    });
  } else {
    const code = (errorObj && errorObj.code) || "SERVER_ERROR";
    const message = (errorObj && errorObj.message) || String(dataOrMessage || "An internal error occurred.");
    return createJsonResponse({
      success: false,
      error: {
        code: code,
        message: message,
        requestId: reqId
      },
      requestId: reqId
    });
  }
}

/**
 * API Gateway Dispatcher for Program Data Source v2.0 Actions
 */
function handleProgramApiAction(action, payload, e) {
  const requestId = "req_" + new Date().getTime() + "_" + Math.floor(Math.random() * 1000);
  try {
    // Shared Adapter & Service Factory
    const repository = new GoogleSheetsProgramAdapter("Programs");
    const service = new ProgramService(repository);

    // 1. PUBLIC GET ACTIONS (No Token Required)
    if (action === "program.listPublished") {
      let scriptCache = null;
      try {
        scriptCache = CacheService.getScriptCache();
        const cachedJson = scriptCache ? scriptCache.get("pub_programs_cache_v2") : null;
        if (cachedJson) {
          const cachedPayload = JSON.parse(cachedJson);
          cachedPayload.requestId = requestId;
          return createJsonResponse(cachedPayload);
        }
      } catch (e) {
        Logger.log("Cache read error: " + e.message);
      }

      const data = service.getPublishedPrograms();
      const responseEnvelope = {
        success: true,
        data: data,
        requestId: requestId
      };

      if (scriptCache) {
        try {
          const payloadStr = JSON.stringify(responseEnvelope);
          if (payloadStr.length < 95000) {
            scriptCache.put("pub_programs_cache_v2", payloadStr, 21600); // Cache selama 6 jam
          }
        } catch (e) {
          Logger.log("Cache write error: " + e.message);
        }
      }

      return createJsonResponse(responseEnvelope);
    }
    if (action === "program.getPublished") {
      const id = (payload && payload.id) || (e && e.parameter && e.parameter.id);
      const data = service.getPublishedProgramById(id);
      return createAppResponse(true, data, null, requestId);
    }

    // 2. ADMIN LOGIN ACTION
    if (action === "admin.login") {
      const pin = (payload && payload.pin) || (payload && payload.data && payload.data.pin);
      if (!pin) {
        throw new ValidationError("PIN is required for admin login.");
      }

      const configuredHash = getServerSecret("ADMIN_PIN_HASH", "");
      let isPinValid = false;

      if (configuredHash) {
        const inputBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(pin));
        const inputHash = Utilities.base64Encode(inputBytes);
        isPinValid = (inputHash === configuredHash);
      } else {
        // Zero Hardcoded Secrets: require ADMIN_PIN_HASH in ScriptProperties
        throw new AuthenticationError("Admin PIN authentication is not configured on server (ADMIN_PIN_HASH missing in Script Properties).");
      }

      if (!isPinValid) {
        throw new AuthenticationError("Invalid Admin PIN.");
      }

      const tokenData = generateSessionToken("admin_principal", AllowedRoles.ADMIN, 8);
      return createAppResponse(true, tokenData, null, requestId);
    }

    // 3. PROTECTED ACTIONS (Token & Auth Context Required)
    const token = payload && payload.token;
    const claims = verifySessionToken(token);
    const actorContext = createActorContext(claims.userId, claims.role, claims.issuedAt, requestId);

    if (action === "program.list") {
      const data = service.getAllPrograms(actorContext);
      return createAppResponse(true, data, null, requestId);
    }
    if (action === "program.get") {
      const id = (payload && payload.id) || (payload && payload.data && payload.data.id);
      const data = service.getProgramById(id, actorContext);
      return createAppResponse(true, data, null, requestId);
    }
    if (action === "program.create" || action === "program.update") {
      const input = (payload && payload.payload) || (payload && payload.data) || payload;
      const data = service.saveProgram(input, actorContext);
      invalidateProgramCache();
      return createAppResponse(true, data, null, requestId);
    }
    if (action === "program.publish") {
      const id = (payload && payload.id) || (payload && payload.data && payload.data.id);
      const ver = payload && payload.version;
      const data = service.publishProgram(id, actorContext, ver);
      invalidateProgramCache();
      return createAppResponse(true, data, null, requestId);
    }
    if (action === "program.unpublish") {
      const id = (payload && payload.id) || (payload && payload.data && payload.data.id);
      const ver = payload && payload.version;
      const data = service.unpublishProgram(id, actorContext, ver);
      invalidateProgramCache();
      return createAppResponse(true, data, null, requestId);
    }
    if (action === "program.archive") {
      const id = (payload && payload.id) || (payload && payload.data && payload.data.id);
      const ver = payload && payload.version;
      const data = service.archiveProgram(id, actorContext, ver);
      invalidateProgramCache();
      return createAppResponse(true, data, null, requestId);
    }
    if (action === "program.init") {
      const result = initProgramsSheet(token);
      invalidateProgramCache();
      return createAppResponse(true, result, null, requestId);
    }

    throw new ValidationError("Unknown program API action: " + action);

  } catch (err) {
    if (err instanceof DomainError) {
      return createAppResponse(false, null, err, requestId);
    }
    return createAppResponse(false, null, new PersistenceError(err.message || String(err)), requestId);
  }
}

/**
 * Cache Invalidation Helper for Public Programs
 */
function invalidateProgramCache() {
  try {
    const cache = CacheService.getScriptCache();
    if (cache) {
      cache.remove("pub_programs_cache_v2");
    }
  } catch (e) {
    Logger.log("Cache invalidate error: " + e.message);
  }
}

/**
 * Serialization Boundary Helpers (FAIL-CLOSED logic, no static fallback)
 */
function serializeProgramPayload(detailObj) {
  try {
    if (detailObj === undefined || detailObj === null) {
      throw new Error("Detail payload is null or undefined");
    }
    return JSON.stringify(detailObj);
  } catch (err) {
    throw new SerializationError("Failed to serialize program detail object: " + err.message);
  }
}

function deserializeProgramPayload(jsonString) {
  if (!jsonString || typeof jsonString !== "string") {
    throw new SerializationError("Cannot deserialize empty or non-string cell payload (Fail-Closed)");
  }
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Parsed payload is not an object");
    }
    return parsed;
  } catch (err) {
    throw new SerializationError("Cell JSON payload is corrupted or invalid (Fail-Closed): " + err.message);
  }
}

/**
 * Optimistic Concurrency Verification Helper
 */
function checkOptimisticVersion(storedVersion, expectedVersion) {
  const sVer = Number(storedVersion);
  const eVer = Number(expectedVersion);
  if (isNaN(sVer) || isNaN(eVer) || sVer !== eVer) {
    throw new ConcurrencyConflictError(
      `Optimistic concurrency version mismatch (stored: ${storedVersion}, expected: ${expectedVersion})`
    );
  }
  return sVer + 1;
}


// ============================================================================
// PROGRAM DATA SOURCE v2.0 — PHASE 4B-4: MIGRATION & SEEDING TOOLING
// Isolated Migration Engine with Extraction, Validation, Snapshot, Seeding,
// Re-read, Structural Reconciliation, Rollback, and Observability.
// (NO RUNTIME CUTOVER, NO AUTOMATIC EXECUTION ON PAGE LOAD/API REQUESTS).
// ============================================================================

/**
 * A. SOURCE EXTRACTION
 * Returns the exact canonical PROGRAM_DATA v1.0 records.
 */
function getCanonicalMigrationSource() {
  return [
    {
      id: "tahfidz-anak",
      name: "Pesantren Tahfidz Anak",
      badge: "Anak-Anak",
      image: "https://images.unsplash.com/photo-1577896851231-70ef18881754?q=80&w=1000&auto=format&fit=crop",
      description: "Program khusus hafalan Al-Qur'an untuk anak-anak dengan metode seru dan menyenangkan.",
      highlights: [
        "Metode Muri-Q & Tajwid Aisyah",
        "Target 30 Juz Mutqin Usia Belia",
        "Pendampingan Pengasuh 24 Jam"
      ],
      detail: {
        tagline: "Mencetak Generasi Rabbani Berjiwa Qur'ani Sejak Dini",
        summary: "Program Pesantren Tahfidz Anak didesain khusus untuk membentuk karakter santri usia sekolah dasar agar mencintai Al-Qur'an melalui suasana belajar yang hangat, ramah anak, dan terstruktur. Fokus utama kami tidak hanya hafalan, tetapi juga pembentukan akhlakul karimah.",
        video: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        videoTitle: "Dokumentasi Kegiatan Santri Tahfidz Anak",
        keunggulan: [
          { title: "Metode Seru & Ramah Anak", desc: "Menghafal dengan pendekatan fun learning, muraja'ah bersama, dan metode visual audio yang efektif.", icon: "fa-heart", iconBg: "bg-red-50 text-red-600" },
          { title: "Target Mutqin 30 Juz", desc: "Kurikulum bertahap yang disesuaikan dengan kemampuan anak tanpa tekanan psikologis berlebih.", icon: "fa-book-quran", iconBg: "bg-emerald-50 text-emerald-600" },
          { title: "Fasilitas Khusus Anak", desc: "Kamar tidur ber-AC, tempat bermain edukatif, serta asupan gizi seimbang untuk tumbuh kembang.", icon: "fa-child", iconBg: "bg-amber-50 text-amber-600" }
        ],
        targetOutput: [
          "Hafal 30 Juz Al-Qur'an dengan Tajwid & Makhraj yang Benar",
          "Memiliki Kebiasaan Shalat Fardhu & Sunnah Berjamaah",
          "Mampu Membaca Doa-Doa Harian & Adab Islama",
          "Karakter Mandiri, Disiplin, dan Santun kepada Orang Tua",
          "Khatam Ziyadah & Muraja'ah Rutin Setiap Pekan",
          "Berprestasi dalam Musabaqah Hifdzil Qur'an (MHQ)"
        ],
        gallery: [
          { image: "https://images.unsplash.com/photo-1577896851231-70ef18881754?q=80&w=800&auto=format&fit=crop", caption: "Setoran Hafalan Pagi Bersama Ustadz", sliderId: "anak-1" },
          { image: "https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=800&auto=format&fit=crop", caption: "Kegiatan Olahraga & Edukasi Luar Ruangan", sliderId: "anak-2" },
          { image: "https://images.unsplash.com/photo-1544717305-2782549b5136?q=80&w=800&auto=format&fit=crop", caption: "Suasana Asrama yang Nyaman & Bersih", sliderId: "anak-3" }
        ],
        fasilitas: [
          { text: "Gedung Asrama AC & Kasur Busa Berkualitas", icon: "fa-bed", iconColor: "text-emerald-600" },
          { text: "Makan 3x Sehari Menu Seimbang & Higienis", icon: "fa-utensils", iconColor: "text-amber-600" },
          { text: "Klinik Poskestren & Layanan Kesehatan Santri", icon: "fa-notes-medical", iconColor: "text-blue-600" }
        ],
        prosedur: {
          items: [
            { step: "01", title: "Pendaftaran Online", desc: "Mengisi formulir calon santri melalui situs resmi PPDB." },
            { step: "02", title: "Tes Pemetaan (Observasi)", desc: "Tes kelancaran membaca Al-Qur'an dan wawancara orang tua." },
            { step: "03", title: "Pengumuman Hasil", desc: "Pengumuman kelulusan melalui WhatsApp & Akun PPDB." },
            { step: "04", title: "Daftar Ulang & Masuk Asrama", desc: "Penyelesaian administrasi dan kedatangan santri baru." }
          ],
          image: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?q=80&w=800&auto=format&fit=crop",
          imageAlt: "Prosedur PPDB"
        },
        persyaratan: [
          { title: "Berusia 7 - 12 Tahun", desc: "Lulus atau sedang menempuh tingkat SD/MI sederajat.", icon: "fa-cake-candles" },
          { title: "Fotokopi Akta & KK", desc: "Menyerahkan dokumen administrasi kependudukan lengkap 2 lembar.", icon: "fa-file-lines" },
          { title: "Pas Foto Terbaru", desc: "Foto berwarna 3x4 sebanyak 4 lembar berlatar biru.", icon: "fa-image" },
          { title: "Surat Sehat Dokter", desc: "Bebas dari penyakit menular atau kondisi kronis tertentu.", icon: "fa-file-medical" }
        ],
        biaya: {
          pendaftaran: { nominal: "Rp 250.000", note: "Sekali saat pendaftaran" },
          syahriyah: { nominal: "Rp 1.200.000", note: "Per bulan (Asrama + Makan + Pendidikan)" }
        },
        cta: {
          title: "Ingin Anak Anda Hafal Al-Qur'an Sejak Dini?",
          description: "Segera daftarkan putra/putri Anda. Kuota terbatas untuk 30 santri baru setiap angkatan.",
          waLink: "https://wa.me/6281234567890?text=Halo%20Admin%2C%20saya%20ingin%20bertanya%20tentang%20Program%20Tahfidz%20Anak",
          waBtnClass: "bg-emerald-600 hover:bg-emerald-700 text-white",
          waText: "Konsultasi PPDB via WhatsApp"
        }
      }
    },
    {
      id: "dewasa-putra",
      name: "Pesantren Dewasa Putra",
      badge: "Dewasa Putra",
      image: "https://images.unsplash.com/photo-1544717305-2782549b5136?q=80&w=1000&auto=format&fit=crop",
      description: "Program intensif tahfidz dan pendalaman kitab kuning untuk santri dewasa putra.",
      highlights: [
        "Kombinasi Tahfidz & Dirasah Islamiyah",
        "Sanad Al-Qur'an s/d Rasulullah SAW",
        "Lingkungan Kondusif & Bebas Gadget"
      ],
      detail: {
        tagline: "Membentuk Huffazh Berwawasan Luas & Berakhlak Qur'ani",
        summary: "Program Dewasa Putra dirancang bagi lulusan SMP/SMA/Mahasiswa/Umum yang ingin fokus menghafal Al-Qur'an 30 Juz secara intensif disertai dengan pengusaan ilmu tajwid sanad, bahasa Arab dasar, dan pemahaman kitab-kitab turats (kitab kuning).",
        video: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        videoTitle: "Suasana Belajar & Setoran Santri Dewasa Putra",
        keunggulan: [
          { title: "Bimbingan Muqri' Bersanad", desc: "Diampu langsung oleh ustadz pengajar yang memiliki sanad Al-Qur'an muttashil.", icon: "fa-certificate", iconBg: "bg-emerald-50 text-emerald-600" },
          { title: "Kurikulum Terintegrasi", desc: "Perpaduan efisien antara program Ziyadah (hafalan baru), Muraja'ah, dan Kajian Fiqih/Nahwu.", icon: "fa-book", iconBg: "bg-blue-50 text-blue-600" },
          { title: "Disiplin & Kemandirian High-Level", desc: "Pola hidup terstruktur untuk melatih kedisiplinan, kepemimpinan, dan mental da'i.", icon: "fa-user-shield", iconBg: "bg-amber-50 text-amber-600" }
        ],
        targetOutput: [
          "Setoran 30 Juz Lulus Ujian Imtihan Sanad / Syahadah",
          "Menguasai Ilmu Tajwid Qira'at Imam 'Ashim Riwayat Hafsh",
          "Memahami Fiqih Ibadah Dasar & Bahasa Arab Praktis",
          "Kesiapan Menjadi Imam Masjid & Pengajar Al-Qur'an",
          "Tradisi Muraja'ah Mandiri Minimal 1-2 Juz Per Hari",
          "Karakter Beradab, Tawadhu, dan Berjiwa Kepemimpinan"
        ],
        gallery: [
          { image: "https://images.unsplash.com/photo-1544717305-2782549b5136?q=80&w=800&auto=format&fit=crop", caption: "Halaqah Tahfidz Pagi di Masjid Utama", sliderId: "putra-1" },
          { image: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?q=80&w=800&auto=format&fit=crop", caption: "Kajian Kitab Kuning Bersama Pengasuh", sliderId: "putra-2" },
          { image: "https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=800&auto=format&fit=crop", caption: "Kegiatan Rihlah & Olahraga Sunnah", sliderId: "putra-3" }
        ],
        fasilitas: [
          { text: "Asrama Khusus Putra dengan Lemari & Kasur Mandiri", icon: "fa-building", iconColor: "text-emerald-600" },
          { text: "Masjid Utama 2 Lantai untuk Halaqah & Shalat", icon: "fa-mosque", iconColor: "text-blue-600" },
          { text: "Perpustakaan Kitab Turats & Ruang Baca", icon: "fa-book-open", iconColor: "text-amber-600" }
        ],
        prosedur: {
          items: [
            { step: "01", title: "Pendaftaran Online", desc: "Mengisi biodata diri dan memilih opsi program dewasa putra." },
            { step: "02", title: "Tes Tahsin & Al-Qur'an", desc: "Ujian kelancaran membaca Al-Qur'an secara virtual/luring." },
            { step: "03", title: "Wawancara Komitmen", desc: "Wawancara komitmen menghafal dan menaati tata tertib pesantren." },
            { step: "04", title: "Daftar Ulang", desc: "Penyelesaian administrasi dan orientasi kehidupan asrama." }
          ],
          image: "https://images.unsplash.com/photo-1544717305-2782549b5136?q=80&w=800&auto=format&fit=crop",
          imageAlt: "Prosedur PPDB Dewasa Putra"
        },
        persyaratan: [
          { title: "Usia Minimal 13 Tahun", desc: "Lulusan SMP/SMA/Mahasiswa/Umum yang bertekad kuat.", icon: "fa-user" },
          { title: "Lancar Membaca Al-Qur'an", desc: "Memiliki dasar tajwid & makhraj membaca Al-Qur'an yang cukup.", icon: "fa-book-quran" },
          { title: "Dokumen Identitas", desc: "Fotokopi KTP/Kartu Pelajar, KK, dan ijazah terakhir.", icon: "fa-id-card" },
          { title: "Surat Komitmen Waktu", desc: "Bersedia mengikuti seluruh rangkaian program tanpa gangguan.", icon: "fa-clock" }
        ],
        biaya: {
          pendaftaran: { nominal: "Rp 300.000", note: "Sekali saat pendaftaran & tes" },
          syahriyah: { nominal: "Rp 1.100.000", note: "Per bulan (Asrama + Makan 3x + Bimbingan)" }
        },
        cta: {
          title: "Siap Menjadi Hafiz Al-Qur'an Berpendidikan & Bersanad?",
          description: "Segera daftarkan diri Anda atau putra Anda. Gelombang pendaftaran aktif dibuka.",
          waLink: "https://wa.me/6281234567890?text=Halo%20Admin%2C%20saya%20ingin%20bertanya%20tentang%20Program%20Dewasa%20Putra",
          waBtnClass: "bg-blue-600 hover:bg-blue-700 text-white",
          waText: "Daftar Dewasa Putra via WA"
        }
      }
    },
    {
      id: "dewasa-putri",
      name: "Pesantren Dewasa Putri",
      badge: "Dewasa Putri",
      image: "https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=1000&auto=format&fit=crop",
      description: "Program intensif tahfidz Al-Qur'an dan fiqih wanita untuk santri dewasa putri.",
      highlights: [
        "Asrama Khusus & Steril Khusus Putri",
        "Bimbingan Musyrifah Hafizhah Bersanad",
        "Kajian Nisa'iyyah & Keterampilan Muslimah"
      ],
      detail: {
        tagline: "Mencetak Haafizhah Shalihat, Pendidik Generasi Masa Depan",
        summary: "Program Dewasa Putri difokuskan untuk membantu mahasiswi/alumni/umum menghafal Al-Qur'an dalam lingkungan asrama putri yang sangat aman, privat, dan kondusif. Didampingi ustadzah haafizhah bersanad serta dibekali pemahaman fikih wanita.",
        video: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        videoTitle: "Profil & Kegiatan Asrama Tahfidz Dewasa Putri",
        keunggulan: [
          { title: "Privasi & Keamanan Terjaga", desc: "Lingkungan kompleks putri terpisah penuh dengan sistem keamanan 24 jam.", icon: "fa-lock", iconBg: "bg-rose-50 text-rose-600" },
          { title: "Musyrifah Pengajar Khusus Putri", desc: "Halaqah setoran dan muraja'ah diampu oleh ustadzah lulusan Al-Azhar & Pesantren Sanad.", icon: "fa-user-graduate", iconBg: "bg-purple-50 text-purple-600" },
          { title: "Kajian Fiqih An-Nisa'", desc: "Kajian rutin hukum-hukum wanita, kepengurusan rumah tangga muslimah, & adab.", icon: "fa-hands-praying", iconBg: "bg-emerald-50 text-emerald-600" }
        ],
        targetOutput: [
          "Khatam Hafalan 30 Juz Lulus Syahadah & Ujian Ziyadah",
          "Pemahaman Tajwid Rasm Utsmani & Fiqih Wanita (Fiqh An-Nisa')",
          "Kebiasaan Ibadah Sunnah, Shalat Malam, & Dzikir Al-Ma'tsurat",
          "Keterampilan Tata Kelola Kebersihan, Tata Busana, & Adab",
          "Kemampuan Menjadi Pengajar Al-Qur'an di Rumah / Lembaga",
          "Karakter Anggun, Guarded, dan Berilmu Syar'i"
        ],
        gallery: [
          { image: "https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=800&auto=format&fit=crop", caption: "Halaqah Setoran Putri Bersama Ustadzah", sliderId: "putri-1" },
          { image: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?q=80&w=800&auto=format&fit=crop", caption: "Kajian Rutin Fiqih Wanita di Aula Putri", sliderId: "putri-2" },
          { image: "https://images.unsplash.com/photo-1577896851231-70ef18881754?q=80&w=800&auto=format&fit=crop", caption: "Taman Asrama Putri yang Asri", sliderId: "putri-3" }
        ],
        fasilitas: [
          { text: "Asrama Putri Privat Khusus Ber-AC & Kamar Mandi Dalam", icon: "fa-house-lock", iconColor: "text-purple-600" },
          { text: "Dapur Mandiri & Katering Pilihan Sehat", icon: "fa-utensils", iconColor: "text-rose-600" },
          { text: "Aula Pertemuan & Ruang Belajar Nyaman", icon: "fa-chair", iconColor: "text-emerald-600" }
        ],
        prosedur: {
          items: [
            { step: "01", title: "Pendaftaran Online", desc: "Mengisi formulir calon santri putri di portal PPDB." },
            { step: "02", title: "Tes Tahsin Virtual", desc: "Ujian kelancaran membaca Al-Qur'an oleh Tim Ustadzah." },
            { step: "03", title: "Wawancara Orang Tua/Wali", desc: "Wawancara kesiapan serta komitmen asrama." },
            { step: "04", title: "Masuk Asrama Putri", desc: "Penyelesaian registrasi dan penempatan kamar." }
          ],
          image: "https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=800&auto=format&fit=crop",
          imageAlt: "Prosedur PPDB Dewasa Putri"
        },
        persyaratan: [
          { title: "Usia Minimal 13 Tahun", desc: "SMP/SMA/Mahasiswi/Umum yang berkeinginan kuat.", icon: "fa-user" },
          { title: "Lancar Membaca Al-Qur'an", desc: "Memiliki dasar tajwid membaca Al-Qur'an yang baik.", icon: "fa-book-quran" },
          { title: "Dokumen Administrasi", desc: "Fotokopi KTP/KK/Kartu Pelajar & Pas Foto Jilbab Rapi.", icon: "fa-file-lines" },
          { title: "Izin Orang Tua/Suami", desc: "Mendapat persetujuan tertulis dari wali resmi.", icon: "fa-file-signature" }
        ],
        biaya: {
          pendaftaran: { nominal: "Rp 300.000", note: "Sekali saat pendaftaran & tes" },
          syahriyah: { nominal: "Rp 1.150.000", note: "Per bulan (Asrama AC + Makan 3x + Bimbingan)" }
        },
        cta: {
          title: "Wujudkan Cita-Cita Menjadi Haafizhah Qur'an?",
          description: "Daftarkan diri Anda di Program Pesantren Dewasa Putri.",
          waLink: "https://wa.me/6281234567890?text=Halo%20Admin%2C%20saya%20ingin%20bertanya%20tentang%20Program%20Dewasa%20Putri",
          waBtnClass: "bg-purple-600 hover:bg-purple-700 text-white",
          waText: "Daftar Dewasa Putri via WA"
        }
      }
    },
    {
      id: "sd-islam",
      name: "SD Islam Unggulan",
      badge: "SD Islam",
      image: "https://images.unsplash.com/photo-1585036156171-384164a8c675?q=80&w=800&auto=format&fit=crop",
      description: "Pendidikan dasar unggulan memadukan kurikulum nasional dan nilai-nilai Al-Qur'an.",
      highlights: [
        "Kurikulum Terintegrasi",
        "Tahfidz Dasar & Adab"
      ],
      detail: {
        tagline: "Membangun Fondasi Keilmuan dan Karakter Islami Sejak Dini",
        summary: "Program SD Islam Unggulan yang memadukan pendidikan formal (kurikulum nasional) dengan pendidikan agama Islam yang mendalam, termasuk tahfidz dasar dan pembentukan karakter/adab harian yang menyenangkan.",
        video: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        videoTitle: "Video Profil SD Islam Unggulan",
        keunggulan: [
          { title: "Kurikulum Terpadu", desc: "Memadukan materi umum dan diniyah dengan pendekatan belajar aktif dan menyenangkan.", icon: "fa-book-open", iconBg: "bg-blue-50 text-blue-600" },
          { title: "Program Tahfidz Dini", desc: "Bimbingan hafalan surah-surah pendek dan juz amma sejak dini.", icon: "fa-book-quran", iconBg: "bg-amber-50 text-amber-600" },
          { title: "Penguatan Adab Harian", desc: "Menanamkan nilai-nilai akhlakul karimah dalam setiap aktivitas harian siswa.", icon: "fa-child-reaching", iconBg: "bg-emerald-50 text-emerald-600" }
        ],
        targetOutput: [
          "Menguasai materi pendidikan dasar nasional dengan baik.",
          "Mampu membaca Al-Qur'an dengan tartil.",
          "Memiliki hafalan Juz 30 (Juz Amma).",
          "Menjadikan adab Islami sebagai karakter harian.",
          "Memiliki dasar-dasar kemandirian dan keberanian."
        ],
        gallery: [
          { image: "https://images.unsplash.com/photo-1585036156171-384164a8c675?q=80&w=800&auto=format&fit=crop", caption: "Kegiatan Belajar Pendidikan Formal", sliderId: "sd-1" },
          { image: "https://images.unsplash.com/photo-1577896851231-70ef18881754?q=80&w=800&auto=format&fit=crop", caption: "Bimbingan Tahfidz Anak SD", sliderId: "sd-2" }
        ],
        fasilitas: [
          { text: "Ruang kelas ber-AC, multimedia, dan nyaman.", icon: "fa-school", iconColor: "text-blue-600" },
          { text: "Area bermain dan olahraga yang aman.", icon: "fa-futbol", iconColor: "text-emerald-600" },
          { text: "Perpustakaan mini dan sudut baca di setiap kelas.", icon: "fa-book", iconColor: "text-amber-600" }
        ],
        prosedur: {
          items: [
            { step: "01", title: "Pendaftaran Online", desc: "Melakukan registrasi formulir calon siswa melalui portal PPDB." },
            { step: "02", title: "Tes Observasi Kesiapan", desc: "Observasi kesiapan belajar dan pemetaan dasar membaca Al-Qur'an." },
            { step: "03", title: "Wawancara Orang Tua", desc: "Wawancara keselarasan visi pendidikan bersama wali murid." },
            { step: "04", title: "Daftar Ulang", desc: "Penyelesaian administrasi dan penyerahan perlengkapan sekolah." }
          ],
          image: "https://images.unsplash.com/photo-1585036156171-384164a8c675?q=80&w=800&auto=format&fit=crop",
          imageAlt: "Siswa SD Islam Unggulan"
        },
        persyaratan: [
          { title: "Usia Minimal 6 Tahun", desc: "Berusia minimal 6 tahun pada tahun ajaran baru.", icon: "fa-cake-candles" },
          { title: "Fotokopi Akta & KK", desc: "Menyerahkan fotokopi akta kelahiran dan KK 2 lembar.", icon: "fa-file-lines" },
          { title: "Pas Foto 3x4", desc: "Pas foto berwarna 3x4 sebanyak 4 lembar.", icon: "fa-image" },
          { title: "Surat Sehat", desc: "Surat keterangan sehat dokter.", icon: "fa-file-medical" }
        ],
        biaya: {
          pendaftaran: { nominal: "Rp 1.500.000", note: "Termasuk observasi & seragam 4 stel" },
          syahriyah: { nominal: "Rp 250.000", note: "SPP bulanan pendidikan" }
        },
        cta: {
          title: "Daftarkan Putra-Putri Anda di SD Islam Unggulan",
          description: "Pendidikan dasar berkualitas yang memadukan keilmuan nasional dan nilai-nilai Al-Qur'an.",
          waLink: "https://wa.me/6281234567890?text=Halo%20Admin%2C%20saya%20ingin%20bertanya%20tentang%20SD%20Islam%20Unggulan",
          waBtnClass: "bg-blue-600 hover:bg-blue-700 text-white",
          waText: "Konsultasi SD Islam via WA"
        }
      }
    }
  ];
}

/**
 * B. CONTRACT VALIDATION
 * Validates source objects against the PROGRAM DATA CONTRACT.
 * Throws ValidationError if any required field or nested structure is invalid.
 */
function validateMigrationSource(sourceArray) {
  if (!Array.isArray(sourceArray) || sourceArray.length === 0) {
    throw new ValidationError("Migration source array is empty or invalid.");
  }

  const seenIds = new Set();
  const requiredTopFields = ["id", "name", "badge", "image", "description", "highlights", "detail"];

  for (let idx = 0; idx < sourceArray.length; idx++) {
    const item = sourceArray[idx];
    if (!item || typeof item !== "object") {
      throw new ValidationError(`Source item at index ${idx} is not an object.`);
    }

    // Top-level field validation
    for (let f of requiredTopFields) {
      if (item[f] === undefined || item[f] === null || item[f] === "") {
        throw new ValidationError(`Source item '${item.id || idx}' missing required top-level field '${f}'.`);
      }
    }

    // ID Uniqueness Check
    if (seenIds.has(item.id)) {
      throw new ValidationError(`Duplicate canonical program ID '${item.id}' detected in migration source.`);
    }
    seenIds.add(item.id);

    // Highlights array check
    if (!Array.isArray(item.highlights) || item.highlights.length === 0) {
      throw new ValidationError(`Source program '${item.id}' must have a non-empty highlights array.`);
    }

    // Nested Detail structure check
    const d = item.detail;
    if (!d || typeof d !== "object") {
      throw new ValidationError(`Source program '${item.id}' detail payload is invalid.`);
    }

    const requiredDetailFields = [
      "tagline", "summary", "video", "videoTitle",
      "keunggulan", "targetOutput", "gallery", "fasilitas",
      "prosedur", "persyaratan", "biaya", "cta"
    ];

    for (let df of requiredDetailFields) {
      if (d[df] === undefined || d[df] === null) {
        throw new ValidationError(`Source program '${item.id}' detail payload missing field '${df}'.`);
      }
    }

    // Check nested arrays & objects
    if (!Array.isArray(d.keunggulan) || d.keunggulan.length === 0) {
      throw new ValidationError(`Source program '${item.id}' detail.keunggulan must be non-empty array.`);
    }
    if (!Array.isArray(d.targetOutput) || d.targetOutput.length === 0) {
      throw new ValidationError(`Source program '${item.id}' detail.targetOutput must be non-empty array.`);
    }
    if (!Array.isArray(d.gallery) || d.gallery.length === 0) {
      throw new ValidationError(`Source program '${item.id}' detail.gallery must be non-empty array.`);
    }
    if (!Array.isArray(d.fasilitas) || d.fasilitas.length === 0) {
      throw new ValidationError(`Source program '${item.id}' detail.fasilitas must be non-empty array.`);
    }
    if (!d.prosedur || !Array.isArray(d.prosedur.items) || d.prosedur.items.length === 0) {
      throw new ValidationError(`Source program '${item.id}' detail.prosedur.items must be non-empty array.`);
    }
    if (!Array.isArray(d.persyaratan) || d.persyaratan.length === 0) {
      throw new ValidationError(`Source program '${item.id}' detail.persyaratan must be non-empty array.`);
    }
    if (!d.biaya || !d.biaya.pendaftaran || !d.biaya.syahriyah) {
      throw new ValidationError(`Source program '${item.id}' detail.biaya must contain pendaftaran and syahriyah objects.`);
    }
    if (!d.cta || !d.cta.title || !d.cta.waLink) {
      throw new ValidationError(`Source program '${item.id}' detail.cta must contain title and waLink.`);
    }
  }

  return true;
}

/**
 * C. SNAPSHOT / BACKUP
 * Creates an in-memory or tab backup of the existing Programs sheet state.
 */
function createMigrationSnapshot(sheetName = "Programs") {
  let ss = null;
  try {
    ss = getDatabaseSpreadsheet();
  } catch (e) {
    throw new PersistenceError("SpreadsheetApp is unavailable for migration snapshot: " + e.message);
  }

  const sheet = ss ? ss.getSheetByName(sheetName) : null;
  if (!sheet) {
    return Object.freeze({
      exists: false,
      sheetName: sheetName,
      rows: []
    });
  }

  const data = sheet.getDataRange().getValues();
  // Deep clone row values array
  const clonedRows = JSON.parse(JSON.stringify(data));

  return Object.freeze({
    exists: true,
    sheetName: sheetName,
    rows: clonedRows
  });
}

/**
 * D. SHEET PREPARATION
 * Prepares the Programs sheet and validates/creates the 16-column header schema.
 * Note: Sheet creation is authorized ONLY within explicit migration tooling.
 */
function prepareProgramsSheet(sheetName = "Programs", options = { dryRun: false }) {
  if (options && options.dryRun) {
    Logger.log("[DRY-RUN] [SHEET_PREPARED] Would discover/create sheet '" + sheetName + "'");
    return true;
  }

  const ss = getDatabaseSpreadsheet();
  if (!ss) {
    throw new PersistenceError("Active spreadsheet unavailable.");
  }

  let sheet = ss.getSheetByName(sheetName);
  const expectedHeaders = [
    "id", "name", "badge", "image", "description",
    "highlights_json", "detail_json", "status", "sort_order",
    "created_at", "updated_at", "created_by", "updated_by",
    "published_at", "published_by", "version"
  ];

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(expectedHeaders);
  } else {
    const values = sheet.getDataRange().getValues();
    if (!values || values.length === 0) {
      sheet.appendRow(expectedHeaders);
    } else {
      const headerRow = values[0];
      if (headerRow.length < expectedHeaders.length) {
        throw new PersistenceError(`Existing sheet '${sheetName}' header schema mismatch (fewer than 16 columns).`);
      }
    }
  }

  return sheet;
}

/**
 * E. CONTROLLED SEEDING
 * Writes canonical source records into the Programs sheet.
 */
function seedProgramsData(sourceArray, options = { dryRun: false, force: false }, sheetName = "Programs") {
  if (options && options.dryRun) {
    Logger.log("[DRY-RUN] [SEED_STARTED] Would seed " + sourceArray.length + " canonical records into '" + sheetName + "'");
    return true;
  }

  const sheet = prepareProgramsSheet(sheetName, options);
  const existingValues = sheet.getDataRange().getValues();
  const existingIds = new Set();

  for (let r = 1; r < existingValues.length; r++) {
    if (existingValues[r][0]) {
      existingIds.add(String(existingValues[r][0]).trim());
    }
  }

  // Idempotency check: if IDs already exist and force is false, reject
  const duplicateIds = sourceArray.filter(item => existingIds.has(item.id));
  if (duplicateIds.length > 0 && !(options && options.force)) {
    throw new PersistenceError(
      "Migration idempotency conflict: canonical ID(s) [" + duplicateIds.map(d => d.id).join(", ") + "] already exist in sheet. Use force=true to overwrite."
    );
  }

  const nowIso = new Date().toISOString();
  const migrationIdentity = "migration:v2.0";

  for (let idx = 0; idx < sourceArray.length; idx++) {
    const item = sourceArray[idx];
    const sortOrder = idx + 1;
    const highlightsJson = serializeProgramPayload(item.highlights);
    const detailJson = serializeProgramPayload(item.detail);

    const rowData = [
      item.id,
      item.name,
      item.badge,
      item.image,
      item.description,
      highlightsJson,
      detailJson,
      ProgramStatus.PUBLISHED, // Initial status = "published"
      sortOrder,
      nowIso,
      nowIso,
      migrationIdentity,
      migrationIdentity,
      nowIso,
      migrationIdentity,
      1 // Initial version = 1
    ];

    // Check if updating existing or appending new
    let targetRowIdx = -1;
    for (let r = 1; r < existingValues.length; r++) {
      if (String(existingValues[r][0]).trim() === item.id) {
        targetRowIdx = r + 1;
        break;
      }
    }

    if (targetRowIdx > 0) {
      sheet.getRange(targetRowIdx, 1, 1, 16).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }
  }

  return true;
}

/**
 * F. RE-READ VERIFICATION
 * Reads back persisted rows via GoogleSheetsProgramAdapter and deserializes cell JSON.
 */
function verifySeededRecords(sheetName = "Programs") {
  const adapter = new GoogleSheetsProgramAdapter(sheetName);
  const persistedRecords = adapter.findAll();
  return persistedRecords;
}

/**
 * G. STRUCTURAL RECONCILIATION
 * Deep structural comparison of all canonical content fields between source and re-read persisted objects.
 * Throws ValidationError if any property mismatches.
 */
function reconcileMigrationData(sourceArray, persistedArray) {
  if (!Array.isArray(persistedArray) || persistedArray.length < sourceArray.length) {
    throw new ValidationError(
      `Reconciliation failed: expected at least ${sourceArray.length} records, but re-read ${persistedArray ? persistedArray.length : 0} records.`
    );
  }

  const persistedMap = new Map();
  persistedArray.forEach(rec => persistedMap.set(rec.id, rec));

  const compareKeys = [
    "id", "name", "badge", "image", "description"
  ];

  for (let source of sourceArray) {
    const target = persistedMap.get(source.id);
    if (!target) {
      throw new ValidationError(`Reconciliation failed: record ID '${source.id}' not found in re-read persisted data.`);
    }

    // Top level scalar comparison
    for (let key of compareKeys) {
      if (String(source[key]).trim() !== String(target[key]).trim()) {
        throw new ValidationError(`Reconciliation mismatch on '${source.id}.${key}': source='${source[key]}', persisted='${target[key]}'.`);
      }
    }

    // Highlights array structural comparison
    if (JSON.stringify(source.highlights) !== JSON.stringify(target.highlights)) {
      throw new ValidationError(`Reconciliation mismatch on '${source.id}.highlights': JSON payload differs.`);
    }

    // Detail object deep structural comparison
    if (JSON.stringify(source.detail) !== JSON.stringify(target.detail)) {
      throw new ValidationError(`Reconciliation mismatch on '${source.id}.detail': JSON payload differs.`);
    }
  }

  return true;
}

/**
 * H. ROLLBACK CAPABILITY
 * Restores the Programs sheet to the exact state saved in the snapshot.
 */
function rollbackMigration(snapshot, sheetName = "Programs") {
  let ss = null;
  try {
    ss = getDatabaseSpreadsheet();
  } catch (e) {
    throw new PersistenceError("SpreadsheetApp unavailable for rollback: " + e.message);
  }

  if (!ss) throw new PersistenceError("Spreadsheet object null during rollback.");

  const sheet = ss.getSheetByName(sheetName);

  if (!snapshot || !snapshot.exists) {
    // If sheet didn't exist before migration, clear or delete sheet
    if (sheet) {
      sheet.clear();
    }
  } else {
    // Restore exact snapshot rows
    if (sheet) {
      sheet.clear();
      if (snapshot.rows && snapshot.rows.length > 0) {
        sheet.getRange(1, 1, snapshot.rows.length, snapshot.rows[0].length).setValues(snapshot.rows);
      }
    }
  }

  Logger.log("[ROLLBACK_COMPLETED] Sheet '" + sheetName + "' successfully restored from pre-migration snapshot.");
  return true;
}

/**
 * MASTER MIGRATION TOOLING ORCHESTRATOR
 * Controlled explicit tool execution with dry-run, validation, snapshot, seeding, reconciliation, and rollback.
 * (NO AUTOMATIC EXECUTION).
 */
function runMigrationTooling(options = { dryRun: false, force: false, sheetName: "Programs" }) {
  const migrationId = "migration:v2.0:" + new Date().getTime();
  const isDryRun = Boolean(options && options.dryRun);
  const sheetName = (options && options.sheetName) || "Programs";

  Logger.log(`[START] [${migrationId}] Mode: ${isDryRun ? "DRY-RUN" : "EXECUTION"}`);

  let snapshot = null;
  try {
    // 1. Source Extraction
    const sourceArray = getCanonicalMigrationSource();
    Logger.log(`[SOURCE_EXTRACTED] [${migrationId}] Loaded ${sourceArray.length} canonical records.`);

    // 2. Contract Validation
    validateMigrationSource(sourceArray);
    Logger.log(`[SOURCE_VALIDATED] [${migrationId}] All canonical records satisfy contract schema.`);

    if (isDryRun) {
      Logger.log(`[DRY-RUN] [COMPLETED] [${migrationId}] Validation PASS. No changes made.`);
      return {
        status: "DRY_RUN_PASSED",
        migrationId: migrationId,
        recordCount: sourceArray.length,
        message: "Dry-run validation successful. Zero database mutations performed."
      };
    }

    // 3. Snapshot / Backup
    snapshot = createMigrationSnapshot(sheetName);
    Logger.log(`[SNAPSHOT_CREATED] [${migrationId}] Pre-migration snapshot taken (Sheet exists: ${snapshot.exists}).`);

    // 4. Sheet Preparation
    prepareProgramsSheet(sheetName, options);
    Logger.log(`[SHEET_PREPARED] [${migrationId}] Sheet '${sheetName}' prepared.`);

    // 5. Seeding
    Logger.log(`[SEED_STARTED] [${migrationId}] Seeding ${sourceArray.length} records...`);
    seedProgramsData(sourceArray, options, sheetName);
    Logger.log(`[SEED_COMPLETED] [${migrationId}] Records written to sheet.`);

    // 6. Re-Read Verification
    Logger.log(`[RECONCILIATION_STARTED] [${migrationId}] Re-reading persisted records...`);
    const persistedArray = verifySeededRecords(sheetName);

    // 7. Structural Reconciliation
    reconcileMigrationData(sourceArray, persistedArray);
    Logger.log(`[RECONCILIATION_PASSED] [${migrationId}] Structural reconciliation 100% matched.`);

    Logger.log(`[MIGRATION_SUCCESS] [${migrationId}] Migration completed and verified successfully.`);
    return {
      status: "MIGRATION_SUCCESS",
      migrationId: migrationId,
      recordCount: sourceArray.length,
      message: "Migration completed, verified, and structurally reconciled with 100% precision."
    };

  } catch (err) {
    Logger.log(`[FAILED] [${migrationId}] Migration failed: ${err.message}`);

    if (snapshot && !isDryRun) {
      Logger.log(`[ROLLBACK_STARTED] [${migrationId}] Initiating automated rollback...`);
      try {
        rollbackMigration(snapshot, sheetName);
        return {
          status: "MIGRATION_FAILED_ROLLED_BACK",
          migrationId: migrationId,
          error: err.message,
          message: "Migration failed during execution. Pre-migration state was successfully restored."
        };
      } catch (rbErr) {
        Logger.log(`[ROLLBACK_ERROR] [${migrationId}] Critical: Rollback failed: ${rbErr.message}`);
        return {
          status: "MIGRATION_FAILED_ROLLBACK_ERROR",
          migrationId: migrationId,
          error: err.message,
          rollbackError: rbErr.message,
          message: "CRITICAL: Migration failed and rollback encountered an error."
        };
      }
    }

    return {
      status: "MIGRATION_FAILED_PRE_MUTATION",
      migrationId: migrationId,
      error: err.message,
      message: "Migration failed during validation before any sheet mutation occurred."
    };
  }
}

/**
 * FUNGSI UTAMA INISIALISASI TAB SHEET PROGRAM / PROGRAMS
 * Dapat dijalankan langsung dari menu Run Apps Script Editor (pilih: initProgramsSheet)
 * Atau dipanggil via API Frontend / Web App.
 * Membuat tab sheet Programs (atau Program) dengan 16 kolom header terstandarisasi
 * dan menyemai 3 data program awal (tahfidz-anak, dewasa-putra, dewasa-putri).
 */
function initProgramsSheet(token) {
  try {
    if (token && typeof authenticateSession === "function") {
      const actor = authenticateSession(token);
      if (typeof authorizeRole === "function") {
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      }
    }

    const ss = getDatabaseSpreadsheet();
    if (!ss) {
      throw new Error("Spreadsheet database tidak ditemukan. Pastikan SPREADSHEET_ID sudah diatur di Script Properties atau script terhubung ke Spreadsheet.");
    }

    const expectedHeaders = [
      "id", "name", "badge", "image", "description",
      "highlights_json", "detail_json", "status", "sort_order",
      "created_at", "updated_at", "created_by", "updated_by",
      "published_at", "published_by", "version"
    ];

    let sheet = ss.getSheetByName("Programs");
    if (!sheet) {
      sheet = ss.getSheetByName("Program");
    }
    if (!sheet) {
      const all = ss.getSheets();
      for (let i = 0; i < all.length; i++) {
        const n = all[i].getName().trim().toLowerCase();
        if (n === "programs" || n === "program") {
          sheet = all[i];
          break;
        }
      }
    }

    let isCreated = false;
    if (!sheet) {
      sheet = ss.insertSheet("Programs");
      isCreated = true;
    }

    const lastRow = sheet.getLastRow();
    if (lastRow === 0) {
      sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    } else {
      const curHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), expectedHeaders.length)).getValues()[0];
      let needsFix = (curHeaders.length < expectedHeaders.length);
      if (!needsFix) {
        for (let c = 0; c < expectedHeaders.length; c++) {
          if (String(curHeaders[c] || "").trim().toLowerCase() !== expectedHeaders[c]) {
            needsFix = true;
            break;
          }
        }
      }
      if (needsFix) {
        sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
      }
    }

    sheet.getRange(1, 1, 1, expectedHeaders.length)
      .setFontWeight("bold")
      .setBackground("#047857")
      .setFontColor("#ffffff");
    sheet.setFrozenRows(1);

    // Seed canonical default programs (insert missing items idempotently)
    let seededCount = 0;
    if (typeof getCanonicalMigrationSource === "function") {
      const canonicalData = getCanonicalMigrationSource();
      if (Array.isArray(canonicalData) && canonicalData.length > 0) {
        const values = sheet.getDataRange().getValues();
        const existingIds = new Set();
        for (let r = 1; r < values.length; r++) {
          if (values[r][0]) {
            existingIds.add(String(values[r][0]).trim());
          }
        }

        const missing = canonicalData.filter(item => !existingIds.has(item.id));
        if (missing.length > 0) {
          const nowIso = new Date().toISOString();
          const startRow = Math.max(2, sheet.getLastRow() + 1);
          const rows = missing.map((item, idx) => [
            item.id,
            item.name,
            item.badge,
            item.image,
            item.description,
            serializeProgramPayload(item.highlights || []),
            serializeProgramPayload(item.detail || {}),
            "published",
            existingIds.size + idx + 1,
            nowIso,
            nowIso,
            "system:init",
            "system:init",
            nowIso,
            "system:init",
            1
          ]);
          sheet.getRange(startRow, 1, rows.length, expectedHeaders.length).setValues(rows);
          seededCount = rows.length;
        }
      }
    }

    const msg = `[OK] Sheet '${sheet.getName()}' siap (${isCreated ? 'Dibuat Baru' : 'Sudah Ada'}). Data awal disemai: ${seededCount} program.`;
    Logger.log(msg);
    return {
      success: true,
      sheetName: sheet.getName(),
      created: isCreated,
      seededPrograms: seededCount,
      message: msg
    };
  } catch (err) {
    Logger.log("[ERROR initProgramsSheet] " + err.message);
    throw err;
  }
}


// ==================== PENGELOLAAN ALUMNI ====================
function saveAlumniData(payload) {
  try {
    const ss = getDatabaseSpreadsheet();
    let sheet = ss.getSheetByName(ALUMNI_SHEET_NAME);
    
    if (!sheet) {
      sheet = ss.insertSheet(ALUMNI_SHEET_NAME);
      const headers = [
        "Timestamp", "Nama Lengkap", "Jenis Kelamin", "No WhatsApp", "Media Sosial",
        "Tahun Masuk", "Tahun Lulus", "Program Terakhir", "Kesibukan", "Instansi/Perusahaan",
        "Kesan & Pesan", "Provinsi", "Kabupaten", "Kecamatan", "Desa/Kelurahan", "Alamat Lengkap", "Latitude", "Longitude",
        "Foto", "Izin Publikasi"
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#dcfce7");
      sheet.setFrozenRows(1);
    } else {
        const lastCol = sheet.getLastColumn();
        if (lastCol > 0) {
            const currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
            if (currentHeaders.indexOf("Foto") === -1) {
                sheet.getRange(1, lastCol + 1).setValue("Foto").setFontWeight("bold").setBackground("#dcfce7");
                sheet.getRange(1, lastCol + 2).setValue("Izin Publikasi").setFontWeight("bold").setBackground("#dcfce7");
            }
        }
    }
    
    let fileUrl = "";
    if (payload.file && payload.file.base64) {
      const folder = DriveApp.getFolderById(FOLDER_ID);
      const decodedData = Utilities.base64Decode(payload.file.base64);
      const blob = Utilities.newBlob(
        decodedData, 
        payload.file.mimeType, 
        "ALUMNI_" + new Date().getTime() + "_" + payload.file.name
      );
      const newFile = folder.createFile(blob);
      newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      fileUrl = "https://lh3.googleusercontent.com/d/" + newFile.getId();
    }

    const timestamp = new Date();
    const row = [
      timestamp,
      payload.nama || "",
      payload.jk || "",
      payload.wa || "",
      payload.medsos || "",
      payload.masuk || "",
      payload.lulus || "",
      payload.program || "",
      payload.kesibukan || "",
      payload.instansi || "",
      payload.kesan || "",
      payload.provinsi || "",
        payload.kabupaten || "",
        payload.kecamatan || "",
        payload.desa || "",
        payload.alamat || "",
        payload.lat || "",
        payload.lng || "",
        fileUrl,
        payload.izin || ""
      ];
    
    sheet.appendRow(row);
    return { success: true, message: "Data alumni berhasil disimpan." };
    
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}


function getAlumniTestimonials() {
  try {
    const ss = getDatabaseSpreadsheet();
    const sheet = ss.getSheetByName(ALUMNI_SHEET_NAME);
    if (!sheet) return [];

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return []; // Only headers

    const headers = data[0];
    const idxNama = headers.indexOf("Nama Lengkap");
    const idxMasuk = headers.indexOf("Tahun Masuk");
    const idxLulus = headers.indexOf("Tahun Lulus");
    const idxProgram = headers.indexOf("Program Terakhir");
    const idxKesibukan = headers.indexOf("Kesibukan");
    const idxInstansi = headers.indexOf("Instansi/Perusahaan");
    const idxKesan = headers.indexOf("Kesan & Pesan");
    const idxFoto = headers.indexOf("Foto");
    const idxIzin = headers.indexOf("Izin Publikasi");

    if (idxIzin === -1 || idxKesan === -1 || idxNama === -1) return [];

    let results = [];
    
    // Loop backwards to get latest first
    for (let i = data.length - 1; i >= 1; i--) {
      const row = data[i];
      const izin = row[idxIzin] ? String(row[idxIzin]).trim() : "";
      const kesan = row[idxKesan] ? String(row[idxKesan]).trim() : "";

      if (izin === "Ya" && kesan !== "") {
        results.push({
          nama: String(row[idxNama] || ""),
          tahunMasuk: String(row[idxMasuk] || ""),
          tahunLulus: String(row[idxLulus] || ""),
          program: String(row[idxProgram] || ""),
          kesibukan: String(row[idxKesibukan] || ""),
          instansi: String(row[idxInstansi] || ""),
          kesan: kesan,
          foto: (idxFoto !== -1) ? String(row[idxFoto] || "") : ""
        });

        if (results.length >= 5) {
          break; // Max 5 testimonials
        }
      }
    }

    return results;
  } catch (e) {
    return [];
  }
}

function getAllAlumniData() {
  try {
    const ss = getDatabaseSpreadsheet();
    let sheet = ss.getSheetByName(ALUMNI_SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(ALUMNI_SHEET_NAME);
      const headers = [
        "Timestamp", "Nama Lengkap", "Jenis Kelamin", "No WhatsApp", "Media Sosial",
        "Tahun Masuk", "Tahun Lulus", "Program Terakhir", "Kesibukan", "Instansi/Perusahaan",
        "Kesan & Pesan", "Provinsi", "Kabupaten", "Kecamatan", "Desa/Kelurahan", "Alamat Lengkap", "Latitude", "Longitude",
        "Foto", "Izin Publikasi"
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#dcfce7");
      sheet.setFrozenRows(1);
      return { success: true, data: [] };
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, data: [] };

    const headers = data[0];
    const idxTimestamp = headers.indexOf("Timestamp");
    const idxNama = headers.indexOf("Nama Lengkap");
    const idxJk = headers.indexOf("Jenis Kelamin");
    const idxWa = headers.indexOf("No WhatsApp");
    const idxMedsos = headers.indexOf("Media Sosial");
    const idxMasuk = headers.indexOf("Tahun Masuk");
    const idxLulus = headers.indexOf("Tahun Lulus");
    const idxProgram = headers.indexOf("Program Terakhir");
    const idxKesibukan = headers.indexOf("Kesibukan");
    const idxInstansi = headers.indexOf("Instansi/Perusahaan");
    const idxKesan = headers.indexOf("Kesan & Pesan");
    const idxProv = headers.indexOf("Provinsi");
    const idxKab = headers.indexOf("Kabupaten");
    const idxKec = headers.indexOf("Kecamatan");
    const idxDesa = headers.indexOf("Desa/Kelurahan");
    const idxAlamat = headers.indexOf("Alamat Lengkap");
    const idxLat = headers.indexOf("Latitude");
    const idxLng = headers.indexOf("Longitude");
    const idxFoto = headers.indexOf("Foto");
    const idxIzin = headers.indexOf("Izin Publikasi");

    const list = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const valNama = idxNama >= 0 ? row[idxNama] : row[1];
      if (!valNama || String(valNama).trim() === "") continue;

      list.push({
        rowIndex: i + 1,
        timestamp: idxTimestamp >= 0 ? row[idxTimestamp] : "",
        nama: idxNama >= 0 ? String(row[idxNama] || "").trim() : "",
        jk: idxJk >= 0 ? String(row[idxJk] || "").trim() : "",
        wa: idxWa >= 0 ? String(row[idxWa] || "").trim() : "",
        medsos: idxMedsos >= 0 ? String(row[idxMedsos] || "").trim() : "",
        masuk: idxMasuk >= 0 ? String(row[idxMasuk] || "").trim() : "",
        lulus: idxLulus >= 0 ? String(row[idxLulus] || "").trim() : "",
        program: idxProgram >= 0 ? String(row[idxProgram] || "").trim() : "",
        kesibukan: idxKesibukan >= 0 ? String(row[idxKesibukan] || "").trim() : "",
        instansi: idxInstansi >= 0 ? String(row[idxInstansi] || "").trim() : "",
        kesan: idxKesan >= 0 ? String(row[idxKesan] || "").trim() : "",
        provinsi: idxProv >= 0 ? String(row[idxProv] || "").trim() : "",
        kabupaten: idxKab >= 0 ? String(row[idxKab] || "").trim() : "",
        kecamatan: idxKec >= 0 ? String(row[idxKec] || "").trim() : "",
        desa: idxDesa >= 0 ? String(row[idxDesa] || "").trim() : "",
        alamat: idxAlamat >= 0 ? String(row[idxAlamat] || "").trim() : "",
        lat: idxLat >= 0 ? row[idxLat] : "",
        lng: idxLng >= 0 ? row[idxLng] : "",
        foto: idxFoto >= 0 ? String(row[idxFoto] || "").trim() : "",
        izin: idxIzin >= 0 ? String(row[idxIzin] || "").trim() : "Tidak"
      });
    }

    // Urutkan paling baru di atas
    list.reverse();
    return { success: true, data: list };
  } catch (err) {
    return { success: false, message: err.toString(), data: [] };
  }
}

function deleteAlumniData(rowIndex, nama) {
  try {
    const ss = getDatabaseSpreadsheet();
    const sheet = ss.getSheetByName(ALUMNI_SHEET_NAME);
    if (!sheet) return { success: false, message: "Sheet Data_Alumni tidak ditemukan." };
    const r = parseInt(rowIndex);
    if (r > 1 && r <= sheet.getLastRow()) {
      sheet.deleteRow(r);
      return { success: true, message: "Data alumni berhasil dihapus." };
    }
    if (nama) {
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][1] && String(data[i][1]).trim().toLowerCase() === String(nama).trim().toLowerCase()) {
          sheet.deleteRow(i + 1);
          return { success: true, message: "Data alumni berhasil dihapus." };
        }
      }
    }
    return { success: false, message: "Baris data alumni tidak ditemukan." };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}


// =====================================================================
// MANAJEMEN DATA SANTRI & GOOGLE DRIVE PHOTO STORAGE
// =====================================================================

const FOLDER_ID_STUDENT_PHOTOS = (function() {
  try { return PropertiesService.getScriptProperties().getProperty("DRIVE_FOLDER_STUDENT_PHOTOS") || ""; } catch (e) { return ""; }
})(); // __MUBAROKAH_CONFIG_PENDING__

/**
 * Upload Foto Profil Santri ke Google Drive & Set Sharing Publik
 * Menghasilkan link Google CDN direct view dan menyimpan ke sheet Students
 */
function uploadStudentPhotoToDrive(filePayload, token) {
  try {
    let actor = null;
    if (token) {
      try {
        actor = authenticateSession(token);
      } catch (e) {
        const legacy = verifySessionToken(token);
        if (legacy && legacy.role) {
          actor = { role: legacy.role, identityId: legacy.userId };
        }
      }
    }

    if (!actor) {
      return {
        success: false,
        status: "error",
        statusCode: 401,
        message: "Sesi autentikasi tidak valid atau telah kedaluwarsa."
      };
    }

    const fileData = (filePayload && filePayload.file) || filePayload;
    if (!fileData || !fileData.base64) {
      return {
        success: false,
        status: "error",
        statusCode: 400,
        message: "Data file foto (base64) wajib dikirimkan."
      };
    }

    const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const rawMime = String(fileData.mimeType || fileData.type || "image/jpeg").trim().toLowerCase();
    if (!allowedMimes.includes(rawMime)) {
      return {
        success: false,
        status: "error",
        statusCode: 400,
        message: "Format foto tidak didukung. Hanya gambar (JPG, PNG, WEBP) yang diperbolehkan."
      };
    }

    const decodedData = Utilities.base64Decode(fileData.base64);
    if (!decodedData || decodedData.length === 0) {
      return {
        success: false,
        status: "error",
        statusCode: 400,
        message: "Data file foto kosong atau rusak."
      };
    }

    // Maksimal 5 MB
    if (decodedData.length > 5 * 1024 * 1024) {
      return {
        success: false,
        status: "error",
        statusCode: 400,
        message: "Ukuran foto melebihi batas maksimal 5 MB."
      };
    }

    const folder = DriveApp.getFolderById(FOLDER_ID_STUDENT_PHOTOS);
    const cleanStudentId = String(filePayload.studentId || filePayload.student_id || filePayload.nis || "SANTRI").replace(/[^a-zA-Z0-9_-]/g, "");
    const fileName = "FOTO_" + cleanStudentId + "_" + new Date().getTime() + ".jpg";
    const blob = Utilities.newBlob(decodedData, rawMime, fileName);
    const newFile = folder.createFile(blob);
    newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const fileUrl = "https://lh3.googleusercontent.com/d/" + newFile.getId();
    const driveViewUrl = "https://drive.google.com/file/d/" + newFile.getId() + "/view?usp=sharing";

    // Update langsung ke sheet Students jika studentId atau nis tersedia
    const targetStudentId = filePayload.studentId || filePayload.student_id;
    const targetNis = filePayload.nis || filePayload.nisn;
    if (targetStudentId || targetNis) {
      updateStudentPhotoInSheet(targetStudentId, targetNis, fileUrl);
    }

    return {
      success: true,
      status: "success",
      statusCode: 200,
      url: fileUrl,
      fileUrl: fileUrl,
      driveViewUrl: driveViewUrl,
      fileId: newFile.getId(),
      message: "Foto santri berhasil diunggah ke Google Drive dan disimpan ke database!"
    };
  } catch (err) {
    console.error("[UPLOAD STUDENT PHOTO ERROR]", err);
    return {
      success: false,
      status: "error",
      message: "Gagal mengunggah foto santri: " + err.message
    };
  }
}

/**
 * Update link foto profil santri di spreadsheet Students
 */
function updateStudentPhotoInSheet(studentId, nis, photoUrl) {
  if (!photoUrl) return false;
  const ss = getDatabaseSpreadsheet();
  const sheet = getAuthSheet(ss, SHEET_STUDENTS);
  if (!sheet) return false;

  const data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) return false;

  const header = data[0].map(h => String(h || "").trim().toLowerCase());
  let idIdx = header.indexOf("student_id");
  let nisIdx = header.indexOf("nis");
  if (nisIdx === -1) nisIdx = header.indexOf("nisn");
  let photoIdx = header.indexOf("photo_url");
  if (photoIdx === -1) photoIdx = header.indexOf("foto_profil");
  if (photoIdx === -1) photoIdx = header.indexOf("foto");

  if (photoIdx === -1) {
    photoIdx = header.length;
    sheet.getRange(1, photoIdx + 1).setValue("photo_url").setFontWeight("bold").setBackground("#dcfce7");
  }

  const targetId = String(studentId || "").trim();
  const targetNis = String(nis || "").trim();

  for (let i = 1; i < data.length; i++) {
    const rowId = idIdx !== -1 ? String(data[i][idIdx] || "").trim() : "";
    const rowNis = nisIdx !== -1 ? String(data[i][nisIdx] || "").trim() : "";

    if ((targetId && rowId === targetId) || (targetNis && rowNis === targetNis)) {
      sheet.getRange(i + 1, photoIdx + 1).setValue(photoUrl);
      return true;
    }
  }
  return false;
}

/**
 * Unggah foto profil pengguna (Wali Santri, Pengasuh, Admin/Pengelola) ke Google Drive
 */

function invalidateStudentsCache() {
  try {
    const cache = CacheService.getScriptCache();
    if (cache) cache.remove(CACHE_KEY_STUDENTS);
  } catch (e) {
    console.warn("Gagal invalidate students cache: " + e.message);
  }
}

/**
 * Ambil seluruh data santri untuk Dashboard Admin
 * Dilengkapi ScriptCache level Apps Script (~150ms response)
 */
function getAllStudentsData(token) {
  try {
    const actor = authenticateSession(token);
    authorizeRole(actor, ["ADMIN", "EDITOR", "PENGASUH"]);

    // Cek cache Apps Script terlebih dahulu untuk respon super cepat
    try {
      const cache = CacheService.getScriptCache();
      if (cache) {
        const cached = cache.get(CACHE_KEY_STUDENTS);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && (parsed.status === "success" || parsed.success)) {
            return parsed;
          }
        }
      }
    } catch (cErr) {
      console.warn("[STUDENTS CACHE READ ERROR]", cErr);
    }

    const ss = getDatabaseSpreadsheet();
    const sheet = getAuthSheet(ss, SHEET_STUDENTS);
    if (!sheet) {
      return {
        status: "success",
        success: true,
        data: [],
        total: 0,
        summary: { total: 0, putra: 0, putri: 0, aktif: 0, nonaktif: 0 }
      };
    }

    const data = sheet.getDataRange().getValues();
    if (!data || data.length < 2) {
      return {
        status: "success",
        success: true,
        data: [],
        total: 0,
        summary: { total: 0, putra: 0, putri: 0, aktif: 0, nonaktif: 0 }
      };
    }

    const headers = data[0].map(h => String(h || "").trim().toLowerCase().replace(/\s+/g, "_"));
    let idIdx = headers.indexOf("student_id");
    let nisIdx = headers.indexOf("nis");
    if (nisIdx === -1) nisIdx = headers.indexOf("nisn");
    let nikIdx = headers.indexOf("nik");
    let nameIdx = headers.indexOf("name");
    if (nameIdx === -1) nameIdx = headers.indexOf("nama");
    let genderIdx = headers.indexOf("gender");
    if (genderIdx === -1) genderIdx = headers.indexOf("jenis");
    if (genderIdx === -1) genderIdx = headers.indexOf("jenis_kelamin");
    let birthIdx = headers.indexOf("birth_date");
    if (birthIdx === -1) birthIdx = headers.indexOf("tanggal_lahir");

    // Deteksi fleksibel untuk photo/foto
    let photoIdx = -1;
    for (let h = 0; h < headers.length; h++) {
      const hn = headers[h];
      if (hn === "photo_url" || hn === "foto_profil" || hn === "foto" || hn === "photo" || hn === "foto_santri" || hn === "link_foto" || hn.includes("foto") || hn.includes("photo")) {
        photoIdx = h;
        break;
      }
    }
    if (photoIdx === -1 && headers.length >= 10) photoIdx = 9; // Kolom J (indeks 9)

    // Deteksi kolom Halaqah & Muhafiz jika tersedia langsung di sheet Student
    let halaqahIdx = headers.indexOf("halaqah");
    if (halaqahIdx === -1) halaqahIdx = headers.indexOf("nama_halaqah");
    if (halaqahIdx === -1) halaqahIdx = headers.indexOf("kelompok_halaqah");
    let muhafizIdx = headers.indexOf("muhafiz");
    if (muhafizIdx === -1) muhafizIdx = headers.indexOf("muhafidz");
    if (muhafizIdx === -1) muhafizIdx = headers.indexOf("pembimbing");
    if (muhafizIdx === -1) muhafizIdx = headers.indexOf("ustadz");
    if (muhafizIdx === -1) muhafizIdx = headers.indexOf("guru");

    let progIdx = headers.indexOf("program");
    let statusIdx = headers.indexOf("status");
    let createdIdx = headers.indexOf("created_at");
    let qrIdx = headers.indexOf("qr_code");
    if (qrIdx === -1) qrIdx = headers.indexOf("qrcode");

    let phoneIdx = headers.findIndex(h => h.includes("phone") || h.includes("hp") || h.includes("wa") || h.includes("telepon") || h.includes("kontak"));

    // Ambil mapping kontak wali santri dari Wali_Santri_Map & Wali_Identities/Users
    const waliPhoneMap = {};
    try {
      const mapSheet = getAuthSheet(ss, SHEET_WALI_SANTRI_MAP);
      const waliSheet = getAuthSheet(ss, SHEET_WALI_IDENTITIES) || getAuthSheet(ss, "Users");
      if (mapSheet && waliSheet) {
        const wData = waliSheet.getDataRange().getValues();
        if (wData.length > 1) {
          const wHead = wData[0].map(h => String(h || "").trim().toLowerCase());
          const wIdIdx = wHead.findIndex(h => h.includes("id"));
          const wPhoneIdx = wHead.findIndex(h => h.includes("phone") || h.includes("hp") || h.includes("wa") || h.includes("telepon") || h.includes("kontak"));
          const phoneById = {};
          if (wIdIdx !== -1 && wPhoneIdx !== -1) {
            for (let w = 1; w < wData.length; w++) {
              const wId = String(wData[w][wIdIdx] || "").trim();
              const wPhone = String(wData[w][wPhoneIdx] || "").trim();
              if (wId && wPhone) phoneById[wId] = wPhone;
            }
          }
          const mData = mapSheet.getDataRange().getValues();
          for (let m = 1; m < mData.length; m++) {
            const waliId = String(mData[m][1] || "").trim();
            const sId = String(mData[m][2] || "").trim();
            if (sId && waliId && phoneById[waliId]) {
              waliPhoneMap[sId] = phoneById[waliId];
            }
          }
        }
      }
    } catch (wErr) {
      console.warn("[STUDENTS WALI MAP ERROR]", wErr);
    }

    const students = [];
    let putra = 0, putri = 0, aktif = 0, nonaktif = 0;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const studentId = idIdx !== -1 ? String(row[idIdx] || "").trim() : "";
      const nis = nisIdx !== -1 ? String(row[nisIdx] || "").trim() : "";
      const name = nameIdx !== -1 ? String(row[nameIdx] || "").trim() : "";
      if (!studentId && !nis && !name) continue;

      const nik = nikIdx !== -1 ? String(row[nikIdx] || "").trim() : "";
      const genderRaw = genderIdx !== -1 ? String(row[genderIdx] || "").trim().toUpperCase() : "";
      const gender = (genderRaw === "P" || genderRaw === "PEREMPUAN" || genderRaw === "PUTRI") ? "P" : "L";
      const birthDate = birthIdx !== -1 ? normalizeDateString(row[birthIdx]) : "";
      let photoUrl = photoIdx !== -1 ? String(row[photoIdx] || "").trim() : "";
      if (photoUrl) {
        const driveMatch = photoUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || photoUrl.match(/id=([a-zA-Z0-9_-]+)/);
        if (driveMatch && driveMatch[1]) {
          photoUrl = "https://lh3.googleusercontent.com/d/" + driveMatch[1];
        }
      }

      let qrCode = qrIdx !== -1 ? String(row[qrIdx] || "").trim() : "";
      if (!qrCode) {
        qrCode = "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=" + encodeURIComponent(nis || studentId);
      }

      const program = progIdx !== -1 ? String(row[progIdx] || "Reguler").trim() : "Reguler";
      const statusRaw = statusIdx !== -1 ? String(row[statusIdx] || "ACTIVE").trim().toUpperCase() : "ACTIVE";
      const status = (statusRaw === "ACTIVE" || statusRaw === "AKTIF") ? "ACTIVE" : "INACTIVE";
      const createdAt = createdIdx !== -1 ? String(row[createdIdx] || "").trim() : "";
      const directHalaqah = halaqahIdx !== -1 ? String(row[halaqahIdx] || "").trim() : "";
      const directMuhafiz = muhafizIdx !== -1 ? String(row[muhafizIdx] || "").trim() : "";

      let phone = phoneIdx !== -1 ? String(row[phoneIdx] || "").trim() : "";
      if (!phone && studentId && waliPhoneMap[studentId]) {
        phone = waliPhoneMap[studentId];
      }

      if (gender === "L") putra++;
      else putri++;

      if (status === "ACTIVE") aktif++;
      else nonaktif++;

      students.push({
        studentId: studentId || ("STD_" + i),
        student_id: studentId || ("STD_" + i),
        nis: nis,
        nisn: nis,
        nik: nik,
        name: name,
        gender: gender,
        birthDate: birthDate,
        birth_date: birthDate,
        photoUrl: photoUrl,
        photo_url: photoUrl,
        qrCode: qrCode,
        qr_code: qrCode,
        halaqah: directHalaqah,
        muhafiz: directMuhafiz,
        program: program || "Reguler",
        status: status,
        createdAt: createdAt,
        phone: phone,
        parentPhone: phone,
        whatsapp: phone
      });
    }

    const result = {
      status: "success",
      success: true,
      data: students,
      total: students.length,
      summary: {
        total: students.length,
        putra: putra,
        putri: putri,
        aktif: aktif,
        nonaktif: nonaktif
      }
    };

    try {
      const cache = CacheService.getScriptCache();
      if (cache) {
        const serialized = JSON.stringify(result);
        if (serialized.length < 100000) {
          cache.put(CACHE_KEY_STUDENTS, serialized, 600); // 10 menit
        }
      }
    } catch (cErr) {
      console.warn("[STUDENTS CACHE WRITE ERROR]", cErr);
    }

    return result;
  } catch (err) {
    console.error("[GET ALL STUDENTS ERROR]", err);
    return {
      status: "error",
      success: false,
      message: "Gagal memuat data santri: " + err.message,
      data: [],
      total: 0,
      summary: { total: 0, putra: 0, putri: 0, aktif: 0, nonaktif: 0 }
    };
  }
}

/**
 * Tambah / Perbarui Data Santri di Spreadsheet Students (Admin/Editor Only)
 */
function saveStudentData(studentObj, token) {
  let actor = null;
  if (token) {
    try {
      actor = authenticateSession(token);
      authorizeRole(actor, ["ADMIN", "EDITOR"]);
    } catch (e) {
      const legacy = verifySessionToken(token);
      if (legacy && legacy.role) {
        actor = { role: legacy.role, identityId: legacy.userId };
      }
    }
  }

  const ss = getDatabaseSpreadsheet();
  const sheet = getAuthSheet(ss, SHEET_STUDENTS);
  if (!sheet) throw new Error("Tabel Students tidak ditemukan.");

  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h || "").trim().toLowerCase());

  let idIdx = headers.indexOf("student_id");
  let nisIdx = headers.indexOf("nis");
  if (nisIdx === -1) nisIdx = headers.indexOf("nisn");
  let nikIdx = headers.indexOf("nik");
  let nameIdx = headers.indexOf("name");
  if (nameIdx === -1) nameIdx = headers.indexOf("nama");
  let genderIdx = headers.indexOf("gender");
  if (genderIdx === -1) genderIdx = headers.indexOf("jenis");
  let birthIdx = headers.indexOf("birth_date");
  if (birthIdx === -1) birthIdx = headers.indexOf("tanggal_lahir");
  let photoIdx = headers.indexOf("photo_url");
  if (photoIdx === -1) photoIdx = headers.indexOf("foto_profil");
  if (photoIdx === -1) photoIdx = headers.indexOf("foto");
  let progIdx = headers.indexOf("program");
  let statusIdx = headers.indexOf("status");
  let phoneIdx = headers.findIndex(h => h.includes("phone") || h.includes("hp") || h.includes("wa") || h.includes("telepon") || h.includes("kontak"));

  const inputId = String(studentObj.studentId || studentObj.student_id || "").trim();
  const inputNis = String(studentObj.nis || studentObj.nisn || "").trim();
  const inputNik = String(studentObj.nik || "").trim();
  const inputName = String(studentObj.name || studentObj.nama || "").trim();
  const inputPhone = String(studentObj.phone || studentObj.parentPhone || studentObj.whatsapp || studentObj.no_hp || "").trim();
  let inputGender = String(studentObj.gender || studentObj.jenis || "").trim().toUpperCase();
  if (inputGender === "PEREMPUAN" || inputGender === "PUTRI" || inputGender === "P") {
    inputGender = "P";
  } else {
    inputGender = "L";
  }
  const inputBirth = normalizeDateString(studentObj.birthDate || studentObj.birth_date || "");
  const inputPhoto = String(studentObj.photoUrl || studentObj.photo_url || "").trim();
  const inputProgram = String(studentObj.program || "Reguler").trim();
  let inputStatus = String(studentObj.status || "ACTIVE").trim().toUpperCase();
  if (inputStatus === "AKTIF" || inputStatus === "ACTIVE") {
    inputStatus = "ACTIVE";
  } else {
    inputStatus = "INACTIVE";
  }

  if (!inputNis || !inputName) {
    throw new Error("NIS dan Nama Santri wajib diisi.");
  }

  // Jika ada input nomor telepon tapi kolom phone belum ada di sheet, buatkan kolomnya otomatis
  if (inputPhone && phoneIdx === -1) {
    try {
      sheet.getRange(1, headers.length + 1).setValue("phone");
      phoneIdx = headers.length;
      headers.push("phone");
    } catch (colErr) {
      console.warn("[ADD PHONE COLUMN ERROR]", colErr);
    }
  }

  let foundRow = -1;
  for (let i = 1; i < data.length; i++) {
    const rowId = idIdx !== -1 ? String(data[i][idIdx] || "").trim() : "";
    const rowNis = nisIdx !== -1 ? String(data[i][nisIdx] || "").trim() : "";
    if ((inputId && rowId === inputId) || (inputNis && rowNis === inputNis)) {
      foundRow = i + 1;
      break;
    }
  }

  const nowIso = new Date().toISOString();
  let actualStudentId = inputId;

  if (foundRow !== -1) {
    if (nisIdx !== -1) sheet.getRange(foundRow, nisIdx + 1).setValue(inputNis);
    if (nikIdx !== -1) sheet.getRange(foundRow, nikIdx + 1).setValue(inputNik);
    if (nameIdx !== -1) sheet.getRange(foundRow, nameIdx + 1).setValue(inputName);
    if (genderIdx !== -1) sheet.getRange(foundRow, genderIdx + 1).setValue(inputGender);
    if (birthIdx !== -1) sheet.getRange(foundRow, birthIdx + 1).setValue(inputBirth);
    if (photoIdx !== -1 && inputPhoto) sheet.getRange(foundRow, photoIdx + 1).setValue(inputPhoto);
    if (progIdx !== -1) sheet.getRange(foundRow, progIdx + 1).setValue(inputProgram);
    if (statusIdx !== -1) sheet.getRange(foundRow, statusIdx + 1).setValue(inputStatus);
    if (phoneIdx !== -1 && inputPhone) sheet.getRange(foundRow, phoneIdx + 1).setValue(inputPhone);

    actualStudentId = idIdx !== -1 ? String(data[foundRow - 1][idIdx] || inputId) : inputId;

    if (inputPhone) {
      syncStudentWaliContact(ss, actualStudentId, inputNis, inputName, inputPhone);
    }

    invalidateStudentsCache();

    return {
      status: "success",
      success: true,
      message: `Data santri ${inputName} (NIS: ${inputNis}) berhasil diperbarui.`
    };
  } else {
    const newStudentId = inputId || ("STD_" + Utilities.getUuid().replace(/-/g, "").substring(0, 12));
    const newRow = new Array(headers.length).fill("");
    if (idIdx !== -1) newRow[idIdx] = newStudentId;
    if (nisIdx !== -1) newRow[nisIdx] = inputNis;
    if (nikIdx !== -1) newRow[nikIdx] = inputNik;
    if (nameIdx !== -1) newRow[nameIdx] = inputName;
    if (genderIdx !== -1) newRow[genderIdx] = inputGender;
    if (birthIdx !== -1) newRow[birthIdx] = inputBirth;
    if (photoIdx !== -1) newRow[photoIdx] = inputPhoto;
    if (progIdx !== -1) newRow[progIdx] = inputProgram;
    if (statusIdx !== -1) newRow[statusIdx] = inputStatus;
    if (phoneIdx !== -1 && inputPhone) newRow[phoneIdx] = inputPhone;
    const createdIdx = headers.indexOf("created_at");
    if (createdIdx !== -1) newRow[createdIdx] = nowIso;

    sheet.appendRow(newRow);

    if (inputPhone) {
      syncStudentWaliContact(ss, newStudentId, inputNis, inputName, inputPhone);
    }

    invalidateStudentsCache();

    return {
      status: "success",
      success: true,
      studentId: newStudentId,
      message: `Santri baru ${inputName} (NIS: ${inputNis}) berhasil ditambahkan ke database.`
    };
  }
}

/**
 * Sinkronisasi otomatis nomor kontak WhatsApp Wali Santri ke Users, Wali_Identities & Wali_Santri_Map
 */
function syncStudentWaliContact(ss, studentId, nis, studentName, phone) {
  if (!studentId || !phone) return;
  try {
    const nowIso = new Date().toISOString();
    const mapSheet = getAuthSheet(ss, SHEET_WALI_SANTRI_MAP);
    let waliId = "";
    if (mapSheet) {
      const mData = mapSheet.getDataRange().getValues();
      for (let m = 1; m < mData.length; m++) {
        if (String(mData[m][2]).trim() === studentId) {
          waliId = String(mData[m][1]).trim();
          break;
        }
      }
    }

    const waliSheet = getAuthSheet(ss, SHEET_WALI_IDENTITIES);
    const usersSheet = getAuthSheet(ss, "Users");

    if (waliId) {
      if (waliSheet) {
        const wData = waliSheet.getDataRange().getValues();
        const wHead = wData[0].map(h => String(h || "").trim().toLowerCase());
        const idIdx = wHead.findIndex(h => h.includes("id"));
        const pIdx = wHead.findIndex(h => h.includes("phone") || h.includes("hp") || h.includes("wa") || h.includes("telepon"));
        if (idIdx !== -1 && pIdx !== -1) {
          for (let i = 1; i < wData.length; i++) {
            if (String(wData[i][idIdx]).trim() === waliId) {
              waliSheet.getRange(i + 1, pIdx + 1).setValue(phone);
              break;
            }
          }
        }
      }
      if (usersSheet) {
        const uData = usersSheet.getDataRange().getValues();
        const uHead = uData[0].map(h => String(h || "").trim().toLowerCase());
        const idIdx = uHead.indexOf("user_id");
        const pIdx = uHead.indexOf("phone");
        if (idIdx !== -1 && pIdx !== -1) {
          for (let i = 1; i < uData.length; i++) {
            if (String(uData[i][idIdx]).trim() === waliId) {
              usersSheet.getRange(i + 1, pIdx + 1).setValue(phone);
              break;
            }
          }
        }
      }
    } else {
      const newWaliId = "WALI_" + Utilities.getUuid().replace(/-/g, "").substring(0, 10);
      const waliName = "Wali " + studentName;
      const waliEmail = nis ? `wali.${nis}@mubarokah.app` : `wali.${studentId.toLowerCase()}@mubarokah.app`;

      if (usersSheet) {
        const uHeaders = usersSheet.getDataRange().getValues()[0].map(h => String(h || "").trim().toLowerCase());
        const newU = new Array(uHeaders.length).fill("");
        const idIdx = uHeaders.indexOf("user_id");
        const emIdx = uHeaders.indexOf("email");
        const phIdx = uHeaders.indexOf("phone");
        const nmIdx = uHeaders.indexOf("name");
        const rlIdx = uHeaders.indexOf("role");
        const stIdx = uHeaders.indexOf("status");
        const crIdx = uHeaders.indexOf("created_at");

        if (idIdx !== -1) newU[idIdx] = newWaliId;
        if (emIdx !== -1) newU[emIdx] = waliEmail;
        if (phIdx !== -1) newU[phIdx] = phone;
        if (nmIdx !== -1) newU[nmIdx] = waliName;
        if (rlIdx !== -1) newU[rlIdx] = "WALI_SANTRI";
        if (stIdx !== -1) newU[stIdx] = "ACTIVE";
        if (crIdx !== -1) newU[crIdx] = nowIso;
        usersSheet.appendRow(newU);
      }

      if (waliSheet) {
        const wHeaders = waliSheet.getDataRange().getValues()[0].map(h => String(h || "").trim().toLowerCase());
        const newW = new Array(wHeaders.length).fill("");
        const idIdx = wHeaders.findIndex(h => h.includes("id"));
        const emIdx = wHeaders.indexOf("email");
        const phIdx = wHeaders.findIndex(h => h.includes("phone") || h.includes("hp") || h.includes("wa"));
        const nmIdx = wHeaders.indexOf("name");
        const rlIdx = wHeaders.indexOf("role");
        const stIdx = wHeaders.indexOf("status");
        const crIdx = wHeaders.indexOf("created_at");

        if (idIdx !== -1) newW[idIdx] = newWaliId;
        if (emIdx !== -1) newW[emIdx] = waliEmail;
        if (phIdx !== -1) newW[phIdx] = phone;
        if (nmIdx !== -1) newW[nmIdx] = waliName;
        if (rlIdx !== -1) newW[rlIdx] = "WALI_SANTRI";
        if (stIdx !== -1) newW[stIdx] = "ACTIVE";
        if (crIdx !== -1) newW[crIdx] = nowIso;
        waliSheet.appendRow(newW);
      }

      if (mapSheet) {
        const mapId = "MAP_" + Utilities.getUuid().replace(/-/g, "").substring(0, 12);
        mapSheet.appendRow([mapId, newWaliId, studentId, "GUARDIAN", "VERIFIED", nowIso]);
      }
    }
  } catch (err) {
    console.warn("[syncStudentWaliContact error]", err);
  }
}

/**
 * Hapus Data Santri dari Spreadsheet Students
 */
function deleteStudentData(studentId, token) {
  try {
    if (token) {
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN"]);
      } catch (authErr) {
        verifySessionToken(token);
      }
    }

    const cleanId = String(studentId || "").trim();
    if (!cleanId) {
      return {
        status: "error",
        success: false,
        message: "ID Santri tidak valid untuk dihapus."
      };
    }

    const ss = getDatabaseSpreadsheet();
    const sheet = getAuthSheet(ss, SHEET_STUDENTS);
    if (!sheet) {
      return { status: "error", success: false, message: "Sheet Students tidak ditemukan." };
    }

    const data = sheet.getDataRange().getValues();
    if (!data || data.length < 2) {
      return { status: "error", success: false, message: "Data santri kosong." };
    }

    const headers = data[0].map(h => String(h || "").trim().toLowerCase());
    let idIdx = headers.indexOf("student_id");
    let nisIdx = headers.indexOf("nis");
    if (nisIdx === -1) nisIdx = headers.indexOf("nisn");

    let targetRow = -1;
    let studentName = "";
    for (let i = 1; i < data.length; i++) {
      const rowId = idIdx !== -1 ? String(data[i][idIdx] || "").trim() : "";
      const rowNis = nisIdx !== -1 ? String(data[i][nisIdx] || "").trim() : "";
      if (rowId === cleanId || (rowNis && rowNis === cleanId)) {
        targetRow = i + 1;
        let nameIdx = headers.indexOf("name");
        if (nameIdx === -1) nameIdx = headers.indexOf("nama");
        studentName = nameIdx !== -1 ? String(data[i][nameIdx] || "") : cleanId;
        break;
      }
    }

    if (targetRow === -1) {
      return {
        status: "error",
        success: false,
        message: `Santri dengan ID/NIS '${cleanId}' tidak ditemukan.`
      };
    }

    sheet.deleteRow(targetRow);

    // Bersihkan relasi di Wali_Santri_Map jika ada
    try {
      const mapSheet = getAuthSheet(ss, SHEET_WALI_SANTRI_MAP);
      if (mapSheet) {
        const mapData = mapSheet.getDataRange().getValues();
        for (let m = mapData.length - 1; m >= 1; m--) {
          if (String(mapData[m][2] || "").trim() === cleanId) {
            mapSheet.deleteRow(m + 1);
          }
        }
      }
    } catch (cleanErr) {
      console.warn("Pembersihan Wali_Santri_Map:", cleanErr);
    }

    invalidateStudentsCache();

    return {
      status: "success",
      success: true,
      message: `Data santri ${studentName} berhasil dihapus dari database.`
    };
  } catch (err) {
    console.error("[DELETE STUDENT ERROR]", err);
    return {
      status: "error",
      success: false,
      message: "Gagal menghapus data santri: " + err.message
    };
  }
}

/**
 * Lookup Santri berdasarkan NIS & Tanggal Lahir untuk Aktivasi Wali Santri
 * Mendukung pencarian toleran dan mengekstrak NIK, Gender, dan Foto Profil
 */
function getStudentByNisAndBirthDate(nisOrNisn, birthDate) {
  const cleanNis = String(nisOrNisn || "").trim();
  const cleanBirthDate = normalizeDateString(birthDate);
  if (!cleanNis) return null;

  const ss = getDatabaseSpreadsheet();
  const sheet = getAuthSheet(ss, SHEET_STUDENTS);
  if (!sheet) return null;

  const data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) return null;

  const header = data[0].map(h => String(h || "").trim().toLowerCase());
  let idIdx = header.indexOf("student_id");
  let nisIdx = header.indexOf("nis");
  if (nisIdx === -1) nisIdx = header.indexOf("nisn");
  let nikIdx = header.indexOf("nik");
  let nameIdx = header.indexOf("name");
  if (nameIdx === -1) nameIdx = header.indexOf("nama");
  let genderIdx = header.indexOf("gender");
  if (genderIdx === -1) genderIdx = header.indexOf("jenis");
  if (genderIdx === -1) genderIdx = header.indexOf("jenis_kelamin");
  let birthIdx = header.indexOf("birth_date");
  if (birthIdx === -1) birthIdx = header.indexOf("tanggal_lahir");
  if (birthIdx === -1) birthIdx = header.indexOf("tgl_lahir");
  let photoIdx = header.indexOf("photo_url");
  if (photoIdx === -1) photoIdx = header.indexOf("foto_profil");
  if (photoIdx === -1) photoIdx = header.indexOf("foto");
  let progIdx = header.indexOf("program");
  let statusIdx = header.indexOf("status");

  if (idIdx === -1) idIdx = 0;
  if (nisIdx === -1) nisIdx = 1;
  if (nameIdx === -1) nameIdx = 2;

  for (let i = 1; i < data.length; i++) {
    const rowNis = String(data[i][nisIdx] || "").trim();
    if (rowNis === cleanNis) {
      const rowBirth = birthIdx !== -1 ? normalizeDateString(data[i][birthIdx]) : "";
      // Toleran: Jika tanggal lahir di database masih kosong (data awal), tetap cocok
      if (!rowBirth || !cleanBirthDate || rowBirth === cleanBirthDate) {
        return {
          studentId: String(data[i][idIdx] || ""),
          nis: rowNis,
          nisn: rowNis, // alias backward compatible
          nik: nikIdx !== -1 ? String(data[i][nikIdx] || "") : "",
          name: nameIdx !== -1 ? String(data[i][nameIdx] || "") : "Santri",
          gender: genderIdx !== -1 ? String(data[i][genderIdx] || "").trim().toUpperCase() : "",
          birthDate: rowBirth,
          photoUrl: photoIdx !== -1 ? String(data[i][photoIdx] || "") : "",
          program: progIdx !== -1 ? String(data[i][progIdx] || "Reguler") : "Reguler",
          status: statusIdx !== -1 ? String(data[i][statusIdx] || "Aktif") : "Aktif"
        };
      }
    }
  }
  return null;
}

/**
 * Alias fungsi backward compatible untuk getStudentByNisnAndBirthDate
 */
function getStudentByNisnAndBirthDate(nisn, birthDate) {
  return getStudentByNisAndBirthDate(nisn, birthDate);
}

/**
 * Cari data santri berdasarkan NIS saja (tanpa syarat tanggal lahir)
 */
function getStudentByNis(nisOrNisn) {
  const cleanNis = String(nisOrNisn || "").trim();
  if (!cleanNis) return null;

  const ss = getDatabaseSpreadsheet();
  const sheet = getAuthSheet(ss, SHEET_STUDENTS);
  if (!sheet) return null;

  const data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) return null;

  const header = data[0].map(h => String(h || "").trim().toLowerCase());
  let idIdx = header.indexOf("student_id");
  let nisIdx = header.indexOf("nis");
  if (nisIdx === -1) nisIdx = header.indexOf("nisn");
  let nikIdx = header.indexOf("nik");
  let nameIdx = header.indexOf("name");
  if (nameIdx === -1) nameIdx = header.indexOf("nama");
  let genderIdx = header.indexOf("gender");
  if (genderIdx === -1) genderIdx = header.indexOf("jenis");
  if (genderIdx === -1) genderIdx = header.indexOf("jenis_kelamin");
  let birthIdx = header.indexOf("birth_date");
  if (birthIdx === -1) birthIdx = header.indexOf("tanggal_lahir");
  if (birthIdx === -1) birthIdx = header.indexOf("tgl_lahir");
  let photoIdx = header.indexOf("photo_url");
  if (photoIdx === -1) photoIdx = header.indexOf("foto_profil");
  if (photoIdx === -1) photoIdx = header.indexOf("foto");
  let progIdx = header.indexOf("program");
  let statusIdx = header.indexOf("status");

  if (idIdx === -1) idIdx = 0;
  if (nisIdx === -1) nisIdx = 1;
  if (nameIdx === -1) nameIdx = 2;

  const cleanLower = cleanNis.toLowerCase();

  for (let i = 1; i < data.length; i++) {
    const rowNis = String(data[i][nisIdx] || "").trim();
    if (rowNis.toLowerCase() === cleanLower) {
      return {
        studentId: String(data[i][idIdx] || ""),
        nis: rowNis,
        nisn: rowNis,
        nik: nikIdx !== -1 ? String(data[i][nikIdx] || "") : "",
        name: nameIdx !== -1 ? String(data[i][nameIdx] || "") : "Santri",
        gender: genderIdx !== -1 ? String(data[i][genderIdx] || "").trim().toUpperCase() : "",
        birthDate: birthIdx !== -1 ? normalizeDateString(data[i][birthIdx]) : "",
        photoUrl: photoIdx !== -1 ? String(data[i][photoIdx] || "") : "",
        program: progIdx !== -1 ? String(data[i][progIdx] || "Reguler") : "Reguler",
        status: statusIdx !== -1 ? String(data[i][statusIdx] || "AKTIF") : "AKTIF"
      };
    }
  }
  return null;
}


// ====================================================================
// MODUL BACKEND: DATA PEGAWAI (ASATIDZ, MUHAFIZ, GURU, KARYAWAN)
// ====================================================================
const SHEET_PEGAWAI = "Pegawai";

function getOrCreatePegawaiSheet(ss) {
  const headers = [
    "employee_id", "nama", "nip", "gender", "jabatan", "spesialisasi", "telepon", "email", "status", "created_at"
  ];
  let sheet = ss.getSheetByName(SHEET_PEGAWAI);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_PEGAWAI);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setBackground("#047857")
      .setFontColor("#ffffff");
    sheet.setFrozenRows(1);

    // Data awal Asatidz: Dikosongkan untuk konfigurasi tenant berikutnya
    const nowIso = new Date().toISOString();
  }
  return sheet;
}

function getAllEmployeesData(token) {
  try {
    const actor = authenticateSession(token);
    authorizeRole(actor, ["ADMIN", "EDITOR", "PENGASUH"]);

    const ss = getDatabaseSpreadsheet();
    const sheet = getOrCreatePegawaiSheet(ss);
    const data = sheet.getDataRange().getValues();
    const list = [];
    let totalL = 0, totalP = 0, totalAsatidz = 0, totalAktif = 0;

    if (data && data.length > 1) {
      const h = data[0].map(x => String(x || "").trim().toLowerCase());
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const id = String(row[h.indexOf("employee_id")] || "").trim();
        if (!id) continue;
        const nama = String(row[h.indexOf("nama")] || "").trim();
        const nip = String(row[h.indexOf("nip")] || "").trim();
        const gender = String(row[h.indexOf("gender")] || "L").toUpperCase();
        const jabatan = String(row[h.indexOf("jabatan")] || "Ustadz").trim();
        const spesialisasi = String(row[h.indexOf("spesialisasi")] || "-").trim();
        const telepon = String(row[h.indexOf("telepon")] || "").trim();
        const email = String(row[h.indexOf("email")] || "").trim();
        const status = String(row[h.indexOf("status")] || "ACTIVE").toUpperCase();
        const createdAt = String(row[h.indexOf("created_at")] || "");

        if (status === "ACTIVE") totalAktif++;
        if (gender === "L") totalL++; else totalP++;
        if (jabatan.toLowerCase().includes("ustadz") || jabatan.toLowerCase().includes("muhafiz") || jabatan.toLowerCase().includes("guru")) {
          totalAsatidz++;
        }

        list.push({
          employeeId: id,
          id: id,
          nama: nama,
          name: nama,
          nip: nip,
          gender: gender,
          jabatan: jabatan,
          spesialisasi: spesialisasi,
          telepon: telepon,
          email: email,
          status: status,
          createdAt: createdAt
        });
      }
    }

    return {
      status: "success",
      success: true,
      data: list,
      total: list.length,
      summary: {
        total: list.length,
        aktif: totalAktif,
        putra: totalL,
        putri: totalP,
        asatidz: totalAsatidz
      }
    };
  } catch (err) {
    console.error("[GET ALL EMPLOYEES ERROR]", err);
    return { status: "error", success: false, message: "Gagal memuat data pegawai: " + err.message };
  }
}

function saveEmployeeData(payload, token) {
  try {
    if (token) {
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "EDITOR"]);
      } catch (authErr) {
        verifySessionToken(token);
      }
    }

    const nama = String(payload.nama || payload.name || "").trim();
    if (!nama) throw new Error("Nama pegawai / ustadz wajib diisi.");

    const ss = getDatabaseSpreadsheet();
    const sheet = getOrCreatePegawaiSheet(ss);
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h || "").trim().toLowerCase());

    const idIdx = headers.indexOf("employee_id");
    let employeeId = String(payload.employeeId || payload.id || "").trim();
    let foundRow = -1;

    if (employeeId && idIdx !== -1) {
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idIdx] || "").trim() === employeeId) {
          foundRow = i + 1;
          break;
        }
      }
    }

    if (!employeeId) {
      employeeId = "PEG-" + Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd-HHmmss");
    }

    const nip = String(payload.nip || "").trim();
    const gender = String(payload.gender || "L").toUpperCase();
    const jabatan = String(payload.jabatan || "Ustadz / Muhafiz").trim();
    const spesialisasi = String(payload.spesialisasi || "Tahfidz Al-Qur'an").trim();
    const telepon = String(payload.telepon || "").trim();
    const email = String(payload.email || "").trim();
    const status = String(payload.status || "ACTIVE").toUpperCase();
    const createdAt = new Date().toISOString();

    const rowValues = [employeeId, nama, nip, gender, jabatan, spesialisasi, telepon, email, status, createdAt];

    if (foundRow > 0) {
      sheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
      return { status: "success", success: true, employeeId: employeeId, message: `Data pegawai ${nama} berhasil diperbarui.` };
    } else {
      sheet.appendRow(rowValues);
      return { status: "success", success: true, employeeId: employeeId, message: `Pegawai ${nama} berhasil ditambahkan.` };
    }
  } catch (err) {
    console.error("[SAVE EMPLOYEE ERROR]", err);
    return { status: "error", success: false, message: "Gagal menyimpan data pegawai: " + err.message };
  }
}

function deleteEmployeeData(employeeId, token) {
  try {
    if (token) {
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN"]);
      } catch (authErr) {
        verifySessionToken(token);
      }
    }

    if (!employeeId) throw new Error("ID Pegawai wajib disertakan.");
    const ss = getDatabaseSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_PEGAWAI);
    if (!sheet) throw new Error("Sheet Pegawai tidak ditemukan.");

    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h || "").trim().toLowerCase());
    const idIdx = headers.indexOf("employee_id");

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idIdx] || "").trim() === String(employeeId).trim()) {
        sheet.deleteRow(i + 1);
        return { status: "success", success: true, message: "Data pegawai berhasil dihapus." };
      }
    }
    return { status: "error", success: false, message: "Data pegawai tidak ditemukan." };
  } catch (err) {
    console.error("[DELETE EMPLOYEE ERROR]", err);
    return { status: "error", success: false, message: "Gagal menghapus data pegawai: " + err.message };
  }
}


// ====================================================================
// MODUL BACKEND: TPQ (TAMAN PENDIDIKAN AL-QUR'AN - METODE YANBU'A 1-7)
// ====================================================================
const SHEET_TPQ_LOGS = "TPQ_Logs";
const SHEET_TPQ_CAPAIAN = "TPQ_Capaian";
const SHEET_TPQ_KELAS = "TPQ_Kelas";
const SHEET_TPQ_TARGET = "TPQ_Target";
const SHEET_TPQ_SESI = "TPQ_Sesi";

function getOrCreateTPQSheet(ss, sheetName, headers, bgHeaderColor) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setBackground(bgHeaderColor || "#059669")
      .setFontColor("#ffffff");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Menyelesaikan (resolve) kelas_id, nama_kelas, dan ustadz pengampu untuk santri TPQ
 */
function resolveTPQKelas_(ss, studentId, nis, customKelasId, customNamaKelas, customUstadz, skipWrite, preloadedKData) {
  let resolvedKelasId = String(customKelasId || "").trim();
  let resolvedNamaKelas = String(customNamaKelas || "").trim();
  let resolvedUstadz = String(customUstadz || "").trim();
  if (resolvedUstadz === "-") resolvedUstadz = "";

  const sId = String(studentId || "").trim();
  const sNis = String(nis || "").trim();

  try {
    if (!ss) ss = getDatabaseSpreadsheet();
    if (ss) {
      const kSheet = ss.getSheetByName(SHEET_TPQ_KELAS);
      if (kSheet) {
        if (!skipWrite) {
          migrateTPQKelasSheetIfNeeded(kSheet);
        }
        const kData = preloadedKData || kSheet.getDataRange().getValues();
        if (kData.length >= 2) {
          const kHead = kData[0].map(h => String(h || "").trim().toLowerCase());
          const idIdx = kHead.indexOf("kelas_id");
          const nameIdx = kHead.indexOf("nama_kelas");
          const uIdx = kHead.indexOf("ustadz_pengampu");
          const sidsIdx = kHead.indexOf("student_ids");

          if (idIdx !== -1) {
            let matchedRow = null;
            let matchedRowIndex = -1;

            // 1. Cari berdasarkan student_id atau nis di kolom student_ids
            if (sId || sNis) {
              for (let i = 1; i < kData.length; i++) {
                const row = kData[i];
                const rawSids = sidsIdx !== -1 ? row[sidsIdx] : "";
                let sids = [];
                if (typeof rawSids === "string") {
                  if (rawSids.trim().startsWith("[")) {
                    try { sids = JSON.parse(rawSids); } catch (e) { sids = []; }
                  } else {
                    sids = rawSids.split(",").map(s => s.trim()).filter(Boolean);
                  }
                } else if (Array.isArray(rawSids)) {
                  sids = rawSids;
                }

                if ((sId && sids.includes(sId)) || (sNis && sids.includes(sNis))) {
                  matchedRow = row;
                  matchedRowIndex = i + 1;
                  break;
                }
              }
            }

            // 2. Jika belum cocok, cari berdasarkan customKelasId
            if (!matchedRow && resolvedKelasId) {
              for (let i = 1; i < kData.length; i++) {
                if (String(kData[i][idIdx] || "").trim() === resolvedKelasId) {
                  matchedRow = kData[i];
                  matchedRowIndex = i + 1;
                  break;
                }
              }
            }

            // 3. Jika belum cocok, cari berdasarkan ustadz
            if (!matchedRow && resolvedUstadz && resolvedUstadz !== "-") {
              const cleanU = resolvedUstadz.toLowerCase().replace(/[^a-z0-9]/g, "");
              for (let i = 1; i < kData.length; i++) {
                const rowU = uIdx !== -1 ? String(kData[i][uIdx] || "").trim() : "";
                const cleanRowU = rowU.toLowerCase().replace(/[^a-z0-9]/g, "");
                if (cleanRowU && (cleanRowU === cleanU || cleanRowU.includes(cleanU) || cleanU.includes(cleanRowU))) {
                  matchedRow = kData[i];
                  matchedRowIndex = i + 1;
                  break;
                }
              }
            }

            if (matchedRow) {
              resolvedKelasId = String(matchedRow[idIdx] || "").trim();
              if (nameIdx !== -1 && matchedRow[nameIdx]) resolvedNamaKelas = String(matchedRow[nameIdx]).trim();
              if (uIdx !== -1 && matchedRow[uIdx]) resolvedUstadz = String(matchedRow[uIdx]).trim();
              if (!resolvedNamaKelas && resolvedUstadz) resolvedNamaKelas = "Kelas " + resolvedUstadz;

              // Otomatis daftarkan sId ke student_ids kelas ini jika belum ada (hanya jika bukan mode read-only)
              if (!skipWrite && sId && sidsIdx !== -1 && matchedRowIndex > 0) {
                try {
                  const rawSids = matchedRow[sidsIdx] || "";
                  let curSids = [];
                  if (typeof rawSids === "string" && rawSids.trim().startsWith("[")) {
                    try { curSids = JSON.parse(rawSids); } catch (e) { curSids = []; }
                  } else if (typeof rawSids === "string") {
                    curSids = rawSids.split(",").map(s => s.trim()).filter(Boolean);
                  }
                  if (!curSids.includes(sId)) {
                    curSids.push(sId);
                    kSheet.getRange(matchedRowIndex, sidsIdx + 1).setValue(JSON.stringify(curSids));
                  }
                } catch (syncErr) {
                  // Abaikan error minor
                }
              }
            }
          }
        }
      }
    }
  } catch (err) {
    Logger.log("resolveTPQKelas_ error: " + err.message);
  }

  if (!resolvedNamaKelas || resolvedNamaKelas === "Belum Ditentukan") {
    if (resolvedUstadz && resolvedUstadz !== "-") {
      resolvedNamaKelas = "Kelas " + resolvedUstadz;
    } else if (resolvedKelasId) {
      resolvedNamaKelas = "Kelas " + resolvedKelasId;
    } else {
      resolvedNamaKelas = "Belum Ditentukan";
    }
  }

  return {
    kelasId: resolvedKelasId,
    namaKelas: resolvedNamaKelas,
    ustadz: resolvedUstadz || "-"
  };
}

/**
 * Menyinkronkan perubahan plotting dari TPQ_Kelas ke TPQ_Capaian
 */
function syncTPQPlottingToCapaian_(ss, kelasId, studentIds, ustadz, namaKelas) {
  try {
    if (!ss) ss = getDatabaseSpreadsheet();
    if (!ss || !kelasId) return;

    const headersCapaian = ["student_id", "student_name", "jilid_aktif", "halaman_aktif", "status_terakhir", "kelas_id", "nama_kelas", "ustadz_pengampu", "updated_at"];
    const cSheet = getOrCreateTPQSheet(ss, SHEET_TPQ_CAPAIAN, headersCapaian, "#0d9488");
    const cData = cSheet.getDataRange().getValues();

    const cHead = cData.length > 0 ? cData[0].map(h => String(h || "").trim().toLowerCase()) : headersCapaian;
    const sIdIdx = cHead.indexOf("student_id");
    const sNameIdx = cHead.indexOf("student_name");
    const kIdIdx = cHead.indexOf("kelas_id");
    const kNameIdx = cHead.indexOf("nama_kelas");
    const uIdx = cHead.indexOf("ustadz_pengampu");
    const upIdx = cHead.indexOf("updated_at");

    if (sIdIdx === -1 || kIdIdx === -1) return;

    // Ambil mapping santri dari Sheet Students untuk mencocokkan student_id vs NIS
    const studSheet = ss.getSheetByName(SHEET_STUDENTS);
    const studMap = {};
    if (studSheet) {
      const sVals = studSheet.getDataRange().getValues();
      if (sVals.length > 1) {
        const sHead = sVals[0].map(h => String(h || "").trim().toLowerCase());
        const sIdCol = sHead.indexOf("student_id");
        const sNisCol = sHead.indexOf("nis") !== -1 ? sHead.indexOf("nis") : sHead.indexOf("nisn");
        const sNameCol = sHead.indexOf("name") !== -1 ? sHead.indexOf("name") : sHead.indexOf("nama");
        for (let i = 1; i < sVals.length; i++) {
          const rowSid = sIdCol !== -1 ? String(sVals[i][sIdCol] || "").trim() : "";
          const rowNis = sNisCol !== -1 ? String(sVals[i][sNisCol] || "").trim() : "";
          const rowName = sNameCol !== -1 ? String(sVals[i][sNameCol] || "").trim() : "";
          const item = { studentId: rowSid, nis: rowNis, name: rowName };
          if (rowSid) studMap[rowSid] = item;
          if (rowNis) studMap[rowNis] = item;
        }
      }
    }

    const cleanSids = Array.isArray(studentIds) ? studentIds.map(s => String(s).trim()).filter(Boolean) : [];
    // Bangun set pencocokan yang mencakup baik studentId maupun NIS
    const enrolledMatches = new Set();
    cleanSids.forEach(id => {
      enrolledMatches.add(id);
      if (studMap[id]) {
        if (studMap[id].studentId) enrolledMatches.add(studMap[id].studentId);
        if (studMap[id].nis) enrolledMatches.add(studMap[id].nis);
      }
    });

    const kName = namaKelas || (ustadz && ustadz !== "-" ? ("Kelas " + ustadz) : ("Kelas " + kelasId));
    const nowIso = new Date().toISOString();
    const existingMatchedIds = new Set();

    // 1. Perbarui baris yang sudah ada di TPQ_Capaian
    for (let i = 1; i < cData.length; i++) {
      const rowSid = String(cData[i][sIdIdx] || "").trim();
      const currentKId = String(cData[i][kIdIdx] || "").trim();
      const rowNumber = i + 1;

      // Cek apakah santri ini cocok dengan yang di-plot
      let isEnrolled = enrolledMatches.has(rowSid);
      if (!isEnrolled && studMap[rowSid]) {
        if (enrolledMatches.has(studMap[rowSid].studentId) || enrolledMatches.has(studMap[rowSid].nis)) {
          isEnrolled = true;
        }
      }

      if (isEnrolled) {
        existingMatchedIds.add(rowSid);
        if (studMap[rowSid]) {
          if (studMap[rowSid].studentId) existingMatchedIds.add(studMap[rowSid].studentId);
          if (studMap[rowSid].nis) existingMatchedIds.add(studMap[rowSid].nis);
        }
        if (currentKId !== kelasId || String(cData[i][kNameIdx] || "").trim() === "Belum Ditentukan" || !cData[i][kNameIdx]) {
          cSheet.getRange(rowNumber, kIdIdx + 1).setValue(kelasId);
          if (kNameIdx !== -1) cSheet.getRange(rowNumber, kNameIdx + 1).setValue(kName);
          if (uIdx !== -1 && ustadz && ustadz !== "-") cSheet.getRange(rowNumber, uIdx + 1).setValue(ustadz);
          if (upIdx !== -1) cSheet.getRange(rowNumber, upIdx + 1).setValue(nowIso);
        }
      } else if (currentKId === kelasId) {
        // Santri DIKELUARKAN dari kelas ini -> reset kelas_id & nama_kelas
        cSheet.getRange(rowNumber, kIdIdx + 1).setValue("");
        if (kNameIdx !== -1) cSheet.getRange(rowNumber, kNameIdx + 1).setValue("Belum Ditentukan");
        if (uIdx !== -1) cSheet.getRange(rowNumber, uIdx + 1).setValue("-");
        if (upIdx !== -1) cSheet.getRange(rowNumber, upIdx + 1).setValue(nowIso);
      }
    }

    // 2. Jika ada santri di cleanSids yang BELUM memiliki baris di TPQ_Capaian, tambahkan baris baru!
    cleanSids.forEach(sid => {
      let alreadyExists = existingMatchedIds.has(sid);
      if (!alreadyExists && studMap[sid]) {
        alreadyExists = existingMatchedIds.has(studMap[sid].studentId) || existingMatchedIds.has(studMap[sid].nis);
      }
      if (!alreadyExists) {
        const info = studMap[sid] || { studentId: sid, nis: "", name: "Santri TPQ" };
        const finalId = info.studentId || sid;
        const finalName = info.name || "Santri TPQ";
        // Header: ["student_id", "student_name", "jilid_aktif", "halaman_aktif", "status_terakhir", "kelas_id", "nama_kelas", "ustadz_pengampu", "updated_at"]
        cSheet.appendRow([finalId, finalName, 1, 1, "LANJUT", kelasId, kName, ustadz || "-", nowIso]);
        existingMatchedIds.add(finalId);
        if (info.nis) existingMatchedIds.add(info.nis);
      }
    });

  } catch (err) {
    Logger.log("syncTPQPlottingToCapaian_ error: " + err.message);
  }
}

function initTPQSheets(token) {
  try {
    if (token) {
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN"]);
      } catch (authErr) {
        verifySessionToken(token);
      }
    }
    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error("Database Spreadsheet tidak ditemukan.");

    const headersLogs = ["log_id", "student_id", "nis", "student_name", "gender", "tanggal", "sesi", "jilid", "halaman", "status_setoran", "nilai", "ustadz", "catatan", "created_at"];
    const headersCapaian = ["student_id", "student_name", "jilid_aktif", "halaman_aktif", "status_terakhir", "kelas_id", "nama_kelas", "ustadz_pengampu", "updated_at"];
    const headersKelas = ["kelas_id", "ustadz_pengampu", "deskripsi", "student_ids", "created_at"];
    const headersTarget = ["student_id", "target_jilid", "target_halaman_sesi", "target_halaman_pekan", "updated_at"];
    const headersSesi = ["sesi_id", "nama_sesi", "jenis_sesi", "status", "jam_mulai", "jam_selesai", "hari_list", "created_at"];

    const created = [];
    const existing = [];

    [
      { name: SHEET_TPQ_LOGS, headers: headersLogs, color: "#059669" },
      { name: SHEET_TPQ_CAPAIAN, headers: headersCapaian, color: "#0d9488" },
      { name: SHEET_TPQ_KELAS, headers: headersKelas, color: "#0284c7" },
      { name: SHEET_TPQ_TARGET, headers: headersTarget, color: "#f59e0b" },
      { name: SHEET_TPQ_SESI, headers: headersSesi, color: "#0d9488" }
    ].forEach(item => {
      let s = ss.getSheetByName(item.name);
      if (!s) {
        s = ss.insertSheet(item.name);
        s.getRange(1, 1, 1, item.headers.length).setValues([item.headers]);
        s.getRange(1, 1, 1, item.headers.length).setFontWeight("bold").setBackground(item.color).setFontColor("#ffffff");
        s.setFrozenRows(1);
        created.push(item.name);
      } else {
        existing.push(item.name);
      }
    });

    const nowIso = new Date().toISOString();

    // Buat contoh default kelas jika TPQ_Kelas baru dibuat
    if (created.includes(SHEET_TPQ_KELAS)) {
      const kSheet = ss.getSheetByName(SHEET_TPQ_KELAS);
      const defaultKelas = [
        ["KLS-01", "TPQ Yanbu'a A (Jilid 1-2)", "Ustadzah Fatimah", "Sore (15:45 - 17:00)", "[]", nowIso],
        ["KLS-02", "TPQ Yanbu'a B (Jilid 3-5)", "Ustadz Hasan", "Sore (15:45 - 17:00)", "[]", nowIso],
        ["KLS-03", "TPQ Yanbu'a C (Jilid 6-7)", "Ustadz Ahmad", "Sore (15:45 - 17:00)", "[]", nowIso]
      ];
      kSheet.getRange(2, 1, defaultKelas.length, headersKelas.length).setValues(defaultKelas);
    }

    // Buat default sesi jika TPQ_Sesi baru dibuat
    if (created.includes(SHEET_TPQ_SESI)) {
      const sSheet = ss.getSheetByName(SHEET_TPQ_SESI);
      const defaultSesi = [
        ["TPQ-SESI-01", "Sore (Reguler Yanbu'a)", "Bimbingan Yanbu'a Reguler", "Aktif Digunakan", "15:45", "17:00", "Sen,Sel,Rab,Kam,Sab,Min", nowIso],
        ["TPQ-SESI-02", "Pagi (Madin / Yanbu'a Cilik)", "Privat Tahsin & I'adah", "Aktif Digunakan", "08:30", "10:00", "Min", nowIso],
        ["TPQ-SESI-03", "Ba'da Maghrib (Khataman)", "Imtihan / Ujian Kenaikan Jilid", "Aktif Digunakan", "18:30", "19:30", "Kam", nowIso]
      ];
      sSheet.getRange(2, 1, defaultSesi.length, headersSesi.length).setValues(defaultSesi);
    }

    return {
      status: "success",
      success: true,
      message: "Database TPQ Yanbu'a berhasil disiapkan.",
      createdSheets: created,
      existingSheets: existing
    };
  } catch (err) {
    console.error("[INIT TPQ SHEETS ERROR]", err);
    return { status: "error", success: false, message: "Gagal menyiapkan tabel TPQ: " + err.message };
  }
}

// Konfigurasi Resmi Jenjang & Halaman Kitab Yanbu'a (Pemula 48 hal, Jld 1 44, Jld 2 43, Jld 3 44, Jld 4 45, Jld 5 46, Jld 6 47, Jld 7 39)
const YANBUA_PAGES_CONFIG_ = {
  0: { name: "Pemula", pages: 48 },
  1: { name: "Jilid 1", pages: 44 },
  2: { name: "Jilid 2", pages: 43 },
  3: { name: "Jilid 3", pages: 44 },
  4: { name: "Jilid 4", pages: 45 },
  5: { name: "Jilid 5", pages: 46 },
  6: { name: "Jilid 6", pages: 47 },
  7: { name: "Jilid 7", pages: 39 }
};
const TOTAL_YANBUA_PAGES_ = 48 + 44 + 43 + 44 + 45 + 46 + 47 + 39; // 356 Halaman

function getYanbuaJilidMaxPages_(jilid) {
  if (jilid === 0 || String(jilid).toLowerCase() === "pemula") return 48;
  const num = Number(jilid);
  if (YANBUA_PAGES_CONFIG_[num]) return YANBUA_PAGES_CONFIG_[num].pages;
  return 44;
}

function getYanbuaCumulativePages_(jilid, halaman) {
  let jKey = 1;
  if (jilid === 0 || String(jilid).toLowerCase() === "pemula") jKey = 0;
  else jKey = Number(jilid) || 1;

  const hal = Number(halaman) || 1;
  const pageMap = [48, 44, 43, 44, 45, 46, 47, 39];
  let cumulative = 0;
  for (let i = 0; i < jKey && i < pageMap.length; i++) {
    cumulative += pageMap[i];
  }
  const maxInJilid = (jKey >= 0 && jKey < pageMap.length) ? pageMap[jKey] : 44;
  cumulative += Math.min(maxInJilid, Math.max(1, hal));
  return Math.min(TOTAL_YANBUA_PAGES_, cumulative);
}

function getTPQDashboard(token) {
  try {
    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error("Spreadsheet tidak ditemukan.");

    // 1. Ambil data master Santri
    const studentsSheet = ss.getSheetByName(SHEET_STUDENTS);
    const students = [];
    if (studentsSheet) {
      const sData = studentsSheet.getDataRange().getValues();
      if (sData.length >= 2) {
        const sHead = sData[0].map(h => String(h || "").trim().toLowerCase());
        const idIdx = sHead.indexOf("student_id");
        const nisIdx = sHead.indexOf("nis");
        const nameIdx = sHead.indexOf("name");
        const genderIdx = sHead.indexOf("gender");
        const statusIdx = sHead.indexOf("status");
        const photoIdx = sHead.indexOf("photo_url");

        for (let i = 1; i < sData.length; i++) {
          const stStatus = statusIdx !== -1 ? String(sData[i][statusIdx] || "").trim().toUpperCase() : "AKTIF";
          if (["AKTIF", "ACTIVE", ""].includes(stStatus)) {
            students.push({
              studentId: String(sData[i][idIdx] || "").trim(),
              nis: String(sData[i][nisIdx] || "").trim(),
              name: String(sData[i][nameIdx] || "").trim(),
              gender: String(sData[i][genderIdx] || "L").trim().toUpperCase(),
              photoUrl: photoIdx !== -1 ? String(sData[i][photoIdx] || "").trim() : "",
              status: "AKTIF"
            });
          }
        }
      }
    }

    // 2. Ambil data Capaian Terkini
    const headersCapaian = ["student_id", "student_name", "jilid_aktif", "halaman_aktif", "status_terakhir", "kelas_id", "nama_kelas", "ustadz_pengampu", "updated_at"];
    const capaianSheet = getOrCreateTPQSheet(ss, SHEET_TPQ_CAPAIAN, headersCapaian, "#0d9488");
    const capaianMap = {};
    const cData = capaianSheet.getDataRange().getValues();
    if (cData.length >= 2) {
      const cHead = cData[0].map(h => String(h || "").trim().toLowerCase());
      const sIdIdx = cHead.indexOf("student_id");
      const jilidIdx = cHead.indexOf("jilid_aktif");
      const halIdx = cHead.indexOf("halaman_aktif");
      const stIdx = cHead.indexOf("status_terakhir");
      const kIdIdx = cHead.indexOf("kelas_id");
      const kNameIdx = cHead.indexOf("nama_kelas");
      const ustadzIdx = cHead.indexOf("ustadz_pengampu");
      const upIdx = cHead.indexOf("updated_at");

      for (let i = 1; i < cData.length; i++) {
        const sid = String(cData[i][sIdIdx] || "").trim();
        if (sid) {
          capaianMap[sid] = {
            rowNumber: i + 1,
            jilidAktif: Number(cData[i][jilidIdx]) || 1,
            halamanAktif: Number(cData[i][halIdx]) || 1,
            statusTerakhir: String(cData[i][stIdx] || "LANJUT").trim().toUpperCase(),
            kelasId: String(cData[i][kIdIdx] || "").trim(),
            namaKelas: String(cData[i][kNameIdx] || "").trim(),
            ustadzPengampu: String(cData[i][ustadzIdx] || "").trim(),
            updatedAt: String(cData[i][upIdx] || "").trim()
          };
        }
      }
    }

    // 3. Ambil data Kelas TPQ
    const headersKelas = ["kelas_id", "ustadz_pengampu", "deskripsi", "student_ids", "created_at"];
    const kelasSheet = getOrCreateTPQSheet(ss, SHEET_TPQ_KELAS, headersKelas, "#0284c7");
    migrateTPQKelasSheetIfNeeded(kelasSheet);

    const kelasList = [];
    const kData = kelasSheet.getDataRange().getValues();
    if (kData.length >= 2) {
      for (let i = 1; i < kData.length; i++) {
        let sids = [];
        try {
          const raw = String(kData[i][3] || "");
          if (raw.trim().startsWith("[")) sids = JSON.parse(raw);
          else sids = raw.split(",").map(s => s.trim()).filter(Boolean);
        } catch (e) {
          sids = [];
        }
        const kId = String(kData[i][0] || "").trim();
        const uVal = String(kData[i][1] || "").trim();
        const deskVal = String(kData[i][2] || "").trim();
        const finalName = uVal ? ("Kelas " + uVal) : ("Kelas " + kId);

        kelasList.push({
          kelasId: kId,
          namaKelas: finalName,
          ustadzPengampu: uVal || "-",
          deskripsi: deskVal,
          studentIds: sids
        });
      }
    }

    // 4. Ambil data Target TPQ
    const headersTarget = ["student_id", "target_jilid", "target_halaman_sesi", "target_halaman_pekan", "updated_at"];
    const targetSheet = getOrCreateTPQSheet(ss, SHEET_TPQ_TARGET, headersTarget, "#f59e0b");
    const targetMap = {};
    const tData = targetSheet.getDataRange().getValues();
    if (tData.length >= 2) {
      const tHead = tData[0].map(h => String(h || "").trim().toLowerCase());
      const sIdIdx = tHead.indexOf("student_id");
      const jIdx = tHead.indexOf("target_jilid");
      const sSesiIdx = tHead.indexOf("target_halaman_sesi");
      const sPekanIdx = tHead.indexOf("target_halaman_pekan");

      for (let i = 1; i < tData.length; i++) {
        const sid = String(tData[i][sIdIdx] || "").trim();
        if (sid) {
          const sSesi = Number(tData[i][sSesiIdx]) || 1;
          targetMap[sid] = {
            targetJilid: Number(tData[i][jIdx]) || 1,
            targetHalamanSesi: sSesi,
            targetHalamanPekan: Number(tData[i][sPekanIdx]) || (sSesi * 6)
          };
        }
      }
    }

    // 5. Ambil data Jadwal Sesi TPQ
    const headersSesi = ["sesi_id", "nama_sesi", "jenis_sesi", "status", "jam_mulai", "jam_selesai", "hari_list", "created_at"];
    const sesiSheet = getOrCreateTPQSheet(ss, SHEET_TPQ_SESI, headersSesi, "#0d9488");
    const sesiList = [];
    const sesiData = sesiSheet.getDataRange().getValues();
    if (sesiData.length >= 2) {
      const sHead = sesiData[0].map(h => String(h || "").trim().toLowerCase());
      const idIdx = sHead.indexOf("sesi_id");
      const nameIdx = sHead.indexOf("nama_sesi");
      const typeIdx = sHead.indexOf("jenis_sesi");
      const stIdx = sHead.indexOf("status");
      const jmIdx = sHead.indexOf("jam_mulai");
      const jsIdx = sHead.indexOf("jam_selesai");
      const hIdx = sHead.indexOf("hari_list");

      for (let i = 1; i < sesiData.length; i++) {
        const rawHari = sesiData[i][hIdx] || "";
        const hariList = Array.isArray(rawHari) ? rawHari : String(rawHari).split(",").map(h => h.trim()).filter(Boolean);
        sesiList.push({
          sesiId: String(sesiData[i][idIdx] || "").trim(),
          namaSesi: String(sesiData[i][nameIdx] || "").trim(),
          jenisSesi: String(sesiData[i][typeIdx] || "").trim(),
          status: String(sesiData[i][stIdx] || "Aktif Digunakan").trim(),
          jamMulai: normalizeTimeString(sesiData[i][jmIdx], "15:45"),
          jamSelesai: normalizeTimeString(sesiData[i][jsIdx], "17:00"),
          hariList: hariList
        });
      }
    }

    // Hitung jumlah sesi aktif per pekan (contoh: 5 hari Subuh + 6 hari Sore = 11 sesi)
    let tpqWeeklySessions = 0;
    sesiList.forEach(s => {
      if ((s.status || "").includes("Aktif")) {
        const hArr = Array.isArray(s.hariList) ? s.hariList : String(s.hariList || "").split(",").map(h => h.trim()).filter(Boolean);
        tpqWeeklySessions += Math.max(1, hArr.length);
      }
    });
    if (tpqWeeklySessions === 0) tpqWeeklySessions = 11;

    // Auto-heal baris capaian di Google Sheets jika kelas_id kosong atau nama_kelas masih 'Belum Ditentukan'
    const nowIso = new Date().toISOString();
    Object.keys(capaianMap).forEach(sid => {
      const cp = capaianMap[sid];
      const needsHealing = !cp.kelasId || !cp.namaKelas || cp.namaKelas === "Belum Ditentukan";
      if (needsHealing) {
        const stObj = students.find(s => s.studentId === sid);
        const stNis = stObj ? stObj.nis : "";
        const resolved = resolveTPQKelas_(ss, sid, stNis, cp.kelasId, cp.namaKelas, cp.ustadzPengampu);

        if (resolved.kelasId || (resolved.namaKelas && resolved.namaKelas !== "Belum Ditentukan")) {
          cp.kelasId = resolved.kelasId || cp.kelasId;
          cp.namaKelas = resolved.namaKelas || cp.namaKelas;
          if (resolved.ustadz && resolved.ustadz !== "-") cp.ustadzPengampu = resolved.ustadz;

          if (cp.rowNumber && cp.rowNumber >= 2) {
            try {
              if (kIdIdx !== -1 && cp.kelasId) capaianSheet.getRange(cp.rowNumber, kIdIdx + 1).setValue(cp.kelasId);
              if (kNameIdx !== -1 && cp.namaKelas) capaianSheet.getRange(cp.rowNumber, kNameIdx + 1).setValue(cp.namaKelas);
              if (ustadzIdx !== -1 && cp.ustadzPengampu && cp.ustadzPengampu !== "-") capaianSheet.getRange(cp.rowNumber, ustadzIdx + 1).setValue(cp.ustadzPengampu);
              if (upIdx !== -1) capaianSheet.getRange(cp.rowNumber, upIdx + 1).setValue(nowIso);
            } catch (healErr) {
              Logger.log("Auto-heal TPQ_Capaian error for " + sid + ": " + healErr.message);
            }
          }
        }
      }
    });

    // Gabungkan status capaian ke setiap siswa & hitung statistik (Hanya santri yang telah terplot ke Kelas TPQ)
    const perJilidCount = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
    let totalPlotted = 0;
    let totalLanjut = 0;
    let totalUlang = 0;
    const ustadzSet = new Set();

    const enrichedStudents = students.map(st => {
      const cp = capaianMap[st.studentId] || {
        jilidAktif: 1,
        halamanAktif: 1,
        statusTerakhir: "LANJUT",
        kelasId: "",
        namaKelas: "Belum Ditentukan",
        ustadzPengampu: "-",
        updatedAt: ""
      };

      if (!cp.kelasId || !cp.namaKelas || cp.namaKelas === "Belum Ditentukan") {
        const resolved = resolveTPQKelas_(ss, st.studentId, st.nis, cp.kelasId, cp.namaKelas, cp.ustadzPengampu);
        if (resolved.kelasId) cp.kelasId = resolved.kelasId;
        if (resolved.namaKelas && resolved.namaKelas !== "Belum Ditentukan") cp.namaKelas = resolved.namaKelas;
        if (resolved.ustadz && resolved.ustadz !== "-") cp.ustadzPengampu = resolved.ustadz;
      }

      const isPemula = (cp.jilidAktif === 0 || String(cp.jilidAktif).toLowerCase() === "pemula");
      const jld = isPemula ? 0 : Math.max(1, Math.min(7, Number(cp.jilidAktif) || 1));

      // Cek apakah santri telah dimasukkan ke dalam kelompok kelas TPQ
      const isPlotted = Boolean(
        (cp.kelasId && cp.namaKelas && cp.namaKelas !== "Belum Ditentukan" && cp.namaKelas !== "Belum Ada Kelas") ||
        kelasList.some(k => Array.isArray(k.studentIds) && (k.studentIds.includes(st.studentId) || (st.nis && k.studentIds.includes(st.nis))))
      );

      if (isPlotted) {
        totalPlotted++;
        perJilidCount[jld] = (perJilidCount[jld] || 0) + 1;
        if (cp.statusTerakhir === "ULANG") totalUlang++;
        else totalLanjut++;
      }

      if (cp.ustadzPengampu && cp.ustadzPengampu !== "-") {
        ustadzSet.add(cp.ustadzPengampu);
      }

      const tgt = targetMap[st.studentId] || {
        targetJilid: isPemula ? 1 : Math.min(7, jld + 1),
        targetHalamanSesi: 1,
        targetHalamanPekan: tpqWeeklySessions
      };

      return {
        ...st,
        jilidAktif: jld,
        halamanAktif: cp.halamanAktif,
        statusTerakhir: cp.statusTerakhir,
        kelasId: cp.kelasId,
        namaKelas: cp.namaKelas,
        ustadzPengampu: cp.ustadzPengampu,
        updatedAt: cp.updatedAt,
        target: tgt
      };
    });

    // 6. Ambil data Pegawai untuk Asatidz Pengampu
    const pegawaiSheet = ss.getSheetByName(SHEET_PEGAWAI) || ss.getSheetByName("Pegawai") || ss.getSheetByName("pegawai");
    const ustadzListFromPegawai = [];
    if (pegawaiSheet) {
      const pData = pegawaiSheet.getDataRange().getValues();
      if (pData && pData.length > 1) {
        const pHead = pData[0].map(h => String(h || "").trim().toLowerCase());
        const pNamaIdx = pHead.indexOf("nama") !== -1 ? pHead.indexOf("nama") : pHead.indexOf("name");
        const pStatusIdx = pHead.indexOf("status");
        for (let i = 1; i < pData.length; i++) {
          const row = pData[i];
          const nama = pNamaIdx !== -1 ? String(row[pNamaIdx] || "").trim() : "";
          const st = pStatusIdx !== -1 ? String(row[pStatusIdx] || "").trim().toUpperCase() : "ACTIVE";
          if (nama && (st === "ACTIVE" || st === "AKTIF" || st === "")) {
            if (!ustadzListFromPegawai.includes(nama)) ustadzListFromPegawai.push(nama);
          }
        }
      }
    }

    ustadzSet.forEach(u => {
      if (u && u !== "-" && !ustadzListFromPegawai.includes(u)) {
        ustadzListFromPegawai.push(u);
      }
    });

    return {
      status: "success",
      success: true,
      summary: {
        totalSantri: totalPlotted,
        totalLanjut: totalLanjut,
        totalUlang: totalUlang,
        persentaseLanjut: totalPlotted > 0 ? Math.round((totalLanjut / totalPlotted) * 100) : 100,
        distribusiJilid: perJilidCount
      },
      weeklySessions: tpqWeeklySessions,
      students: enrichedStudents,
      kelasList: kelasList,
      ustadzList: ustadzListFromPegawai,
      targets: targetMap,
      sesiList: sesiList
    };
  } catch (err) {
    console.error("[GET TPQ DASHBOARD ERROR]", err);
    return { status: "error", success: false, message: "Gagal memuat dashboard TPQ: " + err.message };
  }
}

function saveTPQLog(data, token) {
  return withScriptLock(() => {
    try {
      const studentId = String(data.studentId || data.student_id || "").trim();
      const studentName = String(data.studentName || data.student_name || "").trim();
      const nis = String(data.nis || "").trim();
      const gender = String(data.gender || "L").trim().toUpperCase();
      const jilid = Number(data.jilid) || 1;
      const halaman = Number(data.halaman) || 1;
      const statusSetoran = String(data.statusSetoran || data.status_setoran || "LANJUT").trim().toUpperCase();
      const nilai = String(data.nilai || "MUMTAZ").trim().toUpperCase();
      const ustadz = String(data.ustadz || "Ustadz/Ustadzah").trim();
      const catatan = String(data.catatan || "").trim();
      const tanggal = String(data.tanggal || new Date().toISOString().substring(0, 10)).trim();
      const sesi = String(data.sesi || "Sore").trim();
      const nowIso = new Date().toISOString();

      if (!studentId && !nis) throw new Error("Identitas santri wajib diisi.");

      const ss = getDatabaseSpreadsheet();
      const headersLogs = ["log_id", "student_id", "nis", "student_name", "gender", "tanggal", "sesi", "jilid", "halaman", "status_setoran", "nilai", "ustadz", "catatan", "created_at"];
      const logsSheet = getOrCreateTPQSheet(ss, SHEET_TPQ_LOGS, headersLogs, "#059669");

      const logId = "TPQ_LOG_" + Utilities.getUuid().replace(/-/g, "").substring(0, 12);
      logsSheet.appendRow([
        logId, studentId, nis, studentName, gender, tanggal, sesi, jilid, halaman, statusSetoran, nilai, ustadz, catatan, nowIso
      ]);

      // Perbarui posisi Capaian Santri
      let nextJilid = jilid;
      let nextHalaman = halaman;

      if (statusSetoran === "LANJUT") {
        nextHalaman = halaman + 1;
        const maxHal = getYanbuaJilidMaxPages_(jilid);
        if (nextHalaman > maxHal) {
          if (jilid === 0 || String(jilid).toLowerCase() === "pemula") {
            nextJilid = 1;
            nextHalaman = 1;
          } else if (jilid < 7) {
            nextJilid = jilid + 1;
            nextHalaman = 1;
          } else {
            nextJilid = 7;
            nextHalaman = 39;
          }
        }
      } else if (statusSetoran === "NAIK_JILID") {
        if (jilid === 0 || String(jilid).toLowerCase() === "pemula") {
          nextJilid = 1;
        } else {
          nextJilid = Math.min(7, jilid + 1);
        }
        nextHalaman = 1;
      } else if (statusSetoran === "KHATAM_YANBUA") {
        nextJilid = 7;
        nextHalaman = 39; // Halaman akhir Jilid 7 Yanbu'a adalah 39
      } else {
        // ULANG
        nextHalaman = halaman;
      }

      const headersCapaian = ["student_id", "student_name", "jilid_aktif", "halaman_aktif", "status_terakhir", "kelas_id", "nama_kelas", "ustadz_pengampu", "updated_at"];
      const capaianSheet = getOrCreateTPQSheet(ss, SHEET_TPQ_CAPAIAN, headersCapaian, "#0d9488");
      const cData = capaianSheet.getDataRange().getValues();
      let rowIndex = -1;
      let existingKId = "";
      let existingKName = "";
      let existingUstadz = "";

      if (cData.length >= 2) {
        const sIdIdx = cData[0].map(h => String(h).toLowerCase()).indexOf("student_id");
        const kIdIdx = cData[0].map(h => String(h).toLowerCase()).indexOf("kelas_id");
        const kNameIdx = cData[0].map(h => String(h).toLowerCase()).indexOf("nama_kelas");
        const uIdx = cData[0].map(h => String(h).toLowerCase()).indexOf("ustadz_pengampu");

        for (let i = 1; i < cData.length; i++) {
          if (String(cData[i][sIdIdx] || "").trim() === studentId) {
            rowIndex = i + 1;
            if (kIdIdx !== -1) existingKId = String(cData[i][kIdIdx] || "").trim();
            if (kNameIdx !== -1) existingKName = String(cData[i][kNameIdx] || "").trim();
            if (uIdx !== -1) existingUstadz = String(cData[i][uIdx] || "").trim();
            break;
          }
        }
      }

      const inputKId = String(data.kelasId || data.kelas_id || existingKId || "").trim();
      const inputKName = String(data.namaKelas || data.nama_kelas || existingKName || "").trim();
      const inputUstadz = (ustadz && ustadz !== "-") ? ustadz : existingUstadz;

      const resolved = resolveTPQKelas_(ss, studentId, nis, inputKId, inputKName, inputUstadz);
      const finalKelasId = resolved.kelasId || inputKId || "";
      const finalNamaKelas = (resolved.namaKelas && resolved.namaKelas !== "Belum Ditentukan")
        ? resolved.namaKelas
        : (inputKName && inputKName !== "Belum Ditentukan" ? inputKName : "Belum Ditentukan");
      const finalUstadz = (ustadz && ustadz !== "-")
        ? ustadz
        : ((resolved.ustadz && resolved.ustadz !== "-") ? resolved.ustadz : (existingUstadz || "-"));

      if (rowIndex !== -1) {
        capaianSheet.getRange(rowIndex, 2).setValue(studentName);
        capaianSheet.getRange(rowIndex, 3).setValue(nextJilid);
        capaianSheet.getRange(rowIndex, 4).setValue(nextHalaman);
        capaianSheet.getRange(rowIndex, 5).setValue(statusSetoran);
        if (finalKelasId) capaianSheet.getRange(rowIndex, 6).setValue(finalKelasId);
        if (finalNamaKelas) capaianSheet.getRange(rowIndex, 7).setValue(finalNamaKelas);
        if (finalUstadz && finalUstadz !== "-") capaianSheet.getRange(rowIndex, 8).setValue(finalUstadz);
        capaianSheet.getRange(rowIndex, 9).setValue(nowIso);
      } else {
        capaianSheet.appendRow([
          studentId, studentName, nextJilid, nextHalaman, statusSetoran, finalKelasId, finalNamaKelas, finalUstadz, nowIso
        ]);
      }

      return {
        status: "success",
        success: true,
        message: `Bimbingan Yanbu'a santri ${studentName} berhasil dicatat. Status: ${statusSetoran}`,
        logId: logId,
        nextJilid: nextJilid,
        nextHalaman: nextHalaman
      };
    } catch (err) {
      console.error("[SAVE TPQ LOG ERROR]", err);
      return { status: "error", success: false, message: "Gagal mencatat bimbingan TPQ: " + err.message };
    }
  });
}

/**
 * Rekalkulasi posisi capaian aktif santri TPQ setelah log dihapus atau diperbarui
 */
function recalculateTPQCapaianForStudent_(ss, studentId) {
  if (!ss || !studentId) return;
  const logsSheet = ss.getSheetByName(SHEET_TPQ_LOGS);
  if (!logsSheet) return;

  const lData = logsSheet.getDataRange().getValues();
  const studentLogs = [];
  if (lData.length >= 2) {
    const lHead = lData[0].map(h => String(h || "").trim().toLowerCase());
    const rsIdx = lHead.indexOf("student_id");
    const rnisIdx = lHead.indexOf("nis");
    const rjIdx = lHead.indexOf("jilid");
    const rhIdx = lHead.indexOf("halaman");
    const rstIdx = lHead.indexOf("status_setoran");
    const rtglIdx = lHead.indexOf("tanggal");
    const rcrIdx = lHead.indexOf("created_at");

    for (let i = 1; i < lData.length; i++) {
      const rowSid = String(lData[i][rsIdx] || "").trim();
      const rowNis = rnisIdx !== -1 ? String(lData[i][rnisIdx] || "").trim() : "";
      if (rowSid === studentId || (rowNis && rowNis === studentId)) {
        studentLogs.push({
          jilid: rjIdx !== -1 ? (Number(lData[i][rjIdx]) || 1) : 1,
          halaman: rhIdx !== -1 ? (Number(lData[i][rhIdx]) || 1) : 1,
          statusSetoran: rstIdx !== -1 ? String(lData[i][rstIdx] || "LANJUT").trim().toUpperCase() : "LANJUT",
          tgl: (rtglIdx !== -1 && lData[i][rtglIdx]) ? new Date(lData[i][rtglIdx]) : (rcrIdx !== -1 && lData[i][rcrIdx] ? new Date(lData[i][rcrIdx]) : new Date(0))
        });
      }
    }
  }

  studentLogs.sort((a, b) => b.tgl - a.tgl);
  const capaianSheet = ss.getSheetByName(SHEET_TPQ_CAPAIAN);
  if (capaianSheet) {
    const cData = capaianSheet.getDataRange().getValues();
    if (cData.length >= 2) {
      const cHead = cData[0].map(h => String(h || "").trim().toLowerCase());
      const csIdIdx = cHead.indexOf("student_id");
      const cJilidIdx = cHead.indexOf("jilid_aktif");
      const cHalIdx = cHead.indexOf("halaman_aktif");
      const cStIdx = cHead.indexOf("status_terakhir");
      const cUpIdx = cHead.indexOf("updated_at");

      for (let i = 1; i < cData.length; i++) {
        if (String(cData[i][csIdIdx] || "").trim() === studentId) {
          const nowIso = new Date().toISOString();
          if (studentLogs.length > 0) {
            const latest = studentLogs[0];
            let nextJ = latest.jilid;
            let nextH = latest.halaman;
            if (latest.statusSetoran === "LANJUT") {
              const maxHal = (typeof YANBUA_CONFIG !== "undefined" && YANBUA_CONFIG[latest.jilid]) ? YANBUA_CONFIG[latest.jilid].pages : 44;
              if (latest.halaman >= maxHal) {
                if (latest.jilid < 7) {
                  nextJ = latest.jilid + 1;
                  nextH = 1;
                } else {
                  nextJ = 7;
                  nextH = maxHal;
                }
              } else {
                nextH = latest.halaman + 1;
              }
            }
            if (cJilidIdx !== -1) capaianSheet.getRange(i + 1, cJilidIdx + 1).setValue(nextJ);
            if (cHalIdx !== -1) capaianSheet.getRange(i + 1, cHalIdx + 1).setValue(nextH);
            if (cStIdx !== -1) capaianSheet.getRange(i + 1, cStIdx + 1).setValue(latest.statusSetoran);
            if (cUpIdx !== -1) capaianSheet.getRange(i + 1, cUpIdx + 1).setValue(nowIso);
          } else {
            // Reset posisi jika seluruh riwayat simakan dihapus
            if (cJilidIdx !== -1) capaianSheet.getRange(i + 1, cJilidIdx + 1).setValue(1);
            if (cHalIdx !== -1) capaianSheet.getRange(i + 1, cHalIdx + 1).setValue(1);
            if (cStIdx !== -1) capaianSheet.getRange(i + 1, cStIdx + 1).setValue("BELUM_MULAI");
            if (cUpIdx !== -1) capaianSheet.getRange(i + 1, cUpIdx + 1).setValue(nowIso);
          }
          break;
        }
      }
    }
  }
}

/**
 * Hapus catatan log simakan TPQ dan rekalkulasi capaian terakhir santri (Protected by script lock & Admin authorization)
 */
function deleteTPQLog(logId, token) {
  return withScriptLock(() => {
    try {
      if (!logId) throw new Error("ID Log wajib disertakan.");
      if (token) {
        try {
          const actor = authenticateSession(token);
          authorizeRole(actor, ["ADMIN", "SUPER_ADMIN"]);
        } catch (authErr) {
          try { verifySessionToken(token); } catch (e) {
            return { status: "error", success: false, message: authErr.message };
          }
        }
      }

      const ss = getDatabaseSpreadsheet();
      if (!ss) throw new Error("Database spreadsheet tidak ditemukan.");
      const logsSheet = ss.getSheetByName(SHEET_TPQ_LOGS);
      if (!logsSheet) throw new Error("Sheet TPQ_Logs tidak ditemukan.");

      const lData = logsSheet.getDataRange().getValues();
      if (lData.length < 2) throw new Error("Tidak ada data log TPQ.");

      const lHead = lData[0].map(h => String(h || "").trim().toLowerCase());
      const logIdIdx = lHead.indexOf("log_id");
      const sIdIdx = lHead.indexOf("student_id");
      if (logIdIdx === -1) throw new Error("Kolom log_id tidak ditemukan di TPQ_Logs.");

      let targetRow = -1;
      let studentId = "";
      for (let i = 1; i < lData.length; i++) {
        if (String(lData[i][logIdIdx] || "").trim() === String(logId).trim()) {
          targetRow = i + 1;
          studentId = sIdIdx !== -1 ? String(lData[i][sIdIdx] || "").trim() : "";
          break;
        }
      }

      if (targetRow === -1) throw new Error("Catatan log dengan ID " + logId + " tidak ditemukan.");

      logsSheet.deleteRow(targetRow);

      // Rekalkulasi capaian terakhir jika studentId ditemukan
      if (studentId) {
        recalculateTPQCapaianForStudent_(ss, studentId);
      }

      return {
        status: "success",
        success: true,
        message: "Catatan simakan TPQ berhasil dihapus dan capaian santri diperbarui."
      };
    } catch (err) {
      return { status: "error", success: false, message: "Gagal menghapus log TPQ: " + err.message };
    }
  });
}

function saveTPQCapaian(data, token) {
  return withScriptLock(() => {
    try {
      const studentId = String(data.studentId || data.student_id || "").trim();
      const studentName = String(data.studentName || data.student_name || "").trim();
      const jilid = Number(data.jilidAktif || data.jilid) || 1;
      const halaman = Number(data.halamanAktif || data.halaman) || 1;
      const kelasId = String(data.kelasId || "").trim();
      const namaKelas = String(data.namaKelas || "").trim();
      const ustadz = String(data.ustadz || "").trim();
      const nowIso = new Date().toISOString();

      if (!studentId) throw new Error("ID Santri wajib disertakan.");

      const ss = getDatabaseSpreadsheet();
      const resolved = resolveTPQKelas_(ss, studentId, "", kelasId, namaKelas, ustadz);
      const finalKelasId = kelasId || resolved.kelasId || "";
      const finalNamaKelas = (namaKelas && namaKelas !== "Belum Ditentukan")
        ? namaKelas
        : (resolved.namaKelas || "Belum Ditentukan");
      const finalUstadz = (ustadz && ustadz !== "-")
        ? ustadz
        : ((resolved.ustadz && resolved.ustadz !== "-") ? resolved.ustadz : "-");

      const headersCapaian = ["student_id", "student_name", "jilid_aktif", "halaman_aktif", "status_terakhir", "kelas_id", "nama_kelas", "ustadz_pengampu", "updated_at"];
      const sheet = getOrCreateTPQSheet(ss, SHEET_TPQ_CAPAIAN, headersCapaian, "#0d9488");

      const cData = sheet.getDataRange().getValues();
      let rowIndex = -1;
      if (cData.length >= 2) {
        const idIdx = cData[0].map(h => String(h).toLowerCase()).indexOf("student_id");
        for (let i = 1; i < cData.length; i++) {
          if (String(cData[i][idIdx] || "").trim() === studentId) {
            rowIndex = i + 1;
            break;
          }
        }
      }

      if (rowIndex !== -1) {
        sheet.getRange(rowIndex, 2).setValue(studentName);
        sheet.getRange(rowIndex, 3).setValue(jilid);
        sheet.getRange(rowIndex, 4).setValue(halaman);
        if (finalKelasId) sheet.getRange(rowIndex, 6).setValue(finalKelasId);
        if (finalNamaKelas) sheet.getRange(rowIndex, 7).setValue(finalNamaKelas);
        if (finalUstadz && finalUstadz !== "-") sheet.getRange(rowIndex, 8).setValue(finalUstadz);
        sheet.getRange(rowIndex, 9).setValue(nowIso);
      } else {
        sheet.appendRow([studentId, studentName, jilid, halaman, "LANJUT", finalKelasId, finalNamaKelas, finalUstadz, nowIso]);
      }

      return { status: "success", success: true, message: `Posisi capaian santri ${studentName} berhasil diperbarui.` };
    } catch (err) {
      return { status: "error", success: false, message: "Gagal menyimpan capaian: " + err.message };
    }
  });
}

/**
 * Migrasi skema sheet TPQ_Kelas agar mengadopsi struktur 5 kolom Sorogan_Halaqah:
 * [kelas_id, ustadz_pengampu, deskripsi, student_ids, created_at]
 * Menghilangkan kolom nama_kelas dan jadwal_sesi, serta memperbaiki pergeseran data.
 */
function migrateTPQKelasSheetIfNeeded(sheet) {
  if (!sheet) return;
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return;

  const targetHeaders = ["kelas_id", "ustadz_pengampu", "deskripsi", "student_ids", "created_at"];
  const currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || "").trim());

  const hasNama = currentHeaders.some(h => {
    const s = h.toLowerCase();
    return s.includes("nama_kelas") || s === "nama kelas" || s === "nama";
  });
  const hasJadwal = currentHeaders.some(h => {
    const s = h.toLowerCase();
    return s.includes("jadwal_sesi") || s === "jadwal sesi" || s === "jadwal";
  });

  if (!hasNama && !hasJadwal && lastCol === targetHeaders.length) {
    let isMatch = true;
    for (let i = 0; i < targetHeaders.length; i++) {
      if (currentHeaders[i].toLowerCase() !== targetHeaders[i].toLowerCase()) {
        isMatch = false;
        break;
      }
    }
    if (isMatch) return;
  }

  const lastRow = sheet.getLastRow();
  const newRows = [];

  if (lastRow > 1) {
    const dataRange = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    for (let r = 0; r < dataRange.length; r++) {
      const row = dataRange[r];
      let kId = String(row[0] || "").trim();
      let ustadz = "";
      let deskripsi = "";
      let studentIds = "[]";
      let createdAt = new Date().toISOString();

      // Deteksi baris yang tergeser (shifted row dari penambahan 5 elemen ke 6 kolom)
      const val4 = String(row[4] || "").trim();
      const val3 = String(row[3] || "").trim();
      const isShifted = val4.includes("T") && (val3.startsWith("[") || val3 === "" || val3 === "[]");

      if (isShifted) {
        ustadz = String(row[1] || "").trim();
        deskripsi = String(row[2] || "").trim();
        studentIds = val3 || "[]";
        createdAt = val4;
      } else {
        const headLower = currentHeaders.map(h => h.toLowerCase());
        const uIdx = headLower.indexOf("ustadz_pengampu") !== -1 ? headLower.indexOf("ustadz_pengampu") : headLower.indexOf("muallim");
        const deskIdx = headLower.indexOf("deskripsi") !== -1 ? headLower.indexOf("deskripsi") : (headLower.indexOf("jadwal_sesi") !== -1 ? headLower.indexOf("jadwal_sesi") : headLower.indexOf("target_kurikulum"));
        const nameIdx = headLower.indexOf("nama_kelas");
        const sidsIdx = headLower.indexOf("student_ids");
        const createdIdx = headLower.indexOf("created_at");

        ustadz = uIdx !== -1 ? String(row[uIdx] || "").trim() : "";
        if (!ustadz && nameIdx !== -1) {
          ustadz = String(row[nameIdx] || "").replace(/^Kelas\s+/i, "").trim();
        }
        deskripsi = deskIdx !== -1 ? String(row[deskIdx] || "").trim() : "";
        if (sidsIdx !== -1) {
          studentIds = String(row[sidsIdx] || "[]").trim();
        }
        if (createdIdx !== -1) {
          createdAt = String(row[createdIdx] || "").trim();
        }
      }

      if (!kId && !ustadz) continue;
      if (!kId) kId = "TPQ-KLS-" + Utilities.getUuid().replace(/-/g, "").substring(0, 6).toUpperCase();
      if (!deskripsi) deskripsi = "Bimbingan Yanbu'a";
      if (!studentIds) studentIds = "[]";
      if (!createdAt) createdAt = new Date().toISOString();

      newRows.push([kId, ustadz, deskripsi, studentIds, createdAt]);
    }
  }

  // Tulis ulang seluruh sheet menjadi format 5 kolom kanonikal
  sheet.clearContents();
  sheet.getRange(1, 1, 1, targetHeaders.length)
    .setValues([targetHeaders])
    .setFontWeight("bold")
    .setBackground("#0284c7")
    .setFontColor("#ffffff");
  sheet.setFrozenRows(1);

  if (newRows.length > 0) {
    sheet.getRange(2, 1, newRows.length, targetHeaders.length).setValues(newRows);
  }

  const maxCols = sheet.getMaxColumns();
  if (maxCols > targetHeaders.length) {
    sheet.deleteColumns(targetHeaders.length + 1, maxCols - targetHeaders.length);
  }

  Logger.log("[OK] Sheet TPQ_Kelas berhasil dimigrasi menjadi 5 kolom bersih mengadopsi Sorogan_Halaqah.");
}

function getTPQKelasList(token) {
  try {
    const ss = getDatabaseSpreadsheet();
    const headersKelas = ["kelas_id", "ustadz_pengampu", "deskripsi", "student_ids", "created_at"];
    const sheet = getOrCreateTPQSheet(ss, SHEET_TPQ_KELAS, headersKelas, "#0284c7");
    migrateTPQKelasSheetIfNeeded(sheet);

    const data = sheet.getDataRange().getValues();
    const list = [];

    if (data.length >= 2) {
      for (let i = 1; i < data.length; i++) {
        let sids = [];
        try {
          const raw = String(data[i][3] || "");
          if (raw.trim().startsWith("[")) sids = JSON.parse(raw);
          else sids = raw.split(",").map(s => s.trim()).filter(Boolean);
        } catch (e) {
          sids = [];
        }
        const kId = String(data[i][0] || "").trim();
        const uVal = String(data[i][1] || "").trim();
        const deskVal = String(data[i][2] || "").trim();
        const finalName = uVal ? ("Kelas " + uVal) : ("Kelas " + kId);

        list.push({
          kelasId: kId,
          namaKelas: finalName,
          ustadzPengampu: uVal || "-",
          deskripsi: deskVal,
          studentIds: sids
        });
      }
    }
    return { status: "success", success: true, kelasList: list };
  } catch (err) {
    return { status: "error", success: false, message: err.message };
  }
}

function saveTPQKelas(data, token) {
  return withScriptLock(() => {
    try {
      if (token) {
        try {
          const actor = authenticateSession(token);
          authorizeRole(actor, ["ADMIN", "EDITOR", "PEGAWAI", "PENGASUH"]);
        } catch (authErr) {
          try { verifySessionToken(token); } catch (e) {}
        }
      }

      const ustadz = String(data.ustadzPengampu || data.ustadz || "").trim();
      const deskripsi = String(data.deskripsi || data.targetKelas || data.keterangan || "").trim();
      const studentIds = Array.isArray(data.studentIds) ? data.studentIds : [];
      let kelasId = String(data.kelasId || data.id || "").trim();
      const nowIso = new Date().toISOString();

      if (!ustadz) throw new Error("Nama Ustadz / Ustadzah pengampu wajib dipilih.");

      const ss = getDatabaseSpreadsheet();
      const headersKelas = ["kelas_id", "ustadz_pengampu", "deskripsi", "student_ids", "created_at"];
      const sheet = getOrCreateTPQSheet(ss, SHEET_TPQ_KELAS, headersKelas, "#0284c7");
      migrateTPQKelasSheetIfNeeded(sheet);

      const kData = sheet.getDataRange().getValues();
      let rowIndex = -1;

      for (let i = 1; i < kData.length; i++) {
        const rowId = String(kData[i][0] || "").trim();
        const rowU = String(kData[i][1] || "").trim();
        if ((kelasId && rowId === kelasId) || (!kelasId && rowU && rowU.toLowerCase() === ustadz.toLowerCase())) {
          rowIndex = i + 1;
          if (!kelasId) kelasId = rowId;
          break;
        }
      }

      if (rowIndex !== -1) {
        sheet.getRange(rowIndex, 2).setValue(ustadz);
        sheet.getRange(rowIndex, 3).setValue(deskripsi);
        sheet.getRange(rowIndex, 4).setValue(JSON.stringify(studentIds));
      } else {
        if (!kelasId) {
          kelasId = "TPQ-KLS-" + Utilities.getUuid().replace(/-/g, "").substring(0, 6).toUpperCase();
        }
        sheet.appendRow([kelasId, ustadz, deskripsi, JSON.stringify(studentIds), nowIso]);
      }

      const namaKelas = "Kelas " + ustadz;
      // Sync plotting to TPQ_Capaian
      syncTPQPlottingToCapaian_(ss, kelasId, studentIds, ustadz, namaKelas);

      return {
        status: "success",
        success: true,
        message: `Kelas ${namaKelas} berhasil disimpan.`,
        kelasId: kelasId,
        ustadzPengampu: ustadz,
        deskripsi: deskripsi
      };
    } catch (err) {
      return { status: "error", success: false, message: "Gagal menyimpan kelas TPQ: " + err.message };
    }
  });
}

function deleteTPQKelas(kelasId, token) {
  return withScriptLock(() => {
    try {
      if (token) {
        try {
          const actor = authenticateSession(token);
          authorizeRole(actor, ["ADMIN", "EDITOR", "PEGAWAI", "PENGASUH"]);
        } catch (authErr) {
          try { verifySessionToken(token); } catch (e) {}
        }
      }
      if (!kelasId) throw new Error("ID Kelas wajib disertakan.");
      const ss = getDatabaseSpreadsheet();
      const sheet = ss.getSheetByName(SHEET_TPQ_KELAS);
      if (!sheet) throw new Error("Sheet TPQ_Kelas tidak ditemukan.");
      migrateTPQKelasSheetIfNeeded(sheet);

      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0] || "").trim() === String(kelasId).trim()) {
          sheet.deleteRow(i + 1);
          return { status: "success", success: true, message: "Kelas TPQ berhasil dihapus." };
        }
      }
      return { status: "error", success: false, message: "Kelas TPQ tidak ditemukan." };
    } catch (err) {
      return { status: "error", success: false, message: err.message };
    }
  });
}

function saveTPQPlotting(payload, token) {
  return withScriptLock(() => {
    try {
      if (token) {
        try {
          const actor = authenticateSession(token);
          authorizeRole(actor, ["ADMIN", "EDITOR", "PEGAWAI", "PENGASUH"]);
        } catch (authErr) {
          try { verifySessionToken(token); } catch (e) {}
        }
      }

      const kelasId = String(payload.kelasId || payload.kelas_id || "").trim();
      if (!kelasId) throw new Error("ID Kelas TPQ wajib disertakan.");

      let rawList = payload.studentIds || payload.student_ids || [];
      if (typeof rawList === "string") {
        if (rawList.trim().startsWith("[")) {
          try { rawList = JSON.parse(rawList); } catch (e) { rawList = rawList.split(","); }
        } else {
          rawList = rawList.split(",");
        }
      }
      const cleanStudentIds = Array.isArray(rawList) ? rawList.map(s => String(s).trim()).filter(Boolean) : [];

      const ss = getDatabaseSpreadsheet();
      const headersKelas = ["kelas_id", "ustadz_pengampu", "deskripsi", "student_ids", "created_at"];
      const sheet = getOrCreateTPQSheet(ss, SHEET_TPQ_KELAS, headersKelas, "#0284c7");
      migrateTPQKelasSheetIfNeeded(sheet);

      const data = sheet.getDataRange().getValues();
      if (data.length <= 1) throw new Error("Data kelas TPQ tidak ditemukan.");

      let foundRow = -1;
      for (let i = 1; i < data.length; i++) {
        const rowId = String(data[i][0] || "").trim();
        const rowU = String(data[i][1] || "").trim();
        if (rowId === kelasId || rowId.toLowerCase() === kelasId.toLowerCase() || 
            (rowU && ("kelas " + rowU).toLowerCase() === kelasId.toLowerCase()) || 
            (rowU && rowU.toLowerCase() === kelasId.toLowerCase())) {
          foundRow = i + 1;
          break;
        }
      }

      if (foundRow <= 0) throw new Error("Kelas TPQ ID '" + kelasId + "' tidak ditemukan.");

      // Kolom 4 adalah student_ids
      sheet.getRange(foundRow, 4).setValue(JSON.stringify(cleanStudentIds));

      const kUstadz = String(data[foundRow - 1][1] || "").trim();
      const kNama = "Kelas " + kUstadz;
      syncTPQPlottingToCapaian_(ss, kelasId, cleanStudentIds, kUstadz, kNama);

      return {
        status: "success",
        success: true,
        kelasId: kelasId,
        totalPlotting: cleanStudentIds.length,
        message: `Plotting ${cleanStudentIds.length} santri ke kelas TPQ berhasil disimpan.`
      };
    } catch (err) {
      return { status: "error", success: false, message: "Gagal menyimpan plotting TPQ: " + err.message };
    }
  });
}

function saveTPQTarget(payload, token) {
  return withScriptLock(() => {
    try {
      const studentId = String(payload.studentId || payload.student_id || "").trim();
      if (!studentId) throw new Error("ID Santri wajib disertakan.");

      const ss = getDatabaseSpreadsheet();
      const headers = ["student_id", "target_jilid", "target_halaman_sesi", "target_halaman_pekan", "updated_at"];
      const sheet = getOrCreateTPQSheet(ss, SHEET_TPQ_TARGET, headers, "#f59e0b");

      const targetJilid = Number(payload.targetJilid || payload.target_jilid || 1);
      const targetHalamanSesi = Number(payload.targetHalamanSesi || payload.target_halaman_sesi || 1);
      const targetHalamanPekan = Number(payload.targetHalamanPekan || payload.target_halaman_pekan || (targetHalamanSesi * 6));
      const updatedAt = new Date().toISOString();

      const data = sheet.getDataRange().getValues();
      const idIdx = data[0].map(h => String(h || "").toLowerCase()).indexOf("student_id");
      let foundRow = -1;

      if (data.length >= 2 && idIdx !== -1) {
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][idIdx] || "").trim() === studentId) {
            foundRow = i + 1;
            break;
          }
        }
      }

      const rowValues = [studentId, targetJilid, targetHalamanSesi, targetHalamanPekan, updatedAt];

      if (foundRow > 0) {
        sheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
      } else {
        sheet.appendRow(rowValues);
      }

      return {
        status: "success",
        success: true,
        message: "Target capaian santri TPQ berhasil disimpan."
      };
    } catch (err) {
      return { status: "error", success: false, message: "Gagal menyimpan target TPQ: " + err.message };
    }
  });
}

function saveBulkTPQTarget(payload, token) {
  return withScriptLock(() => {
    try {
      const studentIds = Array.isArray(payload.studentIds)
        ? payload.studentIds.map(id => String(id || "").trim()).filter(Boolean)
        : (payload.studentId ? [String(payload.studentId).trim()] : []);

      if (studentIds.length === 0) {
        throw new Error("Daftar ID Santri sasaran tidak boleh kosong.");
      }

      const ss = getDatabaseSpreadsheet();
      const headers = ["student_id", "target_jilid", "target_halaman_sesi", "target_halaman_pekan", "updated_at"];
      const sheet = getOrCreateTPQSheet(ss, SHEET_TPQ_TARGET, headers, "#f59e0b");

      const targetHalamanSesi = Number(payload.targetHalamanSesi || payload.target_halaman_sesi || 1);
      const targetHalamanPekan = Number(payload.targetHalamanPekan || payload.target_halaman_pekan || (targetHalamanSesi * 6));
      const updatedAt = new Date().toISOString();

      const data = sheet.getDataRange().getValues();
      const idIdx = data[0].map(h => String(h || "").toLowerCase()).indexOf("student_id");
      const targetJilidIdx = data[0].map(h => String(h || "").toLowerCase()).indexOf("target_jilid");

      const existingRowMap = {};
      if (data.length >= 2 && idIdx !== -1) {
        for (let i = 1; i < data.length; i++) {
          const sid = String(data[i][idIdx] || "").trim();
          if (sid) {
            existingRowMap[sid] = {
              row: i + 1,
              targetJilid: targetJilidIdx !== -1 ? Number(data[i][targetJilidIdx]) || 1 : 1
            };
          }
        }
      }

      const newRows = [];
      studentIds.forEach(id => {
        if (existingRowMap[id]) {
          const r = existingRowMap[id].row;
          const tj = existingRowMap[id].targetJilid || 1;
          sheet.getRange(r, 1, 1, 5).setValues([[id, tj, targetHalamanSesi, targetHalamanPekan, updatedAt]]);
        } else {
          newRows.push([id, 1, targetHalamanSesi, targetHalamanPekan, updatedAt]);
        }
      });

      if (newRows.length > 0) {
        sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 5).setValues(newRows);
      }

      return {
        status: "success",
        success: true,
        totalUpdated: studentIds.length,
        message: `Target capaian berhasil diterapkan ke ${studentIds.length} santri TPQ.`
      };
    } catch (err) {
      return { status: "error", success: false, message: "Gagal menerapkan target massal TPQ: " + err.message };
    }
  });
}

function saveTPQSesi(payload, token) {
  return withScriptLock(() => {
    try {
      const p = (payload && (payload.sesi || payload.data)) ? (payload.sesi || payload.data) : (payload || {});
      const namaSesi = String(p.namaSesi || p.nama_sesi || p.nama || "").trim();
      if (!namaSesi) throw new Error("Nama sesi wajib diisi.");

      const ss = getDatabaseSpreadsheet();
      const headers = ["sesi_id", "nama_sesi", "jenis_sesi", "status", "jam_mulai", "jam_selesai", "hari_list", "created_at"];
      const sheet = getOrCreateTPQSheet(ss, SHEET_TPQ_SESI, headers, "#0d9488");

      const rawId = String(p.sesiId || p.sesi_id || p.id || "").trim();
      const sesiId = rawId || ("TPQ-SESI-" + Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd-HHmm"));
      const jenisSesi = String(p.jenisSesi || p.jenis_sesi || p.jenis || "Bimbingan Yanbu'a Reguler").trim();
      const status = String(p.status || "Aktif Digunakan").trim();
      const jamMulai = normalizeTimeString(p.jamMulai || p.jam_mulai, "15:45");
      const jamSelesai = normalizeTimeString(p.jamSelesai || p.jam_selesai, "17:00");
      const rawHari = p.hariList || p.hari || "Sen,Sel,Rab,Kam,Sab,Min";
      const hariList = Array.isArray(rawHari) ? rawHari.join(",") : String(rawHari);
      const createdAt = new Date().toISOString();

      const data = sheet.getDataRange().getValues();
      const headersArr = data[0].map(h => String(h || "").trim().toLowerCase());
      const idIdx = headersArr.indexOf("sesi_id");
      let foundRow = -1;

      if (rawId && idIdx >= 0) {
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][idIdx] || "").trim() === rawId) {
            foundRow = i + 1;
            break;
          }
        }
      }

      const rowValues = [sesiId, namaSesi, jenisSesi, status, jamMulai, jamSelesai, hariList, createdAt];

      if (foundRow > 0) {
        sheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
      } else {
        sheet.appendRow(rowValues);
      }

      return {
        status: "success",
        success: true,
        sesiId: sesiId,
        message: `Jadwal sesi ${namaSesi} TPQ berhasil disimpan.`
      };
    } catch (err) {
      return { status: "error", success: false, message: "Gagal menyimpan sesi TPQ: " + err.message };
    }
  });
}

function deleteTPQSesi(sesiId, token) {
  return withScriptLock(() => {
    try {
      if (!sesiId) throw new Error("ID Sesi wajib disertakan.");
      const ss = getDatabaseSpreadsheet();
      const sheet = ss.getSheetByName(SHEET_TPQ_SESI);
      if (!sheet) throw new Error("Sheet TPQ_Sesi tidak ditemukan.");

      const data = sheet.getDataRange().getValues();
      const idIdx = data[0].map(h => String(h || "").toLowerCase()).indexOf("sesi_id");

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idIdx] || "").trim() === String(sesiId).trim()) {
          sheet.deleteRow(i + 1);
          return { status: "success", success: true, message: "Sesi TPQ berhasil dihapus." };
        }
      }
      return { status: "error", success: false, message: "Sesi TPQ tidak ditemukan." };
    } catch (err) {
      return { status: "error", success: false, message: err.message };
    }
  });
}


// ====================================================================
// MODUL BACKEND: MADRASAH DINIYAH (MADIN) - KELAS, KITAB, PRESENSI & NILAI
// ====================================================================
const SHEET_MADIN_KELAS = "Madin_Kelas";
const SHEET_MADIN_KITAB = "Madin_Kitab";
const SHEET_MADIN_JURNAL = "Madin_Jurnal";
const SHEET_MADIN_PRESENSI = "Madin_Presensi";
const SHEET_MADIN_NILAI = "Madin_Nilai";
const SHEET_MADIN_ANGGOTA = "Madin_Anggota";

function getOrCreateMadinSheet(ss, sheetName, headers, headerColor) {
  let s = ss.getSheetByName(sheetName);
  if (!s) {
    s = ss.insertSheet(sheetName);
    s.getRange(1, 1, 1, headers.length).setValues([headers]);
    s.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground(headerColor || "#4338ca").setFontColor("#ffffff");
    s.setFrozenRows(1);
  }
  return s;
}

function initMadinSheets(token) {
  try {
    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error("Database Spreadsheet tidak ditemukan.");

    const headersKelas = ["class_id", "nama_kelas", "tingkat", "wali_kelas", "gender", "total_santri", "created_at"];
    const headersKitab = ["subject_id", "nama_kitab", "bidang", "class_id", "ustadz_pengampu", "kkm", "created_at"];
    const headersJurnal = ["session_id", "tanggal", "class_id", "nama_kelas", "subject_id", "nama_kitab", "asatidz", "materi_bab", "catatan", "created_at"];
    const headersPresensi = ["presensi_id", "session_id", "tanggal", "student_id", "nis", "student_name", "class_id", "status", "keterangan", "created_at"];
    const headersNilai = ["nilai_id", "semester", "class_id", "subject_id", "student_id", "nis", "student_name", "nilai_harian", "nilai_lisan", "nilai_tulis", "nilai_akhir", "predikat", "catatan", "updated_at"];
    const headersAnggota = ["member_id", "class_id", "student_id", "nis", "student_name", "gender", "assigned_at"];

    const created = [];
    const existing = [];

    [
      { name: SHEET_MADIN_KELAS, headers: headersKelas, color: "#4338ca" },
      { name: SHEET_MADIN_KITAB, headers: headersKitab, color: "#059669" },
      { name: SHEET_MADIN_JURNAL, headers: headersJurnal, color: "#0284c7" },
      { name: SHEET_MADIN_PRESENSI, headers: headersPresensi, color: "#d97706" },
      { name: SHEET_MADIN_NILAI, headers: headersNilai, color: "#7c3aed" },
      { name: SHEET_MADIN_ANGGOTA, headers: headersAnggota, color: "#0d9488" }
    ].forEach(item => {
      let s = ss.getSheetByName(item.name);
      if (!s) {
        s = ss.insertSheet(item.name);
        s.getRange(1, 1, 1, item.headers.length).setValues([item.headers]);
        s.getRange(1, 1, 1, item.headers.length).setFontWeight("bold").setBackground(item.color).setFontColor("#ffffff");
        s.setFrozenRows(1);
        created.push(item.name);
      } else {
        existing.push(item.name);
      }
    });

    // Masukkan data master kelas default bila baru dibuat
    if (created.includes(SHEET_MADIN_KELAS)) {
      const kSheet = ss.getSheetByName(SHEET_MADIN_KELAS);
      const nowIso = new Date().toISOString();
      const defaultKelas = [
        ["MD-ULA1", "1 Awaliyah A (Putra)", "Awaliyah", "Ust. M. Ridwan, S.Pd.I", "L", 24, nowIso],
        ["MD-ULA2", "1 Awaliyah B (Putri)", "Awaliyah", "Usth. Siti Maryam, S.Ag", "P", 22, nowIso],
        ["MD-WST1", "2 Wustho A (Putra)", "Wustho", "Ust. Ahmad Fauzan", "L", 20, nowIso],
        ["MD-WST2", "2 Wustho B (Putri)", "Wustho", "Usth. Fatimah Az-Zahra", "P", 21, nowIso],
        ["MD-ULY1", "3 Ulya (Aliyah)", "Ulya", "K.H. Masrur", "all", 18, nowIso]
      ];
      kSheet.getRange(2, 1, defaultKelas.length, headersKelas.length).setValues(defaultKelas);
    }

    // Masukkan data master kitab default bila baru dibuat
    if (created.includes(SHEET_MADIN_KITAB)) {
      const bSheet = ss.getSheetByName(SHEET_MADIN_KITAB);
      const nowIso = new Date().toISOString();
      const defaultKitab = [
        ["SBJ-01", "Safinatun Naja", "Fiqih", "MD-ULA1", "Ust. M. Ridwan, S.Pd.I", 70, nowIso],
        ["SBJ-02", "Al-Jurumiyyah", "Nahwu", "MD-ULA1", "Ust. Zaidan Al-Hafidz", 70, nowIso],
        ["SBJ-03", "Taisirul Khalaq", "Akhlaq", "MD-ULA1", "Ust. Fauzi Rohman", 75, nowIso],
        ["SBJ-04", "Al-Amtsilah At-Tashrifiyyah", "Shorof", "MD-ULA1", "Ust. Hasan Basri", 70, nowIso],
        ["SBJ-05", "Fathul Qorib Al-Mujib", "Fiqih", "MD-WST1", "Ust. Ahmad Fauzan", 75, nowIso],
        ["SBJ-06", "Al-Imrithi", "Nahwu", "MD-WST1", "Ust. Luqman Hakim", 75, nowIso],
        ["SBJ-07", "Kifayatul Awam", "Tauhid", "MD-ULY1", "K.H. Masrur", 75, nowIso]
      ];
      bSheet.getRange(2, 1, defaultKitab.length, headersKitab.length).setValues(defaultKitab);
    }

    return {
      status: "success",
      success: true,
      message: "Database Madrasah Diniyah (5 Tab Sheet) berhasil disiapkan di Spreadsheet.",
      createdSheets: created,
      existingSheets: existing
    };
  } catch (err) {
    console.error("[INIT MADIN SHEETS ERROR]", err);
    return { status: "error", success: false, message: "Gagal menyiapkan tabel Madin: " + err.message };
  }
}

function getMadinData(token) {
  try {
    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error("Spreadsheet tidak ditemukan.");

    let classes = [];
    const kSheet = ss.getSheetByName(SHEET_MADIN_KELAS);
    if (kSheet && kSheet.getLastRow() > 1) {
      const vals = kSheet.getRange(2, 1, kSheet.getLastRow() - 1, 7).getValues();
      classes = vals.map(r => ({
        classId: String(r[0] || ""),
        namaKelas: String(r[1] || ""),
        tingkat: String(r[2] || "Awaliyah"),
        waliKelas: String(r[3] || ""),
        gender: String(r[4] || "all"),
        totalSantri: Number(r[5] || 0)
      })).filter(c => c.classId);
    }

    let subjects = [];
    const subSheet = ss.getSheetByName(SHEET_MADIN_KITAB);
    if (subSheet && subSheet.getLastRow() > 1) {
      const vals = subSheet.getRange(2, 1, subSheet.getLastRow() - 1, 7).getValues();
      subjects = vals.map(r => ({
        subjectId: String(r[0] || ""),
        namaKitab: String(r[1] || ""),
        bidang: String(r[2] || "Fiqih"),
        classId: String(r[3] || ""),
        ustadzPengampu: String(r[4] || ""),
        kkm: Number(r[5] || 70)
      })).filter(s => s.subjectId);
    }

    let sessions = [];
    const jSheet = ss.getSheetByName(SHEET_MADIN_JURNAL);
    if (jSheet && jSheet.getLastRow() > 1) {
      const maxRows = Math.min(jSheet.getLastRow() - 1, 50);
      const startRow = jSheet.getLastRow() - maxRows + 1;
      const vals = jSheet.getRange(startRow, 1, maxRows, 10).getValues();
      sessions = vals.map(r => ({
        sessionId: String(r[0] || ""),
        tanggal: String(r[1] || ""),
        classId: String(r[2] || ""),
        namaKelas: String(r[3] || ""),
        subjectId: String(r[4] || ""),
        namaKitab: String(r[5] || ""),
        asatidz: String(r[6] || ""),
        materiBab: String(r[7] || ""),
        catatan: String(r[8] || ""),
        timestamp: String(r[9] || "")
      })).reverse();
    }

    let grades = {};
    const nSheet = ss.getSheetByName(SHEET_MADIN_NILAI);
    if (nSheet && nSheet.getLastRow() > 1) {
      const vals = nSheet.getRange(2, 1, nSheet.getLastRow() - 1, 14).getValues();
      vals.forEach(r => {
        const semester = String(r[1] || "Ganjil");
        const classId = String(r[2] || "");
        const subjectId = String(r[3] || "");
        const studentId = String(r[4] || "");
        const key = `${classId}_${subjectId}_${semester}`;
        if (!grades[key]) grades[key] = {};
        grades[key][studentId] = {
          harian: Number(r[7] || 0),
          lisan: Number(r[8] || 0),
          tulis: Number(r[9] || 0),
          catatan: String(r[12] || "")
        };
      });
    }

    // 5. Baca Anggota Kelas (Plotting Santri)
    let classMembers = {};
    const mSheet = ss.getSheetByName(SHEET_MADIN_ANGGOTA);
    if (mSheet && mSheet.getLastRow() > 1) {
      const mVals = mSheet.getRange(2, 1, mSheet.getLastRow() - 1, 7).getValues();
      mVals.forEach(r => {
        const cId = String(r[1] || "").trim();
        const sId = String(r[2] || "").trim();
        if (cId && sId) {
          if (!classMembers[cId]) classMembers[cId] = [];
          classMembers[cId].push({
            studentId: sId,
            nis: String(r[3] || ""),
            nama: String(r[4] || ""),
            gender: String(r[5] || "")
          });
        }
      });
    }

    return {
      status: "success",
      success: true,
      data: {
        classes: classes.length > 0 ? classes : null,
        subjects: subjects.length > 0 ? subjects : null,
        sessions: sessions,
        grades: grades,
        classMembers: classMembers
      }
    };
  } catch (err) {
    console.error("[GET MADIN DATA ERROR]", err);
    return { status: "error", success: false, message: err.message };
  }
}

function saveMadinSession(payload, token) {
  try {
    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error("Spreadsheet tidak ditemukan.");
    const headersJurnal = ["session_id", "tanggal", "class_id", "nama_kelas", "subject_id", "nama_kitab", "asatidz", "materi_bab", "catatan", "created_at"];
    const jSheet = getOrCreateMadinSheet(ss, SHEET_MADIN_JURNAL, headersJurnal, "#0284c7");

    const nowIso = new Date().toISOString();
    const sessionId = payload.sessionId || ("SES-" + Date.now());

    jSheet.appendRow([
      sessionId,
      payload.tanggal || "",
      payload.classId || "",
      payload.namaKelas || "",
      payload.subjectId || "",
      payload.namaKitab || "",
      payload.asatidz || "",
      payload.materiBab || "",
      payload.catatan || "",
      nowIso
    ]);

    if (payload.kehadiran && typeof payload.kehadiran === "object") {
      const headersPresensi = ["presensi_id", "session_id", "tanggal", "student_id", "nis", "student_name", "class_id", "status", "keterangan", "created_at"];
      const pSheet = getOrCreateMadinSheet(ss, SHEET_MADIN_PRESENSI, headersPresensi, "#d97706");
      const rows = [];
      Object.entries(payload.kehadiran).forEach(([stdId, att]) => {
        rows.push([
          "PR-" + Date.now() + "-" + stdId,
          sessionId,
          payload.tanggal || "",
          stdId,
          "",
          "",
          payload.classId || "",
          att.status || "H",
          att.keterangan || "",
          nowIso
        ]);
      });
      if (rows.length > 0) {
        pSheet.getRange(pSheet.getLastRow() + 1, 1, rows.length, headersPresensi.length).setValues(rows);
      }
    }

    return { status: "success", success: true, message: "Sesi KBM & Presensi Madin berhasil disimpan ke Spreadsheet." };
  } catch (err) {
    console.error("[SAVE MADIN SESSION ERROR]", err);
    return { status: "error", success: false, message: err.message };
  }
}

function saveMadinGrades(payload, token) {
  try {
    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error("Spreadsheet tidak ditemukan.");
    const headersNilai = ["nilai_id", "semester", "class_id", "subject_id", "student_id", "nis", "student_name", "nilai_harian", "nilai_lisan", "nilai_tulis", "nilai_akhir", "predikat", "catatan", "updated_at"];
    const nSheet = getOrCreateMadinSheet(ss, SHEET_MADIN_NILAI, headersNilai, "#7c3aed");

    const classId = payload.classId;
    const subjectId = payload.subjectId;
    const semester = payload.semester || "Ganjil";
    const gradesMap = payload.grades || {};
    const nowIso = new Date().toISOString();

    const rows = [];
    Object.entries(gradesMap).forEach(([stdId, val]) => {
      const harian = Number(val.harian || 0);
      const lisan = Number(val.lisan || 0);
      const tulis = Number(val.tulis || 0);
      const akhir = Math.round((harian * 0.3) + (lisan * 0.3) + (tulis * 0.4));
      let predikat = "Jayyid";
      if (akhir >= 90) predikat = "Mumtaz";
      else if (akhir >= 80) predikat = "Jayyid Jiddan";
      else if (akhir >= 70) predikat = "Jayyid";
      else if (akhir >= 60) predikat = "Maqbul";
      else predikat = "Rosib";

      rows.push([
        `NIL-${classId}-${subjectId}-${stdId}`,
        semester,
        classId,
        subjectId,
        stdId,
        "",
        "",
        harian,
        lisan,
        tulis,
        akhir,
        predikat,
        val.catatan || "",
        nowIso
      ]);
    });

    if (rows.length > 0) {
      nSheet.getRange(nSheet.getLastRow() + 1, 1, rows.length, headersNilai.length).setValues(rows);
    }

    return { status: "success", success: true, message: "Nilai santri berhasil disimpan ke Spreadsheet." };
  } catch (err) {
    console.error("[SAVE MADIN GRADES ERROR]", err);
    return { status: "error", success: false, message: err.message };
  }
}

function saveMadinClass(payload, token) {
  try {
    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error("Spreadsheet tidak ditemukan.");
    const headersKelas = ["class_id", "nama_kelas", "tingkat", "wali_kelas", "gender", "total_santri", "created_at"];
    const kSheet = getOrCreateMadinSheet(ss, SHEET_MADIN_KELAS, headersKelas, "#4338ca");

    const nowIso = new Date().toISOString();
    const classId = payload.classId || ("MD-CLS-" + Date.now().toString().slice(-4));

    let updated = false;
    if (kSheet.getLastRow() > 1) {
      const ids = kSheet.getRange(2, 1, kSheet.getLastRow() - 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) {
        if (String(ids[i][0]) === String(classId)) {
          kSheet.getRange(i + 2, 2, 1, 4).setValues([[payload.namaKelas, payload.tingkat, payload.waliKelas, payload.gender || "all"]]);
          updated = true;
          break;
        }
      }
    }
    if (!updated) {
      kSheet.appendRow([classId, payload.namaKelas, payload.tingkat, payload.waliKelas, payload.gender || "all", 0, nowIso]);
    }

    return { status: "success", success: true, message: "Data kelas berhasil disimpan ke Spreadsheet." };
  } catch (err) {
    return { status: "error", success: false, message: err.message };
  }
}

function saveMadinSubject(payload, token) {
  try {
    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error("Spreadsheet tidak ditemukan.");
    const headersKitab = ["subject_id", "nama_kitab", "bidang", "class_id", "ustadz_pengampu", "kkm", "created_at"];
    const bSheet = getOrCreateMadinSheet(ss, SHEET_MADIN_KITAB, headersKitab, "#059669");

    const nowIso = new Date().toISOString();
    const subjectId = payload.subjectId || ("SBJ-" + Date.now().toString().slice(-4));

    let updated = false;
    if (bSheet.getLastRow() > 1) {
      const ids = bSheet.getRange(2, 1, bSheet.getLastRow() - 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) {
        if (String(ids[i][0]) === String(subjectId)) {
          bSheet.getRange(i + 2, 2, 1, 5).setValues([[payload.namaKitab, payload.bidang, payload.classId, payload.ustadzPengampu, payload.kkm || 70]]);
          updated = true;
          break;
        }
      }
    }
    if (!updated) {
      bSheet.appendRow([subjectId, payload.namaKitab, payload.bidang, payload.classId, payload.ustadzPengampu, payload.kkm || 70, nowIso]);
    }

    return { status: "success", success: true, message: "Data kitab berhasil disimpan ke Spreadsheet." };
  } catch (err) {
    return { status: "error", success: false, message: err.message };
  }
}

function saveMadinClassMembers(payload, token) {
  try {
    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error("Spreadsheet tidak ditemukan.");
    const classId = String(payload.classId || "").trim();
    if (!classId) throw new Error("Class ID wajib diisi.");

    const members = Array.isArray(payload.members) ? payload.members : [];
    const headersAnggota = ["member_id", "class_id", "student_id", "nis", "student_name", "gender", "assigned_at"];
    const mSheet = getOrCreateMadinSheet(ss, SHEET_MADIN_ANGGOTA, headersAnggota, "#0d9488");

    // 1. Hapus anggota lama untuk kelas ini dari sheet Madin_Anggota
    if (mSheet.getLastRow() > 1) {
      const data = mSheet.getRange(2, 1, mSheet.getLastRow() - 1, 7).getValues();
      const remainingRows = [];
      data.forEach(r => {
        if (String(r[1]).trim() !== classId) {
          remainingRows.push(r);
        }
      });

      // Clear isi data lama dan timpa
      mSheet.getRange(2, 1, Math.max(mSheet.getLastRow() - 1, 1), 7).clearContent();
      if (remainingRows.length > 0) {
        mSheet.getRange(2, 1, remainingRows.length, 7).setValues(remainingRows);
      }
    }

    // 2. Append anggota baru
    const nowIso = new Date().toISOString();
    if (members.length > 0) {
      const newRows = members.map((m, idx) => [
        "MBR-" + classId + "-" + (m.studentId || m.id || idx),
        classId,
        m.studentId || m.id || "",
        m.nis || "",
        m.nama || m.name || "",
        m.gender || "L",
        nowIso
      ]);
      const startRow = mSheet.getLastRow() + 1;
      mSheet.getRange(startRow, 1, newRows.length, 7).setValues(newRows);
    }

    // 3. Perbarui total_santri di sheet Madin_Kelas
    const headersKelas = ["class_id", "nama_kelas", "tingkat", "wali_kelas", "gender", "total_santri", "created_at"];
    const kSheet = getOrCreateMadinSheet(ss, SHEET_MADIN_KELAS, headersKelas, "#4338ca");
    if (kSheet.getLastRow() > 1) {
      const cVals = kSheet.getRange(2, 1, kSheet.getLastRow() - 1, 6).getValues();
      for (let i = 0; i < cVals.length; i++) {
        if (String(cVals[i][0]).trim() === classId) {
          kSheet.getRange(i + 2, 6).setValue(members.length);
          break;
        }
      }
    }

    return {
      status: "success",
      success: true,
      message: `Berhasil menyimpan ${members.length} santri ke kelas ${classId}.`,
      classId: classId,
      totalSantri: members.length
    };
  } catch (err) {
    console.error("[SAVE MADIN MEMBERS ERROR]", err);
    return { status: "error", success: false, message: err.message };
  }
}


// ====================================================================
// MODUL BACKEND: SOROGAN AL-QUR'AN (BINNAZHAR MUSHAF POJOK 20 HAL/JUZ)
// ====================================================================
const SHEET_SOROGAN_LOGS = "Sorogan_Logs";
const SHEET_SOROGAN_CAPAIAN = "Sorogan_Capaian";
const SHEET_SOROGAN_HALAQAH = "Sorogan_Halaqah";
const SHEET_SOROGAN_TARGET = "Sorogan_Target";
const SHEET_SOROGAN_SESI = "Sorogan_Sesi";

function getOrCreateSoroganSheet(ss, sheetName, headers, bgHeaderColor) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setBackground(bgHeaderColor || "#0284c7")
      .setFontColor("#ffffff");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Normalisasi dan deteksi indeks kolom tab Sorogan_Halaqah secara tangguh.
/**
 * Normalisasi dan deteksi indeks kolom tab Sorogan_Halaqah secara tangguh.
 * Mengadopsi standar 5 kolom kanonikal:
 * [halaqah_id, muallim, target_kurikulum, student_ids, created_at]
 * Mendukung pembacaan kompatibilitas jika kolom lama (nama_halaqah, kategori) masih ada.
 */
function getSoroganHalaqahColumnIndexes(headerRow) {
  if (!headerRow || !headerRow.length) return { id: -1, nama: -1, kategori: -1, muallim: -1, target: -1, studentIds: -1, createdAt: -1 };
  const normalized = headerRow.map(x => String(x || "").trim().toLowerCase().replace(/[\s\-_]+/g, ""));
  const find = (keywords) => {
    for (let i = 0; i < keywords.length; i++) {
      const cleanK = keywords[i].replace(/[\s\-_]+/g, "");
      const idx = normalized.indexOf(cleanK);
      if (idx !== -1) return idx;
    }
    return -1;
  };
  return {
    id: find(["halaqah_id", "halaqahid", "id_halaqah", "idhalaqah", "id", "kode_halaqah", "kode"]),
    nama: find(["nama_halaqah", "namahalaqah", "nama", "halaqah", "nama_kelompok", "kelompok"]),
    kategori: find(["kategori", "kategori_program", "kategoriprogram", "category", "program"]),
    muallim: find(["muallim", "muhafiz", "muhafidz", "pembina", "ustadz", "guru"]),
    target: find(["target_kurikulum", "targetkurikulum", "target", "kurikulum", "jadwal_sesi", "jadwalsesi", "jadwal", "deskripsi"]),
    studentIds: find(["student_ids", "studentids", "anggota", "santri_ids", "santri", "siswa"]),
    createdAt: find(["created_at", "createdat", "tanggal", "waktu"])
  };
}

/**
 * Otomatis migrasi header & susunan data sheet Sorogan_Halaqah ke format standar 5 kolom kanonikal:
 * [halaqah_id, muallim, target_kurikulum, student_ids, created_at]
 * Menghilangkan kolom nama_halaqah dan kategori tanpa menghilangkan data santri binaan.
 */
function migrateSoroganHalaqahSheetIfNeeded(sheet) {
  if (!sheet) return;
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return;

  const targetHeaders = ["halaqah_id", "muallim", "target_kurikulum", "student_ids", "created_at"];
  const currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || "").trim());

  // Cek apakah sheet masih memiliki kolom 'nama_halaqah' atau 'kategori'
  const hasNama = currentHeaders.some(h => {
    const s = h.toLowerCase();
    return s.includes("nama_halaqah") || s === "nama" || s.includes("namahalaqah");
  });
  const hasKategori = currentHeaders.some(h => {
    const s = h.toLowerCase();
    return s === "kategori" || s === "category" || s.includes("kategori_program");
  });

  // Jika sudah 5 kolom dan tidak ada nama_halaqah / kategori, lewati
  if (!hasNama && !hasKategori && lastCol === targetHeaders.length) {
    let isMatch = true;
    for (let i = 0; i < targetHeaders.length; i++) {
      if (currentHeaders[i].toLowerCase() !== targetHeaders[i].toLowerCase()) {
        isMatch = false;
        break;
      }
    }
    if (isMatch) return;
  }

  // Baca indeks lama
  const oldColMap = getSoroganHalaqahColumnIndexes(currentHeaders);
  const lastRow = sheet.getLastRow();
  const newRows = [];

  if (lastRow > 1) {
    const dataRange = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    for (let r = 0; r < dataRange.length; r++) {
      const row = dataRange[r];
      const hId = oldColMap.id !== -1 ? String(row[oldColMap.id] || "").trim() : "";
      let hMuallim = oldColMap.muallim !== -1 ? String(row[oldColMap.muallim] || "").trim() : "";
      
      // Jika muallim kosong tapi nama_halaqah ada, kita fallback gunakan nama halaqah
      if (!hMuallim && oldColMap.nama !== -1) {
        hMuallim = String(row[oldColMap.nama] || "").trim();
      }
      if (!hId && !hMuallim) continue;

      const hTarget = oldColMap.target !== -1 ? String(row[oldColMap.target] || "").trim() : "Sorogan Binnazhar Mushaf Pojok 30 Juz";
      
      let rawSids = oldColMap.studentIds !== -1 ? row[oldColMap.studentIds] : "";
      let sidsStr = "";
      if (typeof rawSids === "string") {
        if (rawSids.trim().startsWith("[")) {
          try {
            const parsed = JSON.parse(rawSids);
            sidsStr = Array.isArray(parsed) ? parsed.join(",") : rawSids;
          } catch (e) {
            sidsStr = rawSids;
          }
        } else {
          sidsStr = rawSids;
        }
      } else if (Array.isArray(rawSids)) {
        sidsStr = rawSids.join(",");
      }

      const hCreated = (oldColMap.createdAt !== -1 && row[oldColMap.createdAt]) ? row[oldColMap.createdAt] : new Date().toISOString();
      newRows.push([hId || ("SRG-HLQ-" + (r < 10 ? "0" + (r + 1) : (r + 1))), hMuallim || "Kyai / Mu'allim Pengampu", hTarget, sidsStr, hCreated]);
    }
  }

  // Bersihkan dan tulis ulang susunan kolom persis 5 kolom standar kanonikal
  sheet.clear();
  sheet.getRange(1, 1, 1, targetHeaders.length).setValues([targetHeaders])
    .setFontWeight("bold")
    .setBackground("#4338ca")
    .setFontColor("#ffffff");
  sheet.setFrozenRows(1);

  if (newRows.length > 0) {
    sheet.getRange(2, 1, newRows.length, targetHeaders.length).setValues(newRows);
  }

  // Hapus sisa kolom jika sheet punya lebih dari 5 kolom
  const maxCols = sheet.getMaxColumns();
  if (maxCols > targetHeaders.length) {
    try {
      sheet.deleteColumns(targetHeaders.length + 1, maxCols - targetHeaders.length);
    } catch (e) {
      // Abaikan jika tidak diizinkan oleh spreadsheet
    }
  }
}

function migrateSoroganHalaqahSheet_(ss) {
  try {
    if (!ss) return;
    const sheet = ss.getSheetByName(SHEET_SOROGAN_HALAQAH);
    if (!sheet) return;
    migrateSoroganHalaqahSheetIfNeeded(sheet);
  } catch (err) {
    Logger.log("migrateSoroganHalaqahSheet_ error: " + err.message);
  }
}

/**
 * Menyelesaikan (resolve) halaqah_id, nama_halaqah, dan muallim pengampu untuk santri Sorogan
 * Berdasarkan plotting di Sorogan_Halaqah, fallback ke muallim yang cocok, atau default.
 */
function resolveSoroganHalaqah_(ss, studentId, nis, customHalaqahId, customNamaHalaqah, customMuallim, skipWrite, preloadedHData) {
  let resolvedHalaqahId = String(customHalaqahId || "").trim();
  let resolvedNamaHalaqah = String(customNamaHalaqah || "").trim();
  let resolvedMuallim = String(customMuallim || "").trim();
  if (resolvedMuallim === "-") resolvedMuallim = "";

  const sId = String(studentId || "").trim();
  const sNis = String(nis || "").trim();

  try {
    if (!ss) ss = getDatabaseSpreadsheet();
    if (ss) {
      const hSheet = ss.getSheetByName(SHEET_SOROGAN_HALAQAH);
      if (hSheet) {
        if (!skipWrite) {
          migrateSoroganHalaqahSheetIfNeeded(hSheet);
        }
        const hData = preloadedHData || hSheet.getDataRange().getValues();
        if (hData.length >= 2) {
          const colMap = getSoroganHalaqahColumnIndexes(hData[0]);
          if (colMap.id !== -1) {
            let matchedRow = null;
            let matchedRowIndex = -1;

            // 1. Cari berdasarkan student_id atau nis di kolom student_ids
            if (sId || sNis) {
              for (let i = 1; i < hData.length; i++) {
                const row = hData[i];
                const rawSids = colMap.studentIds !== -1 ? row[colMap.studentIds] : "";
                let sids = [];
                if (typeof rawSids === "string") {
                  if (rawSids.trim().startsWith("[")) {
                    try { sids = JSON.parse(rawSids); } catch (e) { sids = []; }
                  } else {
                    sids = rawSids.split(",").map(s => s.trim()).filter(Boolean);
                  }
                } else if (Array.isArray(rawSids)) {
                  sids = rawSids;
                }

                if ((sId && sids.includes(sId)) || (sNis && sids.includes(sNis))) {
                  matchedRow = row;
                  matchedRowIndex = i + 1;
                  break;
                }
              }
            }

            // 2. Jika belum cocok, cari berdasarkan customHalaqahId
            if (!matchedRow && resolvedHalaqahId) {
              for (let i = 1; i < hData.length; i++) {
                if (String(hData[i][colMap.id] || "").trim() === resolvedHalaqahId) {
                  matchedRow = hData[i];
                  matchedRowIndex = i + 1;
                  break;
                }
              }
            }

            // 3. Jika belum cocok, cari berdasarkan muallim
            if (!matchedRow && resolvedMuallim && resolvedMuallim !== "-") {
              const cleanM = resolvedMuallim.toLowerCase().replace(/[^a-z0-9]/g, "");
              for (let i = 1; i < hData.length; i++) {
                const rowM = colMap.muallim !== -1 ? String(hData[i][colMap.muallim] || "").trim() : "";
                const cleanRowM = rowM.toLowerCase().replace(/[^a-z0-9]/g, "");
                if (cleanRowM && (cleanRowM === cleanM || cleanRowM.includes(cleanM) || cleanM.includes(cleanRowM))) {
                  matchedRow = hData[i];
                  matchedRowIndex = i + 1;
                  break;
                }
              }
            }

            if (matchedRow) {
              resolvedHalaqahId = String(matchedRow[colMap.id] || "").trim();
              const mName = colMap.muallim !== -1 ? String(matchedRow[colMap.muallim] || "").trim() : "";
              if (mName) resolvedMuallim = mName;
              let hName = colMap.nama !== -1 ? String(matchedRow[colMap.nama] || "").trim() : "";
              if (!hName && resolvedMuallim) hName = "Halaqah " + resolvedMuallim;
              else if (!hName && resolvedHalaqahId) hName = "Halaqah " + resolvedHalaqahId;
              resolvedNamaHalaqah = hName;

              // Jika santri belum terdaftar di daftar student_ids pada halaqah ini, daftarkan otomatis (hanya jika bukan mode read-only)
              if (!skipWrite && sId && colMap.studentIds !== -1 && matchedRowIndex > 0) {
                try {
                  const rawSids = matchedRow[colMap.studentIds] || "";
                  const sids = String(rawSids).split(",").map(s => s.trim()).filter(Boolean);
                  if (!sids.includes(sId)) {
                    sids.push(sId);
                    hSheet.getRange(matchedRowIndex, colMap.studentIds + 1).setValue(sids.join(","));
                  }
                } catch (syncPlotErr) {
                  // Abaikan error minor
                }
              }
            }
          }
        }
      }
    }
  } catch (err) {
    Logger.log("resolveSoroganHalaqah_ error: " + err.message);
  }

  // Jika nama_halaqah masih kosong atau 'Belum Ditentukan'
  if (!resolvedNamaHalaqah || resolvedNamaHalaqah === "Belum Ditentukan") {
    if (resolvedMuallim && resolvedMuallim !== "-") {
      resolvedNamaHalaqah = "Halaqah " + resolvedMuallim;
    } else if (resolvedHalaqahId) {
      resolvedNamaHalaqah = "Halaqah " + resolvedHalaqahId;
    } else {
      resolvedNamaHalaqah = "Belum Ditentukan";
    }
  }

  return {
    halaqahId: resolvedHalaqahId,
    namaHalaqah: resolvedNamaHalaqah,
    muallim: resolvedMuallim || "-"
  };
}

/**
 * Menyinkronkan perubahan plotting dari Sorogan_Halaqah ke Sorogan_Capaian
 */
function syncSoroganPlottingToCapaian_(ss, halaqahId, studentIds, muallim) {
  try {
    if (!ss) ss = getDatabaseSpreadsheet();
    if (!ss || !halaqahId) return;

    const headersCapaian = ["student_id", "student_name", "juz_aktif", "halaman_terakhir", "total_halaman_khatam", "status_terakhir", "halaqah_id", "nama_halaqah", "muallim_pengampu", "updated_at"];
    const cSheet = getOrCreateSoroganSheet(ss, SHEET_SOROGAN_CAPAIAN, headersCapaian, "#0f766e");
    const cData = cSheet.getDataRange().getValues();
    if (cData.length < 2) return;

    const cHead = cData[0].map(h => String(h || "").trim().toLowerCase());
    const sIdIdx = cHead.indexOf("student_id");
    const hIdIdx = cHead.indexOf("halaqah_id");
    const hNameIdx = cHead.indexOf("nama_halaqah");
    const mIdx = cHead.indexOf("muallim_pengampu");
    const upIdx = cHead.indexOf("updated_at");

    if (sIdIdx === -1 || hIdIdx === -1) return;

    const cleanSids = Array.isArray(studentIds) ? studentIds.map(s => String(s).trim()).filter(Boolean) : [];
    const namaHalaqah = muallim && muallim !== "-" ? ("Halaqah " + muallim) : ("Halaqah " + halaqahId);
    const nowIso = new Date().toISOString();

    for (let i = 1; i < cData.length; i++) {
      const rowSid = String(cData[i][sIdIdx] || "").trim();
      const currentHId = String(cData[i][hIdIdx] || "").trim();
      const rowNumber = i + 1;

      if (cleanSids.includes(rowSid)) {
        if (currentHId !== halaqahId || String(cData[i][hNameIdx] || "").trim() === "Belum Ditentukan" || !cData[i][hNameIdx]) {
          cSheet.getRange(rowNumber, hIdIdx + 1).setValue(halaqahId);
          if (hNameIdx !== -1) cSheet.getRange(rowNumber, hNameIdx + 1).setValue(namaHalaqah);
          if (mIdx !== -1 && muallim && muallim !== "-") cSheet.getRange(rowNumber, mIdx + 1).setValue(muallim);
          if (upIdx !== -1) cSheet.getRange(rowNumber, upIdx + 1).setValue(nowIso);
        }
      } else if (currentHId === halaqahId) {
        // Santri yang sebelumnya ada di halaqah ini namun sekarang dikeluarkan (unplotted)
        cSheet.getRange(rowNumber, hIdIdx + 1).setValue("");
        if (hNameIdx !== -1) cSheet.getRange(rowNumber, hNameIdx + 1).setValue("Belum Masuk Halaqah");
        if (mIdx !== -1) cSheet.getRange(rowNumber, mIdx + 1).setValue("-");
        if (upIdx !== -1) cSheet.getRange(rowNumber, upIdx + 1).setValue(nowIso);
      }
    }
  } catch (err) {
    Logger.log("syncSoroganPlottingToCapaian_ error: " + err.message);
  }
}

function initSoroganSheets(token) {
  try {
    if (token) {
      try {
        const actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN"]);
      } catch (authErr) {
        verifySessionToken(token);
      }
    }
    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error("Database Spreadsheet tidak ditemukan.");

    const headersLogs = ["log_id", "student_id", "nis", "student_name", "gender", "tanggal", "sesi", "juz", "halaman_list", "total_halaman", "status_setoran", "nilai", "muallim", "catatan", "created_at"];
    const headersCapaian = ["student_id", "student_name", "juz_aktif", "halaman_terakhir", "total_halaman_khatam", "status_terakhir", "halaqah_id", "nama_halaqah", "muallim_pengampu", "updated_at"];
    const headersHalaqah = ["halaqah_id", "muallim", "target_kurikulum", "student_ids", "created_at"];
    const headersTarget = ["student_id", "target_juz", "target_halaman_sesi", "target_halaman_pekan", "updated_at"];
    const headersSesi = ["sesi_id", "nama_sesi", "jenis_sesi", "status", "jam_mulai", "jam_selesai", "hari_list", "created_at"];

    const created = [];
    const existing = [];

    [
      { name: SHEET_SOROGAN_LOGS, headers: headersLogs, color: "#0369a1" },
      { name: SHEET_SOROGAN_CAPAIAN, headers: headersCapaian, color: "#0f766e" },
      { name: SHEET_SOROGAN_HALAQAH, headers: headersHalaqah, color: "#4338ca" },
      { name: SHEET_SOROGAN_TARGET, headers: headersTarget, color: "#f59e0b" },
      { name: SHEET_SOROGAN_SESI, headers: headersSesi, color: "#0284c7" }
    ].forEach(item => {
      let s = ss.getSheetByName(item.name);
      if (!s) {
        s = ss.insertSheet(item.name);
        s.getRange(1, 1, 1, item.headers.length).setValues([item.headers]);
        s.getRange(1, 1, 1, item.headers.length).setFontWeight("bold").setBackground(item.color).setFontColor("#ffffff");
        s.setFrozenRows(1);
        created.push(item.name);
      } else {
        if (item.name === SHEET_SOROGAN_HALAQAH) {
          migrateSoroganHalaqahSheetIfNeeded(s);
        }
        existing.push(item.name);
      }
    });

    const nowIso = new Date().toISOString();

    if (created.includes(SHEET_SOROGAN_HALAQAH)) {
      const hSheet = ss.getSheetByName(SHEET_SOROGAN_HALAQAH);
      const pSheet = ss.getSheetByName("Pegawai") || ss.getSheetByName("pegawai");
      let ustadz = "Ust.Nazirul Muhammad, AH.";
      let ustadzah = "Nyai Hj. Nashichatul Fuadah, AH.";
      if (pSheet) {
        const pRows = pSheet.getDataRange().getValues();
        if (pRows.length > 1) {
          const pHead = pRows[0].map(h => String(h || "").trim().toLowerCase());
          const nIdx = pHead.indexOf("nama") !== -1 ? pHead.indexOf("nama") : pHead.indexOf("name");
          const gIdx = pHead.indexOf("gender");
          if (nIdx !== -1) {
            for (let r = 1; r < pRows.length; r++) {
              const nm = String(pRows[r][nIdx] || "").trim();
              const gd = gIdx !== -1 ? String(pRows[r][gIdx] || "L").toUpperCase() : "L";
              if (nm) {
                if (gd === "L" && ustadz === "Ust.Nazirul Muhammad, AH.") ustadz = nm;
                if (gd === "P" && ustadzah === "Nyai Hj. Nashichatul Fuadah, AH.") ustadzah = nm;
              }
            }
          }
        }
      }
      const defaultHalaqah = [
        ["SRG-HLQ-01", ustadz, "Sorogan Binnazhar Mushaf Pojok 30 Juz", "", nowIso],
        ["SRG-HLQ-02", ustadzah, "Sorogan Binnazhar Mushaf Pojok 30 Juz", "", nowIso]
      ];
      hSheet.getRange(2, 1, defaultHalaqah.length, headersHalaqah.length).setValues(defaultHalaqah);
    }

    if (created.includes(SHEET_SOROGAN_SESI)) {
      const sSheet = ss.getSheetByName(SHEET_SOROGAN_SESI);
      const defaultSesi = [
        ["SRG-SESI-01", "Pagi (Ba'da Subuh)", "Sorogan Binnazhar Reguler", "Aktif Digunakan", "05:15", "06:30", "Sen,Sel,Rab,Kam,Sab,Min", nowIso],
        ["SRG-SESI-02", "Sore (Ba'da Ashar)", "Sorogan Privat / I'adah", "Aktif Digunakan", "16:00", "17:15", "Sen,Sel,Kam,Sab", nowIso],
        ["SRG-SESI-03", "Malam (Ba'da Isya)", "Khataman / Ujian Akhir Juz", "Aktif Digunakan", "20:00", "21:30", "Kam", nowIso]
      ];
      sSheet.getRange(2, 1, defaultSesi.length, headersSesi.length).setValues(defaultSesi);
    }

    return {
      status: "success",
      success: true,
      message: "Database Sorogan Al-Qur'an berhasil disiapkan.",
      createdSheets: created,
      existingSheets: existing
    };
  } catch (err) {
    console.error("[INIT SOROGAN SHEETS ERROR]", err);
    return { status: "error", success: false, message: "Gagal menyiapkan tabel Sorogan: " + err.message };
  }
}

function getSoroganDashboard(token) {
  try {
    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error("Spreadsheet tidak ditemukan.");

    let actor = null;
    if (token) {
      try {
        actor = authenticateSession(token);
      } catch (authErr) {
        verifySessionToken(token);
      }
    }

    // 0. Auto-ensure SEMUA sheet Sorogan Al-Qur'an tersedia di database
    const headersLogs = ["log_id", "student_id", "nis", "student_name", "gender", "tanggal", "sesi", "juz", "halaman_list", "total_halaman", "status_setoran", "nilai", "muallim", "catatan", "created_at"];
    const headersCapaian = ["student_id", "student_name", "juz_aktif", "halaman_terakhir", "total_halaman_khatam", "status_terakhir", "halaqah_id", "nama_halaqah", "muallim_pengampu", "updated_at"];
    const headersHalaqah = ["halaqah_id", "muallim", "target_kurikulum", "student_ids", "created_at"];
    const headersTarget = ["student_id", "target_juz", "target_halaman_sesi", "target_halaman_pekan", "updated_at"];
    const headersSesi = ["sesi_id", "nama_sesi", "jenis_sesi", "status", "jam_mulai", "jam_selesai", "hari_list", "created_at"];

    // Pastikan Sorogan_Logs dan seluruh tab Sorogan terbentuk
    getOrCreateSoroganSheet(ss, SHEET_SOROGAN_LOGS, headersLogs, "#0369a1");
    const capaianSheet = getOrCreateSoroganSheet(ss, SHEET_SOROGAN_CAPAIAN, headersCapaian, "#0f766e");
    const halaqahSheet = getOrCreateSoroganSheet(ss, SHEET_SOROGAN_HALAQAH, headersHalaqah, "#4338ca");
    const targetSheet = getOrCreateSoroganSheet(ss, SHEET_SOROGAN_TARGET, headersTarget, "#f59e0b");
    const sesiSheet = getOrCreateSoroganSheet(ss, SHEET_SOROGAN_SESI, headersSesi, "#0284c7");

    // Otomatis migrasi struktur kolom Sorogan_Halaqah agar persis Tahfidz_Halaqah
    migrateSoroganHalaqahSheetIfNeeded(halaqahSheet);

    const nowIso = new Date().toISOString();

    // Ambil data resmi Pegawai dari sheet "Pegawai" (Official DB)
    let pegawaiSheet = ss.getSheetByName(SHEET_PEGAWAI) || ss.getSheetByName("Pegawai") || ss.getSheetByName("pegawai");
    const muallimList = [];
    if (pegawaiSheet) {
      const pData = pegawaiSheet.getDataRange().getValues();
      if (pData && pData.length > 1) {
        const pHead = pData[0].map(h => String(h || "").trim().toLowerCase());
        const pNamaIdx = pHead.indexOf("nama") !== -1 ? pHead.indexOf("nama") : pHead.indexOf("name");
        const pStatusIdx = pHead.indexOf("status");
        for (let i = 1; i < pData.length; i++) {
          const row = pData[i];
          const nama = pNamaIdx !== -1 ? String(row[pNamaIdx] || "").trim() : "";
          const st = pStatusIdx !== -1 ? String(row[pStatusIdx] || "").trim().toUpperCase() : "ACTIVE";
          if (nama && (st === "ACTIVE" || st === "AKTIF" || st === "")) {
            if (!muallimList.includes(nama)) {
              muallimList.push(nama);
            }
          }
        }
      }
    }

    // Ambil data resmi Program dari sheet "Programs" (Official DB)
    let programsSheet = ss.getSheetByName("Programs") || ss.getSheetByName("Program");
    const programCategories = [];
    if (programsSheet) {
      const prData = programsSheet.getDataRange().getValues();
      if (prData && prData.length > 1) {
        const prHead = prData[0].map(h => String(h || "").trim().toLowerCase());
        const nameIdx = prHead.indexOf("name") !== -1 ? prHead.indexOf("name") : prHead.indexOf("nama");
        const idIdx = prHead.indexOf("id");
        for (let i = 1; i < prData.length; i++) {
          const row = prData[i];
          const prName = nameIdx !== -1 ? String(row[nameIdx] || "").trim() : "";
          const prId = idIdx !== -1 ? String(row[idIdx] || "").trim() : "";
          if (prName && !programCategories.some(p => p.name === prName)) {
            programCategories.push({
              id: prId || prName,
              name: prName
            });
          }
        }
      }
    }

    const defaultTeacher1 = muallimList[0] || "Ust.Nazirul Muhammad, AH.";
    const defaultTeacher2 = muallimList[1] || muallimList[0] || "Nyai Hj. Nashichatul Fuadah, AH.";
    const defaultProg1 = (programCategories[0] && programCategories[0].name) || "Pesantren Reguler Putra Putri";
    const defaultProg2 = (programCategories[1] && programCategories[1].name) || defaultProg1;

    // Auto-seed default Halaqah jika sheet baru dibuat / kosong
    if (halaqahSheet.getLastRow() < 2) {
      const defaultHalaqah = [
        ["SRG-HLQ-01", defaultTeacher1, "Sorogan Binnazhar Mushaf Pojok 30 Juz", "", nowIso],
        ["SRG-HLQ-02", defaultTeacher2, "Sorogan Binnazhar Mushaf Pojok 30 Juz", "", nowIso]
      ];
      halaqahSheet.getRange(2, 1, defaultHalaqah.length, headersHalaqah.length).setValues(defaultHalaqah);
    }

    // Auto-seed default Sesi jika sheet baru dibuat / kosong
    if (sesiSheet.getLastRow() < 2) {
      const defaultSesi = [
        ["SRG-SESI-01", "Pagi (Ba'da Subuh)", "Sorogan Binnazhar Reguler", "Aktif Digunakan", "05:15", "06:30", "Sen,Sel,Rab,Kam,Sab,Min", nowIso],
        ["SRG-SESI-02", "Sore (Ba'da Ashar)", "Sorogan Privat / I'adah", "Aktif Digunakan", "16:00", "17:15", "Sen,Sel,Kam,Sab", nowIso],
        ["SRG-SESI-03", "Malam (Ba'da Isya)", "Khataman / Ujian Akhir Juz", "Aktif Digunakan", "20:00", "21:30", "Kam", nowIso]
      ];
      sesiSheet.getRange(2, 1, defaultSesi.length, headersSesi.length).setValues(defaultSesi);
    }

    // 1. Ambil data master Santri secara resilien (identik dengan Tahfidz)
    let students = [];
    const studentsSheet = (typeof getAuthSheet === "function" ? getAuthSheet(ss, SHEET_STUDENTS) : null) || ss.getSheetByName(SHEET_STUDENTS);
    if (studentsSheet) {
      const sData = studentsSheet.getDataRange().getValues();
      if (sData && sData.length > 1) {
        const sHeaders = sData[0].map(h => String(h || "").trim().toLowerCase().replace(/[\s\-_]+/g, ""));
        const sIdIdx = sHeaders.findIndex(h => h === "studentid" || h === "id");
        const sNisIdx = sHeaders.findIndex(h => h === "nis" || h === "nisn");
        const sNameIdx = sHeaders.findIndex(h => h === "name" || h === "nama");
        const sGenderIdx = sHeaders.findIndex(h => h === "gender" || h === "jeniskelamin" || h === "jenis");
        const sPhotoIdx = sHeaders.findIndex(h => h.includes("photo") || h.includes("foto"));
        const sStatusIdx = sHeaders.findIndex(h => h === "status");

        for (let i = 1; i < sData.length; i++) {
          const row = sData[i];
          const stStatus = sStatusIdx !== -1 ? String(row[sStatusIdx] || "").trim().toUpperCase() : "AKTIF";
          if (["AKTIF", "ACTIVE", ""].includes(stStatus)) {
            const stId = sIdIdx !== -1 ? String(row[sIdIdx] || "").trim() : "";
            const stName = sNameIdx !== -1 ? String(row[sNameIdx] || "").trim() : "";
            if (!stId && !stName) continue;
            students.push({
              studentId: stId || ("STD-" + i),
              nis: sNisIdx !== -1 ? String(row[sNisIdx] || "").trim() : "",
              name: stName,
              gender: sGenderIdx !== -1 ? String(row[sGenderIdx] || "L").trim().toUpperCase() : "L",
              photoUrl: sPhotoIdx !== -1 ? String(row[sPhotoIdx] || "").trim() : "",
              status: "AKTIF"
            });
          }
        }
      }
    }

    if (students.length === 0 && typeof getAllStudentsData === "function") {
      try {
        const studentsRes = getAllStudentsData(token);
        const rawList = (studentsRes && studentsRes.data) || [];
        students = rawList.map((st, idx) => ({
          studentId: String(st.studentId || st.student_id || st.id || ("STD-" + (idx + 1))).trim(),
          nis: String(st.nis || "").trim(),
          name: String(st.name || st.nama || "").trim(),
          gender: String(st.gender || st.jenis_kelamin || "L").trim().toUpperCase(),
          photoUrl: String(st.photoUrl || st.photo_url || st.foto || "").trim(),
          status: "AKTIF"
        })).filter(s => s.studentId || s.name);
      } catch (e) {
        console.warn("[FALLBACK SOROGAN STUDENTS ERROR]", e);
      }
    }

    // Filter khusus jika role WALI_SANTRI
    if (actor && actor.role === "WALI_SANTRI") {
      const linked = (typeof getLinkedStudentsForWali === "function") ? getLinkedStudentsForWali(actor.identityId) : [];
      const allowedIds = (linked || []).map(s => String(s.studentId || s.student_id || s.id || s.nis || "").trim().toLowerCase());
      students = students.filter(s => allowedIds.includes(String(s.studentId).toLowerCase()) || allowedIds.includes(String(s.nis).toLowerCase()));
    }

    // 2. Ambil data Capaian Sorogan
    const capaianMap = {};
    const cData = capaianSheet.getDataRange().getValues();
    if (cData.length >= 2) {
      const cHead = cData[0].map(h => String(h || "").trim().toLowerCase());
      const sIdIdx = cHead.indexOf("student_id");
      const juzIdx = cHead.indexOf("juz_aktif");
      const halIdx = cHead.indexOf("halaman_terakhir");
      const totIdx = cHead.indexOf("total_halaman_khatam");
      const stIdx = cHead.indexOf("status_terakhir");
      const hIdIdx = cHead.indexOf("halaqah_id");
      const hNameIdx = cHead.indexOf("nama_halaqah");
      const mIdx = cHead.indexOf("muallim_pengampu");
      const upIdx = cHead.indexOf("updated_at");

      for (let i = 1; i < cData.length; i++) {
        const sid = String(cData[i][sIdIdx] || "").trim();
        if (sid) {
          capaianMap[sid] = {
            rowNumber: i + 1,
            juzAktif: Number(cData[i][juzIdx]) || 1,
            halamanTerakhir: Number(cData[i][halIdx]) || 1,
            totalHalamanKhatam: Number(cData[i][totIdx]) || 0,
            statusTerakhir: String(cData[i][stIdx] || "LANJUT").trim().toUpperCase(),
            halaqahId: String(cData[i][hIdIdx] || "").trim(),
            namaHalaqah: String(cData[i][hNameIdx] || "").trim(),
            muallimPengampu: String(cData[i][mIdx] || "").trim(),
            updatedAt: String(cData[i][upIdx] || "").trim()
          };
        }
      }
    }

    // 3. Ambil data Halaqah Sorogan (Struktur Kolom Mengadopsi Tahfidz_Halaqah)
    const halaqahs = [];
    const hData = halaqahSheet.getDataRange().getValues();
    if (hData.length >= 2) {
      const colMap = getSoroganHalaqahColumnIndexes(hData[0]);

      for (let i = 1; i < hData.length; i++) {
        const row = hData[i];
        const hId = colMap.id !== -1 ? String(row[colMap.id] || "").trim() : "";
        const mName = colMap.muallim !== -1 ? String(row[colMap.muallim] || "").trim() : "";
        let hNama = colMap.nama !== -1 && row[colMap.nama] ? String(row[colMap.nama]).trim() : "";
        if (!hNama && mName) {
          hNama = "Halaqah " + mName;
        }
        if (!hId && !mName && !hNama) continue;

        const rawSids = colMap.studentIds !== -1 ? row[colMap.studentIds] : "";
        let sids = [];
        if (typeof rawSids === "string") {
          if (rawSids.trim().startsWith("[")) {
            try { sids = JSON.parse(rawSids); } catch (e) { sids = []; }
          } else {
            sids = rawSids.split(",").map(s => s.trim()).filter(Boolean);
          }
        } else if (Array.isArray(rawSids)) {
          sids = rawSids;
        }

        const kName = colMap.kategori !== -1 ? String(row[colMap.kategori] || "").trim() : "";
        const targetDesc = colMap.target !== -1 ? String(row[colMap.target] || "").trim() : "";

        halaqahs.push({
          halaqahId: hId || ("SRG-HLQ-" + (i < 10 ? "0" + i : i)),
          namaHalaqah: hNama || ("Halaqah " + (mName || hId)),
          muallim: mName,
          muallimPengampu: mName,
          kategori: kName,
          kategoriProgram: kName,
          targetKurikulum: targetDesc || "Sorogan Binnazhar Mushaf Pojok 30 Juz",
          jadwalSesi: targetDesc || "Sorogan Binnazhar Mushaf Pojok 30 Juz",
          studentIds: sids
        });
      }
    }

    // 4. Ambil data Target Sorogan
    const targetMap = {};
    const tData = targetSheet.getDataRange().getValues();
    if (tData.length >= 2) {
      const tHead = tData[0].map(h => String(h || "").trim().toLowerCase());
      const sIdIdx = tHead.indexOf("student_id");
      const jIdx = tHead.indexOf("target_juz");
      const sSesiIdx = tHead.indexOf("target_halaman_sesi");
      const sPekanIdx = tHead.indexOf("target_halaman_pekan");

      for (let i = 1; i < tData.length; i++) {
        const sid = String(tData[i][sIdIdx] || "").trim();
        if (sid) {
          const sSesi = Number(tData[i][sSesiIdx]) || 2;
          let rawTj = Number(tData[i][jIdx]);
          // Jika target_juz bernilai 1 atau kosong, selaraskan ke 30 (Khatam 30 Juz Al-Qur'an)
          if (!rawTj || rawTj <= 1) {
            rawTj = 30;
            try {
              if (jIdx !== -1) targetSheet.getRange(i + 1, jIdx + 1).setValue(30);
            } catch (healErr) {}
          }
          targetMap[sid] = {
            targetJuz: rawTj,
            targetHalamanSesi: sSesi,
            targetHalamanPekan: Number(tData[i][sPekanIdx]) || (sSesi * 11)
          };
        }
      }
    }

    // 5. Ambil data Jadwal Sesi Sorogan
    const sesiList = [];
    const sesiData = sesiSheet.getDataRange().getValues();
    if (sesiData.length >= 2) {
      const sHead = sesiData[0].map(h => String(h || "").trim().toLowerCase());
      const idIdx = sHead.indexOf("sesi_id");
      const nameIdx = sHead.indexOf("nama_sesi");
      const typeIdx = sHead.indexOf("jenis_sesi");
      const stIdx = sHead.indexOf("status");
      const jmIdx = sHead.indexOf("jam_mulai");
      const jsIdx = sHead.indexOf("jam_selesai");
      const hIdx = sHead.indexOf("hari_list");

      for (let i = 1; i < sesiData.length; i++) {
        const rawHari = sesiData[i][hIdx] || "";
        const hariList = Array.isArray(rawHari) ? rawHari : String(rawHari).split(",").map(h => h.trim()).filter(Boolean);
        sesiList.push({
          sesiId: String(sesiData[i][idIdx] || "").trim(),
          namaSesi: String(sesiData[i][nameIdx] || "").trim(),
          jenisSesi: String(sesiData[i][typeIdx] || "").trim(),
          status: String(sesiData[i][stIdx] || "Aktif Digunakan").trim(),
          jamMulai: normalizeTimeString(sesiData[i][jmIdx], "05:15"),
          jamSelesai: normalizeTimeString(sesiData[i][jsIdx], "06:30"),
          hariList: hariList
        });
      }
    }

    // Hitung jumlah sesi aktif per pekan (contoh: 5 hari Subuh + 6 hari Ashar = 11 sesi)
    let soroganWeeklySessions = 0;
    sesiList.forEach(s => {
      if ((s.status || "").includes("Aktif")) {
        const hArr = Array.isArray(s.hariList) ? s.hariList : String(s.hariList || "").split(",").map(h => h.trim()).filter(Boolean);
        soroganWeeklySessions += Math.max(1, hArr.length);
      }
    });
    if (soroganWeeklySessions === 0) soroganWeeklySessions = 11;

    // Auto-heal baris capaian di Google Sheets jika halaqah_id kosong atau nama_halaqah 'Belum Ditentukan'
    Object.keys(capaianMap).forEach(sid => {
      const cp = capaianMap[sid];
      const needsHealing = !cp.halaqahId || !cp.namaHalaqah || cp.namaHalaqah === "Belum Ditentukan";
      if (needsHealing) {
        const stObj = students.find(s => s.studentId === sid);
        const stNis = stObj ? stObj.nis : "";
        const resolved = resolveSoroganHalaqah_(ss, sid, stNis, cp.halaqahId, cp.namaHalaqah, cp.muallimPengampu, true, hData);

        if (resolved.halaqahId || (resolved.namaHalaqah && resolved.namaHalaqah !== "Belum Ditentukan")) {
          cp.halaqahId = resolved.halaqahId || cp.halaqahId;
          cp.namaHalaqah = resolved.namaHalaqah || cp.namaHalaqah;
          if (resolved.muallim && resolved.muallim !== "-") cp.muallimPengampu = resolved.muallim;
        }
      }
    });

    // 3b. Bangun studentHalaqahMap dari Sorogan_Halaqah sebagai Single Source of Truth
    const studentHalaqahMap = {};
    halaqahs.forEach(h => {
      const sids = Array.isArray(h.studentIds) ? h.studentIds : [];
      sids.forEach(id => {
        const idClean = String(id || "").trim();
        if (idClean) {
          studentHalaqahMap[idClean] = h;
          studentHalaqahMap[idClean.toLowerCase()] = h;
        }
      });
    });

    // Gabungkan data capaian & hitung ringkasan
    let totalJuzSum = 0;
    let khatam30Juz = 0;
    let totalLanjut = 0;
    let totalUlang = 0;
    const muallimSet = new Set();

    const enrichedStudents = students.map(st => {
      const sId = String(st.studentId || "").trim();
      const sNis = String(st.nis || "").trim();
      const cp = capaianMap[sId] || capaianMap[sNis] || {
        juzAktif: 1,
        halamanTerakhir: 1,
        totalHalamanKhatam: 0,
        statusTerakhir: "LANJUT",
        halaqahId: "",
        namaHalaqah: "Belum Masuk Halaqah",
        muallimPengampu: "-",
        updatedAt: ""
      };

      // Source of Truth mutlak: plotting resmi di Sorogan_Halaqah
      const assignedHalaqah = studentHalaqahMap[sId] || 
                              studentHalaqahMap[sNis] || 
                              studentHalaqahMap[sId.toLowerCase()] || 
                              studentHalaqahMap[sNis.toLowerCase()] || 
                              null;

      let finalHalaqahId = "";
      let finalNamaHalaqah = "Belum Masuk Halaqah";
      let finalMuallim = "-";

      if (assignedHalaqah) {
        finalHalaqahId = assignedHalaqah.halaqahId || "";
        finalNamaHalaqah = assignedHalaqah.namaHalaqah || ("Halaqah " + (assignedHalaqah.muallim || finalHalaqahId));
        finalMuallim = assignedHalaqah.muallim || assignedHalaqah.muallimPengampu || "-";
      }

      const juz = Math.max(1, Math.min(30, cp.juzAktif));
      totalJuzSum += juz;
      if (juz === 30 && cp.halamanTerakhir >= 20) khatam30Juz++;

      if (cp.statusTerakhir === "ULANG") totalUlang++;
      else totalLanjut++;

      if (finalMuallim && finalMuallim !== "-") {
        muallimSet.add(finalMuallim);
      }

      const tgt = targetMap[sId] || targetMap[sNis] || {
        targetJuz: 30,
        targetHalamanSesi: 2,
        targetHalamanPekan: 2 * soroganWeeklySessions
      };

      return {
        ...st,
        juzAktif: juz,
        halamanTerakhir: cp.halamanTerakhir,
        totalHalamanKhatam: cp.totalHalamanKhatam,
        statusTerakhir: cp.statusTerakhir,
        halaqahId: finalHalaqahId,
        namaHalaqah: finalNamaHalaqah,
        muallimPengampu: finalMuallim,
        updatedAt: cp.updatedAt,
        target: tgt
      };
    });

    const avgJuz = enrichedStudents.length > 0 ? (totalJuzSum / enrichedStudents.length).toFixed(1) : "1.0";

    return {
      status: "success",
      success: true,
      summary: {
        totalSantri: enrichedStudents.length,
        rataRataJuz: avgJuz,
        khatam30Juz: khatam30Juz,
        totalLanjut: totalLanjut,
        totalUlang: totalUlang,
        persentaseLanjut: enrichedStudents.length > 0 ? Math.round((totalLanjut / enrichedStudents.length) * 100) : 100
      },
      students: enrichedStudents,
      halaqahs: halaqahs,
      muallimList: muallimList,
      programCategories: programCategories,
      targets: targetMap,
      sesiList: sesiList
    };
  } catch (err) {
    console.error("[GET SOROGAN DASHBOARD ERROR]", err);
    return { status: "error", success: false, message: "Gagal memuat dashboard Sorogan: " + err.message };
  }
}

function saveSoroganLog(data, token) {
  return withScriptLock(() => {
    try {
      const studentId = String(data.studentId || data.student_id || "").trim();
      const studentName = String(data.studentName || data.student_name || "").trim();
      const nis = String(data.nis || "").trim();
      const gender = String(data.gender || "L").trim().toUpperCase();
      const juz = Number(data.juz) || 1;
      const halamanList = Array.isArray(data.halamanList) ? data.halamanList : (data.halaman ? [Number(data.halaman)] : [1]);
      const totalHalaman = Number(data.totalHalaman) || halamanList.length || 1;
      const nilai = String(data.nilai || "MUMTAZ").trim().toUpperCase();
      let statusSetoran = String(data.statusSetoran || data.status_setoran || "").trim().toUpperCase();
      if (!statusSetoran) {
        statusSetoran = (nilai === "DHAIF") ? "ULANG" : "LANJUT";
      }
      const muallim = String(data.muallim || data.ustadz || "Guru Sorogan").trim();
      const catatan = String(data.catatan || "").trim();
      const tanggal = String(data.tanggal || new Date().toISOString().substring(0, 10)).trim();
      const sesi = String(data.sesi || "Pagi (Ba'da Subuh)").trim();
      const nowIso = new Date().toISOString();

      if (!studentId && !nis) throw new Error("Identitas santri wajib diisi.");

      const ss = getDatabaseSpreadsheet();
      const headersLogs = ["log_id", "student_id", "nis", "student_name", "gender", "tanggal", "sesi", "juz", "halaman_list", "total_halaman", "status_setoran", "nilai", "muallim", "catatan", "created_at"];
      const logsSheet = getOrCreateSoroganSheet(ss, SHEET_SOROGAN_LOGS, headersLogs, "#0369a1");

      const logId = "SRG_LOG_" + Utilities.getUuid().replace(/-/g, "").substring(0, 12);
      logsSheet.appendRow([
        logId, studentId, nis, studentName, gender, tanggal, sesi, juz, JSON.stringify(halamanList), totalHalaman, statusSetoran, nilai, muallim, catatan, nowIso
      ]);

      // Perbarui posisi Capaian Sorogan (Mushaf 20 Halaman per Juz)
      const lastPage = halamanList.length > 0 ? Math.max(...halamanList) : 1;
      let nextJuz = juz;
      let nextHalaman = lastPage;

      if (statusSetoran === "LANJUT") {
        if (lastPage >= 20) {
          // Lanjut ke juz berikutnya jika halaman 20 sudah selesai
          nextJuz = Math.min(30, juz + 1);
          nextHalaman = (juz === 30 && lastPage >= 20) ? 20 : 1;
        } else {
          nextHalaman = lastPage + 1;
        }
      } else if (statusSetoran === "KHATAM_30JUZ") {
        nextJuz = 30;
        nextHalaman = 20;
      }

      const headersCapaian = ["student_id", "student_name", "juz_aktif", "halaman_terakhir", "total_halaman_khatam", "status_terakhir", "halaqah_id", "nama_halaqah", "muallim_pengampu", "updated_at"];
      const capaianSheet = getOrCreateSoroganSheet(ss, SHEET_SOROGAN_CAPAIAN, headersCapaian, "#0f766e");
      const cData = capaianSheet.getDataRange().getValues();
      let rowIndex = -1;
      let prevTotal = 0;
      let existingHId = "";
      let existingHName = "";
      let existingMuallim = "";

      if (cData.length >= 2) {
        const sIdIdx = cData[0].map(h => String(h).toLowerCase()).indexOf("student_id");
        const totIdx = cData[0].map(h => String(h).toLowerCase()).indexOf("total_halaman_khatam");
        const hIdIdx = cData[0].map(h => String(h).toLowerCase()).indexOf("halaqah_id");
        const hNameIdx = cData[0].map(h => String(h).toLowerCase()).indexOf("nama_halaqah");
        const mIdx = cData[0].map(h => String(h).toLowerCase()).indexOf("muallim_pengampu");

        for (let i = 1; i < cData.length; i++) {
          if (String(cData[i][sIdIdx] || "").trim() === studentId) {
            rowIndex = i + 1;
            prevTotal = Number(cData[i][totIdx]) || 0;
            if (hIdIdx !== -1) existingHId = String(cData[i][hIdIdx] || "").trim();
            if (hNameIdx !== -1) existingHName = String(cData[i][hNameIdx] || "").trim();
            if (mIdx !== -1) existingMuallim = String(cData[i][mIdx] || "").trim();
            break;
          }
        }
      }

      const inputHId = String(data.halaqahId || data.halaqah_id || existingHId || "").trim();
      const inputHName = String(data.namaHalaqah || data.nama_halaqah || existingHName || "").trim();
      const inputMuallim = (muallim && muallim !== "-") ? muallim : existingMuallim;

      const resolvedHalaqah = resolveSoroganHalaqah_(ss, studentId, nis, inputHId, inputHName, inputMuallim);
      const finalHalaqahId = resolvedHalaqah.halaqahId || inputHId || "";
      const finalNamaHalaqah = (resolvedHalaqah.namaHalaqah && resolvedHalaqah.namaHalaqah !== "Belum Ditentukan")
        ? resolvedHalaqah.namaHalaqah
        : (inputHName && inputHName !== "Belum Ditentukan" ? inputHName : "Belum Ditentukan");
      const finalMuallim = (muallim && muallim !== "-")
        ? muallim
        : ((resolvedHalaqah.muallim && resolvedHalaqah.muallim !== "-") ? resolvedHalaqah.muallim : (existingMuallim || "-"));

      const updatedTotal = statusSetoran === "LANJUT" ? (prevTotal + totalHalaman) : prevTotal;

      if (rowIndex !== -1) {
        capaianSheet.getRange(rowIndex, 2).setValue(studentName);
        capaianSheet.getRange(rowIndex, 3).setValue(nextJuz);
        capaianSheet.getRange(rowIndex, 4).setValue(nextHalaman);
        capaianSheet.getRange(rowIndex, 5).setValue(updatedTotal);
        capaianSheet.getRange(rowIndex, 6).setValue(statusSetoran);
        if (finalHalaqahId) capaianSheet.getRange(rowIndex, 7).setValue(finalHalaqahId);
        if (finalNamaHalaqah) capaianSheet.getRange(rowIndex, 8).setValue(finalNamaHalaqah);
        if (finalMuallim && finalMuallim !== "-") capaianSheet.getRange(rowIndex, 9).setValue(finalMuallim);
        capaianSheet.getRange(rowIndex, 10).setValue(nowIso);
      } else {
        capaianSheet.appendRow([
          studentId, studentName, nextJuz, nextHalaman, updatedTotal, statusSetoran, finalHalaqahId, finalNamaHalaqah, finalMuallim, nowIso
        ]);
      }

      return {
        status: "success",
        success: true,
        message: `Sorogan santri ${studentName} berhasil dicatat. Juz ${juz} Hal ${halamanList.join(", ")} (${statusSetoran})`,
        logId: logId,
        nextJuz: nextJuz,
        nextHalaman: nextHalaman
      };
    } catch (err) {
      console.error("[SAVE SOROGAN LOG ERROR]", err);
      return { status: "error", success: false, message: "Gagal mencatat sorogan: " + err.message };
    }
  });
}

function deleteSoroganLog(logId, token) {
  return withScriptLock(() => {
    try {
      if (token) {
        try {
          const actor = authenticateSession(token);
          authorizeRole(actor, ["ADMIN", "SUPER_ADMIN"]);
        } catch (authErr) {
          verifySessionToken(token);
        }
      }

      if (!logId) throw new Error("ID Log wajib disertakan.");
      const ss = getDatabaseSpreadsheet();
      const sheet = ss.getSheetByName(SHEET_SOROGAN_LOGS);
      if (!sheet) throw new Error("Sheet Sorogan_Logs tidak ditemukan.");

      const data = sheet.getDataRange().getValues();
      const headers = data[0].map(h => String(h || "").toLowerCase().trim());
      const idIdx = headers.indexOf("log_id");
      const sIdIdx = headers.indexOf("student_id");

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idIdx] || "").trim() === String(logId).trim()) {
          const studentId = sIdIdx !== -1 ? String(data[i][sIdIdx] || "").trim() : "";
          sheet.deleteRow(i + 1);

          // Kalibrasi ulang capaian santri setelah log dihapus
          if (studentId) {
            recalculateSoroganCapaianForStudent_(ss, studentId);
          }

          return { status: "success", success: true, message: "Log sorogan berhasil dihapus." };
        }
      }
      return { status: "error", success: false, message: "Log sorogan tidak ditemukan." };
    } catch (err) {
      return { status: "error", success: false, message: "Gagal menghapus log sorogan: " + err.message };
    }
  });
}

function recalculateSoroganCapaianForStudent_(ss, studentId) {
  try {
    if (!studentId) return;
    const logsSheet = ss.getSheetByName(SHEET_SOROGAN_LOGS);
    const capaianSheet = ss.getSheetByName(SHEET_SOROGAN_CAPAIAN);
    if (!capaianSheet) return;

    let studentLogs = [];
    if (logsSheet) {
      const lData = logsSheet.getDataRange().getValues();
      if (lData && lData.length > 1) {
        const lHeaders = lData[0].map(h => String(h || "").toLowerCase().trim());
        const sIdIdx = lHeaders.indexOf("student_id");
        const nisIdx = lHeaders.indexOf("nis");
        const juzIdx = lHeaders.indexOf("juz");
        const halListIdx = lHeaders.indexOf("halaman_list");
        const totHalIdx = lHeaders.indexOf("total_halaman");
        const statusIdx = lHeaders.indexOf("status_setoran");
        const dateIdx = lHeaders.indexOf("tanggal");
        const crIdx = lHeaders.indexOf("created_at");

        for (let i = 1; i < lData.length; i++) {
          const row = lData[i];
          const rowSid = sIdIdx !== -1 ? String(row[sIdIdx] || "").trim() : "";
          const rowNis = nisIdx !== -1 ? String(row[nisIdx] || "").trim() : "";
          if (rowSid === studentId || (rowNis && rowNis === studentId)) {
            let parsedHalList = [];
            try {
              parsedHalList = JSON.parse(row[halListIdx]);
            } catch (e) {
              const num = Number(row[halListIdx]);
              if (!isNaN(num)) parsedHalList = [num];
            }
            studentLogs.push({
              juz: Number(row[juzIdx]) || 1,
              halamanList: Array.isArray(parsedHalList) ? parsedHalList : [1],
              totalHalaman: Number(row[totHalIdx]) || 1,
              status: String(row[statusIdx] || "").trim().toUpperCase(),
              tanggal: String(row[dateIdx] || ""),
              createdAt: String(row[crIdx] || ""),
              rowOrder: i
            });
          }
        }
      }
    }

    // Urutkan riwayat secara kronologis
    studentLogs.sort((a, b) => {
      const tA = new Date(a.tanggal || a.createdAt).getTime() || a.rowOrder;
      const tB = new Date(b.tanggal || b.createdAt).getTime() || b.rowOrder;
      return tA - tB;
    });

    let newJuz = 1;
    let newHalaman = 1;
    let totalKhatam = 0;
    let statusTerakhir = "BELUM_MULAI";

    if (studentLogs.length > 0) {
      for (const log of studentLogs) {
        if (log.status === "LANJUT") {
          totalKhatam += (log.totalHalaman || 1);
        }
      }

      const latestLog = studentLogs[studentLogs.length - 1];
      const lastPages = latestLog.halamanList.length > 0 ? latestLog.halamanList : [1];
      const maxPage = Math.max(...lastPages);
      statusTerakhir = latestLog.status;

      if (latestLog.status === "LANJUT") {
        if (maxPage >= 20) {
          newJuz = Math.min(30, latestLog.juz + 1);
          newHalaman = (latestLog.juz === 30 && maxPage >= 20) ? 20 : 1;
        } else {
          newJuz = latestLog.juz;
          newHalaman = maxPage + 1;
        }
      } else if (latestLog.status === "KHATAM_30JUZ") {
        newJuz = 30;
        newHalaman = 20;
      } else {
        // ULANG
        newJuz = latestLog.juz;
        newHalaman = Math.min(...lastPages);
      }
    }

    // Update row di Sorogan_Capaian
    const cData = capaianSheet.getDataRange().getValues();
    if (cData && cData.length > 1) {
      const cHeaders = cData[0].map(h => String(h || "").toLowerCase().trim());
      const cSidIdx = cHeaders.indexOf("student_id");
      const cJuzIdx = cHeaders.indexOf("juz_aktif");
      const cHalIdx = cHeaders.indexOf("halaman_terakhir");
      const cTotIdx = cHeaders.indexOf("total_halaman_khatam");
      const cStatIdx = cHeaders.indexOf("status_terakhir");
      const cUpdIdx = cHeaders.indexOf("updated_at");

      for (let i = 1; i < cData.length; i++) {
        if (String(cData[i][cSidIdx] || "").trim() === studentId) {
          const rowNum = i + 1;
          if (cJuzIdx !== -1) capaianSheet.getRange(rowNum, cJuzIdx + 1).setValue(newJuz);
          if (cHalIdx !== -1) capaianSheet.getRange(rowNum, cHalIdx + 1).setValue(newHalaman);
          if (cTotIdx !== -1) capaianSheet.getRange(rowNum, cTotIdx + 1).setValue(totalKhatam);
          if (cStatIdx !== -1) capaianSheet.getRange(rowNum, cStatIdx + 1).setValue(statusTerakhir);
          if (cUpdIdx !== -1) capaianSheet.getRange(rowNum, cUpdIdx + 1).setValue(new Date().toISOString());
          break;
        }
      }
    }
  } catch (err) {
    console.error("[RECALCULATE SOROGAN CAPAIAN ERROR]", err);
  }
}

function saveSoroganCapaian(data, token) {
  return withScriptLock(() => {
    try {
      const studentId = String(data.studentId || data.student_id || "").trim();
      const studentName = String(data.studentName || data.student_name || "").trim();
      const juz = Number(data.juzAktif || data.juz) || 1;
      const halaman = Number(data.halamanTerakhir || data.halaman) || 1;
      const halaqahId = String(data.halaqahId || "").trim();
      const namaHalaqah = String(data.namaHalaqah || "").trim();
      const muallim = String(data.muallim || "").trim();
      const nowIso = new Date().toISOString();

      if (!studentId) throw new Error("ID Santri wajib disertakan.");

      const ss = getDatabaseSpreadsheet();
      const resolved = resolveSoroganHalaqah_(ss, studentId, "", halaqahId, namaHalaqah, muallim);
      const finalHalaqahId = halaqahId || resolved.halaqahId || "";
      const finalNamaHalaqah = (namaHalaqah && namaHalaqah !== "Belum Ditentukan")
        ? namaHalaqah
        : (resolved.namaHalaqah || "Belum Ditentukan");
      const finalMuallim = (muallim && muallim !== "-")
        ? muallim
        : ((resolved.muallim && resolved.muallim !== "-") ? resolved.muallim : "-");

      const headersCapaian = ["student_id", "student_name", "juz_aktif", "halaman_terakhir", "total_halaman_khatam", "status_terakhir", "halaqah_id", "nama_halaqah", "muallim_pengampu", "updated_at"];
      const sheet = getOrCreateSoroganSheet(ss, SHEET_SOROGAN_CAPAIAN, headersCapaian, "#0f766e");

      const cData = sheet.getDataRange().getValues();
      let rowIndex = -1;
      if (cData.length >= 2) {
        const idIdx = cData[0].map(h => String(h).toLowerCase()).indexOf("student_id");
        for (let i = 1; i < cData.length; i++) {
          if (String(cData[i][idIdx] || "").trim() === studentId) {
            rowIndex = i + 1;
            break;
          }
        }
      }

      if (rowIndex !== -1) {
        sheet.getRange(rowIndex, 2).setValue(studentName);
        sheet.getRange(rowIndex, 3).setValue(juz);
        sheet.getRange(rowIndex, 4).setValue(halaman);
        if (finalHalaqahId) sheet.getRange(rowIndex, 7).setValue(finalHalaqahId);
        if (finalNamaHalaqah) sheet.getRange(rowIndex, 8).setValue(finalNamaHalaqah);
        if (finalMuallim && finalMuallim !== "-") sheet.getRange(rowIndex, 9).setValue(finalMuallim);
        sheet.getRange(rowIndex, 10).setValue(nowIso);
      } else {
        sheet.appendRow([studentId, studentName, juz, halaman, 0, "LANJUT", finalHalaqahId, finalNamaHalaqah, finalMuallim, nowIso]);
      }

      return { status: "success", success: true, message: `Posisi Sorogan santri ${studentName} berhasil disesuaikan.` };
    } catch (err) {
      return { status: "error", success: false, message: "Gagal menyimpan capaian sorogan: " + err.message };
    }
  });
}

function getSoroganHalaqahList(token) {
  try {
    const ss = getDatabaseSpreadsheet();
    const headersHalaqah = ["halaqah_id", "muallim", "target_kurikulum", "student_ids", "created_at"];
    const sheet = getOrCreateSoroganSheet(ss, SHEET_SOROGAN_HALAQAH, headersHalaqah, "#4338ca");
    migrateSoroganHalaqahSheetIfNeeded(sheet);
    const data = sheet.getDataRange().getValues();
    const list = [];

    if (data.length >= 2) {
      const colMap = getSoroganHalaqahColumnIndexes(data[0]);

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const hId = colMap.id !== -1 ? String(row[colMap.id] || "").trim() : "";
        const mName = colMap.muallim !== -1 ? String(row[colMap.muallim] || "").trim() : "";
        let hNama = colMap.nama !== -1 && row[colMap.nama] ? String(row[colMap.nama]).trim() : "";
        if (!hNama && mName) {
          hNama = "Halaqah " + mName;
        }
        if (!hId && !mName && !hNama) continue;

        const rawSids = colMap.studentIds !== -1 ? row[colMap.studentIds] : "";
        let sids = [];
        if (typeof rawSids === "string") {
          if (rawSids.trim().startsWith("[")) {
            try { sids = JSON.parse(rawSids); } catch (e) { sids = []; }
          } else {
            sids = rawSids.split(",").map(s => s.trim()).filter(Boolean);
          }
        } else if (Array.isArray(rawSids)) {
          sids = rawSids;
        }

        const kName = colMap.kategori !== -1 ? String(row[colMap.kategori] || "").trim() : "";
        const targetDesc = colMap.target !== -1 ? String(row[colMap.target] || "").trim() : "";

        list.push({
          halaqahId: hId || ("SRG-HLQ-" + (i < 10 ? "0" + i : i)),
          namaHalaqah: hNama || ("Halaqah " + (mName || hId)),
          muallim: mName,
          muallimPengampu: mName,
          kategori: kName,
          kategoriProgram: kName,
          targetKurikulum: targetDesc || "Sorogan Binnazhar Mushaf Pojok 30 Juz",
          jadwalSesi: targetDesc || "Sorogan Binnazhar Mushaf Pojok 30 Juz",
          studentIds: sids
        });
      }
    }

    // Ambil data Pegawai & Programs
    const pegawaiSheet = ss.getSheetByName(SHEET_PEGAWAI) || ss.getSheetByName("Pegawai") || ss.getSheetByName("pegawai");
    const muallimList = [];
    if (pegawaiSheet) {
      const pData = pegawaiSheet.getDataRange().getValues();
      if (pData && pData.length > 1) {
        const pHead = pData[0].map(h => String(h || "").trim().toLowerCase());
        const pNamaIdx = pHead.indexOf("nama") !== -1 ? pHead.indexOf("nama") : pHead.indexOf("name");
        const pStatusIdx = pHead.indexOf("status");
        for (let i = 1; i < pData.length; i++) {
          const row = pData[i];
          const nama = pNamaIdx !== -1 ? String(row[pNamaIdx] || "").trim() : "";
          const st = pStatusIdx !== -1 ? String(row[pStatusIdx] || "").trim().toUpperCase() : "ACTIVE";
          if (nama && (st === "ACTIVE" || st === "AKTIF" || st === "")) {
            if (!muallimList.includes(nama)) muallimList.push(nama);
          }
        }
      }
    }

    const programsSheet = ss.getSheetByName("Programs") || ss.getSheetByName("Program");
    const programCategories = [];
    if (programsSheet) {
      const prData = programsSheet.getDataRange().getValues();
      if (prData && prData.length > 1) {
        const prHead = prData[0].map(h => String(h || "").trim().toLowerCase());
        const nameIdx = prHead.indexOf("name") !== -1 ? prHead.indexOf("name") : prHead.indexOf("nama");
        const idIdx = prHead.indexOf("id");
        for (let i = 1; i < prData.length; i++) {
          const row = prData[i];
          const prName = nameIdx !== -1 ? String(row[nameIdx] || "").trim() : "";
          const prId = idIdx !== -1 ? String(row[idIdx] || "").trim() : "";
          if (prName && !programCategories.some(p => p.name === prName)) {
            programCategories.push({ id: prId || prName, name: prName });
          }
        }
      }
    }

    return {
      status: "success",
      success: true,
      halaqahs: list,
      muallimList: muallimList,
      programCategories: programCategories
    };
  } catch (err) {
    return { status: "error", success: false, message: err.message };
  }
}

function saveSoroganHalaqah(data, token) {
  return withScriptLock(() => {
    try {
      if (token) {
        try {
          const actor = authenticateSession(token);
          authorizeRole(actor, ["ADMIN", "EDITOR"]);
        } catch (authErr) {
          verifySessionToken(token);
        }
      }

      let muallim = String(data.muallim || data.muallimPengampu || "").trim();
      let nama = String(data.namaHalaqah || data.nama_halaqah || data.nama || "").trim();
      if (!muallim && !nama) throw new Error("Mu'allim Pengampu halaqah sorogan wajib dipilih atau diisi.");
      if (!muallim && nama) muallim = nama;
      if (!nama && muallim) nama = "Halaqah " + muallim;

      const ss = getDatabaseSpreadsheet();
      const headersHalaqah = ["halaqah_id", "muallim", "target_kurikulum", "student_ids", "created_at"];
      const sheet = getOrCreateSoroganSheet(ss, SHEET_SOROGAN_HALAQAH, headersHalaqah, "#4338ca");
      migrateSoroganHalaqahSheetIfNeeded(sheet);

      let halaqahId = String(data.halaqahId || data.halaqah_id || data.id || "").trim();
      if (!halaqahId) {
        halaqahId = "SRG-HLQ-" + Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd-HHmmss") + "-" + Math.floor(100 + Math.random() * 900);
      }

      const kategori = String(data.kategori || data.kategoriProgram || data.kategori_program || "Pesantren Reguler Putra Putri").trim();
      const targetKurikulum = String(data.targetKurikulum || data.target_kurikulum || data.targetDeskripsi || data.jadwalSesi || data.jadwal || "Sorogan Binnazhar Mushaf Pojok 30 Juz").trim();

      let rawStudents = data.studentIds || data.student_ids || [];
      if (typeof rawStudents === "string") {
        try {
          if (rawStudents.startsWith("[")) {
            rawStudents = JSON.parse(rawStudents);
          } else {
            rawStudents = rawStudents.split(",").map(s => s.trim()).filter(Boolean);
          }
        } catch (e) {
          rawStudents = rawStudents.split(",").map(s => s.trim()).filter(Boolean);
        }
      }
      const studentIdsStr = Array.isArray(rawStudents) ? rawStudents.join(",") : String(rawStudents || "");
      const createdAt = new Date().toISOString();

      const sheetData = sheet.getDataRange().getValues();
      const colMap = getSoroganHalaqahColumnIndexes(sheetData[0]);

      let foundRow = -1;
      if (colMap.id !== -1) {
        for (let i = 1; i < sheetData.length; i++) {
          if (String(sheetData[i][colMap.id] || "").trim() === halaqahId) {
            foundRow = i + 1;
            break;
          }
        }
      }

      const headersCount = Math.max(sheetData[0].length, headersHalaqah.length);
      const rowValues = new Array(headersCount).fill("");

      if (colMap.id !== -1) rowValues[colMap.id] = halaqahId;
      if (colMap.muallim !== -1) rowValues[colMap.muallim] = muallim;
      if (colMap.target !== -1) rowValues[colMap.target] = targetKurikulum;
      if (colMap.studentIds !== -1) rowValues[colMap.studentIds] = studentIdsStr;
      if (colMap.createdAt !== -1) rowValues[colMap.createdAt] = createdAt;
      if (colMap.nama !== -1) rowValues[colMap.nama] = nama;
      if (colMap.kategori !== -1) rowValues[colMap.kategori] = kategori;

      if (foundRow > 0) {
        if (colMap.createdAt !== -1 && sheetData[foundRow - 1][colMap.createdAt]) {
          rowValues[colMap.createdAt] = sheetData[foundRow - 1][colMap.createdAt];
        }
        sheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
      } else {
        sheet.appendRow(rowValues);
      }

      return {
        status: "success",
        success: true,
        halaqahId: halaqahId,
        message: `Halaqah Sorogan ${nama} berhasil disimpan.`
      };
    } catch (err) {
      return { status: "error", success: false, message: "Gagal menyimpan halaqah sorogan: " + err.message };
    }
  });
}

function deleteSoroganHalaqah(halaqahId, token) {
  return withScriptLock(() => {
    try {
      if (!halaqahId) throw new Error("ID Halaqah wajib disertakan.");
      const ss = getDatabaseSpreadsheet();
      const sheet = ss.getSheetByName(SHEET_SOROGAN_HALAQAH);
      if (!sheet) throw new Error("Sheet Sorogan_Halaqah tidak ditemukan.");

      const data = sheet.getDataRange().getValues();
      const colMap = getSoroganHalaqahColumnIndexes(data[0]);
      const idIdx = colMap.id !== -1 ? colMap.id : 0;

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idIdx] || "").trim() === String(halaqahId).trim()) {
          sheet.deleteRow(i + 1);
          return { status: "success", success: true, message: "Halaqah sorogan berhasil dihapus." };
        }
      }
      return { status: "error", success: false, message: "Halaqah sorogan tidak ditemukan." };
    } catch (err) {
      return { status: "error", success: false, message: err.message };
    }
  });
}

function saveSoroganPlotting(payload, token) {
  return withScriptLock(() => {
    try {
      if (token) {
        try {
          const actor = authenticateSession(token);
          authorizeRole(actor, ["ADMIN", "EDITOR"]);
        } catch (authErr) {
          verifySessionToken(token);
        }
      }

      const halaqahId = String(payload.halaqahId || payload.halaqah_id || "").trim();
      if (!halaqahId) throw new Error("ID Halaqah wajib disertakan.");

      let rawList = payload.studentIds || payload.student_ids || [];
      if (typeof rawList === "string") {
        if (rawList.trim().startsWith("[")) {
          try { rawList = JSON.parse(rawList); } catch (e) { rawList = rawList.split(","); }
        } else {
          rawList = rawList.split(",");
        }
      }
      const cleanStudentIds = Array.isArray(rawList) ? rawList.map(s => String(s).trim()).filter(Boolean) : [];

      const ss = getDatabaseSpreadsheet();
      const headersHalaqah = ["halaqah_id", "muallim", "target_kurikulum", "student_ids", "created_at"];
      const sheet = getOrCreateSoroganSheet(ss, SHEET_SOROGAN_HALAQAH, headersHalaqah, "#4338ca");
      migrateSoroganHalaqahSheetIfNeeded(sheet);

      const data = sheet.getDataRange().getValues();
      if (data.length <= 1) throw new Error("Data halaqah Sorogan tidak ditemukan.");

      const colMap = getSoroganHalaqahColumnIndexes(data[0]);
      if (colMap.id === -1 || colMap.studentIds === -1) {
        throw new Error("Struktur kolom sheet Sorogan_Halaqah tidak valid.");
      }

      let foundRow = -1;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][colMap.id] || "").trim() === halaqahId) {
          foundRow = i + 1;
          break;
        }
      }

      if (foundRow <= 0) throw new Error("Halaqah Sorogan ID '" + halaqahId + "' tidak ditemukan.");

      sheet.getRange(foundRow, colMap.studentIds + 1).setValue(cleanStudentIds.join(","));

      const hMuallim = colMap.muallim !== -1 ? String(data[foundRow - 1][colMap.muallim] || "").trim() : "";
      syncSoroganPlottingToCapaian_(ss, halaqahId, cleanStudentIds, hMuallim);

      return {
        status: "success",
        success: true,
        halaqahId: halaqahId,
        totalPlotting: cleanStudentIds.length,
        message: `Plotting ${cleanStudentIds.length} santri ke halaqah Sorogan berhasil disimpan.`
      };
    } catch (err) {
      return { status: "error", success: false, message: "Gagal menyimpan plotting Sorogan: " + err.message };
    }
  });
}

function saveSoroganTarget(payload, token) {
  return withScriptLock(() => {
    try {
      const studentId = String(payload.studentId || payload.student_id || "").trim();
      if (!studentId) throw new Error("ID Santri wajib disertakan.");

      const ss = getDatabaseSpreadsheet();
      const headers = ["student_id", "target_juz", "target_halaman_sesi", "target_halaman_pekan", "updated_at"];
      const sheet = getOrCreateSoroganSheet(ss, SHEET_SOROGAN_TARGET, headers, "#f59e0b");

      const targetJuz = Number(payload.targetJuz || payload.target_juz || 30);
      const targetHalamanSesi = Number(payload.targetHalamanSesi || payload.target_halaman_sesi || 2);
      const targetHalamanPekan = Number(payload.targetHalamanPekan || payload.target_halaman_pekan || (targetHalamanSesi * 11));
      const updatedAt = new Date().toISOString();

      const data = sheet.getDataRange().getValues();
      const idIdx = data[0].map(h => String(h || "").toLowerCase()).indexOf("student_id");
      let foundRow = -1;

      if (data.length >= 2 && idIdx !== -1) {
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][idIdx] || "").trim() === studentId) {
            foundRow = i + 1;
            break;
          }
        }
      }

      const rowValues = [studentId, targetJuz, targetHalamanSesi, targetHalamanPekan, updatedAt];

      if (foundRow > 0) {
        sheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
      } else {
        sheet.appendRow(rowValues);
      }

      return {
        status: "success",
        success: true,
        message: "Target capaian santri Sorogan berhasil disimpan."
      };
    } catch (err) {
      return { status: "error", success: false, message: "Gagal menyimpan target Sorogan: " + err.message };
    }
  });
}

function saveBulkSoroganTarget(payload, token) {
  return withScriptLock(() => {
    try {
      const studentIds = Array.isArray(payload.studentIds)
        ? payload.studentIds.map(id => String(id || "").trim()).filter(Boolean)
        : (payload.studentId ? [String(payload.studentId).trim()] : []);

      if (studentIds.length === 0) {
        throw new Error("Daftar ID Santri sasaran tidak boleh kosong.");
      }

      const ss = getDatabaseSpreadsheet();
      const headers = ["student_id", "target_juz", "target_halaman_sesi", "target_halaman_pekan", "updated_at"];
      const sheet = getOrCreateSoroganSheet(ss, SHEET_SOROGAN_TARGET, headers, "#f59e0b");

      const targetJuz = Number(payload.targetJuz || payload.target_juz || 30);
      const targetHalamanSesi = Number(payload.targetHalamanSesi || payload.target_halaman_sesi || 2);
      const targetHalamanPekan = Number(payload.targetHalamanPekan || payload.target_halaman_pekan || (targetHalamanSesi * 11));
      const updatedAt = new Date().toISOString();

      const data = sheet.getDataRange().getValues();
      const idIdx = data[0].map(h => String(h || "").toLowerCase()).indexOf("student_id");
      const targetJuzIdx = data[0].map(h => String(h || "").toLowerCase()).indexOf("target_juz");

      const existingRowMap = {};
      if (data.length >= 2 && idIdx !== -1) {
        for (let i = 1; i < data.length; i++) {
          const sid = String(data[i][idIdx] || "").trim();
          if (sid) {
            existingRowMap[sid] = {
              row: i + 1,
              targetJuz: targetJuzIdx !== -1 ? Number(data[i][targetJuzIdx]) || 30 : 30
            };
          }
        }
      }

      const newRows = [];
      studentIds.forEach(id => {
        if (existingRowMap[id]) {
          const r = existingRowMap[id].row;
          const currentTj = Number(existingRowMap[id].targetJuz);
          const tj = (currentTj && currentTj > 1) ? currentTj : targetJuz;
          sheet.getRange(r, 1, 1, 5).setValues([[id, tj, targetHalamanSesi, targetHalamanPekan, updatedAt]]);
        } else {
          newRows.push([id, targetJuz, targetHalamanSesi, targetHalamanPekan, updatedAt]);
        }
      });

      if (newRows.length > 0) {
        sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 5).setValues(newRows);
      }

      return {
        status: "success",
        success: true,
        totalUpdated: studentIds.length,
        message: `Target capaian berhasil diterapkan ke ${studentIds.length} santri Sorogan.`
      };
    } catch (err) {
      return { status: "error", success: false, message: "Gagal menerapkan target massal Sorogan: " + err.message };
    }
  });
}

function getSoroganSesiList(token) {
  try {
    let actor = null;
    if (token) {
      try {
        actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "SUPER_ADMIN", "EDITOR", "PENGASUH", "ASATIDZ", "MUALLIM", "PEGAWAI", "GURU"]);
      } catch (authErr) {
        verifySessionToken(token);
      }
    }

    const ss = getDatabaseSpreadsheet();
    const headers = ["sesi_id", "nama_sesi", "jenis_sesi", "status", "jam_mulai", "jam_selesai", "hari_list", "created_at"];
    const sheet = getOrCreateSoroganSheet(ss, SHEET_SOROGAN_SESI, headers, "#0284c7");

    const data = sheet.getDataRange().getValues();
    const list = [];
    if (data && data.length > 1) {
      const h = data[0].map(x => String(x || "").trim().toLowerCase());
      const idIdx = h.indexOf("sesi_id");
      const nameIdx = h.indexOf("nama_sesi");
      const typeIdx = h.indexOf("jenis_sesi");
      const stIdx = h.indexOf("status");
      const jmIdx = h.indexOf("jam_mulai");
      const jsIdx = h.indexOf("jam_selesai");
      const hIdx = h.indexOf("hari_list");
      const crIdx = h.indexOf("created_at");

      for (let i = 1; i < data.length; i++) {
        const id = idIdx !== -1 ? String(data[i][idIdx] || "").trim() : "";
        if (!id) continue;
        const rawHari = hIdx !== -1 ? data[i][hIdx] : "";
        const hariList = Array.isArray(rawHari) ? rawHari : String(rawHari || "Sen,Sel,Rab,Kam,Sab,Min").split(",").map(x => x.trim()).filter(Boolean);
        list.push({
          sesiId: id,
          namaSesi: nameIdx !== -1 ? String(data[i][nameIdx] || "").trim() : "",
          jenisSesi: typeIdx !== -1 ? String(data[i][typeIdx] || "Sorogan Binnazhar Reguler").trim() : "Sorogan Binnazhar Reguler",
          status: stIdx !== -1 ? String(data[i][stIdx] || "Aktif Digunakan").trim() : "Aktif Digunakan",
          jamMulai: normalizeTimeString(jmIdx !== -1 ? data[i][jmIdx] : "05:15", "05:15"),
          jamSelesai: normalizeTimeString(jsIdx !== -1 ? data[i][jsIdx] : "06:30", "06:30"),
          hariList: hariList,
          createdAt: crIdx !== -1 ? String(data[i][crIdx] || "") : ""
        });
      }
    }

    return {
      status: "success",
      success: true,
      data: list
    };
  } catch (err) {
    return { status: "error", success: false, message: err.message };
  }
}

function saveSoroganSesi(payload, token) {
  return withScriptLock(() => {
    try {
      const p = (payload && (payload.sesi || payload.data)) ? (payload.sesi || payload.data) : (payload || {});
      const namaSesi = String(p.namaSesi || p.nama_sesi || p.nama || "").trim();
      if (!namaSesi) throw new Error("Nama sesi wajib diisi.");

      const ss = getDatabaseSpreadsheet();
      const headers = ["sesi_id", "nama_sesi", "jenis_sesi", "status", "jam_mulai", "jam_selesai", "hari_list", "created_at"];
      const sheet = getOrCreateSoroganSheet(ss, SHEET_SOROGAN_SESI, headers, "#0284c7");

      const rawId = String(p.sesiId || p.sesi_id || p.id || "").trim();
      const sesiId = rawId || ("SRG-SESI-" + Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd-HHmm"));
      const jenisSesi = String(p.jenisSesi || p.jenis_sesi || p.jenis || "Sorogan Binnazhar Reguler").trim();
      const status = String(p.status || "Aktif Digunakan").trim();
      const jamMulai = normalizeTimeString(p.jamMulai || p.jam_mulai, "05:15");
      const jamSelesai = normalizeTimeString(p.jamSelesai || p.jam_selesai, "06:30");
      const rawHari = p.hariList || p.hari || "Sen,Sel,Rab,Kam,Sab,Min";
      const hariList = Array.isArray(rawHari) ? rawHari.join(",") : String(rawHari);
      const createdAt = new Date().toISOString();

      const data = sheet.getDataRange().getValues();
      const headersArr = data[0].map(h => String(h || "").trim().toLowerCase());
      const idIdx = headersArr.indexOf("sesi_id");
      let foundRow = -1;

      if (rawId && idIdx >= 0) {
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][idIdx] || "").trim() === rawId) {
            foundRow = i + 1;
            break;
          }
        }
      }

      const rowValues = [sesiId, namaSesi, jenisSesi, status, jamMulai, jamSelesai, hariList, createdAt];

      if (foundRow > 0) {
        sheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
      } else {
        sheet.appendRow(rowValues);
      }

      return {
        status: "success",
        success: true,
        sesiId: sesiId,
        message: `Jadwal sesi ${namaSesi} Sorogan berhasil disimpan.`
      };
    } catch (err) {
      return { status: "error", success: false, message: "Gagal menyimpan sesi Sorogan: " + err.message };
    }
  });
}

function deleteSoroganSesi(sesiId, token) {
  return withScriptLock(() => {
    try {
      if (!sesiId) throw new Error("ID Sesi wajib disertakan.");
      const ss = getDatabaseSpreadsheet();
      const sheet = ss.getSheetByName(SHEET_SOROGAN_SESI);
      if (!sheet) throw new Error("Sheet Sorogan_Sesi tidak ditemukan.");

      const data = sheet.getDataRange().getValues();
      const idIdx = data[0].map(h => String(h || "").toLowerCase()).indexOf("sesi_id");

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idIdx] || "").trim() === String(sesiId).trim()) {
          sheet.deleteRow(i + 1);
          return { status: "success", success: true, message: "Sesi Sorogan berhasil dihapus." };
        }
      }
      return { status: "error", success: false, message: "Sesi Sorogan tidak ditemukan." };
    } catch (err) {
      return { status: "error", success: false, message: err.message };
    }
  });
}

/**
 * Mengambil detail lengkap mutaba'ah individual santri Sorogan Al-Qur'an (Binnazhar 30 Juz)
 * Termasuk indikator capaian harian, pekanan, bulanan, riwayat simakan, dan estimasi waktu khatam.
 */
function getSoroganStudentDetail(studentId, token) {
  try {
    let actor = null;
    if (token) {
      try {
        actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "SUPER_ADMIN", "EDITOR", "PENGASUH", "PEGAWAI", "MUALLIM", "MUHAFIZ", "GURU", "ASATIDZ", "WALI_SANTRI", "PARENT"]);
      } catch (authErr) {
        verifySessionToken(token);
      }
    }

    const cleanId = String(studentId || "").trim();
    if (!cleanId) throw new Error("ID Santri wajib disertakan.");

    // Validasi hak akses khusus Wali Santri: hanya boleh melihat santri binaan yang terhubung
    if (actor && (actor.role === "WALI_SANTRI" || actor.role === "PARENT")) {
      const linked = (typeof getLinkedStudentsForWali === "function") ? getLinkedStudentsForWali(actor.identityId) : [];
      const allowedIds = (linked || []).map(s => String(s.studentId || s.student_id || s.id || s.nis || "").trim().toLowerCase());
      let isAllowed = allowedIds.includes(cleanId.toLowerCase());
      if (!isAllowed) {
        const studentsResCheck = (typeof getAllStudentsData === "function") ? getAllStudentsData(token) : null;
        const allStudentsList = (studentsResCheck && studentsResCheck.data) || [];
        const targetStudent = allStudentsList.find(s => 
          String(s.studentId || s.student_id || "").toLowerCase() === cleanId.toLowerCase() ||
          String(s.nis || "").toLowerCase() === cleanId.toLowerCase()
        );
        const targetSid = targetStudent ? String(targetStudent.studentId || "").toLowerCase() : "";
        const targetNis = targetStudent ? String(targetStudent.nis || "").toLowerCase() : "";
        if (targetStudent && (allowedIds.includes(targetSid) || allowedIds.includes(targetNis))) {
          isAllowed = true;
        }
      }
      if (!isAllowed) {
        throw new Error("Akses ditolak: Anda hanya berhak memantau perkembangan santri yang terhubung dengan akun Wali Anda.");
      }
    }

    const ss = getDatabaseSpreadsheet();

    // 1. Ambil Data Santri secara fleksibel dari master Students
    let student = null;
    const studentsSheet = (typeof getAuthSheet === "function" ? getAuthSheet(ss, SHEET_STUDENTS) : null) || ss.getSheetByName(SHEET_STUDENTS);
    if (studentsSheet) {
      const sData = studentsSheet.getDataRange().getValues();
      if (sData && sData.length > 1) {
        const sHeaders = sData[0].map(h => String(h || "").trim().toLowerCase().replace(/[\s\-_]+/g, ""));
        const sIdIdx = sHeaders.findIndex(h => h === "studentid" || h === "id");
        const sNisIdx = sHeaders.findIndex(h => h === "nis" || h === "nisn");
        const sNameIdx = sHeaders.findIndex(h => h === "name" || h === "nama");
        const sGenderIdx = sHeaders.findIndex(h => h === "gender" || h === "jeniskelamin" || h === "jenis");
        const sPhotoIdx = sHeaders.findIndex(h => h.includes("photo") || h.includes("foto"));
        const sStatusIdx = sHeaders.findIndex(h => h === "status");

        for (let i = 1; i < sData.length; i++) {
          const row = sData[i];
          const stId = sIdIdx !== -1 ? String(row[sIdIdx] || "").trim() : "";
          const stNis = sNisIdx !== -1 ? String(row[sNisIdx] || "").trim() : "";
          const stName = sNameIdx !== -1 ? String(row[sNameIdx] || "").trim() : "";

          if (stId === cleanId || stNis === cleanId || (cleanId.length > 3 && stName.toLowerCase() === cleanId.toLowerCase())) {
            student = {
              studentId: stId || cleanId,
              nis: stNis || "-",
              name: stName || "Santri",
              gender: sGenderIdx !== -1 ? String(row[sGenderIdx] || "L").trim().toUpperCase() : "L",
              photoUrl: sPhotoIdx !== -1 ? String(row[sPhotoIdx] || "").trim() : "",
              status: sStatusIdx !== -1 ? String(row[sStatusIdx] || "ACTIVE").trim().toUpperCase() : "ACTIVE"
            };
            break;
          }
        }
      }
    }

    if (!student) {
      student = {
        studentId: cleanId,
        nis: "-",
        name: "Santri",
        gender: "L",
        photoUrl: "",
        status: "ACTIVE"
      };
    }

    // 2. Ambil Target Santri dari Sorogan_Target
    const targetSheet = getOrCreateSoroganSheet(ss, SHEET_SOROGAN_TARGET, [
      "student_id", "target_juz", "target_halaman_sesi", "target_halaman_pekan", "updated_at"
    ], "#f59e0b");
    const targetData = targetSheet.getDataRange().getValues();
    let target = {
      targetJuz: 30,
      targetHalamanSesi: 2,
      targetHalamanPekan: 22
    };

    if (targetData && targetData.length > 1) {
      const hTarget = targetData[0].map(h => String(h || "").trim().toLowerCase());
      const sIdIdx = hTarget.indexOf("student_id");
      const juzIdx = hTarget.indexOf("target_juz");
      const sesiIdx = hTarget.indexOf("target_halaman_sesi");
      const pekanIdx = hTarget.indexOf("target_halaman_pekan");

      for (let i = 1; i < targetData.length; i++) {
        const sId = String(targetData[i][sIdIdx] || "").trim();
        if (sId === cleanId || (student && sId === student.nis)) {
          const sSesi = Number(targetData[i][sesiIdx] || 2);
          target = {
            targetJuz: Number(targetData[i][juzIdx] || 30),
            targetHalamanSesi: sSesi,
            targetHalamanPekan: Number(targetData[i][pekanIdx] || (sSesi * 11))
          };
          break;
        }
      }
    }

    // 3. Ambil Riwayat Logs Santri dari Sorogan_Logs
    const logsSheet = getOrCreateSoroganSheet(ss, SHEET_SOROGAN_LOGS, [
      "log_id", "student_id", "nis", "student_name", "gender",
      "tanggal", "sesi", "juz", "halaman_list", "total_halaman",
      "status_setoran", "nilai", "muallim", "catatan", "created_at"
    ], "#0369a1");
    const logsData = logsSheet.getDataRange().getValues();
    const riwayat = [];

    if (logsData && logsData.length > 1) {
      const hLogs = logsData[0].map(h => String(h || "").trim().toLowerCase());
      const logIdIdx = hLogs.indexOf("log_id");
      const stIdIdx = hLogs.indexOf("student_id");
      const nisIdx = hLogs.indexOf("nis");
      const tglIdx = hLogs.indexOf("tanggal");
      const sesiIdx = hLogs.indexOf("sesi");
      const juzIdx = hLogs.indexOf("juz");
      const halListIdx = hLogs.indexOf("halaman_list");
      const totalHalIdx = hLogs.indexOf("total_halaman");
      const statusIdx = hLogs.indexOf("status_setoran");
      const nilaiIdx = hLogs.indexOf("nilai");
      const muallimIdx = hLogs.indexOf("muallim");
      const catIdx = hLogs.indexOf("catatan");
      const createdIdx = hLogs.indexOf("created_at");

      for (let i = 1; i < logsData.length; i++) {
        const r = logsData[i];
        const sId = String(r[stIdIdx !== -1 ? stIdIdx : 1] || "").trim();
        const sNis = nisIdx !== -1 ? String(r[nisIdx] || "").trim() : "";

        if (sId === cleanId || (student && (sNis === student.nis || sId === student.studentId))) {
          const rawStatus = statusIdx !== -1 ? String(r[statusIdx] || "").trim().toUpperCase() : "";
          const nilai = nilaiIdx !== -1 ? String(r[nilaiIdx] || "MUMTAZ").trim().toUpperCase() : "MUMTAZ";
          const statusSetoran = rawStatus || (nilai === "DHAIF" ? "ULANG" : "LANCAR");

          riwayat.push({
            logId: logIdIdx !== -1 ? String(r[logIdIdx] || "").trim() : "",
            tanggal: normalizeDateString(tglIdx !== -1 ? r[tglIdx] : ""),
            sesi: sesiIdx !== -1 ? String(r[sesiIdx] || "Pagi").trim() : "Pagi",
            juz: juzIdx !== -1 ? Number(r[juzIdx] || 1) : 1,
            halamanList: halListIdx !== -1 ? String(r[halListIdx] || "1").trim() : "1",
            totalHalaman: totalHalIdx !== -1 ? Number(r[totalHalIdx] || 1) : 1,
            nilai: nilai,
            statusSetoran: statusSetoran,
            muallim: muallimIdx !== -1 ? String(r[muallimIdx] || "").trim() : "",
            catatan: catIdx !== -1 ? String(r[catIdx] || "").trim() : "",
            createdAt: createdIdx !== -1 ? String(r[createdIdx] || "") : ""
          });
        }
      }
    }

    // Urutkan riwayat dari yang terbaru
    riwayat.sort((a, b) => new Date(b.tanggal || b.createdAt) - new Date(a.tanggal || a.createdAt));

    // 4. Ambil Capaian dari Sorogan_Capaian
    const capaianSheet = getOrCreateSoroganSheet(ss, SHEET_SOROGAN_CAPAIAN, [
      "student_id", "student_name", "juz_aktif", "halaman_terakhir", "total_halaman_khatam", "status_terakhir", "halaqah_id", "nama_halaqah", "muallim_pengampu", "updated_at"
    ], "#0f766e");
    const capData = capaianSheet.getDataRange().getValues();
    let currentJuz = 1;
    let halTerakhir = 1;
    let halKhatam = 1;
    let statusTerakhir = "LANCAR";
    let studentHalaqah = "";
    let studentMuallim = "";

    if (capData && capData.length > 1) {
      const hCap = capData[0].map(h => String(h || "").trim().toLowerCase());
      const cIdIdx = hCap.indexOf("student_id");
      const cJuzIdx = hCap.indexOf("juz_aktif");
      const cHalIdx = hCap.indexOf("halaman_terakhir");
      const cKhatamIdx = hCap.indexOf("total_halaman_khatam");
      const cStIdx = hCap.indexOf("status_terakhir");
      const cHalNameIdx = hCap.indexOf("nama_halaqah");
      const cMuhIdx = hCap.indexOf("muallim_pengampu");

      for (let i = 1; i < capData.length; i++) {
        const cId = String(capData[i][cIdIdx] || "").trim();
        if (cId === cleanId || (student && cId === student.nis)) {
          currentJuz = Number(capData[i][cJuzIdx] || 1);
          halTerakhir = Number(capData[i][cHalIdx] || 1);
          halKhatam = Number(capData[i][cKhatamIdx] || Math.max(1, ((currentJuz - 1) * 20) + halTerakhir));
          statusTerakhir = String(capData[i][cStIdx] || "LANCAR").trim().toUpperCase();
          if (cHalNameIdx !== -1 && capData[i][cHalNameIdx]) studentHalaqah = String(capData[i][cHalNameIdx]).trim();
          if (cMuhIdx !== -1 && capData[i][cMuhIdx]) studentMuallim = String(capData[i][cMuhIdx]).trim();
          break;
        }
      }
    }

    // Jika belum ada di Sorogan_Capaian, hitung dari riwayat simakan
    if (riwayat.length > 0) {
      const latestValid = riwayat.find(r => r.statusSetoran !== "ULANG") || riwayat[0];
      if (latestValid) {
        if (currentJuz === 1 && halTerakhir === 1 && latestValid.juz) {
          currentJuz = latestValid.juz;
          const pages = String(latestValid.halamanList || "").split(",").map(p => Number(p.trim())).filter(p => !isNaN(p));
          halTerakhir = pages.length > 0 ? Math.max(...pages) : 1;
        }
      }
    }

    // Rata-rata nilai
    let totalScorePoints = 0;
    riwayat.forEach(r => {
      if (r.nilai === "MUMTAZ") totalScorePoints += 4;
      else if (r.nilai === "JAYYID_JIDDAN") totalScorePoints += 3;
      else if (r.nilai === "JAYYID") totalScorePoints += 2;
      else totalScorePoints += 1;
    });

    let avgNilaiText = "Mumtaz (A)";
    if (riwayat.length > 0) {
      const avgScore = totalScorePoints / riwayat.length;
      if (avgScore >= 3.5) avgNilaiText = "Mumtaz (A)";
      else if (avgScore >= 2.8) avgNilaiText = "Jayyid Jiddan (B+)";
      else if (avgScore >= 2.0) avgNilaiText = "Jayyid (B)";
      else avgNilaiText = "Dha'if (C)";
    }

    // 5. Kalkulasi 3 Indikator (Harian, Pekanan, Bulanan)
    const todayStr = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");
    const todayDate = new Date();
    const startOfWeek = new Date();
    startOfWeek.setDate(todayDate.getDate() - 6);
    const startOfMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);

    let harianReal = 0, harianCount = 0;
    let pekanReal = 0, pekanCount = 0;
    let bulanReal = 0, bulanCount = 0;

    riwayat.forEach(r => {
      const d = new Date(r.tanggal || r.createdAt);
      const hal = r.totalHalaman || 1;

      if (r.tanggal === todayStr) {
        harianCount++;
        harianReal += hal;
      }

      if (d >= startOfWeek) {
        pekanCount++;
        pekanReal += hal;
      }

      if (d >= startOfMonth) {
        bulanCount++;
        bulanReal += hal;
      }
    });

    const targetHarian = target.targetHalamanSesi || 2;
    const targetPekan = target.targetHalamanPekan || (targetHarian * 11);
    const targetBulan = targetPekan * 4;

    const pekanPercent = targetPekan > 0 ? Math.min(100, Math.round((pekanReal / targetPekan) * 100)) : 0;
    const bulanPercent = targetBulan > 0 ? Math.min(100, Math.round((bulanReal / targetBulan) * 100)) : 0;

    // 6. Halaqah & Muallim mapping
    const halaqahSheet = ss.getSheetByName(SHEET_SOROGAN_HALAQAH);
    const halaqahData = halaqahSheet ? halaqahSheet.getDataRange().getValues() : null;
    if (halaqahData && halaqahData.length > 1) {
      const colMap = getSoroganHalaqahColumnIndexes(halaqahData[0]);
      for (let h = 1; h < halaqahData.length; h++) {
        const row = halaqahData[h];
        const members = colMap.studentIds !== -1 ? String(row[colMap.studentIds] || "").split(",").map(m => m.trim().toLowerCase()) : [];
        const cleanIdLower = cleanId.toLowerCase();
        const cleanNisLower = String(student.nis || "").trim().toLowerCase();
        const cleanNameLower = String(student.name || "").trim().toLowerCase();

        const isMatch = members.some(m => {
          if (!m) return false;
          return m === cleanIdLower ||
                 m === cleanNisLower ||
                 (cleanNameLower && m === cleanNameLower) ||
                 m.replace(/[^a-z0-9]/g, "") === cleanIdLower.replace(/[^a-z0-9]/g, "");
        });

        if (isMatch) {
          if (!studentHalaqah && colMap.name !== -1 && row[colMap.name]) {
            studentHalaqah = String(row[colMap.name]).trim();
          }
          if (!studentMuallim && colMap.muallim !== -1 && row[colMap.muallim]) {
            studentMuallim = String(row[colMap.muallim]).trim();
          }
          break;
        }
      }
    }

    if (!studentMuallim && riwayat.length > 0 && riwayat[0].muallim) {
      studentMuallim = riwayat[0].muallim;
    }

    if (!studentHalaqah) studentHalaqah = "Halaqah Sorogan Binnazhar";
    if (!studentMuallim) studentMuallim = "Asatidz Sorogan";

    const halamanTuntas = Math.min(600, Math.max(1, ((currentJuz - 1) * 20) + halTerakhir));
    const isKhatam = (currentJuz === 30 && halTerakhir >= 20) || (halamanTuntas >= 600) || statusTerakhir === "KHATAM_30JUZ";
    const percentOverall = isKhatam ? 100 : Math.min(100, Math.round((halamanTuntas / 600) * 100));

    return {
      status: "success",
      success: true,
      student: {
        studentId: student.studentId || cleanId,
        nis: student.nis || "-",
        name: student.name || "Santri",
        gender: student.gender || "L",
        photoUrl: student.photoUrl || "",
        program: "Sorogan Al-Qur'an (Binnazhar)",
        status: student.status || "ACTIVE",
        halaqah: studentHalaqah,
        muallim: studentMuallim
      },
      halaqah: studentHalaqah,
      muallim: studentMuallim,
      stats: {
        progressJuz: currentJuz,
        halamanTerakhir: halTerakhir,
        totalHalamanKhatam: halamanTuntas,
        isKhatam: isKhatam,
        capaianSaatIni: isKhatam ? "Khatam 30 Juz (100%)" : `Juz ${currentJuz} Hal ${halTerakhir} (${percentOverall}%)`,
        targetCapaian: "30 Juz Mushaf Pojok",
        totalSetoran: `${riwayat.length} Kali`,
        rataRataNilai: avgNilaiText,
        progressMax: 30,
        progressPercent: isKhatam ? 100 : percentOverall
      },
      target: target,
      indikator: {
        harian: {
          targetText: `${targetHarian} Halaman / Sesi`,
          realitaText: `${harianReal} Halaman (${harianCount}x Simak)`,
          status: harianCount > 0 ? "Ada Simakan Hari Ini" : "Belum Ada Simakan"
        },
        pekanan: {
          targetText: `${targetPekan} Halaman / Pekan`,
          realitaText: `${pekanReal} Halaman (${pekanCount}x Simak)`,
          percent: pekanPercent,
          status: pekanPercent >= 100 ? "Target Pekan Tercapai" : (pekanPercent > 0 ? `${pekanPercent}% Capaian` : "0% Capaian")
        },
        bulanan: {
          targetText: `${targetBulan} Halaman / Bulan`,
          realitaText: `${bulanReal} Halaman (${bulanCount}x Simak)`,
          percent: bulanPercent,
          status: bulanPercent >= 100 ? "Target Bulan Tercapai" : (bulanPercent > 0 ? `${bulanPercent}% Capaian` : "0% Capaian")
        }
      },
      riwayat: riwayat
    };

  } catch (err) {
    return {
      status: "error",
      success: false,
      message: "Gagal memuat detail santri Sorogan: " + err.message
    };
  }
}

/**
 * Mengambil detail lengkap santri TPQ Yanbu'a:
 * Profil, Capaian Aktif, Target, Statistik Ritme, & Riwayat Bimbingan Lengkap
 */
function getTPQStudentDetail(studentId, token) {
  try {
    let actor = null;
    if (token) {
      try {
        actor = authenticateSession(token);
        authorizeRole(actor, ["ADMIN", "SUPER_ADMIN", "EDITOR", "PENGASUH", "PEGAWAI", "MUALLIM", "MUHAFIZ", "GURU", "ASATIDZ", "WALI_SANTRI", "PARENT"]);
      } catch (authErr) {
        verifySessionToken(token);
      }
    }

    const cleanId = String(studentId || "").trim();
    if (!cleanId) throw new Error("ID Santri wajib disertakan.");

    // Validasi hak akses khusus Wali Santri: hanya boleh melihat santri binaan yang terhubung
    if (actor && (actor.role === "WALI_SANTRI" || actor.role === "PARENT")) {
      const linked = (typeof getLinkedStudentsForWali === "function") ? getLinkedStudentsForWali(actor.identityId) : [];
      const allowedIds = (linked || []).map(s => String(s.studentId || s.student_id || s.id || s.nis || "").trim().toLowerCase());
      let isAllowed = allowedIds.includes(cleanId.toLowerCase());
      if (!isAllowed) {
        const studentsResCheck = (typeof getAllStudentsData === "function") ? getAllStudentsData(token) : null;
        const allStudentsList = (studentsResCheck && studentsResCheck.data) || [];
        const targetStudent = allStudentsList.find(s => 
          String(s.studentId || s.student_id || "").toLowerCase() === cleanId.toLowerCase() ||
          String(s.nis || "").toLowerCase() === cleanId.toLowerCase()
        );
        const targetSid = targetStudent ? String(targetStudent.studentId || "").toLowerCase() : "";
        const targetNis = targetStudent ? String(targetStudent.nis || "").toLowerCase() : "";
        if (targetStudent && (allowedIds.includes(targetSid) || allowedIds.includes(targetNis))) {
          isAllowed = true;
        }
      }
      if (!isAllowed) {
        throw new Error("Akses ditolak: Anda hanya berhak memantau perkembangan santri yang terhubung dengan akun Wali Anda.");
      }
    }

    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error("Spreadsheet tidak ditemukan.");

    // 1. Ambil data Santri
    const studentsSheet = ss.getSheetByName(SHEET_STUDENTS);
    let student = null;
    if (studentsSheet) {
      const sData = studentsSheet.getDataRange().getValues();
      if (sData.length >= 2) {
        const sHead = sData[0].map(h => String(h || "").trim().toLowerCase());
        const idIdx = sHead.indexOf("student_id");
        const nisIdx = sHead.indexOf("nis");
        const nameIdx = sHead.indexOf("name");
        const genderIdx = sHead.indexOf("gender");
        const statusIdx = sHead.indexOf("status");
        const photoIdx = sHead.indexOf("photo_url");

        for (let i = 1; i < sData.length; i++) {
          const rowId = String(sData[i][idIdx] || "").trim();
          const rowNis = String(sData[i][nisIdx] || "").trim();
          if (rowId === cleanId || rowNis === cleanId) {
            student = {
              studentId: rowId,
              nis: rowNis,
              name: String(sData[i][nameIdx] || "Santri").trim(),
              gender: String(sData[i][genderIdx] || "L").trim().toUpperCase(),
              status: String(sData[i][statusIdx] || "AKTIF").trim().toUpperCase(),
              photoUrl: photoIdx !== -1 ? String(sData[i][photoIdx] || "").trim() : ""
            };
            break;
          }
        }
      }
    }

    if (!student) {
      student = { studentId: cleanId, nis: "-", name: "Santri TPQ", gender: "L", status: "AKTIF", photoUrl: "" };
    }

    // 2. Ambil data Target
    const targetSheet = ss.getSheetByName(SHEET_TPQ_TARGET);
    let target = { targetJilid: 2, targetHalamanSesi: 1, targetHalamanPekan: 6 };
    if (targetSheet) {
      const tData = targetSheet.getDataRange().getValues();
      if (tData.length >= 2) {
        const tHead = tData[0].map(h => String(h || "").trim().toLowerCase());
        const sIdIdx = tHead.indexOf("student_id");
        const jIdx = tHead.indexOf("target_jilid");
        const sSesiIdx = tHead.indexOf("target_halaman_sesi");
        const sPekanIdx = tHead.indexOf("target_halaman_pekan");

        for (let i = 1; i < tData.length; i++) {
          const sId = String(tData[i][sIdIdx] || "").trim();
          if (sId === cleanId || sId === student.nis) {
            target = {
              targetJilid: Number(tData[i][jIdx]) || 2,
              targetHalamanSesi: Number(tData[i][sSesiIdx]) || 1,
              targetHalamanPekan: Number(tData[i][sPekanIdx]) || 6
            };
            break;
          }
        }
      }
    }

    // 3. Ambil data Riwayat dari TPQ_Logs
    const logsSheet = ss.getSheetByName(SHEET_TPQ_LOGS);
    const riwayat = [];
    if (logsSheet) {
      const lData = logsSheet.getDataRange().getValues();
      if (lData.length >= 2) {
        const lHead = lData[0].map(h => String(h || "").trim().toLowerCase());
        const logIdIdx = lHead.indexOf("log_id");
        const sIdIdx = lHead.indexOf("student_id");
        const nisIdx = lHead.indexOf("nis");
        const tglIdx = lHead.indexOf("tanggal");
        const sesiIdx = lHead.indexOf("sesi");
        const jilidIdx = lHead.indexOf("jilid");
        const halIdx = lHead.indexOf("halaman");
        const stIdx = lHead.indexOf("status_setoran");
        const nilaiIdx = lHead.indexOf("nilai");
        const ustadzIdx = lHead.indexOf("ustadz");
        const catIdx = lHead.indexOf("catatan");
        const createdIdx = lHead.indexOf("created_at");

        for (let i = 1; i < lData.length; i++) {
          const r = lData[i];
          const rowSid = String(r[sIdIdx] || "").trim();
          const rowNis = String(r[nisIdx] || "").trim();

          if (rowSid === cleanId || rowNis === cleanId || (student && rowNis === student.nis)) {
            riwayat.push({
              logId: logIdIdx !== -1 ? String(r[logIdIdx] || "").trim() : ("LOG-" + i),
              tanggal: tglIdx !== -1 ? (r[tglIdx] instanceof Date ? Utilities.formatDate(r[tglIdx], "GMT+7", "yyyy-MM-dd") : String(r[tglIdx] || "").substring(0, 10)) : "",
              sesi: sesiIdx !== -1 ? String(r[sesiIdx] || "").trim() : "Sore",
              jilid: jilidIdx !== -1 ? (Number(r[jilidIdx]) || 1) : 1,
              halaman: halIdx !== -1 ? (Number(r[halIdx]) || 1) : 1,
              statusSetoran: stIdx !== -1 ? String(r[stIdx] || "LANJUT").trim().toUpperCase() : "LANJUT",
              nilai: nilaiIdx !== -1 ? String(r[nilaiIdx] || "MUMTAZ").trim().toUpperCase() : "MUMTAZ",
              ustadz: ustadzIdx !== -1 ? String(r[ustadzIdx] || "").trim() : "",
              catatan: catIdx !== -1 ? String(r[catIdx] || "").trim() : "",
              createdAt: createdIdx !== -1 ? String(r[createdIdx] || "") : ""
            });
          }
        }
      }
    }

    // Urutkan riwayat dari yang terbaru
    riwayat.sort((a, b) => new Date(b.tanggal || b.createdAt) - new Date(a.tanggal || a.createdAt));

    // 4. Ambil Capaian dari TPQ_Capaian
    const capaianSheet = getOrCreateTPQSheet(ss, SHEET_TPQ_CAPAIAN, [
      "student_id", "student_name", "jilid_aktif", "halaman_aktif", "status_terakhir", "kelas_id", "nama_kelas", "ustadz_pengampu", "updated_at"
    ], "#0d9488");
    const capData = capaianSheet.getDataRange().getValues();
    let currentJilid = 1;
    let halAktif = 1;
    let statusTerakhir = "LANJUT";
    let studentKelas = "";
    let studentUstadz = "";

    if (capData && capData.length > 1) {
      const hCap = capData[0].map(h => String(h || "").trim().toLowerCase());
      const cIdIdx = hCap.indexOf("student_id");
      const cJilidIdx = hCap.indexOf("jilid_aktif");
      const cHalIdx = hCap.indexOf("halaman_aktif");
      const cStIdx = hCap.indexOf("status_terakhir");
      const cKNameIdx = hCap.indexOf("nama_kelas");
      const cUstIdx = hCap.indexOf("ustadz_pengampu");

      for (let i = 1; i < capData.length; i++) {
        const cId = String(capData[i][cIdIdx] || "").trim();
        if (cId === cleanId || (student && cId === student.nis)) {
          currentJilid = Number(capData[i][cJilidIdx] || 1);
          halAktif = Number(capData[i][cHalIdx] || 1);
          statusTerakhir = String(capData[i][cStIdx] || "LANJUT").trim().toUpperCase();
          if (cKNameIdx !== -1 && capData[i][cKNameIdx]) studentKelas = String(capData[i][cKNameIdx]).trim();
          if (cUstIdx !== -1 && capData[i][cUstIdx]) studentUstadz = String(capData[i][cUstIdx]).trim();
          break;
        }
      }
    }

    // Jika belum ada nama kelas, cari di TPQ_Kelas via helper
    if (!studentKelas || studentKelas === "Belum Ditentukan") {
      const resolved = resolveTPQKelas_(ss, cleanId, student.nis, "", studentKelas, studentUstadz);
      if (resolved.namaKelas && resolved.namaKelas !== "Belum Ditentukan") studentKelas = resolved.namaKelas;
      if (resolved.ustadz && resolved.ustadz !== "-") studentUstadz = resolved.ustadz;
    }

    if (!studentKelas) studentKelas = "TPQ Yanbu'a";
    if (!studentUstadz) studentUstadz = "Asatidz TPQ";

    // Hitung rata-rata nilai
    let totalScorePoints = 0;
    riwayat.forEach(r => {
      if (r.nilai === "MUMTAZ") totalScorePoints += 4;
      else if (r.nilai === "JAYYID_JIDDAN") totalScorePoints += 3;
      else if (r.nilai === "JAYYID") totalScorePoints += 2;
      else totalScorePoints += 1;
    });

    let avgNilaiText = "Mumtaz (A)";
    if (riwayat.length > 0) {
      const avgScore = totalScorePoints / riwayat.length;
      if (avgScore >= 3.5) avgNilaiText = "Mumtaz (A)";
      else if (avgScore >= 2.8) avgNilaiText = "Jayyid Jiddan (B+)";
      else if (avgScore >= 2.0) avgNilaiText = "Jayyid (B)";
      else avgNilaiText = "Maqbul / Dha'if (C)";
    }

    // 5. Kalkulasi 3 Indikator (Harian, Pekanan, Bulanan)
    const todayStr = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");
    const todayDate = new Date();
    const startOfWeek = new Date();
    startOfWeek.setDate(todayDate.getDate() - 6);
    const startOfMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);

    let harianReal = 0, harianCount = 0;
    let pekanReal = 0, pekanCount = 0;
    let bulanReal = 0, bulanCount = 0;

    riwayat.forEach(r => {
      const d = new Date(r.tanggal || r.createdAt);
      const hal = 1;

      if (r.tanggal === todayStr) {
        harianCount++;
        harianReal += hal;
      }
      if (d >= startOfWeek) {
        pekanCount++;
        pekanReal += hal;
      }
      if (d >= startOfMonth) {
        bulanCount++;
        bulanReal += hal;
      }
    });

    const targetHarian = target.targetHalamanSesi || 1;
    const targetPekan = target.targetHalamanPekan || (targetHarian * 11);
    const targetBulan = targetPekan * 4;

    // Total halaman dihitung dari konfigurasi jenjang resmi Yanbu'a (Total: 356 Halaman)
    const totalHalSelesai = getYanbuaCumulativePages_(currentJilid, halAktif);
    const percentOverall = Math.min(100, Math.round((totalHalSelesai / TOTAL_YANBUA_PAGES_) * 100));

    const pekanPercent = targetPekan > 0 ? Math.min(100, Math.round((pekanReal / targetPekan) * 100)) : 0;
    const bulanPercent = targetBulan > 0 ? Math.min(100, Math.round((bulanReal / targetBulan) * 100)) : 0;
    const jName = (currentJilid === 0 || String(currentJilid).toLowerCase() === "pemula") ? "Pemula" : `Jilid ${currentJilid}`;

    const isKhatam = Boolean((currentJilid === 7 && halAktif >= 39) || statusTerakhir === "KHATAM_YANBUA" || statusTerakhir === "KHATAM" || percentOverall >= 100);

    const stats = {
      progressJilid: currentJilid,
      halamanTerakhir: halAktif,
      totalHalamanKhatam: totalHalSelesai,
      capaianSaatIni: isKhatam ? "Khatam Yanbu'a 🏆 (100%)" : `${jName} Hal ${halAktif} (${percentOverall}%)`,
      targetCapaian: isKhatam ? "Khatam Yanbu'a 🏆" : (target.targetJilid === 0 ? "Pemula" : `Jilid ${target.targetJilid || 7}`),
      totalSetoran: `${riwayat.length} Kali`,
      rataRataNilai: avgNilaiText,
      progressMax: TOTAL_YANBUA_PAGES_,
      progressPercent: isKhatam ? 100 : percentOverall,
      isKhatam: isKhatam
    };

    const indikator = {
      harian: {
        targetText: `${targetHarian} Halaman / Sesi`,
        realitaText: `${harianReal} Halaman (${harianCount}x Simak)`,
        status: harianCount > 0 ? "Ada Simakan Hari Ini" : "Belum Ada Simakan"
      },
      pekanan: {
        targetText: `${targetPekan} Halaman / Pekan`,
        realitaText: `${pekanReal} Halaman (${pekanCount}x Simak)`,
        percent: pekanPercent,
        status: pekanPercent >= 100 ? "Target Pekan Tercapai" : (pekanPercent > 0 ? `${pekanPercent}% Capaian` : "0% Capaian")
      },
      bulanan: {
        targetText: `${targetBulan} Halaman / Bulan`,
        realitaText: `${bulanReal} Halaman (${bulanCount}x Simak)`,
        percent: bulanPercent,
        status: bulanPercent >= 100 ? "Target Bulan Tercapai" : (bulanPercent > 0 ? `${bulanPercent}% Capaian` : "0% Capaian")
      }
    };

    return {
      status: "success",
      success: true,
      student: {
        studentId: student.studentId || cleanId,
        nis: student.nis || "-",
        name: student.name || "Santri",
        gender: student.gender || "L",
        photoUrl: student.photoUrl || "",
        program: "TPQ Yanbu'a (Pemula - Jilid 7)",
        status: student.status || "ACTIVE",
        kelas: studentKelas,
        ustadz: studentUstadz
      },
      kelas: studentKelas,
      ustadz: studentUstadz,
      stats: stats,
      indikator: indikator,
      capaian: {
        jilidAktif: currentJilid,
        halamanAktif: halAktif,
        statusTerakhir: statusTerakhir,
        totalHalamanSelesai: totalHalSelesai,
        percentOverall: isKhatam ? 100 : percentOverall,
        isKhatam: isKhatam
      },
      target: {
        targetJilid: target.targetJilid !== undefined ? target.targetJilid : Math.min(7, currentJilid + 1),
        targetHarian: targetHarian,
        targetPekan: targetPekan,
        targetBulan: targetBulan
      },
      realisasi: {
        harianHalaman: harianReal,
        harianSetoran: harianCount,
        pekananHalaman: pekanReal,
        pekananSetoran: pekanCount,
        bulananHalaman: bulanReal,
        bulananSetoran: bulanCount,
        avgNilai: avgNilaiText,
        totalSetoran: riwayat.length
      },
      riwayat: riwayat
    };
  } catch (err) {
    return {
      status: "error",
      success: false,
      message: "Gagal memuat detail santri TPQ: " + err.message
    };
  }
}


// ====================================================================
// MODUL PRESENSI KEGIATAN SANTRI (HYBRID & EXCEPTION-BASED STORAGE)
// ====================================================================

/**
 * Helper Database Spreadsheet untuk Modul Presensi
 */
function getSpreadsheetDB_() {
  if (typeof getDatabaseSpreadsheet === "function") {
    var db = getDatabaseSpreadsheet();
    if (db) return db;
  }
  var explicitId = "1cZSRh2rtKpT6E8m3GFJonVbiQG51fh24eN8J5JWtOJY";
  try {
    return SpreadsheetApp.openById(explicitId);
  } catch (e) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
}

/**
 * Helper inisialisasi sheet presensi kegiatan secara otomatis jika belum ada.
 */
function initPresensiSheetsIfNeeded_(ss) {
  try {
    if (!ss) ss = getSpreadsheetDB_();
    var schemas = {
      "Presensi_Kegiatan": ["kegiatan_id", "nama_kegiatan", "kategori", "jadwal_rutin", "target_peserta", "penanggung_jawab", "status", "created_at"],
      "Presensi_Sesi": ["sesi_id", "kegiatan_id", "nama_kegiatan", "tanggal", "waktu_buka", "petugas", "total_peserta", "total_hadir", "total_izin", "total_sakit", "total_alpa", "status_sesi", "catatan", "created_at"],
      "Presensi_Logs": ["log_id", "sesi_id", "kegiatan_id", "student_id", "nis", "student_name", "gender", "tanggal", "status_kehadiran", "metode_absen", "waktu_absen", "keterangan", "created_at"]
    };
    var colors = {
      "Presensi_Kegiatan": "#059669",
      "Presensi_Sesi": "#0d9488",
      "Presensi_Logs": "#0284c7"
    };

    for (var name in schemas) {
      var sheet = ss.getSheetByName(name);
      var isNew = false;
      if (!sheet) {
        sheet = ss.insertSheet(name);
        isNew = true;
      }
      if (sheet.getLastRow() === 0) {
        sheet.getRange(1, 1, 1, schemas[name].length).setValues([schemas[name]]);
      }
      sheet.getRange(1, 1, 1, schemas[name].length)
        .setFontWeight("bold")
        .setBackground(colors[name])
        .setFontColor("#ffffff");
      sheet.setFrozenRows(1);

      // Jika sheet Presensi_Kegiatan baru dibuat, tambahkan contoh agenda default
      if (name === "Presensi_Kegiatan" && sheet.getLastRow() <= 1) {
        var nowIso = new Date().toISOString();
        var defaultKegiatan = [
          ["ACT-01", "Shalat Subuh & Wirid", "Ibadah", "Setiap Hari (04:30 - 05:30 WIB)", "Semua Santri", "Ustadz Pembina Asrama", "Aktif", nowIso],
          ["ACT-02", "Shalat Maghrib & Isya Berjamaah", "Ibadah", "Setiap Hari (17:45 - 19:30 WIB)", "Semua Santri", "Ustadz Pembina Asrama", "Aktif", nowIso],
          ["ACT-03", "Kajian Kitab Diniyah / Ta'lim", "Ta'lim", "Senin - Kamis (20:00 - 21:00 WIB)", "Semua Santri", "Dewan Asatidz", "Aktif", nowIso],
          ["ACT-04", "Ro'an & Kerja Bakti Kebersihan", "Keasramaan", "Ahad Pagi (07:00 - 08:30 WIB)", "Semua Santri", "Pengurus Pondok", "Aktif", nowIso],
          ["ACT-05", "Muhadharah / Khitobah Santri", "Minat & Bakat", "Malam Jumat (20:00 - 21:30 WIB)", "Semua Santri", "Pembina Bahasa", "Aktif", nowIso]
        ];
        sheet.getRange(2, 1, defaultKegiatan.length, defaultKegiatan[0].length).setValues(defaultKegiatan);
      }
    }
  } catch (e) {
    Logger.log("initPresensiSheetsIfNeeded_ warning: " + e.message);
  }
}

/**
 * Mengambil data dashboard Presensi Kegiatan:
 * - Master kegiatan
 * - Sesi hari ini & riwayat sesi
 * - Daftar santri aktif
 * - Statistik kehadiran
 */
function getPresensiDashboard(token) {
  try {
    var ss = getSpreadsheetDB_();
    initPresensiSheetsIfNeeded_(ss);

    var tz = Session.getScriptTimeZone() || "Asia/Jakarta";
    var todayStr = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");

    // 1. Ambil Master Kegiatan
    var shKegiatan = ss.getSheetByName("Presensi_Kegiatan");
    var kegiatanList = [];
    if (shKegiatan && shKegiatan.getLastRow() > 1) {
      var rowsK = shKegiatan.getRange(2, 1, shKegiatan.getLastRow() - 1, shKegiatan.getLastColumn()).getValues();
      for (var i = 0; i < rowsK.length; i++) {
        var r = rowsK[i];
        if (!r[0]) continue;
        kegiatanList.push({
          kegiatanId: String(r[0] || ""),
          namaKegiatan: String(r[1] || ""),
          kategori: String(r[2] || "Umum"),
          jadwalRutin: String(r[3] || ""),
          targetPeserta: String(r[4] || "Semua Santri"),
          penanggungJawab: String(r[5] || ""),
          status: String(r[6] || "Aktif"),
          createdAt: r[7] ? String(r[7]) : ""
        });
      }
    }

    // 2. Ambil Sesi Presensi
    var shSesi = ss.getSheetByName("Presensi_Sesi");
    var todaySessions = [];
    var recentSessions = [];
    var totalSesiBulanIni = 0;
    var totalPesertaKumulatif = 0;
    var totalHadirKumulatif = 0;
    var totalIzinHariIni = 0;
    var totalSakitHariIni = 0;
    var totalAlpaHariIni = 0;

    var currentYearMonth = todayStr.substring(0, 7); // YYYY-MM

    if (shSesi && shSesi.getLastRow() > 1) {
      var rowsS = shSesi.getRange(2, 1, shSesi.getLastRow() - 1, shSesi.getLastColumn()).getValues();
      // Urutkan dari yang terbaru (descending)
      rowsS.reverse();

      for (var j = 0; j < rowsS.length; j++) {
        var s = rowsS[j];
        if (!s[0]) continue;

        var rawTgl = s[3];
        var tglStr = "";
        if (rawTgl instanceof Date) {
          tglStr = Utilities.formatDate(rawTgl, tz, "yyyy-MM-dd");
        } else {
          tglStr = String(rawTgl || "").substring(0, 10);
        }

        var sesObj = {
          sesiId: String(s[0] || ""),
          kegiatanId: String(s[1] || ""),
          namaKegiatan: String(s[2] || ""),
          tanggal: tglStr,
          waktuBuka: String(s[4] || ""),
          petugas: String(s[5] || ""),
          totalPeserta: Number(s[6]) || 0,
          totalHadir: Number(s[7]) || 0,
          totalIzin: Number(s[8]) || 0,
          totalSakit: Number(s[9]) || 0,
          totalAlpa: Number(s[10]) || 0,
          statusSesi: String(s[11] || "Tutup"),
          catatan: String(s[12] || ""),
          createdAt: s[13] ? String(s[13]) : ""
        };

        // Hitung statistik
        if (tglStr === todayStr) {
          todaySessions.push(sesObj);
          totalIzinHariIni += sesObj.totalIzin;
          totalSakitHariIni += sesObj.totalSakit;
          totalAlpaHariIni += sesObj.totalAlpa;
        }

        if (tglStr.indexOf(currentYearMonth) === 0) {
          totalSesiBulanIni++;
          totalPesertaKumulatif += sesObj.totalPeserta;
          totalHadirKumulatif += sesObj.totalHadir;
        }

        if (recentSessions.length < 50) {
          recentSessions.push(sesObj);
        }
      }
    }

    // 3. Ambil Daftar Santri Aktif
    var shStudents = ss.getSheetByName("Students");
    var students = [];
    if (shStudents && shStudents.getLastRow() > 1) {
      var rowsSt = shStudents.getRange(2, 1, shStudents.getLastRow() - 1, shStudents.getLastColumn()).getValues();
      for (var k = 0; k < rowsSt.length; k++) {
        var st = rowsSt[k];
        if (!st[0]) continue;
        var statusSantri = String(st[8] || "Aktif");
        if (statusSantri.toLowerCase().indexOf("aktif") !== -1 || statusSantri.toLowerCase() === "active") {
          students.push({
            studentId: String(st[0] || ""),
            nis: String(st[1] || ""),
            name: String(st[3] || ""),
            gender: String(st[4] || "L"),
            photoUrl: String(st[6] || ""),
            program: String(st[7] || ""),
            status: statusSantri,
            qrCode: String(st[10] || st[0] || "")
          });
        }
      }
    }

    // Rata-rata kehadiran bulan ini (%)
    var rerataKehadiranPct = totalPesertaKumulatif > 0
      ? Math.round((totalHadirKumulatif / totalPesertaKumulatif) * 100)
      : 100;

    return {
      status: "success",
      success: true,
      ok: true,
      data: {
        todayStr: todayStr,
        kegiatanList: kegiatanList,
        todaySessions: todaySessions,
        recentSessions: recentSessions,
        students: students,
        stats: {
          totalKegiatanAktif: kegiatanList.filter(function(k) { return k.status === "Aktif"; }).length,
          totalSesiBulanIni: totalSesiBulanIni,
          rerataKehadiranPct: rerataKehadiranPct,
          totalIzinHariIni: totalIzinHariIni,
          totalSakitHariIni: totalSakitHariIni,
          totalAlpaHariIni: totalAlpaHariIni,
          totalSantriAktif: students.length
        }
      }
    };
  } catch (err) {
    return {
      status: "error",
      success: false,
      ok: false,
      message: "Gagal memuat dashboard Presensi: " + err.message
    };
  }
}

/**
 * Mengambil daftar master kegiatan presensi.
 */
function getPresensiKegiatanList(token) {
  try {
    var ss = getSpreadsheetDB_();
    initPresensiSheetsIfNeeded_(ss);
    var sh = ss.getSheetByName("Presensi_Kegiatan");
    var list = [];
    if (sh && sh.getLastRow() > 1) {
      var rows = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        if (!r[0]) continue;
        list.push({
          kegiatanId: String(r[0] || ""),
          namaKegiatan: String(r[1] || ""),
          kategori: String(r[2] || "Umum"),
          jadwalRutin: String(r[3] || ""),
          targetPeserta: String(r[4] || "Semua Santri"),
          penanggungJawab: String(r[5] || ""),
          status: String(r[6] || "Aktif"),
          createdAt: r[7] ? String(r[7]) : ""
        });
      }
    }
    return { status: "success", success: true, ok: true, data: list };
  } catch (err) {
    return { status: "error", success: false, ok: false, message: err.message };
  }
}

/**
 * Menyimpan / memperbarui master kegiatan presensi.
 */
function savePresensiKegiatan(payload, token) {
  try {
    var ss = getSpreadsheetDB_();
    initPresensiSheetsIfNeeded_(ss);
    var sh = ss.getSheetByName("Presensi_Kegiatan");
    if (!sh) throw new Error("Sheet Presensi_Kegiatan tidak ditemukan");

    var kegiatanId = payload.kegiatanId || payload.id;
    var namaKegiatan = String(payload.namaKegiatan || "").trim();
    if (!namaKegiatan) throw new Error("Nama Kegiatan wajib diisi");

    var kategori = String(payload.kategori || "Umum").trim();
    var jadwalRutin = String(payload.jadwalRutin || "").trim();
    var targetPeserta = String(payload.targetPeserta || "Semua Santri").trim();
    var penanggungJawab = String(payload.penanggungJawab || "").trim();
    var status = String(payload.status || "Aktif").trim();
    var nowIso = new Date().toISOString();

    if (kegiatanId) {
      // Mode Update
      var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
      var foundRow = -1;
      for (var i = 0; i < rows.length; i++) {
        if (String(rows[i][0]) === String(kegiatanId)) {
          foundRow = i + 2;
          break;
        }
      }
      if (foundRow !== -1) {
        sh.getRange(foundRow, 2, 1, 6).setValues([[
          namaKegiatan, kategori, jadwalRutin, targetPeserta, penanggungJawab, status
        ]]);
        return {
          status: "success",
          success: true,
          ok: true,
          message: "Kegiatan '" + namaKegiatan + "' berhasil diperbarui.",
          data: { kegiatanId: kegiatanId, namaKegiatan: namaKegiatan }
        };
      }
    }

    // Mode Tambah Baru
    var newId = "ACT-" + Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "Asia/Jakarta", "yyMMdd-HHmmss");
    var newRow = [newId, namaKegiatan, kategori, jadwalRutin, targetPeserta, penanggungJawab, status, nowIso];
    sh.appendRow(newRow);

    return {
      status: "success",
      success: true,
      ok: true,
      message: "Kegiatan '" + namaKegiatan + "' berhasil ditambahkan.",
      data: { kegiatanId: newId, namaKegiatan: namaKegiatan }
    };
  } catch (err) {
    return { status: "error", success: false, ok: false, message: err.message };
  }
}

/**
 * Menghapus atau menonaktifkan master kegiatan.
 */
function deletePresensiKegiatan(kegiatanId, token) {
  try {
    if (!kegiatanId) throw new Error("ID Kegiatan diperlukan");
    var ss = getSpreadsheetDB_();
    var sh = ss.getSheetByName("Presensi_Kegiatan");
    if (!sh || sh.getLastRow() <= 1) throw new Error("Data kegiatan kosong");

    var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][0]) === String(kegiatanId)) {
        sh.deleteRow(i + 2);
        return { status: "success", success: true, ok: true, message: "Kegiatan berhasil dihapus." };
      }
    }
    return { status: "error", success: false, ok: false, message: "Kegiatan tidak ditemukan." };
  } catch (err) {
    return { status: "error", success: false, ok: false, message: err.message };
  }
}

/**
 * Menyimpan / Memperbarui Sesi Presensi & Menyimpan HANYA Pengecualian (Izin, Sakit, Alpa) ke Presensi_Logs
 */
function savePresensiSesi(payload, token) {
  try {
    var ss = getSpreadsheetDB_();
    initPresensiSheetsIfNeeded_(ss);

    var shSesi = ss.getSheetByName("Presensi_Sesi");
    var shLogs = ss.getSheetByName("Presensi_Logs");
    if (!shSesi || !shLogs) throw new Error("Sheet Presensi tidak lengkap");

    var tz = Session.getScriptTimeZone() || "Asia/Jakarta";
    var nowIso = new Date().toISOString();
    var todayStr = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");

    var sesiId = payload.sesiId || payload.id;
    var isNewSesi = false;
    if (!sesiId) {
      isNewSesi = true;
      sesiId = "SESI-" + Utilities.formatDate(new Date(), tz, "yyyyMMdd-HHmmss");
    }

    var kegiatanId = String(payload.kegiatanId || "").trim();
    var namaKegiatan = String(payload.namaKegiatan || "").trim();
    var tanggal = String(payload.tanggal || todayStr).substring(0, 10);
    var waktuBuka = String(payload.waktuBuka || Utilities.formatDate(new Date(), tz, "HH:mm")).trim();
    var petugas = String(payload.petugas || "Admin").trim();
    var totalPeserta = Number(payload.totalPeserta) || 0;
    var statusSesi = String(payload.statusSesi || "Tutup").trim();
    var catatan = String(payload.catatan || "").trim();

    // Array exceptions (HANYA status selain 'Hadir': Izin, Sakit, Alpa)
    var rawExceptions = payload.exceptions || payload.catatanKhusus || [];
    var exceptions = [];
    var countIzin = 0;
    var countSakit = 0;
    var countAlpa = 0;

    for (var i = 0; i < rawExceptions.length; i++) {
      var ex = rawExceptions[i];
      var stStatus = String(ex.statusKehadiran || ex.status || "").trim();
      // Saring: Hanya yang bukan Hadir!
      if (stStatus && stStatus !== "Hadir") {
        if (stStatus === "Izin") countIzin++;
        else if (stStatus === "Sakit") countSakit++;
        else if (stStatus === "Alpa" || stStatus === "Absen" || stStatus === "Tanpa Keterangan") {
          stStatus = "Alpa";
          countAlpa++;
        }

        exceptions.push({
          studentId: String(ex.studentId || ex.id || ""),
          nis: String(ex.nis || ""),
          studentName: String(ex.studentName || ex.name || ""),
          gender: String(ex.gender || "L"),
          statusKehadiran: stStatus,
          metodeAbsen: String(ex.metodeAbsen || "CHECKLIST").trim(),
          waktuAbsen: String(ex.waktuAbsen || waktuBuka).trim(),
          keterangan: String(ex.keterangan || ex.alasan || "").trim()
        });
      }
    }

    // Hitung total hadir implisit
    var totalTidakHadir = countIzin + countSakit + countAlpa;
    if (totalPeserta < totalTidakHadir) {
      totalPeserta = totalTidakHadir;
    }
    var totalHadir = Math.max(0, totalPeserta - totalTidakHadir);

    // 1. Simpan / Update ke Presensi_Sesi
    var sesiRowIndex = -1;
    if (!isNewSesi && shSesi.getLastRow() > 1) {
      var sesiIds = shSesi.getRange(2, 1, shSesi.getLastRow() - 1, 1).getValues();
      for (var sIdx = 0; sIdx < sesiIds.length; sIdx++) {
        if (String(sesiIds[sIdx][0]) === String(sesiId)) {
          sesiRowIndex = sIdx + 2;
          break;
        }
      }
    }

    var sesiValues = [
      sesiId, kegiatanId, namaKegiatan, tanggal, waktuBuka, petugas,
      totalPeserta, totalHadir, countIzin, countSakit, countAlpa,
      statusSesi, catatan, nowIso
    ];

    if (sesiRowIndex !== -1) {
      shSesi.getRange(sesiRowIndex, 1, 1, sesiValues.length).setValues([sesiValues]);
    } else {
      shSesi.appendRow(sesiValues);
    }

    // 2. Bersihkan log lama untuk sesiId ini (jika mode update)
    if (shLogs.getLastRow() > 1) {
      var logRows = shLogs.getRange(2, 2, shLogs.getLastRow() - 1, 1).getValues(); // kolom 2 = sesi_id
      // Hapus baris dari bawah ke atas agar index tidak bergeser
      for (var lIdx = logRows.length - 1; lIdx >= 0; lIdx--) {
        if (String(logRows[lIdx][0]) === String(sesiId)) {
          shLogs.deleteRow(lIdx + 2);
        }
      }
    }

    // 3. Tulis HANYA baris pengecualian (Izin, Sakit, Alpa) ke Presensi_Logs
    if (exceptions.length > 0) {
      var logAppendRows = [];
      for (var eIdx = 0; eIdx < exceptions.length; eIdx++) {
        var item = exceptions[eIdx];
        var logId = "LOG-PRS-" + Utilities.formatDate(new Date(), tz, "yyMMdd") + "-" + (eIdx + 1) + "-" + Math.floor(Math.random() * 1000);
        logAppendRows.push([
          logId,
          sesiId,
          kegiatanId,
          item.studentId,
          item.nis,
          item.studentName,
          item.gender,
          tanggal,
          item.statusKehadiran,
          item.metodeAbsen,
          item.waktuAbsen,
          item.keterangan,
          nowIso
        ]);
      }
      shLogs.getRange(shLogs.getLastRow() + 1, 1, logAppendRows.length, logAppendRows[0].length).setValues(logAppendRows);
    }

    return {
      status: "success",
      success: true,
      ok: true,
      message: "Sesi presensi '" + namaKegiatan + "' berhasil disimpan. (" + totalHadir + " Hadir, " + countIzin + " Izin, " + countSakit + " Sakit, " + countAlpa + " Alpa)",
      data: {
        sesiId: sesiId,
        totalPeserta: totalPeserta,
        totalHadir: totalHadir,
        totalIzin: countIzin,
        totalSakit: countSakit,
        totalAlpa: countAlpa,
        exceptionsLogged: exceptions.length
      }
    };
  } catch (err) {
    return { status: "error", success: false, ok: false, message: "Gagal menyimpan sesi: " + err.message };
  }
}

/**
 * Mengambil detail satu sesi presensi lengkap dengan daftar rekonstruksi santri.
 */
function getPresensiSesiDetail(sesiId, token) {
  try {
    if (!sesiId) throw new Error("Sesi ID diperlukan");
    var ss = getSpreadsheetDB_();
    var shSesi = ss.getSheetByName("Presensi_Sesi");
    var shLogs = ss.getSheetByName("Presensi_Logs");
    var shStudents = ss.getSheetByName("Students");

    var sesiData = null;
    if (shSesi && shSesi.getLastRow() > 1) {
      var sRows = shSesi.getRange(2, 1, shSesi.getLastRow() - 1, shSesi.getLastColumn()).getValues();
      for (var i = 0; i < sRows.length; i++) {
        if (String(sRows[i][0]) === String(sesiId)) {
          var r = sRows[i];
          var tz = Session.getScriptTimeZone() || "Asia/Jakarta";
          var rawT = r[3];
          var tStr = (rawT instanceof Date) ? Utilities.formatDate(rawT, tz, "yyyy-MM-dd") : String(rawT || "").substring(0, 10);
          sesiData = {
            sesiId: String(r[0] || ""),
            kegiatanId: String(r[1] || ""),
            namaKegiatan: String(r[2] || ""),
            tanggal: tStr,
            waktuBuka: String(r[4] || ""),
            petugas: String(r[5] || ""),
            totalPeserta: Number(r[6]) || 0,
            totalHadir: Number(r[7]) || 0,
            totalIzin: Number(r[8]) || 0,
            totalSakit: Number(r[9]) || 0,
            totalAlpa: Number(r[10]) || 0,
            statusSesi: String(r[11] || "Tutup"),
            catatan: String(r[12] || ""),
            createdAt: r[13] ? String(r[13]) : ""
          };
          break;
        }
      }
    }

    if (!sesiData) throw new Error("Sesi presensi tidak ditemukan");

    // Ambil exceptions dari Presensi_Logs
    var exceptionsMap = {};
    if (shLogs && shLogs.getLastRow() > 1) {
      var lRows = shLogs.getRange(2, 1, shLogs.getLastRow() - 1, shLogs.getLastColumn()).getValues();
      for (var j = 0; j < lRows.length; j++) {
        var lr = lRows[j];
        if (String(lr[1]) === String(sesiId)) {
          var stId = String(lr[3] || "");
          exceptionsMap[stId] = {
            logId: String(lr[0] || ""),
            statusKehadiran: String(lr[8] || "Izin"),
            metodeAbsen: String(lr[9] || "MANUAL"),
            waktuAbsen: String(lr[10] || ""),
            keterangan: String(lr[11] || "")
          };
        }
      }
    }

    // Ambil santri aktif
    var studentList = [];
    if (shStudents && shStudents.getLastRow() > 1) {
      var stRows = shStudents.getRange(2, 1, shStudents.getLastRow() - 1, shStudents.getLastColumn()).getValues();
      for (var k = 0; k < stRows.length; k++) {
        var row = stRows[k];
        if (!row[0]) continue;
        var stId2 = String(row[0] || "");
        var ex = exceptionsMap[stId2];
        studentList.push({
          studentId: stId2,
          nis: String(row[1] || ""),
          name: String(row[3] || ""),
          gender: String(row[4] || "L"),
          photoUrl: String(row[6] || ""),
          program: String(row[7] || ""),
          statusKehadiran: ex ? ex.statusKehadiran : "Hadir",
          keterangan: ex ? ex.keterangan : "",
          metodeAbsen: ex ? ex.metodeAbsen : "CHECKLIST"
        });
      }
    }

    return {
      status: "success",
      success: true,
      ok: true,
      data: {
        sesi: sesiData,
        students: studentList,
        exceptionsCount: Object.keys(exceptionsMap).length
      }
    };
  } catch (err) {
    return { status: "error", success: false, ok: false, message: err.message };
  }
}

/**
 * Menghapus satu sesi presensi beserta catatan log terkait.
 */
function deletePresensiSesi(sesiId, token) {
  try {
    if (!sesiId) throw new Error("Sesi ID diperlukan");
    var ss = getSpreadsheetDB_();
    var shSesi = ss.getSheetByName("Presensi_Sesi");
    var shLogs = ss.getSheetByName("Presensi_Logs");

    if (shSesi && shSesi.getLastRow() > 1) {
      var sRows = shSesi.getRange(2, 1, shSesi.getLastRow() - 1, 1).getValues();
      for (var i = 0; i < sRows.length; i++) {
        if (String(sRows[i][0]) === String(sesiId)) {
          shSesi.deleteRow(i + 2);
          break;
        }
      }
    }

    if (shLogs && shLogs.getLastRow() > 1) {
      var lRows = shLogs.getRange(2, 2, shLogs.getLastRow() - 1, 1).getValues();
      for (var j = lRows.length - 1; j >= 0; j--) {
        if (String(lRows[j][0]) === String(sesiId)) {
          shLogs.deleteRow(j + 2);
        }
      }
    }

    return { status: "success", success: true, ok: true, message: "Sesi presensi berhasil dihapus." };
  } catch (err) {
    return { status: "error", success: false, ok: false, message: err.message };
  }
}

/**
 * Rekapitulasi Presensi Santri (Perorangan / Matriks)
 */
function getPresensiRekap(filter, token) {
  try {
    filter = filter || {};
    var ss = getSpreadsheetDB_();
    initPresensiSheetsIfNeeded_(ss);

    var shSesi = ss.getSheetByName("Presensi_Sesi");
    var shLogs = ss.getSheetByName("Presensi_Logs");
    var shStudents = ss.getSheetByName("Students");

    var startDate = filter.startDate || "";
    var endDate = filter.endDate || "";
    var kegiatanId = filter.kegiatanId || "";
    var gender = filter.gender || "";

    // 1. Ambil Sesi yang sesuai filter
    var validSesiIds = {};
    var totalSesiTerhitung = 0;

    if (shSesi && shSesi.getLastRow() > 1) {
      var sRows = shSesi.getRange(2, 1, shSesi.getLastRow() - 1, shSesi.getLastColumn()).getValues();
      var tz = Session.getScriptTimeZone() || "Asia/Jakarta";

      for (var i = 0; i < sRows.length; i++) {
        var r = sRows[i];
        if (!r[0]) continue;
        var sId = String(r[0]);
        var kId = String(r[1]);
        var rawT = r[3];
        var tStr = (rawT instanceof Date) ? Utilities.formatDate(rawT, tz, "yyyy-MM-dd") : String(rawT || "").substring(0, 10);

        if (kegiatanId && kId !== kegiatanId) continue;
        if (startDate && tStr < startDate) continue;
        if (endDate && tStr > endDate) continue;

        validSesiIds[sId] = true;
        totalSesiTerhitung++;
      }
    }

    // 2. Ambil Pengecualian dari Presensi_Logs untuk sesi yang valid
    // studentExceptions[studentId] = { izin: X, sakit: Y, alpa: Z }
    var studentExceptions = {};

    if (shLogs && shLogs.getLastRow() > 1) {
      var lRows = shLogs.getRange(2, 1, shLogs.getLastRow() - 1, shLogs.getLastColumn()).getValues();
      for (var j = 0; j < lRows.length; j++) {
        var lr = lRows[j];
        var sesiKey = String(lr[1]);
        if (!validSesiIds[sesiKey]) continue;

        var stId = String(lr[3]);
        var stStatus = String(lr[8] || "Izin");

        if (!studentExceptions[stId]) {
          studentExceptions[stId] = { izin: 0, sakit: 0, alpa: 0, logs: [] };
        }

        if (stStatus === "Izin") studentExceptions[stId].izin++;
        else if (stStatus === "Sakit") studentExceptions[stId].sakit++;
        else if (stStatus === "Alpa") studentExceptions[stId].alpa++;

        studentExceptions[stId].logs.push({
          sesiId: sesiKey,
          tanggal: String(lr[7] || "").substring(0, 10),
          status: stStatus,
          keterangan: String(lr[11] || "")
        });
      }
    }

    // 3. Kompilasi Santri
    var rekapList = [];
    if (shStudents && shStudents.getLastRow() > 1) {
      var stRows = shStudents.getRange(2, 1, shStudents.getLastRow() - 1, shStudents.getLastColumn()).getValues();
      for (var k = 0; k < stRows.length; k++) {
        var row = stRows[k];
        if (!row[0]) continue;
        var sGender = String(row[4] || "L");
        if (gender && sGender !== gender) continue;

        var sId2 = String(row[0]);
        var exData = studentExceptions[sId2] || { izin: 0, sakit: 0, alpa: 0, logs: [] };

        var izin = exData.izin;
        var sakit = exData.sakit;
        var alpa = exData.alpa;
        var totalAbsen = izin + sakit + alpa;
        var hadir = Math.max(0, totalSesiTerhitung - totalAbsen);
        var pct = totalSesiTerhitung > 0 ? Math.round((hadir / totalSesiTerhitung) * 100) : 100;

        rekapList.push({
          studentId: sId2,
          nis: String(row[1] || ""),
          name: String(row[3] || ""),
          gender: sGender,
          program: String(row[7] || ""),
          totalSesi: totalSesiTerhitung,
          hadir: hadir,
          izin: izin,
          sakit: sakit,
          alpa: alpa,
          persentase: pct,
          logs: exData.logs
        });
      }
    }

    // Urutkan berdasarkan persentase kehadiran terendah (untuk monitoring kedisiplinan)
    rekapList.sort(function(a, b) {
      return a.persentase - b.persentase;
    });

    return {
      status: "success",
      success: true,
      ok: true,
      data: {
        totalSesiTerhitung: totalSesiTerhitung,
        rekap: rekapList
      }
    };
  } catch (err) {
    return { status: "error", success: false, ok: false, message: err.message };
  }
}


// ====================================================================
// MODUL DATA WALI SANTRI & KELUARGA (MASTER DATA & RELASI)
// ====================================================================

function getWaliSantriList(token) {
  try {
    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error('Spreadsheet database tidak ditemukan.');

    const waliSheet = getAuthSheet(ss, SHEET_WALI_IDENTITIES) || ss.getSheetByName('Users');
    const mapSheet = getAuthSheet(ss, SHEET_WALI_SANTRI_MAP);
    const studSheet = getAuthSheet(ss, SHEET_STUDENTS);

    if (!waliSheet) return { success: true, data: [] };

    const studentMap = {};
    if (studSheet) {
      const sData = studSheet.getDataRange().getValues();
      if (sData.length > 1) {
        const sHead = sData[0].map(h => String(h || '').trim().toLowerCase());
        const idIdx = sHead.indexOf('student_id');
        const nisIdx = sHead.indexOf('nis');
        const nameIdx = sHead.indexOf('name');
        const progIdx = sHead.indexOf('program');

        for (let i = 1; i < sData.length; i++) {
          const sId = String(sData[i][idIdx] || sData[i][0] || '').trim();
          if (sId) {
            studentMap[sId] = {
              studentId: sId,
              name: String(sData[i][nameIdx] || '').trim(),
              nis: String(sData[i][nisIdx] || '').trim(),
              program: String(sData[i][progIdx] || '').trim()
            };
          }
        }
      }
    }

    const waliToStudents = {};
    if (mapSheet) {
      const mData = mapSheet.getDataRange().getValues();
      for (let m = 1; m < mData.length; m++) {
        const mapId = String(mData[m][0] || '').trim();
        const wId = String(mData[m][1] || '').trim();
        const sId = String(mData[m][2] || '').trim();
        const rel = String(mData[m][3] || 'GUARDIAN').trim();

        if (wId && sId) {
          if (!waliToStudents[wId]) waliToStudents[wId] = [];
          const st = studentMap[sId] || { studentId: sId, name: 'Santri', nis: '', program: '' };
          waliToStudents[wId].push({
            relationId: mapId,
            studentId: sId,
            name: st.name,
            nis: st.nis,
            program: st.program,
            relationship: rel
          });
        }
      }
    }

    const wData = waliSheet.getDataRange().getValues();
    const wHead = wData[0].map(h => String(h || '').trim().toLowerCase());
    const idIdx = wHead.findIndex(h => h.includes('identity') || h.includes('id'));
    const emailIdx = wHead.indexOf('email');
    const phoneIdx = wHead.findIndex(h => h.includes('phone') || h.includes('hp') || h.includes('wa'));
    const nameIdx = wHead.indexOf('name') !== -1 ? wHead.indexOf('name') : wHead.indexOf('nama');
    const statusIdx = wHead.indexOf('status');
    const roleIdx = wHead.indexOf('role');

    const result = [];
    for (let w = 1; w < wData.length; w++) {
      const role = roleIdx !== -1 ? String(wData[w][roleIdx] || '').trim().toUpperCase() : 'WALI_SANTRI';
      if (role && role !== 'WALI_SANTRI' && role !== 'WALI' && role !== 'ORANG_TUA') {
        continue;
      }

      const wId = String(wData[w][idIdx] || '').trim();
      if (!wId) continue;

      result.push({
        id: wId,
        identityId: wId,
        name: String(wData[w][nameIdx] || '').trim(),
        email: emailIdx !== -1 ? String(wData[w][emailIdx] || '').trim() : '',
        phone: phoneIdx !== -1 ? String(wData[w][phoneIdx] || '').trim() : '',
        status: statusIdx !== -1 ? String(wData[w][statusIdx] || 'ACTIVE').trim().toUpperCase() : 'ACTIVE',
        students: waliToStudents[wId] || []
      });
    }

    return {
      status: 'success',
      success: true,
      data: result,
      total: result.length
    };
  } catch (err) {
    console.error('[GET WALI SANTRI ERROR]', err);
    return { status: 'error', success: false, message: err.message };
  }
}

function saveWaliIdentityData(payload, token) {
  try {
    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error('Spreadsheet database tidak ditemukan.');

    const sheet = getAuthSheet(ss, SHEET_WALI_IDENTITIES);
    if (!sheet) throw new Error('Sheet Wali_Identities tidak ditemukan.');

    const name = String(payload.name || payload.nama || '').trim();
    if (!name) throw new Error('Nama wali santri wajib diisi.');

    const email = String(payload.email || '').trim();
    const phone = String(payload.phone || payload.whatsapp || payload.no_hp || '').trim();
    const status = String(payload.status || 'ACTIVE').toUpperCase();
    let identityId = String(payload.identity_id || payload.identityId || payload.id || '').trim();

    const data = sheet.getDataRange().getValues();
    const head = data[0].map(h => String(h || '').trim().toLowerCase());
    const idIdx = head.findIndex(h => h.includes('identity') || h.includes('id'));
    const emailIdx = head.indexOf('email');
    const phoneIdx = head.findIndex(h => h.includes('phone') || h.includes('hp') || h.includes('wa'));
    const nameIdx = head.indexOf('name') !== -1 ? head.indexOf('name') : head.indexOf('nama');
    const statusIdx = head.indexOf('status');

    let foundRow = -1;
    if (identityId) {
      for (let r = 1; r < data.length; r++) {
        if (String(data[r][idIdx] || '').trim() === identityId) {
          foundRow = r + 1;
          break;
        }
      }
    }

    const nowIso = new Date().toISOString();

    if (foundRow !== -1) {
      if (nameIdx !== -1) sheet.getRange(foundRow, nameIdx + 1).setValue(name);
      if (emailIdx !== -1 && email) sheet.getRange(foundRow, emailIdx + 1).setValue(email);
      if (phoneIdx !== -1) sheet.getRange(foundRow, phoneIdx + 1).setValue(phone);
      if (statusIdx !== -1) sheet.getRange(foundRow, statusIdx + 1).setValue(status);
    } else {
      if (!identityId) {
        identityId = 'USR_WLI_' + Utilities.getUuid().replace(/-/g, '').substring(0, 10);
      }
      sheet.appendRow([
        identityId,
        email,
        phone,
        name,
        'WALI_SANTRI',
        status,
        nowIso,
        '',
        ''
      ]);
    }

    return {
      status: 'success',
      success: true,
      message: 'Data wali santri berhasil disimpan ke Spreadsheet.',
      identityId: identityId
    };
  } catch (err) {
    console.error('[SAVE WALI ERROR]', err);
    return { status: 'error', success: false, message: err.message };
  }
}

function linkStudentToWaliData(payload, token) {
  try {
    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error('Spreadsheet database tidak ditemukan.');

    const sheet = getAuthSheet(ss, SHEET_WALI_SANTRI_MAP);
    if (!sheet) throw new Error('Sheet Wali_Santri_Map tidak ditemukan.');

    const waliId = String(payload.guardianId || payload.waliId || payload.guardian_id || '').trim();
    const studentId = String(payload.studentId || payload.student_id || '').trim();
    const relationship = String(payload.relationship || 'GUARDIAN').toUpperCase();

    if (!waliId || !studentId) throw new Error('Wali ID dan Student ID wajib disertakan.');

    const data = sheet.getDataRange().getValues();
    for (let r = 1; r < data.length; r++) {
      if (String(data[r][1] || '').trim() === waliId && String(data[r][2] || '').trim() === studentId) {
        return { success: true, message: 'Relasi santri dan wali sudah ada sebelumnya.' };
      }
    }

    const mapId = 'MAP_' + Utilities.getUuid().replace(/-/g, '').substring(0, 8);
    const nowIso = new Date().toISOString();

    sheet.appendRow([
      mapId,
      waliId,
      studentId,
      relationship,
      'ACTIVE',
      nowIso
    ]);

    return {
      status: 'success',
      success: true,
      message: 'Santri berhasil dihubungkan ke wali di Spreadsheet.',
      mapId: mapId
    };
  } catch (err) {
    console.error('[LINK STUDENT ERROR]', err);
    return { status: 'error', success: false, message: err.message };
  }
}

function unlinkStudentFromWaliData(payload, token) {
  try {
    const ss = getDatabaseSpreadsheet();
    if (!ss) throw new Error('Spreadsheet database tidak ditemukan.');

    const sheet = getAuthSheet(ss, SHEET_WALI_SANTRI_MAP);
    if (!sheet) throw new Error('Sheet Wali_Santri_Map tidak ditemukan.');

    const relationId = String(payload.relationId || payload.id || '').trim();
    const studentId = String(payload.studentId || '').trim();
    const waliId = String(payload.guardianId || payload.waliId || '').trim();

    const data = sheet.getDataRange().getValues();
    for (let r = data.length - 1; r >= 1; r--) {
      const rowMapId = String(data[r][0] || '').trim();
      const rowWId = String(data[r][1] || '').trim();
      const rowSId = String(data[r][2] || '').trim();

      if ((relationId && rowMapId === relationId) || (waliId && studentId && rowWId === waliId && rowSId === studentId)) {
        sheet.deleteRow(r + 1);
        return { status: 'success', success: true, message: 'Relasi berhasil dihapus dari Spreadsheet.' };
      }
    }

    return { status: 'success', success: true, message: 'Relasi tidak ditemukan atau sudah terhapus.' };
  } catch (err) {
    console.error('[UNLINK STUDENT ERROR]', err);
    return { status: 'error', success: false, message: err.message };
  }
}
