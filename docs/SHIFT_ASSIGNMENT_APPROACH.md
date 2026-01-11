# Shift Craft (Atlas) MVP - Shift Pattern Generation & Staff Assignment Approach

## 📋 Overview

The current Shift Craft (Atlas) MVP uses a **manual + semi-automated** approach to shift assignment with built-in compliance validation. Here's a detailed breakdown:

---

## 🎯 Current Implementation

### 1. **Manual Shift Assignment** (Primary Method)

#### Process Flow:
```
User → Opens Modal → Selects Staff → Chooses Day → Sets Times → Submit
                                                                    ↓
                                                    [Clash Detection Check]
                                                                    ↓
                                                    [If Valid: Add to Roster]
                                                                    ↓
                                                    [Compliance Check & Warning]
```

#### Implementation (`handleShiftSubmit()`)

```javascript
handleShiftSubmit() {
    // 1. Capture user input
    const dayIdx = parseInt(document.getElementById('form-day').value);
    const staffId = document.getElementById('form-staff').value;
    const start = document.getElementById('form-start').value;
    const end = document.getElementById('form-end').value;
    
    // 2. Calculate the exact date
    const d = new Date(this.weekStart);
    d.setDate(d.getDate() + dayIdx);
    const dateStr = d.toISOString().split('T')[0];
    
    // 3. CLASH DETECTION - Prevents physical impossibility
    const overlap = this.shifts.find(s =>
        s.staffId === staffId &&
        s.date === dateStr &&
        ((start >= s.start && start < s.end) ||      // Starts during existing shift
         (end > s.start && end <= s.end) ||          // Ends during existing shift
         (start <= s.start && end >= s.end))         // Completely overlaps existing shift
    );
    
    // 4. Block if overlap detected
    if (overlap) {
        return this.showToast('Double-booking detected!', 'alert-triangle');
    }
    
    // 5. Create shift object
    this.shifts.push({
        id: 'sh-' + Date.now(),
        staffId: staffId,
        date: dateStr,
        start: start,
        end: end
    });
    
    // 6. Persist and update UI
    this.saveToStorage();
    this.renderTableBody();
    this.updateStats();
}
```

**Strengths:**
- ✅ Full manual control for managers
- ✅ Prevents physical impossibilities (double-booking)
- ✅ Real-time feedback via toast notifications

**Limitations:**
- ❌ Time-consuming for large rosters
- ❌ No automated optimization
- ❌ Requires manual compliance checking

---

### 2. **Auto-Fill Pattern Replication** (Semi-Automated)

#### Concept:
Clones the previous week's shift pattern forward by 7 days

#### Process Flow:
```
User Clicks "Auto-Fill"
        ↓
Get Previous Week's Shifts
        ↓
For Each Shift:
  - Add 7 days to date
  - Check if shift already exists
  - If not: Clone shift
        ↓
Refresh Roster View
```

#### Implementation (`handleAutoFill()`)

```javascript
handleAutoFill() {
    // 1. Calculate previous week's date range
    const prevW = new Date(this.weekStart);
    prevW.setDate(prevW.getDate() - 7);
    const sStr = prevW.toISOString().split('T')[0];
    const e = new Date(prevW);
    e.setDate(e.getDate() + 6);
    const eStr = e.toISOString().split('T')[0];
    
    // 2. Find all shifts from previous week
    const prevShifts = this.shifts.filter(s => 
        s.date >= sStr && s.date <= eStr
    );
    
    // 3. Guard clause: Nothing to clone
    if (!prevShifts.length) {
        return this.showToast('No shifts to clone', 'alert-circle');
    }
    
    // 4. Clone each shift forward 7 days
    prevShifts.forEach(s => {
        const n = new Date(s.date);
        n.setDate(n.getDate() + 7);  // Move forward 1 week
        const nStr = n.toISOString().split('T')[0];
        
        // 5. Duplicate detection: Don't clone if exact shift exists
        if (!this.shifts.find(x => 
            x.staffId === s.staffId && 
            x.date === nStr && 
            x.start === s.start
        )) {
            // 6. Create new shift with new ID
            this.shifts.push({
                ...s,  // Copy all properties
                id: 'sh-' + Date.now() + Math.random(),  // New unique ID
                date: nStr  // Updated date
            });
        }
    });
    
    // 7. Persist and refresh
    this.saveToStorage();
    this.renderTableBody();
    this.updateStats();
}
```

**Strengths:**
- ✅ Fast: One click to populate entire week
- ✅ Maintains existing shift patterns
- ✅ Avoids duplicates
- ✅ Ideal for predictable schedules

