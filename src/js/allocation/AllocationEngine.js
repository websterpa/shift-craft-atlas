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
        const eligibleStaff = this.app.staff.filter(s => !excludeStaffIds.includes(s.id));

        const candidates = eligibleStaff.map(staff => {
            const staffShifts = staffShiftMap ? staffShiftMap.get(staff.id) : null;
            const score = this.calculateSuitability(staff, date, start, end, staffShifts);
            return { staff, score };
        });

        // Filter out those who are physically/legally unable to work (Infinite score)
        const viableCandidates = candidates.filter(c => c.score < 10000);

        // Log top candidates for debugging
        if (date.includes('-12-20') || date.includes('-12-21')) { // Log weekends
            console.log(`[Allocation] Date: ${date} ${start}-${end}`);
            viableCandidates.sort((a, b) => a.score - b.score).slice(0, 5).forEach(c => {
                console.log(`  - ${c.staff.name}: Score ${c.score.toFixed(2)}`);
            });
        }

        // Sort by score (Lowest score = Best fit)
        viableCandidates.sort((a, b) => a.score - b.score);

        return viableCandidates.length > 0 ? viableCandidates[0].staff : null;
    }

    /**
     * Suitability Score Heuristic
     * 10000+ = Hard Block (WTD/Clash)
     * Negative values = High Priority (Under contracted hours)
     */
    calculateSuitability(staff, date, start, end, preFilteredStaffShifts = null) {
        let score = 0;

        // Use provided shifts or filter now if not provided
        const staffShifts = preFilteredStaffShifts || this.app.shifts.filter(s => s.staffId === staff.id);

        // 0. GLOBAL CONSTRAINTS
        if (this.app.settings.enableNights === false) {
            // Check if shift overlaps with night hours (23:00 - 06:00)
            const nightHours = this.compliance._calculateNightHours(start, end);
            if (nightHours > 0) return 10000;
        }

        if (this.app.settings.enableWeekends === false) {
            const d = new Date(date);
            const day = d.getDay(); // 0 is Sunday, 6 is Saturday
            if (day === 0 || day === 6) return 10000;
        }

        // Double booking check (Improved for Night Shifts)
        const checkStart = this._timeToMins(start);
        let checkEnd = this._timeToMins(end);
        if (checkEnd <= checkStart) checkEnd += 1440;

        const clash = staffShifts.find(s => {
            if (s.date !== date) return false;
            const sStart = this._timeToMins(s.start);
            let sEnd = this._timeToMins(s.end);
            if (sEnd <= sStart) sEnd += 1440;
            return Math.max(checkStart, sStart) < Math.min(checkEnd, sEnd);
        });
        if (clash) return 10000;

        // Daily Rest (11h)
        const restViolations = this.compliance.checkDailyRest(staff.id, this.app.shifts, [...staffShifts, { staffId: staff.id, date, start, end }]);
        if (restViolations.length > 0) return 10000;

        // 48h Weekly Limit (17-week avg)
        const weeklyLimit = this.compliance.check17WeekAverage(staff.id, this.app.shifts, staff.optOut48h, date, [...staffShifts, { staffId: staff.id, date, start, end }]);
        if (weeklyLimit) return 10000;

        // 2. CONTRACTED HOURS PRIORITY (Assess over 17 weeks)
        const avg = this.compliance.calculateRollingAverage(staff.id, this.app.shifts, date, 17, staffShifts);
        const contracted = staff.contractedHours || 40;
        const variance = avg - contracted;

        // If a person is UNDER their hours, they get a negative score (making them more attractive)
        // If they are OVER, they get a positive score penalty
        score += variance * 10;

        // 3. FAIRNESS CREDITS (Night, Weekend, PH)
        const fairnessCredits = this.compliance.calculateFairnessScore(staff.id, this.app.shifts, date, staffShifts);
        score += fairnessCredits;

        // 4. PREFERENCE: Is this a night shift?
        const nightHours = this.compliance._calculateNightHours(start, end);
        if (nightHours > 3) {
            // Apply extra weight if they've already done lots of nights recently
            // This is already included in fairnessCredits, but we could add recency bias here if needed
        }

        return score;
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

    _timeToMins(t) {
        if (!t) return 0;
        const [h, m] = t.split(':').map(Number);
        return (h * 60) + (m || 0);
    }
}

window.AllocationEngine = AllocationEngine;
