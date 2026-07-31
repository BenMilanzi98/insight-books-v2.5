/**
 * Resolve real / effective admin actor context for a request.
 */

import { isSupportSessionActive } from '../supportAccess.js';

/**
 * @param {object|null} admin - from getAdminFromRequest
 * @param {{ supportSession?: object|null }} [extras]
 */
export function resolveAdminActor(admin, extras = {}) {
  if (!admin) {
    return {
      authenticated: false,
      realAdminId: null,
      effectiveTenantId: null,
      supportSessionId: null,
      impersonating: false,
      role: null,
      permissionVersion: null,
    };
  }

  const session = extras.supportSession || null;
  const supportActive = session && isSupportSessionActive(session);

  return {
    authenticated: true,
    realAdminId: admin.id,
    effectiveTenantId: supportActive ? session.tenantId || session.effectiveTenantId || null : null,
    supportSessionId: supportActive ? session.id || null : null,
    impersonating: Boolean(supportActive),
    role: admin.role || null,
    permissionVersion: admin.permissionVersion ?? admin.updatedAt ?? null,
    admin,
  };
}
