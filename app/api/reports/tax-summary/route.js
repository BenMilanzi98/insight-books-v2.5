import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { addBranchFilter } from '@/lib/dashboardBranchFilter';
import { parseInclusiveApiYmdRange } from '@/lib/dateUtils';
import {
  validInvoiceReportWhere,
  validPurchaseDocumentStatusFilter,
  validSaleReportWhere,
} from '@/lib/reportingSourceRules';
import {
  invoiceItemNetRevenueExTax,
  roundReportAmount,
  saleItemNetRevenueExTax,
} from '@/lib/reportLineNetRevenue';
import { addMoney, multiplyMoney, percentOfMoney, roundMoney, subtractMoney } from '@/lib/money';

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
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    // Validate dates
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }

    const { start, end } = parseInclusiveApiYmdRange(startDate, endDate);
    
    // Get invoice items with tax data - filter by branch
    const invoiceItems = await prisma.invoiceItem.findMany({
      where: {
        invoice: addBranchFilter(user, {
          ...validInvoiceReportWhere(user.tenantId, 'issueDate', start, end)
        })
      },
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
            issueDate: true,
            status: true,
            client: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });
    
    // Get sale items with tax data - filter by branch
    const saleItems = await prisma.saleItem.findMany({
      where: {
        sale: addBranchFilter(user, {
          ...validSaleReportWhere(user.tenantId, 'saleDate', start, end)
        })
      },
      include: {
        sale: {
          select: {
            saleNumber: true,
            saleDate: true,
            status: true,
            taxRate: true, // Include taxRate from the sale
            client: {
              select: {
                name: true
              }
            }
          }
        },
        itemTaxes: {
          select: {
            taxTypeId: true,
            taxName: true,
            taxCode: true,
            taxRate: true,
            taxAmount: true
          }
        },
        product: {
          select: {
            id: true,
            name: true,
            productTaxes: {
              include: {
                taxType: {
                  select: {
                    id: true,
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
        }
      }
    });
    
    // Get tax-related expenses (exclude deleted ones) - filter by branch
    const taxExpenses = await prisma.expense.findMany({
      where: addBranchFilter(user, {
        tenantId: user.tenantId,
        status: 'Approved',
        category: {
          contains: 'Tax' // This assumes tax expenses are categorized with "Tax" in the name
        },
        date: {
          gte: start,
          lte: end
        },
        isDeleted: false, // Exclude deleted expenses
        isReversal: false
      }),
      select: {
        id: true,
        description: true,
        amount: true,
        date: true,
        category: true
      }
    });
    
    // Organize collected tax by rate
    const collectedTaxesByRate = {};
    
    // Process invoice items
    invoiceItems.forEach(item => {
      // Ensure taxRate is a valid number
      if (typeof item.taxRate !== 'number') {
        console.warn(`Invoice item ${item.id} has invalid tax rate`);
        return; // Skip this item
      }
      const taxRate = item.taxRate.toString();
      if (!collectedTaxesByRate[taxRate]) {
        collectedTaxesByRate[taxRate] = {
          rate: item.taxRate,
          taxableAmount: 0,
          taxAmount: 0,
          items: []
        };
      }
      const taxableAmount = invoiceItemNetRevenueExTax(item);
      if (taxableAmount <= 0) return;
      // Ensure we're using a valid number for tax calculation
      const taxAmount = percentOfMoney(taxableAmount, item.taxRate);
      
      collectedTaxesByRate[taxRate].taxableAmount = addMoney(collectedTaxesByRate[taxRate].taxableAmount, taxableAmount);
      collectedTaxesByRate[taxRate].taxAmount = addMoney(collectedTaxesByRate[taxRate].taxAmount, taxAmount);
      
      collectedTaxesByRate[taxRate].items.push({
        type: 'invoice',
        id: item.id,
        description: item.description,
        invoiceNumber: item.invoice.invoiceNumber,
        date: item.invoice.issueDate,
        client: item.invoice.client?.name || 'Unknown',
        status: item.invoice.status,
        taxableAmount,
        taxAmount
      });
    });
    
    // Get all product IDs from sale items for batch querying ProductTax if needed
    const productIds = saleItems
      .filter(item => item.productId)
      .map(item => item.productId)
      .filter((id, index, self) => self.indexOf(id) === index); // Unique IDs
    
    // Batch fetch ProductTax records for products that don't have the relation loaded
    let productTaxesMap = {};
    if (productIds.length > 0) {
      try {
        const productTaxes = await prisma.productTax.findMany({
          where: {
            productId: { in: productIds },
          },
          include: {
            taxType: {
              select: {
                id: true,
                taxName: true,
                taxCode: true,
                taxRate: true,
                calculationType: true,
                status: true,
              },
            },
          },
        });
        
        // Map by productId
        productTaxes.forEach(pt => {
          if (!productTaxesMap[pt.productId]) {
            productTaxesMap[pt.productId] = [];
          }
          productTaxesMap[pt.productId].push(pt);
        });
      } catch (error) {
        console.warn('Error fetching ProductTax records:', error.message);
      }
    }
    
    // Process sale items - prioritize SaleItemTax records if available
    saleItems.forEach(item => {
      const sale = item.sale;
      if (!sale) {
        console.warn(`Sale item ${item.id} has no associated sale`);
        return; // Skip this item
      }
      
      const taxableAmount = saleItemNetRevenueExTax(item);
      if (taxableAmount <= 0) return;
      
      // If SaleItemTax records exist, use them (more accurate)
      if (item.itemTaxes && item.itemTaxes.length > 0) {
        item.itemTaxes.forEach(tax => {
          const taxRate = tax.taxRate.toString();
          
          if (!collectedTaxesByRate[taxRate]) {
            collectedTaxesByRate[taxRate] = {
              rate: tax.taxRate,
              taxableAmount: 0,
              taxAmount: 0,
              items: []
            };
          }
          
          collectedTaxesByRate[taxRate].taxableAmount = addMoney(collectedTaxesByRate[taxRate].taxableAmount, taxableAmount);
          collectedTaxesByRate[taxRate].taxAmount = addMoney(collectedTaxesByRate[taxRate].taxAmount, tax.taxAmount);
          
          collectedTaxesByRate[taxRate].items.push({
            type: 'sale',
            id: item.id,
            description: item.description,
            saleNumber: sale.saleNumber,
            date: sale.saleDate,
            client: sale.client?.name || 'Direct Sale',
            status: sale.status,
            taxableAmount,
            taxAmount: tax.taxAmount
          });
        });
      } else {
        // Fallback: Check if product has taxes assigned via ProductTax
        // Try to get productTaxes from loaded relation first, then from batch query
        let productTaxes = null;
        if (item.product && item.product.productTaxes && item.product.productTaxes.length > 0) {
          productTaxes = item.product.productTaxes;
        } else if (item.productId && productTaxesMap[item.productId]) {
          productTaxes = productTaxesMap[item.productId];
        }
        
        // First check if product exists and has productId
        if (item.productId && productTaxes && productTaxes.length > 0) {
          // Calculate tax from product's assigned taxes
          productTaxes.forEach(productTax => {
              const taxType = productTax.taxType;
              if (!taxType) {
                console.warn(`ProductTax ${productTax.id} has no taxType`);
                return;
              }
              
              // Check if tax type is active
              if (taxType.status !== 'Active') {
                return;
              }
              
              const taxRate = taxType.taxRate.toString();
              
              if (!collectedTaxesByRate[taxRate]) {
                collectedTaxesByRate[taxRate] = {
                  rate: taxType.taxRate,
                  taxableAmount: 0,
                  taxAmount: 0,
                  items: []
                };
              }
              
              // Calculate tax amount based on calculation type
              let calculatedTaxAmount = 0;
              if (taxType.calculationType === 'Fixed') {
                calculatedTaxAmount = multiplyMoney(taxType.taxRate, item.quantity || 1);
              } else {
                calculatedTaxAmount = percentOfMoney(taxableAmount, taxType.taxRate);
              }
              
              collectedTaxesByRate[taxRate].taxableAmount = addMoney(collectedTaxesByRate[taxRate].taxableAmount, taxableAmount);
              collectedTaxesByRate[taxRate].taxAmount = addMoney(collectedTaxesByRate[taxRate].taxAmount, calculatedTaxAmount);
              
              collectedTaxesByRate[taxRate].items.push({
                type: 'sale',
                id: item.id,
                description: item.description,
                saleNumber: sale.saleNumber,
                date: sale.saleDate,
                client: sale.client?.name || 'Direct Sale',
                status: sale.status,
                taxableAmount,
                taxAmount: calculatedTaxAmount
              });
            });
          } else if (!item.productId) {
          // Custom product or no product - skip tax calculation
          // (Could add custom product tax handling here if needed)
          return;
        } else {
          // Fallback to legacy tax calculation from taxRate/taxAmount fields
          let taxRateValue = 0;
          
          // Check if tax rate is on the item (preferred)
          if (typeof item.taxRate === 'number' && item.taxRate > 0) {
            taxRateValue = item.taxRate;
          } 
          // Fall back to sale-level tax rate
          else if (sale && typeof sale.taxRate === 'number' && sale.taxRate > 0) {
            taxRateValue = sale.taxRate;
          } 
          else {
            // No tax data available, skip this item
            return;
          }
          
          const taxRate = taxRateValue.toString();
          
          if (!collectedTaxesByRate[taxRate]) {
            collectedTaxesByRate[taxRate] = {
              rate: parseFloat(taxRate),
              taxableAmount: 0,
              taxAmount: 0,
              items: []
            };
          }
          
          // Use individual item tax data if available, otherwise calculate from rate
          const itemTaxAmount = roundMoney(item.taxAmount || 0);
          const finalTaxAmount = itemTaxAmount > 0 ? itemTaxAmount : percentOfMoney(taxableAmount, taxRateValue);
          
          collectedTaxesByRate[taxRate].taxableAmount = addMoney(collectedTaxesByRate[taxRate].taxableAmount, taxableAmount);
          collectedTaxesByRate[taxRate].taxAmount = addMoney(collectedTaxesByRate[taxRate].taxAmount, finalTaxAmount);
          
          collectedTaxesByRate[taxRate].items.push({
            type: 'sale',
            id: item.id,
            description: item.description,
            saleNumber: sale.saleNumber,
            date: sale.saleDate,
            client: sale.client?.name || 'Direct Sale',
            status: sale.status,
            taxableAmount,
            taxAmount: finalTaxAmount
          });
        }
      }
    });
    
    // Calculate totals
    const totalTaxableAmount = roundReportAmount(Object.values(collectedTaxesByRate).reduce(
      (sum, category) => addMoney(sum, category.taxableAmount),
      0
    ));
    
    const totalCollectedTax = roundReportAmount(Object.values(collectedTaxesByRate).reduce(
      (sum, category) => addMoney(sum, category.taxAmount),
      0
    ));
    
    const totalTaxPaid = roundReportAmount(taxExpenses.reduce(
      (sum, expense) => addMoney(sum, expense.amount),
      0
    ));
    
    const netTaxLiability = roundReportAmount(subtractMoney(totalCollectedTax, totalTaxPaid));

    // Input VAT: tax on purchases (Supplier Bills + Purchase Order line tax in period)
    const supplierBillsInPeriod = await prisma.supplierBill.findMany({
      where: {
        tenantId: user.tenantId,
        status: validPurchaseDocumentStatusFilter(),
        billDate: {
          gte: start,
          lte: end
        }
      },
      select: { taxAmount: true }
    });
    const inputVatFromBills = supplierBillsInPeriod.reduce((sum, b) => addMoney(sum, b.taxAmount), 0);

    const poItemsInPeriod = await prisma.purchaseOrderItem.findMany({
      where: {
        purchaseOrder: {
          tenantId: user.tenantId,
          status: validPurchaseDocumentStatusFilter(),
          supplierBills: { none: {} },
          poDate: {
            gte: start,
            lte: end
          }
        }
      },
      select: { taxAmount: true }
    });
    const inputVatFromPOs = poItemsInPeriod.reduce((sum, i) => addMoney(sum, i.taxAmount), 0);
    const inputVat = roundReportAmount(addMoney(inputVatFromBills, inputVatFromPOs));

    // Output VAT = tax collected on sales/invoices
    const outputVat = roundReportAmount(totalCollectedTax);
    const netVatPayable = roundReportAmount(subtractMoney(outputVat, inputVat));
    
    return NextResponse.json({
      period: {
        startDate,
        endDate
      },
      collectedTaxes: {
        byRate: Object.values(collectedTaxesByRate),
        totalTaxableAmount,
        totalCollectedTax
      },
      paidTaxes: {
        expenses: taxExpenses,
        totalTaxPaid
      },
      netTaxLiability,
      vatSummary: {
        inputVat,
        inputVatFromBills,
        inputVatFromPOs,
        outputVat,
        netVatPayable
      }
    });
  } catch (error) {
    console.error('Error generating tax summary:', error);
    return NextResponse.json(
      { error: 'Failed to generate tax summary. Please try again.' },
      { status: 500 }
    );
  }
}
