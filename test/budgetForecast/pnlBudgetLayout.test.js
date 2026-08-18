import { describe, it, expect } from 'vitest';
import {
  buildPnlBudgetLayout,
  buildPnlGroupedForBudgetPlan,
  filterAccountsForSection,
  SIMPLE_PNL_SECTIONS,
} from '../../lib/budgetForecast/domain/pnlBudgetLayout.js';

const rev = {
  id: 'a1',
  accountId: 'a1',
  accountCode: '4010',
  accountName: 'Product sales',
  accountType: 'income',
  coaV2Category: 'REVENUE',
};
const cogs = {
  id: 'a2',
  accountId: 'a2',
  accountCode: '5100',
  accountName: 'COGS',
  accountType: 'expense',
  coaV2Category: 'COST_OF_SALES',
};
const rent = {
  id: 'a3',
  accountId: 'a3',
  accountCode: '5210',
  accountName: 'Rent',
  accountType: 'expense',
  coaV2Category: 'EXPENSE',
};

describe('buildPnlBudgetLayout', () => {
  it('groups selected accounts under P&L sections in simple view', () => {
    const periodEdits = {
      a1: { '2026-01': '100' },
      a2: { '2026-01': '40' },
      a3: { '2026-01': '10' },
    };
    const { rows } = buildPnlBudgetLayout({
      accounts: [rev, cogs, rent],
      selectedAccountIds: ['a1', 'a2', 'a3'],
      periodEdits,
      periodKeys: ['2026-01'],
      showAdvanced: false,
    });

    expect(rows.some((r) => r.rowType === 'SECTION' && r.lineId === 'revenue')).toBe(true);
    expect(rows.some((r) => r.rowType === 'ACCOUNT' && r.accountId === 'a1')).toBe(true);
    expect(rows.some((r) => r.rowType === 'SECTION' && r.lineId === 'operating-expenses')).toBe(true);
    expect(rows.some((r) => r.rowType === 'CALCULATED' && r.lineId === 'gross-profit')).toBe(true);
    expect(rows.some((r) => r.rowType === 'CALCULATED' && r.lineId === 'net-profit')).toBe(true);
  });

  it('computes gross and net profit in summary', () => {
    const periodEdits = {
      a1: { '2026-01': '100' },
      a2: { '2026-01': '40' },
      a3: { '2026-01': '10' },
    };
    const { summary } = buildPnlBudgetLayout({
      accounts: [rev, cogs, rent],
      selectedAccountIds: ['a1', 'a2', 'a3'],
      periodEdits,
      periodKeys: ['2026-01'],
      showAdvanced: false,
    });

    expect(summary.revenue).toBe(100);
    expect(summary.grossProfit).toBe(60);
    expect(summary.netProfit).toBe(50);
  });

  it('includes advanced IS calculated lines when showAdvanced is true', () => {
    const { rows } = buildPnlBudgetLayout({
      accounts: [rev, cogs, rent],
      selectedAccountIds: ['a1', 'a2', 'a3'],
      periodEdits: {
        a1: { '2026-01': '100' },
        a2: { '2026-01': '40' },
        a3: { '2026-01': '10' },
      },
      periodKeys: ['2026-01'],
      showAdvanced: true,
    });

    expect(rows.some((r) => r.lineId === 'ebitda')).toBe(true);
    expect(rows.some((r) => r.lineId === 'profit-before-tax')).toBe(true);
  });
});

describe('filterAccountsForSection', () => {
  it('returns revenue accounts for revenue section', () => {
    const result = filterAccountsForSection([rev, cogs, rent], 'revenue', []);
    expect(result.map((a) => a.id)).toEqual(['a1']);
  });

  it('excludes already selected accounts', () => {
    const result = filterAccountsForSection([rev, cogs], 'revenue', ['a1']);
    expect(result).toHaveLength(0);
  });
});

describe('SIMPLE_PNL_SECTIONS', () => {
  it('lists the three default owner-facing sections', () => {
    expect(SIMPLE_PNL_SECTIONS).toEqual(['revenue', 'cost-of-sales', 'operating-expenses']);
  });
});

describe('buildPnlGroupedForBudgetPlan', () => {
  const budget = {
    frequency: 'MONTHLY',
    startDate: '2026-01-01',
    endDate: '2026-03-31',
    currency: 'MWK',
  };

  const budgetLines = [
    {
      accountId: 'a1',
      accountCode: '4010',
      accountName: 'Product sales',
      kind: 'REVENUE',
      category: 'REVENUE',
      budget: 300,
      periods: [
        { periodStart: '2026-01-01', monthNumber: 1, plannedAmount: 100 },
        { periodStart: '2026-02-01', monthNumber: 2, plannedAmount: 100 },
        { periodStart: '2026-03-01', monthNumber: 3, plannedAmount: 100 },
      ],
    },
    {
      accountId: 'a2',
      accountCode: '5100',
      accountName: 'COGS',
      kind: 'COST_OF_SALES',
      category: 'COST_OF_SALES',
      budget: 120,
      periods: [
        { periodStart: '2026-01-01', monthNumber: 1, plannedAmount: 40 },
        { periodStart: '2026-02-01', monthNumber: 2, plannedAmount: 40 },
        { periodStart: '2026-03-01', monthNumber: 3, plannedAmount: 40 },
      ],
    },
    {
      accountId: 'a3',
      accountCode: '5210',
      accountName: 'Rent',
      kind: 'EXPENSE',
      category: 'EXPENSE',
      budget: 30,
      periods: [
        { periodStart: '2026-01-01', monthNumber: 1, plannedAmount: 10 },
        { periodStart: '2026-02-01', monthNumber: 2, plannedAmount: 10 },
        { periodStart: '2026-03-01', monthNumber: 3, plannedAmount: 10 },
      ],
    },
  ];

  it('groups budget plan lines into P&L sections with export-friendly rows', () => {
    const pnlGrouped = buildPnlGroupedForBudgetPlan(budget, budgetLines);
    expect(pnlGrouped.rows.some((r) => r.rowType === 'SECTION' && r.lineId === 'revenue')).toBe(true);
    expect(pnlGrouped.rows.some((r) => r.rowType === 'CALCULATED' && r.lineId === 'net-profit')).toBe(true);
    const salesRow = pnlGrouped.rows.find((r) => r.accountId === 'a1');
    expect(salesRow?.budget).toBe(300);
    expect(salesRow?.accountCode).toBe('4010');
    expect(pnlGrouped.summary.netProfit).toBe(150);
  });
});
