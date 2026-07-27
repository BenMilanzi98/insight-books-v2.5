import { NextResponse } from 'next/server';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import prisma from '@/lib/prisma';

function startDateForTimeframe(timeframe) {
  const now = Date.now();
  switch (timeframe) {
    case '1h':
      return new Date(now - 60 * 60 * 1000);
    case '7d':
      return new Date(now - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now - 30 * 24 * 60 * 60 * 1000);
    case '24h':
    default:
      return new Date(now - 24 * 60 * 60 * 1000);
  }
}

/**
 * Recent security-related AdminAuditLog rows — never mock events.
 */
export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.security.view)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || '24h';
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10) || 100, 500);
    const startDate = startDateForTimeframe(timeframe);

    const logs = await prisma.adminAuditLog.findMany({
      where: {
        timestamp: { gte: startDate },
        OR: [
          { action: { contains: 'SECURITY', mode: 'insensitive' } },
          { action: { contains: 'LOCK', mode: 'insensitive' } },
          { action: { contains: 'LOGIN_FAIL', mode: 'insensitive' } },
          { action: { contains: 'IMPERSONATION', mode: 'insensitive' } },
          { action: { contains: 'SUPPORT', mode: 'insensitive' } },
        ],
      },
      include: {
        admin: {
          select: { name: true, email: true },
        },
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    const events = logs.map((log) => ({
      id: log.id,
      eventType: log.action,
      description: log.details || log.action,
      user: log.admin?.email || log.admin?.name || log.adminId,
      ipAddress: log.ipAddress || null,
      timestamp: log.timestamp,
      entityType: log.entityType,
      entityId: log.entityId,
      source: 'admin_audit_log',
    }));

    return NextResponse.json({
      success: true,
      events,
      total: events.length,
      source: 'admin_audit_log',
      timeframe,
    });
  } catch (error) {
    console.error('Error fetching security events:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch security events' },
      { status: 500 }
    );
  }
}
