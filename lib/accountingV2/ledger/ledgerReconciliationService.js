/**
 * Phase 5 — Ledger Reconciliation Service.
 *
 * Read-only comparisons proving (or disproving) that every balance surface
 * agrees with the canonical journal source:
 *
 *   1. GL-112 — canonical debits equal credits business-wide.
 *   2. GL-111 — stored `Account.balance` cache vs canonically derived balance.
 *   3. GL-114 — `AcctV2LedgerBalance` projection vs canonical totals.
 *   4. SURFACE — legacy trial-balance output vs canonical totals (per survivor
 *      account, 1-cent tolerance for the legacy float pipeline).
 *   5. Journal structure findings (JRN-1xx) via the integrity rule engine.
 *
 * Reconciliation NEVER mutates financial data. Every run is audited.
 */

import {
  getCanonicalAccountTotals,
  assertLedgerContext,
} from './canonicalJournalSource.js';
import { resolveNormalBalance } from './ledgerQueryService.js';
import { getProjectedAccountTotals } from './ledgerRebuildService.js';
import { runJournalIntegrityChecks, ruleInfo } from './integrityRules.js';
import { buildSurvivorResolver } from '../../accountMergeRollup.js';
import { minorToDecimalString, parseDecimalToMinor } from '../domain/money.js';
import { recordAccountingAudit } from '../infrastructure/auditTrail.js';

const toMinor = (v) =>
  v == null ? 0 : parseDecimalToMinor(typeof v === 'number' ? v.toFixed(2) : String(v));

function finding(rule, details) {
  const info = ruleInfo(rule);
  return { rule, severity: info.severity, description: info.description, ...details };
}

/**
 * @param {import('@prisma/client').PrismaClient} db
 * @param {object} context AccountingContext
 * @param {{
 *   startDate?: Date, endDate?: Date,
 *   compareStoredBalances?: boolean, compareProjection?: boolean,
 *   compareLegacyTrialBalance?: boolean, runJournalChecks?: boolean,
 *   legacyTrialBalanceFn?: Function,
 * }} [options]
 */
