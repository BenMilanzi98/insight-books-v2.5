// lib/permissions.server.js — SERVER ONLY
// Uses `next/headers` / request cookies and should only be imported from server code (API routes, server components, middleware).
import { getUserFromSession } from './auth';

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
  if (permissions[permission] === true) return true;
  if (typeof permission !== 'string' || !permission.includes('.')) return false;
  const [category, action] = permission.split('.');
  if (!category || !action) return false;
  return permissions?.[category]?.[action] === true;
};

export const checkPermissionServer = async (permission, request) => {
  const user = await getCurrentUserServer(request);
  return hasPermissionServer(user?.role?.permissions, permission);
};

export const getPermissionServer = async (permission, request) => {
  const user = await getCurrentUserServer(request);
  return hasPermissionServer(user?.role?.permissions, permission);
};
