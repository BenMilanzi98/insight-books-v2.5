/**
 * CRM sales teams — membership stubs (Phase 11 Wave 3).
 * ≠ SupportTeam / POS sales teams / CS portfolios.
 */

import { resolveCrmAccess } from './authz.js';

export const CRM_SALES_TEAM_DEFINITIONS = Object.freeze([
  Object.freeze({
    code: 'SALES_CORE',
    name: 'Core Sales',
    memberAdminIds: Object.freeze([]),
  }),
  Object.freeze({
    code: 'SALES_ENTERPRISE',
    name: 'Enterprise Sales',
    memberAdminIds: Object.freeze([]),
  }),
]);

export function hasCrmSalesTeamModel(prisma) {
  return typeof prisma?.crmSalesTeam?.findMany === 'function';
}

export function hasCrmSalesTeamMemberModel(prisma) {
  return typeof prisma?.crmSalesTeamMember?.findMany === 'function';
}

function serializeTeam(row, members = []) {
  if (!row) return null;
  return {
    id: row.id || null,
    code: row.code,
    name: row.name || row.code,
    active: row.active !== false,
    memberAdminIds: members.map((m) => m.adminId || m),
    source: row.source || 'db',
  };
}

/**
 * List sales teams (catalogue stubs when DB empty / unavailable).
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object }} args
 */
export async function listSalesTeams(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canViewTeams) {
    return { ok: false, forbidden: true, reason: 'crm_view_teams_forbidden', items: [] };
  }

  if (!hasCrmSalesTeamModel(prisma)) {
    return {
      ok: true,
      stub: true,
      items: CRM_SALES_TEAM_DEFINITIONS.map((t) =>
        serializeTeam({ ...t, source: 'catalogue' }, [...t.memberAdminIds])
      ),
      source: 'catalogue',
    };
  }

  try {
    const rows = await prisma.crmSalesTeam.findMany({
      where: { active: true },
      orderBy: { code: 'asc' },
    });
    if (!rows?.length) {
      return {
        ok: true,
        stub: true,
        items: CRM_SALES_TEAM_DEFINITIONS.map((t) =>
          serializeTeam({ ...t, source: 'catalogue' }, [...t.memberAdminIds])
        ),
        source: 'catalogue',
      };
    }

    const items = [];
    for (const row of rows) {
      let members = [];
      if (hasCrmSalesTeamMemberModel(prisma)) {
        try {
          members = await prisma.crmSalesTeamMember.findMany({
            where: { teamId: row.id, active: true },
          });
        } catch {
          members = [];
        }
      }
      items.push(serializeTeam(row, members));
    }
    return { ok: true, stub: false, items, source: 'db' };
  } catch {
    return {
      ok: true,
      stub: true,
      items: CRM_SALES_TEAM_DEFINITIONS.map((t) =>
        serializeTeam({ ...t, source: 'catalogue' }, [...t.memberAdminIds])
      ),
      source: 'catalogue',
    };
  }
}

/**
 * Resolve member admin ids for a team (for ROUND_ROBIN).
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} teamIdOrCode
 * @param {string[]} [fallbackMemberIds]
 */
export async function resolveTeamMemberAdminIds(prisma, teamIdOrCode, fallbackMemberIds = []) {
  const key = String(teamIdOrCode || '').trim();
  if (!key) return { ok: false, memberAdminIds: [], reason: 'team_required' };

  if (hasCrmSalesTeamModel(prisma)) {
    try {
      let team =
        (await prisma.crmSalesTeam.findFirst({
          where: { OR: [{ id: key }, { code: key }], active: true },
        })) || null;
      if (team && hasCrmSalesTeamMemberModel(prisma)) {
        const members = await prisma.crmSalesTeamMember.findMany({
          where: { teamId: team.id, active: true },
          orderBy: { adminId: 'asc' },
        });
        const ids = (members || []).map((m) => m.adminId).filter(Boolean);
        if (ids.length) return { ok: true, teamId: team.id, teamCode: team.code, memberAdminIds: ids };
        return { ok: true, teamId: team.id, teamCode: team.code, memberAdminIds: [...fallbackMemberIds] };
      }
    } catch {
      // fall through
    }
  }

  const stub = CRM_SALES_TEAM_DEFINITIONS.find((t) => t.code === key);
  if (stub) {
    const ids = stub.memberAdminIds.length ? [...stub.memberAdminIds] : [...fallbackMemberIds];
    return { ok: true, teamId: null, teamCode: stub.code, memberAdminIds: ids, stub: true };
  }

  if (fallbackMemberIds.length) {
    return { ok: true, teamId: key, teamCode: null, memberAdminIds: [...fallbackMemberIds] };
  }

  return { ok: false, memberAdminIds: [], reason: 'team_not_found' };
}
