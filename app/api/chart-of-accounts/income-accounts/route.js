// app/api/chart-of-accounts/income-accounts/route.js
// Lightweight endpoint for POS to fetch income accounts without Finance/Admin requirement
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// GET - Fetch income accounts for POS (no Finance/Admin requirement)
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Fetch income accounts (both 'Income' and 'Revenue' types for compatibility)
    const accounts = await prisma.account.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true,
        OR: [
          { accountType: 'Income' },
          { accountType: 'Revenue' }
        ]
      },
      select: {
        id: true,
        accountCode: true,
        accountName: true,
        accountType: true,
        isActive: true
      },
      orderBy: [
        { accountCode: 'asc' }
      ]
    });

    return NextResponse.json({
      accounts,
      count: accounts.length
    });
  } catch (error) {
    console.error('Error fetching income accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch income accounts', details: error.message },
      { status: 500 }
    );
  }
}
