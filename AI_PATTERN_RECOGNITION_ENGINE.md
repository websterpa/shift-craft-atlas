# AI Shift Pattern Recognition Engine

## 🤖 Overview

An **AI-powered system** that analyzes uploaded shift documents (PDF, Excel, images, Word) and automatically:
1. Extracts shift data
2. Detects rotation patterns
3. Identifies teams and cycles
4. Replicates the pattern for future use

---

## 🎯 Use Cases

### Scenario 1: Hospital Manager
- **Has**: 6-month PDF roster from previous hospital
- **Wants**: Apply same pattern to new team
- **Result**: AI extracts 2-week rotation, applies to new staff

### Scenario 2: Retail Manager
- **Has**: Excel spreadsheet with complex shift codes
- **Wants**: Understand the underlying pattern
- **Result**: AI identifies weekly cycle, suggests optimizations

### Scenario 3: Factory Supervisor
- **Has**: Photo of printed roster on wall
- **Wants**: Digitize into system
- **Result**: OCR + AI converts to digital shifts

---

## 📥 Supported Input Formats

| Format | Method | Complexity | Accuracy |
|--------|--------|------------|----------|
| **Excel (.xlsx, .csv)** | Direct parsing | Low | 95%+ |
| **PDF** | PDF.js + text extraction | Medium | 85%+ |
| **Images (JPG, PNG)** | Tesseract OCR + NLP | High | 75%+ |
| **Word (.docx)** | XML parsing | Low | 90%+ |
| **Screenshot** | OCR + structure detection | High | 70%+ |

---

## 🧠 AI Architecture

### Multi-Stage Pipeline

```
┌──────────────────────────────────────────────────────┐
│                 STAGE 1: EXTRACTION                   │
├──────────────────────────────────────────────────────┤
│  Input → Format Detection → Parsing/OCR → Raw Text   │
└────────────────────┬─────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────┐
│                 STAGE 2: NORMALIZATION                │
├──────────────────────────────────────────────────────┤
│  Raw Text → NLP Cleaning → Entity Recognition        │
│  • Staff names                                        │
│  • Dates/Days                                         │
│  • Time ranges                                        │
│  • Shift codes (M/A/N/E/L)                           │
└────────────────────┬─────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────┐
│                 STAGE 3: PATTERN DETECTION            │
├──────────────────────────────────────────────────────┤
│  Structured Data → Algorithm Analysis                 │
│  • Cycle length detection                             │
│  • Rotation identification                            │
│  • Team count inference                               │
│  • Anomaly detection                                  │
└────────────────────┬─────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────┐
│                 STAGE 4: VALIDATION                   │
├──────────────────────────────────────────────────────┤
│  Pattern → User Review → Confidence Score             │
│  • Preview visualization                              │
│  • Conflict warnings                                  │
│  • Compliance check                                   │
└────────────────────┬─────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────┐
│                 STAGE 5: REPLICATION                  │
├──────────────────────────────────────────────────────┤
│  Confirmed Pattern → Apply to Roster → Save Template │
└──────────────────────────────────────────────────────┘
```

---

## 🔧 Implementation

### Stage 1: Document Parser

```javascript
class DocumentParser {
    /**
     * Detect document type and route to appropriate parser
     */
    static async parse(file) {
        const extension = file.name.split('.').pop().toLowerCase();
        
        switch (extension) {
            case 'xlsx':
            case 'csv':
                return await this.parseSpreadsheet(file);
            case 'pdf':
                return await this.parsePDF(file);
            case 'jpg':
            case 'jpeg':
            case 'png':
                return await this.parseImage(file);
            case 'docx':
                return await this.parseWord(file);
            default:
                throw new Error(`Unsupported format: ${extension}`);
        }
    }

    /**
     * Parse Excel/CSV - Direct data extraction
     */
    static async parseSpreadsheet(file) {
        // Using SheetJS (xlsx library)
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        
        return {
            type: 'spreadsheet',
            raw: jsonData,
            confidence: 0.95
        };
    }

    /**
     * Parse PDF - Text extraction
     */
    static async parsePDF(file) {
        // Using PDF.js
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n';
        }
        
        return {
            type: 'pdf',
            raw: fullText,
            confidence: 0.85
        };
    }

    /**
     * Parse Image - OCR with Tesseract
     */
    static async parseImage(file) {
        const { data: { text } } = await Tesseract.recognize(
            file,
            'eng',
            {
                logger: m => console.log(m)
            }
        );
        
        return {
            type: 'image',
            raw: text,
            confidence: 0.75
        };
    }
}
```

