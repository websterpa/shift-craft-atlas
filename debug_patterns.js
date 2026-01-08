
const PatternDetectionEngine = require('./src/js/ai/PatternDetectionEngine.js');

const engine = new PatternDetectionEngine();

// Test Case 1: 5 Days Early, 2 Days Off (Weekly 7-day cycle)
// Data must be > minCycle * 2 = 4. Let's provide 3 weeks.
const pattern1 = ['E', 'E', 'E', 'E', 'E', 'X', 'X'];
const input1 = [...pattern1, ...pattern1, ...pattern1];

// Test Case 2: 4 Days On, 4 Days Off (8-day cycle)
// Provide 3 cycles (24 days)
const pattern2 = ['D', 'D', 'D', 'D', 'X', 'X', 'X', 'X'];
const input2 = [...pattern2, ...pattern2, ...pattern2];

// Test Case 3: 4 On, 2 Off (6-day cycle)
const pattern3 = ['L', 'L', 'L', 'L', 'X', 'X'];
const input3 = [...pattern3, ...pattern3, ...pattern3, ...pattern3]; // 24 days

function test(name, input, expectedLength, expectedPattern) {
    console.log(`\nTesting: ${name}`);
    const result = engine.detectPattern(input);
    console.log(`Detected Cycle: ${result.cycleLength}`);
    console.log(`Detected Pattern: ${JSON.stringify(result.pattern)}`);
    console.log(`Confidence: ${result.confidence}`);

    if (result.cycleLength !== expectedLength) {
        console.error(`FAIL: Expected length ${expectedLength}, got ${result.cycleLength}`);
    } else {
        // pattern array check
        const pStr = JSON.stringify(result.pattern);
        const eStr = JSON.stringify(expectedPattern);
        if (pStr === eStr) {
            console.log('PASS');
        } else {
            console.error(`FAIL: Pattern mismatch. Expected ${eStr}, got ${pStr}`);
        }
    }
}

test('5 On 2 Off (7 days)', input1, 7, pattern1);
test('4 On 4 Off (8 days)', input2, 8, pattern2);
test('4 On 2 Off (6 days)', input3, 6, pattern3);
