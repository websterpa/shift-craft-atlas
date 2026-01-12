/**
 * RosterWizard - UI Controller for Custom Shift Pattern Design & Application
 * 
 * Handles the multi-step process of:
 * 1. Designing a shift pattern (Cyclic or Calendar)
 * 2. Defining resource requirements
 * 3. Selecting staff
 * 4. Applying shifts to the roster
 */
class RosterWizard {
    constructor(app) {
        this.app = app;
        this.patternEngine = new window.PatternEngine(); // Re-use logic

        // Fix: Expose globally so HTML onclick="window.wizard.close()" works
        // (Legacy support, but we are moving to direct bindings)
        window.wizard = this;
        this._controlsBound = false;

        this.currentStep = 1;
        this.config = {
            mode: 'cyclic', // 'cyclic' | 'calendar'
            patternSequence: Array(7).fill('R'),
            cycleLength: 7,
            customShifts: {}, // Defitions if 'Custom' times used
            requirements: {}, // { 'E': 2, 'L': 2 }
            selectedStaff: [],
            rosterName: '',
            startDate: '',
            weeks: 4,
            clearExisting: true,
            saveToLibrary: false,
            patternName: ''
        };

        this.init();
    }

    init() {
        // Will attach event listeners when modal opens or DOM is ready
        console.log('[RosterWizard] Initialized');
        if (this.patternEngine) this.patternEngine.loadLibrary();

        // Initial binding attempt (in case DOM is ready)
        this.bindControls();
    }

    open() {
        console.log('[RosterWizard] Opening modal...');
        this.bindControls(); // Ensure controls are bound

        const modal = document.getElementById('roster-wizard-modal');
        if (modal) {
            modal.classList.add('active');
            this.updateHeaderBadge();
            this.showStep(1);
        } else {
            console.error('Roster Wizard Modal not found in DOM');
            this.app.showToast('Error: Wizard modal missing', 'alert-circle');
        }
    }

    bindControls() {
        if (this._controlsBound) return;

        // Close Button
        const closeBtn = document.getElementById('wizard-close-btn');
        if (closeBtn) {
            closeBtn.onclick = () => this.close();
        }

        // Footer Buttons
        const prevBtn = document.getElementById('wizard-prev-btn');
        if (prevBtn) prevBtn.onclick = () => this.prev();

        const nextBtn = document.getElementById('wizard-next-btn');
        if (nextBtn) nextBtn.onclick = () => this.next();

        const finishBtn = document.getElementById('wizard-finish-btn');
        if (finishBtn) finishBtn.onclick = () => this.finish();

        if (closeBtn && prevBtn && nextBtn) {
            this._controlsBound = true;
            console.log('[RosterWizard] Controls successfully bound');
        }
    }

    close() {
        console.log('[RosterWizard] Closing modal...');
        const modal = document.getElementById('roster-wizard-modal');
        if (modal) modal.classList.remove('active');
        this.reset();
    }

    reset() {
        this.currentStep = 1;
        this.config = {
            mode: 'cyclic', // 'cyclic' | 'calendar'
            patternSequence: Array(7).fill('R'),
            cycleLength: 7,
            customShifts: {}, // Defitions if 'Custom' times used
            requirements: {}, // { 'E': 2, 'L': 2 }
            selectedStaff: [],
            rosterName: '',
            startDate: '',
            weeks: 4,
            clearExisting: true,
            saveToLibrary: false,
            saveToLibrary: false,
            patternName: '',
            sourcePatternName: 'Custom Pattern' // Track selected template
        };
        // Reset inputs
        const cycleInput = document.getElementById('wizard-cycle-input');
        if (cycleInput) cycleInput.value = 7;
        const textInput = document.getElementById('wizard-pattern-text');
        if (textInput) textInput.value = '';

        // Reset dropdown
        const dropdown = document.getElementById('pattern-library-selector');
        if (dropdown) dropdown.value = '';
    }

    showStep(step) {
        this.currentStep = step;

        // Update Step Indicators
        document.querySelectorAll('.wizard-step-auth').forEach(el => {
            const s = parseInt(el.dataset.step);
            el.classList.toggle('active', s === step);
            el.classList.toggle('completed', s < step);
        });

        // Show/Hide Panels
        document.querySelectorAll('.wizard-panel').forEach(el => {
            el.style.display = (parseInt(el.dataset.step) === step) ? 'block' : 'none';
        });

        // Update Footer Buttons
        const prevBtn = document.getElementById('wizard-prev-btn');
        const nextBtn = document.getElementById('wizard-next-btn');
        const finishBtn = document.getElementById('wizard-finish-btn');

        if (prevBtn) {
            const isFirstStep = step === 1;
            prevBtn.disabled = isFirstStep;
            if (isFirstStep) {
                prevBtn.setAttribute('disabled', 'disabled');
            } else {
                prevBtn.removeAttribute('disabled');
            }
        }
        if (nextBtn) {
            nextBtn.style.display = step === 4 ? 'none' : 'block';
        }
        if (finishBtn) {
            finishBtn.style.display = step === 4 ? 'block' : 'none';
        }

        // Render step specific content
        if (step === 1) this.renderStep1();
        if (step === 2) this.renderStep2();
        if (step === 3) this.renderStep3();
        if (step === 4) this.renderStep4();
    }

    prev() {
        if (this.currentStep > 1) {
            this.showStep(this.currentStep - 1);
        }
    }

