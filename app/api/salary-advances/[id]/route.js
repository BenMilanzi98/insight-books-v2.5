// app/api/salary-advances/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

/**
 * GET - Get specific salary advance
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

    const { id } = params;

    const advance = await prisma.salaryAdvance.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            grossSalary: true,
            salary: true
          }
        },
        deductions: {
          orderBy: {
            deductionDate: 'desc'
          }
        }
      }
    });

    if (!advance || advance.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'Salary advance not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ advance });

  } catch (error) {
    console.error('Error fetching salary advance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch salary advance', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update salary advance
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

    const { id } = params;
    const body = await request.json();

    const advance = await prisma.salaryAdvance.findUnique({
      where: { id }
    });

    if (!advance || advance.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'Salary advance not found' },
        { status: 404 }
      );
    }

    // Only allow updating status and notes if there are deductions
    if (advance.totalDeducted > 0 && body.amount) {
      return NextResponse.json(
        { error: 'Cannot modify advance amount after deductions have been made' },
        { status: 400 }
      );
    }

    const updateData = {};
    if (body.status !== undefined) updateData.status = body.status;
    if (body.notes !== undefined) updateData.notes = body.notes;

    // If updating amount and no deductions yet, recalculate
    if (body.amount && advance.totalDeducted === 0) {
      const months = body.repaymentMonths || advance.repaymentMonths;
      updateData.amount = Number(body.amount);
      updateData.monthlyDeduction = Number(body.amount) / months;
      updateData.outstandingAmount = Number(body.amount);
      if (body.repaymentMonths) updateData.repaymentMonths = months;
    }

    const updated = await prisma.salaryAdvance.update({
      where: { id },
      data: updateData,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeId: true
          }
        }
      }
    });

    return NextResponse.json({ advance: updated });

  } catch (error) {
    console.error('Error updating salary advance:', error);
    return NextResponse.json(
      { error: 'Failed to update salary advance', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Cancel/delete salary advance (only if no deductions)
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

    const { id } = params;

    const advance = await prisma.salaryAdvance.findUnique({
      where: { id }
    });

    if (!advance || advance.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'Salary advance not found' },
        { status: 404 }
      );
    }

    if (advance.totalDeducted > 0) {
      return NextResponse.json(
        { error: 'Cannot delete advance with existing deductions. Mark as cancelled instead.' },
        { status: 400 }
      );
    }

    await prisma.salaryAdvance.delete({
      where: { id }
    });

    return NextResponse.json({ message: 'Salary advance deleted successfully' });

  } catch (error) {
    console.error('Error deleting salary advance:', error);
    return NextResponse.json(
      { error: 'Failed to delete salary advance', details: error.message },
      { status: 500 }
    );
  }
}

