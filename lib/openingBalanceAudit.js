/**
 * Audit trail for opening balance actions.
 */
import prisma from '@/lib/prisma';

/**
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string} params.userId
 * @param {string} params.action
 * @param {object} [params.details]
 * @param {string|null} [params.entityId]
 * @param {import('@prisma/client').PrismaClient|import('@prisma/client').Prisma.TransactionClient} [db]
 */
export async function logOpeningBalanceAudit(params) {
  const { tenantId, userId, action, details = {}, entityId = null, db = prisma } = params;
  try {
    await db.auditLog.create({
      data: {
        tenantId,
        userId,
        action,
        entityType: 'OPENING_BALANCE',
        entityId: entityId || tenantId,
        details: JSON.stringify(details),
      },
    });
  } catch (err) {
    console.warn('opening balance audit log failed:', err?.message || err);
  }
}
