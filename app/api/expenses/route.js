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
    const accountId = searchParams.get('accountId');
    const search = searchParams.get('search');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const includeDeleted = searchParams.get('includeDeleted');
    const supplierId = searchParams.get('supplierId');
    
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
    
    // Add account filter if provided
    if (accountId && accountId !== 'all') {
      whereClause.expenseAccountId = accountId;
    }

    // Add category filter if provided (legacy support)
    if (category && category !== 'all') {
      whereClause.category = category;
    }
    
    // Add supplier filter if provided
    if (supplierId) {
      whereClause.supplierId = supplierId;
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
    
    // Find COGS account(s) for this tenant
    const cogsAccounts = await prisma.account.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true,
        accountType: 'Expense',
        OR: [
          { accountCode: '5000' },
          { code: '5000' },
          { accountName: { contains: 'cost of goods', mode: 'insensitive' } },
          { accountName: { contains: 'cogs', mode: 'insensitive' } },
          { name: { contains: 'cost of goods', mode: 'insensitive' } },
          { name: { contains: 'cogs', mode: 'insensitive' } }
        ]
      },
      select: { id: true, accountName: true, name: true }
    });
    const cogsAccountIds = cogsAccounts.map(acc => acc.id);

    // Build COGS transaction filter
    const cogsTransactionFilter = {
      accountId: { in: cogsAccountIds },
      debitAmount: { gt: 0 },
      transaction: {
        tenantId: user.tenantId,
        status: 'posted'
      }
    };

    // Add branch filter to COGS transactions if applicable
    if (branchId) {
      cogsTransactionFilter.transaction.branchId = branchId;
    } else if (user?.currentBranchId) {
      cogsTransactionFilter.transaction.branchId = user.currentBranchId;
    }

    // Add date range filter to COGS transactions if provided
    if (dateFrom || dateTo) {
      cogsTransactionFilter.transaction.date = {};
      if (dateFrom) {
        cogsTransactionFilter.transaction.date.gte = new Date(dateFrom);
      }
      if (dateTo) {
        cogsTransactionFilter.transaction.date.lte = new Date(dateTo);
      }
    }

    // Add search filter to COGS transactions if provided
    if (search) {
      cogsTransactionFilter.transaction.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Check if we should include COGS transactions
    // If category filter is set and it's not "Cost of Goods Sold" or "COGS", exclude COGS
    const categoryLower = typeof category === 'string' ? category.toLowerCase() : '';
    const includeCOGS = !category || 
      category === 'all' || 
      categoryLower.includes('cost of goods') || 
      categoryLower.includes('cogs');

    // Check if we should include salary advances
    // Include salary advances when no category filter is applied or when specifically filtering for "Salary Advance"
    const includeSalaryAdvances = (!accountId && (!category || category === 'all' || category === '')) ||
      categoryLower === 'salary advance' ||
      category === 'Salary Advance';
    
    console.log('🔍 Salary advances inclusion check:', {
      category,
      categoryLower,
      includeSalaryAdvances,
      categoryType: typeof category
    });

    // Build salary advance filter
    const salaryAdvanceFilter = {
      tenantId: user.tenantId
    };
    
    // Note: We don't filter salary advances by branchId because they might not have branchId set
    // This ensures all salary advances are visible regardless of branch

    // Add date range filter to salary advances if provided
    if (dateFrom || dateTo) {
      salaryAdvanceFilter.advanceDate = {};
      if (dateFrom) {
        salaryAdvanceFilter.advanceDate.gte = new Date(dateFrom);
      }
      if (dateTo) {
        salaryAdvanceFilter.advanceDate.lte = new Date(dateTo);
      }
    }

    // Add search filter to salary advances if provided
    if (search) {
      salaryAdvanceFilter.OR = [
        { reference: { contains: search, mode: 'insensitive' } },
        { employee: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }

    // Get total count for pagination (expenses + COGS transactions + salary advances)
    // If filtering by "Salary Advance", exclude regular expenses and COGS from count
    let expenseCount = 0, cogsCount = 0, salaryAdvanceCount = 0;
    try {
      [expenseCount, cogsCount, salaryAdvanceCount] = await Promise.all([
        (categoryLower === 'salary advance' || category === 'Salary Advance')
          ? Promise.resolve(0) // Don't count regular expenses when filtering by Salary Advance
          : prisma.expense.count({ where: whereClause }),
        (includeCOGS && cogsAccountIds.length > 0 && categoryLower !== 'salary advance' && category !== 'Salary Advance')
          ? prisma.transactionLine.count({ where: cogsTransactionFilter }) 
          : Promise.resolve(0),
        includeSalaryAdvances
          ? prisma.salaryAdvance.count({ where: salaryAdvanceFilter })
          : Promise.resolve(0)
      ]);
    } catch (countError) {
      console.error('Error counting records:', countError);
      // Continue with 0 counts to allow the API to still return data
      console.warn('Continuing with 0 counts due to counting error');
    }
    const totalCount = expenseCount + cogsCount + salaryAdvanceCount;
    
    // Build sort object for Prisma
    const orderBy = { [sortBy]: sortOrder === 'asc' ? 'asc' : 'desc' };
    
    // Fetch ALL expenses (without pagination) so we can combine with COGS and re-paginate
    const allExpensesFromDB = await prisma.expense.findMany({
      where: whereClause,
      orderBy,
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
        supplier: {
          select: {
            id: true,
            supplierName: true,
            email: true,
            phone: true,
            paymentPreference: true,
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

    // Fetch COGS transactions if there are COGS accounts and we should include them
    // Exclude COGS when filtering by "Salary Advance"
    let cogsTransactions = [];
    if (includeCOGS && cogsAccountIds.length > 0 && categoryLower !== 'salary advance' && category !== 'Salary Advance') {
      const cogsTransactionLines = await prisma.transactionLine.findMany({
        where: cogsTransactionFilter,
        include: {
          transaction: {
            select: {
              id: true,
              date: true,
              description: true,
              reference: true
            }
          },
          account: {
            select: {
              id: true,
              accountName: true,
              name: true
            }
          }
        },
        orderBy: {
          transaction: {
            date: sortOrder === 'asc' ? 'asc' : 'desc'
          }
        }
      });

      // Convert COGS transactions to expense-like format
      cogsTransactions = cogsTransactionLines.map(line => ({
        id: `cogs-${line.transaction.id}-${line.id}`, // Unique ID for COGS entries
        description: line.transaction.description || `COGS - ${line.transaction.reference || 'Sale'}`,
        amount: Number(line.debitAmount),
        date: line.transaction.date,
        category: 'Cost of Goods Sold',
        status: 'Approved', // COGS transactions are always approved
        merchant: null,
        notes: `Automated COGS entry from ${line.transaction.reference || 'sale'}`,
        submittedBy: {
          id: 'system',
          name: 'System'
        },
        sourceAccount: {
          id: line.account.id,
          name: line.account.accountName || line.account.name
        },
        payments: [], // COGS doesn't have payments
        attachments: [],
        isCOGS: true, // Flag to identify COGS entries
        transactionId: line.transaction.id,
        transactionReference: line.transaction.reference
      }));
    }

    // Fetch salary advances if we should include them
    let salaryAdvanceExpenses = [];
    if (includeSalaryAdvances) {
      try {
        console.log('📋 Fetching salary advances with filter:', JSON.stringify(salaryAdvanceFilter, null, 2));
        const salaryAdvances = await prisma.salaryAdvance.findMany({
          where: salaryAdvanceFilter,
          include: {
            employee: {
              select: {
                id: true,
                name: true,
                employeeId: true
              }
            }
          },
          orderBy: {
            advanceDate: sortOrder === 'asc' ? 'asc' : 'desc'
          }
        });
        console.log(`✅ Found ${salaryAdvances.length} salary advances for tenant ${user.tenantId}`);

        // Convert salary advances to expense-like format
        salaryAdvanceExpenses = salaryAdvances.map(advance => ({
        id: `salary-advance-${advance.id}`, // Unique ID for salary advance entries
        description: `Salary Advance: ${advance.employee?.name || 'Employee'}${advance.reference ? ` (${advance.reference})` : ''}`,
        amount: Number(advance.amount),
        date: advance.advanceDate,
        category: 'Salary Advance',
        status: 'Approved', // Salary advances are always approved
        merchant: null,
        notes: advance.notes || `Salary advance for ${advance.employee?.name || 'employee'} - ${advance.repaymentMonths} month(s) repayment`,
        submittedBy: {
          id: 'system',
          name: 'System'
        },
        sourceAccount: {
          id: 'salary-advance-receivable',
          name: 'Salary Advance Receivable'
        },
        payments: [], // Salary advances don't have separate payments
        attachments: [],
        isSalaryAdvance: true, // Flag to identify salary advance entries
        salaryAdvanceId: advance.id,
        employeeName: advance.employee?.name,
        employeeId: advance.employee?.employeeId,
        reference: advance.reference,
        outstandingAmount: advance.outstandingAmount,
        totalDeducted: advance.totalDeducted
      }));
      } catch (salaryAdvanceError) {
        console.error('Error fetching salary advances:', salaryAdvanceError);
        // Continue with empty salary advances
        salaryAdvanceExpenses = [];
      }
    }
    
    // Fetch attachments for each expense
    const expensesWithAttachments = await Promise.all(
      allExpensesFromDB.map(async (expense) => {
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
        
        // Safely format the date
        const formattedDate = expense.date 
          ? expense.date.toISOString().split('T')[0] 
          : new Date().toISOString().split('T')[0]; // Fallback to today if date is null
        
        return {
          ...expense,
          amount: formattedAmount,
          // Format the date as YYYY-MM-DD for consistent display
          date: formattedDate,
          attachments: attachments.map(attachment => ({
            id: attachment.id,
            name: attachment.filename,
            type: attachment.fileType,
            size: formatFileSize(attachment.fileSize),
            date: attachment.uploadedAt ? attachment.uploadedAt.toISOString().split("T")[0] : new Date().toISOString().split("T")[0]
          })),
          isCOGS: false // Flag to identify regular expenses
        };
      })
    );

    // Combine expenses, COGS transactions, and salary advances
    // If filtering by "Salary Advance", only include salary advances
    let expensesToCombine = expensesWithAttachments;
    if (categoryLower === 'salary advance' || category === 'Salary Advance') {
      // When filtering by Salary Advance, exclude regular expenses and COGS
      expensesToCombine = [];
    }
    
    console.log(`📊 Combining expenses: ${expensesToCombine.length} regular, ${cogsTransactions.length} COGS, ${salaryAdvanceExpenses.length} salary advances`);
    const allExpenses = [...expensesToCombine, ...cogsTransactions, ...salaryAdvanceExpenses];

    // Sort combined list by date (or other sort field)
    allExpenses.sort((a, b) => {
      const dateA = a.date ? new Date(a.date) : new Date(0);
      const dateB = b.date ? new Date(b.date) : new Date(0);
      
      if (sortBy === 'date') {
        return sortOrder === 'asc' 
          ? dateA - dateB 
          : dateB - dateA;
      } else if (sortBy === 'amount') {
        const amountA = typeof a.amount === 'string' 
          ? parseFloat(a.amount.replace(/,/g, '')) 
          : a.amount;
        const amountB = typeof b.amount === 'string' 
          ? parseFloat(b.amount.replace(/,/g, '')) 
          : b.amount;
        return sortOrder === 'asc' 
          ? amountA - amountB 
          : amountB - amountA;
      } else if (sortBy === 'description') {
        return sortOrder === 'asc'
          ? (a.description || '').localeCompare(b.description || '')
          : (b.description || '').localeCompare(a.description || '');
      }
      return 0;
    });

    // Apply pagination to combined list
    const paginatedExpenses = allExpenses.slice(skip, skip + limit);

    // Format COGS transaction and salary advance amounts
    const formattedExpenses = paginatedExpenses.map(expense => {
      // Format amount
      const formattedAmount = expense.amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      
      // Safely format the date
      const formattedDate = expense.date 
        ? (expense.date instanceof Date 
            ? expense.date.toISOString().split('T')[0] 
            : expense.date)
        : new Date().toISOString().split('T')[0];
      
      return {
        ...expense,
        amount: formattedAmount,
        date: formattedDate
      };
    });
    
    // Return expenses with pagination metadata
    return NextResponse.json({
      expenses: formattedExpenses,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
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
    if (!body.description || !body.amount || !body.date || (!body.expenseAccountId && !body.category)) {
      return NextResponse.json(
        { error: 'Description, amount, date, and expense account are required' },
        { status: 400 }
      );
    }
    
    // Parse amount - convert string to number if needed
    const amount = typeof body.amount === 'string' 
      ? parseFloat(body.amount.replace(/,/g, ''))
      : body.amount;
    let expenseAccount = null;
    if (body.expenseAccountId) {
      expenseAccount = await prisma.account.findFirst({
        where: { id: body.expenseAccountId, tenantId: user.tenantId, accountType: 'Expense' }
      });
    }

    if (!expenseAccount && body.category) {
      expenseAccount = await prisma.account.findFirst({
        where: {
          tenantId: user.tenantId,
          accountType: 'Expense',
          accountName: { equals: body.category, mode: 'insensitive' }
        }
      });
    }

    if (!expenseAccount) {
      return NextResponse.json(
        { error: 'Invalid expense account. Please select a valid expense account from the Chart of Accounts.' },
        { status: 400 }
      );
    }

    const selectedCategory = expenseAccount.accountName;
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
          expenseAccountId: expenseAccount.id,
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
          // Supplier linking
          supplierId: body.supplierId || null,
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
            expenseAccountId: expenseAccount.id,
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