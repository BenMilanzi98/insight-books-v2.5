import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import { ATTENDANCE_APPROVAL } from '@/lib/payrollV2/constants';
import {
  assertAttendanceApprovable,
  syncAttendanceMinutes,
} from '@/lib/payrollV2/attendanceApproval';

export async function POST(request, { params }) {
  try {
    const perm = await requireAnyPermission(request, ['hr.view', 'payroll.update']);
    if (perm) return perm;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const record = await prisma.attendanceRecord.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!record) {
      return NextResponse.json({ error: 'Attendance not found' }, { status: 404 });
    }
    assertAttendanceApprovable(record);

    const minutes = syncAttendanceMinutes(record);
    const approveOt = body.approveOvertime !== false;
    const updated = await prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        approvalStatus: ATTENDANCE_APPROVAL.APPROVED,
        approvedAt: new Date(),
        approvedById: user.id,
        minutesWorked: minutes.minutesWorked,
        overtimeMinutes: minutes.overtimeMinutes,
        ...(approveOt
          ? {
              overtimeApprovalStatus: ATTENDANCE_APPROVAL.APPROVED,
              overtimeApprovedAt: new Date(),
              overtimeApprovedById: user.id,
            }
          : {}),
      },
    });
    return NextResponse.json({ record: updated });
  } catch (e) {
    console.error('attendance approve', e);
    return NextResponse.json({ error: e.message || 'Approve failed' }, { status: 400 });
  }
}
