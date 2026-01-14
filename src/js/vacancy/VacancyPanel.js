
/**
 * VacancyPanel
 * Drawer component to list and backfill vacancies.
 */
class VacancyPanel {
    constructor(app) {
        this.app = app;
        this.panelId = 'vacancy-panel';
        this.init();
    }

    init() {
        this.injectPanel();
        this.bindEvents();
    }

    injectPanel() {
        if (document.getElementById(this.panelId)) return;

        const html = `
            <div class="panel-overlay" id="vacancy-overlay"></div>
            <div id="${this.panelId}" class="right-panel">
                <div class="panel-header">
                    <div class="panel-title">
                        <i data-lucide="alert-circle" style="color:var(--accent-rose)"></i> Vacancies
                    </div>
                    <button class="btn btn-outline btn-icon close-panel-btn">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <div class="panel-content" id="vacancy-list">
                    <!-- Dynamic Content -->
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
    }

    bindEvents() {
        // Close Button
        const closeBtn = document.querySelector(`#${this.panelId} .close-panel-btn`);
        if (closeBtn) closeBtn.onclick = () => this.close();

        // Overlay Click
        const overlay = document.getElementById('vacancy-overlay');
        if (overlay) overlay.onclick = () => this.close();
    }

    open() {
        const panel = document.getElementById(this.panelId);
        const overlay = document.getElementById('vacancy-overlay');

        this.renderVacancies();

        if (panel) panel.classList.add('open');
        if (overlay) overlay.classList.add('visible');
    }

    close() {
        const panel = document.getElementById(this.panelId);
        const overlay = document.getElementById('vacancy-overlay');

        if (panel) panel.classList.remove('open');
        if (overlay) overlay.classList.remove('visible');
    }

    renderVacancies() {
        const container = document.getElementById('vacancy-list');
        if (!container) return;

        container.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-muted);">Loading...</div>';

        // Get meaningful date range (View Month or Current Month)
        let year, month;
        if (this.app.monthlyRosterView && this.app.monthlyRosterView.currentMonth) {
            year = this.app.monthlyRosterView.currentMonth.getFullYear();
            month = this.app.monthlyRosterView.currentMonth.getMonth();
        } else {
            const now = new Date();
            year = now.getFullYear();
            month = now.getMonth();
        }

        const startDate = new Date(year, month, 1).toISOString().split('T')[0];
        const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

        // Find Vacancies
        const vacancies = this.app.shifts.filter(s =>
            s.vacant === true &&
            s.date >= startDate &&
            s.date <= endDate
        ).sort((a, b) => a.date.localeCompare(b.date));

        if (vacancies.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:3rem 1rem; color:var(--text-muted);">
                    <i data-lucide="check-circle" style="width:48px;height:48px; color:var(--accent-emerald); margin-bottom:1rem;"></i>
                    <p>No vacancies found for this month.</p>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        let html = '';
        vacancies.forEach(vac => {
            const dateObj = new Date(vac.date);
            const dateStr = dateObj.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

            // Try to find role
            let roleLabel = 'Any Role';

            html += `
                <div class="vacancy-card" id="vac-card-${vac.id}">
                    <div class="vacancy-details">
                        <div class="vac-date">${dateStr}</div>
                        <div class="vac-role">Shift ID: ${vac.id.substring(0, 6)}...</div>
                        <div class="vac-time">
                            <i data-lucide="clock" style="width:14px;height:14px;"></i>
                            ${vac.start} - ${vac.end}
                        </div>
                    </div>
                    <button class="btn btn-primary btn-sm" style="width:100%" onclick="window.app.vacancyPanel.handleSuggest('${vac.id}')">
                        <i data-lucide="sparkles" style="width:14px;height:14px;"></i> Suggest Replacement
                    </button>
                </div>
            `;
        });

        container.innerHTML = html;
        if (window.lucide) window.lucide.createIcons();
    }

    handleSuggest(shiftId) {
        const shift = this.app.shifts.find(s => s.id === shiftId);
        if (!shift) return;

        this.app.showToast('Searching for candidates...', 'search');

        // Use AllocationEngine
        const candidate = this.app.allocationEngine.findBestCandidate(shift, this.app.shifts);

        if (candidate) {
            // Assign
            shift.staffId = candidate.id;
            shift.vacant = false;
            shift.backfilled = true;

            // Save & Render
            this.app.saveToStorage();
            this.app.renderTableBody();
            if (this.app.monthlyRosterView) this.app.monthlyRosterView.renderCalendar();

            this.app.showToast(`Assigned to ${candidate.name}`, 'check-circle');

            // Remove card with animation
            const card = document.getElementById(`vac-card-${shiftId}`);
            if (card) {
                card.style.opacity = '0';
                card.style.transform = 'translateX(20px)';
                setTimeout(() => this.renderVacancies(), 300);
            }
        } else {
            this.app.showToast('No suitable candidate found.', 'alert-circle');
        }
    }
}

// Global Export
window.VacancyPanel = VacancyPanel;
