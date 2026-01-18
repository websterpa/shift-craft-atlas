
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock Browser Environment
global.window = {};
// global.console = { log: () => { }, error: console.error }; // Silence logs - REMOVED for visibility

// Load Dependencies
const loadScript = (relativePath) => {
    const p = path.resolve(__dirname, '../../' + relativePath);
    const code = fs.readFileSync(p, 'utf8');
    eval(code);
};

// Load types (Store & Service)
// Load types (Store & Service)
loadScript('public/app/src/js/absence/AbsenceStore.js');
loadScript('public/app/src/features/time/timeRange.js'); // Updated Path
loadScript('public/app/src/features/roster/shiftMapping.js'); // Added Dependency
loadScript('public/app/src/features/absence/AbsenceService.js');

const AbsenceService = global.window.AbsenceService;
const AbsenceStore = global.window.AbsenceStore; // Store helper
const TimeRange = global.window.TimeRange;      // Helper

console.log('🧪 Testing AbsenceService...');

// Helper to reset app state
const setupTestApp = () => {
    // Mock Repo
    const mockRepo = {
        _types: [],
        _absences: [],
        async loadAbsenceTypes() { return this._types; },
        async saveAbsenceTypes(types) { this._types = types; },
        async saveAbsence(rec) { this._absences.push(rec); },
        async loadAbsences() { return this._absences; },
        async loadAssignments() { return []; },
        async saveAssignments() { }
    };

    // Mock App State
    const mockApp = {
        repo: mockRepo,
        shifts: [],
        saveToStorage: () => { },
        renderTableBody: () => { },
        activeVersionId: 'v1'
    };

    // Attach Store
    mockApp.absenceStore = new AbsenceStore(mockApp);

    return mockApp;
};

// Common Shift Data
const staffId = 'staff-A';
const createShift = () => ({
    id: 'shift-1',
    staff_id: staffId,
    staffId: staffId,
    date: '2023-01-01',
    start: '08:00',
    end: '20:00',
    vacant: false
});

(async function runTests() {
    console.log('🧪 Testing AbsenceService...');

    // --- Test 1: Direct Flow (No PublishManager) ---
    console.log('\n--- Test 1: Direct Flow (No PublishManager) ---');
    {
        const app = setupTestApp();
        const service = new AbsenceService(app);

        // Seed
        await app.absenceStore.seedDefaultTypes();
        const types = await app.absenceStore.getTypes();
        const absenceRec = await service.requestAbsence({
            staffId: staffId, typeId: types[0].id,
            start: '2023-01-01T00:00:00.000Z', end: '2023-01-01T23:59:59.000Z'
        });

        // Setup Shift
        const shift = createShift();
        app.shifts = [shift];
        app.repo.loadAssignments = async () => [shift];

        // Action
        await service.approveAbsence(absenceRec.id, 'admin');

        // Assert
        const updated = app.shifts[0];
        assert.strictEqual(updated.status, 'vacant', 'Direct: Should default to vacant');
        assert.strictEqual(updated.staff_id, null, 'Direct: Should clear staff_id');
        console.log('✅ Direct Flow Passed');
    }

    // --- Test 2: Guarded Flow (With PublishManager) ---
    console.log('\n--- Test 2: Guarded Flow (With PublishManager) ---');
    {
        const app = setupTestApp();

        // Add Mock PublishManager
        app.publishManager = {
            checkGuard: async (date, actionFn) => {
                console.log('🛡️ Guard intercepted action');
                return await actionFn(); // Execute immediately
            }
        };

        const service = new AbsenceService(app);

        // Seed
        await app.absenceStore.seedDefaultTypes();
        const types = await app.absenceStore.getTypes();
        const absenceRec = await service.requestAbsence({
            staffId: staffId, typeId: types[0].id,
            start: '2023-01-01T00:00:00.000Z', end: '2023-01-01T23:59:59.000Z'
        });

        // Setup Shift
        const shift = createShift();
        app.shifts = [shift];
        app.repo.loadAssignments = async () => [shift];

        // Action
        await service.approveAbsence(absenceRec.id, 'admin');

        // Assert
        const updated = app.shifts[0];
        assert.strictEqual(updated.status, 'vacant', 'Guarded: Should become vacant');
        assert.strictEqual(updated.staff_id, null, 'Guarded: Should clear staff_id');
        console.log('✅ Guarded Flow Passed');
    }

    console.log('\n🎉 All AbsenceService Tests Passed');

})().catch(err => {
    console.error('❌ Test Failed:', err);
    process.exit(1);
});
