# Shift Pattern Library & Import System Design

## 📚 Overview

This document outlines a system for **ingesting pre-defined shift patterns** and leveraging **globally accepted work schedules** in Shift Craft (Atlas).

---

## 🌍 Common Global Shift Patterns

### 1. **Continental Shift Pattern** (24/7 Operations)
**Used by**: Emergency services, hospitals, manufacturing

```
Pattern: 2 Mornings → 2 Afternoons → 2 Nights → 4 Days Off
Cycle: 8 days
Coverage: 24/7 with 4 teams
```

**Example Schedule:**
```
Week 1: MM AA NN XXXX
Week 2: MM AA NN XXXX
```

### 2. **DuPont Schedule** (12-Hour Shifts)
**Used by**: Chemical plants, refineries, utilities

```
Pattern: 4 Days ON → 3 Days OFF → 3 Nights ON → 1 Day OFF → 
         3 Days ON → 3 Days OFF → 4 Nights ON → 7 Days OFF
Cycle: 28 days
Hours: ~42 hours/week average
```

### 3. **4-On-4-Off** (LULU Pattern)
**Used by**: Fire departments, police, security

```
Pattern: 4 Days ON → 4 Days OFF
Cycle: 8 days
Teams: 2
```

### 4. **Pitman Schedule** (2-2-3)
**Used by**: Police, corrections, call centers

```
Pattern: 2 Days ON → 2 Days OFF → 3 Days ON → 2 Days OFF → 
         2 Days ON → 3 Days OFF
Cycle: 14 days (2 weeks)
```

### 5. **9/80 Work Schedule** (Office/Professional)
**Used by**: Tech companies, government agencies

```
Pattern: 9 hours Mon-Thu Week 1 → 8 hours Friday → 
         9 hours Mon-Thu Week 2 → Friday OFF
Cycle: 2 weeks
Hours: 80 hours over 9 working days
```

### 6. **NHS Banding Patterns** (UK Healthcare)
**Used by**: NHS hospitals, care homes

```
Pattern: Variable based on banding (1A, 1B, 1C, 2A, 2B, 3)
Common: Long Day (LD) / Night (N) / Early (E) / Late (L)
Example: EELLN XXEELLN XX
```

---

## 🗂️ Pattern Definition Format

### JSON Schema

```json
{
  "patternId": "continental-24-7",
  "name": "Continental Shift Pattern",
  "description": "2M-2A-2N-4OFF pattern for 24/7 coverage",
  "industry": ["healthcare", "manufacturing", "emergency-services"],
  "region": "global",
  "teams": 4,
  "cycleDays": 8,
  "averageHoursPerWeek": 42,
  "shifts": [
    {
      "code": "M",
      "name": "Morning",
      "start": "06:00",
      "end": "14:00",
      "duration": 8,
      "breakMinutes": 30
    },
    {
      "code": "A",
      "name": "Afternoon",
      "start": "14:00",
      "end": "22:00",
      "duration": 8,
      "breakMinutes": 30
    },
    {
      "code": "N",
      "name": "Night",
      "start": "22:00",
      "end": "06:00",
      "duration": 8,
      "breakMinutes": 30,
      "nightShift": true
    },
    {
      "code": "X",
      "name": "Off",
      "start": null,
      "end": null,
      "duration": 0
    }
  ],
  "rotationPattern": [
    ["M", "M", "A", "A", "N", "N", "X", "X"],  // Team 1
    ["A", "A", "N", "N", "X", "X", "M", "M"],  // Team 2
    ["N", "N", "X", "X", "M", "M", "A", "A"],  // Team 3
    ["X", "X", "M", "M", "A", "A", "N", "N"]   // Team 4
  ],
  "compliance": {
    "maxConsecutiveDays": 6,
    "minRestHours": 11,
    "nightShiftLimit": 8
  }
}
```

---

## 💾 Pattern Library Structure

### File Organization

```
/pattern-library/
├── global/
│   ├── continental.json
│   ├── dupont.json
│   ├── pitman.json
│   └── 4-on-4-off.json
├── uk/
│   ├── nhs-banding-1a.json
│   ├── nhs-banding-2a.json
│   └── retail-standard.json
├── us/
│   ├── 9-80-schedule.json
│   └── panama-schedule.json
└── custom/
    └── user-defined.json
```

