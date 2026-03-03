import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { addBranchFilter } from '@/lib/dashboardBranchFilter';

/**
 * GET /api/tax-accounts/balances
 * Get balances for all tax accounts with daily/monthly breakdowns
 * 
 * Tax data storage:
 * - Sales: SaleItemTax links to TaxType (reliable)
 * - Invoices: Invoice.taxAmount only (NOT linked to TaxType)
 * - Purchase Orders: PurchaseOrderItem.taxTypeId links to TaxType (reliable)
 * - Expenses: Expense.taxAmount only (NOT linked to TaxType)
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
      const isOnlyNonPayeTaxType = nonPayeTaxTypes.length === 1 && nonPayeTaxTypes[0].id === taxType.id;
      const isFirstNonPayeTaxType = nonPayeTaxTypes.length > 0 && nonPayeTaxTypes[0].id === taxType.id;

      const addToBreakdown = (date, field, amount) => {
        const d = new Date(date);
        const dateKey = groupBy === 'day'
          ? d.toISOString().split('T')[0]
          : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!breakdownMap.has(dateKey)) {
          breakdownMap.set(dateKey, { period: dateKey, collected: 0, paid: 0, refunded: 0, net: 0 });
        }
        breakdownMap.get(dateKey)[field] += amount;
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
          if (sale.status === 'void') continue;

          const branchId = user?.currentBranchId || null;
          if (branchId && sale.branchId && sale.branchId !== branchId) continue;

          const saleDate = new Date(sale.saleDate);
          if (saleDate < start || saleDate > end) continue;

          const taxAmt = Number(sit.taxAmount || 0);
          if (taxAmt > 0) {
            totalCollected += taxAmt;
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
            status: { not: 'void' },
            saleDate: dateFilter,
          }),
          select: { id: true, saleDate: true, taxAmount: true, taxRate: true },
        });

        for (const sale of salesWithTax) {
          if (salesAccountedFor.has(sale.id)) continue;

          const saleTaxRate = Number(sale.taxRate || 0);
          const saleTaxAmount = Number(sale.taxAmount || 0);
          if (saleTaxAmount <= 0) continue;

          const rateMatches = taxTypeRate > 0 && Math.abs(saleTaxRate - taxTypeRate) < 0.01;
          const isLegacyData = saleTaxRate === 0 && saleTaxAmount > 0;
          const hasAnyTaxTypeWithMatchingRate = nonPayeTaxTypes.some(t =>
            Math.abs(Number(t.taxRate) - saleTaxRate) < 0.01
          );

          if (rateMatches || isOnlyNonPayeTaxType ||
              (isLegacyData && isFirstNonPayeTaxType && taxTypeRate > 0) ||
              (!hasAnyTaxTypeWithMatchingRate && isFirstNonPayeTaxType)) {
            totalCollected += saleTaxAmount;
            addToBreakdown(sale.saleDate, 'collected', saleTaxAmount);
          }
        }
      } catch (err) {
        console.warn('Tax balances: Sale fallback query failed for', taxType.taxId, err?.message);
      }

      // ========== TAX COLLECTED FROM INVOICES ==========
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
            const taxAmt = Number(inv.taxAmount || 0);
            if (taxAmt > 0) {
              totalCollected += taxAmt;
              addToBreakdown(inv.issueDate, 'collected', taxAmt);
            }
          }
        }
      } catch (err) {
        console.warn('Tax balances: Invoice query failed for', taxType.taxId, err?.message);
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
          const taxAmt = Number(poItem.taxAmount || 0);
          if (taxAmt > 0) {
            totalPaid += taxAmt;
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

        const expensesWithTax = await prisma.expense.findMany({
          where: addBranchFilter(user, {
            tenantId: user.tenantId,
            OR: [
              { taxAmount: { gt: 0 } },
              { taxRate: { gt: 0 } },
            ],
            isDeleted: false,
            date: dateFilter,
          }),
          select: { date: true, taxAmount: true, taxRate: true },
        });

        for (const ex of expensesWithTax) {
          const expTaxRate = Number(ex.taxRate || 0);
          const expTaxAmount = Number(ex.taxAmount || 0);
          if (expTaxAmount <= 0) continue;

          const rateMatches = taxTypeRate > 0 && Math.abs(expTaxRate - taxTypeRate) < 0.01;
          const isLegacyData = expTaxRate === 0 && expTaxAmount > 0;

          if (rateMatches || isOnlyNonPaye || (isLegacyData && isFirstNonPaye && taxTypeRate > 0)) {
            totalPaid += expTaxAmount;
            addToBreakdown(ex.date, 'paid', expTaxAmount);
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
              lines: {
                where: { accountId: taxType.accountId },
                select: { debitAmount: true, creditAmount: true },
              },
            },
          });

          const isLiability = taxType.account?.accountType === 'Liability';
          const isAsset = taxType.account?.accountType === 'Asset';

          for (const tx of transactions) {
            const line = tx.lines[0];
            if (!line) continue;

            const debitAmount = Number(line.debitAmount || 0);
            const creditAmount = Number(line.creditAmount || 0);

            if (tx.sourceType === 'TaxPayment') {
              const paymentAmount = isLiability ? debitAmount : creditAmount;
              if (paymentAmount > 0) {
                totalPaid += paymentAmount;
                addToBreakdown(tx.date, 'paid', paymentAmount);
              }
            }
            // Supplier payment tax: debit to Liability = input VAT paid
            else if (tx.sourceType === 'Tax-SupplierPayment') {
              const paidAmt = isLiability ? debitAmount : creditAmount;
              if (paidAmt > 0) {
                totalPaid += paidAmt;
                addToBreakdown(tx.date, 'paid', paidAmt);
              }
            }
            // Tax-Sale and Tax-Invoice are already counted via direct aggregation above
            else if (tx.sourceType?.startsWith('Tax-') &&
                     tx.sourceType !== 'Tax-Sale' &&
                     tx.sourceType !== 'Tax-Invoice' &&
                     tx.sourceType !== 'Tax-SupplierPayment') {
              if (isLiability) {
                if (creditAmount > 0) {
                  totalCollected += creditAmount;
                  addToBreakdown(tx.date, 'collected', creditAmount);
                } else if (debitAmount > 0) {
                  totalRefunded += debitAmount;
                  addToBreakdown(tx.date, 'refunded', debitAmount);
                }
              } else if (isAsset) {
                if (debitAmount > 0) {
                  totalCollected += debitAmount;
                  addToBreakdown(tx.date, 'collected', debitAmount);
                } else if (creditAmount > 0) {
                  totalRefunded += creditAmount;
                  addToBreakdown(tx.date, 'refunded', creditAmount);
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('Tax balances: Transaction query failed for', taxType.taxId, err?.message);
      }

      const netPayable = totalCollected - totalPaid - totalRefunded;

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
        totalCollected,
        totalPaid,
        totalRefunded,
        netPayable,
        currentBalance: taxType.account?.balance || 0,
        breakdown: Array.from(breakdownMap.values()).sort((a, b) => a.period.localeCompare(b.period)),
      });
    }

    const summary = {
      totalTaxAccounts: taxAccountBalances.length,
      totalCollected: taxAccountBalances.reduce((sum, acc) => sum + acc.totalCollected, 0),
      totalPaid: taxAccountBalances.reduce((sum, acc) => sum + acc.totalPaid, 0),
      totalRefunded: taxAccountBalances.reduce((sum, acc) => sum + acc.totalRefunded, 0),
      totalNetPayable: 0,
    };
    summary.totalNetPayable = summary.totalCollected - summary.totalPaid - summary.totalRefunded;

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
