
/**
 * AbsenceStore
 * Manages storage and retrieval of absence data in localStorage.
 * Adapts the SQL schema from requirements to client-side storage.
 */
class AbsenceStore {
    constructor(app) {
        this.app = app;
        this.STORAGE_KEY_TYPES = 'shiftcraft_absence_types';
        this.STORAGE_KEY_ABSENCES = 'shiftcraft_absences';
        this.init();
    }

    init() {
        if (!localStorage.getItem(this.STORAGE_KEY_TYPES)) {
            this.seedDefaultTypes();
        }
    }

    seedDefaultTypes() {
        // Schema: id, site_id, code, label, paid, deducts_entitlement, allow_partial, active, created_at
        const defaultTypes = [
            {
                id: crypto.randomUUID(),
                site_id: 'default-site',
                code: 'ANNUAL_LEAVE',
                label: 'Annual Leave',
                paid: true,
                deducts_entitlement: true,
                allow_partial: true,
                active: true,
                created_at: new Date().toISOString()
            },
            {
                id: crypto.randomUUID(),
                site_id: 'default-site',
                code: 'SICK',
                label: 'Sickness',
                paid: true,
                deducts_entitlement: false,
                allow_partial: true,
                active: true,
                created_at: new Date().toISOString()
            },
            {
                id: crypto.randomUUID(),
                site_id: 'default-site',
                code: 'TRAINING',
                label: 'Training',
                paid: true,
                deducts_entitlement: false,
                allow_partial: true,
                active: true,
                created_at: new Date().toISOString()
            },
            {
                id: crypto.randomUUID(),
                site_id: 'default-site',
                code: 'UNPAID',
                label: 'Unpaid Leave',
                paid: false,
                deducts_entitlement: false,
                allow_partial: true,
                active: true,
                created_at: new Date().toISOString()
            }
        ];
        localStorage.setItem(this.STORAGE_KEY_TYPES, JSON.stringify(defaultTypes));
        console.log('[AbsenceStore] Seeded default absence types.');
    }

    getTypes() {
        try {
            return JSON.parse(localStorage.getItem(this.STORAGE_KEY_TYPES) || '[]');
        } catch (e) {
            console.error('Failed to parse absence types', e);
            return [];
        }
    }

    getActiveTypes() {
        return this.getTypes().filter(t => t.active);
    }

    // Schema: id, site_id, staff_id, type_id, start_ts, end_ts
    addAbsence(staffId, typeId, startTs, endTs) {
        if (!staffId || !typeId || !startTs || !endTs) {
            throw new Error('Missing required fields for absence');
        }

        const record = {
            id: crypto.randomUUID(),
            site_id: 'default-site',
            staff_id: staffId,
            type_id: typeId,
            start_ts: startTs, // ISO string
            end_ts: endTs,     // ISO string
            created_at: new Date().toISOString()
        };

        const absences = this.getAllAbsences();
        absences.push(record);
        this.saveAbsences(absences);
        return record;
    }

    getAllAbsences() {
        try {
            return JSON.parse(localStorage.getItem(this.STORAGE_KEY_ABSENCES) || '[]');
        } catch (e) {
            console.error('Failed to parse absences', e);
            return [];
        }
    }

    getAbsencesForStaff(staffId) {
        return this.getAllAbsences().filter(a => a.staff_id === staffId);
    }

    getAbsencesInRange(startIso, endIso) {
        const start = new Date(startIso).getTime();
        const end = new Date(endIso).getTime();

        return this.getAllAbsences().filter(a => {
            const aStart = new Date(a.start_ts).getTime();
            const aEnd = new Date(a.end_ts).getTime();
            // Check overlap
            return (aStart < end && aEnd > start);
        });
    }

    saveAbsences(absences) {
        localStorage.setItem(this.STORAGE_KEY_ABSENCES, JSON.stringify(absences));
    }

    // Helper to get type details for an absence
    populateAbsence(absence) {
        const types = this.getTypes();
        const typeDef = types.find(t => t.id === absence.type_id);
        return { ...absence, type: typeDef };
    }
}

// Export for global usage pattern in this app
window.AbsenceStore = AbsenceStore;
