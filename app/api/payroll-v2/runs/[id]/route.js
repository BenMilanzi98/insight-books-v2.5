import { NextResponse } from 'next/server';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getPayrollRun } from '@/lib/payrollV2/runService';

export async function GET(request, { params }) {
  try {
    const perm = await requireAnyPermission(request, ['payroll.view', 'hr.view']);
    if (perm) return perm;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const { id } = await params;
    const run = await getPayrollRun({ tenantId: user.tenantId, runId: id });
    if (!run) {
      return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });
    }
    return NextResponse.json({ run });
  } catch (e) {
    console.error('payroll-v2 get run', e);
    return NextResponse.json({ error: e.message || 'Failed to load run' }, { status: 500 });
  }
}

/** PATCH — update mappingSnapshot / notes while DRAFT|LOADED|CALCULATED */
export async function PATCH(request, { params }) {
  try {
    const perm = await requireAnyPermission(request, [
      'payroll.update',
      'payroll.view',
      'hr.view',
    ]);
    if (perm) return perm;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const existing = await prisma.payrollRun.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });
    }
    if (['POSTED', 'PAID', 'REVERSED'].includes(existing.status)) {
      return NextResponse.json(
        { error: 'Cannot edit a posted/paid/reversed run' },
        { status: 409 }
      );
    }
    const run = await prisma.payrollRun.update({
      where: { id: existing.id },
      data: {
        ...(body.mappingSnapshot != null
          ? { mappingSnapshot: body.mappingSnapshot }
          : {}),
        ...(body.notes != null ? { notes: body.notes } : {}),
      },
    });
    return NextResponse.json({ run });
  } catch (e) {
    console.error('payroll-v2 patch run', e);
    return NextResponse.json({ error: e.message || 'Failed to update run' }, { status: 500 });
  }
}
