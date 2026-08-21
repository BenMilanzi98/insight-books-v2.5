import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardEquityRoute, accountingErrorResponse } from '@/lib/equityManagement/api/routeGuard.js';
import { EQUITY_PERMISSIONS } from '@/lib/equityManagement/permissions.js';
import {
  getEquityConfiguration,
  upsertEquityConfiguration,
} from '@/lib/equityManagement/application/configService.js';

export async function GET(request) {
  const guard = await guardEquityRoute(request, [
    EQUITY_PERMISSIONS.VIEW,
    EQUITY_PERMISSIONS.MANAGE_CONFIGURATION,
  ]);
  if (guard.response) return guard.response;
  try {
    let configuration = await getEquityConfiguration(prisma, guard.context.businessId);
    if (!configuration) {
      const { ensureEquityConfiguration } = await import(
        '@/lib/equityManagement/application/configService.js'
      );
      configuration = await ensureEquityConfiguration(prisma, guard.context);
    }
    return NextResponse.json({ configuration });
  } catch (error) {
    return accountingErrorResponse(error, 'get equity configuration');
  }
}

export async function PUT(request) {
  const guard = await guardEquityRoute(request, EQUITY_PERMISSIONS.MANAGE_CONFIGURATION);
  if (guard.response) return guard.response;
  try {
    const body = await request.json();
    const configuration = await upsertEquityConfiguration(prisma, guard.context, body);
    return NextResponse.json({ configuration });
  } catch (error) {
    return accountingErrorResponse(error, 'upsert equity configuration');
  }
}
