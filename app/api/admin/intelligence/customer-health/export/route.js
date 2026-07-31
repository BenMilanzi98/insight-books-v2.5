import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { authorizeAdminDecision } from '@/lib/admin/authorization/authorizeAdminDecision';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import {
  buildHealthExportPack,
  formatHealthExportCsv,
  resolveHealthAccess,
} from '@/lib/admin/health';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const access = resolveHealthAccess(admin);
    const exportOk = authorizeAdminDecision({
      admin,
      permission: SYSTEM_ADMIN_PERMISSIONS.audit.export,
    });
    if (!access.canView && !exportOk.allowed) {
      return NextResponse.json(
        { success: false, error: 'Export not permitted' },
        { status: 403 }
      );
    }
    if (!access.canView) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') || 'json').toLowerCase();
    const pageSize = searchParams.get('pageSize') || '100';

    const pack = await buildHealthExportPack(prisma, {
      admin,
      pageSize,
      now: new Date(),
    });

    if (pack.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    try {
      await prisma.adminAuditLog.create({
        data: {
          adminId: admin.id,
          action: 'CUSTOMER_HEALTH_EXPORT',
          entityType: 'INTELLIGENCE',
          entityId: 'customer-health',
          details: JSON.stringify({
            definitionVersion: pack.definitionVersion,
            format,
            rowCount: Array.isArray(pack.rows) ? pack.rows.length : null,
          }),
        },
      });
    } catch {
      /* non-fatal */
    }

    if (format === 'csv') {
      const csv = formatHealthExportCsv(pack);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="customer-health-snapshots.csv"',
        },
      });
    }

    if (format === 'xlsx' || format === 'pdf') {
      return NextResponse.json(
        {
          success: false,
          error: 'Format UNAVAILABLE',
          reasonCode: 'format_unavailable',
          message: `${format.toUpperCase()} export not implemented; use json or csv.`,
        },
        { status: 501 }
      );
    }

    return NextResponse.json({ success: true, ...pack });
  } catch (error) {
    console.error('customer-health export error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to export customer health' },
      { status: 500 }
    );
  }
}
