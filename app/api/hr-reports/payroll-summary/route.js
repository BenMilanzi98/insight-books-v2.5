import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

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

    // Calculate summary
    const summary = {
      totalEmployees: new Set(payrolls.map(p => p.employeeId)).size,
      totalPayrolls: payrolls.length,
      totalBasicSalary: payrolls.reduce((sum, p) => sum + (p.basicSalary || 0), 0),
      totalAdditions: payrolls.reduce((sum, p) => sum + (p.additions || 0), 0),
      totalGrossPay: payrolls.reduce((sum, p) => sum + (p.grossPay || 0), 0),
      totalDeductions: payrolls.reduce((sum, p) => sum + (p.deductions || 0), 0),
      totalPAYE: payrolls.reduce((sum, p) => sum + (p.payeAmount || 0), 0),
      totalNPSEmployee: payrolls.reduce((sum, p) => sum + (p.npsEmployeeAmount || 0), 0),
      totalNPSEmployer: payrolls.reduce((sum, p) => sum + (p.npsEmployerAmount || 0), 0),
      totalNetPay: payrolls.reduce((sum, p) => sum + (p.netPay || 0), 0)
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
        periodStart: payroll.periodStart,
        periodEnd: payroll.periodEnd,
        basicSalary: payroll.basicSalary,
        additions: payroll.additions,
        grossPay: payroll.grossPay,
        deductions: payroll.deductions,
        netPay: payroll.netPay,
        status: payroll.status
      });
      employeePayrolls[empId].totals.basicSalary += payroll.basicSalary || 0;
      employeePayrolls[empId].totals.additions += payroll.additions || 0;
      employeePayrolls[empId].totals.grossPay += payroll.grossPay || 0;
      employeePayrolls[empId].totals.deductions += payroll.deductions || 0;
      employeePayrolls[empId].totals.netPay += payroll.netPay || 0;
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
      departmentBreakdown[deptName].totalGrossPay += payroll.grossPay || 0;
      departmentBreakdown[deptName].totalNetPay += payroll.netPay || 0;
      departmentBreakdown[deptName].totalDeductions += payroll.deductions || 0;
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
        basicSalary: p.basicSalary,
        additions: p.additions,
        grossPay: p.grossPay,
        deductions: p.deductions,
        netPay: p.netPay,
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

