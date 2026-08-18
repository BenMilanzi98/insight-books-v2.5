import {
  accountMatchesRule,
  assignAccountsToLines,
  evaluateFormula,
  getReportDefinition,
  resolveAccountProfile,
} from '../../accountingV2/reporting/reportDefinitions.js';
import { buildBudgetPeriodColumns } from './periods.js';

const PNL_IN_SCOPE = new Set([
  'REVENUE',
  'OTHER_INCOME',
  'COST_OF_SALES',
  'EXPENSE',
  'OTHER_EXPENSE',
]);

/** Account-group sections shown in the default simple view. */
export const SIMPLE_PNL_SECTIONS = Object.freeze([
  'revenue',
  'cost-of-sales',
  'operating-expenses',
]);

export const SIMPLE_SECTION_LABELS = Object.freeze({
  revenue: 'Income — Sales / Revenue',
  'cost-of-sales': 'Cost of Goods Sold',
  'operating-expenses': 'Operating Expenses',
});

function accountIdOf(row) {
  return row.accountId || row.id;
}

function isPnlInScope(profile) {
  return PNL_IN_SCOPE.has(String(profile.category || '').toUpperCase());
}

function sumAccountPeriods(accountId, periodEdits, periodKeys) {
  const months = periodEdits[accountId] || {};
  return periodKeys.reduce((sum, key) => sum + (Number(months[key]) || 0), 0);
}

function periodAmountsForAccount(accountId, periodEdits, periodKeys) {
  const months = periodEdits[accountId] || {};
  const amounts = {};
  for (const key of periodKeys) {
    amounts[key] = Number(months[key]) || 0;
  }
  return amounts;
}

function sectionAccountRows(lineId, definition, assignments, selectedSet, periodEdits, periodKeys) {
  const line = definition.lines.find((l) => l.lineId === lineId);
  const assigned = (assignments.get(lineId) || []).filter((row) => selectedSet.has(accountIdOf(row)));
  return assigned.map((row) => {
    const id = accountIdOf(row);
    return {
      rowType: 'ACCOUNT',
      lineId,
      accountId: id,
      label: row.accountName || row.name || id,
      code: row.accountCode || row.code || '',
      indent: 1,
      amounts: periodAmountsForAccount(id, periodEdits, periodKeys),
      total: sumAccountPeriods(id, periodEdits, periodKeys),
      kind: line?.match?.categories?.[0] || 'EXPENSE',
    };
  });
}

function calcRow(lineId, label, lineMinors, periodKeys, formula = null) {
  let total;
  if (formula) {
    total = evaluateFormula(formula, lineMinors);
  } else {
    total = lineMinors.get(lineId) ?? 0;
  }
  const amounts = {};
  for (const key of periodKeys) {
    amounts[key] = null;
  }
  return {
    rowType: 'CALCULATED',
    lineId,
    label,
    indent: 0,
    amounts,
    total,
    readOnly: true,
  };
}

/**
 * @param {object} params
 * @param {Array<object>} params.accounts
 * @param {string[]} params.selectedAccountIds
 * @param {Record<string, Record<string, string|number>>} params.periodEdits
 * @param {string[]} params.periodKeys
 * @param {boolean} [params.showAdvanced]
 */
