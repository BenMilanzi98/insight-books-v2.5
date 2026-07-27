/**
 * Phase 18 — Saved views (do not grant permissions).
 */

import crypto from 'crypto';

const VIEWS = new Map();

export function __resetSavedViewsForTests() {
  VIEWS.clear();
}

export const VIEW_VISIBILITY = Object.freeze({
  PRIVATE: 'PRIVATE',
  ROLE: 'ROLE',
  BUSINESS: 'BUSINESS',
  TENANT: 'TENANT',
  PLATFORM: 'PLATFORM',
});

export function createSavedView({
  ownerId,
  tenantId,
  businessId = null,
  name,
  section,
  filters = {},
  sorting = null,
  columns = null,
  environment = 'SANDBOX',
  visibility = VIEW_VISIBILITY.PRIVATE,
} = {}) {
  const id = crypto.randomUUID();
  const view = {
    id,
    ownerId,
    tenantId,
    businessId,
    name,
    section,
    filters,
    sorting,
    columns,
    environment,
    visibility,
    version: 1,
    grantsPermissions: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  VIEWS.set(id, view);
  return view;
}

/**
 * Open a saved view — revalidate scope; strip unauthorized filters.
 */
export function openSavedView({
  viewId,
  context,
  allowedFilterKeys = null,
} = {}) {
  const view = VIEWS.get(viewId);
  if (!view) return { ok: false, reason: 'NOT_FOUND' };
  if (view.tenantId !== context.tenantId && !context.isPlatformAdmin) {
    return { ok: false, reason: 'CROSS_TENANT' };
  }

  let filters = { ...view.filters };
  if (allowedFilterKeys) {
    filters = Object.fromEntries(
      Object.entries(filters).filter(([k]) => allowedFilterKeys.includes(k))
    );
  }
  // Never allow a saved view to inject foreign tenantId
  delete filters.tenantId;
  filters.tenantId = context.tenantId;
  if (context.businessId) filters.businessId = context.businessId;

  return {
    ok: true,
    view: {
      ...view,
      filters,
      grantsPermissions: false,
      revalidatedAt: new Date().toISOString(),
    },
  };
}
