# Test Plan & Strategy

## 1. Unit Testing
We use Node.js built-in test runner for unit testing core logic.

### Scope
- **Roster Logic**: Engine, Allocation, Pattern Detection.
- **Services**: Absence, Shift Features.
- **Store/Repositories**: AbsenceStore, LocalRepository (Mocked).

### Running Tests
```bash
npm run test:unit
```
*Current coverage: RosterLogic, RosterEngine, AbsenceService, AbsenceStore, ShiftFeatures, Repository.*

## 2. Integration & End-to-End Testing
We use Playwright for browser-based testing.

### Scope
- **Compliance Engine**: Verifies legal rules in a browser environment.
- **Parsers**: DocumentParser, ShiftDataNormalizer (uses browser APIs like File/Canvas).
- **UI Components**: AIPatternUI, Wizard.

### Running Tests
```bash
npm test
```
*Note: Requires the development server to be running.*

## 3. Manual Verification Checklist
### Marketing Site (Next.js)
- [ ] Visit `/` (Homepage) - Check Hero & Nav.
- [ ] Visit `/pricing` - Check Plans load.
- [ ] Visit `/industries` - Check Vertical links.

### Roster App (Vanilla JS)
- [ ] Visit `/app` - Should redirect/load App Shell.
- [ ] Visit `/app/index.html` - Direct access.
- [ ] Check Login/Auth flow (Supabase).
- [ ] Verify "Early Access" Gate.
- [ ] Create a Shift.
- [ ] Add an Absence.

## 4. Regression Shield
The following bugs were fixed and covered by tests:
- **AbsenceStore Async Logic**: Tests updated to handle async storage.
- **Repository Paths**: Tests updated to reflect `public/app` structure.
- **Roster Engine Rules**: Logic verified for rest periods and night shifts.
