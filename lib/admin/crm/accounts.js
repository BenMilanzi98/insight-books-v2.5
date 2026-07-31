/**
 * CRM accounts — create / list / get (Phase 11 Wave 1).
 * CRM Account ≠ canonical Customer (link fields OK; no billing copy).
 */

import {
  CRM_ACCOUNT_NUMBER_RE,
  CRM_ACCOUNT_STATUS,
  CRM_ACCOUNT_TYPE,
  CRM_LIST_DEFAULT_LIMIT,
  CRM_LIST_MAX_LIMIT,
  CRM_NUMBER_PREFIX,
} from './catalogue.js';
import { allocateCrmNumber } from './numbering.js';
import { resolveCrmAccess, resolveCrmScope } from './authz.js';

const ACCOUNT_TYPE_SET = new Set(Object.values(CRM_ACCOUNT_TYPE));
const ACCOUNT_STATUS_SET = new Set(Object.values(CRM_ACCOUNT_STATUS));

export function hasCrmAccountModel(prisma) {
  return typeof prisma?.crmAccount?.findMany === 'function';
}

function serializeAccount(row) {
  if (!row) return null;
  return {
    id: row.id,
    accountNumber: row.accountNumber,
    type: row.type || CRM_ACCOUNT_TYPE.PROSPECT,
    displayName: row.displayName,
    status: row.status || CRM_ACCOUNT_STATUS.ACTIVE,
    country: row.country || null,
    region: row.region || null,
    ownerAdminId: row.ownerAdminId || null,
    customerId: row.customerId || null,
    tenantId: row.tenantId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   displayName: string,
 *   type?: string,
 *   status?: string,
 *   country?: string|null,
 *   region?: string|null,
 *   ownerAdminId?: string|null,
 *   customerId?: string|null,
 *   tenantId?: string|null,
 *   now?: Date,
 * }} args
 */
export async function createAccount(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canCreateAccounts) {
    return { ok: false, forbidden: true, reason: 'crm_create_account_forbidden' };
  }

  const displayName = args.displayName ? String(args.displayName).trim() : '';
  if (!displayName) {
    return { ok: false, error: 'displayName required' };
  }

  if (!hasCrmAccountModel(prisma)) {
    return { ok: false, error: 'crm_account_model_unavailable', status: 'UNAVAILABLE' };
  }

  const type = args.type
    ? String(args.type).trim().toUpperCase()
    : CRM_ACCOUNT_TYPE.PROSPECT;
  if (!ACCOUNT_TYPE_SET.has(type)) {
    return { ok: false, error: 'invalid_account_type', type };
  }

  const status = args.status
    ? String(args.status).trim().toUpperCase()
    : CRM_ACCOUNT_STATUS.ACTIVE;
  if (!ACCOUNT_STATUS_SET.has(status)) {
    return { ok: false, error: 'invalid_account_status', status };
  }

  const now = args.now || new Date();
  const allocated = await allocateCrmNumber(prisma, {
    prefix: CRM_NUMBER_PREFIX.ACC,
    now,
  });
  if (!allocated.ok) {
    return { ok: false, error: allocated.error || 'crm_number_allocation_failed' };
  }

  const row = await prisma.crmAccount.create({
    data: {
      accountNumber: allocated.number,
      type,
      displayName,
      status,
      country: args.country ? String(args.country).trim() : null,
      region: args.region ? String(args.region).trim() : null,
      ownerAdminId: args.ownerAdminId || null,
      customerId: args.customerId || null,
      tenantId: args.tenantId || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return { ok: true, created: true, account: serializeAccount(row) };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, id: string }} args
 */
export async function getAccount(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canViewAccounts) {
    return { ok: false, forbidden: true, reason: 'crm_view_account_forbidden' };
  }

  const id = args.id ? String(args.id).trim() : '';
  if (!id) return { ok: false, error: 'id required' };

  if (!hasCrmAccountModel(prisma)) {
    return { ok: false, error: 'crm_account_model_unavailable', status: 'UNAVAILABLE' };
  }

  let row = null;
  try {
    if (CRM_ACCOUNT_NUMBER_RE.test(id)) {
      row = await prisma.crmAccount.findUnique({ where: { accountNumber: id } });
    } else {
      row = await prisma.crmAccount.findUnique({ where: { id } });
    }
    if (!row && typeof prisma.crmAccount.findFirst === 'function') {
      row = await prisma.crmAccount.findFirst({
        where: { OR: [{ id }, { accountNumber: id }] },
      });
    }
  } catch {
    row = null;
  }

  if (!row) return { ok: false, notFound: true, error: 'account_not_found' };
  return { ok: true, account: serializeAccount(row) };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   status?: string,
 *   limit?: number|string,
 *   offset?: number|string,
 *   cursor?: string,
 * }} args
 */
export async function listAccounts(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canViewAccounts) {
    return { ok: false, forbidden: true, reason: 'crm_view_account_forbidden', items: [] };
  }

  if (!hasCrmAccountModel(prisma)) {
    return {
      ok: true,
      items: [],
      meta: { unavailable: true, reason: 'crm_account_model_unavailable' },
    };
  }

  const scope = await resolveCrmScope(prisma, args.admin, 'accounts');
  if (!scope.canView) {
    return { ok: false, forbidden: true, reason: 'crm_view_account_forbidden', items: [] };
  }

  const where = {};
  if (args.status) where.status = String(args.status).toUpperCase();

  const rawLimit = Number(args.limit);
  const limit = Math.min(
    CRM_LIST_MAX_LIMIT,
    Math.max(1, Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : CRM_LIST_DEFAULT_LIMIT)
  );
  const rawOffset = Number(args.offset);
  const offset =
    Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;

  const query = {
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  };
  if (args.cursor) {
    query.cursor = { id: String(args.cursor) };
    query.skip = 1;
  } else if (offset > 0) {
    query.skip = offset;
  }

  let rows = [];
  try {
    rows = await prisma.crmAccount.findMany(query);
  } catch {
    rows = await prisma.crmAccount.findMany({ where, take: limit });
  }

  return {
    ok: true,
    items: (rows || []).map(serializeAccount),
    meta: {
      count: (rows || []).length,
      limit,
      offset,
      cursor: args.cursor || null,
      scopeMode: scope.mode,
    },
  };
}

export { serializeAccount };
