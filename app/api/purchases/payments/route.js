// app/api/purchases/payments/route.js
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { createSupplierPaymentEntry } from '@/lib/purchaseAccounting';
import { getAccountForPaymentMethod } from '@/lib/paymentMethodAccountMapping';

function parsePagination(searchParams) {
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
  const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100);
  return { page, limit };
}

function looksLikeRecordId(value) {
  return typeof value === 'string' && value.length > 20 && /^[a-z0-9]+$/i.test(value);
}

function formatPaymentMethodName(paymentMethod, paymentAccountById) {
  const paymentAccount = paymentAccountById.get(paymentMethod);
  if (paymentAccount) {
    return paymentAccount.accountType
      ? `${paymentAccount.name} (${paymentAccount.accountType})`
      : paymentAccount.name;
  }

  return looksLikeRecordId(paymentMethod) ? 'Unknown method' : paymentMethod || '—';
}

export async function GET(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);
    const supplierId = searchParams.get('supplierId');
    const search = searchParams.get('search');

    const where = { tenantId: user.tenantId };
    if (supplierId) where.supplierId = supplierId;
    if (search) {
      where.OR = [
        { paymentNumber: { contains: search, mode: 'insensitive' } },
        { referenceNumber: { contains: search, mode: 'insensitive' } }
      ];
    }

    const totalCount = await prisma.supplierPayment.count({ where });
    const payments = await prisma.supplierPayment.findMany({
      where,
      orderBy: { paymentDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        supplier: { select: { supplierName: true, supplierCode: true } },
        allocations: {
          include: {
            bill: {
              select: {
                billNumber: true,
                totalAmount: true,
                amountPaid: true,
                goodsReceipt: { select: { receiptNumber: true } },
              },
            }
          }
        }
      }
    });

    const paymentMethodIds = [
      ...new Set(payments.map((payment) => payment.paymentMethod).filter(looksLikeRecordId)),
    ];
    const paymentAccounts = paymentMethodIds.length
      ? await prisma.paymentAccount.findMany({
          where: {
            tenantId: user.tenantId,
            id: { in: paymentMethodIds },
          },
          select: { id: true, name: true, accountType: true },
        })
      : [];
    const paymentAccountById = new Map(
      paymentAccounts.map((account) => [account.id, account])
    );

    return NextResponse.json({
      payments: payments.map((payment) => ({
        ...payment,
        paymentMethodName: formatPaymentMethodName(
          payment.paymentMethod,
          paymentAccountById
        ),
      })),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching supplier payments:', error);
    return NextResponse.json({ error: 'Failed to fetch supplier payments.' }, { status: 500 });
  }
}

function normalizePaymentMethod(method) {
  if (!method) return 'cash';
  return method.toString().trim().toLowerCase().replace(/\s+/g, '_') || 'cash';
}

const round2 = (n) => Math.round(Number(n) * 100) / 100;

