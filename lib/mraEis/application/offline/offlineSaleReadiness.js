/**
 * Phase 16 — Offline Sale readiness (fail closed).
 */

import { evaluateEffectiveOfflineCapability } from './effectiveOfflineCapability.js';
import { evaluateOfflineLimits } from './offlineLimits.js';
import { evaluateClockTrust } from './clockIntegrity.js';
import { CONNECTIVITY_STATE } from '../../domain/operationalEnums.js';

export function evaluateOfflineSaleReadiness({
  capabilityInput = {},
  connectivityState = CONNECTIVITY_STATE.ONLINE_STABLE,
  limitInput = {},
  clockInput = {},
  proposedSale = {},
  vat5Requested = false,
  creditSale = false,
  splitPayment = false,
  productOfflineEligible = true,
  serviceOfflineEligible = true,
  taxMappingsComplete = true,
  levyMappingsComplete = true,
  paymentMappingsComplete = true,
  currencySupported = true,
  buyerDataComplete = true,
} = {}) {
  const capability = evaluateEffectiveOfflineCapability(capabilityInput);
  const limits = evaluateOfflineLimits(limitInput);
  const clock = evaluateClockTrust(clockInput);

  const blockers = [];
  const warnings = [];

  if (!capability.offlineEntryAllowed && connectivityState !== CONNECTIVITY_STATE.OFFLINE_ACTIVE) {
    // For sale readiness while already offline-active, capability must still hold
  }
  if (
    ![CONNECTIVITY_STATE.OFFLINE_ACTIVE, CONNECTIVITY_STATE.OFFLINE_CONFIRMED].includes(
      connectivityState
    )
  ) {
    blockers.push('OFFLINE_MODE_NOT_ACTIVE');
  }
  if (!capability.certificationValid) blockers.push('OFFLINE_CERTIFICATION_INVALID');
  if (capability.terminalBlocked) blockers.push('TERMINAL_BLOCKED');
  if (!capability.agentTrusted && capability.mode !== 'MOCK') blockers.push('AGENT_NOT_TRUSTED');
  if (!capability.configurationFresh && capability.mode !== 'MOCK') blockers.push('CONFIGURATION_STALE');
  if (!productOfflineEligible) blockers.push('PRODUCT_NOT_OFFLINE_ELIGIBLE');
  if (!serviceOfflineEligible) blockers.push('SERVICE_NOT_OFFLINE_ELIGIBLE');
  if (!taxMappingsComplete) blockers.push('TAX_MAPPING_MISSING');
  if (!levyMappingsComplete) blockers.push('LEVY_MAPPING_MISSING');
  if (!paymentMappingsComplete) blockers.push('PAYMENT_MAPPING_MISSING');
  if (!currencySupported) blockers.push('CURRENCY_NOT_SUPPORTED');
  if (!buyerDataComplete) blockers.push('BUYER_DATA_INCOMPLETE');
  if (vat5Requested) blockers.push('VAT5_OFFLINE_UNVERIFIED');
  if (creditSale) blockers.push('CREDIT_SALE_OFFLINE_UNVERIFIED');
  if (splitPayment) blockers.push('SPLIT_PAYMENT_OFFLINE_UNVERIFIED');
  if (!clock.allowsOfflineSale) blockers.push('CLOCK_UNTRUSTED');
  if (!limits.allowed) blockers.push(...limits.blockers);

  for (const b of capability.blockers) {
    if (!blockers.includes(b)) blockers.push(b);
  }
  warnings.push(...limits.warnings, ...clock.warnings);

  // Mock: if capability allows entry and connectivity is offline-active, relax unverified feature blocks only when not requested
  const saleAllowed = blockers.length === 0;

  return {
    offlineModeActive: [CONNECTIVITY_STATE.OFFLINE_ACTIVE, CONNECTIVITY_STATE.OFFLINE_CONFIRMED].includes(
      connectivityState
    ),
    capabilityValid: capability.offlineEntryAllowed,
    certificationValid: capability.certificationValid,
    agentTrusted: capability.deviceTrusted || capability.mode === 'MOCK',
    terminalValid: capability.terminalAllowed,
    configurationFresh: capability.configurationFresh,
    mappingsComplete: taxMappingsComplete && levyMappingsComplete && paymentMappingsComplete,
    ProductServiceEligible: productOfflineEligible && serviceOfflineEligible,
    taxMappingsComplete,
    levyMappingsComplete,
    paymentMappingsComplete,
    currencySupported,
    buyerDataComplete,
    VAT5AllowedOffline: false,
    creditSaleAllowedOffline: false,
    splitPaymentAllowedOffline: false,
    sequenceAvailable: capability.sequenceAvailable,
    limitsAvailable: true,
    durationLimitValid: !limits.blockers.includes('OFFLINE_DURATION_EXCEEDED'),
    countLimitValid: !limits.blockers.includes('OFFLINE_COUNT_EXCEEDED'),
    amountLimitValid: !limits.blockers.includes('OFFLINE_AMOUNT_EXCEEDED'),
    queueLimitValid: !limits.blockers.includes('OFFLINE_QUEUE_FULL'),
    ageLimitValid: !limits.blockers.includes('OFFLINE_ITEM_AGE_EXCEEDED'),
    clockTrusted: clock.allowsOfflineSale,
    localStorageHealthy: capability.storageHealthy,
    SaleAllowed: saleAllowed,
    blockers,
    warnings,
    requiredActions: capability.requiredActions,
    remainingLimits: limits.remaining,
    proposedSaleGross: proposedSale.grossTotal || null,
    readinessVersion: 'offline-sale-readiness-v1',
    cashierCannotForce: true,
  };
}
