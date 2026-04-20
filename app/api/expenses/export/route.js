// app/api/expenses/export/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { createObjectCsvStringifier } from '@/lib/csv-writer';
import { fetchCogsExpenseRegisterRows } from '@/lib/fetchCogsExpenseRegisterRows';
import { fetchSalaryAdvanceRegisterRows } from '@/lib/fetchSalaryAdvanceRegisterRows';

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
    } else if (user?.currentBranchId) {
      where.branchId = user.currentBranchId;
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
    
    // Add search filter if provided
    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { merchant: { contains: search, mode: 'insensitive' } }
      ];
    }
    
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
      const res = generateCsvResponse(merged);
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

// Generate CSV response (Expense rows + COGS GL rows, same register as the UI list)
function generateCsvResponse(rows) {
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
      { id: 'createdAt', title: 'Created At' }
    ]
  });

  const records = rows.map((row) => {
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
      glJournalId: row.transactionId || row.glJournalId || '',
      glAccount: row.glAccountLabel || row.glAccount || '',
      submittedBy: row.submittedBy ? row.submittedBy.name : '',
      notes: row.notes || '',
      createdAt: createdStr
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