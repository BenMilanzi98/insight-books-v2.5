/**

 * Phase 9 Wave 2 — product usage facts from commerce AnalyticsEvents.

 */



import { ANALYTICS_EVENT_TYPES } from '@/lib/admin/analytics/catalogue.js';

import {

  FEATURE_EVENT_CODES,

  PRODUCT_FEATURE_CODES,

  isInstrumentedFeature,

} from '@/lib/admin/productCatalogue/features.js';



export const PRODUCT_USAGE_FACT_CONSUMER = 'fact_product_usage';



/** Commerce value event types that may create product usage facts. */

export const PRODUCT_VALUE_EVENT_TYPES = new Set([

  ANALYTICS_EVENT_TYPES.SALES_INVOICE_POSTED,

  ANALYTICS_EVENT_TYPES.POS_TRANSACTION_COMPLETED,

  ANALYTICS_EVENT_TYPES.MRA_EIS_TRANSACTION_ACCEPTED,

]);



const EVENT_TO_FEATURE = Object.freeze({

  [ANALYTICS_EVENT_TYPES.SALES_INVOICE_POSTED]: PRODUCT_FEATURE_CODES.INVOICES_POST,

  [ANALYTICS_EVENT_TYPES.POS_TRANSACTION_COMPLETED]: PRODUCT_FEATURE_CODES.SALES_POS_COMPLETE,

  [ANALYTICS_EVENT_TYPES.MRA_EIS_TRANSACTION_ACCEPTED]: PRODUCT_FEATURE_CODES.EIS_FISCAL_ACCEPT,

});



async function alreadyConsumed(db, consumerName, eventId) {

  const cp = await db.analyticsConsumerCheckpoint?.findUnique?.({

    where: { consumerName },

  });

  if (!cp?.cursor?.processedIds) return false;

  return Boolean(cp.cursor.processedIds[eventId]);

}



async function markConsumed(db, consumerName, event) {

  const cp = await db.analyticsConsumerCheckpoint.findUnique({

    where: { consumerName },

  });

  const processedIds = { ...(cp?.cursor?.processedIds || {}), [event.id]: true };

  const keys = Object.keys(processedIds);

  if (keys.length > 500) {

    for (const k of keys.slice(0, keys.length - 400)) delete processedIds[k];

  }

  await db.analyticsConsumerCheckpoint.upsert({

    where: { consumerName },

    create: {

      consumerName,

      lastEventId: event.id,

      lastOccurredAt: event.occurredAt,

      cursor: { processedIds },

    },

    update: {

      lastEventId: event.id,

      lastOccurredAt: event.occurredAt,

      cursor: { processedIds },

    },

  });

}



function resolveFeatureCode(event) {

  const fromPayload = event?.payload?.featureCode;

  if (fromPayload && isInstrumentedFeature(fromPayload)) {

    const expected = FEATURE_EVENT_CODES[fromPayload];

    if (!expected || expected === event.eventType) return fromPayload;

  }

  return EVENT_TO_FEATURE[event.eventType] || null;

}



/**

 * Advance first value from the live event/fact plane (dynamic import avoids cycle).

 */

async function advanceFirstValueFromEvent(db, event, featureCode) {

  const { recordOrLoadFirstValue } = await import('./firstValue.js');

  return recordOrLoadFirstValue(db, {

    tenantId: event.tenantId || 'unknown',

    featureCode,

    sourceEvent: event,

  });

}



/**

 * Idempotent consumer: commerce value events → AnalyticsFactProductUsage

 * and advances ProductFirstValueFact via recordOrLoadFirstValue.

 */

export async function consumeProductUsageFacts(db, event) {

  const consumerName = PRODUCT_USAGE_FACT_CONSUMER;



  if (!PRODUCT_VALUE_EVENT_TYPES.has(event.eventType)) {

    return { ok: true, skipped: true, reason: 'not_product_value' };

  }



  const featureCode = resolveFeatureCode(event);

  if (!featureCode || !isInstrumentedFeature(featureCode)) {

    return { ok: true, skipped: true, reason: 'feature_not_instrumented' };

  }



  const wasConsumed = await alreadyConsumed(db, consumerName, event.id);



  if (!wasConsumed) {

    if (!db?.analyticsFactProductUsage?.create) {

      return { ok: false, error: 'analyticsFactProductUsage unavailable' };

    }



    try {

      await db.analyticsFactProductUsage.create({

        data: {

          tenantId: event.tenantId || 'unknown',

          featureCode,

          eventType: event.eventType,

          sourceType: event.sourceType,

          sourceId: String(event.sourceId),

          occurredAt: event.occurredAt,

          idempotencyKey: `fact-prod:${event.idempotencyKey}`,

          meta: {

            featureCode,

            sourceType: event.sourceType,

            sourceId: String(event.sourceId),

          },

        },

      });

    } catch (e) {

      if (e?.code !== 'P2002') throw e;

    }

  }



  // Live pipeline: fact plane must establish first value (heal on re-consume too)

  const firstValue = await advanceFirstValueFromEvent(db, event, featureCode);



  if (!wasConsumed) {

    await markConsumed(db, consumerName, event);

  }



  return {

    ok: true,

    created: !wasConsumed,

    skipped: wasConsumed,

    featureCode,

    firstValue,

  };

}



/**

 * List usage facts for a tenant/feature (oldest first).

 */

export async function listProductUsageFacts(db, { tenantId, featureCode } = {}) {

  if (!db?.analyticsFactProductUsage?.findMany) return [];

  return db.analyticsFactProductUsage.findMany({

    where: {

      ...(tenantId ? { tenantId: String(tenantId) } : {}),

      ...(featureCode ? { featureCode: String(featureCode) } : {}),

    },

    orderBy: { occurredAt: 'asc' },

  });

}


