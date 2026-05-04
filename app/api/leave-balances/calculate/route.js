// app/api/leave-balances/calculate/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { getLeaveStatusVariants } from '@/lib/hrCalculations';

/**
 * POST - Recalculate leave balances for employees
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
    const { employeeId, year } = data;

    const balanceYear = year || new Date().getFullYear();
    const startOfYear = new Date(balanceYear, 0, 1);
    const endOfYear = new Date(balanceYear, 11, 31, 23, 59, 59);

    // Get all active employees
    const where = {
      tenantId: user.tenantId,
      isActive: true
    };

    if (employeeId) {
      where.id = employeeId;
    }

    const employees = await prisma.employee.findMany({
      where,
      select: {
        id: true,
        name: true,
        startDate: true
      }
    });

    // Get all active leave policies
    const leavePolicies = await prisma.leavePolicy.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true
      }
    });

    const results = [];

    for (const employee of employees) {
      for (const policy of leavePolicies) {
        // Calculate allocated days based on policy
        let allocatedDays = 0;

        if (policy.maxDaysPerYear) {
          allocatedDays = policy.maxDaysPerYear;

          // If employee started mid-year, prorate the allocation
          if (employee.startDate > startOfYear) {
            const monthsWorked = Math.max(0, 12 - (employee.startDate.getMonth()));
            allocatedDays = (policy.maxDaysPerYear / 12) * monthsWorked;
          }
        } else if (policy.accrualRate) {
          // Calculate based on accrual rate
          const monthsWorked = employee.startDate > startOfYear
            ? Math.max(0, 12 - (employee.startDate.getMonth()))
            : 12;
          allocatedDays = policy.accrualRate * monthsWorked;
        }

        // Calculate used days from approved requests
        const approvedRequests = await prisma.leaveRequest.findMany({
          where: {
            employeeId: employee.id,
            leavePolicyId: policy.id,
            tenantId: user.tenantId,
            status: { in: getLeaveStatusVariants('approved') },
            startDate: { gte: startOfYear, lte: endOfYear }
          }
        });

        const usedDays = approvedRequests.reduce((sum, req) => sum + req.totalDays, 0);

        // Calculate pending days
        const pendingRequests = await prisma.leaveRequest.findMany({
          where: {
            employeeId: employee.id,
            leavePolicyId: policy.id,
            tenantId: user.tenantId,
            status: { in: getLeaveStatusVariants('pending') },
            startDate: { gte: startOfYear, lte: endOfYear }
          }
        });

        const pendingDays = pendingRequests.reduce((sum, req) => sum + req.totalDays, 0);

        const availableDays = allocatedDays - usedDays - pendingDays;

        // Upsert balance
        const balance = await prisma.leaveBalance.upsert({
          where: {
            employeeId_leavePolicyId_year: {
              employeeId: employee.id,
              leavePolicyId: policy.id,
              year: balanceYear
            }
          },
          update: {
            allocatedDays,
            usedDays,
            pendingDays,
            availableDays,
            lastCalculatedAt: new Date()
          },
          create: {
            employeeId: employee.id,
            leavePolicyId: policy.id,
            tenantId: user.tenantId,
            allocatedDays,
            usedDays,
            pendingDays,
            availableDays,
            year: balanceYear,
            lastCalculatedAt: new Date()
          }
        });

        results.push({
          employeeId: employee.id,
          employeeName: employee.name,
          policyId: policy.id,
          policyName: policy.name,
          balance
        });
      }
    }

    return NextResponse.json({
      message: 'Leave balances recalculated successfully',
      results,
      year: balanceYear
    });

  } catch (error) {
    console.error('Error recalculating leave balances:', error);
    return NextResponse.json(
      { error: 'Failed to recalculate leave balances', details: error.message },
      { status: 500 }
    );
  }
}

