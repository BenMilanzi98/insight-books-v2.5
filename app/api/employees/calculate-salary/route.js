// app/api/employees/calculate-salary/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { calculatePayroll, toPayrollNumber } from '@/lib/payrollCalculations';
import { npsRatesFromTenantSettingsRow } from '@/lib/npsTenantRates';
import { resolveEmployeeCompensation } from '@/lib/resolveEmployeeCompensation';
import { addMoney, roundMoney } from '@/lib/money';

/**
 * POST handler for salary calculation during employee creation / edit.
 * When employeeId is provided, gross defaults from the EmploymentContract
 * effective for asOf (or periodEnd), falling back to Employee fields.
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
    const {
      grossSalary,
      deductionIds = [],
      employmentType = 'Permanent',
      benefits = [],
      employeeId = null,
      asOf = null,
      periodEnd = null,
    } = body;

    let compensation = null;
    if (employeeId) {
      compensation = await resolveEmployeeCompensation({
        tenantId: user.tenantId,
        employeeId,
        asOf: periodEnd || asOf || new Date(),
      });
    }

    const baseSalary =
      toPayrollNumber(grossSalary) ??
      (compensation ? compensation.basicSalary : null);
    if (baseSalary == null || baseSalary <= 0) {
      return NextResponse.json(
        { error: 'Gross salary must be a positive number' },
        { status: 400 }
      );
    }

    // Benefits are added to **net** after PAYE / NPS / other deductions (not in PAYE gross).
    const totalBenefits = Array.isArray(benefits)
      ? benefits.reduce((sum, b) => sum + (toPayrollNumber(b?.amount) ?? 0), 0)
      : 0;

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

    const payrollCalculation = calculatePayroll(baseSalary, deductions, npsOptions);
    const netWithBenefits = roundMoney(addMoney(payrollCalculation.netPay, totalBenefits));
    const calculation = {
      ...payrollCalculation,
      baseSalary: roundMoney(baseSalary),
      totalBenefits: roundMoney(totalBenefits),
      grossSalary: roundMoney(payrollCalculation.grossSalary),
      netPay: netWithBenefits,
      compensationSource: compensation?.source || 'request',
      contractId: compensation?.contractId || null,
      contractVersion: compensation?.contractVersion || null,
      payBasis: compensation?.payBasis || null,
    };

    return NextResponse.json({
      calculation,
      deductions,
      compensation,
    });

  } catch (error) {
    console.error('Error calculating employee salary:', error);
    return NextResponse.json(
      { error: 'Failed to calculate salary', details: error.message },
      { status: 500 }
    );
  }
}


