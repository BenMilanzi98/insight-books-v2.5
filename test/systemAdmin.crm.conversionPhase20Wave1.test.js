/**
 * Phase 20 Wave 1 — Closed-Won readiness / acceptance / authority / approvals harden.
 * UNKNOWN ≠ READY; expired/superseded block; view≠acceptance; unapproved discount blocks;
 * close + conversion create idempotent; close alone does not provision.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  evaluateClosedWonReadiness,
  evaluateConversionReadiness,
  acceptCommercialDocument,
  recordCustomerView,
  closeOpportunityWon,
  createConversionRequest,
  createConversionPlan,
  executeClosedWonConversion,
  CRM_COMMERCIAL_DOCUMENT_STATUS,
  CRM_CONVERSION_READINESS_STATUS,
  CRM_DISCOUNT_REQUEST_STATUS,
  CRM_READINESS_STATUS,
  resolveClosedWonAcceptanceId,
  commercialReadinessRequiredByPolicy,
} from '@/lib/admin/crm';
import {
  CRM_ACCEPTANCE_AUTHORITY_STATUS,
  evaluateAcceptanceAuthorityStatus,
  assertEngagementIsNotAcceptance,
} from '@/lib/admin/crm/commercial/acceptance.js';
import {
  buildCommercialAcceptanceWriteData,
  hasCrmCommercialAcceptanceAuthorityStatusField,
  normalizeAcceptanceAuthorityStatus,
} from '@/lib/admin/crm/commercial/model.js';

function superAdmin(id = 'super-p20-w1') {
  return {
    id,
    role: 'Super Admin',
    permissions: {
      'systemAdmin.crm.view': true,
      'systemAdmin.crm.opportunities.view': true,
      'systemAdmin.crm.opportunities.edit': true,
      'systemAdmin.crm.pipeline.transitionStages': true,
    },
  };
}

function salesRepNoScope(id = 'rep-no-scope') {
  return {
    id,
    role: 'Sales Rep',
    permissions: {
      'systemAdmin.crm.opportunities.view': true,
      'systemAdmin.crm.opportunities.edit': true,
      'systemAdmin.crm.pipeline.transitionStages': true,
    },
    crmScope: {
      mode: 'territory',
      territoryIds: [],
      teamIds: [],
      ownerAdminIds: [],
    },
  };
}

function simpleCrud(store, idPrefix) {
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
      if (where.opportunityNumber) {
        return store.find((r) => r.opportunityNumber === where.opportunityNumber) || null;
      }
      return null;
    }),
    findFirst: vi.fn(async ({ where = {}, orderBy } = {}) => {
      let rows = [...store];
      if (where.documentVersionId) {
        rows = rows.filter((r) => r.documentVersionId === where.documentVersionId);
      }
      if (where.acceptanceId) {
        rows = rows.filter((r) => r.acceptanceId === where.acceptanceId);
      }
      if (where.opportunityId) {
        rows = rows.filter((r) => r.opportunityId === where.opportunityId);
      }
      if (where.status) rows = rows.filter((r) => r.status === where.status);
      if (where.idempotencyKey) {
        rows = rows.filter((r) => r.idempotencyKey === where.idempotencyKey);
      }
      if (where.tokenHash) {
        rows = rows.filter((r) => r.tokenHash === where.tokenHash);
      }
      if (orderBy?.createdAt === 'desc') {
        rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
      return rows[0] || null;
    }),
    findMany: vi.fn(async ({ where = {} } = {}) => {
      let rows = [...store];
      const matchClause = (clause = {}) => {
        if (clause.documentVersionId != null) {
          return rows.filter((r) => r.documentVersionId === clause.documentVersionId);
        }
        if (clause.opportunityId != null) {
          return rows.filter((r) => r.opportunityId === clause.opportunityId);
        }
        if (clause.status != null) {
          if (typeof clause.status === 'object' && clause.status.in) {
            return rows.filter((r) => clause.status.in.includes(r.status));
          }
          if (typeof clause.status === 'object' && clause.status.not) {
            return rows.filter((r) => r.status !== clause.status.not);
          }
          return rows.filter((r) => r.status === clause.status);
        }
        return null;
      };
      // Real OR support — do not return all store rows when OR is present
      if (Array.isArray(where.OR) && where.OR.length > 0) {
        const matched = new Map();
        for (const clause of where.OR) {
          const subset = matchClause(clause);
          if (!subset) continue;
          for (const row of subset) matched.set(row.id, row);
        }
        rows = [...matched.values()];
      } else {
        if (where.documentVersionId) {
          rows = rows.filter((r) => r.documentVersionId === where.documentVersionId);
        }
        if (where.opportunityId) {
          rows = rows.filter((r) => r.opportunityId === where.opportunityId);
        }
        if (where.status) {
          if (typeof where.status === 'object' && where.status.in) {
            rows = rows.filter((r) => where.status.in.includes(r.status));
          } else if (typeof where.status === 'object' && where.status.not) {
            rows = rows.filter((r) => r.status !== where.status.not);
          } else {
            rows = rows.filter((r) => r.status === where.status);
          }
        }
      }
      return rows;
    }),
    update: vi.fn(async ({ where = {}, data = {} } = {}) => {
      const row = store.find((r) => r.id === where.id);
      if (!row) throw new Error('not found');
      Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
      return row;
    }),
    updateMany: vi.fn(async ({ where = {}, data = {} } = {}) => {
      let rows = [...store];
      if (where.id) rows = rows.filter((r) => r.id === where.id);
      if (where.version != null) rows = rows.filter((r) => r.version === where.version);
      if (where.documentVersionId) {
        rows = rows.filter((r) => r.documentVersionId === where.documentVersionId);
      }
      if (where.revokedAt === null) rows = rows.filter((r) => r.revokedAt == null);
      for (const row of rows) {
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
      }
      return { count: rows.length };
    }),
    count: vi.fn(async () => store.length),
  };
}

function makePrisma(overrides = {}) {
  const documentVersionStore = overrides._documentVersionStore || [
    {
      id: 'cdv-ready',
      documentId: 'doc-1',
      versionNumber: 1,
      status: CRM_COMMERCIAL_DOCUMENT_STATUS.ACCEPTED,
      immutable: true,
      expiresAt: null,
    },
  ];
  const acceptanceStore = overrides._acceptanceStore || [
    {
      id: 'accp-ready',
      documentVersionId: 'cdv-ready',
      artifactId: 'art-1',
      checksumSha256: 'checksum-ready-abc',
      recipientId: 'rcp-1',
      authorityRole: 'SIGNATORY',
      authorityStatus: CRM_ACCEPTANCE_AUTHORITY_STATUS.VERIFIED,
      acceptedAt: new Date('2026-07-30T10:00:00.000Z'),
      idempotencyKey: 'accept-ready',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  const opportunityStore = overrides._opportunityStore || [
    {
      id: 'opp-1',
      opportunityNumber: 'OPP-2026-000001',
      stageCode: 'CUSTOMER_DECISION',
      status: 'OPEN',
      accountId: 'acct-1',
      contactId: 'con-1',
      currency: 'MWK',
      amount: 5000,
      version: 1,
      ownerAdminId: 'super-p20-w1',
      territoryId: 'terr-1',
      createdAt: new Date('2026-07-01T00:00:00Z'),
      updatedAt: new Date('2026-07-01T00:00:00Z'),
    },
  ];
  const discountStore = overrides._discountStore || [];
  const approvalStore = overrides._approvalStore || [];
  const recipientStore = overrides._recipientStore || [
    {
      id: 'rcp-1',
      authorityRole: 'SIGNATORY',
      authorityStatus: CRM_ACCEPTANCE_AUTHORITY_STATUS.VERIFIED,
    },
  ];
  const reviewAccessStore = overrides._reviewAccessStore || [
    {
      id: 'ra-1',
      documentVersionId: 'cdv-view',
      recipientId: 'rcp-1',
      artifactId: 'art-view',
      checksumSha256: 'checksum-view',
      tokenHash: 'token-view-hash',
      revokedAt: null,
      expiresAt: null,
    },
  ];
  const viewStore = overrides._viewStore || [];
  const handoffStore = overrides._handoffStore || [];
  const requestStore = overrides._requestStore || [];
  const requestHistoryStore = overrides._requestHistoryStore || [];
  const planStore = overrides._planStore || [];
  const planVersionStore = overrides._planVersionStore || [];
  const dryRunStore = overrides._dryRunStore || [];
  const conversionStore = overrides._conversionStore || [];
  const conversionHistoryStore = overrides._conversionHistoryStore || [];
  const stepStore = overrides._stepStore || [];
  const attemptStore = overrides._attemptStore || [];
  const failureStore = overrides._failureStore || [];
  const seqStore = overrides._seqStore || [];
  const stageHistoryStore = overrides._stageHistoryStore || [];
  const timelineStore = overrides._timelineStore || [];
  const customerStore = overrides._customerStore || [];
  const tenantStore = overrides._tenantStore || [];
  const subscriptionStore = overrides._subscriptionStore || [];
  const artifactStore = overrides._artifactStore || [
    {
      id: 'art-1',
      versionId: 'cdv-ready',
      documentVersionId: 'cdv-ready',
      sha256: 'checksum-ready-abc',
    },
    {
      id: 'art-view',
      versionId: 'cdv-view',
      documentVersionId: 'cdv-view',
      sha256: 'checksum-view',
    },
  ];
  const checksumStore = overrides._checksumStore || [
    { artifactId: 'art-1', sha256: 'checksum-ready-abc' },
    { artifactId: 'art-view', sha256: 'checksum-view' },
  ];

  const prisma = {
    $transaction: vi.fn(async (fn) => fn(prisma)),
    _acceptanceStore: acceptanceStore,
    _documentVersionStore: documentVersionStore,
    _opportunityStore: opportunityStore,
    _discountStore: discountStore,
    _conversionStore: conversionStore,
    _requestStore: requestStore,
    _customerStore: customerStore,
    _tenantStore: tenantStore,
    _subscriptionStore: subscriptionStore,
    _viewStore: viewStore,
    crmNumberSeq: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        const key = where.prefix_year || where;
        return seqStore.find((r) => r.prefix === key.prefix && r.year === key.year) || null;
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
    crmCommercialAcceptance: {
      ...simpleCrud(acceptanceStore, 'accp'),
      // Model guard: authorityStatus column available (Prisma + SQL fallback)
      supportsAuthorityStatus: true,
    },
    crmCommercialDocumentVersion: simpleCrud(documentVersionStore, 'cdv'),
    crmCommercialRecipient: simpleCrud(recipientStore, 'rcp'),
    crmCommercialReviewAccess: simpleCrud(reviewAccessStore, 'ra'),
    crmCommercialCustomerView: simpleCrud(viewStore, 'view'),
    crmCommercialArtifact: {
      create: vi.fn(async ({ data }) => {
        const row = { id: data.id || `art-${artifactStore.length + 1}`, ...data };
        artifactStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) =>
        artifactStore.find((r) => r.id === where.id) || null
      ),
    },
    crmCommercialArtifactChecksum: {
      findUnique: vi.fn(async ({ where = {} } = {}) =>
        checksumStore.find((r) => r.artifactId === where.artifactId) || null
      ),
      findFirst: vi.fn(async ({ where = {} } = {}) =>
        checksumStore.find((r) => r.artifactId === where.artifactId) || null
      ),
    },
    // accept path loads checksum via crmCommercialChecksum (Phase 15 naming)
    crmCommercialChecksum: {
      create: vi.fn(async ({ data }) => {
        const row = { id: data.id || `chk-${checksumStore.length + 1}`, ...data };
        checksumStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.artifactId) {
          return checksumStore.find((r) => r.artifactId === where.artifactId) || null;
        }
        if (where.artifactId_algorithm) {
          return (
            checksumStore.find(
              (r) =>
                r.artifactId === where.artifactId_algorithm.artifactId &&
                (!where.artifactId_algorithm.algorithm ||
                  r.algorithm === where.artifactId_algorithm.algorithm)
            ) || null
          );
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) =>
        checksumStore.find((r) => r.artifactId === where.artifactId) || null
      ),
    },
    crmDiscountRequest: simpleCrud(discountStore, 'dr'),
    crmApprovalRequest: simpleCrud(approvalStore, 'apr'),
    crmClosedWonConversionHandoff: simpleCrud(handoffStore, 'handoff'),
    crmOpportunity: {
      ...simpleCrud(opportunityStore, 'opp'),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return opportunityStore.find((r) => r.id === where.id) || null;
        if (where.opportunityNumber) {
          return (
            opportunityStore.find((r) => r.opportunityNumber === where.opportunityNumber) || null
          );
        }
        return null;
      }),
    },
    crmOpportunityStageHistory: simpleCrud(stageHistoryStore, 'osh'),
    crmOpportunityTimelineEvent: simpleCrud(timelineStore, 'otl'),
    crmTimelineEvent: simpleCrud(timelineStore, 'tl'),
    crmConversionRequest: {
      ...simpleCrud(requestStore, 'cvr'),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return requestStore.find((r) => r.id === where.id) || null;
        if (where.idempotencyKey) {
          return requestStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        if (where.requestNumber) {
          return requestStore.find((r) => r.requestNumber === where.requestNumber) || null;
        }
        return null;
      }),
    },
    crmConversionRequestStatusHistory: simpleCrud(requestHistoryStore, 'cvrh'),
    crmConversionPlan: simpleCrud(planStore, 'plan'),
    crmConversionPlanVersion: simpleCrud(planVersionStore, 'pv'),
    crmConversionDryRun: simpleCrud(dryRunStore, 'dry'),
    crmConversion: {
      ...simpleCrud(conversionStore, 'cvn'),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return conversionStore.find((r) => r.id === where.id) || null;
        if (where.idempotencyKey) {
          return conversionStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        if (where.conversionNumber) {
          return conversionStore.find((r) => r.conversionNumber === where.conversionNumber) || null;
        }
        return null;
      }),
    },
    crmConversionStatusHistory: simpleCrud(conversionHistoryStore, 'cvnh'),
    crmConversionStep: simpleCrud(stepStore, 'step'),
    crmConversionAttempt: simpleCrud(attemptStore, 'att'),
    crmConversionFailure: simpleCrud(failureStore, 'fail'),
    customer: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `cust-${customerStore.length + 1}`, ...data };
        customerStore.push(row);
        return row;
      }),
      findMany: vi.fn(async () => [...customerStore]),
    },
    tenant: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `ten-${tenantStore.length + 1}`, ...data };
        tenantStore.push(row);
        return row;
      }),
      findMany: vi.fn(async () => [...tenantStore]),
    },
    subscription: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `sub-${subscriptionStore.length + 1}`, ...data };
        subscriptionStore.push(row);
        return row;
      }),
      findMany: vi.fn(async () => [...subscriptionStore]),
    },
  };

  return prisma;
}

describe('Phase 20 Wave 1 — Closed-Won readiness / acceptance / authority / approvals', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes UNKNOWN readiness status and UNKNOWN ≠ READY', () => {
    expect(CRM_CONVERSION_READINESS_STATUS.UNKNOWN).toBe('UNKNOWN');
    expect(CRM_READINESS_STATUS.UNKNOWN).toBe('UNKNOWN');
    expect(CRM_CONVERSION_READINESS_STATUS.UNKNOWN).not.toBe(
      CRM_CONVERSION_READINESS_STATUS.READY
    );
    expect(CRM_ACCEPTANCE_AUTHORITY_STATUS.UNKNOWN).toBe('UNKNOWN');
    expect(CRM_ACCEPTANCE_AUTHORITY_STATUS.VERIFICATION_REQUIRED).toBe(
      'VERIFICATION_REQUIRED'
    );
    expect(CRM_ACCEPTANCE_AUTHORITY_STATUS.VERIFIED).toBe('VERIFIED');
  });

  it('expired commercial version blocks Closed-Won readiness (not READY)', async () => {
    const prisma = makePrisma({
      _documentVersionStore: [
        {
          id: 'cdv-expired',
          documentId: 'doc-exp',
          versionNumber: 1,
          status: CRM_COMMERCIAL_DOCUMENT_STATUS.EXPIRED,
          immutable: true,
          expiresAt: new Date('2026-06-01T00:00:00Z'),
        },
      ],
      _acceptanceStore: [
        {
          id: 'accp-exp',
          documentVersionId: 'cdv-expired',
          artifactId: 'art-1',
          checksumSha256: 'checksum-ready-abc',
          recipientId: 'rcp-1',
          authorityRole: 'SIGNATORY',
          authorityStatus: CRM_ACCEPTANCE_AUTHORITY_STATUS.VERIFIED,
          acceptedAt: new Date('2026-05-01T00:00:00Z'),
        },
      ],
    });

    const result = await evaluateClosedWonReadiness(prisma, {
      acceptanceId: 'accp-exp',
      admin: superAdmin(),
    });

    expect(result.ok).toBe(true);
    expect(result.readinessStatus).not.toBe('READY');
    expect(result.readinessStatus).not.toBe(CRM_CONVERSION_READINESS_STATUS.READY);
    expect(['BLOCKED', 'NOT_READY']).toContain(result.readinessStatus);
    expect(
      result.checklist.some(
        (i) =>
          (i.key === 'version_not_expired' || i.key === 'commercial_version_status') &&
          i.blocker &&
          !i.ok
      )
    ).toBe(true);
  });

  it('superseded proposal version blocks Closed-Won readiness', async () => {
    const prisma = makePrisma({
      _documentVersionStore: [
        {
          id: 'cdv-super',
          documentId: 'doc-super',
          versionNumber: 1,
          status: CRM_COMMERCIAL_DOCUMENT_STATUS.SUPERSEDED,
          immutable: true,
        },
      ],
      _acceptanceStore: [
        {
          id: 'accp-super',
          documentVersionId: 'cdv-super',
          artifactId: 'art-1',
          checksumSha256: 'checksum-ready-abc',
          recipientId: 'rcp-1',
          authorityRole: 'SIGNATORY',
          authorityStatus: CRM_ACCEPTANCE_AUTHORITY_STATUS.VERIFIED,
          acceptedAt: new Date('2026-05-01T00:00:00Z'),
        },
      ],
    });

    const result = await evaluateClosedWonReadiness(prisma, {
      acceptanceId: 'accp-super',
      admin: superAdmin(),
    });

    expect(result.readinessStatus).not.toBe('READY');
    expect(['BLOCKED', 'NOT_READY']).toContain(result.readinessStatus);
    expect(
      result.checklist.some(
        (i) =>
          (i.key === 'version_not_superseded' || i.key === 'commercial_version_status') &&
          i.blocker &&
          !i.ok
      )
    ).toBe(true);
  });

  it('HANDED_OFF prior handoff does not force READY when commercial version expired', async () => {
    const prisma = makePrisma({
      _documentVersionStore: [
        {
          id: 'cdv-ho-exp',
          documentId: 'doc-ho-exp',
          versionNumber: 1,
          status: CRM_COMMERCIAL_DOCUMENT_STATUS.EXPIRED,
          immutable: true,
          expiresAt: new Date('2026-06-01T00:00:00Z'),
        },
      ],
      _acceptanceStore: [
        {
          id: 'accp-ho-exp',
          documentVersionId: 'cdv-ho-exp',
          artifactId: 'art-1',
          checksumSha256: 'checksum-ready-abc',
          recipientId: 'rcp-1',
          authorityRole: 'SIGNATORY',
          authorityStatus: CRM_ACCEPTANCE_AUTHORITY_STATUS.VERIFIED,
          acceptedAt: new Date('2026-05-01T00:00:00Z'),
        },
      ],
      _handoffStore: [
        {
          id: 'handoff-ho-exp',
          acceptanceId: 'accp-ho-exp',
          documentVersionId: 'cdv-ho-exp',
          opportunityId: 'opp-1',
          payloadJson: { type: 'CRM_CLOSED_WON_CONVERSION_HANDOFF' },
          idempotencyKey: 'handoff:accp-ho-exp',
          createdAt: new Date('2026-05-02T00:00:00Z'),
          updatedAt: new Date('2026-05-02T00:00:00Z'),
        },
      ],
    });

    const result = await evaluateClosedWonReadiness(prisma, {
      acceptanceId: 'accp-ho-exp',
      admin: superAdmin(),
    });

    expect(result.ok).toBe(true);
    expect(result.readinessStatus).not.toBe('READY');
    expect(result.readinessStatus).not.toBe(CRM_READINESS_STATUS.HANDED_OFF);
    expect(result.ready).not.toBe(true);
    expect(['BLOCKED', 'NOT_READY']).toContain(result.readinessStatus);
    expect(result.handoffId).toBe('handoff-ho-exp');
    expect(
      result.checklist.some(
        (i) =>
          (i.key === 'version_not_expired' || i.key === 'commercial_version_status') &&
          i.blocker &&
          !i.ok
      )
    ).toBe(true);
    expect(
      result.checklist.some((i) => i.key === 'phase16_handoff' && i.ok)
    ).toBe(true);
  });

  it('HANDED_OFF prior handoff does not force READY when commercial version superseded', async () => {
    const prisma = makePrisma({
      _documentVersionStore: [
        {
          id: 'cdv-ho-super',
          documentId: 'doc-ho-super',
          versionNumber: 1,
          status: CRM_COMMERCIAL_DOCUMENT_STATUS.SUPERSEDED,
          immutable: true,
        },
      ],
      _acceptanceStore: [
        {
          id: 'accp-ho-super',
          documentVersionId: 'cdv-ho-super',
          artifactId: 'art-1',
          checksumSha256: 'checksum-ready-abc',
          recipientId: 'rcp-1',
          authorityRole: 'SIGNATORY',
          authorityStatus: CRM_ACCEPTANCE_AUTHORITY_STATUS.VERIFIED,
          acceptedAt: new Date('2026-05-01T00:00:00Z'),
        },
      ],
      _handoffStore: [
        {
          id: 'handoff-ho-super',
          acceptanceId: 'accp-ho-super',
          documentVersionId: 'cdv-ho-super',
          opportunityId: 'opp-1',
          payloadJson: { type: 'CRM_CLOSED_WON_CONVERSION_HANDOFF' },
          idempotencyKey: 'handoff:accp-ho-super',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });

    const result = await evaluateClosedWonReadiness(prisma, {
      acceptanceId: 'accp-ho-super',
      admin: superAdmin(),
    });

    expect(result.readinessStatus).not.toBe('READY');
    expect(result.readinessStatus).not.toBe(CRM_READINESS_STATUS.HANDED_OFF);
    expect(['BLOCKED', 'NOT_READY']).toContain(result.readinessStatus);
    expect(
      result.checklist.some(
        (i) =>
          (i.key === 'version_not_superseded' || i.key === 'commercial_version_status') &&
          i.blocker &&
          !i.ok
      )
    ).toBe(true);
  });

  it('HANDED_OFF prior handoff does not invent Authority verified when authority invalid', async () => {
    const prisma = makePrisma({
      _handoffStore: [
        {
          id: 'handoff-ho-auth',
          acceptanceId: 'accp-ready',
          documentVersionId: 'cdv-ready',
          opportunityId: 'opp-1',
          payloadJson: { type: 'CRM_CLOSED_WON_CONVERSION_HANDOFF' },
          idempotencyKey: 'handoff:accp-ready-auth',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
    // Invalidate authority after historical handoff was emitted
    prisma._acceptanceStore[0].authorityStatus =
      CRM_ACCEPTANCE_AUTHORITY_STATUS.UNKNOWN;
    prisma._acceptanceStore[0].authorityRole = null;

    const result = await evaluateClosedWonReadiness(prisma, {
      acceptanceId: 'accp-ready',
      admin: superAdmin(),
    });

    expect(result.readinessStatus).not.toBe('READY');
    expect(result.readinessStatus).not.toBe(CRM_READINESS_STATUS.HANDED_OFF);
    expect(['BLOCKED', 'NOT_READY', 'UNKNOWN']).toContain(result.readinessStatus);
    expect(
      result.checklist.some(
        (i) =>
          i.key === 'acceptance_authority_status' &&
          i.blocker &&
          !i.ok
      )
    ).toBe(true);
    expect(
      result.checklist.some(
        (i) =>
          i.key === 'acceptance_authority_status' &&
          String(i.detail || '').toLowerCase().includes('authority verified')
      )
    ).toBe(false);
  });

  it('HANDED_OFF still returned when prior handoff exists and commercial truth remains valid', async () => {
    const prisma = makePrisma({
      _handoffStore: [
        {
          id: 'handoff-ho-ok',
          acceptanceId: 'accp-ready',
          documentVersionId: 'cdv-ready',
          opportunityId: 'opp-1',
          payloadJson: { type: 'CRM_CLOSED_WON_CONVERSION_HANDOFF' },
          idempotencyKey: 'handoff:accp-ready-ok',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });

    const result = await evaluateClosedWonReadiness(prisma, {
      acceptanceId: 'accp-ready',
      admin: superAdmin(),
    });

    expect(result.ok).toBe(true);
    expect(result.readinessStatus).toBe(CRM_READINESS_STATUS.HANDED_OFF);
    expect(result.ready).toBe(true);
    expect(result.handoffId).toBe('handoff-ho-ok');
    expect(
      result.checklist.some((i) => i.key === 'commercial_version_status' && i.ok)
    ).toBe(true);
  });

  it('view/open/silence never counts as acceptance', async () => {
    const prisma = makePrisma({
      _documentVersionStore: [
        {
          id: 'cdv-view',
          documentId: 'doc-view',
          versionNumber: 1,
          status: CRM_COMMERCIAL_DOCUMENT_STATUS.DELIVERED,
          immutable: true,
        },
      ],
      _acceptanceStore: [],
    });

    // Engagement helpers must refuse to treat view/open/silence as acceptance
    expect(
      assertEngagementIsNotAcceptance({
        engagementType: 'VIEW',
        documentVersionId: 'cdv-view',
      }).ok
    ).toBe(false);
    expect(
      assertEngagementIsNotAcceptance({
        engagementType: 'OPEN',
        documentVersionId: 'cdv-view',
      }).ok
    ).toBe(false);
    expect(
      assertEngagementIsNotAcceptance({
        engagementType: 'SILENCE',
        documentVersionId: 'cdv-view',
      }).ok
    ).toBe(false);

    const viewed = await recordCustomerView(prisma, {
      token: 'token-view',
      tokenHash: 'token-view-hash',
      recipientId: 'rcp-1',
      now: new Date('2026-07-31T12:00:00Z'),
    });
    // View may succeed or require token resolution — either way must not create acceptance
    if (viewed.ok) {
      expect(viewed.acceptance).toBeFalsy();
      expect(prisma._acceptanceStore.length).toBe(0);
    }
    expect(prisma._acceptanceStore.length).toBe(0);

    // VIEWED status alone must not invent acceptance
    const acceptViaView = await acceptCommercialDocument(prisma, {
      documentVersionId: 'cdv-view',
      artifactId: 'art-view',
      checksumSha256: 'checksum-view',
      recipientId: 'rcp-1',
      authorityRole: 'SIGNATORY',
      // Explicitly missing required binding fields would fail; silence path:
      inferFromView: true,
      silenceAsAcceptance: true,
    });
    expect(acceptViaView.ok === false || acceptViaView.inferred !== true).toBe(true);
    if (acceptViaView.error) {
      expect(String(acceptViaView.error)).toMatch(
        /infer|view|silence|engagement|not.?acceptance/i
      );
    }
  });

  it('authority UNKNOWN / VERIFICATION_REQUIRED blocks Closed-Won readiness', async () => {
    expect(
      evaluateAcceptanceAuthorityStatus({
        authorityRole: 'SIGNATORY',
        authorityStatus: CRM_ACCEPTANCE_AUTHORITY_STATUS.UNKNOWN,
      }).status
    ).toBe(CRM_ACCEPTANCE_AUTHORITY_STATUS.UNKNOWN);
    expect(
      evaluateAcceptanceAuthorityStatus({
        authorityRole: 'SIGNATORY',
        // presence of role alone must not imply VERIFIED
      }).status
    ).toBe(CRM_ACCEPTANCE_AUTHORITY_STATUS.UNKNOWN);

    const prismaUnknown = makePrisma({
      _acceptanceStore: [
        {
          id: 'accp-unk',
          documentVersionId: 'cdv-ready',
          artifactId: 'art-1',
          checksumSha256: 'checksum-ready-abc',
          recipientId: 'rcp-1',
          authorityRole: 'SIGNATORY',
          authorityStatus: CRM_ACCEPTANCE_AUTHORITY_STATUS.UNKNOWN,
          acceptedAt: new Date('2026-07-30T10:00:00.000Z'),
        },
      ],
    });
    const unknown = await evaluateClosedWonReadiness(prismaUnknown, {
      acceptanceId: 'accp-unk',
      admin: superAdmin(),
    });
    expect(unknown.readinessStatus).not.toBe('READY');
    expect(['BLOCKED', 'NOT_READY', 'UNKNOWN']).toContain(unknown.readinessStatus);
    expect(
      unknown.checklist.some(
        (i) => i.key === 'acceptance_authority_status' && i.blocker && !i.ok
      )
    ).toBe(true);

    const prismaVerify = makePrisma({
      _acceptanceStore: [
        {
          id: 'accp-vr',
          documentVersionId: 'cdv-ready',
          artifactId: 'art-1',
          checksumSha256: 'checksum-ready-abc',
          recipientId: 'rcp-1',
          authorityRole: 'SIGNATORY',
          authorityStatus: CRM_ACCEPTANCE_AUTHORITY_STATUS.VERIFICATION_REQUIRED,
          acceptedAt: new Date('2026-07-30T10:00:00.000Z'),
        },
      ],
    });
    const verifyReq = await evaluateClosedWonReadiness(prismaVerify, {
      acceptanceId: 'accp-vr',
      admin: superAdmin(),
    });
    expect(verifyReq.readinessStatus).not.toBe('READY');
    expect(
      verifyReq.checklist.some(
        (i) => i.key === 'acceptance_authority_status' && i.blocker && !i.ok
      )
    ).toBe(true);
  });

  it('unapproved material discount blocks Closed-Won readiness', async () => {
    const prisma = makePrisma({
      _discountStore: [
        {
          id: 'dr-pending',
          opportunityId: 'opp-1',
          documentVersionId: 'cdv-ready',
          percent: 20,
          status: CRM_DISCOUNT_REQUEST_STATUS.PENDING,
          requiresApproval: true,
        },
      ],
    });

    // Link acceptance document to opportunity via version document
    prisma._documentVersionStore[0].opportunityId = 'opp-1';

    const result = await evaluateClosedWonReadiness(prisma, {
      acceptanceId: 'accp-ready',
      admin: superAdmin(),
      opportunityId: 'opp-1',
      requireDiscountApprovals: true,
    });

    expect(result.readinessStatus).not.toBe('READY');
    expect(['BLOCKED', 'NOT_READY', 'APPROVAL_REQUIRED']).toContain(result.readinessStatus);
    expect(
      result.checklist.some(
        (i) =>
          (i.key === 'discount_approvals' || i.key === 'material_discount_approved') &&
          i.blocker &&
          !i.ok
      )
    ).toBe(true);
  });

  it('conversion readiness soft-pass is removed — missing acceptance ≠ READY; UNKNOWN ≠ READY', async () => {
    const prisma = makePrisma({
      _acceptanceStore: [],
      _handoffStore: [
        {
          id: 'handoff-pin',
          acceptanceId: 'accp-missing',
          documentVersionId: 'cdv-ready',
          opportunityId: 'opp-1',
          payloadJson: { type: 'CRM_CLOSED_WON_CONVERSION_HANDOFF' },
          idempotencyKey: 'handoff:accp-missing',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });

    // Seed a CVR with handoff pin but acceptance missing from model
    const req = await createConversionRequest(prisma, {
      actorContext: { admin: superAdmin() },
      source: 'PHASE_15_ACCEPTANCE_HANDOFF',
      acceptanceId: 'accp-missing',
      opportunityId: 'opp-1',
      handoffId: 'handoff-pin',
      idempotencyKey: 'cvr-softpass:1',
    });
    expect(req.ok).toBe(true);

    const readiness = await evaluateConversionReadiness(prisma, {
      conversionRequestId: req.request.id,
      admin: superAdmin(),
    });

    expect(readiness.readinessStatus).not.toBe(CRM_CONVERSION_READINESS_STATUS.READY);
    expect(readiness.ok).toBe(false);
    expect([
      CRM_CONVERSION_READINESS_STATUS.NOT_READY,
      CRM_CONVERSION_READINESS_STATUS.BLOCKED,
      CRM_CONVERSION_READINESS_STATUS.UNKNOWN,
    ]).toContain(readiness.readinessStatus);
  });

  it('exact Closed-Won + conversion retry returns same id; close alone does not provision', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();

    const closeArgs = {
      opportunityId: 'opp-1',
      admin,
      winReason: 'BEST_FIT',
      decisionDate: '2026-07-31',
      evidence: [{ type: 'ACCEPTANCE', value: 'accp-ready' }],
      acceptanceId: 'accp-ready',
      idempotencyKey: 'close-exact:1',
    };

    const firstClose = await closeOpportunityWon(prisma, closeArgs);
    expect(firstClose.ok).toBe(true);
    expect(firstClose.tenantCreated).toBe(false);
    expect(firstClose.subscriptionCreated).toBe(false);
    expect(firstClose.invoiceCreated).toBe(false);
    expect(firstClose.paymentCreated).toBe(false);
    expect(firstClose.provisionExecuted).toBe(false);
    expect(prisma.customer.create).not.toHaveBeenCalled();
    expect(prisma.tenant.create).not.toHaveBeenCalled();
    expect(prisma.subscription.create).not.toHaveBeenCalled();

    // Re-open for conversion path: reset stage to allow orchestrator close again via mock path
    // Conversion create idempotency
    const req = await createConversionRequest(prisma, {
      actorContext: { admin },
      source: 'PHASE_15_ACCEPTANCE_HANDOFF',
      acceptanceId: 'accp-ready',
      opportunityId: 'opp-1',
      idempotencyKey: 'cvr-idem:1',
    });
    expect(req.ok).toBe(true);

    const reqRetry = await createConversionRequest(prisma, {
      actorContext: { admin },
      source: 'PHASE_15_ACCEPTANCE_HANDOFF',
      acceptanceId: 'accp-ready',
      opportunityId: 'opp-1',
      idempotencyKey: 'cvr-idem:1',
    });
    expect(reqRetry.ok).toBe(true);
    expect(reqRetry.request.id).toBe(req.request.id);
    expect(prisma._requestStore.length).toBe(1);

    // Already CLOSED_WON — exact close retry must be idempotent (same terminal, no provision)
    const closeRetry = await closeOpportunityWon(prisma, closeArgs);
    expect(
      closeRetry.ok === true ||
        closeRetry.error === 'ALREADY_TERMINAL' ||
        closeRetry.idempotent === true
    ).toBe(true);
    expect(closeRetry.tenantCreated ?? false).toBe(false);
    expect(closeRetry.provisionExecuted ?? false).toBe(false);
    expect(prisma._customerStore.length).toBe(0);
    expect(prisma._tenantStore.length).toBe(0);
    expect(prisma._subscriptionStore.length).toBe(0);
  });

  it('sales-team / territory empty scope fail-closes Closed-Won', async () => {
    const prisma = makePrisma();
    const result = await closeOpportunityWon(prisma, {
      opportunityId: 'opp-1',
      admin: salesRepNoScope(),
      winReason: 'BEST_FIT',
      decisionDate: '2026-07-31',
      evidence: [{ type: 'ACCEPTANCE', value: 'accp-ready' }],
      acceptanceId: 'accp-ready',
      idempotencyKey: 'close-scope:1',
    });

    expect(result.ok).toBe(false);
    expect(result.forbidden || result.error).toBeTruthy();
    expect(String(result.reason || result.error || '')).toMatch(
      /scope|territory|team|fail.?closed|denied/i
    );
    expect(prisma._opportunityStore[0].stageCode).toBe('CUSTOMER_DECISION');
  });

  it('persists authorityStatus on acceptance create (not mock-only / role-implied)', async () => {
    const prisma = makePrisma({
      _acceptanceStore: [],
      _documentVersionStore: [
        {
          id: 'cdv-accept',
          documentId: 'doc-accept',
          versionNumber: 1,
          status: CRM_COMMERCIAL_DOCUMENT_STATUS.DELIVERED,
          immutable: true,
        },
      ],
      _artifactStore: [
        {
          id: 'art-accept',
          versionId: 'cdv-accept',
          documentVersionId: 'cdv-accept',
          sha256: 'checksum-accept-xyz',
        },
      ],
      _checksumStore: [{ artifactId: 'art-accept', sha256: 'checksum-accept-xyz' }],
      _reviewAccessStore: [
        {
          id: 'ra-accept',
          documentVersionId: 'cdv-accept',
          recipientId: 'rcp-1',
          artifactId: 'art-accept',
          checksumSha256: 'checksum-accept-xyz',
          tokenHash: 'token-accept',
          revokedAt: null,
          expiresAt: null,
        },
      ],
    });

    expect(hasCrmCommercialAcceptanceAuthorityStatusField(prisma)).toBe(true);
    expect(normalizeAcceptanceAuthorityStatus(null)).toBe(
      CRM_ACCEPTANCE_AUTHORITY_STATUS.UNKNOWN
    );
    expect(
      buildCommercialAcceptanceWriteData({
        documentVersionId: 'cdv-accept',
        authorityRole: 'SIGNATORY',
        authorityStatus: CRM_ACCEPTANCE_AUTHORITY_STATUS.VERIFIED,
      }).authorityStatus
    ).toBe(CRM_ACCEPTANCE_AUTHORITY_STATUS.VERIFIED);

    const accepted = await acceptCommercialDocument(prisma, {
      documentVersionId: 'cdv-accept',
      artifactId: 'art-accept',
      checksumSha256: 'checksum-accept-xyz',
      recipientId: 'rcp-1',
      authorityRole: 'SIGNATORY',
      idempotencyKey: 'accept-auth-persist:1',
    });
    expect(accepted.ok).toBe(true);
    expect(accepted.acceptance.authorityStatus).toBe(
      CRM_ACCEPTANCE_AUTHORITY_STATUS.VERIFIED
    );
    expect(prisma._acceptanceStore[0].authorityStatus).toBe(
      CRM_ACCEPTANCE_AUTHORITY_STATUS.VERIFIED
    );
  });

  it('Closed-Won gates readiness from ACCEPTANCE evidence without acceptanceId arg', async () => {
    const prisma = makePrisma({
      _documentVersionStore: [
        {
          id: 'cdv-ready',
          documentId: 'doc-1',
          versionNumber: 1,
          status: CRM_COMMERCIAL_DOCUMENT_STATUS.EXPIRED,
          immutable: true,
          expiresAt: new Date('2026-06-01T00:00:00Z'),
        },
      ],
    });

    expect(
      resolveClosedWonAcceptanceId({
        evidence: [{ type: 'ACCEPTANCE', value: 'accp-ready' }],
      })
    ).toBe('accp-ready');
    expect(
      commercialReadinessRequiredByPolicy(
        { evidence: [{ type: 'ACCEPTANCE', value: 'accp-ready' }] },
        'accp-ready'
      )
    ).toBe(true);

    const result = await closeOpportunityWon(prisma, {
      opportunityId: 'opp-1',
      admin: superAdmin(),
      winReason: 'BEST_FIT',
      decisionDate: '2026-07-31',
      evidence: [{ type: 'ACCEPTANCE', value: 'accp-ready' }],
      // intentionally omit acceptanceId — evidence alone must evaluate readiness
      idempotencyKey: 'close-evidence-gate:1',
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('CLOSED_WON_READINESS_BLOCKED');
    expect(result.readinessStatus).not.toBe('READY');
    expect(prisma._opportunityStore[0].stageCode).toBe('CUSTOMER_DECISION');
  });

  it('REJECTED/CANCELLED discounts do not block READY; only PENDING/required-unapproved', async () => {
    const prisma = makePrisma({
      _discountStore: [
        {
          id: 'dr-rejected',
          documentVersionId: 'cdv-ready',
          percent: 25,
          status: CRM_DISCOUNT_REQUEST_STATUS.REJECTED,
          requiresApproval: true,
          requestedByAdminId: 'rep-1',
        },
        {
          id: 'dr-cancelled',
          documentVersionId: 'cdv-ready',
          percent: 30,
          status: CRM_DISCOUNT_REQUEST_STATUS.CANCELLED,
          requiresApproval: true,
          requestedByAdminId: 'rep-1',
        },
        {
          id: 'dr-other-version',
          documentVersionId: 'cdv-other',
          percent: 40,
          status: CRM_DISCOUNT_REQUEST_STATUS.PENDING,
          requiresApproval: true,
          requestedByAdminId: 'rep-1',
        },
      ],
    });

    const result = await evaluateClosedWonReadiness(prisma, {
      acceptanceId: 'accp-ready',
      admin: superAdmin(),
      opportunityId: 'opp-1',
    });

    expect(result.readinessStatus).toBe(CRM_READINESS_STATUS.READY);
    expect(
      result.checklist.some(
        (i) =>
          (i.key === 'discount_approvals' || i.key === 'material_discount_approved') &&
          i.blocker &&
          !i.ok
      )
    ).toBe(false);

    // findMany must scope by documentVersionId — pending on other version ignored
    expect(prisma.crmDiscountRequest.findMany).toHaveBeenCalled();
    const callWhere = prisma.crmDiscountRequest.findMany.mock.calls[0][0]?.where || {};
    expect(callWhere.documentVersionId).toBe('cdv-ready');
    expect(callWhere.OR).toBeUndefined();
  });

  it('SoD re-check at readiness blocks APPROVED discount when requester === approver', async () => {
    const prisma = makePrisma({
      _discountStore: [
        {
          id: 'dr-sod',
          documentVersionId: 'cdv-ready',
          percent: 20,
          status: CRM_DISCOUNT_REQUEST_STATUS.APPROVED,
          requiresApproval: true,
          requestedByAdminId: 'same-admin',
          approvedByAdminId: 'same-admin',
        },
      ],
    });

    const result = await evaluateClosedWonReadiness(prisma, {
      acceptanceId: 'accp-ready',
      admin: superAdmin(),
      opportunityId: 'opp-1',
    });

    expect(result.readinessStatus).not.toBe('READY');
    expect(['BLOCKED', 'NOT_READY', 'APPROVAL_REQUIRED']).toContain(
      result.readinessStatus
    );
    expect(
      result.checklist.some(
        (i) => i.key === 'discount_approval_sod' && i.blocker && !i.ok
      )
    ).toBe(true);
  });

  it('Closed-Won approver SoD blocks self-approval when requireApproval', async () => {
    const prisma = makePrisma();
    const owner = superAdmin('owner-close-1');
    prisma._opportunityStore[0].ownerAdminId = owner.id;

    const result = await closeOpportunityWon(prisma, {
      opportunityId: 'opp-1',
      admin: owner,
      winReason: 'BEST_FIT',
      decisionDate: '2026-07-31',
      evidence: [{ type: 'ACCEPTANCE', value: 'accp-ready' }],
      acceptanceId: 'accp-ready',
      requireApproval: true,
      approvalGranted: true,
      idempotencyKey: 'close-sod:1',
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('CLOSE_SOD_BLOCKED');
    expect(result.reason).toMatch(/sod/i);
    expect(prisma._opportunityStore[0].stageCode).toBe('CUSTOMER_DECISION');
  });
});
