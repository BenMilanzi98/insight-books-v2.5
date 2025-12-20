import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';

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

    // Simple basic queries
    const [totalUsers, totalTenants, totalSubscriptions] = await Promise.all([
      prisma.user.count(),
      prisma.tenant.count(),
      prisma.accountSubscription.count()
    ]);

    const stats = {
      totalUsers,
      totalTenants,
      totalSubscriptions,
      message: 'Simple dashboard working!'
    };

    return NextResponse.json({
      success: true,
      stats: stats
    });

  } catch (error) {
    console.error('Simple dashboard error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch simple dashboard',
        details: error.message,
        stack: error.stack
      },
      { status: 500 }
    );
  }
} 