export async function POST(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    if (!body.supplierId) return NextResponse.json({ error: 'supplierId is required' }, { status: 400 });
    if (!body.paymentDate) return NextResponse.json({ error: 'paymentDate is required' }, { status: 400 });
    if (!body.totalAmount || Number(body.totalAmount) <= 0) {
      return NextResponse.json({ error: 'totalAmount must be greater than zero' }, { status: 400 });
    }
    if (!Array.isArray(body.allocations) || body.allocations.length === 0) {
      return NextResponse.json({ error: 'At least one bill allocation is required' }, { status: 400 });
    }

    const supplier = await prisma.supplier.findFirst({
      where: { id: body.supplierId, tenantId: user.tenantId }
    });
    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    const allocations = [];
    for (const allocation of body.allocations) {
      if (!allocation.billId || Number(allocation.amount) <= 0) {
        return NextResponse.json({ error: 'Invalid allocation entry' }, { status: 400 });
      }
      const bill = await prisma.supplierBill.findFirst({
        where: { id: allocation.billId, tenantId: user.tenantId, supplierId: supplier.id },
        include: { items: { select: { taxRate: true, taxAmount: true } } },
      });
      if (!bill) {
        return NextResponse.json({ error: `Bill ${allocation.billId} not found` }, { status: 404 });
      }
      if (bill.status === 'Paid') {
        return NextResponse.json(
          { error: `Bill ${bill.billNumber} is already paid` },
          { status: 400 }
        );
      }
      const remaining = Number(bill.totalAmount) - Number(bill.amountPaid);
      if (Number(allocation.amount) > remaining) {
        return NextResponse.json(
          { error: `Allocation for bill ${bill.billNumber} exceeds remaining balance` },
          { status: 400 }
        );
      }
      allocations.push({ bill, amount: Number(allocation.amount) });
    }

    const paymentNumber = body.paymentNumber?.trim() || `SP-${Date.now()}`;
    const paymentMethodInput = body.paymentMethod || 'Cash';

    {
      const { assertPaymentAccountHasFunds } = await import(
        '@/lib/paymentAccountBalanceResolver'
      );
      const funds = await assertPaymentAccountHasFunds(
        user.tenantId,
        paymentMethodInput,
        Number(body.totalAmount)
      );
      if (!funds.ok) {
        return NextResponse.json(
          {
            error: funds.message,
            code: funds.code,
            available: funds.available,
            required: funds.required,
            shortfall: funds.shortfall,
          },
          { status: 400 }
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.supplierPayment.create({
        data: {
          tenantId: user.tenantId,
          supplierId: supplier.id,
          paymentNumber,
          paymentDate: new Date(body.paymentDate),
          paymentMethod: paymentMethodInput,
          bankAccountId: body.bankAccountId || null,
          referenceNumber: body.referenceNumber || null,
          totalAmount: Number(body.totalAmount),
          currency: body.currency || supplier.currency || 'MWK',
          notes: body.notes || null,
          createdById: user.id
        }
      });

      for (const { bill, amount } of allocations) {
        await tx.supplierPaymentAllocation.create({
          data: {
            tenantId: user.tenantId,
            paymentId: payment.id,
            billId: bill.id,
            amount
          }
        });

        const newAmountPaid = Number(bill.amountPaid) + amount;
        await tx.supplierBill.update({
          where: { id: bill.id },
          data: {
            amountPaid: newAmountPaid,
            status: newAmountPaid >= Number(bill.totalAmount) ? 'Paid' : 'Partially Paid'
          }
        });
      }

      await tx.supplier.update({
        where: { id: supplier.id },
        data: {
          currentBalance: new Prisma.Decimal(
            Number(supplier.currentBalance) - Number(body.totalAmount)
          )
        }
      });

      // Get the payment account ID to update balances
      let paymentAccount;
      try {
        paymentAccount = await getAccountForPaymentMethod(user.tenantId, paymentMethodInput, tx);
      } catch (error) {
        console.error('Error getting payment account:', error.message);
        // Fallback: try to find account by code 1030 (Airtel Money) directly
        if (paymentMethodInput === 'Airtel Money') {
          paymentAccount = await tx.account.findFirst({
            where: {
              tenantId: user.tenantId,
              accountCode: '1030',
              isActive: true,
              accountType: 'Asset'
            }
          });
        }
        
        // If still not found, try to find any active asset account as a last resort
        if (!paymentAccount) {
          paymentAccount = await tx.account.findFirst({
            where: {
              tenantId: user.tenantId,
              isActive: true,
              accountType: 'Asset'
            },
            orderBy: { accountCode: 'asc' }
          });
        }
        
        if (!paymentAccount) {
          throw new Error(`No payment account found for method: ${paymentMethodInput}. Please set up your chart of accounts.`);
        }
      }
      
      let journalEntry;
      try {
        journalEntry = await createSupplierPaymentEntry({
          tenantId: user.tenantId,
          userId: user.id,
          paymentId: payment.id,
          supplierName: supplier.supplierName,
          amount: Number(body.totalAmount),
          paymentMethod: paymentMethodInput,
          reference: payment.paymentNumber,
          tx
        });
      } catch (error) {
        console.error('Error creating supplier payment journal entry:', error);
        throw new Error(`Failed to create journal entry for payment: ${error.message}`);
      }

      // Supplier payment GL via V2 adapter inside createSupplierPaymentEntry (JournalEntry).
      await tx.supplierPayment.update({
        where: { id: payment.id },
        data: { journalEntryId: journalEntry?.journalEntryId || journalEntry?.id || null }
      });

      // Fresh-books: no separate Tax-SupplierPayment Transaction rows. Input tax is
      // expected in the main V2 supplier-payment / bill journals; skip with log only.
      for (const { bill, amount } of allocations) {
        const billTax = Number(bill.taxAmount || 0);
        const billTotal = Number(bill.totalAmount || 0);
        if (billTax > 0 && billTotal > 0) {
          const proportionalTax = round2((amount / billTotal) * billTax);
          if (proportionalTax > 0) {
            console.info(
              'Supplier payment: skipping legacy Tax-SupplierPayment Transaction (tax in V2 JE)',
              { paymentId: payment.id, billId: bill.id, proportionalTax }
            );
          }
        }
      }

      await tx.auditLog.create({
        data: {
          action: 'SUPPLIER_PAYMENT_CREATED',
          entityType: 'SUPPLIER_PAYMENT',
          entityId: payment.id,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            paymentNumber: payment.paymentNumber,
            supplierId: supplier.id,
            supplierName: supplier.supplierName,
            totalAmount: Number(body.totalAmount),
            paymentMethod: paymentMethodInput,
            referenceNumber: body.referenceNumber || null,
            allocations: allocations.map(({ bill, amount }) => ({
              billId: bill.id,
              billNumber: bill.billNumber,
              amount,
            })),
          }),
        },
      });

      return payment;
    });

    return NextResponse.json({ payment: result }, { status: 201 });
  } catch (error) {
    console.error('Error creating supplier payment:', error);
    // Return more specific error messages
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: error.message || 'Failed to create supplier payment.' },
      { status: 500 }
    );
  }
}

