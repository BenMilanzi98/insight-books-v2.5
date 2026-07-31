/**
 * In-memory / JSON legacy ID map for migration batches.
 * Durable storage should persist to DB or artifacts during real cutover.
 */

export function createLegacyMappingRecord({
  migrationRunId,
  businessId,
  entityType,
  legacySystem = 'legacy',
  legacyId,
  targetId,
  sourceChecksum = null,
  targetChecksum = null,
  migrationBatchId = null,
  status = 'MAPPED',
  notes = null,
} = {}) {
  if (!migrationRunId || !entityType || legacyId == null || targetId == null) {
    throw new Error('legacy mapping requires migrationRunId, entityType, legacyId, targetId');
  }
  return {
    migrationRunId,
    businessId: businessId || null,
    entityType,
    legacySystem,
    legacyId: String(legacyId),
    targetId: String(targetId),
    sourceChecksum,
    targetChecksum,
    migratedAt: new Date().toISOString(),
    migrationBatchId,
    status,
    notes,
  };
}

/**
 * Detect duplicate legacy→target collisions.
 */
export function detectMappingConflicts(records = []) {
  const byLegacy = new Map();
  const conflicts = [];
  for (const r of records) {
    const key = `${r.entityType}|${r.legacySystem}|${r.legacyId}|${r.businessId || '*'}`;
    if (byLegacy.has(key) && byLegacy.get(key) !== r.targetId) {
      conflicts.push({ key, existing: byLegacy.get(key), incoming: r.targetId });
    } else {
      byLegacy.set(key, r.targetId);
    }
  }
  return conflicts;
}
