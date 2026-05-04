/**
 * Daily POS Micro Report API – one calendar day.
 */
import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { generatePosDailyReport } from '@/lib/posDailyReportService';
import { normalizeReportYmdParam } from '@/lib/reportingSourceRules';

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
    date = normalizeReportYmdParam(date);

    const branchIdParam = searchParams.get('branchId');
    const allBranches = /^(1|true|yes)$/i.test(String(searchParams.get('allBranches') || ''));

    let branchForReport = null;
    let branchIdsIn = null;

    if (branchIdParam && branchIdParam.trim() !== '') {
      branchForReport = branchIdParam.trim();
    } else if (allBranches) {
      const allowed = user.allowedBranchIds;
      if (Array.isArray(allowed) && allowed.length === 0) {
        return NextResponse.json({
          companyName: '',
          logoUrl: null,
          date,
          period: { startDate: date, endDate: date },
          totalSales: 0,
          transactionCount: 0,
          itemsSold: 0,
          averageSaleValue: 0,
          paymentBreakdown: [],
          paymentGrandTotal: 0,
          cashierBreakdown: [],
          totalCogs: 0,
          grossProfit: 0,
          voidedCount: 0,
          refundCount: 0,
          productsAffected: 0,
          metadata: { generatedAt: new Date().toISOString(), noBranchAccess: true }
        });
      }
      branchForReport = null;
      if (allowed != null && Array.isArray(allowed) && allowed.length > 0) {
        branchIdsIn = allowed;
      }
    } else {
      branchForReport = user.currentBranchId || null;
    }

    const report = await generatePosDailyReport(user.tenantId, date, branchForReport, {
      branchIdsIn
    });

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error generating POS daily report:', error);
    return NextResponse.json(
      { error: 'Failed to generate daily POS report. Please try again.' },
      { status: 500 }
    );
  }
}
