import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { sumAccumulatedTax } from '@/lib/taxManagement/taxTransactionSubledger';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (!prisma.taxTransaction?.findMany) {
      return NextResponse.json({
        transactions: [],
        accumulated: { available: false, total: 0 },
        message: 'TaxTransaction model not loaded yet — run prisma generate and restart.',
      });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 200);

    const transactions = await prisma.taxTransaction.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { postingDate: 'desc' },
      take: limit,
    });

    const accumulated = await sumAccumulatedTax({ tenantId: user.tenantId });

    return NextResponse.json({ transactions, accumulated });
  } catch (error) {
    console.error('GET /api/tax-management/transactions:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load tax transactions' },
      { status: 500 }
    );
  }
}
