import {
  AssessmentStatus,
  IntegrityStatus,
  ADVISORY_DISCLAIMER,
} from '../domain/enums.js';
import {
  AssessmentIntegrityBlockedError,
  AssessmentNotFoundError,
  AssessmentVersionImmutableError,
  CrossTenantLoanReadinessError,
} from '../domain/errors.js';
import { runLoanReadinessAssessment } from '../domain/assessmentEngine.js';
import { assessDocumentReadiness } from '../domain/documentChecklist.js';
import {
  assertAssessmentApprovalSod,
  assertAssessmentReviewSod,
} from '../domain/separationOfDuties.js';
import { parseToMinor } from '../domain/money.js';
import { ensureLoanReadinessConfiguration } from './configService.js';
import { serializeLoanReadiness } from './serialize.js';

const IMMUTABLE = new Set([
  AssessmentStatus.APPROVED,
  AssessmentStatus.ACTIVE,
  AssessmentStatus.SUPERSEDED,
]);

/** Pilot opening balances when tenant does not supply books snapshot. */
export const DEFAULT_PILOT_OPENING = {
  cash: '80000.00',
  receivables: '60000.00',
  inventory: '40000.00',
  payables: '35000.00',
  shortTermDebt: '20000.00',
  longTermDebt: '100000.00',
  equity: '150000.00',
  retainedEarnings: '75000.00',
  taxPayable: '5000.00',
};

export function buildPilotForecast(termMonths = 36, baseEbitdaMinor = 12000000) {
  const months = Math.max(12, Number(termMonths) || 36);
  return {
    integrityStatus: 'VALID',
    periods: Array.from({ length: months }, (_, i) => ({
      label: `M${i + 1}`,
      pnl: {
        ebitda: { minor: String(Math.round(baseEbitdaMinor * (1 + i * 0.002))), decimal: '0' },
        tax: { minor: '1000000', decimal: '0' },
        interest: { minor: '500000', decimal: '0' },
        depreciation: { minor: '800000', decimal: '0' },
      },
      cashFlow: { netCashMovement: { minor: '2000000', decimal: '0' } },
      balanceSheet: {
        cash: { minor: '8000000', decimal: '0' },
        receivables: { minor: '6000000', decimal: '0' },
        inventory: { minor: '4000000', decimal: '0' },
        shortTermDebt: { minor: '2000000', decimal: '0' },
        longTermDebt: { minor: '10000000', decimal: '0' },
        totalEquity: { minor: '22500000', decimal: '0' },
      },
    })),
  };
}

export async function createAssessmentCycle(db, context, input = {}) {
  await ensureLoanReadinessConfiguration(db, context);
  const tenantId = context.businessId;
  const assessmentNumber = input.assessmentNumber || `LRD-${Date.now()}`;
  return db.lrdV2AssessmentCycle.create({
    data: {
      tenantId,
      assessmentNumber,
      name: input.name || assessmentNumber,
      description: input.description || null,
      assessmentDate: new Date(input.assessmentDate || new Date()),
      forecastVersionId: input.forecastVersionId || null,
      status: 'DRAFT',
      createdBy: context.userId,
      metadata: input.metadata || null,
    },
  });
}

export async function listAssessmentCycles(db, tenantId) {
  const rows = await db.lrdV2AssessmentCycle.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    include: {
      versions: {
        orderBy: { version: 'desc' },
        take: 5,
        select: {
          id: true,
          version: true,
          name: true,
          status: true,
          integrityStatus: true,
          totalReadinessScore: true,
          confidence: true,
          checksum: true,
          approvedAt: true,
          generatedAt: true,
          resultPayload: true,
        },
      },
    },
  });
  return serializeLoanReadiness(rows);
}

