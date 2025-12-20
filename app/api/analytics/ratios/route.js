// app/api/analytics/ratios/route.js
import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { calculateFinancialRatios } from '@/lib/analyticsService';

// GET - Get financial ratios
export async function GET(request) {
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

    const { searchParams } = new URL(request.url);
    const asOfDate = searchParams.get('asOfDate');

    const ratios = await calculateFinancialRatios(user.tenantId, asOfDate);

    return NextResponse.json({
      success: true,
      data: ratios
    });
  } catch (error) {
    console.error('Error calculating financial ratios:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate financial ratios' },
      { status: 500 }
    );
  }
}










