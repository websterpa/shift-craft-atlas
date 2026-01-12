
import { test, expect } from '@playwright/test';

test.describe('Roster Wizard Step Functionality (Refactored Bindings)', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Open Wizard via Header Button
        await page.locator('#roster-wizard-btn').click();
        await expect(page.locator('#roster-wizard-modal')).toHaveClass(/active/);
    });

    test('Step 1: Grid click works via delegation', async ({ page }) => {
        // Find a cell
        const cell = page.locator('.pattern-cell[data-index="0"]');
        await expect(cell).toBeVisible();

        // Initial state (assuming empty/default)
        // Check content? Or just click and see update.
        // We need to know what it cycles to. Default is 'R'.
        // R -> E -> L -> N -> D -> C -> R

        // Click it
        await cell.click();

        // Check text content changes
        // RosterWizard Logic: toggleShift updates config and re-renders.
        // So cell content should change.
        // Since pattern starts as 'R' (default), click -> 'E'.
        await expect(cell).toContainText('E');
    });

    test('Step 4: Save Pattern Binding', async ({ page }) => {
        // Skip to Step 4? 
        // We can manually show step 4 via JS for speed
        await page.evaluate(() => {
            window.wizard.showStep(4);
        });

        const checkbox = page.locator('#wizard-save-pattern');
        const input = page.locator('#wizard-pattern-name');

        // Initial state: unchecked, hidden
        await expect(checkbox).not.toBeChecked();
        await expect(input).toBeHidden();

        // Click checkbox
        await checkbox.check();

        // Should show input
        await expect(input).toBeVisible();

        // Type in input
        await input.fill('My New Pattern');

        // Verify config updated (via JS evaluation)
        const name = await page.evaluate(() => window.wizard.config.patternName);
        expect(name).toBe('My New Pattern');
    });

});
