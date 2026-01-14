
/**
 * ShiftMapping
 * Central source of truth for shift codes.
 */
window.ShiftMapping = {
    /**
     * Converts various inputs to standard shift codes.
     * @param {string} input 
     * @returns {string} Standard code (N, E, L, D, R, S) or original if unknown
     */
    toCode: function (input) {
        if (!input) return '';
        const upper = input.toUpperCase().trim();

        // Direct matches
        if (['N', 'E', 'L', 'D', 'R', 'S'].includes(upper)) return upper;

        // Semantic matches
        if (upper.includes('NIGHT')) return 'N';
        if (upper.includes('EARLY')) return 'E';
        if (upper.includes('LATE')) return 'L';
        if (upper.includes('DAY')) return 'D';
        if (upper.includes('REST') || upper.includes('OFF')) return 'R';
        if (upper.includes('SICK')) return 'S';

        return upper;
    },

    /**
     * Checks if a code is a known valid standard code.
     * @param {string} code 
     * @returns {boolean}
     */
    isValidCode: function (code) {
        return ['N', 'E', 'L', 'D', 'R', 'S'].includes(code);
    }
};
