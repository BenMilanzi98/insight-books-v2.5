/**
 * CRM duplicate candidates — Phase 11 Wave 2.
 * Detect / list / review only. Never auto-merge.
 * CrmLead ≠ Opportunity ≠ Customer ≠ SupportTicket ≠ CsCase.
 */

import {
  CRM_DUPLICATE_STATUS,
  CRM_DUPLICATE_STATUSES,
  CRM_DUPLICATE_MATCH_TYPE,
  CRM_LIST_DEFAULT_LIMIT,
  CRM_LIST_MAX_LIMIT,
} from './catalogue.js';
import { resolveCrmAccess } from './authz.js';

const STATUS_SET = new Set(CRM_DUPLICATE_STATUSES);
const REVIEWABLE = new Set([
  CRM_DUPLICATE_STATUS.UNDER_REVIEW,
  CRM_DUPLICATE_STATUS.LIKELY_DUPLICATE,
  CRM_DUPLICATE_STATUS.CONFIRMED_DUPLICATE,
  CRM_DUPLICATE_STATUS.CONFIRMED_DISTINCT,
]);

export function hasCrmDuplicateCandidateModel(prisma) {
  return typeof prisma?.crmDuplicateCandidate?.findMany === 'function';
}

function serializeCandidate(row) {
  if (!row) return null;
  return {
    id: row.id,
    leadId: row.leadId,
    candidateLeadId: row.candidateLeadId,
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
 * Create duplicate candidate rows for a newly captured lead.
 * Same source identity / email / phone / handoff ref → candidates.
 * Domain-only matches are LOW confidence suggestions; never auto-merge.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   leadId: string,
 *   sourceCode?: string|null,
 *   emailNormalized?: string|null,
 *   phoneNormalized?: string|null,
 *   handoffRefType?: string|null,
 *   handoffRefId?: string|null,
 *   emailDomain?: string|null,
 *   now?: Date,
 * }} args
 */
export async function detectDuplicateCandidates(prisma, args = {}) {
  if (!hasCrmDuplicateCandidateModel(prisma)) {
    return {
      ok: true,
      created: 0,
      existing: 0,
      items: [],
      meta: { unavailable: true },
    };
  }

  const leadId = args.leadId ? String(args.leadId).trim() : '';
  if (!leadId) return { ok: false, error: 'leadId required' };

  const or = [];
  if (args.emailNormalized) {
    or.push({ emailNormalized: String(args.emailNormalized) });
  }
  if (args.phoneNormalized) {
    or.push({ phoneNormalized: String(args.phoneNormalized) });
  }
  if (args.handoffRefType && args.handoffRefId) {
    or.push({
      handoffRefType: String(args.handoffRefType),
      handoffRefId: String(args.handoffRefId),
    });
  }

  /** @type {Array<{ candidateLeadId: string, matchType: string, matchValue: string|null, confidence: string }>} */
  const pending = [];

  if (or.length && typeof prisma.crmCaptureRecord?.findMany === 'function') {
    let rows = [];
    try {
      rows = await prisma.crmCaptureRecord.findMany({
        where: {
          OR: or,
          leadId: { not: leadId },
        },
        take: 50,
      });
    } catch {
      rows = [];
    }

    for (const row of rows || []) {
      if (!row.leadId || row.leadId === leadId) continue;
      if (
        args.emailNormalized &&
        row.emailNormalized &&
        row.emailNormalized === args.emailNormalized
      ) {
        pending.push({
          candidateLeadId: row.leadId,
          matchType: CRM_DUPLICATE_MATCH_TYPE.EMAIL,
          matchValue: args.emailNormalized,
          confidence: 'HIGH',
        });
      }
      if (
        args.phoneNormalized &&
        row.phoneNormalized &&
        row.phoneNormalized === args.phoneNormalized
      ) {
        pending.push({
          candidateLeadId: row.leadId,
          matchType: CRM_DUPLICATE_MATCH_TYPE.PHONE,
          matchValue: args.phoneNormalized,
          confidence: 'HIGH',
        });
      }
      if (
        args.handoffRefType &&
        args.handoffRefId &&
        row.handoffRefType === args.handoffRefType &&
        row.handoffRefId === args.handoffRefId
      ) {
        pending.push({
          candidateLeadId: row.leadId,
          matchType: CRM_DUPLICATE_MATCH_TYPE.HANDOFF_REF,
          matchValue: `${args.handoffRefType}:${args.handoffRefId}`,
          confidence: 'HIGH',
        });
      }
      // Same capture source + overlapping identity across distinct leads.
      if (
        args.sourceCode &&
        row.sourceCode &&
        String(row.sourceCode).toUpperCase() === String(args.sourceCode).toUpperCase() &&
        ((args.emailNormalized &&
          row.emailNormalized &&
          row.emailNormalized === args.emailNormalized) ||
          (args.phoneNormalized &&
            row.phoneNormalized &&
            row.phoneNormalized === args.phoneNormalized))
      ) {
        pending.push({
          candidateLeadId: row.leadId,
          matchType: CRM_DUPLICATE_MATCH_TYPE.SOURCE_IDENTITY,
          matchValue: `${args.sourceCode}:${args.emailNormalized || ''}|${args.phoneNormalized || ''}`,
          confidence: 'HIGH',
        });
      }
    }
  }

  // Domain-only: suggest, never auto-merge / never elevate status.
  if (
    args.emailDomain &&
    typeof prisma.crmCaptureRecord?.findMany === 'function'
  ) {
    try {
      const domainRows = await prisma.crmCaptureRecord.findMany({
        where: {
          leadId: { not: leadId },
          emailNormalized: { endsWith: `@${args.emailDomain}` },
        },
        take: 20,
      });
      for (const row of domainRows || []) {
        if (!row.leadId || row.leadId === leadId) continue;
        if (row.emailNormalized === args.emailNormalized) continue;
        pending.push({
          candidateLeadId: row.leadId,
          matchType: CRM_DUPLICATE_MATCH_TYPE.DOMAIN,
          matchValue: args.emailDomain,
          confidence: 'LOW',
        });
      }
    } catch {
      // endsWith may be unsupported in mocks — ignore
    }
  }

  const now = args.now || new Date();
  let created = 0;
  let existing = 0;
  const items = [];
  const seen = new Set();

  for (const p of pending) {
    const key = `${p.candidateLeadId}:${p.matchType}`;
    if (seen.has(key)) continue;
    seen.add(key);

    let prior = null;
    try {
      prior = await prisma.crmDuplicateCandidate.findFirst({
        where: {
          leadId,
          candidateLeadId: p.candidateLeadId,
          matchType: p.matchType,
        },
      });
    } catch {
      prior = null;
    }

    if (prior) {
      existing += 1;
      items.push(serializeCandidate(prior));
      continue;
    }

    const row = await prisma.crmDuplicateCandidate.create({
      data: {
        leadId,
        candidateLeadId: p.candidateLeadId,
        matchType: p.matchType,
        matchValue: p.matchValue,
        status: CRM_DUPLICATE_STATUS.NEW,
        confidence: p.confidence,
        createdAt: now,
        updatedAt: now,
      },
    });
    created += 1;
    items.push(serializeCandidate(row));
  }

  return { ok: true, created, existing, items };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   status?: string|string[],
 *   leadId?: string,
 *   limit?: number|string,
 *   offset?: number|string,
 * }} args
 */
