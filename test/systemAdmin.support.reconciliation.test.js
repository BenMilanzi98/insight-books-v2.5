/**
 * Phase 10 Wave 4 — Support reconciliation + export foundation.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  SUPPORT_RELIABILITY_STATUS,
  runSupportReconciliation,
  applySupportReconHonesty,
  buildSupportExportPack,
  resolveSupportAccess,
} from '@/lib/admin/support';

function makePrisma(overrides = {}) {
  const ticketStore = overrides._ticketStore || [
    {
      id: 'st-1',
      ticketNumber: 'SUP-2026-000001',
      tenantId: 'tenant-1',
      status: 'NEW',
      type: 'QUESTION',
      title: 'A',
      description: 'd',
      createdAt: new Date(),
      priority: 'P3',
      queueCode: 'GENERAL_SUPPORT',
      sourceChannel: 'ADMIN_MANUAL',
      assigneeAdminId: null,
    },
    {
      id: 'st-2',
      ticketNumber: 'SUP-2026-000002',
      tenantId: 'tenant-1',
      status: 'IN_PROGRESS',
      type: 'QUESTION',
      title: 'B',
      description: 'd',
      createdAt: new Date(),
      priority: 'P2',
      queueCode: null,
      sourceChannel: 'ADMIN_MANUAL',
      assigneeAdminId: null,
    },
  ];
  const historyStore = overrides._historyStore || [
    {
      id: 'h1',
      ticketId: 'st-2',
      toStatus: 'IN_PROGRESS',
      at: new Date(),
    },
  ];
  const messageStore = overrides._messageStore || [{ id: 'm1', ticketId: 'st-1' }];
  const clockStore = overrides._clockStore || [
    { id: 'c1', ticketId: 'st-1', clockType: 'FIRST_RESPONSE' },
  ];
  const reconRuns = overrides._reconRuns || [];
  const exportAudits = overrides._exportAudits || [];

  const failCount = overrides.failTicketCount === true;

  const prisma = {
    supportTicket: {
      count: vi.fn(async () => {
        if (failCount) throw new Error('db_down');
        return ticketStore.length;
      }),
      findMany: vi.fn(async ({ take, select } = {}) => {
        const rows = [...ticketStore].slice(0, take || 50);
        if (select) {
          return rows.map((r) => ({
            id: r.id,
            ticketNumber: r.ticketNumber,
            status: r.status,
          }));
        }
        return rows;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return ticketStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      findFirst: vi.fn(async () => null),
    },
    supportTicketStatusHistory: {
      count: vi.fn(async () => historyStore.length),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        const rows = historyStore
          .filter((h) => h.ticketId === where.ticketId)
          .sort((a, b) => b.at - a.at);
        return rows[0] || null;
      }),
    },
    supportMessage: {
      count: vi.fn(async () => messageStore.length),
    },
    supportSlaClock: {
      count: vi.fn(async () => clockStore.length),
    },
    supportReconciliationRun: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `rr-${reconRuns.length + 1}`, createdAt: new Date(), ...data };
        reconRuns.push(row);
        return row;
      }),
      findFirst: vi.fn(async () =>
        reconRuns.length ? reconRuns[reconRuns.length - 1] : null
      ),
    },
    supportExportAudit: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `ea-${exportAudits.length + 1}`, ...data };
        exportAudits.push(row);
        return row;
      }),
    },
  };

  if (overrides.omitMessages) delete prisma.supportMessage;
  if (overrides.omitSla) delete prisma.supportSlaClock;

  prisma._ticketStore = ticketStore;
  prisma._historyStore = historyStore;
  prisma._reconRuns = reconRuns;
  prisma._exportAudits = exportAudits;
  return prisma;
}

const reconAdmin = {
  id: 'admin-recon',
  role: 'Platform Support',
  permissions: {
    systemAdmin: {
      support: {
        viewTickets: true,
        runReconciliation: true,
        export: true,
      },
    },
  },
};

const viewOnly = {
  id: 'admin-view',
  role: 'Platform Support',
  permissions: {
    systemAdmin: {
      support: {
        viewTickets: true,
      },
    },
  },
};

describe('Support Wave 4 reconciliation', () => {
  it('runs AVAILABLE recon with honest counts (including zero mismatches)', async () => {
    const prisma = makePrisma();
    const result = await runSupportReconciliation(prisma, {
      admin: reconAdmin,
      persist: true,
    });
    expect(result.ok).toBe(true);
    expect(result.summary.ticketCount).toBe(2);
    expect(result.summary.messageCount).toBe(1);
    expect(result.summary.slaClockCount).toBe(1);
    expect(result.persisted).toBe(true);
    expect(result.meta.inventZeroesForbidden).toBe(true);
    // NEW ticket without history is OK; IN_PROGRESS matches latest history
    expect(result.status).toBe(SUPPORT_RELIABILITY_STATUS.AVAILABLE);
  });

  it('flags PARTIAL_HISTORY when status ≠ latest history', async () => {
    const prisma = makePrisma({
      _historyStore: [
        {
          id: 'h1',
          ticketId: 'st-2',
          toStatus: 'TRIAGE',
          at: new Date(),
        },
      ],
    });
    const result = await runSupportReconciliation(prisma, { admin: reconAdmin });
    expect(result.status).toBe(SUPPORT_RELIABILITY_STATUS.PARTIAL_HISTORY);
    expect(result.summary.mismatchedStatusSamples?.length).toBeGreaterThan(0);
  });

  it('never returns false zero ticketCount on count failure', async () => {
    const prisma = makePrisma({ failTicketCount: true });
    const result = await runSupportReconciliation(prisma, { admin: reconAdmin });
    expect(result.status).toBe(SUPPORT_RELIABILITY_STATUS.RECONCILIATION_FAILED);
    expect(result.summary.ticketCount).toBeNull();
    const honesty = applySupportReconHonesty({
      status: result.status,
      reconOk: false,
      ticketCount: 0,
    });
    expect(honesty.kpiSafe).toBe(false);
    expect(honesty.ticketCount).toBeNull();
  });

  it('requires runReconciliation permission', async () => {
    const prisma = makePrisma();
    const result = await runSupportReconciliation(prisma, { admin: viewOnly });
    expect(result.forbidden).toBe(true);
    expect(result.status).toBe(SUPPORT_RELIABILITY_STATUS.PERMISSION_RESTRICTED);
    expect(resolveSupportAccess(viewOnly).canRunReconciliation).toBe(false);
  });

  it('marks message plane NOT_INSTRUMENTED when model missing', async () => {
    const prisma = makePrisma({ omitMessages: true, omitSla: true });
    const result = await runSupportReconciliation(prisma, { admin: reconAdmin });
    expect(result.ok).toBe(true);
    const msgCard = result.cards.find((c) => c.id === 'messages.model');
    expect(msgCard.status).toBe(SUPPORT_RELIABILITY_STATUS.NOT_INSTRUMENTED);
    expect(result.summary.messageCount).toBeNull();
    // Overall must elevate — never report false AVAILABLE when planes are missing.
    expect(result.status).toBe(SUPPORT_RELIABILITY_STATUS.NOT_INSTRUMENTED);
  });
});

describe('Support Wave 4 export', () => {
  it('requires export permission and returns empty rows honestly', async () => {
    const denied = await buildSupportExportPack(makePrisma(), {
      admin: viewOnly,
      format: 'json',
    });
    expect(denied.forbidden).toBe(true);
    expect(denied.reasonCode).toBe('export_permission_required');

    const emptyPrisma = makePrisma({ _ticketStore: [] });
    // listTickets needs findMany returning items — wire list shape
    emptyPrisma.supportTicket.findMany = vi.fn(async () => []);
    emptyPrisma.supportTicket.count = vi.fn(async () => 0);

    const pack = await buildSupportExportPack(emptyPrisma, {
      admin: reconAdmin,
      format: 'json',
    });
    expect(pack.ok).toBe(true);
    expect(pack.rowCount).toBe(0);
    expect(pack.rows).toEqual([]);
    expect(pack.limitations.some((l) => /never invents/i.test(l))).toBe(true);
  });

  it('builds CSV with formula-injection safety', async () => {
    const prisma = makePrisma();
    prisma.supportTicket.findMany = vi.fn(async () => [
      {
        id: 'st-1',
        ticketNumber: 'SUP-2026-000001',
        tenantId: 'tenant-1',
        status: 'NEW',
        type: 'QUESTION',
        title: '=CMD()',
        description: 'd',
        priority: 'P3',
        queueCode: null,
        sourceChannel: 'ADMIN_MANUAL',
        assigneeAdminId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        impact: null,
        urgency: null,
        severity: null,
        resolutionCategory: null,
        portfolioId: null,
        createdByAdminId: null,
        resolvedAt: null,
        closedAt: null,
      },
    ]);

    const pack = await buildSupportExportPack(prisma, {
      admin: reconAdmin,
      format: 'csv',
    });
    expect(pack.ok).toBe(true);
    expect(pack.csv).toContain("'=CMD()");
    expect(prisma.supportExportAudit.create).toHaveBeenCalled();
  });
});
