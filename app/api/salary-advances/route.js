// app/api/salary-advances/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

/**
 * GET - Get all salary advances for the tenant
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
    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status');

    const where = {
      tenantId: user.tenantId
    };

    if (employeeId) {
      where.employeeId = employeeId;
    }

    if (status) {
      where.status = status;
    }

    const advances = await prisma.salaryAdvance.findMany({
      where,
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
      },
      orderBy: {
        advanceDate: 'desc'
      }
    });

    return NextResponse.json({ advances });

  } catch (error) {
    console.error('Error fetching salary advances:', error);
    return NextResponse.json(
      { error: 'Failed to fetch salary advances', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST - Create a new salary advance
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
    const { employeeId, amount, advanceDate, repaymentMonths, reference, notes } = body;

    if (!employeeId || !amount || !advanceDate) {
      return NextResponse.json(
        { error: 'Employee ID, amount, and advance date are required' },
        { status: 400 }
      );
    }

    // Verify employee belongs to tenant
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        name: true,
        tenantId: true
      }
    });

    if (!employee || employee.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    const advanceAmount = Number(amount);
    const months = repaymentMonths || 1;
    const monthlyDeduction = advanceAmount / months;

    // Create advance
    const advance = await prisma.salaryAdvance.create({
      data: {
        employeeId,
        tenantId: user.tenantId,
        amount: advanceAmount,
        advanceDate: new Date(advanceDate),
        repaymentMonths: months,
        monthlyDeduction: monthlyDeduction,
        totalDeducted: 0,
        outstandingAmount: advanceAmount,
        status: 'Active',
        reference: reference || null,
        notes: notes || null
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

    return NextResponse.json({ advance });

  } catch (error) {
    console.error('Error creating salary advance:', error);
    return NextResponse.json(
      { error: 'Failed to create salary advance', details: error.message },
      { status: 500 }
    );
  }
}

