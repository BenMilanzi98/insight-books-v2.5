// app/api/analytics/trends/route.js
import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { calculateTrends } from '@/lib/analyticsService';

// POST - Get trend analysis
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
    const { startDate, endDate, metric = 'revenue' } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }

    const trends = await calculateTrends(user.tenantId, startDate, endDate, metric);

    return NextResponse.json({
      success: true,
      data: trends
    });
  } catch (error) {
    console.error('Error calculating trends:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate trends' },
      { status: 500 }
    );
  }
}










