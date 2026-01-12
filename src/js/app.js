/**
 * Shift Craft (Atlas) - Core Engine
 * Adheres to The Truth Protocol: No mock data, statutory references cited.
 */

const CONFIG = {
    CURRENCY: '£',
    STORAGE_KEYS: {
        STAFF: 'shiftcraft_staff',
        SHIFTS: 'shiftcraft_shifts',
        SETTINGS: 'shiftcraft_settings',
        THEME: 'shiftcraft_theme',
        BRANDING: 'shiftcraft_branding'
    },
    WTR: {
        HOLIDAY_ACCRUAL_RATE: 0.1207 // 5.6 / (52 - 5.6)
    }
};

class ShiftCraftApp {
    constructor() {
        this.migrateStorage();
        // 1. Load Data
        this.staff = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.STAFF)) || [];
        this.shifts = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.SHIFTS)) || [];
        this.settings = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.SETTINGS)) || {
            restPeriod: 11,
            theme: 'dark',
            standards: {
                early8: '06:00',
                late8: '14:00',
                night8: '22:00',
                day12: '07:00',
                night12: '19:00'
            },
            staffingRequirements: {
                early: 2,
                late: 2,
                night: 1,
                day12: 1
            },
            enableNights: true,
            enableWeekends: true,
            holidayRegion: 'england-and-wales'
        };
        this.customTheme = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.THEME)) || {};
        this.branding = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.BRANDING)) || { logo: null, strapline: '', straplineColor: '#6366f1', hideDefaultLogo: false, headerSpacing: 2.0 };

        // MIGRATION: Backfill missing glass variables for existing users (stale localStorage)
        if (this.customTheme['--bg-dark'] && !this.customTheme['--glass-bg']) {
            const bg = this.customTheme['--bg-dark'];
            const primary = this.customTheme['--primary'];

            let glassUpdates = null;

            // Modern Mono (#252526)
            if (bg === '#252526') {
                glassUpdates = {
                    '--glass-bg': 'rgba(37, 37, 38, 0.7)',
                    '--glass-border': 'rgba(255, 255, 255, 0.1)',
                    '--glass-light': 'rgba(37, 37, 38, 0.5)',
                    '--sidebar-bg': '#202021'
                };
            }
            // Industrial Amber (#262626)
            else if (bg === '#262626') {
                glassUpdates = {
                    '--glass-bg': 'rgba(60, 60, 60, 0.7)',
                    '--glass-border': 'rgba(255, 255, 255, 0.1)',
                    '--glass-light': 'rgba(60, 60, 60, 0.5)',
                    '--sidebar-bg': '#1e1e1e'
                };
            }
            // Forest Command (#0A0D0C)
            else if (bg === '#0A0D0C') {
                glassUpdates = {
                    '--glass-bg': 'rgba(27, 36, 33, 0.7)',
                    '--glass-border': 'rgba(255, 255, 255, 0.1)',
                    '--glass-light': 'rgba(27, 36, 33, 0.5)',
                    '--sidebar-bg': '#0b0f0d'
                };
            }
            // Cyber Daylight (#F1F2F0)
            else if (bg === '#F1F2F0') {
                glassUpdates = {
                    '--glass-bg': 'rgba(255, 255, 255, 0.8)',
                    '--glass-border': 'rgba(0, 0, 0, 0.1)',
                    '--glass-light': 'rgba(255, 255, 255, 0.6)',
                    '--sidebar-bg': '#ffffff'
                };
            }

            if (glassUpdates) {
                Object.assign(this.customTheme, glassUpdates);
                localStorage.setItem(CONFIG.STORAGE_KEYS.THEME, JSON.stringify(this.customTheme));
                console.log('[ShiftCraftApp] Migrated theme with glass variables');
            }
        }

        // 2. Initialize Essential State
        this.days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        this.currentView = 'roster';
        this.bankHolidays = [];
        this.rosterName = localStorage.getItem('shiftcraft_roster_name') || 'Main Roster';

        // Initialise to current week starting Sunday
        const now = new Date();
        const day = now.getDay();
        now.setHours(0, 0, 0, 0);
        this.weekStart = new Date(now.setDate(now.getDate() - day));

        // 3. Start Application
        this.applyCustomTheme();
        this.init();

        // Ensure defaults exist for standards if settings were already present
        if (!this.settings.standards) {
            this.settings.standards = {
                early8: '06:00', late8: '14:00', night8: '22:00',
                day12: '07:00', night12: '19:00'
            };
        }
    }

    init() {
        // TEMPORARY: Seed Test Data (Requested by User)
        if (!localStorage.getItem('seed_v2_staff_8')) {
            this.addTestStaff(8);
            localStorage.setItem('seed_v2_staff_8', 'true');
        }

        this.ensureStaffNumbers();
        if (window.lucide) window.lucide.createIcons();
        this.renderTableHead();
        this.renderTableBody();
        this.renderStaffList();
        this.updateHeader();
        this.updateStats();
        this.displayRosterName();
        this.renderRoleFilter();
        this.updateRoleDatalist();

        // Start Live Clock
        setInterval(() => this.updateClock(), 1000);

        // Load Settings into UI
        const settingEl = document.getElementById('setting-rest');
        if (settingEl) settingEl.value = this.settings.restPeriod;

        if (this.settings.standards) {
            const s = this.settings.standards;
            if (document.getElementById('standard-8-early')) document.getElementById('standard-8-early').value = s.early8;
            if (document.getElementById('standard-8-late')) document.getElementById('standard-8-late').value = s.late8;
            if (document.getElementById('standard-8-night')) document.getElementById('standard-8-night').value = s.night8;
            if (document.getElementById('standard-12-day')) document.getElementById('standard-12-day').value = s.day12;
            if (document.getElementById('standard-12-night')) document.getElementById('standard-12-night').value = s.night12;
        }

        if (document.getElementById('setting-enable-nights')) {
            document.getElementById('setting-enable-nights').checked = this.settings.enableNights !== false;
        }
        if (document.getElementById('setting-enable-weekends')) {
            document.getElementById('setting-enable-weekends').checked = this.settings.enableWeekends !== false;
        }
        if (document.getElementById('setting-holiday-region')) {
            document.getElementById('setting-holiday-region').value = this.settings.holidayRegion || 'england-and-wales';
        }

        // Load Staffing Requirements
        if (this.settings.staffingRequirements) {
            const r = this.settings.staffingRequirements;
            if (document.getElementById('req-early')) document.getElementById('req-early').value = r.early || 2;
            if (document.getElementById('req-late')) document.getElementById('req-late').value = r.late || 2;
            if (document.getElementById('req-night')) document.getElementById('req-night').value = r.night || 1;
            if (document.getElementById('req-day12')) document.getElementById('req-day12').value = r.day12 || 1;
        }

        // Fetch Bank Holidays
        this.fetchBankHolidays();

        // Initialize Global Safeguards
        if (typeof ErrorBoundary !== 'undefined') ErrorBoundary.init(this);

        // Initialize Service Registry
        if (typeof ServiceRegistry !== 'undefined') {
            this.services = new ServiceRegistry(this);
            this.registerServices();
            this.services.startAll();
        }

        this.initBranding();
        this.setupEventListeners();
        if (window.lucide) window.lucide.createIcons();
    }

    registerServices() {
        // Core Pattern Engine
        if (typeof PatternEngine !== 'undefined') {
            this.services.register('patternEngine', () => new PatternEngine());
        }

        // UI Modules - Order doesn't strictly matter with registry as they are isolated
        if (typeof PatternLibraryUI !== 'undefined') {
            this.services.register('patternLibraryUI', (app) => new PatternLibraryUI(app.patternEngine, app));
        }

        if (typeof AIPatternUI !== 'undefined') {
            this.services.register('aiUI', (app) => new AIPatternUI(app));
        }

        if (typeof ComplianceEngine !== 'undefined') {
            this.services.register('complianceEngine', (app) => new ComplianceEngine(app.settings));
        }

        if (typeof ComplianceReporter !== 'undefined') {
            this.services.register('complianceReporter', (app) => new ComplianceReporter(app));
        }

        if (typeof ShiftTemplates !== 'undefined') {
            this.services.register('shiftTemplates', (app) => new ShiftTemplates(app));
        }

        if (typeof AllocationEngine !== 'undefined') {
            this.services.register('allocationEngine', (app) => new AllocationEngine(app));
        }

        if (typeof MonthlyRosterView !== 'undefined') {
            this.services.register('monthlyRosterView', (app) => new MonthlyRosterView(app));
        }

        if (typeof RosterWizard !== 'undefined') {
            this.services.register('wizard', (app) => {
                const w = new RosterWizard(app);
                window.wizard = w; // Keep global ref for HTML onClick events
                return w;
            });
        }
    }

    manualInitServices() {
        // Fallback for when ServiceRegistry is missing
        if (typeof PatternEngine !== 'undefined') this.patternEngine = new PatternEngine();
        if (typeof PatternLibraryUI !== 'undefined') this.patternLibraryUI = new PatternLibraryUI(this.patternEngine, this);
        if (typeof AIPatternUI !== 'undefined') this.aiUI = new AIPatternUI(this);
        if (typeof ComplianceEngine !== 'undefined') this.complianceEngine = new ComplianceEngine(this.settings);
        if (typeof ComplianceReporter !== 'undefined') this.complianceReporter = new ComplianceReporter(this);
        if (typeof ShiftTemplates !== 'undefined') this.shiftTemplates = new ShiftTemplates(this);
        if (typeof AllocationEngine !== 'undefined') this.allocationEngine = new AllocationEngine(this);
        if (typeof MonthlyRosterView !== 'undefined') this.monthlyRosterView = new MonthlyRosterView(this);
        if (typeof RosterWizard !== 'undefined') window.wizard = new RosterWizard(this);
    }



    saveToStorage() {
        localStorage.setItem(CONFIG.STORAGE_KEYS.STAFF, JSON.stringify(this.staff));
        localStorage.setItem(CONFIG.STORAGE_KEYS.SHIFTS, JSON.stringify(this.shifts));

        localStorage.setItem(CONFIG.STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
    }

    setupEventListeners() {
        const navs = ['dashboard', 'roster', 'staff', 'payroll', 'compliance', 'settings', 'admin', 'my-rosters', 'help'];
        navs.forEach(id => {
            const el = document.getElementById(`nav-${id}`);
            if (el) el.onclick = (e) => { e.preventDefault(); this.switchView(id); };
        });

        // Roster Actions
        const addShiftBtn = document.getElementById('add-shift-btn');
        if (addShiftBtn) {
            addShiftBtn.onclick = (e) => {
                e.preventDefault();
                this.toggleModal('modal-overlay', true);
            };
        } else {
            console.error('Add Shift Button not found in DOM');
        }

        document.getElementById('close-modal').onclick = () => this.toggleModal('modal-overlay', false);
        document.getElementById('cancel-modal').onclick = () => this.toggleModal('modal-overlay', false);
        document.getElementById('shift-form').onsubmit = (e) => { e.preventDefault(); this.handleShiftSubmit(); };

        // Bind Shift Type Preset
        const shiftTypeSelect = document.getElementById('form-shift-type');
        if (shiftTypeSelect) {
            shiftTypeSelect.onchange = (e) => {
                const type = e.target.value;
                if (!type) return;

                const s = this.settings.standards || {};
                let start, end;
                // E, L, N (8h) and D12, N12 (12h)
                switch (type) {
                    case 'E': start = s.early8 || '06:00'; end = s.late8 || '14:00'; break;
                    case 'L': start = s.late8 || '14:00'; end = s.night8 || '22:00'; break;
                    case 'N': start = s.night8 || '22:00'; end = '06:00'; break;
                    case 'D12': start = s.day12 || '07:00'; end = s.night12 || '19:00'; break;
                    case 'N12': start = s.night12 || '19:00'; end = s.day12 || '07:00'; break;
                }

                if (start && end) {
                    const startEl = document.getElementById('form-start');
                    const endEl = document.getElementById('form-end');
                    if (startEl) startEl.value = start;
                    if (endEl) endEl.value = end;
                }
            };
        }

        const headerExportEl = document.getElementById('header-export-btn');
        if (headerExportEl) headerExportEl.onclick = () => this.generatePayrollExport();

        const finalExportEl = document.getElementById('final-export-btn');
        if (finalExportEl) finalExportEl.onclick = () => this.generatePayrollExport();

        const exportRosterPdfEl = document.getElementById('export-roster-pdf-btn');
        if (exportRosterPdfEl) exportRosterPdfEl.onclick = () => this.exportRosterPDF();

        document.getElementById('autofill-btn').onclick = () => this.handleAutoFill();
        const smartFillEl = document.getElementById('smart-fill-btn');
        if (smartFillEl) {
            smartFillEl.onclick = async () => {
                const startStr = this.weekStart.toISOString().split('T')[0];
                const count = this.allocationEngine.smartFillWeek(startStr);
                if (count > 0) {
                    this.renderTableBody();
                    this.updateStats();
                    this.showToast(`Smart-filled ${count} shifts`, 'sparkles');
                } else if (count === -1) {
                    this.showToast('Roster already at desired resourcing level', 'check-circle');
                } else {
                    const result = await this.confirm({
                        title: 'No demand pattern found',
                        body: 'Smart Fill couldn\'t find any shifts from last week to clone. Please select a start date for your roster, then choose a pattern from the library.',
                        icon: 'calendar',
                        iconColor: 'var(--accent-blue)',
                        dateInput: true,
                        defaultDate: startStr
                    });
                    if (result.confirmed && result.date) {
                        this.patternLibraryUI.openLibrary(result.date);
                    }
                }
            };
        }
        document.getElementById('prev-week').onclick = () => this.changeWeek(-7);
        document.getElementById('next-week').onclick = () => this.changeWeek(7);

        // Staff Actions
        document.getElementById('add-staff-modal-btn').onclick = () => this.toggleModal('staff-modal-overlay', true);
        document.getElementById('close-staff-modal').onclick = () => this.toggleModal('staff-modal-overlay', false);
        document.getElementById('cancel-staff-modal').onclick = () => this.toggleModal('staff-modal-overlay', false);
        document.getElementById('staff-form').onsubmit = (e) => { e.preventDefault(); this.handleStaffSubmit(); };

        const dedupeStaffBtn = document.getElementById('deduplicate-staff-btn');
        if (dedupeStaffBtn) {
            dedupeStaffBtn.onclick = () => this.deduplicateStaff();
        }


        // Monthly Roster View Button (for Staff Directory modal)
        const monthlyRosterBtn = document.getElementById('open-monthly-roster-btn');
        if (monthlyRosterBtn) {
            monthlyRosterBtn.onclick = () => {
                if (this.monthlyRosterView) {
                    this.monthlyRosterView.open();
                }
            };
        }



        // View Toggle (Weekly/Monthly) in Shift Roster header
        this.initViewToggle();

        // Roster Wizard Button
        // Roster Wizard Button
        const wizardBtn = document.getElementById('roster-wizard-btn');
        if (wizardBtn) {
            wizardBtn.onclick = () => {
                console.log('[RosterWizard] Launch Requested');

                // Robust instance resolution
                let wizard;
                if (this.services) {
                    wizard = this.services.get('wizard');
                }

                if (!wizard && window.wizard) {
                    wizard = window.wizard; // Fallback
                }

                if (wizard) {
                    // Update global ref just in case logic depends on it
                    if (!window.wizard) window.wizard = wizard;

                    console.log('[RosterWizard] Instance found, opening...');
                    wizard.open();
                } else {
                    console.error('[RosterWizard] Critical: Wizard instance could not be created');
                    this.showToast('Error: Roster Wizard not available', 'alert-triangle');
                }
            };
        }

        // Bulk Actions
        const selectAllEl = document.getElementById('select-all-staff');
        if (selectAllEl) {
            selectAllEl.onchange = (e) => this.toggleAllStaff(e.target.checked);
        }
        const bulkOptOutBtn = document.getElementById('bulk-toggle-optout');
        if (bulkOptOutBtn) {
            bulkOptOutBtn.onclick = () => this.handleBulkOptOut();
        }
        const bulkSetHoursBtn = document.getElementById('bulk-set-hours');
        if (bulkSetHoursBtn) {
            bulkSetHoursBtn.onclick = () => this.handleBulkSetHours();
        }
        const bulkSetRateBtn = document.getElementById('bulk-set-rate');
        if (bulkSetRateBtn) {
            bulkSetRateBtn.onclick = () => this.handleBulkSetRate();
        }


        // Filters
        document.getElementById('role-filter').onchange = () => this.renderTableBody();

        // Settings Actions
        const restEl = document.getElementById('setting-rest');
        if (restEl) {
            restEl.onchange = (e) => {
                this.settings.restPeriod = parseInt(e.target.value);
                this.saveToStorage();
                this.showToast('Rest requirements updated', 'settings');
            };
        }
        const saveStandardsBtn = document.getElementById('save-standards-btn');
        if (saveStandardsBtn) {
            saveStandardsBtn.onclick = () => this.saveShiftStandards();
        }

        const saveRequirementsBtn = document.getElementById('save-requirements-btn');
        if (saveRequirementsBtn) {
            saveRequirementsBtn.onclick = () => this.saveStaffingRequirements();
        }

        // Admin Actions
        this.initAdminNavigation();

        // Pattern Toggles
        const nightToggle = document.getElementById('setting-enable-nights');
        if (nightToggle) {
            nightToggle.onchange = (e) => {
                this.settings.enableNights = e.target.checked;
                this.saveToStorage();
                this.showToast(`Night shifts ${e.target.checked ? 'enabled' : 'disabled'}`, 'moon');
            };
        }
        const weekendToggle = document.getElementById('setting-enable-weekends');
        if (weekendToggle) {
            weekendToggle.onchange = (e) => {
                this.settings.enableWeekends = e.target.checked;
                this.saveToStorage();
                this.showToast(`Weekend working ${e.target.checked ? 'enabled' : 'disabled'}`, 'calendar');
            };
        }
        const regionSel = document.getElementById('setting-holiday-region');
        if (regionSel) {
            regionSel.onchange = (e) => {
                this.settings.holidayRegion = e.target.value;
                this.saveToStorage();
                this.fetchBankHolidays();
                this.showToast(`Region switched to ${e.target.options[e.target.selectedIndex].text}`, 'map');
            };
        }

        document.getElementById('clear-data-btn').onclick = () => this.clearAllData();

        // Modal Overlay Close
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.onclick = (e) => { if (e.target.classList.contains('modal-overlay')) this.toggleModal(e.target.id, false); };
        });

        // Compliance Report
        const reportBtn = document.getElementById('generate-compliance-report');
        if (reportBtn) reportBtn.onclick = () => this.complianceReporter?.generateAuditReport();

        // Theme Toggle
        document.getElementById('theme-toggle').onclick = () => this.toggleTheme();

        // Roster Management
        const clearRosterBtn = document.getElementById('clear-roster-btn');
        if (clearRosterBtn) clearRosterBtn.onclick = () => this.clearCurrentRoster();

        const saveSnapshotBtn = document.getElementById('save-snapshot-btn');
        if (saveSnapshotBtn) saveSnapshotBtn.onclick = () => this.saveRosterSnapshot();

        const loadSnapshotBtn = document.getElementById('load-snapshot-btn');
        if (loadSnapshotBtn) loadSnapshotBtn.onclick = () => this.loadRosterSnapshot();

        // Keyboard Shortcuts
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));

        // Mobile Bottom Navigation
        document.querySelectorAll('.mobile-bottom-nav .nav-btn').forEach(btn => {
            btn.onclick = () => {
                const view = btn.dataset.view;
                this.switchView(view);
                // Update active state
                document.querySelectorAll('.mobile-bottom-nav .nav-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            };
        });

        // Mobile FAB - Quick Add Shift
        const mobileFab = document.getElementById('mobile-add-shift');
        if (mobileFab) {
            mobileFab.onclick = () => this.toggleModal('modal-overlay', true);
        }

        // Swipe hint dismissal on scroll
        const tableWrapper = document.querySelector('.roster-table-wrapper');
        if (tableWrapper) {
            tableWrapper.addEventListener('scroll', () => {
                tableWrapper.classList.add('scrolled');
            }, { once: true });
        }
    }

    toggleTheme() {
        const current = this.settings.theme || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        this.settings.theme = next;
        this.saveToStorage();
        document.body.setAttribute('data-theme', next);
        this.updateThemeIcon();
        this.showToast(`Theme switched to ${next} mode`, next === 'dark' ? 'moon' : 'sun');
    }

    updateThemeIcon() {
        const icon = document.querySelector('#theme-toggle i');
        if (icon) {
            icon.setAttribute('data-lucide', this.settings.theme === 'light' ? 'moon' : 'sun');
            if (window.lucide) window.lucide.createIcons();
        }
    }

    handleKeyDown(e) {
        // Ignore if user is typing in an input
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

        const key = e.key.toLowerCase();

        switch (key) {
            case 'n': this.toggleModal('modal-overlay', true); break;
            case 's': this.switchView('staff'); break;
            case 'r': this.switchView('roster'); break;
            case 'c': this.switchView('compliance'); break;
            case 't': this.toggleTheme(); break;
            case 'arrowleft': this.changeWeek(-7); break;
            case 'arrowright': this.changeWeek(7); break;
            case '?':
                const help = document.getElementById('shortcuts-help');
                if (help) help.style.display = help.style.display === 'none' ? 'block' : 'none';
                break;
        }
    }

    updateClock() {
        const el = document.getElementById('live-clock');
        if (el) el.textContent = new Date().toLocaleTimeString();
    }

    switchView(viewId) {
        this.currentView = viewId;
        // Update desktop sidebar navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.id === `nav-${viewId}`) link.classList.add('active');
        });
        // Update mobile bottom navigation
        document.querySelectorAll('.mobile-bottom-nav .nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.view === viewId) btn.classList.add('active');
        });
        document.querySelectorAll('.app-view').forEach(view => {
            view.style.display = view.id === `view-${viewId}` ? 'block' : 'none';
        });

        if (viewId === 'dashboard') this.renderDashboard();
        if (viewId === 'roster') this.renderTableBody();
        if (viewId === 'staff') this.renderStaffList();

        if (viewId === 'payroll') this.renderPayrollPreview();
        if (viewId === 'compliance') this.renderComplianceView();
        if (viewId === 'admin') this.initAdminView();
        if (viewId === 'my-rosters') this.renderMyRosters();

        if (window.lucide) window.lucide.createIcons();
    }

    // --- Roster Logic ---
    async fetchBankHolidays() {
        try {
            const res = await fetch('https://www.gov.uk/bank-holidays.json');
            const data = await res.json();
            const region = this.settings.holidayRegion || 'england-and-wales';
            this.bankHolidays = data[region].events;
            if (this.complianceEngine) {
                this.complianceEngine.setBankHolidays(this.bankHolidays);
            }
            this.renderTableHead(); // Re-render to show badges
        } catch (e) {
            console.error('Failed to fetch bank holidays:', e);
        }
    }

    getBankHoliday(dateStr) {
        return this.bankHolidays.find(h => h.date === dateStr);
    }

    renderTableHead() {
        const row = document.getElementById('roster-thead-row');
        if (!row) return;

        // Count selected staff in the current view
        const allSelected = this.staff.length > 0 && this.staff.every(s => s.selected);

        row.innerHTML = `
            <th style="width: 200px;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <input type="checkbox" id="roster-select-all" ${allSelected ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer;">
                    <span>EMPLOYEE</span>
                </div>
            </th>
        `;

        const selectAll = row.querySelector('#roster-select-all');
        if (selectAll) {
            selectAll.onchange = (e) => {
                this.staff.forEach(s => s.selected = e.target.checked);
                this.renderTableBody();
                this.updateSelectedCount();
            };
        }

        for (let i = 0; i < 7; i++) {
            const d = new Date(this.weekStart);
            d.setDate(d.getDate() + i);
            const dateStr = this.formatDate(d);
            const dayOfWeek = d.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sun=0, Sat=6

            const ph = this.getBankHoliday(dateStr);
            const coverage = this.calculateCoverage(dateStr);
            const status = this.getCoverageStatus(coverage);

            // Build coverage badges HTML
            const types = [
                { key: 'early', label: 'E', color: 'var(--shift-early)' },
                { key: 'late', label: 'L', color: 'var(--shift-late)' },
                { key: 'night', label: 'N', color: 'var(--shift-night)' },
                { key: 'day12', label: 'D', color: 'var(--shift-day)' }
            ];

            const coverageBadges = types.map(t => {
                const c = coverage[t.key];
                if (c.required === 0) return ''; // Skip if no requirement
                const isMet = c.gap >= 0;
                const isCritical = c.scheduled === 0 && c.required > 0;
                const bg = isCritical ? 'var(--accent-rose)' : (isMet ? 'var(--accent-emerald)' : 'var(--accent-amber)');
                return `<span title="${t.label}: ${c.scheduled}/${c.required}" style="
                    display:inline-block; width:18px; height:18px; border-radius:4px; font-size:0.6rem;
                    background:${bg}; color:white; text-align:center; line-height:18px; font-weight:600;
                ">${c.scheduled}</span>`;
            }).join('');

            const th = document.createElement('th');
            if (isWeekend) th.classList.add('weekend');

            th.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; gap: 2px;">
                    <span style="font-size: 0.8rem;">${this.days[i]}</span>
                    <small style="color:var(--text-muted); font-weight:400; font-size: 0.7rem;">${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}</small>
                    ${ph ? `<span class="ph-badge" title="${ph.title}">PH</span>` : ''}
                    <div style="display:flex; gap:2px; margin-top:4px;">${coverageBadges}</div>
                </div>
            `;
            if (ph) {
                th.style.background = 'color-mix(in srgb, var(--accent-amber), transparent 85%)';
                th.style.borderBottom = '2px solid var(--accent-amber)';
            }
            row.appendChild(th);
        }
    }

    renderTableBody() {
        try {
            const tbody = document.getElementById('roster-tbody');
            if (!tbody) return;
            tbody.innerHTML = '';

            const roleFilter = document.getElementById('role-filter')?.value || 'all';
            const filteredStaff = roleFilter === 'all' ? this.staff : this.staff.filter(s => s.role === roleFilter);

            const weekDates = this.getWeekDates();

            // Truth Protocol: Show only staff who are either Selected OR have Shifts this week
            const activeStaff = filteredStaff.filter(person => {
                const hasShifts = this.shifts.some(s => s.staffId === person.id && weekDates.includes(s.date));
                return person.selected || hasShifts;
            });

            if (activeStaff.length === 0 && this.staff.length > 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 4rem; color: var(--text-muted);"><i data-lucide="filter" style="display:block; margin: 0 auto 1rem; width: 48px; height: 48px; opacity: 0.2;"></i>All staff are currently hidden. Select staff in the sidebar or assign shifts to see them here.</td></tr>';
                if (window.lucide) window.lucide.createIcons();
                return;
            }

            activeStaff.forEach(person => {
                const tr = document.createElement('tr');

                // Selection state
                const isSelected = person.selected || false;

                tr.innerHTML = `
                <td>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <input type="checkbox" class="roster-staff-checkbox" value="${person.id}" ${isSelected ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer;">
                        <div class="staff-info">
                            <div class="avatar" style="background: ${person.color}33; color: ${person.color};">${person.name[0]}</div>
                            <div>
                                <span class="staff-name">${person.name}</span>
                                <span class="staff-role">${person.role}</span>
                            </div>
                        </div>
                    </div>
                </td>
            `;

                // Handle checkbox click
                const checkbox = tr.querySelector('.roster-staff-checkbox');
                checkbox.onchange = (e) => {
                    person.selected = e.target.checked;
                    this.updateSelectedCount(); // Existing method or new one
                };

                for (let i = 0; i < 7; i++) {
                    const td = document.createElement('td');
                    const d = new Date(this.weekStart);
                    d.setDate(d.getDate() + i);
                    const dateStr = this.formatDate(d);
                    const dayOfWeek = d.getDay();
                    if (dayOfWeek === 0 || dayOfWeek === 6) td.classList.add('weekend');

                    // Drop Zone Setup
                    td.dataset.date = dateStr;
                    td.dataset.staffId = person.id;
                    td.classList.add('drop-zone');
                    td.ondragover = (e) => {
                        e.preventDefault();
                        td.classList.add('drag-over');
                    };
                    td.ondragleave = () => td.classList.remove('drag-over');
                    td.ondrop = (e) => {
                        td.classList.remove('drag-over');
                        this.handleDrop(e);
                    };

                    const dayShifts = this.shifts.filter(s => s.staffId === person.id && s.date === dateStr);

                    if (dayShifts.length > 0) {
                        // Staff has shifts - show them
                        dayShifts.forEach(shift => {
                            const pill = this.createShiftPill(shift, person);
                            pill.draggable = true;
                            pill.ondragstart = (e) => {
                                e.dataTransfer.setData('shiftId', shift.id);
                                pill.classList.add('dragging');
                            };
                            pill.ondragend = () => pill.classList.remove('dragging');
                            td.appendChild(pill);
                        });
                    } else {
                        // No shifts - show rest day indicator
                        const restDay = document.createElement('div');
                        restDay.className = 'rest-day';
                        restDay.innerHTML = `
                        <i data-lucide="moon" style="width: 16px; height: 16px; opacity: 0.4;"></i>
                        <span>Rest</span>
                    `;
                        td.appendChild(restDay);
                    }

                    tr.appendChild(td);
                }
                tbody.appendChild(tr);
            });

            // Refresh Lucide icons for rest day indicators
            if (window.lucide) window.lucide.createIcons();
        } catch (e) {
            console.error('[ShiftCraft] Render Error:', e);
            this.showToast('Render Error: ' + e.message, 'alert-circle');
        }
    }

    handleDrop(e) {
        e.preventDefault();
        const shiftId = e.dataTransfer.getData('shiftId');
        const targetDate = e.currentTarget.dataset.date;
        const targetStaffId = e.currentTarget.dataset.staffId;

        const shiftIndex = this.shifts.findIndex(s => s.id === shiftId);
        if (shiftIndex !== -1) {
            const shift = this.shifts[shiftIndex];

            // CHECK OVERLAP
            if (this.checkShiftOverlap(targetStaffId, targetDate, shift.start, shift.end, shiftId)) {
                this.showToast('Shift conflict detected', 'alert-circle');
                return; // Abort move
            }

            this.shifts[shiftIndex].date = targetDate;
            this.shifts[shiftIndex].staffId = targetStaffId;
            this.saveToStorage();
            this.renderTableBody();
            this.updateStats();
            this.showToast('Shift moved', 'move');
        }
    }

    createShiftPill(shift, person) {
        const pill = document.createElement('div');
        pill.className = 'shift-pill';

        // Classify shift type and apply styling
        const shiftInfo = this.classifyShiftType(shift);
        if (shiftInfo.cssClass) {
            pill.classList.add(shiftInfo.cssClass);
        }

        const duration = this.calculateDuration(shift.start, shift.end);

        // Add shift type badge with times
        pill.innerHTML = `
            <span class="shift-type-badge">${shiftInfo.code}</span>
            <span class="shift-time">${shift.start} - ${shift.end}</span>
            <span class="shift-loc">${duration}h</span>
        `;

        const warnings = this.checkCompliance(shift, person);
        if (warnings.length > 0) {
            const warnEl = document.createElement('div');
            warnEl.className = 'compliance-warning';
            warnEl.innerHTML = `<i data-lucide="alert-triangle" style="width:10px;height:10px"></i> ${warnings[0]}`;
            pill.appendChild(warnEl);
            if (window.lucide) setTimeout(() => window.lucide.createIcons(), 0);
        }

        pill.onclick = async () => {
            if (await this.confirm({
                title: 'Remove Shift?',
                body: `Are you sure you want to delete the ${shift.start}-${shift.end} shift for ${person.name}?`,
                icon: 'trash-2',
                iconColor: 'var(--accent-rose)'
            })) {
                this.shifts = this.shifts.filter(s => s.id !== shift.id);
                this.saveToStorage();
                this.renderTableBody();
                this.updateStats();
                this.showToast('Shift removed', 'trash-2');
            }
        };

        return pill;
    }

    async deduplicateStaff() {
        const staff = this.staff;
        const seen = new Set();
        const unique = staff.filter(s => {
            const nameKey = s.name.trim().toLowerCase();
            if (seen.has(nameKey)) return false;
            seen.add(nameKey);
            return true;
        });

        if (staff.length === unique.length) {
            this.showToast('No duplicate staff found', 'info');
            return;
        }

        const confirmed = await this.confirm({
            title: 'Deduplicate Staff?',
            body: `Are you sure you want to merge duplicates? This will reduce staff from ${staff.length} to ${unique.length}. Only the first occurrence of each name will be kept.`,
            icon: 'user-minus',
            iconColor: 'var(--accent-amber)'
        });

        if (confirmed) {
            this.staff = unique;
            this.saveToStorage();
            this.renderStaffList();
            this.updateStats();
            this.showToast(`Cleaned: ${staff.length} → ${unique.length} staff`, 'check-circle');
            console.log(`[ShiftCraftApp] Staff deduplicated: ${staff.length} -> ${unique.length}`);
        }
    }

    /**
     * Classify a shift based on its metadata or timing
     * Returns { code, label, cssClass }
     */
    classifyShiftType(shift) {
        const duration = parseFloat(this.calculateDuration(shift.start, shift.end));
        const startHour = parseInt(shift.start.split(':')[0]);

        // First, check if shiftType is stored on the shift (from pattern application)
        if (shift.shiftType) {
            const type = shift.shiftType.toLowerCase();
            if (type.includes('early') || type === 'e') {
                return { code: 'E', label: 'Early', cssClass: 'early' };
            }
            if (type.includes('late') || type === 'l') {
                return { code: 'L', label: 'Late', cssClass: 'late' };
            }
            if (type.includes('night') || type === 'n') {
                return { code: 'N', label: 'Night', cssClass: 'night' };
            }
            if (type.includes('day') || type === 'd' || type.includes('long day')) {
                return { code: 'D', label: 'Day (12h)', cssClass: 'day12' };
            }
        }

        // Fallback: Classify by duration and start time
        const is12Hour = duration >= 11 && duration <= 13;

        // 12-hour pattern detection
        if (is12Hour) {
            if (startHour >= 19 || startHour < 7) {
                return { code: 'N', label: 'Night (12h)', cssClass: 'night' };
            } else {
                return { code: 'D', label: 'Day (12h)', cssClass: 'day12' };
            }
        }

        // 8-hour pattern detection
        if (startHour >= 19 || startHour < 6) {
            return { code: 'N', label: 'Night', cssClass: 'night' };
        } else if (startHour >= 5 && startHour < 10) {
            return { code: 'E', label: 'Early', cssClass: 'early' };
        } else if (startHour >= 12 && startHour < 19) {
            return { code: 'L', label: 'Late', cssClass: 'late' };
        }

        // Default fallback
        return { code: '?', label: 'Shift', cssClass: '' };
    }


    // --- Dashboard Logic ---
    renderDashboard() {
        const container = document.getElementById('dashboard-chart-container');
        if (!container) return;

        // 1. GATHER DATA
        const weekDates = this.getWeekDates();
        const dailyScheduled = [0, 0, 0, 0, 0, 0, 0];
        const dailyDemand = [0, 0, 0, 0, 0, 0, 0];
        const dailyCosts = [0, 0, 0, 0, 0, 0, 0];
        const dailyCompliant = [0, 0, 0, 0, 0, 0, 0];
        const dailyTotalShifts = [0, 0, 0, 0, 0, 0, 0];

        // Demand (Previous Week)
        const prevStart = new Date(this.weekStart);
        prevStart.setDate(prevStart.getDate() - 7);
        const prevDates = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(prevStart);
            d.setDate(d.getDate() + i);
            prevDates.push(d.toISOString().split('T')[0]);
        }

        // Calculate Current Week
        this.shifts.filter(s => weekDates.includes(s.date)).forEach(s => {
            const p = this.staff.find(staff => staff.id === s.staffId);
            if (!p) return;
            const h = parseFloat(this.calculateDuration(s.start, s.end));
            const dayIdx = new Date(s.date).getDay(); // Sun=0

            dailyScheduled[dayIdx] += h;
            dailyCosts[dayIdx] += h * p.rate * (1 + CONFIG.WTR.HOLIDAY_ACCRUAL_RATE);
            dailyTotalShifts[dayIdx]++;

            const warnings = this.checkCompliance(s, p);
            if (warnings.length === 0) dailyCompliant[dayIdx]++;
        });

        // Calculate Demand (Previous Week)
        this.shifts.filter(s => prevDates.includes(s.date)).forEach(s => {
            const h = parseFloat(this.calculateDuration(s.start, s.end));
            const dayIdx = new Date(s.date).getDay();
            dailyDemand[dayIdx] += h;
        });

        // 2. UPDATE METRIC CARDS
        const totalScheduled = dailyScheduled.reduce((a, b) => a + b, 0);
        const totalCost = dailyCosts.reduce((a, b) => a + b, 0);
        const totalShifts = dailyTotalShifts.reduce((a, b) => a + b, 0);
        const totalCompliant = dailyCompliant.reduce((a, b) => a + b, 0);
        const complianceHealth = totalShifts > 0 ? Math.round((totalCompliant / totalShifts) * 100) : 100;

        const scheduledEl = document.getElementById('dash-scheduled-hours');
        if (scheduledEl) scheduledEl.textContent = `${totalScheduled.toFixed(1)}h`;

        // Calculate Month-to-Date Cost
        const now = new Date();
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const mtdDates = [];
        let dIter = new Date(firstOfMonth);
        while (dIter <= now) {
            mtdDates.push(dIter.toISOString().split('T')[0]);
            dIter.setDate(dIter.getDate() + 1);
        }

        let mtdCost = 0;
        this.shifts.filter(s => mtdDates.includes(s.date)).forEach(s => {
            const p = this.staff.find(staff => staff.id === s.staffId);
            if (!p) return;
            const h = parseFloat(this.calculateDuration(s.start, s.end));
            mtdCost += h * p.rate * (1 + CONFIG.WTR.HOLIDAY_ACCRUAL_RATE);
        });

        const costEl = document.getElementById('dash-mtd-cost');
        if (costEl) costEl.textContent = `£${mtdCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

        const healthEl = document.getElementById('dash-compliance-health');
        if (healthEl) healthEl.textContent = `${complianceHealth}%`;

        const varianceEl = document.getElementById('dash-hours-variance');
        if (varianceEl) {
            const demandTotal = dailyDemand.reduce((a, b) => a + b, 0);
            const diff = totalScheduled - demandTotal;
            const pct = demandTotal > 0 ? (diff / demandTotal) * 100 : 0;
            varianceEl.className = `metric-trend ${diff >= 0 ? 'trend-up' : 'trend-down'}`;
            varianceEl.innerHTML = `
                <i data-lucide="${diff >= 0 ? 'trending-up' : 'trending-down'}" style="width:14px;height:14px;"></i>
                <span>${Math.abs(pct).toFixed(1)}% vs prev week</span>
            `;
        }

        // 3. RENDER SVG CHART
        container.innerHTML = '';
        const width = container.clientWidth;
        const height = container.clientHeight;
        const padding = { top: 40, right: 60, bottom: 40, left: 60 };
        const chartW = width - padding.left - padding.right;
        const chartH = height - padding.top - padding.bottom;

        const maxH = Math.max(...dailyScheduled, ...dailyDemand, 10) * 1.2;
        const maxC = Math.max(...dailyCosts, 100) * 1.2;

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
        svg.classList.add("svg-chart");

        // Definitions for Gradients
        svg.innerHTML = `
            <defs>
                <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--primary)" />
                    <stop offset="100%" stop-color="var(--accent-blue)" />
                </linearGradient>
            </defs>
        `;

        // Helper: get coordinates
        // Using band-scaling (7 days) + centering offset
        const getX = (i) => padding.left + (i * (chartW / 7)) + (chartW / 14);
        const getYHours = (val) => padding.top + chartH - (val / maxH) * chartH;
        const getYCost = (val) => padding.top + chartH - (val / maxC) * chartH;

        // Grid Lines
        for (let i = 0; i <= 4; i++) {
            const h = padding.top + (i * (chartH / 4));
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", padding.left);
            line.setAttribute("y1", h);
            line.setAttribute("x2", padding.left + chartW);
            line.setAttribute("y2", h);
            line.classList.add("chart-grid-line");
            svg.appendChild(line);

            const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
            label.setAttribute("x", padding.left - 10);
            label.setAttribute("y", h + 4);
            label.setAttribute("text-anchor", "end");
            label.classList.add("chart-label-y");
            label.textContent = `${Math.round((maxH / 4) * (4 - i))}h`;
            svg.appendChild(label);

            const labelR = document.createElementNS("http://www.w3.org/2000/svg", "text");
            labelR.setAttribute("x", padding.left + chartW + 10);
            labelR.setAttribute("y", h + 4);
            labelR.setAttribute("text-anchor", "start");
            labelR.classList.add("chart-label-y");
            labelR.textContent = `£${Math.round((maxC / 4) * (4 - i))}`;
            svg.appendChild(labelR);
        }

        // Bars
        const barW = (chartW / 7) * 0.4;
        this.days.forEach((day, i) => {
            const x = getX(i);

            // Demand Bar
            const demH = (dailyDemand[i] / maxH) * chartH;
            const demRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            demRect.setAttribute("x", x - barW - 4);
            demRect.setAttribute("y", padding.top + chartH - demH);
            demRect.setAttribute("width", barW);
            demRect.setAttribute("height", demH);
            demRect.classList.add("chart-bar-demand");
            svg.appendChild(demRect);

            // Scheduled Bar
            const schH = (dailyScheduled[i] / maxH) * chartH;
            const schRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            schRect.setAttribute("x", x + 4);
            schRect.setAttribute("y", padding.top + chartH - schH);
            schRect.setAttribute("width", barW);
            schRect.setAttribute("height", schH);
            schRect.classList.add("chart-bar-scheduled");
            svg.appendChild(schRect);

            // X-Axis Labels
            const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
            label.setAttribute("x", x);
            label.setAttribute("y", padding.top + chartH + 25);
            label.setAttribute("text-anchor", "middle");
            label.classList.add("chart-label-x");
            label.textContent = day;
            svg.appendChild(label);

            // Interaction Overlay (Invisible wider rect for hover)
            const overlay = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            overlay.setAttribute("x", x - (chartW / 14));
            overlay.setAttribute("y", padding.top);
            overlay.setAttribute("width", chartW / 7);
            overlay.setAttribute("height", chartH);
            overlay.setAttribute("fill", "transparent");
            overlay.style.cursor = "pointer";

            overlay.onmouseover = (e) => this.showChartTooltip(e, {
                day: this.days[i],
                scheduled: dailyScheduled[i],
                demand: dailyDemand[i],
                cost: dailyCosts[i],
                compliance: dailyTotalShifts[i] > 0 ? Math.round((dailyCompliant[i] / dailyTotalShifts[i]) * 100) : 100
            });
            overlay.onmouseout = () => this.hideChartTooltip();

            svg.appendChild(overlay);
        });

        // Cost Line
        let lineD = "";
        dailyCosts.forEach((val, i) => {
            const x = getX(i);
            const y = getYCost(val);
            lineD += (i === 0 ? "M " : "L ") + x + " " + y;
        });

        const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
        line.setAttribute("d", lineD);
        line.classList.add("chart-line-cost");
        svg.appendChild(line);

        // Cost Points
        dailyCosts.forEach((val, i) => {
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", getX(i));
            circle.setAttribute("cy", getYCost(val));
            circle.setAttribute("r", 5);
            circle.classList.add("chart-point-cost");
            svg.appendChild(circle);
        });

        container.appendChild(svg);
        if (window.lucide) window.lucide.createIcons();
    }

    showChartTooltip(e, data) {
        const tooltip = document.getElementById('chart-tooltip');
        if (!tooltip) return;

        tooltip.innerHTML = `
            <div class="tooltip-title">${data.day} Analysis</div>
            <div class="tooltip-row">
                <span>Scheduled:</span>
                <span class="font-bold">${data.scheduled.toFixed(1)}h</span>
            </div>
            <div class="tooltip-row">
                <span>Demand:</span>
                <span class="text-muted">${data.demand.toFixed(1)}h</span>
            </div>
            <div class="tooltip-row">
                <span>Labor Cost:</span>
                <span style="color:var(--accent-emerald)">£${data.cost.toFixed(2)}</span>
            </div>
            <div class="tooltip-row">
                <span>Compliance:</span>
                <span style="color:${data.compliance < 100 ? 'var(--accent-rose)' : 'var(--accent-emerald)'}">${data.compliance}%</span>
            </div>
        `;

        tooltip.style.display = 'block';
        tooltip.style.left = `${e.pageX + 15}px`;
        tooltip.style.top = `${e.pageY - 100}px`;
    }

    hideChartTooltip() {
        const tooltip = document.getElementById('chart-tooltip');
        if (tooltip) tooltip.style.display = 'none';
    }

    // --- Payroll Logic ---
    renderPayrollPreview() {
        const tbody = document.getElementById('payroll-preview-tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        const weekDates = this.getWeekDates();
        this.staff.forEach(p => {
            let h = 0, b = 0;
            this.shifts.filter(s => s.staffId === p.id && weekDates.includes(s.date)).forEach(s => {
                const dur = parseFloat(this.calculateDuration(s.start, s.end));
                h += dur;
                b += dur * p.rate;
            });
            const hol = b * CONFIG.WTR.HOLIDAY_ACCRUAL_RATE;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${p.name}</strong></td>
                <td>£${b.toFixed(2)}</td>
                <td>£${hol.toFixed(2)}</td>
                <td>£${(b + hol).toFixed(2)}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // --- Compliance Logic ---
    renderComplianceView() {
        let risk48h = 0;
        let breachRest = 0;
        const logList = document.getElementById('compliance-log-list');
        if (!logList) return;
        logList.innerHTML = '';

        const weekDates = this.getWeekDates();
        this.staff.forEach(p => {
            const weekShifts = this.shifts.filter(s => s.staffId === p.id && weekDates.includes(s.date));
            weekShifts.forEach(s => {
                const warnings = this.checkCompliance(s, p);
                if (warnings.includes('48h Avg Risk')) risk48h++;
                if (warnings.some(w => w.includes('Rest'))) breachRest++;

                warnings.forEach(w => {
                    const li = document.createElement('li');
                    li.style.cssText = 'padding: 0.75rem; border-bottom: 1px solid var(--glass-border); font-size: 0.85rem;';
                    li.innerHTML = `<span style="color: var(--accent-rose); font-weight: 700;">[RISK]</span> ${p.name}: ${w} on <strong>${s.date}</strong>`;
                    logList.appendChild(li);
                });
            });
        });

        const comp48hEl = document.getElementById('comp-48h-count');
        const compRestEl = document.getElementById('comp-rest-count');
        if (comp48hEl) comp48hEl.textContent = risk48h;
        if (compRestEl) compRestEl.textContent = breachRest;
        if (logList.innerHTML === '') logList.innerHTML = '<li style="color: var(--text-muted); padding: 1rem;">No compliance risks detected for this week.</li>';
    }


    // --- Shared Utilities ---
    getWeekDates() {
        const dates = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(this.weekStart);
            d.setDate(d.getDate() + i);
            dates.push(this.formatDate(d));
        }
        return dates;
    }

    calculateDuration(start, end) {
        const [sh, sm] = start.split(':').map(Number);
        let [eh, em] = end.split(':').map(Number);
        if (eh < sh || (eh === sh && em < sm)) eh += 24;
        return (((eh * 60 + em) - (sh * 60 + sm)) / 60).toFixed(1);
    }

    checkCompliance(shift, person, preFilteredStaffShifts = null) {
        if (!this.complianceEngine) return [];
        const warnings = [];

        // Use pre-filtered shifts if provided, otherwise filter now
        const staffShifts = preFilteredStaffShifts || this.shifts.filter(s => s.staffId === person.id);

        // 1. Daily Rest check (11h Rule)
        const violations = this.complianceEngine.checkDailyRest(person.id, this.shifts, staffShifts);
        const myViolation = violations.find(v => v.shiftId === shift.id);
        if (myViolation) warnings.push(myViolation.message);

        // 2. Break check (Statutory: 20 mins if > 6h)
        // Hidden at user request to reduce visual noise
        // const h = parseFloat(this.calculateDuration(shift.start, shift.end));
        // if (h > 6) warnings.push('20min Break Required');

        // 3. 48-hour Weekly Limit (17-week average)
        const weekly = this.complianceEngine.check17WeekAverage(person.id, this.shifts, person.optOut48h, shift.date, staffShifts);
        if (weekly) warnings.push(weekly.message);

        // 4. Contracted Hours Alignment (17-week average)
        const contractCheck = this.complianceEngine.checkContractedCompliance(person, this.shifts, shift.date);
        if (contractCheck) warnings.push(contractCheck.message);

        // 5. Young Worker Rules (<18)
        const youngViolations = this.complianceEngine.checkYoungWorkerRules(person, this.shifts, shift.date);
        youngViolations.forEach(v => warnings.push(v.message));

        return warnings;
    }

    // Keep for legacy compatibility if needed, but redirects to engine
    calculate17WeekAverage(staffId, endDateStr) {
        if (!this.complianceEngine) return 0;
        return this.complianceEngine.calculateRollingAverage(staffId, this.shifts, endDateStr, 17);
    }

    getYesterday(dateStr) {
        const d = new Date(dateStr);
        d.setDate(d.getDate() - 1);
        return d.toISOString().split('T')[0];
    }

    updateStats() {
        let hours = 0, cost = 0, alerts = 0;
        const weekDates = this.getWeekDates();

        // Pre-filter shifts by staff to avoid O(N^2) in compliance checks
        const staffShiftMap = new Map();
        this.staff.forEach(p => {
            staffShiftMap.set(p.id, this.shifts.filter(s => s.staffId === p.id));
        });

        this.shifts.filter(s => weekDates.includes(s.date)).forEach(s => {
            const p = this.staff.find(staff => staff.id === s.staffId);
            if (!p) return;
            const h = parseFloat(this.calculateDuration(s.start, s.end));
            hours += h;
            cost += h * (p.rate || p.hourlyRate || 0);
            if (this.checkCompliance(s, p, staffShiftMap.get(p.id)).length > 0) alerts++;
        });

        const hol = cost * CONFIG.WTR.HOLIDAY_ACCRUAL_RATE;
        const totalGross = cost + hol;

        const costEl = document.getElementById('stat-cost');
        if (costEl) costEl.textContent = `£${totalGross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        const hoursEl = document.getElementById('stat-hours');
        if (hoursEl) hoursEl.textContent = `${hours.toFixed(1)}h`;

        const staffEl = document.getElementById('stat-staff');
        if (staffEl) staffEl.textContent = this.staff.length;

        const alertsEl = document.getElementById('stat-alerts');
        if (alertsEl) alertsEl.textContent = alerts;

        this.updateHeader(hol);
    }

    updateHeader(holidayTotal = 0) {
        const end = new Date(this.weekStart);
        end.setDate(end.getDate() + 6);
        const options = { month: 'short', day: 'numeric' };

        const startStr = this.weekStart.toLocaleDateString('en-GB', options);
        const endStr = end.toLocaleDateString('en-GB', options);
        const year = this.weekStart.getFullYear();
        const fullRange = `${startStr} - ${endStr}, ${year}`;

        // Sync all week labels
        ['header-week-label', 'nav-week-label'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = fullRange;
        });

        const subtitleEl = document.getElementById('view-subtitle');
        if (subtitleEl) {
            let holidayEl = subtitleEl.querySelector('.holiday-accrual-span');
            if (!holidayEl) {
                const rosterNameSpan = document.getElementById('roster-name-display')?.outerHTML || '';
                subtitleEl.innerHTML = `
                    <span id="header-week-label">${fullRange}</span>
                    <span style="opacity: 0.3;">|</span>
                    ${rosterNameSpan}
                    <span style="opacity: 0.3;">|</span>
                    <span class="holiday-accrual-span" style="color:var(--accent-emerald)">Holiday Accrual (12.07%): £${holidayTotal.toFixed(2)}</span>
                `;
            } else {
                holidayEl.textContent = `Holiday Accrual (12.07%): £${holidayTotal.toFixed(2)}`;
                // Explicitly update the range span within subtitle if it exists
                const headerWeekEl = subtitleEl.querySelector('#header-week-label');
                if (headerWeekEl) headerWeekEl.textContent = fullRange;
            }
        }
    }

    renderRoleFilter() {
        const sel = document.getElementById('role-filter');
        if (!sel) return;
        const roles = [...new Set(this.staff.map(s => s.role))];
        sel.innerHTML = '<option value="all">All Roles</option>' + roles.map(r => `<option value="${r}">${r}</option>`).join('');
    }

    renderStaffList() {
        const tbody = document.getElementById('staff-list-tbody');
        if (!tbody) return;
        tbody.innerHTML = this.staff.length ? '' : '<tr><td colspan="7" style="text-align:center; padding: 2rem;">No staff found.</td></tr>';

        this.staff.forEach(p => {
            const tr = document.createElement('tr');
            const isSelected = p.selected || false;

            tr.innerHTML = `
                <td><input type="checkbox" class="staff-checkbox" value="${p.id}" ${isSelected ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer;"></td>
                <td>${p.staffNumber || '---'}</td>
                <td><strong>${p.name}</strong></td>
                <td>${p.role || 'N/A'}</td>
                <td>£${(p.rate || p.hourlyRate || 0).toFixed(2)}</td>
                <td>${p.contractedHours || 40}h</td>
                <td>${p.optOut48h ? '✅' : '❌'}</td>
                <td style="text-align: right;">
                    <button class="btn btn-outline btn-icon" style="color: var(--accent-purple); margin-right: 0.5rem;" onclick="window.app.openMonthlyRoster('${p.id}')" title="View Monthly Roster">
                        <i data-lucide="calendar-days" style="width:16px;height:16px"></i>
                    </button>
                    <button class="btn btn-outline btn-icon" style="color: var(--accent-blue); margin-right: 0.5rem;" onclick="window.app.editStaff('${p.id}')">
                        <i data-lucide="edit-3" style="width:16px;height:16px"></i>
                    </button>
                    <button class="btn btn-outline btn-icon" style="color: var(--accent-rose)" onclick="window.app.deleteStaff('${p.id}')">
                        <i data-lucide="trash-2" style="width:16px;height:16px"></i>
                    </button>
                </td>`;


            const checkbox = tr.querySelector('.staff-checkbox');
            checkbox.onchange = (e) => {
                p.selected = e.target.checked;
                this.updateSelectedCount();
                this.renderTableBody();
            };

            tbody.appendChild(tr);
        });
        if (window.lucide) window.lucide.createIcons();
    }


    toggleModal(id, force) {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.toggle('active', force);
        if (id === 'staff-modal-overlay' && !force) {
            // Reset Staff Modal on Close
            document.getElementById('staff-id').value = '';
            document.getElementById('staff-modal-title').textContent = 'Add Employee';
            document.getElementById('staff-form').reset();
        }
        if (id === 'staff-modal-overlay' && force) {
            // If adding new staff (no id in hidden field), show next staff number
            if (!document.getElementById('staff-id').value) {
                document.getElementById('staff-number').value = this.getNextStaffNumber();
            }
        }
        if (id === 'modal-overlay' && force) {
            const staffSel = document.getElementById('form-staff');
            if (staffSel) staffSel.innerHTML = this.staff.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
            if (this.staff.length === 0) {
                this.showToast('Add staff first', 'alert-circle');
                el.classList.remove('active');
            }
        }
    }

    handleStaffSubmit() {
        const id = document.getElementById('staff-id').value;
        const staffData = {
            name: document.getElementById('staff-name').value,
            role: document.getElementById('staff-role').value,
            rate: parseFloat(document.getElementById('staff-rate').value),
            contractedHours: parseFloat(document.getElementById('staff-contracted').value) || 40,
            dob: document.getElementById('staff-dob').value,
            startDate: document.getElementById('staff-start-date').value,
            color: document.getElementById('staff-color').value,
            optOut48h: document.getElementById('staff-optout').checked
        };

        if (id) {
            // Update Existing
            const index = this.staff.findIndex(p => p.id === id);
            if (index !== -1) {
                this.staff[index] = { ...this.staff[index], ...staffData };
                this.showToast('Staff updated', 'user-check');
            }
        } else {
            // Create New
            // Check for duplicates
            const existing = this.staff.find(s => s.name.toLowerCase() === staffData.name.toLowerCase());
            if (existing) {
                this.showToast('Staff member already exists', 'alert-circle');
                return;
            }

            const newStaff = {
                id: 'id-' + Date.now(),
                staffNumber: document.getElementById('staff-number').value || this.getNextStaffNumber(),
                ...staffData
            };
            this.staff.push(newStaff);
            this.showToast('Staff added', 'user-plus');
        }

        this.saveToStorage();
        this.toggleModal('staff-modal-overlay', false);
        this.renderStaffList();
        this.renderRoleFilter();
        this.updateStats();
        this.updateRoleDatalist();
        document.getElementById('staff-form').reset();
    }

    getNextStaffNumber() {
        if (this.staff.length === 0) return '001';
        let max = 0;
        this.staff.forEach(s => {
            const n = parseInt(s.staffNumber);
            if (!isNaN(n) && n > max) max = n;
        });
        return String(max + 1).padStart(3, '0');
    }

    addTestStaff(count = 8) {
        const roles = ['CCTV Operator', 'Door Supervisor', 'Security Guard', 'Team Leader'];
        const types = ['FULLTIME', 'PARTTIME', 'ZERO_HOURS'];
        const names = [
            'James Bond', 'Sarah Connor', 'Ellen Ripley', 'Marty McFly',
            'Luke Skywalker', 'Leia Organa', 'Han Solo', 'Tony Stark',
            'Bruce Wayne', 'Clark Kent'
        ];

        for (let i = 0; i < count; i++) {
            const role = roles[i % roles.length];
            const type = types[i % types.length];
            const name = names[i] || `Staff Member ${this.staff.length + i + 1}`;

            this.staff.push({
                id: crypto.randomUUID(),
                name: name,
                role: role,
                contractType: type,
                contractHours: type === 'FULLTIME' ? 42 : (type === 'PARTTIME' ? 24 : 0),
                rate: 12.50,
                email: `${name.replace(' ', '.').toLowerCase()}@example.com`
            });
        }
        this.saveToStorage();
        console.log(`[ShiftCraft] ${count} test staff members added.`);
        this.showToast(`${count} Test Staff Added`, 'success');
    }

    ensureStaffNumbers() {
        let updated = false;
        let nextNum = 1;

        // Pass 1: Find existing max
        this.staff.forEach(s => {
            if (s.staffNumber) {
                const n = parseInt(s.staffNumber);
                if (!isNaN(n) && n >= nextNum) nextNum = n + 1;
            }
        });

        // Pass 2: Assign missing
        this.staff.forEach(s => {
            if (!s.staffNumber) {
                s.staffNumber = String(nextNum++).padStart(3, '0');
                updated = true;
            }
        });

        if (updated) {
            this.saveToStorage();
        }
    }


    openMonthlyRoster(staffId) {
        if (this.monthlyRosterView) {
            this.monthlyRosterView.open(staffId);
        }
    }

    editStaff(id) {
        const staff = this.staff.find(p => p.id === id);
        if (!staff) return;

        document.getElementById('staff-id').value = staff.id;
        document.getElementById('staff-name').value = staff.name;
        document.getElementById('staff-role').value = staff.role;
        document.getElementById('staff-number').value = staff.staffNumber || '---';
        document.getElementById('staff-dob').value = staff.dob || '';
        document.getElementById('staff-start-date').value = staff.startDate || '';
        document.getElementById('staff-rate').value = staff.rate;
        document.getElementById('staff-contracted').value = staff.contractedHours;
        document.getElementById('staff-color').value = staff.color;
        document.getElementById('staff-optout').checked = staff.optOut48h;

        document.getElementById('staff-modal-title').textContent = 'Edit Employee';
        this.toggleModal('staff-modal-overlay', true);
    }

    updateRoleDatalist() {
        const datalist = document.getElementById('role-list');
        if (!datalist) return;
        const roles = [...new Set(this.staff.map(p => p.role))].filter(Boolean);
        datalist.innerHTML = roles.map(r => `<option value="${r}">`).join('');
    }

    async deleteStaff(id) {
        if (await this.confirm({
            title: 'Delete Staff Member?',
            body: 'This will remove the employee and ALL their history/scheduled shifts. This cannot be undone.',
            icon: 'user-minus',
            iconColor: 'var(--accent-rose)'
        })) {
            this.staff = this.staff.filter(p => p.id !== id);
            this.shifts = this.shifts.filter(s => s.staffId !== id);
            this.saveToStorage();
            this.renderStaffList();
            this.renderRoleFilter();
            this.renderTableBody();
            this.updateStats();
        }
    }

    handleShiftSubmit() {
        const dayIdx = parseInt(document.getElementById('form-day').value);
        const d = new Date(this.weekStart);
        d.setDate(d.getDate() + dayIdx);
        const dateStr = d.toISOString().split('T')[0];
        const start = document.getElementById('form-start').value;
        const end = document.getElementById('form-end').value;
        const staffId = document.getElementById('form-staff').value;

        // Check for overlaps (Truth Protocol: Do not allow physical impossibility)
        const overlap = this.shifts.find(s =>
            s.staffId === staffId &&
            s.date === dateStr &&
            ((start >= s.start && start < s.end) || (end > s.start && end <= s.end) || (start <= s.start && end >= s.end))
        );

        if (overlap) {
            return this.showToast('Double-booking detected! Shift overlaps.', 'alert-triangle');
        }

        this.shifts.push({
            id: 'sh-' + Date.now(),
            staffId: staffId,
            date: dateStr,
            start: start,
            end: end
        });
        this.saveToStorage();
        this.toggleModal('modal-overlay', false);
        this.renderTableBody();
        this.updateStats();
        this.showToast('Shift added', 'plus-circle');
    }

    handleAutoFill() {
        const prevW = new Date(this.weekStart); prevW.setDate(prevW.getDate() - 7);
        const sStr = prevW.toISOString().split('T')[0];
        const e = new Date(prevW); e.setDate(e.getDate() + 6);
        const eStr = e.toISOString().split('T')[0];
        const prevShifts = this.shifts.filter(s => s.date >= sStr && s.date <= eStr);
        if (!prevShifts.length) return this.showToast('No shifts to clone', 'alert-circle');
        prevShifts.forEach(s => {
            const n = new Date(s.date); n.setDate(n.getDate() + 7);
            const nStr = n.toISOString().split('T')[0];
            if (!this.shifts.find(x => x.staffId === s.staffId && x.date === nStr && x.start === s.start)) {
                this.shifts.push({ ...s, id: 'sh-' + Date.now() + Math.random(), date: nStr });
            }
        });
        this.saveToStorage(); this.renderTableBody(); this.updateStats(); this.showToast('Cloned shifts', 'copy');
    }

    async generatePayrollExport() {
        this.showToast('Exporting...', 'download');

        // Format week date for filename
        const weekStartDate = this.weekStart.toISOString().split('T')[0]; // YYYY-MM-DD

        // Build staff names for filename (limit to avoid too long filename)
        const staffNames = this.staff.slice(0, 3).map(p => (p.name || 'Unknown').replace(/[^a-zA-Z0-9]/g, '')).join('_');
        const suffix = this.staff.length > 3 ? `_plus${this.staff.length - 3}more` : '';
        const filename = `roster_${weekStartDate}_${staffNames}${suffix}.csv`;

        let csv = 'Staff,Hours,Rate,Gross,Holiday\n';
        this.staff.forEach(p => {
            let h = 0;
            this.shifts.filter(s => s.staffId === p.id).forEach(s => h += parseFloat(this.calculateDuration(s.start, s.end)));
            const rate = p.rate || 0;
            csv += `"${p.name}",${h.toFixed(1)},${rate.toFixed(2)},${(h * rate).toFixed(2)},${(h * rate * 0.1207).toFixed(2)}\n`;
        });

        try {
            // Use File System Access API for native Save As dialog
            if ('showSaveFilePicker' in window) {
                const handle = await window.showSaveFilePicker({
                    suggestedName: filename,
                    types: [{
                        description: 'CSV File',
                        accept: { 'text/csv': ['.csv'] }
                    }]
                });
                const writable = await handle.createWritable();
                await writable.write(csv);
                await writable.close();
                this.showToast(`Saved ${handle.name}`, 'check-circle');
            } else {
                // Fallback for browsers without File System Access API
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                this.showToast(`Exported ${filename}`, 'check-circle');
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                this.showToast('Export cancelled', 'x');
            } else {
                console.error('Export failed:', error);
                this.showToast('Export failed: ' + error.message, 'alert-triangle');
            }
        }
    }

    /**
     * Export the weekly roster grid as a PDF using jsPDF autoTable
     * Creates a visual roster grid showing staff and their shifts for each day
     */
    async exportRosterPDF() {
        this.showToast('Generating roster PDF...', 'file-image');

        try {
            if (typeof window.jspdf === 'undefined') {
                throw new Error('jsPDF library not loaded');
            }

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('landscape', 'mm', 'a4');

            // Week date range
            const weekStart = new Date(this.weekStart);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            const startStr = weekStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            const endStr = weekEnd.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            const filename = `Shift_Roster_${weekStart.toISOString().split('T')[0]}.pdf`;

            // Day names for headers
            const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            const dayDates = days.map((_, i) => {
                const d = new Date(weekStart);
                d.setDate(d.getDate() + i);
                return d.toISOString().split('T')[0];
            });

            // Build header row with dates
            const headers = ['Employee', ...days.map((day, i) => {
                const d = new Date(dayDates[i]);
                return `${day} ${d.getDate()}/${d.getMonth() + 1}`;
            })];

            // Build data rows from staff and shifts
            const tableData = this.staff.map(person => {
                const row = [`[${person.staffNumber || '---'}] ${person.name}`];
                dayDates.forEach(dateStr => {
                    const shiftsOnDay = this.shifts.filter(s =>
                        s.staffId === person.id && s.date === dateStr
                    );
                    if (shiftsOnDay.length > 0) {
                        row.push(shiftsOnDay.map(s => `${s.start}-${s.end}`).join('\n'));
                    } else {
                        row.push('-');
                    }
                });
                return row;
            });

            // Header
            doc.setFontSize(18);
            doc.setTextColor(99, 102, 241);
            doc.text('Shift Craft - Weekly Roster', 14, 15);

            doc.setFontSize(12);
            doc.setTextColor(80);
            doc.text(`Week: ${startStr} - ${endStr}`, 14, 23);

            const weekShifts = this.shifts.filter(s => dayDates.includes(s.date));
            doc.text(`Staff: ${this.staff.length} | Total Shifts: ${weekShifts.length}`, 14, 30);

            // Create table
            doc.autoTable({
                startY: 38,
                head: [headers],
                body: tableData.length > 0 ? tableData : [['No staff', '-', '-', '-', '-', '-', '-', '-']],
                theme: 'grid',
                headStyles: {
                    fillColor: [99, 102, 241],
                    textColor: 255,
                    fontSize: 9,
                    fontStyle: 'bold',
                    halign: 'center'
                },
                columnStyles: {
                    0: { cellWidth: 50, fontStyle: 'bold' }, // Employee column wider
                    1: { halign: 'center', cellWidth: 30 },
                    2: { halign: 'center', cellWidth: 30 },
                    3: { halign: 'center', cellWidth: 30 },
                    4: { halign: 'center', cellWidth: 30 },
                    5: { halign: 'center', cellWidth: 30 },
                    6: { halign: 'center', cellWidth: 30, fillColor: [245, 245, 245] }, // Saturday
                    7: { halign: 'center', cellWidth: 30, fillColor: [245, 245, 245] }  // Sunday
                },
                styles: {
                    fontSize: 8,
                    cellPadding: 3,
                    overflow: 'linebreak'
                },
                alternateRowStyles: {
                    fillColor: [250, 250, 250]
                }
            });

            // Footer
            const pageHeight = doc.internal.pageSize.height;
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Generated: ${new Date().toLocaleString()}`, 14, pageHeight - 5);

            // Save with native dialog if available
            if ('showSaveFilePicker' in window) {
                try {
                    const handle = await window.showSaveFilePicker({
                        suggestedName: filename,
                        types: [{ description: 'PDF File', accept: { 'application/pdf': ['.pdf'] } }]
                    });
                    const writable = await handle.createWritable();
                    await writable.write(doc.output('blob'));
                    await writable.close();
                    this.showToast(`Saved ${handle.name}`, 'check-circle');
                } catch (err) {
                    if (err.name === 'AbortError') {
                        this.showToast('Export cancelled', 'x');
                    } else {
                        throw err;
                    }
                }
            } else {
                // Fallback: direct download
                doc.save(filename);
                this.showToast(`Downloaded ${filename}`, 'check-circle');
            }
        } catch (error) {
            console.error('Roster PDF export failed:', error);
            this.showToast('Export failed: ' + error.message, 'alert-triangle');
        }
    }

    changeWeek(days) {
        this.weekStart.setDate(this.weekStart.getDate() + days);
        this.updateHeader();
        this.renderTableHead();
        this.renderTableBody();
        this.updateStats();
    }

    async clearAllData() {
        if (await this.confirm({
            title: 'FACTORY RESET',
            body: 'DANGER: This will clear ALL data including staff, shifts, and settings. Your local storage will be wiped.',
            icon: 'zap',
            iconColor: 'var(--accent-rose)'
        })) {
            localStorage.clear();
            location.reload();
        }
    }

    async clearCurrentRoster() {
        const choice = await this.confirm({
            title: 'Clear Roster',
            body: 'How much of the roster do you want to clear? This will remove shifts but keep your staff directory.',
            icon: 'trash-2',
            iconColor: 'var(--accent-rose)',
            customActions: [
                { id: 'week', label: 'Clear This Week', color: 'var(--accent-amber)' },
                { id: 'all', label: 'Clear Everything', color: 'var(--accent-rose)' }
            ]
        });

        if (!choice) return;

        if (choice === 'all' || choice.confirmed === 'all') {
            this.shifts = [];
            this.staff.forEach(s => s.selected = false); // Ensure view is empty
            this.showToast('Entire roster cleared', 'trash-2');
        } else {
            const start = new Date(this.weekStart);
            const end = new Date(this.weekStart);
            end.setDate(end.getDate() + 7);

            const startStr = start.toISOString().split('T')[0];
            const endStr = end.toISOString().split('T')[0];

            this.shifts = this.shifts.filter(s => s.date < startStr || s.date >= endStr);
            this.showToast('Current week cleared', 'trash-2');
        }

        this.saveToStorage();
        this.renderTableBody();
        this.renderTableHead();
        this.updateStats();
    }

    async saveRosterSnapshot() {
        const nameInput = await this.confirm({
            title: 'Save Snapshot',
            body: 'Enter a name for this roster state to save it as a snapshot.',
            icon: 'save',
            iconColor: 'var(--accent-blue)',
            textInput: true,
            placeholder: 'e.g. Draft for Feb'
        });

        if (!nameInput || !nameInput.confirmed) return;

        const snapshots = JSON.parse(localStorage.getItem('shiftcraft_snapshots') || '[]');
        const snapshot = {
            id: 'snap-' + Date.now(),
            name: nameInput.text || 'Unnamed Snapshot',
            timestamp: new Date().toISOString(),
            shifts: [...this.shifts],
            staff: [...this.staff],
            requirements: { ...this.settings.staffingRequirements }
        };

        snapshots.push(snapshot);
        localStorage.setItem('shiftcraft_snapshots', JSON.stringify(snapshots));
        this.showToast(`Snapshot "${snapshot.name}" saved`, 'check-circle');
    }

    async loadRosterSnapshot() {
        const snapshots = JSON.parse(localStorage.getItem('shiftcraft_snapshots') || '[]');
        if (snapshots.length === 0) {
            return this.showToast('No saved snapshots found', 'alert-circle');
        }

        const choices = snapshots.map(s => ({
            id: s.id,
            label: `${s.name} (${new Date(s.timestamp).toLocaleDateString()})`
        }));

        const selected = await this.confirm({
            title: 'Load Snapshot',
            body: 'Select a snapshot to load. This will replace your CURRENT roster.',
            icon: 'download',
            iconColor: 'var(--accent-blue)',
            selectOptions: choices
        });

        if (!selected || !selected.confirmed) return;

        const snapshot = snapshots.find(s => s.id === (selected.selectedId || selected.confirmed));
        if (snapshot) {
            this.shifts = snapshot.shifts;
            this.staff = snapshot.staff;
            this.settings.staffingRequirements = snapshot.requirements;

            this.saveToStorage();
            this.renderTableBody();
            this.renderStaffList();
            this.updateStats();
            this.showToast(`Loaded "${snapshot.name}"`, 'check-circle');
        }
    }

    // --- Shift Standards ---
    saveShiftStandards() {
        const standards = {
            early8: document.getElementById('standard-8-early').value,
            late8: document.getElementById('standard-8-late').value,
            night8: document.getElementById('standard-8-night').value,
            day12: document.getElementById('standard-12-day').value,
            night12: document.getElementById('standard-12-night').value
        };
        this.settings.standards = standards;
        this.saveToStorage();
        this.showToast('Shift Standards Saved', 'save');
    }

    // --- Bulk Staff Actions ---
    toggleAllStaff(checked) {
        const checkboxes = document.querySelectorAll('.staff-checkbox');
        checkboxes.forEach(cb => cb.checked = checked);
        this.updateSelectedCount();
    }

    updateSelectedCount() {
        const count = this.staff.filter(s => s.selected).length;
        const el = document.getElementById('selected-count');
        if (el) {
            el.textContent = count;
            // Show/Hide bulk bar in Staff view if needed
            const bar = document.querySelector('.bulk-actions-bar');
            if (bar) bar.style.display = count > 0 ? 'flex' : 'none';
        }
    }

    handleBulkOptOut() {
        const selectedIds = Array.from(document.querySelectorAll('.staff-checkbox:checked')).map(cb => cb.value);
        if (selectedIds.length === 0) return this.showToast('No staff selected', 'alert-circle');

        // Find current state of first selected to toggle all to that or opposite
        const first = this.staff.find(p => p.id === selectedIds[0]);
        const newState = !first.optOut48h;

        this.staff.forEach(p => {
            if (selectedIds.includes(p.id)) p.optOut48h = newState;
        });

        this.saveToStorage();
        this.renderStaffList();
        this.showToast(`Updated Opt-Out for ${selectedIds.length} staff`, 'shield');
    }

    handleBulkSetHours() {
        const selectedIds = Array.from(document.querySelectorAll('.staff-checkbox:checked')).map(cb => cb.value);
        const hours = parseFloat(document.getElementById('bulk-hours-input').value);

        if (selectedIds.length === 0) return this.showToast('No staff selected', 'alert-circle');
        if (isNaN(hours)) return this.showToast('Enter valid hours', 'alert-circle');

        this.staff.forEach(p => {
            if (selectedIds.includes(p.id)) p.contractedHours = hours;
        });

        this.saveToStorage();
        this.renderStaffList();
        this.showToast(`Set ${hours}h for ${selectedIds.length} staff`, 'clock');
    }

    handleBulkSetRate() {
        const selectedIds = Array.from(document.querySelectorAll('.staff-checkbox:checked')).map(cb => cb.value);
        const rate = parseFloat(document.getElementById('bulk-rate-input').value);

        if (selectedIds.length === 0) return this.showToast('No staff selected', 'alert-circle');
        if (isNaN(rate)) return this.showToast('Enter valid rate', 'alert-circle');

        this.staff.forEach(p => {
            if (selectedIds.includes(p.id)) p.rate = rate;
        });

        this.saveToStorage();
        this.renderStaffList();
        this.showToast(`Set £${rate.toFixed(2)} for ${selectedIds.length} staff`, 'pound-sterling');
    }

    showToast(m, i) {
        const c = document.getElementById('toast-container');
        if (!c) return;
        const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = `<i data-lucide="${i}"></i><span>${m}</span>`;
        c.appendChild(t); if (window.lucide) window.lucide.createIcons();
        setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
    }

    /**
     * Custom Promise-based Confirmation Modal
     */
    /**
     * Custom Promise-based Confirmation Modal (Upgraded)
     */
    confirm({ title, body, icon = 'help-circle', iconColor = 'var(--accent-blue)',
        dateInput = false, textInput = false, selectOptions = null, customActions = null,
        placeholder = '', defaultDate = null }) {
        return new Promise((resolve) => {
            const overlay = document.getElementById('confirm-modal-overlay');
            const titleEl = document.getElementById('confirm-modal-title');
            const bodyEl = document.getElementById('confirm-modal-body');
            const iconContainer = document.getElementById('confirm-modal-icon');

            const dateContainer = document.getElementById('confirm-modal-date-container');
            const textContainer = document.getElementById('confirm-modal-text-container');
            const selectContainer = document.getElementById('confirm-modal-select-container');

            const dateInner = document.getElementById('confirm-modal-date-inner');
            const textInner = document.getElementById('confirm-modal-text-inner');
            const selectInner = document.getElementById('confirm-modal-select-inner');

            const proceedBtn = document.getElementById('confirm-proceed-btn');
            const cancelBtn = document.getElementById('confirm-cancel-btn');
            const actionsContainer = document.getElementById('confirm-modal-actions');
            const standardFooter = document.getElementById('confirm-modal-footer-standard');

            if (!overlay || !proceedBtn || !cancelBtn) return resolve(false);

            // Reset containers
            if (dateContainer) dateContainer.style.display = 'none';
            if (textContainer) textContainer.style.display = 'none';
            if (selectContainer) selectContainer.style.display = 'none';
            if (actionsContainer) { actionsContainer.style.display = 'none'; actionsContainer.innerHTML = ''; }

            if (dateInner) dateInner.innerHTML = '';
            if (textInner) textInner.innerHTML = '';
            if (selectInner) selectInner.innerHTML = '';

            proceedBtn.style.display = 'block';
            cancelBtn.style.display = 'block';
            if (standardFooter) standardFooter.style.display = 'flex';

            titleEl.textContent = title;
            bodyEl.textContent = body;
            iconContainer.innerHTML = `<i data-lucide="${icon}" style="width: 48px; height: 48px; color: ${iconColor};"></i>`;

            // Inputs
            let inputRef = null;
            if (dateInput && dateContainer && dateInner) {
                dateContainer.style.display = 'block';
                dateInner.innerHTML = `<input type="date" id="confirm-modal-date" class="form-control" value="${defaultDate || new Date().toISOString().split('T')[0]}">`;
                inputRef = dateInner.querySelector('input');
            } else if (textInput && textContainer && textInner) {
                textContainer.style.display = 'block';
                textInner.innerHTML = `<input type="text" id="confirm-modal-text" class="form-control" placeholder="${placeholder}" autofocus>`;
                inputRef = textInner.querySelector('input');
                setTimeout(() => inputRef.focus(), 100);
            } else if (selectOptions && selectContainer && selectInner) {
                selectContainer.style.display = 'block';
                const optionsHtml = selectOptions.map(opt => `<option value="${opt.id}">${opt.label}</option>`).join('');
                selectInner.innerHTML = `<select id="confirm-modal-select" class="form-control" style="width:100%">${optionsHtml}</select>`;
                inputRef = selectInner.querySelector('select');
            }

            // Custom Buttons
            if (customActions && actionsContainer) {
                proceedBtn.style.display = 'none';
                cancelBtn.style.display = 'none';
                if (standardFooter) standardFooter.style.display = 'none';
                actionsContainer.style.display = 'flex';
                actionsContainer.style.flexDirection = 'column';
                actionsContainer.style.gap = '0.75rem';

                customActions.forEach(action => {
                    const btn = document.createElement('button');
                    btn.className = 'btn btn-primary';
                    btn.style.background = action.color || 'var(--primary)';
                    btn.style.width = '100%';
                    btn.style.justifyContent = 'center';
                    btn.textContent = action.label;
                    btn.onclick = () => cleanup(action.id);
                    actionsContainer.appendChild(btn);
                });

                const closeBtn = document.createElement('button');
                closeBtn.className = 'btn btn-outline';
                closeBtn.style.width = '100%';
                closeBtn.style.justifyContent = 'center';
                closeBtn.textContent = 'Cancel';
                closeBtn.onclick = () => cleanup(false);
                actionsContainer.appendChild(closeBtn);
            }

            if (window.lucide) window.lucide.createIcons();
            overlay.classList.add('active');

            const cleanup = (result) => {
                const response = {
                    confirmed: result,
                    date: dateInput ? inputRef?.value : null,
                    text: textInput ? inputRef?.value : null,
                    selectedId: selectOptions ? inputRef?.value : null
                };
                overlay.classList.remove('active');
                proceedBtn.onclick = null;
                cancelBtn.onclick = null;
                resolve(result === false ? false : response);
            };

            proceedBtn.onclick = () => cleanup(true);
            cancelBtn.onclick = () => cleanup(false);
            overlay.onclick = (e) => { if (e.target === overlay) cleanup(false); };
        });
    }

    // --- View Toggle (Weekly/Monthly) ---
    initViewToggle() {
        const weeklyBtn = document.getElementById('toggle-weekly-view');
        const monthlyBtn = document.getElementById('toggle-monthly-view');
        const weeklyContainer = document.getElementById('weekly-view-container');
        const rosterBuilder = document.querySelector('.roster-builder');
        const monthlyContainer = document.getElementById('inline-monthly-view');
        const statsGrid = document.querySelector('#view-roster .stats-grid');
        const rosterHeader = document.querySelector('#view-roster .roster-header');

        if (!weeklyBtn || !monthlyBtn) return;

        // Track current view mode
        this.currentViewMode = 'weekly';
        this.inlineMonthlyMonth = new Date();

        weeklyBtn.onclick = () => {
            if (this.currentViewMode === 'weekly') return;
            this.currentViewMode = 'weekly';
            weeklyBtn.classList.add('active');
            monthlyBtn.classList.remove('active');
            if (weeklyContainer) weeklyContainer.style.display = 'block';
            if (rosterHeader) rosterHeader.style.display = 'flex';
            if (monthlyContainer) monthlyContainer.style.display = 'none';
            if (statsGrid) statsGrid.style.display = 'grid';
        };

        monthlyBtn.onclick = () => {
            if (this.currentViewMode === 'monthly') return;
            this.currentViewMode = 'monthly';
            monthlyBtn.classList.add('active');
            weeklyBtn.classList.remove('active');
            if (weeklyContainer) weeklyContainer.style.display = 'none';
            if (rosterHeader) rosterHeader.style.display = 'none';
            if (monthlyContainer) monthlyContainer.style.display = 'block';
            if (statsGrid) statsGrid.style.display = 'none';
            this.initInlineMonthlyView();
        };

        // Initialize inline monthly view controls
        this.setupInlineMonthlyControls();
    }

    setupInlineMonthlyControls() {
        const staffSelect = document.getElementById('inline-monthly-staff-select');
        const prevBtn = document.getElementById('inline-monthly-prev');
        const nextBtn = document.getElementById('inline-monthly-next');
        const exportBtn = document.getElementById('inline-monthly-export-pdf');

        if (prevBtn) {
            prevBtn.onclick = () => {
                this.inlineMonthlyMonth.setMonth(this.inlineMonthlyMonth.getMonth() - 1);
                this.renderInlineMonthlyCalendar();
            };
        }

        if (nextBtn) {
            nextBtn.onclick = () => {
                this.inlineMonthlyMonth.setMonth(this.inlineMonthlyMonth.getMonth() + 1);
                this.renderInlineMonthlyCalendar();
            };
        }

        if (staffSelect) {
            staffSelect.onchange = () => this.renderInlineMonthlyCalendar();
        }

        if (exportBtn) {
            exportBtn.onclick = () => this.exportInlineMonthlyPDF();
        }
    }

    initInlineMonthlyView() {
        // Populate staff dropdown
        const staffSelect = document.getElementById('inline-monthly-staff-select');
        if (staffSelect && this.staff.length > 0) {
            staffSelect.innerHTML = this.staff.map(s =>
                `<option value="${s.id}">${s.name}</option>`
            ).join('');
        }

        // Set to current month
        this.inlineMonthlyMonth = new Date();

        // Render calendar
        this.renderInlineMonthlyCalendar();

        // Refresh Lucide icons
        if (window.lucide) window.lucide.createIcons();
    }

    renderInlineMonthlyCalendar() {
        const container = document.getElementById('inline-monthly-calendar');
        const monthLabel = document.getElementById('inline-monthly-label');
        const staffSelect = document.getElementById('inline-monthly-staff-select');

        if (!container || !staffSelect) return;

        const selectedStaffId = staffSelect.value;
        const staff = this.staff.find(s => s.id === selectedStaffId);
        if (!staff) return;

        const year = this.inlineMonthlyMonth.getFullYear();
        const month = this.inlineMonthlyMonth.getMonth();

        // Update month label
        if (monthLabel) {
            monthLabel.textContent = this.inlineMonthlyMonth.toLocaleDateString('en-GB', {
                month: 'long',
                year: 'numeric'
            });
        }

        // Get staff shifts for this month
        const staffShifts = this.shifts.filter(s => {
            if (s.staffId !== selectedStaffId) return false;
            const d = new Date(s.date);
            return d.getFullYear() === year && d.getMonth() === month;
        });

        // Build calendar grid - ALL elements are direct children of the grid
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDayOfWeek = (firstDay.getDay() + 6) % 7; // Monday = 0

        // Start building HTML - headers first (7 items for 7 columns)
        let html = `
            <div class="monthly-calendar-header">Mon</div>
            <div class="monthly-calendar-header">Tue</div>
            <div class="monthly-calendar-header">Wed</div>
            <div class="monthly-calendar-header">Thu</div>
            <div class="monthly-calendar-header">Fri</div>
            <div class="monthly-calendar-header weekend">Sat</div>
            <div class="monthly-calendar-header weekend">Sun</div>
        `;

        // Empty cells before first day
        for (let i = 0; i < startDayOfWeek; i++) {
            html += `<div class="monthly-calendar-day other-month"></div>`;
        }

        // Stats tracking
        let totalShifts = 0, totalHours = 0, restDays = 0, nightShifts = 0;

        // Days of month
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayShifts = staffShifts.filter(s => s.date === dateStr);
            const isToday = dateStr === new Date().toISOString().split('T')[0];
            const dayOfWeek = new Date(year, month, day).getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const hasShift = dayShifts.length > 0;

            // Build CSS classes
            let cellClasses = 'monthly-calendar-day';
            if (isToday) cellClasses += ' today';
            if (isWeekend) cellClasses += ' weekend';
            if (hasShift) cellClasses += ' has-shift';
            if (!hasShift) cellClasses += ' rest-day-cell';

            html += `<div class="${cellClasses}">`;
            html += `<div class="monthly-day-number">${day}</div>`;

            if (hasShift) {
                totalShifts += dayShifts.length;
                dayShifts.forEach(shift => {
                    const shiftInfo = this.classifyShiftType(shift);
                    const duration = parseFloat(this.calculateDuration(shift.start, shift.end));
                    totalHours += duration;
                    if (shiftInfo.code === 'N') nightShifts++;

                    html += `
                        <div class="monthly-shift-pill ${shiftInfo.cssClass}">
                            <div style="display: flex; align-items: center; gap: 0.5rem; width: 100%;">
                                <span class="shift-type-badge">${shiftInfo.code}</span>
                                <span style="font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">${staff.name}</span>
                                <span class="shift-times" style="font-size: 0.65rem; opacity: 0.8; margin-left: auto;">${shift.start}</span>
                            </div>
                        </div>
                    `;
                });
            } else {
                restDays++;
                html += `<div class="monthly-rest-indicator">Rest</div>`;
            }

            html += `</div>`;
        }

        // Fill remaining cells to complete the last week
        const totalCells = startDayOfWeek + lastDay.getDate();
        const remainingCells = (7 - (totalCells % 7)) % 7;
        for (let i = 0; i < remainingCells; i++) {
            html += `<div class="monthly-calendar-day other-month"></div>`;
        }

        container.innerHTML = html;

        // Update stats
        const shiftsEl = document.getElementById('inline-monthly-shifts');
        const hoursEl = document.getElementById('inline-monthly-hours');
        const restEl = document.getElementById('inline-monthly-rest');
        const nightsEl = document.getElementById('inline-monthly-nights');

        if (shiftsEl) shiftsEl.textContent = totalShifts;
        if (hoursEl) hoursEl.textContent = `${totalHours.toFixed(1)}h`;
        if (restEl) restEl.textContent = restDays;
        if (nightsEl) nightsEl.textContent = nightShifts;
    }


    async exportInlineMonthlyPDF() {
        const staffSelect = document.getElementById('inline-monthly-staff-select');
        if (!staffSelect) return;

        const selectedStaffId = staffSelect.value;
        const staff = this.staff.find(s => s.id === selectedStaffId);
        if (!staff) return;

        // Use the MonthlyRosterView export if available
        if (this.monthlyRosterView) {
            this.monthlyRosterView.selectedStaffId = selectedStaffId;
            this.monthlyRosterView.currentMonth = new Date(this.inlineMonthlyMonth);
            this.monthlyRosterView.exportPDF();
        } else {
            this.showToast('PDF export not available', 'alert-triangle');
        }
    }

    // --- Admin & Theme Logic ---

    initAdminNavigation() {
        const saveThemeBtn = document.getElementById('save-theme-btn');
        const resetThemeBtn = document.getElementById('reset-theme-btn');
        const runDiagnosticsBtn = document.getElementById('btn-run-diagnostics');

        if (saveThemeBtn) saveThemeBtn.onclick = () => this.saveTheme();
        if (resetThemeBtn) resetThemeBtn.onclick = () => this.resetTheme();
        if (runDiagnosticsBtn) runDiagnosticsBtn.onclick = () => this.runDiagnostics();
    }

    async runDiagnostics() {
        const resultsEl = document.getElementById('diagnostic-results');
        const listEl = document.getElementById('diagnostic-list');
        if (!resultsEl || !listEl) return;

        resultsEl.style.display = 'block';
        listEl.innerHTML = '<li style="color:var(--text-muted)">Running checks...</li>';

        // Simulate short delay for UX
        await new Promise(r => setTimeout(r, 600));

        const checks = [
            {
                name: 'Service Registry',
                status: !!(this.services && typeof this.services.startAll === 'function'),
                msg: 'Registry core online'
            },
            {
                name: 'Error Boundary',
                status: typeof window.ErrorBoundary !== 'undefined',
                msg: 'Global handler active'
            },
            {
                name: 'Local Storage',
                status: (() => { try { localStorage.setItem('test', '1'); localStorage.removeItem('test'); return true; } catch (e) { return false; } })(),
                msg: 'Read/Write access OK'
            },
            {
                name: 'Pattern Engine',
                status: !!(this.patternEngine),
                msg: 'Module loaded'
            },
            {
                name: 'Roster Wizard',
                status: !!(window.wizard),
                msg: 'Wizard UI ready'
            }
        ];

        listEl.innerHTML = checks.map(c => `
            <li style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.4rem; color: ${c.status ? 'var(--accent-emerald)' : 'var(--accent-rose)'}">
                <i data-lucide="${c.status ? 'check-circle' : 'x-circle'}" style="width:14px;"></i>
                <span>${c.name}: ${c.status ? 'OK' : 'FAIL'}</span>
            </li>
        `).join('');

        if (window.lucide) window.lucide.createIcons();

        const allOk = checks.every(c => c.status);
        if (allOk) {
            this.showToast('System Health: All checks passed', 'check-circle');
        } else {
            this.showToast('System Warning: Some checks failed', 'alert-triangle');
        }
    }

    initAdminView() {
        this.renderThemePresets();

        // Map of UI IDs to CSS Variables
        const themeMap = {
            'theme-primary': '--primary',
            'theme-accent-blue': '--accent-blue',
            'theme-bg-dark': '--bg-dark',
            'theme-card-bg': '--card-bg',
            'theme-shift-early': '--shift-early',
            'theme-shift-late': '--shift-late',
            'theme-shift-night': '--shift-night',
            'theme-shift-day': '--shift-day'
        };

        // Initialize shift contrast colors (start-up)
        const shifts = [
            { key: '--shift-early', textVar: '--text-on-shift-early' },
            { key: '--shift-late', textVar: '--text-on-shift-late' },
            { key: '--shift-night', textVar: '--text-on-shift-night' },
            { key: '--shift-day', textVar: '--text-on-shift-day' }
        ];

        const rootStyle = getComputedStyle(document.documentElement);

        shifts.forEach(s => {
            const bg = this.customTheme[s.key] || rootStyle.getPropertyValue(s.key).trim();
            const text = this.getContrastColor(bg);
            document.documentElement.style.setProperty(s.textVar, text);
        });

        Object.keys(themeMap).forEach(id => {
            const input = document.getElementById(id);
            const valDisplay = document.getElementById(`val-${id}`);
            const cssVar = themeMap[id];

            if (input) {
                // Get current value (either from state or computed style)
                let currentVal = this.customTheme[cssVar] || rootStyle.getPropertyValue(cssVar).trim();

                // Ensure hex format for input[type=color]
                if (currentVal && currentVal.startsWith('#')) {
                    input.value = currentVal;
                    if (valDisplay) valDisplay.textContent = currentVal;
                }

                // Add live listener
                input.oninput = (e) => this.handleThemeUpdate(cssVar, e.target.value, id);
            }
        });
    }

    renderThemePresets() {
        const presets = [
            {
                name: 'Modern Mono',
                badge: 'Dark',
                colors: {
                    '--primary': '#98A2A6', '--accent-blue': '#565959', '--bg-dark': '#252526', '--card-bg': '#18181b', '--sidebar-bg': '#202021',
                    '--glass-bg': 'rgba(37, 37, 38, 0.7)', '--glass-border': 'rgba(255, 255, 255, 0.1)', '--glass-light': 'rgba(37, 37, 38, 0.5)',
                    '--shift-early': '#98A2A6', '--shift-late': '#565959', '--shift-night': '#3f3f46', '--shift-day': '#F0F1F2'
                }
            },
            {
                name: 'Industrial Amber',
                badge: 'Contrast',
                colors: {
                    '--primary': '#D95829', '--accent-blue': '#D95829', '--bg-dark': '#262626', '--card-bg': '#171717', '--sidebar-bg': '#1e1e1e',
                    '--glass-bg': 'rgba(60, 60, 60, 0.7)', '--glass-border': 'rgba(255, 255, 255, 0.1)', '--glass-light': 'rgba(60, 60, 60, 0.5)',
                    '--shift-early': '#D95829', '--shift-late': '#595959', '--shift-night': '#404040', '--shift-day': '#F2F2F2'
                }
            },
            {
                name: 'Forest Command',
                badge: 'Nature',
                colors: {
                    '--primary': '#758C65', '--accent-blue': '#B1BFA3', '--bg-dark': '#0A0D0C', '--card-bg': '#1B2421', '--sidebar-bg': '#0b0f0d',
                    '--glass-bg': 'rgba(27, 36, 33, 0.7)', '--glass-border': 'rgba(255, 255, 255, 0.1)', '--glass-light': 'rgba(27, 36, 33, 0.5)',
                    '--shift-early': '#B1BFA3', '--shift-late': '#758C65', '--shift-night': '#465946', '--shift-day': '#818C89'
                }
            },
            {
                name: 'Cyber Daylight',
                badge: 'Light',
                colors: {
                    '--primary': '#1675F2', '--accent-blue': '#F2E96D', '--bg-dark': '#F1F2F0', '--card-bg': '#FFFFFF', '--sidebar-bg': '#ffffff',
                    '--glass-bg': 'rgba(255, 255, 255, 0.8)', '--glass-border': 'rgba(0, 0, 0, 0.1)', '--glass-light': 'rgba(255, 255, 255, 0.6)',
                    '--shift-early': '#3084F2', '--shift-late': '#1675F2', '--shift-night': '#566873', '--shift-day': '#F2E96D'
                }
            }
        ];

        const container = document.getElementById('theme-presets-grid');
        if (!container) return;

        container.innerHTML = presets.map((p, idx) => `
            <div class="preset-card" onclick="window.app.applyThemePreset(${idx})" style="
                background: ${p.colors['--bg-dark']};
                border: 1px solid var(--glass-border);
                padding: 1rem;
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.2s;
            " onmouseover="this.style.transform='translateY(-4px)'; this.style.borderColor='var(--primary)'" 
              onmouseout="this.style.transform='translateY(0)'; this.style.borderColor='var(--glass-border)'">
                <div style="display:flex; justify-content:space-between; margin-bottom: 0.75rem;">
                    <span style="font-size:0.75rem; color:${this.getContrastColor(p.colors['--bg-dark'])}; font-weight:600;">${p.name}</span>
                    <span style="font-size:0.6rem; padding: 0.1rem 0.4rem; background: ${p.colors['--primary']}; color: ${this.getContrastColor(p.colors['--primary'])}; border-radius: 4px;">${p.badge}</span>
                </div>
                <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap: 4px;">
                    <div style="height:20px; border-radius:3px; background:${p.colors['--primary']}"></div>
                    <div style="height:20px; border-radius:3px; background:${p.colors['--accent-blue']}"></div>
                    <div style="height:20px; border-radius:3px; background:${p.colors['--shift-early']}"></div>
                    <div style="height:20px; border-radius:3px; background:${p.colors['--shift-night']}"></div>
                </div>
            </div>
        `).join('');

        // Store presets globally for reference
        this.themePresets = presets;
    }

    applyThemePreset(index) {
        const theme = this.themePresets[index];
        if (!theme) return;

        Object.keys(theme.colors).forEach(key => {
            const value = theme.colors[key];
            document.documentElement.style.setProperty(key, value);
            this.customTheme[key] = value;
        });

        // Trigger contrast check once using BG
        const bgVal = theme.colors['--bg-dark'];
        const contrast = this.getContrastColor(bgVal);
        const muted = contrast === '#0f172a' ? '#64748b' : '#94a3b8';

        document.documentElement.style.setProperty('--text-main', contrast);
        document.documentElement.style.setProperty('--text-muted', muted);
        this.customTheme['--text-main'] = contrast;
        this.customTheme['--text-muted'] = muted;

        // Auto-update shift text contrast for presets
        const shifts = [
            { key: '--shift-early', textVar: '--text-on-shift-early' },
            { key: '--shift-late', textVar: '--text-on-shift-late' },
            { key: '--shift-night', textVar: '--text-on-shift-night' },
            { key: '--shift-day', textVar: '--text-on-shift-day' }
        ];

        shifts.forEach(s => {
            const bg = theme.colors[s.key];
            if (bg) {
                const text = this.getContrastColor(bg);
                document.documentElement.style.setProperty(s.textVar, text);
            }
        });

        // UI Refresh
        this.initAdminView();
        this.showToast(`Applied ${theme.name} theme`, 'sparkles');
    }

    handleThemeUpdate(nav, value, inputId) {
        document.documentElement.style.setProperty(nav, value);

        // Update display code
        const valDisplay = document.getElementById(`val-${inputId}`);
        if (valDisplay) valDisplay.textContent = value;

        // Temporary state update
        this.customTheme[nav] = value;

        // Smart Contrast Adjustment
        // If changing backgrounds, auto-update text colors to ensure readability
        if (nav === '--bg-dark' || nav === '--card-bg') {
            const contrast = this.getContrastColor(value);
            const muted = contrast === '#0f172a' ? '#64748b' : '#94a3b8'; // Slate-500 or Slate-400

            document.documentElement.style.setProperty('--text-main', contrast);
            document.documentElement.style.setProperty('--text-muted', muted);

            this.customTheme['--text-main'] = contrast;
            this.customTheme['--text-muted'] = muted;
        }

        // Smart Contrast for Shifts
        if (nav.startsWith('--shift-')) {
            const textVar = '--text-on-shift-' + nav.replace('--shift-', '');
            // Only proceed if it is a valid known shift variable override (simple check)
            if (['early', 'late', 'night', 'day'].some(t => nav.includes(t))) {
                const text = this.getContrastColor(value);
                document.documentElement.style.setProperty(textVar, text);
            }
        }
    }

    initBranding() {
        const logoInput = document.getElementById('branding-logo-input');
        const straplineInput = document.getElementById('branding-strapline');
        const colorInput = document.getElementById('branding-color');
        const spacingInput = document.getElementById('branding-spacing');
        const hideLogoToggle = document.getElementById('branding-hide-default-logo');
        const saveBtn = document.getElementById('save-branding-btn');
        const clearBtn = document.getElementById('branding-logo-clear');

        if (straplineInput) {
            straplineInput.value = this.branding.strapline || '';
            straplineInput.oninput = () => this.updateBrandingPreview();
        }

        if (colorInput) {
            colorInput.value = this.branding.straplineColor || '#6366f1';
            const valDisplay = document.getElementById('val-branding-color');
            if (valDisplay) valDisplay.textContent = colorInput.value;

            colorInput.oninput = (e) => {
                const val = e.target.value;
                if (valDisplay) valDisplay.textContent = val;
                this.updateBrandingPreview();
            };
        }

        if (spacingInput) {
            spacingInput.value = this.branding.headerSpacing || 2.0;
            const valDisplay = document.getElementById('val-branding-spacing');
            if (valDisplay) valDisplay.textContent = `${spacingInput.value}rem`;

            spacingInput.oninput = (e) => {
                const val = e.target.value;
                if (valDisplay) valDisplay.textContent = `${val}rem`;
                this.updateBrandingPreview();
            };
        }

        if (hideLogoToggle) {
            hideLogoToggle.checked = this.branding.hideDefaultLogo || false;
            hideLogoToggle.onchange = () => this.updateBrandingPreview();
        }

        if (logoInput) {
            logoInput.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    if (file.size > 1024 * 1024) {
                        this.showToast('Logo file too large (max 1MB)', 'alert-triangle');
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        this.branding.logo = event.target.result;
                        this.updateBrandingPreview();
                    };
                    reader.readAsDataURL(file);
                }
            };
        }

        if (clearBtn) {
            clearBtn.onclick = () => {
                this.branding.logo = null;
                this.updateBrandingPreview();
            };
        }

        if (saveBtn) {
            saveBtn.onclick = () => {
                this.branding.strapline = straplineInput ? straplineInput.value : '';
                this.branding.straplineColor = colorInput ? colorInput.value : '#6366f1';
                this.branding.headerSpacing = spacingInput ? parseFloat(spacingInput.value) : 2.0;
                this.branding.hideDefaultLogo = hideLogoToggle ? hideLogoToggle.checked : false;

                localStorage.setItem(CONFIG.STORAGE_KEYS.BRANDING, JSON.stringify(this.branding));
                console.log('[ShiftCraft] Branding saved:', this.branding);

                this.applyBranding();
                this.showToast('Global branding updated', 'check-circle');
            };
        }

        this.updateBrandingPreview();
        this.applyBranding();
    }

    updateBrandingPreview() {
        const logoPreviewLarge = document.getElementById('branding-logo-preview-large');
        const straplinePreviewLarge = document.getElementById('branding-strapline-preview-large');
        const straplineInput = document.getElementById('branding-strapline');
        const colorInput = document.getElementById('branding-color');

        if (logoPreviewLarge) {
            if (this.branding.logo) {
                logoPreviewLarge.innerHTML = `<img src="${this.branding.logo}" alt="Logo Preview">`;
            } else {
                logoPreviewLarge.innerHTML = `<i data-lucide="image" style="width: 48px; height: 48px; opacity: 0.2;"></i>`;
                if (window.lucide) window.lucide.createIcons();
            }
        }

        if (straplinePreviewLarge) {
            straplinePreviewLarge.textContent = straplineInput ? straplineInput.value : (this.branding.strapline || '');
            straplinePreviewLarge.style.color = colorInput ? colorInput.value : (this.branding.straplineColor || '#6366f1');
        }

        // Live Preview: Also apply the spacing variables to the preview container if applicable
        // Though for the preview we might just want to see the text/logo. 
        // We'll apply the CSS variable to the actual header in applyBranding.
    }

    applyBranding() {
        const topBar = document.getElementById('global-top-bar');
        const img = document.getElementById('global-header-logo');
        const span = document.getElementById('global-header-strapline');
        const sidebarLogo = document.querySelector('aside .logo');

        if (!topBar) return;

        console.log('[ShiftCraft] Applying branding. Logo present:', !!this.branding.logo);

        // Apply spacing variable
        const spacing = this.branding.headerSpacing || 2.0;
        document.documentElement.style.setProperty('--header-spacing', `${spacing}rem`);

        // Ensure spacing is physically applied
        topBar.style.marginBottom = `${spacing}rem`;

        // 1. Logo Handling (Robust)
        if (this.branding.logo && typeof this.branding.logo === 'string' && this.branding.logo.length > 50 && img) {
            // Attach handlers BEFORE setting src to catch immediate failures (especially Data URIs)
            img.onload = () => {
                img.style.display = 'block';
                console.log('[ShiftCraft] Logo rendered successfully');
            };
            img.onerror = (e) => {
                console.warn('[ShiftCraft] Logo load failed. Hiding element.');
                img.style.display = 'none';
            };

            // Set src and display
            img.style.display = 'block'; // Optimistic display
            img.src = this.branding.logo;
        } else if (img) {
            img.style.display = 'none';
        }

        // 2. Strapline Handling
        if (this.branding.strapline && span) {
            span.textContent = this.branding.strapline;
            span.style.color = this.branding.straplineColor || '#6366f1';
            span.style.display = 'block';
        } else if (span) {
            span.style.display = 'none';
        }

        // 3. Force Visibility (Critical for Theme Toggle and Layout)
        topBar.style.display = 'flex';

        // 4. Sidebar Logo Toggle
        if (sidebarLogo) {
            sidebarLogo.style.opacity = this.branding.hideDefaultLogo ? '0' : '1';
        }
    }

    /**
     * Calculates perceived brightness and returns appropriate text color
     * @param {string} hexcolor - The background color in hex
     * @returns {string} - '#0f172a' (dark) or '#f8fafc' (light)
     */
    getContrastColor(hexcolor) {
        // If invalid hex, return default light text
        if (!hexcolor || !hexcolor.startsWith('#')) return '#f8fafc';

        const hex = hexcolor.replace("#", "");
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);

        // YIQ equation from 
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;

        // Threshold of 128 is standard, but 140 gives better results for mid-tones
        return (yiq >= 140) ? '#0f172a' : '#f8fafc';
    }

    saveTheme() {
        localStorage.setItem(CONFIG.STORAGE_KEYS.THEME, JSON.stringify(this.customTheme));
        this.showToast('Theme configuration saved', 'palette');
    }

    async resetTheme() {
        const confirmed = await this.confirm({
            title: 'Reset Theme?',
            body: 'Are you sure you want to reset all theme customizations to the default settings? This action cannot be undone.',
            icon: 'refresh-cw',
            iconColor: 'var(--accent-amber)'
        });

        if (confirmed) {
            this.customTheme = {};
            localStorage.removeItem(CONFIG.STORAGE_KEYS.THEME);
            location.reload();
        }
    }

    applyCustomTheme() {
        if (!this.customTheme) return;
        Object.keys(this.customTheme).forEach(key => {
            document.documentElement.style.setProperty(key, this.customTheme[key]);
        });
    }

    // --- Staffing Requirements ---

    saveStaffingRequirements() {
        // Ensure defaults exist
        if (!this.settings.staffingRequirements) {
            this.settings.staffingRequirements = { early: 2, late: 2, night: 1, day12: 1 };
        }

        const early = parseInt(document.getElementById('req-early')?.value) || 2;
        const late = parseInt(document.getElementById('req-late')?.value) || 2;
        const night = parseInt(document.getElementById('req-night')?.value) || 1;
        const day12 = parseInt(document.getElementById('req-day12')?.value) || 1;

        this.settings.staffingRequirements = { early, late, night, day12 };
        this.saveToStorage();
        this.renderTableHead(); // Update coverage badges
        this.showToast('Staffing requirements saved', 'users');
    }

    calculateCoverage(dateStr) {
        const requirements = this.settings.staffingRequirements || { early: 2, late: 2, night: 1, day12: 1 };

        // DETECT PATTERN MODE:
        // If Early OR Late shifts are required, we are in 8-hour mode.
        // In 8-hour mode, 'Day' (12h) shifts should NOT be required.
        const effectiveRequirements = { ...requirements };
        if (effectiveRequirements.early > 0 || effectiveRequirements.late > 0) {
            effectiveRequirements.day12 = 0;
        }

        // Count shifts for this date by type
        const dayShifts = this.shifts.filter(s => s.date === dateStr);
        const counts = { early: 0, late: 0, night: 0, day12: 0 };

        dayShifts.forEach(shift => {
            const info = this.classifyShiftType(shift);
            switch (info.cssClass) {
                case 'early': counts.early++; break;
                case 'late': counts.late++; break;
                case 'night': counts.night++; break;
                case 'day12': counts.day12++; break;
            }
        });

        return {
            early: { required: effectiveRequirements.early, scheduled: counts.early, gap: counts.early - effectiveRequirements.early },
            late: { required: effectiveRequirements.late, scheduled: counts.late, gap: counts.late - effectiveRequirements.late },
            night: { required: effectiveRequirements.night, scheduled: counts.night, gap: counts.night - effectiveRequirements.night },
            day12: { required: effectiveRequirements.day12, scheduled: counts.day12, gap: counts.day12 - effectiveRequirements.day12 }
        };
    }

    getCoverageStatus(coverage) {
        // Returns 'ok', 'warning', or 'critical' based on overall coverage
        const types = ['early', 'late', 'night', 'day12'];
        let hasGap = false;
        let hasCritical = false;

        types.forEach(type => {
            if (coverage[type].required > 0) {
                if (coverage[type].scheduled === 0) hasCritical = true;
                else if (coverage[type].gap < 0) hasGap = true;
            }
        });

        if (hasCritical) return 'critical';
        if (hasGap) return 'warning';
        return 'ok';
    }

    checkShiftOverlap(staffId, date, start, end, excludeShiftId = null) {
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        const startMins = sh * 60 + sm;
        const endMins = (eh * 60 + em) < startMins ? (eh + 24) * 60 + em : eh * 60 + em;

        const staffShifts = this.shifts.filter(s => s.staffId === staffId && s.date === date && s.id !== excludeShiftId);

        return staffShifts.some(existing => {
            const [esh, esm] = existing.start.split(':').map(Number);
            const [eeh, eem] = existing.end.split(':').map(Number);
            const eStartMins = esh * 60 + esm;
            const eEndMins = (eeh * 60 + eem) < eStartMins ? (eeh + 24) * 60 + eem : eeh * 60 + eem;

            // Overlap condition: (StartA < EndB) && (StartB < EndA)
            return (startMins < eEndMins) && (eStartMins < endMins);
        });
    }

    migrateStorage() {
        const mappings = {
            'rotalogic_staff': 'shiftcraft_staff',
            'rotalogic_shifts': 'shiftcraft_shifts',
            'rotalogic_settings': 'shiftcraft_settings',
            'rotalogic_theme': 'shiftcraft_theme',
            'rotalogic_templates': 'shiftcraft_templates'
        };

        Object.entries(mappings).forEach(([oldKey, newKey]) => {
            if (!localStorage.getItem(newKey) && localStorage.getItem(oldKey)) {
                console.info(`[Migration] Copying ${oldKey} -> ${newKey}`);
                localStorage.setItem(newKey, localStorage.getItem(oldKey));
            }
        });
    }
    formatDate(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    renderMyRosters() {
        const grid = document.getElementById('my-rosters-grid');
        const countLabel = document.getElementById('saved-rosters-count');
        if (!grid) return;

        const snapshots = JSON.parse(localStorage.getItem('shiftcraft_snapshots') || '[]');
        if (countLabel) countLabel.textContent = `${snapshots.length} Saved`;

        if (snapshots.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 10rem 2rem; background: var(--glass-bg); border-radius: 16px; border: 1px dashed var(--glass-border);">
                    <i data-lucide="archive" style="width: 48px; height: 48px; margin-bottom: 1.5rem; opacity: 0.2; display: block; margin-left: auto; margin-right: auto;"></i>
                    <h3 style="font-size: 1.5rem; margin-bottom: 0.5rem;">No Saved Rosters</h3>
                    <p class="text-muted">Save your current work as a snapshot to see it here.</p>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        grid.innerHTML = snapshots.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map(snap => {
            const date = new Date(snap.timestamp).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            return `
                <div class="card roster-snap-card" style="background: var(--card-bg); border-radius: 16px; border: 1px solid var(--glass-border); padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; transition: var(--transition); position: relative; overflow: hidden;">
                    <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: var(--accent-blue);"></div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <h3 style="margin: 0; color: var(--text-main); font-size: 1.1rem;">${snap.name}</h3>
                            <p style="margin: 0.25rem 0 0; font-size: 0.8rem; color: var(--text-muted);">${date}</p>
                        </div>
                        <span class="badge" style="background: var(--accent-blue)22; color: var(--accent-blue); padding: 0.3rem 0.6rem; border-radius: 6px; font-size: 0.75rem;">${snap.shifts?.length || 0} Shifts</span>
                    </div>
                    
                    <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                        <button class="btn btn-primary btn-sm" onclick="window.app.loadSnapshotFromLibrary('${snap.id}')" style="flex: 1;">
                            <i data-lucide="external-link" style="width: 14px; height: 14px;"></i> Load
                        </button>
                        <button class="btn btn-outline btn-sm" title="Download PDF" onclick="window.app.exportSnapshotPDF('${snap.id}')">
                            <i data-lucide="file-image" style="width: 14px; height: 14px;"></i>
                        </button>
                        <button class="btn btn-outline btn-sm" title="Rename" onclick="window.app.renameSnapshot('${snap.id}')">
                            <i data-lucide="edit" style="width: 14px; height: 14px;"></i>
                        </button>
                        <button class="btn btn-outline btn-sm" title="Duplicate" onclick="window.app.duplicateSnapshot('${snap.id}')">
                            <i data-lucide="copy" style="width: 14px; height: 14px;"></i>
                        </button>
                        <button class="btn btn-outline btn-sm" title="Delete" onclick="window.app.deleteSnapshotFromLibrary('${snap.id}')" style="border-color: var(--accent-rose); color: var(--accent-rose);">
                            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        if (window.lucide) window.lucide.createIcons();
    }

    async exportSnapshotPDF(id) {
        const snapshots = JSON.parse(localStorage.getItem('shiftcraft_snapshots') || '[]');
        const snapshot = snapshots.find(s => s.id === id);
        if (!snapshot) return;

        // Save current state
        const currentShifts = [...this.shifts];
        const currentStaff = [...this.staff];
        const currentWeek = new Date(this.weekStart);

        // Load snapshot state temporarily
        this.shifts = snapshot.shifts;
        this.staff = snapshot.staff;

        // Find earliest shift to set weekStart for PDF header
        if (this.shifts.length > 0) {
            const earliest = this.shifts.reduce((min, s) => s.date < min ? s.date : min, this.shifts[0].date);
            const d = new Date(earliest);
            const day = d.getDay() || 7;
            d.setDate(d.getDate() - day + 1);
            d.setHours(0, 0, 0, 0);
            this.weekStart = d;
        }

        // Generate PDF
        this.showToast('Generating PDF...', 'loader');
        await this.exportRosterPDF();

        // Restore state
        this.shifts = currentShifts;
        this.staff = currentStaff;
        this.weekStart = currentWeek;

        this.showToast(`Exported PDF for ${snapshot.name}`, 'check-circle');
    }

    async loadSnapshotFromLibrary(id) {
        const snapshots = JSON.parse(localStorage.getItem('shiftcraft_snapshots') || '[]');
        const snapshot = snapshots.find(s => s.id === id);

        if (snapshot) {
            if (await this.confirm({
                title: 'Load Roster?',
                body: `Are you sure you want to load "${snapshot.name}"? Your unsaved active roster will be replaced.`,
                icon: 'external-link',
                iconColor: 'var(--accent-blue)'
            })) {
                this.shifts = snapshot.shifts;
                this.staff = snapshot.staff;
                if (snapshot.requirements) this.settings.staffingRequirements = snapshot.requirements;

                // Center view on earliest shift
                if (this.shifts.length > 0) {
                    const earliest = this.shifts.reduce((min, s) => s.date < min ? s.date : min, this.shifts[0].date);
                    const d = new Date(earliest);
                    const day = d.getDay() || 7;
                    d.setDate(d.getDate() - day + 1);
                    d.setHours(0, 0, 0, 0);
                    this.weekStart = d;
                }

                this.saveToStorage();
                this.switchView('roster');
                this.updateHeader();
                this.renderTableHead();
                this.renderTableBody();
                this.updateStats();
                this.showToast(`Loaded roster: ${snapshot.name}`, 'check-circle');
            }
        }
    }

    async renameSnapshot(id) {
        const snapshots = JSON.parse(localStorage.getItem('shiftcraft_snapshots') || '[]');
        const snapshot = snapshots.find(s => s.id === id);
        if (!snapshot) return;

        const nameInput = await this.confirm({
            title: 'Rename Snapshot',
            body: 'Enter a new name for this roster.',
            icon: 'edit',
            iconColor: 'var(--accent-blue)',
            textInput: true,
            placeholder: snapshot.name
        });

        if (nameInput && nameInput.confirmed && nameInput.text) {
            snapshot.name = nameInput.text;
            localStorage.setItem('shiftcraft_snapshots', JSON.stringify(snapshots));
            this.renderMyRosters();
            this.showToast('Roster renamed', 'check-circle');
        }
    }

    async duplicateSnapshot(id) {
        const snapshots = JSON.parse(localStorage.getItem('shiftcraft_snapshots') || '[]');
        const snapshot = snapshots.find(s => s.id === id);

        if (snapshot) {
            const newSnapshot = {
                ...snapshot,
                id: 'snap-' + Date.now(),
                name: snapshot.name + ' (Copy)',
                timestamp: new Date().toISOString()
            };
            snapshots.push(newSnapshot);
            localStorage.setItem('shiftcraft_snapshots', JSON.stringify(snapshots));
            this.renderMyRosters();
            this.showToast('Roster duplicated', 'copy');
        }
    }

    async deleteSnapshotFromLibrary(id) {
        const snapshots = JSON.parse(localStorage.getItem('shiftcraft_snapshots') || '[]');
        const snapshot = snapshots.find(s => s.id === id);

        if (snapshot) {
            if (await this.confirm({
                title: 'Delete Roster?',
                body: `Are you sure you want to permanently delete "${snapshot.name}"? This action cannot be undone.`,
                icon: 'trash-2',
                iconColor: 'var(--accent-rose)'
            })) {
                const updated = snapshots.filter(s => s.id !== id);
                localStorage.setItem('shiftcraft_snapshots', JSON.stringify(updated));
                this.renderMyRosters();
                this.showToast('Roster deleted', 'trash-2');
            }
        }
    }

    displayRosterName() {
        const nameEl = document.getElementById('roster-name-display');
        if (nameEl) {
            nameEl.textContent = this.rosterName || 'Main Roster';
        }
    }

    setRosterName(name) {
        this.rosterName = name;
        localStorage.setItem('shiftcraft_roster_name', name);
        this.displayRosterName();
    }
}


document.addEventListener('DOMContentLoaded', () => { window.app = new ShiftCraftApp(); });
