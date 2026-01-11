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
            const reqPerDay = requirements[code] !== undefined ? parseInt(requirements[code], 10) : 1;
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
    static generateShifts(config, settings) {
        const shifts = [];
        const startDateStr = config.startDate;
        const startDate = new Date(startDateStr);
        const totalDays = config.weeks * 7;
        const cycleLen = config.patternSequence.length;
        const selectedStaffIds = config.selectedStaff;

        for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
            const currentObj = new Date(startDate);
            currentObj.setDate(currentObj.getDate() + dayOffset);
            const dateStr = currentObj.toISOString().split('T')[0];

            // 1. Determine Requirements for this specific day
            const dayRequirements = {};
            config.patternSequence.forEach(c => {
                if (c !== 'R') {
                    const rawReq = config.requirements[c];
                    dayRequirements[c] = parseInt(rawReq !== undefined ? rawReq : 1, 10);
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
                    if (assignedToday[code] < required) {
                        shifts.push(RosterLogic.createShift(staffId, dateStr, code, patternIdx, config, settings));
                        assignedToday[code]++;
                    } else {
                        unassignedStaff.push({ staffId, patternIdx });
                    }
                }
            });

            // Pass 2: Gap Filling (FIFO for Fairness)
            Object.keys(dayRequirements).forEach(code => {
                const required = dayRequirements[code];
                while (assignedToday[code] < required && unassignedStaff.length > 0) {
                    const candidate = unassignedStaff.shift(); // FIFO Queue
                    shifts.push(RosterLogic.createShift(candidate.staffId, dateStr, code, candidate.patternIdx, config, settings));
                    assignedToday[code]++;
                }
            });
        }

        return shifts;
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
