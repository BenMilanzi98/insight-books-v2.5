/**
 * CRM lead assignment — Phase 11 Wave 3.
 * Strategies: MANUAL + ROUND_ROBIN + TERRITORY_BASED.
 * Same owner+team → noop (no silent reassign loops / history spam).
 * Every ownership change writes assignment history.
 */

import {
  CRM_ASSIGNMENT_ACTION,
  CRM_ASSIGNMENT_STRATEGY,
  CRM_LEAD_STATUS,
} from './catalogue.js';
import { resolveCrmAccess } from './authz.js';
import { hasCrmLeadModel, serializeLead } from './leads.js';
import { canTransition, assertTransition } from './stateMachine.js';
import { resolveTeamMemberAdminIds } from './teams.js';
import { evaluateTerritory } from './territories.js';

export function hasCrmAssignmentHistoryModel(prisma) {
  return typeof prisma?.crmAssignmentHistory?.create === 'function';
}

function serializeAssignmentHistory(row) {
  if (!row) return null;
  return {
    id: row.id || null,
    leadId: row.leadId,
    action: row.action,
    strategy: row.strategy || null,
    fromOwnerAdminId: row.fromOwnerAdminId || null,
    toOwnerAdminId: row.toOwnerAdminId || null,
    fromTeamId: row.fromTeamId || null,
    toTeamId: row.toTeamId || null,
    territoryId: row.territoryId || null,
    changedByAdminId: row.changedByAdminId || null,
    reason: row.reason || null,
    assignedAt: row.assignedAt ? new Date(row.assignedAt).toISOString() : null,
    acceptedAt: row.acceptedAt ? new Date(row.acceptedAt).toISOString() : null,
    at: row.at ? new Date(row.at).toISOString() : null,
  };
}

async function appendHistory(prisma, data) {
  if (!hasCrmAssignmentHistoryModel(prisma)) return null;
  return prisma.crmAssignmentHistory.create({ data });
}

async function findLead(prisma, leadId) {
  const id = String(leadId || '').trim();
  if (!id) return null;
  try {
    return await prisma.crmLead.findUnique({ where: { id } });
  } catch {
    return null;
  }
}

/**
 * Pick next ROUND_ROBIN owner from sorted member list using assignment history count.
 */
async function pickRoundRobinOwner(prisma, memberAdminIds, teamId) {
  const members = [...new Set(memberAdminIds.filter(Boolean))].sort();
  if (!members.length) return null;
  if (!hasCrmAssignmentHistoryModel(prisma)) return members[0];

  try {
    const counts = await Promise.all(
      members.map(async (adminId) => {
        let n = 0;
        try {
          n = await prisma.crmAssignmentHistory.count({
            where: {
              toOwnerAdminId: adminId,
              ...(teamId ? { toTeamId: teamId } : {}),
              action: { in: [CRM_ASSIGNMENT_ACTION.ASSIGN, CRM_ASSIGNMENT_ACTION.REASSIGN] },
            },
          });
        } catch {
          n = 0;
        }
        return { adminId, n };
      })
    );
    counts.sort((a, b) => a.n - b.n || a.adminId.localeCompare(b.adminId));
    return counts[0].adminId;
  } catch {
    return members[0];
  }
}

/**
 * Assign / reassign a lead.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   leadId: string,
 *   strategy?: string,
 *   ownerAdminId?: string|null,
 *   teamId?: string|null,
 *   memberAdminIds?: string[],
 *   territoryContext?: object,
 *   reason?: string|null,
 *   now?: Date,
 * }} args
 */
