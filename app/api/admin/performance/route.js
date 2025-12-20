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
        { status: 403 }
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
    const range = searchParams.get('range') || '1h';

    // Calculate time ranges
    const now = new Date();
    let startDate;
    
    switch (range) {
      case '1h':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '6h':
        startDate = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        break;
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
    }

    // Get performance data from database (mock data for now)
    const performanceData = {
      responseTime: Math.floor(Math.random() * 100) + 50, // 50-150ms
      responseTimeTrend: Math.random() > 0.5 ? 'up' : 'down',
      responseTimeChange: Math.floor(Math.random() * 20) + 5, // 5-25%
      databaseQueries: Math.floor(Math.random() * 1000) + 500, // 500-1500
      uptime: '99.9%',
      alerts: [
        {
          title: 'High CPU Usage',
          message: 'CPU usage has exceeded 80% for the last 10 minutes',
          timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          severity: 'warning'
        },
        {
          title: 'Database Connection Pool',
          message: 'Database connection pool is at 85% capacity',
          timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
          severity: 'info'
        }
      ],
      trends: {
        responseTime: [65, 72, 68, 75, 70, 73, 69, 71, 67, 74],
        databaseQueries: [1200, 1150, 1250, 1180, 1220, 1160, 1240, 1190, 1230, 1170],
        memoryUsage: [45, 48, 52, 49, 51, 47, 53, 50, 54, 48],
        cpuUsage: [35, 38, 42, 39, 41, 37, 43, 40, 44, 38]
      },
      timeLabels: Array.from({ length: 10 }, (_, i) => {
        const time = new Date(now.getTime() - (9 - i) * 6 * 60 * 1000);
        return time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      })
    };

    return NextResponse.json({
      success: true,
      data: performanceData
    });

  } catch (error) {
    console.error('Admin performance fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch performance data' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 