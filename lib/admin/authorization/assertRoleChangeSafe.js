/**
 * Prevent self-escalation and unapproved Super Admin grants.
 */

import { isSuperAdminRole, resolveRoleCode, PLATFORM_ROLE_CODES } from './catalogue.js';

/**
 * @param {{
 *   actor: object,
 *   targetAdminId: string,
 *   newRole: string,
 *   dualControlApproved?: boolean,
 * }} input
 */
export function assertRoleChangeSafe(input = {}) {
  const { actor, targetAdminId, newRole, dualControlApproved = false } = input;
  if (!actor?.id || !targetAdminId || !newRole) {
    return { ok: false, error: 'actor, targetAdminId and newRole are required' };
  }

  const newIsSuper = isSuperAdminRole(newRole);
  const actorIsSuper = isSuperAdminRole(actor.role);

  if (String(actor.id) === String(targetAdminId) && newIsSuper && !actorIsSuper) {
    return { ok: false, error: 'Self-escalation to Super Admin is forbidden' };
  }

  if (String(actor.id) === String(targetAdminId)) {
    const code = resolveRoleCode(newRole);
    // Actors may not expand their own role without dual control
    if (code && code !== resolveRoleCode(actor.role) && !dualControlApproved) {
      return { ok: false, error: 'Self role changes require dual-control approval' };
    }
  }

  if (newIsSuper && !actorIsSuper && !dualControlApproved) {
    return {
      ok: false,
      error: 'Granting Super Admin requires an existing Super Admin (dual control)',
    };
  }

  if (newIsSuper && !actorIsSuper) {
    return { ok: false, error: 'Only Super Admins may grant Super Admin' };
  }

  return { ok: true, roleCode: resolveRoleCode(newRole) || PLATFORM_ROLE_CODES.PLATFORM_SUPPORT };
}
