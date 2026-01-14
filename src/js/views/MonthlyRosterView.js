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
            staffSelect.onchange = (e) => {
                this.selectedStaffId = e.target.value || null;
                this.renderCalendar();
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
    open(staffId = null) {
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
        this.renderCalendar();

        // Show modal
        document.getElementById('monthly-roster-modal').classList.add('active');

        // Refresh icons
        if (window.lucide) window.lucide.createIcons();
    }

    close() {
        document.getElementById('monthly-roster-modal').classList.remove('active');
    }

    changeMonth(delta) {
        this.currentMonth.setMonth(this.currentMonth.getMonth() + delta);
        this.renderCalendar();
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

    renderCalendar() {
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
            } else if (this.app.publishManager) {
                // Add Publish Button in label if not published? Or header? 
                // Better: Add a lock/unlock button in the header actions.
            }
            monthLabel.innerHTML = html;
        }

        // Update Publish Action Button state
        this.updatePublishButton();

        // Clear grid
        grid.innerHTML = '';

        // ...
    }

    updatePublishButton() {
        // Need to ensure the button exists in DOM or create it.
        // For MVP, likely we need to add it to the header controls once.
        // But doing it here ensures state correctness.
        const headerActions = document.querySelector('.monthly-roster-header .header-actions');
        if (!headerActions) return;

        let pubBtn = document.getElementById('monthly-publish-btn');
        if (!pubBtn) {
            pubBtn = document.createElement('button');
            pubBtn.id = 'monthly-publish-btn';
            pubBtn.className = 'btn btn-outline btn-sm';
            pubBtn.style.marginRight = '8px';
            pubBtn.onclick = () => this.togglePublish();
            // Insert before export
            const exportBtn = document.getElementById('monthly-export-pdf');
            if (exportBtn) {
                headerActions.insertBefore(pubBtn, exportBtn);
            } else {
                headerActions.prepend(pubBtn);
            }
        }

        const isPublished = this.app.publishManager && this.app.publishManager.isMonthPublished(
            this.currentMonth.getFullYear(),
            this.currentMonth.getMonth()
        );

        if (isPublished) {
            pubBtn.innerHTML = '<i data-lucide="unlock"></i> Unlock Month';
            pubBtn.classList.remove('btn-outline');
            pubBtn.classList.add('btn-ghost', 'text-rose'); // Visual warning style
        } else {
            pubBtn.innerHTML = '<i data-lucide="lock"></i> Publish Month';
            pubBtn.classList.add('btn-outline');
            pubBtn.classList.remove('btn-ghost', 'text-rose');
        }
    }

    togglePublish() {
        if (!this.app.publishManager) return;

        const year = this.currentMonth.getFullYear();
        const month = this.currentMonth.getMonth();
        const isPublished = this.app.publishManager.isMonthPublished(year, month);

        if (isPublished) {
            if (confirm('Unpublish this month? This will allow edits without confirmation.')) {
                this.app.publishManager.setPublished(year, month, false);
                this.renderCalendar();
            }
        } else {
            if (confirm('Publish this month? This will lock the roster and require confirmation for changes.')) {
                this.app.publishManager.setPublished(year, month, true);
                this.renderCalendar();
            }
        }
    }

    // ... existing helper methods

    // Add day headers (Mon-Sun)
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        dayNames.forEach(day => {
        const header = document.createElement('div');
        header.className = 'monthly-calendar-header';
        header.textContent = day;
        grid.appendChild(header);
        });

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

// Get staff shifts for this month (and surrounding days for context)
const staffShifts = this.getStaffShiftsForMonth(year, month);

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
    grid.appendChild(this.createDayCell(dayNum, dateStr, true, staffShifts, todayStr));
}

// Fill current month's days
for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = new Date(year, month, day).toISOString().split('T')[0];
    const cell = this.createDayCell(day, dateStr, false, staffShifts, todayStr);
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

// Fill next month's days to complete grid
const totalCells = grid.children.length;
const remainingCells = (7 - (totalCells % 7)) % 7;
for (let day = 1; day <= remainingCells; day++) {
    const dateStr = new Date(year, month + 1, day).toISOString().split('T')[0];
    grid.appendChild(this.createDayCell(day, dateStr, true, staffShifts, todayStr));
}

