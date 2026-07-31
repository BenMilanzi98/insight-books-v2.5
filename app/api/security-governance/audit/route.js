import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma.js';
import {
  guardSecurityRoute,
  securityErrorResponse,
} from '../../../../lib/securityGovernance/api/routeGuard.js';
import { SECURITY_PERMISSIONS } from '../../../../lib/securityGovernance/permissions.js';
import {
  searchAuditEvents,
  runAuditIntegrityCheck,
  updateAuditEvent,
  deleteAuditEvent,
} from '../../../../lib/securityGovernance/application/auditService.js';

export async function GET(request) {
  try {
    const guard = await guardSecurityRoute(request, [
      SECURITY_PERMISSIONS.VIEW_AUDIT,
      SECURITY_PERMISSIONS.EXPORT_AUDIT,
    ]);
    if (guard.response) return guard.response;
    const { searchParams } = new URL(request.url);
    if (searchParams.get('integrity') === '1') {
      const result = await runAuditIntegrityCheck(prisma, guard.context.businessId);
      return NextResponse.json({ integrity: result });
    }
    const events = await searchAuditEvents(prisma, {
      businessId: guard.context.businessId,
      filters: {
        eventType: searchParams.get('eventType') || undefined,
        actorId: searchParams.get('actorId') || undefined,
        sourceId: searchParams.get('sourceId') || undefined,
        correlationId: searchParams.get('correlationId') || undefined,
      },
      take: Number(searchParams.get('take') || 50),
    });
    return NextResponse.json({ events });
  } catch (error) {
    return securityErrorResponse(error, 'search audit');
  }
}

export async function PATCH() {
  try {
    updateAuditEvent();
  } catch (error) {
    return NextResponse.json(
      { error: 'AUDIT_APPEND_ONLY', message: error.message },
      { status: 405 }
    );
  }
}

export async function DELETE() {
  try {
    deleteAuditEvent();
  } catch (error) {
    return NextResponse.json(
      { error: 'AUDIT_APPEND_ONLY', message: error.message },
      { status: 405 }
    );
  }
}
