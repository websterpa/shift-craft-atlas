import { test, expect } from '@playwright/test';

test.describe('My Rosters - Save Functionality', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('http://127.0.0.1:8080');
        await expect(page.locator('#view-roster')).toBeVisible();
    });

    test('Should save current roster from My Rosters view', async ({ page }) => {

        // 1. Navigate to My Rosters
        const navLink = page.locator('#nav-my-rosters');
        await navLink.click();

        await expect(page.locator('#view-my-rosters')).toBeVisible();

        // 2. Click Save Current Roster
        const saveBtn = page.locator('#save-roster-to-library-btn');
        await expect(saveBtn).toBeVisible();
        await saveBtn.click();

        // 3. Handle Confirmation Modal with correct IDs
        const modal = page.locator('#confirm-modal-overlay');
        await expect(modal).toBeVisible();

        const input = page.locator('#confirm-modal-text');
        await expect(input).toBeVisible();
        await input.fill('E2E Test Roster');

        const confirmBtn = page.locator('#confirm-proceed-btn');
        await confirmBtn.click();

        // 4. Verify Toast (Optional, better to check grid)
        // await expect(page.locator('.toast')).toContainText('Saved');

        // 5. Verify it appears in the grid
        await expect(page.locator('#my-rosters-grid')).toContainText('E2E Test Roster');

        // Verify badge count increased
        await expect(page.locator('#saved-rosters-count')).toContainText('Saved');
    });
});
