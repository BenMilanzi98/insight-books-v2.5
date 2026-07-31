/**
 * Phase 5 — Ledger Rebuild Service.
 *
 * Rebuilds the NON-AUTHORITATIVE `AcctV2LedgerBalance` summary projection
 * (monthly per-account base-currency aggregates) from the canonical journal
 * source. The projection is a rebuildable cache per the read-model decision
 * (GENERAL_LEDGER_READ_MODEL_DECISION.md): direct canonical queries remain the
 * authoritative read path; the projection only accelerates summary views and
 * gives reconciliation a drift sentinel.
 *
 * Safety model:
 *  - New rows are written under a NEW projectionVersion inside a transaction.
 *  - The new projection is validated against canonical totals BEFORE the old
 *    version is removed; a failed validation aborts and leaves the previous
 *    projection untouched.
 *  - Rebuilds run per business, never touch journals, and are fully audited.
 */

import {
  getCanonicalAccountTotals,
  canonicalTransactionWhere,
  canonicalJournalEntryWhere,
  assertLedgerContext,
} from './canonicalJournalSource.js';
import { minorToDecimalString, parseDecimalToMinor } from '../domain/money.js';
import { recordAccountingAudit } from '../infrastructure/auditTrail.js';
import { AccountingValidationError } from '../domain/errors.js';

const toMinor = (v) =>
  v == null ? 0 : parseDecimalToMinor(typeof v === 'number' ? v.toFixed(2) : String(v));

const BASE_CURRENCY = 'MWK';

function monthKey(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthBounds(key) {
  const [year, month] = key.split('-').map(Number);
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1) - 1),
  };
}

