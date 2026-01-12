import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

/**
 * GET - Generate attendance report
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
    const departmentId = searchParams.get('departmentId');
    const format = (searchParams.get('format') || 'json').toLowerCase();

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Include the entire end date

    // Build where clause
    const where = {
      tenantId: user.tenantId,
      date: {
        gte: start,
        lte: end
      }
    };

    if (employeeId) {
      where.employeeId = employeeId;
    }

    // Get attendance records
    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where,
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
        date: 'desc'
      }
    });

    // Filter by department if specified
    let filteredRecords = attendanceRecords;
    if (departmentId) {
      filteredRecords = attendanceRecords.filter(record => 
        record.employee.departmentRef?.id === departmentId || 
        record.employee.departmentId === departmentId
      );
    }

    // Calculate summary statistics
    const summary = {
      totalRecords: filteredRecords.length,
      totalHoursWorked: filteredRecords.reduce((sum, r) => sum + (r.hoursWorked || 0), 0),
      totalOvertimeHours: filteredRecords.reduce((sum, r) => sum + (r.overtimeHours || 0), 0),
      presentCount: filteredRecords.filter(r => r.status === 'Present').length,
      absentCount: filteredRecords.filter(r => r.status === 'Absent').length,
      lateCount: filteredRecords.filter(r => r.status === 'Late').length,
      leaveCount: filteredRecords.filter(r => r.status === 'Leave').length
    };

    // Group by employee
    const employeeStats = {};
    filteredRecords.forEach(record => {
      const empId = record.employeeId;
      if (!employeeStats[empId]) {
        employeeStats[empId] = {
          employee: record.employee,
          totalDays: 0,
          presentDays: 0,
          absentDays: 0,
          lateDays: 0,
          leaveDays: 0,
          totalHours: 0,
          totalOvertime: 0
        };
      }
      employeeStats[empId].totalDays++;
      employeeStats[empId].totalHours += record.hoursWorked || 0;
      employeeStats[empId].totalOvertime += record.overtimeHours || 0;
      
      if (record.status === 'Present') employeeStats[empId].presentDays++;
      else if (record.status === 'Absent') employeeStats[empId].absentDays++;
      else if (record.status === 'Late') employeeStats[empId].lateDays++;
      else if (record.status === 'Leave') employeeStats[empId].leaveDays++;
    });

    const report = {
      period: {
        start: startDate,
        end: endDate,
        generatedAt: new Date()
      },
      summary,
      employeeStatistics: Object.values(employeeStats),
      detailedRecords: filteredRecords.map(record => ({
        date: record.date,
        employee: {
          id: record.employee.id,
          name: record.employee.name,
          employeeId: record.employee.employeeId,
          department: record.employee.department || record.employee.departmentRef?.name
        },
        clockIn: record.clockIn,
        clockOut: record.clockOut,
        hoursWorked: record.hoursWorked,
        overtimeHours: record.overtimeHours,
        status: record.status,
        notes: record.notes
      }))
    };

    if (format === 'json') {
      return NextResponse.json(report);
    }

    // For PDF/Excel, return JSON for now (can be enhanced later)
    return NextResponse.json(report);

  } catch (error) {
    console.error('Error generating attendance report:', error);
    return NextResponse.json(
      { error: 'Failed to generate attendance report', details: error.message },
      { status: 500 }
    );
  }
}

