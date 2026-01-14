import { test, expect } from '@playwright/test';

test.describe('Ghost Shift Regression Test', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('http://127.0.0.1:8080');
        // Ensure app loaded - wait for main view container
        await expect(page.locator('#view-roster')).toBeVisible();
        await page.waitForTimeout(1000); // Stability
    });

    test('Wizard "Clear Existing" should remove shifts for UNSELECTED staff too', async ({ page }) => {

        // 1. Inject a "Ghost Shift" for a staff member we will NOT select
        await page.evaluate(() => {
            const ghostShift = {
                id: 'ghost-shift-1',
                staffId: 'cctv-unknown-ghost',
                date: new Date().toISOString().split('T')[0], // Today
                start: '09:00',
                end: '17:00',
                shiftType: 'D'
            };
            // Ensure app global exists
            if (window.app && window.app.shifts) {
                window.app.shifts.push(ghostShift);
                if (window.app.renderTableBody) window.app.renderTableBody();
            }
        });

        // Verify it exists in data
        const hasGhost = await page.evaluate(() => window.app.shifts.some(s => s.id === 'ghost-shift-1'));
        expect(hasGhost).toBe(true);

        // 2. Run Wizard
        await page.click('#roster-wizard-btn');
        await expect(page.locator('#roster-wizard-modal')).toBeVisible();

        // Step 1: Start -> Next
        await page.click('#wizard-next-btn');

        // Step 2: Pattern -> Next
        await page.click('#wizard-next-btn');

        // Step 3: Staff Selection
        // Deselect all
        const checkboxes = page.locator('.wizard-staff-checkbox');
        const count = await checkboxes.count();
        for (let i = 0; i < count; i++) {
            const isChecked = await checkboxes.nth(i).isChecked();
            if (isChecked) await checkboxes.nth(i).uncheck();
        }

        // Select just one "Real" staff
        await checkboxes.first().check();
        await page.click('#wizard-next-btn');

        // Step 4: Confirm
        // Ensure "Clear Existing" is checked (default)
        const clearCheck = page.locator('#wizard-clear-existing');
        await expect(clearCheck).toBeChecked();

        // Check Label update (Confirm Fix Applied)
        await expect(page.locator('label[for="wizard-clear-existing"]')).toContainText('Clear ALL shifts');

        // Generate
        await page.click('#wizard-finish-btn');

        // Wait for modal to close
        await expect(page.locator('#roster-wizard-modal')).toBeHidden();

        // 3. Verify Ghost Shift is GONE
        const ghostRemains = await page.evaluate(() => window.app.shifts.some(s => s.id === 'ghost-shift-1'));
        expect(ghostRemains).toBe(false, 'Ghost shift should have been removed by "Clear Existing" logic');

    });
});
