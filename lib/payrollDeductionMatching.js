/**
 * Identify Malawi PAYE / NPS deduction rows consistently across payroll APIs.
 * Avoid overly broad patterns (e.g. statutory + substring "tax") that misclassify
 * unrelated deductions and distort PAYE when combined with NPS.
 */

/**
 * @param {{ name?: string | null, isStatutory?: boolean } | null | undefined} d
 * @returns {boolean}
 */
export function deductionMatchesPaye(d) {
  if (!d?.name || typeof d.name !== 'string') return false;
  const n = d.name.toLowerCase().trim();
  if (n.includes('paye')) return true;
  if (n.includes('pay as you earn')) return true;
  if (n.includes('income tax')) return true;
  if (d.isStatutory && n === 'tax') return true;
  return false;
}

/**
 * @param {{ name?: string | null, isStatutory?: boolean } | null | undefined} d
 * @returns {boolean}
 */
export function deductionMatchesNps(d) {
  if (!d?.name || typeof d.name !== 'string') return false;
  const n = d.name.toLowerCase().trim();
  if (n.includes('nps')) return true;
  if (d.isStatutory && n.includes('pension')) return true;
  return false;
}
