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

    // Available report types and templates
    const availableReports = [
      {
        id: 'financial-summary',
        name: 'Financial Summary',
        description: 'Comprehensive financial overview including revenue, expenses, and profit analysis',
        type: 'financial',
        category: 'Business',
        estimatedTime: '2-3 minutes',
        formats: ['pdf', 'excel'],
        parameters: ['dateRange', 'currency', 'includeCharts'],
        lastGenerated: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
      },
      {
        id: 'user-activity',
        name: 'User Activity Report',
        description: 'User engagement metrics, login patterns, and activity analysis',
        type: 'user',
        category: 'Analytics',
        estimatedTime: '1-2 minutes',
        formats: ['pdf', 'excel'],
        parameters: ['dateRange', 'userGroup', 'activityType'],
        lastGenerated: new Date(Date.now() - 6 * 60 * 60 * 1000) // 6 hours ago
      },
      {
        id: 'tenant-performance',
        name: 'Tenant Performance Report',
        description: 'Tenant business metrics, subscription status, and performance analysis',
        type: 'tenant',
        category: 'Business',
        estimatedTime: '3-4 minutes',
        formats: ['pdf', 'excel'],
        parameters: ['dateRange', 'planType', 'status'],
        lastGenerated: new Date(Date.now() - 12 * 60 * 60 * 1000) // 12 hours ago
      },
      {
        id: 'system-analytics',
        name: 'System Analytics Report',
        description: 'System performance metrics, usage statistics, and health monitoring',
        type: 'analytics',
        category: 'System',
        estimatedTime: '1-2 minutes',
        formats: ['pdf', 'excel'],
        parameters: ['dateRange', 'metricType', 'includeAlerts'],
        lastGenerated: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
      },
      {
        id: 'inventory-status',
        name: 'Inventory Status Report',
        description: 'Current inventory levels, stock movements, and low stock alerts',
        type: 'inventory',
        category: 'Operations',
        estimatedTime: '1-2 minutes',
        formats: ['pdf', 'excel'],
        parameters: ['location', 'category', 'stockLevel'],
        lastGenerated: new Date(Date.now() - 48 * 60 * 60 * 1000) // 2 days ago
      },
      {
        id: 'audit-trail',
        name: 'Audit Trail Report',
        description: 'System activity logs, user actions, and security events',
        type: 'audit',
        category: 'Security',
        estimatedTime: '2-4 minutes',
        formats: ['pdf', 'excel'],
        parameters: ['dateRange', 'user', 'actionType', 'entityType'],
        lastGenerated: new Date(Date.now() - 72 * 60 * 60 * 1000) // 3 days ago
      },
      {
        id: 'subscription-overview',
        name: 'Subscription Overview',
        description: 'Subscription plans, renewal rates, and churn analysis',
        type: 'subscription',
        category: 'Business',
        estimatedTime: '1-2 minutes',
        formats: ['pdf', 'excel'],
        parameters: ['dateRange', 'planType', 'status'],
        lastGenerated: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
      }
    ];

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'all';
    const type = searchParams.get('type') || 'all';

    // Filter reports based on query parameters
    let filteredReports = availableReports;
    if (category !== 'all') {
      filteredReports = filteredReports.filter(report => report.category === category);
    }
    if (type !== 'all') {
      filteredReports = filteredReports.filter(report => report.type === type);
    }

    return NextResponse.json({
      success: true,
      reports: filteredReports,
      total: filteredReports.length,
      categories: [...new Set(availableReports.map(r => r.category))],
      types: [...new Set(availableReports.map(r => r.type))]
    });

  } catch (error) {
    console.error('Admin available reports fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch available reports' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 