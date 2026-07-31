import { describe, it, expect, vi } from 'vitest';
import {
  HEALTH_DEFINITION_VERSION,
  DIMENSION_STATUS,
  HEALTH_BANDS,
  HEALTH_CONFIDENCE,
  MISSING_POLICY,
  OVERRIDE_CODES,
  getActiveHealthDefinition,
  evaluateCustomerHealth,
  persistHealthSnapshot,
  listHealthSnapshots,
  buildHealthExportPack,
  buildHealthOverviewPack,
  bandForScore,
} from '@/lib/admin/health';
import { SYSTEM_ADMIN_PERMISSIONS, NAV_PERMISSION_MAP } from '@/lib/admin/permissions';

const FUTURE = new Date(Date.now() + 30 * 864e5);
const RECENT_LOGIN = new Date(Date.now() - 2 * 864e5);

function fixtureTenant(overrides = {}) {
  return {
    id: 'tenant-health-1',
    name: 'Health Co',
    subdomain: 'health-co',
    status: 'ACTIVE',
    createdAt: new Date('2024-01-15T00:00:00.000Z'),
    updatedAt: new Date('2024-06-01T00:00:00.000Z'),
    subscriptionPlan: '1month',
    ...overrides,
  };
}

function fixtureSub(overrides = {}) {
  return {
    id: 'sub-health-1',
    tenantId: 'tenant-health-1',
    plan: '1month',
    amount: 12000,
    currency: 'MWK',
    status: 'Completed',
    isActive: true,
    isTrial: false,
    startedAt: new Date('2024-06-01T00:00:00.000Z'),
    expiresAt: FUTURE,
    trialStartDate: null,
    trialEndDate: null,
    updatedAt: new Date('2024-06-01T00:00:00.000Z'),
    createdAt: new Date('2024-06-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makePrisma(overrides = {}) {
  const tenant = fixtureTenant();
  const sub = fixtureSub();
  const ownershipRows = overrides._ownershipRows || [
    {
      id: 'own-1',
      tenantId: 'tenant-health-1',
      ownerAdminId: 'admin-owner-1',
      status: 'ACTIVE',
      isPrimary: true,
      endAt: null,
    },
  ];
  const signalRows = overrides._signalRows || [];

  return {
    tenant: {
      findUnique: vi.fn(async ({ where }) =>
        where.id === tenant.id || where.id === (overrides._tenant?.id || tenant.id)
          ? overrides._tenant || tenant
          : null
      ),
      findMany: vi.fn(async () => [overrides._tenant || tenant]),
      count: vi.fn(async () => 1),
    },
    user: {
      count: vi.fn(async () => 2),
      aggregate: vi.fn(async () => ({
        _max: { lastLogin: overrides._lastLogin === undefined ? RECENT_LOGIN : overrides._lastLogin },
      })),
    },
    accountSubscription: {
      findMany: vi.fn(async () => overrides._subs || [sub]),
    },
    platformInvoice: {
      aggregate: vi.fn(async () => ({
        _sum: {
          total: overrides._billed ?? 24000,
          outstanding: overrides._outstanding ?? 0,
        },
      })),
    },
    platformPayment: {
      aggregate: vi.fn(async () => ({
        _sum: { amount: overrides._collected ?? 24000 },
      })),
    },
    mraEisTenantEntitlement: {
      findFirst: vi.fn(async () =>
        overrides._entitlement === undefined
          ? null
          : overrides._entitlement
      ),
    },
    customerOwnership: {
      findMany: vi.fn(async ({ where } = {}) => {
        let rows = ownershipRows;
        if (where?.ownerAdminId) {
          rows = rows.filter((r) => r.ownerAdminId === where.ownerAdminId);
        }
        if (where?.tenantId) {
          rows = rows.filter((r) => r.tenantId === where.tenantId);
        }
        if (where?.status) {
          rows = rows.filter((r) => r.status === where.status);
        }
        return rows;
      }),
      findFirst: vi.fn(async ({ where } = {}) => {
        let rows = ownershipRows;
        if (where?.tenantId) {
          rows = rows.filter((r) => r.tenantId === where.tenantId);
        }
        if (where?.status) {
          rows = rows.filter((r) => r.status === where.status);
        }
        return rows[0] || null;
      }),
    },
    customerSignal: {
      findMany: vi.fn(async ({ where } = {}) => {
        let rows = signalRows;
        if (where?.tenantId) {
          rows = rows.filter((r) => r.tenantId === where.tenantId);
        }
        if (where?.status?.in) {
          const set = new Set(where.status.in);
          rows = rows.filter((r) => set.has(r.status));
        } else if (where?.status) {
          rows = rows.filter((r) => r.status === where.status);
        }
        return rows;
      }),
    },
    customerHealthDefinition: {
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => null),
    },
    customerHealthSnapshot: {
      create: vi.fn(async ({ data }) => ({
        id: 'snap-1',
        ...data,
        createdAt: new Date(),
      })),
      findMany: vi.fn(async ({ where } = {}) => {
        let rows = overrides._snapshotRows || [];
        if (where?.tenantId?.in) {
          const allowed = new Set(where.tenantId.in);
          rows = rows.filter((r) => allowed.has(r.tenantId));
        } else if (where?.tenantId) {
          rows = rows.filter((r) => r.tenantId === where.tenantId);
        }
        if (where?.band) {
          rows = rows.filter((r) => r.band === where.band);
        }
        return rows;
      }),
      findFirst: vi.fn(async ({ where } = {}) => {
        const rows = overrides._snapshotRows || [];
        if (where?.tenantId) {
          return rows.find((r) => r.tenantId === where.tenantId) || null;
        }
        return rows[0] || null;
      }),
      count: vi.fn(async ({ where } = {}) => {
        let rows = overrides._snapshotRows || [];
        if (where?.tenantId?.in) {
          const allowed = new Set(where.tenantId.in);
          rows = rows.filter((r) => allowed.has(r.tenantId));
        }
        return rows.length;
      }),
    },
    ...overrides,
  };
}

const superAdmin = { id: 'a-super', role: 'Super Admin', permissions: {} };

const healthReader = {
  id: 'a-reader',
  role: 'Platform Support',
  permissions: {
    systemAdmin: {
      intel: {
        'customerHealth.read': true,
        'customers.read': true,
      },
    },
  },
};

const agentOwner = {
  id: 'admin-owner-1',
  role: 'Platform Support',
  permissions: {
    systemAdmin: {
      intel: {
        'customerHealth.read': true,
        'customers.read': true,
      },
    },
  },
};

/** Health.read only — no customers.read (must still be portfolio-scoped). */
const healthOnlyAgent = {
  id: 'admin-owner-1',
  role: 'Platform Support',
  permissions: {
    systemAdmin: {
      intel: {
        'customerHealth.read': true,
      },
    },
  },
};

function fixtureSnapshots() {
  return [
    {
      id: 'snap-owned',
      tenantId: 'tenant-health-1',
      definitionVersion: HEALTH_DEFINITION_VERSION,
      score: 80,
      band: HEALTH_BANDS.HEALTHY,
      confidence: HEALTH_CONFIDENCE.HIGH,
      asOf: new Date(),
      createdAt: new Date(),
      payload: { customer: { displayName: 'Health Co' }, drivers: [], overrides: [] },
    },
    {
      id: 'snap-other',
      tenantId: 'tenant-other-9',
      definitionVersion: HEALTH_DEFINITION_VERSION,
      score: 40,
      band: HEALTH_BANDS.AT_RISK,
      confidence: HEALTH_CONFIDENCE.MEDIUM,
      asOf: new Date(),
      createdAt: new Date(),
      payload: { customer: { displayName: 'Other Co' }, drivers: [], overrides: [] },
    },
  ];
}

describe('permissions / nav', () => {
  it('defines customerHealth permission keys and nav map', () => {
    expect(SYSTEM_ADMIN_PERMISSIONS.intel.customerHealthRead).toBe(
      'systemAdmin.intel.customerHealth.read'
    );
    expect(SYSTEM_ADMIN_PERMISSIONS.intel.customerHealthManageDefinitions).toBe(
      'systemAdmin.intel.customerHealth.manageDefinitions'
    );
    expect(SYSTEM_ADMIN_PERMISSIONS.intel.customerHealthRebuild).toBe(
      'systemAdmin.intel.customerHealth.rebuild'
    );
    expect(NAV_PERMISSION_MAP['/insightbooks/intelligence/customer-health']).toBe(
      SYSTEM_ADMIN_PERMISSIONS.intel.customerHealthRead
    );
  });
});

describe('getActiveHealthDefinition', () => {
  it('returns v1 definition with EXCLUDE_AND_RENORMALISE and verbatim version', async () => {
    const def = await getActiveHealthDefinition(makePrisma());
    expect(def.version).toBe(HEALTH_DEFINITION_VERSION);
    expect(def.version).toBe('customer-health-2026-07-28');
    expect(def.missingPolicy).toBe(MISSING_POLICY.EXCLUDE_AND_RENORMALISE);
    expect(def.weights.commercial).toBe(0.35);
    expect(def.weights.engagement).toBe(0.25);
    expect(def.weights.mraEis).toBe(0.2);
    expect(def.weights.relationship).toBe(0.2);
    expect(def.bands.HEALTHY).toEqual({ min: 80, max: 100 });
    expect(def.bands.CRITICAL).toEqual({ min: 0, max: 34 });
  });
});

describe('bandForScore', () => {
  it('maps ranges and null → UNKNOWN', () => {
    expect(bandForScore(90)).toBe(HEALTH_BANDS.HEALTHY);
    expect(bandForScore(70)).toBe(HEALTH_BANDS.STABLE);
    expect(bandForScore(55)).toBe(HEALTH_BANDS.NEEDS_ATTENTION);
    expect(bandForScore(40)).toBe(HEALTH_BANDS.AT_RISK);
    expect(bandForScore(10)).toBe(HEALTH_BANDS.CRITICAL);
    expect(bandForScore(null)).toBe(HEALTH_BANDS.UNKNOWN);
  });
});

describe('evaluateCustomerHealth — missing dim ≠ 0', () => {
  it('excludes N/A mraEis and never treats missing/adoption as score 0', async () => {
    // No EIS entitlement and no EIS plan → mraEis NOT_APPLICABLE
    const prisma = makePrisma({
      _entitlement: null,
      _subs: [fixtureSub({ plan: '1month' })],
    });

    const result = await evaluateCustomerHealth(prisma, {
      admin: superAdmin,
      tenantId: 'tenant-health-1',
    });

    expect(result.ok).toBe(true);
    expect(result.forbidden).toBeFalsy();
    expect(result.definitionVersion).toBe('customer-health-2026-07-28');

    const byCode = Object.fromEntries(
      (result.dimensions || []).map((d) => [d.code, d])
    );

    expect(byCode.mraEis.status).toBe(DIMENSION_STATUS.NOT_APPLICABLE);
    expect(byCode.mraEis.score).not.toBe(0);
    expect(byCode.mraEis.score == null).toBe(true);

    // Adoption / support must not appear as scored-0 dims
    expect(byCode.adoption?.status || DIMENSION_STATUS.NOT_APPLICABLE).toBe(
      DIMENSION_STATUS.NOT_APPLICABLE
    );
    if (byCode.adoption) {
      expect(byCode.adoption.score).not.toBe(0);
      expect(byCode.adoption.score == null).toBe(true);
    }

    expect(byCode.commercial.status).toBe(DIMENSION_STATUS.SCORED);
    expect(byCode.engagement.status).toBe(DIMENSION_STATUS.SCORED);
    expect(byCode.relationship.status).toBe(DIMENSION_STATUS.SCORED);

    // Renormalised: commercial 0.35/0.80, engagement 0.25/0.80, relationship 0.20/0.80
    const scored = result.dimensions.filter((d) => d.status === DIMENSION_STATUS.SCORED);
    const weightSum = scored.reduce((a, d) => a + Number(d.effectiveWeight || 0), 0);
    expect(weightSum).toBeCloseTo(1, 5);

    expect(byCode.commercial.effectiveWeight).toBeCloseTo(0.35 / 0.8, 5);
    expect(byCode.engagement.effectiveWeight).toBeCloseTo(0.25 / 0.8, 5);
    expect(byCode.relationship.effectiveWeight).toBeCloseTo(0.2 / 0.8, 5);

    expect(result.score).not.toBeNull();
    expect(typeof result.score).toBe('number');
    expect(result.missing).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'mraEis' })])
    );
    // Never label health as churn probability (explicit non-claim in disclaimer is OK)
    expect(result.churnProbability).toBeUndefined();
    expect(result.band).not.toMatch(/churn/i);
    expect(String(result.disclaimer || '').toLowerCase()).toMatch(/not churn/);
  });
});

