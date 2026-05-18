// app/api/expenses/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { updateAccountBalance } from '@/lib/core';
import { createExpenseJournalEntry } from '@/lib/transactionJournalHelpers';
import { resolveBranchId } from '@/lib/branchHelpers';
import { isSystemExpenseStructurePickerAccount } from '@/lib/systemExpenseCategoryCodes.js';
import { getCogsAccountIdsForExpenseRegister } from '@/lib/getCogsAccountIdsForExpenseRegister';
import { normalizeExpenseAmountsForGl } from '@/lib/expenseGlPosting';
import { addBranchFilterIncludeUnassigned } from '@/lib/dashboardBranchFilter';
import { applyExpenseTextSearchToWhere } from '@/lib/applyExpenseTextSearchToWhere';
import { accountBlocksDirectPosting } from '@/lib/coaDirectPostingEligibility';

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
    
    // Branch: explicit query wins; otherwise include tenant-wide rows (branchId null) so payroll PAYE/NPS
    // and legacy expenses still appear when a branch is selected (matches statistics & export).
    const branchId = searchParams.get('branchId');
    if (branchId) {
      whereClause.branchId = branchId;
    } else {
      addBranchFilterIncludeUnassigned(user, whereClause);
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
    
    // Search (must not overwrite branch OR from addBranchFilterIncludeUnassigned)
    applyExpenseTextSearchToWhere(whereClause, search);
    
    const cogsAccountIds = await getCogsAccountIdsForExpenseRegister(
      prisma,
      user.tenantId
    );

    // Build COGS transaction filter (Prisma `in: []` is invalid — skip GL COGS rows if no accounts)
    const cogsTransactionFilter =
      cogsAccountIds.length > 0
        ? {
            accountId: { in: cogsAccountIds },
            debitAmount: { gt: 0 },
            transaction: {
              tenantId: user.tenantId,
              status: { in: ['posted', 'Posted'] }
            }
          }
        : null;

    if (cogsTransactionFilter) {
      // GL: match branch or unscoped journals (same rule as financial-analytics / P&L COGS)
      if (branchId) {
        cogsTransactionFilter.transaction.branchId = branchId;
      } else if (user?.currentBranchId) {
        const bid =
          typeof user.currentBranchId === 'string'
            ? user.currentBranchId
            : user.currentBranchId?.id;
        if (bid) {
          cogsTransactionFilter.transaction.OR = [{ branchId: bid }, { branchId: null }];
        }
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

      // Drop COGS list rows once the parent GL journal has been reversed (original stays in GL for audit)
      try {
        const reversedParents = await prisma.transaction.findMany({
          where: {
            tenantId: user.tenantId,
            isReversal: true,
            reversedTransactionId: { not: null },
          },
          select: { reversedTransactionId: true },
        });
        const reversedParentIds = [
          ...new Set(reversedParents.map((r) => r.reversedTransactionId).filter(Boolean)),
        ];
        if (reversedParentIds.length > 0) {
          cogsTransactionFilter.transaction.id = { notIn: reversedParentIds };
        }
      } catch (reversalFilterErr) {
        console.warn('COGS reversed-transaction filter skipped:', reversalFilterErr?.message);
      }
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
    const includeSalaryAdvances =
      (!accountId || accountId === 'all') &&
      ((!category || category === 'all' || category === '') ||
        categoryLower === 'salary advance' ||
        category === 'Salary Advance');

    // Build salary advance filter (hide cancelled from the expenses register; manage in HR → Advances)
    const salaryAdvanceFilter = {
      tenantId: user.tenantId,
      status: { not: 'Cancelled' },
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
        (includeCOGS && cogsTransactionFilter && categoryLower !== 'salary advance' && category !== 'Salary Advance')
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
    
    // Build sort object for Prisma - validate sortBy field
    const validSortFields = ['date', 'amount', 'description', 'status', 'createdAt', 'updatedAt', 'category'];
    const validatedSortBy = validSortFields.includes(sortBy) ? sortBy : 'date';
    const orderBy = { [validatedSortBy]: sortOrder === 'asc' ? 'asc' : 'desc' };
    
    // Fetch ALL expenses (without pagination) so we can combine with COGS and re-paginate
    let allExpensesFromDB = [];
    try {
      allExpensesFromDB = await prisma.expense.findMany({
        where: whereClause,
        orderBy,
        include: {
          submittedBy: {
            select: {
              id: true,
              name: true,
            }
          },
          expenseAccount: {
            select: {
              id: true,
              accountCode: true,
              accountName: true,
              accountType: true,
            }
          },
          sourceAccount: {
            select: {
              id: true,
              accountCode: true,
              accountName: true,
              accountType: true,
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
    } catch (queryError) {
      console.error('Error fetching expenses from database:', queryError);
      console.error('Query error details:', {
        message: queryError.message,
        code: queryError.code,
        meta: queryError.meta,
        stack: queryError.stack
      });
      // Return empty array to allow the API to continue with COGS and salary advances
      allExpensesFromDB = [];
    }

    // Fetch COGS transactions if there are COGS accounts and we should include them
    // Exclude COGS when filtering by "Salary Advance"
    let cogsTransactions = [];
    if (includeCOGS && cogsTransactionFilter && categoryLower !== 'salary advance' && category !== 'Salary Advance') {
      const cogsTransactionLines = await prisma.transactionLine.findMany({
        where: cogsTransactionFilter,
        include: {
          transaction: {
            select: {
              id: true,
              date: true,
              description: true,
              reference: true,
              sourceId: true,
              sourceType: true,
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
        transactionReference: line.transaction.reference,
        linkedSaleId:
          line.transaction.sourceType === 'Sale' && line.transaction.sourceId
            ? line.transaction.sourceId
            : null,
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
    
    // Fetch attachments for each expense (defensive: attachments should never break the whole endpoint)
    const expensesWithAttachments = await Promise.all(
      allExpensesFromDB.map(async (expense) => {
        let attachments = [];
        try {
          attachments = await prisma.expenseAttachment.findMany({
            where: { expenseId: expense.id },
            select: {
              id: true,
              filename: true,
              fileType: true,
              fileSize: true,
              uploadedAt: true,
            }
          });
        } catch (attachmentsErr) {
          console.error('Error fetching expense attachments:', attachmentsErr);
          attachments = [];
        }

        const amountNum = typeof expense.amount === 'number' ? expense.amount : Number(expense.amount);
        const formattedAmount = Number.isFinite(amountNum)
          ? amountNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : '0.00';

        // Safely format the date as YYYY-MM-DD
        let formattedDate = new Date().toISOString().split('T')[0];
        if (expense.date) {
          const d = expense.date instanceof Date ? expense.date : new Date(expense.date);
          if (!Number.isNaN(d.getTime())) {
            formattedDate = d.toISOString().split('T')[0];
          }
        }

        return {
          ...expense,
          amount: formattedAmount, // display-ready string
          date: formattedDate,
          attachments: attachments.map((attachment) => ({
            id: attachment.id,
            name: attachment.filename,
            type: attachment.fileType,
            size: formatFileSize(attachment.fileSize),
            date: attachment.uploadedAt
              ? attachment.uploadedAt.toISOString().split('T')[0]
              : new Date().toISOString().split('T')[0],
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
    const formattedExpenses = paginatedExpenses.map((expense) => {
      // Some sources (regular expenses) were already formatted as a string with commas.
      const amountNum =
        typeof expense.amount === 'string'
          ? parseFloat(expense.amount.replace(/,/g, ''))
          : typeof expense.amount === 'number'
            ? expense.amount
            : Number(expense.amount);

      const formattedAmount = Number.isFinite(amountNum)
        ? amountNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '0.00';

      // Safely format the date as YYYY-MM-DD
      let formattedDate = new Date().toISOString().split('T')[0];
      if (expense.date) {
        const d = expense.date instanceof Date ? expense.date : new Date(expense.date);
        if (!Number.isNaN(d.getTime())) {
          formattedDate = d.toISOString().split('T')[0];
        }
      }

      return {
        ...expense,
        amount: formattedAmount,
        date: formattedDate,
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
    
    // Parse amount (total incl. tax) - convert string to number if needed
    let amount = typeof body.amount === 'string'
      ? parseFloat(String(body.amount).replace(/,/g, ''))
      : Number(body.amount);
    if (typeof amount !== 'number' || isNaN(amount) || amount < 0) {
      return NextResponse.json(
        { error: 'Amount must be a valid positive number.' },
        { status: 400 }
      );
    }
    const taxAmount = body.taxAmount != null ? Number(body.taxAmount) : 0;
    const taxRate = body.taxRate != null ? Number(body.taxRate) : 0;

    let journalBase;
    let journalTax;
    try {
      ({ base: journalBase, tax: journalTax } = normalizeExpenseAmountsForGl(amount, taxAmount));
    } catch (normErr) {
      return NextResponse.json(
        { error: normErr.message || 'Invalid amount and tax combination.' },
        { status: 400 }
      );
    }
    
    let expenseAccount = null;
    let expenseCategory = null;
    let selectedCategory = body.category;
    let categoryId = null;

    if (body.expenseAccountId) {
      // Picker value is usually ExpenseCategory id — resolve that first so GL matches the category's linked account.
      const ecByPickerId = await prisma.expenseCategory.findFirst({
        where: { id: body.expenseAccountId, tenantId: user.tenantId },
        include: { account: true },
      });
      if (ecByPickerId?.account) {
        expenseAccount = ecByPickerId.account;
        expenseCategory = ecByPickerId;
        categoryId = ecByPickerId.id;
        selectedCategory = ecByPickerId.name;
      } else {
        expenseAccount = await prisma.account.findFirst({
          where: { id: body.expenseAccountId, tenantId: user.tenantId, accountType: 'Expense' },
        });
        if (expenseAccount) {
          expenseCategory = await prisma.expenseCategory.findFirst({
            where: { tenantId: user.tenantId, accountId: expenseAccount.id },
          });
          if (expenseCategory) {
            categoryId = expenseCategory.id;
            selectedCategory = expenseCategory.name;
          }
        }
      }
    }

    if (!expenseAccount && body.category) {
      expenseCategory = await prisma.expenseCategory.findFirst({
        where: {
          tenantId: user.tenantId,
          name: { equals: body.category, mode: 'insensitive' },
        },
        include: { account: true },
      });

      if (expenseCategory?.account) {
        expenseAccount = expenseCategory.account;
        categoryId = expenseCategory.id;
        selectedCategory = expenseCategory.name;
      }
    }

    if (!expenseAccount) {
      return NextResponse.json(
        {
          error:
            'Invalid expense account. Choose an active expense account from your chart of accounts.',
        },
        { status: 400 }
      );
    }

    if (!isSystemExpenseStructurePickerAccount(expenseAccount)) {
      return NextResponse.json(
        {
          error:
            'That account is not a standard expense category. Select an account from the EXPENSES (5000) structure in Chart of accounts (e.g. 5110–5140, 5200–5210, 5300–5340, 5400, 5500, 5701–5899 custom expenses, 5900).',
        },
        { status: 400 }
      );
    }

    const activeChildCount = await prisma.account.count({
      where: {
        tenantId: user.tenantId,
        parentAccountId: expenseAccount.id,
        isActive: true,
      },
    });
    const postingBlock = accountBlocksDirectPosting(expenseAccount, { activeChildCount });
    if (postingBlock.blocked) {
      return NextResponse.json(
        {
          error: `Cannot post expenses to "${postingBlock.details || expenseAccount.accountName || expenseAccount.accountCode}". ${postingBlock.reason} Choose a sub-account beneath it.`,
        },
        { status: 400 }
      );
    }
    const paymentStatus = body.paymentStatus || 'Fully paid';
    // Default payment method when missing so Payment.create and journal/balance updates don't throw (500)
    const paymentMethod = (body.paymentMethod != null && String(body.paymentMethod).trim() !== '')
      ? String(body.paymentMethod).trim()
      : 'cash';
    const totalWithTax = amount + (taxAmount || 0);
    const paymentAmount = paymentStatus === 'Partially' ? (body.paidAmount ?? totalWithTax) : totalWithTax;
    const paidAmountForExpense =
      paymentStatus === 'Fully paid'
        ? (body.paidAmount != null && body.paidAmount !== ''
            ? Number(body.paidAmount)
            : totalWithTax)
        : paymentStatus === 'Partially'
          ? (body.paidAmount != null ? Number(body.paidAmount) : null)
          : null;
    const rawDate = body.historicalDate ?? body.date;
    const expenseDate = rawDate ? new Date(rawDate) : new Date();
    if (Number.isNaN(expenseDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date. Please provide a valid date.' },
        { status: 400 }
      );
    }
    
    // Resolve default tax type for outflow when not provided (auto-populate from settings)
    let effectiveTaxTypeId = body.taxTypeId != null && String(body.taxTypeId).trim() !== '' ? body.taxTypeId : null;
    if (!effectiveTaxTypeId && taxAmount > 0) {
      const settings = await prisma.tenantSettings.findUnique({
        where: { tenantId: user.tenantId },
        select: { taxOutflowAccountId: true }
      });
      const outflowAccountId = settings?.taxOutflowAccountId ?? null;
      if (outflowAccountId) {
        const defaultOutflow = await prisma.taxType.findFirst({
          where: { tenantId: user.tenantId, status: 'Active', accountId: outflowAccountId },
          select: { id: true }
        });
        if (defaultOutflow) effectiveTaxTypeId = defaultOutflow.id;
      }
      if (!effectiveTaxTypeId) {
        const firstActive = await prisma.taxType.findFirst({
          where: { tenantId: user.tenantId, status: 'Active' },
          select: { id: true }
        });
        if (firstActive) effectiveTaxTypeId = firstActive.id;
      }
    }

    let branchId = null;
    try {
      branchId = await resolveBranchId(user, body.branchId, user.tenantId);
    } catch (branchError) {
      return NextResponse.json(
        { error: branchError.message || 'Invalid branch' },
        { status: 403 }
      );
    }
    
    // Coerce required string fields so Prisma never receives wrong types
    const description = body.description != null ? String(body.description).trim() : '';
    const categoryForCreate = (selectedCategory != null && String(selectedCategory).trim()) ? String(selectedCategory).trim() : 'Uncategorized';
    const statusForCreate = body.status != null ? String(body.status).trim() : 'Pending';

    if (statusForCreate === 'Approved') {
      const hasSupplier =
        body.supplierId != null && String(body.supplierId).trim() !== '';
      if (paymentStatus === 'Pending' && !hasSupplier) {
        return NextResponse.json(
          {
            error:
              'An expense cannot be created as Approved while payment is still pending and no supplier is set. Record payment, add a supplier for Accounts Payable, or leave status as Pending until posting is possible.'
          },
          { status: 400 }
        );
      }
    }

    // Base create data (required and commonly supported fields)
    const expenseCreateData = {
      description: description || 'Expense',
      amount: amount,
      taxAmount: taxAmount,
      taxRate: taxRate,
      date: expenseDate,
      category: categoryForCreate,
      categoryId: categoryId,
      expenseAccountId: expenseAccount.id,
      paymentMethod,
      sourceAccountId: body.sourceAccountId || null,
      merchant: body.merchant != null ? String(body.merchant) : null,
      status: statusForCreate,
      notes: body.notes || null,
      submittedById: user.id,
      tenantId: user.tenantId,
      branchId: branchId,
      paymentStatus: paymentStatus,
      paidAmount: paidAmountForExpense,
      paymentReference: body.paymentReference || null,
      isHistorical: body.isHistorical || false,
      historicalDate: body.historicalDate ? new Date(body.historicalDate) : null,
      migrationBatch: body.migrationBatch || null,
      originalReference: body.originalReference || null,
    };
    // Optional relation fields (supported when Prisma client is generated from current schema)
    if (effectiveTaxTypeId) {
      expenseCreateData.taxTypeId = effectiveTaxTypeId;
    }
    if (body.supplierId != null && String(body.supplierId).trim() !== '') {
      expenseCreateData.supplierId = body.supplierId;
    }

    // Create the expense in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the expense (retry without optional relation fields if client is from older schema)
      let expense;
      try {
        expense = await tx.expense.create({ data: expenseCreateData });
      } catch (createErr) {
        const isUnknownArg = createErr?.message && typeof createErr.message === 'string' &&
          (createErr.message.includes('Unknown argument') || createErr.message.includes('taxTypeId') || createErr.message.includes('supplierId'));
        if (isUnknownArg && (expenseCreateData.taxTypeId != null || expenseCreateData.supplierId != null)) {
          const { taxTypeId: _t, supplierId: _s, ...fallbackData } = expenseCreateData;
          expense = await tx.expense.create({ data: fallbackData });
        } else {
          throw createErr;
        }
      }
      
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
            type: 'expense',
            sourceAccount: paymentMethod || null
          }
        });
        try {
          await updateAccountBalance(user.tenantId, paymentMethod, paymentAmount, 'subtract');
        } catch (balanceError) {
          console.error('Error updating account balance (expense):', balanceError);
          // Don't fail expense creation if balance update fails (e.g. no AccountBalance row yet)
        }

        if (paymentMethod.length >= 20 && /^[a-z0-9]+$/i.test(paymentMethod)) {
          const pa = await tx.paymentAccount.findFirst({
            where: { id: paymentMethod, tenantId: user.tenantId, isActive: true },
            select: { id: true, name: true, accountType: true, coaAccountId: true, isSystem: true },
          });
          if (pa) {
            const { ensurePaymentAccountCoaLink } = await import('@/lib/paymentAccountCoaLink');
            await ensurePaymentAccountCoaLink(user.tenantId, pa, tx);
          }
        }

        // Create journal entry for expense
        console.log('🔥 About to create journal entry for expense:', expense.id);
        await createExpenseJournalEntry({
          tenantId: user.tenantId,
          userId: user.id,
          expenseId: expense.id,
          expenseDate: paymentDate,
          amount: journalBase,
          taxAmount: journalTax,
          taxTypeId: effectiveTaxTypeId || null,
          category: selectedCategory,
          expenseAccountId: expenseAccount.id,
          paymentMethod,
          supplierId: expense.supplierId || null,
          paymentStatus: paymentStatus,
          tx,
        });
        console.log('✅ Journal entry created successfully for expense:', expense.id);
      } else if (paymentStatus === 'Pending' && expense.supplierId) {
        console.log('🔥 About to create journal entry for unpaid supplier expense:', expense.id);
        await createExpenseJournalEntry({
          tenantId: user.tenantId,
          userId: user.id,
          expenseId: expense.id,
          expenseDate: expenseDate,
          amount: journalBase,
          taxAmount: journalTax,
          taxTypeId: effectiveTaxTypeId || null,
          category: selectedCategory,
          expenseAccountId: expenseAccount.id,
          paymentMethod: null,
          supplierId: expense.supplierId,
          paymentStatus: 'Pending',
          tx,
        });
        console.log('✅ Journal entry created successfully for unpaid supplier expense:', expense.id);
      }

      return { expense, payment: newPayment };
    });

    const expense = result.expense;
    const newPayment = result.payment;
    // Create an audit log entry (non-blocking; don't fail the request if this fails)
    try {
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
    } catch (auditError) {
      console.warn('Audit log create failed (expense still created):', auditError?.message);
    }

    if (expense.supplierId) {
      try {
        const { updateSupplierBalance } = await import('@/lib/supplierService');
        await updateSupplierBalance(expense.supplierId, user.tenantId);
      } catch (balErr) {
        console.error('updateSupplierBalance after expense create:', balErr?.message);
      }
    }

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
    const message = error?.message || 'Failed to create expense. Please try again.';
    const directPostingFailure =
      message.includes('consolidation parent') ||
      message.includes('cannot receive direct postings') ||
      message.includes('not open for new postings') ||
      message.includes('Structural chart section headers');
    return NextResponse.json(
      { error: message },
      { status: directPostingFailure ? 400 : 500 }
    );
  }
}

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
  return Math.round(bytes / 1048576 * 10) / 10 + ' MB';
}
