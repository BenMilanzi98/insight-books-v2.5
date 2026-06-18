import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { fetchPaymentAccountChannels } from '@/lib/paymentAccountChannelsService';
import { PAYMENT_GL_CHANNELS, PAYMENT_CASH_GL_CODE, PAYMENT_CASH_GL_NAME } from '@/lib/paymentGlChannels';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET — Malawi bank/mobile channels with nested payment accounts and rollup balances */
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!user.tenantId) {
      return NextResponse.json({ error: 'No tenant associated with user' }, { status: 400 });
    }

    const data = await fetchPaymentAccountChannels(user.tenantId, prisma);

    return NextResponse.json({
      success: true,
      cash: data.cash,
      channels: data.channels,
      otherAccounts: data.otherAccounts,
      catalog: {
        cash: { code: PAYMENT_CASH_GL_CODE, name: PAYMENT_CASH_GL_NAME },
        banks: PAYMENT_GL_CHANNELS.filter((c) => c.accountType === 'Bank'),
        mobile: PAYMENT_GL_CHANNELS.filter((c) => c.accountType === 'Mobile Money'),
      },
    });
  } catch (error) {
    console.error('Error fetching payment channels:', error);
    return NextResponse.json({ error: 'Failed to fetch payment channels' }, { status: 500 });
  }
}
