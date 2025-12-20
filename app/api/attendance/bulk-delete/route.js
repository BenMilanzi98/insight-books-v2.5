// app/api/attendance/bulk-delete/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// DELETE - Bulk delete attendance records by range (e.g., this month)
export async function DELETE(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const quick = searchParams.get('quick'); // e.g., 'this_month'
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const year = searchParams.get('year');
    const month = searchParams.get('month'); // 1-12

    let start = null, end = null;
    const today = new Date();
    if (quick === 'this_month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      end.setMilliseconds(end.getMilliseconds() - 1);
    } else if (fromDate || toDate) {
      start = fromDate ? new Date(fromDate) : null;
      end = toDate ? new Date(toDate) : null;
      if (end) end.setHours(23,59,59,999);
    } else if (year && month) {
      const y = parseInt(year, 10);
      const m = parseInt(month, 10) - 1;
      start = new Date(y, m, 1);
      end = new Date(y, m + 1, 1);
      end.setMilliseconds(end.getMilliseconds() - 1);
    } else if (year && !month) {
      const y = parseInt(year, 10);
      start = new Date(y, 0, 1);
      end = new Date(y + 1, 0, 1);
      end.setMilliseconds(end.getMilliseconds() - 1);
    } else {
      return NextResponse.json({ error: 'Specify quick=this_month or a date range/year/month' }, { status: 400 });
    }

    const where = {
      tenantId: user.tenantId,
      date: {
        gte: start || undefined,
        lte: end || undefined
      }
    };

    const result = await prisma.attendanceRecord.deleteMany({ where });
    return NextResponse.json({ deleted: result.count });
  } catch (e) {
    console.error('Bulk delete attendance error:', e);
    return NextResponse.json({ error: 'Failed to delete attendance records' }, { status: 500 });
  }
}



