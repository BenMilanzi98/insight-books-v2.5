import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardEquityRoute, accountingErrorResponse } from '@/lib/equityManagement/api/routeGuard.js';
import { EQUITY_PERMISSIONS } from '@/lib/equityManagement/permissions.js';
import {
  getRelationship,
  updateRelationshipNonFinancial,
  requestExit,
  deleteRelationshipIfSafe,
} from '@/lib/equityManagement/application/partyService.js';

export async function GET(request, { params }) {
  const guard = await guardEquityRoute(request, EQUITY_PERMISSIONS.VIEW_OWNERS);
  if (guard.response) return guard.response;
  try {
    const { id } = await params;
    const owner = await getRelationship(prisma, guard.context.businessId, id);
    return NextResponse.json({ owner });
  } catch (error) {
    return accountingErrorResponse(error, 'get equity party');
  }
}

export async function PATCH(request, { params }) {
  const guard = await guardEquityRoute(request, EQUITY_PERMISSIONS.MANAGE_OWNERS);
  if (guard.response) return guard.response;
  try {
    const { id } = await params;
    const body = await request.json();
    if (body.action === 'exit') {
      const owner = await requestExit(prisma, guard.context, id, body);
      return NextResponse.json({ owner });
    }
    const owner = await updateRelationshipNonFinancial(prisma, guard.context, id, body);
    return NextResponse.json({ owner });
  } catch (error) {
    return accountingErrorResponse(error, 'update equity party');
  }
}

export async function DELETE(request, { params }) {
  const guard = await guardEquityRoute(request, EQUITY_PERMISSIONS.MANAGE_OWNERS);
  if (guard.response) return guard.response;
  try {
    const { id } = await params;
    const result = await deleteRelationshipIfSafe(prisma, guard.context, id);
    return NextResponse.json(result);
  } catch (error) {
    return accountingErrorResponse(error, 'delete equity party');
  }
}