export async function assignLead(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canAssignLeads) {
    return { ok: false, forbidden: true, reason: 'crm_assign_forbidden' };
  }

  if (!hasCrmLeadModel(prisma)) {
    return { ok: false, error: 'crm_lead_model_unavailable', status: 'UNAVAILABLE' };
  }

  const lead = await findLead(prisma, args.leadId);
  if (!lead) return { ok: false, notFound: true, error: 'lead_not_found' };

  const strategy = String(args.strategy || CRM_ASSIGNMENT_STRATEGY.MANUAL)
    .trim()
    .toUpperCase();
  if (!Object.values(CRM_ASSIGNMENT_STRATEGY).includes(strategy)) {
    return { ok: false, error: 'invalid_strategy', strategy };
  }

  let ownerAdminId =
    args.ownerAdminId != null && String(args.ownerAdminId).trim() !== ''
      ? String(args.ownerAdminId).trim()
      : null;
  let teamId =
    args.teamId != null && String(args.teamId).trim() !== ''
      ? String(args.teamId).trim()
      : lead.teamId || null;
  let territoryId = lead.territoryId || null;

  if (strategy === CRM_ASSIGNMENT_STRATEGY.MANUAL) {
    if (!ownerAdminId) return { ok: false, error: 'ownerAdminId_required' };
  } else if (strategy === CRM_ASSIGNMENT_STRATEGY.ROUND_ROBIN) {
    if (!teamId) return { ok: false, error: 'teamId_required_for_round_robin' };
    const team = await resolveTeamMemberAdminIds(
      prisma,
      teamId,
      args.memberAdminIds || []
    );
    if (!team.ok || !team.memberAdminIds.length) {
      return {
        ok: false,
        error: 'round_robin_no_members',
        reason: team.reason || 'no_members',
      };
    }
    teamId = team.teamId || teamId;
    ownerAdminId = await pickRoundRobinOwner(prisma, team.memberAdminIds, teamId);
    if (!ownerAdminId) return { ok: false, error: 'round_robin_pick_failed' };
  } else if (strategy === CRM_ASSIGNMENT_STRATEGY.TERRITORY_BASED) {
    const terr = await evaluateTerritory(prisma, args.territoryContext || {});
    if (!terr.ok) {
      return {
        ok: false,
        error: terr.error,
        message: terr.message,
        matches: terr.matches || [],
      };
    }
    territoryId = terr.territory.id || terr.territory.code;
    teamId = terr.territory.defaultTeamId || teamId;
    ownerAdminId =
      terr.territory.defaultOwnerAdminId ||
      args.ownerAdminId ||
      ownerAdminId;
    if (!ownerAdminId && teamId) {
      const team = await resolveTeamMemberAdminIds(
        prisma,
        teamId,
        args.memberAdminIds || []
      );
      if (team.ok && team.memberAdminIds.length) {
        ownerAdminId = await pickRoundRobinOwner(prisma, team.memberAdminIds, teamId);
      }
    }
    if (!ownerAdminId) {
      return {
        ok: false,
        error: 'territory_owner_unresolved',
        territory: terr.territory,
      };
    }
  }

  const sameOwner = (lead.ownerAdminId || null) === ownerAdminId;
  const sameTeam = (lead.teamId || null) === (teamId || null);
  if (sameOwner && sameTeam) {
    return {
      ok: true,
      noop: true,
      lead: serializeLead(lead),
      message: 'same_owner_and_team',
    };
  }

  const now = args.now || new Date();
  const fromOwner = lead.ownerAdminId || null;
  const fromTeam = lead.teamId || null;
  const action =
    fromOwner && fromOwner !== ownerAdminId
      ? CRM_ASSIGNMENT_ACTION.REASSIGN
      : CRM_ASSIGNMENT_ACTION.ASSIGN;

  const data = {
    ownerAdminId,
    teamId: teamId || null,
    territoryId: territoryId || null,
    assignedAt: now,
    acceptedAt: null,
    updatedAt: now,
  };

  let statusTransitioned = false;
  if (
    lead.status !== CRM_LEAD_STATUS.ASSIGNED &&
    canTransition(lead.status, CRM_LEAD_STATUS.ASSIGNED)
  ) {
    const gate = assertTransition(lead.status, CRM_LEAD_STATUS.ASSIGNED, {
      reason: args.reason,
    });
    if (gate.ok) {
      data.status = CRM_LEAD_STATUS.ASSIGNED;
      statusTransitioned = true;
    }
  }

  const updated = await prisma.crmLead.update({
    where: { id: lead.id },
    data,
  });

  const history = await appendHistory(prisma, {
    leadId: lead.id,
    action,
    strategy,
    fromOwnerAdminId: fromOwner,
    toOwnerAdminId: ownerAdminId,
    fromTeamId: fromTeam,
    toTeamId: teamId || null,
    territoryId: territoryId || null,
    changedByAdminId: args.admin?.id || null,
    reason: args.reason != null ? String(args.reason) : null,
    assignedAt: now,
    acceptedAt: null,
    at: now,
  });

  if (statusTransitioned && typeof prisma.crmLeadStatusHistory?.create === 'function') {
    await prisma.crmLeadStatusHistory.create({
      data: {
        leadId: lead.id,
        fromStatus: lead.status,
        toStatus: CRM_LEAD_STATUS.ASSIGNED,
        changedByAdminId: args.admin?.id || null,
        reason: args.reason || 'assigned',
        at: now,
      },
    });
  }

  return {
    ok: true,
    noop: false,
    lead: serializeLead(updated),
    assignmentHistory: serializeAssignmentHistory(history || {
      leadId: lead.id,
      action,
      strategy,
      fromOwnerAdminId: fromOwner,
      toOwnerAdminId: ownerAdminId,
      fromTeamId: fromTeam,
      toTeamId: teamId || null,
      territoryId: territoryId || null,
      changedByAdminId: args.admin?.id || null,
      reason: args.reason != null ? String(args.reason) : null,
      assignedAt: now,
      at: now,
    }),
  };
}

/**
 * Accept an assigned lead (sets acceptedAt; status → ACCEPTED when allowed).
 */
