/**
 * Phase 17 — Restriction Source / Reason / Scope / Precedence registries.
 * Not a single Boolean. Multiple restrictions coexist; most restrictive wins.
 */

export const RESTRICTION_CONTRACT_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  PROVISIONAL_SANDBOX_ONLY: 'PROVISIONAL_SANDBOX_ONLY',
  REQUIRES_MRA_CLARIFICATION: 'REQUIRES_MRA_CLARIFICATION',
  BLOCKED: 'BLOCKED',
});

export const RESTRICTION_SOURCE = Object.freeze({
  MRA_SALES_RESPONSE: 'MRA_SALES_RESPONSE',
  MRA_CONFIGURATION_RESPONSE: 'MRA_CONFIGURATION_RESPONSE',
  MRA_TERMINAL_STATUS_QUERY: 'MRA_TERMINAL_STATUS_QUERY',
  MRA_UNBLOCK_STATUS_QUERY: 'MRA_UNBLOCK_STATUS_QUERY',
  PLATFORM_EMERGENCY_CONTROL: 'PLATFORM_EMERGENCY_CONTROL',
  SYSTEM_ADMINISTRATOR: 'SYSTEM_ADMINISTRATOR',
  TENANT_ENTITLEMENT: 'TENANT_ENTITLEMENT',
  TENANT_PARTICIPATION: 'TENANT_PARTICIPATION',
  BUSINESS_OPERATIONAL_CONTROL: 'BUSINESS_OPERATIONAL_CONTROL',
  CERTIFICATION_CONTROL: 'CERTIFICATION_CONTROL',
  CREDENTIAL_HEALTH: 'CREDENTIAL_HEALTH',
  CONFIGURATION_HEALTH: 'CONFIGURATION_HEALTH',
  SITE_MAPPING_CONTROL: 'SITE_MAPPING_CONTROL',
  FISCAL_SEQUENCE_CONTROL: 'FISCAL_SEQUENCE_CONTROL',
  TRANSMISSION_RECONCILIATION: 'TRANSMISSION_RECONCILIATION',
  OFFLINE_QUEUE_INTEGRITY: 'OFFLINE_QUEUE_INTEGRITY',
  TRUSTED_AGENT_CONTROL: 'TRUSTED_AGENT_CONTROL',
  DEVICE_TRUST_CONTROL: 'DEVICE_TRUST_CONTROL',
  SECURITY_INCIDENT: 'SECURITY_INCIDENT',
  AUDIT_HOLD: 'AUDIT_HOLD',
  MAINTENANCE_CONTROL: 'MAINTENANCE_CONTROL',
});

export const RESTRICTION_SCOPE = Object.freeze({
  PLATFORM: 'PLATFORM',
  ENVIRONMENT: 'ENVIRONMENT',
  TENANT: 'TENANT',
  BUSINESS: 'BUSINESS',
  BRANCH: 'BRANCH',
  MRA_SITE: 'MRA_SITE',
  TERMINAL: 'TERMINAL',
  TRUSTED_AGENT: 'TRUSTED_AGENT',
  DEVICE: 'DEVICE',
  CERTIFICATION: 'CERTIFICATION',
  CREDENTIAL: 'CREDENTIAL',
  CONFIGURATION_PACKAGE: 'CONFIGURATION_PACKAGE',
  FISCAL_SEQUENCE: 'FISCAL_SEQUENCE',
  OFFLINE_QUEUE_PARTITION: 'OFFLINE_QUEUE_PARTITION',
  TRANSMISSION: 'TRANSMISSION',
});

export const RESTRICTION_STATE = Object.freeze({
  DETECTED: 'DETECTED',
  ACTIVE: 'ACTIVE',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  REMEDIATION_PENDING: 'REMEDIATION_PENDING',
  UNBLOCK_REQUEST_PENDING: 'UNBLOCK_REQUEST_PENDING',
  CLEARANCE_PENDING_VERIFICATION: 'CLEARANCE_PENDING_VERIFICATION',
  CLEARED: 'CLEARED',
  EXPIRED: 'EXPIRED',
  SUPERSEDED: 'SUPERSEDED',
  REJECTED_CLEARANCE: 'REJECTED_CLEARANCE',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
});

