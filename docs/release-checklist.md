# Release Checklist

Ensure the following steps are verified before any release of the Roster Module.

## Verification
- [ ] **Run Unit Tests**: `npm run test:unit`. All scenarios (A, B, C, Fairness) must pass.
- [ ] **Run UI Tests**: `npx playwright test`. Check Forced Assignment visibility.
- [ ] **Manual Sanity Check**:
    - Open Roster Wizard.
    - Generate a roster with high requirements (e.g. 1 per day for 1 staff with some pattern).
    - Verify "F" badges appear on gap-filled shifts.
    - Verify Compliance Gate appears if existing shifts interfere (e.g. Night worked previous day).

## Compliance & Saftey
- [ ] Confirm no "Night -> Early" transitions are generated (0 hours rest).
- [ ] Confirm "Insufficient Rest" (<11h) shortfalls are logged if coverage fails.
- [ ] Verify "Forced" summary count matches visible markers.

## Code Quality
- [ ] No forbidden patterns (hardcoded secrets, console logs in critical loops).
- [ ] No regression in rendering performance.

## Regression Guard
- [ ] Ensure `tests/fixtures/roster_wizard/scenarios.json` represents the current business rules.
- [ ] CI pipeline is green.
