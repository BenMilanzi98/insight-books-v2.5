import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSubscriptionStatus } = vi.hoisted(() => ({
  getSubscriptionStatus: vi.fn(),
}));

vi.mock('../../lib/subscriptionService.js', () => ({ getSubscriptionStatus }));

import {
  allocateNumberPrefix,
  bindDesktopDevice,
  unbindDesktopDevice,
} from '../../lib/desktop/cloud/bind.js';
import { heartbeatDesktopDevice } from '../../lib/desktop/cloud/heartbeat.js';
import { DESKTOP_CODES } from '../../lib/desktop/codes.js';

describe('allocateNumberPrefix', () => {
  it('starts at TILL1', () => {
    expect(allocateNumberPrefix([])).toBe('TILL1');
  });

  it('skips used prefixes', () => {
    expect(allocateNumberPrefix(['TILL1', 'TILL2'])).toBe('TILL3');
  });
});

function fakePrisma(seed = []) {
  const devices = seed.map((device) => ({ ...device }));
  const client = {
    _devices: devices,
    $transaction: async (callback) => callback(client),
    desktopDevice: {
      findMany: async ({ where }) =>
        devices.filter(
          (device) =>
            device.tenantId === where.tenantId &&
            (where.unboundAt === null ? device.unboundAt == null : true)
        ),
      findFirst: async ({ where }) =>
        devices.find((device) => {
          if (where.tenantId && device.tenantId !== where.tenantId) return false;
          if (where.deviceId && device.deviceId !== where.deviceId) return false;
          if (where.unboundAt === null && device.unboundAt != null) return false;
          return true;
        }) || null,
      findUnique: async ({ where }) =>
        devices.find((device) => device.deviceId === where.deviceId) || null,
      create: async ({ data }) => {
        const row = { ...data, unboundAt: null, boundAt: new Date() };
        devices.push(row);
        return row;
      },
      updateMany: async ({ where, data }) => {
        const matches = devices.filter(
          (device) =>
            device.tenantId === where.tenantId &&
            device.deviceId === where.deviceId &&
            (where.unboundAt === null ? device.unboundAt == null : true)
        );
        matches.forEach((device) => Object.assign(device, data));
        return { count: matches.length };
      },
      update: async ({ where, data }) => {
        const device = devices.find((row) => row.deviceId === where.deviceId);
        if (!device) throw new Error('Device not found');
        Object.assign(device, data);
        return device;
      },
    },
  };
  return client;
}

