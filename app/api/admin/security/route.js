import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// GET - Fetch security events and system monitoring data
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
    const severity = searchParams.get('severity') || '';
    const type = searchParams.get('type') || '';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';

    const skip = (page - 1) * limit;

    // Build where clause for security events
    const where = {};
    
    if (severity) {
      where.severity = severity;
    }

    if (type) {
      where.type = type;
    }

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    // Fetch security events
    const [securityEvents, totalEvents] = await Promise.all([
      prisma.securityEvent.findMany({
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
      prisma.securityEvent.count({ where })
    ]);

    // Get security statistics
    const securityStats = await prisma.securityEvent.groupBy({
      by: ['severity', 'type'],
      _count: true,
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      }
    });

    // Get failed login attempts
    const failedLogins = await prisma.securityEvent.count({
      where: {
        type: 'FAILED_LOGIN',
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    });

    // Get suspicious activities
    const suspiciousActivities = await prisma.securityEvent.count({
      where: {
        severity: 'HIGH',
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    });

    // Get system health metrics
    const systemHealth = {
      databaseConnections: 'Healthy',
      apiResponseTime: 'Good',
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      lastBackup: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // Mock data
      securityScore: calculateSecurityScore(securityStats, failedLogins, suspiciousActivities)
    };

    return NextResponse.json({
      success: true,
      securityEvents: securityEvents.map(event => ({
        id: event.id,
        type: event.type,
        severity: event.severity,
        description: event.description,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        user: event.user ? {
          id: event.user.id,
          name: event.user.name,
          email: event.user.email
        } : null,
        createdAt: event.createdAt,
        resolved: event.resolved
      })),
      pagination: {
        page,
        limit,
        total: totalEvents,
        pages: Math.ceil(totalEvents / limit)
      },
      statistics: {
        totalEvents,
        failedLogins,
        suspiciousActivities,
        severityBreakdown: securityStats.reduce((acc, stat) => {
          if (!acc[stat.severity]) acc[stat.severity] = {};
          acc[stat.severity][stat.type] = stat._count;
          return acc;
        }, {}),
        lastUpdated: new Date().toISOString()
      },
      systemHealth
    });

  } catch (error) {
    console.error('Admin security fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch security data' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Helper function to calculate security score
function calculateSecurityScore(securityStats, failedLogins, suspiciousActivities) {
  let score = 100;
  
  // Deduct points for failed logins
  if (failedLogins > 10) score -= 20;
  else if (failedLogins > 5) score -= 10;
  
  // Deduct points for suspicious activities
  if (suspiciousActivities > 5) score -= 30;
  else if (suspiciousActivities > 2) score -= 15;
  
  // Deduct points for high severity events
  const highSeverityEvents = securityStats.find(stat => stat.severity === 'HIGH');
  if (highSeverityEvents) {
    score -= Math.min(highSeverityEvents._count * 5, 25);
  }
  
  return Math.max(score, 0);
} 