/**
 * Phase 22 Wave 1 — Handoff validate/accept + Request/Program spine harden.
 * G22-01/02/03/06: checksum UNKNOWN≠VALID; accept idempotent; supersession history;
 * PHASE_21_TRAINING_HANDOFF primary; Program after accept; TRN-; no Sessions/certs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computePhase22TrainingHandoffChecksum } from '@/lib/admin/customerSuccess/onboarding/training.js';
import {
  TRAINING_REQUEST_NUMBER_RE,
  TRAINING_PROGRAM_NUMBER_RE,
  TRAINING_REQUEST_SOURCE,
  TRAINING_HANDOFF_VALIDATION_STATUS,
  TRAINING_DOMAIN_CONTRACT,
  resolveTrainingRequestSource,
  validateTrainingHandoff,
  acceptTrainingHandoff,
  validateTrainingRequest,
  acceptTrainingRequest,
  createCustomerTrainingProgram,
  transitionTrainingRequestStatus,
  transitionTrainingProgramStatus,
  ensureWave1OnboardingCurriculumVersion,
  getTrainingDomainContract,
} from '@/lib/admin/customerSuccess/training';

function superAdmin(id = 'super-p22-1') {
  return {
    id,
    role: 'Super Admin',
    permissions: {
      'systemAdmin.customerSuccess.read': true,
      'systemAdmin.customerSuccess.manageCases': true,
    },
  };
}

function csScopedAdmin(id = 'cs-p22-scoped') {
  return {
    id,
    role: 'System Admin',
    permissions: {
      'systemAdmin.customerSuccess.read': true,
      'systemAdmin.customerSuccess.manageCases': true,
    },
  };
}

function handoffPayload(overrides = {}) {
  return {
    type: 'ONBOARDING_PHASE_22_TRAINING_HANDOFF',
    projectId: 'onb-p22-1',
    customerId: 'cust-p22-1',
    tenantId: 'tenant-p22-1',
    subscriptionId: 'sub-p22-1',
    products: null,
    modules: null,
    roles: null,
    participants: [{ contactId: 'c1', role: 'ADMIN' }],
    contacts: null,
    language: 'en',
    deliveryPreference: 'VIRTUAL',
    dates: null,
    goLiveDependency: true,
    commercialInclusion: false,
    risks: null,
    watermark: 'PHASE_21_TO_PHASE_22_TRAINING_HANDOFF',
    trainingCompleted: false,
    fabricatedComplete: false,
    createsPrograms: false,
    createsSessions: false,
    createsAttendance: false,
    createsCertificates: false,
    ...overrides,
  };
}

function makePhase22Handoff(overrides = {}) {
  const payload = handoffPayload(
    overrides.payloadJson && typeof overrides.payloadJson === 'object'
      ? overrides.payloadJson
      : {}
  );
  const checksumSha256 =
    overrides.checksumSha256 !== undefined
      ? overrides.checksumSha256
      : computePhase22TrainingHandoffChecksum(payload);
  return {
    id: 'p22-handoff-1',
    projectId: payload.projectId,
    status: 'READY',
    payloadJson: payload,
    checksumSha256,
    idempotencyKey: 'emit-p22-th:1',
    createdByAdminId: 'super-p22-1',
    createdAt: new Date('2026-07-31T10:00:00Z'),
    updatedAt: new Date('2026-07-31T10:00:00Z'),
    ...overrides,
    payloadJson: payload,
    checksumSha256:
      overrides.checksumSha256 !== undefined
        ? overrides.checksumSha256
        : checksumSha256,
  };
}

function makePrisma(overrides = {}) {
  const seqStore = overrides._seqStore || [];
  const requestStore = overrides._requestStore || [];
  const requestHistoryStore = overrides._requestHistoryStore || [];
  const programStore = overrides._programStore || [];
  const programHistoryStore = overrides._programHistoryStore || [];
  const curriculumStore = overrides._curriculumStore || [];
  const curriculumVersionStore = overrides._curriculumVersionStore || [];
  const moduleStore = overrides._moduleStore || [];
  const moduleVersionStore = overrides._moduleVersionStore || [];
  const phase22HandoffStore = overrides._phase22HandoffStore || [
    makePhase22Handoff(),
  ];

  const prisma = {
    $transaction: vi.fn(async (fn) => fn(prisma)),
    _requestStore: requestStore,
    _programStore: programStore,
    _phase22HandoffStore: phase22HandoffStore,
    _curriculumVersionStore: curriculumVersionStore,
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
    customerOnboardingPhase22TrainingHandoff: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `p22-${phase22HandoffStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        phase22HandoffStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) {
          return phase22HandoffStore.find((r) => r.id === where.id) || null;
        }
        if (where.idempotencyKey) {
          return (
            phase22HandoffStore.find(
              (r) => r.idempotencyKey === where.idempotencyKey
            ) || null
          );
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...phase22HandoffStore];
        if (where.projectId) {
          rows = rows.filter((r) => r.projectId === where.projectId);
        }
        if (where.status) {
          const st = where.status;
          if (typeof st === 'string') rows = rows.filter((r) => r.status === st);
          else if (st?.in) rows = rows.filter((r) => st.in.includes(r.status));
          else if (st?.notIn) {
            rows = rows.filter((r) => !st.notIn.includes(r.status));
          }
        }
        return rows[0] || null;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = phase22HandoffStore.find((r) => r.id === where.id);
        if (!row) throw new Error('handoff_not_found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    customerTrainingRequest: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `trq-${requestStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        requestStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return requestStore.find((r) => r.id === where.id) || null;
        if (where.requestNumber) {
          return (
            requestStore.find((r) => r.requestNumber === where.requestNumber) ||
            null
          );
        }
        if (where.idempotencyKey) {
          return (
            requestStore.find((r) => r.idempotencyKey === where.idempotencyKey) ||
            null
          );
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...requestStore];
        if (where.handoffId) {
          rows = rows.filter((r) => r.handoffId === where.handoffId);
        }
        if (where.source) rows = rows.filter((r) => r.source === where.source);
        if (where.onboardingProjectId) {
          rows = rows.filter(
            (r) => r.onboardingProjectId === where.onboardingProjectId
          );
        }
        return rows[0] || null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...requestStore];
        if (where.tenantId?.in) {
          rows = rows.filter((r) => where.tenantId.in.includes(r.tenantId));
        } else if (where.tenantId) {
          rows = rows.filter((r) => r.tenantId === where.tenantId);
        }
        return rows;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = requestStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    customerTrainingRequestStatusHistory: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `trqh-${requestHistoryStore.length + 1}`, ...data };
        requestHistoryStore.push(row);
        return row;
      }),
    },
    customerTrainingProgram: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `trn-${programStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        programStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return programStore.find((r) => r.id === where.id) || null;
        if (where.programNumber) {
          return (
            programStore.find((r) => r.programNumber === where.programNumber) ||
            null
          );
        }
        if (where.idempotencyKey) {
          return (
            programStore.find((r) => r.idempotencyKey === where.idempotencyKey) ||
            null
          );
        }
        if (where.trainingRequestId) {
          return (
            programStore.find(
              (r) => r.trainingRequestId === where.trainingRequestId
            ) || null
          );
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...programStore];
        if (where.trainingRequestId) {
          rows = rows.filter(
            (r) => r.trainingRequestId === where.trainingRequestId
          );
        }
        if (where.customerId) {
          rows = rows.filter((r) => r.customerId === where.customerId);
        }
        if (where.tenantId) {
          rows = rows.filter((r) => r.tenantId === where.tenantId);
        }
        if (where.trainingType) {
          rows = rows.filter((r) => r.trainingType === where.trainingType);
        }
        if (where.status?.notIn) {
          rows = rows.filter((r) => !where.status.notIn.includes(r.status));
        } else if (where.status) {
          rows = rows.filter((r) => r.status === where.status);
        }
        if (where.id?.not) {
          rows = rows.filter((r) => r.id !== where.id.not);
        }
        return rows[0] || null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...programStore];
        if (where.tenantId?.in) {
          rows = rows.filter((r) => where.tenantId.in.includes(r.tenantId));
        } else if (where.tenantId) {
          rows = rows.filter((r) => r.tenantId === where.tenantId);
        }
        return rows;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = programStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    customerTrainingProgramStatusHistory: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `trnh-${programHistoryStore.length + 1}`, ...data };
        programHistoryStore.push(row);
        return row;
      }),
    },
    customerTrainingCurriculum: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `curr-${curriculumStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        curriculumStore.push(row);
        return row;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...curriculumStore];
        if (where.curriculumCode) {
          rows = rows.filter((r) => r.curriculumCode === where.curriculumCode);
        }
        return rows[0] || null;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return curriculumStore.find((r) => r.id === where.id) || null;
        if (where.curriculumCode) {
          return (
            curriculumStore.find((r) => r.curriculumCode === where.curriculumCode) ||
            null
          );
        }
        return null;
      }),
    },
    customerTrainingCurriculumVersion: {
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
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...curriculumVersionStore];
        if (where.curriculumCode) {
          rows = rows.filter((r) => r.curriculumCode === where.curriculumCode);
        }
        if (where.trainingType) {
          rows = rows.filter((r) => r.trainingType === where.trainingType);
        }
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        return rows[0] || null;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) {
          return curriculumVersionStore.find((r) => r.id === where.id) || null;
        }
        return null;
      }),
    },
    customerTrainingModule: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `mod-${moduleStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        moduleStore.push(row);
        return row;
      }),
    },
    customerTrainingModuleVersion: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `modv-${moduleVersionStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        moduleVersionStore.push(row);
        return row;
      }),
    },
  };

  return prisma;
}

describe('Phase 22 Wave 1 — Handoff validate/accept + Request/Program spine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('domain contract is PRD phase 22 with treePhaseAlias 18', () => {
    const contract = getTrainingDomainContract();
    expect(contract.phase).toBe(22);
    expect(contract.treePhaseAlias).toBe(18);
    expect(TRAINING_DOMAIN_CONTRACT.phase).toBe(22);
    expect(TRAINING_DOMAIN_CONTRACT.treePhaseAlias).toBe(18);
  });

  it('PHASE_21_TRAINING_HANDOFF is primary; legacy PHASE_16/17 aliases map', () => {
    expect(TRAINING_REQUEST_SOURCE.PHASE_21_TRAINING_HANDOFF).toBe(
      'PHASE_21_TRAINING_HANDOFF'
    );
    expect(
      resolveTrainingRequestSource('PHASE_16_TRAINING_HANDOFF')
    ).toBe('PHASE_21_TRAINING_HANDOFF');
    expect(
      resolveTrainingRequestSource('PHASE_17_ONBOARDING_REQUIREMENT')
    ).toBe('PHASE_21_TRAINING_HANDOFF');
    expect(
      resolveTrainingRequestSource('PHASE_21_TRAINING_HANDOFF')
    ).toBe('PHASE_21_TRAINING_HANDOFF');
  });

  it('exposes UNKNOWN validation status and UNKNOWN ≠ VALID', () => {
    expect(TRAINING_HANDOFF_VALIDATION_STATUS.UNKNOWN).toBe('UNKNOWN');
    expect(TRAINING_HANDOFF_VALIDATION_STATUS.VALID).toBe('VALID');
    expect(TRAINING_HANDOFF_VALIDATION_STATUS.UNKNOWN).not.toBe(
      TRAINING_HANDOFF_VALIDATION_STATUS.VALID
    );
  });

  it('missing checksum yields UNKNOWN (never VALID)', async () => {
    const prisma = makePrisma({
      _phase22HandoffStore: [makePhase22Handoff({ checksumSha256: null })],
    });
    const result = await validateTrainingHandoff(prisma, {
      actorContext: { admin: superAdmin() },
      handoffId: 'p22-handoff-1',
    });
    expect(result.ok).toBe(false);
    expect(result.validationStatus).toBe(TRAINING_HANDOFF_VALIDATION_STATUS.UNKNOWN);
    expect(result.validationStatus).not.toBe(TRAINING_HANDOFF_VALIDATION_STATUS.VALID);
    expect(result.checksumValid).not.toBe(true);
  });

  it('checksum mismatch is not VALID; matching checksum is VALID', async () => {
    const bad = makePrisma({
      _phase22HandoffStore: [
        makePhase22Handoff({ checksumSha256: 'a'.repeat(64) }),
      ],
    });
    const mismatch = await validateTrainingHandoff(bad, {
      actorContext: { admin: superAdmin() },
      handoffId: 'p22-handoff-1',
    });
    expect(mismatch.ok).toBe(false);
    expect(mismatch.validationStatus).not.toBe(
      TRAINING_HANDOFF_VALIDATION_STATUS.VALID
    );
    expect(mismatch.validationStatus).not.toBe(
      TRAINING_HANDOFF_VALIDATION_STATUS.VALID_WITH_WARNINGS
    );

    const good = makePrisma();
    const valid = await validateTrainingHandoff(good, {
      actorContext: { admin: superAdmin() },
      handoffId: 'p22-handoff-1',
    });
    expect(valid.ok).toBe(true);
    expect([
      TRAINING_HANDOFF_VALIDATION_STATUS.VALID,
      TRAINING_HANDOFF_VALIDATION_STATUS.VALID_WITH_WARNINGS,
    ]).toContain(valid.validationStatus);
    expect(valid.checksumValid).toBe(true);
  });

  it('acceptTrainingHandoff validates checksum, creates TRQ with PHASE_21 source, marks ACCEPTED_BY_TRAINING', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const result = await acceptTrainingHandoff(prisma, {
      actorContext: { admin },
      handoffId: 'p22-handoff-1',
      acceptanceNotes: 'Wave1 accept',
      idempotencyKey: 'accept-p22:1',
    });
    expect(result.ok).toBe(true);
    expect(result.request.requestNumber).toMatch(TRAINING_REQUEST_NUMBER_RE);
    expect(result.request.handoffId).toBe('p22-handoff-1');
    expect(result.request.source).toBe(
      TRAINING_REQUEST_SOURCE.PHASE_21_TRAINING_HANDOFF
    );
    expect(result.trainingCompleted).not.toBe(true);
    expect(result.programCreated).not.toBe(true);
    expect(prisma._programStore.length).toBe(0);
    expect(String(prisma._phase22HandoffStore[0].status).toUpperCase()).toBe(
      'ACCEPTED_BY_TRAINING'
    );
    expect(result.checksumValid).toBe(true);
    expect(result.validationStatus).not.toBe(
      TRAINING_HANDOFF_VALIDATION_STATUS.UNKNOWN
    );
  });

  it('accept exact retry returns same result; conflicting idempotency fails', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const args = {
      actorContext: { admin },
      handoffId: 'p22-handoff-1',
      acceptanceNotes: 'Wave1 accept',
      idempotencyKey: 'accept-p22:exact',
    };
    const first = await acceptTrainingHandoff(prisma, args);
    expect(first.ok).toBe(true);
    const second = await acceptTrainingHandoff(prisma, args);
    expect(second.ok).toBe(true);
    expect(
      second.alreadyExists || second.idempotentReplay || second.alreadyAccepted
    ).toBe(true);
    expect(second.request.id).toBe(first.request.id);
    expect(prisma._requestStore.length).toBe(1);

    const payload2 = handoffPayload({
      projectId: 'onb-p22-2',
      customerId: 'cust-p22-2',
      subscriptionId: 'sub-p22-2',
    });
    prisma._phase22HandoffStore.push(
      makePhase22Handoff({
        id: 'p22-handoff-2',
        projectId: 'onb-p22-2',
        idempotencyKey: 'emit-p22-th:2',
        payloadJson: payload2,
        checksumSha256: computePhase22TrainingHandoffChecksum(payload2),
      })
    );
    const keyConflict = await acceptTrainingHandoff(prisma, {
      actorContext: { admin },
      handoffId: 'p22-handoff-2',
      acceptanceNotes: 'other handoff',
      idempotencyKey: 'accept-p22:exact',
    });
    expect(keyConflict.ok).toBe(false);
    expect(keyConflict.error).toMatch(/conflict|idempotency/i);
  });

  it('accept refuses UNKNOWN checksum; does not mark accepted', async () => {
    const prisma = makePrisma({
      _phase22HandoffStore: [makePhase22Handoff({ checksumSha256: null })],
    });
    const result = await acceptTrainingHandoff(prisma, {
      actorContext: { admin: superAdmin() },
      handoffId: 'p22-handoff-1',
      idempotencyKey: 'accept-p22:unknown',
    });
    expect(result.ok).toBe(false);
    expect(result.validationStatus).toBe(TRAINING_HANDOFF_VALIDATION_STATUS.UNKNOWN);
    expect(result.validationStatus).not.toBe(TRAINING_HANDOFF_VALIDATION_STATUS.VALID);
    expect(String(prisma._phase22HandoffStore[0].status).toUpperCase()).not.toBe(
      'ACCEPTED_BY_TRAINING'
    );
    expect(prisma._requestStore.length).toBe(0);
  });

  it('correction/supersession preserves history on accept path', async () => {
    const priorPayload = handoffPayload({
      participants: [{ contactId: 'c1', role: 'ADMIN', email: 'old@example.com' }],
    });
    const prior = makePhase22Handoff({
      id: 'p22-handoff-old',
      status: 'SUPERSEDED',
      idempotencyKey: 'emit-p22-th:old',
      checksumSha256: computePhase22TrainingHandoffChecksum(priorPayload),
      payloadJson: {
        ...priorPayload,
        supersededAt: '2026-07-30T12:00:00.000Z',
        supersededByHandoffId: 'p22-handoff-1',
        supersessionReason: 'participant_email_typo',
      },
    });
    const activePayload = handoffPayload({
      participants: [
        { contactId: 'c1', role: 'ADMIN', email: 'ada.corrected@example.com' },
      ],
      supersessionHistory: [
        {
          handoffId: 'p22-handoff-old',
          supersededAt: '2026-07-30T12:00:00.000Z',
          reason: 'participant_email_typo',
        },
      ],
      supersedesHandoffId: 'p22-handoff-old',
    });
    const active = makePhase22Handoff({
      id: 'p22-handoff-1',
      payloadJson: activePayload,
      checksumSha256: computePhase22TrainingHandoffChecksum(activePayload),
    });
    const prisma = makePrisma({ _phase22HandoffStore: [prior, active] });

    const accepted = await acceptTrainingHandoff(prisma, {
      actorContext: { admin: superAdmin() },
      handoffId: 'p22-handoff-1',
      idempotencyKey: 'accept-p22:correction',
    });
    expect(accepted.ok).toBe(true);

    const priorAfter = prisma._phase22HandoffStore.find(
      (h) => h.id === 'p22-handoff-old'
    );
    expect(priorAfter.status).toBe('SUPERSEDED');
    expect(priorAfter.payloadJson?.supersededByHandoffId).toBe('p22-handoff-1');
    expect(priorAfter.payloadJson?.participants?.[0]?.email).toBe(
      'old@example.com'
    );

    const activeAfter = prisma._phase22HandoffStore.find(
      (h) => h.id === 'p22-handoff-1'
    );
    expect(activeAfter.status).toBe('ACCEPTED_BY_TRAINING');
    expect(Array.isArray(activeAfter.payloadJson?.supersessionHistory)).toBe(true);
    expect(activeAfter.payloadJson.supersessionHistory.length).toBeGreaterThanOrEqual(
      1
    );

    const refuseSuperseded = await acceptTrainingHandoff(prisma, {
      actorContext: { admin: superAdmin() },
      handoffId: 'p22-handoff-old',
      idempotencyKey: 'accept-p22:superseded',
    });
    expect(refuseSuperseded.ok).toBe(false);
    expect(refuseSuperseded.error).toMatch(/superseded/i);
  });

  it('Program create after accept: TRN- number, curriculum pin; accept alone creates no Program; duplicate active purpose blocked on accept', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const curr = await ensureWave1OnboardingCurriculumVersion(prisma, {
      actorContext: { admin },
    });
    expect(curr.ok).toBe(true);

    const accepted = await acceptTrainingHandoff(prisma, {
      actorContext: { admin },
      handoffId: 'p22-handoff-1',
      idempotencyKey: 'accept-p22:prog',
    });
    expect(accepted.ok).toBe(true);
    expect(prisma._programStore.length).toBe(0);

    await validateTrainingRequest(prisma, {
      actorContext: { admin },
      trainingRequestId: accepted.request.id,
    });
    await acceptTrainingRequest(prisma, {
      actorContext: { admin },
      trainingRequestId: accepted.request.id,
    });

    const program = await createCustomerTrainingProgram(prisma, {
      actorContext: { admin },
      trainingRequestId: accepted.request.id,
      curriculumVersionId: curr.curriculumVersion.id,
      targetStartDate: '2026-08-10',
      targetCompletionDate: '2026-09-01',
      ownerAssignments: { csOwnerAdminId: admin.id },
      idempotencyKey: 'trn-p22:1',
    });
    expect(program.ok).toBe(true);
    expect(program.program.programNumber).toMatch(TRAINING_PROGRAM_NUMBER_RE);
    expect(program.program.curriculumVersionId).toBe(curr.curriculumVersion.id);
    expect(program.trainingCompleted).not.toBe(true);

    // Spec §6 — accept refuses when conflicting active Program purpose exists
    const payload2 = handoffPayload({
      projectId: 'onb-p22-dup',
      subscriptionId: 'sub-p22-dup',
    });
    prisma._phase22HandoffStore.push(
      makePhase22Handoff({
        id: 'p22-handoff-dup',
        projectId: 'onb-p22-dup',
        idempotencyKey: 'emit-p22-th:dup',
        payloadJson: payload2,
        checksumSha256: computePhase22TrainingHandoffChecksum(payload2),
      })
    );
    const requestCountBefore = prisma._requestStore.length;
    const blockedAccept = await acceptTrainingHandoff(prisma, {
      actorContext: { admin },
      handoffId: 'p22-handoff-dup',
      idempotencyKey: 'accept-p22:dup',
    });
    expect(blockedAccept.ok).toBe(false);
    expect(blockedAccept.error).toMatch(/duplicate|active.?program|purpose/i);
    expect(prisma._requestStore.length).toBe(requestCountBefore);
    expect(String(prisma._phase22HandoffStore.find((h) => h.id === 'p22-handoff-dup')?.status).toUpperCase()).not.toBe(
      'ACCEPTED_BY_TRAINING'
    );
    expect(prisma._programStore.length).toBe(1);
  });

  it('portfolio fail-closed on accept/create by id for scoped CS', async () => {
    const prisma = makePrisma();
    const scoped = csScopedAdmin();

    const deniedAccept = await acceptTrainingHandoff(prisma, {
      actorContext: { admin: scoped },
      handoffId: 'p22-handoff-1',
      idempotencyKey: 'accept-p22:scope',
      portfolioTenantIds: ['tenant-other'],
    });
    expect(deniedAccept.ok).toBe(false);
    expect(deniedAccept.forbidden || deniedAccept.notFound).toBe(true);
    expect(deniedAccept.error || deniedAccept.reason).toMatch(
      /scope|portfolio|forbidden/i
    );
    expect(prisma._requestStore.length).toBe(0);

    const emptyScope = await acceptTrainingHandoff(prisma, {
      actorContext: { admin: scoped },
      handoffId: 'p22-handoff-1',
      idempotencyKey: 'accept-p22:empty-scope',
      portfolioTenantIds: [],
    });
    expect(emptyScope.ok).toBe(false);
    expect(emptyScope.forbidden || emptyScope.notFound || emptyScope.error).toBeTruthy();

    const admin = superAdmin();
    const curr = await ensureWave1OnboardingCurriculumVersion(prisma, {
      actorContext: { admin },
    });
    const accepted = await acceptTrainingHandoff(prisma, {
      actorContext: { admin },
      handoffId: 'p22-handoff-1',
      idempotencyKey: 'accept-p22:then-scope-prog',
    });
    expect(accepted.ok).toBe(true);
    await validateTrainingRequest(prisma, {
      actorContext: { admin },
      trainingRequestId: accepted.request.id,
    });
    await acceptTrainingRequest(prisma, {
      actorContext: { admin },
      trainingRequestId: accepted.request.id,
    });

    const deniedCreate = await createCustomerTrainingProgram(prisma, {
      actorContext: { admin: scoped },
      trainingRequestId: accepted.request.id,
      curriculumVersionId: curr.curriculumVersion.id,
      targetStartDate: '2026-08-10',
      targetCompletionDate: '2026-09-01',
      ownerAssignments: { csOwnerAdminId: scoped.id },
      idempotencyKey: 'trn-p22:out-of-scope',
      portfolioTenantIds: ['tenant-other'],
    });
    expect(deniedCreate.ok).toBe(false);
    expect(deniedCreate.forbidden || deniedCreate.notFound).toBe(true);
    expect(deniedCreate.error || deniedCreate.reason).toMatch(
      /scope|portfolio|forbidden/i
    );
    expect(prisma._programStore.length).toBe(0);
  });

  it('invalid status transitions throw', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const accepted = await acceptTrainingHandoff(prisma, {
      actorContext: { admin },
      handoffId: 'p22-handoff-1',
      idempotencyKey: 'accept-p22:bad-status',
    });
    expect(accepted.ok).toBe(true);

    await expect(
      transitionTrainingRequestStatus(prisma, {
        actorContext: { admin },
        trainingRequestId: accepted.request.id,
        toStatus: 'CONVERTED_TO_PROGRAM',
      })
    ).rejects.toThrow(/invalid_status_transition/i);

    const curr = await ensureWave1OnboardingCurriculumVersion(prisma, {
      actorContext: { admin },
    });
    await validateTrainingRequest(prisma, {
      actorContext: { admin },
      trainingRequestId: accepted.request.id,
    });
    await acceptTrainingRequest(prisma, {
      actorContext: { admin },
      trainingRequestId: accepted.request.id,
    });
    const program = await createCustomerTrainingProgram(prisma, {
      actorContext: { admin },
      trainingRequestId: accepted.request.id,
      curriculumVersionId: curr.curriculumVersion.id,
      ownerAssignments: { csOwnerAdminId: admin.id },
      idempotencyKey: 'trn-p22:bad-status',
    });
    expect(program.ok).toBe(true);

    await expect(
      transitionTrainingProgramStatus(prisma, {
        actorContext: { admin },
        trainingProgramId: program.program.id,
        toStatus: 'COMPLETED',
      })
    ).rejects.toThrow(/invalid_status_transition/i);
  });
});
