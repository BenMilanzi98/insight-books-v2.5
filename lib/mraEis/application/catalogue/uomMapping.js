import { EisErrors } from '../../domain/errors.js';

/**
 * Controlled UOM conversion. Display labels are not external codes.
 * Conversion never mutates local Inventory quantities.
 */
export function parseUomConversionRule(rule) {
  if (!rule) return null;
  if (typeof rule === 'object') return rule;
  try {
    return JSON.parse(rule);
  } catch {
    return null;
  }
}

export function buildUomConversionRule({
  localUom,
  externalUomCode,
  conversionNumerator = 1,
  conversionDenominator = 1,
  roundingRule = 'NONE',
}) {
  if (!localUom || !externalUomCode) {
    throw EisErrors.validation({ message: 'Local and external UOM are required.', code: 'UOM_MAPPING_REQUIRED' });
  }
  if (String(externalUomCode).includes(' ')) {
    throw EisErrors.validation({
      message: 'External UOM must be a verified code, not a display label.',
      code: 'UOM_MAPPING_REQUIRED',
    });
  }
  const num = Number(conversionNumerator);
  const den = Number(conversionDenominator);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0 || num <= 0 || den < 0) {
    throw EisErrors.validation({ message: 'Invalid UOM conversion factors.', code: 'UOM_CONVERSION_ERROR' });
  }
  return {
    localUom: String(localUom),
    externalUomCode: String(externalUomCode),
    conversionNumerator: num,
    conversionDenominator: den,
    roundingRule,
    ruleVersion: 'phase10-uom-conversion-v1',
  };
}

export function convertQuantityToExternal({ localQuantity, conversionRule }) {
  const rule = parseUomConversionRule(conversionRule);
  if (!rule) {
    throw EisErrors.validation({ message: 'UOM conversion rule required.', code: 'UOM_MAPPING_REQUIRED' });
  }
  const q = Number(localQuantity);
  if (!Number.isFinite(q)) {
    throw EisErrors.validation({ message: 'Quantity must be a finite decimal.', code: 'UOM_CONVERSION_ERROR' });
  }
  if (q < 0) {
    throw EisErrors.validation({ message: 'Negative quantities cannot be converted for MRA.', code: 'UOM_CONVERSION_ERROR' });
  }
  const resolved = (q * Number(rule.conversionNumerator)) / Number(rule.conversionDenominator);
  if (!Number.isFinite(resolved)) {
    throw EisErrors.validation({ message: 'UOM conversion produced a non-finite quantity.', code: 'UOM_CONVERSION_ERROR' });
  }
  // Exact decimal string without inventing rounding beyond JS number — store as fixed 6 dp max
  const resolvedExternalQuantity = String(Number(resolved.toFixed(6)));
  return {
    localQuantity: String(q),
    resolvedExternalQuantity,
    conversionRuleId: rule.ruleVersion,
    localUom: rule.localUom,
    mraUnitOfMeasure: rule.externalUomCode,
    localInventoryMutated: false,
  };
}

export function unitsCompatible(localUom, externalUom, conversionRule) {
  if (!localUom || !externalUom) return false;
  if (String(localUom).toUpperCase() === String(externalUom).toUpperCase()) return true;
  return Boolean(parseUomConversionRule(conversionRule));
}
