/**
 * Deterministic customer signals + attention queue (Phase 7 Wave 4).
 *
 * Persistence: prefer CustomerSignal rows when the Prisma client has the model.
 * If unavailable, evaluation is ephemeral (documented) with stable synthetic ids.
 *
 * Never emits probability, expected revenue, opaque health, adoption FEATURE_USED,
 * or support-escalation signals.
 */

import { VOID_INVOICE_STATUSES } from '@/lib/admin/revenue/billingConstants.js';
import { categoryForPlanCode, PLAN_CATEGORY } from '@/lib/admin/mraEisPlans';
import { resolveCustomerAccess } from './authz.js';
import { applyPortfolioTenantWhere, resolvePortfolioScope } from './portfolioScope.js';
import { activeOwnershipWhere } from './portfolioScope.js';
import {
  CUSTOMER_SIGNAL_RULE_VERSION,
  DEFAULT_INACTIVITY_DAYS,
  DEFAULT_RENEWAL_WINDOW_DAYS,
  SIGNAL_CATALOGUE,
  SIGNAL_CODES,
  SIGNAL_KIND,
  SIGNAL_STATUS,
  SEVERITY_RANK,
  catalogueEntry,
} from './signalCatalogue.js';

const OPEN_STATUSES = [SIGNAL_STATUS.NEW, SIGNAL_STATUS.ACKNOWLEDGED];

function isSuspendedTenantStatus(status) {
  const s = String(status || '').toUpperCase();
  return s === 'SUSPENDED' || s === 'SUSPENSION_PENDING' || s === 'RESTRICTED';
}

function isSuspendedSubStatus(status) {
  const s = String(status || '').toUpperCase();
  return s === 'SUSPENDED' || s === 'SUSPENSION' || s === 'RESTRICTED';
}

function isPendingEntitlement(status) {
  const s = String(status || '').toUpperCase();
  return (
    s === 'PENDING' ||
    s === 'INCOMPLETE' ||
    s === 'DRAFT' ||
    s === 'PENDING_APPROVAL' ||
    s === 'AWAITING_APPROVAL'
  );
}

function hasCustomerSignalModel(prisma) {
  return typeof prisma?.customerSignal?.findMany === 'function';
}

function ephemeralId(tenantId, code) {
  return `ephemeral:${tenantId}:${code}`;
}

function stripForbiddenFields(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const banned = [
    'probability',
    'expectedRevenue',
    'expected_revenue',
    'healthScore',
    'health_score',
    'churnProbability',
    'churn_probability',
    'score',
  ];
  const out = { ...obj };
  for (const k of banned) {
    if (k in out) delete out[k];
  }
  return out;
}

/**
 * Build a serialisable signal record (no probability / revenue / health fields).
 */
export function serializeSignal(row, extras = {}) {
  const entry = catalogueEntry(row.code) || {};
  const payload = stripForbiddenFields(
    row.payload && typeof row.payload === 'object' ? { ...row.payload } : {}
  );
  return stripForbiddenFields({
    id: row.id,
    tenantId: row.tenantId,
    code: row.code,
    severity: row.severity || entry.severity || null,
    status: row.status || SIGNAL_STATUS.NEW,
    kind: entry.kind || SIGNAL_KIND.ATTENTION,
    title: entry.title || row.code,
    source: entry.source || null,
    payload,
    firstDetectedAt: row.firstDetectedAt
      ? new Date(row.firstDetectedAt).toISOString()
      : null,
    lastDetectedAt: row.lastDetectedAt
      ? new Date(row.lastDetectedAt).toISOString()
      : null,
    ruleVersion: row.ruleVersion || CUSTOMER_SIGNAL_RULE_VERSION,
    ephemeral: Boolean(row.ephemeral),
    ...extras,
  });
}

