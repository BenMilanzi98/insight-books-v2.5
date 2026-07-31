/**
 * Evaluate whether Admin.permissions JSON grants a permission key.
 * Pure — no Super Admin bypass (handled by decision service).
 */

/**
 * @param {string} permission
 * @returns {{ root: string|null, category: string, action: string }|null}
 */
export function permissionKeyParts(permission) {
  if (!permission || typeof permission !== 'string') return null;
  const parts = permission.split('.');
  if (parts[0] === 'systemAdmin' && parts.length >= 3) {
    return {
      root: 'systemAdmin',
      category: parts[1],
      action: parts.slice(2).join('.'),
    };
  }
  if (parts.length === 2) {
    return { root: null, category: parts[0], action: parts[1] };
  }
  return null;
}

/**
 * @param {object|null|undefined} admin
 * @param {string} permission
 * @returns {boolean}
 */
export function adminJsonGrantsPermission(admin, permission) {
  if (!admin?.permissions || typeof admin.permissions !== 'object') {
    return false;
  }
  const parts = permissionKeyParts(permission);
  if (!parts) return false;

  if (parts.root === 'systemAdmin') {
    const bucket = admin.permissions.systemAdmin?.[parts.category];
    if (bucket && typeof bucket === 'object' && bucket[parts.action] === true) {
      return true;
    }
    if (admin.permissions[permission] === true) return true;
    return false;
  }

  return admin.permissions[parts.category]?.[parts.action] === true;
}
