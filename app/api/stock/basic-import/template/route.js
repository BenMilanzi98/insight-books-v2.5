import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { buildBasicStockWorkbookBuffer } from '@/lib/stock/basicStockWorkbook.js';

export async function GET(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const withExample = /^(1|true|yes)$/i.test(String(searchParams.get('example') || ''));
    const buffer = await buildBasicStockWorkbookBuffer([], { includeExample: withExample });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Stock_Import_Template.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('basic stock template error', error);
    return NextResponse.json({ error: error.message || 'Failed to build template' }, { status: 500 });
  }
}
