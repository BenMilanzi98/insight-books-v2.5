import { NextResponse } from 'next/server';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import { getPosCashDayState } from '@/lib/posCashDayService';
import { generatePosDailyReport } from '@/lib/posDailyReportService';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const perm = await requireAnyPermission(request, [
      'sales.view',
      'sales.create',
      'sales.update',
    ]);
    if (perm) return perm;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || undefined;
    try {
      const state = await getPosCashDayState(user.tenantId, date);
      return NextResponse.json(state);
    } catch (inner) {
      // e.g. DB not migrated yet — still return POS daily report for the UI
      console.warn('pos/cash-day register unavailable, falling back to report only:', inner?.message || inner);
      const d = date || new Date().toISOString().slice(0, 10);
      const report = await generatePosDailyReport(user.tenantId, d, null, { branchIdsIn: null });
      return NextResponse.json({
        businessDate: d,
        branchKey: 'none',
        systemCashAccount: null,
        liveCashBalance: 0,
        register: null,
        report,
        companyName: report.companyName,
        tillOpen: false,
        tillClosed: false,
        requiresTillOpen: true,
        suggestedOpeningBalance: 0,
        metrics: {
          openingBalance: 0,
          totalSales: report.totalSales || 0,
          totalCashSales: 0,
          depositsSum: 0,
          closingBalance: report.totalSales || 0,
          cashInHandUndeposited: 0,
          cashInHandTotalCashMinusOpening: 0,
        },
      });
    }
  } catch (e) {
    console.error('pos/cash-day GET', e);
    return NextResponse.json({ error: e?.message || 'Failed to load POS cash day' }, { status: 500 });
  }
}
