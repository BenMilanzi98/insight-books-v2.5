/**
 * Qualification evaluation — Phase 11 Wave 3.
 * Cannot mark QUALIFIED while required criterion is UNKNOWN or blocking NO.
 * Override requires overrideQualification permission + reason.
 */

import {
  CRM_LEAD_STATUS,
  CRM_QUALIFICATION_RESPONSE,
} from '../catalogue.js';
import { resolveCrmAccess } from '../authz.js';
import { hasCrmLeadModel, serializeLead } from '../leads.js';
import { assertTransition } from '../stateMachine.js';
import {
  getActiveQualificationDefinition,
  getQualificationDefinitionByVersion,
} from './definitions.js';

const RESPONSE_SET = new Set(Object.values(CRM_QUALIFICATION_RESPONSE));

export function hasCrmQualificationResponseModel(prisma) {
  return typeof prisma?.crmQualificationResponse?.create === 'function';
}

function normalizeResponses(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      const criterionKey = r?.criterionKey ? String(r.criterionKey).trim().toUpperCase() : '';
      const state = r?.state ? String(r.state).trim().toUpperCase() : '';
      if (!criterionKey || !RESPONSE_SET.has(state)) return null;
      return {
        criterionKey,
        state,
        note: r?.note != null ? String(r.note) : null,
      };
    })
    .filter(Boolean);
}

/**
 * Pure evaluation of responses against a definition.
 * UNKNOWN ≠ NO — UNKNOWN blocks required criteria; NO blocks only when blockingNo.
 *
 * @param {object} definition
 * @param {Array<{criterionKey:string,state:string}>} responses
 */
