/**
 * Phase 21 Wave 1 — Handoff validate/accept + Project spine harden.
 * G21-01…G21-06: checksum UNKNOWN≠VALID; accept idempotent; supersession history;
 * Project ONB-/template pin/one active; invalid status throws; portfolio fail-closed by id.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeOnboardingHandoffChecksum } from '@/lib/admin/crm/conversions/onboardingHandoff.js';
import {
  ONBOARDING_REQUEST_NUMBER_RE,
  ONBOARDING_PROJECT_NUMBER_RE,
  ONBOARDING_HANDOFF_VALIDATION_STATUS,
  validateOnboardingHandoff,
  acceptOnboardingHandoff,
  createOnboardingProject,
  transitionOnboardingProjectStatus,
  ensureWave1StandardTemplateVersion,
  ONBOARDING_PROJECT_STATUS,
} from '@/lib/admin/customerSuccess/onboarding';

function superAdmin(id = 'super-p21-1') {
  return {
    id,
    role: 'Super Admin',
    permissions: {
      'systemAdmin.customerSuccess.read': true,
      'systemAdmin.customerSuccess.manageCases': true,
    },
  };
}

function csScopedAdmin(id = 'cs-p21-scoped') {
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
    type: 'CRM_ONBOARDING_HANDOFF',
    conversionId: 'cvn-p21-1',
    customerId: 'cust-p21-1',
    tenantId: 'tenant-p21-1',
    subscriptionId: 'sub-p21-1',
    contacts: [{ contactId: 'con-1', email: 'ada@example.com' }],
    commercialRefs: { acceptanceId: 'accp-p21-1' },
    pendingProvisioning: true,
    provisioningStatus: 'PENDING',
    onboardingCompleted: false,
    fabricatedComplete: false,
    executionComplete: false,
    ...overrides,
  };
}

function makeHandoff(overrides = {}) {
  const payload = handoffPayload(overrides.payloadJson || {});
  const checksumSha256 =
    overrides.checksumSha256 !== undefined
      ? overrides.checksumSha256
      : computeOnboardingHandoffChecksum(payload);
  return {
    id: 'handoff-p21-1',
    conversionId: 'cvn-p21-1',
    tenantId: 'tenant-p21-1',
    handoffType: 'ONBOARDING',
    status: 'SENT',
    executionStatus: 'NOT_STARTED',
    idempotencyKey: 'onboarding-handoff:cvn-p21-1',
    payloadJson: payload,
    checksumSha256,
    createdByAdminId: 'super-p21-1',
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
  const projectStore = overrides._projectStore || [];
  const projectHistoryStore = overrides._projectHistoryStore || [];
  const templateVersionStore = overrides._templateVersionStore || [];
  const handoffStore = overrides._handoffStore || [makeHandoff()];

  const prisma = {
    $transaction: vi.fn(async (fn) => fn(prisma)),
    _requestStore: requestStore,
    _projectStore: projectStore,
    _handoffStore: handoffStore,
    _templateVersionStore: templateVersionStore,
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
        if (where.status) {
          const st = where.status;
          if (st?.not) rows = rows.filter((r) => r.status !== st.not);
          else if (st?.in) rows = rows.filter((r) => st.in.includes(r.status));
          else rows = rows.filter((r) => r.status === st);
        }
        return rows[0] || null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...handoffStore];
        if (where.handoffType) {
          rows = rows.filter((r) => r.handoffType === where.handoffType);
        }
        if (where.conversionId) {
          rows = rows.filter((r) => r.conversionId === where.conversionId);
        }
        if (where.status?.in) {
          rows = rows.filter((r) => where.status.in.includes(r.status));
        } else if (where.status) {
          rows = rows.filter((r) => r.status === where.status);
        }
        return rows;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = handoffStore.find((r) => r.id === where.id);
        if (!row) throw new Error('handoff_not_found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    customerOnboardingRequest: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `onr-${requestStore.length + 1}`,
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
    customerOnboardingRequestStatusHistory: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `onrh-${requestHistoryStore.length + 1}`, ...data };
        requestHistoryStore.push(row);
        return row;
      }),
    },
    customerOnboardingProject: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `onb-${projectStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        projectStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return projectStore.find((r) => r.id === where.id) || null;
        if (where.onboardingNumber) {
          return projectStore.find((r) => r.onboardingNumber === where.onboardingNumber) || null;
        }
        if (where.idempotencyKey) {
          return projectStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        if (where.onboardingRequestId) {
          return (
            projectStore.find((r) => r.onboardingRequestId === where.onboardingRequestId) || null
          );
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...projectStore];
        if (where.onboardingRequestId) {
          rows = rows.filter((r) => r.onboardingRequestId === where.onboardingRequestId);
        }
        if (where.handoffId) {
          rows = rows.filter((r) => r.handoffId === where.handoffId);
        }
        if (where.customerId) {
          rows = rows.filter((r) => r.customerId === where.customerId);
        }
        if (where.tenantId) {
          rows = rows.filter((r) => r.tenantId === where.tenantId);
        }
        if (where.status?.notIn) {
          rows = rows.filter((r) => !where.status.notIn.includes(r.status));
        } else if (where.status?.in) {
          rows = rows.filter((r) => where.status.in.includes(r.status));
        } else if (where.status?.not) {
          rows = rows.filter((r) => r.status !== where.status.not);
        } else if (where.status) {
          rows = rows.filter((r) => r.status === where.status);
        }
        if (where.AND) {
          for (const clause of where.AND) {
            if (clause.status?.notIn) {
              rows = rows.filter((r) => !clause.status.notIn.includes(r.status));
            }
            if (clause.id?.not) {
              rows = rows.filter((r) => r.id !== clause.id.not);
            }
          }
        }
        return rows[0] || null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...projectStore];
        if (where.tenantId?.in) {
          rows = rows.filter((r) => where.tenantId.in.includes(r.tenantId));
        } else if (where.tenantId) {
          rows = rows.filter((r) => r.tenantId === where.tenantId);
        }
        return rows;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = projectStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    customerOnboardingProjectStatusHistory: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `onbh-${projectHistoryStore.length + 1}`, ...data };
        projectHistoryStore.push(row);
        return row;
      }),
    },
    customerOnboardingTemplateVersion: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `tmplv-${templateVersionStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        templateVersionStore.push(row);
        return row;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...templateVersionStore];
        if (where.onboardingType) {
          rows = rows.filter((r) => r.onboardingType === where.onboardingType);
        }
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        if (where.templateCode) {
          rows = rows.filter((r) => r.templateCode === where.templateCode);
        }
        return rows[0] || null;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return templateVersionStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = templateVersionStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data);
        return row;
      }),
    },
  };

  return prisma;
}

describe('Phase 21 Wave 1 — Handoff validate/accept + Project spine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes UNKNOWN validation status and UNKNOWN ≠ VALID', () => {
    expect(ONBOARDING_HANDOFF_VALIDATION_STATUS.UNKNOWN).toBe('UNKNOWN');
    expect(ONBOARDING_HANDOFF_VALIDATION_STATUS.VALID).toBe('VALID');
    expect(ONBOARDING_HANDOFF_VALIDATION_STATUS.UNKNOWN).not.toBe(
      ONBOARDING_HANDOFF_VALIDATION_STATUS.VALID
    );
  });

  it('missing checksum yields UNKNOWN (never VALID)', async () => {
    const prisma = makePrisma({
      _handoffStore: [makeHandoff({ checksumSha256: null })],
    });
    const result = await validateOnboardingHandoff(prisma, {
      actorContext: { admin: superAdmin() },
      handoffId: 'handoff-p21-1',
    });
    expect(result.ok).toBe(false);
    expect(result.validationStatus).toBe(ONBOARDING_HANDOFF_VALIDATION_STATUS.UNKNOWN);
    expect(result.validationStatus).not.toBe(ONBOARDING_HANDOFF_VALIDATION_STATUS.VALID);
    expect(result.checksumValid).not.toBe(true);
  });

  it('checksum mismatch is not VALID; matching checksum is VALID', async () => {
    const bad = makePrisma({
      _handoffStore: [makeHandoff({ checksumSha256: 'a'.repeat(64) })],
    });
    const mismatch = await validateOnboardingHandoff(bad, {
      actorContext: { admin: superAdmin() },
      handoffId: 'handoff-p21-1',
    });
    expect(mismatch.ok).toBe(false);
    expect(mismatch.validationStatus).not.toBe(ONBOARDING_HANDOFF_VALIDATION_STATUS.VALID);
    expect(mismatch.validationStatus).not.toBe(
      ONBOARDING_HANDOFF_VALIDATION_STATUS.VALID_WITH_WARNINGS
    );

    const good = makePrisma();
    const valid = await validateOnboardingHandoff(good, {
      actorContext: { admin: superAdmin() },
      handoffId: 'handoff-p21-1',
    });
    expect(valid.ok).toBe(true);
    expect([
      ONBOARDING_HANDOFF_VALIDATION_STATUS.VALID,
      ONBOARDING_HANDOFF_VALIDATION_STATUS.VALID_WITH_WARNINGS,
    ]).toContain(valid.validationStatus);
    expect(valid.checksumValid).toBe(true);
  });

  it('acceptOnboardingHandoff validates checksum, creates ONR, marks ACCEPTED_BY_ONBOARDING', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const result = await acceptOnboardingHandoff(prisma, {
      actorContext: { admin },
      handoffId: 'handoff-p21-1',
      acceptanceNotes: 'Wave1 accept',
      idempotencyKey: 'accept-p21:1',
    });
    expect(result.ok).toBe(true);
    expect(result.request.requestNumber).toMatch(ONBOARDING_REQUEST_NUMBER_RE);
    expect(result.request.handoffId).toBe('handoff-p21-1');
    expect(result.onboardingCompleted).not.toBe(true);
    expect(result.projectCreated).not.toBe(true);
    expect(String(prisma._handoffStore[0].status).toUpperCase()).toBe('ACCEPTED_BY_ONBOARDING');
    expect(result.checksumValid).toBe(true);
    expect(result.validationStatus).not.toBe(ONBOARDING_HANDOFF_VALIDATION_STATUS.UNKNOWN);
  });

  it('accept exact retry returns same result; conflicting idempotency fails', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const args = {
      actorContext: { admin },
      handoffId: 'handoff-p21-1',
      acceptanceNotes: 'Wave1 accept',
      idempotencyKey: 'accept-p21:exact',
    };
    const first = await acceptOnboardingHandoff(prisma, args);
    expect(first.ok).toBe(true);
    const second = await acceptOnboardingHandoff(prisma, args);
    expect(second.ok).toBe(true);
    expect(second.alreadyExists || second.idempotentReplay || second.alreadyAccepted).toBe(true);
    expect(second.request.id).toBe(first.request.id);
    expect(prisma._requestStore.length).toBe(1);

    const conflict = await acceptOnboardingHandoff(prisma, {
      actorContext: { admin },
      handoffId: 'handoff-p21-1',
      acceptanceNotes: 'different notes payload',
      idempotencyKey: 'accept-p21:exact',
      // Force different acceptance input via expectedVersion mismatch path is separate;
      // conflicting key with different handoffId should fail when key reused differently.
      _forceConflictProbe: true,
    });
    // Same handoff + same key = exact retry (already covered). Use a second handoff with same key.
    const payload2 = handoffPayload({
      conversionId: 'cvn-p21-2',
      customerId: 'cust-p21-2',
      subscriptionId: 'sub-p21-2',
    });
    prisma._handoffStore.push(
      makeHandoff({
        id: 'handoff-p21-2',
        conversionId: 'cvn-p21-2',
        idempotencyKey: 'onboarding-handoff:cvn-p21-2',
        payloadJson: payload2,
        checksumSha256: computeOnboardingHandoffChecksum(payload2),
      })
    );
    const keyConflict = await acceptOnboardingHandoff(prisma, {
      actorContext: { admin },
      handoffId: 'handoff-p21-2',
      acceptanceNotes: 'other handoff',
      idempotencyKey: 'accept-p21:exact',
    });
    expect(keyConflict.ok).toBe(false);
    expect(keyConflict.error).toMatch(/conflict|idempotency/i);
    expect(conflict).toBeTruthy(); // keep probe binding used
  });

  it('accept refuses UNKNOWN checksum; does not mark accepted', async () => {
    const prisma = makePrisma({
      _handoffStore: [makeHandoff({ checksumSha256: null })],
    });
    const result = await acceptOnboardingHandoff(prisma, {
      actorContext: { admin: superAdmin() },
      handoffId: 'handoff-p21-1',
      idempotencyKey: 'accept-p21:unknown',
    });
    expect(result.ok).toBe(false);
    expect(result.validationStatus).toBe(ONBOARDING_HANDOFF_VALIDATION_STATUS.UNKNOWN);
    expect(result.validationStatus).not.toBe(ONBOARDING_HANDOFF_VALIDATION_STATUS.VALID);
    expect(String(prisma._handoffStore[0].status).toUpperCase()).not.toBe(
      'ACCEPTED_BY_ONBOARDING'
    );
    expect(prisma._requestStore.length).toBe(0);
  });

  it('correction/supersession preserves history on accept path', async () => {
    const priorPayload = handoffPayload({
      contacts: [{ contactId: 'con-1', email: 'old@example.com' }],
    });
    const prior = makeHandoff({
      id: 'handoff-p21-old',
      status: 'SUPERSEDED',
      checksumSha256: computeOnboardingHandoffChecksum(priorPayload),
      payloadJson: {
        ...priorPayload,
        supersededAt: '2026-07-30T12:00:00.000Z',
        supersededByHandoffId: 'handoff-p21-1',
        supersessionReason: 'email_typo',
      },
    });
    const activePayload = handoffPayload({
      contacts: [{ contactId: 'con-1', email: 'ada.corrected@example.com' }],
      supersessionHistory: [
        {
          handoffId: 'handoff-p21-old',
          supersededAt: '2026-07-30T12:00:00.000Z',
          reason: 'email_typo',
        },
      ],
      supersedesHandoffId: 'handoff-p21-old',
    });
    const active = makeHandoff({
      id: 'handoff-p21-1',
      payloadJson: activePayload,
      checksumSha256: computeOnboardingHandoffChecksum(activePayload),
    });
    const prisma = makePrisma({ _handoffStore: [prior, active] });

    const accepted = await acceptOnboardingHandoff(prisma, {
      actorContext: { admin: superAdmin() },
      handoffId: 'handoff-p21-1',
      idempotencyKey: 'accept-p21:correction',
    });
    expect(accepted.ok).toBe(true);

    const priorAfter = prisma._handoffStore.find((h) => h.id === 'handoff-p21-old');
    expect(priorAfter.status).toBe('SUPERSEDED');
    expect(priorAfter.payloadJson?.supersededByHandoffId).toBe('handoff-p21-1');
    expect(priorAfter.payloadJson?.contacts?.[0]?.email).toBe('old@example.com');

    const activeAfter = prisma._handoffStore.find((h) => h.id === 'handoff-p21-1');
    expect(activeAfter.status).toBe('ACCEPTED_BY_ONBOARDING');
    expect(Array.isArray(activeAfter.payloadJson?.supersessionHistory)).toBe(true);
    expect(activeAfter.payloadJson.supersessionHistory.length).toBeGreaterThanOrEqual(1);

    const refuseSuperseded = await acceptOnboardingHandoff(prisma, {
      actorContext: { admin: superAdmin() },
      handoffId: 'handoff-p21-old',
      idempotencyKey: 'accept-p21:superseded',
    });
    expect(refuseSuperseded.ok).toBe(false);
    expect(refuseSuperseded.error).toMatch(/superseded/i);
  });

  it('Project create after accept: ONB- number, template pin, one active; conflict fails', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const tmpl = await ensureWave1StandardTemplateVersion(prisma, {
      actorContext: { admin },
    });
    expect(tmpl.ok).toBe(true);
    expect(tmpl.templateVersion.status).toBe('ACTIVE');
    expect(tmpl.templateVersion.immutable !== false).toBe(true);

    const accepted = await acceptOnboardingHandoff(prisma, {
      actorContext: { admin },
      handoffId: 'handoff-p21-1',
      idempotencyKey: 'accept-p21:proj',
    });
    expect(accepted.ok).toBe(true);

    // Accept alone must not create Project
    expect(prisma._projectStore.length).toBe(0);

    // Need Request ACCEPTED before Project — accept handoff creates Request; accept request if needed
    const { acceptOnboardingRequest, validateOnboardingRequest } = await import(
      '@/lib/admin/customerSuccess/onboarding'
    );
    await validateOnboardingRequest(prisma, {
      actorContext: { admin },
      onboardingRequestId: accepted.request.id,
    });
    await acceptOnboardingRequest(prisma, {
      actorContext: { admin },
      onboardingRequestId: accepted.request.id,
    });

    const project = await createOnboardingProject(prisma, {
      actorContext: { admin },
      onboardingRequestId: accepted.request.id,
      onboardingTemplateVersionId: tmpl.templateVersion.id,
      targetKickoffDate: '2026-08-10',
      targetGoLiveDate: '2026-09-01',
      ownerAssignments: { csOwnerAdminId: admin.id },
      idempotencyKey: 'onb-p21:1',
    });
    expect(project.ok).toBe(true);
    expect(project.project.onboardingNumber).toMatch(ONBOARDING_PROJECT_NUMBER_RE);
    expect(project.project.templateVersionId).toBe(tmpl.templateVersion.id);
    expect(prisma._projectStore.length).toBe(1);

    const conflict = await createOnboardingProject(prisma, {
      actorContext: { admin },
      onboardingRequestId: accepted.request.id,
      onboardingTemplateVersionId: tmpl.templateVersion.id,
      targetKickoffDate: '2026-08-20',
      targetGoLiveDate: '2026-10-01',
      ownerAssignments: { csOwnerAdminId: 'other' },
      idempotencyKey: 'onb-p21:1',
    });
    expect(conflict.ok).toBe(false);
    expect(conflict.error).toMatch(/conflict|idempotency/i);

    // Second active Project for same handoff/customer must fail
    const req2 = await prisma.customerOnboardingRequest.create({
      data: {
        id: 'onr-second',
        requestNumber: 'ONR-2026-000099',
        status: 'ACCEPTED',
        customerId: 'cust-p21-1',
        tenantId: 'tenant-p21-1',
        subscriptionId: 'sub-p21-1',
        handoffId: 'handoff-p21-1',
        onboardingType: 'STANDARD',
      },
    });
    const dupActive = await createOnboardingProject(prisma, {
      actorContext: { admin },
      onboardingRequestId: req2.id,
      onboardingTemplateVersionId: tmpl.templateVersion.id,
      targetKickoffDate: '2026-08-10',
      targetGoLiveDate: '2026-09-01',
      ownerAssignments: { csOwnerAdminId: admin.id },
      idempotencyKey: 'onb-p21:dup-active',
    });
    expect(dupActive.ok).toBe(false);
    expect(dupActive.error).toMatch(/active.?project|duplicate.?active/i);
  });

  it('invalid project status transitions throw (DRAFT→COMPLETED, PLANNING→go-live complete)', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const tmpl = await ensureWave1StandardTemplateVersion(prisma, {
      actorContext: { admin },
    });
    const accepted = await acceptOnboardingHandoff(prisma, {
      actorContext: { admin },
      handoffId: 'handoff-p21-1',
      idempotencyKey: 'accept-p21:status',
    });
    const { acceptOnboardingRequest, validateOnboardingRequest } = await import(
      '@/lib/admin/customerSuccess/onboarding'
    );
    await validateOnboardingRequest(prisma, {
      actorContext: { admin },
      onboardingRequestId: accepted.request.id,
    });
    await acceptOnboardingRequest(prisma, {
      actorContext: { admin },
      onboardingRequestId: accepted.request.id,
    });
    const created = await createOnboardingProject(prisma, {
      actorContext: { admin },
      onboardingRequestId: accepted.request.id,
      onboardingTemplateVersionId: tmpl.templateVersion.id,
      targetKickoffDate: '2026-08-10',
      targetGoLiveDate: '2026-09-01',
      ownerAssignments: { csOwnerAdminId: admin.id },
      idempotencyKey: 'onb-p21:status',
    });
    expect(created.ok).toBe(true);
    expect(created.project.status).toBe(ONBOARDING_PROJECT_STATUS.DRAFT);

    await expect(
      transitionOnboardingProjectStatus(prisma, {
        actorContext: { admin },
        onboardingProjectId: created.project.id,
        toStatus: ONBOARDING_PROJECT_STATUS.COMPLETED,
      })
    ).rejects.toThrow(/invalid_status_transition/i);

    prisma._projectStore[0].status = ONBOARDING_PROJECT_STATUS.PLANNING;
    await expect(
      transitionOnboardingProjectStatus(prisma, {
        actorContext: { admin },
        onboardingProjectId: created.project.id,
        toStatus: ONBOARDING_PROJECT_STATUS.COMPLETED,
      })
    ).rejects.toThrow(/invalid_status_transition/i);

    await expect(
      transitionOnboardingProjectStatus(prisma, {
        actorContext: { admin },
        onboardingProjectId: created.project.id,
        toStatus: ONBOARDING_PROJECT_STATUS.LIVE,
      })
    ).rejects.toThrow(/invalid_status_transition/i);
  });

  it('portfolio fail-closed on accept/create by id for scoped CS', async () => {
    const prisma = makePrisma();
    const scoped = csScopedAdmin();

    const deniedAccept = await acceptOnboardingHandoff(prisma, {
      actorContext: { admin: scoped },
      handoffId: 'handoff-p21-1',
      idempotencyKey: 'accept-p21:scope',
      portfolioTenantIds: ['tenant-other'],
    });
    expect(deniedAccept.ok).toBe(false);
    expect(deniedAccept.forbidden || deniedAccept.notFound).toBe(true);
    expect(deniedAccept.error || deniedAccept.reason).toMatch(/scope|portfolio|forbidden/i);
    expect(prisma._requestStore.length).toBe(0);

    const emptyScope = await acceptOnboardingHandoff(prisma, {
      actorContext: { admin: scoped },
      handoffId: 'handoff-p21-1',
      idempotencyKey: 'accept-p21:empty-scope',
      portfolioTenantIds: [],
    });
    expect(emptyScope.ok).toBe(false);
    expect(emptyScope.forbidden || emptyScope.notFound || emptyScope.error).toBeTruthy();

    // In-scope accept then Project create out of portfolio must fail
    const admin = superAdmin();
    const tmpl = await ensureWave1StandardTemplateVersion(prisma, {
      actorContext: { admin },
    });
    const accepted = await acceptOnboardingHandoff(prisma, {
      actorContext: { admin },
      handoffId: 'handoff-p21-1',
      idempotencyKey: 'accept-p21:then-scope-proj',
    });
    const { acceptOnboardingRequest, validateOnboardingRequest } = await import(
      '@/lib/admin/customerSuccess/onboarding'
    );
    await validateOnboardingRequest(prisma, {
      actorContext: { admin },
      onboardingRequestId: accepted.request.id,
    });
    await acceptOnboardingRequest(prisma, {
      actorContext: { admin },
      onboardingRequestId: accepted.request.id,
    });

    const deniedCreate = await createOnboardingProject(prisma, {
      actorContext: { admin: scoped },
      onboardingRequestId: accepted.request.id,
      onboardingTemplateVersionId: tmpl.templateVersion.id,
      targetKickoffDate: '2026-08-10',
      targetGoLiveDate: '2026-09-01',
      ownerAssignments: { csOwnerAdminId: scoped.id },
      idempotencyKey: 'onb-p21:out-of-scope',
      portfolioTenantIds: ['tenant-other'],
    });
    expect(deniedCreate.ok).toBe(false);
    expect(deniedCreate.forbidden || deniedCreate.notFound).toBe(true);
    expect(deniedCreate.error || deniedCreate.reason).toMatch(/scope|portfolio|forbidden/i);
  });
});