    next() {
        if (this.validateStep(this.currentStep)) {
            this.showStep(this.currentStep + 1);
        }
    }

    validateStep(step) {
        if (step === 1) {
            if (this.config.patternSequence.every(x => x === 'R')) {
                this.app.showToast('Please add at least one shift to the pattern', 'alert-circle');
                return false;
            }
        }
        if (step === 3) {
            if (this.config.selectedStaff.length === 0) {
                this.app.showToast('Select at least one staff member to apply the pattern to', 'alert-circle');
                return false;
            }
        }
        return true;
    }

    // --- Step 1: Pattern Designer ---
    renderStep1(retryCount = 0) {
        // Wait for pattern library to load to prevent race condition
        if (this.patternEngine && !this.patternEngine.loaded) {
            if (retryCount > 10) {
                console.warn('[RosterWizard] Pattern library load timeout - proceeding without full library');
                // Force load or just proceed to render basic UI
            } else {
                console.log(`[RosterWizard] Waiting for pattern library... (${retryCount}/10)`);
                setTimeout(() => this.renderStep1(retryCount + 1), 200);
                return;
            }
        }

        // Add Pattern Library Selector
        const step1Panel = document.querySelector('.wizard-panel[data-step="1"]');
        if (step1Panel) {
            const existingSelector = step1Panel.querySelector('#pattern-library-selector');
            if (!existingSelector) {
                const selectorHTML = `
                <div class="wizard-box">
                    <label class="wizard-label">Choose a Pattern Template</label>
                    <select class="form-control" id="pattern-library-selector" style="margin-bottom: 0.5rem;">
                        <option value="">Custom Pattern (Design Your Own)</option>
                        ${localStorage.getItem('shiftcraft_wizard_last_run') ? '<option value="LAST_RUN">Restore Last Session (Auto-Saved)</option>' : ''}
                        ${this.loadPatternLibraryOptions().map(p =>
                    `<option value="${p.id}">${p.name} - ${p.description}</option>`
                ).join('')}
                    </select>
                    <small class="wizard-help-text">
                        Select a pre-designed industry pattern or create your own below
                    </small>
                    <div id="wizard-pattern-insight"></div>
                </div>
            `;

                const firstH3 = step1Panel.querySelector('h3');
                if (firstH3) {
                    firstH3.insertAdjacentHTML('afterend', selectorHTML);

                    // Bind event
                    document.getElementById('pattern-library-selector').onchange = (e) => {
                        if (e.target.value === 'LAST_RUN') {
                            this.restoreLastSession();
                        } else if (e.target.value) {
                            this.applyLibraryPattern(e.target.value);
                        } else {
                            // Reset to default when "Custom Pattern" is selected
                            this.config.patternSequence = Array(7).fill('R');
                            this.config.cycleLength = 7;
                            this.renderInsightCard(null);
                            this.updateDesignerUI();
                        }
                    };
                }
            }
        }

        // Mode Toggles
        const cyclicBtn = document.querySelector('#roster-wizard-modal .btn-primary'); // "Cyclic"
        const calendarBtn = document.querySelector('#roster-wizard-modal .btn-outline'); // "Calendar"
        // Note: This robust selector logic relies on static HTML structure, ideally add IDs

        // Setup Mode Listeners if we can find them and haven't bound them
        // For MVP, just assuming the structure from index.html
        if (cyclicBtn && calendarBtn && cyclicBtn.textContent.includes('Cyclic')) {
            cyclicBtn.onclick = () => this.setMode('cyclic');
            calendarBtn.onclick = () => this.setMode('calendar');

            // Update active state visual
            if (this.config.mode === 'cyclic') {
                cyclicBtn.classList.replace('btn-outline', 'btn-primary');
                calendarBtn.classList.replace('btn-primary', 'btn-outline');
            } else {
                cyclicBtn.classList.replace('btn-primary', 'btn-outline');
                calendarBtn.classList.replace('btn-outline', 'btn-primary');
            }
        }

        // Bind inputs
        const cycleInput = document.getElementById('wizard-cycle-input');
        if (cycleInput) {
            cycleInput.oninput = (e) => this.setCycleLength(parseInt(e.target.value));
            cycleInput.value = this.config.cycleLength;
            cycleInput.disabled = (this.config.mode === 'calendar');
        }

        const textInput = document.getElementById('wizard-pattern-text');
        if (textInput) {
            textInput.value = this.config.patternSequence.join(',');
            textInput.oninput = (e) => this.parseSequenceText(e.target.value);
        }

        this.updateDesignerUI();
    }

    setMode(mode) {
        this.config.mode = mode;
        if (mode === 'calendar') {
            this.setCycleLength(7);
        }
        this.renderStep1();
    }

    setCycleLength(len) {
        if (isNaN(len) || len < 1) len = 1;
        if (len > 28) {
            this.app.showToast('Max cycle length is 28 days', 'alert-circle');
            len = 28;
        }
        this.config.cycleLength = len;

        // Resize array
        const current = this.config.patternSequence;
        if (len > current.length) {
            this.config.patternSequence = [...current, ...Array(len - current.length).fill('R')];
        } else {
            this.config.patternSequence = current.slice(0, len);
        }

        this.updateDesignerUI();
    }

