/**
 * Phase 20 — Deterministic synthetic fixtures (no real PII, secrets, keys, BAC).
 */

export function buildSyntheticTenantSet() {
  return Object.freeze({
    singleBusiness: { tenantId: 'syn-tenant-a', businessId: 'syn-tenant-a', kind: 'SINGLE_BUSINESS' },
    sandboxOnly: {
      tenantId: 'syn-tenant-sandbox',
      businessId: 'syn-tenant-sandbox',
      environment: 'SANDBOX',
      kind: 'SANDBOX_ONLY',
    },
    suspended: {
      tenantId: 'syn-tenant-suspended',
      businessId: 'syn-tenant-suspended',
      suspended: true,
      kind: 'SUSPENDED',
    },
    restricted: {
      tenantId: 'syn-tenant-restricted',
      businessId: 'syn-tenant-restricted',
      terminalBlocked: true,
      kind: 'RESTRICTED',
    },
  });
}

export function buildSyntheticTerminals(tenantId = 'syn-tenant-a') {
  return Object.freeze([
    {
      id: 'syn-term-sandbox-active',
      tenantId,
      businessId: tenantId,
      environment: 'SANDBOX',
      status: 'ACTIVE',
      credentialReference: 'secret-provider://syn/term-sandbox',
    },
    {
      id: 'syn-term-blocked',
      tenantId,
      businessId: tenantId,
      environment: 'SANDBOX',
      status: 'BLOCKED',
      credentialReference: 'secret-provider://syn/term-blocked',
    },
    {
      id: 'syn-term-offline-certified',
      tenantId,
      businessId: tenantId,
      environment: 'SANDBOX',
      offlineCertified: true,
      credentialReference: 'secret-provider://syn/term-offline',
    },
  ]);
}

export function buildSyntheticTransactions(tenantId = 'syn-tenant-a') {
  return Object.freeze([
    {
      id: 'syn-sale-cash-accepted',
      tenantId,
      businessId: tenantId,
      environment: 'SANDBOX',
      payment: 'CASH',
      gross: '100.00',
      tax: '17.50',
      currency: 'MWK',
      hasAcceptedResponseEvidence: true,
      mraTransactionId: 'SYN-MRA-001',
      fiscalNumber: 'SYN-FN-1001',
      journalCount: 1,
      stockMovementCount: 1,
    },
    {
      id: 'syn-sale-unknown',
      tenantId,
      businessId: tenantId,
      environment: 'SANDBOX',
      hasUnknownOutcome: true,
      fiscalNumber: 'SYN-FN-1002',
      journalCount: 1,
      stockMovementCount: 1,
    },
    {
      id: 'syn-sale-historical-eligible',
      tenantId,
      businessId: tenantId,
      environment: 'SANDBOX',
      eisEligible: true,
      hasAnyMraEvidence: false,
      historical: true,
      journalCount: 1,
      stockMovementCount: 1,
    },
    {
      id: 'syn-sale-service',
      tenantId,
      businessId: tenantId,
      environment: 'SANDBOX',
      serviceOnly: true,
      journalCount: 1,
      stockMovementCount: 0,
    },
  ]);
}

/** Assert fixtures contain no forbidden secret material */
export function assertSyntheticFixturesSafe(fixtures) {
  const blob = JSON.stringify(fixtures);
  const banned = [
    /-----BEGIN .*PRIVATE KEY-----/,
    /buyerAuthorizationCode":"[^R]/,
    /"password":"[^s]/,
    /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/,
  ];
  for (const re of banned) {
    if (re.test(blob)) {
      throw new Error(`Synthetic fixture safety violation: ${re}`);
    }
  }
  return true;
}
