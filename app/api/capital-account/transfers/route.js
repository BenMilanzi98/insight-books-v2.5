// app/api/capital-account/transfers/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { resolvePrimaryCapitalAccount } from '@/lib/resolveCapitalAccount';

// GET - Get capital account transfer history
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const type = searchParams.get('type');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const search = searchParams.get('search');

    const capitalAccount = await resolvePrimaryCapitalAccount(user.tenantId, prisma);

    if (!capitalAccount) {
      return NextResponse.json(
        { error: 'Capital account not found' },
        { status: 404 }
      );
    }

    // Build where clause for transfers
    const whereClause = {
      tenantId: user.tenantId,
      type: 'transfer',
      OR: [
        { sourceAccount: capitalAccount.id },
        { destinationAccount: capitalAccount.id }
      ]
    };

    // Add type filter
    if (type && type !== 'all') {
      if (type === 'outgoing') {
        whereClause.sourceAccount = capitalAccount.id;
      } else if (type === 'incoming') {
        whereClause.destinationAccount = capitalAccount.id;
      }
    }

    // Add date filters
    if (dateFrom || dateTo) {
      whereClause.paymentDate = {};
      if (dateFrom) {
        whereClause.paymentDate.gte = new Date(dateFrom);
      }
      if (dateTo) {
        whereClause.paymentDate.lte = new Date(dateTo);
      }
    }

    // Add search filter
    if (search) {
      whereClause.OR = [
        ...whereClause.OR,
        { reference: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Get total count for pagination
    const totalTransfers = await prisma.payment.count({
      where: whereClause
    });

    const totalPages = Math.ceil(totalTransfers / limit);
    const skip = (page - 1) * limit;

    // Get transfers with pagination
    const transfers = await prisma.payment.findMany({
      where: whereClause,
      orderBy: { paymentDate: 'desc' },
      skip,
      take: limit
    });

    // Format transfers for response
    const formattedTransfers = transfers.map(transfer => ({
      id: transfer.id,
      amount: transfer.amount,
      type: transfer.sourceAccount === capitalAccount.id ? 'outgoing' : 'incoming',
      date: transfer.paymentDate,
      reference: transfer.reference,
      notes: transfer.notes,
      sourceAccount: transfer.sourceAccount,
      destinationAccount: transfer.destinationAccount,
      createdAt: transfer.createdAt
    }));

    return NextResponse.json({
      transfers: formattedTransfers,
      pagination: {
        currentPage: page,
        totalPages,
        totalTransfers,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching capital account transfers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transfer history' },
      { status: 500 }
    );
  }
} 