import crypto from 'crypto';
import { CryptoErrors } from './cryptoErrors.js';
import { utf8Bytes } from './encoding.js';

export const CANONICALIZATION_VERSION = 'PAYLOAD_CANONICALIZATION_V1';

/**
 * Deterministic JSON canonicalization for EIS cryptographic inputs.
 * - Sorts object keys lexicographically
 * - Preserves array order (invoice lines must not be reordered)
 * - Omits undefined
 * - Serializes decimals via exact string/number rules (no float reformatting beyond JSON)
 * - UTF-8 bytes
 */
export function canonicalize(input, { contractVersion = '1', canonicalizationVersion = CANONICALIZATION_VERSION } = {}) {
  if (canonicalizationVersion !== CANONICALIZATION_VERSION) {
    throw CryptoErrors.unsupportedCanonicalization({
      details: { canonicalizationVersion },
    });
  }
  try {
    const canonicalObject = normalize(input);
    const canonicalJson = JSON.stringify(canonicalObject);
    const bytes = utf8Bytes(canonicalJson);
    const checksum = crypto.createHash('sha256').update(bytes).digest('hex');
    return Object.freeze({
      canonicalObject,
      canonicalJson,
      bytes,
      checksum,
      canonicalizationVersion,
      contractVersion,
      characterEncoding: 'utf-8',
    });
  } catch (err) {
    if (err?.code?.startsWith?.('EIS_')) throw err;
    throw CryptoErrors.canonicalization({ message: 'Unable to canonicalize payload.' });
  }
}

function normalize(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw CryptoErrors.canonicalization({ message: 'Non-finite number rejected.' });
    if (Object.is(value, -0)) return 0;
    return value;
  }
  if (typeof value === 'string') return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw CryptoErrors.canonicalization({ message: 'Invalid date.' });
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((v) => (v === undefined ? null : normalize(v)));
  }
  if (typeof value === 'object') {
    if (value.kind === 'Money' || value.kind === 'Quantity') return value.value;
    const keys = Object.keys(value).sort();
    const out = {};
    for (const k of keys) {
      const n = normalize(value[k]);
      if (n !== undefined) out[k] = n;
    }
    return out;
  }
  throw CryptoErrors.canonicalization({ message: `Unsupported type: ${typeof value}` });
}

/** Exact decimal string helper — rejects scientific notation and NaN. */
export function serializeExactDecimal(value, { scale = 2 } = {}) {
  if (value == null) throw CryptoErrors.canonicalization({ message: 'Decimal required.' });
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw CryptoErrors.canonicalization({ message: 'Non-finite decimal.' });
    return value.toFixed(scale);
  }
  const s = String(value).trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) {
    throw CryptoErrors.canonicalization({ message: 'Invalid decimal format (scientific notation rejected).' });
  }
  const [i, f = ''] = s.split('.');
  const frac = (f + '0'.repeat(scale)).slice(0, scale);
  return `${i}.${frac}`;
}

/** Business date YYYY-MM-DD in Africa/Blantyre conceptual local — caller supplies already-local date. */
export function serializeBusinessDate(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw CryptoErrors.canonicalization({ message: 'Invalid date.' });
    return value.toISOString().slice(0, 10);
  }
  const s = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw CryptoErrors.canonicalization({ message: 'Business date must be YYYY-MM-DD.' });
  }
  return s;
}
