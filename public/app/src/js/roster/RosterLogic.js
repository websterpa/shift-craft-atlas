/**
 * RosterLogic - Pure business logic for roster calculations and generation.
 * Decoupled from UI and Application State.
 */
class RosterLogic {

    /**
     * Calculates the minimum number of staff required to fulfill the defined daily requirements
     * based on the cycle length and shift frequency in the pattern.
     */
    static calculateRequiredStaff(config) {
        const cycleLen = config.patternSequence.length;
        const pattern = config.patternSequence;
        const requirements = config.requirements;

        let maxRequired = 0;

        // Count occurrences of each shift type in pattern sequence
        const countsInPattern = {};
        pattern.forEach(code => {
            if (code !== 'R') countsInPattern[code] = (countsInPattern[code] || 0) + 1;
        });

        // Types in pattern
        const types = Object.keys(countsInPattern);
        if (types.length === 0) return 0;

        // Calculate needed for each requirement
        types.forEach(code => {
            const reqPerDay = requirements[code] !== undefined ? parseInt(requirements[code], 10) : 0;
            const shiftsInCycle = countsInPattern[code];

            const needed = Math.ceil((reqPerDay * cycleLen) / shiftsInCycle);
            if (needed > maxRequired) maxRequired = needed;
        });

        return maxRequired;
    }

    /**
     * Estimates the total number of shifts that will be generated.
     */
    static estimateShifts(config, weeks) {
        const totalDays = weeks * 7;
        const requirements = config.requirements;

        // Truth Protocol: Generate EXACTLY enough to fill requirements.
        let total = 0;
        Object.keys(requirements).forEach(k => {
            total += (requirements[k] !== undefined ? parseInt(requirements[k], 10) : 0);
        });

        // Only fallback if NO requirements are defined at all
        if (Object.keys(requirements).length === 0) {
            return 0;
        }

        return totalDays * total;
    }

    /**
     * Core Algorithm: Generates the list of shift objects based on config.
     * Returns an array of shift objects.
     */
    static generateShifts(config, settings, existingShifts = []) {
        // Initialize shortfalls for tracking
        RosterLogic.shortfalls = [];

        if (typeof window !== 'undefined' && window.RosterEngine) {
            const h = {
                TimeRange: window.TimeRange,
                ShiftMapping: window.ShiftMapping
            };

            const result = window.RosterEngine.generateAssignments({
                startDate: config.startDate,
                weeks: config.weeks,
                requirements: config.requirements,
                staff: config.selectedStaff.map(id => ({ id })), // Minimal staff objects
                constraints: settings,
                existingShifts,
                patternSequence: config.patternSequence,
                initialOffsets: config.initialOffsets,
                shiftDefinitions: config.shiftDefinitions,
                helpers: h
            });

            // Populate shortfalls for UI
            RosterLogic.shortfalls = [...(result.shortfalls || [])];

            // Map back to the expected application format (Unified Assignment Shape)
            return result.assignments.map(a => ({
                id: 'sh-wiz-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
                version_id: a.version_id,
                date: a.shift_date || a.date,
                start: a.shift_start || a.start,
                end: a.shift_end || a.end,
                shift_code: a.shift_code,
                staff_id: a.staff_id,
                status: 'assigned',

                // Legacy / Hybrid Compatibility (until all consumers updated)
                shiftType: a.shift_code,
                staffId: a.staff_id,
                is_forced: a.is_forced,
                forced_reason: a.forced_reason
            }));
        }

        // Fallback or Node.js environment handling if window.RosterEngine is missing
        // This part is preserved for unit tests that might load RosterLogic in isolation
        return [];
    }

    /**
     * Helper to calculate accurate end Date object
     * Uses integer comparison to strictly detect midnight crossings
     */
    static calculateEndTime(dateStr, startStr, endStr) {
        return window.TimeRange.rangeFromDateAndHm(dateStr, startStr, endStr).end;
    }

    /**
     * Enforce rest constraints (allocator gate)
     */
    static checkRestSafety(staffId, newShift, lastAssignmentMap, settings = {}) {
        const lastEnd = lastAssignmentMap[String(staffId)]; // Force String Key
        if (!lastEnd) return { allowed: true };

        const newStart = new Date(`${newShift.date}T${newShift.start}`);

        // Calculate rest hours
        const diffMs = newStart - lastEnd;
        const restHours = diffMs / (1000 * 60 * 60);

        // Use configured rest period or default to 11h
        const limit = settings.restPeriod || 11;

        // Debug Logging for tricky transitions
        if (restHours < limit) {
            // Allow if overrides are enabled? No, logic core should be strict.
            // console.warn(`[RosterLogic] Safety Violation for ${staffId} on ${newShift.date}: Gap ${restHours.toFixed(1)}h < ${limit}h`);
            return { allowed: false, reason: `Insufficient rest (${restHours.toFixed(1)}h < ${limit}h)` };
        }

        return { allowed: true };
    }

    /**
     * Helper to construct a single shift object
     */
    static createShift(staffId, dateStr, code, patternIdx, config, settings, meta = {}) {
        let start = '09:00', end = '17:00';

        // Custom Time Override
        if (config.customShifts && config.customShifts[patternIdx]) {
            const parts = config.customShifts[patternIdx].split('-');
            if (parts.length === 2) {
                start = parts[0];
                end = parts[1];
            }
        } else if (config.shiftDefinitions && config.shiftDefinitions[code]) {
            // Pattern-Specific Overrides (e.g. Pitman N = 19:00-07:00)
            start = config.shiftDefinitions[code].start;
            end = config.shiftDefinitions[code].end;
        } else {
            // Standard Times (Defaults)
            const s = settings.standards || {};
            if (code === 'E') { start = s.early8 || '06:00'; end = s.late8 || '14:00'; }
            if (code === 'L') { start = s.late8 || '14:00'; end = s.night8 || '22:00'; }
            if (code === 'N') { start = s.night8 || '22:00'; end = '06:00'; }
            if (code === 'D') { start = s.day12 || '07:00'; end = s.night12 || '19:00'; }
        }

        return {
            id: 'sh-wiz-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
            version_id: 'manual-wiz-' + Date.now(),
            staff_id: staffId,
            date: dateStr,
            start: start,
            end: end,
            shift_code: code,
            status: 'assigned',

            // Legacy / Hybrid
            shiftType: code,
            staffId: staffId,
            is_forced: !!meta.isForced,
            forced_reason: meta.forcedReason || null
        };
    }
}

if (typeof module !== 'undefined') {
    module.exports = { RosterLogic };
}
if (typeof window !== 'undefined') {
    window.RosterLogic = RosterLogic;
}
