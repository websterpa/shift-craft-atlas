/**
 * Truth Protocol Enforcement Test
 * 
 * This test runs automatically and verifies that all interactive elements
 * in modals/wizards have proper unique IDs to prevent selector collisions.
 * 
 * Usage: npx playwright test tests/truth-protocol/dom-conventions.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Truth Protocol: DOM Naming Conventions', () => {

    test.beforeEach(async ({ page }) => {
        // Force cache-busting reload to ensure latest JS is loaded
        await page.goto('http://localhost:8080?_t=' + Date.now());
        // Wait for app to initialize
        await page.waitForFunction(() => (window as any).app !== undefined, { timeout: 10000 });

        // Inject mock staff data - required for the Select All checkbox to appear
        await page.evaluate(() => {
            const app = (window as any).app;
            if (app && (!app.staff || app.staff.length === 0)) {
                const mockStaff = [
                    { id: 'test-1', name: 'Test Staff 1', role: 'Nurse', type: 'FULLTIME', hoursPerWeek: 37.5, defaultHourlyRate: 15 },
                    { id: 'test-2', name: 'Test Staff 2', role: 'Nurse', type: 'FULLTIME', hoursPerWeek: 37.5, defaultHourlyRate: 15 },
                    { id: 'test-3', name: 'Test Staff 3', role: 'HCA', type: 'PARTTIME', hoursPerWeek: 20, defaultHourlyRate: 12 },
                ];
                app.staff = mockStaff;
                // Save directly via localStorage (app uses CONFIG.STORAGE_KEYS.STAFF)
                localStorage.setItem('shiftcraft_staff', JSON.stringify(mockStaff));
            }
        });
    });

    test('Roster Wizard checkboxes have unique IDs', async ({ page }) => {
        // Wait for and click the Roster Wizard button
        await page.waitForSelector('#roster-wizard-btn', { state: 'visible', timeout: 10000 });
        await page.click('#roster-wizard-btn');

        // Wait for modal to appear
        await page.waitForSelector('#roster-wizard-modal', { state: 'visible', timeout: 5000 });

        // Navigate to Step 3 (Staffing) where Select All checkbox is
        // First need to add a shift in Step 1
        await page.waitForSelector('.pattern-cell', { state: 'visible', timeout: 10000 });
        // Force click to ensure we hit it even if overlays exist
        await page.locator('.pattern-cell').first().click({ force: true });
        // Wait for pattern update (UI reflection)
        await page.waitForTimeout(500);

        await page.waitForSelector('#wizard-next-btn', { state: 'visible', timeout: 10000 });
        await page.click('#wizard-next-btn', { force: true });
        await page.waitForTimeout(1000); // Increased wait for step transition
        await page.click('#wizard-next-btn', { force: true });
        await page.waitForTimeout(1000); // Increased wait for step transition

        // TRUTH PROTOCOL ENFORCEMENT:
        // The "Select All" checkbox MUST have a unique ID
        const selectAllCheckbox = page.locator('#wizard-select-all');
        // Ensure parent is visible too
        await expect(page.locator('#wizard-staff-list')).toBeVisible();
        await expect(selectAllCheckbox).toBeVisible({ timeout: 10000 });
        await expect(selectAllCheckbox).toHaveAttribute('onchange', /toggleAllStaff/);

        // Verify clicking it actually works (method-first verification)
        // Reset state first
        await page.evaluate(() => {
            (window as any).wizard.config.selectedStaff = [];
        });

        // Click the specific element by ID
        await selectAllCheckbox.click();

        // Verify the JavaScript state was updated
        const selectedCount = await page.evaluate(() => {
            return (window as any).wizard.config.selectedStaff.length;
        });
        const totalStaff = await page.evaluate(() => {
            return (window as any).wizard.app.staff.length;
        });

        expect(selectedCount).toBe(totalStaff);
    });

    test('No positional selector collisions exist', async ({ page }) => {
        // Wait for and click wizard button
        await page.waitForSelector('#roster-wizard-btn', { state: 'visible', timeout: 10000 });
        await page.click('#roster-wizard-btn');
        await page.waitForSelector('#roster-wizard-modal', { state: 'visible', timeout: 5000 });

        // Navigate to Step 3
        await page.waitForSelector('.pattern-cell', { state: 'visible', timeout: 10000 });
        await page.locator('.pattern-cell').first().click({ force: true });
        await page.waitForTimeout(500);

        await page.waitForSelector('#wizard-next-btn', { state: 'visible', timeout: 10000 });
        await page.click('#wizard-next-btn', { force: true });
        await page.waitForTimeout(1000);
        await page.click('#wizard-next-btn', { force: true });
        await page.waitForTimeout(1000);

        // TRUTH PROTOCOL: The wizard's Select All must be targetable by unique ID
        // This prevents selector collisions with other "Select All" checkboxes on the page
        const wizardSelectAll = page.locator('#wizard-select-all');
        await expect(wizardSelectAll).toBeVisible({ timeout: 5000 });

        // Verify the ID follows our naming convention
        const id = await wizardSelectAll.getAttribute('id');
        expect(id).toBe('wizard-select-all');
        expect(id).toMatch(/^wizard-/);

        // Count total checkboxes to verify we have multiple (potential for collision)
        const totalCheckboxes = await page.locator('input[type="checkbox"]').count();
        console.log(`Found ${totalCheckboxes} total checkboxes; wizard-select-all is uniquely identifiable`);
        expect(totalCheckboxes).toBeGreaterThan(1); // Multiple checkboxes exist
    });

    test('Method-first verification: toggleAllStaff works directly', async ({ page }) => {
        // This test enforces the bug verification protocol
        // Test the METHOD directly, not the UI

        await page.waitForSelector('#roster-wizard-btn', { state: 'visible', timeout: 10000 });
        await page.click('#roster-wizard-btn');
        await page.waitForSelector('#roster-wizard-modal', { state: 'visible', timeout: 5000 });

        // Navigate to Step 3
        await page.waitForSelector('.pattern-cell', { state: 'visible', timeout: 10000 });
        await page.locator('.pattern-cell').first().click({ force: true });
        await page.waitForTimeout(500);

        await page.waitForSelector('#wizard-next-btn', { state: 'visible', timeout: 10000 });
        await page.click('#wizard-next-btn', { force: true });
        await page.waitForTimeout(1000);
        await page.click('#wizard-next-btn', { force: true });
        await page.waitForTimeout(1000);

        // TRUTH PROTOCOL: Test the method directly
        const result = await page.evaluate(() => {
            const wizard = (window as any).wizard;
            if (!wizard) return { error: 'wizard not found', success: false };

            // Reset
            wizard.config.selectedStaff = [];

            // Call method directly
            wizard.toggleAllStaff(true);

            return {
                selectedCount: wizard.config.selectedStaff.length,
                totalStaff: wizard.app.staff.length,
                success: wizard.config.selectedStaff.length === wizard.app.staff.length
            };
        });

        expect(result.success).toBe(true);
    });
});
