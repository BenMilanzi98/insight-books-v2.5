import { DESKTOP_CODES } from '../codes.js';

function desktopError(message, { code, status = 400 } = {}) {
  const error = new Error(message);
  if (code) error.code = code;
  error.status = status;
  return error;
}

export function allocateNumberPrefix(existingPrefixes) {
  const used = new Set(existingPrefixes);
  for (let number = 1; number <= 99; number += 1) {
    const prefix = `TILL${number}`;
    if (!used.has(prefix)) return prefix;
  }
  throw desktopError('No desktop number prefix is available');
}

export async function bindDesktopDevice({ prisma, tenantId, deviceId, name }) {
  if (!tenantId || !deviceId) {
    throw desktopError('Tenant and device ID are required');
  }

  return prisma.$transaction(async (tx) => {
    // Serialize first-bind attempts for each tenant.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId}))`;

    const activeDevices = await tx.desktopDevice.findMany({
      where: { tenantId, unboundAt: null },
    });
    const existingDevice = await tx.desktopDevice.findUnique({ where: { deviceId } });

    const otherDevice = activeDevices.find((device) => device.deviceId !== deviceId);
    if (otherDevice) {
      throw desktopError('Another desktop device is already bound', {
        code: DESKTOP_CODES.DEVICE_BOUND,
        status: 409,
      });
    }

    if (existingDevice && existingDevice.tenantId !== tenantId) {
      throw desktopError('Desktop device belongs to another tenant', { status: 403 });
    }

    if (existingDevice && existingDevice.unboundAt == null) {
      return {
        deviceId: existingDevice.deviceId,
        numberPrefix: existingDevice.numberPrefix,
        boundAt: existingDevice.boundAt,
      };
    }

    const activePrefixes = activeDevices.map((device) => device.numberPrefix);
    const canReusePrefix =
      existingDevice && !activePrefixes.includes(existingDevice.numberPrefix);
    const numberPrefix = canReusePrefix
      ? existingDevice.numberPrefix
      : allocateNumberPrefix(activePrefixes);
    const boundAt = new Date();
    const device = existingDevice
      ? await tx.desktopDevice.update({
          where: { deviceId },
          data: { name, numberPrefix, unboundAt: null, boundAt },
        })
      : await tx.desktopDevice.create({
          data: {
            tenantId,
            deviceId,
            name,
            numberPrefix,
          },
        });

    return {
      deviceId: device.deviceId,
      numberPrefix: device.numberPrefix,
      boundAt: device.boundAt,
    };
  });
}

export async function unbindDesktopDevice({ prisma, tenantId, deviceId }) {
  const result = await prisma.desktopDevice.updateMany({
    where: { tenantId, deviceId, unboundAt: null },
    data: { unboundAt: new Date() },
  });
  if (result.count !== 1) {
    throw desktopError('Desktop device is not bound', {
      code: DESKTOP_CODES.NOT_BOUND,
      status: 403,
    });
  }
  return { ok: true };
}
