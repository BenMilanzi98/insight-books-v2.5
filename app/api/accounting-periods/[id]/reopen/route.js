import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { canManageAccountingPeriods } from '@/lib/accountingPeriodAccess';

export async function POST(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated with this user' },
        { status: 401 }
      );
    }

    if (!canManageAccountingPeriods(user)) {
      return NextResponse.json(
        { error: 'Access denied. Finance or Admin role required.' },
        { status: 403 }
      );
    }

    const resolvedParams = typeof params.then === 'function' ? await params : params;
    const periodId = resolvedParams?.id;
    if (!periodId) {
      return NextResponse.json({ error: 'Invalid period ID' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const reason = body.reason?.toString().trim();
    if (!reason) {
      return NextResponse.json(
        { error: 'A reason is required to reopen an accounting period.' },
        { status: 400 }
      );
    }

    const period = await prisma.accountingPeriod.findFirst({
      where: { id: periodId, tenantId: user.tenantId },
    });

    if (!period) {
      return NextResponse.json({ error: 'Accounting period not found' }, { status: 404 });
    }

    if (period.status !== 'closed') {
      return NextResponse.json({ error: 'Only closed periods can be reopened.' }, { status: 400 });
    }

    const reopenedPeriod = await prisma.$transaction(async (tx) => {
      const updated = await tx.accountingPeriod.update({
        where: { id: period.id },
        data: {
          status: 'open',
          reopenedAt: new Date(),
          reopenedById: user.id,
          reopenReason: reason,
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'ACCOUNTING_PERIOD_REOPENED',
          entityType: 'AccountingPeriod',
          entityId: period.id,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            periodName: period.name,
            reason,
          }),
        },
      });

      return updated;
    });

    return NextResponse.json({
      message: 'Accounting period reopened successfully.',
      period: reopenedPeriod,
    });
  } catch (error) {
    console.error('Error reopening accounting period:', error);
    return NextResponse.json(
      { error: 'Failed to reopen accounting period', details: error.message },
      { status: 500 }
    );
  }
}
