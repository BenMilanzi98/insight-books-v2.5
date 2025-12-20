// app/api/leave-requests/[id]/approve/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

/**
 * POST - Approve or reject a leave request
 */
export async function POST(request, { params }) {
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

    const { action, comments } = data; // action: 'approve' or 'reject'

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be either "approve" or "reject"' },
        { status: 400 }
      );
    }

    // Check if request exists and belongs to tenant
    const existingRequest = await prisma.leaveRequest.findFirst({
      where: {
        id,
        tenantId: user.tenantId
      },
      include: {
        employee: {
          select: {
            name: true,
            employeeId: true
          }
        },
        leavePolicy: {
          select: {
            name: true,
            leaveType: true
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

    // Only allow approval/rejection for pending requests
    if (existingRequest.status !== 'pending') {
      return NextResponse.json(
        { error: 'Only pending leave requests can be approved or rejected' },
        { status: 400 }
      );
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    const updatedRequest = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: newStatus,
        reviewedAt: new Date(),
        reviewedBy: user.id,
        reviewComments: comments || null
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
            leaveType: true 
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

    return NextResponse.json({
      message: `Leave request ${action}d successfully`,
      request: updatedRequest
    });

  } catch (error) {
    console.error('Error processing leave request:', error);
    return NextResponse.json(
      { error: 'Failed to process leave request', details: error.message },
      { status: 500 }
    );
  }
}