/**
 * Pure evaluation of verified facts → candidate signal codes + payloads.
 * @param {{
 *   tenant?: { id?: string, status?: string }|null,
 *   lastLoginAt?: string|Date|null,
 *   subscriptions?: object[],
 *   outstanding?: number|null,
 *   outstandingKnown?: boolean,
 *   entitlementStatus?: string|null,
 *   hasActiveOwnership?: boolean|null,
 *   ownershipKnown?: boolean,
 *   now?: Date,
 *   inactivityDays?: number,
 *   renewalWindowDays?: number,
 * }} facts
 */
export function deriveCandidateSignals(facts = {}) {
  const now = facts.now || new Date();
  const inactivityDays = Math.max(
    1,
    Number(facts.inactivityDays) || DEFAULT_INACTIVITY_DAYS
  );
  const renewalWindowDays = Math.max(
    1,
    Number(facts.renewalWindowDays) || DEFAULT_RENEWAL_WINDOW_DAYS
  );
  const candidates = [];

  const tenant = facts.tenant || null;
  const tenantId = tenant?.id ? String(tenant.id) : null;
  const subs = Array.isArray(facts.subscriptions) ? facts.subscriptions : [];

  // SUBSCRIPTION_SUSPENDED — tenant status or subscription status
  const subSuspended = subs.some((s) => isSuspendedSubStatus(s?.status));
  if (tenant && (isSuspendedTenantStatus(tenant.status) || subSuspended)) {
    candidates.push({
      code: SIGNAL_CODES.SUBSCRIPTION_SUSPENDED,
      payload: {
        tenantStatus: tenant.status || null,
        subscriptionSuspended: subSuspended,
        limitation: 'Deterministic from Tenant.status / AccountSubscription.status',
      },
    });
  }

  // NO_MEANINGFUL_ACTIVITY — login inactivity proxy (FEATURE_USED not used)
  if (tenantId) {
    const last = facts.lastLoginAt ? new Date(facts.lastLoginAt) : null;
    const cutoff = new Date(now.getTime() - inactivityDays * 864e5);
    const inactive = !last || Number.isNaN(last.getTime()) || last < cutoff;
    if (inactive) {
      candidates.push({
        code: SIGNAL_CODES.NO_MEANINGFUL_ACTIVITY,
        payload: {
          lastLoginAt: last && !Number.isNaN(last.getTime()) ? last.toISOString() : null,
          inactivityDays,
          limitation:
            'Login proxy only — product-usage adoption facts are NOT_SUPPORTED',
        },
      });
    }
  }

  // RENEWAL_DUE_SOON — expiresAt within window
  const until = new Date(now.getTime() + renewalWindowDays * 864e5);
  const renewing = subs.filter((s) => {
    if (!s?.expiresAt) return false;
    const exp = new Date(s.expiresAt);
    if (Number.isNaN(exp.getTime())) return false;
    if (exp <= now || exp > until) return false;
    if (s.isActive === false) return false;
    const st = String(s.status || '').toUpperCase();
    if (['EXPIRED', 'CANCELLED', 'CANCELED'].includes(st)) return false;
    return true;
  });
  if (renewing.length) {
    const soonest = [...renewing].sort(
      (a, b) => new Date(a.expiresAt) - new Date(b.expiresAt)
    )[0];
    candidates.push({
      code: SIGNAL_CODES.RENEWAL_DUE_SOON,
      payload: {
        expiresAt: new Date(soonest.expiresAt).toISOString(),
        renewalWindowDays,
        subscriptionId: soonest.id || null,
        plan: soonest.plan || null,
      },
    });
  }

  // HIGH_OUTSTANDING_BALANCE — platform outstanding only (never Tenant Sale)
  if (facts.outstandingKnown !== false && facts.outstanding != null) {
    const outstanding = Number(facts.outstanding);
    if (Number.isFinite(outstanding) && outstanding > 0) {
      candidates.push({
        code: SIGNAL_CODES.HIGH_OUTSTANDING_BALANCE,
        payload: {
          outstanding,
          currency: facts.currency || null,
          source: 'PlatformInvoice.outstanding',
        },
      });
    }
  }

  // MRA_EIS_ENTITLEMENT_PENDING — pending/incomplete entitlement, or EIS plan without ACTIVE entitlement
  const entStatus = facts.entitlementStatus
    ? String(facts.entitlementStatus)
    : null;
  const hasEisPlan = subs.some(
    (s) => categoryForPlanCode(s?.plan) === PLAN_CATEGORY.MRA_EIS
  );
  if (
    (entStatus && isPendingEntitlement(entStatus)) ||
    (hasEisPlan && (!entStatus || isPendingEntitlement(entStatus)))
  ) {
    candidates.push({
      code: SIGNAL_CODES.MRA_EIS_ENTITLEMENT_PENDING,
      payload: {
        entitlementStatus: entStatus,
        hasEisCommercialPlan: hasEisPlan,
        limitation:
          'Entitlement from MraEisTenantEntitlement; incomplete/pending is attention, not a score',
      },
    });
  }

  // CUSTOMER_OWNER_MISSING — no active ownership when ownership model is known
  if (facts.ownershipKnown !== false && facts.hasActiveOwnership === false) {
    candidates.push({
      code: SIGNAL_CODES.CUSTOMER_OWNER_MISSING,
      payload: {
        limitation: 'No ACTIVE CustomerOwnership for this tenant',
      },
    });
  }

  return candidates;
}

