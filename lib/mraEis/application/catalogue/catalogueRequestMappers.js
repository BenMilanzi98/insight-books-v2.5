import crypto from 'crypto';
import { createChecksum } from '../../domain/valueObjects/index.js';

export const CATALOGUE_REQUEST_MAPPER_VERSION = 'phase10-catalogue-request-mapper-v1';

/**
 * Product catalogue request — verified fields only. Server-side.
 * Does not include local Inventory quantities.
 */
export function mapProductCatalogueRequest({
  terminal,
  taxpayerTin,
  mraSiteId,
  currentCatalogueVersion = null,
  paginationToken = null,
  environment = 'SANDBOX',
}) {
  if (!terminal?.mraTerminalId && !terminal?.id) {
    throw Object.assign(new Error('Terminal identity required for catalogue request.'), {
      code: 'TERMINAL_REQUIRED',
    });
  }
  if (!mraSiteId) {
    throw Object.assign(new Error('MRA Site ID required for site-scoped catalogue request.'), {
      code: 'SITE_REQUIRED',
    });
  }

  const body = {
    terminalId: terminal.mraTerminalId || terminal.id,
    tin: taxpayerTin,
    siteId: mraSiteId,
    productId: terminal.productId || process.env.MRA_EIS_CERTIFIED_PRODUCT_ID || 'IB-EIS-MOCK',
    productVersion: terminal.productVersion || '0.0.0-mock',
    currentVersion: currentCatalogueVersion || undefined,
    paginationToken: paginationToken || undefined,
    environment: String(environment).toUpperCase(),
    externalType: 'PRODUCT',
  };

  const canonical = createChecksum(body);
  return {
    endpointKey: 'EP-UTL-08',
    method: 'POST',
    body,
    canonical,
    requestChecksum: canonical.value,
    mapperVersion: CATALOGUE_REQUEST_MAPPER_VERSION,
    includesLocalInventory: false,
  };
}

export function mapServiceCatalogueRequest(input) {
  const mapped = mapProductCatalogueRequest(input);
  mapped.body.externalType = 'SERVICE';
  mapped.endpointKey = 'EP-UTL-08-SERVICE';
  mapped.canonical = createChecksum(mapped.body);
  mapped.requestChecksum = mapped.canonical.value;
  return mapped;
}

export function mapCombinedCatalogueRequest(input) {
  const mapped = mapProductCatalogueRequest(input);
  mapped.body.externalType = 'COMBINED';
  mapped.endpointKey = 'EP-UTL-08-COMBINED';
  mapped.canonical = createChecksum(mapped.body);
  mapped.requestChecksum = mapped.canonical.value;
  return mapped;
}

/** Hash placeholder — production hash remains fail-closed outside MOCK */
export function catalogueRequestHashPlaceholder(requestChecksum) {
  return crypto.createHash('sha256').update(`MOCK-CATALOGUE-HASH:${requestChecksum}`).digest('hex');
}
