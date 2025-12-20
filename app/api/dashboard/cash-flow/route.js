// app/api/dashboard/cash-flow/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

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
    const now = new Date();
    
    // Get date range from query parameters
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
    
    // Fetch all cash flow data in parallel
    const [
      // Cash Inflows (Money coming in)
      invoicePayments,
      salesPayments,
      
      // Cash Outflows (Money going out)
      expensePayments,
      
      // Outstanding amounts (Money owed)
      outstandingReceivables,
      outstandingPayables,
      
      // Account balances
      accountBalances
    ] = await Promise.all([
      // Invoice payments (cash in)
      prisma.payment.findMany({
        where: {
          tenantId,
          type: 'invoice',
          status: 'Completed',
          paymentDate: {
            gte: startDate,
            lte: endDate
          }
        },
        select: {
          id: true,
          amount: true,
          paymentDate: true,
          paymentMethod: true,
          invoice: {
            select: {
              invoiceNumber: true,
              client: {
                select: {
                  name: true
                }
              }
            }
          }
        },
        orderBy: { paymentDate: 'desc' }
      }),
      
      // Sales payments (cash in)
      prisma.payment.findMany({
        where: {
          tenantId,
          type: 'sale',
          status: 'Completed',
          paymentDate: {
            gte: startDate,
            lte: endDate
          }
        },
        select: {
          id: true,
          amount: true,
          paymentDate: true,
          paymentMethod: true,
          sale: {
            select: {
              id: true,
              total: true
            }
          }
        },
        orderBy: { paymentDate: 'desc' }
      }),
      
      // Expense payments (cash out)
      prisma.payment.findMany({
        where: {
          tenantId,
          type: 'expense',
          status: 'Completed',
          paymentDate: {
            gte: startDate,
            lte: endDate
          }
        },
        select: {
          id: true,
          amount: true,
          paymentDate: true,
          paymentMethod: true,
          expense: {
            select: {
              description: true,
              merchant: true,
              category: true
            }
          }
        },
        orderBy: { paymentDate: 'desc' }
      }),
      
      // Outstanding receivables (money owed to us)
      prisma.invoice.findMany({
        where: {
          tenantId,
          status: { in: ['Pending', 'Partial'] }
        },
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          totalPaid: true,
          remainingBalance: true,
          dueDate: true,
          client: {
            select: {
              name: true
            }
          }
        },
        orderBy: { dueDate: 'asc' }
      }),
      
      // Outstanding payables (money we owe)
      prisma.expense.findMany({
        where: {
          tenantId,
          paymentStatus: { in: ['Pending', 'Partially'] }
        },
        select: {
          id: true,
          description: true,
          amount: true,
          paidAmount: true,
          paymentStatus: true,
          date: true,
          merchant: true
        },
        orderBy: { date: 'asc' }
      }),
      
      // Account balances
      prisma.accountBalance.findMany({
        where: { tenantId },
        select: {
          account: true,
          balance: true
        }
      })
    ]);
    
    // Calculate totals
    const totalCashIn = invoicePayments.reduce((sum, p) => sum + p.amount, 0) + 
                       salesPayments.reduce((sum, p) => sum + p.amount, 0);
    
    const totalCashOut = expensePayments.reduce((sum, p) => sum + p.amount, 0);
    
    const totalReceivables = outstandingReceivables.reduce((sum, inv) => 
      sum + (inv.remainingBalance || (inv.total - (inv.totalPaid || 0))), 0);
    
    const totalPayables = outstandingPayables.reduce((sum, exp) => {
      if (exp.paymentStatus === 'Partially' && exp.paidAmount) {
        return sum + (exp.amount - exp.paidAmount);
      }
      return sum + exp.amount;
    }, 0);
    
    // Calculate net cash flow
    const netCashFlow = totalCashIn - totalCashOut;
    
    // Group payments by day for cash flow chart
    const cashFlowByDay = {};
    const allPayments = [
      ...invoicePayments.map(p => ({ ...p, type: 'inflow', source: 'invoice' })),
      ...salesPayments.map(p => ({ ...p, type: 'inflow', source: 'sale' })),
      ...expensePayments.map(p => ({ ...p, type: 'outflow', source: 'expense' }))
    ];
    
    allPayments.forEach(payment => {
      const date = payment.paymentDate.toISOString().split('T')[0];
      if (!cashFlowByDay[date]) {
        cashFlowByDay[date] = { date, inflow: 0, outflow: 0 };
      }
      
      if (payment.type === 'inflow') {
        cashFlowByDay[date].inflow += payment.amount;
      } else {
        cashFlowByDay[date].outflow += payment.amount;
      }
    });
    
    // Convert to array and sort by date
    const cashFlowChart = Object.values(cashFlowByDay)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(day => ({
        ...day,
        netFlow: day.inflow - day.outflow
      }));
    
    return NextResponse.json({
      cashFlow: {
        summary: {
          totalCashIn,
          totalCashOut,
          netCashFlow,
          totalReceivables,
          totalPayables,
          accountBalances: accountBalances.reduce((acc, balance) => {
            acc[balance.account] = balance.balance;
            return acc;
          }, {})
        },
        inflows: {
          invoicePayments: invoicePayments.map(p => ({
            id: p.id,
            amount: p.amount,
            date: p.paymentDate,
            method: p.paymentMethod,
            source: `Invoice #${p.invoice.invoiceNumber}`,
            client: p.invoice.client.name
          })),
          salesPayments: salesPayments.map(p => ({
            id: p.id,
            amount: p.amount,
            date: p.paymentDate,
            method: p.paymentMethod,
            source: `Sale #${p.sale.id}`,
            client: 'POS Sale'
          }))
        },
        outflows: {
          expensePayments: expensePayments.map(p => ({
            id: p.id,
            amount: p.amount,
            date: p.paymentDate,
            method: p.paymentMethod,
            source: p.expense.description,
            merchant: p.expense.merchant,
            category: p.expense.category
          }))
        },
        outstanding: {
          receivables: outstandingReceivables.map(inv => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            total: inv.total,
            paid: inv.totalPaid || 0,
            remaining: inv.remainingBalance || (inv.total - (inv.totalPaid || 0)),
            dueDate: inv.dueDate,
            client: inv.client.name,
            daysOverdue: Math.max(0, Math.floor((now - new Date(inv.dueDate)) / (1000 * 60 * 60 * 24)))
          })),
          payables: outstandingPayables.map(exp => {
            const amountOwed = exp.paymentStatus === 'Partially' && exp.paidAmount 
              ? exp.amount - exp.paidAmount 
              : exp.amount;
            return {
              id: exp.id,
              description: exp.description,
              total: exp.amount,
              paid: exp.paidAmount || 0,
              remaining: amountOwed,
              date: exp.date,
              merchant: exp.merchant,
              status: exp.paymentStatus
            };
          })
        },
        chart: cashFlowChart
      }
    });
    
  } catch (error) {
    console.error('Error getting cash flow data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cash flow data' },
      { status: 500 }
    );
  }
}
