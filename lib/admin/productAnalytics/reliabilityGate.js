/**
 * Product reliability gate — never return numeric zero on failure.
 */

import { getProductFeature } from '@/lib/admin/productCatalogue/features.js';
import {
  METRIC_FEATURE_MAP,
  PRODUCT_RELIABILITY_STATUS,
} from './catalogue.js';

/**
 * @param {string} metricCode
 * @param {{ featureCode?: string, permissionOk?: boolean, definitionActive?: boolean }} [ctx]
 * @returns {{ status: string, value: null|undefined, reasonCode: string|null, reasonMessage: string|null, metricCode: string, featureCode: string|null }}
 */
export function evaluateProductReliability(metricCode, ctx = {}) {
  const code = metricCode ? String(metricCode) : '';
  const featureCode =
    ctx.featureCode ||
    METRIC_FEATURE_MAP[code] ||
    inferFeatureFromMetric(code);

  if (ctx.permissionOk === false) {
    return gateResult(
      PRODUCT_RELIABILITY_STATUS.PERMISSION_RESTRICTED,
      code,
      featureCode,
      'permission_restricted',
      'Permission or portfolio scope denies this metric'
    );
  }

  if (ctx.definitionActive === false) {
    return gateResult(
      PRODUCT_RELIABILITY_STATUS.DEFINITION_MISSING,
      code,
      featureCode,
      'definition_inactive',
      'Definition version inactive'
    );
  }

  if (!featureCode) {
    return gateResult(
      PRODUCT_RELIABILITY_STATUS.DEFINITION_MISSING,
      code,
      null,
      'feature_unresolved',
      'Cannot resolve feature for metric'
    );
  }

  const feature = getProductFeature(featureCode);
  if (!feature) {
    return gateResult(
      PRODUCT_RELIABILITY_STATUS.DEFINITION_MISSING,
      code,
      featureCode,
      'feature_missing',
      'Feature missing from product catalogue'
    );
  }

  if (!feature.instrumented || feature.instrumentation === 'NOT_INSTRUMENTED') {
    return gateResult(
      PRODUCT_RELIABILITY_STATUS.NOT_INSTRUMENTED,
      code,
      featureCode,
      'not_instrumented',
      'No verified producer for this feature'
    );
  }

  return {
    status: PRODUCT_RELIABILITY_STATUS.AVAILABLE,
    value: undefined,
    reasonCode: null,
    reasonMessage: null,
    metricCode: code,
    featureCode,
  };
}

function gateResult(status, metricCode, featureCode, reasonCode, reasonMessage) {
  return {
    status,
    value: null,
    reasonCode,
    reasonMessage,
    metricCode,
    featureCode,
  };
}

/** Heuristic: product.feature.<module>.<action...> → module.action... */
function inferFeatureFromMetric(metricCode) {
  if (!metricCode.startsWith('product.feature.')) return null;
  const rest = metricCode.slice('product.feature.'.length);
  // strip trailing .count / .rate / etc.
  const parts = rest.split('.');
  if (parts.length < 2) return null;
  const last = parts[parts.length - 1];
  if (['count', 'rate', 'share', 'first_value', 'adoption'].includes(last)) {
    return parts.slice(0, -1).join('.');
  }
  return rest;
}
