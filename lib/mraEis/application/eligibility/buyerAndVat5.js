/**
 * Buyer classification, B2C/B2B readiness, Buyer Authorization readiness, VAT5 readiness — Phase 11.
 * Never persists Buyer Authorization plaintext. TIN format ≠ external validity.
 */

export const BUYER_CLASSIFICATION = Object.freeze({
  ANONYMOUS_B2C: 'ANONYMOUS_B2C',
  IDENTIFIED_B2C: 'IDENTIFIED_B2C',
  B2B: 'B2B',
  GOVERNMENT: 'GOVERNMENT',
  EXPORT_CUSTOMER: 'EXPORT_CUSTOMER',
  VAT5_BUYER: 'VAT5_BUYER',
  OTHER_VERIFIED: 'OTHER_VERIFIED',
  UNKNOWN: 'UNKNOWN',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
});

export const BUYER_AUTH_STATUS = Object.freeze({
  NOT_REQUIRED: 'NOT_REQUIRED',
  REQUIRED_NOT_PROVIDED: 'REQUIRED_NOT_PROVIDED',
  PROVIDED_EPHEMERALLY: 'PROVIDED_EPHEMERALLY',
  EXPIRED: 'EXPIRED',
  SCOPE_MISMATCH: 'SCOPE_MISMATCH',
  VALIDATION_PENDING: 'VALIDATION_PENDING',
  VERIFIED_BY_LATER_WORKFLOW: 'VERIFIED_BY_LATER_WORKFLOW',
  BLOCKED: 'BLOCKED',
});

export const VAT5_READINESS = Object.freeze({
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  READY_FOR_VALIDATION: 'READY_FOR_VALIDATION',
  VALIDATION_REQUIRED: 'VALIDATION_REQUIRED',
  AUTHORIZATION_REQUIRED: 'AUTHORIZATION_REQUIRED',
  INVALID_TAX_TREATMENT: 'INVALID_TAX_TREATMENT',
  CONTRACT_UNVERIFIED: 'CONTRACT_UNVERIFIED',
  BLOCKED: 'BLOCKED',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
});

const MALAWI_TIN_RE = /^[A-Z0-9]{8,15}$/i;

export function classifyBuyer({
  customerId = null,
  customerName = null,
  buyerTin = null,
  customerType = null,
  isVat5 = false,
  isReliefSupply = false,
  isB2BHint = false,
  isGovernment = false,
  isExport = false,
} = {}) {
  if (isVat5 || isReliefSupply) {
    return {
      buyerClassification: BUYER_CLASSIFICATION.VAT5_BUYER,
      reason: 'VAT5_OR_RELIEF_SELECTED',
    };
  }
  if (isGovernment) {
    return { buyerClassification: BUYER_CLASSIFICATION.GOVERNMENT, reason: 'GOVERNMENT_FLAG' };
  }
  if (isExport) {
    return { buyerClassification: BUYER_CLASSIFICATION.EXPORT_CUSTOMER, reason: 'EXPORT_FLAG' };
  }

  const type = String(customerType || '').toUpperCase();
  const tin = buyerTin ? String(buyerTin).trim() : '';
  const name = customerName ? String(customerName).trim() : '';

  // Do not classify B2B solely because a name exists
  if (isB2BHint || type === 'B2B' || type === 'BUSINESS' || type === 'COMPANY') {
    return { buyerClassification: BUYER_CLASSIFICATION.B2B, reason: 'EXPLICIT_B2B' };
  }
  if (tin && (type === 'B2B' || isB2BHint)) {
    return { buyerClassification: BUYER_CLASSIFICATION.B2B, reason: 'TIN_WITH_B2B_TYPE' };
  }
  if (!customerId && (!name || /^walk[- ]?in/i.test(name))) {
    return { buyerClassification: BUYER_CLASSIFICATION.ANONYMOUS_B2C, reason: 'ANONYMOUS' };
  }
  if (customerId || name) {
    return { buyerClassification: BUYER_CLASSIFICATION.IDENTIFIED_B2C, reason: 'IDENTIFIED_CUSTOMER' };
  }
  return { buyerClassification: BUYER_CLASSIFICATION.UNKNOWN, reason: 'INSUFFICIENT_DATA' };
}

export function evaluateB2cBuyerRequirements({ buyerClassification }) {
  const anonymous = buyerClassification === BUYER_CLASSIFICATION.ANONYMOUS_B2C;
  return {
    ready: true,
    buyerNameOptional: true,
    buyerTinOptional: true,
    phoneOptional: true,
    addressOptional: true,
    genericCustomerAllowed: true,
    cashAnonymousAllowed: anonymous || buyerClassification === BUYER_CLASSIFICATION.IDENTIFIED_B2C,
    blockers: [],
    warnings: anonymous ? ['ANONYMOUS_B2C'] : [],
    readinessVersion: 'phase11-b2c-v1',
  };
}