// Update stats summary
this.updateStats(totalShifts, totalHours, restDays, nightShifts, forcedShifts);

// Refresh icons
if (window.lucide) window.lucide.createIcons();
    }

createDayCell(dayNum, dateStr, isOtherMonth, staffShifts, todayStr) {
    const cell = document.createElement('div');
    cell.className = 'monthly-calendar-day';

    if (isOtherMonth) cell.classList.add('other-month');
    if (dateStr === todayStr) cell.classList.add('today');

    // 1. ABSENCE OVERLAY
    // Check if selected staff has approved absence on this day
    if (this.selectedStaffId && this.app.absenceStore) {
        // Caching absences could optimize but for MVP calling store is fine
        // We need to check if dateStr falls within any approved absence
        const absences = this.app.absenceStore.getAbsencesForStaff(this.selectedStaffId);
        // Simple check: Is this DATE overlapping the absence range?
        const cellDateStart = new Date(dateStr + 'T00:00:00').getTime();
        const cellDateEnd = new Date(dateStr + 'T23:59:59').getTime();

        const hasAbsence = absences.some(abs => {
            const absStart = new Date(abs.start_ts).getTime();
            const absEnd = new Date(abs.end_ts).getTime();
            return (absStart <= cellDateEnd && absEnd >= cellDateStart);
        });

        if (hasAbsence) {
            cell.classList.add('absence-day');
            cell.title = "Approved Absence";
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

            // 2. VACANCY MARKER
            if (shift.vacant) {
                pill.classList.add('vacant');
                let html = `<span class="vacant-badge">VAC</span> ${shift.start} - ${shift.end}`;
                pill.innerHTML = html;
                pill.title = `Vacant Shift: ${shift.start} - ${shift.end}`;
                cell.appendChild(pill);
                return; // Skip normal rendering
            }

            // Determine shift type for styling
            const shiftInfo = this.classifyShift(shift);
            pill.classList.add(shiftInfo.cssClass);

            // Add shift type label and times
            let html = `<span class="shift-type-badge">${shiftInfo.code}</span> ${shift.start} - ${shift.end}`;

            // Visual Indicator for Compliance Breaches (Priority High)
            if (shift.complianceBreach) {
                pill.style.border = '2px solid var(--accent-rose)';
                pill.style.background = 'rgba(225, 29, 72, 0.15)'; // Rose tint
                pill.style.padding = '2px 4px';

                const breachMsg = shift.complianceBreach;
                // Add Alert Icon
                html += `<span title="Breach: ${breachMsg}" style="color:var(--accent-rose); margin-left:6px; cursor:help; vertical-align:middle; display:inline-flex;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg></span>`;

                // Enhanced Tooltip
                const duration = this.calculateDuration(shift.start, shift.end).toFixed(1);
                pill.title = `⚠️ COMPLIANCE VIOLATION: ${breachMsg}\n${shiftInfo.label}: ${shift.start} - ${shift.end} (${duration}h)`;

            } else if (shift.isForced) {
                // Visual Indicator for Forced/Gap-Fill Assignments
                pill.classList.add('forced-shift-pill'); // Hook for custom CSS if needed
                pill.style.borderLeft = '3px solid #f59e0b';
                pill.style.paddingLeft = '4px';
                const reason = shift.forcedReason || 'Gap Fill';
                html += `<span title="Forced: ${reason}" style="color:#f59e0b; font-weight:bold; margin-left:6px; cursor:help;">(F)</span>`;

                // Enhanced Tooltip
                const duration = this.calculateDuration(shift.start, shift.end).toFixed(1);
                pill.title = `${shiftInfo.label}: ${shift.start} - ${shift.end} (${duration}h)\n⚠️ Forced Assignment: ${reason}`;
            } else {
                const duration = this.calculateDuration(shift.start, shift.end).toFixed(1);
                pill.title = `${shiftInfo.label}: ${shift.start} - ${shift.end} (${duration}h)`;
            }

            pill.innerHTML = html;
            cell.appendChild(pill);
        });
    } else if (!isOtherMonth && this.selectedStaffId) {
        // Show rest day indicator only for current month when staff is selected
        cell.classList.add('rest-day-cell');
        const rest = document.createElement('div');
        rest.className = 'monthly-rest-indicator';
        rest.innerHTML = '<i data-lucide="moon" style="width:12px;height:12px;"></i> Rest';
        cell.appendChild(rest);
    }

    return cell;
}

