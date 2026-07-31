// app/api/capital-account/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { assertPeriodOpen } from '@/lib/accountingPeriodService';
import {
  resolvePrimaryCapitalAccount,
  getCapitalLedgerBalanceForTransfers,
} from '@/lib/resolveCapitalAccount';
import {
  ensureCapitalParentAccount,
  createContributionSubAccount,
  resolveContributionCashDebitAccount,
  syncCapitalParentRollupBalance,
  OWNERS_CAPITAL_GL_CODE,
  OWNERS_CAPITAL_GL_NAME,
} from '@/lib/capitalCoaHelpers';
import { postGlEntry, AccountingEngineError } from '@/lib/accountingEngine';

// GET - Get capital account information and balance
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const [capitalAccount, settings] = await Promise.all([
      resolvePrimaryCapitalAccount(user.tenantId, prisma),
      prisma.tenantSettings.findUnique({ where: { tenantId: user.tenantId } }),
    ]);

    if (!capitalAccount) {
      return NextResponse.json(
        { error: 'Capital account not found' },
        { status: 404 }
      );
    }

    const ledgerBalance = await getCapitalLedgerBalanceForTransfers(user.tenantId, prisma);
    const ownerContributedCapital = Number(settings?.ownerContributedCapital) || 0;

    // Get recent transfers from capital account
    const recentTransfers = await prisma.payment.findMany({
      where: {
        tenantId: user.tenantId,
        type: 'transfer',
        OR: [
          { sourceAccount: capitalAccount.id },
          { destinationAccount: capitalAccount.id }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true
          }
        }
      }
    });

    // Get capital account balance history (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const balanceHistory = await prisma.accountBalance.findMany({
      where: {
        tenantId: user.tenantId,
        account: capitalAccount.id,
        updatedAt: { gte: thirtyDaysAgo }
      },
      orderBy: { updatedAt: 'asc' }
    });

    return NextResponse.json({
      ownerContributedCapital,
      glAccount: {
        id: capitalAccount.id,
        code: capitalAccount.accountCode || capitalAccount.code || OWNERS_CAPITAL_GL_CODE,
        name: capitalAccount.accountName || capitalAccount.name || OWNERS_CAPITAL_GL_NAME,
        parentCode: '3000',
        parentName: 'Equity',
      },
      capitalAccount: {
        id: capitalAccount.id,
        code: capitalAccount.code || capitalAccount.accountCode,
        accountCode: capitalAccount.accountCode || capitalAccount.code,
        name: capitalAccount.name || capitalAccount.accountName,
        type: capitalAccount.type,
        balance: ledgerBalance,
        isActive: capitalAccount.isActive,
        glLinked: (capitalAccount.accountCode || capitalAccount.code) === OWNERS_CAPITAL_GL_CODE,
      },
      recentTransfers: recentTransfers.map(transfer => ({
        id: transfer.id,
        amount: transfer.amount,
        type: transfer.sourceAccount === capitalAccount.id ? 'outgoing' : 'incoming',
        date: transfer.paymentDate,
        reference: transfer.reference,
        notes: transfer.notes,
        destinationAccount: transfer.destinationAccount,
        sourceAccount: transfer.sourceAccount
      })),
      balanceHistory: balanceHistory.map(record => ({
        date: record.updatedAt,
        balance: record.balance
      }))
    });
  } catch (error) {
    console.error('Error fetching capital account:', error);
    return NextResponse.json(
      { error: 'Failed to fetch capital account information' },
      { status: 500 }
    );
  }
}

// PUT - Update capital account details
export async function PUT(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, code, isActive } = body;

    const capitalAccount = await resolvePrimaryCapitalAccount(user.tenantId, prisma);

    if (!capitalAccount) {
      return NextResponse.json(
        { error: 'Capital account not found' },
        { status: 404 }
      );
    }

    if (capitalAccount.isSystem) {
      return NextResponse.json(
        { error: "Owner's Capital (3100) cannot be renamed or deactivated from this screen." },
        { status: 400 }
      );
    }

    // Validate code uniqueness if changing
    if (code && code !== capitalAccount.code) {
      const existingAccount = await prisma.account.findFirst({
        where: {
          tenantId: user.tenantId,
          code: code,
          id: { not: capitalAccount.id }
        }
      });

      if (existingAccount) {
        return NextResponse.json(
          { error: 'Account code already exists' },
          { status: 400 }
        );
      }
    }

    // Update capital account
    const updatedAccount = await prisma.account.update({
      where: { id: capitalAccount.id },
      data: {
        ...(name && { name }),
        ...(code && { code }),
        ...(typeof isActive === 'boolean' && { isActive }),
        updatedAt: new Date()
      }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'CAPITAL_ACCOUNT_UPDATED',
        entityType: 'ACCOUNT',
        entityId: capitalAccount.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          previousData: {
            name: capitalAccount.name,
            code: capitalAccount.code,
            isActive: capitalAccount.isActive
          },
          newData: {
            name: updatedAccount.name,
            code: updatedAccount.code,
            isActive: updatedAccount.isActive
          }
        })
      }
    });

    return NextResponse.json({
      message: 'Capital account updated successfully',
      capitalAccount: updatedAccount
    });
  } catch (error) {
    console.error('Error updating capital account:', error);
    return NextResponse.json(
      { error: 'Failed to update capital account' },
      { status: 500 }
    );
  }
}

