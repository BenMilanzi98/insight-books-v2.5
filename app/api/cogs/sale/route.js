// app/api/cogs/sale/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { recordCOGSOnSale } from '@/lib/cogsIntegration';

/**
 * POST - Record COGS for a sale
 * Creates journal entries: Debit COGS, Credit Inventory
 */
export async function POST(request) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // Validate required fields
    const { saleId, items } = body;
    
    if (!saleId) {
      return NextResponse.json(
        { error: 'Sale ID is required' },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Sale items are required' },
        { status: 400 }
      );
    }

    // Verify sale exists and belongs to tenant
    const sale = await prisma.sale.findFirst({
      where: {
        id: saleId,
        tenantId: user.tenantId
      },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });

    if (!sale) {
      return NextResponse.json(
        { error: 'Sale not found or access denied' },
        { status: 404 }
      );
    }

    // Record COGS for the sale
    const transaction = await recordCOGSOnSale({
      tenantId: user.tenantId,
      userId: user.id,
      saleId: saleId,
      items: sale.items // Use items from the sale record
    });

    if (!transaction) {
      return NextResponse.json({
        success: true,
        message: 'No COGS to record (all items are custom or have no cost data)',
        transaction: null
      });
    }

    return NextResponse.json({
      success: true,
      message: 'COGS recorded successfully',
      transaction: {
        id: transaction.id,
        description: transaction.description,
        reference: transaction.reference,
        date: transaction.date
      }
    });

  } catch (error) {
    console.error('Error recording COGS:', error);
    return NextResponse.json(
      { error: 'Failed to record COGS', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET - Get COGS history
 */
export async function GET(request) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;

    // Build where clause
    const where = {
      tenantId: user.tenantId,
      description: {
        contains: 'COGS'
      }
    };

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    // Get total count
    const totalCount = await prisma.transaction.count({ where });

    // Get transactions with pagination
    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        journalEntries: {
          include: {
            account: true
          }
        }
      },
      orderBy: {
        date: 'desc'
      },
      skip: (page - 1) * limit,
      take: limit
    });

    return NextResponse.json({
      transactions,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching COGS history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch COGS history' },
      { status: 500 }
    );
  }
}

