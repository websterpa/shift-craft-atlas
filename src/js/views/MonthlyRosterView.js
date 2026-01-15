/**
 * MonthlyRosterView - Personal Monthly Calendar View
 * Shows a staff member's shifts in a traditional monthly calendar format.
 * 
 * @class MonthlyRosterView
 * @version 1.0.0
 */
class MonthlyRosterView {
    constructor(app) {
        this.app = app;
        this.selectedStaffId = null;
        this.currentMonth = new Date();
        this.currentMonth.setDate(1); // Start of month

        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Modal controls
        const closeBtn = document.getElementById('close-monthly-roster');
        if (closeBtn) closeBtn.onclick = () => this.close();

        const closeBtn2 = document.getElementById('monthly-close-btn');
        if (closeBtn2) closeBtn2.onclick = () => this.close();

        // Month navigation
        const prevBtn = document.getElementById('monthly-prev-month');
        if (prevBtn) prevBtn.onclick = () => this.changeMonth(-1);

        const nextBtn = document.getElementById('monthly-next-month');
        if (nextBtn) nextBtn.onclick = () => this.changeMonth(1);

        // Staff selection
        const staffSelect = document.getElementById('monthly-staff-select');
        if (staffSelect) {
            staffSelect.onchange = async (e) => {
                this.selectedStaffId = e.target.value || null;
                await this.renderCalendar();
            };
        }

        // Export PDF
        const exportBtn = document.getElementById('monthly-export-pdf');
        if (exportBtn) exportBtn.onclick = () => this.exportPDF();

        // Modal overlay click to close
        const overlay = document.getElementById('monthly-roster-modal');
        if (overlay) {
            overlay.onclick = (e) => {
                if (e.target === overlay) this.close();
            };
        }
    }

    /**
     * Open the monthly roster modal
     * @param {string} staffId - Optional staff ID to pre-select
     */
    async open(staffId = null) {
        // Populate staff dropdown
        this.populateStaffDropdown();

        // Set initial staff
        if (staffId) {
            this.selectedStaffId = staffId;
            const select = document.getElementById('monthly-staff-select');
            if (select) select.value = staffId;
        }

        // Set month based on current Roster context
        if (this.app.currentMonth) {
            this.currentMonth = new Date(this.app.currentMonth);
        } else if (this.app.weekStart) {
            this.currentMonth = new Date(this.app.weekStart);
        } else {
            this.currentMonth = new Date();
        }
        this.currentMonth.setDate(1);

        // Render calendar
        await this.renderCalendar();

        // Show modal
        document.getElementById('monthly-roster-modal').classList.add('active');

        // Refresh icons
        if (window.lucide) window.lucide.createIcons();
    }

    close() {
        document.getElementById('monthly-roster-modal').classList.remove('active');
    }

    async changeMonth(delta) {
        this.currentMonth.setMonth(this.currentMonth.getMonth() + delta);
        await this.renderCalendar();
    }

    populateStaffDropdown() {
        const select = document.getElementById('monthly-staff-select');
        if (!select) return;

        // Reset dropdown
        select.innerHTML = '<option value="">-- Select Staff Member --</option>';

        // Add staff options
        this.app.staff.forEach(person => {
            const option = document.createElement('option');
            option.value = person.id;
            option.textContent = `${person.name} (${person.role})`;
            select.appendChild(option);
        });
    }

