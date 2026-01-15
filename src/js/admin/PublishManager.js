
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
     * @returns {Promise<boolean>} - True if action executed
     */
    async checkGuard(dateContext, action) {
        let dateStr = dateContext;
        if (dateContext instanceof Date) {
            dateStr = dateContext.toISOString().split('T')[0];
        }

        if (this.isPublished(dateStr)) {
            // Prompt 10: Strict Override Requirement
            // We use a simple prompt for the MVP as requested, but this could be a modal
            const reason = prompt(`⚠️ LOCKED MONTH\n\nThis roster is PUBLISHED.\nYou must provide a reason to override this lock:`);

            if (reason && reason.trim().length > 0) {
                // Log the override
                this.app.auditLog.log('OVERRIDE_PUBLISH', `User overrode lock for ${dateStr}`, 'User', {
                    entityType: 'publish_lock',
                    entityId: dateStr,
                    reason: reason.trim()
                });

                // Execute Action
                await action();
                return true;
            } else {
                // Block Action
                this.app.showToast('Action cancelled: Override reason required.', 'slash');
                return false;
            }
        } else {
            await action();
            return true;
        }
    }
}

window.PublishManager = PublishManager;