async function loadTenantFacts(prisma, tenantId, opts = {}) {
  const now = opts.now || new Date();
  const currency = opts.currency || 'MWK';

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      subdomain: true,
      status: true,
    },
  });
  if (!tenant) return null;

  let lastLoginAt = null;
  try {
    const agg = await prisma.user.aggregate({
      where: { tenantId, lastLogin: { not: null } },
      _max: { lastLogin: true },
    });
    lastLoginAt = agg?._max?.lastLogin || null;
  } catch {
    lastLoginAt = null;
  }

  let subscriptions = [];
  try {
    subscriptions = await prisma.accountSubscription.findMany({
      where: { tenantId },
      select: {
        id: true,
        plan: true,
        status: true,
        isActive: true,
        expiresAt: true,
        currency: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  } catch {
    subscriptions = [];
  }

  let outstanding = null;
  let outstandingKnown = false;
  if (typeof prisma?.platformInvoice?.aggregate === 'function') {
    try {
      const agg = await prisma.platformInvoice.aggregate({
        where: {
          tenantId,
          currency,
          status: { notIn: [...VOID_INVOICE_STATUSES] },
          outstanding: { gt: 0 },
        },
        _sum: { outstanding: true },
      });
      outstanding = Number(agg?._sum?.outstanding || 0);
      outstandingKnown = true;
    } catch {
      outstandingKnown = false;
    }
  }

  let entitlementStatus = null;
  if (typeof prisma?.mraEisTenantEntitlement?.findFirst === 'function') {
    try {
      const ent = await prisma.mraEisTenantEntitlement.findFirst({
        where: { tenantId, isCurrent: true },
        orderBy: { version: 'desc' },
        select: { status: true },
      });
      entitlementStatus = ent?.status || null;
    } catch {
      entitlementStatus = null;
    }
  }

  let hasActiveOwnership = null;
  let ownershipKnown = false;
  if (typeof prisma?.customerOwnership?.findMany === 'function') {
    try {
      const rows = await prisma.customerOwnership.findMany({
        where: { tenantId, ...activeOwnershipWhere(now) },
        select: { id: true },
        take: 1,
      });
      hasActiveOwnership = (rows || []).length > 0;
      ownershipKnown = true;
    } catch {
      ownershipKnown = false;
    }
  }

  return {
    tenant,
    lastLoginAt,
    subscriptions,
    outstanding,
    outstandingKnown,
    currency,
    entitlementStatus,
    hasActiveOwnership,
    ownershipKnown,
    now,
  };
}

async function persistCandidates(prisma, tenantId, candidates, now) {
  if (!hasCustomerSignalModel(prisma)) {
    return candidates.map((c) => {
      const entry = catalogueEntry(c.code);
      return serializeSignal({
        id: ephemeralId(tenantId, c.code),
        tenantId,
        code: c.code,
        severity: entry?.severity,
        status: SIGNAL_STATUS.NEW,
        payload: c.payload,
        firstDetectedAt: now,
        lastDetectedAt: now,
        ruleVersion: CUSTOMER_SIGNAL_RULE_VERSION,
        ephemeral: true,
      });
    });
  }

  const activeCodes = new Set(candidates.map((c) => c.code));
  let existing = [];
  try {
    existing = await prisma.customerSignal.findMany({
      where: { tenantId },
    });
  } catch {
    return candidates.map((c) => {
      const entry = catalogueEntry(c.code);
      return serializeSignal({
        id: ephemeralId(tenantId, c.code),
        tenantId,
        code: c.code,
        severity: entry?.severity,
        status: SIGNAL_STATUS.NEW,
        payload: c.payload,
        firstDetectedAt: now,
        lastDetectedAt: now,
        ruleVersion: CUSTOMER_SIGNAL_RULE_VERSION,
        ephemeral: true,
      });
    });
  }

  const byCode = new Map((existing || []).map((r) => [r.code, r]));
  const out = [];

  for (const c of candidates) {
    const entry = catalogueEntry(c.code);
    const prev = byCode.get(c.code);
    if (!prev) {
      try {
        const created = await prisma.customerSignal.create({
          data: {
            tenantId,
            code: c.code,
            severity: entry.severity,
            status: SIGNAL_STATUS.NEW,
            payload: c.payload,
            firstDetectedAt: now,
            lastDetectedAt: now,
            ruleVersion: CUSTOMER_SIGNAL_RULE_VERSION,
          },
        });
        out.push(serializeSignal(created));
      } catch {
        out.push(
          serializeSignal({
            id: ephemeralId(tenantId, c.code),
            tenantId,
            code: c.code,
            severity: entry.severity,
            status: SIGNAL_STATUS.NEW,
            payload: c.payload,
            firstDetectedAt: now,
            lastDetectedAt: now,
            ruleVersion: CUSTOMER_SIGNAL_RULE_VERSION,
            ephemeral: true,
          })
        );
      }
      continue;
    }

    // Source still true: refresh lastDetectedAt; keep ACKNOWLEDGED/DISMISSED
    let nextStatus = prev.status;
    if (prev.status === SIGNAL_STATUS.RESOLVED_BY_SOURCE) {
      nextStatus = SIGNAL_STATUS.NEW;
    }
    try {
      const updated = await prisma.customerSignal.update({
        where: { id: prev.id },
        data: {
          severity: entry.severity,
          status: nextStatus,
          payload: {
            ...(typeof prev.payload === 'object' && prev.payload ? prev.payload : {}),
            ...c.payload,
          },
          lastDetectedAt: now,
          ruleVersion: CUSTOMER_SIGNAL_RULE_VERSION,
        },
      });
      out.push(serializeSignal(updated));
    } catch {
      out.push(serializeSignal({ ...prev, lastDetectedAt: now, payload: c.payload }));
    }
  }

  // Resolve open signals no longer detected by source
  for (const prev of existing || []) {
    if (activeCodes.has(prev.code)) continue;
    if (!OPEN_STATUSES.includes(prev.status) && prev.status !== SIGNAL_STATUS.DISMISSED) {
      continue;
    }
    if (prev.status === SIGNAL_STATUS.DISMISSED) continue;
    try {
      await prisma.customerSignal.update({
        where: { id: prev.id },
        data: {
          status: SIGNAL_STATUS.RESOLVED_BY_SOURCE,
          lastDetectedAt: now,
          payload: {
            ...(typeof prev.payload === 'object' && prev.payload ? prev.payload : {}),
            resolvedReason: 'source_cleared',
          },
        },
      });
    } catch {
      /* non-fatal */
    }
  }

  return out.filter((s) => OPEN_STATUSES.includes(s.status) || s.status === SIGNAL_STATUS.NEW);
}

/**
 * Evaluate (and optionally persist) signals for one tenant.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tenantId
 * @param {{
 *   now?: Date,
 *   currency?: string,
 *   persist?: boolean,
 *   inactivityDays?: number,
 *   renewalWindowDays?: number,
 * }} [ctx]
 */
export async function evaluateTenantSignals(prisma, tenantId, ctx = {}) {
  const now = ctx.now || new Date();
  const tid = tenantId ? String(tenantId) : '';
  if (!tid) {
    return {
      ok: false,
      error: 'tenantId required',
      ruleVersion: CUSTOMER_SIGNAL_RULE_VERSION,
      signals: [],
      buckets: { risk: [], opportunity: [], attention: [] },
    };
  }

  const facts = await loadTenantFacts(prisma, tid, {
    now,
    currency: ctx.currency || 'MWK',
  });
  if (!facts) {
    return {
      ok: false,
      notFound: true,
      error: 'Tenant not found',
      ruleVersion: CUSTOMER_SIGNAL_RULE_VERSION,
      signals: [],
      buckets: { risk: [], opportunity: [], attention: [] },
    };
  }

  const candidates = deriveCandidateSignals({
    ...facts,
    inactivityDays: ctx.inactivityDays,
    renewalWindowDays: ctx.renewalWindowDays,
  });

  const persist = ctx.persist !== false;
  let signals;
  if (persist) {
    signals = await persistCandidates(prisma, tid, candidates, now);
  } else {
    signals = candidates.map((c) => {
      const entry = catalogueEntry(c.code);
      return serializeSignal({
        id: ephemeralId(tid, c.code),
        tenantId: tid,
        code: c.code,
        severity: entry?.severity,
        status: SIGNAL_STATUS.NEW,
        payload: c.payload,
        firstDetectedAt: now,
        lastDetectedAt: now,
        ruleVersion: CUSTOMER_SIGNAL_RULE_VERSION,
        ephemeral: !hasCustomerSignalModel(prisma),
      });
    });
  }

  // For 360: show open + dismissed? Prefer open only; include ACKNOWLEDGED
  const open = signals.filter(
    (s) =>
      s.status === SIGNAL_STATUS.NEW ||
      s.status === SIGNAL_STATUS.ACKNOWLEDGED
  );

  const buckets = {
    risk: open.filter((s) => s.kind === SIGNAL_KIND.RISK),
    opportunity: open.filter((s) => s.kind === SIGNAL_KIND.OPPORTUNITY),
    attention: open.filter((s) => s.kind === SIGNAL_KIND.ATTENTION),
  };

  return {
    ok: true,
    tenantId: tid,
    ruleVersion: CUSTOMER_SIGNAL_RULE_VERSION,
    catalogueVersion: CUSTOMER_SIGNAL_RULE_VERSION,
    persistence: hasCustomerSignalModel(prisma) ? 'CustomerSignal' : 'ephemeral',
    signals: open,
    buckets,
    limitations: [
      'Deterministic verified-source signals only — no probability, expected revenue, or health score.',
      'Adoption / FEATURE_USED signals are NOT_SUPPORTED.',
      'Support escalation signals are NOT_INSTRUMENTED.',
      !hasCustomerSignalModel(prisma)
        ? 'CustomerSignal table unavailable — ephemeral evaluation (run SQL fallback / prisma generate to persist).'
        : null,
    ].filter(Boolean),
  };
}

/**
 * Portfolio-scoped attention queue.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   limit?: number,
 *   queue?: string,
 *   now?: Date,
 *   currency?: string,
 *   persist?: boolean,
 * }} opts
 */
export async function evaluateAttentionQueue(prisma, opts = {}) {
  const access = resolveCustomerAccess(opts.admin);
  if (!access.canView) {
    return {
      ok: false,
      forbidden: true,
      ruleVersion: CUSTOMER_SIGNAL_RULE_VERSION,
      items: [],
    };
  }

  const now = opts.now || new Date();
  const limit = Math.min(200, Math.max(1, parseInt(String(opts.limit || 50), 10) || 50));
  const queue = String(opts.queue || 'attention').toLowerCase();

  const scope = await resolvePortfolioScope(prisma, opts.admin, { now });
  if (!scope.canViewCustomers) {
    return {
      ok: false,
      forbidden: true,
      ruleVersion: CUSTOMER_SIGNAL_RULE_VERSION,
      items: [],
    };
  }

  let where = applyPortfolioTenantWhere({}, scope);
  const scanTake = Math.min(500, Math.max(limit * 4, 50));

  let tenants = [];
  try {
    tenants = await prisma.tenant.findMany({
      where,
      select: { id: true, name: true, subdomain: true, status: true },
      orderBy: { updatedAt: 'desc' },
      take: scanTake,
    });
  } catch (e) {
    return {
      ok: false,
      status: 'UNAVAILABLE',
      error: e?.message || 'Tenant scan failed',
      ruleVersion: CUSTOMER_SIGNAL_RULE_VERSION,
      items: [],
    };
  }

  const items = [];
  for (const t of tenants || []) {
    const evaluated = await evaluateTenantSignals(prisma, t.id, {
      now,
      currency: opts.currency || 'MWK',
      persist: opts.persist !== false,
    });
    if (!evaluated.ok) continue;
    for (const s of evaluated.signals || []) {
      if (queue === 'risk' && s.kind !== SIGNAL_KIND.RISK) continue;
      if (queue === 'opportunity' && s.kind !== SIGNAL_KIND.OPPORTUNITY) continue;
      // default / attention: risk + attention (excludes opportunity-only)
      if (
        (queue === 'attention' || queue === 'default') &&
        s.kind === SIGNAL_KIND.OPPORTUNITY
      ) {
        continue;
      }
      items.push({
        ...s,
        tenantName: t.name || t.subdomain || t.id,
        tenantReference: t.subdomain || t.id,
        tenantStatus: t.status || null,
      });
    }
  }

  items.sort((a, b) => {
    const ra = SEVERITY_RANK[a.severity] ?? 9;
    const rb = SEVERITY_RANK[b.severity] ?? 9;
    if (ra !== rb) return ra - rb;
    const ta = a.lastDetectedAt || '';
    const tb = b.lastDetectedAt || '';
    return tb.localeCompare(ta);
  });

  return {
    ok: true,
    ruleVersion: CUSTOMER_SIGNAL_RULE_VERSION,
    queue,
    scope: {
      mode: scope.mode,
      isAgentScoped: scope.isAgentScoped,
      tenantCountScanned: (tenants || []).length,
    },
    persistence: hasCustomerSignalModel(prisma) ? 'CustomerSignal' : 'ephemeral',
    items: items.slice(0, limit),
    totalMatched: items.length,
    catalogue: Object.values(SIGNAL_CATALOGUE),
    limitations: [
      'Deterministic verified-source signals only.',
      'Portfolio scope applied — agents with ownership only see their tenants.',
      'Adoption / FEATURE_USED NOT_SUPPORTED; support escalation NOT_INSTRUMENTED.',
    ],
  };
}

/**
 * Acknowledge or dismiss a persisted (or ephemeral) signal.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   signalId: string,
 *   action: 'acknowledge'|'dismiss',
 *   reason?: string,
 *   now?: Date,
 * }} opts
 */
export async function updateCustomerSignalState(prisma, opts = {}) {
  const access = resolveCustomerAccess(opts.admin);
  if (!access.canView) {
    return { ok: false, forbidden: true };
  }

  const signalId = opts.signalId ? String(opts.signalId) : '';
  const action = String(opts.action || '').toLowerCase();
  const now = opts.now || new Date();
  const reason = opts.reason ? String(opts.reason).trim() : '';

  if (!signalId) {
    return { ok: false, error: 'signalId required' };
  }
  if (action !== 'acknowledge' && action !== 'dismiss') {
    return { ok: false, error: 'action must be acknowledge or dismiss' };
  }
  if (action === 'dismiss' && !reason) {
    return { ok: false, error: 'reason required to dismiss' };
  }

  // Ephemeral ids cannot be persisted — return acknowledgement shape only
  if (signalId.startsWith('ephemeral:')) {
    const parts = signalId.split(':');
    const tenantId = parts[1] || null;
    const code = parts.slice(2).join(':') || null;
    if (tenantId) {
      const scopeCheck = await resolvePortfolioScope(prisma, opts.admin, { now });
      if (
        scopeCheck.mode === 'owned' &&
        !(scopeCheck.tenantIds || []).includes(tenantId)
      ) {
        return { ok: false, forbidden: true, reason: 'out_of_portfolio_scope' };
      }
    }
    return {
      ok: true,
      ephemeral: true,
      signal: serializeSignal({
        id: signalId,
        tenantId,
        code,
        severity: catalogueEntry(code)?.severity,
        status:
          action === 'dismiss' ? SIGNAL_STATUS.DISMISSED : SIGNAL_STATUS.ACKNOWLEDGED,
        payload: {
          reason: reason || null,
          actionByAdminId: opts.admin?.id || null,
          actionAt: now.toISOString(),
          note: 'Ephemeral signal — state not persisted (CustomerSignal unavailable)',
        },
        firstDetectedAt: now,
        lastDetectedAt: now,
        ruleVersion: CUSTOMER_SIGNAL_RULE_VERSION,
        ephemeral: true,
      }),
    };
  }

  if (!hasCustomerSignalModel(prisma)) {
    return {
      ok: false,
      status: 'UNAVAILABLE',
      error: 'CustomerSignal model unavailable',
    };
  }

  let row;
  try {
    row = await prisma.customerSignal.findUnique({ where: { id: signalId } });
  } catch (e) {
    return { ok: false, error: e?.message || 'Signal lookup failed' };
  }
  if (!row) {
    return { ok: false, notFound: true, error: 'Signal not found' };
  }

  const scope = await resolvePortfolioScope(prisma, opts.admin, { now });
  if (
    scope.mode === 'owned' &&
    !(scope.tenantIds || []).includes(row.tenantId)
  ) {
    return { ok: false, forbidden: true, reason: 'out_of_portfolio_scope' };
  }

  const nextStatus =
    action === 'dismiss' ? SIGNAL_STATUS.DISMISSED : SIGNAL_STATUS.ACKNOWLEDGED;
  const payload = {
    ...(typeof row.payload === 'object' && row.payload ? row.payload : {}),
    reason: reason || null,
    actionByAdminId: opts.admin?.id || null,
    actionAt: now.toISOString(),
  };

  try {
    const updated = await prisma.customerSignal.update({
      where: { id: signalId },
      data: {
        status: nextStatus,
        payload,
        lastDetectedAt: row.lastDetectedAt || now,
      },
    });
    return { ok: true, signal: serializeSignal(updated) };
  } catch (e) {
    return { ok: false, error: e?.message || 'Failed to update signal' };
  }
}

/**
 * Shape for Customer 360 signals section.
 */
export async function buildSignalsSection(prisma, tenantId, ctx = {}) {
  const result = await evaluateTenantSignals(prisma, tenantId, {
    ...ctx,
    persist: ctx.persist !== false,
  });
  if (!result.ok) {
    return {
      risk: [],
      opportunity: [],
      attention: [],
      status: result.notFound ? 'UNAVAILABLE' : 'UNAVAILABLE',
      ruleVersion: CUSTOMER_SIGNAL_RULE_VERSION,
      limitations: result.error || 'Signal evaluation failed',
    };
  }
  return {
    risk: result.buckets.risk,
    opportunity: result.buckets.opportunity,
    attention: result.buckets.attention,
    status: 'READY_WITH_LIMITATIONS',
    ruleVersion: CUSTOMER_SIGNAL_RULE_VERSION,
    persistence: result.persistence,
    limitations: (result.limitations || []).join(' '),
  };
}
