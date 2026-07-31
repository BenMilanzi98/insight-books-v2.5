/**
 * Versioned product funnels — instrumented commerce / EIS only (Phase 9 Wave 4).
 * Missing events → incomplete (null conversion), never false zero conversion.
 */

import {
  PRODUCT_FEATURE_CODES,
  isInstrumentedFeature,
} from '@/lib/admin/productCatalogue/features.js';
import {
  resolveFeatureEntitlement,
  ENTITLEMENT_STATUS,
} from '@/lib/admin/productCatalogue/entitlements.js';
import { listProductUsageFacts } from './facts.js';
import { loadFirstValue, FIRST_VALUE_RULE_VERSION } from './firstValue.js';
import { evaluateRepeatValue, REPEAT_VALUE_RULE_VERSION } from './repeatValue.js';
import { resolvePortfolioScope } from '@/lib/admin/customers/portfolioScope.js';
import { resolveProductAnalyticsAccess } from './authz.js';
import { PRODUCT_RELIABILITY_STATUS } from './catalogue.js';

export const FUNNEL_DEFINITION_VERSION = 'product-funnels-2026-07-29';

export const FUNNEL_CODES = Object.freeze({
  COMMERCE_INVOICE_VALUE: 'commerce.invoice.value',
  COMMERCE_POS_VALUE: 'commerce.pos.value',
  EIS_OPERATIONAL: 'eis.operational',
});

export const FUNNEL_STEP_STATUS = Object.freeze({
  REACHED: 'REACHED',
  NOT_REACHED: 'NOT_REACHED',
  INCOMPLETE: 'INCOMPLETE',
  NOT_INSTRUMENTED: 'NOT_INSTRUMENTED',
  UNAVAILABLE: 'UNAVAILABLE',
});

/** @type {Record<string, { code: string, name: string, featureCode: string, steps: { id: string, label: string }[] }>} */
export const FUNNEL_DEFINITIONS = Object.freeze({
  [FUNNEL_CODES.COMMERCE_INVOICE_VALUE]: {
    code: FUNNEL_CODES.COMMERCE_INVOICE_VALUE,
    name: 'Invoice commerce value',
    featureCode: PRODUCT_FEATURE_CODES.INVOICES_POST,
    steps: [
      { id: 'entitled', label: 'Entitled' },
      { id: 'available', label: 'Available' },
      { id: 'first_value', label: 'First invoice post' },
      { id: 'repeat', label: 'Repeat value' },
    ],
  },
  [FUNNEL_CODES.COMMERCE_POS_VALUE]: {
    code: FUNNEL_CODES.COMMERCE_POS_VALUE,
    name: 'POS commerce value',
    featureCode: PRODUCT_FEATURE_CODES.SALES_POS_COMPLETE,
    steps: [
      { id: 'entitled', label: 'Entitled' },
      { id: 'first_value', label: 'First POS complete' },
      { id: 'repeat', label: 'Repeat value' },
    ],
  },
  [FUNNEL_CODES.EIS_OPERATIONAL]: {
    code: FUNNEL_CODES.EIS_OPERATIONAL,
    name: 'EIS operational value',
    featureCode: PRODUCT_FEATURE_CODES.EIS_FISCAL_ACCEPT,
    steps: [
      { id: 'entitled', label: 'Entitled / subscribed' },
      { id: 'available', label: 'Entitlement available' },
      { id: 'first_value', label: 'First accepted' },
      { id: 'repeat', label: 'Repeat accepted' },
    ],
  },
});

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
 * Pure step-order honesty: later REACHED only when all prior steps REACHED.
 * @param {{ id: string, status: string }[]} steps
 */
export function enforceFunnelStepOrder(steps) {
  let blocked = false;
  return (steps || []).map((step) => {
    if (blocked) {
      if (step.status === FUNNEL_STEP_STATUS.REACHED) {
        return {
          ...step,
          status: FUNNEL_STEP_STATUS.INCOMPLETE,
          reasonCode: 'prior_step_missing',
          reasonMessage: 'Later step cannot be complete without prior evidence',
        };
      }
      return step;
    }
    if (
      step.status === FUNNEL_STEP_STATUS.NOT_REACHED ||
      step.status === FUNNEL_STEP_STATUS.INCOMPLETE ||
      step.status === FUNNEL_STEP_STATUS.UNAVAILABLE ||
      step.status === FUNNEL_STEP_STATUS.NOT_INSTRUMENTED
    ) {
      blocked = true;
    }
    return step;
  });
}

/**
 * Conversion between consecutive reached steps — null when incomplete (never 0 invent).
 */
export function funnelConversionRate(fromCount, toCount, fromComplete) {
  if (!fromComplete) return null;
  if (fromCount == null || toCount == null) return null;
  if (fromCount <= 0) return null;
  return toCount / fromCount;
}

