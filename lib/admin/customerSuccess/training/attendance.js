/**
 * Training Attendance — Phase 18 Wave 2.
 * Allowlist sources only (spec §8); invitation/calendar/link rejected;
 * corrections preserve original; portfolio-scoped writes.
 */

import {
  TRAINING_ATTENDANCE_SOURCE,
  TRAINING_ATTENDANCE_STATUS,
  getTrainingDomainContract,
} from './catalogue.js';
import {
  canManageTraining,
  hasCustomerTrainingAttendanceModel,
  hasCustomerTrainingSessionModel,
  resolveTrainingActor,
  serializeTrainingAttendance,
} from './model.js';
import { loadTrainingProgramForActor } from './programAccess.js';

const STATUS_SET = new Set(Object.values(TRAINING_ATTENDANCE_STATUS));

/** Spec §8 allowlist — unknown sources invent attendance and are rejected. */
const ALLOWED_CAPTURE_SOURCES = new Set([
  TRAINING_ATTENDANCE_SOURCE.TRAINER_CONFIRMED,
  TRAINING_ATTENDANCE_SOURCE.PARTICIPANT_CHECK_IN,
  TRAINING_ATTENDANCE_SOURCE.SIGNED_DOCUMENT,
  TRAINING_ATTENDANCE_SOURCE.AUTHORISED_CORRECTION,
  TRAINING_ATTENDANCE_SOURCE.PROVIDER_RECORD,
]);

async function resolveSessionProgramAccess(prisma, args, sessionId) {
  if (!hasCustomerTrainingSessionModel(prisma)) {
    return { ok: false, error: 'customer_training_session_model_unavailable', status: 'UNAVAILABLE' };
  }
  const session = await prisma.customerTrainingSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) return { ok: false, error: 'session_not_found', notFound: true };

  const programId = session.programId ? String(session.programId).trim() : '';
  if (!programId) return { ok: false, error: 'session_program_missing' };

  const access = await loadTrainingProgramForActor(prisma, {
    ...args,
    programId,
  });
  if (!access.ok) return access;
  return { ok: true, session, programId, access };
}

/**
 * Capture attendance with an allowlisted evidence source.
 */
export async function captureTrainingAttendance(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return { ok: false, forbidden: true, reason: 'training_attendance_capture_forbidden' };
  }
  if (!hasCustomerTrainingAttendanceModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_attendance_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const sessionId = args.sessionId ? String(args.sessionId).trim() : '';
  const participantId = args.participantId ? String(args.participantId).trim() : '';
  const source = String(args.source || '')
    .trim()
    .toUpperCase();
  const status = String(args.status || '')
    .trim()
    .toUpperCase();
  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : '';

  const evidenceRef = args.evidenceRef ? String(args.evidenceRef).trim() : '';

  if (!sessionId) return { ok: false, error: 'sessionId_required' };
  if (!participantId) return { ok: false, error: 'participantId_required' };
  if (!source) return { ok: false, error: 'source_required' };
  if (!status || !STATUS_SET.has(status)) {
    return { ok: false, error: 'invalid_attendance_status' };
  }
  if (!idempotencyKey) return { ok: false, error: 'idempotencyKey_required' };

  // Forbidden / unknown sources fail before evidence — invitation/calendar/link ≠ attendance.
  if (!ALLOWED_CAPTURE_SOURCES.has(source)) {
    return {
      ok: false,
      error: 'ATTENDANCE_TRUTH_RISK_unknown_source',
      source,
      note: 'Attendance sources are allowlisted (spec §8); unknown / invitation / calendar / link rejected',
    };
  }

  if (source === TRAINING_ATTENDANCE_SOURCE.PROVIDER_RECORD) {
    return {
      ok: false,
      error: 'provider_record_not_configured',
      status: 'UNAVAILABLE',
    };
  }

  if (!evidenceRef) {
    return {
      ok: false,
      error: 'attendance_evidence_required',
      note: 'Invitation/calendar/link/login alone are not attendance evidence',
    };
  }

  const scoped = await resolveSessionProgramAccess(prisma, args, sessionId);
  if (!scoped.ok) return scoped;

  const existing = await prisma.customerTrainingAttendance.findFirst({
    where: { idempotencyKey },
  });
  if (existing) {
    return {
      ok: true,
      attendance: serializeTrainingAttendance(existing),
      alreadyExists: true,
      idempotentReplay: true,
      domain: getTrainingDomainContract(),
    };
  }

  const now = args.now || new Date();
  const attendance = await prisma.customerTrainingAttendance.create({
    data: {
      sessionId,
      participantId,
      status,
      source,
      evidenceRef,
      originalStatus: status,
      idempotencyKey,
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    attendance: serializeTrainingAttendance(attendance),
    created: true,
    domain: getTrainingDomainContract(),
  };
}

/**
 * Correct attendance; preserves original row (supersede / link).
 */
export async function correctTrainingAttendance(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return { ok: false, forbidden: true, reason: 'training_attendance_correct_forbidden' };
  }
  if (!hasCustomerTrainingAttendanceModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_attendance_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const attendanceId = args.attendanceId ? String(args.attendanceId).trim() : '';
  const status = String(args.status || '')
    .trim()
    .toUpperCase();
  const reason = args.reason ? String(args.reason).trim() : '';
  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : '';

  if (!attendanceId) return { ok: false, error: 'attendanceId_required' };
  if (!status || !STATUS_SET.has(status)) {
    return { ok: false, error: 'invalid_attendance_status' };
  }
  if (!reason) return { ok: false, error: 'correction_reason_required' };
  if (!idempotencyKey) return { ok: false, error: 'idempotencyKey_required' };

  const existingByKey = await prisma.customerTrainingAttendance.findFirst({
    where: { idempotencyKey },
  });
  if (existingByKey) {
    const scopedReplay = await resolveSessionProgramAccess(
      prisma,
      args,
      existingByKey.sessionId
    );
    if (!scopedReplay.ok) return scopedReplay;
    return {
      ok: true,
      attendance: serializeTrainingAttendance(existingByKey),
      original: serializeTrainingAttendance(
        await prisma.customerTrainingAttendance.findUnique({
          where: { id: existingByKey.correctsAttendanceId || attendanceId },
        })
      ),
      originalAttendanceId: existingByKey.correctsAttendanceId || attendanceId,
      alreadyExists: true,
      idempotentReplay: true,
      domain: getTrainingDomainContract(),
    };
  }

  const original = await prisma.customerTrainingAttendance.findUnique({
    where: { id: attendanceId },
  });
  if (!original) return { ok: false, error: 'attendance_not_found', notFound: true };

  const scoped = await resolveSessionProgramAccess(prisma, args, original.sessionId);
  if (!scoped.ok) return scoped;

  const now = args.now || new Date();
  const correction = await prisma.customerTrainingAttendance.create({
    data: {
      sessionId: original.sessionId,
      participantId: original.participantId,
      status,
      source: TRAINING_ATTENDANCE_SOURCE.AUTHORISED_CORRECTION,
      originalStatus: original.status,
      correctsAttendanceId: original.id,
      correctionReason: reason,
      idempotencyKey,
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  await prisma.customerTrainingAttendance.update({
    where: { id: original.id },
    data: {
      supersededById: correction.id,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    attendance: serializeTrainingAttendance(correction),
    original: serializeTrainingAttendance({
      ...original,
      supersededById: correction.id,
    }),
    originalAttendanceId: original.id,
    originalStatus: original.status,
    created: true,
    domain: getTrainingDomainContract(),
  };
}
