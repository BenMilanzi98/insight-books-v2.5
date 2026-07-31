/**
 * Versioned qualification definitions — catalogue default + optional DB rows.
 * Never invent a newer default for an unknown versionId (SLA pattern).
 */

import {
  CRM_DEFAULT_QUALIFICATION_VERSION_ID,
  CRM_QUALIFICATION_DEFINITION_STATUS,
} from './catalogue.js';
import { getDefaultQualificationDefinition } from './catalogue.js';

function mapVersionRow(row) {
  if (!row) return null;
  const criteria =
    typeof row.criteriaJson === 'string'
      ? JSON.parse(row.criteriaJson)
      : row.criteriaJson || row.criteria || [];
  return {
    key: row.key || row.definitionKey || null,
    name: row.name || null,
    versionId: row.versionId,
    status: row.status || CRM_QUALIFICATION_DEFINITION_STATUS.ACTIVE,
    criteria: Array.isArray(criteria) ? criteria : [],
    source: 'db',
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} versionId
 */
export async function getQualificationDefinitionByVersion(prisma, versionId) {
  const id = String(versionId || '').trim();
  if (!id) return null;

  const catalogue = getDefaultQualificationDefinition();
  if (id === catalogue.versionId || id === CRM_DEFAULT_QUALIFICATION_VERSION_ID) {
    return { ...catalogue, source: 'catalogue' };
  }

  if (typeof prisma?.crmQualificationDefinitionVersion?.findUnique === 'function') {
    try {
      const row = await prisma.crmQualificationDefinitionVersion.findUnique({
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
 * Resolve active definition (catalogue default unless DB has ACTIVE row).
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 */
export async function getActiveQualificationDefinition(prisma) {
  if (typeof prisma?.crmQualificationDefinitionVersion?.findFirst === 'function') {
    try {
      const row = await prisma.crmQualificationDefinitionVersion.findFirst({
        where: { status: CRM_QUALIFICATION_DEFINITION_STATUS.ACTIVE },
        orderBy: { createdAt: 'desc' },
      });
      if (row) return mapVersionRow(row);
    } catch {
      // fall through
    }
  }
  const catalogue = getDefaultQualificationDefinition();
  return { ...catalogue, source: 'catalogue' };
}

/**
 * List definitions for admin UI.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 */
export async function listQualificationDefinitions(prisma) {
  const items = [];
  const catalogue = getDefaultQualificationDefinition();
  items.push({ ...catalogue, source: 'catalogue' });

  if (typeof prisma?.crmQualificationDefinitionVersion?.findMany === 'function') {
    try {
      const rows = await prisma.crmQualificationDefinitionVersion.findMany({
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
