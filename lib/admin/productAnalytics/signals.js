/**
 * Deterministic product risk / opportunity signals (Phase 9 Wave 4).
 * No invented probability or revenue. Idempotent identity per tenant+code+feature.
 */

import {
  INSTRUMENTED_FEATURE_CODES,
  isInstrumentedFeature,
  PRODUCT_FEATURE_CODES,
} from '@/lib/admin/productCatalogue/features.js';
import {
  resolveFeatureEntitlement,
  ENTITLEMENT_STATUS,
} from '@/lib/admin/productCatalogue/entitlements.js';
import { loadFirstValue, FIRST_VALUE_RULE_VERSION } from './firstValue.js';
import { evaluateRepeatValue } from './repeatValue.js';
import { listProductUsageFacts } from './facts.js';
import { resolvePortfolioScope } from '@/lib/admin/customers/portfolioScope.js';
import { resolveProductAnalyticsAccess } from './authz.js';
import { PRODUCT_RELIABILITY_STATUS } from './catalogue.js';

export const PRODUCT_SIGNAL_RULE_VERSION = 'product-signals-2026-07-29';

export const PRODUCT_SIGNAL_CODES = Object.freeze({
  ENTITLED_NO_FIRST_VALUE: 'product.entitled_no_first_value',
  FIRST_VALUE_NO_REPEAT: 'product.first_value_no_repeat',
  VALUE_THEN_INACTIVE: 'product.value_then_inactive',
});

export const PRODUCT_SIGNAL_SEVERITY = Object.freeze({
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
});

export const PRODUCT_SIGNAL_KIND = Object.freeze({
  RISK: 'risk',
  OPPORTUNITY: 'opportunity',
  ATTENTION: 'attention',
});

export const PRODUCT_SIGNAL_CATALOGUE = Object.freeze({
  [PRODUCT_SIGNAL_CODES.ENTITLED_NO_FIRST_VALUE]: {
    code: PRODUCT_SIGNAL_CODES.ENTITLED_NO_FIRST_VALUE,
    severity: PRODUCT_SIGNAL_SEVERITY.MEDIUM,
    kind: PRODUCT_SIGNAL_KIND.OPPORTUNITY,
    title: 'Entitled without first value',
    source: 'entitlement + ProductFirstValueFact absence',
  },
  [PRODUCT_SIGNAL_CODES.FIRST_VALUE_NO_REPEAT]: {
    code: PRODUCT_SIGNAL_CODES.FIRST_VALUE_NO_REPEAT,
    severity: PRODUCT_SIGNAL_SEVERITY.LOW,
    kind: PRODUCT_SIGNAL_KIND.ATTENTION,
    title: 'First value without repeat',
    source: 'first-value + repeat-value engines',
  },
  [PRODUCT_SIGNAL_CODES.VALUE_THEN_INACTIVE]: {
    code: PRODUCT_SIGNAL_CODES.VALUE_THEN_INACTIVE,
    severity: PRODUCT_SIGNAL_SEVERITY.HIGH,
    kind: PRODUCT_SIGNAL_KIND.RISK,
    title: 'Value achieved then inactive',
    source: 'usage facts last occurredAt vs inactivity window',
  },
});

const FORBIDDEN_PAYLOAD_KEYS = [
  'probability',
  'expectedRevenue',
  'expected_revenue',
  'churnProbability',
  'churn_probability',
  'score',
  'healthScore',
  'health_score',
];

/**
 * Stable idempotent signal identity.
 */
export function productSignalIdentity(tenantId, code, featureCode) {
  return `psig:${String(tenantId)}:${String(code)}:${String(featureCode)}`;
}

function stripForbidden(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const out = { ...obj };
  for (const k of FORBIDDEN_PAYLOAD_KEYS) {
    if (k in out) delete out[k];
  }
  return out;
}

function isEntitled(entitlement) {
  if (!entitlement) return false;
  if (entitlement.enabled === true) return true;
  return [
    ENTITLEMENT_STATUS.INCLUDED,
    ENTITLEMENT_STATUS.OPTIONAL_ADD_ON,
    ENTITLEMENT_STATUS.GRANDFATHERED,
    ENTITLEMENT_STATUS.CUSTOM_CONTRACT,
  ].includes(entitlement.status);
}

