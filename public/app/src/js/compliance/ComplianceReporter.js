/**
 * ComplianceReporter - Handles PDF generation for HR/CQC Audit Reports
 * Uses jsPDF and autoTable
 */
class ComplianceReporter {
    constructor(app) {
        this.app = app;
    }

    async generateAuditReport() {
        if (typeof window.jspdf === 'undefined') {
            this.app.showToast('PDF library not loaded', 'alert-circle');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const now = new Date();
        const timestamp = now.toLocaleString();

        // 1. Header
        doc.setFontSize(22);
        doc.setTextColor(99, 102, 241); // Accent blue
        doc.text('Shift Craft (Atlas) Compliance Audit', 14, 22);

        // ...

        doc.save(`ShiftCraft-Audit-${now.toISOString().split('T')[0]}.pdf`);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated: ${timestamp}`, 14, 30);
        doc.text(`Organisation: CCTV User Group Demo`, 14, 35);
        doc.text(`Scope: Active Roster & 17-Week History`, 14, 40);

        // 2. Summary stats
        let totalRisks = 0;
        const logData = [];
        const staffSummary = [];

        this.app.staff.forEach(person => {
            const shifts = this.app.shifts.filter(s => s.staffId === person.id);
            const nightWork = this.app.complianceEngine.checkNightWork(person.id, this.app.shifts);
            const avg17 = this.app.complianceEngine.calculateRollingAverage(person.id, this.app.shifts, now.toISOString().split('T')[0], 17);

            staffSummary.push([
                person.name,
                person.role,
                avg17.toFixed(1) + 'h',
                person.optOut48h ? 'Yes' : 'No',
                nightWork.totalNightHours.toFixed(1) + 'h'
            ]);

            // Collect violations for the log
            const violations = this.app.complianceEngine.checkDailyRest(person.id, this.app.shifts);
            violations.forEach(v => {
                logData.push([v.date, person.name, v.type, v.message]);
                totalRisks++;
            });

            // Young worker checks
            const yv = this.app.complianceEngine.checkYoungWorkerRules(person, this.app.shifts, now.toISOString().split('T')[0]);
            yv.forEach(v => {
                logData.push([v.date, person.name, v.type, v.message]);
                totalRisks++;
            });
        });

        // 3. Render Staff Summary Table
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text('Employee WTR Overview', 14, 55);

        doc.autoTable({
            startY: 60,
            head: [['Name', 'Role', '17-Week Avg', '48h Opt-Out', 'Night Hours']],
            body: staffSummary,
            theme: 'striped',
            headStyles: { fillColor: [99, 102, 241] }
        });

        // 4. Render Violation Log Table
        const logStartY = doc.lastAutoTable.finalY + 20;
        doc.text('Detected Statutory Breaches & Risks', 14, logStartY);

        doc.autoTable({
            startY: logStartY + 5,
            head: [['Date', 'Staff', 'Category', 'Violation Details']],
            body: logData.length > 0 ? logData : [['-', 'All Compliant', '-', 'No violations found in current dataset.']],
            theme: 'striped',
            headStyles: { fillColor: [239, 68, 68] } // Rose/Red for risks
        });

        // 5. Statutory Footnote
        const finalY = doc.lastAutoTable.finalY + 15;
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('This report is generated based on The Working Time Regulations 1998.', 14, finalY);
        doc.text('It provides a snapshot for audit purposes. Professional legal advice should be sought for formal compliance reviews.', 14, finalY + 5);

        // Save
        doc.save(`ShiftCraft-Audit-${now.toISOString().split('T')[0]}.pdf`);
        this.app.showToast('Audit Report Generated', 'check-circle');
    }
}

window.ComplianceReporter = ComplianceReporter;
