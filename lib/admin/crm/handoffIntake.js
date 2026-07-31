/**
 * CS / Support / Product handoff → CrmLead intake (Phase 11 Wave 2).
 * Link-only: never mutates CsExpansionHandoff, SupportHandoff, CsCase,
 * SupportTicket, subscription, or product facts.
 */

import { CRM_CAPTURE_SOURCE, CRM_SOURCE_CHANNEL, CRM_LEAD_TYPE } from './catalogue.js';
import { resolveCrmAccess } from './authz.js';
import { captureLead } from './capture.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   handoffType: 'CUSTOMER_SUCCESS'|'SUPPORT'|'PRODUCT'|string,
 *   handoffId: string,
 *   featureCode?: string|null,
 *   tenantId?: string|null,
 *   summary?: string|null,
 *   contactName?: string|null,
 *   email?: string|null,
 *   phone?: string|null,
 *   businessName?: string|null,
 *   now?: Date,
 * }} args
 */
export async function intakeHandoffAsLead(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canIntakeHandoffs) {
    return { ok: false, forbidden: true, reason: 'crm_handoff_intake_forbidden' };
  }

  const handoffType = String(args.handoffType || '')
    .trim()
    .toUpperCase();
  const handoffId = args.handoffId ? String(args.handoffId).trim() : '';
  if (!handoffId) return { ok: false, error: 'handoffId required' };

  let sourceCode;
  let handoffRefType;
  let titleBits = [];
  let message = args.summary ? String(args.summary) : null;
  let tenantId = args.tenantId || null;
  let featureCode = args.featureCode || null;
  let contactName = args.contactName || null;
  let businessName = args.businessName || null;
  let email = args.email || null;
  let phone = args.phone || null;
  let type = CRM_LEAD_TYPE.EXPANSION;

  if (handoffType === 'CUSTOMER_SUCCESS' || handoffType === 'CS') {
    sourceCode = CRM_CAPTURE_SOURCE.CUSTOMER_SUCCESS_HANDOFF;
    handoffRefType = 'CS_EXPANSION';
    if (typeof prisma.csExpansionHandoff?.findUnique === 'function') {
      const row = await prisma.csExpansionHandoff.findUnique({
        where: { id: handoffId },
      });
      if (!row) return { ok: false, notFound: true, error: 'cs_handoff_not_found' };
      tenantId = tenantId || row.tenantId || null;
      message =
        message ||
        [row.reason, row.notes].filter(Boolean).join('\n') ||
        'CS expansion handoff';
      titleBits = ['CS expansion', row.recommendedAction, tenantId].filter(Boolean);
      // Read-only — do not update handoff
    } else {
      return { ok: false, error: 'cs_handoff_model_unavailable', status: 'UNAVAILABLE' };
    }
  } else if (handoffType === 'SUPPORT') {
    sourceCode = CRM_CAPTURE_SOURCE.SUPPORT_HANDOFF;
    handoffRefType = 'SUPPORT';
    if (typeof prisma.supportHandoff?.findUnique === 'function') {
      const row = await prisma.supportHandoff.findUnique({
        where: { id: handoffId },
      });
      if (!row) return { ok: false, notFound: true, error: 'support_handoff_not_found' };
      tenantId = tenantId || row.tenantId || null;
      featureCode = featureCode || row.featureCode || null;
      message = message || row.summary || 'Support handoff';
      titleBits = ['Support handoff', row.targetType, tenantId].filter(Boolean);
    } else {
      return { ok: false, error: 'support_handoff_model_unavailable', status: 'UNAVAILABLE' };
    }
  } else if (handoffType === 'PRODUCT') {
    sourceCode = CRM_CAPTURE_SOURCE.PRODUCT_SIGNAL;
    handoffRefType = 'PRODUCT';
    // Product signal may reference a SupportHandoff id or a synthetic product ref.
    if (typeof prisma.supportHandoff?.findUnique === 'function') {
      try {
        const row = await prisma.supportHandoff.findUnique({
          where: { id: handoffId },
        });
        if (row) {
          tenantId = tenantId || row.tenantId || null;
          featureCode = featureCode || row.featureCode || null;
          message = message || row.summary || 'Product signal';
        }
      } catch {
        // optional lookup
      }
    }
    message = message || 'Product signal';
    titleBits = ['Product signal', featureCode, tenantId].filter(Boolean);
  } else {
    return { ok: false, error: 'invalid_handoff_type', handoffType };
  }

  // Handoffs may lack public email/phone — use stable synthetic identity for idempotency only.
  // Not used as a real contact address.
  if (!email && !phone) {
    email = `handoff+${handoffRefType.toLowerCase()}.${handoffId}@crm.internal`;
  }
  if (!contactName) contactName = titleBits[0] || 'Handoff contact';
  if (!businessName && tenantId) businessName = `Tenant ${tenantId}`;

  const result = await captureLead(prisma, {
    admin: args.admin,
    sourceCode,
    channel: CRM_SOURCE_CHANNEL.INTERNAL_HANDOFF,
    type,
    businessName,
    contactName,
    email,
    phone,
    message,
    featureCode,
    tenantId,
    handoffRefType,
    handoffRefId: handoffId,
    sourceIdempotencyKey: `crm-capture:${sourceCode}:${handoffRefType}:${handoffId}`,
    title: titleBits.join(' — ').slice(0, 200),
    now: args.now,
  });

  if (!result.ok) return result;

  return {
    ...result,
    meta: {
      mutatesHandoff: false,
      mutatesCsCase: false,
      mutatesSupportTicket: false,
      mutatesSubscription: false,
      createsOpportunity: false,
    },
  };
}

