/**
 * Support handoffs — link-only records.
 * Never mutates AccountSubscription, Tenant GL, MRA fiscal, or CsCase status.
 */

import {
  SUPPORT_HANDOFF_STATUS,
  SUPPORT_HANDOFF_TARGET,
  SUPPORT_HANDOFF_TARGETS,
} from './catalogue.js';
import { resolveSupportAccess } from './authz.js';
import { findSupportTicket } from './ticketLookup.js';
import { getProductFeature } from '@/lib/admin/productCatalogue/features.js';

const FORBIDDEN_PAYLOAD_KEYS = Object.freeze([
  'credentials',
  'password',
  'secret',
  'apiKey',
  'api_key',
  'token',
  'rawPayload',
  'rawMraPayload',
  'mraPayload',
  'paymentSecret',
  'cardNumber',
  'glLines',
  'tenantGl',
]);

export function hasSupportHandoffModel(prisma) {
  return typeof prisma?.supportHandoff?.findMany === 'function';
}

function serializeHandoff(row) {
  if (!row) return null;
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : null;
  return {
    id: row.id,
    ticketId: row.ticketId,
    tenantId: row.tenantId,
    targetType: row.targetType,
    status: row.status,
    summary: row.summary || null,
    // Generic link ref only — typed Finance/Billing ids live on invoiceId / subscriptionId.
    targetRefId: row.targetRefId || null,
    invoiceId: payload?.invoiceId || null,
    subscriptionId: payload?.subscriptionId || null,
    featureCode: row.featureCode || null,
    payload,
    createdByAdminId: row.createdByAdminId || null,
    recordOnly: true,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

/**
 * Strip forbidden keys; keep id-only link fields per target.
 * @param {string} targetType
 * @param {object|null|undefined} payload
 */
export function sanitizeHandoffPayload(targetType, payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }
  const out = {};
  for (const [key, value] of Object.entries(payload)) {
    const k = String(key);
    if (FORBIDDEN_PAYLOAD_KEYS.some((f) => k.toLowerCase().includes(f.toLowerCase()))) {
      continue;
    }
    if (value != null && typeof value === 'object') continue;
    out[k] = value;
  }

  const t = String(targetType || '').toUpperCase();
  if (t === SUPPORT_HANDOFF_TARGET.CS) {
    const allowed = ['ticketId', 'tenantId', 'csCaseId', 'summary'];
    return pickKeys(out, allowed);
  }
  if (t === SUPPORT_HANDOFF_TARGET.PRODUCT) {
    return pickKeys(out, ['ticketId', 'tenantId', 'featureCode', 'summary']);
  }
  if (t === SUPPORT_HANDOFF_TARGET.FINANCE || t === SUPPORT_HANDOFF_TARGET.BILLING) {
    return pickKeys(out, [
      'ticketId',
      'tenantId',
      'invoiceId',
      'subscriptionId',
      'summary',
    ]);
  }
  if (t === SUPPORT_HANDOFF_TARGET.MRA) {
    return pickKeys(out, [
      'ticketId',
      'tenantId',
      'transmissionId',
      'fiscalTransmissionId',
      'fiscalDocumentId',
      'summary',
    ]);
  }
  return out;
}

function pickKeys(obj, keys) {
  const out = {};
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== '') out[k] = obj[k];
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Create a link-only handoff. Does not touch CsCase / billing / MRA / GL.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   ticketId: string,
 *   targetType: string,
 *   summary?: string,
 *   targetRefId?: string,
 *   invoiceId?: string,
 *   subscriptionId?: string,
 *   featureCode?: string,
 *   payload?: object,
 *   status?: string,
 * }} args
 */
