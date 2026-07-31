/**
 * CRM contacts — create / list / get (Phase 11 Wave 1).
 * Contact ≠ Platform User. No national ID / bank / passwords.
 */

import {
  CRM_CONTACT_NUMBER_RE,
  CRM_CONTACT_ROLE,
  CRM_LIST_DEFAULT_LIMIT,
  CRM_LIST_MAX_LIMIT,
  CRM_NUMBER_PREFIX,
} from './catalogue.js';
import { allocateCrmNumber } from './numbering.js';
import { resolveCrmAccess, resolveCrmScope } from './authz.js';
import { hasCrmAccountModel } from './accounts.js';

const CONTACT_ROLE_SET = new Set(Object.values(CRM_CONTACT_ROLE));

export function hasCrmContactModel(prisma) {
  return typeof prisma?.crmContact?.findMany === 'function';
}

function normalizeEmail(email) {
  if (email == null || email === '') return null;
  const v = String(email).trim().toLowerCase();
  return v || null;
}

function normalizePhone(phone) {
  if (phone == null || phone === '') return null;
  const v = String(phone).trim().replace(/[^\d+]/g, '');
  return v || null;
}

function serializeContact(row) {
  if (!row) return null;
  return {
    id: row.id,
    contactNumber: row.contactNumber,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email || null,
    phone: row.phone || null,
    role: row.role || null,
    accountId: row.accountId || null,
    ownerAdminId: row.ownerAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   firstName: string,
 *   lastName: string,
 *   email?: string|null,
 *   phone?: string|null,
 *   role?: string|null,
 *   accountId?: string|null,
 *   ownerAdminId?: string|null,
 *   now?: Date,
 * }} args
 */
export async function createContact(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canCreateContacts) {
    return { ok: false, forbidden: true, reason: 'crm_create_contact_forbidden' };
  }

  const firstName = args.firstName ? String(args.firstName).trim() : '';
  const lastName = args.lastName ? String(args.lastName).trim() : '';
  if (!firstName || !lastName) {
    return { ok: false, error: 'firstName and lastName required' };
  }

  if (!hasCrmContactModel(prisma)) {
    return { ok: false, error: 'crm_contact_model_unavailable', status: 'UNAVAILABLE' };
  }

  let role = null;
  if (args.role) {
    role = String(args.role).trim().toUpperCase();
    if (!CONTACT_ROLE_SET.has(role)) {
      return { ok: false, error: 'invalid_contact_role', role };
    }
  }

  const accountId = args.accountId ? String(args.accountId).trim() : null;
  if (accountId && hasCrmAccountModel(prisma)) {
    try {
      const account = await prisma.crmAccount.findUnique({ where: { id: accountId } });
      if (!account) {
        return { ok: false, error: 'account_not_found', accountId };
      }
    } catch {
      // soft — create still allowed if lookup fails unexpectedly
    }
  }

  const now = args.now || new Date();
  const allocated = await allocateCrmNumber(prisma, {
    prefix: CRM_NUMBER_PREFIX.CON,
    now,
  });
  if (!allocated.ok) {
    return { ok: false, error: allocated.error || 'crm_number_allocation_failed' };
  }

  const row = await prisma.crmContact.create({
    data: {
      contactNumber: allocated.number,
      firstName,
      lastName,
      email: normalizeEmail(args.email),
      phone: normalizePhone(args.phone),
      role,
      accountId,
      ownerAdminId: args.ownerAdminId || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return { ok: true, created: true, contact: serializeContact(row) };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, id: string }} args
 */
export async function getContact(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canViewContacts) {
    return { ok: false, forbidden: true, reason: 'crm_view_contact_forbidden' };
  }

  const id = args.id ? String(args.id).trim() : '';
  if (!id) return { ok: false, error: 'id required' };

  if (!hasCrmContactModel(prisma)) {
    return { ok: false, error: 'crm_contact_model_unavailable', status: 'UNAVAILABLE' };
  }

  let row = null;
  try {
    if (CRM_CONTACT_NUMBER_RE.test(id)) {
      row = await prisma.crmContact.findUnique({ where: { contactNumber: id } });
    } else {
      row = await prisma.crmContact.findUnique({ where: { id } });
    }
    if (!row && typeof prisma.crmContact.findFirst === 'function') {
      row = await prisma.crmContact.findFirst({
        where: { OR: [{ id }, { contactNumber: id }] },
      });
    }
  } catch {
    row = null;
  }

  if (!row) return { ok: false, notFound: true, error: 'contact_not_found' };
  return { ok: true, contact: serializeContact(row) };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   accountId?: string,
 *   limit?: number|string,
 *   offset?: number|string,
 *   cursor?: string,
 * }} args
 */
export async function listContacts(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canViewContacts) {
    return { ok: false, forbidden: true, reason: 'crm_view_contact_forbidden', items: [] };
  }

  if (!hasCrmContactModel(prisma)) {
    return {
      ok: true,
      items: [],
      meta: { unavailable: true, reason: 'crm_contact_model_unavailable' },
    };
  }

  const scope = await resolveCrmScope(prisma, args.admin, 'contacts');
  if (!scope.canView) {
    return { ok: false, forbidden: true, reason: 'crm_view_contact_forbidden', items: [] };
  }

  const where = {};
  if (args.accountId) where.accountId = String(args.accountId);

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
    rows = await prisma.crmContact.findMany(query);
  } catch {
    rows = await prisma.crmContact.findMany({ where, take: limit });
  }

  return {
    ok: true,
    items: (rows || []).map(serializeContact),
    meta: {
      count: (rows || []).length,
      limit,
      offset,
      cursor: args.cursor || null,
      scopeMode: scope.mode,
    },
  };
}

export { serializeContact, normalizeEmail, normalizePhone };
