
/**
 * TimeRange
 * Helpers for time parsing and overnight logic.
 */
window.TimeRange = {
    /**
     * Converts HH:MM string to total minutes from midnight.
     * @param {string} hhmm 
     * @returns {number}
     */
    hhmmToMinutes: function (hhmm) {
        if (!hhmm) return 0;
        const [h, m] = hhmm.split(':').map(Number);
        return (h * 60) + (m || 0);
    },

    /**
     * Calculates start and end Date objects from a reference date and time strings.
     * Handles overnight shifts (e.g. 20:00 to 07:00) by rolling end to next day.
     * @param {string} dateISO - YYYY-MM-DD
     * @param {string} startHHMM - HH:MM
     * @param {string} endHHMM - HH:MM
     * @returns {{start: Date, end: Date}}
     */
    rangeFromDateAndHm: function (dateISO, startHHMM, endHHMM) {
        const start = new Date(`${dateISO}T${startHHMM}:00`);
        let end = new Date(`${dateISO}T${endHHMM}:00`);

        // Overnight Check: If end is before or equal to start, it must be next day
        // e.g. Start 20:00, End 07:00 -> End is numerically smaller
        if (end <= start) {
            end.setDate(end.getDate() + 1);
        }

        return { start, end };
    }
};
