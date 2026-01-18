
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock Browser Environment
global.window = {};

// Load Helpers
const loadScript = (relativePath) => {
    const p = path.resolve(__dirname, '../../' + relativePath);
    const code = fs.readFileSync(p, 'utf8');
    eval(code);
};

loadScript('public/app/src/features/roster/shiftMapping.js');
loadScript('public/app/src/features/time/timeRange.js');

const ShiftMapping = global.window.ShiftMapping;
const TimeRange = global.window.TimeRange;

console.log('🧪 Testing ShiftFeatures...');

// 1. ShiftMapping
console.log('Testing ShiftMapping...');
assert.strictEqual(ShiftMapping.toCode('Night'), 'N');
assert.strictEqual(ShiftMapping.toCode('EARLY'), 'E');
assert.strictEqual(ShiftMapping.toCode('Sick'), 'S');
assert.strictEqual(ShiftMapping.toCode('Unknown'), 'UNKNOWN'); // Converted to upper
assert.strictEqual(ShiftMapping.isValidCode('N'), true);
assert.strictEqual(ShiftMapping.isValidCode('X'), false); // X is not standard (mapped to R usually, but isValid checks strict codes)

// 2. TimeRange - Overnight Rollover
console.log('Testing TimeRange Overnight Logic...');
const date = '2023-01-01';
// Day Shift: 08:00 - 20:00
const dayRange = TimeRange.rangeFromDateAndHm(date, '08:00', '20:00');
assert.strictEqual(dayRange.start.getDate(), 1);
assert.strictEqual(dayRange.end.getDate(), 1);

// Night Shift: 20:00 - 08:00 (Next Day)
const nightRange = TimeRange.rangeFromDateAndHm(date, '20:00', '08:00');
assert.strictEqual(nightRange.start.getDate(), 1);
assert.strictEqual(nightRange.end.getDate(), 2, 'End date should be next day');

// Edge Case: 23:00 - 23:00 (Full 24h? Or error? Logic says <= rolls over)
const fullRange = TimeRange.rangeFromDateAndHm(date, '23:00', '23:00');
assert.strictEqual(fullRange.end.getDate(), 2, 'Equal times should rollover (assuming end of shift)');

// 3. Integration Check (Mocking ShiftDataNormalizer usage)
// We need to load ShiftDataNormalizer class now
const normalizerPath = path.resolve(__dirname, '../../public/app/src/js/ai/ShiftDataNormalizer.js');
const normalizerCode = fs.readFileSync(normalizerPath, 'utf8');
// Evaluate in context where window.ShiftMapping exists
eval(normalizerCode);
const Normalizer = global.window.ShiftDataNormalizer || module.exports; // Handle dual export logic in file
const norm = new Normalizer();

console.log('Testing Integration...');
assert.strictEqual(norm.normalizeShiftCode('Night'), 'N', 'Should use global helper');
assert.strictEqual(norm.normalizeShiftCode(' EARLY '), 'E', 'Should trim and use helper');

console.log('✅ ShiftFeatures Tests Passed');
