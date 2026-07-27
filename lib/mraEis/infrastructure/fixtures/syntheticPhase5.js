/**
 * Synthetic Phase 5 fixture builders — non-real TINs/codes/URLs/credentials.
 * Do not seed production.
 */

export function syntheticTenantPair() {
  return {
    tenantA: {
      id: 'syn-tenant-a-phase5',
      businessId: 'syn-tenant-a-phase5',
      tin: 'TEST-TIN-A-0001',
    },
    tenantB: {
      id: 'syn-tenant-b-phase5',
      businessId: 'syn-tenant-b-phase5',
      tin: 'TEST-TIN-B-0002',
    },
  };
}

export function syntheticTerminalDraft(tenantId, overrides = {}) {
  return {
    tenantId,
    businessId: tenantId,
    environment: 'SANDBOX',
    terminalLabel: 'SYN-POS-01',
    status: 'DRAFT',
    offlineCertified: false,
    version: 1,
    ...overrides,
  };
}

export function syntheticConfigurationCanonical() {
  return {
    taxRates: [{ mraTaxRateId: 'TEST-TAX-A', rate: 17.5 }],
    sites: [{ mraSiteId: 'SITE-TEST-001', name: 'Synthetic Site' }],
    paymentMethods: [{ code: 'CASH', label: 'Cash' }],
  };
}

export function syntheticExternalProduct(tenantId) {
  return {
    tenantId,
    businessId: tenantId,
    environment: 'SANDBOX',
    mraTin: 'TEST-TIN-A-0001',
    mraSiteId: 'SITE-TEST-001',
    externalType: 'PRODUCT',
    mraCode: 'PROD-TEST-001',
    name: 'Synthetic Product',
    sourceVersion: 'v1',
  };
}

export function syntheticSnapshotHeader(tenantId, terminalId) {
  return {
    tenantId,
    businessId: tenantId,
    branchId: 'syn-branch-1',
    terminalId,
    siteMappingId: null,
    sourceType: 'POS_SALE',
    sourceId: 'syn-sale-001',
    sourceVersion: '1',
    localDocumentNumber: 'SYN-DOC-001',
    transactionDate: new Date('2026-07-01T10:00:00Z'),
    postingDate: new Date('2026-07-01T10:00:00Z'),
    businessDate: new Date('2026-07-01'),
    timezone: 'Africa/Blantyre',
    environment: 'SANDBOX',
    sellerTin: 'TEST-TIN-A-0001',
    sellerName: 'Synthetic Seller',
    currency: 'MWK',
    subtotal: '100.00',
    discountTotal: '0.00',
    taxTotal: '17.50',
    levyTotal: '0.00',
    invoiceTotal: '117.50',
    validationUrlPlaceholder: 'https://example.test/mra/validate/SYNTHETIC-ONLY',
  };
}

export function assertSyntheticSafe(record) {
  const json = JSON.stringify(record);
  if (/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/.test(json)) {
    throw new Error('Synthetic fixture must not contain JWT-like strings');
  }
  if (/activationCode|terminalSecret|buyerAuthorization/i.test(json) && /"[A-Za-z0-9]{20,}"/.test(json)) {
    throw new Error('Synthetic fixture must not contain plaintext secret-looking fields');
  }
  return true;
}
