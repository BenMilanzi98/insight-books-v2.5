import { permissionModules } from './permissionsMap';
import { permissionsToCheck } from './permissionAliases';

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parsePermissionsInput(input) {
  if (!input) return {};
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      return isPlainObject(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return isPlainObject(input) ? input : {};
}

export function flattenPermissions(input) {
  const source = parsePermissionsInput(input);
  const flat = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'boolean') {
      flat[key] = value;
      continue;
    }
    if (!isPlainObject(value)) continue;
    for (const [action, allowed] of Object.entries(value)) {
      flat[`${key}.${action}`] = allowed === true;
    }
  }
  return flat;
}

export function toNestedPermissions(input) {
  const flat = flattenPermissions(input);
  const nested = {};
  for (const [perm, allowed] of Object.entries(flat)) {
    if (typeof perm !== 'string' || !perm.includes('.')) continue;
    const [module, action] = perm.split('.');
    if (!module || !action) continue;
    if (!nested[module]) nested[module] = {};
    nested[module][action] = allowed === true;
  }
  return nested;
}

export function buildPermissionSchema(defaultValue = false) {
  const nested = {};
  for (const [module, { actions }] of Object.entries(permissionModules)) {
    nested[module] = {};
    for (const action of actions) {
      nested[module][action] = defaultValue === true;
    }
  }
  return nested;
}

export function sanitizePermissions(input) {
  const schema = buildPermissionSchema(false);
  const flat = flattenPermissions(input);
  for (const [perm, allowed] of Object.entries(flat)) {
    if (allowed !== true) continue;
    if (typeof perm !== 'string' || !perm.includes('.')) continue;
    const [module, action] = perm.split('.');
    if (!schema[module] || !(action in schema[module])) continue;
    schema[module][action] = true;
  }
  return schema;
}

export function hasPermissionInSet(permissionSet, requestedPermission) {
  const flat = flattenPermissions(permissionSet);
  for (const candidate of permissionsToCheck(requestedPermission)) {
    if (flat[candidate] === true) return true;
  }
  return false;
}

