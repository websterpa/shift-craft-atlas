
import { test, expect } from '@playwright/test';

test('Navigation to Help & Features View', async ({ page }) => {
    // 1. Load App
    await page.goto('/');

    // 2. Click Help Link in Sidebar
    const helpLink = page.locator('#nav-help');
    await expect(helpLink).toBeVisible();
    await helpLink.click();

    // 3. Verify Help View is Visible
    const helpView = page.locator('#view-help');
    await expect(helpView).toBeVisible();
    await expect(helpView).toHaveClass(/active|app-view/); // Check visibility class logic if applicable, or just visible

    // 4. Verify Content
    const title = helpView.locator('h1');
    await expect(title).toHaveText('User Instructions & Features Help');

    // 5. Verify a card exists (e.g. Core Rostering)
    const card = helpView.locator('h3', { hasText: 'Core Rostering' });
    await expect(card).toBeVisible();

    // 6. Verify Advanced Patterns card exists
    const patternsCard = helpView.locator('h3', { hasText: 'Roster Wizard & Patterns' });
    await expect(patternsCard).toBeVisible();

    // 7. Verify Staff Directory card exists
    const staffCard = helpView.locator('h3', { hasText: 'Staff Directory' });
    await expect(staffCard).toBeVisible();
});
