// lib/permissions.js
// lib/permissions.js — CLIENT ONLY
// This file is intentionally client-only to avoid bundling server-only modules like `next/headers`.
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

export const hasPermission = (permissions, permission) => {
  if (!permissions || !permission) return false;

  if (permissions[permission] === true) return true;

  if (typeof permission !== 'string' || !permission.includes('.')) {
    return false;
  }

  const [category, action] = permission.split('.');
  if (!category || !action) return false;

  return permissions?.[category]?.[action] === true;
};

export const checkPermission = async (permission) => {
  const user = await getCurrentUser();
  return hasPermission(user?.role?.permissions, permission);
};

export const getPermission = async(permission) => {
  const user = await getCurrentUser();
  return hasPermission(user?.role?.permissions, permission);
};

