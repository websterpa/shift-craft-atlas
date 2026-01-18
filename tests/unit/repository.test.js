const assert = require('assert');

// Mock localStorage
const storage = {};
global.localStorage = {
    getItem: (key) => storage[key] || null,
    setItem: (key, val) => { storage[key] = val; },
    removeItem: (key) => { delete storage[key]; }
};

// Mock crypto
global.crypto = {
    randomUUID: () => 'test-uuid-' + Math.random()
};

// Load Repository (we need to mock window or just require if it was node-compatible)
// Since it's a browser script with 'window.', we'll mock 'window'
global.window = {};
require('../../public/app/src/repository/index.js');

const Repository = global.window.Repository;

async function testLocalRepository() {
    console.log('--- Testing LocalRepository ---');
    const keys = { STAFF: 's', SHIFTS: 'sh', SETTINGS: 'se' };
    const repo = Repository.create('local', { keys });

    // Test Config
    await repo.saveConfig({ theme: 'dark' });
    const config = await repo.loadConfig({});
    assert.strictEqual(config.theme, 'dark', 'Config load failed');
    console.log('✅ Config save/load passed');

    // Test Assignments
    const shifts = [{ id: '1', date: '2026-01-01', staffId: 'st1', versionId: 'v1' }];
    await repo.saveAssignments(shifts);
    const loadedShifts = await repo.loadAssignments({ versionId: 'v1' });
    assert.strictEqual(loadedShifts.length, 1, 'Assignments load by versionId failed');
    assert.strictEqual(loadedShifts[0].id, '1');
    console.log('✅ Assignments save/load passed');

    // Test Absences
    const absence = { id: 'a1', staff_id: 'st1', start_ts: '2026-01-01T10:00:00Z', end_ts: '2026-01-01T12:00:00Z' };
    await repo.saveAbsence(absence);
    const loadedAbsences = await repo.loadAbsences({ range: { start: '2026-01-01T00:00:00Z', end: '2026-01-02T00:00:00Z' } });
    assert.strictEqual(loadedAbsences.length, 1, 'Absences load by range failed');
    console.log('✅ Absences save/load passed');

    console.log('--- All LocalRepository Tests Passed ---');
}

testLocalRepository().catch(err => {
    console.error('❌ Test Failed:', err);
    process.exit(1);
});
