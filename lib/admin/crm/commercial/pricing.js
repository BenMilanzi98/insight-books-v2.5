/**
 * Deterministic calculateCommercialDocument — Phase 15 Wave 2.
 * Immutable pricing snapshots; currency-explicit totals; idempotent by key.
 * No silent FX; no Tenant tax posting; no MRA EIS fiscal; Opp estimates unused.
 */

import { CRM_SUBJECT_TYPE, CRM_TIMELINE_EVENT_TYPE } from '../catalogue.js';
import { resolveCrmAccess } from '../authz.js';
import { appendTimelineEvent } from '../timeline.js';
import {
  assertCurrencyPricingGate,
  convertAmount,
  resolveFxContext,
  roundMoney,
} from './currencyFx.js';
import { resolveDiscountApplication } from './discounts.js';
import { filterApprovedExceptions } from './exceptions.js';
import { collectLineCurrencies, normalizeLineItems } from './lineItems.js';
import {
  hasCrmPriceBookEntryModel,
  hasCrmPriceBookVersionModel,
  hasCrmPricingSnapshotModel,
  resolveCommercialActor,
} from './model.js';
import { findPriceBookEntryForProduct } from './productConfig.js';
import {
  buildCurrencyExplicitTotals,
  buildPricingSnapshotPayload,
} from './pricingSnapshot.js';
import { computeTaxTotal, resolveTaxContext } from './tax.js';

function canEdit(access) {
  return (
    access.canEditOpportunities ||
    access.canEditLeads ||
    access.canCreateLeads ||
    access.isSuperAdmin
  );
}

async function loadPriceBookEntries(prisma, priceBookVersionId) {
  if (!hasCrmPriceBookEntryModel(prisma)) return [];
  return prisma.crmPriceBookEntry.findMany({
    where: { priceBookVersionId: String(priceBookVersionId) },
  });
}

/**
 * calculateCommercialDocument({
 *   actorContext, commercialDocumentVersionId, priceBookVersionId, currency,
 *   lineItems, taxContext, discountRequests, pricingExceptions,
 *   calculationDate, idempotencyKey, fxContext
 * }) → { calculationId, snapshot, totals }
 */
