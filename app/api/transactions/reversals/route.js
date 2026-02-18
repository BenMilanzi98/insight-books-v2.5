/**
 * API Route: Fetch all reversed transactions
 * 
 * Returns a consolidated list of all reversed transactions (sales, expenses, payments)
 * with links to original transactions and audit trail information
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

export async function GET(request) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'all', 'sale', 'expense', 'payment'
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');

    const skip = (page - 1) * limit;

    // Build where clause for date filtering
    const whereClause = {};
    
    if (startDate || endDate) {
      whereClause.reversedAt = {};
      if (startDate) {
        whereClause.reversedAt.gte = new Date(startDate);
      }
      if (endDate) {
        whereClause.reversedAt.lte = new Date(endDate + 'T23:59:59');
      }
    }

    // Note: Search filtering is done after fetching to allow searching user names
    // We don't add search to whereClause here to avoid issues with different models

    // Fetch reversed expenses
    let expensesReversals = [];
    if (type === 'all' || type === 'expense') {
      try {
        const expenseWhere = {
          ...whereClause,
          isReversal: true,
          tenantId: user.tenantId
        };
        
        expensesReversals = await prisma.expense.findMany({
          where: expenseWhere,
          include: {
            deletedBy: {
              select: { id: true, name: true, email: true }
            },
            payments: {
              select: { id: true, amount: true, paymentDate: true }
            }
          }
          // Ordering will be done in JavaScript after fetching to handle nulls
        });
      } catch (expenseError) {
        console.error('Error fetching expense reversals:', expenseError);
        // Continue with empty array
        expensesReversals = [];
      }
    }

    // Fetch reversed invoices (sales)
    let invoiceReversals = [];
    if (type === 'all' || type === 'sale') {
      try {
        const invoiceWhere = {
          ...whereClause,
          isReversal: true,
          tenantId: user.tenantId
        };
        
        invoiceReversals = await prisma.invoice.findMany({
          where: invoiceWhere,
          include: {
            client: {
              select: { id: true, name: true, email: true }
            },
            voidedBy: {
              select: { id: true, name: true, email: true }
            },
            payments: {
              select: { id: true, amount: true, paymentDate: true }
            }
          }
          // Ordering will be done in JavaScript after fetching to handle nulls
        });
      } catch (invoiceError) {
        console.error('Error fetching invoice reversals:', invoiceError);
        // Continue with empty array
        invoiceReversals = [];
      }
    }

    // Fetch reversed payments
    let paymentReversals = [];
    if (type === 'all' || type === 'payment') {
      try {
        const paymentWhere = {
          ...whereClause,
          isReversal: true,
          tenantId: user.tenantId
        };
        
        paymentReversals = await prisma.payment.findMany({
          where: paymentWhere,
          include: {
            invoice: {
              select: { id: true, client: { select: { name: true } } }
            },
            expense: {
              select: { id: true, description: true }
            }
          }
          // Ordering will be done in JavaScript after fetching to handle nulls
        });
      } catch (paymentError) {
        console.error('Error fetching payment reversals:', paymentError);
        // Continue with empty array
        paymentReversals = [];
      }
    }

    // Fetch invoice refunds
    let refundReversals = [];
    if (type === 'all' || type === 'refund') {
      try {
        const refundWhere = {
          tenantId: user.tenantId,
          status: 'completed'
        };
        
        if (startDate || endDate) {
          refundWhere.processedAt = {};
          if (startDate) {
            refundWhere.processedAt.gte = new Date(startDate);
          }
          if (endDate) {
            refundWhere.processedAt.lte = new Date(endDate + 'T23:59:59');
          }
        }
        
        refundReversals = await prisma.invoiceRefund.findMany({
          where: refundWhere,
          include: {
            invoice: {
              select: { 
                id: true, 
                invoiceNumber: true,
                client: { select: { name: true, email: true } }
              }
            },
            refundedBy: {
              select: { id: true, name: true, email: true }
            }
          }
        });
      } catch (refundError) {
        console.error('Error fetching refund reversals:', refundError);
        refundReversals = [];
      }
    }

    // Fetch refunded POS sales (reversals from /pos/list Process Refund)
    let saleRefundReversals = [];
    if (type === 'all' || type === 'sale_refund') {
      try {
        const saleRefundWhere = {
          tenantId: user.tenantId,
          refundedAt: { not: null }
        };
        if (startDate || endDate) {
          saleRefundWhere.refundedAt = {};
          if (startDate) saleRefundWhere.refundedAt.gte = new Date(startDate);
          if (endDate) saleRefundWhere.refundedAt.lte = new Date(endDate + 'T23:59:59');
        }
        saleRefundReversals = await prisma.sale.findMany({
          where: saleRefundWhere,
          include: {
            refundedBy: {
              select: { id: true, name: true, email: true }
            }
          }
        });
      } catch (saleRefundError) {
        console.error('Error fetching sale refund reversals:', saleRefundError);
        saleRefundReversals = [];
      }
    }

    // Transform and consolidate data
    const allReversals = [
      ...expensesReversals.map(expense => ({
        id: expense.id,
        type: 'expense',
        description: expense.description,
        originalAmount: parseFloat(expense.amount),
        reversalAmount: -parseFloat(expense.amount),
        date: expense.date,
        reversedAt: expense.reversedAt,
        reversalReason: expense.reversalReason,
        originalTransactionId: expense.id,
        reversalTransactionId: expense.reversedTransactionId,
        merchant: expense.merchant,
        category: expense.category,
        status: expense.status,
        performedBy: expense.deletedBy || null,
        payments: expense.payments.map(p => ({
          id: p.id,
          amount: p.amount,
          date: p.paymentDate
        }))
      })),
      ...invoiceReversals.map(invoice => ({
        id: invoice.id,
        type: 'sale',
        description: `Invoice #${invoice.invoiceNumber}`,
        originalAmount: parseFloat(invoice.total),
        reversalAmount: -parseFloat(invoice.total),
        date: invoice.issueDate, // Invoices use issueDate, not date
        reversedAt: invoice.reversedAt,
        reversalReason: invoice.reversalReason,
        originalTransactionId: invoice.id,
        reversalTransactionId: invoice.reversedTransactionId,
        client: invoice.client,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        performedBy: invoice.voidedBy || null,
        payments: invoice.payments.map(p => ({
          id: p.id,
          amount: p.amount,
          date: p.paymentDate
        }))
      })),
      ...paymentReversals.map(payment => ({
        id: payment.id,
        type: 'payment',
        description: `Payment ${payment.type === 'received' ? 'Received' : 'Made'}`,
        originalAmount: parseFloat(payment.amount),
        reversalAmount: -parseFloat(payment.amount),
        date: payment.paymentDate,
        reversedAt: payment.reversedAt,
        reversalReason: payment.reversalReason,
        originalTransactionId: payment.id,
        reversalTransactionId: payment.reversedTransactionId,
        paymentType: payment.type,
        method: payment.paymentMethod,
        reference: payment.reference,
        invoice: payment.invoice,
        expense: payment.expense,
        status: payment.status,
        performedBy: null // Payment model doesn't have a direct relation to the user who reversed it
      })),
      ...refundReversals.map(refund => ({
        id: refund.id,
        type: 'refund',
        description: `Refund for Invoice #${refund.invoice.invoiceNumber}`,
        originalAmount: parseFloat(refund.refundAmount),
        reversalAmount: -parseFloat(refund.refundAmount),
        date: refund.refundDate,
        reversedAt: refund.processedAt,
        reversalReason: refund.refundReason,
        originalTransactionId: refund.invoiceId,
        reversalTransactionId: refund.transactionId,
        invoice: {
          id: refund.invoice.id,
          invoiceNumber: refund.invoice.invoiceNumber,
          client: refund.invoice.client
        },
        refundMethod: refund.refundMethod,
        status: refund.status,
        performedBy: refund.refundedBy,
        taxReversed: null
      })),
      ...saleRefundReversals.map(sale => ({
        id: sale.id,
        type: 'sale_refund',
        description: `Refund for Sale #${sale.saleNumber}`,
        originalAmount: parseFloat(sale.total),
        reversalAmount: -parseFloat(sale.total),
        date: sale.saleDate,
        reversedAt: sale.refundedAt,
        reversalReason: sale.refundReason || 'Sale refunded',
        originalTransactionId: sale.id,
        reversalTransactionId: null,
        saleNumber: sale.saleNumber,
        status: sale.status,
        performedBy: sale.refundedBy,
        taxReversed: sale.totalTaxAmount != null ? parseFloat(sale.totalTaxAmount) : 0
      }))
    ];

    // Filter by search if provided (after fetching to allow searching user names)
    let filteredReversals = allReversals;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredReversals = allReversals.filter(reversal => {
        const matchesDescription = reversal.description?.toLowerCase().includes(searchLower);
        const matchesReason = reversal.reversalReason?.toLowerCase().includes(searchLower);
        const matchesUser = reversal.performedBy?.name?.toLowerCase().includes(searchLower);
        return matchesDescription || matchesReason || matchesUser;
      });
    }

    // Sort by reversed date (most recent first)
    filteredReversals.sort((a, b) => {
      const dateA = a.reversedAt ? new Date(a.reversedAt) : new Date(a.date || 0);
      const dateB = b.reversedAt ? new Date(b.reversedAt) : new Date(b.date || 0);
      return dateB - dateA;
    });

    // Calculate totals
    const totals = {
      count: filteredReversals.length,
      totalAmount: filteredReversals.reduce((sum, r) => sum + Math.abs(r.reversalAmount), 0),
      byType: {
        expense: filteredReversals.filter(r => r.type === 'expense').length,
        sale: filteredReversals.filter(r => r.type === 'sale').length,
        payment: filteredReversals.filter(r => r.type === 'payment').length,
        refund: filteredReversals.filter(r => r.type === 'refund').length,
        sale_refund: filteredReversals.filter(r => r.type === 'sale_refund').length
      }
    };

    // Paginate
    const paginatedReversals = filteredReversals.slice(skip, skip + limit);
    const totalPages = Math.ceil(filteredReversals.length / limit);

    return NextResponse.json({
      reversals: paginatedReversals,
      pagination: {
        page,
        limit,
        totalCount: filteredReversals.length,
        totalPages
      },
      totals
    });

  } catch (error) {
    console.error('Error fetching reversed transactions:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
    console.error('Error name:', error.name);
    return NextResponse.json(
      { 
        error: 'Failed to fetch reversed transactions',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
