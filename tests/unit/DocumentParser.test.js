import { test, expect } from '@playwright/test';

test.describe('DocumentParser Unit Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://127.0.0.1:8080');
        await page.waitForLoadState('networkidle');
    });

    test('DocumentParser class should be initialized', async ({ page }) => {
        const exists = await page.evaluate(() => typeof window.DocumentParser !== 'undefined');
        expect(exists).toBeTruthy();
    });

    test('Vendor libraries should be loaded globally', async ({ page }) => {
        const result = await page.evaluate(() => {
            return {
                xlsx: typeof window.XLSX !== 'undefined',
                pdf: typeof window.pdfjsLib !== 'undefined',
                ocr: typeof window.Tesseract !== 'undefined',
                pdfWorker: typeof window.pdfjsLib?.GlobalWorkerOptions?.workerSrc !== 'undefined'
            };
        });

        // Detailed error messages for debugging
        expect(result.xlsx, 'SheetJS (window.XLSX) not found').toBeTruthy();
        expect(result.pdf, 'PDF.js (window.pdfjsLib) not found. Check version compatibility.').toBeTruthy();
        expect(result.ocr, 'Tesseract (window.Tesseract) not found').toBeTruthy();
    });

    test('should identify file types correctly', async ({ page }) => {
        const result = await page.evaluate(() => {
            const parser = new window.DocumentParser();
            const csvFile = new File(['header,row\n1,2'], 'test.csv', { type: 'text/csv' });
            return parser.detectType(csvFile);
        });
        expect(result).toBe('csv');
    });
});
