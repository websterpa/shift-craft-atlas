/**
 * PatternEngine - Pattern Library Management System
 * 
 * Manages loading, caching, and applying shift patterns from the pattern library.
 * Provides search, filter, and recommendation capabilities.
 * 
 * @class PatternEngine
 * @version 1.0.0
 * @adheres Truth Protocol - All patterns from verifiable industry sources
 */

class PatternEngine {
    /**
     * Create a new Pattern Engine
     * @param {string} libraryPath - Path to pattern library index (default: '/pattern-library/index.json')
     */
    constructor(libraryPath = '/pattern-library/index.json') {
        this.libraryPath = libraryPath;
        this.patterns = new Map(); // patternId → ShiftPattern instance
        this.index = null;  // Pattern library index
        this.loaded = false;
        this.error = null;
    }

    /**
     * Load pattern library index and all patterns
     * @returns {Promise<number>} Number of patterns loaded
     */
    async loadLibrary() {
        if (this.loaded) return this.patterns.size;

        try {
            // Load index
            const response = await fetch(this.libraryPath);
            if (!response.ok) {
                throw new Error(`Failed to load pattern library: ${response.statusText}`);
            }

            this.index = await response.json();

            // Load all pattern definitions
            let loadedCount = 0;
            for (const patternMeta of this.index.patterns) {
                try {
                    const pattern = await this.loadPattern(patternMeta.id);
                    if (pattern) loadedCount++;
                } catch (error) {
                    console.warn(`Failed to load pattern ${patternMeta.id}:`, error);
                }
            }

            this.loaded = true;
            return loadedCount;

        } catch (error) {
            console.error('Pattern library load failed:', error);
            this.error = error;
            this.loaded = true; // Mark as loaded (with 0 patterns) to stop waiters
            throw error;
        }
    }

    /**
     * Load a single pattern by ID
     * @param {string} patternId - Pattern identifier
     * @returns {Promise<ShiftPattern|null>} Loaded pattern or null
     */
    async loadPattern(patternId) {
        // Check if already loaded
        if (this.patterns.has(patternId)) {
            return this.patterns.get(patternId);
        }

        // Find pattern metadata
        const meta = this.index.patterns.find(p => p.id === patternId);
        if (!meta) {
            throw new Error(`Pattern not found: ${patternId}`);
        }

        // Load pattern definition
        const response = await fetch(meta.path);
        if (!response.ok) {
            throw new Error(`Failed to load pattern ${patternId}: ${response.statusText}`);
        }

        const patternData = await response.json();

        // Create ShiftPattern instance
        const pattern = new ShiftPattern(patternData);
        this.patterns.set(patternId, pattern);

        return pattern;
    }

    /**
     * Get pattern by ID
     * @param {string} patternId - Pattern identifier
     * @returns {ShiftPattern|null} Pattern instance or null
     */
    getPattern(patternId) {
        return this.patterns.get(patternId) || null;
    }

    /**
     * Get all loaded patterns
     * @returns {Array<ShiftPattern>} Array of all patterns
     */
    getAllPatterns() {
        return Array.from(this.patterns.values());
    }

    /**
     * Search patterns by criteria
     * @param {Object} criteria - Search criteria
     * @param {string} criteria.region - Filter by region (e.g., 'global', 'uk', 'us')
     * @param {string} criteria.industry - Filter by industry
     * @param {number} criteria.teams - Filter by team count
     * @param {boolean} criteria.featured - Only featured patterns
     * @param {string} criteria.query - Text search in name/description
     * @returns {Array<Object>} Array of matching pattern metadata
     */
    search(criteria = {}) {
        if (!this.index) {
            throw new Error('Pattern library not loaded. Call loadLibrary() first.');
        }

        let results = [...this.index.patterns];

        // Filter by region
        if (criteria.region) {
            const regionPatterns = this.index.regions[criteria.region] || [];
            results = results.filter(p => regionPatterns.includes(p.id));
        }

        // Filter by industry
        if (criteria.industry) {
            results = results.filter(p =>
                p.industry && p.industry.includes(criteria.industry)
            );
        }

        // Filter by team count
        if (criteria.teams) {
            results = results.filter(p => p.teams === criteria.teams);
        }

        // Filter featured only
        if (criteria.featured === true) {
            results = results.filter(p => p.featured === true);
        }

        // Text search
        if (criteria.query) {
            const query = criteria.query.toLowerCase();
            results = results.filter(p =>
                p.name.toLowerCase().includes(query) ||
                p.description.toLowerCase().includes(query)
            );
        }

        return results;
    }

