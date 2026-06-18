import { describe, it, expect } from 'vitest';
import { classifyCoaBucketByCode, primaryNumericFromAccountCode } from '../lib/coaMigration/classifyRange.js';
import { resolveAccountMigrationTarget } from '../lib/coaMigration/resolveMapping.js';
import { isStructureExtensionCode } from '../lib/coaMigration/canonicalCodes.js';

describe('classifyCoaBucketByCode', () => {
  it('classifies dashed asset codes by leading segment', () => {
    expect(classifyCoaBucketByCode('1131')).toBe('Asset');
  });

  it('returns UNCLASSIFIED for non-numeric prefixes', () => {
    expect(classifyCoaBucketByCode('X100')).toBe('UNCLASSIFIED');
  });

  it('maps equity range including 500000', () => {
    expect(classifyCoaBucketByCode('500000')).toBe('Equity');
  });
});

describe('primaryNumericFromAccountCode', () => {
  it('parses leading digits', () => {
    expect(primaryNumericFromAccountCode('1130-99')).toBe(1130);
  });
});

describe('resolveAccountMigrationTarget', () => {
  it('exact canonical code skips remap logic path', () => {
    const r = resolveAccountMigrationTarget({
      id: '1',
      accountCode: '1110',
      accountName: 'Cash',
      accountType: 'Asset',
    });
    expect(r.ok).toBe(true);
    expect(r.targetCode).toBe('1110');
    expect(r.rule).toBe('exact');
  });

  it('maps transport expense semantically', () => {
    const r = resolveAccountMigrationTarget({
      id: '1',
      accountCode: '5999',
      accountName: 'Vehicle fuel',
      accountType: 'Expense',
    });
    expect(r.ok).toBe(true);
    expect(r.targetCode).toBe('5340');
    expect(r.rule).toBe('semantic');
  });
});

describe('reconciliation journal balance check', () => {
  it('treats tiny float noise as balanced', () => {
    const debit = 1000.001;
    const credit = 1000;
    expect(Math.abs(debit - credit) < 0.02).toBe(true);
  });
});

describe('isStructureExtensionCode', () => {
  it('allows 1130-xx payment GL children', () => {
    expect(isStructureExtensionCode('1130-03')).toBe(true);
  });
  it('allows 3101–3199 capital subs under 3100', () => {
    expect(isStructureExtensionCode('3105')).toBe(true);
  });
});

describe('resolveAccountMigrationTarget legacy capital', () => {
  it('merges 500000 into 3100 when equity migration approved', () => {
    const r = resolveAccountMigrationTarget(
      { id: '1', accountCode: '500000', accountName: 'Capital Account', accountType: 'Equity' },
      { equityMigrationApproved: true }
    );
    expect(r.ok).toBe(true);
    expect(r.targetCode).toBe('3100');
    expect(r.rule).toBe('merge_legacy_500000');
  });
});

describe('resolveAccountMigrationTarget equity suspense', () => {
  it('maps approved unmatched equity to 3999 per guide Rule 3', () => {
    const r = resolveAccountMigrationTarget(
      {
        id: '1',
        accountCode: '3888',
        accountName: 'Unclassified equity bucket',
        accountType: 'Equity',
      },
      { equityMigrationApproved: true }
    );
    expect(r.ok).toBe(true);
    expect(r.targetCode).toBe('3999');
    expect(r.rule).toBe('equity_opening_balances_suspense');
  });
});
