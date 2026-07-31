/**
 * CRM controlled merge — Phase 11 Wave 4 + Phase 12 Wave 4 Opportunity.
 * Request → Approve → Execute. SoD: requester ≠ approver. No silent merge.
 * Preserves evidence (source IDs, status/score/consent history refs). Never auto-merge.
 */

import {
  CRM_DUPLICATE_STATUS,
  CRM_LEAD_STATUS,
  CRM_MERGE_ENTITY,
  CRM_MERGE_ENTITIES,
  CRM_MERGE_STATUS,
  CRM_SUBJECT_TYPE,
  CRM_TIMELINE_EVENT_TYPE,
} from './catalogue.js';
import { resolveCrmAccess } from './authz.js';
import { appendTimelineEvent } from './timeline.js';
import { CRM_OPPORTUNITY_STATUS } from './pipeline/catalogue.js';

const ENTITY_SET = new Set(CRM_MERGE_ENTITIES);

export function hasCrmMergeRequestModel(prisma) {
  return typeof prisma?.crmMergeRequest?.create === 'function';
}

function serializeMergeRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    entityType: row.entityType,
    survivorId: row.survivorId,
    loserId: row.loserId,
    status: row.status,
    requestedByAdminId: row.requestedByAdminId || null,
    approvedByAdminId: row.approvedByAdminId || null,
    executedByAdminId: row.executedByAdminId || null,
    duplicateCandidateId: row.duplicateCandidateId || null,
    reason: row.reason || null,
    evidence: row.evidenceJson ?? row.evidence ?? null,
    requestedAt: row.requestedAt ? new Date(row.requestedAt).toISOString() : null,
    approvedAt: row.approvedAt ? new Date(row.approvedAt).toISOString() : null,
    executedAt: row.executedAt ? new Date(row.executedAt).toISOString() : null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

async function loadLead(prisma, id) {
  if (!id || typeof prisma?.crmLead?.findUnique !== 'function') return null;
  try {
    return await prisma.crmLead.findUnique({ where: { id: String(id) } });
  } catch {
    return null;
  }
}

async function loadOpportunity(prisma, id) {
  if (!id || typeof prisma?.crmOpportunity?.findUnique !== 'function') return null;
  try {
    return await prisma.crmOpportunity.findUnique({ where: { id: String(id) } });
  } catch {
    return null;
  }
}

async function buildOpportunityEvidence(prisma, survivor, loser) {
  const evidence = {
    survivor: {
      id: survivor.id,
      opportunityNumber: survivor.opportunityNumber,
      status: survivor.status,
      stageCode: survivor.stageCode,
      pipelineCode: survivor.pipelineCode || null,
      accountId: survivor.accountId || null,
      contactId: survivor.contactId || null,
      handoffIdempotencyKey: survivor.handoffIdempotencyKey || null,
      importIdempotencyKey: survivor.importIdempotencyKey || null,
    },
    loser: {
      id: loser.id,
      opportunityNumber: loser.opportunityNumber,
      status: loser.status,
      stageCode: loser.stageCode,
      pipelineCode: loser.pipelineCode || null,
      accountId: loser.accountId || null,
      contactId: loser.contactId || null,
      handoffIdempotencyKey: loser.handoffIdempotencyKey || null,
      importIdempotencyKey: loser.importIdempotencyKey || null,
    },
    historyRefs: {
      survivorStageHistoryPreserved: true,
      loserStageHistoryPreserved: true,
    },
    preservedIds: {
      survivorOpportunityId: survivor.id,
      loserOpportunityId: loser.id,
      survivorOpportunityNumber: survivor.opportunityNumber,
      loserOpportunityNumber: loser.opportunityNumber,
    },
  };

  if (typeof prisma.crmOpportunityStageHistory?.count === 'function') {
    try {
      evidence.historyRefs.survivorStageHistoryCount =
        await prisma.crmOpportunityStageHistory.count({
          where: { opportunityId: survivor.id },
        });
      evidence.historyRefs.loserStageHistoryCount =
        await prisma.crmOpportunityStageHistory.count({
          where: { opportunityId: loser.id },
        });
    } catch {
      // leave counts unset — never invent 0 on failure
    }
  }

  return evidence;
}

