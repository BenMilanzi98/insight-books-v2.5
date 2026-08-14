/**
 * Unit tests — Cost of Goods profile mapping + CIT provision math / source ids.
 */

import { describe, expect, it } from 'vitest';
import {
  resolveAccountProfile,
  accountMatchesRule,
  assignAccountsToLines,
  getReportDefinition,
} from '../lib/accountingV2/reporting/reportDefinitions.js';
import {
  buildCitPeriodKey,
  buildCitSourceId,
  computeCitProvisionMinor,
  applyCitDisplayToBody,
} from '../lib/accountingV2/reporting/citProvisionService.js';

describe('Cost of Goods P&L placement', () => {
  it('forces 5110 into COST_OF_SALES even when category is EXPENSE', () => {
    const profile = resolveAccountProfile({
      accountId: 'a1',
      accountCode: '5110',
      accountName: 'Purchases',
      coaV2Category: 'EXPENSE',
      accountType: 'Expense',
    });
    expect(profile.category).toBe('COST_OF_SALES');
  });

  it('maps 5110 to cost-of-sales and not operating-expenses', () => {
    const definition = getReportDefinition('INCOME_STATEMENT');
    const row = {
      accountId: 'a1',
      accountCode: '5110',
      accountName: 'Cost of Goods Sold',
      coaV2Category: 'EXPENSE',
      accountType: 'Expense',
      periodDebitMinor: 10000,
      periodCreditMinor: 0,
      isHeader: false,
    };
    const { assignments } = assignAccountsToLines(definition, [row]);
    expect(assignments.get('cost-of-sales')?.map((r) => r.accountId)).toEqual(['a1']);
    expect(assignments.get('operating-expenses') || []).toHaveLength(0);
  });

  it('maps 5580 Corporate Tax Expense to tax-expense, not OpEx', () => {
    const definition = getReportDefinition('INCOME_STATEMENT');
    const profile = resolveAccountProfile({
      accountId: 't1',
      accountCode: '5580',
      accountName: 'Corporate Tax Expense',
      coaV2Category: 'EXPENSE',
      coaV2SubType: 'ADMINISTRATIVE_EXPENSE',
    });
    expect(profile.subType).toBe('TAX_EXPENSE');
    const opex = definition.lines.find((l) => l.lineId === 'operating-expenses');
    const tax = definition.lines.find((l) => l.lineId === 'tax-expense');
    expect(accountMatchesRule(profile, opex.match, { accountCode: '5580' })).toBe(false);
    expect(accountMatchesRule(profile, tax.match, { accountCode: '5580' })).toBe(true);
  });
});

describe('CIT provision helpers', () => {
  it('computes 30% of positive NPBT in minor units', () => {
    expect(computeCitProvisionMinor(1_000_000, 30)).toBe(300_000);
    expect(computeCitProvisionMinor(0, 30)).toBe(0);
    expect(computeCitProvisionMinor(-50_000, 30)).toBe(0);
  });

  it('builds stable period / source ids', () => {
    const key = buildCitPeriodKey('2026-01-01', '2026-12-31');
    expect(key).toBe('2026-01-01_2026-12-31');
    expect(buildCitSourceId(key, 1)).toBe('cit:2026-01-01_2026-12-31');
    expect(buildCitSourceId(key, 99)).toBe('cit:2026-01-01_2026-12-31:v99');
  });

  it('applies display CIT to body minors without changing NPBT', () => {
    const body = {
      lineMinors: new Map([
        ['profit-before-tax', 1_000_000],
        ['tax-expense', 0],
        ['net-profit', 1_000_000],
      ]),
    };
    applyCitDisplayToBody(body, 300_000);
    expect(body.lineMinors.get('profit-before-tax')).toBe(1_000_000);
    expect(body.lineMinors.get('tax-expense')).toBe(300_000);
    expect(body.lineMinors.get('net-profit')).toBe(700_000);
  });

  it('shows calculated CIT whenever provision is non-zero', async () => {
    const { shouldShowCalculatedCit } = await import(
      '../lib/accountingV2/reporting/citProvisionService.js'
    );
    expect(shouldShowCalculatedCit({ citMinor: 300_000, reason: 'DISPLAY_ONLY' })).toBe(true);
    expect(shouldShowCalculatedCit({ citMinor: 300_000, reason: 'POST_FAILED' })).toBe(true);
    expect(shouldShowCalculatedCit({ citMinor: 0, reason: 'CIT_NOT_ENABLED' })).toBe(false);
  });
});
