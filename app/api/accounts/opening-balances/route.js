// app/api/accounts/opening-balances/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { validateTransactionBalance, validateBalanceSheetEquation } from '@/lib/accountingValidation';
import { assertPeriodOpen } from '@/lib/accountingPeriodService';
import { mergeWizardStep } from '@/lib/setupWizardService';
import { postGlEntry } from '@/lib/accountingEngine/postGlEntry';
import { resolveOpeningBalanceEquityAccount } from '@/lib/openingBalanceEquityAccount';
import { validateOpeningBalanceAccount } from '@/lib/openingBalanceService';
import { buildOpeningBalanceIdempotencyKey } from '@/lib/postingRules/openingBalancePostingRules';
import { assertOpeningBalancesEditable } from '@/lib/openingBalanceLock';
import { logOpeningBalanceAudit } from '@/lib/openingBalanceAudit';

/**
 * Balancing leg for opening entries: Opening Balance Equity (3190).
 */
async function resolveOpeningBalancePlugAccount(tenantId, tx) {
  return resolveOpeningBalanceEquityAccount(tenantId, tx);
}

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

    // Get or create Opening Balance Equity account (3190)
    const openingBalancesEquity = await resolveOpeningBalanceEquityAccount(user.tenantId, prisma);

    return NextResponse.json({
      accounts: accountsWithBalances,
      openingBalancesEquity: {
        id: openingBalancesEquity.id,
        accountCode: openingBalancesEquity.accountCode,
        accountName: openingBalancesEquity.accountName || openingBalancesEquity.name,
      },
      capitalOffsetAccount: {
        id: openingBalancesEquity.id,
        accountCode: openingBalancesEquity.accountCode,
        accountName: openingBalancesEquity.accountName || openingBalancesEquity.name,
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

    // Hard-stop: prior implementation deleted posted Opening journals without reversing
    // Account.balance updates from postGlEntry, corrupting COA balances on re-post.
    return NextResponse.json(
      {
        error:
          'Legacy opening-balance posting is disabled to prevent balance corruption. Use /api/accounting-v2/opening-balances.',
        code: 'LEGACY_OPENING_BALANCE_DISABLED',
      },
      { status: 410 }
    );

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
        continue;
      }

      const account = accountMap.get(accountId);
      if (!account) continue;

      if (amountNum < 0) {
        return NextResponse.json(
          { error: `Opening amount for ${account.accountName} must be greater than zero.` },
          { status: 400 },
        );
      }

      try {
        validateOpeningBalanceAccount(account);
      } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }

      let debitAmount = 0;
      let creditAmount = 0;

      if (account.accountType === 'Asset' || account.accountType === 'Expense') {
        debitAmount = amountNum;
      } else {
        creditAmount = amountNum;
      }

      transactionLines.push({
        accountId,
        debitAmount,
        creditAmount,
        description: `Opening balance — ${account.accountName}`,
      });

      totalDebits += debitAmount;
      totalCredits += creditAmount;
    }

    // Validate transaction balances
    const balanceValidation = validateTransactionBalance(transactionLines);
    if (!balanceValidation.isValid) {
      const difference = balanceValidation.totalDebits - balanceValidation.totalCredits;
      const equityPlug = await resolveOpeningBalancePlugAccount(user.tenantId, prisma);

      if (difference > 0) {
        transactionLines.push({
          accountId: equityPlug.id,
          debitAmount: 0,
          creditAmount: difference,
          description: 'Opening Balance Equity (balancing)',
        });
        totalCredits += difference;
      } else if (difference < 0) {
        transactionLines.push({
          accountId: equityPlug.id,
          debitAmount: Math.abs(difference),
          creditAmount: 0,
          description: 'Opening Balance Equity (balancing)',
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

    const entryDate = date ? new Date(date) : new Date();
    await assertOpeningBalancesEditable(user.tenantId, prisma);
    await assertPeriodOpen(user.tenantId, entryDate, prisma);

    const bulkSourceId = buildOpeningBalanceIdempotencyKey({
      tenantId: user.tenantId,
      type: 'opening_bulk',
      accountId: 'bulk',
      asOfDate: entryDate,
    });

    const result = await prisma.$transaction(async (tx) => {
      await tx.transaction.deleteMany({
        where: {
          tenantId: user.tenantId,
          entryType: 'Opening',
          status: 'posted',
          sourceType: { in: ['OpeningBalance', 'onboarding'] },
        },
      });

      const transaction = await postGlEntry({
        tenantId: user.tenantId,
        userId: user.id,
        entryDate,
        description: 'Opening balances — onboarding',
        sourceType: 'onboarding',
        sourceId: bulkSourceId,
        entryType: 'Opening',
        lines: transactionLines,
        tx,
      });

      try {
        await tx.transaction.update({
          where: { id: transaction.id },
          data: { notes: JSON.stringify({ openingBalanceType: 'opening_bulk' }) },
        });
      } catch {
        /* notes optional */
      }

      const allAccounts = await tx.account.findMany({
        where: { tenantId: user.tenantId, isActive: true },
        select: { id: true, accountType: true, balance: true },
      });

      const assetTotal = allAccounts
        .filter((a) => a.accountType === 'Asset')
        .reduce((sum, a) => sum + parseFloat(a.balance || 0), 0);
      const liabilityTotal = Math.max(
        0,
        allAccounts
          .filter((a) => a.accountType === 'Liability')
          .reduce((sum, a) => sum + parseFloat(a.balance || 0), 0),
      );
      const equityTotal = allAccounts
        .filter((a) => a.accountType === 'Equity')
        .reduce((sum, a) => sum + parseFloat(a.balance || 0), 0);

      const balanceSheetValidation = validateBalanceSheetEquation({
        assetTotal,
        liabilityTotal,
        equityTotal,
      });

      if (!balanceSheetValidation.isValid) {
        throw new Error(
          `Balance sheet does not balance after setting opening balances: ${balanceSheetValidation.error}`,
        );
      }

      return { transaction, balanceSheetValidation };
    });

    try {
      const existingSettings = await prisma.tenantSettings.findUnique({
        where: { tenantId: user.tenantId },
        select: { setupWizardState: true },
      });
      const nextWizard = mergeWizardStep(existingSettings?.setupWizardState, 'complete', 'openingBalancesReview');
      await prisma.tenantSettings.upsert({
        where: { tenantId: user.tenantId },
        create: {
          tenantId: user.tenantId,
          enabledModules: [],
          openingBalancesAsOfDate: entryDate,
          setupWizardState: nextWizard,
        },
        update: {
          openingBalancesAsOfDate: entryDate,
          setupWizardState: nextWizard,
        },
      });
    } catch (wizErr) {
      console.warn('opening-balances: setup wizard state update skipped:', wizErr?.message || wizErr);
    }

    await logOpeningBalanceAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'OPENING_BALANCE_BULK_POSTED',
      entityId: result.transaction.id,
      details: {
        lineCount: transactionLines.length,
        date: entryDate.toISOString(),
      },
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










