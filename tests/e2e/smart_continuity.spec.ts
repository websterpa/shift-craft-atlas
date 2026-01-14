import { test, expect } from '@playwright/test';

test.describe('Smart Roster Extension (Continuity)', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('http://127.0.0.1:8080');
        await expect(page.locator('#view-roster')).toBeVisible();
        await page.waitForTimeout(1000); // Stability
    });

    test('Should detect last roster end date and continue pattern', async ({ page }) => {

        // 1. Seed Last Shift: "D" on today's date for staff "cctv-1"
        const todayStr = new Date().toISOString().split('T')[0];

        await page.evaluate((date) => {
            // Clear existing
            window.app.shifts = [];

            // Add seed shift
            window.app.shifts.push({
                id: 'seed-shift-1',
                staffId: 'cctv-1',
                date: date,
                start: '07:00',
                end: '19:00',
                shiftType: 'D'
            });
            window.app.renderTableBody();

            // Seed LocalStorage with a Custom Pattern [D, N, R]
            const lastRun = {
                patternSequence: ['D', 'N', 'R'],
                cycleLength: 3,
                selectedStaff: ['cctv-1'],
                sourcePatternName: 'Test Pattern',
                rosterName: 'Test Continuation'
            };
            localStorage.setItem('shiftcraft_wizard_last_run', JSON.stringify(lastRun));
        }, todayStr);

        // 2. Open Wizard
        await page.click('#roster-wizard-btn');
        await expect(page.locator('#roster-wizard-modal')).toBeVisible();

        // 3. Click "Continue"
        await page.click('#wizard-continue-btn');

        // 4. Verify Toast & Transition
        // Check for Step 2 Header
        await page.waitForTimeout(500);
        await expect(page.locator('h3:has-text("Resource Requirements")')).toBeVisible();

        // 5. Verify Configuration State (via JS)
        const config = await page.evaluate(() => window.wizard.config);

        // Date Check: Should be Today + 1
        const tomorrowObj = new Date();
        tomorrowObj.setDate(tomorrowObj.getDate() + 1);
        const tomorrowStr = tomorrowObj.toISOString().split('T')[0];

        expect(config.startDate).toBe(tomorrowStr);

        // Offset Check: Last was 'D' (idx 0), Next should be 'N' (idx 1).
        // Logic: Offset is set such that (Day0 + Offset) % 3 = 1.
        // Day0 is 0. So Offset % 3 = 1. => Offset = 1.
        expect(config.initialOffsets['cctv-1']).toBe(1);

        // 6. Generate to Prove Code
        await page.click('#wizard-next-btn'); // Step 2 -> 3
        await page.click('#wizard-next-btn'); // Step 3 -> 4
        await page.click('#wizard-finish-btn'); // Generate

        // 7. Verify Generated Shift
        // Shift on tomorrow should be 'N'
        const shifts = await page.evaluate(() => window.app.shifts);
        const nextShift = shifts.find(s => s.staffId === 'cctv-1' && s.date === config.startDate);

        expect(nextShift).toBeDefined();
        expect(nextShift.shiftType).toBe('N');

    });
});
