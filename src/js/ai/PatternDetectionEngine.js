/**
 * PatternDetectionEngine - Core Algorithm for AI Roster Recognition
 * Detects cyclical rosters from normalized shift data.
 */
class PatternDetectionEngine {
    constructor() {
        this.minCycle = 2;
        this.maxCycle = 42; // Supports up to 6-week rosters
    }

    /**
     * Detect pattern from a sequence of shift codes (e.g., ['E', 'E', 'R', 'R', ...])
     */
    detectPattern(shifts) {
        if (!shifts || shifts.length < this.minCycle * 2) {
            return { pattern: [], cycleLength: 0, confidence: 0 };
        }

        const cycleLength = this.findCycleLength(shifts);
        if (cycleLength === 0) {
            return { pattern: [], cycleLength: 0, confidence: 0 };
        }

        const pattern = this.extractPattern(shifts, cycleLength);
        const confidence = this.calculateConfidence(shifts, pattern);

        return {
            pattern,
            cycleLength,
            confidence: Math.round(confidence * 100) / 100
        };
    }

    /**
     * Finds the most likely cycle length using a variation of autocorrelation
     */
    findCycleLength(shifts) {
        let bestLength = 0;
        let highestScore = 0;

        // Try every possible cycle length
        for (let length = this.minCycle; length <= this.maxCycle && length <= shifts.length / 2; length++) {
            let matches = 0;
            let total = 0;

            for (let i = 0; i < shifts.length - length; i++) {
                if (shifts[i] === shifts[i + length]) {
                    matches++;
                }
                total++;
            }

            let score = matches / total;

            // Penalty for complexity (longer cycles)
            // This prevents noise from making a 4-day cycle look like a "perfect" 28-day cycle
            const complexityPenalty = 1 - (length * 0.005);
            const adjustedScore = score * complexityPenalty;

            if (adjustedScore > highestScore) {
                // If this is a multiple of an existing bestLength, only replace if significantly better
                // (e.g., a 28-day cycle must be much better than a 7-day cycle to be chosen)
                if (bestLength > 0 && length % bestLength === 0) {
                    if (score > (highestScore / (1 - bestLength * 0.005)) * 1.2) {
                        highestScore = adjustedScore;
                        bestLength = length;
                    }
                } else {
                    highestScore = adjustedScore;
                    bestLength = length;
                }
            }
        }

        // Only return if confidence is reasonable
        return highestScore > 0.3 ? bestLength : 0;
    }

    /**
     * Extracts the most frequent shift for each day in the cycle
     */
    extractPattern(shifts, length) {
        const pattern = [];

        for (let i = 0; i < length; i++) {
            const counts = {};
            for (let j = i; j < shifts.length; j += length) {
                const shift = shifts[j];
                counts[shift] = (counts[shift] || 0) + 1;
            }

            // Find most frequent shift at this position
            let topShift = 'R';
            let maxCount = -1;
            for (const [shift, count] of Object.entries(counts)) {
                if (count > maxCount) {
                    maxCount = count;
                    topShift = shift;
                }
            }
            pattern.push(topShift);
        }

        return pattern;
    }

    /**
     * Calculates how many shifts in the data match the extracted pattern
     */
    calculateConfidence(shifts, pattern) {
        if (!pattern.length) return 0;
        let matches = 0;

        for (let i = 0; i < shifts.length; i++) {
            if (shifts[i] === pattern[i % pattern.length]) {
                matches++;
            }
        }

        return matches / shifts.length;
    }

    /**
     * Detect teams by looking for offset patterns in a grid of staff data
     */
    detectTeams(staffGrids) {
        // Implementation for detecting team offsets between different employees
        // This will be used to map employees to "Team 1", "Team 2", etc.
        // To be detailed in next phase (A3.4)
    }
}

// Global exposure
if (typeof window !== 'undefined') {
    window.PatternDetectionEngine = PatternDetectionEngine;
} else if (typeof module !== 'undefined' && module.exports) {
    module.exports = PatternDetectionEngine;
}
