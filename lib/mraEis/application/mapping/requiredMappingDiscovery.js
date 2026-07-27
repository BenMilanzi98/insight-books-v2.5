import prisma from '@/lib/prisma.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';

/**
 * Read-only discovery of which mappings are required for a Business.
 * Historical inactive records do not block unless still used.
 */
export async function discoverRequiredMappings({
  tenantId,
  businessId = tenantId,
  environment = 'SANDBOX',
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const env = String(environment).toUpperCase();
  const blockers = [];
  const warnings = [];

  // Branches use tenantId (= businessId in this platform)
  const activeBranches = await db.branch.findMany({
    where: { tenantId: businessId, isActive: true },
    select: { id: true, name: true, code: true },
  }).catch(() => []);

  const warehouses = await db.warehouse?.findMany?.({
    where: { tenantId: businessId, isActive: true },
    select: { id: true, name: true },
  }).catch?.(() => []) || [];

  // Prefer TaxRate model if present; otherwise empty
  const taxRates = await db.taxRate?.findMany?.({
    where: { OR: [{ tenantId: businessId }, { businessId }] , isActive: true },
    select: { id: true, name: true, rate: true },
  }).catch?.(() => []) || await db.taxRate?.findMany?.({
    where: { tenantId: businessId },
    select: { id: true, name: true, rate: true },
  }).catch?.(() => []) || [];

  const paymentMethods = await db.paymentMethod?.findMany?.({
    where: { tenantId: businessId, isActive: true },
    select: { id: true, name: true, type: true },
  }).catch?.(() => []) || [];

  const levies = await db.levy?.findMany?.({
    where: { tenantId: businessId, isActive: true },
    select: { id: true, name: true },
  }).catch?.(() => []) || [];

  // Business type heuristic — product inventory implies warehouse mapping may be required
  const productCount = await db.product?.count?.({
    where: { tenantId: businessId, isActive: true },
  }).catch?.(() => 0) || 0;
  const isProductBased = productCount > 0;

  const taxpayerIdentityRequired = true;
  const identity = await db.mraEisBusinessTaxpayerIdentity.findUnique({
    where: {
      tenantId_businessId_environment: { tenantId, businessId, environment: env },
    },
  }).catch(() => null);
  const taxpayerIdentitySatisfied = identity?.status === 'MATCHED' || identity?.status === 'NAME_DIFFERENCE_WARNING';

  if (!taxpayerIdentitySatisfied) {
    blockers.push('BUSINESS_TAXPAYER_IDENTITY_MISMATCH');
  }

  const siteMappingsRequired = activeBranches.length;
  const warehouseMappingsRequired = isProductBased ? Math.max(warehouses.length, 1) : 0;
  const taxMappingsRequired = taxRates.length > 0 ? taxRates.length : 1; // at least one treatment path for sales
  const levyMappingsRequired = levies.length;
  const paymentMappingsRequired = paymentMethods.length > 0 ? paymentMethods.length : 1;

  if (isProductBased && warehouseMappingsRequired > 0) {
    warnings.push('PRODUCT_BASED_WAREHOUSE_MAPPING_MAY_BE_REQUIRED');
  }

  return {
    environment: env,
    activeBranches,
    warehouses,
    taxRates,
    paymentMethods,
    levies,
    isProductBased,
    taxpayerIdentityRequired,
    taxpayerIdentitySatisfied,
    siteMappingsRequired,
    warehouseMappingsRequired,
    taxMappingsRequired,
    levyMappingsRequired,
    paymentMappingsRequired,
    blockers,
    warnings,
    discoveryVersion: 'phase9-required-mapping-discovery-v1',
  };
}
