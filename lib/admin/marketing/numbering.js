/**
 * Concurrency-safe Marketing numbering: MKT-YYYY-######
 * Year = UTC calendar year of create time.
 * Uses MarketingNumberSeq with optimistic compare-and-swap (CRM numbering pattern).
 */

import {
  MARKETING_CAMPAIGN_NUMBER_RE,
  MARKETING_NUMBER_PREFIX,
} from './catalogue.js';

const MAX_ALLOC_ATTEMPTS = 12;
const VALID_PREFIXES = new Set(Object.values(MARKETING_NUMBER_PREFIX));

/**
 * @param {string} prefix
 * @param {number} year
 * @param {number} seq
 * @returns {string}
 */
export function formatMarketingNumber(prefix, year, seq) {
  return `${prefix}-${year}-${String(seq).padStart(6, '0')}`;
}

/**
 * @param {Date} [now]
 * @returns {number}
 */
export function utcYearOf(now = new Date()) {
  return new Date(now).getUTCFullYear();
}

function hasSeqModel(db) {
  return typeof db?.marketingNumberSeq?.findUnique === 'function';
}

/**
 * Allocate next number for prefix + UTC year of `now`.
 *
 * @param {import('@prisma/client').PrismaClient|object} prisma
 * @param {{ prefix?: string, now?: Date }} opts
 * @returns {Promise<{ ok: true, number: string, prefix: string, year: number, sequence: number } | { ok: false, error: string }>}
 */
export async function allocateMarketingNumber(prisma, opts = {}) {
  const prefix = String(opts.prefix || MARKETING_NUMBER_PREFIX.CAMPAIGN)
    .trim()
    .toUpperCase();
  const now = opts.now || new Date();
  const year = utcYearOf(now);

  if (!VALID_PREFIXES.has(prefix)) {
    return { ok: false, error: 'invalid_marketing_number_prefix' };
  }

  if (!hasSeqModel(prisma)) {
    return { ok: false, error: 'marketing_number_seq_unavailable' };
  }

  const run = async (tx) => {
    for (let i = 0; i < MAX_ALLOC_ATTEMPTS; i += 1) {
      const row = await tx.marketingNumberSeq.findUnique({
        where: { prefix_year: { prefix, year } },
      });

      if (!row) {
        try {
          await tx.marketingNumberSeq.create({
            data: { prefix, year, lastIssued: 1 },
          });
          return {
            ok: true,
            number: formatMarketingNumber(prefix, year, 1),
            prefix,
            year,
            sequence: 1,
          };
        } catch (err) {
          if (err && typeof err === 'object' && err.code === 'P2002') continue;
          throw err;
        }
      }

      const next = row.lastIssued + 1;
      const res = await tx.marketingNumberSeq.updateMany({
        where: { prefix, year, lastIssued: row.lastIssued },
        data: { lastIssued: next },
      });
      if (res.count === 1) {
        return {
          ok: true,
          number: formatMarketingNumber(prefix, year, next),
          prefix,
          year,
          sequence: next,
        };
      }
    }
    return { ok: false, error: 'marketing_number_allocation_failed' };
  };

  if (typeof prisma.$transaction === 'function') {
    return prisma.$transaction(run);
  }
  return run(prisma);
}

export { MARKETING_CAMPAIGN_NUMBER_RE };
