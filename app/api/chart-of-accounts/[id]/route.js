// app/api/chart-of-accounts/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import {
  canViewChartOfAccounts,
  canUpdateChartOfAccount,
} from '@/lib/chartOfAccountsAccess';
import { alignAccountDisplayTitleToBlueprint } from '@/lib/coaBlueprintDisplayTitles.js';
import { computeCoaAccountBalanceBreakdown } from '@/lib/coaAccountBalanceBreakdown.js';

const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'];

const normalizeAccountType = (value) => {
  if (!value) return value;
  const normalized = value.toString().trim();
  const upper = normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
  return ACCOUNT_TYPES.includes(upper) ? upper : normalized;
};

const validateAccountCode = (code) => /^\d{3,10}(-\d{2,4})?$/.test(String(code || '').trim());

// GET - Get single account
export async function GET(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated' },
        { status: 401 }
      );
    }

    if (!canViewChartOfAccounts(user)) {
      return NextResponse.json(
        { error: 'Access denied. accounts.view permission required.' },
        { status: 403 }
      );
    }

    const { id } = params;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    const account = await prisma.account.findUnique({
      where: { id },
      include: {
        parentAccount: {
          select: {
            id: true,
            accountCode: true,
            accountName: true
          }
        },
        childAccounts: {
          select: {
            id: true,
            accountCode: true,
            accountName: true,
            isActive: true,
            accountType: true
          }
        }
      }
    });

    if (!account || account.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    const postedJournalStatus = { in: ['Posted', 'posted'] };
    const postedGlTransactionStatus = { in: ['posted', 'Posted'] };

    if (action === 'usage') {
      const [journalCount, glTransactionLineCount] = await Promise.all([
        prisma.journalEntryLine.count({
          where: {
            accountId: account.id,
            journalEntry: {
              status: postedJournalStatus,
              tenantId: user.tenantId
            }
          }
        }),
        prisma.transactionLine.count({
          where: {
            accountId: account.id,
            transaction: {
              status: postedGlTransactionStatus,
              tenantId: user.tenantId
            }
          }
        })
      ]);

      return NextResponse.json({
        accountId: account.id,
        journalEntryLines: journalCount,
        transactionLines: glTransactionLineCount,
        hasUsage: journalCount > 0 || glTransactionLineCount > 0
      });
    }

    const branchId = user.currentBranchId || null;
    const balanceSources = await computeCoaAccountBalanceBreakdown(
      prisma,
      user.tenantId,
      account,
      { branchId, maxInvoiceDetailLines: 50 }
    );

    const balance = balanceSources.displayedRowTotal;
    const journalLineCount = balanceSources.components.find((c) => c.id === 'posted_journal_lines')?.lineCount ?? 0;
    const glTransactionLineCount =
      balanceSources.components.find((c) => c.id === 'posted_transaction_lines')?.lineCount ?? 0;

    const aligned = alignAccountDisplayTitleToBlueprint(account);

    return NextResponse.json({
      ...aligned,
      currentBalance: balance,
      postedDirectBalance: balance,
      postedGlNet: balanceSources.postedGlNet,
      balanceSource: balanceSources.balanceSource,
      transactionCount: journalLineCount + glTransactionLineCount,
      balanceSources,
    });
  } catch (error) {
    console.error('Error fetching account:', error);
    return NextResponse.json(
      { error: 'Failed to fetch account', details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update account
export async function PUT(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated' },
        { status: 401 }
      );
    }

    try {
      const { assertTenantCoaUnlocked } = await import('@/lib/coaTenantLock');
      await assertTenantCoaUnlocked(user.tenantId);
    } catch (lockErr) {
      if (lockErr?.code === 'COA_TENANT_LOCKED') {
        return NextResponse.json({ error: lockErr.message, code: lockErr.code }, { status: 423 });
      }
      throw lockErr;
    }

    const { id } = params;
    const body = await request.json();

    // Check if account exists and belongs to tenant
    const existingAccount = await prisma.account.findUnique({
      where: { id }
    });

    if (!existingAccount || existingAccount.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    if (!canUpdateChartOfAccount(user)) {
      return NextResponse.json(
        { error: 'Access denied. accounts.update permission required.' },
        { status: 403 }
      );
    }

    if (existingAccount.isSystem) {
      return NextResponse.json(
        { error: 'System accounts are read-only.' },
        { status: 400 }
      );
    }

    const [journalCount, transactionCount] = await Promise.all([
      prisma.journalEntryLine.count({
        where: {
          accountId: id,
          journalEntry: {
            status: { in: ['Posted', 'posted'] },
            tenantId: user.tenantId,
          }
        }
      }),
      prisma.transactionLine.count({
        where: {
          accountId: id,
          transaction: {
            status: { in: ['posted', 'Posted'] },
            tenantId: user.tenantId,
          }
        }
      })
    ]);
    const hasTransactions = journalCount > 0 || transactionCount > 0;

    if (hasTransactions) {
      if (body.accountType && normalizeAccountType(body.accountType) !== existingAccount.accountType) {
        return NextResponse.json(
          { error: 'Cannot change account type for accounts with existing transactions' },
          { status: 400 }
        );
      }

      if (body.normalBalance && body.normalBalance !== existingAccount.normalBalance) {
        return NextResponse.json(
          { error: 'Cannot change normal balance for accounts with existing transactions' },
          { status: 400 }
        );
      }

      if (body.accountCode && body.accountCode !== existingAccount.accountCode) {
        return NextResponse.json(
          { error: 'Cannot change account code for accounts with existing transactions' },
          { status: 400 }
        );
      }

      if (body.accountName && body.accountName !== existingAccount.accountName) {
        return NextResponse.json(
          { error: 'Cannot change account name for accounts with existing transactions' },
          { status: 400 }
        );
      }
    }

    // Validate account code uniqueness if changed
    if (body.accountCode && body.accountCode !== existingAccount.accountCode) {
      if (!validateAccountCode(body.accountCode)) {
        return NextResponse.json(
          { error: 'Account code must be numeric (3-10 digits).' },
          { status: 400 }
        );
      }

      // Check if account code already exists for this tenant
      const codeExists = await prisma.account.findFirst({
        where: {
          tenantId: user.tenantId,
          accountCode: body.accountCode,
          id: { not: id } // Exclude the current account
        }
      });

      if (codeExists) {
        return NextResponse.json(
          { error: 'Account code must be unique' },
          { status: 400 }
        );
      }
    }

    // Validate parent account if provided
    if (body.parentAccountId !== undefined) {
      if (body.parentAccountId) {
        const parentAccount = await prisma.account.findUnique({
          where: { id: body.parentAccountId }
        });

        if (!parentAccount || parentAccount.tenantId !== user.tenantId) {
          return NextResponse.json(
            { error: 'Invalid parent account' },
            { status: 400 }
          );
        }

      const normalizedType = normalizeAccountType(body.accountType) || existingAccount.accountType;
      if (parentAccount.accountType !== normalizedType) {
          return NextResponse.json(
            { error: 'Parent account must be of the same type' },
            { status: 400 }
          );
        }

        // Prevent circular reference
        if (body.parentAccountId === id) {
          return NextResponse.json(
            { error: 'Account cannot be its own parent' },
            { status: 400 }
          );
        }
      }
    }

    const normalizedType = body.accountType ? normalizeAccountType(body.accountType) : undefined;
    if (normalizedType && !ACCOUNT_TYPES.includes(normalizedType)) {
      return NextResponse.json(
        { error: `Invalid account type. Expected one of: ${ACCOUNT_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    const updatedAccount = await prisma.account.update({
      where: { id },
      data: {
        accountCode: body.accountCode,
        accountName: body.accountName,
        accountType: normalizedType,
        accountSubtype: body.accountSubtype,
        parentAccountId: body.parentAccountId !== undefined ? (body.parentAccountId || null) : undefined,
        description: body.description,
        isActive: body.isActive
      },
      include: {
        parentAccount: {
          select: {
            id: true,
            accountCode: true,
            accountName: true
          }
        }
      }
    });

    return NextResponse.json({
      account: updatedAccount,
      message: 'Account updated successfully'
    });
  } catch (error) {
    console.error('Error updating account:', error);
    return NextResponse.json(
      { error: 'Failed to update account', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Deactivate account (soft delete)
export async function DELETE(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated' },
        { status: 401 }
      );
    }

    try {
      const { assertTenantCoaUnlocked } = await import('@/lib/coaTenantLock');
      await assertTenantCoaUnlocked(user.tenantId);
    } catch (lockErr) {
      if (lockErr?.code === 'COA_TENANT_LOCKED') {
        return NextResponse.json({ error: lockErr.message, code: lockErr.code }, { status: 423 });
      }
      throw lockErr;
    }

    const { id } = params;

    const account = await prisma.account.findUnique({
      where: { id }
    });

    if (!account || account.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    if (!canUpdateChartOfAccount(user)) {
      return NextResponse.json(
        { error: 'Access denied. accounts.update permission required.' },
        { status: 403 }
      );
    }

    // Check if account has transactions
    const [journalCount, transactionCount] = await Promise.all([
      prisma.journalEntryLine.count({
        where: {
          accountId: id,
          journalEntry: {
            status: { in: ['Posted', 'posted'] },
            tenantId: user.tenantId,
          }
        }
      }),
      prisma.transactionLine.count({
        where: {
          accountId: id,
          transaction: {
            status: { in: ['posted', 'Posted'] },
            tenantId: user.tenantId,
          }
        }
      })
    ]);
    const hasTransactions = journalCount > 0 || transactionCount > 0;

    if (hasTransactions) {
      // Deactivate instead of delete
      const updatedAccount = await prisma.account.update({
        where: { id },
        data: { isActive: false }
      });

      return NextResponse.json({
        account: updatedAccount,
        message: 'Account deactivated. Cannot delete accounts with existing transactions.'
      });
    }

    // Check if account has child accounts
    const hasChildren = await prisma.account.count({
      where: {
        parentAccountId: id
      }
    }) > 0;

    if (hasChildren) {
      return NextResponse.json(
        { error: 'Cannot delete account with child accounts. Please remove or reassign child accounts first.' },
        { status: 400 }
      );
    }

    if (account.mergedIntoAccountId) {
      return NextResponse.json(
        {
          error:
            'Cannot remove a merged source account from the database. It is kept for auditing; only the surviving account appears in the chart.',
        },
        { status: 400 }
      );
    }

    const mergedIntoThis = await prisma.account.count({
      where: { mergedIntoAccountId: id, tenantId: user.tenantId },
    });
    if (mergedIntoThis > 0) {
      return NextResponse.json(
        {
          error:
            'Cannot delete this account while other accounts are merged into it. Those rows are kept for audit; deactivate this account instead if needed.',
        },
        { status: 400 }
      );
    }

    // Safe to delete
    await prisma.account.delete({
      where: { id }
    });

    return NextResponse.json({
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    return NextResponse.json(
      { error: 'Failed to delete account', details: error.message },
      { status: 500 }
    );
  }
}

