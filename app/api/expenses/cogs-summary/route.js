// app/api/expenses/cogs-summary/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { getCOGSTransactionStats } from '@/lib/cogsIntegration';

// GET - Get COGS summary for expenses
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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Default to current month if no dates provided
    const now = new Date();
    const defaultStartDate = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEndDate = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Get COGS-related expenses
    const cogsExpenses = await prisma.expense.findMany({
      where: {
        tenantId: user.tenantId,
        category: {
          in: ['COGS Settlement', 'Cost of Goods Sold', 'COGS']
        },
        date: {
          gte: defaultStartDate,
          lte: defaultEndDate
        },
        isDeleted: false
      },
      include: {
        submittedBy: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        date: 'desc'
      }
    });

    // Get COGS posted via sales & invoices
    const cogsTransactionStats = await getCOGSTransactionStats(
      user.tenantId,
      defaultStartDate,
      defaultEndDate,
      user?.currentBranchId || null
    );

    // Calculate totals
    const totalCOGSExpenses = cogsExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const totalCOGSTransactions = cogsTransactionStats.totalAmount;

    // Calculate productCount - count unique products that have COGS transactions in this period
    // Get products from sales that have COGS transactions
    const saleWhere = {
      tenantId: user.tenantId,
      status: 'completed',
      saleDate: {
        gte: defaultStartDate,
        lte: defaultEndDate
      }
    };

    // Add branch filtering if user has a branch selected
    if (user?.currentBranchId) {
      saleWhere.branchId = user.currentBranchId;
    }

    const saleItemsWithProducts = await prisma.saleItem.findMany({
      where: {
        sale: saleWhere,
        product: {
          isNot: null
        },
        isCustom: false // Exclude custom items
      },
      select: {
        productId: true,
        product: {
          select: {
            id: true,
            cost: true,
            isService: true
          }
        }
      },
      distinct: ['productId']
    });

    // Filter to only count products with cost > 0 and not services
    const productsWithCOGS = saleItemsWithProducts.filter(item => 
      item.product && 
      !item.product.isService && 
      item.product.cost && 
      Number(item.product.cost) > 0
    );

    const productCount = productsWithCOGS.length;

    // Note: We use only transactions for totalCOGS to avoid double counting
    // COGS expenses are already included in the transaction entries

    // Get COGS by category
    const cogsByCategory = cogsExpenses.reduce((acc, expense) => {
      const category = expense.category || 'Other';
      if (!acc[category]) {
        acc[category] = {
          category,
          count: 0,
          amount: 0
        };
      }
      acc[category].count += 1;
      acc[category].amount += expense.amount;
      return acc;
    }, {});

    // Get recent COGS expenses
    const recentCOGSExpenses = cogsExpenses.slice(0, 5).map(expense => ({
      id: expense.id,
      description: expense.description,
      amount: expense.amount,
      date: expense.date.toISOString().split('T')[0],
      category: expense.category,
      submittedByName: expense.submittedBy?.name || 'Unknown'
    }));

    // Get COGS trends (monthly data for the last 6 months)
    const trendsData = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const monthExpenses = await prisma.expense.findMany({
        where: {
          tenantId: user.tenantId,
          category: {
            in: ['COGS Settlement', 'Cost of Goods Sold', 'COGS']
          },
          date: {
            gte: monthStart,
            lte: monthEnd
          },
          isDeleted: false
        }
      });

      const monthTotal = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
      
      trendsData.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        amount: monthTotal,
        count: monthExpenses.length
      });
    }

    return NextResponse.json({
      summary: {
        totalCOGSExpenses,
        totalCOGSTransactions,
        totalCOGS: totalCOGSTransactions, // Use only transactions, not expenses + transactions
        expenseCount: cogsExpenses.length,
        transactionCount: cogsTransactionStats.transactionCount,
        productCount: productCount, // Count of products with COGS in this period
        period: {
          startDate: defaultStartDate.toISOString().split('T')[0],
          endDate: defaultEndDate.toISOString().split('T')[0]
        },
        accountsUsed: cogsTransactionStats.accounts
      },
      cogsByCategory: Object.values(cogsByCategory),
      cogsBySource: cogsTransactionStats.breakdownBySource,
      topCogsTransactions: cogsTransactionStats.topTransactions,
      recentExpenses: recentCOGSExpenses,
      trends: trendsData
    });

  } catch (error) {
    console.error('Error fetching COGS summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch COGS summary' },
      { status: 500 }
    );
  }
}

