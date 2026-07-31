/**
 * CRM leads — create / list / get / transitionStatus (Phase 11 Wave 1).
 * Distinct from Customer / SupportTicket / CsCase. Never mutates billing / MRA / Tenant GL.
 */

import {
  CRM_LEAD_STATUS,
  CRM_LEAD_TYPE,
  CRM_LEAD_SOURCE,
  CRM_PERSON_OR_ORG,
  CRM_SOURCE_CHANNEL,
  CRM_LIST_MAX_LIMIT,
  CRM_LIST_DEFAULT_LIMIT,
  CRM_LEAD_NUMBER_RE,
  CRM_NUMBER_PREFIX,
} from './catalogue.js';
import { allocateCrmNumber } from './numbering.js';
import { assertTransition } from './stateMachine.js';
import { resolveCrmAccess, resolveCrmScope } from './authz.js';

const LEAD_TYPE_SET = new Set(Object.values(CRM_LEAD_TYPE));
const LEAD_SOURCE_SET = new Set(Object.values(CRM_LEAD_SOURCE));
const PERSON_OR_ORG_SET = new Set(Object.values(CRM_PERSON_OR_ORG));

export function hasCrmLeadModel(prisma) {
  return typeof prisma?.crmLead?.findMany === 'function';
}

function serializeLead(row) {
  if (!row) return null;
  return {
    id: row.id,
    leadNumber: row.leadNumber,
    type: row.type,
    personOrOrganisation: row.personOrOrganisation,
    accountId: row.accountId || null,
    contactId: row.contactId || null,
    source: row.source || null,
    channel: row.channel || CRM_SOURCE_CHANNEL.ADMIN_MANUAL,
    sourceIdempotencyKey: row.sourceIdempotencyKey || null,
    status: row.status,
    title: row.title,
    summary: row.summary || null,
    ownerAdminId: row.ownerAdminId || null,
    teamId: row.teamId || null,
    territoryId: row.territoryId || null,
    assignedAt: row.assignedAt ? new Date(row.assignedAt).toISOString() : null,
    acceptedAt: row.acceptedAt ? new Date(row.acceptedAt).toISOString() : null,
    createdByAdminId: row.createdByAdminId || null,
    disqualificationReason: row.disqualificationReason || null,
    mergedIntoLeadId: row.mergedIntoLeadId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

async function appendStatusHistory(prisma, {
  leadId,
  fromStatus,
  toStatus,
  changedByAdminId,
  reason,
  at,
}) {
  if (typeof prisma.crmLeadStatusHistory?.create !== 'function') return null;
  return prisma.crmLeadStatusHistory.create({
    data: {
      leadId,
      fromStatus: fromStatus || null,
      toStatus,
      changedByAdminId: changedByAdminId || null,
      reason: reason || null,
      at: at || new Date(),
    },
  });
}

/**
 * Create a CrmLead (status NEW).
 * Admin path: channel ADMIN_MANUAL (requires createLeads).
 * Capture path: args.capture === true — channel from args; public never sets owner.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin?: object|null,
 *   capture?: boolean,
 *   type?: string,
 *   personOrOrganisation?: string,
 *   title: string,
 *   summary?: string|null,
 *   source?: string,
 *   channel?: string,
 *   accountId?: string|null,
 *   contactId?: string|null,
 *   ownerAdminId?: string|null,
 *   sourceIdempotencyKey?: string|null,
 *   now?: Date,
 * }} args
 */
export async function createLead(prisma, args = {}) {
  const captureMode = args.capture === true;
  if (!captureMode) {
    const access = resolveCrmAccess(args.admin);
    if (!access.canCreateLeads) {
      return { ok: false, forbidden: true, reason: 'crm_create_lead_forbidden' };
    }
  }

  const title = args.title ? String(args.title).trim() : '';
  if (!title) {
    return { ok: false, error: 'title required' };
  }

  if (!hasCrmLeadModel(prisma)) {
    return { ok: false, error: 'crm_lead_model_unavailable', status: 'UNAVAILABLE' };
  }

  const type = args.type
    ? String(args.type).trim().toUpperCase()
    : CRM_LEAD_TYPE.OTHER;
  if (!LEAD_TYPE_SET.has(type)) {
    return { ok: false, error: 'invalid_lead_type', type };
  }

  const personOrOrganisation = args.personOrOrganisation
    ? String(args.personOrOrganisation).trim().toUpperCase()
    : CRM_PERSON_OR_ORG.PERSON;
  if (!PERSON_OR_ORG_SET.has(personOrOrganisation)) {
    return { ok: false, error: 'invalid_person_or_organisation', personOrOrganisation };
  }

  const source = args.source
    ? String(args.source).trim().toUpperCase()
    : CRM_LEAD_SOURCE.MANUAL;
  if (!LEAD_SOURCE_SET.has(source)) {
    return { ok: false, error: 'invalid_lead_source', source };
  }

  const channel = captureMode
    ? String(args.channel || CRM_SOURCE_CHANNEL.WEB_FORM).trim().toUpperCase()
    : CRM_SOURCE_CHANNEL.ADMIN_MANUAL;

  const sourceIdempotencyKey = args.sourceIdempotencyKey
    ? String(args.sourceIdempotencyKey).trim()
    : null;
  if (sourceIdempotencyKey && typeof prisma.crmLead.findUnique === 'function') {
    try {
      const existing = await prisma.crmLead.findUnique({
        where: { sourceIdempotencyKey },
      });
      if (existing) {
        return {
          ok: true,
          created: false,
          idempotentReplay: true,
          idempotent: true,
          lead: serializeLead(existing),
        };
      }
    } catch {
      // unique lookup optional
    }
  }

  const now = args.now || new Date();
  const allocated = await allocateCrmNumber(prisma, {
    prefix: CRM_NUMBER_PREFIX.LEAD,
    now,
  });
  if (!allocated.ok) {
    return { ok: false, error: allocated.error || 'crm_number_allocation_failed' };
  }

  // Public capture must never set owner; admin create may.
  const ownerAdminId = captureMode
    ? null
    : args.ownerAdminId !== undefined
      ? args.ownerAdminId || null
      : null;
  const status = CRM_LEAD_STATUS.NEW;

  let row;
  try {
    row = await prisma.crmLead.create({
      data: {
        leadNumber: allocated.number,
        type,
        personOrOrganisation,
        accountId: captureMode ? null : args.accountId || null,
        contactId: captureMode ? null : args.contactId || null,
        source,
        channel,
        sourceIdempotencyKey,
        status,
        title,
        summary: args.summary != null ? String(args.summary) : null,
        ownerAdminId,
        createdByAdminId: args.admin?.id || null,
        disqualificationReason: null,
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (err) {
    if (err?.code === 'P2002' && sourceIdempotencyKey) {
      try {
        const existing = await prisma.crmLead.findUnique({
          where: { sourceIdempotencyKey },
        });
        if (existing) {
          return {
            ok: true,
            created: false,
            idempotentReplay: true,
            idempotent: true,
            lead: serializeLead(existing),
          };
        }
      } catch {
        // fall through
      }
    }
    throw err;
  }

  await appendStatusHistory(prisma, {
    leadId: row.id,
    fromStatus: null,
    toStatus: status,
    changedByAdminId: args.admin?.id || null,
    reason: captureMode ? 'captured' : 'created',
    at: now,
  });

  return {
    ok: true,
    created: true,
    lead: serializeLead(row),
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, id: string }} args — id may be cuid or leadNumber
 */
export async function getLead(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canViewLeads) {
    return { ok: false, forbidden: true, reason: 'crm_view_lead_forbidden' };
  }

  const id = args.id ? String(args.id).trim() : '';
  if (!id) return { ok: false, error: 'id required' };

  if (!hasCrmLeadModel(prisma)) {
    return { ok: false, error: 'crm_lead_model_unavailable', status: 'UNAVAILABLE' };
  }

  let row = null;
  try {
    if (CRM_LEAD_NUMBER_RE.test(id)) {
      row = await prisma.crmLead.findUnique({ where: { leadNumber: id } });
    } else {
      row = await prisma.crmLead.findUnique({ where: { id } });
    }
    if (!row && typeof prisma.crmLead.findFirst === 'function') {
      row = await prisma.crmLead.findFirst({
        where: { OR: [{ id }, { leadNumber: id }] },
      });
    }
  } catch {
    row = null;
  }

  if (!row) return { ok: false, notFound: true, error: 'lead_not_found' };

  let history = [];
  if (typeof prisma.crmLeadStatusHistory?.findMany === 'function') {
    try {
      history = await prisma.crmLeadStatusHistory.findMany({
        where: { leadId: row.id },
        orderBy: { at: 'asc' },
      });
    } catch {
      history = [];
    }
  }

  return {
    ok: true,
    lead: serializeLead(row),
    statusHistory: (history || []).map((h) => ({
      id: h.id,
      fromStatus: h.fromStatus || null,
      toStatus: h.toStatus,
      changedByAdminId: h.changedByAdminId || null,
      reason: h.reason || null,
      at: h.at ? new Date(h.at).toISOString() : null,
    })),
  };
}

/**
 * Bounded list — never unbounded.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   status?: string|string[],
 *   ownerAdminId?: string|null,
 *   myWork?: boolean,
 *   limit?: number|string,
 *   offset?: number|string,
 *   cursor?: string,
 * }} args
 */
export async function listLeads(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canViewLeads) {
    return { ok: false, forbidden: true, reason: 'crm_view_lead_forbidden', items: [] };
  }

  if (!hasCrmLeadModel(prisma)) {
    return {
      ok: true,
      items: [],
      meta: { unavailable: true, reason: 'crm_lead_model_unavailable' },
    };
  }

  const scope = await resolveCrmScope(prisma, args.admin, 'leads');
  if (!scope.canView) {
    return { ok: false, forbidden: true, reason: 'crm_view_lead_forbidden', items: [] };
  }

  const where = {};
  if (args.status) {
    where.status = Array.isArray(args.status)
      ? { in: args.status.map((s) => String(s).toUpperCase()) }
      : String(args.status).toUpperCase();
  }
  if (args.myWork === true && args.admin?.id) {
    where.ownerAdminId = String(args.admin.id);
  } else if (args.ownerAdminId) {
    where.ownerAdminId = String(args.ownerAdminId);
  }

  const rawLimit = Number(args.limit);
  const limit = Math.min(
    CRM_LIST_MAX_LIMIT,
    Math.max(1, Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : CRM_LIST_DEFAULT_LIMIT)
  );
  const rawOffset = Number(args.offset);
  const offset =
    Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;

  const query = {
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  };
  if (args.cursor) {
    query.cursor = { id: String(args.cursor) };
    query.skip = 1;
  } else if (offset > 0) {
    query.skip = offset;
  }

  let rows = [];
  try {
    rows = await prisma.crmLead.findMany(query);
  } catch {
    rows = await prisma.crmLead.findMany({ where, take: limit });
  }

  return {
    ok: true,
    items: (rows || []).map(serializeLead),
    meta: {
      count: (rows || []).length,
      limit,
      offset,
      cursor: args.cursor || null,
      scopeMode: scope.mode,
    },
  };
}

/**
 * Transition lead status; appends CrmLeadStatusHistory on success.
 * CONVERTED_TO_OPPORTUNITY only when args.fromOpportunityCreate (Opportunity create path).
 * QUALIFIED requires completed qualification (or override + reason) — Wave 3.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   leadId: string,
 *   toStatus: string,
 *   reason?: string,
 *   disqualificationReason?: string,
 *   overrideQualification?: boolean,
 *   overrideReason?: string,
 *   fromOpportunityCreate?: boolean,
 *   now?: Date,
 * }} args
 */
export async function transitionLeadStatus(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canTransitionStatus) {
    return { ok: false, forbidden: true, reason: 'crm_transition_forbidden' };
  }

  if (!hasCrmLeadModel(prisma)) {
    return { ok: false, error: 'crm_lead_model_unavailable', status: 'UNAVAILABLE' };
  }

  const leadId = args.leadId ? String(args.leadId).trim() : '';
  if (!leadId) return { ok: false, error: 'leadId required' };

  let row = null;
  try {
    if (CRM_LEAD_NUMBER_RE.test(leadId)) {
      row = await prisma.crmLead.findUnique({ where: { leadNumber: leadId } });
    } else {
      row = await prisma.crmLead.findUnique({ where: { id: leadId } });
    }
  } catch {
    row = null;
  }
  if (!row) return { ok: false, notFound: true, error: 'lead_not_found' };

  const toStatus = String(args.toStatus || '').trim().toUpperCase();
  const gate = assertTransition(row.status, toStatus, {
    reason: args.reason,
    disqualificationReason: args.disqualificationReason,
    fromOpportunityCreate: args.fromOpportunityCreate === true,
  });
  if (!gate.ok) return gate;

  if (toStatus === CRM_LEAD_STATUS.QUALIFIED) {
    const { assertLeadQualificationForQualifiedStatus } = await import(
      './qualification/evaluate.js'
    );
    const qGate = await assertLeadQualificationForQualifiedStatus(prisma, {
      leadId: row.id,
      admin: args.admin,
      override: args.overrideQualification === true,
      overrideReason: args.overrideReason || args.reason,
    });
    if (!qGate.ok) return qGate;
  }

  const now = args.now || new Date();
  const data = { status: toStatus, updatedAt: now };

  if (toStatus === CRM_LEAD_STATUS.DISQUALIFIED) {
    data.disqualificationReason = String(args.disqualificationReason).trim();
  }

  const updated = await prisma.crmLead.update({
    where: { id: row.id },
    data,
  });

  await appendStatusHistory(prisma, {
    leadId: row.id,
    fromStatus: row.status,
    toStatus,
    changedByAdminId: args.admin?.id || null,
    reason:
      args.reason ||
      (toStatus === CRM_LEAD_STATUS.DISQUALIFIED
        ? String(args.disqualificationReason).trim()
        : null),
    at: now,
  });

  return { ok: true, lead: serializeLead(updated) };
}

export { serializeLead };
