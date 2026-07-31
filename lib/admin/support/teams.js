/**

 * Support teams — membership stubs for assignment eligibility (Phase 10 Wave 2).

 * Full roster / staffing metrics deferred; do not invent live headcount.

 */



import { SUPPORT_TEAM_DEFINITIONS } from './catalogue.js';



export function hasSupportTeamModel(prisma) {

  return typeof prisma?.supportTeam?.findMany === 'function';

}



/**

 * Catalogue team stubs (sync).

 */

export function listTeams(prisma) {

  if (prisma == null || !hasSupportTeamModel(prisma)) {

    return {

      ok: true,

      stub: true,

      items: SUPPORT_TEAM_DEFINITIONS.map((t) => ({

        code: t.code,

        name: t.name,

        queueCodes: [...t.queueCodes],

      })),

      source: 'catalogue',

    };

  }

  return listTeamsWithPrisma(prisma);

}



async function listTeamsWithPrisma(prisma) {

  let rows = [];

  try {

    rows = await prisma.supportTeam.findMany();

  } catch {

    rows = [];

  }



  if (!rows?.length) {

    return listTeams(null);

  }



  return {

    ok: true,

    stub: true,

    items: rows.map((r) => ({

      code: r.code,

      name: r.name || r.code,

      queueCodes: Array.isArray(r.queueCodes) ? r.queueCodes : [],

    })),

    source: 'db',

  };

}



/**

 * Wave 2 eligibility stub: any assigneeAdminId is accepted when assigner has

 * assignTickets. Optional membership rows can tighten later.

 *

 * @param {import('@prisma/client').PrismaClient} prisma

 * @param {{ adminId: string, queueCode?: string|null }} args

 */

export async function isEligibleAssignee(prisma, args = {}) {

  const adminId = args.adminId ? String(args.adminId).trim() : '';

  if (!adminId) return { ok: false, eligible: false, reason: 'adminId_required' };



  if (typeof prisma?.supportTeamMembership?.findMany !== 'function') {

    return { ok: true, eligible: true, stub: true, reason: 'membership_model_absent' };

  }



  try {

    const memberships = await prisma.supportTeamMembership.findMany({

      where: { adminId },

    });

    if (!memberships?.length) {

      // Stub: no membership rows ⇒ allow (definitions only; not live ops lockout)

      return { ok: true, eligible: true, stub: true, reason: 'no_membership_rows' };

    }

    if (!args.queueCode) {

      return { ok: true, eligible: true, stub: true };

    }

    const queueCode = String(args.queueCode).toUpperCase();

    const teamCodes = new Set(memberships.map((m) => m.teamCode));

    const matched = SUPPORT_TEAM_DEFINITIONS.some(

      (t) => teamCodes.has(t.code) && t.queueCodes.includes(queueCode)

    );

    return { ok: true, eligible: matched, stub: true };

  } catch {

    return { ok: true, eligible: true, stub: true, reason: 'membership_lookup_failed' };

  }

}


