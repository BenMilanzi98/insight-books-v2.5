// app/api/analytics/profitability/route.js
import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { calculateProductProfitability, calculateCustomerProfitability } from '@/lib/analyticsService';

// POST - Get profitability analysis
export async function POST(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) {
      return accessError;
    }

    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { startDate, endDate, type = 'product' } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }

    let profitability;
    if (type === 'customer') {
      profitability = await calculateCustomerProfitability(user.tenantId, startDate, endDate);
    } else {
      profitability = await calculateProductProfitability(user.tenantId, startDate, endDate);
    }

    return NextResponse.json({
      success: true,
      data: profitability
    });
  } catch (error) {
    console.error('Error calculating profitability:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate profitability' },
      { status: 500 }
    );
  }
}










