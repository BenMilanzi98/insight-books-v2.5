// lib/permissions.server.js — SERVER ONLY
// Uses `next/headers` / request cookies and should only be imported from server code (API routes, server components, middleware).
import { getUserFromSession, hasPermission } from './auth';
import { hasPermissionInSet } from './permissionUtils';

const guestUser = { name: 'Guest', role: { name: 'Guest', permissions: {} } };

export const getCurrentUserServer = async (request) => {
  try {
    const user = await getUserFromSession(request);
    return user || guestUser;
  } catch (err) {
    console.error('Error in getCurrentUserServer:', err);
    return guestUser;
  }
};

/** Raw JSON check only (no Owner/Admin bypass). Prefer {@link checkPermissionServer}. */
export const hasPermissionServer = (permissions, permission) => {
  if (!permissions || !permission) return false;
  return hasPermissionInSet(permissions, permission);
};

export const checkPermissionServer = async (permission, request) => {
  const user = await getUserFromSession(request);
  if (!user?.role) return false;
  return hasPermission(user, permission);
};

export const getPermissionServer = async (permission, request) => {
  const user = await getUserFromSession(request);
  if (!user?.role) return false;
  return hasPermission(user, permission);
};
