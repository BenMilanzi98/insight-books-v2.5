// lib/auth.js
import { cookies } from 'next/headers';
import prisma from './prisma';
import { fetchUserBranchAccessContext, computeAllowedBranchIds } from './branchAccess';
import { parseSessionPayload } from './sessionCookie';
import { isFullAccessTenantRole, isPosDefaultLandingRole } from './tenantRoleAccess';
import { hasPermissionInSet } from './permissionUtils';

export { parseSessionPayload } from './sessionCookie';

/**
 * Raw session token (base64) from the incoming request: cookie first, then Authorization Bearer,
 * then raw Cookie header (fallback when cookies() does not expose the value in some runtimes).
 */
export async function getSessionTokenFromRequest(request) {
  const cookieStore = await cookies();
  let sessionValue = cookieStore.get('session')?.value;

  if (!sessionValue && request?.headers) {
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      sessionValue = authHeader.substring(7).trim();
    }
  }

  if (!sessionValue && request?.headers) {
    const rawCookie = request.headers.get('cookie') || '';
    const match = rawCookie.match(/(?:^|;\s*)session=([^;]+)/);
    if (match) {
      try {
        sessionValue = decodeURIComponent(match[1].trim());
      } catch {
        sessionValue = match[1].trim();
      }
    }
  }

  return sessionValue || null;
}

/**
 * Loads branch assignments and sets allowedBranchIds + defaultBranchId on the session user.
 * Mutates `user` (expects id, tenantId, role.name, currentBranchId).
 */
/**
 * Override `user.role` (and roleId) from active TenantMembership when present.
 * Keeps multi-business RBAC aligned across getUserFromSession, /api/auth/me, and login.
 * @param {{ id: string, role?: object | null, roleId?: string | null }} user
 * @param {string | null | undefined} tenantId
 * @returns {Promise<typeof user>}
 */
export async function applyTenantMembershipRole(user, tenantId) {
  if (!user?.id || !tenantId) return user;
  try {
    const membership = await prisma.tenantMembership.findUnique({
      where: {
        userId_tenantId: {
          userId: user.id,
          tenantId,
        },
      },
      select: {
        status: true,
        role: {
          select: { id: true, name: true, permissions: true },
        },
      },
    });

    if (membership?.status === 'active' && membership.role) {
      user.role = membership.role;
      user.roleId = membership.role.id;
      user.roleSource = 'tenantMembership';
    }
  } catch (membershipError) {
    console.warn(
      'Tenant membership role lookup failed (falling back to global role):',
      membershipError?.message || membershipError
    );
  }
  return user;
}

export async function applyBranchAccessToSessionUser(user) {
  const ctx = await fetchUserBranchAccessContext(user.id, user.tenantId);
  const { allowedBranchIds } = computeAllowedBranchIds({
    userId: user.id,
    tenantId: user.tenantId,
    roleName: user.role?.name ?? null,
    contextLoadFailed: ctx.contextLoadFailed,
    tenantBranchCount: ctx.tenantBranchCount,
    userBranches: ctx.userBranches,
    tenant: ctx.tenant,
  });
  user.defaultBranchId = ctx.defaultBranchId ?? null;
  user.allowedBranchIds = allowedBranchIds;
  if (user.allowedBranchIds && user.currentBranchId && !user.allowedBranchIds.includes(user.currentBranchId)) {
    user.currentBranchId = null;
  }
  if (Array.isArray(user.allowedBranchIds) && user.allowedBranchIds.length === 0) {
    user.currentBranchId = null;
  }
  return user;
}

/**
 * Get the current logged-in user from the session cookie or Bearer token.
 * @param {Request} request - The request object
 * @returns {Promise<Object|null>} The user object or null if not authenticated
 */