/**
 * Evaluate one funnel for a tenant.
 * @param {object} prisma
 * @param {{ funnelCode: string, tenantId: string, asOf?: Date }} args
 */
export async function evaluateProductFunnel(prisma, args = {}) {
  const funnelCode = args.funnelCode ? String(args.funnelCode) : '';
  const tenantId = args.tenantId ? String(args.tenantId) : '';
  const def = FUNNEL_DEFINITIONS[funnelCode];

  if (!def) {
    return {
      ok: false,
      status: PRODUCT_RELIABILITY_STATUS.DEFINITION_MISSING,
      reasonCode: 'unknown_funnel',
      funnelCode,
      definitionVersion: FUNNEL_DEFINITION_VERSION,
    };
  }

  if (!tenantId) {
    return {
      ok: false,
      status: PRODUCT_RELIABILITY_STATUS.DATA_QUALITY_BLOCKED,
      reasonCode: 'tenant_required',
      funnelCode,
      definitionVersion: FUNNEL_DEFINITION_VERSION,
    };
  }

  if (!isInstrumentedFeature(def.featureCode)) {
    return {
      ok: true,
      status: PRODUCT_RELIABILITY_STATUS.NOT_INSTRUMENTED,
      reasonCode: 'not_instrumented',
      funnelCode,
      featureCode: def.featureCode,
      definitionVersion: FUNNEL_DEFINITION_VERSION,
      steps: def.steps.map((s) => ({
        id: s.id,
        label: s.label,
        status: FUNNEL_STEP_STATUS.NOT_INSTRUMENTED,
      })),
      conversionRates: {},
      complete: false,
    };
  }

  const entitlement = await resolveFeatureEntitlement(prisma, {
    tenantId,
    featureCode: def.featureCode,
    asOf: args.asOf,
  });
  const entitled = isEntitled(entitlement);
  const available = entitled && entitlement.enabled !== false;

  let firstValue = null;
  let facts = [];
  let repeat = null;
  let evidenceUnavailable = false;

  try {
    firstValue = await loadFirstValue(prisma, {
      tenantId,
      featureCode: def.featureCode,
      ruleVersion: FIRST_VALUE_RULE_VERSION,
    });
    facts = await listProductUsageFacts(prisma, {
      tenantId,
      featureCode: def.featureCode,
    });
    repeat = await evaluateRepeatValue(prisma, {
      tenantId,
      featureCode: def.featureCode,
      rule: { ruleVersion: REPEAT_VALUE_RULE_VERSION },
    });
  } catch {
    evidenceUnavailable = true;
  }

  if (evidenceUnavailable) {
    return {
      ok: true,
      status: PRODUCT_RELIABILITY_STATUS.DATA_QUALITY_BLOCKED,
      reasonCode: 'evidence_unavailable',
      funnelCode,
      featureCode: def.featureCode,
      definitionVersion: FUNNEL_DEFINITION_VERSION,
      steps: def.steps.map((s) => ({
        id: s.id,
        label: s.label,
        status: FUNNEL_STEP_STATUS.UNAVAILABLE,
      })),
      conversionRates: {},
      complete: false,
      note: 'Missing event/fact reads → incomplete funnel, not zero conversion',
    };
  }

  const hasFirst = Boolean(firstValue?.id || firstValue?.sourceId);
  const hasRepeat = Boolean(repeat?.achieved);

  /** Distinct source ids — retries/reprints sharing source do not inflate. */
  const distinctSources = new Set(
    (facts || []).map((f) => String(f.sourceId || '')).filter(Boolean)
  );

  const rawSteps = def.steps.map((s) => {
    if (s.id === 'entitled') {
      return {
        id: s.id,
        label: s.label,
        status: entitled ? FUNNEL_STEP_STATUS.REACHED : FUNNEL_STEP_STATUS.NOT_REACHED,
        evidence: entitled ? entitlement.source || 'entitlement' : null,
      };
    }
    if (s.id === 'available') {
      return {
        id: s.id,
        label: s.label,
        status: available ? FUNNEL_STEP_STATUS.REACHED : FUNNEL_STEP_STATUS.NOT_REACHED,
        evidence: available ? 'entitlement_enabled' : null,
      };
    }
    if (s.id === 'first_value') {
      if (!facts?.length && !hasFirst) {
        return {
          id: s.id,
          label: s.label,
          status: FUNNEL_STEP_STATUS.INCOMPLETE,
          reasonCode: 'missing_events',
          reasonMessage: 'No verified usage facts — incomplete, not zero conversion',
        };
      }
      return {
        id: s.id,
        label: s.label,
        status: hasFirst ? FUNNEL_STEP_STATUS.REACHED : FUNNEL_STEP_STATUS.NOT_REACHED,
        evidence: hasFirst ? firstValue.sourceId || firstValue.id : null,
        distinctSourceCount: distinctSources.size,
      };
    }
    if (s.id === 'repeat') {
      if (!hasFirst) {
        return {
          id: s.id,
          label: s.label,
          status: FUNNEL_STEP_STATUS.INCOMPLETE,
          reasonCode: 'prior_step_missing',
        };
      }
      return {
        id: s.id,
        label: s.label,
        status: hasRepeat ? FUNNEL_STEP_STATUS.REACHED : FUNNEL_STEP_STATUS.NOT_REACHED,
        evidence: hasRepeat ? 'repeat_value' : null,
        distinctSourceCount: distinctSources.size,
      };
    }
    return {
      id: s.id,
      label: s.label,
      status: FUNNEL_STEP_STATUS.UNAVAILABLE,
    };
  });

  const steps = enforceFunnelStepOrder(rawSteps);
  const reached = steps.filter((s) => s.status === FUNNEL_STEP_STATUS.REACHED).length;
  const complete = steps.every((s) => s.status === FUNNEL_STEP_STATUS.REACHED);

  const conversionRates = {};
  for (let i = 0; i < steps.length - 1; i++) {
    const from = steps[i];
    const to = steps[i + 1];
    const key = `${from.id}_to_${to.id}`;
    const fromOk = from.status === FUNNEL_STEP_STATUS.REACHED;
    // Per-tenant binary rates: 1 if next reached, null if incomplete/missing
    if (!fromOk) {
      conversionRates[key] = null;
    } else if (
      to.status === FUNNEL_STEP_STATUS.INCOMPLETE ||
      to.status === FUNNEL_STEP_STATUS.UNAVAILABLE
    ) {
      conversionRates[key] = null;
    } else {
      conversionRates[key] = to.status === FUNNEL_STEP_STATUS.REACHED ? 1 : 0;
    }
  }

  return {
    ok: true,
    status: complete
      ? PRODUCT_RELIABILITY_STATUS.AVAILABLE
      : PRODUCT_RELIABILITY_STATUS.LOW_SAMPLE,
    funnelCode,
    name: def.name,
    featureCode: def.featureCode,
    tenantId,
    definitionVersion: FUNNEL_DEFINITION_VERSION,
    steps,
    conversionRates,
    reachedSteps: reached,
    stepCount: steps.length,
    complete,
    notes: [
      'Retries sharing the same sourceId do not create duplicate funnel progress',
      'Missing events yield incomplete steps — conversion null, not invented 0%',
    ],
  };
}