export async function createSupportHandoff(prisma, args = {}) {
  const access = resolveSupportAccess(args.admin);
  if (!access.canCreateHandoffs) {
    return { ok: false, forbidden: true, reason: 'create_handoff_required' };
  }

  if (!hasSupportHandoffModel(prisma)) {
    return { ok: false, error: 'support_handoff_model_unavailable', status: 'UNAVAILABLE' };
  }

  const ticket = await findSupportTicket(prisma, args.ticketId);
  if (!ticket) {
    return { ok: false, notFound: true, error: 'ticket_not_found' };
  }

  const targetType = String(args.targetType || '')
    .trim()
    .toUpperCase();
  if (!SUPPORT_HANDOFF_TARGETS.includes(targetType)) {
    return {
      ok: false,
      error: `targetType must be one of ${SUPPORT_HANDOFF_TARGETS.join('|')}`,
    };
  }

  let featureCode = args.featureCode ? String(args.featureCode).trim() : null;
  if (targetType === SUPPORT_HANDOFF_TARGET.PRODUCT && featureCode) {
    const feature = getProductFeature(featureCode);
    if (!feature) {
      return {
        ok: false,
        error: 'unknown_feature_code',
        hint: 'Use an optional Phase 9 catalogue featureCode or omit',
      };
    }
  } else if (targetType !== SUPPORT_HANDOFF_TARGET.PRODUCT) {
    featureCode = null;
  }

  const statusRaw = args.status
    ? String(args.status).trim().toUpperCase()
    : SUPPORT_HANDOFF_STATUS.OPEN;
  const status = Object.values(SUPPORT_HANDOFF_STATUS).includes(statusRaw)
    ? statusRaw
    : SUPPORT_HANDOFF_STATUS.OPEN;

  const invoiceId = args.invoiceId ? String(args.invoiceId).trim() : null;
  const subscriptionId = args.subscriptionId ? String(args.subscriptionId).trim() : null;
  let targetRefId = args.targetRefId ? String(args.targetRefId).trim() : null;

  const basePayload = {
    ticketId: ticket.id,
    tenantId: ticket.tenantId,
    ...(args.payload && typeof args.payload === 'object' ? args.payload : {}),
  };

  // Typed Finance/Billing ids — never copy subscriptionId into invoiceId.
  if (invoiceId) basePayload.invoiceId = invoiceId;
  if (subscriptionId) basePayload.subscriptionId = subscriptionId;

  if (targetRefId) {
    if (targetType === SUPPORT_HANDOFF_TARGET.CS) {
      basePayload.csCaseId = basePayload.csCaseId || targetRefId;
    }
    if (targetType === SUPPORT_HANDOFF_TARGET.MRA) {
      basePayload.transmissionId = basePayload.transmissionId || targetRefId;
    }
    // FINANCE/BILLING: targetRefId stays generic; do not assume invoice vs subscription.
  }

  if (featureCode) basePayload.featureCode = featureCode;
  if (args.summary) basePayload.summary = String(args.summary).trim();

  const payload = sanitizeHandoffPayload(targetType, basePayload);

  // Column targetRefId: explicit generic ref, else omit when typed invoice/subscription apply.
  if (!targetRefId && !invoiceId && !subscriptionId) {
    targetRefId = null;
  } else if (
    !targetRefId &&
    (targetType === SUPPORT_HANDOFF_TARGET.FINANCE ||
      targetType === SUPPORT_HANDOFF_TARGET.BILLING) &&
    (invoiceId || subscriptionId)
  ) {
    // Typed ids live in payload only — avoid collapsing subscription into a generic/invoice slot.
    targetRefId = null;
  } else if (!targetRefId && targetType === SUPPORT_HANDOFF_TARGET.CS && basePayload.csCaseId) {
    targetRefId = String(basePayload.csCaseId);
  } else if (!targetRefId && targetType === SUPPORT_HANDOFF_TARGET.MRA && basePayload.transmissionId) {
    targetRefId = String(basePayload.transmissionId);
  }

  const row = await prisma.supportHandoff.create({
    data: {
      ticketId: ticket.id,
      tenantId: ticket.tenantId,
      targetType,
      status,
      summary: args.summary ? String(args.summary).trim() : null,
      targetRefId,
      featureCode,
      createdByAdminId: args.admin?.id || null,
      payload,
    },
  });

  return {
    ok: true,
    created: true,
    handoff: serializeHandoff(row),
    meta: {
      recordOnly: true,
      mutatesSubscription: false,
      mutatesTenantGl: false,
      mutatesMraFiscal: false,
      mutatesCsCaseStatus: false,
      opensCsCase: false,
    },
  };
}

/**
 * List handoffs for a ticket (or all when ticketId omitted — UI list page).
 */
export async function listSupportHandoffs(prisma, args = {}) {
  const access = resolveSupportAccess(args.admin);
  if (!access.canViewTickets) {
    return { ok: false, forbidden: true, reason: 'view_tickets_required', items: [] };
  }

  if (!hasSupportHandoffModel(prisma)) {
    return {
      ok: true,
      items: [],
      meta: { unavailable: true, reason: 'support_handoff_model_unavailable', recordOnly: true },
    };
  }

  const where = {};
  if (args.ticketId) {
    const ticket = await findSupportTicket(prisma, args.ticketId);
    if (!ticket) {
      return { ok: false, notFound: true, error: 'ticket_not_found', items: [] };
    }
    where.ticketId = ticket.id;
  }
  if (args.targetType) where.targetType = String(args.targetType).toUpperCase();
  if (args.status) where.status = String(args.status).toUpperCase();

  const take = Math.min(200, Math.max(1, Number(args.limit) || 50));
  let rows = [];
  try {
    rows = await prisma.supportHandoff.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
    });
  } catch {
    rows = await prisma.supportHandoff.findMany({ where });
  }

  return {
    ok: true,
    items: (rows || []).map(serializeHandoff),
    meta: {
      count: (rows || []).length,
      recordOnly: true,
      mutatesSubscription: false,
      mutatesCsCaseStatus: false,
    },
  };
}

export { serializeHandoff, FORBIDDEN_PAYLOAD_KEYS };
