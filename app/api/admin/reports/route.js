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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const type = searchParams.get('type') || 'all';
    const dateRange = searchParams.get('dateRange') || '30d';

    // Fetch reports from database (mock data for now)
    const reports = [
      {
        id: '1',
        name: 'Monthly Financial Summary',
        description: 'Comprehensive financial overview for August 2024',
        type: 'financial',
        status: 'completed',
        size: '2.1 MB',
        generatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        generatedBy: 'Admin',
        format: 'pdf',
        filters: { dateRange: '30d', type: 'financial' }
      },
      {
        id: '2',
        name: 'User Activity Report',
        description: 'User engagement and activity analysis',
        type: 'user',
        status: 'completed',
        size: '1.8 MB',
        generatedAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
        generatedBy: 'System',
        format: 'excel',
        filters: { dateRange: '7d', type: 'user' }
      },
      {
        id: '3',
        name: 'Tenant Performance Report',
        description: 'Tenant business metrics and performance analysis',
        type: 'tenant',
        status: 'processing',
        size: null,
        generatedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        generatedBy: 'Admin',
        format: 'pdf',
        filters: { dateRange: '90d', type: 'tenant' }
      },
      {
        id: '4',
        name: 'System Analytics Report',
        description: 'System performance and usage analytics',
        type: 'analytics',
        status: 'failed',
        size: null,
        generatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
        generatedBy: 'System',
        format: 'pdf',
        filters: { dateRange: '24h', type: 'analytics' }
      }
    ];

    // Filter reports based on query parameters
    let filteredReports = reports;
    if (status !== 'all') {
      filteredReports = filteredReports.filter(report => report.status === status);
    }
    if (type !== 'all') {
      filteredReports = filteredReports.filter(report => report.type === type);
    }

    // Filter by date range
    if (dateRange !== 'all') {
      const now = new Date();
      let startDate;
      
      switch (dateRange) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case '1y':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(0);
      }
      
      filteredReports = filteredReports.filter(report => report.generatedAt >= startDate);
    }

    return NextResponse.json({
      success: true,
      reports: filteredReports,
      total: filteredReports.length
    });

  } catch (error) {
    console.error('Admin reports fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch reports' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(request) {
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

    const body = await request.json();
    const { reportType, filters } = body;

    // Generate a new report
    const newReport = {
      id: Date.now().toString(),
      name: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`,
      description: `Generated ${reportType} report with specified filters`,
      type: reportType,
      status: 'processing',
      size: null,
      generatedAt: new Date(),
      generatedBy: decoded.name || 'Admin',
      format: 'pdf',
      filters: filters || {}
    };

    // Create admin audit log for report generation
    await prisma.adminAuditLog.create({
      data: {
        adminId: decoded.adminId,
        action: 'REPORT_GENERATE',
        entityType: 'REPORT',
        entityId: newReport.id,
        details: `Generated ${reportType} report`,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    });

    // Simulate report processing
    setTimeout(() => {
      // In a real implementation, this would update the report status in the database
      console.log(`Report ${newReport.id} processing completed`);
    }, 5000);

    return NextResponse.json({
      success: true,
      message: 'Report generation started successfully',
      report: newReport
    });

  } catch (error) {
    console.error('Admin report generation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate report' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 