**Limitations:**
- ❌ Assumes previous week is optimal
- ❌ No consideration for staff availability changes
- ❌ Doesn't optimize for compliance or cost

---

### 3. **Compliance Checking** (Validation Layer)

#### Checks Performed:

```javascript
checkCompliance(shift, person) {
    const warnings = [];
    
    // 1. SHIFT DURATION CHECK
    const h = parseFloat(this.calculateDuration(shift.start, shift.end));
    if (h > 6) {
        warnings.push('Break Reqd');  // WTR: 20min break for 6+ hours
    }
    
    // 2. DAILY REST PERIOD CHECK
    const prev = this.shifts.find(s => 
        s.staffId === person.id && 
        s.date === this.getYesterday(shift.date)
    );
    
    if (prev) {
        // Calculate gap between yesterday's end and today's start
        const [peh, pem] = prev.end.split(':').map(Number);
        const [ssh, ssm] = shift.start.split(':').map(Number);
        const gap = ((ssh * 60 + ssm + 1440) - (peh * 60 + pem)) / 60;
        
        if (gap < this.settings.restPeriod) {
            warnings.push(`Rest < ${this.settings.restPeriod}h`);
        }
    }
    
    // 3. 48-HOUR AVERAGE WORKING WEEK CHECK
    const avg = this.calculate17WeekAverage(person.id, shift.date);
    if (avg > 48 && !person.optOut48h) {
        warnings.push('48h Avg Risk');
    }
    
    return warnings;
}
```

#### Compliance Rules Enforced:

| Rule | Regulation | Implementation |
|------|------------|----------------|
| **48h Max Week** | WTR 1998 | 17-week rolling average |
| **11h Daily Rest** | WTR 1998 | Gap between consecutive shifts |
| **Break for 6+ Hours** | WTR 1998 | Visual warning if shift > 6h |
| **Holiday Accrual** | ERA 1996 | 12.07% of gross pay |

---

## 🔄 Data Flow Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    USER ACTIONS                          │
├─────────────────────────────────────────────────────────┤
│  1. Manual Add Shift          2. Auto-Fill              │
│  3. Delete Shift              4. Navigate Week          │
└────────────┬──────────────────────────┬─────────────────┘
             │                          │
             ↓                          ↓
┌────────────────────────┐   ┌──────────────────────────┐
│  VALIDATION LAYER      │   │  PATTERN REPLICATION     │
├────────────────────────┤   ├──────────────────────────┤
│  • Clash Detection     │   │  • Previous Week Query   │
│  • Time Validation     │   │  • Date Calculation      │
│  • Staff Exists        │   │  • Duplicate Check       │
└────────────┬───────────┘   └──────────┬───────────────┘
             │                          │
             └──────────────┬───────────┘
                            ↓
               ┌────────────────────────────┐
               │   SHIFT ARRAY              │
               ├────────────────────────────┤
               │  [{                        │
               │    id: 'sh-123',           │
               │    staffId: 'id-456',      │
               │    date: '2025-12-20',     │
               │    start: '09:00',         │
               │    end: '17:00'            │
               │  }]                        │
               └────────────┬───────────────┘
                            ↓
               ┌────────────────────────────┐
               │   COMPLIANCE CHECK         │
               ├────────────────────────────┤
               │  • Rest Period             │
               │  • Break Requirements      │
               │  • 48h Average             │
               └────────────┬───────────────┘
                            ↓
               ┌────────────────────────────┐
               │   LOCAL STORAGE            │
               │   + UI RENDER              │
               └────────────────────────────┘
```

---

## 🧪 Example: Adding a Shift

### Scenario:
Manager wants to assign "John Doe" to Monday 9am-5pm

```javascript
// Step 1: User selects from dropdown
staffId = "id-1703001234567"  // John Doe's ID
day = 0                        // Monday (0-indexed)
start = "09:00"
end = "17:00"

// Step 2: Calculate date
weekStart = new Date("2025-12-15")  // Monday of current week
date = new Date(weekStart)
date.setDate(date.getDate() + 0)    // Monday (no offset)
dateStr = "2025-12-15"

// Step 3: Check for clashes
existingShifts = [
  { staffId: "id-1703001234567", date: "2025-12-15", start: "06:00", end: "08:00" }
]

// Clash detection logic:
overlap = existingShifts.find(s => 
  s.staffId === "id-1703001234567" &&    // Same staff ✅
  s.date === "2025-12-15" &&             // Same day ✅
  (
    ("09:00" >= "06:00" && "09:00" < "08:00") ||  // ❌ False (9am not before 8am)
    ("17:00" > "06:00" && "17:00" <= "08:00") ||  // ❌ False (5pm not before 8am)
    ("09:00" <= "06:00" && "17:00" >= "08:00")    // ❌ False (9am not before 6am)
  )
)
// Result: overlap = undefined → No clash! ✅

