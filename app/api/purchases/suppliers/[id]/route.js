// app/api/purchases/suppliers/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

async function getSupplierForTenant(id, tenantId) {
  return prisma.supplier.findFirst({
    where: { id, tenantId }
  });
}

export async function GET(request, { params }) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeTransactions = searchParams.get('includeTransactions') === 'true';

    const supplier = await getSupplierForTenant(params.id, user.tenantId);
    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    // If transactions are requested, fetch comprehensive transaction data
    if (includeTransactions) {
      const { updateSupplierBalance } = await import('@/lib/supplierService');
      
      // Update supplier balance to ensure accuracy
      await updateSupplierBalance(params.id, user.tenantId);
      
      // Fetch updated supplier with balance
      const updatedSupplier = await getSupplierForTenant(params.id, user.tenantId);
      
      // Get bills summary
      const billsAggregation = await prisma.supplierBill.aggregate({
        where: {
          supplierId: params.id,
          tenantId: user.tenantId
        },
        _sum: {
          totalAmount: true,
          amountPaid: true
        },
        _count: true
      });

      const expenseRowsForSummary = await prisma.expense.findMany({
        where: {
          supplierId: params.id,
          tenantId: user.tenantId,
          isDeleted: false
        },
        select: { amount: true, taxAmount: true, paidAmount: true, paymentStatus: true }
      });
      const { expenseGrossAmount, expenseOutstandingPayable } = await import('@/lib/supplierService');
      const totalExpensesGross = expenseRowsForSummary.reduce((s, e) => s + expenseGrossAmount(e), 0);
      const totalExpensesPaidOnRows = expenseRowsForSummary.reduce(
        (s, e) => s + (Number(e.paidAmount) || 0),
        0
      );
      const expensesOutstandingFromRows = expenseRowsForSummary
        .filter((e) => e.paymentStatus === 'Pending' || e.paymentStatus === 'Partially')
        .reduce((s, e) => s + expenseOutstandingPayable(e), 0);

      // Get payments summary
      const paymentsAggregation = await prisma.supplierPayment.aggregate({
        where: {
          supplierId: params.id,
          tenantId: user.tenantId
        },
        _sum: {
          totalAmount: true
        },
        _count: true
      });

      const totalBills = Number(billsAggregation._sum.totalAmount || 0);
      const totalBillsPaid = Number(billsAggregation._sum.amountPaid || 0);
      const billsOutstanding = totalBills - totalBillsPaid;

      const totalExpenses = totalExpensesGross;
      const totalExpensesPaid = totalExpensesPaidOnRows;
      const expensesOutstanding = expensesOutstandingFromRows;

      const totalPayments = Number(paymentsAggregation._sum.totalAmount || 0);

      return NextResponse.json({
        supplier: updatedSupplier,
        transactions: {
          bills: {
            total: billsAggregation._count || 0,
            totalAmount: totalBills,
            totalPaid: totalBillsPaid,
            outstanding: billsOutstanding
          },
          expenses: {
            total: expenseRowsForSummary.length || 0,
            totalAmount: totalExpenses,
            totalPaid: totalExpensesPaid,
            outstanding: expensesOutstanding
          },
          payments: {
            total: paymentsAggregation._count || 0,
            totalAmount: totalPayments
          },
          summary: {
            totalOwed: billsOutstanding + expensesOutstanding,
            totalBilled: totalBills + totalExpenses,
            totalPaid: totalBillsPaid + totalExpensesPaid,
            currentBalance: Number(updatedSupplier.currentBalance || 0)
          }
        }
      });
    }

    return NextResponse.json({ supplier });
  } catch (error) {
    console.error('Error fetching supplier:', error);
    return NextResponse.json(
      { error: 'Failed to fetch supplier. Please try again.' },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supplier = await getSupplierForTenant(params.id, user.tenantId);
    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    const body = await request.json();

    // Validate email format if provided
    if (body.email !== undefined && body.email && body.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        );
      }
    }

    // Validate phone format if provided
    const validatePhone = (phone) => {
      if (!phone) return true;
      const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
      return phoneRegex.test(phone.replace(/\s/g, ''));
    };

    if (body.phone !== undefined && body.phone && !validatePhone(body.phone)) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    if (body.mobile !== undefined && body.mobile && !validatePhone(body.mobile)) {
      return NextResponse.json(
        { error: 'Invalid mobile number format' },
        { status: 400 }
      );
    }

    // Avoid changing tenantId / currentBalance directly unless provided intentionally
    const data = {
      supplierName: body.supplierName ?? supplier.supplierName,
      contactPerson: body.contactPerson ?? supplier.contactPerson,
      email: body.email ?? supplier.email,
      phone: body.phone ?? supplier.phone,
      mobile: body.mobile ?? supplier.mobile,
      address: body.address ?? supplier.address,
      city: body.city ?? supplier.city,
      country: body.country ?? supplier.country,
      postalCode: body.postalCode ?? supplier.postalCode,
      taxId: body.taxId ?? supplier.taxId,
      paymentTerms: body.paymentTerms ?? supplier.paymentTerms,
      currency: body.currency ?? supplier.currency,
      creditLimit: body.creditLimit ?? supplier.creditLimit,
      bankName: body.bankName ?? supplier.bankName,
      bankAccountNumber: body.bankAccountNumber ?? supplier.bankAccountNumber,
      bankBranch: body.bankBranch ?? supplier.bankBranch,
      notes: body.notes ?? supplier.notes,
      isActive: body.isActive ?? supplier.isActive,
      modifiedById: user.id
    };

    if (body.currentBalance !== undefined) {
      data.currentBalance = body.currentBalance;
    }

    if (body.supplierCode && body.supplierCode !== supplier.supplierCode) {
      const exists = await prisma.supplier.findFirst({
        where: {
          tenantId: user.tenantId,
          supplierCode: body.supplierCode,
          NOT: { id: supplier.id }
        }
      });
      if (exists) {
        return NextResponse.json(
          { error: 'Supplier code already exists' },
          { status: 400 }
        );
      }
      data.supplierCode = body.supplierCode;
    }

    const updated = await prisma.supplier.update({
      where: { id: supplier.id },
      data
    });

    return NextResponse.json({ supplier: updated });
  } catch (error) {
    console.error('Error updating supplier:', error);
    return NextResponse.json(
      { error: 'Failed to update supplier. Please try again.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supplier = await getSupplierForTenant(params.id, user.tenantId);
    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    await prisma.supplier.update({
      where: { id: supplier.id },
      data: { isActive: false, modifiedById: user.id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    return NextResponse.json(
      { error: 'Failed to delete supplier. Please try again.' },
      { status: 500 }
    );
  }
}


