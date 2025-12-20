// lib/arAgingService.js
/**
 * Accounts Receivable Aging Service
 * Enhanced to verify balances with transaction data from Phase 1 accounting foundation
 */

import prisma from './prisma';
import { getAccountBalanceDetails } from './accountBalanceService';

/**
 * Generate AR Aging Report with transaction verification
 */
export async function generateARAgingFromTransactions(tenantId, asOfDate) {
  const reportDate = new Date(asOfDate);
  reportDate.setHours(23, 59, 59, 999);

  // Get Accounts Receivable account
  const arAccount = await prisma.account.findFirst({
    where: {
      tenantId,
      accountType: 'Asset',
      isActive: true,
      OR: [
        { accountName: { contains: 'Accounts Receivable', mode: 'insensitive' } },
        { accountName: { contains: 'Receivable', mode: 'insensitive' } },
        { accountSubtype: { contains: 'Receivable', mode: 'insensitive' } }
      ]
    }
  });

  // Get AR balance from transactions
  let arBalanceFromTransactions = 0;
  if (arAccount) {
    const arBalanceDetails = await getAccountBalanceDetails(arAccount.id, tenantId, reportDate, prisma);
    arBalanceFromTransactions = arBalanceDetails.balance;
  }

  // Get all unpaid or partially paid invoices
  const invoices = await prisma.invoice.findMany({
    where: {
      tenantId,
      status: { in: ['Unpaid', 'Pending', 'Partially Paid'] },
      voidedAt: null,
      refundedAt: null,
      issueDate: { lte: reportDate }
    },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      payments: {
        where: {
          status: 'Completed',
          paymentDate: { lte: reportDate }
        },
        select: {
          amount: true,
          paymentDate: true
        }
      }
    },
    orderBy: {
      dueDate: 'asc'
    }
  });

  // Calculate aging for each invoice
  const invoiceDetails = invoices.map(invoice => {
    const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
    
    // Calculate balance from payments
    const totalPaid = invoice.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const balanceDue = invoice.total - totalPaid;
    
    let daysPastDue = 0;
    if (dueDate && !isNaN(dueDate.getTime())) {
      const diffTime = reportDate.getTime() - dueDate.getTime();
      daysPastDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    
    // Determine aging bucket
    let agingBucket = 'current';
    if (daysPastDue <= 0) {
      agingBucket = 'current';
    } else if (daysPastDue <= 30) {
      agingBucket = 'days1to30';
    } else if (daysPastDue <= 60) {
      agingBucket = 'days31to60';
    } else if (daysPastDue <= 90) {
      agingBucket = 'days61to90';
    } else {
      agingBucket = 'daysOver90';
    }
    
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber || 'N/A',
      clientId: invoice.clientId || 'unknown',
      client: invoice.client || { id: 'unknown', name: 'Unknown Client', email: null },
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      daysPastDue: daysPastDue > 0 ? daysPastDue : 0,
      amount: balanceDue,
      agingBucket,
      totalInvoice: invoice.total,
      totalPaid
    };
  });

  // Filter out invoices with zero balance
  const outstandingInvoices = invoiceDetails.filter(inv => inv.amount > 0.01);

  // Group by client
  const clientGroups = {};
  
  outstandingInvoices.forEach(invoice => {
    const clientId = invoice.clientId || 'unknown';
    const clientName = invoice.client?.name || 'Unknown Client';
    
    if (!clientGroups[clientId]) {
      clientGroups[clientId] = {
        clientId,
        clientName,
        current: 0,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        daysOver90: 0,
        total: 0,
        invoices: []
      };
    }
    
    // Add to appropriate bucket
    if (invoice.agingBucket === 'current') {
      clientGroups[clientId].current += invoice.amount;
    } else if (invoice.agingBucket === 'days1to30') {
      clientGroups[clientId].days1to30 += invoice.amount;
    } else if (invoice.agingBucket === 'days31to60') {
      clientGroups[clientId].days31to60 += invoice.amount;
    } else if (invoice.agingBucket === 'days61to90') {
      clientGroups[clientId].days61to90 += invoice.amount;
    } else {
      clientGroups[clientId].daysOver90 += invoice.amount;
    }
    
    clientGroups[clientId].total += invoice.amount;
    clientGroups[clientId].invoices.push(invoice);
  });

  // Convert to array
  const items = Object.values(clientGroups).map(client => ({
    id: client.clientId,
    name: client.clientName,
    current: Number(client.current) || 0,
    days1to30: Number(client.days1to30) || 0,
    days31to60: Number(client.days31to60) || 0,
    days61to90: Number(client.days61to90) || 0,
    daysOver90: Number(client.daysOver90) || 0,
    total: Number(client.total) || 0
  }));

  // Calculate totals
  const totals = {
    current: items.reduce((sum, item) => sum + (Number(item.current) || 0), 0),
    days1to30: items.reduce((sum, item) => sum + (Number(item.days1to30) || 0), 0),
    days31to60: items.reduce((sum, item) => sum + (Number(item.days31to60) || 0), 0),
    days61to90: items.reduce((sum, item) => sum + (Number(item.days61to90) || 0), 0),
    daysOver90: items.reduce((sum, item) => sum + (Number(item.daysOver90) || 0), 0),
    total: items.reduce((sum, item) => sum + (Number(item.total) || 0), 0)
  };

  // Verify total matches AR account balance (with tolerance)
  const difference = Math.abs(totals.total - arBalanceFromTransactions);
  const isReconciled = difference < 0.01;

  return {
    asOfDate: reportDate.toISOString(),
    items,
    totals,
    invoices: outstandingInvoices.map(inv => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      clientId: inv.clientId,
      client: inv.client,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      daysPastDue: inv.daysPastDue,
      amount: Number(inv.amount) || 0,
      totalInvoice: inv.totalInvoice,
      totalPaid: inv.totalPaid
    })),
    verification: {
      arAccountBalance: arBalanceFromTransactions,
      calculatedTotal: totals.total,
      difference,
      isReconciled,
      arAccount: arAccount ? {
        id: arAccount.id,
        accountCode: arAccount.accountCode,
        accountName: arAccount.accountName
      } : null
    },
    metadata: {
      totalInvoices: outstandingInvoices.length,
      totalClients: items.length,
      generatedAt: new Date().toISOString()
    }
  };
}










