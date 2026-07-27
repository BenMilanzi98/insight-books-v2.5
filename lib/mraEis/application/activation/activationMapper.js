import { canonicalize } from '../../infrastructure/security/canonicalization.js';
import { EisErrors } from '../../domain/errors.js';

/**
 * Map terminal activation request per verified UnActivatedTerminal contract.
 * Does not invent undocumented fields.
 */
export function mapTerminalActivationRequest({
  terminalActivationCode,
  productId,
  productVersion,
  platformIdentity,
  osName = 'Linux',
  osVersion = 'Server',
  osBuild = null,
  macAddress = null,
  taxpayerTin = null,
  contractVersion = '1',
}) {
  if (!terminalActivationCode || String(terminalActivationCode).length > 50) {
    throw EisErrors.validation({ message: 'Terminal Activation Code format is invalid.' });
  }
  if (!productId || String(productId).length > 50) {
    throw EisErrors.validation({ message: 'Product ID is required.' });
  }
  if (!productVersion || String(productVersion).length > 50) {
    throw EisErrors.validation({ message: 'Product version is required.' });
  }
  if (!platformIdentity) {
    throw EisErrors.validation({ message: 'Stable platform identity is required.' });
  }

  const body = {
    terminalActivationCode: String(terminalActivationCode),
    productID: String(productId),
    productVersion: String(productVersion),
    environment: {
      platform: {
        osName: String(osName).slice(0, 50),
        osVersion: String(osVersion).slice(0, 50),
        ...(osBuild ? { osBuild: String(osBuild).slice(0, 50) } : {}),
        // Prefer approved platform identity; do not invent MAC addresses.
        ...(macAddress ? { macAddress: String(macAddress).slice(0, 17) } : {}),
        platformIdentityReference: String(platformIdentity).slice(0, 128),
      },
    },
    ...(taxpayerTin ? { taxpayerTin: String(taxpayerTin) } : {}),
  };

  const canonical = canonicalize(body, { contractVersion });
  return {
    body,
    canonical,
    contractVersion,
    endpointKey: 'EP-ONB-01',
  };
}

export function mapConfirmationRequest({ terminalId, contractVersion = '1' }) {
  if (!terminalId) throw EisErrors.validation({ message: 'MRA terminalId is required for confirmation.' });
  const body = { terminalId: String(terminalId) };
  const canonical = canonicalize(body, { contractVersion });
  return { body, canonical, contractVersion, endpointKey: 'EP-ONB-02' };
}