export function buildPnlBudgetLayout({
  accounts,
  selectedAccountIds,
  periodEdits,
  periodKeys,
  showAdvanced = false,
}) {
  const definition = getReportDefinition('INCOME_STATEMENT');
  const selectedSet = new Set(selectedAccountIds);
  const accountRows = accounts.filter((a) => selectedSet.has(accountIdOf(a)));

  const { assignments, unmapped } = assignAccountsToLines(definition, accountRows, isPnlInScope);

  const lineMinors = new Map();
  for (const line of definition.lines) {
    if (line.lineType !== 'ACCOUNT_GROUP') continue;
    lineMinors.set(
      line.lineId,
      sectionTotalFromAssignments(line.lineId, assignments, selectedSet, periodEdits, periodKeys)
    );
  }

  const rows = [];

  if (!showAdvanced) {
    for (const sectionId of SIMPLE_PNL_SECTIONS) {
      rows.push({
        rowType: 'SECTION',
        lineId: sectionId,
        label: SIMPLE_SECTION_LABELS[sectionId] || sectionId,
        indent: 0,
        readOnly: true,
      });
      rows.push(...sectionAccountRows(sectionId, definition, assignments, selectedSet, periodEdits, periodKeys));
    }

    const revenue = lineMinors.get('revenue') || 0;
    const cogs = lineMinors.get('cost-of-sales') || 0;
    const opex = lineMinors.get('operating-expenses') || 0;
    const grossProfit = revenue - cogs;
    const operatingProfit = grossProfit - opex;

    lineMinors.set('gross-profit', grossProfit);
    lineMinors.set('total-operating-expenses', opex);
    lineMinors.set('operating-profit', operatingProfit);
    lineMinors.set('net-profit', operatingProfit);

    rows.push(calcRow('gross-profit', 'Gross Profit', lineMinors, periodKeys));
    rows.push({
      rowType: 'CALCULATED',
      lineId: 'total-operating-expenses',
      label: 'Total Expenses',
      indent: 0,
      amounts: Object.fromEntries(periodKeys.map((k) => [k, null])),
      total: opex,
      readOnly: true,
    });
    rows.push(calcRow('operating-profit', 'Operating Profit', lineMinors, periodKeys));
    rows.push(calcRow('net-profit', 'Net Profit', lineMinors, periodKeys));
  } else {
    for (const line of definition.lines) {
      if (line.lineType === 'ACCOUNT_GROUP') {
        rows.push({
          rowType: 'SECTION',
          lineId: line.lineId,
          label: line.label,
          indent: 0,
          readOnly: true,
        });
        rows.push(
          ...sectionAccountRows(line.lineId, definition, assignments, selectedSet, periodEdits, periodKeys)
        );
      } else if (line.lineType === 'CALCULATED_TOTAL' || line.lineType === 'GRAND_TOTAL') {
        const total = evaluateFormula(line.formula, lineMinors);
        lineMinors.set(line.lineId, total);
        rows.push(calcRow(line.lineId, line.label, lineMinors, periodKeys, line.formula));
      }
    }
  }

  const unmappedSelected = unmapped.filter((row) => selectedSet.has(accountIdOf(row)));
  if (unmappedSelected.length) {
    rows.push({
      rowType: 'SECTION',
      lineId: 'unmapped',
      label: 'Other — review mapping',
      indent: 0,
      readOnly: true,
    });
    for (const row of unmappedSelected) {
      const id = accountIdOf(row);
      rows.push({
        rowType: 'ACCOUNT',
        lineId: 'unmapped',
        accountId: id,
        label: row.accountName || row.name || id,
        code: row.accountCode || row.code || '',
        indent: 1,
        amounts: periodAmountsForAccount(id, periodEdits, periodKeys),
        total: sumAccountPeriods(id, periodEdits, periodKeys),
        kind: 'EXPENSE',
      });
    }
  }

  const revenue = lineMinors.get('revenue') || 0;
  const cogs = lineMinors.get('cost-of-sales') || 0;
  const opex = lineMinors.get('operating-expenses') || 0;
  const grossProfit = showAdvanced
    ? lineMinors.get('gross-profit') ?? revenue - cogs
    : revenue - cogs;
  const netProfit = showAdvanced
    ? lineMinors.get('net-profit') ?? grossProfit - opex
    : grossProfit - opex;

  return {
    rows,
    summary: {
      revenue,
      costOfSales: cogs,
      grossProfit,
      operatingExpenses: opex,
      netProfit,
      profit: netProfit,
    },
  };
}

function sectionTotalFromAssignments(lineId, assignments, selectedSet, periodEdits, periodKeys) {
  const assigned = (assignments.get(lineId) || []).filter((row) => selectedSet.has(accountIdOf(row)));
  return assigned.reduce(
    (sum, row) => sum + sumAccountPeriods(accountIdOf(row), periodEdits, periodKeys),
    0
  );
}

/**
 * Accounts eligible for a P&L section (for "Add account" picker).
 * @param {Array<object>} allAccounts
 * @param {string} sectionLineId
 * @param {string[]} [excludeAccountIds]
 */
