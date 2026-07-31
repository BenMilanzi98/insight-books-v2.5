import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import { parseMoney } from '@/lib/money';

export async function GET(request) {
  try {
    const perm = await requireAnyPermission(request, ['hr.view']);
    if (perm) return perm;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const cases = await prisma.disciplinaryCase.findMany({
      where: { tenantId: user.tenantId },
      include: { penalties: true, employee: { select: { id: true, name: true } } },
      orderBy: { openedAt: 'desc' },
      take: 100,
    });
    return NextResponse.json({ cases });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const perm = await requireAnyPermission(request, ['hr.view', 'payroll.update']);
    if (perm) return perm;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    if (!body.employeeId || !body.title) {
      return NextResponse.json({ error: 'employeeId and title required' }, { status: 400 });
    }
    const emp = await prisma.employee.findFirst({
      where: { id: body.employeeId, tenantId: user.tenantId },
    });
    if (!emp) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }
    const disciplinaryCase = await prisma.disciplinaryCase.create({
      data: {
        tenantId: user.tenantId,
        employeeId: body.employeeId,
        title: body.title,
        description: body.description || null,
        status: 'OPEN',
        penalties:
          body.penaltyAmount != null && body.effectivePeriodEnd
            ? {
                create: {
                  tenantId: user.tenantId,
                  amount: parseMoney(body.penaltyAmount),
                  effectivePeriodEnd: new Date(body.effectivePeriodEnd),
                  status: body.approvePenalty ? 'APPROVED' : 'PENDING',
                  approvedAt: body.approvePenalty ? new Date() : null,
                  approvedById: body.approvePenalty ? user.id : null,
                },
              }
            : undefined,
      },
      include: { penalties: true },
    });
    return NextResponse.json({ case: disciplinaryCase }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}
