import prisma from '@/lib/prisma.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';
import { CONFIGURATION_TYPE, CONFIGURATION_STATUS } from '../../domain/operationalEnums.js';
import { recordEisControlAudit } from '../../infrastructure/audit.js';

/**
 * Validate Business ↔ MRA taxpayer identity. TIN mismatch is blocking.
 * Does not silently overwrite local Business records.
 */
export async function validateBusinessTaxpayerIdentity({
  tenantId,
  businessId = tenantId,
  environment = 'SANDBOX',
  verifiedBy = null,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const env = String(environment).toUpperCase();

  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, tin: true, taxId: true, legalName: true },
  });
  const localTin = tenant?.tin || tenant?.taxId || null;
  const localLegalName = tenant?.legalName || tenant?.name || null;

  const taxpayerSnap = await db.mraEisConfigurationSnapshot.findFirst({
    where: {
      tenantId,
      businessId,
      environment: env,
      configurationType: CONFIGURATION_TYPE.TAXPAYER,
      status: CONFIGURATION_STATUS.ACTIVE,
    },
    orderBy: { activatedAt: 'desc' },
  });

  const mraTin = taxpayerSnap?.canonicalData?.tin || null;
  const mraLegalName = taxpayerSnap?.canonicalData?.legalName || null;

  let status = 'CONFIGURATION_MISSING';
  const differenceSummary = {};

  if (!taxpayerSnap) {
    status = 'CONFIGURATION_MISSING';
  } else if (!localTin || !mraTin) {
    status = 'TIN_MISMATCH';
    differenceSummary.missingTin = true;
  } else if (String(localTin) !== String(mraTin)) {
    status = 'TIN_MISMATCH';
    differenceSummary.localTin = localTin;
    differenceSummary.mraTin = mraTin;
  } else if (
    localLegalName &&
    mraLegalName &&
    String(localLegalName).trim().toLowerCase() !== String(mraLegalName).trim().toLowerCase()
  ) {
    status = 'NAME_DIFFERENCE_WARNING';
    differenceSummary.localLegalName = localLegalName;
    differenceSummary.mraLegalName = mraLegalName;
  } else if (taxpayerSnap.canonicalData?.status && String(taxpayerSnap.canonicalData.status).toUpperCase() !== 'ACTIVE') {
    status = 'TAXPAYER_INACTIVE';
  } else {
    status = 'MATCHED';
  }

  const row = await db.mraEisBusinessTaxpayerIdentity.upsert({
    where: {
      tenantId_businessId_environment: { tenantId, businessId, environment: env },
    },
    create: {
      tenantId,
      businessId,
      environment: env,
      localTin: localTin || '',
      mraTin: mraTin || '',
      localLegalName,
      mraLegalName,
      status,
      sourceConfigurationSnapshotId: taxpayerSnap?.id || null,
      differenceSummary,
      verifiedAt: status === 'MATCHED' ? new Date() : null,
      verifiedBy,
    },
    update: {
      localTin: localTin || '',
      mraTin: mraTin || '',
      localLegalName,
      mraLegalName,
      status,
      sourceConfigurationSnapshotId: taxpayerSnap?.id || null,
      differenceSummary,
      verifiedAt: status === 'MATCHED' ? new Date() : null,
      verifiedBy,
      version: { increment: 1 },
    },
  });

  await recordEisControlAudit({
    tenantId,
    businessId,
    actorId: verifiedBy,
    actorType: verifiedBy ? 'USER' : 'SERVICE',
    action: 'BUSINESS_TAXPAYER_IDENTITY_EVALUATED',
    resourceType: 'MraEisBusinessTaxpayerIdentity',
    resourceId: row.id,
    environment: env,
    newStatus: status,
    metadata: { blocking: status === 'TIN_MISMATCH' || status === 'CONFIGURATION_MISSING' },
  }, db);

  const blocking = ['TIN_MISMATCH', 'CONFIGURATION_MISSING', 'TAXPAYER_INACTIVE'].includes(status);
  const blockers = [];
  const warnings = [];
  if (status === 'TIN_MISMATCH') blockers.push('BUSINESS_TAXPAYER_IDENTITY_MISMATCH');
  if (status === 'CONFIGURATION_MISSING') blockers.push('ACTIVE_CONFIGURATION_REQUIRED');
  if (status === 'TAXPAYER_INACTIVE') blockers.push('TAXPAYER_INACTIVE');
  if (status === 'NAME_DIFFERENCE_WARNING') warnings.push('TAXPAYER_NAME_DIFFERENCE');

  return {
    ...row,
    blocking,
    warning: status === 'NAME_DIFFERENCE_WARNING',
    blockers,
    warnings,
  };
}
