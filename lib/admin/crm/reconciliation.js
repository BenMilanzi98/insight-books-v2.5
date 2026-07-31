/**
 * CRM reconciliation foundations — Phase 11 Wave 4.
 * Light checks only. Never invent false zeroes on gate failure.
 */

import {
  CRM_RECON_VERSION,
  CRM_RELIABILITY_STATUS,
  CRM_WAVE4_DEFINITION_VERSION,
} from './catalogue.js';
import { resolveCrmAccess } from './authz.js';

export function hasCrmReconciliationRunModel(prisma) {
  return typeof prisma?.crmReconciliationRun?.create === 'function';
}

async function safeCount(fn) {
  try {
    const value = await fn();
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return { ok: false, value: null, error: 'non_numeric_count' };
    }
    return { ok: true, value };
  } catch (e) {
    return { ok: false, value: null, error: e?.message || 'count_failed' };
  }
}

function card(id, label, value, status, detail) {
  return {
    id,
    label,
    value: value == null ? null : value,
    status,
    detail: detail || null,
  };
}

/**
 * Pure honesty: recon failure must not yield fabricated zero KPIs.
 */
export function applyCrmReconHonesty(input = {}) {
  const failed =
    input.status === CRM_RELIABILITY_STATUS.RECONCILIATION_FAILED ||
    input.reconOk === false;
  const unavailable =
    input.status === CRM_RELIABILITY_STATUS.UNAVAILABLE ||
    input.status === CRM_RELIABILITY_STATUS.NOT_INSTRUMENTED ||
    input.status === CRM_RELIABILITY_STATUS.PERMISSION_RESTRICTED;

  if (!failed && !unavailable) {
    return {
      kpiSafe: true,
      leadCount: input.leadCount,
      status: input.status || CRM_RELIABILITY_STATUS.AVAILABLE,
    };
  }

  return {
    kpiSafe: false,
    leadCount: null,
    captureCount: null,
    statusHistoryCount: null,
    status: failed
      ? CRM_RELIABILITY_STATUS.RECONCILIATION_FAILED
      : input.status || CRM_RELIABILITY_STATUS.UNAVAILABLE,
    reasonMessage:
      'Failed or unavailable reconciliation blocks numeric KPIs — never false zeroes',
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, persist?: boolean }} args
 */
export async function runCrmReconciliation(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canViewLeads) {
    return {
      ok: false,
      forbidden: true,
      status: CRM_RELIABILITY_STATUS.PERMISSION_RESTRICTED,
      reason: 'crm_view_forbidden',
    };
  }
  if (!access.canRunReconciliation) {
    return {
      ok: false,
      forbidden: true,
      status: CRM_RELIABILITY_STATUS.PERMISSION_RESTRICTED,
      reason: 'crm_recon_forbidden',
    };
  }

  const cards = [];
  let reconOk = true;

  if (typeof prisma?.crmLead?.count !== 'function') {
    return {
      ok: true,
      status: CRM_RELIABILITY_STATUS.UNAVAILABLE,
      definitionVersion: CRM_WAVE4_DEFINITION_VERSION,
      reconVersion: CRM_RECON_VERSION,
      cards: [
        card(
          'leads',
          'CrmLead count',
          null,
          CRM_RELIABILITY_STATUS.UNAVAILABLE,
          'crm_lead_model_unavailable'
        ),
      ],
      honesty: applyCrmReconHonesty({
        status: CRM_RELIABILITY_STATUS.UNAVAILABLE,
        reconOk: false,
      }),
    };
  }

  const leadCount = await safeCount(() => prisma.crmLead.count());
  if (!leadCount.ok) reconOk = false;
  cards.push(
    card(
      'leads',
      'CrmLead count',
      leadCount.ok ? leadCount.value : null,
      leadCount.ok
        ? CRM_RELIABILITY_STATUS.AVAILABLE
        : CRM_RELIABILITY_STATUS.RECONCILIATION_FAILED,
      leadCount.error || null
    )
  );

  if (typeof prisma.crmCaptureRecord?.count === 'function') {
    const captureCount = await safeCount(() => prisma.crmCaptureRecord.count());
    if (!captureCount.ok) reconOk = false;
    cards.push(
      card(
        'captures',
        'CrmCaptureRecord count',
        captureCount.ok ? captureCount.value : null,
        captureCount.ok
          ? CRM_RELIABILITY_STATUS.AVAILABLE
          : CRM_RELIABILITY_STATUS.RECONCILIATION_FAILED,
        captureCount.error || null
      )
    );
  } else {
    cards.push(
      card(
        'captures',
        'CrmCaptureRecord count',
        null,
        CRM_RELIABILITY_STATUS.NOT_INSTRUMENTED,
        'capture_model_unavailable'
      )
    );
  }

  if (typeof prisma.crmLeadStatusHistory?.count === 'function') {
    const hist = await safeCount(() => prisma.crmLeadStatusHistory.count());
    if (!hist.ok) reconOk = false;
    cards.push(
      card(
        'status_history',
        'CrmLeadStatusHistory count',
        hist.ok ? hist.value : null,
        hist.ok
          ? CRM_RELIABILITY_STATUS.AVAILABLE
          : CRM_RELIABILITY_STATUS.RECONCILIATION_FAILED,
        hist.error || null
      )
    );
  }

  const status = reconOk
    ? CRM_RELIABILITY_STATUS.AVAILABLE
    : CRM_RELIABILITY_STATUS.RECONCILIATION_FAILED;

  const honesty = applyCrmReconHonesty({
    status,
    reconOk,
    leadCount: leadCount.ok ? leadCount.value : null,
  });

  const result = {
    ok: true,
    status,
    reconOk,
    definitionVersion: CRM_WAVE4_DEFINITION_VERSION,
    reconVersion: CRM_RECON_VERSION,
    cards,
    honesty,
    meta: {
      inventZeroesForbidden: true,
      emailChannel: 'NOT_AVAILABLE',
      whatsappChannel: 'NOT_AVAILABLE',
    },
  };

  if (args.persist !== false && hasCrmReconciliationRunModel(prisma)) {
    try {
      await prisma.crmReconciliationRun.create({
        data: {
          status,
          summaryJson: {
            cards,
            honesty,
            reconVersion: CRM_RECON_VERSION,
          },
          runByAdminId: args.admin?.id || null,
          at: new Date(),
        },
      });
    } catch {
      // persist optional
    }
  }

  return result;
}