---

### Stage 2: Data Normalizer (NLP Layer)

```javascript
class ShiftDataNormalizer {
    static readonly SHIFT_CODES = {
        morning: ['M', 'E', 'AM', 'Early', 'Morn', '0600', '06:00'],
        afternoon: ['A', 'L', 'PM', 'Late', 'Aft', '1400', '14:00'],
        night: ['N', 'Night', 'ND', '2200', '22:00', 'Noc'],
        off: ['X', 'OFF', 'Rest', '-', '/', 'Leave']
    };

    /**
     * Extract structured shift data from raw text/data
     */
    static normalize(rawData) {
        const shifts = [];
        
        if (Array.isArray(rawData)) {
            // Spreadsheet data
            return this.normalizeSpreadsheet(rawData);
        } else if (typeof rawData === 'string') {
            // Text data (PDF/OCR)
            return this.normalizeText(rawData);
        }
    }

    /**
     * Process spreadsheet grid
     */
    static normalizeSpreadsheet(grid) {
        const normalized = [];
        
        // Detect header row (contains dates/days)
        const headerRow = this.detectHeaderRow(grid);
        const staffColumn = this.detectStaffColumn(grid);
        
        // Extract dates from header
        const dates = this.extractDates(grid[headerRow]);
        
        // Process each staff row
        for (let rowIdx = headerRow + 1; rowIdx < grid.length; rowIdx++) {
            const row = grid[rowIdx];
            const staffName = row[staffColumn];
            
            if (!staffName || staffName.trim() === '') continue;
            
            // Process each day
            dates.forEach((date, colIdx) => {
                const cellValue = row[colIdx];
                const shiftInfo = this.parseShiftCell(cellValue);
                
                if (shiftInfo) {
                    normalized.push({
                        staffName: staffName.trim(),
                        date: date,
                        ...shiftInfo
                    });
                }
            });
        }
        
        return normalized;
    }

    /**
     * Parse individual cell value (e.g., "M 06:00-14:00" or "N" or "9-5")
     */
    static parseShiftCell(cellValue) {
        if (!cellValue) return null;
        
        const str = String(cellValue).trim();
        
        // Check if Off day
        if (this.SHIFT_CODES.off.some(code => 
            str.toUpperCase().includes(code)
        )) {
            return null; // Skip off days
        }
        
        // Try to extract time range (e.g., "09:00-17:00" or "9-5")
        const timeMatch = str.match(/(\d{1,2}):?(\d{2})?\s*[-–]\s*(\d{1,2}):?(\d{2})?/);
        
        if (timeMatch) {
            const [_, startHour, startMin = '00', endHour, endMin = '00'] = timeMatch;
            return {
                start: `${startHour.padStart(2, '0')}:${startMin}`,
                end: `${endHour.padStart(2, '0')}:${endMin}`,
                shiftType: this.inferShiftType(`${startHour}:${startMin}`)
            };
        }
        
        // Check for shift codes
        for (const [type, codes] of Object.entries(this.SHIFT_CODES)) {
            if (codes.some(code => str.toUpperCase().includes(code))) {
                return this.getDefaultTimes(type);
            }
        }
        
        return null;
    }

    /**
     * Infer shift type from start time
     */
    static inferShiftType(startTime) {
        const hour = parseInt(startTime.split(':')[0]);
        
        if (hour >= 5 && hour < 13) return 'Morning';
        if (hour >= 13 && hour < 21) return 'Afternoon';
        return 'Night';
    }

    /**
     * Get default shift times based on type
     */
    static getDefaultTimes(type) {
        const defaults = {
            morning: { start: '06:00', end: '14:00', shiftType: 'Morning' },
            afternoon: { start: '14:00', end: '22:00', shiftType: 'Afternoon' },
            night: { start: '22:00', end: '06:00', shiftType: 'Night' },
            off: null
        };
        return defaults[type];
    }

    /**
     * Detect which row contains dates/days
     */
    static detectHeaderRow(grid) {
        for (let i = 0; i < Math.min(5, grid.length); i++) {
            const row = grid[i];
            const dateCount = row.filter(cell => 
                this.looksLikeDate(cell) || this.looksLikeDay(cell)
            ).length;
            
            if (dateCount >= 5) return i; // Likely header if 5+ date-like cells
        }
        return 0; // Default to first row
    }

    static looksLikeDate(value) {
        if (!value) return false;
        const str = String(value);
        return /\d{1,2}[\/\-]\d{1,2}/.test(str) || 
               /\d{4}-\d{2}-\d{2}/.test(str) ||
               /Mon|Tue|Wed|Thu|Fri|Sat|Sun/i.test(str);
    }

    static looksLikeDay(value) {
        if (!value) return false;
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        return days.some(day => String(value).toLowerCase().includes(day.toLowerCase()));
    }

    static detectStaffColumn(grid) {
        // Usually first column, but check for "Name" or "Staff" header
        const headerRow = grid[0];
        for (let i = 0; i < headerRow.length; i++) {
            const cell = String(headerRow[i]).toLowerCase();
            if (cell.includes('name') || cell.includes('staff') || cell.includes('employee')) {
                return i;
            }
        }
        return 0; // Default to first column
    }

    /**
     * Extract dates from header row
     */
    static extractDates(headerRow) {
        return headerRow.map((cell, idx) => {
            if (idx === 0) return null; // Skip staff column
            
            // Try to parse as date
            const parsed = this.parseDate(cell);
            return parsed || `Day ${idx}`;
        }).filter(Boolean);
    }

    static parseDate(value) {
        if (!value) return null;
        
        // Try various formats
        const str = String(value);
        
        // ISO format: 2025-12-20
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
        
        // UK format: 20/12/2025
        const ukMatch = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (ukMatch) {
            const [_, day, month, year] = ukMatch;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        
        return null;
    }
}
```

