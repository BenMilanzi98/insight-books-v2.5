// app/api/expenses/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requirePermission } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { resolveBranchId } from '@/lib/branchHelpers';
import { fetchCogsExpenseRegisterRows } from '@/lib/fetchCogsExpenseRegisterRows';
import {
  normalizeExpenseAmountsForGl,
  postApprovedExpenseJournalIfMissing,
} from '@/lib/expenseGlPosting';
import { addBranchFilterIncludeUnassigned } from '@/lib/dashboardBranchFilter';
import { applyExpenseTextSearchToWhere } from '@/lib/applyExpenseTextSearchToWhere';
import { roundMoney } from '@/lib/money';
import { resolveExpenseAccountSelection } from '@/lib/accountingMappingRules';

function isOptionalExpenseFieldSchemaError(err) {
  const msg = String(err?.message || '');
  return (
    msg.includes('Unknown argument') ||
    msg.includes('does not exist in the current database') ||
    msg.includes('taxTypeId') ||
    msg.includes('supplierId')
  );
}

function stripOptionalExpenseCreateFields(data) {
  const { taxTypeId: _t, supplierId: _s, ...rest } = data;
  return rest;
}

// GET - Fetch expenses with filtering, sorting, and pagination
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'expenses.view');
    if (perm) return perm;

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
    const paymentStatus = searchParams.get('paymentStatus');
    const isHistorical = searchParams.get('isHistorical');
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Build where clause for filtering
    const whereClause = {
      tenantId: user.tenantId,
      isDeleted: includeDeleted === 'true' ? undefined : false // Exclude deleted by default
    };

    const andWhere = (clause) => {
      if (whereClause.AND) {
        whereClause.AND.push(clause);
      } else if (whereClause.OR) {
        whereClause.AND = [{ OR: whereClause.OR }, clause];
        delete whereClause.OR;
      } else {
        Object.assign(whereClause, clause);
      }
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

    // Payment status filter (card filters on /expenses)
    // paymentStatus is required (non-null) with default "Fully paid"
    if (paymentStatus && paymentStatus !== 'all') {
      andWhere({ paymentStatus });
    }

    if (isHistorical === 'true' || isHistorical === '1') {
      andWhere({ isHistorical: true });
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

    // Prefetch GL COGS (legacy Transaction + V2 JournalEntry) for count + list merge
    let cogsRegisterRows = [];
    if (includeCOGS && categoryLower !== 'salary advance' && category !== 'Salary Advance') {
      try {
        cogsRegisterRows = await fetchCogsExpenseRegisterRows(prisma, {
          tenantId: user.tenantId,
          branchIdParam: branchId || undefined,
          currentBranchId: user?.currentBranchId,
          dateFrom,
          dateTo,
          search,
          category,
        });
      } catch (cogsFetchErr) {
        console.error('Error fetching GL COGS for expense register:', cogsFetchErr);
        cogsRegisterRows = [];
      }
    }

    // Get total count for pagination (expenses + COGS transactions + salary advances)
    // If filtering by "Salary Advance", exclude regular expenses and COGS from count
    let expenseCount = 0, salaryAdvanceCount = 0;
    const cogsCount = cogsRegisterRows.length;
    try {
      [expenseCount, salaryAdvanceCount] = await Promise.all([
        (categoryLower === 'salary advance' || category === 'Salary Advance')
          ? Promise.resolve(0) // Don't count regular expenses when filtering by Salary Advance
          : prisma.expense.count({ where: whereClause }),
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

    // Map GL COGS rows into expense-list shape (positive debit amount for register display)
    const cogsTransactions = cogsRegisterRows.map((row) => {
      const signed = Number(row.amount) || 0;
      const displayAmount = Math.abs(signed);
      let formattedDate = new Date().toISOString().split('T')[0];
      if (row.date) {
        const d = row.date instanceof Date ? row.date : new Date(row.date);
        if (!Number.isNaN(d.getTime())) {
          formattedDate = d.toISOString().split('T')[0];
        }
      }
      return {
        ...row,
        amount: displayAmount,
        date: formattedDate,
        merchant: row.merchant || null,
        isCOGS: true,
        status: 'Approved',
        paymentStatus: signed < 0 ? 'GL credit' : 'Fully paid',
        attachments: Array.isArray(row.attachments) ? row.attachments : [],
      };
    });

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
          attachments: attachments.map((attachment) => {
            const raw = String(attachment.filePath || '');
            const url = raw.startsWith('/api/')
              ? raw
              : raw.startsWith('/uploads/')
                ? `/api${raw}`
                : raw
                  ? `/api/uploads/${raw.replace(/^\/+/, '')}`
                  : null;
            return {
              id: attachment.id,
              name: attachment.filename,
              type: attachment.fileType,
              size: formatFileSize(attachment.fileSize),
              url,
              date: attachment.uploadedAt
                ? attachment.uploadedAt.toISOString().split('T')[0]
                : new Date().toISOString().split('T')[0],
            };
          }),
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
    const perm = await requirePermission(request, 'expenses.create');
    if (perm) return perm;

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
    amount = roundMoney(amount);
    const taxAmount = body.taxAmount != null ? roundMoney(body.taxAmount) : 0;
    const taxRate = body.taxRate != null ? roundMoney(body.taxRate) : 0;

    try {
      normalizeExpenseAmountsForGl(amount, taxAmount);
    } catch (normErr) {
      return NextResponse.json(
        { error: normErr.message || 'Invalid amount and tax combination.' },
        { status: 400 }
      );
    }
    
    let expenseAccount;
    let expenseCategory = null;
    let selectedCategory = body.category;
    let categoryId = null;

    try {
      const resolved = await resolveExpenseAccountSelection(
        user.tenantId,
        { expenseAccountId: body.expenseAccountId, category: body.category },
        prisma
      );
      expenseAccount = resolved.account;
      expenseCategory = resolved.expenseCategory;
      selectedCategory = resolved.categoryName || expenseAccount.accountName || body.category;
      if (!expenseCategory) {
        expenseCategory = await prisma.expenseCategory.findFirst({
          where: { tenantId: user.tenantId, accountId: expenseAccount.id },
        });
      }
      categoryId = expenseCategory?.id || null;
    } catch (accountError) {
      return NextResponse.json(
        { error: accountError.message || 'Invalid expense account.' },
        { status: 400 }
      );
    }
    const paymentStatus = body.paymentStatus || 'Fully paid';
    // Default payment method when missing so Payment.create and journal/balance updates don't throw (500)
    const paymentMethod = (body.paymentMethod != null && String(body.paymentMethod).trim() !== '')
      ? String(body.paymentMethod).trim()
      : 'cash';
    const grossAmount = roundMoney(amount);
    const paymentAmount =
      paymentStatus === 'Partially'
        ? roundMoney(body.paidAmount ?? grossAmount)
        : grossAmount;

    if (paymentStatus !== 'Pending' && paymentMethod && paymentMethod !== 'cash') {
      const { assertPaymentAccountHasFunds } = await import(
        '@/lib/paymentAccountBalanceResolver'
      );
      const funds = await assertPaymentAccountHasFunds(
        user.tenantId,
        paymentMethod,
        paymentAmount
      );
      if (!funds.ok) {
        return NextResponse.json(
          {
            error: funds.message,
            code: funds.code,
            available: funds.available,
            required: funds.required,
            shortfall: funds.shortfall,
          },
          { status: 400 }
        );
      }
    }
    const paidAmountForExpense =
      paymentStatus === 'Fully paid'
        ? body.paidAmount != null && body.paidAmount !== ''
            ? roundMoney(body.paidAmount)
            : grossAmount
        : paymentStatus === 'Partially'
          ? body.paidAmount != null
            ? roundMoney(body.paidAmount)
            : null
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
    let statusForCreate;
    try {
      const { assertExpenseCreateStatus } = await import('@/lib/expenses/expenseStateMachine');
      statusForCreate = assertExpenseCreateStatus(
        body.status != null ? String(body.status).trim() : 'Approved'
      );
    } catch (smErr) {
      return NextResponse.json(
        { error: smErr.message, code: smErr.code || 'EXPENSE_INVALID_CREATE_STATUS' },
        { status: 400 }
      );
    }

    if (statusForCreate === 'Approved') {
      // Posted expenses are Approved by default — expenses.create is sufficient (no separate approval step).
      const hasSupplier =
        body.supplierId != null && String(body.supplierId).trim() !== '';
      if (paymentStatus === 'Pending' && !hasSupplier) {
        return NextResponse.json(
          {
            error:
              'An expense cannot be posted while payment is still pending and no supplier is set. Record payment, add a supplier for Accounts Payable, or set payment status so the expense can post.'
          },
          { status: 400 }
        );
      }
    }

    // Base create data (required and commonly supported fields)
    const expenseCreateData = {
      description: description || 'Expense',
      amount: grossAmount,
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
        if (
          isOptionalExpenseFieldSchemaError(createErr) &&
          (expenseCreateData.taxTypeId != null || expenseCreateData.supplierId != null)
        ) {
          expense = await tx.expense.create({
            data: stripOptionalExpenseCreateFields(expenseCreateData),
          });
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

      }

      // V2: post via postExpenseAccounting when Approved (idempotent if already posted)
      await postApprovedExpenseJournalIfMissing({
        tx,
        tenantId: user.tenantId,
        userId: user.id,
        expense,
      });

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
    const code = error?.code;
    const glEligibilityFailure =
      code === 'EXPENSE_TAX_EXCEEDS_GROSS' ||
      code === 'EXPENSE_GL_PENDING_NO_SUPPLIER' ||
      code === 'EXPENSE_GL_NO_ACCOUNT' ||
      code === 'EXPENSE_GL_NO_PAYMENT_METHOD' ||
      message.includes('general ledger') ||
      message.includes('Tax amount cannot exceed') ||
      message.includes('Payment method is required') ||
      message.includes('Expense account is required') ||
      message.includes('unpaid and has no supplier');
    const directPostingFailure =
      message.includes('consolidation parent') ||
      message.includes('cannot receive direct postings') ||
      message.includes('not open for new postings') ||
      message.includes('Structural chart section headers');
    return NextResponse.json(
      { error: message },
      { status: glEligibilityFailure || directPostingFailure ? 400 : 500 }
    );
  }
}

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
  return Math.round(bytes / 1048576 * 10) / 10 + ' MB';
}
