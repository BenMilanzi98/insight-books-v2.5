/**
 * Transaction Reversal API Routes
 * 
 * API endpoints for managing transaction reversals.
 * All endpoints follow accounting-safe practices with:
 * - Mandatory reversal reason
 * - Eligibility validation
 * - Audit trail preservation
 */

import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import {
  validateReversalEligibility,
  validateReversalReason,
  checkAccountingPeriodLock,
  createTransactionReversal,
  createInvoiceReversal,
  createExpenseReversal,
  createPaymentReversal,
  createSaleReversal,
  createSupplierPaymentReversal,
  getReversalDetails,
  listReversibleTransactions,
  calculateReversalImpact
} from '@/lib/transactionReversalService';

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
 * Get reversal details or list reversible transactions
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
    const userId = user.id;

    if (action === 'details') {
      // Get reversal details for a specific transaction
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
          tenantId
        });

        return NextResponse.json(details);
      } catch (error) {
        console.error('Error in getReversalDetails:', error);
        return NextResponse.json(
          { 
            error: error.message || 'Failed to get reversal details',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
          },
          { status: 500 }
        );
      }
    }

    if (action === 'impact') {
      // Calculate reversal impact for preview
      const transactionId = searchParams.get('transactionId');
      const transactionType = normalizeTransactionType(searchParams.get('transactionType'));

      if (!transactionId || !transactionType) {
        return NextResponse.json(
          { error: 'transactionId and transactionType are required' },
          { status: 400 }
        );
      }

      try {
        const impact = await calculateReversalImpact({
          transactionId,
          transactionType,
          tenantId
        });

        return NextResponse.json(impact);
      } catch (error) {
        console.error('Error in calculateReversalImpact:', error);
        console.error('Error stack:', error.stack);
        return NextResponse.json(
          { 
            error: error.message || 'Failed to calculate reversal impact',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
          },
          { status: 500 }
        );
      }
    }

    // List reversible transactions
    const transactionType = normalizeTransactionType(searchParams.get('transactionType'));
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const result = await listReversibleTransactions({
      tenantId,
      transactionType: transactionType || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page,
      limit
    });

    return NextResponse.json(result);
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
 * Create a new transaction reversal
 */
async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      transactionId,
      reversalReason
    } = body;
    const transactionType = normalizeTransactionType(body.transactionType);

    const tenantId = user.tenantId;
    const userId = user.id;

    // Validate required fields
    if (!transactionId || !transactionType) {
      return NextResponse.json(
        { error: 'transactionId and transactionType are required' },
        { status: 400 }
      );
    }

    // Validate reversal reason
    const reasonValidation = validateReversalReason(reversalReason);
    if (!reasonValidation.isValid) {
      return NextResponse.json(
        { error: reasonValidation.error },
        { status: 400 }
      );
    }

    // Validate eligibility before proceeding
    const eligibility = await validateReversalEligibility({
      transactionId,
      transactionType,
      tenantId
    });

    if (!eligibility.isValid) {
      return NextResponse.json(
        { error: eligibility.error },
        { status: 400 }
      );
    }

    // Check accounting period lock
    const transaction = eligibility.transaction;
    const periodCheck = await checkAccountingPeriodLock(tenantId, transaction.date || transaction.issueDate || transaction.paymentDate);
    
    if (periodCheck.isLocked) {
      return NextResponse.json(
        { error: periodCheck.error },
        { status: 400 }
      );
    }

    // Create reversal based on transaction type
    let result;

    switch (transactionType) {
      case 'Transaction':
        result = await createTransactionReversal({
          transactionId,
          reversalReason: reasonValidation.reason,
          userId,
          tenantId
        });
        break;

      case 'Invoice':
        result = await createInvoiceReversal({
          invoiceId: transactionId,
          reversalReason: reasonValidation.reason,
          userId,
          tenantId
        });
        break;

      case 'Expense':
        result = await createExpenseReversal({
          expenseId: transactionId,
          reversalReason: reasonValidation.reason,
          userId,
          tenantId
        });
        break;

      case 'Payment':
        result = await createPaymentReversal({
          paymentId: transactionId,
          reversalReason: reasonValidation.reason,
          userId,
          tenantId
        });
        break;

      case 'Sale':
        result = await createSaleReversal({
          saleId: transactionId,
          reversalReason: reasonValidation.reason,
          userId,
          tenantId
        });
        break;

      case 'SupplierPayment':
        result = await createSupplierPaymentReversal({
          supplierPaymentId: transactionId,
          reversalReason: reasonValidation.reason,
          userId,
          tenantId
        });
        break;

      default:
        return NextResponse.json(
          { error: `Unknown transaction type: ${transactionType}` },
          { status: 400 }
        );
    }

    // Handle different return structures from reversal functions
    // Some return { reversal, taxReversals, payrollReversalSummary }, others return just the reversal object
    const reversalData = result.reversal || result;
    const taxReversals = result.taxReversals || [];
    const payrollReversalSummary = result.payrollReversalSummary || null;
    
    const responsePayload = {
      success: true,
      message: `${transactionType} reversed successfully`,
      reversal: reversalData,
      taxReversals,
      originalTransaction: transaction
    };
    if (payrollReversalSummary) {
      responsePayload.payrollReversalSummary = payrollReversalSummary;
    }
    return NextResponse.json(responsePayload, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/transactions/reverse:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export { GET, POST };
