/**
 * Branches are an internal implementation detail — one hidden primary location per business.
 * Users never select or manage branches; all reads/writes resolve here server-side.
 */
import prisma from '@/lib/prisma';
import { ensurePrimaryBranchForTenant } from '@/lib/tenantStockAccess';

/**
 * Resolve the tenant's hidden primary branch id (creates "Main location" if missing).
 * @param {string|null|undefined} tenantId
 * @param {import('@prisma/client').Prisma.TransactionClient|typeof prisma} [db]
 * @returns {Promise<string|null>}
 */
export async function resolveHiddenPrimaryBranchId(tenantId, db = prisma) {
  if (!tenantId) return null;
  return ensurePrimaryBranchForTenant(tenantId, db);
}

/**
 * Apply hidden primary branch to a session user object (mutates user).
 * @param {{ id?: string, tenantId?: string|null, currentBranchId?: string|null, primaryBranchId?: string|null, allowedBranchIds?: string[]|null, defaultBranchId?: string|null }} user
 */
export async function applyHiddenPrimaryBranchToUser(user) {
  if (!user?.tenantId) {
    user.primaryBranchId = null;
    user.currentBranchId = null;
    user.allowedBranchIds = null;
    return user;
  }
  const primaryId = await resolveHiddenPrimaryBranchId(user.tenantId);
  user.primaryBranchId = primaryId;
  user.currentBranchId = primaryId;
  user.defaultBranchId = primaryId;
  user.allowedBranchIds = null;
  return user;
}
