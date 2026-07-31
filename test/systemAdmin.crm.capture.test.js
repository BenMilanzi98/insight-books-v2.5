/**
 * Phase 11 Wave 2 — public capture + handoff intake → CrmLead
 * (≠ Opportunity ≠ Customer ≠ SupportTicket ≠ CsCase).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CRM_CAPTURE_SOURCE,
  CRM_SOURCE_CHANNEL,
  CRM_LEAD_TYPE,
  CRM_CONSENT_STATUS,
  channelAvailability,
  captureLead,
  intakeHandoffAsLead,
  hasCrmCaptureRecordModel,
  _resetCaptureThrottleForTests,
} from '@/lib/admin/crm';

function makePrisma(overrides = {}) {
  const leadStore = overrides._leadStore || [];
  const captureStore = overrides._captureStore || [];
  const historyStore = overrides._historyStore || [];
  const seqStore = overrides._seqStore || [];
  const duplicateStore = overrides._duplicateStore || [];
  const contactStore = overrides._contactStore || [];
  const accountStore = overrides._accountStore || [];
  const csHandoffStore = overrides._csHandoffStore || [];
  const supportHandoffStore = overrides._supportHandoffStore || [];
  const caseStore = overrides._caseStore || [];
  const ticketStore = overrides._ticketStore || [];

  const prisma = {
    crmLead: {
      findMany: vi.fn(async ({ where = {}, take } = {}) => {
        let rows = [...leadStore];
        if (where?.id?.in) {
          const set = new Set(where.id.in);
          rows = rows.filter((r) => set.has(r.id));
        }
        if (where?.sourceIdempotencyKey) {
          rows = rows.filter((r) => r.sourceIdempotencyKey === where.sourceIdempotencyKey);
        }
        const limit = typeof take === 'number' ? take : rows.length;
        return rows.slice(0, limit);
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return leadStore.find((r) => r.id === where.id) || null;
        if (where.leadNumber) {
          return leadStore.find((r) => r.leadNumber === where.leadNumber) || null;
        }
        if (where.sourceIdempotencyKey) {
          return (
            leadStore.find((r) => r.sourceIdempotencyKey === where.sourceIdempotencyKey) ||
            null
          );
        }
        return null;
      }),
      create: vi.fn(async ({ data }) => {
        if (
          data.sourceIdempotencyKey &&
          leadStore.some((r) => r.sourceIdempotencyKey === data.sourceIdempotencyKey)
        ) {
          const err = new Error('Unique constraint');
          err.code = 'P2002';
          err.meta = { target: ['sourceIdempotencyKey'] };
          throw err;
        }
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
              if (clause.sourceIdempotencyKey) {
                return r.sourceIdempotencyKey === clause.sourceIdempotencyKey;
              }
              return false;
            })
          );
        }
        if (where?.emailNormalized) {
          rows = rows.filter((r) => r.emailNormalized === where.emailNormalized);
        }
        if (where?.phoneNormalized) {
          rows = rows.filter((r) => r.phoneNormalized === where.phoneNormalized);
        }
        if (where?.sourceIdempotencyKey) {
          rows = rows.filter((r) => r.sourceIdempotencyKey === where.sourceIdempotencyKey);
        }
        if (where?.leadId?.not) {
          rows = rows.filter((r) => r.leadId !== where.leadId.not);
        }
        const limit = typeof take === 'number' ? take : rows.length;
        return rows.slice(0, limit);
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.sourceIdempotencyKey) {
          return (
            captureStore.find((r) => r.sourceIdempotencyKey === where.sourceIdempotencyKey) ||
            null
          );
        }
        if (where.id) return captureStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      create: vi.fn(async ({ data }) => {
        if (
          data.sourceIdempotencyKey &&
          captureStore.some((r) => r.sourceIdempotencyKey === data.sourceIdempotencyKey)
        ) {
          const err = new Error('Unique constraint');
          err.code = 'P2002';
          throw err;
        }
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
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...duplicateStore];
        if (where?.leadId) rows = rows.filter((r) => r.leadId === where.leadId);
        if (where?.status) rows = rows.filter((r) => r.status === where.status);
        return rows;
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
          ...data,
        };
        duplicateStore.push(row);
        return row;
      }),
    },
    crmContact: {
      findMany: vi.fn(async ({ where = {}, take } = {}) => {
        let rows = [...contactStore];
        if (where?.OR) {
          rows = rows.filter((r) =>
            where.OR.some((clause) => {
              if (clause.email) return r.email === clause.email;
              if (clause.phone) return r.phone === clause.phone;
              return false;
            })
          );
        }
        return rows.slice(0, typeof take === 'number' ? take : rows.length);
      }),
    },
    crmAccount: {
      findMany: vi.fn(async ({ where = {}, take } = {}) => {
        let rows = [...accountStore];
        if (where?.displayName?.contains) {
          const q = String(where.displayName.contains).toLowerCase();
          rows = rows.filter((r) => String(r.displayName || '').toLowerCase().includes(q));
        }
        return rows.slice(0, typeof take === 'number' ? take : rows.length);
      }),
    },
    crmLeadStatusHistory: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `clh-${historyStore.length + 1}`, at: data.at || new Date(), ...data };
        historyStore.push(row);
        return row;
      }),
      findMany: vi.fn(async () => [...historyStore]),
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
    csExpansionHandoff: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        return csHandoffStore.find((r) => r.id === where.id) || null;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = csHandoffStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data);
        return row;
      }),
    },
    supportHandoff: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        return supportHandoffStore.find((r) => r.id === where.id) || null;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = supportHandoffStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data);
        return row;
      }),
    },
    csCase: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `case-${caseStore.length + 1}`, ...data };
        caseStore.push(row);
        return row;
      }),
    },
    supportTicket: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `st-${ticketStore.length + 1}`, ...data };
        ticketStore.push(row);
        return row;
      }),
    },
    $transaction: vi.fn(async (fn) => fn(prisma)),
  };

  prisma._leadStore = leadStore;
  prisma._captureStore = captureStore;
  prisma._duplicateStore = duplicateStore;
  prisma._historyStore = historyStore;
  prisma._seqStore = seqStore;
  prisma._contactStore = contactStore;
  prisma._accountStore = accountStore;
  prisma._csHandoffStore = csHandoffStore;
  prisma._supportHandoffStore = supportHandoffStore;
  prisma._caseStore = caseStore;
  prisma._ticketStore = ticketStore;
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
        transitionStatus: true,
      },
    },
  },
};

describe('systemAdmin.crm.capture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetCaptureThrottleForTests();
  });

  it('marks WEB_FORM and INTERNAL_HANDOFF available; EMAIL/WHATSAPP NOT_AVAILABLE', () => {
    expect(channelAvailability(CRM_SOURCE_CHANNEL.WEB_FORM)).toBe('AVAILABLE');
    expect(channelAvailability(CRM_SOURCE_CHANNEL.INTERNAL_HANDOFF)).toBe('AVAILABLE');
    expect(channelAvailability(CRM_SOURCE_CHANNEL.EMAIL)).toBe('NOT_AVAILABLE');
    expect(channelAvailability(CRM_SOURCE_CHANNEL.WHATSAPP)).toBe('NOT_AVAILABLE');
  });

  it('rejects EMAIL / WHATSAPP ingest with NOT_AVAILABLE', async () => {
    const prisma = makePrisma();
    const email = await captureLead(prisma, {
      sourceCode: CRM_CAPTURE_SOURCE.WEBSITE_CONTACT_FORM,
      channel: CRM_SOURCE_CHANNEL.EMAIL,
      email: 'a@example.com',
      contactName: 'Ada',
      businessName: 'Ada Co',
      message: 'hi',
    });
    expect(email.ok).toBe(false);
    expect(email.status).toBe('NOT_AVAILABLE');

    const wa = await captureLead(prisma, {
      sourceCode: CRM_CAPTURE_SOURCE.REQUEST_DEMO,
      channel: CRM_SOURCE_CHANNEL.WHATSAPP,
      email: 'a@example.com',
      contactName: 'Ada',
      businessName: 'Ada Co',
      message: 'hi',
    });
    expect(wa.ok).toBe(false);
    expect(wa.status).toBe('NOT_AVAILABLE');
    expect(prisma._leadStore.length).toBe(0);
  });

  it('captures public WEB_FORM lead with distinct source codes and no owner', async () => {
    const prisma = makePrisma();
    expect(hasCrmCaptureRecordModel(prisma)).toBe(true);

    const result = await captureLead(prisma, {
      sourceCode: CRM_CAPTURE_SOURCE.REQUEST_DEMO,
      businessName: 'Acme Ltd',
      contactName: 'Jane Doe',
      email: 'Jane.Doe@Example.COM',
      phone: '+260 97 123 4567',
      message: 'Want a demo next week',
      preferredAt: '2026-08-01T09:00:00.000Z',
      now: new Date('2026-07-30T12:00:00.000Z'),
    });

    expect(result.ok).toBe(true);
    expect(result.created).toBe(true);
    expect(result.idempotent).toBe(false);
    expect(result.lead.source).toBe(CRM_CAPTURE_SOURCE.REQUEST_DEMO);
    expect(result.lead.channel).toBe(CRM_SOURCE_CHANNEL.WEB_FORM);
    expect(result.lead.type).toBe(CRM_LEAD_TYPE.DEMO_REQUEST);
    expect(result.lead.ownerAdminId).toBeNull();
    expect(result.lead.status).toBe('NEW');
    expect(result.capture.emailNormalized).toBe('jane.doe@example.com');
    expect(result.capture.consentStatus).toBe(CRM_CONSENT_STATUS.UNKNOWN);
    expect(prisma._leadStore.length).toBe(1);
    expect(prisma._captureStore.length).toBe(1);
    expect(prisma.csCase.create).not.toHaveBeenCalled();
    expect(prisma.supportTicket.create).not.toHaveBeenCalled();
  });

  it('is idempotent on exact sourceIdempotencyKey retry', async () => {
    const prisma = makePrisma();
    const payload = {
      sourceCode: CRM_CAPTURE_SOURCE.START_TRIAL,
      businessName: 'Trial Co',
      contactName: 'Sam',
      email: 'sam@trial.co',
      phone: '0971112222',
      message: 'Start trial',
      sourceIdempotencyKey: 'crm-capture:START_TRIAL:sam@trial.co',
      now: new Date('2026-07-30T12:00:00.000Z'),
    };

    const first = await captureLead(prisma, payload);
    const second = await captureLead(prisma, payload);

    expect(first.ok).toBe(true);
    expect(first.created).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.created).toBe(false);
    expect(second.idempotent).toBe(true);
    expect(second.lead.id).toBe(first.lead.id);
    expect(prisma._leadStore.length).toBe(1);
  });

  it('ignores client sourceIdempotencyKey; same email+source maps to one Lead', async () => {
    const prisma = makePrisma();
    const base = {
      sourceCode: CRM_CAPTURE_SOURCE.REQUEST_DEMO,
      businessName: 'Acme Ltd',
      contactName: 'Jane Doe',
      email: 'jane.key@example.com',
      phone: '+260 97 555 0001',
      message: 'Want a demo',
      now: new Date('2026-07-30T12:00:00.000Z'),
    };

    const first = await captureLead(prisma, {
      ...base,
      sourceIdempotencyKey: 'client-minted-key-aaa',
    });
    const second = await captureLead(prisma, {
      ...base,
      sourceIdempotencyKey: 'client-minted-key-bbb',
    });

    expect(first.ok).toBe(true);
    expect(first.created).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.idempotent).toBe(true);
    expect(second.lead.id).toBe(first.lead.id);
    expect(prisma._leadStore.length).toBe(1);
    expect(first.lead.sourceIdempotencyKey).toMatch(
      /^crm-capture:REQUEST_DEMO:jane\.key@example\.com\|/
    );
    expect(first.lead.sourceIdempotencyKey).not.toBe('client-minted-key-aaa');
  });

  it('idempotent replay succeeds even when throttle would otherwise fire', async () => {
    const prisma = makePrisma();
    const email = 'throttle@example.com';
    const firstPayload = {
      sourceCode: CRM_CAPTURE_SOURCE.REQUEST_DEMO,
      businessName: 'Throttle Co',
      contactName: 'Tory',
      email,
      phone: '0971000000',
      message: 'first',
      now: new Date('2026-07-30T12:00:00.000Z'),
    };

    const first = await captureLead(prisma, firstPayload);
    expect(first.ok).toBe(true);
    expect(first.created).toBe(true);

    // Exhaust process-local throttle (8 / 60s) with distinct phones, same email.
    let lastNew = null;
    for (let i = 1; i <= 8; i += 1) {
      lastNew = await captureLead(prisma, {
        sourceCode: CRM_CAPTURE_SOURCE.REQUEST_DEMO,
        businessName: 'Throttle Co',
        contactName: 'Tory',
        email,
        phone: `097100000${i}`,
        message: `n${i}`,
        now: new Date('2026-07-30T12:00:00.000Z'),
      });
    }
    expect(lastNew.ok).toBe(false);
    expect(lastNew.error).toBe('rate_limited');

    const blocked = await captureLead(prisma, {
      sourceCode: CRM_CAPTURE_SOURCE.REQUEST_DEMO,
      businessName: 'Throttle Co',
      contactName: 'Tory',
      email,
      phone: '0971999999',
      message: 'should block',
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toBe('rate_limited');

    const replay = await captureLead(prisma, firstPayload);
    expect(replay.ok).toBe(true);
    expect(replay.idempotent).toBe(true);
    expect(replay.lead.id).toBe(first.lead.id);
  });

  it('ignores public owner/team/priority fields', async () => {
    const prisma = makePrisma();
    const result = await captureLead(prisma, {
      sourceCode: CRM_CAPTURE_SOURCE.SALES_ENQUIRY,
      businessName: 'Sales Co',
      contactName: 'Pat',
      email: 'pat@sales.co',
      phone: '0970001111',
      message: 'Pricing?',
      ownerAdminId: 'should-ignore',
      teamId: 'team-x',
      priority: 'HIGH',
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(result.ok).toBe(true);
    expect(result.lead.ownerAdminId).toBeNull();
  });

  it('keeps capture consent UNKNOWN; never GRANTED from client consentPurposes', async () => {
    const prisma = makePrisma();
    const unknown = await captureLead(prisma, {
      sourceCode: CRM_CAPTURE_SOURCE.WEBSITE_CONTACT_FORM,
      businessName: 'A',
      contactName: 'B',
      email: 'b@a.com',
      phone: '1',
      message: 'hello',
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(unknown.capture.consentStatus).toBe(CRM_CONSENT_STATUS.UNKNOWN);

    const withCheckboxes = await captureLead(prisma, {
      sourceCode: CRM_CAPTURE_SOURCE.WEBSITE_CONTACT_FORM,
      businessName: 'A',
      contactName: 'C',
      email: 'c@a.com',
      phone: '2',
      message: 'hello',
      consentPurposes: ['SALES_CONTACT', 'SALES_FOLLOW_UP', 'not-a-purpose'],
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(withCheckboxes.capture.consentStatus).toBe(CRM_CONSENT_STATUS.UNKNOWN);
    // Allowlisted interest flags only — not legal GRANTED / not off-catalogue strings
    expect(withCheckboxes.capture.consentPurposes).toEqual(['SALES_CONTACT']);
  });

  it('rejects honeypot / oversized payloads', async () => {
    const prisma = makePrisma();
    const spam = await captureLead(prisma, {
      sourceCode: CRM_CAPTURE_SOURCE.REQUEST_DEMO,
      businessName: 'Bot',
      contactName: 'Bot',
      email: 'bot@x.com',
      phone: '1',
      message: 'spam',
      website: 'http://spam.example', // honeypot
    });
    expect(spam.ok).toBe(false);
    expect(spam.error).toBe('spam_rejected');

    const huge = await captureLead(prisma, {
      sourceCode: CRM_CAPTURE_SOURCE.REQUEST_DEMO,
      businessName: 'Big',
      contactName: 'Big',
      email: 'big@x.com',
      phone: '1',
      message: 'x'.repeat(80_000),
    });
    expect(huge.ok).toBe(false);
    expect(huge.error).toBe('payload_too_large');
  });

  it('suggests Account/Contact candidates without auto-linking', async () => {
    const prisma = makePrisma({
      _contactStore: [
        {
          id: 'con-1',
          contactNumber: 'CON-2026-000001',
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane.doe@example.com',
          phone: '+260971234567',
        },
      ],
      _accountStore: [
        {
          id: 'acc-1',
          accountNumber: 'ACC-2026-000001',
          displayName: 'Acme Ltd',
          type: 'PROSPECT',
          status: 'ACTIVE',
        },
      ],
    });

    const result = await captureLead(prisma, {
      sourceCode: CRM_CAPTURE_SOURCE.REQUEST_DEMO,
      businessName: 'Acme Ltd',
      contactName: 'Jane Doe',
      email: 'jane.doe@example.com',
      phone: '+260 97 123 4567',
      message: 'demo',
      now: new Date('2026-07-30T12:00:00.000Z'),
    });

    expect(result.ok).toBe(true);
    expect(result.lead.accountId).toBeNull();
    expect(result.lead.contactId).toBeNull();
    expect(result.candidates.contacts.some((c) => c.id === 'con-1')).toBe(true);
    expect(result.candidates.accounts.some((a) => a.id === 'acc-1')).toBe(true);
  });

  it('intakes CS expansion handoff as EXPANSION lead without mutating handoff', async () => {
    const prisma = makePrisma({
      _csHandoffStore: [
        {
          id: 'cs-h-1',
          tenantId: 'tenant-1',
          status: 'OPEN',
          reason: 'Upsell interest',
          notes: 'Asked about Pro',
          recommendedAction: 'UPSELL',
          createdByAdminId: 'cs-admin',
        },
      ],
    });

    const first = await intakeHandoffAsLead(prisma, {
      admin: crmAgent,
      handoffType: 'CUSTOMER_SUCCESS',
      handoffId: 'cs-h-1',
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    const second = await intakeHandoffAsLead(prisma, {
      admin: crmAgent,
      handoffType: 'CUSTOMER_SUCCESS',
      handoffId: 'cs-h-1',
      now: new Date('2026-07-30T12:00:00.000Z'),
    });

    expect(first.ok).toBe(true);
    expect(first.lead.type).toBe(CRM_LEAD_TYPE.EXPANSION);
    expect(first.lead.source).toBe(CRM_CAPTURE_SOURCE.CUSTOMER_SUCCESS_HANDOFF);
    expect(first.lead.channel).toBe(CRM_SOURCE_CHANNEL.INTERNAL_HANDOFF);
    expect(second.idempotent).toBe(true);
    expect(second.lead.id).toBe(first.lead.id);
    expect(prisma.csExpansionHandoff.update).not.toHaveBeenCalled();
    expect(prisma._csHandoffStore[0].status).toBe('OPEN');
    expect(prisma.csCase.create).not.toHaveBeenCalled();
  });

  it('intakes Support handoff and Product signal without mutating source records', async () => {
    const prisma = makePrisma({
      _supportHandoffStore: [
        {
          id: 'sup-h-1',
          ticketId: 't-1',
          tenantId: 'tenant-2',
          targetType: 'PRODUCT',
          status: 'OPEN',
          summary: 'Feature ask',
          featureCode: 'POS_ADVANCED',
          createdByAdminId: 'sup-admin',
        },
      ],
    });

    const support = await intakeHandoffAsLead(prisma, {
      admin: crmAgent,
      handoffType: 'SUPPORT',
      handoffId: 'sup-h-1',
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(support.ok).toBe(true);
    expect(support.lead.source).toBe(CRM_CAPTURE_SOURCE.SUPPORT_HANDOFF);
    expect(prisma.supportHandoff.update).not.toHaveBeenCalled();

    const product = await intakeHandoffAsLead(prisma, {
      admin: crmAgent,
      handoffType: 'PRODUCT',
      handoffId: 'sup-h-1',
      featureCode: 'POS_ADVANCED',
      tenantId: 'tenant-2',
      summary: 'Product signal from support',
      now: new Date('2026-07-30T12:05:00.000Z'),
    });
    expect(product.ok).toBe(true);
    expect(product.lead.source).toBe(CRM_CAPTURE_SOURCE.PRODUCT_SIGNAL);
    expect(product.lead.id).not.toBe(support.lead.id);
  });
});