---

### Stage 3: Pattern Detection Engine

```javascript
class PatternDetectionEngine {
    /**
     * Analyze normalized shifts and detect rotation pattern
     */
    static analyzePattern(normalizedShifts) {
        // Group shifts by staff member
        const staffShifts = this.groupByStaff(normalizedShifts);
        
        // Detect cycle length
        const cycleLength = this.detectCycleLength(staffShifts);
        
        // Identify rotation pattern
        const rotationPattern = this.extractRotation(staffShifts, cycleLength);
        
        // Determine team count
        const teamCount = this.inferTeamCount(staffShifts, rotationPattern);
        
        // Calculate stats
        const stats = this.calculateStats(normalizedShifts);
        
        return {
            cycleLength,
            rotationPattern,
            teamCount,
            stats,
            confidence: this.calculateConfidence(staffShifts, cycleLength)
        };
    }

    /**
     * Detect repeating cycle length (e.g., 7, 8, 14, 28 days)
     */
    static detectCycleLength(staffShifts) {
        const staffId = Object.keys(staffShifts)[0]; // Use first staff as reference
        const shifts = staffShifts[staffId].sort((a, b) => 
            new Date(a.date) - new Date(b.date)
        );
        
        if (shifts.length < 14) {
            return shifts.length; // Not enough data, assume entire period is one cycle
        }
        
        // Extract sequence of shift types
        const sequence = shifts.map(s => this.shiftTypeToCode(s.shiftType));
        
        // Try common cycle lengths
        const commonCycles = [7, 8, 14, 21, 28];
        
        for (const cycleLen of commonCycles) {
            if (this.sequenceRepeats(sequence, cycleLen)) {
                return cycleLen;
            }
        }
        
        // Auto-detect using autocorrelation
        return this.autoDetectCycle(sequence);
    }

    /**
     * Check if sequence repeats with given period
     */
    static sequenceRepeats(sequence, period) {
        if (sequence.length < period * 2) return false;
        
        const firstCycle = sequence.slice(0, period);
        const secondCycle = sequence.slice(period, period * 2);
        
        // Check similarity (allow 20% mismatch for noise)
        let matches = 0;
        for (let i = 0; i < period; i++) {
            if (firstCycle[i] === secondCycle[i]) matches++;
        }
        
        return (matches / period) >= 0.8;
    }

    /**
     * Extract rotation pattern from shifts
     */
    static extractRotation(staffShifts, cycleLength) {
        const rotations = [];
        
        for (const staffId in staffShifts) {
            const shifts = staffShifts[staffId].sort((a, b) => 
                new Date(a.date) - new Date(b.date)
            );
            
            // Take first cycle as pattern
            const pattern = shifts
                .slice(0, cycleLength)
                .map(s => this.shiftTypeToCode(s.shiftType));
            
            rotations.push(pattern);
        }
        
        // Group identical patterns (same team)
        return this.deduplicateRotations(rotations);
    }

    /**
     * Convert shift type to single letter code
     */
    static shiftTypeToCode(shiftType) {
        const map = {
            'Morning': 'M',
            'Afternoon': 'A',
            'Night': 'N',
            'Day': 'D',
            'Off': 'X'
        };
        return map[shiftType] || 'X';
    }

    /**
     * Group identical rotation patterns
     */
    static deduplicateRotations(rotations) {
        const unique = [];
        const seen = new Set();
        
        for (const rotation of rotations) {
            const key = rotation.join('');
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(rotation);
            }
        }
        
        return unique;
    }

    /**
     * Infer number of teams based on rotation patterns
     */
    static inferTeamCount(staffShifts, rotationPattern) {
        // If we have distinct rotation patterns, that's the team count
        if (rotationPattern.length > 1) {
            return rotationPattern.length;
        }
        
        // Otherwise, count staff and assume equal team sizes
        const staffCount = Object.keys(staffShifts).length;
        
        // Common team counts for shift patterns
        const commonTeamCounts = [2, 3, 4, 5, 6];
        
        for (const teamCount of commonTeamCounts) {
            if (staffCount % teamCount === 0) {
                return teamCount;
            }
        }
        
        return 1; // Default to single team
    }

    /**
     * Calculate pattern statistics
     */
    static calculateStats(shifts) {
        let totalHours = 0;
        const shiftTypeCounts = {};
        
        shifts.forEach(shift => {
            const duration = this.calculateDuration(shift.start, shift.end);
            totalHours += duration;
            
            shiftTypeCounts[shift.shiftType] = 
                (shiftTypeCounts[shift.shiftType] || 0) + 1;
        });
        
        return {
            totalShifts: shifts.length,
            totalHours,
            averageHoursPerShift: totalHours / shifts.length,
            shiftTypeDistribution: shiftTypeCounts
        };
    }

    /**
     * Calculate duration between start and end times
     */
    static calculateDuration(start, end) {
        const [sh, sm] = start.split(':').map(Number);
        let [eh, em] = end.split(':').map(Number);
        
        if (eh < sh || (eh === sh && em < sm)) {
            eh += 24; // Next day
        }
        
        return ((eh * 60 + em) - (sh * 60 + sm)) / 60;
    }

    /**
     * Calculate confidence score (0-1)
     */
    static calculateConfidence(staffShifts, cycleLength) {
        const staffCount = Object.keys(staffShifts).length;
        
        let confidence = 0.5; // Base confidence
        
        // More staff = higher confidence
        if (staffCount >= 10) confidence += 0.2;
        else if (staffCount >= 5) confidence += 0.1;
        
        // Standard cycle length = higher confidence
        if ([7, 8, 14, 28].includes(cycleLength)) confidence += 0.2;
        
        // Check pattern consistency across staff
        const patterns = Object.values(staffShifts).map(shifts => {
            return shifts.slice(0, cycleLength)
                .map(s => this.shiftTypeToCode(s.shiftType))
                .join('');
        });
        
        const uniquePatterns = new Set(patterns).size;
        const teamRatio = uniquePatterns / staffCount;
        
        if (teamRatio <= 0.5) confidence += 0.1; // Good team structure
        
        return Math.min(confidence, 1.0);
    }

    static groupByStaff(shifts) {
        return shifts.reduce((acc, shift) => {
            if (!acc[shift.staffName]) {
                acc[shift.staffName] = [];
            }
            acc[shift.staffName].push(shift);
            return acc;
        }, {});
    }

    /**
     * Auto-detect cycle using autocorrelation
     */
    static autoDetectCycle(sequence) {
        // Simplified autocorrelation - check for repeating subsequences
        for (let period = 7; period <= Math.floor(sequence.length / 2); period++) {
            let matchScore = 0;
            const iterations = Math.floor(sequence.length / period);
            
            for (let i = 0; i < period; i++) {
                const values = [];
                for (let j = 0; j < iterations; j++) {
                    values.push(sequence[i + j * period]);
                }
                
                // Check if all values are the same
                if (new Set(values).size === 1) matchScore++;
            }
            
            if (matchScore / period >= 0.7) return period;
        }
        
        return 7; // Default to weekly if no pattern found
    }
}
```

