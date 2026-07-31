import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { buildSupportExportPack } from '@/lib/admin/support';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') || 'json').toLowerCase();
    const result = await buildSupportExportPack(prisma, {
      admin,
      dataset: searchParams.get('dataset') || 'tickets',
      format,
      status: searchParams.get('status') || undefined,
      limit: searchParams.get('limit') || undefined,
    });

    if (result.forbidden) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient admin privileges',
          reasonCode: result.reasonCode,
        },
        { status: 403 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Export failed', ...result },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    if (format === 'csv') {
      return new NextResponse(result.csv || '', {
        status: 200,
        headers: {
          'Content-Type': result.contentType || 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="support-tickets-export.csv"',
          'X-Support-Export-Version': result.exportVersion || '',
          'X-Support-Export-Row-Count': String(result.rowCount ?? 0),
        },
      });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Support export error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to export support data' },
      { status: 500 }
    );
  }
}
