// app/api/sales/route.js - Enhanced with Project B's business logic
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requirePermission } from '@/lib/auth';
import { createSale } from '@/lib/sales/createSale';

// GET - Fetch sales with filtering, sorting, and pagination
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'sales.view');
    if (perm) return perm;

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
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const status = searchParams.get('status');
    const clientId = searchParams.get('clientId');
    const search = searchParams.get('search');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    
    // Check if the Sale model exists in Prisma
    if (!prisma.sale) {
      console.error("Sale model not found in Prisma client. Returning mock data.");
      
      // Return mock data as a fallback
      return NextResponse.json({
        sales: [
          { 
            id: "mock-1", 
            saleNumber: "SL-001", 
            date: "2025-03-07", 
            client: "Walk-in Customer", 
            clientId: null,
            createdBy: "Admin",
            subtotal: "120,000.00",
            taxAmount: "19,800.00",
            total: "139,800.00", 
            taxRate: 16.5,
            status: "completed",
            paymentMethod: "cash",
            notes: null,
            itemCount: 3,
            createdAt: new Date().toISOString(),
            rawTotal: 139800,
            rawSubtotal: 120000
          },
          { 
            id: "mock-2", 
            saleNumber: "SL-002", 
            date: "2025-03-06", 
            client: "Acme Corp", 
            clientId: "mock-client-1",
            createdBy: "Admin",
            subtotal: "450,000.00",
            taxAmount: "74,250.00",
            total: "524,250.00", 
            taxRate: 16.5,
            status: "completed",
            paymentMethod: "card",
            notes: null,
            itemCount: 5,
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            rawTotal: 524250,
            rawSubtotal: 450000
          }
        ],
        pagination: {
          page,
          limit,
          totalCount: 2,
          totalPages: 1
        }
      });
    }
    
    // Require tenant context so we never return empty due to null tenantId
    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { error: 'No tenant context. Please log in again or select a tenant.', sales: [], pagination: { page: 1, limit, totalCount: 0, totalPages: 0 } },
        { status: 400 }
      );
    }
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Build filter object for Prisma
    const where = {
      tenantId, // Filter by tenant ID for multi-tenancy
    };
    
    // Add branch filter only when explicitly requested (branchId query param).
    // Do not auto-filter by user.currentBranchId: otherwise sales with branchId null
    // (e.g. created before branch was set or with no branch) are excluded and history appears empty.
    const branchId = searchParams.get('branchId');
    if (branchId) {
      where.branchId = branchId;
    }
    
    // Add status filter if provided
    if (status) {
      where.status = status;
    }
    
    // Add client filter if provided
    if (clientId) {
      where.clientId = clientId;
    }
    
    // Add date range filter if provided
    if (dateFrom || dateTo) {
      where.saleDate = {};
      if (dateFrom) {
        where.saleDate.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.saleDate.lte = new Date(dateTo);
      }
    }
    
    // Add search filter if provided
    if (search) {
      where.OR = [
        { saleNumber: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { client: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }
    
    // Get total count for pagination
    const totalCount = await prisma.sale.count({ where });
    
    // Whitelist sort field to avoid Prisma errors and use a valid Sale field
    const validSortFields = ['saleDate', 'createdAt', 'updatedAt', 'total', 'saleNumber', 'status'];
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'saleDate';
    const orderBy = { [safeSortBy]: sortOrder === 'asc' ? 'asc' : 'desc' };
    
    // Fetch sales with related data
    const sales = await prisma.sale.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        client: {
          select: {
            id: true,
            name: true,
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          }
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        },
        inventoryBatchConsumptions: {
          include: {
            batch: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                  }
                }
              }
            }
          }
        }
      }
    });
    
    // Format the sales data for the response
    const formattedSales = sales.map(sale => {
      // Handle both old and new sales data structures
      const productSummary = sale.items && sale.items.length > 0
        ? sale.items
            .filter(item => item !== null && item !== undefined)
            .map(item => {
              let label = 'Item';
              
              // Prioritize product name from relationship if it exists
              if (item.product && item.product.name && item.product.name.trim() !== '') {
                label = item.product.name;
              }
              // For older sales where product relationship might not be properly established,
              // the product name might be stored in the description field
              else if (item.description && item.description.trim() !== '') {
                label = item.description.trim();
              }
              // Handle custom product data
              else if (item.customProductData) {
                if (typeof item.customProductData === 'string' && item.customProductData.trim() !== '') {
                  label = item.customProductData.trim();
                } else if (typeof item.customProductData === 'object') {
                  if (item.customProductData.name && item.customProductData.name.trim() !== '') {
                    label = item.customProductData.name.trim();
                  } else if (item.customProductData.description && item.customProductData.description.trim() !== '') {
                    label = item.customProductData.description.trim();
                  } else {
                    label = item.isCustom ? 'Custom Item' : 'Item';
                  }
                } else {
                  label = item.isCustom ? 'Custom Item' : 'Item';
                }
              }
              // If it's marked as custom, use that
              else if (item.isCustom) {
                label = 'Custom Item';
              }
              // Final fallback - for very old sales where the product name might be stored differently
              else {
                // Check if there's any other field that might contain product information
                label = item.description || 'Item';
              }
              
              const qty = typeof item.quantity === 'number' ? item.quantity : Number(item.quantity) || 0;
              return `${label} (x${qty})`;
            }).join(', ').trim() || 'Items listed'
        : (() => {
            // Fallback 1: get product names from inventory batch consumptions (288 sales)
            const consumptions = sale.inventoryBatchConsumptions || [];
            if (consumptions.length > 0) {
              const productMap = {};
              for (const c of consumptions) {
                const name = c.batch?.product?.name || 'Item';
                const qty = Number(c.quantity) || 0;
                if (productMap[name]) productMap[name] += qty;
                else productMap[name] = qty;
              }
              return Object.entries(productMap)
                .map(([name, qty]) => `${name} (x${qty})`)
                .join(', ');
            }
            // Fallback 2: use originalReference as category/product label (2,580 historical sales)
            if (sale.originalReference) {
              return sale.originalReference;
            }
            // Fallback 3: show sale total for sales with no recoverable item data
            return sale.total ? `MK ${Number(sale.total).toLocaleString()} sale` : 'No items';
          })();
      
      // For historical sales, prefer historicalDate for the display date
      const displayDate = (sale.isHistorical && sale.historicalDate)
        ? sale.historicalDate.toISOString().split('T')[0]
        : sale.saleDate.toISOString().split('T')[0];

      return {
        id: sale.id,
        saleNumber: sale.saleNumber,
        date: displayDate,
        client: sale.client ? sale.client.name : 'Walk-in Customer',
        clientId: sale.clientId,
        createdBy: sale.createdBy.name,
        productSummary,
        subtotal: sale.subtotal.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }),
        taxAmount: sale.taxAmount.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }),
        total: sale.total.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }),
        discount: sale.discount,
        taxRate: sale.taxRate,
        status: sale.status,
        paymentMethod: sale.paymentMethod,
        notes: sale.notes,
        itemCount: sale.items.length,
        createdAt: sale.createdAt.toISOString(),
        // Include raw numeric values for sorting and calculations
        rawTotal: sale.total,
        rawSubtotal: sale.subtotal,
        // Historical transaction metadata
        isHistorical: sale.isHistorical || false,
        historicalDate: sale.historicalDate ? sale.historicalDate.toISOString().split('T')[0] : null,
        migrationBatch: sale.migrationBatch,
        originalReference: sale.originalReference
      };
    });
    
    // Return sales with pagination metadata
    return NextResponse.json({
      sales: formattedSales,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching sales:', error);
    
    // Return empty data with an error message
    return NextResponse.json({
      sales: [],
      pagination: {
        page: 1,
        limit: 10,
        totalCount: 0,
        totalPages: 0
      },
      error: 'Failed to fetch sales. Please try again.'
    });
  }
}

