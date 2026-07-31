import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { buildExecutiveKpiPack } from '@/lib/admin/intelligence/executiveKpiPack';
import { authorizeAdminDecision } from '@/lib/admin/authorization/authorizeAdminDecision';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const pack = await buildExecutiveKpiPack(prisma, { admin });
    if (pack.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    const exportOk = authorizeAdminDecision({
      admin,
      permission: SYSTEM_ADMIN_PERMISSIONS.audit.export,
    });
    // Allow intel readers to export summary JSON; Super Admin / audit.export also fine
    const canExport =
      exportOk.allowed ||
      authorizeAdminDecision({
        admin,
        permission: SYSTEM_ADMIN_PERMISSIONS.intel.executiveRead,
      }).allowed;

    if (!canExport) {
      return NextResponse.json(
        { success: false, error: 'Export not permitted' },
        { status: 403 }
      );
    }

    try {
      await prisma.adminAuditLog.create({
        data: {
          adminId: admin.id,
          action: 'EXECUTIVE_KPI_EXPORT',
          entityType: 'INTELLIGENCE',
          entityId: 'executive-overview',
          details: JSON.stringify({ catalogueVersion: pack.catalogueVersion }),
        },
      });
    } catch {
      /* non-fatal */
    }

    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') || 'json').toLowerCase();

    if (format === 'csv') {
      const lines = ['code,status,value,unit,currency,reason'];
      for (const m of Object.values(pack.metrics || {})) {
        lines.push(
          [
            m.code,
            m.status,
            m.value == null || typeof m.value === 'object' ? '' : m.value,
            m.unit || '',
            m.currency || '',
            m.reasonMessage || '',
          ]
            .map((c) => `"${String(c).replace(/"/g, '""')}"`)
            .join(',')
        );
      }
      return new NextResponse(lines.join('\n'), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="executive-kpis.csv"',
        },
      });
    }

    return NextResponse.json({
      success: true,
      exportedAt: new Date().toISOString(),
      catalogueVersion: pack.catalogueVersion,
      period: pack.period,
      metrics: pack.metrics,
      attention: pack.attention,
    });
  } catch (error) {
    console.error('executive export error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to export executive KPIs' },
      { status: 500 }
    );
  }
}
