import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

function toNumber(value, defaultValue = 0) {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === 'number') return value;
  return Number(value);
}

function toDecimal(value) {
  return new Prisma.Decimal(value);
}

/**
 * Create a FIFO batch on purchase and update product "default cost" reference fields.
 * - Users never edit batches
 * - Batch cost is source-of-truth for FIFO/COGS
 */
export async function createFifoBatch({
  tenantId,
  branchId = null,
  productId,
  quantityPurchased,
  unitCost,
  purchaseDate = new Date(),
  sourceType = null,
  sourceId = null,
  expiryDate = null,
  tx = prisma,
}) {
  const qty = toNumber(quantityPurchased);
  const cost = toNumber(unitCost);
  if (!tenantId || !productId) throw new Error('tenantId and productId are required');
  if (qty <= 0) throw new Error('quantityPurchased must be > 0');
  if (cost < 0) throw new Error('unitCost must be >= 0');

  // CRITICAL: Check for duplicate batches BEFORE creating to prevent double counting
  // Check 1: If sourceType and sourceId are provided, check if batch with that sourceId exists
  if (sourceType && sourceId) {
    const existingBatch = await tx.inventoryBatch.findFirst({
      where: {
        tenantId,
        productId,
        sourceType,
        sourceId,
        ...(branchId ? { branchId } : {}),
      },
    });
    
    if (existingBatch) {
      console.warn(`[FIFO] Batch already exists for ${sourceType} ${sourceId}, Product ${productId}. Skipping creation to prevent double counting.`);
      // Return existing batch info without updating stock again
      const product = await tx.product.findFirst({
        where: { id: productId, tenantId },
        select: { id: true, stockLevel: true },
      });
      if (!product) throw new Error('Product not found');
      
      const batches = await tx.inventoryBatch.findMany({
        where: {
          tenantId,
          productId,
          ...(branchId ? { branchId } : {}),
          qtyRemaining: { gt: toDecimal(0) },
        },
        select: { qtyRemaining: true, unitCost: true },
      });
      const totalStockValue = batches.reduce((sum, b) => sum + (toNumber(b.qtyRemaining) * toNumber(b.unitCost)), 0);
      
      return { batchId: existingBatch.id, quantityOnHand: toNumber(product.stockLevel), totalStockValue };
    }
  }
  
  // Check 2: Look for ANY very recent batches with same quantity and cost (within last 30 seconds)
  // This catches duplicate API calls even if sourceId is different or requests come from different sources
  if (sourceType === 'StockIn') {
    const thirtySecondsAgo = new Date(Date.now() - 30000); // 30 second window
    const recentDuplicate = await tx.inventoryBatch.findFirst({
      where: {
        tenantId,
        productId,
        sourceType: 'StockIn',
        ...(branchId ? { branchId } : {}),
        purchaseDate: { gte: thirtySecondsAgo },
        qtyPurchased: toDecimal(qty),
        unitCost: toDecimal(cost),
      },
      orderBy: { purchaseDate: 'desc' },
    });
    
    if (recentDuplicate) {
      console.warn(`[FIFO] ⚠️ DUPLICATE DETECTED! Recent batch found for Product ${productId} with same qty (${qty}) and cost (${cost}) within last 30 seconds. Batch ID: ${recentDuplicate.id}. Skipping to prevent double counting.`);
      const product = await tx.product.findFirst({
        where: { id: productId, tenantId },
        select: { id: true, stockLevel: true },
      });
      if (!product) throw new Error('Product not found');
      
      const batches = await tx.inventoryBatch.findMany({
        where: {
          tenantId,
          productId,
          ...(branchId ? { branchId } : {}),
          qtyRemaining: { gt: toDecimal(0) },
        },
        select: { qtyRemaining: true, unitCost: true },
      });
      const totalStockValue = batches.reduce((sum, b) => sum + (toNumber(b.qtyRemaining) * toNumber(b.unitCost)), 0);
      
      return { batchId: recentDuplicate.id, quantityOnHand: toNumber(product.stockLevel), totalStockValue };
    }
  }

  // Get current stock BEFORE creating batch to detect if it was already updated
  const productBefore = await tx.product.findFirst({
    where: { id: productId, tenantId },
    select: { id: true, stockLevel: true },
  });
  if (!productBefore) throw new Error('Product not found');

  const stockBefore = toNumber(productBefore.stockLevel);
  const expectedStockAfter = stockBefore + qty;
  
  console.log(`[FIFO] createFifoBatch: Product ${productId}, Stock before: ${stockBefore}, Adding: ${qty}, Expected after: ${expectedStockAfter}`);

  // Create the batch
  // IMPORTANT: Always use the provided cost, never fall back to product.cost here
  // This ensures each batch maintains its own cost for FIFO tracking
  const batch = await tx.inventoryBatch.create({
    data: {
      tenantId,
      branchId,
      productId,
      sourceType,
      sourceId,
      purchaseDate: purchaseDate instanceof Date ? purchaseDate : new Date(purchaseDate),
      expiryDate:
        expiryDate != null && expiryDate !== ''
          ? expiryDate instanceof Date
            ? expiryDate
            : new Date(expiryDate)
          : null,
      qtyPurchased: toDecimal(qty),
      qtyRemaining: toDecimal(qty),
      unitCost: toDecimal(cost), // This is the cost for THIS batch, not product.cost
    },
  });
  
  console.log(`[FIFO] ✅ Created batch ${batch.id} for Product ${productId}: ${qty} units @ ${cost} each (total: ${qty * cost})`);
  console.log(`[FIFO] Batch purchaseDate: ${batch.purchaseDate}, sourceId: ${sourceId}, unitCost: ${toNumber(batch.unitCost)}`);

  // Update product "default cost" reference (NOT used for COGS)
  // Also maintain stockLevel as operational quantity (used for availability checks and UI)
  // Use increment to avoid race conditions and double counting
  const product = await tx.product.findFirst({
    where: { id: productId, tenantId },
    select: { id: true, stockLevel: true },
  });
  if (!product) throw new Error('Product not found');

  const currentQty = toNumber(product.stockLevel);
  console.log(`[FIFO] createFifoBatch: Product ${productId}, Current stock after batch creation: ${currentQty}, Expected: ${expectedStockAfter}`);

  // Recompute stock value from remaining FIFO batches (valuation)
  // Query batches AFTER creating the new batch so it's included in the calculation
  const batches = await tx.inventoryBatch.findMany({
    where: {
      tenantId,
      productId,
      ...(branchId ? { branchId } : {}),
      qtyRemaining: { gt: toDecimal(0) },
    },
    select: { qtyRemaining: true, unitCost: true },
  });
  const totalStockValue = batches.reduce((sum, b) => sum + (toNumber(b.qtyRemaining) * toNumber(b.unitCost)), 0);

  // Use increment to atomically update stockLevel and avoid double counting
  const updatedProduct = await tx.product.update({
    where: { id: productId },
    data: {
      stockLevel: {
        increment: toDecimal(qty)
      },
      // Default cost (human reference only)
      cost: cost,
      lastPurchaseCost: toDecimal(cost),
      lastPurchaseDate: purchaseDate instanceof Date ? purchaseDate : new Date(purchaseDate),
      // Inventory valuation based on remaining batches (includes the new batch we just created)
      totalStockValue: toDecimal(totalStockValue),
    },
  });

  const newQty = toNumber(updatedProduct.stockLevel);
  console.log(`[FIFO] createFifoBatch: Product ${productId}, After increment: ${newQty} (should be ${currentQty + qty})`);
  
  if (newQty !== currentQty + qty) {
    console.error(`[FIFO] ⚠️ STOCK MISMATCH! Product ${productId}: Expected ${currentQty + qty}, Got ${newQty}, Difference: ${newQty - (currentQty + qty)}`);
  }

  return { batchId: batch.id, quantityOnHand: newQty, totalStockValue };
}

