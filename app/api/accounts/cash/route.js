import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

const FALLBACK_CASH_CODES = ['1000', '1005', '1010', '1020', '1030', '1040', '1050'];

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const accounts = await prisma.account.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true,
        OR: [
          { accountCode: { in: FALLBACK_CASH_CODES } },
          { accountSubtype: { contains: 'Cash', mode: 'insensitive' } },
          { accountSubtype: { contains: 'Bank', mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        accountCode: true,
        accountName: true
      },
      orderBy: [{ accountCode: 'asc' }]
    });

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error('Error fetching cash accounts:', error);
    return NextResponse.json(
      { error: 'Failed to load payment accounts' },
      { status: 500 }
    );
  }
}