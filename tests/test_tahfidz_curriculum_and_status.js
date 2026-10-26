const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

console.log("=== RUNNING UNIT TESTS: TAHFIDZ CURRICULUM, PROGRAM RESOLUTION & STATUS BADGES ===");

const store = {};
const localStorageMock = {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); }
};

const sandbox = {
    window: {
        escapeHtml: str => String(str || ''),
        adminStudentsData: []
    },
    document: {
        getElementById: () => null
    },
    localStorage: localStorageMock,
    sessionStorage: localStorageMock,
    console: console,
    Date: Date,
    Math: Math,
    String: String,
    Number: Number,
    Array: Array,
    Object: Object,
    Set: Set,
    JSON: JSON
};
sandbox.window.window = sandbox.window;
sandbox.global = sandbox;

vm.createContext(sandbox);

const tahfidzJs = fs.readFileSync('js/tahfidz.js', 'utf8');
vm.runInContext(tahfidzJs, sandbox);

// Extract references from sandbox.window
const {
    TAHFIDZ_CURRICULUM_PRESETS,
    getTahfidzCurriculumMap,
    getCurriculumOrderForProgram,
    getTahfidzStudentProgram,
    getCurriculumProgress,
    getJuzCurriculumIndex,
    moveCurriculumJuz,
    getStudentPresensiStatus,
    saveTahfidzPresensiRecords
} = sandbox.window;

const TAHFIDZ_CURRICULUM_STORAGE_KEY = 'MUBAROKAH_TAHFIDZ_CURRICULUM_PROGRAMS_V1';

// -------------------------------------------------------------
// TEST 1: Curriculum Presets Integrity
// -------------------------------------------------------------
console.log("\n[TEST 1] Verifying Curriculum Presets Integrity...");
assert(TAHFIDZ_CURRICULUM_PRESETS.PRESET_A, "Preset A should exist");
assert(TAHFIDZ_CURRICULUM_PRESETS.PRESET_B, "Preset B should exist");
assert(TAHFIDZ_CURRICULUM_PRESETS.PRESET_C, "Preset C should exist");

assert.strictEqual(TAHFIDZ_CURRICULUM_PRESETS.PRESET_A.order.length, 30, "Preset A must contain 30 Juz");
assert.strictEqual(new Set(TAHFIDZ_CURRICULUM_PRESETS.PRESET_A.order).size, 30, "Preset A must contain unique Juz");
assert.strictEqual(TAHFIDZ_CURRICULUM_PRESETS.PRESET_A.order[0], 30, "Preset A must start with Juz 30");
assert.strictEqual(TAHFIDZ_CURRICULUM_PRESETS.PRESET_A.order[1], 1, "Preset A 2nd item must be Juz 1");

assert.strictEqual(TAHFIDZ_CURRICULUM_PRESETS.PRESET_B.order.length, 30, "Preset B must contain 30 Juz");
assert.strictEqual(new Set(TAHFIDZ_CURRICULUM_PRESETS.PRESET_B.order).size, 30, "Preset B must contain unique Juz");
assert.strictEqual(TAHFIDZ_CURRICULUM_PRESETS.PRESET_B.order[0], 30, "Preset B starts with 30");
assert.strictEqual(TAHFIDZ_CURRICULUM_PRESETS.PRESET_B.order[9], 21, "Preset B 10th item is 21");

assert.strictEqual(TAHFIDZ_CURRICULUM_PRESETS.PRESET_C.order.length, 30, "Preset C must contain 30 Juz");
assert.strictEqual(new Set(TAHFIDZ_CURRICULUM_PRESETS.PRESET_C.order).size, 30, "Preset C must contain unique Juz");
assert.strictEqual(TAHFIDZ_CURRICULUM_PRESETS.PRESET_C.order[0], 1, "Preset C starts with 1");
assert.strictEqual(TAHFIDZ_CURRICULUM_PRESETS.PRESET_C.order[29], 30, "Preset C ends with 30");
console.log("✅ Passed: Presets A, B, and C are valid and contain 30 distinct Juz.");

// -------------------------------------------------------------
// TEST 2: Program-to-Curriculum Mapping
// -------------------------------------------------------------
console.log("\n[TEST 2] Verifying Program-to-Curriculum Order Mapping...");
const maOrder = getCurriculumOrderForProgram('MA Tahfidz');
assert.strictEqual(maOrder[0], 1, "MA Tahfidz should default to Preset C (starts with Juz 1)");
assert.strictEqual(maOrder[29], 30, "MA Tahfidz ends with Juz 30");

const anakOrder = getCurriculumOrderForProgram('Pesantren Tahfidz Anak');
assert.strictEqual(anakOrder[0], 30, "Pesantren Tahfidz Anak should default to Preset A (starts with Juz 30)");
assert.strictEqual(anakOrder[1], 1, "Pesantren Tahfidz Anak 2nd juz is Juz 1");

const dewasaOrder = getCurriculumOrderForProgram('Pesantren Tahfidz Dewasa');
assert.strictEqual(dewasaOrder[0], 1, "Pesantren Tahfidz Dewasa should default to Preset C (starts with Juz 1)");
console.log("✅ Passed: Programs automatically map to their respective canonical presets.");

// -------------------------------------------------------------
// TEST 3: Resolving Student Program Name (getTahfidzStudentProgram)
// -------------------------------------------------------------
console.log("\n[TEST 3] Verifying getTahfidzStudentProgram resolution...");
// Direct
const st1 = { name: "Ahmad", program: "MA Tahfidz" };
assert.strictEqual(getTahfidzStudentProgram(st1), "MA Tahfidz");

