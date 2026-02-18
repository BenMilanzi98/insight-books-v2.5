// app/api/purchases/suppliers/[id]/transactions/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

/**
 * GET /api/purchases/suppliers/[id]/transactions
 * Get comprehensive transaction data for a supplier including bills, expenses, and payments
 */
export async function GET(request, { params }) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id: supplierId } = params;
    const { searchParams } = new URL(request.url);
    
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Verify supplier belongs to user's tenant
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, tenantId: user.tenantId }
    });

    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    // Build date filter
    const dateFilter = {};
    if (dateFrom || dateTo) {
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(dateTo);
    }

    // ============================================
    // BILLS DATA
    // ============================================
    const billsWhere = {
      supplierId,
      tenantId: user.tenantId,
      ...(Object.keys(dateFilter).length > 0 ? { billDate: dateFilter } : {})
    };

    const bills = await prisma.supplierBill.findMany({
      where: billsWhere,
      orderBy: { billDate: 'desc' },
      include: {
        allocations: {
          include: {
            payment: {
              select: {
                id: true,
                paymentNumber: true,
                paymentDate: true,
                paymentMethod: true,
                totalAmount: true
              }
            }
          }
        }
      }
    });

    // Calculate bills summary
    const billsSummary = {
      totalBills: bills.length,
      totalBillsAmount: bills.reduce((sum, bill) => sum + Number(bill.totalAmount || 0), 0),
      totalBillsPaid: bills.reduce((sum, bill) => sum + Number(bill.amountPaid || 0), 0),
      billsOutstanding: bills.reduce((sum, bill) => {
        const balance = Number(bill.totalAmount || 0) - Number(bill.amountPaid || 0);
        return sum + Math.max(0, balance);
      }, 0),
      paidBillsCount: bills.filter(bill => bill.status === 'Paid').length,
      partiallyPaidBillsCount: bills.filter(bill => bill.status === 'Partially Paid').length,
      unpaidBillsCount: bills.filter(bill => ['Draft', 'Approved', 'Finalized'].includes(bill.status)).length
    };

    // ============================================
    // EXPENSES DATA
    // ============================================
    const expensesWhere = {
      supplierId,
      tenantId: user.tenantId,
      isDeleted: false,
      ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {})
    };

    const expenses = await prisma.expense.findMany({
      where: expensesWhere,
      orderBy: { date: 'desc' },
      include: {
        submittedBy: {
          select: { id: true, name: true }
        },
        payments: {
          where: { status: 'Completed' },
          orderBy: { paymentDate: 'desc' },
          select: {
            id: true,
            amount: true,
            paymentMethod: true,
            paymentDate: true,
            reference: true,
            status: true
          }
        }
      }
    });

    // Calculate expenses summary
    const expensesSummary = {
      totalExpenses: expenses.length,
      totalExpensesAmount: expenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0),
      totalExpensesPaid: expenses.reduce((sum, exp) => {
        const paidAmount = exp.payments?.reduce((pSum, p) => pSum + Number(p.amount), 0) || 0;
        return sum + paidAmount;
      }, 0),
      expensesOutstanding: expenses.reduce((sum, exp) => {
        const paidAmount = exp.payments?.reduce((pSum, p) => pSum + Number(p.amount), 0) || 0;
        const balance = Number(exp.amount || 0) - paidAmount;
        return sum + Math.max(0, balance);
      }, 0),
      fullyPaidExpensesCount: expenses.filter(exp => exp.paymentStatus === 'Fully paid').length,
      partiallyPaidExpensesCount: expenses.filter(exp => exp.paymentStatus === 'Partially').length,
      unpaidExpensesCount: expenses.filter(exp => exp.paymentStatus === 'Pending').length
    };

    // ============================================
    // PAYMENTS DATA
    // ============================================
    const paymentsWhere = {
      supplierId,
      tenantId: user.tenantId,
      ...(Object.keys(dateFilter).length > 0 ? { paymentDate: dateFilter } : {})
    };

    const payments = await prisma.supplierPayment.findMany({
      where: paymentsWhere,
      orderBy: { paymentDate: 'desc' },
      include: {
        allocations: {
          include: {
            bill: {
              select: {
                id: true,
                billNumber: true,
                billDate: true,
                totalAmount: true
              }
            }
          }
        }
      }
    });

    // Calculate payments summary
    const paymentsSummary = {
      totalPayments: payments.length,
      totalPaymentsAmount: payments.reduce((sum, p) => sum + Number(p.totalAmount || 0), 0),
      paymentsToBills: payments.reduce((sum, p) => {
        const billAllocations = p.allocations?.reduce((aSum, a) => aSum + Number(a.amount || 0), 0) || 0;
        return sum + billAllocations;
      }, 0)
    };

    // ============================================
    // OVERALL SUMMARY
    // ============================================
    const overallSummary = {
      totalOwed: billsSummary.billsOutstanding + expensesSummary.expensesOutstanding,
      totalBilled: billsSummary.totalBillsAmount + expensesSummary.totalExpensesAmount,
      totalPaid: billsSummary.totalBillsPaid + expensesSummary.totalExpensesPaid,
      currentBalance: supplier.currentBalance || 0,
      // Breakdown
      bills: billsSummary,
      expenses: expensesSummary,
      payments: paymentsSummary
    };

    // Format bills for response
    const formattedBills = bills.map(bill => ({
      id: bill.id,
      billNumber: bill.billNumber,
      billDate: bill.billDate,
      dueDate: bill.dueDate,
      totalAmount: Number(bill.totalAmount || 0),
      amountPaid: Number(bill.amountPaid || 0),
      balanceDue: Number(bill.totalAmount || 0) - Number(bill.amountPaid || 0),
      status: bill.status,
      billType: bill.billType,
      supplierInvoiceNumber: bill.supplierInvoiceNumber,
      allocations: bill.allocations.map(allocation => ({
        id: allocation.id,
        amount: Number(allocation.amount || 0),
        payment: allocation.payment ? {
          id: allocation.payment.id,
          paymentNumber: allocation.payment.paymentNumber,
          paymentDate: allocation.payment.paymentDate,
          paymentMethod: allocation.payment.paymentMethod,
          totalAmount: Number(allocation.payment.totalAmount || 0)
        } : null
      }))
    }));

    // Format expenses for response
    const formattedExpenses = expenses.map(exp => ({
      id: exp.id,
      description: exp.description,
      date: exp.date,
      amount: Number(exp.amount || 0),
      paidAmount: Number(exp.paidAmount || 0),
      balanceDue: Number(exp.amount || 0) - (exp.payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0),
      paymentStatus: exp.paymentStatus,
      category: exp.category,
      merchant: exp.merchant,
      submittedBy: exp.submittedBy,
      payments: exp.payments.map(p => ({
        id: p.id,
        amount: Number(p.amount || 0),
        paymentMethod: p.paymentMethod,
        paymentDate: p.paymentDate,
        reference: p.reference,
        status: p.status
      }))
    }));

    // Format payments for response
    const formattedPayments = payments.map(payment => ({
      id: payment.id,
      paymentNumber: payment.paymentNumber,
      paymentDate: payment.paymentDate,
      paymentMethod: payment.paymentMethod,
      totalAmount: Number(payment.totalAmount || 0),
      referenceNumber: payment.referenceNumber,
      notes: payment.notes,
      allocations: payment.allocations.map(allocation => ({
        id: allocation.id,
        amount: Number(allocation.amount || 0),
        bill: allocation.bill ? {
          id: allocation.bill.id,
          billNumber: allocation.bill.billNumber,
          billDate: allocation.bill.billDate,
          totalAmount: Number(allocation.bill.totalAmount || 0)
        } : null
      }))
    }));

    return NextResponse.json({
      supplier: {
        id: supplier.id,
        supplierName: supplier.supplierName,
        supplierCode: supplier.supplierCode,
        currentBalance: Number(supplier.currentBalance || 0)
      },
      summary: overallSummary,
      bills: formattedBills,
      expenses: formattedExpenses,
      payments: formattedPayments
    });
  } catch (error) {
    console.error('Error fetching supplier transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch supplier transactions. Please try again.' },
      { status: 500 }
    );
  }
}