    async renderCalendar() {
        const grid = document.getElementById('monthly-calendar-grid');
        const monthLabel = document.getElementById('monthly-current-month');
        if (!grid) return;

        // Update month label
        const monthName = this.currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
        if (monthLabel) {
            const year = this.currentMonth.getFullYear();
            const month = this.currentMonth.getMonth();
            const isPublished = this.app.publishManager && this.app.publishManager.isMonthPublished(year, month);

            let html = `${monthName}`;
            if (isPublished) {
                html += ` <i data-lucide="lock" style="width:16px; height:16px; color:var(--accent-rose); vertical-align:middle;" title="Month is Published"></i>`;
            }
            monthLabel.innerHTML = html;
        }

        // Update Publish Action Button state
        this.updatePublishButton();

        // Clear grid
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; opacity: 0.5;"><i class="spinner-sm"></i> Loading...</div>';

        // Add day headers (Mon-Sun)
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const dayHeadersHtml = dayNames.map(day => `<div class="monthly-calendar-header">${day}</div>`).join('');
        grid.innerHTML = dayHeadersHtml;

        // Calculate calendar bounds
        const year = this.currentMonth.getFullYear();
        const month = this.currentMonth.getMonth();

        // First day of month (adjusted for Monday start)
        const firstDay = new Date(year, month, 1);
        let startDayOfWeek = firstDay.getDay();
        startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1; // Convert to Mon=0

        // Last day of month
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();

        // Data Fetching
        const staffShifts = await this.getStaffShiftsForMonth(year, month);

        // Fetch absences for range
        const rangeStart = new Date(year, month - 1, 1).toISOString().split('T')[0];
        const rangeEnd = new Date(year, month + 2, 0).toISOString().split('T')[0];
        const absences = this.selectedStaffId ? await this.app.absenceStore.getAbsencesForStaff(this.selectedStaffId) : [];
        const activeAbsences = absences.filter(a => a.start_ts <= rangeEnd + 'T23:59:59Z' && a.end_ts >= rangeStart + 'T00:00:00Z');

        // Fetch absence types for label resolution
        const absenceTypes = await this.app.absenceStore.getTypes();

        // Today's date for highlighting
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        // Stats accumulators
        let totalShifts = 0;
        let totalHours = 0;
        let restDays = 0;
        let nightShifts = 0;
        let forcedShifts = 0;

        // Fill previous month's days
        const prevMonth = new Date(year, month, 0);
        const prevMonthDays = prevMonth.getDate();
        for (let i = startDayOfWeek - 1; i >= 0; i--) {
            const dayNum = prevMonthDays - i;
            const dateStr = new Date(year, month - 1, dayNum).toISOString().split('T')[0];
            grid.appendChild(this.createDayCell(dayNum, dateStr, true, staffShifts, todayStr, activeAbsences, absenceTypes));
        }

        // Fill current month's days
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = new Date(year, month, day).toISOString().split('T')[0];
            const cell = this.createDayCell(day, dateStr, false, staffShifts, todayStr, activeAbsences, absenceTypes);
            grid.appendChild(cell);

            // Accumulate stats
            const dayShifts = staffShifts.filter(s => s.date === dateStr);
            if (dayShifts.length > 0) {
                totalShifts += dayShifts.length;
                dayShifts.forEach(s => {
                    const hours = this.calculateDuration(s.start, s.end);
                    totalHours += hours;
                    if (this.isNightShift(s.start)) nightShifts++;
                    if (s.isForced) forcedShifts++;
                });
            } else {
                restDays++;
            }
        }

        // Fill next month's days
        const totalCellsAdded = grid.children.length - 7; // excluding headers
        const remainingCells = (7 - (totalCellsAdded % 7)) % 7;
        for (let day = 1; day <= remainingCells; day++) {
            const dateStr = new Date(year, month + 1, day).toISOString().split('T')[0];
            grid.appendChild(this.createDayCell(day, dateStr, true, staffShifts, todayStr, activeAbsences, absenceTypes));
        }

        // Update stats summary
        this.updateStats(totalShifts, totalHours, restDays, nightShifts, forcedShifts);

