import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

/**
 * GET - Fetch account transaction history
 * Includes both JournalEntry and Transaction records
 */
export async function GET(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id: accountId } = params;
    const { searchParams } = new URL(request.url);
    
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const branchIdParam = searchParams.get('branchId');
    const branchId = branchIdParam === 'all' || branchIdParam === '' ? null : (branchIdParam ?? user.currentBranchId ?? null);

    // Build date range
    const dateFilter = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
      dateFilter.gte.setHours(0, 0, 0, 0);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate);
      dateFilter.lte.setHours(23, 59, 59, 999);
    }

    // Fetch JournalEntryLine records
    const journalWhere = {
      accountId,
      journalEntry: {
        tenantId: user.tenantId,
        status: 'Posted',
        ...(Object.keys(dateFilter).length > 0 ? { entryDate: dateFilter } : {}),
        ...(branchId ? { branchId } : {}),
      },
    };

    const journalLines = await prisma.journalEntryLine.findMany({
      where: journalWhere,
      include: {
        journalEntry: {
          select: {
            id: true,
            entryDate: true,
            referenceNumber: true,
            description: true,
            sourceType: true,
            sourceId: true,
          },
        },
        account: {
          select: {
            id: true,
            accountCode: true,
            accountName: true,
          },
        },
      },
      orderBy: { journalEntry: { entryDate: 'desc' } },
    });

    // Fetch TransactionLine records
    const transactionWhere = {
      accountId,
      transaction: {
        tenantId: user.tenantId,
        status: 'posted',
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
        ...(branchId ? { branchId } : {}),
      },
    };

    const transactionLines = await prisma.transactionLine.findMany({
      where: transactionWhere,
      include: {
        transaction: {
          select: {
            id: true,
            date: true,
            reference: true,
            description: true,
            sourceType: true,
            sourceId: true,
          },
        },
        account: {
          select: {
            id: true,
            accountCode: true,
            accountName: true,
          },
        },
      },
      orderBy: { transaction: { date: 'desc' } },
    });

    // Format JournalEntry records
    const journalTransactions = journalLines.map(line => ({
      id: line.id,
      transactionId: line.journalEntryId,
      date: line.journalEntry?.entryDate ? new Date(line.journalEntry.entryDate).toISOString() : null,
      reference: line.journalEntry?.referenceNumber || '',
      description: line.journalEntry?.description || line.description || '',
      sourceType: line.journalEntry?.sourceType || 'Manual',
      sourceId: line.journalEntry?.sourceId,
      debit: line.debitAmount || 0,
      credit: line.creditAmount || 0,
      source: 'JournalEntry',
    }));

    // Format Transaction records
    const transactionTransactions = transactionLines.map(line => ({
      id: line.id,
      transactionId: line.transactionId,
      date: line.transaction?.date ? new Date(line.transaction.date).toISOString() : null,
      reference: line.transaction?.reference || '',
      description: line.transaction?.description || line.description || '',
      sourceType: line.transaction?.sourceType || 'Payment',
      sourceId: line.transaction?.sourceId,
      debit: line.debitAmount || 0,
      credit: line.creditAmount || 0,
      source: 'Transaction',
    }));

    // Combine and sort by date (newest first)
    const allTransactions = [...journalTransactions, ...transactionTransactions].sort((a, b) => {
      const dateA = new Date(a.date || 0);
      const dateB = new Date(b.date || 0);
      return dateB - dateA;
    });

    return NextResponse.json({
      transactions: allTransactions,
      totalCount: allTransactions.length,
    });
  } catch (error) {
    console.error('Error fetching account history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch account history', message: error.message },
      { status: 500 }
    );
  }
}


