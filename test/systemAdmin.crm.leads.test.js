/**
 * Phase 11 Wave 1 — CrmLead / CrmAccount / CrmContact
 * (≠ Customer ≠ SupportTicket ≠ CsCase; POS sales.* unused).
 */
import { describe, it, expect, vi } from 'vitest';
import {
  CRM_LEAD_STATUS,
  CRM_SOURCE_CHANNEL,
  CRM_QUALIFICATION_RESPONSE,
  CRM_DEFAULT_QUALIFICATION_VERSION_ID,
  channelAvailability,
  canTransition,
  assertTransition,
  allocateCrmNumber,
  CRM_LEAD_NUMBER_RE,
  CRM_ACCOUNT_NUMBER_RE,
  CRM_CONTACT_NUMBER_RE,
  createLead,
  listLeads,
  getLead,
  transitionLeadStatus,
  createAccount,
  listAccounts,
  getAccount,
  createContact,
  listContacts,
  getContact,
  hasCrmLeadModel,
  hasCrmAccountModel,
  hasCrmContactModel,
  CRM_LIST_MAX_LIMIT,
} from '@/lib/admin/crm';
import { SYSTEM_ADMIN_PERMISSIONS, NAV_PERMISSION_MAP } from '@/lib/admin/permissions';

/** Seed qualifying responses so QUALIFIED transition is fail-closed-safe. */
function seedQualifiedResponses(prisma, leadId) {
  for (const criterionKey of ['BUDGET', 'AUTHORITY', 'NEED', 'TIMELINE']) {
    prisma._responseStore.push({
      leadId,
      definitionVersionId: CRM_DEFAULT_QUALIFICATION_VERSION_ID,
      criterionKey,
      state: CRM_QUALIFICATION_RESPONSE.YES,
    });
  }
}

