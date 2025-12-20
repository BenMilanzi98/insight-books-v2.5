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

    // For now, return mock threat metrics
    // You can extend this to calculate real metrics from security events
    const mockMetrics = {
      totalThreats: 4,
      highRisk: 1,
      mediumRisk: 2,
      lowRisk: 1,
      blockedAttempts: 2,
      suspiciousActivities: 1
    };

    return NextResponse.json({
      success: true,
      metrics: mockMetrics
    });

  } catch (error) {
    console.error('Error fetching security metrics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch security metrics' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 