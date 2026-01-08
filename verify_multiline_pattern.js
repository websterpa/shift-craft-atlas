
// Mock Dependencies
const ShiftDataNormalizer = require('./src/js/ai/ShiftDataNormalizer.js');
const PatternDetectionEngine = require('./src/js/ai/PatternDetectionEngine.js');

// Mock AIPatternUI partial implementation (only what we changed)
class MockAIPatternUI {
    constructor() {
        this.normalizer = new ShiftDataNormalizer();
        this.detector = new PatternDetectionEngine();
        this.bestPattern = null;
        this.detectedStaff = [];
        this.mappings = [];
    }

    // Copy-pasted/Adapted version of our new processGridForPatterns
    // Adjusting "this.detectMappings" since we don't need real staff matching here
    processGridForPatterns(grid) {
        // Init Map to store aggregated shift streams per staff
        const staffStreams = new Map(); // Name -> { name, shifts: [] }

        grid.forEach((row, idx) => {
            const normalizedRow = row.map(cell => this.normalizer.normalizeShiftCode(cell));
            // FIXED: Using local reference or properly bound 'this'
            // The issue was likely how .forEach handles 'this' or how we called it.
            // But actually arrow functions preserve 'this'.
            // Let's debug by logging inside the loop.
            const shiftCount = normalizedRow.filter(c => ['E', 'L', 'N', 'LD'].includes(c)).length;

            console.log(`Row ${idx} shift codes: ${shiftCount}`);

            if (shiftCount > 2) {
                const nameCandidate = row.find(cell =>
                    cell &&
                    cell.length > 2 &&
                    !this.normalizer.normalizeShiftCode(cell).match(/^[ELNX]|LD$/)
                );

                console.log(`Row ${idx} name candidate: ${nameCandidate}`);

                if (nameCandidate) {
                    const normalizedName = this.normalizer.normalizeName(nameCandidate);
                    console.log(`Row ${idx} normalized name: ${normalizedName}`);

                    if (!staffStreams.has(normalizedName)) {
                        staffStreams.set(normalizedName, {
                            name: normalizedName,
                            shifts: []
                        });
                    }

                    const shiftsOnly = normalizedRow.filter(cell => cell.match(/^[ELNX]|LD$/));
                    staffStreams.get(normalizedName).shifts.push(...shiftsOnly);
                    console.log(`Row ${idx} added ${shiftsOnly.length} shifts to ${normalizedName}`);
                }
            }
        });

        const candidates = [];
        const staffNames = [];

        staffStreams.forEach((data, name) => {
            staffNames.push(name);
            candidates.push(data.shifts);
        });

        console.log('Aggregated Stream Length:', candidates[0]?.length);
        console.log('Aggregated Stream:', JSON.stringify(candidates[0]));

        let best = { pattern: [], cycleLength: 0, confidence: 0 };

        if (candidates.length > 0) {
            const patterns = candidates.map(c => this.detector.detectPattern(c));
            best = patterns.sort((a, b) => b.confidence - a.confidence)[0];
        }

        this.bestPattern = best;
        this.detectedStaff = staffNames;
    }
}

// Support Node.js environment for Normalizer if not already supported
if (!global.window) global.window = {};

// --- TEST SETUP ---

// Create a 4-on-4-off pattern (8 days) spanning 3 weeks (21 days)
// Pattern: D, D, D, D, X, X, X, X (Repeats)
// Week 1 (Days 1-7): D D D D X X X
// Week 2 (Days 8-14): X D D D D X X  <-- Offset logic
// Week 3 (Days 15-21): X X D D D D X

const ui = new MockAIPatternUI();

const grid = [
    ['Test User', 'E', 'E', 'E', 'E', 'X', 'X', 'X'], // Week 1
    ['Test User', 'X', 'E', 'E', 'E', 'E', 'X', 'X'], // Week 2
    ['Test User', 'X', 'X', 'E', 'E', 'E', 'E', 'X']  // Week 3
];

console.log('--- Running Test ---');
ui.processGridForPatterns(grid);

console.log('\n--- Results ---');
console.log(`Detected Cycle Length: ${ui.bestPattern.cycleLength}`);
console.log(`Confidence: ${ui.bestPattern.confidence}`);

if (ui.bestPattern.cycleLength === 8) {
    console.log('SUCCESS: Identified 8-day cycle from fragmented weekly rows.');
} else {
    console.error(`FAILURE: Expected 8, got ${ui.bestPattern.cycleLength}`);
    process.exit(1);
}
