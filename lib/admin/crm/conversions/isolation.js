/**
 * Tenant isolation asserts — Phase 16 Wave 2.
 * Cross-tenant Business/Branch/invite create denied.
 */

/**
 * @param {{ lockedTenantId: string, requestedTenantId: string, resource?: string }} args
 */
export function assertTenantIsolation(args = {}) {
  const locked = args.lockedTenantId ? String(args.lockedTenantId).trim() : '';
  const requested = args.requestedTenantId
    ? String(args.requestedTenantId).trim()
    : '';

  if (!locked) {
    return { ok: false, error: 'locked_tenant_required', resource: args.resource || null };
  }
  if (!requested) {
    return { ok: false, error: 'requested_tenant_required', resource: args.resource || null };
  }
  if (locked !== requested) {
    return {
      ok: false,
      error: 'cross_tenant_denied',
      lockedTenantId: locked,
      requestedTenantId: requested,
      resource: args.resource || null,
    };
  }
  return {
    ok: true,
    lockedTenantId: locked,
    requestedTenantId: requested,
    resource: args.resource || null,
  };
}

