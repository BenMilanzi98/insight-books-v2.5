// app/api/quotations/statistics/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { addMoney } from '@/lib/money';

// GET - Get quotation statistics
export async function GET(request) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    
    // Parse date range parameters
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    
    // Build filter object for Prisma
    const where = {
      tenantId: user.tenantId
    };
    
    // Add date range filters if provided
    if (dateFrom) {
      where.createdAt = {
        ...(where.createdAt || {}),
        gte: new Date(dateFrom)
      };
    }
    
    if (dateTo) {
      where.createdAt = {
        ...(where.createdAt || {}),
        lte: new Date(dateTo)
      };
    }
    
    // Get statistics for each status
    const pendingQuotations = await prisma.quotation.findMany({
      where: {
        ...where,
        status: 'Pending'
      },
      select: {
        total: true
      }
    });
    
    const approvedQuotations = await prisma.quotation.findMany({
      where: {
        ...where,
        status: 'Approved'
      },
      select: {
        total: true
      }
    });
    
    const convertedQuotations = await prisma.quotation.findMany({
      where: {
        ...where,
        status: 'Converted'
      },
      select: {
        total: true
      }
    });
    
    // Calculate totals
    const pendingTotal = pendingQuotations.reduce((sum, item) => addMoney(sum, item.total), 0);
    const approvedTotal = approvedQuotations.reduce((sum, item) => addMoney(sum, item.total), 0);
    const convertedTotal = convertedQuotations.reduce((sum, item) => addMoney(sum, item.total), 0);
    
    // Count quotations by status
    const pendingCount = pendingQuotations.length;
    const approvedCount = approvedQuotations.length;
    const convertedCount = convertedQuotations.length;
    
    // Return statistics
    return NextResponse.json({
      pending: {
        count: pendingCount,
        total: pendingTotal
      },
      approved: {
        count: approvedCount,
        total: approvedTotal
      },
      converted: {
        count: convertedCount,
        total: convertedTotal
      },
      summary: {
        totalQuotations: pendingCount + approvedCount + convertedCount,
        totalValue: pendingTotal + approvedTotal + convertedTotal
      }
    });
  } catch (error) {
    console.error('Error fetching quotation statistics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quotation statistics. Please try again.' },
      { status: 500 }
    );
  }
}