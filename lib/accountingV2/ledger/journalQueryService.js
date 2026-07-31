/**
 * Phase 5 — Journal Query Service (fresh-books V2-only).
 *
 * Canonical, read-only browsing of posted `JournalEntry` rows with
 * `architectureVersion = ACCOUNTING_V2`. Archived `Transaction` rows are
 * never queried.
 */

import {
  POSTED_TRANSACTION_STATUSES,
  POSTED_JOURNAL_STATUSES,
  JOURNAL_KIND,
  assertLedgerContext,
} from './canonicalJournalSource.js';
import { parseDecimalToMinor, minorToDecimalString } from '../domain/money.js';

const toMinor = (v) =>
  v == null ? 0 : parseDecimalToMinor(typeof v === 'number' ? v.toFixed(2) : String(v));

/** Normalize a raw status string to the canonical vocabulary. */
export function normalizeJournalStatus(raw) {
  const value = String(raw ?? '').toLowerCase();
  if (['posted'].includes(value)) return 'POSTED';
  if (['draft'].includes(value)) return 'DRAFT';
  if (['void', 'voided', 'cancelled'].includes(value)) return 'VOID';
  if (value === 'reversed') return 'REVERSED';
  if (value === 'partiallyreversed') return 'PARTIALLY_REVERSED';
  if (value === 'pendingapproval') return 'PENDING_APPROVAL';
  if (value === 'approved') return 'APPROVED';
  if (value === 'posting') return 'POSTING';
  if (value === 'failed') return 'FAILED';
  return 'UNKNOWN';
}

function normalizeTransactionHeader(tx, totals) {
  return {
    journalId: tx.id,
    journalKind: JOURNAL_KIND.LEGACY_TRANSACTION,
    journalNumber: null,
    reference: tx.reference ?? null,
    status: normalizeJournalStatus(tx.status),
    rawStatus: tx.status,
    entryDate: tx.date,
    postingDate: tx.date,
    postedAt: tx.postedDate ?? tx.createdAt,
    description: tx.description ?? null,
    entryType: tx.entryType ?? 'Regular',
    sourceType: tx.sourceType ?? null,
    sourceId: tx.sourceId ?? null,
    sourceNumber: null,
    branchId: tx.branchId ?? null,
    currency: null,
    totalDebit: minorToDecimalString(totals?.debitMinor ?? 0),
    totalCredit: minorToDecimalString(totals?.creditMinor ?? 0),
    lineCount: totals?.lineCount ?? 0,
    isReversal: tx.isReversal === true,
    originalJournalId: tx.reversedTransactionId ?? null,
    reversedByJournalId: null,
    architectureVersion: 'LEGACY_V1',
    authoritative: true,
    lineageReliable: Boolean(tx.sourceType && tx.sourceId),
    createdById: tx.createdById ?? null,
    postedById: tx.postedById ?? null,
    createdAt: tx.createdAt,
  };
}

function normalizeJournalEntryHeader(je, totals) {
  const isV2 = je.architectureVersion === 'ACCOUNTING_V2';
  const mirror = je.transactionId != null;
  const debitMinor =
    je.totalDebit != null ? toMinor(je.totalDebit) : totals?.debitMinor ?? toMinor(je.debit);
  const creditMinor =
    je.totalCredit != null ? toMinor(je.totalCredit) : totals?.creditMinor ?? toMinor(je.credit);
  return {
    journalId: je.id,
    journalKind: isV2 ? JOURNAL_KIND.ACCOUNTING_V2 : JOURNAL_KIND.LEGACY_JOURNAL,
    journalNumber: je.journalNumber ?? null,
    reference: je.referenceNumber ?? null,
    status: normalizeJournalStatus(je.status),
    rawStatus: je.status,
    entryDate: je.entryDate ?? je.postingDate ?? je.createdAt,
    postingDate: je.postingDate ?? je.entryDate ?? je.createdAt,
    postedAt: je.postedDate ?? je.createdAt,
    description: je.description ?? null,
    entryType: je.entryType ?? 'Regular',
    sourceType: je.sourceType ?? null,
    sourceId: je.sourceId ?? null,
    sourceNumber: je.sourceNumber ?? null,
    branchId: je.branchId ?? null,
    currency: je.currency ?? null,
    totalDebit: minorToDecimalString(debitMinor),
    totalCredit: minorToDecimalString(creditMinor),
    lineCount: totals?.lineCount ?? 0,
    isReversal: je.entryType === 'Reversal' || je.reversalStatus === 'REVERSAL',
    originalJournalId: je.originalJournalId ?? null,
    reversedByJournalId: je.reversedByJournalId ?? null,
    architectureVersion: je.architectureVersion ?? 'LEGACY_V1',
    // Mirror rows echo a Transaction the canonical ledger already counts.
    authoritative: !mirror,
    mirrorOfTransactionId: je.transactionId ?? null,
    lineageReliable: isV2 ? Boolean(je.accountingEventId) : Boolean(je.sourceType && je.sourceId),
    accountingEventId: je.accountingEventId ?? null,
    createdById: je.createdById ?? null,
    postedById: je.postedById ?? null,
    createdAt: je.createdAt,
  };
}

