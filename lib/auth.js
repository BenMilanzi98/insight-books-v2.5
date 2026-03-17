// lib/auth.js
import { cookies } from 'next/headers';
import prisma from './prisma';

/**
 * Get the current logged-in user from the session cookie
 * @param {Request} request - The request object
 * @returns {Promise<Object|null>} The user object or null if not authenticated
 */
export async function getUserFromSession(request) {
  try {
    // Get session cookie - use await with cookies()
    const cookieStore = await cookies();
    let sessionValue = cookieStore.get('session')?.value;

    // Fallback to Bearer token for mobile app authentication
    if (!sessionValue && request?.headers) {
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        sessionValue = authHeader.substring(7);
      }
    }

    if (!sessionValue) {
      return null;
    }

    try {
      // Validate base64 string
      if (typeof sessionValue !== 'string') {
        console.log('Invalid session token value');
        return null;
      }

      // Check if it's valid base64
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (!base64Regex.test(sessionValue)) {
        console.log('Session token is not valid base64');
        return null;
      }

      // Decode and parse session data
      const decodedSession = Buffer.from(sessionValue, 'base64').toString('utf8');

      if (!decodedSession || decodedSession.trim() === '') {
        console.log('Decoded session is empty');
        return null;
      }

      const sessionData = JSON.parse(decodedSession);

      if (!sessionData || !sessionData.userId) {
        console.log('Invalid session data structure');
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

      if (user) {
        user.userBranches = [];
        user.tenant = null;
        // Do not query userBranches or tenant.ownerUserId/defaultBranchId; development/legacy DBs may not have them.
      }

      if (!user || !user.isActive) {
        return null;
      }

      // Prefer tenant from session (set at login or tenant switch) so APIs see the active tenant
      if (sessionData.tenantId != null) {
        user.tenantId = sessionData.tenantId;
      }
      // Session branch (from cookie)
      user.currentBranchId = sessionData.branchId || null;
      // Allowed branches: owner = all; added users = assigned branches, or tenant default/first branch if none assigned.
      // On legacy databases without branch separation schema, fall back to "all branches" (null) so existing tenants still work.
      try {
        const effectiveTenantId = user.tenantId || null;
        const isOwner = effectiveTenantId && user.tenant?.ownerUserId === user.id;
        let branchIds = (user.userBranches ?? []).map((ub) => ub.branchId).filter(Boolean);
        if (!isOwner && branchIds.length === 0 && effectiveTenantId) {
          const defaultBranchId = user.tenant?.defaultBranchId || null;
          const fallbackId = defaultBranchId || (await prisma.branch.findFirst({
            where: { tenantId: effectiveTenantId },
            orderBy: { createdAt: 'asc' },
            select: { id: true }
          }))?.id;
          if (fallbackId) branchIds = [fallbackId];
        }
        // null = all branches (owner, or tenant with no branches – treat business as default branch); [] = no access; non-empty = only those branches
        const tenantHasNoBranches = effectiveTenantId && branchIds.length === 0;
        user.allowedBranchIds = isOwner || tenantHasNoBranches ? null : branchIds;
        delete user.userBranches;
        delete user.tenant;
        // If user is restricted to branches and session has a branch they can't access, treat as no branch
        if (user.allowedBranchIds && user.currentBranchId && !user.allowedBranchIds.includes(user.currentBranchId)) {
          user.currentBranchId = null;
        }
      } catch (branchCalcError) {
        console.error('Branch access calculation failed (non-fatal, allowing all branches):', branchCalcError?.message || branchCalcError);
        user.allowedBranchIds = null; // treat as all branches
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
  if (!user || !user.role || !user.role.permissions) {
    return false;
  }

  // Split the permission string (e.g., "expenses.view" -> ["expenses", "view"])
  const [category, action] = permission.split('.');

  // Master admin has all permissions
  if (user.role.name === 'MASTER_ADMIN') {
    return true;
  }

  // Check if the user has the specified permission
  return user.role.permissions[category]?.[action] === true;
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
    return new Response(JSON.stringify({ error: 'Permission denied' }), {
      status: 403,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  return null;
}