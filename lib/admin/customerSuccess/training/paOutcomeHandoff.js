/**
 * Training → Product Analytics outcome handoff — Phase 22 Wave 3.
 * Source-labelled trained-user context only.
 * No Product usage Events, first/repeat value, Leads, or marketing attribution.
 */

import { createHash } from 'crypto';
import {
  TRAINING_PA_OUTCOME_HANDOFF_TYPE,
  getTrainingDomainContract,
} from './catalogue.js';
import {
  canManageTraining,
  resolveTrainingActor,
} from './model.js';
import { loadTrainingProgramForActor } from './programAccess.js';

export function hasCustomerTrainingPaOutcomeHandoffModel(prisma) {
  return typeof prisma?.customerTrainingPaOutcomeHandoff?.create === 'function';
}

export function computeTrainingPaOutcomeHandoffChecksum(payload = {}) {
  const canonical = {
    type: payload.type || TRAINING_PA_OUTCOME_HANDOFF_TYPE,
    source: payload.source || 'PHASE_22_TRAINING',
    programId: payload.programId || null,
    customerId: payload.customerId || null,
    tenantId: payload.tenantId || null,
    trainedParticipants: payload.trainedParticipants || null,
    attendanceSummary: payload.attendanceSummary || null,
    watermark: payload.watermark || 'PHASE_22_TRAINING_TO_PA_CONTEXT',
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function serializePaHandoff(row) {
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
 * Emit PA trained-user context. Never fabricates Product Events / Leads / adoption.
 */
export async function emitTrainingPaOutcomeHandoff(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return { ok: false, forbidden: true, reason: 'training_pa_outcome_handoff_forbidden' };
  }
  if (!hasCustomerTrainingPaOutcomeHandoffModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_pa_outcome_handoff_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  if (args.createLeads === true || args.autoCreateLeads === true) {
    return {
      ok: false,
      error: 'training_participants_auto_leads_forbidden',
      note: 'Training Participants ≠ auto Leads',
    };
  }
  if (args.createProductEvents === true || args.fabricateFirstValue === true) {
    return {
      ok: false,
      error: 'pa_product_events_fabrication_forbidden',
    };
  }
  if (args.marketingAttribution === true || args.attributeAttendanceToMarketing === true) {
    return {
      ok: false,
      error: 'attendance_marketing_attribution_forbidden',
      note: 'Attendance ≠ Marketing attribution',
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

  const existing = await prisma.customerTrainingPaOutcomeHandoff.findUnique({
    where: { idempotencyKey },
  }).catch(async () =>
    prisma.customerTrainingPaOutcomeHandoff.findFirst({ where: { idempotencyKey } })
  );
  if (existing) {
    if (String(existing.programId) !== programId) {
      return { ok: false, error: 'idempotency_conflict', field: 'programId' };
    }
    return {
      ok: true,
      handoff: serializePaHandoff(existing),
      payload: existing.payloadJson || null,
      alreadyExists: true,
      idempotentReplay: true,
      meta: {
        createsProductEvents: false,
        createsFirstValue: false,
        createsLeads: false,
        marketingAttribution: false,
        trainedEqualsAdopted: false,
      },
      domain: getTrainingDomainContract(),
    };
  }

  const payload = {
    type: TRAINING_PA_OUTCOME_HANDOFF_TYPE,
    source: 'PHASE_22_TRAINING',
    sourceLabel: 'Phase 22 Customer Training (trained-user context)',
    programId,
    customerId: program.customerId || null,
    tenantId: program.tenantId || null,
    trainedParticipants: args.trainedParticipants || null,
    attendanceSummary: args.attendanceSummary || null,
    watermark: 'PHASE_22_TRAINING_TO_PA_CONTEXT',
    createsProductEvents: false,
    createsFirstValue: false,
    createsLeads: false,
    marketingAttribution: false,
    trainedEqualsAdopted: false,
  };

  const checksumSha256 = computeTrainingPaOutcomeHandoffChecksum(payload);
  const now = args.now || new Date();

  // Hard refuse Product Analytics / Lead side-effects.
  const row = await prisma.customerTrainingPaOutcomeHandoff.create({
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
    handoff: serializePaHandoff(row),
    payload,
    meta: {
      createsProductEvents: false,
      createsFirstValue: false,
      createsLeads: false,
      marketingAttribution: false,
      trainedEqualsAdopted: false,
    },
    domain: getTrainingDomainContract(),
  };
}
