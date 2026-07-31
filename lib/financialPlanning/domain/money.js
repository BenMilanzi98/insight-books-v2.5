/** Exact minor-unit arithmetic for planning (no float authority). */

export function parseToMinor(value) {
  if (value == null || value === '') return 0n;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Invalid number for planning amount.');
    return BigInt(Math.round(value * 100));
  }
  const s = String(value).trim().replace(/,/g, '');
  const neg = s.startsWith('-');
  const raw = neg ? s.slice(1) : s;
  const [whole, frac = ''] = raw.split('.');
  const frac2 = `${frac}00`.slice(0, 2);
  const minor = BigInt(whole || '0') * 100n + BigInt(frac2);
  return neg ? -minor : minor;
}

export function minorToDecimalString(minor) {
  const n = typeof minor === 'bigint' ? minor : BigInt(minor || 0);
  const neg = n < 0n;
  const abs = neg ? -n : n;
  const whole = abs / 100n;
  const frac = abs % 100n;
  return `${neg ? '-' : ''}${whole}.${frac.toString().padStart(2, '0')}`;
}

export function pctOf(amountMinor, rateBps) {
  // rateBps: 1500 = 15.00%
  return (amountMinor * BigInt(rateBps)) / 10000n;
}

export function applyGrowth(amountMinor, growthBps) {
  return amountMinor + pctOf(amountMinor, growthBps);
}

export function daysToFraction(days) {
  // Approximate month fraction for DSO/DPO: days / 30
  return Number(days) / 30;
}
