// app/api/employees/calculate-salary/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { calculatePayroll } from '@/lib/payrollCalculations';
import { npsRatesFromTenantSettingsRow } from '@/lib/npsTenantRates';

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
    const { grossSalary, deductionIds = [], employmentType = 'Permanent', benefits = [] } = body;

    // Validate required fields
    if (!grossSalary || grossSalary <= 0) {
      return NextResponse.json(
        { error: 'Gross salary must be a positive number' },
        { status: 400 }
      );
    }

    // Sum benefit amounts (allowances) – added to net salary (take-home), not to gross
    const totalBenefits = Array.isArray(benefits)
      ? benefits.reduce((sum, b) => sum + (Number(b?.amount) || 0), 0)
      : 0;
    const baseSalary = parseFloat(grossSalary) || 0;

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

    // Fetch tenant pension rates (percentage points). Null = not configured (0% in calculateNPS).
    let npsOptions = { npsEmployeeRatePercent: null, npsEmployerRatePercent: null };
    try {
      const rows = await prisma.$queryRaw`
        SELECT "npsEmployeeRatePercent", "npsEmployerRatePercent"
        FROM "TenantSettings"
        WHERE "tenantId" = ${user.tenantId}
        LIMIT 1
      `;
      const row = Array.isArray(rows) ? rows[0] : null;
      if (row) {
        npsOptions = npsRatesFromTenantSettingsRow(row);
      }
    } catch (e) {
      console.warn('Salary calculate raw NPS rate read failed:', e?.message || e);
    }

    // Calculate payroll: deductions apply to base salary only; benefits are added to net (take-home)
    const payrollCalculation = calculatePayroll(baseSalary, deductions, npsOptions);
    const netWithBenefits = payrollCalculation.netPay + totalBenefits;
    const calculation = {
      ...payrollCalculation,
      baseSalary: Math.round(baseSalary * 100) / 100,
      totalBenefits: Math.round(totalBenefits * 100) / 100,
      grossSalary: Math.round(payrollCalculation.grossSalary * 100) / 100,
      netPay: Math.round(netWithBenefits * 100) / 100
    };

    return NextResponse.json({
      calculation,
      deductions
    });

  } catch (error) {
    console.error('Error calculating employee salary:', error);
    return NextResponse.json(
      { error: 'Failed to calculate salary', details: error.message },
      { status: 500 }
    );
  }
}


