import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { buildCrmExportPack } from '@/lib/admin/crm';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await buildCrmExportPack(prisma, {
      admin,
      dataset: searchParams.get('dataset') || 'leads',
      format: searchParams.get('format') || 'json',
      status: searchParams.get('status') || undefined,
      limit: searchParams.get('limit') || undefined,
    });

    if (result.forbidden) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient admin privileges',
          reasonCode: result.reasonCode,
          status: result.status,
        },
        { status: 403 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Export failed' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    const filename = `crm-${result.dataset}.${result.format === 'csv' ? 'csv' : 'json'}`;
    return new NextResponse(result.body, {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-CRM-Export-Version': result.exportVersion,
        'X-CRM-Row-Count': String(result.rowCount),
      },
    });
  } catch (error) {
    console.error('CRM export error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to export CRM data' },
      { status: 500 }
    );
  }
}
