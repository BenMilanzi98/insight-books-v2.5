// app/api/liabilities/[id]/payments/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

const PAYMENT_METHOD_ACCOUNT_MAP = {
  cash: {
    codes: ['1000', '1010'],
    keywords: ['cash']
  },
  bank_transfer: {
    codes: ['1020'],
    keywords: ['bank', 'transfer']
  },
  airtel_money: {
    codes: ['1030'],
    keywords: ['airtel']
  },
  mpamba: {
    codes: ['1040'],
    keywords: ['mpamba']
  },
  paychangu: {
    codes: ['1050'],
    keywords: ['paychangu']
  }
};

async function resolvePaymentAccount(client, tenantId, paymentMethod) {
  const mapEntry = PAYMENT_METHOD_ACCOUNT_MAP[paymentMethod] || PAYMENT_METHOD_ACCOUNT_MAP.cash;

  for (const code of mapEntry.codes) {
    const account = await client.account.findFirst({
      where: {
        tenantId,
        accountCode: code,
        isActive: true
      }
    });
    if (account) return account;
  }

  for (const keyword of mapEntry.keywords) {
    const account = await client.account.findFirst({
      where: {
        tenantId,
        isActive: true,
        accountName: { contains: keyword, mode: 'insensitive' }
      }
    });
    if (account) return account;
  }

  const fallback = await client.account.findFirst({
    where: {
      tenantId,
      isActive: true,
      accountType: 'Asset'
    },
    orderBy: { accountCode: 'asc' }
  });

  return fallback;
}

async function resolveLoanExpenseAccount(client, tenantId) {
  const preferredCodes = ['7010', '7000'];

  for (const code of preferredCodes) {
    const account = await client.account.findFirst({
      where: {
        tenantId,
        accountCode: code,
        isActive: true
      }
    });
    if (account) return account;
  }

  const keywordAccount = await client.account.findFirst({
    where: {
      tenantId,
      isActive: true,
      accountType: 'Expense',
      accountName: { contains: 'interest', mode: 'insensitive' }
    }
  });
  if (keywordAccount) return keywordAccount;

  return client.account.findFirst({
    where: {
      tenantId,
      isActive: true,
      accountType: 'Expense'
    },
    orderBy: { accountCode: 'asc' }
  });
}

/**
 * GET handler for liability payments
 * Fetches all payments for a specific liability
 */