        if (window.lucide) window.lucide.createIcons();
    }

    updatePublishButton() {
        const headerActions = document.querySelector('.monthly-roster-header .header-actions');
        if (!headerActions) {
            // If header not found in DOM yet, nothing to do.
            return;
        }

        let pubBtn = document.getElementById('monthly-publish-btn');
        if (!pubBtn) {
            pubBtn = document.createElement('button');
            pubBtn.id = 'monthly-publish-btn';
            // Insert before export btn
            const exportBtn = document.getElementById('monthly-export-pdf');
            if (exportBtn && exportBtn.parentNode === headerActions) {
                headerActions.insertBefore(pubBtn, exportBtn);
            } else {
                headerActions.appendChild(pubBtn);
            }
            pubBtn.onclick = () => this.togglePublish();
        }

        const isPublished = this.app.publishManager && this.app.publishManager.isMonthPublished(
            this.currentMonth.getFullYear(),
            this.currentMonth.getMonth()
        );

        // Update Button State
        if (isPublished) {
            pubBtn.className = 'btn btn-ghost text-rose';
            pubBtn.innerHTML = `<i data-lucide="lock" style="width:16px;height:16px;"></i> Locked`;
            pubBtn.title = 'Month is locked. Click to Unpublish/Override.';
            pubBtn.style.border = '1px solid var(--accent-rose)';
            pubBtn.style.marginRight = '8px';
        } else {
            pubBtn.className = 'btn btn-outline';
            pubBtn.innerHTML = `<i data-lucide="unlock" style="width:16px;height:16px;"></i> Publish`;
            pubBtn.title = 'Lock this month against edits.';
            pubBtn.style.border = '1px solid var(--glass-border)';
            pubBtn.style.marginRight = '8px';
        }

        if (window.lucide) window.lucide.createIcons();
    }

    togglePublish() {
        if (!this.app.publishManager) return;

        const year = this.currentMonth.getFullYear();
        const month = this.currentMonth.getMonth();
        const isPublished = this.app.publishManager.isMonthPublished(year, month);

        if (isPublished) {
            if (confirm('Unlock this month? \n\nThis will allow unrestricted editing. Use with caution if roster was already distributed.')) {
                this.app.publishManager.setPublished(year, month, false);
                this.renderCalendar();
                this.app.showToast('Month Unlocked', 'unlock');
            }
        } else {
            if (confirm('Publish and Lock this month? \n\nEdits will be blocked unless an override reason is provided.')) {
                this.app.publishManager.setPublished(year, month, true);
                this.renderCalendar();
                this.app.showToast('Month Published & Locked', 'lock');
            }
        }
    }



    createDayCell(dayNum, dateStr, isOtherMonth, staffShifts, todayStr, absences = [], absenceTypes = []) {
        const cell = document.createElement('div');
        cell.className = 'monthly-calendar-day';

        if (isOtherMonth) cell.classList.add('other-month');
        if (dateStr === todayStr) cell.classList.add('today');

        // 1. ABSENCE OVERLAY
        if (this.selectedStaffId && absences.length > 0) {
            const cellDateStart = new Date(dateStr + 'T00:00:00').getTime();
            const cellDateEnd = new Date(dateStr + 'T23:59:59').getTime();

            const todaysAbsences = absences.filter(abs => {
                const absStart = new Date(abs.start_ts).getTime();
                const absEnd = new Date(abs.end_ts).getTime();
                return (absStart <= cellDateEnd && absEnd >= cellDateStart);
            });

            if (todaysAbsences.length > 0) {
                cell.classList.add('absence-day');
                const primaryType = absenceTypes.find(t => t.id === todaysAbsences[0].type_id)?.label || 'Absence';
                cell.dataset.absenceType = primaryType.toUpperCase();

                const details = todaysAbsences.map(abs => {
                    const type = absenceTypes.find(t => t.id === abs.type_id)?.label || 'Absence';
                    return `${type}`;
                }).join(', ');
                cell.title = `Approved Absence: ${details}`;
            }
        }

        // Day number
        const dayLabel = document.createElement('div');
        dayLabel.className = 'monthly-day-number';
        dayLabel.textContent = dayNum;
        cell.appendChild(dayLabel);

        // Check for shifts on this day
        const dayShifts = staffShifts.filter(s => s.date === dateStr);

        if (dayShifts.length > 0) {
            cell.classList.add('has-shift');
            dayShifts.forEach(shift => {
                const pill = document.createElement('div');
                pill.className = 'monthly-shift-pill';

                const info = this.classifyShift(shift);

                // Unified Shape Status Check
                const isVacant = shift.status === 'vacant' || (!shift.staff_id && !shift.staffId);

                if (isVacant) {
                    pill.classList.add('vacant');
                    pill.classList.add(info.cssClass);
                    pill.innerHTML = `<span class="vacant-badge">VAC</span> <span class="shift-type-badge">${info.code}</span> ${shift.start} - ${shift.end}`;

                    const duration = this.calculateDuration(shift.start, shift.end).toFixed(1);
                    pill.title = `UNFILLED VACANCY\n${info.label}: ${shift.start} - ${shift.end} (${duration}h)`;

                    cell.appendChild(pill);
                    return;
                }

                // Normal shift pill
                pill.classList.add(info.cssClass);

                // Build HTML
                let html = `<span class="shift-type-badge">${info.code}</span> ${shift.start} - ${shift.end}`;

                // Compliance & Forced Checks
                if (shift.complianceBreach) {
                    pill.style.border = '2px solid var(--accent-rose)';
                    pill.style.background = 'rgba(225, 29, 72, 0.15)';
                    html += `<span title="Breach: ${shift.complianceBreach}" style="color:var(--accent-rose); margin-left:6px;">⚠️</span>`;
                } else if (shift.is_forced || shift.isForced) {
                    pill.classList.add('forced-shift-pill');
                    pill.style.borderLeft = '3px solid #f59e0b';
                    pill.style.paddingLeft = '4px';
                    const reason = shift.forced_reason || shift.forcedReason || 'Gap Fill';
                    html += `<span title="Forced: ${reason}" style="color:#f59e0b; font-weight:bold; margin-left:6px;">(F)</span>`;
                }

                const duration = this.calculateDuration(shift.start, shift.end).toFixed(1);
                pill.title = `${info.label}: ${shift.start} - ${shift.end} (${duration}h)`; // Basic title

                pill.innerHTML = html;
                cell.appendChild(pill);
            });
        } else if (!isOtherMonth && this.selectedStaffId) {
            // Show rest day indicator
            cell.classList.add('rest-day-cell');
            const rest = document.createElement('div');
            rest.className = 'monthly-rest-indicator';
            rest.innerHTML = '<i data-lucide="moon" style="width:12px;height:12px;"></i> Rest';
            cell.appendChild(rest);
        }

        return cell;
    }

    async getStaffShiftsForMonth(year, month) {
        if (!this.selectedStaffId || !this.app.repo) return [];

        const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
        // Load assignments from repo (Unified Mode)
        const allShifts = await this.app.repo.loadAssignments({
            month: monthStr,
            versionId: this.app.activeVersionId // Optional: if we support versions
        });

        // Repo returns unified shape (version_id, shift_code, staff_id)
        // We filter additionally if the repo didn't catch specific day ranges or strict matching
        return allShifts.filter(s =>
            s.staff_id === this.selectedStaffId || s.staffId === this.selectedStaffId // Hybrid check
        );
    }

    updateStats(shifts, hours, restDays, nights, forced = 0) {
        const summary = document.getElementById('monthly-stats-summary');
        if (!summary) return;

        if (this.selectedStaffId) {
            summary.style.display = 'block';

            // Hydrate name header if needed (though typically handled by selection change)
            // But stats updating is a good place to ensure consistency if we had a name element.

            document.getElementById('monthly-total-shifts').textContent = shifts;
            document.getElementById('monthly-total-hours').textContent = `${hours.toFixed(1)}h`;
            document.getElementById('monthly-rest-days').textContent = restDays;
            document.getElementById('monthly-night-shifts').textContent = nights;

            let forcedEl = document.getElementById('monthly-forced-shifts');
            if (forcedEl) {
                forcedEl.textContent = forced;
                forcedEl.style.color = forced > 0 ? '#f59e0b' : 'inherit';
            }
        } else {
            summary.style.display = 'none';
        }
    }

    calculateDuration(start, end) {
        return window.TimeRange.getDurationMinutes(start, end) / 60;
    }

    isNightShift(startTime) {
        const mins = window.TimeRange.hhmmToMinutes(startTime);
        return mins >= 1140 || mins < 360;
    }

    /**
     * Classify a shift based on Unified Shape properties
     */
    classifyShift(shift) {
        const code = shift.shift_code || window.ShiftMapping.toCode(shift.shiftType || '');
        const logical = window.ShiftMapping.toLogical(code);

        const cssMap = {
            'E': 'early', 'L': 'late', 'N': 'night', 'D': 'day12', 'R': 'rest', 'S': 'sick'
        };

        if (window.ShiftMapping.isValidCode(code)) {
            return {
                code: code,
                label: logical + (code === 'D' ? ' (12h)' : ''),
                cssClass: cssMap[code] || ''
            };
        }

        return { code: '?', label: 'Shift', cssClass: '' };
    }

    async exportPDF() {
        if (!this.selectedStaffId) {
            this.app.showToast('Please select a staff member', 'alert-circle');
            return;
        }

        if (typeof window.jspdf === 'undefined') {
            this.app.showToast('PDF library not loaded', 'alert-circle');
            return;
        }

        this.app.showToast('Generating monthly roster PDF...', 'file-image');

        const person = this.app.staff.find(s => s.id === this.selectedStaffId);
        if (!person) return;

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('landscape', 'mm', 'a4');
            const monthName = this.currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
            const year = this.currentMonth.getFullYear();
            const month = this.currentMonth.getMonth();
            const filename = `${person.name.replace(/\s+/g, '-')}-Roster-${monthName.replace(/\s+/g, '-')}.pdf`;

            // Header
            doc.setFontSize(18);
            doc.setTextColor(99, 102, 241);
            doc.text(`Monthly Roster: [${person.staffNumber || '---'}] ${person.name}`, 14, 15);

            doc.setFontSize(12);
            doc.setTextColor(80);
            doc.text(`${monthName} | Role: ${person.role}`, 14, 23);

            // Get shifts for the month
            const staffShifts = this.app.shifts.filter(s => {
                const d = new Date(s.date);
                return s.staffId === this.selectedStaffId &&
                    d.getMonth() === month &&
                    d.getFullYear() === year;
            });

            // Build calendar grid data (weeks as rows, days as columns)
            const headers = ['Week', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

            // Calculate first and last days of month
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const daysInMonth = lastDay.getDate();

            // Build rows for each week
            const tableData = [];
            let currentDay = 1;
            let weekNum = 1;

            // Find which day of week the month starts (Mon=0, Sun=6)
            let startDow = firstDay.getDay();
            startDow = startDow === 0 ? 6 : startDow - 1;

            while (currentDay <= daysInMonth) {
                const row = [`W${weekNum}`];

                for (let dow = 0; dow < 7; dow++) {
                    if ((weekNum === 1 && dow < startDow) || currentDay > daysInMonth) {
                        row.push('-');
                    } else {
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
                        const dayShifts = staffShifts.filter(s => s.date === dateStr);

                        if (dayShifts.length > 0) {
                            const shiftText = dayShifts.map(s => {
                                const info = this.classifyShift(s);
                                return `${currentDay}\n${info.code}: ${s.start}-${s.end}`;
                            }).join('\n');
                            row.push(shiftText);
                        } else {
                            row.push(`${currentDay}\nRest`);
                        }
                        currentDay++;
                    }
                }
                tableData.push(row);
                weekNum++;
            }

            // Stats
            const totalHours = staffShifts.reduce((sum, s) => sum + this.calculateDuration(s.start, s.end), 0);
            doc.text(`Total Shifts: ${staffShifts.length} | Total Hours: ${totalHours.toFixed(1)}h`, 14, 30);

            // Create calendar table
            doc.autoTable({
                startY: 36,
                head: [headers],
                body: tableData,
                theme: 'grid',
                headStyles: {
                    fillColor: [99, 102, 241],
                    textColor: 255,
                    fontSize: 9,
                    fontStyle: 'bold',
                    halign: 'center'
                },
                columnStyles: {
                    0: { cellWidth: 15, fontStyle: 'bold', halign: 'center' }, // Week number
                    1: { halign: 'center', cellWidth: 36 },
                    2: { halign: 'center', cellWidth: 36 },
                    3: { halign: 'center', cellWidth: 36 },
                    4: { halign: 'center', cellWidth: 36 },
                    5: { halign: 'center', cellWidth: 36 },
                    6: { halign: 'center', cellWidth: 36, fillColor: [245, 245, 245] }, // Saturday
                    7: { halign: 'center', cellWidth: 36, fillColor: [245, 245, 245] }  // Sunday
                },
                styles: {
                    fontSize: 7,
                    cellPadding: 2,
                    overflow: 'linebreak',
                    minCellHeight: 12
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
                    this.app.showToast(`Saved ${handle.name}`, 'check-circle');
                } catch (err) {
                    if (err.name === 'AbortError') {
                        this.app.showToast('Export cancelled', 'x');
                    } else {
                        throw err;
                    }
                }
            } else {
                doc.save(filename);
                this.app.showToast('PDF exported successfully', 'check-circle');
            }
        } catch (error) {
            console.error('Monthly PDF export failed:', error);
            this.app.showToast('Export failed: ' + error.message, 'alert-triangle');
        }
    }
}

// Global exposure
if (typeof window !== 'undefined') {
    window.MonthlyRosterView = MonthlyRosterView;
}
