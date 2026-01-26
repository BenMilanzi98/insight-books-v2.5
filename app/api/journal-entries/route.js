import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { generateReferenceNumber } from '@/lib/journalService';
import {
  formatJournalEntry,
  formatJournalEntries,
} from '@/lib/journalEntryFormatter';

const ENTRY_INCLUDE = {
  lines: {
    orderBy: { lineNumber: 'asc' },
    include: {
      account: {
        select: {
          id: true,
          accountCode: true,
          accountName: true,
          accountType: true,
          code: true,
          name: true,
          type: true,
        },
      },
    },
  },
  createdBy: {
    select: { id: true, name: true, email: true },
  },
  postedBy: {
    select: { id: true, name: true, email: true },
  },
};

// Build where clause for Transaction model
function buildWhereClause(tenantId, searchParams) {
  const where = { tenantId };

  const status = searchParams.get('status');
  if (status && status !== 'all' && status.toLowerCase() !== 'all status') {
    // Map status values: 'Posted' -> 'posted', 'Draft' -> 'draft'
    where.status =
      status === 'Posted' || status === 'posted'
        ? 'posted'
        : status === 'Draft' || status === 'draft'
        ? 'draft'
        : status.toLowerCase();
  }

  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  if (startDate || endDate) {
    where.date = {};
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      where.date.gte = start;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.date.lte = end;
    }
  }

  const search = searchParams.get('search');
  if (search) {
    where.OR = [
      { description: { contains: search, mode: 'insensitive' } },
      { reference: { contains: search, mode: 'insensitive' } },
      { notes: { contains: search, mode: 'insensitive' } },
    ];
  }

  const sourceType = searchParams.get('sourceType');
  if (sourceType && sourceType !== 'all' && sourceType.toLowerCase() !== 'all types') {
    where.sourceType = sourceType;
  }

  return where;
}

function normalizeLines(lines = [], fallbackDescription) {
  return lines
    .filter((line) => !!line.accountId)
    .map((line) => {
      const debit = Number(
        line.debitAmount ?? line.debit ?? line.debit_value ?? 0
      );
      const credit = Number(
        line.creditAmount ?? line.credit ?? line.credit_value ?? 0
      );

      return {
        accountId: line.accountId,
        description: line.description || fallbackDescription || null,
        debitAmount: Number.isFinite(debit) ? debit : 0,
        creditAmount: Number.isFinite(credit) ? credit : 0,
      };
    });
}

function resolveEntryDate(body) {
  if (body.entryDate) return new Date(body.entryDate);
  if (body.date) return new Date(body.date);
  return new Date();
}

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated with this user' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('limit') || '10', 10))
    );
    const skip = (page - 1) * limit;

    const where = buildWhereClause(user.tenantId, searchParams);
    const sortBy = searchParams.get('sortBy') || 'date';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    // Map frontend sortBy to Transaction model fields
    let orderBy;
    if (sortBy === 'referenceNumber' || sortBy === 'reference') {
      orderBy = { reference: sortOrder };
    } else if (sortBy === 'entryDate' || sortBy === 'date') {
      orderBy = { date: sortOrder };
    } else {
      orderBy = { date: sortOrder }; // Default to date
    }

    console.log('🔍 Fetching transactions with where clause:', JSON.stringify(where, null, 2));
    console.log('🔍 Order by:', JSON.stringify(orderBy, null, 2));
    
    try {
      const [totalCount, entriesRaw] = await Promise.all([
        prisma.transaction.count({ where }),
        prisma.transaction.findMany({
          where,
          orderBy,
          skip,
          take: limit,
          include: ENTRY_INCLUDE,
        }),
      ]);
      
      // Remove duplicates by ID (in case of any data issues)
      const entriesMap = new Map();
      entriesRaw.forEach(entry => {
        if (!entriesMap.has(entry.id)) {
          entriesMap.set(entry.id, entry);
        }
      });
      const entries = Array.from(entriesMap.values());
      
      console.log('✅ Found transactions:', entries.length, 'Total count:', totalCount);
      console.log('📊 Transaction breakdown:', {
        sales: entries.filter(e => e.sourceType === 'Sale').length,
        expenses: entries.filter(e => e.sourceType === 'Expense').length,
        others: entries.filter(e => e.sourceType && !['Sale', 'Expense'].includes(e.sourceType)).length,
      });
      
      return NextResponse.json({
        entries: formatJournalEntries(entries),
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      });
    } catch (queryError) {
      console.error('❌ Query error details:', {
        message: queryError.message,
        code: queryError.code,
        meta: queryError.meta,
      });
      throw queryError;
    }

    } catch (error) {
    console.error('Error fetching journal entries:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    return NextResponse.json(
      { 
        error: 'Failed to load journal entries',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated with this user' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const lines = normalizeLines(body.lines, body.description);

    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'At least two lines are required for a journal entry.' },
        { status: 400 }
      );
    }

    // Validate that no lines are posting to tax accounts (tax accounts should only be posted via tax service)
    const accountIds = lines.map(line => line.accountId);
    const taxTypes = await prisma.taxType.findMany({
      where: {
        tenantId: user.tenantId,
        accountId: { in: accountIds },
      },
      include: {
        account: {
          select: {
            id: true,
            accountName: true,
          },
        },
      },
    });

    if (taxTypes.length > 0) {
      const taxAccountNames = taxTypes.map(tt => tt.account.accountName || 'Unknown').join(', ');
      return NextResponse.json(
        { 
          error: 'Manual journal entries to tax accounts are not allowed. Tax accounts must be posted automatically via the tax system.',
          details: `Tax accounts detected: ${taxAccountNames}. Please use the tax management system to post taxes.`
        },
        { status: 400 }
      );
    }

    // For now, create Transaction directly (we'll update journalService later)
    const entryDate = resolveEntryDate(body);
    const referenceNumber = await generateReferenceNumber(prisma, user.tenantId, entryDate);
    const shouldPost = (body.status || '').toLowerCase() === 'posted';

    const transaction = await prisma.transaction.create({
      data: {
        tenantId: user.tenantId,
        date: entryDate,
        reference: referenceNumber,
        description: body.description || '',
        entryType: body.entryType || 'Regular',
        status: shouldPost ? 'posted' : 'draft',
        notes: body.notes || undefined,
        sourceType: body.sourceType || undefined,
        sourceId: body.sourceId || undefined,
        createdById: user.id,
        postedById: shouldPost ? user.id : null,
        postedDate: shouldPost ? new Date() : null,
        lines: {
          create: lines.map((line, index) => ({
            lineNumber: index + 1,
            accountId: line.accountId,
            debitAmount: line.debitAmount,
            creditAmount: line.creditAmount,
            description: line.description,
          })),
        },
      },
      include: ENTRY_INCLUDE,
    });

    const hydratedEntry = transaction;

    return NextResponse.json(
      {
        message: shouldPost
          ? 'Journal entry posted successfully.'
          : 'Journal entry saved as draft.',
        entry: formatJournalEntry(hydratedEntry),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating journal entry:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to create journal entry',
      },
      { status: 400 }
    );
  }
}