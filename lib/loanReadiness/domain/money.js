import {
  parseToMinor,
  minorToDecimalString,
  pctOf,
} from '../../financialPlanning/domain/money.js';

export { parseToMinor, minorToDecimalString, pctOf };

export function amt(minor) {
  const m = typeof minor === 'bigint' ? minor : BigInt(minor || 0);
  return { minor: String(m), decimal: minorToDecimalString(m) };
}