export function filterAccountsForSection(allAccounts, sectionLineId, excludeAccountIds = []) {
  const definition = getReportDefinition('INCOME_STATEMENT');
  const line = definition.lines.find(
    (l) => l.lineId === sectionLineId && l.lineType === 'ACCOUNT_GROUP'
  );
  if (!line) return [];

  const exclude = new Set(excludeAccountIds);
  return allAccounts.filter((account) => {
    const id = accountIdOf(account);
    if (exclude.has(id)) return false;
    const profile = resolveAccountProfile(account);
    if (!isPnlInScope(profile)) return false;
    return accountMatchesRule(profile, line.match, account);
  });
}

function periodKeyFromBudgetPeriod(p) {
  if (p.key) return p.key;
  if (p.quarterNumber && !p.monthNumber) {
    const d = new Date(p.periodStart);
    return `${d.getUTCFullYear()}-Q${p.quarterNumber}`;
  }
  if (!p.monthNumber && !p.quarterNumber) {
    const d = new Date(p.periodStart);
    return String(d.getUTCFullYear());
  }
  if (p.monthNumber && p.periodStart) {
    const d = new Date(p.periodStart);
    return `${d.getUTCFullYear()}-${String(p.monthNumber).padStart(2, '0')}`;
  }
  const d = new Date(p.periodStart);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function spreadBudgetTotalEvenly(total, periodKeys) {
  const n = Math.max(1, periodKeys.length);
  const base = Math.floor((total * 100) / n) / 100;
  const map = {};
  let allocated = 0;
  periodKeys.forEach((key, i) => {
    if (i === n - 1) {
      map[key] = String(Math.round((total - allocated) * 100) / 100);
    } else {
      map[key] = String(base);
      allocated += base;
    }
  });
  return map;
}

function enrichRowsForExport(rows) {
  return rows.map((row) => {
    if (row.rowType === 'ACCOUNT') {
      return {
        ...row,
        accountCode: row.code,
        accountName: row.label,
        budget: row.total,
      };
    }
    if (row.rowType === 'CALCULATED') {
      return { ...row, budget: row.total };
    }
    return row;
  });
}

/**
 * Build P&L-grouped layout from budget plan report lines (for UI and export).
 * @param {object} budget — budget header (frequency, dates)
 * @param {Array<object>} budgetLines — lines from reportBudgetPlan
 * @param {{ startDate?: Date|string, endDate?: Date|string, showAdvanced?: boolean }} [options]
 */
export function buildPnlGroupedForBudgetPlan(
  budget,
  budgetLines,
  { startDate, endDate, showAdvanced = false } = {}
) {
  const from = startDate || budget.startDate;
  const to = endDate || budget.endDate;
  const frequency = budget.frequency || 'MONTHLY';
  const periodKeys = buildBudgetPeriodColumns(frequency, from, to).map((p) => p.key);
  const selectedAccountIds = budgetLines.map((l) => l.accountId);

  const accounts = budgetLines.map((l) => ({
    id: l.accountId,
    accountId: l.accountId,
    accountCode: l.accountCode,
    accountName: l.accountName,
    coaV2Category: l.category || l.kind,
    accountType:
      l.kind === 'REVENUE' || l.kind === 'OTHER_INCOME' ? 'income' : 'expense',
  }));

  const periodEdits = {};
  for (const line of budgetLines) {
    let map = Object.fromEntries(periodKeys.map((k) => [k, '0']));
    for (const p of line.periods || []) {
      const key = periodKeyFromBudgetPeriod(p);
      if (key in map) map[key] = String(p.plannedAmount ?? 0);
    }
    if (!(line.periods || []).length && line.budget != null) {
      map = spreadBudgetTotalEvenly(Number(line.budget) || 0, periodKeys);
    }
    periodEdits[line.accountId] = map;
  }

  const layout = buildPnlBudgetLayout({
    accounts,
    selectedAccountIds,
    periodEdits,
    periodKeys,
    showAdvanced,
  });

  return {
    ...layout,
    rows: enrichRowsForExport(layout.rows),
  };
}
