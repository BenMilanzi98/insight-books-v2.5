// app/api/payroll/calculate/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { calculatePayroll } from '@/lib/payrollCalculations';

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

    // Combine database deductions with custom deductions
    const allDeductions = [
      ...deductions.map(d => ({
        id: d.id,
        name: d.name,
        type: d.type,
        value: d.value,
        isStatutory: d.isStatutory
      })),
      ...customDeductions
    ];

    // Fetch tenant NPS rates so preview uses configured rates (employee % / employer %)
    let npsEmployeeRatePercent = 5;
    let npsEmployerRatePercent = 5;
    try {
      const rows = await prisma.$queryRaw`
        SELECT "npsEmployeeRatePercent", "npsEmployerRatePercent"
        FROM "TenantSettings"
        WHERE "tenantId" = ${user.tenantId}
        LIMIT 1
      `;
      const row = Array.isArray(rows) ? rows[0] : null;
      if (row && typeof row === 'object') {
        const emp = Number(row.npsEmployeeRatePercent ?? row.npsemployeeratepercent ?? 5);
        const empEr = Number(row.npsEmployerRatePercent ?? row.npsemployerratepercent ?? 5);
        npsEmployeeRatePercent = Number.isFinite(emp) ? emp : 5;
        npsEmployerRatePercent = Number.isFinite(empEr) ? empEr : 5;
      }
    } catch (_) {
      // use defaults
    }

    const payrollCalculation = calculatePayroll(grossSalary, allDeductions, {
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


