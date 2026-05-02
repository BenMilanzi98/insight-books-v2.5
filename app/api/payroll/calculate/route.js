// app/api/payroll/calculate/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { calculatePayroll, toPayrollNumber, deductionRowForCalculation } from '@/lib/payrollCalculations';

/**
 * POST handler for calculating payroll
 * Calculates payroll with PAYE, NPS, and custom deductions
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
    const { grossSalary, deductionIds = [], customDeductions = [] } = body;

    const grossNum = toPayrollNumber(grossSalary);
    if (grossNum == null || grossNum <= 0) {
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

    // Combine database deductions with custom deductions
    const allDeductions = [
      ...deductions.map(d => deductionRowForCalculation(d)),
      ...customDeductions
    ];

    // Fetch tenant NPS rates so preview uses configured rates (employee % / employer %)
    let npsEmployeeRatePercent = null;
    let npsEmployerRatePercent = null;
    try {
      const rows = await prisma.$queryRaw`
        SELECT "npsEmployeeRatePercent", "npsEmployerRatePercent"
        FROM "TenantSettings"
        WHERE "tenantId" = ${user.tenantId}
        LIMIT 1
      `;
      const row = Array.isArray(rows) ? rows[0] : null;
      if (row && typeof row === 'object') {
        const empRaw = row.npsEmployeeRatePercent ?? row.npsemployeeratepercent ?? null;
        const erRaw = row.npsEmployerRatePercent ?? row.npsemployerratepercent ?? null;
        const emp = empRaw === null || empRaw === undefined ? null : Number(empRaw);
        const er = erRaw === null || erRaw === undefined ? null : Number(erRaw);
        npsEmployeeRatePercent = Number.isFinite(emp) ? emp : null;
        npsEmployerRatePercent = Number.isFinite(er) ? er : null;
      }
    } catch (_) {
      // use nulls (treated as 0% by calculation)
    }

    const payrollCalculation = calculatePayroll(grossNum, allDeductions, {
      npsEmployeeRatePercent,
      npsEmployerRatePercent
    });

    return NextResponse.json({
      calculation: payrollCalculation,
      deductions: allDeductions
    });

  } catch (error) {
    console.error('Error calculating payroll:', error);
    return NextResponse.json(
      { error: 'Failed to calculate payroll', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET handler for fetching available deductions
 * Returns all active deductions for the tenant
 */
export async function GET(request) {
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

    // Fetch active deductions
    const deductions = await prisma.deduction.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true
      },
      orderBy: [
        { isStatutory: 'desc' },
        { name: 'asc' }
      ]
    });

    return NextResponse.json({
      deductions: deductions
    });

  } catch (error) {
    console.error('Error fetching deductions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deductions', details: error.message },
      { status: 500 }
    );
  }
}


