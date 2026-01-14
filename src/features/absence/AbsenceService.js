
/**
 * AbsenceService
 * Orchestrates absence requests and their impact on the roster (vacating/backfilling).
 */
class AbsenceService {
    constructor(app) {
        this.app = app;
        this.store = app.absenceStore;
    }

    listTypes(siteId) {
        // Site ID filtering not fully implemented in Store yet, returning all
        return this.store.getActiveTypes();
    }

    requestAbsence({ staffId, typeId, start, end, notes }) {
        if (!staffId || !typeId || !start || !end) {
            throw new Error('Missing fields for absence request');
        }
        // Persist to store
        // start/end expected as ISO strings
        const record = this.store.addAbsence(staffId, typeId, start, end);
        console.log(`[AbsenceService] Requested absence for ${staffId} (${start} - ${end})`);
        return record;
    }

    approveAbsence(absenceId, approverId) {
        console.log(`[AbsenceService] Approving absence ${absenceId} by ${approverId}`);
        const absences = this.store.getAllAbsences();
        const absence = absences.find(a => a.id === absenceId);

        if (!absence) throw new Error('Absence not found');

        // 1. Find Overlapping Shifts
        const absStart = new Date(absence.start_ts).getTime();
        const absEnd = new Date(absence.end_ts).getTime();

        const affectedShifts = this.app.shifts.filter(s => {
            if (s.staffId !== absence.staff_id) return false;

            // Reconstruct full dates for shift start/end
            // Helper needed if shifts only have HH:MM and Date string
            // For MVP, assuming s.date is YYYY-MM-DD
            if (!this.app.timeRangeHelper) {
                // Fallback or use global TimeRange if available
                this.app.timeRangeHelper = window.TimeRange;
            }

            const tr = this.app.timeRangeHelper.rangeFromDateAndHm(s.date, s.start, s.end);
            const sStart = tr.start.getTime();
            const sEnd = tr.end.getTime();

            // Overlap check
            return (sStart < absEnd && sEnd > absStart);
        });

        console.log(`[AbsenceService] Found ${affectedShifts.length} overlapping shifts to vacate.`);

        affectedShifts.forEach(shift => {
            console.log(`  - Vacating shift ${shift.id} (${shift.date} ${shift.start}-${shift.end})`);

            // 2. Vacate
            const originalStaffId = shift.staffId;
            shift.staffId = null;
            shift.vacant = true;
            shift.originalStaffId = originalStaffId; // Audit trail
            shift.absenceId = absenceId;

            // 3. Attempt Backfill
            if (this.app.allocationEngine) {
                console.log('    Attempting backfill...');
                // We need to exclude the absent person from candidates
                const excludeIds = [originalStaffId];

                // Use date string for allocation engine
                const candidate = this.app.allocationEngine.findBestCandidate(
                    shift.date,
                    shift.start,
                    shift.end,
                    excludeIds
                );

                if (candidate) {
                    console.log(`    ✅ Backfilled with ${candidate.name}`);
                    shift.staffId = candidate.id;
                    shift.vacant = false;
                    shift.backfilled = true;
                } else {
                    console.log('    ⚠️ No backfill candidate found. Leaving vacant.');
                }
            }
        });

        // 4. Persistence & Render
        this.app.saveToStorage(); // Persist changes to shifts
        if (this.app.renderTableBody) {
            this.app.renderTableBody();
        }

        return { success: true, affected: affectedShifts.length };
    }
}

// Global Export
window.AbsenceService = AbsenceService;