export async function acceptLeadAssignment(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canAssignLeads && !access.canEditLeads) {
    return { ok: false, forbidden: true, reason: 'crm_assign_forbidden' };
  }
  if (!hasCrmLeadModel(prisma)) {
    return { ok: false, error: 'crm_lead_model_unavailable', status: 'UNAVAILABLE' };
  }

  const lead = await findLead(prisma, args.leadId);
  if (!lead) return { ok: false, notFound: true, error: 'lead_not_found' };
  if (!lead.ownerAdminId) {
    return { ok: false, error: 'lead_unassigned' };
  }

  const now = args.now || new Date();
  const data = { acceptedAt: now, updatedAt: now };
  let statusTransitioned = false;

  if (
    lead.status !== CRM_LEAD_STATUS.ACCEPTED &&
    canTransition(lead.status, CRM_LEAD_STATUS.ACCEPTED)
  ) {
    const gate = assertTransition(lead.status, CRM_LEAD_STATUS.ACCEPTED, {
      reason: args.reason,
    });
    if (gate.ok) {
      data.status = CRM_LEAD_STATUS.ACCEPTED;
      statusTransitioned = true;
    }
  }

  const updated = await prisma.crmLead.update({
    where: { id: lead.id },
    data,
  });

  const history = await appendHistory(prisma, {
    leadId: lead.id,
    action: CRM_ASSIGNMENT_ACTION.ACCEPT,
    strategy: CRM_ASSIGNMENT_STRATEGY.MANUAL,
    fromOwnerAdminId: lead.ownerAdminId,
    toOwnerAdminId: lead.ownerAdminId,
    fromTeamId: lead.teamId || null,
    toTeamId: lead.teamId || null,
    territoryId: lead.territoryId || null,
    changedByAdminId: args.admin?.id || null,
    reason: args.reason != null ? String(args.reason) : null,
    assignedAt: lead.assignedAt || null,
    acceptedAt: now,
    at: now,
  });

  if (statusTransitioned && typeof prisma.crmLeadStatusHistory?.create === 'function') {
    await prisma.crmLeadStatusHistory.create({
      data: {
        leadId: lead.id,
        fromStatus: lead.status,
        toStatus: CRM_LEAD_STATUS.ACCEPTED,
        changedByAdminId: args.admin?.id || null,
        reason: args.reason || 'accepted',
        at: now,
      },
    });
  }

  return {
    ok: true,
    lead: serializeLead(updated),
    assignmentHistory: serializeAssignmentHistory(history),
  };
}

/**
 * Reject assignment or return to queue — clears owner; history written; no silent loop.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, leadId: string, action?: 'REJECT'|'RETURN_TO_QUEUE', reason?: string, now?: Date }} args
 */
export async function returnLeadToQueue(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canAssignLeads) {
    return { ok: false, forbidden: true, reason: 'crm_assign_forbidden' };
  }
  if (!hasCrmLeadModel(prisma)) {
    return { ok: false, error: 'crm_lead_model_unavailable', status: 'UNAVAILABLE' };
  }

  const lead = await findLead(prisma, args.leadId);
  if (!lead) return { ok: false, notFound: true, error: 'lead_not_found' };

  const action =
    String(args.action || CRM_ASSIGNMENT_ACTION.RETURN_TO_QUEUE).toUpperCase() ===
    CRM_ASSIGNMENT_ACTION.REJECT
      ? CRM_ASSIGNMENT_ACTION.REJECT
      : CRM_ASSIGNMENT_ACTION.RETURN_TO_QUEUE;

  if (!lead.ownerAdminId && !lead.teamId) {
    return { ok: true, noop: true, lead: serializeLead(lead), message: 'already_unassigned' };
  }

  const now = args.now || new Date();
  const fromOwner = lead.ownerAdminId || null;
  const fromTeam = lead.teamId || null;

  const data = {
    ownerAdminId: null,
    teamId: null,
    acceptedAt: null,
    assignedAt: null,
    updatedAt: now,
  };

  if (
    lead.status !== CRM_LEAD_STATUS.UNASSIGNED &&
    canTransition(lead.status, CRM_LEAD_STATUS.UNASSIGNED)
  ) {
    const gate = assertTransition(lead.status, CRM_LEAD_STATUS.UNASSIGNED, {
      reason: args.reason,
    });
    if (gate.ok) data.status = CRM_LEAD_STATUS.UNASSIGNED;
  }

  const updated = await prisma.crmLead.update({
    where: { id: lead.id },
    data,
  });

  const history = await appendHistory(prisma, {
    leadId: lead.id,
    action,
    strategy: CRM_ASSIGNMENT_STRATEGY.MANUAL,
    fromOwnerAdminId: fromOwner,
    toOwnerAdminId: null,
    fromTeamId: fromTeam,
    toTeamId: null,
    territoryId: lead.territoryId || null,
    changedByAdminId: args.admin?.id || null,
    reason: args.reason != null ? String(args.reason) : null,
    assignedAt: null,
    acceptedAt: null,
    at: now,
  });

  return {
    ok: true,
    noop: false,
    lead: serializeLead(updated),
    assignmentHistory: serializeAssignmentHistory(history),
  };
}

export { serializeAssignmentHistory };
