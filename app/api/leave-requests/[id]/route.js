// app/api/leave-requests/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

/**
 * GET - Fetch a specific leave request
 */
export async function GET(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const leaveRequest = await prisma.leaveRequest.findFirst({
      where: {
        id,
        tenantId: user.tenantId
      },
      include: {
        employee: { 
          select: { 
            id: true, 
            name: true, 
            employeeId: true, 
            department: true,
            jobTitle: true,
            email: true
          } 
        },
        leavePolicy: { 
          select: { 
            id: true, 
            name: true, 
            leaveType: true,
            maxDaysPerYear: true,
            requiresApproval: true,
            requiresDocumentation: true
          } 
        },
        reviewer: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!leaveRequest) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ leaveRequest });

  } catch (error) {
    console.error('Error fetching leave request:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leave request', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update a leave request (only for pending requests)
 */
export async function PUT(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const data = await request.json();

    // Check if request exists and belongs to tenant
    const existingRequest = await prisma.leaveRequest.findFirst({
      where: {
        id,
        tenantId: user.tenantId
      }
    });

    if (!existingRequest) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 }
      );
    }

    // Only allow updates for pending requests
    if (existingRequest.status !== 'pending') {
      return NextResponse.json(
        { error: 'Only pending leave requests can be updated' },
        { status: 400 }
      );
    }

    // Validate dates if provided
    let startDate = existingRequest.startDate;
    let endDate = existingRequest.endDate;
    let totalDays = existingRequest.totalDays;

    if (data.startDate || data.endDate) {
      startDate = data.startDate ? new Date(data.startDate) : existingRequest.startDate;
      endDate = data.endDate ? new Date(data.endDate) : existingRequest.endDate;

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

      // Recalculate total days
      const timeDiff = endDate.getTime() - startDate.getTime();
      totalDays = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
    }

    // Check for overlapping requests (excluding current request)
    if (data.startDate || data.endDate) {
      const overlappingRequest = await prisma.leaveRequest.findFirst({
        where: {
          employeeId: existingRequest.employeeId,
          tenantId: user.tenantId,
          id: { not: id },
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
    }

    const updatedRequest = await prisma.leaveRequest.update({
      where: { id },
      data: {
        startDate: startDate,
        endDate: endDate,
        totalDays: totalDays,
        reason: data.reason !== undefined ? data.reason : existingRequest.reason,
        documentation: data.documentation !== undefined ? data.documentation : existingRequest.documentation
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
      message: 'Leave request updated successfully',
      request: updatedRequest
    });

  } catch (error) {
    console.error('Error updating leave request:', error);
    return NextResponse.json(
      { error: 'Failed to update leave request', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Cancel a leave request (only for pending requests)
 */
export async function DELETE(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Check if request exists and belongs to tenant
    const existingRequest = await prisma.leaveRequest.findFirst({
      where: {
        id,
        tenantId: user.tenantId
      }
    });

    if (!existingRequest) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 }
      );
    }

    // Only allow cancellation for pending requests
    if (existingRequest.status !== 'pending') {
      return NextResponse.json(
        { error: 'Only pending leave requests can be cancelled' },
        { status: 400 }
      );
    }

    await prisma.leaveRequest.delete({
      where: { id }
    });

    return NextResponse.json({
      message: 'Leave request cancelled successfully'
    });

  } catch (error) {
    console.error('Error cancelling leave request:', error);
    return NextResponse.json(
      { error: 'Failed to cancel leave request', details: error.message },
      { status: 500 }
    );
  }
}