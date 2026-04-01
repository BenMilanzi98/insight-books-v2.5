/**
 * Collect errors along Prisma / Node cause chains (Prisma 5+ often nests under `cause`).
 * Includes primitives (e.g. thrown strings) and stops before following non-objects.
 * @param {unknown} error
 * @returns {unknown[]}
 */
export function getErrorChain(error) {
  const chain = [];
  const seen = new Set();
  let e = error;
  while (e != null && !seen.has(e)) {
    seen.add(e);
    chain.push(e);
    if (typeof e !== 'object') break;
    e = /** @type {{ cause?: unknown }} */ (e).cause;
  }
  return chain;
}

/** @param {unknown} e */
function messageOf(e) {
  if (e == null) return '';
  if (typeof e === 'string') return e;
  if (typeof e === 'object' && e !== null && 'message' in e) {
    const m = /** @type {{ message?: unknown }} */ (e).message;
    if (typeof m === 'string') return m;
  }
  try {
    return String(e);
  } catch {
    return '';
  }
}

/** @param {unknown[]} chain */
export function joinChainMessages(chain, fallback) {
  const parts = chain.map((e) => messageOf(e)).filter(Boolean);
  const joined = parts.join(' | ');
  return joined || (fallback != null ? String(fallback) : '');
}

/** @param {unknown[]} chain */
export function findInChain(chain, predicate) {
  for (const e of chain) {
    if (predicate(e)) return e;
  }
  return undefined;
}

/** First Prisma-style code (P####) on error objects, else embedded in concatenated messages */
export function findPrismaCode(chain) {
  const hit = findInChain(
    chain,
    (e) =>
      typeof /** @type {{ code?: string }} */ (e).code === 'string' &&
      /^P\d{4}$/.test(/** @type {{ code: string }} */ (e).code)
  );
  if (hit) return /** @type {{ code: string }} */ (hit).code;
  const blob = joinChainMessages(chain, '');
  const m = blob.match(/\b(P\d{4})\b/);
  return m ? m[1] : undefined;
}
