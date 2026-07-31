import { FORMAT_ID } from './serialize.js';

function fail(message, path = '') {
  return { ok: false, error: message, path };
}

/**
 * Validate package envelope and per-tenant required fields (no DB).
 */
export function validateTenantIdentityPackage(pkg) {
  const errors = [];
  if (!pkg || typeof pkg !== 'object') {
    return { ok: false, errors: [fail('Package must be a JSON object')] };
  }
  if (pkg.format !== FORMAT_ID) {
    errors.push(fail(`Unsupported format: ${pkg.format || '(missing)'}`));
  }
  if (!Array.isArray(pkg.tenants)) {
    errors.push(fail('Package.tenants must be an array'));
    return { ok: false, errors };
  }

  pkg.tenants.forEach((tp, idx) => {
    const base = `tenants[${idx}]`;
    if (!tp?.tenant?.id) errors.push(fail('tenant.id is required', `${base}.tenant.id`));
    if (!tp?.tenant?.subdomain) {
      errors.push(fail('tenant.subdomain is required', `${base}.tenant.subdomain`));
    }
    if (!tp?.tenant?.name) errors.push(fail('tenant.name is required', `${base}.tenant.name`));
    if (!Array.isArray(tp.roles)) errors.push(fail('roles must be an array', `${base}.roles`));
    if (!Array.isArray(tp.users)) errors.push(fail('users must be an array', `${base}.users`));
    if (!Array.isArray(tp.memberships)) {
      errors.push(fail('memberships must be an array', `${base}.memberships`));
    }
    if (!Array.isArray(tp.subscriptions)) {
      errors.push(fail('subscriptions must be an array', `${base}.subscriptions`));
    }
    (tp.users || []).forEach((u, ui) => {
      if (!u?.id) errors.push(fail('user.id required', `${base}.users[${ui}].id`));
      if (!u?.email) errors.push(fail('user.email required', `${base}.users[${ui}].email`));
      if (!u?.password) {
        errors.push(fail('user.password (hash) required', `${base}.users[${ui}].password`));
      }
      if (!u?.roleId) errors.push(fail('user.roleId required', `${base}.users[${ui}].roleId`));
    });
    (tp.roles || []).forEach((r, ri) => {
      if (!r?.id) errors.push(fail('role.id required', `${base}.roles[${ri}].id`));
      if (!r?.name) errors.push(fail('role.name required', `${base}.roles[${ri}].name`));
    });
    (tp.subscriptions || []).forEach((s, si) => {
      if (!s?.id) errors.push(fail('subscription.id required', `${base}.subscriptions[${si}].id`));
      if (!s?.txRef) {
        errors.push(fail('subscription.txRef required', `${base}.subscriptions[${si}].txRef`));
      }
    });
  });

  return { ok: errors.length === 0, errors };
}
