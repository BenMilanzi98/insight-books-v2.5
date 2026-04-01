import prisma from './prisma';

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
 * Load user branch assignments and tenant owner/default metadata for access control.
 * Safe on partial schema failures: returns contextLoadFailed so callers can stay permissive.
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
    const [userRow, tenantBranchCount, activeTenant] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          defaultBranchId: true,
          userBranches: {
            where: { branch: { tenantId } },
            select: { branchId: true },
          },
        },
      }),
      prisma.branch.count({ where: { tenantId } }),
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { ownerUserId: true, defaultBranchId: true, name: true },
      }),
    ]);
    if (!userRow) return failed;
    let defaultBranchId = userRow.defaultBranchId ?? null;
    if (defaultBranchId) {
      const validUserDefault = await prisma.branch.findFirst({
        where: { id: defaultBranchId, tenantId },
        select: { id: true },
      });
      if (!validUserDefault) defaultBranchId = null;
    }
    return {
      contextLoadFailed: false,
      defaultBranchId,
      userBranches: userRow.userBranches ?? [],
      tenant: activeTenant,
      tenantBranchCount,
    };
  } catch (e) {
    console.warn('fetchUserBranchAccessContext failed:', e?.message || e);
    return failed;
  }
}

/**
 * Decide which branch IDs a user may access.
 * - null = full tenant scope (all branches / org-wide; session still picks a view when set)
 * - non-empty array = only those branches
 * - [] = explicit "no branch access" (used only if tenantBranchCount is non-zero and the user is not a tenant owner/admin)
 */
export function computeAllowedBranchIds({
  userId,
  tenantId,
  roleName,
  contextLoadFailed,
  tenantBranchCount,
  userBranches,
  tenant,
}) {
  if (!tenantId) {
    return { allowedBranchIds: null };
  }
  if (contextLoadFailed) {
    return { allowedBranchIds: null };
  }

  const isOwner = tenant?.ownerUserId === userId;
  const isMasterAdmin = roleName === 'MASTER_ADMIN';
  const isTenantAdmin = roleName === 'Admin';
  if (isOwner || isMasterAdmin || isTenantAdmin) {
    return { allowedBranchIds: null };
  }

  const assigned = (userBranches ?? []).map((ub) => ub.branchId).filter(Boolean);

  if (tenantBranchCount === 0) {
    return { allowedBranchIds: null };
  }

  if (assigned.length > 0) {
    return { allowedBranchIds: assigned };
  }

  // Default behavior: if the user has no explicit branch assignments, allow all branches.
  // Branch restriction is only enforced when at least one assignment exists.
  return { allowedBranchIds: null };
}

/**
 * Branch id for dashboard/reports (Sale, Invoice, etc.).
 * @returns {string|null|false} null = no branch filter; false = no access
 */
export function getEffectiveDashboardBranchId(user) {
  const allowed = user?.allowedBranchIds;
  const sessionBranch = normalizeBranchId(user?.currentBranchId);

  if (allowed == null) {
    return sessionBranch;
  }
  if (!Array.isArray(allowed) || allowed.length === 0) {
    return false;
  }
  if (allowed.length === 1) {
    return allowed[0];
  }
  if (sessionBranch && allowed.includes(sessionBranch)) {
    return sessionBranch;
  }
  return allowed[0];
}

/**
 * Branch context for product/inventory lists (branch-specific + global products).
 * @returns {string|null|false} false = no access
 */
/**
 * Enforce branch assignments on a DB-validated branch id (writes: invoices, expenses, sales, etc.).
 * @param {string|null} resolved - Tenant-valid active branch id or null
 * @returns {string|null}
 */
export function clampResolvedBranchToUserAccess(user, resolved) {
  const allowed = user?.allowedBranchIds;
  if (allowed == null) {
    return resolved ?? null;
  }
  if (!Array.isArray(allowed)) {
    return resolved ?? null;
  }
  if (allowed.length === 0) {
    throw new Error('No branch access assigned for your account. Ask an administrator to assign you to a branch.');
  }
  if (resolved != null && resolved !== '') {
    if (!allowed.includes(resolved)) {
      throw new Error('You do not have access to this branch');
    }
    return resolved;
  }
  const sessionBranch = normalizeBranchId(user?.currentBranchId);
  if (sessionBranch && allowed.includes(sessionBranch)) {
    return sessionBranch;
  }
  const def = user?.defaultBranchId && allowed.includes(user.defaultBranchId) ? user.defaultBranchId : null;
  if (def) return def;
  return allowed[0];
}

export function resolveProductListBranchId(user, queryBranchId) {
  const allowed = user?.allowedBranchIds;
  const q = normalizeBranchId(queryBranchId);

  if (allowed == null) {
    const fromSession = normalizeBranchId(user?.currentBranchId);
    const def = normalizeBranchId(user?.defaultBranchId);
    return q || fromSession || def || null;
  }
  if (!Array.isArray(allowed) || allowed.length === 0) {
    return false;
  }
  if (q && allowed.includes(q)) {
    return q;
  }
  const sessionBranch = normalizeBranchId(user?.currentBranchId);
  if (sessionBranch && allowed.includes(sessionBranch)) {
    return sessionBranch;
  }
  const def = user?.defaultBranchId && allowed.includes(user.defaultBranchId) ? user.defaultBranchId : null;
  if (def) return def;
  return allowed.length === 1 ? allowed[0] : allowed[0];
}
