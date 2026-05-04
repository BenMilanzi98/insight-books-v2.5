// app/api/leave-balances/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { getLeaveStatusVariants } from '@/lib/hrCalculations';

/**
 * GET - Fetch leave balances for employees
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
    const year = parseInt(searchParams.get('year')) || new Date().getFullYear();

    const where = {
      tenantId: user.tenantId,
      year: year
    };

    if (employeeId) {
      where.employeeId = employeeId;
    }

    const balances = await prisma.leaveBalance.findMany({
      where,
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
            leaveType: true,
            maxDaysPerYear: true,
            accrualRate: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      balances,
      year
    });

  } catch (error) {
    console.error('Error fetching leave balances:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error code:', error.code);
    return NextResponse.json(
      { 
        error: 'Failed to fetch leave balances', 
        details: error.message,
        code: error.code,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Initialize or update leave balance for an employee
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

    const data = await request.json();
    const { employeeId, leavePolicyId, allocatedDays, year } = data;

    if (!employeeId || !leavePolicyId) {
      return NextResponse.json(
        { error: 'Employee ID and leave policy ID are required' },
        { status: 400 }
      );
    }

    const balanceYear = year || new Date().getFullYear();

    // Check if employee exists and belongs to tenant
    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        tenantId: user.tenantId
      }
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Check if leave policy exists
    const leavePolicy = await prisma.leavePolicy.findFirst({
      where: {
        id: leavePolicyId,
        tenantId: user.tenantId
      }
    });

    if (!leavePolicy) {
      return NextResponse.json(
        { error: 'Leave policy not found' },
        { status: 404 }
      );
    }

    // Calculate used days from approved leave requests
    const approvedRequests = await prisma.leaveRequest.findMany({
      where: {
        employeeId,
        leavePolicyId,
        tenantId: user.tenantId,
        status: { in: getLeaveStatusVariants('approved') },
        OR: [
          {
            AND: [
              { startDate: { gte: new Date(balanceYear, 0, 1) } },
              { startDate: { lte: new Date(balanceYear, 11, 31) } }
            ]
          }
        ]
      }
    });

    const usedDays = approvedRequests.reduce((sum, req) => sum + req.totalDays, 0);

    // Calculate pending days
    const pendingRequests = await prisma.leaveRequest.findMany({
      where: {
        employeeId,
        leavePolicyId,
        tenantId: user.tenantId,
        status: { in: getLeaveStatusVariants('pending') },
        OR: [
          {
            AND: [
              { startDate: { gte: new Date(balanceYear, 0, 1) } },
              { startDate: { lte: new Date(balanceYear, 11, 31) } }
            ]
          }
        ]
      }
    });

    const pendingDays = pendingRequests.reduce((sum, req) => sum + req.totalDays, 0);

    // Use provided allocatedDays or calculate from policy
    const finalAllocatedDays = allocatedDays !== undefined 
      ? parseFloat(allocatedDays)
      : (leavePolicy.maxDaysPerYear || 0);

    const availableDays = finalAllocatedDays - usedDays - pendingDays;

    // Upsert leave balance
    const balance = await prisma.leaveBalance.upsert({
      where: {
        employeeId_leavePolicyId_year: {
          employeeId,
          leavePolicyId,
          year: balanceYear
        }
      },
      update: {
        allocatedDays: finalAllocatedDays,
        usedDays,
        pendingDays,
        availableDays,
        lastCalculatedAt: new Date()
      },
      create: {
        employeeId,
        leavePolicyId,
        tenantId: user.tenantId,
        allocatedDays: finalAllocatedDays,
        usedDays,
        pendingDays,
        availableDays,
        year: balanceYear,
        lastCalculatedAt: new Date()
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeId: true
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
      message: 'Leave balance updated successfully',
      balance
    }, { status: 201 });

  } catch (error) {
    console.error('Error updating leave balance:', error);
    return NextResponse.json(
      { error: 'Failed to update leave balance', details: error.message },
      { status: 500 }
    );
  }
}

