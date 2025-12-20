import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import os from 'os';

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

    // Get system metrics
    const metrics = await getSystemMetrics();

    return NextResponse.json({
      success: true,
      metrics
    });

  } catch (error) {
    console.error('Admin metrics error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch system metrics' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

async function getSystemMetrics() {
  try {
    // Database health check
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbQueryTime = Date.now() - dbStart;

    // Get database statistics
    const [totalUsers, totalTenants, activeUsers] = await Promise.all([
      prisma.user.count(),
      prisma.tenant.count(),
      prisma.user.count({
        where: { lastLogin: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
      })
    ]);

    // System information
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const memoryUsage = ((totalMemory - freeMemory) / totalMemory * 100).toFixed(1);
    const memoryAvailable = (freeMemory / (1024 * 1024 * 1024)).toFixed(1);

    // CPU information
    const cpuUsage = os.loadavg()[0] * 100; // 1 minute average
    const cpuCores = os.cpus().length;

    // Calculate system status based on metrics
    let systemStatus = 'healthy';
    if (memoryUsage > 90 || cpuUsage > 80) {
      systemStatus = 'warning';
    }
    if (memoryUsage > 95 || cpuUsage > 95) {
      systemStatus = 'critical';
    }

    // Database status
    let databaseStatus = 'connected';
    if (dbQueryTime > 1000) {
      databaseStatus = 'slow';
    }
    if (dbQueryTime > 5000) {
      databaseStatus = 'critical';
    }

    return {
      // System Health
      systemStatus,
      databaseStatus,
      
      // Performance Metrics
      cpuUsage: cpuUsage.toFixed(1),
      cpuCores,
      memoryUsage,
      memoryAvailable,
      
      // Database Metrics
      databaseConnections: 1, // Simplified for now
      dbQueryTime,
      
      // Response Times (simplified)
      apiResponseTime: Math.floor(Math.random() * 50) + 10, // Mock data
      pageLoadTime: Math.floor(Math.random() * 200) + 50, // Mock data
      
      // Throughput
      requestsPerSecond: Math.floor(Math.random() * 10) + 5, // Mock data
      activeUsers,
      concurrentSessions: Math.floor(Math.random() * 20) + 5, // Mock data
      
      // System Information
      serverInfo: {
        platform: os.platform(),
        version: os.release(),
        uptime: Math.floor(os.uptime() / 3600) + ' hours'
      },
      databaseInfo: {
        type: 'PostgreSQL',
        version: '14+',
        size: 'Calculating...'
      },
      
      // Last Updated
      lastUpdated: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error getting system metrics:', error);
    return {
      systemStatus: 'error',
      databaseStatus: 'disconnected',
      error: error.message,
      lastUpdated: new Date().toISOString()
    };
  }
} 