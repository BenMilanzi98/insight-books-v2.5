// lib/permissions.js
// lib/permissions.js — CLIENT ONLY
// This file is intentionally client-only to avoid bundling server-only modules like `next/headers`.
import { isFullAccessTenantRole, isPosDefaultLandingRole } from './tenantRoleAccess';
import { hasPermissionInSet } from './permissionUtils';
let clientCachedUser = null;
let clientCacheTimestamp = 0;
const CACHE_TTL_MS = 60_000;

export const clearUserCache = () => {
  clientCachedUser = null;
  clientCacheTimestamp = 0;
};

export const getCurrentUser = async () => {
  if (typeof window === 'undefined') {
    return {
      name: 'Guest',
      role: { name: 'Guest', permissions: {} },
    };
  }

  if (clientCachedUser && Date.now() - clientCacheTimestamp < CACHE_TTL_MS) {
    return clientCachedUser;
  }

  try {
    const res = await fetch('/api/auth/me', { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch user');
    clientCachedUser = await res.json();
    clientCacheTimestamp = Date.now();
    return clientCachedUser;
  } catch (err) {
    console.error('Error fetching user (client):', err);
    clientCachedUser = {
      name: 'Guest',
      role: {
        name: 'Guest',
        permissions: {},
      },
    };
    clientCacheTimestamp = Date.now();
    return clientCachedUser;
  }
};

export const hasPermission = (permissions, permission, userForRole) => {
  if (userForRole && isFullAccessTenantRole(userForRole)) {
    return true;
  }
  if (
    userForRole &&
    isPosDefaultLandingRole(userForRole) &&
    permission === 'dashboard.view'
  ) {
    return false;
  }
  if (!permissions || !permission) return false;
  return hasPermissionInSet(permissions, permission);
};

/** Use when you have the full user object (e.g. sidebar) so Owner/Admin bypass applies. */
export const userHasPermission = (user, permission) => {
  if (!user?.role) return false;
  return hasPermission(user.role.permissions, permission, user);
};

export const checkPermission = async (permission) => {
  const user = await getCurrentUser();
  return hasPermission(user?.role?.permissions, permission, user);
};

export const getPermission = async(permission) => {
  const user = await getCurrentUser();
  return hasPermission(user?.role?.permissions, permission, user);
};

