/**
 * Phase 11 Wave 2 — CRM duplicate candidates (no auto-merge).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CRM_CAPTURE_SOURCE,
  CRM_DUPLICATE_STATUS,
  CRM_DUPLICATE_MATCH_TYPE,
  captureLead,
  listDuplicateCandidates,
  reviewDuplicateCandidate,
  detectDuplicateCandidates,
} from '@/lib/admin/crm';

function makePrisma(overrides = {}) {
  const leadStore = overrides._leadStore || [];
  const captureStore = overrides._captureStore || [];
  const historyStore = overrides._historyStore || [];
  const seqStore = overrides._seqStore || [];
  const duplicateStore = overrides._duplicateStore || [];
  const contactStore = overrides._contactStore || [];
  const accountStore = overrides._accountStore || [];

  const prisma = {
    crmLead: {
      findMany: vi.fn(async ({ where = {}, take } = {}) => {
        let rows = [...leadStore];
        if (where?.id?.in) {
          const set = new Set(where.id.in);
          rows = rows.filter((r) => set.has(r.id));
        }
        return rows.slice(0, typeof take === 'number' ? take : rows.length);
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return leadStore.find((r) => r.id === where.id) || null;
        if (where.sourceIdempotencyKey) {
          return (
            leadStore.find((r) => r.sourceIdempotencyKey === where.sourceIdempotencyKey) ||
            null
          );
        }
        return null;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `lead-${leadStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        leadStore.push(row);
        return row;
      }),
    },
    crmCaptureRecord: {
      findMany: vi.fn(async ({ where = {}, take } = {}) => {
        let rows = [...captureStore];
        if (where?.OR) {
          rows = rows.filter((r) =>
            where.OR.some((clause) => {
              if (clause.emailNormalized) return r.emailNormalized === clause.emailNormalized;
              if (clause.phoneNormalized) return r.phoneNormalized === clause.phoneNormalized;
              if (clause.handoffRefId && clause.handoffRefType) {
                return (
                  r.handoffRefId === clause.handoffRefId &&
                  r.handoffRefType === clause.handoffRefType
                );
              }
              return false;
            })
          );
        }
        if (where?.leadId?.not) {
          rows = rows.filter((r) => r.leadId !== where.leadId.not);
        }
        if (where?.emailNormalized) {
          rows = rows.filter((r) => r.emailNormalized === where.emailNormalized);
        }
        if (where?.phoneNormalized) {
          rows = rows.filter((r) => r.phoneNormalized === where.phoneNormalized);
        }
        return rows.slice(0, typeof take === 'number' ? take : rows.length);
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.sourceIdempotencyKey) {
          return (
            captureStore.find((r) => r.sourceIdempotencyKey === where.sourceIdempotencyKey) ||
            null
          );
        }
        return null;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `cap-${captureStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          ...data,
        };
        captureStore.push(row);
        return row;
      }),
    },
    crmDuplicateCandidate: {
      findMany: vi.fn(async ({ where = {}, take, skip, orderBy } = {}) => {
        let rows = [...duplicateStore];
        if (where?.status) {
          if (where.status.in) {
            const set = new Set(where.status.in);
            rows = rows.filter((r) => set.has(r.status));
          } else {
            rows = rows.filter((r) => r.status === where.status);
          }
        }
        if (where?.leadId) rows = rows.filter((r) => r.leadId === where.leadId);
        if (orderBy?.createdAt === 'desc') {
          rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
        let start = typeof skip === 'number' ? skip : 0;
        const limit = typeof take === 'number' ? take : rows.length;
        return rows.slice(start, start + limit);
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return duplicateStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        return (
          duplicateStore.find((r) => {
            if (where.leadId && r.leadId !== where.leadId) return false;
            if (where.candidateLeadId && r.candidateLeadId !== where.candidateLeadId) {
              return false;
            }
            if (where.matchType && r.matchType !== where.matchType) return false;
            return true;
          }) || null
        );
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `dup-${duplicateStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          status: data.status || CRM_DUPLICATE_STATUS.NEW,
          ...data,
        };
        duplicateStore.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = duplicateStore.find((r) => r.id === where.id);
        if (!row) throw Object.assign(new Error('not found'), { code: 'P2025' });
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      }),
    },
    crmContact: {
      findMany: vi.fn(async () => [...contactStore]),
    },
    crmAccount: {
      findMany: vi.fn(async () => [...accountStore]),
    },
    crmLeadStatusHistory: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `clh-${historyStore.length + 1}`, at: data.at || new Date(), ...data };
        historyStore.push(row);
        return row;
      }),
    },
    crmNumberSeq: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        return (
          seqStore.find(
            (r) => r.prefix === where.prefix_year?.prefix && r.year === where.prefix_year?.year
          ) ||
          seqStore.find((r) => r.prefix === where.prefix && r.year === where.year) ||
          null
        );
      }),
      create: vi.fn(async ({ data }) => {
        const row = { ...data, updatedAt: new Date() };
        seqStore.push(row);
        return row;
      }),
      updateMany: vi.fn(async ({ where = {}, data } = {}) => {
        const row = seqStore.find(
          (r) =>
            r.prefix === where.prefix &&
            r.year === where.year &&
            (where.lastIssued === undefined || r.lastIssued === where.lastIssued)
        );
        if (!row) return { count: 0 };
        Object.assign(row, data, { updatedAt: new Date() });
        return { count: 1 };
      }),
    },
    $transaction: vi.fn(async (fn) => fn(prisma)),
  };

  prisma._leadStore = leadStore;
  prisma._captureStore = captureStore;
  prisma._duplicateStore = duplicateStore;
  prisma._historyStore = historyStore;
  prisma._seqStore = seqStore;
  return prisma;
}

const crmAgent = {
  id: 'admin-crm-1',
  role: 'Platform Support',
  permissions: {
    systemAdmin: {
      crm: {
        view: true,
        viewLeads: true,
        createLeads: true,
        editLeads: true,
      },
    },
  },
};

const crmViewer = {
  id: 'admin-crm-viewer',
  role: 'Platform Support',
  permissions: {
    systemAdmin: {
      crm: { view: true, viewLeads: true },
    },
  },
};

const noPerms = {
  id: 'admin-none',
  role: 'Platform Support',
  permissions: { systemAdmin: {} },
};

describe('systemAdmin.crm.duplicates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates duplicate candidates for same email/phone; never auto-merges', async () => {
    const prisma = makePrisma();
    const a = await captureLead(prisma, {
      sourceCode: CRM_CAPTURE_SOURCE.REQUEST_DEMO,
      businessName: 'Acme',
      contactName: 'Ada',
      email: 'ada@acme.com',
      phone: '+260971111111',
      message: 'one',
      sourceIdempotencyKey: 'key-a',
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    const b = await captureLead(prisma, {
      sourceCode: CRM_CAPTURE_SOURCE.SALES_ENQUIRY,
      businessName: 'Acme 2',
      contactName: 'Ada Lovelace',
      email: 'ada@acme.com',
      phone: '+260 97 111 1111',
      message: 'two',
      sourceIdempotencyKey: 'key-b',
      now: new Date('2026-07-30T12:01:00.000Z'),
    });

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(a.lead.id).not.toBe(b.lead.id);
    expect(prisma._leadStore.length).toBe(2);
    expect(prisma._duplicateStore.length).toBeGreaterThanOrEqual(1);
    expect(
      prisma._duplicateStore.every((d) =>
        [
          CRM_DUPLICATE_MATCH_TYPE.EMAIL,
          CRM_DUPLICATE_MATCH_TYPE.PHONE,
          CRM_DUPLICATE_MATCH_TYPE.SOURCE_IDENTITY,
        ].includes(d.matchType)
      )
    ).toBe(true);
    expect(prisma._duplicateStore.every((d) => d.status === CRM_DUPLICATE_STATUS.NEW)).toBe(
      true
    );
    // No merge — both leads remain NEW
    expect(prisma._leadStore.every((l) => l.status === 'NEW')).toBe(true);
  });

  it('does not auto-merge on similar name/domain alone', async () => {
    const prisma = makePrisma();
    await captureLead(prisma, {
      sourceCode: CRM_CAPTURE_SOURCE.START_TRIAL,
      businessName: 'Insight Soft',
      contactName: 'Alex',
      email: 'alex@insight-soft.com',
      phone: '0972000001',
      message: 'a',
      sourceIdempotencyKey: 'dom-a',
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    await captureLead(prisma, {
      sourceCode: CRM_CAPTURE_SOURCE.START_TRIAL,
      businessName: 'Insight Software Ltd',
      contactName: 'Alexandra',
      email: 'other@insight-soft.com',
      phone: '0972000002',
      message: 'b',
      sourceIdempotencyKey: 'dom-b',
      now: new Date('2026-07-30T12:01:00.000Z'),
    });

    // Same domain heuristic alone must not create auto-merge or force DUPLICATE status
    expect(prisma._leadStore.length).toBe(2);
    expect(prisma._leadStore.every((l) => l.status === 'NEW')).toBe(true);
    const domainOnly = prisma._duplicateStore.filter(
      (d) => d.matchType === CRM_DUPLICATE_MATCH_TYPE.DOMAIN
    );
    expect(domainOnly.every((d) => d.status === CRM_DUPLICATE_STATUS.NEW)).toBe(true);
  });

  it('lists candidates for viewers; review requires edit permission + reason', async () => {
    const prisma = makePrisma();
    await captureLead(prisma, {
      sourceCode: CRM_CAPTURE_SOURCE.REQUEST_DEMO,
      businessName: 'A',
      contactName: 'A',
      email: 'same@x.com',
      phone: '1',
      message: 'a',
      sourceIdempotencyKey: 'list-a',
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    await captureLead(prisma, {
      sourceCode: CRM_CAPTURE_SOURCE.REQUEST_DEMO,
      businessName: 'B',
      contactName: 'B',
      email: 'same@x.com',
      phone: '2',
      message: 'b',
      sourceIdempotencyKey: 'list-b',
      now: new Date('2026-07-30T12:01:00.000Z'),
    });

    const listed = await listDuplicateCandidates(prisma, { admin: crmViewer });
    expect(listed.ok).toBe(true);
    expect(listed.items.length).toBeGreaterThanOrEqual(1);

    const forbidden = await listDuplicateCandidates(prisma, { admin: noPerms });
    expect(forbidden.forbidden).toBe(true);

    const candidateId = listed.items[0].id;
    const badReview = await reviewDuplicateCandidate(prisma, {
      admin: crmViewer,
      id: candidateId,
      status: CRM_DUPLICATE_STATUS.CONFIRMED_DUPLICATE,
      reason: 'same person',
    });
    expect(badReview.forbidden).toBe(true);

    const noReason = await reviewDuplicateCandidate(prisma, {
      admin: crmAgent,
      id: candidateId,
      status: CRM_DUPLICATE_STATUS.CONFIRMED_DUPLICATE,
    });
    expect(noReason.ok).toBe(false);
    expect(noReason.error).toBe('reason required');

    const ok = await reviewDuplicateCandidate(prisma, {
      admin: crmAgent,
      id: candidateId,
      status: CRM_DUPLICATE_STATUS.CONFIRMED_DISTINCT,
      reason: 'Different people at same company email alias',
    });
    expect(ok.ok).toBe(true);
    expect(ok.candidate.status).toBe(CRM_DUPLICATE_STATUS.CONFIRMED_DISTINCT);
    expect(ok.candidate.reviewedByAdminId).toBe(crmAgent.id);
    expect(ok.candidate.decisionReason).toContain('Different people');
  });

  it('detectDuplicateCandidates is idempotent for the same pair+matchType', async () => {
    const prisma = makePrisma({
      _leadStore: [
        { id: 'l1', leadNumber: 'LEAD-2026-000001', status: 'NEW', title: 'A' },
        { id: 'l2', leadNumber: 'LEAD-2026-000002', status: 'NEW', title: 'B' },
      ],
      _captureStore: [
        {
          id: 'c1',
          leadId: 'l1',
          emailNormalized: 'x@y.com',
          phoneNormalized: null,
          sourceIdempotencyKey: 'k1',
          sourceCode: CRM_CAPTURE_SOURCE.REQUEST_DEMO,
        },
        {
          id: 'c2',
          leadId: 'l2',
          emailNormalized: 'x@y.com',
          phoneNormalized: null,
          sourceIdempotencyKey: 'k2',
          sourceCode: CRM_CAPTURE_SOURCE.SALES_ENQUIRY,
        },
      ],
    });

    const first = await detectDuplicateCandidates(prisma, {
      leadId: 'l2',
      emailNormalized: 'x@y.com',
    });
    const second = await detectDuplicateCandidates(prisma, {
      leadId: 'l2',
      emailNormalized: 'x@y.com',
    });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(prisma._duplicateStore.length).toBe(first.created + first.existing);
    expect(prisma._duplicateStore.length).toBe(1);
  });
});
