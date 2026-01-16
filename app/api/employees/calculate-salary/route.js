// app/api/employees/calculate-salary/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { calculatePayroll } from '@/lib/payrollCalculations';

/**
 * POST handler for salary calculation during employee creation
 * Calculates net salary based on gross salary and selected deductions
 */
export async function POST(request) {
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

    const body = await request.json();
    const { grossSalary, deductionIds = [], employmentType = 'Permanent' } = body;

    // Validate required fields
    if (!grossSalary || grossSalary <= 0) {
      return NextResponse.json(
        { error: 'Gross salary must be a positive number' },
        { status: 400 }
      );
    }

    // Fetch selected deductions from database
    let deductions = [];
    if (deductionIds.length > 0) {
      deductions = await prisma.deduction.findMany({
        where: {
          id: { in: deductionIds },
          tenantId: user.tenantId,
          isActive: true
        }
      });
    }

    // Fetch tenant pension rates (percentage points)
    // Use raw SQL so this works even if Prisma Client is stale.
    let npsOptions = { npsEmployeeRatePercent: 5, npsEmployerRatePercent: 5 };
    try {
      const rows = await prisma.$queryRaw`
        SELECT "npsEmployeeRatePercent", "npsEmployerRatePercent"
        FROM "TenantSettings"
        WHERE "tenantId" = ${user.tenantId}
        LIMIT 1
      `;
      const row = Array.isArray(rows) ? rows[0] : null;
      if (row) {
        npsOptions = {
          npsEmployeeRatePercent: Number(row.npsEmployeeRatePercent ?? 5) || 5,
          npsEmployerRatePercent: Number(row.npsEmployerRatePercent ?? 5) || 5,
        };
      }
    } catch (e) {
      console.warn('Salary calculate raw NPS rate read failed, using defaults:', e?.message || e);
    }

    // Calculate payroll
    const payrollCalculation = calculatePayroll(parseFloat(grossSalary), deductions, npsOptions);

    return NextResponse.json({
      calculation: payrollCalculation,
      deductions: deductions
    });

  } catch (error) {
    console.error('Error calculating employee salary:', error);
    return NextResponse.json(
      { error: 'Failed to calculate salary', details: error.message },
      { status: 500 }
    );
  }
}


