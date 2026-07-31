import { minorToNumber } from './money.js';

/**
 * Explainable budget completion score (0–100).
 * @param {{
 *   requiredGroupsSelected?: boolean,
 *   lineCount?: number,
 *   monthsWithValues?: number,
 *   totalMonths?: number,
 *   hasRevenue?: boolean,
 *   hasExpense?: boolean,
 *   hasNotes?: boolean,
 *   validationErrorCount?: number,
 * }} input
 */
export function computeBudgetCompletion(input = {}) {
  const checks = [];
  const push = (id, label, weight, passed) => {
    checks.push({ id, label, weight, passed: !!passed, score: passed ? weight : 0 });
  };

  push('groups', 'Required account groups selected', 15, input.requiredGroupsSelected !== false && (input.lineCount || 0) > 0);
  push('lines', 'Budget lines entered', 20, (input.lineCount || 0) > 0);
  const months = input.totalMonths || 12;
  const filled = input.monthsWithValues || 0;
  const monthPct = months > 0 ? filled / months : 0;
  push('months', 'Months completed', 25, monthPct >= 0.8);
  if (monthPct > 0 && monthPct < 0.8) {
    checks[checks.length - 1].score = Math.round(25 * monthPct);
    checks[checks.length - 1].passed = false;
  }
  push('revenue', 'Revenue planned', 15, !!input.hasRevenue);
  push('expense', 'Expenses planned', 15, !!input.hasExpense);
  push('notes', 'Notes or assumptions provided', 5, !!input.hasNotes);
  push('validation', 'Validation errors resolved', 5, !(input.validationErrorCount > 0));

  const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
  const earned = checks.reduce((s, c) => s + c.score, 0);
  const percent = totalWeight ? Math.round((earned / totalWeight) * 100) : 0;
  const remaining = checks.filter((c) => !c.passed).map((c) => c.label);

  return {
    percent,
    label: `Your Budget is ${percent}% complete.`,
    checks,
    remaining,
  };
}

export function summarizeLinesForCompletion(lines = []) {
  let hasRevenue = false;
  let hasExpense = false;
  let hasNotes = false;
  const months = new Set();
  for (const line of lines) {
    const type = String(line.accountTypeSnapshot || line.accountCategorySnapshot || '').toLowerCase();
    if (type.includes('income') || type.includes('revenue')) hasRevenue = true;
    if (type.includes('expense')) hasExpense = true;
    if (line.notes || line.assumptions) hasNotes = true;
    for (const p of line.periodAmounts || []) {
      if (minorToNumber(p.plannedAmountMinor) !== 0) {
        months.add(String(p.periodStart));
      }
    }
  }
  return {
    lineCount: lines.length,
    hasRevenue,
    hasExpense,
    hasNotes,
    monthsWithValues: months.size,
    totalMonths: 12,
    requiredGroupsSelected: lines.length > 0,
  };
}
