/**
 * CoA V2 — purpose-mapping readiness + soft FK integrity (Phase 3 sole source of truth).
 *
 * Read-only assessment: which system purposes have an ACTIVE CoaV2AccountMapping,
 * plus soft checks that PaymentAccount / ExpenseCategory rows point at CoA accounts.
 */

import prisma from '../../prisma.js';
import { SYSTEM_ACCOUNT_PURPOSES } from '../domain/systemPurposes.js';

/**
 * Standard purposes backfilled / required for operational posting readiness.
 * Subset of SYSTEM_ACCOUNT_PURPOSES — not every catalogue entry is mandatory.
 */
export const STANDARD_PURPOSE_MAPPINGS = Object.freeze([
  'CASH_ON_HAND',
  'PETTY_CASH',
  'PRIMARY_BANK',
  'MOBILE_MONEY',
  'ACCOUNTS_RECEIVABLE',
  'ACCOUNTS_PAYABLE',
  'GRNI',
  'INVENTORY',
  'SALES_REVENUE',
  'SERVICE_REVENUE',
  'COST_OF_SALES',
  'VAT_INPUT',
  'VAT_OUTPUT',
  'DEFERRED_REVENUE',
  'WITHHOLDING_TAX_PAYABLE',
  'SALARIES_AND_WAGES',
  'OWNER_CAPITAL',
  'RETAINED_EARNINGS',
  'OPENING_BALANCE_EQUITY',
]);

/**
 * @param {string} tenantId
 * @param {import('@prisma/client').PrismaClient|object} [db]
 * @param {{purposes?: string[]}} [opts]
 * @returns {Promise<{ ready: boolean, missing: string[], mapped: string[], purposes: string[] }>}
 */
export async function getPurposeMappingReadiness(tenantId, db = prisma, opts = {}) {
  const purposes = opts.purposes ?? STANDARD_PURPOSE_MAPPINGS;
  const rows = await db.coaV2AccountMapping.findMany({
    where: {
      tenantId,
      status: 'ACTIVE',
      purpose: { in: purposes },
      moduleKey: '*',
      transactionType: '*',
      currency: '*',
      branchKey: '*',
    },
    select: { purpose: true, accountId: true },
  });
  const mappedSet = new Set(rows.map((r) => r.purpose));
  const mapped = purposes.filter((p) => mappedSet.has(p));
  const missing = purposes.filter((p) => !mappedSet.has(p));
  return {
    ready: missing.length === 0,
    missing,
    mapped,
    purposes: [...purposes],
  };
}

/**
 * Soft integrity: PaymentAccount posting requires coaAccountId; ExpenseCategory requires accountId.
 * Schema already requires ExpenseCategory.accountId — this flags orphans / inactive targets.
 *
 * @param {string} tenantId
 * @param {import('@prisma/client').PrismaClient|object} [db]
 * @returns {Promise<{
 *   ok: boolean,
 *   paymentAccountsMissingCoa: Array<{id: string, name: string|null}>,
 *   expenseCategoriesMissingAccount: Array<{id: string, name: string|null}>,
 *   expenseCategoriesOrphanAccount: Array<{id: string, name: string|null, accountId: string}>,
 * }>}
 */
export async function validateCoaFkIntegrity(tenantId, db = prisma) {
  const [paymentAccounts, expenseCategories] = await Promise.all([
    db.paymentAccount.findMany({
      where: { tenantId, isActive: true, coaAccountId: null },
      select: { id: true, name: true },
    }),
    db.expenseCategory.findMany({
      where: { tenantId },
      select: { id: true, name: true, accountId: true },
    }),
  ]);

  const paymentAccountsMissingCoa = paymentAccounts.map((p) => ({
    id: p.id,
    name: p.name ?? null,
  }));

  const expenseCategoriesMissingAccount = expenseCategories
    .filter((c) => !c.accountId)
    .map((c) => ({ id: c.id, name: c.name ?? null }));

  const accountIds = [
    ...new Set(expenseCategories.map((c) => c.accountId).filter(Boolean)),
  ];
  const existing = accountIds.length
    ? await db.account.findMany({
        where: { tenantId, id: { in: accountIds } },
        select: { id: true },
      })
    : [];
  const existingSet = new Set(existing.map((a) => a.id));
  const expenseCategoriesOrphanAccount = expenseCategories
    .filter((c) => c.accountId && !existingSet.has(c.accountId))
    .map((c) => ({ id: c.id, name: c.name ?? null, accountId: c.accountId }));

  const ok =
    paymentAccountsMissingCoa.length === 0 &&
    expenseCategoriesMissingAccount.length === 0 &&
    expenseCategoriesOrphanAccount.length === 0;

  return {
    ok,
    paymentAccountsMissingCoa,
    expenseCategoriesMissingAccount,
    expenseCategoriesOrphanAccount,
  };
}

/**
 * Combined readiness for a tenant (purpose mappings + soft FK checks).
 * @param {string} tenantId
 * @param {import('@prisma/client').PrismaClient|object} [db]
 */
export async function assessPurposeMappingReadiness(tenantId, db = prisma) {
  const [purposes, fk] = await Promise.all([
    getPurposeMappingReadiness(tenantId, db),
    validateCoaFkIntegrity(tenantId, db),
  ]);
  return {
    ready: purposes.ready && fk.ok,
    purposes,
    fkIntegrity: fk,
    knownCatalogueSize: Object.keys(SYSTEM_ACCOUNT_PURPOSES).length,
  };
}