export function evaluateB2bBuyerReadiness({
  buyerClassification,
  buyerId = null,
  buyerLegalName = null,
  buyerTin = null,
  buyerAddress = null,
  buyerAuthorizationRequired = false,
  buyerAuthorizationStatus = BUYER_AUTH_STATUS.NOT_REQUIRED,
} = {}) {
  const blockers = [];
  const warnings = [];
  const isB2b =
    buyerClassification === BUYER_CLASSIFICATION.B2B ||
    buyerClassification === BUYER_CLASSIFICATION.GOVERNMENT ||
    buyerClassification === BUYER_CLASSIFICATION.VAT5_BUYER;

  if (!isB2b) {
    return {
      ready: true,
      buyerClassification,
      buyerId,
      buyerTinPresent: Boolean(buyerTin),
      buyerTinFormatValid: buyerTin ? MALAWI_TIN_RE.test(String(buyerTin).trim()) : false,
      buyerTinValidationStatus: 'NOT_REQUIRED',
      buyerAuthorizationRequired: false,
      buyerAuthorizationStatus: BUYER_AUTH_STATUS.NOT_REQUIRED,
      blockers,
      warnings,
      readinessVersion: 'phase11-b2b-v1',
    };
  }

  if (!buyerId && !buyerLegalName) blockers.push('BUYER_LEGAL_NAME_REQUIRED');
  const tinPresent = Boolean(buyerTin && String(buyerTin).trim());
  if (!tinPresent) blockers.push('BUYER_TIN_REQUIRED');
  const tinFormatValid = tinPresent && MALAWI_TIN_RE.test(String(buyerTin).trim());
  if (tinPresent && !tinFormatValid) blockers.push('BUYER_TIN_FORMAT_INVALID');
  if (tinFormatValid) {
    warnings.push('TIN_FORMAT_ONLY_NOT_EXTERNALLY_VALIDATED');
  }
  if (!buyerAddress) warnings.push('BUYER_ADDRESS_MISSING_OPTIONAL');

  if (buyerAuthorizationRequired) {
    if (buyerAuthorizationStatus === BUYER_AUTH_STATUS.REQUIRED_NOT_PROVIDED) {
      blockers.push('BUYER_AUTHORIZATION_REQUIRED_NOT_PROVIDED');
    }
    if (buyerAuthorizationStatus === BUYER_AUTH_STATUS.EXPIRED) {
      blockers.push('BUYER_AUTHORIZATION_EXPIRED');
    }
    if (buyerAuthorizationStatus === BUYER_AUTH_STATUS.SCOPE_MISMATCH) {
      blockers.push('BUYER_AUTHORIZATION_SCOPE_MISMATCH');
    }
  }

  return {
    ready: blockers.length === 0,
    buyerClassification,
    buyerId,
    buyerTinPresent: tinPresent,
    buyerTinFormatValid: tinFormatValid,
    buyerTinValidationStatus: tinFormatValid ? 'FORMAT_ONLY' : tinPresent ? 'INVALID_FORMAT' : 'MISSING',
    buyerAuthorizationRequired,
    buyerAuthorizationStatus,
    blockers,
    warnings,
    readinessVersion: 'phase11-b2b-v1',
  };
}

/**
 * Buyer Authorization readiness — metadata only. Never accepts/stores plaintext code in bridge.
 */
export function evaluateBuyerAuthorizationReadiness({
  required = false,
  ephemeralProvided = false,
  expired = false,
  scopeMismatch = false,
} = {}) {
  if (!required) {
    return {
      status: BUYER_AUTH_STATUS.NOT_REQUIRED,
      ready: true,
      blockers: [],
      warnings: [],
      readinessVersion: 'phase11-buyer-auth-v1',
    };
  }
  if (expired) {
    return {
      status: BUYER_AUTH_STATUS.EXPIRED,
      ready: false,
      blockers: ['BUYER_AUTHORIZATION_EXPIRED'],
      warnings: [],
      readinessVersion: 'phase11-buyer-auth-v1',
    };
  }
  if (scopeMismatch) {
    return {
      status: BUYER_AUTH_STATUS.SCOPE_MISMATCH,
      ready: false,
      blockers: ['BUYER_AUTHORIZATION_SCOPE_MISMATCH'],
      warnings: [],
      readinessVersion: 'phase11-buyer-auth-v1',
    };
  }
  if (!ephemeralProvided) {
    return {
      status: BUYER_AUTH_STATUS.REQUIRED_NOT_PROVIDED,
      ready: false,
      blockers: ['BUYER_AUTHORIZATION_REQUIRED_NOT_PROVIDED'],
      warnings: [],
      readinessVersion: 'phase11-buyer-auth-v1',
    };
  }
  return {
    status: BUYER_AUTH_STATUS.PROVIDED_EPHEMERALLY,
    ready: true,
    blockers: [],
    warnings: ['BUYER_AUTHORIZATION_LIVE_VALIDATION_DEFERRED'],
    readinessVersion: 'phase11-buyer-auth-v1',
  };
}

/**
 * VAT5 readiness without live MRA call. Never treat as ordinary zero-rated.
 */
export function evaluateVat5SaleReadiness({
  isVat5 = false,
  isReliefSupply = false,
  buyerTinPresent = false,
  buyerAuthorizationReady = false,
  taxTreatmentCompatible = true,
} = {}) {
  if (!isVat5 && !isReliefSupply) {
    return {
      outcome: VAT5_READINESS.NOT_APPLICABLE,
      ready: true,
      blockers: [],
      warnings: [],
      readinessVersion: 'phase11-vat5-v1',
      treatedAsOrdinaryZeroRated: false,
    };
  }

  const blockers = [];
  const warnings = [];
  if (!taxTreatmentCompatible) blockers.push('INVALID_TAX_TREATMENT');
  if (!buyerTinPresent) blockers.push('VAT5_BUYER_TIN_REQUIRED');
  if (!buyerAuthorizationReady) blockers.push('VAT5_AUTHORIZATION_REQUIRED');
  blockers.push('VAT5_RUNTIME_VALIDATION_REQUIRED');
  warnings.push('VAT5_NOT_ORDINARY_ZERO_RATED');

  return {
    outcome: blockers.length
      ? VAT5_READINESS.VALIDATION_REQUIRED
      : VAT5_READINESS.READY_FOR_VALIDATION,
    ready: false, // Phase 11: never fully ELIGIBLE without live validation
    blockers,
    warnings,
    readinessVersion: 'phase11-vat5-v1',
    treatedAsOrdinaryZeroRated: false,
    contractStatus: 'REQUIRES_MRA_CLARIFICATION',
  };
}