async function buildLeadEvidence(prisma, survivor, loser) {
  const evidence = {
    survivor: {
      id: survivor.id,
      leadNumber: survivor.leadNumber,
      status: survivor.status,
      source: survivor.source,
      sourceIdempotencyKey: survivor.sourceIdempotencyKey || null,
      accountId: survivor.accountId || null,
      contactId: survivor.contactId || null,
    },
    loser: {
      id: loser.id,
      leadNumber: loser.leadNumber,
      status: loser.status,
      source: loser.source,
      sourceIdempotencyKey: loser.sourceIdempotencyKey || null,
      accountId: loser.accountId || null,
      contactId: loser.contactId || null,
    },
    historyRefs: {
      survivorStatusHistoryPreserved: true,
      loserStatusHistoryPreserved: true,
      scoreEvaluationsPreserved: true,
      consentOnContactsPreserved: true,
    },
    preservedIds: {
      survivorLeadId: survivor.id,
      loserLeadId: loser.id,
      survivorLeadNumber: survivor.leadNumber,
      loserLeadNumber: loser.leadNumber,
    },
  };

  if (typeof prisma.crmLeadStatusHistory?.count === 'function') {
    try {
      evidence.historyRefs.survivorStatusHistoryCount =
        await prisma.crmLeadStatusHistory.count({ where: { leadId: survivor.id } });
      evidence.historyRefs.loserStatusHistoryCount =
        await prisma.crmLeadStatusHistory.count({ where: { leadId: loser.id } });
    } catch {
      // leave counts unset — never invent 0 on failure
    }
  }
  if (typeof prisma.crmScoreEvaluation?.count === 'function') {
    try {
      evidence.historyRefs.survivorScoreCount = await prisma.crmScoreEvaluation.count({
        where: { leadId: survivor.id },
      });
      evidence.historyRefs.loserScoreCount = await prisma.crmScoreEvaluation.count({
        where: { leadId: loser.id },
      });
    } catch {
      // omit
    }
  }

  return evidence;
}

/**
 * Request a Lead merge (Contact/Account if models present — Lead is primary).
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   entityType?: string,
 *   survivorId: string,
 *   loserId: string,
 *   reason?: string,
 *   duplicateCandidateId?: string|null,
 *   now?: Date,
 * }} args
 */
