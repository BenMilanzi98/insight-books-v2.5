/**
 * Phase 19 — Tenant/Business ownership + Environment classification.
 * No default-Tenant fallback. Ambiguous → Manual Review / Quarantine.
 */

export const OWNERSHIP_OUTCOME = Object.freeze({
  CONCLUSIVE: 'CONCLUSIVE',
  STRONG: 'STRONG',
  AMBIGUOUS: 'AMBIGUOUS',
  CONFLICTING: 'CONFLICTING',
  ORPHANED: 'ORPHANED',
  CROSS_TENANT_CONFLICT: 'CROSS_TENANT_CONFLICT',
  CROSS_BUSINESS_CONFLICT: 'CROSS_BUSINESS_CONFLICT',
});

export const ENVIRONMENT_CLASS = Object.freeze({
  PRODUCTION: 'PRODUCTION',
  SANDBOX: 'SANDBOX',
  CERTIFICATION: 'CERTIFICATION',
  DEVELOPMENT: 'DEVELOPMENT',
  TEST: 'TEST',
  DEMO: 'DEMO',
  TRAINING: 'TRAINING',
  UNKNOWN: 'UNKNOWN',
  CONFLICTING: 'CONFLICTING',
});

/**
 * Resolve Tenant ownership. Never falls back to a default Tenant.
 */
export function resolveTenantOwnership({
  record = {},
  expectedTenantId = null,
  terminalTenantId = null,
  sourceTenantScope = null,
  approvedOwnershipMap = null,
} = {}) {
  const candidates = new Set(
    [record.tenantId, expectedTenantId, terminalTenantId, sourceTenantScope]
      .filter(Boolean)
      .map(String)
  );

  if (approvedOwnershipMap && record.sourceNaturalKey && approvedOwnershipMap[record.sourceNaturalKey]) {
    const mapped = String(approvedOwnershipMap[record.sourceNaturalKey]);
    return {
      outcome: OWNERSHIP_OUTCOME.CONCLUSIVE,
      tenantId: mapped,
      evidence: ['APPROVED_OWNERSHIP_MAP'],
      defaultFallbackUsed: false,
    };
  }

  if (candidates.size === 0) {
    return {
      outcome: OWNERSHIP_OUTCOME.ORPHANED,
      tenantId: null,
      evidence: ['NO_TENANT_EVIDENCE'],
      defaultFallbackUsed: false,
      quarantine: true,
    };
  }

  if (candidates.size > 1) {
    return {
      outcome: OWNERSHIP_OUTCOME.CROSS_TENANT_CONFLICT,
      tenantId: null,
      candidates: [...candidates],
      evidence: ['CONFLICTING_TENANT_IDS'],
      defaultFallbackUsed: false,
      quarantine: true,
      blocked: true,
    };
  }

  const tenantId = [...candidates][0];
  const strength =
    record.tenantId && (terminalTenantId === record.tenantId || !terminalTenantId)
      ? OWNERSHIP_OUTCOME.CONCLUSIVE
      : OWNERSHIP_OUTCOME.STRONG;

  return {
    outcome: strength,
    tenantId,
    evidence: ['SINGLE_CONSISTENT_TENANT'],
    defaultFallbackUsed: false,
  };
}