/**
 * List funnel definition catalogue + optional tenant evaluation.
 */
export async function buildProductFunnelsPack(prisma, opts = {}) {
  const access = resolveProductAnalyticsAccess(opts.admin);
  if (!access.canView) {
    return { forbidden: true, definitionVersion: FUNNEL_DEFINITION_VERSION };
  }

  const scope = await resolvePortfolioScope(prisma, opts.admin, { now: opts.now });
  if (opts.tenantId) {
    const tid = String(opts.tenantId);
    if (scope.mode === 'owned' && !(scope.tenantIds || []).includes(tid)) {
      return {
        forbidden: true,
        definitionVersion: FUNNEL_DEFINITION_VERSION,
        reasonCode: 'tenant_out_of_portfolio',
        portfolioMode: scope.mode,
      };
    }
    if (scope.mode === 'none') {
      return {
        forbidden: true,
        definitionVersion: FUNNEL_DEFINITION_VERSION,
        reasonCode: 'tenant_out_of_portfolio',
        portfolioMode: scope.mode,
      };
    }
  }

  const definitions = Object.values(FUNNEL_DEFINITIONS).map((d) => ({
    code: d.code,
    name: d.name,
    featureCode: d.featureCode,
    instrumented: isInstrumentedFeature(d.featureCode),
    steps: d.steps,
    definitionVersion: FUNNEL_DEFINITION_VERSION,
  }));

  let evaluation = null;
  if (opts.tenantId && opts.funnelCode) {
    evaluation = await evaluateProductFunnel(prisma, {
      funnelCode: opts.funnelCode,
      tenantId: opts.tenantId,
      asOf: opts.now,
    });
  }

  return {
    forbidden: false,
    definitionVersion: FUNNEL_DEFINITION_VERSION,
    generatedAt: (opts.now || new Date()).toISOString(),
    portfolioMode: scope.mode,
    definitions,
    evaluation,
    limitations: [
      'Funnels only for instrumented Invoice / POS / EIS accept features',
      'Incomplete when events missing — never false zero conversion',
    ],
  };
}
