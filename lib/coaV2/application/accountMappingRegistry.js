/**
 * CoA V2 — Account Mapping Registry (Phase 3 §13–14).
 *
 * Implements the Phase 2 `AccountMappingService` contract with a configured,
 * business-scoped, audited registry (`CoaV2AccountMapping`).
 *
 * Resolution rules (all mandatory):
 *  - registry rows only — NEVER hardcoded DB ids, name matching, first-in-category,
 *    accounts from other businesses, inactive accounts, headers, or silent fallbacks;
 *  - context precedence: module+type+currency+branch > … > purpose default ("*" sentinels);
 *  - missing mapping → typed MissingAccountMappingError (no suspense fallback);
 *  - transition: while `coaV2CanonicalMappings` is OFF for the business, a missing
 *    registry row falls back to the Phase 2 legacy-code adapter (still typed-error,
 *    still no auto-create). When the flag is ON the registry is authoritative.
 */

import prisma from '../../prisma.js';
import {
  MissingAccountMappingError,
  InactiveAccountError,
  NonPostingAccountError,
  CrossTenantAccountingError,
  AccountingValidationError,
} from '../../accountingV2/domain/errors.js';
import { isFlagEnabled } from '../../accountingV2/infrastructure/featureFlags.js';
import { COA_FLAG } from '../infrastructure/coaFlags.js';
import { resolveLegacyMappedAccount } from '../../accountingV2/infrastructure/legacy/legacyAccountMappingAdapter.js';
import { SYSTEM_ACCOUNT_PURPOSES, validateAccountForPurpose, isSystemAccountPurpose } from '../domain/systemPurposes.js';
import { AccountLifecycleStatus, accountAcceptsNewPostings } from '../domain/behaviours.js';

const ANY = '*';

/** Specificity: each concrete context key beats a sentinel. */
function mappingSpecificity(row) {
  let score = 0;
  if (row.moduleKey !== ANY) score += 8;
  if (row.transactionType !== ANY) score += 4;
  if (row.currency !== ANY) score += 2;
  if (row.branchKey !== ANY) score += 1;
  return score;
}

function withinEffectiveWindow(row, at) {
  const t = at ? new Date(at).getTime() : Date.now();
  if (row.effectiveFrom && t < new Date(row.effectiveFrom).getTime()) return false;
  if (row.effectiveTo && t > new Date(row.effectiveTo).getTime()) return false;
  return true;
}

/**
 * Find the best ACTIVE mapping row for a purpose and context.
 * @param {import('@prisma/client').PrismaClient} db
 * @param {{businessId: string}} context
 * @param {string} purpose
 * @param {{module?: string, transactionType?: string, currency?: string, branchId?: string, at?: Date}} [opts]
 */
export async function findActiveMapping(db, context, purpose, opts = {}) {
  const rows = await db.coaV2AccountMapping.findMany({
    where: {
      tenantId: context.businessId,
      purpose,
      status: 'ACTIVE',
      moduleKey: { in: [opts.module ?? ANY, ANY] },
      transactionType: { in: [opts.transactionType ?? ANY, ANY] },
      currency: { in: [opts.currency ?? ANY, ANY] },
      branchKey: { in: [opts.branchId ?? ANY, ANY] },
    },
  });
  const candidates = rows.filter((r) => withinEffectiveWindow(r, opts.at));
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => mappingSpecificity(b) - mappingSpecificity(a) || b.priority - a.priority);
  return candidates[0];
}

/**
 * Validate a mapped account row before returning it as a posting target.
 * Throws typed errors — never returns an unusable account.
 */
