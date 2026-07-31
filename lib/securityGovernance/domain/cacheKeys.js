/**
 * Tenant-scoped cache key builder — never omit businessId for business data.
 */

export function businessCacheKey({
  businessId,
  resource,
  scopeVersion = '1',
  dataVersion = '1',
  filterKey = '',
  permissionScope = '',
} = {}) {
  if (!businessId) throw new Error('businessId required for business cache keys.');
  if (!resource) throw new Error('resource required for cache keys.');
  return [
    'ib',
    'b',
    String(businessId),
    String(resource),
    `sv${scopeVersion}`,
    `dv${dataVersion}`,
    permissionScope ? `p${permissionScope}` : 'p*',
    filterKey || 'f*',
  ].join(':');
}
