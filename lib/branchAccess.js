import prisma from './prisma';
import { resolveHiddenPrimaryBranchId } from './hiddenPrimaryBranch';

/**
 * Normalize branch ID from session or API (string or { id }).
 */
export function normalizeBranchId(value) {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value?.id && typeof value.id === 'string') return value.id;
  return null;
}

/**
 * @deprecated Branch assignments are not exposed to users. Kept for compatibility.
 */
export async function fetchUserBranchAccessContext(userId, tenantId) {
  const failed = {
    contextLoadFailed: true,
    defaultBranchId: null,
    userBranches: [],
    tenant: null,
    tenantBranchCount: null,
  };
  if (!userId || !tenantId) {
    return { ...failed, contextLoadFailed: false };
  }
  try {
    const [activeTenant, tenantBranchCount] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { ownerUserId: true, defaultBranchId: true, name: true },
      }),
      prisma.branch.count({ where: { tenantId } }),
    ]);
    const primaryId = await resolveHiddenPrimaryBranchId(tenantId);
    return {
      contextLoadFailed: false,
      defaultBranchId: primaryId,
      userBranches: [],
      tenant: activeTenant,
      tenantBranchCount,
    };
  } catch (e) {
    console.warn('fetchUserBranchAccessContext failed:', e?.message || e);
    return failed;
  }
}

/**
 * All users have full business scope — branch restriction is disabled.
 */
export function computeAllowedBranchIds() {
  return { allowedBranchIds: null };
}

/**
 * Hidden primary branch for dashboard/report filters (single-business view).
 * @returns {string|null|false} false = no tenant / no access
 */
export function getEffectiveDashboardBranchId(user) {
  if (!user?.tenantId) return false;
  const primary =
    normalizeBranchId(user.primaryBranchId) ||
    normalizeBranchId(user.currentBranchId) ||
    normalizeBranchId(user.defaultBranchId);
  return primary;
}

/**
 * Writes always use the hidden primary branch — no per-user branch restrictions.
 */
export function clampResolvedBranchToUserAccess(_user, resolved) {
  return resolved ?? null;
}

/**
 * Product/inventory lists are tenant-wide (branch is internal only).
 * @returns {string|null|false}
 */
export function resolveProductListBranchId(_user, _queryBranchId) {
  return null;
}
