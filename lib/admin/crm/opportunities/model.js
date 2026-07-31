/**
 * Shared Opportunity model guards + serialize — Phase 12 Wave 1–2.
 * Kept separate to avoid circular imports between transition and Wave 2 modules.
 */

export function hasCrmOpportunityModel(prisma) {
  return typeof prisma?.crmOpportunity?.findUnique === 'function';
}

export function hasCrmOpportunityStageHistoryModel(prisma) {
  return typeof prisma?.crmOpportunityStageHistory?.create === 'function';
}

export function serializeOpportunity(row) {
  if (!row) return null;
  return {
    id: row.id,
    opportunityNumber: row.opportunityNumber,
    pipelineCode: row.pipelineCode || null,
    pipelineVersionId: row.pipelineVersionId || null,
    stageCode: row.stageCode,
    status: row.status,
    leadId: row.leadId || null,
    accountId: row.accountId || null,
    contactId: row.contactId || null,
    title: row.title || null,
    ownerAdminId: row.ownerAdminId || null,
    handoffIdempotencyKey: row.handoffIdempotencyKey || null,
    importIdempotencyKey: row.importIdempotencyKey || null,
    mergedIntoOpportunityId: row.mergedIntoOpportunityId || null,
    version: row.version ?? 1,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    amount: row.amount != null ? String(row.amount) : null,
    currency: row.currency || null,
    amountBasis: row.amountBasis || null,
    recurringAnnualAmount:
      row.recurringAnnualAmount != null ? String(row.recurringAnnualAmount) : null,
    oneTimeAmount: row.oneTimeAmount != null ? String(row.oneTimeAmount) : null,
    probability: row.probability != null ? Number(row.probability) : null,
    probabilitySource: row.probabilitySource || null,
    probabilityConfidence: row.probabilityConfidence || null,
    probabilityOverrideReason: row.probabilityOverrideReason || null,
    expectedCloseDate: row.expectedCloseDate
      ? new Date(row.expectedCloseDate).toISOString()
      : null,
    closeDateSource: row.closeDateSource || null,
    closeDateConfidence: row.closeDateConfidence || null,
    winReason: row.winReason || null,
    lossReason: row.lossReason || null,
    decisionDate: row.decisionDate
      ? new Date(row.decisionDate).toISOString()
      : null,
    closeEvidence: row.closeEvidence ?? null,
    closedAt: row.closedAt ? new Date(row.closedAt).toISOString() : null,
    closedByAdminId: row.closedByAdminId || null,
    closeApprovalStatus: row.closeApprovalStatus || null,
    reopenReason: row.reopenReason || null,
    reopenedAt: row.reopenedAt ? new Date(row.reopenedAt).toISOString() : null,
    reopenedByAdminId: row.reopenedByAdminId || null,
  };
}
