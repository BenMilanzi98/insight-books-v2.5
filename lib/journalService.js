import prisma from './prisma';
import {
  validateJournalEntryPayload,
  FLOAT_TOLERANCE,
} from './journalEntryValidation';
import { updateAccountBalanceOnTransaction } from './accountBalanceService';

const ALLOWED_ENTRY_TYPES = [
  'Correction',
  'Accrual',
  'Opening Balance',
  'OpeningBalance',
  'Regular',
  'Reversal',
  'Manual',
];

async function logAudit({ userId, tenantId, action, entityId, details }) {
  if (!userId) return;

  await prisma.auditLog.create({
    data: {
      userId,
      tenantId,
      action,
      entityType: 'JournalEntry',
      entityId,
      details,
    },
  });
}

async function ensureAccountsAccessible(tx, tenantId, lines) {
  const uniqueAccountIds = [...new Set(lines.map((line) => line.accountId))];

  const accounts = await tx.account.findMany({
    where: {
      tenantId,
      id: { in: uniqueAccountIds },
    },
    select: { id: true, isActive: true },
  });

  if (accounts.length !== uniqueAccountIds.length) {
    throw new Error('One or more accounts were not found for this tenant.');
  }

  const inactiveAccount = accounts.find((account) => !account.isActive);
  if (inactiveAccount) {
    throw new Error(
      'Inactive accounts cannot be used in journal entries. Please reactivate the account first.'
    );
  }

  return accounts;
}

async function checkAccountingPeriodLock(tx, tenantId, entryDate) {
  try {
    if (!tx.accountingPeriod?.findFirst) {
      return { isLocked: false };
    }

    const lockedPeriod = await tx.accountingPeriod.findFirst({
      where: {
        tenantId,
        status: 'closed',
        startDate: { lte: entryDate },
        endDate: { gte: entryDate },
      },
    });

    if (lockedPeriod) {
      return {
        isLocked: true,
        periodName: lockedPeriod.name,
        error: `Cannot post journal entry in closed accounting period: ${lockedPeriod.name}`,
      };
    }

    return { isLocked: false };
  } catch (error) {
    // If accounting periods are not configured, allow posting.
    return { isLocked: false };
  }
}

