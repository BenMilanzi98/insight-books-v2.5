/**
 * Phase 11 Wave 3 — Qualification (UNKNOWN ≠ NO; versioned definitions).
 */
import { describe, it, expect, vi } from 'vitest';
import {
  CRM_QUALIFICATION_RESPONSE,
  CRM_LEAD_STATUS,
  CRM_DEFAULT_QUALIFICATION_VERSION_ID,
  getDefaultQualificationDefinition,
  evaluateQualificationResponses,
  evaluateQualification,
  assertLeadQualificationForQualifiedStatus,
} from '@/lib/admin/crm';
import { SYSTEM_ADMIN_PERMISSIONS as PERMS } from '@/lib/admin/permissions';

const crmAgent = {
  id: 'admin-crm-q',
  role: 'Platform Support',
  permissions: {
    systemAdmin: {
      crm: {
        view: true,
        viewLeads: true,
        editLeads: true,
        qualifyLeads: true,
        transitionStatus: true,
      },
    },
  },
};

const overrideAdmin = {
  id: 'admin-override',
  role: 'Platform Support',
  permissions: {
    systemAdmin: {
      crm: {
        editLeads: true,
        qualifyLeads: true,
        overrideQualification: true,
      },
    },
  },
};

function makePrisma(overrides = {}) {
  const leadStore = overrides._leadStore || [
    {
      id: 'lead-1',
      leadNumber: 'LEAD-2026-000001',
      status: CRM_LEAD_STATUS.QUALIFICATION_IN_PROGRESS,
      type: 'NEW_BUSINESS',
      personOrOrganisation: 'PERSON',
      source: 'MANUAL',
      channel: 'ADMIN_MANUAL',
      title: 'Q lead',
      ownerAdminId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  const responseStore = overrides._responseStore || [];
  const historyStore = overrides._historyStore || [];

  return {
    _leadStore: leadStore,
    _responseStore: responseStore,
    _historyStore: historyStore,
    crmLead: {
      findUnique: vi.fn(async ({ where }) =>
        leadStore.find((r) => r.id === where.id || r.leadNumber === where.leadNumber) || null
      ),
      update: vi.fn(async ({ where, data }) => {
        const row = leadStore.find((r) => r.id === where.id);
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      }),
      findMany: vi.fn(async () => leadStore),
    },
    crmQualificationResponse: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `qr-${responseStore.length + 1}`, ...data };
        responseStore.push(row);
        return row;
      }),
      upsert: vi.fn(async ({ where, create, update }) => {
        const key = where.leadId_definitionVersionId_criterionKey;
        let row = responseStore.find(
          (r) =>
            r.leadId === key.leadId &&
            r.definitionVersionId === key.definitionVersionId &&
            r.criterionKey === key.criterionKey
        );
        if (row) {
          Object.assign(row, update);
          return row;
        }
        row = { id: `qr-${responseStore.length + 1}`, ...create };
        responseStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        return responseStore.filter(
          (r) =>
            (!where.leadId || r.leadId === where.leadId) &&
            (!where.definitionVersionId || r.definitionVersionId === where.definitionVersionId)
        );
      }),
    },
    crmLeadStatusHistory: {
      create: vi.fn(async ({ data }) => {
        historyStore.push(data);
        return { id: `h-${historyStore.length}`, ...data };
      }),
    },
  };
}

