
import { test, expect } from '@playwright/test';

test.describe('Forced Assignment Visibility', () => {

    test('should display forced markers and stats', async ({ page }) => {
        // 1. Load App
        await page.goto('/');

        // 2. Inject Roster Data with Forced Shifts
        await page.evaluate(() => {
            const shifts = [
                {
                    id: 'forced-1',
                    staffId: 'staff-1',
                    date: '2024-01-01',
                    start: '06:00',
                    end: '14:00',
                    shiftType: 'E',
                    isForced: true,
                    forcedReason: 'Gap Fill'
                },
                {
                    id: 'natural-1',
                    staffId: 'staff-1',
                    date: '2024-01-02',
                    start: '06:00',
                    end: '14:00',
                    shiftType: 'E',
                    isForced: false
                }
            ];

            // Mock Staff
            window.ShiftCraftApp.staff = [
                { id: 'staff-1', name: 'Test Staff', role: 'Tester' }
            ];
            window.ShiftCraftApp.shifts = shifts;

            // Mock Stats View elements if needed (usually handled by MonthlyRosterView)
            // trigger open
            window.monthlyView = new MonthlyRosterView(window.ShiftCraftApp);
        });

        // 3. Open Monthly View
        // We can call open() directly
        await page.evaluate(() => {
            window.monthlyView.open('staff-1');
        });

        // 4. Verify Forced Marker
        const forcedPill = page.locator('.monthly-shift-pill.forced-shift-pill');
        await expect(forcedPill).toBeVisible();
        await expect(forcedPill).toContainText('(F)');
        await expect(forcedPill).toHaveAttribute('title', /Forced Assignment: Gap Fill/);

        // 5. Verify Natural Marker (Should NOT have forced style)
        // There should be 2 pills total
        const pills = page.locator('.monthly-shift-pill');
        await expect(pills).toHaveCount(2);

        // 6. Verify Stats
        const forcedStat = page.locator('#monthly-forced-shifts');
        await expect(forcedStat).toBeVisible();
        await expect(forcedStat).toHaveText('1');
        await expect(forcedStat).toHaveCSS('color', 'rgb(245, 158, 11)'); // #f59e0b
    });
});
