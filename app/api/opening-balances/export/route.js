import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import { buildOpeningBalanceStatusReport } from '@/lib/openingBalanceReport';
import { generateOpeningBalanceWorkbook } from '@/lib/openingBalanceExport';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const perm = await requireAnyPermission(request, [
      'openingBalances.export',
      'openingBalances.view',
      'accounts.export',
    ]);
    if (perm) return perm;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') || 'xlsx').toLowerCase();

    const report = await buildOpeningBalanceStatusReport(user.tenantId);
    const tenant = await prisma.tenant.findFirst({
      where: { id: user.tenantId },
      select: { name: true },
    });

    const meta = {
      businessName: tenant?.name || 'Business',
      generatedBy: user.name || user.email || 'User',
      generatedAt: new Date(),
    };

    if (format === 'pdf') {
      const { generateOpeningBalancePdfBuffer } = await import('@/lib/openingBalancePdf');
      const buffer = await generateOpeningBalancePdfBuffer(report, meta);
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="opening-balances-${Date.now()}.pdf"`,
        },
      });
    }

    const buffer = generateOpeningBalanceWorkbook(report, meta);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="opening-balances-${Date.now()}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('opening-balances export:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
