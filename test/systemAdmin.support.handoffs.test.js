/**
 * Phase 10 Wave 4 — Support handoffs (link-only) + foundations contracts.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  SUPPORT_HANDOFF_TARGET,
  SUPPORT_FOUNDATION_STATUS,
  createSupportHandoff,
  listSupportHandoffs,
  sanitizeHandoffPayload,
  getSupportFoundations,
  resolveSupportAccess,
} from '@/lib/admin/support';
import { SYSTEM_ADMIN_PERMISSIONS, NAV_PERMISSION_MAP } from '@/lib/admin/permissions';
import { listSupportSectionHrefs } from '@/lib/admin/supportNav';
import { PRODUCT_FEATURE_CODES } from '@/lib/admin/productCatalogue/features.js';

function makePrisma(overrides = {}) {
  const ticketStore = overrides._ticketStore || [
    {
      id: 'st-1',
      ticketNumber: 'SUP-2026-000001',
      tenantId: 'tenant-1',
      status: 'TRIAGE',
      type: 'QUESTION',
      title: 'Help',
      description: 'desc',
    },
  ];
  const handoffStore = overrides._handoffStore || [];

  const prisma = {
    supportTicket: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return ticketStore.find((r) => r.id === where.id) || null;
        if (where.ticketNumber) {
          return ticketStore.find((r) => r.ticketNumber === where.ticketNumber) || null;
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        if (where?.OR) {
          return (
            ticketStore.find((r) =>
              where.OR.some(
                (c) => (c.id && r.id === c.id) || (c.ticketNumber && r.ticketNumber === c.ticketNumber)
              )
            ) || null
          );
        }
        return null;
      }),
      findMany: vi.fn(async () => [...ticketStore]),
      update: vi.fn(async () => {
        throw new Error('ticket_mutation_forbidden_in_handoff_test');
      }),
    },
    supportHandoff: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: `sh-${handoffStore.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        handoffStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...handoffStore];
        if (where.ticketId) rows = rows.filter((r) => r.ticketId === where.ticketId);
        if (where.targetType) rows = rows.filter((r) => r.targetType === where.targetType);
        return rows;
      }),
    },
    /** Mutation spies — must never be called on handoff create. */
    csCase: {
      create: vi.fn(),
      update: vi.fn(),
    },
    accountSubscription: {
      update: vi.fn(),
    },
    tenantGlLine: {
      create: vi.fn(),
    },
  };

  prisma._ticketStore = ticketStore;
  prisma._handoffStore = handoffStore;
  return prisma;
}

const agent = {
  id: 'admin-1',
  role: 'Platform Support',
  permissions: {
    systemAdmin: {
      support: {
        viewTickets: true,
        createTickets: true,
        transitionStatus: true,
        assignTickets: true,
      },
    },
  },
};

const viewer = {
  id: 'admin-viewer',
  role: 'Platform Support',
  permissions: {
    systemAdmin: {
      support: {
        viewTickets: true,
      },
    },
  },
};

