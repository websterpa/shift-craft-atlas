/**
 * Mapping Unit Tests
 */

const { AuditRunner, expect } = window;

AuditRunner.register('Mapping Helpers', 'toCode(Standard)', () => {
    expect(window.ShiftMapping.toCode('Early')).toBe('E');
    expect(window.ShiftMapping.toCode('Late')).toBe('L');
    expect(window.ShiftMapping.toCode('Night')).toBe('N');
    expect(window.ShiftMapping.toCode('Rest')).toBe('R');
});

AuditRunner.register('Mapping Helpers', 'toCode(Legacy)', () => {
    expect(window.ShiftMapping.toCode('E')).toBe('E');
    expect(window.ShiftMapping.toCode('12h Day')).toBe('D');
    expect(window.ShiftMapping.toCode('12h Night')).toBe('N'); // Or N12 based on mapping logic
});

AuditRunner.register('Mapping Helpers', 'toCode(Case Insensitive)', () => {
    expect(window.ShiftMapping.toCode('early')).toBe('E');
    expect(window.ShiftMapping.toCode('LATE')).toBe('L');
});

AuditRunner.register('Mapping Helpers', 'toLogical(Standard)', () => {
    expect(window.ShiftMapping.toLogical('E')).toBe('Early');
    expect(window.ShiftMapping.toLogical('X')).toBe('Shift'); // Fallback
});
