import prisma from '@/lib/prisma';
import { resolveBudgetActuals } from './budgetActualsService.js';
import { computeVariance, classifyAccountKind } from '../domain/variance.js';
import { expenseUtilization, revenueAchievement } from '../domain/utilization.js';
import { minorToNumber, fromMinor } from '../domain/money.js';
import { getReportDefinition, listReportDefinitions } from '../reports/reportDefinitionRegistry.js';

export { listReportDefinitions };

/** Aliases for API / UI report IDs (defined after implementations below) */

export async function exportReportAsCsv(report) {
  const headers = [
    'accountCode',
    'accountName',
    'category',
    'budget',
    'actual',
    'rawVariance',
    'favourableVariance',
    'variancePercent',
    'status',
  ];
  const rows = (report.lines || []).map((l) =>
    [
      l.accountCode,
      JSON.stringify(l.accountName || ''),
      l.category || l.kind || '',
      l.budget ?? fromMinor(l.budgetMinor || 0),
      l.actual ?? l.forecast ?? fromMinor(l.actualMinor ?? l.forecastMinor ?? 0),
      l.rawVarianceMinor != null ? fromMinor(l.rawVarianceMinor) : '',
      l.favourableVarianceMinor != null ? fromMinor(l.favourableVarianceMinor) : '',
      l.variancePercent ?? l.percentState ?? '',
      l.status || '',
    ].join(',')
  );
  const meta = [
    `# report=${report.reportId}`,
    `# budgetVersion=${report.budget?.versionNumber ?? ''}`,
    `# forecastVersion=${report.forecast?.versionNumber ?? ''}`,
    `# freshness=${report.freshness || ''}`,
    `# currency=${report.currency || 'MWK'}`,
  ];
  return [...meta, headers.join(','), ...rows].join('\n');
}


