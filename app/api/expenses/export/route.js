// app/api/expenses/export/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { createObjectCsvStringifier } from '@/lib/csv-writer';

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
    
    // Fetch expenses with user info
    const expenses = await prisma.expense.findMany({
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
    
    // For CSV format
    if (format === 'csv') {
      const res = generateCsvResponse(expenses);
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

// Generate CSV response
function generateCsvResponse(expenses) {
  // Define CSV header
  const csvStringifier = createObjectCsvStringifier({
    header: [
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
      { id: 'submittedBy', title: 'Submitted By' },
      { id: 'notes', title: 'Notes' },
      { id: 'createdAt', title: 'Created At' }
    ]
  });
  
  // Transform expenses data for CSV
  const records = expenses.map(expense => ({
    id: expense.id,
    date: expense.date.toISOString().split('T')[0],
    description: expense.description,
    merchant: expense.merchant || '',
    category: expense.category,
    amount: expense.amount.toFixed(2),
    taxAmount: (expense.taxAmount != null ? expense.taxAmount : 0).toFixed(2),
    paidAmount: (expense.paidAmount != null ? expense.paidAmount : 0).toFixed(2),
    status: expense.status,
    paymentStatus: expense.paymentStatus || '',
    branchId: expense.branchId || '',
    submittedBy: expense.submittedBy ? expense.submittedBy.name : '',
    notes: expense.notes || '',
    createdAt: expense.createdAt.toISOString().split('T')[0]
  }));
  
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