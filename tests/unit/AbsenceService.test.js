
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock Browser Environment
global.window = {};
global.console = { log: () => { }, error: console.error }; // Silence logs

// Load Dependencies
const loadScript = (relativePath) => {
    const p = path.resolve(__dirname, '../../' + relativePath);
    const code = fs.readFileSync(p, 'utf8');
    eval(code);
};

// Load types (Store & Service)
loadScript('src/js/absence/AbsenceStore.js');
loadScript('src/features/absence/AbsenceService.js');
loadScript('src/features/roster/timeRange.js'); // Dependency

const AbsenceService = global.window.AbsenceService;
const AbsenceStore = global.window.AbsenceStore; // Store helper
const TimeRange = global.window.TimeRange;      // Helper

console.log('🧪 Testing AbsenceService...');

// Mock App State
const mockApp = {
    shifts: [],
    saveToStorage: () => { },
    renderTableBody: () => { },
    timeRangeHelper: TimeRange
};

// Mock Store (using real class but inmem)
global.localStorage = {
    _data: {},
    getItem: (k) => global.localStorage._data[k],
    setItem: (k, v) => global.localStorage._data[k] = String(v)
};
mockApp.absenceStore = new AbsenceStore(mockApp);

// Initialize Service
const service = new AbsenceService(mockApp);

// Setup Test Data
// Staff A has a shift on 2023-01-01 08:00-20:00
const staffId = 'staff-A';
const shift = {
    id: 'shift-1',
    staffId: staffId,
    date: '2023-01-01',
    start: '08:00',
    end: '20:00',
    vacant: false
};
mockApp.shifts = [shift];

// Mock Allocation Engine for Backfill
mockApp.allocationEngine = {
    findBestCandidate: (date, start, end, exclude) => {
        // Return a candidate if date matches
        if (date === '2023-01-01') return { id: 'staff-B', name: 'Bob' };
        return null; // Fail otherwise
    }
};

// 1. Request Absence (Overlapping Shift)
console.log('Step 1: Request Absence');
const typeId = mockApp.absenceStore.getTypes()[0].id;
const absenceRec = service.requestAbsence({
    staffId: staffId,
    typeId: typeId,
    start: '2023-01-01T08:00:00.000Z', // Exact overlap
    end: '2023-01-01T20:00:00.000Z'
});
assert.ok(absenceRec.id, 'Absence request failed');

// 2. Approve Absence -> Verify Vacate & Backfill
console.log('Step 2: Approve Absence');
const result = service.approveAbsence(absenceRec.id, 'admin-1');

// Verify Overlap Detection
assert.strictEqual(result.affected, 1, 'Should find 1 overlapping shift');

// Verify Vacate Logic
const updatedShift = mockApp.shifts[0];
assert.strictEqual(updatedShift.originalStaffId, staffId, 'Should audit original staff');
assert.strictEqual(updatedShift.absenceId, absenceRec.id, 'Should link absence ID');

// Verify Backfill Logic (Mock returns Staff B)
assert.strictEqual(updatedShift.staffId, 'staff-B', 'Should be backfilled with Staff B');
assert.strictEqual(updatedShift.vacant, false, 'Should not be vacant if backfilled');
assert.strictEqual(updatedShift.backfilled, true, 'Should mark as backfilled');

console.log('✅ AbsenceService Tests Passed');