export async function listDuplicateCandidates(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canViewDuplicates) {
    return { ok: false, forbidden: true, reason: 'crm_view_duplicates_forbidden', items: [] };
  }

  if (!hasCrmDuplicateCandidateModel(prisma)) {
    return {
      ok: true,
      items: [],
      meta: { unavailable: true, reason: 'crm_duplicate_model_unavailable' },
    };
  }

  const where = {};
  if (args.status) {
    where.status = Array.isArray(args.status)
      ? { in: args.status.map((s) => String(s).toUpperCase()) }
      : String(args.status).toUpperCase();
  }
  if (args.leadId) where.leadId = String(args.leadId);

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
    rows = await prisma.crmDuplicateCandidate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset > 0 ? offset : undefined,
    });
  } catch {
    rows = await prisma.crmDuplicateCandidate.findMany({ where, take: limit });
  }

  return {
    ok: true,
    items: (rows || []).map(serializeCandidate),
    meta: { count: (rows || []).length, limit, offset },
  };
}

/**
 * Record a human review decision. Does not merge leads.
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
export async function reviewDuplicateCandidate(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canReviewDuplicates) {
    return { ok: false, forbidden: true, reason: 'crm_review_duplicates_forbidden' };
  }

  if (!hasCrmDuplicateCandidateModel(prisma)) {
    return { ok: false, error: 'crm_duplicate_model_unavailable', status: 'UNAVAILABLE' };
  }

  const id = args.id ? String(args.id).trim() : '';
  if (!id) return { ok: false, error: 'id required' };

  const status = String(args.status || '').trim().toUpperCase();
  if (!STATUS_SET.has(status) || !REVIEWABLE.has(status)) {
    return { ok: false, error: 'invalid_review_status', status };
  }

  const reason = args.reason != null ? String(args.reason).trim() : '';
  if (!reason) return { ok: false, error: 'reason required' };

  let row = null;
  try {
    row = await prisma.crmDuplicateCandidate.findUnique({ where: { id } });
  } catch {
    row = null;
  }
  if (!row) return { ok: false, notFound: true, error: 'duplicate_candidate_not_found' };

  const now = args.now || new Date();
  const updated = await prisma.crmDuplicateCandidate.update({
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
    candidate: serializeCandidate(updated),
    meta: { merged: false, autoMerge: false },
  };
}

export { serializeCandidate };