/**
 * Pure evaluation from verified facts — deterministic, no ML scores.
 * @param {{
 *   tenantId: string,
 *   featureCode: string,
 *   entitled?: boolean,
 *   hasFirstValue?: boolean,
 *   hasRepeat?: boolean,
 *   lastOccurredAt?: Date|string|null,
 *   now?: Date,
 *   inactivityDays?: number,
 * }} input
 */
export function evaluateProductSignalCandidates(input = {}) {
  const tenantId = String(input.tenantId || '');
  const featureCode = String(input.featureCode || '');
  const now = input.now instanceof Date ? input.now : new Date();
  const inactivityDays =
    Number(input.inactivityDays) > 0 ? Number(input.inactivityDays) : 30;
  const candidates = [];

  if (!tenantId || !featureCode || !isInstrumentedFeature(featureCode)) {
    return candidates;
  }

  if (input.entitled && !input.hasFirstValue) {
    candidates.push({
      code: PRODUCT_SIGNAL_CODES.ENTITLED_NO_FIRST_VALUE,
      featureCode,
      tenantId,
      identity: productSignalIdentity(
        tenantId,
        PRODUCT_SIGNAL_CODES.ENTITLED_NO_FIRST_VALUE,
        featureCode
      ),
      payload: stripForbidden({ featureCode, entitled: true, hasFirstValue: false }),
    });
  }

  if (input.hasFirstValue && !input.hasRepeat) {
    candidates.push({
      code: PRODUCT_SIGNAL_CODES.FIRST_VALUE_NO_REPEAT,
      featureCode,
      tenantId,
      identity: productSignalIdentity(
        tenantId,
        PRODUCT_SIGNAL_CODES.FIRST_VALUE_NO_REPEAT,
        featureCode
      ),
      payload: stripForbidden({ featureCode, hasFirstValue: true, hasRepeat: false }),
    });
  }

  if (input.hasFirstValue && input.lastOccurredAt) {
    const last = new Date(input.lastOccurredAt);
    if (!Number.isNaN(last.getTime())) {
      const days = (now.getTime() - last.getTime()) / (24 * 60 * 60 * 1000);
      if (days >= inactivityDays) {
        candidates.push({
          code: PRODUCT_SIGNAL_CODES.VALUE_THEN_INACTIVE,
          featureCode,
          tenantId,
          identity: productSignalIdentity(
            tenantId,
            PRODUCT_SIGNAL_CODES.VALUE_THEN_INACTIVE,
            featureCode
          ),
          payload: stripForbidden({
            featureCode,
            inactivityDays,
            daysSinceLastValue: Math.floor(days),
            lastOccurredAt: last.toISOString(),
          }),
        });
      }
    }
  }

  return candidates;
}

/**
 * Dedupe by identity — last wins, stable identity preserved.
 * @param {Array<{ identity: string }>} signals
 */
export function dedupeProductSignals(signals) {
  const map = new Map();
  for (const s of signals || []) {
    if (!s?.identity) continue;
    map.set(s.identity, s);
  }
  return [...map.values()].sort((a, b) => a.identity.localeCompare(b.identity));
}

function serializeSignal(candidate, detectedAt) {
  const entry = PRODUCT_SIGNAL_CATALOGUE[candidate.code] || {};
  return stripForbidden({
    id: candidate.identity,
    identity: candidate.identity,
    tenantId: candidate.tenantId,
    code: candidate.code,
    featureCode: candidate.featureCode,
    severity: entry.severity || PRODUCT_SIGNAL_SEVERITY.LOW,
    kind: entry.kind || PRODUCT_SIGNAL_KIND.ATTENTION,
    title: entry.title || candidate.code,
    source: entry.source || null,
    payload: stripForbidden(candidate.payload || {}),
    firstDetectedAt: detectedAt,
    lastDetectedAt: detectedAt,
    ruleVersion: PRODUCT_SIGNAL_RULE_VERSION,
  });
}

