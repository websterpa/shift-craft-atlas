/**
 * Shift Craft - Repository Layer
 * Decouples UI from persistence implementation.
 */

class LocalRepository {
    constructor(storageKeys) {
        this.keys = storageKeys;
    }

    // Assignments
    async loadAssignments({ month, versionId }) {
        const allShifts = JSON.parse(localStorage.getItem(this.keys.SHIFTS) || '[]');
        if (versionId) {
            return allShifts.filter(s => s.versionId === versionId);
        }
        if (month) {
            return allShifts.filter(s => s.date.startsWith(month));
        }
        return allShifts;
    }

    async saveAssignments(rows) {
        // In local mode, we usually overwrite the whole set or merge
        // For simplicity in this MVP, we'll follow the existing app.js behavior (save all)
        localStorage.setItem(this.keys.SHIFTS, JSON.stringify(rows));
    }

    // Staff
    async loadStaff({ siteId }) {
        return JSON.parse(localStorage.getItem(this.keys.STAFF) || '[]');
    }

    // Absences
    async loadAbsences({ siteId, range }) {
        const absences = JSON.parse(localStorage.getItem('shiftcraft_absences') || '[]');
        if (range) {
            const start = new Date(range.start).getTime();
            const end = new Date(range.end).getTime();
            return absences.filter(a => {
                const aStart = new Date(a.start_ts).getTime();
                const aEnd = new Date(a.end_ts).getTime();
                return (aStart < end && aEnd > start);
            });
        }
        return absences;
    }

    async saveAbsence(record) {
        const absences = JSON.parse(localStorage.getItem('shiftcraft_absences') || '[]');
        const idx = absences.findIndex(a => a.id === record.id);
        if (idx >= 0) {
            absences[idx] = record;
        } else {
            absences.push(record);
        }
        localStorage.setItem('shiftcraft_absences', JSON.stringify(absences));
    }

    async loadAbsenceTypes({ siteId }) {
        return JSON.parse(localStorage.getItem('shiftcraft_absence_types') || '[]');
    }

    async saveAbsenceTypes(types) {
        localStorage.setItem('shiftcraft_absence_types', JSON.stringify(types));
    }

    // Config / Settings
    async loadConfig({ versionId }) {
        return JSON.parse(localStorage.getItem(this.keys.SETTINGS) || '{}');
    }

    async saveConfig(config) {
        localStorage.setItem(this.keys.SETTINGS, JSON.stringify(config));
    }

    async loadWizardSession() {
        return JSON.parse(localStorage.getItem('shiftcraft_wizard_last_run') || 'null');
    }

    async saveWizardSession(session) {
        localStorage.setItem('shiftcraft_wizard_last_run', JSON.stringify(session));
    }

    async loadMyPatterns() {
        return JSON.parse(localStorage.getItem('shiftcraft_my_patterns') || '[]');
    }

    async saveMyPatterns(patterns) {
        localStorage.setItem('shiftcraft_my_patterns', JSON.stringify(patterns));
    }
}

class SupabaseRepository {
    constructor(client) {
        this.supabase = client;
    }

    async loadAssignments({ month, versionId }) {
        if (!this.supabase) return [];
        let query = this.supabase.from('shifts').select('*');
        if (versionId) query = query.eq('version_id', versionId);
        if (month) query = query.ilike('date', `${month}%`);

        const { data, error } = await query;
        if (error) throw error;
        // Map back to app format if needed (e.g., shift_code -> shiftType)
        return data.map(s => ({
            ...s,
            shiftType: s.shift_code || s.shiftType
        }));
    }

    async saveAssignments(rows) {
        if (!this.supabase) return;
        // Upsert logic for Supabase
        const dbRows = rows.map(r => ({
            ...r,
            shift_code: r.shiftType || r.shift_code
        }));
        const { error } = await this.supabase.from('shifts').upsert(dbRows);
        if (error) throw error;
    }

    async loadStaff({ siteId }) {
        if (!this.supabase) return [];
        const { data, error } = await this.supabase.from('staff').select('*').eq('site_id', siteId || 'default');
        if (error) throw error;
        return data;
    }

    async loadAbsences({ siteId, range }) {
        if (!this.supabase) return [];
        let query = this.supabase.from('absences').select('*').eq('site_id', siteId || 'default');
        if (range) {
            query = query.gte('end_ts', range.start).lte('start_ts', range.end);
        }
        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    async saveAbsence(record) {
        if (!this.supabase) return;
        const { error } = await this.supabase.from('absences').upsert(record);
        if (error) throw error;
    }

    async loadAbsenceTypes({ siteId }) {
        if (!this.supabase) return [];
        const { data, error } = await this.supabase.from('absence_types').select('*').eq('site_id', siteId || 'default');
        if (error) throw error;
        return data;
    }

    async saveAbsenceTypes(types) {
        if (!this.supabase) return;
        const { error } = await this.supabase.from('absence_types').upsert(types);
        if (error) throw error;
    }

    async loadConfig({ versionId }) {
        if (!this.supabase) return {};
        // Config might be in a 'settings' or 'rosters' table
        const { data, error } = await this.supabase.from('settings').select('*').single();
        if (error) return {};
        return data.config || data;
    }

    async saveConfig(config) {
        if (!this.supabase) return;
        const { error } = await this.supabase.from('settings').upsert({ config });
        if (error) throw error;
    }

    async loadWizardSession() {
        if (!this.supabase) return null;
        const { data, error } = await this.supabase.from('wizard_sessions').select('*').single();
        if (error) return null;
        return data.session;
    }

    async saveWizardSession(session) {
        if (!this.supabase) return;
        await this.supabase.from('wizard_sessions').upsert({ session });
    }

    async loadMyPatterns() {
        if (!this.supabase) return [];
        const { data, error } = await this.supabase.from('patterns').select('*').eq('is_custom', true);
        if (error) throw error;
        return data;
    }

    async saveMyPatterns(patterns) {
        if (!this.supabase) return;
        await this.supabase.from('patterns').upsert(patterns);
    }
}

// Factory / Export logic
window.Repository = {
    create: (type, options = {}) => {
        if (type === 'supabase') {
            return new SupabaseRepository(window.supabase);
        }
        return new LocalRepository(options.keys || {
            STAFF: 'shiftcraft_staff',
            SHIFTS: 'shiftcraft_shifts',
            SETTINGS: 'shiftcraft_settings'
        });
    }
};
