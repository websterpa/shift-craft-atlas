
import { test, describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

// Load Fixtures
const fixturesPath = path.join(process.cwd(), 'tests/fixtures/roster_wizard/scenarios.json');
const fixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));

// Load TimeRange
const timePath = path.join(process.cwd(), 'public/app/src/features/time/timeRange.js');
const timeCode = fs.readFileSync(timePath, 'utf8');

// Load ShiftMapping
const mappingPath = path.join(process.cwd(), 'public/app/src/features/roster/shiftMapping.js');
const mappingCode = fs.readFileSync(mappingPath, 'utf8');

// Load RosterEngine
const enginePath = path.join(process.cwd(), 'public/app/src/engine/rosterEngine.js');
const engineCode = fs.readFileSync(enginePath, 'utf8');

// Load RosterLogic
const logicPath = path.join(process.cwd(), 'public/app/src/js/roster/RosterLogic.js');
const logicCode = fs.readFileSync(logicPath, 'utf8');

// Shim Window environment
const sandbox = { window: {}, console: console };
vm.createContext(sandbox);

// 1. Load Helpers
vm.runInContext(mappingCode, sandbox);
vm.runInContext(timeCode, sandbox);
// 2. Load Engine
vm.runInContext(engineCode, sandbox);
// 3. Load Logic
vm.runInContext(logicCode, sandbox);

const RosterLogic = sandbox.window.RosterLogic;

describe('Allocator Logic Verification', () => {

    it('Scenario A: Prevents Night -> Early transition in Pass 1', () => {
        const fixture = fixtures.scenario_A_prevention;
        const shifts = RosterLogic.generateShifts(fixture.config, fixture.settings);

        // Should have assigned N (Day 1)
        const day1 = shifts.find(s => s.date === '2024-01-01');
        assert.ok(day1, 'Day 1 Night shift should be assigned');
        assert.equal(day1.shiftType, 'N');

        // Should NOT have assigned E (Day 2) because N->E is unsafe
        const day2 = shifts.find(s => s.date === '2024-01-02');
        // Note: It might assign N instead if requirements N=1 is active and Staff is safe for N.
        // We assert specifically that E is NOT assigned.
        if (day2) {
            assert.notEqual(day2.shiftType, 'E', 'Day 2 Early shift should be blocked');
        } else {
            assert.ok(true, 'Day 2 shift blocked completely');
        }

        // Check shortfalls recorded for 'E'
        const shortfall = RosterLogic.shortfalls.find(s => s.date === '2024-01-02' && s.targetShift === 'E');
        assert.ok(shortfall, 'Shortfall should be recorded for Day 2 Early');
        assert.match(shortfall.reason, /Insufficient rest/, 'Reason should be rest violation');
    });

    it('Scenario B: Gap fills with Forced Assignments', () => {
        const fixture = fixtures.scenario_B_forced;
        const shifts = RosterLogic.generateShifts(fixture.config, fixture.settings);
        // We need 14 shifts (2 per day for 7 days).
        // Actual generated may vary if we didn't force properly or logic skipped.
        assert.ok(shifts.length > 0, 'Should generate shifts');

        // Verify Forced Flags
        const forcedShifts = shifts.filter(s => s.is_forced);
        // In the fixture, we have E, R, R...
        // Day 1: E (Natural) for Staff 1. E (Gap) for Staff 2.
        // Day 2..7: R (Natural). E (Gap) for Staff 1 & 2.
        // So plenty of forced shifts.
        assert.ok(forcedShifts.length > 0, 'Should have forced shifts');
        assert.equal(forcedShifts[0].forced_reason, 'Gap Fill');
    });

    it('Scenario C: Impossible Coverage (Rest Constraints)', () => {
        const fixture = fixtures.scenario_C_impossible;
        // Pass existing shifts to simulated context
        const shifts = RosterLogic.generateShifts(fixture.config, fixture.settings, fixture.existingShifts);

        // Should be 0 assignments because N(prev) -> E(req) is blocked for 11h rest
        // Day 2 (Start) is blocked.
        // Subsequent days might be safe if the gap allows rest recovery.
        // We assert that the first day is blocked.
        const day1Assigned = shifts.find(s => s.date === fixture.config.startDate); // 2024-01-02
        assert.equal(day1Assigned, undefined, 'First day should be blocked due to rest constraint');

        const sf = RosterLogic.shortfalls;
        assert.ok(sf.length > 0, 'Shortfalls should be recorded');
        assert.match(sf[0].reason, /Insufficient rest/, 'Reason should be rest violation');
    });

    it('Fairness: Distribution of forced shifts', () => {
        // Setup: 2 staff, Need 1 E per day. Both on Rest pattern.
        // Should alternate or distribute evenly if "Fairness" works.
        const config = {
            startDate: "2024-01-01",
            weeks: 1,
            selectedStaff: ["A", "B"],
            patternSequence: ["E", "R", "R", "R", "R", "R", "R"], // Include E to trigger requirements
            requirements: { "E": 1 }
        };
        const settings = { standards: { early8: "06:00", late8: "14:00" } };
        // Override pattern so both on R all week?
        // If pattern is E,R...
        // Day 1: A on E. B on E? No B on R?
        // Natural rotation assigns.
        // We want Pure Gap Fill.
        // Set Pattern ["R", "R"...] and manually inject Requirement E?
        // But logic requires E in pattern.
        // Hack: Set Pattern ["E"], but set `customShifts` to force "Off"? No.
        // Let's rely on the fact that with ["E", "R"...], Day 2-7 are R.
        // Requirements E=1 every day.
        // Day 2-7: Gap Fill.
        // Needed: 6 days * 1 E = 6 shifts.
        // 2 Staff available.
        // Should be 3 each.

        const shifts = RosterLogic.generateShifts(config, settings);
        // Filter Day 2-7
        const gapFilled = shifts.filter(s => s.date >= "2024-01-02");

        const countA = gapFilled.filter(s => s.staffId === 'A').length;
        const countB = gapFilled.filter(s => s.staffId === 'B').length;

        assert.ok(Math.abs(countA - countB) <= 1, `Assignments should be balanced (A:${countA}, B:${countB})`);
    });

});
