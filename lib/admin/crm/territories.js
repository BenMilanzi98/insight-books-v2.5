/**
 * CRM territories + rule evaluation — Phase 11 Wave 3.
 * Deterministic; ambiguous matches → visible failure (never silent pick).
 * ≠ CS portfolio / Support queue / Tenant branch alone.
 */

import { CRM_TERRITORY_MATCH } from './catalogue.js';
import { resolveCrmAccess } from './authz.js';

export const CRM_TERRITORY_DEFINITIONS = Object.freeze([
  Object.freeze({
    code: 'MW_CENTRAL',
    name: 'Malawi Central',
    rules: Object.freeze([
      Object.freeze({
        matchType: CRM_TERRITORY_MATCH.COUNTRY,
        matchValue: 'MW',
        precedence: 100,
      }),
      Object.freeze({
        matchType: CRM_TERRITORY_MATCH.REGION,
        matchValue: 'CENTRAL',
        precedence: 200,
      }),
    ]),
  }),
  Object.freeze({
    code: 'MW_SOUTH',
    name: 'Malawi South',
    rules: Object.freeze([
      Object.freeze({
        matchType: CRM_TERRITORY_MATCH.COUNTRY,
        matchValue: 'MW',
        precedence: 100,
      }),
      Object.freeze({
        matchType: CRM_TERRITORY_MATCH.REGION,
        matchValue: 'SOUTH',
        precedence: 200,
      }),
    ]),
  }),
]);

export function hasCrmTerritoryModel(prisma) {
  return typeof prisma?.crmTerritory?.findMany === 'function';
}

export function hasCrmTerritoryRuleModel(prisma) {
  return typeof prisma?.crmTerritoryRule?.findMany === 'function';
}

function serializeTerritory(row, rules = []) {
  if (!row) return null;
  return {
    id: row.id || null,
    code: row.code,
    name: row.name || row.code,
    active: row.active !== false,
    defaultTeamId: row.defaultTeamId || null,
    defaultOwnerAdminId: row.defaultOwnerAdminId || null,
    rules: (rules || []).map((r) => ({
      id: r.id || null,
      matchType: r.matchType,
      matchValue: r.matchValue,
      precedence: Number(r.precedence) || 0,
    })),
    source: row.source || 'db',
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object }} args
 */
export async function listTerritories(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canViewTerritories) {
    return { ok: false, forbidden: true, reason: 'crm_view_territories_forbidden', items: [] };
  }

  if (!hasCrmTerritoryModel(prisma)) {
    return {
      ok: true,
      stub: true,
      items: CRM_TERRITORY_DEFINITIONS.map((t) =>
        serializeTerritory({ ...t, source: 'catalogue' }, [...t.rules])
      ),
      source: 'catalogue',
    };
  }

  try {
    const rows = await prisma.crmTerritory.findMany({
      where: { active: true },
      orderBy: { code: 'asc' },
    });
    if (!rows?.length) {
      return {
        ok: true,
        stub: true,
        items: CRM_TERRITORY_DEFINITIONS.map((t) =>
          serializeTerritory({ ...t, source: 'catalogue' }, [...t.rules])
        ),
        source: 'catalogue',
      };
    }

    const items = [];
    for (const row of rows) {
      let rules = [];
      if (hasCrmTerritoryRuleModel(prisma)) {
        try {
          rules = await prisma.crmTerritoryRule.findMany({
            where: { territoryId: row.id, active: true },
            orderBy: { precedence: 'desc' },
          });
        } catch {
          rules = [];
        }
      }
      items.push(serializeTerritory(row, rules));
    }
    return { ok: true, stub: false, items, source: 'db' };
  } catch {
    return {
      ok: true,
      stub: true,
      items: CRM_TERRITORY_DEFINITIONS.map((t) =>
        serializeTerritory({ ...t, source: 'catalogue' }, [...t.rules])
      ),
      source: 'catalogue',
    };
  }
}

async function loadTerritoryUniverse(prisma) {
  const listed = await listTerritories(prisma, {
    admin: { role: 'Super Admin', isActive: true },
  });
  return listed.items || [];
}

/**
 * Evaluate territory rules for a lead/account context.
 * Highest matching precedence wins; ties across territories → AMBIGUOUS failure.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   country?: string|null,
 *   region?: string|null,
 *   accountType?: string|null,
 *   leadType?: string|null,
 * }} context
 */
export async function evaluateTerritory(prisma, context = {}) {
  const territories = await loadTerritoryUniverse(prisma);
  const ctx = {
    [CRM_TERRITORY_MATCH.COUNTRY]: context.country
      ? String(context.country).trim().toUpperCase()
      : null,
    [CRM_TERRITORY_MATCH.REGION]: context.region
      ? String(context.region).trim().toUpperCase()
      : null,
    [CRM_TERRITORY_MATCH.ACCOUNT_TYPE]: context.accountType
      ? String(context.accountType).trim().toUpperCase()
      : null,
    [CRM_TERRITORY_MATCH.LEAD_TYPE]: context.leadType
      ? String(context.leadType).trim().toUpperCase()
      : null,
  };

  /** @type {Array<{territory: object, precedence: number, matchedRules: object[]}>} */
  const matches = [];

  for (const t of territories) {
    const matchedRules = [];
    let bestPrecedence = null;
    for (const rule of t.rules || []) {
      const type = String(rule.matchType || '').toUpperCase();
      const value = String(rule.matchValue || '').trim().toUpperCase();
      const ctxVal = ctx[type];
      if (!ctxVal || !value) continue;
      if (ctxVal === value) {
        matchedRules.push(rule);
        const p = Number(rule.precedence) || 0;
        if (bestPrecedence == null || p > bestPrecedence) bestPrecedence = p;
      }
    }
    if (matchedRules.length && bestPrecedence != null) {
      matches.push({ territory: t, precedence: bestPrecedence, matchedRules });
    }
  }

  if (!matches.length) {
    return {
      ok: false,
      error: 'TERRITORY_NO_MATCH',
      message: 'No territory rules matched the lead context',
      matches: [],
    };
  }

  const maxPrec = Math.max(...matches.map((m) => m.precedence));
  const top = matches.filter((m) => m.precedence === maxPrec);
  if (top.length > 1) {
    return {
      ok: false,
      error: 'TERRITORY_AMBIGUOUS',
      message: 'Multiple territories matched with equal precedence',
      matches: top.map((m) => ({
        code: m.territory.code,
        id: m.territory.id,
        precedence: m.precedence,
      })),
    };
  }

  const winner = top[0];
  return {
    ok: true,
    territory: winner.territory,
    precedence: winner.precedence,
    matchedRules: winner.matchedRules,
  };
}
