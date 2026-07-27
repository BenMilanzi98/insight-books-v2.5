import prisma from '@/lib/prisma.js';
import { CERTIFICATION_STATUS, CERTIFICATION_TYPE } from '../domain/constants.js';
import { EisErrors } from '../domain/errors.js';
import { recordEisControlAudit } from '../infrastructure/audit.js';
import { invalidateEisCapabilityCache } from '../infrastructure/capabilityCache.js';

export async function getLatestCertification(
  { tenantId, businessId = null, certificationType = CERTIFICATION_TYPE.ONLINE },
  db = prisma
) {
  return db.mraEisCertificationRecord.findFirst({
    where: {
      tenantId,
      businessId: businessId || null,
      certificationType,
      isCurrent: true,
    },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function createCertificationRecord({
  admin,
  tenantId,
  businessId = null,
  productId,
  productVersion,
  certificationType = CERTIFICATION_TYPE.ONLINE,
  status,
  certificateReference,
  evidenceDocumentReference,
  effectiveFrom,
  effectiveUntil,
  notes,
  requestId,
  ipAddress,
  userAgent,
  db = prisma,
}) {
  if (!tenantId) throw EisErrors.validation({ message: 'tenantId is required.' });
  if (!status || !Object.values(CERTIFICATION_STATUS).includes(status)) {
    throw EisErrors.validation({ message: 'Invalid certification status.' });
  }
  if (
    [
      CERTIFICATION_STATUS.CERTIFIED_ONLINE,
      CERTIFICATION_STATUS.CERTIFIED_OFFLINE,
      CERTIFICATION_STATUS.PRODUCTION_APPROVED,
    ].includes(status) &&
    !String(certificateReference || evidenceDocumentReference || '').trim()
  ) {
    throw EisErrors.validation({
      message: 'Certification evidence or certificate reference is required for certified statuses.',
    });
  }

  const result = await db.$transaction(async (tx) => {
    await tx.mraEisCertificationRecord.updateMany({
      where: {
        tenantId,
        businessId: businessId || null,
        certificationType,
        isCurrent: true,
      },
      data: { isCurrent: false },
    });

    const row = await tx.mraEisCertificationRecord.create({
      data: {
        tenantId,
        businessId,
        productId: productId || null,
        productVersion: productVersion || null,
        certificationType,
        status,
        certificateReference: certificateReference || null,
        evidenceDocumentReference: evidenceDocumentReference || null,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
        effectiveUntil: effectiveUntil ? new Date(effectiveUntil) : null,
        recordedBy: admin.id,
        notes: notes || null,
        isCurrent: true,
        version: 1,
      },
    });

    await recordEisControlAudit(
      {
        tenantId,
        businessId: businessId || tenantId,
        actorId: admin.id,
        actorType: 'ADMIN',
        action: 'CERTIFICATION_RECORD_CREATED',
        resourceType: 'MraEisCertificationRecord',
        resourceId: row.id,
        newStatus: status,
        reason: notes,
        requestId,
        ipAddress,
        userAgent,
      },
      tx
    );
    return row;
  });

  invalidateEisCapabilityCache();
  return { certification: result };
}

export async function verifyCertificationRecord({
  admin,
  certificationId,
  notes,
  requestId,
  ipAddress,
  userAgent,
  db = prisma,
}) {
  const current = await db.mraEisCertificationRecord.findUnique({ where: { id: certificationId } });
  if (!current) throw EisErrors.validation({ message: 'Certification record not found.', httpStatus: 404 });
  if (admin.id === current.recordedBy && admin.role !== 'Super Admin') {
    throw EisErrors.approvalRequired({
      message: 'Segregation of duties: verifier must differ from recorder unless Super Admin.',
      requiredAction: 'Have another compliance reviewer verify this record.',
    });
  }

  const updated = await db.mraEisCertificationRecord.update({
    where: { id: certificationId },
    data: {
      verifiedBy: admin.id,
      verifiedAt: new Date(),
      notes: notes || current.notes,
      version: { increment: 1 },
    },
  });

  await recordEisControlAudit({
    tenantId: current.tenantId,
    businessId: current.businessId || current.tenantId,
    actorId: admin.id,
    actorType: 'ADMIN',
    action: 'CERTIFICATION_RECORD_VERIFIED',
    resourceType: 'MraEisCertificationRecord',
    resourceId: updated.id,
    previousStatus: current.status,
    newStatus: current.status,
    reason: notes,
    requestId,
    ipAddress,
    userAgent,
  });
  invalidateEisCapabilityCache();
  return { certification: updated };
}

export async function expireDueCertifications({ now = new Date(), db = prisma } = {}) {
  const due = await db.mraEisCertificationRecord.findMany({
    where: {
      isCurrent: true,
      effectiveUntil: { lt: now },
      status: {
        in: [
          CERTIFICATION_STATUS.CERTIFIED_ONLINE,
          CERTIFICATION_STATUS.CERTIFIED_OFFLINE,
          CERTIFICATION_STATUS.PRODUCTION_APPROVED,
          CERTIFICATION_STATUS.SANDBOX_PASSED,
        ],
      },
    },
  });
  for (const row of due) {
    await db.mraEisCertificationRecord.update({
      where: { id: row.id },
      data: { status: CERTIFICATION_STATUS.EXPIRED, version: { increment: 1 } },
    });
    await recordEisControlAudit({
      tenantId: row.tenantId,
      businessId: row.businessId || row.tenantId,
      actorType: 'SYSTEM',
      action: 'CERTIFICATION_RECORD_EXPIRED',
      resourceType: 'MraEisCertificationRecord',
      resourceId: row.id,
      previousStatus: row.status,
      newStatus: CERTIFICATION_STATUS.EXPIRED,
    });
  }
  if (due.length) invalidateEisCapabilityCache();
  return { expired: due.length };
}