export const RESTRICTION_REASON = Object.freeze({
  MRA_TERMINAL_BLOCKED: {
    code: 'MRA_TERMINAL_BLOCKED',
    severity: 'CRITICAL',
    clearAuthority: 'MRA',
    autoExpire: false,
    safeText: 'This MRA terminal is currently blocked. New fiscal Sales cannot be completed.',
  },
  MRA_SITE_RESTRICTED: {
    code: 'MRA_SITE_RESTRICTED',
    severity: 'CRITICAL',
    clearAuthority: 'MRA',
    autoExpire: false,
    safeText: 'The MRA Site is restricted.',
  },
  PLATFORM_EMERGENCY_PAUSE: {
    code: 'PLATFORM_EMERGENCY_PAUSE',
    severity: 'CRITICAL',
    clearAuthority: 'PLATFORM',
    autoExpire: false,
    safeText: 'Platform emergency pause is active for this environment.',
  },
  TENANT_ENTITLEMENT_SUSPENDED: {
    code: 'TENANT_ENTITLEMENT_SUSPENDED',
    severity: 'HIGH',
    clearAuthority: 'PLATFORM',
    autoExpire: false,
    safeText: 'Tenant EIS entitlement is suspended.',
  },
  BUSINESS_EIS_PAUSED: {
    code: 'BUSINESS_EIS_PAUSED',
    severity: 'HIGH',
    clearAuthority: 'TENANT_OR_BUSINESS',
    autoExpire: false,
    safeText: 'Business EIS operations are paused.',
  },
  CERTIFICATION_EXPIRED: {
    code: 'CERTIFICATION_EXPIRED',
    severity: 'HIGH',
    clearAuthority: 'CERTIFICATION',
    autoExpire: false,
    safeText: 'Certification has expired.',
  },
  TERMINAL_CREDENTIAL_REVOKED: {
    code: 'TERMINAL_CREDENTIAL_REVOKED',
    severity: 'HIGH',
    clearAuthority: 'CREDENTIAL',
    autoExpire: false,
    safeText: 'Terminal credentials are revoked or invalid.',
  },
  TERMINAL_CONFIGURATION_STALE: {
    code: 'TERMINAL_CONFIGURATION_STALE',
    severity: 'HIGH',
    clearAuthority: 'CONFIGURATION',
    autoExpire: false,
    safeText: 'Configuration must be refreshed before MRA Sales can continue.',
  },
  FISCAL_SEQUENCE_CONFLICT: {
    code: 'FISCAL_SEQUENCE_CONFLICT',
    severity: 'CRITICAL',
    clearAuthority: 'SEQUENCE',
    autoExpire: false,
    safeText: 'The fiscal-number sequence requires reconciliation.',
  },
  UNKNOWN_OUTCOME_SAFETY_HOLD: {
    code: 'UNKNOWN_OUTCOME_SAFETY_HOLD',
    severity: 'HIGH',
    clearAuthority: 'RECONCILIATION',
    autoExpire: false,
    safeText: 'Unknown transmission outcomes must be reconciled before retry.',
  },
  OFFLINE_QUEUE_INTEGRITY_FAILURE: {
    code: 'OFFLINE_QUEUE_INTEGRITY_FAILURE',
    severity: 'CRITICAL',
    clearAuthority: 'QUEUE',
    autoExpire: false,
    safeText: 'Offline queue integrity failed. Upload and new offline Sales are stopped.',
  },
  OFFLINE_AGENT_SUSPENDED: {
    code: 'OFFLINE_AGENT_SUSPENDED',
    severity: 'HIGH',
    clearAuthority: 'AGENT',
    autoExpire: false,
    safeText: 'Offline Sales are unavailable because the registered agent is restricted.',
  },
  OFFLINE_DEVICE_COMPROMISED: {
    code: 'OFFLINE_DEVICE_COMPROMISED',
    severity: 'CRITICAL',
    clearAuthority: 'SECURITY',
    autoExpire: false,
    safeText: 'Device compromise detected. Offline signing is blocked.',
  },
  SECURITY_INCIDENT: {
    code: 'SECURITY_INCIDENT',
    severity: 'CRITICAL',
    clearAuthority: 'SECURITY',
    autoExpire: false,
    safeText: 'A security incident restricts EIS operations.',
  },
  MAINTENANCE: {
    code: 'MAINTENANCE',
    severity: 'MEDIUM',
    clearAuthority: 'PLATFORM',
    autoExpire: true,
    safeText: 'EIS is in maintenance.',
  },
});

