import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import { ATTENDANCE_APPROVAL } from '@/lib/payrollV2/constants';
import { syncAttendanceMinutes } from '@/lib/payrollV2/attendanceApproval';

export async function POST(request) {
  try {
    const perm = await requireAnyPermission(request, ['hr.view', 'payroll.update']);
    if (perm) return perm;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body.ids) ? body.ids : [];
    const dateFrom = body.dateFrom ? new Date(body.dateFrom) : null;
    const dateTo = body.dateTo ? new Date(body.dateTo) : null;

    const where = {
      tenantId: user.tenantId,
      payrollLocked: false,
      approvalStatus: { not: ATTENDANCE_APPROVAL.APPROVED },
      ...(ids.length ? { id: { in: ids } } : {}),
      ...(dateFrom && dateTo ? { date: { gte: dateFrom, lte: dateTo } } : {}),
    };

    const records = await prisma.attendanceRecord.findMany({ where, take: 2000 });
    let updated = 0;
    for (const r of records) {
      const minutes = syncAttendanceMinutes(r);
      await prisma.attendanceRecord.update({
        where: { id: r.id },
        data: {
          approvalStatus: ATTENDANCE_APPROVAL.APPROVED,
          approvedAt: new Date(),
          approvedById: user.id,
          minutesWorked: minutes.minutesWorked,
          overtimeMinutes: minutes.overtimeMinutes,
          overtimeApprovalStatus: ATTENDANCE_APPROVAL.APPROVED,
          overtimeApprovedAt: new Date(),
          overtimeApprovedById: user.id,
        },
      });
      updated += 1;
    }
    return NextResponse.json({ updated });
  } catch (e) {
    console.error('attendance approve-bulk', e);
    return NextResponse.json({ error: e.message || 'Bulk approve failed' }, { status: 500 });
  }
}
