/** Deterministic IDs for factories (no Math.random). */

let seq = 0;

export function resetIdSequence(start = 0) {
  seq = start;
}

export function nextId(prefix = 'id') {
  seq += 1;
  return `${prefix}_${String(seq).padStart(6, '0')}`;
}

export function businessId(n = 1) {
  return `biz_TEST_${String(n).padStart(3, '0')}`;
}

export function userId(n = 1) {
  return `user_TEST_${String(n).padStart(3, '0')}`;
}

/** Stable id from label parts (no randomness). */
export function deterministicId(kind, label) {
  return `${kind}_${String(label).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}