/** Lower number = higher priority */
export const PRECEDENCE_ORDER = Object.freeze([
  'SECURITY_INCIDENT',
  'OFFLINE_DEVICE_COMPROMISED',
  'PLATFORM_EMERGENCY_PAUSE',
  'MRA_TERMINAL_BLOCKED',
  'MRA_SITE_RESTRICTED',
  'CERTIFICATION_EXPIRED',
  'TENANT_ENTITLEMENT_SUSPENDED',
  'FISCAL_SEQUENCE_CONFLICT',
  'OFFLINE_QUEUE_INTEGRITY_FAILURE',
  'TERMINAL_CREDENTIAL_REVOKED',
  'TERMINAL_CONFIGURATION_STALE',
  'BUSINESS_EIS_PAUSED',
  'OFFLINE_AGENT_SUSPENDED',
  'UNKNOWN_OUTCOME_SAFETY_HOLD',
  'MAINTENANCE',
]);

export function getReasonMeta(reasonCode) {
  return (
    RESTRICTION_REASON[reasonCode] || {
      code: reasonCode,
      severity: 'HIGH',
      clearAuthority: 'MANUAL_REVIEW',
      autoExpire: false,
      safeText: 'EIS fiscalization is currently restricted.',
    }
  );
}

export function pickPrimaryRestriction(restrictions = []) {
  const active = restrictions.filter((r) =>
    ['ACTIVE', 'ACKNOWLEDGED', 'REMEDIATION_PENDING', 'UNBLOCK_REQUEST_PENDING', 'CLEARANCE_PENDING_VERIFICATION'].includes(
      r.state
    )
  );
  if (!active.length) return { primary: null, secondary: [] };
  const sorted = [...active].sort((a, b) => {
    const ia = PRECEDENCE_ORDER.indexOf(a.reasonCode);
    const ib = PRECEDENCE_ORDER.indexOf(b.reasonCode);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
  return { primary: sorted[0], secondary: sorted.slice(1) };
}

export function getRestrictionSourceRegistry() {
  return {
    [RESTRICTION_SOURCE.MRA_SALES_RESPONSE]: {
      clearableBy: ['MRA'],
      tenantCannotClear: true,
      autoClearForbidden: true,
    },
    [RESTRICTION_SOURCE.PLATFORM_EMERGENCY_CONTROL]: {
      clearableBy: ['PLATFORM'],
      tenantCannotClear: true,
    },
    [RESTRICTION_SOURCE.TENANT_ENTITLEMENT]: {
      clearableBy: ['PLATFORM'],
      tenantCannotClear: true,
    },
    [RESTRICTION_SOURCE.BUSINESS_OPERATIONAL_CONTROL]: {
      clearableBy: ['TENANT_OR_BUSINESS', 'PLATFORM'],
      tenantCannotClear: false,
    },
    [RESTRICTION_SOURCE.SECURITY_INCIDENT]: {
      clearableBy: ['SECURITY'],
      tenantCannotClear: true,
      autoClearForbidden: true,
    },
  };
}

export function getMraBlockUnblockContractDecision() {
  return {
    blockFromSalesResponse: RESTRICTION_CONTRACT_STATUS.PROVISIONAL_SANDBOX_ONLY,
    blockFromConfiguration: RESTRICTION_CONTRACT_STATUS.PROVISIONAL_SANDBOX_ONLY,
    unblockStatusMock: RESTRICTION_CONTRACT_STATUS.PROVISIONAL_SANDBOX_ONLY,
    unblockStatusLiveSandbox: RESTRICTION_CONTRACT_STATUS.BLOCKED,
    unblockStatusProduction: RESTRICTION_CONTRACT_STATUS.BLOCKED,
    unblockRequestSubmissionProduction: RESTRICTION_CONTRACT_STATUS.BLOCKED,
    httpSuccessInsufficientForClearance: true,
    tenantCannotClearMra: true,
    directActiveForbidden: true,
    note: 'Production unblock calls remain disabled until MRA contract verified. Mock status query only.',
  };
}
