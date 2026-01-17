# Phase 0: Foundations and Guard Rails (Implementation Plan)

## Objective
Implement Feature Flags, Pre-launch Gate, and Waitlist functionality as defined in "Antigravity Prompt 1", adapted for the current Vanilla JS Single Page Application (SPA) architecture.

## Strategy
Since this is a client-side application without a dedicated backend server (currently using LocalStorage persistence), we will simulate the API and Database layers using LocalStorage services. This ensures the features are functional and testable immediately, while preserving the architecture for future backend integration.

## 1. Feature Flags Engine
**Goal**: manage feature toggles (`prelaunch`, `inviteOnly`, etc.) dynamically.

*   **Config**: Create `src/js/config/flags.js` defining default states.
    ```javascript
    export const DEFAULT_FLAGS = {
        prelaunch: true,
        inviteOnly: true,
        enableBilling: false,
        enableGenerator: false
    };
    ```
*   **Manager**: Create `src/js/core/FeatureFlagManager.js`.
    *   Loads defaults.
    *   Checks `localStorage` for overrides (allows Admin toggling at runtime).
    *   Exposes `isEnabled(key)` and `toggle(key)`.

## 2. Waitlist & Access Control
**Goal**: Block unauthorized access during pre-launch and capture leads.

*   **Service**: Create `src/js/services/WaitlistService.js`.
    *   `join(email, name)`: Validates input and saves to `localStorage['shiftcraft_waitlist']`.
    *   `checkInvite(code)`: Validates entry codes (Mock logic: e.g., 'ATLAS2026').
*   **UI Components**:
    *   **Gate Overlay**: A full-screen blocking modal displayed on load if `flags.inviteOnly` is true and no session exists.
    *   **Banner**: A distinct top-bar warning when `flags.prelaunch` is true.

## 3. Administration
**Goal**: Allow live toggling of flags and waitlist export.

*   **UI**: Add an "Admin Flags" accessible area (e.g., hidden shortcut or DevTools console command initially, later a UI panel).
*   **Functionality**:
    *   List all flags with Toggle switches.
    *   "Export Waitlist": Downloads `shiftcraft_waitlist` data as CSV.

## 4. Integration Plan (Sequenced)
1.  **Scaffold**: Create `flags.js`, `FeatureFlagManager.js`, `WaitlistService.js`.
2.  **UI Implementation**: Add HTML structure for the Gate Overlay and Banner in `index.html`.
3.  **Wiring**: Update `app.js` `init()` method to:
    *   Initialize Flag Manager.
    *   Check state.
    *   Render Gate if blocked.
4.  **Validation**: Verify flow (New User -> Blocked -> Joins Waitlist / Enters Code -> Access Granted).

## 5. Security Note
*   *Frontend-only implementation provides UX security but not cryptographic security. Knowledgeable users can bypass client-side gates. This is acceptable for an MVP/Prototype phase.*
