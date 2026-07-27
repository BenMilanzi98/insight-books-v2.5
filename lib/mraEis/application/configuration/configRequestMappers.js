import { canonicalize } from '../../infrastructure/security/canonicalization.js';
import { EisErrors } from '../../domain/errors.js';
import { getConfigurationTypeEntry } from './configurationTypeRegistry.js';
import { CONFIGURATION_TYPE } from '../../domain/operationalEnums.js';

function baseValidate({ terminal, configurationType, taxpayerTin }) {
  const entry = getConfigurationTypeEntry(configurationType);
  if (!entry) throw EisErrors.validation({ message: `Unknown configuration type ${configurationType}.` });
  if (!terminal?.mraTerminalId) {
    throw EisErrors.validation({ message: 'MRA terminal ID is required for configuration sync.' });
  }
  if (!terminal.productId || !terminal.productVersion) {
    throw EisErrors.validation({ message: 'Product ID and Product version are required.' });
  }
  return entry;
}

export function mapGlobalConfigurationRequest({ terminal, taxpayerTin = null, currentVersion = null }) {
  const entry = baseValidate({ terminal, configurationType: CONFIGURATION_TYPE.GLOBAL, taxpayerTin });
  const body = {
    terminalId: String(terminal.mraTerminalId),
    productID: String(terminal.productId),
    productVersion: String(terminal.productVersion),
    ...(taxpayerTin ? { taxpayerTin: String(taxpayerTin) } : {}),
    ...(currentVersion ? { currentVersion: String(currentVersion) } : {}),
  };
  const canonical = canonicalize(body, { contractVersion: entry.contractVersion });
  return { body, canonical, endpointKey: entry.endpointKey, path: entry.path, method: entry.method, contractVersion: entry.contractVersion };
}

export function mapTerminalConfigurationRequest({ terminal, taxpayerTin = null, currentVersion = null }) {
  const entry = baseValidate({ terminal, configurationType: CONFIGURATION_TYPE.TERMINAL, taxpayerTin });
  const body = {
    terminalId: String(terminal.mraTerminalId),
    productID: String(terminal.productId),
    productVersion: String(terminal.productVersion),
    ...(currentVersion ? { currentVersion: String(currentVersion) } : {}),
  };
  const canonical = canonicalize(body, { contractVersion: entry.contractVersion });
  return { body, canonical, endpointKey: entry.endpointKey, path: entry.path, method: entry.method, contractVersion: entry.contractVersion };
}

export function mapTaxpayerConfigurationRequest({ terminal, taxpayerTin, currentVersion = null }) {
  const entry = baseValidate({ terminal, configurationType: CONFIGURATION_TYPE.TAXPAYER, taxpayerTin });
  if (!taxpayerTin) throw EisErrors.validation({ message: 'Taxpayer TIN is required for taxpayer configuration.' });
  const body = {
    terminalId: String(terminal.mraTerminalId),
    taxpayerTin: String(taxpayerTin),
    productID: String(terminal.productId),
    productVersion: String(terminal.productVersion),
    ...(currentVersion ? { currentVersion: String(currentVersion) } : {}),
  };
  const canonical = canonicalize(body, { contractVersion: entry.contractVersion });
  return { body, canonical, endpointKey: entry.endpointKey, path: entry.path, method: entry.method, contractVersion: entry.contractVersion };
}
