// app/api/account-balances/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

export async function GET(request) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Fetch account balances for the current tenant
    const balances = await prisma.accountBalance.findMany({
      where: { tenantId: user.tenantId },
      select: {
        account: true,
        balance: true
      }
    });

    return NextResponse.json({ balances });
  } catch (error) {
    console.error('Error fetching balance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch balance. Please try again.' },
      { status: 500 }
    );
  }
}