describe('bindDesktopDevice', () => {
  it('rejects a second active device', async () => {
    const prisma = fakePrisma([
      { tenantId: 't1', deviceId: 'pc-a', numberPrefix: 'TILL1', unboundAt: null },
    ]);

    await expect(
      bindDesktopDevice({ prisma, tenantId: 't1', deviceId: 'pc-b', name: 'Shop' })
    ).rejects.toMatchObject({ code: DESKTOP_CODES.DEVICE_BOUND });
  });

  it('is idempotent for the same device', async () => {
    const prisma = fakePrisma([]);
    const first = await bindDesktopDevice({
      prisma,
      tenantId: 't1',
      deviceId: 'pc-a',
      name: 'Shop',
    });
    const second = await bindDesktopDevice({
      prisma,
      tenantId: 't1',
      deviceId: 'pc-a',
      name: 'Shop',
    });

    expect(first.numberPrefix).toBe('TILL1');
    expect(second.numberPrefix).toBe('TILL1');
    expect(prisma._devices).toHaveLength(1);
  });

  it('rebinds the same device after unbind without creating another row', async () => {
    const prisma = fakePrisma([
      { tenantId: 't1', deviceId: 'pc-a', numberPrefix: 'TILL1', unboundAt: null },
    ]);

    await unbindDesktopDevice({ prisma, tenantId: 't1', deviceId: 'pc-a' });
    const rebound = await bindDesktopDevice({
      prisma,
      tenantId: 't1',
      deviceId: 'pc-a',
      name: 'Shop',
    });

    expect(rebound.numberPrefix).toBe('TILL1');
    expect(prisma._devices).toHaveLength(1);
    expect(prisma._devices[0].unboundAt).toBeNull();
    expect(prisma._devices[0].boundAt).toBeInstanceOf(Date);
  });

  it('rejects a device owned by another tenant with 403', async () => {
    const prisma = fakePrisma([
      { tenantId: 't2', deviceId: 'pc-a', numberPrefix: 'TILL1', unboundAt: null },
    ]);

    await expect(
      bindDesktopDevice({ prisma, tenantId: 't1', deviceId: 'pc-a', name: 'Shop' })
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe('unbindDesktopDevice', () => {
  it('marks the active tenant device as unbound', async () => {
    const prisma = fakePrisma([
      { tenantId: 't1', deviceId: 'pc-a', numberPrefix: 'TILL1', unboundAt: null },
    ]);

    await expect(
      unbindDesktopDevice({ prisma, tenantId: 't1', deviceId: 'pc-a' })
    ).resolves.toEqual({ ok: true });
    expect(prisma._devices[0].unboundAt).toBeInstanceOf(Date);
  });

  it('rejects an already-unbound device as not bound', async () => {
    const prisma = fakePrisma([
      {
        tenantId: 't1',
        deviceId: 'pc-a',
        numberPrefix: 'TILL1',
        unboundAt: new Date(),
      },
    ]);

    await expect(
      unbindDesktopDevice({ prisma, tenantId: 't1', deviceId: 'pc-a' })
    ).rejects.toMatchObject({ code: DESKTOP_CODES.NOT_BOUND, status: 403 });
  });

  it('rejects a missing device as not bound', async () => {
    const prisma = fakePrisma([]);

    await expect(
      unbindDesktopDevice({ prisma, tenantId: 't1', deviceId: 'missing' })
    ).rejects.toMatchObject({ code: DESKTOP_CODES.NOT_BOUND, status: 403 });
  });

  it('rejects a foreign-tenant device as not bound', async () => {
    const prisma = fakePrisma([
      { tenantId: 't2', deviceId: 'pc-a', numberPrefix: 'TILL1', unboundAt: null },
    ]);

    await expect(
      unbindDesktopDevice({ prisma, tenantId: 't1', deviceId: 'pc-a' })
    ).rejects.toMatchObject({ code: DESKTOP_CODES.NOT_BOUND, status: 403 });
  });
});

describe('heartbeatDesktopDevice', () => {
  beforeEach(() => {
    getSubscriptionStatus.mockReset();
  });

  it('updates heartbeat and reports an active subscription', async () => {
    const prisma = fakePrisma([
      { tenantId: 't1', deviceId: 'pc-a', numberPrefix: 'TILL1', unboundAt: null },
    ]);
    getSubscriptionStatus.mockResolvedValue({ status: 'trial' });

    const result = await heartbeatDesktopDevice({
      prisma,
      tenantId: 't1',
      deviceId: 'pc-a',
    });

    expect(result).toMatchObject({ bound: true, subscriptionActive: true });
    expect(new Date(result.serverNow).toISOString()).toBe(result.serverNow);
    expect(prisma._devices[0].lastHeartbeatAt).toBeInstanceOf(Date);
  });

  it('rejects a missing or unbound device', async () => {
    const prisma = fakePrisma([]);

    await expect(
      heartbeatDesktopDevice({ prisma, tenantId: 't1', deviceId: 'missing' })
    ).rejects.toMatchObject({ code: DESKTOP_CODES.NOT_BOUND, status: 403 });
  });

  it('returns the inactive subscription code without rejecting', async () => {
    const prisma = fakePrisma([
      { tenantId: 't1', deviceId: 'pc-a', numberPrefix: 'TILL1', unboundAt: null },
    ]);
    getSubscriptionStatus.mockResolvedValue({ status: 'none' });

    await expect(
      heartbeatDesktopDevice({ prisma, tenantId: 't1', deviceId: 'pc-a' })
    ).resolves.toMatchObject({
      bound: true,
      subscriptionActive: false,
      code: DESKTOP_CODES.SUBSCRIPTION_INACTIVE,
    });
  });
});
