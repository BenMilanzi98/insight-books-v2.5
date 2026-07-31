/**
 * Phase 22 Wave 4 — UI / metrics / reliability / DQ / recon / Phase 23 pack / exit.
 *
 * Hardens tree-18 Wave 4 for PRD 22:
 * - Gate fail → UNAVAILABLE / value null (never false zero)
 * - Search/export/DQ/recon fail-closed + tenant/portfolio scoped
 * - No answer keys / broad assessment responses in search/export
 * - Never invent lineageIntact:true
 * - Progress ≠ quality ≠ completion; completion ≠ adoption
 * - Phase 23 pack honest (identity/source/consent; Training ≠ acquisition)
 * - Mislabel map pointer (tree-18 ≡ PRD 22; Demo preserved)
 * - Exit READY_FOR_PHASE_23_WITH_BLOCKERS
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  applyTrainingReportHonesty,
  TRAINING_REPORT_STATUS,
  getTrainingMetric,
  getTrainingOverviewCards,
  searchTrainingIndex,
  exportTrainingReport,
  runTrainingDataQuality,
  runTrainingReconciliation,
  getTrainingStatusLabelHonesty,
  getTrainingDomainContract,
  TRAINING_HUB_ROUTES,
  calculateTrainingProgress,
  getTrainingReport,
  listAssessmentAttempts,
} from '@/lib/admin/customerSuccess/training';

function superAdmin(id = 'super-p22-w4') {
  return {
    id,
    role: 'Super Admin',
    permissions: {
      'systemAdmin.customerSuccess.read': true,
      'systemAdmin.customerSuccess.manageCases': true,
    },
  };
}

function csAgent(id = 'cs-agent-p22-w4') {
  return {
    id,
    role: 'System Admin',
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
      return null;
    }),
    findFirst: vi.fn(async ({ where = {} } = {}) => {
      return (
        store.find((r) => {
          if (where.id && r.id !== where.id) return false;
          if (where.programId && r.programId !== where.programId) return false;
          if (where.tenantId && r.tenantId !== where.tenantId) return false;
          if (where.participantId && r.participantId !== where.participantId) {
            return false;
          }
          return true;
        }) || null
      );
    }),
    findMany: vi.fn(async ({ where = {} } = {}) => {
      let rows = [...store];
      if (where.programId) {
        if (where.programId.in) {
          rows = rows.filter((r) => where.programId.in.includes(r.programId));
        } else {
          rows = rows.filter((r) => r.programId === where.programId);
        }
      }
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
            if (clause.programNumber?.contains) {
              return String(r.programNumber || '').includes(
                clause.programNumber.contains
              );
            }
            if (clause.requestNumber?.contains) {
              return String(r.requestNumber || '').includes(
                clause.requestNumber.contains
              );
            }
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
    update: vi.fn(async ({ where = {}, data = {} } = {}) => {
      const row = store.find((r) => r.id === where.id);
      if (!row) throw new Error('not found');
      Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
      return row;
    }),
    count: vi.fn(async ({ where = {} } = {}) => {
      let rows = [...store];
      if (where.tenantId) {
        if (where.tenantId.in) {
          rows = rows.filter((r) => where.tenantId.in.includes(r.tenantId));
        } else {
          rows = rows.filter((r) => r.tenantId === where.tenantId);
        }
      }
      if (where.status) rows = rows.filter((r) => r.status === where.status);
      return rows.length;
    }),
  };
}

function makePrisma(overrides = {}) {
  const programStore = overrides._programStore || [];
  const requestStore = overrides._requestStore || [];
  const certificateStore = overrides._certificateStore || [];
  const attemptStore = overrides._attemptStore || [];
  const prisma = {
    _programStore: programStore,
    _requestStore: requestStore,
    _certificateStore: certificateStore,
    _attemptStore: attemptStore,
    customerTrainingProgram: makeStoreCrud(programStore, 'trn'),
    customerTrainingRequest: makeStoreCrud(requestStore, 'trq'),
    customerTrainingCertificate: makeStoreCrud(certificateStore, 'cert'),
    customerTrainingAssessmentAttempt: makeStoreCrud(attemptStore, 'att'),
  };
  return prisma;
}

describe('Phase 22 Wave 4 — metrics / reliability / scope / Phase 23 exit', () => {
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
    expect(cards.status || cards.cards?.inProgress?.status).toBe(
      TRAINING_REPORT_STATUS.UNAVAILABLE
    );
    expect(cards.cards?.inProgress?.value ?? null).toBeNull();
    expect(cards.cards?.inProgress?.value).not.toBe(0);
  });

  it('metrics / search / export / DQ / recon fail-closed; no answer keys', async () => {
    const prisma = makePrisma();
    const agent = csAgent();

    await prisma.customerTrainingProgram.create({
      data: {
        id: 'trn-owned',
        programNumber: 'TRN-2026-000501',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-owned',
        customerId: 'cust-a',
        csOwnerAdminId: agent.id,
        answerPayload: { q1: 'SECRET_ANSWER_P22' },
        accessToken: 'tok-secret-p22',
      },
    });
    await prisma.customerTrainingProgram.create({
      data: {
        id: 'trn-other',
        programNumber: 'TRN-2026-000502',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-other',
        customerId: 'cust-b',
        csOwnerAdminId: 'other-agent',
        answerPayload: { q1: 'SECRET_OTHER' },
      },
    });
    await prisma.customerTrainingRequest.create({
      data: {
        id: 'trq-owned',
        requestNumber: 'TRQ-2026-000501',
        status: 'ACCEPTED',
        tenantId: 'tenant-owned',
        customerId: 'cust-a',
      },
    });

    const unscopedMetric = await getTrainingMetric(prisma, {
      admin: agent,
      metric: 'program_count',
    });
    expect(unscopedMetric.value).toBeNull();
    expect(unscopedMetric.status).toBe(TRAINING_REPORT_STATUS.UNAVAILABLE);
    expect(unscopedMetric.meta?.failClosed || unscopedMetric.reason).toBeTruthy();

    const scopedMetric = await getTrainingMetric(prisma, {
      admin: agent,
      metric: 'program_count',
      portfolioTenantIds: ['tenant-owned'],
    });
    expect(scopedMetric.ok).toBe(true);
    expect(scopedMetric.value).toBe(1);

    const searchClosed = await searchTrainingIndex(prisma, {
      admin: agent,
      query: 'TRN-2026',
    });
    expect(searchClosed.ok).toBe(true);
    expect(searchClosed.results).toEqual([]);
    expect(searchClosed.meta?.failClosed || searchClosed.reason).toBeTruthy();

    const searchScoped = await searchTrainingIndex(prisma, {
      admin: agent,
      query: 'TRN-2026',
      portfolioTenantIds: ['tenant-owned'],
    });
    expect(searchScoped.ok).toBe(true);
    const ids = (searchScoped.results || []).map((r) => r.id);
    expect(ids).toContain('trn-owned');
    expect(ids).not.toContain('trn-other');
    const searchPayload = JSON.stringify(searchScoped.results);
    expect(searchPayload).not.toMatch(
      /SECRET_ANSWER|tok-secret|answerPayload|accessToken/i
    );
    expect(searchScoped.meta?.excludesAnswers).toBe(true);

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
    expect(exportScoped.rows[0].id).toBe('trn-owned');
    const exportBody =
      typeof exportScoped.body === 'string'
        ? exportScoped.body
        : JSON.stringify(exportScoped.rows);
    expect(exportBody).not.toMatch(
      /SECRET_ANSWER|tok-secret|answerPayload|accessToken|password|credential/i
    );

    prisma.customerTrainingProgram.findMany.mockRejectedValueOnce(
      new Error('training_export_db_down')
    );
    const exportQueryFail = await exportTrainingReport(prisma, {
      admin: agent,
      reportKey: 'overview',
      format: 'csv',
      portfolioTenantIds: ['tenant-owned'],
    });
    expect(exportQueryFail.status).toBe(TRAINING_REPORT_STATUS.UNAVAILABLE);
    expect(exportQueryFail.ok).toBe(false);
    expect(exportQueryFail.rows).toBeNull();
    expect(exportQueryFail.body).toBeNull();
    expect(exportQueryFail.rows).not.toEqual([]);

    prisma.customerTrainingProgram.findMany.mockRejectedValueOnce(
      new Error('training_search_db_down')
    );
    const searchQueryFail = await searchTrainingIndex(prisma, {
      admin: agent,
      query: 'TRN-2026',
      portfolioTenantIds: ['tenant-owned'],
    });
    expect(searchQueryFail.status).toBe(TRAINING_REPORT_STATUS.UNAVAILABLE);
    expect(searchQueryFail.ok).toBe(false);
    expect(searchQueryFail.results).toBeNull();
    expect(searchQueryFail.results).not.toEqual([]);
    expect(searchQueryFail.reason || searchQueryFail.meta?.failClosed).toBeTruthy();

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
    expect(dqScoped.checks.blockingDq).toBeNull();
    expect(dqScoped.checks.blockingDq).not.toBe(false);

    const reconClosed = await runTrainingReconciliation(prisma, {
      admin: agent,
    });
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

    const noRequestPrisma = makePrisma();
    delete noRequestPrisma.customerTrainingRequest;
    await noRequestPrisma.customerTrainingProgram.create({
      data: {
        id: 'trn-dq-only',
        programNumber: 'TRN-2026-000510',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-owned',
      },
    });
    const dqNoRequest = await runTrainingDataQuality(noRequestPrisma, {
      admin: superAdmin(),
    });
    expect(dqNoRequest.status).toBe(TRAINING_REPORT_STATUS.UNAVAILABLE);
    expect(dqNoRequest.checks?.totalRequests).toBeNull();
    expect(dqNoRequest.checks?.totalRequests).not.toBe(0);
    expect(dqNoRequest.honesty?.falseZeroes).toBe(false);

    // Assessment attempt list never returns answer keys / broad response payloads.
    await prisma.customerTrainingAssessmentAttempt.create({
      data: {
        id: 'att-1',
        programId: 'trn-owned',
        participantId: 'part-1',
        status: 'SUBMITTED',
        answerPayload: { q1: 'SECRET_ATTEMPT_ANSWER' },
        responsesJson: { essay: 'full response text' },
      },
    });
    const attempts = await listAssessmentAttempts(prisma, {
      admin: agent,
      programId: 'trn-owned',
      portfolioTenantIds: ['tenant-owned'],
    });
    if (attempts.ok) {
      const attemptPayload = JSON.stringify(attempts);
      expect(attemptPayload).not.toMatch(
        /SECRET_ATTEMPT_ANSWER|full response text|answerPayload|responsesJson/i
      );
    }
  });

  it('progress ≠ quality ≠ completion; completion ≠ adoption', async () => {
    const label = getTrainingStatusLabelHonesty({
      progressPercent: 80,
      qualityScore: 90,
      completionStatus: 'COMPLETED',
    });
    expect(label.progressEqualsQuality).toBe(false);
    expect(label.progressEqualsCompletion).toBe(false);
    expect(label.qualityEqualsCompletion).toBe(false);
    expect(label.completionEqualsAdoption).toBe(false);
    expect(label.isAdoption).toBe(false);
    expect(label.isQuality).toBe(false);
    expect(label.label).toMatch(
      /progress.*not.*completion|not_quality|not_adoption/i
    );

    const prisma = makePrisma();
    const admin = superAdmin();
    await prisma.customerTrainingProgram.create({
      data: {
        id: 'trn-prog',
        programNumber: 'TRN-2026-000520',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-1',
        customerId: 'cust-1',
      },
    });
    prisma.customerTrainingProgram.findUnique = vi.fn(async ({ where }) =>
      prisma._programStore.find((r) => r.id === where.id) || null
    );
    prisma.customerTrainingAttendance = {
      findMany: vi.fn(async () => [
        {
          id: 'a1',
          participantId: 'part-1',
          sessionId: 'sess-1',
          status: 'PRESENT',
          supersededById: null,
        },
      ]),
    };
    prisma.customerTrainingSession = {
      findMany: vi.fn(async ({ where } = {}) => {
        const rows = [{ id: 'sess-1', programId: 'trn-prog' }];
        return rows.filter(
          (s) =>
            (!where?.id?.in || where.id.in.includes(s.id)) &&
            (!where?.programId || s.programId === where.programId)
        );
      }),
    };
    prisma.customerTrainingExercise = {
      findMany: vi.fn(async () => []),
    };
    prisma.customerTrainingAssessmentResult = {
      findMany: vi.fn(async () => []),
    };
    prisma.customerTrainingParticipantCompletion = {
      findFirst: vi.fn(async () => null),
    };

    const progress = await calculateTrainingProgress(prisma, {
      admin,
      actorContext: { admin },
      programId: 'trn-prog',
      participantId: 'part-1',
    });
    expect(progress.ok).toBe(true);
    expect(progress.complete).toBe(false);
    expect(progress.isComplete).toBe(false);
    expect(progress.isQuality).toBe(false);
    expect(progress.isAdoption).toBe(false);
    expect(progress.percent).toBeLessThan(100);
    expect(progress.percent).toBe(25);

    const contract = getTrainingDomainContract();
    expect(contract.phase).toBe(22);
    expect(contract.prdPhase).toBe(22);
    expect(contract.treePhaseAlias).toBe(18);
    expect(contract.wave).toBe(4);
    expect(contract.progressEqualsQualityForbidden).toBe(true);
    expect(contract.progressEqualsCompletionForbidden).toBe(true);
    expect(contract.completionEqualsAdoptionForbidden).toBe(true);
    expect(contract.trainingEqualsMarketingAttributionForbidden).toBe(true);
    expect(TRAINING_HUB_ROUTES.overview).toMatch(/customer-success\/training/);
  });

  it('EN + NY i18n keys for training honesty resolve (smoke)', () => {
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
      'customerSuccess.trainingHub.progressNotQuality',
      'customerSuccess.trainingHub.progressNotCompletion',
      'customerSuccess.trainingHub.completionNotAdoption',
      'customerSuccess.trainingHub.trainingNotMarketingAttribution',
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
    expect(en.customerSuccess.trainingHub.progressNotCompletion.toLowerCase()).toMatch(
      /not .*complet/
    );
    expect(en.customerSuccess.trainingHub.completionNotAdoption.toLowerCase()).toMatch(
      /not .*adopt/
    );
    expect(
      en.customerSuccess.trainingHub.trainingNotMarketingAttribution.toLowerCase()
    ).toMatch(/not .*attribution|not .*acquisition|not .*marketing/);
  });

  it('Phase 23 pack present with READY_FOR_PHASE_23_WITH_BLOCKERS', () => {
    const base = join(process.cwd(), 'docs/admin-intelligence-crm/phase-22');
    const inputs = join(base, 'PHASE_23_INPUTS.md');
    const checklist = join(base, 'PHASE_23_READINESS_CHECKLIST.md');
    const finalReport = join(base, 'FINAL_PHASE_22_REPORT.md');
    const decision = join(base, 'FINAL_READINESS_DECISION.md');
    for (const p of [inputs, checklist, finalReport, decision]) {
      expect(existsSync(p)).toBe(true);
    }
    const decisionBody = readFileSync(decision, 'utf8');
    expect(decisionBody).toMatch(/READY_FOR_PHASE_23_WITH_BLOCKERS/);
    const inputsBody = readFileSync(inputs, 'utf8');
    expect(inputsBody).toMatch(/blocker|carry/i);
    expect(inputsBody).toMatch(/identity|source|consent|communication.?eligibility/i);
    expect(inputsBody).toMatch(
      /Training\s*≠\s*acquisition|not acquisition|≠ acquisition|Training ≠ Marketing/i
    );
    expect(inputsBody).toMatch(/tree-18|phase-18|PRD\s*22/i);
    expect(inputsBody).toMatch(
      /MISLABELLED_TRAINING_ARTIFACT_AUDIT|mislabel/i
    );
    expect(inputsBody).toMatch(/Demo|PRD\s*18/i);
    // Must not affirmatively equate Training with Marketing Attribution or Demo.
    expect(inputsBody).not.toMatch(
      /Training\s*=\s*Marketing Attribution|Marketing Attribution\s*=\s*PRD\s*22|Demo\s*=\s*Training/i
    );
    const reportBody = readFileSync(finalReport, 'utf8');
    expect(reportBody).toMatch(/READY_FOR_PHASE_23_WITH_BLOCKERS/);
    const checklistBody = readFileSync(checklist, 'utf8');
    expect(checklistBody).toMatch(/READY_FOR_PHASE_23_WITH_BLOCKERS/);
  });

  it('progress excludes superseded and cross-program attendance', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    await prisma.customerTrainingProgram.create({
      data: {
        id: 'trn-prog-a',
        programNumber: 'TRN-2026-000530',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-1',
        customerId: 'cust-1',
      },
    });
    prisma.customerTrainingProgram.findUnique = vi.fn(async ({ where }) =>
      prisma._programStore.find((r) => r.id === where.id) || null
    );

    const attendanceStore = [
      {
        id: 'att-super',
        participantId: 'part-prog',
        sessionId: 'sess-a',
        status: 'PRESENT',
        supersededById: 'att-tip',
      },
      {
        id: 'att-tip',
        participantId: 'part-prog',
        sessionId: 'sess-a',
        status: 'NO_SHOW',
        supersededById: null,
        correctsAttendanceId: 'att-super',
      },
      {
        id: 'att-other-prog',
        participantId: 'part-prog',
        sessionId: 'sess-other',
        status: 'PRESENT',
        supersededById: null,
      },
    ];
    const sessionStore = [
      { id: 'sess-a', programId: 'trn-prog-a' },
      { id: 'sess-other', programId: 'trn-prog-other' },
    ];

    prisma.customerTrainingAttendance = {
      findMany: vi.fn(async ({ where } = {}) =>
        attendanceStore.filter(
          (r) => !where?.participantId || r.participantId === where.participantId
        )
      ),
    };
    prisma.customerTrainingSession = {
      findMany: vi.fn(async ({ where } = {}) =>
        sessionStore.filter(
          (s) =>
            (!where?.id?.in || where.id.in.includes(s.id)) &&
            (!where?.programId || s.programId === where.programId)
        )
      ),
    };
    prisma.customerTrainingExercise = {
      findMany: vi.fn(async () => []),
    };
    prisma.customerTrainingAssessmentResult = {
      findMany: vi.fn(async () => []),
    };
    prisma.customerTrainingParticipantCompletion = {
      findFirst: vi.fn(async () => null),
    };

    const progress = await calculateTrainingProgress(prisma, {
      admin,
      actorContext: { admin },
      programId: 'trn-prog-a',
      participantId: 'part-prog',
    });
    expect(progress.ok).toBe(true);
    // Corrected-away PRESENT + other-program PRESENT must not earn attendance credit.
    expect(progress.percent).toBe(0);

    // Current tip PRESENT on this program's session still earns attendance (25%).
    attendanceStore[1].status = 'PRESENT_LATE';
    const recovered = await calculateTrainingProgress(prisma, {
      admin,
      actorContext: { admin },
      programId: 'trn-prog-a',
      participantId: 'part-prog',
    });
    expect(recovered.ok).toBe(true);
    expect(recovered.percent).toBe(25);
  });

  it('getTrainingReport portfolio fail-closed; scoped counts only', async () => {
    const prisma = makePrisma();
    const agent = csAgent();

    await prisma.customerTrainingProgram.create({
      data: {
        id: 'trn-owned-rpt',
        programNumber: 'TRN-2026-000540',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-owned',
        customerId: 'cust-a',
      },
    });
    await prisma.customerTrainingProgram.create({
      data: {
        id: 'trn-other-rpt',
        programNumber: 'TRN-2026-000541',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-other',
        customerId: 'cust-b',
      },
    });

    const unscoped = await getTrainingReport(prisma, {
      admin: agent,
      reportKey: 'overview',
    });
    expect(unscoped.report).toBeNull();
    expect(unscoped.status).toBe(TRAINING_REPORT_STATUS.UNAVAILABLE);
    expect(unscoped.meta?.failClosed || unscoped.reason).toBeTruthy();
    expect(unscoped.report?.kpis?.totalPrograms).not.toBe(2);

    const emptyScope = await getTrainingReport(prisma, {
      admin: agent,
      reportKey: 'overview',
      portfolioTenantIds: [],
    });
    expect(emptyScope.report).toBeNull();
    expect(emptyScope.status).toBe(TRAINING_REPORT_STATUS.UNAVAILABLE);
    expect(emptyScope.meta?.failClosed).toBe(true);

    const scoped = await getTrainingReport(prisma, {
      admin: agent,
      reportKey: 'overview',
      portfolioTenantIds: ['tenant-owned'],
    });
    expect(scoped.ok).toBe(true);
    expect(scoped.status).toBe(TRAINING_REPORT_STATUS.READY);
    expect(scoped.report?.kpis?.totalPrograms).toBe(1);
    expect(scoped.meta?.portfolioScoped).toBe(true);
  });

  it('thin training overview hub remains real (no fake dashboard)', () => {
    const overview = join(
      process.cwd(),
      'app/insightbooks/customer-success/training/page.js'
    );
    expect(existsSync(overview)).toBe(true);
    const body = readFileSync(overview, 'utf8');
    expect(body).toMatch(/getTrainingOverviewCards|UNAVAILABLE|null/);
    expect(body).toMatch(/Phase 22|PRD 22|prdPhase/i);
    expect(body).toMatch(/No fake dashboard/i);
    expect(body).toMatch(/never invents? zeroes?/i);
    // Must not falsely claim the client page loads card counts.
    expect(body).toMatch(/not loaded|thin placeholder|UNAVAILABLE/i);
    expect(body).not.toMatch(/Card counts load via/i);
  });
});
