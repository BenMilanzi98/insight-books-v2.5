import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { voidInvoice } from '@/lib/invoices/voidInvoice';

export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { invoiceId, reason } = body;

    const result = await voidInvoice({
      user,
      invoiceId,
      reason,
      ipAddress:
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      message: 'Invoice voided successfully',
      invoice: {
        id: result.id,
        invoiceNumber: result.invoiceNumber,
        status: result.status,
        voidedAt: result.voidedAt,
        voidReason: result.voidReason
      }
    });

  } catch (error) {
    if (error?.name === 'ServiceHttpError') {
      return NextResponse.json(error.body, { status: error.status });
    }

    console.error('Error voiding invoice:', error);

    if (error.code === 'PERIOD_LOCKED') {
      const base = error.message || `Cannot void in closed accounting period: ${error.period?.periodName || 'unknown'}.`;
      const message = base.includes('Reopen') ? base : `${base} Reopen the period in Accounting Periods to void this invoice.`;
      return NextResponse.json(
        {
          success: false,
          error: message,
          details: { code: 'PERIOD_LOCKED', periodName: error.period?.periodName },
        },
        { status: 403 }
      );
    }

    if (error.code === 'NO_V2_JOURNAL_TO_REVERSE') {
      return NextResponse.json(
        {
          success: false,
          error: error.message || 'No posted V2 journal found to reverse for this invoice.',
          details: { code: 'NO_V2_JOURNAL_TO_REVERSE', ...(error.details || {}) },
        },
        { status: 409 }
      );
    }

    if (error.code === 'ALREADY_REVERSED' || error.name === 'SourceAlreadyPostedError') {
      return NextResponse.json(
        { success: false, error: error.message || 'Invoice journals have already been reversed.' },
        { status: 409 }
      );
    }

    if (error.code === 'APPROVAL_REQUIRED' || error.name === 'ApprovalRequiredError') {
      return NextResponse.json(
        {
          success: false,
          error: error.message || 'Invoice void requires approval.',
          details: { code: 'APPROVAL_REQUIRED' },
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to void invoice. Please try again.' },
      { status: 500 }
    );
  }
}
