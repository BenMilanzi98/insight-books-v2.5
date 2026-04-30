// app/api/liabilities/[id]/payments/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { assertPeriodOpen } from '@/lib/accountingPeriodService';
import { generateReferenceNumber } from '@/lib/journalService';
import { updateAccountBalanceOnTransaction } from '@/lib/accountBalanceService';
import { FLOAT_TOLERANCE } from '@/lib/journalEntryValidation';

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

/**
 * Resolve the liability account for loan principal payments
 * Principal payments should DEBIT the liability account (reducing the liability)
 * @param {import('@prisma/client').PrismaClient|import('@prisma/client').Prisma.TransactionClient} client
 * @param {string} tenantId
 * @param {{ name?: string|null, glAccountId?: string|null }} liability
 */
async function resolveLiabilityAccount(client, tenantId, liability) {
  if (liability?.glAccountId) {
    const linked = await client.account.findFirst({
      where: {
        id: liability.glAccountId,
        tenantId,
        accountType: 'Liability',
        isActive: true,
      },
    });
    if (linked) {
      return linked;
    }
  }

  const liabilityName = liability?.name || null;
  // Preferred account codes for loans/liabilities
  const preferredCodes = ['2510', '2160', '2500', '2300', '2400', '2110', '2000', '2100'];

  for (const code of preferredCodes) {
    const account = await client.account.findFirst({
      where: {
        tenantId,
        accountCode: code,
        accountType: 'Liability',
        isActive: true
      }
    });
    if (account) return account;
  }

  // Try to find by keywords related to loans/liabilities
  const keywords = ['loan', 'liability', 'payable', 'debt'];
  for (const keyword of keywords) {
    const account = await client.account.findFirst({
      where: {
        tenantId,
        isActive: true,
        accountType: 'Liability',
        accountName: { contains: keyword, mode: 'insensitive' }
      }
    });
    if (account) return account;
  }

  // Fallback: any active liability account
  return client.account.findFirst({
    where: {
      tenantId,
      isActive: true,
      accountType: 'Liability'
    },
    orderBy: { accountCode: 'asc' }
  });
}

/**
 * Resolve interest expense account for loan interest payments
 * Interest payments should DEBIT an interest expense account (NOT COGS)
 */
