import { CONFIGURATION_TYPE } from '../../domain/operationalEnums.js';

/**
 * Canonical MRA configuration type registry.
 * Request-hash remains REQUIRES_MRA_CLARIFICATION (Q-010/Q-011) — fail closed outside MOCK.
 */
export const CRYPTO_CONTRACT_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  VERIFIED_IN_SANDBOX: 'VERIFIED_IN_SANDBOX',
  PROVISIONAL: 'PROVISIONAL',
  CONFLICTING_DOCUMENTATION: 'CONFLICTING_DOCUMENTATION',
  REQUIRES_MRA_CLARIFICATION: 'REQUIRES_MRA_CLARIFICATION',
  BLOCKED: 'BLOCKED',
});

export const MraConfigurationTypeRegistry = Object.freeze({
  [CONFIGURATION_TYPE.GLOBAL]: {
    configurationType: CONFIGURATION_TYPE.GLOBAL,
    endpointKey: 'EP-CFG-01',
    path: '/api/v1/configuration/global',
    method: 'GET',
    contractVersion: '1',
    requiredForActivation: true,
    requiredForFiscalization: true,
    synchronizationOrder: 1,
    parserVersion: 'phase8-global-parser-v1',
    validatorVersion: 'phase8-global-validator-v1',
    extractorVersion: 'phase8-global-extractor-v1',
    stalenessPolicy: 'MRA_INTERVAL_OR_SAFE_24H',
    retryPolicy: 'SAFE_READ_RETRY',
    requestHashRequired: true,
    requestHashContractStatus: CRYPTO_CONTRACT_STATUS.REQUIRES_MRA_CLARIFICATION,
    contractStatus: CRYPTO_CONTRACT_STATUS.PROVISIONAL,
  },
  [CONFIGURATION_TYPE.TERMINAL]: {
    configurationType: CONFIGURATION_TYPE.TERMINAL,
    endpointKey: 'EP-CFG-02',
    path: '/api/v1/configuration/terminal',
    method: 'GET',
    contractVersion: '1',
    requiredForActivation: true,
    requiredForFiscalization: true,
    synchronizationOrder: 2,
    parserVersion: 'phase8-terminal-parser-v1',
    validatorVersion: 'phase8-terminal-validator-v1',
    extractorVersion: 'phase8-terminal-extractor-v1',
    stalenessPolicy: 'MRA_INTERVAL_OR_SAFE_24H',
    retryPolicy: 'SAFE_READ_RETRY',
    requestHashRequired: true,
    requestHashContractStatus: CRYPTO_CONTRACT_STATUS.REQUIRES_MRA_CLARIFICATION,
    contractStatus: CRYPTO_CONTRACT_STATUS.PROVISIONAL,
  },
  [CONFIGURATION_TYPE.TAXPAYER]: {
    configurationType: CONFIGURATION_TYPE.TAXPAYER,
    endpointKey: 'EP-CFG-03',
    path: '/api/v1/configuration/taxpayer',
    method: 'GET',
    contractVersion: '1',
    requiredForActivation: true,
    requiredForFiscalization: true,
    synchronizationOrder: 3,
    parserVersion: 'phase8-taxpayer-parser-v1',
    validatorVersion: 'phase8-taxpayer-validator-v1',
    extractorVersion: 'phase8-taxpayer-extractor-v1',
    stalenessPolicy: 'MRA_INTERVAL_OR_SAFE_24H',
    retryPolicy: 'SAFE_READ_RETRY',
    requestHashRequired: true,
    requestHashContractStatus: CRYPTO_CONTRACT_STATUS.REQUIRES_MRA_CLARIFICATION,
    contractStatus: CRYPTO_CONTRACT_STATUS.PROVISIONAL,
  },
});

export const CONFIGURATION_SYNC_ORDER = Object.freeze([
  CONFIGURATION_TYPE.GLOBAL,
  CONFIGURATION_TYPE.TERMINAL,
  CONFIGURATION_TYPE.TAXPAYER,
]);

export function getConfigurationTypeEntry(type) {
  return MraConfigurationTypeRegistry[type] || null;
}

export function listRequiredConfigurationTypes() {
  return CONFIGURATION_SYNC_ORDER.filter(
    (t) => MraConfigurationTypeRegistry[t].requiredForFiscalization
  );
}
