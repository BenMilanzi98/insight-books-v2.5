// app/api/attendance/clock-in/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

/**
 * POST - Clock in an employee
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
    const { employeeId, clockInTime, notes } = data;

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

    // Check if employee has already clocked in today
    const existingRecord = await prisma.attendanceRecord.findFirst({
      where: {
        employeeId,
        date: {
          gte: today,
          lt: tomorrow
        }
      }
    });

    if (existingRecord && existingRecord.clockIn) {
      return NextResponse.json(
        { error: 'Employee has already clocked in today' },
        { status: 400 }
      );
    }

    const clockInDateTime = clockInTime ? new Date(clockInTime) : new Date();

    // Create or update attendance record
    let attendanceRecord;
    if (existingRecord) {
      attendanceRecord = await prisma.attendanceRecord.update({
        where: { id: existingRecord.id },
        data: {
          clockIn: clockInDateTime,
          status: 'present',
          notes: notes || existingRecord.notes
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
    } else {
      attendanceRecord = await prisma.attendanceRecord.create({
        data: {
          employeeId,
          date: today,
          clockIn: clockInDateTime,
          status: 'present',
          notes: notes || null,
          tenantId: user.tenantId
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
    }

    return NextResponse.json({
      message: 'Clock in recorded successfully',
      attendanceRecord
    }, { status: 201 });

  } catch (error) {
    console.error('Error recording clock in:', error);
    return NextResponse.json(
      { error: 'Failed to record clock in', details: error.message },
      { status: 500 }
    );
  }
}


