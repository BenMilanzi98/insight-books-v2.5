// app/api/salary-advances/deductions/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

/**
 * POST - Record a deduction from salary advance
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

    const body = await request.json();
    const { salaryAdvanceId, amount, deductionDate, payrollId, notes } = body;

    if (!salaryAdvanceId || !amount || !deductionDate) {
      return NextResponse.json(
        { error: 'Salary advance ID, amount, and deduction date are required' },
        { status: 400 }
      );
    }

    // Verify advance belongs to tenant
    const advance = await prisma.salaryAdvance.findUnique({
      where: { id: salaryAdvanceId }
    });

    if (!advance || advance.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'Salary advance not found' },
        { status: 404 }
      );
    }

    if (advance.status !== 'Active') {
      return NextResponse.json(
        { error: 'Cannot deduct from inactive or completed advance' },
        { status: 400 }
      );
    }

    const deductionAmount = Number(amount);
    const newTotalDeducted = advance.totalDeducted + deductionAmount;
    const newOutstanding = Math.max(0, advance.amount - newTotalDeducted);

    // Check if advance is fully paid
    const newStatus = newOutstanding <= 0 ? 'Completed' : advance.status;

    // Create deduction record
    const deduction = await prisma.advanceDeduction.create({
      data: {
        salaryAdvanceId,
        payrollId: payrollId || null,
        amount: deductionAmount,
        deductionDate: new Date(deductionDate),
        notes: notes || null
      }
    });

    // Update advance totals
    const updatedAdvance = await prisma.salaryAdvance.update({
      where: { id: salaryAdvanceId },
      data: {
        totalDeducted: newTotalDeducted,
        outstandingAmount: newOutstanding,
        status: newStatus
      },
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

    return NextResponse.json({
      deduction,
      advance: updatedAdvance
    });

  } catch (error) {
    console.error('Error recording advance deduction:', error);
    return NextResponse.json(
      { error: 'Failed to record advance deduction', details: error.message },
      { status: 500 }
    );
  }
}