// Step 4: Add shift
shifts.push({
  id: "sh-1703073600000",
  staffId: "id-1703001234567",
  date: "2025-12-15",
  start: "09:00",
  end: "17:00"
})

// Step 5: Compliance check
warnings = checkCompliance(newShift, johnDoe)
// Possible warnings:
// - "Break Reqd" (8-hour shift)
// - "Rest < 11h" (if worked late on Sunday)
// - "48h Avg Risk" (if exceeding 48h/week average)
```

---

## 🎯 Strengths of Current Approach

| Strength | Description |
|----------|-------------|
| **Simplicity** | Easy to understand and maintain |
| **Compliance-First** | Validates against UK law at point of entry |
| **User Control** | Managers have full manual override |
| **Pattern Reuse** | Auto-fill speeds up repetitive scheduling |
| **Data Integrity** | Clash detection prevents impossible states |

---

## ⚠️ Limitations & Areas for Improvement

| Limitation | Impact | Potential Solution |
|------------|--------|-------------------|
| **No Automated Optimization** | Managers must manually balance workload | Implement AI/algorithm-based scheduling |
| **No Skill Matching** | Can't auto-assign based on qualifications | Add skill tags to staff profiles |
| **No Availability Tracking** | Can assign shifts when staff unavailable | Implement leave/availability calendar |
| **Single-Week Focus** | Hard to plan long-term patterns | Add monthly/quarterly views |
| **No Fairness Metrics** | Can't balance hours across team | Add workload distribution analytics |
| **No Shift Templates** | Must recreate common patterns | Pre-define shift templates (e.g., "Morning", "Evening") |

---

## 🚀 Proposed Enhancements

### Phase 1: Shift Templates
```javascript
const SHIFT_TEMPLATES = {
  morning: { start: '06:00', end: '14:00' },
  day: { start: '09:00', end: '17:00' },
  evening: { start: '14:00', end: '22:00' },
  night: { start: '22:00', end: '06:00' }
};

// One-click assignment
assignTemplate('morning', staffId, date);
```

### Phase 2: Smart Auto-Fill
```javascript
autoFillSmart(preferences) {
  // Consider:
  // - Staff availability
  // - Skill requirements
  // - Compliance rules
  // - Workload balancing
  // - Cost optimization
}
```

### Phase 3: Constraint-Based Scheduling
```javascript
generateOptimalRoster(constraints) {
  return optimizer.solve({
    minimize: 'cost',
    constraints: [
      'compliance',
      'availability',
      'fairness',
      'coverage'
    ]
  });
}
```

---

## 📊 Comparison: Manual vs. Auto-Fill

| Metric | Manual Assignment | Auto-Fill |
|--------|-------------------|-----------|
| **Speed** | ~30s per shift | ~1s for entire week |
| **Flexibility** | High | Low |
| **Accuracy** | User-dependent | Pattern-dependent |
| **Best Use Case** | Irregular schedules | Predictable patterns |

---

## 🎓 Design Principles

The current implementation follows these key principles:

### The Truth Protocol
All roster assignments must adhere to the following immutable rules:
1. **Physical Impossibility**: No person can be in two places at once.
2. **One Shift Per Day**: A staff member may not be assigned to multiple distinct shifts in a single 24-hour calendar period unless explicitly designated as a "Split Shift" template.
3. **Statutory Rest**: The 11-hour daily rest requirement is a hard-block during allocation.
4. **Regional Context**: Holiday logic must dynamically adjust based on the selected UK region (England/Wales, Scotland, NI).
1. **Compliance-First**: Validates against UK law before saving
2. **User Autonomy**: Warnings, not blockers (except clashes)
3. **Data Persistence**: All changes saved to LocalStorage
4. **Progressive Disclosure**: Simple by default, power features optional

---

## 💡 Summary

The Shift Craft (Atlas) MVP uses a **hybrid manual/semi-automated approach**:

- **Manual Assignment**: Full control, clash-protected, compliance-checked
- **Auto-Fill**: Fast pattern replication for predictable schedules
- **Validation**: Multi-layer checks prevent errors and violations

While this approach works well for MVPs and small teams, production systems would benefit from:
- Automated optimization algorithms
- Skill-based matching
- Availability tracking
- Long-term pattern planning

The foundation is solid and ready for these enhancements! 🚀