async function lineTotalsFor(db, model, fkField, ids) {
  if (ids.length === 0) return new Map();
  const grouped = await model.groupBy({
    by: [fkField],
    where: { [fkField]: { in: ids } },
    _sum: { debitAmount: true, creditAmount: true },
    _count: { _all: true },
  });
  return new Map(
    grouped.map((g) => [
      g[fkField],
      {
        debitMinor: toMinor(g._sum?.debitAmount),
        creditMinor: toMinor(g._sum?.creditAmount),
        lineCount: g._count?._all ?? 0,
      },
    ])
  );
}

/**
 * List canonical journals across both stores, newest-first, with filters and
 * two-source pagination (each store is windowed to page*pageSize, merged, then
 * sliced — bounded memory regardless of history size).
 *
 * @param {import('@prisma/client').PrismaClient} db
 * @param {object} context AccountingContext
 * @param {{
 *   status?: string, entryType?: string, sourceType?: string, sourceId?: string,
 *   journalKind?: string, startDate?: Date, endDate?: Date, branchId?: string,
 *   search?: string, includeNonPosted?: boolean, includeMirrors?: boolean,
 *   page?: number, pageSize?: number,
 * }} [filters]
 */
export async function listCanonicalJournals(db, context, filters = {}) {
  assertLedgerContext(context);
  const tenantId = context.businessId;
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, filters.pageSize ?? 25));
  const fetchWindow = page * pageSize;

  const wantKind = (kind) => !filters.journalKind || filters.journalKind === kind;
  const statusFilter = filters.status ? normalizeJournalStatus(filters.status) : null;

  const dateRange = {};
  if (filters.startDate) dateRange.gte = filters.startDate;
  if (filters.endDate) dateRange.lte = filters.endDate;
  const hasDates = filters.startDate || filters.endDate;

  const txWhere = {
    tenantId,
    ...(filters.includeNonPosted ? {} : { status: { in: [...POSTED_TRANSACTION_STATUSES] } }),
    ...(hasDates ? { date: dateRange } : {}),
    ...(filters.branchId ? { branchId: filters.branchId } : {}),
    ...(filters.sourceType ? { sourceType: filters.sourceType } : {}),
    ...(filters.sourceId ? { sourceId: filters.sourceId } : {}),
    ...(filters.entryType ? { entryType: filters.entryType } : {}),
    ...(filters.search
      ? {
          OR: [
            { description: { contains: filters.search, mode: 'insensitive' } },
            { reference: { contains: filters.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  void txWhere;
  void wantKind;

  const jeWhere = {
    tenantId,
    architectureVersion: 'ACCOUNTING_V2',
    ...(filters.includeNonPosted ? {} : { status: { in: [...POSTED_JOURNAL_STATUSES] } }),
    ...(hasDates
      ? { OR: [{ postingDate: dateRange }, { AND: [{ postingDate: null }, { entryDate: dateRange }] }] }
      : {}),
    ...(filters.branchId ? { branchId: filters.branchId } : {}),
    ...(filters.sourceType ? { sourceType: filters.sourceType } : {}),
    ...(filters.sourceId ? { sourceId: filters.sourceId } : {}),
    ...(filters.entryType ? { entryType: filters.entryType } : {}),
    ...(filters.search
      ? {
          OR: [
            { description: { contains: filters.search, mode: 'insensitive' } },
            { referenceNumber: { contains: filters.search, mode: 'insensitive' } },
            { journalNumber: { contains: filters.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  // Fresh-books: never query Transaction archive.
  if (filters.journalKind === JOURNAL_KIND.LEGACY_TRANSACTION) {
    return { journals: [], total: 0, page, pageSize };
  }

  const [jeRows, jeTotal] = await Promise.all([
    db.journalEntry.findMany({ where: jeWhere, orderBy: { createdAt: 'desc' }, take: fetchWindow }),
    db.journalEntry.count({ where: jeWhere }),
  ]);

  const jeTotals = await lineTotalsFor(
    db,
    db.journalEntryLine,
    'journalEntryId',
    jeRows.map((r) => r.id)
  );

  let headers = jeRows.map((je) => normalizeJournalEntryHeader(je, jeTotals.get(je.id)));
  if (statusFilter) headers = headers.filter((h) => h.status === statusFilter);

  headers.sort((a, b) => {
    const dA = new Date(a.postingDate).getTime();
    const dB = new Date(b.postingDate).getTime();
    if (dA !== dB) return dB - dA;
    const cA = new Date(a.createdAt).getTime();
    const cB = new Date(b.createdAt).getTime();
    if (cA !== cB) return cB - cA;
    return a.journalId < b.journalId ? 1 : -1;
  });

  return {
    journals: headers.slice((page - 1) * pageSize, page * pageSize),
    total: jeTotal,
    page,
    pageSize,
  };
}

/**
 * Full canonical journal detail: normalized header, lines with account info,
 * and complete lineage (accounting event, source document reference, reversal
 * links in both directions, mirror relationship).
 *
 * @param {import('@prisma/client').PrismaClient} db
 * @param {object} context
 * @param {{journalId: string}} params
 * @returns {Promise<object|null>}
 */
export async function getCanonicalJournal(db, context, { journalId }) {
  assertLedgerContext(context);
  const tenantId = context.businessId;

  const je = await db.journalEntry.findFirst({
    where: { id: journalId, tenantId, architectureVersion: 'ACCOUNTING_V2' },
    include: { lines: { orderBy: { lineNumber: 'asc' } } },
  });
  if (je) {
    const totals = {
      debitMinor: je.lines.reduce((s, l) => s + toMinor(l.debitAmount), 0),
      creditMinor: je.lines.reduce((s, l) => s + toMinor(l.creditAmount), 0),
      lineCount: je.lines.length,
    };
    const header = normalizeJournalEntryHeader(je, totals);
    const [event, original, reversal] = await Promise.all([
      je.accountingEventId && typeof db.acctV2EventRegistry?.findFirst === 'function'
        ? db.acctV2EventRegistry.findFirst({ where: { id: je.accountingEventId, tenantId } })
        : null,
      je.originalJournalId
        ? db.journalEntry.findFirst({
            where: { id: je.originalJournalId, tenantId },
            select: { id: true, journalNumber: true, referenceNumber: true, status: true },
          })
        : null,
      je.reversedByJournalId
        ? db.journalEntry.findFirst({
            where: { id: je.reversedByJournalId, tenantId },
            select: { id: true, journalNumber: true, referenceNumber: true, status: true },
          })
        : null,
    ]);
    return {
      ...header,
      lines: je.lines.map((l) => ({
        lineId: l.id,
        lineNumber: l.lineNumber,
        accountId: l.accountId,
        debit: minorToDecimalString(toMinor(l.debitAmount)),
        credit: minorToDecimalString(toMinor(l.creditAmount)),
        baseDebit: l.baseDebit != null ? minorToDecimalString(toMinor(l.baseDebit)) : null,
        baseCredit: l.baseCredit != null ? minorToDecimalString(toMinor(l.baseCredit)) : null,
        currency: l.currency ?? je.currency ?? null,
        description: l.description ?? null,
        dimensions: l.dimensions ?? null,
        taxCode: l.taxCode ?? null,
      })),
      lineage: {
        accountingEvent: event
          ? {
              id: event.id,
              sourceModule: event.sourceModule,
              sourceType: event.sourceType,
              sourceId: event.sourceId,
              eventType: event.eventType,
              status: event.status,
            }
          : null,
        source: je.sourceType ? { sourceType: je.sourceType, sourceId: je.sourceId } : null,
        reverses: original,
        reversedBy: reversal,
        mirrorOfTransactionId: je.transactionId ?? null,
      },
      metadata: je.metadata ?? null,
      notes: je.notes ?? null,
    };
  }

  // Fresh-books: Transaction archive is never returned as a journal.
  return null;
}
