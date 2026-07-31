/**
 * Migration Manifest helpers — file-based evidence under artifacts/production-cutover/
 */

import crypto from 'crypto';

export function createMigrationManifest(partial = {}) {
  const migrationRunId =
    partial.migrationRunId || `MR-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
  return {
    migrationRunId,
    releaseVersion: partial.releaseVersion || process.env.RELEASE_VERSION || 'unreleased',
    sourceEnvironment: partial.sourceEnvironment || 'UNKNOWN',
    targetEnvironment: partial.targetEnvironment || 'UNKNOWN',
    sourceCommit: partial.sourceCommit || null,
    targetCommit: partial.targetCommit || null,
    sourceSchemaVersion: partial.sourceSchemaVersion || null,
    targetSchemaVersion: partial.targetSchemaVersion || '20260721200000_security_governance_v2',
    databaseVersion: partial.databaseVersion || null,
    migrationScriptVersion: partial.migrationScriptVersion || 'phase18-framework-1',
    migrationScopeVersion: partial.migrationScopeVersion || 'DRAFT',
    startedAt: partial.startedAt || null,
    completedAt: partial.completedAt || null,
    status: partial.status || 'NOT_STARTED',
    initiatedBy: partial.initiatedBy || null,
    approvedBy: partial.approvedBy || null,
    backupReference: partial.backupReference || null,
    restoreVerificationReference: partial.restoreVerificationReference || null,
    notes: partial.notes || 'Framework manifest — production cutover not executed.',
    createdAt: new Date().toISOString(),
  };
}

export function checksumPayload(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

export function sealManifest(manifest) {
  const { checksum: _omit, ...rest } = manifest;
  return { ...rest, checksum: checksumPayload(rest) };
}
