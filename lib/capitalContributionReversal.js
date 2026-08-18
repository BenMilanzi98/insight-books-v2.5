import prisma from './prisma.js';
import { reverseSourceJournals, findV2JournalsBySource } from './accountingV2/application/reverseSourceJournals.js';
import { ensureCapitalParentAccount, syncCapitalParentRollupBalance } from './capitalCoaHelpers.js';

function lineAmount(value) {
  if (value == null || value === '') return 0;
  if (typeof value === 'object' && typeof value.toNumber === 'function') return value.toNumber();
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function contributionAmountFromJournal(db, journalId, tenantId) {
  const journal = await db.journalEntry.findFirst({
    where: { id: journalId, tenantId },
    include: { lines: true },
  });
  if (!journal) return 0;
  const credit = (journal.lines || []).reduce((s, l) => s + lineAmount(l.creditAmount || l.credit), 0);
  return credit || lineAmount(journal.totalCredit);
}

/**
 * Reverse a posted capital contribution journal and roll back owner capital settings.
 */
export async function reverseCapitalContribution({
  tenantId,
  userId,
  reference,
  journalId,
  reason,
  db = prisma,
}) {
  const trimmedReason = String(reason || '').trim();
  if (!trimmedReason) {
    const err = new Error('A reason is required to reverse a capital contribution');
    err.statusCode = 400;
    throw err;
  }

  const sourceIds = [reference, journalId].filter(Boolean);
  if (!sourceIds.length) {
    const err = new Error('Contribution reference or journal id is required');
    err.statusCode = 400;
    throw err;
  }

  const existing = await findV2JournalsBySource({
    tenantId,
    sourceTypes: ['capital_contribution', 'CapitalContribution'],
    sourceIds,
    db,
  });
  const target = existing.find((j) => !j.reversedByJournalId && j.reversalStatus !== 'REVERSED');
  if (!target) {
    const err = new Error('No posted, unreversed capital contribution journal found');
    err.statusCode = 404;
    throw err;
  }

  const amount = await contributionAmountFromJournal(db, target.id, tenantId);
  if (!(amount > 0)) {
    const err = new Error('Could not determine contribution amount from journal');
    err.statusCode = 400;
    throw err;
  }

  const reversal = await reverseSourceJournals({
    tenantId,
    userId,
    reason: trimmedReason,
    sourceTypes: ['capital_contribution', 'CapitalContribution'],
    sourceIds: [target.sourceId],
    expandIds: false,
    db,
  });

  const parentCapital = await ensureCapitalParentAccount(tenantId, db);
  await db.tenantSettings.update({
    where: { tenantId },
    data: {
      ownerContributedCapital: { decrement: amount },
    },
  }).catch(async () => {
    await db.tenantSettings.create({
      data: { tenantId, enabledModules: [], ownerContributedCapital: 0 },
    });
  });

  await syncCapitalParentRollupBalance(tenantId, parentCapital.id, db);

  await db.auditLog.create({
    data: {
      action: 'CAPITAL_CONTRIBUTION_REVERSED',
      entityType: 'ACCOUNT',
      entityId: parentCapital.id,
      userId,
      tenantId,
      details: JSON.stringify({
        reference: target.sourceId,
        journalId: target.id,
        amount,
        reason: trimmedReason,
        reversed: reversal.reversed,
      }),
    },
  });

  return {
    amount,
    reference: target.sourceId,
    journalId: target.id,
    reversal,
  };
}
