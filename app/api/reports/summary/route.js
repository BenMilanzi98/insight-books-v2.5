// app/api/reports/summary/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

export async function GET(request) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated' },
        { status: 401 }
      );
    }
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    // Validate dates
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }
    
    // Get revenue (from paid invoices and sales)
    const invoiceRevenue = await prisma.invoice.aggregate({
      where: {
        tenantId: user.tenantId,
        status: 'Paid',
        issueDate: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      },
      _sum: {
        total: true
      }
    });
    
    const salesRevenue = await prisma.sale.aggregate({
      where: {
        tenantId: user.tenantId,
        status: 'completed',
        saleDate: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      },
      _sum: {
        total: true
      }
    });
    
    // Get expenses
    const expenses = await prisma.expense.aggregate({
      where: {
        tenantId: user.tenantId,
        status: 'Approved',
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      },
      _sum: {
        amount: true
      }
    });
    
    // Count outstanding invoices
    const outstandingInvoices = await prisma.invoice.aggregate({
      where: {
        tenantId: user.tenantId,
        status: 'Pending',
        dueDate: {
          lt: new Date() // Due date has passed
        }
      },
      _count: true,
      _sum: {
        total: true
      }
    });
    
    // Count recent sales
    const recentSales = await prisma.sale.count({
      where: {
        tenantId: user.tenantId,
        saleDate: {
          gte: new Date(new Date().setDate(new Date().getDate() - 7)) // Last 7 days
        }
      }
    });
    
    // Get low stock products - Simplified logic to match stock alerts API
    const allProducts = await prisma.product.findMany({
      where: {
        tenantId: user.tenantId,
        isService: false,
        stockLevel: { not: null } // Only products with stock level set
      },
      select: {
        stockLevel: true,
        reorderPoint: true
      }
    });
    
    // Filter products that need alerts (same logic as stock alerts API)
    const lowStockProducts = allProducts.filter(product => {
      const stockLevel = product.stockLevel || 0;
      const reorderPoint = product.reorderPoint || 10;
      
      // Show alert if:
      // 1. Out of stock (stockLevel = 0)
      // 2. Stock level is at or below reorder point
      return stockLevel === 0 || stockLevel <= reorderPoint;
    }).length;
    
    // Calculate total revenue and profit
    const totalRevenue = (invoiceRevenue._sum.total || 0) + (salesRevenue._sum.total || 0);
    const totalExpenses = expenses._sum.amount || 0;
    const profit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(2) : 0;
    
    return NextResponse.json({
      revenue: totalRevenue.toFixed(2),
      expenses: totalExpenses.toFixed(2),
      profit: profit.toFixed(2),
      profitMargin: profitMargin,
      outstandingInvoices: {
        count: outstandingInvoices._count,
        total: (outstandingInvoices._sum.total || 0).toFixed(2)
      },
      recentSales: recentSales,
      lowStockProducts: lowStockProducts,
      timeframe: {
        startDate,
        endDate
      }
    });
  } catch (error) {
    console.error('Error generating financial summary:', error);
    return NextResponse.json(
      { error: 'Failed to generate financial summary. Please try again.' },
      { status: 500 }
    );
  }
}
