/**
 * Shift Craft - Global Error Boundary
 * Catch unhandled exceptions to prevent White Screen of Death
 */
class ErrorBoundary {
    static init(app) {
        window.onerror = (msg, url, line, col, error) => {
            console.error('[Global Error]', msg, error);

            // Try to show a toast if the app reference is available
            if (app && typeof app.showToast === 'function') {
                app.showToast('An unexpected error occurred. Check console for details.', 'alert-triangle');
            }

            // Return false to let default handler run (logging to console)
            return false;
        };

        window.onunhandledrejection = (event) => {
            console.error('[Unhandled Rejection]', event.reason);
            if (app && typeof app.showToast === 'function') {
                // Don't spam toasts for network cancellations, etc, unless critical
                // app.showToast('Async operation failed', 'alert-circle');
            }
        };

        console.log('[ErrorBoundary] Initialized');
    }
}

if (typeof window !== 'undefined') {
    window.ErrorBoundary = ErrorBoundary;
}
