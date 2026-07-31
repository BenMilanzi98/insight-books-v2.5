/**
 * Platform Customer match engine — Phase 16 Wave 2 / Phase 20 Wave 2.
 * No auto-merge on similar names. POSSIBLE_MATCH blocks create.
 * EXACT_MATCH / EXACT_EXISTING_CUSTOMER blocks auto-create; LINK_EXISTING only.
 */

import { CRM_CUSTOMER_MATCH_STATE } from './catalogue.js';
import { resolveConversionActor } from './model.js';

function norm(v) {
  return v == null ? '' : String(v).trim().toLowerCase();
}

function hasHardIdentity(evidence = {}) {
  return Boolean(
    evidence.existingCustomerId ||
      evidence.registrationNumber ||
      evidence.taxId ||
      evidence.domain ||
      evidence.verifiedEmail ||
      evidence.verifiedPhone
  );
}

/** Soft name similarity only — never auto-merge; drives POSSIBLE_MATCH. */
function namesSimilar(a, b) {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const ta = na.split(/\s+/).filter(Boolean);
  const tb = nb.split(/\s+/).filter(Boolean);
  if (ta[0] && tb[0] && ta[0] === tb[0] && ta[0].length >= 3) return true;
  let i = 0;
  while (i < na.length && i < nb.length && na[i] === nb[i]) i += 1;
  return i >= 6;
}

function scoreCandidate(evidence, candidate) {
  let hard = 0;
  let soft = 0;
  const reasons = [];

  if (evidence.existingCustomerId && candidate.id === evidence.existingCustomerId) {
    hard += 3;
    reasons.push('existing_customer_id');
  }
  if (
    evidence.registrationNumber &&
    norm(candidate.registrationNumber) === norm(evidence.registrationNumber)
  ) {
    hard += 2;
    reasons.push('registration_number');
  }
  if (evidence.taxId && norm(candidate.taxId) === norm(evidence.taxId)) {
    hard += 2;
    reasons.push('tax_id');
  }
  if (evidence.domain && norm(candidate.domain) === norm(evidence.domain)) {
    hard += 1;
    reasons.push('domain');
  }
  if (evidence.verifiedEmail && norm(candidate.email) === norm(evidence.verifiedEmail)) {
    hard += 1;
    reasons.push('verified_email');
  }
  if (evidence.displayName && namesSimilar(candidate.displayName, evidence.displayName)) {
    soft += 1;
    reasons.push('display_name_similarity');
  }

  return { hard, soft, reasons, candidate };
}

async function loadCandidates(prisma, evidence = {}) {
  const rows = [];

  if (typeof prisma?.platformCustomer?.findMany === 'function') {
    const all = await prisma.platformCustomer.findMany({});
    rows.push(...(all || []));
  }

  if (evidence.accountCustomerId) {
    rows.push({
      id: evidence.accountCustomerId,
      displayName: evidence.displayName || null,
      registrationNumber: evidence.registrationNumber || null,
      taxId: evidence.taxId || null,
      domain: evidence.domain || null,
      via: 'crm_account_customerId',
    });
  }

  const byId = new Map();
  for (const r of rows) {
    if (r?.id && !byId.has(r.id)) byId.set(r.id, r);
  }
  return [...byId.values()];
}

/** Exact identity states that must never auto-create a new Customer. */
export function isExactCustomerMatch(matchState) {
  return (
    matchState === CRM_CUSTOMER_MATCH_STATE.EXACT_MATCH ||
    matchState === CRM_CUSTOMER_MATCH_STATE.EXACT_EXISTING_CUSTOMER
  );
}

export function isExactOrHighConfidenceMatch(matchState) {
  return (
    isExactCustomerMatch(matchState) ||
    matchState === CRM_CUSTOMER_MATCH_STATE.HIGH_CONFIDENCE_MATCH
  );
}

