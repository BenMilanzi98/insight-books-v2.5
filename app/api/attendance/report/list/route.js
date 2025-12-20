// app/api/attendance/report/list/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// GET - Attendance report by date (from AttendanceRegister table), with range/year/month filters
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

    // Build where clause for date filtering
    const whereClause = { tenantId: user.tenantId };
    
    if (fromDate || toDate) {
      whereClause.date = {};
      if (fromDate) whereClause.date.gte = new Date(fromDate);
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        whereClause.date.lte = endDate;
      }
    } else if (year && !month) {
      const y = parseInt(year, 10);
      whereClause.date = {
        gte: new Date(y, 0, 1),
        lte: new Date(y + 1, 0, 1)
      };
    } else if (year && month) {
      const y = parseInt(year, 10);
      const m = parseInt(month, 10) - 1;
      whereClause.date = {
        gte: new Date(y, m, 1),
        lte: new Date(y, m + 1, 1)
      };
    } else {
      // Default to last 60 days
      const now = new Date();
      const past = new Date(now.getTime() - 60 * 24 * 3600 * 1000);
      whereClause.date = { gte: past, lte: now };
    }

    // Get attendance registers with pagination
    const [registers, totalCount] = await Promise.all([
      prisma.attendanceRegister.findMany({
        where: whereClause,
        select: {
          id: true,
          date: true,
          totalEmployees: true,
          presentCount: true,
          absentCount: true,
          leaveCount: true,
          lateCount: true,
          finalizedAt: true,
          finalizedByUser: {
            select: {
              name: true,
              email: true
            }
          }
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit
      }),
      prisma.attendanceRegister.count({ where: whereClause })
    ]);

    // Format the response
    const registries = registers.map(register => ({
      id: register.id,
      date: register.date.toISOString().slice(0, 10),
      present: register.presentCount,
      absent: register.absentCount,
      leave: register.leaveCount,
      late: register.lateCount,
      total: register.totalEmployees,
      finalizedAt: register.finalizedAt,
      finalizedBy: register.finalizedByUser
    }));

    return NextResponse.json({ 
      registries, 
      pagination: { 
        page, 
        limit, 
        totalCount, 
        totalPages: Math.ceil(totalCount / limit) 
      } 
    });
  } catch (e) {
    console.error('Attendance report list error:', e);
    return NextResponse.json({ error: 'Failed to load attendance report' }, { status: 500 });
  }
}


