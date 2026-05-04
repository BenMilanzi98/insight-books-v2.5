// app/api/salary-advances/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { createTransactionReversal } from '@/lib/transactionReversalService';

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
      const postedTransaction = await prisma.transaction.findFirst({
        where: {
          tenantId: user.tenantId,
          sourceType: 'SalaryAdvance',
          sourceId: id,
          isReversal: false
        },
        select: { id: true }
      });
      if (postedTransaction && Number(body.amount) !== Number(advance.amount)) {
        return NextResponse.json(
          { error: 'Cannot modify a posted advance amount. Cancel this advance and create a corrected one.' },
          { status: 400 }
        );
      }
      const months = body.repaymentMonths || advance.repaymentMonths;
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json(
          { error: 'Advance amount must be greater than zero' },
          { status: 400 }
        );
      }
      if (!Number.isInteger(Number(months)) || Number(months) <= 0) {
        return NextResponse.json(
          { error: 'Repayment months must be a positive whole number' },
          { status: 400 }
        );
      }
      updateData.amount = amount;
      updateData.monthlyDeduction = Math.round((amount / Number(months)) * 100) / 100;
      updateData.outstandingAmount = amount;
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
 * DELETE - Cancel salary advance and reverse its posted GL if no deductions exist
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

    const postedTransaction = await prisma.transaction.findFirst({
      where: {
        tenantId: user.tenantId,
        sourceType: 'SalaryAdvance',
        sourceId: id,
        isReversal: false
      },
      orderBy: { date: 'asc' }
    });

    if (postedTransaction) {
      const existingReversal = await prisma.transaction.findFirst({
        where: {
          tenantId: user.tenantId,
          isReversal: true,
          reversedTransactionId: postedTransaction.id
        }
      });
      if (!existingReversal) {
        await createTransactionReversal({
          transactionId: postedTransaction.id,
          reversalReason: 'Salary advance cancelled before any payroll deduction',
          userId: user.id,
          tenantId: user.tenantId
        });
      }
    }

    const updated = await prisma.salaryAdvance.update({
      where: { id },
      data: {
        status: 'Cancelled',
        outstandingAmount: advance.amount,
        notes: [
          advance.notes,
          `Cancelled on ${new Date().toISOString()} before payroll deductions.`
        ].filter(Boolean).join('\n')
      }
    });

    return NextResponse.json({
      message: 'Salary advance cancelled successfully',
      advance: updated
    });

  } catch (error) {
    console.error('Error deleting salary advance:', error);
    return NextResponse.json(
      { error: 'Failed to delete salary advance', details: error.message },
      { status: 500 }
    );
  }
}

