/**
 * Support Ops auth helpers (Phase 10 Waves 1–4).
 * Queue / team scope remains a stub for list filtering.
 * Support ≠ CsCase portfolio auth (distinct domain).
 */

import { isSuperAdminRole } from '@/lib/admin/authorization/catalogue.js';
import { authorizeAdminDecision } from '@/lib/admin/authorization/authorizeAdminDecision';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';

/**
 * @param {object|null|undefined} admin
 */
export function resolveSupportAccess(admin) {
  const viewTickets = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.support.viewTickets,
  });
  const createTickets = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.support.createTickets,
  });
  const transitionStatus = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.support.transitionStatus,
  });
  const replyPublicly = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.support.replyPublicly,
  });
  const addInternalNotes = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.support.addInternalNotes,
  });
  const addRestrictedNotes = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.support.addRestrictedNotes,
  });
  const assignTickets = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.support.assignTickets,
  });
  const exportPerm = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.support.export,
  });
  const runReconciliation = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.support.runReconciliation,
  });

  const isSuper = isSuperAdminRole(admin?.role);

  return {
    canViewTickets: Boolean(isSuper || viewTickets.allowed),
    canCreateTickets: Boolean(isSuper || createTickets.allowed),
    canTransitionStatus: Boolean(isSuper || transitionStatus.allowed),
    canReplyPublicly: Boolean(isSuper || replyPublicly.allowed),
    canAddInternalNotes: Boolean(isSuper || addInternalNotes.allowed),
    canAddRestrictedNotes: Boolean(isSuper || addRestrictedNotes.allowed),
    /** View restricted notes — same gate as addRestrictedNotes (SECURITY_MATRIX). */
    canViewRestrictedNotes: Boolean(isSuper || addRestrictedNotes.allowed),
    canAssignTickets: Boolean(isSuper || assignTickets.allowed),
    canExport: Boolean(isSuper || exportPerm.allowed),
    canRunReconciliation: Boolean(isSuper || runReconciliation.allowed),
    /** Create link-only handoffs — createTickets or assign (ops action). */
    canCreateHandoffs: Boolean(
      isSuper || createTickets.allowed || assignTickets.allowed || transitionStatus.allowed
    ),
    isSuperAdmin: isSuper,
  };
}

/**
 * Queue scope stub. Holders with viewTickets see all tickets (no queue filter yet).
 *
 * @param {import('@prisma/client').PrismaClient} _prisma
 * @param {object|null|undefined} admin
 * @returns {Promise<{ mode: 'all'|'none'|'queue', queueCodes: string[]|null, canView: boolean, stub?: boolean, wave?: number }>}
 */
export async function resolveSupportQueueScope(_prisma, admin) {
  const access = resolveSupportAccess(admin);
  if (!admin || !access.canViewTickets) {
    return {
      mode: 'none',
      queueCodes: [],
      canView: false,
      stub: true,
      wave: 2,
    };
  }

  return {
    mode: 'all',
    queueCodes: null,
    canView: true,
    stub: true,
    wave: 2,
  };
}
