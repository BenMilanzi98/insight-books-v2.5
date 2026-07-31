/**
 * Versioned score definitions — catalogue default + optional DB rows.
 */

import { CRM_DEFAULT_SCORE_VERSION_ID } from './catalogue.js';
import { getDefaultScoreDefinition } from './catalogue.js';

function mapVersionRow(row) {
  if (!row) return null;
  const parse = (v, fallback) => {
    if (v == null) return fallback;
    if (typeof v === 'string') {
      try {
        return JSON.parse(v);
      } catch {
        return fallback;
      }
    }
    return v;
  };
  const catalogue = getDefaultScoreDefinition();
  return {
    key: row.key || null,
    name: row.name || null,
    versionId: row.versionId,
    status: row.status || 'ACTIVE',
    displayLabel: row.displayLabel || 'Lead fit score',
    dimensions: parse(row.dimensionsJson ?? row.dimensions, catalogue.dimensions),
    bands: parse(row.bandsJson ?? row.bands, catalogue.bands),
    criticalCaps: parse(row.criticalCapsJson ?? row.criticalCaps, catalogue.criticalCaps),
    source: 'db',
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} versionId
 */
export async function getScoreDefinitionByVersion(prisma, versionId) {
  const id = String(versionId || '').trim();
  if (!id) return null;

  const catalogue = getDefaultScoreDefinition();
  if (id === catalogue.versionId || id === CRM_DEFAULT_SCORE_VERSION_ID) {
    return { ...catalogue, source: 'catalogue' };
  }

  if (typeof prisma?.crmScoreDefinitionVersion?.findUnique === 'function') {
    try {
      const row = await prisma.crmScoreDefinitionVersion.findUnique({
        where: { versionId: id },
      });
      if (row) return mapVersionRow(row);
    } catch {
      // fall through
    }
  }
  return null;
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 */
export async function getActiveScoreDefinition(prisma) {
  if (typeof prisma?.crmScoreDefinitionVersion?.findFirst === 'function') {
    try {
      const row = await prisma.crmScoreDefinitionVersion.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
      });
      if (row) return mapVersionRow(row);
    } catch {
      // fall through
    }
  }
  const catalogue = getDefaultScoreDefinition();
  return { ...catalogue, source: 'catalogue' };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 */
export async function listScoreDefinitions(prisma) {
  const catalogue = getDefaultScoreDefinition();
  const items = [{ ...catalogue, source: 'catalogue' }];
  if (typeof prisma?.crmScoreDefinitionVersion?.findMany === 'function') {
    try {
      const rows = await prisma.crmScoreDefinitionVersion.findMany({
        orderBy: { versionId: 'asc' },
      });
      for (const row of rows || []) {
        if (row.versionId === catalogue.versionId) continue;
        items.push(mapVersionRow(row));
      }
    } catch {
      // catalogue only
    }
  }
  return { ok: true, items };
}
