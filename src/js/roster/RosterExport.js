
/**
 * Shift Craft (Atlas) - Roster Export Module
 * Handles PDF and Excel export functionality.
 * 
 * Uses robust browser download dialogs via Blob URLs and anchor elements
 * to ensure files are saved correctly across all environments.
 */
class RosterExport {
    constructor(appContext) {
        this.app = appContext;
    }

    /**
     * Robust file download helper using standard browser download dialogs
     * Creates a temporary anchor element, triggers a click, and cleans up
     * 
     * @param {Blob} blob - The file content as a Blob
     * @param {string} filename - The desired filename
     * @returns {boolean} - True if download was initiated successfully
     */
    _downloadFile(blob, filename) {
        try {
            // Create object URL from blob
            const url = URL.createObjectURL(blob);

            // Create temporary anchor element
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.display = 'none';

            // Add to DOM (required for Firefox)
            document.body.appendChild(link);

            // Trigger download
            link.click();

            // Clean up
            document.body.removeChild(link);

            // Revoke object URL after a delay to ensure download starts
            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 10000); // 10 second delay for large files

            console.log(`[RosterExport] Download initiated: ${filename}`);
            return true;

        } catch (error) {
            console.error('[RosterExport] Download failed:', error);
            return false;
        }
    }

    /**
     * Export Roster as PDF using jsPDF with robust download
     */
    async exportToPDF() {
        this.app.showToast('Generating roster PDF...', 'file-image');

        try {
            if (typeof window.jspdf === 'undefined') {
                throw new Error('jsPDF library not loaded. Please check your internet connection.');
            }

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('landscape', 'mm', 'a4');

            // Week date range
            const weekStart = new Date(this.app.weekStart);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            const startStr = weekStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

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

            // Build data using autoTable format
            const body = this.app.staff.map(person => {
                const row = [`${person.name} (${person.staffNumber || '#'})`];
                dayDates.forEach(dateStr => {
                    const shiftsOnDay = this.app.shifts.filter(s =>
                        s.staffId === person.id && s.date === dateStr
                    );
                    if (shiftsOnDay.length > 0) {
                        // Join multiple shifts with newline
                        const txt = shiftsOnDay.map(s => {
                            if (s.type) return s.type + (s.start === '07:00' || s.start === '19:00' || s.start === '06:00' ? '' : ` (${s.start}-${s.end})`);
                            return `${s.start}-${s.end}`;
                        }).join('\n');
                        row.push(txt);
                    } else {
                        row.push('');
                    }
                });
                return row;
            });

            // Title
            doc.setFontSize(18);
            doc.text(`${this.app.rosterName}`, 14, 15);
            doc.setFontSize(11);
            doc.setTextColor(100);
            doc.text(`Week Commencing: ${startStr}`, 14, 22);

            // Table
            doc.autoTable({
                head: [headers],
                body: body,
                startY: 28,
                theme: 'grid',
                headStyles: { fillColor: [79, 70, 229], textColor: 255 }, // Indigo
                styles: { fontSize: 10, cellPadding: 3 },
                didParseCell: function (data) {
                    if (data.section === 'body' && data.column.index > 0) {
                        const text = data.cell.raw;
                        if (text) {
                            const code = window.ShiftMapping.toCode(text);
                            if (code === 'N') {
                                data.cell.styles.fillColor = [254, 242, 242]; // Red-50
                                data.cell.styles.textColor = [185, 28, 28]; // Red-700
                            } else if (code === 'E' || code === 'D') {
                                data.cell.styles.fillColor = [239, 246, 255]; // Blue-50
                                data.cell.styles.textColor = [29, 78, 216]; // Blue-700
                            }
                        }
                    }
                }
            });

            // Footer
            const pageCount = doc.internal.getNumberOfPages();
            doc.setFontSize(8);
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.text(`Generated by ShiftCraft on ${new Date().toLocaleString()}`, 14, doc.internal.pageSize.height - 10);
            }

            // Generate filename
            const filename = `Shift_Roster_${weekStart.toISOString().split('T')[0]}.pdf`;

            // Convert to Blob and use robust download
            const pdfBlob = doc.output('blob');
            const success = this._downloadFile(pdfBlob, filename);

            if (success) {
                this.app.showToast(`PDF saved: ${filename}`, 'check');
            } else {
                throw new Error('Download initiation failed');
            }

        } catch (e) {
            console.error('PDF Export Error:', e);
            this.app.showToast(`Failed to export PDF: ${e.message}`, 'alert-triangle');
        }
    }

    /**
     * Export Roster as Excel (.xlsx) using SheetJS with robust download
     */
    async exportToExcel() {
        this.app.showToast('Generating Excel spreadsheet...', 'sheet');

        try {
            if (typeof XLSX === 'undefined') {
                throw new Error('SheetJS (XLSX) library not loaded. Please check your internet connection.');
            }

            // Prepare Data Structure
            const weekStart = new Date(this.app.weekStart);
            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
            const dayDates = days.map((_, i) => {
                const d = new Date(weekStart);
                d.setDate(d.getDate() + i);
                return {
                    name: days[i],
                    dateStr: d.toISOString().split('T')[0],
                    formatted: `${d.getDate()}/${d.getMonth() + 1}`
                };
            });

            // Headers: [Staff ID, Name, Role, Mon (...), Tue (...), ..., Total Hours]
            const headers = ['Staff #', 'Name', 'Role', ...dayDates.map(d => `${d.name} (${d.formatted})`), 'Total Hours'];

            // Rows
            const dataRows = this.app.staff.map(person => {
                let totalMins = 0;
                const row = {
                    'Staff #': person.staffNumber || '',
                    'Name': person.name,
                    'Role': person.role || ''
                };

                dayDates.forEach(d => {
                    const shiftsOnDay = this.app.shifts.filter(s =>
                        s.staffId === person.id && s.date === d.dateStr
                    );

                    if (shiftsOnDay.length > 0) {
                        // Concatenate shifts
                        const shiftTexts = shiftsOnDay.map(s => {
                            // Calculate duration for total
                            totalMins += window.TimeRange.getDurationMinutes(s.start, s.end);

                            // Format: "D12 (07:00-19:00)"
                            return `${s.type || 'Custom'} (${s.start}-${s.end})`;
                        });
                        row[`${d.name} (${d.formatted})`] = shiftTexts.join(', ');
                    } else {
                        row[`${d.name} (${d.formatted})`] = 'Rest';
                    }
                });

                row['Total Hours'] = (totalMins / 60).toFixed(1);
                return row;
            });

            // Create Worksheet
            const ws = XLSX.utils.json_to_sheet(dataRows, { header: headers });

            // Styling (Column Widths)
            const wscols = [
                { wch: 10 }, // ID
                { wch: 25 }, // Name
                { wch: 15 }, // Role
                { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, // Days
                { wch: 12 }  // Total
            ];
            ws['!cols'] = wscols;

            // Create Workbook
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Weekly Roster");

            // Generate filename
            const filename = `Roster_${weekStart.toISOString().split('T')[0]}.xlsx`;

            // Convert to binary and create Blob for robust download
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const xlsxBlob = new Blob([wbout], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });

            const success = this._downloadFile(xlsxBlob, filename);

            if (success) {
                this.app.showToast(`Excel saved: ${filename}`, 'check');
            } else {
                throw new Error('Download initiation failed');
            }

        } catch (e) {
            console.error('Excel Export Error:', e);
            this.app.showToast(`Failed to export Excel: ${e.message}`, 'alert-triangle');
        }
    }

    /**
     * Export Roster as CSV (simple, always works)
     */
    async exportToCSV() {
        this.app.showToast('Generating CSV file...', 'file-text');

        try {
            const weekStart = new Date(this.app.weekStart);
            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
            const dayDates = days.map((_, i) => {
                const d = new Date(weekStart);
                d.setDate(d.getDate() + i);
                return d.toISOString().split('T')[0];
            });

            // Build CSV header
            const headers = ['Staff #', 'Name', 'Role', ...days, 'Total Hours'];
            let csv = headers.join(',') + '\n';

            // Build rows
            this.app.staff.forEach(person => {
                let totalMins = 0;
                const row = [
                    `"${person.staffNumber || ''}"`,
                    `"${person.name}"`,
                    `"${person.role || ''}"`
                ];

                dayDates.forEach(dateStr => {
                    const shiftsOnDay = this.app.shifts.filter(s =>
                        s.staffId === person.id && s.date === dateStr
                    );

                    if (shiftsOnDay.length > 0) {
                        const shiftTexts = shiftsOnDay.map(s => {
                            totalMins += window.TimeRange.getDurationMinutes(s.start, s.end);
                            return `${s.type || 'Custom'} (${s.start}-${s.end})`;
                        });
                        row.push(`"${shiftTexts.join('; ')}"`);
                    } else {
                        row.push('"Rest"');
                    }
                });

                row.push((totalMins / 60).toFixed(1));
                csv += row.join(',') + '\n';
            });

            // Create blob and download
            const filename = `Roster_${weekStart.toISOString().split('T')[0]}.csv`;
            const csvBlob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });

            const success = this._downloadFile(csvBlob, filename);

            if (success) {
                this.app.showToast(`CSV saved: ${filename}`, 'check');
            } else {
                throw new Error('Download initiation failed');
            }

        } catch (e) {
            console.error('CSV Export Error:', e);
            this.app.showToast(`Failed to export CSV: ${e.message}`, 'alert-triangle');
        }
    }
}

// Global Export
window.RosterExport = RosterExport;
