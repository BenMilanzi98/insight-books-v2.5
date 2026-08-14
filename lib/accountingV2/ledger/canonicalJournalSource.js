/**
 * Phase 5 — Canonical Journal Source.
 *
 * THE single definition of "authoritative posted journal lines" for the whole
 * system. Every ledger balance, account activity view, export and report must
 * derive from this module, so the same economic event can never be counted
 * zero or two times depending on the surface.
 *
 * Fresh-books V2-only authority:
 *   Posted `JournalEntry` + `JournalEntryLine` with
 *   `architectureVersion = 'ACCOUNTING_V2'` only.
 *
 * Archived `Transaction` / `TransactionLine` rows are never queried.
 * Shadow journals live in separate tables and are structurally excluded.
 *
 * All monetary aggregation uses integer minor units (ADR-006). Never floats.
 */

import { parseDecimalToMinor } from '../domain/money.js';
import { AccountingValidationError } from '../domain/errors.js';

/** Every ledger read requires a validated business-scoped context (ADR-005). */
export function assertLedgerContext(context) {
  if (!context?.businessId || typeof context.businessId !== 'string') {
    throw new AccountingValidationError('Ledger queries require a business-scoped accounting context.', [
      { path: 'context.businessId', message: 'required string' },
    ]);
  }
}

/** Transaction statuses that mean "posted" (historical casing drift included). */
export const POSTED_TRANSACTION_STATUSES = Object.freeze(['posted', 'Posted', 'POSTED']);

/**
 * JournalEntry statuses whose lines are authoritative. Reversed originals stay
 * in the ledger (the reversal is a separate posted journal).
 */
export const POSTED_JOURNAL_STATUSES = Object.freeze([
  'Posted',
  'posted',
  'POSTED',
  'Reversed',
  'PartiallyReversed',
]);

export const JOURNAL_KIND = Object.freeze({
  /** @deprecated unused archive — kept for API compatibility */
  LEGACY_TRANSACTION: 'LEGACY_TRANSACTION',
  /** @deprecated unused — kept for API compatibility */
  LEGACY_JOURNAL: 'LEGACY_JOURNAL',
  ACCOUNTING_V2: 'ACCOUNTING_V2',
});

/** @param {unknown} value Prisma Decimal | string | number | null */
function toMinor(value) {
  if (value == null) return 0;
  return parseDecimalToMinor(typeof value === 'number' ? value.toFixed(2) : String(value));
}

/**
 * Date filter for `Transaction` rows (legacy semantics: `date` is both the
 * economic and posting date).
 */
function transactionDateFilter(startDate, endDate) {
  if (!startDate && !endDate) return {};
  const range = {};
  if (startDate) range.gte = startDate;
  if (endDate) range.lte = endDate;
  return { date: range };
}

/**
 * Date filter for `JournalEntry` rows. V2 journals carry `postingDate` (the
 * period-determining date); legacy journals only have `entryDate`. The filter
 * uses postingDate when present, entryDate otherwise — explicitly, not by
 * accident of which column a surface happened to pick.
 */
function journalDateFilter(startDate, endDate) {
  if (!startDate && !endDate) return {};
  const range = {};
  if (startDate) range.gte = startDate;
  if (endDate) range.lte = endDate;
  return {
    OR: [
      { postingDate: range },
      { AND: [{ postingDate: null }, { entryDate: range }] },
    ],
  };
}

/**
 * @deprecated Transaction archive is unused; always returns an impossible filter.
 */
export function canonicalTransactionWhere(tenantId, filters = {}) {
  return {
    tenantId,
    id: '__fresh_books_transaction_archive_unused__',
    ...(filters.branchId ? { branchId: filters.branchId } : {}),
    ...transactionDateFilter(filters.startDate, filters.endDate),
  };
}

/**
 * Canonical `where` for authoritative V2 journal entries only.
 * Branch scope includes tenant-wide (null branchId) postings — same as income statement / CoA.
 * @param {string} tenantId
 * @param {{startDate?: Date, endDate?: Date, branchId?: string|null}} [filters]
 */
