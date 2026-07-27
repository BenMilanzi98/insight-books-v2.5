import { createChecksum } from '../../domain/valueObjects/index.js';
import { EXTERNAL_CATALOGUE_TYPE } from '../../domain/operationalEnums.js';

export const CATALOGUE_PARSER_VERSION = 'phase10-catalogue-parser-v1';

export const CATALOGUE_RESPONSE_OUTCOME = Object.freeze({
  CATALOGUE_RECEIVED: 'CATALOGUE_RECEIVED',
  CATALOGUE_UNCHANGED: 'CATALOGUE_UNCHANGED',
  CATALOGUE_EMPTY_VALID: 'CATALOGUE_EMPTY_VALID',
  PRODUCT_CATALOGUE_NOT_AVAILABLE: 'PRODUCT_CATALOGUE_NOT_AVAILABLE',
  SERVICE_CATALOGUE_NOT_AVAILABLE: 'SERVICE_CATALOGUE_NOT_AVAILABLE',
  TERMINAL_BLOCKED: 'TERMINAL_BLOCKED',
  AUTHENTICATION_FAILURE: 'AUTHENTICATION_FAILURE',
  CONTRACT_MISMATCH: 'CONTRACT_MISMATCH',
  METHOD_REJECTED: 'METHOD_REJECTED',
  VERSION_CONFLICT: 'VERSION_CONFLICT',
  SITE_MISMATCH: 'SITE_MISMATCH',
  TAXPAYER_MISMATCH: 'TAXPAYER_MISMATCH',
  TEMPORARY_MRA_FAILURE: 'TEMPORARY_MRA_FAILURE',
  RATE_LIMITED: 'RATE_LIMITED',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  UNKNOWN_OUTCOME: 'UNKNOWN_OUTCOME',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
});

function toDecimalOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return NaN;
  return n;
}

function normalizeRecord(raw, expectedType) {
  const code = raw?.productCode || raw?.serviceCode || raw?.code || raw?.mraCode;
  const name = raw?.name || raw?.productName || raw?.serviceName;
  if (!code || !name) {
    return { valid: false, reason: 'MISSING_IDENTITY', raw };
  }
  const externalType = String(raw?.type || raw?.externalType || expectedType || 'PRODUCT').toUpperCase();
  if (![EXTERNAL_CATALOGUE_TYPE.PRODUCT, EXTERNAL_CATALOGUE_TYPE.SERVICE].includes(externalType)) {
    return { valid: false, reason: 'INVALID_TYPE', raw };
  }
  // Do not infer type solely from quantity
  const sellingPrice = toDecimalOrNull(raw?.sellingPrice ?? raw?.unitPrice ?? raw?.price);
  const costPrice = toDecimalOrNull(raw?.costPrice);
  const quantity = toDecimalOrNull(raw?.quantity);
  if ([sellingPrice, costPrice, quantity].some((x) => Number.isNaN(x))) {
    return { valid: false, reason: 'INVALID_DECIMAL', raw };
  }
  if (externalType === EXTERNAL_CATALOGUE_TYPE.SERVICE && quantity != null) {
    // Preserve but do not convert Service→Product
  }

  const record = {
    externalType,
    mraCode: String(code),
    barcode: raw?.barcode != null ? String(raw.barcode) : null,
    name: String(name),
    description: raw?.description != null ? String(raw.description) : null,
    unitOfMeasure: raw?.unitOfMeasure || raw?.uom || null,
    costPrice,
    sellingPrice,
    quantity: externalType === EXTERNAL_CATALOGUE_TYPE.SERVICE ? null : quantity,
    externalTaxId: raw?.taxId || raw?.taxRateId || raw?.externalTaxId || null,
    externalLevyId: raw?.levyId || raw?.externalLevyId || null,
    mraSiteId: raw?.siteId || raw?.mraSiteId || null,
    active: raw?.active !== false && String(raw?.status || 'ACTIVE').toUpperCase() !== 'INACTIVE',
    effectiveFrom: raw?.effectiveFrom || null,
    effectiveTo: raw?.effectiveTo || null,
    sourceRecordVersion: raw?.recordVersion || raw?.version || null,
    unknownSafeFields: raw?.extensions || null,
  };
  const checksum = createChecksum(record).value;
  return { valid: true, record: { ...record, recordChecksum: checksum } };
}

/**
 * Strict parser — HTTP 200 alone is not acceptance.
 */
