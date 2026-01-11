// app/api/inventory/[id]/can-delete/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// GET - Check if a product can be deleted
export async function GET(request, { params }) {
  let productId;
  try {
    const { id } = await params;
    productId = id;
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Check if product exists and belongs to user's tenant
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        sku: true,
        tenantId: true
      }
    });
    
    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }
    
    // Security check: Ensure the product belongs to the user's tenant
    if (product.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }
    
    // Check if product is used in any invoices
    let canDelete = true;
    let reason = null;
    let usageCount = 0;
    let usageDetails = [];
    
    try {
      // Check invoice items
      const invoiceItemsCount = await prisma.invoiceItem.count({
        where: { productId }
      });
      
      if (invoiceItemsCount > 0) {
        canDelete = false;
        reason = 'Product is used in invoices';
        usageCount += invoiceItemsCount;
        
        // Get some invoice details for better UX
        const invoiceItems = await prisma.invoiceItem.findMany({
          where: { productId },
          include: {
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
                issueDate: true,
                status: true
              }
            }
          },
          take: 5 // Limit to first 5 for performance
        });
        
        usageDetails.push({
          type: 'invoices',
          count: invoiceItemsCount,
          items: invoiceItems.map(item => ({
            invoiceNumber: item.invoice.invoiceNumber,
            issueDate: item.invoice.issueDate,
            status: item.invoice.status
          }))
        });
      }
    } catch (error) {
      // If there's an error checking invoice items (e.g., table doesn't exist),
      // log it but allow deletion to proceed
      console.warn("Error checking invoice items:", error);
    }
    
    // Check if product is used in any sales
    try {
      const salesItemsCount = await prisma.saleItem.count({
        where: { 
          productId,
          isCustom: false // Only check non-custom products
        }
      });
      
      if (salesItemsCount > 0) {
        canDelete = false;
        if (reason) {
          reason = 'Product is used in invoices and sales';
        } else {
          reason = 'Product is used in sales';
        }
        usageCount += salesItemsCount;
        
        // Get some sales details
        const salesItems = await prisma.saleItem.findMany({
          where: { 
            productId,
            isCustom: false
          },
          include: {
            sale: {
              select: {
                id: true,
                saleNumber: true,
                saleDate: true,
                status: true
              }
            }
          },
          take: 5
        });
        
        usageDetails.push({
          type: 'sales',
          count: salesItemsCount,
          items: salesItems.map(item => ({
            saleNumber: item.sale.saleNumber,
            saleDate: item.sale.saleDate,
            status: item.sale.status
          }))
        });
      }
    } catch (error) {
      console.warn("Error checking sales items:", error);
    }
    
    // Check if product is used in any quotations
    try {
      const quotationItemsCount = await prisma.quotationItem.count({
        where: { productId }
      });
      
      if (quotationItemsCount > 0) {
        canDelete = false;
        if (reason) {
          reason = reason.includes('sales') ? 
            'Product is used in invoices, sales, and quotations' :
            'Product is used in invoices and quotations';
        } else {
          reason = 'Product is used in quotations';
        }
        usageCount += quotationItemsCount;
        
        usageDetails.push({
          type: 'quotations',
          count: quotationItemsCount
        });
      }
    } catch (error) {
      console.warn("Error checking quotation items:", error);
    }
    
    return NextResponse.json({
      canDelete,
      reason,
      usageCount,
      usageDetails,
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku
      }
    });
  } catch (error) {
    console.error(`Error checking if product ${productId} can be deleted:`, error);
    return NextResponse.json(
      { error: 'Failed to check product deletion status. Please try again.' },
      { status: 500 }
    );
  }
}
