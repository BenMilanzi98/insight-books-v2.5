/**
 * CoA V2 — legacy account alias resolution (Phase 3 §18, §39).
 *
 * Aliases map legacy codes/names to canonical accounts for FUTURE resolution
 * (search, imports, old exports, traceability). They never receive postings and
 * never rewrite posted history — historical journal lines keep their original
 * account references.
 */

import prisma from '../../prisma.js';
import { AccountingValidationError, CrossTenantAccountingError } from '../../accountingV2/domain/errors.js';
import { normalizeAccountCode } from '../domain/codeGovernance.js';
import { AccountLifecycleStatus } from '../domain/behaviours.js';

/**
 * Resolve an account by code for a business, following aliases when the code
 * itself no longer resolves to an active canonical account.
 *
 * Resolution order:
 *  1. Active account with the code → returned directly.
 *  2. Alias row for the code → canonical account (when effective).
 *  3. Deprecated account with the code that has a replacement → replacement.
 *  4. null (caller decides whether that is an error).
 *
 * @param {{businessId: string, requestId?: string, correlationId?: string}} context
 * @param {string} rawCode
 * @param {import('@prisma/client').PrismaClient} [db]
 * @returns {Promise<{account: object, via: 'DIRECT'|'ALIAS'|'REPLACEMENT'}|null>}
 */
export async function resolveAccountByCodeOrAlias(context, rawCode, db = prisma) {
  const code = normalizeAccountCode(rawCode);
  if (!code) return null;

  const direct = await db.account.findFirst({
    where: {
      tenantId: context.businessId,
      OR: [{ accountCode: code }, { code }],
    },
  });
  if (direct && direct.isActive !== false && direct.coaV2Status !== AccountLifecycleStatus.DEPRECATED &&
      direct.coaV2Status !== AccountLifecycleStatus.ARCHIVED) {
    return { account: direct, via: 'DIRECT' };
  }

  const now = new Date();
  const alias = await db.coaV2AccountAlias.findFirst({
    where: { tenantId: context.businessId, aliasCode: code },
  });
  if (alias && (!alias.effectiveTo || new Date(alias.effectiveTo) >= now)) {
    const canonical = await db.account.findFirst({
      where: { id: alias.canonicalAccountId, tenantId: context.businessId },
    });
    if (canonical) return { account: canonical, via: 'ALIAS' };
  }

  if (direct?.replacementAccountId) {
    const replacement = await db.account.findFirst({
      where: { id: direct.replacementAccountId, tenantId: context.businessId },
    });
    if (replacement) return { account: replacement, via: 'REPLACEMENT' };
  }

  return direct ? { account: direct, via: 'DIRECT' } : null;
}

/**
 * Create an alias from a legacy code/name to a canonical account.
 * @param {object} params
 * @param {object} params.db prisma or transaction client
 * @param {object} params.context AccountingContext
 * @param {string} params.aliasCode
 * @param {string|null} [params.aliasName]
 * @param {string|null} [params.legacyAccountId]
 * @param {string} params.canonicalAccountId
 * @param {string} params.reason
 */
export async function createAccountAlias(params) {
  const { db, context } = params;
  const ids = { requestId: context.requestId, correlationId: context.correlationId };
  const aliasCode = normalizeAccountCode(params.aliasCode);
  if (!aliasCode) throw new AccountingValidationError('Alias code is required', ids);
  if (!params.reason || String(params.reason).trim().length < 5) {
    throw new AccountingValidationError('Alias creation requires a documented reason', ids);
  }
  const canonical = await db.account.findFirst({
    where: { id: params.canonicalAccountId, tenantId: context.businessId },
  });
  if (!canonical) {
    throw new CrossTenantAccountingError(
      { aliasCode, canonicalAccountId: params.canonicalAccountId, expected: context.businessId }, ids
    );
  }
  if (canonical.coaV2Status === AccountLifecycleStatus.DEPRECATED ||
      canonical.coaV2Status === AccountLifecycleStatus.ARCHIVED || canonical.isActive === false) {
    throw new AccountingValidationError('Alias target must be an active canonical account', ids);
  }
  if (params.legacyAccountId) {
    const legacy = await db.account.findFirst({
      where: { id: params.legacyAccountId, tenantId: context.businessId },
    });
    if (!legacy) {
      throw new CrossTenantAccountingError(
        { aliasCode, legacyAccountId: params.legacyAccountId, expected: context.businessId }, ids
      );
    }
  }
  return db.coaV2AccountAlias.create({
    data: {
      tenantId: context.businessId,
      aliasCode,
      aliasName: params.aliasName ?? null,
      legacyAccountId: params.legacyAccountId ?? null,
      canonicalAccountId: params.canonicalAccountId,
      reason: params.reason,
      createdBy: context.userId ?? null,
    },
  });
}
