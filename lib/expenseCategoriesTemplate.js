/**
 * LEGACY anti-blueprint expense codes are RETIRED.
 * Canonical expense accounts come only from chartOfAccountsBlueprint.js
 * via ensureChartOfAccountsForTenant / CoA V2 templates.
 *
 * ensureExpenseAccountsForTenant is a no-op (fail-safe: never create colliding 5xxx codes).
 */

import { CHART_OF_ACCOUNTS_BLUEPRINT } from './chartOfAccountsBlueprint.js';

/** @deprecated Use CHART_OF_ACCOUNTS_BLUEPRINT expense rows instead. */
export const EXPENSE_ACCOUNTS_TEMPLATE = CHART_OF_ACCOUNTS_BLUEPRINT.filter(
  (row) => row.type === 'Expense'
).map((row) => ({
  code: row.code,
  name: row.name,
  type: row.type,
  subtype: row.subtype || 'Operating Expense',
  normalBalance: row.normalBalance || 'Debit',
  parentCode: row.parentCode || null,
}));

/**
 * No-op: do not auto-create anti-blueprint expense codes.
 * Expense dropdowns must use CoA postable expense accounts from the blueprint.
 */
export async function ensureExpenseAccountsForTenant(_tenantId, _prismaClient) {
  return new Map();
}
