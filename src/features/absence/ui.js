
/**
 * AbsenceUI
 * Controller for the Absence Management Modal.
 * Prompts 6: Manager UI for recording and approving absences in one step.
 */
class AbsenceUI {
    constructor(app) {
        this.app = app;
        this.modalId = 'absence-modal';
        this.init();
    }

    init() {
        this.injectModal();
        this.bindEvents();
    }

    injectModal() {
        if (document.getElementById(this.modalId)) return;

        const html = `
            <div id="${this.modalId}" class="modal-overlay" style="display:none; backdrop-filter: blur(8px); background: rgba(0,0,0,0.4);">
                <div class="modal" style="max-width: 500px; border: 1px solid var(--glass-border); background: var(--glass-bg); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
                    <div class="modal-header" style="border-bottom: 1px solid var(--glass-border); padding: 1.5rem;">
                        <h2 style="display: flex; align-items: center; gap: 0.75rem; font-size: 1.25rem;">
                            <i data-lucide="calendar-off" style="color: var(--accent-amber);"></i>
                            Record Absence
                        </h2>
                        <button class="close-modal-btn btn btn-icon btn-outline" data-target="${this.modalId}" style="border:none;">
                            <i data-lucide="x"></i>
                        </button>
                    </div>
                    <div class="modal-body" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem;">
                        <div class="form-group">
                            <label class="wizard-label" style="margin-bottom: 0.5rem; display: block; font-weight: 600; font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Staff Member</label>
                            <select id="abs-staff-select" class="form-control" style="width: 100%; border-radius: 8px; border: 1px solid var(--glass-border); background: rgba(255,255,255,0.05); color: var(--text-main); height: 3rem;"></select>
                        </div>
                        <div class="form-group">
                            <label class="wizard-label" style="margin-bottom: 0.5rem; display: block; font-weight: 600; font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Absence Type</label>
                            <select id="abs-type-select" class="form-control" style="width: 100%; border-radius: 8px; border: 1px solid var(--glass-border); background: rgba(255,255,255,0.05); color: var(--text-main); height: 3rem;"></select>
                        </div>
                        <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div class="form-group">
                                <label class="wizard-label" style="margin-bottom: 0.5rem; display: block; font-weight: 600; font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Start Date & Time</label>
                                <input type="datetime-local" id="abs-start" class="form-control" style="width: 100%; border-radius: 8px; border: 1px solid var(--glass-border); background: rgba(255,255,255,0.05); color: var(--text-main); height: 3rem;">
                            </div>
                            <div class="form-group">
                                <label class="wizard-label" style="margin-bottom: 0.5rem; display: block; font-weight: 600; font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">End Date & Time</label>
                                <input type="datetime-local" id="abs-end" class="form-control" style="width: 100%; border-radius: 8px; border: 1px solid var(--glass-border); background: rgba(255,255,255,0.05); color: var(--text-main); height: 3rem;">
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="wizard-label" style="margin-bottom: 0.5rem; display: block; font-weight: 600; font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Notes (Optional)</label>
                            <textarea id="abs-notes" class="form-control" rows="3" placeholder="Add any relevant details..." style="width: 100%; border-radius: 8px; border: 1px solid var(--glass-border); background: rgba(255,255,255,0.05); color: var(--text-main); padding: 0.75rem; resize: none;"></textarea>
                        </div>
                    </div>
                    <div class="modal-footer" style="padding: 1.5rem; border-top: 1px solid var(--glass-border); display: flex; justify-content: flex-end; gap: 1rem;">
                        <button class="btn btn-outline close-modal-btn" data-target="${this.modalId}" style="height: 3rem; padding: 0 1.5rem; border-radius: 8px;">Cancel</button>
                        <button class="btn btn-primary" id="abs-submit-btn" style="height: 3rem; padding: 0 2rem; border-radius: 8px; background: var(--accent-amber); border-color: var(--accent-amber); color: #000; font-weight: 700;">Approve & Apply</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        if (window.lucide) window.lucide.createIcons();
    }

    bindEvents() {
        // Global Close Handlers
        document.querySelectorAll(`.close-modal-btn[data-target="${this.modalId}"]`).forEach(btn => {
            btn.onclick = () => this.close();
        });

        // Submit
        const submitBtn = document.getElementById('abs-submit-btn');
        if (submitBtn) submitBtn.onclick = () => this.handleSubmit();
    }

    async open() {
        const modal = document.getElementById(this.modalId);
        if (modal) {
            await this.populateSelects();
            modal.style.display = 'flex';
        }
    }

    close() {
        const modal = document.getElementById(this.modalId);
        if (modal) modal.style.display = 'none';
    }

    async populateSelects() {
        // Staff
        const staffSelect = document.getElementById('abs-staff-select');
        staffSelect.innerHTML = '<option value="">Select Staff Member...</option>' +
            this.app.staff
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(s => `<option value="${s.id}">${s.name}</option>`).join('');

        // Types
        const typeSelect = document.getElementById('abs-type-select');
        const types = await this.app.absenceService.listTypes();
        typeSelect.innerHTML = types.map(t => `<option value="${t.id}">${t.label}</option>`).join('');
    }

    async handleSubmit() {
        const submitBtn = document.getElementById('abs-submit-btn');
        const originalText = submitBtn.innerHTML;

        try {
            const staffId = document.getElementById('abs-staff-select').value;
            const typeId = document.getElementById('abs-type-select').value;
            const start = document.getElementById('abs-start').value;
            const end = document.getElementById('abs-end').value;
            const notes = document.getElementById('abs-notes').value;

            if (!staffId || !start || !end) {
                this.app.showToast('Please fill in required fields (Staff, Start, and End)', 'alert-circle');
                return;
            }

            // UI Feedback
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="spinner-sm"></i> Applying...';

            // 1. Request
            const startISO = new Date(start).toISOString();
            const endISO = new Date(end).toISOString();

            const request = await this.app.absenceService.requestAbsence({
                staffId,
                typeId,
                start: startISO,
                end: endISO,
                notes
            });

            // 2. Approve Immediately (Manager Mode)
            const result = await this.app.absenceService.approveAbsence(request.id, 'manager-ui');

            this.close();

            // 3. Feedback
            let msg = `Absence approved.`;
            if (result.affected > 0) msg += ` Vacated ${result.affected} shifts.`;
            this.app.showToast(msg, 'check-circle');

            // 4. Reset Form
            document.getElementById('abs-staff-select').value = '';
            document.getElementById('abs-start').value = '';
            document.getElementById('abs-end').value = '';
            document.getElementById('abs-notes').value = '';

        } catch (e) {
            console.error('[AbsenceUI] Error during submit:', e);
            this.app.showToast('Error recording absence: ' + e.message, 'alert-triangle');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }
}

// Global Export
window.AbsenceUI = AbsenceUI;
