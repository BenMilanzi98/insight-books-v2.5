import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const entryType = searchParams.get('entryType'); // 'Transaction' | 'JournalEntry'
    const entryId = searchParams.get('entryId');
    const sourceType = searchParams.get('sourceType');
    const sourceId = searchParams.get('sourceId');

    if (!entryId && !(sourceType && sourceId)) {
      return NextResponse.json(
        { error: 'Provide entryId+entryType or sourceType+sourceId.' },
        { status: 400 }
      );
    }

    const tenantId = user.tenantId;
    const results = [];

    if (!entryType || entryType === 'JournalEntry') {
      const journalWhere = entryId
        ? { id: entryId, tenantId }
        : { tenantId, sourceType, sourceId };
      const journalEntry = await prisma.journalEntry.findFirst({
        where: journalWhere,
        include: { lines: { include: { account: true } } },
      });
      if (journalEntry) {
        results.push({
          entryType: 'JournalEntry',
          entryId: journalEntry.id,
          date: journalEntry.entryDate,
          reference: journalEntry.referenceNumber,
          description: journalEntry.description,
          sourceType: journalEntry.sourceType,
          sourceId: journalEntry.sourceId,
          lines: journalEntry.lines.map((l) => ({
            id: l.id,
            accountId: l.accountId,
            accountCode: l.account?.accountCode || '',
            accountName: l.account?.accountName || '',
            debit: l.debitAmount || 0,
            credit: l.creditAmount || 0,
            description: l.description || '',
          })),
        });
      }
    }

    if (!entryType || entryType === 'Transaction') {
      const transactionWhere = entryId
        ? { id: entryId, tenantId }
        : { tenantId, sourceType, sourceId };
      const transaction = await prisma.transaction.findFirst({
        where: transactionWhere,
        include: { lines: { include: { account: true } } },
      });
      if (transaction) {
        results.push({
          entryType: 'Transaction',
          entryId: transaction.id,
          date: transaction.date,
          reference: transaction.reference,
          description: transaction.description,
          sourceType: transaction.sourceType,
          sourceId: transaction.sourceId,
          isReversal: transaction.isReversal ?? false,
          entryTypeDetail: transaction.entryType || null,
          reversedTransactionId: transaction.reversedTransactionId || null,
          reversalReason: transaction.reversalReason || null,
          notes: transaction.notes || null,
          lines: transaction.lines.map((l) => ({
            id: l.id,
            accountId: l.accountId,
            accountCode: l.account?.accountCode || '',
            accountName: l.account?.accountName || '',
            debit: l.debitAmount || 0,
            credit: l.creditAmount || 0,
            description: l.description || '',
          })),
        });
      }
    }

    if (results.length === 0) {
      return NextResponse.json({ error: 'No ledger entries found.' }, { status: 404 });
    }

    return NextResponse.json({ entries: results });
  } catch (error) {
    console.error('Error fetching ledger transaction:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ledger transaction', message: error.message },
      { status: 500 }
    );
  }
}
