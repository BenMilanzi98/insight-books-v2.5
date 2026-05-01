/**
 * GL codes allowed for /expenses category picker — matches `chart of accounts structure.txt`
 * EXPENSES (5000) subtree (lines 55–73): Cost of Sales, Salaries & Wages, operating leaves, catch-all 5900.
 */

export const SYSTEM_EXPENSE_STRUCTURE_CODES = new Set([
  '5100',
  '5110',
  '5120',
  '5130',
  '5140',
  '5200',
  '5201',
  '5202',
  '5203',
  '5210',
  '5300',
  '5310',
  '5320',
  '5330',
  '5340',
  '5400',
  '5500',
  '5900',
]);

/** @param {string|null|undefined} c */
export function normExpenseCategoryCode(c) {
  return String(c ?? '')
    .trim()
    .replace(/\s+/g, '');
}

/** @param {string|null|undefined} c */
export function isSystemExpenseStructureCode(c) {
  const n = normExpenseCategoryCode(c);
  return SYSTEM_EXPENSE_STRUCTURE_CODES.has(n);
}
