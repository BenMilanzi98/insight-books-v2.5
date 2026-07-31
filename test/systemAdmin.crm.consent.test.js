/**
 * Phase 11 Wave 3 — Consent / DNC / communication eligibility.
 * Never infer GRANTED; UNKNOWN/DENIED/WITHDRAWN/DNC block.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  CRM_CONSENT_STATUS,
  CRM_CONSENT_PURPOSE,
  CRM_COMMUNICATION_CHANNEL,
  CRM_DNC_FLAG,
  recordConsent,
  setDoNotContact,
  getConsentStatus,
  checkCommunicationEligibility,
} from '@/lib/admin/crm';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';

const crmAgent = {
  id: 'admin-consent',
  role: 'Platform Support',
  permissions: {
    systemAdmin: {
      crm: { manageConsent: true, viewContacts: true, viewLeads: true },
    },
  },
};

function makePrisma(overrides = {}) {
  const consentStore = overrides._consentStore || [];
  const dncStore = overrides._dncStore || [];

  return {
    _consentStore: consentStore,
    _dncStore: dncStore,
    crmConsentRecord: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `c-${consentStore.length + 1}`, ...data };
        consentStore.push(row);
        return row;
      }),
      upsert: vi.fn(async ({ where, create, update }) => {
        const key = where.contactId_purpose;
        let row = consentStore.find(
          (r) => r.contactId === key.contactId && r.purpose === key.purpose
        );
        if (row) {
          Object.assign(row, update);
          return row;
        }
        row = { id: `c-${consentStore.length + 1}`, ...create };
        consentStore.push(row);
        return row;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        const rows = consentStore.filter(
          (r) =>
            (!where.contactId || r.contactId === where.contactId) &&
            (!where.purpose || r.purpose === where.purpose)
        );
        return rows[rows.length - 1] || null;
      }),
    },
    crmDoNotContact: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `d-${dncStore.length + 1}`, ...data };
        dncStore.push(row);
        return row;
      }),
      upsert: vi.fn(async ({ where, create, update }) => {
        const key = where.contactId_flag;
        let row = dncStore.find((r) => r.contactId === key.contactId && r.flag === key.flag);
        if (row) {
          Object.assign(row, update);
          return row;
        }
        row = { id: `d-${dncStore.length + 1}`, ...create };
        dncStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) =>
        dncStore.filter(
          (r) =>
            (!where.contactId || r.contactId === where.contactId) &&
            (where.active == null || r.active === where.active)
        )
      ),
    },
  };
}

describe('systemAdmin.crm.consent', () => {
  it('exposes manageConsent permission', () => {
    expect(SYSTEM_ADMIN_PERMISSIONS.crm.manageConsent).toBe('systemAdmin.crm.manageConsent');
  });

  it('records source-traceable consent and never infers GRANTED', async () => {
    const prisma = makePrisma();
    const missingSource = await recordConsent(prisma, {
      admin: crmAgent,
      contactId: 'contact-1',
      purpose: CRM_CONSENT_PURPOSE.SALES_CONTACT,
      status: CRM_CONSENT_STATUS.GRANTED,
      source: '',
    });
    expect(missingSource.ok).toBe(false);
    expect(missingSource.error).toBe('source_required');

    const granted = await recordConsent(prisma, {
      admin: crmAgent,
      contactId: 'contact-1',
      purpose: CRM_CONSENT_PURPOSE.SALES_CONTACT,
      status: CRM_CONSENT_STATUS.GRANTED,
      source: 'web_form:request-demo',
      evidence: 'checkbox_checked',
    });
    expect(granted.ok).toBe(true);
    expect(granted.consent.status).toBe(CRM_CONSENT_STATUS.GRANTED);
    expect(granted.consent.source).toBe('web_form:request-demo');

    const unknown = await getConsentStatus(prisma, 'contact-missing', CRM_CONSENT_PURPOSE.MARKETING_EMAIL);
    expect(unknown.status).toBe(CRM_CONSENT_STATUS.UNKNOWN);
    expect(unknown.inferred).toBe(false);
  });

  it('blocks eligibility for UNKNOWN / DENIED / WITHDRAWN / DNC', async () => {
    const prisma = makePrisma();

    const unknown = await checkCommunicationEligibility(prisma, {
      contactId: 'contact-1',
      purpose: CRM_CONSENT_PURPOSE.SALES_CONTACT,
      channel: CRM_COMMUNICATION_CHANNEL.EMAIL,
    });
    expect(unknown.ok).toBe(true);
    expect(unknown.eligible).toBe(false);
    expect(unknown.inferred).toBe(false);
    expect(unknown.reasons.some((r) => r.includes('unknown'))).toBe(true);

    await recordConsent(prisma, {
      admin: crmAgent,
      contactId: 'contact-1',
      purpose: CRM_CONSENT_PURPOSE.SALES_CONTACT,
      status: CRM_CONSENT_STATUS.GRANTED,
      source: 'call_log',
    });

    const ok = await checkCommunicationEligibility(prisma, {
      contactId: 'contact-1',
      purpose: CRM_CONSENT_PURPOSE.SALES_CONTACT,
      channel: CRM_COMMUNICATION_CHANNEL.EMAIL,
    });
    expect(ok.eligible).toBe(true);

    await recordConsent(prisma, {
      admin: crmAgent,
      contactId: 'contact-1',
      purpose: CRM_CONSENT_PURPOSE.SALES_CONTACT,
      status: CRM_CONSENT_STATUS.WITHDRAWN,
      source: 'email_reply',
    });
    const withdrawn = await checkCommunicationEligibility(prisma, {
      contactId: 'contact-1',
      purpose: CRM_CONSENT_PURPOSE.SALES_CONTACT,
      channel: CRM_COMMUNICATION_CHANNEL.EMAIL,
    });
    expect(withdrawn.eligible).toBe(false);
    expect(withdrawn.reasons.some((r) => r.includes('withdrawn'))).toBe(true);

    await recordConsent(prisma, {
      admin: crmAgent,
      contactId: 'contact-2',
      purpose: CRM_CONSENT_PURPOSE.DEMO_COMMUNICATION,
      status: CRM_CONSENT_STATUS.GRANTED,
      source: 'demo_form',
    });
    await setDoNotContact(prisma, {
      admin: crmAgent,
      contactId: 'contact-2',
      flag: CRM_DNC_FLAG.DO_NOT_WHATSAPP,
      source: 'preference_center',
      reason: 'user request',
    });
    const dncChannel = await checkCommunicationEligibility(prisma, {
      contactId: 'contact-2',
      purpose: CRM_CONSENT_PURPOSE.DEMO_COMMUNICATION,
      channel: CRM_COMMUNICATION_CHANNEL.WHATSAPP,
    });
    expect(dncChannel.eligible).toBe(false);
    expect(dncChannel.dncFlags).toContain(CRM_DNC_FLAG.DO_NOT_WHATSAPP);

    await setDoNotContact(prisma, {
      admin: crmAgent,
      contactId: 'contact-2',
      flag: CRM_DNC_FLAG.DO_NOT_CONTACT_ALL,
      source: 'compliance',
    });
    const dncAll = await checkCommunicationEligibility(prisma, {
      contactId: 'contact-2',
      purpose: CRM_CONSENT_PURPOSE.DEMO_COMMUNICATION,
      channel: CRM_COMMUNICATION_CHANNEL.EMAIL,
    });
    expect(dncAll.eligible).toBe(false);
    expect(dncAll.reasons.some((r) => r.includes('do_not_contact_all'))).toBe(true);
  });

  it('DENIED consent blocks even without DNC', async () => {
    const prisma = makePrisma();
    await recordConsent(prisma, {
      admin: crmAgent,
      contactId: 'contact-3',
      purpose: CRM_CONSENT_PURPOSE.MARKETING_EMAIL,
      status: CRM_CONSENT_STATUS.DENIED,
      source: 'unsubscribe',
    });
    const result = await checkCommunicationEligibility(prisma, {
      contactId: 'contact-3',
      purpose: CRM_CONSENT_PURPOSE.MARKETING_EMAIL,
      channel: CRM_COMMUNICATION_CHANNEL.EMAIL,
    });
    expect(result.eligible).toBe(false);
    expect(result.consentStatus).toBe(CRM_CONSENT_STATUS.DENIED);
  });
});
