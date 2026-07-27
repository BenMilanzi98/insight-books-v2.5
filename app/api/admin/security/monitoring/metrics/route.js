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
 * Audit-derived counts only — no hardcoded threat theatre.
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
    const startDate = startDateForTimeframe(timeframe);

    const securityActionFilter = {
      OR: [
        { action: { contains: 'SECURITY', mode: 'insensitive' } },
        { action: { contains: 'LOCK', mode: 'insensitive' } },
        { action: { contains: 'LOGIN_FAIL', mode: 'insensitive' } },
        { action: { contains: 'IMPERSONATION', mode: 'insensitive' } },
        { action: { contains: 'SUPPORT', mode: 'insensitive' } },
      ],
    };

    const where = {
      timestamp: { gte: startDate },
      ...securityActionFilter,
    };

    let securityEventCount = 0;
    let lockCount = 0;
    let loginFailCount = 0;
    try {
      const [total, locks, loginFails] = await Promise.all([
        prisma.adminAuditLog.count({ where }),
        prisma.adminAuditLog.count({
          where: {
            timestamp: { gte: startDate },
            action: { contains: 'LOCK', mode: 'insensitive' },
          },
        }),
        prisma.adminAuditLog.count({
          where: {
            timestamp: { gte: startDate },
            action: { contains: 'LOGIN_FAIL', mode: 'insensitive' },
          },
        }),
      ]);
      securityEventCount = total;
      lockCount = locks;
      loginFailCount = loginFails;
    } catch (e) {
      console.error('Security metrics audit query failed:', e);
    }

    return NextResponse.json({
      success: true,
      source: 'audit_derived',
      timeframe,
      metrics: {
        securityEventCount,
        lockRelatedCount: lockCount,
        loginFailCount,
        // Explicit zeros — no invented threat levels
        totalThreats: 0,
        highRisk: 0,
        mediumRisk: 0,
        lowRisk: 0,
        blockedAttempts: 0,
        suspiciousActivities: 0,
      },
      message:
        'Threat severity fields are zero: no dedicated threat engine. Counts above are from AdminAuditLog only.',
    });
  } catch (error) {
    console.error('Error fetching security metrics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch security metrics' },
      { status: 500 }
    );
  }
}
