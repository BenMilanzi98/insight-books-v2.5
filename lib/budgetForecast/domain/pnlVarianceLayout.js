import {
  assignAccountsToLines,
  getReportDefinition,
  resolveAccountProfile,
} from '../../accountingV2/reporting/reportDefinitions.js';
import { fromMinor } from './money.js';
import { SIMPLE_PNL_SECTIONS, SIMPLE_SECTION_LABELS } from './pnlBudgetLayout.js';

const PNL_IN_SCOPE = new Set([
  'REVENUE',
  'OTHER_INCOME',
  'COST_OF_SALES',
  'EXPENSE',
  'OTHER_EXPENSE',
]);

function accountIdOf(row) {
  return row.accountId || row.id;
}

function isPnlInScope(profile) {
  return PNL_IN_SCOPE.has(String(profile.category || '').toUpperCase());
}

function kindToCategory(kind) {
  const k = String(kind || '').toUpperCase();
  if (k === 'REVENUE' || k === 'OTHER_INCOME') return k;
  if (k === 'COST_OF_SALES') return 'COST_OF_SALES';
  return 'EXPENSE';
}

function lineToMajor(line) {
  const budget =
    line.budget != null
      ? Number(line.budget)
      : fromMinor(line.budgetMinor || 0);
  const actual =
    line.actual != null
      ? Number(line.actual)
      : fromMinor(line.actualMinor ?? line.forecastMinor ?? 0);
  const variance =
    line.favourableVarianceMinor != null
      ? fromMinor(line.favourableVarianceMinor)
      : actual - budget;
  return { budget, actual, variance, isFavourable: variance >= 0 };
}

function calcRow(lineId, label, budget, actual, variance) {
  return {
    rowType: 'CALCULATED',
    lineId,
    label,
    budget,
    actual,
    variance,
    isFavourable: variance >= 0,
    readOnly: true,
  };
}

/**
 * Group flat BvA lines into P&L sections with calculated profit rows.
 * @param {{ varianceLines: Array<object>, showAdvanced?: boolean }} params
 */
export function buildPnlVarianceLayout({ varianceLines = [], showAdvanced = false }) {
  const byAccount = new Map(varianceLines.map((l) => [l.accountId, l]));

  const accountRows = varianceLines.map((l) => ({
    id: l.accountId,
    accountId: l.accountId,
    accountCode: l.accountCode,
    accountName: l.accountName,
    name: l.accountName,
    coaV2Category: kindToCategory(l.kind),
    accountType: l.kind === 'REVENUE' ? 'income' : 'expense',
  }));

  const definition = getReportDefinition('INCOME_STATEMENT');
  const { assignments, unmapped } = assignAccountsToLines(definition, accountRows, isPnlInScope);

  const sectionTotals = new Map();
  for (const line of definition.lines) {
    if (line.lineType !== 'ACCOUNT_GROUP') continue;
    const assigned = assignments.get(line.lineId) || [];
    let budget = 0;
    let actual = 0;
    let variance = 0;
    for (const row of assigned) {
      const src = byAccount.get(accountIdOf(row));
      if (!src) continue;
      const m = lineToMajor(src);
      budget += m.budget;
      actual += m.actual;
      variance += m.variance;
    }
    sectionTotals.set(line.lineId, { budget, actual, variance });
  }

  const revenue = sectionTotals.get('revenue') || { budget: 0, actual: 0, variance: 0 };
  const cogs = sectionTotals.get('cost-of-sales') || { budget: 0, actual: 0, variance: 0 };
  const opex = sectionTotals.get('operating-expenses') || { budget: 0, actual: 0, variance: 0 };

  const grossProfit = {
    budget: revenue.budget - cogs.budget,
    actual: revenue.actual - cogs.actual,
    variance: revenue.actual - cogs.actual - (revenue.budget - cogs.budget),
  };
  const operatingProfit = {
    budget: grossProfit.budget - opex.budget,
    actual: grossProfit.actual - opex.actual,
    variance: grossProfit.actual - grossProfit.budget - (opex.actual - opex.budget),
  };

  const rows = [];

  const renderSection = (sectionId, label) => {
    rows.push({ rowType: 'SECTION', lineId: sectionId, label, readOnly: true });
    const assigned = assignments.get(sectionId) || [];
    for (const row of assigned) {
      const src = byAccount.get(accountIdOf(row));
      if (!src) continue;
      const m = lineToMajor(src);
      rows.push({
        rowType: 'ACCOUNT',
        lineId: sectionId,
        accountId: src.accountId,
        accountCode: src.accountCode,
        accountName: src.accountName,
        ...m,
        status: src.status,
        message: src.message,
      });
    }
  };

  if (!showAdvanced) {
    for (const sectionId of SIMPLE_PNL_SECTIONS) {
      renderSection(sectionId, SIMPLE_SECTION_LABELS[sectionId] || sectionId);
    }
    rows.push(calcRow('gross-profit', 'Gross Profit', grossProfit.budget, grossProfit.actual, grossProfit.variance));
    rows.push(calcRow('total-operating-expenses', 'Total Expenses', opex.budget, opex.actual, opex.variance));
    rows.push(
      calcRow('operating-profit', 'Operating Profit', operatingProfit.budget, operatingProfit.actual, operatingProfit.variance)
    );
    rows.push(
      calcRow('net-profit', 'Net Profit', operatingProfit.budget, operatingProfit.actual, operatingProfit.variance)
    );
  } else {
    for (const line of definition.lines) {
      if (line.lineType === 'ACCOUNT_GROUP') {
        renderSection(line.lineId, line.label);
      }
    }
    rows.push(calcRow('gross-profit', 'Gross Profit', grossProfit.budget, grossProfit.actual, grossProfit.variance));
    rows.push(
      calcRow('net-profit', 'Net Profit', operatingProfit.budget, operatingProfit.actual, operatingProfit.variance)
    );
  }

  if (unmapped.length) {
    rows.push({ rowType: 'SECTION', lineId: 'unmapped', label: 'Other — review mapping', readOnly: true });
    for (const row of unmapped) {
      const src = byAccount.get(accountIdOf(row));
      if (!src) continue;
      const m = lineToMajor(src);
      rows.push({
        rowType: 'ACCOUNT',
        lineId: 'unmapped',
        accountId: src.accountId,
        accountCode: src.accountCode,
        accountName: src.accountName,
        ...m,
        status: src.status,
        message: src.message,
      });
    }
  }

  return {
    rows,
    summary: {
      revenue,
      costOfSales: cogs,
      grossProfit,
      operatingExpenses: opex,
      netProfit: operatingProfit,
    },
  };
}

/** Plain-language insight for BvA summary banner. */
export function buildVarianceInsight(summary) {
  const net = summary?.netProfit?.variance ?? 0;
  const rev = summary?.revenue?.variance ?? 0;
  const exp = summary?.operatingExpenses?.variance ?? 0;
  const parts = [];

  if (net > 0) parts.push('Net profit is ahead of budget.');
  else if (net < 0) parts.push('Net profit is below budget.');

  if (rev > 0) parts.push('Revenue is above plan.');
  else if (rev < 0) parts.push('Revenue is below plan.');

  if (exp > 0) parts.push('Operating expenses are higher than budgeted.');
  else if (exp < 0) parts.push('Operating expenses are under budget.');

  return parts.length ? parts.join(' ') : 'Performance is broadly in line with budget.';
}
