
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Mock Browser Environment
global.crypto = { randomUUID: () => 'uuid-' + Math.random() };
global.window = {};

// Load Module
const storePath = path.resolve(__dirname, '../../public/app/src/js/absence/AbsenceStore.js');
const storeCode = fs.readFileSync(storePath, 'utf8');
eval(storeCode);

const AbsenceStore = global.window.AbsenceStore;

(async function runTests() {
    console.log('🧪 Testing AbsenceStore...');

    // Mock Repository
    const mockRepo = {
        _types: [],
        _absences: [],
        async loadAbsenceTypes() { return this._types; },
        async saveAbsenceTypes(types) { this._types = types; },
        async saveAbsence(rec) { this._absences.push(rec); },
        async loadAbsences({ range } = {}) {
            if (range) {
                const s = new Date(range.start);
                const e = new Date(range.end);
                return this._absences.filter(a => {
                    const start = new Date(a.start_ts);
                    return start >= s && start <= e;
                });
            }
            return this._absences;
        }
    };

    const mockApp = { repo: mockRepo };

    // 1. Initialization & Seeding
    const store = new AbsenceStore(mockApp);

    // Explicitly seed default types first
    await store.seedDefaultTypes();

    const types = await store.getTypes();
    assert.strictEqual(types.length, 4, 'Should seed 4 default types');
    assert.ok(types.find(t => t.code === 'ANNUAL_LEAVE'), 'Should have Annual Leave');

    // 2. Add Absence
    const staffId = 'staff-123';
    const typeId = types[0].id;
    const start = '2023-01-01T09:00:00.000Z';
    const end = '2023-01-02T17:00:00.000Z';

    const record = await store.addAbsence(staffId, typeId, start, end);
    assert.strictEqual(record.staff_id, staffId);
    assert.ok(record.id, 'Should generate UUID');

    // 3. Retrieve Absence
    const retrieved = await store.getAbsencesForStaff(staffId);
    assert.strictEqual(retrieved.length, 1);
    assert.strictEqual(retrieved[0].id, record.id);

    // 4. Retrieve Range
    const inRange = await store.getAbsencesInRange('2022-12-31', '2023-01-03');
    assert.strictEqual(inRange.length, 1, 'Should find in range');

    const outRange = await store.getAbsencesInRange('2023-02-01', '2023-02-05');
    assert.strictEqual(outRange.length, 0, 'Should not find out of range');

    console.log('✅ AbsenceStore Tests Passed');

})().catch(err => {
    console.error('❌ Test Failed:', err);
    process.exit(1);
});
