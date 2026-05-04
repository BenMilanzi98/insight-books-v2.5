// app/api/leave/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requirePermission } from '@/lib/auth';
import { parseDateInputForMonthNormalization } from '@/lib/dateUtils';
import {
  calculateLeaveDays,
  getActiveLeaveStatusVariants,
  isLeaveStatus,
  normalizeLeaveStatus,
} from '@/lib/hrCalculations';

function formatLeaveRequest(request) {
  return {
    id: request.id,
    employee: {
      id: request.employee.id,
      name: request.employee.name,
      email: request.employee.email,
      department: request.employee.department,
      position: request.employee.position || request.employee.jobTitle,
      startDate: request.employee.startDate?.toISOString?.() || null,
    },
    type: request.leavePolicy?.leaveType || request.leavePolicy?.name || 'Leave',
    leavePolicyId: request.leavePolicyId,
    startDate: request.startDate.toISOString(),
    endDate: request.endDate.toISOString(),
    duration: request.totalDays,
    status: normalizeLeaveStatus(request.status),
    requestDate: request.createdAt.toISOString(),
    notes: request.reason,
    approval: request.reviewer
      ? {
          approvedBy: {
            id: request.reviewer.id,
            name: request.reviewer.name,
            email: request.reviewer.email,
          },
          approvedAt: request.reviewedAt?.toISOString() || null,
          comments: request.reviewComments,
        }
      : null,
  };
}

async function getRequestForTenant(id, tenantId, include = {}) {
  return prisma.leaveRequest.findFirst({
    where: { id, tenantId },
    include,
  });
}

export async function GET(request, { params }) {
  try {
    const permissionCheck = await requirePermission(request, 'leave.view');
    if (permissionCheck) return permissionCheck;

    const user = await getUserFromSession(request);
    const { id } = await params;

    const leaveRequest = await getRequestForTenant(id, user.tenantId, {
      employee: {
        select: {
          id: true,
          name: true,
          email: true,
          department: true,
          position: true,
          jobTitle: true,
          startDate: true,
        },
      },
      leavePolicy: {
        select: { id: true, name: true, leaveType: true },
      },
      reviewer: {
        select: { id: true, name: true, email: true },
      },
    });

    if (!leaveRequest) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
    }

    return NextResponse.json(formatLeaveRequest(leaveRequest));
  } catch (error) {
    console.error('Error fetching leave request:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leave request. Please try again.', details: error.message },
      { status: 500 },
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const permissionCheck = await requirePermission(request, 'leave.update');
    if (permissionCheck) return permissionCheck;

    const user = await getUserFromSession(request);
    const { id } = await params;
    const body = await request.json();

    const existingRequest = await getRequestForTenant(id, user.tenantId, {
      leavePolicy: { select: { id: true, leaveType: true } },
    });
    if (!existingRequest) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
    }

    if (!isLeaveStatus(existingRequest.status, 'pending') && !body.status) {
      return NextResponse.json(
        { error: 'Cannot update a leave request that has already been processed' },
        { status: 400 },
      );
    }

    const updateData = {};
    const startDate = body.startDate
      ? parseDateInputForMonthNormalization(body.startDate)
      : existingRequest.startDate;
    const endDate = body.endDate
      ? parseDateInputForMonthNormalization(body.endDate)
      : existingRequest.endDate;

    if (body.startDate || body.endDate) {
      let totalDays;
      try {
        totalDays = calculateLeaveDays(startDate, endDate);
      } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      const overlappingRequest = await prisma.leaveRequest.findFirst({
        where: {
          employeeId: existingRequest.employeeId,
          tenantId: user.tenantId,
          status: { in: getActiveLeaveStatusVariants() },
          id: { not: id },
          OR: [{ AND: [{ startDate: { lte: endDate } }, { endDate: { gte: startDate } }] }],
        },
      });

      if (overlappingRequest) {
        return NextResponse.json(
          { error: 'There is an overlapping leave request for this period' },
          { status: 400 },
        );
      }

      updateData.startDate = startDate;
      updateData.endDate = endDate;
      updateData.totalDays = totalDays;
    }

    if (body.leavePolicyId) {
      const policy = await prisma.leavePolicy.findFirst({
        where: { id: body.leavePolicyId, tenantId: user.tenantId, isActive: true },
      });
      if (!policy) {
        return NextResponse.json({ error: 'Leave policy not found or inactive' }, { status: 404 });
      }
      updateData.leavePolicyId = policy.id;
    }
    if (body.notes !== undefined || body.reason !== undefined) {
      updateData.reason = body.notes ?? body.reason ?? null;
    }
    if (body.status !== undefined) {
      updateData.status = normalizeLeaveStatus(body.status);
    }

    const updatedRequest = await prisma.leaveRequest.update({
      where: { id },
      data: updateData,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            position: true,
            jobTitle: true,
            startDate: true,
          },
        },
        leavePolicy: {
          select: { id: true, name: true, leaveType: true },
        },
        reviewer: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'LEAVE_REQUEST_UPDATED',
        entityType: 'LEAVE_REQUEST',
        entityId: id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          leavePolicyId: updatedRequest.leavePolicyId,
          startDate: updatedRequest.startDate.toISOString(),
          endDate: updatedRequest.endDate.toISOString(),
          totalDays: updatedRequest.totalDays,
        }),
      },
    });

    return NextResponse.json({
      message: 'Leave request updated successfully',
      leaveRequest: formatLeaveRequest(updatedRequest),
    });
  } catch (error) {
    console.error('Error updating leave request:', error);
    return NextResponse.json(
      { error: 'Failed to update leave request. Please try again.', details: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const permissionCheck = await requirePermission(request, 'leave.delete');
    if (permissionCheck) return permissionCheck;

    const user = await getUserFromSession(request);
    const { id } = await params;

    const existingRequest = await getRequestForTenant(id, user.tenantId);
    if (!existingRequest) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
    }

    if (isLeaveStatus(existingRequest.status, 'approved') && existingRequest.startDate <= new Date()) {
      return NextResponse.json(
        { error: 'Cannot cancel a leave that has already started' },
        { status: 400 },
      );
    }

    await prisma.leaveRequest.update({
      where: { id },
      data: { status: normalizeLeaveStatus('cancelled') },
    });

    await prisma.auditLog.create({
      data: {
        action: 'LEAVE_REQUEST_CANCELLED',
        entityType: 'LEAVE_REQUEST',
        entityId: id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          leavePolicyId: existingRequest.leavePolicyId,
          startDate: existingRequest.startDate.toISOString(),
          endDate: existingRequest.endDate.toISOString(),
          totalDays: existingRequest.totalDays,
        }),
      },
    });

    return NextResponse.json({ message: 'Leave request cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling leave request:', error);
    return NextResponse.json(
      { error: 'Failed to cancel leave request. Please try again.', details: error.message },
      { status: 500 },
    );
  }
}
