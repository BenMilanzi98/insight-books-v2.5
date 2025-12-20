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

    // Get real-time system metrics (mock data for now)
    const systemMetrics = {
      cpu: {
        usage: Math.floor(Math.random() * 30) + 20, // 20-50%
        cores: 8,
        temperature: Math.floor(Math.random() * 20) + 40, // 40-60°C
        frequency: Math.floor(Math.random() * 500) + 2000, // 2000-2500 MHz
        load: {
          '1min': Math.random() * 2,
          '5min': Math.random() * 2,
          '15min': Math.random() * 2
        }
      },
      memory: {
        usage: Math.floor(Math.random() * 40) + 30, // 30-70%
        total: 16, // GB
        used: Math.floor(Math.random() * 8) + 4, // 4-12 GB
        available: Math.floor(Math.random() * 8) + 4, // 4-12 GB
        swap: {
          total: 4,
          used: Math.floor(Math.random() * 2),
          available: Math.floor(Math.random() * 2) + 2
        }
      },
      disk: {
        usage: Math.floor(Math.random() * 30) + 40, // 40-70%
        total: 500, // GB
        used: Math.floor(Math.random() * 150) + 200, // 200-350 GB
        available: Math.floor(Math.random() * 150) + 150, // 150-300 GB
        readSpeed: Math.floor(Math.random() * 100) + 50, // 50-150 MB/s
        writeSpeed: Math.floor(Math.random() * 80) + 30, // 30-110 MB/s
        iops: Math.floor(Math.random() * 1000) + 500 // 500-1500 IOPS
      },
      network: {
        throughput: Math.floor(Math.random() * 50) + 10, // 10-60 Mbps
        incoming: Math.floor(Math.random() * 30) + 5, // 5-35 Mbps
        outgoing: Math.floor(Math.random() * 20) + 2, // 2-22 Mbps
        connections: Math.floor(Math.random() * 100) + 50, // 50-150
        packets: {
          in: Math.floor(Math.random() * 10000) + 5000,
          out: Math.floor(Math.random() * 8000) + 3000
        },
        errors: Math.floor(Math.random() * 10),
        dropped: Math.floor(Math.random() * 5)
      },
      database: {
        connections: Math.floor(Math.random() * 50) + 20, // 20-70
        activeQueries: Math.floor(Math.random() * 20) + 5, // 5-25
        queryTime: Math.floor(Math.random() * 100) + 10, // 10-110ms
        cacheHitRatio: Math.floor(Math.random() * 20) + 80, // 80-100%
        locks: Math.floor(Math.random() * 10),
        deadlocks: Math.floor(Math.random() * 2)
      },
      health: [
        {
          name: 'Database',
          status: 'healthy',
          responseTime: Math.floor(Math.random() * 50) + 10,
          lastCheck: new Date()
        },
        {
          name: 'API Gateway',
          status: 'healthy',
          responseTime: Math.floor(Math.random() * 30) + 5,
          lastCheck: new Date()
        },
        {
          name: 'File Storage',
          status: 'healthy',
          responseTime: Math.floor(Math.random() * 40) + 8,
          lastCheck: new Date()
        },
        {
          name: 'Email Service',
          status: 'healthy',
          responseTime: Math.floor(Math.random() * 60) + 15,
          lastCheck: new Date()
        },
        {
          name: 'Payment Gateway',
          status: 'healthy',
          responseTime: Math.floor(Math.random() * 80) + 20,
          lastCheck: new Date()
        }
      ]
    };

    // Add some random variations to make it more realistic
    const addVariation = (value, variation = 0.1) => {
      const change = (Math.random() - 0.5) * 2 * variation;
      return Math.max(0, Math.min(100, value * (1 + change)));
    };

    // Update metrics with realistic variations
    systemMetrics.cpu.usage = Math.round(addVariation(systemMetrics.cpu.usage));
    systemMetrics.memory.usage = Math.round(addVariation(systemMetrics.memory.usage));
    systemMetrics.disk.usage = Math.round(addVariation(systemMetrics.disk.usage));
    systemMetrics.network.throughput = Math.round(addVariation(systemMetrics.network.throughput));

    return NextResponse.json({
      success: true,
      metrics: systemMetrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Admin performance metrics fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch performance metrics' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 