function makePrisma(overrides = {}) {
  const leadStore = overrides._leadStore || [];
  const accountStore = overrides._accountStore || [];
  const contactStore = overrides._contactStore || [];
  const historyStore = overrides._historyStore || [];
  const seqStore = overrides._seqStore || [];
  const caseStore = overrides._caseStore || [];
  const ticketStore = overrides._ticketStore || [];
  const responseStore = overrides._responseStore || [];

  const prisma = {
    crmLead: {
      findMany: vi.fn(async ({ where = {}, take, skip, cursor, orderBy } = {}) => {
        let rows = [...leadStore];
        if (where?.status?.in) {
          const set = new Set(where.status.in);
          rows = rows.filter((r) => set.has(r.status));
        } else if (where?.status) {
          rows = rows.filter((r) => r.status === where.status);
        }
        if (where?.ownerAdminId) {
          rows = rows.filter((r) => r.ownerAdminId === where.ownerAdminId);
        }
        if (orderBy?.createdAt === 'desc') {
          rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
        let start = 0;
        if (cursor?.id) {
          const idx = rows.findIndex((r) => r.id === cursor.id);
          start = idx >= 0 ? idx + 1 : 0;
        }
        if (typeof skip === 'number') start += skip;
        const limit = typeof take === 'number' ? take : rows.length;
        return rows.slice(start, start + limit);
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
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...leadStore];
        if (where?.OR) {
          rows = rows.filter((r) =>
            where.OR.some((clause) => {
              if (clause.id) return r.id === clause.id;
              if (clause.leadNumber) return r.leadNumber === clause.leadNumber;
              return false;
            })
          );
        }
        return rows[0] || null;
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
      update: vi.fn(async ({ where, data }) => {
        const row = leadStore.find((r) => r.id === where.id);
        if (!row) throw Object.assign(new Error('not found'), { code: 'P2025' });
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      }),
      count: vi.fn(async () => leadStore.length),
    },
    crmAccount: {
      findMany: vi.fn(async ({ where = {}, take, skip, cursor, orderBy } = {}) => {
        let rows = [...accountStore];
        if (where?.status) rows = rows.filter((r) => r.status === where.status);
        if (orderBy?.createdAt === 'desc') {
          rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
        let start = 0;
        if (cursor?.id) {
          const idx = rows.findIndex((r) => r.id === cursor.id);
          start = idx >= 0 ? idx + 1 : 0;
        }
        if (typeof skip === 'number') start += skip;
        const limit = typeof take === 'number' ? take : rows.length;
        return rows.slice(start, start + limit);
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return accountStore.find((r) => r.id === where.id) || null;
        if (where.accountNumber) {
          return accountStore.find((r) => r.accountNumber === where.accountNumber) || null;
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...accountStore];
        if (where?.OR) {
          rows = rows.filter((r) =>
            where.OR.some((clause) => {
              if (clause.id) return r.id === clause.id;
              if (clause.accountNumber) return r.accountNumber === clause.accountNumber;
              return false;
            })
          );
        }
        return rows[0] || null;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `acc-${accountStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        accountStore.push(row);
        return row;
      }),
    },
    crmContact: {
      findMany: vi.fn(async ({ where = {}, take, skip, cursor, orderBy } = {}) => {
        let rows = [...contactStore];
        if (where?.accountId) rows = rows.filter((r) => r.accountId === where.accountId);
        if (orderBy?.createdAt === 'desc') {
          rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
        let start = 0;
        if (cursor?.id) {
          const idx = rows.findIndex((r) => r.id === cursor.id);
          start = idx >= 0 ? idx + 1 : 0;
        }
        if (typeof skip === 'number') start += skip;
        const limit = typeof take === 'number' ? take : rows.length;
        return rows.slice(start, start + limit);
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return contactStore.find((r) => r.id === where.id) || null;
        if (where.contactNumber) {
          return contactStore.find((r) => r.contactNumber === where.contactNumber) || null;
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...contactStore];
        if (where?.OR) {
          rows = rows.filter((r) =>
            where.OR.some((clause) => {
              if (clause.id) return r.id === clause.id;
              if (clause.contactNumber) return r.contactNumber === clause.contactNumber;
              return false;
            })
          );
        }
        return rows[0] || null;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `con-${contactStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        contactStore.push(row);
        return row;
      }),
    },
    crmLeadStatusHistory: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: `clh-${historyStore.length + 1}`,
          at: data.at || new Date(),
          ...data,
        };
        historyStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...historyStore];
        if (where?.leadId) rows = rows.filter((r) => r.leadId === where.leadId);
        return rows;
      }),
    },
    crmQualificationResponse: {
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...responseStore];
        if (where?.leadId) rows = rows.filter((r) => r.leadId === where.leadId);
        if (where?.definitionVersionId) {
          rows = rows.filter((r) => r.definitionVersionId === where.definitionVersionId);
        }
        return rows;
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
        const existing = seqStore.find(
          (r) => r.prefix === data.prefix && r.year === data.year
        );
        if (existing) {
          const err = new Error('Unique constraint');
          err.code = 'P2002';
          throw err;
        }
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
    csCase: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `case-${caseStore.length + 1}`, ...data };
        caseStore.push(row);
        return row;
      }),
      findMany: vi.fn(async () => [...caseStore]),
      count: vi.fn(async () => caseStore.length),
    },
    supportTicket: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `st-${ticketStore.length + 1}`, ...data };
        ticketStore.push(row);
        return row;
      }),
      findMany: vi.fn(async () => [...ticketStore]),
      count: vi.fn(async () => ticketStore.length),
    },
    $transaction: vi.fn(async (fn) => fn(prisma)),
  };

  prisma._leadStore = leadStore;
  prisma._accountStore = accountStore;
  prisma._contactStore = contactStore;
  prisma._historyStore = historyStore;
  prisma._seqStore = seqStore;
  prisma._caseStore = caseStore;
  prisma._ticketStore = ticketStore;
  prisma._responseStore = responseStore;
  return prisma;
}

