/**
 * Demo Proposal / Trial handoffs — Phase 14 Wave 4.
 * Idempotent typed payloads only. Never creates Proposal / Trial / Tenant.
 */

import {
  CRM_DEMO_HANDOFF_TYPE,
  CRM_SUBJECT_TYPE,
  CRM_TIMELINE_EVENT_TYPE,
} from '../catalogue.js';
import { resolveCrmAccess } from '../authz.js';
import { appendTimelineEvent } from '../timeline.js';
import { getDemoDomainContract } from './catalogue.js';
import { canEditDemos, canViewDemos, loadDemo } from './service.js';

export const DEMO_PROPOSAL_HANDOFF_TYPE = 'CRM_DEMO_PROPOSAL_HANDOFF';
export const DEMO_PROPOSAL_HANDOFF_VERSION = 'crm-demo-proposal-handoff-v1-2026-07-30';
export const DEMO_TRIAL_HANDOFF_TYPE = 'CRM_DEMO_TRIAL_HANDOFF';
export const DEMO_TRIAL_HANDOFF_VERSION = 'crm-demo-trial-handoff-v1-2026-07-30';

export function hasCrmDemoHandoffModel(prisma) {
  return typeof prisma?.crmDemoHandoff?.create === 'function';
}

export function serializeDemoHandoff(row) {
  if (!row) return null;
  return {
    id: row.id,
    demoId: row.demoId,
    handoffType: row.handoffType,
    payloadJson: row.payloadJson ?? null,
    idempotencyKey: row.idempotencyKey || null,
    createdByAdminId: row.createdByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    proposalCreated: false,
    trialCreated: false,
    tenantCreated: false,
  };
}

function buildProposalPayload(demo, adminId) {
  const idempotencyKey = `demo-proposal-handoff:${demo.id}`;
  return {
    type: DEMO_PROPOSAL_HANDOFF_TYPE,
    version: DEMO_PROPOSAL_HANDOFF_VERSION,
    demoId: demo.id,
    demoNumber: demo.demoNumber,
    demoStatus: demo.status,
    leadId: demo.leadId || null,
    opportunityId: demo.opportunityId || null,
    accountId: demo.accountId || null,
    contactId: demo.contactId || null,
    outcomeId: demo.latestOutcomeId || null,
    idempotencyKey,
    emittedByAdminId: adminId || null,
    /** Honesty — Phase 14 never creates these */
    proposalId: null,
    proposalCreated: false,
    quotationId: null,
    quotationCreated: false,
    inventProposalForbidden: true,
  };
}

function buildTrialPayload(demo, adminId) {
  const idempotencyKey = `demo-trial-handoff:${demo.id}`;
  return {
    type: DEMO_TRIAL_HANDOFF_TYPE,
    version: DEMO_TRIAL_HANDOFF_VERSION,
    demoId: demo.id,
    demoNumber: demo.demoNumber,
    demoStatus: demo.status,
    leadId: demo.leadId || null,
    opportunityId: demo.opportunityId || null,
    accountId: demo.accountId || null,
    contactId: demo.contactId || null,
    outcomeId: demo.latestOutcomeId || null,
    idempotencyKey,
    emittedByAdminId: adminId || null,
    /** Honesty — Phase 14 never creates these */
    trialId: null,
    trialCreated: false,
    tenantId: null,
    tenantCreated: false,
    subscriptionId: null,
    subscriptionCreated: false,
    inventTrialForbidden: true,
    inventTenantProvisionForbidden: true,
  };
}

