/**
 * WizardStep2 - Coverage Requirements UI Component
 * Decoupled from RosterWizard.js
 * 
 * Handles the rendering and logic for Step 2 (defining staffing requirements per shift type).
 * Uses pure DOM API (document.createElement) instead of unsafe innerHTML injections.
 */
class WizardStep2 {
    /**
     * @param {HTMLElement} container - The element to render into
     * @param {Object} config - The wizard configuration object (read/write)
     * @param {Object} delegate - Callbacks for business logic dependencies
     */
    constructor(container, config, delegate) {
        this.container = container;
        this.config = config;
        this.delegate = delegate; // Expects: { calculateRequiredStaff, getSelectedStaffCount }
    }

    render() {
        this.container.innerHTML = ''; // Clean slate

        // 1. Calculate counts of shift types in pattern
        const patternCounts = this.config.patternSequence.reduce((acc, code) => {
            if (code !== 'R') acc[code] = (acc[code] || 0) + 1;
            return acc;
        }, {});

        const types = Object.keys(patternCounts);

        if (types.length === 0) {
            const msg = document.createElement('p');
            msg.textContent = 'No shifts defined in pattern.';
            this.container.appendChild(msg);
            return;
        }

        // Inputs for each shift type
        types.forEach(type => {
            const box = document.createElement('div');
            box.className = 'wizard-box';

            let displayName = window.ShiftMapping.toLogical(type);
            let is12h = false;

            // 1. Check Shift Definitions (from Pattern)
            if (this.config.shiftDefinitions && this.config.shiftDefinitions[type]) {
                const s = this.config.shiftDefinitions[type];
                const durMins = window.TimeRange.getDurationMinutes(s.start, s.end);
                if (durMins > 600) is12h = true; // 10h+
            }
            // 2. Default Assumptions (if no definition overrides)
            else if (type === 'D') {
                is12h = true; // Day 12h is standard
            }

            if (is12h) displayName += ' (12h)';

            const label = document.createElement('label');
            label.className = 'wizard-label';
            label.textContent = `${displayName} Shift Coverage`;

            const group = document.createElement('div');
            group.className = 'wizard-input-group';

            const input = document.createElement('input');
            input.type = 'number';
            input.min = '0';
            input.max = '20';
            input.className = 'form-control';
            input.style.width = '80px';

            // Set initial value (default to 1 if undefined, respecting existing config)
            const currentVal = this.config.requirements[type] !== undefined ? this.config.requirements[type] : 1;
            input.value = currentVal;

            // Ensure config is synced with the default visual
            if (this.config.requirements[type] === undefined) {
                this.config.requirements[type] = 1;
            }

            // Event Listener: Update config and advice on change
            const updateHandler = (e) => {
                const val = parseInt(e.target.value) || 0;
                this.config.requirements[type] = val;
                this.updateAdvice();
            };

            input.addEventListener('change', updateHandler);
            input.addEventListener('input', updateHandler); // Responsive update

            const span = document.createElement('span');
            span.className = 'wizard-help-text';
            span.style.marginBottom = '0';
            span.textContent = ` staff members per ${displayName} shift`;

            group.appendChild(input);
            group.appendChild(span);

            box.appendChild(label);
            box.appendChild(group);

            if (type === 'C') {
                const small = document.createElement('small');
                small.className = 'wizard-help-text';
                small.style.marginTop = '0.5rem';
                small.textContent = 'Applies to all custom time shifts';
                box.appendChild(small);
            }

            this.container.appendChild(box);
        });

        // Headers (Missing after previous wipe)
        const helpText = document.createElement('p');
        helpText.className = 'wizard-help-text';
        helpText.textContent = 'Define how many staff members should work each shift type for proper coverage.';
        this.container.insertBefore(helpText, this.container.firstChild);

        // Headcount Advice Section
        this.adviceBox = document.createElement('div');
        this.adviceBox.id = 'headcount-advice';
        this.adviceBox.className = 'wizard-advice-box';

        const h4 = document.createElement('h4');
        h4.className = 'wizard-advice-h4';
        h4.textContent = 'Headcount Assessment';

        this.adviceText = document.createElement('p');
        this.adviceText.id = 'headcount-advice-text';
        this.adviceText.style.margin = '0';
        this.adviceText.style.fontSize = '0.9rem';
        this.adviceText.textContent = 'Calculating requirements...';

        this.adviceBox.appendChild(h4);
        this.adviceBox.appendChild(this.adviceText);
        this.container.appendChild(this.adviceBox);

        // Perform initial advice calculation
        this.updateAdvice();
    }

    updateAdvice() {
        if (!this.adviceText || !this.delegate) return;

        // Delegate business logic calculation
        const needed = this.delegate.calculateRequiredStaff();
        const selected = this.delegate.getSelectedStaffCount();

        if (needed === 0) {
            this.adviceText.textContent = "Please define your pattern in Step 1 first.";
            return;
        }

        // Step 2 is purely requirements definition. Validation happens in Step 3/4.
        const status = `<span style="color:var(--accent-blue); font-weight:700;">Requirement:</span> Based on your input, this pattern requires a minimum of <strong>${needed} Staff Members</strong> to maintain full coverage.`;

        this.adviceText.innerHTML = status;
    }
}

// Expose globally for app compatibility
window.WizardStep2 = WizardStep2;
