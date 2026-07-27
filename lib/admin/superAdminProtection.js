/**
 * Prevent removal/lock of the final active Super Administrator.
 */

export const SUPER_ADMIN_ROLE = 'Super Admin';

/**
 * @param {number} activeSuperAdminCount
 * @param {{ role?: string, isActive?: boolean }} targetAdmin
 * @param {'deactivate'|'lock'|'archive'|'delete'|'demote'} action
 */
export function assertFinalSuperAdminSafe(activeSuperAdminCount, targetAdmin, action) {
  const isSuper =
    targetAdmin?.role === SUPER_ADMIN_ROLE ||
    targetAdmin?.role === 'SUPER_ADMIN';
  if (!isSuper) {
    return { ok: true };
  }
  const currentlyActive = targetAdmin?.isActive !== false;
  if (!currentlyActive) {
    return { ok: true };
  }
  const destructive = ['deactivate', 'lock', 'archive', 'delete', 'demote'].includes(action);
  if (destructive && Number(activeSuperAdminCount) <= 1) {
    return {
      ok: false,
      error:
        'Cannot remove or lock the final active Super Administrator. Create another Super Admin first.',
    };
  }
  return { ok: true };
}

/**
 * Protect platform Admin records (control-plane admins).
 */
export async function guardAdminMutation(prisma, adminId, action) {
  const target = await prisma.admin.findUnique({
    where: { id: adminId },
    select: { id: true, role: true, isActive: true },
  });
  if (!target) {
    return { ok: false, error: 'Administrator not found', status: 404 };
  }
  const activeSuperAdminCount = await prisma.admin.count({
    where: { role: SUPER_ADMIN_ROLE, isActive: true },
  });
  const check = assertFinalSuperAdminSafe(activeSuperAdminCount, target, action);
  if (!check.ok) {
    return { ok: false, error: check.error, status: 409 };
  }
  return { ok: true, target };
}
