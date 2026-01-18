
import { test, describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

// Load Dependencies
const shiftMappingPath = path.join(process.cwd(), 'public/app/src/features/roster/ShiftMapping.js');
const shiftMappingCode = fs.readFileSync(shiftMappingPath, 'utf8');

const timeRangePath = path.join(process.cwd(), 'public/app/src/features/time/TimeRange.js');
const timeRangeCode = fs.readFileSync(timeRangePath, 'utf8');

const wizardStep2Path = path.join(process.cwd(), 'public/app/src/js/roster/wizard/WizardStep2.js');
const wizardStep2Code = fs.readFileSync(wizardStep2Path, 'utf8');

// Mock DOM
class MockElement {
    constructor(tagName) {
        this.tagName = tagName;
        this.children = [];
        this.attributes = {};
        this.style = {};
        this.value = '';
        this.checked = false;
        this.textContent = '';
        this.innerHTML = '';
        this.listeners = {};
    }

    appendChild(child) {
        this.children.push(child);
    }

    insertBefore(child, ref) {
        this.children.unshift(child); // Simple mock
    }

    addEventListener(event, handler) {
        this.listeners[event] = handler;
    }

    get firstChild() {
        return this.children[0];
    }
}

const mockDocument = {
    createElement: (tag) => new MockElement(tag)
};

// Sandbox
const sandbox = {
    window: {},
    console: console,
    document: mockDocument
};
vm.createContext(sandbox);

// Load Code
vm.runInContext(shiftMappingCode, sandbox);
vm.runInContext(timeRangeCode, sandbox);
vm.runInContext(wizardStep2Code, sandbox);

const WizardStep2 = sandbox.window.WizardStep2;

describe('WizardStep2 Component', () => {

    it('Renders inputs for each shift type in pattern', () => {
        const container = new MockElement('div');
        const config = {
            patternSequence: ['E', 'L', 'N', 'R', 'R'],
            requirements: {},
            shiftDefinitions: {}
        };
        const delegate = {
            calculateRequiredStaff: () => 5,
            getSelectedStaffCount: () => 3
        };

        const step2 = new WizardStep2(container, config, delegate);
        step2.render();

        // Expect 3 boxes (E, L, N). R is ignored.
        // The container children structure:
        // 1. Help Text (p)
        // 2. Box (E)
        // 3. Box (L)
        // 4. Box (N)
        // 5. Advice Box

        // Note: The MockElement doesn't parse innerHTML, but the component uses createElement for boxes.
        // It clears innerHTML first.

        const boxes = container.children.filter(c => c.className === 'wizard-box');
        assert.equal(boxes.length, 3, 'Should render 3 requirement boxes for E, L, N');

        // Check E Box
        const eBox = boxes[0]; // Assuming order keys (E, L, N, R, R) -> reduce -> keys E, L, N
        // reduce order depends on iteration. E first.

        // Find input in box
        // Structure: Label, Group(Input, Span)
        const group = eBox.children.find(c => c.className === 'wizard-input-group');
        const input = group.children.find(c => c.tagName === 'input');

        assert.equal(input.value, 1, 'Default value should be 1');

        // Test Interaction
        input.value = '5';
        input.listeners['change']({ target: input });

        assert.equal(config.requirements['E'], 5, 'Config should update on change');
    });

    it('Respects existing requirements configuration', () => {
        const container = new MockElement('div');
        const config = {
            patternSequence: ['D', 'N'],
            requirements: { 'D': 3, 'N': 2 },
            shiftDefinitions: {}
        };
        const delegate = { calculateRequiredStaff: () => 0, getSelectedStaffCount: () => 0 };

        const step2 = new WizardStep2(container, config, delegate);
        step2.render();

        const boxes = container.children.filter(c => c.className === 'wizard-box');
        assert.equal(boxes.length, 2);

        // Verify values
        // We can't guarantee order of D vs N easily without checking label
        // But we can check if we found inputs with values 3 and 2.
        const values = boxes.map(b => {
            const g = b.children.find(c => c.className === 'wizard-input-group');
            return parseInt(g.children.find(i => i.tagName === 'input').value);
        });

        assert.ok(values.includes(3));
        assert.ok(values.includes(2));
    });

    it('Updates advice text based on delegate calculation', () => {
        const container = new MockElement('div');
        const config = { patternSequence: ['E'], requirements: {} };
        const delegate = {
            calculateRequiredStaff: () => 42,
            getSelectedStaffCount: () => 0
        };

        const step2 = new WizardStep2(container, config, delegate);
        step2.render();

        const adviceBox = container.children.find(c => c.id === 'headcount-advice');
        const textP = adviceBox.children.find(c => c.id === 'headcount-advice-text');

        // innerHTML is set. mocking innerHTML setter is not automatic in simple mock
        // But logic is: this.adviceText.innerHTML = ...
        // Our mock element just stores it properly if simple field
        // Wait, MockElement innerHTML needs to be accessible.

        assert.match(textP.innerHTML, /42 Staff Members/, 'Advice should show required count');
    });

});
