import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { listTaxPayments } from '@/lib/taxManagement/taxPaymentRegister';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const payments = await listTaxPayments({
      tenantId: user.tenantId,
      taxPeriodId: searchParams.get('taxPeriodId') || null,
    });
    return NextResponse.json({
      payments,
      settleEndpoint: '/api/tax/settle',
      note: 'Create payments via Tax Settlement (/api/tax/settle); this register lists posted settlements.',
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
