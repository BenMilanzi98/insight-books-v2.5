import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

/**
 * GET - Generate employee summary report
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
    const departmentId = searchParams.get('departmentId');
    const format = (searchParams.get('format') || 'json').toLowerCase();

    // Build where clause
    const where = {
      tenantId: user.tenantId
    };

    if (departmentId) {
      where.departmentId = departmentId;
    }

    // Get employees with pagination to prevent memory issues
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '100', 10); // Default 100 employees per page
    const skip = (page - 1) * limit;

    const [employees, totalCount] = await Promise.all([
      prisma.employee.findMany({
        where,
        include: {
          departmentRef: {
            select: {
              id: true,
              name: true,
              color: true
            }
          },
          payrolls: {
            orderBy: {
              periodEnd: 'desc'
            },
            take: 12, // Last 12 payrolls
            select: {
              id: true,
              periodStart: true,
              periodEnd: true,
              grossPay: true,
              netPay: true,
              status: true
            }
          },
          attendanceRecords: {
            orderBy: {
              date: 'desc'
            },
            take: 30, // Last 30 attendance records
            select: {
              date: true,
              status: true,
              hoursWorked: true,
              overtimeHours: true
            }
          }
        },
        orderBy: {
          name: 'asc'
        },
        skip,
        take: limit
      }),
      prisma.employee.count({ where })
    ]);

    // Calculate statistics for each employee
    const employeeSummaries = employees.map(employee => {
      const totalPayrolls = employee.payrolls.length;
      const totalGrossPay = employee.payrolls.reduce((sum, p) => sum + (p.grossPay || 0), 0);
      const totalNetPay = employee.payrolls.reduce((sum, p) => sum + (p.netPay || 0), 0);
      const averageNetPay = totalPayrolls > 0 ? totalNetPay / totalPayrolls : 0;

      const attendanceStats = employee.attendanceRecords.reduce((stats, record) => {
        stats.totalDays++;
        stats.totalHours += record.hoursWorked || 0;
        stats.totalOvertime += record.overtimeHours || 0;
        if (record.status === 'Present') stats.presentDays++;
        else if (record.status === 'Absent') stats.absentDays++;
        else if (record.status === 'Late') stats.lateDays++;
        return stats;
      }, {
        totalDays: 0,
        presentDays: 0,
        absentDays: 0,
        lateDays: 0,
        totalHours: 0,
        totalOvertime: 0
      });

      return {
        id: employee.id,
        employeeId: employee.employeeId,
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
        department: employee.department || employee.departmentRef?.name || 'N/A',
        jobTitle: employee.jobTitle || employee.position || 'N/A',
        employmentType: employee.employmentType || 'N/A',
        startDate: employee.startDate,
        isActive: employee.isActive,
        salary: employee.salary || employee.grossSalary || 0,
        payrollStatistics: {
          totalPayrolls,
          totalGrossPay,
          totalNetPay,
          averageNetPay
        },
        attendanceStatistics: attendanceStats,
        latestPayroll: employee.payrolls[0] || null
      };
    });

    // Calculate overall statistics
    const summary = {
      totalEmployees: employees.length,
      activeEmployees: employees.filter(e => e.isActive).length,
      inactiveEmployees: employees.filter(e => !e.isActive).length,
      totalDepartments: new Set(employees.map(e => e.department || e.departmentRef?.name).filter(Boolean)).size,
      totalSalaryExpense: employees.reduce((sum, e) => sum + (e.salary || e.grossSalary || 0), 0),
      averageSalary: employees.length > 0 
        ? employees.reduce((sum, e) => sum + (e.salary || e.grossSalary || 0), 0) / employees.length 
        : 0
    };

    // Group by department
    const departmentBreakdown = {};
    employees.forEach(employee => {
      const deptName = employee.department || employee.departmentRef?.name || 'Unassigned';
      if (!departmentBreakdown[deptName]) {
        departmentBreakdown[deptName] = {
          name: deptName,
          employeeCount: 0,
          totalSalary: 0,
          employees: []
        };
      }
      departmentBreakdown[deptName].employeeCount++;
      departmentBreakdown[deptName].totalSalary += employee.salary || employee.grossSalary || 0;
      departmentBreakdown[deptName].employees.push({
        id: employee.id,
        name: employee.name,
        employeeId: employee.employeeId
      });
    });

    const report = {
      generatedAt: new Date(),
      summary,
      departmentBreakdown: Object.values(departmentBreakdown),
      employees: employeeSummaries,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    };

    if (format === 'json') {
      return NextResponse.json(report);
    }

    // For PDF/Excel, return JSON for now (can be enhanced later)
    return NextResponse.json(report);

  } catch (error) {
    console.error('Error generating employee summary report:', error);
    return NextResponse.json(
      { error: 'Failed to generate employee summary report', details: error.message },
      { status: 500 }
    );
  }
}

