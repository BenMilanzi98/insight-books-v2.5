// app/api/general-ledger/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// GET - Fetch general ledger transactions with filtering, sorting, and pagination
export async function GET(request) {
  try {
    // Get authenticated user and tenant
    let user;
    let tenantId;
    
    try {
      // Try to get user from session
      user = await getUserFromSession(request);
      
      if (!user || !user.tenantId) {
        return NextResponse.json(
          { error: 'Authentication required or no tenant associated with this user' },
          { status: 401 }
        );
      }
      
      tenantId = user.tenantId;
    } catch (authError) {
      console.error("Authentication error:", authError.message);
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    
    // Pagination parameters
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;
    const skip = (page - 1) * limit;
    
    // Date range parameters
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    // Filtering parameters
    const accountId = searchParams.get('accountId');
    const search = searchParams.get('search');
    const reference = searchParams.get('reference');
    const balanceType = searchParams.get('balanceType'); // 'debit', 'credit', or 'all'
    
    // Sorting parameters
    const sortBy = searchParams.get('sortBy') || 'date';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    
    // Build filter conditions
    // Note: tenantId is on the Transaction model, not JournalEntry
    let whereConditions = {
      transaction: {
        tenantId: tenantId
      }
    };
    
    // Add date range filter if provided
    if (startDate || endDate) {
      whereConditions.transaction = {
        ...whereConditions.transaction,
        date: {}
      };
      
      if (startDate) {
        whereConditions.transaction.date.gte = new Date(startDate);
      }
      
      if (endDate) {
        whereConditions.transaction.date.lte = new Date(endDate);
      }
    }
    
    // Add account filter if provided
    if (accountId && accountId !== 'all') {
      whereConditions.accountId = accountId;
    }
    
    // Add reference filter if provided
    if (reference) {
      whereConditions.transaction = {
        ...whereConditions.transaction,
        description: {
          contains: reference,
          mode: 'insensitive'
        }
      };
    }
    
    // Add balance type filter if provided
    if (balanceType === 'debit') {
      whereConditions.debit = {
        gt: 0
      };
    } else if (balanceType === 'credit') {
      whereConditions.credit = {
        gt: 0
      };
    }
    
    // Add search filter if provided
    if (search) {
      // We need to use nested OR conditions to search across different models
      whereConditions.OR = [
        { 
          transaction: { 
            description: { 
              contains: search, 
              mode: 'insensitive' 
            } 
          }
        },
        { 
          account: { 
            name: { 
              contains: search, 
              mode: 'insensitive' 
            } 
          }
        },
        { 
          account: { 
            code: { 
              contains: search, 
              mode: 'insensitive' 
            } 
          }
        }
      ];
    }
    
    // Get total count for pagination
    const totalCount = await prisma.journalEntry.count({
      where: whereConditions
    });
    
    // Fetch journal entries with their related accounts and transactions
    const journalEntries = await prisma.journalEntry.findMany({
      where: whereConditions,
      include: {
        account: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true
          }
        },
        transaction: {
          select: {
            id: true,
            date: true,
            description: true
          }
        }
      },
      orderBy: sortBy === 'date' 
        ? { transaction: { date: sortOrder.toLowerCase() } }
        : { [sortBy]: sortOrder.toLowerCase() },
      skip,
      take: limit
    });
    
    // Calculate account balances
    // This is a simplified approach - in production, you would want to calculate
    // the running balance accurately based on all previous transactions
    const accountBalances = {};
    
    // Transform the data for the response
    const transactions = await Promise.all(journalEntries.map(async (entry) => {
      // Get or initialize account balance
      if (!accountBalances[entry.accountId]) {
        accountBalances[entry.accountId] = 0;
        
        // For a real implementation, you would calculate the opening balance
        // by summing all previous transactions for this account
        try {
          const prevEntries = await prisma.journalEntry.aggregate({
            where: {
              accountId: entry.accountId,
              transaction: {
                date: { lt: entry.transaction.date },
                tenantId
              }
            },
            _sum: {
              debit: true,
              credit: true
            }
          });
          
          const prevDebit = prevEntries._sum.debit || 0;
          const prevCredit = prevEntries._sum.credit || 0;
          accountBalances[entry.accountId] = prevDebit - prevCredit;
        } catch (error) {
          console.warn(`Error calculating previous balance for account ${entry.accountId}:`, error);
        }
      }
      
      // Update balance based on this entry
      if (entry.account.type === 'ASSET' || entry.account.type === 'EXPENSE') {
        // For assets and expenses, debits increase the balance and credits decrease it
        accountBalances[entry.accountId] += (entry.debit || 0) - (entry.credit || 0);
      } else {
        // For liabilities, equity, and revenue, credits increase the balance and debits decrease it
        accountBalances[entry.accountId] += (entry.credit || 0) - (entry.debit || 0);
      }
      
      return {
        id: entry.id,
        transactionId: entry.transactionId, // Add this line
        date: entry.transaction.date.toISOString(),
        description: entry.transaction.description,
        accountId: entry.accountId,
        accountCode: entry.account.code,
        accountName: entry.account.name,
        accountType: entry.account.type,
        debit: entry.debit || 0,
        credit: entry.credit || 0,
        balance: accountBalances[entry.accountId]
      };
    }));
    
    // Calculate summary statistics
    const summaryStats = await prisma.journalEntry.aggregate({
      where: whereConditions,
      _sum: {
        debit: true,
        credit: true
      }
    });
    
    // Return the formatted response
    return NextResponse.json({
      transactions,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      },
      totalDebits: summaryStats._sum.debit || 0,
      totalCredits: summaryStats._sum.credit || 0
    });
    
  } catch (error) {
    console.error('Error fetching general ledger transactions:', error);
    
    // If there's a database error, provide a fallback for development
    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json({
        transactions: generateMockTransactions(),
        pagination: {
          page: 1,
          limit: 10,
          totalCount: 6,
          totalPages: 1
        },
        totalDebits: 2550,
        totalCredits: 2550
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch general ledger data. Please try again.' },
      { status: 500 }
    );
  }
}

