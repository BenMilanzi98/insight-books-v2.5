import { NextResponse } from 'next/server';
import {
  guardSecurityRoute,
  securityErrorResponse,
} from '../../../../lib/securityGovernance/api/routeGuard.js';
import { SECURITY_PERMISSIONS } from '../../../../lib/securityGovernance/permissions.js';
import { actorFingerprint } from '../../../../lib/securityGovernance/domain/actorContext.js';

export async function GET(request) {
  try {
    const guard = await guardSecurityRoute(
      request,
      [SECURITY_PERMISSIONS.VIEW_DASHBOARD, 'dashboard.view', 'users.view'],
      { requireFlag: false }
    );
    if (guard.response) return guard.response;
    const actor = guard.context.actor || guard.context;
    return NextResponse.json({
      actor: {
        actorType: actor.actorType,
        actorId: actor.actorId,
        effectiveUserId: actor.effectiveUserId,
        impersonatorUserId: actor.impersonatorUserId,
        businessId: actor.businessId,
        membershipId: actor.membershipId,
        membershipStatus: actor.membershipStatus,
        sessionId: actor.sessionId,
        roles: actor.roles,
        permissionsCount: (actor.permissions || []).length,
        branchScopes: actor.branchScopes,
        multiFactorStatus: actor.multiFactorStatus,
        isImpersonating: actor.isImpersonating,
        isEmergencyAccess: actor.isEmergencyAccess,
        fingerprint: actorFingerprint(actor),
        requestId: actor.requestId,
        correlationId: actor.correlationId,
      },
    });
  } catch (error) {
    return securityErrorResponse(error, 'get actor');
  }
}
