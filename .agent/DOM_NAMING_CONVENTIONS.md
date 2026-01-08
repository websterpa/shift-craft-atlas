# DOM Element Naming Conventions

**Purpose**: Prevent selector collisions and ensure testability across all UI components.

## The Problem
When multiple UI contexts exist simultaneously (e.g., main page + modal), generic selectors like:
- `document.querySelectorAll('input[type="checkbox"]')[0]`
- `document.querySelector('.btn-primary')`

...can target the **wrong element**, causing:
- Automated tests to fail or pass incorrectly
- Debugging to misidentify working code as "broken"
- User interactions to behave unexpectedly

---

## Naming Conventions

### 1. Modal/Wizard Elements
All interactive elements inside modals or wizards MUST have prefixed IDs:

```
[context]-[component]-[element]
```

**Examples**:
| Context | Element | ID |
|---------|---------|-----|
| Roster Wizard | Select All checkbox | `wizard-select-all` |
| Roster Wizard | Staff list container | `wizard-staff-list` |
| Roster Wizard | Next button | `wizard-next-btn` |
| Staff Modal | Name input | `staff-modal-name` |
| Staff Modal | Submit button | `staff-modal-submit` |
| Confirm Dialog | OK button | `confirm-ok-btn` |
| Confirm Dialog | Cancel button | `confirm-cancel-btn` |

### 2. Main Page Elements
Use descriptive IDs with context prefix:

```
[section]-[element]
```

**Examples**:
| Section | Element | ID |
|---------|---------|-----|
| Roster Table | Select All checkbox | `roster-select-all` |
| Staff Directory | Filter input | `staff-filter-input` |
| Navigation | Settings button | `nav-settings-btn` |

### 3. Dynamic/Generated Elements
For elements created in loops, use data attributes:

```html
<label class="staff-card" data-staff-id="${staff.id}">
```

Then target with:
```javascript
document.querySelector(`[data-staff-id="${id}"]`)
```

---

## Implementation Checklist

When creating new UI components:

- [ ] All form inputs have unique IDs
- [ ] All buttons have unique IDs
- [ ] Checkboxes in overlays have context-prefixed IDs
- [ ] Dynamic elements have data attributes for targeting
- [ ] No elements rely solely on class names for identification

---

## Testing Implications

### For Automated Tests
Always use specific selectors:
```javascript
// ❌ BAD - may hit wrong element
document.querySelectorAll('input[type="checkbox"]')[0]

// ✅ GOOD - guaranteed correct element
document.getElementById('wizard-select-all')
```

### For Browser Debugging
Before blaming code, verify you're targeting the right element:
```javascript
const el = document.getElementById('wizard-select-all');
console.log('Found:', el ? 'YES' : 'NO');
console.log('Handler:', el?.getAttribute('onchange'));
```

---

## Enforcement

This convention is enforced by:
1. **Code Review**: New modals/wizards must follow naming convention
2. **Bug Verification Protocol**: Check for selector collisions before fixing
3. **Test Reliability**: Tests using specific IDs are more reliable than generic selectors