// Function to generate mock transactions for development/testing
function generateMockTransactions() {
  return [
    {
      id: "TR-001",
      date: "2025-04-15T00:00:00.000Z",
      description: "Office Supplies Purchase",
      accountId: "acc5",
      accountCode: "5000",
      accountName: "Office Expenses",
      accountType: "EXPENSE",
      debit: 250.00,
      credit: 0,
      balance: 250.00
    },
    {
      id: "TR-002",
      date: "2025-04-15T00:00:00.000Z", 
      description: "Office Supplies Purchase",
      accountId: "acc3",
      accountCode: "2000",
      accountName: "Accounts Payable",
      accountType: "LIABILITY",
      debit: 0,
      credit: 250.00,
      balance: 250.00
    },
    {
      id: "TR-003",
      date: "2025-04-20T00:00:00.000Z",
      description: "Client Payment",
      accountId: "acc2",
      accountCode: "1100",
      accountName: "Accounts Receivable",
      accountType: "ASSET",
      debit: 0,
      credit: 1500.00,
      balance: -1500.00
    },
    {
      id: "TR-004",
      date: "2025-04-20T00:00:00.000Z",
      description: "Client Payment",
      accountId: "acc1",
      accountCode: "1000",
      accountName: "Cash",
      accountType: "ASSET",
      debit: 1500.00,
      credit: 0,
      balance: 1500.00
    },
    {
      id: "TR-005",
      date: "2025-04-25T00:00:00.000Z",
      description: "Rent Payment",
      accountId: "acc6",
      accountCode: "5100",
      accountName: "Rent Expense",
      accountType: "EXPENSE",
      debit: 800.00,
      credit: 0,
      balance: 800.00
    },
    {
      id: "TR-006",
      date: "2025-04-25T00:00:00.000Z",
      description: "Rent Payment",
      accountId: "acc1",
      accountCode: "1000",
      accountName: "Cash",
      accountType: "ASSET",
      debit: 0,
      credit: 800.00,
      balance: 700.00
    }
  ];
}