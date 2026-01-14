/**
 * ShiftTemplates - Handles reusable shift templates and bulk assignment
 * Allows users to save common shift configurations and apply them quickly
 */
class ShiftTemplates {
    constructor(app) {
        this.app = app;
        this.templates = JSON.parse(localStorage.getItem('shiftcraft_templates')) || [];
        this.init();
    }

    save() {
        localStorage.setItem('shiftcraft_templates', JSON.stringify(this.templates));
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        // Save Template Button
        // Save Template Button
        // const saveBtn = document.getElementById('save-template-btn');
        // if (saveBtn) saveBtn.onclick = () => this.showSaveModal();

        // Apply Template Button
        const applyBtn = document.getElementById('apply-template-btn');
        if (applyBtn) applyBtn.onclick = () => this.showApplyModal();

        // Template Modal Close
        const closeBtn = document.getElementById('close-template-modal');
        if (closeBtn) closeBtn.onclick = () => this.hideModal();

        // Save Template Form
        const form = document.getElementById('template-form');
        if (form) form.onsubmit = (e) => { e.preventDefault(); this.saveTemplate(); };

        // Apply Template Confirm
        const confirmBtn = document.getElementById('confirm-apply-template');
        if (confirmBtn) confirmBtn.onclick = () => this.applySelectedTemplate();
    }

    showSaveModal() {
        const modal = document.getElementById('template-modal');
        if (!modal) return;

        document.getElementById('template-modal-title').textContent = 'Save Shift Template';
        document.getElementById('template-form').style.display = 'block';
        document.getElementById('apply-template-section').style.display = 'none';

        modal.classList.add('active');
    }

    showApplyModal() {
        const modal = document.getElementById('template-modal');
        if (!modal) return;

        document.getElementById('template-modal-title').textContent = 'Apply Shift Template';
        document.getElementById('template-form').style.display = 'none';
        document.getElementById('apply-template-section').style.display = 'block';

        this.renderTemplateList();
        this.renderStaffCheckboxes();

        modal.classList.add('active');
    }

    hideModal() {
        const modal = document.getElementById('template-modal');
        if (modal) modal.classList.remove('active');
    }

    saveTemplate() {
        const name = document.getElementById('template-name').value.trim();
        const start = document.getElementById('template-start').value;
        const end = document.getElementById('template-end').value;
        const days = Array.from(document.querySelectorAll('.template-day-checkbox:checked')).map(cb => parseInt(cb.value));

        if (!name || !start || !end || days.length === 0) {
            this.app.showToast('Please complete all fields', 'alert-circle');
            return;
        }

        const template = {
            id: 'tpl-' + Date.now(),
            name,
            start,
            end,
            days // Array of day indices (0=Mon, 6=Sun)
        };

        this.templates.push(template);
        localStorage.setItem('shiftcraft_templates', JSON.stringify(this.templates));

        this.app.showToast(`Template "${name}" saved`, 'check-circle');
        this.hideModal();
        document.getElementById('template-form').reset();
    }

    renderTemplateList() {
        const select = document.getElementById('template-select');
        if (!select) return;

        select.innerHTML = '<option value="">-- Select Template --</option>';
        this.templates.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = `${t.name} (${t.start}-${t.end})`;
            select.appendChild(opt);
        });
    }

    renderStaffCheckboxes() {
        const container = document.getElementById('staff-checkbox-list');
        if (!container) return;

        container.innerHTML = '';
        this.app.staff.forEach(s => {
            const label = document.createElement('label');
            label.style.display = 'flex';
            label.style.alignItems = 'center';
            label.style.gap = '0.5rem';
            label.style.marginBottom = '0.5rem';
            label.innerHTML = `
                <input type="checkbox" class="staff-apply-checkbox" value="${s.id}">
                <span style="background: ${s.color}33; color: ${s.color}; padding: 0.25rem 0.5rem; border-radius: 4px;">${s.name}</span>
            `;
            container.appendChild(label);
        });

        // Select All / Deselect All
        const allBtn = document.getElementById('select-all-staff');
        if (allBtn) allBtn.onclick = () => {
            container.querySelectorAll('input').forEach(cb => cb.checked = true);
        };
    }

    applySelectedTemplate() {
        const templateId = document.getElementById('template-select').value;
        const template = this.templates.find(t => t.id === templateId);

        if (!template) {
            this.app.showToast('Please select a template', 'alert-circle');
            return;
        }

        const staffIds = Array.from(document.querySelectorAll('.staff-apply-checkbox:checked')).map(cb => cb.value);

        if (staffIds.length === 0) {
            this.app.showToast('Please select at least one staff member', 'alert-circle');
            return;
        }

        let shiftsCreated = 0;

        staffIds.forEach(staffId => {
            template.days.forEach(dayIndex => {
                const d = new Date(this.app.weekStart);
                d.setDate(d.getDate() + dayIndex);
                const dateStr = d.toISOString().split('T')[0];

                // Check for existing shift at this time
                const exists = this.app.shifts.some(s =>
                    s.staffId === staffId &&
                    s.date === dateStr &&
                    s.start === template.start &&
                    s.end === template.end
                );

                if (!exists) {
                    this.app.shifts.push({
                        id: 'shift-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                        staffId,
                        date: dateStr,
                        start: template.start,
                        end: template.end
                    });
                    shiftsCreated++;
                }
            });
        });

        this.app.saveToStorage();
        this.app.renderTableBody();
        this.app.updateStats();

        this.app.showToast(`${shiftsCreated} shifts created from template`, 'check-circle');
        this.hideModal();
    }

    deleteTemplate(templateId) {
        this.templates = this.templates.filter(t => t.id !== templateId);
        localStorage.setItem('shiftcraft_templates', JSON.stringify(this.templates));
        this.renderTemplateList();
        this.app.showToast('Template deleted', 'trash-2');
    }
}

window.ShiftTemplates = ShiftTemplates;