export async function createLoanRequest(db, context, input = {}) {
  await ensureLoanReadinessConfiguration(db, context);
  const tenantId = context.businessId;
  const requestNumber = input.requestNumber || `LRQ-${Date.now()}`;
  const row = await db.lrdV2LoanRequest.create({
    data: {
      tenantId,
      requestNumber,
      purpose: input.purpose || 'WORKING_CAPITAL',
      requestedAmountMinor: BigInt(input.requestedAmountMinor ?? parseToMinor(input.requestedAmount || 0)),
      currency: input.currency || 'MWK',
      requestedTermMonths: Number(input.requestedTermMonths || 36),
      repaymentFrequency: input.repaymentFrequency || 'MONTHLY',
      expectedInterestRateBps: Number(input.expectedInterestRateBps || 1800),
      rateType: input.rateType || 'FIXED',
      gracePeriodMonths: Number(input.gracePeriodMonths || 0),
      balloonAmountMinor: BigInt(input.balloonAmountMinor ?? parseToMinor(input.balloonAmount || 0)),
      amortizationMethod: input.amortizationMethod || 'EQUAL_INSTALMENT',
      useOfFunds: input.useOfFunds || null,
      proposedSecurityType: input.proposedSecurityType || null,
      status: 'DRAFT',
      createdBy: context.userId,
      metadata: input.metadata || null,
    },
  });
  return serializeLoanReadiness(row);
}

export async function createAssessmentVersion(db, context, input = {}) {
  const tenantId = context.businessId;
  const cycle = await db.lrdV2AssessmentCycle.findFirst({
    where: { id: input.assessmentCycleId, tenantId },
  });
  if (!cycle) throw new CrossTenantLoanReadinessError('Assessment cycle not found.');

  const latest = await db.lrdV2AssessmentVersion.findFirst({
    where: { assessmentCycleId: cycle.id, tenantId },
    orderBy: { version: 'desc' },
  });
  const version = (latest?.version || 0) + 1;

  return db.lrdV2AssessmentVersion.create({
    data: {
      tenantId,
      assessmentCycleId: cycle.id,
      version,
      name: input.name || `${cycle.name} v${version}`,
      status: AssessmentStatus.DRAFT,
      integrityStatus: IntegrityStatus.NOT_CALCULATED,
      forecastVersionId: input.forecastVersionId || cycle.forecastVersionId,
      preparedBy: context.userId,
      metadata: {
        neverPostsToGl: true,
        loanRequestId: input.loanRequestId || null,
        ...(input.metadata || {}),
      },
    },
  });
}

/**
 * One-click path: ensure config → loan request → cycle → version → calculate.
 */
export async function runAssessment(db, context, input = {}) {
  await ensureLoanReadinessConfiguration(db, context);

  const termMonths = Number(input.requestedTermMonths || input.termMonths || 36);
  const loanRequest = await createLoanRequest(db, context, {
    purpose: input.purpose || 'WORKING_CAPITAL',
    requestedAmount: input.requestedAmount,
    requestedAmountMinor: input.requestedAmountMinor,
    requestedTermMonths: termMonths,
    expectedInterestRateBps: Number(input.expectedInterestRateBps ?? input.rateBps ?? 1800),
    gracePeriodMonths: Number(input.gracePeriodMonths ?? input.graceMonths ?? 0),
    balloonAmount: input.balloonAmount ?? input.balloon ?? '0',
    currency: input.currency,
    amortizationMethod: input.amortizationMethod,
    rateType: input.rateType,
    useOfFunds: input.useOfFunds,
    proposedSecurityType: input.proposedSecurityType,
  });

  const cycle = await createAssessmentCycle(db, context, {
    name: input.name || `Assessment ${input.purpose || 'WORKING_CAPITAL'}`,
    assessmentDate: input.assessmentDate || new Date().toISOString().slice(0, 10),
    description: input.description || null,
  });

  const versionRow = await createAssessmentVersion(db, context, {
    assessmentCycleId: cycle.id,
    loanRequestId: loanRequest.id,
    name: input.versionName,
  });

  const openingBalances = input.openingBalances || DEFAULT_PILOT_OPENING;
  const forecast =
    input.forecast ||
    buildPilotForecast(termMonths, Number(input.baseEbitdaMinor || 12000000));
  const existingDebt = input.existingDebt || [
    { currentBalance: '100000.00', interestRate: 18, principalAmount: '100000.00' },
  ];

  const version = await calculateAssessmentVersion(db, context, versionRow.id, {
    loanRequestId: loanRequest.id,
    openingBalances,
    forecast,
    existingDebt,
    bankReconciled: input.bankReconciled !== false,
    closedPeriodsAvailable: input.closedPeriodsAvailable !== false,
    sourceActualsVersion: input.sourceActualsVersion || 'pilot',
    baseEbitdaMinor: input.baseEbitdaMinor || 12000000,
    lenderCriteria: input.lenderCriteria,
    documentChecklistSubmitted: input.documentChecklistSubmitted,
  });

  return serializeLoanReadiness({
    loanRequest,
    cycle,
    version,
    result: version.resultPayload,
    disclaimer: ADVISORY_DISCLAIMER,
  });
}

