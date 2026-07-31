import prisma from '../prisma.js';

/**
 * Resolve whether document reversals require a separate approver for this tenant.
 * Default true (fail-closed SoD) when settings row is missing.
 */
export async function resolveReversalSodPolicy({ tenantId, db = prisma }) {
  if (!tenantId) {
    return { requireSeparateApprover: true, source: 'default' };
  }
  try {
    const settings = await db.tenantSettings.findUnique({
      where: { tenantId },
      select: { reversalRequireSeparateApprover: true },
    });
    if (!settings) {
      return { requireSeparateApprover: true, source: 'default-missing-settings' };
    }
    return {
      requireSeparateApprover: settings.reversalRequireSeparateApprover !== false,
      source: 'tenantSettings',
    };
  } catch {
    // Column may not exist until migrate+generate — fail closed.
    return { requireSeparateApprover: true, source: 'fallback-error' };
  }
}

export function assertSeparateApprover({ requireSeparateApprover, requestedById, actorUserId }) {
  if (!requireSeparateApprover) return;
  if (!requestedById || !actorUserId) return;
  if (String(requestedById) === String(actorUserId)) {
    const err = new Error(
      'Segregation of duties: the requester cannot approve or execute this reversal.'
    );
    err.code = 'SOD_SAME_ACTOR';
    throw err;
  }
}
