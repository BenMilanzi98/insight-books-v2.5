// app/api/expenses/export/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { createObjectCsvStringifier } from '@/lib/csv-writer';
import { fetchCogsExpenseRegisterRows } from '@/lib/fetchCogsExpenseRegisterRows';
import { fetchSalaryAdvanceRegisterRows } from '@/lib/fetchSalaryAdvanceRegisterRows';
import { addBranchFilterIncludeUnassigned } from '@/lib/dashboardBranchFilter';
import { applyExpenseTextSearchToWhere } from '@/lib/applyExpenseTextSearchToWhere';

// GET - Export expenses data in CSV format
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
    
    // Parse query parameters
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const accountId = searchParams.get('accountId');
    const search = searchParams.get('search');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const format = searchParams.get('format') || 'csv'; // Default to CSV
    
    const branchIdParam = searchParams.get('branchId');

    // Build filter object for Prisma (align with GET /api/expenses list)
    const where = {
      tenantId: user.tenantId,
      isDeleted: false
    };
    if (branchIdParam) {
      where.branchId = branchIdParam;
    } else {
      addBranchFilterIncludeUnassigned(user, where);
    }
    
    // Add status filter if provided
    if (status && status !== 'all') {
      where.status = status;
    }
    
    // Add account filter if provided
    if (accountId && accountId !== 'all') {
      where.expenseAccountId = accountId;
    }

    // Add category filter if provided (legacy support)
    if (category && category !== 'all') {
      where.category = category;
    }
    
    // Add date range filter if provided
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) {
        where.date.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.date.lte = new Date(dateTo);
      }
    }
    
    applyExpenseTextSearchToWhere(where, search);
    
    const categoryLower = typeof category === 'string' ? category.toLowerCase() : '';
    const isSalaryAdvanceOnly =
      categoryLower === 'salary advance' || category === 'Salary Advance';

    const expenses = isSalaryAdvanceOnly
      ? []
      : await prisma.expense.findMany({
          where,
          orderBy: { date: 'desc' },
          include: {
            submittedBy: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        });

    const cogsRows = await fetchCogsExpenseRegisterRows(prisma, {
      tenantId: user.tenantId,
      branchIdParam,
      currentBranchId: user?.currentBranchId,
      dateFrom,
      dateTo,
      search,
      category
    });

    const salaryRows = await fetchSalaryAdvanceRegisterRows(prisma, {
      tenantId: user.tenantId,
      dateFrom,
      dateTo,
      search,
      category,
      accountId
    });

    const expenseRowsForCsv = expenses.map((e) => ({
      entryType: 'Expense',
      ...e,
      glJournalId: '',
      glAccount: ''
    }));

    const merged = [...expenseRowsForCsv, ...cogsRows, ...salaryRows].sort((a, b) => {
      const da = a.date instanceof Date ? a.date : new Date(a.date);
      const db = b.date instanceof Date ? b.date : new Date(b.date);
      return db.getTime() - da.getTime();
    });

    // For CSV format
    if (format === 'csv') {
      const res = await generateCsvResponse(merged, user.tenantId);
      res.headers.set('Cache-Control', 'no-store');
      return res;
    }
    
    // For other formats (could implement PDF, Excel, etc.)
    return NextResponse.json(
      { error: 'Unsupported export format' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error exporting expenses:', error);
    return NextResponse.json(
      { error: 'Failed to export expenses. Please try again.' },
      { status: 500 }
    );
  }
}

const POSTED_GL_STATUSES = ['posted', 'Posted'];

async function buildExpenseJournalLookup(prismaClient, tenantId, rows) {
  const expenseIds = rows
    .filter((row) => (row.entryType || 'Expense') === 'Expense' && row.id)
    .map((row) => row.id);
  const transactionIds = [
    ...new Set(
      rows
        .map((row) => row.transactionId || row.glJournalId || '')
        .filter(Boolean)
    ),
  ];

  const byExpenseId = new Map();
  const byTransactionId = new Map();

  if (expenseIds.length) {
    const expenseTransactions = await prismaClient.transaction.findMany({
      where: {
        tenantId,
        sourceType: 'Expense',
        sourceId: { in: expenseIds },
        isReversal: false,
        status: { in: POSTED_GL_STATUSES },
      },
      select: { id: true, reference: true, sourceId: true },
    });

    for (const tx of expenseTransactions) {
      byExpenseId.set(tx.sourceId, {
        transactionId: tx.id,
        journalReference: tx.reference || '',
      });
    }
  }

  if (transactionIds.length) {
    const linkedTransactions = await prismaClient.transaction.findMany({
      where: {
        tenantId,
        id: { in: transactionIds },
      },
      select: { id: true, reference: true },
    });

    for (const tx of linkedTransactions) {
      byTransactionId.set(tx.id, {
        transactionId: tx.id,
        journalReference: tx.reference || '',
      });
    }
  }

  return { byExpenseId, byTransactionId };
}

function resolveExpenseJournalFields(row, lookup) {
  const existingTransactionId = row.transactionId || row.glJournalId || '';

  if (existingTransactionId) {
    const hit = lookup.byTransactionId.get(existingTransactionId);
    return hit || { transactionId: existingTransactionId, journalReference: '' };
  }

  if ((row.entryType || 'Expense') === 'Expense' && row.id) {
    const hit = lookup.byExpenseId.get(row.id);
    return hit || { transactionId: '', journalReference: '' };
  }

  return { transactionId: '', journalReference: '' };
}

// Generate CSV response (Expense rows + COGS GL rows, same register as the UI list)
async function generateCsvResponse(rows, tenantId) {
  const journalLookup = await buildExpenseJournalLookup(prisma, tenantId, rows);

  const csvStringifier = createObjectCsvStringifier({
    header: [
      { id: 'entryType', title: 'Entry Type' },
      { id: 'id', title: 'ID' },
      { id: 'date', title: 'Date' },
      { id: 'description', title: 'Description' },
      { id: 'merchant', title: 'Merchant' },
      { id: 'category', title: 'Category' },
      { id: 'amount', title: 'Amount' },
      { id: 'taxAmount', title: 'Tax Amount' },
      { id: 'paidAmount', title: 'Paid Amount' },
      { id: 'status', title: 'Approval Status' },
      { id: 'paymentStatus', title: 'Payment Status' },
      { id: 'branchId', title: 'Branch ID' },
      { id: 'glJournalId', title: 'GL Journal ID' },
      { id: 'glAccount', title: 'GL Account (COGS)' },
      { id: 'submittedBy', title: 'Submitted By' },
      { id: 'notes', title: 'Notes' },
      { id: 'createdAt', title: 'Created At' },
      { id: 'journalReference', title: 'Journal Reference' },
    ]
  });

  const records = rows.map((row) => {
    const journal = resolveExpenseJournalFields(row, journalLookup);
    const d = row.date instanceof Date ? row.date : new Date(row.date);
    const dateStr = Number.isNaN(d.getTime())
      ? ''
      : d.toISOString().split('T')[0];
    const ca =
      row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt);
    const createdStr = Number.isNaN(ca.getTime())
      ? dateStr
      : ca.toISOString().split('T')[0];
    const amt =
      typeof row.amount === 'number' ? row.amount : parseFloat(row.amount) || 0;
    return {
      entryType: row.entryType || 'Expense',
      id: row.id,
      date: dateStr,
      description: row.description || '',
      merchant: row.merchant || '',
      category: row.category || '',
      amount: amt.toFixed(2),
      taxAmount: (row.taxAmount != null ? row.taxAmount : 0).toFixed(2),
      paidAmount: (row.paidAmount != null ? row.paidAmount : 0).toFixed(2),
      status: row.status || '',
      paymentStatus: row.paymentStatus || '',
      branchId: row.branchId || '',
      glJournalId: journal.transactionId,
      glAccount: row.glAccountLabel || row.glAccount || '',
      submittedBy: row.submittedBy ? row.submittedBy.name : '',
      notes: row.notes || '',
      createdAt: createdStr,
      journalReference: journal.journalReference,
    };
  });
  
  // Generate CSV content
  const csvContent = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
  
  // Create filename with current date
  const date = new Date().toISOString().split('T')[0];
  const filename = `expenses_export_${date}.csv`;
  
  // Return CSV file
  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}