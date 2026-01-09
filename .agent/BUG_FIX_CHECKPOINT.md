# Bug Fix Checkpoint - 2026-01-08

## Status: RESOLVED

## Issues Addressed
1. **Roster Wizard Over-allocation**
   - **Fix**: Implemented strict deduplication of staff and integer parsing for requirements. Rewrote allocation logic to use a two-pass system ensuring strict adherence to requirements (Natural Pattern -> Gap Fill).
   - **Verification**: Code review confirms `parseInt` and `Set` usage. Two-pass loop stops exactly when `assignedToday < required`.

2. **Compliance Alert Spam**
   - **Fix**: Modified `ComplianceEngine.js` to only flag **positive variance** (Over Contracted) > 2 hours. Negative variance (Under Contracted) is now ignored to prevent noise on new rosters.

3. **Currency Precision Error**
   - **Fix**: Updated `app.js` `updateStats` to use `.toLocaleString(..., { minimumFractionDigits: 2, maximumFractionDigits: 2 })` ensuring correct currency display (e.g., £5,340.14).

4. **Branding / Header Issues**
   - **Fix**: Added robustness to `applyBranding` in `app.js` with comprehensive logging. Fixed `initBranding` save logic. Ensured `topBar.style.display` is correctly toggled based on content presence.

5. **Roster Wizard Navigation ('X' / Back)**
   - **Fix**: Exposed `window.wizard` globally in constructor to support inline HTML `onclick` handlers. Added JS fallback event listener for Close button.

6. **Persistent Global Header (Theme Toggle)**
   - **Fix**: Modified `applyBranding` in `app.js` to ALWAYS display the `global-top-bar` (flex). This ensures the Theme Toggle and header spacing are preserved even if no branding logo/strapline is configured. Added `onerror` handler to hide broken logo images.

7. **Roster Wizard Generation Visibility & Robustness**
   - **Fix**: Updated `RosterWizard.js` `finish()` method to automatically navigate to the roster start date and added strict date validation/error handling (`try-catch`) to prevent "Unexpected Error" crashes when inputs are invalid.

## Verification
- Syntax check of `RosterWizard.js` passed (rebuilt file).
- Tests: `npm test` executed successfully (Exit Code 0).

## Next Steps
- Monitor logs for "[ShiftCraft] Branding saved" to confirm user persistence.
- Deploy and verify end-to-end.
