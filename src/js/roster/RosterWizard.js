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
        window.wizard = this;

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

        // Bind navigation events
        const prevBtn = document.getElementById('wizard-prev-btn');
        if (prevBtn) prevBtn.onclick = () => this.prev();

        const nextBtn = document.getElementById('wizard-next-btn');
        if (nextBtn) nextBtn.onclick = () => this.next();

        const finishBtn = document.getElementById('wizard-finish-btn');
        if (finishBtn) finishBtn.onclick = () => this.finish();

        // Try to bind Close button if reachable (fallback)
        const closeBtn = document.querySelector('#roster-wizard-modal .modal-header button');
        if (closeBtn) closeBtn.onclick = () => this.close();
    }

    open() {
        console.log('[RosterWizard] Opening modal...');
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
            prevBtn.disabled = isFirstStep; // Set JS property
            if (isFirstStep) {
                prevBtn.setAttribute('disabled', 'disabled'); // Set HTML attribute
            } else {
                prevBtn.removeAttribute('disabled');
            }
        }
        if (nextBtn) nextBtn.style.display = step === 4 ? 'none' : 'block';
        if (finishBtn) finishBtn.style.display = step === 4 ? 'block' : 'none';

        // Render step specific content
        if (step === 1) this.renderStep1();
        if (step === 2) this.renderStep2();
        if (step === 3) this.renderStep3();
        if (step === 4) this.renderStep4();
    }

    next() {
        if (this.validateStep(this.currentStep)) {
            this.showStep(this.currentStep + 1);
        }
    }

    prev() {
        console.log('[RosterWizard] Prev clicked. Step:', this.currentStep);
        if (this.currentStep > 1) {
            this.showStep(this.currentStep - 1);
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
                    <div class="form-group" style="margin-bottom: 1.5rem; padding: 1rem; background: var(--glass-bg); border-radius: 8px; border: 1px solid var(--glass-border);">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Choose a Pattern Template</label>
                        <select class="form-control" id="pattern-library-selector" style="margin-bottom: 0.5rem;">
                            <option value="">Custom Pattern (Design Your Own)</option>
                            ${this.loadPatternLibraryOptions().map(p =>
                    `<option value="${p.id}">${p.name} - ${p.description}</option>`
                ).join('')}
                        </select>
                        <small style="color: var(--text-muted); display: block;">
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
                        if (e.target.value) {
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

        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

        container.innerHTML = this.config.patternSequence.map((code, idx) => {
            const label = this.config.mode === 'calendar' ? days[idx % 7] : `Day ${idx + 1}`;
            return `
            <div class="pattern-cell" onclick="window.wizard.toggleShift(${idx})" style="
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
    renderStep2() {
        // Calculate counts of shift types in pattern
        const counts = this.config.patternSequence.reduce((acc, code) => {
            if (code !== 'R') acc[code] = (acc[code] || 0) + 1;
            return acc;
        }, {});

        const container = document.getElementById('wizard-resource-inputs');
        if (!container) return;

        // Render input for each distinct shift type found
        const types = Object.keys(counts);
        if (types.length === 0) {
            container.innerHTML = '<p>No shifts defined in pattern.</p>';
            return;
        }

        const shiftNames = {
            'E': 'Early',
            'L': 'Late',
            'N': 'Night',
            'D': 'Day (12h)',
            'C': 'Custom'
        };

        container.innerHTML = `
            <p style="color: var(--text-muted); margin-bottom: 1.5rem;">
                Define how many staff members should work each shift type for proper coverage.
            </p>
        ` + types.map(type => `
            <div class="resource-row" style="margin-bottom: 1.5rem; padding: 1rem; background: var(--glass-bg); border-radius: 8px; border: 1px solid var(--glass-border);">
                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">
                ${shiftNames[type] || type} Shift Coverage
            </label>
            <div style="display: flex; align-items: center; gap: 1rem;">
                <input type="number" min="0" max="20" value="${this.config.requirements[type] !== undefined ? this.config.requirements[type] : 1}" 
                    onchange="window.wizard.updateRequirement('${type}', this.value)"
                    class="form-control" style="width: 80px;">
                <span style="color: var(--text-muted); font-size: 0.9rem;">staff members per ${shiftNames[type] || type} shift</span>
            </div>
                ${type === 'C' ? '<small style="display:block;color:var(--text-muted);margin-top:0.5rem;">Applies to all custom time shifts</small>' : ''}
            </div>
        `).join('') + `
            <div id="headcount-advice" style="margin-top: 2rem; padding: 1rem; background: var(--accent-blue-transparent); border-left: 4px solid var(--accent-blue); border-radius: 4px;">
                <h4 style="margin: 0 0 0.5rem 0; color: var(--accent-blue);">Headcount Assessment</h4>
                <p id="headcount-advice-text" style="margin: 0; font-size: 0.9rem;">
                   Calculating requirements...
                </p>
            </div>
        `;

        this.updateHeadcountAdvice();
    }

    updateRequirement(type, val) {
        this.config.requirements[type] = parseInt(val);
        this.updateHeadcountAdvice();
    }

    updateHeadcountAdvice() {
        const adviceEl = document.getElementById('headcount-advice-text');
        if (!adviceEl) return;

        const needed = this.calculateRequiredStaff();
        const selected = this.config.selectedStaff.length;

        if (needed === 0) {
            adviceEl.textContent = "Please define your pattern in Step 1 first.";
            return;
        }

        let status = '';
        if (selected > needed) {
            status = `<span style="color:var(--accent-amber); font-weight:700;">Surplus Identified:</span> You have ${selected} staff selected, but only <strong>${needed}</strong> are required for this pattern. ${selected - needed} staff will remain unassigned (surplus).`;
        } else if (selected < needed) {
            status = `<span style="color:var(--accent-rose); font-weight:700;">Understaffed:</span> You need <strong>${needed}</strong> staff to maintain this roster, but only have ${selected} selected. Gaps will occur.`;
        } else {
            status = `<span style="color:var(--accent-emerald); font-weight:700;">Balanced:</span> Your selected staff (${selected}) matches the exactly required headcount for this roster.`;
        }

        adviceEl.innerHTML = status;
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

        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:1.25rem; align-items:center; background: var(--glass-light); padding: 0.75rem; border-radius: 8px; border: 1px solid var(--glass-border);">
                <label style="cursor:pointer; display:flex; align-items:center; gap:0.5rem; font-weight: 600;">
                    <input type="checkbox" id="wizard-select-all" onchange="window.wizard.toggleAllStaff(this.checked)" ${this.config.selectedStaff.length === this.app.staff.length ? 'checked' : ''}> Select All
                </label>
                <div style="font-size:0.9rem; font-weight: 700; color: var(--primary);" id="wizard-selection-count">
                    ${this.config.selectedStaff.length} selected
                </div>
            </div>
            <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; max-height: 400px; overflow-y: auto;">
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
                        <input type="checkbox" value="${p.id}" 
                            ${this.config.selectedStaff.includes(p.id) ? 'checked' : ''}
                            onchange="window.wizard.toggleStaff('${p.id}', this.checked)"
                            style="width: 16px; height: 16px; cursor: pointer;">
                        <div>
                            <div style="font-weight: 600;">${p.name}</div>
                            <div style="font-size: 0.8rem; color: var(--text-muted);">${p.role}</div>
                        </div>
                    </label>
                `).join('')}
            </div>
        `;
    }

    toggleStaff(id, checked) {
        if (checked) {
            if (!this.config.selectedStaff.includes(id)) this.config.selectedStaff.push(id);
        } else {
            this.config.selectedStaff = this.config.selectedStaff.filter(sid => sid !== id);
        }

        // Update UI state without full re-render for performance
        const countEl = document.getElementById('wizard-selection-count');
        if (countEl) countEl.textContent = `${this.config.selectedStaff.length} selected`;

        const card = document.querySelector(`.staff-card-select[data-staff-id="${id}"]`);
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
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
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
                            <input type="checkbox" id="wizard-save-pattern" ${this.config.saveToLibrary ? 'checked' : ''} onchange="window.wizard.config.saveToLibrary = this.checked; document.getElementById('wizard-pattern-name').style.display = this.checked ? 'block' : 'none';">
                            <span>Save to "My Patterns"</span>
                        </div>
                        <input type="text" class="form-control" id="wizard-pattern-name" placeholder="Pattern Name" 
                            style="margin-top:0.5rem; display:${this.config.saveToLibrary ? 'block' : 'none'};" 
                            value="${this.config.patternName || ''}"
                            oninput="window.wizard.config.patternName = this.value">
                    </div>
                </div>
                
                <div>
                    <h4 style="margin-bottom:1rem; color:var(--accent-emerald)">Feasibility & Summary</h4>
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
            </div>
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
        const cycleLen = this.config.patternSequence.length; // Source of Truth
        const pattern = this.config.patternSequence;
        const requirements = this.config.requirements;

        let maxRequired = 0;

        // Count occurrences of each shift type in pattern sequence
        const countsInPattern = {};
        pattern.forEach(code => {
            if (code !== 'R') countsInPattern[code] = (countsInPattern[code] || 0) + 1;
        });

        // Types in pattern
        const types = Object.keys(countsInPattern);
        if (types.length === 0) return 0;

        // Calculate needed for each requirement
        types.forEach(code => {
            const reqPerDay = requirements[code] !== undefined ? parseInt(requirements[code], 10) : 1;
            const shiftsInCycle = countsInPattern[code];

            const needed = Math.ceil((reqPerDay * cycleLen) / shiftsInCycle);
            if (needed > maxRequired) maxRequired = needed;
        });

        return maxRequired;
    }

    estimateShifts() {
        const weeks = parseInt(document.getElementById('wizard-weeks')?.value) || 4;
        const totalDays = weeks * 7;
        const requirements = this.config.requirements;

        // Truth Protocol: Generate EXACTLY enough to fill requirements.
        let total = 0;
        Object.keys(requirements).forEach(k => {
            total += (requirements[k] !== undefined ? parseInt(requirements[k], 10) : 0);
        });

        // Only fallback if NO requirements are defined at all (Step 1 state)
        if (Object.keys(requirements).length === 0) {
            return 0;
        }

        return totalDays * total;
    }

    finish() {
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

            console.log(`[RosterWizard] Generating ${this.config.weeks} weeks from ${startDateStr} for ${this.config.selectedStaff.length} staff`);

            // Update App's roster name
            if (this.app.setRosterName) {
                this.app.setRosterName(this.config.rosterName);
            }

            const totalDays = this.config.weeks * 7;
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + totalDays);

            // 1. Clear existing shifts
            if (this.config.clearExisting) {
                const endStr = endDate.toISOString().split('T')[0];
                const selectedStaffIds = this.config.selectedStaff;
                this.app.shifts = this.app.shifts.filter(s => {
                    if (s.date < startDateStr || s.date >= endStr) return true;
                    if (!selectedStaffIds.includes(s.staffId)) return true;
                    return false;
                });
            }

            // 2. Generation Loop
            let shiftsGenerated = 0;
            const selectedStaffIds = this.config.selectedStaff;
            const cycleLen = this.config.patternSequence.length;

            for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
                const currentObj = new Date(startDate);
                currentObj.setDate(currentObj.getDate() + dayOffset);
                const dateStr = currentObj.toISOString().split('T')[0];

                const dayRequirements = {};
                this.config.patternSequence.forEach(c => {
                    if (c !== 'R') {
                        const rawReq = this.config.requirements[c];
                        dayRequirements[c] = parseInt(rawReq !== undefined ? rawReq : 1, 10);
                    }
                });

                const assignedToday = {};
                Object.keys(dayRequirements).forEach(k => assignedToday[k] = 0);
                const unassignedStaff = [];

                // Pass 1: Natural Pattern
                selectedStaffIds.forEach((staffId, staffIdx) => {
                    const patternIdx = (dayOffset + staffIdx) % cycleLen;
                    const code = this.config.patternSequence[patternIdx];

                    if (code !== 'R') {
                        const required = dayRequirements[code] || 0;
                        if (assignedToday[code] < required) {
                            this._createWizardShift(staffId, dateStr, code, patternIdx);
                            assignedToday[code]++;
                            shiftsGenerated++;
                        } else {
                            unassignedStaff.push({ staffId, patternIdx });
                        }
                    }
                });

                // Pass 2: Gap Filling
                Object.keys(dayRequirements).forEach(code => {
                    const required = dayRequirements[code];
                    while (assignedToday[code] < required && unassignedStaff.length > 0) {
                        const candidate = unassignedStaff.shift(); // FIFO for fairness
                        this._createWizardShift(candidate.staffId, dateStr, code, candidate.patternIdx);
                        assignedToday[code]++;
                        shiftsGenerated++;
                    }
                });
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
            if (this.app.updateStats) this.app.updateStats();

            // Save Pattern
            if (this.config.saveToLibrary && this.config.patternName) {
                this.savePatternToLibrary();
            }

            if (shiftsGenerated === 0) {
                this.app.showToast('No shifts generated. Check staff/pattern settings.', 'alert-triangle');
            } else {
                this.app.showToast(`Success! Generated ${shiftsGenerated} shifts.`, 'check-circle');
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

    _createWizardShift(staffId, dateStr, code, patternIdx) {
        let start = '09:00', end = '17:00';
        if (this.config.customShifts && this.config.customShifts[patternIdx]) {
            [start, end] = this.config.customShifts[patternIdx].split('-');
        } else {
            const s = this.app.settings.standards;
            if (code === 'E') { start = s.early8 || '06:00'; end = s.late8 || '14:00'; }
            if (code === 'L') { start = s.late8 || '14:00'; end = s.night8 || '22:00'; }
            if (code === 'N') { start = s.night8 || '22:00'; end = '06:00'; }
            if (code === 'D') { start = s.day12 || '07:00'; end = s.night12 || '19:00'; }
        }

        this.app.shifts.push({
            id: 'sh-wiz-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
            staffId: staffId,
            date: dateStr,
            start: start,
            end: end,
            shiftType: code
        });
    }
}

window.RosterWizard = RosterWizard;