---

### Stage 4: User Preview & Validation

```javascript
class PatternPreviewUI {
    /**
     * Show detected pattern to user for confirmation
     */
    static showPreview(detectedPattern, normalizedShifts) {
        const modal = document.getElementById('pattern-preview-modal');
        
        // Render pattern visualization
        const viz = document.getElementById('pattern-visualization');
        viz.innerHTML = this.renderPatternViz(detectedPattern);
        
        // Show confidence score
        document.getElementById('confidence-score').textContent = 
            `${(detectedPattern.confidence * 100).toFixed(0)}%`;
        
        // Show stats
        document.getElementById('pattern-stats').innerHTML = `
            <div class="stat">
                <label>Cycle Length:</label>
                <value>${detectedPattern.cycleLength} days</value>
            </div>
            <div class="stat">
                <label>Teams:</label>
                <value>${detectedPattern.teamCount}</value>
            </div>
            <div class="stat">
                <label>Total Shifts:</label>
                <value>${normalizedShifts.length}</value>
            </div>
            <div class="stat">
                <label>Avg Hours/Week:</label>
                <value>${detectedPattern.stats.averageHoursPerShift * 5}h</value>
            </div>
        `;
        
        modal.classList.add('active');
        
        return new Promise((resolve, reject) => {
            document.getElementById('confirm-pattern-btn').onclick = () => {
                modal.classList.remove('active');
                resolve(true);
            };
            
            document.getElementById('reject-pattern-btn').onclick = () => {
                modal.classList.remove('active');
                reject('User rejected pattern');
            };
        });
    }

    static renderPatternViz(pattern) {
        let html = '<div class="pattern-grid">';
        
        pattern.rotationPattern.forEach((teamRotation, teamIdx) => {
            html += `<div class="team-row">`;
            html += `<div class="team-label">Team ${teamIdx + 1}</div>`;
            
            teamRotation.forEach(shiftCode => {
                const color = {
                    'M': '#fbbf24',
                    'A': '#f97316',
                    'N': '#3b82f6',
                    'X': '#94a3b8'
                }[shiftCode] || '#6b7280';
                
                html += `<div class="shift-block" style="background: ${color}">${shiftCode}</div>`;
            });
            
            html += `</div>`;
        });
        
        html += '</div>';
        return html;
    }
}
```

