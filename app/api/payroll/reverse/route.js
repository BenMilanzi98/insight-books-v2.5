/**
 * Dedicated Payroll Reversal API
 *
 * GET  /api/payroll/reverse?payrollId=xxx - Eligibility and impact preview
 * POST /api/payroll/reverse - Perform reversal
 *
 * Reverses or cancels a single payroll entry by payroll ID:
 * - **Posted journal:** reverses payroll GL (PAYROLL_REVERSAL + offsetting journal), restores balances.
 * - **No posted journal:** marks payroll `Reversed` with your reason (audit-only; aligns with bulk remove-entries).
 *
 * Body (POST): { payrollId: string, reversalReason: string }
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import {
  reversePayroll,
  checkAccountingPeriodLock,
  calculateReversalImpact,
  buildPostedPayrollJournalWhere,
  resolvePostedPayrollJournalState,
} from '@/lib/transactionReversalService';
import {
  countTransactionsLinkedToPayroll,
  markPayrollReversedIfNotAlready,
} from '@/lib/payrollCancelHelpers';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId || !user.id) {
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

    let glState;
    try {
      glState = await resolvePostedPayrollJournalState(user.tenantId, payrollId);
    } catch (e) {
      console.error('reverse GET resolvePostedPayrollJournalState:', e?.message || e);
      const linked = await countTransactionsLinkedToPayroll(user.tenantId, payrollId);
      if (linked === 0) {
        return NextResponse.json({
          eligible: true,
          reversalMode: 'mark_reversed',
          payrollId,
          employeeName: payroll.employee?.name,
          periodStart: payroll.periodStart,
          periodEnd: payroll.periodEnd,
          message:
            'No posted payroll journal could be resolved. You can submit a reason to mark this row reversed (audit only, no GL entries).',
          impact: null,
        });
      }
      return NextResponse.json(
        { eligible: false, error: e?.message || 'Could not determine payroll journal state.' },
        { status: 400 }
      );
    }

    if (glState.kind === 'multiple') {
      return NextResponse.json(
        {
          eligible: false,
          error: 'Multiple payroll journals exist for this payroll; contact support before reversing.',
        },
        { status: 400 }
      );
    }

    if (glState.kind === 'none' || glState.kind === 'empty_journal') {
      const linked = await countTransactionsLinkedToPayroll(user.tenantId, payrollId);
      return NextResponse.json({
        eligible: true,
        reversalMode: 'mark_reversed',
        payrollId,
        employeeName: payroll.employee?.name,
        periodStart: payroll.periodStart,
        periodEnd: payroll.periodEnd,
        message:
          linked === 0
            ? 'This payroll has no posted salary journal. Submit a reason below to mark it reversed (kept in the system for audit; no offsetting GL).'
            : 'No standard posted payroll journal was found. Submitting will try to complete cancellation or reversal according to your books.',
        impact: null,
      });
    }

    const payrollJournals = await prisma.transaction.findMany({
      where: buildPostedPayrollJournalWhere(user.tenantId, payrollId),
      orderBy: { date: 'asc' },
    });
    if (payrollJournals.length !== 1) {
      return NextResponse.json(
        { eligible: false, error: 'Unexpected payroll journal state; refresh and try again.' },
        { status: 400 }
      );
    }
    const journalTransaction = payrollJournals[0];
    const existingRev = await prisma.transaction.findFirst({
      where: {
        tenantId: user.tenantId,
        isReversal: true,
        reversedTransactionId: journalTransaction.id
      }
    });
    if (existingRev) {
      return NextResponse.json(
        { eligible: false, error: 'This payroll journal has already been reversed' },
        { status: 400 }
      );
    }
    const periodCheck = await checkAccountingPeriodLock(user.tenantId, new Date());
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
      reversalMode: 'gl_reversal',
      payrollId,
      transactionId: journalTransaction.id,
      employeeName: payroll.employee?.name,
      periodStart: payroll.periodStart,
      periodEnd: payroll.periodEnd,
      impact,
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
    if (!user?.tenantId || !user.id) {
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
    const trimmedReason = reversalReason.trim();
    if (trimmedReason.length < 10) {
      return NextResponse.json(
        { error: 'Reversal reason must be at least 10 characters' },
        { status: 400 }
      );
    }

    try {
      const result = await reversePayroll({
        payrollId,
        reversalReason: trimmedReason,
        userId: user.id,
        tenantId: user.tenantId,
      });

      return NextResponse.json(
        {
          success: true,
          message: 'Payroll reversed successfully. All GL entries reversed and balances restored.',
          reversal: result.reversal,
          payrollReversalSummary: result.payrollReversalSummary,
          taxReversals: result.taxReversals,
          audit: result.audit,
        },
        { status: 200 }
      );
    } catch (revErr) {
      const msg = String(revErr?.message || revErr || '').toLowerCase();
      const noJournalMsg =
        msg.includes('no posted journal') ||
        msg.includes('no posted journal transaction') ||
        msg.includes('cannot be performed without gl entries') ||
        msg.includes('has no journal entries to reverse') ||
        msg.includes('payroll journal transaction has no lines') ||
        msg.includes('reversal cannot be performed without gl');

      let again;
      try {
        again = await resolvePostedPayrollJournalState(user.tenantId, payrollId);
      } catch {
        again = { kind: 'unknown' };
      }
      const linked = await countTransactionsLinkedToPayroll(user.tenantId, payrollId);
      const allowSoftCancel =
        linked === 0 ||
        again.kind === 'none' ||
        again.kind === 'empty_journal' ||
        (noJournalMsg && again.kind !== 'multiple');

      if (allowSoftCancel) {
        const n = await markPayrollReversedIfNotAlready(user.tenantId, payrollId);
        if (n > 0) {
          try {
            await prisma.auditLog.create({
              data: {
                action: 'PAYROLL_REVERSED',
                entityType: 'PAYROLL',
                entityId: payrollId,
                userId: user.id,
                tenantId: user.tenantId,
                details: JSON.stringify({
                  mode: 'reverse_api_soft_cancel',
                  reversalReason: trimmedReason,
                }),
              },
            });
          } catch (auditErr) {
            console.error('reverse POST soft-cancel audit (non-fatal):', auditErr?.message || auditErr);
          }
          return NextResponse.json(
            {
              success: true,
              softCancelled: true,
              message:
                'Payroll marked Reversed: there was no posted payroll journal to reverse, or the journal state allowed a safe cancel. Audit trail retained.',
            },
            { status: 200 }
          );
        }
        return NextResponse.json({ error: 'This payroll has already been reversed' }, { status: 400 });
      }
      throw revErr;
    }
  } catch (error) {
    console.error('Payroll reversal error:', error);
    const message = error?.message || 'Payroll reversal failed';
    const status =
      message.includes('not found') ||
      message.includes('already been reversed') ||
      message.includes('Multiple payroll') ||
      message.includes('resolve duplicates')
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
