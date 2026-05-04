// app/api/leave/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requirePermission } from '@/lib/auth';
import { parseDateInputForMonthNormalization } from '@/lib/dateUtils';
import {
  calculateLeaveDays,
  getActiveLeaveStatusVariants,
  getLeaveStatusVariants,
  normalizeLeaveStatus,
} from '@/lib/hrCalculations';

function formatLeaveRequest(request) {
  return {
    id: request.id,
    employee: request.employee?.name || 'Unknown',
    employeeId: request.employee?.id || request.employeeId,
    department: request.employee?.department || null,
    position: request.employee?.position || request.employee?.jobTitle || null,
    type: request.leavePolicy?.leaveType || request.leavePolicy?.name || 'Leave',
    leavePolicyId: request.leavePolicyId,
    startDate: request.startDate.toISOString(),
    endDate: request.endDate.toISOString(),
    duration: request.totalDays,
    status: normalizeLeaveStatus(request.status),
    requestDate: request.createdAt.toISOString(),
    notes: request.reason,
    approvedBy: request.reviewer?.name || null,
    approvedAt: request.reviewedAt?.toISOString() || null,
  };
}

async function resolveLeavePolicy({ tenantId, leavePolicyId, type }) {
  if (leavePolicyId) {
    return prisma.leavePolicy.findFirst({
      where: { id: leavePolicyId, tenantId, isActive: true },
    });
  }

  if (!type) return null;
  return prisma.leavePolicy.findFirst({
    where: {
      tenantId,
      isActive: true,
      OR: [
        { leaveType: { equals: type, mode: 'insensitive' } },
        { name: { equals: type, mode: 'insensitive' } },
      ],
    },
  });
}

export async function GET(request) {
  try {
    const permissionCheck = await requirePermission(request, 'leave.view');
    if (permissionCheck) return permissionCheck;

    const user = await getUserFromSession(request);
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;
    const status = searchParams.get('status');
    const employeeId = searchParams.get('employeeId');
    const type = searchParams.get('type');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const skip = (page - 1) * limit;

    const where = { tenantId: user.tenantId };
    if (status && status !== 'All') {
      where.status = { in: getLeaveStatusVariants(status) };
    }
    if (employeeId) {
      where.employeeId = employeeId;
    }
    if (type && type !== 'All') {
      where.leavePolicy = {
        OR: [
          { leaveType: { equals: type, mode: 'insensitive' } },
          { name: { equals: type, mode: 'insensitive' } },
        ],
      };
    }
    if (from) {
      where.startDate = { ...(where.startDate || {}), gte: parseDateInputForMonthNormalization(from) };
    }
    if (to) {
      where.endDate = { ...(where.endDate || {}), lte: parseDateInputForMonthNormalization(to) };
    }

    const [totalCount, leaveRequests] = await Promise.all([
      prisma.leaveRequest.count({ where }),
      prisma.leaveRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          employee: {
            select: { id: true, name: true, department: true, position: true, jobTitle: true },
          },
          leavePolicy: {
            select: { id: true, name: true, leaveType: true },
          },
          reviewer: {
            select: { id: true, name: true },
          },
        },
      }),
    ]);

    return NextResponse.json({
      leaveRequests: leaveRequests.map(formatLeaveRequest),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching leave requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leave requests. Please try again.', details: error.message },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const permissionCheck = await requirePermission(request, 'leave.create');
    if (permissionCheck) return permissionCheck;

    const user = await getUserFromSession(request);
    const body = await request.json();

    if (!body.employeeId || !(body.leavePolicyId || body.type) || !body.startDate || !body.endDate) {
      return NextResponse.json(
        { error: 'Employee ID, leave type/policy, start date, and end date are required' },
        { status: 400 },
      );
    }

    const startDate = parseDateInputForMonthNormalization(body.startDate);
    const endDate = parseDateInputForMonthNormalization(body.endDate);
    let totalDays;
    try {
      totalDays = calculateLeaveDays(startDate, endDate);
    } catch (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const [employee, leavePolicy] = await Promise.all([
      prisma.employee.findFirst({
        where: { id: body.employeeId, tenantId: user.tenantId, isActive: true },
      }),
      resolveLeavePolicy({
        tenantId: user.tenantId,
        leavePolicyId: body.leavePolicyId,
        type: body.type,
      }),
    ]);

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found or inactive' }, { status: 404 });
    }
    if (!leavePolicy) {
      return NextResponse.json({ error: 'Leave policy not found or inactive' }, { status: 404 });
    }

    const overlappingRequest = await prisma.leaveRequest.findFirst({
      where: {
        employeeId: body.employeeId,
        tenantId: user.tenantId,
        status: { in: getActiveLeaveStatusVariants() },
        OR: [{ AND: [{ startDate: { lte: endDate } }, { endDate: { gte: startDate } }] }],
      },
    });

    if (overlappingRequest) {
      return NextResponse.json(
        { error: 'There is an overlapping leave request for this period' },
        { status: 400 },
      );
    }

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employeeId: body.employeeId,
        leavePolicyId: leavePolicy.id,
        startDate,
        endDate,
        totalDays,
        reason: body.notes || body.reason || null,
        documentation: body.documentation || null,
        status: normalizeLeaveStatus('pending'),
        tenantId: user.tenantId,
      },
      include: {
        employee: {
          select: { id: true, name: true, department: true, position: true, jobTitle: true },
        },
        leavePolicy: {
          select: { id: true, name: true, leaveType: true },
        },
        reviewer: {
          select: { id: true, name: true },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'LEAVE_REQUEST_CREATED',
        entityType: 'LEAVE_REQUEST',
        entityId: leaveRequest.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          employeeId: body.employeeId,
          employeeName: employee.name,
          leavePolicyId: leavePolicy.id,
          leaveType: leavePolicy.leaveType,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          totalDays,
        }),
      },
    });

    return NextResponse.json(
      {
        message: 'Leave request created successfully',
        leaveRequest: formatLeaveRequest(leaveRequest),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error creating leave request:', error);
    return NextResponse.json(
      { error: 'Failed to create leave request. Please try again.', details: error.message },
      { status: 500 },
    );
  }
}
