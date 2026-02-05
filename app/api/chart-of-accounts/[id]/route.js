// app/api/chart-of-accounts/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'];

const isFinanceAdmin = (user) => {
  const roleName = user?.role?.name?.toLowerCase() || '';
  return roleName.includes('finance') || roleName.includes('admin') || roleName === 'master_admin';
};

const normalizeAccountType = (value) => {
  if (!value) return value;
  const normalized = value.toString().trim();
  const upper = normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
  return ACCOUNT_TYPES.includes(upper) ? upper : normalized;
};

const validateAccountCode = (code) => /^\d{3,10}$/.test(code || '');

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

    if (!isFinanceAdmin(user)) {
      return NextResponse.json(
        { error: 'Access denied. Finance or Admin role required.' },
        { status: 403 }
      );
    }

    if (!isFinanceAdmin(user)) {
      return NextResponse.json(
        { error: 'Access denied. Finance or Admin role required.' },
        { status: 403 }
      );
    }

    if (!isFinanceAdmin(user)) {
      return NextResponse.json(
        { error: 'Access denied. Finance or Admin role required.' },
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
        },
        _count: {
          select: {
            journalEntryLines: true
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

    if (account.isSystem) {
      return NextResponse.json(
        { error: 'System accounts cannot be deleted or deactivated.' },
        { status: 400 }
      );
    }

    if (action === 'usage') {
      const [journalCount, transactionCount] = await Promise.all([
        prisma.journalEntryLine.count({
          where: {
            accountId: account.id,
            journalEntry: {
              status: 'Posted',
              tenantId: user.tenantId
            }
          }
        }),
        prisma.transactionLine.count({
          where: {
            accountId: account.id,
            transaction: {
              status: 'posted',
              tenantId: user.tenantId
            }
          }
        })
      ]);

      return NextResponse.json({
        accountId: account.id,
        journalEntryLines: journalCount,
        transactionLines: transactionCount,
        hasUsage: journalCount > 0 || transactionCount > 0
      });
    }

    // Calculate current balance
    const journalLines = await prisma.journalEntryLine.findMany({
      where: {
        accountId: account.id,
        journalEntry: {
          status: 'Posted',
          tenantId: user.tenantId
        }
      },
      select: {
        debitAmount: true,
        creditAmount: true
      }
    });

    const totalDebits = journalLines.reduce((sum, line) => sum + (line.debitAmount || 0), 0);
    const totalCredits = journalLines.reduce((sum, line) => sum + (line.creditAmount || 0), 0);

    let balance = 0;
    if (account.normalBalance === 'Debit') {
      balance = totalDebits - totalCredits;
    } else {
      balance = totalCredits - totalDebits;
    }

    return NextResponse.json({
      ...account,
      currentBalance: balance,
      transactionCount: account._count.journalEntryLines
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
            status: 'Posted'
          }
        }
      }),
      prisma.transactionLine.count({
        where: {
          accountId: id,
          transaction: {
            status: 'posted'
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

    // Check if account has transactions
    const [journalCount, transactionCount] = await Promise.all([
      prisma.journalEntryLine.count({
        where: {
          accountId: id,
          journalEntry: {
            status: 'Posted'
          }
        }
      }),
      prisma.transactionLine.count({
        where: {
          accountId: id,
          transaction: {
            status: 'posted'
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

