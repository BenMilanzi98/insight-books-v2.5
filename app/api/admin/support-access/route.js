import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import {
  assertSupportAccessAllowed,
  buildSupportSessionPayload,
  SUPPORT_ACCESS_STATUSES,
} from '@/lib/admin/supportAccess';

function clientMeta(request) {
  return {
    ipAddress:
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  };
}

/**
 * GET /api/admin/support-access — list recent support access sessions
 */
export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.tenants.supportAccess)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 200);
    const tenantId = searchParams.get('tenantId') || undefined;
    const status = searchParams.get('status') || undefined;

    const sessions = await prisma.platformSupportAccess.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });

    // Expire stale ACTIVE sessions lazily on read
    const now = new Date();
    const expiredIds = sessions
      .filter(
        (s) =>
          s.status === SUPPORT_ACCESS_STATUSES.ACTIVE &&
          s.expiresAt &&
          new Date(s.expiresAt).getTime() <= now.getTime()
      )
      .map((s) => s.id);

    if (expiredIds.length > 0) {
      await prisma.platformSupportAccess.updateMany({
        where: { id: { in: expiredIds } },
        data: {
          status: SUPPORT_ACCESS_STATUSES.EXPIRED,
          endedAt: now,
          endReason: 'Session expired',
        },
      });
      for (const s of sessions) {
        if (expiredIds.includes(s.id)) {
          s.status = SUPPORT_ACCESS_STATUSES.EXPIRED;
          s.endedAt = now;
          s.endReason = 'Session expired';
        }
      }
    }

    return NextResponse.json({ success: true, sessions });
  } catch (error) {
    console.error('Support access list error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list support access sessions',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/support-access
 * Start: { tenantId, reason, durationMinutes? }
 * End:   { action: 'end', sessionId, endReason? }
 */
export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const allowed = assertSupportAccessAllowed({
      admin,
      permissionCheck: () =>
        adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.tenants.supportAccess),
    });
    if (!allowed.ok) {
      return NextResponse.json(
        { success: false, error: allowed.error },
        { status: allowed.error.includes('permission') ? 403 : 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || 'start').toLowerCase();
    const meta = clientMeta(request);

    if (action === 'end') {
      const sessionId = body?.sessionId;
      if (!sessionId) {
        return NextResponse.json(
          { success: false, error: 'sessionId is required to end a session' },
          { status: 400 }
        );
      }

      const existing = await prisma.platformSupportAccess.findUnique({
        where: { id: sessionId },
      });
      if (!existing) {
        return NextResponse.json(
          { success: false, error: 'Support access session not found' },
          { status: 404 }
        );
      }
      if (existing.status !== SUPPORT_ACCESS_STATUSES.ACTIVE) {
        return NextResponse.json(
          { success: false, error: 'Session is not active' },
          { status: 400 }
        );
      }

      const ended = await prisma.platformSupportAccess.update({
        where: { id: sessionId },
        data: {
          status: SUPPORT_ACCESS_STATUSES.ENDED,
          endedAt: new Date(),
          endReason: String(body?.endReason || 'Ended by admin').trim(),
        },
      });

      await prisma.adminAuditLog.create({
        data: {
          adminId: admin.id,
          action: 'SUPPORT_ACCESS_END',
          entityType: 'SUPPORT_ACCESS',
          entityId: ended.id,
          details: JSON.stringify({
            sessionId: ended.id,
            tenantId: ended.tenantId,
            realActorId: admin.id,
            endReason: ended.endReason,
          }),
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
      });

      return NextResponse.json({ success: true, session: ended });
    }

    // Start session
    const tenantId = body?.tenantId;
    const reason = body?.reason;
    const durationMinutes = body?.durationMinutes;

    const tenant = tenantId
      ? await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { id: true, name: true, status: true },
        })
      : null;
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 });
    }

    const built = buildSupportSessionPayload({
      adminId: admin.id,
      tenantId,
      reason,
      durationMinutes,
    });
    if (!built.ok) {
      return NextResponse.json({ success: false, error: built.error }, { status: 400 });
    }

    // End any other ACTIVE sessions for this admin+tenant before starting a new one
    await prisma.platformSupportAccess.updateMany({
      where: {
        adminId: admin.id,
        tenantId,
        status: SUPPORT_ACCESS_STATUSES.ACTIVE,
      },
      data: {
        status: SUPPORT_ACCESS_STATUSES.ENDED,
        endedAt: new Date(),
        endReason: 'Superseded by new session',
      },
    });

    const session = await prisma.platformSupportAccess.create({
      data: {
        adminId: admin.id,
        tenantId,
        reason: built.session.reason,
        status: SUPPORT_ACCESS_STATUSES.ACTIVE,
        startedAt: new Date(built.session.startedAt),
        expiresAt: new Date(built.session.expiresAt),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'SUPPORT_ACCESS_START',
        entityType: 'SUPPORT_ACCESS',
        entityId: session.id,
        details: JSON.stringify({
          sessionId: session.id,
          tenantId,
          tenantName: tenant.name,
          reason: session.reason,
          expiresAt: session.expiresAt,
          realActorId: admin.id,
          effectiveTenantId: tenantId,
        }),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    return NextResponse.json(
      {
        success: true,
        session: {
          ...session,
          realActorId: admin.id,
          effectiveTenantId: tenantId,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Support access mutation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to manage support access',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
