import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/lib/serverJwtSecret';

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

    // Get maintenance data
    const maintenanceData = await getMaintenanceData();

    return NextResponse.json({
      success: true,
      ...maintenanceData
    });

  } catch (error) {
    console.error('Admin maintenance error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch maintenance data' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

async function getMaintenanceData() {
  try {
    // Get system status
    const systemStatus = 'operational'; // This could be dynamic based on actual system state

    // Define maintenance tasks
    const maintenanceTasks = [
      {
        id: 'db-optimization',
        name: 'Database Optimization',
        description: 'Optimize database tables and indexes for better performance',
        status: 'pending',
        lastRun: null,
        estimatedDuration: '5-10 minutes',
        category: 'database'
      },
      {
        id: 'log-cleanup',
        name: 'Log Cleanup',
        description: 'Clean old log files and temporary data',
        status: 'completed',
        lastRun: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        estimatedDuration: '2-3 minutes',
        category: 'system'
      },
      {
        id: 'backup-verification',
        name: 'Backup Verification',
        description: 'Verify integrity of recent database backups',
        status: 'running',
        lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        estimatedDuration: '1-2 minutes',
        category: 'backup'
      },
      {
        id: 'cache-clear',
        name: 'Cache Clear',
        description: 'Clear application cache and temporary files',
        status: 'pending',
        lastRun: null,
        estimatedDuration: '1 minute',
        category: 'system'
      },
      {
        id: 'security-scan',
        name: 'Security Scan',
        description: 'Run security vulnerability scan on system files',
        status: 'completed',
        lastRun: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
        estimatedDuration: '10-15 minutes',
        category: 'security'
      }
    ];

    // Get system information
    const systemInfo = {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    };

    return {
      systemStatus,
      maintenanceTasks,
      systemInfo,
      lastUpdated: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error getting maintenance data:', error);
    return {
      systemStatus: 'error',
      maintenanceTasks: [],
      error: error.message,
      lastUpdated: new Date().toISOString()
    };
  }
} 