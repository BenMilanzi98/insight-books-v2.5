// app/api/leave-policies/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

/**
 * GET - Fetch a specific leave policy
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

    const leavePolicy = await prisma.leavePolicy.findFirst({
      where: {
        id,
        tenantId: user.tenantId
      },
      include: {
        _count: {
          select: {
            leaveRequests: true
          }
        }
      }
    });

    if (!leavePolicy) {
      return NextResponse.json(
        { error: 'Leave policy not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ leavePolicy });

  } catch (error) {
    console.error('Error fetching leave policy:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leave policy', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update a leave policy
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

    // Check if policy exists and belongs to tenant
    const existingPolicy = await prisma.leavePolicy.findFirst({
      where: {
        id,
        tenantId: user.tenantId
      }
    });

    if (!existingPolicy) {
      return NextResponse.json(
        { error: 'Leave policy not found' },
        { status: 404 }
      );
    }

    // Check if another policy with same name exists (excluding current one)
    if (data.name && data.name !== existingPolicy.name) {
      const duplicatePolicy = await prisma.leavePolicy.findFirst({
        where: {
          name: data.name,
          tenantId: user.tenantId,
          id: { not: id }
        }
      });

      if (duplicatePolicy) {
        return NextResponse.json(
          { error: 'A leave policy with this name already exists' },
          { status: 400 }
        );
      }
    }

    const updatedPolicy = await prisma.leavePolicy.update({
      where: { id },
      data: {
        name: data.name || existingPolicy.name,
        description: data.description !== undefined ? data.description : existingPolicy.description,
        leaveType: data.leaveType || existingPolicy.leaveType,
        maxDaysPerYear: data.maxDaysPerYear ? parseInt(data.maxDaysPerYear) : existingPolicy.maxDaysPerYear,
        maxDaysPerRequest: data.maxDaysPerRequest ? parseInt(data.maxDaysPerRequest) : existingPolicy.maxDaysPerRequest,
        minDaysPerRequest: data.minDaysPerRequest ? parseInt(data.minDaysPerRequest) : existingPolicy.minDaysPerRequest,
        requiresApproval: data.requiresApproval !== undefined ? data.requiresApproval : existingPolicy.requiresApproval,
        requiresDocumentation: data.requiresDocumentation !== undefined ? data.requiresDocumentation : existingPolicy.requiresDocumentation,
        isPaid: data.isPaid !== undefined ? data.isPaid : existingPolicy.isPaid,
        accrualRate: data.accrualRate ? parseFloat(data.accrualRate) : existingPolicy.accrualRate,
        carryOverLimit: data.carryOverLimit ? parseInt(data.carryOverLimit) : existingPolicy.carryOverLimit,
        isActive: data.isActive !== undefined ? data.isActive : existingPolicy.isActive
      }
    });

    return NextResponse.json({
      message: 'Leave policy updated successfully',
      leavePolicy: updatedPolicy
    });

  } catch (error) {
    console.error('Error updating leave policy:', error);
    return NextResponse.json(
      { error: 'Failed to update leave policy', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete a leave policy
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

    // Check if policy exists and belongs to tenant
    const existingPolicy = await prisma.leavePolicy.findFirst({
      where: {
        id,
        tenantId: user.tenantId
      },
      include: {
        _count: {
          select: {
            leaveRequests: true
          }
        }
      }
    });

    if (!existingPolicy) {
      return NextResponse.json(
        { error: 'Leave policy not found' },
        { status: 404 }
      );
    }

    // Check if policy has associated leave requests
    if (existingPolicy._count.leaveRequests > 0) {
      return NextResponse.json(
        { error: 'Cannot delete leave policy with existing leave requests. Please deactivate it instead.' },
        { status: 400 }
      );
    }

    await prisma.leavePolicy.delete({
      where: { id }
    });

    return NextResponse.json({
      message: 'Leave policy deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting leave policy:', error);
    return NextResponse.json(
      { error: 'Failed to delete leave policy', details: error.message },
      { status: 500 }
    );
  }
}