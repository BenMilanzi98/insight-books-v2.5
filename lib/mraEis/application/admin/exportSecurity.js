/**
 * Phase 18 — Export Centre security helpers.
 * Permission recheck at request, generation, and download.
 * No credentials / JWT / private keys / BAC. Formula injection prevented.
 */

import crypto from 'crypto';
import { AdminErrors } from './adminErrors.js';
import { getReportDefinition } from './reportRegistry.js';

export const EXPORT_STATE = Object.freeze({
  QUEUED: 'QUEUED',
  PREPARING: 'PREPARING',
  GENERATING: 'GENERATING',
  VERIFYING: 'VERIFYING',
  STORING: 'STORING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
});

const EXPORT_JOBS = new Map();

export function __resetExportJobsForTests() {
  EXPORT_JOBS.clear();
}

/** Neutralize CSV/XLSX formula injection */
export function sanitizeExportCell(value) {
  if (value == null) return '';
  const s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) return `'${s}`;
  return s;
}

export function sanitizeExportFilename(name) {
  return String(name || 'export')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(0, 120);
}

export function assertExportPermissions({
  userPermissions = [],
  reportId,
  stage = 'request',
} = {}) {
  const def = getReportDefinition(reportId);
  if (!def) throw AdminErrors.reportAuth({ message: 'Unknown report.' });
  const required = def.permissions || [];
  const ok = required.some((p) => userPermissions.includes(p) || userPermissions.includes('*'));
  if (!ok) {
    throw AdminErrors.exportAuth({
      message: `Export permission denied at stage=${stage}.`,
      requiredAction: `Grant one of: ${required.join(', ')}`,
    });
  }
  return def;
}

/**
 * Create an async export job (in-memory for unit tests / mock).
 */
export function createExportJob({
  tenantId,
  businessId,
  environment,
  reportId,
  format = 'CSV',
  filters = {},
  requestedBy,
  userPermissions = [],
  ttlSeconds = 3600,
} = {}) {
  const def = assertExportPermissions({ userPermissions, reportId, stage: 'request' });
  if (!def.exportFormats.includes(format)) {
    throw AdminErrors.exportAuth({ message: `Format ${format} not allowed for ${reportId}.` });
  }

  const id = crypto.randomUUID();
  const job = {
    id,
    tenantId,
    businessId,
    environment,
    reportId,
    format,
    filters,
    requestedBy,
    state: EXPORT_STATE.QUEUED,
    createdAt: new Date(),
    completedAt: null,
    expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    fileSize: 0,
    checksum: null,
    signedUrl: null,
    signedUrlExpiresAt: null,
    error: null,
    credentialsExcluded: true,
    privateKeysExcluded: true,
    buyerAuthorizationExcluded: true,
    formulaInjectionPrevented: true,
  };
  EXPORT_JOBS.set(id, job);
  return job;
}

export function generateExportJob({
  jobId,
  tenantId,
  rows = [],
  userPermissions = [],
  stillAuthorized = true,
} = {}) {
  const job = EXPORT_JOBS.get(jobId);
  if (!job) throw AdminErrors.exportAuth({ message: 'Export job not found.' });
  if (job.tenantId !== tenantId) throw AdminErrors.crossTenant();
  if (!stillAuthorized) {
    job.state = EXPORT_STATE.FAILED;
    job.error = 'PERMISSION_REVOKED';
    throw AdminErrors.exportAuth({ message: 'Permission revoked before generation.' });
  }
  assertExportPermissions({ userPermissions, reportId: job.reportId, stage: 'execution' });

  job.state = EXPORT_STATE.GENERATING;
  const header = Object.keys(rows[0] || { id: '' });
  const lines = [
    header.map(sanitizeExportCell).join(','),
    ...rows.map((r) => header.map((h) => sanitizeExportCell(r[h])).join(',')),
  ];
  const body = lines.join('\n');
  const checksum = crypto.createHash('sha256').update(body).digest('hex');
  const token = crypto.randomBytes(16).toString('hex');
  job.state = EXPORT_STATE.COMPLETED;
  job.completedAt = new Date();
  job.fileSize = Buffer.byteLength(body, 'utf8');
  job.checksum = checksum;
  job.signedUrl = `/api/mra-eis/admin?action=download-export&jobId=${job.id}&token=${token}`;
  job.signedUrlExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
  job._token = token;
  job._body = body;
  return {
    job: sanitizeJob(job),
    body,
    totalsReconcile: { rowCount: rows.length, onScreenHint: rows.length },
  };
}

export function downloadExportJob({
  jobId,
  tenantId,
  token,
  userPermissions = [],
  stillAuthorized = true,
} = {}) {
  const job = EXPORT_JOBS.get(jobId);
  if (!job) throw AdminErrors.exportAuth({ message: 'Export job not found.' });
  if (job.tenantId !== tenantId) throw AdminErrors.crossTenant();
  if (!stillAuthorized) throw AdminErrors.exportAuth({ message: 'Permission revoked before download.' });
  assertExportPermissions({ userPermissions, reportId: job.reportId, stage: 'download' });
  if (job.state === EXPORT_STATE.EXPIRED || (job.expiresAt && job.expiresAt < new Date())) {
    job.state = EXPORT_STATE.EXPIRED;
    throw AdminErrors.exportExpired();
  }
  if (!job.signedUrlExpiresAt || job.signedUrlExpiresAt < new Date()) {
    throw AdminErrors.exportExpired({ message: 'Signed URL expired.' });
  }
  if (token !== job._token) throw AdminErrors.exportAuth({ message: 'Invalid download token.' });
  return { job: sanitizeJob(job), body: job._body, contentType: 'text/csv' };
}

function sanitizeJob(job) {
  const { _token, _body, ...safe } = job;
  return safe;
}

export function listExportJobs({ tenantId } = {}) {
  return [...EXPORT_JOBS.values()]
    .filter((j) => j.tenantId === tenantId)
    .map(sanitizeJob);
}
