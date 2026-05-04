// app/api/leave/[id]/approve/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requirePermission } from '@/lib/auth';
import { isLeaveStatus, normalizeLeaveStatus } from '@/lib/hrCalculations';

export async function PUT(request, { params }) {
  try {
    const permissionCheck = await requirePermission(request, 'leave.approve');
    if (permissionCheck) return permissionCheck;

    const user = await getUserFromSession(request);
    const { id } = await params;

    const existingRequest = await prisma.leaveRequest.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { employee: { select: { name: true } }, leavePolicy: { select: { leaveType: true } } },
    });

    if (!existingRequest) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
    }
    if (!isLeaveStatus(existingRequest.status, 'pending')) {
      return NextResponse.json(
        { error: `Cannot approve a leave request that is already ${normalizeLeaveStatus(existingRequest.status)}` },
        { status: 400 },
      );
    }

    const updatedRequest = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: normalizeLeaveStatus('approved'),
        reviewedBy: user.id,
        reviewedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'LEAVE_REQUEST_APPROVED',
        entityType: 'LEAVE_REQUEST',
        entityId: id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          employeeName: existingRequest.employee.name,
          leaveType: existingRequest.leavePolicy?.leaveType,
          startDate: existingRequest.startDate.toISOString(),
          endDate: existingRequest.endDate.toISOString(),
          totalDays: existingRequest.totalDays,
        }),
      },
    });

    return NextResponse.json({
      message: 'Leave request approved successfully',
      leaveRequest: updatedRequest,
    });
  } catch (error) {
    console.error('Error approving leave request:', error);
    return NextResponse.json(
      { error: 'Failed to approve leave request. Please try again.', details: error.message },
      { status: 500 },
    );
  }
}
