/**
 * Onboarding cache key contract — Phase 17 Wave 4.
 * Never cache migration files, credentials, or Contact PII in broad aggregates.
 */

export const ONBOARDING_CACHE_KEYS = Object.freeze({
  overview: 'cs:onboarding:overview:v1',
  myWork: 'cs:onboarding:my-work:v1',
  report: 'cs:onboarding:report:v1',
  recon: 'cs:onboarding:recon:v1',
  dq: 'cs:onboarding:dq:v1',
  inventZeroCacheForbidden: true,
  migrationFilesForbidden: true,
  credentialsForbidden: true,
  contactPiiInAggregatesForbidden: true,
});

/**
 * Build a scoped cache key including permission/watermark dimensions.
 */
export function buildOnboardingCacheKey(base, dims = {}) {
  const parts = [
    base || ONBOARDING_CACHE_KEYS.overview,
    dims.environment || 'local',
    dims.roleProjection || 'default',
    dims.permissionVersion || 'v0',
    dims.watermark || 'none',
    dims.reconVersion || 'none',
  ];
  if (dims.tenantId) parts.push(`t:${dims.tenantId}`);
  if (dims.projectId) parts.push(`p:${dims.projectId}`);
  return parts.join(':');
}
