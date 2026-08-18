/**
 * Reconcile product totalStockValue and cost/averageCost from FIFO batches.
 *
 * Usage:
 *   node scripts/repair-stock-valuation.mjs --tenantId=<id> [--execute]
 */
import 'dotenv/config';
import prisma from '../lib/prisma.js';
import { reconcileProductInventoryValuation } from '../lib/syncProductInventoryValuation.js';

async function main() {
  const args = process.argv.slice(2);
  let tenantId = null;
  let execute = false;
  for (const a of args) {
    if (a === '--execute') execute = true;
    const m = /^--tenantId=(.+)$/.exec(a);
    if (m) tenantId = m[1];
  }

  const tenants = tenantId
    ? [{ id: tenantId }]
    : await prisma.tenant.findMany({ select: { id: true, name: true } });

  for (const tenant of tenants) {
    const products = await prisma.product.findMany({
      where: { tenantId: tenant.id, isDeleted: false, isService: false },
      select: { id: true, name: true, stockLevel: true, cost: true, totalStockValue: true },
    });
    console.log(`\n▶ Tenant ${tenant.id} (${tenant.name || 'unnamed'}): ${products.length} products`);

    for (const p of products) {
      const before = {
        cost: Number(p.cost) || 0,
        tsv: Number(p.totalStockValue) || 0,
        qty: Number(p.stockLevel) || 0,
      };
      if (!execute) {
        if (before.qty > 0 && before.tsv > 0) {
          const wac = before.tsv / before.qty;
          if (Math.abs(wac - before.cost) > 0.02) {
            console.log(`  [dry-run] ${p.name}: cost=${before.cost} → WAC=${wac.toFixed(2)} (qty=${before.qty}, tsv=${before.tsv})`);
          }
        }
        continue;
      }
      await prisma.$transaction(async (tx) => {
        await reconcileProductInventoryValuation(tx, tenant.id, p.id);
      });
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
