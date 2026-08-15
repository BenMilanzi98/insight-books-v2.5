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

  const activeDevices = await prisma.desktopDevice.findMany({
    where: { tenantId, unboundAt: null },
  });
  const currentDevice = activeDevices.find((device) => device.deviceId === deviceId);
  const otherDevice = activeDevices.find((device) => device.deviceId !== deviceId);

  if (otherDevice) {
    throw desktopError('Another desktop device is already bound', {
      code: DESKTOP_CODES.DEVICE_BOUND,
      status: 409,
    });
  }

  if (currentDevice) {
    return {
      deviceId: currentDevice.deviceId,
      numberPrefix: currentDevice.numberPrefix,
      boundAt: currentDevice.boundAt,
    };
  }

  const existingDevice = await prisma.desktopDevice.findUnique({ where: { deviceId } });
  if (existingDevice && existingDevice.tenantId !== tenantId) {
    throw desktopError('Desktop device belongs to another tenant', { status: 403 });
  }

  const numberPrefix = allocateNumberPrefix(activeDevices.map((device) => device.numberPrefix));
  const device = await prisma.desktopDevice.create({
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
}

export async function unbindDesktopDevice({ prisma, tenantId, deviceId }) {
  await prisma.desktopDevice.updateMany({
    where: { tenantId, deviceId, unboundAt: null },
    data: { unboundAt: new Date() },
  });
  return { ok: true };
}
