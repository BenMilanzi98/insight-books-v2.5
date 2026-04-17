import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { addBranchFilter } from '@/lib/dashboardBranchFilter';

/**
 * GET /api/tax-accounts/[id]/balance
 * Get detailed balance and transaction history for a specific tax account
 */
export async function GET(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const resolvedParams = await params;
    const { id } = resolvedParams; // taxTypeId

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Get tax type with account
    const taxType = await prisma.taxType.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
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

    if (!taxType) {
      return NextResponse.json(
        { error: 'Tax account not found' },
        { status: 404 }
      );
    }

    if (!taxType.account) {
      return NextResponse.json(
        { error: 'Tax type does not have an account linked' },
        { status: 400 }
      );
    }

    // Build date filter
    const dateFilter = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.gte = start;
      dateFilter.lte = end;
    }

    // Calculate tax collected from SALES
    // Strategy 1: Sales with SaleItems that have tax
    const salesWithItemTax = await prisma.sale.findMany({
      where: addBranchFilter(user, {
        tenantId: user.tenantId,
        status: { notIn: ['void', 'Void'] },
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

    // Strategy 2: Sales with sale-level taxAmount but no SaleItems (old sales)
    const salesWithSaleLevelTax = await prisma.sale.findMany({
      where: addBranchFilter(user, {
        tenantId: user.tenantId,
        status: { notIn: ['void', 'Void'] },
        refundedAt: null,
        taxAmount: { gt: 0 },
        items: { none: {} },
        ...(Object.keys(dateFilter).length > 0 && {
          saleDate: dateFilter,
        }),
      }),
      select: {
        id: true,
        saleNumber: true,
        saleDate: true,
        taxAmount: true,
        taxRate: true,
      },
    });

    // Merge both into salesWithTax for processing
    const salesWithTax = salesWithItemTax;

    // Count active non-PAYE tax types for fallback logic
    const activeTaxTypes = await prisma.taxType.findMany({
      where: {
        tenantId: user.tenantId,
        status: 'Active',
      },
      select: { id: true, taxRate: true },
    });
    const activeTaxTypeCount = activeTaxTypes.length;
    const activeNonPayeTypes = activeTaxTypes.filter(t => Number(t.taxRate) > 0);
    const isOnlyNonPaye = activeNonPayeTypes.length === 1 && activeNonPayeTypes[0].id === taxType.id;
    const isFirstNonPaye = activeNonPayeTypes.length > 0 && activeNonPayeTypes[0].id === taxType.id;

    // Get tax-related transactions for this tax account (TaxPayment + Tax-SupplierPayment)
    const transactions = await prisma.transaction.findMany({
      where: addBranchFilter(user, {
        tenantId: user.tenantId,
        status: 'posted',
        ...(Object.keys(dateFilter).length > 0 && {
          date: dateFilter,
        }),
        sourceType: { in: ['TaxPayment', 'Tax-SupplierPayment'] },
        lines: {
          some: {
            accountId: taxType.accountId,
          },
        },
      }),
      include: {
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
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    // Calculate totals
    let totalCollected = 0;
    let totalPaid = 0;
    let totalRefunded = 0;

    const isLiability = taxType.account.accountType === 'Liability';
    const isAsset = taxType.account.accountType === 'Asset';

    // Calculate totalCollected from sales
    const salesTransactions = [];
    for (const sale of salesWithTax) {
      for (const item of sale.items) {
        // Check if this item's tax belongs to this tax type and get the specific tax amount
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
          totalCollected += taxAmountForThisType;
          
          // Create a virtual transaction entry for display
          const debitAmt = isAsset ? taxAmountForThisType : 0;
          const creditAmt = isLiability ? taxAmountForThisType : 0;
          salesTransactions.push({
            id: `sale-${sale.id}-${item.id}`,
            reference: sale.saleNumber || `SALE-${sale.id}`,
            date: sale.saleDate,
            description: `Tax Collection - ${sale.saleNumber || 'Sale'}`,
            sourceType: 'Tax-Sale',
            sourceId: sale.id,
            transactionType: 'collected',
            debitAmount: debitAmt,
            creditAmount: creditAmt,
            netAmount: creditAmt - debitAmt, // Standard: credit - debit
            createdBy: 'System',
            runningBalance: 0, // Will be calculated later
          });
        }
      }
    }

    // Process sale-level tax for old sales without SaleItems
    const taxTypeRate = Number(taxType.taxRate);
    if (taxTypeRate > 0) {
      for (const sale of salesWithSaleLevelTax) {
        const saleTaxRate = Number(sale.taxRate || 0);
        const rateMatches = Math.abs(saleTaxRate - taxTypeRate) < 0.01;

        if (rateMatches || isOnlyNonPaye) {
          const taxAmt = Number(sale.taxAmount || 0);
          if (taxAmt > 0) {
            totalCollected += taxAmt;
            const debitAmt = isAsset ? taxAmt : 0;
            const creditAmt = isLiability ? taxAmt : 0;
            salesTransactions.push({
              id: `sale-level-${sale.id}`,
              reference: sale.saleNumber || `SALE-${sale.id}`,
              date: sale.saleDate,
              description: `Tax Collection - ${sale.saleNumber || 'Sale'}`,
              sourceType: 'Tax-Sale',
              sourceId: sale.id,
              transactionType: 'collected',
              debitAmount: debitAmt,
              creditAmount: creditAmt,
              netAmount: creditAmt - debitAmt,
              createdBy: 'System',
              runningBalance: 0,
            });
          }
        }
      }
    }

    // Include tax collected from paid/completed invoices
    if (isOnlyNonPaye || isFirstNonPaye) {
      const invoicesWithTax = await prisma.invoice.findMany({
        where: addBranchFilter(user, {
          tenantId: user.tenantId,
          status: { in: ['Paid', 'paid', 'Completed', 'completed'] },
          refundedAt: null,
          taxAmount: { gt: 0 },
          ...(Object.keys(dateFilter).length > 0 && {
            issueDate: dateFilter,
          }),
        }),
        select: { id: true, invoiceNumber: true, issueDate: true, taxAmount: true },
      });
      for (const inv of invoicesWithTax) {
        const amt = Number(inv.taxAmount || 0);
        if (amt <= 0) continue;
        totalCollected += amt;
        const debitAmt = isAsset ? amt : 0;
        const creditAmt = isLiability ? amt : 0;
        salesTransactions.push({
          id: `invoice-${inv.id}`,
          reference: inv.invoiceNumber || `INV-${inv.id}`,
          date: inv.issueDate,
          description: `Tax Collection - ${inv.invoiceNumber || 'Invoice'}`,
          sourceType: 'Tax-Invoice',
          sourceId: inv.id,
          transactionType: 'collected',
          debitAmount: debitAmt,
          creditAmount: creditAmt,
          netAmount: creditAmt - debitAmt,
          createdBy: 'System',
          runningBalance: 0,
        });
      }
    }

    // ========== TAX PAID FROM PURCHASE ORDERS ==========
    const poTransactions = [];
    try {
      const poItemsWithTax = await prisma.purchaseOrderItem.findMany({
        where: {
          taxTypeId: taxType.id,
          taxAmount: { gt: 0 },
          purchaseOrder: {
            tenantId: user.tenantId,
            status: { notIn: ['Cancelled', 'Draft'] },
            ...(Object.keys(dateFilter).length > 0 && { poDate: dateFilter }),
          },
        },
        include: {
          purchaseOrder: {
            select: { id: true, poNumber: true, poDate: true },
          },
        },
      });

      for (const poItem of poItemsWithTax) {
        const po = poItem.purchaseOrder;
        if (!po) continue;
        const taxAmt = Number(poItem.taxAmount || 0);
        if (taxAmt > 0) {
          totalPaid += taxAmt;
          const debitAmt = isLiability ? taxAmt : 0;
          const creditAmt = isAsset ? taxAmt : 0;
          poTransactions.push({
            id: `po-${po.id}-${poItem.id}`,
            reference: po.poNumber || `PO-${po.id}`,
            date: po.poDate,
            description: `Tax Paid - ${po.poNumber || 'Purchase Order'}`,
            sourceType: 'Tax-PurchaseOrder',
            sourceId: po.id,
            transactionType: 'paid',
            debitAmount: debitAmt,
            creditAmount: creditAmt,
            netAmount: creditAmt - debitAmt,
            createdBy: 'System',
            runningBalance: 0,
          });
        }
      }
    } catch (err) {
      console.warn('Tax balance detail: PO items query failed', err?.message);
    }

    // ========== TAX PAID FROM EXPENSES ==========
    const expenseTransactions = [];
    try {
      const taxTypeRate = Number(taxType.taxRate);
      const isOnlyNonPayeType = activeNonPayeTypes.length === 1 && activeNonPayeTypes[0].id === taxType.id;

      const expensesWithTax = await prisma.expense.findMany({
        where: addBranchFilter(user, {
          tenantId: user.tenantId,
          OR: [
            { taxAmount: { gt: 0 } },
            { taxRate: { gt: 0 } },
          ],
          isDeleted: false,
          ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
        }),
        select: { id: true, description: true, date: true, taxAmount: true, taxRate: true },
      });

      for (const ex of expensesWithTax) {
        const expTaxRate = Number(ex.taxRate || 0);
        const expTaxAmount = Number(ex.taxAmount || 0);
        if (expTaxAmount <= 0) continue;

        const rateMatches = taxTypeRate > 0 && Math.abs(expTaxRate - taxTypeRate) < 0.01;
        const isLegacyData = expTaxRate === 0 && expTaxAmount > 0;

        if (rateMatches || isOnlyNonPayeType || (isLegacyData && isFirstNonPaye && taxTypeRate > 0)) {
          totalPaid += expTaxAmount;
          const debitAmt = isLiability ? expTaxAmount : 0;
          const creditAmt = isAsset ? expTaxAmount : 0;
          expenseTransactions.push({
            id: `expense-${ex.id}`,
            reference: `EXP-${ex.id}`,
            date: ex.date,
            description: `Tax Paid - Expense: ${ex.description || ''}`.trim(),
            sourceType: 'Tax-Expense',
            sourceId: ex.id,
            transactionType: 'paid',
            debitAmount: debitAmt,
            creditAmount: creditAmt,
            netAmount: creditAmt - debitAmt,
            createdBy: 'System',
            runningBalance: 0,
          });
        }
      }
    } catch (err) {
      console.warn('Tax balance detail: Expense query failed', err?.message);
    }

    // Map TaxPayment transactions
    const paymentTransactions = transactions.map(tx => {
      const line = tx.lines[0];
      if (!line) return null;
      
      const netAmount = (line.creditAmount || 0) - (line.debitAmount || 0);
      const debitAmount = line.debitAmount || 0;
      const creditAmount = line.creditAmount || 0;
      
      // Tax payment
      const paymentAmount = isLiability ? debitAmount : creditAmount;
      totalPaid += paymentAmount;

      return {
        id: tx.id,
        reference: tx.reference,
        date: tx.date,
        description: tx.description || line.description,
        sourceType: tx.sourceType,
        sourceId: tx.sourceId,
        transactionType: 'paid',
        debitAmount: line.debitAmount,
        creditAmount: line.creditAmount,
        netAmount,
        createdBy: tx.createdBy?.name || 'System',
        runningBalance: 0, // Will be calculated later
      };
    }).filter(tx => tx !== null);

    // Combine all transaction types
    const allTransactions = [...salesTransactions, ...poTransactions, ...expenseTransactions, ...paymentTransactions];
    
    // Sort by date (oldest first for balance calculation)
    allTransactions.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA - dateB;
    });

    // Calculate running balance chronologically (starting from 0, since we're only showing tax transactions)
    // netAmount = creditAmount - debitAmount
    // For Asset: balance increases with debit, so change = debit - credit = -netAmount
    // For Liability: balance increases with credit, so change = credit - debit = netAmount
    let runningBalance = 0;
    const transactionHistory = allTransactions.map(tx => {
      // Balance before this transaction
      const balanceBefore = runningBalance;
      // Update balance after this transaction
      runningBalance += isAsset ? -tx.netAmount : tx.netAmount;
      return {
        ...tx,
        runningBalance: balanceBefore,
      };
    }).reverse(); // Reverse to show most recent first

    const netPayable = totalCollected - totalPaid - totalRefunded;
    const netDueInPeriod = Math.max(0, netPayable);
    const periodReversalOverhang =
      netPayable < 0 ? Number((-netPayable).toFixed(2)) : 0;

    // Current balance is the final runningBalance after all transactions
    const currentBalance = runningBalance;

    return NextResponse.json({
      taxType: {
        id: taxType.id,
        taxId: taxType.taxId,
        taxName: taxType.taxName,
        taxCode: taxType.taxCode,
        taxRate: taxType.taxRate,
        calculationType: taxType.calculationType,
      },
      account: taxType.account,
      summary: {
        totalCollected,
        totalPaid,
        totalRefunded,
        netPayable,
        netDueInPeriod,
        periodReversalOverhang,
        currentBalance: currentBalance,
      },
      transactionHistory,
      period: startDate && endDate ? { startDate, endDate } : null,
    });
  } catch (error) {
    console.error('Error fetching tax account balance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tax account balance', details: error.message },
      { status: 500 }
    );
  }
}

