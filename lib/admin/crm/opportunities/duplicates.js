/**
 * Opportunity duplicate candidates — Phase 12 Wave 4.
 * Same Account / overlapping commercial / same handoff key — never invent.
 * Detect / list / review only. Never auto-merge.
 */

import {
  CRM_DUPLICATE_STATUS,
  CRM_DUPLICATE_STATUSES,
  CRM_LIST_DEFAULT_LIMIT,
  CRM_LIST_MAX_LIMIT,
} from '../catalogue.js';
import { resolveCrmAccess } from '../authz.js';
import { hasCrmOpportunityModel } from './model.js';

export const CRM_OPP_DUPLICATE_MATCH_TYPE = Object.freeze({
  SAME_ACCOUNT: 'SAME_ACCOUNT',
  SAME_HANDOFF_KEY: 'SAME_HANDOFF_KEY',
  OVERLAPPING_COMMERCIAL: 'OVERLAPPING_COMMERCIAL',
});

export const CRM_OPP_DUPLICATE_MATCH_TYPES = Object.freeze(
  Object.values(CRM_OPP_DUPLICATE_MATCH_TYPE)
);

const STATUS_SET = new Set(CRM_DUPLICATE_STATUSES);
const REVIEWABLE = new Set([
  CRM_DUPLICATE_STATUS.UNDER_REVIEW,
  CRM_DUPLICATE_STATUS.LIKELY_DUPLICATE,
  CRM_DUPLICATE_STATUS.CONFIRMED_DUPLICATE,
  CRM_DUPLICATE_STATUS.CONFIRMED_DISTINCT,
]);

export function hasCrmOpportunityDuplicateCandidateModel(prisma) {
  return typeof prisma?.crmOpportunityDuplicateCandidate?.findMany === 'function';
}