export function assertMappedAccountUsable(account, { purpose, context }) {
  const ids = { requestId: context.requestId, correlationId: context.correlationId };
  if (!account) {
    throw new MissingAccountMappingError(purpose, ids);
  }
  if (account.tenantId !== context.businessId) {
    throw new CrossTenantAccountingError(
      { purpose, accountId: account.id, accountTenant: account.tenantId, expected: context.businessId },
      ids
    );
  }
  if (account.isActive === false || account.coaV2Status === AccountLifecycleStatus.ARCHIVED) {
    throw new InactiveAccountError({ purpose, accountId: account.id }, ids);
  }
  if (account.coaV2Status === AccountLifecycleStatus.DEPRECATED) {
    throw new NonPostingAccountError(
      { purpose, accountId: account.id, reason: 'account is deprecated' }, ids
    );
  }
  const activeChildren = account._count?.childAccounts ?? 0;
  if (activeChildren > 0 || account.coaV2Behaviour === 'HEADER') {
    throw new NonPostingAccountError(
      { purpose, accountId: account.id, reason: 'header/parent account' }, ids
    );
  }
  if (!accountAcceptsNewPostings({
    behaviour: account.coaV2Behaviour,
    status: account.coaV2Status,
    postingAllowed: account.postingAllowed,
    isActive: account.isActive,
  })) {
    throw new NonPostingAccountError(
      { purpose, accountId: account.id, reason: 'account does not accept new postings' }, ids
    );
  }
  return account;
}

/**
 * Resolve a system purpose to a validated posting account for the context business.
 *
 * @param {import('../../accountingV2/domain/accountingContext.js').AccountingContext} context
 * @param {string} purpose SystemAccountPurpose value (also accepts Phase 2 legacy mapping keys)
 * @param {{module?: string, transactionType?: string, currency?: string, branchId?: string, at?: Date}} [opts]
 * @param {import('@prisma/client').PrismaClient} [db]
 * @returns {Promise<object>} Account row
 */
export async function resolvePurposeAccount(context, purpose, opts = {}, db = prisma) {
  const canonicalPurpose = normalizePurposeKey(purpose);
  const ids = { requestId: context.requestId, correlationId: context.correlationId };

  const mapping = await findActiveMapping(db, context, canonicalPurpose, opts);
  if (mapping) {
    const account = await db.account.findFirst({
      where: { id: mapping.accountId, tenantId: context.businessId },
      include: { _count: { select: { childAccounts: { where: { isActive: true } } } } },
    });
    return assertMappedAccountUsable(account, { purpose: canonicalPurpose, context });
  }

  // Transition fallback: legacy blueprint codes, only while canonical mappings are OFF.
  const canonicalOnly = await isFlagEnabled(db, COA_FLAG.CANONICAL_MAPPINGS, {
    tenantId: context.businessId,
    moduleKey: opts.module,
  });
  if (!canonicalOnly) {
    const legacyKey = LEGACY_KEY_BY_PURPOSE[canonicalPurpose];
    if (legacyKey) {
      return resolveLegacyMappedAccount(context, legacyKey, db);
    }
  }
  throw new MissingAccountMappingError(canonicalPurpose, ids);
}

/**
 * Assign (create or replace) a mapping. Validates the target account against the
 * purpose constraints; the API layer authorizes + audits the change.
 *
 * @param {object} params
 * @param {import('@prisma/client').PrismaClient|object} params.db transaction client
 * @param {object} params.context AccountingContext
 * @param {string} params.purpose
 * @param {string} params.accountId
 * @param {{module?: string, transactionType?: string, currency?: string, branchId?: string}} [params.scope]
 * @param {string|null} [params.approvedBy]
 * @returns {Promise<{mapping: object, previous: object|null}>}
 */
export async function assignMapping(params) {
  const { db, context, purpose, accountId } = params;
  const scope = params.scope ?? {};
  const ids = { requestId: context.requestId, correlationId: context.correlationId };

  if (!isSystemAccountPurpose(purpose)) {
    throw new AccountingValidationError(`Unknown system account purpose: ${purpose}`, ids);
  }
  const account = await db.account.findFirst({
    where: { id: accountId, tenantId: context.businessId },
    include: { _count: { select: { childAccounts: { where: { isActive: true } } } } },
  });
  if (!account) {
    throw new CrossTenantAccountingError({ purpose, accountId, expected: context.businessId }, ids);
  }
  const check = validateAccountForPurpose(purpose, {
    tenantId: account.tenantId,
    category: account.coaV2Category,
    subType: account.coaV2SubType,
    behaviour: account.coaV2Behaviour,
    normalBalance: account.coaV2NormalBalance,
    status: account.coaV2Status ?? AccountLifecycleStatus.ACTIVE,
    isActive: account.isActive,
    hasActiveChildren: (account._count?.childAccounts ?? 0) > 0,
  }, { businessId: context.businessId });
  if (!check.valid) {
    throw new AccountingValidationError(
      `Account is not eligible for purpose ${purpose}: ${check.errors.join('; ')}`, ids
    );
  }

  const key = {
    tenantId: context.businessId,
    purpose,
    moduleKey: scope.module ?? ANY,
    transactionType: scope.transactionType ?? ANY,
    currency: scope.currency ?? ANY,
    branchKey: scope.branchId ?? ANY,
  };
  const previous = await db.coaV2AccountMapping.findUnique({
    where: { tenantId_purpose_moduleKey_transactionType_currency_branchKey: key },
  });
  const mapping = await db.coaV2AccountMapping.upsert({
    where: { tenantId_purpose_moduleKey_transactionType_currency_branchKey: key },
    create: {
      ...key,
      accountId,
      status: 'ACTIVE',
      createdBy: context.userId ?? null,
      approvedBy: params.approvedBy ?? null,
    },
    update: {
      accountId,
      status: 'ACTIVE',
      updatedBy: context.userId ?? null,
      approvedBy: params.approvedBy ?? null,
    },
  });
  return { mapping, previous };
}

