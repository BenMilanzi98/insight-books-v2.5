/**
 * Opportunity commercial estimates — Phase 12 Wave 2 / Phase 16 Wave 4 unlock.
 * Amount basis + ISO currency + amount history.
 * Never posts Revenue / Subscription / Invoice.
 * Weighted UI capability enabled in Phase 16; unlock requires honesty + currency gates.
 */

import { resolveCrmAccess, resolveCrmScope } from '../authz.js';
import { hasCrmOpportunityModel, serializeOpportunity } from './model.js';

/**
 * Phase 16 Wave 4 — weighted Pipeline UI capability flag.
 * Actual surface unlock requires resolveWeightedPipelineUiAccess(honesty+currency).
 * Indicative ≠ Revenue.
 */
export const WEIGHTED_PIPELINE_UI_ENABLED = true;

/**
 * Honesty/currency-gated weighted Pipeline UI unlock.
 * Never claims Revenue; indicative only when unlocked.
 *
 * @param {{ honestyOk?: boolean, currencyOk?: boolean, reliabilityOk?: boolean }} gate
 */
export function resolveWeightedPipelineUiAccess(gate = {}) {
  const honestyOk = gate.honestyOk === true || gate.reliabilityOk === true;
  const currencyOk = gate.currencyOk === true;
  const capabilityEnabled = WEIGHTED_PIPELINE_UI_ENABLED === true;

  if (!capabilityEnabled) {
    return {
      unlocked: false,
      weightedUiEnabled: false,
      capabilityEnabled: false,
      isRevenue: false,
      isIndicativeOnly: true,
      reason: 'weighted_pipeline_ui_disabled',
      label: 'indicative_weighted_amount_not_revenue',
    };
  }
  if (!honestyOk) {
    return {
      unlocked: false,
      weightedUiEnabled: false,
      capabilityEnabled: true,
      isRevenue: false,
      isIndicativeOnly: true,
      reason: 'honesty_gate_failed',
      label: 'indicative_weighted_amount_not_revenue',
    };
  }
  if (!currencyOk) {
    return {
      unlocked: false,
      weightedUiEnabled: false,
      capabilityEnabled: true,
      isRevenue: false,
      isIndicativeOnly: true,
      reason: 'currency_gate_failed',
      label: 'indicative_weighted_amount_not_revenue',
    };
  }
  return {
    unlocked: true,
    weightedUiEnabled: true,
    capabilityEnabled: true,
    isRevenue: false,
    isIndicativeOnly: true,
    reason: null,
    label: 'indicative_weighted_amount_not_revenue',
  };
}

export const CRM_AMOUNT_BASIS = Object.freeze({
  FIRST_YEAR_TOTAL: 'FIRST_YEAR_TOTAL',
  RECURRING_ANNUAL: 'RECURRING_ANNUAL',
  ONE_TIME: 'ONE_TIME',
  TOTAL_CONTRACT: 'TOTAL_CONTRACT',
});

export const CRM_AMOUNT_BASES = Object.freeze(Object.values(CRM_AMOUNT_BASIS));

const CURRENCY_RE = /^[A-Z]{3}$/;

export function hasCrmOpportunityAmountHistoryModel(prisma) {
  return typeof prisma?.crmOpportunityAmountHistory?.create === 'function';
}

export function isIso4217Currency(code) {
  return CURRENCY_RE.test(String(code || '').trim().toUpperCase());
}

/**
 * Indicative weighted amount (probability × amount).
 * Never label as Revenue. UI must check WEIGHTED_PIPELINE_UI_ENABLED.
 *
 * @param {{ amount: number|string|null|undefined, probability: number|null|undefined, currency?: string|null }} args
 */
