/**
 * Phase 14 — private, tenant-scoped, immutable receipt artifact storage.
 * No public buckets. Files are never overwritten.
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { FiscalReceiptErrors } from './fiscalReceiptErrors.js';

const ROOT =
  process.env.MRA_EIS_RECEIPT_STORAGE_ROOT ||
  path.join(process.cwd(), 'storage', 'mra-eis', 'fiscal-receipts');

export function buildStorageKey({
  tenantId,
  businessId,
  fiscalReceiptId,
  artifactType,
  originalOrReprint,
  reprintSequence = 0,
  extension,
}) {
  const seq = originalOrReprint === 'REPRINT' ? `r${reprintSequence}` : 'original';
  return path
    .posix.join(
      String(tenantId),
      String(businessId),
      String(fiscalReceiptId),
      `${artifactType.toLowerCase()}-${seq}.${extension}`
    )
    .replace(/\\/g, '/');
}

export async function storeImmutableArtifact({
  tenantId,
  businessId,
  fiscalReceiptId,
  artifactType,
  originalOrReprint = 'ORIGINAL',
  reprintSequence = 0,
  bytes,
  mimeType,
  extension,
}) {
  if (!Buffer.isBuffer(bytes) && typeof bytes !== 'string') {
    throw FiscalReceiptErrors.storage({ message: 'Artifact bytes required' });
  }
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes, 'utf8');
  const storageKey = buildStorageKey({
    tenantId,
    businessId,
    fiscalReceiptId,
    artifactType,
    originalOrReprint,
    reprintSequence,
    extension,
  });
  const abs = path.join(ROOT, ...storageKey.split('/'));
  await fs.mkdir(path.dirname(abs), { recursive: true });

  try {
    await fs.access(abs);
    // Exists — verify checksum match; never overwrite different bytes
    const existing = await fs.readFile(abs);
    const existingChecksum = crypto.createHash('sha256').update(existing).digest('hex');
    const newChecksum = crypto.createHash('sha256').update(buf).digest('hex');
    if (existingChecksum !== newChecksum) {
      throw FiscalReceiptErrors.idempotencyConflict({
        details: { storageKey, reason: 'SAME_KEY_DIFFERENT_BYTES' },
      });
    }
    return {
      storageProvider: 'local-protected',
      storageKey,
      byteLength: existing.length,
      artifactChecksum: existingChecksum,
      artifactChecksumAlgorithm: 'sha256',
      reused: true,
    };
  } catch (err) {
    if (err?.code?.startsWith?.('MRA_EIS_')) throw err;
    // ENOENT — write exclusive
  }

  const fh = await fs.open(abs, 'wx');
  try {
    await fh.writeFile(buf);
  } finally {
    await fh.close();
  }

  return {
    storageProvider: 'local-protected',
    storageKey,
    byteLength: buf.length,
    artifactChecksum: crypto.createHash('sha256').update(buf).digest('hex'),
    artifactChecksumAlgorithm: 'sha256',
    reused: false,
    mimeType,
  };
}

export async function readArtifactBytes({ tenantId, storageKey }) {
  if (!storageKey || storageKey.includes('..') || storageKey.startsWith('/')) {
    throw FiscalReceiptErrors.downloadAuth({ message: 'Invalid storage key' });
  }
  if (!String(storageKey).startsWith(`${tenantId}/`)) {
    throw FiscalReceiptErrors.crossTenant({ details: { reason: 'STORAGE_KEY_TENANT_MISMATCH' } });
  }
  const abs = path.join(ROOT, ...storageKey.split('/'));
  const bytes = await fs.readFile(abs);
  const checksum = crypto.createHash('sha256').update(bytes).digest('hex');
  return { bytes, checksum, byteLength: bytes.length };
}

export function getReceiptStorageRoot() {
  return ROOT;
}
