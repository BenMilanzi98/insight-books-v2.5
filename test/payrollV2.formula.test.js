import { describe, expect, it } from 'vitest';
import { evaluateFormula, validateFormulaExpression } from '../lib/payrollV2/formula.js';

describe('payrollV2 formula (no eval)', () => {
  it('evaluates arithmetic with context refs', () => {
    expect(evaluateFormula('basicSalary + overtimePay', { basicSalary: 100, overtimePay: 25 })).toBe(
      125
    );
  });

  it('supports min/max', () => {
    expect(evaluateFormula('min(a, b)', { a: 10, b: 3 })).toBe(3);
    expect(evaluateFormula('max(a, b)', { a: 10, b: 3 })).toBe(10);
  });

  it('evaluates AST', () => {
    expect(
      evaluateFormula(
        { op: 'add', args: [{ op: 'ref', name: 'x' }, { op: 'lit', value: 2 }] },
        { x: 5 }
      )
    ).toBe(7);
  });

  it('rejects unknown identifiers', () => {
    expect(() => evaluateFormula('unknownThing', {})).toThrow(/Unknown identifier/);
  });

  it('validateFormulaExpression reports errors', () => {
    const bad = validateFormulaExpression('a +', ['a']);
    expect(bad.ok).toBe(false);
  });
});
