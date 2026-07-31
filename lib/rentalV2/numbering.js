import { randomBytes } from 'crypto';

export function makeDocNumber(prefix, date = new Date()) {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${ymd}-${suffix}`;
}