export function canonicalJournalEntryWhere(tenantId, filters = {}) {
  const dateFilter = journalDateFilter(filters.startDate, filters.endDate);
  const and = [];
  if (filters.branchId) {
    and.push({ OR: [{ branchId: filters.branchId }, { branchId: null }] });
  }
  if (dateFilter.OR) {
    and.push(dateFilter);
  }
  return {
    tenantId,
    status: { in: [...POSTED_JOURNAL_STATUSES] },
    architectureVersion: 'ACCOUNTING_V2',
    ...(and.length ? { AND: and } : {}),
  };
}

/**
 * Aggregate canonical debit/credit totals per posting account, in integer
 * minor units. Aggregation happens database-side (groupBy); only per-account
 * sums cross the wire.
 *
 * @param {import('@prisma/client').PrismaClient} db
 * @param {object} context AccountingContext
 * @param {{startDate?: Date, endDate?: Date, branchId?: string|null, accountIds?: string[]}} [filters]
 * @returns {Promise<Map<string, {debitMinor: number, creditMinor: number, lineCount: number}>>}
 *   keyed by the ORIGINAL posting accountId (merge rollup is presentation-layer)
 */
export async function getCanonicalAccountTotals(db, context, filters = {}) {
  assertLedgerContext(context);
  const tenantId = context.businessId;

  const jeHeaders = await db.journalEntry.findMany({
    where: canonicalJournalEntryWhere(tenantId, filters),
    select: { id: true },
  });

  const accountFilter = filters.accountIds?.length ? { accountId: { in: filters.accountIds } } : {};
  const totals = new Map();

  const fold = (rows) => {
    for (const row of rows) {
      const prev = totals.get(row.accountId) ?? { debitMinor: 0, creditMinor: 0, lineCount: 0 };
      totals.set(row.accountId, {
        debitMinor: prev.debitMinor + toMinor(row._sum?.debitAmount),
        creditMinor: prev.creditMinor + toMinor(row._sum?.creditAmount),
        lineCount: prev.lineCount + (row._count?._all ?? 0),
      });
    }
  };

  const CHUNK = 5000;
  for (let i = 0; i < jeHeaders.length; i += CHUNK) {
    const ids = jeHeaders.slice(i, i + CHUNK).map((r) => r.id);
    fold(
      await db.journalEntryLine.groupBy({
        by: ['accountId'],
        where: { journalEntryId: { in: ids }, ...accountFilter },
        _sum: { debitAmount: true, creditAmount: true },
        _count: { _all: true },
      })
    );
  }

  return totals;
}

/**
 * Normalize a legacy transaction line to the canonical line contract.
 * @param {object} line TransactionLine with `transaction` included
 */
export function normalizeTransactionLine(line) {
  const tx = line.transaction;
  const warnings = [];
  if (tx.status !== 'posted') warnings.push('NON_STANDARD_STATUS_CASING');
  if (!tx.sourceType || !tx.sourceId) warnings.push('MISSING_SOURCE_LINK');
  return {
    lineId: line.id,
    journalId: tx.id,
    journalKind: JOURNAL_KIND.LEGACY_TRANSACTION,
    journalNumber: null,
    reference: tx.reference ?? null,
    status: 'POSTED',
    postingDate: tx.date,
    entryDate: tx.date,
    postedAt: tx.postedDate ?? tx.createdAt,
    description: tx.description ?? null,
    lineDescription: line.description ?? null,
    lineNumber: line.lineNumber ?? 0,
    accountId: line.accountId,
    debitMinor: toMinor(line.debitAmount),
    creditMinor: toMinor(line.creditAmount),
    baseDebitMinor: toMinor(line.debitAmount),
    baseCreditMinor: toMinor(line.creditAmount),
    currency: null, // legacy lines carry no currency; base currency assumed
    entryType: tx.entryType ?? 'Regular',
    isReversal: tx.isReversal === true,
    reversedJournalId: tx.reversedTransactionId ?? null,
    reversedByJournalId: null,
    sourceType: tx.sourceType ?? null,
    sourceId: tx.sourceId ?? null,
    branchId: tx.branchId ?? null,
    dimensions: tx.branchId ? { branchId: tx.branchId } : null,
    dimensionStatus: tx.branchId ? 'PARTIAL' : 'UNASSIGNED',
    lineageReliable: Boolean(tx.sourceType && tx.sourceId),
    architectureVersion: 'LEGACY_V1',
    warnings,
  };
}

