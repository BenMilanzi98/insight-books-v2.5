import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import {
  assertPayrollStatusTransition,
  resolveStatusCommand,
} from '@/lib/payrollStatus';

/**
 * PATCH — controlled status commands only (markDraft / reopenDraft).
 * Cannot set Processed / Posted / Paid / Reversed here.
 */
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
    const requestedStatus = body.status;
    const command = body.command || resolveStatusCommand(requestedStatus);

    if (!command) {
      return NextResponse.json(
        {
          error:
            'Invalid status command. Allowed: markDraft (→ Draft) or reopenDraft (→ Pending). Processed/Posted/Paid/Reversed require process, post, pay, or reverse endpoints.',
        },
        { status: 400 }
      );
    }

    const existing = await prisma.payroll.findFirst({
      where: { id, tenantId: user.tenantId },
      select: { id: true, status: true, tenantId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Payroll not found' }, { status: 404 });
    }

    const nextStatus =
      command === 'markDraft' ? 'Draft' : command === 'reopenDraft' ? 'Pending' : null;

    try {
      assertPayrollStatusTransition({
        from: existing.status,
        to: nextStatus,
        command,
      });
    } catch (e) {
      return NextResponse.json({ error: e.message || 'Invalid transition' }, { status: 409 });
    }

    const payroll = await prisma.payroll.update({
      where: { id: existing.id },
      data: { status: nextStatus },
    });

    return NextResponse.json({ payroll, command });
  } catch (error) {
    console.error('Error updating payroll status:', error);
    return NextResponse.json(
      { error: 'Failed to update payroll status' },
      { status: 500 }
    );
  }
}
