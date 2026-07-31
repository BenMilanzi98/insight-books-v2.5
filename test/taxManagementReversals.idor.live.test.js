/**
 * Live dual-tenant IDOR suite for Tax Management + Transaction Reversals.
 *
 * Seeds ephemeral tenants against DATABASE_URL, asserts cross-tenant
 * reads/mutations fail closed (NOT_FOUND / empty lists), and exercises
 * key HTTP route handlers with mocked session tenants.
 */

import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { createDualTenantFixture, dbReadyForIdor } from './helpers/dualTenantIdorHarness.js';
import {
  createTaxPeriod,
  listTaxPeriods,
  closeTaxPeriod,
} from '../lib/taxManagement/taxPeriodService.js';
import { createTaxReturnDraft, listTaxReturns } from '../lib/taxManagement/taxReturnService.js';
import {
  createTaxRefundDraft,
  listTaxRefunds,
  markTaxRefundPosted,
} from '../lib/taxManagement/taxOpsRegisters.js';
import { markTaxPaymentReversed } from '../lib/taxManagement/taxPaymentRegister.js';
import {
  listTaxAccountMappings,
  upsertTaxAccountMapping,
} from '../lib/taxManagement/taxAccountMappingService.js';
import {
  approveTransactionReversal,
  rejectTransactionReversal,
  listPendingReversalApprovals,
  findRegisterRow,
} from '../lib/reversals/index.js';

const live = dbReadyForIdor();

vi.mock('@/lib/auth', () => ({
  getUserFromSession: vi.fn(),
  requireAnyPermission: vi.fn(async () => null),
}));

const { getUserFromSession } = await import('@/lib/auth');