export async function runLedgerReconciliation(db, context, options = {}) {
  assertLedgerContext(context);
  const tenantId = context.businessId;
  const startedAt = Date.now();
  const findings = [];

  const canonicalTotals = await getCanonicalAccountTotals(db, context, {
    startDate: options.startDate,
    endDate: options.endDate,
  });

  // 1. GL-112 — double-entry invariant over the canonical union.
  let debitMinor = 0;
  let creditMinor = 0;
  for (const t of canonicalTotals.values()) {
    debitMinor += t.debitMinor;
    creditMinor += t.creditMinor;
  }
  if (debitMinor !== creditMinor) {
    findings.push(
      finding('GL-112', {
        debitMinor,
        creditMinor,
        differenceMinor: debitMinor - creditMinor,
        difference: minorToDecimalString(debitMinor - creditMinor),
      })
    );
  }

  const accounts = await db.account.findMany({
    where: { tenantId },
    select: {
      id: true,
      accountCode: true,
      code: true,
      accountName: true,
      name: true,
      accountType: true,
      type: true,
      balance: true,
      normalBalance: true,
      coaV2Category: true,
      coaV2NormalBalance: true,
      mergedIntoAccountId: true,
    },
  });
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  // GL-113 — activity on accounts missing from the chart.
  for (const accountId of canonicalTotals.keys()) {
    if (!accountById.has(accountId)) {
      findings.push(finding('GL-113', { accountId }));
    }
  }

  // 2. GL-111 — stored balance cache drift (all-time canonical derivation,
  //    normal-balance signed, matching the legacy cache's convention).
  if (options.compareStoredBalances !== false && !options.startDate && !options.endDate) {
    for (const account of accounts) {
      if (account.mergedIntoAccountId) continue; // cache meaning undefined for merged-away rows
      const t = canonicalTotals.get(account.id) ?? { debitMinor: 0, creditMinor: 0 };
      const { normalBalance } = resolveNormalBalance(account);
      const signed = t.debitMinor - t.creditMinor;
      const derivedDisplayMinor = normalBalance === 'CREDIT' ? -signed : signed;
      const storedMinor = toMinor(account.balance);
      if (storedMinor !== derivedDisplayMinor) {
        findings.push(
          finding('GL-111', {
            accountId: account.id,
            accountCode: account.accountCode || account.code || null,
            storedMinor,
            derivedMinor: derivedDisplayMinor,
            driftMinor: storedMinor - derivedDisplayMinor,
            drift: minorToDecimalString(storedMinor - derivedDisplayMinor),
            authority: 'Canonical journal lines are authoritative; the stored balance is a drifting cache (ADR-011).',
          })
        );
      }
    }
  }

  // 3. GL-114 — projection staleness (whole-history projection vs canonical).
  let projectionVersion = null;
  if (options.compareProjection !== false && !options.startDate && !options.endDate) {
    if (typeof db.acctV2LedgerBalance?.findFirst === 'function') {
      const { version, totals: projected } = await getProjectedAccountTotals(db, context);
      projectionVersion = version;
      if (version > 0) {
        const allIds = new Set([...canonicalTotals.keys(), ...projected.keys()]);
        for (const accountId of allIds) {
          const c = canonicalTotals.get(accountId) ?? { debitMinor: 0, creditMinor: 0 };
          const p = projected.get(accountId) ?? { debitMinor: 0, creditMinor: 0 };
          if (c.debitMinor !== p.debitMinor || c.creditMinor !== p.creditMinor) {
            findings.push(
              finding('GL-114', {
                accountId,
                canonical: { debitMinor: c.debitMinor, creditMinor: c.creditMinor },
                projected: { debitMinor: p.debitMinor, creditMinor: p.creditMinor },
                remediation: 'Run the ledger rebuild service; the projection is a cache and is safely rebuildable.',
              })
            );
          }
        }
      }
    }
  }

  // 4. SURFACE — legacy trial balance vs canonical (survivor rollup, 1-cent
  //    tolerance for the legacy float pipeline).
  if (options.compareLegacyTrialBalance && typeof options.legacyTrialBalanceFn === 'function') {
    try {
      const tb = await options.legacyTrialBalanceFn(context, {
        startDate: options.startDate ?? new Date('1970-01-01'),
        endDate: options.endDate ?? new Date(),
      }, db);
      const { survivorOf } = buildSurvivorResolver(
        accounts.map((a) => ({ id: a.id, mergedIntoAccountId: a.mergedIntoAccountId }))
      );
      const canonicalBySurvivor = new Map();
      for (const [accountId, t] of canonicalTotals) {
        const sid = survivorOf(accountId) ?? accountId;
        const prev = canonicalBySurvivor.get(sid) ?? { debitMinor: 0, creditMinor: 0 };
        canonicalBySurvivor.set(sid, {
          debitMinor: prev.debitMinor + t.debitMinor,
          creditMinor: prev.creditMinor + t.creditMinor,
        });
      }
      const tbRows = tb?.rows ?? tb?.accounts ?? [];
      for (const row of tbRows) {
        const accountId = row.accountId ?? row.id;
        if (!accountId) continue;
        const c = canonicalBySurvivor.get(accountId) ?? { debitMinor: 0, creditMinor: 0 };
        const tbDebit = toMinor(row.totalDebit ?? row.debit ?? 0);
        const tbCredit = toMinor(row.totalCredit ?? row.credit ?? 0);
        if (Math.abs(tbDebit - c.debitMinor) > 1 || Math.abs(tbCredit - c.creditMinor) > 1) {
          findings.push(
            finding('GL-115', {
              accountId,
              legacyTrialBalance: { debitMinor: tbDebit, creditMinor: tbCredit },
              canonical: c,
              surface: 'legacy trial balance',
            })
          );
        }
      }
    } catch (error) {
      findings.push(
        finding('GL-115', {
          surface: 'legacy trial balance',
          error: `Legacy trial balance could not be computed for comparison: ${error.message}`,
        })
      );
    }
  }

  // 5. Journal structure checks.
  if (options.runJournalChecks !== false) {
    findings.push(
      ...(await runJournalIntegrityChecks(db, context, {
        startDate: options.startDate,
        endDate: options.endDate,
      }))
    );
  }

  const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const f of findings) counts[f.severity] = (counts[f.severity] ?? 0) + 1;
  const status =
    counts.CRITICAL > 0 ? 'CRITICAL' : counts.HIGH > 0 ? 'DEGRADED' : 'HEALTHY';

  const report = {
    tenantId,
    window: {
      startDate: options.startDate ?? null,
      endDate: options.endDate ?? null,
      allTime: !options.startDate && !options.endDate,
    },
    canonical: {
      accounts: canonicalTotals.size,
      debit: minorToDecimalString(debitMinor),
      credit: minorToDecimalString(creditMinor),
      balanced: debitMinor === creditMinor,
    },
    projectionVersion,
    status,
    counts,
    findings,
    durationMs: Date.now() - startedAt,
    ranAt: new Date().toISOString(),
  };

  if (typeof db.auditLog?.create === 'function') {
    await recordAccountingAudit(
      {
        action: 'acctv2.ledger.reconciliation',
        entityType: 'LedgerReconciliation',
        entityId: `${tenantId}:${report.ranAt}`,
        userId: context.userId,
        tenantId,
        newValues: { status, counts, findingsSample: findings.slice(0, 25) },
        requestId: context.requestId,
        correlationId: context.correlationId,
      },
      db
    );
  }

  return report;
}
