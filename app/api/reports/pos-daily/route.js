/**
 * Daily POS Micro Report API – one calendar day.
 */
import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { generatePosDailyReport } from '@/lib/posDailyReportService';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated' },
        { status: 401 }
      );
    }

    const url = request.nextUrl ?? request.url;
    const searchParams = typeof url === 'object' && url.searchParams ? url.searchParams : new URL(String(url || '').startsWith('http') ? url : `http://localhost${String(url || '').startsWith('/') ? url : '/'}`, 'http://localhost').searchParams;
    let date = searchParams.get('date');
    if (!date) {
      const t = new Date();
      date = t.toISOString().slice(0, 10);
    }

    const branchIdParam = searchParams.get('branchId');
    const branchForReport =
      branchIdParam && branchIdParam.trim() !== ''
        ? branchIdParam
        : user.currentBranchId || null;

    const report = await generatePosDailyReport(
      user.tenantId,
      date,
      branchForReport
    );

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error generating POS daily report:', error);
    return NextResponse.json(
      { error: 'Failed to generate daily POS report. Please try again.' },
      { status: 500 }
    );
  }
}
