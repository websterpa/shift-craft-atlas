class ComplianceEngine {
    constructor(settings) {
        this.settings = settings || { restPeriod: 11 };
        // UK Bank Holidays - Initially empty, populated from RotaApp
        this.bankHolidays = [];
    }

    /**
     * Update bank holiday data from external API
     */
    setBankHolidays(events) {
        this.bankHolidays = events.map(e => e.date);
    }

    /**
     * Regulation 10(1): Daily Rest
     */
    checkDailyRest(staffId, allShifts, preFilteredStaffShifts = null) {
        // Always ensure shifts are filtered and sorted by date/start time
        let staffShifts = preFilteredStaffShifts
            ? [...preFilteredStaffShifts]  // Clone to avoid mutating the input
            : allShifts.filter(s => s.staffId === staffId);

        // Always sort by date and start time for accurate rest period calculation
        staffShifts.sort((a, b) => {
            const aDateTime = new Date(`${a.date}T${a.start}`);
            const bDateTime = new Date(`${b.date}T${b.start}`);
            return aDateTime - bDateTime;
        });

        const violations = [];
        for (let i = 1; i < staffShifts.length; i++) {
            const prev = staffShifts[i - 1];
            const curr = staffShifts[i];

            // Calculate when the previous shift actually ended
            const { end: prevEnd } = window.TimeRange.rangeFromDateAndHm(prev.date, prev.start, prev.end);

            // Calculate when the current shift starts
            const currStart = new Date(`${curr.date}T${curr.start}`);

            // Calculate gap in hours
            const gapHours = (currStart - prevEnd) / (1000 * 60 * 60);

            // Flag if rest period is less than statutory minimum (typically 11 hours)
            if (gapHours < this.settings.restPeriod && gapHours >= 0) {
                let msg = `Rest period of ${gapHours.toFixed(1)}h is below statutory ${this.settings.restPeriod}h`;

                // Advisory for Quick Changeovers (8h-11h) common in standard patterns
                if (gapHours >= 8 && gapHours < 11) {
                    msg += `. This is a common 'Quick Changeover' (Late to Early). Statutory rest can be reduced if compensatory rest is provided.`;
                }

                violations.push({
                    type: 'DAILY_REST',
                    message: msg,
                    gap: parseFloat(gapHours.toFixed(1)),
                    date: curr.date,
                    shiftId: curr.id,
                    prevShiftEnd: prev.end,
                    currShiftStart: curr.start,
                    severity: (gapHours >= 8 && gapHours < 11) ? 'warning' : 'critical'
                });
            }
        }
        return violations;
    }


    /**
     * Assess hours vs contracted over 17 weeks
     */
    checkContractedCompliance(staff, allShifts, targetDate) {
        const weeks = 17;
        const avg = this.calculateRollingAverage(staff.id, allShifts, targetDate, weeks);
        const contracted = staff.contractedHours || 40;

        const diff = avg - contracted;

        // Correction: Only flag positive variance (Over Contracted / Burnout Risk)
        // Ignoring negative variance prevents false positives on fresh rosters with limited history.
        if (diff > 2) {
            return {
                type: 'CONTRACT_VARIANCE',
                message: `Over contracted (+${diff.toFixed(1)}h): avg ${avg.toFixed(1)}h vs ${contracted}h`,
                variance: diff
            };
        }
        return null;
    }

    /**
     * Fairness Score Calculation (Lower is better)
     * Window: 17 weeks
     */
    calculateFairnessScore(staffId, allShifts, targetDate, preFilteredStaffShifts = null) {
        const endDate = new Date(targetDate);
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - (17 * 7));

        const staffOnly = preFilteredStaffShifts || allShifts.filter(s => s.staffId === staffId);
        const periodShifts = staffOnly.filter(s => {
            const d = new Date(s.date);
            return d >= startDate && d <= endDate;
        });

        let nightShifts = 0;
        let weekendShifts = 0;
        let bankHolidays = 0;

        periodShifts.forEach(s => {
            if (this._calculateNightHours(s.start, s.end) > 3) nightShifts++;
            const d = new Date(s.date);
            if (d.getDay() === 0 || d.getDay() === 6) weekendShifts++;
            if (this.bankHolidays.includes(s.date)) bankHolidays++;
        });

        // Weights
        return (nightShifts * 1.5) + (weekendShifts * 1.0) + (bankHolidays * 3.0);
    }

    calculateRollingAverage(staffId, allShifts, targetDate, weeks, preFilteredStaffShifts = null) {
        const endDate = new Date(targetDate);
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - (weeks * 7) + 1);

        const staffOnly = preFilteredStaffShifts || allShifts.filter(s => s.staffId === staffId);
        const periodShifts = staffOnly.filter(s => {
            const d = new Date(s.date);
            return d >= startDate && d <= endDate;
        });

        const totalHours = periodShifts.reduce((total, s) => {
            return total + this._calculateDuration(s.start, s.end);
        }, 0);

        return totalHours / weeks;
    }

    _calculateNightHours(start, end) {
        return this._calculateOverlap(start, end, '23:00', '06:00');
    }

    _calculateOverlap(startText, endText, rangeStartText, rangeEndText) {
        const s = window.TimeRange.hhmmToMinutes(startText);
        let e = s + window.TimeRange.getDurationMinutes(startText, endText);

        const rs = window.TimeRange.hhmmToMinutes(rangeStartText);
        let re = rs + window.TimeRange.getDurationMinutes(rangeStartText, rangeEndText);

        const overlap1 = Math.max(0, Math.min(e, re) - Math.max(s, rs));
        const overlap2 = Math.max(0, Math.min(e, re + 1440) - Math.max(s, rs + 1440));
        const overlap3 = Math.max(0, Math.min(e + 1440, re) - Math.max(s + 1440, rs));

        return (overlap1 + overlap2 + overlap3) / 60;
    }

    _timeToMins(timeStr) {
        return window.TimeRange.hhmmToMinutes(timeStr);
    }

    _calculateDuration(start, end) {
        return window.TimeRange.getDurationMinutes(start, end) / 60;
    }

    _getDateTime(dateStr, timeStr) {
        return new Date(`${dateStr}T${timeStr}`);
    }

    _isCrossMidnight(start, end) {
        return window.TimeRange.hhmmToMinutes(end) <= window.TimeRange.hhmmToMinutes(start);
    }

    _calculateAge(dob, refDate) {
        const birthDate = new Date(dob);
        const today = new Date(refDate);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
        return age;
    }

    checkYoungWorkerRules(staff, allShifts, targetDateStr) {
        if (!staff.dob) return [];
        const age = this._calculateAge(staff.dob, targetDateStr);
        if (age >= 18) return [];
        const violations = [];
        const staffShifts = allShifts.filter(s => s.staffId === staff.id && s.date === targetDateStr);
        staffShifts.forEach(s => {
            const duration = this._calculateDuration(s.start, s.end);
            if (duration > 8) violations.push({ type: 'YOUNG_WORKER_DAILY', message: `Young worker exceeded 8h daily limit`, date: s.date });
            if (this._calculateOverlap(s.start, s.end, '22:00', '06:00') > 0) {
                violations.push({ type: 'YW_NIGHT', message: `Young worker working restricted night hours (10pm-6am)`, date: s.date });
            }
        });
        return violations;
    }

    /**
     * Assessment of Night Work (Reg 6)
     * Night worker = normally works at least 3h during night period (23h-06h)
     */
    checkNightWork(staffId, allShifts) {
        const staffOnly = allShifts.filter(s => s.staffId === staffId);
        let totalNightHours = 0;
        let nightShiftCount = 0;

        staffOnly.forEach(s => {
            const h = this._calculateNightHours(s.start, s.end);
            totalNightHours += h;
            if (h >= 3) nightShiftCount++;
        });

        return {
            totalNightHours: parseFloat(totalNightHours.toFixed(1)),
            isNightWorker: nightShiftCount > 0
        };
    }

    check17WeekAverage(staffId, allShifts, isOptedOut, targetDate, preFilteredStaffShifts = null) {
        if (isOptedOut) return null;
        const avg = this.calculateRollingAverage(staffId, allShifts, targetDate, 17, preFilteredStaffShifts);
        if (avg > 48) {
            return { type: 'WEEKLY_LIMIT', message: `17-week avg (${avg.toFixed(1)}h) exceeds 48h limit`, hours: avg };
        }
        return null;
    }
}

window.ComplianceEngine = ComplianceEngine;
