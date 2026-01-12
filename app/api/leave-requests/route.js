// app/api/leave-requests/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

/**
 * GET - List leave requests with filters and pagination
 */
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 20;
    const status = searchParams.get('status');
    const employeeId = searchParams.get('employeeId');
    const leaveType = searchParams.get('leaveType');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    const skip = (page - 1) * limit;

    const where = {
      tenantId: user.tenantId
    };

    if (status && status !== 'All') {
      where.status = status;
    }

    if (employeeId) {
      where.employeeId = employeeId;
    }

    if (leaveType && leaveType !== 'All') {
      where.leavePolicy = {
        leaveType: leaveType
      };
    }

    if (fromDate || toDate) {
      where.startDate = {};
      if (fromDate) where.startDate.gte = new Date(fromDate);
      if (toDate) where.startDate.lte = new Date(toDate);
    }

    const [totalCount, requests] = await Promise.all([
      prisma.leaveRequest.count({ where }),
      prisma.leaveRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          employee: { 
            select: { 
              id: true, 
              name: true, 
              employeeId: true, 
              department: true,
              jobTitle: true
            } 
          },
          leavePolicy: { 
            select: { 
              id: true, 
              name: true, 
              leaveType: true,
              maxDaysPerYear: true
            } 
          }
        }
      })
    ]);

    return NextResponse.json({
      requests,
      pagination: { 
        page, 
        limit, 
        totalCount, 
        totalPages: Math.ceil(totalCount / limit) 
      }
    });

  } catch (error) {
    console.error('Error fetching leave requests:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error code:', error.code);
    return NextResponse.json(
      { 
        error: 'Failed to fetch leave requests', 
        details: error.message,
        code: error.code,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Create a new leave request
 */
export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const data = await request.json();

    // Validate required fields
    if (!data.employeeId || !data.leavePolicyId || !data.startDate || !data.endDate) {
      return NextResponse.json(
        { error: 'Employee ID, leave policy ID, start date, and end date are required' },
        { status: 400 }
      );
    }

    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    // Validate dates
    if (startDate >= endDate) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      );
    }

    if (startDate < new Date()) {
      return NextResponse.json(
        { error: 'Cannot request leave for past dates' },
        { status: 400 }
      );
    }

    // Calculate total days
    const timeDiff = endDate.getTime() - startDate.getTime();
    const totalDays = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 to include both start and end dates

    // Check if employee exists and belongs to tenant
    const employee = await prisma.employee.findFirst({
      where: {
        id: data.employeeId,
        tenantId: user.tenantId,
        isActive: true
      }
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found or inactive' },
        { status: 404 }
      );
    }

    // Check if leave policy exists and belongs to tenant
    const leavePolicy = await prisma.leavePolicy.findFirst({
      where: {
        id: data.leavePolicyId,
        tenantId: user.tenantId,
        isActive: true
      }
    });

    if (!leavePolicy) {
      return NextResponse.json(
        { error: 'Leave policy not found or inactive' },
        { status: 404 }
      );
    }

    // Validate leave policy constraints
    if (leavePolicy.maxDaysPerRequest && totalDays > leavePolicy.maxDaysPerRequest) {
      return NextResponse.json(
        { error: `Maximum ${leavePolicy.maxDaysPerRequest} days allowed per request for this leave type` },
        { status: 400 }
      );
    }

    if (leavePolicy.minDaysPerRequest && totalDays < leavePolicy.minDaysPerRequest) {
      return NextResponse.json(
        { error: `Minimum ${leavePolicy.minDaysPerRequest} days required per request for this leave type` },
        { status: 400 }
      );
    }

    // Check for overlapping leave requests
    const overlappingRequest = await prisma.leaveRequest.findFirst({
      where: {
        employeeId: data.employeeId,
        tenantId: user.tenantId,
        status: { in: ['pending', 'approved'] },
        OR: [
          {
            AND: [
              { startDate: { lte: endDate } },
              { endDate: { gte: startDate } }
            ]
          }
        ]
      }
    });

    if (overlappingRequest) {
      return NextResponse.json(
        { error: 'Overlapping leave request exists for this period' },
        { status: 400 }
      );
    }

    // Create leave request
    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employeeId: data.employeeId,
        leavePolicyId: data.leavePolicyId,
        startDate: startDate,
        endDate: endDate,
        totalDays: totalDays,
        reason: data.reason || null,
        documentation: data.documentation || null,
        status: 'pending',
        tenantId: user.tenantId
      },
      include: {
        employee: { 
          select: { 
            id: true, 
            name: true, 
            employeeId: true, 
            department: true,
            jobTitle: true
          } 
        },
        leavePolicy: { 
          select: { 
            id: true, 
            name: true, 
            leaveType: true 
          } 
        }
      }
    });

    return NextResponse.json({
      message: 'Leave request created successfully',
      request: leaveRequest
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating leave request:', error);
    return NextResponse.json(
      { error: 'Failed to create leave request', details: error.message },
      { status: 500 }
    );
  }
}