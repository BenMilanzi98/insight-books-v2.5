// app/api/attendance/finalize/list/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// GET - List finalized attendance registers (paged)
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const skip = (page - 1) * limit;
    const year = searchParams.get('year');
    const month = searchParams.get('month'); // 1-12
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    const whereBase = {
      tenantId: user.tenantId,
      action: 'ATTENDANCE_REGISTER_FINALIZED',
      entityType: 'ATTENDANCE'
    };

    const where = { ...whereBase };
    // Prefer explicit range if provided
    if (fromDate || toDate) {
      where.timestamp = {};
      if (fromDate) where.timestamp.gte = new Date(fromDate);
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23,59,59,999);
        where.timestamp.lte = end;
      }
    } else if (year && !month) {
      const y = parseInt(year, 10);
      where.timestamp = { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) };
    } else if (year && month) {
      const y = parseInt(year, 10);
      const m = parseInt(month, 10) - 1;
      where.timestamp = { gte: new Date(y, m, 1), lt: new Date(y, m + 1, 1) };
    }

    const [totalCount, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
        select: { id: true, entityId: true, details: true, timestamp: true }
      })
    ]);

    const registries = logs.map(log => {
      const details = log.details || '';
      const present = Number((details.match(/present=(\d+)/) || [])[1] || 0);
      const absent = Number((details.match(/absent=(\d+)/) || [])[1] || 0);
      const total = Number((details.match(/total=(\d+)/) || [])[1] || 0);
      const dateMatch = details.match(/date=([0-9\-]+)/);
      const date = dateMatch ? dateMatch[1] : null;
      return { id: log.id, date, present, absent, total, entityId: log.entityId, timestamp: log.timestamp };
    });

    return NextResponse.json({ registries, pagination: { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit) } });
  } catch (e) {
    console.error('List finalize error:', e);
    return NextResponse.json({ error: 'Failed to load registries' }, { status: 500 });
  }
}

// DELETE - Clear finalized registers within a window (e.g., this month)
export async function DELETE(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const quick = searchParams.get('quick'); // e.g., 'this_month'
    const year = searchParams.get('year');
    const month = searchParams.get('month'); // 1-12
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

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
      action: 'ATTENDANCE_REGISTER_FINALIZED',
      entityType: 'ATTENDANCE',
      timestamp: {
        gte: start || undefined,
        lte: end || undefined
      }
    };

    const deleted = await prisma.auditLog.deleteMany({ where });
    return NextResponse.json({ deleted: deleted.count });
  } catch (e) {
    console.error('Delete finalized error:', e);
    return NextResponse.json({ error: 'Failed to delete finalized registers' }, { status: 500 });
  }
}