export function evaluateQualificationResponses(definition, responses) {
  const criteria = Array.isArray(definition?.criteria) ? definition.criteria : [];
  const byKey = new Map(
    (responses || []).map((r) => [String(r.criterionKey).toUpperCase(), r])
  );

  const details = [];
  const blockers = [];
  let requiredUnknown = 0;
  let blockingNo = 0;
  let requiredAnswered = 0;
  let requiredTotal = 0;

  for (const c of criteria) {
    const key = String(c.key).toUpperCase();
    const resp = byKey.get(key);
    const state = resp?.state || CRM_QUALIFICATION_RESPONSE.UNKNOWN;
    const required = Boolean(c.required);
    const isBlockingNo = Boolean(c.blockingNo);

    if (required) {
      requiredTotal += 1;
      if (
        state !== CRM_QUALIFICATION_RESPONSE.UNKNOWN &&
        state !== CRM_QUALIFICATION_RESPONSE.PENDING_VERIFICATION
      ) {
        requiredAnswered += 1;
      }
    }

    let blocks = false;
    let reason = null;
    if (required && state === CRM_QUALIFICATION_RESPONSE.UNKNOWN) {
      blocks = true;
      reason = 'required_unknown';
      requiredUnknown += 1;
      blockers.push({ criterionKey: key, state, reason });
    } else if (required && state === CRM_QUALIFICATION_RESPONSE.PENDING_VERIFICATION) {
      blocks = true;
      reason = 'required_pending_verification';
      requiredUnknown += 1;
      blockers.push({ criterionKey: key, state, reason });
    } else if (isBlockingNo && state === CRM_QUALIFICATION_RESPONSE.NO) {
      blocks = true;
      reason = 'blocking_no';
      blockingNo += 1;
      blockers.push({ criterionKey: key, state, reason });
    }

    details.push({
      criterionKey: key,
      label: c.label || key,
      required,
      blockingNo: isBlockingNo,
      state,
      blocks,
      reason,
    });
  }

  const qualified = blockers.length === 0 && requiredTotal > 0;
  return {
    qualified,
    blockers,
    details,
    summary: {
      requiredTotal,
      requiredAnswered,
      requiredUnknown,
      blockingNo,
      /** UNKNOWN is never counted as NO */
      unknownIsNotNo: true,
    },
  };
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

async function persistResponses(prisma, {
  leadId,
  definitionVersionId,
  responses,
  adminId,
  now,
  overrideReason,
}) {
  if (!hasCrmQualificationResponseModel(prisma)) return [];

  const saved = [];
  for (const r of responses) {
    const data = {
      leadId,
      definitionVersionId,
      criterionKey: r.criterionKey,
      state: r.state,
      note: r.note,
      answeredByAdminId: adminId || null,
      answeredAt: now,
      overrideReason: overrideReason || null,
    };
    try {
      if (typeof prisma.crmQualificationResponse.upsert === 'function') {
        const row = await prisma.crmQualificationResponse.upsert({
          where: {
            leadId_definitionVersionId_criterionKey: {
              leadId,
              definitionVersionId,
              criterionKey: r.criterionKey,
            },
          },
          create: data,
          update: {
            state: r.state,
            note: r.note,
            answeredByAdminId: adminId || null,
            answeredAt: now,
            overrideReason: overrideReason || null,
          },
        });
        saved.push(row);
      } else {
        const row = await prisma.crmQualificationResponse.create({ data });
        saved.push(row);
      }
    } catch {
      try {
        const row = await prisma.crmQualificationResponse.create({ data });
        saved.push(row);
      } catch {
        // soft-fail persist
      }
    }
  }
  return saved;
}

/**
 * Evaluate (and optionally qualify) a Lead against a versioned definition.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   leadId: string,
 *   definitionVersionId?: string|null,
 *   responses: Array<{criterionKey:string,state:string,note?:string}>,
 *   applyQualifiedStatus?: boolean,
 *   override?: boolean,
 *   overrideReason?: string|null,
 *   now?: Date,
 * }} args
 */
export async function evaluateQualification(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canQualifyLeads) {
    return { ok: false, forbidden: true, reason: 'crm_qualify_forbidden' };
  }

  if (!hasCrmLeadModel(prisma)) {
    return { ok: false, error: 'crm_lead_model_unavailable', status: 'UNAVAILABLE' };
  }

  const leadId = args.leadId ? String(args.leadId).trim() : '';
  if (!leadId) return { ok: false, error: 'leadId_required' };

  const responses = normalizeResponses(args.responses);
  if (!responses.length) return { ok: false, error: 'responses_required' };

  let definition = null;
  if (args.definitionVersionId) {
    definition = await getQualificationDefinitionByVersion(prisma, args.definitionVersionId);
    if (!definition) {
      return { ok: false, error: 'DEFINITION_MISSING', definitionVersionId: args.definitionVersionId };
    }
  } else {
    definition = await getActiveQualificationDefinition(prisma);
  }

  const evaluation = evaluateQualificationResponses(definition, responses);
  const now = args.now || new Date();
  const override = args.override === true;
  let overrideApplied = false;

  if (override) {
    if (!access.canOverrideQualification) {
      return { ok: false, forbidden: true, reason: 'crm_override_qualification_forbidden' };
    }
    const reason = args.overrideReason != null ? String(args.overrideReason).trim() : '';
    if (!reason) {
      return { ok: false, error: 'overrideReason_required' };
    }
    overrideApplied = true;
  }

  // Resolve lead (existence) before any response persist — no orphan rows for missing leads.
  let lead = await findLead(prisma, leadId);
  if (!lead) return { ok: false, notFound: true, error: 'lead_not_found' };

  await persistResponses(prisma, {
    leadId,
    definitionVersionId: definition.versionId,
    responses,
    adminId: args.admin?.id || null,
    now,
    overrideReason: overrideApplied ? String(args.overrideReason).trim() : null,
  });

  const canQualify = evaluation.qualified || overrideApplied;

  let statusApplied = false;
  const applyStatus = args.applyQualifiedStatus !== false;

  if (applyStatus && canQualify) {
    const toStatus = CRM_LEAD_STATUS.QUALIFIED;
    if (lead.status !== toStatus) {
      const gate = assertTransition(lead.status, toStatus, {});
      if (gate.ok) {
        lead = await prisma.crmLead.update({
          where: { id: lead.id },
          data: { status: toStatus, updatedAt: now },
        });
        if (typeof prisma.crmLeadStatusHistory?.create === 'function') {
          await prisma.crmLeadStatusHistory.create({
            data: {
              leadId: lead.id,
              fromStatus: gate.from,
              toStatus,
              changedByAdminId: args.admin?.id || null,
              reason: overrideApplied
                ? `qualification_override: ${String(args.overrideReason).trim()}`
                : 'qualification_passed',
              at: now,
            },
          });
        }
        statusApplied = true;
      } else if (!overrideApplied) {
        // evaluation ok but transition not allowed from current status
        return {
          ok: true,
          qualified: evaluation.qualified,
          canQualify,
          statusApplied: false,
          transitionBlocked: gate,
          evaluation,
          definitionVersionId: definition.versionId,
          lead: serializeLead(lead),
          label: 'qualification_result',
        };
      }
    }
  } else if (applyStatus && !canQualify) {
    // Explicitly refuse QUALIFIED while blockers remain (unless override)
    return {
      ok: true,
      qualified: false,
      canQualify: false,
      statusApplied: false,
      blocked: true,
      evaluation,
      definitionVersionId: definition.versionId,
      lead: serializeLead(lead),
      label: 'qualification_result',
      message: 'Cannot mark QUALIFIED while required criterion is UNKNOWN or blocking NO',
    };
  }

  return {
    ok: true,
    qualified: evaluation.qualified,
    canQualify,
    overrideApplied,
    statusApplied,
    evaluation,
    definitionVersionId: definition.versionId,
    lead: serializeLead(lead),
    /** API contract: never probability */
    label: 'qualification_result',
  };
}

