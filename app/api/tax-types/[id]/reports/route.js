import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

/**
 * GET /api/tax-types/[id]/reports
 * Get all tax reports for a specific tax type
 */
export async function GET(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const resolvedParams = await params;
    const { id } = resolvedParams;

    // Get query parameters for date filtering
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Verify tax type exists and belongs to tenant
    const taxType = await prisma.taxType.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
      },
      include: {
        account: {
          select: {
            id: true,
            accountCode: true,
            accountName: true,
            accountType: true,
          },
        },
      },
    });

    if (!taxType) {
      return NextResponse.json(
        { error: 'Tax type not found' },
        { status: 404 }
      );
    }

    // Build date filter - only apply if both dates are provided and valid
    const dateFilter = {};
    if (startDate && endDate && startDate !== '' && endDate !== '') {
      const start = new Date(startDate);
      const end = new Date(endDate);
      // Set end date to end of day to include all sales on that date
      end.setHours(23, 59, 59, 999);
      dateFilter.gte = start;
      dateFilter.lte = end;
    }

    // Get products using this tax type
    const productTaxes = await prisma.productTax.findMany({
      where: {
        taxTypeId: id,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            price: true,
            isDeleted: true,
          },
        },
      },
    });

    // Get sales using this tax type (from SaleItemTax)
    // Filter by sale date instead of SaleItemTax createdAt for better accuracy
    let saleItemTaxes = [];
    try {
      const whereClause = {
        taxTypeId: id,
      };

      // If date range is provided, filter by sale date through the relation
      if (startDate && endDate && startDate !== '' && endDate !== '' && Object.keys(dateFilter).length > 0) {
        whereClause.saleItem = {
          sale: {
            saleDate: dateFilter,
          },
        };
      }

      saleItemTaxes = await prisma.saleItemTax.findMany({
        where: whereClause,
        include: {
          saleItem: {
            include: {
              sale: {
                select: {
                  id: true,
                  saleNumber: true,
                  saleDate: true,
                  status: true,
                  client: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
              product: {
                select: {
                  name: true,
                  sku: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // If no SaleItemTax records found, try fallback: find sales with products that have this tax type
      if (saleItemTaxes.length === 0 && productTaxes.length > 0) {
        const productIds = productTaxes.map(pt => pt.productId);
        
        const saleItemWhere = {
          productId: { in: productIds },
          sale: {
            tenantId: user.tenantId,
            ...(startDate && endDate && startDate !== '' && endDate !== '' && Object.keys(dateFilter).length > 0 && {
              saleDate: dateFilter,
            }),
          },
        };

        const saleItems = await prisma.saleItem.findMany({
          where: saleItemWhere,
          include: {
            sale: {
              select: {
                id: true,
                saleNumber: true,
                saleDate: true,
                status: true,
                client: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            product: {
              select: {
                name: true,
                sku: true,
              },
            },
          },
          orderBy: {
            sale: {
              saleDate: 'desc',
            },
          },
        });

        // Convert sale items to saleItemTax format for consistent display
        // Calculate tax amount from sale item's taxAmount or taxRate
        saleItemTaxes = saleItems.map(saleItem => {
          const taxableAmount = saleItem.quantity * saleItem.unitPrice;
          // Use taxAmount if available, otherwise calculate from taxRate
          const calculatedTaxAmount = saleItem.taxAmount > 0 
            ? saleItem.taxAmount 
            : (taxableAmount * (taxType.taxRate / 100));
          
          return {
            id: `fallback-${saleItem.id}`,
            taxTypeId: id,
            taxName: taxType.taxName,
            taxCode: taxType.taxCode,
            taxRate: saleItem.taxRate > 0 ? saleItem.taxRate : taxType.taxRate,
            taxAmount: calculatedTaxAmount,
            createdAt: saleItem.sale.saleDate,
            saleItem: saleItem,
          };
        });
      }
    } catch (error) {
      // SaleItemTax table might not exist, continue without it
      console.warn('SaleItemTax table not available:', error.message);
      console.error('Error details:', error);
    }

    // Calculate summary statistics
    const totalTaxCollected = saleItemTaxes.reduce(
      (sum, item) => sum + (item.taxAmount || 0),
      0
    );

    // Count products using this tax
    const productCount = productTaxes.length;

    // Count sales using this tax
    const saleCount = saleItemTaxes.length;

    return NextResponse.json({
      taxType: {
        id: taxType.id,
        taxId: taxType.taxId,
        taxName: taxType.taxName,
        taxCode: taxType.taxCode,
        taxRate: taxType.taxRate,
        calculationType: taxType.calculationType,
        account: taxType.account,
      },
      summary: {
        productCount,
        saleCount,
        totalTaxCollected,
      },
      products: productTaxes.map((pt) => ({
        id: pt.product.id,
        name: pt.product.name,
        sku: pt.product.sku,
        price: pt.product.price,
        isDeleted: pt.product.isDeleted,
        assignedAt: pt.createdAt,
      })),
      sales: saleItemTaxes.map((sit) => ({
        id: sit.id,
        saleId: sit.saleItem.sale.id,
        saleNumber: sit.saleItem.sale.saleNumber,
        saleDate: sit.saleItem.sale.saleDate,
        clientName: sit.saleItem.sale.client?.name || 'Direct Sale',
        productName: sit.saleItem.product?.name || sit.saleItem.description,
        productSku: sit.saleItem.product?.sku,
        quantity: sit.saleItem.quantity,
        unitPrice: sit.saleItem.unitPrice,
        taxableAmount: sit.saleItem.quantity * sit.saleItem.unitPrice,
        taxAmount: sit.taxAmount,
        taxRate: sit.taxRate,
        createdAt: sit.createdAt,
      })),
      period: startDate && endDate ? { startDate, endDate } : null,
    });
  } catch (error) {
    console.error('Error fetching tax reports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tax reports', details: error.message },
      { status: 500 }
    );
  }
}

