import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { runTaxReconciliationSuite } from '@/lib/taxManagement/reconciliationEngine';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const end = searchParams.get('endDate') || new Date().toISOString().slice(0, 10);
    const startDefault = new Date();
    startDefault.setDate(1);
    const start = searchParams.get('startDate') || startDefault.toISOString().slice(0, 10);
    const returnId = searchParams.get('returnId') || null;

    const suite = await runTaxReconciliationSuite({
      tenantId: user.tenantId,
      startDate: start,
      endDate: end,
      returnId,
    });

    return NextResponse.json(suite);
  } catch (error) {
    const status = error.code === 'NOT_FOUND' ? 404 : 500;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }
}
