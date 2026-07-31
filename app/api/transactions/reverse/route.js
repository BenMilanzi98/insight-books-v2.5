/**
 * Transaction Reversal API Routes
 *
 * Delegates execute path to the canonical Reversal Engine façade.
 * GL remains V2-only via reverseSourceJournals inside domain create*Reversal.
 */

import { NextResponse } from 'next/server';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import {
  validateReversalEligibility,
  validateReversalReason,
  getReversalDetails,
  listReversibleTransactions,
  calculateReversalImpact,
} from '@/lib/transactionReversalService';
import {
  executeTransactionReversal,
  requestTransactionReversal,
  approveTransactionReversal,
  rejectTransactionReversal,
  previewTransactionReversalImpact,
  findRegisterRow,
  listPendingReversalApprovals,
  resolveReversalSodPolicy,
} from '@/lib/reversals';



const normalizeTransactionType = (type) => {
  if (!type) return type;
  const normalized = type.trim();
  const lower = normalized.toLowerCase();
  const typeMap = {
    invoice: 'Invoice',
    expense: 'Expense',
    payment: 'Payment',
    sale: 'Sale',
    supplierpayment: 'SupplierPayment',
    transaction: 'Transaction',
  };
  return typeMap[lower] || normalized;
};

/**
 * GET /api/transactions/reverse
 */
