/**
 * ShiftPill - UI Component for Shift visualization
 * Consumes Unified Assignment Shape
 */
(function () {
    const ShiftPill = {
        /**
         * Renders a shift pill element from an assignment object.
         * @param {Object} shift - Unified Assignment Shape
         * @param {Object} options - { showTimes: boolean, compact: boolean }
         * @returns {HTMLElement}
         */
        create(shift, options = {}) {
            const pill = document.createElement('div');
            pill.className = 'monthly-shift-pill';

            // Classification (Logic extracted/shared)
            const info = this.classify(shift);

            // Status: Vacant
            const isVacant = shift.status === 'vacant' || (!shift.staff_id && !shift.staffId);
            if (isVacant) {
                pill.classList.add('vacant');
                pill.classList.add(info.cssClass);
                pill.innerHTML = `<span class="vacant-badge">VAC</span> <span class="shift-type-badge">${info.code}</span> ${shift.start} - ${shift.end}`;
                pill.title = `UNFILLED VACANCY\n${info.label}: ${shift.start} - ${shift.end}`;
                return pill;
            }

            // Normal
            pill.classList.add(info.cssClass);

            let html = `<span class="shift-type-badge">${info.code}</span> ${shift.start} - ${shift.end}`;

            // Compliance
            if (shift.complianceBreach) {
                pill.style.border = '2px solid var(--accent-rose)';
                pill.style.background = 'rgba(225, 29, 72, 0.15)';
                html += `<span title="Breach: ${shift.complianceBreach}" style="color:var(--accent-rose); margin-left:6px;">⚠️</span>`;
            } else if (shift.is_forced || shift.isForced) {
                pill.classList.add('forced-shift-pill');
                pill.style.borderLeft = '3px solid #f59e0b';
                pill.style.paddingLeft = '4px';
                html += `<span title="Forced: ${shift.forced_reason || shift.forcedReason}" style="color:#f59e0b; font-weight:bold; margin-left:6px;">(F)</span>`;
            }

            pill.innerHTML = html;

            // Tooltip
            const duration = this.getDuration(shift.start, shift.end);
            pill.title = `${info.label}: ${shift.start} - ${shift.end} (${duration}h)`;

            return pill;
        },

        classify(shift) {
            const sm = window.ShiftMapping;
            const code = shift.shift_code || (sm ? sm.toCode(shift.shiftType || '') : '?');
            const logical = sm ? sm.toLogical(code) : code;

            const cssMap = {
                'E': 'early', 'L': 'late', 'N': 'night', 'D': 'day12', 'R': 'rest', 'S': 'sick'
            };

            return {
                code,
                label: logical + (code === 'D' ? ' (12h)' : ''),
                cssClass: cssMap[code] || ''
            };
        },

        getDuration(start, end) {
            if (window.TimeRange) {
                return (window.TimeRange.getDurationMinutes(start, end) / 60).toFixed(1);
            }
            return '?';
        }
    };

    // Expose
    window.ShiftPill = ShiftPill;
})();
