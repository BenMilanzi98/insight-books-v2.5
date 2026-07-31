/**
 * Phase 11 Wave 3 — Assignment / teams / territories (no silent reassign loops).
 */
import { describe, it, expect, vi } from 'vitest';
import {
  CRM_ASSIGNMENT_STRATEGY,
  CRM_ASSIGNMENT_ACTION,
  CRM_LEAD_STATUS,
  listSalesTeams,
  listTerritories,
  evaluateTerritory,
  assignLead,
  acceptLeadAssignment,
  returnLeadToQueue,
} from '@/lib/admin/crm';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';

const crmAgent = {
  id: 'admin-assigner',
  role: 'Platform Support',
  permissions: {
    systemAdmin: {
      crm: {
        view: true,
        viewLeads: true,
        editLeads: true,
        assignLeads: true,
      },
    },
  },
};

function makePrisma(overrides = {}) {
  const leadStore = overrides._leadStore || [
    {
      id: 'lead-a1',
      leadNumber: 'LEAD-2026-000020',
      status: CRM_LEAD_STATUS.NEW,
      type: 'NEW_BUSINESS',
      personOrOrganisation: 'PERSON',
      source: 'MANUAL',
      channel: 'ADMIN_MANUAL',
      title: 'Assign me',
      ownerAdminId: null,
      teamId: null,
      territoryId: null,
      assignedAt: null,
      acceptedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  const historyStore = overrides._historyStore || [];
  const statusHistory = overrides._statusHistory || [];
  const teamStore = overrides._teamStore || [];
  const memberStore = overrides._memberStore || [];

  return {
    _leadStore: leadStore,
    _historyStore: historyStore,
    crmLead: {
      findUnique: vi.fn(async ({ where }) =>
        leadStore.find((r) => r.id === where.id) || null
      ),
      update: vi.fn(async ({ where, data }) => {
        const row = leadStore.find((r) => r.id === where.id);
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      }),
      findMany: vi.fn(async () => leadStore),
    },
    crmAssignmentHistory: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `ah-${historyStore.length + 1}`, ...data };
        historyStore.push(row);
        return row;
      }),
      count: vi.fn(async ({ where = {} } = {}) => {
        return historyStore.filter((r) => {
          if (where.toOwnerAdminId && r.toOwnerAdminId !== where.toOwnerAdminId) return false;
          if (where.toTeamId && r.toTeamId !== where.toTeamId) return false;
          if (where.action?.in && !where.action.in.includes(r.action)) return false;
          return true;
        }).length;
      }),
    },
    crmLeadStatusHistory: {
      create: vi.fn(async ({ data }) => {
        statusHistory.push(data);
        return data;
      }),
    },
    crmSalesTeam: {
      findMany: vi.fn(async () => teamStore),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        const or = where.OR || [];
        return (
          teamStore.find((t) =>
            or.some((c) => (c.id && t.id === c.id) || (c.code && t.code === c.code))
          ) || null
        );
      }),
    },
    crmSalesTeamMember: {
      findMany: vi.fn(async ({ where = {} } = {}) =>
        memberStore.filter(
          (m) =>
            (!where.teamId || m.teamId === where.teamId) &&
            (where.active == null || m.active === where.active)
        )
      ),
    },
  };
}

