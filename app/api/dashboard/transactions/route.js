// app/api/dashboard/transactions/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { addBranchFilter } from '@/lib/dashboardBranchFilter';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const tenantId = user.tenantId;
    const { searchParams } = new URL(request.url);
    const dateRange = searchParams.get('dateRange') || 'month';
    
    // Calculate date range based on the parameter
    let startDate, endDate;
    const today = new Date();
    
    switch (dateRange) {
      case 'today':
        startDate = new Date(today);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'yesterday':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(today);
        endDate.setDate(endDate.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'week':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - startDate.getDay());
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'lastWeek':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - startDate.getDay() - 7);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'thisMonth':
      case 'month':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'lastMonth':
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        endDate = new Date(today.getFullYear(), today.getMonth(), 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'thisQuarter':
      case 'quarter':
        const currentQuarter = Math.floor(today.getMonth() / 3);
        startDate = new Date(today.getFullYear(), currentQuarter * 3, 1);
        endDate = new Date(today.getFullYear(), (currentQuarter + 1) * 3, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'lastQuarter':
        const lastQuarter = Math.floor(today.getMonth() / 3) - 1;
        const lastQuarterYear = lastQuarter < 0 ? today.getFullYear() - 1 : today.getFullYear();
        const lastQuarterMonth = lastQuarter < 0 ? 9 : lastQuarter * 3;
        startDate = new Date(lastQuarterYear, lastQuarterMonth, 1);
        endDate = new Date(lastQuarterYear, lastQuarterMonth + 3, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'thisYear':
      case 'year':
        startDate = new Date(today.getFullYear(), 0, 1);
        endDate = new Date(today.getFullYear(), 11, 31);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'lastYear':
        startDate = new Date(today.getFullYear() - 1, 0, 1);
        endDate = new Date(today.getFullYear() - 1, 11, 31);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'last7Days':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'last30Days':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'last90Days':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 90);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'last365Days':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 365);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'custom':
        // Handle custom date range from query parameters
        const customStartDate = searchParams.get('startDate');
        const customEndDate = searchParams.get('endDate');
        
        if (customStartDate && customEndDate) {
          startDate = new Date(customStartDate);
          endDate = new Date(customEndDate);
          startDate.setHours(0, 0, 0, 0);
          endDate.setHours(23, 59, 59, 999);
        } else {
          // Default to this month if custom dates not provided
          startDate = new Date(today.getFullYear(), today.getMonth(), 1);
          endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          endDate.setHours(23, 59, 59, 999);
        }
        break;
      default:
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
    }
    
    // Get recent invoices (income transactions)
    const invoices = await prisma.invoice.findMany({
      where: addBranchFilter(user, {
        tenantId,
        issueDate: {
          gte: startDate,
          lte: endDate
        }
      }),
      orderBy: {
        issueDate: 'desc'
      },
      take: 10,
      include: {
        client: {
          select: {
            name: true
          }
        }
      }
    });
    
    // Get recent sales (including historical transactions)
    const sales = await prisma.sale.findMany({
      where: addBranchFilter(user, {
        tenantId,
        saleDate: {
          gte: startDate,
          lte: endDate
        },
        status: 'completed'
      }),
      orderBy: {
        saleDate: 'desc'
      },
      take: 10,
      include: {
        client: {
          select: {
            name: true
          }
        }
      }
    });
    
    // Get recent expenses (expense transactions)
    const expenses = await prisma.expense.findMany({
      where: addBranchFilter(user, {
        tenantId,
        date: {
          gte: startDate,
          lte: endDate
        },
        isDeleted: false
      }),
      orderBy: {
        date: 'desc'
      },
      take: 10
    });
    
    // Get recent supplier payments (expense transactions)
    const supplierPayments = await prisma.supplierPayment.findMany({
      where: {
        tenantId,
        paymentDate: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: {
        paymentDate: 'desc'
      },
      take: 10,
      include: {
        supplier: {
          select: {
            supplierName: true
          }
        }
      }
    });
    
    console.log(`Found ${invoices.length} invoices, ${sales.length} sales, ${expenses.length} expenses, and ${supplierPayments.length} supplier payments for tenant ${tenantId}`);
    
    // Combine and format transactions
    const transactions = [
      ...invoices.map(invoice => ({
        id: `INV-${invoice.invoiceNumber}`,
        type: 'income',
        description: `Invoice payment - ${invoice.client?.name || 'Unknown Client'}`,
        date: invoice.issueDate.toISOString(),
        amount: invoice.total,
        status: invoice.status.toLowerCase()
      })),
      ...sales.map(sale => ({
        id: `SALE-${sale.saleNumber}`,
        type: 'income',
        description: `Sale - ${sale.client?.name || 'Walk-in Customer'}`,
        date: sale.saleDate.toISOString(),
        amount: sale.total,
        status: sale.status.toLowerCase()
      })),
      ...expenses.map(expense => ({
        id: `EXP-${expense.id}`,
        type: 'expense',
        description: expense.description || 'Expense',
        date: expense.date.toISOString(),
        amount: expense.amount,
        status: expense.status.toLowerCase()
      })),
      ...supplierPayments.map(payment => ({
        id: `SUPP-${payment.id}`,
        type: 'expense',
        description: `Payment to ${payment.supplier?.supplierName || 'Supplier'}`,
        date: payment.paymentDate.toISOString(),
        amount: payment.totalAmount,
        status: payment.status?.toLowerCase() || 'completed'
      }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
    
    console.log(`Returning ${transactions.length} transactions`);
    
    return NextResponse.json({
      transactions
    });
  } catch (error) {
    console.error('Error getting transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
} 