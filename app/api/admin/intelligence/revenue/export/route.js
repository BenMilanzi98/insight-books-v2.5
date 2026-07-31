import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { authorizeAdminDecision } from '@/lib/admin/authorization/authorizeAdminDecision';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import {
  buildRevenueExportPack,
  formatRevenueExportCsv,
} from '@/lib/admin/revenue';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);
    const currency = searchParams.get('currency') || 'MWK';
    const format = (searchParams.get('format') || 'json').toLowerCase();
    const now = new Date();
    const periodStart = new Date(
      now.getTime() - Math.min(Math.max(days, 1), 365) * 864e5
    );

    const pack = await buildRevenueExportPack(prisma, {
      admin,
      periodStart,
      periodEnd: now,
      currency,
      now,
    });

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
    const canExport =
      exportOk.allowed ||
      authorizeAdminDecision({
        admin,
        permission: SYSTEM_ADMIN_PERMISSIONS.intel.revenueRead,
      }).allowed ||
      authorizeAdminDecision({
        admin,
        permission: SYSTEM_ADMIN_PERMISSIONS.dashboard.view,
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
          action: 'REVENUE_KPI_EXPORT',
          entityType: 'INTELLIGENCE',
          entityId: 'revenue-workbench',
          details: JSON.stringify({
            catalogueVersion: pack.catalogueVersion,
            format,
            currency,
          }),
        },
      });
    } catch {
      /* non-fatal */
    }

    if (format === 'csv') {
      const csv = formatRevenueExportCsv(pack);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="revenue-kpis.csv"',
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

    return NextResponse.json({
      success: true,
      exportedAt: new Date().toISOString(),
      catalogueVersion: pack.catalogueVersion,
      period: pack.period,
      currency: pack.currency,
      metrics: pack.metrics,
      attention: pack.attention,
      sections: pack.sections,
      sources: pack.sources,
    });
  } catch (error) {
    console.error('revenue export error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to export revenue KPIs' },
      { status: 500 }
    );
  }
}
