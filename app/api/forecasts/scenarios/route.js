// app/api/forecasts/scenarios/route.js
import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { generateScenarioForecast } from '@/lib/forecastingService';

// POST - Generate scenario forecasts
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
    const { startDate, endDate } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }

    const scenarios = await generateScenarioForecast(
      user.tenantId,
      startDate,
      endDate
    );

    return NextResponse.json({
      success: true,
      data: scenarios
    });
  } catch (error) {
    console.error('Error generating scenario forecasts:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate scenario forecasts' },
      { status: 500 }
    );
  }
}










