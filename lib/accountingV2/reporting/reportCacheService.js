/**
 * Phase 7 — rebuildable report cache (§52).
 *
 * The General Ledger stays authoritative. Cache entries are business- and
 * scope-keyed, store the definition version and a source-data version, and
 * every read validates that version against the canonical journal source:
 * any journal posting, reversal, adjustment or approved historical repair
 * changes the version and the entry is rebuilt. Stale entries are NEVER
 * presented as fresh or verified.
 */

import { getAccountingDataVersion } from './reportRunService.js';

/**
 * Read-through cache. `generate` produces the canonical result when the cache
 * misses or is stale.
 * @returns {{envelope: object, cache: {hit: boolean, stale: boolean, sourceDataVersion: string}}}
 */
export async function getOrBuildCachedReport(db, context, request, filtersHash, generate) {
  const sourceDataVersion = await getAccountingDataVersion(db, context);
  const where = {
    tenantId: context.businessId,
    reportType: request.reportType,
    filtersHash,
    definitionVersion: request.reportDefinitionVersion ?? '1.0.0',
  };
  const cached = await db.acctV2ReportCache.findFirst({ where });
  if (cached && cached.sourceDataVersion === sourceDataVersion) {
    return {
      envelope: cached.payload,
      cache: { hit: true, stale: false, sourceDataVersion },
    };
  }
  const envelope = await generate();
  const payload = JSON.parse(JSON.stringify(envelope));
  if (cached) {
    await db.acctV2ReportCache.update({
      where: { id: cached.id },
      data: { payload, sourceDataVersion, builtAt: new Date() },
    });
  } else {
    await db.acctV2ReportCache.create({
      data: { ...where, payload, sourceDataVersion },
    });
  }
  return {
    envelope,
    cache: { hit: false, stale: Boolean(cached), sourceDataVersion },
  };
}

/** Rebuild (invalidate) every cache entry for a business, or one report type. */
export async function rebuildReportCache(db, context, { reportType = null } = {}) {
  const where = {
    tenantId: context.businessId,
    ...(reportType ? { reportType } : {}),
  };
  const removed = await db.acctV2ReportCache.deleteMany({ where });
  return { invalidated: removed.count ?? 0 };
}

/**
 * Cache reconciliation (§52/REP-030): compare each cache entry's payload
 * checksum against a fresh canonical generation for the same scope.
 */
export async function reconcileReportCache(db, context, regenerateFor) {
  const entries = await db.acctV2ReportCache.findMany({
    where: { tenantId: context.businessId },
  });
  const sourceDataVersion = await getAccountingDataVersion(db, context);
  const findings = [];
  for (const entry of entries) {
    if (entry.sourceDataVersion !== sourceDataVersion) {
      findings.push({
        code: 'REP-030',
        cacheId: entry.id,
        reportType: entry.reportType,
        message: 'Cache entry is stale (source data changed since it was built).',
        severity: 'MEDIUM',
        action: 'REBUILD',
      });
      continue;
    }
    if (regenerateFor) {
      const fresh = await regenerateFor(entry);
      if (fresh && JSON.stringify(fresh.totals) !== JSON.stringify(entry.payload?.totals)) {
        findings.push({
          code: 'REP-030',
          cacheId: entry.id,
          reportType: entry.reportType,
          message: 'Cache totals differ from the canonical query for the same scope.',
          severity: 'CRITICAL',
          action: 'REBUILD',
        });
      }
    }
  }
  return { entries: entries.length, findings };
}
