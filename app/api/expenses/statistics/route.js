// app/api/expenses/statistics/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// GET - Fetch expense statistics
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
    
    // Parse date parameters
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    
    // Build date filter
    const dateFilter = {};
    if (dateFrom) {
      dateFilter.gte = new Date(dateFrom);
    }
    // Remove default current month filter to include all historical expenses
    
    if (dateTo) {
      dateFilter.lte = new Date(dateTo);
    }
    
    // Base query filter for tenant's expenses (exclude deleted)
    const baseFilter = {
      tenantId: user.tenantId,
      isDeleted: false
    };
    
    // Add branch filter - use user's current branch if available
    if (user?.currentBranchId) {
      baseFilter.branchId = user.currentBranchId;
    }
    
    // Only add date filter if there are actual date constraints
    if (Object.keys(dateFilter).length > 0) {
      baseFilter.date = dateFilter;
    }
    
    // Get total expenses count and sum
    const totalExpenses = await prisma.expense.aggregate({
      where: baseFilter,
      _count: true,
      _sum: {
        amount: true
      }
    });
    
    // Get approved expenses count and sum
    const approvedExpenses = await prisma.expense.aggregate({
      where: {
        ...baseFilter,
        status: 'Approved'
      },
      _count: true,
      _sum: {
        amount: true
      }
    });
    
    // Get pending expenses count and sum
    const pendingExpenses = await prisma.expense.aggregate({
      where: {
        ...baseFilter,
        status: 'Pending'
      },
      _count: true,
      _sum: {
        amount: true
      }
    });
    
    // Get rejected expenses count and sum
    const rejectedExpenses = await prisma.expense.aggregate({
      where: {
        ...baseFilter,
        status: 'Rejected'
      },
      _count: true,
      _sum: {
        amount: true
      }
    });
    
    // Get expenses by category
    const expensesByCategory = await prisma.expense.groupBy({
      by: ['category'],
      where: baseFilter,
      _sum: {
        amount: true
      },
      orderBy: {
        _sum: {
          amount: 'desc'
        }
      }
    });
    
    // Calculate percentages for categories
    const totalAmount = totalExpenses._sum.amount || 0;
    const formattedCategoryStats = expensesByCategory.map(category => {
      const amount = category._sum.amount || 0;
      const percentage = totalAmount > 0 ? Math.round((amount / totalAmount) * 100) : 0;
      
      return {
        category: category.category,
        amount: amount.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }),
        percentage
      };
    });
    
    // Return statistics
    return NextResponse.json({
      total: {
        count: totalExpenses._count || 0,
        amount: (totalExpenses._sum.amount || 0).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })
      },
      approved: {
        count: approvedExpenses._count || 0,
        amount: (approvedExpenses._sum.amount || 0).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })
      },
      pending: {
        count: pendingExpenses._count || 0,
        amount: (pendingExpenses._sum.amount || 0).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })
      },
      rejected: {
        count: rejectedExpenses._count || 0,
        amount: (rejectedExpenses._sum.amount || 0).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })
      },
      byCategory: formattedCategoryStats
    });
  } catch (error) {
    console.error('Error fetching expense statistics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch expense statistics. Please try again.' },
      { status: 500 }
    );
  }
}