/**
 * ShiftPattern - Core Pattern Engine for Shift Craft (Atlas)
 * 
 * Represents a reusable shift pattern (e.g., Continental, DuPont, NHS Banding)
 * and provides methods to apply patterns to staff rosters.
 * 
 * @class ShiftPattern
 * @version 1.0.0
 * @adheres Truth Protocol - No mock data, all calculations verifiable
 */

class ShiftPattern {
    /**
     * Create a shift pattern from pattern definition
     * @param {Object} patternData - Pattern configuration object
     * @param {string} patternData.patternId - Unique pattern identifier
     * @param {string} patternData.name - Human-readable pattern name
     * @param {string} patternData.description - Pattern description
     * @param {number} patternData.teams - Number of teams in rotation
     * @param {number} patternData.cycleDays - Length of rotation cycle in days
     * @param {Array<Object>} patternData.shifts - Shift definitions
     * @param {Array<Array<string>>} patternData.rosterPattern - Team rotation sequences
     * @param {Object} patternData.compliance - Compliance rules
     */
    constructor(patternData) {
        // Validate required fields
        if (!patternData || typeof patternData !== 'object') {
            throw new Error('Pattern data must be an object');
        }

        this.validatePatternData(patternData);

        // Core properties
        this.id = patternData.patternId;
        this.name = patternData.name;
        this.description = patternData.description;
        this.industry = patternData.industry || [];
        this.region = patternData.region || 'global';
        this.tags = patternData.tags || [];

        // Pattern structure
        this.teams = patternData.teams;
        this.cycleDays = patternData.cycleDays;
        this.averageHoursPerWeek = patternData.averageHoursPerWeek || 0;

        // Shift definitions
        this.shifts = patternData.shifts;
        this.rosterPattern = patternData.rotationPattern; // Internal consistency

        // Compliance rules
        this.compliance = patternData.compliance || {
            maxConsecutiveDays: 6,
            minRestHours: 11,
            nightShiftLimit: 8,
            weeklyHoursMax: 48
        };

        // Metadata
        this.advantages = patternData.advantages || [];
        this.disadvantages = patternData.disadvantages || [];
    }

    /**
     * Validate pattern data structure
     * @param {Object} data - Pattern data to validate
     * @throws {Error} If validation fails
     * @private
     */
    validatePatternData(data) {
        const required = ['patternId', 'name', 'teams', 'cycleDays', 'shifts', 'rotationPattern'];
        const missing = required.filter(field => !data[field]);

        if (missing.length > 0) {
            throw new Error(`Missing required fields: ${missing.join(', ')}`);
        }

        if (!Array.isArray(data.shifts) || data.shifts.length === 0) {
            throw new Error('Shifts must be a non-empty array');
        }

        if (!Array.isArray(data.rotationPattern) || data.rotationPattern.length !== data.teams) {
            throw new Error(`Rotation pattern must have exactly ${data.teams} team sequences`);
        }

        // Validate each team rotation matches cycle length
        data.rotationPattern.forEach((teamRotation, idx) => {
            if (!Array.isArray(teamRotation) || teamRotation.length !== data.cycleDays) {
                throw new Error(`Team ${idx + 1} rotation must have ${data.cycleDays} shifts`);
            }
        });
    }

