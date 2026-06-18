import { describe, it, expect } from 'vitest';
import {
  computePeriodNetMovement,
  isCostOfSalesAccount,
  isIncomeAccount,
  isInventoryAssetAccount,
  isInventoryLossAccount,
  isTaxInflowAccount,
  isTaxOutflowAccount,
} from '../lib/reportingEngine/accountClassification.js';
import {
  buildReconciliationItem,
  buildReconciliationSummary,
} from '../lib/reportingEngine/reportReconciliation.js';
import { buildProfitAnalysisFromPl } from '../lib/reportingEngine/buildOperationalGlReconciliation.js';

describe('reportingEngine accountClassification', () => {
  it('computes credit-normal income period movement', () => {
    const account = { accountType: 'Income', normalBalance: 'Credit' };
    expect(computePeriodNetMovement(account, 100, 500)).toBe(400);
  });

  it('computes debit-normal expense period movement', () => {
    const account = { accountType: 'Expense', normalBalance: 'Debit' };
    expect(computePeriodNetMovement(account, 300, 50)).toBe(250);
  });

  it('classifies income and COGS accounts by code/subtype', () => {
    expect(isIncomeAccount({ accountType: 'Income', accountCode: '4100' })).toBe(true);
    expect(isCostOfSalesAccount({ accountSubtype: 'Cost of Sales', accountCode: '5100' })).toBe(true);
  });

  it('classifies inventory GL accounts', () => {
    expect(isInventoryAssetAccount({ accountType: 'Asset', accountCode: '1310' })).toBe(true);
    expect(
      isInventoryLossAccount({ accountType: 'Expense', accountName: 'Inventory Adjustment Loss' })
    ).toBe(true);
  });

  it('classifies Malawi tax GL codes', () => {
    expect(isTaxInflowAccount({ accountCode: '2041-01' })).toBe(true);
    expect(isTaxOutflowAccount({ accountCode: '2045-01' })).toBe(true);
  });
});

describe('buildProfitAnalysisFromPl', () => {
  it('derives margins from income statement snapshot', () => {
    const summary = buildProfitAnalysisFromPl({
      totalRevenue: 1000,
      cogs: { total: 400 },
      grossProfit: 600,
      totalOperatingExpenses: 200,
      netIncome: 400,
      metadata: { fromGeneralLedger: { revenue: true } },
    });
    expect(summary?.grossProfitMargin).toBe(60);
    expect(summary?.netProfitMargin).toBe(40);
    expect(summary?.netProfit).toBe(400);
  });
});

describe('reportingEngine reconciliation', () => {
  it('flags variance when GL and operational differ', () => {
    const item = buildReconciliationItem({
      label: 'Revenue',
      glAmount: 1000,
      operationalAmount: 950,
    });
    expect(item.reconciled).toBe(false);
    expect(item.variance).toBe(50);
  });

  it('reports all reconciled when within tolerance', () => {
    const summary = buildReconciliationSummary([
      buildReconciliationItem({ label: 'A', glAmount: 100, operationalAmount: 100 }),
      buildReconciliationItem({ label: 'B', glAmount: 50, operationalAmount: 50.005 }),
    ]);
    expect(summary.allReconciled).toBe(true);
  });
});
