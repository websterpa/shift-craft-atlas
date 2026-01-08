# Technical Briefing: Smart Fill Logic Defect & Remediation
**Project:** Shift Craft (Atlas Build) - UK Staff Rostering SaaS
**Component:** `AllocationEngine.js` / `smartFillWeek`
**Status:** Refactored for Resource-Awareness and Idempotency

---

## 1. Mission & Context: Precision Over Duplication
The broader objective of this initiative is to move the **Shift Craft (Atlas Build)** away from simple "pattern copying" and towards a **Resource-aware Precision Model**.

### What we are trying to achieve:
1.  **Enforce a "Resource-First" Strategy:** The system should never add staff just because they exist; it should only add staff to meet a specific, calculated coverage gap.
2.  **Ensure Reliability (Idempotency):** The "Smart Fill" button should be safe to click multiple times. It should act as a "healing" function that fills gaps without creating duplicates.
3.  **Harden Compliance Boundaries:** By moving to a gap-filling logic, we ensure that the system stays within the headcount limits, making it easier to maintain compliance with UK Working Time Regulations.

---

## 2. Executive Summary
The "Smart Fill" feature was designed to automatically populate a target week's roster by mimicking the staffing patterns of the previous week. However, the original implementation was **non-idempotent** and **coverage-blind**. Repeatedly clicking the button resulted in "Ghost Staffing"—where the engine would append a full set of shifts on top of existing ones, leading to massive over-allocation (e.g., 7 staff members assigned to a slot that only requires 2).

## 2. The Problem (Root Causes)
1.  **Additive vs. Reconstructive:** The engine treated the previous week's shifts as a "todo list" to be appended, rather than a "demand profile" to be met.
2.  **Lack of State Awareness:** It did not inspect the `shifts` already present in the target week before adding new ones.
3.  **Primitive Collision Detection:** The `findBestCandidate` logic used simple string comparisons for time (`start >= s.start`), which failed for night shifts spanning midnight (e.g., 22:00 - 06:00).
4.  **Batch Processing Blindness:** In a single "Smart Fill" run, the engine could assign multiple shifts to the same person on the same day because the `shifts` array wasn't updated in real-time within the loop, only at the end.

---

## 3. High-Level Logic (Refactored)
The current implementation follows a **"Net Deficit Fill"** strategy:

1.  **Demand Profiling:** It looks at the source week (T-7 days) and classifies shifts into types (Early, Late, Night, Day12) using the `ComplianceEngine`.
2.  **Coverage Assessment:** It performs the same classification on the target week to see what is *already* scheduled.
3.  **Deficit Calculation:** 
    `Deficit = Max(0, Required_Count - Current_Count)`
    This ensures that if the roster is already full, clicking the button does nothing (Idempotency).
4.  **Resource Limits:** Demand for any single shift type is capped at the total `headcount` to prevent impossible scheduling requests.
5.  **Multi-Layer Conflict Resolution:** 
    *   **Layer 1:** `findBestCandidate` filters via `excludeStaffIds`.
    *   **Layer 2:** Local `staffShiftMap` cache tracks assignments within the same day.
    *   **Layer 3:** Final "Batch Clash" check against the `newShifts` array before push.

---

## 4. Technical Implementation Details

### A. Time Normalization (`_timeToMins`)
We introduced a utility to convert "HH:MM" into total minutes. This allows for robust overlap checking:
```javascript
const sStart = this._timeToMins(s.start);
let sEnd = this._timeToMins(s.end);
if (sEnd <= sStart) sEnd += 1440; // Normalize midnight crossover
```

### B. Coverage Profiling (`_getCoverageProfile`)
This helper groups shifts by their classified type. This is critical because "Early" is defined by its timing (e.g., 06:00), not just its name.
```javascript
_getCoverageProfile(slots) {
    const profile = {};
    slots.forEach(slot => {
        const info = this.app.classifyShiftType(slot);
        const type = info.cssClass || 'other';
        // ... aggregation logic ...
    });
    return profile;
}
```

### C. Safety Batch Check
To prevent the engine from assigning a person two shifts in the same "Smart Fill" click (one for Early, one for Night):
```javascript
const candidateClash = newShifts.find(ns => ns.staffId === bestStaff.id && ns.date === targetDateStr);
if (candidateClash) return; // Prevent double-booking in same day-batch
```

---

## 5. Known Constraints & Edge Cases
*   **Source Data Dependency:** Smart Fill relies on the *previous* week having a valid pattern. If the previous week is empty, Smart Fill will find 0 demand and do nothing.
*   **Rotation Logic:** It does not currently "rotate" staff; it tries to find the *best fit* (fairest/under-hours) for the specific gaps found.
*   **Manual Overrides:** If a user manually deletes a shift and clicks Smart Fill, the engine will detect the new gap and fill it exactly once.

---

## 6. Verification Steps
1.  **Seed Data:** Add 2 Early shifts to Monday of Week A.
2.  **Trigger:** Navigate to Week B and click **Smart Fill**.
3.  **Expectation:** 2 Early shifts appear in Week B.
4.  **Stress Test:** Click **Smart Fill** again.
5.  **Pass Criteria:** No new shifts are added. Console should log: `[SmartFill] ...: needed 2, have 2, deficit 0`.

---
**Author:** Google Antigravity (AI Engineering Lead)
**Date:** 2026-01-06