    updateHeaderBadge() {
        const header = document.querySelector('#roster-wizard-modal .modal-header h2');
        if (!header) return;

        let badge = document.getElementById('wizard-pattern-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.id = 'wizard-pattern-badge';
            badge.style.cssText = 'font-size: 0.8rem; background: var(--glass-light); padding: 0.25rem 0.5rem; border-radius: 4px; margin-left: 1rem; color: var(--text-muted); font-weight: normal; vertical-align: middle; display: inline-flex; align-items: center; gap: 0.5rem;';
            header.appendChild(badge);
        }

        const name = this.config.sourcePatternName || 'Custom Pattern';

        // Visual indicator
        if (name === 'Custom Pattern') {
            badge.innerHTML = '<i data-lucide="edit-3" style="width:12px;height:12px;"></i> Custom';
            badge.style.color = 'var(--text-muted)';
            badge.style.border = '1px solid transparent';
            badge.style.background = 'transparent';
        } else {
            badge.innerHTML = `<i data-lucide="layout-template" style="width:12px;height:12px;"></i> ${name}`;
            badge.style.color = 'var(--accent-blue)';
            badge.style.border = '1px solid var(--accent-blue)';
            badge.style.background = 'rgba(99, 102, 241, 0.1)';
        }

        if (window.lucide) window.lucide.createIcons();
    }

