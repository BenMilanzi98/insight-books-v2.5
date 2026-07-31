/**
 * Phase 15 Wave 1 — Proposal Request + CrmCommercialDocument spine.
 * Proposal ≠ Quotation; convert idempotent; issued immutable; no Opp auto-mutation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CRM_PROPOSAL_REQUEST_NUMBER_RE,
  CRM_PROPOSAL_NUMBER_RE,
  CRM_QUOTATION_NUMBER_RE,
  CRM_PROPOSAL_REQUEST_STATUS,
  CRM_COMMERCIAL_DOCUMENT_STATUS,
  CRM_COMMERCIAL_DOCUMENT_FAMILY,
  allocateProposalRequestNumber,
  allocateProposalNumber,
  allocateQuotationNumber,
  createProposalRequest,
  qualifyProposalRequest,
  rejectProposalRequest,
  convertProposalRequest,
  createProposalRequestFromDemoHandoff,
  createProposal,
  createQuotation,
  createDocumentVersion,
  transitionDocumentStatus,
  transitionProposalRequestStatus,
  updateDocumentVersionContent,
  getCommercialDomainContract,
} from '@/lib/admin/crm';

function superAdmin(id = 'super-1') {
  return { id, role: 'Super Admin', permissions: {} };
}

function makePrisma(overrides = {}) {
  const seqStore = overrides._seqStore || [];
  const requestStore = overrides._requestStore || [];
  const requestHistoryStore = overrides._requestHistoryStore || [];
  const documentStore = overrides._documentStore || [];
  const versionStore = overrides._versionStore || [];
  const versionHistoryStore = overrides._versionHistoryStore || [];
  const proposalStore = overrides._proposalStore || [];
  const quotationStore = overrides._quotationStore || [];
  const timelineStore = overrides._timelineStore || [];
  const opportunityStore = overrides._opportunityStore || [
    {
      id: 'opp-1',
      opportunityNumber: 'OPP-2026-000001',
      stageCode: 'PROPOSAL_READY',
      accountId: 'acc-1',
      contactId: 'con-1',
      currency: 'MWK',
      amount: 1000,
      amountBasis: 'ESTIMATE',
      version: 1,
    },
  ];

  const prisma = {
    $transaction: vi.fn(async (fn) => fn(prisma)),
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
    crmProposalRequest: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `prq-${requestStore.length + 1}`,
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
        if (where.convertIdempotencyKey) {
          return (
            requestStore.find((r) => r.convertIdempotencyKey === where.convertIdempotencyKey) ||
            null
          );
        }
        return null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...requestStore];
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        return rows;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = requestStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    crmProposalRequestStatusHistory: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `prqh-${requestHistoryStore.length + 1}`, ...data };
        requestHistoryStore.push(row);
        return row;
      }),
    },
    crmCommercialDocument: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `doc-${documentStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        documentStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return documentStore.find((r) => r.id === where.id) || null;
        if (where.documentNumber) {
          return documentStore.find((r) => r.documentNumber === where.documentNumber) || null;
        }
        if (where.convertIdempotencyKey) {
          return (
            documentStore.find((r) => r.convertIdempotencyKey === where.convertIdempotencyKey) ||
            null
          );
        }
        if (where.idempotencyKey) {
          return documentStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        return null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...documentStore];
        if (where.documentFamily) {
          rows = rows.filter((r) => r.documentFamily === where.documentFamily);
        }
        if (where.requestId) rows = rows.filter((r) => r.requestId === where.requestId);
        return rows;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = documentStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    crmCommercialDocumentVersion: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `ver-${versionStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        versionStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return versionStore.find((r) => r.id === where.id) || null;
        if (where.documentId_versionNumber) {
          const k = where.documentId_versionNumber;
          return (
            versionStore.find(
              (r) => r.documentId === k.documentId && r.versionNumber === k.versionNumber
            ) || null
          );
        }
        return null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...versionStore];
        if (where.documentId) rows = rows.filter((r) => r.documentId === where.documentId);
        return rows;
      }),
      findFirst: vi.fn(async ({ where = {}, orderBy } = {}) => {
        let rows = [...versionStore];
        if (where.documentId) rows = rows.filter((r) => r.documentId === where.documentId);
        if (orderBy?.versionNumber === 'desc') {
          rows.sort((a, b) => b.versionNumber - a.versionNumber);
        }
        return rows[0] || null;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = versionStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    crmCommercialDocumentVersionStatusHistory: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `dvh-${versionHistoryStore.length + 1}`, ...data };
        versionHistoryStore.push(row);
        return row;
      }),
    },
    crmProposal: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `prop-${proposalStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        proposalStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return proposalStore.find((r) => r.id === where.id) || null;
        if (where.documentId) {
          return proposalStore.find((r) => r.documentId === where.documentId) || null;
        }
        return null;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = proposalStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    crmQuotation: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `quo-${quotationStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        quotationStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return quotationStore.find((r) => r.id === where.id) || null;
        if (where.documentId) {
          return quotationStore.find((r) => r.documentId === where.documentId) || null;
        }
        return null;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = quotationStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    crmOpportunity: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return opportunityStore.find((r) => r.id === where.id) || null;
        if (where.opportunityNumber) {
          return (
            opportunityStore.find((r) => r.opportunityNumber === where.opportunityNumber) || null
          );
        }
        return null;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = opportunityStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data);
        return row;
      }),
    },
    crmTimelineEvent: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `tl-${timelineStore.length + 1}`, ...data };
        timelineStore.push(row);
        return row;
      }),
      findMany: vi.fn(async () => [...timelineStore]),
    },
    _stores: {
      seqStore,
      requestStore,
      documentStore,
      versionStore,
      proposalStore,
      quotationStore,
      opportunityStore,
      timelineStore,
    },
  };

  return prisma;
}

describe('Phase 15 Wave 1 — Proposal Request + commercial document spine', () => {
  let prisma;
  let admin;
  let actorContext;

  beforeEach(() => {
    prisma = makePrisma();
    admin = superAdmin();
    actorContext = { admin };
  });

  it('allocates unique PRQ / PROP / QUO numbers', async () => {
    const prq = await allocateProposalRequestNumber(prisma);
    const prop = await allocateProposalNumber(prisma);
    const quo = await allocateQuotationNumber(prisma);
    expect(prq.ok).toBe(true);
    expect(prop.ok).toBe(true);
    expect(quo.ok).toBe(true);
    expect(prq.number).toMatch(CRM_PROPOSAL_REQUEST_NUMBER_RE);
    expect(prop.number).toMatch(CRM_PROPOSAL_NUMBER_RE);
    expect(quo.number).toMatch(CRM_QUOTATION_NUMBER_RE);

    const prq2 = await allocateProposalRequestNumber(prisma);
    const prop2 = await allocateProposalNumber(prisma);
    expect(prq2.number).not.toBe(prq.number);
    expect(prop2.number).not.toBe(prop.number);
  });

  it('Demo handoff retry returns the same PRQ (idempotent by handoff identity)', async () => {
    const handoffPayload = {
      type: 'CRM_DEMO_PROPOSAL_HANDOFF',
      demoId: 'demo-1',
      demoNumber: 'DEMO-2026-000001',
      opportunityId: 'opp-1',
      accountId: 'acc-1',
      contactId: 'con-1',
      idempotencyKey: 'demo-proposal-handoff:demo-1',
      proposalCreated: false,
    };

    const first = await createProposalRequestFromDemoHandoff(prisma, {
      actorContext,
      handoffPayload,
    });
    expect(first.ok).toBe(true);
    expect(first.request.requestNumber).toMatch(CRM_PROPOSAL_REQUEST_NUMBER_RE);
    expect(first.request.source).toBe('DEMO_HANDOFF');
    expect(first.proposalCreated).toBe(false);

    const second = await createProposalRequestFromDemoHandoff(prisma, {
      actorContext,
      handoffPayload,
    });
    expect(second.ok).toBe(true);
    expect(second.alreadyExists).toBe(true);
    expect(second.request.id).toBe(first.request.id);
    expect(second.request.requestNumber).toBe(first.request.requestNumber);
    expect(prisma._stores.requestStore.length).toBe(1);
  });

  it('convert creates PROP and/or QUO once; exact retry returns same', async () => {
    const created = await createProposalRequest(prisma, {
      actorContext,
      source: 'OPPORTUNITY',
      opportunityId: 'opp-1',
      accountId: 'acc-1',
      contactId: 'con-1',
      requestedDocumentType: 'BOTH',
      currency: 'MWK',
    });
    expect(created.ok).toBe(true);
    expect(created.request.status).toBe(CRM_PROPOSAL_REQUEST_STATUS.NEW);

    await qualifyProposalRequest(prisma, {
      actorContext,
      requestId: created.request.id,
    });

    const first = await convertProposalRequest(prisma, {
      actorContext,
      requestId: created.request.id,
      createProposal: true,
      createQuotation: true,
    });
    expect(first.ok).toBe(true);
    expect(first.alreadyExists).toBeFalsy();
    expect(first.request.status).toBe(CRM_PROPOSAL_REQUEST_STATUS.CONVERTED);
    expect(first.proposal.documentNumber).toMatch(CRM_PROPOSAL_NUMBER_RE);
    expect(first.quotation.documentNumber).toMatch(CRM_QUOTATION_NUMBER_RE);
    expect(first.proposal.documentFamily).toBe(CRM_COMMERCIAL_DOCUMENT_FAMILY.PROPOSAL);
    expect(first.quotation.documentFamily).toBe(CRM_COMMERCIAL_DOCUMENT_FAMILY.QUOTATION);
    expect(first.proposal.id).not.toBe(first.quotation.id);

    const second = await convertProposalRequest(prisma, {
      actorContext,
      requestId: created.request.id,
      createProposal: true,
      createQuotation: true,
    });
    expect(second.ok).toBe(true);
    expect(second.alreadyExists).toBe(true);
    expect(second.proposal.id).toBe(first.proposal.id);
    expect(second.quotation.id).toBe(first.quotation.id);
    expect(prisma._stores.documentStore.length).toBe(2);
    expect(prisma._stores.proposalStore.length).toBe(1);
    expect(prisma._stores.quotationStore.length).toBe(1);

    // Opportunity stage/probability/close date never auto-mutated
    expect(prisma.crmOpportunity.update).not.toHaveBeenCalled();
    expect(getCommercialDomainContract().autoOpportunityStageMutationForbidden).toBe(true);
    expect(getCommercialDomainContract().tenantQuotationDomain).toBe('WRONG_DOMAIN');
  });

  it('invalid document status transition throws', async () => {
    const prop = await createProposal(prisma, {
      actorContext,
      opportunityId: 'opp-1',
      title: 'Acme proposal',
    });
    expect(prop.ok).toBe(true);
    const versionId = prop.version.id;

    await expect(
      transitionDocumentStatus(prisma, {
        actorContext,
        documentVersionId: versionId,
        toStatus: CRM_COMMERCIAL_DOCUMENT_STATUS.ISSUED,
        reason: 'skip ahead',
      })
    ).rejects.toThrow(/invalid.*transition|transition/i);
  });

  it('issued version content mutation is blocked (immutability foundation)', async () => {
    const prop = await createProposal(prisma, {
      actorContext,
      opportunityId: 'opp-1',
      title: 'Lock me',
    });
    const versionId = prop.version.id;

    // Walk legal path to ISSUED (Wave 1 foundation path)
    const path = [
      CRM_COMMERCIAL_DOCUMENT_STATUS.INTERNAL_REVIEW,
      CRM_COMMERCIAL_DOCUMENT_STATUS.PENDING_APPROVAL,
      CRM_COMMERCIAL_DOCUMENT_STATUS.APPROVED,
      CRM_COMMERCIAL_DOCUMENT_STATUS.READY_TO_ISSUE,
      CRM_COMMERCIAL_DOCUMENT_STATUS.ISSUED,
    ];
    for (const toStatus of path) {
      await transitionDocumentStatus(prisma, {
        actorContext,
        documentVersionId: versionId,
        toStatus,
        reason: `to_${toStatus}`,
      });
    }

    await expect(
      updateDocumentVersionContent(prisma, {
        actorContext,
        documentVersionId: versionId,
        contentJson: { narrative: 'mutated after issue' },
      })
    ).rejects.toThrow(/immutable|issued/i);

    // New version still allowed
    const next = await createDocumentVersion(prisma, {
      actorContext,
      documentId: prop.document.id,
      revisionReason: 'post-issue revision',
    });
    expect(next.ok).toBe(true);
    expect(next.version.versionNumber).toBe(2);
    expect(next.version.status).toBe(CRM_COMMERCIAL_DOCUMENT_STATUS.DRAFT);
    expect(next.version.versionLabel).toMatch(/-V2$/);
  });

  it('reject proposal request and createQuotation are distinct from Proposal', async () => {
    const created = await createProposalRequest(prisma, {
      actorContext,
      source: 'SALES',
      opportunityId: 'opp-1',
    });
    const rejected = await rejectProposalRequest(prisma, {
      actorContext,
      requestId: created.request.id,
      reason: 'Not ready',
    });
    expect(rejected.ok).toBe(true);
    expect(rejected.request.status).toBe(CRM_PROPOSAL_REQUEST_STATUS.REJECTED);

    const quo = await createQuotation(prisma, {
      actorContext,
      opportunityId: 'opp-1',
      currency: 'USD',
    });
    expect(quo.ok).toBe(true);
    expect(quo.document.documentFamily).toBe(CRM_COMMERCIAL_DOCUMENT_FAMILY.QUOTATION);
    expect(quo.quotation).toBeTruthy();
    expect(quo.proposal).toBeUndefined();
  });

  it('illegal request reject from APPROVED fails visibly', async () => {
    const created = await createProposalRequest(prisma, {
      actorContext,
      source: 'SALES',
      opportunityId: 'opp-1',
    });
    expect(created.ok).toBe(true);

    await qualifyProposalRequest(prisma, {
      actorContext,
      requestId: created.request.id,
    });
    const approved = await transitionProposalRequestStatus(prisma, {
      actorContext,
      requestId: created.request.id,
      toStatus: CRM_PROPOSAL_REQUEST_STATUS.APPROVED,
    });
    expect(approved.ok).toBe(true);
    expect(approved.request.status).toBe(CRM_PROPOSAL_REQUEST_STATUS.APPROVED);

    const rejected = await rejectProposalRequest(prisma, {
      actorContext,
      requestId: created.request.id,
      reason: 'too late',
    });
    expect(rejected.ok).toBe(false);
    expect(rejected.error).toBe('invalid_request_status_transition');
    expect(rejected.fromStatus).toBe(CRM_PROPOSAL_REQUEST_STATUS.APPROVED);
    expect(rejected.toStatus).toBe(CRM_PROPOSAL_REQUEST_STATUS.REJECTED);
  });
});
