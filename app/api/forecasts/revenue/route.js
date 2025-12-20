// app/api/forecasts/revenue/route.js
import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { generateRevenueForecast } from '@/lib/forecastingService';

// POST - Generate revenue forecast
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
    const { startDate, endDate, method = 'trend' } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }

    const forecast = await generateRevenueForecast(
      user.tenantId,
      startDate,
      endDate,
      method
    );

    return NextResponse.json({
      success: true,
      data: forecast
    });
  } catch (error) {
    console.error('Error generating revenue forecast:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate revenue forecast' },
      { status: 500 }
    );
  }
}










