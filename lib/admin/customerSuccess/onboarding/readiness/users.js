/**
 * User / invite / role readiness — Phase 21 Wave 2 (G21-10).
 * Invitation sent ≠ ACCESS_VALID; never grant Platform Super Admin; never mint users.
 */

import { READINESS_STATUS } from './tenant.js';

const INVITE_ONLY = new Set([
  'INVITED',
  'INVITATION_SENT',
  'PENDING',
  'SENT',
  'REQUESTED',
]);

const ACCESS_VALID_STATUSES = new Set([
  'ACTIVE',
  'ACCESS_VALID',
  'ACCEPTED',
  'ENABLED',
]);

function isAccessValid(user) {
  if (!user) return false;
  if (user.accessValid === true) return true;
  const access = String(user.accessStatus || '').toUpperCase();
  if (access === 'ACCESS_VALID') return true;
  const status = String(user.status || '').toUpperCase();
  return ACCESS_VALID_STATUSES.has(status) && !INVITE_ONLY.has(status);
}

function isInviteOnly(user) {
  if (!user) return false;
  if (user.accessValid === true) return false;
  const invitation = String(user.invitationStatus || '').toUpperCase();
  const status = String(user.status || '').toUpperCase();
  const access = String(user.accessStatus || '').toUpperCase();
  if (access === 'ACCESS_VALID') return false;
  return (
    INVITE_ONLY.has(status) ||
    INVITE_ONLY.has(invitation) ||
    invitation === 'SENT'
  );
}

export async function evaluateUsersReadiness(prisma, project, args = {}) {
  if (args.dimensionOverrides?.users) {
    return {
      status: String(args.dimensionOverrides.users).toUpperCase(),
      evidence: { override: true },
    };
  }

  if (
    typeof prisma?.user?.count !== 'function' &&
    typeof prisma?.user?.findMany !== 'function'
  ) {
    return {
      status: READINESS_STATUS.UNKNOWN,
      evidence: { reason: 'user_model_unavailable' },
    };
  }

  let users = [];
  if (typeof prisma.user.findMany === 'function') {
    users = await prisma.user.findMany({
      where: { tenantId: project.tenantId },
    });
  }

  const userCount = users.length;
  if (
    userCount === 0 &&
    typeof prisma.user.count === 'function'
  ) {
    const counted = await prisma.user.count({
      where: { tenantId: project.tenantId },
    });
    if (counted <= 0) {
      return {
        status: READINESS_STATUS.NOT_READY,
        evidence: { userCount: 0, accessValidCount: 0, reason: 'no_users' },
      };
    }
    // Count without rows → cannot prove ACCESS_VALID
    return {
      status: READINESS_STATUS.UNKNOWN,
      evidence: {
        userCount: counted,
        accessValidCount: 0,
        reason: 'access_valid_unproven',
      },
    };
  }

  if (userCount <= 0) {
    return {
      status: READINESS_STATUS.NOT_READY,
      evidence: { userCount: 0, accessValidCount: 0, reason: 'no_users' },
    };
  }

  const accessValidUsers = users.filter(isAccessValid);
  const inviteOnlyUsers = users.filter(isInviteOnly);
  const accessValidCount = accessValidUsers.length;

  if (accessValidCount <= 0) {
    return {
      status: READINESS_STATUS.NOT_READY,
      evidence: {
        userCount,
        accessValidCount: 0,
        invitationOnly: inviteOnlyUsers.length > 0,
        invitationSentCount: inviteOnlyUsers.length,
        reason: 'invitation_sent_not_access_valid',
      },
    };
  }

  return {
    status: READINESS_STATUS.READY,
    evidence: {
      userCount,
      accessValidCount,
      invitationSentCount: inviteOnlyUsers.length,
    },
  };
}

/** Explicit refuse — onboarding must never grant Platform Super Admin. */
export function refusePlatformSuperAdminViaOnboarding(args = {}) {
  const role = String(args.role || args.targetRole || '')
    .trim()
    .toUpperCase();
  if (
    args.grant === true ||
    role.includes('SUPER ADMIN') ||
    role.includes('PLATFORM_SUPER') ||
    role === 'PLATFORM SUPER ADMIN'
  ) {
    return {
      ok: false,
      error: 'platform_super_admin_via_onboarding_forbidden',
      granted: false,
    };
  }
  return {
    ok: false,
    error: 'platform_super_admin_via_onboarding_forbidden',
    granted: false,
  };
}

/** Explicit refuse — onboarding must never mint User identity. */
export async function refuseOnboardingUserMint(_prisma, _args = {}) {
  return {
    ok: false,
    error: 'fabricated_user_mint_forbidden',
    reason: 'onboarding_must_not_mint_user_identity',
  };
}
