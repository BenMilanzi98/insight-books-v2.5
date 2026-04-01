/**
 * Collect errors along Prisma / Node cause chains (Prisma 5+ often nests under `cause`).
 * @param {unknown} error
 * @returns {Error[]}
 */
export function getErrorChain(error) {
  const chain = [];
  const seen = new Set();
  let e = error;
  while (e && typeof e === 'object' && !seen.has(e)) {
    seen.add(e);
    chain.push(e);
    e = /** @type {{ cause?: unknown }} */ (e).cause;
  }
  return chain;
}

/** @param {unknown[]} chain */
export function findInChain(chain, predicate) {
  for (const e of chain) {
    if (predicate(e)) return e;
  }
  return undefined;
}

/** First Prisma-style code (P####) in the chain */
export function findPrismaCode(chain) {
  const hit = findInChain(
    chain,
    (e) => typeof /** @type {{ code?: string }} */ (e).code === 'string' && /^P\d{4}$/.test(/** @type {{ code: string }} */ (e).code)
  );
  return hit ? /** @type {{ code: string }} */ (hit).code : undefined;
}
