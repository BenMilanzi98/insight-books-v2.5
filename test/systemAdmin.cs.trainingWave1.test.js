/**
 * Phase 18 Wave 1 — Customer Training Request + Program spine.
 * Consumes Phase 16 TRAINING handoff; never fabricates trainingCompleted.
 * No Sessions / attendance / assessments / Tenant GL.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TRAINING_REQUEST_NUMBER_RE,
  TRAINING_PROGRAM_NUMBER_RE,
  consumeTrainingHandoff,
  validateTrainingRequest,
  acceptTrainingRequest,
  createCustomerTrainingProgram,
  transitionTrainingRequestStatus,
  getTrainingDomainContract,
  ensureWave1OnboardingCurriculumVersion,
} from '@/lib/admin/customerSuccess/training';

function superAdmin(id = 'super-trn-1') {
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
  const seqStore = overrides._seqStore || [];
  const requestStore = overrides._requestStore || [];
  const requestHistoryStore = overrides._requestHistoryStore || [];
  const programStore = overrides._programStore || [];
  const programHistoryStore = overrides._programHistoryStore || [];
  const curriculumStore = overrides._curriculumStore || [];
  const curriculumVersionStore = overrides._curriculumVersionStore || [];
  const moduleStore = overrides._moduleStore || [];
  const moduleVersionStore = overrides._moduleVersionStore || [];
  const handoffStore = overrides._handoffStore || [
    {
      id: 'handoff-trn-1',
      conversionId: 'cvn-1',
      tenantId: 'tenant-1',
      handoffType: 'TRAINING',
      status: 'EMITTED',
      executionStatus: 'NOT_STARTED',
      idempotencyKey: 'training-handoff:cvn-1',
      payloadJson: {
        type: 'CRM_TRAINING_HANDOFF',
        conversionId: 'cvn-1',
        customerId: 'cust-1',
        tenantId: 'tenant-1',
        subscriptionId: 'sub-1',
        trainingCompleted: false,
        fabricatedComplete: false,
        executionComplete: false,
        executionStatus: 'NOT_STARTED',
      },
      checksumSha256: null,
      createdByAdminId: 'super-trn-1',
      createdAt: new Date('2026-07-31T10:00:00Z'),
      updatedAt: new Date('2026-07-31T10:00:00Z'),
    },
  ];

  const prisma = {
    $transaction: vi.fn(async (fn) => fn(prisma)),
    _requestStore: requestStore,
    _programStore: programStore,
    _handoffStore: handoffStore,
    _curriculumVersionStore: curriculumVersionStore,
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
    crmConversionDomainHandoff: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `handoff-${handoffStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        handoffStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return handoffStore.find((r) => r.id === where.id) || null;
        if (where.idempotencyKey) {
          return handoffStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...handoffStore];
        if (where.handoffType) {
          rows = rows.filter((r) => r.handoffType === where.handoffType);
        }
        if (where.conversionId) {
          rows = rows.filter((r) => r.conversionId === where.conversionId);
        }
        return rows[0] || null;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = handoffStore.find((r) => r.id === where.id);
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
          return requestStore.find((r) => r.requestNumber === where.requestNumber) || null;
        }
        if (where.idempotencyKey) {
          return requestStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...requestStore];
        if (where.handoffId) rows = rows.filter((r) => r.handoffId === where.handoffId);
        if (where.source) rows = rows.filter((r) => r.source === where.source);
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
          return programStore.find((r) => r.programNumber === where.programNumber) || null;
        }
        if (where.idempotencyKey) {
          return programStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        if (where.trainingRequestId) {
          return (
            programStore.find((r) => r.trainingRequestId === where.trainingRequestId) || null
          );
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...programStore];
        if (where.trainingRequestId) {
          rows = rows.filter((r) => r.trainingRequestId === where.trainingRequestId);
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
          return curriculumStore.find((r) => r.curriculumCode === where.curriculumCode) || null;
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
        if (where.id) return curriculumVersionStore.find((r) => r.id === where.id) || null;
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

describe('Phase 18 Wave 1 — Training Request + Program spine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Phase 16 TRAINING handoff consume creates one TRQ- Request', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const result = await consumeTrainingHandoff(prisma, {
      actorContext: { admin },
      handoffId: 'handoff-trn-1',
      idempotencyKey: 'trq-from-handoff:handoff-trn-1',
    });
    expect(result.ok).toBe(true);
    expect(result.request.requestNumber).toMatch(TRAINING_REQUEST_NUMBER_RE);
    expect(result.request.customerId).toBe('cust-1');
    expect(result.request.tenantId).toBe('tenant-1');
    expect(result.request.subscriptionId).toBe('sub-1');
    expect(result.request.handoffId).toBe('handoff-trn-1');
    expect(result.trainingCompleted).not.toBe(true);
    expect(getTrainingDomainContract().surface).toContain('training');
    expect(prisma._requestStore.length).toBe(1);
    expect(String(prisma._handoffStore[0].executionStatus).toUpperCase()).toBe(
      'IN_PROGRESS'
    );
  });

  it('exact handoff retry returns same Request (no duplicate)', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const args = {
      actorContext: { admin },
      handoffId: 'handoff-trn-1',
      idempotencyKey: 'trq-from-handoff:handoff-trn-1',
    };
    const first = await consumeTrainingHandoff(prisma, args);
    expect(first.ok).toBe(true);
    const second = await consumeTrainingHandoff(prisma, args);
    expect(second.ok).toBe(true);
    expect(second.alreadyExists || second.idempotentReplay).toBe(true);
    expect(second.request.id).toBe(first.request.id);
    expect(prisma._requestStore.length).toBe(1);
    expect(second.trainingCompleted).not.toBe(true);
  });

  it('replay consume repairs handoff to IN_PROGRESS when Request exists and handoff still NOT_STARTED', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const args = {
      actorContext: { admin },
      handoffId: 'handoff-trn-1',
      idempotencyKey: 'trq-from-handoff:handoff-stuck:1',
    };
    const first = await consumeTrainingHandoff(prisma, args);
    expect(first.ok).toBe(true);
    expect(prisma._requestStore.length).toBe(1);

    prisma._handoffStore[0].executionStatus = 'NOT_STARTED';

    const replay = await consumeTrainingHandoff(prisma, args);
    expect(replay.ok).toBe(true);
    expect(replay.alreadyExists || replay.idempotentReplay).toBe(true);
    expect(replay.request.id).toBe(first.request.id);
    expect(prisma._requestStore.length).toBe(1);
    expect(String(prisma._handoffStore[0].executionStatus).toUpperCase()).toBe(
      'IN_PROGRESS'
    );
    expect(replay.trainingCompleted).not.toBe(true);
    expect(String(prisma._handoffStore[0].executionStatus).toUpperCase()).not.toBe(
      'COMPLETED'
    );
  });

  it('accept → convert creates one TRN- Program; second convert returns same (one Request → one Program)', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const curr = await ensureWave1OnboardingCurriculumVersion(prisma, {
      actorContext: { admin },
    });
    expect(curr.ok).toBe(true);

    const consumed = await consumeTrainingHandoff(prisma, {
      actorContext: { admin },
      handoffId: 'handoff-trn-1',
      idempotencyKey: 'trq-convert:1',
    });
    expect(consumed.ok).toBe(true);

    const validated = await validateTrainingRequest(prisma, {
      actorContext: { admin },
      trainingRequestId: consumed.request.id,
    });
    expect(validated.ok).toBe(true);

    const accepted = await acceptTrainingRequest(prisma, {
      actorContext: { admin },
      trainingRequestId: consumed.request.id,
    });
    expect(accepted.ok).toBe(true);
    expect(accepted.request.status).toBe('ACCEPTED');

    const program = await createCustomerTrainingProgram(prisma, {
      actorContext: { admin },
      trainingRequestId: consumed.request.id,
      curriculumVersionId: curr.curriculumVersion.id,
      targetStartDate: '2026-08-10',
      targetCompletionDate: '2026-09-01',
      ownerAssignments: { csOwnerAdminId: admin.id },
      idempotencyKey: 'trn-create:1',
    });
    expect(program.ok).toBe(true);
    expect(program.program.programNumber).toMatch(TRAINING_PROGRAM_NUMBER_RE);
    expect(program.program.curriculumVersionId).toBe(curr.curriculumVersion.id);
    expect(prisma._requestStore[0].status).toBe('CONVERTED_TO_PROGRAM');
    expect(program.trainingCompleted).not.toBe(true);

    const second = await createCustomerTrainingProgram(prisma, {
      actorContext: { admin },
      trainingRequestId: consumed.request.id,
      curriculumVersionId: curr.curriculumVersion.id,
      targetStartDate: '2026-08-10',
      targetCompletionDate: '2026-09-01',
      ownerAssignments: { csOwnerAdminId: admin.id },
      idempotencyKey: 'trn-create:1',
    });
    expect(second.ok).toBe(true);
    expect(
      second.alreadyExists ||
        second.idempotentReplay ||
        second.program.id === program.program.id
    ).toBe(true);
    expect(prisma._programStore.length).toBe(1);
  });

  it('exact program create retry returns same Program', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const curr = await ensureWave1OnboardingCurriculumVersion(prisma, {
      actorContext: { admin },
    });
    const consumed = await consumeTrainingHandoff(prisma, {
      actorContext: { admin },
      handoffId: 'handoff-trn-1',
      idempotencyKey: 'trq-retry-prog:1',
    });
    await validateTrainingRequest(prisma, {
      actorContext: { admin },
      trainingRequestId: consumed.request.id,
    });
    await acceptTrainingRequest(prisma, {
      actorContext: { admin },
      trainingRequestId: consumed.request.id,
    });
    const args = {
      actorContext: { admin },
      trainingRequestId: consumed.request.id,
      curriculumVersionId: curr.curriculumVersion.id,
      targetStartDate: '2026-08-10',
      targetCompletionDate: '2026-09-01',
      ownerAssignments: { csOwnerAdminId: admin.id },
      idempotencyKey: 'trn-exact:1',
    };
    const first = await createCustomerTrainingProgram(prisma, args);
    const second = await createCustomerTrainingProgram(prisma, args);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.alreadyExists || second.idempotentReplay).toBe(true);
    expect(second.program.id).toBe(first.program.id);
    expect(prisma._programStore.length).toBe(1);
  });

  it('program create retry repairs Request to CONVERTED_TO_PROGRAM when Program already exists', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const curr = await ensureWave1OnboardingCurriculumVersion(prisma, {
      actorContext: { admin },
    });
    const consumed = await consumeTrainingHandoff(prisma, {
      actorContext: { admin },
      handoffId: 'handoff-trn-1',
      idempotencyKey: 'trq-repair-convert:1',
    });
    await validateTrainingRequest(prisma, {
      actorContext: { admin },
      trainingRequestId: consumed.request.id,
    });
    await acceptTrainingRequest(prisma, {
      actorContext: { admin },
      trainingRequestId: consumed.request.id,
    });

    const args = {
      actorContext: { admin },
      trainingRequestId: consumed.request.id,
      curriculumVersionId: curr.curriculumVersion.id,
      targetStartDate: '2026-08-10',
      targetCompletionDate: '2026-09-01',
      ownerAssignments: { csOwnerAdminId: admin.id },
      idempotencyKey: 'trn-repair-convert:1',
    };
    const first = await createCustomerTrainingProgram(prisma, args);
    expect(first.ok).toBe(true);
    expect(prisma._programStore.length).toBe(1);

    prisma._requestStore[0].status = 'ACCEPTED';
    prisma._requestStore[0].programId = null;

    const retry = await createCustomerTrainingProgram(prisma, args);
    expect(retry.ok).toBe(true);
    expect(retry.alreadyExists || retry.idempotentReplay).toBe(true);
    expect(retry.program.id).toBe(first.program.id);
    expect(prisma._programStore.length).toBe(1);
    expect(prisma._requestStore[0].status).toBe('CONVERTED_TO_PROGRAM');
    expect(retry.trainingCompleted).not.toBe(true);
  });

  it('conflicting idempotency payload fails', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const curr = await ensureWave1OnboardingCurriculumVersion(prisma, {
      actorContext: { admin },
    });
    const consumed = await consumeTrainingHandoff(prisma, {
      actorContext: { admin },
      handoffId: 'handoff-trn-1',
      idempotencyKey: 'trq-conflict:1',
    });
    await validateTrainingRequest(prisma, {
      actorContext: { admin },
      trainingRequestId: consumed.request.id,
    });
    await acceptTrainingRequest(prisma, {
      actorContext: { admin },
      trainingRequestId: consumed.request.id,
    });

    const first = await createCustomerTrainingProgram(prisma, {
      actorContext: { admin },
      trainingRequestId: consumed.request.id,
      curriculumVersionId: curr.curriculumVersion.id,
      targetStartDate: '2026-08-10',
      targetCompletionDate: '2026-09-01',
      ownerAssignments: { csOwnerAdminId: admin.id },
      idempotencyKey: 'trn-conflict:1',
    });
    expect(first.ok).toBe(true);

    const conflict = await createCustomerTrainingProgram(prisma, {
      actorContext: { admin },
      trainingRequestId: consumed.request.id,
      curriculumVersionId: curr.curriculumVersion.id,
      targetStartDate: '2026-08-20',
      targetCompletionDate: '2026-10-01',
      ownerAssignments: { csOwnerAdminId: 'other-admin' },
      idempotencyKey: 'trn-conflict:1',
    });
    expect(conflict.ok).toBe(false);
    expect(conflict.error).toMatch(/conflict|idempotency/i);
    expect(prisma._programStore.length).toBe(1);
  });

  it('invalid status transition is rejected (throws)', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const consumed = await consumeTrainingHandoff(prisma, {
      actorContext: { admin },
      handoffId: 'handoff-trn-1',
      idempotencyKey: 'trq-bad-status:1',
    });
    expect(consumed.ok).toBe(true);

    await expect(
      transitionTrainingRequestStatus(prisma, {
        actorContext: { admin },
        trainingRequestId: consumed.request.id,
        toStatus: 'CONVERTED_TO_PROGRAM',
      })
    ).rejects.toThrow(/invalid_status_transition/i);
  });

  it('Request without Customer/Tenant/Subscription fails validation', async () => {
    const prisma = makePrisma({
      _handoffStore: [
        {
          id: 'handoff-incomplete',
          conversionId: 'cvn-2',
          tenantId: null,
          handoffType: 'TRAINING',
          status: 'EMITTED',
          executionStatus: 'NOT_STARTED',
          idempotencyKey: 'training-handoff:cvn-2',
          payloadJson: {
            type: 'CRM_TRAINING_HANDOFF',
            conversionId: 'cvn-2',
            trainingCompleted: false,
          },
          createdByAdminId: 'super-trn-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
    const admin = superAdmin();
    const consumed = await consumeTrainingHandoff(prisma, {
      actorContext: { admin },
      handoffId: 'handoff-incomplete',
      idempotencyKey: 'trq-incomplete:1',
      allowIncompletePins: true,
    });
    expect(consumed.ok).toBe(true);

    const validated = await validateTrainingRequest(prisma, {
      actorContext: { admin },
      trainingRequestId: consumed.request.id,
    });
    expect(validated.ok).toBe(false);
    expect(validated.error).toMatch(/customer|tenant|subscription/i);
  });

  it('curriculumVersionId pin is required for Program create', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const consumed = await consumeTrainingHandoff(prisma, {
      actorContext: { admin },
      handoffId: 'handoff-trn-1',
      idempotencyKey: 'trq-no-curr:1',
    });
    await validateTrainingRequest(prisma, {
      actorContext: { admin },
      trainingRequestId: consumed.request.id,
    });
    await acceptTrainingRequest(prisma, {
      actorContext: { admin },
      trainingRequestId: consumed.request.id,
    });

    const missing = await createCustomerTrainingProgram(prisma, {
      actorContext: { admin },
      trainingRequestId: consumed.request.id,
      targetStartDate: '2026-08-10',
      targetCompletionDate: '2026-09-01',
      ownerAssignments: { csOwnerAdminId: admin.id },
      idempotencyKey: 'trn-no-curr:1',
    });
    expect(missing.ok).toBe(false);
    expect(missing.error).toMatch(/curriculum/i);
    expect(prisma._programStore.length).toBe(0);
  });
});