export function computeIndicativeWeightedAmount(args = {}) {
  const amountRaw = args.amount;
  const probability = args.probability;
  const uiAccess = resolveWeightedPipelineUiAccess(args.uiGate || {});

  if (amountRaw == null || amountRaw === '') {
    return {
      ok: false,
      status: 'UNAVAILABLE',
      reason: 'amount_missing',
      weightedUiEnabled: uiAccess.unlocked,
      isRevenue: false,
    };
  }
  if (probability == null || probability === '') {
    return {
      ok: false,
      status: 'UNAVAILABLE',
      reason: 'probability_missing',
      weightedUiEnabled: uiAccess.unlocked,
      isRevenue: false,
    };
  }

  const amount = Number(amountRaw);
  const p = Number(probability);
  if (!Number.isFinite(amount) || amount < 0) {
    return {
      ok: false,
      status: 'UNAVAILABLE',
      reason: 'amount_invalid',
      weightedUiEnabled: uiAccess.unlocked,
      isRevenue: false,
    };
  }
  if (!Number.isFinite(p) || p < 0 || p > 100) {
    return {
      ok: false,
      status: 'UNAVAILABLE',
      reason: 'probability_invalid',
      weightedUiEnabled: uiAccess.unlocked,
      isRevenue: false,
    };
  }

  const currency =
    args.currency != null ? String(args.currency).trim().toUpperCase() : null;
  if (currency && !isIso4217Currency(currency)) {
    return {
      ok: false,
      status: 'UNAVAILABLE',
      reason: 'currency_invalid',
      weightedUiEnabled: uiAccess.unlocked,
      isRevenue: false,
    };
  }

  const indicative = (amount * p) / 100;
  return {
    ok: true,
    indicativeWeightedAmount: indicative,
    amount,
    probability: p,
    currency: currency || null,
    /** Multi-currency rollups stay separated or UNAVAILABLE — never silent FX */
    fxConverted: false,
    isRevenue: false,
    isIndicativeOnly: true,
    weightedUiEnabled: uiAccess.unlocked,
    label: 'indicative_weighted_amount_not_revenue',
  };
}

/**
 * Multi-currency total: separated map or UNAVAILABLE — never silent FX sum.
 * @param {Array<{ amount: number|string, currency: string }>} lines
 */
export function summarizeAmountsByCurrency(lines = []) {
  const byCurrency = Object.create(null);
  for (const line of lines || []) {
    const c = String(line?.currency || '').trim().toUpperCase();
    if (!isIso4217Currency(c)) {
      return {
        ok: false,
        status: 'UNAVAILABLE',
        reason: 'currency_required',
        totalsByCurrency: null,
        grandTotal: null,
        fxConverted: false,
      };
    }
    const n = Number(line.amount);
    if (!Number.isFinite(n)) {
      return {
        ok: false,
        status: 'UNAVAILABLE',
        reason: 'amount_invalid',
        totalsByCurrency: null,
        grandTotal: null,
        fxConverted: false,
      };
    }
    byCurrency[c] = (byCurrency[c] || 0) + n;
  }
  const currencies = Object.keys(byCurrency);
  return {
    ok: true,
    totalsByCurrency: byCurrency,
    /** Never invent a single rolled total across currencies */
    grandTotal: currencies.length === 1 ? byCurrency[currencies[0]] : null,
    grandTotalStatus: currencies.length === 1 ? 'AVAILABLE' : 'UNAVAILABLE',
    fxConverted: false,
  };
}

async function loadOpportunity(prisma, opportunityId) {
  const id = opportunityId ? String(opportunityId).trim() : '';
  if (!id) return null;
  try {
    if (/^OPP-\d{4}-\d{6}$/.test(id)) {
      return await prisma.crmOpportunity.findUnique({ where: { opportunityNumber: id } });
    }
    return await prisma.crmOpportunity.findUnique({ where: { id } });
  } catch {
    return null;
  }
}

function decimalOrNull(v) {
  if (v == null || v === '') return null;
  return String(v);
}

/**
 * Set Opportunity commercial estimate (non-binding). Currency + basis required.
 * Never posts Revenue/Subscription.
 */
