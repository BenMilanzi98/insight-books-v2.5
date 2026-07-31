/**
 * Private commercial artifact storage (non-public, non-enumerable) — Phase 15 Wave 3.
 * Filesystem under data/crm-commercial-artifacts, with in-memory adapter for tests.
 */

import { createHash, randomBytes } from 'crypto';
import { mkdir, writeFile, readFile, access } from 'fs/promises';
import path from 'path';

const memoryStore = new Map();

function defaultRoot() {
  return (
    process.env.CRM_COMMERCIAL_ARTIFACT_ROOT ||
    path.join(process.cwd(), 'data', 'crm-commercial-artifacts')
  );
}

export function createMemoryStorageAdapter(seed = new Map()) {
  const store = seed instanceof Map ? seed : new Map(Object.entries(seed || {}));
  return {
    kind: 'memory',
    async put(key, buffer) {
      store.set(String(key), Buffer.from(buffer));
      return { key: String(key), byteLength: Buffer.byteLength(buffer) };
    },
    async get(key) {
      const buf = store.get(String(key));
      return buf ? Buffer.from(buf) : null;
    },
    async exists(key) {
      return store.has(String(key));
    },
    _store: store,
  };
}

export function createFilesystemStorageAdapter(rootDir = defaultRoot()) {
  return {
    kind: 'filesystem',
    rootDir,
    async put(key, buffer) {
      const safe = String(key).replace(/[^a-zA-Z0-9._/-]/g, '_');
      const full = path.join(rootDir, safe);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, Buffer.from(buffer));
      return { key: safe, byteLength: Buffer.byteLength(buffer) };
    },
    async get(key) {
      const safe = String(key).replace(/[^a-zA-Z0-9._/-]/g, '_');
      const full = path.join(rootDir, safe);
      try {
        await access(full);
        return await readFile(full);
      } catch {
        return null;
      }
    },
    async exists(key) {
      const safe = String(key).replace(/[^a-zA-Z0-9._/-]/g, '_');
      const full = path.join(rootDir, safe);
      try {
        await access(full);
        return true;
      } catch {
        return false;
      }
    },
  };
}

let defaultAdapter = null;

export function getCommercialStorageAdapter(override) {
  if (override) return override;
  if (process.env.CRM_COMMERCIAL_STORAGE === 'memory' || process.env.VITEST) {
    if (!defaultAdapter || defaultAdapter.kind !== 'memory') {
      defaultAdapter = createMemoryStorageAdapter(memoryStore);
    }
    return defaultAdapter;
  }
  if (!defaultAdapter || defaultAdapter.kind !== 'filesystem') {
    defaultAdapter = createFilesystemStorageAdapter();
  }
  return defaultAdapter;
}

/** Private storage key — not a public URL. */
export function buildPrivateArtifactKey({ versionId, projection, artifactId }) {
  const salt = randomBytes(8).toString('hex');
  const hash = createHash('sha256')
    .update(`${versionId}:${projection}:${artifactId}:${salt}`)
    .digest('hex')
    .slice(0, 24);
  return `private/${versionId}/${projection}/${artifactId}-${hash}.pdf`;
}

export function resetCommercialStorageForTests() {
  memoryStore.clear();
  defaultAdapter = null;
}
