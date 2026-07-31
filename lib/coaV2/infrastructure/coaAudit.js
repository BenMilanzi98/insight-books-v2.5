/**
 * CoA V2 — audit trail (Phase 3 §34).
 *
 * Append-only records for every governance change to the Chart of Accounts,
 * written through the Phase 2 accounting audit integration (`AuditLog`).
 * Records carry business, account, user, action, previous/new values, reason,
 * approval, and correlation identifiers. Nothing here mutates accounts.
 */

import { recordAccountingAudit } from '../../accountingV2/infrastructure/auditTrail.js';

export const COA_AUDIT_ACTIONS = Object.freeze({
  ACCOUNT_CREATE: 'coa.account.create',
  ACCOUNT_UPDATE: 'coa.account.update',
  ACCOUNT_MOVE: 'coa.account.move',
  ACCOUNT_DEPRECATE: 'coa.account.deprecate',
  ACCOUNT_ARCHIVE: 'coa.account.archive',
  ACCOUNT_RESTORE: 'coa.account.restore',
  MAPPING_ASSIGN: 'coa.mapping.assign',
  MAPPING_RETIRE: 'coa.mapping.retire',
  ALIAS_CREATE: 'coa.alias.create',
  TEMPLATE_APPLY: 'coa.template.apply',
  CONSOLIDATION_CREATE: 'coa.consolidation.create',
  CONSOLIDATION_APPROVE: 'coa.consolidation.approve',
  CONSOLIDATION_EXECUTE: 'coa.consolidation.execute',
  VALIDATION_RUN: 'coa.validation.run',
  EXPORT: 'coa.export',
});

/**
 * Record a CoA governance audit event. Failures are logged but never abort the
 * business operation that already committed (audit gap is surfaced in logs).
 *
 * @param {object} params
 * @param {string} params.action one of COA_AUDIT_ACTIONS
 * @param {import('../../accountingV2/domain/accountingContext.js').AccountingContext} params.context
 * @param {string} params.entityType e.g. 'Account' | 'CoaV2AccountMapping'
 * @param {string} params.entityId
 * @param {object} [params.previousValues]
 * @param {object} [params.newValues]
 * @param {string} [params.reason]
 * @param {string|null} [params.approvedBy]
 * @param {import('@prisma/client').PrismaClient|object} [db]
 */
export async function recordCoaAudit(params, db = undefined) {
  const { context } = params;
  try {
    await recordAccountingAudit(
      {
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        userId: context.userId,
        tenantId: context.businessId,
        previousValues: params.previousValues ?? null,
        newValues: {
          ...(params.newValues ?? {}),
          ...(params.approvedBy ? { approvedBy: params.approvedBy } : {}),
        },
        reason: params.reason ?? null,
        requestId: context.requestId,
        correlationId: context.correlationId,
      },
      db
    );
  } catch (error) {
    console.error('[coaV2] audit record failed (operation already committed)', {
      action: params.action,
      entityId: params.entityId,
      tenantId: context.businessId,
      error: error?.message,
    });
  }
}
