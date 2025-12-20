// app/api/dashboard/financial-position/route.js
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
        const customStartDate = searchParams.get('startDate');
        const customEndDate = searchParams.get('endDate');
        
        if (customStartDate && customEndDate) {
          startDate = new Date(customStartDate);
          endDate = new Date(customEndDate);
          startDate.setHours(0, 0, 0, 0);
          endDate.setHours(23, 59, 59, 999);
        } else {
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
    
    // Fetch comprehensive financial data
    const [
      // RECEIVABLES (Money owed TO the company)
      outstandingInvoices,
      pendingQuotations,
      
      // PAYABLES (Money owed BY the company)
      outstandingExpenses,
      outstandingSupplierBills,
      
      // CASH FLOW (Actual money movements)
      recentPayments,
      
      // ACCOUNT BALANCES
      accountBalances,
      
      // INVENTORY VALUE (if applicable)
      inventoryValue
    ] = await Promise.all([
      // Outstanding receivables (invoices)
      prisma.invoice.findMany({
        where: {
          tenantId,
          status: { in: ['Pending', 'Partial'] },
          NOT: { 
            status: { in: ['void', 'refunded', 'partially_refunded'] }
          }
        },
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          totalPaid: true,
          remainingBalance: true,
          status: true,
          dueDate: true,
          issueDate: true,
          lastPaymentDate: true,
          client: {
            select: {
              name: true,
              email: true
            }
          }
        },
        orderBy: { dueDate: 'asc' }
      }),
      
      // Pending quotations (potential receivables)
      prisma.quotation.findMany({
        where: {
          tenantId,
          status: { in: ['Pending', 'Sent'] }
        },
        select: {
          id: true,
          quotationNumber: true,
          total: true,
          status: true,
          validUntil: true,
          client: {
            select: {
              name: true,
              email: true
            }
          }
        },
        orderBy: { validUntil: 'asc' }
      }),
      
      // Outstanding payables (expenses)
      prisma.expense.findMany({
        where: {
          tenantId,
          paymentStatus: { in: ['Pending', 'Partially'] },
          isDeleted: false
        },
        select: {
          id: true,
          description: true,
          amount: true,
          paidAmount: true,
          paymentStatus: true,
          date: true,
          merchant: true,
          category: true,
          paymentReference: true
        },
        orderBy: { date: 'asc' }
      }),
      
      // Outstanding supplier bills
      prisma.supplierBill.findMany({
        where: {
          tenantId,
          status: { in: ['Unpaid', 'Partially Paid'] }
        },
        select: {
          id: true,
          billNumber: true,
          supplierId: true,
          totalAmount: true,
          amountPaid: true,
          status: true,
          billDate: true,
          dueDate: true,
          notes: true,
          supplier: {
            select: {
              supplierName: true
            }
          }
        },
        orderBy: { dueDate: 'asc' }
      }),
      
      // Recent payments (cash flow)
      prisma.payment.findMany({
        where: {
          tenantId,
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
          type: true,
          invoice: {
            select: {
              invoiceNumber: true,
              client: { select: { name: true } }
            }
          },
          expense: {
            select: {
              description: true,
              merchant: true
            }
          },
          sale: {
            select: {
              id: true
            }
          }
        },
        orderBy: { paymentDate: 'desc' },
        take: 50 // Limit to recent 50 payments
      }),
      
      // Account balances
      prisma.accountBalance.findMany({
        where: { tenantId },
        select: {
          account: true,
          balance: true
        }
      }),
      
      // Inventory value (if inventory module exists)
      prisma.product.aggregate({
        where: {
          tenantId,
          isDeleted: false
        },
        _sum: {
          costPrice: true
        },
        _count: {
          id: true
        }
      }).catch(() => ({ _sum: { costPrice: 0 }, _count: { id: 0 } })) // Fallback if inventory doesn't exist
    ]);
    
    // Calculate totals
    const totalReceivables = outstandingInvoices.reduce((sum, inv) => 
      sum + (inv.remainingBalance || (inv.total - (inv.totalPaid || 0))), 0);
    
    const totalPotentialReceivables = pendingQuotations.reduce((sum, quote) => 
      sum + quote.total, 0);
    
    const totalPayables = outstandingExpenses.reduce((sum, exp) => {
      if (exp.paymentStatus === 'Partially' && exp.paidAmount) {
        return sum + (exp.amount - exp.paidAmount);
      }
      return sum + exp.amount;
    }, 0) + outstandingSupplierBills.reduce((sum, bill) => {
      const balanceDue = (bill.totalAmount || 0) - (bill.amountPaid || 0);
      return sum + Math.max(0, balanceDue);
    }, 0);
    
    const totalCashIn = recentPayments
      .filter(p => p.type === 'invoice' || p.type === 'sale')
      .reduce((sum, p) => sum + p.amount, 0);
    
    const totalCashOut = recentPayments
      .filter(p => p.type === 'expense')
      .reduce((sum, p) => sum + p.amount, 0);
    
    const netCashFlow = totalCashIn - totalCashOut;
    
    const totalAccountBalances = Array.isArray(accountBalances)
      ? accountBalances.reduce((sum, acc) => sum + (acc.balance || 0), 0)
      : 0;
    
    // Calculate aging for receivables
    const receivablesAging = {
      current: 0,
      overdue30: 0,
      overdue60: 0,
      overdue90: 0,
      overdue90Plus: 0
    };
    
    outstandingInvoices.forEach(invoice => {
      const daysOverdue = Math.floor((now - new Date(invoice.dueDate)) / (1000 * 60 * 60 * 24));
      const amount = invoice.remainingBalance || (invoice.total - (invoice.totalPaid || 0));
      
      if (daysOverdue <= 0) {
        receivablesAging.current += amount;
      } else if (daysOverdue <= 30) {
        receivablesAging.overdue30 += amount;
      } else if (daysOverdue <= 60) {
        receivablesAging.overdue60 += amount;
      } else if (daysOverdue <= 90) {
        receivablesAging.overdue90 += amount;
      } else {
        receivablesAging.overdue90Plus += amount;
      }
    });
    
    // Calculate aging for payables
    const payablesAging = {
      current: 0,
      overdue30: 0,
      overdue60: 0,
      overdue90: 0,
      overdue90Plus: 0
    };
    
    outstandingExpenses.forEach(expense => {
      const dueDate = new Date(expense.date);
      dueDate.setDate(dueDate.getDate() + 30); // Assume 30-day payment terms
      const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
      
      let amount = expense.amount;
      if (expense.paymentStatus === 'Partially' && expense.paidAmount) {
        amount = expense.amount - expense.paidAmount;
      }
      
      if (daysOverdue <= 0) {
        payablesAging.current += amount;
      } else if (daysOverdue <= 30) {
        payablesAging.overdue30 += amount;
      } else if (daysOverdue <= 60) {
        payablesAging.overdue60 += amount;
      } else if (daysOverdue <= 90) {
        payablesAging.overdue90 += amount;
      } else {
        payablesAging.overdue90Plus += amount;
      }
    });
    
    // Process supplier bills aging
    outstandingSupplierBills.forEach(bill => {
      const balanceDue = (bill.totalAmount || 0) - (bill.amountPaid || 0);
      if (balanceDue > 0) {
        const dueDate = new Date(bill.dueDate || bill.billDate);
        const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
        
        if (daysOverdue <= 0) {
          payablesAging.current += balanceDue;
        } else if (daysOverdue <= 30) {
          payablesAging.overdue30 += balanceDue;
        } else if (daysOverdue <= 60) {
          payablesAging.overdue60 += balanceDue;
        } else if (daysOverdue <= 90) {
          payablesAging.overdue90 += balanceDue;
        } else {
          payablesAging.overdue90Plus += balanceDue;
        }
      }
    });
    
    return NextResponse.json({
      financialPosition: {
        summary: {
          totalReceivables,
          totalPotentialReceivables,
          totalPayables,
          netPosition: totalReceivables - totalPayables,
          totalCashIn,
          totalCashOut,
          netCashFlow,
          totalAccountBalances,
          inventoryValue: inventoryValue._sum.costPrice || 0
        },
        receivables: {
          total: totalReceivables,
          aging: receivablesAging,
          invoices: outstandingInvoices.map(inv => ({
            id: inv.id,
            number: inv.invoiceNumber,
            total: inv.total,
            paid: inv.totalPaid || 0,
            remaining: inv.remainingBalance || (inv.total - (inv.totalPaid || 0)),
            dueDate: inv.dueDate,
            client: inv.client.name,
            daysOverdue: Math.max(0, Math.floor((now - new Date(inv.dueDate)) / (1000 * 60 * 60 * 24)))
          })),
          potential: pendingQuotations.map(quote => ({
            id: quote.id,
            number: quote.quotationNumber,
            amount: quote.total,
            validUntil: quote.validUntil,
            client: quote.client.name
          }))
        },
        payables: {
          total: totalPayables,
          aging: payablesAging,
          expenses: outstandingExpenses.map(exp => {
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
              category: exp.category,
              status: exp.paymentStatus
            };
          }),
          supplierBills: outstandingSupplierBills.map(bill => {
            const balanceDue = (bill.totalAmount || 0) - (bill.amountPaid || 0);
            return {
              id: bill.id,
              billNumber: bill.billNumber,
              description: `Supplier Bill ${bill.billNumber}`,
              total: bill.totalAmount || 0,
              paid: bill.amountPaid || 0,
              remaining: balanceDue,
              date: bill.billDate,
              dueDate: bill.dueDate,
              merchant: bill.supplier?.supplierName || 'N/A',
              status: bill.status
            };
          })
        },
        cashFlow: {
          totalIn: totalCashIn,
          totalOut: totalCashOut,
          net: netCashFlow,
          recentPayments: recentPayments.map(p => ({
            id: p.id,
            amount: p.amount,
            date: p.paymentDate,
            method: p.paymentMethod,
            type: p.type,
            source: p.invoice?.invoiceNumber || p.expense?.description || `Sale #${p.sale?.id}`,
            client: p.invoice?.client?.name || p.expense?.merchant || 'POS Sale'
          }))
        },
        accounts: {
          balances: accountBalances.reduce((acc, balance) => {
            acc[balance.account] = balance.balance;
            return acc;
          }, {}),
          total: totalAccountBalances
        }
      }
    });
    
  } catch (error) {
    console.error('Error getting financial position:', error);
    return NextResponse.json(
      { error: 'Failed to fetch financial position data' },
      { status: 500 }
    );
  }
}
