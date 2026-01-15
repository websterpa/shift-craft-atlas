
/**
 * DiagnosticsBanner
 * Warns users if required shift types are completely missing from the roster.
 */
class DiagnosticsBanner {
    constructor(app) {
        this.app = app;
        this.bannerId = 'diagnostics-banner';
        this.init();
    }

    init() {
        this.injectBanner();
    }

    injectBanner() {
        if (document.getElementById(this.bannerId)) return;

        const banner = document.createElement('div');
        banner.id = this.bannerId;
        // Insert it before the main content or inside content-wrapper
        const wrapper = document.querySelector('.content-wrapper');
        const topBar = document.getElementById('global-top-bar');

        if (wrapper) {
            if (topBar) {
                topBar.insertAdjacentElement('afterend', banner);
            } else {
                wrapper.prepend(banner);
            }
        }
    }

    runCheck() {
        const banner = document.getElementById(this.bannerId);
        if (!banner) return;

        // 1. Get Requirements
        const requirements = this.app.settings.staffingRequirements || { early: 2, late: 2, night: 1, day12: 1 };

        // 2. Requirements Keys (standardized in ShiftMapping logic)
        const checkTypes = ['early', 'late', 'night', 'day12'];

        // 3. Determine View Range (Month vs Week)
        // Default to Month view context if available, otherwise fallback to current date context
        let rangeStart, rangeEnd;

        if (this.app.monthlyRosterView && this.app.monthlyRosterView.currentMonth) {
            const m = this.app.monthlyRosterView.currentMonth;
            rangeStart = new Date(m.getFullYear(), m.getMonth(), 1).toISOString().split('T')[0];
            rangeEnd = new Date(m.getFullYear(), m.getMonth() + 1, 0).toISOString().split('T')[0];
        } else if (this.app.weekStart) {
            // Even in weekly view, diagnostics about "missing shift types" are usually more relevant 
            // over a broader period (like the month containing the week), but strict adherence 
            // to "visible month" suggests checking the month the week falls in.
            const w = new Date(this.app.weekStart);
            rangeStart = new Date(w.getFullYear(), w.getMonth(), 1).toISOString().split('T')[0];
            rangeEnd = new Date(w.getFullYear(), w.getMonth() + 1, 0).toISOString().split('T')[0];
        } else {
            // Fallback to current month
            const now = new Date();
            rangeStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        }

        // 4. Get active shifts in range
        // We only care if the TYPE exists at all
        const shiftsInRange = this.app.shifts.filter(s => s.date >= rangeStart && s.date <= rangeEnd);

        const missingCodes = [];

        const keyMap = {
            early: 'E',
            late: 'L',
            night: 'N',
            day12: 'D'
        };

        Object.keys(requirements).forEach(key => {
            const requiredQty = requirements[key];
            if (requiredQty > 0) {
                const code = keyMap[key]; // e.g., 'N'
                // Check if any shift effectively maps to this code
                // We use the helper if available, or loose classification
                const exists = shiftsInRange.some(s => {
                    // Start time check or explicit type check
                    // Use app's classifier if possible, or replicate basic logic
                    const info = this.app.classifyShiftType ? this.app.classifyShiftType(s) : this.classifyShiftLocal(s);
                    return info.code === code;
                });

                if (!exists) {
                    missingCodes.push(code);
                }
            }
        });

        // 5. Update Banner
        if (missingCodes.length > 0) {
            banner.innerHTML = `<i data-lucide="alert-triangle"></i> Missing required shift(s): ${missingCodes.join(', ')}`;
            banner.style.display = 'flex';
            if (window.lucide) window.lucide.createIcons();
        } else {
            banner.style.display = 'none';
        }
    }

    classifyShiftLocal(shift) {
        if (this.app && this.app.classifyShiftType) {
            return this.app.classifyShiftType(shift);
        }

        // Final fallback if app.js not available
        const duration = window.TimeRange.getDurationMinutes(shift.start, shift.end) / 60;
        const startMins = window.TimeRange.hhmmToMinutes(shift.start);
        const code = (duration >= 11) ? ((startMins >= 1140 || startMins < 360) ? 'N' : 'D') :
            ((startMins >= 1140 || startMins < 360) ? 'N' :
                (startMins >= 300 && startMins < 600) ? 'E' :
                    (startMins >= 720 && startMins < 1140) ? 'L' : '?');
        return { code };
    }
}

// Global Exposure
window.DiagnosticsBanner = DiagnosticsBanner;
