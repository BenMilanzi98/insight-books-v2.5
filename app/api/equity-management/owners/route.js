import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardEquityRoute, accountingErrorResponse } from '@/lib/equityManagement/api/routeGuard.js';
import { EQUITY_PERMISSIONS } from '@/lib/equityManagement/permissions.js';
import {
  listRelationships,
  createRelationship,
} from '@/lib/equityManagement/application/partyService.js';

export async function GET(request) {
  const guard = await guardEquityRoute(request, [
    EQUITY_PERMISSIONS.VIEW_OWNERS,
    EQUITY_PERMISSIONS.VIEW_SHAREHOLDERS,
    EQUITY_PERMISSIONS.VIEW,
  ]);
  if (guard.response) return guard.response;
  try {
    const { searchParams } = new URL(request.url);
    const owners = await listRelationships(prisma, guard.context.businessId, {
      relationshipType: searchParams.get('relationshipType') || undefined,
      ownershipStatus: searchParams.get('ownershipStatus') || undefined,
    });
    return NextResponse.json({ owners });
  } catch (error) {
    return accountingErrorResponse(error, 'list equity parties');
  }
}

export async function POST(request) {
  const guard = await guardEquityRoute(request, [
    EQUITY_PERMISSIONS.MANAGE_OWNERS,
    EQUITY_PERMISSIONS.MANAGE_SHAREHOLDERS,
  ]);
  if (guard.response) return guard.response;
  try {
    const body = await request.json();
    const owner = await createRelationship(prisma, guard.context, body);
    return NextResponse.json({ owner }, { status: 201 });
  } catch (error) {
    return accountingErrorResponse(error, 'create equity party');
  }
}