/**
 * Normalize a journal-entry line (legacy manual or V2) to the canonical contract.
 * @param {object} line JournalEntryLine with `journalEntry` included
 */
export function normalizeJournalEntryLine(line) {
  const je = line.journalEntry;
  const isV2 = je.architectureVersion === 'ACCOUNTING_V2';
  const warnings = [];
  if (!['Posted', 'Reversed', 'PartiallyReversed'].includes(je.status)) {
    warnings.push('NON_STANDARD_STATUS_CASING');
  }
  if (!je.postingDate && !je.entryDate) warnings.push('MISSING_ENTRY_DATE');
  const dimensions = {
    ...(je.branchId ? { branchId: je.branchId } : {}),
    ...(line.dimensions && typeof line.dimensions === 'object' ? line.dimensions : {}),
  };
  const hasDimensions = Object.keys(dimensions).length > 0;
  return {
    lineId: line.id,
    journalId: je.id,
    journalKind: isV2 ? JOURNAL_KIND.ACCOUNTING_V2 : JOURNAL_KIND.LEGACY_JOURNAL,
    journalNumber: je.journalNumber ?? null,
    reference: je.referenceNumber ?? null,
    status: 'POSTED',
    postingDate: je.postingDate ?? je.entryDate ?? je.createdAt,
    entryDate: je.entryDate ?? je.postingDate ?? je.createdAt,
    postedAt: je.postedDate ?? je.createdAt,
    description: je.description ?? null,
    lineDescription: line.description ?? null,
    lineNumber: line.lineNumber ?? 0,
    accountId: line.accountId,
    debitMinor: toMinor(line.debitAmount),
    creditMinor: toMinor(line.creditAmount),
    baseDebitMinor: line.baseDebit != null ? toMinor(line.baseDebit) : toMinor(line.debitAmount),
    baseCreditMinor: line.baseCredit != null ? toMinor(line.baseCredit) : toMinor(line.creditAmount),
    currency: line.currency ?? je.currency ?? null,
    entryType: je.entryType ?? 'Regular',
    isReversal: je.entryType === 'Reversal' || je.reversalStatus === 'REVERSAL',
    reversedJournalId: je.originalJournalId ?? null,
    reversedByJournalId: je.reversedByJournalId ?? null,
    sourceType: je.sourceType ?? null,
    sourceId: je.sourceId ?? null,
    branchId: je.branchId ?? null,
    dimensions: hasDimensions ? dimensions : null,
    dimensionStatus: line.dimensions && Object.keys(line.dimensions ?? {}).length > 0
      ? 'ASSIGNED'
      : hasDimensions
        ? 'PARTIAL'
        : 'UNASSIGNED',
    lineageReliable: isV2 ? Boolean(je.accountingEventId) : Boolean(je.sourceType && je.sourceId),
    architectureVersion: je.architectureVersion ?? 'LEGACY_V1',
    warnings,
  };
}

/**
 * Deterministic canonical ordering: posting date, posted-at, journal number /
 * reference, journal id, line number, line id. Total order — same input, same
 * output, no ties left to the database.
 */
export function compareCanonicalLines(a, b) {
  const dateA = new Date(a.postingDate).getTime();
  const dateB = new Date(b.postingDate).getTime();
  if (dateA !== dateB) return dateA - dateB;
  const postedA = new Date(a.postedAt ?? a.postingDate).getTime();
  const postedB = new Date(b.postedAt ?? b.postingDate).getTime();
  if (postedA !== postedB) return postedA - postedB;
  const numA = a.journalNumber ?? a.reference ?? '';
  const numB = b.journalNumber ?? b.reference ?? '';
  if (numA !== numB) return numA < numB ? -1 : 1;
  if (a.journalId !== b.journalId) return a.journalId < b.journalId ? -1 : 1;
  if (a.lineNumber !== b.lineNumber) return a.lineNumber - b.lineNumber;
  return a.lineId < b.lineId ? -1 : a.lineId > b.lineId ? 1 : 0;
}

