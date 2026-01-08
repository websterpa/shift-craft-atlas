import { test, expect } from '@playwright/test';

test.describe('ShiftDataNormalizer Unit Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://127.0.0.1:8080');
        await page.waitForLoadState('networkidle');
    });

    test('ShiftDataNormalizer should be initialized', async ({ page }) => {
        const exists = await page.evaluate(() => typeof window.ShiftDataNormalizer !== 'undefined');
        expect(exists).toBeTruthy();
    });

    test('should normalize shift codes', async ({ page }) => {
        const result = await page.evaluate(() => {
            const normalizer = new window.ShiftDataNormalizer();
            return {
                early: normalizer.normalizeShiftCode('E'),
                earlyFull: normalizer.normalizeShiftCode('Early'),
                morning: normalizer.normalizeShiftCode('M'),
                late: normalizer.normalizeShiftCode('L'),
                night: normalizer.normalizeShiftCode('N'),
                off: normalizer.normalizeShiftCode('X'),
                offWord: normalizer.normalizeShiftCode('OFF')
            };
        });

        expect(result.early).toBe('E');
        expect(result.earlyFull).toBe('E');
        expect(result.morning).toBe('E');
        expect(result.late).toBe('L');
        expect(result.night).toBe('N');
        expect(result.off).toBe('R');
        expect(result.offWord).toBe('R');
    });

    test('should extract staff names accurately', async ({ page }) => {
        const name = await page.evaluate(() => {
            const normalizer = new window.ShiftDataNormalizer();
            return normalizer.normalizeName('  James Smith  ');
        });
        expect(name).toBe('James Smith');
    });

    test('should parse dates safely', async ({ page }) => {
        const dateStr = await page.evaluate(() => {
            const normalizer = new window.ShiftDataNormalizer();
            const date = normalizer.parseDate('20/12/2025'); // UK Format
            return date ? date.toISOString().split('T')[0] : null;
        });
        expect(dateStr).toBe('2025-12-20');
    });
});