    renderInsightCard(pattern) {
        const container = document.getElementById('wizard-pattern-insight');
        if (!container) return;

        if (!pattern) {
            container.innerHTML = '';
            return;
        }

        // Analysis Logic
        const codes = pattern.rosterPattern[0];
        const total = codes.length;

        // Count specific types (mapping may vary, checking logic)
        const days = codes.filter(c => c === 'D' || c === 'M' || c === 'A').length;
        const nights = codes.filter(c => c === 'N').length;
        const rest = codes.filter(c => c === 'R' || c === 'X' || c === 'O').length;

        const dayPct = Math.round((days / total) * 100) || 0;
        const nightPct = Math.round((nights / total) * 100) || 0;

        // HTML Generation
        let prosHtml = '';
        if (pattern.advantages) prosHtml = `<ul class="insight-list pros">${pattern.advantages.slice(0, 3).map(a => `<li>${a}</li>`).join('')}</ul>`;

        let consHtml = '';
        if (pattern.disadvantages) consHtml = `<ul class="insight-list cons">${pattern.disadvantages.slice(0, 3).map(d => `<li>${d}</li>`).join('')}</ul>`;

        const resourceNote = nightPct < 20 && nights > 0
            ? `<span><i data-lucide="alert-triangle" style="width:14px; margin-right:4px;"></i>Note: Low night frequency (${nightPct}%) means high headcount required for constant 24/7 night coverage.</span>`
            : `<span><i data-lucide="info" style="width:14px; margin-right:4px;"></i>Designed for ${pattern.teams} teams rotating through cycle.</span>`;

        container.innerHTML = `
            <div class="insight-card">
                <div class="insight-header">
                    <div>
                        <div class="insight-title">${pattern.name}</div>
                        <div class="insight-desc">${pattern.description || 'No description available'}</div>
                    </div>
                    <div style="background:var(--accent-blue); color:white; padding: 4px 8px; border-radius:4px; font-size:0.8rem; font-weight:bold;">
                        ${pattern.cycleDays} Day Cycle
                    </div>
                </div>
                
                <div class="insight-grid">
                    <div class="insight-metric">
                        <div class="insight-metric-label">Staff Efficiency</div>
                        <div class="insight-metric-value">${dayPct}% / ${nightPct}%</div>
                        <div style="font-size:0.7rem; color:var(--text-muted)">Day vs Night Mix</div>
                    </div>
                    <div class="insight-metric">
                        <div class="insight-metric-label">Teams Required</div>
                        <div class="insight-metric-value">${pattern.teams}</div>
                        <div style="font-size:0.7rem; color:var(--text-muted)">Optimal Coverage</div>
                    </div>
                </div>

                <div class="insight-lists">
                    <div>
                        <h5>Advantages</h5>
                        ${prosHtml || '<span style="color:var(--text-muted); font-size:0.85rem;">Standard pattern</span>'}
                    </div>
                    <div>
                        <h5>Challenges</h5>
                        ${consHtml || '<span style="color:var(--text-muted); font-size:0.85rem;">None logged</span>'}
                    </div>
                </div>

                <div class="insight-foot">
                    ${resourceNote}
                </div>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
    }

    updateDesignerUI() {
        const container = document.getElementById('wizard-pattern-grid');
        if (!container) return;

        // Update Grid Columns
        container.style.gridTemplateColumns = `repeat(7, 1fr)`;

        // Event Delegation for Grid
        container.onclick = (e) => {
            const cell = e.target.closest('.pattern-cell');
            if (cell) {
                const idx = parseInt(cell.dataset.index);
                if (!isNaN(idx)) this.toggleShift(idx);
            }
        };

        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

        container.innerHTML = this.config.patternSequence.map((code, idx) => {
            const label = this.config.mode === 'calendar' ? days[idx % 7] : `Day ${idx + 1}`;
            return `
            <div class="pattern-cell" data-index="${idx}" style="
                border: 1px solid var(--glass-border);
                padding: 10px;
                text-align: center;
                border-radius: 8px;
                cursor: pointer;
                background: ${this.getShiftColor(code)};
                color: ${this.getContrastColor(code)};
                position: relative;
                min-height: 80px;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
            ">
                <div style="font-size:0.75rem; text-transform: uppercase; margin-bottom:4px; opacity: 0.8;">${label}</div>
                <div style="font-weight:800; font-size:1.5rem;">${code}</div>
                ${this.config.customShifts[idx] ? `<div style="font-size:0.6rem; margin-top:2px;">${this.config.customShifts[idx]}</div>` : ''}
            </div>
            `;
        }).join('');

        // Sync Text Input
        const textInput = document.getElementById('wizard-pattern-text');
        if (textInput) textInput.value = this.config.patternSequence.join(',');

        // Sync Cycle Length Input (Truth Protocol: UI must reflect selection)
        const cycleInput = document.getElementById('wizard-cycle-input');
        if (cycleInput) cycleInput.value = this.config.cycleLength;

        this.syncRequirements();
    }

    syncRequirements() {
        // Ensure every active code in the sequence has a requirement entry
        this.config.patternSequence.forEach(code => {
            if (code !== 'R' && this.config.requirements[code] === undefined) {
                this.config.requirements[code] = 1;
            }
        });
    }

    parseSequenceText(text) {
        let seq = text.toUpperCase().split(',').map(s => s.trim()).filter(s => s);
        // Map X to R for rest days (refactoring consistency)
        seq = seq.map(s => s === 'X' ? 'R' : s);

        if (seq.length > 0) {
            this.config.patternSequence = seq;
            this.config.cycleLength = seq.length; // Update cycle length to match text

            // Update cycle input
            const cycleInput = document.getElementById('wizard-cycle-input');
            if (cycleInput) cycleInput.value = seq.length;

            this.updateDesignerUI();
        }
    }

    toggleShift(idx) {
        const codes = ['R', 'E', 'L', 'N', 'D', 'C']; // Changed X to R for Rest Day
        const current = this.config.patternSequence[idx];
        let nextIdx = (codes.indexOf(current) + 1) % codes.length;
        let nextCode = codes[nextIdx];

        // Handle Custom Shift
        if (nextCode === 'C') {
            const timeInfo = prompt("Enter Custom Time (Start-End)", "10:00-14:00");
            if (timeInfo && timeInfo.match(/^\d{2}:\d{2}-\d{2}:\d{2}$/)) {
                this.config.customShifts[idx] = timeInfo;
            } else {
                if (timeInfo !== null) this.app.showToast('Invalid format. Use HH:MM-HH:MM', 'alert-circle');
                // Skip 'C' if cancelled or invalid
                nextCode = 'R';
                delete this.config.customShifts[idx];
            }
        } else {
            delete this.config.customShifts[idx];
        }

        this.config.patternSequence[idx] = nextCode;
        this.config.sourcePatternName = 'Custom Pattern'; // Reset to custom on manual edit
        this.updateHeaderBadge();
        this.renderInsightCard(null); // Clear insight card when pattern is manually edited
        this.updateDesignerUI();
    }

    getShiftColor(code) {
        if (code === 'E') return 'var(--shift-early)';
        if (code === 'L') return 'var(--shift-late)';
        if (code === 'N') return 'var(--shift-night)';
        if (code === 'D') return 'var(--shift-day)';
        if (code === 'C') return 'var(--accent-purple)';
        return 'var(--glass-bg)';
    }

    getContrastColor(code) {
        if (['E', 'L', 'N', 'D', 'C'].includes(code)) return '#fff';
        return 'var(--text-main)';
    }

    // --- Pattern Library Integration ---

    /**
     * Load available patterns from Pattern Library
     * @returns {Array} Array of pattern options
     */
    loadPatternLibraryOptions() {
        if (!this.patternEngine || !this.patternEngine.loaded) {
            console.warn('[RosterWizard] Pattern library not loaded');
            return [];
        }

        const patterns = this.patternEngine.getAllPatterns();
        return patterns.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            cycleDays: p.cycleDays,
            rosterPattern: p.rosterPattern
        }));
    }

    restoreLastSession() {
        try {
            const data = localStorage.getItem('shiftcraft_wizard_last_run');
            if (data) {
                const session = JSON.parse(data);
                this.config = { ...this.config, ...session }; // Merge
                if (session.timestamp) delete this.config.timestamp; // Cleanup

                // Update UI state
                const cycleInput = document.getElementById('wizard-cycle-input');
                if (cycleInput) cycleInput.value = this.config.cycleLength;

                const textInput = document.getElementById('wizard-pattern-text');
                if (textInput) textInput.value = this.config.patternSequence.join(',');

                this.setMode(this.config.mode || 'cyclic');
                this.updateDesignerUI();
                this.renderInsightCard({
                    name: session.sourcePatternName || 'Restored Session',
                    description: 'Loaded from previous run',
                    id: 'restored'
                });

                this.app.showToast('Previous session restored', 'rotate-ccw');
            }
        } catch (e) {
            console.error('Failed to restore session:', e);
            this.app.showToast('Could not restore session', 'alert-circle');
        }
    }

    /**
     * Apply a pattern from the library to the wizard
     * @param {string} patternId - Pattern ID to apply
     */
    applyLibraryPattern(patternId) {
        const pattern = this.patternEngine.getPattern(patternId);
        if (!pattern) {
            this.app.showToast('Pattern not found', 'alert-circle');
            return;
        }

        // Validate pattern data structure
        if (!pattern.rosterPattern || !Array.isArray(pattern.rosterPattern) || pattern.rosterPattern.length === 0) {
            console.warn('[RosterWizard] Invalid pattern roster data', pattern);
            this.app.showToast('Pattern data is invalid', 'alert-circle');
            return;
        }

        // Convert first team's rotation to wizard format
        // Map pattern library codes to wizard codes
        const codeMap = {
            'M': 'E',   // Morning → Early
            'A': 'L',   // Afternoon → Late
            'LD': 'D',  // Long Day → Day
            'N': 'N',   // Night → Night
            'X': 'R',   // Map X to R
            'O': 'R',   // Map O to R
            'R': 'R',   // Map R to R
            'D': 'D'    // Day → Day
        };

        const sequence = pattern.rosterPattern[0].map(code => codeMap[code] || code);

        this.config.patternSequence = sequence;
        this.config.cycleLength = sequence.length;
        this.config.mode = 'cyclic'; // Library patterns are cyclic

        this.syncRequirements();
        this.config.sourcePatternName = pattern.name;
        this.updateHeaderBadge();
        this.renderInsightCard(pattern);
        this.updateDesignerUI();
        this.app.showToast(`Applied pattern: ${pattern.name}`, 'check-circle');
    }

    // --- Step 2: Coverage Requirements ---
    // --- Step 2: Coverage Requirements ---
    renderStep2() {
        const container = document.getElementById('wizard-resource-inputs');
        if (!container) return;

        // Use decoupled UI module (Safe First Refactor)
        // Passes container, config, and business logic delegates
        this.step2UI = new window.WizardStep2(container, this.config, {
            calculateRequiredStaff: () => this.calculateRequiredStaff(),
            getSelectedStaffCount: () => this.config.selectedStaff.length
        });

        this.step2UI.render();
    }



    // --- Step 3: Staffing ---
    renderStep3() {
        const container = document.getElementById('wizard-staff-list');
        if (!container) return;

        // Simple check: Do we have staff?
        if (this.app.staff.length === 0) {
            container.innerHTML = '<p class="text-error">No staff found. Please add staff in the Staff Directory first.</p>';
            return;
        }

            <div style="display:flex; justify-content:space-between; margin-bottom:1.25rem; align-items:center; background: var(--glass-light); padding: 0.75rem; border-radius: 8px; border: 1px solid var(--glass-border);">
                <label style="cursor:pointer; display:flex; align-items:center; gap:0.5rem; font-weight: 600;">
                    <input type="checkbox" id="wizard-select-all" ${this.config.selectedStaff.length === this.app.staff.length ? 'checked' : ''}> Select All
                </label>
                <div style="font-size:0.9rem; font-weight: 700; color: var(--primary);" id="wizard-selection-count">
                    ${this.config.selectedStaff.length} selected
                </div>
            </div>
            <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; max-height: 400px; overflow-y: auto;" id="wizard-staff-grid">
                ${this.app.staff.map(p => `
                    <label class="staff-card-select" data-staff-id="${p.id}" style="
                        display: flex; align-items: center; gap: 0.75rem; 
                        padding: 1rem; 
                        background: ${this.config.selectedStaff.includes(p.id) ? 'rgba(99, 102, 241, 0.1)' : 'var(--glass-bg)'}; 
                        border: 1px solid ${this.config.selectedStaff.includes(p.id) ? 'var(--primary)' : 'var(--glass-border)'};
                        border-radius: 8px;
                        cursor: pointer;
                        transition: all 0.2s;
                    ">
                        <input type="checkbox" value="${p.id}" class="staff-checkbox"
                            ${this.config.selectedStaff.includes(p.id) ? 'checked' : ''}
                            style="width: 16px; height: 16px; cursor: pointer;">
                        <div>
                            <div style="font-weight: 600;">${p.name}</div>
                            <div style="font-size: 0.8rem; color: var(--text-muted);">${p.role}</div>
                        </div>
                    </label>
                `).join('')}
            </div>
        `;

        // Bind Events
        const selectAll = document.getElementById('wizard-select-all');
        if (selectAll) {
            selectAll.onchange = (e) => this.toggleAllStaff(e.target.checked);
        }
        
        const grid = document.getElementById('wizard-staff-grid');
        if (grid) {
            grid.onchange = (e) => {
                if (e.target.classList.contains('staff-checkbox')) {
                    this.toggleStaff(e.target.value, e.target.checked);
                }
            };
        }
    }

