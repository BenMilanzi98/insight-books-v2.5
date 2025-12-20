// app/api/attendance/absences/bulk/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// POST - Bulk create Absent records for a given date and employees
export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { date, employeeIds = [], reason } = body;
    if (!date || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      return NextResponse.json({ error: 'date and employeeIds[] are required' }, { status: 400 });
    }

    // Parse date correctly to avoid timezone issues
    let recordDate;
    if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Date is in YYYY-MM-DD format, create in local timezone
      const [year, month, day] = date.split('-').map(Number);
      recordDate = new Date(year, month - 1, day, 12, 0, 0, 0); // Use noon to avoid timezone edge cases
    } else {
      // Fallback to original behavior
      recordDate = new Date(date);
      recordDate.setHours(0, 0, 0, 0);
    }

    // Filter employees to tenant
    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds }, tenantId: user.tenantId, isActive: true },
      select: { id: true }
    });
    const validIds = employees.map(e => e.id);
    if (validIds.length === 0) {
      return NextResponse.json({ created: 0, skipped: employeeIds.length, message: 'No valid employees for tenant' });
    }

    // Find existing records to skip duplicates
    const existing = await prisma.attendanceRecord.findMany({
      where: { employeeId: { in: validIds }, date: recordDate },
      select: { employeeId: true }
    });
    const existingSet = new Set(existing.map(r => r.employeeId));
    const toCreate = validIds.filter(id => !existingSet.has(id));

    if (toCreate.length === 0) {
      return NextResponse.json({ created: 0, skipped: validIds.length, message: 'All records already exist for this date' });
    }

    // Create absent records
    await prisma.$transaction(
      toCreate.map(id =>
        prisma.attendanceRecord.create({
          data: {
            employeeId: id,
            tenantId: user.tenantId,
            date: recordDate,
            status: 'Absent',
            notes: reason || null,
            hoursWorked: 0,
            overtimeHours: 0
          }
        })
      )
    );

    return NextResponse.json({ created: toCreate.length, skipped: existingSet.size });
  } catch (e) {
    console.error('Bulk absences error:', e);
    return NextResponse.json({ error: 'Failed to record absences' }, { status: 500 });
  }
}