---

## 🔧 Implementation: Pattern Engine

### Core Pattern Class

```javascript
class ShiftPattern {
    constructor(patternData) {
        this.id = patternData.patternId;
        this.name = patternData.name;
        this.description = patternData.description;
        this.teams = patternData.teams;
        this.cycleDays = patternData.cycleDays;
        this.shifts = patternData.shifts;
        this.rotationPattern = patternData.rotationPattern;
        this.compliance = patternData.compliance;
    }

    /**
     * Apply pattern to staff starting from a specific date
     * @param {Array} staffList - Array of staff objects
     * @param {Date} startDate - Pattern start date
     * @param {Number} weeksToGenerate - How many weeks to schedule
     * @returns {Array} Generated shifts
     */
    applyToStaff(staffList, startDate, weeksToGenerate = 4) {
        const generatedShifts = [];
        const totalDays = weeksToGenerate * 7;
        
        // Divide staff into teams
        const teamsAssignment = this.assignStaffToTeams(staffList);
        
        for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(currentDate.getDate() + dayOffset);
            const dateStr = currentDate.toISOString().split('T')[0];
            
            // Determine position in rotation cycle
            const cyclePosition = dayOffset % this.cycleDays;
            
            // For each team
            teamsAssignment.forEach((team, teamIndex) => {
                const shiftCode = this.rotationPattern[teamIndex][cyclePosition];
                const shiftDef = this.shifts.find(s => s.code === shiftCode);
                
                // Don't create shift for off days
                if (shiftCode === 'X' || !shiftDef.start) return;
                
                // Create shift for each staff member in this team
                team.forEach(staffMember => {
                    generatedShifts.push({
                        id: `sh-${Date.now()}-${Math.random()}`,
                        staffId: staffMember.id,
                        date: dateStr,
                        start: shiftDef.start,
                        end: shiftDef.end,
                        shiftType: shiftDef.name,
                        patternId: this.id,
                        teamNumber: teamIndex + 1
                    });
                });
            });
        }
        
        return generatedShifts;
    }

    /**
     * Divide staff into equal teams
     */
    assignStaffToTeams(staffList) {
        const teams = Array.from({ length: this.teams }, () => []);
        staffList.forEach((staff, index) => {
            const teamIndex = index % this.teams;
            teams[teamIndex].push(staff);
        });
        return teams;
    }

    /**
     * Validate pattern compliance
     */
    validateCompliance(shifts, staffId) {
        const staffShifts = shifts
            .filter(s => s.staffId === staffId)
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        
        const violations = [];
        
        // Check max consecutive days
        let consecutiveDays = 0;
        for (let i = 0; i < staffShifts.length; i++) {
            if (i === 0) {
                consecutiveDays = 1;
                continue;
            }
            
            const prevDate = new Date(staffShifts[i - 1].date);
            const currDate = new Date(staffShifts[i].date);
            const dayDiff = (currDate - prevDate) / (1000 * 60 * 60 * 24);
            
            if (dayDiff === 1) {
                consecutiveDays++;
                if (consecutiveDays > this.compliance.maxConsecutiveDays) {
                    violations.push({
                        type: 'MAX_CONSECUTIVE_DAYS',
                        date: staffShifts[i].date,
                        value: consecutiveDays
                    });
                }
            } else {
                consecutiveDays = 1;
            }
        }
        
        return violations;
    }
}
```

---

## 📥 CSV Import System

### CSV Format Specification

```csv
Date,StaffName,ShiftType,Start,End,Location
2025-12-15,John Smith,Morning,06:00,14:00,Ward A
2025-12-15,Jane Doe,Afternoon,14:00,22:00,Ward B
2025-12-16,John Smith,Afternoon,14:00,22:00,Ward A
```

### Import Parser

