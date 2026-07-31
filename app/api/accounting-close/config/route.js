import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma.js';
import { guardCloseRoute, accountingErrorResponse } from '../../../../lib/accountingClose/api/routeGuard.js';
import { CLOSE_PERMISSIONS } from '../../../../lib/accountingClose/permissions.js';
import {
  getClosingConfiguration,
  upsertDraftClosingConfiguration,
  approveClosingConfiguration,
} from '../../../../lib/accountingClose/application/configService.js';

export async function GET(request) {
  try {
    const guard = await guardCloseRoute(request, [
      CLOSE_PERMISSIONS.VIEW,
      CLOSE_PERMISSIONS.MANAGE_CONFIGURATION,
    ]);
    if (guard.response) return guard.response;
    const cfg = await getClosingConfiguration(prisma, guard.context.businessId);
    return NextResponse.json({ configuration: cfg });
  } catch (error) {
    return accountingErrorResponse(error, 'get closing configuration');
  }
}

export async function PUT(request) {
  try {
    const guard = await guardCloseRoute(request, CLOSE_PERMISSIONS.MANAGE_CONFIGURATION);
    if (guard.response) return guard.response;
    const body = await request.json();
    if (body.action === 'approve') {
      const cfg = await approveClosingConfiguration(prisma, guard.context);
      return NextResponse.json({ configuration: cfg });
    }
    const cfg = await upsertDraftClosingConfiguration(prisma, guard.context, body);
    return NextResponse.json({ configuration: cfg });
  } catch (error) {
    return accountingErrorResponse(error, 'update closing configuration');
  }
}
