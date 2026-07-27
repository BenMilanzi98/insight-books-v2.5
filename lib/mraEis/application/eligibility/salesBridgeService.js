/**
 * Local Transaction Bridge + Outbox + Finalization Identity — Phase 11.
 * Creates no Journal, no Stock Movement, no MRA API call, no fiscal number, no QR.
 */
import crypto from 'crypto';
import prisma from '@/lib/prisma.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';
import { appendEisOutboxEvent } from '../../infrastructure/outbox/outboxService.js';
import { recordEisControlAudit } from '../../infrastructure/audit.js';
import { EIS_OUTBOX_EVENT } from '../../domain/operationalEnums.js';
import {
  evaluateMraEisSaleEligibility,
  ELIGIBILITY_DECISION,
  EVALUATION_PURPOSE,
} from './eligibilityPipeline.js';
import { getComplianceHoldPolicy } from './complianceHoldPolicy.js';
import { projectTransactionEisStatus } from './statusAndMessaging.js';
import { SalesEligibilityErrors } from './salesEligibilityErrors.js';

export const BRIDGE_STATUS = Object.freeze({
  DISCOVERED: 'DISCOVERED',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  EVALUATING: 'EVALUATING',
  BLOCKED: 'BLOCKED',
  COMPLIANCE_HOLD: 'COMPLIANCE_HOLD',
  ELIGIBLE: 'ELIGIBLE',
  OUTBOX_PENDING: 'OUTBOX_PENDING',
  READY_FOR_FISCAL_SNAPSHOT: 'READY_FOR_FISCAL_SNAPSHOT',
  FISCAL_SNAPSHOT_CREATED: 'FISCAL_SNAPSHOT_CREATED',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  SUPERSEDED: 'SUPERSEDED',
  CANCELLED_BEFORE_FISCALIZATION: 'CANCELLED_BEFORE_FISCALIZATION',
  ERROR: 'ERROR',
  RECOVERY_REQUIRED: 'RECOVERY_REQUIRED',
});

const BRIDGE_TRANSITIONS = Object.freeze({
  [BRIDGE_STATUS.DISCOVERED]: [
    BRIDGE_STATUS.EVALUATING,
    BRIDGE_STATUS.NOT_APPLICABLE,
  ],
  [BRIDGE_STATUS.EVALUATING]: [
    BRIDGE_STATUS.ELIGIBLE,
    BRIDGE_STATUS.BLOCKED,
    BRIDGE_STATUS.COMPLIANCE_HOLD,
    BRIDGE_STATUS.MANUAL_REVIEW,
    BRIDGE_STATUS.NOT_APPLICABLE,
    BRIDGE_STATUS.ERROR,
  ],
  [BRIDGE_STATUS.COMPLIANCE_HOLD]: [BRIDGE_STATUS.EVALUATING, BRIDGE_STATUS.BLOCKED, BRIDGE_STATUS.ELIGIBLE],
  [BRIDGE_STATUS.MANUAL_REVIEW]: [BRIDGE_STATUS.EVALUATING],
  [BRIDGE_STATUS.ELIGIBLE]: [BRIDGE_STATUS.OUTBOX_PENDING],
  [BRIDGE_STATUS.OUTBOX_PENDING]: [BRIDGE_STATUS.READY_FOR_FISCAL_SNAPSHOT, BRIDGE_STATUS.ERROR],
  [BRIDGE_STATUS.READY_FOR_FISCAL_SNAPSHOT]: [BRIDGE_STATUS.FISCAL_SNAPSHOT_CREATED],
  [BRIDGE_STATUS.BLOCKED]: [BRIDGE_STATUS.EVALUATING],
  [BRIDGE_STATUS.RECOVERY_REQUIRED]: [BRIDGE_STATUS.EVALUATING, BRIDGE_STATUS.ELIGIBLE, BRIDGE_STATUS.OUTBOX_PENDING],
  [BRIDGE_STATUS.ERROR]: [BRIDGE_STATUS.EVALUATING, BRIDGE_STATUS.RECOVERY_REQUIRED],
});

