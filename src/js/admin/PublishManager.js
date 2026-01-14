
/**
 * PublishManager
 * Manages the published status of roster months and provides safety rails (guards) for editing.
 */
class PublishManager {
    constructor(app) {
        this.app = app;
    }

    get months() {
        return this.app.settings.publishedMonths || {};
    }

    setPublished(year, month, isPublished) {
        if (!this.app.settings.publishedMonths) {
            this.app.settings.publishedMonths = {};
        }
        const key = `${year}-${month}`;
        if (isPublished) {
            this.app.settings.publishedMonths[key] = {
                timestamp: new Date().toISOString(),
                user: 'Current User'
            };
            this.app.auditLog.log('PUBLISH', `Published roster for ${key}`);
        } else {
            delete this.app.settings.publishedMonths[key];
            this.app.auditLog.log('UNPUBLISH', `Unpublished roster for ${key}`);
        }
        this.app.saveToStorage();
    }

    isPublished(dateStr) {
        // Parse dateStr (YYYY-MM-DD)
        const d = new Date(dateStr);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        return !!this.months[key];
    }

    isMonthPublished(year, month) {
        const key = `${year}-${month}`;
        return !!this.months[key];
    }

    /**
     * Guard Rail
     * Wraps an action with a check. If published, confirms with user first.
     * @param {string|Date} dateContext - The date being modified
     * @param {Function} action - Helper to execute if safe
     */
    checkGuard(dateContext, action) {
        let dateStr = dateContext;
        if (dateContext instanceof Date) {
            dateStr = dateContext.toISOString().split('T')[0];
        }

        if (this.isPublished(dateStr)) {
            // Simple confirm for MVP. Could be a nice modal.
            if (confirm(`⚠️ SAFETY RAIL\n\nThis month is PUBLISHED. Changes should be made with caution.\n\nDo you want to proceed with this edit?`)) {
                action();
                // Optionally log the override
                this.app.auditLog.log('EDIT_PUBLISHED', `User overrode guard for ${dateStr}`);
            }
        } else {
            action();
        }
    }
}

window.PublishManager = PublishManager;