/**
 * Evaluate signals for one tenant across instrumented features.
 */
export async function evaluateProductSignalsForTenant(prisma, args = {}) {
  const tenantId = args.tenantId ? String(args.tenantId) : '';
  const now = args.now instanceof Date ? args.now : new Date();
  if (!tenantId) {
    return { ok: false, reasonCode: 'tenant_required', signals: [] };
  }

  const featureCodes = args.featureCode
    ? [String(args.featureCode)]
    : [...INSTRUMENTED_FEATURE_CODES];

  const all = [];
  for (const featureCode of featureCodes) {
    if (!isInstrumentedFeature(featureCode)) continue;

    const entitlement = await resolveFeatureEntitlement(prisma, {
      tenantId,
      featureCode,
      asOf: now,
    });
    const firstValue = await loadFirstValue(prisma, {
      tenantId,
      featureCode,
      ruleVersion: FIRST_VALUE_RULE_VERSION,
    });
    const repeat = await evaluateRepeatValue(prisma, { tenantId, featureCode });
    const facts = await listProductUsageFacts(prisma, { tenantId, featureCode });
    const lastOccurredAt =
      facts.length > 0 ? facts[facts.length - 1].occurredAt : firstValue?.occurredAt;

    const candidates = evaluateProductSignalCandidates({
      tenantId,
      featureCode,
      entitled: isEntitled(entitlement),
      hasFirstValue: Boolean(firstValue?.id || firstValue?.sourceId),
      hasRepeat: Boolean(repeat?.achieved),
      lastOccurredAt,
      now,
      inactivityDays: args.inactivityDays,
    });
    all.push(...candidates);
  }

  const deduped = dedupeProductSignals(all);
  const detectedAt = now.toISOString();
  return {
    ok: true,
    tenantId,
    ruleVersion: PRODUCT_SIGNAL_RULE_VERSION,
    signals: deduped.map((c) => serializeSignal(c, detectedAt)),
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, tenantId?: string, now?: Date }} opts
 */
export async function buildProductSignalsPack(prisma, opts = {}) {
  const access = resolveProductAnalyticsAccess(opts.admin);
  if (!access.canView) {
    return { forbidden: true, ruleVersion: PRODUCT_SIGNAL_RULE_VERSION };
  }

  const scope = await resolvePortfolioScope(prisma, opts.admin, { now: opts.now });
  if (opts.tenantId) {
    const tid = String(opts.tenantId);
    if (
      scope.mode === 'none' ||
      (scope.mode === 'owned' && !(scope.tenantIds || []).includes(tid))
    ) {
      return {
        forbidden: true,
        ruleVersion: PRODUCT_SIGNAL_RULE_VERSION,
        reasonCode: 'tenant_out_of_portfolio',
        portfolioMode: scope.mode,
      };
    }
  }

  const catalogue = Object.values(PRODUCT_SIGNAL_CATALOGUE);
  let evaluation = null;
  if (opts.tenantId) {
    evaluation = await evaluateProductSignalsForTenant(prisma, {
      tenantId: opts.tenantId,
      featureCode: opts.featureCode,
      now: opts.now,
      inactivityDays: opts.inactivityDays,
    });
  }

  return {
    forbidden: false,
    ruleVersion: PRODUCT_SIGNAL_RULE_VERSION,
    status: PRODUCT_RELIABILITY_STATUS.AVAILABLE,
    generatedAt: (opts.now || new Date()).toISOString(),
    portfolioMode: scope.mode,
    catalogue,
    evaluation,
    featureCodes: [
      PRODUCT_FEATURE_CODES.INVOICES_POST,
      PRODUCT_FEATURE_CODES.SALES_POS_COMPLETE,
      PRODUCT_FEATURE_CODES.EIS_FISCAL_ACCEPT,
    ],
    limitations: [
      'Deterministic product signals only — no probability or expected revenue',
      'Identity idempotent per tenant + code + feature',
      'Instrumented commerce / EIS features only',
    ],
  };
}