export function resolveBusinessOwnership({
  record = {},
  expectedBusinessId = null,
  tenantId = null,
} = {}) {
  const candidates = new Set(
    [record.businessId, expectedBusinessId, tenantId /* platform alias only when record.businessId equals tenant */]
      .filter(Boolean)
      .map(String)
  );

  // Name-alone matching is prohibited
  if (!record.businessId && !expectedBusinessId && record.businessName && !tenantId) {
    return {
      outcome: OWNERSHIP_OUTCOME.AMBIGUOUS,
      businessId: null,
      evidence: ['NAME_ALONE_INSUFFICIENT'],
      quarantine: true,
    };
  }

  if (!record.businessId && !expectedBusinessId) {
    if (tenantId && record.tenantId === tenantId) {
      // InsightBooks convention: businessId aliases tenantId — only when tenant proven
      return {
        outcome: OWNERSHIP_OUTCOME.STRONG,
        businessId: tenantId,
        evidence: ['TENANT_BUSINESS_ALIAS_CONVENTION'],
        defaultFallbackUsed: false,
        nameAlone: false,
      };
    }
    return {
      outcome: OWNERSHIP_OUTCOME.ORPHANED,
      businessId: null,
      evidence: ['NO_BUSINESS_EVIDENCE'],
      quarantine: true,
    };
  }

  if (record.businessId && expectedBusinessId && String(record.businessId) !== String(expectedBusinessId)) {
    return {
      outcome: OWNERSHIP_OUTCOME.CROSS_BUSINESS_CONFLICT,
      businessId: null,
      candidates: [record.businessId, expectedBusinessId],
      evidence: ['CONFLICTING_BUSINESS_IDS'],
      quarantine: true,
      blocked: true,
    };
  }

  return {
    outcome: OWNERSHIP_OUTCOME.CONCLUSIVE,
    businessId: String(record.businessId || expectedBusinessId),
    evidence: ['EXPLICIT_BUSINESS_ID'],
    defaultFallbackUsed: false,
  };
}

/**
 * Classify environment. Database name alone is insufficient.
 */
export function classifyEnvironment({
  sourceEnvironmentHint = null,
  recordEnvironment = null,
  endpointHostname = null,
  receiptWording = null,
  databaseName = null,
} = {}) {
  const evidence = [];
  const votes = new Set();

  if (recordEnvironment) {
    votes.add(String(recordEnvironment).toUpperCase());
    evidence.push('RECORD_ENVIRONMENT');
  }
  if (sourceEnvironmentHint) {
    votes.add(String(sourceEnvironmentHint).toUpperCase());
    evidence.push('SOURCE_SYSTEM_HINT');
  }
  if (endpointHostname) {
    const h = endpointHostname.toLowerCase();
    if (h.includes('sandbox') || h.includes('test')) {
      votes.add(ENVIRONMENT_CLASS.SANDBOX);
      evidence.push('ENDPOINT_HOSTNAME');
    } else if (h.includes('prod') || h.includes('mra.gov')) {
      votes.add(ENVIRONMENT_CLASS.PRODUCTION);
      evidence.push('ENDPOINT_HOSTNAME');
    }
  }
  if (receiptWording && /sandbox|test only/i.test(receiptWording)) {
    votes.add(ENVIRONMENT_CLASS.SANDBOX);
    evidence.push('RECEIPT_WORDING');
  }

  // Database name alone must not decide
  if (votes.size === 0 && databaseName) {
    return {
      environment: ENVIRONMENT_CLASS.UNKNOWN,
      evidence: ['DATABASE_NAME_INSUFFICIENT'],
      quarantine: true,
    };
  }

  const normalized = [...votes].filter((v) => ENVIRONMENT_CLASS[v] || v === 'MOCK');
  if (normalized.length === 0) {
    return { environment: ENVIRONMENT_CLASS.UNKNOWN, evidence, quarantine: true };
  }
  if (normalized.length > 1) {
    const prodAndSandbox =
      normalized.includes(ENVIRONMENT_CLASS.PRODUCTION) &&
      (normalized.includes(ENVIRONMENT_CLASS.SANDBOX) || normalized.includes(ENVIRONMENT_CLASS.TEST));
    return {
      environment: ENVIRONMENT_CLASS.CONFLICTING,
      candidates: normalized,
      evidence,
      quarantine: true,
      blocked: prodAndSandbox,
      productionSandboxMixed: Boolean(prodAndSandbox),
    };
  }

  return {
    environment: normalized[0] === 'MOCK' ? ENVIRONMENT_CLASS.SANDBOX : normalized[0],
    evidence,
    quarantine: false,
  };
}
