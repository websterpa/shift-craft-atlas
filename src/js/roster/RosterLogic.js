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
        const shifts = [];
        const startDateStr = config.startDate;
        const startDate = new Date(startDateStr);
        const totalDays = config.weeks * 7;
        const cycleLen = config.patternSequence.length;
        const selectedStaffIds = config.selectedStaff;

        // Traceability for blocked assignments
        RosterLogic.shortfalls = [];

        // Map to track the END time of the last shift for each staff member
        // This ensures we respect rest periods across the generation boundary
        const lastAssignmentMap = {};

        // Initialize from existing shifts
        if (Array.isArray(existingShifts)) {
            existingShifts.forEach(s => {
                const end = RosterLogic.calculateEndTime(s.date, s.start, s.end);
                const current = lastAssignmentMap[s.staffId];
                if (!current || end > current) {
                    lastAssignmentMap[s.staffId] = end;
                }
            });
        }

        for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
            const currentObj = new Date(startDate);
            currentObj.setDate(currentObj.getDate() + dayOffset);
            const dateStr = currentObj.toISOString().split('T')[0];

            // 1. Determine Requirements for this specific day
            const dayRequirements = {};
            config.patternSequence.forEach(c => {
                if (c !== 'R') {
                    const rawReq = config.requirements[c];
                    dayRequirements[c] = parseInt(rawReq !== undefined ? rawReq : 0, 10);
                }
            });

            // 2. Track assignments
            const assignedToday = {};
            Object.keys(dayRequirements).forEach(k => assignedToday[k] = 0);
            const unassignedStaff = [];

            // Pass 1: Natural Pattern Rotation
            selectedStaffIds.forEach((staffId, staffIdx) => {
                const patternIdx = (dayOffset + staffIdx) % cycleLen;
                const code = config.patternSequence[patternIdx];

                if (code !== 'R') {
                    const required = dayRequirements[code] || 0;

                    // Proposed Shift
                    const tempShift = RosterLogic.createShift(staffId, dateStr, code, patternIdx, config, settings);
                    const safe = RosterLogic.checkRestSafety(staffId, tempShift, lastAssignmentMap);

                    if (!safe.allowed) {
                        // Blocked by allocator constraint
                        RosterLogic.shortfalls.push({
                            date: dateStr,
                            staffId: staffId,
                            targetShift: code,
                            reason: safe.reason
                        });
                        // Add to unassigned to see if they can fill a different safe slot (unlikely if rest is issue, but good practice)
                        unassignedStaff.push({ staffId, patternIdx });
                    } else if (assignedToday[code] < required) {
                        shifts.push(tempShift);
                        assignedToday[code]++;
                        // Update Map
                        lastAssignmentMap[staffId] = RosterLogic.calculateEndTime(tempShift.date, tempShift.start, tempShift.end);
                    } else {
                        unassignedStaff.push({ staffId, patternIdx });
                    }
                }
            });

            // Pass 2: Gap Filling (FIFO for Fairness)
            Object.keys(dayRequirements).forEach(code => {
                const required = dayRequirements[code];

                // We need a specific loop here because simple while(unassigned > 0) isn't enough given constraints
                // We iterate through available candidates, assigning if safe, until quota met or candidates exhausted
                let attempts = unassignedStaff.length;
                while (assignedToday[code] < required && unassignedStaff.length > 0 && attempts > 0) {
                    attempts--;
                    const candidate = unassignedStaff.shift(); // Pop first

                    const tempShift = RosterLogic.createShift(candidate.staffId, dateStr, code, candidate.patternIdx, config, settings);
                    const safe = RosterLogic.checkRestSafety(candidate.staffId, tempShift, lastAssignmentMap);

                    if (safe.allowed) {
                        shifts.push(tempShift);
                        assignedToday[code]++;
                        lastAssignmentMap[candidate.staffId] = RosterLogic.calculateEndTime(tempShift.date, tempShift.start, tempShift.end);
                    } else {
                        // If unsafe for this specific shift code, they might be safe for a later one?
                        // For now, put back at end of queue? Or discard for this code?
                        // If we put back, we risk infinite loop if we don't decrement logic.
                        // Since 'attempts' limits us, we can safely push back.
                        unassignedStaff.push(candidate);

                        // Trace
                        RosterLogic.shortfalls.push({
                            date: dateStr,
                            staffId: candidate.staffId,
                            targetShift: code + ' (GapFill)',
                            reason: safe.reason
                        });
                    }
                }
            });
        }

        return shifts;
    }

    /**
     * Helper to calculate accurate end Date object
     */
    static calculateEndTime(dateStr, startStr, endStr) {
        const start = new Date(`${dateStr}T${startStr}`);
        const end = new Date(`${dateStr}T${endStr}`);
        if (end <= start) {
            // Crosses midnight
            end.setDate(end.getDate() + 1);
        }
        return end;
    }

    /**
     * Enforce rest constraints (allocator gate)
     */
    static checkRestSafety(staffId, newShift, lastAssignmentMap) {
        const lastEnd = lastAssignmentMap[staffId];
        if (!lastEnd) return { allowed: true };

        const newStart = new Date(`${newShift.date}T${newShift.start}`);

        // Calculate rest hours
        const diffMs = newStart - lastEnd;
        const restHours = diffMs / (1000 * 60 * 60);

        if (restHours < 11) {
            return { allowed: false, reason: `Insufficient rest (${restHours.toFixed(1)}h < 11h)` };
        }

        return { allowed: true };
    }

    /**
     * Helper to construct a single shift object
     */
    static createShift(staffId, dateStr, code, patternIdx, config, settings) {
        let start = '09:00', end = '17:00';

        // Custom Time Override
        if (config.customShifts && config.customShifts[patternIdx]) {
            const parts = config.customShifts[patternIdx].split('-');
            if (parts.length === 2) {
                start = parts[0];
                end = parts[1];
            }
        } else {
            // Standard Times
            const s = settings.standards || {};
            if (code === 'E') { start = s.early8 || '06:00'; end = s.late8 || '14:00'; }
            if (code === 'L') { start = s.late8 || '14:00'; end = s.night8 || '22:00'; }
            if (code === 'N') { start = s.night8 || '22:00'; end = '06:00'; }
            if (code === 'D') { start = s.day12 || '07:00'; end = s.night12 || '19:00'; }
        }

        return {
            id: 'sh-wiz-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
            staffId: staffId,
            date: dateStr,
            start: start,
            end: end,
            shiftType: code
        };
    }
}
window.RosterLogic = RosterLogic;
