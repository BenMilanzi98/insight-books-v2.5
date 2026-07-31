import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { addBranchFilter } from '@/lib/dashboardBranchFilter';
import { isPayeTaxType, sumPaidPayeExpenses } from '@/lib/payeExpenseSettlement';
import { addMoney, parseMoney, subtractMoney } from '@/lib/money';
import { getMalawiTaxCatalogEntry } from '@/lib/malawiTaxCatalog.js';

/**
 * GET /api/tax-accounts/balances
 * Get balances for all tax accounts with daily/monthly breakdowns
 * 
 * Tax data storage:
 * - Sales: SaleItemTax links to TaxType (reliable)
 * - Invoices: tax included on V2 invoice/sale journal postings (taxAmount on adapters)
 * - Purchase Orders: PurchaseOrderItem.taxTypeId links to TaxType (reliable)
 * - Expenses: Expense.taxTypeId links to TaxType (new), fallback via rate matching
 */
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const groupBy = searchParams.get('groupBy') || 'month';

    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
    // Normalize to inclusive local day range to avoid UTC shifting from YYYY-MM-DD strings
    start.setHours(0, 0, 0, 0);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);
    const dateFilter = { gte: start, lte: end };

    const taxTypes = await prisma.taxType.findMany({
      where: {
        tenantId: user.tenantId,
        status: 'Active',
      },
      include: {
        account: {
          select: {
            id: true,
            accountCode: true,
            accountName: true,
            accountType: true,
            balance: true,
          },
        },
      },
    });

    const nonPayeTaxTypes = taxTypes.filter(t => Number(t.taxRate) > 0);
    const taxAccountBalances = [];

    for (const taxType of taxTypes) {
      let totalCollected = 0;
      let totalPaid = 0;
      let totalRefunded = 0;
      const breakdownMap = new Map();
      const taxTypeRate = Number(taxType.taxRate);
      const isPAYE = isPayeTaxType(taxType);
      const isOnlyNonPayeTaxType = nonPayeTaxTypes.length === 1 && nonPayeTaxTypes[0].id === taxType.id;
      const isFirstNonPayeTaxType = nonPayeTaxTypes.length > 0 && nonPayeTaxTypes[0].id === taxType.id;
      let payePaidFromExpensesTotal = 0;
      const payeTaxPaymentRows = [];
      const payePayrollIdsCoveredByGl = new Set();

      const addToBreakdown = (date, field, amount) => {
        const d = new Date(date);
        const dateKey = groupBy === 'day'
          ? d.toISOString().split('T')[0]
          : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!breakdownMap.has(dateKey)) {
          breakdownMap.set(dateKey, { period: dateKey, collected: 0, paid: 0, refunded: 0, net: 0 });
        }
        const bucket = breakdownMap.get(dateKey);
        bucket[field] = addMoney(bucket[field], amount);
      };

      // ========== TAX COLLECTED FROM SALES (SaleItemTax) ==========
      const salesAccountedFor = new Set();
      try {
        const saleItemTaxes = await prisma.saleItemTax.findMany({
          where: { taxTypeId: taxType.id },
          include: {
            saleItem: {
              include: {
                sale: {
                  select: {
                    id: true, saleDate: true, refundedAt: true,
                    branchId: true, status: true,
                  },
                },
              },
            },
          },
        });

        for (const sit of saleItemTaxes) {
          const sale = sit.saleItem?.sale;
          if (!sale) continue;
          if (sale.refundedAt) continue;
          const statusLower = (sale.status || '').toString().toLowerCase();
          // Only exclude void sales; include completed, paid, and any other status
          if (statusLower === 'void') continue;

          const branchId = user?.currentBranchId ?? null;
          // When user has a branch selected, exclude only sales that belong to a different branch (include same branch or no branch)
          if (branchId && sale.branchId != null && sale.branchId !== branchId) continue;

          const saleDate = new Date(sale.saleDate);
          if (Number.isNaN(saleDate.getTime())) continue;
          if (saleDate < start || saleDate > end) continue;

          const taxAmt = parseMoney(sit.taxAmount);
          if (taxAmt > 0) {
            totalCollected = addMoney(totalCollected, taxAmt);
            salesAccountedFor.add(sale.id);
            addToBreakdown(saleDate, 'collected', taxAmt);
          }
        }
      } catch (err) {
        console.warn('Tax balances: SaleItemTax query failed for', taxType.taxId, err?.message);
      }

      // ========== TAX COLLECTED FROM SALES (fallback: sale-level taxAmount) ==========
      try {
        const salesWithTax = await prisma.sale.findMany({
          where: addBranchFilter(user, {
            tenantId: user.tenantId,
            OR: [
              { taxAmount: { gt: 0 } },
              { taxRate: { gt: 0 } },
            ],
            refundedAt: null,
            status: { notIn: ['void', 'Void'] },
            saleDate: dateFilter,
          }),
          select: { id: true, saleDate: true, taxAmount: true, taxRate: true },
        });

        for (const sale of salesWithTax) {
          if (salesAccountedFor.has(sale.id)) continue;

          const saleTaxRate = Number(sale.taxRate || 0);
          const saleTaxAmount = parseMoney(sale.taxAmount);
          if (saleTaxAmount <= 0) continue;

          const rateMatches = taxTypeRate > 0 && Math.abs(saleTaxRate - taxTypeRate) < 0.01;
          const isLegacyData = saleTaxRate === 0 && saleTaxAmount > 0;
          const hasAnyTaxTypeWithMatchingRate = nonPayeTaxTypes.some(t =>
            Math.abs(Number(t.taxRate) - saleTaxRate) < 0.01
          );

          if (rateMatches || isOnlyNonPayeTaxType ||
              (isLegacyData && isFirstNonPayeTaxType && taxTypeRate > 0) ||
              (!hasAnyTaxTypeWithMatchingRate && isFirstNonPayeTaxType)) {
            totalCollected = addMoney(totalCollected, saleTaxAmount);
            addToBreakdown(sale.saleDate, 'collected', saleTaxAmount);
          }
        }
      } catch (err) {
        console.warn('Tax balances: Sale fallback query failed for', taxType.taxId, err?.message);
      }

      // ========== TAX COLLECTED FROM INVOICES ==========
      // Invoice tax is posted with V2 invoice/sale adapters (taxAmount on the journal).
      // These transactions are linked to the correct tax account per tax type.
      // We collect invoice IDs that have Tax-Invoice postings so we can fall back for unposted ones.
      const invoicesAccountedFor = new Set();
      try {
        if (taxType.accountId) {
          const taxInvoiceTxns = await prisma.transaction.findMany({
            where: {
              tenantId: user.tenantId,
              status: 'posted',
              sourceType: 'Tax-Invoice',
              date: dateFilter,
              lines: {
                some: { accountId: taxType.accountId },
              },
            },
            select: {
              id: true,
              date: true,
              sourceId: true,
              lines: {
                where: { accountId: taxType.accountId },
                select: { debitAmount: true, creditAmount: true },
              },
            },
          });

          const isLiability = taxType.account?.accountType === 'Liability';
          for (const txn of taxInvoiceTxns) {
            const line = txn.lines[0];
            if (!line) continue;
            const creditAmount = parseMoney(line.creditAmount);
            const debitAmount = parseMoney(line.debitAmount);
            const taxAmt = isLiability ? creditAmount : debitAmount;
            if (taxAmt > 0) {
              totalCollected = addMoney(totalCollected, taxAmt);
              addToBreakdown(txn.date, 'collected', taxAmt);
              if (txn.sourceId) invoicesAccountedFor.add(txn.sourceId);
            }
          }
        }
      } catch (err) {
        console.warn('Tax balances: Tax-Invoice transaction query failed for', taxType.taxId, err?.message);
      }

      // Fallback: For invoices without Tax-Invoice transactions, use direct aggregation
      // (only for first/only non-PAYE tax type to avoid double-counting across types)
      try {
        if (isOnlyNonPayeTaxType || (isFirstNonPayeTaxType && taxTypeRate > 0)) {
          const invoicesWithTax = await prisma.invoice.findMany({
            where: addBranchFilter(user, {
              tenantId: user.tenantId,
              status: { in: ['Paid', 'paid', 'Completed', 'completed'] },
              refundedAt: null,
              taxAmount: { gt: 0 },
              issueDate: dateFilter,
            }),
            select: { id: true, issueDate: true, taxAmount: true },
          });

          for (const inv of invoicesWithTax) {
            if (invoicesAccountedFor.has(inv.id)) continue;
            const taxAmt = parseMoney(inv.taxAmount);
            if (taxAmt > 0) {
              totalCollected = addMoney(totalCollected, taxAmt);
              addToBreakdown(inv.issueDate, 'collected', taxAmt);
            }
          }
        }
      } catch (err) {
        console.warn('Tax balances: Invoice fallback query failed for', taxType.taxId, err?.message);
      }

      // ========== TAX PAID FROM PURCHASE ORDERS ==========
      try {
        const poItemsWithTax = await prisma.purchaseOrderItem.findMany({
          where: {
            taxTypeId: taxType.id,
            taxAmount: { gt: 0 },
            purchaseOrder: {
              tenantId: user.tenantId,
              status: { notIn: ['Cancelled', 'Draft'] },
              poDate: dateFilter,
            },
          },
          include: {
            purchaseOrder: {
              select: { id: true, poDate: true, status: true },
            },
          },
        });

        for (const poItem of poItemsWithTax) {
          const po = poItem.purchaseOrder;
          if (!po) continue;
          const taxAmt = parseMoney(poItem.taxAmount);
          if (taxAmt > 0) {
            totalPaid = addMoney(totalPaid, taxAmt);
            addToBreakdown(po.poDate, 'paid', taxAmt);
          }
        }
      } catch (err) {
        console.warn('Tax balances: PO items query failed for', taxType.taxId, err?.message);
      }

      // ========== TAX PAID FROM EXPENSES ==========
      try {
        const isFirstNonPaye = nonPayeTaxTypes.length > 0 && nonPayeTaxTypes[0].id === taxType.id;
        const isOnlyNonPaye = nonPayeTaxTypes.length === 1 && nonPayeTaxTypes[0].id === taxType.id;

        // First: expenses directly linked to this tax type via taxTypeId
        const expensesDirectlyLinked = new Set();
        const directExpenses = await prisma.expense.findMany({
          where: addBranchFilter(user, {
            tenantId: user.tenantId,
            taxTypeId: taxType.id,
            taxAmount: { gt: 0 },
            isDeleted: false,
            date: dateFilter,
          }),
          select: { id: true, date: true, taxAmount: true },
        });

        for (const ex of directExpenses) {
          const expTaxAmount = parseMoney(ex.taxAmount);
          if (!isPAYE && expTaxAmount > 0) {
            totalPaid = addMoney(totalPaid, expTaxAmount);
            addToBreakdown(ex.date, 'paid', expTaxAmount);
            expensesDirectlyLinked.add(ex.id);
          }
        }

        // Then: fallback for expenses without taxTypeId (legacy data)
        const expensesWithTax = await prisma.expense.findMany({
          where: addBranchFilter(user, {
            tenantId: user.tenantId,
            taxTypeId: null,
            OR: [
              { taxAmount: { gt: 0 } },
              { taxRate: { gt: 0 } },
            ],
            isDeleted: false,
            date: dateFilter,
          }),
          select: { id: true, date: true, taxAmount: true, taxRate: true },
        });

        for (const ex of expensesWithTax) {
          if (isPAYE) continue;
          if (expensesDirectlyLinked.has(ex.id)) continue;
          const expTaxRate = Number(ex.taxRate || 0);
          const expTaxAmount = parseMoney(ex.taxAmount);
          if (expTaxAmount <= 0) continue;

          const rateMatches = taxTypeRate > 0 && Math.abs(expTaxRate - taxTypeRate) < 0.01;
          const isLegacyData = expTaxRate === 0 && expTaxAmount > 0;

          if (rateMatches || isOnlyNonPaye || (isLegacyData && isFirstNonPaye && taxTypeRate > 0)) {
            totalPaid = addMoney(totalPaid, expTaxAmount);
            addToBreakdown(ex.date, 'paid', expTaxAmount);
          }
        }

        if (isPAYE) {
          const branchId = user?.currentBranchId ?? null;
          const paidPayeExpenses = await sumPaidPayeExpenses(prisma, {
            tenantId: user.tenantId,
            taxTypeId: taxType.id,
            dateFilter,
            branchId,
          });
          payePaidFromExpensesTotal = paidPayeExpenses.total;
          for (const row of paidPayeExpenses.rows) {
            totalPaid = addMoney(totalPaid, row.amount);
            addToBreakdown(row.date, 'paid', row.amount);
          }
        }
      } catch (err) {
        console.warn('Tax balances: Expense query failed for', taxType.taxId, err?.message);
      }

      // ========== CHECK TRANSACTIONS FOR TAX PAYMENTS/REFUNDS ==========
      try {
        if (taxType.accountId) {
          const transactions = await prisma.transaction.findMany({
            where: {
              tenantId: user.tenantId,
              status: 'posted',
              date: dateFilter,
              lines: {
                some: { accountId: taxType.accountId },
              },
            },
            select: {
              id: true,
              date: true,
              sourceType: true,
              sourceId: true,
              isReversal: true,
              reversedTransactionId: true,
              lines: {
                where: { accountId: taxType.accountId },
                select: { debitAmount: true, creditAmount: true },
              },
            },
          });

          const payePayrollTxnIdToPayrollId = new Map();
          if (isPAYE) {
            for (const t of transactions) {
              if (t.sourceType === 'Payroll' && t.sourceId) {
                payePayrollTxnIdToPayrollId.set(t.id, t.sourceId);
              }
            }
          }

          const taxExpenseSourceIds = [
            ...new Set(
              transactions
                .filter((t) => t.sourceType === 'Tax-Expense' && t.sourceId)
                .map((t) => t.sourceId)
            ),
          ];
          let deletedExpenseTaxSourceIds = new Set();
          if (taxExpenseSourceIds.length > 0) {
            const deletedExpenses = await prisma.expense.findMany({
              where: {
                id: { in: taxExpenseSourceIds },
                tenantId: user.tenantId,
                isDeleted: true,
              },
              select: { id: true },
            });
            deletedExpenseTaxSourceIds = new Set(deletedExpenses.map((e) => e.id));
          }

          const accountTypeNorm = (taxType.account?.accountType || '')
            .toString()
            .trim()
            .toLowerCase();
          const isLiability = accountTypeNorm === 'liability';
          const isAsset = accountTypeNorm === 'asset';
          // Invoice void reverses the original Tax-Invoice journal as sourceType "Tax-Invoice-Void"
          // and also posts Tax-InvoiceVoid via reverseAutoPostTaxEntry — same economic reversal twice.
          const invoiceIdsWithCompoundTaxInvoiceVoid = new Set(
            transactions
              .filter((t) => t.sourceType === 'Tax-Invoice-Void')
              .map((t) => t.sourceId)
              .filter(Boolean)
          );

          for (const tx of transactions) {
            const line = tx.lines[0];
            if (!line) continue;

            const debitAmount = parseMoney(line.debitAmount);
            const creditAmount = parseMoney(line.creditAmount);

            // PAYE special-case: payroll processing posts PAYE as a credit to the PAYE liability account
            // inside the Payroll journal (sourceType 'Payroll'). Treat that as "collected/assessed" PAYE
            // so Tax Types shows PAYE correctly under the linked PAYE account.
            // Reversal payroll journals (isReversal=true) will appear as a debit on this liability and are treated as refunded.
            if (isPAYE && tx.sourceType === 'Payroll') {
              if (tx.sourceId) payePayrollIdsCoveredByGl.add(tx.sourceId);
              if (isLiability) {
                if (creditAmount > 0) {
                  totalCollected = addMoney(totalCollected, creditAmount);
                  addToBreakdown(tx.date, 'collected', creditAmount);
                } else if (debitAmount > 0) {
                  totalRefunded = addMoney(totalRefunded, debitAmount);
                  addToBreakdown(tx.date, 'refunded', debitAmount);
                }
              }
              continue;
            }

            if (isPAYE && tx.sourceType === 'Transaction' && tx.isReversal) {
              const reversedPayrollId = payePayrollTxnIdToPayrollId.get(tx.reversedTransactionId);
              if (reversedPayrollId) payePayrollIdsCoveredByGl.add(reversedPayrollId);
              if (isLiability && debitAmount > 0) {
                totalRefunded = addMoney(totalRefunded, debitAmount);
                addToBreakdown(tx.date, 'refunded', debitAmount);
                continue;
              }
              if (isAsset && creditAmount > 0) {
                totalRefunded = addMoney(totalRefunded, creditAmount);
                addToBreakdown(tx.date, 'refunded', creditAmount);
                continue;
              }
            }

            if (
              tx.sourceType === 'Tax-Expense' &&
              tx.sourceId &&
              deletedExpenseTaxSourceIds.has(tx.sourceId)
            ) {
              continue;
            }

            if (tx.sourceType === 'TaxPayment') {
              const paymentAmount = isLiability ? debitAmount : creditAmount;
              if (paymentAmount > 0) {
                if (isPAYE) {
                  payeTaxPaymentRows.push({ date: tx.date, amount: paymentAmount });
                } else {
                  totalPaid = addMoney(totalPaid, paymentAmount);
                  addToBreakdown(tx.date, 'paid', paymentAmount);
                }
              }
            }
            // Supplier payment tax: debit to Liability = input VAT paid
            else if (tx.sourceType === 'Tax-SupplierPayment') {
              const paidAmt = isLiability ? debitAmount : creditAmount;
              if (paidAmt > 0) {
                totalPaid = addMoney(totalPaid, paidAmt);
                addToBreakdown(tx.date, 'paid', paidAmt);
              }
            }
            // Tax-Sale: count only for sales NOT already covered by SaleItemTax direct aggregation
            else if (tx.sourceType === 'Tax-Sale') {
              if (tx.sourceId && !salesAccountedFor.has(tx.sourceId)) {
                if (isLiability) {
                  if (creditAmount > 0) {
                    totalCollected = addMoney(totalCollected, creditAmount);
                    addToBreakdown(tx.date, 'collected', creditAmount);
                  }
                } else if (isAsset) {
                  if (debitAmount > 0) {
                    totalCollected = addMoney(totalCollected, debitAmount);
                    addToBreakdown(tx.date, 'collected', debitAmount);
                  }
                }
              }
            }
            // Tax-Invoice is now counted above via dedicated query
            // Handle tax reversals from refunds/voids / expense deletion (GL Tax-Reversal) explicitly.
            // Tax-Invoice-Void = compound JE that reverses the original Tax-Invoice posting (void flow).
            // Tax-InvoiceVoid = separate entry from reverseAutoPostTaxEntry — skip if compound already reversed that invoice.
            else if (tx.sourceType === 'Tax-SaleRefund' || tx.sourceType === 'Tax-SaleVoid' ||
                     tx.sourceType === 'Tax-InvoiceRefund' || tx.sourceType === 'Tax-InvoiceVoid' ||
                     tx.sourceType === 'Tax-Invoice-Void' ||
                     tx.sourceType === 'Tax-Reversal') {
              if (
                tx.sourceType === 'Tax-InvoiceVoid' &&
                tx.sourceId &&
                invoiceIdsWithCompoundTaxInvoiceVoid.has(tx.sourceId)
              ) {
                continue;
              }
              // Reversals: for Liability accounts, debit reduces collected tax
              // For Asset accounts, credit reduces collected tax
              if (isLiability) {
                if (debitAmount > 0) {
                  totalRefunded = addMoney(totalRefunded, debitAmount);
                  addToBreakdown(tx.date, 'refunded', debitAmount);
                }
              } else if (isAsset) {
                if (creditAmount > 0) {
                  totalRefunded = addMoney(totalRefunded, creditAmount);
                  addToBreakdown(tx.date, 'refunded', creditAmount);
                }
              }
            }
            // Handle remaining Tax-* sourceTypes (generic; Tax-Reversal and invoice void/refund tax handled above)
            else if (tx.sourceType?.startsWith('Tax-') &&
                     tx.sourceType !== 'Tax-Invoice' &&
                     tx.sourceType !== 'Tax-Invoice-Void' &&
                     tx.sourceType !== 'Tax-InvoiceVoid' &&
                     tx.sourceType !== 'Tax-InvoiceRefund' &&
                     tx.sourceType !== 'Tax-SupplierPayment' &&
                     tx.sourceType !== 'Tax-Reversal') {
              if (isLiability) {
                if (creditAmount > 0) {
                  totalCollected = addMoney(totalCollected, creditAmount);
                  addToBreakdown(tx.date, 'collected', creditAmount);
                } else if (debitAmount > 0) {
                  totalRefunded = addMoney(totalRefunded, debitAmount);
                  addToBreakdown(tx.date, 'refunded', debitAmount);
                }
              } else if (isAsset) {
                if (debitAmount > 0) {
                  totalCollected = addMoney(totalCollected, debitAmount);
                  addToBreakdown(tx.date, 'collected', debitAmount);
                } else if (creditAmount > 0) {
                  totalRefunded = addMoney(totalRefunded, creditAmount);
                  addToBreakdown(tx.date, 'refunded', creditAmount);
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('Tax balances: Transaction query failed for', taxType.taxId, err?.message);
      }

      if (isPAYE && payeTaxPaymentRows.length > 0) {
        const payeTaxPaymentTotal = payeTaxPaymentRows.reduce((sum, row) => addMoney(sum, row.amount), 0);
        let unappliedTaxPaymentAmount = Math.max(0, subtractMoney(payeTaxPaymentTotal, payePaidFromExpensesTotal));
        for (const row of payeTaxPaymentRows) {
          if (unappliedTaxPaymentAmount <= 0.005) break;
          const amountToAdd = Math.min(row.amount, unappliedTaxPaymentAmount);
          totalPaid = addMoney(totalPaid, amountToAdd);
          addToBreakdown(row.date, 'paid', amountToAdd);
          unappliedTaxPaymentAmount = subtractMoney(unappliedTaxPaymentAmount, amountToAdd);
        }
      }

      // ========== PAYE FALLBACK (Payroll table) ==========
      // If PAYE was not posted via GL (or tax account linkage differs), still reflect PAYE withheld.
      try {
        const isPAYE =
          (taxType.taxId || '').toString().toUpperCase() === 'PAYE' ||
          (taxType.taxName || '').toString().toUpperCase().includes('PAYE');
        if (isPAYE) {
          const payrolls = await prisma.payroll.findMany({
            where: {
              tenantId: user.tenantId,
              payeAmount: { gt: 0 },
              OR: [
                { paymentDate: dateFilter },
                { paymentDate: null, periodEnd: dateFilter },
              ],
            },
            select: { id: true, payeAmount: true, status: true, paymentDate: true, periodEnd: true }
          });
          for (const p of payrolls) {
            if (payePayrollIdsCoveredByGl.has(p.id)) continue;
            const amt = parseMoney(p.payeAmount);
            if (amt <= 0) continue;
            if (p.status === 'Reversed') continue;
            const d = p.paymentDate || p.periodEnd;
            totalCollected = addMoney(totalCollected, amt);
            addToBreakdown(d, 'collected', amt);
          }
        }
      } catch (err) {
        console.warn('Tax balances: PAYE payroll fallback failed for', taxType.taxId, err?.message);
      }

      const netPayable = subtractMoney(subtractMoney(totalCollected, totalPaid), totalRefunded);
      const netDueInPeriod = Math.max(0, netPayable);
      const periodReversalOverhang =
        netPayable < 0 ? Number((-netPayable).toFixed(2)) : 0;

      taxAccountBalances.push({
        taxType: {
          id: taxType.id,
          taxId: taxType.taxId,
          taxName: taxType.taxName,
          taxCode: taxType.taxCode,
          taxRate: taxType.taxRate,
          calculationType: taxType.calculationType,
        },
        account: taxType.account,
        flow:
          getMalawiTaxCatalogEntry(taxType.taxId)?.flow ||
          getMalawiTaxCatalogEntry(taxType.taxCode)?.flow ||
          (String(taxType.account?.accountCode || '').startsWith('2045-') ? 'outflow' : 'inflow'),
        isSystem: Boolean(getMalawiTaxCatalogEntry(taxType.taxId)),
        totalCollected,
        totalPaid,
        totalRefunded,
        netPayable,
        /** Same as max(0, netPayable) — amount due in the selected window (avoids confusing negative "net tax"). */
        netDueInPeriod,
        /** When netPayable is negative: reversals/refunds in the window exceed in-window collections (often date-range skew). */
        periodReversalOverhang,
        currentBalance: taxType.account?.balance || 0,
        breakdown: Array.from(breakdownMap.values()).sort((a, b) => a.period.localeCompare(b.period)),
      });
    }

    const summary = {
      totalTaxAccounts: taxAccountBalances.length,
      totalCollected: taxAccountBalances.reduce((sum, acc) => addMoney(sum, acc.totalCollected), 0),
      totalPaid: taxAccountBalances.reduce((sum, acc) => addMoney(sum, acc.totalPaid), 0),
      totalRefunded: taxAccountBalances.reduce((sum, acc) => addMoney(sum, acc.totalRefunded), 0),
      totalNetPayable: 0,
      totalNetDueInPeriod: taxAccountBalances.reduce((sum, acc) => addMoney(sum, acc.netDueInPeriod), 0),
      totalPeriodReversalOverhang: taxAccountBalances.reduce(
        (sum, acc) => addMoney(sum, acc.periodReversalOverhang),
        0
      ),
    };
    summary.totalNetPayable = subtractMoney(subtractMoney(summary.totalCollected, summary.totalPaid), summary.totalRefunded);

    return NextResponse.json({
      period: {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
        groupBy,
      },
      summary,
      taxAccounts: taxAccountBalances,
    });

  } catch (error) {
    console.error('Error fetching tax account balances:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tax account balances', details: error.message },
      { status: 500 }
    );
  }
}
