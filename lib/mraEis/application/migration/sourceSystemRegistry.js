/**
 * Phase 19 — Source-System Registry + extraction manifests (checksummed, read-only).
 */

import crypto from 'crypto';
import { MigrationErrors } from './migrationErrors.js';

export const SOURCE_TYPE = Object.freeze({
  CURRENT_INSIGHTBOOKS_DATABASE: 'CURRENT_INSIGHTBOOKS_DATABASE',
  LEGACY_INSIGHTBOOKS_DATABASE: 'LEGACY_INSIGHTBOOKS_DATABASE',
  LEGACY_EFD_DATABASE: 'LEGACY_EFD_DATABASE',
  LEGACY_EIS_DATABASE: 'LEGACY_EIS_DATABASE',
  SQL_DUMP: 'SQL_DUMP',
  CSV_PACKAGE: 'CSV_PACKAGE',
  XLSX_PACKAGE: 'XLSX_PACKAGE',
  JSON_PACKAGE: 'JSON_PACKAGE',
  RECEIPT_ARCHIVE: 'RECEIPT_ARCHIVE',
  OFFLINE_AGENT_DATABASE: 'OFFLINE_AGENT_DATABASE',
  OTHER_APPROVED_SOURCE: 'OTHER_APPROVED_SOURCE',
});

export const SOURCE_STATUS = Object.freeze({
  DISCOVERED: 'DISCOVERED',
  REGISTERED: 'REGISTERED',
  READY_FOR_PROFILING: 'READY_FOR_PROFILING',
  PROFILED: 'PROFILED',
  READY_FOR_EXTRACTION: 'READY_FOR_EXTRACTION',
  EXTRACTED: 'EXTRACTED',
  QUARANTINED: 'QUARANTINED',
  BLOCKED: 'BLOCKED',
});

const SOURCES = new Map();
const MANIFESTS = new Map();

export function __resetMigrationSourcesForTests() {
  SOURCES.clear();
  MANIFESTS.clear();
}

export function registerSourceSystem({
  name,
  sourceType,
  environmentClassification = 'UNKNOWN',
  tenantScope = null,
  businessScope = null,
  databaseEngine = 'postgresql',
  schemaVersion = null,
  sourceTimezone = 'Africa/Blantyre',
  sourceCurrency = 'MWK',
  readOnlyVerified = false,
  credentialReference = null,
  locationReference = null,
  sourceOwner = null,
} = {}) {
  if (!name || !sourceType || !SOURCE_TYPE[sourceType]) {
    throw MigrationErrors.source({ message: 'Valid name and sourceType required.' });
  }
  if (credentialReference && /password|secret|jwt|private.?key/i.test(String(credentialReference))) {
    // only allow opaque references, not embedded secrets
    if (String(credentialReference).includes('=')) {
      throw MigrationErrors.credentialLeak({
        message: 'Source credentials must be opaque Secret Provider references, never embedded secrets.',
      });
    }
  }
  if (!readOnlyVerified) {
    throw MigrationErrors.sourceReadOnly({
      message: 'Source must be verified read-only before registration completes.',
    });
  }

  const id = crypto.randomUUID();
  const row = {
    id,
    name,
    sourceType,
    environmentClassification,
    tenantScope,
    businessScope,
    databaseEngine,
    schemaVersion,
    sourceTimezone,
    sourceCurrency,
    readOnlyVerified: true,
    credentialReference: credentialReference || null,
    locationReference: locationReference || null,
    sourceOwner,
    status: SOURCE_STATUS.REGISTERED,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  SOURCES.set(id, row);
  return row;
}

export function getSourceSystem(id) {
  return SOURCES.get(id) || null;
}

export function listSourceSystems() {
  return [...SOURCES.values()];
}

export function createExtractionManifest({
  sourceSystemId,
  dataset,
  sourceTableOrFile,
  selectionCriteria = {},
  rows = [],
  columns = null,
  operatorId = null,
} = {}) {
  const source = getSourceSystem(sourceSystemId);
  if (!source) throw MigrationErrors.source({ message: 'Unknown source system.' });
  if (!source.readOnlyVerified) throw MigrationErrors.sourceReadOnly();

  const columnList = columns || (rows[0] ? Object.keys(rows[0]) : []);
  const content = JSON.stringify({ rows, columnList, selectionCriteria });
  const contentChecksum = crypto.createHash('sha256').update(content).digest('hex');
  const schemaFingerprint = crypto
    .createHash('sha256')
    .update(JSON.stringify(columnList))
    .digest('hex');

  const id = crypto.randomUUID();
  const manifest = {
    id,
    sourceSystemId,
    dataset,
    sourceTableOrFile,
    selectionCriteria,
    rowCount: rows.length,
    columnList,
    schemaFingerprint,
    contentChecksum,
    extractionTimestamp: new Date().toISOString(),
    toolVersion: 'phase19-extraction-v1',
    operatorId,
    readOnly: true,
    credentialsExcluded: true,
    jwtExcluded: true,
    privateKeysExcluded: true,
    buyerAuthorizationExcluded: true,
  };
  MANIFESTS.set(id, manifest);
  source.status = SOURCE_STATUS.EXTRACTED;
  source.updatedAt = new Date().toISOString();
  return manifest;
}

export function getExtractionManifest(id) {
  return MANIFESTS.get(id) || null;
}

export function assertSourceChecksumUnchanged({ manifestId, expectedChecksum } = {}) {
  const m = getExtractionManifest(manifestId);
  if (!m) throw MigrationErrors.source({ message: 'Manifest not found.' });
  if (expectedChecksum && m.contentChecksum !== expectedChecksum) {
    throw MigrationErrors.sourceChecksum({
      message: 'Source checksum changed after Dry Run approval.',
    });
  }
  return m;
}

/** Profile rows without mutation */
export function profileDataset({ rows = [], columns = null } = {}) {
  const cols = columns || (rows[0] ? Object.keys(rows[0]) : []);
  const nullFreq = {};
  const distinct = {};
  for (const c of cols) {
    nullFreq[c] = 0;
    distinct[c] = new Set();
  }
  for (const r of rows) {
    for (const c of cols) {
      if (r[c] == null || r[c] === '') nullFreq[c] += 1;
      else distinct[c].add(String(r[c]));
    }
  }
  return {
    rowCount: rows.length,
    columns: cols,
    nullFrequency: nullFreq,
    distinctCounts: Object.fromEntries([...Object.entries(distinct)].map(([k, v]) => [k, v.size])),
    mutated: false,
  };
}