getStaffShiftsForMonth(year, month) {
    if (!this.selectedStaffId) return [];

    // Get all shifts for this staff member in the relevant date range
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month + 2, 0).toISOString().split('T')[0];

    return this.app.shifts.filter(s =>
        s.staffId === this.selectedStaffId &&
        s.date >= startDate &&
        s.date <= endDate
    );
}

updateStats(shifts, hours, restDays, nights, forced = 0) {
    const summary = document.getElementById('monthly-stats-summary');
    if (!summary) return;

    if (this.selectedStaffId) {
        summary.style.display = 'block';
        document.getElementById('monthly-total-shifts').textContent = shifts;
        document.getElementById('monthly-total-hours').textContent = `${hours.toFixed(1)}h`;
        document.getElementById('monthly-rest-days').textContent = restDays;
        document.getElementById('monthly-night-shifts').textContent = nights;

        // Add or Update Forced Stats
        let forcedEl = document.getElementById('monthly-forced-shifts');
        if (!forcedEl) {
            // If the element doesn't exist in HTML, inject it dynamically
            const container = summary.querySelector('.stats-grid') || summary; // Try to adhere to grid if exists
            if (container) {
                const statDiv = document.createElement('div');
                statDiv.className = 'stat-item';
                statDiv.innerHTML = `
                        <div class="stat-label">Forced</div>
                        <div class="stat-value" id="monthly-forced-shifts" style="color:#f59e0b;">${forced}</div>
                    `;
                // Append only if not already there (double check)
                if (!container.querySelector('#monthly-forced-shifts')) {
                    // Find a good place to insert. Maybe after Night Shifts?
                    container.appendChild(statDiv);
                }
                forcedEl = document.getElementById('monthly-forced-shifts');
            }
        }

        if (forcedEl) {
            forcedEl.textContent = forced;
            forcedEl.style.color = forced > 0 ? '#f59e0b' : 'inherit';
        }

    } else {
        summary.style.display = 'none';
    }
}

calculateDuration(start, end) {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins < 0) mins += 1440; // Cross midnight
    return mins / 60;
}

isNightShift(startTime) {
    const hour = parseInt(startTime.split(':')[0]);
    return hour >= 19 || hour < 6;
}

isEarlyShift(startTime) {
    const hour = parseInt(startTime.split(':')[0]);
    return hour >= 5 && hour < 10;
}

isLateShift(startTime) {
    const hour = parseInt(startTime.split(':')[0]);
    return hour >= 12 && hour < 19;
}

/**
 * Classify a shift based on its metadata or timing
 * Returns { code, label, cssClass }
 */
classifyShift(shift) {
    const duration = this.calculateDuration(shift.start, shift.end);
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
    const is8Hour = duration >= 7 && duration <= 9;

    // 12-hour pattern detection
    if (is12Hour) {
        if (startHour >= 19 || startHour < 7) {
            return { code: 'N', label: 'Night (12h)', cssClass: 'night' };
        } else {
            return { code: 'D', label: 'Day (12h)', cssClass: 'day12' };
        }
    }

    // 8-hour pattern detection
    if (is8Hour || duration < 11) {
        if (startHour >= 19 || startHour < 6) {
            return { code: 'N', label: 'Night', cssClass: 'night' };
        } else if (startHour >= 5 && startHour < 10) {
            return { code: 'E', label: 'Early', cssClass: 'early' };
        } else if (startHour >= 12 && startHour < 19) {
            return { code: 'L', label: 'Late', cssClass: 'late' };
        }
    }

    // Default fallback
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
