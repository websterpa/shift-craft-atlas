---
description: Bug Verification Protocol - Verify a bug exists before attempting to fix it
---

# Bug Verification Protocol

**Purpose**: Prevent wasted effort and incorrect "fixes" caused by misdiagnosed bugs.

## When to Use
Execute this protocol BEFORE making any code changes when:
- A feature is reported as "not working"
- A user says "X is broken"
- You observe unexpected UI behavior
- A test appears to fail

---

## Step 1: Method-First Verification
Test the underlying JavaScript method directly, bypassing the UI:

```javascript
// Example for Roster Wizard staff selection:
window.wizard.toggleAllStaff(true);
console.log(window.wizard.config.selectedStaff);
```

**If the method works**: The bug is in **UI binding/targeting**, not the core logic.
**If the method fails**: The bug is in the **core implementation**.

---

## Step 2: Event Binding Check
Verify the DOM element has the correct event handler:

```javascript
const element = document.getElementById('wizard-select-all');
console.log('onchange:', element.getAttribute('onchange'));
console.log('onclick:', element.getAttribute('onclick'));
```

**If handler is correct**: The bug is in **element targeting** (selector collision).
**If handler is missing/wrong**: The bug is in **HTML generation/rendering**.

---

## Step 3: Selector Collision Check
Check if there are duplicate/similar elements that could cause targeting issues:

```javascript
const allMatchingElements = document.querySelectorAll('input[type="checkbox"]');
console.log('Total checkboxes on page:', allMatchingElements.length);
allMatchingElements.forEach((el, i) => {
  console.log(`[${i}]`, el.id || 'NO ID', el.getAttribute('onchange'));
});
```

**If duplicates exist without unique IDs**: This is a **testability/naming bug**, not a logic bug.

---

## Step 4: Console Error Check
Check for JavaScript errors that might be silently failing:

```javascript
// In browser DevTools, check for red error messages
// Look for: TypeError, ReferenceError, null/undefined errors
```

---

## Step 5: Classification
Based on findings, classify the issue:

| Finding | Classification | Action |
|---------|----------------|--------|
| Method works, UI doesn't | **Targeting Bug** | Add unique IDs, fix selectors |
| Method fails | **Logic Bug** | Fix the implementation |
| Event handler missing | **Render Bug** | Fix HTML generation |
| Console errors | **Runtime Bug** | Fix the error |
| Works in isolation, fails in context | **State Bug** | Check initialization order |

---

## Step 6: Document Before Fixing
Before making any changes, document:

1. **Symptom**: What appeared broken
2. **Actual Cause**: What the investigation revealed
3. **Classification**: Which category from Step 5
4. **Fix**: What actually needs to change

---

## Example: The "Select All" False Positive

**Symptom**: "Select All checkbox not working in Roster Wizard"

**Investigation**:
1. ✅ `window.wizard.toggleAllStaff(true)` works perfectly - selected all 14 staff
2. ✅ `onchange="window.wizard.toggleAllStaff(this.checked)"` attribute present
3. ⚠️ 16+ checkboxes on page, wizard's "Select All" had NO unique ID
4. ❌ Generic selector `querySelectorAll('input')[0]` hit background checkbox

**Classification**: **Targeting Bug** - DOM element collision

**Fix**: Add `id="wizard-select-all"` to the wizard's checkbox

**Lesson**: The code was never broken. The testing methodology was flawed.