// Overriding 'Bil Hifdhi' with master data in window.adminStudentsData
sandbox.window.adminStudentsData = [
    { studentId: "STD-101", nis: "2024001", program: "Pesantren Tahfidz Anak" }
];
const st2 = { studentId: "STD-101", nis: "2024001", program: "Bil Hifdhi" };
assert.strictEqual(getTahfidzStudentProgram(st2), "Pesantren Tahfidz Anak");

// Overriding via localStorage 'mubarokah_admin_students'
localStorageMock.setItem('mubarokah_admin_students', JSON.stringify([
    { studentId: "STD-102", nis: "2024002", programPesantren: "Pesantren Tahfidz Dewasa" }
]));
const st3 = { studentId: "STD-102", nis: "2024002" };
assert.strictEqual(getTahfidzStudentProgram(st3), "Pesantren Tahfidz Dewasa");
console.log("✅ Passed: getTahfidzStudentProgram successfully overrides generic labels with canonical program names.");

// -------------------------------------------------------------
// TEST 4: Adaptive Progress and Khatam Calculation
// -------------------------------------------------------------
console.log("\n[TEST 4] Verifying Adaptive Progress and Khatam Calculation...");
// Santri Anak with Preset A (Juz 30 first):
// Selesai Juz 30 Hal 20 -> rank 0, total 20 halaman
const progAnak = getCurriculumProgress(30, 20, 'Pesantren Tahfidz Anak');
assert.strictEqual(progAnak.rank, 0);
assert.strictEqual(progAnak.totalTuntas, 20);
assert.strictEqual(progAnak.isKhatam, false);

// Santri MA with Preset C (Juz 1 first):
// Selesai Juz 1 Hal 20 -> rank 0, total 20 halaman
const progMA = getCurriculumProgress(1, 20, 'MA Tahfidz');
assert.strictEqual(progMA.rank, 0);
assert.strictEqual(progMA.totalTuntas, 20);

// Santri MA with Preset C (Juz 30 Hal 20 -> rank 29, 600 halaman, Khatam):
const progMAKhatam = getCurriculumProgress(30, 20, 'MA Tahfidz');
assert.strictEqual(progMAKhatam.rank, 29);
assert.strictEqual(progMAKhatam.totalTuntas, 600);
assert.strictEqual(progMAKhatam.isKhatam, true);
assert.strictEqual(progMAKhatam.percent, 100);
console.log("✅ Passed: Progress calculations accurately adapt to the student's program curriculum.");

// -------------------------------------------------------------
// TEST 5: Custom Curriculum Storage and Reordering
// -------------------------------------------------------------
console.log("\n[TEST 5] Verifying Custom Reordering & Persistence...");
const testProgram = "MA Tahfidz";
vm.runInContext("activeCurriculumProgram = 'MA Tahfidz'; activeCurriculumOrder = [...TAHFIDZ_CURRICULUM_PRESETS.PRESET_C.order];", sandbox);

// Move Juz 1 (at index 0) right to index 1
moveCurriculumJuz(0, 1);
const currOrder1 = vm.runInContext("activeCurriculumOrder", sandbox);
assert.strictEqual(currOrder1[0], 2, "Index 0 should now be Juz 2");
assert.strictEqual(currOrder1[1], 1, "Index 1 should now be Juz 1");

// Move back
moveCurriculumJuz(1, -1);
const currOrder2 = vm.runInContext("activeCurriculumOrder", sandbox);
assert.strictEqual(currOrder2[0], 1, "Index 0 should be Juz 1 again");

// Test save custom settings
const customMap = getTahfidzCurriculumMap();
customMap[testProgram] = { order: [...currOrder2], updatedAt: new Date().toISOString() };
localStorageMock.setItem(TAHFIDZ_CURRICULUM_STORAGE_KEY, JSON.stringify(customMap));

const fetchedOrder = getCurriculumOrderForProgram(testProgram);
assert.deepStrictEqual(Array.from(fetchedOrder), Array.from(currOrder2), "Fetched order should match custom saved order");
console.log("✅ Passed: Custom curriculum reordering and persistence work seamlessly.");

// -------------------------------------------------------------
// TEST 6: Presensi Status & Excused Logic
// -------------------------------------------------------------
console.log("\n[TEST 6] Verifying Presensi Status & Excused Logic...");
// Mock presensi records
const mockPresensi = {
    "STD-001": { status: "SAKIT", keterangan: "Demam panas di UKS" },
    "STD-002": { status: "PULANG", keterangan: "Izin pulang acara keluarga" },
    "STD-003": { status: "IZIN", keterangan: "Tugas delegasi lomba" },
    "STD-004": { status: "HADIR", keterangan: "" }
};
saveTahfidzPresensiRecords(mockPresensi);

assert.strictEqual(getStudentPresensiStatus("STD-001"), "SAKIT");
assert.strictEqual(getStudentPresensiStatus("STD-002"), "PULANG");
assert.strictEqual(getStudentPresensiStatus("STD-003"), "IZIN");
assert.strictEqual(getStudentPresensiStatus("STD-004"), "HADIR");

const isExcused1 = ['SAKIT', 'IZIN', 'PULANG'].includes(getStudentPresensiStatus("STD-001"));
const isExcused4 = ['SAKIT', 'IZIN', 'PULANG'].includes(getStudentPresensiStatus("STD-004"));
assert.strictEqual(isExcused1, true, "STD-001 must be excused");
assert.strictEqual(isExcused4, false, "STD-004 must not be excused");
console.log("✅ Passed: Presensi status and excused logic function reliably.");

console.log("\n🎉 ALL UNIT TESTS PASSED SUCCESSFULLY! (6/6 SUITES)");