describe('systemAdmin.crm.qualification', () => {
  it('exposes qualify / override permissions', () => {
    expect(PERMS.crm.qualifyLeads).toBe('systemAdmin.crm.qualifyLeads');
    expect(PERMS.crm.overrideQualification).toBe('systemAdmin.crm.overrideQualification');
  });

  it('ships ACTIVE SMALL_BUSINESS_STANDARD definition with required criteria', () => {
    const def = getDefaultQualificationDefinition();
    expect(def.versionId).toBe(CRM_DEFAULT_QUALIFICATION_VERSION_ID);
    expect(def.key).toBe('SMALL_BUSINESS_STANDARD');
    expect(def.status).toBe('ACTIVE');
    expect(def.criteria.some((c) => c.key === 'BUDGET' && c.required)).toBe(true);
  });

  it('treats UNKNOWN as distinct from NO (UNKNOWN blocks required; NO only when blockingNo)', () => {
    const def = getDefaultQualificationDefinition();
    const unknown = evaluateQualificationResponses(def, [
      { criterionKey: 'BUDGET', state: CRM_QUALIFICATION_RESPONSE.UNKNOWN },
      { criterionKey: 'AUTHORITY', state: CRM_QUALIFICATION_RESPONSE.YES },
      { criterionKey: 'NEED', state: CRM_QUALIFICATION_RESPONSE.YES },
      { criterionKey: 'TIMELINE', state: CRM_QUALIFICATION_RESPONSE.YES },
    ]);
    expect(unknown.qualified).toBe(false);
    expect(unknown.summary.unknownIsNotNo).toBe(true);
    expect(unknown.blockers.some((b) => b.reason === 'required_unknown')).toBe(true);

    const blockingNo = evaluateQualificationResponses(def, [
      { criterionKey: 'BUDGET', state: CRM_QUALIFICATION_RESPONSE.NO },
      { criterionKey: 'AUTHORITY', state: CRM_QUALIFICATION_RESPONSE.YES },
      { criterionKey: 'NEED', state: CRM_QUALIFICATION_RESPONSE.YES },
      { criterionKey: 'TIMELINE', state: CRM_QUALIFICATION_RESPONSE.YES },
    ]);
    expect(blockingNo.qualified).toBe(false);
    expect(blockingNo.blockers.some((b) => b.reason === 'blocking_no')).toBe(true);

    const allYes = evaluateQualificationResponses(def, [
      { criterionKey: 'BUDGET', state: CRM_QUALIFICATION_RESPONSE.YES },
      { criterionKey: 'AUTHORITY', state: CRM_QUALIFICATION_RESPONSE.YES },
      { criterionKey: 'NEED', state: CRM_QUALIFICATION_RESPONSE.YES },
      { criterionKey: 'TIMELINE', state: CRM_QUALIFICATION_RESPONSE.YES },
    ]);
    expect(allYes.qualified).toBe(true);
  });

  it('cannot mark QUALIFIED while required UNKNOWN; override needs permission + reason', async () => {
    const prisma = makePrisma();
    const blocked = await evaluateQualification(prisma, {
      admin: crmAgent,
      leadId: 'lead-1',
      responses: [
        { criterionKey: 'BUDGET', state: 'UNKNOWN' },
        { criterionKey: 'AUTHORITY', state: 'YES' },
        { criterionKey: 'NEED', state: 'YES' },
        { criterionKey: 'TIMELINE', state: 'YES' },
      ],
    });
    expect(blocked.ok).toBe(true);
    expect(blocked.qualified).toBe(false);
    expect(blocked.blocked).toBe(true);
    expect(prisma._leadStore[0].status).toBe(CRM_LEAD_STATUS.QUALIFICATION_IN_PROGRESS);

    const noReason = await evaluateQualification(prisma, {
      admin: overrideAdmin,
      leadId: 'lead-1',
      override: true,
      responses: [
        { criterionKey: 'BUDGET', state: 'UNKNOWN' },
        { criterionKey: 'AUTHORITY', state: 'YES' },
        { criterionKey: 'NEED', state: 'YES' },
        { criterionKey: 'TIMELINE', state: 'YES' },
      ],
    });
    expect(noReason.ok).toBe(false);
    expect(noReason.error).toBe('overrideReason_required');

    const overridden = await evaluateQualification(prisma, {
      admin: overrideAdmin,
      leadId: 'lead-1',
      override: true,
      overrideReason: 'Executive sponsor confirmed offline',
      responses: [
        { criterionKey: 'BUDGET', state: 'UNKNOWN' },
        { criterionKey: 'AUTHORITY', state: 'YES' },
        { criterionKey: 'NEED', state: 'YES' },
        { criterionKey: 'TIMELINE', state: 'YES' },
      ],
    });
    expect(overridden.ok).toBe(true);
    expect(overridden.overrideApplied).toBe(true);
    expect(overridden.statusApplied).toBe(true);
    expect(overridden.lead.status).toBe(CRM_LEAD_STATUS.QUALIFIED);
  });

  it('qualifies when all required criteria YES and pins definition version', async () => {
    const prisma = makePrisma();
    const result = await evaluateQualification(prisma, {
      admin: crmAgent,
      leadId: 'lead-1',
      responses: [
        { criterionKey: 'BUDGET', state: 'YES' },
        { criterionKey: 'AUTHORITY', state: 'YES' },
        { criterionKey: 'NEED', state: 'YES' },
        { criterionKey: 'TIMELINE', state: 'PARTIAL' },
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.qualified).toBe(true);
    expect(result.definitionVersionId).toBe(CRM_DEFAULT_QUALIFICATION_VERSION_ID);
    expect(result.lead.status).toBe(CRM_LEAD_STATUS.QUALIFIED);
    expect(prisma._responseStore.length).toBeGreaterThanOrEqual(4);
  });

  it('assertLeadQualificationForQualifiedStatus blocks empty responses when model present', async () => {
    const prisma = makePrisma();
    const gate = await assertLeadQualificationForQualifiedStatus(prisma, {
      leadId: 'lead-1',
      admin: crmAgent,
    });
    expect(gate.ok).toBe(false);
    expect(gate.error).toBe('QUALIFICATION_INCOMPLETE');
  });

  it('fail-closes QUALIFIED when response model missing or load fails', async () => {
    const missingModel = makePrisma();
    delete missingModel.crmQualificationResponse;
    const unavailable = await assertLeadQualificationForQualifiedStatus(missingModel, {
      leadId: 'lead-1',
      admin: crmAgent,
    });
    expect(unavailable.ok).toBe(false);
    expect(unavailable.error).toBe('QUALIFICATION_UNAVAILABLE');
    expect(unavailable.skipped).toBeUndefined();

    const loadFail = makePrisma();
    loadFail.crmQualificationResponse.findMany = vi.fn(async () => {
      throw new Error('EPERM');
    });
    const loadBlocked = await assertLeadQualificationForQualifiedStatus(loadFail, {
      leadId: 'lead-1',
      admin: crmAgent,
    });
    expect(loadBlocked.ok).toBe(false);
    expect(loadBlocked.error).toBe('QUALIFICATION_UNAVAILABLE');
    expect(loadBlocked.reason).toBe('qualification_responses_load_failed');
  });

  it('does not persist qualification responses when lead is missing', async () => {
    const prisma = makePrisma();
    const result = await evaluateQualification(prisma, {
      admin: crmAgent,
      leadId: 'lead-does-not-exist',
      responses: [
        { criterionKey: 'BUDGET', state: 'YES' },
        { criterionKey: 'AUTHORITY', state: 'YES' },
        { criterionKey: 'NEED', state: 'YES' },
        { criterionKey: 'TIMELINE', state: 'YES' },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.notFound).toBe(true);
    expect(result.error).toBe('lead_not_found');
    expect(prisma._responseStore).toHaveLength(0);
    expect(prisma.crmQualificationResponse.upsert).not.toHaveBeenCalled();
    expect(prisma.crmQualificationResponse.create).not.toHaveBeenCalled();
  });
});
