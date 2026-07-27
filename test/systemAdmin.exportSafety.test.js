import { describe, it, expect } from 'vitest';
import { preventFormulaInjection } from '@/lib/admin/exportSafety';

describe('exportSafety.preventFormulaInjection', () => {
  it('prefixes formula-trigger characters', () => {
    expect(preventFormulaInjection('=1+1')).toBe("'=1+1");
    expect(preventFormulaInjection('+cmd')).toBe("'+cmd");
    expect(preventFormulaInjection('-2')).toBe("'-2");
    expect(preventFormulaInjection('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('leaves safe values unchanged', () => {
    expect(preventFormulaInjection('Ada Lovelace')).toBe('Ada Lovelace');
    expect(preventFormulaInjection('123')).toBe('123');
    expect(preventFormulaInjection('total=5')).toBe('total=5');
  });

  it('stringifies nullish as empty', () => {
    expect(preventFormulaInjection(null)).toBe('');
    expect(preventFormulaInjection(undefined)).toBe('');
  });
});
