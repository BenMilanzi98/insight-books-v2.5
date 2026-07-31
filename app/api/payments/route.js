// app/api/payments/route.js
// Phase 11 architecture guard: customer payments update AR/Cash only.
// They MUST NOT import or call MraEis sales bridge / fiscalization commands.
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requirePermission } from '@/lib/auth';
import { resolveBranchId } from '@/lib/branchHelpers';
import { clampResolvedBranchToUserAccess } from '@/lib/branchAccess';
import { enrichPaymentsWithMethodNames } from '@/lib/userFacingLabels';
import { addMoney, moneyGreaterOrEqual, parseMoney, subtractMoney } from '@/lib/money';
import { postCustomerPaymentAccounting } from '@/lib/accountingV2/adapters';
import {
  postPaymentAdjustmentGlEntry,
  postPaymentTransferGlEntry,
} from '@/lib/paymentGlPosting.js';

/** Payments that count toward invoice balance (completed, not a reversal row). */
function sumEligibleInvoicePayments(payments) {
  if (!payments?.length) return 0;
  return payments.reduce((sum, p) => {
    if (!p || p.isReversal) return sum;
    const st = p.status;
    if (st != null && String(st) !== 'Completed') return sum;
    return addMoney(sum, p.amount);
  }, 0);
}

// Helper function to format payment data
const formatPaymentResponse = (payment) => {
  return {
    id: payment.id,
    type: payment.type,
    invoiceId: payment.invoiceId,
    invoiceNumber: payment.invoice?.invoiceNumber,
    amount: payment.amount,
    paymentDate: payment.paymentDate,
    paymentMethod: payment.paymentMethod,
    sourceAccount: payment.sourceAccount,
    destinationAccount: payment.destinationAccount,
    reference: payment.reference,
    notes: payment.notes,
    status: payment.status,
    createdAt: payment.createdAt,
    client: payment.invoice?.client ? {
      id: payment.invoice.client.id,
      name: payment.invoice.client.name
    } : null
  };
};

function legacyPostingRemoved(message) {
  const err = new Error(message);
  err.code = 'LEGACY_POSTING_REMOVED';
  throw err;
}

async function recordPaymentTransaction({
  tenantId,
  userId,
  paymentId,
  type,
  amount,
  paymentDate,
  paymentMethod,
  sourceAccount,
  destinationAccount,
  expenseAccountId,
  revenueAccountId,
  invoice,
  notes
}) {
  const numericAmount = parseMoney(amount);
  if (!tenantId || !userId || !paymentId || !numericAmount || numericAmount <= 0) {
    return;
  }

  const methodKey = paymentMethod || sourceAccount || 'cash';
  const entryDate = paymentDate ? new Date(paymentDate) : new Date();
  const description = notes?.trim() || undefined;

  if (type === 'invoice' && invoice) {
    await postCustomerPaymentAccounting({
      db: prisma,
      tenantId,
      userId,
      paymentId,
      invoiceId: invoice.id,
      paymentAmount: numericAmount,
      paymentDate,
      paymentMethod: methodKey,
    });
    return;
  }

  if (type === 'bank_charge') {
    const { postBankChargeAccounting } = await import('@/lib/accountingV2/adapters/bankingAdapter.js');
    await postBankChargeAccounting({
      db: prisma,
      tenantId,
      userId,
      paymentId,
    });
    return;
  }

  if (type === 'interest_income') {
    const { postInterestIncomeAccounting } = await import('@/lib/accountingV2/adapters/bankingAdapter.js');
    await postInterestIncomeAccounting({
      db: prisma,
      tenantId,
      userId,
      paymentId,
    });
    return;
  }

  if (type === 'transfer') {
    await postPaymentTransferGlEntry({
      tenantId,
      userId,
      paymentId,
      amount: numericAmount,
      paymentDate: entryDate,
      sourceAccount,
      destinationAccount,
      notes: description,
    });
    return;
  }

  if (type === 'adjustment') {
    await postPaymentAdjustmentGlEntry({
      tenantId,
      userId,
      paymentId,
      amount: numericAmount,
      paymentDate: entryDate,
      paymentMethod: methodKey,
      notes: description,
    });
    return;
  }

  if (type === 'expense' || type === 'sale') {
    legacyPostingRemoved(
      `Payment type "${type}" legacy postGlEntry path is removed (LEGACY_POSTING_REMOVED). ` +
        'Use V2 adapters (postExpenseAccounting / postPosSaleAccounting / postTaxSettlementAccounting) instead of /api/payments direct GL.'
    );
  }
}