async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';
    const tenantId = user.tenantId;

    if (action === 'details') {
      const transactionId = searchParams.get('transactionId');
      const transactionType = normalizeTransactionType(searchParams.get('transactionType'));

      if (!transactionId || !transactionType) {
        return NextResponse.json(
          { error: 'transactionId and transactionType are required' },
          { status: 400 }
        );
      }

      try {
        const details = await getReversalDetails({
          transactionId,
          transactionType,
          tenantId,
        });
        return NextResponse.json(details);
      } catch (error) {
        console.error('Error in getReversalDetails:', error);
        return NextResponse.json(
          {
            error: error.message || 'Failed to get reversal details',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
          },
          { status: 500 }
        );
      }
    }

    if (action === 'impact') {
      const transactionId = searchParams.get('transactionId');
      const transactionType = normalizeTransactionType(searchParams.get('transactionType'));

      if (!transactionId || !transactionType) {
        return NextResponse.json(
          { error: 'transactionId and transactionType are required' },
          { status: 400 }
        );
      }

      try {
        const preview = await previewTransactionReversalImpact({
          tenantId,
          sourceType: transactionType,
          sourceId: transactionId,
        });
        // Preserve legacy shape used by TransactionReversal modal (impact fields at root)
        return NextResponse.json({
          ...preview.impact,
          eligibility: preview.eligibility,
          periodPolicy: preview.periodPolicy,
        });
      } catch (error) {
        console.error('Error in calculateReversalImpact:', error);
        try {
          const impact = await calculateReversalImpact({
            transactionId,
            transactionType,
            tenantId,
          });
          return NextResponse.json(impact);
        } catch (fallbackError) {
          return NextResponse.json(
            {
              error: fallbackError.message || error.message || 'Failed to calculate reversal impact',
              details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            },
            { status: 500 }
          );
        }
      }
    }

    if (action === 'eligibility') {
      const transactionId = searchParams.get('transactionId');
      const transactionType = normalizeTransactionType(searchParams.get('transactionType'));
      if (!transactionId || !transactionType) {
        return NextResponse.json(
          { error: 'transactionId and transactionType are required' },
          { status: 400 }
        );
      }
      const eligibility = await validateReversalEligibility({
        transactionId,
        transactionType,
        tenantId,
      });
      return NextResponse.json(eligibility);
    }

    if (action === 'register') {
      const transactionId = searchParams.get('transactionId');
      const transactionType = normalizeTransactionType(searchParams.get('transactionType'));
      if (!transactionId || !transactionType) {
        return NextResponse.json(
          { error: 'transactionId and transactionType are required' },
          { status: 400 }
        );
      }
      try {
        const register = await findRegisterRow({
          tenantId,
          sourceType: transactionType,
          sourceId: transactionId,
        });
        return NextResponse.json({ register: register || null });
      } catch {
        return NextResponse.json({ register: null });
      }
    }

    if (action === 'pending') {
      const pending = await listPendingReversalApprovals({ tenantId });
      const sod = await resolveReversalSodPolicy({ tenantId });
      return NextResponse.json({ pending, sod });
    }

    if (action === 'sod') {
      const sod = await resolveReversalSodPolicy({ tenantId });
      return NextResponse.json({ sod });
    }

    // Default: list reversible transactions

    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');

    const transactions = await listReversibleTransactions({
      tenantId,
      type,
      status,
      startDate,
      endDate,
      search,
    });

    return NextResponse.json({ transactions });
  } catch (error) {
    console.error('Error in GET /api/transactions/reverse:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/transactions/reverse
 * Body actions: execute (default) | request | approve | reject
 */
async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const perm = await requireAnyPermission(request, [
      'journal.reverse',
      'journalEntries.update',
    ]);
    if (perm) return perm;

    const body = await request.json();
    const action = body.action || 'execute';
    const {
      transactionId,
      reversalReason,
      reversalId,
      idempotencyKey,
      crossPeriodDisclosure,
      rejectionReason,
    } = body;
    const transactionType = normalizeTransactionType(body.transactionType);

    const tenantId = user.tenantId;
    const userId = user.id;
    const sod = await resolveReversalSodPolicy({ tenantId });

    if (action === 'approve') {
      if (!reversalId) {
        return NextResponse.json({ error: 'reversalId is required' }, { status: 400 });
      }
      const register = await approveTransactionReversal({
        tenantId,
        userId,
        reversalId,
      });
      return NextResponse.json({ success: true, register, sod });
    }

    if (action === 'reject') {
      if (!reversalId) {
        return NextResponse.json({ error: 'reversalId is required' }, { status: 400 });
      }
      const register = await rejectTransactionReversal({
        tenantId,
        userId,
        reversalId,
        rejectionReason: rejectionReason || null,
      });
      return NextResponse.json({ success: true, register, sod });
    }

    if (action === 'request') {
      if (!transactionId || !transactionType) {
        return NextResponse.json(
          { error: 'transactionId and transactionType are required' },
          { status: 400 }
        );
      }
      const reasonValidation = validateReversalReason(reversalReason);
      if (!reasonValidation.isValid) {
        return NextResponse.json({ error: reasonValidation.error }, { status: 400 });
      }
      const register = await requestTransactionReversal({
        tenantId,
        userId,
        sourceType: transactionType,
        sourceId: transactionId,
        reason: reasonValidation.reason,
        idempotencyKey: idempotencyKey || null,
        crossPeriodDisclosure: Boolean(crossPeriodDisclosure),
      });
      return NextResponse.json({ success: true, register, sod }, { status: 201 });
    }

    // Default execute
    if (!transactionId || !transactionType) {
      return NextResponse.json(
        { error: 'transactionId and transactionType are required' },
        { status: 400 }
      );
    }

    const reasonValidation = validateReversalReason(reversalReason);
    if (!reasonValidation.isValid) {
      return NextResponse.json({ error: reasonValidation.error }, { status: 400 });
    }

    // SoD on + no approved register id → create request only (do not execute).
    if (sod.requireSeparateApprover && !reversalId) {
      const register = await requestTransactionReversal({
        tenantId,
        userId,
        sourceType: transactionType,
        sourceId: transactionId,
        reason: reasonValidation.reason,
        idempotencyKey: idempotencyKey || null,
        crossPeriodDisclosure: Boolean(crossPeriodDisclosure),
      });
      return NextResponse.json(
        {
          success: true,
          pendingApproval: true,
          message:
            'Reversal submitted for approval. A separate user must approve before it posts.',
          register,
          sod,
        },
        { status: 202 }
      );
    }

    const result = await executeTransactionReversal({
      tenantId,
      userId,
      sourceType: transactionType,
      sourceId: transactionId,
      reason: reasonValidation.reason,
      idempotencyKey: idempotencyKey || null,
      crossPeriodDisclosure: Boolean(crossPeriodDisclosure),
      requireApproval: sod.requireSeparateApprover,
      reversalId: reversalId || null,
    });

    const responsePayload = {
      success: true,
      message: result.alreadyCompleted
        ? `${transactionType} was already reversed`
        : `${transactionType} reversed successfully`,
      reversal: result.reversal,
      taxReversals: result.taxReversals || [],
      originalTransaction: result.originalTransaction,
      register: result.register,
      sod,
    };
    if (result.payrollReversalSummary) {
      responsePayload.payrollReversalSummary = result.payrollReversalSummary;
    }
    return NextResponse.json(responsePayload, {
      status: result.alreadyCompleted ? 200 : 201,
    });
  } catch (error) {
    console.error('Error in POST /api/transactions/reverse:', error);
    const status =
      error.code === 'NOT_ELIGIBLE' ||
      error.code === 'PERIOD_LOCKED' ||
      error.code === 'INVALID_REASON' ||
      error.code === 'ALREADY_REVERSED' ||
      error.code === 'APPROVAL_REQUIRED' ||
      error.code === 'SOD_SAME_ACTOR' ||
      error.code === 'INVALID_STATUS' ||
      error.code === 'UNSUPPORTED_SOURCE_TYPE'
        ? 400
        : error.code === 'NOT_FOUND'
          ? 404
          : 500;
    return NextResponse.json(
      {
        error: error.message || 'Internal server error',
        code: error.code || undefined,
        register: error.register || undefined,
      },
      { status }
    );
  }
}


export { GET, POST };
