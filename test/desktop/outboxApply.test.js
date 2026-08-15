import { describe, expect, it, vi } from 'vitest';
import { applyDesktopOutboxItem } from '../../lib/desktop/cloud/outboxApply.js';

function fakePrisma(receipts) {
  return {
    desktopOutboxReceipt: {
      findUnique: async ({ where }) =>
        receipts.find(
          (r) => r.tenantId === where.tenantId_id.tenantId && r.id === where.tenantId_id.id
        ) || null,
      create: async ({ data }) => {
        receipts.push(data);
        return data;
      },
    },
  };
}

describe('applyDesktopOutboxItem', () => {
  it('returns the original result on duplicate id', async () => {
    const receipts = [
      { tenantId: 't1', id: 'm1', resultJson: { serverId: 'sale-1' }, serverEntityId: 'sale-1' },
    ];
    const createSale = vi.fn();
    const prisma = {
      desktopOutboxReceipt: {
        findUnique: async ({ where }) =>
          receipts.find((r) => r.tenantId === where.tenantId_id.tenantId && r.id === where.tenantId_id.id) || null,
        create: async ({ data }) => {
          receipts.push(data);
          return data;
        },
      },
    };
    const first = await applyDesktopOutboxItem({
      prisma,
      tenantId: 't1',
      user: { id: 'u1', tenantId: 't1' },
      deviceId: 'pc-a',
      item: { id: 'm1', kind: 'pos.sale', payload: {} },
      handlers: { 'pos.sale': createSale },
    });
    expect(first.serverId).toBe('sale-1');
    expect(createSale).not.toHaveBeenCalled();
  });

  it('calls handler once for a new id', async () => {
    const receipts = [];
    const createSale = vi.fn(async () => ({ id: 'sale-2' }));
    const prisma = {
      desktopOutboxReceipt: {
        findUnique: async () => null,
        create: async ({ data }) => {
          receipts.push(data);
          return data;
        },
      },
    };
    const r = await applyDesktopOutboxItem({
      prisma,
      tenantId: 't1',
      user: { id: 'u1', tenantId: 't1' },
      deviceId: 'pc-a',
      item: { id: 'm2', kind: 'pos.sale', payload: { total: 1 }, saleNumber: 'TILL1-SALE-1' },
      handlers: { 'pos.sale': createSale },
    });
    expect(createSale).toHaveBeenCalledTimes(1);
    expect(r.serverId).toBe('sale-2');
    expect(receipts).toHaveLength(1);
  });

  it('stores a receipt keyed by the client mutation id', async () => {
    const receipts = [];
    const prisma = fakePrisma(receipts);
    await applyDesktopOutboxItem({
      prisma,
      tenantId: 't1',
      user: { id: 'u1', tenantId: 't1' },
      deviceId: 'pc-a',
      item: { id: 'm3', kind: 'pos.cashDay.open', payload: { openingFloat: 5000 } },
      handlers: { 'pos.cashDay.open': async () => ({ id: 'cashday-1' }) },
    });
    expect(receipts[0]).toMatchObject({
      id: 'm3',
      tenantId: 't1',
      deviceId: 'pc-a',
      kind: 'pos.cashDay.open',
      serverEntityId: 'cashday-1',
    });
    expect(receipts[0].resultJson).toBeTruthy();
  });

  it('passes the offline sale number through to the handler', async () => {
    const receipts = [];
    const prisma = fakePrisma(receipts);
    const createSale = vi.fn(async () => ({ id: 'sale-3' }));
    await applyDesktopOutboxItem({
      prisma,
      tenantId: 't1',
      user: { id: 'u1', tenantId: 't1' },
      deviceId: 'pc-a',
      item: { id: 'm4', kind: 'pos.sale', payload: { total: 2 }, saleNumber: 'TILL1-SALE-7' },
      handlers: { 'pos.sale': createSale },
    });
    expect(createSale.mock.calls[0][0]).toMatchObject({
      tenantId: 't1',
      deviceId: 'pc-a',
      saleNumber: 'TILL1-SALE-7',
      payload: { total: 2 },
    });
  });

  it('throws UNKNOWN_KIND for an unsupported kind', async () => {
    const receipts = [];
    const prisma = fakePrisma(receipts);
    await expect(
      applyDesktopOutboxItem({
        prisma,
        tenantId: 't1',
        user: { id: 'u1', tenantId: 't1' },
        deviceId: 'pc-a',
        item: { id: 'm5', kind: 'pos.teleport', payload: {} },
        handlers: { 'pos.sale': async () => ({ id: 'x' }) },
      })
    ).rejects.toMatchObject({ code: 'UNKNOWN_KIND' });
    expect(receipts).toHaveLength(0);
  });

  it('does not write a receipt when the handler fails', async () => {
    const receipts = [];
    const prisma = fakePrisma(receipts);
    await expect(
      applyDesktopOutboxItem({
        prisma,
        tenantId: 't1',
        user: { id: 'u1', tenantId: 't1' },
        deviceId: 'pc-a',
        item: { id: 'm6', kind: 'pos.sale', payload: {} },
        handlers: {
          'pos.sale': async () => {
            throw new Error('Insufficient stock');
          },
        },
      })
    ).rejects.toThrow('Insufficient stock');
    expect(receipts).toHaveLength(0);
  });
});
