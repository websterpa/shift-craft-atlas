
/**
 * AbsenceStore
 * Manages storage and retrieval of absence data in localStorage.
 * Adapts the SQL schema from requirements to client-side storage.
 */
class AbsenceStore {
    constructor(app) {
        this.app = app;
    }

    async init() {
        const types = await this.app.repo.loadAbsenceTypes({ siteId: 'default' });
        if (!types || types.length === 0) {
            await this.seedDefaultTypes();
        }
    }

    async seedDefaultTypes() {
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
        await this.app.repo.saveAbsenceTypes(defaultTypes);
        console.log('[AbsenceStore] Seeded default absence types.');
    }

    async getTypes() {
        return await this.app.repo.loadAbsenceTypes({ siteId: 'default' });
    }

    async getActiveTypes() {
        const types = await this.getTypes();
        return types.filter(t => t.active);
    }

    // Schema: id, site_id, staff_id, type_id, start_ts, end_ts
    async addAbsence(staffId, typeId, startTs, endTs) {
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

        await this.app.repo.saveAbsence(record);
        return record;
    }

    async getAllAbsences() {
        return await this.app.repo.loadAbsences({ siteId: 'default' });
    }

    async getAbsencesForStaff(staffId) {
        const all = await this.getAllAbsences();
        return all.filter(a => a.staff_id === staffId);
    }

    async getAbsencesInRange(startIso, endIso) {
        return await this.app.repo.loadAbsences({ siteId: 'default', range: { start: startIso, end: endIso } });
    }

    async saveAbsences(absences) {
        // Migration note: Supabase uses upsert for individual records, 
        // while local might overwrite the whole array.
        // For simplicity, we delegate to saveAbsence in a loop if needed, 
        // but typically we save individual records via addAbsence.
        for (const a of absences) {
            await this.app.repo.saveAbsence(a);
        }
    }

    // Helper to get type details for an absence
    async populateAbsence(absence) {
        const types = await this.getTypes();
        const typeDef = types.find(t => t.id === absence.type_id);
        return { ...absence, type: typeDef };
    }
}

// Export for global usage pattern in this app
window.AbsenceStore = AbsenceStore;
