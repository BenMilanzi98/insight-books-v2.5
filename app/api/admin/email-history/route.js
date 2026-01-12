import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';

// GET /api/admin/email-history - Get email sending history
export async function GET(request) {
  try {
    // Verify admin authentication
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 50;
    const status = searchParams.get('status') || 'all';
    const template = searchParams.get('template') || 'all';
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Build where clause for filtering
    const where = {};
    
    if (status && status !== 'all') {
      where.status = status;
    }
    
    if (template && template !== 'all') {
      where.template = template;
    }
    
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo);
      }
    }

    // Get total count for pagination
    const totalEmails = await prisma.emailLog.count({ where });
    
    // Get email logs with pagination
    // If limit is very high (10000+), fetch all without pagination for stats
    const shouldFetchAll = limit >= 10000;
    const emailLogs = await prisma.emailLog.findMany({
      where,
      include: {
        tenant: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      ...(shouldFetchAll ? {} : {
        skip: (page - 1) * limit,
        take: limit
      })
    });

    // Transform data for frontend
    const transformedEmails = emailLogs.map(email => ({
      id: email.id,
      recipientEmail: email.recipientEmail,
      recipientName: email.recipientName,
      subject: email.subject,
      template: email.template,
      priority: email.priority,
      status: email.status,
      errorMessage: email.errorMessage,
      sentBy: 'Admin', // Since this is admin email management
      sentByEmail: 'admin@insightbooksafrica.com', // Default admin email
      tenantName: email.tenant?.name || 'Unknown',
      createdAt: email.createdAt,
      sentAt: email.sentAt
    }));

    // Get summary statistics
    const stats = await prisma.emailLog.aggregate({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      },
      _count: {
        id: true
      }
    });

    const statusStats = await prisma.emailLog.groupBy({
      by: ['status'],
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      },
      _count: {
        id: true
      }
    });

    return NextResponse.json({
      emails: transformedEmails,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalEmails / limit),
        totalEmails,
        hasNextPage: page * limit < totalEmails,
        hasPrevPage: page > 1
      },
      stats: {
        totalLast30Days: stats._count.id,
        statusBreakdown: statusStats.reduce((acc, stat) => {
          acc[stat.status] = stat._count.id;
          return acc;
        }, {})
      }
    });

  } catch (error) {
    console.error('Error fetching email history:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
