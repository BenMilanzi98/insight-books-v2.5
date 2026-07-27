import { NextResponse } from 'next/server';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';

/**
 * Process-level metrics only — no Math.random CPU/disk/network theatre.
 */
export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.health.view)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const mem = process.memoryUsage();
    const uptimeSeconds = Math.floor(process.uptime());

    return NextResponse.json({
      success: true,
      source: 'process',
      metrics: {
        uptimeSeconds,
        memory: {
          rss: mem.rss,
          heapTotal: mem.heapTotal,
          heapUsed: mem.heapUsed,
          external: mem.external,
          arrayBuffers: mem.arrayBuffers,
        },
        nodeVersion: process.version,
        pid: process.pid,
      },
      timestamp: new Date().toISOString(),
      message:
        'Host CPU/disk/network metrics are not available from this process. Prefer /api/admin/system-health.',
    });
  } catch (error) {
    console.error('Admin performance metrics fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch performance metrics' },
      { status: 500 }
    );
  }
}
