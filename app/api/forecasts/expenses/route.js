// app/api/forecasts/expenses/route.js
import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { generateExpenseForecast } from '@/lib/forecastingService';

// POST - Generate expense forecast
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

    const forecast = await generateExpenseForecast(
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
    console.error('Error generating expense forecast:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate expense forecast' },
      { status: 500 }
    );
  }
}










