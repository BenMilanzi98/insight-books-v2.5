/**
 * Phase 11 Wave 3 — Deterministic scoring (≠ probability / Revenue).
 */
import { describe, it, expect, vi } from 'vitest';
import {
  CRM_SCORE_CONFIDENCE,
  CRM_SCORE_BAND,
  CRM_DEFAULT_SCORE_VERSION_ID,
  CRM_SCORE_FORBIDDEN_LABELS,
  getDefaultScoreDefinition,
  computeScore,
  assertScoreLabelSafe,
  runLeadScore,
  getLatestLeadScore,
  resolveCrmAccess,
} from '@/lib/admin/crm';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';

const crmAgent = {
  id: 'admin-crm-score',
  role: 'Platform Support',
  permissions: {
    systemAdmin: {
      crm: { viewLeads: true, editLeads: true, scoreLeads: true },
    },
  },
};

const viewOnlyAgent = {
  id: 'admin-crm-view-only',
  role: 'Platform Support',
  permissions: {
    systemAdmin: {
      crm: { viewLeads: true },
    },
  },
};

function makePrisma(overrides = {}) {
  const leadStore = overrides._leadStore || [
    {
      id: 'lead-s1',
      leadNumber: 'LEAD-2026-000010',
      status: 'ENGAGED',
      type: 'NEW_BUSINESS',
      personOrOrganisation: 'PERSON',
      source: 'MANUAL',
      channel: 'ADMIN_MANUAL',
      title: 'Score lead',
      contactId: 'contact-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  const evalStore = overrides._evalStore || [];
  const contribStore = overrides._contribStore || [];
  const dncStore = overrides._dncStore || [];

  return {
    _evalStore: evalStore,
    _contribStore: contribStore,
    crmLead: {
      findUnique: vi.fn(async ({ where }) =>
        leadStore.find((r) => r.id === where.id) || null
      ),
      findMany: vi.fn(async () => leadStore),
    },
    crmScoreEvaluation: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `se-${evalStore.length + 1}`, ...data };
        evalStore.push(row);
        return row;
      }),
      findMany: vi.fn(async () => evalStore),
      findFirst: vi.fn(async ({ where = {}, orderBy } = {}) => {
        let rows = evalStore.filter((r) => !where.leadId || r.leadId === where.leadId);
        if (orderBy?.createdAt === 'desc') {
          rows = [...rows].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
        return rows[0] || null;
      }),
    },
    crmScoreContribution: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `sc-${contribStore.length + 1}`, ...data };
        contribStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        return contribStore.filter(
          (r) => !where.evaluationId || r.evaluationId === where.evaluationId
        );
      }),
    },
    crmDoNotContact: {
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

describe('systemAdmin.crm.scoring', () => {
  it('exposes scoreLeads permission and forbids probability labels', () => {
    expect(SYSTEM_ADMIN_PERMISSIONS.crm.scoreLeads).toBe('systemAdmin.crm.scoreLeads');
    expect(CRM_SCORE_FORBIDDEN_LABELS.some((l) => l.includes('probability'))).toBe(true);
    expect(assertScoreLabelSafe('win probability').ok).toBe(false);
    expect(assertScoreLabelSafe('Lead fit score').ok).toBe(true);
  });

  it('computes deterministic 0–100 score with contributions + confidence', () => {
    const def = getDefaultScoreDefinition();
    expect(def.versionId).toBe(CRM_DEFAULT_SCORE_VERSION_ID);

    const a = computeScore(def, {
      dimensionScores: { ENGAGEMENT: 30, FIT: 30, AUTHORITY: 20, TIMELINE: 20 },
    });
    const b = computeScore(def, {
      dimensionScores: { ENGAGEMENT: 30, FIT: 30, AUTHORITY: 20, TIMELINE: 20 },
    });
    expect(a.score).toBe(100);
    expect(a.score).toBe(b.score);
    expect(a.band).toBe(CRM_SCORE_BAND.HOT);
    expect(a.confidence).toBe(CRM_SCORE_CONFIDENCE.HIGH);
    expect(a.contributions).toHaveLength(4);
    expect(a.isProbability).toBe(false);
    expect(a.isExpectedRevenue).toBe(false);
    expect(a.displayLabel).not.toMatch(/probability/i);

    const missing = computeScore(def, {
      dimensionScores: { ENGAGEMENT: 30 },
    });
    expect(missing.missingCount).toBe(3);
    expect(missing.confidence).toBe(CRM_SCORE_CONFIDENCE.INSUFFICIENT);
    expect(missing.contributions.filter((c) => c.missing).length).toBe(3);
    // missing does not invent values
    expect(missing.contributions.find((c) => c.dimensionKey === 'FIT').rawValue).toBeNull();
  });

  it('applies critical caps (DNC / SPAM) over positive engagement', () => {
    const def = getDefaultScoreDefinition();
    const capped = computeScore(def, {
      dimensionScores: { ENGAGEMENT: 30, FIT: 30, AUTHORITY: 20, TIMELINE: 20 },
      flags: ['DO_NOT_CONTACT'],
    });
    expect(capped.score).toBe(0);
    expect(capped.capped).toBe(true);
    expect(capped.band).toBe(CRM_SCORE_BAND.BLOCKED);
    expect(capped.capKey).toBe('DO_NOT_CONTACT');
  });

  it('persists immutable evaluation history pinned to definition version', async () => {
    const prisma = makePrisma();
    const r1 = await runLeadScore(prisma, {
      admin: crmAgent,
      leadId: 'lead-s1',
      dimensionScores: { ENGAGEMENT: 20, FIT: 15, AUTHORITY: 10, TIMELINE: 5 },
    });
    expect(r1.ok).toBe(true);
    expect(r1.evaluation.score).toBe(50);
    expect(r1.evaluation.band).toBe(CRM_SCORE_BAND.WARM);
    expect(r1.definitionVersionId).toBe(CRM_DEFAULT_SCORE_VERSION_ID);
    expect(r1.immutable).toBe(true);
    expect(r1.evaluation.isProbability).toBe(false);
    expect(prisma._evalStore).toHaveLength(1);
    expect(prisma._contribStore.length).toBeGreaterThanOrEqual(4);

    const r2 = await runLeadScore(prisma, {
      admin: crmAgent,
      leadId: 'lead-s1',
      dimensionScores: { ENGAGEMENT: 5, FIT: 5, AUTHORITY: 5, TIMELINE: 5 },
    });
    expect(r2.ok).toBe(true);
    // history immutable — prior evaluation retained
    expect(prisma._evalStore).toHaveLength(2);
    expect(prisma._evalStore[0].score).toBe(50);
    expect(prisma._evalStore[1].score).toBe(20);
  });

  it('auto-caps when contact has DO_NOT_CONTACT_ALL', async () => {
    const prisma = makePrisma({
      _dncStore: [
        {
          id: 'dnc-1',
          contactId: 'contact-1',
          flag: 'DO_NOT_CONTACT_ALL',
          active: true,
          source: 'test',
        },
      ],
    });
    const result = await runLeadScore(prisma, {
      admin: crmAgent,
      leadId: 'lead-s1',
      dimensionScores: { ENGAGEMENT: 30, FIT: 30, AUTHORITY: 20, TIMELINE: 20 },
    });
    expect(result.ok).toBe(true);
    expect(result.evaluation.capped).toBe(true);
    expect(result.evaluation.score).toBe(0);
  });

  it('rejects forbidden score labels on run', async () => {
    const prisma = makePrisma();
    const result = await runLeadScore(prisma, {
      admin: crmAgent,
      leadId: 'lead-s1',
      label: 'expected revenue',
      dimensionScores: { ENGAGEMENT: 10 },
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('forbidden_score_label');
  });

  it('forbids running/persisting scores with viewLeads alone', async () => {
    expect(resolveCrmAccess(viewOnlyAgent).canScoreLeads).toBe(false);
    expect(resolveCrmAccess(crmAgent).canScoreLeads).toBe(true);

    const prisma = makePrisma();
    const result = await runLeadScore(prisma, {
      admin: viewOnlyAgent,
      leadId: 'lead-s1',
      dimensionScores: { ENGAGEMENT: 20, FIT: 15, AUTHORITY: 10, TIMELINE: 5 },
    });
    expect(result.ok).toBe(false);
    expect(result.forbidden).toBe(true);
    expect(result.reason).toBe('crm_score_forbidden');
    expect(prisma._evalStore).toHaveLength(0);
    expect(prisma.crmScoreEvaluation.create).not.toHaveBeenCalled();
  });

  it('getLatestLeadScore returns dimensions + confidence or insufficient', async () => {
    const empty = await getLatestLeadScore(makePrisma(), {
      admin: viewOnlyAgent,
      leadId: 'lead-s1',
    });
    expect(empty.ok).toBe(true);
    expect(empty.evaluation).toBeNull();
    expect(empty.status).toBe('INSUFFICIENT');
    expect(empty.confidence).toBe(CRM_SCORE_CONFIDENCE.INSUFFICIENT);
    expect(empty.isProbability).toBe(false);

    const prisma = makePrisma();
    await runLeadScore(prisma, {
      admin: crmAgent,
      leadId: 'lead-s1',
      dimensionScores: { ENGAGEMENT: 20, FIT: 15, AUTHORITY: 10, TIMELINE: 5 },
    });
    const latest = await getLatestLeadScore(prisma, {
      admin: viewOnlyAgent,
      leadId: 'lead-s1',
    });
    expect(latest.ok).toBe(true);
    expect(latest.status).toBe('OK');
    expect(latest.evaluation.confidence).toBeTruthy();
    expect(latest.evaluation.contributions.length).toBeGreaterThanOrEqual(4);
    expect(latest.evaluation.isProbability).toBe(false);
    expect(latest.evaluation.displayLabel).not.toMatch(/probability/i);
  });
});
