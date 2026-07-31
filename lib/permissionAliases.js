/**
 * Stored roles and `/api/auth/me` use `inventory.*` permissions. The stock UI may use `stock.*`
 * as an equivalent alias. Employee APIs use `employees.*`; the Roles UI stores `hr.*`.
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
  if (permission.startsWith('employees.')) {
    keys.push(`hr.${permission.slice(10)}`);
  }
  if (permission.startsWith('hr.')) {
    keys.push(`employees.${permission.slice(3)}`);
  }
  if (permission === 'tenants.switch') {
    keys.push('system.switchTenant');
  }
  if (permission === 'system.switchTenant') {
    keys.push('tenants.switch');
  }
  // Tax Management hub keys alias to legacy tax.* during dual-run migration.
  if (permission.startsWith('taxManagement.')) {
    keys.push(`tax.${permission.slice('taxManagement.'.length)}`);
  }
  if (permission.startsWith('tax.')) {
    keys.push(`taxManagement.${permission.slice('tax.'.length)}`);
  }
  return keys;
}

