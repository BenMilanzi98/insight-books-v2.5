/**
 * Central Authorization Policy Engine — fail closed.
 */

import { AuthzDecision, ScopeType } from './enums.js';
import { CrossTenantAccessError, PermissionDeniedError, ScopeDeniedError } from './errors.js';

/**
 * Evaluate authorization for an action/resource.
 * @returns {{ decision, code, reason, context }}
 */
export function evaluateAuthorization({
  actor,
  permission,
  resourceBusinessId = null,
  resourceBranchId = null,
  resourceDepartmentId = null,
  resourceProjectId = null,
  resourceCostCentreId = null,
  resourceOwnerId = null,
  requireMfa = false,
  requireReauth = false,
  featureEnabled = true,
  fullAccessRoles = ['Owner', 'Admin', 'MASTER_ADMIN', 'Super Admin'],
} = {}) {
  if (!actor?.effectiveUserId && !actor?.serviceAccountId) {
    return deny('AUTHENTICATION_REQUIRED', 'No verified actor.');
  }
  if (!featureEnabled) {
    return deny('FEATURE_DISABLED', 'Security feature is disabled for this business.');
  }

  const businessId = actor.businessId;
  if (resourceBusinessId && businessId && String(resourceBusinessId) !== String(businessId)) {
    return deny('CROSS_BUSINESS', 'Resource belongs to another business.', {
      resourceBusinessId,
      actorBusinessId: businessId,
    });
  }

  if (
    actor.membershipStatus &&
    !['ACTIVE', 'active', 'INVITED'].includes(actor.membershipStatus) &&
    actor.actorType === 'USER'
  ) {
    // INVITED may only accept invitation — treat non-active as deny for data access
    if (!['ACTIVE', 'active'].includes(actor.membershipStatus)) {
      return deny('MEMBERSHIP_INACTIVE', 'Business membership is not active.');
    }
  }

  if (requireReauth && !actor.riskIndicators?.includes('REAUTH_OK')) {
    return {
      decision: AuthzDecision.REQUIRE_REAUTHENTICATION,
      code: 'REAUTHENTICATION_REQUIRED',
      reason: 'Recent reauthentication required.',
      context: {},
    };
  }

  if (requireMfa && actor.multiFactorStatus !== 'VERIFIED' && actor.multiFactorStatus !== 'ENABLED') {
    // ENABLED means MFA configured but challenge may still be needed for step-up
    if (actor.multiFactorStatus !== 'VERIFIED') {
      return {
        decision: AuthzDecision.REQUIRE_MFA,
        code: 'MULTI_FACTOR_REQUIRED',
        reason: 'MFA verification required for this action.',
        context: {},
      };
    }
  }

  const hasFull =
    (actor.roles || []).some((r) => fullAccessRoles.includes(r)) ||
    (actor.permissions || []).includes('*');

  if (permission && !hasFull) {
    const ok = (actor.permissions || []).includes(permission);
    if (!ok) {
      return deny('PERMISSION_DENIED', `Missing permission: ${permission}`, { permission });
    }
  }

  // Scope checks (explicit when actor has restricted scopes)
  if (resourceBranchId && actor.branchScopes?.length) {
    if (!actor.branchScopes.includes(resourceBranchId) && !actor.branchScopes.includes('*')) {
      return deny('SCOPE_DENIED', 'Branch scope denied.', {
        scopeType: ScopeType.BRANCH,
        resourceBranchId,
      });
    }
  }
  if (resourceDepartmentId && actor.departmentScopes?.length) {
    if (
      !actor.departmentScopes.includes(resourceDepartmentId) &&
      !actor.departmentScopes.includes('*')
    ) {
      return deny('SCOPE_DENIED', 'Department scope denied.', {
        scopeType: ScopeType.DEPARTMENT,
        resourceDepartmentId,
      });
    }
  }
  if (resourceProjectId && actor.projectScopes?.length) {
    if (!actor.projectScopes.includes(resourceProjectId) && !actor.projectScopes.includes('*')) {
      return deny('SCOPE_DENIED', 'Project scope denied.', {
        scopeType: ScopeType.PROJECT,
        resourceProjectId,
      });
    }
  }
  if (resourceCostCentreId && actor.costCentreScopes?.length) {
    if (
      !actor.costCentreScopes.includes(resourceCostCentreId) &&
      !actor.costCentreScopes.includes('*')
    ) {
      return deny('SCOPE_DENIED', 'Cost centre scope denied.', {
        scopeType: ScopeType.COST_CENTRE,
        resourceCostCentreId,
      });
    }
  }

  // Impersonation: no privilege stacking — already using effective user's permissions only
  if (actor.isImpersonating && resourceOwnerId && resourceOwnerId === actor.impersonatorUserId) {
    return deny('IMPERSONATION_CONFLICT', 'Impersonator cannot act on own records as target.');
  }

  return {
    decision: AuthzDecision.ALLOW,
    code: 'ALLOW',
    reason: 'Authorized.',
    context: { permission: permission || null, resourceOwnerId },
  };
}

export function assertAuthorized(evaluation) {
  if (evaluation.decision === AuthzDecision.ALLOW) return evaluation;
  if (evaluation.code === 'CROSS_BUSINESS') {
    throw new CrossTenantAccessError(evaluation.reason, evaluation.context);
  }
  if (evaluation.code === 'SCOPE_DENIED') {
    throw new ScopeDeniedError(evaluation.reason, evaluation.context);
  }
  throw new PermissionDeniedError(evaluation.reason, evaluation.context);
}

function deny(code, reason, context = {}) {
  return {
    decision: AuthzDecision.DENY,
    code,
    reason,
    context,
  };
}
