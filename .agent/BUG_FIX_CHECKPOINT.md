# Bug Fix Verification Checkpoint

**⚠️ THIS FILE MUST BE UPDATED BEFORE ANY BUG FIX COMMIT ⚠️**

When a bug is reported, the AI assistant MUST complete this checklist BEFORE modifying any code.
This is not optional. This is enforcement of the Truth Protocol.

---

## Current Bug Report (Update This Section)

**Date**: [YYYY-MM-DD]
**Reported Issue**: [Description of what appears broken]
**Reporter**: [User/Test/Observation]

---

## Verification Checklist (All Must Be Completed)

### Step 1: Method-First Test
- [ ] **Tested underlying method directly in browser console**
- Method tested: `[e.g., window.wizard.toggleAllStaff(true)]`
- Result: `[WORKS / FAILS]`
- Console output: `[paste output]`

### Step 2: Event Binding Check
- [ ] **Verified event handler exists on element**
- Element checked: `[e.g., document.getElementById('wizard-select-all')]`
- Handler attribute: `[e.g., onchange="window.wizard.toggleAllStaff(this.checked)"]`
- Handler present: `[YES / NO / N/A]`

### Step 3: Selector Collision Check
- [ ] **Checked for duplicate elements that could cause collision**
- Total matching elements: `[e.g., 16 checkboxes on page]`
- Wizard/Modal element has unique ID: `[YES / NO]`
- Collision risk identified: `[YES / NO]`

### Step 4: Console Error Check
- [ ] **Checked browser console for JavaScript errors**
- Errors found: `[NONE / describe errors]`

---

## Classification

Based on the above, this issue is classified as:

- [ ] **Logic Bug** - The underlying method fails
- [ ] **Targeting Bug** - Method works, but UI can't reach it (selector collision)
- [ ] **Render Bug** - Event handler missing from generated HTML
- [ ] **Runtime Bug** - JavaScript error preventing execution
- [ ] **State Bug** - Works in isolation, fails in context
- [ ] **NOT A BUG** - Code is functional, testing methodology was flawed

---

## Proposed Fix

**Root Cause**: [Describe the actual cause, not the symptom]

**Fix**: [Describe what will actually fix it]

**Files to modify**:
- [ ] `path/to/file.js` - [what change]

**How to verify fix worked**:
- [ ] [Verification step 1]
- [ ] [Verification step 2]

---

## Approval Gate

Before committing any fix, answer:

1. Did the underlying method fail when tested directly?
   - If NO → This may be a targeting bug, not a logic bug
   
2. Is there a unique ID on the element in question?
   - If NO → Add unique ID before changing logic
   
3. Have you run the Truth Protocol test suite?
   - `npx playwright test tests/truth-protocol/`

---

## History

| Date | Issue | Classification | Actual Cause |
|------|-------|----------------|--------------|
| 2026-01-08 | Select All not working | Targeting Bug | Missing unique ID, selector collision |
| | | | |

---

## AI Assistant Acknowledgment

By modifying code to fix a bug, I acknowledge that:
1. I have completed ALL verification steps above
2. I have correctly classified the issue
3. I am fixing the ROOT CAUSE, not just the symptom
4. I understand that guessing = wasted time and broken trust

**Last Verification Completed**: [Date/Time]
**Issue Verified As**: [Classification]
