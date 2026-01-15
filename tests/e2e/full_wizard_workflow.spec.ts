
import { test, expect } from '@playwright/test';

test.describe('Full Roster Wizard Integration', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');

        // Factory Reset to ensure clean state
        await page.evaluate(() => window.localStorage.clear());
        await page.reload();

        // Add dummy staff via console to ensure we have people to roster
        await page.evaluate(() => {
            window.app.addTestStaff(5);
        });

        // Open Wizard
        await page.locator('#roster-wizard-btn').click();
        await expect(page.locator('#roster-wizard-modal')).toHaveClass(/active/);
    });

    test('Complete wizard flow generates correct assignments', async ({ page }) => {
        // Step 1: Design Pattern "D, N, R"
        const cell0 = page.locator('.pattern-cell[data-index="0"]'); // Day 1
        const cell1 = page.locator('.pattern-cell[data-index="1"]'); // Day 2

        // R -> E -> L -> N -> D
        // Click cell 0 four times for D
        await cell0.click(); await cell0.click(); await cell0.click(); await cell0.click();
        await expect(cell0).toContainText('D');

        // Click cell 1 three times for N
        await cell1.click(); await cell1.click(); await cell1.click();
        await expect(cell1).toContainText('N');

        // Set Cycle Length to 3 (D, N, R)
        await page.fill('#wizard-cycle-input', '3');
        await expect(page.locator('.pattern-cell')).toHaveCount(3);

        await page.locator('#wizard-next-btn').click();

        // Step 2: Coverage
        // Should show inputs for D and N
        await expect(page.locator('text=Day (12h) Shift Coverage')).toBeVisible();
        await expect(page.locator('text=Night Shift Coverage')).toBeVisible();

        // Set requirements to 1
        // (Inputs rely on order, best to target by surrounding context if possible, or just default is 1)
        // Default is 1, so we are good.

        await page.locator('#wizard-next-btn').click();

        // Step 3: Staff Selection
        await expect(page.locator('#wizard-staff-list')).toBeVisible();
        // Select All check
        const selectAll = page.locator('#wizard-select-all');
        if (!await selectAll.isChecked()) await selectAll.check();

        // Verify selection count
        await expect(page.locator('#wizard-selection-count')).toContainText('5 selected');

        await page.locator('#wizard-next-btn').click();

        // Step 4: Summary & Generate
        await expect(page.locator('text=Plan is Feasible')).toBeVisible();

        // Click Generate
        await page.locator('#wizard-finish-btn').click();

        // Check for Compliance Gate
        try {
            const gate = page.locator('#compliance-gate-modal');
            await gate.waitFor({ state: 'visible', timeout: 3000 });
            await page.locator('#gate-override-btn').click();
            await expect(gate).toBeHidden();
        } catch (e) {
            // No gate, proceed
        }

        // Modal should close
        await expect(page.locator('#roster-wizard-modal')).not.toHaveClass(/active/);

        // Verify Roster Table Populated
        const pills = page.locator('.shift-pill');
        await expect(pills).not.toHaveCount(0);

        // Check for specific classes corresponding to our pattern D and N
        const dayPills = page.locator('.shift-pill.day12');
        const nightPills = page.locator('.shift-pill.night');

        await expect(dayPills.first()).toBeVisible();
        await expect(nightPills.first()).toBeVisible();
    });

});