    toggleStaff(id, checked) {
        if (checked) {
            if (!this.config.selectedStaff.includes(id)) this.config.selectedStaff.push(id);
        } else {
            this.config.selectedStaff = this.config.selectedStaff.filter(sid => sid !== id);
        }

        // Update UI state without full re-render for performance
        const countEl = document.getElementById('wizard-selection-count');
        if (countEl) countEl.textContent = `${ this.config.selectedStaff.length } selected`;

        const card = document.querySelector(`.staff - card - select[data - staff - id="${id}"]`);
        if (card) {
            card.style.border = checked ? '1px solid var(--primary)' : '1px solid var(--glass-border)';
            card.style.background = checked ? 'rgba(99, 102, 241, 0.1)' : 'var(--glass-bg)';
            const checkbox = card.querySelector('input[type="checkbox"]');
            if (checkbox) checkbox.checked = checked;
        }
    }

    toggleAllStaff(checked) {
        if (checked) {
            this.config.selectedStaff = this.app.staff.map(p => p.id);
        } else {
            this.config.selectedStaff = [];
        }
        // Re-render Step 3 to update all visual card states
        this.renderStep3();
    }

    // --- Step 4: Confirm ---
    renderStep4() {
        const container = document.getElementById('wizard-summary');
        if (!container) return;

        const staffNeeded = this.calculateRequiredStaff();
        const staffSelected = this.config.selectedStaff.length;
        const isFeasible = staffSelected >= staffNeeded;

        // Default start date to next Monday if not set
        if (!this.config.startDate) {
            const d = new Date();
            d.setDate(d.getDate() + ((1 + 7 - d.getDay()) % 7));
            this.config.startDate = d.toISOString().split('T')[0];
        }
        const defaultDate = this.config.startDate;

        container.innerHTML = `
            < div style = "display:grid; grid-template-columns: 1fr 1fr; gap: 2rem;" >
                <div>
                    <h4 style="margin-bottom:1rem; color:var(--accent-blue)">Configuration</h4>
                    <div class="form-group">
                        <label>Roster Name</label>
                        <input type="text" class="form-control" id="wizard-roster-name" placeholder="e.g. January Core Roster" value="${this.config.rosterName || ''}">
                    </div>
                    <div class="form-group">
                        <label>Roster Start Date</label>
                        <input type="date" class="form-control" id="wizard-start-date" value="${defaultDate}">
                    </div>
                    <div class="form-group">
                        <label>Repeat for (Weeks)</label>
                        <input type="number" class="form-control" id="wizard-weeks" value="4" min="1" max="52">
                    </div>
                    
                    <div class="form-group" style="margin-top:2rem;">
                        <label style="display:flex; gap:0.5rem; align-items:center; cursor:pointer;">
                            <input type="checkbox" id="wizard-clear-existing" checked>
                            <span style="color:var(--text-main); font-weight:500;">Clear existing shifts for selected staff?</span>
                        </label>
                        <small style="color:var(--accent-rose); display:block; margin-top:0.25rem;">
                            Warning: This will remove all shifts for the selected employees in the target period.
                        </small>
                    </div>

                    <div class="form-group" style="margin-top:1rem;">
                        <label>Save Pattern?</label>
                        <div style="display:flex; gap:0.5rem; align-items:center;">
                            <input type="checkbox" id="wizard-save-pattern" ${this.config.saveToLibrary ? 'checked' : ''}>
                            <span>Save to "My Patterns"</span>
                        </div>
                        <input type="text" class="form-control" id="wizard-pattern-name" placeholder="Pattern Name" 
                            style="margin-top:0.5rem; display:${this.config.saveToLibrary ? 'block' : 'none'};" 
                            value="${this.config.patternName || ''}">
                    </div>
                </div>
                
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                        <h4 style="margin:0; color:var(--accent-emerald)">Feasibility & Summary</h4>
                        <button id="wizard-analyze-btn" class="btn-outline" style="font-size:0.8rem; padding:0.25rem 0.5rem;">
                            <i data-lucide="clipboard-copy" style="width:14px; margin-right:4px;"></i> Copy for Analysis
                        </button>
                    </div>
                    <div style="padding: 1rem; background: ${isFeasible ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)'}; border: 1px solid ${isFeasible ? 'var(--accent-emerald)' : 'var(--accent-rose)'}; border-radius: 8px; margin-bottom: 1.5rem;">
                        <div style="display: flex; align-items: center; gap: 0.75rem; color: ${isFeasible ? 'var(--accent-emerald)' : 'var(--accent-rose)'}; font-weight: 600; font-size: 1.1rem;">
                            <i data-lucide="${isFeasible ? 'check-circle' : 'alert-triangle'}"></i>
                            ${isFeasible ? 'Plan is Feasible' : 'Inadequate Staffing'}
                        </div>
                        <p style="margin-top: 0.5rem; font-size: 0.9rem; color: var(--text-main);">
                            ${isFeasible
                ? `<strong>Optimal Coverage:</strong> You have selected ${staffSelected} members. Minimum required is ${staffNeeded}. The wizard will only use the staff needed to maintain coverage; <strong>${Math.max(0, staffSelected - staffNeeded)} surplus staff will remain unassigned.</strong>`
                : `<span style="color:var(--accent-rose); font-weight:700;">Understaffed:</span> This pattern requires <strong>${staffNeeded}</strong> staff members for full coverage. You only have ${staffSelected} selected. Gaps will occur.`}
                        </p>
                    </div>

                    <ul style="list-style:none; padding-left:0; font-size:0.95rem; color:var(--text-main);">
                        <li style="padding:0.5rem 0; border-bottom:1px solid var(--glass-border);">
                            <strong>Pattern:</strong> ${this.config.patternSequence.filter(x => x !== 'R').length} shifts / ${this.config.cycleLength} days
                        </li>
                        <li style="padding:0.5rem 0; border-bottom:1px solid var(--glass-border);">
                            <strong>Staff Needed:</strong> ${staffNeeded}
                        </li>
                        <li style="padding:0.5rem 0; border-bottom:1px solid var(--glass-border);">
                            <strong>Staff Selected:</strong> ${this.config.selectedStaff.length}
                        </li>
                        <li style="padding:0.5rem 0; border-bottom:1px solid var(--glass-border);">
                            <strong>Est. Shifts Generated:</strong> ${this.estimateShifts()}
                        </li>
                    </ul>
                </div>
            </div >
            `;

        if (window.lucide) window.lucide.createIcons();

        // Toggle name input
        setTimeout(() => {
            const saveCheck = document.getElementById('wizard-save-pattern');
            if (saveCheck) {
                saveCheck.onchange = (e) => {
                    document.getElementById('wizard-pattern-name').style.display = e.target.checked ? 'block' : 'none';
                };
            }
        }, 100);
    }

