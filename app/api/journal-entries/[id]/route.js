import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { formatJournalEntry } from '@/lib/journalEntryFormatter';

const ENTRY_INCLUDE = {
  lines: {
    orderBy: { lineNumber: 'asc' },
    include: {
      account: {
        select: {
          id: true,
          accountCode: true,
          accountName: true,
          accountType: true,
          code: true,
          name: true,
          type: true,
        },
      },
    },
  },
  createdBy: {
    select: { id: true, name: true, email: true },
  },
  postedBy: {
    select: { id: true, name: true, email: true },
  },
};

/**
 * GET - Fetch a single journal entry by ID
 */
export async function GET(request, { params }) {
  try {
    // Authenticate user
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated with this user' },
        { status: 401 }
      );
    }
    
    // Handle potential async params (Next.js 15)
    const resolvedParams = typeof params.then === 'function' ? await params : params;
    const entryId = resolvedParams?.id;
    
    if (!entryId) {
      return NextResponse.json(
        { error: 'Invalid entry ID' },
        { status: 400 }
      );
    }
    
    const tenantId = user.tenantId;
    
    // Find the transaction with its lines
    const transaction = await prisma.transaction.findFirst({
      where: {
        id: entryId,
        tenantId: tenantId
      },
      include: ENTRY_INCLUDE
    });
    
    // Check if transaction exists
    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(formatJournalEntry(transaction));
  } catch (error) {
    console.error('Error fetching journal entry:', error);
    return NextResponse.json(
      { error: 'Failed to fetch journal entry', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete a journal entry
 */
export async function DELETE(request, { params }) {
  try {
    // Authenticate user
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated with this user' },
        { status: 401 }
      );
    }
    
    // Get ID from URL - handle Next.js 15 async params
    const resolvedParams = typeof params.then === 'function' ? await params : params;
    const entryId = resolvedParams?.id;
    
    if (!entryId) {
      return NextResponse.json(
        { error: 'Invalid entry ID' },
        { status: 400 }
      );
    }
    
    const tenantId = user.tenantId;
    
    // Check if the transaction exists
    const existingEntry = await prisma.transaction.findFirst({
      where: {
        id: entryId,
        tenantId: tenantId
      },
      include: {
        lines: true
      }
    });
    
    // If no transaction found, return 404
    if (!existingEntry) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }
    
    // Check if entry is posted - only allow deletion of draft entries
    if (existingEntry.status === 'posted') {
      return NextResponse.json(
        { error: 'Cannot delete posted transaction. Please void it instead.' },
        { status: 400 }
      );
    }
    
    // Delete in a transaction to ensure data integrity
    await prisma.$transaction(async (tx) => {
      await tx.transaction.delete({
        where: { id: entryId },
      });

      await tx.auditLog.create({
        data: {
          action: 'TRANSACTION_DELETED',
          entityType: 'TRANSACTION',
          entityId: entryId,
          userId: user.id,
          tenantId: tenantId,
          details: JSON.stringify({
            transactionId: entryId,
            reference: existingEntry.reference,
            description: existingEntry.description,
          }),
        },
      });
    });
    
    return NextResponse.json({
      message: 'Journal entry deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting journal entry:', error);
    return NextResponse.json(
      { error: 'Failed to delete journal entry', details: error.message },
      { status: 500 }
    );
  }
}