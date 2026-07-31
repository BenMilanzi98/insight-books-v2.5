import { parseDecimalToMinor, minorToDecimalString } from '@/lib/accountingV2/domain/money.js';
import { toMinor as coreToMinor } from '@/lib/money.js';

/** Major units (decimal string/number) → integer minor units. */
export function toMinor(value) {
  if (value == null || value === '') return 0;
  try {
    return parseDecimalToMinor(value);
  } catch {
    return coreToMinor(value);
  }
}

export function fromMinor(minor) {
  return Number(minorToDecimalString(Number(minor ?? 0)));
}

export function minorToNumber(minor) {
  if (typeof minor === 'bigint') return Number(minor);
  return Number(minor ?? 0);
}

export function serializeMinor(minor) {
  const n = minorToNumber(minor);
  return {
    minor: n,
    amount: fromMinor(n),
  };
}

export function applyGrowthMinor(baseMinor, growthPercent) {
  const base = minorToNumber(baseMinor);
  const g = Number(growthPercent) || 0;
  return Math.round(base * (1 + g / 100));
}