export async function requestMerge(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canRequestMerge) {
    return { ok: false, forbidden: true, reason: 'crm_merge_request_forbidden' };
  }

  const entityType = String(args.entityType || CRM_MERGE_ENTITY.LEAD)
    .trim()
    .toUpperCase();
  if (!ENTITY_SET.has(entityType)) {
    return { ok: false, error: 'invalid_entity_type' };
  }

  const survivorId = args.survivorId ? String(args.survivorId).trim() : '';
  const loserId = args.loserId ? String(args.loserId).trim() : '';
  if (!survivorId || !loserId) {
    return { ok: false, error: 'survivorId_and_loserId_required' };
  }
  if (survivorId === loserId) {
    return { ok: false, error: 'survivor_and_loser_must_differ' };
  }

  if (!hasCrmMergeRequestModel(prisma)) {
    return { ok: false, error: 'crm_merge_model_unavailable', status: 'UNAVAILABLE' };
  }

  if (
    entityType !== CRM_MERGE_ENTITY.LEAD &&
    entityType !== CRM_MERGE_ENTITY.OPPORTUNITY
  ) {
    return {
      ok: false,
      error: 'entity_merge_not_implemented',
      reason: 'account_contact_merge_deferred',
      status: 'NOT_AVAILABLE',
    };
  }

  const now = args.now || new Date();
  let evidence;
  let timelineSubjectType;
  let timelineSummary;

  if (entityType === CRM_MERGE_ENTITY.OPPORTUNITY) {
    const survivor = await loadOpportunity(prisma, survivorId);
    const loser = await loadOpportunity(prisma, loserId);
    if (!survivor || !loser) {
      return { ok: false, notFound: true, error: 'opportunity_not_found' };
    }
    if (
      survivor.status === CRM_OPPORTUNITY_STATUS.MERGED ||
      loser.status === CRM_OPPORTUNITY_STATUS.MERGED
    ) {
      return { ok: false, error: 'already_merged' };
    }
    evidence = await buildOpportunityEvidence(prisma, survivor, loser);
    timelineSubjectType = CRM_SUBJECT_TYPE.OPPORTUNITY;
    timelineSummary = `Opportunity merge requested: loser ${loser.opportunityNumber} → survivor ${survivor.opportunityNumber}`;
  } else {
    const survivor = await loadLead(prisma, survivorId);
    const loser = await loadLead(prisma, loserId);
    if (!survivor || !loser) {
      return { ok: false, notFound: true, error: 'lead_not_found' };
    }
    if (
      survivor.status === CRM_LEAD_STATUS.MERGED ||
      loser.status === CRM_LEAD_STATUS.MERGED
    ) {
      return { ok: false, error: 'already_merged' };
    }
    evidence = await buildLeadEvidence(prisma, survivor, loser);
    timelineSubjectType = 'LEAD';
    timelineSummary = `Merge requested: loser ${loser.leadNumber} → survivor ${survivor.leadNumber}`;
  }

  const row = await prisma.crmMergeRequest.create({
    data: {
      entityType,
      survivorId,
      loserId,
      status: CRM_MERGE_STATUS.PENDING,
      requestedByAdminId: args.admin?.id || null,
      duplicateCandidateId: args.duplicateCandidateId || null,
      reason: args.reason != null ? String(args.reason).trim() : null,
      evidenceJson: evidence,
      requestedAt: now,
      createdAt: now,
      updatedAt: now,
    },
  });

  await appendTimelineEvent(prisma, {
    subjectType: timelineSubjectType,
    subjectId: survivorId,
    eventType: CRM_TIMELINE_EVENT_TYPE.MERGE_REQUESTED,
    summary: timelineSummary,
    payload: { mergeRequestId: row.id, loserId, survivorId, entityType },
    actorAdminId: args.admin?.id || null,
    at: now,
  });

  return { ok: true, mergeRequest: serializeMergeRequest(row) };
}

/**
 * Approve a pending merge. SoD: approver must differ from requester.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, mergeRequestId: string, now?: Date }} args
 */
export async function approveMerge(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canApproveMerge) {
    return { ok: false, forbidden: true, reason: 'crm_merge_approve_forbidden' };
  }

  const mergeRequestId = args.mergeRequestId
    ? String(args.mergeRequestId).trim()
    : '';
  if (!mergeRequestId) return { ok: false, error: 'mergeRequestId_required' };
  if (!hasCrmMergeRequestModel(prisma)) {
    return { ok: false, error: 'crm_merge_model_unavailable', status: 'UNAVAILABLE' };
  }

  let row = null;
  try {
    row = await prisma.crmMergeRequest.findUnique({ where: { id: mergeRequestId } });
  } catch {
    row = null;
  }
  if (!row) return { ok: false, notFound: true, error: 'merge_request_not_found' };
  if (row.status !== CRM_MERGE_STATUS.PENDING) {
    return { ok: false, error: 'merge_not_pending', status: row.status };
  }

  const approverId = args.admin?.id ? String(args.admin.id) : '';
  const requesterId = row.requestedByAdminId ? String(row.requestedByAdminId) : '';
  if (!approverId) {
    return { ok: false, error: 'approver_id_required' };
  }
  if (requesterId && approverId === requesterId) {
    return {
      ok: false,
      error: 'SOD_VIOLATION',
      reason: 'requester_cannot_approve',
      forbidden: true,
    };
  }

  const now = args.now || new Date();
  const updated = await prisma.crmMergeRequest.update({
    where: { id: row.id },
    data: {
      status: CRM_MERGE_STATUS.APPROVED,
      approvedByAdminId: approverId,
      approvedAt: now,
      updatedAt: now,
    },
  });

  const approveSubjectType =
    String(row.entityType || '').toUpperCase() === CRM_MERGE_ENTITY.OPPORTUNITY
      ? CRM_SUBJECT_TYPE.OPPORTUNITY
      : 'LEAD';

  await appendTimelineEvent(prisma, {
    subjectType: approveSubjectType,
    subjectId: row.survivorId,
    eventType: CRM_TIMELINE_EVENT_TYPE.MERGE_APPROVED,
    summary: `Merge approved (${row.id})`,
    payload: {
      mergeRequestId: row.id,
      approvedByAdminId: approverId,
      entityType: row.entityType,
    },
    actorAdminId: approverId,
    at: now,
  });

  return { ok: true, mergeRequest: serializeMergeRequest(updated) };
}