```javascript
class PatternImporter {
    /**
     * Parse CSV file and convert to shifts
     */
    static parseCSV(csvText, staffList) {
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        
        const shifts = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const row = {};
            
            headers.forEach((header, index) => {
                row[header] = values[index];
            });
            
            // Match staff by name
            const staff = staffList.find(s => 
                s.name.toLowerCase() === row.StaffName.toLowerCase()
            );
            
            if (!staff) {
                console.warn(`Staff not found: ${row.StaffName}`);
                continue;
            }
            
            shifts.push({
                id: `sh-${Date.now()}-${i}`,
                staffId: staff.id,
                date: row.Date,
                start: row.Start,
                end: row.End,
                location: row.Location || '',
                shiftType: row.ShiftType || ''
            });
        }
        
        return shifts;
    }

    /**
     * Import from external scheduling software
     */
    static importFromRotamaster(xml) {
        // Parse Rotamaster XML format
        // Convert to Shift Craft (Atlas) format
    }

    static importFromWhenIWork(json) {
        // Parse WhenIWork JSON export
        // Convert to Shift Craft (Atlas) format
    }
}
```

---

## 🎨 UI Integration

### Pattern Library Selector

```html
<!-- Pattern Library Modal -->
<div id="pattern-library-modal" class="modal-overlay">
    <div class="modal-card">
        <h2>📚 Shift Pattern Library</h2>
        
        <div class="pattern-filters">
            <select id="pattern-region-filter">
                <option value="all">All Regions</option>
                <option value="global">Global</option>
                <option value="uk">United Kingdom</option>
                <option value="us">United States</option>
            </select>
            
            <select id="pattern-industry-filter">
                <option value="all">All Industries</option>
                <option value="healthcare">Healthcare</option>
                <option value="manufacturing">Manufacturing</option>
                <option value="emergency-services">Emergency Services</option>
            </select>
        </div>
        
        <div id="pattern-list" class="pattern-grid">
            <!-- Dynamically populated -->
        </div>
        
        <div class="modal-actions">
            <button id="apply-pattern-btn" class="btn btn-primary">
                Apply Pattern
            </button>
            <button id="preview-pattern-btn" class="btn btn-outline">
                Preview
            </button>
            <button id="close-pattern-modal" class="btn btn-ghost">
                Cancel
            </button>
        </div>
    </div>
</div>

<!-- Pattern Card Template -->
<template id="pattern-card-template">
    <div class="pattern-card" data-pattern-id="">
        <div class="pattern-header">
            <h3 class="pattern-name"></h3>
            <span class="pattern-badge"></span>
        </div>
        <p class="pattern-description"></p>
        <div class="pattern-stats">
            <span>🔄 <span class="cycle-days"></span> day cycle</span>
            <span>👥 <span class="team-count"></span> teams</span>
            <span>⏰ <span class="avg-hours"></span>h/week</span>
        </div>
        <div class="pattern-preview">
            <!-- Visual pattern representation -->
        </div>
    </div>
</template>
```

### Pattern Visualizer

```javascript
class PatternVisualizer {
    /**
     * Render pattern as visual timeline
     */
    static renderPattern(pattern, containerEl) {
        containerEl.innerHTML = '';
        
        const timeline = document.createElement('div');
        timeline.className = 'pattern-timeline';
        
        // Show first team's rotation as example
        pattern.rotationPattern[0].forEach((shiftCode, dayIndex) => {
            const shiftDef = pattern.shifts.find(s => s.code === shiftCode);
            const dayBlock = document.createElement('div');
            dayBlock.className = `day-block shift-${shiftCode.toLowerCase()}`;
            dayBlock.textContent = shiftCode;
            dayBlock.title = `Day ${dayIndex + 1}: ${shiftDef.name}`;
            
            // Color coding
            if (shiftCode === 'M') dayBlock.style.background = '#fbbf24';      // Morning: yellow
            if (shiftCode === 'A') dayBlock.style.background = '#f97316';      // Afternoon: orange
            if (shiftCode === 'N') dayBlock.style.background = '#3b82f6';      // Night: blue
            if (shiftCode === 'X') dayBlock.style.background = '#94a3b8';      // Off: gray
            
            timeline.appendChild(dayBlock);
        });
        
        containerEl.appendChild(timeline);
    }
}
```

---

## 🔌 Integration with Existing System

