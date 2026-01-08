/**
 * AIPatternUI - UI Controller for AI Roster Recognition
 */
class AIPatternUI {
    constructor(app) {
        this.app = app;
        this.parser = new window.DocumentParser();
        this.normalizer = new window.ShiftDataNormalizer();
        this.detector = new window.PatternDetectionEngine();

        this.detectedData = null;
        this.bestPattern = null;
        this.maxCycle = 42; // Supports up to 6-week rosters
        this.mappings = [];
        this.isApplying = false; // Guard against double-execution

        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Global Event Delegation for Modal Actions
        // This ensures buttons work regardless of when they are added to the DOM
        document.addEventListener('click', (e) => {
            // Apply Button
            if (e.target.matches('#ai-apply-btn')) {
                console.log('[AIPatternUI] Apply button clicked via delegation');
                e.preventDefault();
                try {
                    this.applyDetectedPattern();
                } catch (err) {
                    console.error('[AIPatternUI] Error in applyDetectedPattern:', err);
                    this.app.showToast?.('Import failed: ' + err.message, 'error');
                }
            }

            // Close Button (handle icon clicks inside button)
            if (e.target.matches('#close-ai-import') || e.target.closest('#close-ai-import')) {
                this.toggleModal(false);
            }

            // Reset Button
            if (e.target.matches('#ai-reset-btn')) {
                this.showStep('upload');
            }

            // Open Modal Button
            if (e.target.matches('#ai-import-btn')) {
                this.toggleModal(true);
            }
        });

        // Drag & Drop (Keep specific listeners for drag events, but check existence)
        const dropZone = document.getElementById('ai-drop-zone');
        const fileInput = document.getElementById('ai-file-input');

        if (dropZone && fileInput) {
            dropZone.addEventListener('click', () => fileInput.click());

            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('dragging');
            });

            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('dragging');
            });

            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('dragging');
                const file = e.dataTransfer.files[0];
                if (file) this.handleFileUpload(file);
            });
        }

        fileInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.handleFileUpload(file);
        });
    }

    toggleModal(force) {
        document.getElementById('ai-import-modal').classList.toggle('active', force);
        if (force) {
            this.showStep('upload');
            this.isApplying = false; // Reset guard when modal opens
            // Note: Apply button handled via global event delegation in setupEventListeners
        }
    }

    showStep(step) {
        ['upload', 'processing', 'results'].forEach(s => {
            document.getElementById(`ai-step-${s}`).style.display = (s === step) ? 'block' : 'none';
        });

        document.getElementById('ai-modal-footer').style.display = (step === 'results') ? 'flex' : 'none';
    }

    async handleFileUpload(file) {
        this.showStep('processing');
        this.updateProgress(10, 'Reading file...');

        try {
            // 1. Parse Document
            const rawData = await this.parser.parse(file);
            this.updateProgress(40, 'Cleaning data...');

            // 2. Normalize Data
            // If it's Excel/CSV, rawData is a 2D array. If text (PDF/OCR), we normalize differently.
            let grid = [];
            if (Array.isArray(rawData)) {
                grid = rawData;
            } else {
                // Heuristic: split text into lines and words
                grid = rawData.split('\n').map(line => line.trim().split(/\s+/));
            }

            this.detectedData = grid;
            this.updateProgress(70, 'Detecting roster patterns...');

            // 3. Detect Pattern (Look for the most consistent cycle in the grid)
            this.processGridForPatterns(grid);

            this.updateProgress(100, 'Analysis complete!');

            setTimeout(() => {
                this.renderResults();
                this.showStep('results');
            }, 500);

        } catch (error) {
            console.error('AI Processing Failed:', error);
            this.app.showToast('Failed to process file: ' + error.message, 'alert-circle');
            this.showStep('upload');
        }
    }

    updateProgress(percent, text) {
        document.getElementById('ai-progress-bar').style.width = `${percent}%`;
        document.getElementById('ai-status-text').textContent = text;
    }

    processGridForPatterns(grid) {
        // Init Map to store aggregated shift streams per staff
        const staffStreams = new Map(); // Name -> { name, shifts: [] }

        grid.forEach(row => {
            const normalizedRow = row.map(cell => this.normalizer.normalizeShiftCode(cell));
            const shiftCount = normalizedRow.filter(c => ['E', 'L', 'N', 'LD'].includes(c)).length;

            // Heuristic: If row has >2 shift codes, it's likely a roster row
            if (shiftCount > 2) {
                // Try to find a name in the row
                // Look for a cell that is NOT a shift code and has length > 2
                const nameCandidate = row.find(cell =>
                    cell &&
                    cell.length > 2 &&
                    !this.normalizer.normalizeShiftCode(cell).match(/^[ELNR]|LD$/)
                );

                if (nameCandidate) {
                    const normalizedName = this.normalizer.normalizeName(nameCandidate);

                    if (!staffStreams.has(normalizedName)) {
                        staffStreams.set(normalizedName, {
                            name: normalizedName,
                            shifts: []
                        });
                    }

                    // Filter row to just get shift codes (preserving order)
                    // We look for cells that normalize to valid shift codes (including R)
                    // Important: We need to filter out the NAME cell itself if it accidentally normalized to R, 
                    // but our loose 'R' check might catch it. 
                    // Better approach: Take everything that IS a shift code.
                    const shiftsOnly = normalizedRow.filter(cell => cell.match(/^[ELNR]|LD$/));

                    // Add to this staff's stream
                    staffStreams.get(normalizedName).shifts.push(...shiftsOnly);
                }
            }
        });

        // Analyze candidates from aggregated streams
        const candidates = [];
        const staffNames = [];

        staffStreams.forEach((data, name) => {
            staffNames.push(name);
            candidates.push(data.shifts);
        });

        // Analyze all candidates to find a common pattern
        // We look for the most common/high-confidence pattern across all staff
        let best = { pattern: [], cycleLength: 0, confidence: 0 };

        if (candidates.length > 0) {
            const patterns = candidates.map(c => this.detector.detectPattern(c));
            // Sort by confidence
            best = patterns.sort((a, b) => b.confidence - a.confidence)[0];
        }

        this.bestPattern = best;
        this.detectedStaff = staffNames;

        // Match detected staff to existing app.staff
        this.mappings = this.detectMappings(staffNames);
    }

    detectMappings(detectedNames) {
        return detectedNames.map(dName => {
            // Fuzzy search in current staff
            const match = this.app.staff.find(s =>
                s.name.toLowerCase().includes(dName.toLowerCase()) ||
                dName.toLowerCase().includes(s.name.toLowerCase())
            );
            return { detected: dName, matchedId: match ? match.id : null };
        });
    }

    renderResults() {
        const summary = document.getElementById('detected-pattern-summary');
        const grid = document.getElementById('ai-mapping-grid');

        // Render Pattern Summary
        if (this.bestPattern && this.bestPattern.cycleLength > 0) {
            const confidenceClass = this.bestPattern.confidence > 0.8 ? 'confidence-high' :
                (this.bestPattern.confidence > 0.5 ? 'confidence-medium' : 'confidence-low');

            summary.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <h4 style="margin: 0; color: var(--accent-blue);">Detected Rotation</h4>
                        <p style="margin: 0.25rem 0 0.75rem; font-size: 0.9rem;">
                            ${this.bestPattern.cycleLength}-day cycle found
                        </p>
                    </div>
                    <span class="confidence-badge ${confidenceClass}">
                        ${Math.round(this.bestPattern.confidence * 100)}% Confidence
                    </span>
                </div>
                <div class="viz-row">
                    ${this.bestPattern.pattern.map(p => `<div class="viz-cell ${p}">${p}</div>`).join('')}
                </div>
            `;
        } else {
            summary.innerHTML = `<p style="color: var(--accent-rose);">Could not detect a consistent pattern.</p>`;
        }

        // Render Mapping Grid
        grid.innerHTML = '';
        this.mappings.forEach((m, idx) => {
            const row = document.createElement('div');
            row.className = 'mapping-row';

            const staffSelect = `
                <select class="form-control" id="mapping-select-${idx}">
                    <option value="">-- Ignore --</option>
                    <option value="__CREATE_NEW__" style="color: var(--accent-emerald); font-weight: 600;">➕ Create New Staff: "${m.detected}"</option>
                    ${this.app.staff.map(s => `
                        <option value="${s.id}" ${s.id === m.matchedId ? 'selected' : ''}>
                            ${s.name}
                        </option>
                    `).join('')}
                </select>
            `;

            row.innerHTML = `
                <div class="detected-staff">${m.detected}</div>
                <i data-lucide="arrow-right" style="width: 16px; color: var(--text-muted);"></i>
                <div class="matched-staff">${staffSelect}</div>
            `;
            grid.appendChild(row);
        });

        if (window.lucide) window.lucide.createIcons();
    }

    applyDetectedPattern() {
        // Guard against double-execution
        if (this.isApplying) {
            console.log('[AIPatternUI] applyDetectedPattern already in progress, skipping');
            return;
        }
        this.isApplying = true;

        console.log('[AIPatternUI] applyDetectedPattern called');
        console.log('[AIPatternUI] bestPattern:', this.bestPattern);
        console.log('[AIPatternUI] mappings:', this.mappings);

        if (!this.bestPattern || this.bestPattern.cycleLength === 0) {
            console.log('[AIPatternUI] No valid pattern, aborting');
            return;
        }

        // Get final mappings from selects
        const finalMappings = this.mappings.map((m, idx) => {
            const selectEl = document.getElementById(`mapping-select-${idx}`);
            console.log(`[AIPatternUI] mapping-select-${idx}:`, selectEl?.value);
            return {
                ...m,
                matchedId: selectEl?.value || ''
            };
        }).filter(fm => fm.matchedId);

        console.log('[AIPatternUI] finalMappings:', finalMappings);

        if (finalMappings.length === 0) {
            this.app.showToast('Please map at least one person', 'alert-circle');
            console.log('[AIPatternUI] No valid mappings selected');
            return;
        }

        // 0. Handle Create New Staff
        finalMappings.forEach(fm => {
            if (fm.matchedId === '__CREATE_NEW__') {
                const newStaff = {
                    id: 'id-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
                    name: fm.detected,
                    role: 'Imported',
                    rate: 12.50,
                    contractedHours: 40,
                    staffNumber: this.app.getNextStaffNumber?.() || '---'
                };
                this.app.staff.push(newStaff);
                fm.matchedId = newStaff.id; // Switch mapping to the new real ID
            }
        });

        // Apply shifts using Resource-First Staggered Allocation
        const startDate = new Date(); // Default to today
        startDate.setHours(0, 0, 0, 0);

        // Align to Monday if possible (common start)
        const day = startDate.getDay();
        const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
        startDate.setDate(diff);

        // Calculate end date based on duration mode
        const durationMode = document.getElementById('ai-duration-mode')?.value || '4weeks';
        let endDate = new Date(startDate);
        if (durationMode === 'remainder') {
            endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
        } else if (durationMode === 'full_month') {
            endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
        } else if (durationMode === 'full_year') {
            endDate.setDate(endDate.getDate() + (52 * 7));
        } else {
            endDate.setDate(endDate.getDate() + 27);
        }

        const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        const cycleLen = this.bestPattern.cycleLength;
        const requirements = this.app.settings.staffingRequirements || { early: 2, late: 2, night: 1, day12: 1 };

        let added = 0;
        let skipped = 0;
        let overQuotas = 0;

        for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(currentDate.getDate() + dayOffset);
            const dateStr = currentDate.toISOString().split('T')[0];

            // Track coverage for today
            const assignedToday = {};

            // Iterating through mapped staff in order
            finalMappings.forEach((m, staffIdx) => {
                const staff = this.app.staff.find(s => s.id === m.matchedId);
                if (!staff) return;

                // Determine shift code from pattern (staggered by staff index)
                const patternIdx = (dayOffset + staffIdx) % cycleLen;
                const shiftCode = this.bestPattern.pattern[patternIdx];

                if (shiftCode === 'R') return;

                // Check Quota
                const reqKey = shiftCode === 'E' ? 'early' :
                    (shiftCode === 'L' ? 'late' :
                        (shiftCode === 'N' ? 'night' :
                            (shiftCode === 'LD' || shiftCode === 'D' ? 'day12' : 'other')));

                const requiredCount = requirements[reqKey] || 1;
                const alreadyAssigned = assignedToday[shiftCode] || 0;

                if (alreadyAssigned >= requiredCount) {
                    overQuotas++;
                    return; // Quota filled, skip this person for today
                }

                // Look up shift times
                let start = '09:00', end = '17:00';
                const s = this.app.settings.standards || {};
                if (shiftCode === 'E') { start = s.early8 || '06:00'; end = s.late8 || '14:00'; }
                if (shiftCode === 'L') { start = s.late8 || '14:00'; end = s.night8 || '22:00'; }
                if (shiftCode === 'N') { start = s.night8 || '22:00'; end = '06:00'; }
                if (shiftCode === 'LD' || shiftCode === 'D') { start = s.day12 || '07:00'; end = s.night12 || '19:00'; }

                // Check for overlap
                if (this.app.checkShiftOverlap(staff.id, dateStr, start, end)) {
                    skipped++;
                } else {
                    const newShift = {
                        id: 'sh-ai-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
                        staffId: staff.id,
                        date: dateStr,
                        start,
                        end,
                        shiftType: shiftCode
                    };
                    this.app.shifts.push(newShift);
                    assignedToday[shiftCode] = alreadyAssigned + 1;
                    added++;
                }
            });
        }

        // Summary notification
        this.app.saveToStorage();
        this.app.renderTableBody();
        this.app.renderTableHead();
        this.app.updateStats();
        this.toggleModal(false);

        const msg = (overQuotas > 0)
            ? `AI Import: Added ${added} shifts. Ignored ${overQuotas} surplus available staff to maintain coverage quotas.`
            : `AI Import: Added ${added} shifts.`;
        this.app.showToast(msg, 'zap');
    }
}

// Global exposure
window.AIPatternUI = AIPatternUI;