export const FISCAL_SNAPSHOT_REQUESTED_EVENT =
  EIS_OUTBOX_EVENT.FISCAL_SNAPSHOT_REQUESTED || 'MRA_EIS_FISCAL_SNAPSHOT_REQUESTED';

export function buildSourceFinalizationIdentity({
  tenantId,
  businessId,
  sourceType,
  sourceId,
  sourceVersion,
  finalizedAt,
  transactionNumber = null,
  environment = 'SANDBOX',
}) {
  const ts = finalizedAt ? new Date(finalizedAt).toISOString() : '';
  const raw = [
    tenantId,
    businessId,
    sourceType,
    sourceId,
    String(sourceVersion || '1'),
    ts,
    String(environment).toUpperCase(),
  ].join('|');
  const hash = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
  return {
    sourceFinalizationIdentity: `${sourceType}:${sourceId}:v${sourceVersion}:${hash}`,
    sourceType,
    sourceId,
    sourceVersion: String(sourceVersion || '1'),
    finalizationTimestamp: ts || null,
    transactionNumber,
    businessId,
    environment: String(environment).toUpperCase(),
  };
}

export function assertBridgeTransition(from, to) {
  const allowed = BRIDGE_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw SalesEligibilityErrors.bridgeStateTransition({
      message: `Invalid bridge transition ${from} → ${to}`,
      details: { from, to },
    });
  }
}

function assertNoSecretsInPayload(payload) {
  const text = JSON.stringify(payload ?? {});
  if (/(authorization|bearer\s|secretKey|jwt|tac\b|buyerAuthorizationCode|buyer_auth)/i.test(text)) {
    throw SalesEligibilityErrors.outboxCreation({
      message: 'Outbox/bridge payload must not contain secrets or buyer authorization codes.',
    });
  }
}

/**
 * Persist immutable eligibility decision (append-only).
 */
export async function persistEligibilityDecision(decision, { db = prisma } = {}) {
  assertTenantBusinessMatch(decision.tenantId, decision.businessId);
  assertNoSecretsInPayload({
    blockerCodes: decision.blockerCodes,
    warningCodes: decision.warningCodes,
    summary: decision.safeDecisionSummary,
  });

  return db.mraEisEligibilityDecision.create({
    data: {
      tenantId: decision.tenantId,
      businessId: decision.businessId,
      sourceType: decision.sourceType,
      sourceId: decision.sourceId || 'PENDING',
      sourceVersion: String(decision.sourceVersion || '1'),
      sourceFinalizationIdentity: decision.sourceFinalizationIdentity || null,
      environment: decision.environment,
      decision: decision.decision,
      policyVersion: decision.policyVersion,
      evaluatedAt: new Date(decision.evaluatedAt || Date.now()),
      evaluatedBy: decision.evaluatedBy,
      terminalId: decision.terminalId,
      configurationSetChecksum: decision.configurationSetChecksum,
      sourceChecksum: decision.sourceChecksum,
      lineCount: decision.lineCount || 0,
      currency: decision.currency || 'MWK',
      grossAmount: decision.grossAmount,
      netAmount: decision.netAmount,
      taxAmount: decision.taxAmount,
      levyAmount: decision.levyAmount,
      discountAmount: decision.discountAmount,
      paymentTotal: decision.paymentTotal,
      buyerClassification: decision.buyerClassification,
      blockerCodes: decision.blockerCodes || [],
      warningCodes: decision.warningCodes || [],
      safeDecisionSummary: decision.safeDecisionSummary,
      stageEvidence: redactStages(decision.stages),
      purpose: decision.purpose || null,
    },
  });
}

function redactStages(stages) {
  if (!stages) return null;
  // Drop any accidental sensitive fields; keep codes/ids only
  const json = JSON.stringify(stages);
  if (/(buyerAuthorizationCode|secretKey|jwt|bearer)/i.test(json)) {
    return { redacted: true, reason: 'SENSITIVE_FIELD_STRIPPED' };
  }
  return stages;
}

/**
 * Create or return existing bridge for a finalization identity (idempotent).
 */
