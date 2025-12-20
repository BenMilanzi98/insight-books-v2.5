// app/api/deductions/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

/**
 * GET handler for individual deduction
 * Fetches a single deduction by ID
 */
export async function GET(request, { params }) {
  try {
    // Check for standard access (trial or paid subscription)
    const accessError = await requireStandardAccess(request);
    if (accessError) {
      return accessError;
    }

    // Authenticate user and get tenant ID
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Fetch deduction
    const deduction = await prisma.deduction.findFirst({
      where: {
        id: id,
        tenantId: user.tenantId
      }
    });

    if (!deduction) {
      return NextResponse.json(
        { error: 'Deduction not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      deduction: deduction
    });

  } catch (error) {
    console.error('Error fetching deduction:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deduction', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT handler for updating deduction
 * Updates an existing deduction
 */
export async function PUT(request, { params }) {
  try {
    // Check for standard access (trial or paid subscription)
    const accessError = await requireStandardAccess(request);
    if (accessError) {
      return accessError;
    }

    // Authenticate user and get tenant ID
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    // Check if deduction exists and belongs to tenant
    const existingDeduction = await prisma.deduction.findFirst({
      where: {
        id: id,
        tenantId: user.tenantId
      }
    });

    if (!existingDeduction) {
      return NextResponse.json(
        { error: 'Deduction not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData = {
      name: body.name || existingDeduction.name,
      description: body.description !== undefined ? body.description : existingDeduction.description,
      isStatutory: body.isStatutory !== undefined ? body.isStatutory : existingDeduction.isStatutory,
      isActive: body.isActive !== undefined ? body.isActive : existingDeduction.isActive
    };

    // Handle percentage updates
    if (body.percentage !== undefined || (body.type === 'percentage' && body.value !== undefined)) {
      const value = parseFloat(body.percentage || body.value);
      if (isNaN(value) || value < 0 || value > 100) {
        return NextResponse.json(
          { error: 'Percentage must be between 0 and 100' },
          { status: 400 }
        );
      }
      updateData.percentage = value;
      updateData.amount = null; // Clear amount when setting percentage
    }

    // Handle amount updates
    if (body.amount !== undefined || (body.type === 'fixed' && body.value !== undefined)) {
      const value = parseFloat(body.amount || body.value);
      if (isNaN(value) || value < 0) {
        return NextResponse.json(
          { error: 'Amount must be a positive number' },
          { status: 400 }
        );
      }
      updateData.amount = value;
      updateData.percentage = null; // Clear percentage when setting amount
    }

    // Update deduction
    const updatedDeduction = await prisma.deduction.update({
      where: { id: id },
      data: updateData
    });

    return NextResponse.json({
      message: 'Deduction updated successfully',
      deduction: updatedDeduction
    });

  } catch (error) {
    console.error('Error updating deduction:', error);
    return NextResponse.json(
      { error: 'Failed to update deduction', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE handler for deleting deduction
 * Deletes a deduction
 */
export async function DELETE(request, { params }) {
  try {
    // Check for standard access (trial or paid subscription)
    const accessError = await requireStandardAccess(request);
    if (accessError) {
      return accessError;
    }

    // Authenticate user and get tenant ID
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Check if deduction exists and belongs to tenant
    const existingDeduction = await prisma.deduction.findFirst({
      where: {
        id: id,
        tenantId: user.tenantId
      }
    });

    if (!existingDeduction) {
      return NextResponse.json(
        { error: 'Deduction not found' },
        { status: 404 }
      );
    }

    // Delete deduction
    await prisma.deduction.delete({
      where: { id: id }
    });

    return NextResponse.json({
      message: 'Deduction deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting deduction:', error);
    return NextResponse.json(
      { error: 'Failed to delete deduction', details: error.message },
      { status: 500 }
    );
  }
}


