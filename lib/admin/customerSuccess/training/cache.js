/**
 * Training cache key contract — Phase 18 Wave 4.
 * Never cache answers, tokens, or restricted materials in broad aggregates.
 */

export const TRAINING_CACHE_KEYS = Object.freeze({
  overview: 'cs:training:overview:v1',
  myWork: 'cs:training:my-work:v1',
  report: 'cs:training:report:v1',
  recon: 'cs:training:recon:v1',
  dq: 'cs:training:dq:v1',
  inventZeroCacheForbidden: true,
  answersForbidden: true,
  tokensForbidden: true,
  restrictedMaterialsForbidden: true,
});

/**
 * Build a scoped cache key including permission/watermark dimensions.
 */
export function buildTrainingCacheKey(base, dims = {}) {
  const parts = [
    base || TRAINING_CACHE_KEYS.overview,
    dims.environment || 'local',
    dims.roleProjection || 'default',
    dims.permissionVersion || 'v0',
    dims.watermark || 'none',
    dims.reconVersion || 'none',
  ];
  if (dims.tenantId) parts.push(`t:${dims.tenantId}`);
  if (dims.programId) parts.push(`p:${dims.programId}`);
  return parts.join(':');
}
