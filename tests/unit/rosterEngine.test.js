const assert = require('assert');
const { RosterEngine } = require('../../public/app/src/engine/rosterEngine.js');

// Mock Helpers
const mockTimeRange = {
    hhmmToMinutes: (hhmm) => {
        const [h, m] = hhmm.split(':').map(Number);
        return (h * 60) + m;
    },
    getDurationMinutes: (start, end) => {
        const s = (start.split(':').map(Number)[0] * 60) + start.split(':').map(Number)[1];
        let e = (end.split(':').map(Number)[0] * 60) + end.split(':').map(Number)[1];
        if (e <= s) e += 1440;
        return e - s;
    },
    rangeFromDateAndHm: (date, start, end) => {
        const s = new Date(`${date}T${start}`);
        const e = new Date(`${date}T${end}`);
        if (e <= s) e.setDate(e.getDate() + 1);
        return { start: s, end: e };
    }
};

const mockShiftMapping = {
    toCode: (input) => {
        if (!input) return 'R';
        const upper = input.toUpperCase().trim();
        if (['N', 'E', 'L', 'D', 'R'].includes(upper)) return upper;
        if (upper.includes('NIGHT')) return 'N';
        if (upper.includes('EARLY')) return 'E';
        if (upper.includes('LATE')) return 'L';
        return 'R';
    }
};

const helpers = { TimeRange: mockTimeRange, ShiftMapping: mockShiftMapping };

console.log('🧪 Testing Pure RosterEngine...');

// 1. generateAssignments
console.log('Testing generateAssignments...');
const { assignments, shortfalls } = RosterEngine.generateAssignments({
    startDate: '2025-01-01',
    weeks: 1,
    requirements: { early: 1, late: 1 },
    staff: [{ id: 'S1' }, { id: 'S2' }],
    patternSequence: ['E', 'L', 'R', 'R'],
    initialOffsets: { 'S1': 0, 'S2': 1 },
    constraints: { restPeriod: 0 },
    helpers
});

console.log('Assignments generated:', assignments.length);
assignments.forEach(a => console.log(`  Day: ${a.shift_date}, Staff: ${a.staff_id}, Type: ${a.shift_code}, Forced: ${a.is_forced}`));

assert.strictEqual(assignments.length, 14, 'Should generate 14 assignments (2 staff * 7 days)');
assert.ok(assignments.every(a => a.version_id.startsWith('v-')), 'Version ID should be present');
assert.strictEqual(assignments[0].staff_id, 'S1');
assert.strictEqual(assignments[0].shift_code, 'E');

// 2. scoreCandidate (Rest Constraint)
console.log('Testing scoreCandidate (Rest)...');
const s1Shifts = [{ staffId: 'S1', date: '2025-01-01', start: '22:00', end: '06:00' }]; // Finished at 6am Jan 2nd
const assignmentAt8am = { date: '2025-01-02', start: '08:00', end: '16:00' };

const scoreSmallGap = RosterEngine.scoreCandidate({
    candidate: { id: 'S1' },
    assignment: assignmentAt8am,
    shifts: s1Shifts,
    constraints: { restPeriod: 11 },
    helpers
});
assert.strictEqual(scoreSmallGap, 10000, 'Should block due to insufficient rest (2h < 11h)');

const scoreLargeGap = RosterEngine.scoreCandidate({
    candidate: { id: 'S1' },
    assignment: { date: '2025-01-02', start: '19:00', end: '03:00' },
    shifts: s1Shifts,
    constraints: { restPeriod: 11 },
    helpers
});
assert.ok(scoreLargeGap < 10000, 'Should allow with sufficient rest (13h > 11h)');

console.log('Testing Night Shift Generation...');
const nightResult = RosterEngine.generateAssignments({
    startDate: '2025-01-01',
    weeks: 1,
    requirements: { night: 1 },
    staff: [{ id: 'S1' }],
    patternSequence: ['N', 'R', 'R'],
    initialOffsets: { 'S1': 0 },
    constraints: {},
    helpers
});

const nightShifts = nightResult.assignments.filter(a => a.shift_code === 'N');
assert.ok(nightShifts.length > 0, 'Should generate at least one Night shift');
console.log(`Verified ${nightShifts.length} Night shifts generated.`);

console.log('✅ RosterEngine Tests Passed');
