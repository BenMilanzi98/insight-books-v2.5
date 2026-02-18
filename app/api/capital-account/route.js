// app/api/capital-account/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { assertPeriodOpen } from '@/lib/accountingPeriodService';

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

    // Find capital account - check both accountType and type fields for compatibility
    const capitalAccount = await prisma.account.findFirst({
      where: {
        tenantId: user.tenantId,
        isActive: true,
        AND: [
          {
            OR: [
              { accountType: 'Equity' },
              { accountType: 'EQUITY' },
              { type: 'Equity' },
              { type: 'EQUITY' }
            ]
          },
          {
            OR: [
              { accountName: { contains: 'Capital', mode: 'insensitive' } },
              { name: { contains: 'Capital', mode: 'insensitive' } }
            ]
          }
        ]
      }
    });

    if (!capitalAccount) {
      return NextResponse.json(
        { error: 'Capital account not found' },
        { status: 404 }
      );
    }

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
      capitalAccount: {
        id: capitalAccount.id,
        code: capitalAccount.code,
        name: capitalAccount.name,
        type: capitalAccount.type,
        balance: capitalAccount.balance,
        isActive: capitalAccount.isActive
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

    // Find capital account - check both accountType and type fields for compatibility
    const capitalAccount = await prisma.account.findFirst({
      where: {
        tenantId: user.tenantId,
        isActive: true,
        AND: [
          {
            OR: [
              { accountType: 'Equity' },
              { accountType: 'EQUITY' },
              { type: 'Equity' },
              { type: 'EQUITY' }
            ]
          },
          {
            OR: [
              { accountName: { contains: 'Capital', mode: 'insensitive' } },
              { name: { contains: 'Capital', mode: 'insensitive' } }
            ]
          }
        ]
      }
    });

    if (!capitalAccount) {
      return NextResponse.json(
        { error: 'Capital account not found' },
        { status: 404 }
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

    // Find capital account - check both accountType and type fields for compatibility
    const capitalAccount = await prisma.account.findFirst({
      where: {
        tenantId: user.tenantId,
        isActive: true,
        AND: [
          {
            OR: [
              { accountType: 'Equity' },
              { accountType: 'EQUITY' },
              { type: 'Equity' },
              { type: 'EQUITY' }
            ]
          },
          {
            OR: [
              { accountName: { contains: 'Capital', mode: 'insensitive' } },
              { name: { contains: 'Capital', mode: 'insensitive' } }
            ]
          }
        ]
      }
    });

    if (!capitalAccount) {
      return NextResponse.json(
        { error: 'Capital account not found' },
        { status: 404 }
      );
    }

    // Check if account has balance
    if (capitalAccount.balance > 0) {
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

// POST - Set initial capital balance
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

    if (!initialBalance || parseFloat(initialBalance) <= 0) {
      return NextResponse.json(
        { error: 'Valid initial balance is required' },
        { status: 400 }
      );
    }

    // Find or create capital account
    let capitalAccount = await prisma.account.findFirst({
      where: {
        tenantId: user.tenantId,
        type: 'EQUITY',
        name: { contains: 'Capital', mode: 'insensitive' }
      }
    });

    if (!capitalAccount) {
      // Create capital account if it doesn't exist
      capitalAccount = await prisma.account.create({
        data: {
          code: '3000',
          name: 'Owner\'s Capital',
          type: 'EQUITY',
          balance: 0,
          isActive: true,
          tenantId: user.tenantId
        }
      });
    }

    // Find cash account for the debit entry
    let cashAccount = null;
    if (cashAccountId) {
      cashAccount = await prisma.account.findUnique({
        where: { id: cashAccountId, tenantId: user.tenantId }
      });
    }

    if (!cashAccount) {
      // Try to find any existing cash/asset account with more flexible search
      cashAccount = await prisma.account.findFirst({
        where: {
          tenantId: user.tenantId,
          type: 'ASSET',
          OR: [
            { name: { contains: 'Cash', mode: 'insensitive' } },
            { name: { contains: 'Bank', mode: 'insensitive' } },
            { name: { contains: 'Checking', mode: 'insensitive' } },
            { name: { contains: 'Savings', mode: 'insensitive' } },
            { code: { startsWith: '1000' } }, // Asset accounts typically start with 1000
            { code: { startsWith: '1100' } }
          ]
        }
      });
    }

    // If still no cash account found, create a default one
    if (!cashAccount) {
      cashAccount = await prisma.account.create({
        data: {
          code: '1000',
          name: 'Cash',
          type: 'ASSET',
          balance: 0,
          isActive: true,
          tenantId: user.tenantId
        }
      });
    }

    const entryDate = new Date();
    await assertPeriodOpen(user.tenantId, entryDate, prisma);
    // Create journal entry for initial capital
    const transaction = await prisma.transaction.create({
      data: {
        date: entryDate,
        description: 'Initial Capital Contribution',
        reference: 'INIT-CAP',
        status: 'posted',
        tenantId: user.tenantId
      }
    });

    // Create journal entry lines
    await prisma.$transaction([
      // Credit capital account
      prisma.journalEntry.create({
        data: {
          transactionId: transaction.id,
          accountId: capitalAccount.id,
          debit: 0,
          credit: parseFloat(initialBalance),
          description: 'Initial capital contribution',
          status: 'posted'
        }
      }),
      // Debit cash account
      prisma.journalEntry.create({
        data: {
          transactionId: transaction.id,
          accountId: cashAccount.id,
          debit: parseFloat(initialBalance),
          credit: 0,
          description: 'Initial capital contribution',
          status: 'posted'
        }
      })
    ]);

    // Update account balances
    const capitalBalance = parseFloat(initialBalance);
    const cashBalance = (cashAccount.balance || 0) + parseFloat(initialBalance);
    
    await prisma.account.update({
      where: { id: capitalAccount.id },
      data: { balance: capitalBalance }
    });

    await prisma.account.update({
      where: { id: cashAccount.id },
      data: { balance: cashBalance }
    });

    // Also update AccountBalance records to keep them in sync
    await prisma.accountBalance.upsert({
      where: { tenantId_account: { tenantId: user.tenantId, account: capitalAccount.id } },
      update: { balance: capitalBalance },
      create: { tenantId: user.tenantId, account: capitalAccount.id, balance: capitalBalance }
    });

    await prisma.accountBalance.upsert({
      where: { tenantId_account: { tenantId: user.tenantId, account: cashAccount.id } },
      update: { balance: cashBalance },
      create: { tenantId: user.tenantId, account: cashAccount.id, balance: cashBalance }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'INITIAL_CAPITAL_SET',
        entityType: 'ACCOUNT',
        entityId: capitalAccount.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          initialBalance: parseFloat(initialBalance),
          cashAccountId: cashAccount.id,
          cashAccountName: cashAccount.name
        })
      }
    });

    return NextResponse.json({
      message: 'Initial capital balance set successfully',
      capitalAccount: {
        id: capitalAccount.id,
        code: capitalAccount.code,
        name: capitalAccount.name,
        balance: parseFloat(initialBalance)
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error setting initial capital:', error);
    return NextResponse.json(
      { error: 'Failed to set initial capital balance' },
      { status: 500 }
    );
  }
} 