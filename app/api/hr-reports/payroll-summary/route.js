import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { npsRatesFromTenantSettingsRow } from '@/lib/npsTenantRates';
import { getPayrollStatutoryBreakdown } from '@/lib/payrollStatutoryBreakdown';

function signedPayrollAmount(payroll, value) {
  const amount = Number(value) || 0;
  return payroll.status === 'Reversed' ? -amount : amount;
}

/**
 * GET - Generate payroll summary report
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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const employeeId = searchParams.get('employeeId');
    const format = (searchParams.get('format') || 'json').toLowerCase();

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Build filter conditions
    const whereClause = {
      tenantId: user.tenantId,
      periodStart: {
        gte: start
      },
      periodEnd: {
        lte: end
      }
    };
    
    // Add employee filter if provided
    if (employeeId) {
      whereClause.employeeId = employeeId;
    }

    // Get payrolls for the period
    const payrolls = await prisma.payroll.findMany({
      where: whereClause,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            department: true,
            jobTitle: true,
            departmentRef: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        periodEnd: 'desc'
      }
    });

    if (payrolls.length === 0) {
      // Return empty report instead of error for better UX
      return NextResponse.json({
        period: {
          start: startDate,
          end: endDate,
          generatedAt: new Date()
        },
        summary: {
          totalEmployees: 0,
          totalPayrolls: 0,
          totalBasicSalary: 0,
          totalAdditions: 0,
          totalGrossPay: 0,
          totalDeductions: 0,
          totalPAYE: 0,
          totalNPSEmployee: 0,
          totalNPSEmployer: 0,
          totalNetPay: 0
        },
        departmentBreakdown: [],
        employeePayrolls: [],
        allPayrolls: [],
        message: 'No payroll records found for the specified period'
      });
    }

    let npsOptions = { npsEmployeeRatePercent: null, npsEmployerRatePercent: null };
    try {
      const rows = await prisma.$queryRaw`
        SELECT "npsEmployeeRatePercent", "npsEmployerRatePercent"
        FROM "TenantSettings"
        WHERE "tenantId" = ${user.tenantId}
        LIMIT 1
      `;
      const row = Array.isArray(rows) ? rows[0] : null;
      if (row) npsOptions = npsRatesFromTenantSettingsRow(row);
    } catch (e) {
      console.warn('Payroll summary NPS rate read failed:', e?.message || e);
    }

    const statutoryByPayrollId = new Map(
      payrolls.map((payroll) => [
        payroll.id,
        getPayrollStatutoryBreakdown(payroll, { ...npsOptions, signed: true }),
      ]),
    );

    // Calculate summary
    const summary = {
      totalEmployees: new Set(payrolls.map(p => p.employeeId)).size,
      totalPayrolls: payrolls.length,
      totalBasicSalary: payrolls.reduce((sum, p) => sum + signedPayrollAmount(p, p.basicSalary), 0),
      totalAdditions: payrolls.reduce((sum, p) => sum + signedPayrollAmount(p, p.additions), 0),
      totalGrossPay: payrolls.reduce((sum, p) => sum + signedPayrollAmount(p, p.grossPay), 0),
      totalDeductions: payrolls.reduce((sum, p) => sum + signedPayrollAmount(p, p.deductions), 0),
      totalPAYE: payrolls.reduce((sum, p) => sum + (statutoryByPayrollId.get(p.id)?.payeAmount || 0), 0),
      totalNPSEmployee: payrolls.reduce((sum, p) => sum + (statutoryByPayrollId.get(p.id)?.npsEmployeeAmount || 0), 0),
      totalNPSEmployer: payrolls.reduce((sum, p) => sum + (statutoryByPayrollId.get(p.id)?.npsEmployerAmount || 0), 0),
      totalNetPay: payrolls.reduce((sum, p) => sum + signedPayrollAmount(p, p.netPay), 0)
    };

    // Group by employee
    const employeePayrolls = {};
    payrolls.forEach(payroll => {
      const empId = payroll.employeeId;
      if (!employeePayrolls[empId]) {
        employeePayrolls[empId] = {
          employee: payroll.employee,
          payrolls: [],
          totals: {
            basicSalary: 0,
            additions: 0,
            grossPay: 0,
            deductions: 0,
            netPay: 0
          }
        };
      }
      employeePayrolls[empId].payrolls.push({
        id: payroll.id,
        periodStart: payroll.periodStart,
        periodEnd: payroll.periodEnd,
        basicSalary: signedPayrollAmount(payroll, payroll.basicSalary),
        additions: signedPayrollAmount(payroll, payroll.additions),
        grossPay: signedPayrollAmount(payroll, payroll.grossPay),
        deductions: signedPayrollAmount(payroll, payroll.deductions),
        payeAmount: statutoryByPayrollId.get(payroll.id)?.payeAmount || 0,
        npsEmployeeAmount: statutoryByPayrollId.get(payroll.id)?.npsEmployeeAmount || 0,
        npsEmployerAmount: statutoryByPayrollId.get(payroll.id)?.npsEmployerAmount || 0,
        netPay: signedPayrollAmount(payroll, payroll.netPay),
        status: payroll.status
      });
      employeePayrolls[empId].totals.basicSalary += signedPayrollAmount(payroll, payroll.basicSalary);
      employeePayrolls[empId].totals.additions += signedPayrollAmount(payroll, payroll.additions);
      employeePayrolls[empId].totals.grossPay += signedPayrollAmount(payroll, payroll.grossPay);
      employeePayrolls[empId].totals.deductions += signedPayrollAmount(payroll, payroll.deductions);
      employeePayrolls[empId].totals.netPay += signedPayrollAmount(payroll, payroll.netPay);
    });

    // Group by department
    const departmentBreakdown = {};
    payrolls.forEach(payroll => {
      const deptName = payroll.employee.department || payroll.employee.departmentRef?.name || 'Unassigned';
      if (!departmentBreakdown[deptName]) {
        departmentBreakdown[deptName] = {
          name: deptName,
          employeeCount: 0,
          totalGrossPay: 0,
          totalNetPay: 0,
          totalDeductions: 0
        };
      }
      departmentBreakdown[deptName].totalGrossPay += signedPayrollAmount(payroll, payroll.grossPay);
      departmentBreakdown[deptName].totalNetPay += signedPayrollAmount(payroll, payroll.netPay);
      departmentBreakdown[deptName].totalDeductions += signedPayrollAmount(payroll, payroll.deductions);
    });

    // Count unique employees per department
    Object.keys(departmentBreakdown).forEach(deptName => {
      const deptEmployees = new Set(
        payrolls
          .filter(p => (p.employee.department || p.employee.departmentRef?.name || 'Unassigned') === deptName)
          .map(p => p.employeeId)
      );
      departmentBreakdown[deptName].employeeCount = deptEmployees.size;
    });

    const report = {
      period: {
        start: startDate,
        end: endDate,
        generatedAt: new Date()
      },
      summary,
      departmentBreakdown: Object.values(departmentBreakdown),
      employeePayrolls: Object.values(employeePayrolls),
      allPayrolls: payrolls.map(p => ({
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        employee: {
          id: p.employee.id,
          name: p.employee.name,
          employeeId: p.employee.employeeId,
          department: p.employee.department || p.employee.departmentRef?.name
        },
        basicSalary: signedPayrollAmount(p, p.basicSalary),
        additions: signedPayrollAmount(p, p.additions),
        grossPay: signedPayrollAmount(p, p.grossPay),
        deductions: signedPayrollAmount(p, p.deductions),
        payeAmount: statutoryByPayrollId.get(p.id)?.payeAmount || 0,
        npsEmployeeAmount: statutoryByPayrollId.get(p.id)?.npsEmployeeAmount || 0,
        npsEmployerAmount: statutoryByPayrollId.get(p.id)?.npsEmployerAmount || 0,
        netPay: signedPayrollAmount(p, p.netPay),
        status: p.status
      }))
    };

    if (format === 'json') {
      return NextResponse.json(report);
    }

    // For PDF/Excel, return JSON for now (can be enhanced later)
    return NextResponse.json(report);

  } catch (error) {
    console.error('Error generating payroll summary report:', error);
    return NextResponse.json(
      { error: 'Failed to generate payroll summary report', details: error.message },
      { status: 500 }
    );
  }
}