    /**
     * Get patterns by category
     * @param {string} category - Category name (e.g., '24/7', 'healthcare')
     * @returns {Array<Object>} Array of pattern metadata in category
     */
    getByCategory(category) {
        if (!this.index) {
            throw new Error('Pattern library not loaded');
        }

        const patternIds = this.index.categories[category] || [];
        return this.index.patterns.filter(p => patternIds.includes(p.id));
    }

    /**
     * Get patterns by region
     * @param {string} region - Region code ('global', 'uk', 'us')
     * @returns {Array<Object>} Array of pattern metadata for region
     */
    getByRegion(region) {
        if (!this.index) {
            throw new Error('Pattern library not loaded');
        }

        const patternIds = this.index.regions[region] || [];
        return this.index.patterns.filter(p => patternIds.includes(p.id));
    }

    /**
     * Get featured patterns
     * @returns {Array<Object>} Array of featured pattern metadata
     */
    getFeatured() {
        return this.search({ featured: true });
    }

    /**
     * Recommend patterns based on criteria
     * @param {Object} requirements - Requirements for recommendation
     * @param {number} requirements.staffCount - Number of staff available
     * @param {Array<string>} requirements.industries - Preferred industries
     * @param {string} requirements.region - Preferred region
     * @param {boolean} requirements.needs24x7 - Requires 24/7 coverage
     * @returns {Array<Object>} Recommended patterns with scores
     */
    recommend(requirements = {}) {
        if (!this.index) {
            throw new Error('Pattern library not loaded');
        }

        const scored = this.index.patterns.map(pattern => {
            let score = 0;

            // Staff count compatibility
            if (requirements.staffCount) {
                const minStaff = pattern.teams * 2; // Assume minimum 2 per team
                const idealStaff = pattern.teams * 4; // Assume ideal 4 per team

                if (requirements.staffCount >= minStaff && requirements.staffCount <= idealStaff * 1.5) {
                    score += 30;
                } else if (requirements.staffCount >= minStaff) {
                    score += 15;
                }
            }

            // Industry match
            if (requirements.industries) {
                const matchingIndustries = requirements.industries.filter(ind =>
                    pattern.industry && pattern.industry.includes(ind)
                );
                score += matchingIndustries.length * 20;
            }

            // Region preference
            if (requirements.region && pattern.region === requirements.region) {
                score += 15;
            }

            // 24/7 requirement
            if (requirements.needs24x7) {
                const is24x7 = this.index.categories['24/7']?.includes(pattern.id);
                if (is24x7) score += 25;
            }

            // Featured patterns get bonus
            if (pattern.featured) {
                score += 10;
            }

            return {
                ...pattern,
                recommendationScore: score
            };
        });

        // Sort by score descending
        return scored
            .filter(p => p.recommendationScore > 0)
            .sort((a, b) => b.recommendationScore - a.recommendationScore);
    }

    /**
     * Apply a pattern to staff roster
     * @param {string} patternId - Pattern to apply
     * @param {Array<Object>} staffList - Staff to assign
     * @param {Date} startDate - Pattern start date
     * @param {number} weeks - Number of weeks to generate
     * @returns {Promise<Array<Object>>} Generated shifts
     */
    async applyPattern(patternId, staffList, startDate, weeks = 4) {
        const pattern = await this.loadPattern(patternId);
        if (!pattern) {
            throw new Error(`Pattern ${patternId} not found or failed to load`);
        }

        return pattern.applyToStaff(staffList, startDate, weeks);
    }

    /**
     * Get all available categories
     * @returns {Array<string>} Category names
     */
    getCategories() {
        if (!this.index) return [];
        return Object.keys(this.index.categories);
    }

    /**
     * Get all available regions
     * @returns {Array<string>} Region codes
     */
    getRegions() {
        if (!this.index) return [];
        return Object.keys(this.index.regions);
    }

    /**
     * Get library statistics
     * @returns {Object} Statistics about the pattern library
     */
    getStats() {
        if (!this.index) {
            return { loaded: false, totalPatterns: 0 };
        }

        return {
            loaded: this.loaded,
            totalPatterns: this.index.patterns.length,
            patternsLoaded: this.patterns.size,
            categories: this.getCategories().length,
            regions: this.getRegions().length,
            featured: this.getFeatured().length,
            version: this.index.version,
            lastUpdated: this.index.lastUpdated
        };
    }
}

// Export for use in browser or Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PatternEngine;
}

// Expose to window for browser usage
if (typeof window !== 'undefined') {
    window.PatternEngine = PatternEngine;
}
