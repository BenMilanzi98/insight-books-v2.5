import { describe, it, expect } from 'vitest';
import { validateCoaAccountCreationRules } from '../lib/coaAccountCreateRules.js';
import { accountsForCatchAllDropdown } from '../lib/coaSystemStructureTree.js';
import {
  isSystemExpenseStructureCode,
} from '../lib/systemExpenseCategoryCodes.js';
import {
  computeNextCustomExpenseCode,
  collectUsedCustomExpenseCodes,
} from '../lib/customExpenseRange.js';

describe('isSystemExpenseStructureCode', () => {
  it('includes standard codes, 5700 header, 5701–5899 custom leaves, and excludes arbitrary 56xx', () => {
    expect(isSystemExpenseStructureCode('5100')).toBe(true);
    expect(isSystemExpenseStructureCode('5700')).toBe(true);
    expect(isSystemExpenseStructureCode('5701')).toBe(true);
    expect(isSystemExpenseStructureCode('5899')).toBe(true);
    expect(isSystemExpenseStructureCode('5900')).toBe(true);
    expect(isSystemExpenseStructureCode('5605')).toBe(false);
    expect(isSystemExpenseStructureCode('57001')).toBe(false);
  });
});

describe('validateCoaAccountCreationRules (userOriginated Expense)', () => {
  it('accepts 5701 under parent 5700', () => {
    const r = validateCoaAccountCreationRules({
      accountCode: '5701',
      accountType: 'Expense',
      parentAccount: { accountCode: '5700', accountType: 'Expense' },
      userOriginated: true,
    });
    expect(r.ok).toBe(true);
  });

  it('rejects wrong parent for 5701', () => {
    const r = validateCoaAccountCreationRules({
      accountCode: '5701',
      accountType: 'Expense',
      parentAccount: { accountCode: '5000', accountType: 'Expense' },
      userOriginated: true,
    });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/5700/);
  });

  it('rejects 5650 for user-originated expense', () => {
    const r = validateCoaAccountCreationRules({
      accountCode: '5650',
      accountType: 'Expense',
      parentAccount: { accountCode: '5700', accountType: 'Expense' },
      userOriginated: true,
    });
    expect(r.ok).toBe(false);
  });
});

describe('accountsForCatchAllDropdown 5900', () => {
  it('excludes 5701–5899 from the 5900 bucket', () => {
    const rows = [
      { accountCode: '5701', accountType: 'Expense', currentBalance: 1 },
      { accountCode: '5950', accountType: 'Expense', currentBalance: 2 },
    ];
    const out = accountsForCatchAllDropdown(rows, '5900');
    expect(out.map((a) => a.accountCode)).toEqual(['5950']);
  });
});

describe('computeNextCustomExpenseCode', () => {
  it('returns lowest gap in 5701–5899', () => {
    expect(computeNextCustomExpenseCode(new Set(['5701', '5702']))).toBe('5703');
    expect(computeNextCustomExpenseCode(new Set())).toBe('5701');
  });
});

describe('collectUsedCustomExpenseCodes', () => {
  it('collects only 4-digit 5701–5899', () => {
    const used = collectUsedCustomExpenseCodes([
      { accountCode: '5701' },
      { code: '5899' },
      { accountCode: '5100' },
      { accountCode: '57001' },
    ]);
    expect([...used].sort()).toEqual(['5701', '5899']);
  });
});
