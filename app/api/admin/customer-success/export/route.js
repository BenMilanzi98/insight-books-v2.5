import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { buildCsExportPack, formatCsExportCsv } from '@/lib/admin/customerSuccess';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const format = String(searchParams.get('format') || 'json').toLowerCase();
    const pack = await buildCsExportPack(prisma, {
      admin,
      dataset: searchParams.get('dataset') || 'cases',
      format,
      tenantId: searchParams.get('tenantId') || undefined,
    });

    if (pack.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }
    if (!pack.ok) {
      return NextResponse.json(
        { success: false, error: pack.error || 'Export failed' },
        { status: 400 }
      );
    }

    if (format === 'csv') {
      const csv = formatCsExportCsv(pack);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="cs-${pack.dataset}.csv"`,
        },
      });
    }

    return NextResponse.json({ success: true, ...pack });
  } catch (error) {
    console.error('CS export error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to export CS data' },
      { status: 500 }
    );
  }
}
