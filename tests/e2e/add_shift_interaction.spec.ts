
import { test, expect } from '@playwright/test';

test('Add Shift Modal - Shift Type Preset Interaction', async ({ page }) => {
    // 1. Load App
    await page.goto('/');

    // 2. Open Add Shift Modal
    // Use desktop button by default
    await page.locator('#add-shift-btn').click();

    const modal = page.locator('#modal-overlay');
    await expect(modal).toBeVisible();

    // 3. Verify Dropdown Exists
    const typeSelect = page.locator('#form-shift-type');
    await expect(typeSelect).toBeVisible();

    // 4. Select "Early (8h)" -> value "E"
    await typeSelect.selectOption('E');

    // 5. Verify Times Updated (Default Early is 06:00 - 14:00)
    await expect(page.locator('#form-start')).toHaveValue('06:00');
    await expect(page.locator('#form-end')).toHaveValue('14:00');

    // 6. Select "Night (12h)" -> value "N12"
    await typeSelect.selectOption('N12');
    // Default Night 12h is 19:00 - 07:00
    await expect(page.locator('#form-start')).toHaveValue('19:00');
    await expect(page.locator('#form-end')).toHaveValue('07:00');
});