export async function createOrGetSalesBridge({
  tenantId,
  businessId = tenantId,
  branchId = null,
  terminalId = null,
  sourceType,
  sourceId,
  sourceVersion,
  sourceFinalizationIdentity,
  sourceTransactionNumber = null,
  sourceFinalizedAt,
  businessDate = null,
  environment,
  eligibilityDecisionId,
  eligibilityPolicyVersion,
  sourceChecksum,
  configurationSetChecksum = null,
  lineCount = 0,
  currency = 'MWK',
  grossAmount = null,
  taxAmount = null,
  levyAmount = null,
  discountAmount = null,
  paymentTotal = null,
  buyerClassification = null,
  siteMappingId = null,
  warehouseMappingId = null,
  status = BRIDGE_STATUS.ELIGIBLE,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const env = String(environment).toUpperCase();

  const existing = await db.mraEisSalesBridge.findUnique({
    where: {
      tenantId_businessId_sourceFinalizationIdentity_environment: {
        tenantId,
        businessId,
        sourceFinalizationIdentity,
        environment: env,
      },
    },
  });
  if (existing) {
    if (existing.sourceChecksum && sourceChecksum && existing.sourceChecksum !== sourceChecksum) {
      throw SalesEligibilityErrors.bridgeIdempotencyConflict({
        message: 'Bridge identity exists with a conflicting source checksum.',
        details: { sourceFinalizationIdentity },
      });
    }
    return { bridge: existing, created: false, duplicatePrevented: true };
  }

  try {
    const bridge = await db.mraEisSalesBridge.create({
      data: {
        tenantId,
        businessId,
        branchId,
        terminalId,
        sourceType,
        sourceId,
        sourceVersion: String(sourceVersion || '1'),
        sourceFinalizationIdentity,
        sourceTransactionNumber,
        sourceFinalizedAt: sourceFinalizedAt ? new Date(sourceFinalizedAt) : new Date(),
        businessDate: businessDate ? new Date(businessDate) : new Date(),
        environment: env,
        status,
        eligibilityDecisionId,
        eligibilityPolicyVersion,
        sourceChecksum,
        configurationSetChecksum,
        lineCount,
        currency,
        grossAmount,
        taxAmount,
        levyAmount,
        discountAmount,
        paymentTotal,
        buyerClassification,
        siteMappingId,
        warehouseMappingId,
        bridgeCreatedAt: new Date(),
        lastEvaluatedAt: new Date(),
        version: 1,
      },
    });
    return { bridge, created: true, duplicatePrevented: false };
  } catch (err) {
    if (err?.code === 'P2002') {
      const again = await db.mraEisSalesBridge.findUnique({
        where: {
          tenantId_businessId_sourceFinalizationIdentity_environment: {
            tenantId,
            businessId,
            sourceFinalizationIdentity,
            environment: env,
          },
        },
      });
      if (again) return { bridge: again, created: false, duplicatePrevented: true };
    }
    throw err;
  }
}

export async function appendFiscalSnapshotRequestedOutbox({
  tenantId,
  businessId,
  bridge,
  eligibilityDecisionId,
  correlationId = null,
  requestId = null,
  db = prisma,
}) {
  const payload = {
    eventVersion: '1',
    tenantId,
    businessId,
    bridgeRecordId: bridge.id,
    sourceType: bridge.sourceType,
    sourceId: bridge.sourceId,
    sourceVersion: bridge.sourceVersion,
    sourceFinalizationIdentity: bridge.sourceFinalizationIdentity,
    eligibilityDecisionId,
    environment: bridge.environment,
    correlationId,
    occurredAt: new Date().toISOString(),
  };
  assertNoSecretsInPayload(payload);

  const event = await appendEisOutboxEvent({
    tenantId,
    businessId,
    aggregateType: 'MraEisSalesBridge',
    aggregateId: bridge.id,
    eventType: FISCAL_SNAPSHOT_REQUESTED_EVENT,
    eventVersion: '1',
    payload,
    idempotencyKey: `fiscal-snapshot-req:${bridge.id}:v${bridge.version}`,
    requestId,
    correlationId,
    db,
  });
  return event;
}

/**
 * Transition bridge with expected version (CAS).
 */
export async function transitionSalesBridge({
  bridgeId,
  tenantId,
  businessId,
  fromStatus,
  toStatus,
  expectedVersion,
  db = prisma,
  actorId = null,
}) {
  assertBridgeTransition(fromStatus, toStatus);
  const updated = await db.mraEisSalesBridge.updateMany({
    where: {
      id: bridgeId,
      tenantId,
      businessId,
      status: fromStatus,
      version: expectedVersion,
    },
    data: {
      status: toStatus,
      version: { increment: 1 },
      lastEvaluatedAt: new Date(),
    },
  });
  if (updated.count !== 1) {
    throw SalesEligibilityErrors.bridgeStateTransition({
      message: 'Bridge version conflict or invalid status.',
      details: { bridgeId, fromStatus, toStatus, expectedVersion },
    });
  }
  const bridge = await db.mraEisSalesBridge.findUnique({ where: { id: bridgeId } });
  await recordEisControlAudit({
    tenantId,
    businessId,
    actorId,
    actorType: actorId ? 'USER' : 'SERVICE',
    action: 'SALES_BRIDGE_STATUS_CHANGED',
    resourceType: 'MraEisSalesBridge',
    resourceId: bridgeId,
    metadata: { fromStatus, toStatus, version: bridge.version },
  }, db).catch(() => {});
  return bridge;
}

/**
 * Authoritative post-accounting bridge attachment (same DB transaction when possible).
 * Does not create Journals or Stock Movements.
 */
export async function attachEisSalesBridgeAfterFinalization({
  tenantId,
  businessId = tenantId,
  sourceType,
  sourceId,
  sourceVersion = '1',
  sourceState = 'COMPLETED',
  sourceTransactionNumber = null,
  finalizedAt = new Date(),
  branchId = null,
  warehouseId = null,
  preferredTerminalId = null,
  environment = null,
  currency = 'MWK',
  lines = [],
  payments = [],
  header = {},
  buyer = {},
  isCreditSale = false,
  isVat5 = false,
  isReliefSupply = false,
  buyerAuthorizationEphemeralProvided = false,
  accountingPostingIdentity = null,
  inventoryPostingIdentity = null,
  actorContext = null,
  correlationId = null,
  requestId = null,
  /** When true, blockers throw and caller should roll back finalization */
  blockFinalizationOnEligibilityFailure = true,
  db = prisma,
} = {}) {
  assertTenantBusinessMatch(tenantId, businessId);

  const identity = buildSourceFinalizationIdentity({
    tenantId,
    businessId,
    sourceType,
    sourceId,
    sourceVersion,
    finalizedAt,
    transactionNumber: sourceTransactionNumber,
    environment: environment || 'SANDBOX',
  });

  const existing = await db.mraEisSalesBridge.findUnique({
    where: {
      tenantId_businessId_sourceFinalizationIdentity_environment: {
        tenantId,
        businessId,
        sourceFinalizationIdentity: identity.sourceFinalizationIdentity,
        environment: identity.environment,
      },
    },
  });
  if (existing) {
    return {
      ok: true,
      duplicate: true,
      bridge: existing,
      eisStatus: projectTransactionEisStatus({ bridgeStatus: existing.status }),
      message: 'Existing EIS bridge returned (idempotent).',
    };
  }

  const eligibility = await evaluateMraEisSaleEligibility({
    tenantId,
    businessId,
    sourceType,
    sourceId,
    sourceVersion,
    sourceState,
    environment: environment || identity.environment,
    purpose: EVALUATION_PURPOSE.FINALIZATION,
    branchId,
    warehouseId,
    preferredTerminalId,
    transactionDate: finalizedAt,
    finalizedAt,
    currency,
    lines,
    payments,
    header,
    buyer,
    isCreditSale,
    isVat5,
    isReliefSupply,
    buyerAuthorizationEphemeralProvided,
    actorContext,
    db,
  });

  eligibility.sourceFinalizationIdentity = identity.sourceFinalizationIdentity;

  if (eligibility.decision === ELIGIBILITY_DECISION.NOT_APPLICABLE) {
    return {
      ok: true,
      applicable: false,
      eligibility,
      bridge: null,
      eisStatus: projectTransactionEisStatus({
        applicability: { applicable: false, reason: eligibility.applicabilityReason },
      }),
      message: eligibility.safeDecisionSummary,
    };
  }

  if (
    eligibility.decision === ELIGIBILITY_DECISION.BLOCKED ||
    eligibility.decision === ELIGIBILITY_DECISION.MANUAL_REVIEW
  ) {
    const hold = getComplianceHoldPolicy({
      environment: eligibility.environment,
      blockers: eligibility.blockerCodes,
      purpose: EVALUATION_PURPOSE.FINALIZATION,
    });
    if (blockFinalizationOnEligibilityFailure && hold.policy === 'BLOCK_FINALIZATION') {
      throw SalesEligibilityErrors.eligibilityBlocked({
        message: eligibility.safeDecisionSummary,
        details: {
          blockerCodes: eligibility.blockerCodes,
          stage: 'FINALIZATION',
          sourceType,
          sourceId,
        },
      });
    }
  }

  const decisionRow = await persistEligibilityDecision(eligibility, { db });

  const bridgeStatus =
    eligibility.decision === ELIGIBILITY_DECISION.ELIGIBLE ||
    eligibility.decision === ELIGIBILITY_DECISION.ELIGIBLE_WITH_WARNINGS
      ? BRIDGE_STATUS.ELIGIBLE
      : eligibility.decision === ELIGIBILITY_DECISION.COMPLIANCE_HOLD
        ? BRIDGE_STATUS.COMPLIANCE_HOLD
        : eligibility.decision === ELIGIBILITY_DECISION.MANUAL_REVIEW
          ? BRIDGE_STATUS.MANUAL_REVIEW
          : BRIDGE_STATUS.BLOCKED;

  const { bridge, created, duplicatePrevented } = await createOrGetSalesBridge({
    tenantId,
    businessId,
    branchId,
    terminalId: eligibility.terminalId,
    sourceType,
    sourceId,
    sourceVersion,
    sourceFinalizationIdentity: identity.sourceFinalizationIdentity,
    sourceTransactionNumber,
    sourceFinalizedAt: finalizedAt,
    businessDate: finalizedAt,
    environment: eligibility.environment,
    eligibilityDecisionId: decisionRow.id,
    eligibilityPolicyVersion: eligibility.policyVersion,
    sourceChecksum: eligibility.sourceChecksum,
    configurationSetChecksum: eligibility.configurationSetChecksum,
    lineCount: eligibility.lineCount,
    currency: eligibility.currency,
    grossAmount: eligibility.grossAmount,
    taxAmount: eligibility.taxAmount,
    levyAmount: eligibility.levyAmount,
    discountAmount: eligibility.discountAmount,
    paymentTotal: eligibility.paymentTotal,
    buyerClassification: eligibility.buyerClassification,
    siteMappingId: eligibility.siteMappingId,
    warehouseMappingId: eligibility.warehouseMappingId,
    status: bridgeStatus,
    db,
  });

  let outbox = null;
  if (
    created &&
    (bridgeStatus === BRIDGE_STATUS.ELIGIBLE || bridgeStatus === BRIDGE_STATUS.ELIGIBLE_WITH_WARNINGS)
  ) {
    // ELIGIBLE_WITH_WARNINGS uses ELIGIBLE bridge status above
  }
  if (created && bridge.status === BRIDGE_STATUS.ELIGIBLE) {
    const pending = await transitionSalesBridge({
      bridgeId: bridge.id,
      tenantId,
      businessId,
      fromStatus: BRIDGE_STATUS.ELIGIBLE,
      toStatus: BRIDGE_STATUS.OUTBOX_PENDING,
      expectedVersion: bridge.version,
      db,
      actorId: actorContext?.userId,
    });
    outbox = await appendFiscalSnapshotRequestedOutbox({
      tenantId,
      businessId,
      bridge: pending,
      eligibilityDecisionId: decisionRow.id,
      correlationId,
      requestId,
      db,
    });
  }

  await recordEisControlAudit({
    tenantId,
    businessId,
    actorId: actorContext?.userId,
    actorType: actorContext?.userId ? 'USER' : 'SERVICE',
    action: created ? 'SALES_BRIDGE_CREATED' : 'SALES_BRIDGE_DUPLICATE_PREVENTED',
    resourceType: 'MraEisSalesBridge',
    resourceId: bridge.id,
    metadata: {
      sourceType,
      sourceId,
      decision: eligibility.decision,
      accountingPostingIdentity,
      inventoryPostingIdentity,
      outboxEventId: outbox?.id || null,
      createsJournal: false,
      createsStockMovement: false,
      callsMraApi: false,
    },
  }, db).catch(() => {});

  return {
    ok: true,
    applicable: true,
    created,
    duplicatePrevented,
    eligibility,
    decisionId: decisionRow.id,
    bridge: outbox
      ? await db.mraEisSalesBridge.findUnique({ where: { id: bridge.id } })
      : bridge,
    outbox,
    eisStatus: projectTransactionEisStatus({
      eligibilityDecision: eligibility,
      bridgeStatus: outbox ? BRIDGE_STATUS.OUTBOX_PENDING : bridge.status,
    }),
    message: eligibility.safeDecisionSummary,
    identity,
  };
}

/**
 * Outbox consumer (Phase 11): mark bridge READY_FOR_FISCAL_SNAPSHOT only.
 * Phase 12 creates the immutable snapshot.
 */
export async function consumeFiscalSnapshotRequestedOutboxEvent({
  outboxEvent,
  db = prisma,
}) {
  if (outboxEvent.eventType !== FISCAL_SNAPSHOT_REQUESTED_EVENT &&
      outboxEvent.eventType !== 'MRA_EIS_SNAPSHOT_REQUESTED') {
    return { handled: false };
  }
  const { bridgeRecordId, tenantId, businessId } = outboxEvent.payload || {};
  if (!bridgeRecordId || !tenantId) {
    return { handled: false, error: 'INVALID_PAYLOAD' };
  }
  const bridge = await db.mraEisSalesBridge.findFirst({
    where: { id: bridgeRecordId, tenantId, businessId: businessId || tenantId },
  });
  if (!bridge) return { handled: false, error: 'BRIDGE_NOT_FOUND' };
  if (bridge.status === BRIDGE_STATUS.READY_FOR_FISCAL_SNAPSHOT) {
    return { handled: true, deduplicated: true, bridge };
  }
  if (bridge.status !== BRIDGE_STATUS.OUTBOX_PENDING && bridge.status !== BRIDGE_STATUS.ELIGIBLE) {
    return { handled: false, error: 'INVALID_BRIDGE_STATUS', status: bridge.status };
  }
  const from = bridge.status === BRIDGE_STATUS.ELIGIBLE ? BRIDGE_STATUS.ELIGIBLE : BRIDGE_STATUS.OUTBOX_PENDING;
  if (from === BRIDGE_STATUS.ELIGIBLE) {
    await transitionSalesBridge({
      bridgeId: bridge.id,
      tenantId,
      businessId: bridge.businessId,
      fromStatus: BRIDGE_STATUS.ELIGIBLE,
      toStatus: BRIDGE_STATUS.OUTBOX_PENDING,
      expectedVersion: bridge.version,
      db,
    });
    const refreshed = await db.mraEisSalesBridge.findUnique({ where: { id: bridge.id } });
    const ready = await transitionSalesBridge({
      bridgeId: refreshed.id,
      tenantId,
      businessId: refreshed.businessId,
      fromStatus: BRIDGE_STATUS.OUTBOX_PENDING,
      toStatus: BRIDGE_STATUS.READY_FOR_FISCAL_SNAPSHOT,
      expectedVersion: refreshed.version,
      db,
    });
    return { handled: true, bridge: ready };
  }
  const ready = await transitionSalesBridge({
    bridgeId: bridge.id,
    tenantId,
    businessId: bridge.businessId,
    fromStatus: BRIDGE_STATUS.OUTBOX_PENDING,
    toStatus: BRIDGE_STATUS.READY_FOR_FISCAL_SNAPSHOT,
    expectedVersion: bridge.version,
    db,
  });
  return { handled: true, bridge: ready };
}
