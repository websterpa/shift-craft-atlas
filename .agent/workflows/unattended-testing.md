---
description: unattended testing
---

// turbo-all

This workflow is designed for high-speed, unattended testing and verification of web applications.

---

## Core Protocol for AI

### 1. Command Auto-Run
All shell commands (`npm test`, `npm run build`, etc.) are marked as `SafeToAutoRun: true`.

### 2. Browser Initialization Script
**MUST be injected at the START of every browser session or after any page navigation.**

```javascript
// === UNATTENDED TESTING PROTOCOL ===
// Override native dialogs
window.alert = () => {};
window.confirm = () => true;
window.prompt = () => '';

// Auto-dismiss custom HTML modals (for Shift Craft (Atlas) and similar apps)
const dismissModals = () => {
  // Click any visible "Confirm", "OK", "Yes", "Proceed", "Accept" buttons
  const keywords = ['confirm', 'ok', 'yes', 'proceed', 'accept', 'accept all', 'continue', 'submit'];
  document.querySelectorAll('button, [role="button"], .btn').forEach(btn => {
    const text = (btn.textContent || btn.innerText || '').toLowerCase().trim();
    if (keywords.some(k => text.includes(k)) && btn.offsetParent !== null) {
      btn.click();
    }
  });
  // Close modals by clicking overlay or close button
  document.querySelectorAll('.modal-overlay:not(.hidden), [data-dismiss="modal"], .close-modal, #confirm-proceed-btn').forEach(el => {
    if (el.id === 'confirm-proceed-btn' || el.classList.contains('close-modal')) {
      el.click();
    }
  });
};

// Run immediately and set up observer for dynamic modals
dismissModals();
const observer = new MutationObserver(dismissModals);
observer.observe(document.body, { childList: true, subtree: true });
// === END PROTOCOL ===
```

### 3. Implicit Approval
The AI proceeds with consecutive logic steps **without waiting for user validation** for:
- File edits within the agreed scope
- Internal state checks
- Screenshot captures
- Navigation between views

### 4. Error Handling
If a browser interaction fails, the AI should:
1. Capture console logs
2. Take a screenshot
3. Retry once with a 500ms delay
4. Report failure if retry fails

---

## Usage

1. User agrees to "Unattended Testing Regime" (explicit consent required).
2. AI injects the Browser Initialization Script **immediately after `open_browser_url`**.
3. AI re-injects the script after any `location.reload()` or navigation to a new page.
4. AI prioritizes throughput and speed for the remainder of the testing phase.

---

## Quick Reference

| Scenario | Action |
|----------|--------|
| Page load | Inject protocol script |
| Page refresh | Re-inject protocol script |
| Modal appears | Auto-clicked by MutationObserver |
| Native `confirm()` | Returns `true` automatically |
| Native `prompt()` | Returns `''` automatically |
| Shell command | `SafeToAutoRun: true` |