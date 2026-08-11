import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/lib/serverJwtSecret';


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
      decoded = jwt.verify(token, getJwtSecret());
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

    // Get system information
    const systemInfo = {
      currentVersion: '1.2.1',
      lastUpdate: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      updateChannel: 'Stable',
      buildNumber: '20240811.1',
      releaseDate: new Date('2024-08-11'),
      changelog: [
        'Security vulnerability fixes',
        'Performance improvements',
        'Bug fixes and stability enhancements'
      ],
      systemRequirements: {
        nodeVersion: '18.0.0+',
        databaseVersion: 'PostgreSQL 12+',
        memory: '2GB+',
        storage: '10GB+'
      },
      updateSettings: {
        autoUpdate: false,
        updateChannel: 'stable',
        checkFrequency: 'daily',
        preferredTime: '02:00'
      }
    };

    return NextResponse.json({
      success: true,
      systemInfo
    });

  } catch (error) {
    console.error('Admin system info fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch system information' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 