    calculateRequiredStaff() {
        if (window.RosterLogic) {
            return RosterLogic.calculateRequiredStaff(this.config);
        }
        return 0;
    }

    estimateShifts() {
        const weeks = parseInt(document.getElementById('wizard-weeks')?.value) || 4;
        if (window.RosterLogic) {
            return RosterLogic.estimateShifts(this.config, weeks);
        }
        return 0;
    }
    showAnalytics() {
        const staffNeeded = this.calculateRequiredStaff();
        const staffSelected = this.config.selectedStaff.length;
        const estimatedShifts = this.estimateShifts();

        const analysisData = {
            timestamp: new Date().toISOString(),
            rosterName: this.config.rosterName || 'Unnamed Roster',
            pattern: {
                name: this.config.sourcePatternName || 'Custom',
                sequence: this.config.patternSequence,
                cycleLength: this.config.patternSequence.length,
                shiftCounts: this.config.patternSequence.reduce((acc, c) => { if (c !== 'R') acc[c] = (acc[c] || 0) + 1; return acc; }, {})
            },
            requirements: this.config.requirements,
            staffing: {
                selected: staffSelected,
                required: staffNeeded,
                isFeasible: staffSelected >= staffNeeded,
                surplus: Math.max(0, staffSelected - staffNeeded),
                deficit: Math.max(0, staffNeeded - staffSelected)
            },
            projection: {
                weeks: parseInt(document.getElementById('wizard-weeks')?.value || 4),
                estimatedTotalShifts: estimatedShifts
            }
        };

        const json = JSON.stringify(analysisData, null, 2);

        // Copy to clipboard
        navigator.clipboard.writeText(json).then(() => {
            this.app.showToast('Analytics JSON copied to clipboard!', 'check-circle');
        }).catch(err => {
            console.error('Clipboard failed', err);
            // Fallback: Prompt
            prompt("Copy this JSON:", json);
        });
    }

