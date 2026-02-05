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
      const journalEntry = await prisma.journalEntry.findFirst({
        where: entryId
          ? { id: entryId, tenantId }
          : { tenantId, sourceType, sourceId },
        include: { lines: true },
      });
      if (journalEntry) {
        const totalDebits = journalEntry.lines.reduce((s, l) => s + (l.debitAmount || 0), 0);
        const totalCredits = journalEntry.lines.reduce((s, l) => s + (l.creditAmount || 0), 0);
        results.push({
          entryType: 'JournalEntry',
          entryId: journalEntry.id,
          totalDebits,
          totalCredits,
          isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
        });
      }
    }

    if (!entryType || entryType === 'Transaction') {
      const transaction = await prisma.transaction.findFirst({
        where: entryId
          ? { id: entryId, tenantId }
          : { tenantId, sourceType, sourceId },
        include: { lines: true },
      });
      if (transaction) {
        const totalDebits = transaction.lines.reduce((s, l) => s + (l.debitAmount || 0), 0);
        const totalCredits = transaction.lines.reduce((s, l) => s + (l.creditAmount || 0), 0);
        results.push({
          entryType: 'Transaction',
          entryId: transaction.id,
          totalDebits,
          totalCredits,
          isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
        });
      }
    }

    if (results.length === 0) {
      return NextResponse.json({ error: 'No ledger entries found.' }, { status: 404 });
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error validating ledger balance:', error);
    return NextResponse.json(
      { error: 'Failed to validate ledger balance', message: error.message },
      { status: 500 }
    );
  }
}
