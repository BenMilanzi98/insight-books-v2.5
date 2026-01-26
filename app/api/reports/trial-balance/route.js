import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { buildTrialBalance } from '@/lib/trialBalanceReport';

// Ensure fresh data (branch switching)
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Trial Balance (journal-driven; accountant-friendly)
 *
 * Core rule: calculated from POSTED journal entries + lines.
 * Never “fix” imbalances at report level.
 *
 * Query:
 * - startDate (YYYY-MM-DD) required
 * - endDate (YYYY-MM-DD) required
 * - branchId optional: if omitted uses session branch; if "all" or "" uses all branches
 * - includeZero optional: true/false (default false)
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
    const branchIdParam = searchParams.get('branchId');
    const includeZero = (searchParams.get('includeZero') || 'false').toLowerCase() === 'true';

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 });
    }

    const branchId =
      branchIdParam === 'all' || branchIdParam === '' ? null :
      (branchIdParam ?? user.currentBranchId ?? null);

    const report = await buildTrialBalance({
      tenantId: user.tenantId,
      branchId,
      startDate,
      endDate,
      includeZero,
    });

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error generating trial balance:', error);
    return NextResponse.json(
      { error: 'Failed to generate trial balance', message: error.message },
      { status: 500 }
    );
  }
}







