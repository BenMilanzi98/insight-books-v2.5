// app/api/inventory/export/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { createObjectCsvStringifier } from '@/lib/csv-writer';

// GET - Export inventory data in CSV format
export async function GET(request) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const format = searchParams.get('format') || 'csv'; // Default to CSV
    
    // Build filter object for Prisma
    const where = {
      tenantId: user.tenantId, // Filter by tenant ID for multi-tenancy
    };
    
    // Add category filter if provided
    if (category && category !== 'All') {
      where.category = category;
    }
    
    // Add search filter if provided
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    // Fetch products
    const products = await prisma.product.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        sku: true,
        category: true,
        stockLevel: true,
        reorderPoint: true,
        price: true,
        cost: true,
        location: true,
        isService: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    // Process products to add derived fields like status and filter by status if provided
    const processedProducts = products
      .map(product => {
        // Determine product status based on stock level
        const stockLevel = product.stockLevel || 0;
        const reorderPoint = product.reorderPoint || 0;
        
        let productStatus;
        if (stockLevel === 0) {
          productStatus = 'Out of Stock';
        } else if (stockLevel <= reorderPoint) {
          productStatus = 'Low Stock';
        } else {
          productStatus = 'In Stock';
        }
        
        return {
          ...product,
          status: productStatus
        };
      })
      .filter(product => !status || status === 'All' || product.status === status);
    
    // For CSV format
    if (format === 'csv') {
      return generateCsvResponse(processedProducts, user.tenantId);
    }
    
    // For other formats (could implement PDF, Excel, etc.)
    return NextResponse.json(
      { error: 'Unsupported export format' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error exporting inventory:', error);
    return NextResponse.json(
      { error: 'Failed to export inventory. Please try again.' },
      { status: 500 }
    );
  }
}

// Generate CSV response
async function generateCsvResponse(products, tenantId) {
  // Get tenant information for the filename
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true }
  });
  
  // Define CSV header
  const csvStringifier = createObjectCsvStringifier({
    header: [
      { id: 'sku', title: 'SKU' },
      { id: 'name', title: 'Product Name' },
      { id: 'category', title: 'Category' },
      { id: 'stockLevel', title: 'Quantity in Stock' },
      { id: 'reorderPoint', title: 'Reorder Point' },
      { id: 'price', title: 'Selling Price (MWK)' },
      { id: 'cost', title: 'Cost Price (MWK)' },
      { id: 'location', title: 'Location' },
      { id: 'status', title: 'Status' },
      { id: 'profit', title: 'Profit Margin %' },
      { id: 'stockValue', title: 'Stock Value (MWK)' },
      { id: 'lastUpdated', title: 'Last Updated' }
    ]
  });
  
  // Transform products for CSV
  const records = products.map(product => {
    // Calculate profit margin
    const profitMargin = product.price > 0 
      ? Math.round(((product.price - product.cost) / product.price) * 100) 
      : 0;
    
    // Calculate stock value
    const stockValue = (product.stockLevel || 0) * (product.cost || 0);
    
    return {
      sku: product.sku,
      name: product.name,
      category: product.category || 'Uncategorized',
      stockLevel: product.stockLevel || 0,
      reorderPoint: product.reorderPoint || 0,
      price: product.price || 0,
      cost: product.cost || 0,
      location: product.location || '',
      status: product.status,
      profit: profitMargin,
      stockValue: stockValue,
      lastUpdated: product.updatedAt.toISOString().split('T')[0]
    };
  });
  
  // Generate CSV content
  const csvContent = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
  
  // Create filename with tenant name and current date
  const date = new Date().toISOString().split('T')[0];
  const tenantName = tenant?.name?.replace(/\s+/g, '_').toLowerCase() || 'inventory';
  const filename = `${tenantName}_inventory_${date}.csv`;
  
  // Return CSV file
  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}