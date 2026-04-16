// app/api/accounts/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

/**
 * GET handler for chart of accounts
 * Fetches all accounts with filtering, sorting, and pagination
 */
export async function GET(request) {
  try {
    // Check for standard access (trial or paid subscription)
    const accessError = await requireStandardAccess(request);
    if (accessError) {
      return accessError;
    }

    // Authenticate user and get tenant ID
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated with this user' },
        { status: 401 }
      );
    }
    
    const tenantId = user.tenantId;
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const forSelect = searchParams.get('forSelect') === 'true';
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const includeMergedSources = searchParams.get('includeMergedSources') === 'true';

    // Parse query parameters - forSelect returns full list of active accounts (e.g. journal entry dropdown)
    const page = parseInt(searchParams.get('page')) || 1;
    const rawLimit = searchParams.get('limit');
    const limit = forSelect
      ? 20000
      : (rawLimit === 'all' ? 5000 : parseInt(rawLimit) || 100);
    const sortBy = searchParams.get('sortBy') || (forSelect ? 'accountCode' : 'code');
    const sortOrder = searchParams.get('sortOrder') || 'asc';
    const type = searchParams.get('type'); // Filter by account type
    const search = searchParams.get('search');

    // Build filter object for Prisma
    const where = {
      tenantId
    };

    // When forSelect (e.g. journal entry): active accounts by default; includeInactive for GL "all accounts" picker
    if (forSelect && !includeInactive) {
      where.isActive = true;
    }

    // Logical merges: keep source rows in DB for audit; exclude from lists/pickers unless auditing.
    if (!includeMergedSources) {
      where.mergedIntoAccountId = null;
    }

    // Add account type filter if provided (Account has both type and accountType)
    if (type && type !== 'all') {
      where.AND = [
        { OR: [{ type: type }, { accountType: type }] }
      ];
    }

    // Add search filter if provided
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { accountName: { contains: search, mode: 'insensitive' } },
        { accountCode: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Get total count
    const totalCount = await prisma.account.count({
      where
    });

    // Pagination: skip when not forSelect or when paginating
    const skip = forSelect ? 0 : (page - 1) * limit;
    const take = forSelect ? 20000 : limit;

    // forSelect: order by id so NULL accountCode never drops or reorders rows; sort for display in JS.
    const orderBy = forSelect
      ? { id: 'asc' }
      : sortBy === 'accountCode'
        ? [{ accountCode: sortOrder }, { code: sortOrder }]
        : { [sortBy]: sortOrder };

    let accounts = await prisma.account.findMany({
      where,
      orderBy,
      skip,
      take,
      include: forSelect
        ? {
            parentAccount: {
              select: {
                id: true,
                accountCode: true,
                accountName: true,
                code: true,
                name: true,
              },
            },
          }
        : undefined,
    });

    if (forSelect && Array.isArray(accounts)) {
      accounts = accounts.map((acc) => ({
        ...acc,
        code: acc.code ?? acc.accountCode ?? '',
        name: acc.name ?? acc.accountName ?? '',
        accountCode: acc.accountCode ?? acc.code ?? '',
        accountName: acc.accountName ?? acc.name ?? '',
      }));
      accounts.sort((a, b) => {
        const ca = (a.accountCode ?? a.code ?? '').toString();
        const cb = (b.accountCode ?? b.code ?? '').toString();
        return ca.localeCompare(cb, undefined, { numeric: true });
      });
    }

    return NextResponse.json({
      accounts,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    
    // If in development mode and we have a database error, return mock data
    if (process.env.NODE_ENV !== 'production') {
      console.log("Returning mock accounts data for development");
      
      // Use IDs that match the format of your database (UUIDs or cuid)
      const mockAccounts = [
        { id: "clgqxz1a80000n9o1kzlm7e9q", code: "1000", name: "Cash", type: "ASSET", balance: 15000 },
        { id: "clgqxz1a80001n9o1l8zm5p0w", code: "1100", name: "Accounts Receivable", type: "ASSET", balance: 8500 },
        { id: "clgqxz1a80002n9o1n6ms7q2r", code: "2000", name: "Accounts Payable", type: "LIABILITY", balance: 4200 },
        { id: "clgqxz1a80003n9o1o2ms9r7t", code: "4000", name: "Revenue", type: "REVENUE", balance: 25000 },
        { id: "clgqxz1a80004n9o1p7mq3e2y", code: "5000", name: "Office Expenses", type: "EXPENSE", balance: 3200 },
        { id: "clgqxz1a80005n9o1q3mr8t6u", code: "5100", name: "Rent Expense", type: "EXPENSE", balance: 1800 },
        { id: "clgqxz1a80006n9o1r9ms2e9i", code: "5200", name: "Utilities Expense", type: "EXPENSE", balance: 950 },
        { id: "clgqxz1a80007n9o1s5mt7r3o", code: "5300", name: "Salaries Expense", type: "EXPENSE", balance: 12000 }
      ];
      
      
      return NextResponse.json({
        accounts: mockAccounts,
        pagination: {
          page: 1,
          limit: 100,
          totalCount: mockAccounts.length,
          totalPages: 1
        }
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch accounts. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * POST handler for creating a new account
 */
export async function POST(request) {
  try {
    // Authenticate user and get tenant ID
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated with this user' },
        { status: 401 }
      );
    }
    
    const tenantId = user.tenantId;
    
    // Parse request body
    const body = await request.json();
    
    // Validate required fields
    if (!body.code || !body.name || !body.type) {
      return NextResponse.json(
        { error: 'Invalid request. Missing required fields.' },
        { status: 400 }
      );
    }
    
    // Check if account code already exists (check both code and accountCode fields)
    const existingAccount = await prisma.account.findFirst({
      where: {
        tenantId: tenantId,
        OR: [
          { code: body.code },
          { accountCode: body.code }
        ]
      }
    });
    
    if (existingAccount) {
      return NextResponse.json(
        { 
          error: 'Account code already exists',
          details: `Account code ${body.code} is already in use by account: ${existingAccount.accountName || existingAccount.name || existingAccount.accountCode || existingAccount.code}`
        },
        { status: 400 }
      );
    }
    
    // Create account in database
    let account;
    try {
      account = await prisma.account.create({
        data: {
          code: body.code,
          name: body.name,
          type: body.type,
          balance: body.balance || 0,
          isActive: body.isActive !== undefined ? body.isActive : true,
          tenantId: tenantId
        }
      });
    } catch (createError) {
      // Handle Prisma unique constraint errors
      if (createError.code === 'P2002') {
        return NextResponse.json(
          { 
            error: 'Account code already exists',
            details: `Account code ${body.code} is already in use. Please use a different code.`
          },
          { status: 400 }
        );
      }
      throw createError;
    }
    
    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'ACCOUNT_CREATED',
        entityType: 'ACCOUNT',
        entityId: account.id,
        userId: user.id,
        tenantId: tenantId,
        details: JSON.stringify({
          accountId: account.id,
          code: account.code,
          name: account.name,
          type: account.type
        })
      }
    });
    
    return NextResponse.json({
      message: 'Account created successfully',
      account
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating account:', error);
    return NextResponse.json(
      { error: 'Failed to create account. Please try again.' },
      { status: 500 }
    );
  }
}