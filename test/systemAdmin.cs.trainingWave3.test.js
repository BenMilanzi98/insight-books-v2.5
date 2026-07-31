/**
 * Phase 18 Wave 3 — Exercises, assessments, completion, certificates, Phase 17 feed.
 * Server timers + attempt limits; answers not in list payloads; final results immutable
 * without regrade; completion needs attendance/exercises/assessments; cert requires
 * completion + checksum; revoke → REVOKED; publish does NOT complete onboarding Project;
 * onboarding cannot fabricate Training COMPLETED; Cross-Tenant denied.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TRAINING_ATTENDANCE_SOURCE,
  TRAINING_PARTICIPANT_VERIFICATION,
  TRAINING_CERTIFICATE_VERIFICATION,
  createTrainingCohort,
  verifyTrainingParticipant,
  enrolTrainingParticipant,
  captureTrainingAttendance,
  submitTrainingExercise,
  reviewTrainingExercise,
  waiveTrainingExercise,
  createTrainingAssessment,
  startAssessmentAttempt,
  submitAssessmentAttempt,
  listAssessmentAttempts,
  gradeAssessmentAttempt,
  finaliseAssessmentResult,
  retakeAssessment,
  regradeAssessmentAttempt,
  evaluateParticipantCompletion,
  evaluateProgramCompletion,
  transitionTrainingProgramStatus,
  issueTrainingCertificate,
  revokeTrainingCertificate,
  verifyTrainingCertificate,
  publishTrainingOutcomeToOnboarding,
  loadTrainingProgramForActor,
  calculateTrainingHealth,
  calculateTrainingProgress,
  TRAINING_COMPLETION_STATUS,
} from '@/lib/admin/customerSuccess/training';
import {
  setTrainingCoordinationStatus,
  evaluateOnboardingReadiness,
} from '@/lib/admin/customerSuccess/onboarding';

function superAdmin(id = 'super-trn-w3-1') {
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
      id: 'trn-prog-1',
      programNumber: 'TRN-2026-000001',
      status: 'IN_PROGRESS',
      trainingType: 'CUSTOMER_ONBOARDING',
      trainingRequestId: 'trq-1',
      customerId: 'cust-1',
      tenantId: 'tenant-1',
      subscriptionId: 'sub-1',
      onboardingProjectId: 'onb-proj-1',
      curriculumVersionId: 'currv-onboarding-wave1-v1',
      createdByAdminId: 'super-trn-w3-1',
      createdAt: new Date('2026-07-31T10:00:00Z'),
      updatedAt: new Date('2026-07-31T10:00:00Z'),
    },
  ];
  const cohortStore = overrides._cohortStore || [];
  const participantStore = overrides._participantStore || [];
  const enrolmentStore = overrides._enrolmentStore || [];
  const sessionStore = overrides._sessionStore || [];
  const attendanceStore = overrides._attendanceStore || [];
  const exerciseStore = overrides._exerciseStore || [];
  const assessmentStore = overrides._assessmentStore || [];
  const assessmentVersionStore = overrides._assessmentVersionStore || [];
  const attemptStore = overrides._attemptStore || [];
  const resultStore = overrides._resultStore || [];
  const regradeStore = overrides._regradeStore || [];
  const completionStore = overrides._completionStore || [];
  const programCompletionStore = overrides._programCompletionStore || [];
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
  const onboardingProjectStore = overrides._onboardingProjectStore || [
    {
      id: 'onb-proj-1',
      projectNumber: 'ONB-2026-000001',
      status: 'IN_PROGRESS',
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      createdAt: new Date('2026-07-31T09:00:00Z'),
      updatedAt: new Date('2026-07-31T09:00:00Z'),
    },
  ];
  const onboardingTrainingStore = overrides._onboardingTrainingStore || [];
  const readinessStore = overrides._readinessStore || [];

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
    _regradeStore: regradeStore,
    _completionStore: completionStore,
    _programCompletionStore: programCompletionStore,
    _certificateStore: certificateStore,
    _policyStore: policyStore,
    _seqStore: seqStore,
    _onboardingProjectStore: onboardingProjectStore,
    _onboardingTrainingStore: onboardingTrainingStore,
    _readinessStore: readinessStore,
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
    customerTrainingProgram: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `trn-prog-${programStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        programStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return programStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...programStore];
        if (where.id) rows = rows.filter((r) => r.id === where.id);
        if (where.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);
        return rows[0] || null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...programStore];
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
        const row = programStore.find((r) => r.id === where.id);
        if (!row) throw new Error('program_not_found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    customerTrainingCohort: makeStoreCrud(cohortStore, 'coh'),
    customerTrainingParticipant: {
      ...makeStoreCrud(participantStore, 'part'),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...participantStore];
        if (where.programId) rows = rows.filter((r) => r.programId === where.programId);
        if (where.identityKey) rows = rows.filter((r) => r.identityKey === where.identityKey);
        if (where.contactId) rows = rows.filter((r) => r.contactId === where.contactId);
        if (where.id) rows = rows.filter((r) => r.id === where.id);
        return rows[0] || null;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return participantStore.find((r) => r.id === where.id) || null;
        return null;
      }),
    },
    customerTrainingEnrolment: makeStoreCrud(enrolmentStore, 'enr'),
    customerTrainingSession: makeStoreCrud(sessionStore, 'sess'),
    customerTrainingAttendance: makeStoreCrud(attendanceStore, 'att'),
    customerTrainingExercise: makeStoreCrud(exerciseStore, 'ex'),
    customerTrainingAssessment: makeStoreCrud(assessmentStore, 'asm'),
    customerTrainingAssessmentVersion: makeStoreCrud(assessmentVersionStore, 'asmv'),
    customerTrainingAssessmentAttempt: makeStoreCrud(attemptStore, 'attm'),
    customerTrainingAssessmentResult: makeStoreCrud(resultStore, 'res'),
    customerTrainingAssessmentRegrade: makeStoreCrud(regradeStore, 'regr'),
    customerTrainingParticipantCompletion: makeStoreCrud(completionStore, 'pcomp'),
    customerTrainingProgramCompletion: makeStoreCrud(programCompletionStore, 'gcomp'),
    customerTrainingCertificate: makeStoreCrud(certificateStore, 'cert'),
    customerTrainingCompletionPolicy: {
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...policyStore];
        if (where.policyVersion) {
          rows = rows.filter((r) => r.policyVersion === where.policyVersion);
        }
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        return rows[0] || null;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return policyStore.find((r) => r.id === where.id) || null;
        if (where.policyVersion) {
          return policyStore.find((r) => r.policyVersion === where.policyVersion) || null;
        }
        return null;
      }),
    },
    customerOnboardingProject: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `onb-${onboardingProjectStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        onboardingProjectStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) {
          return onboardingProjectStore.find((r) => r.id === where.id) || null;
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...onboardingProjectStore];
        if (where.id) rows = rows.filter((r) => r.id === where.id);
        return rows[0] || null;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = onboardingProjectStore.find((r) => r.id === where.id);
        if (!row) throw new Error('onboarding_project_not_found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    customerOnboardingTraining: makeStoreCrud(onboardingTrainingStore, 'otrn'),
    customerOnboardingReadinessEvaluation: makeStoreCrud(readinessStore, 'ready'),
  };

  // Cohort/participant create need findUnique by idempotency etc. — patch cohort
  prisma.customerTrainingCohort.findUnique = vi.fn(async ({ where = {} } = {}) => {
    if (where.id) return cohortStore.find((r) => r.id === where.id) || null;
    if (where.idempotencyKey) {
      return cohortStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
    }
    if (where.cohortNumber) {
      return cohortStore.find((r) => r.cohortNumber === where.cohortNumber) || null;
    }
    return null;
  });
  prisma.customerTrainingCohort.findFirst = vi.fn(async ({ where = {} } = {}) => {
    let rows = [...cohortStore];
    if (where.programId) rows = rows.filter((r) => r.programId === where.programId);
    if (where.idempotencyKey) {
      rows = rows.filter((r) => r.idempotencyKey === where.idempotencyKey);
    }
    return rows[0] || null;
  });

  prisma.customerTrainingEnrolment.findFirst = vi.fn(async ({ where = {} } = {}) => {
    let rows = [...enrolmentStore];
    if (where.programId) rows = rows.filter((r) => r.programId === where.programId);
    if (where.participantId) {
      rows = rows.filter((r) => r.participantId === where.participantId);
    }
    if (where.idempotencyKey) {
      rows = rows.filter((r) => r.idempotencyKey === where.idempotencyKey);
    }
    return rows[0] || null;
  });

  prisma.customerTrainingAttendance.findFirst = vi.fn(async ({ where = {} } = {}) => {
    let rows = [...attendanceStore];
    if (where.idempotencyKey) {
      rows = rows.filter((r) => r.idempotencyKey === where.idempotencyKey);
    }
    if (where.sessionId) rows = rows.filter((r) => r.sessionId === where.sessionId);
    if (where.participantId) {
      rows = rows.filter((r) => r.participantId === where.participantId);
    }
    return rows[0] || null;
  });

  prisma.customerTrainingAssessmentAttempt.findMany = vi.fn(
    async ({ where = {} } = {}) => {
      let rows = [...attemptStore];
      if (where.assessmentVersionId) {
        rows = rows.filter((r) => r.assessmentVersionId === where.assessmentVersionId);
      }
      if (where.participantId) {
        rows = rows.filter((r) => r.participantId === where.participantId);
      }
      if (where.assessmentId) {
        rows = rows.filter((r) => r.assessmentId === where.assessmentId);
      }
      return rows;
    }
  );

  prisma.customerTrainingCertificate.findUnique = vi.fn(async ({ where = {} } = {}) => {
    if (where.id) return certificateStore.find((r) => r.id === where.id) || null;
    if (where.idempotencyKey) {
      return certificateStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
    }
    if (where.certificateNumber) {
      return (
        certificateStore.find((r) => r.certificateNumber === where.certificateNumber) ||
        null
      );
    }
    if (where.verificationCode) {
      return (
        certificateStore.find((r) => r.verificationCode === where.verificationCode) || null
      );
    }
    return null;
  });

  return prisma;
}

async function seedParticipant(prisma, admin, opts = {}) {
  const cohort = await createTrainingCohort(prisma, {
    actorContext: { admin },
    programId: opts.programId || 'trn-prog-1',
    name: opts.cohortName || 'Wave 3 Cohort',
    language: 'en',
    deliveryMode: 'VIRTUAL',
    timezone: 'Africa/Johannesburg',
    capacity: 20,
    idempotencyKey: opts.cohortKey || 'coh:w3:1',
  });
  expect(cohort.ok).toBe(true);

  const verified = await verifyTrainingParticipant(prisma, {
    actorContext: { admin },
    programId: opts.programId || 'trn-prog-1',
    contactId: opts.contactId || 'contact-w3-1',
    identityType: 'CUSTOMER_CONTACT',
    verificationState: TRAINING_PARTICIPANT_VERIFICATION.VERIFIED,
    idempotencyKey: opts.participantKey || 'part:w3:1',
  });
  expect(verified.ok).toBe(true);

  const enrolled = await enrolTrainingParticipant(prisma, {
    actorContext: { admin },
    programId: opts.programId || 'trn-prog-1',
    cohortId: cohort.cohort.id,
    participantId: verified.participant.id,
    idempotencyKey: opts.enrolKey || 'enr:w3:1',
  });
  expect(enrolled.ok).toBe(true);

  return {
    cohort: cohort.cohort,
    participant: verified.participant,
    enrolment: enrolled.enrolment,
  };
}

async function seedAssessment(prisma, admin, opts = {}) {
  const created = await createTrainingAssessment(prisma, {
    actorContext: { admin },
    programId: opts.programId || 'trn-prog-1',
    title: opts.title || 'Knowledge check',
    assessmentType: opts.assessmentType || 'KNOWLEDGE_CHECK',
    maxAttempts: opts.maxAttempts ?? 2,
    durationMinutes: opts.durationMinutes ?? 30,
    passScore: opts.passScore ?? 70,
    questionsJson: opts.questionsJson || [
      { id: 'q1', prompt: '2+2?', type: 'OBJECTIVE', correctAnswer: '4', points: 100 },
    ],
    idempotencyKey: opts.idempotencyKey || 'asm:w3:1',
  });
  expect(created.ok).toBe(true);
  return created;
}

describe('Phase 18 Wave 3 — Exercises / assessments / completion / certificates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('attempt beyond limit fails', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { participant } = await seedParticipant(prisma, admin);
    const asm = await seedAssessment(prisma, admin, { maxAttempts: 1 });

    const first = await startAssessmentAttempt(prisma, {
      actorContext: { admin },
      assessmentVersionId: asm.version.id,
      participantId: participant.id,
      idempotencyKey: 'attm:limit:1',
      now: new Date('2026-08-01T10:00:00Z'),
    });
    expect(first.ok).toBe(true);

    await submitAssessmentAttempt(prisma, {
      actorContext: { admin },
      attemptId: first.attempt.id,
      answersJson: { q1: '4' },
      now: new Date('2026-08-01T10:05:00Z'),
    });

    const beyond = await startAssessmentAttempt(prisma, {
      actorContext: { admin },
      assessmentVersionId: asm.version.id,
      participantId: participant.id,
      idempotencyKey: 'attm:limit:2',
      now: new Date('2026-08-01T11:00:00Z'),
    });
    expect(beyond.ok).toBe(false);
    expect(beyond.error).toMatch(/attempt.?limit|max.?attempt|limit/i);
  });

  it('client-only timer is not authoritative (server window wins)', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { participant } = await seedParticipant(prisma, admin);
    const asm = await seedAssessment(prisma, admin, {
      durationMinutes: 10,
      idempotencyKey: 'asm:timer:1',
    });

    const started = await startAssessmentAttempt(prisma, {
      actorContext: { admin },
      assessmentVersionId: asm.version.id,
      participantId: participant.id,
      idempotencyKey: 'attm:timer:1',
      now: new Date('2026-08-01T10:00:00Z'),
    });
    expect(started.ok).toBe(true);
    expect(started.attempt.serverEndsAt).toBeTruthy();

    const late = await submitAssessmentAttempt(prisma, {
      actorContext: { admin },
      attemptId: started.attempt.id,
      answersJson: { q1: '4' },
      clientTimerExpired: false,
      now: new Date('2026-08-01T10:20:00Z'),
    });
    expect(late.ok).toBe(false);
    expect(late.error).toMatch(/expired|timer|window|time/i);

    const started2 = await startAssessmentAttempt(prisma, {
      actorContext: { admin },
      assessmentVersionId: asm.version.id,
      participantId: participant.id,
      idempotencyKey: 'attm:timer:2',
      now: new Date('2026-08-01T11:00:00Z'),
    });
    expect(started2.ok).toBe(true);

    const earlyClientClaim = await submitAssessmentAttempt(prisma, {
      actorContext: { admin },
      attemptId: started2.attempt.id,
      answersJson: { q1: '4' },
      clientTimerExpired: true,
      now: new Date('2026-08-01T11:02:00Z'),
    });
    expect(earlyClientClaim.ok).toBe(true);
    expect(earlyClientClaim.attempt.status).toMatch(/SUBMITTED|GRADED|FINALISED/i);
  });

  it('final result immutable without regrade; regrade preserves original', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { participant } = await seedParticipant(prisma, admin);
    const asm = await seedAssessment(prisma, admin, { idempotencyKey: 'asm:imm:1' });

    const started = await startAssessmentAttempt(prisma, {
      actorContext: { admin },
      assessmentVersionId: asm.version.id,
      participantId: participant.id,
      idempotencyKey: 'attm:imm:1',
      now: new Date('2026-08-01T10:00:00Z'),
    });
    await submitAssessmentAttempt(prisma, {
      actorContext: { admin },
      attemptId: started.attempt.id,
      answersJson: { q1: '4' },
      now: new Date('2026-08-01T10:05:00Z'),
    });
    const graded = await gradeAssessmentAttempt(prisma, {
      actorContext: { admin },
      attemptId: started.attempt.id,
      mode: 'OBJECTIVE',
    });
    expect(graded.ok).toBe(true);

    const finalised = await finaliseAssessmentResult(prisma, {
      actorContext: { admin },
      resultId: graded.result.id,
    });
    expect(finalised.ok).toBe(true);
    expect(finalised.result.immutable).toBe(true);

    const mutate = await gradeAssessmentAttempt(prisma, {
      actorContext: { admin },
      attemptId: started.attempt.id,
      mode: 'MANUAL',
      score: 50,
    });
    expect(mutate.ok).toBe(false);
    expect(mutate.error).toMatch(/immutable|regrade|final/i);

    const originalScore = finalised.result.score;
    const regraded = await regradeAssessmentAttempt(prisma, {
      actorContext: { admin },
      resultId: graded.result.id,
      score: 90,
      reason: 'Marking correction',
      idempotencyKey: 'regr:imm:1',
    });
    expect(regraded.ok).toBe(true);
    expect(regraded.regrade.originalScore ?? regraded.originalScore).toBe(originalScore);
    expect(regraded.result.score).toBe(90);
    expect(prisma._resultStore.find((r) => r.id === graded.result.id).originalScore).toBe(
      originalScore
    );
  });

  it('completion blocked without attendance', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { participant } = await seedParticipant(prisma, admin, {
      cohortKey: 'coh:comp:1',
      participantKey: 'part:comp:1',
      enrolKey: 'enr:comp:1',
    });

    const ex = await submitTrainingExercise(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-1',
      participantId: participant.id,
      title: 'Sandbox walkthrough',
      evidenceRef: 'evidence://ex-1',
      idempotencyKey: 'ex:comp:1',
    });
    expect(ex.ok).toBe(true);
    const reviewed = await reviewTrainingExercise(prisma, {
      actorContext: { admin },
      exerciseId: ex.exercise.id,
      decision: 'PASSED',
      idempotencyKey: 'ex:comp:rev:1',
    });
    expect(reviewed.ok).toBe(true);

    const asm = await seedAssessment(prisma, admin, { idempotencyKey: 'asm:comp:1' });
    const started = await startAssessmentAttempt(prisma, {
      actorContext: { admin },
      assessmentVersionId: asm.version.id,
      participantId: participant.id,
      idempotencyKey: 'attm:comp:1',
      now: new Date('2026-08-01T10:00:00Z'),
    });
    await submitAssessmentAttempt(prisma, {
      actorContext: { admin },
      attemptId: started.attempt.id,
      answersJson: { q1: '4' },
      now: new Date('2026-08-01T10:05:00Z'),
    });
    const graded = await gradeAssessmentAttempt(prisma, {
      actorContext: { admin },
      attemptId: started.attempt.id,
      mode: 'OBJECTIVE',
    });
    await finaliseAssessmentResult(prisma, {
      actorContext: { admin },
      resultId: graded.result.id,
    });

    const blocked = await evaluateParticipantCompletion(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-1',
      participantId: participant.id,
      policyVersion: 'training-completion-policy-v1',
      idempotencyKey: 'pcomp:no-att:1',
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.error || blocked.status).toMatch(
      /attendance|incomplete|not.?complete|blocked|policy/i
    );
    expect(blocked.completion?.status).not.toBe('COMPLETED');
  });

  it('cert without completion fails; retry same checksum; revoke → REVOKED', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { participant, cohort } = await seedParticipant(prisma, admin, {
      cohortKey: 'coh:cert:1',
      participantKey: 'part:cert:1',
      enrolKey: 'enr:cert:1',
    });

    const noComp = await issueTrainingCertificate(prisma, {
      actorContext: { admin },
      participantCompletionId: 'missing-completion',
      templateVersionId: 'tmpl-v1',
      idempotencyKey: 'cert:nocomp:1',
    });
    expect(noComp.ok).toBe(false);
    expect(noComp.error).toMatch(/completion|required|not.?found/i);

    // Satisfy policy: attendance + exercise + assessment
    const session = await prisma.customerTrainingSession.create({
      data: {
        sessionNumber: 'TRS-2026-000099',
        programId: 'trn-prog-1',
        cohortId: cohort.id,
        status: 'DELIVERED',
        sessionDelivered: true,
      },
    });
    await captureTrainingAttendance(prisma, {
      actorContext: { admin },
      sessionId: session.id,
      participantId: participant.id,
      status: 'PRESENT',
      source: TRAINING_ATTENDANCE_SOURCE.TRAINER_CONFIRMED,
      evidenceRef: 'evidence://wave3-att',
      idempotencyKey: 'att:cert:1',
    });

    const ex = await submitTrainingExercise(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-1',
      participantId: participant.id,
      title: 'Practical exercise',
      evidenceRef: 'evidence://cert-ex',
      idempotencyKey: 'ex:cert:1',
    });
    await reviewTrainingExercise(prisma, {
      actorContext: { admin },
      exerciseId: ex.exercise.id,
      decision: 'PASSED',
      idempotencyKey: 'ex:cert:rev:1',
    });

    const asm = await seedAssessment(prisma, admin, { idempotencyKey: 'asm:cert:1' });
    const started = await startAssessmentAttempt(prisma, {
      actorContext: { admin },
      assessmentVersionId: asm.version.id,
      participantId: participant.id,
      idempotencyKey: 'attm:cert:1',
      now: new Date('2026-08-01T10:00:00Z'),
    });
    await submitAssessmentAttempt(prisma, {
      actorContext: { admin },
      attemptId: started.attempt.id,
      answersJson: { q1: '4' },
      now: new Date('2026-08-01T10:05:00Z'),
    });
    const graded = await gradeAssessmentAttempt(prisma, {
      actorContext: { admin },
      attemptId: started.attempt.id,
      mode: 'OBJECTIVE',
    });
    await finaliseAssessmentResult(prisma, {
      actorContext: { admin },
      resultId: graded.result.id,
    });

    const completion = await evaluateParticipantCompletion(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-1',
      participantId: participant.id,
      policyVersion: 'training-completion-policy-v1',
      idempotencyKey: 'pcomp:cert:1',
    });
    expect(completion.ok).toBe(true);
    expect(completion.completion.status).toBe('COMPLETED');

    const issued = await issueTrainingCertificate(prisma, {
      actorContext: { admin },
      participantCompletionId: completion.completion.id,
      templateVersionId: 'tmpl-v1',
      certificateType: 'COMPLETION',
      idempotencyKey: 'cert:issue:1',
      now: new Date('2026-08-02T12:00:00Z'),
    });
    expect(issued.ok).toBe(true);
    expect(issued.certificate.certificateNumber).toMatch(/^IB-TRN-CERT-\d{4}-\d{6}$/);
    expect(issued.certificate.checksum).toBeTruthy();
    expect(issued.certificate.verificationCode).toBeTruthy();

    const retry = await issueTrainingCertificate(prisma, {
      actorContext: { admin },
      participantCompletionId: completion.completion.id,
      templateVersionId: 'tmpl-v1',
      certificateType: 'COMPLETION',
      idempotencyKey: 'cert:issue:1',
      now: new Date('2026-08-02T12:00:00Z'),
    });
    expect(retry.ok).toBe(true);
    expect(retry.certificate.id).toBe(issued.certificate.id);
    expect(retry.certificate.checksum).toBe(issued.certificate.checksum);
    expect(retry.idempotentReplay || retry.alreadyExists).toBe(true);

    const revoked = await revokeTrainingCertificate(prisma, {
      actorContext: { admin },
      certificateId: issued.certificate.id,
      reason: 'Issued in error',
      idempotencyKey: 'cert:rev:1',
    });
    expect(revoked.ok).toBe(true);

    const verified = await verifyTrainingCertificate(prisma, {
      verificationCode: issued.certificate.verificationCode,
    });
    expect(verified.ok).toBe(true);
    expect(verified.verificationStatus || verified.status).toBe(
      TRAINING_CERTIFICATE_VERIFICATION.REVOKED
    );
    expect(verified.verificationStatus || verified.status).toBe('REVOKED');
  });

  it('onboarding feed updates readiness dim; does not mark Project COMPLETED', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { participant, cohort } = await seedParticipant(prisma, admin, {
      cohortKey: 'coh:feed:1',
      participantKey: 'part:feed:1',
      enrolKey: 'enr:feed:1',
    });

    const session = await prisma.customerTrainingSession.create({
      data: {
        sessionNumber: 'TRS-2026-000098',
        programId: 'trn-prog-1',
        cohortId: cohort.id,
        status: 'DELIVERED',
        sessionDelivered: true,
      },
    });
    await captureTrainingAttendance(prisma, {
      actorContext: { admin },
      sessionId: session.id,
      participantId: participant.id,
      status: 'PRESENT',
      source: TRAINING_ATTENDANCE_SOURCE.TRAINER_CONFIRMED,
      evidenceRef: 'evidence://wave3-att',
      idempotencyKey: 'att:feed:1',
    });
    const ex = await submitTrainingExercise(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-1',
      participantId: participant.id,
      title: 'Feed exercise',
      evidenceRef: 'evidence://feed',
      idempotencyKey: 'ex:feed:1',
    });
    await reviewTrainingExercise(prisma, {
      actorContext: { admin },
      exerciseId: ex.exercise.id,
      decision: 'PASSED',
      idempotencyKey: 'ex:feed:rev:1',
    });
    const asm = await seedAssessment(prisma, admin, { idempotencyKey: 'asm:feed:1' });
    const started = await startAssessmentAttempt(prisma, {
      actorContext: { admin },
      assessmentVersionId: asm.version.id,
      participantId: participant.id,
      idempotencyKey: 'attm:feed:1',
      now: new Date('2026-08-01T10:00:00Z'),
    });
    await submitAssessmentAttempt(prisma, {
      actorContext: { admin },
      attemptId: started.attempt.id,
      answersJson: { q1: '4' },
      now: new Date('2026-08-01T10:05:00Z'),
    });
    const graded = await gradeAssessmentAttempt(prisma, {
      actorContext: { admin },
      attemptId: started.attempt.id,
      mode: 'OBJECTIVE',
    });
    await finaliseAssessmentResult(prisma, {
      actorContext: { admin },
      resultId: graded.result.id,
    });
    await evaluateParticipantCompletion(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-1',
      participantId: participant.id,
      policyVersion: 'training-completion-policy-v1',
      idempotencyKey: 'pcomp:feed:1',
    });

    const projectBefore = prisma._onboardingProjectStore.find((p) => p.id === 'onb-proj-1');
    expect(projectBefore.status).toBe('IN_PROGRESS');

    const published = await publishTrainingOutcomeToOnboarding(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-1',
      idempotencyKey: 'feed:1',
    });
    expect(published.ok).toBe(true);
    expect(published.training.trainingDomainSource).toMatch(/PHASE_18|TRAINING/i);
    expect(published.training.trainingDomainStatus).toBe('COMPLETED');
    expect(published.training.status).toBe('COMPLETED');
    expect(published.onboardingProjectCompleted).not.toBe(true);

    const projectAfter = prisma._onboardingProjectStore.find((p) => p.id === 'onb-proj-1');
    expect(projectAfter.status).toBe('IN_PROGRESS');
    expect(projectAfter.status).not.toBe('COMPLETED');

    const readiness = await evaluateOnboardingReadiness(prisma, {
      actorContext: { admin },
      projectId: 'onb-proj-1',
    });
    expect(readiness.ok).toBe(true);
    expect(readiness.dimensions.training).toBe('READY');
  });

  it('feed does not COMPLETE from partial cohort (one of many enrolled)', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { participant: p1 } = await seedParticipant(prisma, admin, {
      cohortKey: 'coh:partial:1',
      participantKey: 'part:partial:1',
      enrolKey: 'enr:partial:1',
      contactId: 'contact-partial-1',
    });
    await seedParticipant(prisma, admin, {
      cohortKey: 'coh:partial:1',
      participantKey: 'part:partial:2',
      enrolKey: 'enr:partial:2',
      contactId: 'contact-partial-2',
    });
    await prisma.customerTrainingParticipantCompletion.create({
      data: {
        programId: 'trn-prog-1',
        participantId: p1.id,
        policyVersion: 'training-completion-policy-v1',
        status: TRAINING_COMPLETION_STATUS.COMPLETED,
        gapsJson: [],
        idempotencyKey: 'pcomp:partial:1',
      },
    });

    const agg = await evaluateProgramCompletion(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-1',
    });
    expect(agg.ok).toBe(true);
    expect(agg.status).not.toBe('COMPLETED');
    expect(agg.enrolledCount).toBeGreaterThan(1);
    expect(agg.participantCompletedCount).toBe(1);

    const published = await publishTrainingOutcomeToOnboarding(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-1',
      idempotencyKey: 'feed:partial:1',
    });
    expect(published.ok).toBe(true);
    expect(published.training.trainingDomainStatus).not.toBe('COMPLETED');
    expect(published.training.status).not.toBe('COMPLETED');
    expect(published.programCompletionStatus).not.toBe('COMPLETED');
  });

  it('feed keeps COMPLETED_WITH_GAPS explicit (never remaps to COMPLETED)', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { participant } = await seedParticipant(prisma, admin, {
      cohortKey: 'coh:gaps:1',
      participantKey: 'part:gaps:1',
      enrolKey: 'enr:gaps:1',
      contactId: 'contact-gaps-1',
    });
    await prisma.customerTrainingParticipantCompletion.create({
      data: {
        programId: 'trn-prog-1',
        participantId: participant.id,
        policyVersion: 'training-completion-policy-v1',
        status: TRAINING_COMPLETION_STATUS.COMPLETED_WITH_GAPS,
        gapsJson: ['ATTENDANCE_WAIVED'],
        idempotencyKey: 'pcomp:gaps:1',
      },
    });

    const agg = await evaluateProgramCompletion(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-1',
    });
    expect(agg.status).toBe('COMPLETED_WITH_GAPS');

    const published = await publishTrainingOutcomeToOnboarding(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-1',
      idempotencyKey: 'feed:gaps:1',
    });
    expect(published.ok).toBe(true);
    expect(published.training.trainingDomainStatus).toBe('COMPLETED_WITH_GAPS');
    expect(published.training.trainingDomainStatus).not.toBe('COMPLETED');
    expect(published.training.status).not.toBe('COMPLETED');
  });

  it('program status COMPLETED rejected without completion policy (ungated)', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    prisma._programStore[0].status = 'COMPLETION_REVIEW';

    const blocked = await transitionTrainingProgramStatus(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-1',
      toStatus: 'COMPLETED',
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toMatch(/completion.?policy|blocked/i);
    expect(prisma._programStore[0].status).toBe('COMPLETION_REVIEW');
  });

  it('onboarding cannot fabricate Training COMPLETED without domain source', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();

    const blocked = await setTrainingCoordinationStatus(prisma, {
      actorContext: { admin },
      projectId: 'onb-proj-1',
      status: 'COMPLETED',
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toMatch(/training.?domain|phase.?18|source/i);
  });

  it('Cross-Tenant program access denied', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();

    const denied = await loadTrainingProgramForActor(prisma, {
      actorContext: { admin, tenantId: 'tenant-other' },
      programId: 'trn-prog-1',
      tenantId: 'tenant-other',
    });
    expect(denied.ok).toBe(false);
    expect(denied.error).toMatch(/cross.?tenant|denied|isolation/i);

    const startDenied = await startAssessmentAttempt(prisma, {
      actorContext: { admin, tenantId: 'tenant-other' },
      programId: 'trn-prog-1',
      tenantId: 'tenant-other',
      assessmentVersionId: 'asmv-x',
      participantId: 'part-x',
      idempotencyKey: 'attm:xt:1',
    });
    expect(startDenied.ok).toBe(false);
    expect(startDenied.error).toMatch(/cross.?tenant|denied|not.?found|version/i);
  });

  it('list attempts do not leak answers', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { participant } = await seedParticipant(prisma, admin, {
      cohortKey: 'coh:list:1',
      participantKey: 'part:list:1',
      enrolKey: 'enr:list:1',
    });
    const asm = await seedAssessment(prisma, admin, { idempotencyKey: 'asm:list:1' });
    const started = await startAssessmentAttempt(prisma, {
      actorContext: { admin },
      assessmentVersionId: asm.version.id,
      participantId: participant.id,
      idempotencyKey: 'attm:list:1',
      now: new Date('2026-08-01T10:00:00Z'),
    });
    await submitAssessmentAttempt(prisma, {
      actorContext: { admin },
      attemptId: started.attempt.id,
      answersJson: { q1: '4', secret: 'should-not-list' },
      now: new Date('2026-08-01T10:05:00Z'),
    });

    const listed = await listAssessmentAttempts(prisma, {
      actorContext: { admin },
      assessmentVersionId: asm.version.id,
      participantId: participant.id,
      programId: 'trn-prog-1',
    });
    expect(listed.ok).toBe(true);
    expect(listed.attempts.length).toBeGreaterThan(0);
    for (const a of listed.attempts) {
      expect(a.answersJson).toBeUndefined();
      expect(a.answers).toBeUndefined();
      expect(JSON.stringify(a)).not.toMatch(/should-not-list/);
    }

    const closed = await listAssessmentAttempts(prisma, {
      actorContext: {
        admin: {
          id: 'cs-agent-list',
          role: 'System Admin',
          permissions: {
            'systemAdmin.customerSuccess.read': true,
            'systemAdmin.customerSuccess.manageCases': true,
          },
        },
      },
      assessmentVersionId: asm.version.id,
    });
    expect(closed.attempts).toEqual([]);
    expect(closed.meta?.failClosed || closed.reason || closed.status).toBeTruthy();
  });

  it('exercise waiver path and health/progress are versioned', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { participant } = await seedParticipant(prisma, admin, {
      cohortKey: 'coh:ex:1',
      participantKey: 'part:ex:1',
      enrolKey: 'enr:ex:1',
    });

    const submitted = await submitTrainingExercise(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-1',
      participantId: participant.id,
      title: 'Optional lab',
      evidenceRef: 'evidence://lab',
      idempotencyKey: 'ex:waive:1',
    });
    expect(submitted.ok).toBe(true);

    const waived = await waiveTrainingExercise(prisma, {
      actorContext: { admin },
      exerciseId: submitted.exercise.id,
      reason: 'Prior learning credit',
      idempotencyKey: 'ex:waive:done:1',
    });
    expect(waived.ok).toBe(true);
    expect(waived.exercise.status).toBe('WAIVED');

    const health = await calculateTrainingHealth(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-1',
    });
    expect(health.ok).toBe(true);
    expect(health.rulesVersion).toBeTruthy();
    expect(health.status).toBeTruthy();

    const progress = await calculateTrainingProgress(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-1',
      participantId: participant.id,
    });
    expect(progress.ok).toBe(true);
    expect(progress.rulesVersion).toBeTruthy();
    expect(progress.complete || progress.isComplete).not.toBe(true);
  });

  it('retake allowed after failed finalised result within attempt limit', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { participant } = await seedParticipant(prisma, admin, {
      cohortKey: 'coh:retake:1',
      participantKey: 'part:retake:1',
      enrolKey: 'enr:retake:1',
    });
    const asm = await seedAssessment(prisma, admin, {
      maxAttempts: 2,
      idempotencyKey: 'asm:retake:1',
    });

    const a1 = await startAssessmentAttempt(prisma, {
      actorContext: { admin },
      assessmentVersionId: asm.version.id,
      participantId: participant.id,
      idempotencyKey: 'attm:retake:1',
      now: new Date('2026-08-01T10:00:00Z'),
    });
    await submitAssessmentAttempt(prisma, {
      actorContext: { admin },
      attemptId: a1.attempt.id,
      answersJson: { q1: 'wrong' },
      now: new Date('2026-08-01T10:05:00Z'),
    });
    const g1 = await gradeAssessmentAttempt(prisma, {
      actorContext: { admin },
      attemptId: a1.attempt.id,
      mode: 'OBJECTIVE',
    });
    await finaliseAssessmentResult(prisma, {
      actorContext: { admin },
      resultId: g1.result.id,
    });
    expect(g1.result.passed).toBe(false);

    const retake = await retakeAssessment(prisma, {
      actorContext: { admin },
      assessmentVersionId: asm.version.id,
      participantId: participant.id,
      priorAttemptId: a1.attempt.id,
      idempotencyKey: 'attm:retake:2',
      now: new Date('2026-08-01T12:00:00Z'),
    });
    expect(retake.ok).toBe(true);
    expect(retake.attempt.id).not.toBe(a1.attempt.id);
  });

  it('completion rejects non-finalised PASSED assessment results', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { participant, cohort } = await seedParticipant(prisma, admin, {
      cohortKey: 'coh:fin:1',
      participantKey: 'part:fin:1',
      enrolKey: 'enr:fin:1',
    });
    const session = await prisma.customerTrainingSession.create({
      data: {
        sessionNumber: 'TRS-2026-000201',
        programId: 'trn-prog-1',
        cohortId: cohort.id,
        status: 'DELIVERED',
        sessionDelivered: true,
      },
    });
    await captureTrainingAttendance(prisma, {
      actorContext: { admin },
      sessionId: session.id,
      participantId: participant.id,
      status: 'PRESENT',
      source: TRAINING_ATTENDANCE_SOURCE.TRAINER_CONFIRMED,
      evidenceRef: 'evidence://wave3-att',
      idempotencyKey: 'att:fin:1',
    });
    const ex = await submitTrainingExercise(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-1',
      participantId: participant.id,
      title: 'Finalise gate exercise',
      evidenceRef: 'evidence://fin-ex',
      idempotencyKey: 'ex:fin:1',
    });
    await reviewTrainingExercise(prisma, {
      actorContext: { admin },
      exerciseId: ex.exercise.id,
      decision: 'PASSED',
      idempotencyKey: 'ex:fin:rev:1',
    });
    const asm = await seedAssessment(prisma, admin, { idempotencyKey: 'asm:fin:1' });
    const started = await startAssessmentAttempt(prisma, {
      actorContext: { admin },
      assessmentVersionId: asm.version.id,
      participantId: participant.id,
      idempotencyKey: 'attm:fin:1',
      now: new Date('2026-08-01T10:00:00Z'),
    });
    await submitAssessmentAttempt(prisma, {
      actorContext: { admin },
      attemptId: started.attempt.id,
      answersJson: { q1: '4' },
      now: new Date('2026-08-01T10:05:00Z'),
    });
    const graded = await gradeAssessmentAttempt(prisma, {
      actorContext: { admin },
      attemptId: started.attempt.id,
      mode: 'OBJECTIVE',
    });
    expect(graded.ok).toBe(true);
    expect(graded.result.passed).toBe(true);
    expect(graded.result.immutable).not.toBe(true);
    expect(graded.result.status).toMatch(/PASSED/i);

    const blocked = await evaluateParticipantCompletion(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-1',
      participantId: participant.id,
      policyVersion: 'training-completion-policy-v1',
      idempotencyKey: 'pcomp:fin:1',
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.gaps || []).toContain('ASSESSMENTS_REQUIRED');
    expect(blocked.completion?.status).not.toBe('COMPLETED');
  });

  it('completion attendance is scoped to program sessions (not cross-program PRESENT)', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    await prisma.customerTrainingProgram.create({
      data: {
        id: 'trn-prog-other',
        programNumber: 'TRN-2026-000099',
        status: 'IN_PROGRESS',
        trainingType: 'CUSTOMER_ONBOARDING',
        trainingRequestId: 'trq-other',
        customerId: 'cust-1',
        tenantId: 'tenant-1',
        subscriptionId: 'sub-1',
        curriculumVersionId: 'currv-onboarding-wave1-v1',
        createdByAdminId: admin.id,
      },
    });
    const { participant, cohort } = await seedParticipant(prisma, admin, {
      cohortKey: 'coh:attscope:1',
      participantKey: 'part:attscope:1',
      enrolKey: 'enr:attscope:1',
    });
    const otherSession = await prisma.customerTrainingSession.create({
      data: {
        sessionNumber: 'TRS-2026-000202',
        programId: 'trn-prog-other',
        cohortId: 'coh-other',
        status: 'DELIVERED',
        sessionDelivered: true,
      },
    });
    await captureTrainingAttendance(prisma, {
      actorContext: { admin },
      sessionId: otherSession.id,
      participantId: participant.id,
      status: 'PRESENT',
      source: TRAINING_ATTENDANCE_SOURCE.TRAINER_CONFIRMED,
      evidenceRef: 'evidence://wave3-att',
      idempotencyKey: 'att:attscope:other',
    });

    const ex = await submitTrainingExercise(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-1',
      participantId: participant.id,
      title: 'Scope exercise',
      evidenceRef: 'evidence://attscope',
      idempotencyKey: 'ex:attscope:1',
    });
    await reviewTrainingExercise(prisma, {
      actorContext: { admin },
      exerciseId: ex.exercise.id,
      decision: 'PASSED',
      idempotencyKey: 'ex:attscope:rev:1',
    });
    const asm = await seedAssessment(prisma, admin, { idempotencyKey: 'asm:attscope:1' });
    const started = await startAssessmentAttempt(prisma, {
      actorContext: { admin },
      assessmentVersionId: asm.version.id,
      participantId: participant.id,
      idempotencyKey: 'attm:attscope:1',
      now: new Date('2026-08-01T10:00:00Z'),
    });
    await submitAssessmentAttempt(prisma, {
      actorContext: { admin },
      attemptId: started.attempt.id,
      answersJson: { q1: '4' },
      now: new Date('2026-08-01T10:05:00Z'),
    });
    const graded = await gradeAssessmentAttempt(prisma, {
      actorContext: { admin },
      attemptId: started.attempt.id,
      mode: 'OBJECTIVE',
    });
    await finaliseAssessmentResult(prisma, {
      actorContext: { admin },
      resultId: graded.result.id,
    });

    const blocked = await evaluateParticipantCompletion(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-1',
      participantId: participant.id,
      policyVersion: 'training-completion-policy-v1',
      idempotencyKey: 'pcomp:attscope:1',
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.gaps || []).toContain('ATTENDANCE_REQUIRED');

    const ownSession = await prisma.customerTrainingSession.create({
      data: {
        sessionNumber: 'TRS-2026-000203',
        programId: 'trn-prog-1',
        cohortId: cohort.id,
        status: 'DELIVERED',
        sessionDelivered: true,
      },
    });
    await captureTrainingAttendance(prisma, {
      actorContext: { admin },
      sessionId: ownSession.id,
      participantId: participant.id,
      status: 'PRESENT',
      source: TRAINING_ATTENDANCE_SOURCE.TRAINER_CONFIRMED,
      evidenceRef: 'evidence://wave3-att',
      idempotencyKey: 'att:attscope:own',
    });
    const ok = await evaluateParticipantCompletion(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-1',
      participantId: participant.id,
      policyVersion: 'training-completion-policy-v1',
      idempotencyKey: 'pcomp:attscope:2',
    });
    expect(ok.ok).toBe(true);
    expect(ok.completion.status).toBe('COMPLETED');
  });

  it('cert and attempt idempotent replay conflict when payload identity disagrees', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { participant } = await seedParticipant(prisma, admin, {
      cohortKey: 'coh:idem:1',
      participantKey: 'part:idem:1',
      enrolKey: 'enr:idem:1',
    });
    const other = await seedParticipant(prisma, admin, {
      cohortKey: 'coh:idem:2',
      participantKey: 'part:idem:2',
      enrolKey: 'enr:idem:2',
      contactId: 'contact-w3-idem-2',
    });
    const asm = await seedAssessment(prisma, admin, {
      maxAttempts: 3,
      idempotencyKey: 'asm:idem:1',
    });
    const asmB = await seedAssessment(prisma, admin, {
      maxAttempts: 3,
      idempotencyKey: 'asm:idem:2',
      title: 'Alt knowledge check',
    });

    const first = await startAssessmentAttempt(prisma, {
      actorContext: { admin },
      assessmentVersionId: asm.version.id,
      participantId: participant.id,
      idempotencyKey: 'attm:idem:conflict',
      now: new Date('2026-08-01T10:00:00Z'),
    });
    expect(first.ok).toBe(true);

    const versionConflict = await startAssessmentAttempt(prisma, {
      actorContext: { admin },
      assessmentVersionId: asmB.version.id,
      participantId: participant.id,
      idempotencyKey: 'attm:idem:conflict',
      now: new Date('2026-08-01T10:01:00Z'),
    });
    expect(versionConflict.ok).toBe(false);
    expect(versionConflict.error).toBe('idempotency_conflict');

    const participantConflict = await startAssessmentAttempt(prisma, {
      actorContext: { admin },
      assessmentVersionId: asm.version.id,
      participantId: other.participant.id,
      idempotencyKey: 'attm:idem:conflict',
      now: new Date('2026-08-01T10:02:00Z'),
    });
    expect(participantConflict.ok).toBe(false);
    expect(participantConflict.error).toBe('idempotency_conflict');

    const exactReplay = await startAssessmentAttempt(prisma, {
      actorContext: { admin },
      assessmentVersionId: asm.version.id,
      participantId: participant.id,
      idempotencyKey: 'attm:idem:conflict',
      now: new Date('2026-08-01T10:03:00Z'),
    });
    expect(exactReplay.ok).toBe(true);
    expect(exactReplay.attempt.id).toBe(first.attempt.id);
    expect(exactReplay.idempotentReplay || exactReplay.alreadyExists).toBe(true);

    prisma._completionStore.push({
      id: 'pcomp-idem-a',
      programId: 'trn-prog-1',
      participantId: participant.id,
      policyVersion: 'training-completion-policy-v1',
      status: 'COMPLETED',
      gapsJson: [],
      idempotencyKey: 'pcomp:idem:a',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma._completionStore.push({
      id: 'pcomp-idem-b',
      programId: 'trn-prog-1',
      participantId: other.participant.id,
      policyVersion: 'training-completion-policy-v1',
      status: 'COMPLETED',
      gapsJson: [],
      idempotencyKey: 'pcomp:idem:b',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const cert = await issueTrainingCertificate(prisma, {
      actorContext: { admin },
      participantCompletionId: 'pcomp-idem-a',
      templateVersionId: 'tmpl-idem-v1',
      idempotencyKey: 'cert:idem:conflict',
      now: new Date('2026-08-02T12:00:00Z'),
    });
    expect(cert.ok).toBe(true);

    const certCompletionConflict = await issueTrainingCertificate(prisma, {
      actorContext: { admin },
      participantCompletionId: 'pcomp-idem-b',
      templateVersionId: 'tmpl-idem-v1',
      idempotencyKey: 'cert:idem:conflict',
      now: new Date('2026-08-02T12:00:00Z'),
    });
    expect(certCompletionConflict.ok).toBe(false);
    expect(certCompletionConflict.error).toBe('idempotency_conflict');

    const certTemplateConflict = await issueTrainingCertificate(prisma, {
      actorContext: { admin },
      participantCompletionId: 'pcomp-idem-a',
      templateVersionId: 'tmpl-idem-v2',
      idempotencyKey: 'cert:idem:conflict',
      now: new Date('2026-08-02T12:00:00Z'),
    });
    expect(certTemplateConflict.ok).toBe(false);
    expect(certTemplateConflict.error).toBe('idempotency_conflict');
  });

  it('gradeAssessmentAttempt rejects IN_PROGRESS (requires SUBMITTED)', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { participant } = await seedParticipant(prisma, admin, {
      cohortKey: 'coh:grade:1',
      participantKey: 'part:grade:1',
      enrolKey: 'enr:grade:1',
    });
    const asm = await seedAssessment(prisma, admin, { idempotencyKey: 'asm:grade:1' });
    const started = await startAssessmentAttempt(prisma, {
      actorContext: { admin },
      assessmentVersionId: asm.version.id,
      participantId: participant.id,
      idempotencyKey: 'attm:grade:1',
      now: new Date('2026-08-01T10:00:00Z'),
    });
    expect(started.attempt.status).toBe('IN_PROGRESS');

    const graded = await gradeAssessmentAttempt(prisma, {
      actorContext: { admin },
      attemptId: started.attempt.id,
      mode: 'OBJECTIVE',
    });
    expect(graded.ok).toBe(false);
    expect(graded.error).toMatch(/submit|not.?gradable|in.?progress|status/i);
  });
});