function serviceError(message, status = 400, code = 'REPORT_ERROR') {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

async function loadBudget(tenantId, budgetId) {
  const budget = await prisma.budget.findFirst({
    where: { id: budgetId, tenantId },
    include: {
      lines: { include: { periodAmounts: true, account: true } },
    },
  });
  if (!budget) throw serviceError('Budget not found', 404);
  return budget;
}

async function loadForecast(tenantId, forecastId) {
  const forecast = await prisma.forecast.findFirst({
    where: { id: forecastId, tenantId },
    include: {
      lines: { include: { periodAmounts: true, account: true } },
    },
  });
  if (!forecast) throw serviceError('Forecast not found', 404);
  return forecast;
}

function plannedFromBudgetLine(line, startDate, endDate) {
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  let total = 0;
  for (const p of line.periodAmounts || []) {
    if (start && p.periodEnd < start) continue;
    if (end && p.periodStart > end) continue;
    total += minorToNumber(p.plannedAmountMinor);
  }
  if (!total && (!start || !end)) total = minorToNumber(line.annualAmountMinor);
  return total;
}

/** Budget versus Actual */
export async function reportBudgetVsActual(tenantId, { budgetId, startDate, endDate, branchId } = {}) {
  const def = getReportDefinition('BVA');
  const budget = await loadBudget(tenantId, budgetId);
  const from = startDate || budget.startDate;
  const to = endDate || budget.endDate;
  const actuals = await resolveBudgetActuals({
    tenantId,
    startDate: from,
    endDate: to,
    branchId: branchId || budget.branchId || null,
    accountIds: budget.lines.map((l) => l.accountId),
  });

  const lines = [];
  for (const line of budget.lines) {
    const kind = classifyAccountKind(line.accountTypeSnapshot, line.accountCategorySnapshot);
    const budgetMinor = plannedFromBudgetLine(line, from, to);
    const actual = actuals.byAccount.get(line.accountId);
    const actualMinor = actual?.actualMinor ?? 0;
    const variance = computeVariance(kind, budgetMinor, actualMinor);
    const util =
      kind === 'REVENUE' || kind === 'OTHER_INCOME'
        ? revenueAchievement(budgetMinor, actualMinor)
        : expenseUtilization(budgetMinor, actualMinor);
    lines.push({
      accountId: line.accountId,
      accountCode: line.accountCodeSnapshot,
      accountName: line.accountNameSnapshot,
      kind,
      budgetMinor,
      actualMinor,
      ...variance,
      utilization: util,
      drillDown: {
        budgetLineId: line.id,
        journalLineCount: actual?.lineCount || 0,
      },
    });
  }

  // Unplanned actuals (actual with no budget line)
  const budgetAccountIds = new Set(budget.lines.map((l) => l.accountId));
  for (const a of actuals.accounts) {
    if (budgetAccountIds.has(a.accountId)) continue;
    if (!a.actualMinor) continue;
    const variance = computeVariance(a.kind, 0, a.actualMinor);
    lines.push({
      accountId: a.accountId,
      accountCode: a.accountCode,
      accountName: a.accountName,
      kind: a.kind,
      budgetMinor: 0,
      actualMinor: a.actualMinor,
      ...variance,
      drillDown: { journalLineCount: a.lineCount || 0 },
    });
  }

  return {
    reportId: def.id,
    name: def.name,
    formula: def.formula,
    signPolicy: def.signPolicy,
    budget: { id: budget.id, name: budget.name, status: budget.status, versionNumber: budget.versionNumber },
    period: { startDate: from, endDate: to, branchId: branchId || budget.branchId || null },
    source: actuals.source,
    calculationVersion: actuals.calculationVersion,
    lines,
    freshness: actuals.freshness,
  };
}

/** Budget versus Forecast */
export async function reportBudgetVsForecast(tenantId, { budgetId, forecastId } = {}) {
  const def = getReportDefinition('BVF');
  const budget = await loadBudget(tenantId, budgetId);
  const forecast = await loadForecast(tenantId, forecastId);
  const forecastByAccount = new Map(forecast.lines.map((l) => [l.accountId, l]));
  const lines = [];
  for (const line of budget.lines) {
    const kind = classifyAccountKind(line.accountTypeSnapshot, line.accountCategorySnapshot);
    const budgetMinor = minorToNumber(line.annualAmountMinor);
    const fLine = forecastByAccount.get(line.accountId);
    const forecastMinor = fLine ? minorToNumber(fLine.projectedAmountMinor) : 0;
    const variance = computeVariance(kind, budgetMinor, forecastMinor);
    lines.push({
      accountId: line.accountId,
      accountCode: line.accountCodeSnapshot,
      accountName: line.accountNameSnapshot,
      kind,
      budgetMinor,
      forecastMinor,
      ...variance,
      // Re-map actual→forecast naming for consumers
      actualMinor: forecastMinor,
    });
  }
  return {
    reportId: def.id,
    name: def.name,
    budget: { id: budget.id, name: budget.name },
    forecast: { id: forecast.id, name: forecast.name, scenarioType: forecast.scenarioType },
    lines,
  };
}

/** Forecast versus Actual */
export async function reportForecastVsActual(tenantId, { forecastId, startDate, endDate, branchId } = {}) {
  const def = getReportDefinition('FVA');
  const forecast = await loadForecast(tenantId, forecastId);
  const from = startDate || forecast.startDate;
  const to = endDate || forecast.endDate;
  const actuals = await resolveBudgetActuals({
    tenantId,
    startDate: from,
    endDate: to,
    branchId: branchId || forecast.branchId || null,
    accountIds: forecast.lines.map((l) => l.accountId),
  });
  const lines = [];
  for (const line of forecast.lines) {
    const kind = classifyAccountKind(line.accountTypeSnapshot, null);
    const forecastMinor = minorToNumber(line.projectedAmountMinor);
    const actualMinor = actuals.byAccount.get(line.accountId)?.actualMinor ?? 0;
    const variance = computeVariance(kind, forecastMinor, actualMinor);
    lines.push({
      accountId: line.accountId,
      accountCode: line.accountCodeSnapshot,
      accountName: line.accountNameSnapshot,
      kind,
      forecastMinor,
      actualMinor,
      ...variance,
      budgetMinor: forecastMinor,
    });
  }
  return {
    reportId: def.id,
    name: def.name,
    forecast: { id: forecast.id, name: forecast.name },
    period: { startDate: from, endDate: to },
    source: actuals.source,
    lines,
  };
}

export async function reportUtilization(tenantId, { budgetId, startDate, endDate, branchId } = {}) {
  const bva = await reportBudgetVsActual(tenantId, { budgetId, startDate, endDate, branchId });
  const expense = [];
  const revenue = [];
  for (const line of bva.lines) {
    if (line.kind === 'REVENUE' || line.kind === 'OTHER_INCOME') {
      revenue.push({ ...line, achievement: revenueAchievement(line.budgetMinor, line.actualMinor) });
    } else if (line.kind === 'EXPENSE' || line.kind === 'COST_OF_SALES' || line.kind === 'OTHER_EXPENSE') {
      expense.push({ ...line, utilization: expenseUtilization(line.budgetMinor, line.actualMinor) });
    }
  }
  return {
    reportId: 'UTILIZATION',
    name: 'Budget Utilization',
    expense,
    revenue,
    period: bva.period,
  };
}

/**
 * Cash outlook from forecast + GL opening cash (read-only; never posts).
 */
export async function reportCashOutlook(tenantId, { forecastId, asOfDate } = {}) {
  const def = getReportDefinition('CASH_OUTLOOK');
  const forecast = await loadForecast(tenantId, forecastId);
  const asOf = asOfDate ? new Date(asOfDate) : new Date(forecast.startDate);
  const summary = await resolveBudgetActuals({
    tenantId,
    endDate: asOf,
    branchId: forecast.branchId || null,
  });

  let openingCashMinor = 0;
  for (const a of summary.accounts) {
    const name = `${a.accountName || ''} ${a.accountCode || ''}`.toLowerCase();
    const type = String(a.accountType || '').toLowerCase();
    if (type === 'asset' && (name.includes('cash') || name.includes('bank'))) {
      openingCashMinor += a.actualMinor;
    }
  }

  let projectedInflows = 0;
  let projectedOutflows = 0;
  for (const line of forecast.lines) {
    const amt = minorToNumber(line.projectedAmountMinor);
    const kind = classifyAccountKind(line.accountTypeSnapshot, null);
    if (kind === 'REVENUE' || kind === 'OTHER_INCOME') projectedInflows += amt;
    else if (kind === 'EXPENSE' || kind === 'COST_OF_SALES') projectedOutflows += amt;
  }

  const closingCashMinor = openingCashMinor + projectedInflows - projectedOutflows;
  return {
    reportId: def.id,
    name: def.name,
    forecast: { id: forecast.id, name: forecast.name },
    openingCashMinor,
    projectedInflowsMinor: projectedInflows,
    projectedOutflowsMinor: projectedOutflows,
    closingCashMinor,
    note: 'Read-only outlook. Forecast generation never posts cash journals.',
  };
}

export const runBudgetVersusActual = reportBudgetVsActual;
export const runBudgetVersusForecast = reportBudgetVsForecast;
export const runForecastVersusActual = reportForecastVsActual;
