/**
 * RosterEngine - Pure Functional Roster Core
 * Implementation for Prompt 3 - Deterministic Roster Generation
 */
const RosterEngine = {
    /**
     * Core Generation Loop
     * Returns Assignment[]
     */
    generateAssignments({
        startDate,
        weeks,
        requirements,
        staff,
        constraints = {},
        existingShifts = [],
        patternSequence = [],
        initialOffsets = {},
        shiftDefinitions = {},
        helpers = null // Optional injection for testing
    }) {
        // Resolve Dependencies
        const TimeRange = helpers ? helpers.TimeRange : window.TimeRange;
        const ShiftMapping = helpers ? helpers.ShiftMapping : window.ShiftMapping;

        if (!TimeRange || !ShiftMapping) throw new Error('Helpers (TimeRange, ShiftMapping) required');

        const assignments = [];
        const shortfalls = [];
        const totalDays = weeks * 7;
        const cycleLen = patternSequence.length;
        const staffIds = staff.map(s => s.id);
        const versionId = 'v-' + Date.now().toString(36);

        // Traceability & Fairness Counters
        const forcedAssignmentsCount = {};
        const nightAssignmentsCount = {};
        staffIds.forEach(id => {
            forcedAssignmentsCount[id] = 0;
            nightAssignmentsCount[id] = 0;
        });

        const lastAssignmentMap = {};
        // Initialize from existing shifts
        if (Array.isArray(existingShifts)) {
            existingShifts.forEach(s => {
                if (s.date <= startDate) {
                    const { end } = TimeRange.rangeFromDateAndHm(s.date, s.start, s.end);
                    const current = lastAssignmentMap[s.staffId];
                    if (!current || end > current) {
                        lastAssignmentMap[s.staffId] = end;
                    }
                }
            });
        }

        const baseStartDate = new Date(startDate);

        for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
            const currentObj = new Date(baseStartDate);
            currentObj.setDate(currentObj.getDate() + dayOffset);
            const dateStr = currentObj.toISOString().split('T')[0];

            // 1. Determine Requirements for this day
            const dayRequirements = {};
            patternSequence.forEach(c => {
                const code = ShiftMapping.toCode(c);
                if (code !== 'R') {
                    const reqKey = this._mapCodeToReqKey(code);
                    const rawReq = requirements[reqKey];
                    dayRequirements[code] = parseInt(rawReq !== undefined ? rawReq : (requirements[code] || 0), 10);
                }
            });

            // 2. Track assignments
            const assignedToday = {};
            Object.keys(dayRequirements).forEach(k => assignedToday[k] = 0);
            const unassignedStaff = [];

            // Pass 1: Natural Pattern Rotation
            staffIds.forEach((staffId, staffIdx) => {
                const baseOffset = initialOffsets[staffId] !== undefined ? initialOffsets[staffId] : staffIdx;
                const patternIdx = (dayOffset + baseOffset) % cycleLen;
                const rawCode = patternSequence[patternIdx];
                const code = ShiftMapping.toCode(rawCode);

                // Check for EXISTING shift
                const existingOnDay = existingShifts.find(s => String(s.staffId) === String(staffId) && s.date === dateStr);
                if (existingOnDay) {
                    const type = ShiftMapping.toCode(existingOnDay.shiftType || existingOnDay.type || 'Custom');
                    if (dayRequirements[type] !== undefined) {
                        assignedToday[type] = (assignedToday[type] || 0) + 1;
                    }
                    const { end: eEnd } = TimeRange.rangeFromDateAndHm(existingOnDay.date, existingOnDay.start, existingOnDay.end);
                    lastAssignmentMap[String(staffId)] = eEnd;
                    return;
                }

                if (code !== 'R') {
                    const required = dayRequirements[code] || 0;

                    const tempShift = this._createShiftObject({
                        staffId, dateStr, code, patternIdx, shiftDefinitions, constraints, versionId,
                        helpers: { TimeRange, ShiftMapping }
                    });

                    const safe = this._checkRestSafety(staffId, tempShift, lastAssignmentMap, constraints, TimeRange);

                    if (safe.allowed && assignedToday[code] < required) {
                        assignments.push(tempShift);
                        assignedToday[code]++;
                        const { end: rEnd } = TimeRange.rangeFromDateAndHm(tempShift.date, tempShift.start, tempShift.end);
                        lastAssignmentMap[String(staffId)] = rEnd;
                        if (code === 'N') nightAssignmentsCount[staffId]++;
                    } else {
                        if (!safe.allowed) {
                            shortfalls.push({ date: dateStr, staffId, targetShift: code, reason: safe.reason });
                        }
                        unassignedStaff.push({ staffId, patternIdx });
                    }
                } else {
                    unassignedStaff.push({ staffId, patternIdx });
                }
            });

            // Pass 2: Gap Filling
            Object.keys(dayRequirements).forEach(requirementCode => {
                const required = dayRequirements[requirementCode];

                while (assignedToday[requirementCode] < required && unassignedStaff.length > 0) {
                    const candidates = unassignedStaff.map(c => {
                        const tempShift = this._createShiftObject({
                            staffId: c.staffId, dateStr, code: requirementCode, patternIdx: c.patternIdx,
                            shiftDefinitions, constraints, versionId,
                            helpers: { TimeRange, ShiftMapping },
                            isForced: true
                        });
                        const safe = this._checkRestSafety(c.staffId, tempShift, lastAssignmentMap, constraints, TimeRange);
                        return { ...c, tempShift, allowed: safe.allowed, reason: safe.reason };
                    }).filter(c => c.allowed);

                    if (candidates.length === 0) {
                        shortfalls.push({
                            date: dateStr, staffId: 'ALL_CANDIDATES', targetShift: requirementCode + ' (GapFill)', reason: 'No safe candidates available'
                        });
                        break;
                    }

                    // Fairness Sort
                    candidates.sort((a, b) => {
                        const forcedA = forcedAssignmentsCount[a.staffId] || 0;
                        const forcedB = forcedAssignmentsCount[b.staffId] || 0;
                        if (forcedA !== forcedB) return forcedA - forcedB;
                        const nightA = nightAssignmentsCount[a.staffId] || 0;
                        const nightB = nightAssignmentsCount[b.staffId] || 0;
                        return nightA - nightB;
                    });

                    const best = candidates[0];
                    assignments.push({
                        ...best.tempShift, is_forced: true, forced_reason: 'Gap Fill'
                    });
                    assignedToday[requirementCode]++;
                    const { end: bEnd } = TimeRange.rangeFromDateAndHm(best.tempShift.date, best.tempShift.start, best.tempShift.end);
                    lastAssignmentMap[String(best.staffId)] = bEnd;

                    forcedAssignmentsCount[best.staffId]++;
                    if (requirementCode === 'N') nightAssignmentsCount[best.staffId]++;

                    const idx = unassignedStaff.findIndex(x => x.staffId === best.staffId);
                    if (idx > -1) unassignedStaff.splice(idx, 1);
                }
            });
        }

        return { assignments, shortfalls };
    },

    selectBackfillCandidates({ assignment, staff, constraints, shifts, helpers = null }) {
        const TimeRange = helpers ? helpers.TimeRange : window.TimeRange;
        const ShiftMapping = helpers ? helpers.ShiftMapping : window.ShiftMapping;

        const scored = staff.map(member => {
            const score = this.scoreCandidate({
                candidate: member, assignment, shifts, constraints, helpers: { TimeRange, ShiftMapping }
            });
            return { member, score };
        });

        return scored.filter(s => s.score < 10000).sort((a, b) => a.score - b.score).map(s => s.member);
    },

    scoreCandidate({ candidate, assignment, shifts, constraints, helpers }) {
        const { TimeRange } = helpers;
        const staffShifts = shifts.filter(s => s.staffId === candidate.id);

        const { start: checkStart, end: checkEnd } = TimeRange.rangeFromDateAndHm(assignment.date, assignment.start, assignment.end);

        const clash = staffShifts.find(s => {
            const { start: sStart, end: sEnd } = TimeRange.rangeFromDateAndHm(s.date, s.start, s.end);
            return Math.max(checkStart.getTime(), sStart.getTime()) < Math.min(checkEnd.getTime(), sEnd.getTime());
        });
        if (clash) return 10000;

        const lastAssignmentMap = this._buildLastAssignmentMap(candidate.id, staffShifts, TimeRange);
        const tempShift = { date: assignment.date, start: assignment.start, end: assignment.end };
        const safetyCheck = this._checkRestSafety(candidate.id, tempShift, lastAssignmentMap, constraints, TimeRange);

        if (!safetyCheck.allowed) return 10000;

        let score = 0;
        score += staffShifts.length * 5;
        return score;
    },

    _mapCodeToReqKey(code) {
        const map = { 'E': 'early', 'L': 'late', 'N': 'night', 'D': 'day12' };
        return map[code] || code.toLowerCase();
    },

    _checkRestSafety(staffId, shift, lastAssignmentMap, constraints, TimeRange) {
        const lastEnd = lastAssignmentMap[String(staffId)];
        if (!lastEnd) return { allowed: true };

        const sEnd = shift.end || shift.shift_end || "09:00";
        const sDate = shift.date || shift.shift_date;
        const sStart = shift.start || shift.shift_start;

        const { start: newStart } = TimeRange.rangeFromDateAndHm(sDate, sStart, sEnd);
        const restHours = (newStart - lastEnd) / (1000 * 60 * 60);
        const limit = (constraints && typeof constraints.restPeriod === 'number') ? constraints.restPeriod : 11;

        if (restHours < limit) {
            return { allowed: false, reason: `Insufficient rest (${restHours.toFixed(1)}h < ${limit}h)` };
        }
        return { allowed: true };
    },

    _createShiftObject({ staffId, dateStr, code, patternIdx, shiftDefinitions, constraints, versionId, helpers, isForced = false }) {
        const { ShiftMapping } = helpers;
        let start = '09:00', end = '17:00';
        const std = constraints.standards || {};
        const requirementCode = ShiftMapping.toCode(code);

        if (shiftDefinitions && shiftDefinitions[code]) {
            start = shiftDefinitions[code].start;
            end = shiftDefinitions[code].end;
        } else {
            if (requirementCode === 'E') { start = std.early8 || '06:00'; end = std.late8 || '14:00'; }
            else if (requirementCode === 'L') { start = std.late8 || '14:00'; end = std.night8 || '22:00'; }
            else if (requirementCode === 'N') { start = std.night8 || '22:00'; end = '06:00'; }
            else if (requirementCode === 'D') { start = std.day12 || '07:00'; end = std.night12 || '19:00'; }
        }

        return {
            id: 'sh-' + Math.random().toString(36).substr(2, 9),
            version_id: versionId,
            date: dateStr,
            start: start,
            end: end,
            shift_code: requirementCode,
            shiftType: requirementCode, // Legacy
            staffId: staffId,           // Legacy
            isForced: isForced,         // Legacy
            forced_reason: isForced ? 'Gap Fill' : null
        };
    },

    _buildLastAssignmentMap(staffId, staffShifts, TimeRange) {
        const map = {};
        staffShifts.forEach(s => {
            const { end } = TimeRange.rangeFromDateAndHm(s.date, s.start, s.end);
            const current = map[String(staffId)];
            if (!current || end > current) {
                map[String(staffId)] = end;
            }
        });
        return map;
    }
};

// Global exposure & CJS compatibility
if (typeof module !== 'undefined') {
    module.exports = { RosterEngine };
}
if (typeof window !== 'undefined') {
    window.RosterEngine = RosterEngine;
}
