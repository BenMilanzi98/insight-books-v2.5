/**
 * Support access / impersonation controls for System Administrators.
 * Real actor remains the Admin; effective context is the Tenant.
 */

export const SUPPORT_ACCESS_STATUSES = {
  REQUESTED: 'REQUESTED',
  APPROVED: 'APPROVED',
  ACTIVE: 'ACTIVE',
  ENDED: 'ENDED',
  EXPIRED: 'EXPIRED',
  DENIED: 'DENIED',
};

export function assertSupportAccessAllowed({ admin, permissionCheck }) {
  if (!admin) return { ok: false, error: 'Admin required' };
  if (typeof permissionCheck === 'function' && !permissionCheck()) {
    return { ok: false, error: 'Missing systemAdmin.tenants.supportAccess permission' };
  }
  return { ok: true };
}

export function buildSupportSessionPayload({
  adminId,
  tenantId,
  reason,
  durationMinutes = 60,
  now = new Date(),
}) {
  const trimmed = String(reason || '').trim();
  if (!adminId || !tenantId) {
    return { ok: false, error: 'adminId and tenantId are required' };
  }
  if (trimmed.length < 8) {
    return { ok: false, error: 'Reason must be at least 8 characters' };
  }
  const mins = Math.min(Math.max(Number(durationMinutes) || 60, 15), 240);
  const expiresAt = new Date(now.getTime() + mins * 60 * 1000);
  return {
    ok: true,
    session: {
      adminId,
      tenantId,
      reason: trimmed,
      status: SUPPORT_ACCESS_STATUSES.ACTIVE,
      startedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      realActorId: adminId,
      effectiveTenantId: tenantId,
    },
  };
}

export function isSupportSessionActive(session, now = new Date()) {
  if (!session || session.status !== SUPPORT_ACCESS_STATUSES.ACTIVE) return false;
  if (!session.expiresAt) return false;
  return new Date(session.expiresAt).getTime() > now.getTime();
}