export async function getAssessmentVersion(db, tenantId, id) {
  const row = await db.lrdV2AssessmentVersion.findFirst({
    where: { id, tenantId },
    include: { cycle: true, snapshots: true, aiNotes: { orderBy: { createdAt: 'desc' }, take: 10 } },
  });
  if (!row) throw new AssessmentNotFoundError();
  return serializeLoanReadiness(row);
}

export async function calculateAssessmentVersion(db, context, assessmentVersionId, options = {}) {
  const tenantId = context.businessId;
  const av = await getAssessmentVersion(db, tenantId, assessmentVersionId);
  if (IMMUTABLE.has(av.status)) throw new AssessmentVersionImmutableError();

  await db.lrdV2AssessmentVersion.update({
    where: { id: av.id },
    data: {
      status: AssessmentStatus.CALCULATING,
      integrityStatus: IntegrityStatus.CALCULATING,
    },
  });

  try {
    let loanRequest = null;
    const loanRequestId = options.loanRequestId || av.metadata?.loanRequestId;
    if (loanRequestId) {
      loanRequest = await db.lrdV2LoanRequest.findFirst({
        where: { id: loanRequestId, tenantId },
      });
    }

    let forecast = options.forecast || null;
    if (!forecast && av.forecastVersionId && db.planV2ForecastVersion) {
      const fv = await db.planV2ForecastVersion.findFirst({
        where: { id: av.forecastVersionId, tenantId },
      });
      if (fv?.resultPayload) {
        forecast = fv.resultPayload;
      }
    }

    const existingDebt = options.existingDebt || (await loadExistingDebt(db, tenantId));

    let documentReadiness = options.documentReadiness;
    if (Array.isArray(options.documentChecklistSubmitted)) {
      documentReadiness = assessDocumentReadiness(options.documentChecklistSubmitted);
    }

    const result = runLoanReadinessAssessment({
      loanRequest: loanRequest
        ? {
            purpose: loanRequest.purpose,
            requestedAmount: loanRequest.requestedAmountMinor,
            requestedTermMonths: loanRequest.requestedTermMonths,
            expectedInterestRateBps: loanRequest.expectedInterestRateBps,
            rateType: loanRequest.rateType,
            gracePeriodMonths: loanRequest.gracePeriodMonths,
            balloonAmount: loanRequest.balloonAmountMinor,
            amortizationMethod: loanRequest.amortizationMethod,
            proposedSecurityType: loanRequest.proposedSecurityType,
            capitalizeInterestInGrace: options.capitalizeInterestInGrace,
          }
        : options.loanRequest,
      forecast,
      forecastVersionId: av.forecastVersionId,
      sourceActualsVersion: options.sourceActualsVersion || av.sourceActualsVersion,
      existingDebt,
      openingBalances: options.openingBalances,
      lenderCriteria: options.lenderCriteria || {
        minimumDSCR: 1.25,
        minimumCurrentRatio: 1.1,
        maximumDebtToEquity: 2.5,
        sourceReference: 'INTERNAL_DEFAULT',
        label: 'Internal criteria — not lender-issued',
      },
      documentReadiness,
      collateralReadiness: options.collateralReadiness,
      bankReconciled: options.bankReconciled,
      closedPeriodsAvailable: options.closedPeriodsAvailable,
      materialExceptions: options.materialExceptions,
      baseEbitdaMinor: options.baseEbitdaMinor,
      baseRevenueMinor: options.baseRevenueMinor,
      planningAssumptions: options.planningAssumptions,
    });

    const status =
      result.integrityStatus === IntegrityStatus.INVALID ||
      result.integrityStatus === IntegrityStatus.BLOCKED
        ? AssessmentStatus.INVALID
        : AssessmentStatus.READY_FOR_REVIEW;

    const updated = await db.lrdV2AssessmentVersion.update({
      where: { id: av.id },
      data: {
        status,
        integrityStatus: result.integrityStatus,
        resultPayload: result,
        checksum: result.checksum,
        totalReadinessScore: result.score?.totalReadinessScore ?? null,
        confidence: result.score?.confidence || result.dataQuality?.confidence,
        sourceActualsVersion: options.sourceActualsVersion || av.sourceActualsVersion,
        generatedAt: new Date(),
        metadata: {
          ...(av.metadata || {}),
          neverPostsToGl: true,
          disclaimer: ADVISORY_DISCLAIMER,
        },
      },
      include: { cycle: true },
    });
    return serializeLoanReadiness(updated);
  } catch (error) {
    await db.lrdV2AssessmentVersion.update({
      where: { id: av.id },
      data: {
        status: AssessmentStatus.FAILED,
        integrityStatus: IntegrityStatus.BLOCKED,
        metadata: {
          ...(av.metadata || {}),
          lastError: { message: error.message, code: error.code },
        },
      },
    });
    throw error;
  }
}

