/**
 * PatternLibraryUI - User Interface for Pattern Library
 * 
 * Manages the pattern library modal, pattern cards, filters,
 * pattern preview, and application workflow.
 * 
 * @class PatternLibraryUI
 * @version 1.1.0 (Fixed Synchronization & Overlap Issues)
 */

class PatternLibraryUI {
    /**
     * Create Pattern Library UI
     * @param {PatternEngine} patternEngine - Pattern engine instance
     * @param {ShiftCraftApp} app - Main app instance (for integration)
     */
    constructor(patternEngine, app) {
        this.engine = patternEngine;
        this.app = app;
        this.selectedPatternId = null;
        this.currentFilters = {
            region: 'all',
            industry: 'all',
            query: ''
        };
        this.suggestedStartDate = null; // Store suggested start date from Smart Fill

        this.initializeEventListeners();
    }

    /**
     * Initialize all event listeners
     * @private
     */
    initializeEventListeners() {
        // Open pattern library modal
        const openBtn = document.getElementById('pattern-library-btn');
        if (openBtn) {
            openBtn.onclick = () => this.openLibrary();
        }

        // Close buttons
        document.getElementById('close-pattern-library')?.addEventListener('click', () => {
            this.closeLibrary();
        });

        document.getElementById('cancel-pattern-library')?.addEventListener('click', () => {
            this.closeLibrary();
        });

        // Filters
        document.getElementById('pattern-region-filter')?.addEventListener('change', (e) => {
            this.currentFilters.region = e.target.value;
            this.renderPatternCards();
        });

        document.getElementById('pattern-industry-filter')?.addEventListener('change', (e) => {
            this.currentFilters.industry = e.target.value;
            this.renderPatternCards();
        });

        document.getElementById('pattern-search')?.addEventListener('input', (e) => {
            this.currentFilters.query = e.target.value;
            this.renderPatternCards();
        });

        // Apply pattern button (opens preview)
        document.getElementById('apply-pattern-btn')?.addEventListener('click', () => {
            if (this.selectedPatternId) {
                this.openPreview(this.selectedPatternId);
            }
        });

        // Preview modal controls
        document.getElementById('close-pattern-preview')?.addEventListener('click', () => {
            this.closePreview();
        });

        document.getElementById('back-to-library')?.addEventListener('click', () => {
            this.closePreview();
            this.openLibrary();
        });

        document.getElementById('confirm-apply-pattern')?.addEventListener('click', () => {
            this.applyPattern();
        });

        // Modal overlay click
        document.getElementById('pattern-library-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'pattern-library-modal') {
                this.closeLibrary();
            }
        });

        document.getElementById('pattern-preview-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'pattern-preview-modal') {
                this.closePreview();
            }
        });
    }

    /**
     * Open pattern library modal
     * @param {string} startDate - Optional suggested start date (YYYY-MM-DD)
     */
    async openLibrary(startDate = null) {
        // Store suggested start date if provided
        if (startDate) {
            this.suggestedStartDate = startDate;
        }

        // Load patterns if not already loaded
        if (!this.engine.loaded) {
            try {
                await this.engine.loadLibrary();
            } catch (error) {
                console.error('Failed to load pattern library:', error);
                this.app?.showToast('Failed to load pattern library', 'alert-circle');
                return;
            }
        }

        // Render pattern cards
        this.renderPatternCards();

        // Show modal
        document.getElementById('pattern-library-modal').classList.add('active');

        // Refresh icons
        if (window.lucide) window.lucide.createIcons();
    }

    /**
     * Close pattern library modal
     */
    closeLibrary() {
        document.getElementById('pattern-library-modal').classList.remove('active');
        this.selectedPatternId = null;
        this.updateApplyButton();
    }

    /**
     * Render pattern cards based on current filters
     */
    renderPatternCards() {
        const grid = document.getElementById('pattern-grid');
        if (!grid) return;

        // Build search criteria
        const criteria = {};
        if (this.currentFilters.region !== 'all') {
            criteria.region = this.currentFilters.region;
        }
        if (this.currentFilters.industry !== 'all') {
            criteria.industry = this.currentFilters.industry;
        }
        if (this.currentFilters.query.trim()) {
            criteria.query = this.currentFilters.query;
        }

        // Search patterns
        const patterns = this.engine.search(criteria);

        // Clear grid
        grid.innerHTML = '';

        // No results
        if (patterns.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-muted);">
                    <i data-lucide="search" style="width: 48px; height: 48px; margin-bottom: 1rem;"></i>
                    <p>No patterns found matching your criteria</p>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        // Render each pattern card
        patterns.forEach(pattern => {
            const card = this.createPatternCard(pattern);
            grid.appendChild(card);
        });

        // Refresh icons
        if (window.lucide) window.lucide.createIcons();
    }

    /**
     * Create a pattern card element
     * @param {Object} pattern - Pattern metadata
     * @returns {HTMLElement} Pattern card element
     * @private
     */
    createPatternCard(pattern) {
        const card = document.createElement('div');
        card.className = 'pattern-card';
        card.dataset.patternId = pattern.id;

        // Featured badge
        const featuredBadge = pattern.featured
            ? `<span class="pattern-badge" style="background: var(--accent-emerald); color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">FEATURED</span>`
            : '';

        // Region badge
        const regionColor = {
            'global': 'var(--accent-blue)',
            'uk': 'var(--accent-rose)',
            'us': 'var(--accent-amber)'
        }[pattern.region] || 'var(--text-muted)';

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
                <h3 style="font-size: 1rem; margin: 0; flex: 1;">${pattern.name}</h3>
                ${featuredBadge}
            </div>
            <p style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: 0.75rem; line-height: 1.5;">
                ${pattern.description}
            </p>
            <div style="display: flex; gap: 1rem; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 1rem;">
                <span><i data-lucide="repeat" style="width: 14px; height: 14px;"></i> ${pattern.cycleDays}d</span>
                <span><i data-lucide="users" style="width: 14px; height: 14px;"></i> ${pattern.teams} team${pattern.teams > 1 ? 's' : ''}</span>
                <span style="color: ${regionColor};">
                    <i data-lucide="globe" style="width: 14px; height: 14px;"></i> ${pattern.region.toUpperCase()}
                </span>
            </div>
            <button class="btn btn-outline btn-sm" style="width: 100%;">
                Select Pattern
            </button>
        `;

        // Card styling
        card.style.cssText = `
            background: var(--glass-light);
            border: 2px solid var(--glass-border);
            border-radius: 12px;
            padding: 1rem;
            cursor: pointer;
            transition: all 0.2s ease;
        `;

        // Click handler
        card.onclick = () => this.selectPattern(pattern.id);

        return card;
    }

    /**
     * Select a pattern
     * @param {string} patternId - Pattern ID to select
     */
    selectPattern(patternId) {
        // Deselect previous
        document.querySelectorAll('.pattern-card').forEach(card => {
            card.style.borderColor = 'var(--glass-border)';
            card.style.background = 'var(--glass-light)';
        });

        // Select new
        const card = document.querySelector(`[data-pattern-id="${patternId}"]`);
        if (card) {
            card.style.borderColor = 'var(--accent-blue)';
            card.style.background = 'rgba(99, 102, 241, 0.1)';
        }

        this.selectedPatternId = patternId;
        this.updateApplyButton();
    }

    /**
     * Update apply button state
     * @private
     */
    updateApplyButton() {
        const btn = document.getElementById('apply-pattern-btn');
        if (btn) {
            btn.disabled = !this.selectedPatternId;
        }
    }

    /**
     * Open pattern preview modal
     * @param {string} patternId - Pattern to preview
     */
    async openPreview(patternId) {
        // Load pattern
        const pattern = await this.engine.loadPattern(patternId);
        if (!pattern) {
            this.app?.showToast('Failed to load pattern', 'alert-circle');
            return;
        }

        // Hide library modal (but DON'T reset selectedPatternId - we need it for generation!)
        document.getElementById('pattern-library-modal').classList.remove('active');

        // Populate preview
        document.getElementById('preview-pattern-name').textContent = pattern.name;

        // Pattern info
        const infoEl = document.getElementById('preview-pattern-info');
        if (infoEl) {
            infoEl.innerHTML = `
                <p style="color: var(--text-muted); margin-bottom: 1rem;">${pattern.description}</p>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; padding: 1rem; background: var(--glass-light); border-radius: 8px;">
                    <div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem;">Cycle Length</div>
                        <div style="font-weight: 600;">${pattern.cycleDays} days</div>
                    </div>
                    <div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem;">Teams Required</div>
                        <div style="font-weight: 600;">${pattern.teams}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem;">Avg Hours/Week</div>
                        <div style="font-weight: 600;">${pattern.calculateAverageHoursPerWeek().toFixed(1)}h</div>
                    </div>
                    <div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem;">Region</div>
                        <div style="font-weight: 600;">${pattern.region.toUpperCase()}</div>
                    </div>
                </div>
            `;
        }

        // Pattern visualization
        this.renderPatternVisualization(pattern);

        // Populate day offset dropdown
        const offsetSelect = document.getElementById('pattern-day-offset');
        if (offsetSelect) {
            offsetSelect.innerHTML = '';
            for (let i = 0; i < pattern.cycleDays; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = `Day ${i + 1} (${pattern.rosterPattern[0][i]})`;
                offsetSelect.appendChild(option);
            }
        }

        // Set start date - use suggested date if available, otherwise default to current roster week
        let defaultStartDate;
        if (this.suggestedStartDate) {
            defaultStartDate = this.suggestedStartDate;
            this.suggestedStartDate = null;
        } else if (this.app && this.app.weekStart) {
            defaultStartDate = this.app.weekStart.toISOString().split('T')[0];
        } else {
            const today = new Date();
            const dayOfWeek = today.getDay() || 7;
            const nextMonday = new Date(today);
            nextMonday.setDate(today.getDate() + (8 - dayOfWeek));
            defaultStartDate = nextMonday.toISOString().split('T')[0];
        }
        document.getElementById('pattern-start-date').value = defaultStartDate;

        // Show preview modal
        document.getElementById('pattern-preview-modal').classList.add('active');

        // Refresh icons
        if (window.lucide) window.lucide.createIcons();
    }

    /**
     * Render pattern visualization
     * @param {ShiftPattern} pattern - Pattern to visualize
     * @private
     */
    renderPatternVisualization(pattern) {
        const vizEl = document.getElementById('preview-pattern-viz');
        if (!vizEl) return;

        let html = '<div style="background: var(--glass-light); border-radius: 8px; padding: 1rem;">';
        html += '<div style="font-size: 0.875rem; font-weight: 600; margin-bottom: 1rem;">Roster Pattern</div>';

        // Show first team's pattern (or all if only 1 team)
        const teamsToShow = pattern.teams <= 2 ? pattern.rosterPattern.length : 1;

        for (let teamIdx = 0; teamIdx < teamsToShow; teamIdx++) {
            const teamRotation = pattern.rosterPattern[teamIdx];

            html += `<div style="margin-bottom: ${teamIdx < teamsToShow - 1 ? '1rem' : '0'};">`;
            html += `<div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.5rem;">Team ${teamIdx + 1}</div>`;
            html += '<div style="display: flex; gap: 0.25rem; flex-wrap: wrap;">';

            teamRotation.forEach((shiftCode, dayIdx) => {
                const shiftDef = pattern.getShiftByCode(shiftCode);
                const color = shiftDef?.color || '#94a3b8';
                const isOff = shiftCode === 'R' || !shiftDef?.start;

                html += `
                    <div style="
                        width: ${pattern.cycleDays <= 14 ? '40px' : '30px'};
                        height: ${pattern.cycleDays <= 14 ? '40px' : '30px'};
                        background: ${isOff ? 'transparent' : color};
                        border: 2px solid ${isOff ? 'rgba(148, 163, 184, 0.3)' : color};
                        border-radius: 6px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 0.75rem;
                        font-weight: 600;
                        color: ${isOff ? 'var(--text-muted)' : 'white'};
                    " title="Day ${dayIdx + 1}: ${shiftDef?.name || 'Off'}">
                        ${shiftCode}
                    </div>
                `;
            });

            html += '</div></div>';
        }

        if (pattern.teams > 2) {
            html += `<div style="margin-top: 0.75rem; font-size: 0.75rem; color: var(--text-muted); text-align: center;">+${pattern.teams - 1} more teams with offset rotations</div>`;
        }

        html += '</div>';

        // Legend
        html += '<div style="margin-top: 1rem; padding: 0.75rem; background: var(--glass-light); border-radius: 8px;">';
        html += '<div style="font-size: 0.75rem; font-weight: 600; margin-bottom: 0.5rem;">Shift Types</div>';
        html += '<div style="display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.75rem;">';

        pattern.shifts.forEach(shift => {
            if (shift.code === 'R') return; // Skip off days
            html += `
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <div style="width: 16px; height: 16px; background: ${shift.color}; border-radius: 4px;"></div>
                    <span><strong>${shift.code}</strong> = ${shift.name} (${shift.start || 'N/A'})</span>
                </div>
            `;
        });

        html += '</div></div>';

        vizEl.innerHTML = html;
    }

    /**
     * Close pattern preview modal
     */
    closePreview() {
        document.getElementById('pattern-preview-modal').classList.remove('active');
    }

    /**
     * Apply selected pattern to roster
     */
    async applyPattern() {
        if (!this.selectedPatternId) return;

        // Prevent multiple simultaneous executions (fixes flickering dialog bug)
        const btn = document.getElementById('confirm-apply-pattern');
        if (btn?.disabled) return; // Already processing
        const originalText = btn.innerHTML;
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i data-lucide="loader" class="spin"></i> Applying...';
            if (window.lucide) window.lucide.createIcons();
        }

        try {
            // Get configuration
            const startDateStr = document.getElementById('pattern-start-date')?.value;
            const dayOffset = parseInt(document.getElementById('pattern-day-offset')?.value || '0');
            const shouldClear = document.getElementById('pattern-clear-existing')?.checked;

            if (!startDateStr) {
                this.app?.showToast('Please select a start date', 'alert-circle');
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                    if (window.lucide) window.lucide.createIcons();
                }
                return;
            }

            const weeks = parseInt(document.getElementById('pattern-weeks')?.value || '1');
            if (isNaN(weeks) || weeks < 1) {
                this.app?.showToast('Please enter a valid number of weeks (min 1)', 'alert-circle');
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                    if (window.lucide) window.lucide.createIcons();
                }
                return;
            }

            const startDate = new Date(startDateStr);

            // Determine target staff (only selected, or all if none selected)
            const selectedStaff = this.app.staff.filter(s => s.selected);
            const targetStaff = selectedStaff.length > 0 ? selectedStaff : this.app.staff;

            // Load pattern
            const pattern = await this.engine.loadPattern(this.selectedPatternId);
            if (!pattern) {
                this.app?.showToast('Failed to load pattern', 'alert-circle');
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                    if (window.lucide) window.lucide.createIcons();
                }
                return;
            }

            // Confirm with user
            const staffCount = targetStaff.length;
            const teamSize = Math.floor(staffCount / pattern.teams);

            const confirmed = await this.app.confirm({
                title: `Apply ${pattern.name}?`,
                body: `• ${staffCount} staff → ${pattern.teams} teams (${teamSize} staff/team) \n` +
                    `• Start: ${startDate.toLocaleDateString()} (at Day ${dayOffset + 1}) \n` +
                    `• Duration: ${weeks} weeks \n` +
                    (selectedStaff.length > 0 ? `• TARGETING: ${selectedStaff.length} selected employees \n` : `• TARGETING: All employees \n`) +
                    (shouldClear ? `• ⚠️ WARNING: Existing shifts in this range WILL BE CLEARED \n\n` : `\n`) +
                    `Proceed with roster generation?`,
                icon: 'layers',
                iconColor: 'var(--primary)'
            });

            if (!confirmed) {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                    if (window.lucide) window.lucide.createIcons();
                }
                return;
            }

            // Apply pattern with global shift standards and offset
            const generatedShifts = pattern.applyToStaff(targetStaff, startDate, weeks, this.app.settings.standards, dayOffset);

            // Handle clearing existing shifts if requested
            if (shouldClear) {
                const endDate = new Date(startDate);
                endDate.setDate(endDate.getDate() + (weeks * 7));
                const endDateStr = endDate.toISOString().split('T')[0];

                this.app.shifts = this.app.shifts.filter(s => {
                    // If shift belongs to one of the target staff members in the target date range
                    const isTargetStaff = targetStaff.some(staff => staff.id === s.staffId);
                    const isInDateRange = s.date >= startDateStr && s.date < endDateStr;
                    return !(isTargetStaff && isInDateRange);
                });
            }

            // Add shifts
            let added = 0;
            let skipped = 0;

            generatedShifts.forEach(newShift => {
                // Check for conflict (TRUTH PROTOCOL: 1 shift per day per person max unless split-shift)
                const hasConflict = this.app.shifts.some(existing =>
                    existing.staffId === newShift.staffId &&
                    existing.date === newShift.date
                );

                if (!hasConflict) {
                    this.app.shifts.push(newShift);
                    added++;
                } else {
                    skipped++;
                }
            });

            // Save and refresh
            this.app.saveToStorage();
            this.app.renderTableBody();
            this.app.updateStats();

            // Close modals
            this.closePreview();

            // Show success
            this.app?.showToast(
                `✅ Pattern applied: ${added} shifts added` +
                (skipped > 0 ? ` (${skipped} conflicts skipped)` : ''),
                'check-circle'
            );

        } catch (error) {
            console.error('Pattern application failed:', error);
            this.app?.showToast('Failed to apply pattern: ' + error.message, 'alert-circle');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalText;
                if (window.lucide) window.lucide.createIcons();
            }
        }
    }
}

// Global exposure
if (typeof window !== 'undefined') {
    window.PatternLibraryUI = PatternLibraryUI;
}