    showComplianceModal(breaches) {
        const modalId = 'compliance-gate-modal';
        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:9999; display:flex; justify-content:center; align-items:center; backdrop-filter: blur(4px);';
            document.body.appendChild(modal);
        }

        const totalBreaches = breaches.reduce((sum, b) => sum + b.violations.length, 0);
        // Limit staff names list
        let staffNames = breaches.map(b => b.staff).slice(0, 3).join(', ');
        if (breaches.length > 3) staffNames += ` + ${ breaches.length - 3 } others`;

        modal.innerHTML = `
            < div style = "background: #1e1e2e; border: 2px solid var(--accent-rose); width: 90%; max-width: 550px; padding: 2rem; border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);" >
                <div style="display:flex; gap:1rem; align-items:center; margin-bottom:1.5rem; color:var(--accent-rose);">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-alert-octagon"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/></svg>
                    <h2 style="margin:0; font-size:1.5rem; font-weight:700;">Compliance Alert</h2>
                </div>
                
                <p style="margin-bottom:1.5rem; line-height:1.6; color:#e2e8f0; font-size:1.05rem;">
                    The roster generates <strong>${totalBreaches} breach(es)</strong> of Working Time Regulations (Daily Rest).<br>
                    Proceeding without correcting this poses a compliance risk.
                </p>
                
                <div style="background:rgba(226, 88, 88, 0.15); padding:1rem; border-radius:8px; margin-bottom:2rem; border-left:4px solid var(--accent-rose);">
                    <div style="font-weight:700; color:var(--accent-rose); margin-bottom:0.5rem;">Affects:</div>
                    <div style="color:#cbd5e1;">${staffNames}</div>
                </div>

                <div style="display:flex; justify-content:flex-end; gap:1rem;">
                    <button id="gate-fix-btn" style="padding:0.75rem 1.5rem; border-radius:6px; background:transparent; border:1px solid #94a3b8; color:#f1f5f9; cursor:pointer; font-weight:600; font-size:0.95rem;">
                        Go Back & Fix
                    </button>
                    <button id="gate-override-btn" style="padding:0.75rem 1.5rem; border-radius:6px; background:var(--accent-rose); border:none; color:white; cursor:pointer; font-weight:600; font-size:0.95rem; box-shadow: 0 4px 6px -1px rgba(225, 29, 72, 0.3);">
                        Generate Anyway
                    </button>
                </div>
            </div >
            `;

        // Direct binding with safeguards
        const fixBtn = document.getElementById('gate-fix-btn');
        const overBtn = document.getElementById('gate-override-btn');

