import { describe, it, expect } from 'vitest';
import {
  resolveReportingCurrency,
  scaleStatementAmounts,
  scaleTrialBalanceRow,
  extractIntercompanyBalances,
  computeIntercompanyElimination,
  applyEliminationToBalanceSheetTotals,
  harmonizedTrialBalanceKey,
  buildConsolidationMetadata,
} from '../lib/reportingEngine/consolidationEngine.js';
import {
  classifyIntercompanyAccount,
  resolveHarmonizedAccountCode,
} from '../lib/reportingEngine/harmonizedCoaMap.js';

describe('resolveReportingCurrency', () => {
  const currencyMap = new Map([
    ['t1', 'MWK'],
    ['t2', 'USD'],
  ]);

  it('uses explicit reporting currency when valid', () => {
    expect(resolveReportingCurrency(['t1', 't2'], 'USD', currencyMap)).toBe('USD');
  });

  it('falls back to primary tenant currency', () => {
    expect(resolveReportingCurrency(['t1', 't2'], null, currencyMap)).toBe('MWK');
  });

  it('defaults to MWK when no map entry', () => {
    expect(resolveReportingCurrency(['unknown'], null, new Map())).toBe('MWK');
  });
});

describe('scaleStatementAmounts', () => {
  it('scales numeric statement totals by FX rate', () => {
    const input = {
      totalRevenue: 1000,
      grossProfit: 400,
      totalOperatingExpenses: 200,
      netIncome: 200,
      totalAssets: 5000,
      totalLiabilities: 2000,
      totalEquity: 3000,
      cogs: { total: 600 },
    };
    const scaled = scaleStatementAmounts(input, 0.5);
    expect(scaled.totalRevenue).toBe(500);
    expect(scaled.netIncome).toBe(100);
    expect(scaled.cogs.total).toBe(300);
    expect(scaled.totalAssets).toBe(2500);
  });

  it('returns unchanged statement when rate is 1', () => {
    const input = { totalRevenue: 100 };
    expect(scaleStatementAmounts(input, 1)).toBe(input);
  });
});

describe('scaleTrialBalanceRow', () => {
  it('scales debit and credit columns', () => {
    const row = { debit: 100, credit: 0, debitBalance: 100, creditBalance: 0 };
    const scaled = scaleTrialBalanceRow(row, 2);
    expect(scaled.debit).toBe(200);
    expect(scaled.debitBalance).toBe(200);
  });
});

describe('classifyIntercompanyAccount', () => {
  it('detects inter-company receivable by code prefix', () => {
    expect(
      classifyIntercompanyAccount({
        accountCode: '1240',
        accountName: 'Due from subsidiary',
        accountType: 'Asset',
      })
    ).toBe('receivable');
  });

  it('detects inter-company payable by code prefix', () => {
    expect(
      classifyIntercompanyAccount({
        accountCode: '2120',
        accountName: 'Due to parent',
        accountType: 'Liability',
      })
    ).toBe('payable');
  });

  it('detects by account name pattern', () => {
    expect(
      classifyIntercompanyAccount({
        accountCode: '9999',
        accountName: 'Inter-company loan',
        accountType: 'Asset',
      })
    ).toBe('receivable');
  });
});

describe('extractIntercompanyBalances', () => {
  it('sums receivable and payable net balances', () => {
    const result = extractIntercompanyBalances([
      { accountCode: '1240', accountType: 'Asset', debitBalance: 500, creditBalance: 0 },
      { accountCode: '2120', accountType: 'Liability', debitBalance: 0, creditBalance: 300 },
    ]);
    expect(result.icReceivable).toBe(500);
    expect(result.icPayable).toBe(300);
    expect(result.items).toHaveLength(2);
  });
});

describe('computeIntercompanyElimination', () => {
  it('eliminates min of total receivable and payable', () => {
    const result = computeIntercompanyElimination([
      { tenantId: 'a', tenantName: 'A', icReceivable: 500, icPayable: 100 },
      { tenantId: 'b', tenantName: 'B', icReceivable: 200, icPayable: 400 },
    ]);
    expect(result.totalIntercompanyReceivable).toBe(700);
    expect(result.totalIntercompanyPayable).toBe(500);
    expect(result.eliminationAmount).toBe(500);
    expect(result.applied).toBe(true);
  });

  it('does not apply when no matching balances', () => {
    const result = computeIntercompanyElimination([
      { tenantId: 'a', tenantName: 'A', icReceivable: 0, icPayable: 0 },
    ]);
    expect(result.eliminationAmount).toBe(0);
    expect(result.applied).toBe(false);
  });
});

describe('applyEliminationToBalanceSheetTotals', () => {
  it('reduces assets and liabilities by elimination amount', () => {
    const totals = {
      totalAssets: 10000,
      totalLiabilities: 4000,
      totalEquity: 6000,
    };
    const adjusted = applyEliminationToBalanceSheetTotals(totals, 500);
    expect(adjusted.totalAssets).toBe(9500);
    expect(adjusted.totalLiabilities).toBe(3500);
    expect(adjusted.isBalanced).toBe(true);
  });
});

describe('harmonizedTrialBalanceKey', () => {
  it('combines account type and harmonized code', () => {
    const key = harmonizedTrialBalanceKey({
      accountCode: '5017',
      accountType: 'Expense',
    });
    expect(key).toMatch(/^Expense::/);
    expect(key.split('::')[1]).toBe(resolveHarmonizedAccountCode('5017'));
  });
});

describe('buildConsolidationMetadata', () => {
  it('includes FX and IC notes when applicable', () => {
    const meta = buildConsolidationMetadata({
      reportingCurrency: 'USD',
      currencyByTenant: new Map([
        ['t1', 'MWK'],
        ['t2', 'USD'],
      ]),
      fxApplied: true,
      intercompanyElimination: {
        applied: true,
        eliminationAmount: 250,
        totalIntercompanyReceivable: 250,
        totalIntercompanyPayable: 250,
        perTenant: [],
      },
    });
    expect(meta.reportingCurrency).toBe('USD');
    expect(meta.fxTranslationApplied).toBe(true);
    expect(meta.intercompanyElimination.eliminationAmount).toBe(250);
    expect(meta.notes.some((n) => n.includes('translated'))).toBe(true);
    expect(meta.notes.some((n) => n.includes('Inter-company'))).toBe(true);
  });
});

describe('resolveHarmonizedAccountCode', () => {
  it('returns unknown for empty code', () => {
    expect(resolveHarmonizedAccountCode('')).toBe('UNKNOWN');
  });

  it('follows alias chain to group code', () => {
    const mapped = resolveHarmonizedAccountCode('5017');
    expect(mapped).not.toBe('5017');
    expect(mapped.length).toBeGreaterThan(0);
  });
});
