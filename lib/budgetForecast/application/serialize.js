import { fromMinor, minorToNumber } from '../domain/money.js';

function big(v) {
  if (typeof v === 'bigint') return Number(v);
  return Number(v ?? 0);
}

export function serializeBudget(budget) {
  if (!budget) return null;
  return {
    ...budget,
    annualAmountMinor: undefined,
    lines: Array.isArray(budget.lines) ? budget.lines.map(serializeBudgetLine) : undefined,
    versions: budget.versions,
    approvals: budget.approvals,
    completion: budget.completion,
  };
}

export function serializeBudgetLine(line) {
  return {
    id: line.id,
    budgetId: line.budgetId,
    accountId: line.accountId,
    accountCodeSnapshot: line.accountCodeSnapshot,
    accountNameSnapshot: line.accountNameSnapshot,
    accountTypeSnapshot: line.accountTypeSnapshot,
    accountCategorySnapshot: line.accountCategorySnapshot,
    parentAccountIdSnapshot: line.parentAccountIdSnapshot,
    branchId: line.branchId,
    departmentId: line.departmentId,
    projectId: line.projectId,
    costCentreId: line.costCentreId,
    lineType: line.lineType,
    calculationMethod: line.calculationMethod,
    annualAmountMinor: big(line.annualAmountMinor),
    annualAmount: fromMinor(line.annualAmountMinor),
    notes: line.notes,
    assumptions: line.assumptions,
    periodAmounts: (line.periodAmounts || []).map((p) => ({
      id: p.id,
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      monthNumber: p.monthNumber,
      quarterNumber: p.quarterNumber,
      plannedAmountMinor: big(p.plannedAmountMinor),
      plannedAmount: fromMinor(p.plannedAmountMinor),
      sourceMethod: p.sourceMethod,
      growthRate: p.growthRate,
      notes: p.notes,
    })),
  };
}

export function serializeForecast(forecast) {
  if (!forecast) return null;
  return {
    ...forecast,
    lines: Array.isArray(forecast.lines)
      ? forecast.lines.map((line) => ({
          id: line.id,
          forecastId: line.forecastId,
          accountId: line.accountId,
          accountCodeSnapshot: line.accountCodeSnapshot,
          accountNameSnapshot: line.accountNameSnapshot,
          accountTypeSnapshot: line.accountTypeSnapshot,
          forecastMethod: line.forecastMethod,
          historicalActualMinor: big(line.historicalActualMinor),
          historicalActual: fromMinor(line.historicalActualMinor),
          budgetAmountMinor: big(line.budgetAmountMinor),
          budgetAmount: fromMinor(line.budgetAmountMinor),
          projectedAmountMinor: big(line.projectedAmountMinor),
          projectedAmount: fromMinor(line.projectedAmountMinor),
          confidenceLevel: line.confidenceLevel,
          growthRate: line.growthRate,
          notes: line.notes,
          periodAmounts: (line.periodAmounts || []).map((p) => ({
            id: p.id,
            periodStart: p.periodStart,
            periodEnd: p.periodEnd,
            actualAmountMinor: big(p.actualAmountMinor),
            actualAmount: fromMinor(p.actualAmountMinor),
            budgetAmountMinor: big(p.budgetAmountMinor),
            budgetAmount: fromMinor(p.budgetAmountMinor),
            forecastAmountMinor: big(p.forecastAmountMinor),
            forecastAmount: fromMinor(p.forecastAmountMinor),
            sourceType: p.sourceType,
            calculationVersion: p.calculationVersion,
          })),
        }))
      : undefined,
  };
}

export function assertTenantBudget(budget, tenantId) {
  if (!budget || budget.tenantId !== tenantId) {
    const err = new Error('Budget not found');
    err.status = 404;
    err.code = 'BUDGET_NOT_FOUND';
    throw err;
  }
}

export { minorToNumber, fromMinor };
