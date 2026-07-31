/**
 * Phase 22 Wave 2 — Curriculum / trainers / cohorts / participants /
 * enrolment / invitation honesty (Spec §8; G22-07…13).
 * No Sessions delivery truth / attendance / certs invented this wave.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TRAINING_CURRICULUM_STATUS,
  TRAINING_PARTICIPANT_VERIFICATION,
  TRAINING_ENROLMENT_STATUS,
  TRAINING_INVITATION_STATUS,
  TRAINING_MATERIAL_CLASSIFICATION,
  TRAINING_CONFLICT_STATE,
  TRAINING_DOMAIN_CONTRACT,
  ensureWave1OnboardingCurriculumVersion,
  updateTrainingCurriculumVersion,
  assertTrainingModuleNotProductModule,
  bindTrainingModuleRoleEntitlement,
  assignTrainingTrainer,
  createTrainingCohort,
  verifyTrainingParticipant,
  projectTrainingParticipant,
  enrolTrainingParticipant,
  createTrainingInvitation,
  sendTrainingInvitation,
  markTrainingInvitationDelivered,
  registerFromTrainingInvitation,
  assertRestrictedMaterialAccess,
  projectMaterialForParticipant,
  getTrainingDomainContract,
} from '@/lib/admin/customerSuccess/training';

function superAdmin(id = 'super-p22-w2') {
  return {
    id,
    role: 'Super Admin',
    permissions: {
      'systemAdmin.customerSuccess.read': true,
      'systemAdmin.customerSuccess.manageCases': true,
    },
  };
}

function makePrisma(overrides = {}) {
  const programStore = overrides._programStore || [
    {
      id: 'trn-prog-p22-1',
      programNumber: 'TRN-2026-000101',
      status: 'PARTICIPANT_PLANNING',
      trainingType: 'CUSTOMER_ONBOARDING',
      trainingRequestId: 'trq-p22-1',
      customerId: 'cust-p22-1',
      tenantId: 'tenant-p22-1',
      subscriptionId: 'sub-p22-1',
      curriculumVersionId: 'currv-onboarding-wave1-v1',
      createdByAdminId: 'super-p22-w2',
      createdAt: new Date('2026-07-31T10:00:00Z'),
      updatedAt: new Date('2026-07-31T10:00:00Z'),
    },
  ];
  const curriculumVersionStore = overrides._curriculumVersionStore || [
    {
      id: 'currv-onboarding-wave1-v1',
      curriculumId: 'curr-onboarding-wave1',
      curriculumCode: 'CUSTOMER_ONBOARDING_WAVE1',
      versionNumber: 1,
      trainingType: 'CUSTOMER_ONBOARDING',
      status: TRAINING_CURRICULUM_STATUS.ACTIVE,
      immutable: true,
      contentJson: {
        wave: 1,
        modules: [{ trainingModuleCode: 'TM_ONBOARDING_INTRO' }],
        roleModuleBindings: [],
      },
      createdByAdminId: 'super-p22-w2',
      createdAt: new Date('2026-07-31T09:00:00Z'),
      updatedAt: new Date('2026-07-31T09:00:00Z'),
    },
  ];
  const cohortStore = overrides._cohortStore || [];
  const participantStore = overrides._participantStore || [];
  const enrolmentStore = overrides._enrolmentStore || [];
  const trainerStore = overrides._trainerStore || [];
  const trainerAssignmentStore = overrides._trainerAssignmentStore || [];
  const sessionStore = overrides._sessionStore || [];
  const materialStore = overrides._materialStore || [];
  const invitationStore = overrides._invitationStore || [];
  const conflictStore = overrides._conflictStore || [];
  const seqStore = overrides._seqStore || [];

  const prisma = {
    $transaction: vi.fn(async (fn) => fn(prisma)),
    _programStore: programStore,
    _curriculumVersionStore: curriculumVersionStore,
    _cohortStore: cohortStore,
    _participantStore: participantStore,
    _enrolmentStore: enrolmentStore,
    _trainerStore: trainerStore,
    _trainerAssignmentStore: trainerAssignmentStore,
    _sessionStore: sessionStore,
    _materialStore: materialStore,
    _invitationStore: invitationStore,
    _conflictStore: conflictStore,
    crmNumberSeq: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        const key = where.prefix_year || where;
        return (
          seqStore.find((r) => r.prefix === key.prefix && r.year === key.year) ||
          null
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
        if (where.curriculumVersionId) {
          rows = rows.filter(
            (r) => r.curriculumVersionId === where.curriculumVersionId
          );
        }
        if (where.id) rows = rows.filter((r) => r.id === where.id);
        return rows[0] || null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...programStore];
        if (where.curriculumVersionId) {
          rows = rows.filter(
            (r) => r.curriculumVersionId === where.curriculumVersionId
          );
        }
        return rows;
      }),
    },
    customerTrainingCurriculumVersion: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) {
          return curriculumVersionStore.find((r) => r.id === where.id) || null;
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...curriculumVersionStore];
        if (where.id) rows = rows.filter((r) => r.id === where.id);
        if (where.curriculumCode) {
          rows = rows.filter((r) => r.curriculumCode === where.curriculumCode);
        }
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        return rows[0] || null;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = curriculumVersionStore.find((r) => r.id === where.id);
        if (!row) throw new Error('curriculum_version_not_found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `currv-${curriculumVersionStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        curriculumVersionStore.push(row);
        return row;
      }),
    },
    customerTrainingCohort: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `coh-${cohortStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        cohortStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return cohortStore.find((r) => r.id === where.id) || null;
        if (where.idempotencyKey) {
          return (
            cohortStore.find((r) => r.idempotencyKey === where.idempotencyKey) ||
            null
          );
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...cohortStore];
        if (where.idempotencyKey) {
          rows = rows.filter((r) => r.idempotencyKey === where.idempotencyKey);
        }
        if (where.programId) {
          rows = rows.filter((r) => r.programId === where.programId);
        }
        return rows[0] || null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...cohortStore];
        if (where.programId) {
          rows = rows.filter((r) => r.programId === where.programId);
        }
        return rows;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = cohortStore.find((r) => r.id === where.id);
        if (!row) throw new Error('cohort_not_found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    customerTrainingParticipant: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `part-${participantStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        participantStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) {
          return participantStore.find((r) => r.id === where.id) || null;
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...participantStore];
        if (where.programId) {
          rows = rows.filter((r) => r.programId === where.programId);
        }
        if (where.identityKey) {
          rows = rows.filter((r) => r.identityKey === where.identityKey);
        }
        if (where.idempotencyKey) {
          rows = rows.filter((r) => r.idempotencyKey === where.idempotencyKey);
        }
        return rows[0] || null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...participantStore];
        if (where.programId) {
          rows = rows.filter((r) => r.programId === where.programId);
        }
        return rows;
      }),
    },
    customerTrainingEnrolment: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `enr-${enrolmentStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        enrolmentStore.push(row);
        return row;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...enrolmentStore];
        if (where.idempotencyKey) {
          rows = rows.filter((r) => r.idempotencyKey === where.idempotencyKey);
        }
        if (where.programId) {
          rows = rows.filter((r) => r.programId === where.programId);
        }
        if (where.participantId) {
          rows = rows.filter((r) => r.participantId === where.participantId);
        }
        if (where.cohortId) {
          rows = rows.filter((r) => r.cohortId === where.cohortId);
        }
        return rows[0] || null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...enrolmentStore];
        if (where.cohortId) {
          rows = rows.filter((r) => r.cohortId === where.cohortId);
        }
        if (where.status) {
          rows = rows.filter((r) => r.status === where.status);
        }
        if (where.status?.in) {
          rows = rows.filter((r) => where.status.in.includes(r.status));
        }
        return rows;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return enrolmentStore.find((r) => r.id === where.id) || null;
        if (where.idempotencyKey) {
          return (
            enrolmentStore.find((r) => r.idempotencyKey === where.idempotencyKey) ||
            null
          );
        }
        return null;
      }),
    },
    customerTrainingTrainer: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `trainer-${trainerStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        trainerStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return trainerStore.find((r) => r.id === where.id) || null;
        return null;
      }),
    },
    customerTrainingTrainerAssignment: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `tassign-${trainerAssignmentStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        trainerAssignmentStore.push(row);
        return row;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...trainerAssignmentStore];
        if (where.sessionId) {
          rows = rows.filter((r) => r.sessionId === where.sessionId);
        }
        if (where.trainerId) {
          rows = rows.filter((r) => r.trainerId === where.trainerId);
        }
        if (where.idempotencyKey) {
          rows = rows.filter((r) => r.idempotencyKey === where.idempotencyKey);
        }
        return rows[0] || null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...trainerAssignmentStore];
        if (where.trainerId) {
          rows = rows.filter((r) => r.trainerId === where.trainerId);
        }
        if (where.sessionId) {
          rows = rows.filter((r) => r.sessionId === where.sessionId);
        }
        return rows;
      }),
    },
    customerTrainingSession: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `sess-${sessionStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        sessionStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return sessionStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...sessionStore];
        if (where.id?.in) rows = rows.filter((r) => where.id.in.includes(r.id));
        if (where.programId) {
          rows = rows.filter((r) => r.programId === where.programId);
        }
        return rows;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = sessionStore.find((r) => r.id === where.id);
        if (!row) throw new Error('session_not_found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    customerTrainingMaterial: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `mat-${materialStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        materialStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return materialStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...materialStore];
        if (where.id) rows = rows.filter((r) => r.id === where.id);
        return rows[0] || null;
      }),
    },
    customerTrainingInvitation: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `inv-${invitationStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        invitationStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) {
          return invitationStore.find((r) => r.id === where.id) || null;
        }
        if (where.idempotencyKey) {
          return (
            invitationStore.find((r) => r.idempotencyKey === where.idempotencyKey) ||
            null
          );
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...invitationStore];
        if (where.idempotencyKey) {
          rows = rows.filter((r) => r.idempotencyKey === where.idempotencyKey);
        }
        if (where.id) rows = rows.filter((r) => r.id === where.id);
        return rows[0] || null;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = invitationStore.find((r) => r.id === where.id);
        if (!row) throw new Error('invitation_not_found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    customerTrainingConflict: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `conf-${conflictStore.length + 1}`,
          ...data,
        };
        conflictStore.push(row);
        return row;
      }),
      findMany: vi.fn(async () => [...conflictStore]),
    },
  };

  return prisma;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Phase 22 Wave 2 — curriculum / people / invitation honesty', () => {
  it('domain contract wave is 2 (phase 22 / tree alias 18)', () => {
    expect(TRAINING_DOMAIN_CONTRACT.phase).toBe(22);
    expect(TRAINING_DOMAIN_CONTRACT.treePhaseAlias).toBe(18);
    // Wave advances with later Phase22 tasks; Wave 2+ contract retains phase/alias.
    expect(TRAINING_DOMAIN_CONTRACT.wave).toBeGreaterThanOrEqual(2);
    expect(getTrainingDomainContract().wave).toBeGreaterThanOrEqual(2);
  });

  it('ACTIVE curriculum version applied to Program is immutable', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();

    const blocked = await updateTrainingCurriculumVersion(prisma, {
      actorContext: { admin },
      curriculumVersionId: 'currv-onboarding-wave1-v1',
      contentJson: { modules: [{ trainingModuleCode: 'MUTATED' }] },
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toMatch(/immutable|ACTIVE|applied|frozen/i);

    const seed = await ensureWave1OnboardingCurriculumVersion(prisma, {
      actorContext: { admin },
    });
    expect(seed.ok).toBe(true);
    expect(seed.curriculumVersion.immutable).toBe(true);
    expect(seed.curriculumVersion.status).toBe(TRAINING_CURRICULUM_STATUS.ACTIVE);
  });

  it('refuses Product module id confused as Training module', () => {
    const confused = assertTrainingModuleNotProductModule({
      trainingModuleId: 'prod-mod-finance',
      productModuleId: 'prod-mod-finance',
    });
    expect(confused.ok).toBe(false);
    expect(confused.error).toMatch(/product.?module|not.?training|confused/i);

    const productAsTraining = assertTrainingModuleNotProductModule({
      trainingModuleId: 'prod-mod-finance',
      moduleKind: 'PRODUCT',
    });
    expect(productAsTraining.ok).toBe(false);

    const ok = assertTrainingModuleNotProductModule({
      trainingModuleId: 'tm-onboarding-intro',
      productModuleRef: 'prod-mod-finance',
    });
    expect(ok.ok).toBe(true);
    expect(ok.productModuleRef).toBe('prod-mod-finance');
    expect(ok.trainingModuleId).toBe('tm-onboarding-intro');
  });

  it('role-module entitlement bind keeps Product ref explicit and separate', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();

    const bind = await bindTrainingModuleRoleEntitlement(prisma, {
      actorContext: { admin },
      curriculumVersionId: 'currv-onboarding-wave1-v1',
      trainingModuleCode: 'TM_ONBOARDING_INTRO',
      roleCode: 'TENANT_ADMIN',
      productModuleRef: 'prod-mod-admin',
    });
    // ACTIVE applied version cannot mutate content — bind must fail closed
    expect(bind.ok).toBe(false);
    expect(bind.error).toMatch(/immutable|ACTIVE|applied|frozen/i);
  });

  it('DRAFT curriculum is authorable then freezes on ACTIVE; bind works before freeze', async () => {
    const prisma = makePrisma({
      _programStore: [],
      _curriculumVersionStore: [
        {
          id: 'currv-draft-p22',
          curriculumCode: 'CUSTOM_DRAFT_P22',
          versionNumber: 1,
          trainingType: 'CUSTOMER_ONBOARDING',
          status: TRAINING_CURRICULUM_STATUS.DRAFT,
          immutable: false,
          contentJson: { modules: [], roleModuleBindings: [] },
          createdAt: new Date('2026-07-31T09:00:00Z'),
          updatedAt: new Date('2026-07-31T09:00:00Z'),
        },
      ],
    });
    const admin = superAdmin();

    const bind = await bindTrainingModuleRoleEntitlement(prisma, {
      actorContext: { admin },
      curriculumVersionId: 'currv-draft-p22',
      trainingModuleCode: 'TM_ONBOARDING_INTRO',
      roleCode: 'TENANT_ADMIN',
      productModuleRef: 'prod-mod-admin',
    });
    expect(bind.ok).toBe(true);
    expect(bind.binding.productModuleRef).toBe('prod-mod-admin');
    expect(bind.binding.trainingModuleCode).toBe('TM_ONBOARDING_INTRO');
    expect(bind.curriculumVersion.immutable).toBe(false);

    const activated = await updateTrainingCurriculumVersion(prisma, {
      actorContext: { admin },
      curriculumVersionId: 'currv-draft-p22',
      status: TRAINING_CURRICULUM_STATUS.ACTIVE,
    });
    expect(activated.ok).toBe(true);
    expect(activated.curriculumVersion.status).toBe(
      TRAINING_CURRICULUM_STATUS.ACTIVE
    );
    expect(activated.curriculumVersion.immutable).toBe(true);

    const blocked = await updateTrainingCurriculumVersion(prisma, {
      actorContext: { admin },
      curriculumVersionId: 'currv-draft-p22',
      contentJson: { modules: [{ trainingModuleCode: 'MUTATED' }] },
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toMatch(/immutable|ACTIVE|frozen/i);
  });

  it('trainer assignment requires qualification; conflict needs approved exception', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();

    const trainer = await prisma.customerTrainingTrainer.create({
      data: {
        displayName: 'Ada Trainer',
        skillsJson: ['CUSTOMER_ONBOARDING'],
        languagesJson: ['en'],
        status: 'ACTIVE',
        maxConcurrentAssignments: 1,
      },
    });

    const sessionA = await prisma.customerTrainingSession.create({
      data: {
        sessionNumber: 'TRS-2026-000201',
        programId: 'trn-prog-p22-1',
        timezone: 'Africa/Johannesburg',
        startsAt: new Date('2026-08-20T09:00:00Z'),
        endsAt: new Date('2026-08-20T11:00:00Z'),
        status: 'SCHEDULED',
      },
    });
    const sessionB = await prisma.customerTrainingSession.create({
      data: {
        sessionNumber: 'TRS-2026-000202',
        programId: 'trn-prog-p22-1',
        timezone: 'Africa/Johannesburg',
        startsAt: new Date('2026-08-20T10:00:00Z'),
        endsAt: new Date('2026-08-20T12:00:00Z'),
        status: 'SCHEDULED',
      },
    });

    const skillFail = await assignTrainingTrainer(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-1',
      sessionId: sessionA.id,
      trainerId: trainer.id,
      requiredSkills: ['MRA_EIS'],
      requiredLanguage: 'en',
      idempotencyKey: 'assign:p22:skill',
    });
    expect(skillFail.ok).toBe(false);
    expect(skillFail.error).toMatch(/skill|qualification/i);

    const assignA = await assignTrainingTrainer(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-1',
      sessionId: sessionA.id,
      trainerId: trainer.id,
      requiredSkills: ['CUSTOMER_ONBOARDING'],
      requiredLanguage: 'en',
      idempotencyKey: 'assign:p22:a',
    });
    expect(assignA.ok).toBe(true);

    const blocked = await assignTrainingTrainer(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-1',
      sessionId: sessionB.id,
      trainerId: trainer.id,
      requiredSkills: ['CUSTOMER_ONBOARDING'],
      requiredLanguage: 'en',
      idempotencyKey: 'assign:p22:b-blocked',
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.conflictState).toBe(TRAINING_CONFLICT_STATE.BLOCKED);

    const withException = await assignTrainingTrainer(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-1',
      sessionId: sessionB.id,
      trainerId: trainer.id,
      requiredSkills: ['CUSTOMER_ONBOARDING'],
      requiredLanguage: 'en',
      idempotencyKey: 'assign:p22:b-ex',
      approvedException: true,
      exceptionReason: 'Approved dual-session cover for launch week',
    });
    expect(withException.ok).toBe(true);
    expect(withException.conflictState).toBe(TRAINING_CONFLICT_STATE.BLOCKED);
    expect(withException.approvedException).toBe(true);
  });

  it('UNKNOWN conflict refuses trainer assign without approved exception', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();

    const trainer = await prisma.customerTrainingTrainer.create({
      data: {
        displayName: 'Unknown Conflict Trainer',
        skillsJson: ['CUSTOMER_ONBOARDING'],
        languagesJson: ['en'],
        status: 'ACTIVE',
      },
    });
    const session = await prisma.customerTrainingSession.create({
      data: {
        sessionNumber: 'TRS-2026-000210',
        programId: 'trn-prog-p22-1',
        timezone: null,
        startsAt: new Date('2026-08-21T09:00:00Z'),
        endsAt: new Date('2026-08-21T11:00:00Z'),
        status: 'SCHEDULED',
      },
    });

    const denied = await assignTrainingTrainer(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-1',
      sessionId: session.id,
      trainerId: trainer.id,
      requiredSkills: ['CUSTOMER_ONBOARDING'],
      requiredLanguage: 'en',
      idempotencyKey: 'assign:p22:unknown',
    });
    expect(denied.ok).toBe(false);
    expect(denied.conflictState).toBe(TRAINING_CONFLICT_STATE.UNKNOWN);
    expect(denied.error).toMatch(/UNKNOWN|approved.?exception|conflict/i);
    expect(prisma._trainerAssignmentStore.length).toBe(0);

    const withException = await assignTrainingTrainer(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-1',
      sessionId: session.id,
      trainerId: trainer.id,
      requiredSkills: ['CUSTOMER_ONBOARDING'],
      requiredLanguage: 'en',
      idempotencyKey: 'assign:p22:unknown-ex',
      approvedException: true,
      exceptionReason: 'Governed exception for incomplete schedule pin',
    });
    expect(withException.ok).toBe(true);
    expect(withException.conflictState).toBe(TRAINING_CONFLICT_STATE.UNKNOWN);
    expect(withException.approvedException).toBe(true);
  });

  it('capacity is not bypassed by exception flags when there is no conflict', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();

    const trainer = await prisma.customerTrainingTrainer.create({
      data: {
        displayName: 'Capacity Trainer',
        skillsJson: ['CUSTOMER_ONBOARDING'],
        languagesJson: ['en'],
        status: 'ACTIVE',
        maxConcurrentAssignments: 1,
      },
    });
    const sessionA = await prisma.customerTrainingSession.create({
      data: {
        sessionNumber: 'TRS-2026-000220',
        programId: 'trn-prog-p22-1',
        timezone: 'Africa/Johannesburg',
        startsAt: new Date('2026-08-22T09:00:00Z'),
        endsAt: new Date('2026-08-22T10:00:00Z'),
        status: 'SCHEDULED',
      },
    });
    const sessionB = await prisma.customerTrainingSession.create({
      data: {
        sessionNumber: 'TRS-2026-000221',
        programId: 'trn-prog-p22-1',
        timezone: 'Africa/Johannesburg',
        startsAt: new Date('2026-08-22T12:00:00Z'),
        endsAt: new Date('2026-08-22T13:00:00Z'),
        status: 'SCHEDULED',
      },
    });

    const first = await assignTrainingTrainer(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-1',
      sessionId: sessionA.id,
      trainerId: trainer.id,
      requiredSkills: ['CUSTOMER_ONBOARDING'],
      requiredLanguage: 'en',
      idempotencyKey: 'assign:p22:cap:a',
    });
    expect(first.ok).toBe(true);
    expect(first.conflictState).toBe(TRAINING_CONFLICT_STATE.NO_CONFLICT);

    const bypassAttempt = await assignTrainingTrainer(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-1',
      sessionId: sessionB.id,
      trainerId: trainer.id,
      requiredSkills: ['CUSTOMER_ONBOARDING'],
      requiredLanguage: 'en',
      idempotencyKey: 'assign:p22:cap:b',
      approvedException: true,
      allowBlockedConflict: true,
      exceptionReason: 'should not bypass capacity without conflict',
    });
    expect(bypassAttempt.ok).toBe(false);
    expect(bypassAttempt.error).toMatch(/capacity/i);
    expect(prisma._trainerAssignmentStore.length).toBe(1);
  });

  it('participant identity dedupe + Customer/Tenant/Business/Branch scope', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();

    const first = await verifyTrainingParticipant(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-1',
      contactId: 'contact-p22-1',
      identityType: 'CUSTOMER_CONTACT',
      verificationState: TRAINING_PARTICIPANT_VERIFICATION.VERIFIED,
      businessId: 'biz-p22-1',
      branchId: 'branch-p22-1',
      idempotencyKey: 'part:p22:1',
    });
    expect(first.ok).toBe(true);
    expect(first.participant.customerId).toBe('cust-p22-1');
    expect(first.participant.tenantId).toBe('tenant-p22-1');
    expect(first.participant.businessId).toBe('biz-p22-1');
    expect(first.participant.branchId).toBe('branch-p22-1');

    const projection = projectTrainingParticipant(first.participant);
    expect(projection.marketingConsent).toBeUndefined();
    expect(projection.consentEqualsMarketingConsent).toBe(false);

    const dup = await verifyTrainingParticipant(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-1',
      contactId: 'contact-p22-1',
      identityType: 'CUSTOMER_CONTACT',
      verificationState: TRAINING_PARTICIPANT_VERIFICATION.VERIFIED,
      idempotencyKey: 'part:p22:dup',
    });
    expect(dup.ok).toBe(false);
    expect(dup.error).toMatch(/duplicate|identity/i);
  });

  it('enrolment is idempotent; capacity and prerequisite gates', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();

    const cohort = await createTrainingCohort(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-1',
      name: 'P22 Cohort',
      language: 'en',
      deliveryMode: 'VIRTUAL',
      timezone: 'Africa/Johannesburg',
      capacity: 1,
      idempotencyKey: 'coh:p22:cap:1',
    });
    expect(cohort.ok).toBe(true);

    const p1 = await verifyTrainingParticipant(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-1',
      contactId: 'contact-enr-1',
      verificationState: TRAINING_PARTICIPANT_VERIFICATION.VERIFIED,
      idempotencyKey: 'part:enr:1',
    });
    const p2 = await verifyTrainingParticipant(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-1',
      contactId: 'contact-enr-2',
      verificationState: TRAINING_PARTICIPANT_VERIFICATION.VERIFIED,
      idempotencyKey: 'part:enr:2',
    });

    const prereqFail = await enrolTrainingParticipant(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-1',
      cohortId: cohort.cohort.id,
      participantId: p1.participant.id,
      prerequisiteModuleCodes: ['TM_REQUIRED_BASICS'],
      completedPrerequisiteModuleCodes: [],
      idempotencyKey: 'enr:p22:prereq',
    });
    expect(prereqFail.ok).toBe(false);
    expect(prereqFail.error).toMatch(/prerequisite/i);

    const enrolled = await enrolTrainingParticipant(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-1',
      cohortId: cohort.cohort.id,
      participantId: p1.participant.id,
      prerequisiteModuleCodes: ['TM_REQUIRED_BASICS'],
      completedPrerequisiteModuleCodes: ['TM_REQUIRED_BASICS'],
      idempotencyKey: 'enr:p22:1',
    });
    expect(enrolled.ok).toBe(true);
    expect(enrolled.enrolment.status).toBe(TRAINING_ENROLMENT_STATUS.ENROLLED);

    const replay = await enrolTrainingParticipant(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-1',
      cohortId: cohort.cohort.id,
      participantId: p1.participant.id,
      prerequisiteModuleCodes: ['TM_REQUIRED_BASICS'],
      completedPrerequisiteModuleCodes: ['TM_REQUIRED_BASICS'],
      idempotencyKey: 'enr:p22:1',
    });
    expect(replay.ok).toBe(true);
    expect(replay.alreadyExists || replay.idempotentReplay).toBe(true);

    const waitlisted = await enrolTrainingParticipant(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-1',
      cohortId: cohort.cohort.id,
      participantId: p2.participant.id,
      waitlist: true,
      idempotencyKey: 'enr:p22:wait',
    });
    expect(waitlisted.ok).toBe(true);
    expect(waitlisted.enrolment.status).toBe(TRAINING_ENROLMENT_STATUS.WAITLISTED);

    const capacityFail = await enrolTrainingParticipant(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-1',
      cohortId: cohort.cohort.id,
      contactId: 'contact-enr-3',
      verificationState: TRAINING_PARTICIPANT_VERIFICATION.VERIFIED,
      waitlist: false,
      idempotencyKey: 'enr:p22:cap-fail',
    });
    expect(capacityFail.ok).toBe(false);
    expect(capacityFail.error).toMatch(/capacity/i);
  });

  it('UNKNOWN participant blocks enrolment', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const cohort = await createTrainingCohort(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-1',
      timezone: 'Africa/Johannesburg',
      capacity: 5,
      idempotencyKey: 'coh:p22:unk',
    });
    const unknown = await verifyTrainingParticipant(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-1',
      contactId: 'contact-unknown',
      verificationState: TRAINING_PARTICIPANT_VERIFICATION.UNKNOWN,
      idempotencyKey: 'part:p22:unk',
    });
    expect(unknown.ok).toBe(true);

    const blocked = await enrolTrainingParticipant(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-1',
      cohortId: cohort.cohort.id,
      participantId: unknown.participant.id,
      idempotencyKey: 'enr:p22:unk',
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toMatch(/UNKNOWN|verification|unverified/i);
  });

  it('invitation SENT ≠ DELIVERED ≠ REGISTERED; never invents delivery', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();

    const cohort = await createTrainingCohort(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-1',
      timezone: 'Africa/Johannesburg',
      capacity: 10,
      idempotencyKey: 'coh:p22:inv',
    });
    const participant = await verifyTrainingParticipant(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-1',
      contactId: 'contact-inv-1',
      verificationState: TRAINING_PARTICIPANT_VERIFICATION.VERIFIED,
      idempotencyKey: 'part:p22:inv',
    });

    const created = await createTrainingInvitation(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-1',
      cohortId: cohort.cohort.id,
      participantId: participant.participant.id,
      idempotencyKey: 'inv:p22:1',
    });
    expect(created.ok).toBe(true);
    expect(created.invitation.status).toBe(TRAINING_INVITATION_STATUS.QUEUED);
    expect(created.invitation.status).not.toBe(TRAINING_INVITATION_STATUS.DELIVERED);
    expect(created.invitation.status).not.toBe(TRAINING_INVITATION_STATUS.REGISTERED);

    const sent = await sendTrainingInvitation(prisma, {
      actorContext: { admin },
      invitationId: created.invitation.id,
      idempotencyKey: 'inv:p22:1:send',
    });
    expect(sent.ok).toBe(true);
    expect(sent.invitation.status).toBe(TRAINING_INVITATION_STATUS.SENT);
    expect(sent.invitation.status).not.toBe(TRAINING_INVITATION_STATUS.DELIVERED);
    expect(sent.invitation.status).not.toBe(TRAINING_INVITATION_STATUS.REGISTERED);
    expect(sent.attendanceCreated).not.toBe(true);
    expect(sent.enrolmentCreated).not.toBe(true);
    expect(prisma._enrolmentStore.length).toBe(0);

    const invent = await markTrainingInvitationDelivered(prisma, {
      actorContext: { admin },
      invitationId: created.invitation.id,
      // no deliveryEvidence → refuse invent
    });
    expect(invent.ok).toBe(false);
    expect(invent.error).toMatch(/delivery.?evidence|invent|required/i);
    expect(
      (await prisma.customerTrainingInvitation.findUnique({
        where: { id: created.invitation.id },
      })).status
    ).toBe(TRAINING_INVITATION_STATUS.SENT);

    const delivered = await markTrainingInvitationDelivered(prisma, {
      actorContext: { admin },
      invitationId: created.invitation.id,
      deliveryEvidence: {
        provider: 'email',
        receiptId: 'rcpt-p22-1',
        deliveredAt: '2026-07-31T12:00:00Z',
      },
    });
    expect(delivered.ok).toBe(true);
    expect(delivered.invitation.status).toBe(TRAINING_INVITATION_STATUS.DELIVERED);
    expect(delivered.invitation.status).not.toBe(TRAINING_INVITATION_STATUS.REGISTERED);
    expect(delivered.attendanceCreated).not.toBe(true);

    const registered = await registerFromTrainingInvitation(prisma, {
      actorContext: { admin },
      invitationId: created.invitation.id,
      idempotencyKey: 'inv:p22:1:reg',
    });
    expect(registered.ok).toBe(true);
    expect(registered.invitation.status).toBe(TRAINING_INVITATION_STATUS.REGISTERED);
    expect(registered.enrolment).toBeTruthy();
    expect(registered.enrolment.status).toMatch(/ENROLLED|REGISTERED/);
    expect(registered.attendanceCreated).not.toBe(true);

    const replay = await createTrainingInvitation(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-1',
      cohortId: cohort.cohort.id,
      participantId: participant.participant.id,
      idempotencyKey: 'inv:p22:1',
    });
    expect(replay.ok).toBe(true);
    expect(replay.alreadyExists || replay.idempotentReplay).toBe(true);
  });

  it('restricted materials require reauth; answer keys never in Participant projections', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();

    const verified = await verifyTrainingParticipant(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-p22-1',
      contactId: 'contact-mat-1',
      verificationState: TRAINING_PARTICIPANT_VERIFICATION.VERIFIED,
      idempotencyKey: 'part:p22:mat',
    });

    const material = await prisma.customerTrainingMaterial.create({
      data: {
        programId: 'trn-prog-p22-1',
        title: 'Assessment pack',
        classification: TRAINING_MATERIAL_CLASSIFICATION.RESTRICTED,
        storageRef: 'private://training/materials/restricted-p22',
        status: 'ACTIVE',
        contentJson: {
          questions: [{ id: 'q1', prompt: 'What is TRN?' }],
          answerKey: { q1: 'Training Program' },
          answerKeys: { q1: 'Training Program' },
          correctAnswers: ['Training Program'],
        },
      },
    });

    const noReauth = await assertRestrictedMaterialAccess(prisma, {
      actorContext: { admin },
      materialId: material.id,
      participantId: verified.participant.id,
    });
    expect(noReauth.ok).toBe(false);
    expect(noReauth.error).toMatch(/reauth|reauthor/i);
    expect(noReauth.downloadUrl).toBeFalsy();

    const allowed = await assertRestrictedMaterialAccess(prisma, {
      actorContext: { admin },
      materialId: material.id,
      participantId: verified.participant.id,
      downloadReauthToken: 'reauth-ok-p22',
      reauthorisedAt: new Date().toISOString(),
    });
    expect(allowed.ok).toBe(true);
    expect(allowed.downloadUrl).toBeTruthy();

    const projection = projectMaterialForParticipant(material);
    expect(projection.answerKey).toBeUndefined();
    expect(projection.answerKeys).toBeUndefined();
    expect(projection.correctAnswers).toBeUndefined();
    expect(projection.contentJson?.answerKey).toBeUndefined();
    expect(projection.contentJson?.answerKeys).toBeUndefined();
    expect(projection.contentJson?.correctAnswers).toBeUndefined();
    expect(projection.contentJson?.questions).toBeTruthy();
  });
});