export async function matchPlatformCustomer(prisma, args = {}) {
  let evidence = { ...(args.evidence || {}) };

  if (args.accountId && typeof prisma?.crmAccount?.findUnique === 'function') {
    const account = await prisma.crmAccount.findUnique({
      where: { id: args.accountId },
    });
    if (account) {
      evidence = {
        displayName: evidence.displayName || account.displayName || null,
        registrationNumber:
          evidence.registrationNumber || account.registrationNumber || null,
        taxId: evidence.taxId || account.taxId || null,
        domain: evidence.domain || account.domain || null,
        existingCustomerId:
          evidence.existingCustomerId || account.customerId || null,
        accountCustomerId: account.customerId || null,
        accountId: account.id,
        ...evidence,
      };
    }
  }

  const candidates = await loadCandidates(prisma, evidence);
  const scored = candidates
    .map((c) => scoreCandidate(evidence, c))
    .sort((a, b) => b.hard - a.hard || b.soft - a.soft);

  const hardHits = scored.filter((s) => s.hard > 0);
  const softOnly = scored.filter((s) => s.hard === 0 && s.soft > 0);

  if (hardHits.length > 1) {
    const distinctIds = new Set(hardHits.map((s) => s.candidate.id));
    if (distinctIds.size > 1) {
      return {
        ok: true,
        matchState: CRM_CUSTOMER_MATCH_STATE.CONFLICT,
        candidates: hardHits.map((s) => ({
          customerId: s.candidate.id,
          reasons: s.reasons,
          hard: s.hard,
          soft: s.soft,
        })),
        primaryCandidateId: null,
        reasons: ['multiple_hard_identity_matches'],
        evidence,
      };
    }
  }

  if (hardHits.length === 1 && hardHits[0].hard >= 3) {
    return {
      ok: true,
      // Phase 20 canonical + legacy alias for Wave 2 tests
      matchState: CRM_CUSTOMER_MATCH_STATE.EXACT_MATCH,
      matchStateLegacy: CRM_CUSTOMER_MATCH_STATE.EXACT_EXISTING_CUSTOMER,
      candidates: [
        {
          customerId: hardHits[0].candidate.id,
          reasons: hardHits[0].reasons,
          hard: hardHits[0].hard,
          soft: hardHits[0].soft,
        },
      ],
      primaryCandidateId: hardHits[0].candidate.id,
      reasons: hardHits[0].reasons,
      evidence,
    };
  }

  if (hardHits.length === 1 && hardHits[0].hard >= 1) {
    return {
      ok: true,
      matchState: CRM_CUSTOMER_MATCH_STATE.HIGH_CONFIDENCE_MATCH,
      candidates: [
        {
          customerId: hardHits[0].candidate.id,
          reasons: hardHits[0].reasons,
          hard: hardHits[0].hard,
          soft: hardHits[0].soft,
        },
      ],
      primaryCandidateId: hardHits[0].candidate.id,
      reasons: hardHits[0].reasons,
      evidence,
    };
  }

  if (softOnly.length > 0) {
    return {
      ok: true,
      matchState: CRM_CUSTOMER_MATCH_STATE.POSSIBLE_MATCH,
      candidates: softOnly.map((s) => ({
        customerId: s.candidate.id,
        reasons: s.reasons,
        hard: s.hard,
        soft: s.soft,
      })),
      primaryCandidateId: softOnly[0].candidate.id,
      reasons: hasHardIdentity(evidence)
        ? ['soft_match_with_unmatched_hard_evidence']
        : ['display_name_similarity_only'],
      evidence,
    };
  }

  return {
    ok: true,
    matchState: CRM_CUSTOMER_MATCH_STATE.NO_MATCH,
    candidates: [],
    primaryCandidateId: null,
    reasons: ['no_candidates'],
    evidence,
  };
}

export async function decideCustomerCreateOrLink(prisma, args = {}) {
  const admin = resolveConversionActor(args);
  const match = args.match || {};
  const matchState = match.matchState;
  const action = String(args.action || '').toUpperCase();

  let ok = false;
  let error = null;
  let decision = null;
  let requiresReview = false;

  if (matchState === CRM_CUSTOMER_MATCH_STATE.POSSIBLE_MATCH) {
    ok = false;
    error = 'possible_match_blocks_create';
    requiresReview = true;
    decision = 'BLOCKED_REVIEW';
  } else if (matchState === CRM_CUSTOMER_MATCH_STATE.CONFLICT) {
    ok = false;
    error = 'conflict_blocks_create';
    requiresReview = true;
    decision = 'BLOCKED_CONFLICT';
  } else if (isExactOrHighConfidenceMatch(matchState)) {
    if (action === 'CREATE' || action === 'CREATE_NEW') {
      ok = false;
      error = isExactCustomerMatch(matchState)
        ? 'exact_match_blocks_auto_create'
        : 'exact_or_high_confidence_requires_link';
      decision = 'LINK_REQUIRED';
      requiresReview = isExactCustomerMatch(matchState);
    } else {
      ok = true;
      decision = CRM_CUSTOMER_MATCH_STATE.LINK_EXISTING;
    }
  } else if (matchState === CRM_CUSTOMER_MATCH_STATE.NO_MATCH) {
    if (action === 'LINK' || action === 'LINK_EXISTING') {
      ok = false;
      error = 'no_match_cannot_link';
      decision = 'CREATE_REQUIRED';
    } else {
      ok = true;
      decision = CRM_CUSTOMER_MATCH_STATE.CREATE_NEW;
    }
  } else {
    ok = false;
    error = 'manual_review_required';
    requiresReview = true;
    decision = 'MANUAL_REVIEW_REQUIRED';
  }

  const audited = Boolean(args.conversionId);

  if (
    args.conversionId &&
    typeof prisma?.crmConversionMatchDecision?.create === 'function'
  ) {
    await prisma.crmConversionMatchDecision.create({
      data: {
        conversionId: args.conversionId,
        decisionType: 'CUSTOMER',
        matchState: matchState || null,
        decision,
        actionRequested: action || null,
        ok,
        errorCode: error,
        candidateJson: match.candidates || [],
        actorAdminId: admin?.id || null,
        createdAt: args.now || new Date(),
      },
    });
  }

  return {
    ok,
    decision,
    // Provision action mapping
    action:
      decision === CRM_CUSTOMER_MATCH_STATE.LINK_EXISTING
        ? 'LINK'
        : decision === CRM_CUSTOMER_MATCH_STATE.CREATE_NEW
          ? 'CREATE'
          : action || null,
    matchState,
    error,
    requiresReview,
    audited,
    customerId: match.primaryCandidateId || null,
  };
}

export { CRM_CUSTOMER_MATCH_STATE };
