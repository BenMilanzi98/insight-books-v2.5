import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { hasEISAccess, canSubmitEISInvoice } from '@/lib/subscriptionService';
import eisService from '@/lib/eisService';

export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const hasEIS = await hasEISAccess(user.tenantId);
    if (!hasEIS) {
      return NextResponse.json(
        { error: 'EIS subscription required', code: 'EIS_SUBSCRIPTION_REQUIRED' },
        { status: 403 }
      );
    }

    const quotaCheck = await canSubmitEISInvoice(user.tenantId);
    if (!quotaCheck.canSubmit) {
      return NextResponse.json(
        { error: quotaCheck.reason, code: 'EIS_QUOTA_EXCEEDED', quota: quotaCheck },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { invoiceData, sourceType, sourceId } = body;

    if (!invoiceData) {
      return NextResponse.json({ error: 'invoiceData is required' }, { status: 400 });
    }

    const result = await eisService.submitInvoice(
      user.tenantId,
      invoiceData,
      sourceType || null,
      sourceId || null
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('POST /api/eis/invoices/submit error:', error);
    return NextResponse.json(
      { error: error.message, code: 'EIS_SUBMISSION_ERROR' },
      { status: 500 }
    );
  }
}
