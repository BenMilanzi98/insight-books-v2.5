import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

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
    
    // Get invoice items with tax data
    const invoiceItems = await prisma.invoiceItem.findMany({
      where: {
        invoice: {
          tenantId: user.tenantId,
          issueDate: {
            gte: new Date(startDate),
            lte: new Date(endDate)
          }
        }
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
    
    // Get sale items with tax data
    const saleItems = await prisma.saleItem.findMany({
      where: {
        sale: {
          tenantId: user.tenantId,
          saleDate: {
            gte: new Date(startDate),
            lte: new Date(endDate)
          }
        }
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
        }
      }
    });
    
    // Get tax-related expenses (exclude deleted ones)
    const taxExpenses = await prisma.expense.findMany({
      where: {
        tenantId: user.tenantId,
        category: {
          contains: 'Tax' // This assumes tax expenses are categorized with "Tax" in the name
        },
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        },
        isDeleted: false // Exclude deleted expenses
      },
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
      const taxableAmount = item.quantity * item.unitPrice;
      // Ensure we're using a valid number for tax calculation
      const taxAmount = taxableAmount * (item.taxRate / 100);
      
      collectedTaxesByRate[taxRate].taxableAmount += taxableAmount;
      collectedTaxesByRate[taxRate].taxAmount += taxAmount;
      
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
    
    // Process sale items (Development branch approach - prioritized)
    saleItems.forEach(item => {
      const sale = item.sale;
      if (!sale) {
        console.warn(`Sale item ${item.id} has no associated sale`);
        return; // Skip this item
      }
      
      // Get tax rate from the sale item first, then fall back to sale (Development approach)
      let taxRateValue = 0;
      
      // Check if tax rate is on the item (preferred)
      if (typeof item.taxRate === 'number') {
        taxRateValue = item.taxRate;
      } 
      // Fall back to sale-level tax rate
      else if (sale && typeof sale.taxRate === 'number') {
        taxRateValue = sale.taxRate;
      } 
      else {
        console.warn(`Sale item ${item.id} has no valid tax rate`);
        return; // Skip this item
      }
      
      // Skip items with no tax
      if (taxRateValue === 0) {
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
      
      const taxableAmount = item.quantity * item.unitPrice;
      
      // Use individual item tax data if available, otherwise calculate from rate (Combined approach)
      const itemTaxAmount = item.taxAmount || 0;
      const finalTaxAmount = itemTaxAmount > 0 ? itemTaxAmount : (taxableAmount * (taxRateValue / 100));
      
      collectedTaxesByRate[taxRate].taxableAmount += taxableAmount;
      collectedTaxesByRate[taxRate].taxAmount += finalTaxAmount;
      
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
    });
    
    // Calculate totals
    const totalTaxableAmount = Object.values(collectedTaxesByRate).reduce(
      (sum, category) => sum + category.taxableAmount,
      0
    );
    
    const totalCollectedTax = Object.values(collectedTaxesByRate).reduce(
      (sum, category) => sum + category.taxAmount,
      0
    );
    
    const totalTaxPaid = taxExpenses.reduce(
      (sum, expense) => sum + expense.amount,
      0
    );
    
    const netTaxLiability = totalCollectedTax - totalTaxPaid;
    
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
      netTaxLiability
    });
  } catch (error) {
    console.error('Error generating tax summary:', error);
    return NextResponse.json(
      { error: 'Failed to generate tax summary. Please try again.' },
      { status: 500 }
    );
  }
}