// GET - Fetch payments with filtering, sorting, and pagination
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'payments.view');
    if (perm) return perm;

    const { searchParams } = new URL(request.url);
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Parse query parameters
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;
    const sortBy = searchParams.get('sortBy') || 'paymentDate';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const status = searchParams.get('status');
    const method = searchParams.get('method');
    const search = searchParams.get('search');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Build filter object for Prisma
    const where = {
      tenantId: user.tenantId
    };
    
    // Add branch filter if provided
    const branchId = searchParams.get('branchId');
    if (branchId) {
      where.branchId = branchId;
    }
    
    // Add status filter if provided
    if (status) {
      where.status = status;
    }
    
    // Add date range filters if provided
    if (dateFrom) {
      where.paymentDate = {
        ...where.paymentDate,
        gte: new Date(dateFrom)
      };
    }
    
    if (dateTo) {
      where.paymentDate = {
        ...where.paymentDate,
        lte: new Date(dateTo)
      };
    }
    
    // Build method and search filters
    const methodFilter = method ? {
      OR: [
        { paymentMethod: { equals: method, mode: 'insensitive' } },
        {
          allocations: {
            some: {
              paymentAccount: {
                name: { equals: method, mode: 'insensitive' }
              }
            }
          }
        }
      ]
    } : null;
    
    const searchFilter = search ? {
      OR: [
        { reference: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        {
          invoice: {
            OR: [
              { invoiceNumber: { contains: search, mode: 'insensitive' } },
              { client: { name: { contains: search, mode: 'insensitive' } } }
            ]
          }
        }
      ]
    } : null;
    
    // Combine filters using AND if both exist
    if (methodFilter && searchFilter) {
      where.AND = [
        methodFilter,
        searchFilter
      ];
    } else if (methodFilter) {
      Object.assign(where, methodFilter);
    } else if (searchFilter) {
      Object.assign(where, searchFilter);
    }
    
    // Get total count for pagination
    const totalCount = await prisma.payment.count({ where });
    
    // Build sort object for Prisma
    const orderBy = { [sortBy]: sortOrder === 'asc' ? 'asc' : 'desc' };
    
    // Fetch payments
    const payments = await prisma.payment.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            client: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        allocations: {
          include: {
            paymentAccount: {
              select: {
                id: true,
                name: true,
                accountType: true
              }
            }
          }
        }
      }
    });
    
    const formattedPayments = await enrichPaymentsWithMethodNames(
      prisma,
      user.tenantId,
      payments.map(formatPaymentResponse)
    );

    return NextResponse.json({
      payments: formattedPayments,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payments. Please try again.' },
      { status: 500 }
    );
  }
}
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'payments.create');
    if (perm) return perm;

    const body = await request.json();
    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const {
      invoiceId,
      amount,
      paymentDate,
      reference,
      notes,
      type,
      sourceAccount,
      destinationAccount,
      paymentAllocations, // New: array of { paymentAccountId, amount }
      expenseAccountId,
      revenueAccountId
    } = body;

    if (!amount || !paymentDate || !type) {
      return NextResponse.json({ error: 'Amount, payment date, and type are required' }, { status: 400 });
    }

    // Support both new payment allocations format and legacy sourceAccount
    let paymentAllocationsList = [];
    let paymentMethod = sourceAccount || 'cash';
    
    if (paymentAllocations && Array.isArray(paymentAllocations) && paymentAllocations.length > 0) {
      // New format: split payments across multiple accounts
      paymentAllocationsList = paymentAllocations;
      
      // Validate allocations sum equals amount
      const allocationsSum = paymentAllocationsList.reduce((sum, alloc) => addMoney(sum, alloc.amount), 0);
      if (Math.abs(allocationsSum - amount) > 0.01) {
        return NextResponse.json({ 
          error: `Payment allocations sum (${allocationsSum}) does not match payment amount (${amount})` 
        }, { status: 400 });
      }
      
      // Validate all payment accounts exist and are active
      for (const alloc of paymentAllocationsList) {
        if (!alloc.paymentAccountId || !alloc.amount) {
          return NextResponse.json({ 
            error: 'Each payment allocation must have paymentAccountId and amount' 
          }, { status: 400 });
        }
        
        const account = await prisma.paymentAccount.findFirst({
          where: {
            id: alloc.paymentAccountId,
            tenantId: user.tenantId,
            isActive: true
          }
        });
        
        if (!account) {
          return NextResponse.json({ 
            error: `Payment account ${alloc.paymentAccountId} not found or inactive` 
          }, { status: 400 });
        }
      }
      
      // Use first account name as paymentMethod for backward compatibility
      const firstAccount = await prisma.paymentAccount.findUnique({
        where: { id: paymentAllocationsList[0].paymentAccountId }
      });
      paymentMethod = firstAccount?.name || 'cash';
    } else if (type === 'transfer' && sourceAccount && destinationAccount) {
      // Transfer: source may be Capital (Account) or PaymentAccount; destination is PaymentAccount. Allocations = destination receives amount.
      paymentAllocationsList = [{ paymentAccountId: destinationAccount, amount: amount }];
      paymentMethod = 'Transfer';
    } else {
      // Legacy format: single sourceAccount (invoice/sale/expense)
      if (!sourceAccount) {
        return NextResponse.json({ error: 'Source account or payment allocations are required' }, { status: 400 });
      }
      
      // Try to resolve payment account by name or ID
      let paymentAccount = null;
      if (sourceAccount.length > 20 && /^[a-z0-9]+$/i.test(sourceAccount)) {
        // Looks like an account ID
        paymentAccount = await prisma.paymentAccount.findFirst({
          where: {
            id: sourceAccount,
            tenantId: user.tenantId,
            isActive: true
          }
        });
      } else {
        // Try to find by name
        paymentAccount = await prisma.paymentAccount.findFirst({
          where: {
            name: { equals: sourceAccount, mode: 'insensitive' },
            tenantId: user.tenantId,
            isActive: true
          }
        });
      }
      
      if (paymentAccount) {
        paymentAllocationsList = [{ paymentAccountId: paymentAccount.id, amount: amount }];
        paymentMethod = paymentAccount.name;
      } else {
        // Fallback: find first active payment account (prefer Cash if exists, otherwise first available)
        let fallbackAccount = await prisma.paymentAccount.findFirst({
          where: {
            tenantId: user.tenantId,
            isActive: true,
            accountType: 'Cash'
          }
        });
        
        if (!fallbackAccount) {
          // If no Cash account, get first active account
          fallbackAccount = await prisma.paymentAccount.findFirst({
            where: {
              tenantId: user.tenantId,
              isActive: true
            },
            orderBy: {
              isSystem: 'desc' // Prefer system accounts
            }
          });
        }
        
        if (!fallbackAccount) {
          return NextResponse.json({ 
            error: 'No payment accounts configured. Please create a payment account first.' 
          }, { status: 400 });
        }
        
        paymentAllocationsList = [{ paymentAccountId: fallbackAccount.id, amount: amount }];
        paymentMethod = fallbackAccount.name;
      }
    }

    // Validate accounts for expense and transfer types
    if (type === "expense" && paymentAllocationsList.length === 0) {
      return NextResponse.json({ error: 'Source account is required for expense' }, { status: 400 });
    }
    if (type === "transfer") {
      if (!sourceAccount || !destinationAccount) {
        return NextResponse.json({ error: 'Both source and destination accounts are required for transfer' }, { status: 400 });
      }
      
      // Validate that both accounts exist and are active
      // Check both Account and PaymentAccount models
      const [sourceAccountRecord, destAccountRecord, sourcePaymentAccountRecord, destPaymentAccountRecord] = await Promise.all([
        prisma.account.findFirst({
          where: {
            id: sourceAccount,
            tenantId: user.tenantId,
            isActive: true
          }
        }),
        prisma.account.findFirst({
          where: {
            id: destinationAccount,
            tenantId: user.tenantId,
            isActive: true
          }
        }),
        prisma.paymentAccount.findFirst({
          where: {
            id: sourceAccount,
            tenantId: user.tenantId,
            isActive: true
          }
        }),
        prisma.paymentAccount.findFirst({
          where: {
            id: destinationAccount,
            tenantId: user.tenantId,
            isActive: true
          }
        })
      ]);
      
      const validSource = sourceAccountRecord || sourcePaymentAccountRecord;
      const validDestination = destAccountRecord || destPaymentAccountRecord;
      
      if (!validSource) {
        return NextResponse.json({ 
          error: 'Source account not found or inactive. Please ensure the account exists and is active.' 
        }, { status: 404 });
      }
      
      if (!validDestination) {
        return NextResponse.json({ 
          error: 'Destination account not found or inactive. Please ensure the account exists and is active.' 
        }, { status: 404 });
      }
      
      // Validate sufficient balance for source account
      const { getAccountBalanceDetails } = await import('@/lib/accountBalanceService');
      let sourceBalance = 0;
      
      try {
        if (sourceAccountRecord) {
          const sourceDetails = await getAccountBalanceDetails(sourceAccount, user.tenantId);
          sourceBalance = sourceDetails.balance || 0;
          // Use the higher of transaction-based balance or stored Account.balance so capital account
          // (and other accounts) respect the displayed balance when it differs from transaction lines
          if (sourceAccountRecord.balance != null) {
            const stored = parseFloat(sourceAccountRecord.balance);
            if (!Number.isNaN(stored) && stored > sourceBalance) sourceBalance = stored;
          }
        } else if (sourcePaymentAccountRecord) {
          const accountBalance = await prisma.accountBalance.findFirst({
            where: {
              tenantId: user.tenantId,
              account: sourceAccount
            }
          });
          sourceBalance = accountBalance?.balance || sourcePaymentAccountRecord.currentBalance || 0;
        }
      } catch (error) {
        console.warn('Could not get source account balance:', error.message);
        sourceBalance = sourceAccountRecord?.balance || sourcePaymentAccountRecord?.currentBalance || 0;
      }
      
      if (sourceBalance < amount) {
        return NextResponse.json({ 
          error: `Insufficient balance in source account. Available: ${sourceBalance}, Required: ${amount}` 
        }, { status: 400 });
      }
    }
    // Special handling for invoices
    let invoice = null;
    if (type === "invoice") {
      if (!invoiceId) return NextResponse.json({ error: 'Invoice ID required for invoice payments' }, { status: 400 });

      invoice = await prisma.invoice.findFirst({
        where: { id: invoiceId, tenantId: user.tenantId },
        include: {
          payments: {
            where: { status: 'Completed', isReversal: false }
          }
        }
      });

      if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

      const invTotal = parseMoney(invoice.total);
      const totalPaid = sumEligibleInvoicePayments(invoice.payments);
      const remaining = subtractMoney(invTotal, totalPaid);
      const paymentAmount = parseMoney(amount);
      if (paymentAmount > remaining) {
        return NextResponse.json({ error: `Payment exceeds remaining invoice amount (${remaining})` }, { status: 400 });
      }
    }

    let branchId = null;
    try {
      if (invoice?.branchId) {
        branchId = invoice.branchId;
      } else {
        branchId = await resolveBranchId(user, body.branchId, user.tenantId);
      }
      branchId = clampResolvedBranchToUserAccess(user, branchId);
    } catch (branchErr) {
      return NextResponse.json(
        { error: branchErr.message || 'Branch not allowed' },
        { status: 403 }
      );
    }

    // 🔐 Create payment
    const newPayment = await prisma.payment.create({
      data: {
        invoiceId: invoice?.id || null,
        amount,
        paymentDate: new Date(paymentDate),
        paymentMethod, // Keep for backward compatibility
        reference: reference || null,
        notes: notes || null,
        status: 'Completed',
        tenantId: user.tenantId,
        branchId: branchId,
        type,
        sourceAccount: type === 'transfer' ? sourceAccount : paymentMethod, // For transfer keep actual source (e.g. capital account id)
        destinationAccount: destinationAccount || null,
        allocations: {
          create: paymentAllocationsList.map(alloc => ({
            paymentAccountId: alloc.paymentAccountId,
            amount: alloc.amount
          }))
        }
      },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
            client: { select: { id: true, name: true } }
          }
        }
      }
    });

    // Update invoice payment totals if this is an invoice payment
    if (invoice && type === "invoice") {
      const totalPaid = addMoney(sumEligibleInvoicePayments(invoice.payments), amount);
      const invTotal = parseMoney(invoice.total);
      const remainingBalance = subtractMoney(invTotal, totalPaid);
      const lastPaymentDate = new Date(paymentDate);

      // Align with partial-payment route + invoice list/detail expectations (capitalized statuses)
      let newStatus;
      if (remainingBalance <= 0.005) {
        newStatus = 'Paid';
      } else if (totalPaid > 0) {
        newStatus = 'Partial';
      } else {
        newStatus = 'Pending';
      }

      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          totalPaid,
          remainingBalance: Math.max(0, remainingBalance),
          lastPaymentDate: lastPaymentDate,
          status: newStatus
        }
      });
    }

    await recordPaymentTransaction({
      tenantId: user.tenantId,
      userId: user.id,
      paymentId: newPayment.id,
      type,
      amount,
      paymentDate,
      paymentMethod,
      sourceAccount,
      destinationAccount,
      expenseAccountId,
      revenueAccountId,
      invoice,
      notes
    });

    // 📝 Audit log
    await prisma.auditLog.create({
      data: {
        action: 'PAYMENT_CREATED',
        entityType: 'PAYMENT',
        entityId: newPayment.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          type,
          amount,
          method: paymentMethod,
          ...(invoice ? { invoiceNumber: invoice.invoiceNumber } : {})
        })
      }
    });

    return NextResponse.json({ message: "Payment recorded", payment: formatPaymentResponse(newPayment) }, { status: 201 });
  } catch (error) {
    console.error("Payment POST error:", error);
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
  }
}

