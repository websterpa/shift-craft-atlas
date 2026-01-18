/**
 * Audit Runner
 * Orchestrates the execution of unit tests and roster health checks.
 */

window.AuditRunner = {
    tests: [],

    register(suiteName, testName, fn) {
        this.tests.push({ suite: suiteName, name: testName, fn: fn });
    },

    log(msg, type = 'info') {
        const consoleEl = document.getElementById('test-console');
        const line = document.createElement('div');
        line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        line.style.color = type === 'error' ? 'var(--accent-red)' : (type === 'success' ? 'var(--accent-green)' : 'inherit');
        consoleEl.appendChild(line);
        consoleEl.scrollTop = consoleEl.scrollHeight;
    },

    async runAll() {
        this.log('Starting Diagnostic Run...', 'info');
        const container = document.getElementById('unit-tests-container');
        container.innerHTML = '';

        let passed = 0;
        let failed = 0;
        const suites = {};

        // Group by suite
        this.tests.forEach(t => {
            if (!suites[t.suite]) suites[t.suite] = [];
            suites[t.suite].push(t);
        });

        for (const [suiteName, tests] of Object.entries(suites)) {
            const groupEl = document.createElement('div');
            groupEl.className = 'test-group';
            groupEl.innerHTML = `<div class="test-group-title">${suiteName}</div>`;

            for (const test of tests) {
                const itemEl = document.createElement('div');
                itemEl.className = 'test-item';
                itemEl.innerHTML = `<span>${test.name}</span><span class="status-badge status-pending">RUNNING</span>`;
                groupEl.appendChild(itemEl);

                try {
                    await test.fn();
                    itemEl.querySelector('.status-badge').className = 'status-badge status-pass';
                    itemEl.querySelector('.status-badge').textContent = 'PASS';
                    passed++;
                    this.log(`${suiteName}: ${test.name} passed`, 'success');
                } catch (e) {
                    itemEl.querySelector('.status-badge').className = 'status-badge status-fail';
                    itemEl.querySelector('.status-badge').textContent = 'FAIL';
                    failed++;
                    this.log(`${suiteName}: ${test.name} failed - ${e.message}`, 'error');
                    console.error(e);
                }
            }
            container.appendChild(groupEl);
        }

        // Run Data Audit
        await this.runRosterAudit();

        this.log(`Run Complete. Passed: ${passed}, Failed: ${failed}`, failed > 0 ? 'error' : 'success');
    },

    async runRosterAudit() {
        this.log('Auditing Local Roster Data...', 'info');
        const container = document.getElementById('roster-audit-container');
        container.innerHTML = '';

        const appendResult = (label, status, msg) => {
            const el = document.createElement('div');
            el.className = 'test-item';
            const statusClass = status === 'OK' ? 'status-pass' : (status === 'WARN' ? 'status-warn' : 'status-fail');
            el.innerHTML = `
                <div style="display:flex;flex-direction:column;">
                    <span style="font-weight:600">${label}</span>
                    <span style="font-size:0.8rem;color:var(--text-muted)">${msg}</span>
                </div>
                <span class="status-badge ${statusClass}">${status}</span>
            `;
            container.appendChild(el);
        };

        try {
            // Initialize Repo
            const repo = window.Repository.create('local');
            const shifts = await repo.loadAssignments({});
            const staff = await repo.loadStaff({ siteId: 'default' });

            if (shifts.length === 0) {
                appendResult('Data Existence', 'WARN', 'No shifts found in storage.');
                return;
            }
            appendResult('Data Existence', 'OK', `Found ${shifts.length} shifts and ${staff.length} staff.`);

            // Time Coverage Check (Current Month)
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const currentMonthShifts = shifts.filter(s => s.date.startsWith(`${year}-${month}`));

            if (currentMonthShifts.length === 0) {
                appendResult('Monthly Coverage', 'WARN', `No shifts found for current month (${year}-${month}).`);
            } else {
                appendResult('Monthly Coverage', 'OK', `Found ${currentMonthShifts.length} shifts for ${year}-${month}.`);

                // Check Critical Codes
                const nightShifts = currentMonthShifts.filter(s => {
                    const code = window.ShiftMapping.toCode(s.shiftType || s.shift_code || '');
                    return code === 'N' || code === 'N12';
                });

                if (nightShifts.length === 0) {
                    appendResult('Night Coverage', 'FAIL', 'CRITICAL: No Night shifts assigned this month!');
                } else {
                    appendResult('Night Coverage', 'OK', `Found ${nightShifts.length} Night shifts.`);
                }
            }

            // Check for Invalid Times
            const invalidTimes = shifts.filter(s => !s.start || !s.end || s.start === s.end);
            if (invalidTimes.length > 0) {
                appendResult('Data Integrity', 'FAIL', `Found ${invalidTimes.length} shifts with invalid start/end times.`);
            } else {
                appendResult('Data Integrity', 'OK', 'All shift timings valid.');
            }

        } catch (e) {
            this.log('Audit Error: ' + e.message, 'error');
        }
    }
};

// Bind Button
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('run-btn').onclick = () => window.AuditRunner.runAll();
});

// Test Assert Helper
window.expect = (received) => ({
    toBe: (expected) => {
        if (received !== expected) throw new Error(`Expected '${expected}' but got '${received}'`);
    },
    toEqual: (expected) => {
        if (JSON.stringify(received) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(received)}`);
    },
    toBeTruthy: () => {
        if (!received) throw new Error(`Expected truthy but got ${received}`);
    },
    toBeGreaterThan: (n) => {
        if (received <= n) throw new Error(`Expected > ${n} but got ${received}`);
    }
});
