
import { test, expect } from '@playwright/test';

test.describe('Roster Wizard Controls', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');

        // Open Wizard
        // We can click the "Roster" nav button or the FAB "Add Shift"? 
        // Or just execute script to open it for speed/reliability
        await page.evaluate(() => {
            // Ensure app is ready?
            if (window.wizard) window.wizard.open();
        });

        await expect(page.locator('#roster-wizard-modal')).toHaveClass(/active/);
    });

    test('Header Close button works', async ({ page }) => {
        // Click CSS-ID button
        await page.click('#wizard-close-btn');
        await expect(page.locator('#roster-wizard-modal')).not.toHaveClass(/active/);
    });

    test('Back button is disabled on Step 1', async ({ page }) => {
        const backBtn = page.locator('#wizard-prev-btn');
        await expect(backBtn).toBeDisabled();
    });

    test.skip('Next button advances step and enables Back button', async ({ page }) => {
        // Step 1: Add a pattern (required for validation)
        await page.click('#wizard-pattern-grid button', { timeout: 5000 }); // Click a grid item?
        // Wait, grid renders via renderStep1.
        // Let's simple check validation handles "No pattern"
        // Actually, validation blocks Next if pattern is all 'R'.
        // Step 1 default is 'R'.
        // We need to click "Cyclic" or modify input.
        // Let's simulate valid step 1.
        await page.fill('#wizard-pattern-text', 'N,N,R,R,R,R,R');
        await page.dispatchEvent('#wizard-pattern-text', 'change'); // Trigger update

        await page.click('#wizard-next-btn');

        // Should be Step 2
        // Panel 2 visible?
        const step2 = page.locator('.wizard-panel[data-step="2"]');
        await expect(step2).toBeVisible();

        // Back button enabled?
        const backBtn = page.locator('#wizard-prev-btn');
        await expect(backBtn).toBeEnabled();

        // Click Back
        await backBtn.click();
        await expect(page.locator('.wizard-panel[data-step="1"]')).toBeVisible();
    });

});