/**
 * Retire a mapping (future postings stop resolving through it).
 */
export async function retireMapping({ db, context, mappingId }) {
  const ids = { requestId: context.requestId, correlationId: context.correlationId };
  const mapping = await db.coaV2AccountMapping.findFirst({
    where: { id: mappingId, tenantId: context.businessId },
  });
  if (!mapping) {
    throw new AccountingValidationError('Mapping not found for this business', ids);
  }
  return db.coaV2AccountMapping.update({
    where: { id: mapping.id },
    data: { status: 'RETIRED', updatedBy: context.userId ?? null, effectiveTo: new Date() },
  });
}

/** Phase 2 legacy mapping key → V2 purpose (both directions). */
export const PURPOSE_BY_LEGACY_KEY = Object.freeze({
  ACCOUNTS_RECEIVABLE: 'ACCOUNTS_RECEIVABLE',
  INVENTORY: 'INVENTORY',
  ACCOUNTS_PAYABLE: 'ACCOUNTS_PAYABLE',
  GRNI: 'GRNI',
  VAT_OUTPUT: 'VAT_OUTPUT',
  DEFERRED_REVENUE: 'DEFERRED_REVENUE',
  VAT_INPUT: 'VAT_INPUT',
  WITHHOLDING_TAX: 'WITHHOLDING_TAX_PAYABLE',
  PAYE_PAYABLE: 'PAYE_PAYABLE',
  SALARIES_EXPENSE: 'SALARIES_AND_WAGES',
  COST_OF_SALES: 'COST_OF_SALES',
  INVENTORY_LOSS: 'INVENTORY_ADJUSTMENT',
  OWNER_CAPITAL: 'OWNER_CAPITAL',
  OPENING_BALANCE_EQUITY: 'OPENING_BALANCE_EQUITY',
  RETAINED_EARNINGS: 'RETAINED_EARNINGS',
  SALARY_ADVANCE: 'SALARY_ADVANCE',
  DEFAULT_REVENUE: 'SALES_REVENUE',
  POS_REVENUE: 'SERVICE_REVENUE',
  CASH_ON_HAND: 'CASH_ON_HAND',
  BANK: 'PRIMARY_BANK',
  OTHER_INCOME: 'OTHER_INCOME',
});

export const LEGACY_KEY_BY_PURPOSE = Object.freeze(
  Object.fromEntries(Object.entries(PURPOSE_BY_LEGACY_KEY).map(([legacy, purpose]) => [purpose, legacy]))
);

/** Accept either a V2 purpose or a Phase 2 legacy mapping key. */
export function normalizePurposeKey(key) {
  if (SYSTEM_ACCOUNT_PURPOSES[key]) return key;
  if (PURPOSE_BY_LEGACY_KEY[key]) return PURPOSE_BY_LEGACY_KEY[key];
  return key; // unknown keys fail downstream with MissingAccountMappingError
}

/**
 * Phase 2 contract implementation: `AccountMappingService.resolveMappedAccount`.
 * Same signature as the legacy adapter it replaces.
 */
export async function resolveMappedAccountV2(context, mappingKey, db = prisma) {
  return resolvePurposeAccount(context, mappingKey, {}, db);
}