/**
 * List canonical posted lines for a set of accounts (or all accounts) in a
 * window, normalized and canonically ordered (ascending).
 *
 * Both stores are queried with the same authority rules, merged, then sorted.
 * Windows are expected to be bounded by date and/or account; the merge happens
 * in memory for the filtered window only.
 *
 * @param {import('@prisma/client').PrismaClient} db
 * @param {object} context AccountingContext
 * @param {{
 *   accountIds?: string[], startDate?: Date, endDate?: Date,
 *   branchId?: string|null, currency?: string|null,
 *   dimensionKey?: string|null, dimensionValue?: string|null,
 * }} [filters]
 * @returns {Promise<Array<object>>} normalized canonical lines, ascending order
 */
export async function listCanonicalLines(db, context, filters = {}) {
  assertLedgerContext(context);
  const tenantId = context.businessId;
  const accountFilter = filters.accountIds?.length ? { accountId: { in: filters.accountIds } } : {};

  const jeLines = await db.journalEntryLine.findMany({
    where: {
      ...accountFilter,
      journalEntry: canonicalJournalEntryWhere(tenantId, filters),
    },
    include: { journalEntry: true },
  });

  let lines = jeLines.map(normalizeJournalEntryLine);

  if (filters.currency) {
    const base = context.baseCurrency ?? 'MWK';
    lines = lines.filter((l) => (l.currency ?? base) === filters.currency);
  }
  if (filters.dimensionKey) {
    const key = filters.dimensionKey;
    const value = filters.dimensionValue;
    lines = lines.filter((l) => {
      const dims = l.dimensions ?? {};
      if (value === 'UNASSIGNED') return dims[key] == null;
      if (value != null) return dims[key] === value;
      return dims[key] != null;
    });
  }

  lines.sort(compareCanonicalLines);
  return lines;
}

/**
 * Detect journal-authority conflicts: the same (sourceType, sourceId) counted
 * by BOTH an active legacy transaction and an included journal entry. The
 * Phase 4 legacy guard prevents new occurrences; this detects historical ones.
 * Conflicts are integrity blockers (GL-117) — the ledger never counts both
 * silently, and reconciliation surfaces every occurrence.
 *
 * @param {import('@prisma/client').PrismaClient} db
 * @param {object} context
 * @param {{startDate?: Date, endDate?: Date}} [filters]
 */
export async function findAuthorityConflicts(db, context, filters = {}) {
  assertLedgerContext(context);
  // Fresh-books: Transaction archive is unused, so dual-authority conflicts cannot occur.
  void db;
  void filters;
  return [];
}

/**
 * Posted journal headers that contribute no lines — legacy header-amount rows
 * (JRN-104 / Phase 1 JRN-009 population) plus any structurally empty posted
 * journals. These are invisible to the canonical ledger by construction and
 * must be surfaced, never silently included.
 */
export async function findHeaderOnlyJournals(db, context) {
  assertLedgerContext(context);
  const tenantId = context.businessId;
  const posted = await db.journalEntry.findMany({
    where: { tenantId, status: { in: [...POSTED_JOURNAL_STATUSES] }, transactionId: null },
    select: { id: true, debit: true, credit: true, entryDate: true, description: true },
  });
  if (posted.length === 0) return [];
  const results = [];
  const CHUNK = 5000;
  for (let i = 0; i < posted.length; i += CHUNK) {
    const batch = posted.slice(i, i + CHUNK);
    const counts = await db.journalEntryLine.groupBy({
      by: ['journalEntryId'],
      where: { journalEntryId: { in: batch.map((j) => j.id) } },
      _count: { _all: true },
    });
    const withLines = new Set(counts.map((c) => c.journalEntryId));
    for (const je of batch) {
      if (!withLines.has(je.id)) {
        results.push({
          rule: 'JRN-104',
          journalEntryId: je.id,
          headerDebit: je.debit ?? 0,
          headerCredit: je.credit ?? 0,
          entryDate: je.entryDate,
          description: je.description,
          impact:
            'Posted journal has no lines; header amounts (if any) are outside the canonical ledger. Repair via Phase 6 backing journals.',
        });
      }
    }
  }
  return results;
}
