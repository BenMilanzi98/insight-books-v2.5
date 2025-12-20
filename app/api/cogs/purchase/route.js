// app/api/cogs/purchase/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { recordPurchaseFromSupplier } from '@/lib/cogsIntegration';

/**
 * POST - Record purchase from supplier
 * Creates journal entries: Debit Inventory, Credit Accounts Payable
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
    const { items, supplierName, reference } = body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Purchase items are required' },
        { status: 400 }
      );
    }

    if (!supplierName) {
      return NextResponse.json(
        { error: 'Supplier name is required' },
        { status: 400 }
      );
    }

    // Validate each item
    for (const item of items) {
      if (!item.productId || !item.quantity || !item.cost) {
        return NextResponse.json(
          { error: 'Each item must have productId, quantity, and cost' },
          { status: 400 }
        );
      }

      if (item.quantity <= 0 || item.cost <= 0) {
        return NextResponse.json(
          { error: 'Quantity and cost must be greater than zero' },
          { status: 400 }
        );
      }
    }

    // Record the purchase
    const transaction = await recordPurchaseFromSupplier({
      tenantId: user.tenantId,
      userId: user.id,
      items,
      supplierName,
      reference: reference || `PUR-${Date.now()}`
    });

    return NextResponse.json({
      success: true,
      message: 'Purchase recorded successfully',
      transaction: {
        id: transaction.id,
        description: transaction.description,
        reference: transaction.reference,
        date: transaction.date
      }
    });

  } catch (error) {
    console.error('Error recording purchase:', error);
    return NextResponse.json(
      { error: 'Failed to record purchase', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET - Get purchase history
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
        contains: 'Purchase from'
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
    console.error('Error fetching purchase history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch purchase history' },
      { status: 500 }
    );
  }
}