async function resolveInterestExpenseAccount(client, tenantId) {
  // Preferred account codes for interest expense (typically 7xxx range, but NOT COGS)
  // COGS is typically 5000-5999, so we avoid that range
  const preferredCodes = ['7010', '7000', '7020', '7100'];

  for (const code of preferredCodes) {
    const account = await client.account.findFirst({
      where: {
        tenantId,
        accountCode: code,
        isActive: true,
        accountType: 'Expense',
        // Explicitly exclude COGS accounts
        NOT: [
          { accountName: { contains: 'COGS', mode: 'insensitive' } },
          { accountName: { contains: 'Cost of Goods Sold', mode: 'insensitive' } }
        ]
      }
    });
    if (account) return account;
  }

  // Try to find by interest keyword, but exclude COGS
  const interestAccount = await client.account.findFirst({
    where: {
      tenantId,
      isActive: true,
      accountType: 'Expense',
      accountName: { contains: 'interest', mode: 'insensitive' },
      // Explicitly exclude COGS
      NOT: [
        { accountName: { contains: 'COGS', mode: 'insensitive' } },
        { accountName: { contains: 'Cost of Goods Sold', mode: 'insensitive' } }
      ]
    }
  });
  if (interestAccount) return interestAccount;

  // Fallback: any expense account that is NOT COGS
  return client.account.findFirst({
    where: {
      tenantId,
      isActive: true,
      accountType: 'Expense',
      // Explicitly exclude COGS accounts
      NOT: [
        { accountName: { contains: 'COGS', mode: 'insensitive' } },
        { accountName: { contains: 'Cost of Goods Sold', mode: 'insensitive' } },
        { accountCode: { startsWith: '5' } } // COGS typically in 5000-5999 range
      ]
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

    const paymentAmount = parseFloat(String(body.amount).replace(/,/g, ''), 10);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid payment amount. Enter a positive number.' },
        { status: 400 }
      );
    }

    const paymentType = String(body.paymentType || 'both').toLowerCase();
    const paymentMethod = (body.paymentMethod || 'cash').toLowerCase();
    const principalPaid =
      paymentType === 'principal' || paymentType === 'both'
        ? body.principalPaid !== undefined && body.principalPaid !== ''
          ? parseFloat(String(body.principalPaid).replace(/,/g, ''), 10)
          : paymentAmount
        : 0;
    const interestPaid =
      paymentType === 'interest' || paymentType === 'both'
        ? body.interestPaid !== undefined && body.interestPaid !== ''
          ? parseFloat(String(body.interestPaid).replace(/,/g, ''), 10)
          : paymentAmount - principalPaid
        : 0;

    if (!Number.isFinite(principalPaid) || principalPaid < 0) {
      return NextResponse.json(
        { error: 'Invalid principal amount.' },
        { status: 400 }
      );
    }
    if (!Number.isFinite(interestPaid) || interestPaid < 0) {
      return NextResponse.json(
        { error: 'Invalid interest amount.' },
        { status: 400 }
      );
    }
    if (Math.abs(principalPaid + interestPaid - paymentAmount) > FLOAT_TOLERANCE) {
      return NextResponse.json(
        {
          error:
            'Principal plus interest must equal the payment amount. Check the split or payment type.',
        },
        { status: 400 }
      );
    }

    // Support historical dates
    const paymentDate = body.historicalDate ? new Date(body.historicalDate) : new Date(body.paymentDate);
    const isHistorical = !!body.historicalDate;

    const result = await prisma.$transaction(async (tx) => {
      // Create payment
      const payment = await tx.liabilityPayment.create({
        data: {
          liabilityId: id,
          amount: paymentAmount,
          paymentDate: paymentDate,
          paymentType: paymentType,
          principalPaid: principalPaid,
          interestPaid: interestPaid,
          reference: body.reference || null,
          notes: body.notes || null
        }
      });

      // Update liability balance and total paid
      const balanceAfter = Number(liability.currentBalance) - principalPaid;
      const updatedLiability = await tx.liability.update({
        where: { id: id },
        data: {
          currentBalance: {
            decrement: principalPaid
          },
          totalPaid: {
            increment: paymentAmount
          },
          status: balanceAfter <= FLOAT_TOLERANCE ? 'paid_off' : liability.status
        }
      });

      // Determine paid-from account using payment processing method mapping
      const cashAccount = await resolvePaymentAccount(tx, user.tenantId, paymentMethod);

      if (!cashAccount) {
        throw new Error('No asset account found for the selected payment method. Please configure the Chart of Accounts.');
      }

      // Get the liability account for principal payment
      // Principal payments DEBIT the liability account (reducing the liability balance)
      const liabilityAccount = await resolveLiabilityAccount(tx, user.tenantId, liability);
      
      if (!liabilityAccount) {
        throw new Error('Unable to find a liability account to record the loan principal payment. Please create a liability account (e.g., "Short-term Loans" or "Long-term Loans") in your Chart of Accounts.');
      }

      // Get interest expense account for interest payment
      // Interest payments DEBIT an interest expense account (NOT COGS)
      const interestExpenseAccount = await resolveInterestExpenseAccount(tx, user.tenantId);
      
      if (!interestExpenseAccount && interestPaid > 0) {
        throw new Error('Unable to find an interest expense account to record the loan interest payment. Please create an interest expense account in your Chart of Accounts.');
      }

      // Create separate journal lines for principal and interest
      // Correct accounting entry for loan repayment:
      // - Debit: Liability Account (principal) - reduces liability
      // - Debit: Interest Expense Account (interest) - records expense
      // - Credit: Cash/Bank Account (total payment) - money going out
      const journalLines = [];

      if (principalPaid > 0) {
        journalLines.push({
          accountId: liabilityAccount.id,
          debitAmount: principalPaid,
          creditAmount: 0,
          description: `Loan principal payment - ${liability.name}`
        });
      }

      if (interestPaid > 0) {
        journalLines.push({
          accountId: interestExpenseAccount.id,
          debitAmount: interestPaid,
          creditAmount: 0,
          description: `Loan interest payment - ${liability.name}`
        });
      }

      // Add cash account credit
      journalLines.push({
        accountId: cashAccount.id,
        debitAmount: 0,
        creditAmount: paymentAmount,
        description: `Payment via ${paymentMethod.replace(/_/g, ' ')}`
      });

      const debitTotal = journalLines.reduce(
        (s, l) => s + (Number(l.debitAmount) || 0),
        0
      );
      const creditTotal = journalLines.reduce(
        (s, l) => s + (Number(l.creditAmount) || 0),
        0
      );
      if (Math.abs(debitTotal - creditTotal) > FLOAT_TOLERANCE) {
        throw new Error(
          `Journal entry is not balanced (debits ${debitTotal} vs credits ${creditTotal}).`
        );
      }

      await assertPeriodOpen(user.tenantId, paymentDate, tx);
      const referenceNumber = await generateReferenceNumber(
        tx,
        user.tenantId,
        paymentDate
      );
      const journalDescription = `Liability payment for ${liability.name}${
        principalPaid > 0 && interestPaid > 0
          ? ` (Principal: ${principalPaid}, Interest: ${interestPaid})`
          : ''
      }`;
      const journalEntry = await tx.journalEntry.create({
        data: {
          tenantId: user.tenantId,
          entryDate: paymentDate,
          referenceNumber,
          description: journalDescription,
          entryType: 'Regular',
          status: 'Posted',
          sourceType: 'LiabilityPayment',
          sourceId: payment.id,
          createdById: user.id,
          postedById: user.id,
          postedDate: new Date(),
          lines: {
            create: journalLines.map((line, index) => ({
              lineNumber: index + 1,
              accountId: line.accountId,
              debitAmount: line.debitAmount ?? 0,
              creditAmount: line.creditAmount ?? 0,
              description: line.description || null
            }))
          }
        },
        include: { lines: true }
      });

      for (const line of journalEntry.lines) {
        await updateAccountBalanceOnTransaction(
          line.accountId,
          line.debitAmount || 0,
          line.creditAmount || 0,
          tx
        );
      }

      const trasactionRecord = await tx.transaction.create({
        data: {
          tenantId: user.tenantId,
          date: paymentDate,
          description: `Liability payment - ${liability.name}${principalPaid > 0 && interestPaid > 0 ? ` (Principal: ${principalPaid}, Interest: ${interestPaid})` : ''}`,
          reference: body.reference || payment.id,
          status: 'posted',
          sourceType: 'LiabilityPayment',
          sourceId: payment.id,
          createdById: user.id
        }
      });

      // Create separate expense records for principal and interest
      const expenseRecords = [];
      
      if (principalPaid > 0) {
        const principalExpense = await tx.expense.create({
          data: {
            tenantId: user.tenantId,
            description: `Loan principal payment - ${liability.name}`,
            amount: principalPaid,
            date: paymentDate,
            category: 'Loan Principal',
            paymentMethod: paymentMethod,
            sourceAccountId: cashAccount.id,
            submittedById: user.id,
            status: 'Approved',
            notes: body.notes ? `Principal: ${body.notes}` : null,
            merchant: liability.lender || liability.name || null,
            paymentStatus: 'Fully paid',
            paidAmount: principalPaid,
            paymentReference: body.reference ? `${body.reference}-PRINCIPAL` : null,
            isHistorical: isHistorical,
            historicalDate: isHistorical ? paymentDate : null,
            migrationBatch: body.migrationBatch || null,
            originalReference: body.originalReference ? `${body.originalReference}-PRINCIPAL` : null
          }
        });
        expenseRecords.push(principalExpense);
      }

      if (interestPaid > 0) {
        const interestExpense = await tx.expense.create({
          data: {
            tenantId: user.tenantId,
            description: `Loan interest payment - ${liability.name}`,
            amount: interestPaid,
            date: paymentDate,
            category: 'Loan Interest',
            paymentMethod: paymentMethod,
            sourceAccountId: cashAccount.id,
            submittedById: user.id,
            status: 'Approved',
            notes: body.notes ? `Interest: ${body.notes}` : null,
            merchant: liability.lender || liability.name || null,
            paymentStatus: 'Fully paid',
            paidAmount: interestPaid,
            paymentReference: body.reference ? `${body.reference}-INTEREST` : null,
            isHistorical: isHistorical,
            historicalDate: isHistorical ? paymentDate : null,
            migrationBatch: body.migrationBatch || null,
            originalReference: body.originalReference ? `${body.originalReference}-INTEREST` : null
          }
        });
        expenseRecords.push(interestExpense);
      }

      // Create payment records for each expense (principal and interest)
      const paymentRecords = [];
      for (const expenseRecord of expenseRecords) {
        const paymentRecord = await tx.payment.create({
          data: {
            tenantId: user.tenantId,
            branchId: expenseRecord.branchId || null, // Inherit branchId from expense
            type: expenseRecord.category === 'Loan Principal' ? 'Loan Payment - Principal' : 'Loan Payment - Interest',
            expenseId: expenseRecord.id,
            amount: expenseRecord.amount,
            paymentDate: paymentDate,
            paymentMethod: paymentMethod,
            sourceAccount: paymentMethod,
            reference: body.reference || `LIAB-${payment.id}-${expenseRecord.category === 'Loan Principal' ? 'PRIN' : 'INT'}`,
            notes: body.notes || `${expenseRecord.category} payment for ${liability.name}`,
            status: 'Completed'
          }
        });
        paymentRecords.push(paymentRecord);
      }

      return { 
        payment, 
        updatedLiability, 
        journalEntry, 
        expenseRecords, 
        paymentRecords, 
        transactionRecord: trasactionRecord 
      };
    });

    try {
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
    } catch (balanceErr) {
      console.error('Liability payment: accountBalance upsert failed:', balanceErr);
    }

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
          expenseIds: result.expenseRecords.map(e => e.id),
          paymentRecordIds: result.paymentRecords.map(p => p.id),
          transactionId: result.transactionRecord.id,
          isHistorical: isHistorical
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
    const message = error?.message || 'Failed to record payment';
    const status = error?.code === 'PERIOD_LOCKED' ? 409 : 500;
    return NextResponse.json(
      {
        error: message,
        details:
          process.env.NODE_ENV === 'development' ? String(error?.stack || '') : undefined
      },
      { status }
    );
  }
}


