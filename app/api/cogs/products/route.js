// app/api/cogs/products/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

/**
 * GET - Get products with their COGS and sales data
 */
export async function GET(request) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated' },
        { status: 401 }
      );
    }

    // Get all products for the tenant
    const products = await prisma.product.findMany({
      where: {
        tenantId: user.tenantId,
        isDeleted: false
      },
      include: {
        saleItems: {
          where: {
            sale: {
              status: 'completed'
            }
          },
          select: {
            id: true,
            quantity: true,
            amount: true,
            customProductData: true,
            sale: {
              select: {
                id: true,
                saleDate: true,
                status: true
              }
            }
          },
          orderBy: {
            sale: {
              saleDate: 'desc'
            }
          }
        },
      },
      orderBy: {
        name: 'asc'
      }
    });

    // Get all sale item IDs and sale IDs to query FIFO consumption records
    const allSaleItemIds = products.flatMap(p => 
      (p.saleItems || []).map(item => item.id).filter(Boolean)
    );
    const allSaleIds = products.flatMap(p => 
      (p.saleItems || []).map(item => item.sale?.id).filter(Boolean)
    );
    
    // Query FIFO consumption records by both saleItemId and saleId
    const fifoConsumptions = (allSaleItemIds.length > 0 || allSaleIds.length > 0) ? await prisma.inventoryBatchConsumption.findMany({
      where: {
        tenantId: user.tenantId,
        OR: [
          ...(allSaleItemIds.length > 0 ? [{ saleItemId: { in: allSaleItemIds } }] : []),
          ...(allSaleIds.length > 0 ? [{ saleId: { in: allSaleIds } }] : [])
        ]
      },
      select: {
        id: true,
        saleItemId: true,
        saleId: true,
        cogsAmount: true,
        quantity: true,
        unitCost: true,
        batchId: true
      }
    }) : [];
    
    console.log(`[COGS Products] Querying FIFO consumptions for ${allSaleItemIds.length} saleItemIds and ${allSaleIds.length} saleIds`);
    console.log(`[COGS Products] Found ${fifoConsumptions.length} FIFO consumption records`);
    if (fifoConsumptions.length > 0) {
      console.log(`[COGS Products] Sample FIFO consumption:`, fifoConsumptions[0]);
    }

    // Group FIFO consumptions by saleItemId (preferred) and saleId (fallback)
    const fifoBySaleItem = {};
    const fifoBySale = {};
    
    for (const consumption of fifoConsumptions) {
      const cogsAmount = Number(consumption.cogsAmount);
      if (consumption.saleItemId) {
        if (!fifoBySaleItem[consumption.saleItemId]) {
          fifoBySaleItem[consumption.saleItemId] = 0;
        }
        fifoBySaleItem[consumption.saleItemId] += cogsAmount;
        console.log(`[COGS Products] Added FIFO consumption: saleItemId=${consumption.saleItemId}, cogsAmount=${cogsAmount}, total=${fifoBySaleItem[consumption.saleItemId]}`);
      }
      if (consumption.saleId) {
        if (!fifoBySale[consumption.saleId]) {
          fifoBySale[consumption.saleId] = 0;
        }
        fifoBySale[consumption.saleId] += cogsAmount;
      }
    }
    
    console.log(`[COGS Products] Grouped FIFO consumptions: ${Object.keys(fifoBySaleItem).length} saleItems, ${Object.keys(fifoBySale).length} sales`);
    console.log(`[COGS Products] Sample fifoBySaleItem:`, Object.entries(fifoBySaleItem).slice(0, 3));

    // Calculate COGS and sales statistics for each product using FIFO data
    const productsWithStats = products.map(product => {
      const saleItems = product.saleItems || [];
      const totalSales = saleItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      const totalRevenue = saleItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      
      // Calculate total COGS using FIFO data
      let totalCOGS = 0;
      const salesWithCOGS = saleItems.map(item => {
        let itemCOGS = 0;
        let cogsSource = 'none';
        
        // Parse customProductData if it's a string (JSON)
        let customData = item.customProductData;
        if (typeof customData === 'string') {
          try {
            customData = JSON.parse(customData);
          } catch (e) {
            console.warn(`[COGS Products] Failed to parse customProductData for SaleItem ${item.id}:`, e);
            customData = null;
          }
        }
        
        // Priority 1: Use stored FIFO COGS from customProductData
        if (customData && typeof customData === 'object') {
          console.log(`[COGS Products] SaleItem ${item.id} has customProductData:`, JSON.stringify(customData).substring(0, 200));
          const fifoCogs = customData.fifoCogs;
          if (fifoCogs && fifoCogs.cogsAmount !== undefined && fifoCogs.cogsAmount !== null) {
            itemCOGS = typeof fifoCogs.cogsAmount === 'object' && fifoCogs.cogsAmount?.toNumber 
              ? fifoCogs.cogsAmount.toNumber() 
              : Number(fifoCogs.cogsAmount);
            if (itemCOGS > 0) {
              cogsSource = 'customProductData';
              console.log(`[COGS Products] ✅ Using stored FIFO from customProductData for SaleItem ${item.id}: ${itemCOGS} (qty: ${item.quantity})`);
            } else {
              console.warn(`[COGS Products] ⚠️ FIFO data found but cogsAmount is 0 or invalid for SaleItem ${item.id}`);
            }
          } else {
            console.warn(`[COGS Products] ⚠️ customProductData exists but no fifoCogs for SaleItem ${item.id}`);
            if (customData.productCostAtSale !== undefined) {
              console.log(`[COGS Products] Found productCostAtSale: ${customData.productCostAtSale}`);
            }
          }
        } else {
          console.warn(`[COGS Products] ⚠️ No customProductData for SaleItem ${item.id} (type: ${typeof item.customProductData}, value: ${item.customProductData ? 'exists' : 'null/undefined'})`);
        }
        
        // Priority 2: Use FIFO consumption records if stored data not available
        if (itemCOGS === 0) {
          console.log(`[COGS Products] Checking FIFO consumption for SaleItem ${item.id} (saleId: ${item.sale?.id})`);
          if (item.id && fifoBySaleItem[item.id]) {
            itemCOGS = fifoBySaleItem[item.id];
            cogsSource = 'fifoConsumption';
            console.log(`[COGS Products] ✅ Using FIFO consumption records (by saleItemId) for SaleItem ${item.id}: ${itemCOGS}`);
          } else if (item.sale?.id && fifoBySale[item.sale.id]) {
            // Fallback: use sale-level aggregation if saleItemId not found
            // This handles cases where consumption records only have saleId
            const saleTotalCOGS = fifoBySale[item.sale.id];
            // Estimate this item's share (rough approximation)
            const quantity = Number(item.quantity || 0);
            const saleTotalQty = saleItems.filter(si => si.sale?.id === item.sale?.id)
              .reduce((sum, si) => sum + Number(si.quantity || 0), 0);
            if (saleTotalQty > 0) {
              itemCOGS = (saleTotalCOGS / saleTotalQty) * quantity;
              cogsSource = 'fifoConsumptionBySale';
              console.log(`[COGS Products] ✅ Using FIFO consumption records (by saleId, estimated) for SaleItem ${item.id}: ${itemCOGS} (saleTotalCOGS: ${saleTotalCOGS}, saleTotalQty: ${saleTotalQty}, quantity: ${quantity})`);
            }
          } else {
            console.warn(`[COGS Products] ⚠️ No FIFO consumption records found for SaleItem ${item.id} (saleId: ${item.sale?.id})`);
          }
        }
        
        // Priority 3: Fall back to product cost at time of sale (stored in customProductData)
        if (itemCOGS === 0) {
          let productCost = 0;
          const quantity = Number(item.quantity || 0);
          
          // Try to get product cost at time of sale from customProductData
          if (customData && typeof customData === 'object' && customData.productCostAtSale !== undefined) {
            productCost = Number(customData.productCostAtSale);
            cogsSource = 'productCostAtSale';
            console.log(`[COGS Products] ✅ Using product cost at sale time for SaleItem ${item.id}: ${productCost}`);
          } else {
            // For old sales without stored cost: Estimate from FIFO batches at sale date
            // This prevents COGS from changing when current product cost changes
            const saleDate = item.sale?.saleDate ? new Date(item.sale.saleDate) : null;
            
            // For old sales without stored cost: DO NOT use current product cost
            // This prevents COGS from changing when new stock is purchased
            // We can't accurately determine the cost for old sales, so set to 0
            productCost = 0;
            cogsSource = 'noCostData';
            console.warn(`[COGS Products] ⚠️ SaleItem ${item.id} has no stored cost data (old sale created before cost tracking).`);
            console.warn(`[COGS Products] ⚠️ Setting COGS to 0 to prevent incorrect calculations.`);
            console.warn(`[COGS Products] ⚠️ New sales will store cost correctly and won't change.`);
          }
          
          itemCOGS = quantity * productCost;
        }
        
        // Final validation: Never use current product cost for COGS calculation
        // This ensures COGS is locked at the time of sale
        if (itemCOGS === 0 && cogsSource === 'noCostData') {
          console.warn(`[COGS Products] ⚠️ SaleItem ${item.id} has no cost data - COGS set to 0 to prevent incorrect calculations`);
        } else {
          console.log(`[COGS Products] Final COGS for SaleItem ${item.id}: ${itemCOGS} (source: ${cogsSource}, qty: ${item.quantity})`);
        }
        
        totalCOGS += itemCOGS;
        
        return {
          date: item.sale.saleDate,
          quantity: Number(item.quantity || 0),
          revenue: Number(item.amount || 0),
          cogs: itemCOGS,
          cogsSource: cogsSource // Include source for debugging
        };
      });
      
      return {
        id: product.id,
        name: product.name,
        cost: product.cost || 0,
        price: product.price || 0,
        stockLevel: product.stockLevel || 0,
        totalSales,
        totalRevenue,
        totalCOGS,
        sales: salesWithCOGS
      };
    });

    return NextResponse.json({
      products: productsWithStats,
      totalProducts: productsWithStats.length
    });

  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products data' },
      { status: 500 }
    );
  }
}
