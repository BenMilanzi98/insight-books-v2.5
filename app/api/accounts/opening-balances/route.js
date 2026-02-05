// app/api/accounts/opening-balances/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { generateReferenceNumber } from '@/lib/journalService';
import { validateTransactionBalance, validateBalanceSheetEquation } from '@/lib/accountingValidation';
import { updateAccountBalanceOnTransaction } from '@/lib/accountBalanceService';
import { assertPeriodOpen } from '@/lib/accountingPeriodService';

/**
 * GET /api/accounts/opening-balances
 * Get accounts with their current balances for opening balance setup
 */
export async function GET(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const accountType = searchParams.get('accountType'); // Optional filter

    const where = {
      tenantId: user.tenantId,
      isActive: true,
    };

    if (accountType) {
      where.accountType = accountType;
    }

    // Get all active accounts
    const accounts = await prisma.account.findMany({
      where,
      select: {
        id: true,
        accountCode: true,
        accountName: true,
        accountType: true,
        normalBalance: true,
        balance: true,
        parentAccountId: true,
        parentAccount: {
          select: {
            id: true,
            accountCode: true,
            accountName: true,
          },
        },
      },
      orderBy: [
        { accountType: 'asc' },
        { accountCode: 'asc' },
      ],
    });

    // Check for existing opening balance transactions
    const openingBalanceTransactions = await prisma.transaction.findMany({
      where: {
        tenantId: user.tenantId,
        entryType: 'Opening',
        status: 'posted',
      },
      include: {
        lines: {
          include: {
            account: {
              select: {
                id: true,
                accountCode: true,
                accountName: true,
              },
            },
          },
        },
      },
    });

    // Map accounts with their opening balances
    const accountsWithBalances = accounts.map(account => {
      // Find opening balance for this account
      let openingBalance = 0;
      for (const transaction of openingBalanceTransactions) {
        for (const line of transaction.lines) {
          if (line.accountId === account.id) {
            if (account.accountType === 'Asset' || account.accountType === 'Expense') {
              openingBalance += (line.debitAmount || 0) - (line.creditAmount || 0);
            } else {
              openingBalance += (line.creditAmount || 0) - (line.debitAmount || 0);
            }
          }
        }
      }

      return {
        ...account,
        currentBalance: account.balance || 0,
        openingBalance,
        hasOpeningBalance: openingBalance !== 0,
      };
    });

    // Get or create Opening Balances Equity account
    let openingBalancesEquity = await prisma.account.findFirst({
      where: {
        tenantId: user.tenantId,
        OR: [
          { accountName: { contains: 'Opening Balances Equity', mode: 'insensitive' } },
          { accountCode: '3000' }, // Common equity account code
        ],
        accountType: 'Equity',
        isActive: true,
      },
    });

    if (!openingBalancesEquity) {
      openingBalancesEquity = await prisma.account.create({
        data: {
          tenantId: user.tenantId,
          accountCode: '3000',
          accountName: 'Opening Balances Equity',
          accountType: 'Equity',
          normalBalance: 'Credit',
          isActive: true,
          balance: 0,
        },
      });
    }

    return NextResponse.json({
      accounts: accountsWithBalances,
      openingBalancesEquity: {
        id: openingBalancesEquity.id,
        accountCode: openingBalancesEquity.accountCode,
        accountName: openingBalancesEquity.accountName,
      },
      summary: {
        totalAccounts: accounts.length,
        accountsWithOpeningBalances: accountsWithBalances.filter(a => a.hasOpeningBalance).length,
      },
    });
  } catch (error) {
    console.error('Error fetching opening balances:', error);
    return NextResponse.json(
      { error: 'Failed to fetch opening balances', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/accounts/opening-balances
 * Set opening balances for accounts
 * Body: {
 *   balances: [{ accountId, amount }],
 *   date: "2024-01-01" (optional, defaults to today)
 * }
 */
export async function POST(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { balances, date } = body;

    if (!balances || !Array.isArray(balances) || balances.length === 0) {
      return NextResponse.json(
        { error: 'Opening balances array is required' },
        { status: 400 }
      );
    }

    // Validate all accounts exist and belong to tenant
    const accountIds = balances.map(b => b.accountId).filter(Boolean);
    if (accountIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one account balance is required' },
        { status: 400 }
      );
    }

    const accounts = await prisma.account.findMany({
      where: {
        id: { in: accountIds },
        tenantId: user.tenantId,
        isActive: true,
      },
    });

    if (accounts.length !== accountIds.length) {
      return NextResponse.json(
        { error: 'One or more accounts not found or inactive' },
        { status: 400 }
      );
    }

    // Create account map for quick lookup
    const accountMap = new Map(accounts.map(acc => [acc.id, acc]));

    // Build transaction lines
    const transactionLines = [];
    let totalDebits = 0;
    let totalCredits = 0;

    for (const balanceEntry of balances) {
      const { accountId, amount } = balanceEntry;
      const amountNum = parseFloat(amount || 0);

      if (!accountId || amountNum === 0) {
        continue; // Skip zero balances
      }

      const account = accountMap.get(accountId);
      if (!account) {
        continue;
      }

      // Determine debit/credit based on account type and amount
      // Assets and Expenses: positive = debit, negative = credit
      // Liabilities, Equity, Revenue: positive = credit, negative = debit
      let debitAmount = 0;
      let creditAmount = 0;

      if (account.accountType === 'Asset' || account.accountType === 'Expense') {
        if (amountNum > 0) {
          debitAmount = amountNum;
        } else {
          creditAmount = Math.abs(amountNum);
        }
      } else {
        // Liability, Equity, Revenue
        if (amountNum > 0) {
          creditAmount = amountNum;
        } else {
          debitAmount = Math.abs(amountNum);
        }
      }

      transactionLines.push({
        accountId,
        debitAmount,
        creditAmount,
        description: `Opening balance - ${account.accountName}`,
      });

      totalDebits += debitAmount;
      totalCredits += creditAmount;
    }

    // Validate transaction balances
    const balanceValidation = validateTransactionBalance(transactionLines);
    if (!balanceValidation.isValid) {
      // If not balanced, create offsetting entry to Opening Balances Equity
      const difference = balanceValidation.totalDebits - balanceValidation.totalCredits;

      // Get or create Opening Balances Equity account
      let openingBalancesEquity = await prisma.account.findFirst({
        where: {
          tenantId: user.tenantId,
          OR: [
            { accountName: { contains: 'Opening Balances Equity', mode: 'insensitive' } },
            { accountCode: '3000' },
          ],
          accountType: 'Equity',
          isActive: true,
        },
      });

      if (!openingBalancesEquity) {
        openingBalancesEquity = await prisma.account.create({
          data: {
            tenantId: user.tenantId,
            accountCode: '3000',
            accountName: 'Opening Balances Equity',
            accountType: 'Equity',
            normalBalance: 'Credit',
            isActive: true,
            balance: 0,
          },
        });
      }

      // Add offsetting entry
      if (difference > 0) {
        // More debits than credits, credit equity
        transactionLines.push({
          accountId: openingBalancesEquity.id,
          debitAmount: 0,
          creditAmount: difference,
          description: 'Opening Balances Equity - Balancing entry',
        });
        totalCredits += difference;
      } else if (difference < 0) {
        // More credits than debits, debit equity
        transactionLines.push({
          accountId: openingBalancesEquity.id,
          debitAmount: Math.abs(difference),
          creditAmount: 0,
          description: 'Opening Balances Equity - Balancing entry',
        });
        totalDebits += Math.abs(difference);
      }
    }

    // Final validation
    const finalValidation = validateTransactionBalance(transactionLines);
    if (!finalValidation.isValid) {
      return NextResponse.json(
        { error: `Transaction does not balance: ${finalValidation.error}` },
        { status: 400 }
      );
    }

    // Create opening balance transaction
    const entryDate = date ? new Date(date) : new Date();
    await assertPeriodOpen(user.tenantId, entryDate, prisma);
    const referenceNumber = await generateReferenceNumber(prisma, user.tenantId, entryDate);

    const result = await prisma.$transaction(async (tx) => {
      // Delete any existing opening balance transactions (allow re-setting)
      await tx.transaction.deleteMany({
        where: {
          tenantId: user.tenantId,
          entryType: 'Opening',
          status: 'posted',
        },
      });

      // Create new opening balance transaction
      const transaction = await tx.transaction.create({
        data: {
          tenantId: user.tenantId,
          date: entryDate,
          description: 'Opening Balances',
          reference: referenceNumber,
          entryType: 'Opening',
          status: 'posted',
          sourceType: 'OpeningBalance',
          createdById: user.id,
          postedById: user.id,
          postedDate: new Date(),
          lines: {
            create: transactionLines.map((line, index) => ({
              lineNumber: index + 1,
              accountId: line.accountId,
              debitAmount: line.debitAmount,
              creditAmount: line.creditAmount,
              description: line.description,
            })),
          },
        },
        include: {
          lines: {
            include: {
              account: {
                select: {
                  id: true,
                  accountCode: true,
                  accountName: true,
                  accountType: true,
                },
              },
            },
          },
        },
      });

      // Update account balances
      for (const line of transaction.lines) {
        await updateAccountBalanceOnTransaction(
          line.accountId,
          line.debitAmount,
          line.creditAmount,
          tx
        );
      }

      // Validate balance sheet equation
      const allAccounts = await tx.account.findMany({
        where: {
          tenantId: user.tenantId,
          isActive: true,
        },
        select: {
          id: true,
          accountType: true,
          balance: true,
        },
      });

      const assetTotal = allAccounts
        .filter(a => a.accountType === 'Asset')
        .reduce((sum, a) => sum + parseFloat(a.balance || 0), 0);

      const liabilityTotal = allAccounts
        .filter(a => a.accountType === 'Liability')
        .reduce((sum, a) => sum + parseFloat(a.balance || 0), 0);

      const equityTotal = allAccounts
        .filter(a => a.accountType === 'Equity')
        .reduce((sum, a) => sum + parseFloat(a.balance || 0), 0);

      const balanceSheetValidation = validateBalanceSheetEquation({
        assetTotal,
        liabilityTotal,
        equityTotal,
      });

      if (!balanceSheetValidation.isValid) {
        throw new Error(
          `Balance sheet does not balance after setting opening balances: ${balanceSheetValidation.error}`
        );
      }

      return {
        transaction,
        balanceSheetValidation,
      };
    });

    return NextResponse.json({
      message: 'Opening balances set successfully',
      transaction: {
        id: result.transaction.id,
        reference: result.transaction.reference,
        date: result.transaction.date,
        description: result.transaction.description,
        lines: result.transaction.lines.map(line => ({
          accountCode: line.account.accountCode,
          accountName: line.account.accountName,
          debitAmount: line.debitAmount,
          creditAmount: line.creditAmount,
        })),
      },
      balanceSheetValidation: result.balanceSheetValidation,
    }, { status: 201 });
  } catch (error) {
    console.error('Error setting opening balances:', error);
    return NextResponse.json(
      { error: 'Failed to set opening balances', details: error.message },
      { status: 500 }
    );
  }
}










