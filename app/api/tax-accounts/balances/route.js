import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { addBranchFilter } from '@/lib/dashboardBranchFilter';

/**
 * GET /api/tax-accounts/balances
 * Get balances for all tax accounts with daily/monthly breakdowns
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

    // Build date filter - EXACTLY like individual page
    const dateFilter = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.gte = start;
      dateFilter.lte = end;
    }

    // Get all active tax types with their accounts
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

    const taxAccountBalances = [];

    for (const taxType of taxTypes) {
      if (!taxType.accountId || !taxType.account) {
        taxAccountBalances.push({
          taxType: {
            id: taxType.id,
            taxId: taxType.taxId,
            taxName: taxType.taxName,
            taxCode: taxType.taxCode,
            taxRate: taxType.taxRate,
            calculationType: taxType.calculationType,
          },
          account: null,
          totalCollected: 0,
          totalPaid: 0,
          totalRefunded: 0,
          netPayable: 0,
          currentBalance: 0,
          breakdown: [],
        });
        continue;
      }

      // Calculate tax collected from SALES (since tax transactions don't exist)
      // Exclude refunded sales so their tax is not counted as collected
      const salesWithTax = await prisma.sale.findMany({
        where: addBranchFilter(user, {
          tenantId: user.tenantId,
          status: { in: ['completed', 'paid'] },
          refundedAt: null,
          ...(Object.keys(dateFilter).length > 0 && {
            saleDate: dateFilter,
          }),
          items: {
            some: {
              taxAmount: { gt: 0 },
            },
          },
        }),
        include: {
          items: {
            where: {
              taxAmount: { gt: 0 },
            },
            include: {
              product: {
                include: {
                  productTaxes: {
                    where: {
                      taxTypeId: taxType.id,
                    },
                    include: {
                      taxType: true,
                    },
                  },
                },
              },
              itemTaxes: {
                where: {
                  taxTypeId: taxType.id,
                },
              },
            },
          },
        },
      });

      // Count active tax types for fallback logic
      const activeTaxTypeCount = await prisma.taxType.count({
        where: {
          tenantId: user.tenantId,
          status: 'Active',
        },
      });

      // Calculate totals from sales
      let totalCollected = 0;
      let totalPaid = 0;
      let totalRefunded = 0;
      const breakdownMap = new Map();

      // Process sales - check if item belongs to this tax type
      for (const sale of salesWithTax) {
        for (const item of sale.items) {
          // Check if this item's tax belongs to this tax type
          // Priority: 1) SaleItemTax records (most accurate), 2) ProductTax link, 3) If only one tax type exists, assume it's this one
          let taxAmountForThisType = 0;
          
          if (item.itemTaxes && item.itemTaxes.length > 0) {
            // Has SaleItemTax records - use the specific tax amount for this tax type
            const taxForThisType = item.itemTaxes.find(it => it.taxTypeId === taxType.id);
            if (taxForThisType) {
              taxAmountForThisType = Number(taxForThisType.taxAmount || 0);
            }
          } else if (item.product && item.product.productTaxes && item.product.productTaxes.length > 0) {
            // Check ProductTax link - calculate tax amount proportionally
            const productTaxForThisType = item.product.productTaxes.find(pt => pt.taxTypeId === taxType.id);
            if (productTaxForThisType && productTaxForThisType.taxType) {
              const taxTypeData = productTaxForThisType.taxType;
              // Calculate tax amount based on calculation type
              const itemSubtotal = (item.quantity || 0) * (item.unitPrice || 0);
              const itemBaseAmount = itemSubtotal - (item.discountAmount || 0);
              
              if (taxTypeData.calculationType === 'Fixed') {
                taxAmountForThisType = Number(taxTypeData.taxRate || 0) * (item.quantity || 1);
              } else {
                // Percentage calculation
                taxAmountForThisType = itemBaseAmount * (Number(taxTypeData.taxRate || 0) / 100);
              }
            }
          } else {
            // Fallback: If there's only one active tax type, assume all tax belongs to this one
            if (activeTaxTypeCount === 1 && item.taxAmount > 0) {
              taxAmountForThisType = Number(item.taxAmount || 0);
            }
          }

          if (taxAmountForThisType > 0) {
            const saleDate = sale.saleDate instanceof Date ? sale.saleDate : new Date(sale.saleDate);
            const dateKey = groupBy === 'day' 
              ? saleDate.toISOString().split('T')[0]
              : `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, '0')}`;

            if (!breakdownMap.has(dateKey)) {
              breakdownMap.set(dateKey, {
                period: dateKey,
                collected: 0,
                paid: 0,
                refunded: 0,
                net: 0,
              });
            }
            breakdownMap.get(dateKey).collected += taxAmountForThisType;
            totalCollected += taxAmountForThisType;
          }
        }
      }

      // Include tax collected from paid/completed invoices (when only one tax type, allocate all invoice tax to it)
      if (activeTaxTypeCount === 1) {
        const invoicesWithTax = await prisma.invoice.findMany({
          where: addBranchFilter(user, {
            tenantId: user.tenantId,
            status: { in: ['Paid', 'Completed'] },
            refundedAt: null,
            taxAmount: { gt: 0 },
            ...(Object.keys(dateFilter).length > 0 && {
              issueDate: dateFilter,
            }),
          }),
          select: { issueDate: true, taxAmount: true },
        });
        for (const inv of invoicesWithTax) {
          const amt = Number(inv.taxAmount || 0);
          if (amt <= 0) continue;
          totalCollected += amt;
          const d = inv.issueDate instanceof Date ? inv.issueDate : new Date(inv.issueDate);
          const dateKey = groupBy === 'day'
            ? d.toISOString().split('T')[0]
            : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (!breakdownMap.has(dateKey)) {
            breakdownMap.set(dateKey, {
              period: dateKey,
              collected: 0,
              paid: 0,
              refunded: 0,
              net: 0,
            });
          }
          breakdownMap.get(dateKey).collected += amt;
        }
      }

      // Also check for tax transactions (in case they exist)
      const transactions = await prisma.transaction.findMany({
        where: addBranchFilter(user, {
          tenantId: user.tenantId,
          status: 'posted',
          ...(Object.keys(dateFilter).length > 0 && {
            date: dateFilter,
          }),
          lines: {
            some: {
              accountId: taxType.accountId,
            },
          },
        }),
        select: {
          id: true,
          date: true,
          sourceType: true,
          sourceId: true,
          description: true,
          lines: {
            where: {
              accountId: taxType.accountId,
            },
            select: {
              debitAmount: true,
              creditAmount: true,
              description: true,
            },
          },
        },
        orderBy: {
          date: 'desc',
        },
      });

      const isLiability = taxType.account.accountType === 'Liability';
      const isAsset = taxType.account.accountType === 'Asset';

      transactions.forEach(tx => {
        const line = tx.lines[0];
        if (!line) return;

        const debitAmount = line.debitAmount || 0;
        const creditAmount = line.creditAmount || 0;
        const netAmount = creditAmount - debitAmount;

        const dateKey = groupBy === 'day' 
          ? tx.date.toISOString().split('T')[0]
          : `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, '0')}`;

        if (!breakdownMap.has(dateKey)) {
          breakdownMap.set(dateKey, {
            period: dateKey,
            collected: 0,
            paid: 0,
            refunded: 0,
            net: 0,
          });
        }
        const periodData = breakdownMap.get(dateKey);

        if (tx.sourceType?.startsWith('Tax-')) {
          // Tax transactions from tax service (Tax-Payroll, Tax-Sale, etc.)
          if (isLiability) {
            if (creditAmount > 0) {
              totalCollected += creditAmount;
              periodData.collected += creditAmount;
            } else if (debitAmount > 0) {
              totalRefunded += debitAmount;
              periodData.refunded += debitAmount;
            }
          } else if (isAsset) {
            if (debitAmount > 0) {
              totalCollected += debitAmount;
              periodData.collected += debitAmount;
            } else if (creditAmount > 0) {
              totalRefunded += creditAmount;
              periodData.refunded += creditAmount;
            }
          }
        } else if (tx.sourceType === 'Payroll' && isLiability && creditAmount > 0) {
          // Payroll transactions that credit tax liability accounts (PAYE, NPS, etc.)
          // This handles cases where tax was posted directly in payroll transaction
          // Check if this is a PAYE account by name
          const accountName = (taxType.account.accountName || taxType.account.name || '').toLowerCase();
          if (accountName.includes('paye') || taxType.taxName?.toLowerCase().includes('paye')) {
            totalCollected += creditAmount;
            periodData.collected += creditAmount;
          }
        } else if (tx.sourceType === 'TaxPayment') {
          const paymentAmount = isLiability ? debitAmount : creditAmount;
          totalPaid += paymentAmount;
          periodData.paid += paymentAmount;
        }

        periodData.net += netAmount;
      });

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
        currentBalance: taxType.account.balance || 0,
        breakdown: Array.from(breakdownMap.values()).sort((a, b) => a.period.localeCompare(b.period)),
      });
    }

    // Calculate summary totals
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
        startDate: dateFilter.gte?.toISOString().split('T')[0],
        endDate: dateFilter.lte?.toISOString().split('T')[0],
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
