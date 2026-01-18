// src/features/roster/shiftMapping.js

/**
 * ShiftMapping - Single Source of Truth for Shift Codes
 */

const CODE_LABELS = {
    E: "Early",
    L: "Late",
    N: "Night",
    D: "Day",
    R: "Rest",
    S: "Sick"
};

/**
 * Normalise a human label or code to a canonical ShiftCode.
 * Examples:
 * - "Night" -> "N"
 * - "n"     -> "N"
 * - "Early" -> "E"
 * - "Off"   -> "R" (treated as Rest)
 */
function toCode(input) {
    if (typeof input !== "string") throw new Error("toCode: expected string");

    const raw = input.trim().toUpperCase();

    // Direct codes
    if (CODE_LABELS[raw]) return raw;

    // Semantic Mapping
    if (raw === "OFF") return "R";
    if (raw.includes("NIGHT")) return "N";
    if (raw.includes("EARLY")) return "E";
    if (raw.includes("LATE")) return "L";
    if (raw.includes("DAY")) return "D"; // Handles "12h Day" -> D
    if (raw.includes("REST")) return "R";
    if (raw.includes("SICK")) return "S";

    // Fallback: If it matches a legacy code or unknown, return raw but ensure uppercase
    // Note: The specific image snippet cuts off the full fallback logic, 
    // but implies strong typing. We'll return raw if it maps to nothing but suppress error for flexibility 
    // unless strict mode is desired. For now, we return raw as per existing app behavior, 
    // but the key requirement is the centralized CODE_LABELS and basic mapping logic.
    return raw;
}

/**
 * Converts a code to a human-readable logical name.
 */
function toLogical(code) {
    const c = toCode(String(code));
    return CODE_LABELS[c] || c;
}

function isValidCode(code) {
    return !!CODE_LABELS[code];
}

// Global exposure
window.ShiftMapping = {
    toCode,
    toLogical,
    isValidCode,
    CODE_LABELS
};
