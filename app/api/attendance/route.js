// app/api/attendance/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { calculateAttendanceHours } from '@/lib/hrCalculations';

// GET - List attendance with filters (date range, employeeId, department) and pagination
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
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const employeeId = searchParams.get('employeeId');
    const department = searchParams.get('department');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limitParam = searchParams.get('limit');
    const limit = limitParam === 'all' ? 5000 : Math.min(parseInt(limitParam || '100', 10) || 100, 5000);
    const skip = limitParam === 'all' ? 0 : (page - 1) * limit;

    const where = {
      tenantId: user.tenantId
    };

    if (fromDate || toDate) {
      where.date = {};
      if (fromDate && toDate && fromDate === toDate) {
        // If fromDate and toDate are the same, query for that specific date
        // Parse date and create range from start to end of day
        const dateStr = fromDate.match(/^\d{4}-\d{2}-\d{2}$/) ? fromDate : fromDate.split('T')[0];
        const [year, month, day] = dateStr.split('-').map(Number);
        const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
        const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
        where.date.gte = startOfDay;
        where.date.lte = endOfDay;
      } else {
        if (fromDate) {
          // Parse date and set to start of day (00:00:00) to ensure we catch all records for that date
          const dateStr = fromDate.match(/^\d{4}-\d{2}-\d{2}$/) ? fromDate : fromDate.split('T')[0];
          const [year, month, day] = dateStr.split('-').map(Number);
          where.date.gte = new Date(year, month - 1, day, 0, 0, 0, 0);
        }
        if (toDate) {
          // Parse date and set to end of day (23:59:59) to ensure we catch all records for that date
          const dateStr = toDate.match(/^\d{4}-\d{2}-\d{2}$/) ? toDate : toDate.split('T')[0];
          const [year, month, day] = dateStr.split('-').map(Number);
          where.date.lte = new Date(year, month - 1, day, 23, 59, 59, 999);
        }
      }
    }

    if (employeeId) {
      where.employeeId = employeeId;
    }

    if (department && department !== 'All') {
      where.employee = { department };
    }

    const [totalCount, records] = await Promise.all([
      prisma.attendanceRecord.count({
        where
      }),
      prisma.attendanceRecord.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
        include: {
          employee: {
            select: { id: true, name: true, employeeId: true, department: true }
          }
        }
      })
    ]);

    return NextResponse.json({
      attendance: records,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch attendance' },
      { status: 500 }
    );
  }
}

// POST - Create an attendance record
export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      employeeId,
      date,
      hoursWorked = 0,
      overtimeHours = 0,
      status = 'Present',
      notes,
      clockIn,
      clockOut
    } = body;

    if (!employeeId || !date) {
      return NextResponse.json(
        { error: 'employeeId and date are required' },
        { status: 400 }
      );
    }

    // Ensure employee belongs to tenant
    const employee = await prisma.employee.findFirst({ where: { id: employeeId, tenantId: user.tenantId } });
    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Parse date correctly to avoid timezone issues
    // If date is in YYYY-MM-DD format, create date in local timezone
    let parsedDate;
    if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Date is in YYYY-MM-DD format, create in local timezone
      const [year, month, day] = date.split('-').map(Number);
      parsedDate = new Date(year, month - 1, day, 12, 0, 0, 0); // Use noon to avoid timezone edge cases
    } else {
      // Fallback to original behavior
      parsedDate = new Date(date);
    }

    // Check if record already exists for this employee and date
    const startOfParsedDay = new Date(parsedDate);
    startOfParsedDay.setHours(0, 0, 0, 0);
    const endOfParsedDay = new Date(parsedDate);
    endOfParsedDay.setHours(23, 59, 59, 999);

    const existingRecord = await prisma.attendanceRecord.findFirst({
      where: {
        employeeId,
        tenantId: user.tenantId,
        date: {
          gte: startOfParsedDay,
          lte: endOfParsedDay
        }
      }
    });

    if (existingRecord) {
      return NextResponse.json(
        { error: 'Attendance record already exists for this employee and date. Please update the existing record instead.' },
        { status: 400 }
      );
    }

    // Parse clock in/out times
    let parsedClockIn = null;
    let parsedClockOut = null;
    
    if (clockIn) {
      try {
        parsedClockIn = new Date(clockIn);
        if (isNaN(parsedClockIn.getTime())) {
          return NextResponse.json(
            { error: 'Invalid clock in time format' },
            { status: 400 }
          );
        }
      } catch (e) {
        return NextResponse.json(
          { error: 'Invalid clock in time format' },
          { status: 400 }
        );
      }
    }

    if (clockOut) {
      try {
        parsedClockOut = new Date(clockOut);
        if (isNaN(parsedClockOut.getTime())) {
          return NextResponse.json(
            { error: 'Invalid clock out time format' },
            { status: 400 }
          );
        }
      } catch (e) {
        return NextResponse.json(
          { error: 'Invalid clock out time format' },
          { status: 400 }
        );
      }
    }

    // Calculate hours worked from clockIn/clockOut if provided and hoursWorked is 0 or not provided
    let calculatedHoursWorked = Number(hoursWorked) || 0;
    let calculatedOvertimeHours = Number(overtimeHours) || 0;
    
    if (parsedClockIn && parsedClockOut) {
      let attendanceHours;
      try {
        attendanceHours = calculateAttendanceHours(parsedClockIn, parsedClockOut);
      } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      if (calculatedHoursWorked === 0 || !hoursWorked) {
        calculatedHoursWorked = attendanceHours.hoursWorked;
        calculatedOvertimeHours = attendanceHours.overtimeHours;
      }
    }

    const record = await prisma.attendanceRecord.create({
      data: {
        employeeId,
        tenantId: user.tenantId,
        date: parsedDate,
        hoursWorked: calculatedHoursWorked,
        overtimeHours: calculatedOvertimeHours,
        status,
        notes: notes || null,
        clockIn: parsedClockIn,
        clockOut: parsedClockOut
      }
    });

    return NextResponse.json({ attendance: record }, { status: 201 });
  } catch (error) {
    console.error('Error creating attendance:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta
    });
    
    // Handle Prisma unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Attendance record already exists for this employee and date. Please update the existing record instead.' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to create attendance',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}