function serializeOppDuplicate(row) {
  if (!row) return null;
  return {
    id: row.id,
    opportunityId: row.opportunityId,
    candidateOpportunityId: row.candidateOpportunityId,
    matchType: row.matchType,
    matchValue: row.matchValue || null,
    status: row.status,
    confidence: row.confidence || null,
    reviewedByAdminId: row.reviewedByAdminId || null,
    reviewedAt: row.reviewedAt ? new Date(row.reviewedAt).toISOString() : null,
    decisionReason: row.decisionReason || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

/**
 * Detect duplicate Opportunity candidates for a seed opportunity.
 * Never invents matches; never auto-merges.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ opportunityId: string, now?: Date }} args
 */
export async function detectOpportunityDuplicateCandidates(prisma, args = {}) {
  if (!hasCrmOpportunityModel(prisma)) {
    return {
      ok: false,
      error: 'crm_opportunity_model_unavailable',
      status: 'UNAVAILABLE',
      created: 0,
      existing: 0,
      items: [],
    };
  }
  if (!hasCrmOpportunityDuplicateCandidateModel(prisma)) {
    return {
      ok: true,
      created: 0,
      existing: 0,
      items: [],
      meta: { unavailable: true, reason: 'crm_opportunity_duplicate_model_unavailable' },
    };
  }

  const opportunityId = args.opportunityId ? String(args.opportunityId).trim() : '';
  if (!opportunityId) return { ok: false, error: 'opportunityId_required' };

  let seed = null;
  try {
    seed = await prisma.crmOpportunity.findUnique({ where: { id: opportunityId } });
  } catch {
    seed = null;
  }
  if (!seed) return { ok: false, notFound: true, error: 'opportunity_not_found' };
  if (seed.status === 'MERGED') {
    return { ok: false, error: 'opportunity_already_merged' };
  }

  /** @type {Array<{ candidateOpportunityId: string, matchType: string, matchValue: string|null, confidence: string }>} */
  const pending = [];

  let peers = [];
  try {
    peers = await prisma.crmOpportunity.findMany({
      where: {
        id: { not: opportunityId },
        status: { not: 'MERGED' },
      },
      take: 200,
    });
  } catch {
    peers = [];
  }

  for (const peer of peers || []) {
    if (!peer?.id || peer.id === opportunityId) continue;

    if (
      seed.handoffIdempotencyKey &&
      peer.handoffIdempotencyKey &&
      seed.handoffIdempotencyKey === peer.handoffIdempotencyKey
    ) {
      pending.push({
        candidateOpportunityId: peer.id,
        matchType: CRM_OPP_DUPLICATE_MATCH_TYPE.SAME_HANDOFF_KEY,
        matchValue: seed.handoffIdempotencyKey,
        confidence: 'HIGH',
      });
    }

    if (seed.accountId && peer.accountId && seed.accountId === peer.accountId) {
      pending.push({
        candidateOpportunityId: peer.id,
        matchType: CRM_OPP_DUPLICATE_MATCH_TYPE.SAME_ACCOUNT,
        matchValue: seed.accountId,
        confidence: 'MEDIUM',
      });

      const seedAmt = seed.amount != null ? String(seed.amount) : null;
      const peerAmt = peer.amount != null ? String(peer.amount) : null;
      const seedCur = seed.currency ? String(seed.currency).toUpperCase() : null;
      const peerCur = peer.currency ? String(peer.currency).toUpperCase() : null;
      if (
        seedAmt &&
        peerAmt &&
        seedAmt === peerAmt &&
        seedCur &&
        peerCur &&
        seedCur === peerCur
      ) {
        pending.push({
          candidateOpportunityId: peer.id,
          matchType: CRM_OPP_DUPLICATE_MATCH_TYPE.OVERLAPPING_COMMERCIAL,
          matchValue: `${seedCur}:${seedAmt}`,
          confidence: 'HIGH',
        });
      }
    }
  }

  const now = args.now || new Date();
  let created = 0;
  let existing = 0;
  const items = [];
  const seen = new Set();

  for (const p of pending) {
    const key = `${p.candidateOpportunityId}:${p.matchType}`;
    if (seen.has(key)) continue;
    seen.add(key);

    let prior = null;
    try {
      prior = await prisma.crmOpportunityDuplicateCandidate.findFirst({
        where: {
          opportunityId,
          candidateOpportunityId: p.candidateOpportunityId,
          matchType: p.matchType,
        },
      });
    } catch {
      prior = null;
    }

    if (prior) {
      existing += 1;
      items.push(serializeOppDuplicate(prior));
      continue;
    }

    const row = await prisma.crmOpportunityDuplicateCandidate.create({
      data: {
        opportunityId,
        candidateOpportunityId: p.candidateOpportunityId,
        matchType: p.matchType,
        matchValue: p.matchValue,
        status: CRM_DUPLICATE_STATUS.NEW,
        confidence: p.confidence,
        createdAt: now,
        updatedAt: now,
      },
    });
    created += 1;
    items.push(serializeOppDuplicate(row));
  }

  return {
    ok: true,
    created,
    existing,
    items,
    meta: { autoMerge: false, inventMatchesForbidden: true },
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   status?: string|string[],
 *   opportunityId?: string,
 *   limit?: number|string,
 *   offset?: number|string,
 * }} args
 */
export async function listOpportunityDuplicateCandidates(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canViewOpportunities && !access.canViewDuplicates) {
    return {
      ok: false,
      forbidden: true,
      reason: 'crm_view_opportunity_duplicates_forbidden',
      items: [],
    };
  }

  if (!hasCrmOpportunityDuplicateCandidateModel(prisma)) {
    return {
      ok: true,
      items: [],
      meta: {
        unavailable: true,
        reason: 'crm_opportunity_duplicate_model_unavailable',
        status: 'UNAVAILABLE',
      },
    };
  }

  const where = {};
  if (args.status) {
    where.status = Array.isArray(args.status)
      ? { in: args.status.map((s) => String(s).toUpperCase()) }
      : String(args.status).toUpperCase();
  }
  if (args.opportunityId) where.opportunityId = String(args.opportunityId);

  const rawLimit = Number(args.limit);
  const limit = Math.min(
    CRM_LIST_MAX_LIMIT,
    Math.max(1, Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : CRM_LIST_DEFAULT_LIMIT)
  );
  const rawOffset = Number(args.offset);
  const offset =
    Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;

  let rows = [];
  try {
    rows = await prisma.crmOpportunityDuplicateCandidate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset > 0 ? offset : undefined,
    });
  } catch {
    rows = [];
  }

  return {
    ok: true,
    items: (rows || []).map(serializeOppDuplicate),
    meta: { count: (rows || []).length, limit, offset, autoMerge: false },
  };
}

/**
 * Human review decision. Does not merge Opportunities.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   id: string,
 *   status: string,
 *   reason?: string,
 *   now?: Date,
 * }} args
 */
export async function reviewOpportunityDuplicateCandidate(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canReviewDuplicates && !access.canEditOpportunities) {
    return { ok: false, forbidden: true, reason: 'crm_review_opportunity_duplicates_forbidden' };
  }

  if (!hasCrmOpportunityDuplicateCandidateModel(prisma)) {
    return {
      ok: false,
      error: 'crm_opportunity_duplicate_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const id = args.id ? String(args.id).trim() : '';
  if (!id) return { ok: false, error: 'id_required' };

  const status = String(args.status || '').trim().toUpperCase();
  if (!STATUS_SET.has(status) || !REVIEWABLE.has(status)) {
    return { ok: false, error: 'invalid_review_status', status };
  }

  const reason = args.reason != null ? String(args.reason).trim() : '';
  if (!reason) return { ok: false, error: 'reason_required' };

  let row = null;
  try {
    row = await prisma.crmOpportunityDuplicateCandidate.findUnique({ where: { id } });
  } catch {
    row = null;
  }
  if (!row) return { ok: false, notFound: true, error: 'duplicate_candidate_not_found' };

  const now = args.now || new Date();
  const updated = await prisma.crmOpportunityDuplicateCandidate.update({
    where: { id: row.id },
    data: {
      status,
      decisionReason: reason,
      reviewedByAdminId: args.admin?.id || null,
      reviewedAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    candidate: serializeOppDuplicate(updated),
    meta: { merged: false, autoMerge: false },
  };
}

export { serializeOppDuplicate };
