/**
 * Commercial reconciliation foundations — Phase 15 Wave 4.
 * Lineage: request → document → acceptance → handoff.
 * Never invent zeroes on gate failure.
 */

import { resolveCrmAccess } from '../authz.js';
import { CRM_RELIABILITY_STATUS } from '../catalogue.js';
import {
  hasCrmCommercialDocumentModel,
  hasCrmCommercialAcceptanceModel,
} from './model.js';
import { hasCrmClosedWonConversionHandoffModel } from './readiness.js';
import { safeCommercialCount } from './reliabilityGate.js';
import { getCommercialDomainContract } from './catalogue.js';

export const CRM_COMMERCIAL_RECON_VERSION = 'crm-commercial-recon-v1-2026-07-31';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, persist?: boolean }} args
 */
export async function runCommercialReconciliation(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canRunReconciliation && !access.isSuperAdmin) {
    return {
      ok: false,
      forbidden: true,
      status: CRM_RELIABILITY_STATUS.PERMISSION_RESTRICTED,
      reason: 'crm_commercial_recon_forbidden',
      cards: null,
    };
  }

  if (!hasCrmCommercialDocumentModel(prisma)) {
    return {
      ok: true,
      status: CRM_RELIABILITY_STATUS.NOT_INSTRUMENTED,
      cards: null,
      honesty: {
        inventZeroesForbidden: true,
        falseZeroes: false,
        commercialPlane: true,
      },
      definitionVersion: CRM_COMMERCIAL_RECON_VERSION,
      domain: getCommercialDomainContract(),
    };
  }

  const docs = await safeCommercialCount(() => prisma.crmCommercialDocument.count());
  if (!docs.ok) {
    return {
      ok: true,
      status: CRM_RELIABILITY_STATUS.RECONCILIATION_FAILED,
      cards: null,
      honesty: {
        inventZeroesForbidden: true,
        falseZeroes: false,
        commercialPlane: true,
      },
      definitionVersion: CRM_COMMERCIAL_RECON_VERSION,
      domain: getCommercialDomainContract(),
    };
  }

  if (docs.value === 0) {
    return {
      ok: true,
      status: 'EMPTY',
      cards: null,
      honesty: {
        inventZeroesForbidden: true,
        falseZeroes: false,
        emptyEnvelope: true,
        commercialPlane: true,
        kpiSafe: false,
      },
      definitionVersion: CRM_COMMERCIAL_RECON_VERSION,
      domain: getCommercialDomainContract(),
    };
  }

  const accepted = hasCrmCommercialAcceptanceModel(prisma)
    ? await safeCommercialCount(() => prisma.crmCommercialAcceptance.count())
    : { ok: false, value: null };
  const handoffs = hasCrmClosedWonConversionHandoffModel(prisma)
    ? await safeCommercialCount(() => prisma.crmClosedWonConversionHandoff.count())
    : { ok: true, value: null };

  const cards = [
    {
      id: 'commercial_documents',
      label: 'CrmCommercialDocument rows',
      value: docs.value,
      status: CRM_RELIABILITY_STATUS.AVAILABLE,
    },
    {
      id: 'acceptances',
      label: 'CrmCommercialAcceptance rows',
      value: accepted.ok ? accepted.value : null,
      status: accepted.ok
        ? CRM_RELIABILITY_STATUS.AVAILABLE
        : CRM_RELIABILITY_STATUS.UNAVAILABLE,
      detail: accepted.ok
        ? null
        : 'acceptance count unavailable — KPI null (never invent 0)',
    },
    {
      id: 'phase16_handoffs',
      label: 'Closed-Won conversion handoffs',
      value: handoffs.ok ? handoffs.value : null,
      status: handoffs.ok
        ? CRM_RELIABILITY_STATUS.AVAILABLE
        : CRM_RELIABILITY_STATUS.UNAVAILABLE,
      detail: 'Payload only — never Customer/Tenant/Subscription/Invoice',
    },
  ];

  if (args.persist && typeof prisma.crmCommercialReconRun?.create === 'function') {
    await prisma.crmCommercialReconRun.create({
      data: {
        status: CRM_RELIABILITY_STATUS.AVAILABLE,
        cardsJson: cards,
        createdByAdminId: args.admin?.id || null,
        createdAt: args.now || new Date(),
        updatedAt: args.now || new Date(),
      },
    });
  }

  return {
    ok: true,
    status: CRM_RELIABILITY_STATUS.AVAILABLE,
    cards,
    honesty: {
      inventZeroesForbidden: true,
      falseZeroes: false,
      commercialPlane: true,
      kpiSafe: true,
      lineage:
        'request→document→version→artifact→delivery→acceptance→phase16_handoff',
    },
    definitionVersion: CRM_COMMERCIAL_RECON_VERSION,
    domain: getCommercialDomainContract(),
  };
}