describe('Support Wave 4 handoffs', () => {
  it('creates link-only CS handoff without mutating CsCase / subscription / GL', async () => {
    const prisma = makePrisma();
    const result = await createSupportHandoff(prisma, {
      admin: agent,
      ticketId: 'st-1',
      targetType: SUPPORT_HANDOFF_TARGET.CS,
      summary: 'Needs CS follow-up',
      targetRefId: 'cs-case-99',
      payload: {
        csCaseId: 'cs-case-99',
        credentials: 'SECRET',
        rawMraPayload: { x: 1 },
      },
    });

    expect(result.ok).toBe(true);
    expect(result.meta.recordOnly).toBe(true);
    expect(result.meta.mutatesCsCaseStatus).toBe(false);
    expect(result.meta.mutatesSubscription).toBe(false);
    expect(result.meta.opensCsCase).toBe(false);
    expect(result.handoff.targetType).toBe('CS');
    expect(result.handoff.payload?.credentials).toBeUndefined();
    expect(result.handoff.payload?.rawMraPayload).toBeUndefined();
    expect(result.handoff.payload?.csCaseId).toBe('cs-case-99');
    expect(prisma.csCase.create).not.toHaveBeenCalled();
    expect(prisma.csCase.update).not.toHaveBeenCalled();
    expect(prisma.accountSubscription.update).not.toHaveBeenCalled();
    expect(prisma.supportTicket.update).not.toHaveBeenCalled();
  });

  it('accepts optional Phase 9 featureCode on PRODUCT handoff', async () => {
    const prisma = makePrisma();
    const result = await createSupportHandoff(prisma, {
      admin: agent,
      ticketId: 'SUP-2026-000001',
      targetType: 'PRODUCT',
      featureCode: PRODUCT_FEATURE_CODES.INVOICES_POST,
      summary: 'Adoption question',
    });
    expect(result.ok).toBe(true);
    expect(result.handoff.featureCode).toBe(PRODUCT_FEATURE_CODES.INVOICES_POST);
  });

  it('rejects unknown product featureCode', async () => {
    const prisma = makePrisma();
    const result = await createSupportHandoff(prisma, {
      admin: agent,
      ticketId: 'st-1',
      targetType: 'PRODUCT',
      featureCode: 'not.a.real.feature',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('unknown_feature_code');
  });

  it('Finance/Billing payload keeps ids only; strips secrets', () => {
    const sanitized = sanitizeHandoffPayload('BILLING', {
      invoiceId: 'inv-1',
      subscriptionId: 'sub-1',
      paymentSecret: 'x',
      cardNumber: '4111',
    });
    expect(sanitized.invoiceId).toBe('inv-1');
    expect(sanitized.subscriptionId).toBe('sub-1');
    expect(sanitized.paymentSecret).toBeUndefined();
    expect(sanitized.cardNumber).toBeUndefined();
  });

  it('subscription handoff stores subscriptionId and does not set invoiceId', async () => {
    const prisma = makePrisma();
    const result = await createSupportHandoff(prisma, {
      admin: agent,
      ticketId: 'st-1',
      targetType: SUPPORT_HANDOFF_TARGET.BILLING,
      summary: 'Subscription billing question',
      subscriptionId: 'sub-abc-99',
    });

    expect(result.ok).toBe(true);
    expect(result.handoff.subscriptionId).toBe('sub-abc-99');
    expect(result.handoff.invoiceId).toBeNull();
    expect(result.handoff.payload?.subscriptionId).toBe('sub-abc-99');
    expect(result.handoff.payload?.invoiceId).toBeUndefined();
    expect(result.handoff.targetRefId).toBeNull();

    const created = prisma._handoffStore[0];
    expect(created.payload?.subscriptionId).toBe('sub-abc-99');
    expect(created.payload?.invoiceId).toBeUndefined();
    expect(created.targetRefId).toBeNull();
  });

  it('Finance handoff maps invoiceId distinctly from subscriptionId', async () => {
    const prisma = makePrisma();
    const result = await createSupportHandoff(prisma, {
      admin: agent,
      ticketId: 'st-1',
      targetType: SUPPORT_HANDOFF_TARGET.FINANCE,
      invoiceId: 'inv-42',
      subscriptionId: 'sub-42',
      targetRefId: 'generic-ref',
    });

    expect(result.ok).toBe(true);
    expect(result.handoff.invoiceId).toBe('inv-42');
    expect(result.handoff.subscriptionId).toBe('sub-42');
    expect(result.handoff.targetRefId).toBe('generic-ref');
    expect(result.handoff.payload?.invoiceId).toBe('inv-42');
    expect(result.handoff.payload?.subscriptionId).toBe('sub-42');
  });

  it('lists handoffs for ticket; forbids viewers without create perms from creating', async () => {
    const prisma = makePrisma();
    await createSupportHandoff(prisma, {
      admin: agent,
      ticketId: 'st-1',
      targetType: 'MRA',
      targetRefId: 'tx-1',
      summary: 'Fiscal id link',
    });

    const listed = await listSupportHandoffs(prisma, {
      admin: viewer,
      ticketId: 'st-1',
    });
    expect(listed.ok).toBe(true);
    expect(listed.items.length).toBe(1);

    const denied = await createSupportHandoff(prisma, {
      admin: viewer,
      ticketId: 'st-1',
      targetType: 'CS',
    });
    expect(denied.forbidden).toBe(true);

    const access = resolveSupportAccess(viewer);
    expect(access.canCreateHandoffs).toBe(false);
    expect(access.canViewTickets).toBe(true);
  });

  it('returns UNAVAILABLE when handoff model missing', async () => {
    const result = await createSupportHandoff({}, {
      admin: agent,
      ticketId: 'st-1',
      targetType: 'CS',
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe('UNAVAILABLE');
  });
});

describe('Support Wave 4 foundations', () => {
  it('returns NOT_AVAILABLE / FOUNDATION contracts with null CSAT score', async () => {
    const result = await getSupportFoundations({}, { admin: viewer });
    expect(result.ok).toBe(true);
    expect(result.meta.inventCsatForbidden).toBe(true);
    const csat = result.items.find((i) => i.kind === 'CSAT');
    expect(csat.status).toBe(SUPPORT_FOUNDATION_STATUS.NOT_AVAILABLE);
    expect(csat.score).toBeNull();
    const kb = result.items.find((i) => i.kind === 'KNOWLEDGE_BASE');
    expect(kb.status).toBe(SUPPORT_FOUNDATION_STATUS.NOT_AVAILABLE);
    const problem = result.items.find((i) => i.kind === 'PROBLEM_MANAGEMENT');
    expect(problem.status).toBe(SUPPORT_FOUNDATION_STATUS.FOUNDATION);
  });
});

describe('Support Wave 4 nav map', () => {
  it('maps handoffs / reports / foundations in NAV_PERMISSION_MAP', () => {
    for (const href of listSupportSectionHrefs()) {
      expect(NAV_PERMISSION_MAP[href], href).toBe(
        SYSTEM_ADMIN_PERMISSIONS.support.viewTickets
      );
    }
    expect(NAV_PERMISSION_MAP['/insightbooks/support/handoffs']).toBe(
      SYSTEM_ADMIN_PERMISSIONS.support.viewTickets
    );
    expect(NAV_PERMISSION_MAP['/insightbooks/support/foundations']).toBe(
      SYSTEM_ADMIN_PERMISSIONS.support.viewTickets
    );
  });
});