describe('evaluateCustomerHealth — suspended → CRITICAL', () => {
  it('forces CRITICAL band when tenant/subscription suspended while keeping dim scores', async () => {
    const prisma = makePrisma({
      _tenant: fixtureTenant({ status: 'SUSPENDED' }),
      _subs: [
        fixtureSub({
          status: 'suspended',
          isActive: false,
        }),
      ],
      _entitlement: null,
    });

    const result = await evaluateCustomerHealth(prisma, {
      admin: superAdmin,
      tenantId: 'tenant-health-1',
    });

    expect(result.ok).toBe(true);
    expect(result.band).toBe(HEALTH_BANDS.CRITICAL);
    expect(result.overrides.some((o) => /suspend|cancel/i.test(o.code || o.reason || ''))).toBe(
      true
    );
    const scored = result.dimensions.filter((d) => d.status === DIMENSION_STATUS.SCORED);
    expect(scored.length).toBeGreaterThanOrEqual(2);
    for (const d of scored) {
      expect(typeof d.score).toBe('number');
    }
  });

  it('keeps CRITICAL when suspended override applies even if score is null', async () => {
    const prisma = makePrisma({
      _tenant: fixtureTenant({ status: 'SUSPENDED' }),
      _subs: [
        fixtureSub({
          status: 'suspended',
          isActive: false,
        }),
      ],
      platformInvoice: undefined,
      platformPayment: undefined,
      user: {
        count: vi.fn(async () => {
          throw new Error('user query failed');
        }),
        aggregate: vi.fn(async () => {
          throw new Error('user query failed');
        }),
      },
      _entitlement: null,
      customerOwnership: {
        findMany: vi.fn(async () => {
          throw new Error('ownership failed');
        }),
        findFirst: vi.fn(async () => {
          throw new Error('ownership failed');
        }),
      },
      customerSignal: {
        findMany: vi.fn(async () => {
          throw new Error('signals failed');
        }),
      },
    });

    const result = await evaluateCustomerHealth(prisma, {
      admin: superAdmin,
      tenantId: 'tenant-health-1',
    });

    expect(result.ok).toBe(true);
    expect(result.score).toBeNull();
    expect(result.band).toBe(HEALTH_BANDS.CRITICAL);
    expect(result.confidence).toBe(HEALTH_CONFIDENCE.INSUFFICIENT);
    expect(
      result.overrides.some((o) => o.code === OVERRIDE_CODES.SUSPENDED_OR_CANCELLED)
    ).toBe(true);
  });
});

