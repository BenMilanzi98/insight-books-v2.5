#!/usr/bin/env node
/** Create a sealed Migration Manifest stub (status NOT_STARTED). */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const outDir = path.join(process.cwd(), 'artifacts', 'production-cutover');
fs.mkdirSync(outDir, { recursive: true });

let commit = 'unknown';
try {
  commit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
} catch {
  /* ignore */
}

const migrationRunId = `MR-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
const manifest = {
  migrationRunId,
  releaseVersion: process.env.RELEASE_VERSION || 'unreleased',
  sourceEnvironment: 'UNKNOWN',
  targetEnvironment: 'UNKNOWN',
  sourceCommit: null,
  targetCommit: commit,
  targetSchemaVersion: '20260721200000_security_governance_v2',
  migrationScriptVersion: 'phase18-framework-1',
  migrationScopeVersion: 'DRAFT',
  status: 'NOT_STARTED',
  notes: 'Framework only — production cutover not executed.',
  createdAt: new Date().toISOString(),
};

manifest.checksum = crypto.createHash('sha256').update(JSON.stringify({ ...manifest, checksum: undefined })).digest('hex');

const outFile = path.join(outDir, `manifest-${migrationRunId}.json`);
fs.writeFileSync(outFile, JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(outDir, 'manifest-latest.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ ok: true, migrationRunId, outFile, status: 'NOT_STARTED' }, null, 2));
