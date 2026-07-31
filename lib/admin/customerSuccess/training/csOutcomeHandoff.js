/**
 * Training → Customer Success outcome handoff — Phase 22 Wave 3.
 * Checksum + idempotent. Does NOT overwrite Customer Health / auto Healthy.
 */

import { createHash } from 'crypto';
import {
  TRAINING_CS_OUTCOME_HANDOFF_TYPE,
  getTrainingDomainContract,
} from './catalogue.js';
import {
  canManageTraining,
  resolveTrainingActor,
} from './model.js';
import { loadTrainingProgramForActor } from './programAccess.js';

export function hasCustomerTrainingCsOutcomeHandoffModel(prisma) {
  return typeof prisma?.customerTrainingCsOutcomeHandoff?.create === 'function';
}

export function computeTrainingCsOutcomeHandoffChecksum(payload = {}) {
  const canonical = {
    type: payload.type || TRAINING_CS_OUTCOME_HANDOFF_TYPE,
    programId: payload.programId || null,
    customerId: payload.customerId || null,
    tenantId: payload.tenantId || null,
    coverage: payload.coverage || null,
    gaps: payload.gaps || null,
    retakes: payload.retakes || null,
    refreshers: payload.refreshers || null,
    barriers: payload.barriers || null,
    watermark: payload.watermark || 'PHASE_22_TRAINING_TO_CS_OUTCOME',
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function serializeCsHandoff(row) {
  if (!row) return null;
  return {
    id: row.id,
    programId: row.programId || null,
    status: row.status || null,
    checksumSha256: row.checksumSha256 || null,
    idempotencyKey: row.idempotencyKey || null,
    payloadJson: row.payloadJson ?? null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

/**
 * Emit CS outcome package. Never writes Customer Health.
 */
export async function emitTrainingCsOutcomeHandoff(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return { ok: false, forbidden: true, reason: 'training_cs_outcome_handoff_forbidden' };
  }
  if (!hasCustomerTrainingCsOutcomeHandoffModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_cs_outcome_handoff_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const programId = args.programId ? String(args.programId).trim() : '';
  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : '';
  if (!programId) return { ok: false, error: 'programId_required' };
  if (!idempotencyKey) return { ok: false, error: 'idempotencyKey_required' };

  const access = await loadTrainingProgramForActor(prisma, { ...args, programId });
  if (!access.ok) return access;
  const program = access.programRow || access.program;

  const existing = await prisma.customerTrainingCsOutcomeHandoff.findUnique({
    where: { idempotencyKey },
  }).catch(async () =>
    prisma.customerTrainingCsOutcomeHandoff.findFirst({ where: { idempotencyKey } })
  );
  if (existing) {
    if (String(existing.programId) !== programId) {
      return { ok: false, error: 'idempotency_conflict', field: 'programId' };
    }
    return {
      ok: true,
      handoff: serializeCsHandoff(existing),
      payload: existing.payloadJson || null,
      alreadyExists: true,
      idempotentReplay: true,
      meta: {
        overwritesCustomerHealth: false,
        customerHealthWritten: false,
        setsCustomerHealthHealthy: false,
      },
      domain: getTrainingDomainContract(),
    };
  }

  const payload = {
    type: TRAINING_CS_OUTCOME_HANDOFF_TYPE,
    programId,
    customerId: program.customerId || null,
    tenantId: program.tenantId || null,
    coverage: args.coverage || null,
    gaps: args.gaps || null,
    retakes: args.retakes || null,
    refreshers: args.refreshers || null,
    barriers: args.barriers || null,
    watermark: 'PHASE_22_TRAINING_TO_CS_OUTCOME',
    overwritesCustomerHealth: false,
    setsCustomerHealthHealthy: false,
  };

  const checksumSha256 = computeTrainingCsOutcomeHandoffChecksum(payload);
  const now = args.now || new Date();

  // Hard refuse Customer Health side-effects — never call customerHealth.update/create.
  const row = await prisma.customerTrainingCsOutcomeHandoff.create({
    data: {
      programId,
      status: 'READY',
      payloadJson: payload,
      checksumSha256,
      idempotencyKey,
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    created: true,
    handoff: serializeCsHandoff(row),
    payload,
    meta: {
      overwritesCustomerHealth: false,
      customerHealthWritten: false,
      setsCustomerHealthHealthy: false,
    },
    domain: getTrainingDomainContract(),
  };
}
