/**

 * Adoption state engine — instrumented features only; history append-only.

 * Entitlement ≠ value; page views/login never past discovery.

 */



import {

  getProductFeature,

  isInstrumentedFeature,

} from '@/lib/admin/productCatalogue/features.js';

import {

  resolveFeatureEntitlement,

  ENTITLEMENT_STATUS,

} from '@/lib/admin/productCatalogue/entitlements.js';

import { FIRST_VALUE_RULE_VERSION, loadFirstValue } from './firstValue.js';

import { evaluateRepeatValue, REPEAT_VALUE_RULE_VERSION } from './repeatValue.js';

import { listProductUsageFacts } from './facts.js';

import { PRODUCT_CADENCE } from '@/lib/admin/productCatalogue/cadence.js';



export const ADOPTION_RULE_VERSION = 'adoption-2026-07-29';

export const ADOPTION_DEFINITION_VERSION = 'adoption-def-2026-07-29';



/** States from ADOPTION_MATRIX.md */

export const ADOPTION_STATE = Object.freeze({

  NOT_ENTITLED: 'NOT_ENTITLED',

  ENTITLED_NOT_AVAILABLE: 'ENTITLED_NOT_AVAILABLE',

  AVAILABLE_NOT_DISCOVERED: 'AVAILABLE_NOT_DISCOVERED',

  DISCOVERED_NOT_CONFIGURED: 'DISCOVERED_NOT_CONFIGURED',

  CONFIGURATION_STARTED: 'CONFIGURATION_STARTED',

  CONFIGURED_NOT_USED: 'CONFIGURED_NOT_USED',

  FIRST_VALUE_ACHIEVED: 'FIRST_VALUE_ACHIEVED',

  REPEAT_VALUE_ACHIEVED: 'REPEAT_VALUE_ACHIEVED',

  RECENTLY_ACTIVE: 'RECENTLY_ACTIVE',

  CONSISTENTLY_ACTIVE: 'CONSISTENTLY_ACTIVE',

  DECLINING_USAGE: 'DECLINING_USAGE',

  INACTIVE: 'INACTIVE',

  DISCONTINUED: 'DISCONTINUED',

  NOT_APPLICABLE: 'NOT_APPLICABLE',

  NOT_INSTRUMENTED: 'NOT_INSTRUMENTED',

  UNKNOWN: 'UNKNOWN',

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



function cadenceWindowMs(cadence) {

  switch (cadence) {

    case PRODUCT_CADENCE.DAILY:

      return 3 * 24 * 60 * 60 * 1000;

    case PRODUCT_CADENCE.WEEKLY:

      return 14 * 24 * 60 * 60 * 1000;

    case PRODUCT_CADENCE.MONTHLY:

      return 45 * 24 * 60 * 60 * 1000;

    case PRODUCT_CADENCE.QUARTERLY:

      return 120 * 24 * 60 * 60 * 1000;

    case PRODUCT_CADENCE.EVENT_DRIVEN:

    case PRODUCT_CADENCE.AD_HOC:

    default:

      return 30 * 24 * 60 * 60 * 1000;

  }

}



async function appendAdoptionHistory(prisma, row) {

  if (!prisma?.productAdoptionStateHistory?.create) return null;

  return prisma.productAdoptionStateHistory.create({ data: row });

}



async function latestAdoptionHistory(prisma, tenantId, featureCode) {

  if (!prisma?.productAdoptionStateHistory?.findFirst) return null;

  return prisma.productAdoptionStateHistory.findFirst({

    where: { tenantId, featureCode },

    orderBy: { observedAt: 'desc' },

  });

}



/**

 * @param {object} prisma

 * @param {{ tenantId: string, featureCode: string, asOf?: Date, persist?: boolean }} args

 */

export async function evaluateAdoptionState(prisma, args = {}) {

  const tenantId = args.tenantId ? String(args.tenantId) : '';

  const featureCode = args.featureCode ? String(args.featureCode) : '';

  const asOf = args.asOf instanceof Date ? args.asOf : new Date();

  // Persist history only when explicitly requested (opt-in).
  const persist = args.persist === true;



  if (!tenantId || !featureCode) {

    return {

      ok: false,

      state: ADOPTION_STATE.UNKNOWN,

      reasonCode: 'invalid_args',

      ruleVersion: ADOPTION_RULE_VERSION,

    };

  }



  const feature = getProductFeature(featureCode);

  if (!feature) {

    return {

      ok: true,

      state: ADOPTION_STATE.NOT_APPLICABLE,

      reasonCode: 'feature_missing',

      ruleVersion: ADOPTION_RULE_VERSION,

      definitionVersion: ADOPTION_DEFINITION_VERSION,

    };

  }



  if (!isInstrumentedFeature(featureCode) || !feature.instrumented) {

    return finalize(prisma, {

      tenantId,

      featureCode,

      state: ADOPTION_STATE.NOT_INSTRUMENTED,

      reasonCode: 'not_instrumented',

      evidence: { instrumented: false },

      persist,

    });

  }



  let entitlement;

  try {

    entitlement = await resolveFeatureEntitlement(prisma, { tenantId, featureCode, asOf });

  } catch {

    entitlement = { status: ENTITLEMENT_STATUS.UNKNOWN, enabled: null };

  }



  if (entitlement.status === ENTITLEMENT_STATUS.UNKNOWN && entitlement.enabled == null) {

    // Still allow value-based states if facts exist; otherwise UNKNOWN

    const firstProbe = await loadFirstValue(prisma, {

      tenantId,

      featureCode,

      ruleVersion: FIRST_VALUE_RULE_VERSION,

    });

    if (!firstProbe) {

      return finalize(prisma, {

        tenantId,

        featureCode,

        state: ADOPTION_STATE.UNKNOWN,

        reasonCode: 'entitlement_unknown',

        evidence: { entitlement },

        persist,

      });

    }

  }



  if (

    entitlement.status === ENTITLEMENT_STATUS.NOT_INCLUDED ||

    entitlement.enabled === false

  ) {

    return finalize(prisma, {

      tenantId,

      featureCode,

      state: ADOPTION_STATE.NOT_ENTITLED,

      reasonCode: 'not_entitled',

      evidence: { entitlement },

      persist,

    });

  }



  const first = await loadFirstValue(prisma, {

    tenantId,

    featureCode,

    ruleVersion: FIRST_VALUE_RULE_VERSION,

  });



  if (!first) {

    // Entitled but no value — never invent FIRST_VALUE / CONSISTENTLY_ACTIVE

    const state = isEntitled(entitlement)

      ? ADOPTION_STATE.AVAILABLE_NOT_DISCOVERED

      : ADOPTION_STATE.UNKNOWN;

    return finalize(prisma, {

      tenantId,

      featureCode,

      state,

      reasonCode: isEntitled(entitlement) ? 'entitled_no_value' : 'no_evidence',

      evidence: { entitlement, firstValue: null },

      persist,

    });

  }



  const repeat = await evaluateRepeatValue(prisma, {

    tenantId,

    featureCode,

    rule: { ruleVersion: REPEAT_VALUE_RULE_VERSION },

  });



  const facts = await listProductUsageFacts(prisma, { tenantId, featureCode });

  const latestFact = facts.length ? facts[facts.length - 1] : null;

  const latestAt = latestFact?.occurredAt

    ? new Date(latestFact.occurredAt)

    : new Date(first.occurredAt);

  const windowMs = cadenceWindowMs(feature.cadence);

  const recentlyActive = asOf.getTime() - latestAt.getTime() <= windowMs;



  let state = ADOPTION_STATE.FIRST_VALUE_ACHIEVED;

  let reasonCode = 'first_value';



  if (repeat.achieved) {

    state = ADOPTION_STATE.REPEAT_VALUE_ACHIEVED;

    reasonCode = 'repeat_value';



    if (recentlyActive && repeat.distinctSourceCount >= 3) {

      state = ADOPTION_STATE.CONSISTENTLY_ACTIVE;

      reasonCode = 'consistent_cadence';

    } else if (recentlyActive) {

      state = ADOPTION_STATE.RECENTLY_ACTIVE;

      reasonCode = 'recent_activity';

    } else if (!recentlyActive) {

      state = ADOPTION_STATE.DECLINING_USAGE;

      reasonCode = 'stale_after_repeat';

    }

  }



  return finalize(prisma, {

    tenantId,

    featureCode,

    state,

    reasonCode,

    evidence: {

      entitlement,

      firstValue: {

        sourceId: first.sourceId,

        occurredAt: first.occurredAt,

        ruleVersion: first.ruleVersion,

      },

      repeat,

      latestAt,

      recentlyActive,

    },

    persist,

  });

}



async function finalize(prisma, { tenantId, featureCode, state, reasonCode, evidence, persist }) {

  const previous = await latestAdoptionHistory(prisma, tenantId, featureCode);

  let historyRow = null;

  if (persist && (!previous || previous.state !== state)) {

    historyRow = await appendAdoptionHistory(prisma, {

      tenantId,

      featureCode,

      state,

      previousState: previous?.state || null,

      ruleVersion: ADOPTION_RULE_VERSION,

      definitionVersion: ADOPTION_DEFINITION_VERSION,

      reasonCode,

      evidence: evidence || {},

      observedAt: new Date(),

    });

  }



  return {

    ok: true,

    state,

    previousState: previous?.state || null,

    reasonCode,

    ruleVersion: ADOPTION_RULE_VERSION,

    definitionVersion: ADOPTION_DEFINITION_VERSION,

    featureCode,

    tenantId,

    historyAppended: Boolean(historyRow),

    evidence,

  };

}


