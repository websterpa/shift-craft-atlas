
/**
 * AbsenceUI
 * Controller for the Absence Management Modal.
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
            <div id="${this.modalId}" class="modal" style="display:none;">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h2>Record Absence</h2>
                        <button class="close-modal-btn" data-target="${this.modalId}">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Staff Member</label>
                            <select id="abs-staff-select" class="form-control"></select>
                        </div>
                        <div class="form-group">
                            <label>Absence Type</label>
                            <select id="abs-type-select" class="form-control"></select>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Start Date & Time</label>
                                <input type="datetime-local" id="abs-start" class="form-control">
                            </div>
                            <div class="form-group">
                                <label>End Date & Time</label>
                                <input type="datetime-local" id="abs-end" class="form-control">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Notes (Optional)</label>
                            <textarea id="abs-notes" class="form-control" rows="3"></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline close-modal-btn" data-target="${this.modalId}">Cancel</button>
                        <button class="btn btn-primary" id="abs-submit-btn">Approve & Apply</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
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

    open() {
        const modal = document.getElementById(this.modalId);
        if (modal) {
            this.populateSelects();
            modal.style.display = 'flex';
        }
    }

    close() {
        const modal = document.getElementById(this.modalId);
        if (modal) modal.style.display = 'none';
    }

    populateSelects() {
        // Staff
        const staffSelect = document.getElementById('abs-staff-select');
        staffSelect.innerHTML = '<option value="">Select Staff...</option>' +
            this.app.staff.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

        // Types
        const typeSelect = document.getElementById('abs-type-select');
        const types = this.app.absenceService.listTypes();
        typeSelect.innerHTML = types.map(t => `<option value="${t.id}">${t.label}</option>`).join('');
    }

    async handleSubmit() {
        try {
            const staffId = document.getElementById('abs-staff-select').value;
            const typeId = document.getElementById('abs-type-select').value;
            const start = document.getElementById('abs-start').value;
            const end = document.getElementById('abs-end').value;
            const notes = document.getElementById('abs-notes').value;

            if (!staffId || !start || !end) {
                this.app.showToast('Please fill in required fields', 'alert-circle');
                return;
            }

            // 1. Request
            // Ensure full ISO strings
            const startISO = new Date(start).toISOString();
            const endISO = new Date(end).toISOString();

            const request = this.app.absenceService.requestAbsence({
                staffId,
                typeId,
                start: startISO,
                end: endISO,
                notes
            });

            // 2. Approve Immediately (Manager Mode)
            const result = this.app.absenceService.approveAbsence(request.id, 'manager-ui');

            this.close();

            // 3. Feedback
            let msg = `Absence approved.`;
            if (result.affected > 0) msg += ` Vacated ${result.affected} shifts.`;
            this.app.showToast(msg, 'check');

        } catch (e) {
            console.error(e);
            this.app.showToast('Failed to record absence: ' + e.message, 'alert-triangle');
        }
    }
}

// Global Export
window.AbsenceUI = AbsenceUI;
