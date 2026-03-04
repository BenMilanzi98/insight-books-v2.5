// app/api/inventory/[id]/route.js - Fixed version
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// Helper function to get product by ID with validation
async function getProductWithValidation(id, tenantId) {
  // Include all fields from the Product model with units
  const product = await prisma.product.findUnique({
    where: { 
      id,
      isDeleted: false // Only get non-deleted products
    },
    // Select all known fields explicitly
    select: {
      id: true,
      name: true,
      sku: true,
      description: true,
      category: true,
      stockLevel: true,
      reorderPoint: true,
      location: true,
      image: true,
      price: true,
      cost: true,
      averageCost: true,
      lastPurchaseCost: true,
      totalStockValue: true,
      taxRate: true,
      isService: true,
      createdAt: true,
      updatedAt: true,
      tenantId: true,
      isDeleted: true,
      deletedAt: true,
      deletedBy: true,
      deletionReason: true,
      // Include product units with unit details
      productUnits: {
        include: {
          unit: {
            select: {
              id: true,
              name: true,
              symbol: true,
              conversionToBase: true,
              isBaseUnit: true,
              baseUnit: {
                select: {
                  id: true,
                  name: true,
                  displayName: true,
                  baseUnit: true
                }
              }
            }
          }
        }
      },
      // Include product taxes
      productTaxes: {
        include: {
          taxType: {
            select: {
              id: true,
              taxId: true,
              taxName: true,
              taxCode: true,
              taxRate: true,
              calculationType: true,
              status: true
            }
          }
        }
      }
    }
  });
  
  if (!product) {
    return { error: 'Product not found', status: 404 };
  }
  
  // Security check: Ensure the product belongs to the user's tenant
  if (product.tenantId !== tenantId) {
    return { error: 'Access denied', status: 403 };
  }
  
  // Add mock transactions since the model doesn't exist yet
  const transactions = [];
  
  // Determine product status
  let status;
  const stockLevel = product.stockLevel || 0;
  const reorderPoint = product.reorderPoint || 10; // Use the actual reorderPoint or default
  
  if (stockLevel === 0) {
    status = 'Out of Stock';
  } else if (stockLevel <= reorderPoint) {
    status = 'Low Stock';
  } else {
    status = 'In Stock';
  }
  
  // For unit-managed products, use the main product stock as the source of truth
  // Individual unit stocks are calculated from the main stock for consistency
  let effectiveStockLevel = stockLevel;

  // Return product with additional computed fields
  // Use actual values from database or fallbacks if they're null
  // Compute taxRate from productTaxes if the field is null/0
  const computedTaxRate = product.taxRate || (product.productTaxes || [])
    .filter(pt => pt.taxType.status === 'Active')
    .reduce(function(sum, pt) { return sum + (parseFloat(pt.taxType.taxRate) || 0); }, 0);
  
  // Format taxes for frontend
  const formattedTaxes = (product.productTaxes || [])
    .filter(function(pt) { return pt.taxType.status === 'Active'; })
    .map(function(pt) {
      return {
        id: pt.taxType.id,
        taxId: pt.taxType.taxId,
        taxName: pt.taxType.taxName,
        taxCode: pt.taxType.taxCode,
        taxRate: pt.taxType.taxRate,
        calculationType: pt.taxType.calculationType
      };
    });
  
  // Cost precedence: lastPurchaseCost, then cost, then averageCost (same as list/statistics)
  const costPrice = Number(product.lastPurchaseCost) || product.cost || Number(product.averageCost) || 0;
  const totalStockValueStored = product.totalStockValue != null ? Number(product.totalStockValue) : null;
  const totalStockValue = (totalStockValueStored != null && totalStockValueStored > 0)
    ? totalStockValueStored
    : (effectiveStockLevel * costPrice);

  return {
    product: {
      ...product,
      category: product.category || 'Uncategorized',
      reorderPoint: product.reorderPoint || 10,
      location: product.location || 'Default Location',
      quantityInStock: effectiveStockLevel, // For display purposes
      originalStockLevel: stockLevel, // Original product stock level for editing
      unitPrice: product.price,
      costPrice,
      totalStockValue,
      status,
      image: product.image || `/api/placeholder/80/80`,
      imageUrl: product.image || `/api/placeholder/80/80`, // Add imageUrl for consistency
      lastUpdated: product.updatedAt.toISOString(),
      transactions,
      // Include computed taxRate
      taxRate: computedTaxRate,
      // Include taxes data for the frontend
      taxes: formattedTaxes,
      // Include units data for the frontend - transform productUnits to expected format
      // Calculate individual unit stocks from main product stock for consistency
      units: (product.productUnits || []).map(pu => {
        const conversionRate = parseFloat(pu.unit?.conversionToBase ?? 1);
        const calculatedStock = pu.unit?.isBaseUnit 
          ? stockLevel 
          : stockLevel * conversionRate;
        
        return {
          id: pu.unit?.id || pu.id,
          name: pu.unit?.name,
          symbol: pu.unit?.symbol,
          isBaseUnit: !!pu.unit?.isBaseUnit,
          conversionToBase: pu.unit?.conversionToBase ?? 1,
          unitPrice: pu.unitPrice ?? product.price,
          costPrice: pu.costPrice ?? product.cost,
          quantityInStock: calculatedStock,
          reorderPoint: pu.reorderPoint ?? 0,
        };
      })
    }
  };
}