---

### Stage 5: Apply Pattern

```javascript
class PatternApplicator {
    /**
     * Apply detected pattern to current roster
     */
    static applyPattern(app, detectedPattern, normalizedShifts, startDate) {
        // Create mapping: old staff names → new staff IDs
        const staffMapping = this.mapStaffNames(
            [...new Set(normalizedShifts.map(s => s.staffName))],
            app.staff
        );
        
        const newShifts = [];
        const errors = [];
        
        normalizedShifts.forEach(shift => {
            const staffId = staffMapping[shift.staffName];
            
            if (!staffId) {
                errors.push(`Staff not found: ${shift.staffName}`);
                return;
            }
            
            // Adjust date to start from new start date
            const adjustedDate = this.adjustDate(shift.date, startDate);
            
            newShifts.push({
                id: `sh-${Date.now()}-${Math.random()}`,
                staffId,
                date: adjustedDate,
                start: shift.start,
                end: shift.end,
                shiftType: shift.shiftType,
                source: 'AI-detected'
            });
        });
        
        // Add to app
        app.shifts.push(...newShifts);
        app.saveToStorage();
        app.renderTableBody();
        app.updateStats();
        
        return {
            added: newShifts.length,
            errors
        };
    }

    /**
     * Map imported staff names to existing staff IDs
     */
    static mapStaffNames(importedNames, existingStaff) {
        const mapping = {};
        
        importedNames.forEach((importedName, idx) => {
            // Try exact match first
            let match = existingStaff.find(s => 
                s.name.toLowerCase() === importedName.toLowerCase()
            );
            
            // Try fuzzy match
            if (!match) {
                match = existingStaff.find(s => 
                    this.fuzzyMatch(s.name, importedName)
                );
            }
            
            // Auto-assign if staff count matches
            if (!match && existingStaff[idx]) {
                match = existingStaff[idx];
            }
            
            if (match) {
                mapping[importedName] = match.id;
            }
        });
        
        return mapping;
    }

    static fuzzyMatch(str1, str2) {
        // Simple Levenshtein-like similarity
        const s1 = str1.toLowerCase();
        const s2 = str2.toLowerCase();
        
        if (s1.includes(s2) || s2.includes(s1)) return true;
        
        // Check if first or last name matches
        const words1 = s1.split(' ');
        const words2 = s2.split(' ');
        
        return words1.some(w1 => words2.some(w2 => w1 === w2));
    }

    static adjustDate(originalDate, newStartDate) {
        // Keep the same day offset from start
        const original = new Date(originalDate);
        const newStart = new Date(newStartDate);
        
        // ... date calculation logic ...
        
        return newStart.toISOString().split('T')[0];
    }
}
```

