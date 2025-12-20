import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// GET - Get product usage details
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
    
    // Verify product exists and belongs to user's tenant
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, tenantId: true, name: true, sku: true }
    });
    
    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }
    
    if (product.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }
    
    // Collect detailed usage information
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
      console.warn("Error checking product usage:", error);
      // Return default values if there's an error
    }
    
    return NextResponse.json({
      productId,
      productName: product.name,
      productSku: product.sku,
      usageDetails,
      canDelete: true, // Always allow deletion now
      message: usageDetails.totalUsage > 0 
        ? `Product is used in ${usageDetails.totalUsage} record(s)` 
        : 'Product is not used in any records'
    });
  } catch (error) {
    console.error(`Error checking product usage ${productId}:`, error);
    return NextResponse.json(
      { error: 'Failed to check product usage. Please try again.' },
      { status: 500 }
    );
  }
}
