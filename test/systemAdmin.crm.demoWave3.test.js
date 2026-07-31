/**
 * Phase 14 Wave 3 — Logical Environment + data packs + checklist/rehearsal.
 * DENV numbering; provision/reset idempotent; expiry; DEMO banner;
 * Production data/credentials rejected; Critical checklist/rehearsal blocks readiness.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  CRM_DEMO_CHECKLIST_EXECUTION_STATUS,
  CRM_DEMO_DATA_PACK_SOURCE_KIND,
  CRM_DEMO_ENVIRONMENT_HEALTH,
  CRM_DEMO_ENVIRONMENT_STATUS,
  CRM_DEMO_ISSUE_SEVERITY,
  CRM_DEMO_REHEARSAL_OUTCOME,
  CRM_DEMO_VERSION_STATUS,
  CRM_READINESS_STATUS,
  approveChecklistVersion,
  approveDataPackVersion,
  approveDemoEnvironment,
  configureDemoReadinessRequirements,
  createChecklistVersion,
  createDataPackVersion,
  createDemo,
  deprovisionDemoEnvironment,
  evaluateDemoReadiness,
  executeDemoChecklist,
  getDemoDomainContract,
  provisionDemoEnvironment,
  recordDemoRehearsal,
  requestChecklistApproval,
  requestDataPackApproval,
  requestDemoEnvironment,
  resetDemoEnvironment,
  validateDataPackSource,
} from '@/lib/admin/crm';

function makeAdmin(id, crmPerms = {}, role = 'Platform Support') {
  return {
    id,
    role,
    permissions: {
      systemAdmin: {
        crm: {
          view: true,
          viewLeads: true,
          editLeads: true,
          mergeLeads: true,
          activities: { view: true, edit: true },
          opportunities: { view: true, edit: true },
          ...crmPerms,
        },
      },
    },
  };
}

function makePrisma(overrides = {}) {
  const seqStore = overrides._seqStore || [];
  const demoStore = overrides._demoStore || [];
  const envStore = overrides._envStore || [];
  const packStore = overrides._packStore || [];
  const checklistStore = overrides._checklistStore || [];
  const executionStore = overrides._executionStore || [];
  const rehearsalStore = overrides._rehearsalStore || [];
  const timelineStore = overrides._timelineStore || [];

  const versionCrud = (store, prefix) => ({
    findUnique: vi.fn(async ({ where = {} } = {}) => {
      if (where.id) return store.find((r) => r.id === where.id) || null;
      if (where.code_version) {
        return (
          store.find(
            (r) =>
              r.code === where.code_version.code &&
              r.version === where.code_version.version
          ) || null
        );
      }
      return null;
    }),
    findFirst: vi.fn(async ({ where = {}, orderBy } = {}) => {
      let rows = [...store];
      if (where.code) rows = rows.filter((r) => r.code === where.code);
      if (where.status) rows = rows.filter((r) => r.status === where.status);
      if (orderBy?.version === 'desc') rows.sort((a, b) => b.version - a.version);
      return rows[0] || null;
    }),
    findMany: vi.fn(async ({ where = {}, take, orderBy } = {}) => {
      let rows = [...store];
      if (where.code) rows = rows.filter((r) => r.code === where.code);
      if (where.status) rows = rows.filter((r) => r.status === where.status);
      if (orderBy?.[0]?.version === 'desc' || orderBy?.version === 'desc') {
        rows.sort((a, b) => b.version - a.version);
      }
      if (typeof take === 'number') rows = rows.slice(0, take);
      return rows;
    }),
    create: vi.fn(async ({ data }) => {
      const row = {
        id: data.id || `${prefix}-${store.length + 1}`,
        createdAt: data.createdAt || new Date(),
        updatedAt: data.updatedAt || new Date(),
        approvedAt: data.approvedAt ?? null,
        approvedByAdminId: data.approvedByAdminId ?? null,
        ...data,
      };
      store.push(row);
      return row;
    }),
    update: vi.fn(async ({ where, data }) => {
      const row = store.find((r) => r.id === where.id);
      if (!row) throw Object.assign(new Error('not found'), { code: 'P2025' });
      Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
      return row;
    }),
    updateMany: vi.fn(async ({ where, data }) => {
      let count = 0;
      for (const row of store) {
        if (where.code && row.code !== where.code) continue;
        if (where.status && row.status !== where.status) continue;
        Object.assign(row, data);
        count += 1;
      }
      return { count };
    }),
  });

  const prisma = {
    $transaction: vi.fn(async (fn) => fn(prisma)),
    _envStore: envStore,
    _packStore: packStore,
    _checklistStore: checklistStore,
    _executionStore: executionStore,
    _rehearsalStore: rehearsalStore,
    _demoStore: demoStore,
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
    crmDemo: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return demoStore.find((r) => r.id === where.id) || null;
        if (where.demoNumber) {
          return demoStore.find((r) => r.demoNumber === where.demoNumber) || null;
        }
        return null;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `demo-${demoStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          readinessStatus: data.readinessStatus || 'NOT_READY',
          readinessJson: data.readinessJson ?? null,
          requiresLogicalEnvironment: data.requiresLogicalEnvironment === true,
          requiresChecklist: data.requiresChecklist === true,
          requiresRehearsal: data.requiresRehearsal === true,
          environmentId: data.environmentId ?? null,
          pinnedChecklistId: data.pinnedChecklistId ?? null,
          latestChecklistExecutionId: data.latestChecklistExecutionId ?? null,
          latestRehearsalId: data.latestRehearsalId ?? null,
          ...data,
        };
        demoStore.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = demoStore.find((r) => r.id === where.id);
        if (!row) throw Object.assign(new Error('not found'), { code: 'P2025' });
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
      findMany: vi.fn(async () => [...demoStore]),
    },
    crmDemoDataPack: versionCrud(packStore, 'pack'),
    crmDemoChecklist: versionCrud(checklistStore, 'chk'),
    crmDemoEnvironment: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return envStore.find((r) => r.id === where.id) || null;
        if (where.envNumber) {
          return envStore.find((r) => r.envNumber === where.envNumber) || null;
        }
        if (where.requestIdempotencyKey) {
          return (
            envStore.find(
              (r) => r.requestIdempotencyKey === where.requestIdempotencyKey
            ) || null
          );
        }
        if (where.provisionIdempotencyKey) {
          return (
            envStore.find(
              (r) => r.provisionIdempotencyKey === where.provisionIdempotencyKey
            ) || null
          );
        }
        return null;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `env-${envStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        envStore.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = envStore.find((r) => r.id === where.id);
        if (!row) throw Object.assign(new Error('not found'), { code: 'P2025' });
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...envStore];
        if (where.demoId) rows = rows.filter((r) => r.demoId === where.demoId);
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        return rows;
      }),
    },
    crmDemoChecklistExecution: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return executionStore.find((r) => r.id === where.id) || null;
        if (where.idempotencyKey) {
          return (
            executionStore.find((r) => r.idempotencyKey === where.idempotencyKey) ||
            null
          );
        }
        return null;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `exec-${executionStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        executionStore.push(row);
        return row;
      }),
    },
    crmDemoRehearsal: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return rehearsalStore.find((r) => r.id === where.id) || null;
        if (where.idempotencyKey) {
          return (
            rehearsalStore.find((r) => r.idempotencyKey === where.idempotencyKey) ||
            null
          );
        }
        return null;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `reh-${rehearsalStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        rehearsalStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...rehearsalStore];
        if (where.demoId) rows = rows.filter((r) => r.demoId === where.demoId);
        return rows;
      }),
    },
    crmDemoStatusHistory: {
      create: vi.fn(async ({ data }) => ({ id: `hist-${Date.now()}`, ...data })),
    },
    crmTimelineEvent: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `tl-${timelineStore.length + 1}`, ...data };
        timelineStore.push(row);
        return row;
      }),
    },
  };

  return prisma;
}

async function activatePack(prisma, author, approver, opts = {}) {
  const created = await createDataPackVersion(prisma, {
    admin: author,
    code: opts.code || 'SAFE_PACK',
    name: opts.name || 'Safe synthetic',
    sourceKind: CRM_DEMO_DATA_PACK_SOURCE_KIND.SYNTHETIC,
    payloadJson: opts.payloadJson || { entities: [{ type: 'demo_account', name: 'Acme Demo' }] },
  });
  expect(created.ok).toBe(true);
  await requestDataPackApproval(prisma, {
    admin: author,
    dataPackId: created.dataPack.id,
  });
  const approved = await approveDataPackVersion(prisma, {
    admin: approver,
    dataPackId: created.dataPack.id,
  });
  expect(approved.ok).toBe(true);
  expect(approved.dataPack.status).toBe(CRM_DEMO_VERSION_STATUS.ACTIVE);
  return approved.dataPack;
}

async function activateChecklist(prisma, author, approver, opts = {}) {
  const created = await createChecklistVersion(prisma, {
    admin: author,
    code: opts.code || 'DELIVERY_CHK',
    name: 'Delivery checklist',
    itemsJson: opts.itemsJson || [
      { key: 'env_ready', label: 'Env ready', severity: 'CRITICAL', required: true },
      { key: 'script_reviewed', label: 'Script reviewed', severity: 'WARN', required: true },
    ],
  });
  expect(created.ok).toBe(true);
  await requestChecklistApproval(prisma, {
    admin: author,
    checklistId: created.checklist.id,
  });
  const approved = await approveChecklistVersion(prisma, {
    admin: approver,
    checklistId: created.checklist.id,
  });
  expect(approved.ok).toBe(true);
  return approved.checklist;
}

describe('Phase 14 Wave 3 — Data packs reject Production', () => {
  it('rejects Production source kinds and credential payloads', () => {
    expect(
      validateDataPackSource({ sourceKind: 'PRODUCTION_TENANT' }).ok
    ).toBe(false);
    expect(
      validateDataPackSource({
        sourceKind: CRM_DEMO_DATA_PACK_SOURCE_KIND.SYNTHETIC,
        payloadJson: { password: 'secret' },
      }).error
    ).toBe('production_data_or_credentials_detected');
    expect(
      validateDataPackSource({
        sourceKind: CRM_DEMO_DATA_PACK_SOURCE_KIND.SYNTHETIC,
        productionTenantId: 'tenant-prod-1',
      }).error
    ).toBe('production_tenant_rejected');
  });

  it('creates ACTIVE safe pack with checksum; refuses Production create', async () => {
    const prisma = makePrisma();
    const author = makeAdmin('a1');
    const approver = makeAdmin('a2');
    const pack = await activatePack(prisma, author, approver);
    expect(pack.checksum).toMatch(/^[a-f0-9]{64}$/);

    const bad = await createDataPackVersion(prisma, {
      admin: author,
      code: 'BAD_PACK',
      sourceKind: 'PRODUCTION',
      payloadJson: { entities: [] },
    });
    expect(bad.ok).toBe(false);
    expect(bad.error).toBe('production_data_pack_source_rejected');
  });
});

describe('Phase 14 Wave 3 — DENV provision / reset / expiry / DEMO banner', () => {
  it('allocates DENV; READY only after approve + provision health; DEMO banner on', async () => {
    const prisma = makePrisma();
    const author = makeAdmin('env-author');
    const approver = makeAdmin('env-approver');
    const demo = await createDemo(prisma, {
      admin: author,
      title: 'Env demo',
      contactId: 'c1',
    });
    const pack = await activatePack(prisma, author, approver, { code: 'ENV_PACK' });

    const now = new Date('2026-07-30T10:00:00.000Z');
    const expiresAt = new Date('2026-08-15T10:00:00.000Z');

    const requested = await requestDemoEnvironment(prisma, {
      admin: author,
      demoId: demo.demo.id,
      expiresAt,
      dataPackId: pack.id,
      idempotencyKey: 'req-env-1',
      now,
    });
    expect(requested.ok).toBe(true);
    expect(requested.environment.envNumber).toMatch(/^DENV-\d{4}-\d{6}$/);
    expect(requested.environment.status).toBe(CRM_DEMO_ENVIRONMENT_STATUS.REQUESTED);
    expect(requested.environment.demoBannerVisible).toBe(true);
    expect(requested.environment.cloudProvisionStatus).toBe('NOT_AVAILABLE');
    expect(requested.environment.mraEisSandboxAliased).toBe(false);

    // Cannot invent READY without provision path
    expect(requested.environment.status).not.toBe(CRM_DEMO_ENVIRONMENT_STATUS.READY);

    const selfApprove = await approveDemoEnvironment(prisma, {
      admin: author,
      environmentId: requested.environment.id,
    });
    expect(selfApprove.ok).toBe(false);

    const approved = await approveDemoEnvironment(prisma, {
      admin: approver,
      environmentId: requested.environment.id,
      now,
    });
    expect(approved.ok).toBe(true);
    expect(approved.environment.status).toBe(CRM_DEMO_ENVIRONMENT_STATUS.APPROVED);

    const provisioned = await provisionDemoEnvironment(prisma, {
      admin: author,
      environmentId: requested.environment.id,
      idempotencyKey: 'prov-1',
      now,
    });
    expect(provisioned.ok).toBe(true);
    expect(provisioned.environment.status).toBe(CRM_DEMO_ENVIRONMENT_STATUS.READY);
    expect(provisioned.environment.healthStatus).toBe(
      CRM_DEMO_ENVIRONMENT_HEALTH.HEALTHY
    );
    expect(provisioned.environment.demoBannerVisible).toBe(true);
    expect(provisioned.environment.logicalProvisionToken).toMatch(/^logical:/);

    const again = await provisionDemoEnvironment(prisma, {
      admin: author,
      environmentId: requested.environment.id,
      idempotencyKey: 'prov-1',
      now,
    });
    expect(again.ok).toBe(true);
    expect(again.alreadyProvisioned).toBe(true);

    const reset = await resetDemoEnvironment(prisma, {
      admin: author,
      environmentId: requested.environment.id,
      idempotencyKey: 'reset-1',
      now,
    });
    expect(reset.ok).toBe(true);
    expect(reset.environment.status).toBe(CRM_DEMO_ENVIRONMENT_STATUS.READY);

    const resetAgain = await resetDemoEnvironment(prisma, {
      admin: author,
      environmentId: requested.environment.id,
      idempotencyKey: 'reset-1',
      now,
    });
    expect(resetAgain.alreadyReset).toBe(true);

    const deprov = await deprovisionDemoEnvironment(prisma, {
      admin: author,
      environmentId: requested.environment.id,
      idempotencyKey: 'deprov-1',
      now,
    });
    expect(deprov.ok).toBe(true);
    expect(deprov.environment.status).toBe(CRM_DEMO_ENVIRONMENT_STATUS.DEPROVISIONED);
  });

  it('requires expiry; rejects MRA EIS / Production alias; expired blocks READY', async () => {
    const prisma = makePrisma();
    const author = makeAdmin('a1');
    const approver = makeAdmin('a2');
    const demo = await createDemo(prisma, {
      admin: author,
      title: 'Expiry',
      contactId: 'c1',
    });

    const noExpiry = await requestDemoEnvironment(prisma, {
      admin: author,
      demoId: demo.demo.id,
    });
    expect(noExpiry.ok).toBe(false);
    expect(noExpiry.error).toBe('environment_expiry_required');

    const alias = await requestDemoEnvironment(prisma, {
      admin: author,
      demoId: demo.demo.id,
      expiresAt: '2026-09-01T00:00:00.000Z',
      aliasMraEisSandbox: true,
    });
    expect(alias.ok).toBe(false);
    expect(alias.error).toBe('mra_eis_or_production_tenant_alias_forbidden');

    const now = new Date('2026-07-30T12:00:00.000Z');
    const requested = await requestDemoEnvironment(prisma, {
      admin: author,
      demoId: demo.demo.id,
      expiresAt: '2026-08-01T00:00:00.000Z',
      now,
    });
    await approveDemoEnvironment(prisma, {
      admin: approver,
      environmentId: requested.environment.id,
      now,
    });

    const afterExpiry = new Date('2026-08-02T00:00:00.000Z');
    const provisioned = await provisionDemoEnvironment(prisma, {
      admin: author,
      environmentId: requested.environment.id,
      idempotencyKey: 'late-prov',
      now: afterExpiry,
    });
    expect(provisioned.ok).toBe(false);
    expect(provisioned.environment.status).toBe(CRM_DEMO_ENVIRONMENT_STATUS.EXPIRED);
    expect(provisioned.environment.healthStatus).toBe(
      CRM_DEMO_ENVIRONMENT_HEALTH.EXPIRED
    );
  });
});

describe('Phase 14 Wave 3 — Checklist / rehearsal Critical blocks readiness', () => {
  it('Critical checklist fail and Critical rehearsal issue block readiness when configured', async () => {
    const prisma = makePrisma();
    const author = makeAdmin('r-author');
    const approver = makeAdmin('r-approver');
    const demo = await createDemo(prisma, {
      admin: author,
      title: 'Gates',
      contactId: 'c1',
      requiresLogicalEnvironment: true,
      requiresChecklist: true,
      requiresRehearsal: true,
    });
    expect(demo.demo.requiresLogicalEnvironment).toBe(true);

    const blocked = await evaluateDemoReadiness(prisma, {
      admin: author,
      demoId: demo.demo.id,
      persist: false,
      timeline: false,
    });
    expect(blocked.ok).toBe(true);
    expect(blocked.readinessStatus).toBe(CRM_READINESS_STATUS.BLOCKED);
    expect(blocked.blockers).toEqual(
      expect.arrayContaining([
        'logical_environment',
        'checklist_gate',
        'rehearsal_gate',
      ])
    );

    const pack = await activatePack(prisma, author, approver, { code: 'GATE_PACK' });
    const now = new Date('2026-07-30T10:00:00.000Z');
    const envReq = await requestDemoEnvironment(prisma, {
      admin: author,
      demoId: demo.demo.id,
      expiresAt: '2026-09-01T00:00:00.000Z',
      dataPackId: pack.id,
      now,
    });
    await approveDemoEnvironment(prisma, {
      admin: approver,
      environmentId: envReq.environment.id,
      now,
    });
    await provisionDemoEnvironment(prisma, {
      admin: author,
      environmentId: envReq.environment.id,
      idempotencyKey: 'gate-prov',
      now,
    });

    const checklist = await activateChecklist(prisma, author, approver);
    const failExec = await executeDemoChecklist(prisma, {
      admin: author,
      demoId: demo.demo.id,
      checklistId: checklist.id,
      results: [
        { key: 'env_ready', ok: false },
        { key: 'script_reviewed', ok: true },
      ],
      idempotencyKey: 'chk-fail',
      now,
    });
    expect(failExec.ok).toBe(true);
    expect(failExec.criticalFailed).toBe(true);
    expect(failExec.status).toBe(CRM_DEMO_CHECKLIST_EXECUTION_STATUS.FAILED);

    const mid = await evaluateDemoReadiness(prisma, {
      admin: author,
      demoId: demo.demo.id,
      persist: false,
      timeline: false,
    });
    expect(mid.blockers).toEqual(expect.arrayContaining(['checklist_gate']));

    const passExec = await executeDemoChecklist(prisma, {
      admin: author,
      demoId: demo.demo.id,
      checklistId: checklist.id,
      results: [
        { key: 'env_ready', ok: true },
        { key: 'script_reviewed', ok: true },
      ],
      idempotencyKey: 'chk-pass',
      now,
    });
    expect(passExec.criticalFailed).toBe(false);

    const rehFail = await recordDemoRehearsal(prisma, {
      admin: author,
      demoId: demo.demo.id,
      outcome: CRM_DEMO_REHEARSAL_OUTCOME.PASSED,
      issues: [
        {
          key: 'audio',
          severity: CRM_DEMO_ISSUE_SEVERITY.CRITICAL,
          detail: 'Mic failed',
        },
      ],
      idempotencyKey: 'reh-crit',
      now,
    });
    expect(rehFail.outcome).toBe(CRM_DEMO_REHEARSAL_OUTCOME.FAILED);
    expect(rehFail.criticalIssueCount).toBe(1);

    const stillBlocked = await evaluateDemoReadiness(prisma, {
      admin: author,
      demoId: demo.demo.id,
      persist: false,
      timeline: false,
    });
    expect(stillBlocked.blockers).toEqual(
      expect.arrayContaining(['rehearsal_gate'])
    );

    const rehPass = await recordDemoRehearsal(prisma, {
      admin: author,
      demoId: demo.demo.id,
      outcome: CRM_DEMO_REHEARSAL_OUTCOME.PASSED,
      issues: [],
      idempotencyKey: 'reh-ok',
      now,
    });
    expect(rehPass.outcome).toBe(CRM_DEMO_REHEARSAL_OUTCOME.PASSED);

    // Meeting/presenter still missing → other blockers remain, but wave3 gates clear
    const final = await evaluateDemoReadiness(prisma, {
      admin: author,
      demoId: demo.demo.id,
      persist: false,
      timeline: false,
    });
    expect(final.blockers).not.toContain('logical_environment');
    expect(final.blockers).not.toContain('checklist_gate');
    expect(final.blockers).not.toContain('rehearsal_gate');
  });

  it('unconfigured gates stay INFO and do not block Waves 1–2 demos', async () => {
    const prisma = makePrisma();
    const admin = makeAdmin('plain');
    const demo = await createDemo(prisma, {
      admin,
      title: 'No gates',
      contactId: 'c1',
    });
    const readiness = await evaluateDemoReadiness(prisma, {
      admin,
      demoId: demo.demo.id,
      persist: false,
      timeline: false,
    });
    const envItem = readiness.items.find((i) => i.key === 'logical_environment');
    const chkItem = readiness.items.find((i) => i.key === 'checklist_gate');
    const rehItem = readiness.items.find((i) => i.key === 'rehearsal_gate');
    expect(envItem.ok).toBe(true);
    expect(envItem.severity).toBe('INFO');
    expect(chkItem.ok).toBe(true);
    expect(rehItem.ok).toBe(true);
    expect(readiness.blockers).not.toContain('logical_environment');
  });

  it('configureDemoReadinessRequirements toggles gates', async () => {
    const prisma = makePrisma();
    const admin = makeAdmin('cfg');
    const demo = await createDemo(prisma, {
      admin,
      title: 'Toggle',
      contactId: 'c1',
    });
    const configured = await configureDemoReadinessRequirements(prisma, {
      admin,
      demoId: demo.demo.id,
      requiresChecklist: true,
    });
    expect(configured.ok).toBe(true);
    expect(configured.demo.requiresChecklist).toBe(true);
    const readiness = await evaluateDemoReadiness(prisma, {
      admin,
      demoId: demo.demo.id,
      persist: false,
      timeline: false,
    });
    expect(readiness.blockers).toContain('checklist_gate');
  });

  it('domain contract wave 4 honesty', () => {
    const contract = getDemoDomainContract();
    expect(contract.wave).toBe(4);
    expect(contract.cloudDemoInfra).toBe('NOT_AVAILABLE');
    expect(contract.productionDataPackForbidden).toBe(true);
    expect(contract.demoBannerRequired).toBe(true);
    expect(contract.expiryRequired).toBe(true);
    expect(contract.mraEisSandboxEqualsDemoEnvironment).toBe(false);
  });
});