export async function getUserFromSession(request) {
  try {
    const sessionValue = await getSessionTokenFromRequest(request);

    if (!sessionValue) {
      return null;
    }

    try {
      const sessionData = parseSessionPayload(sessionValue);
      if (!sessionData) {
        console.log('Invalid session payload');
        return null;
      }

      // Get user data from database. Use minimal select first so DBs without userBranches/defaultBranchId don't throw.
      let user = await prisma.user.findUnique({
        where: { id: sessionData.userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: {
            select: {
              id: true,
              name: true,
              permissions: true
            }
          },
          roleId: true,
          tenantId: true,
          isActive: true
        }
      });

      if (!user || !user.isActive) {
        return null;
      }

      // Prefer tenant from session (set at login or tenant switch) so APIs see the active tenant
      if (sessionData.tenantId != null) {
        user.tenantId = sessionData.tenantId;
      }
      user.currentBranchId = sessionData.branchId || null;

      await applyTenantMembershipRole(user, user.tenantId);

      try {
        await applyBranchAccessToSessionUser(user);
      } catch (branchCalcError) {
        console.error('Branch access calculation failed (non-fatal, allowing all branches):', branchCalcError?.message || branchCalcError);
        user.allowedBranchIds = null;
      }

      return user;
    } catch (error) {
      // Distinguish DB/Prisma errors (e.g. wrong DATABASE_URL) from session parse errors for easier debugging
      const isDbError = error?.code?.startsWith?.('P') || /can't reach|connection|database|prisma/i.test(error?.message || '');
      if (isDbError) {
        console.error('Database error during session lookup (check DATABASE_URL):', error?.message || error);
      } else {
        console.error('Error parsing session:', error.message);
        console.error('Session token value:', sessionValue?.substring(0, 50) + '...');
      }
      return null;
    }
  } catch (error) {
    console.error('Error in getUserFromSession:', error);
    return null;
  }
}

/**
 * Check if a user has a specific permission
 * @param {Object} user - The user object
 * @param {string} permission - Permission string in format "category.action" (e.g., "expenses.create")
 * @returns {boolean} Whether the user has the permission
 */
export function hasPermission(user, permission) {
  if (!user || !user.role) {
    return false;
  }

  // Tenant Owner / Admin / master admin variants: full access (aligned with `isFullAccessTenantRole`).
  if (isFullAccessTenantRole(user)) {
    return true;
  }

  if (permission === 'dashboard.view' && isPosDefaultLandingRole(user)) {
    return false;
  }

  if (!user.role.permissions) {
    return false;
  }

  return hasPermissionInSet(user.role.permissions, permission);
}

/** First screen after login: dashboard if allowed, otherwise POS (e.g. Sales role). */
export function getDefaultPostLoginPath(user) {
  return hasPermission(user, 'dashboard.view') ? '/dashboard' : '/pos';
}

/**
 * Middleware to check if the user is authenticated
 * @param {Request} request - The request object
 * @returns {Promise<Response|null>} A response to redirect if not authenticated, null if authenticated
 */
export async function requireAuth(request) {
  const user = await getUserFromSession(request);

  if (!user) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  return null;
}

/**
 * Middleware to check if the user has a specific permission
 * @param {Request} request - The request object
 * @param {string} permission - Permission string in format "category.action"
 * @returns {Promise<Response|null>} A response to redirect if not authorized, null if authorized
 */
export async function requirePermission(request, permission) {
  const user = await getUserFromSession(request);

  if (!user) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  if (!hasPermission(user, permission)) {
    // Audit mode: log violations but do not block. Flip via env at runtime.
    if (String(process.env.AUTHZ_AUDIT_MODE || '').toLowerCase() === 'true') {
      console.warn('[AUTHZ_AUDIT_MODE] Permission denied (allowed by audit mode)', {
        permission,
        userId: user.id,
        tenantId: user.tenantId ?? null,
        roleName: user.role?.name ?? null,
      });
      return null;
    }
    return new Response(JSON.stringify({ error: 'Permission denied' }), {
      status: 403,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  return null;
}