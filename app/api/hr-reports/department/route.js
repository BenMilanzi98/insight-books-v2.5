import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

/**
 * GET - Generate department report
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

    // Get departments
    const departmentWhere = {
      tenantId: user.tenantId
    };

    if (departmentId) {
      departmentWhere.id = departmentId;
    }

    const departments = await prisma.department.findMany({
      where: departmentWhere,
      include: {
        employees: {
          include: {
            payrolls: {
              orderBy: {
                periodEnd: 'desc'
              },
              take: 1,
              select: {
                grossPay: true,
                netPay: true,
                periodEnd: true
              }
            },
            attendanceRecords: {
              where: {
                date: {
                  gte: new Date(new Date().setMonth(new Date().getMonth() - 1))
                }
              },
              select: {
                status: true,
                hoursWorked: true
              },
              take: 100 // Limit attendance records per employee to prevent memory issues
            }
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    // Calculate department statistics
    const departmentReports = departments.map(department => {
      const employees = department.employees || [];
      const activeEmployees = employees.filter(e => e.isActive);
      
      const totalSalary = employees.reduce((sum, e) => {
        const latestPayroll = e.payrolls[0];
        return sum + (latestPayroll?.grossPay || e.salary || e.grossSalary || 0);
      }, 0);

      const totalNetPay = employees.reduce((sum, e) => {
        const latestPayroll = e.payrolls[0];
        return sum + (latestPayroll?.netPay || 0);
      }, 0);

      // Calculate attendance stats for the department
      const attendanceStats = employees.reduce((stats, employee) => {
        employee.attendanceRecords.forEach(record => {
          stats.totalHours += record.hoursWorked || 0;
          if (record.status === 'Present') stats.presentDays++;
          else if (record.status === 'Absent') stats.absentDays++;
        });
        return stats;
      }, {
        presentDays: 0,
        absentDays: 0,
        totalHours: 0
      });

      return {
        id: department.id,
        name: department.name,
        description: department.description,
        color: department.color,
        employeeCount: employees.length,
        activeEmployeeCount: activeEmployees.length,
        totalSalary,
        totalNetPay,
        averageSalary: employees.length > 0 ? totalSalary / employees.length : 0,
        attendanceStats,
        employees: employees.map(e => ({
          id: e.id,
          employeeId: e.employeeId,
          name: e.name,
          jobTitle: e.jobTitle || e.position,
          isActive: e.isActive,
          salary: e.salary || e.grossSalary || 0,
          latestPayroll: e.payrolls[0] || null
        }))
      };
    });

    // Overall summary
    const summary = {
      totalDepartments: departments.length,
      totalEmployees: departments.reduce((sum, d) => sum + (d.employees?.length || 0), 0),
      totalActiveEmployees: departments.reduce((sum, d) => 
        sum + (d.employees?.filter(e => e.isActive).length || 0), 0),
      totalSalaryExpense: departments.reduce((sum, d) => {
        const deptTotal = (d.employees || []).reduce((empSum, e) => {
          const latestPayroll = e.payrolls?.[0];
          return empSum + (latestPayroll?.grossPay || e.salary || e.grossSalary || 0);
        }, 0);
        return sum + deptTotal;
      }, 0)
    };

    const report = {
      generatedAt: new Date(),
      summary,
      departments: departmentReports
    };

    if (format === 'json') {
      return NextResponse.json(report);
    }

    // For PDF/Excel, return JSON for now (can be enhanced later)
    return NextResponse.json(report);

  } catch (error) {
    console.error('Error generating department report:', error);
    return NextResponse.json(
      { error: 'Failed to generate department report', details: error.message },
      { status: 500 }
    );
  }
}

