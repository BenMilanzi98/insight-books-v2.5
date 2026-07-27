import prisma from '@/lib/prisma.js';
import { MAPPING_STATUS } from '../../domain/operationalEnums.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';

/**
 * Product/Service tax consistency against Phase 9 tax mappings + external tax reference.
 * Never mutates local tax assignments.
 */
export async function validateProductTaxConsistency({
  tenantId,
  businessId = tenantId,
  localTaxRateId = null,
  localTaxRateValue = null,
  externalTaxId = null,
  environment = 'SANDBOX',
  transactionDate = new Date(),
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const env = String(environment).toUpperCase();

  if (!localTaxRateId && localTaxRateValue == null) {
    return { status: 'LOCAL_TAX_MISSING', blocking: true, localTaxMutated: false };
  }
  if (!externalTaxId) {
    return { status: 'EXTERNAL_TAX_MISSING', blocking: true, localTaxMutated: false };
  }

  const taxMappings = await db.mraEisTaxMapping.findMany({
    where: {
      tenantId,
      businessId,
      environment: env,
      status: MAPPING_STATUS.ACTIVE,
      ...(localTaxRateId ? { localTaxRateId: String(localTaxRateId) } : {}),
    },
  });

  const at = new Date(transactionDate);
  const effective = taxMappings.filter(
    (m) => new Date(m.effectiveFrom) <= at && (!m.effectiveTo || at <= new Date(m.effectiveTo))
  );

  if (!effective.length && localTaxRateId) {
    return { status: 'TAX_MAPPING_MISSING', blocking: true, localTaxMutated: false };
  }

  const match = effective.find((m) => String(m.mraTaxRateId) === String(externalTaxId));
  if (!match && effective.length) {
    return {
      status: 'TAX_ID_MISMATCH',
      blocking: true,
      localMraTaxRateId: effective[0]?.mraTaxRateId,
      externalTaxId,
      localTaxMutated: false,
    };
  }
  if (String(externalTaxId).toUpperCase().includes('VAT5')) {
    return { status: 'VAT5_REQUIRES_RUNTIME_VALIDATION', blocking: true, localTaxMutated: false };
  }

  return {
    status: 'CONSISTENT',
    blocking: false,
    taxMappingId: match?.id || effective[0]?.id || null,
    taxMappingVersion: match?.mappingVersion || effective[0]?.mappingVersion || null,
    mraTaxRateId: externalTaxId,
    localTaxMutated: false,
  };
}