---

## 🎨 User Interface

### Upload & Analysis Flow

```html
<!-- AI Pattern Upload Modal -->
<div id="ai-pattern-upload-modal" class="modal-overlay">
    <div class="modal-card" style="max-width: 800px;">
        <h2>🤖 AI Pattern Recognition</h2>
        <p class="text-muted">Upload your existing roster document and let AI analyze it</p>
        
        <!-- File Upload -->
        <div class="upload-zone" id="pattern-dropzone">
            <i data-lucide="upload-cloud" style="width: 48px; height: 48px;"></i>
            <p><strong>Drag & drop</strong> or click to upload</p>
            <p class="text-muted">
                Supports: Excel, CSV, PDF, Images (JPG, PNG), Word
            </p>
            <input type="file" id="pattern-file-input" hidden 
                   accept=".xlsx,.csv,.pdf,.jpg,.jpeg,.png,.docx">
        </div>
        
        <!-- Analysis Progress -->
        <div id="analysis-progress" style="display: none;">
            <div class="progress-steps">
                <div class="step active" data-step="1">
                    <i data-lucide="file-text"></i>
                    <span>Extracting</span>
                </div>
                <div class="step" data-step="2">
                    <i data-lucide="brain"></i>
                    <span>Analyzing</span>
                </div>
                <div class="step" data-step="3">
                    <i data-lucide="check-circle"></i>
                    <span>Complete</span>
                </div>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" id="progress-fill"></div>
            </div>
            <p id="progress-message">Extracting shift data...</p>
        </div>
        
        <!-- Results Preview -->
        <div id="pattern-results" style="display: none;">
            <div class="results-header">
                <h3>✅ Pattern Detected</h3>
                <span class="confidence-badge" id="confidence-badge">
                    95% Confidence
                </span>
            </div>
            
            <div class="pattern-summary" id="pattern-summary">
                <!-- Populated dynamically -->
            </div>
            
            <div class="pattern-preview" id="pattern-preview-viz">
                <!-- Visual pattern grid -->
            </div>
            
            <div class="staff-mapping" id="staff-mapping">
                <h4>Staff Mapping</h4>
                <p class="text-muted">Match imported names to your staff</p>
                <!-- Dynamic mapping UI -->
            </div>
        </div>
        
        <!-- Actions -->
        <div class="modal-actions">
            <button id="apply-ai-pattern-btn" class="btn btn-primary" disabled>
                <i data-lucide="check"></i>
                Apply Pattern
            </button>
            <button id="save-as-template-btn" class="btn btn-outline" disabled>
                <i data-lucide="save"></i>
                Save as Template
            </button>
            <button id="close-ai-modal" class="btn btn-ghost">
                Cancel
            </button>
        </div>
    </div>
</div>
```

