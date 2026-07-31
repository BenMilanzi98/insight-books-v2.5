import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma.js';
import {
  guardSecurityRoute,
  securityErrorResponse,
} from '../../../../lib/securityGovernance/api/routeGuard.js';
import { SECURITY_PERMISSIONS } from '../../../../lib/securityGovernance/permissions.js';
import {
  listActiveSessions,
  revokeSession,
  revokeAllUserSessions,
} from '../../../../lib/securityGovernance/application/sessionService.js';

export async function GET(request) {
  try {
    const guard = await guardSecurityRoute(request, [
      SECURITY_PERMISSIONS.MANAGE_SESSIONS,
      SECURITY_PERMISSIONS.VIEW_DASHBOARD,
    ]);
    if (guard.response) return guard.response;
    const sessions = await listActiveSessions(
      prisma,
      guard.context.businessId,
      guard.context.effectiveUserId
    );
    return NextResponse.json({ sessions });
  } catch (error) {
    return securityErrorResponse(error, 'list sessions');
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const guard = await guardSecurityRoute(request, SECURITY_PERMISSIONS.MANAGE_SESSIONS);
    if (guard.response) return guard.response;

    if (body.action === 'revoke') {
      const row = await revokeSession(prisma, guard.context, body.sessionId, body.reason);
      return NextResponse.json({ session: row });
    }
    if (body.action === 'revokeOthers') {
      const result = await revokeAllUserSessions(
        prisma,
        guard.context,
        guard.context.effectiveUserId,
        { exceptSessionId: guard.context.sessionId }
      );
      return NextResponse.json({ result });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return securityErrorResponse(error, 'session action');
  }
}
