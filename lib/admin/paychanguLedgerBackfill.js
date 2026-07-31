/**
 * Historical PayChangu → PlatformInvoice/Payment backfill (idempotent).
 * Dry-run safe. Does not mutate Tenant AR.
 *
 * Covers:
 * - AccountSubscription + BranchSubscription paid periods missing invoices
 * - Orphan PlatformPayments (invoiceId null) matched by txRef / gatewayReference
 * - Invoice exists but payment missing
 * Reports unmatched orphans (never invents invoices without a subscription).
 */

import { invoiceIdempotencyKey } from './platformBilling.js';
import { ensurePaychanguPlatformLedger } from './paychanguPlatformLedger.js';

const PAID_STATUSES = new Set([
  'Completed',
  'COMPLETED',
  'completed',
  'Active',
  'ACTIVE',
  'active',
  'Paid',
  'PAID',
]);

const SUB_SELECT = {
  id: true,
  tenantId: true,
  plan: true,
  status: true,
  isActive: true,
  amount: true,
  currency: true,
  startedAt: true,
  expiresAt: true,
  paymentDate: true,
  txRef: true,
};

function toIso(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * @param {object} sub AccountSubscription- or BranchSubscription-like row
 */
export function shouldBackfillSubscription(sub) {
  if (!sub?.id || !sub?.tenantId) return false;
  if (sub.isTrial === true) return false;
  if (!(Number(sub.amount) > 0)) return false;
  if (!PAID_STATUSES.has(String(sub.status || ''))) return false;
  const start = sub.startedAt || sub.paymentDate;
  const end = sub.expiresAt;
  if (!start || !end) return false;
  return true;
}

/**
 * Pure planner: which subscriptions need ledger create/link work.
 *
 * @param {{
 *   subscriptions: object[],
 *   existingInvoiceKeys: Set<string>,
 *   orphanPaymentsByTxRef?: Map<string, object>,
 *   paymentRefs?: Set<string>,
 * }} input
 */
export function planPaychanguLedgerBackfill({
  subscriptions = [],
  existingInvoiceKeys = new Set(),
  orphanPaymentsByTxRef = new Map(),
  paymentRefs = new Set(),
}) {
  const actions = [];
  const skipped = [];
  const claimedOrphanRefs = new Set();

  for (const sub of subscriptions) {
    const source = sub.source || 'account';
    if (!shouldBackfillSubscription(sub)) {
      skipped.push({
        subscriptionId: sub?.id || null,
        source,
        reason: 'not_eligible',
      });
      continue;
    }

    const periodStart = toIso(sub.startedAt || sub.paymentDate);
    const periodEnd = toIso(sub.expiresAt);
    const key = invoiceIdempotencyKey({
      tenantId: sub.tenantId,
      subscriptionId: sub.id,
      periodStart,
      periodEnd,
    });

    const txRef = sub.txRef ? String(sub.txRef) : null;
    const orphan = txRef ? orphanPaymentsByTxRef.get(txRef) || null : null;
    const hasInvoice = existingInvoiceKeys.has(key);
    const hasPayment = txRef ? paymentRefs.has(txRef) : false;
    const gatewayReference = txRef || `BACKFILL-${sub.id}`;

    let action = null;
    if (!hasInvoice) {
      action = 'create_ledger';
    } else if (orphan) {
      action = 'link_orphan';
    } else if (!hasPayment) {
      action = 'create_payment';
    } else {
      skipped.push({
        subscriptionId: sub.id,
        source,
        reason: 'complete',
        idempotencyKey: key,
      });
      continue;
    }

    if (orphan?.gatewayReference) {
      claimedOrphanRefs.add(String(orphan.gatewayReference));
    }

    actions.push({
      action,
      source,
      subscriptionId: sub.id,
      tenantId: sub.tenantId,
      planCode: sub.plan || null,
      amount: Number(sub.amount),
      currency: sub.currency || 'MWK',
      periodStart,
      periodEnd,
      gatewayReference,
      orphanPaymentId: orphan?.id || null,
      idempotencyKey: key,
    });
  }

  const unmatchedOrphans = [];
  for (const [ref, payment] of orphanPaymentsByTxRef.entries()) {
    if (!claimedOrphanRefs.has(ref) && !actions.some((a) => a.gatewayReference === ref)) {
      // Orphan whose txRef did not match any examined eligible/ineligible sub in this plan
      const matchedAnySub = subscriptions.some((s) => s.txRef && String(s.txRef) === ref);
      if (!matchedAnySub) {
        unmatchedOrphans.push({
          paymentId: payment.id,
          tenantId: payment.tenantId || null,
          gatewayReference: ref,
          amount: payment.amount ?? null,
          reason: 'no_matching_subscription',
        });
      } else {
        // Matched a sub that was not eligible — still report
        unmatchedOrphans.push({
          paymentId: payment.id,
          tenantId: payment.tenantId || null,
          gatewayReference: ref,
          amount: payment.amount ?? null,
          reason: 'subscription_not_eligible',
        });
      }
    }
  }

  return {
    actions,
    skipped,
    unmatchedOrphans,
    summary: {
      eligible: actions.length,
      skipped: skipped.length,
      examined: subscriptions.length,
      unmatchedOrphans: unmatchedOrphans.length,
      byAction: {
        create_ledger: actions.filter((a) => a.action === 'create_ledger').length,
        link_orphan: actions.filter((a) => a.action === 'link_orphan').length,
        create_payment: actions.filter((a) => a.action === 'create_payment').length,
      },
    },
  };
}

async function loadInvoiceKeys(prisma) {
  const keys = new Set();
  let cursor = null;
  for (;;) {
    const batch = await prisma.platformInvoice.findMany({
      select: { id: true, idempotencyKey: true },
      orderBy: { id: 'asc' },
      take: 1000,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (!batch.length) break;
    for (const row of batch) {
      if (row.idempotencyKey) keys.add(row.idempotencyKey);
    }
    cursor = batch[batch.length - 1].id;
    if (batch.length < 1000) break;
  }
  return keys;
}

async function loadPaychanguPayments(prisma) {
  const orphans = [];
  const paymentRefs = new Set();
  let cursor = null;
  for (;;) {
    const batch = await prisma.platformPayment.findMany({
      where: { gateway: 'PayChangu' },
      select: {
        id: true,
        gatewayReference: true,
        invoiceId: true,
        tenantId: true,
        amount: true,
      },
      orderBy: { id: 'asc' },
      take: 1000,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (!batch.length) break;
    for (const p of batch) {
      if (p.gatewayReference) {
        paymentRefs.add(String(p.gatewayReference));
        if (!p.invoiceId) orphans.push(p);
      }
    }
    cursor = batch[batch.length - 1].id;
    if (batch.length < 1000) break;
  }
  return { orphans, paymentRefs };
}

/**
 * Load candidates from DB and return a dry-run plan.
 * @param {import('@prisma/client').PrismaClient} prisma
 */
export async function listPaychanguBackfillPlan(prisma, { limit = 500 } = {}) {
  const take = Math.min(Math.max(Number(limit) || 500, 1), 2000);
  const half = Math.ceil(take / 2);

  const accountWhere = {
    isTrial: false,
    amount: { gt: 0 },
    status: { in: [...PAID_STATUSES] },
    OR: [{ startedAt: { not: null } }, { paymentDate: { not: null } }],
    expiresAt: { not: null },
  };
  const branchWhere = {
    amount: { gt: 0 },
    status: { in: [...PAID_STATUSES] },
    OR: [{ startedAt: { not: null } }, { paymentDate: { not: null } }],
    expiresAt: { not: null },
  };

  const [accountSubs, branchSubs, existingInvoiceKeys, paymentPack] = await Promise.all([
    prisma.accountSubscription.findMany({
      where: accountWhere,
      orderBy: { paymentDate: 'desc' },
      take: half,
      select: { ...SUB_SELECT, isTrial: true },
    }),
    typeof prisma.branchSubscription?.findMany === 'function'
      ? prisma.branchSubscription.findMany({
          where: branchWhere,
          orderBy: { paymentDate: 'desc' },
          take: take - half,
          select: SUB_SELECT,
        })
      : Promise.resolve([]),
    loadInvoiceKeys(prisma),
    loadPaychanguPayments(prisma),
  ]);

  const subscriptions = [
    ...accountSubs.map((s) => ({ ...s, source: 'account' })),
    ...branchSubs.map((s) => ({ ...s, source: 'branch', isTrial: false })),
  ];

  const orphanPaymentsByTxRef = new Map();
  for (const p of paymentPack.orphans) {
    if (p.gatewayReference) {
      orphanPaymentsByTxRef.set(String(p.gatewayReference), p);
    }
  }

  const plan = planPaychanguLedgerBackfill({
    subscriptions,
    existingInvoiceKeys,
    orphanPaymentsByTxRef,
    paymentRefs: paymentPack.paymentRefs,
  });

  return {
    ...plan,
    orphanPaymentCount: paymentPack.orphans.length,
  };
}

function buildExecuteSummary(executed, errors, plan) {
  return {
    ...plan.summary,
    attempted: executed.length,
    succeeded: executed.filter((r) => r.ok).length,
    failed: errors.length,
    createdInvoices: executed.filter((r) => r.createdInvoice).length,
    createdPayments: executed.filter((r) => r.createdPayment).length,
    linkedPayments: executed.filter((r) => r.linked).length,
  };
}

/**
 * Execute backfill (or dry-run). Uses ensurePaychanguPlatformLedger per action.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ dryRun?: boolean, limit?: number, maxExecute?: number }} opts
 */
export async function runPaychanguLedgerBackfill(prisma, opts = {}) {
  const dryRun = opts.dryRun !== false; // default dry-run
  const plan = await listPaychanguBackfillPlan(prisma, { limit: opts.limit });
  const maxExecute = Math.min(
    Math.max(Number(opts.maxExecute) || 50, 0),
    plan.actions.length,
    200
  );

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      ...plan,
      executed: [],
      wouldExecute: plan.actions.slice(0, maxExecute),
      resultSummary: {
        ...plan.summary,
        wouldExecute: Math.min(maxExecute, plan.actions.length),
      },
    };
  }

  const executed = [];
  const errors = [];
  const slice = plan.actions.slice(0, maxExecute);

  for (const action of slice) {
    try {
      const result = await ensurePaychanguPlatformLedger(prisma, {
        tenantId: action.tenantId,
        subscriptionId: action.subscriptionId,
        periodStart: action.periodStart,
        periodEnd: action.periodEnd,
        amount: action.amount,
        currency: action.currency,
        planCode: action.planCode,
        gatewayReference: action.gatewayReference,
        method: 'PayChangu',
      });
      executed.push({
        action: action.action,
        source: action.source,
        subscriptionId: action.subscriptionId,
        ok: result.ok,
        createdInvoice: result.createdInvoice,
        createdPayment: result.createdPayment,
        linked:
          result.ok &&
          action.action === 'link_orphan' &&
          Boolean(result.payment?.invoiceId),
        invoiceId: result.invoice?.id || null,
        paymentId: result.payment?.id || null,
        error: result.error || null,
      });
      if (!result.ok) {
        errors.push({
          subscriptionId: action.subscriptionId,
          source: action.source,
          error: result.error,
        });
      }
    } catch (e) {
      errors.push({
        subscriptionId: action.subscriptionId,
        source: action.source,
        error: e?.message || 'backfill failed',
      });
      executed.push({
        action: action.action,
        source: action.source,
        subscriptionId: action.subscriptionId,
        ok: false,
        error: e?.message || 'backfill failed',
      });
    }
  }

  return {
    ok: errors.length === 0,
    dryRun: false,
    summary: plan.summary,
    resultSummary: buildExecuteSummary(executed, errors, plan),
    skipped: plan.skipped,
    unmatchedOrphans: plan.unmatchedOrphans,
    orphanPaymentCount: plan.orphanPaymentCount,
    actions: plan.actions,
    executed,
    errors,
  };
}