/**
 * Execute an approved merge. Marks loser MERGED; updates duplicate candidates;
 * preserves loser history rows (no delete). Does not invent Opportunity.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, mergeRequestId: string, now?: Date }} args
 */
export async function executeMerge(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canApproveMerge && !access.canRequestMerge) {
    return { ok: false, forbidden: true, reason: 'crm_merge_execute_forbidden' };
  }

  const mergeRequestId = args.mergeRequestId
    ? String(args.mergeRequestId).trim()
    : '';
  if (!mergeRequestId) return { ok: false, error: 'mergeRequestId_required' };
  if (!hasCrmMergeRequestModel(prisma)) {
    return { ok: false, error: 'crm_merge_model_unavailable', status: 'UNAVAILABLE' };
  }

  let row = null;
  try {
    row = await prisma.crmMergeRequest.findUnique({ where: { id: mergeRequestId } });
  } catch {
    row = null;
  }
  if (!row) return { ok: false, notFound: true, error: 'merge_request_not_found' };
  if (row.status !== CRM_MERGE_STATUS.APPROVED) {
    return { ok: false, error: 'merge_not_approved', status: row.status };
  }

  const executorId = args.admin?.id ? String(args.admin.id) : '';
  const requesterId = row.requestedByAdminId ? String(row.requestedByAdminId) : '';
  if (requesterId && executorId && executorId === requesterId && !row.approvedByAdminId) {
    return {
      ok: false,
      error: 'SOD_VIOLATION',
      reason: 'requester_cannot_self_execute_without_approver',
      forbidden: true,
    };
  }
  if (
    requesterId &&
    executorId &&
    executorId === requesterId &&
    row.approvedByAdminId &&
    String(row.approvedByAdminId) === requesterId
  ) {
    return {
      ok: false,
      error: 'SOD_VIOLATION',
      reason: 'requester_cannot_be_sole_approver',
      forbidden: true,
    };
  }

  const entityType = String(row.entityType || CRM_MERGE_ENTITY.LEAD)
    .trim()
    .toUpperCase();
  const now = args.now || new Date();

  if (entityType === CRM_MERGE_ENTITY.OPPORTUNITY) {
    const survivor = await loadOpportunity(prisma, row.survivorId);
    const loser = await loadOpportunity(prisma, row.loserId);
    if (!survivor || !loser) {
      return { ok: false, notFound: true, error: 'opportunity_not_found' };
    }
    if (loser.status === CRM_OPPORTUNITY_STATUS.MERGED) {
      return { ok: false, error: 'already_merged' };
    }

    const evidence =
      row.evidenceJson ||
      (await buildOpportunityEvidence(prisma, survivor, loser));

    const updatedLoser = await prisma.crmOpportunity.update({
      where: { id: loser.id },
      data: {
        status: CRM_OPPORTUNITY_STATUS.MERGED,
        mergedIntoOpportunityId: survivor.id,
        updatedAt: now,
      },
    });

    if (typeof prisma.crmOpportunityStageHistory?.create === 'function') {
      try {
        await prisma.crmOpportunityStageHistory.create({
          data: {
            opportunityId: loser.id,
            fromStageCode: loser.stageCode,
            toStageCode: loser.stageCode,
            changedByAdminId: executorId || null,
            reason: `merged_into:${survivor.id}`,
            evidenceReferences: { mergeRequestId, survivorId: survivor.id },
            at: now,
          },
        });
      } catch {
        // history best-effort
      }
    }

    if (typeof prisma.crmOpportunityDuplicateCandidate?.findMany === 'function') {
      try {
        const candidates = await prisma.crmOpportunityDuplicateCandidate.findMany({
          where: {
            OR: [
              { opportunityId: survivor.id },
              { opportunityId: loser.id },
              { candidateOpportunityId: survivor.id },
              { candidateOpportunityId: loser.id },
            ],
          },
          take: 100,
        });
        for (const c of candidates || []) {
          if (typeof prisma.crmOpportunityDuplicateCandidate.update !== 'function') break;
          await prisma.crmOpportunityDuplicateCandidate.update({
            where: { id: c.id },
            data: {
              status: CRM_DUPLICATE_STATUS.CONFIRMED_DUPLICATE,
              reviewedByAdminId: executorId || null,
              reviewedAt: now,
              decisionReason: `merge_executed:${mergeRequestId}`,
              updatedAt: now,
            },
          });
        }
      } catch {
        // candidate update best-effort
      }
    }

    const mergedEvidence = {
      ...(typeof evidence === 'object' && evidence ? evidence : {}),
      executedAt: now.toISOString(),
      executedByAdminId: executorId || null,
      loserFinalStatus: CRM_OPPORTUNITY_STATUS.MERGED,
      survivorId: survivor.id,
      loserId: loser.id,
    };

    const updated = await prisma.crmMergeRequest.update({
      where: { id: row.id },
      data: {
        status: CRM_MERGE_STATUS.EXECUTED,
        executedByAdminId: executorId || null,
        executedAt: now,
        evidenceJson: mergedEvidence,
        updatedAt: now,
      },
    });

    await appendTimelineEvent(prisma, {
      subjectType: CRM_SUBJECT_TYPE.OPPORTUNITY,
      subjectId: survivor.id,
      eventType: CRM_TIMELINE_EVENT_TYPE.MERGE_EXECUTED,
      summary: `Opportunity merge executed: ${loser.opportunityNumber} → ${survivor.opportunityNumber}`,
      payload: {
        mergeRequestId: row.id,
        loserId: loser.id,
        survivorId: survivor.id,
        preservedIds: mergedEvidence.preservedIds || null,
        entityType,
      },
      actorAdminId: executorId || null,
      at: now,
    });

    return {
      ok: true,
      mergeRequest: serializeMergeRequest(updated),
      survivor: {
        id: survivor.id,
        opportunityNumber: survivor.opportunityNumber,
        status: survivor.status,
      },
      loser: {
        id: updatedLoser.id,
        opportunityNumber: updatedLoser.opportunityNumber,
        status: updatedLoser.status,
      },
      evidencePreserved: true,
      opportunityCreated: false,
      provisioned: false,
    };
  }

  const survivor = await loadLead(prisma, row.survivorId);
  const loser = await loadLead(prisma, row.loserId);
  if (!survivor || !loser) {
    return { ok: false, notFound: true, error: 'lead_not_found' };
  }
  if (loser.status === CRM_LEAD_STATUS.MERGED) {
    return { ok: false, error: 'already_merged' };
  }

  const evidence =
    row.evidenceJson ||
    (await buildLeadEvidence(prisma, survivor, loser));

  const updatedLoser = await prisma.crmLead.update({
    where: { id: loser.id },
    data: {
      status: CRM_LEAD_STATUS.MERGED,
      mergedIntoLeadId: survivor.id,
      updatedAt: now,
    },
  });

  if (typeof prisma.crmLeadStatusHistory?.create === 'function') {
    await prisma.crmLeadStatusHistory.create({
      data: {
        leadId: loser.id,
        fromStatus: loser.status,
        toStatus: CRM_LEAD_STATUS.MERGED,
        changedByAdminId: executorId || null,
        reason: `merged_into:${survivor.id}`,
        at: now,
      },
    });
  }

  /** Update duplicate candidates involving either lead. */
  if (typeof prisma.crmDuplicateCandidate?.findMany === 'function') {
    try {
      const candidates = await prisma.crmDuplicateCandidate.findMany({
        where: {
          OR: [
            { leadId: survivor.id },
            { leadId: loser.id },
            { candidateLeadId: survivor.id },
            { candidateLeadId: loser.id },
          ],
        },
        take: 100,
      });
      for (const c of candidates || []) {
        if (typeof prisma.crmDuplicateCandidate.update !== 'function') break;
        await prisma.crmDuplicateCandidate.update({
          where: { id: c.id },
          data: {
            status: CRM_DUPLICATE_STATUS.CONFIRMED_DUPLICATE,
            reviewedByAdminId: executorId || null,
            reviewedAt: now,
            decisionReason: `merge_executed:${mergeRequestId}`,
            updatedAt: now,
          },
        });
      }
    } catch {
      // candidate update best-effort; merge still succeeds with evidence
    }
  }

  const mergedEvidence = {
    ...(typeof evidence === 'object' && evidence ? evidence : {}),
    executedAt: now.toISOString(),
    executedByAdminId: executorId || null,
    loserFinalStatus: CRM_LEAD_STATUS.MERGED,
    survivorId: survivor.id,
    loserId: loser.id,
  };

  const updated = await prisma.crmMergeRequest.update({
    where: { id: row.id },
    data: {
      status: CRM_MERGE_STATUS.EXECUTED,
      executedByAdminId: executorId || null,
      executedAt: now,
      evidenceJson: mergedEvidence,
      updatedAt: now,
    },
  });

  await appendTimelineEvent(prisma, {
    subjectType: 'LEAD',
    subjectId: survivor.id,
    eventType: CRM_TIMELINE_EVENT_TYPE.MERGE_EXECUTED,
    summary: `Merge executed: ${loser.leadNumber} → ${survivor.leadNumber}`,
    payload: {
      mergeRequestId: row.id,
      loserId: loser.id,
      survivorId: survivor.id,
      preservedIds: mergedEvidence.preservedIds || null,
    },
    actorAdminId: executorId || null,
    at: now,
  });

  return {
    ok: true,
    mergeRequest: serializeMergeRequest(updated),
    survivor: {
      id: survivor.id,
      leadNumber: survivor.leadNumber,
      status: survivor.status,
    },
    loser: {
      id: updatedLoser.id,
      leadNumber: updatedLoser.leadNumber,
      status: updatedLoser.status,
    },
    evidencePreserved: true,
    opportunityCreated: false,
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, status?: string, limit?: number|string }} args
 */
export async function listMergeRequests(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canViewLeads) {
    return { ok: false, forbidden: true, reason: 'crm_view_forbidden', items: [] };
  }
  if (!hasCrmMergeRequestModel(prisma)) {
    return {
      ok: true,
      items: [],
      meta: { unavailable: true, reason: 'crm_merge_model_unavailable' },
    };
  }

  const where = {};
  if (args.status) where.status = String(args.status).trim().toUpperCase();
  const limit = Math.min(100, Math.max(1, Number(args.limit) || 50));

  let rows = [];
  try {
    rows = await prisma.crmMergeRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  } catch {
    rows = [];
  }

  return {
    ok: true,
    items: (rows || []).map(serializeMergeRequest),
    meta: { count: (rows || []).length, limit },
  };
}

export { serializeMergeRequest, CRM_MERGE_STATUS };
