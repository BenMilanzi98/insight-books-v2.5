import prisma from '@/lib/prisma.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';

/**
 * Read-only local Product/Service discovery. Services are Products with isService=true.
 */
export async function discoverLocalProducts({
  tenantId,
  businessId = tenantId,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const rows = await db.product.findMany({
    where: {
      tenantId: businessId,
      isService: false,
    },
    select: {
      id: true,
      name: true,
      sku: true,
      barcode: true,
      price: true,
      taxRate: true,
      isDeleted: true,
      isService: true,
      stockLevel: true,
      branchId: true,
    },
    take: 2000,
  }).catch(() => []);

  return rows.map((p) => {
    let classification = 'ACTIVE_SELLABLE_PRODUCT';
    if (p.isDeleted) classification = 'INACTIVE_PRODUCT';
    else if (p.isService) classification = 'SERVICE_LIKE_PRODUCT';
    else if (Number(p.stockLevel) === 0) classification = 'INVENTORY_PRODUCT';
    return {
      localProductId: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      price: p.price,
      taxRate: p.taxRate,
      branchId: p.branchId,
      classification,
      requiresMapping: classification === 'ACTIVE_SELLABLE_PRODUCT' || classification === 'INVENTORY_PRODUCT',
    };
  });
}

export async function discoverLocalServices({
  tenantId,
  businessId = tenantId,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const rows = await db.product.findMany({
    where: { tenantId: businessId, isService: true },
    select: {
      id: true,
      name: true,
      sku: true,
      price: true,
      taxRate: true,
      isDeleted: true,
      serviceBillingType: true,
      branchId: true,
    },
    take: 2000,
  }).catch(() => []);

  return rows.map((s) => {
    let classification = 'ACTIVE_SELLABLE_SERVICE';
    if (s.isDeleted) classification = 'INACTIVE_SERVICE';
    else if (s.serviceBillingType === 'RECURRING') classification = 'RECURRING_SERVICE';
    return {
      localServiceId: s.id,
      name: s.name,
      code: s.sku,
      price: s.price,
      taxRate: s.taxRate,
      branchId: s.branchId,
      classification,
      requiresMapping: classification !== 'INACTIVE_SERVICE',
    };
  });
}

export async function discoverRequiredLocalItems({
  tenantId,
  businessId = tenantId,
  db = prisma,
}) {
  const [products, services] = await Promise.all([
    discoverLocalProducts({ tenantId, businessId, db }),
    discoverLocalServices({ tenantId, businessId, db }),
  ]);
  return {
    productsRequired: products.filter((p) => p.requiresMapping),
    servicesRequired: services.filter((s) => s.requiresMapping),
    productsAll: products,
    servicesAll: services,
    discoveryVersion: 'phase10-required-local-item-discovery-v1',
  };
}
