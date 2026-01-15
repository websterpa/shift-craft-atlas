/**
 * Engine Unit Tests
 */

const { AuditRunner, expect } = window;
const { RosterEngine } = window;

AuditRunner.register('Roster Engine', 'Shift Creation (8h)', () => {
    // Mock Constraints
    const constraints = {
        standards: { early8: '06:00', late8: '14:00' }
    };

    const shift = RosterEngine._createShiftObject({
        staffId: 's1',
        dateStr: '2026-05-01',
        code: 'E',
        patternIdx: 0,
        shiftDefinitions: {},
        constraints: constraints,
        versionId: 'test-v1',
        helpers: { ShiftMapping: window.ShiftMapping }
    });

    expect(shift.shift_start).toBe('06:00');
    expect(shift.shift_end).toBe('14:00');
    expect(shift.shift_code).toBe('E');
});

AuditRunner.register('Roster Engine', 'Night Shift Rollover', () => {
    const helpers = {
        TimeRange: window.TimeRange,
        ShiftMapping: window.ShiftMapping
    };

    // Create a 22:00 -> 06:00 shift
    const shift = { date: '2026-05-01', start: '22:00', end: '06:00' };

    const range = helpers.TimeRange.rangeFromDateAndHm(shift.date, shift.start, shift.end);

    // End time should be May 2nd
    expect(range.end.getDate()).toBe(2);
    expect(range.end.getHours()).toBe(6);
});

AuditRunner.register('Roster Engine', 'Rest Safety Check (11h)', () => {
    // Previous shift ended at 22:00 on May 1st
    const lastAssignmentMap = {
        's1': new Date('2026-05-01T22:00:00')
    };

    // Try to start Early (06:00) on May 2nd
    // Gap = 8 hours. Should fail default 11h rule.
    const unsafeShift = { shift_date: '2026-05-02', shift_start: '06:00' };

    const result = RosterEngine._checkRestSafety('s1', unsafeShift, lastAssignmentMap, { restPeriod: 11 });
    expect(result.allowed).toBe(false);

    // Try to start Late (14:00) on May 2nd
    // Gap = 16 hours. Should pass.
    const safeShift = { shift_date: '2026-05-02', shift_start: '14:00' };

    const resultSafe = RosterEngine._checkRestSafety('s1', safeShift, lastAssignmentMap, { restPeriod: 11 });
    expect(resultSafe.allowed).toBe(true);
});

AuditRunner.register('Roster Engine', 'Backfill Candidate Selection', () => {
    // Staff 1: Working on the day (Clash)
    // Staff 2: Free
    const staff = [{ id: 's1', name: 'Busy' }, { id: 's2', name: 'Free' }];
    const shifts = [
        { staffId: 's1', date: '2026-05-01', start: '09:00', end: '17:00' }
    ];
    const assignment = { date: '2026-05-01', start: '09:00', end: '17:00' };

    const candidates = RosterEngine.selectBackfillCandidates({
        assignment,
        staff,
        shifts,
        constraints: {},
        helpers: { TimeRange: window.TimeRange, ShiftMapping: window.ShiftMapping }
    });

    // Should only return s2
    expect(candidates.length).toBe(1);
    expect(candidates[0].id).toBe('s2');
});
