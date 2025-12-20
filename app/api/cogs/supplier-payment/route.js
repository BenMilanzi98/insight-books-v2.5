// app/api/cogs/supplier-payment/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { recordSupplierPayment } from '@/lib/cogsIntegration';

/**
 * POST - Record supplier payment
 * Creates journal entries: Debit Accounts Payable, Credit Cash/Bank
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
    const { supplierName, amount, paymentMethod, reference } = body;
    
    if (!supplierName) {
      return NextResponse.json(
        { error: 'Supplier name is required' },
        { status: 400 }
      );
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Payment amount must be greater than zero' },
        { status: 400 }
      );
    }

    if (!paymentMethod) {
      return NextResponse.json(
        { error: 'Payment method is required' },
        { status: 400 }
      );
    }

    // Record the supplier payment
    const transaction = await recordSupplierPayment({
      tenantId: user.tenantId,
      userId: user.id,
      supplierName,
      amount: parseFloat(amount),
      paymentMethod,
      reference: reference || `PAY-${Date.now()}`
    });

    return NextResponse.json({
      success: true,
      message: 'Supplier payment recorded successfully',
      transaction: {
        id: transaction.id,
        description: transaction.description,
        reference: transaction.reference,
        date: transaction.date
      }
    });

  } catch (error) {
    console.error('Error recording supplier payment:', error);
    return NextResponse.json(
      { error: 'Failed to record supplier payment', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET - Get supplier payment history
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
        contains: 'Payment to'
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
    console.error('Error fetching supplier payment history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch supplier payment history' },
      { status: 500 }
    );
  }
}

