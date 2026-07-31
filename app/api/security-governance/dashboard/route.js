import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma.js';
import {
  guardSecurityRoute,
  securityErrorResponse,
} from '../../../../lib/securityGovernance/api/routeGuard.js';
import { SECURITY_PERMISSIONS } from '../../../../lib/securityGovernance/permissions.js';
import { getSecurityDashboard } from '../../../../lib/securityGovernance/application/alertService.js';

export async function GET(request) {
  try {
    const guard = await guardSecurityRoute(request, [
      SECURITY_PERMISSIONS.VIEW_DASHBOARD,
      SECURITY_PERMISSIONS.VIEW_AUDIT,
      'users.view',
      'system.view',
    ]);
    if (guard.response) return guard.response;
    const dashboard = await getSecurityDashboard(prisma, guard.context.businessId);
    return NextResponse.json({
      dashboard,
      actor: {
        actorType: guard.context.actorType,
        actorId: guard.context.actorId,
        businessId: guard.context.businessId,
        roles: guard.context.roles,
        isImpersonating: guard.context.isImpersonating,
      },
    });
  } catch (error) {
    return securityErrorResponse(error, 'security dashboard');
  }
}
