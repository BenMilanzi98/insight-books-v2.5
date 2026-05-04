import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { isAttendanceStatus, roundHrNumber } from '@/lib/hrCalculations';

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

    // Get attendance records with employee info for detailed report
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
      },
      take: 100000 // Large cap; period filter already scopes rows
    });

    // Filter by department if specified
    let filteredRecords = attendanceRecords;
    if (departmentId) {
      filteredRecords = attendanceRecords.filter(record =>
        record.employee.departmentRef?.id === departmentId ||
        record.employee.departmentId === departmentId
      );
    }

    const summary = filteredRecords.reduce(
      (stats, record) => {
        stats.totalRecords++;
        stats.totalHoursWorked = roundHrNumber(stats.totalHoursWorked + (record.hoursWorked || 0));
        stats.totalOvertimeHours = roundHrNumber(stats.totalOvertimeHours + (record.overtimeHours || 0));
        if (isAttendanceStatus(record.status, 'present')) stats.presentCount++;
        else if (isAttendanceStatus(record.status, 'absent')) stats.absentCount++;
        else if (isAttendanceStatus(record.status, 'late')) stats.lateCount++;
        else if (isAttendanceStatus(record.status, 'leave')) stats.leaveCount++;
        return stats;
      },
      {
        totalRecords: 0,
        totalHoursWorked: 0,
        totalOvertimeHours: 0,
        totalPaidHours: 0,
        presentCount: 0,
        absentCount: 0,
        lateCount: 0,
        leaveCount: 0
      }
    );
    summary.totalPaidHours = roundHrNumber(summary.totalHoursWorked + summary.totalOvertimeHours);

    // Group by employee using database queries for better performance
    const employeeIds = [...new Set(filteredRecords.map(r => r.employeeId))];
    const employeeStats = {};

    for (const empId of employeeIds) {
      const empRecords = filteredRecords.filter(r => r.employeeId === empId);
      if (empRecords.length === 0) continue;

      const employee = empRecords[0].employee;
      const empStats = {
        totalDays: empRecords.length,
        presentDays: empRecords.filter(r => isAttendanceStatus(r.status, 'present')).length,
        absentDays: empRecords.filter(r => isAttendanceStatus(r.status, 'absent')).length,
        lateDays: empRecords.filter(r => isAttendanceStatus(r.status, 'late')).length,
        leaveDays: empRecords.filter(r => isAttendanceStatus(r.status, 'leave')).length,
        totalHours: roundHrNumber(empRecords.reduce((sum, r) => sum + (r.hoursWorked || 0), 0)),
        totalOvertime: roundHrNumber(empRecords.reduce((sum, r) => sum + (r.overtimeHours || 0), 0)),
        totalPaidHours: roundHrNumber(empRecords.reduce((sum, r) => sum + (r.hoursWorked || 0) + (r.overtimeHours || 0), 0))
      };

      employeeStats[empId] = {
        employee,
        ...empStats
      };
    }

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