        if (fixBtn) fixBtn.onclick = () => modal.remove();
        if (overBtn) overBtn.onclick = () => {
            modal.remove();
            this.finish(true);
        };
    }

    finish(override = false) {
        try {
            console.log('[RosterWizard] finish() called');

            // Sync final values from UI
            this.config.startDate = document.getElementById('wizard-start-date')?.value;
            this.config.weeks = parseInt(document.getElementById('wizard-weeks')?.value) || 4;
            this.config.clearExisting = document.getElementById('wizard-clear-existing')?.checked;
            this.config.rosterName = document.getElementById('wizard-roster-name')?.value || 'New Roster';
            this.config.saveToLibrary = document.getElementById('wizard-save-pattern')?.checked;
            this.config.patternName = document.getElementById('wizard-pattern-name')?.value;

            const startDateStr = this.config.startDate;

            // Robust Date Validation
            if (!startDateStr) {
                this.app.showToast('Please select a start date', 'alert-circle');
                return;
            }
            const startDate = new Date(startDateStr);
            if (isNaN(startDate.getTime())) {
                this.app.showToast('Invalid start date format', 'alert-circle');
                return;
            }

            if (!Array.isArray(this.config.selectedStaff) || this.config.selectedStaff.length === 0) {
                this.app.showToast('No staff selected', 'alert-circle');
                return;
            }

            console.log(`[RosterWizard] Generating ${ this.config.weeks } weeks from ${ startDateStr } for ${ this.config.selectedStaff.length } staff`);

            // Save session for restoration
            localStorage.setItem('shiftcraft_wizard_last_run', JSON.stringify({
                ...this.config,
                timestamp: new Date().toISOString()
            }));

            // Update App's roster name
            if (this.app.setRosterName) {
                this.app.setRosterName(this.config.rosterName);
            }

            const totalDays = this.config.weeks * 7;
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + totalDays);

            const endStr = endDate.toISOString().split('T')[0];

            // --- Compliance Decision Gate ---
            // Simulate generation first to check for breaches before committing
            if (!override && window.RosterLogic && this.app.complianceEngine) {
                // 1. Get Base Shifts (Simulation)
                let simulatedShifts = [...this.app.shifts];
                if (this.config.clearExisting) {
                    const selectedStaffIds = this.config.selectedStaff;
                    simulatedShifts = simulatedShifts.filter(s => {
                        if (s.date < startDateStr || s.date >= endStr) return true;
                        if (!selectedStaffIds.includes(s.staffId)) return true;
                        return false;
                    });
                }

                // 2. Generate Draft Shifts
                const draftShifts = RosterLogic.generateShifts(this.config, this.app.settings, simulatedShifts);
                const allDraftShifts = [...simulatedShifts, ...draftShifts];

                // 3. Check for Breaches
                const breaches = [];
                this.config.selectedStaff.forEach(staffId => {
                    const violations = this.app.complianceEngine.checkDailyRest(staffId, allDraftShifts);
                    if (violations.length > 0) {
                        const staff = this.app.staff.find(s => s.id === staffId);
                        breaches.push({ staff: staff ? staff.name : 'Unknown', violations });
                    }
                });

                if (breaches.length > 0) {
                    this.showComplianceModal(breaches);
                    return; // Interrupt Generation - User must decide
                }
            }

            // --- Commit Roster Changes ---

            // Mark Override if chosen
            if (override) {
                this.config.rosterName += " (Non-Compliant)";
                this.app.showToast('Compliance override active', 'alert-triangle');
            }

            // 1. Clear existing shifts (Actual)
            if (this.config.clearExisting) {
                const selectedStaffIds = this.config.selectedStaff;
                this.app.shifts = this.app.shifts.filter(s => {
                    if (s.date < startDateStr || s.date >= endStr) return true;
                    if (!selectedStaffIds.includes(s.staffId)) return true;
                    return false;
                });
            }

            // 2. Generation (Actual)
            let shiftsGenerated = 0;
            if (window.RosterLogic) {
                const newShifts = RosterLogic.generateShifts(this.config, this.app.settings, this.app.shifts);
                this.app.shifts.push(...newShifts);
                shiftsGenerated = newShifts.length;
            } else {
                console.error("RosterLogic module missing");
            }

            // 3. Navigation (Robust)
            const genStart = new Date(startDate);
            if (!isNaN(genStart.getTime())) {
                const day = genStart.getDay();
                const diff = genStart.getDate() - day + (day === 0 ? -6 : 1);
                const newWeekStart = new Date(genStart.setDate(diff));

                if (!isNaN(newWeekStart.getTime())) {
                    this.app.weekStart = newWeekStart;
                    this.app.currentMonth = new Date(startDate);
                }
            }

            this.app.saveToStorage();
            if (this.app.renderTableBody) this.app.renderTableBody();
            if (this.app.renderTableHead) this.app.renderTableHead();
            if (this.app.updateStats) this.app.updateStats();

            // Save Pattern
            if (this.config.saveToLibrary && this.config.patternName) {
                this.savePatternToLibrary();
            }

            if (shiftsGenerated === 0) {
                this.app.showToast('No shifts generated. Check staff/pattern settings.', 'alert-triangle');
            } else {
                this.app.showToast(`Success! Generated ${ shiftsGenerated } shifts.`, 'check-circle');
            }

            this.close();

        } catch (error) {
            console.error('[RosterWizard] Error in finish():', error);
            this.app.showToast('Wizard Error: ' + error.message, 'alert-circle');
        }
    }

    savePatternToLibrary() {
        const myPatterns = JSON.parse(localStorage.getItem('shiftcraft_my_patterns')) || [];
        const newPattern = {
            id: 'p-' + Date.now(),
            name: this.config.patternName,
            description: 'Custom pattern generated via wizard',
            cycleDays: this.config.cycleLength,
            rosterPattern: [this.config.patternSequence], // Save as a single-team rotation for simplicity
            requirements: this.config.requirements,
            created: new Date().toISOString()
        };
        myPatterns.push(newPattern);
        localStorage.setItem('shiftcraft_my_patterns', JSON.stringify(myPatterns));
        console.log('[RosterWizard] Saved pattern to My Patterns:', this.config.patternName);
    }


}

window.RosterWizard = RosterWizard;