describe('systemAdmin.crm.assignment', () => {
  it('exposes assignLeads permission and lists team/territory stubs', async () => {
    expect(SYSTEM_ADMIN_PERMISSIONS.crm.assignLeads).toBe('systemAdmin.crm.assignLeads');
    const teams = await listSalesTeams({}, { admin: crmAgent });
    expect(teams.ok).toBe(true);
    expect(teams.items.length).toBeGreaterThan(0);
    const territories = await listTerritories({}, { admin: crmAgent });
    expect(territories.ok).toBe(true);
    expect(territories.items.some((t) => t.code === 'MW_CENTRAL')).toBe(true);
  });

  it('MANUAL assign writes history; same owner+team is noop', async () => {
    const prisma = makePrisma();
    const first = await assignLead(prisma, {
      admin: crmAgent,
      leadId: 'lead-a1',
      strategy: CRM_ASSIGNMENT_STRATEGY.MANUAL,
      ownerAdminId: 'owner-1',
      teamId: 'team-1',
      reason: 'initial',
    });
    expect(first.ok).toBe(true);
    expect(first.noop).toBe(false);
    expect(first.lead.ownerAdminId).toBe('owner-1');
    expect(first.lead.assignedAt).toBeTruthy();
    expect(prisma._historyStore).toHaveLength(1);
    expect(prisma._historyStore[0].action).toBe(CRM_ASSIGNMENT_ACTION.ASSIGN);

    const noop = await assignLead(prisma, {
      admin: crmAgent,
      leadId: 'lead-a1',
      strategy: CRM_ASSIGNMENT_STRATEGY.MANUAL,
      ownerAdminId: 'owner-1',
      teamId: 'team-1',
    });
    expect(noop.ok).toBe(true);
    expect(noop.noop).toBe(true);
    expect(prisma._historyStore).toHaveLength(1);
  });

  it('ROUND_ROBIN picks least-assigned member deterministically', async () => {
    const prisma = makePrisma({
      _teamStore: [{ id: 'team-rr', code: 'SALES_CORE', name: 'Core', active: true }],
      _memberStore: [
        { id: 'm1', teamId: 'team-rr', adminId: 'rep-a', active: true },
        { id: 'm2', teamId: 'team-rr', adminId: 'rep-b', active: true },
      ],
      _historyStore: [
        {
          toOwnerAdminId: 'rep-a',
          toTeamId: 'team-rr',
          action: CRM_ASSIGNMENT_ACTION.ASSIGN,
        },
      ],
    });
    const result = await assignLead(prisma, {
      admin: crmAgent,
      leadId: 'lead-a1',
      strategy: CRM_ASSIGNMENT_STRATEGY.ROUND_ROBIN,
      teamId: 'team-rr',
    });
    expect(result.ok).toBe(true);
    expect(result.lead.ownerAdminId).toBe('rep-b');
    expect(result.assignmentHistory.strategy).toBe(CRM_ASSIGNMENT_STRATEGY.ROUND_ROBIN);
  });

  it('TERRITORY_BASED fails visibly on ambiguous match', async () => {
    const amb = await evaluateTerritory({}, { country: 'MW' });
    expect(amb.ok).toBe(false);
    expect(amb.error).toBe('TERRITORY_AMBIGUOUS');

    const ok = await evaluateTerritory({}, { country: 'MW', region: 'CENTRAL' });
    expect(ok.ok).toBe(true);
    expect(ok.territory.code).toBe('MW_CENTRAL');
  });

  it('accept sets acceptedAt; reject/return-to-queue clears owner with history', async () => {
    const prisma = makePrisma();
    await assignLead(prisma, {
      admin: crmAgent,
      leadId: 'lead-a1',
      strategy: CRM_ASSIGNMENT_STRATEGY.MANUAL,
      ownerAdminId: 'owner-1',
      teamId: 'team-1',
    });

    const accepted = await acceptLeadAssignment(prisma, {
      admin: crmAgent,
      leadId: 'lead-a1',
    });
    expect(accepted.ok).toBe(true);
    expect(accepted.lead.acceptedAt).toBeTruthy();
    expect(accepted.assignmentHistory.action).toBe(CRM_ASSIGNMENT_ACTION.ACCEPT);

    const returned = await returnLeadToQueue(prisma, {
      admin: crmAgent,
      leadId: 'lead-a1',
      action: CRM_ASSIGNMENT_ACTION.RETURN_TO_QUEUE,
      reason: 'capacity',
    });
    expect(returned.ok).toBe(true);
    expect(returned.lead.ownerAdminId).toBeNull();
    expect(returned.assignmentHistory.action).toBe(CRM_ASSIGNMENT_ACTION.RETURN_TO_QUEUE);
    expect(prisma._historyStore.length).toBeGreaterThanOrEqual(3);
  });

  it('reassign writes REASSIGN history (no silent loop)', async () => {
    const prisma = makePrisma();
    await assignLead(prisma, {
      admin: crmAgent,
      leadId: 'lead-a1',
      ownerAdminId: 'owner-1',
      teamId: 'team-1',
    });
    const re = await assignLead(prisma, {
      admin: crmAgent,
      leadId: 'lead-a1',
      ownerAdminId: 'owner-2',
      teamId: 'team-1',
      reason: 'coverage',
    });
    expect(re.ok).toBe(true);
    expect(re.noop).toBe(false);
    expect(re.assignmentHistory.action).toBe(CRM_ASSIGNMENT_ACTION.REASSIGN);
    expect(re.assignmentHistory.fromOwnerAdminId).toBe('owner-1');
    expect(re.assignmentHistory.toOwnerAdminId).toBe('owner-2');
  });
});