const superAdmin = { id: 'a-super', role: 'Super Admin', permissions: {} };

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
        viewAccounts: true,
        createAccounts: true,
        viewContacts: true,
        createContacts: true,
        transitionStatus: true,
      },
    },
  },
};

const crmViewer = {
  id: 'admin-crm-viewer',
  role: 'Platform Support',
  permissions: {
    systemAdmin: {
      crm: { view: true, viewLeads: true, viewAccounts: true, viewContacts: true },
    },
  },
};

const noPerms = {
  id: 'admin-none',
  role: 'Platform Support',
  permissions: { systemAdmin: {} },
};

describe('systemAdmin.crm.leads', () => {
  it('defines CRM Wave 1 permissions and nav map for /insightbooks/crm', () => {
    expect(SYSTEM_ADMIN_PERMISSIONS.crm.view).toBe('systemAdmin.crm.view');
    expect(SYSTEM_ADMIN_PERMISSIONS.crm.viewLeads).toBe('systemAdmin.crm.viewLeads');
    expect(SYSTEM_ADMIN_PERMISSIONS.crm.createLeads).toBe('systemAdmin.crm.createLeads');
    expect(SYSTEM_ADMIN_PERMISSIONS.crm.transitionStatus).toBe(
      'systemAdmin.crm.transitionStatus'
    );
    expect(SYSTEM_ADMIN_PERMISSIONS.crm.viewAccounts).toBe('systemAdmin.crm.viewAccounts');
    expect(SYSTEM_ADMIN_PERMISSIONS.crm.createAccounts).toBe('systemAdmin.crm.createAccounts');
    expect(SYSTEM_ADMIN_PERMISSIONS.crm.viewContacts).toBe('systemAdmin.crm.viewContacts');
    expect(SYSTEM_ADMIN_PERMISSIONS.crm.createContacts).toBe('systemAdmin.crm.createContacts');
    expect(NAV_PERMISSION_MAP['/insightbooks/crm']).toBe(SYSTEM_ADMIN_PERMISSIONS.crm.view);
    expect(NAV_PERMISSION_MAP['/insightbooks/crm/leads']).toBe(
      SYSTEM_ADMIN_PERMISSIONS.crm.viewLeads
    );
  });

  it('marks EMAIL / WHATSAPP channels as NOT_AVAILABLE', () => {
    expect(channelAvailability(CRM_SOURCE_CHANNEL.ADMIN_MANUAL)).toBe('AVAILABLE');
    expect(channelAvailability(CRM_SOURCE_CHANNEL.EMAIL)).toBe('NOT_AVAILABLE');
    expect(channelAvailability(CRM_SOURCE_CHANNEL.WHATSAPP)).toBe('NOT_AVAILABLE');
  });

  it('allocates unique LEAD/ACC/CON-YYYY-###### numbers', async () => {
    const prisma = makePrisma();
    const now = new Date('2026-07-30T12:00:00.000Z');

    const l1 = await allocateCrmNumber(prisma, { prefix: 'LEAD', now });
    const l2 = await allocateCrmNumber(prisma, { prefix: 'LEAD', now });
    const a1 = await allocateCrmNumber(prisma, { prefix: 'ACC', now });
    const c1 = await allocateCrmNumber(prisma, { prefix: 'CON', now });

    expect(l1.ok).toBe(true);
    expect(l2.ok).toBe(true);
    expect(a1.ok).toBe(true);
    expect(c1.ok).toBe(true);
    expect(l1.number).toMatch(CRM_LEAD_NUMBER_RE);
    expect(a1.number).toMatch(CRM_ACCOUNT_NUMBER_RE);
    expect(c1.number).toMatch(CRM_CONTACT_NUMBER_RE);
    expect(l1.number).toBe('LEAD-2026-000001');
    expect(l2.number).toBe('LEAD-2026-000002');
    expect(a1.number).toBe('ACC-2026-000001');
    expect(c1.number).toBe('CON-2026-000001');
    expect(new Set([l1.number, l2.number, a1.number, c1.number]).size).toBe(4);
  });

  it('creates Lead as NEW and does not create CsCase or SupportTicket', async () => {
    const prisma = makePrisma();
    expect(hasCrmLeadModel(prisma)).toBe(true);

    const result = await createLead(prisma, {
      admin: crmAgent,
      type: 'NEW_BUSINESS',
      personOrOrganisation: 'PERSON',
      title: 'Demo interest',
      summary: 'Interested in InsightBooks',
      source: 'MANUAL',
      now: new Date('2026-07-30T12:00:00.000Z'),
    });

    expect(result.ok).toBe(true);
    expect(result.lead.status).toBe(CRM_LEAD_STATUS.NEW);
    expect(result.lead.leadNumber).toMatch(/^LEAD-2026-\d{6}$/);
    expect(result.lead.channel).toBe(CRM_SOURCE_CHANNEL.ADMIN_MANUAL);
    expect(prisma.crmLead.create).toHaveBeenCalled();
    expect(prisma.csCase.create).not.toHaveBeenCalled();
    expect(prisma.supportTicket.create).not.toHaveBeenCalled();
    expect(prisma._caseStore.length).toBe(0);
    expect(prisma._ticketStore.length).toBe(0);
    expect(prisma._historyStore.length).toBeGreaterThanOrEqual(1);
    expect(prisma._historyStore[0].toStatus).toBe(CRM_LEAD_STATUS.NEW);
  });

  it('rejects invalid transitions and accepts happy path through QUALIFIED / OPPORTUNITY_READY', async () => {
    const prisma = makePrisma();
    const created = await createLead(prisma, {
      admin: crmAgent,
      type: 'DEMO_REQUEST',
      personOrOrganisation: 'ORGANISATION',
      title: 'Pipeline path',
      source: 'MANUAL',
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(created.ok).toBe(true);
    const id = created.lead.id;

    const bad = await transitionLeadStatus(prisma, {
      admin: crmAgent,
      leadId: id,
      toStatus: CRM_LEAD_STATUS.QUALIFIED,
    });
    expect(bad.ok).toBe(false);
    expect(bad.error).toBe('INVALID_TRANSITION');

    const path = [
      CRM_LEAD_STATUS.ASSIGNED,
      CRM_LEAD_STATUS.ACCEPTED,
      CRM_LEAD_STATUS.ATTEMPTING_CONTACT,
      CRM_LEAD_STATUS.CONTACTED,
      CRM_LEAD_STATUS.QUALIFICATION_IN_PROGRESS,
      CRM_LEAD_STATUS.QUALIFIED,
      CRM_LEAD_STATUS.OPPORTUNITY_READY,
    ];
    for (const toStatus of path) {
      if (toStatus === CRM_LEAD_STATUS.QUALIFIED) seedQualifiedResponses(prisma, id);
      const step = await transitionLeadStatus(prisma, {
        admin: crmAgent,
        leadId: id,
        toStatus,
      });
      expect(step.ok).toBe(true);
      expect(step.lead.status).toBe(toStatus);
    }
    expect(prisma._historyStore.length).toBeGreaterThanOrEqual(path.length + 1);
  });

  it('requires disqualificationReason for DISQUALIFIED', async () => {
    const prisma = makePrisma();
    const created = await createLead(prisma, {
      admin: crmAgent,
      type: 'OTHER',
      personOrOrganisation: 'PERSON',
      title: 'DQ check',
      source: 'MANUAL',
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    const id = created.lead.id;

    const noReason = await transitionLeadStatus(prisma, {
      admin: crmAgent,
      leadId: id,
      toStatus: CRM_LEAD_STATUS.DISQUALIFIED,
    });
    expect(noReason.ok).toBe(false);
    expect(noReason.error).toBe('INVALID_TRANSITION');

    const withReason = await transitionLeadStatus(prisma, {
      admin: crmAgent,
      leadId: id,
      toStatus: CRM_LEAD_STATUS.DISQUALIFIED,
      disqualificationReason: 'Budget not available',
    });
    expect(withReason.ok).toBe(true);
    expect(withReason.lead.status).toBe(CRM_LEAD_STATUS.DISQUALIFIED);
    expect(withReason.lead.disqualificationReason).toBe('Budget not available');
  });

  it('blocks CONVERTED_TO_OPPORTUNITY in Wave 1', async () => {
    const prisma = makePrisma();
    const created = await createLead(prisma, {
      admin: crmAgent,
      type: 'NEW_BUSINESS',
      personOrOrganisation: 'PERSON',
      title: 'Convert block',
      source: 'MANUAL',
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    const id = created.lead.id;
    for (const toStatus of [
      CRM_LEAD_STATUS.ASSIGNED,
      CRM_LEAD_STATUS.ACCEPTED,
      CRM_LEAD_STATUS.ATTEMPTING_CONTACT,
      CRM_LEAD_STATUS.CONTACTED,
      CRM_LEAD_STATUS.QUALIFICATION_IN_PROGRESS,
      CRM_LEAD_STATUS.QUALIFIED,
      CRM_LEAD_STATUS.OPPORTUNITY_READY,
    ]) {
      if (toStatus === CRM_LEAD_STATUS.QUALIFIED) seedQualifiedResponses(prisma, id);
      const step = await transitionLeadStatus(prisma, {
        admin: crmAgent,
        leadId: id,
        toStatus,
      });
      expect(step.ok).toBe(true);
    }

    expect(
      canTransition(CRM_LEAD_STATUS.OPPORTUNITY_READY, CRM_LEAD_STATUS.CONVERTED_TO_OPPORTUNITY)
    ).toBe(false);

    const blocked = await transitionLeadStatus(prisma, {
      admin: crmAgent,
      leadId: id,
      toStatus: CRM_LEAD_STATUS.CONVERTED_TO_OPPORTUNITY,
    });
    expect(blocked.ok).toBe(false);
    expect(['INVALID_TRANSITION', 'NOT_IMPLEMENTED']).toContain(blocked.error);

    const assertBlocked = assertTransition(
      CRM_LEAD_STATUS.OPPORTUNITY_READY,
      CRM_LEAD_STATUS.CONVERTED_TO_OPPORTUNITY
    );
    expect(assertBlocked.ok).toBe(false);
    expect(['INVALID_TRANSITION', 'NOT_IMPLEMENTED']).toContain(assertBlocked.error);
  });

  it('forbids create/list/get/transition without permissions', async () => {
    const prisma = makePrisma();

    const created = await createLead(prisma, {
      admin: noPerms,
      type: 'OTHER',
      personOrOrganisation: 'PERSON',
      title: 'Nope',
      source: 'MANUAL',
    });
    expect(created.ok).toBe(false);
    expect(created.forbidden).toBe(true);

    const listed = await listLeads(prisma, { admin: noPerms });
    expect(listed.ok).toBe(false);
    expect(listed.forbidden).toBe(true);

    prisma._leadStore.push({
      id: 'lead-existing',
      leadNumber: 'LEAD-2026-000099',
      status: CRM_LEAD_STATUS.NEW,
      type: 'OTHER',
      personOrOrganisation: 'PERSON',
      title: 'Existing',
      source: 'MANUAL',
      channel: CRM_SOURCE_CHANNEL.ADMIN_MANUAL,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const got = await getLead(prisma, { admin: noPerms, id: 'lead-existing' });
    expect(got.ok).toBe(false);
    expect(got.forbidden).toBe(true);

    const transition = await transitionLeadStatus(prisma, {
      admin: crmViewer,
      leadId: 'lead-existing',
      toStatus: CRM_LEAD_STATUS.ASSIGNED,
    });
    expect(transition.ok).toBe(false);
    expect(transition.forbidden).toBe(true);
  });

  it('bounds list pagination for leads/accounts/contacts', async () => {
    const prisma = makePrisma();
    for (let i = 0; i < 25; i += 1) {
      prisma._leadStore.push({
        id: `lead-${i}`,
        leadNumber: `LEAD-2026-${String(i + 1).padStart(6, '0')}`,
        status: CRM_LEAD_STATUS.NEW,
        type: 'OTHER',
        personOrOrganisation: 'PERSON',
        title: `L${i}`,
        source: 'MANUAL',
        channel: CRM_SOURCE_CHANNEL.ADMIN_MANUAL,
        createdAt: new Date(Date.UTC(2026, 6, 1, 0, 0, i)),
        updatedAt: new Date(),
      });
      prisma._accountStore.push({
        id: `acc-${i}`,
        accountNumber: `ACC-2026-${String(i + 1).padStart(6, '0')}`,
        type: 'PROSPECT',
        displayName: `A${i}`,
        status: 'ACTIVE',
        createdAt: new Date(Date.UTC(2026, 6, 1, 0, 0, i)),
        updatedAt: new Date(),
      });
      prisma._contactStore.push({
        id: `con-${i}`,
        contactNumber: `CON-2026-${String(i + 1).padStart(6, '0')}`,
        firstName: `F${i}`,
        lastName: `L${i}`,
        createdAt: new Date(Date.UTC(2026, 6, 1, 0, 0, i)),
        updatedAt: new Date(),
      });
    }

    expect(hasCrmAccountModel(prisma)).toBe(true);
    expect(hasCrmContactModel(prisma)).toBe(true);

    const leads = await listLeads(prisma, { admin: superAdmin, limit: 10 });
    expect(leads.ok).toBe(true);
    expect(leads.items.length).toBe(10);
    expect(leads.meta.limit).toBeLessThanOrEqual(CRM_LIST_MAX_LIMIT);

    const capped = await listLeads(prisma, { admin: superAdmin, limit: 9999 });
    expect(capped.meta.limit).toBeLessThanOrEqual(100);

    const accounts = await listAccounts(prisma, { admin: superAdmin, limit: 10 });
    expect(accounts.ok).toBe(true);
    expect(accounts.items.length).toBe(10);

    const contacts = await listContacts(prisma, { admin: superAdmin, limit: 10 });
    expect(contacts.ok).toBe(true);
    expect(contacts.items.length).toBe(10);
  });

  it('creates and gets accounts and contacts (optional account link)', async () => {
    const prisma = makePrisma();
    const now = new Date('2026-07-30T12:00:00.000Z');

    const account = await createAccount(prisma, {
      admin: crmAgent,
      displayName: 'Acme Corp',
      now,
    });
    expect(account.ok).toBe(true);
    expect(account.account.accountNumber).toMatch(/^ACC-2026-\d{6}$/);
    expect(account.account.type).toBe('PROSPECT');

    const byNumber = await getAccount(prisma, {
      admin: crmAgent,
      id: account.account.accountNumber,
    });
    expect(byNumber.ok).toBe(true);
    expect(byNumber.account.id).toBe(account.account.id);

    const contact = await createContact(prisma, {
      admin: crmAgent,
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'Ada@Example.COM',
      accountId: account.account.id,
      now,
    });
    expect(contact.ok).toBe(true);
    expect(contact.contact.contactNumber).toMatch(/^CON-2026-\d{6}$/);
    expect(contact.contact.email).toBe('ada@example.com');
    expect(contact.contact.accountId).toBe(account.account.id);

    const gotContact = await getContact(prisma, {
      admin: crmAgent,
      id: contact.contact.id,
    });
    expect(gotContact.ok).toBe(true);
    expect(gotContact.contact.lastName).toBe('Lovelace');
  });

  it('does not use POS sales.* for CRM authz', () => {
    expect(SYSTEM_ADMIN_PERMISSIONS.crm.viewLeads).not.toMatch(/^sales\./);
    expect(SYSTEM_ADMIN_PERMISSIONS.crm.createLeads).toMatch(/^systemAdmin\.crm\./);
  });
});