export async function calculateCommercialDocument(prisma, args = {}) {
  const admin = resolveCommercialActor(args);
  const access = resolveCrmAccess(admin);
  if (!canEdit(access)) {
    return { ok: false, forbidden: true, reason: 'crm_pricing_calculate_forbidden' };
  }
  if (!hasCrmPricingSnapshotModel(prisma) || !hasCrmPriceBookVersionModel(prisma)) {
    return { ok: false, error: 'crm_pricing_snapshot_model_unavailable', status: 'UNAVAILABLE' };
  }

  const documentVersionId = String(args.commercialDocumentVersionId || '').trim();
  const priceBookVersionId = String(args.priceBookVersionId || '').trim();
  const currency = args.currency ? String(args.currency).trim().toUpperCase() : null;
  const idempotencyKey = args.idempotencyKey != null ? String(args.idempotencyKey).trim() : '';

  if (!documentVersionId || !priceBookVersionId || !currency) {
    return { ok: false, error: 'pricing_required_fields_missing' };
  }

  if (idempotencyKey) {
    const existing = await prisma.crmPricingSnapshot.findUnique({
      where: {
        documentVersionId_idempotencyKey: {
          documentVersionId,
          idempotencyKey,
        },
      },
    });
    if (existing) {
      return {
        ok: true,
        alreadyExists: true,
        calculationId: existing.id,
        snapshot: existing.snapshotJson,
        totals: existing.totalsJson,
      };
    }
    // also try findFirst for mocks without compound unique
    const existingAlt = await prisma.crmPricingSnapshot.findFirst({
      where: { documentVersionId, idempotencyKey },
    });
    if (existingAlt) {
      return {
        ok: true,
        alreadyExists: true,
        calculationId: existingAlt.id,
        snapshot: existingAlt.snapshotJson,
        totals: existingAlt.totalsJson,
      };
    }
  }

  const pbVersion = await prisma.crmPriceBookVersion.findUnique({
    where: { id: priceBookVersionId },
  });
  if (!pbVersion) {
    return { ok: false, notFound: true, error: 'price_book_version_not_found' };
  }

  const normalized = normalizeLineItems(args.lineItems);
  if (!normalized.ok) return normalized;

  const lineCurrencies = collectLineCurrencies(normalized.lineItems, currency);
  const fxGate = assertCurrencyPricingGate({
    documentCurrency: currency,
    lineCurrencies,
    fxContext: args.fxContext,
    calculationDate: args.calculationDate,
    now: args.now,
  });
  if (!fxGate.ok) {
    return {
      ok: false,
      error: fxGate.error,
      reliability: fxGate.reliability,
      reason: fxGate.reason,
    };
  }

  const taxResolved = resolveTaxContext(args.taxContext);
  if (!taxResolved.ok) {
    return { ok: false, error: taxResolved.error, reason: taxResolved.reason };
  }

  const entries = await loadPriceBookEntries(prisma, priceBookVersionId);
  const discounts = await resolveDiscountApplication(prisma, args.discountRequests || []);
  const approvedExceptions = await filterApprovedExceptions(
    prisma,
    args.pricingExceptions || []
  );

  const lineSnapshots = [];
  let listSubtotal = 0;
  let netSubtotal = 0;
  let fxSnapshot = null;

  for (const item of normalized.lineItems) {
    const entry = findPriceBookEntryForProduct(entries, item.productRef);
    if (!entry) {
      return {
        ok: false,
        error: 'price_book_entry_not_found',
        productRef: item.productRef,
      };
    }

    const entryCurrency = String(entry.currency || currency).trim().toUpperCase();
    const lineCurrency = item.currency || entryCurrency;
    let unitList = Number(entry.listPrice);
    let unitNet = unitList;

    // Approved exception may override unit price
    const ex = approvedExceptions.find(
      (e) => e.productRef === item.productRef || e.lineKey === item.lineKey
    );
    if (ex && ex.unitPrice != null) {
      unitNet = Number(ex.unitPrice);
    }

    if (lineCurrency !== currency) {
      const fx = resolveFxContext({
        sourceCurrency: lineCurrency,
        targetCurrency: currency,
        fxContext: args.fxContext,
        calculationDate: args.calculationDate,
        now: args.now,
      });
      if (!fx.ok) {
        return { ok: false, error: fx.error, reliability: fx.reliability };
      }
      unitList = convertAmount(unitList, fx.rate);
      unitNet = convertAmount(unitNet, fx.rate);
      fxSnapshot = fx.snapshot;
    }

    const lineList = roundMoney(unitList * item.quantity);
    let lineNet = roundMoney(unitNet * item.quantity);
    if (discounts.appliedDiscountPercent > 0) {
      lineNet = roundMoney(lineNet * (1 - discounts.appliedDiscountPercent / 100));
    }

    listSubtotal += lineList;
    netSubtotal += lineNet;

    lineSnapshots.push({
      productRef: item.productRef,
      quantity: item.quantity,
      unit: item.unit || entry.unit,
      currency,
      sourceCurrency: lineCurrency,
      listUnitPrice: unitList,
      netUnitPrice: roundMoney(lineNet / item.quantity),
      listAmount: lineList,
      netAmount: lineNet,
      billingFrequency: item.billingFrequency || entry.billingFrequency || 'MONTHLY',
      priceBookEntryId: entry.id,
    });
  }

  listSubtotal = roundMoney(listSubtotal);
  netSubtotal = roundMoney(netSubtotal);

  const { taxTotal } = computeTaxTotal(netSubtotal, taxResolved);
  const totals = buildCurrencyExplicitTotals({
    currency,
    listSubtotal,
    netSubtotal,
    taxTotal,
    lineSnapshots,
    inclusive: taxResolved.inclusive === true,
  });

  const calculationDate = args.calculationDate || new Date().toISOString().slice(0, 10);
  const snapshot = buildPricingSnapshotPayload({
    documentVersionId,
    priceBookVersionId,
    currency,
    calculationDate,
    lineSnapshots,
    totals,
    tax: {
      jurisdiction: taxResolved.jurisdiction,
      ratePercent: taxResolved.ratePercent,
      inclusive: taxResolved.inclusive,
      overridden: taxResolved.overridden,
      tenantGlPosting: false,
      mraEisFiscal: false,
    },
    discounts,
    fx: fxSnapshot,
    pricingExceptions: approvedExceptions,
  });

  const now = args.now || new Date();
  const row = await prisma.crmPricingSnapshot.create({
    data: {
      documentVersionId,
      priceBookVersionId,
      currency,
      calculationDate: new Date(calculationDate),
      idempotencyKey: idempotencyKey || null,
      snapshotJson: snapshot,
      totalsJson: totals,
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  await appendTimelineEvent(prisma, {
    subjectType: CRM_SUBJECT_TYPE.ACCOUNT,
    subjectId: documentVersionId,
    eventType: CRM_TIMELINE_EVENT_TYPE.COMMERCIAL_PRICING_CALCULATED,
    summary: `Commercial pricing calculated ${totals.grandTotal} ${currency}`,
    payload: { calculationId: row.id, documentVersionId, currency },
    actorAdminId: admin?.id || null,
    at: now,
  });

  return {
    ok: true,
    calculationId: row.id,
    snapshot,
    totals,
  };
}