### Enhanced RotaApp Class

```javascript
class RotaApp {
    constructor() {
        // ... existing code ...
        
        this.patternLibrary = [];
        this.loadPatternLibrary();
    }

    async loadPatternLibrary() {
        try {
            // Load built-in patterns
            const response = await fetch('/pattern-library/index.json');
            const index = await response.json();
            
            for (const patternRef of index.patterns) {
                const patternData = await fetch(patternRef.path).then(r => r.json());
                this.patternLibrary.push(new ShiftPattern(patternData));
            }
            
            console.log(`✅ Loaded ${this.patternLibrary.length} shift patterns`);
        } catch (error) {
            console.warn('Pattern library not available:', error);
        }
    }

    applyPattern(patternId, startDate, weeks = 4) {
        const pattern = this.patternLibrary.find(p => p.id === patternId);
        if (!pattern) {
            return this.showToast('Pattern not found', 'alert-circle');
        }
        
        // Confirm before applying
        if (!confirm(`Apply "${pattern.name}" pattern for ${weeks} weeks? This will generate ~${this.staff.length * weeks * 5} shifts.`)) {
            return;
        }
        
        // Generate shifts
        const newShifts = pattern.applyToStaff(this.staff, startDate, weeks);
        
        // Check for conflicts
        let conflicts = 0;
        newShifts.forEach(shift => {
            const hasConflict = this.shifts.some(existing => 
                existing.staffId === shift.staffId &&
                existing.date === shift.date &&
                this.shiftsOverlap(existing, shift)
            );
            
            if (!hasConflict) {
                this.shifts.push(shift);
            } else {
                conflicts++;
            }
        });
        
        this.saveToStorage();
        this.renderTableBody();
        this.updateStats();
        
        this.showToast(
            `✅ Applied pattern: ${newShifts.length - conflicts} shifts created` +
            (conflicts > 0 ? ` (${conflicts} conflicts skipped)` : ''),
            'check-circle'
        );
    }

    shiftsOverlap(shift1, shift2) {
        return (
            (shift1.start >= shift2.start && shift1.start < shift2.end) ||
            (shift1.end > shift2.start && shift1.end <= shift2.end) ||
            (shift1.start <= shift2.start && shift1.end >= shift2.end)
        );
    }

    importCSV(csvText) {
        const newShifts = PatternImporter.parseCSV(csvText, this.staff);
        
        if (newShifts.length === 0) {
            return this.showToast('No valid shifts found in CSV', 'alert-circle');
        }
        
        // Add to roster
        this.shifts.push(...newShifts);
        this.saveToStorage();
        this.renderTableBody();
        this.updateStats();
        
        this.showToast(`📥 Imported ${newShifts.length} shifts`, 'download');
    }
}
```

---

## 📦 Example Pattern Library Files

### `/pattern-library/index.json`

```json
{
  "version": "1.0.0",
  "lastUpdated": "2025-12-20",
  "patterns": [
    {
      "id": "continental-24-7",
      "name": "Continental Shift Pattern",
      "path": "/pattern-library/global/continental.json",
      "region": "global",
      "featured": true
    },
    {
      "id": "dupont-12h",
      "name": "DuPont 12-Hour Schedule",
      "path": "/pattern-library/global/dupont.json",
      "region": "global",
      "featured": true
    },
    {
      "id": "nhs-banding-1a",
      "name": "NHS Banding 1A Pattern",
      "path": "/pattern-library/uk/nhs-banding-1a.json",
      "region": "uk",
      "featured": false
    }
  ]
}
```

### `/pattern-library/global/continental.json`

