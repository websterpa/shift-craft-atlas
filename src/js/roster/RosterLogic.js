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
                // Ensure we include shifts up to AND including the start date so we don't duplicate/overlap
                if (s.date <= startDateStr) {
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
                // Feature: Smart Continuity (Initial Offsets)
                // If an offset is provided for this staff, use it as the "Base Start Index". 
                // Otherwise default to staffIdx (Staggered start).
                let baseOffset = staffIdx;
                if (config.initialOffsets && typeof config.initialOffsets[staffId] === 'number') {
                    baseOffset = config.initialOffsets[staffId];
                }

                const patternIdx = (dayOffset + baseOffset) % cycleLen;
                const code = config.patternSequence[patternIdx];

                // FIX: Check for EXISTING shift on this day (Duplicate Prevention)
                // This handles cases where 'Clear Existing' is unchecked or filters fail
                if (Array.isArray(existingShifts)) {
                    const existingOnDay = existingShifts.find(s =>
                        String(s.staffId) === String(staffId) &&
                        s.date === dateStr
                    );

                    if (existingOnDay) {
                        // Mark as assigned (if it matches a requirement code)
                        const type = existingOnDay.shiftType || existingOnDay.type || 'Custom';
                        if (dayRequirements[type] !== undefined) {
                            assignedToday[type] = (assignedToday[type] || 0) + 1;
                        }

                        // Update safety map
                        lastAssignmentMap[String(staffId)] = RosterLogic.calculateEndTime(existingOnDay.date, existingOnDay.start, existingOnDay.end);

                        // SKIP generation for this staff on this day
                        return;
                    }
                }

                if (code !== 'R') {
                    const required = dayRequirements[code] || 0;

                    // Proposed Shift (Pass 1 - Natural)
                    const tempShift = RosterLogic.createShift(staffId, dateStr, code, patternIdx, config, settings, { isForced: false });
                    const safe = RosterLogic.checkRestSafety(staffId, tempShift, lastAssignmentMap, settings);

                    if (!safe.allowed) {
                        RosterLogic.shortfalls.push({ date: dateStr, staffId, targetShift: code, reason: safe.reason });
                        unassignedStaff.push({ staffId, patternIdx });
                    } else if (assignedToday[code] < required) {
                        shifts.push(tempShift);
                        assignedToday[code]++;
                        lastAssignmentMap[String(staffId)] = RosterLogic.calculateEndTime(tempShift.date, tempShift.start, tempShift.end);
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
                        const result = RosterLogic.checkRestSafety(c.staffId, tempShift, lastAssignmentMap, settings);
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
                    lastAssignmentMap[String(best.staffId)] = RosterLogic.calculateEndTime(best.tempShift.date, best.tempShift.start, best.tempShift.end);

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
     * Uses integer comparison to strictly detect midnight crossings
     */
    static calculateEndTime(dateStr, startStr, endStr) {
        const [sh, sm] = startStr.split(':').map(Number);
        const [eh, em] = endStr.split(':').map(Number);

        const end = new Date(`${dateStr}T${endStr}`);

        // Strict Integer Check: If End Hour is less than Start Hour, it crossed midnight.
        // Or if hours equal and end minute is less/equal (e.g. 24h shift).
        if (eh < sh || (eh === sh && em <= sm)) {
            end.setDate(end.getDate() + 1);
        }
        return end;
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

if (typeof module !== 'undefined') {
    module.exports = { RosterLogic };
}
if (typeof window !== 'undefined') {
    window.RosterLogic = RosterLogic;
}
