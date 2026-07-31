/**
 * Phase 15 Wave 3 — Templates, PDF, issue, delivery, review, acceptance.
 * Delivery ≠ view ≠ acceptance. E-sign NOT_CONFIGURED. Acceptance binds version+checksum+authority.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  renderCommercialDocument,
  issueCommercialDocument,
  recordCustomerView,
  acceptCommercialDocument,
  rejectCommercialDocument,
  getESignatureProviderStatus,
  runCommercialExpiryJob,
  getCommercialDomainContract,
  CRM_COMMERCIAL_DOCUMENT_STATUS,
} from '@/lib/admin/crm';

function superAdmin(id = 'super-1') {
  return { id, role: 'Super Admin', permissions: {} };
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
      if (where.tokenHash) {
        return store.find((r) => r.tokenHash === where.tokenHash) || null;
      }
      if (where.documentVersionId_idempotencyKey) {
        const k = where.documentVersionId_idempotencyKey;
        return (
          store.find(
            (r) =>
              r.documentVersionId === k.documentVersionId &&
              r.idempotencyKey === k.idempotencyKey
          ) || null
        );
      }
      if (where.versionId_projection_idempotencyKey) {
        const k = where.versionId_projection_idempotencyKey;
        return (
          store.find(
            (r) =>
              r.versionId === k.versionId &&
              r.projection === k.projection &&
              r.idempotencyKey === k.idempotencyKey
          ) || null
        );
      }
      if (where.artifactId_algorithm) {
        const k = where.artifactId_algorithm;
        return (
          store.find(
            (r) => r.artifactId === k.artifactId && r.algorithm === k.algorithm
          ) || null
        );
      }
      if (where.documentVersionId_recipientId) {
        const k = where.documentVersionId_recipientId;
        return (
          store.find(
            (r) =>
              r.documentVersionId === k.documentVersionId &&
              r.recipientId === k.recipientId
          ) || null
        );
      }
      return null;
    }),
    findFirst: vi.fn(async ({ where = {}, orderBy } = {}) => {
      let rows = [...store];
      if (where.documentVersionId) {
        rows = rows.filter((r) => r.documentVersionId === where.documentVersionId);
      }
      if (where.recipientId) {
        rows = rows.filter((r) => r.recipientId === where.recipientId);
      }
      if (where.versionId) rows = rows.filter((r) => r.versionId === where.versionId);
      if (where.artifactId) rows = rows.filter((r) => r.artifactId === where.artifactId);
      if (where.status) rows = rows.filter((r) => r.status === where.status);
      if (where.idempotencyKey) {
        rows = rows.filter((r) => r.idempotencyKey === where.idempotencyKey);
      }
      if (where.revokedAt === null) rows = rows.filter((r) => r.revokedAt == null);
      if (where.expiresAt) {
        // Prisma-style: { lte: date }
        if (where.expiresAt.lte) {
          rows = rows.filter((r) => r.expiresAt && new Date(r.expiresAt) <= where.expiresAt.lte);
        }
      }
      if (orderBy?.createdAt === 'desc') {
        rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
      return rows[0] || null;
    }),
    findMany: vi.fn(async ({ where = {} } = {}) => {
      let rows = [...store];
      if (where.documentVersionId) {
        rows = rows.filter((r) => r.documentVersionId === where.documentVersionId);
      }
      if (where.versionId) rows = rows.filter((r) => r.versionId === where.versionId);
      if (where.documentId) rows = rows.filter((r) => r.documentId === where.documentId);
      if (where.status) {
        if (typeof where.status === 'object' && where.status.in) {
          rows = rows.filter((r) => where.status.in.includes(r.status));
        } else {
          rows = rows.filter((r) => r.status === where.status);
        }
      }
      if (where.validUntil) {
        if (where.validUntil.lte) {
          rows = rows.filter((r) => r.validUntil && new Date(r.validUntil) <= where.validUntil.lte);
        }
      }
      if (where.revokedAt === null) rows = rows.filter((r) => r.revokedAt == null);
      if (where.id?.in) rows = rows.filter((r) => where.id.in.includes(r.id));
      return rows;
    }),
    update: vi.fn(async ({ where = {}, data = {} } = {}) => {
      const row = store.find((r) => r.id === where.id);
      if (!row) throw new Error('not found');
      Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
      return row;
    }),
    updateMany: vi.fn(async ({ where = {}, data = {} } = {}) => {
      let count = 0;
      for (const row of store) {
        let match = true;
        if (where.documentVersionId && row.documentVersionId !== where.documentVersionId) {
          match = false;
        }
        if (where.documentId && row.documentId !== where.documentId) match = false;
        if (where.status) {
          if (typeof where.status === 'object' && where.status.in) {
            if (!where.status.in.includes(row.status)) match = false;
          } else if (row.status !== where.status) match = false;
        }
        if (where.revokedAt === null && row.revokedAt != null) match = false;
        if (match) {
          Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
          count += 1;
        }
      }
      return { count };
    }),
  };
}

function makePrisma(overrides = {}) {
  const documentStore = overrides._documentStore || [
    {
      id: 'doc-1',
      documentNumber: 'QUO-2026-000001',
      documentFamily: 'QUOTATION',
      opportunityId: 'opp-1',
      accountId: 'acc-1',
      contactId: 'con-1',
      title: 'Acme Quote',
      currency: 'MWK',
      currentVersionId: 'cdv-1',
      latestVersionNumber: 1,
    },
  ];
  const documentVersionStore = overrides._documentVersionStore || [
    {
      id: 'cdv-1',
      documentId: 'doc-1',
      versionNumber: 1,
      versionLabel: 'QUO-2026-000001-V1',
      status: 'READY_TO_ISSUE',
      contentJson: {
        title: 'Acme Quote',
        lineItems: [{ productRef: 'PLAN-CORE', quantity: 2, unitPrice: 100, currency: 'MWK' }],
        totals: { currency: 'MWK', grandTotal: 200 },
        internalNotes: 'SECRET floor 80 — do not show customer',
        approvalChatter: ['approved by boss'],
        priceFloors: { 'PLAN-CORE': 80 },
      },
      immutable: false,
    },
  ];
  const templateStore = overrides._templateStore || [];
  const brandingStore = overrides._brandingStore || [
    {
      id: 'brand-1',
      code: 'DEFAULT',
      legalName: 'InsightBooks',
      primaryColor: '#0F172A',
      status: 'ACTIVE',
    },
  ];
  const renderJobStore = overrides._renderJobStore || [];
  const artifactStore = overrides._artifactStore || [];
  const checksumStore = overrides._checksumStore || [];
  const recipientStore = overrides._recipientStore || [
    {
      id: 'rcp-1',
      documentId: 'doc-1',
      email: 'buyer@acme.test',
      name: 'Buyer One',
      authorityRole: 'SIGNATORY',
      status: 'ACTIVE',
    },
  ];
  const deliveryStore = overrides._deliveryStore || [];
  const reviewAccessStore = overrides._reviewAccessStore || [];
  const reviewSessionStore = overrides._reviewSessionStore || [];
  const viewStore = overrides._viewStore || [];
  const commentStore = overrides._commentStore || [];
  const revisionRequestStore = overrides._revisionRequestStore || [];
  const acceptanceStore = overrides._acceptanceStore || [];
  const rejectionStore = overrides._rejectionStore || [];
  const expiryStore = overrides._expiryStore || [];
  const signatureRequestStore = overrides._signatureRequestStore || [];
  const timelineStore = overrides._timelineStore || [];
  const versionHistoryStore = overrides._versionHistoryStore || [];

  const prisma = {
    $transaction: vi.fn(async (fn) => fn(prisma)),
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
        return null;
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
          id: data.id || `cdv-${documentVersionStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        documentVersionStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return documentVersionStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...documentVersionStore];
        if (where.documentId) rows = rows.filter((r) => r.documentId === where.documentId);
        if (where.status) {
          if (typeof where.status === 'object' && where.status.in) {
            rows = rows.filter((r) => where.status.in.includes(r.status));
          } else {
            rows = rows.filter((r) => r.status === where.status);
          }
        }
        return rows;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = documentVersionStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
      updateMany: vi.fn(async ({ where = {}, data = {} } = {}) => {
        let count = 0;
        for (const row of documentVersionStore) {
          let match = true;
          if (where.documentId && row.documentId !== where.documentId) match = false;
          if (where.status) {
            if (typeof where.status === 'object' && where.status.in) {
              if (!where.status.in.includes(row.status)) match = false;
            } else if (row.status !== where.status) match = false;
          }
          if (where.id?.not && row.id === where.id.not) match = false;
          if (match) {
            Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
            count += 1;
          }
        }
        return { count };
      }),
    },
    crmCommercialDocumentVersionStatusHistory: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `vh-${versionHistoryStore.length + 1}`, ...data };
        versionHistoryStore.push(row);
        return row;
      }),
    },
    crmCommercialTemplate: simpleCrud(templateStore, 'tpl'),
    crmCommercialBranding: simpleCrud(brandingStore, 'brand'),
    crmCommercialRenderJob: simpleCrud(renderJobStore, 'rj'),
    crmCommercialArtifact: simpleCrud(artifactStore, 'art'),
    crmCommercialChecksum: simpleCrud(checksumStore, 'cks'),
    crmCommercialRecipient: simpleCrud(recipientStore, 'rcp'),
    crmCommercialDelivery: simpleCrud(deliveryStore, 'del'),
    crmCommercialReviewAccess: simpleCrud(reviewAccessStore, 'ra'),
    crmCommercialReviewSession: simpleCrud(reviewSessionStore, 'rs'),
    crmCommercialCustomerView: simpleCrud(viewStore, 'view'),
    crmCommercialCustomerComment: simpleCrud(commentStore, 'cmt'),
    crmCommercialRevisionRequest: simpleCrud(revisionRequestStore, 'rev'),
    crmCommercialAcceptance: simpleCrud(acceptanceStore, 'acc'),
    crmCommercialRejection: simpleCrud(rejectionStore, 'rej'),
    crmCommercialExpiry: simpleCrud(expiryStore, 'exp'),
    crmCommercialSignatureRequest: simpleCrud(signatureRequestStore, 'sig'),
    crmTimelineEvent: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `tl-${timelineStore.length + 1}`, ...data };
        timelineStore.push(row);
        return row;
      }),
    },
    _stores: {
      documentStore,
      documentVersionStore,
      templateStore,
      brandingStore,
      renderJobStore,
      artifactStore,
      checksumStore,
      recipientStore,
      deliveryStore,
      reviewAccessStore,
      reviewSessionStore,
      viewStore,
      commentStore,
      revisionRequestStore,
      acceptanceStore,
      rejectionStore,
      expiryStore,
      signatureRequestStore,
      timelineStore,
      versionHistoryStore,
    },
  };

  // Enhance findUnique for branding by code
  const origBrand = prisma.crmCommercialBranding.findUnique;
  prisma.crmCommercialBranding.findUnique = vi.fn(async ({ where = {} } = {}) => {
    if (where.code) return brandingStore.find((r) => r.code === where.code) || null;
    return origBrand({ where });
  });

  return prisma;
}

describe('Phase 15 Wave 3 — Templates, PDF, issue, delivery, review, acceptance', () => {
  let prisma;
  let admin;
  let actorContext;

  beforeEach(() => {
    prisma = makePrisma();
    admin = superAdmin('sales-1');
    actorContext = { admin };
  });

  it('Issued PDF checksum is stable; regenerate creates new artifact (no silent replace)', async () => {
    const first = await renderCommercialDocument(prisma, {
      actorContext,
      versionId: 'cdv-1',
      projection: 'ISSUED',
      idempotencyKey: 'render-1',
    });
    expect(first.ok).toBe(true);
    expect(first.artifact?.id).toBeTruthy();
    expect(first.checksum?.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(first.artifact.projection).toBe('ISSUED');
    expect(Buffer.isBuffer(first.artifact.buffer) || first.artifact.byteLength > 0).toBeTruthy();

    const idempotent = await renderCommercialDocument(prisma, {
      actorContext,
      versionId: 'cdv-1',
      projection: 'ISSUED',
      idempotencyKey: 'render-1',
    });
    expect(idempotent.ok).toBe(true);
    expect(idempotent.artifact.id).toBe(first.artifact.id);
    expect(idempotent.checksum.sha256).toBe(first.checksum.sha256);
    expect(prisma._stores.artifactStore.length).toBe(1);

    const regenerated = await renderCommercialDocument(prisma, {
      actorContext,
      versionId: 'cdv-1',
      projection: 'ISSUED',
      idempotencyKey: 'render-2',
    });
    expect(regenerated.ok).toBe(true);
    expect(regenerated.artifact.id).not.toBe(first.artifact.id);
    expect(regenerated.checksum.sha256).toBe(first.checksum.sha256);
    expect(prisma._stores.artifactStore.length).toBe(2);
    // Original artifact untouched
    expect(prisma._stores.artifactStore[0].id).toBe(first.artifact.id);
    expect(prisma._stores.checksumStore[0].sha256).toBe(first.checksum.sha256);
  });

  it('Issue retry does not duplicate email/link delivery', async () => {
    const rendered = await renderCommercialDocument(prisma, {
      actorContext,
      versionId: 'cdv-1',
      projection: 'ISSUED',
      idempotencyKey: 'render-issue',
    });
    expect(rendered.ok).toBe(true);

    const args = {
      actorContext,
      commercialDocumentVersionId: 'cdv-1',
      artifactId: rendered.artifact.id,
      recipientIds: ['rcp-1'],
      deliveryMethod: 'SECURE_LINK',
      validUntil: '2026-12-31T23:59:59.000Z',
      idempotencyKey: 'issue-1',
    };

    const first = await issueCommercialDocument(prisma, args);
    expect(first.ok).toBe(true);
    expect(first.issue?.id || first.delivery?.id).toBeTruthy();
    expect(prisma._stores.deliveryStore.length).toBe(1);
    expect(prisma._stores.reviewAccessStore.length).toBe(1);

    const retry = await issueCommercialDocument(prisma, args);
    expect(retry.ok).toBe(true);
    expect(retry.alreadyExists).toBe(true);
    expect(prisma._stores.deliveryStore.length).toBe(1);
    expect(prisma._stores.reviewAccessStore.length).toBe(1);
  });

  it('View is NOT created from delivery alone', async () => {
    const rendered = await renderCommercialDocument(prisma, {
      actorContext,
      versionId: 'cdv-1',
      projection: 'ISSUED',
      idempotencyKey: 'render-del',
    });
    const issued = await issueCommercialDocument(prisma, {
      actorContext,
      commercialDocumentVersionId: 'cdv-1',
      artifactId: rendered.artifact.id,
      recipientIds: ['rcp-1'],
      deliveryMethod: 'SECURE_LINK',
      validUntil: '2026-12-31T23:59:59.000Z',
      idempotencyKey: 'issue-del',
    });
    expect(issued.ok).toBe(true);
    expect(prisma._stores.deliveryStore.length).toBe(1);
    expect(prisma._stores.viewStore.length).toBe(0);

    const version = prisma._stores.documentVersionStore.find((v) => v.id === 'cdv-1');
    expect(version.status).not.toBe(CRM_COMMERCIAL_DOCUMENT_STATUS.VIEWED);
    expect(version.status).not.toBe(CRM_COMMERCIAL_DOCUMENT_STATUS.ACCEPTED);
  });

  it('Accept V1 after V2 supersede is blocked', async () => {
    const v1Render = await renderCommercialDocument(prisma, {
      actorContext,
      versionId: 'cdv-1',
      projection: 'ISSUED',
      idempotencyKey: 'render-v1',
    });
    await issueCommercialDocument(prisma, {
      actorContext,
      commercialDocumentVersionId: 'cdv-1',
      artifactId: v1Render.artifact.id,
      recipientIds: ['rcp-1'],
      deliveryMethod: 'SECURE_LINK',
      validUntil: '2026-12-31T23:59:59.000Z',
      idempotencyKey: 'issue-v1',
    });

    // Create V2 ready to issue and issue it (supersedes V1)
    prisma._stores.documentVersionStore.push({
      id: 'cdv-2',
      documentId: 'doc-1',
      versionNumber: 2,
      versionLabel: 'QUO-2026-000001-V2',
      status: 'READY_TO_ISSUE',
      contentJson: {
        title: 'Acme Quote V2',
        lineItems: [{ productRef: 'PLAN-CORE', quantity: 3, unitPrice: 100, currency: 'MWK' }],
        totals: { currency: 'MWK', grandTotal: 300 },
      },
      immutable: false,
    });
    prisma._stores.documentStore[0].latestVersionNumber = 2;
    prisma._stores.documentStore[0].currentVersionId = 'cdv-2';

    const v2Render = await renderCommercialDocument(prisma, {
      actorContext,
      versionId: 'cdv-2',
      projection: 'ISSUED',
      idempotencyKey: 'render-v2',
    });
    await issueCommercialDocument(prisma, {
      actorContext,
      commercialDocumentVersionId: 'cdv-2',
      artifactId: v2Render.artifact.id,
      recipientIds: ['rcp-1'],
      deliveryMethod: 'SECURE_LINK',
      validUntil: '2026-12-31T23:59:59.000Z',
      idempotencyKey: 'issue-v2',
    });

    const v1 = prisma._stores.documentVersionStore.find((v) => v.id === 'cdv-1');
    expect(v1.status).toBe(CRM_COMMERCIAL_DOCUMENT_STATUS.SUPERSEDED);

    const access = prisma._stores.reviewAccessStore.find(
      (a) => a.documentVersionId === 'cdv-1' && a.revokedAt == null
    );
    // V1 links should be revoked on supersession
    const v1AccessAny = prisma._stores.reviewAccessStore.filter((a) => a.documentVersionId === 'cdv-1');
    expect(v1AccessAny.every((a) => a.revokedAt != null)).toBe(true);

    const accept = await acceptCommercialDocument(prisma, {
      documentVersionId: 'cdv-1',
      artifactId: v1Render.artifact.id,
      checksumSha256: v1Render.checksum.sha256,
      recipientId: 'rcp-1',
      authorityRole: 'SIGNATORY',
      idempotencyKey: 'accept-v1-late',
    });
    expect(accept.ok).toBe(false);
    expect(String(accept.error || '')).toMatch(/superseded|not_acceptable|revoked/i);
    expect(prisma._stores.acceptanceStore.length).toBe(0);
    expect(access).toBeFalsy();
  });

  it('E-sign provider status is NOT_CONFIGURED', () => {
    const status = getESignatureProviderStatus();
    expect(status).toEqual({ status: 'NOT_CONFIGURED' });
    expect(getCommercialDomainContract().eSignProvider).toBe('NOT_CONFIGURED');
  });

  it('Acceptance without checksum fails', async () => {
    const rendered = await renderCommercialDocument(prisma, {
      actorContext,
      versionId: 'cdv-1',
      projection: 'ISSUED',
      idempotencyKey: 'render-acc',
    });
    await issueCommercialDocument(prisma, {
      actorContext,
      commercialDocumentVersionId: 'cdv-1',
      artifactId: rendered.artifact.id,
      recipientIds: ['rcp-1'],
      deliveryMethod: 'SECURE_LINK',
      validUntil: '2026-12-31T23:59:59.000Z',
      idempotencyKey: 'issue-acc',
    });

    // Explicit view first (delivery ≠ view)
    const token = prisma._stores.reviewAccessStore[0].tokenPlain || null;
    const view = await recordCustomerView(prisma, {
      token: token || prisma._stores.reviewAccessStore[0].id,
      reviewAccessId: prisma._stores.reviewAccessStore[0].id,
      recipientId: 'rcp-1',
    });
    expect(view.ok).toBe(true);
    expect(prisma._stores.viewStore.length).toBe(1);

    const noChecksum = await acceptCommercialDocument(prisma, {
      documentVersionId: 'cdv-1',
      artifactId: rendered.artifact.id,
      // checksumSha256 omitted
      recipientId: 'rcp-1',
      authorityRole: 'SIGNATORY',
      idempotencyKey: 'accept-no-cks',
    });
    expect(noChecksum.ok).toBe(false);
    expect(String(noChecksum.error || '')).toMatch(/checksum/i);
    expect(prisma._stores.acceptanceStore.length).toBe(0);
  });

  it('Expiry job double-run expires once (idempotent)', async () => {
    const rendered = await renderCommercialDocument(prisma, {
      actorContext,
      versionId: 'cdv-1',
      projection: 'ISSUED',
      idempotencyKey: 'render-exp',
    });
    await issueCommercialDocument(prisma, {
      actorContext,
      commercialDocumentVersionId: 'cdv-1',
      artifactId: rendered.artifact.id,
      recipientIds: ['rcp-1'],
      deliveryMethod: 'SECURE_LINK',
      validUntil: '2026-01-01T00:00:00.000Z',
      idempotencyKey: 'issue-exp',
    });

    const now = new Date('2026-07-31T12:00:00.000Z');
    const first = await runCommercialExpiryJob(prisma, { now, idempotencyKey: 'exp-job-1' });
    expect(first.ok).toBe(true);
    expect(first.expiredCount).toBe(1);
    expect(prisma._stores.documentVersionStore.find((v) => v.id === 'cdv-1').status).toBe(
      CRM_COMMERCIAL_DOCUMENT_STATUS.EXPIRED
    );
    expect(prisma._stores.expiryStore.length).toBe(1);

    const second = await runCommercialExpiryJob(prisma, { now, idempotencyKey: 'exp-job-1' });
    expect(second.ok).toBe(true);
    expect(second.alreadyRan || second.expiredCount === 0 || second.idempotent).toBeTruthy();
    expect(prisma._stores.expiryStore.length).toBe(1);
  });

  it('Accept/reject with unknown token fails (must resolve token)', async () => {
    const rendered = await renderCommercialDocument(prisma, {
      actorContext,
      versionId: 'cdv-1',
      projection: 'ISSUED',
      idempotencyKey: 'render-tok',
    });
    await issueCommercialDocument(prisma, {
      actorContext,
      commercialDocumentVersionId: 'cdv-1',
      artifactId: rendered.artifact.id,
      recipientIds: ['rcp-1'],
      deliveryMethod: 'SECURE_LINK',
      validUntil: '2026-12-31T23:59:59.000Z',
      idempotencyKey: 'issue-tok',
    });
    const access = prisma._stores.reviewAccessStore[0];

    const unknownAccept = await acceptCommercialDocument(prisma, {
      token: 'a'.repeat(32),
      documentVersionId: access.documentVersionId,
      artifactId: access.artifactId,
      checksumSha256: access.checksumSha256,
      recipientId: access.recipientId,
      authorityRole: 'SIGNATORY',
      idempotencyKey: 'accept-bad-token',
    });
    expect(unknownAccept.ok).toBe(false);
    expect(String(unknownAccept.error || '')).toMatch(/invalid_or_expired_token/i);
    expect(prisma._stores.acceptanceStore.length).toBe(0);

    const unknownReject = await rejectCommercialDocument(prisma, {
      token: 'b'.repeat(32),
      documentVersionId: access.documentVersionId,
      artifactId: access.artifactId,
      checksumSha256: access.checksumSha256,
      recipientId: access.recipientId,
      reason: 'nope',
      idempotencyKey: 'reject-bad-token',
    });
    expect(unknownReject.ok).toBe(false);
    expect(String(unknownReject.error || '')).toMatch(/invalid_or_expired_token/i);
    expect(prisma._stores.rejectionStore.length).toBe(0);

    // Valid token binds and accepts
    const ok = await acceptCommercialDocument(prisma, {
      token: access.tokenPlain,
      authorityRole: 'SIGNATORY',
      idempotencyKey: 'accept-good-token',
    });
    expect(ok.ok).toBe(true);
    expect(prisma._stores.acceptanceStore.length).toBe(1);
  });

  it('Expired review access cannot accept', async () => {
    const rendered = await renderCommercialDocument(prisma, {
      actorContext,
      versionId: 'cdv-1',
      projection: 'ISSUED',
      idempotencyKey: 'render-exp-acc',
    });
    await issueCommercialDocument(prisma, {
      actorContext,
      commercialDocumentVersionId: 'cdv-1',
      artifactId: rendered.artifact.id,
      recipientIds: ['rcp-1'],
      deliveryMethod: 'SECURE_LINK',
      validUntil: '2026-12-31T23:59:59.000Z',
      idempotencyKey: 'issue-exp-acc',
    });
    const access = prisma._stores.reviewAccessStore[0];
    access.expiresAt = new Date('2026-01-01T00:00:00.000Z');
    const now = new Date('2026-07-31T12:00:00.000Z');

    const viaToken = await acceptCommercialDocument(prisma, {
      token: access.tokenPlain,
      authorityRole: 'SIGNATORY',
      idempotencyKey: 'accept-expired-token',
      now,
    });
    expect(viaToken.ok).toBe(false);
    expect(String(viaToken.error || '')).toMatch(/review_access_expired/i);

    const viaIds = await acceptCommercialDocument(prisma, {
      documentVersionId: access.documentVersionId,
      artifactId: access.artifactId,
      checksumSha256: access.checksumSha256,
      recipientId: access.recipientId,
      authorityRole: 'SIGNATORY',
      idempotencyKey: 'accept-expired-ids',
      now,
    });
    expect(viaIds.ok).toBe(false);
    expect(String(viaIds.error || '')).toMatch(/review_access_expired/i);
    expect(prisma._stores.acceptanceStore.length).toBe(0);
  });

  it('Empty recipient authority role cannot accept via claimed SIGNATORY', async () => {
    prisma._stores.recipientStore[0].authorityRole = '';
    const rendered = await renderCommercialDocument(prisma, {
      actorContext,
      versionId: 'cdv-1',
      projection: 'ISSUED',
      idempotencyKey: 'render-auth',
    });
    await issueCommercialDocument(prisma, {
      actorContext,
      commercialDocumentVersionId: 'cdv-1',
      artifactId: rendered.artifact.id,
      recipientIds: ['rcp-1'],
      deliveryMethod: 'SECURE_LINK',
      validUntil: '2026-12-31T23:59:59.000Z',
      idempotencyKey: 'issue-auth',
    });
    const access = prisma._stores.reviewAccessStore[0];

    const accept = await acceptCommercialDocument(prisma, {
      token: access.tokenPlain,
      authorityRole: 'SIGNATORY',
      idempotencyKey: 'accept-unverified',
    });
    expect(accept.ok).toBe(false);
    expect(String(accept.error || '')).toMatch(/authority_unverified/i);
    expect(accept.status).toBe('UNVERIFIED');
    expect(prisma._stores.acceptanceStore.length).toBe(0);
  });
});