export function parseCatalogueResponse({
  httpStatus,
  body,
  expectedTin = null,
  expectedSiteId = null,
  expectedType = EXTERNAL_CATALOGUE_TYPE.PRODUCT,
}) {
  if (httpStatus === 401 || httpStatus === 403) {
    return {
      accepted: false,
      outcome: CATALOGUE_RESPONSE_OUTCOME.AUTHENTICATION_FAILURE,
      records: [],
      parserVersion: CATALOGUE_PARSER_VERSION,
    };
  }
  if (httpStatus === 429) {
    return {
      accepted: false,
      outcome: CATALOGUE_RESPONSE_OUTCOME.RATE_LIMITED,
      records: [],
      parserVersion: CATALOGUE_PARSER_VERSION,
    };
  }
  if (httpStatus === 405) {
    return {
      accepted: false,
      outcome: CATALOGUE_RESPONSE_OUTCOME.METHOD_REJECTED,
      records: [],
      parserVersion: CATALOGUE_PARSER_VERSION,
    };
  }
  if (httpStatus >= 500) {
    return {
      accepted: false,
      outcome: CATALOGUE_RESPONSE_OUTCOME.TEMPORARY_MRA_FAILURE,
      records: [],
      parserVersion: CATALOGUE_PARSER_VERSION,
    };
  }
  if (httpStatus !== 200 || !body || typeof body !== 'object') {
    return {
      accepted: false,
      outcome: CATALOGUE_RESPONSE_OUTCOME.INVALID_RESPONSE,
      records: [],
      parserVersion: CATALOGUE_PARSER_VERSION,
    };
  }

  if (body.terminalBlocked || body.blockTerminal) {
    return {
      accepted: false,
      outcome: CATALOGUE_RESPONSE_OUTCOME.TERMINAL_BLOCKED,
      records: [],
      parserVersion: CATALOGUE_PARSER_VERSION,
    };
  }

  const statusCode = body.statusCode ?? body.status;
  if (statusCode != null && Number(statusCode) !== 1 && Number(statusCode) !== 200) {
    return {
      accepted: false,
      outcome: CATALOGUE_RESPONSE_OUTCOME.INVALID_RESPONSE,
      records: [],
      remark: body.remark || null,
      parserVersion: CATALOGUE_PARSER_VERSION,
    };
  }

  const data = body.data || body;
  if (expectedTin && data.tin && String(data.tin) !== String(expectedTin)) {
    return {
      accepted: false,
      outcome: CATALOGUE_RESPONSE_OUTCOME.TAXPAYER_MISMATCH,
      records: [],
      parserVersion: CATALOGUE_PARSER_VERSION,
    };
  }
  if (expectedSiteId && data.siteId && String(data.siteId) !== String(expectedSiteId)) {
    return {
      accepted: false,
      outcome: CATALOGUE_RESPONSE_OUTCOME.SITE_MISMATCH,
      records: [],
      parserVersion: CATALOGUE_PARSER_VERSION,
    };
  }

  const version = data.catalogueVersion || data.version || body.version || null;
  if (!version) {
    return {
      accepted: false,
      outcome: CATALOGUE_RESPONSE_OUTCOME.INVALID_RESPONSE,
      records: [],
      reason: 'MISSING_CATALOGUE_VERSION',
      parserVersion: CATALOGUE_PARSER_VERSION,
    };
  }

  if (data.unchanged === true) {
    return {
      accepted: true,
      outcome: CATALOGUE_RESPONSE_OUTCOME.CATALOGUE_UNCHANGED,
      catalogueVersion: version,
      records: [],
      paginationToken: data.paginationToken || null,
      responseChecksum: createChecksum({ version, unchanged: true }).value,
      parserVersion: CATALOGUE_PARSER_VERSION,
    };
  }

  const items = data.products || data.services || data.items || data.catalogue || [];
  if (!Array.isArray(items)) {
    return {
      accepted: false,
      outcome: CATALOGUE_RESPONSE_OUTCOME.INVALID_RESPONSE,
      records: [],
      parserVersion: CATALOGUE_PARSER_VERSION,
    };
  }

  if (items.length === 0 && data.emptyValid === true) {
    return {
      accepted: true,
      outcome: CATALOGUE_RESPONSE_OUTCOME.CATALOGUE_EMPTY_VALID,
      catalogueVersion: version,
      records: [],
      responseChecksum: createChecksum({ version, empty: true }).value,
      parserVersion: CATALOGUE_PARSER_VERSION,
    };
  }

  const records = [];
  const invalid = [];
  for (const item of items) {
    const parsed = normalizeRecord(item, expectedType);
    if (!parsed.valid) invalid.push(parsed);
    else records.push(parsed.record);
  }

  if (invalid.length && !records.length) {
    return {
      accepted: false,
      outcome: CATALOGUE_RESPONSE_OUTCOME.INVALID_RESPONSE,
      records: [],
      invalid,
      parserVersion: CATALOGUE_PARSER_VERSION,
    };
  }

  return {
    accepted: true,
    outcome: CATALOGUE_RESPONSE_OUTCOME.CATALOGUE_RECEIVED,
    catalogueVersion: version,
    records,
    invalid,
    paginationToken: data.paginationToken || null,
    complete: data.complete !== false && !data.paginationToken,
    responseChecksum: createChecksum({ version, records: records.map((r) => r.recordChecksum) }).value,
    parserVersion: CATALOGUE_PARSER_VERSION,
  };
}
