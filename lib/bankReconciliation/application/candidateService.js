/**
 * GL candidates — posted V2 journal lines on the bank CoA with remaining unmatched amount.
 */

import { POSTED_JOURNAL_STATUSES } from '../../accountingV2/ledger/canonicalJournalSource.js';
import { signedFromJournalLine, fromSignedMinor } from '../domain/signedAmount.js';
import { MatchStatus } from '../domain/enums.js';
import { getPaymentAccountForRecon, assertReconcilablePaymentAccount } from './configService.js';

/**
 * Load book-side candidates for a payment account within an optional date window.
 */
export async function listGlCandidates(db, context, input) {
  const pa = await getPaymentAccountForRecon(db, context.businessId, input.paymentAccountId);
  assertReconcilablePaymentAccount(pa);

  const startDate = input.startDate ? new Date(input.startDate) : null;
  const endDate = input.endDate ? new Date(input.endDate) : null;

  const lines = await db.journalEntryLine.findMany({
    where: {
      accountId: pa.coaAccountId,
      journalEntry: {
        tenantId: context.businessId,
        architectureVersion: 'ACCOUNTING_V2',
        status: { in: [...POSTED_JOURNAL_STATUSES] },
        ...(startDate || endDate
          ? {
              OR: [
                {
                  postingDate: {
                    ...(startDate ? { gte: startDate } : {}),
                    ...(endDate ? { lte: endDate } : {}),
                  },
                },
                {
                  postingDate: null,
                  entryDate: {
                    ...(startDate ? { gte: startDate } : {}),
                    ...(endDate ? { lte: endDate } : {}),
                  },
                },
              ],
            }
          : {}),
      },
    },
    include: {
      journalEntry: {
        select: {
          id: true,
          entryDate: true,
          postingDate: true,
          description: true,
          referenceNumber: true,
          sourceNumber: true,
          sourceType: true,
          sourceId: true,
          status: true,
        },
      },
    },
    orderBy: { id: 'asc' },
  });

  // Sum accepted match allocations per journal line
  const lineIds = lines.map((l) => l.id);
  const links = lineIds.length
    ? await db.bankRecMatchLink.findMany({
        where: {
          tenantId: context.businessId,
          journalEntryLineId: { in: lineIds },
          side: 'BOOK',
          match: { status: MatchStatus.ACCEPTED },
        },
        select: { journalEntryLineId: true, allocatedAmountMinor: true },
      })
    : [];
  const allocated = new Map();
  for (const link of links) {
    allocated.set(
      link.journalEntryLineId,
      (allocated.get(link.journalEntryLineId) || 0) + Number(link.allocatedAmountMinor)
    );
  }

  const candidates = [];
  for (const line of lines) {
    const signed = signedFromJournalLine({
      debit: line.debitAmount ?? line.baseDebit,
      credit: line.creditAmount ?? line.baseCredit,
    });
    const used = allocated.get(line.id) || 0;
    // used is in same signed direction as allocated chunks
    const remaining = signed - used;
    if (remaining === 0) continue;
    const je = line.journalEntry;
    const txDate = je.postingDate || je.entryDate;
    candidates.push({
      journalEntryLineId: line.id,
      journalEntryId: je.id,
      accountId: pa.coaAccountId,
      transactionDate: txDate,
      description: line.description || je.description || '',
      reference: je.referenceNumber || je.sourceNumber || null,
      sourceType: je.sourceType || null,
      sourceId: je.sourceId || null,
      signedAmountMinor: signed,
      remainingAmountMinor: remaining,
      signedAmount: fromSignedMinor(signed),
      remainingAmount: fromSignedMinor(remaining),
    });
  }

  if (input.onlyUnmatched !== false) {
    return candidates.filter((c) => c.remainingAmountMinor !== 0);
  }
  return candidates;
}

/**
 * Book balance as of a date (sum of signed bank CoA lines through asOf).
 */
export async function bookBalanceMinorAsOf(db, context, paymentAccountId, asOfDate) {
  const pa = await getPaymentAccountForRecon(db, context.businessId, paymentAccountId);
  assertReconcilablePaymentAccount(pa);
  const end = new Date(asOfDate);
  end.setUTCHours(23, 59, 59, 999);

  const lines = await db.journalEntryLine.findMany({
    where: {
      accountId: pa.coaAccountId,
      journalEntry: {
        tenantId: context.businessId,
        architectureVersion: 'ACCOUNTING_V2',
        status: { in: [...POSTED_JOURNAL_STATUSES] },
        OR: [
          { postingDate: { lte: end } },
          { postingDate: null, entryDate: { lte: end } },
        ],
      },
    },
    select: { debitAmount: true, creditAmount: true, baseDebit: true, baseCredit: true },
  });

  return lines.reduce(
    (s, l) =>
      s +
      signedFromJournalLine({
        debit: l.debitAmount ?? l.baseDebit,
        credit: l.creditAmount ?? l.baseCredit,
      }),
    0
  );
}