describe('evaluateCustomerHealth — portfolio forbidden', () => {
  it('forbids agent evaluating tenant outside portfolio', async () => {
    const prisma = makePrisma({
      _ownershipRows: [
        {
          id: 'own-1',
          tenantId: 'tenant-health-1',
          ownerAdminId: 'admin-owner-1',
          status: 'ACTIVE',
          isPrimary: true,
          endAt: null,
        },
      ],
    });

    // Agent owns tenant-health-1 only — but we request a different tenant
    prisma.tenant.findUnique = vi.fn(async ({ where }) =>
      where.id === 'tenant-other-9'
        ? fixtureTenant({ id: 'tenant-other-9', name: 'Other', subdomain: 'other-9' })
        : fixtureTenant()
    );

    const result = await evaluateCustomerHealth(prisma, {
      admin: agentOwner,
      tenantId: 'tenant-other-9',
    });

    expect(result.forbidden).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.score).toBeUndefined();
  });
});

describe('evaluateCustomerHealth — insufficient evidence → null score', () => {
  it('returns null score + UNKNOWN + INSUFFICIENT when fewer than 2 SCORED dims', async () => {
    const prisma = makePrisma({
      // Break commercial + engagement loaders
      platformInvoice: undefined,
      platformPayment: undefined,
      user: {
        count: vi.fn(async () => {
          throw new Error('user query failed');
        }),
        aggregate: vi.fn(async () => {
          throw new Error('user query failed');
        }),
      },
      // No EIS → N/A
      _entitlement: null,
      _subs: [fixtureSub({ plan: '1month' })],
      // Break relationship signals + ownership
      customerOwnership: {
        findMany: vi.fn(async () => {
          throw new Error('ownership failed');
        }),
        findFirst: vi.fn(async () => {
          throw new Error('ownership failed');
        }),
      },
      customerSignal: {
        findMany: vi.fn(async () => {
          throw new Error('signals failed');
        }),
      },
    });

    const result = await evaluateCustomerHealth(prisma, {
      admin: superAdmin,
      tenantId: 'tenant-health-1',
    });

    expect(result.ok).toBe(true);
    expect(result.score).toBeNull();
    expect(result.band).toBe(HEALTH_BANDS.UNKNOWN);
    expect(result.confidence).toBe(HEALTH_CONFIDENCE.INSUFFICIENT);
    const scoredCount = (result.dimensions || []).filter(
      (d) => d.status === DIMENSION_STATUS.SCORED
    ).length;
    expect(scoredCount).toBeLessThan(2);
  });
});