// POST - Create a new payment
export async function OldPOST(request) {
  try {
    const body = await request.json();
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Validate required fields
    if (!body.invoiceId || !body.amount || !body.paymentDate || !body.paymentMethod) {
      return NextResponse.json(
        { error: 'Invoice, amount, payment date, and payment method are required' },
        { status: 400 }
      );
    }
    
    // Check if invoice exists and belongs to tenant
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: body.invoiceId,
        tenantId: user.tenantId
      },
      include: {
        payments: true
      }
    });
    
    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }
    
    // Calculate total paid and check if payment exceeds invoice amount
    const totalPaid = invoice.payments.reduce((sum, payment) => addMoney(sum, payment.amount), 0);
    const remainingAmount = subtractMoney(invoice.total, totalPaid);
    
    if (body.amount > remainingAmount) {
      return NextResponse.json(
        { error: `Payment amount exceeds remaining invoice amount (${remainingAmount})` },
        { status: 400 }
      );
    }
    
    // Create the payment
    const newPayment = await prisma.payment.create({
      data: {
        invoiceId: body.invoiceId,
        amount: body.amount,
        paymentDate: new Date(body.paymentDate),
        paymentMethod: body.paymentMethod,
        reference: body.reference || null,
        notes: body.notes || null,
        status: 'Completed',
        tenantId: user.tenantId
      },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
            client: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });
    
    // Update invoice status based on payment
    const newTotalPaid = addMoney(totalPaid, body.amount);
    let newStatus;
    
    if (moneyGreaterOrEqual(newTotalPaid, invoice.total)) {
      newStatus = 'Paid';
    } else if (newTotalPaid > 0) {
      newStatus = 'Partial';
    } else {
      newStatus = 'Pending';
    }
    
    await prisma.invoice.update({
      where: { id: body.invoiceId },
      data: { status: newStatus }
    });
    
    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'PAYMENT_CREATED',
        entityType: 'PAYMENT',
        entityId: newPayment.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          amount: newPayment.amount,
          paymentMethod: newPayment.paymentMethod,
          invoiceNumber: newPayment.invoice.invoiceNumber
        })
      }
    });
    
    // Return the created payment
    return NextResponse.json(
      { 
        message: 'Payment recorded successfully',
        payment: formatPaymentResponse(newPayment) 
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json(
      { error: 'Failed to record payment. Please try again.' },
      { status: 500 }
    );
  }
}
