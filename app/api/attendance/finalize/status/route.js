// app/api/attendance/finalize/status/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// GET - Check finalized status for a given date
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    if (!date) return NextResponse.json({ error: 'date is required' }, { status: 400 });

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    // Check if there's a finalized attendance register for this date
    const attendanceRegister = await prisma.attendanceRegister.findFirst({
      where: {
        tenantId: user.tenantId,
        date: targetDate
      },
      include: {
        finalizedByUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!attendanceRegister) {
      return NextResponse.json({ finalized: false });
    }

    return NextResponse.json({ 
      finalized: true, 
      date: attendanceRegister.date.toISOString().slice(0, 10), 
      present: attendanceRegister.presentCount, 
      absent: attendanceRegister.absentCount, 
      total: attendanceRegister.totalEmployees,
      leave: attendanceRegister.leaveCount,
      late: attendanceRegister.lateCount,
      finalizedBy: attendanceRegister.finalizedByUser,
      finalizedAt: attendanceRegister.finalizedAt,
      registerId: attendanceRegister.id
    });
  } catch (e) {
    console.error('Finalize status error:', e);
    return NextResponse.json({ error: 'Failed to fetch finalize status' }, { status: 500 });
  }
}


