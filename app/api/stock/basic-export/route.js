import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { exportBasicStockWorkbook } from '@/lib/stock/basicStockExportService.js';
import prisma from '@/lib/prisma';

export async function GET(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const tenant = await prisma.tenant.findFirst({
      where: { id: user.tenantId },
      select: { name: true },
    });

    const { buffer, filename } = await exportBasicStockWorkbook({
      tenantId: user.tenantId,
      search,
      businessName: tenant?.name || 'Business',
    });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('basic stock export error', error);
    return NextResponse.json({ error: error.message || 'Export failed' }, { status: 500 });
  }
}
