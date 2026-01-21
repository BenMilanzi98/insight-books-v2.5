// app/api/general-ledger/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// GET - Fetch general ledger transactions with filtering, sorting, and pagination
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated with this user' },
        { status: 401 }
      );
    }
    const tenantId = user.tenantId;
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    
    // Pagination parameters
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;
    const skip = (page - 1) * limit;
    
    // Date range parameters
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const branchIdParam = searchParams.get('branchId');
    const branchId =
      branchIdParam === 'all' || branchIdParam === '' ? null :
      (branchIdParam ?? user.currentBranchId ?? null);
    
    // Filtering parameters
    const accountId = searchParams.get('accountId');
    const search = searchParams.get('search');
    const reference = searchParams.get('reference');
    const balanceType = searchParams.get('balanceType'); // 'debit', 'credit', or 'all'
    
    // Sorting parameters
    const sortBy = searchParams.get('sortBy') || 'date';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    
    // Build filter conditions for journal entry lines (modern accounting model)
    const whereConditions = {
      journalEntry: {
        tenantId,
        status: 'Posted',
        ...(branchId ? { branchId } : {}),
      },
    };
    
    // Add date range filter if provided
    if (startDate || endDate) {
      whereConditions.journalEntry = {
        ...whereConditions.journalEntry,
        entryDate: {},
      };
      if (startDate) whereConditions.journalEntry.entryDate.gte = new Date(startDate);
      if (endDate) whereConditions.journalEntry.entryDate.lte = new Date(endDate);
    }
    
    // Add account filter if provided
    if (accountId && accountId !== 'all') {
      whereConditions.accountId = accountId;
    }
    
    // Add reference filter if provided
    if (reference) {
      whereConditions.journalEntry = {
        ...whereConditions.journalEntry,
        OR: [
          { referenceNumber: { contains: reference, mode: 'insensitive' } },
          { description: { contains: reference, mode: 'insensitive' } },
        ],
      };
    }
    
    // Add balance type filter if provided
    if (balanceType === 'debit') {
      whereConditions.debitAmount = { gt: 0 };
    } else if (balanceType === 'credit') {
      whereConditions.creditAmount = { gt: 0 };
    }
    
    // Add search filter if provided
    if (search) {
      whereConditions.OR = [
        { journalEntry: { description: { contains: search, mode: 'insensitive' } } },
        { journalEntry: { referenceNumber: { contains: search, mode: 'insensitive' } } },
        { account: { accountName: { contains: search, mode: 'insensitive' } } },
        { account: { accountCode: { contains: search, mode: 'insensitive' } } },
      ];
    }
    
    // Get total count for pagination
    const totalCount = await prisma.journalEntryLine.count({ where: whereConditions });
    
    // Fetch journal entry lines with their related journal entry + account
    const lines = await prisma.journalEntryLine.findMany({
      where: whereConditions,
      include: {
        account: { select: { id: true, accountCode: true, accountName: true, accountType: true, normalBalance: true } },
        journalEntry: { select: { id: true, entryDate: true, referenceNumber: true, description: true, branchId: true } },
      },
      orderBy: { journalEntry: { entryDate: sortOrder.toLowerCase() } },
      skip,
      take: limit
    });
    
    // Optional running balance if a single account is selected
    let openingBalance = null;
    let running = 0;
    if (accountId && accountId !== 'all') {
      // Sum all posted lines before startDate for this account to get opening balance
      const openingWhere = {
        ...whereConditions,
        accountId,
        ...(startDate
          ? { journalEntry: { ...whereConditions.journalEntry, entryDate: { lt: new Date(startDate) } } }
          : {}),
      };
      const opening = await prisma.journalEntryLine.aggregate({
        where: openingWhere,
        _sum: { debitAmount: true, creditAmount: true },
      });
      const acc = await prisma.account.findUnique({
        where: { id: accountId },
        select: { accountType: true, normalBalance: true },
      });
      const normal = (acc?.normalBalance || ((acc?.accountType || '').toLowerCase() === 'asset' || (acc?.accountType || '').toLowerCase() === 'expense' ? 'Debit' : 'Credit')).toLowerCase();
      const deb = opening._sum.debitAmount || 0;
      const cre = opening._sum.creditAmount || 0;
      openingBalance = normal === 'debit' ? (deb - cre) : (cre - deb);
      running = openingBalance;
    }

    const transactions = lines.map((l) => {
      const debit = l.debitAmount || 0;
      const credit = l.creditAmount || 0;
      if (accountId && accountId !== 'all') {
        const normal = (l.account?.normalBalance || ((l.account?.accountType || '').toLowerCase() === 'asset' || (l.account?.accountType || '').toLowerCase() === 'expense' ? 'Debit' : 'Credit')).toLowerCase();
        const delta = normal === 'debit' ? (debit - credit) : (credit - debit);
        running += delta;
      }
      return {
        id: l.id,
        transactionId: l.journalEntryId,
        date: l.journalEntry?.entryDate ? new Date(l.journalEntry.entryDate).toISOString() : null,
        description: l.journalEntry?.description || l.description || '',
        reference: l.journalEntry?.referenceNumber || '',
        accountId: l.accountId,
        accountCode: l.account?.accountCode || '',
        accountName: l.account?.accountName || '',
        accountType: l.account?.accountType || '',
        debit,
        credit,
        balance: (accountId && accountId !== 'all') ? running : null,
      };
    });
    
    // Calculate summary statistics
    const summaryStats = await prisma.journalEntryLine.aggregate({
      where: whereConditions,
      _sum: { debitAmount: true, creditAmount: true },
    });
    
    // Return the formatted response
    return NextResponse.json({
      transactions,
      openingBalance,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      },
      totalDebits: summaryStats._sum.debitAmount || 0,
      totalCredits: summaryStats._sum.creditAmount || 0
    });
    
  } catch (error) {
    console.error('Error fetching general ledger transactions:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch general ledger data. Please try again.' },
      { status: 500 }
    );
  }
}