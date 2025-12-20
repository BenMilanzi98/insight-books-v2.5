// app/api/accounting/fix-orphaned/route.js
// Fix orphaned transactions (transactions with no lines)
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

// POST - Fix orphaned transactions
export async function POST(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) {
      return accessError;
    }

    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const deleteMode = body.delete === true; // Default: void transactions

    // Find orphaned transactions for this tenant
    const transactions = await prisma.transaction.findMany({
      where: {
        tenantId: user.tenantId
      },
      include: {
        lines: true
      }
    });

    const orphanedTransactions = transactions.filter(tx => !tx.lines || tx.lines.length === 0);

    if (orphanedTransactions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No orphaned transactions found',
        data: {
          fixed: 0,
          orphaned: []
        }
      });
    }

    const results = {
      total: orphanedTransactions.length,
      fixed: 0,
      errors: [],
      orphaned: orphanedTransactions.map(tx => ({
        id: tx.id,
        description: tx.description,
        reference: tx.reference,
        date: tx.date,
        status: tx.status
      }))
    };

    // Fix orphaned transactions
    for (const tx of orphanedTransactions) {
      try {
        if (deleteMode) {
          await prisma.transaction.delete({
            where: { id: tx.id }
          });
        } else {
          // Void the transaction (safer - preserves audit trail)
          await prisma.transaction.update({
            where: { id: tx.id },
            data: {
              status: 'void',
              description: `[VOIDED] ${tx.description} - Orphaned transaction (no lines)`
            }
          });
        }
        results.fixed++;
      } catch (error) {
        results.errors.push({
          transactionId: tx.id,
          error: error.message
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `${deleteMode ? 'Deleted' : 'Voided'} ${results.fixed} orphaned transaction(s)`,
      data: results
    });
  } catch (error) {
    console.error('Error fixing orphaned transactions:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fix orphaned transactions' },
      { status: 500 }
    );
  }
}

// GET - Find orphaned transactions (dry run)
export async function GET(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) {
      return accessError;
    }

    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Find orphaned transactions for this tenant
    const transactions = await prisma.transaction.findMany({
      where: {
        tenantId: user.tenantId
      },
      include: {
        lines: true
      }
    });

    const orphanedTransactions = transactions.filter(tx => !tx.lines || tx.lines.length === 0);

    return NextResponse.json({
      success: true,
      message: `Found ${orphanedTransactions.length} orphaned transaction(s)`,
      data: {
        count: orphanedTransactions.length,
        orphaned: orphanedTransactions.map(tx => ({
          id: tx.id,
          description: tx.description,
          reference: tx.reference,
          date: tx.date,
          status: tx.status,
          sourceType: tx.sourceType,
          sourceId: tx.sourceId
        }))
      }
    });
  } catch (error) {
    console.error('Error finding orphaned transactions:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to find orphaned transactions' },
      { status: 500 }
    );
  }
}










