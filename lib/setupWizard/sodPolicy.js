/**
 * C2 — policy-driven segregation of duties for setup.
 */

import prisma from '../prisma.js';

/**
 * Solo / single-admin tenants may prepare + approve + post.
 * When two or more distinct finance-capable users exist, self-approval is denied.
 *
 * @param {string} tenantId
 * @param {import('@prisma/client').PrismaClient} [db]
 */
export async function resolveSetupSodPolicy(tenantId, db = prisma) {
  let financeUserCount = 1;
  try {
    const memberships = await db.tenantMembership.findMany({
      where: { tenantId, status: 'active' },
      select: {
        userId: true,
        role: { select: { name: true, permissions: true } },
      },
    });
    const finance = memberships.filter((m) => {
      const perms = m.role?.permissions;
      if (Array.isArray(perms) && perms.some((p) => String(p).includes('settings') || String(p).includes('openingBalances') || String(p).includes('setup'))) {
        return true;
      }
      const name = String(m.role?.name || '').toLowerCase();
      return /owner|admin|accountant|finance|bookkeeper/.test(name);
    });
    const unique = new Set(finance.map((m) => m.userId));
    financeUserCount = Math.max(unique.size, memberships.length > 0 ? unique.size : 1);
  } catch {
    financeUserCount = 1;
  }

  const allowCombinedRoles = financeUserCount <= 1;
  return {
    allowCombinedRoles,
    allowSelfApproval: allowCombinedRoles,
    requireSeparatePoster: !allowCombinedRoles,
    financeUserCount,
    policy: allowCombinedRoles ? 'SOLO_COMBINED' : 'SEGREGATED',
  };
}

/**
 * @param {{ allowSelfApproval: boolean }} policy
 * @param {string|null|undefined} preparerId
 * @param {string} actorId
 */
export function assertSetupApprovalAllowed(policy, preparerId, actorId) {
  if (policy.allowSelfApproval) return;
  if (preparerId && preparerId === actorId) {
    const err = new Error('Self-approval is not allowed for this business.');
    err.code = 'SETUP_SELF_APPROVAL_DENIED';
    throw err;
  }
}
