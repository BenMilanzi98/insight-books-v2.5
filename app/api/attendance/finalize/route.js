// app/api/attendance/finalize/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// POST - Finalize attendance register for a date (no audit logs)
export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { date } = body;
    if (!date) {
      return NextResponse.json({ error: 'date is required' }, { status: 400 });
    }

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Disallow future dates
    if (targetDate.getTime() > today.getTime()) {
      return NextResponse.json({ error: 'Cannot finalize a future date' }, { status: 400 });
    }

    // Load active employees for tenant
    const employees = await prisma.employee.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      select: { id: true }
    });
    const totalEmployees = employees.length;
    const employeeIds = employees.map(e => e.id);

    // Find attendance records for that date (using date range to handle timezone issues)
    // Create date range that covers the entire day with timezone buffer
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);
    
    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        tenantId: user.tenantId,
        date: {
          gte: startOfDay,
          lte: endOfDay
        },
        employeeId: { in: employeeIds }
      },
      select: { employeeId: true, status: true }
    });

    // Count employees by status
    const presentRecords = attendanceRecords.filter(r => 
      r.status && r.status.toLowerCase() === 'present'
    );
    const absentRecords = attendanceRecords.filter(r => 
      r.status && r.status.toLowerCase() === 'absent'
    );
    const leaveRecords = attendanceRecords.filter(r => 
      r.status && r.status.toLowerCase() === 'leave'
    );
    const lateRecords = attendanceRecords.filter(r => 
      r.status && r.status.toLowerCase() === 'late'
    );

    const presentCount = new Set(presentRecords.map(r => r.employeeId)).size;
    const absentCount = new Set(absentRecords.map(r => r.employeeId)).size;
    const leaveCount = new Set(leaveRecords.map(r => r.employeeId)).size;
    const lateCount = new Set(lateRecords.map(r => r.employeeId)).size;

    // Check if attendance register already exists for this date
    const existingRegister = await prisma.attendanceRegister.findFirst({
      where: { tenantId: user.tenantId, date: targetDate }
    });
    if (existingRegister) {
      return NextResponse.json({ error: 'Register already finalized for this date', totals: { totalEmployees, present: presentCount, absent: absentCount, leave: leaveCount, late: lateCount } }, { status: 400 });
    }

    // Create attendance register record
    const attendanceRegister = await prisma.attendanceRegister.create({
      data: {
        date: targetDate,
        totalEmployees,
        presentCount,
        absentCount,
        leaveCount,
        lateCount,
        finalizedById: user.id,
        finalizedAt: new Date(),
        tenantId: user.tenantId
      }
    });

    return NextResponse.json({ 
      finalized: true, 
      date: targetDate.toISOString().slice(0,10), 
      totals: { totalEmployees, present: presentCount, absent: absentCount, leave: leaveCount, late: lateCount },
      registerId: attendanceRegister.id
    });
  } catch (e) {
    console.error('Finalize attendance error:', e);
    return NextResponse.json({ error: 'Failed to finalize attendance' }, { status: 500 });
  }
}


