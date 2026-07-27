import prisma from '@/lib/prisma.js';
import {
  PLATFORM_SETTING_ID,
  PLATFORM_STATUS,
} from '../domain/constants.js';
import { EisErrors } from '../domain/errors.js';
import { recordEisControlAudit } from '../infrastructure/audit.js';
import { beginIdempotentAction, completeIdempotentAction } from '../infrastructure/idempotency.js';
import { invalidateEisCapabilityCache } from '../infrastructure/capabilityCache.js';

const DEFAULT_PLATFORM = Object.freeze({
  id: PLATFORM_SETTING_ID,
  status: PLATFORM_STATUS.DISABLED,
  sandboxGloballyAllowed: true,
  productionGloballyAllowed: false,
  newEntitlementsAllowed: true,
  maintenanceMessage: null,
  statusReason: null,
  statusChangedBy: null,
  statusChangedAt: null,
  version: 0,
});

export async function getPlatformEisSetting(db = prisma) {
  const row = await db.mraEisPlatformSetting.findUnique({ where: { id: PLATFORM_SETTING_ID } });
  return row || { ...DEFAULT_PLATFORM };
}

export async function ensurePlatformEisSetting(db = prisma) {
  return db.mraEisPlatformSetting.upsert({
    where: { id: PLATFORM_SETTING_ID },
    create: {
      id: PLATFORM_SETTING_ID,
      status: PLATFORM_STATUS.DISABLED,
      sandboxGloballyAllowed: true,
      productionGloballyAllowed: false,
      newEntitlementsAllowed: true,
      version: 1,
    },
    update: {},
  });
}

export async function updatePlatformEisStatus({
  admin,
  status,
  reason,
  sandboxGloballyAllowed,
  productionGloballyAllowed,
  newEntitlementsAllowed,
  maintenanceMessage,
  expectedVersion,
  requestId,
  ipAddress,
  userAgent,
  db = prisma,
}) {
  if (!status || !Object.values(PLATFORM_STATUS).includes(status)) {
    throw EisErrors.validation({ message: 'Invalid platform status.' });
  }
  if (
    (status === PLATFORM_STATUS.EMERGENCY_PAUSED ||
      status === PLATFORM_STATUS.MAINTENANCE ||
      status === PLATFORM_STATUS.DISABLED) &&
    !String(reason || '').trim()
  ) {
    throw EisErrors.reasonRequired({ message: 'A reason is required for this platform status change.' });
  }

  const idem = await beginIdempotentAction({
    actionKey: 'PLATFORM_EIS_STATUS',
    requestId,
    payload: { status, reason, sandboxGloballyAllowed, productionGloballyAllowed, newEntitlementsAllowed },
    db,
  });
  if (idem.hit) return idem.result;

  await ensurePlatformEisSetting(db);
  const current = await db.mraEisPlatformSetting.findUnique({ where: { id: PLATFORM_SETTING_ID } });
  if (expectedVersion != null && current.version !== expectedVersion) {
    throw EisErrors.versionConflict({ details: { expectedVersion, actual: current.version } });
  }

  const previousStatus = current.status;
  const updated = await db.mraEisPlatformSetting.update({
    where: { id: PLATFORM_SETTING_ID },
    data: {
      status,
      statusReason: reason || null,
      statusChangedBy: admin.id,
      statusChangedAt: new Date(),
      sandboxGloballyAllowed:
        sandboxGloballyAllowed === undefined ? current.sandboxGloballyAllowed : Boolean(sandboxGloballyAllowed),
      productionGloballyAllowed:
        productionGloballyAllowed === undefined
          ? current.productionGloballyAllowed
          : Boolean(productionGloballyAllowed),
      newEntitlementsAllowed:
        newEntitlementsAllowed === undefined ? current.newEntitlementsAllowed : Boolean(newEntitlementsAllowed),
      maintenanceMessage: maintenanceMessage === undefined ? current.maintenanceMessage : maintenanceMessage,
      version: { increment: 1 },
    },
  });

  await recordEisControlAudit(
    {
      actorId: admin.id,
      actorType: 'ADMIN',
      action: status === PLATFORM_STATUS.EMERGENCY_PAUSED ? 'PLATFORM_EMERGENCY_PAUSE_STARTED' : 'PLATFORM_STATUS_CHANGED',
      resourceType: 'MraEisPlatformSetting',
      resourceId: PLATFORM_SETTING_ID,
      previousStatus,
      newStatus: status,
      reason,
      requestId,
      ipAddress,
      userAgent,
    },
    db
  );

  invalidateEisCapabilityCache();
  const result = { platform: updated };
  await completeIdempotentAction({ identity: idem.identity, result, db });
  return result;
}