```json
{
  "patternId": "continental-24-7",
  "name": "Continental Shift Pattern",
  "description": "Classic 2-2-2-4 pattern for 24/7 operations. Provides 4 days off every 8 days.",
  "industry": ["healthcare", "manufacturing", "emergency-services"],
  "region": "global",
  "tags": ["24/7", "rotating", "balanced"],
  "teams": 4,
  "cycleDays": 8,
  "averageHoursPerWeek": 42,
  "shifts": [
    {
      "code": "M",
      "name": "Morning",
      "start": "06:00",
      "end": "14:00",
      "duration": 8,
      "breakMinutes": 30,
      "color": "#fbbf24"
    },
    {
      "code": "A",
      "name": "Afternoon",
      "start": "14:00",
      "end": "22:00",
      "duration": 8,
      "breakMinutes": 30,
      "color": "#f97316"
    },
    {
      "code": "N",
      "name": "Night",
      "start": "22:00",
      "end": "06:00",
      "duration": 8,
      "breakMinutes": 30,
      "nightShift": true,
      "color": "#3b82f6"
    },
    {
      "code": "X",
      "name": "Off",
      "start": null,
      "end": null,
      "duration": 0,
      "color": "#94a3b8"
    }
  ],
  "rotationPattern": [
    ["M", "M", "A", "A", "N", "N", "X", "X"],
    ["A", "A", "N", "N", "X", "X", "M", "M"],
    ["N", "N", "X", "X", "M", "M", "A", "A"],
    ["X", "X", "M", "M", "A", "A", "N", "N"]
  ],
  "compliance": {
    "maxConsecutiveDays": 6,
    "minRestHours": 11,
    "nightShiftLimit": 8,
    "weeklyHoursMax": 48
  },
  "advantages": [
    "Balanced workload across teams",
    "Predictable 8-day cycle",
    "Good work-life balance with 4-day breaks",
    "24/7 coverage guaranteed"
  ],
  "disadvantages": [
    "Requires minimum 4 teams",
    "Night shifts can be challenging",
    "Handover complexity"
  ]
}
```

---

## 🚀 Implementation Roadmap

### Phase 1: Core Pattern Engine (Week 1-2)
- [ ] Create `ShiftPattern` class
- [ ] Build pattern JSON schema
- [ ] Implement `applyToStaff()` method
- [ ] Add pattern validation

### Phase 2: Pattern Library (Week 3-4)
- [ ] Design 10+ global patterns (Continental, DuPont, Pitman, etc.)
- [ ] Create pattern index system
- [ ] Build pattern visualizer
- [ ] Add region/industry filters

### Phase 3: UI Integration (Week 5-6)
- [ ] Pattern library modal
- [ ] Pattern preview system
- [ ] Pattern application wizard
- [ ] Conflict resolution UI

### Phase 4: Import System (Week 7-8)
- [ ] CSV parser
- [ ] Excel import (.xlsx)
- [ ] Integration with Rotamaster/WhenIWork
- [ ] Bulk import validation

### Phase 5: Advanced Features (Week 9-12)
- [ ] Custom pattern builder
- [ ] Pattern analytics (cost, compliance scores)
- [ ] Pattern recommendations based on metrics
- [ ] AI-suggested pattern optimizations

---

## 📊 Benefits of Pattern Library

| Benefit | Impact |
|---------|--------|
| **Time Savings** | 95% reduction in manual scheduling time |
| **Compliance** | Built-in regulatory compliance by design |
| **Consistency** | Standardized patterns across organization |
| **Knowledge Transfer** | Industry best practices codified |
| **Onboarding** | New managers can apply proven patterns immediately |

---

## 🎓 Educational Component

Each pattern could include:
- **History**: Origin and evolution
- **Best Practices**: When to use this pattern
- **Case Studies**: Real-world implementations
- **Compliance Notes**: Regulatory considerations
- **Customization Guide**: How to adapt for your team

---

## 💡 Summary

A Pattern Library system would transform Shift Craft (Atlas) from a **scheduling tool** into a **scheduling solution**:

✅ **Instant Deployment**: Apply proven patterns in seconds  
✅ **Global Standards**: Leverage decades of industry knowledge  
✅ **Compliance Built-In**: Patterns designed around regulations  
✅ **Import Flexibility**: Bring existing schedules from any system  
✅ **Customizable**: Start with templates, adapt to your needs  

**Recommended First Patterns:**
1. Continental (healthcare)
2. 4-on-4-off (emergency services)
3. 9/80 (professional services)
4. NHS Banding 1A (UK healthcare)
5. Retail 2-shift (retail/hospitality)

This would be a **game-changing feature** for user adoption! 🚀