export async function GET(request, { params }) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) {
      return accessError;
    }

    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Verify liability exists and belongs to tenant
    const liability = await prisma.liability.findFirst({
      where: {
        id: id,
        tenantId: user.tenantId
      },
      include: {
        category: {
          select: {
            name: true
          }
        }
      }
    });

    if (!liability) {
      return NextResponse.json(
        { error: 'Liability not found' },
        { status: 404 }
      );
    }

    // Fetch payments
    const payments = await prisma.liabilityPayment.findMany({
      where: {
        liabilityId: id
      },
      orderBy: {
        paymentDate: 'desc'
      }
    });

    return NextResponse.json({
      payments
    });

  } catch (error) {
    console.error('Error fetching liability payments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payments', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST handler for creating a liability payment
 * Records a payment against a liability
 */
export async function POST(request, { params }) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) {
      return accessError;
    }

    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    // Validate required fields
    if (!body.amount || !body.paymentDate) {
      return NextResponse.json(
        { error: 'Missing required fields: amount, paymentDate' },
        { status: 400 }
      );
    }

    // Verify liability exists and belongs to tenant
    const liability = await prisma.liability.findFirst({
      where: {
        id: id,
        tenantId: user.tenantId
      }
    });

    if (!liability) {
      return NextResponse.json(
        { error: 'Liability not found' },
        { status: 404 }
      );
    }

    const paymentAmount = parseFloat(body.amount) || 0;
    const paymentType = body.paymentType || 'both';
    const paymentMethod = (body.paymentMethod || 'cash').toLowerCase();
    const principalPaid = paymentType === 'principal' || paymentType === 'both' 
      ? (body.principalPaid ? parseFloat(body.principalPaid) : paymentAmount) 
      : 0;
    const interestPaid = paymentType === 'interest' || paymentType === 'both'
      ? (body.interestPaid ? parseFloat(body.interestPaid) : (paymentAmount - principalPaid))
      : 0;

    const result = await prisma.$transaction(async (tx) => {
      // Create payment
      const payment = await tx.liabilityPayment.create({
        data: {
          liabilityId: id,
          amount: paymentAmount,
          paymentDate: new Date(body.paymentDate),
          paymentType: paymentType,
          principalPaid: principalPaid,
          interestPaid: interestPaid,
          reference: body.reference || null,
          notes: body.notes || null
        }
      });

      // Update liability balance and total paid
      const updatedLiability = await tx.liability.update({
        where: { id: id },
        data: {
          currentBalance: {
            decrement: principalPaid
          },
          totalPaid: {
            increment: paymentAmount
          },
          // Update status if fully paid
          status: liability.currentBalance - principalPaid <= 0.01 ? 'paid_off' : liability.status
        }
      });

      // Determine paid-from account using payment processing method mapping
      const cashAccount = await resolvePaymentAccount(tx, user.tenantId, paymentMethod);

      if (!cashAccount) {
        throw new Error('No asset account found for the selected payment method. Please configure the Chart of Accounts.');
      }

      const expenseAccount = await resolveLoanExpenseAccount(tx, user.tenantId);
      if (!expenseAccount) {
        throw new Error('Unable to find an expense account to record the loan payment. Please create an expense account in the Chart of Accounts.');
      }

      const journalLines = [
        {
          lineNumber: 1,
          accountId: expenseAccount.id,
          debitAmount: paymentAmount,
          creditAmount: 0,
          description: 'Loan payment expense'
        },
        {
          lineNumber: 2,
          accountId: cashAccount.id,
          debitAmount: 0,
          creditAmount: paymentAmount,
          description: `Payment via ${paymentMethod.replace('_', ' ')}`
        }
      ];

      const journalEntry = await tx.journalEntry.create({
        data: {
          tenantId: user.tenantId,
          entryDate: new Date(body.paymentDate),
          description: `Liability payment for ${liability.name}`,
          entryType: 'Regular',
          status: 'Posted',
          sourceType: 'LiabilityPayment',
          sourceId: payment.id,
          createdById: user.id,
          lines: {
            create: journalLines
          }
        },
        include: { lines: true }
      });

      const trasactionRecord = await tx.transaction.create({
        data: {
          tenantId: user.tenantId,
          date: new Date(body.paymentDate),
          description: `Liability payment - ${liability.name}`,
          reference: body.reference || payment.id,
          status: 'posted'
        }
      });

      const expenseRecord = await tx.expense.create({
        data: {
          tenantId: user.tenantId,
          description: `Loan payment - ${liability.name}`,
          amount: paymentAmount,
          date: new Date(body.paymentDate),
          category: 'Loan Payment',
          paymentMethod: paymentMethod,
          sourceAccountId: cashAccount.id,
          submittedById: user.id,
          status: 'Approved',
          notes: body.notes || null,
          merchant: liability.lender || liability.name || null,
          paymentStatus: 'Fully paid',
          paidAmount: paymentAmount,
          paymentReference: body.reference || null
        }
      });

      const paymentRecord = await tx.payment.create({
        data: {
          tenantId: user.tenantId,
          type: 'Loan Payment',
          expenseId: expenseRecord.id,
          amount: paymentAmount,
          paymentDate: new Date(body.paymentDate),
          paymentMethod: paymentMethod,
          sourceAccount: paymentMethod,
          reference: body.reference || `LIAB-${payment.id}`,
          notes: body.notes || `Liability payment for ${liability.name}`,
          status: 'Completed'
        }
      });

      return { payment, updatedLiability, journalEntry, expenseRecord, paymentRecord, transactionRecord: trasactionRecord };
    });

    await prisma.accountBalance.upsert({
      where: {
        tenantId_account: {
          tenantId: user.tenantId,
          account: paymentMethod
        }
      },
      update: {
        balance: {
          decrement: paymentAmount
        }
      },
      create: {
        tenantId: user.tenantId,
        account: paymentMethod,
        balance: -paymentAmount
      }
    });

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'LIABILITY_PAYMENT_CREATED',
        entityType: 'LIABILITY_PAYMENT',
        entityId: result.payment.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          liabilityId: id,
          paymentId: result.payment.id,
          amount: paymentAmount,
          principalPaid: principalPaid,
          interestPaid: interestPaid,
          paymentMethod,
          journalEntryId: result.journalEntry.id,
          expenseId: result.expenseRecord.id,
          paymentRecordId: result.paymentRecord.id,
          transactionId: result.transactionRecord.id
        })
      }
    });

    return NextResponse.json({
      message: 'Payment recorded successfully',
      payment: result.payment,
      liability: result.updatedLiability,
      journalEntry: result.journalEntry
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating liability payment:', error);
    return NextResponse.json(
      { error: 'Failed to record payment', details: error.message },
      { status: 500 }
    );
  }
}


