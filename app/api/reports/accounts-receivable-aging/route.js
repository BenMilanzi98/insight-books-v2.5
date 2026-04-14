// app/api/reports/accounts-receivable-aging/route.js
import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { retiredReportResponse } from '@/lib/retiredReports';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated' },
        { status: 401 }
      );
    }
    return retiredReportResponse('accounts-receivable-aging');
  } catch (error) {
    console.error('accounts-receivable-aging:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