    /**
     * Apply this pattern to a list of staff members
     * 
     * @param {Array<Object>} staffList - Array of staff objects with {id, name, role}
     * @param {Date} startDate - Pattern start date
     * @param {number} weeksToGenerate - Number of weeks to schedule
     * @param {Object} standards - Optional global shift standards override
     * @param {number} startingDayOffset - Offset to start rotation from (default 0)
     * @returns {Array<Object>} Array of generated shift objects
     */
    applyToStaff(staffList, startDate, weeksToGenerate = 4, standards = null, startingDayOffset = 0) {
        if (!Array.isArray(staffList) || staffList.length === 0) {
            throw new Error('Staff list must be a non-empty array');
        }

        if (!(startDate instanceof Date) || isNaN(startDate)) {
            throw new Error('Start date must be a valid Date object');
        }

        const generatedShifts = [];
        const totalDays = weeksToGenerate * 7;

        // Divide staff into teams
        const teamsAssignment = this.assignStaffToTeams(staffList);

        // Generate shifts for each day
        for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(currentDate.getDate() + dayOffset);
            const dateStr = currentDate.toISOString().split('T')[0];

            // Determine position in rotation cycle, including starting offset
            const cyclePosition = (dayOffset + startingDayOffset) % this.cycleDays;

            // Generate shifts for each team
            teamsAssignment.forEach((team, teamIndex) => {
                const shiftCode = this.rosterPattern[teamIndex][cyclePosition];
                const shiftDef = this.shifts.find(s => s.code === shiftCode);

                // Don't create shift for off days
                if (shiftCode === 'R' || !shiftDef || !shiftDef.start) {
                    return;
                }

                // Create shift for each staff member in this team
                team.forEach(staffMember => {
                    // Internal guard: Ensure we haven't already generated a shift for this person on this date
                    // (Note: applyPattern handles cross-session conflicts, this is for internal consistency)
                    const alreadyGenerated = generatedShifts.some(gs => gs.staffId === staffMember.id && gs.date === dateStr);
                    if (alreadyGenerated) return;

                    let start = shiftDef.start;
                    let end = shiftDef.end;

                    // Apply Standards Override (Gaps Check: Maintain duration if start changes)
                    if (standards) {
                        let overrideStart = null;
                        const dur = shiftDef.duration;

                        if (dur >= 7.5 && dur <= 9.5) {
                            if (shiftCode === 'E') overrideStart = standards.early8;
                            if (shiftCode === 'L') overrideStart = standards.late8;
                            if (shiftCode === 'N') overrideStart = standards.night8;
                        } else if (dur >= 11 && dur <= 13.5) {
                            if (shiftCode === 'D' || shiftCode === 'LD') overrideStart = standards.day12;
                            if (shiftCode === 'N') overrideStart = standards.night12;
                        }

                        if (overrideStart && overrideStart !== start) {
                            const duration = shiftDef.duration;
                            start = overrideStart;
                            // Calculate new end time to respect Truth Protocol (Maintain Duration)
                            const [h, m] = start.split(':').map(Number);
                            let eh = (h + duration) % 24;
                            end = `${eh.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                        }
                    }

                    generatedShifts.push({
                        id: this.generateShiftId(),
                        staffId: staffMember.id,
                        date: dateStr,
                        start: start,
                        end: end,
                        shiftType: shiftDef.name,
                        patternId: this.id,
                        teamNumber: teamIndex + 1,
                        duration: shiftDef.duration
                    });
                });
            });
        }

        return generatedShifts;
    }

    /**
     * Divide staff into equal teams for rotation
     * 
     * @param {Array<Object>} staffList - List of staff members
     * @returns {Array<Array<Object>>} Staff divided into teams
     * @private
     */
    assignStaffToTeams(staffList) {
        const teams = Array.from({ length: this.teams }, () => []);

        // Sort staff by ID to ensure deterministic team assignment across pattern reapplications
        const sortedStaff = [...staffList].sort((a, b) => a.id.localeCompare(b.id));

        sortedStaff.forEach((staff, index) => {
            const teamIndex = index % this.teams;
            teams[teamIndex].push(staff);
        });

        return teams;
    }

    /**
     * Generate unique shift ID
     * @returns {string} Unique shift identifier
     * @private
     */
    generateShiftId() {
        return `sh-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get shift definition by code
     * 
     * @param {string} code - Shift code (e.g., 'M', 'A', 'N')
     * @returns {Object|null} Shift definition or null if not found
     */
    getShiftByCode(code) {
        return this.shifts.find(s => s.code === code) || null;
    }

    /**
     * Validate pattern compliance against generated shifts
     * 
     * @param {Array<Object>} shifts - Generated shifts to validate
     * @param {string} staffId - Staff member ID to check
     * @returns {Array<Object>} Array of compliance violations
     * 
     * @example
     * const violations = pattern.validateCompliance(shifts, 'staff-123');
     * // Returns: [{type: 'MAX_CONSECUTIVE_DAYS', date: '2025-12-25', value: 7}]
     */
    validateCompliance(shifts, staffId) {
        const staffShifts = shifts
            .filter(s => s.staffId === staffId)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        const violations = [];

        // Check maximum consecutive working days
        let consecutiveDays = 0;
        let lastDate = null;

        for (const shift of staffShifts) {
            const currentDate = new Date(shift.date);

            if (lastDate) {
                const dayDiff = Math.floor((currentDate - lastDate) / (1000 * 60 * 60 * 24));

                if (dayDiff === 1) {
                    consecutiveDays++;
                    if (consecutiveDays > this.compliance.maxConsecutiveDays) {
                        violations.push({
                            type: 'MAX_CONSECUTIVE_DAYS',
                            date: shift.date,
                            value: consecutiveDays,
                            limit: this.compliance.maxConsecutiveDays
                        });
                    }
                } else {
                    consecutiveDays = 1;
                }
            } else {
                consecutiveDays = 1;
            }

            lastDate = currentDate;
        }

        // Check night shift limit (consecutive night shifts)
        let consecutiveNights = 0;
        for (const shift of staffShifts) {
            const shiftDef = this.getShiftByCode(shift.shiftType[0]); // Assume first letter is code

            if (shiftDef && shiftDef.nightShift) {
                consecutiveNights++;
                if (consecutiveNights > this.compliance.nightShiftLimit) {
                    violations.push({
                        type: 'NIGHT_SHIFT_LIMIT',
                        date: shift.date,
                        value: consecutiveNights,
                        limit: this.compliance.nightShiftLimit
                    });
                }
            } else {
                consecutiveNights = 0;
            }
        }

        return violations;
    }

    /**
     * Calculate total hours per week for this pattern
     * 
     * @returns {number} Average hours per week
     */
    calculateAverageHoursPerWeek() {
        if (this.averageHoursPerWeek > 0) {
            return this.averageHoursPerWeek;
        }

        // Calculate from pattern
        let totalHours = 0;

        for (const teamRotation of this.rosterPattern) {
            for (const shiftCode of teamRotation) {
                const shiftDef = this.getShiftByCode(shiftCode);
                if (shiftDef && shiftDef.duration) {
                    totalHours += shiftDef.duration;
                }
            }
        }

        // Average across teams and normalize to weekly
        const hoursPerCycle = totalHours / this.teams;
        const weeksPerCycle = this.cycleDays / 7;

        return hoursPerCycle / weeksPerCycle;
    }

    /**
     * Get pattern summary for display
     * 
     * @returns {Object} Pattern summary object
     */
    getSummary() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            teams: this.teams,
            cycleDays: this.cycleDays,
            averageHoursPerWeek: this.calculateAverageHoursPerWeek(),
            industry: this.industry,
            region: this.region,
            compliance: this.compliance
        };
    }

    /**
     * Export pattern to JSON
     * 
     * @returns {Object} Pattern as JSON object
     */
    toJSON() {
        return {
            patternId: this.id,
            name: this.name,
            description: this.description,
            industry: this.industry,
            region: this.region,
            tags: this.tags,
            teams: this.teams,
            cycleDays: this.cycleDays,
            averageHoursPerWeek: this.averageHoursPerWeek,
            shifts: this.shifts,
            rosterPattern: this.rosterPattern,
            compliance: this.compliance,
            advantages: this.advantages,
            disadvantages: this.disadvantages
        };
    }
}

// Export for use in browser (if not using modules) or Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShiftPattern;
}
