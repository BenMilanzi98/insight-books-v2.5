import { AiCommentaryValidationError, AssessmentNotFoundError } from '../domain/errors.js';
import { ADVISORY_DISCLAIMER } from '../domain/enums.js';
import { getAssessmentVersion } from './assessmentService.js';

/**
 * Deterministic heuristic commentary — review-only, never changes scores/capacity.
 * Never posts to GL. Never creates Liability.
 */
export async function generateAiCommentary(db, context, assessmentVersionId) {
  const tenantId = context.businessId;
  const cfg = await db.lrdV2Configuration.findUnique({ where: { tenantId } });
  if (cfg && cfg.aiCommentaryEnabled === false) {
    throw new AiCommentaryValidationError('AI commentary is disabled for this business.');
  }

  const version = await getAssessmentVersion(db, tenantId, assessmentVersionId);
  const result = version.resultPayload || {};
  const score = result.score?.totalReadinessScore;
  const band = result.score?.band;
  const affordability = result.debtCapacity?.affordabilityStatus;
  const minDscr = result.dscr?.summary?.minimumDscrObserved;
  const risks = (result.risks || []).slice(0, 5);

  const lines = [
    'Draft AI commentary (pending human review — does not change scores or capacity).',
    `Internal readiness score: ${score ?? 'n/a'} (${band || 'unbanded'}).`,
    `Affordability under assumptions: ${affordability || 'n/a'}.`,
    `Minimum projected DSCR: ${minDscr ?? 'n/a'}.`,
    risks.length
      ? `Top risks: ${risks.map((r) => r.title).join('; ')}.`
      : 'No high-priority risk findings in the assessment payload.',
    ADVISORY_DISCLAIMER,
  ];

  const row = await db.lrdV2AICommentary.create({
    data: {
      tenantId,
      assessmentVersionId: version.id,
      draftText: lines.join('\n'),
      status: 'PENDING_REVIEW',
      modelProvider: 'DETERMINISTIC_HEURISTIC_V1',
    },
  });

  return {
    commentary: row,
    governance: {
      autoApply: false,
      requiresHumanReview: true,
      changesScoresOrCapacity: false,
      postsToGeneralLedger: false,
      createsLiability: false,
      disclaimer: ADVISORY_DISCLAIMER,
    },
  };
}

export async function reviewAiCommentary(db, context, commentaryId, { decision } = {}) {
  const tenantId = context.businessId;
  const row = await db.lrdV2AICommentary.findFirst({ where: { id: commentaryId, tenantId } });
  if (!row) throw new AssessmentNotFoundError('AI commentary not found for this business.');
  if (row.status !== 'PENDING_REVIEW') {
    throw new AiCommentaryValidationError('Commentary already reviewed.');
  }

  if (decision === 'REJECT') {
    return db.lrdV2AICommentary.update({
      where: { id: row.id },
      data: { status: 'REJECTED', reviewedBy: context.userId, reviewedAt: new Date() },
    });
  }
  if (decision !== 'ACCEPT') {
    throw new AiCommentaryValidationError('decision must be ACCEPT or REJECT.');
  }

  return db.lrdV2AICommentary.update({
    where: { id: row.id },
    data: { status: 'ACCEPTED', reviewedBy: context.userId, reviewedAt: new Date() },
  });
}
