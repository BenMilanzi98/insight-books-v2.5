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
    const type = searchParams.get('type') || 'all'; // 'all', 'sale', 'expense', 'payment', …
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

    // Fetch payroll + general GL journal reversals (Transaction.isReversal)
    let payrollReversals = [];
    let journalTxReversals = [];
    if (type === 'all' || type === 'payroll' || type === 'journal') {
      try {
        const payrollReversalTxns = await prisma.transaction.findMany({
          where: {
            tenantId: user.tenantId,
            isReversal: true,
            reversedTransactionId: { not: null },
            ...(startDate || endDate
              ? {
                  reversedAt: {
                    ...(startDate ? { gte: new Date(startDate) } : {}),
                    ...(endDate ? { lte: new Date(endDate + 'T23:59:59') } : {})
                  }
                }
              : {})
          },
          include: {
            createdBy: { select: { id: true, name: true, email: true } },
            lines: { select: { debitAmount: true, creditAmount: true } }
          },
          orderBy: { reversedAt: 'desc' },
          take: 500
        });
        const originalIds = [...new Set(payrollReversalTxns.map(t => t.reversedTransactionId).filter(Boolean))];
        const originals = originalIds.length
          ? await prisma.transaction.findMany({
              where: { id: { in: originalIds }, tenantId: user.tenantId },
              include: { lines: { select: { debitAmount: true, creditAmount: true } } }
            })
          : [];
        const originalById = Object.fromEntries(originals.map(o => [o.id, o]));
        const payrollIds = [...new Set(originals.filter(o => o.sourceType === 'Payroll').map(o => o.sourceId).filter(Boolean))];
        const payrolls = payrollIds.length
          ? await prisma.payroll.findMany({
              where: { id: { in: payrollIds }, tenantId: user.tenantId },
              include: { employee: { select: { id: true, name: true } } }
            })
          : [];
        const payrollById = Object.fromEntries(payrolls.map(p => [p.id, p]));

        for (const rev of payrollReversalTxns) {
          const orig = originalById[rev.reversedTransactionId];
          const lineSum = (lines) =>
            (lines || []).reduce((s, l) => s + Number(l.debitAmount || 0) + Number(l.creditAmount || 0), 0) / 2;
          const amount =
            lineSum(orig?.lines) ||
            lineSum(rev.lines) ||
            0;

          if (orig?.sourceType === 'Payroll') {
            if (type !== 'all' && type !== 'payroll') continue;
            const payroll = payrollById[orig.sourceId];
            payrollReversals.push({
              id: rev.id,
              type: 'payroll',
              displayReference:
                orig.reference ||
                (payroll?.employee?.name
                  ? `Payroll — ${payroll.employee.name}`
                  : orig.description || 'Payroll'),
              description: orig.description || `Payroll reversal – ${payroll?.employee?.name || 'Employee'}`,
              originalAmount: amount,
              reversalAmount: -amount,
              date: orig.date,
              reversedAt: rev.reversedAt,
              reversalReason: rev.reversalReason,
              originalTransactionId: orig.id,
              reversalTransactionId: rev.id,
              payrollId: orig.sourceId,
              employee: payroll?.employee,
              periodStart: payroll?.periodStart,
              periodEnd: payroll?.periodEnd,
              status: 'Reversed',
              performedBy: rev.createdBy || null
            });
          } else if (type === 'all' || type === 'journal') {
            journalTxReversals.push({
              id: rev.id,
              type: 'journal',
              displayReference: rev.reference || orig?.reference || `Journal ${rev.id.slice(0, 8)}`,
              description: rev.description || orig?.description || 'Journal reversal',
              originalAmount: amount,
              reversalAmount: -amount,
              date: rev.date || orig?.date,
              reversedAt: rev.reversedAt,
              reversalReason: rev.reversalReason,
              originalTransactionId: rev.reversedTransactionId,
              reversalTransactionId: rev.id,
              sourceType: orig?.sourceType || rev.sourceType || 'Transaction',
              status: rev.status || 'posted',
              performedBy: rev.createdBy || null
            });
          }
        }
      } catch (payrollRevErr) {
        console.error('Error fetching journal/payroll reversals:', payrollRevErr);
        payrollReversals = [];
        journalTxReversals = [];
      }
    }

    // Voided invoices (void path reverses V2 journals but does not create isReversal child rows)
    let voidedInvoiceReversals = [];
    if (type === 'all' || type === 'sale' || type === 'void') {
      try {
        const voidWhere = {
          tenantId: user.tenantId,
          OR: [{ status: 'void' }, { voidedAt: { not: null } }],
        };
        if (startDate || endDate) {
          voidWhere.voidedAt = {
            ...(startDate ? { gte: new Date(startDate) } : {}),
            ...(endDate ? { lte: new Date(endDate + 'T23:59:59') } : {}),
          };
        }
        const voided = await prisma.invoice.findMany({
          where: voidWhere,
          include: {
            client: { select: { id: true, name: true, email: true } },
            voidedBy: { select: { id: true, name: true, email: true } },
          },
          orderBy: { voidedAt: 'desc' },
          take: 500,
        });
        voidedInvoiceReversals = voided.map((invoice) => ({
          id: `void-${invoice.id}`,
          type: 'void',
          displayReference: invoice.invoiceNumber
            ? `Voided invoice ${invoice.invoiceNumber}`
            : 'Voided invoice',
          description: invoice.voidReason || `Invoice ${invoice.invoiceNumber} voided`,
          originalAmount: parseFloat(invoice.originalTotal ?? invoice.total) || 0,
          reversalAmount: -(parseFloat(invoice.originalTotal ?? invoice.total) || 0),
          date: invoice.issueDate,
          reversedAt: invoice.voidedAt || invoice.updatedAt,
          reversalReason: invoice.voidReason || 'Invoice voided',
          originalTransactionId: invoice.id,
          reversalTransactionId: null,
          client: invoice.client,
          invoiceNumber: invoice.invoiceNumber,
          status: invoice.status,
          performedBy: invoice.voidedBy || null,
        }));
      } catch (voidErr) {
        console.error('Error fetching voided invoices:', voidErr);
        voidedInvoiceReversals = [];
      }
    }

    // Sale document reversals (createSaleReversal) — distinct from POS refundedAt path
    let saleDocReversals = [];
    if (type === 'all' || type === 'sale' || type === 'sale_reversal') {
      try {
        const saleWhere = {
          tenantId: user.tenantId,
          isReversal: true,
          ...(startDate || endDate
            ? {
                reversedAt: {
                  ...(startDate ? { gte: new Date(startDate) } : {}),
                  ...(endDate ? { lte: new Date(endDate + 'T23:59:59') } : {}),
                },
              }
            : {}),
        };
        const saleRevs = await prisma.sale.findMany({
          where: saleWhere,
          include: {
            refundedBy: { select: { id: true, name: true, email: true } },
          },
          orderBy: { reversedAt: 'desc' },
          take: 500,
        });
        // Prefer reversedById user when present
        const byIds = [...new Set(saleRevs.map((s) => s.reversedById).filter(Boolean))];
        const byUsers = byIds.length
          ? await prisma.user.findMany({
              where: { id: { in: byIds } },
              select: { id: true, name: true, email: true },
            })
          : [];
        const byUserMap = Object.fromEntries(byUsers.map((u) => [u.id, u]));
        saleDocReversals = saleRevs.map((sale) => ({
          id: sale.id,
          type: 'sale_reversal',
          displayReference: sale.saleNumber ? `Sale reversal ${sale.saleNumber}` : 'Sale reversal',
          description: sale.notes || `Reversal of sale ${sale.reversedTransactionId || ''}`,
          originalAmount: Math.abs(parseFloat(sale.total) || 0),
          reversalAmount: -Math.abs(parseFloat(sale.total) || 0),
          date: sale.saleDate,
          reversedAt: sale.reversedAt,
          reversalReason: sale.reversalReason || 'Sale reversed',
          originalTransactionId: sale.reversedTransactionId,
          reversalTransactionId: sale.id,
          saleNumber: sale.saleNumber,
          status: sale.status,
          performedBy: (sale.reversedById && byUserMap[sale.reversedById]) || sale.refundedBy || null,
          taxReversed: sale.totalTaxAmount != null ? Math.abs(parseFloat(sale.totalTaxAmount)) : null,
        }));
      } catch (saleDocErr) {
        console.error('Error fetching sale document reversals:', saleDocErr);
        saleDocReversals = [];
      }
    }

    // Supplier payment reversals
    let supplierPaymentReversals = [];
    if (type === 'all' || type === 'supplier_payment' || type === 'payment') {
      try {
        const spWhere = {
          tenantId: user.tenantId,
          isReversal: true,
          ...(startDate || endDate
            ? {
                reversedAt: {
                  ...(startDate ? { gte: new Date(startDate) } : {}),
                  ...(endDate ? { lte: new Date(endDate + 'T23:59:59') } : {}),
                },
              }
            : {}),
        };
        const sps = await prisma.supplierPayment.findMany({
          where: spWhere,
          include: {
            supplier: { select: { id: true, name: true } },
          },
          orderBy: { reversedAt: 'desc' },
          take: 500,
        });
        supplierPaymentReversals = sps.map((sp) => ({
          id: sp.id,
          type: 'supplier_payment',
          displayReference: sp.paymentNumber || `Supplier payment ${sp.id.slice(0, 8)}`,
          description: sp.notes || `Supplier payment reversal`,
          originalAmount: Math.abs(parseFloat(sp.totalAmount) || 0),
          reversalAmount: -Math.abs(parseFloat(sp.totalAmount) || 0),
          date: sp.paymentDate,
          reversedAt: sp.reversedAt,
          reversalReason: sp.reversalReason || 'Supplier payment reversed',
          originalTransactionId: sp.reversedTransactionId,
          reversalTransactionId: sp.id,
          supplier: sp.supplier,
          status: 'Reversed',
          performedBy: null,
        }));
      } catch (spErr) {
        console.error('Error fetching supplier payment reversals:', spErr);
        supplierPaymentReversals = [];
      }
    }

    // V2 JournalEntry rows that are themselves reversals (covers voids / GL-only paths)
    let v2JournalReversals = [];
    if (type === 'all' || type === 'journal') {
      try {
        // Avoid conflicting OR when date filter present — rebuild cleanly
        const jeDateFilter =
          startDate || endDate
            ? {
                OR: [
                  {
                    reversedAt: {
                      ...(startDate ? { gte: new Date(startDate) } : {}),
                      ...(endDate ? { lte: new Date(endDate + 'T23:59:59') } : {}),
                    },
                  },
                  {
                    postingDate: {
                      ...(startDate ? { gte: new Date(startDate) } : {}),
                      ...(endDate ? { lte: new Date(endDate + 'T23:59:59') } : {}),
                    },
                  },
                  {
                    entryDate: {
                      ...(startDate ? { gte: new Date(startDate) } : {}),
                      ...(endDate ? { lte: new Date(endDate + 'T23:59:59') } : {}),
                    },
                  },
                ],
              }
            : null;

        const jes = await prisma.journalEntry.findMany({
          where: {
            tenantId: user.tenantId,
            status: { in: ['Posted', 'posted', 'POSTED'] },
            AND: [
              { OR: [{ reversalStatus: 'REVERSAL' }, { entryType: 'Reversal' }] },
              ...(jeDateFilter ? [jeDateFilter] : []),
            ],
          },
          select: {
            id: true,
            journalNumber: true,
            referenceNumber: true,
            description: true,
            totalDebit: true,
            totalCredit: true,
            debit: true,
            credit: true,
            entryDate: true,
            postingDate: true,
            reversedAt: true,
            notes: true,
            sourceType: true,
            sourceId: true,
            originalJournalId: true,
            createdById: true,
            reversedById: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 500,
        });
        const userIds = [
          ...new Set(jes.flatMap((j) => [j.createdById, j.reversedById]).filter(Boolean)),
        ];
        const users = userIds.length
          ? await prisma.user.findMany({
              where: { id: { in: userIds } },
              select: { id: true, name: true, email: true },
            })
          : [];
        const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
        v2JournalReversals = jes.map((je) => {
          const amt =
            Number(je.totalDebit || je.totalCredit || 0) ||
            Number(je.debit || je.credit || 0) ||
            0;
          return {
            id: `je-${je.id}`,
            type: 'journal',
            displayReference:
              je.journalNumber || je.referenceNumber || `JE ${je.id.slice(0, 8)}`,
            description: je.description || je.notes || 'Journal reversal',
            originalAmount: amt,
            reversalAmount: -amt,
            date: je.postingDate || je.entryDate,
            reversedAt: je.reversedAt || je.postingDate || je.entryDate,
            reversalReason: je.notes || je.description || 'Journal reversed',
            originalTransactionId: je.originalJournalId,
            reversalTransactionId: je.id,
            sourceType: je.sourceType,
            status: 'Posted',
            performedBy:
              (je.reversedById && userMap[je.reversedById]) ||
              (je.createdById && userMap[je.createdById]) ||
              null,
          };
        });
      } catch (jeErr) {
        console.error('Error fetching V2 journal reversals:', jeErr);
        v2JournalReversals = [];
      }
    }

    // Canonical TransactionReversal register (COMPLETED)
    let registerReversals = [];
    if (type === 'all' || type === 'register') {
      try {
        if (prisma.transactionReversal?.findMany) {
          const regWhere = {
            tenantId: user.tenantId,
            status: 'COMPLETED',
            ...(startDate || endDate
              ? {
                  executedAt: {
                    ...(startDate ? { gte: new Date(startDate) } : {}),
                    ...(endDate ? { lte: new Date(endDate + 'T23:59:59') } : {}),
                  },
                }
              : {}),
          };
          const regs = await prisma.transactionReversal.findMany({
            where: regWhere,
            orderBy: { executedAt: 'desc' },
            take: 500,
          });
          registerReversals = regs.map((r) => ({
            id: `reg-${r.id}`,
            type: String(r.sourceType || 'register').toLowerCase(),
            displayReference: `${r.sourceType} ${String(r.sourceId || '').slice(0, 8)}`,
            description: r.reason || 'Registered reversal',
            originalAmount: 0,
            reversalAmount: 0,
            date: r.originalDocumentDate || r.postingDate || r.executedAt,
            reversedAt: r.executedAt || r.approvedAt || r.requestedAt,
            reversalReason: r.reason,
            originalTransactionId: r.sourceId,
            reversalTransactionId: r.reversalDocumentId || r.reversalJournalEntryId,
            status: r.status,
            performedBy: null,
            registerId: r.id,
          }));
        }
      } catch (regErr) {
        console.error('Error fetching TransactionReversal register:', regErr);
        registerReversals = [];
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
        // Exclude formal sale reversal docs (handled separately via isReversal)
        saleRefundReversals = saleRefundReversals.filter((s) => !s.isReversal);
      } catch (saleRefundError) {
        console.error('Error fetching sale refund reversals:', saleRefundError);
        saleRefundReversals = [];
      }
    }

    // Expense reversal rows: reversal Expense has negative amount and reversedTransactionId → original expense.
    // Enrich with original posting date/amount, tax reversed (from posted Tax-Expense GL or expense.taxAmount),
    // GL journal id for the expense reversal, and user who performed the reversal (reversedById).
    let expenseReversalPayload = [];
    if (expensesReversals.length > 0) {
      const originalExpenseIds = [
        ...new Set(expensesReversals.map((e) => e.reversedTransactionId).filter(Boolean)),
      ];
      const reverserUserIds = [...new Set(expensesReversals.map((e) => e.reversedById).filter(Boolean))];
      const reversalExpenseIds = expensesReversals.map((e) => e.id);

      const [originalExpenses, reversers, taxExpenseTxns, glExpenseReversals] = await Promise.all([
        originalExpenseIds.length
          ? prisma.expense.findMany({
              where: { id: { in: originalExpenseIds }, tenantId: user.tenantId },
              select: {
                id: true,
                amount: true,
                taxAmount: true,
                date: true,
                description: true,
                merchant: true,
              },
            })
          : Promise.resolve([]),
        reverserUserIds.length
          ? prisma.user.findMany({
              where: { id: { in: reverserUserIds } },
              select: { id: true, name: true, email: true },
            })
          : Promise.resolve([]),
        originalExpenseIds.length
          ? prisma.transaction.findMany({
              where: {
                tenantId: user.tenantId,
                sourceType: 'Tax-Expense',
                sourceId: { in: originalExpenseIds },
                status: 'posted',
                isReversal: false,
              },
              select: {
                sourceId: true,
                lines: { select: { debitAmount: true, creditAmount: true }, take: 1 },
              },
            })
          : Promise.resolve([]),
        reversalExpenseIds.length
          ? prisma.transaction.findMany({
              where: {
                tenantId: user.tenantId,
                sourceType: 'Expense',
                sourceId: { in: reversalExpenseIds },
                status: 'posted',
                isReversal: true,
              },
              select: { id: true, sourceId: true },
            })
          : Promise.resolve([]),
      ]);

      const origById = Object.fromEntries(originalExpenses.map((o) => [o.id, o]));
      const reverserById = Object.fromEntries(reversers.map((u) => [u.id, u]));
      const taxPostedByExpenseId = {};
      for (const t of taxExpenseTxns) {
        const line = t.lines?.[0];
        const amt = Math.max(Number(line?.debitAmount || 0), Number(line?.creditAmount || 0));
        taxPostedByExpenseId[t.sourceId] = (taxPostedByExpenseId[t.sourceId] || 0) + amt;
      }
      const glByReversalExpenseId = Object.fromEntries(
        glExpenseReversals.map((t) => [t.sourceId, t.id])
      );

      expenseReversalPayload = expensesReversals.map((expense) => {
        const orig = expense.reversedTransactionId ? origById[expense.reversedTransactionId] : null;
        const originalAmount =
          orig != null ? Number(orig.amount) : Math.abs(Number(expense.amount));
        const fromGlTax = expense.reversedTransactionId
          ? taxPostedByExpenseId[expense.reversedTransactionId] || 0
          : 0;
        const fromRecordedTax = Number(orig?.taxAmount || 0);
        const taxReversed =
          fromGlTax > 0 ? fromGlTax : fromRecordedTax > 0 ? fromRecordedTax : null;

        return {
          id: expense.id,
          type: 'expense',
          displayReference: orig?.description || expense.description || 'Expense',
          description: expense.description,
          originalAmount,
          reversalAmount: -originalAmount,
          date: orig?.date || expense.date,
          reversedAt: expense.reversedAt,
          reversalReason: expense.reversalReason,
          originalTransactionId: expense.reversedTransactionId,
          reversalTransactionId: expense.id,
          originalExpenseId: expense.reversedTransactionId,
          reversalExpenseId: expense.id,
          glReversalJournalId: glByReversalExpenseId[expense.id] || null,
          merchant: orig?.merchant ?? expense.merchant,
          category: expense.category,
          status: expense.status,
          performedBy:
            (expense.reversedById && reverserById[expense.reversedById]) || expense.deletedBy || null,
          payments: expense.payments.map((p) => ({
            id: p.id,
            amount: p.amount,
            date: p.paymentDate,
          })),
          taxReversed,
        };
      });
    }

    // Transform and consolidate data (dedupe by stable key)
    const rawReversals = [
      ...expenseReversalPayload,
      ...invoiceReversals.map(invoice => ({
        id: invoice.id,
        type: 'sale',
        displayReference: invoice.invoiceNumber ? `Invoice ${invoice.invoiceNumber}` : 'Invoice',
        description: `Invoice #${invoice.invoiceNumber}`,
        originalAmount: parseFloat(invoice.total),
        reversalAmount: -parseFloat(invoice.total),
        date: invoice.issueDate, // Invoices use issueDate, not date
        reversedAt: invoice.reversedAt,
        reversalReason: invoice.reversalReason,
        // Child reversal row: reversedTransactionId → original (same as expense mapping)
        originalTransactionId: invoice.reversedTransactionId,
        reversalTransactionId: invoice.id,
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
        displayReference:
          payment.reference ||
          (payment.invoice?.invoiceNumber ? `Invoice ${payment.invoice.invoiceNumber}` : null) ||
          payment.expense?.description ||
          'Payment',
        description: `Payment ${payment.type === 'received' ? 'Received' : 'Made'}`,
        originalAmount: Math.abs(parseFloat(payment.amount) || 0),
        reversalAmount: -Math.abs(parseFloat(payment.amount) || 0),
        date: payment.paymentDate,
        reversedAt: payment.reversedAt,
        reversalReason: payment.reversalReason,
        originalTransactionId: payment.reversedTransactionId || payment.id,
        reversalTransactionId: payment.id,
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
        displayReference: refund.invoice?.invoiceNumber
          ? `Refund — Invoice ${refund.invoice.invoiceNumber}`
          : 'Refund',
        description: `Refund for Invoice #${refund.invoice?.invoiceNumber || ''}`,
        originalAmount: parseFloat(refund.refundAmount),
        reversalAmount: -parseFloat(refund.refundAmount),
        date: refund.refundDate,
        reversedAt: refund.processedAt,
        reversalReason: refund.refundReason,
        originalTransactionId: refund.invoiceId,
        reversalTransactionId: refund.transactionId,
        invoice: refund.invoice
          ? {
              id: refund.invoice.id,
              invoiceNumber: refund.invoice.invoiceNumber,
              client: refund.invoice.client
            }
          : null,
        refundMethod: refund.refundMethod,
        status: refund.status,
        performedBy: refund.refundedBy,
        taxReversed: null
      })),
      ...saleRefundReversals.map(sale => ({
        id: sale.id,
        type: 'sale_refund',
        displayReference: sale.saleNumber ? `Sale ${sale.saleNumber}` : 'Sale refund',
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
      })),
      ...payrollReversals,
      ...journalTxReversals,
      ...voidedInvoiceReversals,
      ...saleDocReversals,
      ...supplierPaymentReversals,
      ...v2JournalReversals,
      ...registerReversals,
    ];

    // Prefer domain rows over register stubs / duplicate journal echoes for same original
    const seen = new Set();
    const allReversals = [];
    for (const row of rawReversals) {
      const keys = [
        row.id && `id:${row.id}`,
        row.reversalTransactionId && `rev:${row.reversalTransactionId}`,
        row.type === 'void' && row.originalTransactionId && `void:${row.originalTransactionId}`,
        row.type === 'journal' &&
          row.originalTransactionId &&
          `je-orig:${row.originalTransactionId}`,
      ].filter(Boolean);
      if (keys.some((k) => seen.has(k))) continue;
      keys.forEach((k) => seen.add(k));
      allReversals.push(row);
    }

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
        sale_refund: filteredReversals.filter(r => r.type === 'sale_refund').length,
        sale_reversal: filteredReversals.filter(r => r.type === 'sale_reversal').length,
        payroll: filteredReversals.filter(r => r.type === 'payroll').length,
        journal: filteredReversals.filter(r => r.type === 'journal').length,
        void: filteredReversals.filter(r => r.type === 'void').length,
        supplier_payment: filteredReversals.filter(r => r.type === 'supplier_payment').length,
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
