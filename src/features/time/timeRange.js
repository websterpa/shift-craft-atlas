/**
 * Shift Craft (Atlas) - Time Range Helpers
 * Centralized logic for stabilizing time calculations, overnight shifts, and UK DST.
 */

/**
 * Converts "HH:MM" string to total minutes from start of day.
 * @param {string} hhmm - Time in 24h format (e.g. "07:30")
 * @returns {number} - Total minutes
 */
/**
 * Converts "HH:MM" string to total minutes from start of day.
 * Accepts 00:00 to 24:00 (24:00 treated as 1440).
 * @param {string} hhmm - Time in 24h format
 * @returns {number} - Total minutes
 */
function hhmmToMinutes(hhmm) {
    if (typeof hhmm !== "string") throw new Error("hhmmToMinutes: expected string");

    // Strict regex from requirements
    const m = hhmm.match(/^([01]?\d|2[0-3]|24):([0-5]\d)$/);
    if (!m) throw new Error(`hhmmToMinutes: invalid time "${hhmm}"`);

    const h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);

    // 24:00 is valid, but 24:01 is not
    if (h === 24 && min !== 0) throw new Error(`hhmmToMinutes: 24:${m[2]} is invalid`);

    return h * 60 + min;
}

/**
 * Build [start, end] Date objects for a given local calendar date and HH:mm times.
 * If end <= start, end is rolled to the next day (handles overnight shifts).
 * @param {string} dateISO - "YYYY-MM-DD"
 * @param {string} startHHMM 
 * @param {string} endHHMM 
 * @returns {{ start: Date, end: Date }}
 */
function rangeFromDateAndHm(dateISO, startHHMM, endHHMM) {
    // Validate inputs by converting first (will throw if invalid)
    const startMins = hhmmToMinutes(startHHMM);
    const endMins = hhmmToMinutes(endHHMM);

    // Construct start Date
    const start = new Date(`${dateISO}T${startHHMM}:00`);

    // Construct end Date
    let end = new Date(`${dateISO}T${endHHMM}:00`);

    // Handle overnight rollover: If end time is same or before start time, it's next day
    if (endMins <= startMins) {
        end.setDate(end.getDate() + 1);
    }

    return { start, end };
}

/**
 * Calculates duration in minutes, handling rollovers.
 * @param {string} startHHMM 
 * @param {string} endHHMM 
 * @returns {number}
 */
function getDurationMinutes(startHHMM, endHHMM) {
    const startMins = hhmmToMinutes(startHHMM);
    let endMins = hhmmToMinutes(endHHMM);

    if (endMins <= startMins) {
        endMins += 1440; // Add 24 hours
    }

    return endMins - startMins;
}

// Global exposure
window.TimeRange = {
    hhmmToMinutes,
    rangeFromDateAndHm,
    getDurationMinutes
};