// POST - Create a new sale (Enhanced with Project B's business logic)
// Implementation lives in lib/sales/createSale.js so POS, the desktop outbox and
// this route all post through exactly one code path.
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'sales.create');
    if (perm) return perm;

    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const data = await request.json();
    const sale = await createSale({ user, body: data });

    return NextResponse.json(
      {
        message: 'Sale created successfully',
        sale,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error?.name === 'ServiceHttpError') {
      return NextResponse.json(error.body, { status: error.status });
    }

    console.error('❌ Error creating sale:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      meta: error.meta
    });

    // Check if it's a transaction abort error
    if (error.message?.includes('transaction is aborted') || 
        error.message?.includes('25P02') ||
        error.code === 'P2034') {
      return NextResponse.json(
        { 
          error: 'Transaction failed. This usually means an error occurred during sale creation. ' +
                 'Please check that all products exist, accounts are valid, and inventory is sufficient. ' +
                 'Check server logs for the original error.',
          details: error.message 
        },
        { status: 500 }
      );
    }
    
    // Check for specific error types
    if (error.message?.includes('accountId') || error.message?.includes('account')) {
      const isGlLeaf =
        error.message.includes('consolidation parent') ||
        error.message.includes('Structural chart section headers') ||
        error.message.includes('not open for new postings');
      return NextResponse.json(
        {
          error: isGlLeaf
            ? 'GL posting account error: a line is using a chart rollup or closed account. Use a detail account under that group (e.g. Stock on Hand under Inventory, Purchases under Cost of Sales), or contact support.'
            : 'Account validation failed. Please ensure all sale items have valid income accounts from Chart of Accounts.',
          details: error.message,
        },
        { status: 400 }
      );
    }
    
    if (error.message?.includes('Insufficient stock')) {
      return NextResponse.json(
        { 
          error: error.message 
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to create sale. Please try again.',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

