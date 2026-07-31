import { NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma.js';
import { guardCloseRoute, accountingErrorResponse } from '../../../../../lib/accountingClose/api/routeGuard.js';
import { CLOSE_PERMISSIONS } from '../../../../../lib/accountingClose/permissions.js';
import { loadCloseRun } from '../../../../../lib/accountingClose/application/closeRunService.js';

export async function GET(request, { params }) {
  try {
    const guard = await guardCloseRoute(request, CLOSE_PERMISSIONS.VIEW);
    if (guard.response) return guard.response;
    const { id } = await params;
    const run = await loadCloseRun(prisma, guard.context, id);
    return NextResponse.json({ run });
  } catch (error) {
    return accountingErrorResponse(error, 'get close run');
  }
}
