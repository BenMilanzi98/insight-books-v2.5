/**
 * Logical GL merges (system CoA apply): source rows keep mergedIntoAccountId → survivor.
 * Postings stay on the original account id; reporting/UI roll up to the survivor account.
 */

/**
 * @param {string} tenantId
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} db
 */
export async function fetchTenantAccountsForMergeRollup(tenantId, db) {
  return db.account.findMany({
    where: { tenantId },
    select: {
      id: true,
      mergedIntoAccountId: true,
      accountCode: true,
      code: true,
      accountName: true,
      name: true,
      accountType: true,
      type: true,
      normalBalance: true,
    },
  });
}

/**
 * @param {{ id: string, mergedIntoAccountId: string | null }[]} mergeEdges
 */
export function buildSurvivorResolver(mergeEdges) {
  const mergedIntoById = new Map(
    mergeEdges.map((r) => [r.id, r.mergedIntoAccountId || null])
  );

  const survivorMemo = new Map();

  /** Root account id for this posting (chain follows mergedIntoAccountId). */
  function survivorOf(accountId) {
    if (!accountId) return null;
    if (survivorMemo.has(accountId)) return survivorMemo.get(accountId);
    if (!mergedIntoById.has(accountId)) {
      survivorMemo.set(accountId, accountId);
      return accountId;
    }
    const seen = new Set();
    let cur = accountId;
    while (mergedIntoById.get(cur)) {
      if (seen.has(cur)) break;
      seen.add(cur);
      cur = mergedIntoById.get(cur);
    }
    survivorMemo.set(accountId, cur);
    return cur;
  }

  /** All account ids whose activity rolls into this survivor (includes the survivor). */
  function allIdsRollingInto(survivorId) {
    const out = new Set();
    if (survivorId) out.add(survivorId);
    for (const r of mergeEdges) {
      if (survivorOf(r.id) === survivorId) out.add(r.id);
    }
    return [...out];
  }

  return { survivorOf, allIdsRollingInto, mergedIntoById };
}

function effectiveCode(a) {
  return String(a?.accountCode || a?.code || '').trim();
}

function effectiveName(a) {
  return String(a?.accountName || a?.name || '').trim();
}

/**
 * @param {Awaited<ReturnType<typeof fetchTenantAccountsForMergeRollup>>} accountRows
 */
export function buildMergeRollupContext(accountRows) {
  const mergeEdges = accountRows.map((r) => ({
    id: r.id,
    mergedIntoAccountId: r.mergedIntoAccountId,
  }));
  const { survivorOf, allIdsRollingInto } = buildSurvivorResolver(mergeEdges);
  const byId = new Map(accountRows.map((r) => [r.id, r]));

  function displayFieldsForPostingAccountId(postingId) {
    if (!postingId) return null;
    const orig = byId.get(postingId);
    const survId = survivorOf(postingId);
    const surv = byId.get(survId);
    const postingCode = effectiveCode(orig);
    const postingName = effectiveName(orig);
    const displayCode = effectiveCode(surv) || postingCode;
    const displayName = effectiveName(surv) || postingName;
    return {
      postingAccountId: postingId,
      postingAccountCode: postingCode || null,
      postingAccountName: postingName || null,
      displayAccountId: survId,
      displayAccountCode: displayCode || null,
      displayAccountName: displayName || null,
    };
  }

  return {
    survivorOf,
    allIdsRollingInto,
    byId,
    displayFieldsForPostingAccountId,
  };
}

/**
 * Prisma groupBy rows: merge accountId keys onto survivor ids (debits/credits and optional line counts).
 * @param {Array<{ accountId: string, _sum?: object, _count?: { id?: number } }>} grouped
 * @param {(id: string) => string|null} survivorOf
 * @param {{ debitKey?: string, creditKey?: string }} [opts]
 * @returns {Map<string, { debit: number, credit: number, lineCount: number }>}
 */
export function aggregateGroupByRowsBySurvivor(grouped, survivorOf, opts = {}) {
  const debitKey = opts.debitKey || 'debitAmount';
  const creditKey = opts.creditKey || 'creditAmount';
  const out = new Map();
  for (const g of grouped || []) {
    const sid = survivorOf(g.accountId);
    if (!sid) continue;
    const debit = Number(g._sum?.[debitKey] || 0);
    const credit = Number(g._sum?.[creditKey] || 0);
    const lc = Number(g._count?.id || 0);
    const prev = out.get(sid) || { debit: 0, credit: 0, lineCount: 0 };
    out.set(sid, {
      debit: prev.debit + debit,
      credit: prev.credit + credit,
      lineCount: prev.lineCount + lc,
    });
  }
  return out;
}