/**
 * Gate for transitionLeadStatus → QUALIFIED.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ leadId: string, definitionVersionId?: string, admin?: object, override?: boolean, overrideReason?: string }} args
 */
export async function assertLeadQualificationForQualifiedStatus(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (args.override === true) {
    if (!access.canOverrideQualification) {
      return { ok: false, error: 'crm_override_qualification_forbidden' };
    }
    const reason = args.overrideReason != null ? String(args.overrideReason).trim() : '';
    if (!reason) return { ok: false, error: 'overrideReason_required' };
    return { ok: true, overrideApplied: true };
  }

  let definition = null;
  if (args.definitionVersionId) {
    definition = await getQualificationDefinitionByVersion(prisma, args.definitionVersionId);
  } else {
    definition = await getActiveQualificationDefinition(prisma);
  }
  if (!definition) {
    return { ok: false, error: 'DEFINITION_MISSING' };
  }

  // Fail closed when response table / client model unavailable (EPERM / pre-migrate).
  // Prefer blocking QUALIFIED over soft-skip — required criteria would otherwise be UNKNOWN.
  if (typeof prisma?.crmQualificationResponse?.findMany !== 'function') {
    return {
      ok: false,
      error: 'QUALIFICATION_UNAVAILABLE',
      status: 'UNAVAILABLE',
      reason: 'qualification_response_model_unavailable',
      definitionVersionId: definition.versionId,
      message: 'Cannot mark QUALIFIED while qualification responses cannot be loaded',
    };
  }

  let responses;
  try {
    responses = await prisma.crmQualificationResponse.findMany({
      where: {
        leadId: String(args.leadId),
        definitionVersionId: definition.versionId,
      },
    });
  } catch {
    return {
      ok: false,
      error: 'QUALIFICATION_UNAVAILABLE',
      status: 'UNAVAILABLE',
      reason: 'qualification_responses_load_failed',
      definitionVersionId: definition.versionId,
      message: 'Cannot mark QUALIFIED while qualification responses cannot be loaded',
    };
  }

  const evaluation = evaluateQualificationResponses(definition, responses || []);
  if (!evaluation.qualified) {
    return {
      ok: false,
      error: 'QUALIFICATION_INCOMPLETE',
      evaluation,
      definitionVersionId: definition.versionId,
      message: 'Cannot mark QUALIFIED while required criterion is UNKNOWN or blocking NO',
    };
  }
  return { ok: true, evaluation, definitionVersionId: definition.versionId };
}
