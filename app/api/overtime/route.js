import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';

export async function GET(request) {
  try {
    const perm = await requireAnyPermission(request, ['hr.view', 'payroll.view']);
    if (perm) return perm;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const rows = await prisma.overtimeRequest.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { workDate: 'desc' },
      take: 100,
      include: { employee: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ requests: rows });
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
    if (!body.employeeId || !body.workDate || body.overtimeMinutes == null) {
      return NextResponse.json(
        { error: 'employeeId, workDate, overtimeMinutes required' },
        { status: 400 }
      );
    }
    const emp = await prisma.employee.findFirst({
      where: { id: body.employeeId, tenantId: user.tenantId },
    });
    if (!emp) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }
    const row = await prisma.overtimeRequest.create({
      data: {
        tenantId: user.tenantId,
        employeeId: body.employeeId,
        workDate: new Date(body.workDate),
        overtimeMinutes: Number(body.overtimeMinutes),
        reason: body.reason || null,
        status: body.approve ? 'APPROVED' : 'PENDING',
        reviewedAt: body.approve ? new Date() : null,
        reviewedById: body.approve ? user.id : null,
      },
    });

    if (body.approve) {
      // Mirror onto attendance record OT approval when present
      const day = new Date(body.workDate);
      day.setHours(0, 0, 0, 0);
      const end = new Date(day);
      end.setHours(23, 59, 59, 999);
      const att = await prisma.attendanceRecord.findFirst({
        where: {
          tenantId: user.tenantId,
          employeeId: body.employeeId,
          date: { gte: day, lte: end },
        },
      });
      if (att) {
        await prisma.attendanceRecord.update({
          where: { id: att.id },
          data: {
            overtimeMinutes: Number(body.overtimeMinutes),
            overtimeHours: Number(body.overtimeMinutes) / 60,
            overtimeApprovalStatus: 'APPROVED',
            overtimeApprovedAt: new Date(),
            overtimeApprovedById: user.id,
          },
        });
      }
    }

    return NextResponse.json({ request: row }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}
