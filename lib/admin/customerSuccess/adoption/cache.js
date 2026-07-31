/**
 * Adoption cache key contract — Phase 19 Wave 4.
 * Never cache secrets/tokens in broad aggregates.
 */

export const ADOPTION_CACHE_KEYS = Object.freeze({
  overview: 'cs:adoption:overview:v1',
  myWork: 'cs:adoption:my-work:v1',
  report: 'cs:adoption:report:v1',
  recon: 'cs:adoption:recon:v1',
  dq: 'cs:adoption:dq:v1',
  inventZeroCacheForbidden: true,
  secretsForbidden: true,
  tokensForbidden: true,
});

/**
 * Build a scoped cache key including permission/watermark dimensions.
 */
export function buildAdoptionCacheKey(base, dims = {}) {
  const parts = [
    base || ADOPTION_CACHE_KEYS.overview,
    dims.environment || 'local',
    dims.roleProjection || 'default',
    dims.permissionVersion || 'v0',
    dims.watermark || 'none',
    dims.reconVersion || 'none',
  ];
  if (dims.tenantId) parts.push(`t:${dims.tenantId}`);
  if (dims.planId) parts.push(`p:${dims.planId}`);
  return parts.join(':');
}
