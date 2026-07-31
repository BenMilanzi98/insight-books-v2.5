import { NextResponse } from 'next/server';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import {
  loadPayrollRun,
  calculatePayrollRun,
  submitPayrollRun,
  approvePayrollRun,
  postPayrollRun,
  payPayrollRun,
  reversePayrollRun,
} from '@/lib/payrollV2/runService';

const ACTIONS = {
  load: loadPayrollRun,
  calculate: calculatePayrollRun,
  submit: submitPayrollRun,
  approve: approvePayrollRun,
  post: postPayrollRun,
  pay: payPayrollRun,
  reverse: reversePayrollRun,
};

export async function POST(request, { params }) {
  try {
    const perm = await requireAnyPermission(request, [
      'payroll.update',
      'payroll.create',
      'payroll.view',
      'hr.view',
    ]);
    if (perm) return perm;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const { id, action } = await params;
    const fn = ACTIONS[String(action || '').toLowerCase()];
    if (!fn) {
      return NextResponse.json(
        {
          error: `Unknown action. Allowed: ${Object.keys(ACTIONS).join(', ')}`,
        },
        { status: 400 }
      );
    }
    const body = await request.json().catch(() => ({}));
    const run = await fn({
      tenantId: user.tenantId,
      runId: id,
      userId: user.id,
      paymentAccountId: body.paymentAccountId,
      paymentDate: body.paymentDate,
      linesBuilder: undefined,
    });
    return NextResponse.json({ run, action });
  } catch (e) {
    console.error('payroll-v2 action', e);
    const status = /not allowed|not found|Cannot/i.test(e.message || '') ? 409 : 500;
    return NextResponse.json(
      { error: e.message || 'Action failed' },
      { status: status === 409 ? 409 : 400 }
    );
  }
}