describe('evaluateCustomerHealth — auth + happy path', () => {
  it('forbids without customerHealth.read / customers.read / dashboard.view', async () => {
    const result = await evaluateCustomerHealth(makePrisma(), {
      admin: {
        id: 'a0',
        role: 'Platform Support',
        permissions: {},
      },
      tenantId: 'tenant-health-1',
    });
    expect(result.forbidden).toBe(true);
    expect(result.ok).toBe(false);
  });

  it('scores healthy customer with EIS ACTIVE', async () => {
    const prisma = makePrisma({
      _entitlement: {
        status: 'ACTIVE',
        allowedEnvironment: 'PRODUCTION',
        sandboxAllowed: true,
        productionAllowed: true,
        entitlementSource: 'MANUAL',
        effectiveFrom: new Date(),
        effectiveUntil: null,
        isCurrent: true,
      },
      _subs: [fixtureSub({ plan: 'eis-monthly' })],
    });

    const result = await evaluateCustomerHealth(prisma, {
      admin: healthReader,
      tenantId: 'tenant-health-1',
    });

    expect(result.ok).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(65);
    expect([HEALTH_BANDS.HEALTHY, HEALTH_BANDS.STABLE]).toContain(result.band);
    expect(result.confidence).not.toBe(HEALTH_CONFIDENCE.INSUFFICIENT);
    expect(result.drivers.length).toBeGreaterThan(0);
  });
});

