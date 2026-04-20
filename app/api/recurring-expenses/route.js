// app/api/recurring-expenses/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { startOfMonth, endOfMonth } from '@/lib/dateUtils';
import { isPhinduExpenseStructureCode } from '@/lib/phinduExpenseCategoryCodes.js';
// import { calculateNextRunDate } from '@/lib/recurring-expenses';

const resolveExpenseAccount = async (tenantId, expenseAccountId, category) => {
  let expenseAccount = null;

  if (expenseAccountId) {
    expenseAccount = await prisma.account.findFirst({
      where: { id: expenseAccountId, tenantId, accountType: 'Expense', isActive: true },
    });
    if (!expenseAccount) {
      const ec = await prisma.expenseCategory.findFirst({
        where: { id: expenseAccountId, tenantId },
        include: { account: true },
      });
      if (ec?.account?.isActive !== false && ec?.account?.accountType === 'Expense') {
        expenseAccount = ec.account;
      }
    }
  }

  if (!expenseAccount && category) {
    const ec = await prisma.expenseCategory.findFirst({
      where: { tenantId, name: { equals: category, mode: 'insensitive' } },
      include: { account: true },
    });
    if (ec?.account?.isActive !== false && ec?.account?.accountType === 'Expense') {
      expenseAccount = ec.account;
    }
  }

  if (!expenseAccount && category) {
    expenseAccount = await prisma.account.findFirst({
      where: {
        tenantId,
        accountType: 'Expense',
        isActive: true,
        accountName: { equals: category, mode: 'insensitive' },
      },
    });
  }

  const glCode = expenseAccount?.accountCode || expenseAccount?.code || '';
  if (!expenseAccount || !isPhinduExpenseStructureCode(glCode)) return null;
  return expenseAccount;
};

// GET - Fetch recurring expenses with filtering, sorting, and pagination
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
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const accountId = searchParams.get('accountId');
    const search = searchParams.get('search');
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Build filter object for Prisma
    const where = {
      tenantId: user.tenantId, // Filter by tenant ID for multi-tenancy
    };
    
    // Add status filter if provided
    if (status && status !== 'all') {
      where.status = status;
    }
    
    // Add category filter if provided
    if (accountId && accountId !== 'all') {
      where.expenseAccountId = accountId;
    }

    if (category && category !== 'all') {
      where.category = category;
    }
    
    // Add search filter if provided
    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    // Get total count for pagination
    const totalCount = await prisma.recurringExpense.count({ where });
    
    // Build sort object for Prisma
    const orderBy = { [sortBy]: sortOrder === 'asc' ? 'asc' : 'desc' };
    
    // Fetch recurring expenses
    const recurringExpenses = await prisma.recurringExpense.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
          }
        },
        history: {
          select: {
            id: true,
            expenseId: true,
            scheduledDate: true,
            processedDate: true,
            status: true,
          },
          orderBy: {
            scheduledDate: 'desc'
          },
          take: 3 // Only get the last 3 history entries
        }
      }
    });
    
    // Format the recurring expenses data
    const formattedExpenses = recurringExpenses.map(expense => ({
      ...expense,
      // Format the amount for display
      amount: expense.amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }),
      // Format dates for display
      startDate: expense.startDate.toISOString().split('T')[0],
      endDate: expense.endDate ? expense.endDate.toISOString().split('T')[0] : null,
      lastRunDate: expense.lastRunDate ? expense.lastRunDate.toISOString().split('T')[0] : null,
      nextRunDate: expense.nextRunDate ? expense.nextRunDate.toISOString().split('T')[0] : null,
      // Format history dates
      history: expense.history.map(entry => ({
        ...entry,
        scheduledDate: entry.scheduledDate.toISOString().split('T')[0],
        processedDate: entry.processedDate.toISOString().split('T')[0]
      })),
      // Count total history items
      totalHistory: expense.history.length
    }));
    
    // Return recurring expenses with pagination metadata
    return NextResponse.json({
      recurringExpenses: formattedExpenses,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching recurring expenses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recurring expenses. Please try again.' },
      { status: 500 }
    );
  }
}

