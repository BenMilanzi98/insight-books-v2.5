/**
 * Segregation of Duties — same actor cannot hold conflicting actions on one resource.
 */

const DEFAULT_CONFLICTS = [
  {
    id: 'billing_invoice_create_approve',
    permissions: [
      'systemAdmin.billing.invoices.create',
      'systemAdmin.billing.invoices.approve',
    ],
  },
];

/**
 * @param {{ heldPermissions: string[], attemptedPermission: string, conflicts?: object[] }} input
 */
export function assertSoD(input = {}) {
  const held = new Set(input.heldPermissions || []);
  const attempted = input.attemptedPermission;
  const conflicts = input.conflicts || DEFAULT_CONFLICTS;

  if (!attempted) {
    return { ok: false, error: 'attemptedPermission required' };
  }

  for (const rule of conflicts) {
    const pair = rule.permissions || [];
    if (!pair.includes(attempted)) continue;
    const other = pair.find((p) => p !== attempted);
    if (other && held.has(other)) {
      return {
        ok: false,
        error: `Segregation of Duties violation (${rule.id}): cannot perform ${attempted} when also holding ${other}`,
        conflictId: rule.id,
      };
    }
  }

  return { ok: true };
}

/**
 * Collect granted systemAdmin permission strings from admin.permissions JSON.
 * @param {object} admin
 * @returns {string[]}
 */
export function listGrantedPermissionKeys(admin) {
  const out = [];
  const root = admin?.permissions?.systemAdmin;
  if (!root || typeof root !== 'object') return out;
  for (const [category, actions] of Object.entries(root)) {
    if (!actions || typeof actions !== 'object') continue;
    for (const [action, val] of Object.entries(actions)) {
      if (val === true) out.push(`systemAdmin.${category}.${action}`);
    }
  }
  return out;
}