describe('persistHealthSnapshot', () => {
  it('creates immutable snapshot row from evaluation', async () => {
    const prisma = makePrisma();
    const evaluation = await evaluateCustomerHealth(prisma, {
      admin: superAdmin,
      tenantId: 'tenant-health-1',
    });
    expect(evaluation.ok).toBe(true);

    const snap = await persistHealthSnapshot(prisma, evaluation);
    expect(prisma.customerHealthSnapshot.create).toHaveBeenCalled();
    expect(snap.tenantId).toBe('tenant-health-1');
    expect(snap.definitionVersion).toBe('customer-health-2026-07-28');
    expect(snap.band).toBe(evaluation.band);
  });
});

describe('list / export / overview — portfolio isolation', () => {
  it('forbids list when agent requests out-of-portfolio tenantId', async () => {
    const prisma = makePrisma({
      _snapshotRows: fixtureSnapshots(),
      _ownershipRows: [
        {
          id: 'own-1',
          tenantId: 'tenant-health-1',
          ownerAdminId: 'admin-owner-1',
          status: 'ACTIVE',
          isPrimary: true,
          endAt: null,
        },
      ],
    });

    const listed = await listHealthSnapshots(prisma, {
      admin: agentOwner,
      tenantId: 'tenant-other-9',
    });

    expect(listed.ok).toBe(false);
    expect(listed.forbidden).toBe(true);
    expect(listed.rows).toEqual([]);
    expect(prisma.customerHealthSnapshot.findMany).not.toHaveBeenCalled();
  });

  it('scopes list to owned tenants for health-only agent (no customers.read)', async () => {
    const prisma = makePrisma({
      _snapshotRows: fixtureSnapshots(),
      _ownershipRows: [
        {
          id: 'own-1',
          tenantId: 'tenant-health-1',
          ownerAdminId: 'admin-owner-1',
          status: 'ACTIVE',
          isPrimary: true,
          endAt: null,
        },
      ],
    });

    const listed = await listHealthSnapshots(prisma, {
      admin: healthOnlyAgent,
    });

    expect(listed.ok).toBe(true);
    expect(listed.forbidden).toBeFalsy();
    expect(listed.rows.map((r) => r.tenantId)).toEqual(['tenant-health-1']);
    expect(listed.scope?.isAgentScoped).toBe(true);
  });

  it('export does not leak out-of-portfolio snapshots for health-only agent', async () => {
    const prisma = makePrisma({
      _snapshotRows: fixtureSnapshots(),
      _ownershipRows: [
        {
          id: 'own-1',
          tenantId: 'tenant-health-1',
          ownerAdminId: 'admin-owner-1',
          status: 'ACTIVE',
          isPrimary: true,
          endAt: null,
        },
      ],
    });

    const pack = await buildHealthExportPack(prisma, {
      admin: healthOnlyAgent,
    });

    expect(pack.ok).toBe(true);
    expect(pack.rows.map((r) => r.tenantId)).toEqual(['tenant-health-1']);
    expect(pack.rows.some((r) => r.tenantId === 'tenant-other-9')).toBe(false);
  });

  it('overview band counts exclude out-of-portfolio tenants for health-only agent', async () => {
    const prisma = makePrisma({
      _snapshotRows: fixtureSnapshots(),
      _ownershipRows: [
        {
          id: 'own-1',
          tenantId: 'tenant-health-1',
          ownerAdminId: 'admin-owner-1',
          status: 'ACTIVE',
          isPrimary: true,
          endAt: null,
        },
      ],
    });

    const overview = await buildHealthOverviewPack(prisma, {
      admin: healthOnlyAgent,
    });

    expect(overview.ok).toBe(true);
    expect(overview.tenantsWithSnapshots).toBe(1);
    expect(overview.bandCounts[HEALTH_BANDS.HEALTHY]).toBe(1);
    expect(overview.bandCounts[HEALTH_BANDS.AT_RISK] || 0).toBe(0);
  });

  it('health-only agent with empty portfolio sees no fleet snapshots', async () => {
    const prisma = makePrisma({
      _snapshotRows: fixtureSnapshots(),
      _ownershipRows: [],
    });

    const listed = await listHealthSnapshots(prisma, {
      admin: {
        id: 'admin-no-portfolio',
        role: 'Platform Support',
        permissions: {
          systemAdmin: { intel: { 'customerHealth.read': true } },
        },
      },
    });

    expect(listed.ok).toBe(true);
    expect(listed.rows).toEqual([]);
  });
});
