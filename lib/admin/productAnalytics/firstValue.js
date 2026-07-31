/**

 * First-value engine — unique per tenant + feature + ruleVersion.

 * Strict AnalyticsEvent / product usage facts only.

 */



import {

  FEATURE_EVENT_CODES,

  getProductFeature,

  isInstrumentedFeature,

} from '@/lib/admin/productCatalogue/features.js';

import { PRODUCT_VALUE_EVENT_TYPES } from './facts.js';



export const FIRST_VALUE_RULE_VERSION = 'first-value-2026-07-29';



const NON_VALUE_EVENT_HINTS = /LOGIN|PAGE_VIEW|PAGEVIEW|ROUTE_VIEW|SESSION/i;



/**

 * Reject synthetic caller payloads: require a matching AnalyticsEvent

 * and/or AnalyticsFactProductUsage row as evidence.

 */

async function verifySourceEvidence(prisma, { tenantId, featureCode, sourceEvent }) {

  const sourceId = sourceEvent?.sourceId != null ? String(sourceEvent.sourceId) : '';

  const eventType = sourceEvent?.eventType;

  if (!sourceId || !eventType) {

    return { ok: false, reason: 'unverified_source', error: 'sourceEvent missing sourceId/eventType' };

  }



  // AnalyticsEvent by id

  if (sourceEvent.id && typeof prisma?.analyticsEvent?.findUnique === 'function') {

    const byId = await prisma.analyticsEvent.findUnique({

      where: { id: String(sourceEvent.id) },

    });

    if (

      byId &&

      byId.eventType === eventType &&

      String(byId.sourceId) === sourceId &&

      String(byId.tenantId || 'unknown') === String(tenantId)

    ) {

      return { ok: true, via: 'analytics_event' };

    }

  }



  // AnalyticsEvent by idempotencyKey

  if (

    sourceEvent.idempotencyKey &&

    typeof prisma?.analyticsEvent?.findUnique === 'function'

  ) {

    const byKey = await prisma.analyticsEvent.findUnique({

      where: { idempotencyKey: String(sourceEvent.idempotencyKey) },

    });

    if (

      byKey &&

      byKey.eventType === eventType &&

      String(byKey.sourceId) === sourceId &&

      String(byKey.tenantId || 'unknown') === String(tenantId)

    ) {

      return { ok: true, via: 'analytics_event' };

    }

  }



  // Product usage fact evidence

  if (typeof prisma?.analyticsFactProductUsage?.findFirst === 'function') {

    const fact = await prisma.analyticsFactProductUsage.findFirst({

      where: {

        tenantId: String(tenantId),

        featureCode: String(featureCode),

        eventType,

        sourceId,

      },

    });

    if (fact) {

      return { ok: true, via: 'product_usage_fact' };

    }



    if (sourceEvent.idempotencyKey) {

      const byIdem = await prisma.analyticsFactProductUsage.findFirst({

        where: {

          idempotencyKey: `fact-prod:${sourceEvent.idempotencyKey}`,

        },

      });

      if (

        byIdem &&

        byIdem.tenantId === String(tenantId) &&

        byIdem.featureCode === String(featureCode) &&

        byIdem.eventType === eventType &&

        String(byIdem.sourceId) === sourceId

      ) {

        return { ok: true, via: 'product_usage_fact' };

      }

    }

  }



  return {

    ok: false,

    reason: 'unverified_source',

    error: 'First value requires a persisted AnalyticsEvent or product usage fact',

  };

}



/**

 * @param {object} prisma

 * @param {{ tenantId: string, featureCode: string, sourceEvent: object, ruleVersion?: string }} args

 */

export async function recordOrLoadFirstValue(prisma, args = {}) {

  const tenantId = args.tenantId ? String(args.tenantId) : '';

  const featureCode = args.featureCode ? String(args.featureCode) : '';

  const sourceEvent = args.sourceEvent || null;

  const ruleVersion = args.ruleVersion || FIRST_VALUE_RULE_VERSION;



  if (!tenantId || !featureCode || !sourceEvent) {

    return {

      ok: false,

      error: 'tenantId, featureCode, and sourceEvent required',

      reason: 'invalid_args',

    };

  }



  if (!isInstrumentedFeature(featureCode)) {

    return {

      ok: false,

      state: 'NOT_INSTRUMENTED',

      reason: 'NOT_INSTRUMENTED',

      error: `Feature ${featureCode} is not instrumented`,

    };

  }



  const feature = getProductFeature(featureCode);

  const expectedEvent = FEATURE_EVENT_CODES[featureCode] || feature?.eventCode;

  const eventType = sourceEvent.eventType;



  if (

    !PRODUCT_VALUE_EVENT_TYPES.has(eventType) ||

    NON_VALUE_EVENT_HINTS.test(String(eventType || '')) ||

    (expectedEvent && eventType !== expectedEvent)

  ) {

    return {

      ok: false,

      reason: 'non_value_source',

      error: 'First value requires a matching strict commerce value event',

    };

  }



  const evidence = await verifySourceEvidence(prisma, {

    tenantId,

    featureCode,

    sourceEvent,

  });

  if (!evidence.ok) {

    return evidence;

  }



  if (!prisma?.productFirstValueFact) {

    return { ok: false, error: 'productFirstValueFact unavailable' };

  }



  const existing = await prisma.productFirstValueFact.findUnique({

    where: {

      tenantId_featureCode_ruleVersion: { tenantId, featureCode, ruleVersion },

    },

  });

  if (existing) {

    return {

      ok: true,

      created: false,

      fact: existing,

      ruleVersion,

      evidenceVia: evidence.via,

    };

  }



  const occurredAt =

    sourceEvent.occurredAt instanceof Date

      ? sourceEvent.occurredAt

      : new Date(sourceEvent.occurredAt || Date.now());



  const data = {

    tenantId,

    featureCode,

    ruleVersion,

    eventType,

    sourceType: String(sourceEvent.sourceType || 'Unknown'),

    sourceId: String(sourceEvent.sourceId),

    sourceEventId: sourceEvent.id ? String(sourceEvent.id) : null,

    occurredAt,

    idempotencyKey: `first-value:${tenantId}:${featureCode}:${ruleVersion}`,

  };



  try {

    const fact = await prisma.productFirstValueFact.create({ data });

    return { ok: true, created: true, fact, ruleVersion, evidenceVia: evidence.via };

  } catch (e) {

    if (e?.code === 'P2002') {

      const again = await prisma.productFirstValueFact.findUnique({

        where: {

          tenantId_featureCode_ruleVersion: { tenantId, featureCode, ruleVersion },

        },

      });

      if (again) {

        return {

          ok: true,

          created: false,

          fact: again,

          ruleVersion,

          evidenceVia: evidence.via,

        };

      }

    }

    throw e;

  }

}



/**

 * Load existing first-value fact if any.

 */

export async function loadFirstValue(prisma, { tenantId, featureCode, ruleVersion } = {}) {

  if (!prisma?.productFirstValueFact?.findUnique) return null;

  const tv = ruleVersion || FIRST_VALUE_RULE_VERSION;

  return prisma.productFirstValueFact.findUnique({

    where: {

      tenantId_featureCode_ruleVersion: {

        tenantId: String(tenantId),

        featureCode: String(featureCode),

        ruleVersion: tv,

      },

    },

  });

}


