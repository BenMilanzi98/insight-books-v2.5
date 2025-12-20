// app/api/chart-of-accounts/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

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

    const { id } = params;

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

    // Check if account has transactions (can't change certain fields)
    const hasTransactions = await prisma.journalEntryLine.count({
      where: {
        accountId: id,
        journalEntry: {
          status: 'Posted'
        }
      }
    }) > 0;

    if (hasTransactions) {
      // Can't change account type or normal balance if there are transactions
      if (body.accountType && body.accountType !== existingAccount.accountType) {
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
    }

    // Validate account code uniqueness if changed
    if (body.accountCode && body.accountCode !== existingAccount.accountCode) {
      if (!/^\d+$/.test(body.accountCode)) {
        return NextResponse.json(
          { error: 'Account code must be numeric only' },
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

        if (parentAccount.accountType !== (body.accountType || existingAccount.accountType)) {
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

    const updatedAccount = await prisma.account.update({
      where: { id },
      data: {
        accountCode: body.accountCode,
        accountName: body.accountName,
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
    const hasTransactions = await prisma.journalEntryLine.count({
      where: {
        accountId: id,
        journalEntry: {
          status: 'Posted'
        }
      }
    }) > 0;

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

