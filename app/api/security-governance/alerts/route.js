import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma.js';
import {
  guardSecurityRoute,
  securityErrorResponse,
} from '../../../../lib/securityGovernance/api/routeGuard.js';
import { SECURITY_PERMISSIONS } from '../../../../lib/securityGovernance/permissions.js';
import {
  acknowledgeAlert,
  createSecurityAlert,
} from '../../../../lib/securityGovernance/application/alertService.js';

export async function GET(request) {
  try {
    const guard = await guardSecurityRoute(request, SECURITY_PERMISSIONS.VIEW_ALERTS);
    if (guard.response) return guard.response;
    const alerts = await prisma.secV2SecurityAlert.findMany({
      where: { businessId: guard.context.businessId },
      orderBy: { detectedAt: 'desc' },
      take: 100,
    });
    return NextResponse.json({ alerts });
  } catch (error) {
    return securityErrorResponse(error, 'list alerts');
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (body.action === 'acknowledge') {
      const guard = await guardSecurityRoute(request, SECURITY_PERMISSIONS.MANAGE_INCIDENTS);
      if (guard.response) return guard.response;
      const alert = await acknowledgeAlert(prisma, guard.context, body.alertId);
      return NextResponse.json({ alert });
    }
    if (body.action === 'create') {
      const guard = await guardSecurityRoute(request, SECURITY_PERMISSIONS.MANAGE_INCIDENTS);
      if (guard.response) return guard.response;
      const alert = await createSecurityAlert(prisma, {
        businessId: guard.context.businessId,
        ...body,
      });
      return NextResponse.json({ alert });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return securityErrorResponse(error, 'alert action');
  }
}