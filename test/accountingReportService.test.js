import { describe, it, expect } from 'vitest';
import { adaptProfitAndLossForUi, adaptBalanceSheetForUi } from '../lib/accountingReportService.js';

describe('AccountingReportService adapters', () => {
  it('adaptProfitAndLossForUi includes account codes on expense lines', () => {
    const ui = adaptProfitAndLossForUi({
      sourcePolicy: {},
      hasGlActivity: true,
      totalRevenue: 100000,
      grossProfit: 60000,
      grossProfitMargin: 60,
      operatingIncome: 40000,
      netProfit: 35000,
      netProfitMargin: 35,
      revenue: {
        lineItems: [
          {
            accountId: 'a1',
            accountCode: '4100',
            label: 'Product Sales',
            amount: 100000,
            debitTotal: 0,
            creditTotal: 100000,
          },
        ],
        total: 100000,
        otherIncome: 0,
        otherIncomeLineItems: [],
      },
      cogs: { lineItems: [], total: 40000 },
      operatingExpenses: {
        lineItems: [
          {
            accountId: 'e1',
            accountCode: '5200',
            label: 'Salaries & Wages',
            amount: 20000,
            debitTotal: 20000,
            creditTotal: 0,
          },
        ],
        total: 20000,
      },
      otherIncomeExpenses: {
        otherIncome: 0,
        otherExpenses: 5000,
        otherIncomeLineItems: [],
        otherExpenseLineItems: [],
        total: -5000,
      },
    });

    expect(ui.source).toBe('general_ledger');
    expect(ui.operatingExpenses.accountLines[0].accountCode).toBe('5200');
    expect(ui.revenue.lineItems[0].accountCode).toBe('4100');
    expect(ui.metadata.ledgerBacked).toBe(true);
  });

  it('adaptBalanceSheetForUi exposes account-code line items', () => {
    const ui = adaptBalanceSheetForUi(
      {
        sourcePolicy: {},
        asOfDate: '2026-06-19',
        assets: {
          current: [
            {
              accountId: 'c1',
              accountCode: '1110',
              accountName: 'Cash - Main Account',
              balance: 500000,
              debitTotal: 500000,
              creditTotal: 0,
            },
          ],
          nonCurrent: [],
          total: 500000,
        },
        liabilities: { current: [], nonCurrent: [], total: 0 },
        equity: {
          lines: [
            {
              accountId: 'eq1',
              accountCode: '3101',
              accountName: 'Owner Capital',
              balance: 1000000,
              debitTotal: 0,
              creditTotal: 1000000,
            },
          ],
          total: 1000000,
        },
        controlAccounts: {},
        totals: {
          totalAssets: 500000,
          totalLiabilities: 0,
          totalEquity: 1000000,
          totalLiabilitiesAndEquity: 1000000,
          difference: -500000,
          balanced: false,
        },
      },
      { companyName: 'Test Co' }
    );

    expect(ui.assets.currentAssets.lineItems[0].accountCode).toBe('1110');
    expect(ui.equity.lineItems[0].accountCode).toBe('3101');
    expect(ui.equity.lineItems[0].balance).toBe(1000000);
    expect(ui.reconciliation.ledgerBacked).toBe(true);
  });
});
