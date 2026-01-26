// app/api/expenses/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { updateAccountBalance } from '@/lib/core';
import { createExpenseJournalEntry } from '@/lib/transactionJournalHelpers';
import { resolveBranchId } from '@/lib/branchHelpers';

// GET - Fetch expenses with filtering, sorting, and pagination
export async function GET(request) {
  try {
    // Check for standard access
    const accessError = await requireStandardAccess(request);
    if (accessError) {
      return accessError;
    }

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
    const sortBy = searchParams.get('sortBy') || 'date';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const includeDeleted = searchParams.get('includeDeleted');
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Build where clause for filtering
    const whereClause = {
      tenantId: user.tenantId,
      isDeleted: includeDeleted === 'true' ? undefined : false // Exclude deleted by default
    };
    
    // Add branch filter - use provided branchId or user's current branch
    const branchId = searchParams.get('branchId');
    if (branchId) {
      whereClause.branchId = branchId;
    } else if (user?.currentBranchId) {
      // Auto-filter by user's current branch if no branchId provided
      whereClause.branchId = user.currentBranchId;
    }
    
    // Add status filter if provided
    if (status && status !== 'all') {
      whereClause.status = status;
    }
    
    // Add category filter if provided
    if (category && category !== 'all') {
      whereClause.category = category;
    }
    
    // Add date range filter if provided
    if (dateFrom || dateTo) {
      whereClause.date = {};
      if (dateFrom) {
        whereClause.date.gte = new Date(dateFrom);
      }
      if (dateTo) {
        whereClause.date.lte = new Date(dateTo);
      }
    }
    
    // Add search filter if provided
    if (search) {
      whereClause.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    // Get total count for pagination
    const totalCount = await prisma.expense.count({ where: whereClause });
    
    // Build sort object for Prisma
    const orderBy = { [sortBy]: sortOrder === 'asc' ? 'asc' : 'desc' };
    
    // Fetch expenses with user info
    const expenses = await prisma.expense.findMany({
      where: whereClause,
      orderBy,
      skip,
      take: limit,
      include: {
        submittedBy: {
          select: {
            id: true,
            name: true,
          }
        },
        sourceAccount: {
          select: {
            id: true,
            name: true,
          }
        },
        payments: {
          where: { status: 'Completed' },
          orderBy: { paymentDate: 'desc' },
          select: {
            id: true,
            amount: true,
            paymentMethod: true,
            paymentDate: true,
            reference: true,
            notes: true,
            status: true
          }
        }
      }
    });
    
    // Fetch attachments for each expense
    const expensesWithAttachments = await Promise.all(
      expenses.map(async (expense) => {
        // Query for attachments (assuming there's an Attachment model)
        const attachments = await prisma.expenseAttachment.findMany({
          where: {
            expenseId: expense.id
          },
          select: {
            id: true,
            filename: true,
            fileType: true,
            fileSize: true,
            uploadedAt: true,
          }
        });
        
        // Format amounts as strings with thousand separators
        const formattedAmount = expense.amount.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
        
        return {
          ...expense,
          amount: formattedAmount,
          // Format the date as YYYY-MM-DD for consistent display
          date: expense.date.toISOString().split('T')[0],
          attachments: attachments.map(attachment => ({
            id: attachment.id,
            name: attachment.filename,
            type: attachment.fileType,
            size: formatFileSize(attachment.fileSize),
            date: attachment.uploadedAt.toISOString().split('T')[0]
          }))
        };
      })
    );
    
    // Return expenses with pagination metadata
    return NextResponse.json({
      expenses: expensesWithAttachments,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch expenses. Please try again.' },
      { status: 500 }
    );
  }
}

// POST - Create a new expense
export async function POST(request) {
  try {
    // Check for standard access
    const accessError = await requireStandardAccess(request);
    if (accessError) {
      return accessError;
    }

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
    if (!body.description || !body.amount || !body.date || !body.category) {
      return NextResponse.json(
        { error: 'Description, amount, date, and category are required' },
        { status: 400 }
      );
    }
    
    // Parse amount - convert string to number if needed
    const amount = typeof body.amount === 'string' 
      ? parseFloat(body.amount.replace(/,/g, ''))
      : body.amount;
    const selectedCategory=body.category==="Other"?body.customCategory:body.category
    const paymentMethod=body.paymentMethod
    const paymentStatus = body.paymentStatus || 'Fully paid';
    const paymentAmount = paymentStatus === 'Partially' ? (body.paidAmount || amount) : amount;
    const expenseDate = body.historicalDate ? new Date(body.historicalDate) : new Date(body.date);
    
    // Resolve branchId from request or user's default branch
    const branchId = await resolveBranchId(user, body.branchId, user.tenantId);
    
    // Create the expense in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the expense
      const expense = await tx.expense.create({
        data: {
          description: body.description,
          amount: amount,
          date: expenseDate,
          category: selectedCategory,
          paymentMethod,
          sourceAccountId: body.sourceAccountId || null,
          merchant: body.merchant || null,
          status: body.status || 'Pending', // Default status is pending
          notes: body.notes || null,
          submittedById: user.id,
          tenantId: user.tenantId,
          branchId: branchId,
          // Payment status fields
          paymentStatus: paymentStatus,
          paidAmount: body.paidAmount || null,
          paymentReference: body.paymentReference || null,
          // Historical expense fields
          isHistorical: body.isHistorical || false,
          historicalDate: body.historicalDate ? new Date(body.historicalDate) : null,
          migrationBatch: body.migrationBatch || null,
          originalReference: body.originalReference || null,
        }
      });
      
      // 🔐 Create payment only if not pending
      let newPayment = null;
      if (paymentStatus !== 'Pending') {
        // Use expense date for paymentDate (historicalDate if set, otherwise expense.date)
        // This ensures historical expenses are recorded with their actual expense date
        const paymentDate = expense.historicalDate || expense.date;
        
        newPayment = await tx.payment.create({
          data: {
            expenseId: expense.id,
            amount: paymentAmount,
            paymentDate: paymentDate, // Use expense date instead of current date
            paymentMethod,
            reference: body.paymentReference || body.description || null,
            status: 'Completed',
            tenantId: user.tenantId,
            branchId: branchId,
            type: "expense",
            sourceAccount: paymentMethod || null
          }
        });
        await updateAccountBalance(user.tenantId, paymentMethod, paymentAmount, "subtract");

        // Create journal entry for expense
        try {
          console.log('🔥 About to create journal entry for expense:', expense.id);
          const journalEntry = await createExpenseJournalEntry({
            tenantId: user.tenantId,
            userId: user.id,
            expenseId: expense.id,
            expenseDate: paymentDate,
            amount: paymentAmount,
            category: selectedCategory,
            paymentMethod,
            tx,
          });
          console.log('✅ Journal entry created successfully:', journalEntry.id);
        } catch (journalError) {
          console.error('❌ Error creating journal entry for expense:', journalError);
          console.error('Journal error details:', {
            message: journalError.message,
            stack: journalError.stack,
            expenseId: expense.id,
            tenantId: user.tenantId,
          });
          // Don't fail the expense creation if journal entry creation fails
        }
      }

      return { expense, payment: newPayment };
    });

    const expense = result.expense;
    const newPayment = result.payment;
    // Create an audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'EXPENSE_CREATED',
        entityType: 'EXPENSE',
        entityId: expense.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          description: expense.description,
          amount: expense.amount,
          category: expense.category
        })
      }
    });
    
    // Return the created expense
    return NextResponse.json(
      { 
        message: 'Expense created successfully',
        expense: {
          ...expense,
          // Format the amount for display
          amount: expense.amount.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          }),
          // Format the date for display
          date: expense.date.toISOString().split('T')[0],
          // Initialize attachments array
          attachments: []
        }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating expense:', error);
    return NextResponse.json(
      { error: 'Failed to create expense. Please try again.' },
      { status: 500 }
    );
  }
}

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
  return Math.round(bytes / 1048576 * 10) / 10 + ' MB';
}