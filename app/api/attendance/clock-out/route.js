// app/api/attendance/clock-out/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

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

    // Calculate hours worked
    const clockInTime = attendanceRecord.clockIn;
    const hoursWorked = (clockOutDateTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

    // Calculate overtime (assuming 8 hours is standard work day)
    const standardHours = 8;
    const overtimeHours = Math.max(0, hoursWorked - standardHours);

    // Update attendance record
    const updatedRecord = await prisma.attendanceRecord.update({
      where: { id: attendanceRecord.id },
      data: {
        clockOut: clockOutDateTime,
        hoursWorked: Math.round(hoursWorked * 100) / 100,
        overtimeHours: Math.round(overtimeHours * 100) / 100,
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


