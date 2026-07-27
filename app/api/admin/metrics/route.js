import { NextResponse } from 'next/server';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import prisma from '@/lib/prisma';

/**
 * Real prisma counts + process uptime. No Math.random throughput.
 */
export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (
      !adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.health.view) &&
      !adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.dashboard.view)
    ) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const dbStart = Date.now();
    let dbQueryTime = null;
    let databaseStatus = 'disconnected';
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbQueryTime = Date.now() - dbStart;
      databaseStatus = dbQueryTime > 1000 ? 'slow' : 'connected';
    } catch {
      dbQueryTime = Date.now() - dbStart;
      databaseStatus = 'disconnected';
    }

    const [totalUsers, totalTenants, activeUsers, activeAdmins] = await Promise.all([
      prisma.user.count(),
      prisma.tenant.count(),
      prisma.user.count({
        where: { lastLogin: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      }),
      prisma.admin.count({ where: { isActive: true } }),
    ]);

    const mem = process.memoryUsage();
    const uptimeSeconds = Math.floor(process.uptime());

    return NextResponse.json({
      success: true,
      source: 'prisma_and_process',
      metrics: {
        systemStatus: databaseStatus === 'disconnected' ? 'error' : 'healthy',
        databaseStatus,
        dbQueryTime,
        totalUsers,
        totalTenants,
        activeUsers,
        activeAdmins,
        uptimeSeconds,
        processMemory: {
          rss: mem.rss,
          heapUsed: mem.heapUsed,
          heapTotal: mem.heapTotal,
        },
        lastUpdated: new Date().toISOString(),
      },
      message:
        'Request-rate and concurrent-session metrics are not instrumented in-app; omitted rather than faked.',
    });
  } catch (error) {
    console.error('Admin metrics error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch system metrics' },
      { status: 500 }
    );
  }
}
