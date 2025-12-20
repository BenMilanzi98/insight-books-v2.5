// app/api/attendance/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// PUT - Update an attendance record
export async function PUT(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = params;
    const body = await request.json();

    // Parse date correctly to avoid timezone issues
    let parsedDate;
    if (body.date) {
      if (body.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Date is in YYYY-MM-DD format, create in local timezone
        const [year, month, day] = body.date.split('-').map(Number);
        parsedDate = new Date(year, month - 1, day, 12, 0, 0, 0); // Use noon to avoid timezone edge cases
      } else {
        // Fallback to original behavior
        parsedDate = new Date(body.date);
      }
    }

    const record = await prisma.attendanceRecord.update({
      where: { id },
      data: {
        date: parsedDate,
        hoursWorked: body.hoursWorked !== undefined ? Number(body.hoursWorked) : undefined,
        overtimeHours: body.overtimeHours !== undefined ? Number(body.overtimeHours) : undefined,
        status: body.status,
        notes: body.notes
      }
    });

    return NextResponse.json({ attendance: record });
  } catch (error) {
    console.error('Error updating attendance:', error);
    return NextResponse.json(
      { error: 'Failed to update attendance' },
      { status: 500 }
    );
  }
}

// DELETE - Delete an attendance record
export async function DELETE(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = params;

    await prisma.attendanceRecord.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting attendance:', error);
    return NextResponse.json(
      { error: 'Failed to delete attendance' },
      { status: 500 }
    );
  }
}