// DELETE - Delete capital account (with safety checks)
export async function DELETE(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const capitalAccount = await resolvePrimaryCapitalAccount(user.tenantId, prisma);

    if (!capitalAccount) {
      return NextResponse.json(
        { error: 'Capital account not found' },
        { status: 404 }
      );
    }

    if (capitalAccount.isSystem) {
      return NextResponse.json(
        { error: "The primary Owner's Capital account (3100) cannot be deleted." },
        { status: 400 }
      );
    }

    const ledgerBal = await getCapitalLedgerBalanceForTransfers(user.tenantId, prisma);

    // Check if account has balance
    if (ledgerBal > 0) {
      return NextResponse.json(
        { error: 'Cannot delete capital account with positive balance. Please transfer or adjust the balance first.' },
        { status: 400 }
      );
    }

    // Check if account is used in transactions
    const journalEntries = await prisma.journalEntry.findMany({
      where: { accountId: capitalAccount.id }
    });

    if (journalEntries.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete capital account that has been used in transactions' },
        { status: 400 }
      );
    }

    // Delete capital account
    await prisma.account.delete({
      where: { id: capitalAccount.id }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'CAPITAL_ACCOUNT_DELETED',
        entityType: 'ACCOUNT',
        entityId: capitalAccount.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          deletedAccount: {
            name: capitalAccount.name,
            code: capitalAccount.code,
            balance: capitalAccount.balance
          }
        })
      }
    });

    return NextResponse.json({
      message: 'Capital account deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting capital account:', error);
    return NextResponse.json(
      { error: 'Failed to delete capital account' },
      { status: 500 }
    );
  }
}

// POST - Set initial capital balance (posts under 3100 via contribution sub-account 3101+)
export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { initialBalance, cashAccountId } = body;

    const parsedAmount = parseFloat(initialBalance);
    if (!initialBalance || isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: 'Valid initial balance is required' },
        { status: 400 }
      );
    }

    const parentCapital = await ensureCapitalParentAccount(user.tenantId, prisma);
    const equityAccountForCredit = await createContributionSubAccount(
      user.tenantId,
      parentCapital,
      prisma,
      'Initial capital balance'
    );

    const cashAccount = await resolveContributionCashDebitAccount(
      user.tenantId,
      cashAccountId,
      prisma
    );
    if (!cashAccount) {
      return NextResponse.json(
        { error: 'Could not resolve cash GL account (1110) for initial capital debit.' },
        { status: 404 }
      );
    }

    const entryDate = new Date();
    await assertPeriodOpen(user.tenantId, entryDate, prisma);

    const reference = 'INIT-CAP';
    const txDescription = 'Initial capital contribution';

    const capitalLines = [
      {
        lineNumber: 1,
        accountId: cashAccount.id,
        debitAmount: parsedAmount,
        creditAmount: 0,
        description: txDescription,
      },
      {
        lineNumber: 2,
        accountId: equityAccountForCredit.id,
        debitAmount: 0,
        creditAmount: parsedAmount,
        description: txDescription,
      },
    ];
    const { postCapitalContributionAccounting } = await import(
      '@/lib/accountingV2/adapters/remainingAdapters.js'
    );
    const transaction = (
      await postCapitalContributionAccounting({
        db: prisma,
        tenantId: user.tenantId,
        userId: user.id,
        sourceType: 'capital_contribution',
        sourceId: reference,
        amount: parsedAmount,
        date: entryDate,
        description: txDescription,
        lines: capitalLines,
        legacyPost: () =>
          postGlEntry({
            tenantId: user.tenantId,
            userId: user.id,
            entryDate,
            description: txDescription,
            reference,
            sourceType: 'capital_contribution',
            sourceId: reference,
            lines: capitalLines,
          }),
      })
    ).result;

    const parentRollupBalance = await syncCapitalParentRollupBalance(
      user.tenantId,
      parentCapital.id,
      prisma
    );

    await prisma.tenantSettings.upsert({
      where: { tenantId: user.tenantId },
      create: {
        tenantId: user.tenantId,
        enabledModules: [],
        ownerContributedCapital: parsedAmount,
      },
      update: {
        ownerContributedCapital: { increment: parsedAmount },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'INITIAL_CAPITAL_SET',
        entityType: 'ACCOUNT',
        entityId: parentCapital.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          initialBalance: parsedAmount,
          capitalParentGlCode: OWNERS_CAPITAL_GL_CODE,
          contributionAccountCode: equityAccountForCredit.accountCode,
          cashAccountId: cashAccount.id,
          cashAccountName: cashAccount.accountName || cashAccount.name,
          transactionId: transaction.id,
        }),
      },
    });

    return NextResponse.json(
      {
        message: 'Initial capital balance set successfully',
        capitalAccount: {
          id: parentCapital.id,
          code: OWNERS_CAPITAL_GL_CODE,
          name: OWNERS_CAPITAL_GL_NAME,
          balance: parentRollupBalance,
          contributionAccountCode: equityAccountForCredit.accountCode,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AccountingEngineError || error.message?.includes('period') || error.message?.includes('closed')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error setting initial capital:', error);
    return NextResponse.json(
      { error: 'Failed to set initial capital balance' },
      { status: 500 }
    );
  }
} 