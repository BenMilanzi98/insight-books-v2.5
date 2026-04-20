// app/api/leave/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requirePermission } from '@/lib/auth';
import { parseDateInputForMonthNormalization } from '@/lib/dateUtils';

// GET - Fetch a single leave request by ID
export async function GET(request, { params }) {
  try {
    // Check permission
    const permissionCheck = await requirePermission(request, 'leave.view');
    if (permissionCheck) return permissionCheck;
    
    const user = await getUserFromSession(request);
    const leaveId = params.id;
    
    // Fetch the leave request
    const leaveRequest = await prisma.leaveRequest.findFirst({
      where: {
        id: leaveId,
        tenantId: user.tenantId
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            position: true,
            startDate: true
          }
        },
        approvedBy: {
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
    
    // Calculate duration in days
    const duration = Math.ceil((leaveRequest.endDate - leaveRequest.startDate) / (1000 * 60 * 60 * 24) + 1);
    
    // Format the response
    const formattedRequest = {
      id: leaveRequest.id,
      employee: {
        id: leaveRequest.employee.id,
        name: leaveRequest.employee.name,
        email: leaveRequest.employee.email,
        department: leaveRequest.employee.department,
        position: leaveRequest.employee.position,
        startDate: leaveRequest.employee.startDate.toISOString(),
      },
      type: leaveRequest.type,
      startDate: leaveRequest.startDate.toISOString(),
      endDate: leaveRequest.endDate.toISOString(),
      duration,
      status: leaveRequest.status,
      requestDate: leaveRequest.requestDate.toISOString(),
      notes: leaveRequest.notes,
      approval: leaveRequest.approvedBy ? {
        approvedBy: {
          id: leaveRequest.approvedBy.id,
          name: leaveRequest.approvedBy.name,
          email: leaveRequest.approvedBy.email
        },
        approvedAt: leaveRequest.approvedAt.toISOString()
      } : null
    };
    
    return NextResponse.json(formattedRequest);
    
  } catch (error) {
    console.error(`Error fetching leave request ${params.id}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch leave request. Please try again.' },
      { status: 500 }
    );
  }
}

// PUT - Update a leave request
export async function PUT(request, { params }) {
  try {
    // Check permission
    const permissionCheck = await requirePermission(request, 'leave.update');
    if (permissionCheck) return permissionCheck;
    
    const user = await getUserFromSession(request);
    const leaveId = params.id;
    const body = await request.json();
    
    // Check if leave request exists
    const existingRequest = await prisma.leaveRequest.findFirst({
      where: {
        id: leaveId,
        tenantId: user.tenantId
      }
    });
    
    if (!existingRequest) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 }
      );
    }
    
    // Prevent updating approved or rejected requests
    if (existingRequest.status !== 'Pending' && !body.status) {
      return NextResponse.json(
        { error: 'Cannot update a leave request that has already been processed' },
        { status: 400 }
      );
    }
    
    // Prepare update data
    const updateData = {};
    
    // Update dates if provided
    if (body.startDate && body.endDate) {
      const startDate = parseDateInputForMonthNormalization(body.startDate);
      const endDate = parseDateInputForMonthNormalization(body.endDate);
      
      if (endDate < startDate) {
        return NextResponse.json(
          { error: 'End date cannot be before start date' },
          { status: 400 }
        );
      }
      
      updateData.startDate = startDate;
      updateData.endDate = endDate;
      
      // Check for overlapping leave requests
      const overlappingRequests = await prisma.leaveRequest.findMany({
        where: {
          employeeId: existingRequest.employeeId,
          status: { in: ['Pending', 'Approved'] },
          id: { not: leaveId },
          OR: [
            {
              startDate: {
                lte: endDate
              },
              endDate: {
                gte: startDate
              }
            }
          ]
        }
      });
      
      if (overlappingRequests.length > 0) {
        return NextResponse.json(
          { error: 'There is an overlapping leave request for this period' },
          { status: 400 }
        );
      }
    }
    
    // Update other fields if provided
    if (body.type) updateData.type = body.type;
    if (body.notes !== undefined) updateData.notes = body.notes;
    
    // Update the leave request
    const updatedRequest = await prisma.leaveRequest.update({
      where: {
        id: leaveId
      },
      data: updateData
    });
    
    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'LEAVE_REQUEST_UPDATED',
        entityType: 'LEAVE_REQUEST',
        entityId: leaveId,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          type: updatedRequest.type,
          startDate: updatedRequest.startDate.toISOString(),
          endDate: updatedRequest.endDate.toISOString()
        })
      }
    });
    
    return NextResponse.json({
      message: 'Leave request updated successfully',
      leaveRequest: updatedRequest
    });
    
  } catch (error) {
    console.error(`Error updating leave request ${params.id}:`, error);
    return NextResponse.json(
      { error: 'Failed to update leave request. Please try again.' },
      { status: 500 }
    );
  }
}

// DELETE - Cancel a leave request
export async function DELETE(request, { params }) {
  try {
    // Check permission
    const permissionCheck = await requirePermission(request, 'leave.delete');
    if (permissionCheck) return permissionCheck;
    
    const user = await getUserFromSession(request);
    const leaveId = params.id;
    
    // Check if leave request exists
    const existingRequest = await prisma.leaveRequest.findFirst({
      where: {
        id: leaveId,
        tenantId: user.tenantId
      }
    });
    
    if (!existingRequest) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 }
      );
    }
    
    // Prevent cancelling approved requests that have already started
    if (existingRequest.status === 'Approved' && existingRequest.startDate <= new Date()) {
      return NextResponse.json(
        { error: 'Cannot cancel a leave that has already started' },
        { status: 400 }
      );
    }
    
    // Update status to 'Cancelled' instead of deleting
    const updatedRequest = await prisma.leaveRequest.update({
      where: {
        id: leaveId
      },
      data: {
        status: 'Cancelled'
      }
    });
    
    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'LEAVE_REQUEST_CANCELLED',
        entityType: 'LEAVE_REQUEST',
        entityId: leaveId,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          type: existingRequest.type,
          startDate: existingRequest.startDate.toISOString(),
          endDate: existingRequest.endDate.toISOString()
        })
      }
    });
    
    return NextResponse.json({
      message: 'Leave request cancelled successfully'
    });
    
  } catch (error) {
    console.error(`Error cancelling leave request ${params.id}:`, error);
    return NextResponse.json(
      { error: 'Failed to cancel leave request. Please try again.' },
      { status: 500 }
    );
  }
}