import { test, expect } from '@playwright/test';

test.describe('AIPatternUI Unit Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://127.0.0.1:8080');
        await page.waitForLoadState('networkidle');
    });

    test('AI Import Button should exist and open modal', async ({ page }) => {
        const btn = page.locator('#ai-import-btn');
        await expect(btn).toBeVisible();

        await btn.click();
        const modal = page.locator('#ai-import-modal');
        await expect(modal).toHaveClass(/active/);
    });

    test('Step navigation should work correctly', async ({ page }) => {
        await page.locator('#ai-import-btn').click();

        // Initially on upload step
        await expect(page.locator('#ai-step-upload')).toBeVisible();
        await expect(page.locator('#ai-step-processing')).not.toBeVisible();
        await expect(page.locator('#ai-step-results')).not.toBeVisible();

        // Simulate file upload trigger (processing step)
        await page.evaluate(() => {
            window.app.aiUI.showStep('processing');
        });
        await expect(page.locator('#ai-step-upload')).not.toBeVisible();
        await expect(page.locator('#ai-step-processing')).toBeVisible();
    });

    test('Should close modal on X click', async ({ page }) => {
        await page.locator('#ai-import-btn').click();
        await page.locator('#close-ai-import').click();
        await expect(page.locator('#ai-import-modal')).not.toHaveClass(/active/);
    });
});