describe.skipIf(!live)('live dual-tenant IDOR — tax management + reversals', () => {
  /** @type {Awaited<ReturnType<typeof createDualTenantFixture>>} */
  let fx;
  let periodB;
  let refundB;
  let returnB;
  let mappingB;
  let reversalB;
  let paymentB;

  beforeAll(async () => {
    fx = await createDualTenantFixture();
    const { prisma, tenantA, tenantB, accountB, userB } = fx;

    periodB = await createTaxPeriod({
      tenantId: tenantB.id,
      code: '2099-01',
      label: 'January 2099',
      startDate: '2099-01-01',
      endDate: '2099-01-31',
      db: prisma,
    });
    await createTaxPeriod({
      tenantId: tenantA.id,
      code: '2099-01',
      label: 'January 2099',
      startDate: '2099-01-01',
      endDate: '2099-01-31',
      db: prisma,
    });

    returnB = await createTaxReturnDraft({
      tenantId: tenantB.id,
      userId: userB.id,
      taxPeriodId: periodB.id,
      returnType: 'VAT',
      db: prisma,
    });

    refundB = await createTaxRefundDraft({
      tenantId: tenantB.id,
      userId: userB.id,
      amount: 100,
      taxPeriodId: periodB.id,
      reason: 'IDOR fixture refund',
      db: prisma,
    });

    mappingB = await upsertTaxAccountMapping({
      tenantId: tenantB.id,
      userId: userB.id,
      purpose: 'TAX_PAYABLE',
      accountId: accountB.id,
      db: prisma,
    });

    if (prisma.taxPayment?.create) {
      paymentB = await prisma.taxPayment.create({
        data: {
          tenantId: tenantB.id,
          taxPeriodId: periodB.id,
          status: 'POSTED',
          amount: 50,
          paymentDate: new Date('2099-01-15'),
          createdById: userB.id,
        },
      });
    }

    if (prisma.transactionReversal?.create) {
      reversalB = await prisma.transactionReversal.create({
        data: {
          tenantId: tenantB.id,
          sourceType: 'Invoice',
          sourceId: `idor-inv-${Date.now()}`,
          status: 'REQUESTED',
          reason: 'Cross-tenant IDOR fixture reason long enough',
          requestedById: userB.id,
        },
      });
    }

    if (prisma.taxTransaction?.create) {
      await prisma.taxTransaction.create({
        data: {
          tenantId: tenantB.id,
          journalEntryId: `idor-je-${Date.now()}`,
          journalLineId: `idor-jl-${Date.now()}`,
          purpose: 'TAX_PAYABLE',
          direction: 'CREDIT',
          amountSigned: -25,
          postingDate: new Date('2099-01-10'),
          sourceModule: 'test',
          sourceType: 'Invoice',
          sourceId: 'idor-src',
        },
      });
    }
  }, 60000);

  afterAll(async () => {
    if (fx) await fx.cleanup();
  });

  it('listTaxPeriods does not leak tenant B periods to tenant A', async () => {
    const periods = await listTaxPeriods({ tenantId: fx.tenantA.id, db: fx.prisma });
    expect(periods.some((p) => p.id === periodB.id)).toBe(false);
    expect(periods.every((p) => p.tenantId === fx.tenantA.id)).toBe(true);
  });

  it('closeTaxPeriod rejects foreign period id (NOT_FOUND)', async () => {
    await expect(
      closeTaxPeriod({
        tenantId: fx.tenantA.id,
        periodId: periodB.id,
        userId: fx.userA.id,
        db: fx.prisma,
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('createTaxReturnDraft rejects foreign taxPeriodId', async () => {
    await expect(
      createTaxReturnDraft({
        tenantId: fx.tenantA.id,
        userId: fx.userA.id,
        taxPeriodId: periodB.id,
        db: fx.prisma,
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('listTaxReturns does not leak tenant B returns', async () => {
    const rows = await listTaxReturns({ tenantId: fx.tenantA.id, db: fx.prisma });
    expect(rows.some((r) => r.id === returnB.id)).toBe(false);
  });

  it('markTaxRefundPosted rejects foreign refund id', async () => {
    await expect(
      markTaxRefundPosted({
        tenantId: fx.tenantA.id,
        userId: fx.userA.id,
        refundId: refundB.id,
        db: fx.prisma,
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('listTaxRefunds does not leak tenant B refunds', async () => {
    const rows = await listTaxRefunds({ tenantId: fx.tenantA.id, db: fx.prisma });
    expect(rows.some((r) => r.id === refundB.id)).toBe(false);
  });

  it('listTaxAccountMappings does not leak tenant B mappings', async () => {
    const rows = await listTaxAccountMappings({
      tenantId: fx.tenantA.id,
      db: fx.prisma,
    });
    expect(rows.some((m) => m.id === mappingB.id)).toBe(false);
  });

  it('markTaxPaymentReversed rejects foreign payment id when present', async () => {
    if (!paymentB) return;
    await expect(
      markTaxPaymentReversed({
        tenantId: fx.tenantA.id,
        taxPaymentId: paymentB.id,
        userId: fx.userA.id,
        db: fx.prisma,
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('approve/reject TransactionReversal reject foreign reversalId', async () => {
    if (!reversalB) return;
    await expect(
      approveTransactionReversal({
        tenantId: fx.tenantA.id,
        userId: fx.userA.id,
        reversalId: reversalB.id,
        db: fx.prisma,
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    await expect(
      rejectTransactionReversal({
        tenantId: fx.tenantA.id,
        userId: fx.userA.id,
        reversalId: reversalB.id,
        db: fx.prisma,
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('listPendingReversalApprovals and findRegisterRow stay tenant-scoped', async () => {
    if (!reversalB) return;
    const pending = await listPendingReversalApprovals({
      tenantId: fx.tenantA.id,
      db: fx.prisma,
    });
    expect(pending.some((r) => r.id === reversalB.id)).toBe(false);

    const register = await findRegisterRow({
      tenantId: fx.tenantA.id,
      sourceType: reversalB.sourceType,
      sourceId: reversalB.sourceId,
      db: fx.prisma,
    });
    expect(register).toBeNull();
  });

  it('HTTP close period route returns 404 for foreign period id', async () => {
    getUserFromSession.mockResolvedValue(fx.userA);
    const { POST } = await import('../app/api/tax-management/periods/[id]/[action]/route.js');
    const request = new Request('http://localhost/api/tax-management/periods/x/close', {
      method: 'POST',
    });
    const res = await POST(request, {
      params: Promise.resolve({ id: periodB.id, action: 'close' }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe('NOT_FOUND');
  });

  it('HTTP reverse approve returns 404 for foreign reversalId', async () => {
    if (!reversalB) return;
    getUserFromSession.mockResolvedValue(fx.userA);
    const { POST } = await import('../app/api/transactions/reverse/route.js');
    const request = new Request('http://localhost/api/transactions/reverse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', reversalId: reversalB.id }),
    });
    const res = await POST(request);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe('NOT_FOUND');
  });

  it('HTTP mappings GET only returns session-tenant rows', async () => {
    getUserFromSession.mockResolvedValue(fx.userA);
    const { GET } = await import('../app/api/tax-management/mappings/route.js');
    const request = new Request('http://localhost/api/tax-management/mappings');
    const res = await GET(request);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.mappings)).toBe(true);
    expect(body.mappings.some((m) => m.id === mappingB.id)).toBe(false);
  });

  it('HTTP transactions GET does not leak tenant B subledger rows', async () => {
    getUserFromSession.mockResolvedValue(fx.userA);
    const { GET } = await import('../app/api/tax-management/transactions/route.js');
    const request = new Request('http://localhost/api/tax-management/transactions');
    const res = await GET(request);
    expect(res.status).toBe(200);
    const body = await res.json();
    const rows = body.transactions || body.rows || [];
    expect(rows.every((r) => r.tenantId === fx.tenantA.id)).toBe(true);
  });

  it('HTTP pending reversals GET does not leak tenant B requests', async () => {
    if (!reversalB) return;
    getUserFromSession.mockResolvedValue(fx.userA);
    const { GET } = await import('../app/api/transactions/reverse/route.js');
    const request = new Request(
      'http://localhost/api/transactions/reverse?action=pending'
    );
    const res = await GET(request);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect((body.pending || []).some((r) => r.id === reversalB.id)).toBe(false);
  });
});
