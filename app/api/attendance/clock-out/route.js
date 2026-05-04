// app/api/attendance/clock-out/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { calculateAttendanceHours } from '@/lib/hrCalculations';

/**
 * POST - Clock out an employee
 */
export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const data = await request.json();
    const { employeeId, clockOutTime, notes } = data;

    if (!employeeId) {
      return NextResponse.json(
        { error: 'Employee ID is required' },
        { status: 400 }
      );
    }

    // Verify employee exists
    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        tenantId: user.tenantId,
        isActive: true
      }
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found or inactive' },
        { status: 404 }
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find today's attendance record
    const attendanceRecord = await prisma.attendanceRecord.findFirst({
      where: {
        employeeId,
        date: {
          gte: today,
          lt: tomorrow
        }
      }
    });

    if (!attendanceRecord) {
      return NextResponse.json(
        { error: 'No clock in record found for today' },
        { status: 400 }
      );
    }

    if (attendanceRecord.clockOut) {
      return NextResponse.json(
        { error: 'Employee has already clocked out today' },
        { status: 400 }
      );
    }

    const clockOutDateTime = clockOutTime ? new Date(clockOutTime) : new Date();

    const clockInTime = attendanceRecord.clockIn;
    if (!clockInTime) {
      return NextResponse.json(
        { error: 'No clock in time found for today' },
        { status: 400 }
      );
    }

    let attendanceHours;
    try {
      attendanceHours = calculateAttendanceHours(clockInTime, clockOutDateTime);
    } catch (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Update attendance record
    const updatedRecord = await prisma.attendanceRecord.update({
      where: { id: attendanceRecord.id },
      data: {
        clockOut: clockOutDateTime,
        hoursWorked: attendanceHours.hoursWorked,
        overtimeHours: attendanceHours.overtimeHours,
        notes: notes || attendanceRecord.notes
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            jobTitle: true
          }
        }
      }
    });

    return NextResponse.json({
      message: 'Clock out recorded successfully',
      attendanceRecord: updatedRecord
    });

  } catch (error) {
    console.error('Error recording clock out:', error);
    return NextResponse.json(
      { error: 'Failed to record clock out', details: error.message },
      { status: 500 }
    );
  }
}


