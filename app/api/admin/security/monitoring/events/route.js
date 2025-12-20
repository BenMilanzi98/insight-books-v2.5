import { NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    // Verify admin authentication
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || '24h';

    // Calculate date range
    const now = new Date();
    let startDate;
    switch (timeframe) {
      case '1h':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // For now, return mock security events
    // You can extend this to fetch from a SecurityEvents table
    const mockEvents = [
      {
        id: '1',
        eventType: 'LOGIN_ATTEMPT',
        description: 'Multiple failed login attempts from suspicious IP',
        user: 'admin@example.com',
        ipAddress: '192.168.1.100',
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
        threatLevel: 'medium',
        blocked: false
      },
      {
        id: '2',
        eventType: 'UNAUTHORIZED_ACCESS',
        description: 'Access attempt to restricted admin endpoint',
        user: 'unknown',
        ipAddress: '203.0.113.45',
        timestamp: new Date(Date.now() - 15 * 60 * 1000),
        threatLevel: 'high',
        blocked: true
      },
      {
        id: '3',
        eventType: 'SUSPICIOUS_ACTIVITY',
        description: 'Unusual data access pattern detected',
        user: 'user@tenant.com',
        ipAddress: '10.0.0.50',
        timestamp: new Date(Date.now() - 30 * 60 * 1000),
        threatLevel: 'low',
        blocked: false
      },
      {
        id: '4',
        eventType: 'RATE_LIMIT_EXCEEDED',
        description: 'API rate limit exceeded for IP address',
        user: 'api_user',
        ipAddress: '198.51.100.123',
        timestamp: new Date(Date.now() - 45 * 60 * 1000),
        threatLevel: 'medium',
        blocked: true
      }
    ];

    // Filter events by timeframe
    const filteredEvents = mockEvents.filter(event => 
      new Date(event.timestamp) >= startDate
    );

    return NextResponse.json({
      success: true,
      events: filteredEvents,
      total: filteredEvents.length
    });

  } catch (error) {
    console.error('Error fetching security events:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch security events' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 