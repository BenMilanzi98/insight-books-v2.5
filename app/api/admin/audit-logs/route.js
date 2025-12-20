import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    // Verify admin authentication
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    if (!decoded.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Insufficient privileges' },
        { status: 403 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 50;
    const action = searchParams.get('action') || '';

    const skip = (page - 1) * limit;

    // Build where clause
    const where = {};
    if (action) {
      where.action = action;
    }

    // Fetch audit logs
    const [auditLogs, totalLogs] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.auditLog.count({ where })
    ]);

    return NextResponse.json({
      success: true,
      auditLogs: auditLogs.map(log => ({
        id: log.id,
        action: log.action,
        details: log.details,
        ipAddress: log.ipAddress,
        user: log.user ? {
          id: log.user.id,
          name: log.user.name,
          email: log.user.email
        } : null,
        createdAt: log.createdAt
      })),
      pagination: {
        page,
        limit,
        total: totalLogs,
        pages: Math.ceil(totalLogs / limit)
      }
    });

  } catch (error) {
    console.error('Admin audit logs fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 