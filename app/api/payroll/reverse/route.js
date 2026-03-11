/**
 * Dedicated Payroll Reversal API
 *
 * GET  /api/payroll/reverse?payrollId=xxx - Eligibility and impact preview
 * POST /api/payroll/reverse - Perform reversal
 *
 * Reverses a single payroll entry by payroll ID. This endpoint:
 * - Reverses all payroll GL entries (salary expense, PAYE, NPS, deductions, cash)
 * - Restores account balances correctly via equal-and-opposite journal entries
 * - Maintains full audit history (PAYROLL_REVERSAL + TRANSACTION_REVERSED)
 * - Prevents partial reversals: runs in one atomic transaction; fails if no journal exists
 *
 * Body (POST): { payrollId: string, reversalReason: string }
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { reversePayroll, checkAccountingPeriodLock, calculateReversalImpact } from '@/lib/transactionReversalService';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const payrollId = searchParams.get('payrollId');
    if (!payrollId) {
      return NextResponse.json(
        { error: 'payrollId query parameter is required' },
        { status: 400 }
      );
    }
    const payroll = await prisma.payroll.findFirst({
      where: { id: payrollId, tenantId: user.tenantId },
      include: { employee: { select: { id: true, name: true } } }
    });
    if (!payroll) {
      return NextResponse.json(
        { eligible: false, error: 'Payroll not found or access denied' },
        { status: 404 }
      );
    }
    if (payroll.status === 'Reversed') {
      return NextResponse.json(
        { eligible: false, error: 'This payroll has already been reversed' },
        { status: 400 }
      );
    }
    const journalTransaction = await prisma.transaction.findFirst({
      where: {
        tenantId: user.tenantId,
        sourceType: 'Payroll',
        sourceId: payrollId,
        status: 'posted',
        isReversal: false,
        reversedTransactionId: null
      }
    });
    if (!journalTransaction) {
      return NextResponse.json(
        { eligible: false, error: 'No posted journal transaction found for this payroll' },
        { status: 400 }
      );
    }
    const periodCheck = await checkAccountingPeriodLock(user.tenantId, journalTransaction.date);
    if (periodCheck.isLocked) {
      return NextResponse.json(
        { eligible: false, error: periodCheck.error },
        { status: 403 }
      );
    }
    let impact = null;
    try {
      impact = await calculateReversalImpact({
        transactionId: journalTransaction.id,
        transactionType: 'Transaction',
        tenantId: user.tenantId
      });
    } catch (e) {
      // optional
    }
    return NextResponse.json({
      eligible: true,
      payrollId,
      transactionId: journalTransaction.id,
      employeeName: payroll.employee?.name,
      periodStart: payroll.periodStart,
      periodEnd: payroll.periodEnd,
      impact
    });
  } catch (error) {
    console.error('Payroll reversal eligibility check error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to check reversal eligibility' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { payrollId, reversalReason } = body || {};

    if (!payrollId) {
      return NextResponse.json(
        { error: 'payrollId is required' },
        { status: 400 }
      );
    }

    if (!reversalReason || typeof reversalReason !== 'string' || !reversalReason.trim()) {
      return NextResponse.json(
        { error: 'Reversal reason is required and must be non-empty' },
        { status: 400 }
      );
    }

    const result = await reversePayroll({
      payrollId,
      reversalReason: reversalReason.trim(),
      userId: user.id,
      tenantId: user.tenantId
    });

    return NextResponse.json({
      success: true,
      message: 'Payroll reversed successfully. All GL entries reversed and balances restored.',
      reversal: result.reversal,
      payrollReversalSummary: result.payrollReversalSummary,
      taxReversals: result.taxReversals,
      audit: result.audit
    }, { status: 200 });
  } catch (error) {
    console.error('Payroll reversal error:', error);
    const message = error?.message || 'Payroll reversal failed';
    const status =
      message.includes('not found') || message.includes('already been reversed')
        ? 400
        : message.includes('accounting period') || message.includes('locked')
          ? 403
          : 500;
    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}