// GET - Fetch a single product by ID
export async function GET(request, { params }) {
  try {
    const { id: productId } = await params;
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Get product with validation
    const result = await getProductWithValidation(productId, user.tenantId);
    
    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }
    
    return NextResponse.json(result.product);
  } catch (error) {
    console.error(`Error fetching product ${params.id}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch product. Please try again.' },
      { status: 500 }
    );
  }
}

// PUT - Update a product
export async function PUT(request, { params }) {
  try {
    const { id: productId } = await params;
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Get product with validation
    const result = await getProductWithValidation(productId, user.tenantId);
    
    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }
    
    const body = await request.json();
    console.log("Update request body:", JSON.stringify(body, null, 2)); // Debug log
    
    // Check if SKU is being changed and if it's already in use
    if (body.sku && body.sku !== result.product.sku) {
      const skuExists = await prisma.product.findFirst({
        where: { 
          sku: body.sku,
          tenantId: user.tenantId,
          id: { not: productId }
        }
      });
      
      if (skuExists) {
        return NextResponse.json(
          { error: 'A product with this SKU already exists' },
          { status: 400 }
        );
      }
    }
    
    // If stock level is changing, log it
    const oldStockLevel = result.product.quantityInStock;
    const originalProductStock = result.product.stockLevel; // This is the actual database stock level
    
    console.log("=== PRODUCT UPDATE DEBUG ===");
    console.log("BEFORE UPDATE:");
    console.log(`  - Product Name: ${result.product.name}`);
    console.log(`  - Original Database Stock: ${originalProductStock}`);
    console.log(`  - Calculated Effective Stock: ${oldStockLevel}`);
    console.log(`  - Request Body Quantity: ${body.quantityInStock}`);
    console.log(`  - Unit Management Enabled: ${body.unitManagementEnabled}`);
    console.log(`  - Number of Units: ${body.selectedUnits?.length || 0}`);
    
    // For unit management, check if user is explicitly updating the stock level
    // If the frontend sends a different stock level than the original, respect the user's change
    const isStockLevelChanged = body.quantityInStock !== undefined && 
                               body.quantityInStock !== originalProductStock;
    
    const newStockLevel = body.unitManagementEnabled 
      ? (isStockLevelChanged ? body.quantityInStock : originalProductStock)  // Allow explicit stock updates
      : (body.quantityInStock !== undefined ? body.quantityInStock : oldStockLevel);
    
    console.log("STOCK LEVEL DECISION:");
    console.log(`  - Original database stock: ${originalProductStock}`);
    console.log(`  - Request body quantity: ${body.quantityInStock}`);
    console.log(`  - Is stock level changed: ${isStockLevelChanged}`);
    console.log(`  - New stock level to save: ${newStockLevel}`);
    console.log("=============================");
    
    // Fix image handling - don't save blob URLs to database
    let imagePath = body.image || body.imageUrl || result.product.image;
    
    // Check if the image is a blob URL and keep the existing image instead
    if (imagePath && imagePath.startsWith('blob:')) {
      console.log("Detected blob URL in image path, using existing image instead");
      imagePath = result.product.image || `/api/placeholder/80/80`;
    }
    
    // Compute taxRate from selectedTaxIds if provided, otherwise use body.taxRate
    let computedTaxRate;
    if (body.selectedTaxIds && Array.isArray(body.selectedTaxIds) && body.selectedTaxIds.length > 0) {
      try {
        const taxTypes = await prisma.taxType.findMany({
          where: {
            id: { in: body.selectedTaxIds },
            tenantId: user.tenantId,
            status: 'Active',
          },
          select: { taxRate: true }
        });
        // Sum up all tax rates
        computedTaxRate = taxTypes.reduce((sum, tax) => sum + (parseFloat(tax.taxRate) || 0), 0);
        console.log(`[Product Update] Computed taxRate from ${taxTypes.length} tax types: ${computedTaxRate}`);
      } catch (taxError) {
        console.error('[Product Update] Error computing tax rate from selectedTaxIds:', taxError);
        // Fall back to body.taxRate or existing taxRate
        computedTaxRate = body.taxRate !== undefined ? body.taxRate : result.product.taxRate;
      }
    } else {
      computedTaxRate = body.taxRate !== undefined ? body.taxRate : result.product.taxRate;
    }
    
    // Resolve new cost for recalcing totalStockValue
    const newCost = body.costPrice !== undefined ? body.costPrice : (body.cost !== undefined ? body.cost : result.product.cost);
    const numericCost = Number(newCost) || 0;

    // Prepare update data with all available fields
    const updateData = {
      name: body.name !== undefined ? body.name : result.product.name,
      sku: body.sku !== undefined ? body.sku : result.product.sku,
      description: body.description !== undefined ? body.description : result.product.description,
      category: body.category !== undefined ? body.category : result.product.category,
      stockLevel: newStockLevel,
      reorderPoint: body.reorderPoint !== undefined ? body.reorderPoint : result.product.reorderPoint,
      location: body.location !== undefined ? body.location : result.product.location,
      price: body.unitPrice !== undefined ? body.unitPrice : (body.price !== undefined ? body.price : result.product.price),
      cost: body.costPrice !== undefined ? body.costPrice : (body.cost !== undefined ? body.cost : result.product.cost),
      taxRate: computedTaxRate,
      isService: body.isService !== undefined ? body.isService : result.product.isService,
      image: imagePath,
      // Recalculate inventory value when cost or stock changes so /stock shows correct value
      totalStockValue: newStockLevel * numericCost
    };
    
    // Start a transaction to update product and log the change
    console.log("Starting product update transaction...");
    const updated = await prisma.$transaction(async (tx) => {
      // Update the product
      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: updateData
      });
      
      // Handle unit management updates if enabled
      console.log("Checking unit management:", {
        enabled: body.unitManagementEnabled,
        hasUnits: body.selectedUnits && body.selectedUnits.length > 0,
        unitsCount: body.selectedUnits?.length || 0
      });
      
      try {
        if (body.unitManagementEnabled && body.selectedUnits && body.selectedUnits.length > 0) {
          // Delete existing product units
          console.log("Deleting existing product units...");
          await tx.productUnit.deleteMany({
            where: { productId: productId }
          });
          
          // Create new product units
          const productUnits = [];
          for (const unit of body.selectedUnits) {
            const config = body.unitConfigurations[unit.id];
            if (config && unit.id) {
              console.log("Processing unit:", unit.id, unit.name, "Config:", config);
              
              // Validate and cap numeric values to prevent database overflow
              const maxValue = 999999999.999999; // Max value for precision 15, scale 6
              const quantityInStock = Math.min(parseFloat(config.quantityInStock || 0), maxValue);
              const reorderPoint = Math.min(parseFloat(config.reorderPoint || 0), maxValue);
              const unitPrice = Math.min(parseFloat(config.unitPrice || 0), maxValue);
              const costPrice = Math.min(parseFloat(config.costPrice || 0), maxValue);
              
              // Log if values were capped
              if (parseFloat(config.quantityInStock || 0) > maxValue) {
                console.warn(`Quantity capped from ${config.quantityInStock} to ${quantityInStock} for unit ${unit.name}`);
              }
              if (parseFloat(config.reorderPoint || 0) > maxValue) {
                console.warn(`Reorder point capped from ${config.reorderPoint} to ${reorderPoint} for unit ${unit.name}`);
              }
              
              productUnits.push({
                productId: productId,
                unitId: unit.id,
                isDefault: config.isDefault || false,
                unitPrice: unitPrice,
                costPrice: costPrice,
                quantityInStock: quantityInStock,
                reorderPoint: reorderPoint,
                isActive: true
              });
            } else {
              console.warn("Skipping unit due to missing config or ID:", unit);
            }
          }
          
          if (productUnits.length > 0) {
            console.log("Creating new product units:", productUnits.length);
            console.log("Product units data:", JSON.stringify(productUnits, null, 2));
            
            // Verify that all unit IDs exist before creating ProductUnit records
            const unitIds = productUnits.map(pu => pu.unitId);
            const existingUnits = await tx.unit.findMany({
              where: { id: { in: unitIds } },
              select: { id: true }
            });
            
            const existingUnitIds = existingUnits.map(u => u.id);
            const missingUnitIds = unitIds.filter(id => !existingUnitIds.includes(id));
            
            if (missingUnitIds.length > 0) {
              console.error("Missing unit IDs:", missingUnitIds);
              throw new Error(`Units not found: ${missingUnitIds.join(', ')}`);
            }
            
            await tx.productUnit.createMany({
              data: productUnits
            });
          }
        } else if (body.unitManagementEnabled === false) {
          // If unit management is disabled, remove all existing units
          console.log("Disabling unit management, removing all units...");
          await tx.productUnit.deleteMany({
            where: { productId: productId }
          });
        }
      } catch (unitError) {
        console.error("Error in unit management update:", unitError);
        throw unitError;
      }
      
      // Create an audit log entry for the stock change if needed
      if (newStockLevel !== oldStockLevel) {
        await tx.auditLog.create({
          data: {
            action: 'INVENTORY_STOCK_UPDATE',
            entityType: 'PRODUCT',
            entityId: updatedProduct.id,
            userId: user.id,
            tenantId: user.tenantId,
            details: JSON.stringify({
              productName: updatedProduct.name,
              oldStockLevel: oldStockLevel,
              newStockLevel: updatedProduct.stockLevel,
              change: updatedProduct.stockLevel - oldStockLevel
            })
          }
        });
      }
      
      // Also create a general update audit log
      await tx.auditLog.create({
        data: {
          action: 'PRODUCT_UPDATED',
          entityType: 'PRODUCT',
          entityId: updatedProduct.id,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            ...updateData,
            image: imagePath ? "Updated" : "Not changed", // Don't log full image URL
            unitManagementEnabled: body.unitManagementEnabled || false,
            unitsUpdated: body.unitManagementEnabled ? (body.selectedUnits?.length || 0) : 0
          })
        }
      });
      
      console.log("Product update transaction completed successfully");
      return updatedProduct;
    });
    
    // Determine product status
    let status;
    const updatedReorderPoint = updated.reorderPoint || 10;
    if (updated.stockLevel === 0) {
      status = 'Out of Stock';
    } else if (updated.stockLevel <= updatedReorderPoint) {
      status = 'Low Stock';
    } else {
      status = 'In Stock';
    }
    
    // Fetch the updated product with units and taxes to return complete data
    const updatedProductWithDetails = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        productUnits: {
          include: {
            unit: {
              select: {
                id: true,
                name: true,
                symbol: true,
                conversionToBase: true,
                isBaseUnit: true,
                baseUnit: {
                  select: {
                    id: true,
                    name: true,
                    displayName: true,
                    baseUnit: true
                  }
                }
              }
            }
          }
        },
        productTaxes: {
          include: {
            taxType: {
              select: {
                id: true,
                taxId: true,
                taxName: true,
                taxCode: true,
                taxRate: true,
                calculationType: true,
                status: true
              }
            }
          }
        }
      }
    });
    
    console.log("AFTER UPDATE:");
    console.log(`  - Updated Database Stock: ${updatedProductWithDetails.stockLevel}`);
    console.log(`  - Updated Effective Stock: ${updatedProductWithDetails.productUnits?.reduce((total, pu) => total + parseFloat(pu.quantityInStock || 0), 0) || 0}`);
    console.log("=============================");

    // Calculate effective stock level from units if available
    let effectiveStockLevel = updated.stockLevel;
    if (updatedProductWithDetails.productUnits && updatedProductWithDetails.productUnits.length > 0) {
      effectiveStockLevel = updatedProductWithDetails.productUnits.reduce((total, pu) => {
        return total + parseFloat(pu.quantityInStock || 0);
      }, 0);
    }
    
    // Compute taxRate from productTaxes if the field is null/0
    const finalTaxRate = updated.taxRate || (updatedProductWithDetails.productTaxes || [])
      .filter(pt => pt.taxType && pt.taxType.status === 'Active')
      .reduce(function(sum, pt) { return sum + (parseFloat(pt.taxType.taxRate) || 0); }, 0);
    
    // Format taxes for frontend
    const formattedTaxes = (updatedProductWithDetails.productTaxes || [])
      .filter(function(pt) { return pt.taxType && pt.taxType.status === 'Active'; })
      .map(function(pt) {
        return {
          id: pt.taxType.id,
          taxId: pt.taxType.taxId,
          taxName: pt.taxType.taxName,
          taxCode: pt.taxType.taxCode,
          taxRate: pt.taxType.taxRate,
          calculationType: pt.taxType.calculationType
        };
      });

    // Return updated product with computed fields
    return NextResponse.json({
      message: 'Product updated successfully',
      product: {
        ...updated,
        category: updated.category || 'Uncategorized',
        reorderPoint: updated.reorderPoint || 10,
        location: updated.location || 'Default Location',
        // Use computed taxRate from productTaxes
        taxRate: finalTaxRate,
        // Include taxes data for the frontend
        taxes: formattedTaxes,
        quantityInStock: effectiveStockLevel, // For display purposes (total of all units)
        originalStockLevel: updated.stockLevel, // Original database stock level for editing
        unitPrice: updated.price,
        costPrice: updated.cost || 0,
        status,
        image: updated.image || `/api/placeholder/80/80`,
        imageUrl: updated.image || `/api/placeholder/80/80`,
        lastUpdated: updated.updatedAt.toISOString(),
        // Include units data for the frontend - transform productUnits to expected format
        units: (updatedProductWithDetails.productUnits || []).map(pu => ({
          id: pu.unit?.id || pu.id,
          name: pu.unit?.name,
          symbol: pu.unit?.symbol,
          isBaseUnit: !!pu.unit?.isBaseUnit,
          conversionToBase: pu.unit?.conversionToBase ?? 1,
          unitPrice: pu.unitPrice ?? updated.price,
          costPrice: pu.costPrice ?? updated.cost,
          quantityInStock: pu.quantityInStock ?? 0,
          reorderPoint: pu.reorderPoint ?? 0,
        }))
      }
    });
  } catch (error) {
    console.error(`Error updating product ${productId}:`, error);
    return NextResponse.json(
      { error: 'Failed to update product. Please try again.' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a product
export async function DELETE(request, { params }) {
  try {
    const { id: productId } = await params;
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Get product with validation
    const result = await getProductWithValidation(productId, user.tenantId);
    
    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }
    
    // Collect usage information for audit purposes (but don't block deletion)
    let usageDetails = {
      invoices: 0,
      sales: 0,
      quotations: 0,
      totalUsage: 0
    };
    
    try {
      // Check invoice items
      const invoiceItemsCount = await prisma.invoiceItem.count({
        where: { productId }
      });
      usageDetails.invoices = invoiceItemsCount;
      
      // Check sale items
      const saleItemsCount = await prisma.saleItem.count({
        where: { productId }
      });
      usageDetails.sales = saleItemsCount;
      
      // Check quotation items
      const quotationItemsCount = await prisma.quotationItem.count({
        where: { productId }
      });
      usageDetails.quotations = quotationItemsCount;
      
      usageDetails.totalUsage = invoiceItemsCount + saleItemsCount + quotationItemsCount;
    } catch (error) {
      // If there's an error checking usage, log it but allow deletion to proceed
      console.warn("Error checking product usage:", error);
    }
    
    // Soft delete the product in a transaction
    await prisma.$transaction(async (tx) => {
      // Soft delete the product (keep inventory transactions for audit trail)
      await tx.product.update({
        where: { id: productId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: user.id,
          deletionReason: 'Manual deletion'
        }
      });
      
      // Create an audit log entry with usage information
      await tx.auditLog.create({
        data: {
          action: 'PRODUCT_SOFT_DELETED',
          entityType: 'PRODUCT',
          entityId: productId,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            name: result.product.name,
            sku: result.product.sku,
            category: result.product.category,
            usageAtDeletion: usageDetails,
            deletedDespiteUsage: usageDetails.totalUsage > 0,
            softDelete: true,
            canBeRestored: true
          })
        }
      });
    });
    
    return NextResponse.json({
      message: 'Product deleted successfully',
      usageDetails
    });
  } catch (error) {
    console.error(`Error deleting product ${params.id}:`, error);
    return NextResponse.json(
      { error: 'Failed to delete product. Please try again.' },
      { status: 500 }
    );
  }
}