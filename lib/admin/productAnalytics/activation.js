/**
 * Activation engine — first value required; entitlement/login alone never activate.
 */

import {
  isInstrumentedFeature,
  listProductFeatures,
} from '@/lib/admin/productCatalogue/features.js';
import { resolveFeatureEntitlement, ENTITLEMENT_STATUS } from '@/lib/admin/productCatalogue/entitlements.js';
import { FIRST_VALUE_RULE_VERSION, loadFirstValue } from './firstValue.js';

export const ACTIVATION_RULE_VERSION = 'activation-2026-07-29';

/**
 * @param {object} prisma
 * @param {{
 *   tenantId: string,
 *   featureCode?: string,
 *   moduleCode?: string,
 *   level?: 'feature'|'module'|'customer'|'user'|'eis',
 * }} args
 */
export async function evaluateActivation(prisma, args = {}) {
  const tenantId = args.tenantId ? String(args.tenantId) : '';
  const level = args.level || (args.moduleCode && !args.featureCode ? 'module' : 'feature');
  const featureCode = args.featureCode ? String(args.featureCode) : null;
  const moduleCode = args.moduleCode ? String(args.moduleCode) : null;

  if (!tenantId) {
    return {
      ok: false,
      activated: false,
      level,
      reasonCode: 'invalid_args',
      ruleVersion: ACTIVATION_RULE_VERSION,
    };
  }

  if (level === 'feature' || level === 'eis') {
    return evaluateFeatureActivation(prisma, {
      tenantId,
      featureCode,
      level,
    });
  }

  if (level === 'module') {
    return evaluateModuleActivation(prisma, {
      tenantId,
      moduleCode: moduleCode || featureCode,
    });
  }

  if (level === 'customer' || level === 'user') {
    const instrumented = listProductFeatures().filter((f) => f.instrumented);
    for (const f of instrumented) {
      const fv = await loadFirstValue(prisma, {
        tenantId,
        featureCode: f.code,
        ruleVersion: FIRST_VALUE_RULE_VERSION,
      });
      if (fv) {
        return {
          ok: true,
          activated: true,
          level,
          featureCode: f.code,
          reasonCode: null,
          ruleVersion: ACTIVATION_RULE_VERSION,
          firstValueAt: fv.occurredAt,
        };
      }
    }
    return {
      ok: true,
      activated: false,
      level,
      reasonCode: 'first_value_missing',
      ruleVersion: ACTIVATION_RULE_VERSION,
    };
  }

  return {
    ok: false,
    activated: false,
    level,
    reasonCode: 'unsupported_level',
    ruleVersion: ACTIVATION_RULE_VERSION,
  };
}

async function evaluateFeatureActivation(prisma, { tenantId, featureCode, level }) {
  if (!featureCode) {
    return {
      ok: false,
      activated: false,
      level,
      reasonCode: 'feature_required',
      ruleVersion: ACTIVATION_RULE_VERSION,
    };
  }

  if (!isInstrumentedFeature(featureCode)) {
    return {
      ok: true,
      activated: false,
      level,
      featureCode,
      reasonCode: 'NOT_INSTRUMENTED',
      ruleVersion: ACTIVATION_RULE_VERSION,
    };
  }

  const entitlement = await resolveFeatureEntitlement(prisma, { tenantId, featureCode });
  const entitled =
    entitlement.enabled === true ||
    [
      ENTITLEMENT_STATUS.INCLUDED,
      ENTITLEMENT_STATUS.OPTIONAL_ADD_ON,
      ENTITLEMENT_STATUS.GRANDFATHERED,
      ENTITLEMENT_STATUS.CUSTOM_CONTRACT,
    ].includes(entitlement.status);

  const first = await loadFirstValue(prisma, {
    tenantId,
    featureCode,
    ruleVersion: FIRST_VALUE_RULE_VERSION,
  });

  if (!first) {
    return {
      ok: true,
      activated: false,
      level,
      featureCode,
      entitled,
      reasonCode: entitled ? 'first_value_missing' : 'not_entitled_or_no_value',
      ruleVersion: ACTIVATION_RULE_VERSION,
    };
  }

  return {
    ok: true,
    activated: true,
    level,
    featureCode,
    entitled,
    reasonCode: null,
    ruleVersion: ACTIVATION_RULE_VERSION,
    firstValueAt: first.occurredAt,
    sourceId: first.sourceId,
  };
}

async function evaluateModuleActivation(prisma, { tenantId, moduleCode }) {
  if (!moduleCode) {
    return {
      ok: false,
      activated: false,
      level: 'module',
      reasonCode: 'module_required',
      ruleVersion: ACTIVATION_RULE_VERSION,
    };
  }

  const features = listProductFeatures().filter(
    (f) => f.moduleCode === moduleCode && f.instrumented
  );
  if (features.length === 0) {
    return {
      ok: true,
      activated: false,
      level: 'module',
      moduleCode,
      reasonCode: 'NOT_INSTRUMENTED',
      ruleVersion: ACTIVATION_RULE_VERSION,
    };
  }

  for (const f of features) {
    const r = await evaluateFeatureActivation(prisma, {
      tenantId,
      featureCode: f.code,
      level: 'feature',
    });
    if (r.activated) {
      return {
        ok: true,
        activated: true,
        level: 'module',
        moduleCode,
        featureCode: f.code,
        reasonCode: null,
        ruleVersion: ACTIVATION_RULE_VERSION,
        firstValueAt: r.firstValueAt,
      };
    }
  }

  return {
    ok: true,
    activated: false,
    level: 'module',
    moduleCode,
    reasonCode: 'first_value_missing',
    ruleVersion: ACTIVATION_RULE_VERSION,
  };
}
