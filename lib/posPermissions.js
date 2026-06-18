import { permissionsToCheck } from './permissionAliases';

const SALES_PREFIX = 'sales.';

function flattenPermissionSet(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const flat = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'boolean') {
      flat[key] = value;
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [action, allowed] of Object.entries(value)) {
        flat[`${key}.${action}`] = allowed === true;
      }
    }
  }
  return flat;
}

/** Read-only supporting permissions granted to anyone with any sales.* permission. */
export const POS_IMPLICIT_READ = Object.freeze([
  'clients.view',
  'inventory.view',
  'tax.view',
  'payments.view',
  'settings.view',
  'system.view',
  'system.switchTenant',
]);

/** Extra write permissions keyed by granted sales action. */
export const POS_IMPLICIT_BY_SALES_ACTION = Object.freeze({
  view: [],
  create: ['clients.create', 'clients.update'],
  update: ['clients.update'],
  void: [],
  refund: [],
  export: [],
  delete: [],
});

export function hasAnySalesPermission(permissionSet) {
  const flat = flattenPermissionSet(permissionSet);
  return Object.entries(flat).some(
    ([key, allowed]) => allowed === true && key.startsWith(SALES_PREFIX)
  );
}

export function getSalesPermissionActions(permissionSet) {
  const flat = flattenPermissionSet(permissionSet);
  const actions = new Set();
  for (const [key, allowed] of Object.entries(flat)) {
    if (allowed !== true || !key.startsWith(SALES_PREFIX)) continue;
    const action = key.slice(SALES_PREFIX.length);
    if (action) actions.add(action);
  }
  return actions;
}

export function getPosImplicitPermissions(permissionSet) {
  if (!hasAnySalesPermission(permissionSet)) return new Set();
  const implicit = new Set(POS_IMPLICIT_READ);
  for (const action of getSalesPermissionActions(permissionSet)) {
    const extras = POS_IMPLICIT_BY_SALES_ACTION[action] || [];
    for (const perm of extras) implicit.add(perm);
  }
  return implicit;
}

/**
 * True when POS sales permissions implicitly grant the requested permission
 * (supporting APIs only — not full accounting/admin modules).
 */
export function posGrantsPermission(permissionSet, requestedPermission) {
  if (!hasAnySalesPermission(permissionSet)) return false;
  const implicit = getPosImplicitPermissions(permissionSet);
  for (const candidate of permissionsToCheck(requestedPermission)) {
    if (implicit.has(candidate)) return true;
  }
  return false;
}

/** All sales.* permission keys used for API middleware POS bundles. */
export const POS_SALES_PERMISSIONS = Object.freeze([
  'sales.view',
  'sales.create',
  'sales.update',
  'sales.delete',
  'sales.void',
  'sales.refund',
  'sales.export',
]);
