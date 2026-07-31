/**
 * Accounting V2 — audit trail integration.
 *
 * Writes append-only records to the existing `AuditLog` model for architecture and
 * configuration changes. Application workflows never edit or delete these rows.
 */

import prisma from '../../prisma.js';

/**
 * @param {object} params
 * @param {string} params.action e.g. 'acctv2.flag.change'
 * @param {string} params.entityType
 * @param {string} params.entityId
 * @param {string} params.userId
 * @param {string|null} [params.tenantId]
 * @param {object} [params.previousValues]
 * @param {object} [params.newValues]
 * @param {string} [params.reason]
 * @param {string} [params.requestId]
 * @param {string} [params.correlationId]
 * @param {string|null} [params.ipAddress]
 * @param {import('@prisma/client').PrismaClient|import('@prisma/client').Prisma.TransactionClient} [db]
 */
export async function recordAccountingAudit(params, db = prisma) {
  return db.auditLog.create({
    data: {
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      userId: params.userId,
      tenantId: params.tenantId ?? null,
      ipAddress: params.ipAddress ?? null,
      details: JSON.stringify({
        previousValues: params.previousValues ?? null,
        newValues: params.newValues ?? null,
        reason: params.reason ?? null,
        requestId: params.requestId ?? null,
        correlationId: params.correlationId ?? null,
        scope: 'accountingV2',
      }),
    },
  });
}

export const AUDIT_ACTIONS = Object.freeze({
  FLAG_CHANGE: 'acctv2.flag.change',
  CONFIG_CHANGE: 'acctv2.config.change',
  POSTING_MODE_CHANGE: 'acctv2.postingMode.change',
  IDEMPOTENCY_CONFLICT: 'acctv2.idempotency.conflict',
  CROSS_TENANT_BLOCKED: 'acctv2.crossTenant.blocked',
  SHADOW_COMPARISON: 'acctv2.shadow.comparison',
  LEGACY_ADAPTER_FAILURE: 'acctv2.legacyAdapter.failure',
});
