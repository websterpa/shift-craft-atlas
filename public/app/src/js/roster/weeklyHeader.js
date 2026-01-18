/**
 * Weekly Header Logic
 * Handles segmented view toggle and small interactions.
 */
export function initWeeklyHeader(app) {
    const weeklyBtn = document.getElementById('view-weekly');
    const monthlyBtn = document.getElementById('view-monthly');

    // Elements to control
    const weeklyContainer = document.getElementById('weekly-view-container');
    const monthlyContainer = document.getElementById('inline-monthly-view');
    const statsGrid = document.querySelector('.stats-grid');

    if (!weeklyBtn || !monthlyBtn) return;

    const updateUI = (mode) => {
        if (mode === 'weekly') {
            weeklyBtn.classList.add('is-active');
            weeklyBtn.setAttribute('aria-selected', 'true');
            monthlyBtn.classList.remove('is-active');
            monthlyBtn.setAttribute('aria-selected', 'false');

            if (weeklyContainer) weeklyContainer.style.display = 'block';
            if (monthlyContainer) monthlyContainer.style.display = 'none';
            if (statsGrid) statsGrid.style.display = 'grid';

        } else {
            monthlyBtn.classList.add('is-active');
            monthlyBtn.setAttribute('aria-selected', 'true');
            weeklyBtn.classList.remove('is-active');
            weeklyBtn.setAttribute('aria-selected', 'false');

            if (weeklyContainer) weeklyContainer.style.display = 'none';
            if (monthlyContainer) monthlyContainer.style.display = 'block';
            if (statsGrid) statsGrid.style.display = 'none'; // Hide stats in monthly mode as it has its own

            // Trigger app-level monthly initialization if available
            if (app && typeof app.initInlineMonthlyView === 'function') {
                app.initInlineMonthlyView();
            }
        }
    };

    weeklyBtn.addEventListener('click', () => updateUI('weekly'));
    monthlyBtn.addEventListener('click', () => updateUI('monthly'));

    // "New Roster" link - acts as shortcut to Clear or Wizard
    const newLink = document.getElementById('link-new-roster');
    if (newLink) {
        newLink.addEventListener('click', (e) => {
            e.preventDefault();
            // Trigger wizard if available, or clear
            const wizardBtn = document.getElementById('roster-wizard-btn');
            if (wizardBtn) wizardBtn.click();
        });
    }
}

// Attach to window for legacy app.js integration if needed
window.initWeeklyHeader = initWeeklyHeader;
