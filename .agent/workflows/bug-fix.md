---
description: Mandatory bug fix protocol - MUST be invoked before fixing any reported bug
---

# /bug-fix Workflow

**Purpose**: Enforce the Truth Protocol before any code changes for bug fixes.

> ⚠️ **MANDATORY**: When a user reports something is "broken" or "not working", 
> this workflow MUST be followed. Do NOT jump straight to code changes.

---

## Step 1: Document the Bug Report

Update `.agent/BUG_FIX_CHECKPOINT.md` with:

```markdown
## Current Bug Report (Update This Section)

**Date**: [Current date]
**Reported Issue**: [Exact user description]
**Reporter**: [User]
```

---

## Step 2: Method-First Verification
// turbo

Open the browser and test the underlying JavaScript method directly:

1. Navigate to the relevant page
2. Execute JavaScript in the console to test the method:
   ```javascript
   // Example: window.wizard.toggleAllStaff(true)
   // Example: window.app.someMethod()
   ```
3. Record the result: **WORKS** or **FAILS**

**If the method WORKS**: The bug is in UI targeting, NOT code logic. Skip to Step 5.
**If the method FAILS**: Continue to Step 3.

---

## Step 3: Event Binding Check

Verify the DOM element has the correct event handler:

```javascript
const element = document.getElementById('[element-id]');
console.log('Handler:', element?.getAttribute('onchange') || element?.getAttribute('onclick'));
```

**If handler is missing**: The bug is in HTML generation. Fix the render method.
**If handler is present**: Continue to Step 4.

---

## Step 4: Console Error Check

Check browser console for JavaScript errors:
- TypeError
- ReferenceError  
- null/undefined errors
- Unhandled promise rejections

**If errors found**: Fix those specific errors.
**If no errors**: The issue may be state-related.

---

## Step 5: Selector Collision Check

If method works but UI doesn't respond, check for duplicate elements:

```javascript
const elements = document.querySelectorAll('[selector]');
console.log('Total matching elements:', elements.length);
elements.forEach((el, i) => console.log(i, el.id || 'NO ID'));
```

**If duplicates exist without unique IDs**: Add unique IDs. This is a TARGETING bug, not a LOGIC bug.

---

## Step 6: Update Checkpoint with Classification

Update `.agent/BUG_FIX_CHECKPOINT.md` with findings:

| Classification | Meaning |
|----------------|---------|
| **Logic Bug** | Method fails when called directly |
| **Targeting Bug** | Method works, UI can't reach it (needs unique ID) |
| **Render Bug** | Event handler missing from HTML |
| **Runtime Bug** | JavaScript error preventing execution |
| **State Bug** | Works in isolation, fails in context |
| **NOT A BUG** | Code is functional, testing was flawed |

---

## Step 7: Propose and Implement Fix

Only NOW may you modify code. The fix must:

1. Address the **root cause** identified in Steps 2-5
2. Match the **classification** from Step 6
3. Be verified by re-running the method test from Step 2

---

## Step 8: Run Truth Protocol Tests
// turbo

```bash
npx playwright test tests/truth-protocol/
```

All tests must pass before declaring the fix complete.

---

## Step 9: Final Checkpoint Update

Update `.agent/BUG_FIX_CHECKPOINT.md` with:

```markdown
## History

| Date | Issue | Classification | Actual Cause |
|------|-------|----------------|--------------|
| [Date] | [Issue] | [Classification] | [Root cause] |
```

---

## Violations

If this workflow is skipped:
- The fix may address a symptom, not the cause
- Time is wasted on working code
- Trust is broken with the user

**Example Violation**: The "Select All" bug where hours were spent assuming code was broken, when the actual issue was a missing unique ID.
