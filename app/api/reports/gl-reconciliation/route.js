import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { runGlReconciliation } from '@/lib/glReconciliation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/reports/gl-reconciliation
 *
 * Auditors / admins: verifies TB engine internal consistency (raw survivor map vs TB rows)
 * and that posted manual journals balance per entry.
 *
 * Query: startDate, endDate (required YYYY-MM-DD), branchId optional (all / empty = all branches)
 */
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    const branchIdParam = searchParams.get('branchId');
    const branchId =
      branchIdParam === 'all' || branchIdParam === '' ? null :
      (branchIdParam ?? user.currentBranchId ?? null);

    const report = await runGlReconciliation({
      tenantId: user.tenantId,
      branchId,
      startDate,
      endDate,
    });

    return NextResponse.json(report);
  } catch (error) {
    console.error('gl-reconciliation:', error);
    return NextResponse.json(
      { error: 'Failed to run GL reconciliation', message: error.message },
      { status: 500 }
    );
  }
}
