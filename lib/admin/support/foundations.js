/**
 * Support foundations — KB / Problem Management / CSAT / Automation contracts.
 * Status NOT_AVAILABLE or FOUNDATION only. Never invent CSAT scores.
 */

import {
  SUPPORT_FOUNDATION_KIND,
  SUPPORT_FOUNDATION_STATUS,
  SUPPORT_WAVE4_DEFINITION_VERSION,
} from './catalogue.js';
import { resolveSupportAccess } from './authz.js';

const FOUNDATION_CONTRACTS = Object.freeze({
  [SUPPORT_FOUNDATION_KIND.KNOWLEDGE_BASE]: {
    status: SUPPORT_FOUNDATION_STATUS.NOT_AVAILABLE,
    contract:
      'Knowledge Base articles, search, and ticket deflection are deferred. No invented article counts or deflection rates.',
    deferredTo: 'Phase 11+',
  },
  [SUPPORT_FOUNDATION_KIND.PROBLEM_MANAGEMENT]: {
    status: SUPPORT_FOUNDATION_STATUS.FOUNDATION,
    contract:
      'Problem Management records and major-incident linkage are foundation-only. SupportTicket remains the operational plane; no fake problem KPIs.',
    deferredTo: 'Phase 11+',
  },
  [SUPPORT_FOUNDATION_KIND.CSAT]: {
    status: SUPPORT_FOUNDATION_STATUS.NOT_AVAILABLE,
    contract:
      'CSAT / satisfaction surveys are not instrumented. score is always null — never invent CSAT averages or sample scores.',
    deferredTo: 'Phase 11+',
    score: null,
    inventScoresForbidden: true,
  },
  [SUPPORT_FOUNDATION_KIND.AUTOMATION]: {
    status: SUPPORT_FOUNDATION_STATUS.NOT_AVAILABLE,
    contract:
      'Automation / AI replies / auto-routing are deferred. Email and WhatsApp ingest remain NOT_AVAILABLE channel contracts.',
    deferredTo: 'Phase 11+',
  },
});

/**
 * @param {import('@prisma/client').PrismaClient} _prisma
 * @param {{ admin: object, kind?: string }} args
 */
export async function getSupportFoundations(_prisma, args = {}) {
  const access = resolveSupportAccess(args.admin);
  if (!access.canViewTickets) {
    return { ok: false, forbidden: true, reason: 'view_tickets_required' };
  }

  const kindFilter = args.kind
    ? String(args.kind).trim().toUpperCase().replace(/-/g, '_')
    : null;

  const kinds = Object.values(SUPPORT_FOUNDATION_KIND);
  const selected = kindFilter
    ? kinds.filter((k) => k === kindFilter || k.replace(/_/g, '') === kindFilter.replace(/_/g, ''))
    : kinds;

  if (kindFilter && selected.length === 0) {
    return {
      ok: false,
      error: `kind must be one of ${kinds.join('|')}`,
    };
  }

  const items = selected.map((kind) => {
    const c = FOUNDATION_CONTRACTS[kind];
    return {
      kind,
      status: c.status,
      contract: c.contract,
      deferredTo: c.deferredTo,
      score: c.score === undefined ? undefined : null,
      inventScoresForbidden: Boolean(c.inventScoresForbidden),
      items: [],
    };
  });

  return {
    ok: true,
    definitionVersion: SUPPORT_WAVE4_DEFINITION_VERSION,
    status: SUPPORT_FOUNDATION_STATUS.FOUNDATION,
    items,
    meta: {
      inventCsatForbidden: true,
      inventArticleCountsForbidden: true,
      emailChannel: 'NOT_AVAILABLE',
      whatsappChannel: 'NOT_AVAILABLE',
      portalChannel: 'NOT_AVAILABLE',
    },
  };
}

export { FOUNDATION_CONTRACTS };
