import { NextResponse } from 'next/server';
import { getUserFromSession, hasPermission } from '@/lib/auth';
import { fetchPaymentAccountActivity } from '@/lib/paymentAccountActivityService';

export const dynamic = 'force-dynamic';

/**
 * GET — all activity for this payment account (payments, POS deposits, journal lines on linked CoA).
 */
export async function GET(request, context) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (!hasPermission(user, 'payments.view')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { id: accountId } = await context.params;
    if (!accountId) {
      return NextResponse.json({ error: 'Account id required' }, { status: 400 });
    }

    const result = await fetchPaymentAccountActivity(user.tenantId, accountId);
    if (!result) {
      return NextResponse.json({ error: 'Payment account not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      account: result.account,
      transactions: result.transactions,
    });
  } catch (e) {
    console.error('payment-accounts/[id]/transactions', e);
    return NextResponse.json(
      { error: e?.message || 'Failed to load transactions' },
      { status: 500 }
    );
  }
}
