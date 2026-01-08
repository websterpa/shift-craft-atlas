# Protected Features Registry
This file tracks features that have been verified as "Production Quality" and must NOT be regressed during future development.

## Protection Protocol
1. **Explain First**: Any edit to a file associated with a protected feature must be preceded by an explanation of how the feature's integrity will be maintained.
2. **Automated Verification**: Before declaring "Done," a browser subagent or test suite must verify the feature is still operational.
3. **Explicit Approval**: Changes to core initialization, event listeners, or global state dependency of these features require explicit USER approval.

---

## 1. Roster Wizard (Verified: 2026-01-06)
- **Status**: Stable / 'R' Symbol Compliant
- **Files**: `src/js/roster/RosterWizard.js`, `src/js/app.js` (init logic)
- **Critical Path**: Button Click -> Step 1 (Design) -> Step 2 (Resources) -> Step 4 (Generate).

## 2. Night Shift Persistence (Verified: 2026-01-04)
- **Status**: Stable
- **Files**: `src/js/app.js` (Shift rendering), `tests/e2e/night-persistence.spec.ts`
- **Critical Path**: Saving 12h/8h nights -> Reloading page -> Correct count display.

## 3. Theme Customization (Verified: 2026-01-05)
- **Status**: Stable
- **Files**: `src/css/components.css`, `src/js/app.js` (applyCustomTheme)
- **Critical Path**: Theme Selection -> CSS Variable Update -> UI reflecting correct palette.
