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

    const updateData = {};
    
    if (parsedDate) {
      updateData.date = parsedDate;
    }
    
    if (body.hoursWorked !== undefined) {
      updateData.hoursWorked = Number(body.hoursWorked);
    }
    
    if (body.overtimeHours !== undefined) {
      updateData.overtimeHours = Number(body.overtimeHours);
    }
    
    if (body.status !== undefined) {
      updateData.status = body.status;
    }
    
    if (body.notes !== undefined) {
      updateData.notes = body.notes || null;
    }
    
    if (body.clockIn !== undefined) {
      updateData.clockIn = body.clockIn ? new Date(body.clockIn) : null;
    }
    
    if (body.clockOut !== undefined) {
      updateData.clockOut = body.clockOut ? new Date(body.clockOut) : null;
    }

    const record = await prisma.attendanceRecord.update({
      where: { id },
      data: updateData
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



