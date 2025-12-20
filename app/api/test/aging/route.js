// app/api/test/aging/route.js - Test endpoint for aging calculations
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
    
    // Test receivables aging
    const invoices = await prisma.invoice.findMany({
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
        dueDate: true,
        issueDate: true
      },
      take: 10 // Limit for testing
    });
    
    // Test payables aging
    const expenses = await prisma.expense.findMany({
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
        date: true
      },
      take: 10 // Limit for testing
    });
    
    // Calculate receivables aging
    const receivablesAging = [
      { range: "0-30 days", amount: 0, invoices: [] },
      { range: "31-60 days", amount: 0, invoices: [] },
      { range: "61-90 days", amount: 0, invoices: [] },
      { range: ">90 days", amount: 0, invoices: [] }
    ];
    
    invoices.forEach(invoice => {
      const dueDate = new Date(invoice.dueDate);
      const daysDiff = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
      const amountOwed = invoice.remainingBalance || (invoice.total - (invoice.totalPaid || 0));
      
      if (daysDiff <= 30) {
        receivablesAging[0].amount += amountOwed;
        receivablesAging[0].invoices.push({
          id: invoice.id,
          number: invoice.invoiceNumber,
          amount: amountOwed,
          daysDiff
        });
      } else if (daysDiff <= 60) {
        receivablesAging[1].amount += amountOwed;
        receivablesAging[1].invoices.push({
          id: invoice.id,
          number: invoice.invoiceNumber,
          amount: amountOwed,
          daysDiff
        });
      } else if (daysDiff <= 90) {
        receivablesAging[2].amount += amountOwed;
        receivablesAging[2].invoices.push({
          id: invoice.id,
          number: invoice.invoiceNumber,
          amount: amountOwed,
          daysDiff
        });
      } else {
        receivablesAging[3].amount += amountOwed;
        receivablesAging[3].invoices.push({
          id: invoice.id,
          number: invoice.invoiceNumber,
          amount: amountOwed,
          daysDiff
        });
      }
    });
    
    // Calculate payables aging
    const payablesAging = [
      { range: "0-30 days", amount: 0, expenses: [] },
      { range: "31-60 days", amount: 0, expenses: [] },
      { range: "61-90 days", amount: 0, expenses: [] },
      { range: ">90 days", amount: 0, expenses: [] }
    ];
    
    expenses.forEach(expense => {
      const dueDate = new Date(expense.date);
      dueDate.setDate(dueDate.getDate() + 30); // 30-day payment terms
      const daysDiff = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
      
      let amountOwed = expense.amount;
      if (expense.paymentStatus === 'Partially' && expense.paidAmount) {
        amountOwed = expense.amount - expense.paidAmount;
      }
      
      if (daysDiff <= 30) {
        payablesAging[0].amount += amountOwed;
        payablesAging[0].expenses.push({
          id: expense.id,
          description: expense.description,
          amount: amountOwed,
          daysDiff
        });
      } else if (daysDiff <= 60) {
        payablesAging[1].amount += amountOwed;
        payablesAging[1].expenses.push({
          id: expense.id,
          description: expense.description,
          amount: amountOwed,
          daysDiff
        });
      } else if (daysDiff <= 90) {
        payablesAging[2].amount += amountOwed;
        payablesAging[2].expenses.push({
          id: expense.id,
          description: expense.description,
          amount: amountOwed,
          daysDiff
        });
      } else {
        payablesAging[3].amount += amountOwed;
        payablesAging[3].expenses.push({
          id: expense.id,
          description: expense.description,
          amount: amountOwed,
          daysDiff
        });
      }
    });
    
    return NextResponse.json({
      test: {
        currentDate: now.toISOString(),
        receivables: {
          totalInvoices: invoices.length,
          aging: receivablesAging
        },
        payables: {
          totalExpenses: expenses.length,
          aging: payablesAging
        }
      }
    });
    
  } catch (error) {
    console.error('Error testing aging calculations:', error);
    return NextResponse.json(
      { error: 'Failed to test aging calculations' },
      { status: 500 }
    );
  }
}
