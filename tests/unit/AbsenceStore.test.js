
const assert = require('assert');
const crypto = require('crypto');

// Mock Browser Environment
global.crypto = { randomUUID: () => crypto.randomUUID() };
class MockStorage {
    constructor() { this.store = {}; }
    getItem(k) { return this.store[k] || null; }
    setItem(k, v) { this.store[k] = String(v); }
    clear() { this.store = {}; }
}
global.localStorage = new MockStorage();

// Load Module (Reading file content to eval in this context or requiring if CommonJS)
// Since the source is ES6 class window assignment, we need a wrapper
const fs = require('fs');
const path = require('path');
const storePath = path.resolve(__dirname, '../../src/js/absence/AbsenceStore.js');
const storeCode = fs.readFileSync(storePath, 'utf8');

// Mock window and eval
global.window = {};
eval(storeCode);

const AbsenceStore = global.window.AbsenceStore;

// Test Suite
console.log('🧪 Testing AbsenceStore...');

// 1. Initialization & Seeding
localStorage.clear();
const store = new AbsenceStore({});
const types = store.getTypes();
assert.strictEqual(types.length, 4, 'Should seed 4 default types');
assert.ok(types.find(t => t.code === 'ANNUAL_LEAVE'), 'Should have Annual Leave');

// 2. Add Absence
const staffId = 'staff-123';
const typeId = types[0].id;
const start = '2023-01-01T09:00:00.000Z';
const end = '2023-01-02T17:00:00.000Z';

const record = store.addAbsence(staffId, typeId, start, end);
assert.strictEqual(record.staff_id, staffId);
assert.ok(record.id, 'Should generate UUID');

// 3. Retrieve Absence
const retrieved = store.getAbsencesForStaff(staffId);
assert.strictEqual(retrieved.length, 1);
assert.strictEqual(retrieved[0].id, record.id);

// 4. Retrieve Range
const inRange = store.getAbsencesInRange('2022-12-31', '2023-01-03');
assert.strictEqual(inRange.length, 1, 'Should find in range');

const outRange = store.getAbsencesInRange('2023-02-01', '2023-02-05');
assert.strictEqual(outRange.length, 0, 'Should not find out of range');

console.log('✅ AbsenceStore Tests Passed');
