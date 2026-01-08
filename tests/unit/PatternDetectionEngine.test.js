import { test, expect } from '@playwright/test';

test.describe('PatternDetectionEngine Unit Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://127.0.0.1:8080');
        await page.waitForLoadState('networkidle');
    });

    test('PatternDetectionEngine should be initialized', async ({ page }) => {
        const exists = await page.evaluate(() => typeof window.PatternDetectionEngine !== 'undefined');
        expect(exists).toBeTruthy();
    });

    test('should detect simple 4-day cycle (E-E-X-X)', async ({ page }) => {
        const result = await page.evaluate(() => {
            const engine = new window.PatternDetectionEngine();
            const data = ['E', 'E', 'R', 'R', 'E', 'E', 'R', 'R', 'E', 'E', 'R', 'R'];
            return engine.detectPattern(data);
        });

        expect(result.cycleLength).toBe(4);
        expect(result.pattern).toEqual(['E', 'E', 'R', 'R']);
        expect(result.confidence).toBeGreaterThan(0.9);
    });

    test('should detect 8-day Continental cycle', async ({ page }) => {
        const result = await page.evaluate(() => {
            const engine = new window.PatternDetectionEngine();
            // 2E, 2L, 2N, 2X
            const data = ['E', 'E', 'L', 'L', 'N', 'N', 'R', 'R', 'E', 'E', 'L', 'L', 'N', 'N', 'R', 'R'];
            return engine.detectPattern(data);
        });

        expect(result.cycleLength).toBe(8);
        expect(result.pattern).toEqual(['E', 'E', 'L', 'L', 'N', 'N', 'R', 'R']);
    });

    test('should handle noise/anomalies in data', async ({ page }) => {
        const result = await page.evaluate(() => {
            const engine = new window.PatternDetectionEngine();
            // Simple cycle with one error: E-X-E-X
            const data = ['E', 'R', 'E', 'R', 'L', 'R', 'E', 'R']; // 'L' is an anomaly
            return engine.detectPattern(data);
        });

        expect(result.cycleLength).toBe(2);
        expect(result.pattern).toEqual(['E', 'R']);
        expect(result.confidence).toBeLessThan(1.0);
    });
});
