/**
 * Phase 18 Wave 4 — UI hubs, metrics/reliability, DQ/recon, reports, Phase 8 migrate, i18n.
 * Gate fail → UNAVAILABLE / value: null (never false zero).
 * Portfolio My Work excludes other CS owners; search excludes inaccessible TRQ/TRN;
 * export strips answers/tokens; Phase 8 linked record projects Program status;
 * EN+NY key smoke; certificate still idempotent.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  applyTrainingReportHonesty,
  TRAINING_REPORT_STATUS,
  getTrainingMetric,
  getTrainingOverviewCards,
  getTrainingMyWork,
  getTrainingLineage,
  searchTrainingIndex,
  exportTrainingReport,
  runTrainingDataQuality,
  runTrainingReconciliation,
  migratePhase8TrainingRecords,
  getFoundationStatusWithProgram,
  issueTrainingCertificate,
  getTrainingDomainContract,
  listTrainingPrograms,
  listAssessmentAttempts,
} from '@/lib/admin/customerSuccess/training';
import { getFoundationStatus } from '@/lib/admin/customerSuccess/foundations.js';

function superAdmin(id = 'super-trn-4') {
  return {
    id,
    role: 'Super Admin',
    permissions: {
      'systemAdmin.customerSuccess.read': true,
      'systemAdmin.customerSuccess.manageCases': true,
    },
  };
}

function csAgent(id = 'cs-agent-a') {
  return {
    id,
    role: 'System Admin',
    permissions: {
      'systemAdmin.customerSuccess.read': true,
      'systemAdmin.customerSuccess.manageCases': true,
    },
  };
}

function csViewerOnly(id = 'cs-viewer-only') {
  return {
    id,
    role: 'System Admin',
    permissions: {
      'systemAdmin.customerSuccess.read': true,
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
      if (where.programId) {
        return store.find((r) => r.programId === where.programId) || null;
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
      if (where.programId) rows = rows.filter((r) => r.programId === where.programId);
      if (where.idempotencyKey) {
        rows = rows.filter((r) => r.idempotencyKey === where.idempotencyKey);
      }
      if (where.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);
      if (where.trainingProgramId) {
        rows = rows.filter((r) => r.trainingProgramId === where.trainingProgramId);
      }
      return rows[0] || null;
    }),
    findMany: vi.fn(async ({ where = {} } = {}) => {
      let rows = [...store];
      if (where.programId) rows = rows.filter((r) => r.programId === where.programId);
      if (where.tenantId) {
        if (where.tenantId.in) {
          rows = rows.filter((r) => where.tenantId.in.includes(r.tenantId));
        } else {
          rows = rows.filter((r) => r.tenantId === where.tenantId);
        }
      }
      if (where.customerId) rows = rows.filter((r) => r.customerId === where.customerId);
      if (where.trainingProgramId === null) {
        rows = rows.filter((r) => r.trainingProgramId == null);
      }
      if (where.status) rows = rows.filter((r) => r.status === where.status);
      if (where.OR) {
        rows = rows.filter((r) =>
          where.OR.some((clause) => {
            if (clause.programNumber?.contains) {
              return String(r.programNumber || '').includes(clause.programNumber.contains);
            }
            if (clause.requestNumber?.contains) {
              return String(r.requestNumber || '').includes(clause.requestNumber.contains);
            }
            if (clause.certificateNumber?.contains) {
              return String(r.certificateNumber || '').includes(
                clause.certificateNumber.contains
              );
            }
            if (clause.csOwnerAdminId) return r.csOwnerAdminId === clause.csOwnerAdminId;
            if (clause.ownerAdminId) return r.ownerAdminId === clause.ownerAdminId;
            return false;
          })
        );
      }
      return rows;
    }),
    update: vi.fn(async ({ where = {}, data = {} } = {}) => {
      const row = store.find((r) => r.id === where.id);
      if (!row) throw new Error('not found');
      Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
      return row;
    }),
    count: vi.fn(async ({ where = {} } = {}) => {
      let rows = [...store];
      if (where.programId) rows = rows.filter((r) => r.programId === where.programId);
      if (where.tenantId) {
        if (where.tenantId.in) {
          rows = rows.filter((r) => where.tenantId.in.includes(r.tenantId));
        } else {
          rows = rows.filter((r) => r.tenantId === where.tenantId);
        }
      }
      if (where.status) rows = rows.filter((r) => r.status === where.status);
      if (where.csOwnerAdminId) {
        rows = rows.filter((r) => r.csOwnerAdminId === where.csOwnerAdminId);
      }
      if (where.ownerAdminId) {
        rows = rows.filter((r) => r.ownerAdminId === where.ownerAdminId);
      }
      if (where.OR) {
        rows = rows.filter((r) =>
          where.OR.some((clause) => {
            if (clause.csOwnerAdminId) return r.csOwnerAdminId === clause.csOwnerAdminId;
            if (clause.ownerAdminId) return r.ownerAdminId === clause.ownerAdminId;
            return Object.entries(clause).every(([k, v]) => r[k] === v);
          })
        );
      }
      return rows.length;
    }),
  };
}

function makePrisma(overrides = {}) {
  const programStore = overrides._programStore || [];
  const requestStore = overrides._requestStore || [];
  const certificateStore = overrides._certificateStore || [];
  const completionStore = overrides._completionStore || [];
  const csTrainingStore = overrides._csTrainingStore || [];
  const seqStore = overrides._seqStore || [];

  const prisma = {
    $transaction: vi.fn(async (fn) => fn(prisma)),
    _programStore: programStore,
    _requestStore: requestStore,
    _certificateStore: certificateStore,
    _completionStore: completionStore,
    _csTrainingStore: csTrainingStore,
    _seqStore: seqStore,
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
      ...makeStoreCrud(programStore, 'trn'),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `trn-${programStore.length + 1}`,
          status: data.status || 'IN_PROGRESS',
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
        return null;
      }),
      count: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...programStore];
        if (where.tenantId) {
          if (where.tenantId.in) {
            rows = rows.filter((r) => where.tenantId.in.includes(r.tenantId));
          } else {
            rows = rows.filter((r) => r.tenantId === where.tenantId);
          }
        }
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        if (where.csOwnerAdminId) {
          rows = rows.filter((r) => r.csOwnerAdminId === where.csOwnerAdminId);
        }
        if (where.ownerAdminId) {
          rows = rows.filter((r) => r.ownerAdminId === where.ownerAdminId);
        }
        if (where.OR) {
          rows = rows.filter((r) =>
            where.OR.some((clause) => {
              if (clause.csOwnerAdminId) return r.csOwnerAdminId === clause.csOwnerAdminId;
              if (clause.ownerAdminId) return r.ownerAdminId === clause.ownerAdminId;
              return Object.entries(clause).every(([k, v]) => r[k] === v);
            })
          );
        }
        return rows.length;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...programStore];
        if (where.tenantId) {
          if (where.tenantId.in) {
            rows = rows.filter((r) => where.tenantId.in.includes(r.tenantId));
          } else {
            rows = rows.filter((r) => r.tenantId === where.tenantId);
          }
        }
        if (where.customerId) rows = rows.filter((r) => r.customerId === where.customerId);
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        if (where.OR) {
          rows = rows.filter((r) =>
            where.OR.some((clause) => {
              if (clause.programNumber?.contains) {
                return String(r.programNumber || '').includes(clause.programNumber.contains);
              }
              if (clause.csOwnerAdminId) return r.csOwnerAdminId === clause.csOwnerAdminId;
              if (clause.ownerAdminId) return r.ownerAdminId === clause.ownerAdminId;
              return false;
            })
          );
        }
        return rows;
      }),
    },
    customerTrainingRequest: {
      ...makeStoreCrud(requestStore, 'trq'),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...requestStore];
        if (where.tenantId) {
          if (where.tenantId.in) {
            rows = rows.filter((r) => where.tenantId.in.includes(r.tenantId));
          } else {
            rows = rows.filter((r) => r.tenantId === where.tenantId);
          }
        }
        if (where.OR) {
          rows = rows.filter((r) =>
            where.OR.some((clause) => {
              if (clause.requestNumber?.contains) {
                return String(r.requestNumber || '').includes(clause.requestNumber.contains);
              }
              return false;
            })
          );
        }
        return rows;
      }),
    },
    customerTrainingCertificate: {
      ...makeStoreCrud(certificateStore, 'cert'),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return certificateStore.find((r) => r.id === where.id) || null;
        if (where.idempotencyKey) {
          return (
            certificateStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null
          );
        }
        if (where.certificateNumber) {
          return (
            certificateStore.find((r) => r.certificateNumber === where.certificateNumber) ||
            null
          );
        }
        if (where.verificationCode) {
          return (
            certificateStore.find((r) => r.verificationCode === where.verificationCode) ||
            null
          );
        }
        return null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...certificateStore];
        if (where.programId) {
          if (where.programId.in) {
            rows = rows.filter((r) => where.programId.in.includes(r.programId));
          } else {
            rows = rows.filter((r) => r.programId === where.programId);
          }
        }
        if (where.OR) {
          rows = rows.filter((r) =>
            where.OR.some((clause) => {
              if (clause.certificateNumber?.contains) {
                return String(r.certificateNumber || '').includes(
                  clause.certificateNumber.contains
                );
              }
              return false;
            })
          );
        }
        return rows;
      }),
    },
    customerTrainingParticipantCompletion: {
      ...makeStoreCrud(completionStore, 'pcomp'),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return completionStore.find((r) => r.id === where.id) || null;
        return null;
      }),
    },
    csTrainingRecord: {
      ...makeStoreCrud(csTrainingStore, 'cstr'),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...csTrainingStore];
        if (where.tenantId) {
          if (where.tenantId.in) {
            rows = rows.filter((r) => where.tenantId.in.includes(r.tenantId));
          } else {
            rows = rows.filter((r) => r.tenantId === where.tenantId);
          }
        }
        if (where.trainingProgramId === null) {
          rows = rows.filter((r) => r.trainingProgramId == null);
        }
        return rows;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = csTrainingStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
  };

  return prisma;
}

describe('Phase 18 Wave 4 — metrics / reliability / hubs / Phase 8 / i18n', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reliability gate fail → UNAVAILABLE / value null — never false zero', async () => {
    const honesty = applyTrainingReportHonesty({
      modelAvailable: false,
      permissionOk: true,
      queryOk: true,
    });
    expect(honesty.kpiSafe).toBe(false);
    expect(honesty.status).toBe(TRAINING_REPORT_STATUS.UNAVAILABLE);
    expect(honesty.inventZeroesForbidden).toBe(true);
    expect(honesty.falseZeroes).toBe(false);

    const broken = makePrisma();
    broken.customerTrainingProgram.count = vi.fn(async () => {
      throw new Error('db down');
    });

    const metric = await getTrainingMetric(broken, {
      admin: superAdmin(),
      metric: 'program_count',
    });
    expect(metric.status).toBe(TRAINING_REPORT_STATUS.UNAVAILABLE);
    expect(metric.value).toBeNull();
    expect(metric.value).not.toBe(0);

    const cards = await getTrainingOverviewCards(broken, {
      admin: superAdmin(),
    });
    expect(cards.status).toBe(TRAINING_REPORT_STATUS.UNAVAILABLE);
    const values = Object.values(cards.cards || {}).map((c) => c?.value);
    for (const v of values) {
      expect(v).not.toBe(0);
      expect(v === null || v === undefined).toBe(true);
    }
  });

  it('metrics/overview counts are portfolio-scoped (not global) for CS agents', async () => {
    const prisma = makePrisma();
    const agent = csAgent('cs-agent-metrics');

    await prisma.customerTrainingProgram.create({
      data: {
        id: 'trn-m-owned',
        programNumber: 'TRN-2026-000450',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-owned',
        customerId: 'cust-a',
        csOwnerAdminId: agent.id,
      },
    });
    await prisma.customerTrainingProgram.create({
      data: {
        id: 'trn-m-other',
        programNumber: 'TRN-2026-000451',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-other',
        customerId: 'cust-b',
        csOwnerAdminId: 'cs-agent-b',
      },
    });

    const unscoped = await getTrainingMetric(prisma, {
      admin: agent,
      metric: 'program_count',
    });
    expect(unscoped.value).toBeNull();
    expect(unscoped.status).toBe(TRAINING_REPORT_STATUS.UNAVAILABLE);
    expect(unscoped.meta?.failClosed || unscoped.reason).toBeTruthy();

    const scoped = await getTrainingMetric(prisma, {
      admin: agent,
      metric: 'program_count',
      portfolioTenantIds: ['tenant-owned'],
    });
    expect(scoped.ok).toBe(true);
    expect(scoped.value).toBe(1);

    const cards = await getTrainingOverviewCards(prisma, {
      admin: agent,
      portfolioTenantIds: ['tenant-owned'],
    });
    expect(cards.ok).toBe(true);
    expect(cards.cards.inProgress.value).toBe(1);

    const listDenied = await listTrainingPrograms(prisma, {
      admin: agent,
    });
    expect(listDenied.ok).toBe(true);
    expect(listDenied.programs).toEqual([]);
    expect(listDenied.meta?.failClosed || listDenied.reason).toBeTruthy();
  });

  it('My Work portfolio scope excludes other CS owner programs', async () => {
    const prisma = makePrisma();
    const agentA = csAgent('cs-agent-a');
    const agentB = csAgent('cs-agent-b');

    await prisma.customerTrainingProgram.create({
      data: {
        id: 'trn-mine',
        programNumber: 'TRN-2026-000401',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-a',
        customerId: 'cust-a',
        csOwnerAdminId: agentA.id,
        ownerAdminId: agentA.id,
      },
    });
    await prisma.customerTrainingProgram.create({
      data: {
        id: 'trn-other',
        programNumber: 'TRN-2026-000402',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-b',
        customerId: 'cust-b',
        csOwnerAdminId: agentB.id,
        ownerAdminId: agentB.id,
      },
    });

    const closed = await getTrainingMyWork(prisma, {
      admin: agentA,
      actorContext: { admin: agentA },
    });
    expect(closed.status).toBe(TRAINING_REPORT_STATUS.UNAVAILABLE);
    expect(closed.count).toBeNull();
    expect(closed.meta?.failClosed || closed.reason).toBeTruthy();

    const mine = await getTrainingMyWork(prisma, {
      admin: agentA,
      actorContext: { admin: agentA },
      portfolioTenantIds: ['tenant-a', 'tenant-b', 'tenant-c'],
    });
    expect(mine.ok).toBe(true);
    expect(mine.count).toBe(1);
    expect(mine.programs.every((p) => p.id === 'trn-mine')).toBe(true);
    expect(mine.programs.some((p) => p.id === 'trn-other')).toBe(false);

    await prisma.customerTrainingProgram.create({
      data: {
        id: 'trn-json-only',
        programNumber: 'TRN-2026-000403',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-c',
        customerId: 'cust-c',
        ownerAssignmentsJson: { csOwnerAdminId: agentA.id, ownerAdminId: agentA.id },
      },
    });
    const afterJsonOnly = await getTrainingMyWork(prisma, {
      admin: agentA,
      actorContext: { admin: agentA },
      portfolioTenantIds: ['tenant-a', 'tenant-b', 'tenant-c'],
    });
    expect(afterJsonOnly.programs.some((p) => p.id === 'trn-json-only')).toBe(false);
    expect(afterJsonOnly.count).toBe(1);

    // Owner pin alone must not leak programs outside portfolio.
    const crossPortfolio = await getTrainingMyWork(prisma, {
      admin: agentA,
      actorContext: { admin: agentA },
      portfolioTenantIds: ['tenant-other-only'],
    });
    expect(crossPortfolio.ok).toBe(true);
    expect(crossPortfolio.count).toBe(0);
    expect(crossPortfolio.programs).toEqual([]);
  });

  it('search excludes inaccessible TRN and never returns answers/tokens/restricted materials', async () => {
    const prisma = makePrisma();
    const agentA = csAgent('cs-agent-a');

    await prisma.customerTrainingProgram.create({
      data: {
        id: 'trn-vis',
        programNumber: 'TRN-2026-000410',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-owned',
        customerId: 'cust-1',
        csOwnerAdminId: agentA.id,
        answerPayload: { q1: 'SECRET_ANSWER' },
        accessToken: 'tok-secret-xyz',
        restrictedMaterialBody: 'RESTRICTED_BANK',
      },
    });
    await prisma.customerTrainingProgram.create({
      data: {
        id: 'trn-hid',
        programNumber: 'TRN-2026-000411',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-other',
        customerId: 'cust-2',
        csOwnerAdminId: 'cs-agent-b',
      },
    });

    const scoped = await searchTrainingIndex(prisma, {
      admin: agentA,
      query: 'TRN-2026',
      portfolioTenantIds: ['tenant-owned'],
    });
    expect(scoped.ok).toBe(true);
    const ids = (scoped.results || []).map((r) => r.id);
    expect(ids).toContain('trn-vis');
    expect(ids).not.toContain('trn-hid');
    const payload = JSON.stringify(scoped.results);
    expect(payload).not.toMatch(/SECRET_ANSWER|tok-secret|RESTRICTED_BANK|answerPayload|accessToken/i);

    const omitted = await searchTrainingIndex(prisma, {
      admin: agentA,
      query: 'TRN-2026',
    });
    expect(omitted.ok).toBe(true);
    expect(omitted.results).toEqual([]);
    expect(omitted.meta?.failClosed || omitted.reason).toBeTruthy();
    expect((omitted.results || []).map((r) => r.id)).not.toContain('trn-hid');
    expect((omitted.results || []).map((r) => r.id)).not.toContain('trn-vis');

    const emptyScope = await searchTrainingIndex(prisma, {
      admin: agentA,
      query: 'TRN-2026',
      portfolioTenantIds: [],
    });
    expect(emptyScope.ok).toBe(true);
    expect(emptyScope.results).toEqual([]);
    expect(emptyScope.meta?.failClosed).toBe(true);

    // Certificate search must apply the same portfolio/tenant fail-closed scope
    // (certs have no tenantId — scoped via programId → program.tenantId).
    await prisma.customerTrainingCertificate.create({
      data: {
        id: 'cert-vis',
        certificateNumber: 'CERT-2026-000010',
        programId: 'trn-vis',
        status: 'ISSUED',
        checksum: 'chk-vis',
        verificationCode: 'ver-vis',
      },
    });
    await prisma.customerTrainingCertificate.create({
      data: {
        id: 'cert-hid',
        certificateNumber: 'CERT-2026-000011',
        programId: 'trn-hid',
        status: 'ISSUED',
        checksum: 'chk-hid',
        verificationCode: 'ver-hid',
      },
    });
    await prisma.customerTrainingCertificate.create({
      data: {
        id: 'cert-orphan',
        certificateNumber: 'CERT-2026-000012',
        programId: null,
        status: 'ISSUED',
        checksum: 'chk-orphan',
        verificationCode: 'ver-orphan',
      },
    });

    const certScoped = await searchTrainingIndex(prisma, {
      admin: agentA,
      query: 'CERT-2026',
      portfolioTenantIds: ['tenant-owned'],
    });
    expect(certScoped.ok).toBe(true);
    const certIds = (certScoped.results || []).map((r) => r.id);
    expect(certIds).toContain('cert-vis');
    expect(certIds).not.toContain('cert-hid');
    expect(certIds).not.toContain('cert-orphan');

    const certUnscoped = await searchTrainingIndex(prisma, {
      admin: agentA,
      query: 'CERT-2026',
    });
    expect(certUnscoped.ok).toBe(true);
    expect(certUnscoped.results).toEqual([]);
    expect(certUnscoped.meta?.failClosed || certUnscoped.reason).toBeTruthy();
  });

  it('export / DQ / recon apply portfolio scope; DQ never invents request zero', async () => {
    const prisma = makePrisma();
    const agent = csAgent('cs-agent-export-dq');

    await prisma.customerTrainingProgram.create({
      data: {
        id: 'trn-exp-owned',
        programNumber: 'TRN-2026-000460',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-owned',
        customerId: 'cust-a',
        csOwnerAdminId: agent.id,
        answerPayload: { q1: 'SECRET_ANSWER_EXPORT' },
        accessToken: 'tok-export-secret',
      },
    });
    await prisma.customerTrainingProgram.create({
      data: {
        id: 'trn-exp-other',
        programNumber: 'TRN-2026-000461',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-other',
        customerId: 'cust-b',
        csOwnerAdminId: 'cs-agent-b',
      },
    });
    await prisma.customerTrainingRequest.create({
      data: {
        id: 'trq-owned',
        requestNumber: 'TRQ-2026-000460',
        status: 'NEW',
        tenantId: 'tenant-owned',
        customerId: 'cust-a',
      },
    });
    await prisma.customerTrainingRequest.create({
      data: {
        id: 'trq-other',
        requestNumber: 'TRQ-2026-000461',
        status: 'NEW',
        tenantId: 'tenant-other',
        customerId: 'cust-b',
      },
    });

    const exportClosed = await exportTrainingReport(prisma, {
      admin: agent,
      reportKey: 'overview',
      format: 'csv',
    });
    expect(exportClosed.ok).toBe(true);
    expect(exportClosed.rows).toEqual([]);
    expect(exportClosed.meta?.failClosed || exportClosed.reason).toBeTruthy();

    const exportScoped = await exportTrainingReport(prisma, {
      admin: agent,
      reportKey: 'overview',
      format: 'csv',
      portfolioTenantIds: ['tenant-owned'],
    });
    expect(exportScoped.ok).toBe(true);
    expect(exportScoped.rows).toHaveLength(1);
    expect(exportScoped.rows[0].id).toBe('trn-exp-owned');
    expect(exportScoped.rows.some((r) => r.id === 'trn-exp-other')).toBe(false);
    const exportBody =
      typeof exportScoped.body === 'string'
        ? exportScoped.body
        : JSON.stringify(exportScoped.rows);
    expect(exportBody).not.toMatch(
      /SECRET_ANSWER|tok-export|answerPayload|accessToken/i
    );

    const dqClosed = await runTrainingDataQuality(prisma, { admin: agent });
    expect(dqClosed.status).toBe(TRAINING_REPORT_STATUS.UNAVAILABLE);
    expect(dqClosed.checks).toBeNull();
    expect(dqClosed.meta?.failClosed || dqClosed.reason).toBeTruthy();

    const dqScoped = await runTrainingDataQuality(prisma, {
      admin: agent,
      portfolioTenantIds: ['tenant-owned'],
    });
    expect(dqScoped.ok).toBe(true);
    expect(dqScoped.status).toBe(TRAINING_REPORT_STATUS.READY);
    expect(dqScoped.checks.totalPrograms).toBe(1);
    expect(dqScoped.checks.totalRequests).toBe(1);

    const reconClosed = await runTrainingReconciliation(prisma, { admin: agent });
    expect(reconClosed.status).toBe(TRAINING_REPORT_STATUS.UNAVAILABLE);
    expect(reconClosed.cards).toBeNull();
    expect(reconClosed.meta?.failClosed || reconClosed.reason).toBeTruthy();

    const reconScoped = await runTrainingReconciliation(prisma, {
      admin: agent,
      portfolioTenantIds: ['tenant-owned'],
    });
    expect(reconScoped.ok).toBe(true);
    expect(reconScoped.status).toBe(TRAINING_REPORT_STATUS.READY);
    expect(reconScoped.cards.programs).toBe(1);
    expect(reconScoped.cards.lineageIntact).toBeNull();
    expect(reconScoped.cards.lineageIntact).not.toBe(true);
    expect(dqScoped.checks.blockingDq).toBeNull();
    expect(dqScoped.checks.blockingDq).not.toBe(false);

    // Missing request model → UNAVAILABLE / totalRequests null — never invent 0.
    const noRequestPrisma = makePrisma();
    delete noRequestPrisma.customerTrainingRequest;
    await noRequestPrisma.customerTrainingProgram.create({
      data: {
        id: 'trn-dq-only',
        programNumber: 'TRN-2026-000470',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-owned',
        customerId: 'cust-a',
      },
    });
    const dqNoRequest = await runTrainingDataQuality(noRequestPrisma, {
      admin: superAdmin(),
    });
    expect(dqNoRequest.status).toBe(TRAINING_REPORT_STATUS.UNAVAILABLE);
    expect(dqNoRequest.checks?.totalRequests).toBeNull();
    expect(dqNoRequest.checks?.totalRequests).not.toBe(0);
    expect(dqNoRequest.honesty?.falseZeroes).toBe(false);
  });

  it('export strips answers/tokens and rechecks permission', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    await prisma.customerTrainingProgram.create({
      data: {
        id: 'trn-exp',
        programNumber: 'TRN-2026-000420',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-1',
        customerId: 'cust-1',
        answerPayload: { q1: 'SECRET_ANSWER_EXPORT' },
        accessToken: 'tok-export-secret',
        assessmentAnswersJson: { a: 1 },
      },
    });

    const denied = await exportTrainingReport(prisma, {
      admin: { id: 'no-perm', role: 'Viewer', permissions: {} },
      reportKey: 'overview',
      format: 'csv',
    });
    expect(denied.ok).toBe(false);
    expect(denied.forbidden || denied.error).toBeTruthy();

    const exported = await exportTrainingReport(prisma, {
      admin,
      reportKey: 'overview',
      format: 'csv',
    });
    expect(exported.ok).toBe(true);
    const body = typeof exported.body === 'string' ? exported.body : JSON.stringify(exported.rows);
    expect(body).not.toMatch(
      /SECRET_ANSWER|tok-export|answerPayload|accessToken|assessmentAnswersJson/i
    );
  });

  it('Phase 8 linked CsTrainingRecord projects Program status — never invent COMPLETED', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const viewer = csViewerOnly();

    await prisma.customerTrainingProgram.create({
      data: {
        id: 'trn-p8',
        programNumber: 'TRN-2026-000430',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-p8',
        customerId: 'cust-p8',
      },
    });
    await prisma.customerTrainingProgram.create({
      data: {
        id: 'trn-p8-b',
        programNumber: 'TRN-2026-000431',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-ambiguous',
        customerId: 'cust-amb-a',
      },
    });
    await prisma.customerTrainingProgram.create({
      data: {
        id: 'trn-p8-c',
        programNumber: 'TRN-2026-000432',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-ambiguous',
        customerId: 'cust-amb-b',
      },
    });
    await prisma.csTrainingRecord.create({
      data: {
        id: 'cstr-1',
        tenantId: 'tenant-p8',
        customerId: 'cust-p8',
        moduleKey: 'kickoff-module',
        status: 'COMPLETED',
        completedAt: new Date('2026-01-01'),
        sourceNote: 'legacy',
      },
    });
    await prisma.csTrainingRecord.create({
      data: {
        id: 'cstr-orphan',
        tenantId: 'tenant-orphan',
        moduleKey: 'unknown-item',
        status: 'DONE',
      },
    });
    await prisma.csTrainingRecord.create({
      data: {
        id: 'cstr-ambiguous',
        tenantId: 'tenant-ambiguous',
        moduleKey: 'kickoff-module',
        status: 'COMPLETED',
      },
    });

    const viewDenied = await migratePhase8TrainingRecords(prisma, {
      admin: viewer,
      actorContext: { admin: viewer },
    });
    expect(viewDenied.ok).toBe(false);
    expect(viewDenied.forbidden).toBe(true);

    const migrated = await migratePhase8TrainingRecords(prisma, {
      admin,
      actorContext: { admin },
    });
    expect(migrated.ok).toBe(true);
    expect(migrated.linked).toBeGreaterThanOrEqual(1);
    expect(migrated.explicitMatchOnly).toBe(true);

    const linked = prisma._csTrainingStore.find((r) => r.id === 'cstr-1');
    expect(linked.trainingProgramId).toBe('trn-p8');

    const orphan = prisma._csTrainingStore.find((r) => r.id === 'cstr-orphan');
    expect(orphan.trainingProgramId == null || orphan.migrationStatus === 'UNKNOWN').toBe(
      true
    );
    expect(orphan.status).not.toBe('COMPLETED');

    const ambiguous = prisma._csTrainingStore.find((r) => r.id === 'cstr-ambiguous');
    expect(ambiguous.trainingProgramId).toBeFalsy();
    expect(ambiguous.migrationStatus).toBe('UNKNOWN');

    const foundation = await getFoundationStatus(prisma, {
      admin,
      kind: 'training',
      tenantId: 'tenant-p8',
    });
    expect(foundation.ok).toBe(true);
    const item = foundation.items?.find((i) => i.id === 'cstr-1');
    expect(item).toBeTruthy();
    expect(item.projectedFromProgram || item.projectedFromProject).toBe(true);
    expect(item.status).toBe('IN_PROGRESS');
    expect(item.status).not.toBe('COMPLETED');

    await prisma.csTrainingRecord.create({
      data: {
        id: 'cstr-broken-link',
        tenantId: 'tenant-p8',
        moduleKey: 'orphan-link',
        status: 'COMPLETED',
        completedAt: new Date('2026-01-02'),
        trainingProgramId: 'trn-does-not-exist',
        migrationStatus: 'UNKNOWN',
      },
    });
    const foundationBroken = await getFoundationStatus(prisma, {
      admin,
      kind: 'training',
      tenantId: 'tenant-p8',
    });
    const broken = foundationBroken.items?.find((i) => i.id === 'cstr-broken-link');
    expect(broken).toBeTruthy();
    expect(broken.linkBroken).toBe(true);
    expect(broken.projectedFromProgram || broken.projectedFromProject).toBe(false);
    expect(broken.status).not.toBe('COMPLETED');
    expect(['UNKNOWN', 'NOT_INSTRUMENTED', 'LINK_BROKEN']).toContain(broken.status);
    expect(broken.completedAt).toBeNull();

    const viaHelper = await getFoundationStatusWithProgram(prisma, {
      admin,
      kind: 'training',
      tenantId: 'tenant-p8',
    });
    expect(viaHelper.items?.find((i) => i.id === 'cstr-1')?.status).toBe('IN_PROGRESS');
    // PRD 22 domain contract (tree phase-18 alias retained).
    expect(getTrainingDomainContract().phase).toBe(22);
    expect(getTrainingDomainContract().treePhaseAlias).toBe(18);
  });

  it('EN + NY i18n keys for training surfaces resolve (smoke)', () => {
    const en = JSON.parse(
      readFileSync(join(process.cwd(), 'locales/en/admin-pages.json'), 'utf8')
    );
    const ny = JSON.parse(
      readFileSync(join(process.cwd(), 'locales/ny/admin-pages.json'), 'utf8')
    );
    const keys = [
      'customerSuccess.trainingHub.title',
      'customerSuccess.trainingHub.overview',
      'customerSuccess.trainingHub.myWork',
      'customerSuccess.trainingHub.queues',
      'customerSuccess.trainingHub.reports',
      'customerSuccess.trainingHub.contextBar',
    ];
    for (const path of keys) {
      const parts = path.split('.');
      let nodeEn = en;
      let nodeNy = ny;
      for (const p of parts) {
        nodeEn = nodeEn?.[p];
        nodeNy = nodeNy?.[p];
      }
      expect(typeof nodeEn).toBe('string');
      expect(nodeEn.length).toBeGreaterThan(0);
      expect(typeof nodeNy).toBe('string');
      expect(nodeNy.length).toBeGreaterThan(0);
    }
  });

  it('training certificate still idempotent after Wave 4', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();

    await prisma.customerTrainingProgram.create({
      data: {
        id: 'trn-w4-cert',
        programNumber: 'TRN-2026-000440',
        status: 'COMPLETION_REVIEW',
        tenantId: 'tenant-1',
        customerId: 'cust-1',
        curriculumVersionId: 'curv-1',
      },
    });
    prisma._completionStore.push({
      id: 'pcomp-w4-1',
      programId: 'trn-w4-cert',
      participantId: 'part-w4-1',
      policyVersion: 'training-completion-policy-v1',
      status: 'COMPLETED',
      gapsJson: [],
      idempotencyKey: 'pcomp:w4:1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const args = {
      actorContext: { admin },
      participantCompletionId: 'pcomp-w4-1',
      templateVersionId: 'tmpl-w4-v1',
      idempotencyKey: 'cert:trn-w4:1',
      now: new Date('2026-08-02T12:00:00Z'),
    };
    const first = await issueTrainingCertificate(prisma, args);
    expect(first.ok).toBe(true);
    expect(first.certificate.checksum || first.certificate.checksumSha256).toBeTruthy();

    const second = await issueTrainingCertificate(prisma, args);
    expect(second.ok).toBe(true);
    expect(second.alreadyExists || second.idempotentReplay).toBe(true);
    expect(second.certificate.id).toBe(first.certificate.id);
  });

  it('lineage and attempt list are portfolio-scoped (fail-closed)', async () => {
    const prisma = makePrisma();
    const agent = csAgent('cs-lineage');
    await prisma.customerTrainingProgram.create({
      data: {
        id: 'trn-lin-owned',
        programNumber: 'TRN-2026-000480',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-owned',
        customerId: 'cust-a',
        handoffId: 'handoff-1',
        trainingRequestId: 'trq-1',
      },
    });
    await prisma.customerTrainingProgram.create({
      data: {
        id: 'trn-lin-other',
        programNumber: 'TRN-2026-000481',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-other',
        customerId: 'cust-b',
      },
    });

    const denied = await getTrainingLineage(prisma, {
      admin: agent,
      programId: 'trn-lin-other',
      portfolioTenantIds: ['tenant-owned'],
    });
    expect(denied.ok).toBe(false);
    expect(denied.error || denied.reason).toMatch(/out.?of.?scope|forbidden|denied/i);
    expect(denied.lineage).toBeNull();

    const ok = await getTrainingLineage(prisma, {
      admin: agent,
      programId: 'trn-lin-owned',
      portfolioTenantIds: ['tenant-owned'],
    });
    expect(ok.ok).toBe(true);
    expect(ok.lineage.program.id).toBe('trn-lin-owned');
    expect(ok.lineage.handoffId).toBe('handoff-1');

    const attemptsClosed = await listAssessmentAttempts(prisma, {
      admin: agent,
    });
    expect(attemptsClosed.attempts).toEqual([]);
    expect(attemptsClosed.meta?.failClosed || attemptsClosed.reason || attemptsClosed.status).toBeTruthy();
  });
});
