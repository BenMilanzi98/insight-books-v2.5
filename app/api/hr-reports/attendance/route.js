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

    // Build base where clause for aggregations
    const baseWhere = { ...where };

    // Get summary statistics using database aggregation
    const [presentCount, absentCount, lateCount, leaveCount, totalRecords, totalHoursWorked, totalOvertimeHours] = await Promise.all([
      prisma.attendanceRecord.count({ where: { ...baseWhere, status: 'Present' } }),
      prisma.attendanceRecord.count({ where: { ...baseWhere, status: 'Absent' } }),
      prisma.attendanceRecord.count({ where: { ...baseWhere, status: 'Late' } }),
      prisma.attendanceRecord.count({ where: { ...baseWhere, status: 'Leave' } }),
      prisma.attendanceRecord.count({ where: baseWhere }),
      prisma.attendanceRecord.aggregate({
        where: baseWhere,
        _sum: { hoursWorked: true }
      }).then(result => result._sum.hoursWorked || 0),
      prisma.attendanceRecord.aggregate({
        where: baseWhere,
        _sum: { overtimeHours: true }
      }).then(result => result._sum.overtimeHours || 0)
    ]);

    // Calculate summary statistics
    const summary = {
      totalRecords,
      totalHoursWorked,
      totalOvertimeHours,
      presentCount,
      absentCount,
      lateCount,
      leaveCount
    };

    // Get attendance records with employee info for detailed report
    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: baseWhere,
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
      take: 1000 // Limit to prevent memory issues
    });

    // Filter by department if specified
    let filteredRecords = attendanceRecords;
    if (departmentId) {
      filteredRecords = attendanceRecords.filter(record =>
        record.employee.departmentRef?.id === departmentId ||
        record.employee.departmentId === departmentId
      );
    }

    // Group by employee using database queries for better performance
    const employeeIds = [...new Set(filteredRecords.map(r => r.employeeId))];
    const employeeStats = {};

    for (const empId of employeeIds) {
      const empRecords = filteredRecords.filter(r => r.employeeId === empId);
      if (empRecords.length === 0) continue;

      const employee = empRecords[0].employee;
      const empStats = {
        totalDays: empRecords.length,
        presentDays: empRecords.filter(r => r.status === 'Present').length,
        absentDays: empRecords.filter(r => r.status === 'Absent').length,
        lateDays: empRecords.filter(r => r.status === 'Late').length,
        leaveDays: empRecords.filter(r => r.status === 'Leave').length,
        totalHours: empRecords.reduce((sum, r) => sum + (r.hoursWorked || 0), 0),
        totalOvertime: empRecords.reduce((sum, r) => sum + (r.overtimeHours || 0), 0)
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

