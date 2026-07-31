/**
 * Commercial render artifacts + checksum persistence — Phase 15 Wave 3.
 * Artifacts are append-only: regenerate creates a new row (never silent replace).
 */

import { CRM_CHECKSUM_ALGORITHM, sha256Hex } from './checksum.js';
import { buildPrivateArtifactKey, getCommercialStorageAdapter } from './storage.js';

export function hasCrmCommercialArtifactModel(prisma) {
  return typeof prisma?.crmCommercialArtifact?.create === 'function';
}

export function hasCrmCommercialChecksumModel(prisma) {
  return typeof prisma?.crmCommercialChecksum?.create === 'function';
}

export function hasCrmCommercialRenderJobModel(prisma) {
  return typeof prisma?.crmCommercialRenderJob?.create === 'function';
}

export function serializeArtifact(row, extras = {}) {
  if (!row) return null;
  return {
    id: row.id,
    versionId: row.versionId || row.documentVersionId || null,
    documentVersionId: row.documentVersionId || row.versionId || null,
    projection: row.projection,
    contentType: row.contentType || 'application/pdf',
    storageKey: row.storageKey,
    byteLength: row.byteLength ?? null,
    renderJobId: row.renderJobId || null,
    idempotencyKey: row.idempotencyKey || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    ...extras,
  };
}

export function serializeChecksum(row) {
  if (!row) return null;
  return {
    id: row.id,
    artifactId: row.artifactId,
    algorithm: row.algorithm || CRM_CHECKSUM_ALGORITHM,
    sha256: row.sha256 || row.value || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  };
}

export async function persistArtifactWithChecksum(prisma, args = {}) {
  if (!hasCrmCommercialArtifactModel(prisma) || !hasCrmCommercialChecksumModel(prisma)) {
    return {
      ok: false,
      error: 'crm_commercial_artifact_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const buffer = Buffer.isBuffer(args.buffer) ? args.buffer : Buffer.from(args.buffer || []);
  const sha256 = sha256Hex(buffer);
  const now = args.now || new Date();
  const versionId = args.versionId || args.documentVersionId;
  const projection = String(args.projection || 'ISSUED').toUpperCase();
  const storage = getCommercialStorageAdapter(args.storage);

  // Pre-allocate id-like key for storage path stability within this create
  const provisionalId = args.artifactId || `art-${sha256.slice(0, 12)}-${Date.now()}`;
  const storageKey =
    args.storageKey ||
    buildPrivateArtifactKey({
      versionId,
      projection,
      artifactId: provisionalId,
    });

  await storage.put(storageKey, buffer);

  const artifact = await prisma.crmCommercialArtifact.create({
    data: {
      versionId,
      documentVersionId: versionId,
      projection,
      contentType: args.contentType || 'application/pdf',
      storageKey,
      byteLength: buffer.byteLength,
      renderJobId: args.renderJobId || null,
      idempotencyKey: args.idempotencyKey || null,
      htmlSource: args.htmlSource || null,
      createdByAdminId: args.createdByAdminId || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  const checksum = await prisma.crmCommercialChecksum.create({
    data: {
      artifactId: artifact.id,
      algorithm: CRM_CHECKSUM_ALGORITHM,
      sha256,
      value: sha256,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    artifact: serializeArtifact(artifact, {
      buffer,
      byteLength: buffer.byteLength,
    }),
    checksum: serializeChecksum(checksum),
  };
}

export async function loadArtifactChecksum(prisma, artifactId) {
  if (!hasCrmCommercialChecksumModel(prisma)) return null;
  try {
    return await prisma.crmCommercialChecksum.findFirst({
      where: { artifactId, algorithm: CRM_CHECKSUM_ALGORITHM },
      orderBy: { createdAt: 'desc' },
    });
  } catch {
    try {
      return await prisma.crmCommercialChecksum.findUnique({
        where: { artifactId_algorithm: { artifactId, algorithm: CRM_CHECKSUM_ALGORITHM } },
      });
    } catch {
      return null;
    }
  }
}
