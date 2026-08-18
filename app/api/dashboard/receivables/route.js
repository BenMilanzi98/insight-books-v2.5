// app/api/dashboard/receivables/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { addBranchFilterIncludeUnassigned } from '@/lib/dashboardBranchFilter';
import {
  getAccessibleTenantIdsForUser,
  parseDashboardTenantScope,
  tenantWhereIn,
  userForDashboardBranchFilter,
} from '@/lib/dashboardTenantScope';
import { addMoney, parseMoney, subtractMoney } from '@/lib/money';
import { OUTSTANDING_RECEIVABLE_INVOICE_FILTER } from '@/lib/receivablesInvoiceFilter';

// Prevent caching to ensure fresh data on branch switch
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const accessible = await getAccessibleTenantIdsForUser(user);
    const scope = parseDashboardTenantScope(searchParams, user, accessible);
    if (!scope.ok) {
      return NextResponse.json(
        { error: scope.error || 'Invalid business scope' },
        { status: 400 }
      );
    }
    const { tenantIds, branchScoped } = scope;
    const tw = tenantWhereIn(tenantIds);
    const userQ = userForDashboardBranchFilter(user, branchScoped);

    const now = new Date();
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
      case 'thisWeek': {
        startDate = new Date(today);
        startDate.setDate(today.getDate() - today.getDay());
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
      }
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
      case 'thisMonth':
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
      case 'year':
        startDate = new Date(today.getFullYear(), 0, 1);
        endDate = new Date(today.getFullYear(), 11, 31);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'thisYear':
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
    
    // Optional: only invoices with a completed payment in the selected window (off by default).
    // When on, Pending invoices with no payments yet are excluded — bad for /accounting/receivables.
    const paymentActivityInRange = searchParams.get('paymentActivityInRange') === '1';

    // Get unpaid invoices
    // Include invoices that are Pending or Partial (these represent money owed by customers)
    // Calculate actual remaining balance from payments to ensure accuracy
    const invoices = await prisma.invoice.findMany({
      // Receivables: include unassigned (null branchId) invoices even when a branch is selected.
      // This prevents missing invoices for tenants/users in "default branch" scenarios.
      where: addBranchFilterIncludeUnassigned(userQ, {
        ...tw,
        ...(paymentActivityInRange && startDate && endDate
          ? {
              payments: {
                some: {
                  status: { equals: 'Completed', mode: 'insensitive' },
                  paymentDate: { gte: startDate, lte: endDate }
                }
              }
            }
          : {}),
        // Exclude voided, refunded, deleted, and fully paid invoices
        ...OUTSTANDING_RECEIVABLE_INVOICE_FILTER,
      }),
      select: {
        id: true,
        total: true,
        totalPaid: true,
        remainingBalance: true,
        status: true,
        dueDate: true,
        invoiceNumber: true,
        issueDate: true,
        lastPaymentDate: true,
        payments: {
          where: {
            status: { equals: 'Completed', mode: 'insensitive' }
          },
          select: {
            amount: true
          }
        },
        client: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        dueDate: 'asc'
      }
    });
    
    // Calculate aging buckets
    const aging = [
      { range: "0-30 days", amount: 0 },
      { range: "31-60 days", amount: 0 },
      { range: "61-90 days", amount: 0 },
      { range: ">90 days", amount: 0 }
    ];
    
    let total = 0;
    let overdue = 0;
    let notDue = 0;
    
    invoices.forEach(invoice => {
      // Skip if no due date
      if (!invoice.dueDate) {
        console.warn(`Invoice ${invoice.invoiceNumber} has no due date, skipping aging calculation`);
        return;
      }
      
      const dueDate = new Date(invoice.dueDate);
      
      // Validate due date
      if (isNaN(dueDate.getTime())) {
        console.warn(`Invoice ${invoice.invoiceNumber} has invalid due date: ${invoice.dueDate}`);
        return;
      }
      
      const daysDiff = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
      
      // Calculate actual remaining balance from payments (more accurate than stored fields)
      // First, calculate total paid from actual completed payments
      const actualTotalPaid = invoice.payments?.reduce((sum, p) => addMoney(sum, p.amount), 0) || 0;
      
      // Calculate actual remaining balance
      const actualRemaining = Math.max(0, subtractMoney(invoice.total, actualTotalPaid));
      
      // Use the calculated remaining balance, or fall back to stored remainingBalance if available
      let amountOwed = actualRemaining > 0 ? actualRemaining : parseMoney(invoice.remainingBalance);
      
      // Only include invoices with actual money owed
      if (amountOwed <= 0) {
        return; // Skip invoices with no balance owed
      }
      
      total = addMoney(total, amountOwed);
      
      // Categorize as not due or overdue
      if (daysDiff < 0) {
        notDue = addMoney(notDue, amountOwed);
        // Invoices not yet due go into the "0-30 days" bucket (current/not overdue)
        aging[0].amount = addMoney(aging[0].amount, amountOwed);
      } else {
        overdue = addMoney(overdue, amountOwed);
        
        // Add to appropriate aging bucket based on days past due (only for overdue invoices)
        // 0-30 days: overdue by 0-30 days
        // 31-60 days: overdue by 31-60 days
        // 61-90 days: overdue by 61-90 days
        // >90 days: overdue by more than 90 days
        if (daysDiff <= 30) {
          aging[0].amount = addMoney(aging[0].amount, amountOwed);
        } else if (daysDiff <= 60) {
          aging[1].amount = addMoney(aging[1].amount, amountOwed);
        } else if (daysDiff <= 90) {
          aging[2].amount = addMoney(aging[2].amount, amountOwed);
        } else {
          aging[3].amount = addMoney(aging[3].amount, amountOwed);
        }
      }
    });
    
    // Prepare invoice list for the Outstanding Invoices table
    const outstandingInvoices = invoices
      .map(invoice => {
        // Calculate actual remaining balance from payments
        const actualTotalPaid = invoice.payments?.reduce((sum, p) => addMoney(sum, p.amount), 0) || 0;
        const actualRemaining = Math.max(0, subtractMoney(invoice.total, actualTotalPaid));
        const amountOwed = actualRemaining > 0 ? actualRemaining : parseMoney(invoice.remainingBalance);
        
        // Skip if no balance owed
        if (amountOwed <= 0) {
          return null;
        }
        
        const dueDate = new Date(invoice.dueDate);
        const daysDiff = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
        
        // Determine status
        let invoiceStatus = 'Pending';
        if (daysDiff < 0) {
          invoiceStatus = 'Not Due';
        } else if (daysDiff > 0) {
          invoiceStatus = 'Overdue';
        } else if (invoice.status === 'Partial') {
          invoiceStatus = 'Partial';
        }
        
        return {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          clientId: invoice.client?.id,
          clientName: invoice.client?.name || 'Unknown',
          clientEmail: invoice.client?.email,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          total: invoice.total,
          totalPaid: actualTotalPaid,
          amountOwed: amountOwed,
          status: invoiceStatus,
          daysPastDue: daysDiff > 0 ? daysDiff : 0,
          originalStatus: invoice.status
        };
      })
      .filter(inv => inv !== null); // Remove null entries
    
    return NextResponse.json({
      accountsReceivable: {
        current: total,
        overdue,
        notDue,
        aging
      },
      invoices: outstandingInvoices,
      glVerification:
        tenantIds.length === 1
          ? (
              await import('@/lib/arAgingService').then((m) =>
                m.generateARAgingFromTransactions(tenantIds[0], new Date(), branchScoped ? userQ.currentBranchId : null)
              )
            ).verification
          : null,
    });
  } catch (error) {
    console.error('Error getting receivables data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch receivables data' },
      { status: 500 }
    );
  }
}