async function emitHandoff(prisma, args, handoffType, buildPayload, eventType) {
  const access = resolveCrmAccess(args.admin);
  if (!canEditDemos(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_handoff_forbidden' };
  }
  if (!hasCrmDemoHandoffModel(prisma)) {
    return {
      ok: false,
      error: 'crm_demo_handoff_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const demo = await loadDemo(prisma, args.demoId);
  if (!demo) return { ok: false, notFound: true, error: 'demo_not_found' };

  if (
    args.createProposal === true ||
    args.createTrial === true ||
    args.createTenant === true ||
    args.provisionTenant === true
  ) {
    return {
      ok: false,
      error: 'handoff_create_forbidden',
      domain: getDemoDomainContract(),
    };
  }

  const payload = buildPayload(demo, args.admin?.id);
  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : payload.idempotencyKey;

  const existing = await prisma.crmDemoHandoff.findUnique({
    where: { idempotencyKey },
  });
  if (existing) {
    return {
      ok: true,
      handoff: serializeDemoHandoff(existing),
      handoffPayload: existing.payloadJson,
      proposalCreated: false,
      trialCreated: false,
      tenantCreated: false,
      idempotentReplay: true,
      domain: getDemoDomainContract(),
    };
  }

  const now = args.now || new Date();
  payload.idempotencyKey = idempotencyKey;
  payload.emittedAt = now.toISOString();

  const row = await prisma.crmDemoHandoff.create({
    data: {
      demoId: demo.id,
      handoffType,
      payloadJson: payload,
      idempotencyKey,
      createdByAdminId: args.admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  await appendTimelineEvent(prisma, {
    subjectType: CRM_SUBJECT_TYPE.DEMO,
    subjectId: demo.id,
    eventType,
    summary: `Demo ${handoffType} handoff emitted (payload only)`,
    payload: {
      handoffType,
      idempotencyKey,
      proposalCreated: false,
      trialCreated: false,
      tenantCreated: false,
    },
    actorAdminId: args.admin?.id || null,
    at: now,
  });

  return {
    ok: true,
    handoff: serializeDemoHandoff(row),
    handoffPayload: payload,
    proposalCreated: false,
    trialCreated: false,
    tenantCreated: false,
    domain: getDemoDomainContract(),
  };
}

export async function emitDemoProposalHandoff(prisma, args = {}) {
  const result = await emitHandoff(
    prisma,
    args,
    CRM_DEMO_HANDOFF_TYPE.PROPOSAL,
    buildProposalPayload,
    CRM_TIMELINE_EVENT_TYPE.DEMO_PROPOSAL_HANDOFF
  );

  /** Phase 15 Wave 1 — consume handoff → PRQ only (not Proposal document). */
  if (result?.ok && args.skipProposalRequest !== true) {
    try {
      const { createProposalRequestFromDemoHandoff } = await import(
        '../commercial/requests.js'
      );
      const seeded = await createProposalRequestFromDemoHandoff(prisma, {
        admin: args.admin,
        actorContext: { admin: args.admin },
        handoffPayload: result.handoffPayload,
        now: args.now,
      });
      if (seeded?.ok) {
        result.proposalRequest = seeded.request;
        result.proposalRequestAlreadyExists = seeded.alreadyExists === true;
      }
    } catch {
      // Model unavailable (EPERM) — handoff payload still valid
    }
  }

  return result;
}

export async function emitDemoTrialHandoff(prisma, args = {}) {
  return emitHandoff(
    prisma,
    args,
    CRM_DEMO_HANDOFF_TYPE.TRIAL,
    buildTrialPayload,
    CRM_TIMELINE_EVENT_TYPE.DEMO_TRIAL_HANDOFF
  );
}

export function assertNoProposalOrTrialCreate(result) {
  return (
    result?.proposalCreated === false &&
    result?.trialCreated === false &&
    result?.tenantCreated === false &&
    result?.handoffPayload?.proposalId == null &&
    result?.handoffPayload?.trialId == null &&
    result?.handoffPayload?.tenantId == null
  );
}

export async function listDemoHandoffs(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canViewDemos(access)) {
    return {
      ok: false,
      forbidden: true,
      reason: 'crm_demo_handoff_view_forbidden',
      items: [],
    };
  }
  if (!hasCrmDemoHandoffModel(prisma)) {
    return {
      ok: true,
      items: [],
      meta: { unavailable: true, status: 'UNAVAILABLE' },
    };
  }

  const demo = await loadDemo(prisma, args.demoId);
  if (!demo) return { ok: false, notFound: true, error: 'demo_not_found', items: [] };

  const rows = await prisma.crmDemoHandoff.findMany({
    where: { demoId: demo.id },
    orderBy: { createdAt: 'desc' },
    take: Math.min(50, Number(args.limit) || 20),
  });

  return {
    ok: true,
    items: (rows || []).map(serializeDemoHandoff),
    meta: {
      count: (rows || []).length,
      inventProposalForbidden: true,
      inventTrialForbidden: true,
    },
  };
}