export async function setOpportunityCommercial(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canEditOpportunities) {
    return { ok: false, forbidden: true, reason: 'crm_opportunity_edit_forbidden' };
  }
  if (!hasCrmOpportunityModel(prisma)) {
    return { ok: false, error: 'crm_opportunity_model_unavailable', status: 'UNAVAILABLE' };
  }

  const scope = await resolveCrmScope(prisma, args.admin, 'opportunities');
  if (!scope.canView) {
    return { ok: false, forbidden: true, reason: 'crm_scope_denied' };
  }

  const opp = await loadOpportunity(prisma, args.opportunityId);
  if (!opp) return { ok: false, notFound: true, error: 'opportunity_not_found' };

  const amountBasis = String(args.amountBasis || '').trim().toUpperCase();
  if (!CRM_AMOUNT_BASES.includes(amountBasis)) {
    return { ok: false, error: 'amount_basis_required', allowed: CRM_AMOUNT_BASES };
  }

  const currency = String(args.currency || '').trim().toUpperCase();
  if (!isIso4217Currency(currency)) {
    return { ok: false, error: 'currency_required', detail: 'ISO_4217' };
  }

  if (args.amount == null || args.amount === '') {
    return { ok: false, error: 'amount_required' };
  }
  const amount = Number(args.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: 'amount_invalid' };
  }

  let recurringAnnualAmount = null;
  let oneTimeAmount = null;
  if (args.recurringAnnualAmount != null && args.recurringAnnualAmount !== '') {
    const r = Number(args.recurringAnnualAmount);
    if (!Number.isFinite(r) || r < 0) {
      return { ok: false, error: 'recurringAnnualAmount_invalid' };
    }
    recurringAnnualAmount = r;
  }
  if (args.oneTimeAmount != null && args.oneTimeAmount !== '') {
    const o = Number(args.oneTimeAmount);
    if (!Number.isFinite(o) || o < 0) {
      return { ok: false, error: 'oneTimeAmount_invalid' };
    }
    oneTimeAmount = o;
  }

  const now = args.now || new Date();
  const previous = {
    amount: opp.amount != null ? String(opp.amount) : null,
    currency: opp.currency || null,
    amountBasis: opp.amountBasis || null,
  };

  const updated = await prisma.crmOpportunity.update({
    where: { id: opp.id },
    data: {
      amount,
      currency,
      amountBasis,
      recurringAnnualAmount,
      oneTimeAmount,
      updatedAt: now,
    },
  });

  let historyId = null;
  if (hasCrmOpportunityAmountHistoryModel(prisma)) {
    const hist = await prisma.crmOpportunityAmountHistory.create({
      data: {
        opportunityId: opp.id,
        amount,
        currency,
        amountBasis,
        recurringAnnualAmount,
        oneTimeAmount,
        previousAmount: previous.amount != null ? Number(previous.amount) : null,
        previousCurrency: previous.currency,
        previousAmountBasis: previous.amountBasis,
        changedByAdminId: args.admin?.id || null,
        reason: args.reason != null ? String(args.reason) : null,
        at: now,
      },
    });
    historyId = hist?.id || null;
  }

  const weightedUi = resolveWeightedPipelineUiAccess(args.uiGate || {});

  return {
    ok: true,
    opportunity: serializeOpportunity(updated),
    historyId,
    postsRevenue: false,
    postsSubscription: false,
    isBinding: false,
    fxConverted: false,
    isRevenue: false,
    /** Honesty/currency gated — never the raw capability flag. */
    weightedUiEnabled: weightedUi.unlocked,
    weightedUiCapability: WEIGHTED_PIPELINE_UI_ENABLED === true,
  };
}

export async function getOpportunityCommercial(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canViewOpportunities) {
    return { ok: false, forbidden: true, reason: 'crm_opportunity_view_forbidden' };
  }
  if (!hasCrmOpportunityModel(prisma)) {
    return { ok: false, error: 'crm_opportunity_model_unavailable', status: 'UNAVAILABLE' };
  }

  const opp = await loadOpportunity(prisma, args.opportunityId);
  if (!opp) return { ok: false, notFound: true, error: 'opportunity_not_found' };

  let history = [];
  if (hasCrmOpportunityAmountHistoryModel(prisma)) {
    try {
      history = await prisma.crmOpportunityAmountHistory.findMany({
        where: { opportunityId: opp.id },
        orderBy: { at: 'asc' },
      });
    } catch {
      history = [];
    }
  }

  const weightedUi = resolveWeightedPipelineUiAccess(args.uiGate || {});

  return {
    ok: true,
    commercial: {
      amount: decimalOrNull(opp.amount),
      currency: opp.currency || null,
      amountBasis: opp.amountBasis || null,
      recurringAnnualAmount: decimalOrNull(opp.recurringAnnualAmount),
      oneTimeAmount: decimalOrNull(opp.oneTimeAmount),
      isBinding: false,
      postsRevenue: false,
      postsSubscription: false,
      isRevenue: false,
    },
    amountHistory: (history || []).map((h) => ({
      id: h.id,
      amount: decimalOrNull(h.amount),
      currency: h.currency,
      amountBasis: h.amountBasis,
      recurringAnnualAmount: decimalOrNull(h.recurringAnnualAmount),
      oneTimeAmount: decimalOrNull(h.oneTimeAmount),
      previousAmount: decimalOrNull(h.previousAmount),
      previousCurrency: h.previousCurrency || null,
      previousAmountBasis: h.previousAmountBasis || null,
      reason: h.reason || null,
      changedByAdminId: h.changedByAdminId || null,
      at: h.at ? new Date(h.at).toISOString() : null,
    })),
    /** Honesty/currency gated unlock — never expose ungated capability as unlock. */
    weightedUiEnabled: weightedUi.unlocked,
    weightedUiCapability: WEIGHTED_PIPELINE_UI_ENABLED === true,
    isRevenue: false,
    isIndicativeOnly: true,
    indicativeWeighted: computeIndicativeWeightedAmount({
      amount: opp.amount,
      probability: opp.probability,
      currency: opp.currency,
      uiGate: args.uiGate,
    }),
  };
}
