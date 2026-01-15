/**
 * Shift Craft (Atlas) Allocation Engine
 * Prioritizes staff based on 17-week contracted hours and fairness credits.
 * Treats each staff member as a "team of 1".
 */
class AllocationEngine {
    constructor(app) {
        this.app = app;
        this.compliance = app.complianceEngine;
    }

    /**
     * Finds the best candidate for a specific shift slot
     */
    findBestCandidate(date, start, end, excludeStaffIds = [], staffShiftMap = null) {
        if (typeof window !== 'undefined' && window.RosterEngine) {
            const assignment = { date, start, end };
            const eligibleStaff = this.app.staff.filter(s => !excludeStaffIds.includes(s.id));

            // Build the collective shift list for the engine
            const shifts = this.app.shifts;

            const candidates = window.RosterEngine.selectBackfillCandidates({
                assignment,
                staff: eligibleStaff,
                constraints: this.app.settings,
                shifts,
                helpers: { TimeRange: window.TimeRange, ShiftMapping: window.ShiftMapping }
            });

            return candidates.length > 0 ? candidates[0] : null;
        }

        // Fallback or Node context
        return null;
    }

    /**
     * Suitability Score Heuristic
     * 10000+ = Hard Block (WTD/Clash)
     * Negative values = High Priority (Under contracted hours)
     */
    calculateSuitability(staff, date, start, end, preFilteredStaffShifts = null) {
        if (typeof window !== 'undefined' && window.RosterEngine) {
            return window.RosterEngine.scoreCandidate({
                candidate: staff,
                assignment: { date, start, end },
                shifts: preFilteredStaffShifts || this.app.shifts,
                constraints: this.app.settings,
                helpers: { TimeRange: window.TimeRange, ShiftMapping: window.ShiftMapping }
            });
        }
        return 0;
    }

    /**
     * Auto-Generate shifts based on existing demand pattern
     */
    smartFillWeek(startDateStr) {
        // 1. Identify demand (Look at previous week's slots)
        const targetStart = new Date(startDateStr);
        const prevDates = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(targetStart);
            d.setDate(d.getDate() - 7 + i);
            prevDates.push(d.toISOString().split('T')[0]);
        }

        const demandSlotsRaw = this.app.shifts.filter(s => prevDates.includes(s.date));

        // Deduplicate demand in case source data is messy (e.g. from previous failed runs)
        // We only care about the set of shifts that were performed.
        // Also we'll record the original ID to avoid matching our own new shifts if dates overlap
        const demandSlots = demandSlotsRaw.map(s => {
            const d = new Date(s.date);
            const dayOffset = (d.getDay() + 6) % 7; // Mon=0
            return { dayOffset, start: s.start, end: s.end, shiftType: s.shiftType, originalId: s.id };
        });

        if (demandSlots.length === 0) return 0;

        let assignmentsMade = 0;
        const newShifts = [];

        // 2. Identify existing coverage in target week to prevent over-allocation (Net Deficit Fill)
        const staffShiftMap = new Map();
        this.app.staff.forEach(s => {
            staffShiftMap.set(s.id, this.app.shifts.filter(sh => sh.staffId === s.id));
        });

        for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
            const targetDate = new Date(startDateStr);
            targetDate.setDate(targetDate.getDate() + dayOffset);
            const targetDateStr = targetDate.toISOString().split('T')[0];

            // Get demand for this day from last week
            const slotsForDay = demandSlots.filter(s => s.dayOffset === dayOffset);

            // Get current assignments for this day
            const existingDayShifts = this.app.shifts.filter(s => s.date === targetDateStr);

            // Resource-First: We only fill the net deficit.
            // We group demand by shift type (using classification) to see what's actually missing.
            const demandProfile = this._getCoverageProfile(slotsForDay);
            const currentProfile = this._getCoverageProfile(existingDayShifts);
            console.log(`[SmartFill] ${targetDateStr}: Demand vs Current`, Object.keys(demandProfile), Object.keys(currentProfile));

            const netDemand = [];
            Object.keys(demandProfile).forEach(key => {
                const neededRaw = demandProfile[key].count;
                // Safety: Demand for a single shift type shouldn't exceed headcount
                const needed = Math.min(neededRaw, this.app.staff.length);
                const have = currentProfile[key]?.count || 0;
                const deficit = Math.max(0, needed - have);

                console.log(`  - ${key}: needed ${needed} (raw ${neededRaw}), have ${have}, deficit ${deficit}`);

                for (let i = 0; i < deficit; i++) {
                    netDemand.push(demandProfile[key].template);
                }
            });

            if (netDemand.length === 0) continue;

            const assignedToday = [];

            netDemand.forEach(slot => {
                const bestStaff = this.findBestCandidate(targetDateStr, slot.start, slot.end, assignedToday, staffShiftMap);
                if (bestStaff) {
                    // Final safety overlap check against shifts just added in this loop
                    const candidateClash = newShifts.find(ns => ns.staffId === bestStaff.id && ns.date === targetDateStr);
                    if (candidateClash) {
                        console.warn(`    ! Safety block: ${bestStaff.name} already assigned in this batch. skipping.`);
                        return;
                    }

                    const newShift = {
                        id: 'sh-smart-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
                        staffId: bestStaff.id,
                        date: targetDateStr,
                        start: slot.start,
                        end: slot.end
                    };

                    newShifts.push(newShift);

                    const existingShifts = staffShiftMap.get(bestStaff.id) || [];
                    staffShiftMap.set(bestStaff.id, [...existingShifts, newShift]);
                    assignedToday.push(bestStaff.id);
                    assignmentsMade++;
                }
            });
        }

        this.app.shifts = [...this.app.shifts, ...newShifts];
        this.app.saveToStorage();
        this.app.renderTableBody();
        this.app.updateStats();
        if (assignmentsMade === 0 && demandSlots.length > 0) return -1;
        return assignmentsMade;
    }

    /**
     * Helper to group a list of slots/shifts into a coverage profile
     */
    _getCoverageProfile(slots) {
        /**
         * Profile is keyed by:
         *   cssClass | start | end
         *
         * This prevents distinct shifts that share the same classified type
         * (e.g. multiple Early variants) from being collapsed.
         */
        const profile = {};

        slots.forEach(slot => {
            const info = this.app.classifyShiftType(slot);
            const type = info.cssClass || 'other';
            const start = slot.start || '';
            const end = slot.end || '';

            const key = `${type}|${start}|${end}`;

            if (!profile[key]) {
                profile[key] = {
                    type,
                    start,
                    end,
                    count: 0,
                    template: { start, end }
                };
            }

            profile[key].count++;
        });

        return profile;
    }


}

window.AllocationEngine = AllocationEngine;