// POST - Create a new recurring expense
export async function POST(request) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    
    // Validate required fields
    if (!body.description || !body.amount || !body.frequency || !body.startDate) {
      return NextResponse.json(
        { error: 'Description, amount, frequency, and start date are required' },
        { status: 400 }
      );
    }
    
    // Parse amount - convert string to number if needed
    const amount = typeof body.amount === 'string' 
      ? parseFloat(body.amount.replace(/,/g, ''))
      : body.amount;
    
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      );
    }
    
    // Validate frequency-specific fields
    if (body.frequency === 'monthly' && (isNaN(body.dayOfMonth) || body.dayOfMonth < 1 || body.dayOfMonth > 31)) {
      return NextResponse.json(
        { error: 'Day of month must be between 1 and 31' },
        { status: 400 }
      );
    }
    
    if (body.frequency === 'weekly' && (isNaN(body.dayOfWeek) || body.dayOfWeek < 0 || body.dayOfWeek > 6)) {
      return NextResponse.json(
        { error: 'Day of week must be between 0 (Sunday) and 6 (Saturday)' },
        { status: 400 }
      );
    }
    
    // Validate end type specific fields
    if (body.endType === 'occurrences' && (isNaN(body.occurrences) || body.occurrences <= 0)) {
      return NextResponse.json(
        { error: 'Number of occurrences must be a positive number' },
        { status: 400 }
      );
    }
    
    if (body.endType === 'date' && !body.endDate) {
      return NextResponse.json(
        { error: 'End date is required when end type is date' },
        { status: 400 }
      );
    }
    
    const expenseAccount = await resolveExpenseAccount(
      user.tenantId,
      body.expenseAccountId,
      body.category
    );

    if (!expenseAccount) {
      return NextResponse.json(
        { error: 'Valid expense account is required.' },
        { status: 400 }
      );
    }

    // Convert string dates to Date objects
    const startDate = new Date(body.startDate);
    const endDate = body.endDate ? new Date(body.endDate) : null;
    
    // Validate date logic
    if (isNaN(startDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid start date' },
        { status: 400 }
      );
    }
    
    if (endDate && isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid end date' },
        { status: 400 }
      );
    }
    
    if (endDate && startDate >= endDate) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      );
    }
    
    // Normalize to 1st and last day of month for correct monthly reporting and consistency
    const normalizedStartDate = startOfMonth(startDate);
    const normalizedEndDate = endDate ? endOfMonth(endDate) : null;
    
    // Calculate next run date based on frequency, start date, and other parameters
    const nextRunDate = calculateNextRunDate({ ...body, startDate: normalizedStartDate });
    
    // Create the recurring expense
    const recurringExpense = await prisma.recurringExpense.create({
      data: {
        description: body.description,
        amount: amount,
        category: expenseAccount.accountName,
        expenseAccountId: expenseAccount.id,
        frequency: body.frequency,
        dayOfMonth: body.frequency === 'monthly' ? body.dayOfMonth : null,
        dayOfWeek: body.frequency === 'weekly' ? body.dayOfWeek : null,
        startDate: normalizedStartDate,
        endDate: normalizedEndDate,
        occurrences: body.endType === 'occurrences' ? body.occurrences : null,
        remainingOccurrences: body.endType === 'occurrences' ? body.occurrences : null,
        endType: body.endType,
        status: 'Active',
        nextRunDate: nextRunDate,
        notes: body.notes || null,
        createdById: user.id,
        tenantId: user.tenantId,
      }
    });
    
    // Create an audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'RECURRING_EXPENSE_CREATED',
        entityType: 'RECURRING_EXPENSE',
        entityId: recurringExpense.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          description: recurringExpense.description,
          amount: recurringExpense.amount,
          category: recurringExpense.category,
          frequency: recurringExpense.frequency
        })
      }
    });
    
    // Return the created recurring expense
    return NextResponse.json(
      { 
        message: 'Recurring expense created successfully',
        recurringExpense: {
          ...recurringExpense,
          // Format the amount for display
          amount: recurringExpense.amount.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          }),
          // Format dates for display
          startDate: recurringExpense.startDate.toISOString().split('T')[0],
          endDate: recurringExpense.endDate ? recurringExpense.endDate.toISOString().split('T')[0] : null,
          nextRunDate: recurringExpense.nextRunDate ? recurringExpense.nextRunDate.toISOString().split('T')[0] : null,
          history: []
        }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating recurring expense:', error);
    return NextResponse.json(
      { error: 'Failed to create recurring expense. Please try again.' },
      { status: 500 }
    );
  }
}

// Utility function to calculate next run date (should be in lib/recurring-expenses.js)
// This is a simplified version - the actual implementation would be in a shared library
export function calculateNextRunDate(expenseData) {
  const startDate = new Date(expenseData.startDate);
  
  // For testing purposes, set next run date to start date
  return startDate;
}