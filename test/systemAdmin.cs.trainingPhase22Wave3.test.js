/**
 * Phase 22 Wave 3 — Sessions / attendance / assessments / completion /
 * certificates / CS+PA outcome handoffs (Spec §§9–10; G22-14…19,22,23).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TRAINING_ATTENDANCE_SOURCE,
  TRAINING_ATTENDANCE_FORBIDDEN_SOURCES,
  TRAINING_ATTENDANCE_STATUS,
  TRAINING_COMPLETION_STATUS,
  TRAINING_CERTIFICATE_VERIFICATION,
  TRAINING_DOMAIN_CONTRACT,
  VIRTUAL_PROVIDER_NOT_CONFIGURED,
  scheduleTrainingSession,
  recordTrainingSessionRsvp,
  requestVirtualTrainingProviderSession,
  markTrainingSessionDelivered,
  captureTrainingAttendance,
  correctTrainingAttendance,
  assertTrainingEnvironmentIsolation,
  submitTrainingExercise,
  createTrainingAssessment,
  updateTrainingAssessmentVersion,
  publishTrainingAssessmentVersion,
  startAssessmentAttempt,
  listAssessmentAttempts,
  evaluateParticipantCompletion,
  evaluateCertificateEligibility,
  issueTrainingCertificate,
  revokeTrainingCertificate,
  emitTrainingCsOutcomeHandoff,
  emitTrainingPaOutcomeHandoff,
  computeTrainingCsOutcomeHandoffChecksum,
  computeTrainingPaOutcomeHandoffChecksum,
  getTrainingDomainContract,
  calculateTrainingHealth,
} from '@/lib/admin/customerSuccess/training';

function superAdmin(id = 'super-p22-w3') {
  return {
    id,
    role: 'Super Admin',
    permissions: {
      'systemAdmin.customerSuccess.read': true,
      'systemAdmin.customerSuccess.manageCases': true,
    },
  };
}

function makeStoreCrud(store, idPrefix) {
  return {
    create: vi.fn(async ({ data }) => {
      const row = {
        id: data.id || `${idPrefix}-${store.length + 1}`,
        createdAt: data.createdAt || new Date(),
        updatedAt: data.updatedAt || new Date(),
        ...data,
      };
      store.push(row);
      return row;
    }),
    findUnique: vi.fn(async ({ where = {} } = {}) => {
      if (where.id) return store.find((r) => r.id === where.id) || null;
      if (where.idempotencyKey) {
        return store.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
      }
      if (where.certificateNumber) {
        return store.find((r) => r.certificateNumber === where.certificateNumber) || null;
      }
      if (where.verificationCode) {
        return store.find((r) => r.verificationCode === where.verificationCode) || null;
      }
      return null;
    }),
    findFirst: vi.fn(async ({ where = {} } = {}) => {
      let rows = [...store];
      for (const [k, v] of Object.entries(where || {})) {
        if (v == null) continue;
        if (typeof v === 'object' && v.in) {
          rows = rows.filter((r) => v.in.includes(r[k]));
        } else {
          rows = rows.filter((r) => r[k] === v);
        }
      }
      return rows[0] || null;
    }),
    findMany: vi.fn(async ({ where = {} } = {}) => {
      let rows = [...store];
      for (const [k, v] of Object.entries(where || {})) {
        if (v == null) continue;
        if (typeof v === 'object' && v.in) {
          rows = rows.filter((r) => v.in.includes(r[k]));
        } else {
          rows = rows.filter((r) => r[k] === v);
        }
      }
      return rows;
    }),
    update: vi.fn(async ({ where = {}, data = {} } = {}) => {
      const row = store.find((r) => r.id === where.id);
      if (!row) throw new Error(`${idPrefix}_not_found`);
      Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
      return row;
    }),
    count: vi.fn(async ({ where = {} } = {}) => {
      let rows = [...store];
      for (const [k, v] of Object.entries(where || {})) {
        if (v == null) continue;
        rows = rows.filter((r) => r[k] === v);
      }
      return rows.length;
    }),
  };
}

function makePrisma(overrides = {}) {
  const programStore = overrides._programStore || [
    {
      id: 'trn-prog-p22-w3',
      programNumber: 'TRN-2026-000301',
      status: 'IN_PROGRESS',
      trainingType: 'CUSTOMER_ONBOARDING',
      trainingRequestId: 'trq-p22-w3',
      customerId: 'cust-p22-w3',
      tenantId: 'tenant-p22-w3',
      subscriptionId: 'sub-p22-w3',
      onboardingProjectId: 'onb-p22-w3',
      curriculumVersionId: 'currv-onboarding-wave1-v1',
      createdByAdminId: 'super-p22-w3',
      createdAt: new Date('2026-07-31T10:00:00Z'),
      updatedAt: new Date('2026-07-31T10:00:00Z'),
    },
  ];
  const cohortStore = overrides._cohortStore || [
    {
      id: 'cohort-p22-w3',
      cohortNumber: 'COH-2026-000301',
      programId: 'trn-prog-p22-w3',
      status: 'OPEN',
      capacity: 20,
    },
  ];
  const participantStore = overrides._participantStore || [
    {
      id: 'part-p22-w3',
      programId: 'trn-prog-p22-w3',
      contactId: 'contact-p22-w3',
      verificationState: 'VERIFIED',
      customerId: 'cust-p22-w3',
      tenantId: 'tenant-p22-w3',
    },
  ];
  const enrolmentStore = overrides._enrolmentStore || [
    {
      id: 'enrol-p22-w3',
      programId: 'trn-prog-p22-w3',
      cohortId: 'cohort-p22-w3',
      participantId: 'part-p22-w3',
      status: 'ENROLLED',
    },
  ];
  const sessionStore = overrides._sessionStore || [];
  const attendanceStore = overrides._attendanceStore || [];
  const exerciseStore = overrides._exerciseStore || [];
  const assessmentStore = overrides._assessmentStore || [];
  const assessmentVersionStore = overrides._assessmentVersionStore || [];
  const attemptStore = overrides._attemptStore || [];
  const resultStore = overrides._resultStore || [];
  const completionStore = overrides._completionStore || [];
  const certificateStore = overrides._certificateStore || [];
  const policyStore = overrides._policyStore || [
    {
      id: 'policy-v1',
      policyVersion: 'training-completion-policy-v1',
      requiresAttendance: true,
      requiresExercises: true,
      requiresAssessments: true,
      status: 'ACTIVE',
    },
  ];
  const seqStore = overrides._seqStore || [];
  const csHandoffStore = overrides._csHandoffStore || [];
  const paHandoffStore = overrides._paHandoffStore || [];
  const customerHealthStore = overrides._customerHealthStore || [
    { id: 'ch-1', customerId: 'cust-p22-w3', status: 'WATCH', score: 42 },
  ];
  const productEventStore = overrides._productEventStore || [];
  const leadStore = overrides._leadStore || [];

  const prisma = {
    $transaction: vi.fn(async (fn) => fn(prisma)),
    _programStore: programStore,
    _cohortStore: cohortStore,
    _participantStore: participantStore,
    _enrolmentStore: enrolmentStore,
    _sessionStore: sessionStore,
    _attendanceStore: attendanceStore,
    _exerciseStore: exerciseStore,
    _assessmentStore: assessmentStore,
    _assessmentVersionStore: assessmentVersionStore,
    _attemptStore: attemptStore,
    _resultStore: resultStore,
    _completionStore: completionStore,
    _certificateStore: certificateStore,
    _policyStore: policyStore,
    _seqStore: seqStore,
    _csHandoffStore: csHandoffStore,
    _paHandoffStore: paHandoffStore,
    _customerHealthStore: customerHealthStore,
    _productEventStore: productEventStore,
    _leadStore: leadStore,
    customerTrainingProgram: {
      ...makeStoreCrud(programStore, 'prog'),
      findUnique: vi.fn(async ({ where = {} } = {}) =>
        programStore.find((r) => r.id === where.id) || null
      ),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...programStore];
        if (where.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);
        return rows;
      }),
    },
    customerTrainingCohort: makeStoreCrud(cohortStore, 'cohort'),
    customerTrainingParticipant: makeStoreCrud(participantStore, 'part'),
    customerTrainingEnrolment: makeStoreCrud(enrolmentStore, 'enrol'),
    customerTrainingSession: makeStoreCrud(sessionStore, 'sess'),
    customerTrainingAttendance: makeStoreCrud(attendanceStore, 'att'),
    customerTrainingExercise: makeStoreCrud(exerciseStore, 'ex'),
    customerTrainingAssessment: makeStoreCrud(assessmentStore, 'asm'),
    customerTrainingAssessmentVersion: makeStoreCrud(assessmentVersionStore, 'asv'),
    customerTrainingAssessmentAttempt: makeStoreCrud(attemptStore, 'attm'),
    customerTrainingAssessmentResult: makeStoreCrud(resultStore, 'res'),
    customerTrainingParticipantCompletion: makeStoreCrud(completionStore, 'comp'),
    customerTrainingCertificate: makeStoreCrud(certificateStore, 'cert'),
    customerTrainingCompletionPolicy: makeStoreCrud(policyStore, 'pol'),
    customerTrainingCsOutcomeHandoff: makeStoreCrud(csHandoffStore, 'csout'),
    customerTrainingPaOutcomeHandoff: makeStoreCrud(paHandoffStore, 'paout'),
    crmNumberSeq: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        const key = where.prefix_year || where;
        return (
          seqStore.find((r) => r.prefix === key.prefix && r.year === key.year) || null
        );
      }),
      create: vi.fn(async ({ data }) => {
        const row = { ...data, updatedAt: new Date() };
        seqStore.push(row);
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }) => {
        const row = seqStore.find(
          (r) =>
            r.prefix === where.prefix &&
            r.year === where.year &&
            r.lastIssued === where.lastIssued
        );
        if (!row) return { count: 0 };
        row.lastIssued = data.lastIssued;
        return { count: 1 };
      }),
    },
    customerHealth: {
      findFirst: vi.fn(async ({ where = {} } = {}) =>
        customerHealthStore.find((r) => r.customerId === where.customerId) || null
      ),
      update: vi.fn(async ({ where, data }) => {
        const row = customerHealthStore.find((r) => r.id === where.id || r.customerId === where.customerId);
        if (row) Object.assign(row, data);
        return row;
      }),
    },
    productAnalyticsEvent: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `pe-${productEventStore.length + 1}`, ...data };
        productEventStore.push(row);
        return row;
      }),
    },
    crmLead: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `lead-${leadStore.length + 1}`, ...data };
        leadStore.push(row);
        return row;
      }),
    },
    ...overrides,
  };
  return prisma;
}

describe('Phase 22 Wave 3 — delivery truth + outcome handoffs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('domain contract is wave 3', () => {
    const c = getTrainingDomainContract();
    expect(c.phase).toBe(22);
    expect(c.wave).toBeGreaterThanOrEqual(3);
    expect(c.treePhaseAlias).toBe(18);
    expect(TRAINING_DOMAIN_CONTRACT.wave).toBeGreaterThanOrEqual(3);
  });

  it('virtual provider missing → typed NOT_CONFIGURED; schedule ≠ delivered', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const meetingService = {
      createMeeting: vi.fn(async () => ({
        ok: true,
        meeting: { id: 'mtg-p22-w3-1' },
      })),
      recordMeetingRsvp: vi.fn(async () => ({ ok: true })),
    };

    const scheduled = await scheduleTrainingSession(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-w3',
      cohortId: 'cohort-p22-w3',
      idempotencyKey: 'sess:p22:w3:1',
      meetingService,
      meetingInput: {
        title: 'Wave3 session',
        timezone: 'Africa/Blantyre',
        startsAt: '2026-08-01T09:00:00Z',
        endsAt: '2026-08-01T11:00:00Z',
      },
    });
    expect(scheduled.ok).toBe(true);
    expect(scheduled.sessionDelivered).toBe(false);
    expect(scheduled.session.sessionDelivered).toBe(false);
    expect(scheduled.session.status).toBe('SCHEDULED');

    const invent = await markTrainingSessionDelivered(prisma, {
      actorContext: { admin },
      sessionId: scheduled.session.id,
      // no deliveryEvidence
    });
    expect(invent.ok).toBe(false);
    expect(invent.error).toMatch(/delivery.?evidence|required/i);
    expect(invent.sessionDelivered).not.toBe(true);

    const delivered = await markTrainingSessionDelivered(prisma, {
      actorContext: { admin },
      sessionId: scheduled.session.id,
      deliveryEvidence: {
        kind: 'TRAINER_CONFIRMED_DELIVERY',
        confirmedAt: '2026-08-01T11:05:00Z',
        trainerId: 'trainer-1',
      },
      idempotencyKey: 'sess:p22:w3:1:delivered',
    });
    expect(delivered.ok).toBe(true);
    expect(delivered.session.sessionDelivered).toBe(true);

    // Idempotent schedule replay must report honest delivery state (not hardcoded false).
    const replay = await scheduleTrainingSession(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-w3',
      cohortId: 'cohort-p22-w3',
      idempotencyKey: 'sess:p22:w3:1',
      meetingService,
      meetingInput: {
        title: 'Wave3 session',
        timezone: 'Africa/Blantyre',
        startsAt: '2026-08-01T09:00:00Z',
        endsAt: '2026-08-01T11:00:00Z',
      },
    });
    expect(replay.ok).toBe(true);
    expect(replay.alreadyExists || replay.idempotentReplay).toBe(true);
    expect(replay.sessionDelivered).toBe(true);
    expect(replay.session.sessionDelivered).toBe(true);

    const virt = await requestVirtualTrainingProviderSession(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-w3',
      sessionId: scheduled.session.id,
    });
    expect(virt.ok).toBe(false);
    expect(virt.error).toBe(VIRTUAL_PROVIDER_NOT_CONFIGURED);
    expect(virt.sessionDelivered).toBe(false);

    const rsvp = await recordTrainingSessionRsvp(prisma, {
      actorContext: { admin },
      sessionId: scheduled.session.id,
      contactId: 'contact-p22-w3',
      rsvpStatus: 'ACCEPTED',
      meetingService,
    });
    expect(rsvp.ok).toBe(true);
    expect(rsvp.attendanceCaptured).toBe(false);
    expect(rsvp.note).toMatch(/NOT_ATTENDANCE/i);
  });

  it('invitation/calendar/link ≠ attendance; evidence required; corrections append-only', async () => {
    const prisma = makePrisma({
      _sessionStore: [
        {
          id: 'sess-att-1',
          programId: 'trn-prog-p22-w3',
          cohortId: 'cohort-p22-w3',
          status: 'SCHEDULED',
          sessionDelivered: false,
        },
      ],
    });
    const admin = superAdmin();

    for (const source of TRAINING_ATTENDANCE_FORBIDDEN_SOURCES) {
      const bad = await captureTrainingAttendance(prisma, {
        actorContext: { admin },
        sessionId: 'sess-att-1',
        participantId: 'part-p22-w3',
        status: TRAINING_ATTENDANCE_STATUS.PRESENT,
        source,
        evidenceRef: 'ev-should-not-matter',
        idempotencyKey: `att:forbid:${source}`,
      });
      expect(bad.ok).toBe(false);
      expect(bad.error).toMatch(/ATTENDANCE_TRUTH_RISK|unknown_source|forbidden/i);
    }

    const noEvidence = await captureTrainingAttendance(prisma, {
      actorContext: { admin },
      sessionId: 'sess-att-1',
      participantId: 'part-p22-w3',
      status: TRAINING_ATTENDANCE_STATUS.PRESENT,
      source: TRAINING_ATTENDANCE_SOURCE.TRAINER_CONFIRMED,
      idempotencyKey: 'att:no-ev',
    });
    expect(noEvidence.ok).toBe(false);
    expect(noEvidence.error).toMatch(/evidence/i);

    const captured = await captureTrainingAttendance(prisma, {
      actorContext: { admin },
      sessionId: 'sess-att-1',
      participantId: 'part-p22-w3',
      status: TRAINING_ATTENDANCE_STATUS.PRESENT,
      source: TRAINING_ATTENDANCE_SOURCE.TRAINER_CONFIRMED,
      evidenceRef: 'trainer-roll:2026-08-01',
      idempotencyKey: 'att:ok-1',
    });
    expect(captured.ok).toBe(true);
    expect(captured.attendance.evidenceRef).toBe('trainer-roll:2026-08-01');
    const originalId = captured.attendance.id;

    const corrected = await correctTrainingAttendance(prisma, {
      actorContext: { admin },
      attendanceId: originalId,
      status: TRAINING_ATTENDANCE_STATUS.PRESENT_LATE,
      reason: 'Arrived 10 minutes late',
      idempotencyKey: 'att:corr-1',
    });
    expect(corrected.ok).toBe(true);
    expect(corrected.originalAttendanceId).toBe(originalId);
    expect(corrected.attendance.correctsAttendanceId).toBe(originalId);
    expect(prisma._attendanceStore.length).toBe(2);
    const original = prisma._attendanceStore.find((r) => r.id === originalId);
    expect(original.supersededById).toBe(corrected.attendance.id);
    expect(original.status).toBe(TRAINING_ATTENDANCE_STATUS.PRESENT);
  });

  it('exercises refuse Production GL / journals / stock / MRA fiscal', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();

    for (const kind of ['PRODUCTION_GL', 'PRODUCTION_JOURNALS', 'PRODUCTION_STOCK', 'MRA_FISCAL']) {
      const iso = await assertTrainingEnvironmentIsolation(prisma, {
        actorContext: { admin },
        environmentKind: 'SANDBOX',
        fiscalPlane: kind,
      });
      expect(iso.ok).toBe(false);
      expect(iso.error).toMatch(/production|fiscal|forbidden|gl|journal|stock|mra/i);
    }

    const blocked = await submitTrainingExercise(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-w3',
      participantId: 'part-p22-w3',
      title: 'Post to live GL',
      evidenceRef: 'sandbox://x',
      fiscalPlane: 'PRODUCTION_GL',
      idempotencyKey: 'ex:gl-bad',
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toMatch(/production|fiscal|forbidden|gl/i);

    const ok = await submitTrainingExercise(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-w3',
      participantId: 'part-p22-w3',
      title: 'Sandbox journal drill',
      evidenceRef: 'sandbox://ex-1',
      environmentKind: 'SANDBOX',
      fiscalPlane: 'SANDBOX_LABELLED',
      idempotencyKey: 'ex:ok-1',
    });
    expect(ok.ok).toBe(true);

    // Omitting fiscalPlane must still assert isolation (default labelled sandbox — not a Production bypass).
    const omitted = await submitTrainingExercise(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-w3',
      participantId: 'part-p22-w3',
      title: 'Default sandbox drill',
      evidenceRef: 'sandbox://ex-default',
      idempotencyKey: 'ex:default-plane',
    });
    expect(omitted.ok).toBe(true);

    const stillBlocked = await submitTrainingExercise(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-w3',
      participantId: 'part-p22-w3',
      title: 'Live stock post',
      evidenceRef: 'sandbox://x2',
      fiscalPlane: 'PRODUCTION_STOCK',
      idempotencyKey: 'ex:stock-bad',
    });
    expect(stillBlocked.ok).toBe(false);
    expect(stillBlocked.error).toMatch(/production|fiscal|forbidden|stock/i);
  });

  it('superseded PRESENT attendance does not satisfy completion or certificate eligibility', async () => {
    const prisma = makePrisma({
      _sessionStore: [
        {
          id: 'sess-super-1',
          programId: 'trn-prog-p22-w3',
          status: 'DELIVERED',
          sessionDelivered: true,
        },
      ],
      _policyStore: [
        {
          id: 'policy-att-only-super',
          policyVersion: 'training-completion-policy-attendance-only-v1',
          requiresAttendance: true,
          requiresExercises: false,
          requiresAssessments: false,
          status: 'ACTIVE',
        },
      ],
    });
    const admin = superAdmin();

    const captured = await captureTrainingAttendance(prisma, {
      actorContext: { admin },
      sessionId: 'sess-super-1',
      participantId: 'part-p22-w3',
      status: TRAINING_ATTENDANCE_STATUS.PRESENT,
      source: TRAINING_ATTENDANCE_SOURCE.TRAINER_CONFIRMED,
      evidenceRef: 'roll-super-1',
      idempotencyKey: 'att:super:1',
    });
    expect(captured.ok).toBe(true);

    const corrected = await correctTrainingAttendance(prisma, {
      actorContext: { admin },
      attendanceId: captured.attendance.id,
      status: TRAINING_ATTENDANCE_STATUS.NO_SHOW,
      reason: 'Marked present in error',
      idempotencyKey: 'att:super:corr',
    });
    expect(corrected.ok).toBe(true);
    expect(corrected.attendance.status).toBe(TRAINING_ATTENDANCE_STATUS.NO_SHOW);

    const blocked = await evaluateParticipantCompletion(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-w3',
      participantId: 'part-p22-w3',
      policyVersion: 'training-completion-policy-attendance-only-v1',
      idempotencyKey: 'comp:super:1',
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.status).not.toBe(TRAINING_COMPLETION_STATUS.COMPLETED);
    expect(blocked.gaps || []).toContain('ATTENDANCE_REQUIRED');
    expect(evaluateCertificateEligibility(blocked.completion)).toBe('UNKNOWN');

    // Current tip PRESENT_LATE still counts; superseded original does not invent a second present.
    const late = await correctTrainingAttendance(prisma, {
      actorContext: { admin },
      attendanceId: corrected.attendance.id,
      status: TRAINING_ATTENDANCE_STATUS.PRESENT_LATE,
      reason: 'Actually arrived late',
      idempotencyKey: 'att:super:corr2',
    });
    expect(late.ok).toBe(true);
    const ok = await evaluateParticipantCompletion(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-w3',
      participantId: 'part-p22-w3',
      policyVersion: 'training-completion-policy-attendance-only-v1',
      idempotencyKey: 'comp:super:2',
    });
    expect(ok.ok).toBe(true);
    expect(ok.completion.status).toBe(TRAINING_COMPLETION_STATUS.COMPLETED);
  });

  it('published assessment versions immutable; attempt limits server-side; answer keys protected', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();

    const created = await createTrainingAssessment(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-w3',
      title: 'Wave3 knowledge check',
      maxAttempts: 1,
      durationMinutes: 15,
      draft: true,
      questionsJson: {
        questions: [{ id: 'q1', prompt: 'What is TRN?' }],
        answerKey: { q1: 'Training Program' },
      },
      idempotencyKey: 'asm:p22:w3:1',
    });
    expect(created.ok).toBe(true);
    expect(created.version.immutable).toBe(false);
    expect(created.version.status).toMatch(/DRAFT/i);

    const published = await publishTrainingAssessmentVersion(prisma, {
      actorContext: { admin },
      assessmentVersionId: created.version.id,
      idempotencyKey: 'asm:p22:w3:1:pub',
    });
    expect(published.ok).toBe(true);
    expect(published.version.immutable).toBe(true);
    expect(published.version.status).toMatch(/PUBLISHED|ACTIVE/i);
    // answer key never in version serializer
    expect(published.version.answerKey).toBeUndefined();
    expect(published.version.questionsJson).toBeUndefined();

    const mutate = await updateTrainingAssessmentVersion(prisma, {
      actorContext: { admin },
      assessmentVersionId: created.version.id,
      maxAttempts: 99,
    });
    expect(mutate.ok).toBe(false);
    expect(mutate.error).toMatch(/immutable|published/i);

    const a1 = await startAssessmentAttempt(prisma, {
      actorContext: { admin },
      assessmentVersionId: created.version.id,
      participantId: 'part-p22-w3',
      programId: 'trn-prog-p22-w3',
      idempotencyKey: 'attm:1',
    });
    expect(a1.ok).toBe(true);

    const a2 = await startAssessmentAttempt(prisma, {
      actorContext: { admin },
      assessmentVersionId: created.version.id,
      participantId: 'part-p22-w3',
      programId: 'trn-prog-p22-w3',
      idempotencyKey: 'attm:2',
    });
    expect(a2.ok).toBe(false);
    expect(a2.error).toMatch(/attempt_limit/i);

    await prisma.customerTrainingAssessmentAttempt.update({
      where: { id: a1.attempt.id },
      data: { answersJson: { q1: 'Training Program' } },
    });
    const listed = await listAssessmentAttempts(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-w3',
      assessmentVersionId: created.version.id,
    });
    expect(listed.ok).toBe(true);
    expect(listed.attempts[0].answersJson).toBeUndefined();
  });

  it('completion policy versioned; attendance alone ≠ COMPLETED; COMPLETED_WITH_GAPS explicit', async () => {
    const prisma = makePrisma({
      _sessionStore: [
        {
          id: 'sess-comp-1',
          programId: 'trn-prog-p22-w3',
          status: 'DELIVERED',
          sessionDelivered: true,
        },
      ],
      _attendanceStore: [
        {
          id: 'att-comp-1',
          sessionId: 'sess-comp-1',
          participantId: 'part-p22-w3',
          status: TRAINING_ATTENDANCE_STATUS.PRESENT,
          source: TRAINING_ATTENDANCE_SOURCE.TRAINER_CONFIRMED,
          evidenceRef: 'roll-1',
        },
      ],
    });
    const admin = superAdmin();

    const attendanceAlone = await evaluateParticipantCompletion(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-w3',
      participantId: 'part-p22-w3',
      policyVersion: 'training-completion-policy-v1',
      idempotencyKey: 'comp:att-alone',
    });
    expect(attendanceAlone.ok).toBe(false);
    expect(attendanceAlone.status).not.toBe(TRAINING_COMPLETION_STATUS.COMPLETED);
    expect(attendanceAlone.gaps).toEqual(
      expect.arrayContaining(['EXERCISES_REQUIRED', 'ASSESSMENTS_REQUIRED'])
    );

    const withGaps = await evaluateParticipantCompletion(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-w3',
      participantId: 'part-p22-w3',
      policyVersion: 'training-completion-policy-v1',
      allowCompletedWithGaps: true,
      idempotencyKey: 'comp:with-gaps',
    });
    expect(withGaps.ok).toBe(true);
    expect(withGaps.completion.status).toBe(TRAINING_COMPLETION_STATUS.COMPLETED_WITH_GAPS);
    expect(withGaps.completion.status).not.toBe(TRAINING_COMPLETION_STATUS.COMPLETED);
    expect(withGaps.completion.gapsJson?.length || withGaps.gaps?.length).toBeGreaterThan(0);

    // Explicit attendance-only policy may COMPLETE
    prisma._policyStore.push({
      id: 'policy-att-only',
      policyVersion: 'training-completion-policy-attendance-only-v1',
      requiresAttendance: true,
      requiresExercises: false,
      requiresAssessments: false,
      status: 'ACTIVE',
    });
    const attOnly = await evaluateParticipantCompletion(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-w3',
      participantId: 'part-p22-w3',
      policyVersion: 'training-completion-policy-attendance-only-v1',
      idempotencyKey: 'comp:att-policy',
    });
    expect(attOnly.ok).toBe(true);
    expect(attOnly.completion.status).toBe(TRAINING_COMPLETION_STATUS.COMPLETED);
  });

  it('certificate eligibility UNKNOWN ≠ issue; checksum/idempotent; revoke preserves history', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();

    const unknownElig = evaluateCertificateEligibility({
      status: TRAINING_COMPLETION_STATUS.UNKNOWN,
    });
    expect(unknownElig).toBe('UNKNOWN');

    const refuseUnknown = await issueTrainingCertificate(prisma, {
      actorContext: { admin },
      participantCompletionId: 'missing',
      templateVersionId: 'tmpl-1',
      idempotencyKey: 'cert:unknown',
      eligibilityStatus: 'UNKNOWN',
    });
    expect(refuseUnknown.ok).toBe(false);
    expect(refuseUnknown.error).toMatch(/eligibility|UNKNOWN|completion/i);

    const completion = await prisma.customerTrainingParticipantCompletion.create({
      data: {
        programId: 'trn-prog-p22-w3',
        participantId: 'part-p22-w3',
        policyVersion: 'training-completion-policy-v1',
        status: TRAINING_COMPLETION_STATUS.COMPLETED,
        gapsJson: [],
        idempotencyKey: 'comp:cert-ready',
      },
    });
    expect(evaluateCertificateEligibility(completion)).toBe('ELIGIBLE');

    const issued = await issueTrainingCertificate(prisma, {
      actorContext: { admin },
      participantCompletionId: completion.id,
      templateVersionId: 'tmpl-1',
      idempotencyKey: 'cert:p22:1',
    });
    expect(issued.ok).toBe(true);
    expect(issued.certificate.checksum).toMatch(/^[a-f0-9]{64}$/i);
    const checksum = issued.certificate.checksum;
    const number = issued.certificate.certificateNumber;

    const replay = await issueTrainingCertificate(prisma, {
      actorContext: { admin },
      participantCompletionId: completion.id,
      templateVersionId: 'tmpl-1',
      idempotencyKey: 'cert:p22:1',
    });
    expect(replay.ok).toBe(true);
    expect(replay.alreadyExists || replay.idempotentReplay).toBe(true);
    expect(replay.certificate.checksum).toBe(checksum);
    expect(prisma._certificateStore.length).toBe(1);

    const revoked = await revokeTrainingCertificate(prisma, {
      actorContext: { admin },
      certificateId: issued.certificate.id,
      reason: 'Issued in error',
    });
    expect(revoked.ok).toBe(true);
    expect(revoked.certificate.verificationStatus).toBe(
      TRAINING_CERTIFICATE_VERIFICATION.REVOKED
    );
    expect(revoked.certificate.certificateNumber).toBe(number);
    expect(revoked.certificate.checksum).toBe(checksum);
    expect(revoked.certificate.issuedAt).toBeTruthy();
    expect(revoked.historyPreserved).toBe(true);
    expect(
      revoked.certificate.revokeHistoryJson?.length ||
        revoked.revokeHistory?.length
    ).toBeGreaterThan(0);
  });

  it('CS outcome handoff checksum/idempotent; does not overwrite Customer Health', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const before = { ...prisma._customerHealthStore[0] };

    const first = await emitTrainingCsOutcomeHandoff(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-w3',
      coverage: { enrolled: 1, completed: 0, withGaps: 1 },
      gaps: ['ASSESSMENTS_REQUIRED'],
      retakes: [],
      refreshers: [],
      barriers: ['SCHEDULING'],
      idempotencyKey: 'csout:p22:1',
    });
    expect(first.ok).toBe(true);
    expect(first.handoff.checksumSha256).toMatch(/^[a-f0-9]{64}$/i);
    expect(first.meta.overwritesCustomerHealth).toBe(false);
    expect(first.meta.customerHealthWritten).toBe(false);
    expect(first.payload.watermark).toMatch(/PHASE_22.*CS/i);

    const expected = computeTrainingCsOutcomeHandoffChecksum(first.payload);
    expect(first.handoff.checksumSha256).toBe(expected);

    const replay = await emitTrainingCsOutcomeHandoff(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-w3',
      coverage: { enrolled: 1, completed: 0, withGaps: 1 },
      gaps: ['ASSESSMENTS_REQUIRED'],
      retakes: [],
      refreshers: [],
      barriers: ['SCHEDULING'],
      idempotencyKey: 'csout:p22:1',
    });
    expect(replay.ok).toBe(true);
    expect(replay.alreadyExists || replay.idempotentReplay).toBe(true);
    expect(prisma._csHandoffStore.length).toBe(1);

    expect(prisma.customerHealth.update).not.toHaveBeenCalled();
    expect(prisma._customerHealthStore[0].status).toBe(before.status);
    expect(prisma._customerHealthStore[0].score).toBe(before.score);

    // Training Health may still compute independently — CS handoff must not force Healthy
    const th = await calculateTrainingHealth(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-w3',
    });
    expect(th.ok).toBe(true);
    expect(first.meta.setsCustomerHealthHealthy).not.toBe(true);
  });

  it('PA outcome handoff source-labelled; no Product Events / first-value / Leads / marketing attribution', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();

    const refuseLeads = await emitTrainingPaOutcomeHandoff(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-w3',
      trainedParticipants: [{ participantId: 'part-p22-w3', contactId: 'contact-p22-w3' }],
      createLeads: true,
      idempotencyKey: 'paout:leads-bad',
    });
    expect(refuseLeads.ok).toBe(false);
    expect(refuseLeads.error).toMatch(/lead|forbidden|auto/i);

    const first = await emitTrainingPaOutcomeHandoff(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-w3',
      trainedParticipants: [{ participantId: 'part-p22-w3', contactId: 'contact-p22-w3' }],
      attendanceSummary: { present: 1 },
      idempotencyKey: 'paout:p22:1',
    });
    expect(first.ok).toBe(true);
    expect(first.payload.source).toBe('PHASE_22_TRAINING');
    expect(first.payload.sourceLabel).toMatch(/training/i);
    expect(first.meta.createsProductEvents).toBe(false);
    expect(first.meta.createsFirstValue).toBe(false);
    expect(first.meta.createsLeads).toBe(false);
    expect(first.meta.marketingAttribution).toBe(false);
    expect(first.meta.trainedEqualsAdopted).toBe(false);
    expect(first.handoff.checksumSha256).toBe(
      computeTrainingPaOutcomeHandoffChecksum(first.payload)
    );

    expect(prisma.productAnalyticsEvent.create).not.toHaveBeenCalled();
    expect(prisma.crmLead.create).not.toHaveBeenCalled();
    expect(prisma._productEventStore.length).toBe(0);
    expect(prisma._leadStore.length).toBe(0);

    const replay = await emitTrainingPaOutcomeHandoff(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-w3',
      trainedParticipants: [{ participantId: 'part-p22-w3', contactId: 'contact-p22-w3' }],
      attendanceSummary: { present: 1 },
      idempotencyKey: 'paout:p22:1',
    });
    expect(replay.ok).toBe(true);
    expect(replay.alreadyExists || replay.idempotentReplay).toBe(true);
    expect(prisma._paHandoffStore.length).toBe(1);
  });
});
