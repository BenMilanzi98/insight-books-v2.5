import { getActivationEndpointConfig } from './environmentConfig.js';
import { mockGetConfiguration } from './mockMraConfigurationServer.js';
import { ACTIVATION_MODE, CONFIGURATION_TYPE } from '../../domain/operationalEnums.js';
import { getConfigurationTypeEntry } from '../../application/configuration/configurationTypeRegistry.js';
import { redactSecrets } from '../security/redaction.js';
import { EisErrors } from '../../domain/errors.js';

/**
 * Server-only configuration retrieval client.
 * Safe-read retry is caller-controlled; this client does not auto-retry.
 */
async function fetchConfiguration({ environment, configurationType, requestBody, requestId, scenario }) {
  const cfg = getActivationEndpointConfig(environment);
  const entry = getConfigurationTypeEntry(configurationType);
  if (!entry) throw EisErrors.validation({ message: `Unknown configuration type ${configurationType}` });

  if (cfg.mode === ACTIVATION_MODE.MOCK) {
    return mockGetConfiguration(configurationType, requestBody, { scenario });
  }

  if (cfg.mode === ACTIVATION_MODE.PRODUCTION) {
    const err = new Error('Production MRA configuration sync is blocked until Phase 8 production gates pass.');
    err.code = 'PRODUCTION_CONFIG_SYNC_BLOCKED';
    throw err;
  }

  // Non-mock: request hash contract unverified — fail closed (caller readiness should already block)
  const err = new Error('Configuration request hashing is unverified (Q-010/Q-011); non-mock sync blocked.');
  err.code = 'REQUEST_HASH_CONTRACT_UNVERIFIED';
  throw err;
}

export function getGlobalConfiguration(args) {
  return fetchConfiguration({ ...args, configurationType: CONFIGURATION_TYPE.GLOBAL });
}

export function getTerminalConfiguration(args) {
  return fetchConfiguration({ ...args, configurationType: CONFIGURATION_TYPE.TERMINAL });
}

export function getTaxpayerConfiguration(args) {
  return fetchConfiguration({ ...args, configurationType: CONFIGURATION_TYPE.TAXPAYER });
}

export { redactSecrets };
