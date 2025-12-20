// app/api/leave/[id]/reject/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requirePermission } from '@/lib/auth';

// PUT - Reject a leave request
export async function PUT(request, { params }) {
  try {
    // Check permission
    const permissionCheck = await requirePermission(request, 'leave.approve');
    if (permissionCheck) return permissionCheck;
    
    const user = await getUserFromSession(request);
    const leaveId = params.id;
    const body = await request.json();
    
    // Check if leave request exists
    const existingRequest = await prisma.leaveRequest.findFirst({
      where: {
        id: leaveId,
        tenantId: user.tenantId
      },
      include: {
        employee: {
          select: {
            name: true
          }
        }
      }
    });
    
    if (!existingRequest) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 }
      );
    }
    
    // Can only reject pending requests
    if (existingRequest.status !== 'Pending') {
      return NextResponse.json(
        { error: `Cannot reject a leave request that is already ${existingRequest.status.toLowerCase()}` },
        { status: 400 }
      );
    }
    
    // Update the leave request
    const updatedRequest = await prisma.leaveRequest.update({
      where: {
        id: leaveId
      },
      data: {
        status: 'Rejected',
        approvedById: user.id,
        approvedAt: new Date(),
        notes: body.reason || existingRequest.notes // Add rejection reason
      }
    });
    
    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'LEAVE_REQUEST_REJECTED',
        entityType: 'LEAVE_REQUEST',
        entityId: leaveId,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          employeeName: existingRequest.employee.name,
          type: existingRequest.type,
          startDate: existingRequest.startDate.toISOString(),
          endDate: existingRequest.endDate.toISOString(),
          reason: body.reason || 'No reason provided'
        })
      }
    });
    
    return NextResponse.json({
      message: 'Leave request rejected successfully',
      leaveRequest: updatedRequest
    });
    
  } catch (error) {
    console.error(`Error rejecting leave request ${params.id}:`, error);
    return NextResponse.json(
      { error: 'Failed to reject leave request. Please try again.' },
      { status: 500 }
    );
  }
}