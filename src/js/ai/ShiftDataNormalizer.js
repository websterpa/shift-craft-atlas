/**
 * ShiftDataNormalizer - NLP & Data Cleaning Layer
 * Part of the AI Pattern Recognition Phase
 */
class ShiftDataNormalizer {
    constructor() {
        this.shiftMap = {
            // Early Shifts
            'E': 'E', 'EARLY': 'E', 'MORNING': 'E', 'M': 'E', 'AM': 'E',
            // Late Shifts
            'L': 'L', 'LATE': 'L', 'AFTERNOON': 'L', 'A': 'L', 'PM': 'L',
            // Night Shifts
            'N': 'N', 'NIGHT': 'N', 'NIGHTS': 'N',
            // Off / Rest
            'R': 'R', 'OFF': 'R', 'REST': 'R', '-': 'R', '': 'R',
            'X': 'R', // Map legacy X to R
            // Long Days (Common in UK Healthcare)
            'LD': 'LD', 'LONG DAY': 'LD'
        };
    }

    /**
     * Map raw shift codes to standard UK codes (E, L, N, X, LD)
     */
    normalizeShiftCode(rawCode) {
        if (rawCode === null || rawCode === undefined) return 'R';
        const cleaned = String(rawCode).trim().toUpperCase();
        return this.shiftMap[cleaned] || cleaned;
    }

    /**
     * Clean and normalize staff names
     */
    normalizeName(name) {
        if (!name) return '';
        return name.trim().replace(/\s+/g, ' ');
    }

    /**
     * Safely parse dates, supporting multiple formats (prioritizing UK DD/MM/YYYY)
     */
    parseDate(dateInput) {
        if (!dateInput) return null;
        if (dateInput instanceof Date) return dateInput;

        const dateStr = String(dateInput).trim();

        // Try UK Format: DD/MM/YYYY or DD-MM-YYYY
        const ukMatch = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (ukMatch) {
            const day = parseInt(ukMatch[1]);
            const month = parseInt(ukMatch[2]) - 1; // 0-indexed
            let year = parseInt(ukMatch[3]);
            if (year < 100) year += 2000;
            return new Date(year, month, day);
        }

        // Fallback to standard JS parsing
        const parsed = new Date(dateStr);
        return isNaN(parsed.getTime()) ? null : parsed;
    }

    /**
     * Clean a raw array/object of parsed data into a standard format
     */
    normalizeGrid(rawGrid) {
        if (!Array.isArray(rawGrid)) return [];

        return rawGrid.map(row => {
            if (Array.isArray(row)) {
                return row.map(cell => this.normalizeShiftCode(cell));
            }
            return row;
        });
    }
}

// Global exposure
// Global exposure
if (typeof window !== 'undefined') {
    window.ShiftDataNormalizer = ShiftDataNormalizer;
} else if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShiftDataNormalizer;
}
