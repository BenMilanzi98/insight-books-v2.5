// lib/permissions.server.js — SERVER ONLY
// Uses `next/headers` / request cookies and should only be imported from server code (API routes, server components, middleware).
import { getUserFromSession } from './auth';
import { permissionsToCheck } from './permissionAliases';

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

export const hasPermissionServer = (permissions, permission) => {
  if (!permissions || !permission) return false;
  for (const p of permissionsToCheck(permission)) {
    if (permissions[p] === true) return true;
    if (typeof p !== 'string' || !p.includes('.')) continue;
    const [category, action] = p.split('.');
    if (category && action && permissions?.[category]?.[action] === true) return true;
  }
  return false;
};

export const checkPermissionServer = async (permission, request) => {
  const user = await getCurrentUserServer(request);
  return hasPermissionServer(user?.role?.permissions, permission);
};

export const getPermissionServer = async (permission, request) => {
  const user = await getCurrentUserServer(request);
  return hasPermissionServer(user?.role?.permissions, permission);
};
