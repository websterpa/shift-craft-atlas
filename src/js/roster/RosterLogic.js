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

        // Traceability & Fairness Counters
        RosterLogic.shortfalls = [];
        const forcedAssignmentsCount = {};
        const nightAssignmentsCount = {};

        selectedStaffIds.forEach(id => {
            forcedAssignmentsCount[id] = 0;
            nightAssignmentsCount[id] = 0;
        });

        // Map to track the END time of the last shift for each staff member
        const lastAssignmentMap = {};

        // Initialize from existing shifts
        // Fix: Only strictly past shifts should seed the 'last assignment' to prevent negative rest calculation
        if (Array.isArray(existingShifts)) {
            existingShifts.forEach(s => {
                // Ensure we don't pick up future shifts if the user didn't clear them
                if (s.date < startDateStr) {
                    const end = RosterLogic.calculateEndTime(s.date, s.start, s.end);
                    const current = lastAssignmentMap[s.staffId];
                    if (!current || end > current) {
                        lastAssignmentMap[s.staffId] = end;
                    }
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

                    // Proposed Shift (Pass 1 - Natural)
                    const tempShift = RosterLogic.createShift(staffId, dateStr, code, patternIdx, config, settings, { isForced: false });
                    const safe = RosterLogic.checkRestSafety(staffId, tempShift, lastAssignmentMap);

                    if (!safe.allowed) {
                        RosterLogic.shortfalls.push({ date: dateStr, staffId, targetShift: code, reason: safe.reason });
                        unassignedStaff.push({ staffId, patternIdx });
                    } else if (assignedToday[code] < required) {
                        shifts.push(tempShift);
                        assignedToday[code]++;
                        lastAssignmentMap[staffId] = RosterLogic.calculateEndTime(tempShift.date, tempShift.start, tempShift.end);
                        if (code === 'N') nightAssignmentsCount[staffId]++;
                    } else {
                        unassignedStaff.push({ staffId, patternIdx });
                    }
                } else {
                    // Staff on Rest are available for Gap Filling
                    unassignedStaff.push({ staffId, patternIdx });
                }
            });

            // Pass 2: Gap Filling (Fairness Optimized)
            Object.keys(dayRequirements).forEach(code => {
                const required = dayRequirements[code];

                while (assignedToday[code] < required && unassignedStaff.length > 0) {
                    // Filter Safe Candidates
                    // Map to carry check result, then filter
                    const candidates = unassignedStaff.map(c => {
                        const tempShift = RosterLogic.createShift(c.staffId, dateStr, code, c.patternIdx, config, settings, { isForced: true, forcedReason: 'Gap Fill' });
                        const result = RosterLogic.checkRestSafety(c.staffId, tempShift, lastAssignmentMap);
                        return { ...c, tempShift, allowed: result.allowed, reason: result.reason };
                    }).filter(c => c.allowed);

                    if (candidates.length === 0) {
                        // No safe candidates left for this code
                        RosterLogic.shortfalls.push({
                            date: dateStr,
                            staffId: 'ALL_CANDIDATES',
                            targetShift: code + ' (GapFill)',
                            reason: 'No safe candidates available'
                        });
                        break; // Cannot fill this demand
                    }

                    // Fairness Sort: Min Forced -> Min Nights -> Stable
                    candidates.sort((a, b) => {
                        const forcedA = forcedAssignmentsCount[a.staffId] || 0;
                        const forcedB = forcedAssignmentsCount[b.staffId] || 0;
                        if (forcedA !== forcedB) return forcedA - forcedB;

                        const nightA = nightAssignmentsCount[a.staffId] || 0;
                        const nightB = nightAssignmentsCount[b.staffId] || 0;
                        if (nightA !== nightB) return nightA - nightB;

                        return 0; // Stable
                    });

                    // Pick Winner
                    const best = candidates[0];

                    shifts.push(best.tempShift);
                    assignedToday[code]++;
                    lastAssignmentMap[best.staffId] = RosterLogic.calculateEndTime(best.tempShift.date, best.tempShift.start, best.tempShift.end);

                    // Update Counters
                    forcedAssignmentsCount[best.staffId] = (forcedAssignmentsCount[best.staffId] || 0) + 1;
                    if (code === 'N') nightAssignmentsCount[best.staffId] = (nightAssignmentsCount[best.staffId] || 0) + 1;

                    // Remove from pool
                    const idx = unassignedStaff.findIndex(x => x.staffId === best.staffId);
                    if (idx > -1) unassignedStaff.splice(idx, 1);
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
    static createShift(staffId, dateStr, code, patternIdx, config, settings, meta = {}) {
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
            shiftType: code,
            isForced: !!meta.isForced,
            forcedReason: meta.forcedReason || null
        };
    }
}
window.RosterLogic = RosterLogic;
