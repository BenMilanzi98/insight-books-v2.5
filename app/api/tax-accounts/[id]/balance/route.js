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

    // Calculate tax collected from SALES (since tax transactions don't exist)
    // Query sales with items that have tax for this tax type
    const salesWithTax = await prisma.sale.findMany({
      where: addBranchFilter(user, {
        tenantId: user.tenantId,
        status: { in: ['completed', 'paid'] },
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

    // Get only tax-related transactions for this tax account (TaxPayment)
    const transactions = await prisma.transaction.findMany({
      where: addBranchFilter(user, {
        tenantId: user.tenantId,
        status: 'posted',
        ...(Object.keys(dateFilter).length > 0 && {
          date: dateFilter,
        }),
        sourceType: 'TaxPayment',
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
        // Check if this item's tax belongs to this tax type
        let shouldCount = false;
        
        if (item.itemTaxes && item.itemTaxes.length > 0) {
          shouldCount = item.itemTaxes.some(it => it.taxTypeId === taxType.id);
        } else if (item.product && item.product.productTaxes && item.product.productTaxes.length > 0) {
          shouldCount = item.product.productTaxes.some(pt => pt.taxTypeId === taxType.id);
        } else {
          // Fallback: If there's only one active tax type, assume it's this one
          shouldCount = activeTaxTypeCount === 1;
        }

        if (shouldCount && item.taxAmount > 0) {
          totalCollected += item.taxAmount;
          
          // Create a virtual transaction entry for display
          const debitAmt = isAsset ? item.taxAmount : 0;
          const creditAmt = isLiability ? item.taxAmount : 0;
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

    // Combine sales transactions and payment transactions
    const allTransactions = [...salesTransactions, ...paymentTransactions];
    
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

