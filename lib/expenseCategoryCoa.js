/**
 * Expense list / statistics helpers keyed by Chart of Accounts expense accounts.
 */

/**
 * @param {{ category?: string|null, expenseAccount?: { accountCode?: string|null, accountName?: string|null }|null }} expense
 * @returns {string}
 */
export function expenseCategoryDisplayLabel(expense) {
  const code = expense?.expenseAccount?.accountCode;
  const name = expense?.expenseAccount?.accountName;
  if (code && name) return `${code} - ${name}`;
  if (code) return String(code);
  if (name) return String(name);
  return String(expense?.category || 'Uncategorized');
}

/**
 * Build one statistics row per postable CoA expense account.
 *
 * @param {Array<{ id: string, code?: string, accountCode?: string, name?: string, accountName?: string }>} accounts
 * @param {Array<{ expenseAccountId: string, _sum?: { amount?: number|string|null } }>} grouped
 * @param {number|string} [_unusedTotal]
 * @returns {Array<{ category: string, amount: string, accountId: string }>}
 */
export function buildExpenseStatisticsByCoaCategory(accounts, grouped, _unusedTotal) {
  const amountByAccountId = new Map();
  for (const row of grouped || []) {
    amountByAccountId.set(row.expenseAccountId, Number(row._sum?.amount ?? 0));
  }
  return (accounts || []).map((account) => {
    const code = account.code || account.accountCode || '';
    const name = account.name || account.accountName || '';
    const amount = amountByAccountId.get(account.id) ?? 0;
    return {
      accountId: account.id,
      category: code && name ? `${code} - ${name}` : name || code || 'Uncategorized',
      amount: Number(amount).toFixed(2),
    };
  });
}
