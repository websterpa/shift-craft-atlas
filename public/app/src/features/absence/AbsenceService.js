
/**
 * AbsenceService
 * Orchestrates absence requests and their impact on the roster (vacating/backfilling).
 */
class AbsenceService {
    constructor(app) {
        this.app = app;
        this.store = app.absenceStore;
    }

    async listTypes(siteId) {
        return await this.store.getActiveTypes();
    }

    async requestAbsence({ staffId, typeId, start, end, notes }) {
        if (!staffId || !typeId || !start || !end) {
            throw new Error('Missing fields for absence request');
        }
        const record = await this.store.addAbsence(staffId, typeId, start, end);
        console.log(`[AbsenceService] Requested absence for ${staffId} (${start} - ${end})`);
        return record;
    }

    async approveAbsence(absenceId, approverId) {
        console.log(`[AbsenceService] Approving absence ${absenceId} by ${approverId}`);
        const absences = await this.store.getAllAbsences();
        const absence = absences.find(a => a.id === absenceId);

        if (!absence) throw new Error('Absence not found');

        // Core Action: Vacate shifts
        const vacateAction = async () => {
            // 1. Find Overlapping Shifts via Repo
            const absStart = new Date(absence.start_ts).getTime();
            const absEnd = new Date(absence.end_ts).getTime();

            // Derive target months to fetch
            const rangeStart = new Date(absence.start_ts);
            const rangeEnd = new Date(absence.end_ts);
            const months = new Set();

            // Loop from Start Month to End Month
            let current = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
            while (current <= rangeEnd) {
                const mStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
                months.add(mStr);
                current.setMonth(current.getMonth() + 1);
            }

            let allUpdatedRows = [];

            // console.log('[Debug] Months:', Array.from(months));

            for (const month of months) {
                // Must act on the active version
                const rows = await this.app.repo.loadAssignments({
                    month,
                    versionId: this.app.activeVersionId
                });

                const targetRows = rows.filter(r => {
                    const rStaffId = r.staff_id || r.staffId;
                    // console.log(`[Debug] Checking row ${r.id}: rStaffId=${rStaffId}, absId=${absence.staff_id}`);
                    if (rStaffId !== absence.staff_id) return false;

                    const tr = window.TimeRange.rangeFromDateAndHm(r.date, r.start, r.end);
                    const rStart = tr.start.getTime();
                    const rEnd = tr.end.getTime();
                    // console.log(`[Debug] Time check: ${rStart} < ${absEnd} && ${rEnd} > ${absStart}`);
                    return (rStart < absEnd && rEnd > absStart);
                });

                if (targetRows.length > 0) {
                    targetRows.forEach(row => {
                        console.log(`[AbsenceService] Vacating shift ${row.id} (${row.date})`);
                        // Vacate Logic (Unified)
                        row.staff_id = null;
                        row.staffId = null; // Legacy sync
                        row.status = 'vacant';
                        row.absence_id = absenceId;
                    });
                    allUpdatedRows.push(...targetRows);
                }
            }

            if (allUpdatedRows.length > 0) {
                await this.app.repo.saveAssignments(allUpdatedRows);

                // Update in-memory store if used for rendering
                // (Optional if UI reloads, but good for reactivity)
                allUpdatedRows.forEach(updated => {
                    const idx = this.app.shifts.findIndex(s => s.id === updated.id);
                    if (idx !== -1) {
                        this.app.shifts[idx] = updated;
                    }
                });
            }

            console.log(`[AbsenceService] Vacated ${allUpdatedRows.length} shifts.`);

            // 4. Render
            if (this.app.renderTableBody) this.app.renderTableBody();

            // 5. Audit Log (Structured)
            if (this.app.auditLog) {
                this.app.auditLog.log(
                    'ABSENCE_APPROVED',
                    `Approved absence for staff ${absence.staff_id}`,
                    approverId || 'Manager',
                    {
                        entityType: 'absence',
                        entityId: absenceId,
                        after: absence, // Log the absence record state
                        reason: 'Vacated ' + allUpdatedRows.length + ' shifts'
                    }
                );
            }

            return { affected: allUpdatedRows.length };
        };

        // Execution Strategy: Guarded or Direct
        if (this.app.publishManager && typeof this.app.publishManager.checkGuard === 'function') {
            console.log('[AbsenceService] Executing via PublishManager guard');
            const success = await this.app.publishManager.checkGuard(absence.start_ts, vacateAction);
            return { success, affected: success ? 1 : 0 }; // '1' matches existing contract for "something happened"
        } else {
            console.log('[AbsenceService] Executing direction (No Guard)');
            const result = await vacateAction();
            return { success: true, affected: result.affected };
        }
    }
}


// Global Export
window.AbsenceService = AbsenceService;
