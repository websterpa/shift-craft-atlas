const { test, expect } = require('@playwright/test');

test.describe('Shift Craft (Atlas) MVP Core Features', () => {

    test.beforeEach(async ({ page }) => {
        // Go to the app
        await page.goto('http://127.0.0.1:8080/index.html');
        // Clear data to start fresh
        await page.evaluate(() => {
            localStorage.clear();
            location.reload();
        });
    });

    test('Should add a staff member and assign a shift', async ({ page }) => {
        // 1. Add Staff
        await page.click('#nav-staff');
        await page.click('#add-staff-modal-btn');
        await page.fill('#staff-name', 'Automated Tester');
        await page.fill('#staff-role', 'Bot');
        await page.fill('#staff-rate', '15');
        await page.click('#staff-form button[type="submit"]');

        // Verify staff added
        await expect(page.locator('#staff-list-tbody')).toContainText('Automated Tester');

        // 2. Add Shift
        await page.click('#nav-roster');
        await page.click('#add-shift-btn');

        // Wait for modal and population
        await expect(page.locator('#modal-overlay')).toBeVisible();
        await expect(page.locator('#form-staff option')).not.toHaveCount(0); // Ensure options exist

        // Select the staff (using the value of the last added option to be safe)
        const staffId = await page.evaluate(() => window.app.staff[window.app.staff.length - 1].id);
        await page.selectOption('#form-staff', staffId);

        // await page.selectOption('#form-staff', { index: 0 }); // Fallback if ID fails

        await page.selectOption('#form-day', '0'); // Monday
        await page.fill('#form-start', '09:00');
        await page.fill('#form-end', '17:00');
        await page.click('#shift-form button[type="submit"]');

        // Verify shift appeared
        const mondayCell = page.locator('#rota-tbody td').nth(1); // 0 is staff, 1 is Mon
        await expect(mondayCell).toContainText('09:00 - 17:00');

        // 3. Verify Persistence
        await page.reload();
        await expect(page.locator('#rota-tbody td').nth(1)).toContainText('09:00 - 17:00');
    });

    test('Should detect shift clashes (The Truth Protocol)', async ({ page }) => {
        // Setup: Add staff
        await page.click('#nav-staff');
        await page.click('#add-staff-modal-btn');
        await page.fill('#staff-name', 'Clash Dummy');
        await page.fill('#staff-role', 'Dummy');
        await page.fill('#staff-rate', '10');
        await page.click('#staff-form button[type="submit"]');

        // Go to Roster
        await page.click('#nav-roster');

        // Add First Shift (09:00 - 12:00)
        await page.click('#add-shift-btn');
        await expect(page.locator('#modal-overlay')).toBeVisible();
        await page.selectOption('#form-staff', { index: 0 }); // Select the first/only staff
        await page.selectOption('#form-day', '1'); // Tuesday
        await page.fill('#form-start', '09:00');
        await page.fill('#form-end', '12:00');
        await page.click('#shift-form button[type="submit"]');

        // Verify first shift
        const tueCell = page.locator('#rota-tbody td').nth(2); // 0=staff, 1=Mon, 2=Tue
        await expect(tueCell).toContainText('09:00 - 12:00');

        // Add Overlapping Shift (10:00 - 14:00)
        await page.click('#add-shift-btn');
        await expect(page.locator('#modal-overlay')).toBeVisible();
        await page.selectOption('#form-staff', { index: 0 }); // Re-select explicitly
        await page.selectOption('#form-day', '1'); // Tuesday
        await page.fill('#form-start', '10:00');
        await page.fill('#form-end', '14:00');
        await page.click('#shift-form button[type="submit"]');

        // Verify shift was NOT added (count should still be 1 pill)
        await expect(tueCell.locator('.shift-pill')).toHaveCount(1);

        // Verify Toast appears
        await expect(page.getByText('Double-booking detected')).toBeVisible();
    });
});
