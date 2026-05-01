// app/api/recurring-expenses/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { startOfMonth, endOfMonth } from '@/lib/dateUtils';
import { isSystemExpenseStructurePickerAccount } from '@/lib/systemExpenseCategoryCodes.js';

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

  if (!expenseAccount || !isSystemExpenseStructurePickerAccount(expenseAccount)) return null;
  return expenseAccount;
};

// GET - Fetch a single recurring expense by ID
export async function GET(request, { params }) {
  const { id } = await params;
  const expenseId = id;
  
  try {
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Fetch the recurring expense
    const recurringExpense = await prisma.recurringExpense.findFirst({
      where: {
        id: expenseId,
        tenantId: user.tenantId // Ensure tenant isolation
      },
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
          take: 10 // Get last 10 history entries
        }
      }
    });
    
    if (!recurringExpense) {
      return NextResponse.json(
        { error: 'Recurring expense not found' },
        { status: 404 }
      );
    }
    
    // Format the recurring expense data
    const formattedExpense = {
      ...recurringExpense,
      // Format the amount for display
      amount: recurringExpense.amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }),
      // Format dates for display
      startDate: recurringExpense.startDate.toISOString().split('T')[0],
      endDate: recurringExpense.endDate ? recurringExpense.endDate.toISOString().split('T')[0] : null,
      lastRunDate: recurringExpense.lastRunDate ? recurringExpense.lastRunDate.toISOString().split('T')[0] : null,
      nextRunDate: recurringExpense.nextRunDate ? recurringExpense.nextRunDate.toISOString().split('T')[0] : null,
      // Format history dates
      history: recurringExpense.history.map(entry => ({
        ...entry,
        scheduledDate: entry.scheduledDate.toISOString().split('T')[0],
        processedDate: entry.processedDate ? entry.processedDate.toISOString().split('T')[0] : null
      }))
    };
    
    return NextResponse.json(formattedExpense);
  } catch (error) {
    console.error('Error fetching recurring expense:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recurring expense. Please try again.' },
      { status: 500 }
    );
  }
}

// PUT - Update an existing recurring expense
export async function PUT(request, { params }) {
  const { id } = await params;
  const expenseId = id;
  
  try {
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Check if recurring expense exists and belongs to tenant
    const existingExpense = await prisma.recurringExpense.findFirst({
      where: {
        id: expenseId,
        tenantId: user.tenantId
      }
    });
    
    if (!existingExpense) {
      return NextResponse.json(
        { error: 'Recurring expense not found' },
        { status: 404 }
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
    
    // Import calculateNextRunDate from the main route
    // For now, we'll calculate it here (should be in a shared lib)
    const calculateNextRunDate = (expenseData) => {
      const start = new Date(expenseData.startDate);
      const now = new Date();
      
      if (expenseData.frequency === 'weekly') {
        const dayOfWeek = expenseData.dayOfWeek || 1;
        const daysUntilNext = (dayOfWeek - start.getDay() + 7) % 7 || 7;
        const next = new Date(start);
        next.setDate(start.getDate() + daysUntilNext);
        return next > now ? next : new Date(next.getTime() + 7 * 24 * 60 * 60 * 1000);
      } else if (expenseData.frequency === 'monthly') {
        const dayOfMonth = expenseData.dayOfMonth || start.getDate();
        const next = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
        if (next <= now) {
          next.setMonth(next.getMonth() + 1);
        }
        return next;
      } else if (expenseData.frequency === 'quarterly') {
        const next = new Date(start);
        while (next <= now) {
          next.setMonth(next.getMonth() + 3);
        }
        return next;
      } else if (expenseData.frequency === 'yearly') {
        const next = new Date(start);
        while (next <= now) {
          next.setFullYear(next.getFullYear() + 1);
        }
        return next;
      }
      return start;
    };
    
    // Update the recurring expense
    const updatedExpense = await prisma.recurringExpense.update({
      where: { id: expenseId },
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
        nextRunDate: calculateNextRunDate({ ...body, startDate: normalizedStartDate }),
        notes: body.notes || null,
      }
    });
    
    // Create an audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'RECURRING_EXPENSE_UPDATED',
        entityType: 'RECURRING_EXPENSE',
        entityId: updatedExpense.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          description: updatedExpense.description,
          amount: updatedExpense.amount,
          category: updatedExpense.category,
          frequency: updatedExpense.frequency
        })
      }
    });
    
    // Return the updated recurring expense
    return NextResponse.json({
      message: 'Recurring expense updated successfully',
      recurringExpense: {
        ...updatedExpense,
        // Format the amount for display
        amount: updatedExpense.amount.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }),
        // Format dates for display
        startDate: updatedExpense.startDate.toISOString().split('T')[0],
        endDate: updatedExpense.endDate ? updatedExpense.endDate.toISOString().split('T')[0] : null,
        nextRunDate: updatedExpense.nextRunDate ? updatedExpense.nextRunDate.toISOString().split('T')[0] : null,
      }
    });
  } catch (error) {
    console.error('Error updating recurring expense:', error);
    return NextResponse.json(
      { error: 'Failed to update recurring expense. Please try again.' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a recurring expense
export async function DELETE(request, { params }) {
  const { id } = await params;
  const expenseId = id;
  
  try {
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Check if recurring expense exists and belongs to tenant
    const existingExpense = await prisma.recurringExpense.findFirst({
      where: {
        id: expenseId,
        tenantId: user.tenantId
      }
    });
    
    if (!existingExpense) {
      return NextResponse.json(
        { error: 'Recurring expense not found' },
        { status: 404 }
      );
    }
    
    // Delete the recurring expense
    await prisma.recurringExpense.delete({
      where: { id: expenseId }
    });
    
    // Create an audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'RECURRING_EXPENSE_DELETED',
        entityType: 'RECURRING_EXPENSE',
        entityId: expenseId,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          description: existingExpense.description,
          amount: existingExpense.amount,
          category: existingExpense.category
        })
      }
    });
    
    return NextResponse.json({
      message: 'Recurring expense deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting recurring expense:', error);
    return NextResponse.json(
      { error: 'Failed to delete recurring expense. Please try again.' },
      { status: 500 }
    );
  }
}

