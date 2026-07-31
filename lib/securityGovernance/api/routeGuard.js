import { NextResponse } from 'next/server';
import prisma from '../../prisma.js';
import {
  guardAccountingRoute,
  accountingErrorResponse as baseError,
} from '../../accountingV2/api/routeGuard.js';
import { SECURITY_FLAGS, isFlagEnabled } from '../../accountingV2/infrastructure/featureFlags.js';
import { SecurityGovernanceError } from '../domain/errors.js';
import { actorFromSessionUser } from '../domain/actorContext.js';
import { evaluateAuthorization, assertAuthorized } from '../domain/authorizationEngine.js';
import { decodeSessionToken } from '../domain/sessionToken.js';
import { assertSessionActive } from '../application/sessionService.js';
import { getSessionTokenFromRequest } from '../../auth.js';

export function securityErrorResponse(error, operation) {
  if (error instanceof SecurityGovernanceError) {
    return NextResponse.json(
      {
        error: error.code,
        message: error.message,
        retryable: error.retryable,
        context: error.context || {},
      },
      { status: error.status || 400 }
    );
  }
  return baseError(error, operation);
}

export async function guardSecurityRoute(request, permissions, { requireFlag = true } = {}) {
  const guard = await guardAccountingRoute(request, permissions);
  if (guard.response) return guard;

  if (requireFlag) {
    const enabled = await isFlagEnabled(prisma, SECURITY_FLAGS.ENABLED, {
      tenantId: guard.context.businessId,
    });
    if (!enabled) {
      return {
        response: NextResponse.json(
          {
            error: 'FEATURE_DISABLED',
            message: 'Security Governance is not enabled for this business.',
            flag: SECURITY_FLAGS.ENABLED,
          },
          { status: 403 }
        ),
      };
    }
  }

  // Enrich with Actor Context + session revocation check
  try {
    const token = await getSessionTokenFromRequest(request);
    const decoded = token ? decodeSessionToken(token) : null;
    if (decoded?.sessionId) {
      await assertSessionActive(prisma, decoded.sessionId);
    }
    const user = guard.user;
    const actor = actorFromSessionUser(
      {
        id: user.id,
        tenantId: user.tenantId,
        role: user.role,
        allowedBranchIds: user.allowedBranchIds,
        currentBranchId: user.currentBranchId,
        mfaEnabled: user.mfaEnabled,
        membershipId: user.membershipId,
        membershipStatus: user.membershipStatus || 'ACTIVE',
        isActive: user.isActive,
      },
      {
        sessionId: decoded?.sessionId || user.sessionId || null,
        requestId: request.headers.get('x-request-id') || undefined,
        correlationId: request.headers.get('x-correlation-id') || undefined,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        userAgent: request.headers.get('user-agent'),
      }
    );

    return {
      ...guard,
      context: {
        ...guard.context,
        ...actor,
        actor,
      },
    };
  } catch (error) {
    return { response: securityErrorResponse(error, 'session') };
  }
}

export function authorizeActor(actor, permission, resource = {}) {
  const evaluation = evaluateAuthorization({
    actor,
    permission,
    resourceBusinessId: resource.businessId,
    resourceBranchId: resource.branchId,
    resourceDepartmentId: resource.departmentId,
    resourceProjectId: resource.projectId,
    resourceCostCentreId: resource.costCentreId,
    resourceOwnerId: resource.ownerId,
    requireMfa: resource.requireMfa,
    requireReauth: resource.requireReauth,
  });
  assertAuthorized(evaluation);
  return evaluation;
}
