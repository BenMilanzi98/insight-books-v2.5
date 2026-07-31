/**

 * Repeat-value engine — requires a distinct source from first value.

 */



import { isInstrumentedFeature } from '@/lib/admin/productCatalogue/features.js';

import { FIRST_VALUE_RULE_VERSION, loadFirstValue } from './firstValue.js';

import { listProductUsageFacts } from './facts.js';



export const REPEAT_VALUE_RULE_VERSION = 'repeat-value-2026-07-29';



/**

 * @param {object} prisma

 * @param {{ tenantId: string, featureCode: string, rule?: { minDistinctSources?: number, ruleVersion?: string } }} args

 */

export async function evaluateRepeatValue(prisma, args = {}) {

  const tenantId = args.tenantId ? String(args.tenantId) : '';

  const featureCode = args.featureCode ? String(args.featureCode) : '';

  const rule = args.rule || {};

  const minDistinct = Number(rule.minDistinctSources) > 0 ? Number(rule.minDistinctSources) : 2;

  const ruleVersion = rule.ruleVersion || REPEAT_VALUE_RULE_VERSION;



  if (!tenantId || !featureCode) {

    return {

      ok: false,

      achieved: false,

      reasonCode: 'invalid_args',

      ruleVersion,

    };

  }



  if (!isInstrumentedFeature(featureCode)) {

    return {

      ok: true,

      achieved: false,

      reasonCode: 'NOT_INSTRUMENTED',

      ruleVersion,

      distinctSourceCount: 0,

    };

  }



  const first = await loadFirstValue(prisma, {

    tenantId,

    featureCode,

    ruleVersion: FIRST_VALUE_RULE_VERSION,

  });

  if (!first) {

    return {

      ok: true,

      achieved: false,

      reasonCode: 'first_value_missing',

      ruleVersion,

      distinctSourceCount: 0,

    };

  }



  const facts = await listProductUsageFacts(prisma, { tenantId, featureCode });

  const distinct = new Set(facts.map((f) => String(f.sourceId)));

  // Ensure first-value source counts even if fact consumer lag

  distinct.add(String(first.sourceId));



  const distinctSourceCount = distinct.size;

  if (distinctSourceCount < minDistinct) {

    return {

      ok: true,

      achieved: false,

      reasonCode: 'insufficient_distinct_sources',

      ruleVersion,

      distinctSourceCount,

      firstValueSourceId: first.sourceId,

    };

  }



  return {

    ok: true,

    achieved: true,

    reasonCode: null,

    ruleVersion,

    distinctSourceCount,

    firstValueSourceId: first.sourceId,

  };

}