export async function generateReferenceNumber(tx, tenantId, entryDate) {
  const year = entryDate.getUTCFullYear();
  const prefix = `TXN-${year}-`;

  // Find the latest transaction with this prefix
  const latestTransaction = await tx.transaction.findFirst({
    where: {
      tenantId,
      reference: {
        startsWith: prefix,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      reference: true,
      createdAt: true,
    },
  });

  let nextSequence = 1;
  if (latestTransaction?.reference) {
    // Handle format TXN-2025-0001-XXXX
    const refNum = latestTransaction.reference;
    const match = refNum.match(/^TXN-\d{4}-(\d+)(?:-)?/);
    if (match) {
      const lastSeq = parseInt(match[1], 10);
      if (!isNaN(lastSeq)) {
        nextSequence = lastSeq + 1;
      }
    }
  }

  // Add milliseconds to ensure uniqueness within the same transaction
  const ms = Date.now().toString().slice(-4);
  const refNumber = `${prefix}${String(nextSequence).padStart(4, '0')}-${ms}`;
  
  console.log('🔢 Generated reference number:', refNumber);
  return refNumber;
}

function buildLineData(lines) {
  return lines.map((line, index) => ({
    lineNumber: index + 1,
    accountId: line.accountId,
    debitAmount: line.debitAmount ?? 0,
    creditAmount: line.creditAmount ?? 0,
    description: line.description || null,
  }));
}

export async function createDraftEntry(payload, context = {}) {
  const parsed = validateJournalEntryPayload(payload);

  return prisma.$transaction(async (tx) => {
    await ensureAccountsAccessible(tx, parsed.tenantId, parsed.lines);
    const referenceNumber = await generateReferenceNumber(
      tx,
      parsed.tenantId,
      parsed.entryDate
    );

    const entry = await tx.journalEntry.create({
      data: {
        tenantId: parsed.tenantId,
        entryDate: parsed.entryDate,
        referenceNumber,
        description: parsed.description || null,
        entryType: parsed.entryType || 'Regular',
        sourceType: parsed.sourceType || 'Manual',
        sourceId: parsed.sourceId || null,
        notes: parsed.notes || null,
        status: 'Draft',
        createdById: context.userId || null,
        lines: {
          create: buildLineData(parsed.lines),
        },
      },
      include: {
        lines: true,
      },
    });

    await logAudit({
      userId: context.userId,
      tenantId: parsed.tenantId,
      action: 'journal.create',
      entityId: entry.id,
      details: `Created draft journal entry ${entry.referenceNumber}.`,
    });

    return entry;
  });
}

function summarizeLines(lines) {
  return lines.reduce(
    (acc, line) => {
      acc.debits += line.debitAmount ?? 0;
      acc.credits += line.creditAmount ?? 0;
      return acc;
    },
    { debits: 0, credits: 0 }
  );
}

export async function postEntry(entryId, context = {}) {
  if (!entryId) {
    throw new Error('entryId is required to post a journal entry.');
  }

  return prisma.$transaction(async (tx) => {
    const entry = await tx.journalEntry.findUnique({
      where: { id: entryId },
      include: { lines: true },
    });

    if (!entry) {
      throw new Error('Journal entry not found.');
    }

    if (entry.tenantId && context.tenantId && entry.tenantId !== context.tenantId) {
      throw new Error('Access denied for this journal entry.');
    }

    if (entry.status === 'Void') {
      throw new Error('A voided journal entry cannot be posted.');
    }

    if (entry.status === 'Posted') {
      return entry;
    }

    if (!entry.lines.length) {
      throw new Error('Journal entries must have lines before posting.');
    }

    if (entry.entryType && !ALLOWED_ENTRY_TYPES.includes(entry.entryType)) {
      throw new Error(`Unsupported journal entry type: ${entry.entryType}`);
    }

    const entryDate = entry.entryDate || entry.createdAt;
    const periodCheck = await checkAccountingPeriodLock(
      tx,
      entry.tenantId,
      entryDate
    );
    if (periodCheck.isLocked) {
      throw new Error(periodCheck.error || 'Accounting period is locked.');
    }

    const totals = summarizeLines(entry.lines);
    if (Math.abs(totals.debits - totals.credits) > FLOAT_TOLERANCE) {
      throw new Error('Draft entry is not balanced. Please edit the lines before posting.');
    }

    const updatedEntry = await tx.journalEntry.update({
      where: { id: entryId },
      data: {
        status: 'Posted',
        postedById: context.userId || null,
        postedDate: new Date(),
        updatedAt: new Date(),
      },
      include: { lines: true },
    });

    for (const line of updatedEntry.lines) {
      await updateAccountBalanceOnTransaction(
        line.accountId,
        line.debitAmount || 0,
        line.creditAmount || 0,
        tx
      );
    }

    await logAudit({
      userId: context.userId,
      tenantId: entry.tenantId,
      action: 'journal.post',
      entityId: entry.id,
      details: `Posted journal entry ${entry.referenceNumber}.`,
    });

    return updatedEntry;
  });
}

export async function voidEntry(entryId, reason, context = {}) {
  if (!entryId) {
    throw new Error('entryId is required to void a journal entry.');
  }

  if (!reason || !reason.trim()) {
    throw new Error('A reason is required when voiding a journal entry.');
  }

  return prisma.$transaction(async (tx) => {
    const entry = await tx.journalEntry.findUnique({
      where: { id: entryId },
      include: { lines: true },
    });

    if (!entry) {
      throw new Error('Journal entry not found.');
    }

    if (entry.status === 'Void') {
      return entry;
    }

    const updatedEntry = await tx.journalEntry.update({
      where: { id: entryId },
      data: {
        status: 'Void',
        notes: [entry.notes, `Voided: ${reason}`].filter(Boolean).join('\n'),
        updatedAt: new Date(),
      },
      include: { lines: true },
    });

    await logAudit({
      userId: context.userId,
      tenantId: entry.tenantId,
      action: 'journal.void',
      entityId: entry.id,
      details: `Voided journal entry ${entry.referenceNumber}: ${reason}`,
    });

    return updatedEntry;
  });
}

export async function createAndPostEntry(payload, context = {}) {
  const draft = await createDraftEntry(payload, context);
  return postEntry(draft.id, context);
}

export async function createReversalEntry(entryId, reason, context = {}) {
  if (!entryId) {
    throw new Error('entryId is required to reverse a journal entry.');
  }

  if (!reason || !reason.trim()) {
    throw new Error('A reason is required to reverse a journal entry.');
  }

  return prisma.$transaction(async (tx) => {
    const entry = await tx.journalEntry.findUnique({
      where: { id: entryId },
      include: { lines: true },
    });

    if (!entry) {
      throw new Error('Journal entry not found.');
    }

    if (entry.status !== 'Posted') {
      throw new Error('Only posted journal entries can be reversed.');
    }

    const entryDate = entry.entryDate || entry.createdAt;
    const periodCheck = await checkAccountingPeriodLock(
      tx,
      entry.tenantId,
      entryDate
    );
    if (periodCheck.isLocked) {
      throw new Error(periodCheck.error || 'Accounting period is locked.');
    }

    const referenceNumber = await generateReferenceNumber(
      tx,
      entry.tenantId,
      entryDate
    );

    const reversal = await tx.journalEntry.create({
      data: {
        tenantId: entry.tenantId,
        entryDate,
        referenceNumber,
        description: `Reversal of ${entry.referenceNumber}: ${reason}`,
        entryType: 'Reversal',
        sourceType: entry.sourceType || 'Manual',
        sourceId: entry.id,
        notes: reason,
        status: 'Posted',
        createdById: context.userId || null,
        postedById: context.userId || null,
        postedDate: new Date(),
        lines: {
          create: entry.lines.map((line, index) => ({
            lineNumber: index + 1,
            accountId: line.accountId,
            debitAmount: line.creditAmount || 0,
            creditAmount: line.debitAmount || 0,
            description: line.description,
          })),
        },
      },
      include: { lines: true },
    });

    for (const line of reversal.lines) {
      await updateAccountBalanceOnTransaction(
        line.accountId,
        line.debitAmount || 0,
        line.creditAmount || 0,
        tx
      );
    }

    await logAudit({
      userId: context.userId,
      tenantId: entry.tenantId,
      action: 'journal.reverse',
      entityId: reversal.id,
      details: `Reversed journal entry ${entry.referenceNumber}: ${reason}`,
    });

    return reversal;
  });
}