/** Enumerate every YYYY-MM key between two dates inclusive. */
function monthRange(minDate, maxDate) {
  const keys = [];
  const cursor = new Date(Date.UTC(new Date(minDate).getUTCFullYear(), new Date(minDate).getUTCMonth(), 1));
  const stop = new Date(maxDate).getTime();
  while (cursor.getTime() <= stop) {
    keys.push(monthKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return keys;
}

/** Discover the posting-date span of canonical activity for a business. */
async function findActivitySpan(db, tenantId) {
  const [txFirst, txLast, jeFirst, jeLast] = await Promise.all([
    db.transaction.findFirst({ where: canonicalTransactionWhere(tenantId), orderBy: { date: 'asc' }, select: { date: true } }),
    db.transaction.findFirst({ where: canonicalTransactionWhere(tenantId), orderBy: { date: 'desc' }, select: { date: true } }),
    db.journalEntry.findFirst({ where: canonicalJournalEntryWhere(tenantId), orderBy: { entryDate: 'asc' }, select: { entryDate: true, postingDate: true } }),
    db.journalEntry.findFirst({ where: canonicalJournalEntryWhere(tenantId), orderBy: { entryDate: 'desc' }, select: { entryDate: true, postingDate: true } }),
  ]);
  const dates = [
    txFirst?.date,
    txLast?.date,
    jeFirst?.postingDate ?? jeFirst?.entryDate,
    jeLast?.postingDate ?? jeLast?.entryDate,
  ].filter(Boolean);
  if (dates.length === 0) return null;
  const times = dates.map((d) => new Date(d).getTime());
  return { min: new Date(Math.min(...times)), max: new Date(Math.max(...times)) };
}

/** Highest projection version currently stored for a business (0 if none). */
export async function getActiveProjectionVersion(db, tenantId) {
  const row = await db.acctV2LedgerBalance.findFirst({
    where: { tenantId },
    orderBy: { projectionVersion: 'desc' },
    select: { projectionVersion: true },
  });
  return row?.projectionVersion ?? 0;
}

/**
 * Rebuild the ledger projection for a business.
 *
 * @param {import('@prisma/client').PrismaClient} db
 * @param {object} context AccountingContext
 * @param {{dryRun?: boolean, reason?: string}} [options]
 * @returns {Promise<object>} rebuild report
 */
export async function rebuildLedgerProjection(db, context, options = {}) {
  assertLedgerContext(context);
  const tenantId = context.businessId;
  const startedAt = Date.now();

  const span = await findActivitySpan(db, tenantId);
  const months = span ? monthRange(span.min, span.max) : [];

  // Month-by-month DB-side aggregation: bounded memory on any history size.
  const rows = [];
  for (const key of months) {
    const { start, end } = monthBounds(key);
    const totals = await getCanonicalAccountTotals(db, context, { startDate: start, endDate: end });
    for (const [accountId, t] of totals) {
      if (t.debitMinor === 0 && t.creditMinor === 0 && t.lineCount === 0) continue;
      rows.push({
        tenantId,
        accountId,
        periodKey: key,
        currency: BASE_CURRENCY,
        debit: minorToDecimalString(t.debitMinor),
        credit: minorToDecimalString(t.creditMinor),
        baseDebit: minorToDecimalString(t.debitMinor),
        baseCredit: minorToDecimalString(t.creditMinor),
        lineCount: t.lineCount,
      });
    }
  }

  // Validation input: whole-window canonical totals must equal the projection sums.
  const canonicalTotals = await getCanonicalAccountTotals(db, context, {});
  const projectedByAccount = new Map();
  for (const row of rows) {
    const prev = projectedByAccount.get(row.accountId) ?? { debitMinor: 0, creditMinor: 0 };
    projectedByAccount.set(row.accountId, {
      debitMinor: prev.debitMinor + toMinor(row.debit),
      creditMinor: prev.creditMinor + toMinor(row.credit),
    });
  }
  const validationErrors = [];
  for (const [accountId, t] of canonicalTotals) {
    const p = projectedByAccount.get(accountId) ?? { debitMinor: 0, creditMinor: 0 };
    if (p.debitMinor !== t.debitMinor || p.creditMinor !== t.creditMinor) {
      validationErrors.push({
        accountId,
        canonical: { debitMinor: t.debitMinor, creditMinor: t.creditMinor },
        projected: p,
      });
    }
  }
  if (validationErrors.length > 0) {
    throw new AccountingValidationError(
      'Ledger projection rebuild failed validation against the canonical source; previous projection left untouched.',
      validationErrors.slice(0, 20).map((e) => ({ path: e.accountId, message: 'projection/canonical mismatch' }))
    );
  }

  const previousVersion = await getActiveProjectionVersion(db, tenantId);
  const newVersion = previousVersion + 1;

  const report = {
    tenantId,
    dryRun: options.dryRun === true,
    previousVersion,
    newVersion: options.dryRun ? null : newVersion,
    months: months.length,
    rows: rows.length,
    accounts: projectedByAccount.size,
    validated: true,
    durationMs: 0,
  };

  if (!options.dryRun) {
    await db.$transaction(async (tx) => {
      for (const row of rows) {
        await tx.acctV2LedgerBalance.create({ data: { ...row, projectionVersion: newVersion } });
      }
      await tx.acctV2LedgerBalance.deleteMany({
        where: { tenantId, projectionVersion: { lt: newVersion } },
      });
    });
    await recordAccountingAudit(
      {
        action: 'acctv2.ledger.rebuild',
        entityType: 'AcctV2LedgerBalance',
        entityId: `${tenantId}:v${newVersion}`,
        userId: context.userId,
        tenantId,
        newValues: { newVersion, rows: rows.length, months: months.length },
        reason: options.reason ?? 'ledger projection rebuild',
        requestId: context.requestId,
        correlationId: context.correlationId,
      },
      db
    );
  }

  report.durationMs = Date.now() - startedAt;
  return report;
}

/**
 * Read current projection sums per account (summary acceleration only —
 * callers needing authoritative figures use the canonical source directly).
 */
export async function getProjectedAccountTotals(db, context) {
  assertLedgerContext(context);
  const tenantId = context.businessId;
  const version = await getActiveProjectionVersion(db, tenantId);
  if (version === 0) return { version: 0, totals: new Map() };
  const rows = await db.acctV2LedgerBalance.findMany({
    where: { tenantId, projectionVersion: version },
  });
  const totals = new Map();
  for (const row of rows) {
    const prev = totals.get(row.accountId) ?? { debitMinor: 0, creditMinor: 0, lineCount: 0 };
    totals.set(row.accountId, {
      debitMinor: prev.debitMinor + toMinor(row.debit),
      creditMinor: prev.creditMinor + toMinor(row.credit),
      lineCount: prev.lineCount + (row.lineCount ?? 0),
    });
  }
  return { version, totals };
}