---

## 🚀 Implementation Roadmap

### Phase 1: MVP (Weeks 1-3)
- [ ] Excel/CSV parser
- [ ] Basic pattern detection (cycle length)
- [ ] Preview UI
- [ ] Apply to roster

### Phase 2: OCR (Weeks 4-6)
- [ ] PDF text extraction
- [ ] Tesseract OCR for images
- [ ] Enhanced data cleaning
- [ ] Fuzzy staff name matching

### Phase 3: Advanced AI (Weeks 7-10)
- [ ] LLM integration (OpenAI/Gemini) for complex patterns
- [ ] Natural language shift descriptions
- [ ] Anomaly detection
- [ ] Pattern optimization suggestions

### Phase 4: Templates (Weeks 11-12)
- [ ] Save detected patterns as reusable templates
- [ ] Pattern library integration
- [ ] Version history
- [ ] Pattern sharing/export

---

## 📊 Accuracy Benchmarks

| Document Type | Expected Accuracy | Processing Time |
|---------------|-------------------|-----------------|
| Clean Excel/CSV | 95%+ | < 1s |
| Structured PDF | 85%+ | 2-5s |
| Handwritten Scan | 60-70% | 10-15s |
| Mixed Format | 75%+ | 3-8s |

---

## 🔮 Advanced Features (Future)

### 1. LLM-Powered Natural Language Understanding

```javascript
async function analyzeWithLLM(rawText) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-4',
            messages: [{
                role: 'system',
                content: `You are a shift pattern analyzer. Extract shift data from the provided roster text. 
                          Return JSON with: staffName, date, start, end, shiftType.`
            }, {
                role: 'user',
                content: rawText
            }],
            response_format: { type: 'json_object' }
        })
    });
    
    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
}
```

### 2. Multi-Language Support
- Detect language (English, Spanish, French, etc.)
- Translate shift codes
- Cultural pattern recognition

### 3. Confidence Indicators
- Highlight uncertain detections in yellow
- Allow manual override
- Learn from corrections

---

## 💡 Summary

The **AI Pattern Recognition Engine** transforms Shift Craft (Atlas) into an **intelligent scheduling assistant**:

✅ **Upload any roster format** (Excel, PDF, images)  
✅ **AI extracts shift data** automatically  
✅ **Detects rotation patterns** (cycle length, teams)  
✅ **Preview before applying** with confidence scores  
✅ **One-click replication** to your staff  
✅ **Save as template** for future use  

### Combined Power:
```
Pattern Library (pre-built) + AI Recognition (custom)
        ↓
Complete Pattern Solution
        ↓
Any roster, any format, instantly digitized
```

This would be a **killer differentiator** in the market! 🎯🚀
