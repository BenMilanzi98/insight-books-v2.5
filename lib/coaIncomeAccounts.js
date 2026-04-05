/**
 * Chart of Accounts rows that count as income/revenue for POS, sales, and invoices.
 * Many tenants store type only on `accountType`; older/imported data may use `type`,
 * or use non-canonical casing (e.g. INCOME, revenue).
 */
export const COA_INCOME_ACCOUNT_OR = [
  { accountType: { equals: 'Income', mode: 'insensitive' } },
  { accountType: { equals: 'Revenue', mode: 'insensitive' } },
  { type: { equals: 'Income', mode: 'insensitive' } },
  { type: { equals: 'Revenue', mode: 'insensitive' } },
];

/**
 * @param {string} tenantId
 * @param {Record<string, unknown>} [and] — merged into the where (e.g. { id: { in: [...] } })
 */
export function prismaWhereCoaIncomeAccounts(tenantId, and = {}) {
  return {
    tenantId,
    isActive: true,
    ...and,
    OR: COA_INCOME_ACCOUNT_OR,
  };
}
