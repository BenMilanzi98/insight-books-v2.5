/**
 * Stored roles and `/api/auth/me` use `inventory.*` permissions. The stock UI may use `stock.*`
 * as an equivalent alias. Database tables and persisted permission strings are unchanged.
 */
export function permissionsToCheck(permission) {
  if (typeof permission !== 'string' || !permission) {
    return permission ? [permission] : [];
  }
  const keys = [permission];
  if (permission.startsWith('stock.')) {
    keys.push(`inventory.${permission.slice(6)}`);
  }
  if (permission.startsWith('inventory.')) {
    keys.push(`stock.${permission.slice(10)}`);
  }
  return keys;
}
