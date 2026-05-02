import prisma from './prisma.js';
import {
  UNITS_CATALOG,
  EXPECTED_CATALOG_BASE_COUNT,
  EXPECTED_CATALOG_UNIT_COUNT,
  CATALOG_UNIT_SYMBOLS,
} from './unitsCatalogData.js';

async function isCanonicalCatalogPresent(client) {
  const [baseCount, unitCount, kg] = await Promise.all([
    client.baseUnit.count(),
    client.unit.count(),
    client.unit.findUnique({ where: { symbol: 'kg' }, select: { id: true } }),
  ]);
  if (!kg || baseCount < EXPECTED_CATALOG_BASE_COUNT || unitCount < EXPECTED_CATALOG_UNIT_COUNT) {
    return false;
  }
  const expectedNames = UNITS_CATALOG.map((b) => b.name);
  const matchingBases = await client.baseUnit.count({
    where: { name: { in: expectedNames } },
  });
  return matchingBases === expectedNames.length;
}

/**
 * Legacy DBs: rows predating isCatalogUnit — treat shipped symbols as catalog-owned.
 * New custom units from POST /api/units use isCatalogUnit: false; symbols must be unique (409 if catalog symbol).
 */
async function backfillCatalogUnitOwnership(client) {
  await client.unit.updateMany({
    where: { symbol: { in: CATALOG_UNIT_SYMBOLS } },
    data: { isCatalogUnit: true },
  });
}

async function upsertFullCatalog(client) {
  await backfillCatalogUnitOwnership(client);

  for (const baseUnitData of UNITS_CATALOG) {
    const { units, ...baseUnitInfo } = baseUnitData;
    const baseUnit = await client.baseUnit.upsert({
      where: { name: baseUnitInfo.name },
      create: baseUnitInfo,
      update: {
        displayName: baseUnitInfo.displayName,
        description: baseUnitInfo.description ?? null,
        baseUnit: baseUnitInfo.baseUnit,
      },
    });
    for (const unitData of units) {
      const existing = await client.unit.findUnique({
        where: { symbol: unitData.symbol },
      });
      const shared = {
        name: unitData.name,
        conversionToBase: unitData.conversionToBase,
        isBaseUnit: unitData.isBaseUnit ?? false,
        isActive: true,
        baseUnitId: baseUnit.id,
      };

      if (!existing) {
        await client.unit.create({
          data: {
            ...shared,
            symbol: unitData.symbol,
            isCatalogUnit: true,
          },
        });
      } else if (existing.isCatalogUnit) {
        await client.unit.update({
          where: { symbol: unitData.symbol },
          data: shared,
        });
      }
      // User-created unit (isCatalogUnit false) — keep as-is; ProductUnit / flexible qty links stay stable.
    }
  }
}

/**
 * Idempotent sync of canonical BaseUnit + Unit rows (global, no tenant scope).
 * Does not delete rows. Only creates missing catalog units and updates rows marked isCatalogUnit.
 * Custom units (POST /api/units) are never overwritten.
 *
 * @param {import('@prisma/client').PrismaClient} [client]
 * @param {{ force?: boolean }} [options] — force=true skips the fast path (e.g. seed script)
 */
export async function ensureGlobalUnitsCatalog(client = prisma, options = {}) {
  const { force = false } = options;
  if (!force && (await isCanonicalCatalogPresent(client))) {
    return;
  }
  await upsertFullCatalog(client);
}
