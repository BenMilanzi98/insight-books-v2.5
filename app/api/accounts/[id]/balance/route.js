// app/api/accounts/[id]/balance/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { getAccountBalanceDetails } from '@/lib/accountBalanceService';

// GET - Get account balance with details
export async function GET(request, { params }) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) {
      return accessError;
    }

    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = params;
    const { searchParams } = new URL(request.url);
    const asOfDate = searchParams.get('asOfDate') ? new Date(searchParams.get('asOfDate')) : null;

    const balanceDetails = await getAccountBalanceDetails(id, user.tenantId, asOfDate);

    return NextResponse.json({
      success: true,
      data: balanceDetails
    });
  } catch (error) {
    console.error('Error fetching account balance:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch account balance' },
      { status: 500 }
    );
  }
}