/** Calendar start of local today — batches with expiryDate before this are not issuable. */
export function getInventoryExpiryCutoffDate() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Consume FIFO batches for a sale and return COGS.
 * IMPORTANT: This does NOT update product.stockLevel (sales route already decrements it).
 * It only updates batch qtyRemaining and valuation totals.
 */
export async function consumeFifoForSale({
  tenantId,
  branchId = null,
  productId,
  quantitySold,
  saleId = null,
  saleItemId = null,
  tx = prisma,
}) {
  const qtyToSell = toNumber(quantitySold);
  if (!tenantId || !productId) throw new Error('tenantId and productId are required');
  if (qtyToSell <= 0) throw new Error('quantitySold must be > 0');

  // Lock batches in FIFO order (oldest first)
  // IMPORTANT: Order by purchaseDate first (oldest batches first), then by createdAt as tiebreaker
  const expiryCutoff = getInventoryExpiryCutoffDate();

  const findBatches = async (branchIdToUse, issuableOnly) => {
    const expiryFilter = issuableOnly
      ? {
          OR: [{ expiryDate: null }, { expiryDate: { gte: expiryCutoff } }],
        }
      : {};

    return await tx.inventoryBatch.findMany({
      where: {
        tenantId,
        productId,
        ...(branchIdToUse ? { branchId: branchIdToUse } : {}),
        ...(branchIdToUse === null ? { branchId: null } : {}),
        qtyRemaining: { gt: toDecimal(0) },
        ...expiryFilter,
      },
      select: {
        id: true,
        purchaseDate: true,
        createdAt: true,
        qtyRemaining: true,
        unitCost: true,
        sourceId: true,
        branchId: true,
        expiryDate: true,
      },
      orderBy: [{ purchaseDate: 'asc' }, { createdAt: 'asc' }],
    });
  };

  // Primary: use the provided branchId (if any). This is the safe path for branch-scoped products.
  // Exclude expired batches from issuance (must write off first).
  let batches = await findBatches(branchId ? branchId : undefined, true);

  // Fallback: if a branchId was provided but no batches exist for that branch, try global (branchId = null).
  // This handles "global products" (product.branchId = null) being sold inside a branch sale.
  if (batches.length === 0 && branchId) {
    console.warn(
      `[FIFO Consume] ⚠️ No batches found for Product ${productId} with branchId=${branchId}. ` +
      `Retrying with global batches (branchId=null).`
    );
    batches = await findBatches(null, true);
  }

  console.log(`[FIFO Consume] Product ${productId}, Requested: ${qtyToSell} units`);
  console.log(`[FIFO Consume] Available batches (should be OLDEST first for FIFO):`);
  if (batches.length === 0) {
    console.warn(`[FIFO Consume] ⚠️ NO BATCHES FOUND for Product ${productId}!`);
  } else {
    batches.forEach((b, idx) => {
      const batchDate = b.purchaseDate instanceof Date ? b.purchaseDate.toISOString() : b.purchaseDate;
      const createdDate = b.createdAt instanceof Date ? b.createdAt.toISOString() : b.createdAt;
      const purchaseTimestamp = b.purchaseDate instanceof Date ? b.purchaseDate.getTime() : new Date(b.purchaseDate).getTime();
      const createdTimestamp = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
      console.log(`[FIFO Consume]   Batch ${idx + 1} (ID: ${b.id}): ${toNumber(b.qtyRemaining)} units @ ${toNumber(b.unitCost)} each`);
      console.log(
        `[FIFO Consume]     PurchaseDate: ${batchDate} (timestamp: ${purchaseTimestamp}), ` +
        `CreatedAt: ${createdDate} (timestamp: ${createdTimestamp}), ` +
        `BranchId: ${b.branchId ?? 'null'}, SourceId: ${b.sourceId || 'N/A'}`
      );
      
      // Verify ordering: each batch should have purchaseDate >= previous batch
      if (idx > 0) {
        const prevBatch = batches[idx - 1];
        const prevPurchaseTimestamp = prevBatch.purchaseDate instanceof Date 
          ? prevBatch.purchaseDate.getTime() 
          : new Date(prevBatch.purchaseDate).getTime();
        if (purchaseTimestamp < prevPurchaseTimestamp) {
          console.error(`[FIFO Consume] ❌ ORDERING ERROR! Batch ${idx + 1} has EARLIER purchaseDate than batch ${idx}!`);
          console.error(`[FIFO Consume]     Batch ${idx}: ${prevPurchaseTimestamp}, Batch ${idx + 1}: ${purchaseTimestamp}`);
        }
      }
    });
  }

  const totalAvailable = batches.reduce((sum, b) => sum + toNumber(b.qtyRemaining), 0);
  if (totalAvailable + 1e-9 < qtyToSell) {
    const expiredAgg = await tx.inventoryBatch.aggregate({
      where: {
        tenantId,
        productId,
        qtyRemaining: { gt: toDecimal(0) },
        expiryDate: { not: null, lt: expiryCutoff },
      },
      _sum: { qtyRemaining: true },
    });
    const expiredQty = toNumber(expiredAgg._sum.qtyRemaining);
    if (expiredQty > 0) {
      throw new Error(
        'Expired stock — write off before issuing. Some quantity is held on expired batches.'
      );
    }
    throw new Error(`Insufficient stock for FIFO. Available: ${totalAvailable}, Requested: ${qtyToSell}`);
  }

  let remaining = qtyToSell;
  let cogsAmount = 0;
  const allocations = [];

  // CRITICAL: Verify batches are in FIFO order (oldest first) before consuming
  // Sort manually as a safeguard in case database ordering fails
  // Use purchaseDate first, then createdAt, then batch ID as final tiebreaker
  console.log(`[FIFO Consume] Before manual sort: ${batches.length} batches`);
  batches.forEach((b, idx) => {
    const purchaseTime = b.purchaseDate instanceof Date ? b.purchaseDate.getTime() : new Date(b.purchaseDate).getTime();
    const createdTime = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
    console.log(`[FIFO Consume]   Before sort - Batch ${idx + 1} (ID: ${b.id}): cost=${toNumber(b.unitCost)}, qty=${toNumber(b.qtyRemaining)}, purchaseTime=${purchaseTime}, createdTime=${createdTime}`);
  });
  
  // CRITICAL: Sort to ensure FIFO order (oldest first)
  // Create a completely new sorted array to avoid any reference issues
  const sortedBatches = batches.slice().sort((a, b) => {
    const aDate = a.purchaseDate instanceof Date ? a.purchaseDate.getTime() : new Date(a.purchaseDate).getTime();
    const bDate = b.purchaseDate instanceof Date ? b.purchaseDate.getTime() : new Date(b.purchaseDate).getTime();
    
    // Primary sort: purchaseDate (oldest first = ascending)
    if (aDate < bDate) {
      return -1; // a is older, comes first
    }
    if (aDate > bDate) {
      return 1; // b is older, comes first
    }
    
    // Secondary sort: createdAt (oldest first) if purchaseDate is same
    const aCreated = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
    const bCreated = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
    
    if (aCreated < bCreated) {
      return -1; // a is older, comes first
    }
    if (aCreated > bCreated) {
      return 1; // b is older, comes first
    }
    
    // Final tiebreaker: use batch ID (CUIDs are time-ordered, lexicographically earlier = older)
    return a.id.localeCompare(b.id);
  });
  
  // Verify sort worked correctly
  for (let i = 1; i < sortedBatches.length; i++) {
    const prevDate = sortedBatches[i-1].purchaseDate instanceof Date 
      ? sortedBatches[i-1].purchaseDate.getTime() 
      : new Date(sortedBatches[i-1].purchaseDate).getTime();
    const currDate = sortedBatches[i].purchaseDate instanceof Date 
      ? sortedBatches[i].purchaseDate.getTime() 
      : new Date(sortedBatches[i].purchaseDate).getTime();
    if (currDate < prevDate) {
      console.error(`[FIFO Sort] ❌❌❌ SORT FAILED! Batch ${i} (${currDate}) is OLDER than batch ${i-1} (${prevDate})!`);
    }
  }
  
  // Replace batches with sorted array
  batches = sortedBatches;
  
  console.log(`[FIFO Sort] ✅ Sorted ${batches.length} batches - OLDEST FIRST (FIFO order)`);

  console.log(`[FIFO Consume] ✅ After manual sort: ${batches.length} batches (oldest first - FIFO order)`);
  batches.forEach((b, idx) => {
    const purchaseTime = b.purchaseDate instanceof Date ? b.purchaseDate.getTime() : new Date(b.purchaseDate).getTime();
    const createdTime = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
    const purchaseDateStr = b.purchaseDate instanceof Date ? b.purchaseDate.toISOString() : new Date(b.purchaseDate).toISOString();
    console.log(`[FIFO Consume]   After sort - Batch ${idx + 1} (ID: ${b.id}): cost=${toNumber(b.unitCost)}, qty=${toNumber(b.qtyRemaining)}, purchaseDate=${purchaseDateStr}`);
    console.log(`[FIFO Consume]     This batch will be consumed ${idx === 0 ? 'FIRST (oldest)' : idx === batches.length - 1 ? 'LAST (newest)' : 'in order'}`);
  });

  // CRITICAL: Consume batches in FIFO order (oldest first)
  // The batches array is now sorted, so we iterate in order
  // Final verification: log the exact consumption order
  console.log(`[FIFO Consume] 🎯 FINAL CONSUMPTION ORDER (will consume in this sequence):`);
  batches.forEach((b, idx) => {
    const cost = toNumber(b.unitCost);
    const qty = toNumber(b.qtyRemaining);
    const date = b.purchaseDate instanceof Date ? b.purchaseDate.getTime() : new Date(b.purchaseDate).getTime();
    console.log(`[FIFO Consume]   ${idx + 1}. Batch ID: ${b.id}, Cost: ${cost}, Qty: ${qty}, Date: ${date} ${idx === 0 ? '← FIRST (oldest)' : idx === batches.length - 1 ? '← LAST (newest)' : ''}`);
  });
  
  // Verify the first batch is actually the oldest
  if (batches.length > 1) {
    const firstBatch = batches[0];
    const lastBatch = batches[batches.length - 1];
    const firstDate = firstBatch.purchaseDate instanceof Date ? firstBatch.purchaseDate.getTime() : new Date(firstBatch.purchaseDate).getTime();
    const lastDate = lastBatch.purchaseDate instanceof Date ? lastBatch.purchaseDate.getTime() : new Date(lastBatch.purchaseDate).getTime();
    const firstCost = toNumber(firstBatch.unitCost);
    const lastCost = toNumber(lastBatch.unitCost);
    
    if (firstDate > lastDate) {
      console.error(`[FIFO Consume] ❌❌❌ CRITICAL ERROR: First batch is NEWER than last batch! This is LIFO, not FIFO!`);
      console.error(`[FIFO Consume] First batch: date=${firstDate}, cost=${firstCost}`);
      console.error(`[FIFO Consume] Last batch: date=${lastDate}, cost=${lastCost}`);
    } else {
      console.log(`[FIFO Consume] ✅ Verified: First batch (date=${firstDate}, cost=${firstCost}) is OLDER than last batch (date=${lastDate}, cost=${lastCost}) - FIFO order is correct`);
    }
  }
  
  let batchIndex = 0;
  for (const batch of batches) {
    batchIndex++;
    if (remaining <= 0) {
      console.log(`[FIFO Consume] All quantity consumed, stopping at batch ${batchIndex}`);
      break;
    }
    const batchRemaining = toNumber(batch.qtyRemaining);
    if (batchRemaining <= 0) {
      console.log(`[FIFO Consume] Batch ${batchIndex} has no remaining quantity, skipping`);
      continue;
    }

    const useQty = Math.min(batchRemaining, remaining);
    const unitCost = toNumber(batch.unitCost);
    const lineCogs = useQty * unitCost;
    
    const batchPurchaseDate = batch.purchaseDate instanceof Date 
      ? batch.purchaseDate.toISOString() 
      : new Date(batch.purchaseDate).toISOString();
    const batchPurchaseTimestamp = batch.purchaseDate instanceof Date 
      ? batch.purchaseDate.getTime() 
      : new Date(batch.purchaseDate).getTime();
    
    console.log(`[FIFO Consume] 🔵 CONSUMING Batch ${batchIndex}/${batches.length} (ID: ${batch.id}): ${useQty} units @ ${unitCost} each = ${lineCogs} COGS`);
    console.log(`[FIFO Consume]    PurchaseDate: ${batchPurchaseDate} (timestamp: ${batchPurchaseTimestamp})`);
    console.log(`[FIFO Consume]    ${batchIndex === 1 ? '✅ This is the FIRST batch (oldest) - correct FIFO order' : batchIndex === batches.length ? '⚠️ This is the LAST batch (newest)' : 'In order'}`);
    console.log(`[FIFO Consume]    Remaining in batch: ${batchRemaining - useQty}, Remaining to consume: ${remaining - useQty}`);

    // Update batch remaining
    await tx.inventoryBatch.update({
      where: { id: batch.id },
      data: { qtyRemaining: toDecimal(batchRemaining - useQty) },
    });

    // Audit consumption
    await tx.inventoryBatchConsumption.create({
      data: {
        tenantId,
        batchId: batch.id,
        saleId,
        saleItemId,
        quantity: toDecimal(useQty),
        unitCost: toDecimal(unitCost),
        cogsAmount: toDecimal(lineCogs),
      },
    });

    allocations.push({ batchId: batch.id, quantity: useQty, unitCost, cogsAmount: lineCogs });
    cogsAmount += lineCogs;
    remaining -= useQty;
  }

  console.log(`[FIFO Consume] Total COGS: ${cogsAmount} from ${allocations.length} batch(es)`);
  console.log(`[FIFO Consume] Allocations:`, allocations.map(a => `${a.quantity} @ ${a.unitCost} = ${a.cogsAmount}`).join(', '));

  // Recompute valuation for this product from remaining batches
  const remainingBatches = await tx.inventoryBatch.findMany({
    where: {
      tenantId,
      productId,
      ...(branchId ? { branchId } : {}),
      qtyRemaining: { gt: toDecimal(0) },
    },
    select: { qtyRemaining: true, unitCost: true },
  });
  const totalStockValue = remainingBatches.reduce((sum, b) => sum + (toNumber(b.qtyRemaining) * toNumber(b.unitCost)), 0);

  await tx.product.update({
    where: { id: productId },
    data: {
      totalStockValue: toDecimal(totalStockValue),
      totalSoldQty: { increment: toDecimal(qtyToSell) },
    },
  });

  return { cogsAmount, allocations };
}






