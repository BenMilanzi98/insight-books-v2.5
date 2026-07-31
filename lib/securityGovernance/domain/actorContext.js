/**
 * Canonical Actor Context — never constructed from arbitrary client JSON.
 */

import { createHash, randomUUID } from 'crypto';
import { ActorType } from './enums.js';

/**
 * @param {object} input — server-resolved fields only
 */
export function buildActorContext(input = {}) {
  const actorType = input.actorType || ActorType.USER;
  const requestId = input.requestId || randomUUID();
  const correlationId = input.correlationId || requestId;
  const businessId = input.businessId || input.tenantId || null;
  const authenticatedUserId = input.authenticatedUserId || input.userId || null;
  const effectiveUserId = input.effectiveUserId || authenticatedUserId;
  const impersonatorUserId = input.impersonatorUserId || null;

  const ctx = Object.freeze({
    actorType,
    actorId: input.actorId || effectiveUserId || input.serviceAccountId || 'SYSTEM',
    authenticatedUserId,
    effectiveUserId,
    impersonatorUserId,
    serviceAccountId: input.serviceAccountId || null,
    businessId,
    membershipId: input.membershipId || null,
    membershipStatus: input.membershipStatus || null,
    sessionId: input.sessionId || null,
    authenticationMethod: input.authenticationMethod || 'SESSION',
    multiFactorStatus: input.multiFactorStatus || 'NOT_REQUIRED',
    roles: Object.freeze([...(input.roles || [])]),
    permissions: Object.freeze([...(input.permissions || [])]),
    branchScopes: Object.freeze([...(input.branchScopes || [])]),
    departmentScopes: Object.freeze([...(input.departmentScopes || [])]),
    projectScopes: Object.freeze([...(input.projectScopes || [])]),
    costCentreScopes: Object.freeze([...(input.costCentreScopes || [])]),
    requestId,
    correlationId,
    ipAddress: input.ipAddress || null,
    userAgent: redactUserAgent(input.userAgent),
    issuedAt: input.issuedAt || new Date().toISOString(),
    expiresAt: input.expiresAt || null,
    riskIndicators: Object.freeze([...(input.riskIndicators || [])]),
    emergencyAccessId: input.emergencyAccessId || null,
    isImpersonating: Boolean(impersonatorUserId),
    isEmergencyAccess: actorType === ActorType.EMERGENCY_ACCESS || Boolean(input.emergencyAccessId),
  });

  return ctx;
}

/**
 * Build Actor Context from a verified session user (server-loaded).
 */
export function actorFromSessionUser(user, extras = {}) {
  if (!user?.id) return null;
  const permissions = flattenPermissionKeys(user.role?.permissions);
  return buildActorContext({
    actorType: extras.impersonatorUserId ? ActorType.SUPER_ADMIN_IMPERSONATION : ActorType.USER,
    authenticatedUserId: extras.impersonatorUserId || user.id,
    effectiveUserId: user.id,
    impersonatorUserId: extras.impersonatorUserId || null,
    businessId: user.tenantId,
    membershipId: user.membershipId || null,
    membershipStatus: user.membershipStatus || (user.isActive === false ? 'SUSPENDED' : 'ACTIVE'),
    sessionId: extras.sessionId || null,
    authenticationMethod: extras.authenticationMethod || 'SESSION',
    multiFactorStatus: user.mfaEnabled ? 'ENABLED' : 'NOT_ENABLED',
    roles: user.role?.name ? [user.role.name] : [],
    permissions,
    branchScopes: user.allowedBranchIds || (user.currentBranchId ? [user.currentBranchId] : []),
    requestId: extras.requestId,
    correlationId: extras.correlationId,
    ipAddress: extras.ipAddress,
    userAgent: extras.userAgent,
    expiresAt: extras.expiresAt,
    riskIndicators: extras.riskIndicators || [],
    emergencyAccessId: extras.emergencyAccessId || null,
  });
}

export function flattenPermissionKeys(permissions) {
  if (!permissions) return [];
  if (Array.isArray(permissions)) return permissions.map(String);
  if (typeof permissions !== 'object') return [];
  const out = [];
  for (const [mod, actions] of Object.entries(permissions)) {
    if (actions && typeof actions === 'object' && !Array.isArray(actions)) {
      for (const [action, allowed] of Object.entries(actions)) {
        if (allowed) out.push(`${mod}.${action}`);
      }
    } else if (actions === true) {
      out.push(String(mod));
    }
  }
  return out;
}

export function actorFingerprint(actor) {
  if (!actor) return null;
  return createHash('sha256')
    .update(
      JSON.stringify({
        t: actor.actorType,
        a: actor.actorId,
        e: actor.effectiveUserId,
        i: actor.impersonatorUserId,
        b: actor.businessId,
        s: actor.sessionId,
      })
    )
    .digest('hex')
    .slice(0, 32);
}

function redactUserAgent(ua) {
  if (!ua || typeof ua !== 'string') return null;
  return ua.length > 240 ? `${ua.slice(0, 240)}…` : ua;
}
