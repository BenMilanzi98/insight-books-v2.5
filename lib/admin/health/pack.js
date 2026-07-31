/**
 * Health overview pack — band counts from latest snapshots (not live fleet evaluate).
 */

import {
  HEALTH_BANDS,
  HEALTH_CATALOGUE_NOTES,
  HEALTH_DEFINITION_VERSION,
} from './catalogue.js';
import {
  resolveHealthAccess,
  resolveHealthPortfolioScope,
  healthTenantIdFilter,
} from './authz.js';
import { getActiveHealthDefinition } from './definitions.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, now?: Date }} opts
 */
export async function buildHealthOverviewPack(prisma, opts = {}) {
  const access = resolveHealthAccess(opts.admin);
  if (!access.canView) {
    return {
      ok: false,
      forbidden: true,
      definitionVersion: HEALTH_DEFINITION_VERSION,
    };
  }

  const now = opts.now || new Date();
  const definition = await getActiveHealthDefinition(prisma);
  const scope = await resolveHealthPortfolioScope(prisma, opts.admin, { now });

  const bandCounts = Object.fromEntries(
    Object.values(HEALTH_BANDS).map((b) => [b, 0])
  );
  const limitations = [
    ...HEALTH_CATALOGUE_NOTES,
    'Overview band counts prefer latest snapshots per tenant — not live fleet evaluate.',
  ];

  let snapshotRows = [];
  if (typeof prisma?.customerHealthSnapshot?.findMany === 'function') {
    try {
      const where = {};
      const tenantFilter = healthTenantIdFilter(scope);
      if (tenantFilter) where.tenantId = tenantFilter;
      snapshotRows = await prisma.customerHealthSnapshot.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 2000,
        select: {
          tenantId: true,
          band: true,
          score: true,
          confidence: true,
          createdAt: true,
        },
      });
    } catch (e) {
      limitations.push(`Snapshot query failed: ${e?.message || 'error'}`);
      snapshotRows = [];
    }
  } else {
    limitations.push(
      'CustomerHealthSnapshot unavailable — band counts empty until SQL fallback / prisma generate.'
    );
  }

  const latestByTenant = new Map();
  for (const row of snapshotRows) {
    if (!latestByTenant.has(row.tenantId)) {
      latestByTenant.set(row.tenantId, row);
    }
  }

  for (const row of latestByTenant.values()) {
    const band = row.band || HEALTH_BANDS.UNKNOWN;
    if (bandCounts[band] == null) bandCounts[band] = 0;
    bandCounts[band] += 1;
  }

  return {
    ok: true,
    definitionVersion: definition.version,
    missingPolicy: definition.missingPolicy,
    bands: definition.bands,
    weights: definition.weights,
    bandCounts,
    tenantsWithSnapshots: latestByTenant.size,
    asOf: now.toISOString(),
    limitations,
    disclaimer:
      'Health is explainable evidence — not churn or renewal probability. Missing dims are N/A, never 0.',
  };
}

/**
 * Export pack — tenant id/name + scores/drivers (no password hashes).
 */
export async function buildHealthExportPack(prisma, opts = {}) {
  const access = resolveHealthAccess(opts.admin);
  if (!access.canView) {
    return { ok: false, forbidden: true };
  }

  const now = opts.now || new Date();
  const scope = await resolveHealthPortfolioScope(prisma, opts.admin, { now });
  const where = {};
  const tenantFilter = healthTenantIdFilter(scope);
  if (tenantFilter) where.tenantId = tenantFilter;

  let rows = [];
  if (typeof prisma?.customerHealthSnapshot?.findMany === 'function') {
    const snaps = await prisma.customerHealthSnapshot.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(500, Math.max(1, parseInt(String(opts.pageSize || 100), 10) || 100)),
    });
    const seen = new Set();
    for (const s of snaps) {
      if (seen.has(s.tenantId)) continue;
      seen.add(s.tenantId);
      const payload = s.payload || {};
      rows.push({
        tenantId: s.tenantId,
        displayName: payload.customer?.displayName || null,
        customerReference: payload.customer?.customerReference || null,
        score: s.score,
        band: s.band,
        confidence: s.confidence,
        definitionVersion: s.definitionVersion,
        asOf: s.asOf,
        drivers: payload.drivers || [],
        overrides: payload.overrides || [],
      });
    }
  }

  return {
    ok: true,
    dataset: 'health_snapshots',
    definitionVersion: HEALTH_DEFINITION_VERSION,
    exportedAt: now.toISOString(),
    rows,
    limitations: [
      'Latest snapshot per tenant (capped). Not a churn probability export.',
      'Never includes Tenant Sale or password hashes.',
    ],
  };
}

export function formatHealthExportCsv(pack) {
  const header = [
    'tenantId',
    'displayName',
    'customerReference',
    'score',
    'band',
    'confidence',
    'definitionVersion',
    'asOf',
  ];
  const lines = [header.join(',')];
  for (const r of pack?.rows || []) {
    lines.push(
      [
        r.tenantId,
        csvEscape(r.displayName),
        csvEscape(r.customerReference),
        r.score == null ? '' : r.score,
        r.band,
        r.confidence,
        r.definitionVersion,
        r.asOf instanceof Date ? r.asOf.toISOString() : r.asOf || '',
      ].join(',')
    );
  }
  return lines.join('\n');
}

function csvEscape(value) {
  if (value == null) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
