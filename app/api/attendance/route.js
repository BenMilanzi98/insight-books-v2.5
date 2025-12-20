// app/api/attendance/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

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
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const skip = (page - 1) * limit;

    const where = {
      tenantId: user.tenantId
    };

    if (fromDate || toDate) {
      where.date = {};
      if (fromDate) where.date.gte = new Date(fromDate);
      if (toDate) where.date.lte = new Date(toDate);
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
      notes
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

    const record = await prisma.attendanceRecord.create({
      data: {
        employeeId,
        tenantId: user.tenantId,
        date: parsedDate,
        hoursWorked: Number(hoursWorked) || 0,
        overtimeHours: Number(overtimeHours) || 0,
        status,
        notes: notes || null
      }
    });

    return NextResponse.json({ attendance: record }, { status: 201 });
  } catch (error) {
    console.error('Error creating attendance:', error);
    return NextResponse.json(
      { error: 'Failed to create attendance' },
      { status: 500 }
    );
  }
}