/**
 * Dual-control review: preparer cannot mark their own assessment reviewed.
 */
export async function reviewAssessmentVersion(db, context, assessmentVersionId) {
  const tenantId = context.businessId;
  const av = await getAssessmentVersion(db, tenantId, assessmentVersionId);
  if (IMMUTABLE.has(av.status)) throw new AssessmentVersionImmutableError();
  if (
    av.status !== AssessmentStatus.READY_FOR_REVIEW &&
    av.status !== AssessmentStatus.REVIEWED &&
    av.status !== AssessmentStatus.CALCULATED
  ) {
    throw new AssessmentIntegrityBlockedError(
      'Assessment must be calculated and ready for review before review can be recorded.'
    );
  }
  if (
    av.integrityStatus === IntegrityStatus.INVALID ||
    av.integrityStatus === IntegrityStatus.BLOCKED ||
    av.integrityStatus === IntegrityStatus.NOT_CALCULATED
  ) {
    throw new AssessmentIntegrityBlockedError();
  }
  assertAssessmentReviewSod({ preparedBy: av.preparedBy, reviewerUserId: context.userId });

  return db.lrdV2AssessmentVersion.update({
    where: { id: av.id },
    data: {
      status: AssessmentStatus.REVIEWED,
      reviewedBy: context.userId,
    },
    include: { cycle: true },
  });
}

export async function approveAssessmentVersion(db, context, assessmentVersionId) {
  const tenantId = context.businessId;
  const av = await getAssessmentVersion(db, tenantId, assessmentVersionId);
  if (IMMUTABLE.has(av.status)) throw new AssessmentVersionImmutableError('Already approved.');
  if (
    av.integrityStatus === IntegrityStatus.INVALID ||
    av.integrityStatus === IntegrityStatus.BLOCKED ||
    av.integrityStatus === IntegrityStatus.NOT_CALCULATED
  ) {
    throw new AssessmentIntegrityBlockedError();
  }

  assertAssessmentApprovalSod({
    preparedBy: av.preparedBy,
    reviewedBy: av.reviewedBy,
    approverUserId: context.userId,
  });

  const updated = await db.lrdV2AssessmentVersion.update({
    where: { id: av.id },
    data: {
      status: AssessmentStatus.APPROVED,
      approvedBy: context.userId,
      approvedAt: new Date(),
      reviewedBy: av.reviewedBy,
    },
  });

  await db.lrdV2AssessmentSnapshot.upsert({
    where: {
      assessmentVersionId_snapshotType: {
        assessmentVersionId: av.id,
        snapshotType: 'APPROVED_ASSESSMENT',
      },
    },
    create: {
      tenantId,
      assessmentVersionId: av.id,
      snapshotType: 'APPROVED_ASSESSMENT',
      payload: {
        result: av.resultPayload,
        score: av.totalReadinessScore,
        confidence: av.confidence,
        disclaimer: ADVISORY_DISCLAIMER,
        neverPostsToGl: true,
      },
      checksum: av.checksum,
      generatedBy: context.userId,
    },
    update: {},
  });

  return updated;
}

async function loadExistingDebt(db, tenantId) {
  if (typeof db.liability?.findMany !== 'function') return [];
  const rows = await db.liability.findMany({
    where: { tenantId, status: { not: 'PAID_OFF' } },
    take: 100,
  });
  return rows.map((r) => ({
    id: r.id,
    lender: r.lender,
    currentBalance: r.currentBalance,
    principalAmount: r.principalAmount,
    interestRate: r.interestRate,
    maturityDate: r.maturityDate,
  }));
}
